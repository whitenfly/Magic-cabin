/**
 * 12.6 桌下椭圆地毯 —— `J3` 搬迁（B1 静态装饰）
 *
 * 来源：`legacy/monolith.js` 原 `12.6` 分区（原 `index.html` L822–836）。
 * **几何代码原样搬运**，只做了两处搬迁必需的调整：
 *   ① 外层 `{ … }` 块级作用域 → 收进 `build()` 的函数体（同样是私有作用域）；
 *   ② 坐标常量 `MTX` / `MTZ` 改从 `world/layout.js` 的坐标表解构（不变量 `N9`，数值一个没改）。
 *
 * ## 为什么它是第一批（B1）
 *
 * 纯装饰：**无状态、无交互、无光源、无 `update`**（更新逻辑本来就没有）。
 * 它是"搬迁式改动必须像素零差异"这条判据最干净的试验田 ——
 * 一旦它绿了，就说明「提取 → 原地调用 `installProp` → 删原段」这条路是通的。
 *
 * ## 缩进说明
 *
 * 原代码住在 `installCabin` 的 IIFE 里，缩进 12 空格起；搬进模块后按本文件缩进重排
 * （`docs/MIGRATION.md` §8 已登记：搬迁时自然修正）。
 */
import { defineProp } from '../../app/defineProp.js'

export default defineProp({
  id: 'floor1/rug-under-table',
  kind: 'decor',

  build({ L, lloop, put, line }) {
    const { MTX, MTZ } = L

    const r1 = [], r2 = [];
    for (let i = 0; i <= 44; i++) {
      const a = i / 44 * Math.PI * 2;
      r1.push([MTX + Math.cos(a) * 1.05, 0.008, MTZ + Math.sin(a) * 0.75]);
      r2.push([MTX + Math.cos(a) * 0.82, 0.008, MTZ + Math.sin(a) * 0.57]);
    }
    lloop(r1); lloop(r2);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      put(line([[MTX + Math.cos(a) * 0.82, 0.008, MTZ + Math.sin(a) * 0.57],
      [MTX + Math.cos(a) * 1.05, 0.008, MTZ + Math.sin(a) * 0.75]]), 0, 0, 0);
    }
  },
})
