/**
 * 环境 —— 天气 / 时间 / 采光的**唯一**持有者与广播者
 *
 * 来源：新增（`J2.10`）。搬迁前这些量散在天气系统内部：
 * `wx.type`（天气）、`gameSec`（游戏内时间）、`FILL.uniforms.uDaylight`（采光系数），
 * 而**想要响应环境变化的代码必须直接读它们** —— 于是 `core/` 与 `systems/` 里
 * 出现了具体物件的名字（不变量 `N1` 禁止的正是这件事）。
 *
 * ## 解耦方式：广播 `env:change`
 *
 * ```js
 * bus.on('env:change', ({ weather, daylight, gameHour }) => { … })
 * ```
 *
 * 需要响应环境的东西（窗户玻璃的亮度、星空的可见度、萤火虫的出现、雨天不点壁炉…）
 * 从此**订阅事件**，而不是去读别人的变量。`J3` 搬物件时，每件物件的 `update` 里
 * 订阅一次即可 —— 这也是"新增一个模块不改核心"的另一半。
 *
 * ## 广播节流
 *
 * `daylight` 每帧都在变（太阳在走），但**每帧广播一次事件毫无意义**：
 * 订阅者做的是"亮度跨过某个阈值就换贴图"这类事。因此 `flush()` 只在
 * **天气换了** 或 **采光变化超过 1%** 时才真正 `emit()`。
 *
 * ## 与 `FILL` 的关系
 *
 * `uDaylight` 是**材质 uniform**，它是环境量的落地处之一（另一个是 `scene.background`）。
 * 本模块提供 `applyDaylight()` 写入它 —— 这样"谁改采光"只有一个入口，
 * 不会出现"某处直接改 uniform、环境量却不知道"的漂移。
 */

/** 环境量变化超过这个幅度才广播（1%） */
const DAYLIGHT_EPSILON = 0.01

/**
 * @param {object} deps
 * @param {object} deps.bus `app/EventBus.js` 的产物
 * @param {import('three').ShaderMaterial} [deps.fillMaterial] 有 `uDaylight` uniform 的 FILL 材质
 * @param {() => number} [deps.now] 取游戏内时间的函数（默认读内部值）
 */
export function createEnvironment({ bus, fillMaterial = null } = {}) {
  if (!bus) throw new TypeError('createEnvironment 需要事件总线')
  let weather = 'sunny'
  let daylight = 0
  let gameHour = 10
  /** 上一次广播出去的环境量（节流用） */
  let lastEmitted = null
  /** 广播次数（诊断：e2e 可以断言"确实广播过"） */
  let emitted = 0

  /** 当前环境量（订阅者收到的就是它） */
  function snapshot() {
    return { weather, daylight, gameHour }
  }

  function emitNow() {
    lastEmitted = snapshot()
    emitted++
    bus.emit('env:change', lastEmitted)
    return lastEmitted
  }

  /**
   * 切换天气（原 `setWeather()` 的那一半语义）。
   * 变化时**立即广播** —— 天气是离散量，没有节流的必要。
   */
  function setWeather(type) {
    if (type === weather) return false
    weather = type
    emitNow()
    return true
  }

  /**
   * 写入采光系数（同时落到 `FILL.uniforms.uDaylight`）。
   * 不在这里广播 —— 每帧都变，交给 `flush()` 节流。
   */
  function applyDaylight(value) {
    daylight = value
    if (fillMaterial && fillMaterial.uniforms && fillMaterial.uniforms.uDaylight) {
      fillMaterial.uniforms.uDaylight.value = value
    }
    return value
  }

  /** 设置游戏内小时（0–24，用于"天黑了"这类判断） */
  function setGameHour(h) {
    gameHour = h
    return h
  }

  /**
   * 每帧末调用一次：把这一帧累积的环境变化合并成**至多一次**广播。
   * @returns {object|null} 真正广播出去的环境量（没广播则返回 `null`）
   */
  function flush() {
    const s = snapshot()
    const changed =
      !lastEmitted ||
      lastEmitted.weather !== s.weather ||
      Math.abs(lastEmitted.daylight - s.daylight) > DAYLIGHT_EPSILON ||
      Math.abs(lastEmitted.gameHour - s.gameHour) > 0.02
    return changed ? emitNow() : null
  }

  return {
    setWeather,
    applyDaylight,
    setGameHour,
    flush,
    snapshot,
    get weather() {
      return weather
    },
    get daylight() {
      return daylight
    },
    get gameHour() {
      return gameHour
    },
    get emitted() {
      return emitted
    },
    stats: () => ({ weather, daylight, gameHour, emitted }),
  }
}
