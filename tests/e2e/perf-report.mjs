/**
 * 性能基线报告的渲染器（`J4.12`）
 * ============================================================================
 * 从 `tests/e2e/perf.mjs` 抽出的**纯函数**模块。
 *
 * ## 为什么要抽出来
 *
 * `perf.mjs` 顶层带副作用（起浏览器 → 采集 → 写盘），**不能被单元测试 import**。
 * 于是"报告怎么生成"这件事长期没有判据守护 —— 坏掉也没人会知道。
 *
 * ## 它修的是什么（`J4.12` 的起因）
 *
 * `docs/实施结果/` 集中化那次重构（`840c1db`）用一次性脚本批量改引用，规则是
 * 「相对路径按**引用方所在目录**重算」。`tests/e2e/perf.mjs` 也被当成了引用方，
 * 于是模板前缀被算成 `../../docs/实施结果/` —— 这对 perf.mjs **自身**成立，
 * 但那段是**生成 `docs/*.md` 的模板文本**：从生成物出发会解析到
 * `FrontProj/docs/实施结果/`，**不存在**。
 *
 * `docs/baseline.md` 只是恰好在重构之后没被重写过，才侥幸保留着正确前缀；
 * 而**任何人跑一次 `pnpm baseline:perf`（`--update`）都会把它覆盖成坏链接**。
 * `docs/baseline.gpu.md` 就是这么坏掉的（`J4.12` 的现场）。
 *
 * ## 修法与它的判据
 *
 * 前缀一律由 `linkPrefix()` **按生成物所在目录**算出，与脚本/本模块自身位置彻底解耦；
 * `tests/unit/perf-report.test.mjs` 断言"产出的每一个相对链接都能解析到真实文件"。
 *
 * > 这一点和 `VERSIONING.md` §8.6 是同一个思路：**缺陷要么被机械守住，要么会复发**。
 * > 本仓库上一次（P8）栽在 BOM 上，这次栽在相对路径上 —— 都是"跑起来是绿的"那类。
 */
import path from 'node:path'

/**
 * 由「生成物在仓库内的相对路径」算出指向 `targetRel` 的链接前缀。
 *
 * 判据（用真实位置举例）：
 *
 * ```js
 * linkPrefix('docs/baseline.md', 'docs/实施结果')          // './实施结果'
 * linkPrefix('docs/baseline.gpu.md', 'tests/e2e/baseline') // '../tests/e2e/baseline'
 * linkPrefix('tests/e2e/x.md', 'docs/实施结果')            // '../../docs/实施结果'  ← 对 perf.mjs 自身成立
 * ```
 *
 * ★ 第三个例子就是事故的形态：那个前缀**没错，只是用错了位置**。
 *   所以基准必须是**生成物**（第一个参数）的目录，而不是模块或脚本的目录。
 *
 * 两个参数都必须是**仓库相对**的 POSIX 路径 —— 这样本模块与仓库根的实际位置无关，
 * 也能在不碰文件系统的前提下被单元测试直接断言。
 *
 * @param {string} mdRel     生成物在仓库内的相对路径，如 `'docs/baseline.gpu.md'`
 * @param {string} targetRel 目标目录在仓库内的相对路径，如 `'docs/实施结果'`
 * @returns {string} 链接前缀（`./x` 或 `../x` 形态）
 */
export function linkPrefix(mdRel, targetRel) {
  const from = path.posix.dirname(String(mdRel).replace(/\\/g, '/'))
  const rel = path.posix.relative(from, String(targetRel).replace(/\\/g, '/'))
  if (rel === '') return '.'
  return rel.startsWith('.') ? rel : `./${rel}`
}

/** 报告里对"渲染后端"的一句话判定（防止把回落的 SwiftShader 当成 GPU 数据） */
export function backendVerdict(env) {
  const r = String(env.renderer || '')
  if (/SwiftShader|llvmpipe|Software/i.test(r)) return '软件渲染（SwiftShader）'
  if (/ANGLE|D3D11|Direct3D|Metal|OpenGL|NVIDIA|AMD|Intel/i.test(r)) return '硬件加速'
  return '未知'
}

/**
 * 生成人类可读的基线报告（`ArtLine-Part/04` 指定的产出）。
 *
 * @param {object} b `summarize()` 的产物（基线数据；本函数只读不写）
 * @param {object} opts
 * @param {string} opts.mdRel           本报告在仓库内的相对路径，如 `'docs/baseline.gpu.md'`
 *                                      —— ★ 文内链接前缀由它算出（见 `linkPrefix`）
 * @param {string} opts.dataFile        机器可读基线的文件名，如 `'perf.gpu.json'`
 * @param {number} opts.warmupMs        预热时长（写进 §4 采集口径表）
 * @param {number} opts.fpsSampleMs     FPS 采样窗口（同上）
 * @param {Set<string>} opts.referenceOnly "参考项"集合（噪声大、不作判据的指标）
 * @returns {string} markdown 全文
 */
export function renderMarkdown(b, opts) {
  const { mdRel, dataFile, warmupMs, fpsSampleMs } = opts
  const refOnly = opts.referenceOnly instanceof Set ? opts.referenceOnly : new Set(opts.referenceOnly || [])

  // ★ 链接前缀一律按**生成物所在目录**算（J4.12）—— 不要写死 `../../docs/…`：
  //   那样的写法对 perf.mjs 自身是对的，对生成物是死链（见文件头的事故说明）。
  const refPrefix = linkPrefix(mdRel, 'docs/实施结果')
  const dataPrefix = linkPrefix(mdRel, 'tests/e2e/baseline')

  const m = b.metrics
  const r = b.render
  const thresholds = Object.entries(b.thresholds)
    .map(
      ([k, v]) =>
        `| \`${k}\` | ${(v * 100).toFixed(0)}% | ${k === 'fps' ? '下降' : '上升'} | ${
          refOnly.has(k) ? '⚠️ 参考项（噪声大）' : '**判据**'
        } |`,
    )
    .join('\n')
  const backendNote =
    b.profile === 'gpu'
      ? '真实 GPU（不加任何 GPU 开关，让 Chrome 自选）'
      : 'SwiftShader 软件渲染（`--disable-gpu --use-angle=swiftshader`）'

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
| 预热 | ${warmupMs / 1000} s | 让着色器编译、首批纹理生成、天气/光照过渡完成 |
| FPS 采样窗口 | ${fpsSampleMs / 1000} s | 太短会被单帧抖动支配 |
| 轮次 | **1 轮冷启动（不计入统计）+ ${b.rounds} 轮稳态**，稳态取**中位数** | 冷启动与稳态不是同一件事，混在一起两头失真（见 §1.5） |
| 轮间隔 | 1 s | 让上一轮的收尾（GC / 上传）落定 |
| 时钟模式 | **realtime**（\`?deterministic=1\`，不带 \`frames\`） | manual 模式不跑 rAF，量不到 FPS |
| 统计钩子 | \`?stats=1\` | \`renderer.info\` 在 IIFE 内，需要钩子才能读到 |
| 渲染后端 | ${backendNote} | 决定 FPS / 首屏时间能否横向比 |

---

## 5. 原始数据

- 机器可读：[\`${dataPrefix}/${dataFile}\`](${dataPrefix}/${dataFile})
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

详见 [\`F0.4-实施结果.md\`](${refPrefix}/F0.4-实施结果.md) / [\`F0.5-实施结果.md\`](${refPrefix}/F0.5-实施结果.md) / [\`F0.6-实施结果.md\`](${refPrefix}/F0.6-实施结果.md)。
`
}
