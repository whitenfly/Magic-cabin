/**
 * 12.4 魔法书 —— `J3` 搬迁（B4：几何 + 状态 + 交互 + 每帧分支）
 *
 * 来源：`legacy/monolith.js` 原 `12.4` 分区（搬迁时 `L835–877`）的**几何段**，
 * 以及 `tickOnce()` 里那段**无注释**的每帧分支（搬迁时 `L6727–6761`，紧跟药剂瓶的软木塞块之后、
 * `/* ---- 书堆 ---- *\/` 之前）。
 *
 * ## 搬迁对照
 *
 * | 原来住哪 | 现在住哪 |
 * |---|---|
 * | 顶层 `let bookOn / bookP / flipCur / flipping` | `state: () => ({ … })`（**变量名一个没改**） |
 * | 顶层 `const dineBookG / pagePivot / glyphs` | `build()` 内的同名局部量，经 `parts` 交出（**同一批实例**） |
 * | 行内 `MTX + 0.30` / `MTZ - 0.12` / `MTTOP` | 仍是同一个表达式，`MTX/MTZ/MTTOP` 从 `world/layout.js` 解构（`N9`，数值一个没改） |
 * | `regMagic(dineBookG, …)` | `interactables()`（`label` 语义化 + `mode: 'both'`，消解风险 `R1`） |
 * | `tickOnce()` 里那 35 行 | `update()`，由 `tickOnce()` **原位置**调用 `diningBookApi.tick(dt, time)` |
 *
 * ## 两个容易漏的点
 *
 * ① **`glyphs` 是直接挂到 `scene` 的**（不是 `dineBookG` 的子节点）—— 它是书页上方飘的符文。
 *    本件因此照 `stools` / `doorHangBar` 的写法把 `root` 定为 `dineBookG`（只进 `registry` 元数据、
 *    不参与渲染，`scene.children` 的成员与顺序与搬迁前逐项相同），`glyphs` 走 `parts`。
 * ② **`update` 里用的是 `runtimeRng`（不是 `floor1Rng`）** —— 符文每次重生消耗 4 个运行期随机数，
 *    `ctx.rng.runtime` 就是它；原地 tick 保证这些消耗仍发生在**同一帧的同一位置**，
 *    于是后续 `cameraRig.applyShake` 拿到的随机序列也不变。
 *
 * 建筑段的 `floor1Rng()` 共 77 次（7 个符文 ×（3 段 × 2 + 5 项 userData）），
 * 次数与顺序都没变 ⇒ 后续随机数序列与画面不变。
 */
import * as THREE from 'three'
import { defineProp } from '../../app/defineProp.js'

