/**
 * J0.4 · 最小截图回归 —— 抓图
 * ============================================================================
 * 产出：**同一机位、同一种子、同一帧 → 逐字节相同的 PNG**。
 *
 * 三个确定性前提（缺一不可，前两个已完成）：
 *
 * | 前提 | 消除什么 | 状态 |
 * |---|---|---|
 * | `F0.2` 种子随机（`?deterministic=1`） | 场景布局的随机性（树/石/星空/粒子） | ✅ |
 * | `F0.3` 可步进时钟（`&frames=120`） | 动画相位的时间不确定性 | ✅ |
 * | **`J0.4` 固定机位（`&cam=…`）** | **观察点的不确定性** | ← 本脚本 |
 *
 * ## 用法
 *
 * ```bash
 * pnpm serve                                     # 另开一个终端
 * node tests/visual/capture.mjs                  # 抓图 → _shots/visual/（不写入基线）
 * node tests/visual/capture.mjs --rounds=3       # ★ DoD：连续 3 轮，轮间必须零差异
 * node tests/visual/capture.mjs --update         # 更新基线 → tests/visual/baseline/（需人工审查画面）
 * node tests/visual/compare.mjs                  # 与基线比对（搬迁/改动后跑这个）
 * ```
 *
 * ## 判据（与 `tests/visual/README.md` 一致）
 *
 * - **搬迁式改动**（把 `legacy` 里的物件模块化）→ 全部机位 **sha256 相同**
 * - **新增式改动**（场景里原本没有的东西）→ **只有一个机位允许差异**，人工审查后更新基线
 *
 * ⚠️ 「sha256 相同」这个判据在**画面全黑**时同样成立（`F0.3` §6.1 的教训）。
 *    因此每张图都附带内容统计（颜色数 / 边缘占比 / 主色占比），空白画面直接判失败。
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

import { launch, connect, findBrowser, sleep } from '../e2e/cdp.mjs' // 零依赖 CDP 客户端（`03` §7 规定的移植位置）
import { resolveHomePath } from '../e2e/page.mjs' // J1.5：首页解析（dist 产物 与 零构建 两种形态）
import { readPng, analyzeImage, diffPng } from './png.mjs'
import { POSES, DEFAULT_POSE_ORDER, camParam } from './poses.js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')
const BASELINE_DIR = path.join(HERE, 'baseline')
const SHOTS_DIR = path.join(ROOT, '_shots/visual')

/** 默认观测条件（与 `ArtLine-Part/04` P0.4 的规定一致：固定视口 1440×900、定格 120 帧） */
export const DEFAULTS = {
  viewport: { width: 1440, height: 900 },
  frames: 120,
  frameStep: 1 / 60,
  port: Number(process.env.CDP_PORT || 9333),
}

/**
 * `J1.5`：给页面附加"纯 3D"开关。
 *
 * Astro 版首页在构建期就渲染出**门厅**（标题 + 最新文章列表，见 `BaseLayout.astro`），
 * 它在 3D 就绪后自行退场。截图回归要的是"和 `J0.4` 基线完全相同的起点"，
 * 所以加 `bare=1` 让门厅整块不渲染（这是**呈现位选择**，不是测试后门：
 * 3D 的启动、`?deterministic`/`?cam`/`?house` 的解析全部照旧走同一条产品路径）。
 *
 * 零构建路径（`index.html`）不认识这个参数，多一个 URL 参数对它无害 —— 两个形态可以共用同一条命令。
 */
export const BARE_PARAM = 'bare=1'

