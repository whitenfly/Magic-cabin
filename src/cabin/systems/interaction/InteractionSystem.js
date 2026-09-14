/**
 * 交互系统 —— 准星射线与近距判定的**唯一**实现
 *
 * 来源：新增（`J2.6`）。搬迁前同一个"找目标"的动作有**四份**实现：
 *
 * | 位置 | 用途 |
 * |---|---|
 * | `aimRay()` | 第一人称准星（屏幕中心） |
 * | `pointerup` 的射线段 | 鼠标点击（鼠标位置） |
 * | `updateInteractHint()` 的近距循环 | 固定/第三人称的"按 E" |
 * | `mirrorRay` + 自己的 pointerdown/up | 镜子涟漪（自建射线） |
 *
 * 前两份的**优先级完全一样**（铰链 → 魔法物件 → 壁炉）却各写了一遍；
 * 后两份各自维护一套状态。本模块把它们收敛为：
 *
 * ```js
 *   system.registerAimSource({ id, meshes, resolve })   // 一组命中集合 + 解析函数
 *   system.registerProximity(defineInteractable({ … })) // 近距条目
 *   system.aimTarget(raycaster)                         // 准星 / 点击共用
 *   system.nearestTarget(pos, { fullHouse })            // 近距
 * ```
 *
 * ## ★ 零差异的关键：注册顺序 = 优先级
 *
 * `aimTarget()` 按**注册顺序**逐组测试，返回第一个命中组的目标 ——
 * 与搬迁前 `aimRay()` 里"`h.length` 就返回、否则试 `m`、再试 `f`"的短路顺序完全一致。
 * 接入时三组的注册次序必须是 `hinges → magic → fire`。
 *
 * ## 与 `Registry` 的关系
 *
 * 每注册一条近距交互，同时写进 `registry.interactables`（`J2.5` 的注册中心）——
 * 进度可视化里的「已登记 `Interactable` 数 ≥ 73」读的是它。
 */
import { makeTarget, isTarget, ancestorVisible, defineInteractable } from './types.js'

/**
 * @param {object} [deps]
 * @param {object} [deps.registry] `app/Registry.js` 的产物（同步登记，供统计）
 * @param {(msg: string) => void} [deps.warn]
 */
export function createInteractionSystem({ registry = null, warn = () => {} } = {}) {
  /** @type {{ id: string, meshes: any[]|(() => any[]), resolve: Function }[]} 按优先级排列 */
  const aimSources = []
  /** @type {ReturnType<typeof defineInteractable>[]} */
  const proximity = []
  /** 最近一次 `aimTarget()` 的结果（诊断 / 测试） */
  let lastAim = null
  /** 激活次数（诊断：e2e 可以断言"确实触发过"） */
  const activations = new Map()

  /**
   * 注册一组准星命中源。
   *
   * @param {object} spec
   * @param {string} spec.id 源 id（`hinges` / `magic` / `fire`）
   * @param {any[]|(() => any[])} spec.meshes 命中集合（数组或返回数组的函数 —— 后者支持"稍后才建好"）
   * @param {(hit: {object: any, point: any, distance: number}) => (null|{id: string, label: string, activate: Function})} spec.resolve
   *        把一个射线命中解析成可执行目标；返回 `null` 表示"这一组的这个命中不构成交互"
   */
  function registerAimSource({ id, meshes, resolve }) {
    if (typeof id !== 'string') throw new TypeError('aim 源需要字符串 id')
    if (!Array.isArray(meshes) && typeof meshes !== 'function') {
      throw new TypeError(`aim 源 ${id} 的 meshes 必须是数组或返回数组的函数`)
    }
    if (typeof resolve !== 'function') throw new TypeError(`aim 源 ${id} 需要 resolve(hit)`)
    aimSources.push({ id, meshes, resolve })
    return id
  }

  /**
   * 注册一条近距交互（`mode` 含 `proximity`）。
   * @param {object} spec 见 `defineInteractable`
   */
  function registerProximity(spec) {
    const entry = defineInteractable(spec)
    if (entry.mode === 'aim') {
      throw new Error(`registerProximity 不接受 mode: 'aim'（${entry.id}）`)
    }
    proximity.push(entry)
    if (registry) registry.registerInteractable(entry)
    return entry
  }

  /**
   * ★ 准星与点击**共用**的目标查找（按注册顺序短路，与搬迁前的三段优先一致）。
   *
   * 调用方负责先 `raycaster.setFromCamera(ndc, camera)`。
   *
   * @returns {{id: string, label: string, activate: Function}|null}
   */
  function aimTarget(raycaster) {
    for (const src of aimSources) {
      const meshes = typeof src.meshes === 'function' ? src.meshes() : src.meshes
      if (!meshes || meshes.length === 0) continue
      const hits = raycaster.intersectObjects(meshes, false).filter((h) => ancestorVisible(h.object))
      if (hits.length === 0) continue
      const t = src.resolve(hits[0])
      if (isTarget(t)) {
        lastAim = { source: src.id, target: t }
        return t
      }
    }
    lastAim = null
    return null
  }

  /**
   * 近距判定：返回半径内**最近**的一条。
   *
   * @param {{x: number, z: number}} pos 玩家位置
   * @param {{fullHouse?: boolean}} [opt] `fullHouse` = 完整小屋形态（决定 `fullHouseOnly` 条目是否参与）
   */
  function nearestTarget(pos, opt = {}) {
    const fullHouse = !!opt.fullHouse
    let best = null
    let bestD = Infinity
    for (const it of proximity) {
      if (it.fullHouseOnly && !fullHouse) continue
      const d = Math.hypot(pos.x - it.anchor.x, pos.z - it.anchor.z)
      if (d < it.radius && d < bestD) {
        bestD = d
        best = it
      }
    }
    return best
  }

  /** 激活一个目标或近距条目（统一计数，便于 e2e 断言） */
  function activate(target) {
    if (!target) return false
    const fn = isTarget(target) ? target.activate : target.onActivate
    if (typeof fn !== 'function') return false
    fn()
    const id = target.id || '(匿名)'
    activations.set(id, (activations.get(id) || 0) + 1)
    return true
  }

  return {
    registerAimSource,
    registerProximity,
    aimTarget,
    nearestTarget,
    activate,
    /** 只读视图（测试与诊断用） */
    get aimSources() {
      return aimSources
    },
    get proximityEntries() {
      return proximity
    },
    get lastAim() {
      return lastAim
    },
    stats: () => ({
      aimSources: aimSources.map((s) => s.id),
      proximity: proximity.length,
      activations: Object.fromEntries(activations),
    }),
  }
}

export { makeTarget, defineInteractable, ancestorVisible }
