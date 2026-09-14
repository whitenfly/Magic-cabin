/**
 * 应用内核 —— 一局小屋的生命周期与子系统编排
 *
 * 来源：新增（`J2.5`）。它把原先"散在 `animate()` 与 `boot.js` 里的隐式编排"
 * 变成一个有名有姓的对象：**时钟、随机源、事件总线、注册中心、更新调度器**
 * 都由它持有，`Feature` 由它装配，生命周期由它驱动。
 *
 * ## 生命周期
 *
 * ```
 *   createApp()        created    造出内核（不碰 DOM、不建场景）
 *     register(f)      ready      装配模块（校验 requires，跑 setup）
 *     start()          running    按 order 依次 start
 *     stop()           stopped    停掉调度（保留场景）
 *     dispose()        disposed   逆序 dispose（重建一局时用）
 * ```
 *
 * ## 与 monolith 的关系（`J2` 阶段的过渡形态）
 *
 * `monolith` 仍是画面与行为的真值来源，它通过 `installCabin(app)` **接收**内核，
 * 把登记动作交给 `registry`。`boot.js` 是唯一同时认识两边的地方：
 *
 * ```js
 *   const app = createApp()
 *   installCabin(app)         // 3D 内部把自己的登记动作接到 app.registry
 * ```
 *
 * `J4` 搬完 `player`/`ui` 后，`monolith` 会被删除，`boot.js` 只剩
 * "造 App → 注册 features → start" 三步（这也是 `boot.js` 注释里写的目标形态）。
 *
 * ## 为什么 `App` 不做 DOM 也不 import three
 *
 * 不变量 `N12`：3D 侧与站点侧的边界要清楚；`app/` 是**纯编排**，
 * 它不该知道 canvas、也不该知道渲染器 —— 那些是 `core/render/` 的事。
 */
import { clock } from './clock.js'
import { scene as rngScene, runtime as runtimeRng, SCENE_SEED } from './rng.js'
import { createEventBus } from './EventBus.js'
import { createRegistry } from './Registry.js'
import { createUpdateScheduler } from './UpdateScheduler.js'
import { createStore } from './store.js'

/**
 * @param {object} [options]
 * @param {number} [options.rngSeed] 场景种子（默认取 `rng.js` 的 `SCENE_SEED`）
 * @param {boolean} [options.persist] 设置是否持久化（`?deterministic=1` 时传 false，见 `store.js` 纪律 3）
 * @param {(msg: string, ...rest: any[]) => void} [options.log] 日志出口（默认静默，测试可注入）
 * @returns 应用内核实例
 */
export function createApp(options = {}) {
  const bus = createEventBus()
  const registry = createRegistry()
  const scheduler = createUpdateScheduler()
  const log = options.log || (() => {})
  const seed = options.rngSeed ?? SCENE_SEED
  // J2.8：设置存储。`persist: false` 时只写内存 —— 测试必须**环境无关**
  // （否则"上一次测试把音量调到 0"会变成画面差异，而这与代码有没有改坏无关）。
  const store = createStore({ persist: options.persist !== false, warn: (m) => log(m) })

  /** @type {Map<string, object>} 已装配的模块（按 id 查重） */
  const features = new Map()
  /** 生命周期状态（测试与 `verify` 会读它） */
  let state = 'created'

  /** 传给 `Feature.setup/start/dispose` 的上下文 —— 模块只通过它拿内核 */
  const ctx = {
    app: null,
    clock,
    bus,
    scheduler,
    registry,
    store,
    log,
    seed,
  }

  /**
   * 装配一个模块。
   *
   * ⚠️ 依赖必须**先装配**：`requires` 缺失时立刻抛错，而不是等到运行时某个 `undefined` 才炸。
   * 这比"按 order 自动排序"更严格 —— 顺序由调用方显式表达（`boot.js` 里一眼能看出装配次序）。
   */
  function register(feature) {
    if (!feature || typeof feature.id !== 'string') throw new TypeError('register 需要一个带 id 的 Feature')
    if (features.has(feature.id)) throw new Error(`模块 id 重复：${feature.id}`)
    for (const req of feature.requires || []) {
      if (!features.has(req)) throw new Error(`模块 ${feature.id} 依赖 ${req}，但 ${req} 还没装配`)
    }
    features.set(feature.id, feature)
    registry.registerFeature(feature)
    if (feature.setup) feature.setup(ctx)
    return feature
  }

  /** 按 `order`（其次按装配顺序）依次启动 */
  async function start() {
    if (state === 'running') return
    const ordered = [...features.values()].sort((a, b) => (a.order || 0) - (b.order || 0))
    for (const f of ordered) {
      if (f.start) await f.start(ctx)
    }
    state = 'running'
    bus.emit('app:start', { features: ordered.map((f) => f.id) })
  }

  /** 停掉调度（场景保留，便于手动查看定格帧） */
  function stop() {
    state = 'stopped'
    bus.emit('app:stop', {})
  }

  /** 逆序释放（后装配的先释放） */
  function dispose() {
    const ordered = [...features.values()].reverse()
    for (const f of ordered) {
      if (f.dispose) f.dispose(ctx)
    }
    features.clear()
    scheduler.tasks.length = 0
    bus.clear()
    state = 'disposed'
  }

  const app = {
    clock,
    bus,
    scheduler,
    registry,
    store,
    ctx,
    /** 场景随机源（构建期永久确定）与运行期随机源 */
    rng: { scene: rngScene, runtime: runtimeRng },
    seed,
    register,
    start,
    stop,
    dispose,
    get state() {
      return state
    },
    /** 已装配模块 id（诊断 / 验收） */
    get featureIds() {
      return [...features.values()].map((f) => f.id)
    },
    /** 一句话统计（`window.__cabinApp()` 暴露它，供 e2e 断言） */
    stats() {
      return {
        state,
        seed,
        features: app.featureIds,
        registry: registry.stats(),
        scheduler: scheduler.stats(),
        clock: clock.snapshot(),
        // J2.8：设置与持久化状态（`persist: false` 时说明跑在确定性模式）
        settings: store.snapshot(),
        persist: store.persist,
      }
    },
  }
  ctx.app = app
  return app
}
