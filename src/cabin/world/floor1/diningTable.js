/**
 * 12.1 原木餐桌 —— `J3` 搬迁（B3 一楼核心陈设）
 *
 * 来源：`legacy/monolith.js` 原 `12.1` 分区。**几何代码原样搬运**，只做两处搬迁必需的调整：
 *   ① 外层缩进按本文件重排（原 12 空格 → `build` 体内 4 空格起，`docs/MIGRATION.md` §8 已登记）；
 *   ② 坐标 `MTX` / `MTZ` 从 `world/layout.js` 的坐标表解构（不变量 `N9`，数值一个没改）。
 *
 * ## 与范例 A（`rugUnderTable.js`）同型
 *
 * **无状态、无交互、无光源、无 `update`**：桌面、桌裙、四条桌腿、两根横撑全部直接 `put`
 * 进场景，没有自建 `Group`，**不引入新的父子层级**（`scene.children` 的成员与顺序
 * 与搬迁前逐项相同）。`build` 因此不返回根 —— 与 `rugUnderTable` 一致。
 *
 * ## 两处"看着像常量、其实不能改"的字面量
 *
 * · 桌面高度写的是行内 `0.75` / `0.70`，**不是** `MTTOP`（`0.78`）：
 *   `MTTOP` 是"摆在桌面上的物件"用的（星象仪 12.2、药剂瓶 12.3 的 Group 高度），
 *   两者本来就差 3 cm —— 照抄不改，改成 `MTTOP` 会让桌面**升高**、画面必然回归。
 * · 桌腿的 `0.47` / `0.28`、桌裙的 `1.27` / `0.04` / `0.92` 是**局部偏移量**，
 *   按搬迁纪律留在原地（不进 `layout.js`）。
 *
 * 不用 `rng`（不消耗种子随机源，故不影响后续任何随机数序列）。
 */
import * as THREE from 'three'
import { defineProp } from '../../app/defineProp.js'

export default defineProp({
  id: 'floor1/dining-table',
  kind: 'furniture',

  build({ L, put, box, edge, log }) {
    const { MTX, MTZ } = L

    put(box(1.15, 0.06, 0.8), MTX, 0.75, MTZ);
    put(box(1.27, 0.04, 0.92), MTX, 0.70, MTZ);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]])
      put(edge(new THREE.CylinderGeometry(0.035, 0.028, 0.7, 6)),
        MTX + sx * 0.47, 0.36, MTZ + sz * 0.28, 0, 0, 0);
    put(log(0.94, 0.02), MTX, 0.28, MTZ - 0.28, 0, 0, Math.PI / 2);
    put(log(0.94, 0.02), MTX, 0.28, MTZ + 0.28, 0, 0, Math.PI / 2);
  },
})
