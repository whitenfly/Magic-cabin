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
import board from './board.js'
import astro from './astro.js'
import candle from './candle.js'
import calendar from './calendar.js'
import cardDeck from './cardDeck.js'
import coinTowers from './coinTowers.js'
import crate from './crate.js'
import desk from './desk.js'
import deskChair from './deskChair.js'
import deskHourglass from './deskHourglass.js'
import junkBoxes from './junkBoxes.js'
import magicBook from './magicBook.js'
import magicClock from './magicClock.js'
import magicVeil from './magicVeil.js'
import mirror from './mirror.js'
import nightstand from './nightstand.js'
import picture from './picture.js'
import rubik from './rubik.js'
import rugLarge from './rugLarge.js'
import snowGlobe from './snowGlobe.js'
import starParticles from './starParticles.js'
import tissueBox from './tissueBox.js'
import wardrobe from './wardrobe.js'
import witchHat from './witchHat.js'
import { clock } from '../../app/clock.js'
import { runtime, scene } from '../../app/rng.js'
// ★ J4.31：`smooth` / `hash01` / `jitterGeo` 原先**定义在本文件的两个分区里**
//   （18.8 计划板 / 18.9 魔法杖），已提取到 `core/`（见 core/math/easing.js 与
//   core/geometry/jitter.js 的文件头）。本文件仍按**原名**使用它们 ⇒ 段内代码一字未改。
import { smooth } from '../../core/math/easing.js'
import { hash01, jitterGeo } from '../../core/geometry/jitter.js'

