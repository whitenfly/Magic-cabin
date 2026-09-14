/**
 * 类型化事件总线 —— 模块之间**唯一**的广播通道
 *
 * 来源：新增（`J2.5`）。原实现里模块之间靠共享闭包变量互相"看见"
 * （`fireLit`、`lampLit`、`cbRun`… 既是状态又是开关），`J2.3`/`J2.10` 要解开这个耦合。
 *
 * 设计取舍：
 *   · **不用 Node 的 `EventEmitter`**：它是 CJS 生态的东西，且带 `maxListeners` 等
 *     与浏览器无关的语义；这里不到 40 行，行为完全可控。
 *   · **`emit` 时对监听表做快照**：允许处理函数在回调里 `off` 自己（一次性监听很常见），
 *     不会因为遍历中被删而漏掉后面的监听者。
 *   · **`on` 返回取消函数**：`Feature.dispose()` 里一行就能退订，不必记住 `type + fn` 两样东西。
 *
 * 约定的事件名（`J2` 起逐步启用）：
 *   `env:change`    天气 / 时间 / 采光变化（`J2.10`）—— 载荷 `{ day, weather, daylight }`
 *   `setting:change` 某个设置项变了（`J2.8`）—— 载荷 `{ key, value, prev }`
 *   `interact:fire`  某个交互被触发（`J2.6`）—— 载荷 `{ id, label, source }`
 */
export function createEventBus() {
  /** @type {Map<string, Set<Function>>} */
  const handlers = new Map()
  /** 诊断用：最近一次 emit 的事件名与由此触发的处理函数数（`registry.stats()` 一起看） */
  let lastEmit = null

  /**
   * 订阅。
   * @returns {() => void} 取消订阅（幂等）
   */
  function on(type, fn) {
    if (typeof fn !== 'function') throw new TypeError(`事件 ${type} 的处理函数必须是函数`)
    let set = handlers.get(type)
    if (!set) {
      set = new Set()
      handlers.set(type, set)
    }
    set.add(fn)
    return () => off(type, fn)
  }

  /** 订阅一次，触发后自动退订 */
  function once(type, fn) {
    const un = on(type, (payload) => {
      un()
      fn(payload)
    })
    return un
  }

  /** 退订（未订阅时静默） */
  function off(type, fn) {
    const set = handlers.get(type)
    if (!set) return
    set.delete(fn)
    if (set.size === 0) handlers.delete(type)
  }

  /**
   * 广播。
   * @returns {number} 实际被调用的处理函数个数（0 表示无人监听 —— 这是合法的，不是错误）
   */
  function emit(type, payload) {
    const set = handlers.get(type)
    if (!set || set.size === 0) {
      lastEmit = { type, listeners: 0 }
      return 0
    }
    // ★ 快照：回调里 off/on 都不会打乱这一轮的遍历
    const list = Array.from(set)
    for (const fn of list) fn(payload)
    lastEmit = { type, listeners: list.length }
    return list.length
  }

  /** 退订某个事件的全部监听（不传 `type` 则清空总线） */
  function clear(type) {
    if (type === undefined) handlers.clear()
    else handlers.delete(type)
  }

  /** 某个事件的监听者数量（测试与诊断用） */
  const listenerCount = (type) => (handlers.has(type) ? handlers.get(type).size : 0)

  return { on, once, off, emit, clear, listenerCount, get lastEmit() { return lastEmit } }
}
