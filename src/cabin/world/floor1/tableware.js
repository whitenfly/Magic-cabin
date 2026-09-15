/**
 * 桌面散放餐具（汤匙 ×2 / 筷子 ×2 / 碗叠 ×1） —— `J3` 搬迁（B4：几何 + 交互 + 每帧分支）
 *
 * 来源：`legacy/monolith.js` 原 `/* ---- 桌面散放餐具 ---- *\/` 分区（搬迁时 `L1454–1525`）的
 * **几何段**，以及 `tickOnce()` 里 `/* ---- 长餐桌 ---- *\/` 段的**第三个循环**
 * （搬迁时 `L7220–7228`，餐具的弹跳）。
 *
 * ## ★ 区间右端为什么是**一行代码**（不是分区注释）
 *
 * 这一段的下一个分区注释是 `/* ---- 12.10 魔法扫帚 ---- *\/`，但两者之间还夹着椅子
 * （`const chairs = []; …makeChair ×5`），而 `chairs` 被**移动平台**读
 * （`...chairs.map(c => …)`，搬迁时 `L5956`）—— 区间一旦扫到那里就会断掉区间外的引用。
 * 中间没有任何注释行可用，于是右端取紧邻的 `            const chairs = [];`（全文件仅此一处）。
 * `_j3-apply.mjs` 的 `lineIndexOf()` 只要求"**整行逐字唯一**"（不要求是注释），已用同款逻辑核对：
 * 该行在 monolith 中恰好出现 1 次，且区间内不含任何其它 spec 的 `startMarker`。
 *
 * ## 搬迁对照
 *
 * | 原来住哪 | 现在住哪 |
 * |---|---|
 * | 顶层 `const tableItems = []` + `regItem` / `baseAt` / `makeSpoon` / `makeChopsticks` / `makeBowlStack` | `build()` 内的同名局部量（**逐字搬运**） |
 * | `DT_X` / `DT_Z` / `DTOP` | `world/layout.js` 的坐标表（不变量 `N9`，数值一个没改） |
 * | 五处 `regMagic(g, () => { g.userData.run = 1.4; })` | `interactables()` 五条（每件一条，`label` 语义化 + `mode: 'both'`） |
 * | `tickOnce()` 里那 9 行 | `update()`，由 `tickOnce()` **原位置**调用 `tablewareApi.tick(dt, time)` |
 *
 * `root` 取第一件（`tableItems[0]`，仅登记用元数据）—— 五件各自 `scene.add`，搬迁前就没有共同父节点，
 * 与 `stools` / `long-table` 同一处理。状态（每件的 `run`）**仍住在 `userData` 里**（原实现如此），
 * 故本件无 `state()`。不用 `rng`（不消耗种子随机源）。
 */
import * as THREE from 'three'
import { defineProp } from '../../app/defineProp.js'

