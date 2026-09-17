/**
 * 18.9 左墙中央的魔法杖（点击施法：飞起 → 展开魔法阵 → 生成元素造物 → 淡出 → 归位）
 * —— `J4.45` 升格 `defineProp`
 *
 * 来源：`legacy/monolith.js` 原 `18.9` 分区（`J4.44` 施工图 §1 记的 `install.js` L237–846，**610 行**）。
 * 它是任务 D **最大**的一件（`board` 336 行、`magic-book` 273 行）。
 *
 * ## ★ 本件高度内聚：16 个子块全部服务"施法"一件事
 *
 * 按 `J4.44` §1 的顺序逐字搬运：材质 · `woodPart` · `hookArcPts`（+ 两个挂钩）· 魔杖本体 ·
 * `wandGlowSphere` + `ELEMENTS`（六种元素）· 5 个几何工具 · `buildMagicCircle` ·
 * `makeSolidFlame` · `buildCreation`（六种造物）· `iceShard` · `makeRock` · `genBolt` ·
 * 水晶颜色/目标/瞄准四元数 · `wandState` + 交互 · `clearCast` · `updateWand2`（主状态机）。
 *
 * ⚠️ **不可分段搬迁**：`updateWand2` 引用几乎全部子块、`clearCast` 引用 `wandState`
 * ⇒ 切一半会让中间态无法通过 `tsc`（`J4.44` §0）。
 *
 * ## ★ `rng`：全部在**运行期**（不变量 `N8`）
 *
 * 本段共 9 处 `runtimeRng()`，**无一处在 `build` 期**：
 * `buildCreation` 的火星（`idx===0` 的 9 颗各 1 次，L479）、
 * `genBolt` 的球坐标 3 次 + 每段抖动 3 次（L645–657）、以及点击时抽元素 1 次（L746）。
 *
 * ⇒ **装配位置对随机数序列没有约束**（与 `board` 的 1020 次 `textureRng` 正相反）；
 * 但**点击之后的调用顺序必须逐字保持**（先抽 `idx` → `buildMagicCircle` → `buildCreation`…）。
 *
 * ## ★ `scene.add` / `scene.remove`
 *
 * | 时机 | 处 | 对象 |
 * |---|---|---|
 * | **`build` 期** | 3 处 | `hook` · `outline` · `wandG`（**顺序敏感，留在原位**）|
 * | **运行期** | 2 处 | `s.circleHolder` · `s.crea`（施法时加入）|
 * | **运行期** | 2 处 | 同上（`clearCast` 时移除）|
 *
 * ## `clock.now` → `s.now`
 *
 * 原 `wandState.t0 = clock.now`（仅一处）改为 `s.t0 = s.now`，`update` 第一行写 `s.now = time`
 * —— 与 `rubik` / `magicBook` / `board` 同法（事件在两帧之间执行 ⇒ 恒等）。
 *
 * ## `ctx` 导出的清理（`J4.44` §3 的读者核对结果）
 *
 * 18.9 段原先在 `ctx` 上挂了 **25 个键**；逐键 grep 全仓确认：
 * **唯一的外部读者只有 `FrameBody.js` 的 `ctx.updateWand2(time)`**，
 * 其余 24 个（含 `IDENTITY_Q` / `wGlow1` / `wGlow2` / `WAND_Y` / `WAND_REST` / `CAST_POS` 等）
 * **全部无外部读者** ⇒ 本件搬走后这些键**全部消失**，段导出清单再删 **11 项**。
 *
 * ## 逐字搬运说明
 *
 * 全部数值一个没改 —— 状态机的五段时长 `FLY 0.8 / GROW 0.5 / HOLD 2.3 / FADE 0.6 / RET 0.8`、
 * 六种元素的色值、六种造物的全部几何与动画公式、魔法阵的六套纹样、
 * `genBolt` 的 `nSeg 5` / `jitter 0.05` / `len 0.20 + rng×0.12` / 重生成间隔 `0.15`、
 * 三处 `lerp`/`slerp` 系数（`0.08` / `0.06` / `0.07`）等。
 */
import * as THREE from 'three'
import { defineProp } from '../../app/defineProp.js'

