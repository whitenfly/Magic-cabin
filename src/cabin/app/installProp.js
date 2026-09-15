/**
 * 物件装配 —— 把一份 `defineProp` 声明装进场景与注册中心
 *
 * 来源：新增（`J3`）。它把"物件声明"翻译成四件登记动作：
 *
 * ```
 *   defineProp({ id, build, state, update, interactables, lights, mount, parts })
 *        │
 *        ├─ build(ctx)        → 建几何（**内部自己 scene.add**，与原实现逐字节等价）
 *        ├─ registry.registerProp(root, { id, kind, mount })   ← 物件登记 + id 查重
 *        ├─ mounts.claim(mount, { prop, anchor, radius, parts }) ← 「物品 ↔ 模块」接口
 *        ├─ registry.registerInteractable(...)                 ← 取代 64 处 regMagic
 *        ├─ registry.registerLight(...)                        ← 取代末尾硬编码的 PP[i] 赋值
 *        └─ scheduler.add(id, update, { tier })                ← 取代 animate() 里的内联分支
 * ```
 *
 * ## 为什么需要它（而不是让每个物件自己登记）
 *
 * `J2` 的 DoD 是「新增一盏灯 / 一个交互的**改动文件数 = 1**」。物件只声明"我有什么"，
 * 「怎么登记」由内核代劳 —— 于是搬迁一件物件不必再去想"该往哪几个数组里塞"。
 *
 * ## ★ 三条不能破的顺序（像素逐字节零差异的前提）
 *
 * 1. **`build` 在 monolith 的原位置被调用** —— `rng` 是种子随机源，**调用顺序决定后续所有随机数**；
 * 2. **登记只写元数据，不碰渲染** —— `registerProp` / `claim` 不改变任何对象的父子关系；
 * 3. **`lights` 的声明顺序 = 原来 `PP[i]` 的槽位顺序** —— shader 闪烁相位含 `float(i)`。
 *
 * ## ★ 为什么 `install()` 返回一个 `tick` 句柄（`J3` 的过渡形态）
 *
 * `UpdateScheduler` 在 `J3` 期间**只被登记、不被执行** —— `animate()` 仍然直接调用
 * `tickOnce()`（约 940 行的更新体仍在里面），调度器要到 `J4` 才接管。
 * 于是"把物件的每帧逻辑搬进 `update`"会**静默不执行**。
 *
 * 解法是**原地 tick**：`install()` 把 `update` 包成一个句柄返回，
 * monolith 在 `tickOnce()` 里**原位置**调用它（`broom.tick(dt, time)`）——
 * 状态与几何都搬进了物件，而**执行顺序一个字节都没变**。
 * `J4` 只要把这一行换成调度器驱动即可（`update` 同时已经登记进 scheduler，切换是零成本的）。
 *
 * ## 与不变量 `N4` / `N5` / `N7` 的关系
 *
 * · `N4`：光源只能通过 `lights` 注册，**不得改 shader**；
 * · `N5`：交互只能通过 `interactables` 注册，**不得新增射线列表**；
 * · `N7`：物件状态活在闭包（`state()`）里，不新增全局可变状态。
 *
 * ## 关于本文件依赖 `systems/interaction/types.js`
 *
 * `app/README.md` 写的是「`app/` 不依赖 `world/` `systems/` 的任何**具体实现**」——
 * `types.js` 是**契约定义**（无副作用、无场景依赖），装配器用它把交互声明校验成
 * 合法 `Interactable`（`label` 语义化、`mode` 含 proximity 时必须有 `anchor`/`radius`）。
 * 这条校验正是 `J3` 的 DoD「`label` 有语义」能机器守住的原因，因此这里显式依赖契约而非实现。
 */
import { defineInteractable } from '../systems/interaction/types.js'

/**
 * 造一个物件装配器。
 *
 * @param {object} o
 * @param {object} o.registry 应用内核的注册中心（`createRegistry()`）
 * @param {object} o.scheduler 更新调度器（`createUpdateScheduler()`）
 * @param {object} [o.mounts] 挂载点表（`createMounts()`）
 * @param {object} [o.ctx] 装配环境（几何工具 / layout / rng / 材质），由装配点提供
 * @param {(msg: string) => void} [o.warn] 诊断出口
 */
