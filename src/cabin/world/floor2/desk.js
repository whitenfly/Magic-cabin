/**
 * 18.4 书桌（桌腿 ×4 + 桌面 + 两侧横撑） —— `J3` 搬迁（B5）
 *
 * 来源：`legacy/monolith.js` 原 `18.4` 分区**第一小节**（`/* ---- 18.4 书桌 + 椅子 + 桌面玩具 ---- *\/`
 * 与 `/* —— 椅子 —— *\/` 之间）的纯几何段。
 *
 * ## 为什么 18.4 要拆成多个模块
 *
 * `18.4` 一个分区里塞了桌体 / 椅子 / 魔方 / 金币柱 / 扑克牌堆 / 玻璃雪景球 / 沙漏 / 台历 /
 * 魔法书本共 **9 件互相独立的陈设**（各自有独立的根 Group、独立的状态、独立的 `regMagic`）。
 * `defineProp` 的粒度就是「一件陈设」（`defineProp.js` 文件头：**「加一件陈设」= 一个文件**），
 * 所以按原注释小节切开搬，每一件各自一个模块。
 *
 * 本件是其中最薄的一件：**纯几何、无状态、无交互、无每帧逻辑** ⇒ `assign` / `tick` 都不需要。
 *
 * ## 搬迁对照
 *
 * | 原来住哪 | 现在住哪 |
 * |---|---|
 * | `TBLX` / `TBLZ` / `FY`（**本来就是 layout 常量**） | `world/layout.js`（本件**不新增**任何常量，不变量 `N9`） |
 * | `for (const sxsz of …) put(…)` 等 6 行 | `build()`（逐字搬运，只改缩进） |
 *
 * ## ctx 键
 *
 * `L(TBLX, TBLZ, FY)` / `put` / `edge` / `box`（按需解构，不展开 `ctx`）。
 * 本件**不消耗 `rng`**（原段一个随机调用都没有）⇒ `rng` 调用序列一个字节没变。
 * 本件**不声明 `mount` / `interactables` / `lights` / `update`** —— 与搬迁前一致（原来没有 `regMagic`）。
 */
import * as THREE from 'three'
import { defineProp } from '../../app/defineProp.js'

export default defineProp({
  id: 'floor2/desk',
  kind: 'furniture',

  build({ L, put, edge, box }) {
    const { TBLX, TBLZ, FY } = L

    for (const sxsz of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        put(edge(new THREE.CylinderGeometry(0.035, 0.028, 0.72, 8)), TBLX + sxsz[0] * 1.00, FY + 0.36, TBLZ + sxsz[1] * 0.45, 0, 0, 0);
    }
    put(box(2.4, 0.08, 1.1), TBLX, FY + 0.76, TBLZ);
    put(box(2.0, 0.05, 0.05), TBLX, FY + 0.28, TBLZ + 0.45);
    put(box(2.0, 0.05, 0.05), TBLX, FY + 0.28, TBLZ - 0.45);
  },
})