export default defineProp({
  id: 'floor2/wand',
  kind: 'decor',

  // 原来的 `wandState`（顶层 `ctx.wandState`）+ `now`（`clock.now` 的替身）
  state: () => ({
    phase: 'idle', t0: 0, idx: 0, el: null,
    circleHolder: null, circleSpin: null, crea: null,
    dir: new THREE.Vector3(1, 0, 0),
    now: 0,
  }),

  build({ scene, L, V, LITMAT, put, box, log, rng, jitterGeo, smooth, state: s }) {
    const { FY } = L
    const runtimeRng = rng.runtime

    const WAND_Y = FY + 1.18;
    const WAND_Z = 0;
    const HOOK_X = -3.72;
    const WAND_REST = V(HOOK_X, WAND_Y - 0.012, WAND_Z);
    const WAND_HOVER = V(-2.95, FY + 1.60, -0.10);
    const CAST_POS = V(-0.60, FY + 1.50, 0.15);
    const wandWoodMat = LITMAT(0xcaa273, { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    const wandDarkMat = LITMAT(0x8a6238, { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    const wandEdgeMat = new THREE.LineBasicMaterial({ color: 0x5a4128 });

    function woodPart(g, mat) {
        const grp = new THREE.Group();
        grp.add(new THREE.Mesh(g, mat || wandWoodMat));
        grp.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, 20), wandEdgeMat));
        return grp;
    }
    const hookArcPts = [];
    for (let k = 0; k <= 22; k++) {
        const a = Math.PI * 0.75 + k / 22 * Math.PI * 1.5;
        hookArcPts.push(V(Math.cos(a) * 0.058, Math.sin(a) * 0.058, 0));
    }
    for (const hz of [WAND_Z - 0.30, WAND_Z + 0.30]) {
        put(box(0.03, 0.18, 0.08), -3.865, WAND_Y, hz);
        put(log(0.15, 0.013), -3.79, WAND_Y, hz, 0, 0, Math.PI / 2);
        const hook = woodPart(new THREE.TorusGeometry(0.058, 0.011, 6, 16, Math.PI * 1.5), wandDarkMat);
        hook.position.set(HOOK_X, WAND_Y, hz);
        hook.rotation.z = Math.PI * 0.75;
        scene.add(hook);
        const outline = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(hookArcPts), wandEdgeMat);
        outline.position.set(HOOK_X, WAND_Y, hz);
        scene.add(outline);
    }
    const wandG = new THREE.Group();
    wandG.position.copy(WAND_REST);
    scene.add(wandG);
    {
        const main = woodPart(new THREE.CylinderGeometry(0.014, 0.022, 0.72, 10));
        main.rotation.x = Math.PI / 2;
        main.position.z = 0.00;
        wandG.add(main);
        const tip = woodPart(new THREE.CylinderGeometry(0.008, 0.014, 0.30, 10));
        tip.rotation.x = Math.PI / 2;
        tip.position.z = 0.51;
        wandG.add(tip);
        const knob = woodPart(new THREE.SphereGeometry(0.034, 10, 8), wandDarkMat);
        knob.position.z = -0.40;
        wandG.add(knob);
        const guard = woodPart(new THREE.TorusGeometry(0.030, 0.008, 6, 14), wandDarkMat);
        guard.position.z = -0.28;
        wandG.add(guard);
    }
    const crystalG = new THREE.Group();
    crystalG.position.set(0, 0, 0.78);
    wandG.add(crystalG);
    const cryGeo = new THREE.OctahedronGeometry(0.055);
    cryGeo.scale(0.8, 0.8, 1.9);
    const crystalMat = new THREE.MeshBasicMaterial({ color: 0xd8dce0, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    crystalG.add(new THREE.Mesh(cryGeo, crystalMat));
    crystalG.add(new THREE.LineSegments(new THREE.EdgesGeometry(cryGeo, 1), new THREE.LineBasicMaterial({ color: 0x8a9096 })));
    const cryCore = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false }));
    crystalG.add(cryCore);

    function wandGlowSphere(r, op) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), new THREE.MeshBasicMaterial({ color: 0xd8dce0, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false }));
        m.scale.set(0.8, 0.8, 1.5);
        m.renderOrder = 9;
        crystalG.add(m);
        return m;
    }
    const wGlow1 = wandGlowSphere(0.070, 0.15);
    const wGlow2 = wandGlowSphere(0.13, 0.05);
    const ELEMENTS = [
        { nm: 'fire', col: 0xff5a2a, glow: 0xff9a4a },
        { nm: 'water', col: 0x3c8aff, glow: 0x8fd4ff },
        { nm: 'ice', col: 0xaef0ff, glow: 0xe8fcff },
        { nm: 'earth', col: 0xc08a4a, glow: 0xe0b070 },
        { nm: 'bolt', col: 0xffe94a, glow: 0xfff8a0 },
        { nm: 'wind', col: 0x7dffb8, glow: 0xd0ffe4 }
    ];
    const loopLine = (pts, m) => new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), m);
    const openLine = (pts, m) => new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), m);

    function ringPts2(r, n) {
        const a = [];
        for (let i = 0; i < n; i++) {
            const t = i / n * Math.PI * 2;
            a.push(V(Math.cos(t) * r, Math.sin(t) * r, 0));
        }
        return a;
    }

    function polyPts2(r, k, rot) {
        const a = [];
        for (let i = 0; i < k; i++) {
            const t = rot + i / k * Math.PI * 2;
            a.push(V(Math.cos(t) * r, Math.sin(t) * r, 0));
        }
        return a;
    }

    function starPts2(rO, rI, k, rot) {
        const a = [];
        for (let i = 0; i < k * 2; i++) {
            const t = rot + i / (k * 2) * Math.PI * 2;
            const r = i % 2 === 0 ? rO : rI;
            a.push(V(Math.cos(t) * r, Math.sin(t) * r, 0));
        }
        return a;
    }

    function spiralPts2(rMax, turns, n, rot) {
        const a = [];
        for (let i = 0; i <= n; i++) {
            const t = i / n;
            const ang = rot + t * turns * Math.PI * 2;
            a.push(V(Math.cos(ang) * t * rMax, Math.sin(ang) * t * rMax, 0));
        }
        return a;
    }

    function buildMagicCircle(el, idx) {
        const g = new THREE.Group();
        const m1 = new THREE.LineBasicMaterial({ color: el.col, transparent: true, opacity: 0.95 });
        const m2 = new THREE.LineBasicMaterial({ color: el.glow, transparent: true, opacity: 0.55 });
        m1.userData.op = 0.95;
        m2.userData.op = 0.55;
        g.add(loopLine(ringPts2(0.50, 56), m1));
        g.add(loopLine(ringPts2(0.44, 56), m2));
        g.add(loopLine(ringPts2(0.30, 48), m2));
        const tick = [];
        for (let i = 0; i < 24; i++) {
            const a = i / 24 * Math.PI * 2;
            tick.push(
                V(Math.cos(a) * 0.44, Math.sin(a) * 0.44, 0),
                V(Math.cos(a) * 0.50, Math.sin(a) * 0.50, 0)
            );
        }
        g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(tick), m2));
        if (idx === 0) {
            g.add(loopLine(polyPts2(0.36, 3, -Math.PI / 2), m1));
            g.add(loopLine(polyPts2(0.20, 3, Math.PI / 2), m2));
        } else if (idx === 1) {
            g.add(loopLine(polyPts2(0.36, 6, 0), m1));
            g.add(loopLine(ringPts2(0.18, 32), m1));
        } else if (idx === 2) {
            g.add(loopLine(polyPts2(0.36, 3, 0), m1));
            g.add(loopLine(polyPts2(0.36, 3, Math.PI), m1));
        } else if (idx === 3) {
            g.add(loopLine(polyPts2(0.34, 4, Math.PI / 4), m1));
            g.add(loopLine(polyPts2(0.34, 4, 0), m2));
        } else if (idx === 4) {
            g.add(loopLine(starPts2(0.38, 0.15, 5, -Math.PI / 2), m1));
        } else {
            g.add(openLine(spiralPts2(0.40, 2.2, 90, 0), m1));
            g.add(openLine(spiralPts2(0.40, 2.2, 90, Math.PI), m2));
        }
        g.userData.mats = [m1, m2];
        return g;
    }

    function makeSolidFlame(h, w, color, phase, speed) {
        const K = 20;
        const geom = new THREE.BufferGeometry();
        const pos = new Float32Array((K + 1) * 2 * 3);
        geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const idx = [];
        for (let k = 0; k < K; k++) {
            const a = k * 2, b = k * 2 + 1, c = k * 2 + 2, d = k * 2 + 3;
            idx.push(a, b, c, b, d, c);
        }
        geom.setIndex(idx);
        const mat = new THREE.MeshBasicMaterial({ color: color, depthWrite: false, side: THREE.DoubleSide });
        const grp = new THREE.Group();
        for (let i = 0; i < 3; i++) {
            const mesh = new THREE.Mesh(geom, mat);
            mesh.rotation.y = i * Math.PI / 3;
            mesh.frustumCulled = false;
            grp.add(mesh);
        }
        const f = { mesh: grp, geom: geom, h: h, w: w, phase: phase, speed: speed, K: K };
        f.update = time => {
            const p = pos;
            let i = 0;
            for (let k = 0; k <= K; k++) {
                const t = k / K;
                const ww = w * Math.sin(Math.PI * (0.16 + 0.84 * t));
                const wob = Math.sin(t * 5.2 - time * speed + phase) * 0.03 * t;
                const y = -0.14 + t * h;
                p[i++] = wob + ww;
                p[i++] = y;
                p[i++] = 0;
                p[i++] = wob - ww;
                p[i++] = y;
                p[i++] = 0;
            }
            geom.attributes.position.needsUpdate = true;
        };
        return f;
    }

    function buildCreation(idx, el) {
        const g = new THREE.Group();
        const A = (col, op) => new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false });
        if (idx === 0) {
            const fOut = makeSolidFlame(0.46, 0.115, 0xc23c10, 0.0, 2.6);
            const fMid = makeSolidFlame(0.36, 0.080, 0xff7a1a, 2.3, 3.1);
            const fIn = makeSolidFlame(0.24, 0.045, 0xffd868, 4.1, 3.6);
            g.add(fOut.mesh);
            g.add(fMid.mesh);
            g.add(fIn.mesh);
            const embers = [];
            for (let i = 0; i < 9; i++) {
                const e = new THREE.Mesh(new THREE.OctahedronGeometry(0.014), A(0xff8c3a, 0.9));
                e.userData.ph = i / 9;
                e.userData.rd = runtimeRng() * 0.09;
                g.add(e);
                embers.push(e);
            }
            g.userData.update = time => {
                fOut.update(time);
                fMid.update(time);
                fIn.update(time);
                for (const e of embers) {
                    const p = (time * 0.85 + e.userData.ph) % 1;
                    const a = e.userData.ph * 6.28;
                    e.position.set(
                        Math.cos(a) * e.userData.rd * (1 - p),
                        -0.08 + p * 0.48,
                        Math.sin(a) * e.userData.rd * (1 - p)
                    );
                    const sc = (1 - p) * 0.9 + 0.12;
                    e.scale.set(sc, sc, sc);
                }
            };
        } else if (idx === 1) {
            const wOuter = new THREE.MeshBasicMaterial({ color: 0x2f7fe8, transparent: true, opacity: 0.55 });
            const wInner = new THREE.MeshBasicMaterial({ color: 0x9cc4ec, transparent: true, opacity: 0.60 });
            const main = new THREE.Group();
            main.add(new THREE.Mesh(new THREE.SphereGeometry(0.10, 14, 12), wOuter));
            main.add(new THREE.Mesh(new THREE.SphereGeometry(0.082, 12, 10), wInner));
            g.add(main);
            const hi1 = new THREE.Mesh(new THREE.SphereGeometry(0.020, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }));
            hi1.position.set(-0.038, 0.042, 0.052);
            g.add(hi1);
            const hi2 = new THREE.Mesh(new THREE.SphereGeometry(0.010, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }));
            hi2.position.set(-0.018, 0.085, 0.030);
            g.add(hi2);
            const drops = [];
            for (let i = 0; i < 6; i++) {
                const d = new THREE.Group();
                d.add(new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 8), wOuter));
                d.add(new THREE.Mesh(new THREE.SphereGeometry(0.020, 8, 6), wInner));
                const dh = new THREE.Mesh(new THREE.SphereGeometry(0.006, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }));
                dh.position.set(-0.010, 0.011, 0.014);
                d.add(dh);
                d.userData.ph = i / 6;
                g.add(d);
                drops.push(d);
            }
            g.userData.update = time => {
                const sq = 0.05 * Math.sin(time * 3.2);
                main.scale.set(1 - sq, 1 + sq, 1 - sq);
                main.rotation.y += 0.012;
                const hs = 1 - sq * 0.5;
                hi1.scale.set(hs, hs, hs);
                hi2.scale.set(hs, hs, hs);
                for (const d of drops) {
                    const a = time * 1.5 + d.userData.ph * 6.28;
                    const wob = 0.20 + 0.03 * Math.sin(time * 2 + d.userData.ph * 9);
                    d.position.set(Math.cos(a) * wob, Math.sin(a * 2 + d.userData.ph) * 0.09, Math.sin(a) * wob);
                    d.scale.setScalar(0.85 + 0.3 * Math.abs(Math.sin(a * 2)));
                }
            };
        } else if (idx === 2) {
            function iceShard(r, h, tilt) {
                const sg = new THREE.Group();
                const mat = new THREE.MeshBasicMaterial({ color: 0xc8f4ff, transparent: true, opacity: 0.72, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
                const eMat = new THREE.LineBasicMaterial({ color: 0xeafcff, transparent: true, opacity: 0.85 });
                const bodyG = new THREE.CylinderGeometry(r, r, h, 6);
                sg.add(new THREE.Mesh(bodyG, mat));
                sg.add(new THREE.LineSegments(new THREE.EdgesGeometry(bodyG, 20), eMat));
                const capG = new THREE.ConeGeometry(r, r * 1.6, 6);
                const cap = new THREE.Mesh(capG, mat);
                cap.position.y = h / 2 + r * 0.8;
                sg.add(cap);
                const capEdge = new THREE.LineSegments(new THREE.EdgesGeometry(capG, 20), eMat);
                capEdge.position.y = h / 2 + r * 0.8;
                sg.add(capEdge);
                const botG = new THREE.ConeGeometry(r, r * 1.0, 6);
                const bot = new THREE.Mesh(botG, mat);
                bot.position.y = -h / 2 - r * 0.5;
                bot.rotation.z = Math.PI;
                sg.add(bot);
                const botEdge = new THREE.LineSegments(new THREE.EdgesGeometry(botG, 20), eMat);
                botEdge.position.y = -h / 2 - r * 0.5;
                botEdge.rotation.z = Math.PI;
                sg.add(botEdge);
                if (tilt) {
                    sg.rotation.z = tilt[0];
                    sg.rotation.x = tilt[1];
                }
                return sg;
            }
            const main = iceShard(0.052, 0.24);
            g.add(main);
            const subs = [];
            for (let i = 0; i < 4; i++) {
                const a = i / 4 * Math.PI * 2 + 0.5;
                const sub = iceShard(0.026, 0.13 + (i % 2) * 0.05, [Math.cos(a) * 0.55, Math.sin(a) * 0.55]);
                sub.position.set(Math.cos(a) * 0.10, -0.06, Math.sin(a) * 0.10);
                g.add(sub);
                subs.push(sub);
            }
            const sparkles = [];
            for (let i = 0; i < 5; i++) {
                const sp = new THREE.Mesh(new THREE.OctahedronGeometry(0.011), A(0xffffff, 0.9));
                sp.userData.ph = i / 5;
                g.add(sp);
                sparkles.push(sp);
            }
            g.userData.update = time => {
                g.rotation.y += 0.008;
                for (const sub of subs) sub.rotation.y += 0.02;
                for (const sp of sparkles) {
                    const a = time * 0.6 + sp.userData.ph * 6.28;
                    sp.position.set(Math.cos(a) * 0.19, 0.05 + Math.sin(a * 1.7) * 0.10, Math.sin(a) * 0.19);
                    sp.material.opacity = 0.3 + 0.7 * Math.abs(Math.sin(time * 5 + sp.userData.ph * 8));
                    const k = 0.7 + 0.5 * Math.abs(Math.sin(time * 4 + sp.userData.ph * 7));
                    sp.scale.set(k, k, k);
                }
            };
        } else if (idx === 3) {
            const rockMat = LITMAT(0x9a6c3c, { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
            const rockEdgeMat = new THREE.LineBasicMaterial({ color: 0x5a3c1e, transparent: true, opacity: 0.8 });

            function makeRock(r, amp) {
                const rg = jitterGeo(new THREE.IcosahedronGeometry(r, 0), amp);
                const rm = new THREE.Mesh(rg, rockMat);
                rm.add(new THREE.LineSegments(new THREE.EdgesGeometry(rg, 5), rockEdgeMat));
                return rm;
            }
            const rock = makeRock(0.13, 0.03);
            g.add(rock);
            const rocks = [];
            for (let i = 0; i < 4; i++) {
                const r = makeRock(0.045, 0.014);
                r.userData.ph = i / 4;
                g.add(r);
                rocks.push(r);
            }
            g.userData.update = time => {
                rock.rotation.y += 0.010;
                rock.rotation.x += 0.004;
                for (const r of rocks) {
                    const a = time * 0.5 + r.userData.ph * 6.28;
                    r.position.set(Math.cos(a) * 0.23, Math.sin(a * 2 + r.userData.ph) * 0.07, Math.sin(a) * 0.23);
                    r.rotation.x += 0.02;
                    r.rotation.y += 0.015;
                }
            };
        } else if (idx === 4) {
            const core = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), A(0xffe94a, 0.95));
            const glow1 = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), A(0xfff8a0, 0.30));
            const glow2 = new THREE.Mesh(new THREE.SphereGeometry(0.20, 12, 10), A(0xffe94a, 0.12));
            g.add(core);
            g.add(glow1);
            g.add(glow2);
            const boltMatW = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 });
            const boltMatY = new THREE.LineBasicMaterial({ color: 0xffe94a, transparent: true, opacity: 0.70 });
            const bolts = [];
            const NB = 5;
            for (let i = 0; i < NB; i++) {
                const lw = new THREE.Line(new THREE.BufferGeometry(), boltMatW);
                const ly = new THREE.Line(new THREE.BufferGeometry(), boltMatY);
                g.add(lw);
                g.add(ly);
                bolts.push({ w: lw, y: ly });
            }

            function genBolt(pair) {
                const th = runtimeRng() * Math.PI * 2;
                const ph = Math.acos(2 * runtimeRng() - 1);
                const dir = V(Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th));
                const len = 0.20 + runtimeRng() * 0.12;
                const pts = [dir.clone().multiplyScalar(0.05)];
                const nSeg = 5;
                for (let k = 1; k <= nSeg; k++) {
                    const t = k / nSeg;
                    const jitter = 0.05 * (1 - t * 0.5);
                    const p = dir.clone().multiplyScalar(0.05 + t * len);
                    p.x += (runtimeRng() - 0.5) * jitter * 2;
                    p.y += (runtimeRng() - 0.5) * jitter * 2;
                    p.z += (runtimeRng() - 0.5) * jitter * 2;
                    pts.push(p);
                }
                pair.w.geometry.dispose();
                pair.w.geometry = new THREE.BufferGeometry().setFromPoints(pts);
                pair.y.geometry.dispose();
                pair.y.geometry = new THREE.BufferGeometry().setFromPoints(pts.map(p => p.clone().multiplyScalar(0.86)));
            }
            for (const b of bolts) genBolt(b);
            let last = 0;
            g.userData.update = time => {
                if (time - last > 0.15) {
                    last = time;
                    for (const b of bolts) genBolt(b);
                }
                const f = Math.abs(Math.sin(time * 22));
                core.scale.setScalar(1 + 0.15 * f);
                glow1.material.opacity = 0.18 + 0.20 * f;
                glow2.material.opacity = 0.07 + 0.08 * f;
                boltMatW.opacity = 0.45 + 0.55 * f;
                boltMatY.opacity = 0.35 + 0.45 * Math.abs(Math.sin(time * 22 + 1.1));
            };
        } else {
            const coreGlow = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), A(0xbfffe0, 0.4));
            g.add(coreGlow);
            const ribbons = [];
            for (let i = 0; i < 3; i++) {
                const pts = [];
                for (let k = 0; k <= 40; k++) {
                    const t = k / 40;
                    const a = t * Math.PI * 2 * 1.6 + i * 2.09;
                    const r = 0.05 + t * 0.17;
                    pts.push(V(Math.cos(a) * r, -0.09 + t * 0.18, Math.sin(a) * r));
                }
                const rb = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.007, 5), A(i % 2 ? 0x7dffb8 : 0xd0ffe4, 0.8));
                g.add(rb);
                ribbons.push(rb);
            }
            const slashes = [];
            for (let i = 0; i < 2; i++) {
                const sl = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.008, 6, 20, Math.PI * 0.65), A(0xa8ffce, 0.85));
                sl.rotation.set(1.2 + i * 0.5, i * 1.8, i * 0.9);
                g.add(sl);
                slashes.push(sl);
            }
            const rings = [];
            for (let i = 0; i < 3; i++) {
                const r = loopLine(ringPts2(0.14, 40), new THREE.LineBasicMaterial({ color: el.glow, transparent: true, opacity: 0.8 }));
                r.rotation.x = Math.PI / 2;
                r.userData.ph = i / 3;
                g.add(r);
                rings.push(r);
            }
            g.userData.update = time => {
                g.rotation.y += 0.03;
                for (let i = 0; i < ribbons.length; i++) {
                    ribbons[i].rotation.y = time * (0.9 + i * 0.2) * (i % 2 ? -1 : 1);
                }
                for (let i = 0; i < slashes.length; i++) {
                    slashes[i].rotation.z += 0.09;
                    slashes[i].rotation.y = time * 1.2 * (i % 2 ? -1 : 1);
                }
                for (const r of rings) {
                    const p = (time * 0.8 + r.userData.ph) % 1;
                    const sc = 0.4 + p * 1.9;
                    r.scale.set(sc, sc, sc);
                    r.material.opacity = 0.85 * (1 - p);
                    r.position.y = Math.sin(p * Math.PI) * 0.12;
                }
            };
        }
        return g;
    }
    const crystalColor = new THREE.Color(0xd8dce0);
    const crystalTarget = new THREE.Color(0xd8dce0);
    const IDENTITY_Q = new THREE.Quaternion();
    const aimQ = new THREE.Quaternion();
    {
        const m = new THREE.Matrix4().lookAt(CAST_POS, WAND_HOVER, V(0, 1, 0));
        aimQ.setFromRotationMatrix(m);
    }

    // 原 `ctx.regMagic(wandG, …)` 的回调体 —— 逐字搬来（`clock.now` → `s.now`）
    function tryCast() {
        if (s.phase !== 'idle') return;
        s.idx = Math.floor(runtimeRng() * ELEMENTS.length);
        s.el = ELEMENTS[s.idx];
        s.phase = 'fly';
        s.t0 = s.now;
    }

    function clearCast() {
        if (s.circleHolder) {
            scene.remove(s.circleHolder);
            s.circleHolder = null;
            s.circleSpin = null;
        }
        if (s.crea) {
            scene.remove(s.crea);
            s.crea = null;
        }
    }

    /** 原 `updateWand2(time)` —— 逐字搬运（`wandState` → `s`） */
    function updateWand2(time) {
        crystalG.position.z = 0.78 + Math.sin(time * 2) * 0.02;
        crystalG.rotation.z += 0.025;
        crystalColor.lerp(crystalTarget, 0.08);
        crystalMat.color.copy(crystalColor);
        wGlow1.material.color.copy(crystalColor);
        wGlow2.material.color.copy(crystalColor);
        const FLY = 0.8, GROW = 0.5, HOLD = 2.3, FADE = 0.6, RET = 0.8;
        const e = time - s.t0;
        if (s.phase === 'idle') {
            wGlow1.material.opacity = 0.13 + 0.04 * Math.sin(time * 1.6);
            wGlow2.material.opacity = 0.04 + 0.02 * Math.sin(time * 1.6);
            cryCore.material.opacity = 0.55 + 0.10 * Math.sin(time * 1.6);
            return;
        }
        if (s.phase === 'fly') {
            const k = smooth(Math.min(e / FLY, 1));
            wandG.position.lerpVectors(WAND_REST, WAND_HOVER, k);
            wandG.position.y += Math.sin(k * Math.PI) * 0.10;
            wandG.quaternion.slerp(aimQ, 0.06);
            crystalTarget.set(s.el.col);
            wGlow1.material.opacity = 0.20 + 0.20 * k;
            wGlow2.material.opacity = 0.06 + 0.08 * k;
            cryCore.material.opacity = 0.65 + 0.25 * k;
            if (e >= FLY) {
                s.phase = 'cast';
                s.t0 = time;
                wandG.quaternion.copy(aimQ);
                s.dir.copy(CAST_POS).sub(WAND_HOVER).normalize();
                s.circleSpin = buildMagicCircle(s.el, s.idx);
                s.circleSpin.scale.setScalar(0.01);
                s.circleHolder = new THREE.Group();
                s.circleHolder.position.copy(CAST_POS);
                s.circleHolder.quaternion.copy(aimQ);
                s.circleHolder.add(s.circleSpin);
                scene.add(s.circleHolder);
                s.crea = buildCreation(s.idx, s.el);
                s.crea.position.copy(CAST_POS).addScaledVector(s.dir, 0.42);
                s.crea.scale.setScalar(0.01);
                scene.add(s.crea);
            }
        } else if (s.phase === 'cast') {
            const gk = smooth(Math.min(e / GROW, 1));
            s.circleSpin.scale.setScalar(0.01 + gk * 0.99);
            s.circleSpin.rotation.z += 0.025;
            s.crea.scale.setScalar(Math.max(0.01, gk));
            if (s.crea.userData.update) s.crea.userData.update(time);
            wandG.position.copy(WAND_HOVER);
            wandG.position.y += Math.sin(time * 3) * 0.008;
            wGlow1.material.opacity = 0.42 + 0.14 * Math.sin(time * 4);
            wGlow2.material.opacity = 0.16 + 0.06 * Math.sin(time * 4);
            if (e >= GROW + HOLD) {
                s.phase = 'fade';
                s.t0 = time;
            }
        } else if (s.phase === 'fade') {
            const k = Math.min(e / FADE, 1);
            for (const m of s.circleSpin.userData.mats) m.opacity = m.userData.op * (1 - k);
            s.circleSpin.rotation.z += 0.05;
            s.crea.scale.setScalar(Math.max(0.01, 1 - k));
            if (s.crea.userData.update) s.crea.userData.update(time);
            wGlow1.material.opacity = 0.40 * (1 - k);
            wGlow2.material.opacity = 0.15 * (1 - k);
            if (e >= FADE) {
                clearCast();
                crystalTarget.set(0xd8dce0);
                s.phase = 'return';
                s.t0 = time;
            }
        } else if (s.phase === 'return') {
            const k = smooth(Math.min(e / RET, 1));
            wandG.position.lerpVectors(WAND_HOVER, WAND_REST, k);
            wandG.position.y += Math.sin(k * Math.PI) * 0.10;
            wandG.quaternion.slerp(IDENTITY_Q, 0.07);
            if (e >= RET) {
                wandG.position.copy(WAND_REST);
                wandG.quaternion.copy(IDENTITY_Q);
                s.phase = 'idle';
            }
        }
    }

    return {
      root: wandG,
      parts: {
        wandG, crystalG, cryGeo, crystalMat, cryCore, crystalColor, crystalTarget,
        wGlow1, wGlow2, ELEMENTS, aimQ, IDENTITY_Q,
        WAND_REST, WAND_HOVER, CAST_POS, WAND_Y, WAND_Z, HOOK_X,
        tryCast, clearCast, buildMagicCircle, buildCreation, updateWand2,
        consts: { WAND_X: HOOK_X, WAND_Z },
      },
    }
  },

  /**
   * 原 `ctx.regMagic(wandG, …)` 的等价声明。
   * `label` 语义化 + `mode: 'both'`（风险 `R1`）；回调体（含 `runtimeRng` 抽元素）在 `parts.tryCast` 里。
   */
  interactables: (s, { parts }) => [{
    id: 'wand/cast',
    label: '挥动魔法杖施放一个法术',
    mode: 'both',
    anchor: { x: parts.consts.WAND_X, z: parts.consts.WAND_Z },
    radius: 2.0,
    hits: parts.wandG,
    onActivate: () => { parts.tryCast() },
  }],

  /**
   * 原 `FrameBody` 的 `frame/58`（`ctx.updateWand2(time)`）—— 本件**只有这一条**帧任务，
   * 不涉及合并。`s.now = time` 供 `tryCast` 里的 `s.t0 = s.now` 使用（与 `clock.now` 恒等）。
   */
  update(dt, time, s, { parts }) {
    s.now = time;
    parts.updateWand2(time);
  },
})