// ── 参数解析 ────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const arg = (name, def) => {
    const hit = argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`))
    if (!hit) return def
    const eq = hit.indexOf('=')
    return eq === -1 ? true : hit.slice(eq + 1)
  }
  const [vw, vh] = String(arg('viewport', '1440x900')).split('x').map(Number)
  return {
    url: String(arg('url', process.env.CABIN_URL || 'http://127.0.0.1:5173')).replace(/\/$/, ''),
    out: arg('out', null) ? String(arg('out')) : null,
    update: Boolean(arg('update', false)),
    rounds: Math.max(1, Number(arg('rounds', 1)) || 1),
    poses: String(arg('poses', DEFAULT_POSE_ORDER.join(','))).split(',').map((s) => s.trim()).filter(Boolean),
    viewport: { width: Number.isFinite(vw) && vw > 0 ? vw : DEFAULTS.viewport.width, height: Number.isFinite(vh) && vh > 0 ? vh : DEFAULTS.viewport.height },
    frames: Math.max(1, Number(arg('frames', DEFAULTS.frames)) || DEFAULTS.frames),
    frameStep: Number(arg('frameStep', DEFAULTS.frameStep)) || DEFAULTS.frameStep,
    quiet: Boolean(arg('quiet', false)),
  }
}

/**
 * 服务健康检查：不可访问 / 不是本项目页面时必须**立刻**失败
 * （否则会截到错误页，伪装成"两次一致"）。
 *
 * `J1.5` 起不再要求首页是 `/index.html`：`dist/` 产物与零构建路径的家都在
 * `tests/e2e/page.mjs` 里统一解析。
 *
 * @param {string} base
 * @returns {Promise<string>} 解析出的首页路径（`/` 或 `/index.html`）
 */
async function checkServer(base) {
  const homePath = await resolveHomePath(base, {
    onError: (why) => {
      console.error(`✗ 无法访问 ${base} 或返回内容不是本项目页面 —— ${why}`)
      console.error('  请先启动服务：pnpm serve（产物）或 pnpm serve:legacy（零构建）')
    },
  })
  if (!homePath) process.exit(2)
  return homePath
}

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex')

/**
 * 抓取全部机位。
 *
 * ⚠️ **每个机位都重新加载页面**：机位不是"移动相机"，而是"从初始状态重新观察"。
 * 复用页面会让后一个机位落在前一个推进过的状态上（120 帧 → 240 帧），画面不可比。
 * URL 里带 `&run=N` 递增序号，保证每次都是真正的重新导航（相同 URL 的导航行为依浏览器而异）。
 *
 * @param {object} opts
 * @param {string[]} opts.poses 机位名（在 `poseTable` 里查）
 * @param {Record<string, {label:string,note:string,cam:number[]|null}>} [opts.poseTable]
 *        机位表；默认用 `poses.js` 的正式表。探索新机位时由 `scripts/oneoff/` 传入候选表，
 *        这样"挑机位"不需要改动正式基线定义。
 */
export async function capturePoses(opts) {
  const { url, viewport, frames, frameStep, poses } = opts
  const homePath = opts.homePath || '/index.html'
  const bare = opts.bare === false ? '' : `&${BARE_PARAM}`
  const poseTable = opts.poseTable || POSES
  const browser = findBrowser()
  if (!browser) {
    console.error('✗ 未找到 Chrome / Edge（可用 CABIN_BROWSER 指定路径）')
    process.exit(1)
  }

  const chrome = await launch({ port: DEFAULTS.port, width: viewport.width, height: viewport.height })
  const page = await connect(chrome.port)
  await page.setViewport(viewport.width, viewport.height)

  const shots = []
  let run = 0
  try {
    for (const name of poses) {
      const pose = poseTable[name]
      if (!pose) {
        console.error(`✗ 未知机位 "${name}"（见 tests/visual/poses.js）`)
        process.exit(1)
      }
      run++
      // 机位通过 `?cam=` / `?house=` 交给页面：产品代码只认「六个数 + 一个开关」，
      // 机位名与坐标只存在于本目录的 poses.js（架构不变量 N9）
      const camQuery = pose.cam ? `&cam=${camParam(pose.cam)}` : ''
      const houseQuery = pose.house ? `&house=${pose.house}` : ''
      const query = `?deterministic=1&frames=${frames}&frameStep=${frameStep}${bare}${camQuery}${houseQuery}&run=${run}`
      const target = `${url}${homePath}${query}`

      page.clearLogs()
      await page.navigate(target)
      // 等 boot 真正完成（含 120 帧同步推进 + 静止重绘已启动）
      await page.waitFor('document.documentElement.dataset.cabin === "ready"', { timeout: 120000 })
      await page.waitFor('document.documentElement.dataset.cabinStillRepaint === "1"', { timeout: 30000 })
      await sleep(400) // 给静止重绘几帧真实 rAF，确保 drawing buffer 有内容

      const meta = await page.eval(`(() => {
        const d = document.documentElement.dataset
        return {
          seed: d.cabinSeed || null,
          digest: d.cabinSceneDigest || null,
          clock: d.cabinClock ? JSON.parse(d.cabinClock) : null,
          cam: d.cabinCam || null,
          house: d.cabinHouse || null,
          deterministic: d.cabinDeterministic || null,
          manual: d.cabinManualClock || null,
          frames: d.cabinFrames || null,
          canvas: (() => { const c = document.querySelector('canvas'); return c ? { w: c.width, h: c.height } : null })(),
        }
      })()`)

      const file = path.join(opts.outDir, `${name}.png`)
      const bytes = await page.screenshot(file)
      const img = readPng(file)
      const stats = analyzeImage(img)

      // ── 健康检查：截图必须是**有效画面**，否则"零差异"毫无意义 ──
      const problems = []
      if (!meta.canvas) problems.push('canvas 未创建')
      if (meta.manual !== '1') problems.push('manual 时钟未启用')
      if (String(meta.frames) !== String(frames)) problems.push(`定格帧数不符（${meta.frames} ≠ ${frames}）`)
      if (pose.cam) {
        if (meta.cam !== pose.cam.join(',')) problems.push(`机位未生效（data-cabin-cam=${meta.cam}，期望 ${pose.cam.join(',')}）`)
      } else if (meta.cam) {
        problems.push(`默认机位不应覆盖相机（data-cabin-cam=${meta.cam}）`)
      }
      if (pose.house) {
        if (meta.house !== pose.house) problems.push(`小屋形态未生效（data-cabin-house=${meta.house}，期望 ${pose.house}）`)
      } else if (meta.house) {
        problems.push(`未声明 house 的机位不应改动小屋形态（data-cabin-house=${meta.house}）`)
      }
      if (img.width !== viewport.width || img.height !== viewport.height) {
        problems.push(`截图尺寸 ${img.width}×${img.height} ≠ 视口 ${viewport.width}×${viewport.height}`)
      }
      if (stats.topColorRatio > 0.98) problems.push(`画面几乎单色（主色占比 ${(stats.topColorRatio * 100).toFixed(1)}%）—— 疑似空白/黑屏`)
      // 边缘判据：线稿场景正常值约 15%–20%（三张基线实测），贴墙等极端机位也在 3.5% 以上。
      // 低于 1% 说明连描边都没画出来 —— 那才是真的"无内容"。
      if (stats.edgeRatio < 0.01) problems.push(`边缘像素过少（${(stats.edgeRatio * 100).toFixed(2)}%）—— 疑似无内容`)
      const errs = page.errors()
      if (errs.length) problems.push(`页面报错：${errs[0].text.slice(0, 160)}`)

      const shot = {
        name,
        label: pose.label,
        note: pose.note,
        cam: pose.cam,
        house: pose.house ?? null,
        file: `${name}.png`,
        bytes,
        sha256: sha256(fs.readFileSync(file)),
        size: { width: img.width, height: img.height },
        stats: {
          colors: stats.colors,
          edgeRatio: Number(stats.edgeRatio.toFixed(4)),
          topColorRatio: Number(stats.topColorRatio.toFixed(4)),
          mean: stats.mean,
        },
        clock: meta.clock,
        seed: meta.seed,
        sceneDigest: meta.digest,
        ok: problems.length === 0,
        problems,
      }
      shots.push(shot)

      if (!opts.quiet) {
        const flag = shot.ok ? '✓' : '✗'
        console.log(
          `  ${flag} ${name.padEnd(15)} ${String(bytes).padStart(8)} B  sha256=${shot.sha256.slice(0, 16)}…  ` +
            `颜色 ${String(stats.colors).padStart(4)}  边缘 ${(stats.edgeRatio * 100).toFixed(2)}%`,
        )
        for (const p of problems) console.log(`      ⚠ ${p}`)
      }
    }
  } finally {
    await page.close()
    chrome.kill()
  }

  return shots
}

/** 把一轮抓图结果组装成 manifest（**基线判据本身**，需要提交到仓库） */
export function buildManifest(opts, shots) {
  return {
    spec: 'J0.4 最小截图回归',
    note: '同一机位 + 同一种子 + 定格 120 帧 ⇒ PNG 逐字节相同。sha256 是判据，PNG 是证据。',
    // `J1.5`：首页可能是 `dist/index.html` 产物，也可能是零构建的 `/index.html`
    url: `${opts.url}${opts.homePath || '/index.html'}`,
    homePath: opts.homePath || '/index.html',
    query: `?deterministic=1&frames=${opts.frames}&frameStep=${opts.frameStep}&${BARE_PARAM}[&cam=<机位的 cam>][&house=full|cutaway]`,
    viewport: opts.viewport,
    frames: opts.frames,
    frameStep: opts.frameStep,
    seed: shots[0]?.seed ?? null,
    sceneDigest: shots[0]?.sceneDigest ?? null,
    poses: shots.map((s) => ({
      name: s.name,
      label: s.label,
      note: s.note,
      cam: s.cam,
      house: s.house,
      file: s.file,
      bytes: s.bytes,
      sha256: s.sha256,
      size: s.size,
      stats: s.stats,
      clock: s.clock,
      seed: s.seed,
      sceneDigest: s.sceneDigest,
    })),
  }
}

// ── CLI ─────────────────────────────────────────────────────────────────────
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) {
  const opts = parseArgs(process.argv.slice(2))
  const outDir = opts.out || (opts.update ? BASELINE_DIR : SHOTS_DIR)

  console.log('')
  console.log('  J0.4 · 最小截图回归 —— 抓图')
  console.log('  ──────────────────────────────────────────')
  console.log(`  服务      ${opts.url}`)
  console.log(`  视口      ${opts.viewport.width}×${opts.viewport.height}`)
  console.log(`  定格      ${opts.frames} 帧（步长 ${opts.frameStep.toFixed(7)}s）`)
  console.log(`  机位      ${opts.poses.join(' / ')}`)
  console.log(`  轮次      ${opts.rounds}`)
  console.log(`  输出      ${path.relative(ROOT, outDir).replace(/\\/g, '/')}`)
  console.log('  ──────────────────────────────────────────')

  const homePath = await checkServer(opts.url)
  console.log(`  首页      ${opts.url}${homePath}`)
  console.log(`  形态      ${homePath === '/' ? 'dist 产物（含 ?bare=1 纯 3D）' : '零构建（index.html）'}`)
  fs.mkdirSync(outDir, { recursive: true })

  const rounds = []
  for (let r = 1; r <= opts.rounds; r++) {
    if (opts.rounds > 1) console.log(`\n  第 ${r} 轮`)
    // 多轮时每轮各写一个子目录，避免后一轮覆盖前一轮的文件（轮间比对要用它们定位差异）
    const roundDir = opts.rounds > 1 ? path.join(outDir, `round${r}`) : outDir
    const shots = await capturePoses({ ...opts, homePath, outDir: roundDir })
    rounds.push(shots)
    if (shots.some((s) => !s.ok)) {
      console.error('\n✗ 存在无效截图（见上方 ⚠）—— 拒绝写入基线\n')
      process.exit(3)
    }
  }

  const shots = rounds[0]
  const manifest = buildManifest({ ...opts, homePath }, shots)

  // ── 轮间比对：DoD「连续 3 次截图回归零差异」 ──
  let unstable = 0
  if (rounds.length > 1) {
    console.log('\n  轮间比对（判据：sha256 完全相同）')
    for (let i = 0; i < shots.length; i++) {
      const hashes = rounds.map((rr) => rr[i].sha256)
      const same = hashes.every((h) => h === hashes[0])
      if (!same) unstable++
      console.log(`  ${same ? '✓' : '✗'} ${shots[i].name.padEnd(15)} ${same ? '零差异' : hashes.map((h) => h.slice(0, 12)).join(' / ')}`)
      if (!same) {
        // 差异定位：量化到像素，给出差异比例与范围（"哪里不同"比"不同"有用得多）
        const a = readPng(path.join(outDir, 'round1', `${shots[i].name}.png`))
        for (let r = 2; r <= rounds.length; r++) {
          const b = readPng(path.join(outDir, `round${r}`, `${shots[i].name}.png`))
          const d = diffPng(a, b)
          console.log(
            `      vs 第 ${r} 轮：${(d.ratio * 100).toFixed(4)}% 像素不同（${d.diff}/${d.total}）` +
              (d.bbox ? `，区域 x${d.bbox.x1}–${d.bbox.x2} y${d.bbox.y1}–${d.bbox.y2}` : ''),
          )
        }
      }
    }
  }

  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8')
  console.log(`\n  manifest  ${path.relative(ROOT, path.join(outDir, 'manifest.json')).replace(/\\/g, '/')}`)
  console.log(
    opts.update
      ? '  ✓ 基线已更新 —— ⚠ 请人工审查画面（每张 PNG）后再提交，不要盲目接受差异。\n'
      : `  ✓ 抓图完成（${shots.length} 张）—— 与基线比对请运行 node tests/visual/compare.mjs\n`,
  )
  process.exit(rounds.length > 1 && unstable ? 1 : 0)
}
