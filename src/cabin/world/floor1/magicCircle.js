/**
 * 紫色魔法阵 —— `J4.24` 升格 `defineProp`
 *
 * 来源：`legacy/monolith.js` 原 `/* ---- 紫色魔法阵 ---- *\/` 分区（`J3` 记的 L980–1091）的
 * **几何段**，以及 `tickOnce()` 里 `frame/38` 那段每帧分支（`J3` 记的 L6670–6706）。
 * 「施法」交互来自 `regMagic(mcG, …)`。
 *
 * ## ★ `J4.18` 契约的第三个真实用户（光源**槽位 2**）
 *
 * `floor1-magic-circle.SKIP.md` 记的病根与其余五件同款：
 *
 * ```js
 * ptMc += ((mcRun > 0 ? 1 : 0) - ptMc) * 0.055;   // ← 住在替换区间之外
 * ```
 *
 * `J3` 判定"两条路都破判据"：搬走 ⇒ `mcRun` 消失 ⇒ `ReferenceError`；
 * 而把光源重注册进 `lights()` ⇒ 槽位从 2 变成 8（排在末尾）⇒ 破纪律 3。
 * `slot: 2` 显式声明之后两条路都通了。
 *
 * ## 搬迁对照
 *
 * | 原来住哪 | 现在住哪 |
 * |---|---|
 * | 顶层 `let mcRun = 0` | `state: () => ({ run: 0, pt: 0 })` |
 * | `ctx.ptMc`（`WeatherSystem.js` 初值 `0`） | `state.pt`（**同一个初值**） |
 * | `ctx.ptMc += …`（`tickOnce()` 末尾那 5 行之一） | `update()` 的第二段（见下 ★） |
 * | `mcG` / `mcMat` / `mcBase` / `mcFloats` / `mcParts` / `mcHit` | `build()` 内的同名局部量，经 `parts` 交出（**同一个实例**） |
 * | `mcLoop`（局部工具函数） | `build()` 内的同名局部函数（只在本件用） |
 * | 末尾硬编码的 `lightField.register(… 'floor1/magic-circle' …)` | `lights()`：`slot: 2` + `strength: () => s.pt` |
 * | `regMagic(mcG, …)` + `mcG.userData.sfx = 'magic'` | `interactables()`（`sfx` 仍在 `build` 里写 —— 见下 ⚠️） |
 * | `tickOnce()` 里的 `frame/38` | `update()` 的第一段 |
 *
 * ⚠️ **`mcG.userData.sfx = 'magic'` 必须留在 `build` 里**：`installProp` 的 aim 桥只在
 * `ud.sfx` **还不是字符串**时才补 `'toggle'` —— 写晚了（或搬到 `interactables` 之后）音效就变了。
 * 这与 `floor1/orrery` 的处置相同。
 *
 * ## ★ 帧顺序：`ptMc` 的平滑**提前**了，为什么等价
 *
 * 一件物件只有一个 `update`：几何分支在 `frame/38`，强度平滑在 `frame/94`
 * （`lightField.update` 是 `frame/97`）⇒ 本件选**几何分支的位置**（早）。论证与 `hangingLantern.js` 同款：
 *
 * 1. **数值序列完全相同**：一阶低通 `p += (目标 − p) × 0.055`，同帧同 `dt` 同输入 ⇒ 逐位相同；
 *    `grep mcRun` 的全部命中只有本物件（外加 `frame/97` 才被调用的 `lights()` 闭包）
 *    ⇒ **两位置之间没有任何读者或写者**；
 * 2. **仍然早于读者**：本 `update` 在 `frame/38` 位置，远早于 `frame/97`。
 *
 * ## 逐字搬运说明
 *
 * 几何与那段每帧分支**逐行相同**（只改缩进与状态前缀）：`ctx.mcRun` → `s.run`、
 * `ctx.ptMc` → `s.pt`、`ctx.mcXxx` → `parts.mcXxx` / 局部解构、`ctx.MC_X/MC_Z` → `L.MC_X/L.MC_Z`。
 * 全部数值（五道圆环 `0.72/0.68/0.55/0.36/0.14` 与各自段数、六芒/三芒多边形、
 * 12 根内刻度、24 组外刻度、6 处小圆、六层悬浮阵的 `ty/spd/ph` 与各自几何、
 * 24 个八面体 `0.016` 与配色表、命中面 `0.75/28` 与 `0.002` 的高度、
 * 强度曲线 `0.12 / 0.82 / 0.18`、旋转 `0.15 + 2.8×inten`、粒子上升 `2.5`、
 * 平滑系数 `0.055`、持续 `8.0` 秒）**一个没改**。
 *
 * ## ⚠️ `rng` 顺序（本件最需要盯的一处）
 *
 * `mcParts` 那 24 个八面体每个消耗 **4** 次 `floor1Rng()`（`a` / `r` / `ph` / `spd`）
 * ⇒ 共 **96 次**。它们发生在 `build` 内、位置即原区间 ⇒ **次数与顺序都没变**，
 * 后续随机数序列与画面不变（不变量 `N8`）。
 */
