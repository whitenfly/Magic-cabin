/**
 * J0.6 · 性能基线
 * ============================================================================
 * 留一份"改造前的性能体检报告"，用来判定后续 `J2`–`J4` 的模块化
 * **有没有引入性能回归**（`J8` 才做优化，所以退化必须先能被识别出来）。
 *
 * 采集三项（`ArtLine-Part/04` 的 `P0.6`）：
 *
 * | 指标 | 来源 | 可比性 |
 * |---|---|---|
 * | **首屏时间** | `html[data-cabin-ready-ms]`（导航开始 → 3D 就绪） | 同环境前后对比 |
 * | **稳态 FPS** | 页面内 rAF 计数（realtime 模式） | ⚠️ **仅同环境**（软件渲染下没有跨设备意义） |
 * | **渲染统计** | `window.__cabinRenderStats()` → three 的 `renderer.info` | ✅ **跨设备可比**，是回归判定的主依据 |
 *
 * ## 为什么主判据是 `renderer.info` 而不是 FPS
 *
 * `calls`（draw call 数）/ `triangles` / `geometries` / `textures` 只取决于**场景构成**，
 * 与 GPU 或软件渲染无关。而 FPS 受运行环境支配 ——
 * **它能说明"同一台机器上变快了还是变慢了"，不能说明"性能好不好"**。
 * 所以本基线把渲染统计当硬指标，FPS 只作参考。
 *
 * ## 两种采集环境（profile）—— GPU 那条是**纯增量**
 *
 * | profile | 怎么跑 | 渲染后端 | 产物 |
 * |---|---|---|---|
 * | `swiftshader`（默认） | `pnpm baseline:perf` | 软件渲染 | `baseline/perf.json` + `docs/baseline.md` |
 * | `gpu`（增量） | `node tests/e2e/perf.mjs --gpu --rounds=5 --update` | 真实 GPU | `baseline/perf.gpu.json` + `docs/baseline.gpu.md` |
 *
 * **默认 profile 的文件名、路径与行为与最初方案完全一致** —— GPU 采集只新增文件，
 * 不覆盖、不改写任何既有产物，因此不影响既有的回归判据与校验脚本。
 *
 * ## 用法
 *
 * ```bash
 * pnpm serve                     # 另开一个终端
 * pnpm baseline:perf             # 采集并写入基线（5 轮）
 * pnpm test:perf                 # 与基线比对，超过阈值即报警（非零退出码）
 * node tests/e2e/perf.mjs --rounds=5          # 只采集不落盘（试采）
 * node tests/e2e/perf.mjs --gpu --update      # 真实 GPU 采集（增量产物）
 * ```
 *
 * ⚠️ 与 J0.4 / J0.5 同一限制：需要真实浏览器（受限沙箱禁止命名管道时 Chrome 起不来）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { findBrowser, launch, connect, sleep } from './cdp.mjs'
import { resolveHomePath } from './page.mjs' // J1.5：首页解析（dist 产物 与 零构建 两种形态）

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')
const BASELINE_DIR = path.join(HERE, 'baseline')

/** profile → 产物文件名。默认 profile 保持原方案的文件名与行为不变；GPU 是纯增量。 */
const PROFILE_FILES = { swiftshader: 'perf.json', gpu: 'perf.gpu.json' }
const PROFILE_MD = { swiftshader: 'docs/baseline.md', gpu: 'docs/baseline.gpu.md' }
const PROFILE_LABELS = { swiftshader: '沙箱 / 软件渲染（SwiftShader）', gpu: '本机 / 真实 GPU' }
const baselineJson = (profile) => path.join(BASELINE_DIR, PROFILE_FILES[profile] || `perf.${profile}.json`)
const baselineMd = (profile) => path.join(ROOT, PROFILE_MD[profile] || `docs/baseline.${profile}.md`)

const VIEWPORT = { width: 1440, height: 900 }
const FPS_SAMPLE_MS = 5000
const WARMUP_MS = 3000

/**
 * 回归判定阈值（`--compare` 用）。
 *
 * **分两档，因为两类指标的噪声量级差一个数量级**（实测）：
 *
 * · 渲染统计（`calls` / `triangles` / `geometries` / `textures` / `sceneObjects`）
 *   只取决于场景构成 —— 同一份代码连测多轮**完全一致**（+0.0%），所以 10% 是宽松但有效的门。
 * · 首屏时间与 FPS 受运行环境支配 —— 同一份代码实测批次间波动可达 ±15%
 *   （首屏单轮甚至 693–1390ms）。阈值必须放宽，否则会天天误报。**它们只是参考，不是判据。**
 */
