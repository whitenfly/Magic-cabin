/**
 * 二楼陈设 —— 从 `legacy/monolith.js` 搬出的整段（floor2）
 *
 * 来源：`J4` 段切片（段表见 `scripts/oneoff/_j4-segments.mjs`）。
 * 段内代码**逐字未改**，只做了三件事：包成函数、补 import、把跨段通信交给 `ctx`。
 * 因此这个文件的正确性判据与搬迁前完全一致：像素逐字节零差异。
 *
 * @param {object} ctx 段间通信载体（见 `installCabin` 的 `__J4_CTX__`）
 * @param {object} app 应用内核 —— 段里用到的 `registry`/`bus`/`scheduler`/`store` 从这里解构
 */
import * as THREE from 'three'
import bag from './bag.js'
import bin from './bin.js'
import calendar from './calendar.js'
import cardDeck from './cardDeck.js'
import coinTowers from './coinTowers.js'
import crate from './crate.js'
import desk from './desk.js'
import deskChair from './deskChair.js'
import deskHourglass from './deskHourglass.js'
import junkBoxes from './junkBoxes.js'
import mirror from './mirror.js'
import nightstand from './nightstand.js'
import picture from './picture.js'
import rubik from './rubik.js'
import rugLarge from './rugLarge.js'
import snowGlobe from './snowGlobe.js'
import tissueBox from './tissueBox.js'
import wardrobe from './wardrobe.js'
import witchHat from './witchHat.js'
import { clock } from '../../app/clock.js'
import { runtime, scene } from '../../app/rng.js'

