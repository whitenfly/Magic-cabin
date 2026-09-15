/**
 * 挂载点 ID 表 —— 「物品 ↔ 功能模块」两侧能**互不 import** 的唯一接口
 *
 * 来源：新增（`J3`）。契约见 [`src/cabin/app/README.md`](./README.md)：
 * `id → { prop, anchor, radius, parts() }`。
 *
 * ```
 * world/floor1/bookshelf.js   defineProp({ mount: 'shelf/main', … })
 *         │ 注册（installProp 代劳）
 *         ▼
 * app/mounts.js  ──── ctx.mounts.get('shelf/main') ────►  features/01-posts/scene.js
 *         ▲                                                        │
 *         └──── onActivate: ctx.commands.run('shelf:open') ◄────────┘ （命令实现注册）
 * ```
 *
 * ## 它解决的问题（不变量 `N2` / `N3`）
 *
 * · `N2`：`cabin/world/**` **不得** import `blog/**` 或 `features/**`，只能声明挂载点 ID 与命令名；
 * · `N3`：`features/**` **不得** import `cabin/world/**` 的具体实现，只能通过本表拿场景对象。
 *
 * 没有它，两边就必须互相认识 —— 模块也就无法独立关闭（验收 `BB3` / `CF1` 会失败）。
 *
 * ## 命名
 *
 * 挂载点 ID 用 `<物品>/<部位>`（如 `shelf/main`、`cauldron/rim`），
 * 与物件的 `defineProp.id`（`<层>/<名字>`，如 `floor1/bookshelf`）**不是一回事**：
 * 前者是"功能模块往哪挂"，后者是"场景里这是哪件东西"。
 */
export function createMounts({ warn = () => {} } = {}) {
  /** @type {Map<string, {id: string, prop: string, root: any, anchor: {x:number,z:number}|null, radius: number|null, parts: Record<string, any>}>} */
  const table = new Map()

  /**
   * 认领一个挂载点（由 `installProp` 在物件装配时调用）。
   *
   * 同一挂载点被两件物件声明 ⇒ 报错。这与 `Registry.registerProp` 的 id 查重同理：
   * 搬迁期最容易出的错就是"两处定义了同一个物件"，必须在装配时就炸，而不是等到
   * 某个 `features/*` 拿到错的对象才发作。
   *
   * @param {string} id 挂载点 ID（`<物品>/<部位>`）
   * @param {{prop: string, root?: any, anchor?: {x:number,z:number}|null, radius?: number|null, parts?: Record<string, any>}} entry
   */
  function claim(id, entry) {
    if (typeof id !== 'string' || !id.trim()) throw new TypeError('挂载点 ID 必须是非空字符串')
    if (!entry || typeof entry.prop !== 'string') throw new TypeError(`挂载点 ${id} 需要声明 prop`)
    if (table.has(id)) {
      const prev = table.get(id)
      throw new Error(`挂载点重复声明：${id}（已由 ${prev.prop} 占用，又被 ${entry.prop} 声明）`)
    }
    const rec = {
      id,
      prop: entry.prop,
      root: entry.root ?? null,
      anchor: entry.anchor ?? null,
      radius: entry.radius ?? null,
      parts: entry.parts ?? {},
    }
    table.set(id, rec)
    return rec
  }

  /** 取一个挂载点（`features/**` 唯一该用的入口） */
  function get(id) {
    const rec = table.get(id)
    if (!rec) return null
    return rec
  }

  /** 取一个挂载点，缺失即报错（模块声明自己"必须有"时用） */
  function require(id, who = '') {
    const rec = get(id)
    if (!rec) throw new Error(`${who ? who + '：' : ''}挂载点不存在：${id}`)
    return rec
  }

  const has = (id) => table.has(id)
  const list = () => [...table.values()]
  const ids = () => [...table.keys()]

  /** 诊断：`J7` 的"模块关闭后物品恢复纯装饰"（`BB3`）要靠它知道哪些挂载点没被认领 */
  function stats() {
    const claimed = list()
    return {
      total: claimed.length,
      props: [...new Set(claimed.map((r) => r.prop))].length,
      withParts: claimed.filter((r) => Object.keys(r.parts).length > 0).length,
      ids: ids(),
    }
  }

  return { claim, get, require, has, list, ids, stats, table }
}

/**
 * 建一个"未认领"的空表 —— 给单元测试与"关掉某模块"的场景用。
 * 与 `createMounts()` 的区别只在语义：这里不 warn。
 */
export const createEmptyMounts = () => createMounts({ warn: () => {} })
