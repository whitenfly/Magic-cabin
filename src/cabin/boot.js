/**
 * 小屋启动入口
 *
 * 职责：等待 DOM 就绪 → 注入 UI DOM → 加载实现 → （测试模式下）驱动定格帧。
 *
 * ⚠️ 这里是**唯一**知道 `legacy/monolith.js` 存在的地方。
 * F3–F5 阶段本文件会逐步改为：
 *
 *   import { createApp } from './app/App.js'
 *   import { features } from './features/index.js'
 *   export async function bootCabin() {
 *     const app = createApp({ canvasHost: document.body, rngSeed: SEED })
 *     for (const f of features) await app.register(f)
 *     await app.start()
 *   }
 *
 * 搬迁期间不要在这里加业务逻辑——它只是一个开关 + 测试驱动器。
 *
 * ── 测试模式（F0.2 + F0.3）────────────────────────────────────────────────
 *
 *   ?deterministic=1                     F0.2：运行期随机也切为确定
 *   ?deterministic=1&frames=120          F0.3：+ 手动时钟，定格到第 120 帧
 *   ?deterministic=1&frames=120&frameStep=0.0166667
 *                                        自定义步长（默认 1/60 秒）
 *   ?seed=42                             换一个场景种子（布局整体不同、风格一致）
 *   ?cam=0,1.55,3,-1.6,1.1,-1.2          J0.4：测试机位（相机位置 → 注视点，世界坐标）
 *   ?house=full | cutaway                J0.4：小屋形态（完整外观 / 剖切；默认不干预）
 *   ?stats=1                             J0.6：暴露 `window.__cabinRenderStats()`（性能基线用；与 manual 无关）
 *
 * 定格完成后会把状态写入 DOM，供截图脚本断言：
 *   html[data-cabin="ready"]
 *   html[data-cabin-deterministic="1"]
 *   html[data-cabin-scene-digest="…"]    场景随机序列摘要
 *   html[data-cabin-clock="…"]           时钟快照（mode/now/dt/frame）
 *   html[data-cabin-cam="…"]             J0.4：生效的测试机位（未指定则无此属性）
 *   html[data-cabin-house="…"]           J0.4：生效的小屋形态（未指定则无此属性）
 *   html[data-cabin-boot-ms="…"]         J0.6：boot 逻辑耗时（毫秒）
 *   html[data-cabin-ready-ms="…"]        J0.6：导航开始 → 3D 就绪 的耗时（毫秒，即"首屏时间"）
 */
import { mountUI } from './dom.js'
import { setDeterministicRuntime, sceneDigest, SCENE_SEED } from './app/rng.js'
import { clock, STEP } from './app/clock.js'

/** 等待 DOM 就绪（原实现把脚本放在 body 末尾，依赖 DOM 已解析；模块脚本是 defer 的，通常已就绪） */
function domReady() {
  return new Promise((resolve) => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => resolve(), { once: true })
    } else {
      resolve()
    }
  })
}

/** 解析测试开关（URL 参数优先，其次全局标志） */
function readTestOptions() {
  let params = new URLSearchParams()
  try {
    params = new URLSearchParams(location.search)
  } catch {
    /* location 不可用时忽略 */
  }
  const has = (k) => params.has(k) || Boolean(typeof window !== 'undefined' && window.__CABIN_DETERMINISTIC)
  const num = (k, def) => {
    const v = params.get(k)
    const n = v === null ? NaN : Number(v)
    return Number.isFinite(n) ? n : def
  }
  return {
    deterministic: has('deterministic'),
    /** 需要定格的帧数；<=0 或未指定表示不启用手动时钟 */
    frames: params.has('frames') ? Math.max(0, Math.floor(num('frames', 0))) : 0,
    frameStep: num('frameStep', STEP),
    /** J0.4 测试机位：`cam=x,y,z,lx,ly,lz`（世界坐标的相机位置 → 注视点） */
    cam: params.get('cam') || '',
    /** J0.4 小屋形态：'full'（完整外观）| 'cutaway'（剖切）| ''（不干预，保持默认） */
    house: params.get('house') || '',
    /** J0.6 性能统计：暴露 `window.__cabinRenderStats()`（与 manual 模式无关） */
    stats: params.has('stats'),
  }
}

