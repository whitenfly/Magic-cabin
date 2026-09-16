/**
 * 墙 / 屋顶 / 门窗 / 楼梯 / 路牌 —— 从 `legacy/monolith.js` 搬出的整段（houseShell）
 *
 * 来源：`J4` 段切片（段表见 `scripts/oneoff/_j4-segments.mjs`）。
 * 段内代码**逐字未改**，只做了三件事：包成函数、补 import、把跨段通信交给 `ctx`。
 * 因此这个文件的正确性判据与搬迁前完全一致：像素逐字节零差异。
 *
 * @param {object} ctx 段间通信载体（见 `installCabin` 的 `__J4_CTX__`）
 * @param {object} app 应用内核 —— 段里用到的 `registry`/`bus`/`scheduler`/`store` 从这里解构
 */
import * as THREE from 'three'
import { createSpringSystem } from '../../core/util/spring.js'
import { runtime } from '../../app/rng.js'

export function installHouseShell(ctx, app) {
  const { registry, store } = app
  const runtimeRng = runtime
            // ↓ J4 段导出（houseShell）：本段函数声明挂到 ctx（借提升，段内任何位置都可见）
            ctx.logWall = logWall; ctx.logGable = logGable; ctx.interiorWallLines = interiorWallLines; ctx.squareWindow = squareWindow; ctx.regFire = regFire; ctx.makeWavyFlame = makeWavyFlame;
            ctx.updateWavyFlame = updateWavyFlame; ctx.regMagic = regMagic; ctx.buildStairs = buildStairs; ctx.drawSign = drawSign; ctx.openSignEditor = openSignEditor; ctx.mushroom = mushroom;
            function logWall(along, fixed, halfLen, openings, cornerExt, parent) {
                const g = new THREE.Group(); const nLogs = Math.floor((ctx.WALL_TOP - ctx.WALL_Y0) / ctx.LOG_GAP);
                for (let i = 0; i <= nLogs; i++) {
                    const y = ctx.WALL_Y0 + ctx.LOG_R + i * ctx.LOG_GAP; if (y > ctx.WALL_TOP) break;
                    let segs = [[-halfLen - cornerExt, halfLen + cornerExt]];
                    for (const op of openings) {
                        if (y > op.y0 && y < op.y1) {
                            const next = [];
                            for (const [a, b] of segs) {
                                const lo = op.c - op.hw, hi = op.c + op.hw;
                                if (hi <= a || lo >= b) { next.push([a, b]); continue; }
                                if (lo > a) next.push([a, lo]); if (hi < b) next.push([hi, b]);
                            } segs = next;
                        }
                    }
                    for (const [a, b] of segs) {
                        if (b - a < 0.15) continue; const L = ctx.log(b - a);
                        if (along === 'x') { L.rotation.z = Math.PI / 2; L.position.set((a + b) / 2, y, fixed); }
                        else { L.rotation.x = Math.PI / 2; L.position.set(fixed, y, (a + b) / 2); }
                        g.add(L);
                    }
                } (parent || ctx.scene).add(g);
            }

            const D_HALF = 4;
            ctx.D_HALF = D_HALF;
            logWall('x', 4, D_HALF, [ctx.DOOR_HOLE, ctx.WIN_F_L, ctx.WIN_F_R], 0.18);
            logWall('z', -4, D_HALF, [ctx.WIN_LEFT], 0);

            const dashedGroup = new THREE.Group();
            ctx.dashedGroup = dashedGroup; ctx.scene.add(dashedGroup);
            const WX = 4.18;
            ctx.WX = WX;
            ctx.put(ctx.dline([[4, 0.02, -WX], [4, 0.02, WX], [4, ctx.WALL_TOP, WX], [4, ctx.WALL_TOP, -WX], [4, 0.02, -WX]]), 0, 0, 0, 0, 0, 0, dashedGroup);
            ctx.put(ctx.dline([[4, 0.02, -WX], [4, ctx.WALL_TOP, -WX]]), 0, 0, 0, 0, 0, 0, dashedGroup);
            ctx.put(ctx.dline([[4, 0.02, WX], [4, ctx.WALL_TOP, WX]]), 0, 0, 0, 0, 0, 0, dashedGroup);
            ctx.put(ctx.dline([[-WX, 0.02, -4], [WX, 0.02, -4], [WX, ctx.WALL_TOP, -4], [-WX, ctx.WALL_TOP, -4], [-WX, 0.02, -4]]), 0, 0, 0, 0, 0, 0, dashedGroup);
            ctx.put(ctx.dline([[-WX, 0.02, -4], [-WX, ctx.WALL_TOP, -4]]), 0, 0, 0, 0, 0, 0, dashedGroup);
            ctx.put(ctx.dline([[WX, 0.02, -4], [WX, ctx.WALL_TOP, -4]]), 0, 0, 0, 0, 0, 0, dashedGroup);
            ctx.put(ctx.dline([[-4, 4.5, -4], [0, 6.35, -4], [4, 4.5, -4], [-4, 4.5, -4]]), 0, 0, 0, 0, 0, 0, dashedGroup);
            ctx.put(ctx.dline([[0, 6.7, 4.6], [4.4, 4.4, 4.6]]), 0, 0, 0, 0, 0, 0, dashedGroup);
            ctx.put(ctx.dline([[0, 6.7, -4.6], [4.4, 4.4, -4.6]]), 0, 0, 0, 0, 0, 0, dashedGroup);
            ctx.put(ctx.dline([[4.4, 4.4, -4.6], [4.4, 4.4, 4.6]]), 0, 0, 0, 0, 0, 0, dashedGroup);

            const ridgeY = 6.6, eaveY = 4.4, eaveX = 4.4, roofSpan = 9.2;
            ctx.ridgeY = ridgeY; ctx.eaveY = eaveY; ctx.eaveX = eaveX; ctx.roofSpan = roofSpan;
            const roofAng = Math.atan2(ridgeY - eaveY, eaveX);
            ctx.roofAng = roofAng;
            const slopeLen = Math.hypot(eaveX, ridgeY - eaveY);
            ctx.slopeLen = slopeLen;
            ctx.put(ctx.box(slopeLen, 0.08, roofSpan), -eaveX / 2, (eaveY + ridgeY) / 2 + 0.04, 0, 0, 0, roofAng);
            ctx.put(ctx.log(roofSpan, 0.1), 0, ridgeY + 0.05, 0, Math.PI / 2, 0, 0);
            for (let t = 0.14; t < 0.96; t += 0.145) { const px = -eaveX + t * eaveX, py = eaveY + t * (ridgeY - eaveY) + 0.13; ctx.put(ctx.log(roofSpan, 0.09), px, py, 0, Math.PI / 2, 0, 0); }
            ctx.put(ctx.log(slopeLen + 0.15, 0.1), -eaveX / 2, (eaveY + ridgeY) / 2 + 0.02, 4.55, 0, 0, roofAng - Math.PI / 2);
            ctx.put(ctx.line([[0, ridgeY + 0.05, -4.55], [-eaveX, eaveY, -4.55]]), 0, 0, 0);
            ctx.put(ctx.log(9.1, 0.12), 0, eaveY - 0.12, 4.55, 0, 0, Math.PI / 2);
            ctx.put(ctx.edge(new THREE.CircleGeometry(0.1, 8)), 0, ridgeY + 0.05, -4.6, 0, Math.PI / 2, 0);
            ctx.put(ctx.box(0.68, 0.045, 9.0), -4.12, 4.45, 0, 0, 0, roofAng);
            for (const zs of [4.28, -4.28]) ctx.put(ctx.box(slopeLen - 0.1, 0.05, 0.6), -eaveX / 2, (eaveY + ridgeY) / 2 - 0.03, zs, 0, 0, roofAng);

            const GABLE_TOP = ridgeY - 0.25;
            ctx.GABLE_TOP = GABLE_TOP;
            function logGable(z, openings, parent) {
                const g = new THREE.Group(); let y = ctx.WALL_TOP + ctx.LOG_R;
                while (true) {
                    const halfW = D_HALF * (GABLE_TOP - y) / (GABLE_TOP - ctx.WALL_TOP); if (halfW < 0.3) break;
                    let segs = [[-halfW, halfW]];
                    for (const op of openings) {
                        if (y > op.y0 && y < op.y1) {
                            const next = [];
                            for (const [a, b] of segs) { const lo = op.c - op.hw, hi = op.c + op.hw; if (hi <= a || lo >= b) { next.push([a, b]); continue; } if (lo > a) next.push([a, lo]); if (hi < b) next.push([hi, b]); }
                            segs = next;
                        }
                    }
                    for (const [a, b] of segs) { if (b - a < 0.15) continue; const L = ctx.log(b - a); L.rotation.z = Math.PI / 2; L.position.set((a + b) / 2, y, z); g.add(L); }
                    y += ctx.LOG_GAP;
                } (parent || ctx.scene).add(g);
            }
            logGable(4, [ctx.WIN_GABLE]);

            const fullHouseGroup = new THREE.Group();
            ctx.fullHouseGroup = fullHouseGroup; fullHouseGroup.visible = false; ctx.scene.add(fullHouseGroup);
            // J2.8：小屋形态由 store 决定（默认剖切）。可见性由菜单就绪后的 applyFullHouse() 统一应用，
            // 所以这里刻意**不**直接同步 fullHouseGroup.visible —— 只有一处应用点，不会出现两套状态。
            ctx.fullHouse = store.get('house.full');
            {
                const WIN_R = { c: -1.5, hw: 0.52, y0: 1.1, y1: 2.1 }; const WIN_B = { c: 1.5, hw: 0.52, y0: 1.1, y1: 2.1 };
                logWall('z', 4, D_HALF, [WIN_R], 0.18, fullHouseGroup); logWall('x', -4, D_HALF, [WIN_B], 0.18, fullHouseGroup); logGable(-4, [], fullHouseGroup);
                ctx.put(ctx.box(slopeLen, 0.08, roofSpan), eaveX / 2, (eaveY + ridgeY) / 2 + 0.04, 0, 0, 0, -roofAng, fullHouseGroup);
                for (let t = 0.14; t < 0.96; t += 0.145) { const px = eaveX - t * eaveX, py = eaveY + t * (ridgeY - eaveY) + 0.13; ctx.put(ctx.log(roofSpan, 0.09), px, py, 0, Math.PI / 2, 0, 0, fullHouseGroup); }
                ctx.put(ctx.log(slopeLen + 0.15, 0.1), eaveX / 2, (eaveY + ridgeY) / 2 + 0.02, 4.55, 0, 0, -(roofAng - Math.PI / 2), fullHouseGroup);
                ctx.put(ctx.line([[0, ridgeY + 0.05, -4.55], [eaveX, eaveY, -4.55]]), 0, 0, 0, 0, 0, 0, fullHouseGroup);
                ctx.put(ctx.box(0.68, 0.045, 9.0), 4.12, 4.45, 0, 0, 0, -roofAng, fullHouseGroup);
                for (const zs of [4.28, -4.28]) ctx.put(ctx.box(slopeLen - 0.1, 0.05, 0.6), eaveX / 2, (eaveY + ridgeY) / 2 - 0.03, zs, 0, 0, -roofAng, fullHouseGroup);
            }

            const floorShape = new THREE.Shape();
            ctx.floorShape = floorShape;
            floorShape.moveTo(-4, -4); floorShape.lineTo(4, -4); floorShape.lineTo(4, 4); floorShape.lineTo(-4, 4); floorShape.closePath();
            const holePath = new THREE.Path();
            ctx.holePath = holePath; holePath.absarc(0, 0, ctx.HOLE_R, 0, Math.PI * 2, true); floorShape.holes.push(holePath);
            const floorGeo = new THREE.ExtrudeGeometry(floorShape, { depth: 0.12, bevelEnabled: false });
            ctx.floorGeo = floorGeo;
            floorGeo.rotateX(-Math.PI / 2); floorGeo.translate(0, 3, 0); ctx.scene.add(ctx.edge(floorGeo));
            const ring = ctx.edge(new THREE.TorusGeometry(ctx.HOLE_R, 0.04, 8, 32));
            ctx.ring = ring; ring.rotation.x = Math.PI / 2; ring.position.set(0, ctx.FLOOR_TOP + 0.01, 0); ctx.scene.add(ring);

            const landingShape = new THREE.Shape();
            ctx.landingShape = landingShape; landingShape.moveTo(0, 0); landingShape.absarc(0, 0, ctx.HOLE_R, Math.PI / 6, Math.PI - Math.PI / 6, false); landingShape.lineTo(0, 0);
            const landingGeo = new THREE.ExtrudeGeometry(landingShape, { depth: 0.12, bevelEnabled: false, curveSegments: 10 });
            ctx.landingGeo = landingGeo;
            landingGeo.rotateX(Math.PI / 2); ctx.put(ctx.edge(landingGeo), 0, ctx.FLOOR_TOP + 0.01, 0);

            const RAIL_R = 1.24, RAIL_H = 0.85, D2R = Math.PI / 180;
            ctx.RAIL_R = RAIL_R; ctx.RAIL_H = RAIL_H; ctx.D2R = D2R;
            for (let deg = 60; deg <= 300; deg += 30) { const th = deg * D2R; ctx.put(ctx.edge(new THREE.CylinderGeometry(0.025, 0.025, RAIL_H, 6)), Math.sin(th) * RAIL_R, ctx.FLOOR_TOP + RAIL_H / 2, Math.cos(th) * RAIL_R, 0, 0, 0); }
            for (const hy of [RAIL_H, 0.45]) { const pts = []; for (let deg = 60; deg <= 300; deg += 5) { const th = deg * D2R; pts.push([Math.sin(th) * RAIL_R, ctx.FLOOR_TOP + hy, Math.cos(th) * RAIL_R]); } ctx.put(ctx.line(pts), 0, 0, 0); }
            const eX = Math.sin(60 * D2R), eZ = Math.cos(60 * D2R);
            ctx.eX = eX; ctx.eZ = eZ;
            for (const r of [0.38, 0.8]) ctx.put(ctx.edge(new THREE.CylinderGeometry(0.025, 0.025, RAIL_H, 6)), eX * r, ctx.FLOOR_TOP + RAIL_H / 2, eZ * r, 0, 0, 0);
            for (const hy of [RAIL_H, 0.45]) ctx.put(ctx.line([[eX * 0.15, ctx.FLOOR_TOP + hy, eZ * 0.15], [eX * RAIL_R, ctx.FLOOR_TOP + hy, eZ * RAIL_R]]), 0, 0, 0);
            for (let z = -3.2; z <= 3.2; z += 0.9) { const avoidR = ctx.HOLE_R + 0.05; if (Math.abs(z) >= avoidR) { ctx.put(ctx.log(8, 0.07), 0, 2.86, z, 0, 0, Math.PI / 2); } else { const dx = Math.sqrt(avoidR * avoidR - z * z); ctx.put(ctx.log(4 - dx, 0.07), -(4 + dx) / 2, 2.86, z, 0, 0, Math.PI / 2); ctx.put(ctx.log(4 - dx, 0.07), (4 + dx) / 2, 2.86, z, 0, 0, Math.PI / 2); } }

            function interiorWallLines(along, fixed, openings, skipV) {
                for (let y = 0.6; y < 4.4; y += 0.8) {
                    let segs = [[-3.9, 3.9]];
                    for (const op of openings) { if (y > op.y0 && y < op.y1) { const next = []; for (const [a, b] of segs) { const lo = op.c - op.hw, hi = op.c + op.hw; if (hi <= a || lo >= b) { next.push([a, b]); continue; } if (lo > a) next.push([a, lo]); if (hi < b) next.push([hi, b]); } segs = next; } }
                    for (const [a, b] of segs) { if (b - a < 0.2) continue; if (along === 'x') ctx.put(ctx.line([[a, y, fixed], [b, y, fixed]]), 0, 0, 0); else ctx.put(ctx.line([[fixed, y, a], [fixed, y, b]]), 0, 0, 0); }
                }
                for (let p = -3; p <= 3; p += 1.5) {
                    if (skipV && skipV.indexOf(p) !== -1) continue; let segs = [[0.1, 4.4]];
                    for (const op of openings) { if (p > op.c - op.hw && p < op.c + op.hw) { const next = []; for (const [a, b] of segs) { if (op.y1 <= a || op.y0 >= b) { next.push([a, b]); continue; } if (op.y0 > a) next.push([a, op.y0]); if (op.y1 < b) next.push([op.y1, b]); } segs = next; } }
                    for (const [a, b] of segs) { if (b - a < 0.2) continue; if (along === 'x') ctx.put(ctx.line([[p, a, fixed], [p, b, fixed]]), 0, 0, 0); else ctx.put(ctx.line([[fixed, a, p], [fixed, b, p]]), 0, 0, 0); }
                }
            }
            interiorWallLines('x', 3.9, [ctx.DOOR_HOLE, ctx.WIN_F_L, ctx.WIN_F_R], [0]);
            interiorWallLines('z', -3.9, [ctx.WIN_LEFT]);

            // J2.4：弹簧与滑轨已提取到 cabin/core/util/spring.js（实现零改动）。
            // 解构保留原有标识符名 —— 文件内其余 200+ 处调用点（registerHinge / regSlide /
            // hingeMeshes / updateSprings）因此一行都不用改。
            const { hinges, hingeMeshes, slides, registerHinge, regSlide, updateSprings } = createSpringSystem();
            ctx.hinges = hinges; ctx.hingeMeshes = hingeMeshes; ctx.slides = slides; ctx.registerHinge = registerHinge; ctx.regSlide = regSlide; ctx.updateSprings = updateSprings;

            function squareWindow(cx, cy, cz, face, w, h, holeHw, parent, glassMat) {
                const g = new THREE.Group(); g.userData = { base: 0, delta: 0 }; const parts = new THREE.Group(); const t = 0.09, d = 0.12;
                ctx.put(ctx.box(w, t, d), w / 2, h / 2 - t / 2, 0, 0, 0, 0, parts); ctx.put(ctx.box(w, t, d), w / 2, -h / 2 + t / 2, 0, 0, 0, 0, parts);
                ctx.put(ctx.box(t, h, d), t / 2, 0, 0, 0, 0, 0, parts); ctx.put(ctx.box(t, h, d), w - t / 2, 0, 0, 0, 0, 0, parts);
                ctx.put(ctx.box(w - 2 * t, 0.05, 0.07), w / 2, 0, 0.02, 0, 0, 0, parts); ctx.put(ctx.box(0.05, h - 2 * t, 0.07), w / 2, 0, 0.02, 0, 0, 0, parts);
                { const gg = new THREE.BoxGeometry(w - 2 * t, h - 2 * t, 0.04); const glass = new THREE.Mesh(gg, glassMat || ctx.WIN_GLASS); glass.position.set(w / 2, 0, 0); parts.add(glass); const glassEdge = new THREE.LineSegments(new THREE.EdgesGeometry(gg), ctx.MAT); glassEdge.position.set(w / 2, 0, 0); parts.add(glassEdge); }
                g.add(parts); ctx.put(ctx.box(0.07, 0.16, 0.16), 0.02, h / 2 - 0.2, 0, 0, 0, 0, g); ctx.put(ctx.box(0.07, 0.16, 0.16), 0.02, -h / 2 + 0.2, 0, 0, 0, 0, g);
                const P = parent || ctx.scene; const sideOff = holeHw - 0.045;
                if (face === '+z' || face === '-z') {
                    for (const s of [-1, 1]) ctx.put(ctx.box(0.1, h + 0.24, 0.22), cx + s * sideOff, cy + 0.02, cz, 0, 0, 0, P);
                    ctx.put(ctx.box(2 * holeHw + 0.06, 0.1, 0.22), cx, cy + h / 2 + 0.06, cz, 0, 0, 0, P);
                    if (face === '+z') ctx.put(ctx.box(w + 0.24, 0.08, 0.2), cx, cy - h / 2 - 0.06, cz + 0.02, 0, 0, 0, P);
                    if (face === '-z') ctx.put(ctx.box(w + 0.24, 0.08, 0.2), cx, cy - h / 2 - 0.06, cz - 0.02, 0, 0, 0, P);
                } else {
                    for (const s of [-1, 1]) ctx.put(ctx.box(0.22, h + 0.24, 0.1), cx, cy + 0.02, cz + s * sideOff, 0, 0, 0, P);
                    ctx.put(ctx.box(0.22, 0.1, 2 * holeHw + 0.06), cx, cy + h / 2 + 0.06, cz, 0, 0, 0, P);
                    if (face === '-x') ctx.put(ctx.box(0.2, 0.08, w + 0.24), cx - 0.02, cy - h / 2 - 0.06, cz, 0, 0, 0, P);
                    if (face === '+x') ctx.put(ctx.box(0.2, 0.08, w + 0.24), cx + 0.02, cy - h / 2 - 0.06, cz, 0, 0, 0, P);
                }
                if (face === '+z') { g.userData.base = 0; g.position.set(cx - w / 2, cy, cz); }
                if (face === '-x') { g.userData.base = -Math.PI / 2; g.position.set(cx, cy, cz - w / 2); }
                if (face === '+x') { g.userData.base = Math.PI / 2; g.position.set(cx, cy, cz + w / 2); }
                if (face === '-z') { g.userData.base = Math.PI; g.position.set(cx + w / 2, cy, cz); }
                g.userData.delta = -1.35; P.add(g); registerHinge(g); return g;
            }
            const winFL = squareWindow(ctx.WIN_F_L.c, 1.6, 4.03, '+z', 0.95, 0.9, ctx.WIN_F_L.hw);
            ctx.winFL = winFL;
            const winFR = squareWindow(ctx.WIN_F_R.c, 1.6, 4.03, '+z', 0.95, 0.9, ctx.WIN_F_R.hw);
            ctx.winFR = winFR;
            const winL = squareWindow(-4.03, 1.6, ctx.WIN_LEFT.c, '-x', 0.95, 0.9, ctx.WIN_LEFT.hw);
            ctx.winL = winL;
            const winG = squareWindow(ctx.WIN_GABLE.c, 5.38, 4.03, '+z', 0.85, 0.75, ctx.WIN_GABLE.hw, null, ctx.WIN_GLASS_UP);
            ctx.winG = winG;
            const winR = squareWindow(4.03, 1.6, -1.5, '+x', 0.95, 0.9, 0.52, fullHouseGroup);
            ctx.winR = winR;
            const winB = squareWindow(1.5, 1.6, -4.03, '-z', 0.95, 0.9, 0.52, fullHouseGroup);
            ctx.winB = winB;

            ctx.put(ctx.log(2.42, 0.1), -0.84, 1.21, 4.02, 0, 0, 0); ctx.put(ctx.log(2.42, 0.1), 0.84, 1.21, 4.02, 0, 0, 0); ctx.put(ctx.box(1.7, 0.1, 0.28), 0, 0.05, 4.12);
            const doorGroup = new THREE.Group();
            ctx.doorGroup = doorGroup; doorGroup.userData = { base: 0, delta: 1.9 };
            const doorShape = new THREE.Shape();
            ctx.doorShape = doorShape; doorShape.moveTo(-0.72, 0); doorShape.lineTo(-0.72, 1.63); doorShape.absarc(0, 1.63, 0.72, Math.PI, 0, true); doorShape.lineTo(0.72, 0); doorShape.lineTo(-0.72, 0);
            ctx.put(ctx.edge(new THREE.ExtrudeGeometry(doorShape, { depth: 0.07, bevelEnabled: false }).translate(0.72, 0, 0)), 0, 0, 0, 0, 0, 0, doorGroup);
            for (const px of [0.28, 0.54, 0.8, 1.06]) ctx.put(ctx.line([[px, 0.05, 0.09], [px, 1.63, 0.09]]), 0, 0, 0, doorGroup);
            ctx.put(ctx.box(0.22, 0.07, 0.04), 0.13, 0.5, 0.09, 0, 0, 0, doorGroup);
            ctx.put(ctx.edge(new THREE.TorusGeometry(0.07, 0.02, 6, 16)), 1.2, 1.05, 0.10, 0, 0, 0, doorGroup);
            doorGroup.position.set(-0.72, 0, 3.96); ctx.scene.add(doorGroup); registerHinge(doorGroup);
            doorGroup.userData.aimLabel = '打开 / 关上大门';
            winFL.userData.aimLabel = '开 / 关前左窗'; winFR.userData.aimLabel = '开 / 关前右窗'; winL.userData.aimLabel = '开 / 关左侧窗'; winG.userData.aimLabel = '开 / 关阁楼窗'; winR.userData.aimLabel = '开 / 关右侧窗'; winB.userData.aimLabel = '开 / 关后窗';

            ctx.FILL.uniforms.uFireCenter.value.set(ctx.FX, 0.55, ctx.FZ);

            const fireMeshes = [];
            ctx.fireMeshes = fireMeshes; ctx.fireLit = true; ctx.fireP = 1;
            function regFire(o) { o.traverse(m => { if (m.isMesh) { m.userData.isFire = true; fireMeshes.push(m); } }); return o; }
            regFire(ctx.put(ctx.box(1.0, 0.12, 1.9), ctx.CHX, 0.06, ctx.CHZ)); regFire(ctx.put(ctx.box(0.08, 1.33, 1.8), ctx.CHX - 0.46, 0.785, ctx.CHZ)); regFire(ctx.put(ctx.box(0.94, 1.33, 0.35), ctx.CHX, 0.785, ctx.CHZ - 0.725)); regFire(ctx.put(ctx.box(0.94, 1.33, 0.35), ctx.CHX, 0.785, ctx.CHZ + 0.725));
            regFire(ctx.put(ctx.box(0.94, 0.25, 1.8), ctx.CHX, 1.325, ctx.CHZ)); regFire(ctx.put(ctx.box(1.05, 0.12, 2.2), ctx.CHX, 1.46, ctx.CHZ)); regFire(ctx.put(ctx.box(0.7, 0.08, 2.0), ctx.CHX + 0.8, 0.04, ctx.CHZ));
            const fwShape = new THREE.Shape();
            ctx.fwShape = fwShape; fwShape.moveTo(-0.9, 0); fwShape.lineTo(0.9, 0); fwShape.lineTo(0.9, 1.52); fwShape.lineTo(-0.9, 1.52); fwShape.closePath();
            const fwHole = new THREE.Path();
            ctx.fwHole = fwHole; fwHole.moveTo(-0.55, 0.12); fwHole.lineTo(-0.55, 0.62); fwHole.absarc(0, 0.62, 0.55, Math.PI, 0, true); fwHole.lineTo(0.55, 0.12); fwHole.closePath(); fwShape.holes.push(fwHole);
            const fwGeo = new THREE.ExtrudeGeometry(fwShape, { depth: 0.08, bevelEnabled: false, curveSegments: 12 });
            ctx.fwGeo = fwGeo; fwGeo.rotateY(-Math.PI / 2); regFire(ctx.put(ctx.edge(fwGeo), ctx.CHX + 0.5, 0, ctx.CHZ));
            const BK = ctx.CHX - 0.42;
            ctx.BK = BK;
            for (let y = 0.26; y <= 1.0; y += 0.22) ctx.put(ctx.iline([[BK, y, ctx.CHZ - 0.5], [BK, y, ctx.CHZ + 0.5]]), 0, 0, 0);
            for (let r = 0; r < 4; r++) { const y0 = 0.26 + r * 0.22; for (let zq = -0.44; zq <= 0.44; zq += 0.22) { const zo = zq + (r % 2 ? 0.11 : 0); if (Math.abs(zo) < 0.5) ctx.put(ctx.iline([[BK, y0, ctx.CHZ + zo], [BK, y0 + 0.22, ctx.CHZ + zo]]), 0, 0, 0); } }
            for (let i = 0; i < 5; i++) ctx.put(ctx.iline([[ctx.FX - 0.18 + i * 0.07, ctx.HEARTH, ctx.FZ - 0.28 + i * 0.13], [ctx.FX - 0.10 + i * 0.07, ctx.HEARTH, ctx.FZ - 0.22 + i * 0.13]]), 0, 0, 0);
            const WOOD_R = 0.05;
            ctx.WOOD_R = WOOD_R;
            regFire(ctx.logBetween([ctx.FX - 0.06, ctx.HEARTH + WOOD_R, ctx.FZ - 0.42], [ctx.FX - 0.06, ctx.HEARTH + WOOD_R, ctx.FZ + 0.42], WOOD_R));
            regFire(ctx.logBetween([ctx.FX + 0.12, ctx.HEARTH + WOOD_R, ctx.FZ - 0.38], [ctx.FX + 0.12, ctx.HEARTH + WOOD_R, ctx.FZ + 0.38], WOOD_R));
            regFire(ctx.logBetween([ctx.FX - 0.34, ctx.HEARTH + WOOD_R * 3, ctx.FZ + 0.05], [ctx.FX + 0.38, ctx.HEARTH + WOOD_R * 3, ctx.FZ - 0.03], WOOD_R));
            for (const p of [[ctx.FX - 0.06, ctx.HEARTH + WOOD_R, ctx.FZ - 0.42], [ctx.FX + 0.12, ctx.HEARTH + WOOD_R, ctx.FZ + 0.38]]) { ctx.put(ctx.edge(new THREE.CircleGeometry(WOOD_R * 0.9, 8)), p[0], p[1], p[2], 0, 0, 0); ctx.put(ctx.edge(new THREE.CircleGeometry(WOOD_R * 0.35, 6)), p[0], p[1], p[2], 0, 0, 0); }
            const TEEPEE_BASE_R = 0.30, TEEPEE_TOP_Y = ctx.HEARTH + 0.62, STICK_Y = ctx.HEARTH + WOOD_R * 0.9;
            ctx.TEEPEE_BASE_R = TEEPEE_BASE_R; ctx.TEEPEE_TOP_Y = TEEPEE_TOP_Y; ctx.STICK_Y = STICK_Y;
            for (let i = 0; i < 5; i++) { const a = i * (Math.PI * 2 / 5) + 0.35; const bx = ctx.FX + Math.cos(a) * TEEPEE_BASE_R; const bz = ctx.FZ + Math.sin(a) * TEEPEE_BASE_R; regFire(ctx.logBetween([bx, STICK_Y, bz], [ctx.FX, TEEPEE_TOP_Y, ctx.FZ], WOOD_R * 0.9)); ctx.put(ctx.edge(new THREE.CircleGeometry(WOOD_R * 0.8, 8)), bx + Math.cos(a) * 0.005, STICK_Y, bz + Math.sin(a) * 0.005, 0, 0, 0); }

            const fireOut = new THREE.LineBasicMaterial({ color: 0xb8421f }), fireMid = new THREE.LineBasicMaterial({ color: 0xe0862e }), fireIn = new THREE.LineBasicMaterial({ color: 0xf5c542 });
            ctx.fireOut = fireOut; ctx.fireMid = fireMid; ctx.fireIn = fireIn;
            const wavyFlames = [];
            ctx.wavyFlames = wavyFlames;
            function makeWavyFlame(x0, z0, y0, h, w, mat, phase, speed, list) { const K = 24; const count = (K + 1) * 2; const geom = new THREE.BufferGeometry(); geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3)); const ln = new THREE.LineLoop(geom, mat); ln.frustumCulled = false; ctx.scene.add(ln); const f = { obj: ln, x0, z0, y0, h, w, phase, speed, geom, K }; (list || wavyFlames).push(f); return f; }
            function updateWavyFlame(f, time, pw) { const p = f.geom.attributes.position.array; const K = f.K; const hh = f.h * pw; const wsc = 0.3 + 0.7 * pw; let idx = 0; for (let k = 0; k <= K; k++) { const t = k / K; const ww = f.w * wsc * Math.sin(Math.PI * (0.16 + 0.84 * t)); const wob = Math.sin(t * 5.2 - time * f.speed + f.phase) * 0.028 * t * pw; const zo = Math.sin(t * 4 - time * f.speed * 0.7 + f.phase * 1.7) * 0.02 * t * pw; p[idx++] = f.x0 + wob + ww; p[idx++] = f.y0 + t * hh; p[idx++] = f.z0 + zo; } for (let k = K; k >= 0; k--) { const t = k / K; const ww = f.w * wsc * Math.sin(Math.PI * (0.16 + 0.84 * t)); const wob = Math.sin(t * 5.2 - time * f.speed + f.phase) * 0.028 * t * pw; const zo = Math.sin(t * 4 - time * f.speed * 0.7 + f.phase * 1.7) * 0.02 * t * pw; p[idx++] = f.x0 + wob - ww; p[idx++] = f.y0 + t * hh; p[idx++] = f.z0 + zo; } f.geom.attributes.position.needsUpdate = true; }
            makeWavyFlame(ctx.FX, ctx.FZ, ctx.HEARTH + 0.02, 0.80, 0.30, fireOut, 0.0, 2.6); makeWavyFlame(ctx.FX + 0.01, ctx.FZ - 0.01, ctx.HEARTH + 0.04, 0.60, 0.20, fireMid, 2.3, 3.1); makeWavyFlame(ctx.FX - 0.01, ctx.FZ + 0.01, ctx.HEARTH + 0.06, 0.38, 0.11, fireIn, 4.1, 3.6); makeWavyFlame(ctx.FX - 0.14, ctx.FZ - 0.10, ctx.HEARTH + 0.02, 0.34, 0.11, fireOut, 1.2, 3.3); makeWavyFlame(ctx.FX + 0.15, ctx.FZ + 0.12, ctx.HEARTH + 0.02, 0.28, 0.10, fireOut, 3.4, 3.0);
            const sparks = [];
            ctx.sparks = sparks;
            for (let i = 0; i < 6; i++) { const sp = ctx.edge(new THREE.OctahedronGeometry(0.016)); sp.userData.phase = i / 6; sp.userData.drift = (runtimeRng() - 0.5) * 0.25; ctx.scene.add(sp); sparks.push(sp); }
            ctx.put(ctx.box(0.85, 1.0, 1.6), ctx.CHX, 1.9, ctx.CHZ); ctx.put(ctx.box(0.7, 4.9, 0.7), ctx.CHX, 4.85, ctx.CHZ);
            ctx.put(ctx.line([[ctx.CHX - 0.42, 3.13, ctx.CHZ - 0.42], [ctx.CHX + 0.42, 3.13, ctx.CHZ - 0.42], [ctx.CHX + 0.42, 3.13, ctx.CHZ + 0.42], [ctx.CHX - 0.42, 3.13, ctx.CHZ + 0.42], [ctx.CHX - 0.42, 3.13, ctx.CHZ - 0.42]]), 0, 0, 0);
            const smokePuffs = [];
            ctx.smokePuffs = smokePuffs;
            for (let i = 0; i < 5; i++) { const p = ctx.edge(new THREE.TorusGeometry(0.14, 0.035, 6, 20)); p.rotation.x = Math.PI / 2; p.userData.phase = i / 5; ctx.scene.add(p); smokePuffs.push(p); }

            // J2.5：交互登记交给应用内核的注册中心（J2.6 会在它之上做统一契约）。
            // ★ magicMeshes 仍是**同一个数组实例**（注册中心持有它），
            //   准星射线（aimRay）与点击射线照旧直接用它做 intersectObjects —— 命中行为零改动。
            const magicMeshes = registry.magicMeshes;
            ctx.magicMeshes = magicMeshes;
            function regMagic(o, onClick) {
                o.userData.onClick = onClick;
                const meshes = [];
                o.traverse(m => { if (m.isMesh && !m.userData.noHit) meshes.push(m); });
                registry.registerMagic(o, meshes);   // 内部统一设置 magicRoot 并 push 进 magicMeshes
                return o;
            }

            const STAIR_N = 14;
            ctx.STAIR_N = STAIR_N;
            function buildStairs() {
                const g = new THREE.Group(); const N = STAIR_N; const riseTotal = ctx.FLOOR_TOP; const stepH = riseTotal / (N + 1); const dTheta = 270 / N; const rI = 0.14, rO = 1.1; const railH = 0.85, rPost = rO - 0.07; const treadHalf = dTheta * 0.46; const thick = 0.06;
                ctx.put(ctx.log(ctx.FLOOR_TOP + RAIL_H, 0.08), 0, (ctx.FLOOR_TOP + RAIL_H) / 2, 0, 0, 0, 0, g);
                function treadGeo(a0, a1) { const s = new THREE.Shape(); s.moveTo(rI * Math.sin(a0), rI * Math.cos(a0)); s.lineTo(rO * Math.sin(a0), rO * Math.cos(a0)); const nSeg = 5; for (let j = 1; j <= nSeg; j++) { const a = a0 + (a1 - a0) * j / nSeg; s.lineTo(rO * Math.sin(a), rO * Math.cos(a)); } s.lineTo(rI * Math.sin(a1), rI * Math.cos(a1)); s.closePath(); const gg = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false }); gg.rotateX(Math.PI / 2); gg.translate(0, thick, 0); return gg; }
                const thetaEnd = -60 - dTheta / 2; const railPts = [];
                for (let k = 0; k < N; k++) { const thDeg = thetaEnd - (N - 1 - k) * dTheta; const th = thDeg * D2R; const yTop = (k + 1) * stepH; const tread = ctx.edge(treadGeo(th - treadHalf * D2R, th + treadHalf * D2R)); tread.position.y = yTop - thick; g.add(tread); const norm = ((thDeg % 360) + 360) % 360; const underPlatform = (norm <= 60 || norm >= 300) && (yTop + railH > ctx.FLOOR_TOP - 0.1); if (!underPlatform) { ctx.put(ctx.edge(new THREE.CylinderGeometry(0.02, 0.02, railH, 6)), rPost * Math.sin(th), yTop + railH / 2, rPost * Math.cos(th), 0, 0, 0, g); } railPts.push(ctx.V(rPost * Math.sin(th), yTop + railH, rPost * Math.cos(th))); }
                g.add(ctx.edge(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(railPts), 64, 0.03, 6, false))); return g;
            }
            ctx.scene.add(buildStairs());

            ctx.put(ctx.box(1.25, 0.06, 1.0), -0.58, 2.98, 4.55, 0, 0, 0.35); ctx.put(ctx.box(1.25, 0.06, 1.0), 0.58, 2.98, 4.55, 0, 0, -0.35);
            ctx.put(ctx.log(2.78, 0.06), -1.15, 1.39, 4.95, 0, 0, 0.03); ctx.put(ctx.log(2.78, 0.06), 1.15, 1.39, 4.95, 0, 0, -0.03);
            ctx.put(ctx.line([[-1.15, 2.5, 4.95], [-0.7, 2.92, 4.55]]), 0, 0, 0); ctx.put(ctx.line([[1.15, 2.5, 4.95], [0.7, 2.92, 4.55]]), 0, 0, 0); ctx.put(ctx.box(1.4, 0.03, 0.6), 0, 0.02, 4.45);
            for (let i = 0; i < 4; i++) ctx.put(ctx.box(0.7, 0.05, 0.5), (i % 2) * 0.25 - 0.1, 0.025, 5.1 + i * 0.85);

            const signG = new THREE.Group();
            ctx.signG = signG; signG.position.set(3.1, 0, 6.3); signG.rotation.y = -0.45; ctx.scene.add(signG);
            ctx.put(ctx.edge(new THREE.CylinderGeometry(0.035, 0.05, 1.5, 8)), 0, 0.75, 0, 0.04, 0, 0.05, signG);
            const signCanvas = document.createElement('canvas');
            ctx.signCanvas = signCanvas; signCanvas.width = 256; signCanvas.height = 128; const sctx = signCanvas.getContext('2d');
            ctx.sctx = sctx;
            const signTexture = new THREE.CanvasTexture(signCanvas);
            ctx.signTexture = signTexture; ctx.signText = '魔女小屋';
            function drawSign(text) { const n = Math.max(text.length, 1); const size = n <= 4 ? 46 : n <= 6 ? 36 : n <= 8 ? 28 : 22; sctx.fillStyle = '#ffffff'; sctx.fillRect(0, 0, 256, 128); sctx.strokeStyle = '#111111'; sctx.lineWidth = 5; sctx.strokeRect(5, 5, 246, 118); sctx.lineWidth = 1.5; sctx.strokeRect(14, 14, 228, 100); sctx.fillStyle = '#111111'; sctx.font = 'bold ' + size + 'px "Microsoft YaHei", monospace'; sctx.textAlign = 'center'; sctx.textBaseline = 'middle'; sctx.fillText(text, 128, 66); signTexture.needsUpdate = true; }
            drawSign(ctx.signText);
            const signSideMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
            ctx.signSideMat = signSideMat; const signFaceMat = new THREE.MeshBasicMaterial({ map: signTexture });
            ctx.signFaceMat = signFaceMat;
            const signBoardG = new THREE.Group();
            ctx.signBoardG = signBoardG; signBoardG.position.set(0, 1.5, 0.10); signBoardG.rotation.z = 0.07; signBoardG.rotation.x = 0.03; signG.add(signBoardG);
            { const boardMesh = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.48, 0.045), [signSideMat, signSideMat, signSideMat, signSideMat, signFaceMat, signSideMat]); signBoardG.add(boardMesh); signBoardG.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.85, 0.48, 0.045)), ctx.MAT)); for (const [nx, ny] of [[-0.36, 0.19], [0.36, 0.19], [-0.36, -0.19], [0.36, -0.19]]) ctx.put(ctx.edge(new THREE.CylinderGeometry(0.008, 0.008, 0.014, 6)), nx, ny, 0.028, 0, 0, 0, signBoardG); }
            function openSignEditor() { if (document.pointerLockElement) document.exitPointerLock(); const ed = document.getElementById('signEditor'); const inp = document.getElementById('signInput'); inp.value = ctx.signText; ed.classList.add('show'); inp.focus(); inp.select(); }
            signG.userData.aimLabel = '编辑路牌文字'; regMagic(signG, openSignEditor);

            ctx.put(ctx.edge(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 6)), 0, ridgeY + 0.4, 0); ctx.put(ctx.edge(new THREE.CylinderGeometry(0.015, 0.015, 0.5, 6)), 0, ridgeY + 0.55, 0, 0, 0, Math.PI / 2); ctx.put(ctx.edge(new THREE.ConeGeometry(0.06, 0.16, 6)), 0.3, ridgeY + 0.55, 0, 0, 0, -Math.PI / 2); ctx.put(ctx.edge(new THREE.ConeGeometry(0.06, 0.14, 4)), -0.28, ridgeY + 0.55, 0, 0, 0, Math.PI / 2);

            const GATE_L = -1.4, GATE_R = 1.4;
            ctx.GATE_L = GATE_L; ctx.GATE_R = GATE_R;
            for (let x = -7; x <= 7; x += 0.8) { if (x > GATE_L - 0.1 && x < GATE_R + 0.1) continue; const picket = new THREE.Group(); ctx.put(ctx.box(0.12, 0.9, 0.06), 0, 0.45, 0, 0, 0, 0, picket); ctx.put(ctx.edge(new THREE.ConeGeometry(0.09, 0.22, 4)), 0, 1.0, 0, 0, 0, 0, picket); ctx.put(picket, x, 0, 7.5); }
            for (const cy of [0.75, 0.35]) { const len = 7 - GATE_R; ctx.put(ctx.log(len, 0.04), (GATE_L - 7) / 2, cy, 7.5, 0, 0, Math.PI / 2); ctx.put(ctx.log(len, 0.04), (GATE_R + 7) / 2, cy, 7.5, 0, 0, Math.PI / 2); }
            for (const gx of [GATE_L - 0.08, GATE_R + 0.08]) { ctx.put(ctx.box(0.14, 1.15, 0.1), gx, 0.575, 7.5); ctx.put(ctx.edge(new THREE.ConeGeometry(0.1, 0.2, 4)), gx, 1.25, 7.5); }
            function mushroom(x, z, s) { const g = new THREE.Group(); ctx.put(ctx.edge(new THREE.CylinderGeometry(0.05 * s, 0.08 * s, 0.3 * s, 8)), 0, 0.15 * s, 0, 0, 0, 0, g); ctx.put(ctx.edge(new THREE.SphereGeometry(0.22 * s, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2)), 0, 0.28 * s, 0, 0, 0, 0, g); ctx.put(g, x, 0, z); }
            mushroom(-5.8, 6.2, 1.2); mushroom(-5.2, 6.8, 0.8); mushroom(5.6, 6.5, 1.0);

            /* ========================================================== */
            /* ============ 室外场景：森林 · 草地 · 石头 · 花 · 萤火虫 ============ */
            /* ========================================================== */
}

/**
 * 每帧：路牌材质跟随环境光色。
 *
 * `J4.14`（缺口「每帧分支归位」）从 `systems/weather/WeatherSystem.js` 搬回这里 ——
 * 路牌是**世界**侧的物件，它的每帧更新不该住在天气模块里。原实现是天气模块里的两行：
 * `ctx.signSideMat.color.copy(ctx.FILL.uniforms.uColor.value)`（face 同理）。
 *
 * **输入**：`ctx.FILL.uniforms.uColor.value` —— 天气每帧算出的环境光色（即 `ctx._amb`）。
 * **约束**：调度登记顺序必须落在 `weather/atmosphere` **之后**、`weather/effects` **之前**
 * —— 这正是它搬迁前在 `updateWeatherSystem()` 里的位置（见 `app/scene/FrameBody.js`）。
 * 位置错了画面就会变，`node tests/visual/compare.mjs` 会拦下。
 *
 * @param {object} ctx 段间通信载体
 */
export function updateSignMaterials(ctx) {
  ctx.signSideMat.color.copy(ctx.FILL.uniforms.uColor.value)
  ctx.signFaceMat.color.copy(ctx.FILL.uniforms.uColor.value)
}