export function installFloor2(ctx, app) {
  const runtimeRng = runtime
  const floor2Rng = scene.floor2
  const textureRng = scene.texture
            // ↓ J4 段导出（floor2）：本段函数声明挂到 ctx（借提升，段内任何位置都可见）
            ctx.makeCandleGlow = makeCandleGlow; ctx.getGlyphTex = getGlyphTex; ctx.spawnGlyphs = spawnGlyphs; ctx.updateGlyphs = updateGlyphs; ctx.updateBook = updateBook; ctx.glowBall = glowBall;
            ctx.addHalo = addHalo; ctx.drawBoardFace = drawBoardFace; ctx.drawNote = drawNote; ctx.openNoteEditor = openNoteEditor; ctx.drawGlyphSet = drawGlyphSet; ctx.updateChalk = updateChalk;
            ctx.scrollRoll = scrollRoll; ctx.woodPart = woodPart; ctx.wandGlowSphere = wandGlowSphere; ctx.ringPts2 = ringPts2; ctx.polyPts2 = polyPts2; ctx.starPts2 = starPts2;
            ctx.spiralPts2 = spiralPts2; ctx.buildMagicCircle = buildMagicCircle; ctx.hash01 = hash01; ctx.jitterGeo = jitterGeo; ctx.makeSolidFlame = makeSolidFlame; ctx.buildCreation = buildCreation;
            ctx.clearCast = clearCast; ctx.updateWand2 = updateWand2; ctx.cbox = cbox; ctx.crboxCol = crboxCol; ctx.crumpleBall = crumpleBall; ctx.arcPos = arcPos;
            ctx.regWobble = regWobble; ctx.updateWobblers = updateWobblers; ctx.colEdge = colEdge; ctx.clockHand = clockHand; ctx.drawClock = drawClock; ctx.updateNewDecor = updateNewDecor;
            for (const sxsz of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
                ctx.put(ctx.edge(new THREE.CylinderGeometry(0.045, 0.035, 0.32, 8)), ctx.BEDX + sxsz[0] * 0.56, ctx.FY + 0.16, ctx.BEDZ + sxsz[1] * 1.02, 0, 0, 0);
            }
            ctx.put(ctx.box(1.32, 0.22, 2.24), ctx.BEDX, ctx.FY + 0.42, ctx.BEDZ);
            ctx.put(ctx.rbox(1.36, 0.80, 0.10, 0.06), ctx.BEDX, ctx.FY + 0.78, ctx.BEDZ - 1.14);
            ctx.put(ctx.rbox(1.32, 0.32, 2.24, 0.10), ctx.BEDX, ctx.FY + 0.69, ctx.BEDZ);
            ctx.pillowOpen = false, ctx.pillowT = 0;
            const pillowG = new THREE.Group();
            ctx.pillowG = pillowG;
            pillowG.position.set(ctx.BEDX, ctx.FY + 0.94, ctx.BEDZ - 0.76);
            ctx.scene.add(pillowG);
            pillowG.add(ctx.rbox(0.66, 0.22, 0.44, 0.08));
            ctx.regMagic(pillowG, () => { ctx.pillowOpen = !ctx.pillowOpen; });
            {
                const bl = ctx.rbox(1.24, 0.20, 1.46, 0.08);
                bl.position.set(ctx.BEDX, ctx.FY + 0.85, ctx.BEDZ + 0.40);
                ctx.scene.add(bl);
                for (const bx of [-0.18, 0.18]) {
                    ctx.put(ctx.iline([[ctx.BEDX + bx, ctx.FY + 0.955, ctx.BEDZ - 0.28], [ctx.BEDX + bx, ctx.FY + 0.955, ctx.BEDZ + 1.08]]), 0, 0, 0);
                }
            }

            /* ---- 18.2 床头柜 + 可拉开抽屉 ---- */
            // J3（B2）：几何已搬入 src/cabin/world/floor2/nightstand.js，此处只留装配调用。
            ctx.installProp(nightstand);
            /* ---- 18.3 蜡烛 ---- */
            ctx.candleLit = true, ctx.candleP = 1;
            const candleG = new THREE.Group();
            ctx.candleG = candleG;
            candleG.position.set(ctx.NSX, ctx.FY + 0.60, ctx.NSZ);
            ctx.scene.add(candleG);
            ctx.put(ctx.edge(new THREE.CylinderGeometry(0.055, 0.075, 0.05, 10)), 0, 0.025, 0, 0, 0, 0, candleG);
            ctx.put(ctx.edge(new THREE.CylinderGeometry(0.016, 0.016, 0.09, 8)), 0, 0.09, 0, 0, 0, 0, candleG);
            ctx.put(ctx.edge(new THREE.CylinderGeometry(0.05, 0.06, 0.035, 10)), 0, 0.155, 0, 0, 0, 0, candleG);
            const candleBody = ctx.edge(new THREE.CylinderGeometry(0.035, 0.038, 0.20, 10));
            ctx.candleBody = candleBody;
            candleBody.position.set(0, 0.27, 0);
            candleG.add(candleBody);
            ctx.put(ctx.edge(new THREE.CylinderGeometry(0.006, 0.006, 0.035, 6)), 0, 0.385, 0, 0, 0, 0, candleG);
            const candleWavy = [];
            ctx.candleWavy = candleWavy;
            ctx.makeWavyFlame(ctx.NSX, ctx.NSZ, ctx.FY + 1.00, 0.12, 0.034, ctx.fireMid, 0.0, 3.2, candleWavy);
            ctx.makeWavyFlame(ctx.NSX, ctx.NSZ, ctx.FY + 1.02, 0.07, 0.016, ctx.fireIn, 2.0, 3.8, candleWavy);
            ctx.regMagic(candleG, () => { ctx.candleLit = !ctx.candleLit; });
            const candleGlows = [];
            ctx.candleGlows = candleGlows;

            function makeCandleGlow(r, op, col) {
                const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
                m.position.set(ctx.NSX, ctx.FY + 1.02, ctx.NSZ);
                m.renderOrder = 8;
                ctx.scene.add(m);
                candleGlows.push({ m: m, maxOp: op });
            }
            makeCandleGlow(0.045, 0.55, 0xfff0c0);
            makeCandleGlow(0.10, 0.28, 0xffc06a);
            makeCandleGlow(0.18, 0.12, 0xff9a3c);

            /* ---- 18.4 书桌 + 椅子 + 桌面玩具 ---- */
            // J3（B5）：几何已搬入 src/cabin/world/floor2/desk.js，此处只留装配调用。
            ctx.installProp(desk);
            /* —— 椅子 —— */
            // J4.21：几何 + 交互 + 每帧分支已搬入 src/cabin/world/floor2/deskChair.js。
            // 原 `CHAIR_IN` / `CHAIR_OUT` 与摆放位 `2.6` 随之搬进 world/layout.js ——
            // 碰撞表的 movingPlatforms 读它的 `chairG`，故改读 `deskChairApi.parts.body`。
            const deskChairApi = ctx.installProp(deskChair);
            ctx.deskChairApi = deskChairApi;

            /* —— 魔方 —— */
            // J3（B5）：几何已搬入 src/cabin/world/floor2/rubik.js，此处只留装配调用。
            const rubikApi = ctx.installProp(rubik);
            ctx.rubikApi = rubikApi;
            /* —— 通用倒塌/恢复 —— */
            // J3（B5）：几何已搬入 src/cabin/world/floor2/coinTowers.js，此处只留装配调用。
            const coinTowersApi = ctx.installProp(coinTowers);
            ctx.coinTowersApi = coinTowersApi;
            /* —— 扑克牌堆 —— */
            // J3（B5）：几何已搬入 src/cabin/world/floor2/cardDeck.js，此处只留装配调用。
            const cardDeckApi = ctx.installProp(cardDeck);
            ctx.cardDeckApi = cardDeckApi;
            /* —— 玻璃雪景球 —— */
            // J3（B5）：几何已搬入 src/cabin/world/floor2/snowGlobe.js，此处只留装配调用。
            const snowGlobeApi = ctx.installProp(snowGlobe);
            ctx.snowGlobeApi = snowGlobeApi;
            /* —— 沙漏 —— */
            // J3（B5）：几何已搬入 src/cabin/world/floor2/deskHourglass.js，此处只留装配调用。
            const deskHourglassApi = ctx.installProp(deskHourglass);
            ctx.deskHourglassApi = deskHourglassApi;
            /* —— 台历（转轴位于背板面顶端：未翻页贴板前面、翻过页贴板背面， */
            // J3（B5）：几何已搬入 src/cabin/world/floor2/calendar.js，此处只留装配调用。
            const calendarApi = ctx.installProp(calendar);
            ctx.calendarApi = calendarApi;
            /* —— 魔法书本 —— */
            /* ========================================================== */
            const bookG = new THREE.Group();
            ctx.bookG = bookG;
            bookG.position.set(2.58, ctx.TBL_TOP + 0.001, -2.80);
            bookG.rotation.y = -0.35;
            ctx.scene.add(bookG);
            ctx.coverPivot;
            ctx.spineG;
            const flipperPivots = [];
            ctx.flipperPivots = flipperPivots;
            const fanPivots = [];
            ctx.fanPivots = fanPivots;
            const FAN_FIN = [0.40, 0.80, 1.20, 1.60, 2.00, 2.40, 2.80];
            ctx.FAN_FIN = FAN_FIN;
            const COVER_FIN = Math.PI;
            ctx.COVER_FIN = COVER_FIN;
            const COVER_Y0 = 0.039;
            ctx.COVER_Y0 = COVER_Y0;
            const COVER_Y1 = 0.006;
            ctx.COVER_Y1 = COVER_Y1;
            const FLIP_CLOSED_Y = [];
            ctx.FLIP_CLOSED_Y = FLIP_CLOSED_Y;
            const FLIP_OPEN_Y = [];
            ctx.FLIP_OPEN_Y = FLIP_OPEN_Y;
            for (let i = 0; i < 6; i++) {
                FLIP_CLOSED_Y.push(0.0222 + i * 0.0019);
                FLIP_OPEN_Y.push(0.0128 + i * 0.0019);
            }
            {
                const covMat = ctx.LITMAT(0x7a4638, { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
                const covEdge = new THREE.LineBasicMaterial({ color: 0x4a2820 });
                const pgMat = ctx.LITMAT(0xf3ecd8, { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
                const pgEdge = new THREE.LineBasicMaterial({ color: 0xb8ad8e });

                function plate(w, t, d, mat, emat) {
                    const g = new THREE.BoxGeometry(w, t, d);
                    const grp = new THREE.Group();
                    const m = new THREE.Mesh(g, mat);
                    m.position.x = w / 2;
                    grp.add(m);
                    const e = new THREE.LineSegments(new THREE.EdgesGeometry(g), emat);
                    e.position.x = w / 2;
                    grp.add(e);
                    return grp;
                }

                function pageStack(count) {
                    const grp = new THREE.Group();
                    const t = 0.0012, gap = 0.00025;
                    for (let i = 0; i < count; i++) {
                        const pg = plate(0.19, t, 0.245, pgMat, pgEdge);
                        pg.position.y = i * (t + gap);
                        grp.add(pg);
                    }
                    return grp;
                }
                const back = plate(0.20, 0.012, 0.26, covMat, covEdge);
                back.position.set(0, 0.006, 0);
                bookG.add(back);
                const rightStack = pageStack(6);
                rightStack.position.set(0, 0.0125, 0);
                bookG.add(rightStack);
                for (let i = 0; i < 6; i++) {
                    const pg = plate(0.19, 0.0016, 0.245, pgMat, pgEdge);
                    pg.position.set(0, FLIP_CLOSED_Y[i], 0);
                    bookG.add(pg);
                    flipperPivots.push(pg);
                }
                for (let i = 0; i < 7; i++) {
                    const pg = plate(0.19, 0.0016, 0.245, pgMat, pgEdge);
                    pg.position.set(0, 0.0222 + i * 0.0009, 0);
                    pg.visible = false;
                    bookG.add(pg);
                    fanPivots.push(pg);
                }
                ctx.coverPivot = plate(0.20, 0.012, 0.26, covMat, covEdge);
                ctx.coverPivot.position.set(0, COVER_Y0, 0);
                bookG.add(ctx.coverPivot);
                const SPINE_R = 0.0225;
                const spineGeo = new THREE.CylinderGeometry(SPINE_R, SPINE_R, 0.27, 12, 1, false, 0, Math.PI);
                spineGeo.rotateX(Math.PI / 2);
                const spineMat = ctx.LITMAT(0x7a4638, { side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
                ctx.spineG = new THREE.Group();
                ctx.spineG.position.set(0, SPINE_R, 0);
                ctx.spineG.rotation.z = Math.PI;
                ctx.spineG.add(new THREE.Mesh(spineGeo, spineMat));
                ctx.spineG.add(new THREE.LineSegments(new THREE.EdgesGeometry(spineGeo, 10), covEdge));
                bookG.add(ctx.spineG);
            }
            const bookState = { phase: 'closed', t0: 0 };
            ctx.bookState = bookState;
            ctx.regMagic(bookG, () => {
                const s = bookState;
                if (s.phase === 'closed') {
                    s.phase = 'opening';
                    s.t0 = clock.now;
                } else if (s.phase === 'open') {
                    s.phase = 'closing';
                    s.t0 = clock.now;
                }
            });
            const GLYPH_SYMS = ['✦', '☾', '✧', '∴', '⟡', '✱', '☽', '✸', '❖', '✺', '✜', '✻'];
            ctx.GLYPH_SYMS = GLYPH_SYMS;
            const GLYPH_COLS = ['#ff6a4a', '#ffd94a', '#6affd9', '#6aa8ff', '#c86aff', '#ff6ad5', '#fff2b0'];
            ctx.GLYPH_COLS = GLYPH_COLS;
            const glyphTexCache = {};
            ctx.glyphTexCache = glyphTexCache;

            function getGlyphTex(sym, col) {
                const key = sym + col;
                if (glyphTexCache[key]) return glyphTexCache[key];
                const cv = document.createElement('canvas');
                cv.width = 128;
                cv.height = 128;
                const cx = cv.getContext('2d');
                cx.font = '84px serif';
                cx.textAlign = 'center';
                cx.textBaseline = 'middle';
                cx.shadowColor = col;
                cx.shadowBlur = 22;
                cx.fillStyle = col;
                cx.fillText(sym, 64, 68);
                cx.shadowBlur = 0;
                cx.fillStyle = '#ffffff';
                cx.fillText(sym, 64, 68);
                const tex = new THREE.CanvasTexture(cv);
                glyphTexCache[key] = tex;
                return tex;
            }
            const glyphObjs = [];
            ctx.glyphObjs = glyphObjs;
            const glyphGeoShared = new THREE.PlaneGeometry(0.05, 0.05);
            ctx.glyphGeoShared = glyphGeoShared;

            function spawnGlyphs(n) {
                for (let i = 0; i < n; i++) {
                    const sym = GLYPH_SYMS[Math.floor(runtimeRng() * GLYPH_SYMS.length)];
                    const col = GLYPH_COLS[Math.floor(runtimeRng() * GLYPH_COLS.length)];
                    const m = new THREE.Mesh(
                        glyphGeoShared,
                        new THREE.MeshBasicMaterial({ map: getGlyphTex(sym, col), transparent: true, opacity: 0, depthWrite: false })
                    );
                    m.renderOrder = 11;
                    m.position.set(
                        bookG.position.x + (runtimeRng() - 0.5) * 0.12,
                        bookG.position.y + 0.10 + runtimeRng() * 0.03,
                        bookG.position.z + (runtimeRng() - 0.5) * 0.10
                    );
                    ctx.scene.add(m);
                    glyphObjs.push({
                        m: m,
                        v: ctx.V((runtimeRng() - 0.5) * 0.06, 0.10 + runtimeRng() * 0.07, (runtimeRng() - 0.5) * 0.06),
                        life: 1.8 + runtimeRng() * 1.0,
                        t: 0,
                        ph: runtimeRng() * 6.28,
                        rs: (runtimeRng() - 0.5) * 3
                    });
                }
            }

            function updateGlyphs(time, dt) {
                for (let i = glyphObjs.length - 1; i >= 0; i--) {
                    const g = glyphObjs[i];
                    g.t += dt;
                    if (g.t >= g.life) {
                        ctx.scene.remove(g.m);
                        g.m.material.dispose();
                        glyphObjs.splice(i, 1);
                        continue;
                    }
                    g.m.position.addScaledVector(g.v, dt);
                    g.m.position.x += Math.sin(time * 3 + g.ph) * 0.0004;
                    g.v.multiplyScalar(Math.max(0, 1 - 0.25 * dt));
                    const fade = g.t / (g.life - 0.7);
                    g.m.material.opacity = Math.min(1, g.t / 0.25) * (1 - smooth(Math.max(0, Math.min(1, fade))));
                    const sc = 0.8 + 0.3 * Math.abs(Math.sin(time * 4 + g.ph));
                    g.m.scale.set(sc, sc, sc);
                    g.m.quaternion.copy(ctx.camera.quaternion);
                    g.m.rotation.z += g.rs * dt;
                }
            }
            ctx.bookGlyphT = 0;

            function updateBook(time, dt) {
                const s = bookState;
                const e = time - s.t0;
                const ck = Math.max(0, Math.min(1, ctx.coverPivot.rotation.z / Math.PI));
                ctx.spineG.rotation.z = Math.PI + (Math.PI / 2) * ck;
                ctx.spineG.position.y = 0.0225 + (0.008 - 0.0225) * ck;
                const ss = 1 - 0.3 * ck;
                ctx.spineG.scale.set(ss, ss, 1);
                if (s.phase === 'opening') {
                    const CO = 0.55, W = 0.18;
                    const k = smooth(Math.min(e / CO, 1));
                    ctx.coverPivot.rotation.z = COVER_FIN * k;
                    ctx.coverPivot.position.y = COVER_Y0 + (COVER_Y1 - COVER_Y0) * k;
                    if (e >= CO + W) {
                        ctx.coverPivot.rotation.z = COVER_FIN;
                        ctx.coverPivot.position.y = COVER_Y1;
                        s.phase = 'flipping';
                        s.t0 = time;
                    }
                } else if (s.phase === 'flipping') {
                    const D = 0.10, DUR = 0.13, W = 0.25;
                    for (let i = 0; i < 6; i++) {
                        const kk = smooth(Math.max(0, Math.min(1, (e - i * D) / DUR)));
                        flipperPivots[i].rotation.z = 3.05 * kk;
                        flipperPivots[i].position.y = FLIP_OPEN_Y[i] + (FLIP_CLOSED_Y[i] - FLIP_OPEN_Y[i]) * (1 - kk);
                    }
                    if (e >= 5 * D + DUR + W) {
                        for (const fp of fanPivots) fp.visible = true;
                        s.phase = 'fanning';
                        s.t0 = time;
                    }
                } else if (s.phase === 'fanning') {
                    const F = 0.40;
                    const k = smooth(Math.min(e / F, 1));
                    for (let i = 0; i < 7; i++) {
                        fanPivots[i].rotation.z = FAN_FIN[i] * k;
                    }
                    if (e >= F) {
                        s.phase = 'open';
                        spawnGlyphs(8);
                        ctx.bookGlyphT = 0.45;
                    }
                } else if (s.phase === 'open') {
                    ctx.bookGlyphT -= dt;
                    if (ctx.bookGlyphT <= 0 && glyphObjs.length < 16) {
                        spawnGlyphs(1);
                        ctx.bookGlyphT = 0.45;
                    }
                } else if (s.phase === 'closing') {
                    const FAN = 0.35, W1 = 0.15;
                    const D = 0.08, DUR = 0.12, W2 = 0.22, CO = 0.50;
                    const tFanEnd = FAN;
                    const tFlipStart = FAN + W1;
                    const tFlipEnd = tFlipStart + 5 * D + DUR;
                    const tCoverStart = tFlipEnd + W2;
                    const tEnd = tCoverStart + CO;
                    if (e < tFanEnd) {
                        const k = smooth(e / FAN);
                        for (let i = 0; i < 7; i++) {
                            fanPivots[i].rotation.z = FAN_FIN[i] * (1 - k);
                        }
                    } else {
                        for (const fp of fanPivots) {
                            fp.visible = false;
                            fp.rotation.z = 0;
                        }
                    }
                    for (let i = 0; i < 6; i++) {
                        const j = 5 - i;
                        const kk = smooth(Math.max(0, Math.min(1, (e - tFlipStart - i * D) / DUR)));
                        flipperPivots[j].rotation.z = 3.05 * (1 - kk);
                        flipperPivots[j].position.y = FLIP_OPEN_Y[j] + (FLIP_CLOSED_Y[j] - FLIP_OPEN_Y[j]) * kk;
                    }
                    if (e >= tCoverStart) {
                        const k2 = smooth(Math.min((e - tCoverStart) / CO, 1));
                        ctx.coverPivot.rotation.z = COVER_FIN * (1 - k2);
                        ctx.coverPivot.position.y = COVER_Y1 + (COVER_Y0 - COVER_Y1) * k2;
                    }
                    if (e >= tEnd) {
                        ctx.coverPivot.rotation.z = 0;
                        ctx.coverPivot.position.y = COVER_Y0;
                        for (let i = 0; i < 6; i++) {
                            flipperPivots[i].rotation.z = 0;
                            flipperPivots[i].position.y = FLIP_CLOSED_Y[i];
                        }
                        s.phase = 'closed';
                    }
                }
            }

            /* ========================================================== */
            /* 18.5 星象仪 */
            /* ========================================================== */
            ctx.magicOn = false, ctx.magicP = 0;
            const GOLD = new THREE.LineBasicMaterial({ color: 0xc9a227 });
            ctx.GOLD = GOLD;
            const GOLDL = new THREE.LineBasicMaterial({ color: 0xb8912a });
            ctx.GOLDL = GOLDL;
            const astro = new THREE.Group();
            ctx.astro = astro;
            astro.position.set(1.75, ctx.TBL_TOP, -2.72);
            ctx.scene.add(astro);
            ctx.put(ctx.edge(new THREE.CylinderGeometry(0.15, 0.19, 0.09, 10)), 0, 0.045, 0, 0, 0, 0, astro);
            ctx.put(ctx.edge(new THREE.CylinderGeometry(0.055, 0.085, 0.16, 8)), 0, 0.17, 0, 0, 0, 0, astro);
            ctx.put(ctx.edge(new THREE.SphereGeometry(0.04, 8, 6)), 0, 0.265, 0, 0, 0, 0, astro);
            const tiltG = new THREE.Group();
            ctx.tiltG = tiltG;
            tiltG.position.y = 0.30;
            tiltG.rotation.z = 0.41;
            astro.add(tiltG);
            const spinG = new THREE.Group();
            ctx.spinG = spinG;
            spinG.position.y = 0.16;
            tiltG.add(spinG);
            ctx.put(ctx.edge(new THREE.CylinderGeometry(0.011, 0.011, 0.60, 6)), 0, 0, 0, 0, 0, 0, spinG);
            ctx.put(ctx.edge(new THREE.SphereGeometry(0.062, 10, 8), 1, GOLD), 0, 0, 0, 0, 0, 0, spinG);
            ctx.put(ctx.edge(new THREE.TorusGeometry(0.27, 0.011, 6, 34), 1, GOLD), 0, 0, 0, 0, 0, Math.PI / 2, spinG);
            ctx.put(ctx.edge(new THREE.TorusGeometry(0.27, 0.011, 6, 34), 1, GOLD), 0, 0, 0, 0, 0, 0, spinG);
            const innerG = new THREE.Group();
            ctx.innerG = innerG;
            spinG.add(innerG);
            ctx.put(ctx.edge(new THREE.TorusGeometry(0.21, 0.009, 6, 28), 1, GOLDL), 0, 0, 0, Math.PI / 3, 0, Math.PI / 4, innerG);
            ctx.put(ctx.edge(new THREE.TorusGeometry(0.15, 0.008, 6, 24), 1, GOLDL), 0, 0, 0, Math.PI / 2, 0.8, 0, innerG);

            function glowBall(r, op) {
                const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
                m.renderOrder = 9;
                m.userData.maxOp = op;
                spinG.add(m);
                return m;
            }
            const glows = [glowBall(0.10, 0.55), glowBall(0.20, 0.28), glowBall(0.34, 0.12)];
            ctx.glows = glows;
            ctx.regMagic(astro, () => { ctx.magicOn = !ctx.magicOn; });

            /* ========================================================== */
            /* 18.6 二楼夜幕 */
            /* ========================================================== */
            const veilShape = new THREE.Shape();
            ctx.veilShape = veilShape;
            veilShape.moveTo(-3.8, 0);
            veilShape.lineTo(3.8, 0);
            veilShape.lineTo(3.8, 1.35);
            veilShape.lineTo(0.0, 3.20);
            veilShape.lineTo(-3.8, 1.35);
            veilShape.closePath();
            const veilGeo = new THREE.ExtrudeGeometry(veilShape, { depth: 7.6, bevelEnabled: false });
            ctx.veilGeo = veilGeo;
            veilGeo.translate(0, 0, -3.8);
            veilGeo.translate(0, ctx.FLOOR_TOP, 0);
            const veil = new THREE.Mesh(veilGeo, new THREE.MeshBasicMaterial({ color: 0x5f5480, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
            ctx.veil = veil;
            veil.renderOrder = 4;
            ctx.scene.add(veil);

            /* ========================================================== */
            /* 18.7 宇宙星空粒子系统 */
            /* ========================================================== */
            const STAR_COLORS = [0xffffff, 0xbfd8ff, 0xffe9b0, 0xd9c1ff, 0x9fd8ff, 0xc9a2ff, 0x9ffce8, 0xffd166];
            ctx.STAR_COLORS = STAR_COLORS;
            const VIVID_COLORS = [0xff2255, 0x22ee66, 0x00b4ff, 0xffee00, 0xff00cc, 0x00ffe0];
            ctx.VIVID_COLORS = VIVID_COLORS;
            const magicParts = [];
            ctx.magicParts = magicParts;

            function addHalo(parent, color, r, opIn, opOut) {
                const h1 = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
                const h2 = new THREE.Mesh(new THREE.SphereGeometry(r * 1.5, 10, 8), new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
                h1.renderOrder = 7;
                h2.renderOrder = 7;
                parent.add(h1);
                parent.add(h2);
                return { h1: h1, h2: h2, opIn: opIn, opOut: opOut };
            }
            for (let i = 0; i < 96; i++) {
                const typ = i % 6;
                const g = new THREE.Group();
                let cl;
                if (typ === 5) {
                    cl = VIVID_COLORS[i % VIVID_COLORS.length];
                    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), new THREE.MeshBasicMaterial({ color: cl })));
                    g.userData.halo = addHalo(g, cl, 0.028, 0.42, 0.14);
                    g.userData.vivid = true;
                } else {
                    cl = STAR_COLORS[i % STAR_COLORS.length];
                    if (typ === 0) {
                        g.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.013), new THREE.MeshBasicMaterial({ color: cl })));
                        g.userData.halo = addHalo(g, cl, 0.026, 0.35, 0.12);
                        g.userData.sharp = true;
                    } else if (typ === 1) {
                        g.add(new THREE.Mesh(new THREE.SphereGeometry(0.017, 8, 6), ctx.LITMAT(0xffffff)));
                        const spikeMat = new THREE.LineBasicMaterial({ color: cl, transparent: true, opacity: 0 });
                        const spikeLen = 0.075;
                        g.add(new THREE.LineSegments(
                            new THREE.BufferGeometry().setFromPoints([
                                ctx.V(-spikeLen, 0, 0), ctx.V(spikeLen, 0, 0),
                                ctx.V(0, -spikeLen * 0.7, 0), ctx.V(0, spikeLen * 0.7, 0)
                            ]), spikeMat
                        ));
                        g.userData.spikes = spikeMat;
                        g.userData.halo = addHalo(g, cl, 0.040, 0.45, 0.16);
                    } else if (typ === 2) {
                        g.add(new THREE.Mesh(
                            new THREE.SphereGeometry(0.015, 10, 8),
                            new THREE.MeshBasicMaterial({ color: cl, transparent: true, opacity: 0.75 })
                        ));
                        g.userData.halo = addHalo(g, cl, 0.070, 0.30, 0.22);
                        g.userData.nebula = true;
                    } else if (typ === 3) {
                        g.add(new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), ctx.LITMAT(0xffffff)));
                        g.userData.tails = [];
                        for (let s = 1; s <= 4; s++) {
                            const tp = new THREE.Mesh(
                                new THREE.SphereGeometry(0.016 * (1 - (s - 1) * 0.16), 6, 5),
                                new THREE.MeshBasicMaterial({ color: cl, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
                            );
                            tp.renderOrder = 7;
                            g.add(tp);
                            g.userData.tails.push({ m: tp, s: s });
                        }
                        g.userData.halo = addHalo(g, cl, 0.036, 0.40, 0.14);
                    } else {
                        g.userData.cluster = [];
                        for (let c = 0; c < 3; c++) {
                            const sg = new THREE.Group();
                            sg.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.009), new THREE.MeshBasicMaterial({ color: c === 0 ? 0xffffff : cl })));
                            g.add(sg);
                            g.userData.cluster.push({ g: sg, ph: c * 2.09 });
                        }
                        g.userData.halo = addHalo(g, cl, 0.042, 0.22, 0.10);
                    }
                }
                g.visible = false;
                const th = floor2Rng() * 6.28, orbR = 1.0 + floor2Rng() * 2.6;
                g.userData.p = {
                    cx: Math.cos(th) * orbR * 0.85,
                    cz: Math.sin(th) * orbR,
                    y0: ctx.FY + 0.40 + floor2Rng() * 2.5,
                    ph: floor2Rng() * 6.28,
                    sp: 0.10 + floor2Rng() * 0.28,
                    bob: 0.06 + floor2Rng() * 0.10,
                    rs: (floor2Rng() - 0.5) * 0.012
                };
                ctx.scene.add(g);
                magicParts.push(g);
            }

            /* ========================================================== */
            /* 18.8 小魔女计划板 */
            /* ========================================================== */
            const boardG = new THREE.Group();
            ctx.boardG = boardG;
            boardG.position.set(-2.9, ctx.FY, 2.8);
            boardG.rotation.y = 2.33;
            ctx.scene.add(boardG);
            const boardTilt = new THREE.Group();
            ctx.boardTilt = boardTilt;
            boardTilt.rotation.x = -0.09;
            boardG.add(boardTilt);
            const boardCanvas = document.createElement('canvas');
            ctx.boardCanvas = boardCanvas;
            boardCanvas.width = 512;
            boardCanvas.height = 392;
            const bctx = boardCanvas.getContext('2d');
            ctx.bctx = bctx;

            function drawBoardFace() {
                bctx.fillStyle = '#2f4136';
                bctx.fillRect(0, 0, 512, 392);
                for (let i = 0; i < 340; i++) {
                    bctx.fillStyle = 'rgba(255,255,255,' + (textureRng() * 0.045).toFixed(3) + ')';
                    bctx.fillRect(textureRng() * 512, textureRng() * 392, 2, 2);
                }
                const chalk = 'rgba(238,244,238,0.88)';
                bctx.fillStyle = chalk;
                bctx.strokeStyle = chalk;
                bctx.font = '34px serif';
                bctx.textAlign = 'center';
                bctx.textBaseline = 'alphabetic';
                bctx.fillText('✦ ✧ ❖ ✧ ✦', 256, 52);
                bctx.lineWidth = 2;
                bctx.beginPath();
                bctx.moveTo(120, 68);
                bctx.lineTo(392, 68);
                bctx.stroke();
                bctx.beginPath();
                bctx.moveTo(150, 76);
                bctx.lineTo(362, 76);
                bctx.stroke();
                bctx.lineWidth = 2.2;
                bctx.beginPath();
                bctx.arc(120, 215, 62, 0, 7);
                bctx.stroke();
                bctx.beginPath();
                bctx.arc(120, 215, 40, 0, 7);
                bctx.stroke();
                bctx.beginPath();
                bctx.moveTo(120, 162);
                bctx.lineTo(167, 246);
                bctx.lineTo(73, 246);
                bctx.closePath();
                bctx.stroke();
                bctx.beginPath();
                bctx.moveTo(120, 268);
                bctx.lineTo(73, 184);
                bctx.lineTo(167, 184);
                bctx.closePath();
                bctx.stroke();
                for (let k = 0; k < 8; k++) {
                    const a = k * Math.PI / 4;
                    bctx.beginPath();
                    bctx.moveTo(120 + Math.cos(a) * 62, 215 + Math.sin(a) * 62);
                    bctx.lineTo(120 + Math.cos(a) * 70, 215 + Math.sin(a) * 70);
                    bctx.stroke();
                }
                bctx.font = '22px serif';
                bctx.fillText('✦', 120, 223);
                bctx.textAlign = 'left';
                bctx.font = '26px serif';
                bctx.fillText('△ + ◯ ⇒ ✦', 245, 130);
                bctx.fillText('∴ ✦ ∝ ☽', 262, 172);
                bctx.fillText('☾ ∝ ✱ ∝ ❍', 248, 214);
                bctx.fillText('⟡ ☽ → ● ⟡', 250, 258);
                bctx.fillText('☽ ◐ ● ◑ ☾', 250, 308);
                bctx.font = '16px serif';
                bctx.fillText('✧', 60, 110);
                bctx.fillText('✦', 440, 100);
                bctx.fillText('✧', 470, 225);
                bctx.fillText('✦', 62, 335);
                bctx.fillText('✧', 310, 350);
                bctx.fillText('❖', 455, 175);

                function sticker(x, y, w, h, col, rot) {
                    bctx.save();
                    bctx.translate(x, y);
                    bctx.rotate(rot);
                    bctx.fillStyle = col;
                    bctx.fillRect(-w / 2, -h / 2, w, h);
                    bctx.strokeStyle = 'rgba(0,0,0,0.35)';
                    bctx.lineWidth = 2;
                    bctx.strokeRect(-w / 2, -h / 2, w, h);
                    bctx.fillStyle = 'rgba(255,255,255,0.45)';
                    bctx.fillRect(-w / 2 - 8, -h / 2 - 6, 16, 10);
                    bctx.restore();
                }
                sticker(455, 335, 46, 34, '#ffd166', 0.3);
                sticker(52, 185, 38, 30, '#ff8fab', -0.35);
                sticker(462, 58, 36, 28, '#8fd6ff', 0.15);
                boardTex.needsUpdate = true;
            }
            const boardTex = new THREE.CanvasTexture(boardCanvas);
            ctx.boardTex = boardTex;
            drawBoardFace();
            ctx.put(ctx.log(1.55, 0.035), -0.56, 0.77, 0.04, 0.05, 0, 0.05, boardTilt);
            ctx.put(ctx.log(1.55, 0.035), 0.56, 0.77, 0.04, 0.05, 0, -0.05, boardTilt);
            ctx.put(ctx.log(1.40, 0.035), 0.00, 0.70, -0.32, 0.30, 0, 0, boardTilt);
            ctx.put(ctx.log(1.10, 0.025), 0.00, 0.45, 0.06, 0, 0, Math.PI / 2, boardTilt);
            ctx.put(ctx.log(1.10, 0.025), 0.00, 1.30, 0.02, 0, 0, Math.PI / 2, boardTilt);
            ctx.put(ctx.box(1.27, 1.00, 0.06), 0, 1.00, 0, 0, 0, 0, boardTilt);
            {
                const woodSide = ctx.LITMAT(0xe8e2d0);
                const faceMat = new THREE.MeshBasicMaterial({ map: boardTex });
                const faceMesh = new THREE.Mesh(new THREE.BoxGeometry(1.13, 0.86, 0.03), [woodSide, woodSide, woodSide, woodSide, faceMat, woodSide]);
                faceMesh.position.set(0, 1.00, 0.032);
                boardTilt.add(faceMesh);
                const eLines = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.13, 0.86, 0.03)), ctx.MAT);
                eLines.position.set(0, 1.00, 0.032);
                boardTilt.add(eLines);
            }
            ctx.put(ctx.box(1.20, 0.04, 0.14), 0, 0.54, 0.09, 0, 0, 0, boardTilt);
            const notes = [
                { col: '#ffe66d', txt: '采月光草', rz: 0.12, px: -0.40, py: 1.26 },
                { col: '#ffb3c6', txt: '归还魔法书', rz: -0.08, px: -0.05, py: 1.14 },
                { col: '#aecdff', txt: '作者：YIBI2333', rz: 0.18, px: 0.36, py: 0.84 }
            ];
            ctx.notes = notes;
            ctx.noteEditing = 0;
            for (let i = 0; i < notes.length; i++) {
                const n = notes[i];
                n.canvas = document.createElement('canvas');
                n.canvas.width = 128;
                n.canvas.height = 128;
                n.ctx = n.canvas.getContext('2d');
                n.tex = new THREE.CanvasTexture(n.canvas);
                drawNote(i);
                const g = new THREE.Group();
                const sideMat = ctx.LITMAT(0xffffff);
                const faceMat = new THREE.MeshBasicMaterial({ map: n.tex });
                g.add(new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.17, 0.008), [sideMat, sideMat, sideMat, sideMat, faceMat, sideMat]));
                g.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.17, 0.17, 0.008)), ctx.MAT));
                g.position.set(n.px, n.py, 0.052);
                g.rotation.z = n.rz;
                boardTilt.add(g);
                ctx.regMagic(g, () => openNoteEditor(i));
            }

            function drawNote(i) {
                const n = notes[i];
                const c = n.ctx;
                c.fillStyle = n.col;
                c.fillRect(0, 0, 128, 128);
                c.fillStyle = 'rgba(0,0,0,0.08)';
                c.fillRect(0, 112, 128, 16);
                c.fillStyle = 'rgba(255,255,255,0.55)';
                c.fillRect(44, 0, 40, 14);
                const len = Math.max(n.txt.length, 1);
                const size = len <= 3 ? 34 : len <= 5 ? 26 : len <= 7 ? 20 : 16;
                c.fillStyle = '#3a3a3a';
                c.font = 'bold ' + size + 'px "Microsoft YaHei", monospace';
                c.textAlign = 'center';
                c.textBaseline = 'middle';
                c.fillText(n.txt, 64, 68);
                n.tex.needsUpdate = true;
            }

            function openNoteEditor(i) {
                ctx.noteEditing = i;
                const ed = document.getElementById('noteEditor');
                const inp = document.getElementById('noteInput');
                inp.value = notes[i].txt;
                ed.classList.add('show');
                inp.focus();
                inp.select();
            }
            ctx.eraserOpen = false, ctx.eraserT = 0;
            const eraserG = new THREE.Group();
            ctx.eraserG = eraserG;
            eraserG.position.set(-0.30, 0.585, 0.09);
            boardTilt.add(eraserG);
            ctx.put(ctx.box(0.18, 0.05, 0.08), 0, 0, 0, 0, 0, 0, eraserG);
            ctx.put(ctx.iline([[-0.08, 0.028, -0.035], [-0.08, 0.028, 0.035]]), 0, 0, 0, 0, 0, 0, eraserG);
            ctx.regMagic(eraserG, () => { ctx.eraserOpen = !ctx.eraserOpen; });
            const GLYPHS = ['✦', '☾', '✧', '∴', '⟡', '✱', '☽', '✸'];
            ctx.GLYPHS = GLYPHS;
            const GLYPH_WARM = ['#fff3c9', '#ffd97a'];
            ctx.GLYPH_WARM = GLYPH_WARM;
            const GLYPH_COOL = ['#d9fbff', '#8ff3ff'];
            ctx.GLYPH_COOL = GLYPH_COOL;
            const glyphCanvas = document.createElement('canvas');
            ctx.glyphCanvas = glyphCanvas;
            glyphCanvas.width = 512;
            glyphCanvas.height = 200;
            const gctx = glyphCanvas.getContext('2d');
            ctx.gctx = gctx;
            const glyphTex = new THREE.CanvasTexture(glyphCanvas);
            ctx.glyphTex = glyphTex;
            const glyphPlane = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.4), new THREE.MeshBasicMaterial({ map: glyphTex, transparent: true, opacity: 0, depthWrite: false }));
            ctx.glyphPlane = glyphPlane;
            glyphPlane.position.set(0, 0.95, 0.056);
            glyphPlane.renderOrder = 10;
            boardTilt.add(glyphPlane);

            function drawGlyphSet(curIdx, prog) {
                gctx.clearRect(0, 0, 512, 200);
                for (let i = 0; i < GLYPHS.length; i++) {
                    const gx = 40 + i * 62;
                    const gy = 100 + Math.sin(i * 1.3) * 14;
                    const warm = i % 2 === 1;
                    const col = warm ? GLYPH_WARM[0] : GLYPH_COOL[0];
                    const tr0 = warm ? 'rgba(255,243,201,0)' : 'rgba(217,251,255,0)';
                    gctx.save();
                    gctx.shadowColor = warm ? GLYPH_WARM[1] : GLYPH_COOL[1];
                    gctx.shadowBlur = 22;
                    gctx.font = 'bold 64px serif';
                    gctx.textAlign = 'center';
                    gctx.textBaseline = 'middle';
                    if (i < curIdx) {
                        gctx.fillStyle = col;
                        gctx.fillText(GLYPHS[i], gx, gy);
                    } else if (i === curIdx) {
                        const p = Math.max(0, Math.min(1, prog));
                        const top = gy - 38, bot = gy + 38;
                        const grad = gctx.createLinearGradient(0, top, 0, bot);
                        const wipe = top + (bot - top) * p;
                        const g0 = Math.max(0, (wipe - top) / (bot - top));
                        grad.addColorStop(0, col);
                        grad.addColorStop(Math.max(0.001, g0 - 0.02), col);
                        grad.addColorStop(Math.min(0.999, g0 + 0.02), tr0);
                        grad.addColorStop(1, tr0);
                        gctx.fillStyle = grad;
                        gctx.fillText(GLYPHS[i], gx, gy);
                    }
                    gctx.restore();
                }
                glyphTex.needsUpdate = true;
            }
            drawGlyphSet(0, 0);
            const chalkG = new THREE.Group();
            ctx.chalkG = chalkG;
            const CHALK_HOME = ctx.V(0.18, 0.578, 0.09);
            ctx.CHALK_HOME = CHALK_HOME;
            chalkG.position.copy(CHALK_HOME);
            boardTilt.add(chalkG);
            ctx.put(ctx.edge(new THREE.CylinderGeometry(0.013, 0.013, 0.11, 8)), 0, 0, 0, 0, 0, Math.PI / 2, chalkG);
            ctx.put(ctx.edge(new THREE.CircleGeometry(0.011, 8)), 0.056, 0, 0, 0, Math.PI / 2, 0, chalkG);
            const chalkState = { active: false, start: 0 };
            ctx.chalkState = chalkState;
            const glyphLocalX = i => ((40 + i * 62) / 512 - 0.5) * 1.0;
            ctx.glyphLocalX = glyphLocalX;
            const glyphLocalY = i => 0.95 - (Math.sin(i * 1.3) * 14) / 200 * 0.4;
            ctx.glyphLocalY = glyphLocalY;
            const smooth = k => k * k * (3 - 2 * k);
            ctx.smooth = smooth;
            ctx.regMagic(chalkG, () => {
                if (!chalkState.active) {
                    chalkState.active = true;
                    chalkState.start = clock.now;
                }
            });

            function updateChalk(time) {
                if (!chalkState.active) return;
                const RISE = 0.7, WPS = 0.55, HOLD = 1.8, FADE = 0.8, FALL = 0.7;
                const N = GLYPHS.length;
                const tWrite = RISE + N * WPS;
                const tHold = tWrite + HOLD;
                const tFade = tHold + FADE;
                const tEnd = tFade + FALL;
                const e = time - chalkState.start;
                if (e < RISE) {
                    const k = smooth(e / RISE);
                    const i = 0;
                    chalkG.position.lerpVectors(CHALK_HOME, ctx.V(glyphLocalX(i) + 0.06, glyphLocalY(i) + 0.05, 0.10), k);
                    chalkG.position.y += Math.sin(e * 10) * 0.02 * k;
                    glyphPlane.material.opacity = 0;
                } else if (e < tWrite) {
                    const k = (e - RISE) / WPS;
                    const i = Math.min(Math.floor(k), N - 1);
                    const prog = k - i;
                    drawGlyphSet(i, prog);
                    glyphPlane.material.opacity = Math.min(1, (e - RISE) * 3);
                    const revealY = glyphLocalY(i) + (prog - 0.5) * 0.15;
                    chalkG.position.set(
                        glyphLocalX(i) + 0.06 + Math.sin(time * 26) * 0.012,
                        Math.min(glyphLocalY(i) + 0.05, revealY + 0.03) + Math.sin(time * 19) * 0.008, 0.10
                    );
                } else if (e < tHold) {
                    drawGlyphSet(N, 1);
                    glyphPlane.material.opacity = 0.75 + 0.25 * Math.sin(time * 4);
                    const i = N - 1;
                    chalkG.position.set(glyphLocalX(i) + 0.06, glyphLocalY(i) + 0.05, 0.10);
                } else if (e < tFade) {
                    glyphPlane.material.opacity = Math.max(0, 1 - (e - tHold) / FADE);
                    const i = N - 1;
                    chalkG.position.set(glyphLocalX(i) + 0.06, glyphLocalY(i) + 0.05, 0.10);
                } else if (e < tEnd) {
                    const k = smooth((e - tFade) / FALL);
                    glyphPlane.material.opacity = 0;
                    chalkG.position.lerpVectors(ctx.V(glyphLocalX(N - 1) + 0.06, glyphLocalY(N - 1) + 0.05, 0.10), CHALK_HOME, k);
                } else {
                    chalkState.active = false;
                    glyphPlane.material.opacity = 0;
                    drawGlyphSet(0, 0);
                    chalkG.position.copy(CHALK_HOME);
                }
            }
            const SCROLL_R = 0.055;
            ctx.SCROLL_R = SCROLL_R;

            function scrollRoll(x, z, ry, y) {
                const s = new THREE.Group();
                const body = ctx.edge(new THREE.CylinderGeometry(SCROLL_R, SCROLL_R, 0.52, 10));
                body.rotation.z = Math.PI / 2;
                s.add(body);
                for (const ex of [-0.26, 0.26]) {
                    const c = ctx.edge(new THREE.CircleGeometry(SCROLL_R * 0.9, 10), 1, ctx.IN_MAT);
                    c.position.x = ex;
                    c.rotation.y = Math.sign(ex) * Math.PI / 2;
                    s.add(c);
                }
                const band = ctx.edge(new THREE.TorusGeometry(SCROLL_R + 0.003, 0.012, 6, 16));
                band.rotation.y = Math.PI / 2;
                band.position.x = 0.10;
                s.add(band);
                s.position.set(x, y !== undefined ? y : ctx.FY + SCROLL_R, z);
                s.rotation.y = ry;
                ctx.scene.add(s);
            }
            scrollRoll(-3.42, 3.28, 0.42);
            scrollRoll(-3.44, 3.50, 0.42);
            scrollRoll(-3.43, 3.39, 0.42, ctx.FY + SCROLL_R * (1 + Math.sqrt(3)));
            scrollRoll(-3.72, 3.02, 1.05);

            /* ========================================================== */
            /* 18.9 左墙中央的魔法杖 */
            /* ========================================================== */
            const WAND_Y = ctx.FY + 1.18;
            ctx.WAND_Y = WAND_Y;
            const WAND_Z = 0;
            ctx.WAND_Z = WAND_Z;
            const HOOK_X = -3.72;
            ctx.HOOK_X = HOOK_X;
            const WAND_REST = ctx.V(HOOK_X, WAND_Y - 0.012, WAND_Z);
            ctx.WAND_REST = WAND_REST;
            const WAND_HOVER = ctx.V(-2.95, ctx.FY + 1.60, -0.10);
            ctx.WAND_HOVER = WAND_HOVER;
            const CAST_POS = ctx.V(-0.60, ctx.FY + 1.50, 0.15);
            ctx.CAST_POS = CAST_POS;
            const wandWoodMat = ctx.LITMAT(0xcaa273, { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
            ctx.wandWoodMat = wandWoodMat;
            const wandDarkMat = ctx.LITMAT(0x8a6238, { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
            ctx.wandDarkMat = wandDarkMat;
            const wandEdgeMat = new THREE.LineBasicMaterial({ color: 0x5a4128 });
            ctx.wandEdgeMat = wandEdgeMat;

            function woodPart(g, mat) {
                const grp = new THREE.Group();
                grp.add(new THREE.Mesh(g, mat || wandWoodMat));
                grp.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, 20), wandEdgeMat));
                return grp;
            }
            const hookArcPts = [];
            ctx.hookArcPts = hookArcPts;
            for (let k = 0; k <= 22; k++) {
                const a = Math.PI * 0.75 + k / 22 * Math.PI * 1.5;
                hookArcPts.push(ctx.V(Math.cos(a) * 0.058, Math.sin(a) * 0.058, 0));
            }
            for (const hz of [WAND_Z - 0.30, WAND_Z + 0.30]) {
                ctx.put(ctx.box(0.03, 0.18, 0.08), -3.865, WAND_Y, hz);
                ctx.put(ctx.log(0.15, 0.013), -3.79, WAND_Y, hz, 0, 0, Math.PI / 2);
                const hook = woodPart(new THREE.TorusGeometry(0.058, 0.011, 6, 16, Math.PI * 1.5), wandDarkMat);
                hook.position.set(HOOK_X, WAND_Y, hz);
                hook.rotation.z = Math.PI * 0.75;
                ctx.scene.add(hook);
                const outline = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(hookArcPts), wandEdgeMat);
                outline.position.set(HOOK_X, WAND_Y, hz);
                ctx.scene.add(outline);
            }
            const wandG = new THREE.Group();
            ctx.wandG = wandG;
            wandG.position.copy(WAND_REST);
            ctx.scene.add(wandG);
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
            ctx.crystalG = crystalG;
            crystalG.position.set(0, 0, 0.78);
            wandG.add(crystalG);
            const cryGeo = new THREE.OctahedronGeometry(0.055);
            ctx.cryGeo = cryGeo;
            cryGeo.scale(0.8, 0.8, 1.9);
            const crystalMat = new THREE.MeshBasicMaterial({ color: 0xd8dce0, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
            ctx.crystalMat = crystalMat;
            crystalG.add(new THREE.Mesh(cryGeo, crystalMat));
            crystalG.add(new THREE.LineSegments(new THREE.EdgesGeometry(cryGeo, 1), new THREE.LineBasicMaterial({ color: 0x8a9096 })));
            const cryCore = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false }));
            ctx.cryCore = cryCore;
            crystalG.add(cryCore);

            function wandGlowSphere(r, op) {
                const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), new THREE.MeshBasicMaterial({ color: 0xd8dce0, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false }));
                m.scale.set(0.8, 0.8, 1.5);
                m.renderOrder = 9;
                crystalG.add(m);
                return m;
            }
            const wGlow1 = wandGlowSphere(0.070, 0.15);
            ctx.wGlow1 = wGlow1;
            const wGlow2 = wandGlowSphere(0.13, 0.05);
            ctx.wGlow2 = wGlow2;
            const ELEMENTS = [
                { nm: 'fire', col: 0xff5a2a, glow: 0xff9a4a },
                { nm: 'water', col: 0x3c8aff, glow: 0x8fd4ff },
                { nm: 'ice', col: 0xaef0ff, glow: 0xe8fcff },
                { nm: 'earth', col: 0xc08a4a, glow: 0xe0b070 },
                { nm: 'bolt', col: 0xffe94a, glow: 0xfff8a0 },
                { nm: 'wind', col: 0x7dffb8, glow: 0xd0ffe4 }
            ];
            ctx.ELEMENTS = ELEMENTS;
            const loopLine = (pts, m) => new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), m);
            ctx.loopLine = loopLine;
            const openLine = (pts, m) => new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), m);
            ctx.openLine = openLine;

            function ringPts2(r, n) {
                const a = [];
                for (let i = 0; i < n; i++) {
                    const t = i / n * Math.PI * 2;
                    a.push(ctx.V(Math.cos(t) * r, Math.sin(t) * r, 0));
                }
                return a;
            }

            function polyPts2(r, k, rot) {
                const a = [];
                for (let i = 0; i < k; i++) {
                    const t = rot + i / k * Math.PI * 2;
                    a.push(ctx.V(Math.cos(t) * r, Math.sin(t) * r, 0));
                }
                return a;
            }

            function starPts2(rO, rI, k, rot) {
                const a = [];
                for (let i = 0; i < k * 2; i++) {
                    const t = rot + i / (k * 2) * Math.PI * 2;
                    const r = i % 2 === 0 ? rO : rI;
                    a.push(ctx.V(Math.cos(t) * r, Math.sin(t) * r, 0));
                }
                return a;
            }

            function spiralPts2(rMax, turns, n, rot) {
                const a = [];
                for (let i = 0; i <= n; i++) {
                    const t = i / n;
                    const ang = rot + t * turns * Math.PI * 2;
                    a.push(ctx.V(Math.cos(ang) * t * rMax, Math.sin(ang) * t * rMax, 0));
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
                        ctx.V(Math.cos(a) * 0.44, Math.sin(a) * 0.44, 0),
                        ctx.V(Math.cos(a) * 0.50, Math.sin(a) * 0.50, 0)
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

            function hash01(s) {
                let h = 0;
                for (let i = 0; i < s.length; i++) {
                    h = (h * 31 + s.charCodeAt(i)) % 997;
                }
                return h / 997;
            }

            function jitterGeo(geo, amp) {
                const pa = geo.attributes.position;
                for (let i = 0; i < pa.count; i++) {
                    const k = pa.getX(i).toFixed(3) + ',' + pa.getY(i).toFixed(3) + ',' + pa.getZ(i).toFixed(3);
                    pa.setXYZ(i,
                        pa.getX(i) + (hash01(k + 'x') - 0.5) * 2 * amp,
                        pa.getY(i) + (hash01(k + 'y') - 0.5) * 2 * amp,
                        pa.getZ(i) + (hash01(k + 'z') - 0.5) * 2 * amp
                    );
                }
                geo.computeVertexNormals();
                return geo;
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
                            const s = (1 - p) * 0.9 + 0.12;
                            e.scale.set(s, s, s);
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
                        const s = iceShard(0.026, 0.13 + (i % 2) * 0.05, [Math.cos(a) * 0.55, Math.sin(a) * 0.55]);
                        s.position.set(Math.cos(a) * 0.10, -0.06, Math.sin(a) * 0.10);
                        g.add(s);
                        subs.push(s);
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
                        for (const s of subs) s.rotation.y += 0.02;
                        for (const sp of sparkles) {
                            const a = time * 0.6 + sp.userData.ph * 6.28;
                            sp.position.set(Math.cos(a) * 0.19, 0.05 + Math.sin(a * 1.7) * 0.10, Math.sin(a) * 0.19);
                            sp.material.opacity = 0.3 + 0.7 * Math.abs(Math.sin(time * 5 + sp.userData.ph * 8));
                            const k = 0.7 + 0.5 * Math.abs(Math.sin(time * 4 + sp.userData.ph * 7));
                            sp.scale.set(k, k, k);
                        }
                    };
                } else if (idx === 3) {
                    const rockMat = ctx.LITMAT(0x9a6c3c, { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
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
                        const dir = ctx.V(Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th));
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
                            pts.push(ctx.V(Math.cos(a) * r, -0.09 + t * 0.18, Math.sin(a) * r));
                        }
                        const rb = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.007, 5), A(i % 2 ? 0x7dffb8 : 0xd0ffe4, 0.8));
                        g.add(rb);
                        ribbons.push(rb);
                    }
                    const slashes = [];
                    for (let i = 0; i < 2; i++) {
                        const s = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.008, 6, 20, Math.PI * 0.65), A(0xa8ffce, 0.85));
                        s.rotation.set(1.2 + i * 0.5, i * 1.8, i * 0.9);
                        g.add(s);
                        slashes.push(s);
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
            const wandState = { phase: 'idle', t0: 0, idx: 0, el: null, circleHolder: null, circleSpin: null, crea: null, dir: new THREE.Vector3(1, 0, 0) };
            ctx.wandState = wandState;
            const crystalColor = new THREE.Color(0xd8dce0);
            ctx.crystalColor = crystalColor;
            const crystalTarget = new THREE.Color(0xd8dce0);
            ctx.crystalTarget = crystalTarget;
            const IDENTITY_Q = new THREE.Quaternion();
            ctx.IDENTITY_Q = IDENTITY_Q;
            const aimQ = new THREE.Quaternion();
            ctx.aimQ = aimQ;
            {
                const m = new THREE.Matrix4().lookAt(CAST_POS, WAND_HOVER, ctx.V(0, 1, 0));
                aimQ.setFromRotationMatrix(m);
            }
            ctx.regMagic(wandG, () => {
                if (wandState.phase !== 'idle') return;
                wandState.idx = Math.floor(runtimeRng() * ELEMENTS.length);
                wandState.el = ELEMENTS[wandState.idx];
                wandState.phase = 'fly';
                wandState.t0 = clock.now;
            });

            function clearCast() {
                if (wandState.circleHolder) {
                    ctx.scene.remove(wandState.circleHolder);
                    wandState.circleHolder = null;
                    wandState.circleSpin = null;
                }
                if (wandState.crea) {
                    ctx.scene.remove(wandState.crea);
                    wandState.crea = null;
                }
            }

            function updateWand2(time) {
                crystalG.position.z = 0.78 + Math.sin(time * 2) * 0.02;
                crystalG.rotation.z += 0.025;
                crystalColor.lerp(crystalTarget, 0.08);
                crystalMat.color.copy(crystalColor);
                wGlow1.material.color.copy(crystalColor);
                wGlow2.material.color.copy(crystalColor);
                const FLY = 0.8, GROW = 0.5, HOLD = 2.3, FADE = 0.6, RET = 0.8;
                const s = wandState;
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
                        ctx.scene.add(s.circleHolder);
                        s.crea = buildCreation(s.idx, s.el);
                        s.crea.position.copy(CAST_POS).addScaledVector(s.dir, 0.42);
                        s.crea.scale.setScalar(0.01);
                        ctx.scene.add(s.crea);
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

            /* ========================================================== */
            /* 18.10 垃圾桶 / 抽纸盒 / 衣柜（二楼） */
            /* ========================================================== */
            function cbox(w, h, d, col) {
                const grp = new THREE.Group();
                const g = new THREE.BoxGeometry(w, h, d);
                grp.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: col, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })));
                grp.add(new THREE.LineSegments(new THREE.EdgesGeometry(g), ctx.MAT));
                return grp;
            }

            function crboxCol(w, h, d, r, col) {
                const grp = new THREE.Group();
                const g = ctx.roundBoxGeo(w, h, d, r);
                grp.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: col, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })));
                grp.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, 12), ctx.MAT));
                return grp;
            }

            function crumpleBall(r) {
                const grp = new THREE.Group();
                const g = jitterGeo(new THREE.SphereGeometry(r, 10, 8), r * 0.15);
                grp.add(new THREE.Mesh(g, ctx.LITMAT(0xffffff, { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })));
                grp.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, 20), ctx.MAT));
                return grp;
            }

            function arcPos(a, b, t, h) {
                const p = a.clone().lerp(b, t);
                p.y += Math.sin(Math.PI * t) * h;
                return p;
            }
            const wobblers = [];
            ctx.wobblers = wobblers;

            function regWobble(g) {
                g.userData.wob = { amp: 0, t: 0 };
                wobblers.push(g);
                ctx.regMagic(g, function () {
                    g.userData.wob.amp = 1;
                    g.userData.wob.t = 0;
                });
            }

            function updateWobblers(dt) {
                for (const g of wobblers) {
                    const w = g.userData.wob;
                    if (w.amp < 0.005) {
                        g.rotation.z = 0;
                        continue;
                    }
                    w.t += dt;
                    w.amp *= Math.pow(0.10, dt);
                    g.rotation.z = Math.sin(w.t * 13) * 0.42 * w.amp;
                }
            }

            /* ========================================================== */
            /* 衣柜 */
            // J3（B4）：几何已搬入 src/cabin/world/floor2/wardrobe.js，此处只留装配调用。
            ctx.installProp(wardrobe);
            /* 18.11 墙钩挎包 / 置物箱与魔女帽 / 可推拉小凳子 */
            // J3（B4）：几何已搬入 src/cabin/world/floor2/bag.js，此处只留装配调用。
            ctx.installProp(bag);
            /* 置物箱（挎包旁边地上）：加宽 + 简化 + 颜色统一 */
            // J3（B4）：几何已搬入 src/cabin/world/floor2/crate.js，此处只留装配调用。
            ctx.installProp(crate);
            /* 可推拉小凳子（挎包下方、箱子旁的地上，点击拉出/推回） */
            /* ========================================================== */
            const stoolG = new THREE.Group();
            ctx.stoolG = stoolG;
            stoolG.position.set(0.22, ctx.FY, 3.50);
            ctx.scene.add(stoolG);
            {
                const ST_COL = 0xa07850;   // 与置物箱统一木色
                const ST_DARK = 0x8a6238;
                // 凳面（圆角）
                const seat = crboxCol(0.34, 0.05, 0.30, 0.02, ST_COL);
                seat.position.y = 0.27;
                stoolG.add(seat);
                // 四条腿（微微外撇）
                for (const sx of [-1, 1]) {
                    for (const sz of [-1, 1]) {
                        const leg = ctx.edge(new THREE.CylinderGeometry(0.02, 0.024, 0.25, 8));
                        leg.position.set(sx * 0.13, 0.135, sz * 0.11);
                        leg.rotation.z = sx * 0.05;
                        leg.rotation.x = -sz * 0.05;
                        stoolG.add(leg);
                    }
                }
                // 侧面横撑
                ctx.put(cbox(0.24, 0.025, 0.025, ST_DARK), 0, 0.10, 0.105, 0, 0, 0, stoolG);
                ctx.put(cbox(0.24, 0.025, 0.025, ST_DARK), 0, 0.10, -0.105, 0, 0, 0, stoolG);
                ctx.put(cbox(0.025, 0.025, 0.19, ST_DARK), 0.125, 0.10, 0, 0, 0, 0, stoolG);
                ctx.put(cbox(0.025, 0.025, 0.19, ST_DARK), -0.125, 0.10, 0, 0, 0, 0, stoolG);
                // 凳面小坐垫
                const cushion = crboxCol(0.26, 0.045, 0.22, 0.02, 0x7a5a8a);
                cushion.position.y = 0.305;
                stoolG.add(cushion);
            }
            ctx.regSlide(stoolG, 'z', -0.38);
            ctx.regMagic(stoolG, () => {
                stoolG.userData.slide.open = !stoolG.userData.slide.open;
            });

            /* ========================================================== */
            /* 魔女帽：更大帽檐 + 低弯折尖，点击飞起撒糖果 */
            // J3（B4）：几何已搬入 src/cabin/world/floor2/witchHat.js，此处只留装配调用。
            const witchHatApi = ctx.installProp(witchHat);
            ctx.witchHatApi = witchHatApi;
            /* 垃圾桶 */
            // J3（B4）：几何已搬入 src/cabin/world/floor2/bin.js，此处只留装配调用。
            ctx.installProp(bin);
            /* 抽纸盒 */
            // J3（B4）：几何已搬入 src/cabin/world/floor2/tissueBox.js，此处只留装配调用。
            const tissueBoxApi = ctx.installProp(tissueBox);
            ctx.tissueBoxApi = tissueBoxApi;
            /* 18.12 烟囱墙：魔法时钟（与现实时间同步） */
            /* ========================================================== */
            function colEdge(g, col, th) {
                const grp = new THREE.Group();
                grp.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: col, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })));
                grp.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, th === undefined ? 20 : th), ctx.MAT));
                return grp;
            }
            const clockCanvas = document.createElement('canvas');
            ctx.clockCanvas = clockCanvas;
            clockCanvas.width = 256;
            clockCanvas.height = 256;
            const cctx = clockCanvas.getContext('2d');
            ctx.cctx = cctx;
            const clockTex = new THREE.CanvasTexture(clockCanvas);
            ctx.clockTex = clockTex;
            ctx.clockLastKey = '';
            function clockHand(ang, len, w, col) {
                cctx.strokeStyle = col;
                cctx.lineWidth = w;
                cctx.lineCap = 'round';
                cctx.beginPath();
                cctx.moveTo(128 - Math.cos(ang) * 14, 128 - Math.sin(ang) * 14);
                cctx.lineTo(128 + Math.cos(ang) * len, 128 + Math.sin(ang) * len);
                cctx.stroke();
            }
            function drawClock() {
                const now = clock.mode === 'manual' && clock.frozenDateMs !== null ? new Date(clock.frozenDateMs) : new Date();
                const key = now.getHours() + ':' + now.getMinutes() + ':' + now.getSeconds();
                if (key === ctx.clockLastKey) return;
                ctx.clockLastKey = key;
                const c = cctx;
                c.fillStyle = '#faf4e4';
                c.beginPath(); c.arc(128, 128, 122, 0, 7); c.fill();
                c.strokeStyle = '#3a3a3a';
                c.lineWidth = 4;
                c.beginPath(); c.arc(128, 128, 119, 0, 7); c.stroke();
                for (let i = 0; i < 12; i++) {
                    const a = i / 12 * Math.PI * 2 - Math.PI / 2;
                    c.lineWidth = i % 3 === 0 ? 5 : 2.5;
                    c.beginPath();
                    c.moveTo(128 + Math.cos(a) * 100, 128 + Math.sin(a) * 100);
                    c.lineTo(128 + Math.cos(a) * 112, 128 + Math.sin(a) * 112);
                    c.stroke();
                }
                c.fillStyle = '#5a4a6a';
                c.font = 'bold 26px serif';
                c.textAlign = 'center';
                c.textBaseline = 'middle';
                c.fillText('12', 128, 52);
                c.fillText('3', 204, 128);
                c.fillText('6', 128, 204);
                c.fillText('9', 52, 128);
                c.fillStyle = '#b8912a';
                c.font = '15px serif';
                c.fillText('✦', 128, 94);
                const h = now.getHours() % 12, m = now.getMinutes(), s = now.getSeconds();
                clockHand((h + m / 60) / 12 * Math.PI * 2 - Math.PI / 2, 56, 6.5, '#3a3a3a');
                clockHand((m + s / 60) / 60 * Math.PI * 2 - Math.PI / 2, 86, 4.5, '#3a3a3a');
                clockHand(s / 60 * Math.PI * 2 - Math.PI / 2, 98, 2, '#b04a4a');
                c.fillStyle = '#3a3a3a';
                c.beginPath(); c.arc(128, 128, 7, 0, 7); c.fill();
                c.fillStyle = '#b04a4a';
                c.beginPath(); c.arc(128, 128, 3, 0, 7); c.fill();
                clockTex.needsUpdate = true;
            }
            drawClock();
            const clockG = new THREE.Group();
            ctx.clockG = clockG;
            clockG.position.set(-2.95, ctx.FY + 1.42, ctx.CHZ);
            clockG.rotation.y = Math.PI / 2;
            ctx.scene.add(clockG);
            {
                clockG.add(ctx.edge(new THREE.TorusGeometry(0.30, 0.042, 8, 30)));
                const face = new THREE.Mesh(new THREE.CircleGeometry(0.285, 30), new THREE.MeshBasicMaterial({ map: clockTex }));
                face.position.z = 0.028;
                clockG.add(face);
                ctx.put(colEdge(new THREE.OctahedronGeometry(0.05), 0xb8912a), 0, 0.40, 0.02, 0, 0, 0, clockG);
                ctx.put(colEdge(new THREE.OctahedronGeometry(0.028), 0xb8912a), -0.36, 0, 0.02, 0, 0, 0, clockG);
                ctx.put(colEdge(new THREE.OctahedronGeometry(0.028), 0xb8912a), 0.36, 0, 0.02, 0, 0, 0, clockG);
            }

            /* ========================================================== */
            /* 18.13 前墙挂画（镜子旁，点击编辑链接，支持 gif 动图） */
            // J3（B5）：几何已搬入 src/cabin/world/floor2/picture.js，此处只留装配调用。
            const pictureApi = ctx.installProp(picture);
            ctx.pictureApi = pictureApi;
            /* 18.14 拱形全身镜（点击镜面泛起水波涟漪） */
            // J3（B4）：几何已搬入 src/cabin/world/floor2/mirror.js，此处只留装配调用。
            const mirrorApi = ctx.installProp(mirror);
            ctx.mirrorApi = mirrorApi;
            /* 18.15 毛茸茸大地毯（右前角与书桌之间） */
            // J3（B1）：几何已搬入 src/cabin/world/floor2/rugLarge.js，此处只留装配调用。
            ctx.installProp(rugLarge);
            /* 18.16 右前角杂物纸箱（左右两片盖向外翻开） */
            // J3（B3）：几何已搬入 src/cabin/world/floor2/junkBoxes.js，此处只留装配调用。
            const junkApi = ctx.installProp(junkBoxes);
            ctx.junkApi = junkApi;
            /* 18.17 新增装饰统一刷新（独立动画循环） */
            /* ========================================================== */
            // ★ J4.27 判定（任务 D 第 12 组「`floor2/decor-loop`」的"单独判定"）：
            //
            //   **`18.17` 不是一个物件，不该也不能升格 `defineProp`。** 它是两件事的**旧住址**，
            //   而那两件事现在**各有归属**：
            //
            //   | 原来在这里 | 现在在哪 |
            //   |---|---|
            //   | 挂画 GIF 帧重绘（每 0.1 秒） | `world/floor2/picture.js` —— 下面**原地调用** |
            //   | 镜面涟漪老化 + 每 0.12 秒重绘 | `world/floor2/mirror.js` —— 原地调用 |
            //   | 纸箱开合 6 行 | `world/floor2/junkBoxes.js` —— 原地调用 |
            //   | 时钟重绘 | **待 `floor2/magic-clock` 升格**（本行 `drawClock()` 是最后一段"原生的"） |
            //   | 便签编辑器（DOM） | `systems/ui/editors/NoteEditor.js`（`installNoteEditor`，段 11）—— **早已归位** |
            //
            //   **为什么它不是物件**（三条，逐条对应 `defineProp` 的必填字段）：
            //   ① `build` 是必填项，而本函数一行 `scene.add` 都没有 —— 它是**调度器**，不是陈设；
            //   ② 它有**两条驱动路径**（realtime 由自己的 rAF 自驱、manual 由 `FrameBody` 的
            //      `frame/101` 调用）—— 搬进某个物件的 `update` 等于把这条循环拔掉；
            //   ③ `clock` 不在装配环境里，而两条路径都要读 `clock.mode`。
            //
            //   ⇒ 它**从"待搬物件清单"里关闭**，不再作为任务 D 的待办项。
            //      详细判定与遗留见 `docs/实施结果/J4.27-实施结果.md`；
            //      历史留痕见 `scripts/oneoff/_j3-specs/floor2-decor-loop.SKIP.md`（`J3` 原文，不改）。
            function updateNewDecor(time, dt) {
                drawClock();
                // J3（B5）：挂画 GIF 帧重绘（每 0.1 秒）的每帧分支已搬入 world/floor2/picture.js（原地 tick）
                // ⚠️ 参数顺序是 (dt, time) —— 原函数的形参顺序与 tick 相反。
                pictureApi.tick(dt, time);
                // J3（B4）：镜面涟漪的每帧分支已搬入 world/floor2/mirror.js（原地 tick）
                // ⚠️ 参数顺序是 (dt, time) —— 本函数 updateNewDecor(time, dt) 的形参是反的。
                mirrorApi.tick(dt, time);
                // J3（B3）：右前角杂物纸箱的开合分支已搬入 world/floor2/junkBoxes.js（原地 tick）
                // ⚠️ 参数顺序是 (dt, time) —— 而本函数 `updateNewDecor` 自己的形参是 (time, dt)，写反会改变开合速度。
                junkApi.tick(dt, time);
            }
            ctx.decorLastT = 0;
            // ⚠️ J4.27：`ctx.mirrorDirtyT` 是**死变量** —— 镜面的节流计时已随 `mirror.js` 升格
            //    迁进它自己的 `state.dirtyT`（`J3` 的 B4 那批），此后这里只剩一次赋值、无任何读者。
            //    **本任务刻意不删**：删它属于"清理"，与判定无关；且 `J3` 的 SKIP §2 末段曾把它列为
            //    `verify-f03.mjs` 的断言对象（那条约束**已过时**：该脚本第 ⑥ 项检查的是
            //    **F0.3 完成时的快照**，不是当前文件 —— 实测本任务全程 `verify` 全绿）。
            ctx.mirrorDirtyT = 0;
            // F0.3：装饰循环（时钟 / 镜子涟漪 / 挂画 GIF / 纸箱）
            //   realtime：沿用 performance.now()，行为与改动前完全一致
            //   manual  ：读 clock.now / clock.dt，跟随手动步进（由主循环驱动，见 tickOnce 末尾）
            // ★ J4.27：**这两条路径是有意保留的，不是遗漏** —— realtime 下 `dt` 来自
            //   `performance.now()` 差值（与 `clock.dt` 解耦，是节流语义的一部分），
            //   manual 下由 `FrameBody` 的 `frame/101` 驱动（逐帧定格，像素回归靠它）。
            //   合并成一条路径需要同时满足"realtime 节流不变"与"manual 定格不变"，
            //   属于**主循环收口的剩余项**，与 `magic-clock` 的升格耦合（见 J4.27 §6）。
            (function decorLoop() {
                requestAnimationFrame(decorLoop);
                if (clock.mode === 'manual') return;   // 手动模式由 tickOnce 负责调用
                const t = performance.now() * 0.001;
                const dt = Math.min(0.05, Math.max(0.001, t - ctx.decorLastT));
                ctx.decorLastT = t;
                updateNewDecor(t, dt);
            })();
            /* ============ 便签编辑器（二楼计划板） ============ */
}
