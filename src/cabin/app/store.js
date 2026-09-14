/**
 * 状态存储 —— 小屋里**唯一**允许跨会话保留的东西
 *
 * 来源：新增（`J2.8`）。它消解的是风险 `R4`：**小屋零持久化，刷新即丢**。
 * 搬迁前没有这个文件的后果是"每个功能各自发明一套存法"，
 * 而 `J6.9`（断点续读）与 `J7` 的 18 个模块都会需要它。
 *
 * ## 三条纪律
 *
 * 1. **单写者**：只有 `store.set()` 会写 `localStorage`；模块之间靠 `subscribe` 得知变化，
 *    不允许绕过 store 直接 `localStorage.setItem`（验收 `BB17`）。
 * 2. **前缀 `cabin:`**：与同源下的其它页面（博客侧）互不干扰 —— 小屋是独立站点，
 *    但将来同域部署时前缀是唯一的隔离手段。
 * 3. **`?deterministic=1` 下完全不碰存储**（`persist: false`）：截图回归与冒烟必须是
 *    **环境无关**的 —— 否则"上一次测试把音量调到 0"会变成画面差异，
 *    而这与代码有没有改坏毫无关系。
 *
 * ## 与 `App` 的关系
 *
 * `App` 持有 store（`ctx.store`），`Feature.setup` 里可以订阅自己关心的键。
 * `settings.js` 的 schema 是它唯一的默认值与校验来源。
 */
import { defaultSettings, coerceSetting, SETTINGS } from './settings.js'

/**
 * @param {object} [options]
 * @param {string} [options.namespace] `localStorage` 键前缀（默认 `cabin:`）
 * @param {boolean} [options.persist] 是否真的读写 `localStorage`（默认 true）
 * @param {Storage|null} [options.storage] 存储后端（默认 `globalThis.localStorage`）
 * @param {(msg: string) => void} [options.warn] 脏数据告警出口
 */
export function createStore(options = {}) {
  const namespace = options.namespace ?? 'cabin:'
  const warn = options.warn || (() => {})
  const requestedPersist = options.persist !== false
  /** 存储后端：拿不到就降级为纯内存（SSR / 隐私模式 / Node 下没有 localStorage） */
  let storage = options.storage !== undefined ? options.storage : safeLocalStorage()
  const persist = requestedPersist && !!storage

  /** @type {Map<string, any>} 当前值 */
  const state = new Map()
  /** @type {Map<string, Set<Function>>} 键 → 订阅者 */
  const listeners = new Map()
  /** 本次会话是否发生过写入（诊断 / 验收用） */
  let writes = 0

  // 初始值：默认值打底，再让已存的值覆盖（逐项校验，脏数据丢弃）
  const defaults = defaultSettings()
  for (const [key, value] of Object.entries(defaults)) state.set(key, value)
  if (persist) load()

  function safeLocalStorage() {
    try {
      const ls = globalThis.localStorage
      if (!ls) return null
      // 探一次读写：某些浏览器在隐私模式下 getItem 可用但 setItem 抛异常
      const probe = `${namespace}__probe__`
      ls.setItem(probe, '1')
      ls.removeItem(probe)
      return ls
    } catch {
      return null
    }
  }

  /** 从存储读回全部设置项（只认 schema 里有的键） */
  function load() {
    for (const def of SETTINGS) {
      let raw
      try {
        raw = storage.getItem(namespace + def.key)
      } catch {
        continue
      }
      if (raw === null || raw === undefined) continue
      let parsed
      try {
        parsed = JSON.parse(raw)
      } catch {
        warn(`[store] ${def.key} 的存储值不是合法 JSON，已忽略`)
        continue
      }
      const r = coerceSetting(def.key, parsed)
      if (r.ok) state.set(def.key, r.value)
      else warn(`[store] ${def.key} 的存储值被拒绝：${r.reason}`)
    }
  }

  /** 取一个值（未知键返回 `undefined`，不抛错 —— 调用方自己兜底） */
  const get = (key) => state.get(key)

  /**
   * 写一个值。
   *
   * @param {string} key
   * @param {any} value
   * @param {{ silent?: boolean, persist?: boolean }} [opt] `silent` 跳过通知（初始化用）
   * @returns {boolean} 是否真的发生了变化（值没变则返回 false 且不通知）
   */
  function set(key, value, opt = {}) {
    const r = coerceSetting(key, value)
    if (!r.ok) {
      warn(`[store] set(${key}) 被拒绝：${r.reason}`)
      return false
    }
    const prev = state.get(key)
    if (Object.is(prev, r.value)) return false
    state.set(key, r.value)
    writes++
    if (persist && opt.persist !== false) {
      try {
        storage.setItem(namespace + key, JSON.stringify(r.value))
      } catch {
        warn(`[store] 写入 ${key} 失败（存储不可用）`)
      }
    }
    if (!opt.silent) notify(key, r.value, prev)
    return true
  }

  /**
   * 订阅某个键的变化（也可用 `'*'` 订阅全部）。
   * @returns {() => void} 取消订阅
   */
  function subscribe(key, fn) {
    let set_ = listeners.get(key)
    if (!set_) {
      set_ = new Set()
      listeners.set(key, set_)
    }
    set_.add(fn)
    return () => {
      set_.delete(fn)
      if (set_.size === 0) listeners.delete(key)
    }
  }

  function notify(key, value, prev) {
    const payload = { key, value, prev }
    for (const fn of listeners.get(key) || []) fn(payload)
    for (const fn of listeners.get('*') || []) fn(payload)
  }

  /** 恢复某一项（或全部）到默认值 */
  function reset(key) {
    if (key === undefined) {
      for (const [k, v] of Object.entries(defaults)) set(k, v)
      return
    }
    set(key, defaults[key])
  }

  /** 清空本命名空间下的所有持久化数据 */
  function clearPersisted() {
    if (!persist) return
    for (const def of SETTINGS) {
      try {
        storage.removeItem(namespace + def.key)
      } catch {
        /* 忽略 */
      }
    }
  }

  return {
    get,
    set,
    subscribe,
    reset,
    clearPersisted,
    load,
    /** 当前全部值的快照（`?stats=1` 下会经 `app.stats()` 暴露） */
    snapshot: () => Object.fromEntries(state),
    get persist() {
      return persist
    },
    get namespace() {
      return namespace
    },
    get writes() {
      return writes
    },
  }
}
