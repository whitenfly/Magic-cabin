/**
 * 18.4 书桌椅（可推拉）—— `J4.21` 升格 `defineProp`
 *
 * 来源：`legacy/monolith.js` 原 `18.4` 分区里 `/* —— 椅子 —— *\/` 那一段（`J3` 记的 L1799–1811）的
 * **几何段**，以及 `tickOnce()` 里那三行每帧分支（`J3` 记的 L6861–6863）。
 *
 * ## 搬迁对照
 *
 * | 原来住哪 | 现在住哪 |
 * |---|---|
 * | 行内 `2.6` / `const CHAIR_IN = -3.20` / `const CHAIR_OUT = -3.60` | `world/layout.js` 的 `CHAIR_X` / `CHAIR_IN` / `CHAIR_OUT`（不变量 `N9`；**数值一个没改**） |
 * | `const chairG = new THREE.Group()` | `build()` 内的同名局部量，经 `parts.body` 交出（**同一个实例**） |
 * | `let chairOpen = false, chairT = 0` | `state: () => ({ open: false, t: 0 })` |
 * | `regMagic(chairG, …)` | `interactables()`：一条（`mode: 'both'`） |
 * | `tickOnce()` 里的 3 行 | `update()`，由 `tickOnce()` **原位置**调用 `deskChairApi.tick(dt, time)` |
 *
 * ## ★ 为什么当年搬不动（`J3` 的硬阻塞，本任务已解决）
 *
 * `floor2-desk-chair.SKIP.md` 记的病根是 `chairG` 被**碰撞表**读：
 *
 * ```js
 * { g: chairG, hx: 0.24, hz: 0.24, top: FY + 0.49, bot: FY },   // movingPlatforms
 * ```
 *
 * 椅子会沿 z 平移，**碰撞盒必须跟着走**（`refreshPlatforms()` 每帧读 `m.g.position.x/z`），
 * 所以那一行不能删。搬走几何段 = `chairG` 消失 ⇒ 每帧 `ReferenceError`（**直接崩**）。
 *
 * 处置与 `floor1/stools` / `floor1/cart-shelf` 完全一致：
 * 碰撞表改读**装配记录里的部件** —— `ctx.deskChairApi.parts.body`（**就是同一个 `chairG` 实例**）。
 *
 * ## 关于两段每帧分支的合并
 *
 * 原 `tickOnce()` 里它们分别是 `frame/51`（`chairT += …`）与 `frame/52`
 * （`const ck = smooth(…)` + `chairG.position.z = …`），在 `FrameBody.js` 里**相邻**
 * （中间没有别的帧任务）⇒ 合并成一个 `update` 后**每帧执行序列不变**。
 * 合并后只在 `frame/51` 的位置登记一次，`frame/52` 的任务已删除。
 *
 * ## 逐字搬运说明
 *
 * 几何与那三行**逐行相同**（只改缩进与状态前缀）：`ctx.chairT` → `s.t`、`ctx.chairOpen` → `s.open`、
 * `ctx.chairG` → `chairG`、`ctx.smooth` → `smooth`。其余数值（四条腿 `0.022/0.018/0.44/6`、
 * 坐面 `0.44×0.05×0.44`、靠背 `0.44×0.52×0.045` 与 `-0.198` 的偏移、平滑系数 `0.07`）
 * **一个没改**。本件**不消耗 `rng`**（原段就没有）。
 */
import * as THREE from 'three'
import { defineProp } from '../../app/defineProp.js'

export default defineProp({
  id: 'floor2/desk-chair',
  kind: 'furniture',

  state: () => ({ open: false, t: 0 }),

  build({ scene, L, put, edge, box }) {
    const { CHAIR_X, CHAIR_IN, FY } = L

    const chairG = new THREE.Group();
    chairG.position.set(CHAIR_X, FY, CHAIR_IN);
    scene.add(chairG);
    for (const szx of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        put(edge(new THREE.CylinderGeometry(0.022, 0.018, 0.44, 6)), szx[0] * 0.18, 0.22, szx[1] * 0.18, 0, 0, 0, chairG);
    }
    put(box(0.44, 0.05, 0.44), 0, 0.465, 0, 0, 0, 0, chairG);
    put(box(0.44, 0.52, 0.045), 0, 0.72, -0.198, 0, 0, 0, chairG);

    return { root: chairG, parts: { body: chairG } }
  },

  // 原 `chairG` 上那条 regMagic 交互的等价声明（点一下把 `chairOpen` 取反）。
  // ⚠️ 这里**故意不写出那个「函数名 + 左括号」的字面量**：`verify-migration.mjs` ④ 的计数
  //    只看"代码里的调用点数"，而它的 `stripComments` 只剥块注释、**不剥行注释** ——
  //    在行注释里写出它，会让"删掉 1 处代码"在判据上被**抵平**。
  //    （J4.19 就这么抵平过一次；J4.21 起草时**连本条说明自己都又抵平了一次** ——
  //      两次都记在 `docs/实施结果/J4.20-实施结果.md` §4.2。）
  // 锚点与几何**同源**：x 取自 `layout.CHAIR_X`、z 取**推入**位 `layout.CHAIR_IN`
  // （都是 `chairG.position` 的来源，不变量 `N9`）。
  // `mode: 'both'` —— 否则默认固定视角下点不开（风险 `R1`），与已搬各件一致。
  interactables: (s, { L, parts }) => [{
    id: 'desk-chair/pull',
    label: '把书桌前的椅子拉开 / 推回',
    mode: 'both',
    anchor: { x: L.CHAIR_X, z: L.CHAIR_IN },
    radius: 1.5,
    hits: parts.body,
    onActivate: () => { s.open = !s.open },
  }],

  /** 原 `tickOnce()` 里的 3 行（`frame/51` + `frame/52`），逐字搬运 */
  update(dt, time, s, { L, parts, smooth }) {
    const { CHAIR_IN, CHAIR_OUT } = L

    s.t += ((s.open ? 1 : 0) - s.t) * 0.07;
    const ck = smooth(Math.max(0, Math.min(1, s.t)));
    parts.body.position.z = CHAIR_IN + (CHAIR_OUT - CHAIR_IN) * ck;
  },
})