const THRESHOLDS = {
  calls: 0.1, // draw call 数
  triangles: 0.1, // 三角面数
  geometries: 0.1, // 几何体数
  textures: 0.1, // 贴图数
  sceneObjects: 0.1, // 场景对象数
  readyMs: 0.3, // 首屏时间 —— 环境噪声大（放宽）
  fps: 0.25, // 稳态 FPS —— 环境噪声大（放宽），且仅同环境有意义
}

/** 哪些指标是"参考项"（噪声大，不作为回归判据）—— 报告里要标出来 */
const REFERENCE_ONLY = new Set(['readyMs', 'fps'])

// ── 参数 ────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2)
const has = (n) => argv.includes(`--${n}`)
const val = (n, d) => {
  const hit = argv.find((a) => a.startsWith(`--${n}=`))
  return hit ? hit.slice(n.length + 3) : d
}
const OPTS = {
  url: String(val('url', process.env.CABIN_URL || 'http://127.0.0.1:5173')).replace(/\/$/, ''),
  rounds: Math.max(1, Number(val('rounds', 3)) || 3),
  update: has('update') || has('baseline'),
  compare: has('compare'),
  /** 真实 GPU 采集（去掉 SwiftShader 相关开关，让 Chrome 自己挑后端） */
  gpu: has('gpu'),
}
OPTS.profile = OPTS.gpu ? 'gpu' : 'swiftshader'
OPTS.baselineJson = baselineJson(OPTS.profile)

const median = (arr) => {
  const s = [...arr].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2)
}
const min = (arr) => Math.min(...arr)
const max = (arr) => Math.max(...arr)

/** 轮间相对波动（极差 / 中位数）—— 用来判断这轮采集有没有被并发负载污染 */
const spread = (arr) => {
  const m = median(arr)
  return m > 0 ? (max(arr) - min(arr)) / m : 0
}

/**
 * 采集质量自检。
 *
 * **为什么需要它**：采集期间如果机器上还有别的程序在抢 GPU / CPU
 * （浏览器、游戏、编译、视频会议…），FPS 与首屏时间会被拉低且轮间抖动，
 * 那份基线看起来"能跑"但其实是错的 —— 比没有基线更危险。
 *
 * 渲染统计不受影响（只取决于场景构成），所以即使判为"不稳"，
 * 那份基线里的 `calls` / `triangles` 依然可信；受影响的是 FPS 与首屏时间这两个参考项。
 */
function assessQuality(rounds) {
  const fpsSpread = spread(rounds.map((r) => r.fps))
  const readySpread = spread(rounds.map((r) => r.readyMs))
  const problems = []
  if (fpsSpread > 0.3) problems.push(`FPS 轮间波动 ${(fpsSpread * 100).toFixed(0)}%`)
  if (readySpread > 0.5) problems.push(`首屏时间轮间波动 ${(readySpread * 100).toFixed(0)}%`)

  // 逐轮趋势：持续满载渲染会让笔记本降频，表现为 FPS 单调下滑 —— 那是"热"的效应，不是代码问题
  const first = rounds[0].fps
  const last = rounds[rounds.length - 1].fps
  const fpsTrend = rounds.length >= 3 && first > 0 ? (last - first) / first : 0
  if (fpsTrend < -0.1) {
    problems.push(`FPS 逐轮下降 ${Math.abs(fpsTrend * 100).toFixed(0)}%（持续负载下的降频，属环境效应）`)
  }

  return {
    fpsSpread: Number(fpsSpread.toFixed(3)),
    readySpread: Number(readySpread.toFixed(3)),
    fpsTrend: Number(fpsTrend.toFixed(3)),
    stable: problems.length === 0,
    note: problems.length
      ? `${problems.join('、')} —— 采集期间可能有其它程序占用 GPU / CPU，参考项（FPS / 首屏）不可信，建议关闭后重跑`
      : '轮间波动与趋势均在正常范围',
  }
}

/** 报告里对"渲染后端"的一句话判定（防止把回落的 SwiftShader 当成 GPU 数据） */
function backendVerdict(env) {
  const r = String(env.renderer || '')
  if (/SwiftShader|llvmpipe|Software/i.test(r)) return '软件渲染（SwiftShader）'
  if (/ANGLE|D3D11|Direct3D|Metal|OpenGL|NVIDIA|AMD|Intel/i.test(r)) return '硬件加速'
  return '未知'
}

