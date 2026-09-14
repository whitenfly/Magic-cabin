/**
 * J0.4 · 最小截图回归 —— 与基线比对
 * ============================================================================
 * 迁移/改动之后跑这个：**抓一轮图，与 `baseline/manifest.json` 里的 sha256 对**。
 *
 * ```bash
 * pnpm serve
 * node tests/visual/compare.mjs                    # 严格模式：任何机位有差异即失败
 * node tests/visual/compare.mjs --mode=additive    # 新增式改动：允许恰好 1 个机位有差异（仍需人工审查）
 * ```
 *
 * ## 为什么判据分两种（来自 `tests/visual/README.md`）
 *
 * - **搬迁式改动**（把 `legacy/` 里的物件模块化）→ 画面**必须一模一样**，任何差异都是 bug；
 * - **新增式改动**（往场景里加原本没有的东西）→ 必然改变画面，但**只应影响一个机位**，
 *   且必须人工看过画面后才能更新基线。
 *
 * 判据取自 `docs/BuildPlaning/02-架构与目录调整.md` 与 `docs/MIGRATION.md` §7：
 * 搬迁期"零优化、零画面变化"是硬规矩。
 *
 * ⚠️ 差异比例由**逐像素解码**得出，不是"文件大小不同"这种近似判断；
 *    同时附上差异区域（bbox），因为"哪一块变了"比"变了"有用得多。
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

import { readPng, diffPng, analyzeImage } from './png.mjs'
import { capturePoses, DEFAULTS } from './capture.mjs'
import { resolveHomePath } from '../e2e/page.mjs' // J1.5：首页解析（dist 产物 与 零构建 两种形态）

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')
const BASELINE_DIR = path.join(HERE, 'baseline')
const SHOTS_DIR = path.join(ROOT, '_shots/visual')

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex')

function parseArgs(argv) {
  const arg = (name, def) => {
    const hit = argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`))
    if (!hit) return def
    const eq = hit.indexOf('=')
    return eq === -1 ? true : hit.slice(eq + 1)
  }
  const [vw, vh] = String(arg('viewport', '')).split('x').map(Number)
  return {
    url: String(arg('url', process.env.CABIN_URL || 'http://127.0.0.1:5173')).replace(/\/$/, ''),
    mode: String(arg('mode', 'strict')),
    baseline: String(arg('baseline', BASELINE_DIR)),
    out: String(arg('out', SHOTS_DIR)),
    viewport: Number.isFinite(vw) && Number.isFinite(vh) ? { width: vw, height: vh } : null,
    frames: arg('frames', null) ? Number(arg('frames')) : null,
  }
}

const opts = parseArgs(process.argv.slice(2))
const manifestFile = path.join(opts.baseline, 'manifest.json')

console.log('')
console.log('  J0.4 · 最小截图回归 —— 与基线比对')
console.log('  ──────────────────────────────────────────')

if (!fs.existsSync(manifestFile)) {
  console.error(`  ✗ 找不到基线：${path.relative(ROOT, manifestFile).replace(/\\/g, '/')}`)
  console.error('    先建立基线：node tests/visual/capture.mjs --update')
  console.error('')
  process.exit(2)
}
const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'))

// 观测条件以**基线**为准（否则拿不同视口/帧数的图去比对，差异毫无意义）
const viewport = opts.viewport || manifest.viewport || DEFAULTS.viewport
const frames = opts.frames || manifest.frames || DEFAULTS.frames
const frameStep = manifest.frameStep || DEFAULTS.frameStep
const poses = manifest.poses.map((p) => p.name)

if (opts.viewport && (viewport.width !== manifest.viewport.width || viewport.height !== manifest.viewport.height)) {
  console.log(`  ⚠ 视口与基线不一致（基线 ${manifest.viewport.width}×${manifest.viewport.height}）—— 差异不可比`)
}
if (opts.frames && frames !== manifest.frames) {
  console.log(`  ⚠ 定格帧数与基线不一致（基线 ${manifest.frames}）—— 差异不可比`)
}

console.log(`  基线      ${path.relative(ROOT, manifestFile).replace(/\\/g, '/')}`)
console.log(`  种子      ${manifest.seed ?? '(未记录)'}`)
console.log(`  视口      ${viewport.width}×${viewport.height}    定格 ${frames} 帧`)
console.log(`  机位      ${poses.join(' / ')}`)
console.log(`  模式      ${opts.mode === 'additive' ? '新增式（允许恰好 1 个机位有差异）' : '严格（任何差异即失败）'}`)
console.log('  ──────────────────────────────────────────')

// 服务健康检查（与 capture 相同：截到错误页会伪装成"一致"）
// `J1.5`：首页由 `tests/e2e/page.mjs` 解析 —— dist 产物是 `/`，零构建是 `/index.html`
const homePath = await resolveHomePath(opts.url, {
  onError: (why) => {
    console.error(`  ✗ 无法访问 ${opts.url} 或返回内容不是本项目页面 —— ${why}`)
    console.error('    请先启动服务：pnpm serve（产物）或 pnpm serve:legacy（零构建）\n')
  },
})
if (!homePath) process.exit(2)

fs.mkdirSync(opts.out, { recursive: true })
const shots = await capturePoses({
  url: opts.url,
  homePath,
  viewport,
  frames,
  frameStep,
  poses,
  outDir: opts.out,
  quiet: true,
})

console.log('')
let changed = []
let invalid = []
let same = 0

for (const shot of shots) {
  const base = manifest.poses.find((p) => p.name === shot.name)
  const baseFile = path.join(opts.baseline, base.file)
  if (!base || !fs.existsSync(baseFile)) {
    console.log(`  ⚠ ${shot.name.padEnd(15)} 基线缺失（${base ? base.file : '未登记'}）`)
    invalid.push(shot.name)
    continue
  }

  // ① 哈希判据（主判据）
  const hashSame = base.sha256 === shot.sha256

  // ② 像素判据（定位：哪一块、差多少）
  const a = readPng(baseFile)
  const b = readPng(path.join(opts.out, shot.file))
  const d = diffPng(a, b)
  const stats = analyzeImage(b)

  if (!shot.ok) invalid.push(shot.name)

  if (hashSame) {
    same++
    console.log(`  ✓ ${shot.name.padEnd(15)} sha256 相同（${shot.bytes} B）`)
  } else {
    changed.push({ name: shot.name, diff: d, shot, base })
    console.log(
      `  ✗ ${shot.name.padEnd(15)} sha256 不同\n` +
        `      像素差异 ${(d.ratio * 100).toFixed(4)}%（${d.diff}/${d.total}）  最大通道差 ${d.maxDelta}\n` +
        (d.bbox ? `      差异区域 x${d.bbox.x1}–${d.bbox.x2} y${d.bbox.y1}–${d.bbox.y2}（${d.bbox.w}×${d.bbox.h}）\n` : '') +
        `      字节 ${base.bytes} → ${shot.bytes}    画面 颜色 ${stats.colors} / 边缘 ${(stats.edgeRatio * 100).toFixed(2)}%`,
    )
    if (!shot.ok) for (const p of shot.problems) console.log(`      ⚠ ${p}`)
  }
}

console.log('')
console.log(`  结果：${same} 个机位零差异 / ${changed.length} 个有差异 / ${invalid.length} 个无效截图`)
console.log('')

// ── 判定 ──
let code = 0
if (invalid.length) {
  console.error('  ✗ 存在无效截图 —— 结果不可信，先修页面（见上方 ⚠）\n')
  code = 3
} else if (changed.length === 0) {
  console.log('  ✓ 全部机位与基线逐字节相同 —— 改动没有改变画面\n')
} else if (opts.mode === 'additive' && changed.length === 1) {
  console.log('  ⚠ 新增式改动：恰好 1 个机位有差异（符合预期）—— 必须人工审查该图后再更新基线：')
  console.log(`      ${changed[0].name}.png`)
  console.log('      审查通过后运行：node tests/visual/capture.mjs --update\n')
  code = 0
} else {
  console.error(
    opts.mode === 'additive' && changed.length > 1
      ? `  ✗ 新增式改动只允许 1 个机位有差异，实际 ${changed.length} 个 —— 说明改动波及了不该动的区域\n`
      : '  ✗ 画面与基线不一致 —— 搬迁期"零画面变化"是硬规矩，请先修改动本身\n',
  )
  code = 1
}

fs.writeFileSync(
  path.join(opts.out, 'compare.json'),
  JSON.stringify(
    {
      baseline: path.relative(ROOT, manifestFile).replace(/\\/g, '/'),
      mode: opts.mode,
      viewport,
      frames,
      same,
      changed: changed.map((c) => ({
        name: c.name,
        ratio: c.diff.ratio,
        diffPixels: c.diff.diff,
        maxDelta: c.diff.maxDelta,
        bbox: c.diff.bbox,
        sha256: { baseline: c.base.sha256, current: c.shot.sha256 },
      })),
      invalid,
      ok: code === 0,
    },
    null,
    2,
  ) + '\n',
  'utf8',
)
console.log(`  明细  ${path.relative(ROOT, path.join(opts.out, 'compare.json')).replace(/\\/g, '/')}\n`)
process.exit(code)