export function createPropInstaller({ registry, scheduler, mounts = null, ctx = {}, warn = () => {} } = {}) {
  if (!registry) throw new TypeError('createPropInstaller 需要 registry')
  if (!scheduler) throw new TypeError('createPropInstaller 需要 scheduler')

  /** @type {Map<string, {prop: object, root: any, state: object, parts: object, interactions: object[], task: object|null, tick: Function|null}>} */
  const installed = new Map()

  /**
   * 装配一件物件。
   *
   * @param {object} prop `defineProp(...)` 的返回值
   * @param {{ctx?: object}} [options] 本次装配的额外环境（覆盖构造时的 `ctx`）
   */
  function install(prop, options = {}) {
    if (!prop || typeof prop.id !== 'string' || typeof prop.build !== 'function') {
      throw new TypeError('installProp 需要一份 defineProp 声明')
    }
    if (installed.has(prop.id)) throw new Error(`物件重复装配：${prop.id}`)

    // 装配环境以 `ctx` 为**原型**，而不是展开它。
    //
    // 这不是风格偏好：`ctx` 里的每个键可以是 getter，**只在物件真正读取它的那一刻求值**。
    // 而装配器的构造点（monolith 早段）**早于**某些共享工具的定义 ——
    // `regSlide` / `registerHinge` 在 L283 就有，但 `cbox` / `crboxCol` 住在 18.10 段、
    // `colEdge` 住在 18.12 段。若在这里展开（`{ ...ctx }`），所有 getter 会被立刻触发，
    // 早段构造时就撞上后段工具的 TDZ。
    //
    // ⇒ **物件的 `build` 请按需解构**（`build({ scene, put, line })`），不要展开整个 env。
    const env = Object.create(ctx)
    if (options.ctx) Object.assign(env, options.ctx)

    // ① 状态（闭包级，替代搬迁前散落的顶层 let）
    const state = typeof prop.state === 'function' ? prop.state(env) : {}
    env.state = state

    // ② 几何 —— build 内部自己 scene.add（保持对象父子结构与原实现一致）。
    //    `build` 可以返回 Object3D（常见），也可以返回 `{ root, parts }` ——
    //    后者用于"一件物件里有多个需要后续访问的 Group"（如扫帚本体 + 悬浮光环）。
    const built = prop.build(env)
    let root = built
    let parts = {}
    if (built && typeof built === 'object' && !built.isObject3D && 'root' in built) {
      root = built.root
      parts = built.parts || {}
    }
    // 后续所有声明都能通过 `ctx.parts` 拿到这些部件（与 `mounts` 的 `parts` 同名同义）
    env.parts = parts
    const c2 = env

    // ③ 物件登记（id 查重在这里生效：搬错文件、两处定义同一物件会立刻炸）
    const entry = registry.registerProp(root, { id: prop.id, kind: prop.kind, mount: prop.mount })

    // ④ 挂载点（「物品 ↔ 功能模块」的唯一接口）
    if (prop.mount) {
      if (!mounts) {
        warn(`物件 ${prop.id} 声明了挂载点 ${prop.mount}，但没有挂载点表 —— 功能模块将认领不到它`)
      } else {
        mounts.claim(prop.mount, {
          prop: prop.id,
          root,
          anchor: typeof prop.anchor === 'function' ? prop.anchor(state, c2) : null,
          radius: prop.radius,
          parts: typeof prop.parts === 'function' ? prop.parts(state, c2) : parts,
        })
      }
    }

    // ⑤ 交互（取代 `regMagic`；`label` 语义化与 `mode` 合法性由契约强制）
    const interactions = []
    if (typeof prop.interactables === 'function') {
      for (const raw of prop.interactables(state, c2) || []) {
        const it = defineInteractable(raw)
        registry.registerInteractable(it)
        interactions.push(it)
      }
    }

    // ⑤.2 ★ aim（准星 / 点击）通路 —— `J3` 过渡期的桥。
    //
    // **不加这一段，被搬走的物件就"点不动了"。** `J3` 期间 aim 仍由 monolith 的老机制驱动：
    //   `magicMeshes`（命中集合）+ `userData.onClick`（激活）+ `userData.aimLabel`（提示文案），
    //   由 `interaction.registerAimSource({ id: 'magic', … })` 消费 —— 它正是 `regMagic` 的等价物。
    // 于是搬走一处 `regMagic`，就必须在这里补上同样三件事，缺一不可。
    //
    // ⚠️ **这条通路没有任何测试守得住**：像素回归只比较画面（交互消失画面毫无变化），
    //    冒烟只点壁炉与书堆。漏掉它不会让任何门禁变红，只会让用户发现"家具点不开了"。
    //    —— 这是 `J3` 最容易犯、也最难发现的错，所以写在这里而不是留在搬迁者的记忆里。
    //
    // 同时写 `userData.aimLabel`：准星提示原本兼容 `o.userData.aimLabel || '交互'`，
    // 给它语义化文案正是 DoD「`label` 有语义」在地面上的落法。
    // `J4` 把 aim 也收进统一契约后，这一段连同 `magicMeshes` 一并删除。
    const aimEntry = interactions.find((it) => it.mode !== 'proximity')
    if (aimEntry && root && root.isObject3D && typeof root.traverse === 'function') {
      const ud = (root.userData ||= {})
      ud.onClick = () => { if (typeof aimEntry.onActivate === 'function') aimEntry.onActivate() }
      ud.aimLabel = aimEntry.label
      if (typeof ud.sfx !== 'string') ud.sfx = 'toggle'
      // 来源标记：`registry.stats().magicPropIds` 靠它回答"哪些物件真的有准星入口"。
      // 这条通路任何测试都守不住（画面不变、冒烟不覆盖），所以留一个可诊断的痕迹。
      ud.cabinProp = prop.id
      const meshes = []
      root.traverse((m) => { if (m.isMesh && !m.userData.noHit) meshes.push(m) })
      // 顺序 = 装配顺序 = 原 `regMagic` 的调用位置 ⇒ `magicMeshes` 的命中优先级不变
      registry.registerMagic(root, meshes)
    }

    // ⑥ 光源（取代末尾硬编码的 `PP[i]`；声明顺序 = 槽位顺序）
    if (typeof prop.lights === 'function') {
      for (const src of prop.lights(state, c2) || []) {
        registry.registerLight({ ...src, prop: prop.id })
      }
    }

    // ⑦ 每帧更新。
    //    · `tick` 句柄 —— `J3` 期间由 monolith 在 `tickOnce()` 的**原位置**调用（顺序不变）；
    //    · 同时登记进 scheduler（`J4` 起改由调度器驱动，届时删掉原地调用即可，零成本切换）。
    //    ⚠️ `J3` 期间 scheduler **不会被执行**（`animate()` 仍直接调 `tickOnce()`），
    //       所以"登记 + 原地调用"不会导致同一帧跑两遍。
    let task = null
    let tick = null
    if (typeof prop.update === 'function') {
      tick = (dt, time) => prop.update(dt, time, state, c2)
      task = scheduler.add(prop.id, tick, { tier: prop.tier })
    }

    const rec = { prop, root, state, parts, entry, interactions, task, tick }
    installed.set(prop.id, rec)
    return rec
  }

  /** 取已装配物件的装配记录（诊断与测试用） */
  const get = (id) => installed.get(id) || null
  const has = (id) => installed.has(id)

  function stats() {
    const recs = [...installed.values()]
    return {
      props: recs.length,
      withMount: recs.filter((r) => !!r.prop.mount).length,
      interactables: recs.reduce((n, r) => n + r.interactions.length, 0),
      updates: recs.filter((r) => r.task).length,
      ids: recs.map((r) => r.prop.id),
    }
  }

  return { install, get, has, stats, installed }
}
