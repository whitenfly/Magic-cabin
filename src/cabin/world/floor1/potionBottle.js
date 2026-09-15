/**
 * 12.3 魔法药剂瓶 —— `J3` 搬迁（B4：几何 + 状态 + 交互 + 每帧分支）
 *
 * 来源：`legacy/monolith.js` 原 `12.3` 分区（搬迁时 `L748–834`）的**几何段**，
 * 以及 `tickOnce()` 里那段**无注释**的每帧分支（搬迁时 `L6695–6725`，紧跟星象仪那 10 行之后、
 * `bookP += …` 之前）。
 *
 * ## 搬迁对照
 *
 * | 原来住哪 | 现在住哪 |
 * |---|---|
 * | 顶层 `let corkOut = false, corkT = 0` | `state: () => ({ corkOut: false, corkT: 0 })`（**变量名一个没改**） |
 * | 顶层 `const potG / corkG / potBubbles / CORK_M / CORK_L` | `build()` 内的同名局部量，经 `parts` 交出（**同一批实例**） |
 * | 顶层 `function updateLiquid(time)` | `build()` 内的同名局部函数（函数体一字未改，闭包换成 `state`） |
 * | 行内 `MTX + 0.05` / `MTZ + 0.24` / `MTTOP` | 仍是同一个表达式，`MTX/MTZ/MTTOP` 从 `world/layout.js` 解构（`N9`，数值一个没改） |
 * | `regMagic(potG, …)` / `regMagic(corkG, …)` | 合成 `interactables()` 一条（两处回调体**完全相同**，见下） |
 * | `tickOnce()` 里那 31 行 | `update()`，由 `tickOnce()` **原位置**调用 `potionBottleApi.tick(dt, time)` |
 *
 * ## ★ `updateLiquid` 为什么用 `parts` 交出
 *
 * 它同时读**状态**（`corkOut`）与**几何**（`liquidGeom` / `liquidGeom2` / `waterMat` / `LIQ_Y`）——
 * 搬到模块作用域就必须改函数体（违反"原样搬运"），留在 `build` 里又够不着。
 * 于是照 `broom` / `stools` / `doorHangBar` 的既有做法：**`build` 里的东西经 `parts` 交给 `update`**，
 * 函数体一字未改。`build` 从装配环境里取 `state`（`installProp` 在调 `build` 之前就写好了 `env.state`）。
 *
 * ## 两条 `regMagic` 合成一条
 *
 * 原实现是 `regMagic(potG, …)` 与 `regMagic(corkG, …)`，**两处回调体一字不差**
 * （都是 `corkOut = !corkOut`）。合并为一条交互有两个理由：
 *   ① `installProp` 的准星通路只给 `root`（= `potG`）注册命中体，`corkG` 本来就拿不到独立准星入口；
 *   ② 近距列表按注册顺序出提示，两条同义条目会让玩家看到重复文案。
 * 代价：软木塞本体不再单独作为准星目标（原先是）。与 `stools` 的多入口处理同源。
 *
 * 不用 `rng` 之外的随机源；`floor1Rng()` 在原位置仅被调用 4 次（4 个气泡的 `wob`），
 * 次数与顺序都没变 ⇒ 后续随机数序列与画面不变。
 */
import * as THREE from 'three'
import { defineProp } from '../../app/defineProp.js'