import * as THREE from 'three'
import { defineProp } from '../../app/defineProp.js'
import { createPointLightSource } from '../../core/lighting/PointLightSource.js'

export default defineProp({
  id: 'floor1/magic-circle',
  kind: 'decor',

  // `run` 是原来的 `let mcRun = 0`；`pt` 是原来的 `ctx.ptMc`（初值 `0`）。
  state: () => ({ run: 0, pt: 0 }),

  build({ scene, L, geo, edge, HITMAT, rng }) {
    const { MC_X, MC_Z } = L
    const floor1Rng = rng.floor1

    const mcG = new THREE.Group();
    mcG.position.set(MC_X, 0.015, MC_Z);
    scene.add(mcG);
    const mcMat = new THREE.LineBasicMaterial({ color: 0x8a4fd6, transparent: true, opacity: 0.55 });
    const mcLoop = (pts, parent, mat) => { const l = new THREE.LineLoop(geo(pts), mat || mcMat); parent.add(l); return l; };
    const mcBase = new THREE.Group();
    mcG.add(mcBase);
    {
        const ring = (r, seg) => { const p = []; for (let i = 0; i <= seg; i++) { const a = i / seg * Math.PI * 2; p.push([Math.cos(a) * r, 0, Math.sin(a) * r]); } return p; };
        const poly = (r, n, rot) => { const p = []; for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2 + rot; p.push([Math.cos(a) * r, 0, Math.sin(a) * r]); } return p; };
        const sc = (cx, cz, r) => { const p = []; for (let i = 0; i <= 10; i++) { const a = i / 10 * Math.PI * 2; p.push([cx + Math.cos(a) * r, 0, cz + Math.sin(a) * r]); } return p; };
        mcLoop(ring(0.72, 48), mcBase);
        mcLoop(ring(0.68, 48), mcBase);
        mcLoop(ring(0.55, 44), mcBase);
        mcLoop(ring(0.36, 40), mcBase);
        mcLoop(ring(0.14, 24), mcBase);
        mcLoop(poly(0.55, 6, 0), mcBase);
        mcLoop(poly(0.50, 3, -Math.PI / 2), mcBase);
        mcLoop(poly(0.50, 3, Math.PI / 2), mcBase);
        for (let i = 0; i < 12; i++) {
            const a = i / 12 * Math.PI * 2;
            mcBase.add(new THREE.Line(geo([[Math.cos(a) * 0.14, 0, Math.sin(a) * 0.14], [Math.cos(a) * 0.36, 0, Math.sin(a) * 0.36]]), mcMat));
        }
        for (let i = 0; i < 24; i++) {
            const a = i / 24 * Math.PI * 2;
            mcBase.add(new THREE.Line(geo([[Math.cos(a - 0.02) * 0.68, 0, Math.sin(a - 0.02) * 0.68], [Math.cos(a + 0.02) * 0.68, 0, Math.sin(a + 0.02) * 0.68]]), mcMat));
            mcBase.add(new THREE.Line(geo([[Math.cos(a) * 0.68, 0, Math.sin(a) * 0.68], [Math.cos(a) * 0.72, 0, Math.sin(a) * 0.72]]), mcMat));
        }
        for (let i = 0; i < 6; i++) {
            const a = i / 6 * Math.PI * 2;
            mcLoop(sc(Math.cos(a) * 0.62, Math.sin(a) * 0.62, 0.045), mcBase);
        }
    }
    const mcFloats = [];
    {
        const mkMat = c => new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0 });
        const ring = (r, seg) => { const p = []; for (let i = 0; i <= seg; i++) { const a = i / seg * Math.PI * 2; p.push([Math.cos(a) * r, 0, Math.sin(a) * r]); } return p; };
        const poly = (r, n, rot) => { const p = []; for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2 + rot; p.push([Math.cos(a) * r, 0, Math.sin(a) * r]); } return p; };
        {
            const g = new THREE.Group(); const m = mkMat(0xd84fd0);
            mcLoop(ring(0.30, 36), g, m);
            mcLoop(poly(0.27, 3, -Math.PI / 2), g, m);
            mcLoop(ring(0.10, 20), g, m);
            mcFloats.push({ g, m, ty: 0.80, spd: 1.5, ph: 0 });
        }
        {
            const g = new THREE.Group(); const m = mkMat(0x4f9bd8);
            mcLoop(poly(0.24, 6, 0), g, m);
            mcLoop(poly(0.16, 6, Math.PI / 6), g, m);
            for (let i = 0; i < 6; i++) {
                const a = i / 6 * Math.PI * 2;
                g.add(new THREE.Line(geo([[Math.cos(a) * 0.16, 0, Math.sin(a) * 0.16], [Math.cos(a) * 0.24, 0, Math.sin(a) * 0.24]]), m));
            }
            mcFloats.push({ g, m, ty: 1.25, spd: -1.1, ph: 1 });
        }
        {
            const g = new THREE.Group(); const m = mkMat(0xd8a84f);
            mcLoop(ring(0.26, 32), g, m);
            mcLoop(ring(0.18, 28), g, m);
            for (let i = 0; i < 8; i++) {
                const a = i / 8 * Math.PI * 2;
                g.add(new THREE.Line(geo([[Math.cos(a) * 0.08, 0, Math.sin(a) * 0.08], [Math.cos(a) * 0.26, 0, Math.sin(a) * 0.26]]), m));
            }
            mcFloats.push({ g, m, ty: 1.70, spd: 1.9, ph: 2 });
        }
        {
            const g = new THREE.Group(); const m = mkMat(0x4fd88a);
            const star = []; for (let i = 0; i <= 5; i++) { const a = (i * 2 / 5) * Math.PI * 2 - Math.PI / 2; star.push([Math.cos(a) * 0.26, 0, Math.sin(a) * 0.26]); }
            mcLoop(star, g, m);
            mcLoop(ring(0.26, 32), g, m);
            mcLoop(ring(0.10, 20), g, m);
            mcFloats.push({ g, m, ty: 2.10, spd: -1.6, ph: 3 });
        }
        {
            const g = new THREE.Group(); const m = mkMat(0x4fd8d8);
            mcLoop(poly(0.22, 4, 0), g, m);
            mcLoop(poly(0.22, 4, Math.PI / 4), g, m);
            mcLoop(ring(0.28, 32), g, m);
            mcFloats.push({ g, m, ty: 2.45, spd: 1.2, ph: 4 });
        }
        {
            const g = new THREE.Group(); const m = mkMat(0x9b4fd8);
            mcLoop(ring(0.34, 36), g, m);
            mcLoop(poly(0.30, 3, Math.PI / 2), g, m);
            mcLoop(ring(0.20, 28), g, m);
            mcFloats.push({ g, m, ty: 0.48, spd: 2.2, ph: 5 });
        }
        for (const f of mcFloats) { f.g.visible = false; mcG.add(f.g); }
    }
    const mcParts = [];
    {
        const cols = [0xd84fd0, 0x4f9bd8, 0xd8a84f, 0x8a4fd6, 0x4fd88a, 0x4fd8d8, 0x9b4fd8];
        for (let i = 0; i < 24; i++) {
            const m = new THREE.LineBasicMaterial({ color: cols[i % cols.length] });
            const p = edge(new THREE.OctahedronGeometry(0.016), 1, m);
            p.visible = false;
            scene.add(p);
            mcParts.push({
                p, a: floor1Rng() * Math.PI * 2, r: 0.15 + floor1Rng() * 0.55,
                ph: floor1Rng(), spd: 0.6 + floor1Rng() * 0.8
            });
        }
    }
    const mcHit = new THREE.Mesh(new THREE.CircleGeometry(0.75, 28), HITMAT);
    mcHit.rotation.x = -Math.PI / 2;
    mcHit.position.y = 0.002;
    mcG.add(mcHit);
    // ⚠️ 音效必须在 `build` 里写好：`installProp` 的 aim 桥只在 `ud.sfx` **非字符串**时才补 `'toggle'`
    mcG.userData.sfx = 'magic';

    return { root: mcG, parts: { mcG, mcMat, mcBase, mcFloats, mcParts, mcHit } }
  },

  /**
   * ★ 光源槽位 2 —— 取代 `world/lights.js` 里原来那一行注册。
   * `slot` 显式声明 ⇒ 槽序与装配时机无关（`J4.18` 契约）。
   * 位置 / 颜色 / 半径 / `yMin` / `yMax` 与搬迁前那一行**逐字相同**。
   */
  lights: (s, { L }) => [
    createPointLightSource({
      id: 'floor1/magic-circle', slot: 2,
      position: [L.MC_X, 0.36, L.MC_Z], color: 0x9b6fe8, radius: 5.2,
      strength: () => s.pt,
      yMin: 0.0, yMax: 3.04,
    }),
  ],

  // 原 `mcG` 上那条交互的等价声明（点一下开 8 秒魔法阵；已在跑就不重开 —— 与原实现同）。
  // 锚点与几何**同源**：`mcG.position` 的来源就是 `L.MC_X` / `L.MC_Z`（不变量 `N9`）。
  interactables: (s, { L, parts }) => [{
    id: 'magic-circle/cast',
    label: '在紫色魔法阵上施法',
    mode: 'both',
    anchor: { x: L.MC_X, z: L.MC_Z },
    radius: 1.8,
    hits: parts.mcG,
    onActivate: () => { if (s.run <= 0) s.run = 8.0 },
  }],

  /**
   * 原 `tickOnce()` 里的 `frame/38`（第一段）+ `frame/94` 的强度平滑（第二段）。
   * 分段与顺序**逐字保留**（合并理由见文件头 ★）。
   */
  update(dt, time, s, { L, parts }) {
    const { mcMat, mcBase, mcFloats, mcParts } = parts
    const { MC_X, MC_Z } = L

    /* ---- ㊳ 魔法阵的淡入 / 淡出、基座旋转、六层悬浮阵、24 个粒子 ---- */
    {
        if (s.run > 0) s.run -= dt;
        const prog = s.run > 0 ? 1 - s.run / 8.0 : 1;
        let inten = 0;
        if (s.run > 0) {
            if (prog < 0.12) inten = prog / 0.12;
            else if (prog < 0.82) inten = 1;
            else inten = 1 - (prog - 0.82) / 0.18;
        }
        mcMat.opacity = 0.5 + 0.5 * inten;
        mcBase.rotation.y += dt * (0.15 + 2.8 * inten);
        for (const f of mcFloats) {
            const ap = Math.min(Math.max((prog - (0.10 + f.ph * 0.07)) / 0.20, 0), 1);
            const show = s.run > 0 && ap > 0 && inten > 0.02;
            f.g.visible = show;
            if (show) {
                const e = ap * ap * (3 - 2 * ap);
                f.g.position.y = 0.05 + f.ty * e + Math.sin(time * 1.5 + f.ph) * 0.03;
                f.g.rotation.y += dt * f.spd;
                f.g.scale.setScalar(0.5 + 0.5 * e);
                f.m.opacity = 0.85 * inten * e;
            }
        }
        for (const q of mcParts) {
            const show = inten > 0.04;
            q.p.visible = show;
            if (show) {
                const pr = (q.ph + time * 0.35) % 1;
                const a = q.a + time * q.spd;
                q.p.position.set(MC_X + Math.cos(a) * q.r, 0.05 + pr * 2.5, MC_Z + Math.sin(a) * q.r);
                const scq = Math.sin(pr * Math.PI) * inten;
                q.p.scale.setScalar(Math.max(scq, 0.001));
                q.p.rotation.y = time * 2;
            }
        }
    }

    /* ---- ⑨④ 强度平滑（原 `tickOnce()` 末尾「室内点光源」那 5 行之一）----
     * ★ 原本排在 `frame/94`，合并到本 `update` 后**提前**执行 —— 等价性论证见文件头「★ 帧顺序」。 */
    s.pt += ((s.run > 0 ? 1 : 0) - s.pt) * 0.055;
  },
})