/** 小屋内嵌挂载点的 id（F6 阶段门厅策略启用后由宿主页面提供） */
export const CABIN_ROOT_ID = 'cabin-root'

/**
 * 手动逐帧推进（F0.3）。
 *
 * monolith 在 manual 模式下**不会**启动 rAF 自驱动循环，而是把单帧推进函数挂到
 * `window.__cabinStepFrame`。这里直接**同步**调用它 —— 避免等待 N 次真实 rAF
 * （在无头 / 软件渲染环境下每次 rAF 都很慢，30 帧就足以超出时间预算）。
 *
 * 每帧 `clock.step()` 后跑一次 `tickOnce()`；而 `tickOnce` 内部在 manual 模式下
 * 也会调用 `updateNewDecor`，所以装饰循环（时钟 / 镜子 / GIF / 纸箱）同样被推进。
 */
function runFrames(count, step) {
  const stepFrame = typeof window !== 'undefined' ? window.__cabinStepFrame : null
  if (typeof stepFrame !== 'function') {
    console.warn('[cabin] manual 模式缺少 __cabinStepFrame 钩子，无法定格帧')
    return 0
  }
  for (let i = 0; i < count; i++) {
    clock.step(step)
    stepFrame()
  }
  return count
}

/**
 * J0.4：解析 `cam=a,b,c,d,e,f`；非法返回 null（静默忽略，避免一个手滑的参数把页面搞崩）。
 * @returns {number[]|null}
 */
function parseCam(str) {
  if (typeof str !== 'string' || !str.trim()) return null
  const nums = str.split(',').map((s) => Number(s.trim()))
  return nums.length === 6 && nums.every(Number.isFinite) ? nums : null
}

/**
 * J0.4：应用测试机位。
 *
 * 机位表**不在产品代码里** —— 它属于测试判据，住在 `tests/visual/poses.js`，由抓图脚本
 * 拼成 URL 参数交给这里。产品代码只认"六个数"，不携带任何世界坐标
 * （架构不变量 `N9`：坐标只能来自 `cabin/world/layout.js`）。
 *
 * 必须在 monolith 加载**之后**调用 —— 相机覆盖的钩子只在 manual 模式下暴露。
 * 机位是**纯观察量**：不改玩家位置、不改场景状态、不参与任何被比对的动画，只决定"从哪看"。
 * 因此「同一机位 + 同一种子 + 同一帧」必然得到同一张图。
 *
 * @returns {string} 实际生效的 cam 参数（空串表示未覆盖相机）
 */
function applyTestCamera(opts) {
  const cam = parseCam(opts.cam)
  if (!cam) {
    if (opts.cam) console.warn(`[cabin] cam 参数无法解析（需要 6 个数字）："${opts.cam}" —— 本次不做相机覆盖`)
    return ''
  }
  const setter = typeof window !== 'undefined' ? window.__cabinSetTestCamera : null
  if (typeof setter !== 'function') {
    console.warn('[cabin] 测试机位需要 manual 模式（?deterministic=1&frames=N）—— 本次忽略')
    return ''
  }
  const applied = setter(cam)
  return applied ? applied.join(',') : ''
}

/**
 * J0.4：应用小屋形态（`?house=full|cutaway`）。
 *
 * 默认是**剖切模式**：省略的墙体与屋顶用虚线表示，便于从外面看到室内。
 * 截图机位需要自己声明要哪一种：
 *   · 看整体外观 → `full`（实墙 + 屋顶）
 *   · 看室内陈设 → `cutaway`
 * 两种形态是**场景自带的既有开关**（菜单里的「小屋」按钮），这里只是把它接到 URL，
 * 不新增任何渲染逻辑。
 *
 * @returns {string} 生效的形态（空串表示未干预）
 */