export default defineProp({
  id: 'floor1/dining-book',
  kind: 'decor',

  state: () => ({ bookOn: true, bookP: 1, flipCur: 0, flipping: false }),

  // 本段原码里有 `for (let s = 0; s < 3; s++)`（符文的笔画），故 `build` 不绑定 `state`
  build({ scene, L, put, box, line, rng }) {
    const { MTX, MTZ, MTTOP } = L
    const floor1Rng = rng.floor1

    const BX = MTX + 0.30, BZ = MTZ - 0.12;
    const dineBookG = new THREE.Group();
    dineBookG.position.set(BX, MTTOP, BZ);
    dineBookG.rotation.y = 0.4;
    put(box(0.30, 0.018, 0.38), -0.15, 0.012, 0, 0, 0, -0.14, dineBookG);
    put(box(0.30, 0.018, 0.38), 0.15, 0.012, 0, 0, 0, 0.14, dineBookG);
    put(box(0.26, 0.014, 0.34), -0.14, 0.032, 0, 0, 0, -0.12, dineBookG);
    put(box(0.26, 0.014, 0.34), 0.14, 0.032, 0, 0, 0, 0.12, dineBookG);
    put(line([[0, 0.055, -0.19], [0, 0.055, 0.19]]), 0, 0, 0, dineBookG);
    for (const [px, pz] of [[-0.16, -0.08], [-0.10, 0.06], [-0.19, 0.10], [0.08, -0.10], [0.15, 0.05], [0.19, -0.04]])
        put(line([[px - 0.025, 0.045, pz - 0.025], [px + 0.025, 0.045, pz + 0.025]]), 0, 0, 0, dineBookG);
    const pagePivot = new THREE.Group();
    put(box(0.24, 0.007, 0.31), 0.12, 0.0395, 0, 0, 0, 0, pagePivot);
    pagePivot.rotation.z = 0.12;
    pagePivot.visible = false;
    dineBookG.add(pagePivot);
    scene.add(dineBookG);

    const glyphs = [];
    for (let i = 0; i < 7; i++) {
        const g = new THREE.Group();
        for (let s = 0; s < 3; s++) {
            const a = floor1Rng() * 1.2 - 0.6;
            const l = 0.02 + floor1Rng() * 0.02;
            put(line([[0, s * 0.028, 0], [Math.sin(a) * l, s * 0.028 + 0.026, 0]]), 0, 0, 0, g);
        }
        g.userData = {
            age: floor1Rng() * 2.5, life: 2.5 + floor1Rng() * 1.2,
            ox: (floor1Rng() - 0.5) * 0.22, oz: (floor1Rng() - 0.5) * 0.18,
            sway: floor1Rng() * 6.28
        };
        g.visible = false;
        scene.add(g);
        glyphs.push(g);
    }

    // `BX` / `BZ` 是符文落点用的派生坐标（原码里就是局部 const），随几何一起经 `parts` 交出
    return { root: dineBookG, parts: { book: dineBookG, pagePivot, glyphs, BX, BZ } }
  },

  // 原 `regMagic(dineBookG, …)` 的回调体逐字搬来（状态量加 `s.` 前缀）。
  // 主入口同时给 aim（准星）与 proximity（近距）两条 —— 否则默认固定视角下点不开（风险 `R1`）
  interactables: (s, { L }) => [{
    id: 'dining-book/flip',
    label: '翻开 / 合上餐桌上的魔法书',
    mode: 'both',
    // 锚点与几何同源：都取自 `L.MTX / L.MTZ` 的同一对偏移（不变量 N9）
    anchor: { x: L.MTX + 0.30, z: L.MTZ - 0.12 },
    radius: 1.4,
    onActivate: () => {
        s.bookOn = !s.bookOn;
        if (!s.flipping) { s.flipping = true; s.flipCur = 0; }
    },
  }],

  /** 原 `tickOnce()` 里那段**无注释**的分支（搬迁时 `L6727–6761`），逐字搬运 */
  update(dt, time, s, { parts, L, rng }) {
    const { pagePivot, glyphs, BX, BZ } = parts
    const { MTTOP } = L
    const runtimeRng = rng.runtime

    s.bookP += ((s.bookOn ? 1 : 0) - s.bookP) * 0.02;
    if (s.flipping) {
        s.flipCur += dt * 1.6;
        if (s.flipCur >= 1) { s.flipCur = 0; s.flipping = false; }
    }
    pagePivot.visible = s.flipping;
    if (s.flipping) {
        const e = s.flipCur * s.flipCur * (3 - 2 * s.flipCur);
        pagePivot.rotation.z = 0.12 + e * (Math.PI - 0.24);
    }
    for (const g of glyphs) {
        const u = g.userData;
        u.age += dt;
        if (u.age >= u.life) {
            if (s.bookOn && s.bookP > 0.5) {
                u.age = 0;
                u.life = 2.5 + runtimeRng() * 1.2;
                u.ox = (runtimeRng() - 0.5) * 0.22;
                u.oz = (runtimeRng() - 0.5) * 0.18;
                u.sway = runtimeRng() * 6.28;
                g.visible = true;
            } else {
                g.visible = false;
            }
        }
        if (g.visible) {
            const p = u.age / u.life;
            const rise = p * 0.38;
            const sway = Math.sin(time * 2 + u.sway) * 0.03 * p;
            g.position.set(BX + u.ox + sway, MTTOP + 0.06 + rise, BZ + u.oz);
            const env = Math.min(p * 6, 1) * (1 - Math.max(0, (p - 0.65) / 0.35));
            g.scale.setScalar(Math.max(env, 0.001));
            g.rotation.y = Math.sin(time * 1.5 + u.sway) * 0.4;
        }
    }
  },
})