export default defineProp({
  id: 'floor1/tableware',
  kind: 'decor',

  build({ scene, L, put, box, edge, line, lloop, logBetween, FILL }) {
    const { DT_X, DT_Z, DTOP } = L

    const tableItems = [];
    function regItem(g) {
        g.userData.run = 0;
        tableItems.push(g);
    }
    function baseAt(g, x, z, ry) {
        g.position.set(x, DTOP, z);
        g.rotation.y = ry;
        g.userData.baseY = DTOP;
        g.userData.ry = ry;
    }
    function makeSpoon(x, z, ry) {
        const g = new THREE.Group();
        const handle = edge(new THREE.CylinderGeometry(0.006, 0.0095, 0.22, 6));
        handle.rotation.x = Math.PI / 2;
        put(handle, 0, 0.011, -0.018, 0, 0, 0, g);
        const bowlMesh = new THREE.Mesh(new THREE.SphereGeometry(0.033, 12, 8), FILL);
        bowlMesh.scale.set(0.7, 0.42, 1.2);
        put(bowlMesh, 0, 0.017, 0.082, 0, 0, 0, g);
        const eo = [], ei = [];
        for (let i = 0; i <= 16; i++) {
            const a = i / 16 * Math.PI * 2;
            eo.push([Math.cos(a) * 0.023, 0.027, 0.082 + Math.sin(a) * 0.040]);
            ei.push([Math.cos(a) * 0.014, 0.029, 0.082 + Math.sin(a) * 0.026]);
        }
        lloop(eo, g);
        lloop(ei, g);
        baseAt(g, x, z, ry);
        scene.add(g);
        regItem(g);
    }
    makeSpoon(DT_X - 0.50, DT_Z + 0.06, 0.9);
    makeSpoon(DT_X + 0.58, DT_Z + 0.14, -0.8);
    function makeChopsticks(x, z, ry) {
        const g = new THREE.Group();
        logBetween([-0.008, 0.008, -0.115], [-0.008, 0.014, 0.115], 0.006, g);
        logBetween([0.008, 0.008, -0.115], [0.010, 0.014, 0.115], 0.006, g);
        baseAt(g, x, z, ry);
        scene.add(g);
        regItem(g);
    }
    makeChopsticks(DT_X - 1.02, DT_Z + 0.06, 2.0);
    makeChopsticks(DT_X + 1.02, DT_Z + 0.04, 1.1);
    function makeBowlStack(x, z) {
        const g = new THREE.Group();
        const BP = [[0.045, 0], [0.055, 0.018], [0.062, 0.03], [0.085, 0.042],
        [0.108, 0.068], [0.122, 0.096], [0.128, 0.112], [0.112, 0.112]];
        const lathePts = BP.map(p => new THREE.Vector2(p[0], p[1]));
        for (let i = 0; i < 3; i++) {
            const b = new THREE.Group();
            b.position.y = i * 0.062;
            b.rotation.y = i * 0.4;
            put(new THREE.Mesh(new THREE.LatheGeometry(lathePts, 18), FILL), 0, 0, 0, 0, 0, 0, b);
            for (const [ry, rr] of [[0, 0.045], [0.068, 0.108], [0.112, 0.128], [0.112, 0.112]]) {
                const pts = [];
                for (let k = 0; k <= 18; k++) { const a = k / 18 * Math.PI * 2; pts.push([Math.cos(a) * rr, ry, Math.sin(a) * rr]); }
                lloop(pts, b);
            }
            for (const ang of [0, 2.1, 4.2]) {
                const c = Math.cos(ang), s = Math.sin(ang);
                put(line(BP.map(([px, py]) => [c * px, py, s * px])), 0, 0, 0, 0, 0, 0, b);
            }
            g.add(b);
        }
        baseAt(g, x, z, 0.1);
        scene.add(g);
        regItem(g);
    }
    makeBowlStack(DT_X - 0.32, DT_Z - 0.28);

    // 五件各自 `scene.add`（无共同父节点）⇒ `root` 取第一件，仅用于登记；五件都在 `parts` 里
    return {
      root: tableItems[0],
      parts: {
        items: tableItems,
        spoonA: tableItems[0], spoonB: tableItems[1],
        chopstickA: tableItems[2], chopstickB: tableItems[3],
        bowlStack: tableItems[4],
      },
    }
  },

  // 原五处 `regMagic(g, () => { g.userData.run = 1.4; })` —— 一件一条，`label` 语义化。
  // 锚点与几何同源：全是 `makeSpoon / makeChopsticks / makeBowlStack` 的落点（不变量 `N9`）
  interactables: (s, { L, parts }) => [
    {
      id: 'tableware/spoon-left',
      label: '让汤匙在桌上跳一下',
      mode: 'both',
      anchor: { x: L.DT_X - 0.50, z: L.DT_Z + 0.06 },
      radius: 1.0,
      onActivate: () => { parts.spoonA.userData.run = 1.4; },
    },
    {
      id: 'tableware/spoon-right',
      label: '让另一把汤匙跳一下',
      mode: 'both',
      anchor: { x: L.DT_X + 0.58, z: L.DT_Z + 0.14 },
      radius: 1.0,
      onActivate: () => { parts.spoonB.userData.run = 1.4; },
    },
    {
      id: 'tableware/chopsticks-left',
      label: '让筷子在桌上跳一下',
      mode: 'both',
      anchor: { x: L.DT_X - 1.02, z: L.DT_Z + 0.06 },
      radius: 1.0,
      onActivate: () => { parts.chopstickA.userData.run = 1.4; },
    },
    {
      id: 'tableware/chopsticks-right',
      label: '让另一双筷子跳一下',
      mode: 'both',
      anchor: { x: L.DT_X + 1.02, z: L.DT_Z + 0.04 },
      radius: 1.0,
      onActivate: () => { parts.chopstickB.userData.run = 1.4; },
    },
    {
      id: 'tableware/bowl-stack',
      label: '让一叠碗在桌上跳一下',
      mode: 'both',
      anchor: { x: L.DT_X - 0.32, z: L.DT_Z - 0.28 },
      radius: 1.0,
      onActivate: () => { parts.bowlStack.userData.run = 1.4; },
    },
  ],

  /** 原 `tickOnce()` 里 `/* ---- 长餐桌 ---- *\/` 段的第三个循环，逐字搬运 */
  update(dt, time, s, { parts }) {
    for (const it of parts.items) {
        const u = it.userData;
        if (u.run > 0) u.run -= dt;
        const pr = u.run > 0 ? 1 - u.run / 1.4 : 1;
        const env = u.run > 0 ? Math.sin(Math.PI * pr) : 0;
        it.position.y = u.baseY + env * 0.05;
        it.rotation.z = env * Math.sin(pr * 12) * 0.18;
        it.rotation.y = u.ry + env * Math.sin(pr * 8) * 0.3;
    }
  },
})
