/**
 * 可步进时钟（F0.3）
 * ============================================================================
 * 目的：把「动画时间」从「浏览器给的真实时间戳」改为**可外部控制的值**，
 * 从而能够「定格到第 N 帧」做像素级比对。
 *
 * ## 背景
 *
 * F0.2 消除了随机性之后，截图仍有约 0.25% 的差异，根源是时间：
 *
 *     function animate(t) {
 *         requestAnimationFrame(animate);   // 自驱动，外部无法推进
 *         const time = t * 0.001;           // t 是浏览器按真实时间给的时间戳
 *         ...
 *     }
 *
 * 两次加载的启动耗时不同 → 第 120 帧对应的 time 不同 → 火焰摆动、水面、粒子、
 * 时钟指针的相位都差一点 → 像素不同。**这不是 bug，是"无法定格"。**
 *
 * ## 三级时间
 *
 * | 级别 | 用途 | 可控性 |
 * |---|---|---|
 * | `wall`（真实挂钟） | UI 节流、防连点、GIF 重绘节流 | 只读；测试模式可冻结 |
 * | `game`（游戏内时间） | 昼夜、天气（原 `gameSec`） | 可跳转（时间滑块）—— 已存在于 monolith |
 * | **`anim`（动画时间）** | **火焰 / 水面 / 粒子 / 呼吸 / 转场** | ★ **本模块提供：可手动步进** |
 *
 * `gameSec` 由 `timeScale * dt` 推进，而 `dt` 现在来自本模块，因此自动获得可复现性。
 *
 * ## 两种模式
 *
 * - `realtime`（默认）：行为与改动前**完全一致** —— `tick(rafTimestamp)` 把 rAF 的时间戳
 *   换算成秒，`dt = clamp(t - now, 0, 0.05)`，与原来的 `Math.min(time - lastT, 0.05)` 等价。
 * - `manual`：`tick()` 不推进；由外部调用 `step(dt)` 逐帧推进，每帧 `dt` 固定。
 *
 * ## 判定某个时间用途该归哪一级
 *
 * > 问「**这个值会不会出现在截图里？**」
 * > 会 → 用 `clock.now`（anim 级）
 * > 不会（UI 反馈、性能节流、输入手感）→ 用 `clock.wallNow()`（wall 级）
 */

/** 单帧最大步长（秒）—— 与原实现 `Math.min(time - lastT, 0.05)` 的上限一致，防止卡顿后跳变 */
export const MAX_DT = 0.05

/** manual 模式的默认步长：1/60 秒 */
export const STEP = 1 / 60

/** 测试模式下 `drawClock()` 使用的冻结时刻（本地时间 2026-02-14 10:00:00） */
export const FROZEN_DATE_MS = new Date(2026, 1, 14, 10, 0, 0, 0).getTime()

/** 测试模式下冻结的挂钟秒数（与 FROZEN_DATE_MS 对应，用于 wall 级判断） */
export const FROZEN_WALL_SEC = FROZEN_DATE_MS / 1000

export const clock = {
  /** 'realtime' | 'manual' */
  mode: 'realtime',

  /** 动画时间（秒）—— 取代原来到处传递的 `time` */
  now: 0,

  /** 上一帧间隔（秒）—— 取代原来的 `dt` */
  dt: 0,

  /** 已推进的帧数（回归断言用） */
  frame: 0,

  /** 最近一次 rAF 时间戳换算出的真实时间（秒） */
  _wall: 0,

  /** 冻结的挂钟（秒）；非 null 时 `wallNow()` 返回它 */
  _wallFrozen: null,

  /** `drawClock()` 使用的冻结日期（毫秒时间戳） */
  frozenDateMs: null,

  /**
   * 主循环每帧调用。
   * realtime：把 rAF 时间戳换算为动画时间并推进。
   * manual：只记录真实时间，不推进动画时间（由 `step` 推进）。
   * @param {number} rafTimestamp requestAnimationFrame 传入的时间戳（毫秒）
   */
  tick(rafTimestamp) {
    this._wall = rafTimestamp * 0.001
    if (this.mode === 'realtime') {
      const t = this._wall
      // 与原实现等价：dt = min(time - lastT, 0.05)；额外夹住负数以防时间戳回退
      this.dt = Math.min(Math.max(t - this.now, 0), MAX_DT)
      this.now = t
      this.frame++
    }
    return this
  },

  /**
   * 手动推进一帧（仅 manual 模式使用）。
   * @param {number} [dt] 步长（秒），默认 1/60
   */
  step(dt = STEP) {
    this.dt = dt
    this.now += dt
    this.frame++
    return this
  },

  /** 切换模式 */
  setMode(mode) {
    this.mode = mode
    return this
  },

  /**
   * 真实挂钟（秒）—— 用于 UI 节流、防连点、GIF 重绘节流。
   * manual 模式下若已冻结，则返回冻结值，保证这些逻辑也不引入不确定性。
   */
  wallNow() {
    return this._wallFrozen !== null ? this._wallFrozen : performance.now() * 0.001
  },

  /** 冻结挂钟（manual 模式用） */
  freezeWall(sec = FROZEN_WALL_SEC, dateMs = FROZEN_DATE_MS) {
    this._wallFrozen = sec
    this.frozenDateMs = dateMs
    return this
  },

  /** 解冻挂钟 */
  unfreezeWall() {
    this._wallFrozen = null
    this.frozenDateMs = null
    return this
  },

  /** 复位到初始状态（测试前调用，保证每次运行从同一状态出发） */
  reset() {
    this.now = 0
    this.dt = 0
    this.frame = 0
    this._wall = 0
    return this
  },

  /** 当前状态快照（回归断言用） */
  snapshot() {
    return { mode: this.mode, now: Number(this.now.toFixed(6)), dt: Number(this.dt.toFixed(6)), frame: this.frame }
  },
}

/** 当前是否为手动（可定格）模式 */
export function isManual() {
  return clock.mode === 'manual'
}