/** 采集一轮：重新加载页面 → 读首屏耗时 → 预热 → 采样 FPS → 读渲染统计 */
async function collectOnce(page, label) {
  // `bare=1`（J1.5）：Astro 版首页在构建期就渲染出**门厅**（标题 + 最新文章列表），
  // 它在 3D 就绪后自行退场。性能采集要的是**纯 3D 起点**，所以让门厅整块不渲染。
  // 零构建路径（index.html）不认识这个参数，多一个 URL 参数对它无害 ⇒ 两个形态共用同一条命令。
  await page.navigate(`${OPTS.url}${HOME}?deterministic=1&stats=1&bare=1&run=${Date.now()}`)
  await page.waitFor('document.documentElement.dataset.cabin === "ready"', { timeout: 120000 })

  const boot = await page.eval(`(() => {
    const d = document.documentElement.dataset
    return { readyMs: Number(d.cabinReadyMs), bootMs: Number(d.cabinBootMs), stats: typeof window.__cabinRenderStats }
  })()`)
  if (boot.stats !== 'function') throw new Error('缺少 __cabinRenderStats（URL 必须带 ?stats=1）')

  await sleep(WARMUP_MS) // 预热：着色器编译 / 首批纹理生成 / 天气与光照过渡

  const fps = await page.eval(
    `new Promise(resolve => {
      const dur = ${FPS_SAMPLE_MS}; let n = 0; const t0 = performance.now()
      function tick() {
        n++
        const el = performance.now() - t0
        if (el < dur) requestAnimationFrame(tick)
        else resolve({ frames: n, ms: Math.round(el), fps: Number((n / (el / 1000)).toFixed(2)) })
      }
      requestAnimationFrame(tick)
    })`,
    { awaitPromise: true, timeoutMs: 120000 },
  )

  const stats = await page.eval('window.__cabinRenderStats()')
  const errs = page.errors()
  process.stdout.write(
    `    第 ${label} 轮  首屏 ${boot.readyMs}ms  FPS ${fps.fps}  calls ${stats.calls}  tris ${stats.triangles}\n`,
  )
  return { readyMs: boot.readyMs, bootMs: boot.bootMs, fps: fps.fps, frames: fps.frames, stats, errors: errs.length }
}

/** 把多轮结果归并成一份基线（`cold` 是单独跑的冷启动轮，不计入稳态统计） */
function summarize(rounds, cold, env) {
  const pick = (f) => rounds.map(f)
  const statsKeys = Object.keys(rounds[0].stats)
  const stats = {}
  for (const k of statsKeys) stats[k] = median(rounds.map((r) => r.stats[k]))

  return {
    spec: 'J0.6 性能基线',
    profile: OPTS.profile,
    profileLabel: PROFILE_LABELS[OPTS.profile] || OPTS.profile,
    generatedAt: new Date().toISOString(),
    url: `${OPTS.url}${HOME}?deterministic=1&stats=1&bare=1`,
    viewport: VIEWPORT,
    rounds: rounds.length,
    env,
    metrics: {
      // 稳态（热）：计入统计的那些轮次
      readyMs: { median: median(pick((r) => r.readyMs)), min: min(pick((r) => r.readyMs)), max: max(pick((r) => r.readyMs)) },
      bootMs: { median: median(pick((r) => r.bootMs)), min: min(pick((r) => r.bootMs)), max: max(pick((r) => r.bootMs)) },
      fps: { median: median(pick((r) => r.fps)), min: min(pick((r) => r.fps)), max: max(pick((r) => r.fps)) },
      // 冷启动（首访）：单独一轮 —— 它代表"用户第一次打开页面"的真实体验，
      // 与稳态不可混在一起统计（见报告 §1.5 的说明）
      cold: {
        readyMs: cold.readyMs,
        bootMs: cold.bootMs,
        fps: cold.fps,
        calls: cold.stats.calls,
        triangles: cold.stats.triangles,
      },
    },
    render: stats,
    thresholds: THRESHOLDS,
    quality: assessQuality(rounds),
    samples: rounds.map((r) => ({
      readyMs: r.readyMs,
      bootMs: r.bootMs,
      fps: r.fps,
      calls: r.stats.calls,
      triangles: r.stats.triangles,
    })),
  }
}

