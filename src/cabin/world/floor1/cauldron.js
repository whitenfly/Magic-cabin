/**
 * 12.9e 大魔女坩埚 —— `J3` 搬迁（B4：几何 + 状态 + 交互 + 每帧分支）
 *
 * 来源：`legacy/monolith.js` 原 `12.9e` 分区（搬迁时 `L1083–1174`）的**几何段**，
 * 以及 `tickOnce()` 里 `/* ---- 大魔女坩埚 ---- *\/` 那段每帧分支（搬迁时 `L7160–7199`）。
 *
 * ## 搬迁对照
 *
 * | 原来住哪 | 现在住哪 |
 * |---|---|
 * | 顶层 `let stirRun = 0, stirAng = 0, bubbleI = 0.3` | `state: () => ({ … })`（**变量名一个没改**） |
 * | 顶层 `const cauldronG / stirG / stickAsm / calSurfGeom / calBubbles / calWavy / calGlowMat / CAL_UP` | `build()` 内的同名局部量，经 `parts` **同名**交出 |
 * | `CCX` / `CCZ` | `world/layout.js` 的坐标表（不变量 `N9`，数值一个没改） |
 * | `regMagic(cauldronG, () => { stirRun = 4.5; })` | `interactables()`（`label` 语义化 + `mode: 'both'`，消解风险 `R1`） |
 * | `tickOnce()` 里那 40 行 | `update()`，由 `tickOnce()` **原位置**调用 `cauldronApi.tick(dt, time)` |
 *
 * ## ★ 为什么含"火"却能搬：光源槽位没有被碰
 *
 * `lightField.register(…)` 的注册顺序 = shader 闪烁相位 `float(i)` 的槽位，
 * 而坩埚那一盏（`floor1/cauldron-fire`，`monolith` 里注册的第 2 个 = 槽位 1）**不在本文件里**，
 * 也不在本次搬迁的区间里 —— 本件一个字节都没动它。它之所以不受影响，是因为：
 *   · 它的 `strength` 是**常量 `0.92`**（不是 `() => ptXxx` 那种闭包），压根不读本件的状态；
 *   · `tickOnce()` 末尾那 5 行「室内点光源」只读 `lanternLit / kotatsuOn / mcRun / cbRun / plantRun`，
 *     **没有一行读 `stirRun`**（那一段的注释里出现的"坩埚"只是标题）。
 * 于是搬走本件后：注册顺序不变（仍 8 盏 / 8 个槽位）、强度序列不变 ⇒ 画面逐字节不变。
 *
 * 火焰本身用的是共享工具 `makeWavyFlame` / `updateWavyFlame`（`ctx` 取，不复制实现）。
 * `floor1Rng()` 在原位置仅被调用 16 次（8 个气泡 × `br`/`ba`），次数与顺序都没变。
 */
import * as THREE from 'three'
import { defineProp } from '../../app/defineProp.js'

