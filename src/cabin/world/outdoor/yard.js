/**
 * 森林 / 草地 / 石头 / 花 / 萤火虫 —— 从 `legacy/monolith.js` 搬出的整段（outdoor）
 *
 * 来源：`J4` 段切片（段表见 `scripts/oneoff/_j4-segments.mjs`）。
 * 段内代码**逐字未改**，只做了三件事：包成函数、补 import、把跨段通信交给 `ctx`。
 * 因此这个文件的正确性判据与搬迁前完全一致：像素逐字节零差异。
 *
 * @param {object} ctx 段间通信载体（见 `installCabin` 的 `__J4_CTX__`）
 * @param {object} app 应用内核 —— 段里用到的 `registry`/`bus`/`scheduler`/`store` 从这里解构
 */
import * as THREE from 'three'
import { scene } from '../../app/rng.js'

export function installOutdoorYard(ctx, app) {
  const outdoorRng = scene.outdoor
            // ↓ J4 段导出（outdoor）：本段函数声明挂到 ctx（借提升，段内任何位置都可见）
            ctx.addStatic = addStatic; ctx.yardSpotFree = yardSpotFree; ctx.grassClumpStatic = grassClumpStatic; ctx.vHash = vHash; ctx.stoneStatic = stoneStatic;
            const staticFillGeoms = [], staticEdgeGeoms = [];
            ctx.staticFillGeoms = staticFillGeoms; ctx.staticEdgeGeoms = staticEdgeGeoms;
            function addStatic(g, x, y, z, rx, ry, rz, sx, sy, sz) {
                const m = new THREE.Matrix4();
                const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0));
                const s = (sx === undefined) ? 1 : sx;
                m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, (sy === undefined) ? s : sy, (sz === undefined) ? s : sz));
                const g2 = g.clone().applyMatrix4(m);
                staticFillGeoms.push(g2);
                staticEdgeGeoms.push(new THREE.EdgesGeometry(g2, 1));
            }

            const STUMPS = [[7.6, -5.8], [-8.2, 3.6], [-6.5, -8.5]];
            ctx.STUMPS = STUMPS;
            function yardSpotFree(x, z) {
                if (x > -5.05 && x < 5.05 && z > -5.05 && z < 5.05) return false;
                if (x > -1.35 && x < 1.35 && z > 4.35 && z < 5.3) return false;
                if (x > -0.7 && x < 0.7 && z > 4.9 && z < 7.9) return false;
                if (x > 2.5 && x < 3.7 && z > 5.7 && z < 6.9) return false;
                for (const st of STUMPS) if (Math.hypot(x - st[0], z - st[1]) < 0.6) return false;
                return true;
            }

            const TREE_TRUNK = new THREE.CylinderGeometry(0.10, 0.17, 1.3, 7);
            ctx.TREE_TRUNK = TREE_TRUNK;
            const TREE_C1 = new THREE.ConeGeometry(1.35, 1.7, 7);
            ctx.TREE_C1 = TREE_C1;
            const TREE_C2 = new THREE.ConeGeometry(1.05, 1.55, 7);
            ctx.TREE_C2 = TREE_C2;
            const TREE_C3 = new THREE.ConeGeometry(0.75, 1.4, 7);
            ctx.TREE_C3 = TREE_C3;
            const TREE_C4 = new THREE.ConeGeometry(0.45, 1.2, 7);
            ctx.TREE_C4 = TREE_C4;
            {
                for (let r = 20.8; r < 34.5; r += 2.9) {
                    const circ = Math.PI * 2 * r;
                    const step = 3.4 + outdoorRng() * 1.9;
                    const n = Math.max(8, Math.floor(circ / step));
                    for (let i = 0; i < n; i++) {
                        const a = (i / n) * Math.PI * 2 + r * 0.53;
                        const rr = r + (outdoorRng() - 0.5) * 2.1;
                        const aa = a + (outdoorRng() - 0.5) * 0.5 * (step / r);
                        const tx = Math.cos(aa) * rr, tz = Math.sin(aa) * rr;
                        if (Math.abs(tx) < 2.4 && tz > 14) continue;
                        const s = 1.2 + ((rr - 20.8) / 13.7) * 0.5 + outdoorRng() * 0.75;
                        const ry = outdoorRng() * Math.PI * 2;
                        addStatic(TREE_TRUNK, tx, 0.65 * s, tz, 0, ry, 0, s, s, s);
                        addStatic(TREE_C1, tx, 1.78 * s, tz, 0, ry, 0, s, s, s);
                        addStatic(TREE_C2, tx, 2.30 * s, tz, 0, ry, 0, s, s, s);
                        addStatic(TREE_C3, tx, 2.82 * s, tz, 0, ry, 0, s, s, s);
                        addStatic(TREE_C4, tx, 3.35 * s, tz, 0, ry, 0, s, s, s);
                    }
                }
            }

            const GRASS_BLADE = new THREE.ConeGeometry(0.022, 1, 4);
            ctx.GRASS_BLADE = GRASS_BLADE;
            function grassClumpStatic(x, z) {
                const n = 2 + Math.floor(outdoorRng() * 2);
                for (let i = 0; i < n; i++) {
                    const h = 0.10 + outdoorRng() * 0.12;
                    const ang = outdoorRng() * Math.PI * 2;
                    const bx = Math.cos(ang) * 0.04, bz = Math.sin(ang) * 0.04;
                    const lean = 0.18 + outdoorRng() * 0.22;
                    addStatic(GRASS_BLADE, x + bx, h * 0.5 - 0.01, z + bz,
                        Math.cos(ang) * lean, outdoorRng() * Math.PI, Math.sin(ang) * lean,
                        1, h, 1);
                }
            }

            function vHash(x, y, z, seed) {
                const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed) * 43758.5453;
                return s - Math.floor(s);
            }
            function stoneStatic(x, z) {
                const s = 0.05 + outdoorRng() * 0.07;
                const g = new THREE.IcosahedronGeometry(1, 0);
                const pa = g.attributes.position;
                const seed = outdoorRng() * 100;
                for (let i = 0; i < pa.count; i++) {
                    const vx = pa.getX(i), vy = pa.getY(i), vz = pa.getZ(i);
                    const jx = 0.78 + vHash(vx, vy, vz, seed) * 0.44;
                    const jy = 0.72 + vHash(vx + 1.3, vy + 0.7, vz + 2.1, seed) * 0.44;
                    const jz = 0.78 + vHash(vx + 3.7, vy + 5.9, vz + 8.3, seed) * 0.44;
                    pa.setXYZ(i, vx * jx, vy * jy, vz * jz);
                }
                g.computeVertexNormals();
                addStatic(g, x, s * 0.35, z,
                    (outdoorRng() - 0.5) * 0.6, outdoorRng() * Math.PI, (outdoorRng() - 0.5) * 0.6,
                    s * (0.85 + outdoorRng() * 0.5), s * (0.6 + outdoorRng() * 0.5), s * (0.85 + outdoorRng() * 0.5));
            }

            const STUMP_G = new THREE.CylinderGeometry(0.24, 0.3, 0.55, 9);
            ctx.STUMP_G = STUMP_G;
            for (const [sx, sz] of STUMPS) addStatic(STUMP_G, sx, 0.26, sz, 0, outdoorRng() * Math.PI, 0, 1, 1, 1);
            for (const [px, pz] of [[0, 5.55], [0.34, 6.15], [-0.18, 6.75], [0.22, 7.32]]) {
                addStatic(new THREE.BoxGeometry(0.62, 0.05, 0.46), px, 0.028, pz, 0, (outdoorRng() - 0.5) * 0.35, 0, 1, 1, 1);
            }

            {
                let gN = 0, guard = 0;
                while (gN < 70 && guard++ < 1200) {
                    const x = (outdoorRng() - 0.5) * 30, z = (outdoorRng() - 0.5) * 30;
                    if (Math.abs(x) > 15 || Math.abs(z) > 15) continue;
                    if (!yardSpotFree(x, z)) continue;
                    grassClumpStatic(x, z); gN++;
                }
                let sN = 0; guard = 0;
                while (sN < 26 && guard++ < 1200) {
                    const x = (outdoorRng() - 0.5) * 30, z = (outdoorRng() - 0.5) * 30;
                    if (Math.abs(x) > 15 || Math.abs(z) > 15) continue;
                    if (!yardSpotFree(x, z)) continue;
                    stoneStatic(x, z); sN++;
                }
            }

            const flowerMats = [];
            ctx.flowerMats = flowerMats;
            const PETAL_G = new THREE.ConeGeometry(0.055, 0.09, 6);
            ctx.PETAL_G = PETAL_G;
            const FLOWER_COLORS = [0xd95763, 0xe8b64c, 0x9a6fd0, 0xe07fa8];
            ctx.FLOWER_COLORS = FLOWER_COLORS;
            {
                let fN = 0, guard = 0;
                while (fN < 12 && guard++ < 800) {
                    const x = (outdoorRng() - 0.5) * 30, z = (outdoorRng() - 0.5) * 30;
                    if (Math.abs(x) > 15 || Math.abs(z) > 15) continue;
                    if (!yardSpotFree(x, z)) continue;
                    addStatic(new THREE.CylinderGeometry(0.012, 0.018, 0.24, 5), x, 0.12, z, 0, 0, 0, 1, 1, 1);
                    const hex = FLOWER_COLORS[fN % FLOWER_COLORS.length];
                    const mat = new THREE.MeshBasicMaterial({ color: hex });
                    flowerMats.push({ mat, base: new THREE.Color(hex) });
                    const head = new THREE.Group();
                    head.add(new THREE.Mesh(PETAL_G, mat));
                    head.add(new THREE.LineSegments(new THREE.EdgesGeometry(PETAL_G), ctx.MAT));
                    ctx.put(head, x, 0.295, z, 0, outdoorRng() * Math.PI, 0);
                    fN++;
                }
            }

            (function mergeStatic() {
                let vTotal = 0, iTotal = 0;
                for (const g of staticFillGeoms) { vTotal += g.attributes.position.count; iTotal += g.index ? g.index.count : g.attributes.position.count; }
                const pos = new Float32Array(vTotal * 3), nor = new Float32Array(vTotal * 3);
                const idx = new Uint32Array(iTotal);
                let vo = 0, io = 0;
                for (const g of staticFillGeoms) {
                    pos.set(g.attributes.position.array, vo * 3);
                    if (g.attributes.normal) nor.set(g.attributes.normal.array, vo * 3);
                    const vc = g.attributes.position.count;
                    if (g.index) { const ia = g.index.array; for (let i = 0; i < ia.length; i++) idx[io + i] = ia[i] + vo; io += ia.length; }
                    else { for (let i = 0; i < vc; i++) idx[io + i] = i + vo; io += vc; }
                    vo += vc;
                }
                const fillGeo = new THREE.BufferGeometry();
                fillGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
                fillGeo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
                fillGeo.setIndex(new THREE.BufferAttribute(idx, 1));
                ctx.scene.add(new THREE.Mesh(fillGeo, ctx.FILL));
                let eTotal = 0;
                for (const g of staticEdgeGeoms) eTotal += g.attributes.position.count;
                const epos = new Float32Array(eTotal * 3);
                let eo = 0;
                for (const g of staticEdgeGeoms) { epos.set(g.attributes.position.array, eo * 3); eo += g.attributes.position.count; }
                const edgeGeo = new THREE.BufferGeometry();
                edgeGeo.setAttribute('position', new THREE.BufferAttribute(epos, 3));
                ctx.scene.add(new THREE.LineSegments(edgeGeo, ctx.MAT));
            })();

            const FF_N = 26;
            ctx.FF_N = FF_N;
            const fireflies = [];
            ctx.fireflies = fireflies;
            for (let i = 0; i < FF_N; i++) {
                let x = 0, z = 0, ok = false, guard = 0;
                while (!ok && guard++ < 200) {
                    x = (outdoorRng() - 0.5) * 33; z = (outdoorRng() - 0.5) * 33;
                    if (Math.abs(x) > 16.5 || Math.abs(z) > 16.5) continue;
                    ok = yardSpotFree(x, z);
                }
                fireflies.push({ bx: x, by: 0.35 + outdoorRng() * 1.25, bz: z, ph: outdoorRng() * 7, sp: 0.45 + outdoorRng() * 0.7, amp: 0.5 + outdoorRng() * 0.9 });
            }
            const ffPos = new Float32Array(FF_N * 3);
            ctx.ffPos = ffPos;
            const ffPhase = new Float32Array(FF_N);
            ctx.ffPhase = ffPhase;
            for (let i = 0; i < FF_N; i++) { ffPos[i * 3] = fireflies[i].bx; ffPos[i * 3 + 1] = fireflies[i].by; ffPos[i * 3 + 2] = fireflies[i].bz; ffPhase[i] = outdoorRng(); }
            const ffGeo = new THREE.BufferGeometry();
            ctx.ffGeo = ffGeo;
            ffGeo.setAttribute('position', new THREE.BufferAttribute(ffPos, 3));
            ffGeo.setAttribute('aPhase', new THREE.BufferAttribute(ffPhase, 1));
            const ffUniforms = { uTime: { value: 0 }, uOpacity: { value: 0 } };
            ctx.ffUniforms = ffUniforms;
            const ffMat = new THREE.ShaderMaterial({
                uniforms: ffUniforms,
                vertexShader: `
        attribute float aPhase;
        uniform float uTime;
        varying float vBlink;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          float tw = abs(sin(uTime * 1.25 + aPhase * 6.2831));
          vBlink = 0.15 + 0.85 * pow(tw, 3.0);
          gl_PointSize = (2.2 + 2.6 * vBlink) * (150.0 / -mv.z);
        }`,
                fragmentShader: `
        varying float vBlink;
        uniform float uOpacity;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          if (d > 0.5) discard;
          float a = (1.0 - d * 2.0) * (1.0 - d * 2.0) * vBlink * uOpacity * 0.9;
          gl_FragColor = vec4(0.82, 1.0, 0.52, a);
        }`,
                transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false
            });
            ctx.ffMat = ffMat;
            const fireflyPts = new THREE.Points(ffGeo, ffMat);
            ctx.fireflyPts = fireflyPts; fireflyPts.frustumCulled = false; ctx.scene.add(fireflyPts);
            ctx.ffOpacity = 0;

            /* ========================================================== */
            /* ============ 室内陈设专用：圆角几何与材质工具 ============ */
            /* ========================================================== */
            // J2.1：圆角几何已提取到 cabin/core/geometry/roundBox.js（实现零改动）
}