/** 生成人类可读的基线报告（`ArtLine-Part/04` 指定的产出） */
function renderMarkdown(b) {
  const m = b.metrics
  const r = b.render
  const thresholds = Object.entries(b.thresholds)
    .map(
      ([k, v]) =>
        `| \`${k}\` | ${(v * 100).toFixed(0)}% | ${k === 'fps' ? '下降' : '上升'} | ${
          REFERENCE_ONLY.has(k) ? '⚠️ 参考项（噪声大）' : '**判据**'
        } |`,
    )
    .join('\n')
  const backendNote =
    b.profile === 'gpu'
      ? '真实 GPU（不加任何 GPU 开关，让 Chrome 自选）'
      : 'SwiftShader 软件渲染（`--disable-gpu --use-angle=swiftshader`）'
  const dataFile = PROFILE_FILES[b.profile] || `perf.${b.profile}.json`

  return `# 性能基线（J0.6 / F0.6）

> **本文件由 \`node tests/e2e/perf.mjs --update\` 生成** —— 不要手改数值；
> 需要更新基线时重跑脚本，并**人工确认差异来源**后再提交。
>
> 采集时间：${b.generatedAt} ｜ 环境：**${b.profileLabel || b.profile}** ｜ 轮次：${b.rounds}（取中位数）

---

## 0. 一句话

**主判据是渲染统计（\`calls\` / \`triangles\` / \`geometries\` / \`textures\`），不是 FPS。**

它们只取决于**场景构成**，与 GPU 或软件渲染无关；而 FPS 由运行环境支配 ——
它只能说明"同一台机器上变快了还是变慢了"，不能说明"性能好不好"。

---

## 1. 结论摘要

| 指标 | 值（中位数） | 区间 | 可比性 |
|---|---|---|---|
| 首屏时间（**稳态 / 热**） | **${m.readyMs.median} ms** | ${m.readyMs.min}–${m.readyMs.max} ms | 同环境前后对比 |
| 首屏时间（**冷启动 / 首访**） | ${m.cold?.readyMs ?? '(未采集)'} ms | 单次采样 | 同环境前后对比 |
| boot 逻辑耗时（热） | ${m.bootMs.median} ms | ${m.bootMs.min}–${m.bootMs.max} ms | 同环境前后对比 |
| 稳态 FPS | ${m.fps.median} | ${m.fps.min}–${m.fps.max} | ⚠️ **仅同环境** |
| 冷启动 FPS（参考） | ${m.cold?.fps ?? '(未采集)'} | 单次采样 | ⚠️ 仅同环境 |
| **draw calls** | **${r.calls}** | — | ✅ 跨设备可比 |
| **triangles** | **${r.triangles}** | — | ✅ 跨设备可比 |
| geometries | ${r.geometries} | — | ✅ 跨设备可比 |
| textures | ${r.textures} | — | ✅ 跨设备可比 |
| 着色器程序数 | ${r.programs ?? '(未记录)'} | — | ✅ 跨设备可比 |
| 场景对象数 | ${r.sceneObjects}（Mesh ${r.sceneMeshes} / Line ${r.sceneLines} / Points ${r.scenePoints}） | — | ✅ 跨设备可比 |

### 1.5 为什么要把"冷启动"单独列出来

同一个浏览器进程里，**第一次加载**要额外付出：V8 编译与首次 JIT、GPU 上下文与 shader 初始化、
几何/纹理首次上传、资源首取。后续轮次共享这些缓存，所以又快又稳。

两者不是同一件事，混在一起统计会**两头失真**：

| | 代表什么 | 该怎么用 |
|---|---|---|
| **冷启动**（第 0 轮） | 用户**第一次打开**页面的真实体验 | 看首访体验；优化首屏时盯这个 |
| **稳态 / 热**（第 1…N 轮） | 页面**已经在跑**时的表现 | 看 FPS 与渲染开销；回归判定用这个 |

所以脚本会先单独跑一轮冷启动（\`第 0 轮\`），**不计入**稳态统计；
\`calls\` / \`triangles\` 与冷热无关（同一场景），两者必然相同。


---

## 2. 采集环境（**决定这些数字能不能横向比**）

| 项 | 值 |
|---|---|
| 采集 profile | \`${b.profile}\`（${b.profileLabel || ''}） |
| 渲染后端 | ${b.env.renderer} |
| **后端判定** | **${backendVerdict(b.env)}** |
| 浏览器 | ${b.env.browser} |
| 视口 / 像素比 | ${b.viewport.width}×${b.viewport.height} @ ${b.env.devicePixelRatio}x |
| 场景种子 | ${b.env.seed} |
| 页面 URL | \`${b.url}\` |

> ⚠️ FPS 与首屏时间**只在本机、本环境下有意义**：换机器、换后端后必须**重建基线**，不能拿旧数字做判定。
> 渲染统计（calls / triangles / geometries / textures）不受此影响。

---

## 2.5 采集质量

| 项 | 值 |
|---|---|
| FPS 轮间波动（极差/中位数） | ${((b.quality?.fpsSpread ?? 0) * 100).toFixed(0)}% |
| 首屏时间轮间波动 | ${((b.quality?.readySpread ?? 0) * 100).toFixed(0)}% |
| FPS 逐轮趋势（末轮 vs 首轮） | ${((b.quality?.fpsTrend ?? 0) * 100).toFixed(0)}% |
| 判定 | ${b.quality?.stable ? '✅ 稳定' : '⚠️ **不稳**'} —— ${b.quality?.note || '(未记录)'} |

> 采集期间若机器上还有别的程序在抢 GPU / CPU，FPS 与首屏时间会被拉低且轮间抖动；
> 持续满载也会让笔记本降频，表现为 FPS 逐轮下滑。
> **判据（渲染统计）不受影响** —— 它们是场景的确定性属性，与负载无关。

---

## 3. 怎么用（判定性能回归）

\`\`\`bash
pnpm serve          # 前置
pnpm test:perf      # 与本 profile 的基线比对；任一指标超过阈值即非零退出
\`\`\`

阈值（超过即报警）：

| 指标 | 阈值 | 方向 | 性质 |
|---|---|---|---|
${thresholds}

> **为什么分两档**：渲染统计只取决于场景构成 —— 同一份代码连测多轮**完全一致（+0.0%）**，
> 所以 10% 是宽松但有效的门；而首屏时间与 FPS 受运行环境支配，
> 同一份代码批次间波动实测可达 ±15%（首屏单轮甚至 693–1390 ms），阈值必须放宽，否则会天天误报。

含义：**搬迁式改动（\`J2\`–\`J4\`）不应该让 draw call 数或三角面数上升超过 10%**。
如果上升了，说明新架构引入了额外的渲染批次（例如材质/几何不再共享、光照槽位重复提交）——
这正是这份基线存在的理由。

---

## 4. 采集口径（复现时不要改这些）

| 项 | 值 | 为什么 |
|---|---|---|
| 预热 | ${WARMUP_MS / 1000} s | 让着色器编译、首批纹理生成、天气/光照过渡完成 |
| FPS 采样窗口 | ${FPS_SAMPLE_MS / 1000} s | 太短会被单帧抖动支配 |
| 轮次 | **1 轮冷启动（不计入统计）+ ${b.rounds} 轮稳态**，稳态取**中位数** | 冷启动与稳态不是同一件事，混在一起两头失真（见 §1.5） |
| 轮间隔 | 1 s | 让上一轮的收尾（GC / 上传）落定 |
| 时钟模式 | **realtime**（\`?deterministic=1\`，不带 \`frames\`） | manual 模式不跑 rAF，量不到 FPS |
| 统计钩子 | \`?stats=1\` | \`renderer.info\` 在 IIFE 内，需要钩子才能读到 |
| 渲染后端 | ${backendNote} | 决定 FPS / 首屏时间能否横向比 |

---

## 5. 原始数据

- 机器可读：[\`../tests/e2e/baseline/${dataFile}\`](../tests/e2e/baseline/${dataFile})
- 冷启动（第 0 轮，单次）：首屏 ${b.metrics.cold?.readyMs ?? '?'} ms · FPS ${b.metrics.cold?.fps ?? '?'} · calls ${b.metrics.cold?.calls ?? '?'} · triangles ${b.metrics.cold?.triangles ?? '?'}
- 稳态（第 1–${b.rounds} 轮，取中位数）：

${b.samples.map((s, i) => `- 第 ${i + 1} 轮：首屏 ${s.readyMs} ms · FPS ${s.fps} · calls ${s.calls} · triangles ${s.triangles}`).join('\n')}

---

## 6. 它和另外两条安全网的关系

| 安全网 | 命令 | 回答的问题 |
|---|---|---|
| 截图回归（\`J0.4\`） | \`pnpm test:visual\` | 画面**有没有被改坏** |
| 交互冒烟（\`J0.5\`） | \`pnpm test:smoke\` | 还能**不能玩** |
| **性能基线（\`J0.6\`）** | \`pnpm test:perf\` | 有没有**悄悄变慢** |

详见 [\`F0.4-实施结果.md\`](./F0.4-实施结果.md) / [\`F0.5-实施结果.md\`](./F0.5-实施结果.md) / [\`F0.6-实施结果.md\`](./F0.6-实施结果.md)。
`
}

