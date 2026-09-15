/**
 * 超位魔法系统：魔杖 / 24 层阵 / 爆炸 —— 从 `legacy/monolith.js` 搬出的整段（magic）
 *
 * 来源：`J4` 段切片（段表见 `scripts/oneoff/_j4-segments.mjs`）。
 * 段内代码**逐字未改**，只做了三件事：包成函数、补 import、把跨段通信交给 `ctx`。
 * 因此这个文件的正确性判据与搬迁前完全一致：像素逐字节零差异。
 *
 * @param {object} ctx 段间通信载体（见 `installCabin` 的 `__J4_CTX__`）
 * @param {object} app 应用内核 —— 段里用到的 `registry`/`bus`/`scheduler`/`store` 从这里解构
 */
import * as THREE from 'three'
import { arcPts, createShapes2d, polyPts, ringPts, spiralPts, starPts, wavyRingPts, zigPts } from '../../core/geometry/shapes2d.js'
import { createCameraRig } from '../../core/render/CameraRig.js'
import { runtime } from '../../app/rng.js'

export function installMagicSystem(ctx, app) {
  const runtimeRng = runtime
            // ↓ J4 段导出（magic）：本段函数声明挂到 ctx（借提升，段内任何位置都可见）
            ctx.showHintOverride = showHintOverride; ctx.screenFlash = screenFlash; ctx.disposeGroup = disposeGroup; ctx.angDiff = angDiff; ctx.makeCrossStarMat = makeCrossStarMat; ctx.fillStarAttrs = fillStarAttrs;
            ctx.sat = sat; ctx.buildBlastArray = buildBlastArray; ctx.buildWireSphere = buildWireSphere; ctx.spawnExplosion = spawnExplosion; ctx.getCastTarget = getCastTarget; ctx.tryCast = tryCast;
            ctx.selectSlot = selectSlot; ctx.updateWand = updateWand; ctx.applyCastDark = applyCastDark; ctx.updateBlast = updateBlast;
            ctx.slotSel = 1;
            ctx.wandAppear = 0;
            ctx.camShake = 0;
            ctx.castDark = 0;
            // J2.6：临时提示的两个变量（hintOverrideUntil / hintOverrideText）搬进 HintUI ——
            // 调用方不再需要知道"比较 clock.wallNow()"这个细节。
            const _v1 = new THREE.Vector3(), _whiteC = new THREE.Color(0xffffff);
            ctx._v1 = _v1; ctx._whiteC = _whiteC;
            const wandCrystalBase = new THREE.Color(0x8fd8ff);
            ctx.wandCrystalBase = wandCrystalBase;
            const easeOutCubic = x => 1 - Math.pow(1 - x, 3);
            ctx.easeOutCubic = easeOutCubic;
            const easeInCubic = x => x * x * x;
            ctx.easeInCubic = easeInCubic;
            const STAR_PALETTE = [[1, 0.42, 0.42], [1, 0.75, 0.35], [1, 0.95, 0.5], [0.55, 1, 0.5], [0.4, 0.9, 1], [0.65, 0.55, 1], [0.95, 0.6, 1], [0.9, 0.95, 1]];
            ctx.STAR_PALETTE = STAR_PALETTE;
            // J2.6：临时消息走 HintUI 的 showOverride（唯一文案出口；2.4 秒后自动让位给交互提示）
            function showHintOverride(html) { ctx.hintUI.showOverride(html); }
            function screenFlash() {
                // 双脉冲：白闪 → 短暂回落 → 再闪一次 → 消退
                const el = document.getElementById('flashOverlay');
                el.style.transition = 'none'; el.style.opacity = '1';
                requestAnimationFrame(() => requestAnimationFrame(() => {
                    el.style.transition = 'opacity 0.26s ease-out'; el.style.opacity = '0.18';
                    setTimeout(() => {
                        el.style.transition = 'none'; el.style.opacity = '0.85';
                        requestAnimationFrame(() => requestAnimationFrame(() => {
                            el.style.transition = 'opacity 0.7s ease-out'; el.style.opacity = '0';
                        }));
                    }, 250);
                }));
            }
            function disposeGroup(g) { g.traverse(o => { if (o.geometry && o.geometry !== flashDiskGeoShared) o.geometry.dispose(); if (o.material && o.material.dispose) o.material.dispose(); }); }
            function angDiff(a, b) { let d = (b - a + Math.PI * 3) % (Math.PI * 2) - Math.PI; return d; }

            /* ---- 魔杖模型 ---- */
            const wandRoot = new THREE.Group();
            ctx.wandRoot = wandRoot;
            wandRoot.position.set(0.17, 0.30, 0.10); wandRoot.rotation.set(-0.55, 0, -0.18);
            ctx.slimeRoot.add(wandRoot);
            {
                ctx.put(ctx.edge(new THREE.CylinderGeometry(0.015, 0.023, 0.46, 7)), 0, 0.20, 0, 0, 0, 0, wandRoot);
                ctx.put(ctx.edge(new THREE.TorusGeometry(0.027, 0.006, 5, 10)), 0, 0.055, 0, Math.PI / 2, 0, 0, wandRoot);
                ctx.put(ctx.edge(new THREE.TorusGeometry(0.025, 0.006, 5, 10)), 0, 0.095, 0, Math.PI / 2, 0, 0, wandRoot);
                ctx.put(ctx.edge(new THREE.ConeGeometry(0.034, 0.07, 6)), 0, 0.445, 0, 0, 0, 0, wandRoot);
            }
            const wandCrystalMat = new THREE.MeshBasicMaterial({ color: 0x8fd8ff, transparent: true, opacity: 0.95 });
            ctx.wandCrystalMat = wandCrystalMat;
            const wandCrystal = new THREE.Group();
            ctx.wandCrystal = wandCrystal;
            { const cg = new THREE.OctahedronGeometry(0.052); wandCrystal.add(new THREE.Mesh(cg, wandCrystalMat)); wandCrystal.add(new THREE.LineSegments(new THREE.EdgesGeometry(cg), ctx.MAT)); }
            ctx.put(wandCrystal, 0, 0.51, 0, 0, 0, 0, wandRoot);
            const wandTip = new THREE.Object3D();
            ctx.wandTip = wandTip; ctx.put(wandTip, 0, 0.51, 0, 0, 0, 0, wandRoot);
            const wandTipGlowMat = new THREE.MeshBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false });
            ctx.wandTipGlowMat = wandTipGlowMat;
            const wandTipGlow = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), wandTipGlowMat);
            ctx.wandTipGlow = wandTipGlow;
            ctx.put(wandTipGlow, 0, 0.51, 0, 0, 0, 0, wandRoot);
            wandRoot.visible = false;

            /* ---- 杖尖蓄力粒子 ---- */
            const CHARGE_PN = 42;
            ctx.CHARGE_PN = CHARGE_PN;
            const chargeDir = [];
            ctx.chargeDir = chargeDir;
            for (let i = 0; i < CHARGE_PN; i++) {
                const th = runtimeRng() * Math.PI * 2, ph = Math.acos(runtimeRng() * 2 - 1);
                chargeDir.push(ctx.V(Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)));
            }
            const chargePos = new Float32Array(CHARGE_PN * 3);
            ctx.chargePos = chargePos;
            const chargeGeo = new THREE.BufferGeometry();
            ctx.chargeGeo = chargeGeo;
            chargeGeo.setAttribute('position', new THREE.BufferAttribute(chargePos, 3));
            const chargeMat = new THREE.PointsMaterial({ color: 0x9fe0ff, size: 0.07, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
            ctx.chargeMat = chargeMat;
            const chargePts = new THREE.Points(chargeGeo, chargeMat);
            ctx.chargePts = chargePts; chargePts.frustumCulled = false; ctx.scene.add(chargePts);

            /* ---- 空中彩色魔力粒子（向魔法阵中心聚集） ---- */
            const GATHER_N = 170;
            ctx.GATHER_N = GATHER_N;
            const gatherData = [];
            ctx.gatherData = gatherData;
            const gatherPos = new Float32Array(GATHER_N * 3);
            ctx.gatherPos = gatherPos;
            const gatherCol = new Float32Array(GATHER_N * 3);
            ctx.gatherCol = gatherCol;
            {
                for (let i = 0; i < GATHER_N; i++) {
                    const th = runtimeRng() * Math.PI * 2, ph = Math.acos(runtimeRng() * 2 - 1);
                    gatherData.push({
                        dx: Math.sin(ph) * Math.cos(th), dy: Math.cos(ph) * 0.7, dz: Math.sin(ph) * Math.sin(th),
                        r0: 8 + runtimeRng() * 12, spd: 0.3 + runtimeRng() * 0.55, ph: runtimeRng() * Math.PI * 2
                    });
                    const c = STAR_PALETTE[i % STAR_PALETTE.length];
                    gatherCol[i * 3] = c[0]; gatherCol[i * 3 + 1] = c[1]; gatherCol[i * 3 + 2] = c[2];
                }
            }
            const gatherGeo = new THREE.BufferGeometry();
            ctx.gatherGeo = gatherGeo;
            gatherGeo.setAttribute('position', new THREE.BufferAttribute(gatherPos, 3));
            gatherGeo.setAttribute('color', new THREE.BufferAttribute(gatherCol, 3));
            const gatherMat = new THREE.PointsMaterial({ vertexColors: true, size: 0.17, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
            ctx.gatherMat = gatherMat;
            const gatherPts = new THREE.Points(gatherGeo, gatherMat);
            ctx.gatherPts = gatherPts; gatherPts.frustumCulled = false; ctx.scene.add(gatherPts);

            /* ---- 十字/四芒星粒子（修复：属性名 aColor 对齐；加大加亮；可漂浮自转） ---- */
            function makeCrossStarMat() {
                return new THREE.ShaderMaterial({
                    uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uBob: { value: 0 } },
                    vertexShader: `
          attribute float aPhase; attribute float aAngle; attribute float aSize; attribute vec3 aColor;
          uniform float uTime; uniform float uBob;
          varying vec3 vColor; varying float vAngle; varying float vTw;
          void main() {
            vec3 pos = position;
            pos.y += uBob * sin(uTime * 0.8 + aPhase * 6.2831) * 0.5;
            vec4 mv = modelViewMatrix * vec4(pos, 1.0);
            gl_Position = projectionMatrix * mv;
            float tw = 0.35 + 0.65 * abs(sin(uTime * 1.7 + aPhase * 6.2831));
            vTw = tw;
            gl_PointSize = aSize * (0.8 + 0.6 * tw) * (170.0 / -mv.z);
            vColor = aColor;
            vAngle = aAngle + uTime * uBob * 0.5;
          }`,
                    fragmentShader: `
          varying vec3 vColor; varying float vAngle; varying float vTw;
          uniform float uOpacity;
          void main() {
            vec2 p = gl_PointCoord - 0.5;
            float ca = cos(vAngle), sa = sin(vAngle);
            p = mat2(ca, -sa, sa, ca) * p;
            float ax = abs(p.x), ay = abs(p.y);
            float armX = (ax < 0.11) ? max(0.0, 1.0 - ay * 1.55) : 0.0;
            float armY = (ay < 0.11) ? max(0.0, 1.0 - ax * 1.55) : 0.0;
            float diag = max(0.0, 1.0 - abs(ax - ay) * 5.0) * 0.45;
            float core = max(0.0, 1.0 - length(p) * 3.0);
            float a = max(max(armX, armY), max(diag, core * 0.95)) * vTw * uOpacity;
            if (a < 0.012) discard;
            gl_FragColor = vec4(vColor * 1.45, a);
          }`,
                    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false
                });
            }
            function fillStarAttrs(g, n) {
                const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
                const ph = new Float32Array(n), an = new Float32Array(n), sz = new Float32Array(n);
                for (let i = 0; i < n; i++) {
                    const c = STAR_PALETTE[i % STAR_PALETTE.length];
                    col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
                    ph[i] = runtimeRng(); an[i] = runtimeRng() * Math.PI; sz[i] = 2.4 + runtimeRng() * 3.2;
                }
                g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
                g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
                g.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
                g.setAttribute('aAngle', new THREE.BufferAttribute(an, 1));
                g.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
            }

            /* ---- 施法期间：环绕阵塔的十字星 ---- */
            const CAST_STAR_N = 96;
            ctx.CAST_STAR_N = CAST_STAR_N;
            const castStarGeo = new THREE.BufferGeometry();
            ctx.castStarGeo = castStarGeo;
            fillStarAttrs(castStarGeo, CAST_STAR_N);
            {
                const pos = castStarGeo.attributes.position.array;
                for (let i = 0; i < CAST_STAR_N; i++) {
                    const th = runtimeRng() * Math.PI * 2, rr = 6 + runtimeRng() * 8.5;
                    pos[i * 3] = Math.cos(th) * rr;
                    pos[i * 3 + 1] = -6 + runtimeRng() * 13;
                    pos[i * 3 + 2] = Math.sin(th) * rr;
                }
            }
            const castStarMat = makeCrossStarMat();
            ctx.castStarMat = castStarMat;
            castStarMat.uniforms.uBob.value = 1;
            const castStars = new THREE.Points(castStarGeo, castStarMat);
            ctx.castStars = castStars; castStars.frustumCulled = false; ctx.scene.add(castStars);

            /* ---- 施法期间：地面上升光尘 ---- */
            const DUST_N = 60;
            ctx.DUST_N = DUST_N;
            const dustGeo = new THREE.BufferGeometry();
            ctx.dustGeo = dustGeo;
            {
                const pos = new Float32Array(DUST_N * 3), col = new Float32Array(DUST_N * 3);
                const seed = new Float32Array(DUST_N), spd = new Float32Array(DUST_N);
                for (let i = 0; i < DUST_N; i++) {
                    const th = runtimeRng() * Math.PI * 2, rr = runtimeRng() * 7;
                    pos[i * 3] = Math.cos(th) * rr; pos[i * 3 + 1] = 0; pos[i * 3 + 2] = Math.sin(th) * rr;
                    const c = [0.55, 0.85, 1];
                    col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
                    seed[i] = runtimeRng(); spd[i] = 0.9 + runtimeRng() * 1.3;
                }
                dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
                dustGeo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
                dustGeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
                dustGeo.setAttribute('aSpeed', new THREE.BufferAttribute(spd, 1));
            }
            const dustUniforms = { uTime: { value: 0 }, uOpacity: { value: 0 } };
            ctx.dustUniforms = dustUniforms;
            const dustMat = new THREE.ShaderMaterial({
                uniforms: dustUniforms,
                vertexShader: `
        attribute float aSeed; attribute float aSpeed; attribute vec3 aColor;
        uniform float uTime;
        varying float vA; varying vec3 vC;
        void main() {
          vec3 pos = position;
          float yy = mod(uTime * aSpeed + aSeed * 10.0, 10.0);
          pos.y = yy;
          vA = sin(3.14159 * yy / 10.0);
          vC = aColor;
          vec4 mv = modelViewMatrix * vec4(pos, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (1.5 + 1.3 * aSeed) * (150.0 / -mv.z);
        }`,
                fragmentShader: `
        varying float vA; varying vec3 vC;
        uniform float uOpacity;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          if (d > 0.5) discard;
          float a = (1.0 - d * 2.0) * vA * uOpacity * 0.65;
          gl_FragColor = vec4(vC * 1.2, a);
        }`,
                transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false
            });
            ctx.dustMat = dustMat;
            const dustPts = new THREE.Points(dustGeo, dustMat);
            ctx.dustPts = dustPts; dustPts.frustumCulled = false; ctx.scene.add(dustPts);

            /* ---- 魔法阵几何辅助（J2.1：已提取到 cabin/core/geometry/shapes2d.js） ---- */
            // 七个纯点集函数（ringPts / polyPts / starPts / arcPts / spiralPts / wavyRingPts / zigPts）
            // 零依赖、无副作用，由文件顶部 import 直接引入（`tests/unit/` 可直接测）；
            // 下面两个构建器需要 V，故在此注入。
            const { lineFromPts, segsFromPairs } = createShapes2d({ V: ctx.V });
            ctx.lineFromPts = lineFromPts; ctx.segsFromPairs = segsFromPairs;
            // 卫星小阵：kind 0=三角 1=十字 2=五芒星 3=放射 4=方形
            function sat(g, m, cx, cy, r, kind, rot) {
                g.add(lineFromPts(ringPts(r, Math.max(12, Math.floor(r * 16)), rot || 0).map(p => [p[0] + cx, p[1] + cy]), m, true));
                if (kind === 0) g.add(lineFromPts(polyPts(r * 0.6, 3, rot || 0).map(p => [p[0] + cx, p[1] + cy]), m, true));
                else if (kind === 1) g.add(segsFromPairs([[[cx - r * 0.7, cy], [cx + r * 0.7, cy]], [[cx, cy - r * 0.7], [cx, cy + r * 0.7]]], m));
                else if (kind === 2) g.add(lineFromPts(starPts(r * 0.62, 5, 2, rot || 0).map(p => [p[0] + cx, p[1] + cy]), m, true));
                else if (kind === 3) {
                    const pr = [];
                    for (let i = 0; i < 6; i++) { const t = (rot || 0) + i / 6 * Math.PI * 2; pr.push([[cx + Math.cos(t) * r * 0.25, cy + Math.sin(t) * r * 0.25], [cx + Math.cos(t) * r * 0.85, cy + Math.sin(t) * r * 0.85]]); }
                    g.add(segsFromPairs(pr, m));
                } else g.add(lineFromPts(polyPts(r * 0.55, 4, (rot || 0) + Math.PI / 8).map(p => [p[0] + cx, p[1] + cy]), m, true));
            }
            const flashDiskGeoShared = new THREE.CircleGeometry(1, 40);
            ctx.flashDiskGeoShared = flashDiskGeoShared;

            /* ---- 施法时间轴 ---- */
            const T_CHARGE = 1.4;
            ctx.T_CHARGE = T_CHARGE;
            const ARRAY_STEP = 0.45;
            ctx.ARRAY_STEP = ARRAY_STEP;
            const ARRAY_GROW = 0.55;
            ctx.ARRAY_GROW = ARRAY_GROW;
            const N_LAYERS = 24;
            ctx.N_LAYERS = N_LAYERS;
            const T_ARRAY = (N_LAYERS - 1) * ARRAY_STEP + ARRAY_GROW;
            ctx.T_ARRAY = T_ARRAY;
            const T_COLLAPSE = 0.6;
            ctx.T_COLLAPSE = T_COLLAPSE;
            const T_WIRE_GROW = 0.85, T_WIRE_SHRINK = 0.5, T_WIRE = T_WIRE_GROW + T_WIRE_SHRINK;
            ctx.T_WIRE_GROW = T_WIRE_GROW; ctx.T_WIRE_SHRINK = T_WIRE_SHRINK; ctx.T_WIRE = T_WIRE;
            const T_WIRE_START = T_CHARGE + T_ARRAY + T_COLLAPSE;
            ctx.T_WIRE_START = T_WIRE_START;
            const T_BOOM = T_WIRE_START + T_WIRE;
            ctx.T_BOOM = T_BOOM;
            const T_END = T_BOOM + 3.4;
            ctx.T_END = T_END;
            const ARRAY_SCALE = 1.35;
            ctx.ARRAY_SCALE = ARRAY_SCALE;
            const blast = { active: false, t: 0, target: ctx.V(0, 7.6, 0), arr: null, wire: null, boom: null };
            ctx.blast = blast;
            const residues = [];
            ctx.residues = residues;

            /* ---- 24 层魔法阵定义（颜色 / 样式 / 转速各异） ---- */
            const LAYER_DEFS = [
                {
                    color: 0x5fd8ff, spin: 0.2, rMax: 7.0, build(g, m) { // 1 青色刻度三环
                        g.add(lineFromPts(ringPts(7.0, 108), m, true));
                        g.add(lineFromPts(ringPts(6.6, 108), m, true));
                        g.add(lineFromPts(ringPts(5.9, 108), m, true));
                        g.add(lineFromPts(ringPts(3.0, 60), m, true));
                        const pr = [];
                        for (let i = 0; i < 72; i++) { const t = i / 72 * Math.PI * 2; const l0 = i % 6 === 0 ? 5.9 : 6.0; const l1 = i % 6 === 0 ? 6.55 : 6.3; pr.push([[Math.cos(t) * l0, Math.sin(t) * l0], [Math.cos(t) * l1, Math.sin(t) * l1]]); }
                        g.add(segsFromPairs(pr, m));
                        for (let i = 0; i < 12; i++) { const t = i / 12 * Math.PI * 2; g.add(lineFromPts(ringPts(0.16, 8).map(p => [p[0] + Math.cos(t) * 4.45, p[1] + Math.sin(t) * 4.45]), m, true)); }
                    }
                },
                {
                    color: 0xffd76e, spin: -0.35, rMax: 5.6, build(g, m) { // 2 金色六芒星
                        g.add(lineFromPts(starPts(5.6, 6, 2, 0), m, true));
                        g.add(lineFromPts(ringPts(5.6, 84), m, true));
                        g.add(lineFromPts(ringPts(2.8, 48), m, true));
                        g.add(lineFromPts(polyPts(1.6, 3, Math.PI / 2), m, true));
                        for (let i = 0; i < 6; i++) { const t = i / 6 * Math.PI * 2; g.add(lineFromPts(ringPts(0.26, 10).map(p => [p[0] + Math.cos(t) * 5.6, p[1] + Math.sin(t) * 5.6]), m, true)); }
                    }
                },
                {
                    color: 0xc07bff, spin: 0.6, rMax: 4.6, build(g, m) { // 3 紫色符文环
                        g.add(lineFromPts(ringPts(4.6, 96), m, true));
                        g.add(lineFromPts(ringPts(3.95, 72), m, true));
                        const pr = [];
                        for (let i = 0; i < 24; i++) { const t = i / 24 * Math.PI * 2; pr.push([[Math.cos(t) * 4.0, Math.sin(t) * 4.0], [Math.cos(t) * 4.6, Math.sin(t) * 4.6]]); }
                        g.add(segsFromPairs(pr, m));
                        for (let i = 0; i < 12; i++) { const t = i / 12 * Math.PI * 2; const cx = Math.cos(t) * 4.28, cy = Math.sin(t) * 4.28; g.add(lineFromPts(polyPts(0.30, i % 2 ? 6 : 4, t).map(p => [p[0] + cx, p[1] + cy]), m, true)); }
                        g.add(lineFromPts(starPts(0.7, 5, 2, 0), m, true));
                        g.add(lineFromPts(ringPts(0.28, 12).map(p => [p[0], p[1] + 1.1]), m, true));
                    }
                },
                {
                    color: 0xff7fbf, spin: -0.9, rMax: 3.6, build(g, m) { // 4 粉色交错几何
                        g.add(lineFromPts(ringPts(3.6, 84), m, true));
                        g.add(lineFromPts(polyPts(3.6, 4, 0), m, true));
                        g.add(lineFromPts(polyPts(3.6, 4, Math.PI / 4), m, true));
                        g.add(lineFromPts(polyPts(3.6, 3, 0), m, true));
                        g.add(lineFromPts(polyPts(3.6, 3, Math.PI), m, true));
                        g.add(lineFromPts(polyPts(1.3, 6, 0), m, true));
                        g.add(lineFromPts(ringPts(0.55, 20), m, true));
                    }
                },
                {
                    color: 0xffffff, spin: 1.4, rMax: 2.05, build(g, m) { // 5 白色六角阵
                        g.add(lineFromPts(polyPts(2.05, 6, 0), m, true));
                        g.add(lineFromPts(polyPts(2.05, 6, Math.PI / 6), m, true));
                        g.add(lineFromPts(ringPts(1.25, 48), m, true));
                        for (let i = 0; i < 3; i++) { const t = i / 3 * Math.PI * 2 + 0.5; g.add(lineFromPts(ringPts(0.55, 14).map(p => [p[0] + Math.cos(t) * 1.5, p[1] + Math.sin(t) * 1.5]), m, true)); }
                        g.add(lineFromPts(polyPts(0.42, 3, Math.PI / 2), m, true));
                        g.add(lineFromPts(ringPts(0.2, 10), m, true));
                    }
                },
                {
                    color: 0xffffff, spin: -1.7, rMax: 5.5, rainbow: true, build(g, m) { // 6 七彩螺旋散点
                        const palette = STAR_PALETTE;
                        const pts = [], cols = [];
                        for (let i = 0; i < 22; i++) {
                            const a = i / 22 * Math.PI * 2;
                            const rr = 1.1 + (i / 22) * 4.4;
                            const cx = Math.cos(a) * rr, cy = Math.sin(a) * rr;
                            const c = palette[i % 7], n = 8, r = 0.22 + (i % 3) * 0.06;
                            for (let k = 0; k < n; k++) {
                                const t0 = k / n * Math.PI * 2, t1 = (k + 1) / n * Math.PI * 2;
                                pts.push(ctx.V(cx + Math.cos(t0) * r, cy + Math.sin(t0) * r, 0), ctx.V(cx + Math.cos(t1) * r, cy + Math.sin(t1) * r, 0));
                                cols.push(c[0], c[1], c[2], c[0], c[1], c[2]);
                            }
                        }
                        const ggeo = new THREE.BufferGeometry().setFromPoints(pts);
                        ggeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
                        g.add(new THREE.LineSegments(ggeo, m));
                    }
                },
                {
                    color: 0x6effa8, spin: 0.45, rMax: 6.0, build(g, m) { // 7 绿色放射轮 + 5 卫星符环
                        g.add(lineFromPts(ringPts(3.2, 72), m, true));
                        g.add(lineFromPts(ringPts(1.9, 48), m, true));
                        const pr = [];
                        for (let i = 0; i < 16; i++) { const t = i / 16 * Math.PI * 2; pr.push([[Math.cos(t) * 1.9, Math.sin(t) * 1.9], [Math.cos(t) * 3.2, Math.sin(t) * 3.2]]); }
                        g.add(segsFromPairs(pr, m));
                        g.add(lineFromPts(polyPts(0.5, 6, 0), m, true));
                        for (let k = 0; k < 5; k++) { const t = k / 5 * Math.PI * 2; sat(g, m, Math.cos(t) * 5.0, Math.sin(t) * 5.0, 0.85, k % 3, t); }
                    }
                },
                {
                    color: 0xffa54d, spin: -0.65, rMax: 4.9, build(g, m) { // 8 橙色五芒星 + 断弧
                        g.add(lineFromPts(ringPts(4.9, 90), m, true));
                        g.add(lineFromPts(starPts(4.6, 5, 2, Math.PI / 2), m, true));
                        g.add(lineFromPts(ringPts(2.2, 48), m, true));
                        for (let i = 0; i < 8; i++) g.add(lineFromPts(arcPts(3.6, i / 8 * Math.PI * 2, i / 8 * Math.PI * 2 + 0.5, 12), m, false));
                        for (let i = 0; i < 5; i++) { const t = i / 5 * Math.PI * 2 + Math.PI / 2; g.add(lineFromPts(ringPts(0.18, 8).map(p => [p[0] + Math.cos(t) * 4.6, p[1] + Math.sin(t) * 4.6]), m, true)); }
                        g.add(lineFromPts(ringPts(0.6, 16), m, true));
                    }
                },
                {
                    color: 0x5f9dff, spin: 0.8, rMax: 5.0, build(g, m) { // 9 蓝色嵌套方阵 + 4 卫星三角阵
                        g.add(lineFromPts(polyPts(2.6, 4, 0), m, true));
                        g.add(lineFromPts(polyPts(2.6, 4, Math.PI / 4), m, true));
                        g.add(lineFromPts(polyPts(1.4, 4, Math.PI / 8), m, true));
                        g.add(lineFromPts(ringPts(0.9, 30), m, true));
                        g.add(lineFromPts(polyPts(0.5, 8, 0), m, true));
                        for (let k = 0; k < 4; k++) { const t = k / 4 * Math.PI * 2 + Math.PI / 4; sat(g, m, Math.cos(t) * 4.0, Math.sin(t) * 4.0, 1.0, 0, t); }
                    }
                },
                {
                    color: 0xff5f5f, spin: -0.5, rMax: 5.0, build(g, m) { // 10 红色断章双环 + 十字
                        g.add(lineFromPts(ringPts(5.0, 96), m, true));
                        g.add(lineFromPts(ringPts(4.2, 84), m, true));
                        for (let i = 0; i < 8; i++) g.add(lineFromPts(arcPts(4.6, i / 8 * Math.PI * 2 + (i % 2 ? 0.3 : 0), i / 8 * Math.PI * 2 + 0.46 + (i % 2 ? 0.3 : 0), 10), m, false));
                        g.add(segsFromPairs([[[-2.6, 0], [2.6, 0]], [[0, -2.6], [0, 2.6]]], m));
                        g.add(lineFromPts(ringPts(1.4, 36), m, true));
                        g.add(lineFromPts(ringPts(0.5, 16), m, true));
                    }
                },
                {
                    color: 0x4de0d0, spin: 1.1, rMax: 4.8, build(g, m) { // 11 青绿三角阵
                        g.add(lineFromPts(polyPts(4.8, 3, 0), m, true));
                        g.add(lineFromPts(polyPts(4.8, 3, Math.PI), m, true));
                        g.add(lineFromPts(polyPts(3.2, 3, Math.PI / 2), m, true));
                        g.add(lineFromPts(polyPts(1.8, 3, 0), m, true));
                        for (let i = 0; i < 3; i++) { const t = i / 3 * Math.PI * 2; sat(g, m, Math.cos(t) * 4.8, Math.sin(t) * 4.8, 0.5, 1, t); }
                        g.add(lineFromPts(polyPts(1.5, 6, 0), m, true));
                        g.add(lineFromPts(ringPts(0.4, 14), m, true));
                    }
                },
                {
                    color: 0xd8a8ff, spin: -1.3, rMax: 6.2, build(g, m) { // 12 紫银双螺旋 + 6 卫星小环
                        g.add(lineFromPts(spiralPts(0.6, 3.6, 2.2, 90, 0), m, false));
                        g.add(lineFromPts(spiralPts(0.6, 3.6, 2.2, 90, Math.PI), m, false));
                        g.add(lineFromPts(ringPts(2.0, 48), m, true));
                        for (let i = 0; i < 18; i++) g.add(lineFromPts(arcPts(4.9, i / 18 * Math.PI * 2, i / 18 * Math.PI * 2 + 0.12, 5), m, false));
                        for (let k = 0; k < 6; k++) { const t = k / 6 * Math.PI * 2; sat(g, m, Math.cos(t) * 4.9, Math.sin(t) * 4.9, 0.5, k % 2 ? 2 : 4, t); }
                        g.add(lineFromPts(ringPts(0.35, 12), m, true));
                    }
                },
                {
                    color: 0x3ee06e, spin: 0.3, rMax: 6.4, build(g, m) { // 13 翠绿三臂大螺旋
                        g.add(lineFromPts(spiralPts(0.7, 6.4, 1.8, 100, 0), m, false));
                        g.add(lineFromPts(spiralPts(0.7, 6.4, 1.8, 100, Math.PI * 2 / 3), m, false));
                        g.add(lineFromPts(spiralPts(0.7, 6.4, 1.8, 100, Math.PI * 4 / 3), m, false));
                        g.add(lineFromPts(ringPts(1.6, 42), m, true));
                        g.add(lineFromPts(polyPts(0.8, 3, Math.PI / 2), m, true));
                        g.add(lineFromPts(ringPts(0.4, 12), m, true));
                    }
                },
                {
                    color: 0x8fc8ff, spin: -0.75, rMax: 5.4, build(g, m) { // 14 蓝白波浪环
                        g.add(lineFromPts(wavyRingPts(5.4, 9, 0.4, 0), m, true));
                        g.add(lineFromPts(wavyRingPts(5.4, 9, 0.4, Math.PI / 9), m, true));
                        g.add(lineFromPts(wavyRingPts(3.4, 7, 0.3, Math.PI / 7), m, true));
                        g.add(lineFromPts(ringPts(1.5, 42), m, true));
                        g.add(lineFromPts(ringPts(0.5, 16), m, true));
                    }
                },
                {
                    color: 0xffcf6e, spin: 0.95, rMax: 4.4, build(g, m) { // 15 金色扇叶弧
                        for (let i = 0; i < 16; i++) { const t = i / 16 * Math.PI * 2; g.add(lineFromPts(arcPts(4.4, t, t + 0.28, 10), m, false)); g.add(lineFromPts(arcPts(3.4, t + 0.14, t + 0.42, 10), m, false)); }
                        g.add(lineFromPts(ringPts(2.4, 54), m, true));
                        g.add(lineFromPts(polyPts(1.2, 8, 0), m, true));
                        g.add(lineFromPts(ringPts(0.4, 12), m, true));
                    }
                },
                {
                    color: 0xffffff, spin: -0.4, rMax: 7.2, rainbow: true, build(g, m) { // 16 彩虹渐变大环
                        const n = 132, pts = [], cols = [];
                        const tc = new THREE.Color();
                        for (let i = 0; i <= n; i++) {
                            const t = i / n * Math.PI * 2;
                            pts.push([Math.cos(t) * 7.2, Math.sin(t) * 7.2, 0]);
                            tc.setHSL(i / n, 0.85, 0.6);
                            cols.push(tc.r, tc.g, tc.b);
                        }
                        const ggeo = new THREE.BufferGeometry().setFromPoints(pts.map(p => ctx.V(p[0], p[1], p[2])));
                        ggeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
                        g.add(new THREE.LineLoop(ggeo, m));
                        const pr = [];
                        for (let i = 0; i < 8; i++) { const t = i / 8 * Math.PI * 2; pr.push([[Math.cos(t) * 0.4, Math.sin(t) * 0.4], [Math.cos(t) * 2.6, Math.sin(t) * 2.6]]); }
                        g.add(segsFromPairs(pr, m));
                        g.add(lineFromPts(ringPts(2.9, 54), m, true));
                    }
                },
                {
                    color: 0xff6ee0, spin: 0.55, rMax: 5.8, build(g, m) { // 17 洋红八芒星轮
                        g.add(lineFromPts(starPts(5.8, 8, 3, 0), m, true));
                        g.add(lineFromPts(ringPts(5.8, 96), m, true));
                        g.add(lineFromPts(ringPts(4.0, 60), m, true));
                        const pr = [];
                        for (let i = 0; i < 16; i++) { const t = i / 16 * Math.PI * 2; pr.push([[Math.cos(t) * 4.0, Math.sin(t) * 4.0], [Math.cos(t) * 5.8, Math.sin(t) * 5.8]]); }
                        g.add(segsFromPairs(pr, m));
                        g.add(lineFromPts(polyPts(1.6, 8, Math.PI / 8), m, true));
                        g.add(lineFromPts(ringPts(0.5, 16), m, true));
                    }
                },
                {
                    color: 0x9fe8ff, spin: -0.85, rMax: 5.2, build(g, m) { // 18 冰蓝嵌套三角
                        g.add(lineFromPts(polyPts(5.2, 3, 0), m, true));
                        g.add(lineFromPts(polyPts(4.2, 3, Math.PI), m, true));
                        g.add(lineFromPts(polyPts(3.2, 3, 0), m, true));
                        g.add(lineFromPts(polyPts(2.4, 6, Math.PI / 6), m, true));
                        g.add(lineFromPts(polyPts(1.4, 3, Math.PI), m, true));
                        g.add(lineFromPts(ringPts(0.6, 18), m, true));
                        for (let i = 0; i < 3; i++) { const t = i / 3 * Math.PI * 2; g.add(lineFromPts(ringPts(0.2, 8).map(p => [p[0] + Math.cos(t) * 5.2, p[1] + Math.sin(t) * 5.2]), m, true)); }
                    }
                },
                {
                    color: 0xffb35f, spin: 0.65, rMax: 4.6, build(g, m) { // 19 琥珀齿轮阵
                        for (let i = 0; i < 16; i++) { const t = i / 16 * Math.PI * 2; g.add(lineFromPts(arcPts(4.6, t, t + 0.3, 8), m, false)); }
                        g.add(lineFromPts(ringPts(3.9, 72), m, true));
                        const pr = [];
                        for (let i = 0; i < 8; i++) { const t = i / 8 * Math.PI * 2; pr.push([[Math.cos(t) * 1.2, Math.sin(t) * 1.2], [Math.cos(t) * 3.9, Math.sin(t) * 3.9]]); }
                        g.add(segsFromPairs(pr, m));
                        g.add(lineFromPts(ringPts(1.2, 36), m, true));
                        g.add(lineFromPts(polyPts(0.7, 6, 0), m, true));
                        g.add(lineFromPts(ringPts(0.3, 10), m, true));
                    }
                },
                {
                    color: 0xc9a8ff, spin: -1.0, rMax: 5.6, build(g, m) { // 20 淡紫花环
                        for (let k = 0; k < 8; k++) {
                            const t = k / 8 * Math.PI * 2;
                            g.add(lineFromPts(ringPts(1.5, 26, 0).map(p => [p[0] + Math.cos(t) * 2.9, p[1] + Math.sin(t) * 2.9]), m, true));
                        }
                        g.add(lineFromPts(ringPts(4.9, 96), m, true));
                        g.add(lineFromPts(ringPts(2.4, 48), m, true));
                        for (let i = 0; i < 8; i++) { const t = i / 8 * Math.PI * 2 + Math.PI / 8; g.add(lineFromPts(ringPts(0.18, 8).map(p => [p[0] + Math.cos(t) * 4.9, p[1] + Math.sin(t) * 4.9]), m, true)); }
                        g.add(lineFromPts(polyPts(0.9, 8, 0), m, true));
                        g.add(lineFromPts(ringPts(0.35, 12), m, true));
                    }
                },
                {
                    color: 0xff8f5f, spin: 0.75, rMax: 4.6, build(g, m) { // 21 红橙锯齿星环
                        g.add(lineFromPts(zigPts(3.1, 4.6, 12), m, true));
                        g.add(lineFromPts(zigPts(2.2, 3.2, 12), m, true));
                        g.add(lineFromPts(ringPts(4.6, 90), m, true));
                        g.add(lineFromPts(polyPts(1.4, 12, 0), m, true));
                        g.add(lineFromPts(ringPts(0.5, 16), m, true));
                    }
                },
                {
                    color: 0x7fb8ff, spin: -0.6, rMax: 5.8, build(g, m) { // 22 天蓝卫星大阵（中心阵+6卫星+辐条）
                        g.add(lineFromPts(polyPts(1.9, 6, 0), m, true));
                        g.add(lineFromPts(polyPts(1.9, 6, Math.PI / 6), m, true));
                        g.add(lineFromPts(ringPts(1.1, 36), m, true));
                        const pr = [];
                        for (let k = 0; k < 6; k++) { const t = k / 6 * Math.PI * 2; pr.push([[Math.cos(t) * 1.1, Math.sin(t) * 1.1], [Math.cos(t) * 4.1, Math.sin(t) * 4.1]]); }
                        g.add(segsFromPairs(pr, m));
                        g.add(lineFromPts(ringPts(5.8, 96), m, true));
                        for (let k = 0; k < 6; k++) { const t = k / 6 * Math.PI * 2; sat(g, m, Math.cos(t) * 4.1, Math.sin(t) * 4.1, 0.8, k % 4, t); }
                    }
                },
                {
                    color: 0xbfe06e, spin: 1.2, rMax: 5.0, build(g, m) { // 23 金绿同心多环
                        g.add(lineFromPts(ringPts(5.0, 96), m, true));
                        g.add(lineFromPts(ringPts(4.3, 84), m, true));
                        g.add(lineFromPts(ringPts(3.4, 72), m, true));
                        g.add(lineFromPts(ringPts(2.5, 60), m, true));
                        const pr = [];
                        for (let i = 0; i < 36; i++) { const t = i / 36 * Math.PI * 2; const l0 = i % 3 === 0 ? 2.5 : 3.4; pr.push([[Math.cos(t) * l0, Math.sin(t) * l0], [Math.cos(t) * (l0 + 0.28), Math.sin(t) * (l0 + 0.28)]]); }
                        g.add(segsFromPairs(pr, m));
                        g.add(lineFromPts(polyPts(1.2, 4, Math.PI / 4), m, true));
                        g.add(lineFromPts(ringPts(0.4, 12), m, true));
                    }
                },
                {
                    color: 0xfff0c8, spin: -0.45, rMax: 7.4, build(g, m) { // 24 白金终焉阵（顶层）
                        g.add(lineFromPts(ringPts(7.4, 120), m, true));
                        g.add(lineFromPts(starPts(6.6, 12, 5, 0), m, true));
                        g.add(lineFromPts(ringPts(4.4, 84), m, true));
                        g.add(lineFromPts(spiralPts(0.3, 3.4, 2.6, 100, 0), m, false));
                        const pr = [];
                        for (let i = 0; i < 24; i++) { const t = i / 24 * Math.PI * 2; pr.push([[Math.cos(t) * 4.4, Math.sin(t) * 4.4], [Math.cos(t) * 5.0, Math.sin(t) * 5.0]]); }
                        g.add(segsFromPairs(pr, m));
                        g.add(lineFromPts(polyPts(1.0, 12, 0), m, true));
                        g.add(lineFromPts(ringPts(0.45, 14), m, true));
                    }
                }
            ];
            ctx.LAYER_DEFS = LAYER_DEFS;

            /* ---- 构建水平巨型魔法阵塔（从下往上逐层错高） ---- */
            function buildBlastArray(center) {
                const root = new THREE.Group();
                root.position.copy(center);
                root.rotation.x = -Math.PI / 2;
                root.scale.setScalar(ARRAY_SCALE);
                const layers = [];
                LAYER_DEFS.forEach((def, i) => {
                    const grp = new THREE.Group();
                    let mat;
                    if (def.rainbow) mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
                    else mat = new THREE.LineBasicMaterial({ color: def.color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
                    def.build(grp, mat);
                    const fmat = new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
                    const fd = new THREE.Mesh(flashDiskGeoShared, fmat);
                    fd.scale.setScalar(def.rMax); fd.renderOrder = 3;
                    grp.add(fd);
                    grp.scale.setScalar(0.2);
                    const yOff = -5.4 + i * 0.47;
                    grp.position.z = yOff;
                    root.add(grp);
                    layers.push({ grp, mat, fmat, spin: def.spin, delay: i * ARRAY_STEP, rMax: def.rMax, yOff });
                });
                const haloMat = new THREE.MeshBasicMaterial({ color: 0x6ea8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
                const halo = new THREE.Mesh(new THREE.CircleGeometry(10.2, 48), haloMat);
                halo.renderOrder = 2;
                root.add(halo);
                ctx.scene.add(root);
                return { root, layers, halo, haloMat };
            }

            /* ---- 网状光球（膨胀→缩点→爆） ---- */
            function buildWireSphere(c) {
                const g = new THREE.Group(); g.position.copy(c); ctx.scene.add(g);
                const m1 = new THREE.LineBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
                const s1 = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1, 2)), m1);
                const m2 = new THREE.LineBasicMaterial({ color: 0xffd76e, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
                const s2 = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1, 1)), m2);
                const glowMat = new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
                const glow = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), glowMat);
                g.add(s1, s2, glow);
                return { g, s1, s2, m1, m2, glow, glowMat };
            }

            /* ---- 超级爆炸 ---- */
            function spawnExplosion(c) {
                const g = new THREE.Group(); ctx.scene.add(g);
                const items = [];
                const add = (obj, update) => { g.add(obj); items.push({ obj, update, alive: true }); };

                // 1) 双重黑白闪光（白闪 + 延迟金闪 + 黑描边环 + 十字光束）
                {
                    const fg = new THREE.Group(); fg.position.copy(c);
                    const wMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
                    const wDisk = new THREE.Mesh(new THREE.CircleGeometry(2.6, 44), wMat); wDisk.renderOrder = 8;
                    const gMat = new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
                    const gDisk = new THREE.Mesh(new THREE.CircleGeometry(1.8, 36), gMat); gDisk.renderOrder = 8;
                    const bMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false, fog: false });
                    const bRing = new THREE.Mesh(new THREE.RingGeometry(2.6, 3.9, 48), bMat); bRing.renderOrder = 9;
                    const beamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
                    const beamH = new THREE.Mesh(new THREE.PlaneGeometry(50, 1.2), beamMat); beamH.renderOrder = 10;
                    const beamV = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 50), beamMat); beamV.renderOrder = 10;
                    fg.add(wDisk, gDisk, bRing, beamH, beamV);
                    fg.lookAt(player.pos.x, c.y, player.pos.z);
                    add(fg, (bt) => {
                        const p = Math.min(1, bt / 0.42);
                        fg.scale.setScalar(0.3 + 2.6 * easeOutCubic(p));
                        const fade = 1 - p;
                        wMat.opacity = fade; bMat.opacity = 0.95 * fade; beamMat.opacity = 0.9 * fade;
                        if (bt > 0.16) {
                            const gp = Math.min(1, (bt - 0.16) / 0.4);
                            gDisk.visible = true;
                            gDisk.scale.setScalar(0.4 + 2.2 * easeOutCubic(gp));
                            gMat.opacity = 0.9 * (1 - gp);
                        }
                        return p < 1;
                    });
                }
                // 2) 放射光线束
                {
                    const pts = [];
                    for (let i = 0; i < 26; i++) {
                        const th = runtimeRng() * Math.PI * 2, ph = Math.acos(runtimeRng() * 2 - 1);
                        const d = ctx.V(Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th));
                        const L = 4 + runtimeRng() * 5;
                        pts.push(d.clone().multiplyScalar(1.2), d.clone().multiplyScalar(1.2 + L));
                    }
                    const rg = new THREE.BufferGeometry().setFromPoints(pts);
                    const mat = new THREE.LineBasicMaterial({ color: 0xfff2d8, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
                    const rays = new THREE.LineSegments(rg, mat);
                    const holder = new THREE.Group(); holder.position.copy(c); holder.add(rays);
                    add(holder, (bt) => {
                        const p = Math.min(1, bt / 0.42);
                        rays.scale.setScalar(0.25 + 0.85 * easeOutCubic(p));
                        mat.opacity = 1 - p;
                        return p < 1;
                    });
                }
                // 3) 核心：白→橙巨球 + 紫白内壳 + 红色能量壳
                {
                    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
                    const s = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 18), mat);
                    s.position.copy(c); s.renderOrder = 6;
                    add(s, (bt) => {
                        const p = Math.min(1, bt / 0.4);
                        s.scale.setScalar(0.5 + 13.0 * easeOutCubic(p));
                        mat.opacity = Math.max(0, 1 - bt / 0.75);
                        const cc = Math.min(1, bt / 0.45);
                        mat.color.setRGB(1, 1 - 0.32 * cc, 1 - 0.74 * cc);
                        return bt < 0.75;
                    });
                }
                {
                    const mat = new THREE.MeshBasicMaterial({ color: 0xd8b0ff, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
                    const s = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), mat);
                    s.position.copy(c); s.renderOrder = 5;
                    add(s, (bt) => {
                        const p = Math.min(1, bt / 0.34);
                        s.scale.setScalar(0.3 + 8.0 * easeOutCubic(p));
                        mat.opacity = 0.7 * Math.max(0, 1 - bt / 0.58);
                        return bt < 0.58;
                    });
                }
                {
                    const mat = new THREE.MeshBasicMaterial({ color: 0xff5a1e, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
                    const s = new THREE.Mesh(new THREE.SphereGeometry(1, 22, 16), mat);
                    s.position.copy(c); s.renderOrder = 5;
                    add(s, (bt) => {
                        const p = Math.min(1, bt / 0.62);
                        s.scale.setScalar(0.8 + 18.0 * easeOutCubic(p));
                        mat.opacity = 0.55 * Math.max(0, 1 - bt / 1.1);
                        return bt < 1.1;
                    });
                }
                // 4) 光柱冲天
                {
                    const mat = new THREE.MeshBasicMaterial({ color: 0xffe8c8, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
                    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 24, 1, true), mat);
                    const h = c.y + 12;
                    cyl.position.set(c.x, h / 2, c.z); cyl.renderOrder = 4;
                    add(cyl, (bt) => {
                        const p = Math.min(1, bt / 1.0);
                        const rr = 0.7 + 6.0 * easeOutCubic(p);
                        cyl.scale.set(rr, h, rr);
                        mat.opacity = 0.9 * (1 - p) * Math.min(1, bt / 0.06);
                        return p < 1;
                    });
                }
                // 5) 冲击波：水平×6 + 竖直×3
                function shock(delay, dur, maxR, y, color, vertical) {
                    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
                    const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.05, 8, 96), mat);
                    if (vertical) { m.position.copy(c); m.lookAt(player.pos.x, c.y, player.pos.z); m.renderOrder = 4; }
                    else { m.rotation.x = Math.PI / 2; m.position.set(c.x, y, c.z); }
                    add(m, (bt) => {
                        if (bt < delay) { m.visible = false; return true; }
                        m.visible = true;
                        const p = Math.min(1, (bt - delay) / dur);
                        m.scale.setScalar(1 + (maxR - 1) * easeOutCubic(p));
                        mat.opacity = 0.85 * (1 - p);
                        return p < 1;
                    });
                }
                shock(0, 1.0, 44, 0.1, 0xffffff, false);
                shock(0.12, 1.15, 37, 0.25, 0xff9955, false);
                shock(0.24, 1.3, 31, 0.4, 0x9fd4ff, false);
                shock(0.36, 1.4, 26, 0.55, 0xffd76e, false);
                shock(0.48, 1.5, 22, 0.7, 0xff9fd0, false);
                shock(0.6, 1.55, 18, 0.85, 0x9fffd8, false);
                shock(0.05, 0.85, 28, 0, 0xffffff, true);
                shock(0.18, 0.95, 22, 0, 0xffc890, true);
                shock(0.3, 1.05, 17, 0, 0xbfd0ff, true);
                // 6) 地面扩张光环×3（贴地发光圆环）
                for (let k = 0; k < 3; k++) {
                    const colors = [0xffffff, 0xffd76e, 0x9fd4ff];
                    const mat = new THREE.MeshBasicMaterial({ color: colors[k], transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
                    const m = new THREE.Mesh(new THREE.RingGeometry(0.94, 1.06, 96), mat);
                    m.rotation.x = -Math.PI / 2; m.position.set(c.x, 0.06, c.z);
                    add(m, (bt) => {
                        const delay = 0.1 + k * 0.2;
                        if (bt < delay) return true;
                        const p = Math.min(1, (bt - delay) / 1.2);
                        m.scale.setScalar(1.5 + (30 - k * 6) * easeOutCubic(p));
                        mat.opacity = 0.7 * (1 - p);
                        return p < 1;
                    });
                }
                // 7) 翻滚烟球
                const smokeGeoShared = new THREE.SphereGeometry(1, 12, 9);
                for (let i = 0; i < 22; i++) {
                    const mat = new THREE.MeshBasicMaterial({ color: 0x555560, transparent: true, opacity: 0, depthWrite: false });
                    const s = new THREE.Mesh(smokeGeoShared, mat);
                    s.renderOrder = 1;
                    const high = i < 9;
                    const a = runtimeRng() * Math.PI * 2;
                    const sp = 3 + runtimeRng() * 8.5;
                    const vel = ctx.V(Math.cos(a) * sp, high ? 5.5 + runtimeRng() * 8 : 1 + runtimeRng() * 4, Math.sin(a) * sp);
                    const r0 = 0.8 + runtimeRng() * 0.8;
                    const life = 1.7 + runtimeRng() * 0.9;
                    const delay = runtimeRng() * 0.2;
                    s.position.copy(c);
                    add(s, (bt, dt) => {
                        if (bt < delay) return true;
                        const lt = bt - delay, p = Math.min(1, lt / life);
                        s.position.addScaledVector(vel, dt);
                        vel.y -= 2.6 * dt;
                        vel.multiplyScalar(Math.max(0, 1 - 0.5 * dt));
                        if (s.position.y < r0 * 0.4) s.position.y = r0 * 0.4;
                        s.scale.setScalar(r0 + 3.8 * p);
                        mat.opacity = 0.72 * Math.min(1, lt / 0.15) * (1 - p);
                        const fc = Math.min(1, lt / 0.3);
                        mat.color.setRGB(0.9 - 0.62 * fc, 0.5 - 0.22 * fc, 0.32 - 0.05 * fc);
                        return p < 1;
                    });
                }
                // 8) 蘑菇状上升烟柱
                for (let i = 0; i < 8; i++) {
                    const mat = new THREE.MeshBasicMaterial({ color: 0x4a4a52, transparent: true, opacity: 0, depthWrite: false });
                    const s = new THREE.Mesh(smokeGeoShared, mat);
                    s.renderOrder = 1;
                    const delay = 0.15 + i * 0.12;
                    const rise = 4 + runtimeRng() * 3.5;
                    add(s, (bt) => {
                        if (bt < delay) return true;
                        const lt = bt - delay, p = Math.min(1, lt / 1.8);
                        s.position.set(c.x + Math.sin(lt * 2 + i) * 0.4, c.y * 0.4 + p * rise, c.z + Math.cos(lt * 1.7 + i) * 0.4);
                        s.scale.setScalar(1.2 + p * 3.6);
                        mat.opacity = 0.55 * Math.min(1, lt / 0.2) * (1 - p);
                        return p < 1;
                    });
                }
                // 9) 地面滚烟
                for (let i = 0; i < 12; i++) {
                    const mat = new THREE.MeshBasicMaterial({ color: 0x33333a, transparent: true, opacity: 0, depthWrite: false });
                    const s = new THREE.Mesh(smokeGeoShared, mat);
                    s.renderOrder = 1;
                    const a = runtimeRng() * Math.PI * 2;
                    const dir = ctx.V(Math.cos(a), 0, Math.sin(a));
                    const dist0 = 2 + runtimeRng() * 1.5;
                    const life = 1.6 + runtimeRng() * 0.6;
                    const delay = 0.1 + runtimeRng() * 0.3;
                    s.position.set(c.x + dir.x * dist0, 0.55, c.z + dir.z * dist0);
                    add(s, (bt, dt) => {
                        if (bt < delay) return true;
                        const lt = bt - delay, p = Math.min(1, lt / life);
                        s.position.addScaledVector(dir, 6.5 * dt * (1 - p * 0.6));
                        s.position.y = 0.5 + 0.3 * p;
                        s.scale.setScalar(0.7 + 2.8 * p);
                        mat.opacity = 0.6 * Math.min(1, lt / 0.12) * (1 - p);
                        return p < 1;
                    });
                }
                // 10) 飞散碎屑
                {
                    const debrisGeo = new THREE.OctahedronGeometry(1, 0);
                    for (let i = 0; i < 26; i++) {
                        const mat = new THREE.MeshBasicMaterial({ color: 0x4a3a2e, transparent: true, opacity: 1 });
                        const d = new THREE.Mesh(debrisGeo, mat);
                        const sc = 0.1 + runtimeRng() * 0.24;
                        const a = runtimeRng() * Math.PI * 2, up = 4 + runtimeRng() * 10;
                        const sp = 4 + runtimeRng() * 10;
                        const vel = ctx.V(Math.cos(a) * sp, up, Math.sin(a) * sp);
                        const rotV = ctx.V((runtimeRng() - 0.5) * 12, (runtimeRng() - 0.5) * 12, (runtimeRng() - 0.5) * 12);
                        d.scale.setScalar(sc);
                        d.position.copy(c);
                        add(d, (bt, dt) => {
                            d.position.addScaledVector(vel, dt);
                            vel.y -= 16 * dt;
                            if (d.position.y < sc * 0.5) { d.position.y = sc * 0.5; vel.set(vel.x * 0.6, Math.abs(vel.y) * 0.3, vel.z * 0.6); }
                            d.rotation.x += rotV.x * dt; d.rotation.y += rotV.y * dt; d.rotation.z += rotV.z * dt;
                            mat.opacity = Math.max(0, 1 - bt / 1.7);
                            return bt < 1.7;
                        });
                    }
                }
                // 11) 火花
                {
                    const N = 160;
                    const pos = new Float32Array(N * 3);
                    const vels = [];
                    for (let i = 0; i < N; i++) {
                        pos[i * 3] = c.x; pos[i * 3 + 1] = c.y; pos[i * 3 + 2] = c.z;
                        const th = runtimeRng() * Math.PI * 2, ph = Math.acos(runtimeRng() * 1.6 - 0.6);
                        const sp = 10 + runtimeRng() * 22;
                        vels.push(ctx.V(Math.sin(ph) * Math.cos(th) * sp, Math.cos(ph) * sp * 0.9 + 2, Math.sin(ph) * Math.sin(th) * sp));
                    }
                    const sg = new THREE.BufferGeometry();
                    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
                    const mat = new THREE.PointsMaterial({ color: 0xffcf8a, size: 0.13, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
                    const pts = new THREE.Points(sg, mat); pts.frustumCulled = false;
                    add(pts, (bt, dt) => {
                        for (let i = 0; i < N; i++) {
                            const v = vels[i];
                            pos[i * 3] += v.x * dt; pos[i * 3 + 1] += v.y * dt; pos[i * 3 + 2] += v.z * dt;
                            v.y -= 15 * dt;
                            if (pos[i * 3 + 1] < 0.04) { pos[i * 3 + 1] = 0.04; v.x *= 0.82; v.z *= 0.82; v.y = Math.abs(v.y) * 0.35; }
                        }
                        sg.attributes.position.needsUpdate = true;
                        mat.opacity = Math.max(0, 1 - bt / 1.45);
                        return bt < 1.45;
                    });
                }
                // 12) 彩色余烬
                {
                    const N = 60;
                    const pos = new Float32Array(N * 3);
                    const col = new Float32Array(N * 3);
                    const vels = [];
                    const eCols = [[1, 0.5, 0.15], [1, 0.75, 0.3], [1, 0.4, 0.1], [0.95, 0.9, 0.4], [1, 0.62, 0.22]];
                    for (let i = 0; i < N; i++) {
                        pos[i * 3] = c.x; pos[i * 3 + 1] = c.y; pos[i * 3 + 2] = c.z;
                        const th = runtimeRng() * Math.PI * 2, ph = Math.acos(runtimeRng() * 1.4 - 0.7);
                        const sp = 4 + runtimeRng() * 7;
                        vels.push(ctx.V(Math.sin(ph) * Math.cos(th) * sp, Math.abs(Math.cos(ph)) * sp * 0.8 + 2.5, Math.sin(ph) * Math.sin(th) * sp));
                        const cc = eCols[i % eCols.length];
                        col[i * 3] = cc[0]; col[i * 3 + 1] = cc[1]; col[i * 3 + 2] = cc[2];
                    }
                    const sg = new THREE.BufferGeometry();
                    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
                    sg.setAttribute('color', new THREE.BufferAttribute(col, 3));
                    const mat = new THREE.PointsMaterial({ vertexColors: true, size: 0.11, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
                    const pts = new THREE.Points(sg, mat); pts.frustumCulled = false;
                    add(pts, (bt, dt) => {
                        for (let i = 0; i < N; i++) {
                            const v = vels[i];
                            pos[i * 3] += v.x * dt; pos[i * 3 + 1] += v.y * dt; pos[i * 3 + 2] += v.z * dt;
                            v.y -= 5 * dt;
                            v.x *= (1 - 0.4 * dt); v.z *= (1 - 0.4 * dt);
                            if (pos[i * 3 + 1] < 0.05) { pos[i * 3 + 1] = 0.05; v.y = Math.abs(v.y) * 0.25; }
                        }
                        sg.attributes.position.needsUpdate = true;
                        mat.opacity = Math.max(0, 1 - bt / 2.5);
                        return bt < 2.5;
                    });
                }
                // 13) 十字星爆发（80 颗从爆心四散）
                {
                    const N = 80;
                    const bGeo = new THREE.BufferGeometry();
                    fillStarAttrs(bGeo, N);
                    const pos = bGeo.attributes.position.array;
                    const vels = [];
                    for (let i = 0; i < N; i++) {
                        pos[i * 3] = c.x; pos[i * 3 + 1] = c.y; pos[i * 3 + 2] = c.z;
                        const th = runtimeRng() * Math.PI * 2, ph = Math.acos(runtimeRng() * 2 - 1);
                        const sp = 9 + runtimeRng() * 17;
                        vels.push(ctx.V(Math.sin(ph) * Math.cos(th) * sp, Math.cos(ph) * sp, Math.sin(ph) * Math.sin(th) * sp));
                    }
                    const bMat = makeCrossStarMat();
                    const pts = new THREE.Points(bGeo, bMat); pts.frustumCulled = false;
                    add(pts, (bt, dt) => {
                        for (let i = 0; i < N; i++) {
                            const v = vels[i];
                            pos[i * 3] += v.x * dt; pos[i * 3 + 1] += v.y * dt; pos[i * 3 + 2] += v.z * dt;
                            v.multiplyScalar(Math.max(0, 1 - 1.1 * dt)); v.y -= 3.5 * dt;
                        }
                        bGeo.attributes.position.needsUpdate = true;
                        bMat.uniforms.uTime.value = bt;
                        bMat.uniforms.uOpacity.value = Math.max(0, 1 - bt / 1.7);
                        return bt < 1.7;
                    });
                }
                // 14) 二次爆震（延迟小爆闪）
                {
                    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
                    const d = new THREE.Mesh(new THREE.CircleGeometry(1, 30), mat);
                    const holder = new THREE.Group(); holder.position.copy(c); holder.add(d);
                    holder.lookAt(player.pos.x, c.y, player.pos.z);
                    let hit = false;
                    add(holder, (bt) => {
                        if (bt > 0.28 && bt < 0.62) {
                            const p = (bt - 0.28) / 0.34;
                            holder.scale.setScalar(1.2 + 5.5 * easeOutCubic(p));
                            mat.opacity = 0.85 * (1 - p);
                            if (!hit) { hit = true; ctx.camShake = Math.max(ctx.camShake, 0.55); ctx.slime.wobV += 1.6; }
                            return true;
                        }
                        return bt < 0.62;
                    });
                }
                // 15) 冲击波到达脚下：震屏 + 果冻后坐
                {
                    const dummy = new THREE.Object3D();
                    add(dummy, (bt) => {
                        if (bt > 0.55 && !dummy.userData.hit) { dummy.userData.hit = true; ctx.camShake = Math.max(ctx.camShake, 0.5); ctx.slime.wobV += 2.4; }
                        return bt < 0.7;
                    });
                }
                // 16) 地面焦痕 + 放射状龟裂（残效）
                {
                    const mat = new THREE.MeshBasicMaterial({ color: 0x0f0c0a, transparent: true, opacity: 0, depthWrite: false });
                    const mesh = new THREE.Mesh(new THREE.CircleGeometry(12, 48), mat);
                    mesh.rotation.x = -Math.PI / 2; mesh.position.set(c.x, 0.025, c.z);
                    ctx.scene.add(mesh);
                    let age = 0;
                    residues.push({
                        update(dt) {
                            age += dt;
                            mat.opacity = age < 0.3 ? (age / 0.3) * 0.55 : 0.55 * Math.max(0, 1 - (age - 0.3) / 8.5);
                            return age < 8.8;
                        },
                        dispose() { ctx.scene.remove(mesh); mesh.geometry.dispose(); mat.dispose(); }
                    });
                    // 龟裂
                    const cg = new THREE.Group();
                    const cmat = new THREE.LineBasicMaterial({ color: 0x17110c, transparent: true, opacity: 0 });
                    for (let i = 0; i < 16; i++) {
                        let ang = i / 16 * Math.PI * 2 + runtimeRng() * 0.25;
                        let r = 1.4;
                        const len = 5 + runtimeRng() * 5.5, steps = 7;
                        const pts = [];
                        for (let k = 0; k <= steps; k++) {
                            pts.push(ctx.V(c.x + Math.cos(ang) * r, 0.03, c.z + Math.sin(ang) * r));
                            r += len / steps;
                            ang += (runtimeRng() - 0.5) * 0.24;
                        }
                        cg.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), cmat));
                    }
                    ctx.scene.add(cg);
                    let cage = 0;
                    residues.push({
                        update(dt) {
                            cage += dt;
                            cmat.opacity = cage < 0.25 ? (cage / 0.25) * 0.8 : Math.max(0, 0.8 * (1 - (cage - 0.25) / 8.5));
                            return cage < 8.8;
                        },
                        dispose() { ctx.scene.remove(cg); disposeGroup(cg); }
                    });
                }
                let btAll = 0;
                return {
                    update(dt) {
                        btAll += dt;
                        for (const it of items) {
                            if (!it.alive) continue;
                            if (!it.update(btAll, dt)) { it.alive = false; it.obj.visible = false; }
                        }
                    },
                    dispose() { ctx.scene.remove(g); disposeGroup(g); }
                };
            }

            /* ---- 施法目标 ---- */
            function getCastTarget() {
                const point = new THREE.Vector3();
                let dir;
                if (ctx.viewMode === 'fp') {
                    ctx.camera.getWorldDirection(_v1);
                    const hl = Math.hypot(_v1.x, _v1.z);
                    if (hl > 0.12) {
                        const t = 21 / hl;
                        point.copy(ctx.camera.position).addScaledVector(_v1, t);
                        point.y = Math.max(4.5, Math.min(12, point.y));
                        dir = ctx.V(_v1.x / hl, 0, _v1.z / hl);
                    } else {
                        dir = ctx.V(Math.sin(player.yaw), 0, Math.cos(player.yaw));
                        point.copy(player.pos).addScaledVector(dir, 21); point.y = 7.6;
                    }
                } else {
                    dir = ctx.V(Math.sin(player.yaw), 0, Math.cos(player.yaw));
                    point.copy(player.pos).addScaledVector(dir, 21); point.y = 7.6;
                }
                return { point, dir };
            }

            function tryCast() {
                if (ctx.slotSel !== 2) { showHintOverride('需要先拿起魔杖 · 按 <b>2</b> 或在菜单中选择'); return; }
                if (blast.active) return;
                const tgt = getCastTarget();
                blast.target.copy(tgt.point);
                blast.active = true; blast.t = 0; blast.boom = null; blast.wire = null;
                blast.arr = buildBlastArray(blast.target);
                castStars.position.copy(blast.target);
                dustPts.position.set(blast.target.x, 0, blast.target.z);
                player.yaw = Math.atan2(tgt.dir.x, tgt.dir.z);
                ctx.slime.squashV += 0.7; ctx.slime.wobV += 1.2;
                ctx.SND.play('cast');
            }

            function selectSlot(n) {
                if (n !== 1 && n !== 2) return;
                if (n === ctx.slotSel) return;
                ctx.slotSel = n;
                ctx.SND.play('ui');
                document.getElementById('slot1').classList.toggle('on', n === 1);
                document.getElementById('slot2').classList.toggle('on', n === 2);
                if (n === 2) showHintOverride('已拿起魔杖 · 按 <b>F</b> 或<b>右键</b>释放爆裂魔法');
                else showHintOverride('收起魔杖');
            }

            /* ---- 魔杖：一阶惯性跟随转向（无回正摆动）+ 施法瞄准 ---- */
            ctx.wandYaw = Math.PI, ctx.wandAim = 0;
            const _qIdle = new THREE.Quaternion(), _qAim = new THREE.Quaternion(), _qMix = new THREE.Quaternion();
            ctx._qIdle = _qIdle; ctx._qAim = _qAim; ctx._qMix = _qMix;
            const _eTmp = new THREE.Euler();
            ctx._eTmp = _eTmp;
            function updateWand(dt, time) {
                const wantVis = ctx.slotSel === 2;
                ctx.wandAppear += ((wantVis ? 1 : 0) - ctx.wandAppear) * Math.min(1, dt * 9);
                wandRoot.visible = ctx.wandAppear > 0.02;
                if (!wandRoot.visible) { ctx.wandYaw = player.yaw; return; }

                ctx.wandYaw += angDiff(ctx.wandYaw, player.yaw) * Math.min(1, dt * 5.5);
                let lag = angDiff(player.yaw, ctx.wandYaw);
                lag = Math.max(-1.0, Math.min(1.0, lag));

                const casting = blast.active && blast.t < T_BOOM + 0.35;
                ctx.wandAim += ((casting ? 1 : 0) - ctx.wandAim) * Math.min(1, dt * 6);

                const px = casting ? 0.10 : 0.17;
                const py = casting ? 0.44 : 0.30;
                const pz = casting ? 0.26 : 0.10;
                const kk = Math.min(1, dt * 7);
                wandRoot.position.x += (px + lag * 0.06 - wandRoot.position.x) * kk;
                wandRoot.position.y += (py + Math.sin(time * 2.1) * 0.008 - wandRoot.position.y) * kk;
                wandRoot.position.z += (pz - wandRoot.position.z) * kk;
                wandRoot.scale.setScalar(0.35 + 0.65 * ctx.wandAppear);

                _eTmp.set(casting ? -1.05 : -0.55, lag * 0.6, (casting ? -0.08 : -0.18) + lag * 0.45);
                _qIdle.setFromEuler(_eTmp);
                if (blast.active && ctx.wandAim > 0.02) {
                    const dx = blast.target.x - player.pos.x;
                    const dv = blast.target.y - (player.pos.y + 0.5);
                    const dz = blast.target.z - player.pos.z;
                    const cy = Math.cos(player.yaw), sy = Math.sin(player.yaw);
                    const lx = dx * cy - dz * sy, lz = dx * sy + dz * cy;
                    _v1.set(lx, dv, lz).normalize();
                    _qAim.setFromUnitVectors(ctx.V(0, 1, 0), _v1);
                    _qMix.copy(_qIdle).slerp(_qAim, ctx.wandAim);
                } else _qMix.copy(_qIdle);
                wandRoot.quaternion.slerp(_qMix, kk);

                wandCrystal.rotation.y += dt * (casting ? 7 : 1.6);
                if (!(blast.active && blast.t < T_BOOM)) {
                    wandCrystalMat.color.copy(wandCrystalBase);
                    wandTipGlowMat.opacity = 0.3 + 0.12 * Math.sin(time * 2.6);
                    wandTipGlow.scale.setScalar(1 + 0.18 * Math.sin(time * 3.3));
                }
            }

            /* ---- 施法压暗 ---- */
            function applyCastDark() {
                if (ctx.castDark < 0.003) return;
                const f = 1 - ctx.castDark * 0.55;
                ctx.FILL.uniforms.uColor.value.multiplyScalar(f);
                ctx.scene.background.multiplyScalar(1 - ctx.castDark * 0.62);
                ctx.scene.fog.color.copy(ctx.scene.background);
            }

            /* ---- 爆裂魔法总调度 ---- */
            function updateBlast(dt, time) {
                for (let i = residues.length - 1; i >= 0; i--) {
                    const r = residues[i];
                    if (!r.update(dt)) { r.dispose(); residues.splice(i, 1); }
                }
                let starTarget = 0, dustTarget = 0;
                if (!blast.active) {
                    ctx.castDark = Math.max(0, ctx.castDark - dt * 2.2);
                    gatherMat.opacity = Math.max(0, gatherMat.opacity - dt * 3);
                    chargeMat.opacity = Math.max(0, chargeMat.opacity - dt * 4);
                } else {
                    blast.t += dt;
                    const t = blast.t;
                    if (t < T_CHARGE) {
                        const p = t / T_CHARGE;
                        wandTip.getWorldPosition(_v1);
                        const conv = 1 - easeOutCubic(p);
                        for (let i = 0; i < CHARGE_PN; i++) {
                            const d = chargeDir[i], rr = 0.22 + 3.0 * conv;
                            chargePos[i * 3] = _v1.x + d.x * rr;
                            chargePos[i * 3 + 1] = _v1.y + d.y * rr;
                            chargePos[i * 3 + 2] = _v1.z + d.z * rr;
                        }
                        chargeGeo.attributes.position.needsUpdate = true;
                        chargeMat.opacity = 0.9 * Math.min(1, p * 2.5);
                        wandCrystalMat.color.copy(wandCrystalBase).lerp(_whiteC, p * 0.85);
                        wandTipGlowMat.opacity = 0.3 + 0.7 * p;
                        wandTipGlow.scale.setScalar(1 + p * 2.6 + 0.12 * Math.sin(time * 18));
                        ctx.castDark = easeOutCubic(p);
                        starTarget = Math.max(0, (t - 1.0) / 1.2);
                    } else if (t < T_WIRE_START - T_COLLAPSE) {
                        chargeMat.opacity = Math.max(0, chargeMat.opacity - dt * 4);
                        wandTipGlowMat.opacity = 0.85 + 0.15 * Math.sin(time * 9);
                        const at = t - T_CHARGE;
                        let doneN = 0;
                        for (const L of blast.arr.layers) {
                            const lp = Math.min(1, Math.max(0, (at - L.delay) / ARRAY_GROW));
                            const e = easeOutCubic(lp);
                            if (lp >= 1) { doneN++; L.grp.scale.setScalar(1 + 0.012 * Math.sin(time * 2.6 + L.delay * 5)); L.grp.position.z = L.yOff; }
                            else { L.grp.scale.setScalar(0.2 + 0.8 * e); L.grp.position.z = L.yOff - (1 - e) * 1.4; }
                            L.grp.rotation.z = L.spin * at * (1 + 1.6 * (1 - e));
                            L.mat.opacity = lp < 1 ? lp : 0.72 + 0.28 * Math.sin(time * 3.2 + L.delay * 9);
                            L.fmat.opacity = (lp > 0 && lp < 0.45) ? 0.4 * (1 - lp / 0.45) : 0;
                        }
                        blast.arr.haloMat.opacity = (doneN / N_LAYERS) * (0.09 + 0.05 * Math.sin(time * 2.2));
                        blast.arr.root.position.y = blast.target.y + Math.sin(time * 1.2) * 0.18;
                        ctx.castDark = 1;
                        starTarget = Math.min(1, (t - 1.0) / 1.2);
                        dustTarget = Math.min(1, Math.max(0, (t - 2.0) / 1.5));
                    } else if (t < T_WIRE_START) {
                        const p = (t - (T_WIRE_START - T_COLLAPSE)) / T_COLLAPSE;
                        for (const L of blast.arr.layers) {
                            L.grp.scale.setScalar(Math.max(0.1, 1 - p * 0.85));
                            L.grp.rotation.z += L.spin * dt * (1 + 10 * p);
                            L.grp.position.z = L.yOff * (1 - p);
                            L.mat.opacity = 1;
                            L.fmat.opacity = 0;
                        }
                        blast.arr.haloMat.opacity = 0.1 + 0.5 * p;
                        blast.arr.haloMat.color.setRGB(0.43 + 0.57 * p, 0.66 + 0.34 * p, 1.0);
                        wandTipGlowMat.opacity = 1;
                        wandTipGlow.scale.setScalar(3.6 + 0.8 * Math.sin(time * 30));
                        ctx.castDark = 1; starTarget = 1; dustTarget = 1;
                    } else if (t < T_BOOM) {
                        if (!blast.wire) {
                            ctx.scene.remove(blast.arr.root); disposeGroup(blast.arr.root); blast.arr = null;
                            blast.wire = buildWireSphere(blast.target);
                            chargeMat.opacity = 0;
                        }
                        const tw = t - T_WIRE_START;
                        const W = blast.wire;
                        let R, op;
                        if (tw < T_WIRE_GROW) {
                            const p = tw / T_WIRE_GROW;
                            R = 0.4 + 10.2 * easeOutCubic(p);
                            op = Math.min(1, tw / 0.15);
                        } else {
                            const p = (tw - T_WIRE_GROW) / T_WIRE_SHRINK;
                            R = 0.05 + 10.2 * (1 - easeInCubic(p));
                            op = 1;
                            ctx.camShake = Math.max(ctx.camShake, 0.3 * p);
                            wandTipGlow.scale.setScalar(3.6 + 1.2 * Math.sin(time * 40));
                        }
                        W.s1.scale.setScalar(R); W.s2.scale.setScalar(R * 0.82);
                        W.s1.rotation.y += dt * (0.7 + (tw > T_WIRE_GROW ? 9 : 0));
                        W.s1.rotation.x += dt * 0.35;
                        W.s2.rotation.y -= dt * (1.1 + (tw > T_WIRE_GROW ? 12 : 0));
                        W.s2.rotation.z += dt * 0.5;
                        W.m1.opacity = op * (tw > T_WIRE_GROW ? 1 : 0.85);
                        W.m2.opacity = op * 0.9;
                        W.glow.scale.setScalar(Math.max(0.02, R * 0.55));
                        const heat = tw > T_WIRE_GROW ? (tw - T_WIRE_GROW) / T_WIRE_SHRINK : 0;
                        W.glowMat.opacity = (0.25 + 0.65 * heat) * op;
                        W.glowMat.color.setRGB(0.62 + 0.38 * heat, 0.9 + 0.1 * heat, 1.0);
                        ctx.castDark = 1; starTarget = 1; dustTarget = 1;
                    } else {
                        if (!blast.boom) {
                            if (blast.wire) { ctx.scene.remove(blast.wire.g); disposeGroup(blast.wire.g); blast.wire = null; }
                            blast.boom = spawnExplosion(blast.target);
                            screenFlash();
                            ctx.camShake = 1.1;
                            ctx.slime.wobV += 3.0; ctx.slime.squashV -= 0.6;
                        }
                        blast.boom.update(dt);
                        ctx.castDark = Math.max(0, 1 - (t - T_BOOM) / 0.7);
                        if (t > T_END) {
                            blast.boom.dispose();
                            blast.boom = null;
                            blast.active = false;
                        }
                    }
                    // 空中彩色魔力粒子
                    {
                        const gp = Math.min(1, t / (T_WIRE_START - 0.3));
                        const c = blast.target;
                        for (let i = 0; i < GATHER_N; i++) {
                            const d = gatherData[i];
                            const rr = d.r0 * Math.pow(1 - gp, 1.25) + 0.45;
                            const ang = time * d.spd + d.ph + gp * 5.0;
                            const ca = Math.cos(ang), sa = Math.sin(ang);
                            const rx = d.dx * ca + d.dz * sa;
                            const rz = -d.dx * sa + d.dz * ca;
                            gatherPos[i * 3] = c.x + rx * rr;
                            gatherPos[i * 3 + 1] = c.y + d.dy * rr + Math.sin(time * 2 + d.ph) * 0.25;
                            gatherPos[i * 3 + 2] = c.z + rz * rr;
                        }
                        gatherGeo.attributes.position.needsUpdate = true;
                        const targetOp = t < T_WIRE_START ? Math.min(1, t / 0.8) : Math.max(0, 1 - (t - T_WIRE_START) / 0.5);
                        gatherMat.opacity += (targetOp - gatherMat.opacity) * Math.min(1, dt * 5);
                    }
                }
                // 十字星 / 光尘状态
                castStarMat.uniforms.uTime.value = time;
                castStarMat.uniforms.uOpacity.value += (starTarget - castStarMat.uniforms.uOpacity.value) * Math.min(1, dt * (starTarget > 0 ? 1.6 : 5));
                castStars.rotation.y += dt * 0.12;
                castStars.visible = castStarMat.uniforms.uOpacity.value > 0.02;
                dustUniforms.uTime.value = time;
                dustUniforms.uOpacity.value += (dustTarget - dustUniforms.uOpacity.value) * Math.min(1, dt * (dustTarget > 0 ? 1.2 : 5));
                dustPts.visible = dustUniforms.uOpacity.value > 0.02;
                applyCastDark();
            }

            const player = { pos: new THREE.Vector3(0, 0, 5.2), vy: 0, yaw: Math.PI, moveSpeed: 0, onGround: true, groundT: 0 };
            ctx.player = player;
            ctx.camYaw = Math.PI, ctx.camPitch = 0.32, ctx.viewDist = 3.2, ctx.pendYaw = 0, ctx.pendPitch = 0;
            ctx.viewMode = 'fixed';
            const FIX_LOOK = ctx.V(0, 2.2, 0);
            ctx.FIX_LOOK = FIX_LOOK; ctx.fixYaw = Math.atan2(9.5, 11.5); ctx.fixPitch = Math.asin(5.0 / Math.hypot(9.5, 5.0, 11.5)); ctx.fixDist = Math.hypot(9.5, 5.0, 11.5);
            // J2.7：三段相机解算搬进 cabin/core/render/CameraRig.js（**逐字照搬**，行为零差异）。
            // 视角状态（fixYaw / camPitch / viewDist…）仍住在小屋这边，每帧经 state 传进去 ——
            // core/ 不碰具体状态量（不变量 N1）。mode 名与 viewMode 取值一一对应。
            const cameraRig = createCameraRig({ camera: ctx.camera, mode: ctx.viewMode });
            ctx.cameraRig = cameraRig;
            cameraRig.defineMode('fixed', (s, cam) => { const cp = Math.cos(s.fixPitch), sp = Math.sin(s.fixPitch); cam.position.set(s.look.x + Math.sin(s.fixYaw) * cp * s.fixDist, s.look.y + sp * s.fixDist, s.look.z + Math.cos(s.fixYaw) * cp * s.fixDist); cam.lookAt(s.look); });
            cameraRig.defineMode('fp', (s, cam) => { cam.position.set(s.player.pos.x, s.player.pos.y + 0.30, s.player.pos.z); cam.lookAt(s.player.pos.x + Math.sin(s.camYaw) * Math.cos(s.camPitch) * 10, s.player.pos.y + 0.30 + Math.sin(s.camPitch) * 10, s.player.pos.z + Math.cos(s.camYaw) * Math.cos(s.camPitch) * 10); });
            cameraRig.defineMode('tp', (s, cam) => { const cp = Math.cos(s.camPitch), sp = Math.sin(s.camPitch); const px = s.player.pos.x - Math.sin(s.camYaw) * cp * s.viewDist, py = s.player.pos.y + 0.34 + sp * s.viewDist, pz = s.player.pos.z - Math.cos(s.camYaw) * cp * s.viewDist; cam.position.set(px, Math.max(py, 0.25), pz); cam.lookAt(s.player.pos.x, s.player.pos.y + 0.25, s.player.pos.z); });
            const solidBoxes = [
                { x1: -4.85, z1: 3.80, x2: -0.78, z2: 4.20 }, { x1: 0.78, z1: 3.80, x2: 4.85, z2: 4.20 },
                { x1: -4.20, z1: -4.85, x2: 4.20, z2: -3.80 }, { x1: -4.20, z1: -4.85, x2: -3.80, z2: 4.85 },
                { x1: 3.80, z1: -4.85, x2: 4.20, z2: 4.85 }, { x1: -3.98, z1: 0.45, x2: -2.72, z2: 2.55 },
                { x1: -0.17, z1: -0.17, x2: 0.17, z2: 0.17 },
                { x1: -7.5, z1: 7.2, x2: -1.5, z2: 7.8 }, { x1: 1.5, z1: 7.2, x2: 7.5, z2: 7.8 },
                { x1: 2.78, z1: 5.98, x2: 3.42, z2: 6.62 },
                { x1: -6.18, z1: 5.82, x2: -5.42, z2: 6.58 },
                { x1: -5.58, z1: 6.42, x2: -4.82, z2: 7.18 },
                { x1: 5.22, z1: 6.12, x2: 5.98, z2: 6.88 },
                { x1: 7.26, z1: -6.14, x2: 7.94, z2: -5.46 },
                { x1: -8.54, z1: 3.26, x2: -7.86, z2: 3.94 },
                { x1: -6.84, z1: -8.84, x2: -6.16, z2: -8.16 },
                { x1: -60, z1: -60, x2: 60, z2: -19.55 },
                { x1: -60, z1: 19.55, x2: 60, z2: 60 },
                { x1: -60, z1: -60, x2: -19.55, z2: 60 },
                { x1: 19.55, z1: -60, x2: 60, z2: 60 }
            ];
            ctx.solidBoxes = solidBoxes;
            const DOOR_BOX = { x1: -0.85, z1: 3.78, x2: 0.85, z2: 4.22 };
            ctx.DOOR_BOX = DOOR_BOX; const PLAYER_R = 0.26;
            ctx.PLAYER_R = PLAYER_R;
            /* ===== 家具平台碰撞体：史莱姆可跳跃站上（top 为台面高度） ===== */
}
