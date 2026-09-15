/**
 * 12.9f 长餐桌（桌体 + 三只餐盘） —— `J3` 搬迁（B4：几何 + 交互 + 每帧分支）
 *
 * 来源：`legacy/monolith.js` 原 `12.9f` 分区的**前半段**（搬迁时 `L1333–1378`）：
 * 桌面两片 + 四条桌腿 + `makePlate` 与三只餐盘的摆放，以及 `tickOnce()` 里
 * `/* ---- 长餐桌 ---- *\/` 那段的**第一个循环**（搬迁时 `L7202–7205`，盘的转动）。
 *
 * ## ★ 为什么只搬前半段（区间右端停在 `/* 茶杯（餐桌/暖桌通用） *\/`）
 *
 * 这一段往后是**互相咬合**的三块：茶杯（`makeCup`）、提梁茶壶、桌面散放餐具、椅子。
 * 其中两处引用**住在区间之外**，一搬就断：
 *   · `makeCup` / `cups` 被 **12.13 暖桌**复用（`makeCup(-0.34, -0.34, KTOP, kotatsuG)`，
 *     搬迁时 `L1971–1972`）与提梁茶壶（`const CUP_T = cups[2]`，`L1405`）读；
 *   · `chairs` 被**移动平台**读（`...chairs.map(c => …)`，`L5956`）。
 * 而这一段与下一段之间**没有任何分区注释**，唯一可用的右端标记就是那行 `/* 茶杯（餐桌/暖桌通用） *\/`。
 * 于是本件按"**能安全搬的部分先搬**"处理：桌体 + 餐盘自成一体（`plates` 与 `makePlate`
 * 在区间外零引用），茶杯及其后的一切**留在原处**，一个字节没动。
 *
 * ## 搬迁对照
 *
 * | 原来住哪 | 现在住哪 |
 * |---|---|
 * | 顶层 `const plates = []` + `function makePlate(x, z, food)` | `build()` 内的同名局部量（**逐字搬运**） |
 * | `DT_X` / `DT_Z` / `DTOP` | `world/layout.js` 的坐标表（不变量 `N9`，数值一个没改） |
 * | 三处 `regMagic(g, () => { g.userData.spinV = 9; })` | `interactables()` 三条（每只盘一条，`label` 语义化 + `mode: 'both'`） |
 * | `tickOnce()` 里那 4 行 | `update()`，由 `tickOnce()` **原位置**调用 `longTableApi.tick(dt, time)` |
 *
 * ## 两处"与搬迁前不同、但增量最小"的地方
 *
 * ① **`root` = 第一只餐盘**：桌体是 6 次 `put(… )`（默认挂到 `scene`），`plates` 各自 `scene.add`，
 *    搬迁前就没有共同父节点 —— 加一层包装会改动 `scene.children` ⇒ 像素回归。
 *    故照 `stools` 的写法：`root` 只用于登记元数据，三只盘都在 `parts` 里。
 * ② **准星入口只落在 `root`**（`installProp` 的准星通路只给根注册命中体）：
 *    原先是三只盘各有自己的 `regMagic`，搬迁后只有第一只保留准星目标；
 *    另两只改由**近距入口**（三条 `anchor` 各自与几何同源、`radius` 1.2）覆盖。
 *    这与 `stools`（两只凳子只留一只准星）完全同源，是 `J3` 过渡期的既知代价。
 *    ⇒ **`J3.1` 已修**：三条 `interactables` 各自声明 `hits`（= `parts.fish` / `egg` / `pancakes`），
 *    准星与点击回到"点哪只盘转哪只"，近距入口同时保留。
 *
 * 不用 `rng`（不消耗种子随机源，故不影响后续任何随机数序列）。
 * 状态（每只盘的 `spinV`）**仍住在 `g.userData` 里**（原实现如此），故本件无 `state()`。
 */
import * as THREE from 'three'
import { defineProp } from '../../app/defineProp.js'

