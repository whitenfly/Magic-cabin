/**
 * 注册中心 —— 物件、光源、交互、功能模块的**唯一登记处**
 *
 * 来源：新增（`J2.5`）。它取代的是搬迁前那种"各自维护一个数组"的收集方式：
 * `magicMeshes`（64 处 `regMagic` 往里塞）、`hinges`/`hingeMeshes`（门窗弹簧）、
 * `interactables`（9 条近距条目）、镜子自建射线 —— **四套并行**，
 * 每加一个可交互物件就要想"该往哪几个数组里塞"。
 *
 * ## 它解决的问题（路线图 §3 的 `J2` 目标）
 *
 * > 造出"注册机制"，让后续搬迁变成填空。
 *
 * `J3` 的每件物件只要 `defineProp({ id, mount, interactables, lights })`，
 * 登记动作由内核代劳；`J2` 的 DoD「新增一盏灯 / 一个交互的**改动文件数 = 1**」
 * 就是用它来证明的（见 `tests/unit/registry.test.mjs`）。
 *
 * ## 与旧数组的关系（`J2.5` 的兼容策略）
 *
 * `magicMeshes` / `hingeMeshes` 这类"射线命中集合"仍以**同一个数组实例**对外暴露
 * （monolith 直接持有引用做 `intersectObjects`）—— 注册中心只是把它们收拢到一处，
 * 不改变任何命中行为。这是"搬迁期零优化"的落法：**先集中，后改造**。
 *
 * ## 不变量
 *
 * · `N7`：不新增全局可变状态 —— 注册中心由 `App` 持有，随一局生命周期存在；
 * · 同一 `id` 重复注册会被拒绝（`J3` 搬迁时最能暴露"两处定义了同一个物件"）。
 */
export function createRegistry() {
  /** 所有登记在册的物件根：`{ id, root, kind, mount }` */
  const props = []
  /** 可点物件（`regMagic`）的 Mesh 扁平表 —— 准星射线与点击射线的命中集合 */
  const magicMeshes = []
  /** 已注册的光源（`J2.3` 的 `LightField` 消费） */
  const lights = []
  /** 统一交互条目（`J2.6` 的契约产物） */
  const interactables = []
  /** 已装配的功能模块（`J4` 起由 `modules.config` 决定装谁） */
  const features = []
  /** id → 登记项，用于查重与按 id 取用 */
  const byId = new Map()

  /**
   * 登记一件物件。
   *
   * @param {import('three').Object3D} root 物件根
   * @param {{ id?: string, kind?: string, mount?: string }} [opts]
   *        `id` 建议 `<层>/<名字>`（如 `floor1/bookshelf`）；`mount` 是 `J3` 的挂载点 ID
   */
  function registerProp(root, opts = {}) {
    const id = opts.id || root.name || `prop#${props.length + 1}`
    if (byId.has(id)) throw new Error(`物件 id 重复注册：${id}`)
    const entry = { id, root, kind: opts.kind || 'decor', mount: opts.mount || null }
    props.push(entry)
    byId.set(id, entry)
    return entry
  }

  /**
   * 登记一个"点一下就有反应"的物件（原 `regMagic` 的收集逻辑）。
   *
   * ⚠️ Mesh 的收集**仍由调用方完成**（它知道哪些子 Mesh 该被排除：`userData.noHit`）——
   * 注册中心只负责"这些 Mesh 属于哪个 root"这一步，命中集合的数组实例由它统一持有。
   */
  function registerMagic(root, meshes) {
    for (const m of meshes) {
      m.userData.magicRoot = root
      magicMeshes.push(m)
    }
    return root
  }

  /** 登记一个光源（`J2.3`）：`J2.5` 只收表，填充 uniform 仍由原逻辑做 */
  function registerLight(source) {
    lights.push(source)
    return source
  }

  /** 登记一条交互（`J2.6`）：`{ id, label, mode, anchor, radius, onActivate }` */
  function registerInteractable(entry) {
    if (!entry || !entry.id) throw new Error('registerInteractable 需要 id')
    interactables.push(entry)
    return entry
  }

  /** 登记一个功能模块（`Feature`） */
  function registerFeature(feature) {
    features.push(feature)
    return feature
  }

  /** 按 id 取物件登记项 */
  const get = (id) => byId.get(id) || null

  /**
   * 运行时统计（验收读它）。
   * `J2` 的进度可视化要求「已登记 Interactable 数 ≥ 73」「已登记 PointLightSource 数 ≥ 8」。
   */
  function stats() {
    return {
      props: props.length,
      magicMeshes: magicMeshes.length,
      lights: lights.length,
      interactables: interactables.length,
      features: features.length,
    }
  }

  return {
    registerProp,
    registerMagic,
    registerLight,
    registerInteractable,
    registerFeature,
    get,
    stats,
    // 集合本身（同一个数组实例，供碰撞/射线/光照直接使用）
    props,
    magicMeshes,
    lights,
    interactables,
    features,
  }
}
