/**
 * 交互契约 —— 一间小屋里"什么可以被操作"的唯一定义
 *
 * 来源：新增（`J2.6`）。它取代的是搬迁前**三套并行**的登记方式：
 *
 * | 旧机制 | 覆盖 | 命中方式 |
 * |---|---|---|
 * | `hingeMeshes` + `userData.hingeGroup` | 门 / 窗 / 抽屉 / 凳子… | 准星射线 + 点击射线 |
 * | `magicMeshes` + `userData.magicRoot`（64 处 `regMagic`） | 可点物件 | 准星射线 + 点击射线 |
 * | `fireMeshes` + `userData.isFire` | 壁炉 | 准星射线 + 点击射线 |
 * | `interactables[]`（9 条硬编码） | 门 / 窗 / 壁炉 / 路牌…（近距） | 玩家距离 |
 *
 * ## 两条**硬要求**（来自 `cabin/systems/README.md`，验收 `BB2` / `BB2b`）
 *
 * 1. **`mode` 必须支持 `both`**：`aim`（准星射线，第一人称/触屏用）+
 *    `proximity`（近距判定，固定视角/第三人称用）。每个模块的主入口都要同时有这两条
 *    —— 否则"固定视角下点不开任何博客道具"（风险 `R1`，本项目最大的可用性坑）。
 * 2. **`label` 必须语义化**：搬迁前 62 处 `regMagic` 的默认提示是 `aimLabel || '交互'`，
 *    导致大量物件在准星上只显示"交互"两字。新契约要求每一处都有**引导性措辞**
 *    （"看看有哪些主题"而非"交互"）。
 *
 * ## 为什么是"命中集合 + 解析函数"而不是"一个物件一条记录"
 *
 * `J2` 的判据是像素与行为逐字节零差异，而**射线的测试顺序就是行为**：
 * 搬迁前是"铰链 → 魔法物件 → 壁炉"三段优先。契约因此保留"注册顺序 = 优先级"，
 * 用 `resolve(hit)` 把"命中的 Mesh → 一个可执行目标"这一步交给来源自己 ——
 * 这样既统一了接口，又不改变任何一次命中的结果。
 * 逐物件展开（每件物件一条 `Interactable`）是 `J3` 的活：那时每件物件都搬进了
 * `defineProp`，`meshes` 自然就是它自己的命中体。
 */
import * as THREE from 'three'

/**
 * 交互的两种探测方式
 */
export const INTERACT_MODES = ['aim', 'proximity', 'both']

/**
 * 这条交互是否需要 aim（准星 / 点击）入口 —— `mode` 含 aim 的都要。
 *
 * 来源：新增（`J3.1`）。`Registry.stats()` / `installProp.stats()` 用它做**逐条**覆盖判据：
 * "声明了 aim 却没有命中体"是不允许的状态（`J3` 的 `mode: 'aim'` 死条目、多部件物件的
 * 第 2..n 条都属此类），门禁直接断言这个清单为空。
 *
 * @param {{mode?: string}} it
 */
export const wantsAim = (it) => it.mode === 'aim' || it.mode === 'both'

/**
 * 规范化 `hits`（这一条交互**自己的**命中体）。
 *
 * 来源：新增（`J3.1`）。`J3` 的 aim 桥只认**一个** `root`，于是"一件物件里多个部件
 * 各有各的交互"这种情形（餐桌的三只餐盘、桌上的汤匙/筷子/碗叠、衣柜里的挂衣）
 * 只有**第一个部件**保留准星入口 —— 其余部件点不动，而画面毫无变化、门禁全绿。
 *
 * 让每条 `Interactable` 能声明"我对应哪些对象"（通常直接给 `parts.xxx`）之后，
 * 装配器就能为**每一条**各建一个命中体分组，语义回到搬迁前"谁被点，谁的回调跑"。
 *
 * 传 `null` / 省略 = 沿用"物件根"（`J3` 的过渡形态，向后兼容）。
 *
 * @param {any|any[]|null} [hits] 单个 `Object3D` 或它们的数组
 * @param {string} id 条目 id（报错用）
 * @returns {any[]|null} 规范化后的数组；未声明返回 `null`
 */