// ── 比对模式 ────────────────────────────────────────────────────────────────
function compareWithBaseline(baseline, current) {
  console.log('')
  console.log(`  与基线比对（profile=${OPTS.profile}，超阈值即失败）`)
  console.log('  ──────────────────────────────────────────')
  let bad = 0
  for (const [key, limit] of Object.entries(THRESHOLDS)) {
    let base
    let now
    if (key === 'readyMs') {
      base = baseline.metrics.readyMs.median
      now = current.metrics.readyMs.median
    } else if (key === 'fps') {
      base = baseline.metrics.fps.median
      now = current.metrics.fps.median
    } else {
      base = baseline.render[key]
      now = current.render[key]
    }
    if (base === undefined || now === undefined || base === 0) continue
    const delta = (now - base) / base
    const worse = key === 'fps' ? delta < -limit : delta > limit
    if (worse) bad++
    console.log(
      `  ${worse ? '✗' : '✓'} ${key.padEnd(14)} ${String(base).padStart(8)} → ${String(now).padStart(8)}  ` +
        `${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(1)}%  （阈值 ${key === 'fps' ? '−' : '+'}${(limit * 100).toFixed(0)}%` +
        `${REFERENCE_ONLY.has(key) ? '，参考项' : ''}）`,
    )
  }
  console.log('')
  if (bad === 0) {
    console.log('  ✓ 全部指标在阈值内 —— 没有可测出的性能回归\n')
  } else {
    console.log(`  ✗ ${bad} 项超出阈值 —— 先确认是不是新架构引入的渲染批次增加（而不是环境噪声）\n`)
  }
  return bad === 0 ? 0 : 1
}