export default defineProp({
  id: 'floor1/cauldron',
  kind: 'furniture',

  state: () => ({ stirRun: 0, stirAng: 0, bubbleI: 0.3 }),

  build({ scene, L, put, edge, line, box, lloop, logBetween, FILL, makeWavyFlame, rng }) {
    const { CCX, CCZ } = L
    const floor1Rng = rng.floor1

    const STOVE_TOP = 0.58;
    const CAL_UP = 0.34;
    const cauldronG = new THREE.Group();
    cauldronG.position.set(CCX, 0, CCZ);
    scene.add(cauldronG);
    {
        const BN = 15, BR = 0.62;
        for (let course = 0; course < 4; course++) {
            const y = 0.075 + course * 0.145;
            const off = course % 2 ? Math.PI / BN : 0;
            for (let i = 0; i < BN; i++) {
                const a = i / BN * Math.PI * 2 + off;
                let da = Math.abs(a - (-Math.PI / 2));
                da = Math.min(da, Math.PI * 2 - da);
                if (da < 0.30) continue;
                const b = box(0.28, 0.13, 0.17);
                b.position.set(Math.cos(a) * BR, y, Math.sin(a) * BR);
                b.rotation.y = -a + Math.PI / 2;
                cauldronG.add(b);
            }
        }
        logBetween([-0.30, 0.12, -0.10], [0.30, 0.12, -0.14], 0.05, cauldronG);
        logBetween([-0.26, 0.12, 0.12], [0.28, 0.12, 0.08], 0.05, cauldronG);
        logBetween([-0.28, 0.18, -0.02], [0.30, 0.18, -0.06], 0.045, cauldronG);
        logBetween([0.10, 0.11, -0.30], [0.12, 0.09, -0.78], 0.045, cauldronG);
        const CPROF = [[0.08, 0.40], [0.20, 0.50], [0.34, 0.545], [0.48, 0.555], [0.62, 0.55], [0.74, 0.515], [0.86, 0.455], [0.94, 0.42]];
        const lathePts = [new THREE.Vector2(0.05, 0.08 + CAL_UP)];
        for (const [yy, rr] of CPROF) lathePts.push(new THREE.Vector2(rr, yy + CAL_UP));
        lathePts.push(new THREE.Vector2(0.38, 0.94 + CAL_UP));
        cauldronG.add(new THREE.Mesh(new THREE.LatheGeometry(lathePts, 28), FILL));
        for (const [yy, rr] of CPROF) {
            const pts = [];
            for (let i = 0; i <= 28; i++) { const a = i / 28 * Math.PI * 2; pts.push([Math.cos(a) * rr, yy + CAL_UP, Math.sin(a) * rr]); }
            lloop(pts, cauldronG);
        }
        for (const ang of [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4, Math.PI * 0.75, -Math.PI * 0.75]) {
            const c = Math.cos(ang), s = Math.sin(ang);
            put(line(CPROF.map(([yy, rr]) => [c * rr, yy + CAL_UP, s * rr])), 0, 0, 0, 0, 0, 0, cauldronG);
        }
        const rim = edge(new THREE.TorusGeometry(0.42, 0.04, 6, 32));
        rim.rotation.x = Math.PI / 2;
        put(rim, 0, 0.94 + CAL_UP, 0, 0, 0, 0, cauldronG);
        const calLiqMat = new THREE.MeshBasicMaterial({
            color: 0x4a7d4e, transparent: true, opacity: 0.42, depthWrite: false, side: THREE.DoubleSide
        });
        const calLiq = new THREE.Mesh(new THREE.CircleGeometry(0.37, 28), calLiqMat);
        calLiq.userData.noHit = true;
        put(calLiq, 0, 0.72 + CAL_UP, 0, -Math.PI / 2, 0, 0, cauldronG);
    }
    const calSurfMat = new THREE.LineBasicMaterial({ color: 0x2e5d38 });
    const calSurfGeom = new THREE.BufferGeometry();
    calSurfGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(28 * 3), 3));
    const calSurf = new THREE.LineLoop(calSurfGeom, calSurfMat);
    calSurf.frustumCulled = false;
    cauldronG.add(calSurf);
    const stirG = new THREE.Group();
    cauldronG.add(stirG);
    const stickAsm = new THREE.Group();
    stickAsm.position.set(0, 0, 0);
    stirG.add(stickAsm);
    logBetween([0.16, 0.96, 0], [0.30, 1.40, 0], 0.026, stickAsm);
    put(edge(new THREE.SphereGeometry(0.032, 8, 6)), 0.31, 1.44, 0, 0, 0, 0, stickAsm);
    const calFireOutMat = new THREE.LineBasicMaterial({ color: 0x3b6fd6 });
    const calFireMidMat = new THREE.LineBasicMaterial({ color: 0x6fa8ff });
    const calFireInMat = new THREE.LineBasicMaterial({ color: 0xcfe8ff });
    const calWavy = [];
    makeWavyFlame(CCX, CCZ, 0.13, 0.54, 0.21, calFireOutMat, 0.0, 2.6, calWavy);
    makeWavyFlame(CCX + 0.02, CCZ - 0.02, 0.13, 0.38, 0.13, calFireMidMat, 2.3, 3.1, calWavy);
    makeWavyFlame(CCX - 0.02, CCZ + 0.02, 0.13, 0.22, 0.06, calFireInMat, 4.1, 3.6, calWavy);
    makeWavyFlame(CCX - 0.22, CCZ + 0.14, 0.13, 0.34, 0.09, calFireOutMat, 1.2, 3.0, calWavy);
    makeWavyFlame(CCX + 0.23, CCZ - 0.15, 0.13, 0.30, 0.08, calFireOutMat, 3.4, 2.9, calWavy);
    makeWavyFlame(CCX - 0.10, CCZ - 0.40, 0.13, 0.44, 0.11, calFireOutMat, 5.0, 2.8, calWavy);
    makeWavyFlame(CCX + 0.12, CCZ - 0.41, 0.13, 0.40, 0.09, calFireMidMat, 0.8, 3.2, calWavy);
    const calGlowMat = new THREE.MeshBasicMaterial({
        color: 0x6fa8ff, transparent: true, opacity: 0.10, depthWrite: false, side: THREE.DoubleSide
    });
    const calGlow = new THREE.Mesh(new THREE.CircleGeometry(0.80, 28), calGlowMat);
    calGlow.userData.noHit = true;
    put(calGlow, 0, 0.014, 0, -Math.PI / 2, 0, 0, cauldronG);
    const calBubbles = [];
    for (let i = 0; i < 8; i++) {
        const b = edge(new THREE.SphereGeometry(0.026, 6, 5), 1, calSurfMat);
        b.userData.phase = i / 8;
        b.userData.br = 0.05 + floor1Rng() * 0.26;
        b.userData.ba = floor1Rng() * 6.28;
        scene.add(b);
        calBubbles.push(b);
    }

    // 每帧分支要逐气泡 / 逐液面改写几何，故按**原名**交出（`update` 侧一行同名解构即可照抄原块）
    return {
      root: cauldronG,
      parts: {
        cauldronG, stirG, stickAsm, calSurfGeom, calBubbles, calWavy, calGlowMat, CAL_UP,
      },
    }
  },

  // 原 `regMagic(cauldronG, () => { stirRun = 4.5; })` 的回调体逐字搬来（状态量加 `s.` 前缀）。
  // 主入口同时给 aim（准星）与 proximity（近距）两条 —— 否则默认固定视角下点不开（风险 `R1`）
  interactables: (s, { L }) => [{
    id: 'cauldron/stir',
    label: '搅一搅大魔女坩埚里的魔药',
    mode: 'both',
    // 锚点与几何同源：都取自 `L.CCX / L.CCZ`（`cauldronG.position`，不变量 N9）
    anchor: { x: L.CCX, z: L.CCZ },
    radius: 1.8,
    onActivate: () => { s.stirRun = 4.5; },
  }],

  /** 原 `tickOnce()` 里 `/* ---- 大魔女坩埚 ---- *\/` 那段分支，逐字搬运 */
  update(dt, time, s, { parts, L, updateWavyFlame }) {
    const { stirG, stickAsm, calSurfGeom, calBubbles, calWavy, calGlowMat, CAL_UP } = parts
    const { CCX, CCZ } = L

    if (s.stirRun > 0) s.stirRun -= dt;
    const active = s.stirRun > 0;
    const prog = active ? Math.min(Math.max(1 - s.stirRun / 4.5, 0), 1) : 0;
    const ramp = Math.min(prog / 0.16, 1);
    const down = Math.min(Math.max((prog - 0.72) / 0.28, 0), 1);
    const spdEnv = active ? ramp * (1 - down * down) : 0;
    s.stirAng += dt * (0.45 + 3.0 * spdEnv);
    stirG.rotation.y = s.stirAng;
    stickAsm.rotation.z = active ? Math.sin(time * 7) * 0.03 : Math.sin(time * 1.2) * 0.012;
    s.bubbleI += ((active ? 1 : 0.3) - s.bubbleI) * 0.0035;

    const arr = calSurfGeom.attributes.position.array;
    const amp = 0.008 + 0.02 * ((s.bubbleI - 0.3) / 0.7);
    for (let i = 0; i < 28; i++) {
        const a = i / 28 * Math.PI * 2;
        const rr = 0.37 + Math.sin(a * 3 + time * (active ? 2.2 : 1.4)) * amp * 0.8;
        arr[i * 3] = Math.cos(a) * rr;
        arr[i * 3 + 1] = 0.74 + CAL_UP + Math.sin(a * 3 - time * 1.8) * amp * 0.5;
        arr[i * 3 + 2] = Math.sin(a) * rr;
    }
    calSurfGeom.attributes.position.needsUpdate = true;

    for (const b of calBubbles) {
        const pr = (time * (0.40 + 0.50 * s.bubbleI) + b.userData.phase) % 1;
        const ba = b.userData.ba + time * 0.2;
        b.position.set(CCX + Math.cos(ba) * b.userData.br,
            0.74 + CAL_UP + pr * 0.14,
            CCZ + Math.sin(ba) * b.userData.br);
        const sc = (0.4 + pr * 1.3) * (pr < 0.85 ? 1 : (1 - pr) / 0.15);
        b.scale.setScalar(Math.max(sc, 0.001));
    }
    const calPW = 0.85 + 0.15 * Math.sin(time * 6.3);
    for (const f of calWavy) {
        f.obj.visible = true;
        updateWavyFlame(f, time, calPW);
    }
    calGlowMat.opacity = 0.07 + 0.05 * (0.5 + 0.5 * Math.sin(time * 6.3));
  },
})
