/**
 * 12.9f 长餐桌旁的 5 把椅子（可推拉）—— `J4.33` 升格 `defineProp`
 *
 * 来源：`legacy/monolith.js` 原 `12.9f` 分区**余段**里的 `const chairs = []; … makeChair ×5`
 * （`J3` 记的 L1173–1193），以及 `tickOnce()` 里 `for (const c of chairs)` 那段每帧分支。
 *
 * ## ★ 为什么单独成一件（`floor1/teapot.SKIP.md` §4 的建议）
 *
 * `teapot` 组的 SKIP 把"下一轮要搬它们"拆成了两件：
 *
 * > 之后按 `floor1-long-table.json` 的写法补两个 spec：
 * > `floor1/cup`（茶壶 + 茶杯，或茶杯单独一件）与 **`floor1/dining-chairs`**。
 *
 * 本件就是后者。它与茶壶**没有共享状态**（茶壶读 `cups[2]`，椅子有自己的 `userData`），
 * 唯一的交集是"都在长餐桌一带"，所以**可以独立搬**。
 *
 * ## ★ 两条外部引用（本件要一起改的两处）
 *
 * | 位置 | 原文 | 处置 |
 * |---|---|---|
 * | `tickOnce()` 的 `frame/13` | `for (const c of ctx.chairs) { … }` | → `diningChairsApi.tick(dt, time)`（**原位置**） |
 * | `systems/player/collision.js` 的 `movingPlatforms` | `...ctx.chairs.map(c => ({ g: c, hx: 0.23, hz: 0.23, top: 0.475 }))` | → `...ctx.diningChairsApi.parts.chairs.map(…)`（**数值与展开方式一字未改**） |
 *
 * 第 2 条与 `floor1/stools`（`stoolsApi.parts.stoolA/B`）、`floor1/cart-shelf`（`cartShelfApi.parts.cartG`）、
 * `floor2/desk-chair`（`deskChairApi.parts.body`）**完全同款** —— 本件是第四次照抄这个处置。
 *
 * ## 搬迁对照
 *
 * | 原来住哪 | 现在住哪 |
 * |---|---|
 * | 顶层 `const chairs = []` | `build()` 内的同名局部数组，经 `parts.chairs` 交出（**同一个数组实例**） |
 * | `function makeChair(x, z, ry, ax, az)` | `build()` 内的同名局部函数（逐字搬运） |
 * | 每把椅子的 `bx/bz/ax/az/cur/vel/open` | **仍在 `g.userData`**（原本就住在物件自己身上，不动它） |
 * | `ctx.regMagic(g, …)` | `interactables()`：**每把一条**（`mode: 'both'`，各带 `hits`） |
 * | `tickOnce()` 里的 `for (const c of chairs) { … }` | `update()`（`parts.chairs`，仅循环变量改名） |
 *
 * **本件不新增 `state`**：5 把椅子的状态原本就全在 `g.userData` 里（`N7`：不新增全局可变状态）。
 *
 * ## 逐字搬运说明
 *
 * 几何与每帧分支**逐行相同**：坐面 `0.42×0.05×0.42` 与 `0.45`、靠背 `0.42×0.52×0.05` 与 `-0.185`、
 * 两条横撑 `0.36×0.04×0.03` 与 `0.90/0.62`、四条腿 `0.022/0.018/0.44/6` 与 `±0.17`、
 * 每帧的 `0.45` / `0.02` / `0.88`，以及 5 次 `makeChair(...)` 的坐标与朝向 **一个没改**。
 * 本件**不消耗 `rng`**（原段没有 `floor1Rng()` 调用）。
 */
import * as THREE from 'three'
import { defineProp } from '../../app/defineProp.js'

export default defineProp({
  id: 'floor1/dining-chairs',
  kind: 'furniture',

  build({ scene, L, put, box, edge }) {
    const { DT_X, DT_Z } = L

    const chairs = [];
    function makeChair(x, z, ry, ax, az) {
        const g = new THREE.Group();
        put(box(0.42, 0.05, 0.42), 0, 0.45, 0, 0, 0, 0, g);
        put(box(0.42, 0.52, 0.05), 0, 0.73, -0.185, 0, 0, 0, g);
        put(box(0.36, 0.04, 0.03), 0, 0.90, -0.185, 0, 0, 0, g);
        put(box(0.36, 0.04, 0.03), 0, 0.62, -0.185, 0, 0, 0, g);
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]])
            put(edge(new THREE.CylinderGeometry(0.022, 0.018, 0.44, 6)), sx * 0.17, 0.22, sz * 0.17, 0, 0, 0, g);
        g.position.set(x, 0, z);
        g.rotation.y = ry;
        g.userData = { bx: x, bz: z, ax, az, cur: 0, vel: 0, open: false };
        scene.add(g);
        chairs.push(g);
    }
    makeChair(DT_X - 0.85, DT_Z + 0.85, Math.PI, 0, 1);
    makeChair(DT_X, DT_Z + 0.85, Math.PI, 0, 1);
    makeChair(DT_X + 0.85, DT_Z + 0.85, Math.PI, 0, 1);
    makeChair(DT_X - 1.42, DT_Z, Math.PI / 2, -1, 0);
    makeChair(DT_X + 1.42, DT_Z, -Math.PI / 2, 1, 0);

    return { root: chairs[0], parts: { chairs } }
  },

  // 每把椅子一条（原来就是"点哪把拉哪把"）：`mode` 必须 `both`，否则固定视角下点不开（风险 `R1`）。
  // 锚点与几何**同源**：每条的 `(x, z)` 就是 `makeChair(...)` 的落点（不变量 `N9`）。
  // `hits` = **这一条自己的**命中体（`J3.1`）：5 把各点各的。
  // `label` 按**方位**语义化（用 `L.DT_X/DT_Z` 的相对位置描述，而不是"第 N 把"）。
  interactables: (s, { L, parts }) => {
    const at = [
      { dx: -0.85, dz: 0.85, name: '左后' },
      { dx: 0, dz: 0.85, name: '中后' },
      { dx: 0.85, dz: 0.85, name: '右后' },
      { dx: -1.42, dz: 0, name: '左侧' },
      { dx: 1.42, dz: 0, name: '右侧' },
    ]
    return parts.chairs.map((g, i) => ({
      id: `dining-chairs/pull-${i + 1}`,
      label: `把长餐桌${at[i].name}的椅子拉开 / 推回`,
      mode: 'both',
      anchor: { x: L.DT_X + at[i].dx, z: L.DT_Z + at[i].dz },
      radius: 1.3,
      hits: g,
      onActivate: () => { g.userData.open = !g.userData.open },
    }))
  },

  /** 原 `tickOnce()` 里的 `for (const c of chairs) { … }`，逐字搬运（循环变量改名 `chair`，避开状态形参 `s`） */
  update(dt, time, s, { parts }) {
    for (const chair of parts.chairs) {
        const u = chair.userData;
        const target = u.open ? 0.45 : 0;
        u.vel += (target - u.cur) * 0.02;
        u.vel *= 0.88;
        u.cur += u.vel;
        chair.position.x = u.bx + u.ax * u.cur;
        chair.position.z = u.bz + u.az * u.cur;
    }
  },
})