export function installFloor2(ctx, app) {
  const runtimeRng = runtime
  const floor2Rng = scene.floor2
  const textureRng = scene.texture
            // ↓ J4 段导出（floor2）：本段函数声明挂到 ctx（借提升，段内任何位置都可见）
            // ★ J4.36：`getGlyphTex` / `spawnGlyphs` / `updateGlyphs` / `updateBook` 四项已从本行**移除** ——
            //   它们随 18.4 魔法书本整段搬进了 `floor2/magicBook.js`（成为该物件 `update` 的内部实现），
            //   搬前已 grep 全仓确认**无任何外部读者**（`FrameBody.js` 的两处 tick 改走本物件的 `update`）。
            // ★ J4.38：`glowBall` 也已从本行**移除** —— 它是 18.5 星象仪的局部工厂，
            //   已随该段搬进 `floor2/astro.js` 的 `build` 闭包。搬前已 grep 全仓确认无外部读者。
            // ★ J4.39：`ctx.makeCandleGlow` 也已**移除** —— 它是 18.3 蜡烛的局部工厂，已随该段
            //   搬进 `floor2/candle.js` 的 `build` 闭包。搬前已 grep 全仓确认无外部读者。
            //   ⇒ ★ **这几行原有的 6 项悬空导出已全部清空**
            //     （J4.36 删 4 项 · J4.38 删 `glowBall` · 本件删 `makeCandleGlow`）
            //     —— 这一类"段导出悬空"的存量债**首次归零**：从此每搬一件只减不增。
            //   （下方仍保留的是**其它段**的导出 —— 与已搬走的物件无关。）
            // ★ J4.41：`ctx.addHalo` 也已**移除** —— 它是 18.7 星空粒子的局部工厂，已随该段
            //   搬进 `floor2/starParticles.js` 的 `build` 闭包。搬前已 grep 全仓确认无外部读者。
            // ★ J4.43：`drawBoardFace` / `drawNote` / `openNoteEditor` / `drawGlyphSet` /
            //   `updateChalk` 与下一行的 `scrollRoll` **六项**已全部移除 —— 它们随 18.8 整段
            //   搬进 `floor2/board.js`（编辑器也一并归位）。搬前已 grep 全仓确认无外部读者。
            //   ⇒ ★ 本清单现在**只剩 18.9 魔法杖那一段的导出**（`woodPart` / `wandGlowSphere` /
            //     `ringPts2` / `polyPts2` / `starPts2`）—— 等 `wand` 搬完即可整行消失。
            ctx.woodPart = woodPart; ctx.wandGlowSphere = wandGlowSphere; ctx.ringPts2 = ringPts2; ctx.polyPts2 = polyPts2; ctx.starPts2 = starPts2;
            // ⚠️ J4.31：原来的 `ctx.hash01 = hash01; ctx.jitterGeo = jitterGeo;` 两个分句已删除 ——
            //    它们靠**函数声明提升**引用本段的局部函数，而那两个函数已提取到
            //    `core/geometry/jitter.js`（本文件顶部 import 同名进来）。
            //    全局搜索确认 `ctx.hash01` / `ctx.jitterGeo` **没有任何读者**（`propCtx` 的
            //    `propTool('hash01'/'jitterGeo', …)` 已改为直接指向 `core/` 的实现），
            //    留着会让本段在装配期抛 ReferenceError（同 J4.20/26/28/30 的同类坑 —— 第五次）。
            ctx.spiralPts2 = spiralPts2; ctx.buildMagicCircle = buildMagicCircle; ctx.makeSolidFlame = makeSolidFlame; ctx.buildCreation = buildCreation;
            ctx.clearCast = clearCast; ctx.updateWand2 = updateWand2; ctx.cbox = cbox; ctx.crboxCol = crboxCol; ctx.crumpleBall = crumpleBall; ctx.arcPos = arcPos;
            // ⚠️ J4.30：原来的 `ctx.clockHand = clockHand; ctx.drawClock = drawClock;` 两个分句已删除 ——
            //    它们 `J3` 时代随 18.12 段导出，靠**函数声明提升**引用本段的局部函数；
            //    时钟升格为 `world/floor2/magicClock.js` 之后这两个函数随它搬走，
            //    留着会让本段在装配期抛 ReferenceError（同 J4.20 的 startQuill / J4.26 的 makeCup /
            //    J4.28 的 makeCushion —— 同类坑的**第四次**，已按惯例先查段导出清单）。
            //    `ctx.colEdge` **必须保留**：`colEdge` 仍定义在本文件（18.12 段的开头 6 行），
            //    且被 mirror / junkBoxes / picture 三件的 build 读取（见 magicClock.js 文件头「关键偏离」）。
            ctx.regWobble = regWobble; ctx.updateWobblers = updateWobblers; ctx.colEdge = colEdge; ctx.updateNewDecor = updateNewDecor;
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
            /* ---- 18.3 蜡烛（光源槽 5）---- */
            // ★ J4.39：`astroRef` 是**可变引用容器** —— 本件（18.3）的装配位置在星象仪（18.5）
            //   **之前**，此处还拿不到 `astroApi`；而装配位置**不能移**（它会决定 candle 几何
            //   的 `scene.add` 次序，进而影响渲染顺序 ⇒ 画面会变）。
            //   ⇒ 先给一个空容器，等 18.5 装好 astro 之后再回填 `astroRef.api`
            //     （`update` 每帧才读它，第一帧时两件都已装配完毕）。
            const astroRef = { api: null };
            // J4.39：几何 + 两支火苗 + 三层辉光 + 四条帧任务已全部搬入
            // src/cabin/world/floor2/candle.js，此处只留装配调用。
            // ★ 本件是任务 D 到目前为止**帧任务最分散**的一件：原 frame/35（L266）与
            //   frame/70（L528）相隔 **35 个帧任务**（另有 frame/71、frame/74），
            //   四条已合并进它的 `update`，登记在 `astro` 之后（J4.37 §3.3 的组 9 顺序）。
            // ★ 它同时接管了光源**槽位 5** —— world/lights.js 里那一行已随之删除。
            // ⚠️ `frame/74` 的 `boost` 读组 9 的共享状态轴 `magicP`（owner = astro）⇒
            //   经**装配选项**注入 `astroApi`（与 J4.34 的 cupFactory 同一手法）。
            ctx.candleApi = ctx.installProp(candle, { ctx: { astroRef } });


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
            // J4.36：几何（封面 / 书脊 / 6 张翻页 / 7 张扇页）+ `bookState` 状态机 + 符文系统
            // （`GLYPH_SYMS` / `getGlyphTex` / `glyphObjs` / `spawnGlyphs` / `updateGlyphs`）
            // 已全部搬入 src/cabin/world/floor2/magicBook.js，此处只留装配调用。
            // ⚠️ 本件有**两处不相邻的 tick**（原 `updateBook(time, dt)` 与 `updateGlyphs(time, dt)`，
            //    中间夹着 `updateCal(dt)`）—— 合并进同一个 `update()`，登记在**靠前**的那一处，
            //    内部两段顺序与原实现一致（见模块头「两处不相邻的 tick 怎么合并」）。
            const magicBookApi = ctx.installProp(magicBook);
            ctx.magicBookApi = magicBookApi;

            /* 18.5 星象仪 */
            // J4.38：几何已搬入 src/cabin/world/floor2/astro.js，此处只留装配调用。
            // ★ 本件是组 9 的 **`magicP` owner** —— `veil`（frame/73）与 `candle`（frame/74）
            //   经装配选项注入取用它（`installProp(veil, { ctx: { astroApi } })`），
            //   手法与 J4.34 的 `installProp(teapot, { ctx: { cupFactory } })` 一致。
            //   本件原有三条**不相邻**的帧任务（frame/72 / 75 / 76）已合并进它的 `update`，
            //   并登记在组 9 的**最前**（J4.37 §3.3 决定的顺序 astro → candle → veil → stars）。
            const astroApi = ctx.installProp(astro);
            ctx.astroApi = astroApi;
            // ★ J4.39：回填 18.3 蜡烛那个可变容器 —— `candle` 的 `frame/74` 要读 `magicP`（本件的 state）
            astroRef.api = astroApi;

            /* ========================================================== */
            /* 18.6 二楼夜幕 */
            /* ========================================================== */
            /* 18.6 二楼夜幕（光源槽 6）*/
            // J4.40：几何（五边形轮廓 + ExtrudeGeometry 挤出的大罩子）已搬入
            // src/cabin/world/floor2/magicVeil.js，此处只留装配调用。
            // ★ 本件没有交互（原 18.6 段没有任何 regMagic）—— 它随星象仪的开关一起明暗。
            // ★ 它的唯一帧任务 frame/73 读 `magicP`（owner = astro）；本件在 18.6 装配，
            //   晚于 18.5 的 astro ⇒ **直接注入 `astroApi`** 即可（不需要 candle 那种回填容器）。
            // ★ 它同时接管了光源**槽位 6** —— world/lights.js 里那一行已随之删除，
            //   那个文件从此**不再持有任何 register 调用**（批 2 收尾）。
            ctx.magicVeilApi = ctx.installProp(magicVeil, { ctx: { astroApi } });

            /* ========================================================== */
            /* 18.7 宇宙星空粒子系统 */
            /* ========================================================== */
            /* 18.7 宇宙星空粒子系统 */
            // J4.41：96 颗星的几何（六种形态 + `addHalo` 局部工厂）已搬入
            // src/cabin/world/floor2/starParticles.js，此处只留装配调用。
            // ★ 本件**单件消耗 672 次 `floor2Rng`**（96 颗 × 7 次）—— 全项目最多，
            //   且全部发生在 `build` 期 ⇒ **装配位置必须留在原位**，否则它之后所有依赖
            //   `floor2Rng` 的段（18.8 计划板 / 18.9 魔法杖 / 18.10 垃圾桶…）抽到的随机数
            //   全部错位、画面必变（不变量 N8）。它从装配环境取 `rng.floor2`，与本文件
            //   顶部的 `const floor2Rng = scene.floor2` 是**同一个实例**。
            // ★ 本件没有交互（原段无 regMagic）、不持有光源槽位；唯一帧任务 frame/77
            //   读组 9 的 `magicP`（owner = astro，本件在 18.7 装配、晚于 18.5 ⇒ 直接注入）。
            ctx.starParticlesApi = ctx.installProp(starParticles, { ctx: { astroApi } });

            /* 18.8 小魔女计划板 */
            // J4.43：整段（336 行，`J4.42` 施工图 §1）已搬入 src/cabin/world/floor2/board.js，
            //   此处只留装配调用。该段实际含**三块**内容：
            //     A 计划板本体 + 3 张便签 + 便签编辑器 · B 粉笔与字形组 · C scrollRoll + 4 个卷轴
            //   （C 与计划板无语义关系，按施工图 §1 的裁决一并搬，将来可拆成 floor2/scrolls）。
            // ★ 编辑器**整体归物件**（施工图 §2 的裁决，照 floor2/picture.js 的既有先例）：
            //   `systems/ui/editors/NoteEditor.js` 的 `applyNote` + 两个 DOM 监听已搬进 board.js，
            //   该文件**已删除**、installCabin.js 的段调用一并去掉。
            // ★ `rng`：本件消耗 **1020 次** `rng.texture`（`drawBoardFace` 里 340 × 3）——
            //   **全项目单件最多**，且全在 build 期 ⇒ 装配位置必须留在原位（不变量 N8）。
            //   ⚠️ 本行原写作「textureRng 带括号」，但那会污染 `verify-migration.mjs` 的
            //     `Math.random` 计数（它的剥注释只处理块注释、不处理行注释，
            //     而带括号的 textureRng 会被反向还原成 Math.random）⇒ 已去掉括号。
            //     （本注释本身也必须遵守同一条 —— 所以这里连括号都不写。）
            // ★ 帧任务：原 frame/55 + frame/56 + frame/57 **三条相邻** ⇒ 合并天然等价（判据 ①）。
            const boardApi = ctx.installProp(board);
            ctx.boardApi = boardApi;
            // ★ 唯一保留的跨层豁免（施工图 §2.4 方案 a）：`ctx.noteInput` 有两个**系统层**读者
            //   （Input.js L24 · PlayerController.js L20 —— 「在输入框里打字时吞掉游戏快捷键」），
            //   所以由装配层显式写回。⚠️ **不能在 board.js 的 build 里写** —— `propCtx` 的属性是
            //   只读 getter，ES module 严格模式下赋值会直接抛 TypeError ⇒ 必须经 parts 走出来。
            ctx.noteInput = boardApi.parts.noteInput;

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

            // ★ J4.31：`hash01(s)` 与 `jitterGeo(geo, amp)` 原先**定义在这里**（18.9 魔法杖段内），
            //   却是 `ctx` 里的**共享工具**（`junkBoxes.js` 的 `crumpleBall` 也在用）——
            //   已提取到 `core/geometry/jitter.js`，本文件顶部 import 同名进来（段内调用一字未改）。
            //   ⚠️ 那两个函数的实现是"一个字符都不能改"的典型（`toFixed(3)` 字符串哈希），
            //      提取时**逐字搬运**，见该模块文件头。

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
            // J4.30：**时钟本体**（canvas + 表盘 + 三根指针 + 三个装饰八面体）已搬入
            // src/cabin/world/floor2/magicClock.js。
            // ⚠️ **关键偏离**：区间从 `const clockCanvas` 那一行开始 —— 上面那 6 行 `colEdge`
            //    是**共享工具**（被 mirror / junkBoxes / picture 三件读取），必须原地保留。
            const clockApi = ctx.installProp(magicClock);
            ctx.clockApi = clockApi;

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
                // J4.30：时钟重绘（原 `drawClock();`）已搬入 world/floor2/magicClock.js（**原地 tick**）
                // ⚠️ 参数顺序是 (dt, time) —— 本函数 `updateNewDecor(time, dt)` 的形参是反的。
                clockApi.tick(dt, time);
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