// ── 主流程 ──────────────────────────────────────────────────────────────────
console.log('')
console.log('  J0.6 · 性能基线')
console.log('  ──────────────────────────────────────────')
console.log(`  服务      ${OPTS.url}`)
console.log(`  视口      ${VIEWPORT.width}×${VIEWPORT.height}`)
console.log(`  环境      ${OPTS.profile}（${PROFILE_LABELS[OPTS.profile] || ''}）${OPTS.gpu ? ' —— 增量产物，不覆盖默认基线' : ''}`)
console.log(`  轮次      1 轮冷启动 + ${OPTS.rounds} 轮稳态（每轮：预热 ${WARMUP_MS / 1000}s + 采样 ${FPS_SAMPLE_MS / 1000}s）`)
console.log(`  模式      ${OPTS.compare ? '与基线比对' : OPTS.update ? '写入基线' : '仅采集（不落盘）'}`)
console.log('  ──────────────────────────────────────────')

if (OPTS.compare && !fs.existsSync(OPTS.baselineJson)) {
  console.error(`\n  ✗ 找不到基线：${path.relative(ROOT, OPTS.baselineJson).replace(/\\/g, '/')}`)
  console.error(`    先建立基线：${OPTS.gpu ? 'node tests/e2e/perf.mjs --gpu --update' : 'pnpm baseline:perf'}\n`)
  process.exit(2)
}

const browser = findBrowser()
if (!browser) {
  console.error('✗ 未找到 Chrome / Edge（可用 CABIN_BROWSER 指定路径）')
  process.exit(1)
}
// 健康检查：J1.5 起首页有两种合法形态（`dist/` 产物 / 零构建），由 tests/e2e/page.mjs 统一解析。
// 旧的判据是硬编码 `${OPTS.url}/index.html` + `html.includes('src/main.js')` ——
// 在 Astro 产物下必然失败，且看起来像环境问题（见 docs/J1.5-实施结果.md §8）。
const HOME = await resolveHomePath(OPTS.url, {
  onError: (why) => {
    console.error(`✗ 无法访问 ${OPTS.url} 或返回内容不是本项目页面 —— ${why}`)
    console.error('  请先启动服务：pnpm serve（产物）或 pnpm serve:legacy（零构建）\n')
  },
})
if (!HOME) process.exit(2)

