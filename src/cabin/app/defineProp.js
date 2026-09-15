/**
 * 物件契约 `defineProp` —— 让「加一件陈设」= 一个文件
 *
 * 来源：新增（`J3`）。契约见 `docs/ArtLine-Part/02-目标架构.md` §3.2，
 * 与 [`Feature.js`](./Feature.js) 的 `defineFeature`、[`types.js`](../systems/interaction/types.js)
 * 的 `defineInteractable` **同一风格**：只校验与归一化，**不做任何注册**
 * （登记由 [`installProp.js`](./installProp.js) 代劳）。
 *
 * ## 为什么要有它
 *
 * 搬迁前加一件家具要动**五个地方**：
 *   ① 顶层声明 5~10 个变量 → ② 插入几何代码 → ③ 在 `animate()` 里插更新分支
 *   → ④ 用 `regMagic` 注册交互 → ⑤ 若有灯还要改 shader 与 `PP[i]` 赋值。
 * 有了它，一件物件 = 一个文件，上面五件事都在同一个对象里声明。
 *
 * ## 字段
 *
 * | 字段 | 必填 | 作用 |
 * |---|---|---|
 * | `id` | ★ | 稳定 id，`<层>/<名字>`（如 `floor1/bookshelf`）—— **不是**挂载点 id |
 * | `build(ctx)` | ★ | 建几何。搬迁期**原样粘贴**（零优化），返回物件根 |
 * | `mount` | — | 挂载点 ID `<物品>/<部位>`（如 `shelf/main`），供 `features/**` 认领（`N2`/`N3`） |
 * | `state(ctx)` | — | 物件私有状态。替代搬迁前散落的顶层 `let` |
 * | `update(dt, time, s, ctx)` | — | 每帧更新，由 `UpdateScheduler` 按**登记顺序**调用 |
 * | `tier` | — | 更新档位 `always`/`near`/`idle`（`J2` 期间只是元数据，`J8` 才按档裁剪） |
 * | `interactables(s, ctx)` | — | 交互声明，取代 `regMagic`（`label` 必须语义化、主入口 `mode: 'both'`） |
 * | `lights(s, ctx)` | — | 光源声明，取代末尾硬编码的 `PP[i]` 赋值（不得改 shader，`N4`） |
 * | `anchor(s, ctx)` | — | 近距判定的锚点 `{x, z}`，与几何**同源**（`N9`） |
 * | `radius` | — | 近距判定半径 |
 * | `parts(s, ctx)` | — | 挂载点部件表 `{ 部位名 → Object3D }`，写进 `app/mounts.js` |
 * | `kind` | — | 分类标签（默认 `decor`），供诊断与 `registry.stats()` |
 *
 * ## 三条搬迁纪律（违反即像素回归失败）
 *
 * 1. **`build` 内部自己 `scene.add`** —— 与搬迁前逐字节等价，不引入额外的 Group 层级
 *    （父子结构与 `scene.children` 顺序都参与渲染，透明物体尤其敏感）；
 * 2. **`build` 在 monolith 的**原位置**被调用** —— `rng` 调用顺序决定后续所有随机数，
 *    顺序一变画面就变；
 * 3. **`lights()` 的声明顺序 = 原来的 `PP[i]` 槽位顺序** —— shader 的闪烁相位含 `float(i)`，
 *    槽位一变画面就变（见 `docs/实施结果/J2-实施结果.md` §7）。
 */

/** 更新档位（`J2` 期间只是元数据） */
export const PROP_TIERS = ['always', 'near', 'idle']

/**
 * 定义一件物件（返回普通对象，不做任何注册 —— 注册是 `installProp` 的事）。
 *
 * @param {object} spec 见文件头字段表
 * @returns 归一化后的物件声明
 */
export function defineProp(spec) {
  if (!spec || typeof spec !== 'object') throw new TypeError('defineProp 需要一个对象')

  const {
    id, mount = null, kind = 'decor', tier = 'always', radius = null,
    build, state, update, interactables, lights, anchor, parts,
  } = spec

  if (!id || typeof id !== 'string') throw new TypeError('defineProp 需要字符串 id')
  if (typeof build !== 'function') throw new TypeError(`物件 ${id} 需要 build 函数`)
  if (mount !== null && (typeof mount !== 'string' || !mount.trim())) {
    throw new TypeError(`物件 ${id} 的 mount 必须是非空字符串（或省略）`)
  }
  if (!PROP_TIERS.includes(tier)) {
    throw new TypeError(`物件 ${id} 的 tier 非法：${tier}（可选 ${PROP_TIERS.join(' / ')}）`)
  }
  if (radius !== null && (!Number.isFinite(radius) || radius <= 0)) {
    throw new TypeError(`物件 ${id} 的 radius 必须是正数`)
  }
  // `null` 与 `undefined` 一视同仁 = "没有这项声明" —— 于是 `defineProp` 是**幂等**的：
  // `defineProp(defineProp(spec))` 合法（归一化产物可以再传回来，便于派生/覆写 id）。
  for (const [k, fn] of Object.entries({ state, update, interactables, lights, anchor, parts })) {
    if (fn !== undefined && fn !== null && typeof fn !== 'function') {
      throw new TypeError(`物件 ${id} 的 ${k} 必须是函数（拿得到最新 state）`)
    }
  }
  // `mount` 是给 `features/**` 认领的接口：没有它，模块就只能 import 场景实现（违反 N3）
  if (mount !== null && typeof interactables === 'function' && typeof anchor !== 'function') {
    // 不算错误：主入口可以只走 aim（如镜面涟漪）。这里只提示——语义化文案仍由 installProp 强制。
  }

  return {
    id,
    mount,
    kind,
    tier,
    radius,
    build,
    state: state || null,
    update: update || null,
    interactables: interactables || null,
    lights: lights || null,
    anchor: anchor || null,
    parts: parts || null,
  }
}
