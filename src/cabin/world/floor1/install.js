/**
 * 一楼陈设 —— 从 `legacy/monolith.js` 搬出的整段（floor1）
 *
 * 来源：`J4` 段切片（段表见 `scripts/oneoff/_j4-segments.mjs`）。
 * 段内代码**逐字未改**，只做了三件事：包成函数、补 import、把跨段通信交给 `ctx`。
 * 因此这个文件的正确性判据与搬迁前完全一致：像素逐字节零差异。
 *
 * @param {object} ctx 段间通信载体（见 `installCabin` 的 `__J4_CTX__`）
 * @param {object} app 应用内核 —— 段里用到的 `registry`/`bus`/`scheduler`/`store` 从这里解构
 */
import * as THREE from 'three'
import bookPile from './bookPile.js'
import bookshelf from './bookshelf.js'
import broom from './broom.js'
import cauldron from './cauldron.js'
import chest from './chest.js'
import diningBook from './diningBook.js'
import diningTable from './diningTable.js'
import doorHangBar from './doorHangBar.js'
import hourglass from './hourglass.js'
import longTable from './longTable.js'
import orrery from './orrery.js'
import potionBottle from './potionBottle.js'
import rugUnderTable from './rugUnderTable.js'
import starBell from './starBell.js'
import stools from './stools.js'
import stovePlatform from './stovePlatform.js'
import tableware from './tableware.js'
import tarot from './tarot.js'
import { scene } from '../../app/rng.js'