export default defineProp({
  id: 'floor1/long-table',
  kind: 'furniture',

  build({ scene, L, put, box, edge, line, lloop }) {
    const { DT_X, DT_Z, DTOP } = L

    put(box(2.6, 0.06, 0.8), DT_X, 0.74, DT_Z);
    put(box(2.72, 0.04, 0.92), DT_X, 0.69, DT_Z);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]])
        put(edge(new THREE.CylinderGeometry(0.032, 0.026, 0.68, 6)),
            DT_X + sx * 1.15, 0.35, DT_Z + sz * 0.32, 0, 0, 0);

    const plates = [];
    function makePlate(x, z, food) {
        const g = new THREE.Group();
        put(edge(new THREE.CylinderGeometry(0.14, 0.115, 0.022, 18)), 0, 0.011, 0, 0, 0, 0, g);
        put(edge(new THREE.TorusGeometry(0.10, 0.005, 6, 26)), 0, 0.022, 0, Math.PI / 2, 0, 0, g);
        if (food === 'fish') {
            lloop([[0.085, 0.034, 0], [0.07, 0.034, 0.026], [0.03, 0.034, 0.04], [-0.02, 0.034, 0.036],
            [-0.055, 0.034, 0.012], [-0.055, 0.034, -0.012], [-0.02, 0.034, -0.036],
            [0.03, 0.034, -0.04], [0.07, 0.034, -0.026]], g);
            lloop([[-0.05, 0.034, 0], [-0.09, 0.034, 0.032], [-0.078, 0.034, 0], [-0.09, 0.034, -0.032]], g);
            lloop([[0.012, 0.034, 0.016], [-0.012, 0.034, 0.036], [-0.038, 0.034, 0.010]], g);
            put(edge(new THREE.CircleGeometry(0.006, 6)), 0.058, 0.037, 0.006, -Math.PI / 2, 0, 0, g);
            put(line([[0.012, 0.036, -0.028], [0.04, 0.036, -0.004]]), 0, 0, 0, 0, 0, 0, g);
            put(line([[-0.012, 0.036, -0.026], [0.016, 0.036, -0.002]]), 0, 0, 0, 0, 0, 0, g);
        }
        if (food === 'egg') {
            const RS = [0.075, 0.088, 0.078, 0.092, 0.070, 0.082, 0.090, 0.076];
            const w = [];
            for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; w.push([Math.cos(a) * RS[i], 0.030, Math.sin(a) * RS[i]]); }
            lloop(w, g);
            put(edge(new THREE.CircleGeometry(0.032, 14)), 0.012, 0.034, 0.006, -Math.PI / 2, 0, 0, g);
            put(edge(new THREE.CircleGeometry(0.013, 10)), 0.012, 0.036, 0.006, -Math.PI / 2, 0, 0, g);
        }
        if (food === 'pancakes') {
            for (let i = 0; i < 3; i++)
                put(edge(new THREE.CylinderGeometry(0.095 - i * 0.008, 0.085 - i * 0.008, 0.02, 16)),
                    0.008 * i, 0.032 + 0.021 * i, 0, 0, 0, 0, g);
            put(box(0.034, 0.016, 0.026), 0.012, 0.096, 0, 0, 0, 0, g);
        }
        g.position.set(x, DTOP, z);
        scene.add(g);
        g.userData.spinV = 0;
        plates.push(g);
    }
    makePlate(DT_X - 0.85, DT_Z - 0.12, 'fish');
    makePlate(DT_X + 0.85, DT_Z - 0.12, 'egg');
    makePlate(DT_X + 0.30, DT_Z - 0.32, 'pancakes');

    // 三只盘各自 `scene.add`（无共同父节点）⇒ `root` 取第一只，仅用于登记；三只都在 `parts` 里
    return { root: plates[0], parts: { plates, fish: plates[0], egg: plates[1], pancakes: plates[2] } }
  },

  // 原三处 `regMagic(g, () => { g.userData.spinV = 9; })` —— 一处一条，`label` 语义化。
  // 锚点与几何同源：全是 `makePlate(DT_X ± …, DT_Z ± …)` 的落点（不变量 `N9`）
  // `hits` = **这一条自己的**命中体（`J3.1`）：三只盘各点各的，否则只有第一只点得动。
  interactables: (s, { L, parts }) => [
    {
      id: 'long-table/spin-fish',
      label: '转一转餐桌上的鱼盘',
      mode: 'both',
      anchor: { x: L.DT_X - 0.85, z: L.DT_Z - 0.12 },
      radius: 1.2,
      hits: parts.fish,
      onActivate: () => { parts.fish.userData.spinV = 9; },
    },
    {
      id: 'long-table/spin-egg',
      label: '转一转餐桌上的煎蛋盘',
      mode: 'both',
      anchor: { x: L.DT_X + 0.85, z: L.DT_Z - 0.12 },
      radius: 1.2,
      hits: parts.egg,
      onActivate: () => { parts.egg.userData.spinV = 9; },
    },
    {
      id: 'long-table/spin-pancakes',
      label: '转一转餐桌上的松饼盘',
      mode: 'both',
      anchor: { x: L.DT_X + 0.30, z: L.DT_Z - 0.32 },
      radius: 1.2,
      hits: parts.pancakes,
      onActivate: () => { parts.pancakes.userData.spinV = 9; },
    },
  ],

  /** 原 `tickOnce()` 里 `/* ---- 长餐桌 ---- *\/` 段的第一个循环，逐字搬运 */
  update(dt, time, s, { parts }) {
    for (const p of parts.plates) {
        p.rotation.y += p.userData.spinV * dt;
        p.userData.spinV *= Math.max(0, 1 - 2.0 * dt);
    }
  },
})