export function normalizeHits(hits, id) {
  if (hits === null || hits === undefined) return null
  const list = Array.isArray(hits) ? hits : [hits]
  if (list.length === 0) throw new TypeError(`${id} 的 hits 不能是空数组（要么不写，要么给对象）`)
  for (const h of list) {
    // 鸭子类型而非 `instanceof THREE.Object3D`：契约层不引入 three 的构造依赖，
    // 只要求"能 traverse 出 Mesh"——`Group` / `Mesh` / `Scene` 都满足。
    if (!h || typeof h.traverse !== 'function') {
      throw new TypeError(`${id} 的 hits 必须是 Object3D（或它们的数组），收到：${typeof h}`)
    }
  }
  return list
}

/**
 * 一条交互（`mode: 'proximity'` / `'both'` 用得到全部字段；`'aim'` 源用 `resolve`）。
 *
 * @param {object} spec
 * @param {string} spec.id 稳定 id（`<位置>/<动作>`，如 `floor1/door`）
 * @param {string} spec.label **语义化**提示文案（面向用户，不得写"交互"）
 * @param {'aim'|'proximity'|'both'} [spec.mode='both']
 * @param {{x: number, z: number}} [spec.anchor] 近距判定的锚点（世界坐标，来自 `world/layout.js`）
 * @param {number} [spec.radius] 近距判定半径
 * @param {boolean} [spec.fullHouseOnly] 只在"完整小屋"形态下可交互（如右侧窗 / 后窗）
 * @param {any|any[]} [spec.hits] 这条交互**自己的**命中体（准星/点击用；省略 = 沿用物件根）
 * @param {() => void} [spec.onActivate] 激活
 */
export function defineInteractable(spec) {
  if (!spec || typeof spec.id !== 'string') throw new TypeError('defineInteractable 需要字符串 id')
  if (typeof spec.label !== 'string' || !spec.label.trim()) {
    throw new TypeError(`${spec.id} 需要语义化 label（不得为空）`)
  }
  const mode = spec.mode || 'both'
  if (!INTERACT_MODES.includes(mode)) throw new TypeError(`${spec.id} 的 mode 非法：${mode}`)
  if (mode !== 'aim') {
    if (!spec.anchor || !Number.isFinite(spec.anchor.x) || !Number.isFinite(spec.anchor.z)) {
      throw new TypeError(`${spec.id} 的 mode 含 proximity，必须给 anchor {x, z}`)
    }
    if (!Number.isFinite(spec.radius) || spec.radius <= 0) {
      throw new TypeError(`${spec.id} 需要正的 radius`)
    }
    if (typeof spec.onActivate !== 'function') throw new TypeError(`${spec.id} 需要 onActivate`)
  }
  return {
    id: spec.id,
    label: spec.label,
    mode,
    anchor: spec.anchor || null,
    radius: spec.radius ?? 0,
    fullHouseOnly: !!spec.fullHouseOnly,
    onActivate: spec.onActivate || null,
    /** 这条交互自己的命中体（`null` = 沿用物件根；装配期由 `installProp` 消费） */
    hits: normalizeHits(spec.hits, spec.id),
  }
}

/**
 * 由射线命中构造一个可执行目标。
 *
 * @param {object} o
 * @param {string} o.id
 * @param {string} o.label
 * @param {() => void} o.activate
 */
export function makeTarget({ id, label, activate }) {
  return { id, label, activate, __target: true }
}

/** 判断一个对象是否是"可执行目标"（而不是普通物件） */
export const isTarget = (t) => !!(t && t.__target === true)

/**
 * 供 `resolve()` 使用的小工具：从命中结果里取出被遮挡判定要看的祖先链。
 * （搬迁前这段逻辑叫 `ancestorVisible`，住在 monolith 里。）
 */
export function ancestorVisible(o) {
  let p = o
  while (p) {
    if (p.visible === false) return false
    p = p.parent
  }
  return true
}

/** 把命中点转到某个对象的局部坐标（镜子涟漪用它；`J3` 的平面交互也会需要） */
export function localPointOf(object, worldPoint) {
  return object.worldToLocal(worldPoint.clone())
}

/** 常用射线器（避免每处 `new THREE.Raycaster()`） */
export function createRaycaster() {
  return new THREE.Raycaster()
}