const chrome = await launch({ port: 9335, width: VIEWPORT.width, height: VIEWPORT.height, gpu: OPTS.gpu })
const page = await connect(chrome.port)
await page.setViewport(VIEWPORT.width, VIEWPORT.height)

try {
  const env = await page.eval(`(() => ({
    browser: navigator.userAgent,
    devicePixelRatio: window.devicePixelRatio,
    renderer: (() => {
      try { const c = document.createElement('canvas'); const gl = c.getContext('webgl') || c.getContext('experimental-webgl')
        const dbg = gl && gl.getExtension('WEBGL_debug_renderer_info')
        return dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'unknown' } catch { return 'unknown' }
    })()
  }))()`)

  const verdict = backendVerdict(env)
  console.log('')
  console.log(`  渲染后端  ${env.renderer}`)
  console.log(`  后端判定  ${verdict}${OPTS.gpu && verdict !== '硬件加速' ? '   ⚠️ 没拿到 GPU，可能已回落到软件渲染' : ''}`)
  console.log('')

  const rounds = []
  // 先单独跑一轮**冷启动**：首次加载要付出 V8 编译、GPU 上下文与 shader 初始化、
  // 资源首取等一次性成本，与后续"热"轮次不是同一件事 —— 混在一起统计会既污染稳态值、
  // 又丢掉"用户第一次打开有多慢"这个真实信息。所以冷启动单独记录，不进稳态统计。
  console.log('    第 0 轮（冷启动，不计入稳态统计）')
  const cold = await collectOnce(page, '0(冷启动)')

  for (let i = 1; i <= OPTS.rounds; i++) {
    rounds.push(await collectOnce(page, `${i}(热)`))
    if (i < OPTS.rounds) await sleep(1000)
  }

  // 场景种子：从页面读（F0.2 的种子决定布局，也就决定了几何数量）
  const seed = await page.eval(`document.documentElement.dataset.cabinSeed`)
  const baseline = summarize(rounds, cold, { ...env, seed: String(seed) })

  const pageErrors = rounds.reduce((a, r) => a + r.errors, 0) + cold.errors
  console.log('')
  console.log(`  页面异常  ${pageErrors === 0 ? '无' : pageErrors + ' 次'}`)
  console.log(`  采集质量  ${baseline.quality.stable ? '✓ 稳定' : '⚠️ ' + baseline.quality.note}`)

  if (OPTS.compare) {
    const code = compareWithBaseline(JSON.parse(fs.readFileSync(OPTS.baselineJson, 'utf8')), baseline)
    await page.close()
    chrome.kill()
    process.exit(code)
  }

  if (OPTS.update) {
    const jsonPath = OPTS.baselineJson
    const mdPath = baselineMd(OPTS.profile)
    fs.mkdirSync(BASELINE_DIR, { recursive: true })
    fs.writeFileSync(jsonPath, JSON.stringify(baseline, null, 2) + '\n', 'utf8')
    fs.writeFileSync(mdPath, renderMarkdown(baseline), 'utf8')
    console.log('')
    console.log(`  ✓ 已写入  ${path.relative(ROOT, jsonPath).replace(/\\/g, '/')}`)
    console.log(`  ✓ 已写入  ${path.relative(ROOT, mdPath).replace(/\\/g, '/')}`)
    console.log('')
    if (OPTS.gpu) {
      console.log('  · 这是**增量**产物：默认 profile 的 perf.json 与 docs/baseline.md 未被改动。')
      console.log('  · 请核对上面的「渲染后端」：若显示 SwiftShader，说明 Chrome 回落到软件渲染了，这份不是 GPU 数据。')
      if (!baseline.quality.stable) {
        console.log('  ⚠️ 采集质量判为"不稳" —— 建议关闭其它占用 GPU / CPU 的程序后重跑，再决定是否提交这份基线。')
      }
    } else {
      console.log('  ⚠️ 提交前请确认：采集环境（浏览器 / 渲染后端）与上一次基线一致，否则数字不可比。')
    }
    console.log('')
  } else {
    console.log('')
    console.log('  （未写盘；加 --update 写入基线，或 --compare 与基线比对）')
    console.log('')
  }
} finally {
  try {
    await page.close()
  } catch {
    /* 忽略 */
  }
  chrome.kill()
}
