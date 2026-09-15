/**
 * 18.11 置物箱（挎包旁边地上，木箱 + 盖沿 + 盖顶面板 + 正面搭扣） —— `J3` 搬迁（B4）
 *
 * 来源：`legacy/monolith.js` 原 `/* 置物箱（挎包旁边地上）：加宽 + 简化 + 颜色统一 *\/`
 * 小节的裸块（装配时 L4676–L4690：`const crateX = 0.95, crateZ = 3.48;` 起）。
 *
 * ## 与搬迁前逐项对应
 *
 * | 原来住哪 | 现在住哪 |
 * |---|---|
 * | 顶层 `const crateX = 0.95, crateZ = 3.48` | `world/layout.js` 的 `CRATE_X / CRATE_Z`（不变量 `N9`，数值一个没改） |
 * | 顶层 `const CR_W / CR_D / CR_H / CRATE_TOP` | `world/layout.js` 的 `CR_W / CR_D / CR_H / CRATE_TOP`（同上；**跨件共享**，见下） |
 * | `const CR_COL / CR_DARK`（配色）与四次 `put(cbox(…))` | `build()`，`build` 里用重命名解构把常量名映射回 `crateX / crateZ` |
 *
 * ## ★ 为什么箱子的尺寸常量进了 `layout.js`
 *
 * `CR_W / CR_D / CRATE_TOP` 不只被本件用 —— **魔女帽**（[`witch-hat.js`](./witch-hat.js)）的
 * 帽座就在箱盖顶面上（`HAT_HOME_POS = V(crateX, CRATE_TOP, crateZ)`），撒糖动画的
 * 「糖果落在箱盖上还是地上」也用 `CR_W / CR_D` 判定落点。两件物件跨模块取同一份坐标，
 * 唯一不违反 `N9`（坐标真源唯一）的去处就是 `layout.js`。
 * `CR_H` 一并进 `layout` 是因为 `CRATE_TOP = FY + CR_H + 0.092` 由它推出
 * （声明顺序 `CR_W → CR_D → CR_H → CRATE_TOP` 不可调换，否则 `layout.js` 自己就撞 TDZ）。
 *
 * ⚠️ 因此本件的 spec **必须与 `floor2/witch-hat` 同批应用**（应用器只在同一次运行里
 * 写入 layout 常量；单独 `--only=floor2/witch-hat` 会让 `L.CR_W` 是 `undefined`）。
 *
 * ## 没有 `state()` / `update()` / `interactables()` / `root`
 *
 * 本段**原本就没有** `regMagic`（全文 62 处 `regMagic` 里，L4676–4690 一处也没有）——
 * 置物箱是纯装饰：不可点、无动画、无状态。
 * 四次 `put(cbox(…))` 都**直接挂到 `scene`**（无自己的 Group）⇒ `build` 不返回 root
 * （与 [`floor1/rugUnderTable.js`](../floor1/rugUnderTable.js) 同款：`installProp` 允许
 * `build` 返回 `undefined`，此时只登记元数据，不碰任何父子关系）。
 * **不要**为了让"箱子有个 root"而补一层 Group —— 那会改动 `scene.children` 构成与绘制顺序。
 *
 * 未用 `rng`（不消耗种子随机源 ⇒ 后续随机数序列不变，不变量 `N8`）。
 */
import { defineProp } from '../../app/defineProp.js'

export default defineProp({
  id: 'floor2/crate',
  kind: 'decor',

  build({ L, put, cbox }) {
    // 重命名解构：把 layout 常量名映射回原实现的标识符名（几何代码因此逐字不变）
    const { CRATE_X: crateX, CRATE_Z: crateZ, CR_W, CR_D, CR_H, FY } = L

    {
        const CR_COL = 0xa07850;
        const CR_DARK = 0x8a6238;
        // 箱体
        put(cbox(CR_W, CR_H, CR_D, CR_COL), crateX, FY + CR_H / 2, crateZ, 0, 0, 0);
        // 箱盖沿（略大一圈）
        put(cbox(CR_W + 0.04, 0.07, CR_D + 0.04, CR_DARK), crateX, FY + CR_H + 0.035, crateZ, 0, 0, 0);
        // 盖顶面板
        put(cbox(CR_W - 0.10, 0.022, CR_D - 0.10, CR_COL), crateX, FY + CR_H + 0.081, crateZ, 0, 0, 0);
        // 正面搭扣（朝向房间一侧）
        put(cbox(0.10, 0.11, 0.02, CR_DARK), crateX, FY + CR_H / 2, crateZ - CR_D / 2 - 0.006, 0, 0, 0);
    }
  },
})
