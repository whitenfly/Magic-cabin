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
import wand from './wand.js'
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
            // ★ J4.45：`wand` 已搬完 ⇒ 本件的 **11 项**（上行的 5 项 + 下面 `spiralPts2` /
            //   `buildMagicCircle` / `makeSolidFlame` / `buildCreation` 4 项 +
            //   `clearCast` / `updateWand2` 2 项）**已全部删除**。
            //   ⇒ ★ **本清单现在只剩 4 项共享工具**（`cbox` / `crboxCol` / `crumpleBall` / `arcPos`），
            //     "段导出悬空"这一类债**全部清完**（J4.36 起从 6 项一路降到 0 项私有导出）。
            // ⚠️ J4.31：原来的 `ctx.hash01 = hash01; ctx.jitterGeo = jitterGeo;` 两个分句已删除 ——
            //    它们靠**函数声明提升**引用本段的局部函数，而那两个函数已提取到
            //    `core/geometry/jitter.js`（本文件顶部 import 同名进来）。
            //    全局搜索确认 `ctx.hash01` / `ctx.jitterGeo` **没有任何读者**（`propCtx` 的
            //    `propTool('hash01'/'jitterGeo', …)` 已改为直接指向 `core/` 的实现），
            //    留着会让本段在装配期抛 ReferenceError（同 J4.20/26/28/30 的同类坑 —— 第五次）。
            // ★ J4.45：本件的 4 项（`spiralPts2` / `buildMagicCircle` / `makeSolidFlame` /
            //   `buildCreation`）与本行下面原属 18.9 的 2 项（`clearCast` / `updateWand2`）
            //   也已删除 —— 它们随 18.9 整段搬进 `floor2/wand.js`。
            ctx.cbox = cbox; ctx.crboxCol = crboxCol; ctx.crumpleBall = crumpleBall; ctx.arcPos = arcPos;
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

            /* 18.9 左墙中央的魔法杖 */
            // J4.45：整段（610 行，J4.44 施工图 §1 的 16 个子块）已搬入
            //   src/cabin/world/floor2/wand.js，此处只留装配调用。
            // ★ 本件是任务 D **最大**的一件，且**高度内聚**（updateWand2 引用几乎全部子块）
            //   ⇒ 施工图 §0 明确"不可分段搬"。
            // ★ `rng`：9 处 runtimeRng 全部在**运行期**（点击施法时），build 期一次都不消耗
            //   ⇒ 装配位置对随机数序列没有约束；但点击后的调用顺序逐字保持。
            // ★ `scene.add`：build 期 3 处（两个挂钩 + outline + wandG，顺序敏感、留在原位），
            //   运行期 4 处（circleHolder / crea 的加入与移除）。
            // ★ 帧任务只有 1 条（原 frame/58），无合并。
            // ★ 段导出清单里属于本件的 **11 项已全部删除** ⇒ 该清单从此只剩 4 项共享工具。
            const wandApi = ctx.installProp(wand);
            ctx.wandApi = wandApi;

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