function applyHouse(opts) {
  if (opts.house !== 'full' && opts.house !== 'cutaway') {
    if (opts.house) console.warn(`[cabin] house 参数只能是 full / cutaway，收到 "${opts.house}" —— 本次不干预`)
    return ''
  }
  const setter = typeof window !== 'undefined' ? window.__cabinSetFullHouse : null
  if (typeof setter !== 'function') {
    console.warn('[cabin] house 参数需要 manual 模式（?deterministic=1&frames=N）—— 本次忽略')
    return ''
  }
  setter(opts.house === 'full')
  return opts.house
}

export async function bootCabin() {
  const bootT0 = performance.now() // J0.6：boot 逻辑起点（相对导航开始）
  await domReady()

  const opts = readTestOptions()
  const manual = opts.deterministic && opts.frames > 0

  // ① UI DOM 必须先于实现存在（原实现用 getElementById 直接取节点）
  mountUI(document.body)

  // ② 测试模式设置（必须在 legacy 实现执行之前）
  if (opts.deterministic) {
    setDeterministicRuntime(true) // F0.2：运行期随机切为确定
    document.documentElement.dataset.cabinDeterministic = '1'
  }
  if (manual) {
    // F0.3：时钟切为手动 + 冻结挂钟（drawClock / UI 节流也随之确定）
    clock.setMode('manual')
    clock.freezeWall()
    document.documentElement.dataset.cabinManualClock = '1'
  }
  if (opts.stats) {
    // J0.6：在 legacy 实现执行前请求渲染统计钩子（monolith 会据此挂上 window.__cabinRenderStats）
    window.__CABIN_WANT_STATS = true
  }

  // ③ 加载实现（画面与重构前完全一致）
  await import('./legacy/monolith.js')

  // ③.5 J0.4：应用测试机位与小屋形态（截图回归用；不指定则完全保持默认，画面与正常游玩一致）
  const camLabel = applyTestCamera(opts)
  const houseLabel = applyHouse(opts)

  // ④ 定格到第 N 帧
  if (manual) {
    const done = runFrames(opts.frames, opts.frameStep)
    document.documentElement.dataset.cabinFrames = String(done)

    // ⚠️ 定格后必须保持重绘：WebGL 默认 preserveDrawingBuffer=false，
    //    若停止渲染，drawing buffer 会被清空 —— 截图将得到**全黑画面**而非定格帧。
    //    此循环每帧仍渲染一次，但时钟不再推进，所以画面保持不变。
    if (typeof window !== 'undefined' && typeof window.__cabinStartStillRepaint === 'function') {
      window.__cabinStartStillRepaint()
      document.documentElement.dataset.cabinStillRepaint = '1'
    }
  }

  // ⑤ 记录验收依据
  const d = sceneDigest()
  document.documentElement.dataset.cabinSceneDigest = d.combined
  document.documentElement.dataset.cabinClock = JSON.stringify(clock.snapshot())
  document.documentElement.dataset.cabinSeed = String(SCENE_SEED)
  if (camLabel) document.documentElement.dataset.cabinCam = camLabel
  if (houseLabel) document.documentElement.dataset.cabinHouse = houseLabel

  // J0.6：耗时标记 ——
  //   boot-ms  = boot 逻辑自身（DOM 就绪 → 实现加载完毕）
  //   ready-ms = **导航开始 → 3D 就绪**（`performance.now()` 的起点就是导航开始，所以它可直接读）
  document.documentElement.dataset.cabinBootMs = String(Math.round(performance.now() - bootT0))
  document.documentElement.dataset.cabinReadyMs = String(Math.round(performance.now()))

  // 挂载完成标记，供 e2e / 视觉回归断言使用
  document.documentElement.dataset.cabin = 'ready'
}