export default defineProp({
  id: 'floor1/potion-bottle',
  kind: 'decor',

  state: () => ({ corkOut: false, corkT: 0 }),

  // `state` 在这里绑成 `st`（不是 `s`）：本段原码里 `const c = Math.cos(ang), s = Math.sin(ang);`
  // 用了 `s` 这个名字，保持它原样，改名的是状态绑定
  build({ scene, L, put, line, edge, lloop, rng, state: st }) {
    const { MTX, MTZ, MTTOP } = L
    const floor1Rng = rng.floor1

    const PX = MTX + 0.05, PZ = MTZ + 0.24;
    const potG = new THREE.Group();
    potG.position.set(PX, MTTOP, PZ);
    const PROF = [[0.018, 0.038], [0.035, 0.062], [0.05, 0.076], [0.065, 0.085], [0.08, 0.089],
    [0.10, 0.090], [0.12, 0.086], [0.14, 0.075], [0.16, 0.056], [0.178, 0.034], [0.19, 0.026]];
    for (const [yy, rr] of PROF) {
        const pts = [];
        for (let i = 0; i <= 20; i++) { const a = i / 20 * Math.PI * 2; pts.push([Math.cos(a) * rr, yy, Math.sin(a) * rr]); }
        lloop(pts, potG);
    }
    for (const ang of [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4]) {
        const c = Math.cos(ang), s = Math.sin(ang);
        const pts = PROF.map(([yy, rr]) => [c * rr, yy, s * rr]);
        put(line(pts), 0, 0, 0, 0, 0, 0, potG);
    }
    put(edge(new THREE.CylinderGeometry(0.024, 0.024, 0.055, 8)), 0, 0.228, 0, 0, 0, 0, potG);
    put(edge(new THREE.TorusGeometry(0.027, 0.006, 6, 14)), 0, 0.258, 0, Math.PI / 2, 0, 0, potG);

    const LIQ_Y = 0.078;
    const waterMat = new THREE.MeshBasicMaterial({
        color: 0x5aa8dd, transparent: true, opacity: 0.34, depthWrite: false, side: THREE.DoubleSide
    });
    const waterBody = new THREE.Mesh(new THREE.SphereGeometry(0.082, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), waterMat);
    put(waterBody, 0, 0.006, 0, 0, 0, 0, potG);
    const waterDisc = new THREE.Mesh(new THREE.CircleGeometry(0.077, 20), waterMat);
    put(waterDisc, 0, LIQ_Y - 0.004, 0, -Math.PI / 2, 0, 0, potG);
    const liquidMat = new THREE.LineBasicMaterial({ color: 0x2e6fa3 });
    const liquidMat2 = new THREE.LineBasicMaterial({ color: 0x7db8dd });
    const liquidGeom = new THREE.BufferGeometry();
    liquidGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(24 * 3), 3));
    const liquidLoop = new THREE.LineLoop(liquidGeom, liquidMat);
    liquidLoop.frustumCulled = false;
    potG.add(liquidLoop);
    const liquidGeom2 = new THREE.BufferGeometry();
    liquidGeom2.setAttribute('position', new THREE.BufferAttribute(new Float32Array(24 * 3), 3));
    const liquidLoop2 = new THREE.LineLoop(liquidGeom2, liquidMat2);
    liquidLoop2.frustumCulled = false;
    potG.add(liquidLoop2);
    scene.add(potG);

    function updateLiquid(time) {
        const arr = liquidGeom.attributes.position.array;
        const amp = st.corkOut ? 0.007 : 0.0025;
        const spd = st.corkOut ? 3.2 : 1.1;
        for (let i = 0; i < 24; i++) {
            const a = i / 24 * Math.PI * 2;
            const rr = 0.080 + Math.sin(a * 3 + time * spd) * amp;
            arr[i * 3] = Math.cos(a) * rr;
            arr[i * 3 + 1] = LIQ_Y + Math.sin(a * 3 - time * spd * 1.3) * amp * 0.6;
            arr[i * 3 + 2] = Math.sin(a) * rr;
        }
        liquidGeom.attributes.position.needsUpdate = true;
        const arr2 = liquidGeom2.attributes.position.array;
        for (let i = 0; i < 24; i++) {
            const a = i / 24 * Math.PI * 2;
            const rr = 0.072 + Math.sin(a * 3 + time * spd + 1.2) * amp * 0.7;
            arr2[i * 3] = Math.cos(a) * rr;
            arr2[i * 3 + 1] = LIQ_Y - 0.003 + Math.sin(a * 3 - time * spd * 1.3 + 0.8) * amp * 0.4;
            arr2[i * 3 + 2] = Math.sin(a) * rr;
        }
        liquidGeom2.attributes.position.needsUpdate = true;
        waterMat.opacity = st.corkOut ? 0.38 : 0.32;
    }

    const CORK_M = [PX, MTTOP + 0.29, PZ];
    const CORK_L = [PX + 0.17, MTTOP + 0.018, PZ - 0.07];
    const corkG = new THREE.Group();
    put(edge(new THREE.CylinderGeometry(0.021, 0.024, 0.038, 8)), 0, 0, 0, 0, 0, 0, corkG);
    put(line([[0, 0.014, 0.022], [0, -0.008, 0.023]]), 0, 0, 0, corkG);
    corkG.position.set(CORK_M[0], CORK_M[1], CORK_M[2]);
    scene.add(corkG);

    const bubbleMat = new THREE.LineBasicMaterial({ color: 0x2e6fa3 });
    const potBubbles = [];
    for (let i = 0; i < 4; i++) {
        const b = edge(new THREE.SphereGeometry(0.009, 6, 5), 1, bubbleMat);
        b.userData.phase = i / 4;
        b.userData.wob = floor1Rng() * 6.28;
        b.visible = false;
        scene.add(b);
        potBubbles.push(b);
    }

    // 每帧分支要逐气泡 / 逐液面改写几何，`updateLiquid` 又要同时看状态与几何 —— 全部经 `parts` 交出
    return {
      root: potG,
      parts: { bottle: potG, cork: corkG, bubbles: potBubbles, updateLiquid, PX, PZ, CORK_M, CORK_L },
    }
  },

  // 原两处 `regMagic`（`potG` / `corkG`）的回调体完全一致，故合并为一条（理由见文件头）。
  // 主入口同时给 aim（准星）与 proximity（近距）两条 —— 否则默认固定视角下点不开（风险 `R1`）
  interactables: (s, { L }) => [{
    id: 'potion-bottle/uncork',
    label: '拔出 / 塞回魔法药剂瓶的软木塞',
    mode: 'both',
    // 锚点与几何同源：都取自 `L.MTX / L.MTZ` 的同一对偏移（不变量 N9）
    anchor: { x: L.MTX + 0.05, z: L.MTZ + 0.24 },
    radius: 1.4,
    onActivate: () => { s.corkOut = !s.corkOut; },
  }],

  /** 原 `tickOnce()` 里那段**无注释**的分支（搬迁时 `L6695–6725`），逐字搬运 */
  update(dt, time, s, { parts, L }) {
    const { updateLiquid, bubbles: potBubbles, cork: corkG, PX, PZ, CORK_M, CORK_L } = parts
    const { MTTOP } = L

    updateLiquid(time);
    for (const b of potBubbles) {
        b.visible = s.corkOut;
        if (s.corkOut) {
            const prog = (time * 0.5 + b.userData.phase) % 1;
            b.position.set(PX + Math.sin(prog * 9 + b.userData.wob) * 0.018,
                MTTOP + 0.012 + prog * 0.052,
                PZ + Math.cos(prog * 7 + b.userData.wob) * 0.018);
            const sc = 0.55 + prog * 0.95;
            b.scale.set(sc, sc, sc);
        }
    }

    s.corkT += ((s.corkOut ? 1 : 0) - s.corkT) * 0.022;
    {
        const raw = Math.min(Math.max(s.corkT, 0), 1);
        const tC = raw * raw * (3 - 2 * raw);
        let cx, cy, cz;
        if (tC < 0.5) {
            const u = tC / 0.5;
            cx = CORK_M[0]; cz = CORK_M[2];
            cy = CORK_M[1] + u * 0.20;
        } else {
            const u = (tC - 0.5) / 0.5;
            cx = CORK_M[0] + (CORK_L[0] - CORK_M[0]) * u;
            cz = CORK_M[2] + (CORK_L[2] - CORK_M[2]) * u;
            cy = (CORK_M[1] + 0.20) - u * ((CORK_M[1] + 0.20) - CORK_L[1]);
        }
        corkG.position.set(cx, cy, cz);
        corkG.rotation.z = Math.sin(tC * Math.PI) * 0.45;
    }
  },
})