export function installFloor1(ctx, app) {
  const floor1Rng = scene.floor1
            // ↓ J4 段导出（floor1）：本段函数声明挂到 ctx（借提升，段内任何位置都可见）
            ctx.makeCup = makeCup; ctx.makeChair = makeChair; ctx.startQuill = startQuill; ctx.makeCushion = makeCushion;
            ctx.installProp(diningTable);
            // ---- 12.2 星象仪 ----
            // J3（B4）：几何已搬入 src/cabin/world/floor1/orrery.js，此处只留装配调用。
            const orreryApi = ctx.installProp(orrery);
            ctx.orreryApi = orreryApi;
            // ---- 12.3 魔法药剂瓶 ----
            // J3（B4）：几何已搬入 src/cabin/world/floor1/potionBottle.js，此处只留装配调用。
            const potionBottleApi = ctx.installProp(potionBottle);
            ctx.potionBottleApi = potionBottleApi;
            // ---- 12.4 魔法书 ----
            // J3（B4）：几何已搬入 src/cabin/world/floor1/diningBook.js，此处只留装配调用。
            const diningBookApi = ctx.installProp(diningBook);
            ctx.diningBookApi = diningBookApi;
            // ---- 12.5 三脚圆凳 ----
            // J3（B2）：几何已搬入 src/cabin/world/floor1/stools.js，此处只留装配调用。
            const stoolsApi = ctx.installProp(stools);
            ctx.stoolsApi = stoolsApi;
            // ---- 12.6 桌下椭圆地毯 ----
            // J3（B1）：几何已搬入 cabin/world/floor1/rugUnderTable.js，此处只留装配调用。
            ctx.installProp(rugUnderTable);

            // ---- 12.7 吊挂木灯 ----
            ctx.lanternLit = true;
            const lanternPivot = new THREE.Group();
            ctx.lanternPivot = lanternPivot;
            lanternPivot.position.set(ctx.MTX, 2.88, ctx.MTZ);
            ctx.scene.add(lanternPivot);
            ctx.put(ctx.line([[0, 0, 0], [0, -0.26, 0]]), 0, 0, 0, 0, 0, 0, lanternPivot);
            const lantG = new THREE.Group();
            ctx.lantG = lantG;
            lantG.position.y = -0.44;
            lanternPivot.add(lantG);
            ctx.put(ctx.edge(new THREE.ConeGeometry(0.09, 0.07, 4)), 0, 0.13, 0, 0, 0, 0, lantG);
            ctx.put(ctx.box(0.16, 0.2, 0.16), 0, 0, 0, 0, 0, 0, lantG);
            for (const s of [[0, 0.085], [0, -0.085], [0.085, 0], [-0.085, 0]])
                ctx.put(ctx.line([[s[0], 0.1, s[1]], [s[0], -0.1, s[1]]]), 0, 0, 0, 0, 0, 0, lantG);
            const lanternFlame = new THREE.Group();
            ctx.lanternFlame = lanternFlame;
            ctx.put(ctx.line([[0, -0.06, 0], [0.014, -0.02, 0], [0.014, 0.015, 0], [0, 0.06, 0]]), 0, 0, 0, 0, 0, 0, lanternFlame);
            lantG.add(lanternFlame);

            const haloMat = new THREE.MeshBasicMaterial({ color: 0xffd88f, transparent: true, opacity: 0.14, depthWrite: false });
            ctx.haloMat = haloMat;
            const halo = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), haloMat);
            ctx.halo = halo;
            halo.userData.noHit = true;
            ctx.put(halo, 0, 0, 0, 0, 0, 0, lantG);

            const beamMat = new THREE.MeshBasicMaterial({ color: 0xffc46b, transparent: true, opacity: 0.09, depthWrite: false, side: THREE.DoubleSide });
            ctx.beamMat = beamMat;
            const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.85, 2.35, 24, 1, true), beamMat);
            ctx.beam = beam;
            beam.userData.noHit = true;
            ctx.put(beam, 0, -1.52, 0, 0, 0, 0, lanternPivot);

            const glowMatA = new THREE.MeshBasicMaterial({ color: 0xffc46b, transparent: true, opacity: 0.09, depthWrite: false, side: THREE.DoubleSide });
            ctx.glowMatA = glowMatA;
            const glowMatB = new THREE.MeshBasicMaterial({ color: 0xffd88f, transparent: true, opacity: 0.075, depthWrite: false, side: THREE.DoubleSide });
            ctx.glowMatB = glowMatB;
            const floorPool = new THREE.Mesh(new THREE.CircleGeometry(1.15, 28), glowMatA);
            ctx.floorPool = floorPool;
            floorPool.userData.noHit = true;
            ctx.put(floorPool, ctx.MTX, 0.012, ctx.MTZ, -Math.PI / 2, 0, 0);
            const floorPool2 = new THREE.Mesh(new THREE.CircleGeometry(0.7, 24), glowMatB);
            ctx.floorPool2 = floorPool2;
            floorPool2.userData.noHit = true;
            ctx.put(floorPool2, ctx.MTX, 0.014, ctx.MTZ, -Math.PI / 2, 0, 0);
            const tablePool = new THREE.Mesh(new THREE.CircleGeometry(0.8, 24), glowMatB);
            ctx.tablePool = tablePool;
            tablePool.userData.noHit = true;
            ctx.put(tablePool, ctx.MTX, 0.795, ctx.MTZ, -Math.PI / 2, 0, 0);
            ctx.regMagic(lanternPivot, () => { ctx.lanternLit = !ctx.lanternLit; });

            /* ---- 12.8 壁炉旁的猫 ---- */
            ctx.catAwake = false, ctx.catP = 0;
            const catG = new THREE.Group();
            ctx.catG = catG;
            catG.position.set(-1.85, 0, 1.45);
            catG.rotation.y = Math.PI;
            ctx.scene.add(catG);
            const catBody = new THREE.Group();
            ctx.catBody = catBody;
            catG.add(catBody);
            {
                const bodyMesh = new THREE.Mesh(new THREE.SphereGeometry(0.175, 16, 12), ctx.CATMAT);
                bodyMesh.scale.set(1.28, 0.74, 0.95);
                ctx.put(bodyMesh, 0, 0.125, 0, 0, 0, 0, catBody);

                for (const s of [1, -1]) {
                    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.048, 10, 8), ctx.CATMAT2);
                    paw.scale.set(0.9, 0.55, 1.15);
                    ctx.put(paw, 0.20, 0.072, s * 0.082, 0, 0, s * 0.18, catBody);
                }
            }
            const catHead = new THREE.Group();
            ctx.catHead = catHead;
            catHead.position.set(0.215, 0.265, 0.02);
            catBody.add(catHead);
            ctx.put(new THREE.Mesh(new THREE.SphereGeometry(0.105, 16, 12), ctx.CATMAT), 0, 0, 0, 0, 0, 0, catHead);
            const earLG = new THREE.Group();
            ctx.earLG = earLG;
            earLG.position.set(-0.052, 0.078, 0.012);
            catHead.add(earLG);
            ctx.put(new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.092, 8), ctx.CATMAT), 0, 0.034, 0, 0, Math.PI / 4, -0.20, earLG);
            ctx.put(new THREE.Mesh(new THREE.ConeGeometry(0.023, 0.058, 6), ctx.PINK), 0, 0.030, 0.011, 0, Math.PI / 4, -0.20, earLG);
            const earRG = new THREE.Group();
            ctx.earRG = earRG;
            earRG.position.set(0.046, 0.080, 0.014);
            catHead.add(earRG);
            ctx.put(new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.092, 8), ctx.CATMAT), 0, 0.034, 0, 0, Math.PI / 4, 0.20, earRG);
            ctx.put(new THREE.Mesh(new THREE.ConeGeometry(0.023, 0.058, 6), ctx.PINK), 0, 0.030, 0.011, 0, Math.PI / 4, 0.20, earRG);
            const eyesOpen = new THREE.Group();
            ctx.eyesOpen = eyesOpen;
            catHead.add(eyesOpen);
            for (const ex of [-0.038, 0.034]) {
                ctx.put(new THREE.Mesh(new THREE.SphereGeometry(0.013, 8, 6), ctx.DARK), ex, 0.008, 0.088, 0, 0, 0, eyesOpen);
                ctx.put(new THREE.Mesh(new THREE.SphereGeometry(0.0042, 6, 4),
                    ctx.LITMAT(0xffffff)), ex + 0.005, 0.014, 0.096, 0, 0, 0, eyesOpen);
            }
            /* 闭眼：= 号（每眼两条短横线） */
            const eyesClosed = new THREE.Group();
            ctx.eyesClosed = eyesClosed;
            eyesClosed.visible = false;
            catHead.add(eyesClosed);
            for (const ex of [-0.038, 0.034]) {
                ctx.put(ctx.line([[ex - 0.016, 0.012, 0.091], [ex + 0.016, 0.012, 0.091]]), 0, 0, 0, 0, 0, 0, eyesClosed);
                ctx.put(ctx.line([[ex - 0.016, -0.002, 0.091], [ex + 0.016, -0.002, 0.091]]), 0, 0, 0, 0, 0, 0, eyesClosed);
            }
            ctx.put(new THREE.Mesh(new THREE.OctahedronGeometry(0.011), ctx.PINK), 0, -0.014, 0.100, 0, 0, 0, catHead);
            ctx.put(ctx.line([[0, -0.019, 0.100], [0, -0.026, 0.098]]), 0, 0, 0, 0, 0, 0, catHead);
            ctx.put(ctx.line([
                [-0.017, -0.024, 0.096],
                [-0.014, -0.034, 0.098],
                [-0.006, -0.038, 0.100],
                [0.000, -0.030, 0.100],
                [0.006, -0.038, 0.100],
                [0.014, -0.034, 0.098],
                [0.017, -0.024, 0.096]
            ]), 0, 0, 0, 0, 0, 0, catHead);
            for (const s of [-1, 1])
                ctx.put(new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6),
                    new THREE.MeshBasicMaterial({ color: 0xf2b0b6, transparent: true, opacity: 0.55 })),
                    s * 0.063, -0.012, 0.075, 0, 0, 0, catHead);
            for (const s of [-1, 1]) {
                ctx.put(ctx.line([[s * 0.070, 0.008, 0.075], [s * 0.142, 0.016, 0.081]]), 0, 0, 0, 0, 0, 0, catHead);
                ctx.put(ctx.line([[s * 0.070, -0.006, 0.075], [s * 0.142, -0.012, 0.081]]), 0, 0, 0, 0, 0, 0, catHead);
            }
            const tailSegs = [];
            ctx.tailSegs = tailSegs;
            {
                const seg1 = new THREE.Group();
                seg1.position.set(-0.20, 0.10, 0.11);
                catBody.add(seg1);
                ctx.solidCyl([0, 0, 0], [0.06, 0.00, 0.15], 0.023, seg1);
                const seg2 = new THREE.Group();
                seg2.position.set(0.06, 0.00, 0.15);
                seg1.add(seg2);
                ctx.solidCyl([0, 0, 0], [0.17, -0.01, 0.03], 0.021, seg2);
                const seg3 = new THREE.Group();
                seg3.position.set(0.17, -0.01, 0.03);
                seg2.add(seg3);
                ctx.solidCyl([0, 0, 0], [0.14, -0.02, -0.06], 0.019, seg3);
                ctx.put(new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 6), ctx.CATMAT2), 0.14, -0.02, -0.06, 0, 0, 0, seg3);
                tailSegs.push(seg1, seg2, seg3);
            }
            const catHit = new THREE.Mesh(new THREE.SphereGeometry(0.20, 8, 6), ctx.HITMAT);
            ctx.catHit = catHit;
            catHit.position.set(0, 0.12, 0);
            catG.add(catHit);
            ctx.regMagic(catG, () => { ctx.catAwake = !ctx.catAwake; });
            catG.userData.sfx = 'cat';

            /* ---- 猫旁边：毛线球 ---- */
            const yarnG = new THREE.Group();
            ctx.yarnG = yarnG;
            yarnG.position.set(-1.28, 0, 1.02);
            ctx.scene.add(yarnG);
            const yarnBall = new THREE.Group();
            ctx.yarnBall = yarnBall;
            yarnG.add(yarnBall);
            {
                ctx.put(ctx.edge(new THREE.SphereGeometry(0.085, 12, 9)), 0, 0.085, 0, 0, 0, 0, yarnBall);
                for (const [rx, ry] of [[Math.PI / 2, 0], [Math.PI / 2, 0.9], [Math.PI / 2, -0.7], [0.5, 0.3], [-0.6, 1.2]]) {
                    const pts = [];
                    for (let i = 0; i <= 20; i++) { const a = i / 20 * Math.PI * 2; pts.push([Math.cos(a) * 0.086, Math.sin(a) * 0.086, 0]); }
                    ctx.put(new THREE.LineLoop(ctx.geo(pts), ctx.MAT), 0, 0.085, 0, rx, ry, 0, yarnBall);
                }
                ctx.put(ctx.line([[0.06, 0.115, 0.05], [0.14, 0.096, 0.09], [0.22, 0.091, 0.04], [0.28, 0.091, -0.05]]), 0, 0, 0, 0, 0, 0, yarnBall);
            }
            yarnG.userData = { vy: 0, y: 0, spinV: 0 };
            ctx.regMagic(yarnG, () => {
                yarnG.userData.vy = 2.4;
                yarnG.userData.spinV = (floor1Rng() - 0.5) * 12;
            });

            /* ---- 12.9 左墙书架 + 可抽拉的书 ---- */
            // J4.19：几何 + 12 条交互 + 每帧分支已搬入 src/cabin/world/floor1/bookshelf.js。
            // 原 `SFX` / `SFZ` 随之搬进 world/layout.js（`SHELF_X` / `SHELF_Z`）——
            // 碰撞表读它们（systems/player/collision.js 的 platformBoxes），故位置必须与几何同源（N9）。
            const bookshelfApi = ctx.installProp(bookshelf);
            ctx.bookshelfApi = bookshelfApi;

            /* ---- 12.9a 左窗下魔法书堆 ---- */
            // J3（B3）：几何已搬入 src/cabin/world/floor1/bookPile.js，此处只留装配调用。
            const bookPileApi = ctx.installProp(bookPile);
            ctx.bookPileApi = bookPileApi;
            /* ---- 12.9b 沙漏 ---- */
            // J3（B2）：几何已搬入 src/cabin/world/floor1/hourglass.js，此处只留装配调用。
            const hourglassApi = ctx.installProp(hourglass);
            ctx.hourglassApi = hourglassApi;
            /* ---- 12.9c 宝箱 ---- */
            // J3（B2）：几何已搬入 src/cabin/world/floor1/chest.js，此处只留装配调用。
            const chestApi = ctx.installProp(chest);
            ctx.chestApi = chestApi;
            /* ---- 12.9d 旋转星铃 ---- */
            // J3（B3）：几何已搬入 src/cabin/world/floor1/starBell.js，此处只留装配调用。
            const starBellApi = ctx.installProp(starBell);
            ctx.starBellApi = starBellApi;
            /* ---- 12.9e 大魔女坩埚 ---- */
            // J3（B4）：几何已搬入 src/cabin/world/floor1/cauldron.js，此处只留装配调用。
            const cauldronApi = ctx.installProp(cauldron);
            ctx.cauldronApi = cauldronApi;
            /* ---- 灶台旁：固定木台 ---- */
            // J3（B1）：几何已搬入 cabin/world/floor1/stovePlatform.js，此处只留装配调用。
            ctx.installProp(stovePlatform);

            /* ---- 左墙试剂药水架 ---- */
            const reagents = [];
            ctx.reagents = reagents;
            {
                const SHX = -3.85, SHZ = -0.1;
                for (const sy of [1.42, 1.74])
                    ctx.put(ctx.box(0.07, 0.035, 1.15), SHX, sy, SHZ);
                for (const sz of [-0.55, -0.1, 0.35])
                    for (const sy of [1.40, 1.72])
                        ctx.put(ctx.line([[SHX - 0.12, sy - 0.14, sz], [SHX + 0.035, sy, sz]]), 0, 0, 0);
                const reGlassMat = new THREE.MeshBasicMaterial({
                    color: 0xeaf4f0, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide
                });
                const corkMat = ctx.LITMAT(0xc9a877);
                function makeReagent(z, baseY, col, r, bh) {
                    const g = new THREE.Group();
                    ctx.put(ctx.solid(new THREE.CylinderGeometry(r, r * 0.92, bh, 10), reGlassMat), 0, bh / 2, 0, 0, 0, 0, g);
                    const lh = bh * 0.62;
                    const liqMat = new THREE.MeshBasicMaterial({
                        color: col, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide
                    });
                    ctx.put(ctx.solid(new THREE.CylinderGeometry(r * 0.8, r * 0.75, lh, 10), liqMat), 0, lh / 2 + 0.005, 0, 0, 0, 0, g);
                    const surf = [];
                    for (let k = 0; k <= 14; k++) { const a = k / 14 * Math.PI * 2; surf.push([Math.cos(a) * r * 0.8, lh + 0.006, Math.sin(a) * r * 0.8]); }
                    ctx.put(new THREE.LineLoop(ctx.geo(surf), new THREE.LineBasicMaterial({ color: col })), 0, 0, 0, 0, 0, 0, g);
                    ctx.put(ctx.solid(new THREE.CylinderGeometry(r * 0.34, r * 0.82, 0.045, 10), reGlassMat), 0, bh + 0.022, 0, 0, 0, 0, g);
                    ctx.put(ctx.solid(new THREE.CylinderGeometry(r * 0.34, r * 0.36, 0.05, 10), reGlassMat), 0, bh + 0.069, 0, 0, 0, 0, g);
                    ctx.put(ctx.solid(new THREE.CylinderGeometry(r * 0.3, r * 0.35, 0.045, 8), corkMat), 0, bh + 0.116, 0, 0, 0, 0, g);
                    g.position.set(SHX + 0.02, baseY, z);
                    g.userData = { run: 0, by: baseY };
                    ctx.scene.add(g);
                    reagents.push(g);
                    ctx.regMagic(g, () => { g.userData.run = 1.3; });
                }
                makeReagent(-0.52, 1.4375, 0xc0392b, 0.040, 0.100);
                makeReagent(-0.25, 1.4375, 0x2980b9, 0.045, 0.115);
                makeReagent(0.02, 1.4375, 0x8e44ad, 0.036, 0.090);
                makeReagent(0.28, 1.4375, 0xe67e22, 0.042, 0.100);
                makeReagent(-0.40, 1.7575, 0x27ae60, 0.043, 0.110);
                makeReagent(-0.10, 1.7575, 0xd4ac0d, 0.038, 0.090);
                makeReagent(0.20, 1.7575, 0x16a085, 0.040, 0.100);
            }

            /* ---- 紫色魔法阵 ---- */
            const mcG = new THREE.Group();
            ctx.mcG = mcG;
            mcG.position.set(ctx.MC_X, 0.015, ctx.MC_Z);
            ctx.scene.add(mcG);
            const mcMat = new THREE.LineBasicMaterial({ color: 0x8a4fd6, transparent: true, opacity: 0.55 });
            ctx.mcMat = mcMat;
            const mcLoop = (pts, parent, mat) => { const l = new THREE.LineLoop(ctx.geo(pts), mat || mcMat); parent.add(l); return l; };
            ctx.mcLoop = mcLoop;
            const mcBase = new THREE.Group();
            ctx.mcBase = mcBase;
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
                    mcBase.add(new THREE.Line(ctx.geo([[Math.cos(a) * 0.14, 0, Math.sin(a) * 0.14], [Math.cos(a) * 0.36, 0, Math.sin(a) * 0.36]]), mcMat));
                }
                for (let i = 0; i < 24; i++) {
                    const a = i / 24 * Math.PI * 2;
                    mcBase.add(new THREE.Line(ctx.geo([[Math.cos(a - 0.02) * 0.68, 0, Math.sin(a - 0.02) * 0.68], [Math.cos(a + 0.02) * 0.68, 0, Math.sin(a + 0.02) * 0.68]]), mcMat));
                    mcBase.add(new THREE.Line(ctx.geo([[Math.cos(a) * 0.68, 0, Math.sin(a) * 0.68], [Math.cos(a) * 0.72, 0, Math.sin(a) * 0.72]]), mcMat));
                }
                for (let i = 0; i < 6; i++) {
                    const a = i / 6 * Math.PI * 2;
                    mcLoop(sc(Math.cos(a) * 0.62, Math.sin(a) * 0.62, 0.045), mcBase);
                }
            }
            const mcFloats = [];
            ctx.mcFloats = mcFloats;
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
                        g.add(new THREE.Line(ctx.geo([[Math.cos(a) * 0.16, 0, Math.sin(a) * 0.16], [Math.cos(a) * 0.24, 0, Math.sin(a) * 0.24]]), m));
                    }
                    mcFloats.push({ g, m, ty: 1.25, spd: -1.1, ph: 1 });
                }
                {
                    const g = new THREE.Group(); const m = mkMat(0xd8a84f);
                    mcLoop(ring(0.26, 32), g, m);
                    mcLoop(ring(0.18, 28), g, m);
                    for (let i = 0; i < 8; i++) {
                        const a = i / 8 * Math.PI * 2;
                        g.add(new THREE.Line(ctx.geo([[Math.cos(a) * 0.08, 0, Math.sin(a) * 0.08], [Math.cos(a) * 0.26, 0, Math.sin(a) * 0.26]]), m));
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
            ctx.mcParts = mcParts;
            {
                const cols = [0xd84fd0, 0x4f9bd8, 0xd8a84f, 0x8a4fd6, 0x4fd88a, 0x4fd8d8, 0x9b4fd8];
                for (let i = 0; i < 24; i++) {
                    const m = new THREE.LineBasicMaterial({ color: cols[i % cols.length] });
                    const p = ctx.edge(new THREE.OctahedronGeometry(0.016), 1, m);
                    p.visible = false;
                    ctx.scene.add(p);
                    mcParts.push({
                        p, a: floor1Rng() * Math.PI * 2, r: 0.15 + floor1Rng() * 0.55,
                        ph: floor1Rng(), spd: 0.6 + floor1Rng() * 0.8
                    });
                }
            }
            const mcHit = new THREE.Mesh(new THREE.CircleGeometry(0.75, 28), ctx.HITMAT);
            ctx.mcHit = mcHit;
            mcHit.rotation.x = -Math.PI / 2;
            mcHit.position.y = 0.002;
            mcG.add(mcHit);
            ctx.mcRun = 0;
            ctx.regMagic(mcG, () => { if (ctx.mcRun <= 0) ctx.mcRun = 8.0; });
            mcG.userData.sfx = 'magic';

            /* ---- 12.9f 长餐桌 ---- */
            // J3（B4）：几何已搬入 src/cabin/world/floor1/longTable.js，此处只留装配调用。
            const longTableApi = ctx.installProp(longTable);
            ctx.longTableApi = longTableApi;
            /* 茶杯（餐桌/暖桌通用） */
            const cups = [];
            ctx.cups = cups;
            function makeCup(x, z, baseY, parent) {
                const by = (baseY === undefined) ? ctx.DTOP : baseY;
                const g = new THREE.Group();
                ctx.put(ctx.edge(new THREE.CylinderGeometry(0.045, 0.038, 0.09, 12)), 0, 0.045, 0, 0, 0, 0, g);
                ctx.put(ctx.edge(new THREE.TorusGeometry(0.03, 0.008, 6, 12)), 0.052, 0.045, 0, 0, 0, 0, g);
                const steam = new THREE.Group();
                for (const off of [-0.015, 0, 0.015])
                    ctx.put(ctx.line([[off, 0, 0], [off + 0.012, 0.035, 0.003], [off - 0.01, 0.07, -0.003], [off + 0.008, 0.105, 0.002]]),
                        0, 0, 0, 0, 0, 0, steam);
                steam.position.y = 0.10;
                steam.visible = false;
                g.add(steam);
                g.position.set(x, by, z);
                (parent || ctx.scene).add(g);
                g.userData = { run: 0, lift: 0, steam, baseY: by };
                cups.push(g);
                ctx.regMagic(g, () => { g.userData.run = 2.6; });
            }
            makeCup(ctx.DT_X - 0.85, ctx.DT_Z + 0.20);
            makeCup(ctx.DT_X + 0.85, ctx.DT_Z + 0.20);
            makeCup(ctx.DT_X, ctx.DT_Z + 0.20);

            /* ---- 提梁茶壶 ---- */
            const POT_BX = ctx.DT_X + 0.42, POT_BZ = ctx.DT_Z + 0.02;
            ctx.POT_BX = POT_BX; ctx.POT_BZ = POT_BZ;
            const CUP_T = cups[2];
            ctx.CUP_T = CUP_T;
            const POT_RY = Math.atan2(CUP_T.position.x - POT_BX, CUP_T.position.z - POT_BZ);
            ctx.POT_RY = POT_RY;
            const POT_TILT = 0.65;
            ctx.POT_TILT = POT_TILT;
            const POT_TIP_FWD = 0.20 * Math.cos(POT_TILT) + 0.175 * Math.sin(POT_TILT);
            ctx.POT_TIP_FWD = POT_TIP_FWD;
            const teapotPos = new THREE.Group();
            ctx.teapotPos = teapotPos;
            teapotPos.position.set(POT_BX, ctx.DTOP, POT_BZ);
            teapotPos.rotation.y = POT_RY;
            ctx.scene.add(teapotPos);
            const teapot = new THREE.Group();
            ctx.teapot = teapot;
            teapotPos.add(teapot);
            ctx.potHalo, ctx.potHaloMat;
            {
                const body = ctx.put(ctx.edge(new THREE.SphereGeometry(0.105, 14, 11)), 0, 0.10, 0, 0, 0, 0, teapot);
                body.scale.set(1, 0.82, 1);
                ctx.put(ctx.edge(new THREE.CylinderGeometry(0.07, 0.095, 0.03, 12)), 0, 0.015, 0, 0, 0, 0, teapot);
                ctx.put(ctx.edge(new THREE.CylinderGeometry(0.055, 0.068, 0.03, 12)), 0, 0.185, 0, 0, 0, 0, teapot);
                ctx.put(ctx.edge(new THREE.SphereGeometry(0.02, 8, 6)), 0, 0.21, 0, 0, 0, 0, teapot);
                const arcPts = [];
                for (let i = 0; i <= 10; i++) {
                    const a = (20 + i * 14) * ctx.D2R;
                    arcPts.push([Math.cos(a) * 0.115, 0.115 + Math.sin(a) * 0.115, 0]);
                }
                for (let i = 0; i < arcPts.length - 1; i++)
                    ctx.logBetween(arcPts[i], arcPts[i + 1], 0.011, teapot);
                ctx.logBetween([0, 0.07, 0.085], [0, 0.13, 0.145], 0.017, teapot);
                ctx.logBetween([0, 0.13, 0.145], [0, 0.175, 0.20], 0.013, teapot);
                ctx.potHaloMat = new THREE.MeshBasicMaterial({
                    color: 0xbfe3ff, transparent: true, opacity: 0.12, depthWrite: false
                });
                ctx.potHalo = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), ctx.potHaloMat);
                ctx.potHalo.userData.noHit = true;
                ctx.put(ctx.potHalo, 0, 0.10, 0, 0, 0, 0, teapot);
                ctx.potHalo.visible = false;
            }
            const potSpoutTip = new THREE.Object3D();
            ctx.potSpoutTip = potSpoutTip;
            potSpoutTip.position.set(0, 0.175, 0.20);
            teapot.add(potSpoutTip);
            const potStreamMat = new THREE.LineBasicMaterial({ color: 0x7db8dd });
            ctx.potStreamMat = potStreamMat;
            const potStreamGeom = new THREE.BufferGeometry();
            ctx.potStreamGeom = potStreamGeom;
            potStreamGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(10 * 3), 3));
            const potStream = new THREE.Line(potStreamGeom, potStreamMat);
            ctx.potStream = potStream;
            potStream.frustumCulled = false;
            potStream.visible = false;
            ctx.scene.add(potStream);
            const POT_T = 3.6;
            ctx.POT_T = POT_T;
            ctx.potRun = 0;
            const _tv = new THREE.Vector3();
            ctx._tv = _tv;
            ctx.regMagic(teapotPos, () => { ctx.potRun = POT_T; });

            /* ---- 桌面散放餐具 ---- */
            // J3（B4）：几何已搬入 src/cabin/world/floor1/tableware.js，此处只留装配调用。
            const tablewareApi = ctx.installProp(tableware);
            ctx.tablewareApi = tablewareApi;
            const chairs = [];
            ctx.chairs = chairs;
            function makeChair(x, z, ry, ax, az) {
                const g = new THREE.Group();
                ctx.put(ctx.box(0.42, 0.05, 0.42), 0, 0.45, 0, 0, 0, 0, g);
                ctx.put(ctx.box(0.42, 0.52, 0.05), 0, 0.73, -0.185, 0, 0, 0, g);
                ctx.put(ctx.box(0.36, 0.04, 0.03), 0, 0.90, -0.185, 0, 0, 0, g);
                ctx.put(ctx.box(0.36, 0.04, 0.03), 0, 0.62, -0.185, 0, 0, 0, g);
                for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]])
                    ctx.put(ctx.edge(new THREE.CylinderGeometry(0.022, 0.018, 0.44, 6)), sx * 0.17, 0.22, sz * 0.17, 0, 0, 0, g);
                g.position.set(x, 0, z);
                g.rotation.y = ry;
                g.userData = { bx: x, bz: z, ax, az, cur: 0, vel: 0, open: false };
                ctx.scene.add(g);
                chairs.push(g);
                ctx.regMagic(g, () => { g.userData.open = !g.userData.open; });
            }
            makeChair(ctx.DT_X - 0.85, ctx.DT_Z + 0.85, Math.PI, 0, 1);
            makeChair(ctx.DT_X, ctx.DT_Z + 0.85, Math.PI, 0, 1);
            makeChair(ctx.DT_X + 0.85, ctx.DT_Z + 0.85, Math.PI, 0, 1);
            makeChair(ctx.DT_X - 1.42, ctx.DT_Z, Math.PI / 2, -1, 0);
            makeChair(ctx.DT_X + 1.42, ctx.DT_Z, -Math.PI / 2, 1, 0);

            /* ---- 12.10 魔法扫帚 ---- */
            // J3（B3）：几何 + 状态 + 交互 + 每帧分支全部搬入 cabin/world/floor1/broom.js。
            // 返回的记录带 `tick` 句柄 —— 每帧逻辑仍由 tickOnce() 在**原位置**调用（顺序不变）。
            const broomApi = ctx.installProp(broom);
            ctx.broomApi = broomApi;

            /* ---- 12.11 水晶球占卜台【门侧前右墙角】 ---- */
            const orbStandG = new THREE.Group();
            ctx.orbStandG = orbStandG;
            orbStandG.position.set(ctx.CBX, 0, ctx.CBZ);
            ctx.scene.add(orbStandG);
            for (let i = 0; i < 3; i++) {
                const a = i * Math.PI * 2 / 3 + 0.5;
                ctx.logBetween([Math.cos(a) * 0.15, 0.62, Math.sin(a) * 0.15],
                    [Math.cos(a) * 0.26, 0.02, Math.sin(a) * 0.26], 0.028, orbStandG);
            }
            ctx.put(ctx.edge(new THREE.TorusGeometry(0.17, 0.02, 6, 20)), 0, 0.40, 0, Math.PI / 2, 0, 0, orbStandG);
            ctx.put(ctx.edge(new THREE.CylinderGeometry(0.13, 0.17, 0.06, 12)), 0, 0.62, 0, 0, 0, 0, orbStandG);
            {
                const cbGlassMat = new THREE.MeshBasicMaterial({ color: 0xdceef5, transparent: true, opacity: 0.20, depthWrite: false });
                const cbLineMat = new THREE.LineBasicMaterial({ color: 0x8ab8c8 });
                const cbSphere = new THREE.Group();
                cbSphere.add(new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), cbGlassMat));
                cbSphere.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.SphereGeometry(0.24, 12, 8)), cbLineMat));
                const hc = [];
                for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI * 2; hc.push([Math.cos(a) * 0.24, 0, Math.sin(a) * 0.24]); }
                cbSphere.add(new THREE.LineLoop(ctx.geo(hc), cbLineMat));
                ctx.put(cbSphere, 0, 0.90, 0, 0, 0, 0, orbStandG);
            }
            const cbInner = new THREE.Group();
            ctx.cbInner = cbInner;
            cbInner.position.set(0, 0.90, 0);
            orbStandG.add(cbInner);
            const cbMistMat = new THREE.LineBasicMaterial({ color: 0x9b6fd8, transparent: true, opacity: 0.5 });
            ctx.cbMistMat = cbMistMat;
            const cbMists = [];
            ctx.cbMists = cbMists;
            for (let i = 0; i < 3; i++) {
                const pts = [];
                const r = 0.08 + i * 0.045;
                for (let k = 0; k <= 24; k++) {
                    const a = k / 24 * Math.PI * 2;
                    pts.push([Math.cos(a) * r, Math.sin(a * 2 + i) * 0.05, Math.sin(a) * r]);
                }
                const l = new THREE.Line(ctx.geo(pts), cbMistMat);
                cbInner.add(l);
                cbMists.push({ l, ph: i });
            }
            const cbStars = [];
            ctx.cbStars = cbStars;
            for (let i = 0; i < 5; i++) {
                const st = ctx.solid(new THREE.OctahedronGeometry(0.014),
                    new THREE.MeshBasicMaterial({ color: 0xcab4f0 }));
                st.position.set((i - 2) * 0.075, (i % 2 ? 0.07 : -0.05), (floor1Rng() - 0.5) * 0.1);
                cbInner.add(st);
                cbStars.push(st);
            }
            const cbGlowMat = new THREE.MeshBasicMaterial({ color: 0xb49bf0, transparent: true, opacity: 0, depthWrite: false });
            ctx.cbGlowMat = cbGlowMat;
            const cbGlow = new THREE.Mesh(new THREE.SphereGeometry(0.30, 12, 8), cbGlowMat);
            ctx.cbGlow = cbGlow;
            cbGlow.userData.noHit = true;
            ctx.put(cbGlow, 0, 0.90, 0, 0, 0, 0, orbStandG);
            const cbHit = new THREE.Mesh(new THREE.SphereGeometry(0.27, 8, 6), ctx.HITMAT);
            ctx.cbHit = cbHit;
            ctx.put(cbHit, 0, 0.90, 0, 0, 0, 0, orbStandG);
            ctx.cbRun = 0;
            ctx.regMagic(orbStandG, () => { ctx.cbRun = 5.0; });
            orbStandG.userData.sfx = 'magic';

            /* ---- 月光魔法盆栽【门侧前右墙角】 ---- */
            const plantG = new THREE.Group();
            ctx.plantG = plantG;
            plantG.position.set(ctx.PLX, 0, ctx.PLZ);
            ctx.scene.add(plantG);
            const potMat = ctx.LITMAT(0xa9744f);
            ctx.potMat = potMat;
            ctx.put(ctx.solid(new THREE.CylinderGeometry(0.14, 0.10, 0.20, 10), potMat), 0, 0.10, 0, 0, 0, 0, plantG);
            ctx.put(ctx.solid(new THREE.CylinderGeometry(0.155, 0.155, 0.03, 10), potMat), 0, 0.215, 0, 0, 0, 0, plantG);
            ctx.put(ctx.solid(new THREE.CylinderGeometry(0.125, 0.125, 0.02, 10),
                ctx.LITMAT(0x5a4632)), 0, 0.228, 0, 0, 0, 0, plantG);
            const plantStems = [], plantBerries = [];
            ctx.plantStems = plantStems; ctx.plantBerries = plantBerries;
            for (let i = 0; i < 5; i++) {
                const a = i * Math.PI * 2 / 5 + 0.4;
                const tipX = Math.cos(a) * 0.17, tipZ = Math.sin(a) * 0.17;
                const stem = new THREE.Group();
                stem.position.set(0, 0.23, 0);
                ctx.put(ctx.line([[0, 0, 0], [tipX * 0.35, 0.13, tipZ * 0.35], [tipX * 0.8, 0.25, tipZ * 0.8], [tipX, 0.35, tipZ]]), 0, 0, 0, 0, 0, 0, stem);
                const lp = [];
                for (let k = 0; k <= 12; k++) { const t = k / 12 * Math.PI * 2; lp.push([Math.cos(t) * 0.045, Math.sin(t) * 0.035, 0]); }
                ctx.put(new THREE.LineLoop(ctx.geo(lp), ctx.MAT), tipX * 0.45, 0.16, tipZ * 0.45, 0, a, 0, stem);
                const bm = new THREE.MeshBasicMaterial({
                    color: i % 2 ? 0x9b6fd8 : 0x4fb0d8, transparent: true, opacity: 0.85
                });
                const berry = ctx.solid(new THREE.SphereGeometry(0.026, 8, 6), bm);
                ctx.put(berry, tipX, 0.37, tipZ, 0, 0, 0, stem);
                plantG.add(stem);
                plantStems.push({ stem, ph: i * 1.3 });
                plantBerries.push({ obj: berry, m: bm, ph: i });
            }
            ctx.plantRun = 0;
            ctx.regMagic(plantG, () => { ctx.plantRun = 4.0; });

            /* ---- 12.11b 滑轮置物台【魔法餐桌另一侧】：可滑动 + 墨水瓶羽毛笔 + 纸堆 ---- */
            const CART_P0 = { x: 2.85, z: 2.2 };
            ctx.CART_P0 = CART_P0;   // 魔法餐桌右侧边
            const CART_DIR = { x: 0, z: -1 };
            ctx.CART_DIR = CART_DIR;      // 【调整】朝被炉方向（-z，向屋内）滑出，不再撞花盆
            const CART_DIST = 0.55;
            ctx.CART_DIST = CART_DIST;
            ctx.cartOut = false, ctx.cartP = 0, ctx.cartPrevP = 0;
            const cartG = new THREE.Group();
            ctx.cartG = cartG;
            cartG.position.set(CART_P0.x, 0, CART_P0.z);
            cartG.rotation.y = Math.atan2(CART_DIR.x, CART_DIR.z);
            ctx.scene.add(cartG);

            const cartWheels = [];
            ctx.cartWheels = cartWheels;
            const cartBody = new THREE.Group();
            ctx.cartBody = cartBody;
            cartG.add(cartBody);
            {
                const woodMat = ctx.LITMAT(0x9c7a58, { side: THREE.DoubleSide });
                const darkMat = ctx.LITMAT(0x6b543f, { side: THREE.DoubleSide });
                for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
                    const wh = new THREE.Group();
                    wh.rotation.z = Math.PI / 2;
                    ctx.put(ctx.edge(new THREE.CylinderGeometry(0.034, 0.034, 0.024, 10)), 0, 0, 0, 0, 0, 0, wh);
                    ctx.put(ctx.edge(new THREE.CylinderGeometry(0.011, 0.011, 0.028, 6)), 0, 0, 0, 0, 0, 0, wh);
                    wh.position.set(sx * 0.15, 0.034, sz * 0.10);
                    cartG.add(wh);
                    cartWheels.push(wh);
                }
                for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]])
                    ctx.put(ctx.edge(new THREE.CylinderGeometry(0.011, 0.011, 0.46, 6)),
                        sx * 0.155, 0.26, sz * 0.115, 0, 0, 0, cartBody);
                ctx.put(ctx.solid(new THREE.BoxGeometry(0.40, 0.024, 0.30), woodMat), 0, 0.185, 0, 0, 0, 0, cartBody);
                ctx.put(ctx.solid(new THREE.BoxGeometry(0.40, 0.024, 0.30), woodMat), 0, 0.47, 0, 0, 0, 0, cartBody);
                ctx.put(ctx.solid(new THREE.BoxGeometry(0.40, 0.05, 0.012), darkMat), 0, 0.21, -0.145, 0, 0, 0, cartBody);
                ctx.put(ctx.solid(new THREE.BoxGeometry(0.40, 0.05, 0.012), darkMat), 0, 0.495, -0.145, 0, 0, 0, cartBody);
                ctx.logBetween([-0.14, 0.48, 0.14], [-0.14, 0.78, 0.14], 0.011, cartBody);
                ctx.logBetween([0.14, 0.48, 0.14], [0.14, 0.78, 0.14], 0.011, cartBody);
                ctx.logBetween([-0.14, 0.78, 0.14], [0.14, 0.78, 0.14], 0.011, cartBody);
            }

            /* —— 墨水瓶（上层）—— */
            const inkG = new THREE.Group();
            ctx.inkG = inkG;
            inkG.position.set(-0.10, 0.482, 0.02);
            cartG.add(inkG);
            {
                const glassMat = new THREE.MeshBasicMaterial({ color: 0x2a3a6e, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
                const inkMat = ctx.LITMAT(0x1a2a5e);
                ctx.put(ctx.solid(new THREE.CylinderGeometry(0.036, 0.042, 0.075, 10), glassMat), 0, 0.0375, 0, 0, 0, 0, inkG);
                ctx.put(ctx.solid(new THREE.CylinderGeometry(0.02, 0.028, 0.024, 8), glassMat), 0, 0.086, 0, 0, 0, 0, inkG);
                ctx.put(ctx.solid(new THREE.CylinderGeometry(0.031, 0.031, 0.052, 10), inkMat), 0, 0.030, 0, 0, 0, 0, inkG);
            }

            /* —— 羽毛笔（插在墨水瓶里）—— */
            const quillG = new THREE.Group();
            ctx.quillG = quillG;
            cartG.add(quillG);
            const QUILL_REST = { pos: [-0.10, 0.505, 0.02], rotX: -0.15, rotZ: 0.30 };
            ctx.QUILL_REST = QUILL_REST;
            {
                const featherMat = ctx.LITMAT(0xf4f0e6, { side: THREE.DoubleSide });
                ctx.put(ctx.solid(new THREE.CylinderGeometry(0.0035, 0.0035, 0.15, 6),
                    ctx.LITMAT(0xd9c9a8)), 0, 0.085, 0, 0, 0, 0, quillG);
                ctx.put(ctx.solid(new THREE.ConeGeometry(0.0035, 0.03, 6),
                    ctx.LITMAT(0x4a3b28)), 0, 0.005, 0, 0, 0, Math.PI, quillG);
                const f = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), featherMat);
                f.scale.set(0.32, 1.5, 0.55);
                f.position.set(0.012, 0.155, 0);
                f.rotation.z = -0.18;
                quillG.add(f);
                ctx.put(ctx.line([[0, 0.09, 0], [0.006, 0.22, 0]]), 0, 0, 0, 0, 0, 0, quillG);
                for (let k = 0; k < 5; k++) {
                    const yy = 0.11 + k * 0.024;
                    ctx.put(ctx.line([[0.002, yy, 0], [0.028 - k * 0.002, yy + 0.014, 0]]), 0, 0, 0, 0, 0, 0, quillG);
                    ctx.put(ctx.line([[0.002, yy, 0], [-0.016 + k * 0.001, yy + 0.012, 0]]), 0, 0, 0, 0, 0, 0, quillG);
                }
            }
            quillG.position.set(QUILL_REST.pos[0], QUILL_REST.pos[1], QUILL_REST.pos[2]);
            quillG.rotation.set(QUILL_REST.rotX, 0, QUILL_REST.rotZ);

            /* —— 发光魔法符号（Sprite 池：花体/哥特数学字母 + 柔光，无描边）—— */
            const GLYPH_CHARS = ['𝔑', '𝔎', '𝓇', '𝔓', '𝒻', '𝓀', '𝔖', '𝓌'];
            ctx.GLYPH_CHARS = GLYPH_CHARS;
            const GLYPH_COLORS = ['#d84fd0', '#4f9bd8', '#d8a84f', '#e05555', '#4fd8b0', '#f0e04f', '#9b6fd8', '#e084f0'];
            ctx.GLYPH_COLORS = GLYPH_COLORS;
            const magicGlyphs = [];
            ctx.magicGlyphs = magicGlyphs;
            for (let i = 0; i < 8; i++) {
                const cv = document.createElement('canvas');
                cv.width = cv.height = 128;
                const cx = cv.getContext('2d');
                cx.font = 'bold 84px "STIX Two Math", "Cambria Math", serif';
                cx.textAlign = 'center';
                cx.textBaseline = 'middle';
                cx.shadowColor = GLYPH_COLORS[i];
                cx.shadowBlur = 12;
                cx.fillStyle = GLYPH_COLORS[i];
                cx.fillText(GLYPH_CHARS[i], 64, 68);
                cx.fillText(GLYPH_CHARS[i], 64, 68);
                const tex = new THREE.CanvasTexture(cv);
                const mat = new THREE.SpriteMaterial({
                    map: tex, transparent: true, opacity: 0, depthWrite: false
                });
                const sp = new THREE.Sprite(mat);
                sp.scale.setScalar(0.001);
                sp.visible = false;
                ctx.scene.add(sp);
                magicGlyphs.push({ sp, mat, active: false, age: 0, life: 2.4, base: new THREE.Vector3() });
            }

            /* 书写路径（世界坐标）：餐桌上方空中（右侧） */
            const QW_A = new THREE.Vector3(2.75, 1.30, 1.75);
            ctx.QW_A = QW_A;
            const QW_B = new THREE.Vector3(1.65, 1.55, 1.05);
            ctx.QW_B = QW_B;
            for (let i = 0; i < 8; i++) {
                magicGlyphs[i].base.lerpVectors(QW_A, QW_B, (i + 0.5) / 8);
                magicGlyphs[i].base.y += Math.sin(i * 2.2) * 0.05;
            }

            ctx.quillRun = 0;
            const QUILL_T = 7.0;
            ctx.QUILL_T = QUILL_T;
            function startQuill() {
                if (ctx.quillRun <= 0.4) {
                    ctx.quillRun = QUILL_T;
                    for (const g of magicGlyphs) { g.active = false; g.sp.visible = false; g.mat.opacity = 0; }
                }
            }

            /* —— 纸堆（下层）—— */
            const paperG = new THREE.Group();
            ctx.paperG = paperG;
            cartG.add(paperG);
            const papers = [];
            ctx.papers = papers;
            for (let i = 0; i < 8; i++) {
                const pg = new THREE.Group();
                ctx.put(ctx.solid(new THREE.BoxGeometry(0.13, 0.0022, 0.18), ctx.FILL), 0, 0, 0, 0, 0, 0, pg);
                for (const ly of [-0.03, 0, 0.03])
                    ctx.put(ctx.line([[-0.045, 0.0025, ly], [0.045, 0.0025, ly]]), 0, 0, 0, 0, 0, 0, pg);
                const ry0 = (floor1Rng() - 0.5) * 0.3;
                pg.position.set(0.08 + (i % 3) * 0.003, 0.198 + i * 0.0028, -0.02 + (floor1Rng() - 0.5) * 0.012);
                pg.rotation.y = ry0;
                paperG.add(pg);
                papers.push({ g: pg, home: pg.position.clone(), ry0, a0: 1.0 + i * 0.8, r: 2.1 + (i % 3) * 0.28 });
            }
            ctx.paperRun = 0;
            const PAPER_T = 8.5;
            ctx.PAPER_T = PAPER_T;
            const _cw = new THREE.Vector3();
            ctx._cw = _cw;

            ctx.regMagic(cartBody, () => { ctx.cartOut = !ctx.cartOut; });
            ctx.regMagic(inkG, () => { startQuill(); });
            ctx.regMagic(quillG, () => { startQuill(); });
            ctx.regMagic(paperG, () => { if (ctx.paperRun <= 0) ctx.paperRun = PAPER_T; });

            /* ---- 12.12 塔罗牌牌堆 ---- */
            // J3（B3）：几何已搬入 src/cabin/world/floor1/tarot.js，此处只留装配调用。
            const tarotApi = ctx.installProp(tarot);
            ctx.tarotApi = tarotApi;
            /* ---- 12.13 暖桌（八角桌板 + 等腰梯形垂帘 + 四角倒三角填补）+ 收音机 + 果盆橘子 + 方坐垫 ---- */
            ctx.kotatsuOn = true;
            ctx.kotGlowMat = null;
            ctx.radioNoteRun = 0;
            const kotatsuG = new THREE.Group();
            ctx.kotatsuG = kotatsuG;
            kotatsuG.position.set(ctx.KOT_X, 0, ctx.KOT_Z);
            kotatsuG.rotation.y = 0.22;
            ctx.scene.add(kotatsuG);

            const kotBody = new THREE.Group();
            ctx.kotBody = kotBody;
            kotatsuG.add(kotBody);
            {
                const tilt = 0.16;
                const C = 0.595;
                const topY = 0.405;
                const Lc = 0.38;
                const bz = C + Lc * Math.sin(tilt);
                const wt = 0.87;
                const wb = 2 * bz;

                const topShape = new THREE.Shape();
                topShape.moveTo(-C, -(C - 0.165));
                topShape.lineTo(-(C - 0.165), -C);
                topShape.lineTo((C - 0.165), -C);
                topShape.lineTo(C, -(C - 0.165));
                topShape.lineTo(C, (C - 0.165));
                topShape.lineTo((C - 0.165), C);
                topShape.lineTo(-(C - 0.165), C);
                topShape.lineTo(-C, (C - 0.165));
                topShape.closePath();
                const topGeo = new THREE.ExtrudeGeometry(topShape, { depth: 0.055, bevelEnabled: false });
                topGeo.rotateX(-Math.PI / 2);
                ctx.put(ctx.edge(topGeo), 0, ctx.KTOP - 0.055, 0, 0, 0, 0, kotBody);

                for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]])
                    ctx.put(ctx.box(0.07, 0.40, 0.07), sx * 0.42, 0.20, sz * 0.42, 0, 0, 0, kotBody);

                const quiltMat = ctx.LITMAT(0xc4a484, { side: THREE.DoubleSide });
                const trapShape = new THREE.Shape();
                trapShape.moveTo(-wt / 2, 0);
                trapShape.lineTo(wt / 2, 0);
                trapShape.lineTo(wb / 2, -Lc);
                trapShape.lineTo(-wb / 2, -Lc);
                trapShape.closePath();
                const trapGeo = new THREE.ExtrudeGeometry(trapShape, { depth: 0.03, bevelEnabled: false });
                function makeCurtain() {
                    const g = ctx.solid(trapGeo, quiltMat);
                    for (const s of [-0.22, 0.22])
                        ctx.put(ctx.line([[s, -0.035, 0.034], [s, -Lc + 0.05, 0.034]]), 0, 0, 0, 0, 0, 0, g);
                    const hem = [];
                    for (let i = 0; i <= 24; i++) {
                        const t2 = i / 24;
                        hem.push([-wb / 2 + t2 * wb, -Lc + Math.sin(t2 * Math.PI * 5) * 0.012, 0.034]);
                    }
                    ctx.put(ctx.line(hem), 0, 0, 0, 0, 0, 0, g);
                    return g;
                }
                for (const ry of [0, Math.PI, Math.PI / 2, -Math.PI / 2]) {
                    const w = new THREE.Group();
                    w.rotation.y = ry;
                    kotBody.add(w);
                    ctx.put(makeCurtain(), 0, topY, C, -tilt, 0, 0, w);
                }

                const yBot = topY - Lc * Math.cos(tilt);
                for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
                    const P1 = [sx * (wt / 2), topY, sz * C];
                    const P2 = [sx * C, topY, sz * (wt / 2)];
                    const P3 = [sx * bz, yBot, sz * bz];
                    const triGeo = new THREE.BufferGeometry();
                    triGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
                        P1[0], P1[1], P1[2],
                        P2[0], P2[1], P2[2],
                        P3[0], P3[1], P3[2]
                    ]), 3));
                    triGeo.computeVertexNormals();
                    kotBody.add(ctx.solid(triGeo, quiltMat));
                }

                ctx.kotGlowMat = new THREE.MeshBasicMaterial({
                    color: 0xffab5e, transparent: true, opacity: 0.10, depthWrite: false, side: THREE.DoubleSide
                });
                const kotGlow = new THREE.Mesh(new THREE.CircleGeometry(0.52, 24), ctx.kotGlowMat);
                kotGlow.userData.noHit = true;
                ctx.put(kotGlow, 0, 0.015, 0, -Math.PI / 2, 0, 0, kotBody);
            }
            ctx.regMagic(kotBody, () => { ctx.kotatsuOn = !ctx.kotatsuOn; });

            /* —— 收音机（点击播放音符）—— */
            const radioG = new THREE.Group();
            ctx.radioG = radioG;
            radioG.position.set(-0.34, ctx.KTOP, 0.30);
            radioG.rotation.y = -0.45;
            kotatsuG.add(radioG);
            {
                const woodMat = ctx.LITMAT(0x8f6b4e, { side: THREE.DoubleSide });
                ctx.put(ctx.solid(new THREE.BoxGeometry(0.20, 0.115, 0.10), woodMat), 0, 0.0575, 0, 0, 0, 0, radioG);
                for (let i = 0; i < 4; i++)
                    ctx.put(ctx.line([[-0.075, 0.032 + i * 0.018, 0.052], [-0.005, 0.032 + i * 0.018, 0.052]]), 0, 0, 0, 0, 0, 0, radioG);
                ctx.put(ctx.line([[-0.078, 0.026, 0.052], [-0.078, 0.092, 0.052]]), 0, 0, 0, 0, 0, 0, radioG);
                ctx.put(ctx.line([[-0.002, 0.026, 0.052], [-0.002, 0.092, 0.052]]), 0, 0, 0, 0, 0, 0, radioG);
                ctx.put(ctx.edge(new THREE.CylinderGeometry(0.014, 0.014, 0.012, 8)),
                    0.035, 0.080, 0.052, Math.PI / 2, 0, 0, radioG);
                ctx.put(ctx.edge(new THREE.CylinderGeometry(0.011, 0.011, 0.012, 8)),
                    0.070, 0.080, 0.052, Math.PI / 2, 0, 0, radioG);
                ctx.logBetween([0.085, 0.11, 0], [0.150, 0.235, -0.01], 0.005, radioG);
                const noteSrc = new THREE.Object3D();
                noteSrc.position.set(0.150, 0.245, -0.01);
                radioG.add(noteSrc);
                radioG.userData.noteSrc = noteSrc;
            }
            const noteMat = new THREE.LineBasicMaterial({ color: 0x6b4ea8, transparent: true, opacity: 0 });
            ctx.noteMat = noteMat;
            const radioNotes = [];
            ctx.radioNotes = radioNotes;
            for (let i = 0; i < 4; i++) {
                const g = new THREE.Group();
                const head = [];
                for (let k = 0; k <= 12; k++) { const a = k / 12 * Math.PI * 2; head.push([Math.cos(a) * 0.013, Math.sin(a) * 0.009, 0]); }
                g.add(new THREE.LineLoop(ctx.geo(head), noteMat));
                g.add(new THREE.Line(ctx.geo([[0.011, 0.007, 0], [0.011, 0.052, 0]]), noteMat));
                g.add(new THREE.Line(ctx.geo([[0.011, 0.052, 0], [0.024, 0.044, 0]]), noteMat));
                g.visible = false;
                ctx.scene.add(g);
                radioNotes.push({ g, ph: i / 4 });
            }
            ctx.regMagic(radioG, () => { ctx.radioNoteRun = 3.2; });

            /* —— 果盆 + 橘子 6 颗 —— */
            const FB_X = -0.24, FB_Z = 0.10;
            ctx.FB_X = FB_X; ctx.FB_Z = FB_Z;
            {
                const BP = [[0.055, 0], [0.07, 0.018], [0.10, 0.038], [0.14, 0.058], [0.165, 0.078], [0.155, 0.082]];
                ctx.put(new THREE.Mesh(new THREE.LatheGeometry(BP.map(p => new THREE.Vector2(p[0], p[1])), 18), ctx.FILL),
                    FB_X, ctx.KTOP, FB_Z, 0, 0, 0, kotatsuG);
                for (const [ry, rr] of [[0.038, 0.10], [0.078, 0.165], [0.082, 0.155]]) {
                    const pts = [];
                    for (let k = 0; k <= 18; k++) { const a = k / 18 * Math.PI * 2; pts.push([FB_X + Math.cos(a) * rr, ctx.KTOP + ry, FB_Z + Math.sin(a) * rr]); }
                    ctx.lloop(pts, kotatsuG);
                }
                for (const ang of [0, 2.1, 4.2]) {
                    const c = Math.cos(ang), s = Math.sin(ang);
                    ctx.put(ctx.line(BP.map(([px, py]) => [FB_X + c * px, ctx.KTOP + py, FB_Z + s * px])), 0, 0, 0, 0, 0, 0, kotatsuG);
                }
            }
            const oranges = [];
            ctx.oranges = oranges;
            ctx.orangeState = 'inbowl', ctx.orangeT = 0;
            const OR = 0.033;
            ctx.OR = OR;
            {
                const orangeG = new THREE.Group();
                orangeG.position.set(FB_X, ctx.KTOP, FB_Z);
                kotatsuG.add(orangeG);
                const oMat = ctx.LITMAT(0xe8963c);
                const oMat2 = ctx.LITMAT(0xf0a44f);
                const RA = 0.075;
                const homes = [
                    [RA, 0.000, 0.050],
                    [RA * Math.cos(1.2566), RA * Math.sin(1.2566), 0.050],
                    [RA * Math.cos(2.5133), RA * Math.sin(2.5133), 0.050],
                    [RA * Math.cos(3.7699), RA * Math.sin(3.7699), 0.050],
                    [RA * Math.cos(5.0265), RA * Math.sin(5.0265), 0.050],
                    [0.000, 0.000, 0.102]
                ];
                const rolls = [
                    [0.42, -0.36],
                    [0.42, -0.12],
                    [0.42, 0.12],
                    [0.42, 0.36],
                    [0.55, -0.24],
                    [0.55, 0.02]
                ];
                for (let i = 0; i < 6; i++) {
                    const mesh = ctx.solid(new THREE.SphereGeometry(OR, 10, 8), i % 2 ? oMat2 : oMat);
                    const hx = homes[i][0], hy = homes[i][2], hz = homes[i][1];
                    const tx = rolls[i][0], tz = rolls[i][1];
                    mesh.position.set(hx, hy, hz);
                    orangeG.add(mesh);
                    const dx = tx - hx, dz = tz - hz;
                    oranges.push({ mesh, hx, hy, hz, tx, ty: OR, tz, ax: dz / OR, az: -dx / OR });
                }
                const stem = ctx.solid(new THREE.CylinderGeometry(0.004, 0.004, 0.016, 5),
                    ctx.LITMAT(0x7a5230));
                ctx.put(stem, 0, 0.038, 0, 0, 0, 0, oranges[5].mesh);
                ctx.regMagic(orangeG, () => {
                    if (ctx.orangeState === 'inbowl') { ctx.orangeState = 'out'; ctx.orangeT = 0; }
                    else if (ctx.orangeState === 'rolled') { ctx.orangeState = 'back'; ctx.orangeT = 0; }
                });
            }

            /* —— 茶杯 ×2 —— */
            makeCup(-0.34, -0.34, ctx.KTOP, kotatsuG);
            makeCup(-0.14, -0.44, ctx.KTOP, kotatsuG);

            /* —— 方坐垫 ×2 —— */
            const cushions = [];
            ctx.cushions = cushions;
            function makeCushion(x, z, ry, col, colBottom) {
                const g = new THREE.Group();
                const m = new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide });
                const m2 = new THREE.MeshBasicMaterial({ color: colBottom, side: THREE.DoubleSide });
                ctx.put(ctx.solid(new THREE.BoxGeometry(0.44, 0.085, 0.44), m), 0, 0.048, 0, 0, 0, 0, g);
                ctx.put(ctx.solid(new THREE.BoxGeometry(0.36, 0.032, 0.36), m), 0, 0.098, 0, 0, 0, 0, g);
                ctx.put(ctx.solid(new THREE.BoxGeometry(0.44, 0.014, 0.44), m2), 0, 0.008, 0, 0, 0, 0, g);
                ctx.put(ctx.edge(new THREE.CylinderGeometry(0.02, 0.02, 0.012, 8)), 0, 0.118, 0, 0, 0, 0, g);
                for (let k = 0; k < 4; k++) {
                    const a = k / 4 * Math.PI * 2 + Math.PI / 4;
                    ctx.put(ctx.line([[Math.cos(a) * 0.04, 0.115, Math.sin(a) * 0.04],
                    [Math.cos(a) * 0.15, 0.102, Math.sin(a) * 0.15]]), 0, 0, 0, 0, 0, 0, g);
                }
                g.position.set(x, 0, z);
                g.rotation.y = ry;
                kotatsuG.add(g);
                const c = { g, anim: 0, p: 0, from: 0, to: 0 };
                cushions.push(c);
                ctx.regMagic(g, () => {
                    if (c.anim === 0) {
                        c.from = c.to;
                        c.to = c.to > Math.PI / 2 ? 0 : Math.PI;
                        c.anim = 1; c.p = 0;
                    }
                });
            }
            makeCushion(0.00, 0.98, 0.12, 0xd98a94, 0xb96a75);
            makeCushion(-0.98, 0.02, 1.62, 0x8fae6e, 0x74915a);

            /* ---- 门铃【墙外侧，与门中间齐平高度】 ---- */
            const doorbellG = new THREE.Group();
            ctx.doorbellG = doorbellG;
            doorbellG.position.set(1.25, 1.05, 4.17);
            ctx.scene.add(doorbellG);
            const btnG = new THREE.Group();
            ctx.btnG = btnG;
            {
                ctx.put(ctx.box(0.15, 0.20, 0.035), 0, 0, 0, 0, 0, 0, doorbellG);
                ctx.put(ctx.edge(new THREE.TorusGeometry(0.045, 0.008, 6, 18)), 0, 0.025, 0.040, 0, 0, 0, btnG);
                ctx.put(ctx.edge(new THREE.CylinderGeometry(0.042, 0.042, 0.028, 16)), 0, 0.025, 0.022, Math.PI / 2, 0, 0, btnG);
                ctx.put(ctx.solid(new THREE.CylinderGeometry(0.024, 0.024, 0.030, 12),
                    ctx.LITMAT(0xd98a94)), 0, 0.025, 0.024, Math.PI / 2, 0, 0, btnG);
                doorbellG.add(btnG);
                ctx.put(ctx.line([[-0.045, -0.050, 0.020], [0.045, -0.050, 0.020]]), 0, 0, 0, 0, 0, 0, doorbellG);
                ctx.put(ctx.line([[-0.045, -0.065, 0.020], [0.045, -0.065, 0.020]]), 0, 0, 0, 0, 0, 0, doorbellG);
            }
            ctx.bellRun = 0, ctx.bellRipple = 0;
            const bellRipples = [];
            ctx.bellRipples = bellRipples;
            for (let i = 0; i < 3; i++) {
                const rm = new THREE.LineBasicMaterial({ color: 0x8a7d5a, transparent: true, opacity: 0 });
                const rp = [];
                for (let k = 0; k <= 20; k++) { const a = k / 20 * Math.PI * 2; rp.push([Math.cos(a) * 0.05, 0, Math.sin(a) * 0.05]); }
                const l = new THREE.LineLoop(ctx.geo(rp), rm);
                l.rotation.x = Math.PI / 2;
                l.position.set(1.25, 1.075, 4.22);
                l.frustumCulled = false;
                ctx.scene.add(l);
                bellRipples.push({ l, m: rm, ph: i / 3 });
            }
            ctx.regMagic(doorbellG, () => { ctx.bellRun = 1.4; ctx.bellRipple = 1.1; });
            doorbellG.userData.sfx = 'doorbell';

            /* ---- 门口上方挂杆 ---- */
            // J3（B3）：几何已搬入 src/cabin/world/floor1/doorHangBar.js，此处只留装配调用。
            const doorHangBarApi = ctx.installProp(doorHangBar);
            ctx.doorHangBarApi = doorHangBarApi;
            /* ============ 楼梯下储物箱（点击开盖，内藏彩色矿石） ============ */
}
