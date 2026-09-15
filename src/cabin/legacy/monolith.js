/**
 * 魔法小木屋 —— 原始实现（原样搬迁，F1 阶段）
 *
 * 来源：line-art-style-magic-cabin-main/index.html 第 844–9807 行
 * 改动：**仅两处**
 *   ① 顶部新增 `import * as THREE from 'three'`（原为全局 THREE，来自 three.min.js）
 *   ② 文件末尾无改动（IIFE 自执行，行为与原来一致）
 *
 * ⚠️ 本文件在 F4/F5 阶段会被逐步掏空：
 *   每一件物件迁出为 src/cabin/world/ 下的独立模块后，就从这里删除对应区段，
 *   直到文件清空删除。搬迁期间它始终是**画面与行为的唯一真值来源**。
 *
 * 分区地图（原注释分区 → 目标模块）见 docs/MIGRATION.md §3。
 */
import * as THREE from 'three'
import { scene, runtime } from '../app/rng.js'
import { clock } from '../app/clock.js'
import { createSpringSystem } from '../core/util/spring.js'
import { createSketch } from '../core/geometry/sketch.js'
import { createRoundBox } from '../core/geometry/roundBox.js'
import { createSolid } from '../core/geometry/solid.js'
import {
  ringPts,
  polyPts,
  starPts,
  arcPts,
  spiralPts,
  wavyRingPts,
  zigPts,
  createShapes2d,
} from '../core/geometry/shapes2d.js'
import { createLineMaterials } from '../core/materials/lineMaterials.js'
import { createFillMaterial } from '../core/materials/FillMaterial.js'
import { createLitMaterialFactory } from '../core/materials/litMaterial.js'
import { createLayout } from '../world/layout.js'
import { createLightField } from '../core/lighting/LightField.js'
import { createPointLightSource } from '../core/lighting/PointLightSource.js'
import { createInteractionSystem, makeTarget } from '../systems/interaction/InteractionSystem.js'
import { createHintUI } from '../systems/interaction/HintUI.js'
import { createCameraRig } from '../core/render/CameraRig.js'
import { createEnvironment } from '../systems/weather/environment.js'
// J3：物件装配器（`defineProp` → 注册中心的唯一通路）与已搬出的物件。
// 搬迁期每搬一件，就在下面加一行 import，并把原区段换成一次 `installProp(...)`。
import { createPropInstaller } from '../app/installProp.js'
import { installMagicSystem } from './../systems/magic/MagicSystem.js'
import { installPlayerController } from './../systems/player/PlayerController.js'
import { installInput } from './../systems/player/Input.js'
import { installInteractionBridge } from './../systems/interaction/Bridge.js'
import { installCollision } from './../systems/player/collision.js'
import { installWeatherSystem } from './../systems/weather/WeatherSystem.js'
import { installAudio } from './../systems/audio/AudioSystem.js'
import { installMenuPanel } from './../systems/ui/MenuPanel.js'
import { installNoteEditor } from './../systems/ui/editors/NoteEditor.js'
import calendar from '../world/floor2/calendar.js'
import cardDeck from '../world/floor2/cardDeck.js'
import coinTowers from '../world/floor2/coinTowers.js'
import deskHourglass from '../world/floor2/deskHourglass.js'
import desk from '../world/floor2/desk.js'
import picture from '../world/floor2/picture.js'
import rubik from '../world/floor2/rubik.js'
import snowGlobe from '../world/floor2/snowGlobe.js'
import cauldron from '../world/floor1/cauldron.js'
import diningBook from '../world/floor1/diningBook.js'
import longTable from '../world/floor1/longTable.js'
import orrery from '../world/floor1/orrery.js'
import potionBottle from '../world/floor1/potionBottle.js'
import tableware from '../world/floor1/tableware.js'
import bookPile from '../world/floor1/bookPile.js'
import starBell from '../world/floor1/starBell.js'
import tarot from '../world/floor1/tarot.js'
import bag from '../world/floor2/bag.js'
import bin from '../world/floor2/bin.js'
import crate from '../world/floor2/crate.js'
import mirror from '../world/floor2/mirror.js'
import tissueBox from '../world/floor2/tissueBox.js'
import wardrobe from '../world/floor2/wardrobe.js'
import witchHat from '../world/floor2/witchHat.js'
import stools from '../world/floor1/stools.js'
import nightstand from '../world/floor2/nightstand.js'
import chest from '../world/floor1/chest.js'
import diningTable from '../world/floor1/diningTable.js'
import doorHangBar from '../world/floor1/doorHangBar.js'
import hourglass from '../world/floor1/hourglass.js'
import junkBoxes from '../world/floor2/junkBoxes.js'
import rugLarge from '../world/floor2/rugLarge.js'
import rugUnderTable from '../world/floor1/rugUnderTable.js'
import stovePlatform from '../world/floor1/stovePlatform.js'
import broom from '../world/floor1/broom.js'

// F0.2：把原本的裸随机调用替换为注入的种子随机源（见 src/cabin/app/rng.js）
//   *Rng（6 个） = 构建期/初始化随机（永久确定，保证每次加载场景一致）
//   runtimeRng   = 运行期随机（默认真随机，测试模式下可切换为确定）
// 命名一律带 Rng 后缀，避免与场景内的业务标识符撞名（如 IIFE 内的 slime 状态对象）。
const {
    outdoor: outdoorRng,
    floor1: floor1Rng,
    floor2: floor2Rng,
    sky: skyRng,
    texture: textureRng,
    slime: slimeRng,
} = scene
// ⚠️ 下面这行**必须带分号**：
//    若写成 "const runtimeRng = runtime" 而下一行以 ( 开头（顶层 IIFE），
//    JS 的自动分号插入不会生效，会被解析为 runtime(function(){...})() —— 即把 IIFE
//    当成 runtime 的参数调用，抛出 "runtime(...) is not a function"。
const runtimeRng = runtime;

/**
 * 安装小屋（`J2.5`）：由 `boot.js` 造好应用内核之后调用。
 *
 * 这里是"3D 内部"与"应用内核"之间**唯一**的接缝 —— 内核交出 `registry` / `bus` /
 * `scheduler`，小屋把自己的登记动作接上去。搬迁期（`J2`–`J4`）本函数体仍是原来的
 * 自执行函数，只是**不再自动执行**：时机改由 boot 控制（DOM 就绪、测试开关设好之后），
 * 这样内核才能先于场景存在。
 *
 * @param {object} app `createApp()` 的产物
 */
export function installCabin(app) {
    const { registry, bus, scheduler, store } = app;
    /* __J4_CTX__ ★ J4 段间通信的唯一载体（段表见 scripts/oneoff/_j4-segments.mjs）。
       段内顶层 let 都住在这里；段内顶层 const/function 在段末挂到这里。
       段序 = 执行序（rng 调用顺序 / scene.add 顺序 / 光源槽序都由它决定）。 */
    const ctx = Object.create(null);
    (function (ctx) {
            /* ==================== [J4:seg prelude] ==================== */
            'use strict';
            const mqCoarse = window.matchMedia ? window.matchMedia('(pointer: coarse)').matches : false;
            ctx.mqCoarse = mqCoarse;
            const mqFine = window.matchMedia ? window.matchMedia('(pointer: fine)').matches : true;
            ctx.mqFine = mqFine;
            const IS_TOUCH = mqCoarse || (('ontouchstart' in window) && navigator.maxTouchPoints > 0 && !mqFine);
            ctx.IS_TOUCH = IS_TOUCH;
            if (IS_TOUCH) document.body.classList.add('touch');

            /* ============ 音效系统：文件放 sounds/ 目录，缺失时静默跳过 ============ */
            /* ==================== [J4:seg audio] ==================== */
            // J4（audio）：本段已搬入 systems/audio/AudioSystem.js
            installAudio(ctx, app);
            /* ==================== [J4:seg core3d] ==================== */
            const scene = new THREE.Scene();
            ctx.scene = scene;
            scene.background = new THREE.Color(0xfdfbf6);
            scene.fog = new THREE.Fog(0xfdfbf6, 60, 160);

            const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 300);
            ctx.camera = camera;
            const renderer = new THREE.WebGLRenderer({ antialias: true });
            ctx.renderer = renderer;
            renderer.setPixelRatio(Math.min(devicePixelRatio, ctx.IS_TOUCH ? 1.5 : 2));
            renderer.setSize(innerWidth, innerHeight);
            document.body.appendChild(renderer.domElement);

            // J2.2：三种线材质已提取到 cabin/core/materials/lineMaterials.js（实现零改动）
            const { MAT, DASHMAT, IN_MAT } = createLineMaterials();
            ctx.MAT = MAT; ctx.DASHMAT = DASHMAT; ctx.IN_MAT = IN_MAT;

            // J2.2：全局 FILL 材质与彩色材质工厂已提取到 cabin/core/materials/。
            // shader 与 uniforms 由 scripts/oneoff/_j22-extract.mjs **逐字节提取**（非手抄）。
            // 全屋的彩色材质都与这里的 FILL **共享 uniform 引用**，只换 uTint。
            const FILL = createFillMaterial();
            ctx.FILL = FILL;
            const LITMAT = createLitMaterialFactory(FILL);
            ctx.LITMAT = LITMAT;

            const WIN_GLASS = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.5 });
            ctx.WIN_GLASS = WIN_GLASS;
            const WIN_GLASS_UP = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.5 });
            ctx.WIN_GLASS_UP = WIN_GLASS_UP;

            // J2.1：线稿几何 DSL 已提取到 cabin/core/geometry/sketch.js（实现零改动）。
            // 场景与四种共享材质**显式注入** —— core/ 不持有全局场景（不变量 N1 / N7）。
            // 解构保留原标识符名，文件内 2000+ 处调用点（box / log / put / edge…）一行都不用改。
            const { V, geo, line, iline, dline, edge, box, log, put, logBetween } = createSketch({
                scene,
                materials: { line: MAT, inner: IN_MAT, dash: DASHMAT, fill: FILL },
            });
            ctx.V = V; ctx.geo = geo; ctx.line = line; ctx.iline = iline; ctx.dline = dline; ctx.edge = edge;
            ctx.box = box; ctx.log = log; ctx.put = put; ctx.logBetween = logBetween;

            put(new THREE.Mesh(new THREE.PlaneGeometry(130, 130), FILL), 0, -0.01, 0, -Math.PI / 2, 0, 0);
            for (let z = -9; z <= 9; z += 1.5) put(line([[-10, 0.01, z], [10, 0.01, z]]), 0, 0, 0);

            // J2.9：建筑外壳尺寸与陈设锚点已集中到 cabin/world/layout.js（不变量 N9）。
            // 数值一个没改 —— 交互判定与几何构建从此共用同一份坐标（J2.6 的 anchor 直接用它们）。
            // J3：整表保留为 `L`，供搬出的物件按需解构（旧调用点仍在文件内直接解构，一行未改）。
            const L = createLayout();
            ctx.L = L;
            const {
                HOLE_R, FLOOR_TOP, DOOR_HOLE, WIN_F_L, WIN_F_R, WIN_LEFT, WIN_GABLE, LOG_R, LOG_GAP, WALL_TOP, WALL_Y0,
                CHX, CHZ, HEARTH, FX, FZ, MTX, MTZ, MTTOP, CCX, CCZ, MC_X, MC_Z, KOT_X, KOT_Z, KTOP,
                CBX, CBZ, PLX, PLZ, DT_X, DT_Z, DTOP,
                FY, BEDX, BEDZ, NSX, NSZ, TBLX, TBLZ, TBL_TOP,
            } = L;
            ctx.HOLE_R = HOLE_R; ctx.FLOOR_TOP = FLOOR_TOP; ctx.DOOR_HOLE = DOOR_HOLE; ctx.WIN_F_L = WIN_F_L; ctx.WIN_F_R = WIN_F_R; ctx.WIN_LEFT = WIN_LEFT;
            ctx.WIN_GABLE = WIN_GABLE; ctx.LOG_R = LOG_R; ctx.LOG_GAP = LOG_GAP; ctx.WALL_TOP = WALL_TOP; ctx.WALL_Y0 = WALL_Y0; ctx.CHX = CHX;
            ctx.CHZ = CHZ; ctx.HEARTH = HEARTH; ctx.FX = FX; ctx.FZ = FZ; ctx.MTX = MTX; ctx.MTZ = MTZ;
            ctx.MTTOP = MTTOP; ctx.CCX = CCX; ctx.CCZ = CCZ; ctx.MC_X = MC_X; ctx.MC_Z = MC_Z; ctx.KOT_X = KOT_X;
            ctx.KOT_Z = KOT_Z; ctx.KTOP = KTOP; ctx.CBX = CBX; ctx.CBZ = CBZ; ctx.PLX = PLX; ctx.PLZ = PLZ;
            ctx.DT_X = DT_X; ctx.DT_Z = DT_Z; ctx.DTOP = DTOP; ctx.FY = FY; ctx.BEDX = BEDX; ctx.BEDZ = BEDZ;
            ctx.NSX = NSX; ctx.NSZ = NSZ; ctx.TBLX = TBLX; ctx.TBLZ = TBLZ; ctx.TBL_TOP = TBL_TOP;

            /* ==================== [J4:seg houseShell] ==================== */
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
            /* ==================== [J4:seg outdoor] ==================== */
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
            /* ==================== [J4:seg propsTools] ==================== */
            const { roundBoxGeo, rbox } = createRoundBox({ edge: ctx.edge });
            ctx.roundBoxGeo = roundBoxGeo; ctx.rbox = rbox;

            /* —— 一楼陈设专用：材质与工具 —— */

            const HITMAT = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
            ctx.HITMAT = HITMAT;
            const DARK = ctx.LITMAT(0x2b2b2b);
            ctx.DARK = DARK;
            const PINK = ctx.LITMAT(0xd98a94);
            ctx.PINK = PINK;

            const CATMAT = ctx.LITMAT(0xece6da);
            ctx.CATMAT = CATMAT;
            const CATMAT2 = ctx.LITMAT(0xe2dbcd);
            ctx.CATMAT2 = CATMAT2;
            // J2.1：lloop / solid / solidCyl 已提取到 cabin/core/geometry/solid.js。
            // 默认实体材质（原实现里硬编码的 CATMAT）改为**注入** —— core/ 里只留中性名（不变量 N1）。
            const { lloop, solid, solidCyl } = createSolid({
                V: ctx.V, geo: ctx.geo, scene: ctx.scene, lineMaterial: ctx.MAT, defaultSolidMaterial: CATMAT,
            });
            ctx.lloop = lloop; ctx.solid = solid; ctx.solidCyl = solidCyl;
            const sm01 = t => t * t * (3 - 2 * t);
            ctx.sm01 = sm01;

            /* ========================================================== */
            /* ============ J3：物件装配器（`defineProp` 的唯一入口） ============ */
            /* ========================================================== */
            // 搬出 `world/**` 的物件都在**原位置**调用一次 `installProp(...)`：
            //   · 同步调用 ⇒ 执行顺序不变（几何创建顺序参与渲染）
            //   · 原地调用 ⇒ `rng` 调用顺序不变（种子随机源，顺序一变后面全变）
            //   · 装配只写元数据（registry / mounts / scheduler），不碰对象父子关系
            // 于是"搬迁"对画面的影响恒等于零 —— 这正是 `pnpm test:visual` 的判据。
            //
            // ★ 装配环境是**惰性**的：每个键都是 getter，只在物件真正读取它的那一刻求值。
            //   必须如此 —— 本装配器在文件早段求值，而部分共享工具定义在很后面
            //   （`smooth` 在 18.8 段、`cbox`/`crboxCol` 在 18.10 段、`colEdge` 在 18.12 段）。
            //   写成对象字面量会在这里立刻撞上它们的 TDZ，于是每一件搬到二楼的小物件
            //   都只能"把工具函数复制一份"—— 那正是模块化的反面。
            /* ==================== [J4:seg installer] ==================== */
            const propCtx = {};
            ctx.propCtx = propCtx;
            const propTool = (name, get) => Object.defineProperty(propCtx, name, { get, enumerable: true, configurable: true });
            ctx.propTool = propTool;
            propTool('scene', () => ctx.scene);
            propTool('L', () => ctx.L);
            propTool('rng', () => ({
                outdoor: outdoorRng, floor1: floor1Rng, floor2: floor2Rng,
                sky: skyRng, texture: textureRng, slime: slimeRng, runtime: runtimeRng,
            }));
            // 几何 DSL（J2.1 / J2.2 提取，标识符名与原实现一致）
            propTool('V', () => ctx.V); propTool('geo', () => ctx.geo); propTool('line', () => ctx.line);
            propTool('iline', () => ctx.iline); propTool('dline', () => ctx.dline); propTool('edge', () => ctx.edge);
            propTool('box', () => ctx.box); propTool('log', () => ctx.log); propTool('put', () => ctx.put);
            propTool('logBetween', () => ctx.logBetween); propTool('lloop', () => ctx.lloop);
            propTool('solid', () => ctx.solid); propTool('solidCyl', () => ctx.solidCyl);
            propTool('roundBoxGeo', () => ctx.roundBoxGeo); propTool('rbox', () => ctx.rbox);
            // 共享几何工具（原先只在所属分区内部可见 —— 有了它们，搬物件才不必复制实现）
            propTool('cbox', () => ctx.cbox); propTool('crboxCol', () => ctx.crboxCol);
            propTool('colEdge', () => ctx.colEdge); propTool('crumpleBall', () => ctx.crumpleBall);
            propTool('arcPos', () => ctx.arcPos); propTool('jitterGeo', () => ctx.jitterGeo);
            propTool('hash01', () => ctx.hash01); propTool('smooth', () => ctx.smooth);
            // 弹簧 / 铰链 / 摆动（L283 的 createSpringSystem 产物 —— 抽屉、柜门、小凳靠它们登记）
            propTool('regSlide', () => ctx.regSlide); propTool('registerHinge', () => ctx.registerHinge);
            propTool('regWobble', () => ctx.regWobble);
            // 火焰工具（炉火 / 坩埚 / 蜡烛 / 吊灯共用）
            propTool('makeWavyFlame', () => ctx.makeWavyFlame); propTool('updateWavyFlame', () => ctx.updateWavyFlame);
            // 材质（共享 uniform：物件只能"用"，不能改 shader）
            propTool('MAT', () => ctx.MAT); propTool('DASHMAT', () => ctx.DASHMAT); propTool('IN_MAT', () => ctx.IN_MAT);
            propTool('FILL', () => ctx.FILL); propTool('LITMAT', () => ctx.LITMAT); propTool('HITMAT', () => ctx.HITMAT);
            propTool('DARK', () => ctx.DARK); propTool('PINK', () => ctx.PINK);
            propTool('CATMAT', () => ctx.CATMAT); propTool('CATMAT2', () => ctx.CATMAT2);
            propTool('WIN_GLASS', () => ctx.WIN_GLASS); propTool('WIN_GLASS_UP', () => ctx.WIN_GLASS_UP);
            // 音效（交互的 `sfx` 由物件声明）
            propTool('SND', () => ctx.SND);

            const { install: installProp, stats: propStats } = createPropInstaller({
                registry,
                scheduler,
                mounts: app.mounts,
                ctx: propCtx,
            });
            ctx.installProp = installProp; ctx.propStats = propStats;

            /* ========================================================== */
            /* ============ 一楼生活陈设（魔法餐桌·书架·暖桌·猫等） ============ */
            /* ========================================================== */

            // ---- 12.1 原木餐桌 ----
            // J3（B3）：几何已搬入 src/cabin/world/floor1/diningTable.js，此处只留装配调用。
            /* ==================== [J4:seg floor1] ==================== */
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
            const shelfBooks = [];
            ctx.shelfBooks = shelfBooks;
            const SFX = -3.72, SFZ = -2.85, SFW = 1.3;
            ctx.SFX = SFX; ctx.SFZ = SFZ; ctx.SFW = SFW;
            {
                ctx.put(ctx.box(0.3, 1.86, 0.05), SFX, 1.05, SFZ - SFW / 2);
                ctx.put(ctx.box(0.3, 1.86, 0.05), SFX, 1.05, SFZ + SFW / 2);
                ctx.put(ctx.box(0.02, 1.86, 1.3), SFX - 0.15, 1.05, SFZ);
                for (const sy of [0.18, 0.78, 1.38, 1.95]) ctx.put(ctx.box(0.3, 0.05, 1.3), SFX, sy, SFZ);

                function addBook(z, yBase, h, th) {
                    const g = new THREE.Group();
                    ctx.put(ctx.box(0.18, h, th), 0, h / 2, 0, 0, 0, 0, g);
                    ctx.put(ctx.line([[0.092, h * 0.55, -th * 0.3], [0.092, h * 0.55, th * 0.3]]), 0, 0, 0, 0, 0, 0, g);
                    g.position.set(SFX + 0.02, yBase, z);
                    g.userData = { out: false, cur: 0, vel: 0, bx: SFX + 0.02 };
                    ctx.scene.add(g);
                    shelfBooks.push(g);
                    ctx.regMagic(g, () => { g.userData.out = !g.userData.out; });
                }
                const HS = [0.36, 0.30, 0.40, 0.33, 0.27, 0.38, 0.31, 0.35, 0.29, 0.37, 0.34, 0.28];
                const TS = [0.07, 0.06, 0.075, 0.065, 0.07, 0.062, 0.072];
                let hi = 0, ti = 0;
                for (const s of [{ y: 0.205, z0: -3.42, z1: -2.30 },
                { y: 0.805, z0: -3.42, z1: -2.78 },
                { y: 1.405, z0: -3.42, z1: -2.30 }]) {
                    let z = s.z0;
                    while (z < s.z1 - 0.07) {
                        const h = HS[hi++ % HS.length];
                        const th = TS[ti++ % TS.length];
                        addBook(z + th / 2, s.y, h, th);
                        z += th + 0.012;
                    }
                }
            }

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
            /* ==================== [J4:seg junkBoxes] ==================== */
            ctx.storageOpen = false, ctx.storageP = 0, ctx.storageV = 0;
            const storageChest = new THREE.Group();
            ctx.storageChest = storageChest;
            storageChest.position.set(0, 0, -0.78);
            storageChest.rotation.y = Math.PI;
            ctx.scene.add(storageChest);
            const storageLid = new THREE.Group();
            ctx.storageLid = storageLid;
            const oreMeshes = [];
            ctx.oreMeshes = oreMeshes;
            {
                const woodMat = ctx.LITMAT(0x8a6a4a, { side: THREE.DoubleSide });
                const darkMat = ctx.LITMAT(0x6b4e35, { side: THREE.DoubleSide });
                const W = 0.78, D = 0.52, H = 0.40, T = 0.03;
                ctx.put(ctx.solid(new THREE.BoxGeometry(W, T, D), woodMat), 0, T / 2, 0, 0, 0, 0, storageChest);
                ctx.put(ctx.solid(new THREE.BoxGeometry(W, H, T), woodMat), 0, T + H / 2, D / 2 - T / 2, 0, 0, 0, storageChest);
                ctx.put(ctx.solid(new THREE.BoxGeometry(W, H, T), woodMat), 0, T + H / 2, -D / 2 + T / 2, 0, 0, 0, storageChest);
                ctx.put(ctx.solid(new THREE.BoxGeometry(T, H, D - 2 * T), woodMat), W / 2 - T / 2, T + H / 2, 0, 0, 0, 0, storageChest);
                ctx.put(ctx.solid(new THREE.BoxGeometry(T, H, D - 2 * T), woodMat), -W / 2 + T / 2, T + H / 2, 0, 0, 0, 0, storageChest);
                ctx.put(ctx.solid(new THREE.BoxGeometry(W + 0.04, 0.05, 0.05), darkMat), 0, H + 0.015, D / 2, 0, 0, 0, storageChest);
                ctx.put(ctx.solid(new THREE.BoxGeometry(W + 0.04, 0.05, 0.05), darkMat), 0, H + 0.015, -D / 2, 0, 0, 0, storageChest);
                ctx.put(ctx.line([[-0.09, H - 0.06, D / 2 + 0.012], [0.09, H - 0.06, D / 2 + 0.012]]), 0, 0, 0, 0, 0, 0, storageChest);
                storageLid.position.set(0, H + 0.03, -D / 2);
                ctx.put(ctx.solid(new THREE.BoxGeometry(W + 0.04, 0.06, D + 0.04), darkMat), 0, 0.03, D / 2, 0, 0, 0, storageLid);
                ctx.put(ctx.line([[-W / 2 - 0.02, 0.06, D / 2], [-W / 2 + 0.06, 0.06, D / 2]]), 0, 0, 0, 0, 0, 0, storageLid);
                ctx.put(ctx.line([[W / 2 - 0.06, 0.06, D / 2], [W / 2 + 0.02, 0.06, D / 2]]), 0, 0, 0, 0, 0, 0, storageLid);
                storageChest.add(storageLid);
                const ORES = [
                    [0x9b4fd8, 'oct'], [0x2fbf6f, 'ico'], [0xd84444, 'oct'],
                    [0x3f7fd8, 'dod'], [0xe8b93a, 'oct'], [0x3fc8d8, 'ico'],
                    [0xe07bb8, 'dod'], [0xd89a3a, 'oct']
                ];
                const oreEdgeMat = new THREE.LineBasicMaterial({ color: 0xffffff });
                ORES.forEach((o, i) => {
                    const g = o[1] === 'oct' ? new THREE.OctahedronGeometry(0.052)
                        : o[1] === 'ico' ? new THREE.IcosahedronGeometry(0.050, 0)
                            : new THREE.DodecahedronGeometry(0.048);
                    const m = ctx.solid(g, new THREE.MeshBasicMaterial({ color: o[0] }), oreEdgeMat);
                    const col = i % 4, row = Math.floor(i / 4);
                    m.position.set(-0.27 + col * 0.18, 0.10 + row * 0.045, 0.10 - row * 0.21);
                    m.rotation.y = i * 0.7;
                    m.visible = false;
                    storageChest.add(m);
                    oreMeshes.push({ g: m, by: m.position.y });
                });
            }
            ctx.regMagic(storageChest, () => { ctx.storageOpen = !ctx.storageOpen; });

            /* ========================================================== */
            /* ============ 二楼陈设（床·书桌·魔杖·星象仪·挂画等） ============ */
            /* ========================================================== */

            /* ---- 18.1 大床 ---- */
            /* ==================== [J4:seg floor2] ==================== */
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
            const CHAIR_IN = -3.20;
            ctx.CHAIR_IN = CHAIR_IN;
            const CHAIR_OUT = -3.60;
            ctx.CHAIR_OUT = CHAIR_OUT;
            const chairG = new THREE.Group();
            ctx.chairG = chairG;
            chairG.position.set(2.6, ctx.FY, CHAIR_IN);
            ctx.scene.add(chairG);
            for (const szx of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
                ctx.put(ctx.edge(new THREE.CylinderGeometry(0.022, 0.018, 0.44, 6)), szx[0] * 0.18, 0.22, szx[1] * 0.18, 0, 0, 0, chairG);
            }
            ctx.put(ctx.box(0.44, 0.05, 0.44), 0, 0.465, 0, 0, 0, 0, chairG);
            ctx.put(ctx.box(0.44, 0.52, 0.045), 0, 0.72, -0.198, 0, 0, 0, chairG);
            ctx.chairOpen = false, ctx.chairT = 0;
            ctx.regMagic(chairG, () => { ctx.chairOpen = !ctx.chairOpen; });

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
            ctx.mirrorDirtyT = 0;
            // F0.3：装饰循环（时钟 / 镜子涟漪 / 挂画 GIF / 纸箱）
            //   realtime：沿用 performance.now()，行为与改动前完全一致
            //   manual  ：读 clock.now / clock.dt，跟随手动步进（由主循环驱动，见 tickOnce 末尾）
            (function decorLoop() {
                requestAnimationFrame(decorLoop);
                if (clock.mode === 'manual') return;   // 手动模式由 tickOnce 负责调用
                const t = performance.now() * 0.001;
                const dt = Math.min(0.05, Math.max(0.001, t - ctx.decorLastT));
                ctx.decorLastT = t;
                updateNewDecor(t, dt);
            })();
            /* ============ 便签编辑器（二楼计划板） ============ */
            /* ==================== [J4:seg noteEditor] ==================== */
            // J4（noteEditor）：本段已搬入 systems/ui/editors/NoteEditor.js
            installNoteEditor(ctx, app);
            /* ==================== [J4:seg chandelier] ==================== */
            // ↓ J4 段导出（chandelier）：本段函数声明挂到 ctx（借提升，段内任何位置都可见）
            ctx.deformSlime = deformSlime;
            ctx.lampLit = true; ctx.lampP = 1;
            const LAMP_Y = -0.95;
            ctx.LAMP_Y = LAMP_Y;
            const chandelier = new THREE.Group();
            ctx.chandelier = chandelier;
            chandelier.position.set(0, 6.3, 0);
            ctx.scene.add(chandelier);
            ctx.put(ctx.edge(new THREE.ConeGeometry(0.06, 0.16, 6)), 0, 0.15, 0, 0, 0, 0, chandelier);
            for (let i = 0; i < 4; i++) {
                ctx.put(ctx.edge(new THREE.TorusGeometry(0.045, 0.013, 6, 12)), 0, -0.03 - i * 0.09, 0, 0, (i % 2) * Math.PI / 2, 0, chandelier);
            }
            ctx.put(ctx.edge(new THREE.CylinderGeometry(0.02, 0.026, 0.62, 8)), 0, -0.63, 0, 0, 0, 0, chandelier);
            for (let i = 0; i < 3; i++) {
                const ang = i * Math.PI * 2 / 3 + 0.5;
                ctx.logBetween([0, -0.6, 0], [Math.cos(ang) * 0.55, LAMP_Y, Math.sin(ang) * 0.55], 0.015, chandelier);
            }
            ctx.put(ctx.edge(new THREE.TorusGeometry(0.55, 0.035, 8, 26)), 0, LAMP_Y, 0, Math.PI / 2, 0, 0, chandelier);
            for (let i = 0; i < 6; i++) {
                const ang = i * Math.PI / 3 + 0.26;
                const cx = Math.cos(ang) * 0.55, cz = Math.sin(ang) * 0.55;
                ctx.put(ctx.edge(new THREE.CylinderGeometry(0.014, 0.02, 0.16, 6)), cx, LAMP_Y + 0.08, cz, 0, 0, 0, chandelier);
                ctx.put(ctx.edge(new THREE.CylinderGeometry(0.052, 0.036, 0.03, 8)), cx, LAMP_Y + 0.175, cz, 0, 0, 0, chandelier);
                ctx.put(ctx.edge(new THREE.CylinderGeometry(0.028, 0.028, 0.17, 8)), cx, LAMP_Y + 0.27, cz, 0, 0, 0, chandelier);
                ctx.put(ctx.edge(new THREE.CylinderGeometry(0.006, 0.006, 0.03, 6)), cx, LAMP_Y + 0.365, cz, 0, 0, 0, chandelier);
            }
            const lampCrystalMat = new THREE.MeshBasicMaterial({ color: 0x73737e, transparent: true, opacity: 0.95 });
            ctx.lampCrystalMat = lampCrystalMat;
            const lampCrystal = new THREE.Group();
            ctx.lampCrystal = lampCrystal;
            { const cryG = new THREE.OctahedronGeometry(0.13); lampCrystal.add(new THREE.Mesh(cryG, lampCrystalMat)); lampCrystal.add(new THREE.LineSegments(new THREE.EdgesGeometry(cryG), ctx.MAT)); }
            ctx.put(lampCrystal, 0, LAMP_Y + 0.06, 0, 0, 0, 0, chandelier);
            const pendant = new THREE.Group();
            ctx.pendant = pendant;
            { const pG = new THREE.OctahedronGeometry(0.09); pendant.add(new THREE.Mesh(pG, lampCrystalMat)); pendant.add(new THREE.LineSegments(new THREE.EdgesGeometry(pG), ctx.MAT)); }
            ctx.put(ctx.edge(new THREE.CylinderGeometry(0.008, 0.008, 0.5, 6)), 0, LAMP_Y - 0.25, 0, 0, 0, 0, chandelier);
            ctx.put(pendant, 0, LAMP_Y - 0.58, 0, 0, 0, 0, chandelier);
            const lampGlowMatA = new THREE.MeshBasicMaterial({ color: 0xffd9a8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
            ctx.lampGlowMatA = lampGlowMatA;
            const lampGlowMatB = new THREE.MeshBasicMaterial({ color: 0xe0b4ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
            ctx.lampGlowMatB = lampGlowMatB;
            const glowA = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), lampGlowMatA);
            ctx.glowA = glowA;
            const glowB = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), lampGlowMatB);
            ctx.glowB = glowB;
            glowA.renderOrder = 7; glowB.renderOrder = 7;
            ctx.put(glowA, 0, LAMP_Y + 0.06, 0, 0, 0, 0, chandelier);
            ctx.put(glowB, 0, LAMP_Y + 0.06, 0, 0, 0, 0, chandelier);
            const chandelierFlames = [];
            ctx.chandelierFlames = chandelierFlames;
            for (let i = 0; i < 6; i++) {
                const ang = i * Math.PI / 3 + 0.26;
                const cx = Math.cos(ang) * 0.55, cz = Math.sin(ang) * 0.55;
                ctx.makeWavyFlame(cx, cz, LAMP_Y + 0.375, 0.14, 0.042, ctx.fireMid, i * 1.1, 3.3, chandelierFlames);
                ctx.makeWavyFlame(cx, cz, LAMP_Y + 0.395, 0.075, 0.02, ctx.fireIn, i * 1.1 + 2.0, 3.8, chandelierFlames);
            }
            for (const f of chandelierFlames) chandelier.add(f.obj);
            chandelier.userData.aimLabel = '点亮 / 熄灭魔法吊灯';
            ctx.regMagic(chandelier, () => { ctx.lampLit = !ctx.lampLit; });
            chandelier.userData.sfx = 'lamp';

            const MEMB_MAT = new THREE.MeshBasicMaterial({ color: 0x4fd695, transparent: true, opacity: 0.40, side: THREE.DoubleSide, depthWrite: false });
            ctx.MEMB_MAT = MEMB_MAT;
            const MID_MAT = new THREE.MeshBasicMaterial({ color: 0x8ce8b6, transparent: true, opacity: 0.34, side: THREE.DoubleSide, depthWrite: false });
            ctx.MID_MAT = MID_MAT;
            const CORE_MAT = new THREE.MeshBasicMaterial({ color: 0x2fbb7c, transparent: true, opacity: 0.50, side: THREE.DoubleSide, depthWrite: false });
            ctx.CORE_MAT = CORE_MAT;
            const BUBBLE_MAT = new THREE.MeshBasicMaterial({ color: 0xeafff2, transparent: true, opacity: 0.35, depthWrite: false });
            ctx.BUBBLE_MAT = BUBBLE_MAT;
            const slimeRoot = new THREE.Group();
            ctx.slimeRoot = slimeRoot; ctx.scene.add(slimeRoot); const slimeBody = new THREE.Group();
            ctx.slimeBody = slimeBody; slimeRoot.add(slimeBody);
            const SLIME_R = 0.30;
            ctx.SLIME_R = SLIME_R; const slimeGeo = new THREE.SphereGeometry(SLIME_R, 26, 18);
            ctx.slimeGeo = slimeGeo; const slimeOrig = slimeGeo.attributes.position.array.slice();
            ctx.slimeOrig = slimeOrig;
            const membrane = new THREE.Mesh(slimeGeo, MEMB_MAT);
            ctx.membrane = membrane; membrane.renderOrder = 3; slimeBody.add(membrane);
            const midLayer = new THREE.Mesh(slimeGeo, MID_MAT);
            ctx.midLayer = midLayer; midLayer.scale.setScalar(0.86); midLayer.renderOrder = 2; slimeBody.add(midLayer);
            const core = new THREE.Mesh(new THREE.SphereGeometry(0.145, 18, 14), CORE_MAT);
            ctx.core = core; core.renderOrder = 1; slimeBody.add(core);
            const bubbles = [];
            ctx.bubbles = bubbles;
            for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.016 + slimeRng() * 0.012, 8, 6), BUBBLE_MAT); b.renderOrder = 1; b.userData = { ph: slimeRng(), ang: slimeRng() * 6.28, rr: 0.03 + slimeRng() * 0.07 }; slimeBody.add(b); bubbles.push(b); }
            const slimeShadow = new THREE.Mesh(new THREE.CircleGeometry(0.24, 20), new THREE.MeshBasicMaterial({ color: 0x1e5a40, transparent: true, opacity: 0.16, depthWrite: false }));
            ctx.slimeShadow = slimeShadow; slimeShadow.rotation.x = -Math.PI / 2; slimeShadow.position.y = 0.012; slimeRoot.add(slimeShadow);
            const SLIME_FLAT = 0.78;
            ctx.SLIME_FLAT = SLIME_FLAT; const slime = { squash: SLIME_FLAT, squashV: 0, wob: 0, wobV: 0, tilt: 0, tiltV: 0, pulse: 2.0 };
            ctx.slime = slime;
            function deformSlime(time, amp, speed) { const arr = slimeGeo.attributes.position.array; const n = slimeGeo.attributes.position.count; for (let i = 0; i < n; i++) { const x0 = slimeOrig[i * 3], y0 = slimeOrig[i * 3 + 1], z0 = slimeOrig[i * 3 + 2]; const h = y0 / SLIME_R; const spread = 1 + 0.20 * Math.max(0, -h); const ph = h * 3.4 - time * speed; const w = Math.sin(ph) * amp; const w2 = Math.sin(ph + 1.7) * amp * 0.4; arr[i * 3] = x0 * spread - w2; arr[i * 3 + 1] = y0 + Math.sin(ph * 0.8 + 0.6) * amp * 0.25; arr[i * 3 + 2] = z0 * spread + w; } slimeGeo.attributes.position.needsUpdate = true; }

            /* ================================================================ */
            /* ============ 超位魔法系统：魔杖 + 超级爆裂魔法 ============ */
            /* ================================================================ */
            /* ==================== [J4:seg magic] ==================== */
            // J4（magic）：本段已搬入 systems/magic/MagicSystem.js
            installMagicSystem(ctx, app);
            /* ==================== [J4:seg collision] ==================== */
            // J4（collision）：本段已搬入 systems/player/collision.js
            installCollision(ctx, app);
            /* ==================== [J4:seg sfxBridge] ==================== */
            // J4（sfxBridge）：本段已搬入 systems/interaction/Bridge.js
            installInteractionBridge(ctx, app);
            /* ==================== [J4:seg input] ==================== */
            // J4（input）：本段已搬入 systems/player/Input.js
            installInput(ctx, app);
            /* ==================== [J4:seg menuUi] ==================== */
            // J4（menuUi）：本段已搬入 systems/ui/MenuPanel.js
            installMenuPanel(ctx, app);
            /* ==================== [J4:seg playerCtrl] ==================== */
            // J4（playerCtrl）：本段已搬入 systems/player/PlayerController.js
            installPlayerController(ctx, app);
            /* ==================== [J4:seg weather] ==================== */
            // J4（weather）：本段已搬入 systems/weather/WeatherSystem.js
            installWeatherSystem(ctx, app);
            /* ==================== [J4:seg tick] ==================== */
            // ↓ J4 段导出（tick）：本段函数声明挂到 ctx（借提升，段内任何位置都可见）
            ctx.tickOnce = tickOnce;
            function tickOnce() {
                const time = clock.now; const dt = clock.dt;
                ctx.updateSprings(); ctx.updatePlayer(dt, time); ctx.updateWeatherSystem(dt, time); ctx.updateInteractHint();
                // J2.10：把这一帧累积的环境变化合并成**至多一次**广播 env:change（节流在 environment 内部：
                // 天气换了或采光变化 > 1% 才 emit —— 太阳每帧都在走，逐帧广播毫无意义）。
                ctx.environment.setGameHour(ctx.curHour()); ctx.environment.flush();
                ctx.updateWand(dt, time);
                ctx.updateBlast(dt, time);

                ctx.FILL.uniforms.uTime.value = time;
                ctx.FILL.uniforms.uFireStrength.value = ctx.fireP;

                if (ctx.ffOpacity > 0.01) {
                    for (let i = 0; i < ctx.FF_N; i++) {
                        const f = ctx.fireflies[i];
                        ctx.ffPos[i * 3] = f.bx + Math.sin(time * f.sp + f.ph) * f.amp;
                        ctx.ffPos[i * 3 + 1] = f.by + Math.sin(time * f.sp * 0.8 + f.ph * 1.3) * 0.32;
                        ctx.ffPos[i * 3 + 2] = f.bz + Math.cos(time * f.sp * 0.9 + f.ph * 0.7) * f.amp;
                    }
                    ctx.ffGeo.attributes.position.needsUpdate = true;
                }
                ctx.ffUniforms.uTime.value = time;

                /* ============ 室内陈设动画（一二楼家具·猫·坩埚·塔罗牌·茶壶等） ============ */
                // J3（B2）：三脚圆凳的每帧分支已搬入 world/floor1/stools.js（原地 tick）
                ctx.stoolsApi.tick(dt, time);

                for (const c of ctx.chairs) {
                    const u = c.userData;
                    const target = u.open ? 0.45 : 0;
                    u.vel += (target - u.cur) * 0.02;
                    u.vel *= 0.88;
                    u.cur += u.vel;
                    c.position.x = u.bx + u.ax * u.cur;
                    c.position.z = u.bz + u.az * u.cur;
                }

                {
                    // J3（B4）：星象仪的每帧分支已搬入 world/floor1/orrery.js（原地 tick）
                    ctx.orreryApi.tick(dt, time);
                }

                {
                    // J3（B4）：魔法药剂瓶的每帧分支已搬入 world/floor1/potionBottle.js（原地 tick）
                    ctx.potionBottleApi.tick(dt, time);
                }

                {
                    // J3（B4）：魔法书的每帧分支已搬入 world/floor1/diningBook.js（原地 tick）
                    ctx.diningBookApi.tick(dt, time);
                }

                {
                    // J3（B3）：左窗下魔法书堆的每帧分支已搬入 world/floor1/bookPile.js（原地 tick）
                    ctx.bookPileApi.tick(dt, time);
                }

                ctx.lanternPivot.rotation.x = Math.sin(time * 1.2) * 0.045;
                ctx.lanternPivot.rotation.z = Math.sin(time * 0.9 + 1) * 0.05;
                ctx.lanternFlame.visible = ctx.lanternLit;
                ctx.halo.visible = ctx.beam.visible = ctx.floorPool.visible = ctx.floorPool2.visible = ctx.tablePool.visible = ctx.lanternLit;
                if (ctx.lanternLit) {
                    const fk = 1 + Math.sin(time * 9) * 0.10 + Math.sin(time * 13.7) * 0.04;
                    ctx.lanternFlame.scale.set(1, fk, 1);
                    ctx.haloMat.opacity = 0.11 + 0.04 * fk;
                    ctx.beamMat.opacity = 0.07 + 0.025 * fk;
                    ctx.glowMatA.opacity = 0.07 + 0.025 * fk;
                    ctx.glowMatB.opacity = 0.06 + 0.02 * fk;
                }

                /* ---- 实体猫 ---- */

                {
                    ctx.catP += ((ctx.catAwake ? 1 : 0) - ctx.catP) * 0.03;
                    const br = 1 + Math.sin(time * 2.2) * 0.025 * (1 - 0.6 * ctx.catP);
                    ctx.catBody.scale.set(1, br, 1);
                    ctx.catHead.position.y = 0.265 + 0.05 * ctx.catP;
                    ctx.catHead.position.x = 0.215 - 0.03 * ctx.catP;
                    const blink = ctx.catP > 0.5 && (time % 3.6) < 0.14;
                    ctx.eyesOpen.visible = ctx.catP > 0.5 && !blink;
                    ctx.eyesClosed.visible = !ctx.eyesOpen.visible;
                    const twitch = Math.max(0, Math.sin(time * 0.37) - 0.985) * 30;
                    ctx.earLG.rotation.z = -0.05 + twitch * 0.25;
                    ctx.earRG.rotation.z = 0.05 + twitch * 0.25;
                    for (let i = 0; i < ctx.tailSegs.length; i++)
                        ctx.tailSegs[i].rotation.y = Math.sin(time * 1.1 + i * 0.7) * (0.03 + 0.06 * ctx.catP);
                }

                /* ---- 毛线球 ---- */
                {
                    const u = ctx.yarnG.userData;
                    u.vy -= 9.8 * dt;
                    u.y += u.vy * dt;
                    if (u.y <= 0) {
                        u.y = 0;
                        if (Math.abs(u.vy) > 0.45) { u.vy = -u.vy * 0.45; u.spinV *= 0.72; }
                        else { u.vy = 0; u.spinV *= (1 - 2.5 * dt); }
                    }
                    ctx.yarnBall.position.y = u.y;
                    ctx.yarnBall.rotation.y += u.spinV * dt;
                    u.spinV *= (1 - 0.4 * dt);
                }

                /* ---- 水晶球 ---- */
                {
                    if (ctx.cbRun > 0) ctx.cbRun -= dt;
                    const act = ctx.cbRun > 0;
                    for (let i = 0; i < ctx.cbMists.length; i++)
                        ctx.cbMists[i].l.rotation.y += dt * (act ? 2.0 + i * 0.5 : 0.35 + i * 0.1);
                    for (let i = 0; i < ctx.cbStars.length; i++) {
                        ctx.cbStars[i].rotation.y += dt * (act ? 3.0 : 0.8);
                        ctx.cbStars[i].position.y = (i % 2 ? 0.07 : -0.05) + Math.sin(time * 1.4 + i * 1.7) * 0.02;
                    }
                    ctx.cbMistMat.opacity = act ? 0.85 : 0.5;
                    ctx.cbGlowMat.opacity = act ? 0.10 + 0.06 * Math.sin(time * 6) : 0;
                }

                /* ---- 月光魔法盆栽 ---- */
                {
                    if (ctx.plantRun > 0) ctx.plantRun -= dt;
                    const act = ctx.plantRun > 0;
                    for (const s of ctx.plantStems) {
                        s.stem.rotation.z = Math.sin(time * 1.2 + s.ph) * 0.05 + (act ? Math.sin(time * 5 + s.ph) * 0.06 : 0);
                        s.stem.rotation.x = Math.cos(time * 0.9 + s.ph) * 0.04;
                    }
                    for (const b of ctx.plantBerries) {
                        b.obj.scale.setScalar(act ? 1 + 0.25 * Math.sin(time * 7 + b.ph) : 1);
                        b.m.opacity = act ? 1 : 0.85;
                    }
                }

                /* ---- 滑轮置物台：滑动 + 轮子滚动（朝被炉 -z 方向）---- */
                {
                    ctx.cartP += ((ctx.cartOut ? 1 : 0) - ctx.cartP) * 0.07;
                    ctx.cartG.position.set(ctx.CART_P0.x + ctx.CART_DIR.x * ctx.CART_DIST * ctx.cartP, 0,
                        ctx.CART_P0.z + ctx.CART_DIR.z * ctx.CART_DIST * ctx.cartP);
                    ctx.cartG.updateMatrixWorld(true);
                    const dC = ctx.cartP - ctx.cartPrevP;
                    if (Math.abs(dC) > 1e-5)
                        for (const w of ctx.cartWheels) w.children[0].rotation.y -= dC * 16;
                    ctx.cartPrevP = ctx.cartP;
                }

                /* ---- 羽毛笔：飞出书写魔法符号后归位 ---- */
                {
                    if (ctx.quillRun > 0) {
                        ctx.quillRun -= dt;
                        const p = 1 - Math.max(ctx.quillRun, 0) / ctx.QUILL_T;
                        ctx._cw.set(ctx.QUILL_REST.pos[0], ctx.QUILL_REST.pos[1], ctx.QUILL_REST.pos[2]);
                        ctx.cartG.localToWorld(ctx._cw);
                        const restX = ctx._cw.x, restY = ctx._cw.y, restZ = ctx._cw.z;
                        const sX = ctx.QW_A.x, sY = ctx.QW_A.y + 0.08, sZ = ctx.QW_A.z;
                        const eX = ctx.QW_B.x, eY = ctx.QW_B.y + 0.08, eZ = ctx.QW_B.z;
                        let px, py, pz, rx = ctx.QUILL_REST.rotX, rz = ctx.QUILL_REST.rotZ;
                        if (p < 0.10) {
                            const u = ctx.sm01(p / 0.10);
                            px = restX + (sX - restX) * u;
                            py = restY + (sY - restY) * u + Math.sin(u * Math.PI) * 0.30;
                            pz = restZ + (sZ - restZ) * u;
                            rx = -0.25; rz = 0.10;
                        } else if (p < 0.70) {
                            const u = (p - 0.10) / 0.60;
                            px = sX + (eX - sX) * u;
                            py = sY + (eY - sY) * u + Math.sin(u * Math.PI * 6) * 0.02;
                            pz = sZ + (eZ - sZ) * u;
                            rx = -0.85 + Math.sin(u * Math.PI * 10) * 0.10;
                            rz = 0.22;
                            for (let i = 0; i < 8; i++) {
                                if (!ctx.magicGlyphs[i].active && u > (i + 0.25) / 8) {
                                    ctx.magicGlyphs[i].active = true;
                                    ctx.magicGlyphs[i].age = 0;
                                    ctx.magicGlyphs[i].sp.visible = true;
                                }
                            }
                        } else if (p < 0.80) {
                            const u = (p - 0.70) / 0.10;
                            px = eX; py = eY + Math.sin(u * Math.PI) * 0.05; pz = eZ;
                            rx = -0.5; rz = 0.15;
                        } else {
                            const u = ctx.sm01((p - 0.80) / 0.20);
                            px = eX + (restX - eX) * u;
                            py = eY + (restY - eY) * u + Math.sin(u * Math.PI) * 0.30;
                            pz = eZ + (restZ - eZ) * u;
                            rx = -0.25 * (1 - u) + ctx.QUILL_REST.rotX * u;
                            rz = 0.10 * (1 - u) + ctx.QUILL_REST.rotZ * u;
                        }
                        ctx._cw.set(px, py, pz);
                        ctx.cartG.worldToLocal(ctx._cw);
                        ctx.quillG.position.copy(ctx._cw);
                        ctx.quillG.rotation.set(rx, 0, rz);
                        if (ctx.quillRun <= 0) {
                            ctx.quillG.position.set(ctx.QUILL_REST.pos[0], ctx.QUILL_REST.pos[1], ctx.QUILL_REST.pos[2]);
                            ctx.quillG.rotation.set(ctx.QUILL_REST.rotX, 0, ctx.QUILL_REST.rotZ);
                        }
                    }
                }

                /* ---- 魔法符号：上升渐隐 ---- */
                {
                    for (const g of ctx.magicGlyphs) {
                        if (g.active) {
                            g.age += dt;
                            const k = g.age / g.life;
                            if (k >= 1) { g.active = false; g.sp.visible = false; continue; }
                            const pop = Math.min(g.age * 7, 1);
                            g.mat.opacity = 0.95 * pop * (1 - Math.max(0, (k - 0.55) / 0.45));
                            g.sp.position.set(g.base.x + Math.sin(g.age * 2.2) * 0.02,
                                g.base.y + k * 0.20,
                                g.base.z);
                            const s = 0.16 * pop * (1 + 0.10 * Math.sin(g.age * 7));
                            g.sp.scale.set(s, s, 1);
                        }
                    }
                }

                /* ---- 纸堆：腾空扇动绕一楼一圈后飞回 ---- */
                {
                    if (ctx.paperRun > 0) {
                        ctx.paperRun -= dt;
                        const elapsed = ctx.PAPER_T - ctx.paperRun;
                        for (let i = 0; i < ctx.papers.length; i++) {
                            const pp = ctx.papers[i];
                            const delay = i * 0.12;
                            const D = ctx.PAPER_T - delay;
                            let ti = (elapsed - delay) / D;
                            if (ti < 0) ti = 0;
                            if (ti > 1) ti = 1;
                            ctx._cw.copy(pp.home);
                            ctx.cartG.localToWorld(ctx._cw);
                            const hx = ctx._cw.x, hy = ctx._cw.y, hz = ctx._cw.z;
                            const a0 = pp.a0, r = pp.r;
                            const cirY = (a) => 1.45 + Math.sin(a * 3 + i) * 0.22;
                            let pos;
                            if (ti < 0.18) {
                                const u = ctx.sm01(ti / 0.18);
                                const cx = Math.cos(a0) * r, cy = cirY(a0), cz = Math.sin(a0) * r;
                                pos = {
                                    x: hx + (cx - hx) * u,
                                    y: hy + (cy - hy) * u + Math.sin(u * Math.PI) * 0.40,
                                    z: hz + (cz - hz) * u
                                };
                            } else if (ti < 0.78) {
                                const s = (ti - 0.18) / 0.60;
                                const a = a0 + s * Math.PI * 2;
                                pos = { x: Math.cos(a) * r, y: cirY(a), z: Math.sin(a) * r };
                            } else {
                                const u = ctx.sm01((ti - 0.78) / 0.22);
                                const cx = Math.cos(a0 + Math.PI * 2) * r, cy = cirY(a0 + Math.PI * 2), cz = Math.sin(a0 + Math.PI * 2) * r;
                                pos = {
                                    x: cx + (hx - cx) * u,
                                    y: cy + (hy - cy) * u + Math.sin(u * Math.PI) * 0.35,
                                    z: cz + (hz - cz) * u
                                };
                            }
                            ctx._cw.set(pos.x, pos.y, pos.z);
                            ctx.cartG.worldToLocal(ctx._cw);
                            pp.g.position.copy(ctx._cw);
                            if (ti > 0.02 && ti < 0.98) {
                                pp.g.rotation.set(Math.sin(time * 7 + i * 1.3) * 0.9,
                                    time * 2.5 + i,
                                    Math.cos(time * 5 + i * 0.9) * 0.7);
                            } else {
                                pp.g.rotation.set(0, pp.ry0, 0);
                            }
                        }
                        if (ctx.paperRun <= 0) {
                            for (const pp of ctx.papers) {
                                pp.g.position.copy(pp.home);
                                pp.g.rotation.set(0, pp.ry0, 0);
                            }
                        }
                    }
                }

                /* ---- 暖桌：暖光呼吸 + 收音机音符 ---- */
                {
                    if (ctx.kotGlowMat) {
                        ctx.kotGlowMat.opacity = ctx.kotatsuOn ? 0.07 + 0.05 * (0.5 + 0.5 * Math.sin(time * 4.2)) : 0;
                    }
                    if (ctx.radioNoteRun > 0) {
                        ctx.radioNoteRun -= dt;
                        for (const nt of ctx.radioNotes) {
                            const p = (time * 0.55 + nt.ph) % 1;
                            if (p < 0.85) {
                                nt.g.visible = true;
                                const env = Math.min(p * 7, 1) * (1 - Math.max(0, (p - 0.7) / 0.15));
                                ctx.noteMat.opacity = 0.9 * env;
                                const src = ctx.radioG.userData.noteSrc;
                                src.getWorldPosition(ctx._tv);
                                nt.g.position.set(
                                    ctx._tv.x + Math.sin(time * 2 + nt.ph * 6) * 0.030 + p * 0.06,
                                    ctx._tv.y + p * 0.28,
                                    ctx._tv.z + Math.cos(time * 1.6 + nt.ph * 5) * 0.025
                                );
                                nt.g.rotation.y = Math.sin(time * 3 + nt.ph * 4) * 0.6;
                                nt.g.rotation.z = Math.sin(time * 2.5 + nt.ph * 3) * 0.25;
                            } else {
                                nt.g.visible = false;
                            }
                        }
                    } else {
                        for (const nt of ctx.radioNotes) nt.g.visible = false;
                    }
                }

                /* ---- 橘子：盆内 ⇄ 滚上桌面 ---- */
                {
                    const n = ctx.oranges.length;
                    if (ctx.orangeState === 'out' || ctx.orangeState === 'back') {
                        ctx.orangeT += dt;
                        let done = true;
                        for (let i = 0; i < n; i++) {
                            const o = ctx.oranges[i];
                            const delay = i * 0.085;
                            let p = Math.min(Math.max((ctx.orangeT - delay) / 0.65, 0), 1);
                            if (p < 1) done = false;
                            const e = p * p * (3 - 2 * p);
                            const f = ctx.orangeState === 'out' ? e : 1 - e;
                            o.mesh.position.set(
                                o.hx + (o.tx - o.hx) * f,
                                o.hy + (o.ty - o.hy) * f + Math.sin(f * Math.PI) * 0.09,
                                o.hz + (o.tz - o.hz) * f
                            );
                            o.mesh.rotation.set(o.ax * f, 0, o.az * f);
                        }
                        if (done) ctx.orangeState = ctx.orangeState === 'out' ? 'rolled' : 'inbowl';
                    }
                }

                /* ---- 坐垫：水平翻滚 180° ---- */
                {
                    for (const c of ctx.cushions) {
                        if (c.anim) {
                            c.p += dt * 2.2;
                            if (c.p >= 1) { c.p = 1; c.anim = 0; }
                            const e = c.p * c.p * (3 - 2 * c.p);
                            const ang = c.from + (c.to - c.from) * e;
                            c.g.rotation.x = ang;
                            c.g.position.y = Math.sin(c.p * Math.PI) * 0.24 + (ang / Math.PI) * 0.125;
                        }
                    }
                }

                {
                    // J3（B3）：塔罗牌阵的每帧分支已搬入 world/floor1/tarot.js（原地 tick）
                    ctx.tarotApi.tick(dt, time);
                }

                for (const f of ctx.candleWavy) {
                    f.obj.visible = true;
                    ctx.updateWavyFlame(f, time, 0.9 + 0.1 * Math.sin(time * 11));
                }

                for (const b of ctx.shelfBooks) {
                    const u = b.userData;
                    const target = u.out ? 1 : 0;
                    u.vel += (target - u.cur) * 0.03;
                    u.vel *= 0.85;
                    u.cur += u.vel;
                    b.position.x = u.bx + 0.11 * u.cur;
                }

                /* ---- 试剂瓶 ---- */
                for (const rg of ctx.reagents) {
                    const u = rg.userData;
                    if (u.run > 0) u.run -= dt;
                    if (u.run > 0) {
                        const k = u.run / 1.3;
                        rg.rotation.z = Math.sin((1.3 - u.run) * 24) * 0.20 * k;
                        rg.position.y = u.by + Math.abs(Math.sin((1.3 - u.run) * 24)) * 0.006 * k;
                    } else {
                        rg.rotation.z = 0;
                        rg.position.y = u.by;
                    }
                }

                /* ---- 紫色魔法阵 ---- */
                {
                    if (ctx.mcRun > 0) ctx.mcRun -= dt;
                    const prog = ctx.mcRun > 0 ? 1 - ctx.mcRun / 8.0 : 1;
                    let inten = 0;
                    if (ctx.mcRun > 0) {
                        if (prog < 0.12) inten = prog / 0.12;
                        else if (prog < 0.82) inten = 1;
                        else inten = 1 - (prog - 0.82) / 0.18;
                    }
                    ctx.mcMat.opacity = 0.5 + 0.5 * inten;
                    ctx.mcBase.rotation.y += dt * (0.15 + 2.8 * inten);
                    for (const f of ctx.mcFloats) {
                        const ap = Math.min(Math.max((prog - (0.10 + f.ph * 0.07)) / 0.20, 0), 1);
                        const show = ctx.mcRun > 0 && ap > 0 && inten > 0.02;
                        f.g.visible = show;
                        if (show) {
                            const e = ap * ap * (3 - 2 * ap);
                            f.g.position.y = 0.05 + f.ty * e + Math.sin(time * 1.5 + f.ph) * 0.03;
                            f.g.rotation.y += dt * f.spd;
                            f.g.scale.setScalar(0.5 + 0.5 * e);
                            f.m.opacity = 0.85 * inten * e;
                        }
                    }
                    for (const q of ctx.mcParts) {
                        const show = inten > 0.04;
                        q.p.visible = show;
                        if (show) {
                            const pr = (q.ph + time * 0.35) % 1;
                            const a = q.a + time * q.spd;
                            q.p.position.set(ctx.MC_X + Math.cos(a) * q.r, 0.05 + pr * 2.5, ctx.MC_Z + Math.sin(a) * q.r);
                            const sc = Math.sin(pr * Math.PI) * inten;
                            q.p.scale.setScalar(Math.max(sc, 0.001));
                            q.p.rotation.y = time * 2;
                        }
                    }
                }

                {
                    // J3（B2）：沙漏的每帧分支已搬入 world/floor1/hourglass.js。
                    // **原位置调用** —— 每帧顺序与搬迁前一个字节不差，画面因此逐字节不变。
                    ctx.hourglassApi.tick(dt, time);
                }

                {
                    // J3（B2）：小宝箱的每帧分支已搬入 world/floor1/chest.js（原地 tick）
                    ctx.chestApi.tick(dt, time);
                }

                /* ---- 楼梯下储物箱：开盖 + 矿石旋转起伏 ---- */
                {
                    const target = ctx.storageOpen ? 1 : 0;
                    ctx.storageV += (target - ctx.storageP) * 0.02;
                    ctx.storageV *= 0.9;
                    ctx.storageP += ctx.storageV;
                    ctx.storageLid.rotation.x = -1.35 * ctx.storageP;
                    const show = ctx.storageP > 0.25;
                    for (let i = 0; i < ctx.oreMeshes.length; i++) {
                        const o = ctx.oreMeshes[i];
                        o.g.visible = show;
                        if (show) {
                            o.g.rotation.y += dt * 0.8;
                            if (ctx.storageP > 0.9)
                                o.g.position.y = o.by + Math.sin(time * 2 + i * 1.1) * 0.006;
                        }
                    }
                }

                {
                    // J3（B3）：旋转星铃的每帧分支已搬入 world/floor1/starBell.js（原地 tick）
                    ctx.starBellApi.tick(dt, time);
                }

                /* ---- 大魔女坩埚 ---- */
                {
                    // J3（B4）：大魔女坩埚的每帧分支已搬入 world/floor1/cauldron.js（原地 tick）
                    ctx.cauldronApi.tick(dt, time);
                }

                /* ---- 长餐桌 ---- */
                {
                    // J3（B4）：三只餐盘的转动已搬入 world/floor1/longTable.js（原地 tick）
                    ctx.longTableApi.tick(dt, time);
                }
                for (const c of ctx.cups) {
                    const u = c.userData;
                    if (u.run > 0) u.run -= dt;
                    const prog = u.run > 0 ? Math.min(Math.max(1 - u.run / 2.6, 0), 1) : 1;
                    const env = u.run > 0 ? Math.sin(Math.PI * prog) : 0;
                    u.lift = env * 0.13;
                    c.position.y = u.baseY + u.lift;
                    u.steam.visible = u.run > 0;
                    if (u.steam.visible) {
                        u.steam.position.y = 0.10 + (time * 0.25) % 0.07;
                        const ss = 0.85 + 0.15 * Math.sin(time * 5);
                        u.steam.scale.set(ss, 1, ss);
                    }
                }
                {
                    // J3（B4）：桌面散放餐具的弹跳已搬入 world/floor1/tableware.js（原地 tick）
                    ctx.tablewareApi.tick(dt, time);
                }

                /* ---- 茶壶 ---- */
                {
                    if (ctx.potRun > 0) ctx.potRun -= dt;
                    const p = ctx.potRun > 0 ? 1 - ctx.potRun / ctx.POT_T : 0;
                    const dirX = Math.sin(ctx.POT_RY), dirZ = Math.cos(ctx.POT_RY);
                    const hx = ctx.CUP_T.position.x - dirX * ctx.POT_TIP_FWD;
                    const hz = ctx.CUP_T.position.z - dirZ * ctx.POT_TIP_FWD;
                    const sm = tt => tt * tt * (3 - 2 * tt);
                    let ly = 0, dx = 0, dz = 0, tilt = 0;
                    if (p > 0) {
                        if (p < 0.14) {
                            ly = sm(p / 0.14) * 0.45;
                        } else if (p < 0.30) {
                            const u = sm((p - 0.14) / 0.16);
                            ly = 0.45; dx = u * (hx - ctx.POT_BX); dz = u * (hz - ctx.POT_BZ);
                        } else if (p < 0.40) {
                            const u = sm((p - 0.30) / 0.10);
                            ly = 0.45; dx = hx - ctx.POT_BX; dz = hz - ctx.POT_BZ; tilt = u * ctx.POT_TILT;
                        } else if (p < 0.70) {
                            ly = 0.45; dx = hx - ctx.POT_BX; dz = hz - ctx.POT_BZ; tilt = ctx.POT_TILT;
                        } else if (p < 0.80) {
                            const u = sm((p - 0.70) / 0.10);
                            ly = 0.45; dx = hx - ctx.POT_BX; dz = hz - ctx.POT_BZ; tilt = (1 - u) * ctx.POT_TILT;
                        } else if (p < 0.94) {
                            const u = sm((p - 0.80) / 0.14);
                            ly = 0.45; dx = (1 - u) * (hx - ctx.POT_BX); dz = (1 - u) * (hz - ctx.POT_BZ);
                        } else {
                            const u = sm((p - 0.94) / 0.06);
                            ly = (1 - u) * 0.45;
                        }
                    }
                    const floating = p > 0.02 && p < 0.98;
                    const bob = floating ? Math.sin(time * 3) * 0.012 : 0;
                    ctx.teapotPos.position.set(ctx.POT_BX + dx, ctx.DTOP + ly + bob, ctx.POT_BZ + dz);
                    ctx.teapot.rotation.x = tilt;
                    ctx.potHalo.visible = floating;
                    if (floating) ctx.potHaloMat.opacity = 0.09 + 0.04 * (0.5 + 0.5 * Math.sin(time * 5));
                    if (tilt > 0.45) {
                        ctx.potStream.visible = true;
                        ctx.potSpoutTip.getWorldPosition(ctx._tv);
                        const ex = ctx.CUP_T.position.x, ey = ctx.CUP_T.position.y + 0.10, ezz = ctx.CUP_T.position.z;
                        const arr = ctx.potStreamGeom.attributes.position.array;
                        for (let i = 0; i < 10; i++) {
                            const tt = i / 9;
                            const wob = Math.sin(tt * Math.PI);
                            arr[i * 3] = ctx._tv.x + (ex - ctx._tv.x) * tt + Math.sin(tt * 9 + time * 8) * 0.008 * wob;
                            arr[i * 3 + 1] = ctx._tv.y + (ey - ctx._tv.y) * tt - 0.035 * wob;
                            arr[i * 3 + 2] = ctx._tv.z + (ezz - ctx._tv.z) * tt + Math.cos(tt * 7 + time * 6) * 0.008 * wob;
                        }
                        ctx.potStreamGeom.attributes.position.needsUpdate = true;
                    } else {
                        ctx.potStream.visible = false;
                    }
                }

                {
                    // J3：魔法扫帚的每帧分支已搬入 world/floor1/broom.js。
                    // **原位置调用** —— 顺序与搬迁前一致，画面因此逐字节不变。
                    ctx.broomApi.tick(dt, time);
                }

                /* ---- 门铃：按钮按压 + 音波涟漪 ---- */
                {
                    if (ctx.bellRun > 0) ctx.bellRun -= dt;
                    if (ctx.bellRun > 0) {
                        ctx.btnG.position.z = -0.014 * Math.sin(Math.min((1.4 - ctx.bellRun) * 9, Math.PI));
                    } else {
                        ctx.btnG.position.z = 0;
                    }
                    if (ctx.bellRipple > 0) ctx.bellRipple -= dt;
                    for (const r of ctx.bellRipples) {
                        if (ctx.bellRipple > 0) {
                            const s = 1 + (1 - ctx.bellRipple) * 2.4;
                            r.l.scale.setScalar(Math.max(s, 0.001));
                            r.m.opacity = Math.max(0, ctx.bellRipple * 0.7);
                        } else {
                            r.m.opacity = 0;
                        }
                    }
                }

                /* ---- 晴天娃娃 + 风铃 ---- */
                {
                    // J3（B3）：挂杆 / 晴天娃娃 / 风铃三段的每帧分支已合并搬入
                    // world/floor1/doorHangBar.js（原地 tick，顺序不变）。
                    ctx.doorHangBarApi.tick(dt, time);
                }

                ctx.chairT += ((ctx.chairOpen ? 1 : 0) - ctx.chairT) * 0.07;
                const ck = ctx.smooth(Math.max(0, Math.min(1, ctx.chairT)));
                ctx.chairG.position.z = ctx.CHAIR_IN + (ctx.CHAIR_OUT - ctx.CHAIR_IN) * ck;
                ctx.pillowT += ((ctx.pillowOpen ? 1 : 0) - ctx.pillowT) * 0.05;
                const pe = ctx.pillowT * ctx.pillowT * (3 - 2 * ctx.pillowT);
                ctx.pillowG.rotation.x = Math.PI * pe;
                ctx.eraserT += ((ctx.eraserOpen ? 1 : 0) - ctx.eraserT) * 0.06;
                const ee = ctx.eraserT * ctx.eraserT * (3 - 2 * ctx.eraserT);
                ctx.eraserG.rotation.x = Math.PI * ee;
                ctx.updateChalk(time);
                ctx.updateWand2(time);
                // J3（B5）：魔方（浮起打乱 / 落回还原）的每帧分支已搬入 world/floor2/rubik.js（原地 tick）
                // ⚠️ 参数顺序是 (dt, time) —— 原函数的形参顺序与 tick 相反。
                ctx.rubikApi.tick(dt, time);
                // J3（B5）：玻璃雪景球（雪花翻滚 / 落回 / 复位）的每帧分支已搬入 world/floor2/snowGlobe.js（原地 tick）
                // ⚠️ 参数顺序是 (dt, time) —— 原函数的形参顺序与 tick 相反。
                ctx.snowGlobeApi.tick(dt, time);
                // J3（B5）：桌面沙漏（翻身 / 流沙）的每帧分支已搬入 world/floor2/deskHourglass.js（原地 tick）
                // ⚠️ 参数顺序是 (dt, time) —— 原函数的形参顺序与 tick 相反。
                ctx.deskHourglassApi.tick(dt, time);
                // J3（B5）：扑克牌堆（浮起 / 扇开 / 洗牌 / 翻牌）的每帧分支已搬入 world/floor2/cardDeck.js（原地 tick）
                // ⚠️ 参数顺序是 (dt, time) —— 原函数的形参顺序与 tick 相反。
                ctx.cardDeckApi.tick(dt, time);
                ctx.updateBook(time, dt);
                // J3（B5）：台历翻页（12 页翻完再整体翻回 1 月）的每帧分支已搬入 world/floor2/calendar.js（原地 tick）
                // ⚠️ 参数顺序是 (dt, time) —— 原函数的形参顺序与 tick 相反。
                ctx.calendarApi.tick(dt, time);
                ctx.updateGlyphs(time, dt);
                // J3（B5）：金币柱倒塌/恢复的每帧分支已搬入 world/floor2/coinTowers.js（原地 tick）
                // ⚠️ 参数顺序是 (dt, time) —— 原函数的形参顺序与 tick 相反。
                ctx.coinTowersApi.tick(dt, time);
                ctx.tissueBoxApi.tick(dt, time);
                ctx.updateWobblers(dt);
                ctx.witchHatApi.tick(dt, time);

                ctx.candleP += ((ctx.candleLit ? 1 : 0) - ctx.candleP) * 0.03;
                const candleVisible = ctx.candleP > 0.02;
                for (const f of ctx.candleWavy) {
                    f.obj.visible = candleVisible;
                    if (candleVisible) {
                        ctx.updateWavyFlame(f, time, ctx.candleP * (0.9 + 0.1 * Math.sin(time * 9)));
                    }
                }

                ctx.magicP += ((ctx.magicOn ? 1 : 0) - ctx.magicP) * 0.012;
                ctx.veil.material.opacity = ctx.magicP * 0.28;
                {
                    const flick = 0.9 + 0.1 * Math.sin(time * 9) + 0.04 * Math.sin(time * 23);
                    const boost = 0.30 + 0.50 * ctx.magicP;
                    for (const cg of ctx.candleGlows) {
                        cg.m.material.opacity = cg.maxOp * ctx.candleP * boost * flick;
                        cg.m.scale.setScalar(1 + 0.05 * Math.sin(time * 9 + cg.maxOp * 10));
                    }
                }
                if (ctx.magicP > 0.01) {
                    ctx.spinG.rotation.y += 0.020 * ctx.magicP;
                    ctx.innerG.rotation.y -= 0.008 * ctx.magicP;
                }
                const pulse = 0.8 + 0.2 * Math.sin(time * 2.4);
                for (let i = 0; i < ctx.glows.length; i++) {
                    ctx.glows[i].material.opacity = ctx.glows[i].userData.maxOp * ctx.magicP * pulse;
                    ctx.glows[i].scale.setScalar(1 + 0.06 * Math.sin(time * 2.4 + i * 1.1));
                }
                const partsOn = ctx.magicP > 0.02;
                for (const g of ctx.magicParts) {
                    g.visible = partsOn;
                    if (!partsOn) continue;
                    const b = g.userData.p;
                    const th = time * b.sp + b.ph;
                    g.position.set(
                        b.cx + Math.sin(th * 0.6) * 0.15,
                        b.y0 + Math.sin(th) * b.bob,
                        b.cz + Math.cos(th * 0.5) * 0.12
                    );
                    g.rotation.y += b.rs;
                    let tw;
                    if (g.userData.vivid) {
                        tw = Math.max(0.05, Math.pow(Math.abs(Math.sin(time * 3.4 + b.ph * 11)), 2.5) * 1.25);
                    } else if (g.userData.sharp) {
                        tw = Math.max(0.12, Math.pow(Math.abs(Math.sin(time * 2.2 + b.ph * 7)), 3) * 1.15);
                    } else if (g.userData.nebula) {
                        tw = 0.75 + 0.25 * Math.sin(time * 0.8 + b.ph * 3);
                    } else {
                        tw = 0.7 + 0.4 * Math.sin(time * 2.0 + b.ph * 5);
                    }
                    g.scale.setScalar(Math.max(0.001, ctx.magicP * (0.8 + 0.35 * tw)));
                    if (g.userData.halo) {
                        g.userData.halo.h1.material.opacity = g.userData.halo.opIn * tw * ctx.magicP;
                        g.userData.halo.h2.material.opacity = g.userData.halo.opOut * tw * ctx.magicP;
                    }
                    if (g.userData.spikes) {
                        g.userData.spikes.opacity = 0.85 * tw * ctx.magicP;
                    }
                    if (g.userData.cluster) {
                        for (const c of g.userData.cluster) {
                            const a = time * 0.5 + c.ph;
                            c.g.position.set(Math.cos(a) * 0.030, Math.sin(a * 0.8) * 0.008, Math.sin(a) * 0.030);
                        }
                    }
                    if (g.userData.tails) {
                        for (const tl of g.userData.tails) {
                            tl.m.material.opacity = (0.5 / tl.s) * tw * ctx.magicP;
                            tl.m.position.set(-Math.sin(th) * 0.045 * tl.s, -Math.cos(th * 0.5) * 0.018 * tl.s, 0);
                        }
                    }
                }
                ctx.fireP += ((ctx.fireLit ? 1 : 0) - ctx.fireP) * 0.016; const fireVisible = ctx.fireP > 0.02;
                for (const f of ctx.wavyFlames) { f.obj.visible = fireVisible; if (fireVisible) ctx.updateWavyFlame(f, time, ctx.fireP); }
                for (const sp of ctx.sparks) { sp.visible = ctx.fireP > 0.05; if (sp.visible) { const prog = (time * 0.22 + sp.userData.phase) % 1; sp.position.set(ctx.FX + sp.userData.drift * prog + Math.sin(time * 2.5 + sp.userData.phase * 9) * 0.04, 0.55 + prog * 1.0, ctx.FZ + Math.cos(time * 2 + sp.userData.phase * 7) * 0.1); const sc = ((1 - prog) * 0.9 + 0.15) * (0.35 + 0.65 * ctx.fireP); sp.scale.set(sc, sc, sc); } }
                for (const p of ctx.smokePuffs) { p.visible = ctx.fireP > 0.03; if (p.visible) { const prog = (time * 0.25 + p.userData.phase) % 1; const s = (0.5 + prog * 1.6) * ctx.fireP; p.scale.set(s, s, s); p.position.set(ctx.CHX - prog * 0.7, 7.35 + prog * 1.6, ctx.CHZ + Math.sin(time * 2 + p.userData.phase * 10) * 0.08); } }

                ctx.lampP += ((ctx.lampLit ? 1 : 0) - ctx.lampP) * 0.016;
                ctx.FILL.uniforms.uLampStrength.value = ctx.lampP;
                const lampVisible = ctx.lampP > 0.02;
                for (const f of ctx.chandelierFlames) { f.obj.visible = lampVisible; if (lampVisible) ctx.updateWavyFlame(f, time, ctx.lampP * (0.9 + 0.1 * Math.sin(time * 9 + f.phase))); }
                ctx.chandelier.rotation.x = Math.sin(time * 0.7) * 0.012;
                ctx.chandelier.rotation.z = Math.cos(time * 0.53) * 0.012;
                const lampBreath = 0.9 + 0.1 * Math.sin(time * 2.1);
                ctx.lampGlowMatA.opacity = ctx.lampP * 0.38 * lampBreath;
                ctx.lampGlowMatB.opacity = ctx.lampP * 0.13 * (0.9 + 0.1 * Math.sin(time * 2.1 + 1.0));
                ctx.lampCrystalMat.color.setRGB(0.45 + 0.55 * ctx.lampP, 0.45 + 0.4 * ctx.lampP, 0.5 + 0.12 * ctx.lampP);
                ctx.lampCrystal.rotation.y += 0.012;
                ctx.pendant.rotation.y -= 0.008;

                /* ---- 室内点光源：吊挂木灯·坩埚魔火·魔法阵·暖桌·水晶球·蜡烛·星象仪·月光盆栽 ---- */
                ctx.ptLantern += ((ctx.lanternLit ? 1 : 0) - ctx.ptLantern) * 0.07;
                ctx.ptKot += ((ctx.kotatsuOn ? 1 : 0) - ctx.ptKot) * 0.07;
                ctx.ptMc += ((ctx.mcRun > 0 ? 1 : 0) - ctx.ptMc) * 0.055;
                ctx.ptCb += ((ctx.cbRun > 0 ? 1 : 0) - ctx.ptCb) * 0.055;
                ctx.ptPlant += ((ctx.plantRun > 0 ? 1 : 0) - ctx.ptPlant) * 0.055;
                // J2.3：8 个槽位的填充交给光照场（原先是 8 行 PP[i]/PC[i]/PG[i] 硬编码）。
                // 光源在初始化时注册过一次，这里只按注册顺序刷新强度 —— 新增一盏灯不再改本文件。
                ctx.lightField.update(time, dt);

                if (ctx.camShake > 0.002) {
                    // J2.7：抖动位移交给 CameraRig；衰减与判据留在这里（它们是本文件的状态量）
                    ctx.cameraRig.applyShake(ctx.camShake, runtimeRng);
                    ctx.camShake *= Math.exp(-3.2 * dt);
                }

                // J0.4：测试机位覆盖 —— 固定相机位用于截图回归（realtime 下 testCam 恒为 null，不生效）
                if (ctx.testCam) ctx.cameraRig.applyTestCamera(ctx.testCam);

                ctx.renderer.render(ctx.scene, ctx.camera);
                // F0.3：手动模式下由主循环驱动装饰循环（realtime 模式由它自己的 rAF 驱动）
                if (clock.mode === 'manual') ctx.updateNewDecor(time, dt);
            }

            // F0.3：主循环只负责「推进时钟 + 跑一帧」——时间源可切换为手动步进
            /* ==================== [J4:seg boot] ==================== */
            // ↓ J4 段导出（boot）：本段函数声明挂到 ctx（借提升，段内任何位置都可见）
            ctx.animate = animate;
            function animate(t) {
                requestAnimationFrame(animate);
                clock.tick(t);
                ctx.tickOnce();
            }
            // F0.3：启动主循环。
            //   realtime：rAF 自驱动（行为与改动前完全一致）
            //   manual  ：不自驱动，改由宿主（boot.js）通过 window.__cabinStepFrame 同步逐帧推进 ——
            //             这样定格 N 帧不必等待 N 次真实 rAF（无头/软件渲染下每次 rAF 都很慢）。
            //             装饰循环同样由 tickOnce 负责调用（见上），因此定格结果完整。
            //
            // ⚠️ 定格后必须**持续重绘**：WebGL 默认 preserveDrawingBuffer=false，
            //    若停止渲染，drawing buffer 会被清空 —— 截图将得到全黑画面（而非定格的那一帧）。
            if (clock.mode === 'manual') {
                window.__cabinStepFrame = ctx.tickOnce;
                // J0.4：测试机位设置 —— 截图回归用固定相机位（六元数组 [px,py,pz,lx,ly,lz]；null / 非法值 = 清除覆盖）。
                //       与单帧钩子一样**只在 manual 模式暴露**，所以正常游玩路径上不存在这个接口。
                window.__cabinSetTestCamera = function (p) {
                    ctx.testCam = Array.isArray(p) && p.length >= 6 && p.slice(0, 6).every(Number.isFinite) ? p.slice(0, 6) : null;
                    return ctx.testCam ? ctx.testCam.slice() : null;
                };
                // J0.4：完整小屋开关 —— 与菜单里的 houseToggle 按钮**等效**（只少了音效），同样只在 manual 模式暴露。
                //       默认是剖切模式：省略的墙/屋顶用虚线表示，便于从外面看到室内；
                //       true = 显示完整外观（实墙 + 屋顶）。截图机位据此选择「看室内」还是「看整体」。
                window.__cabinSetFullHouse = function (on) {
                    // J2.8：与菜单按钮共用同一个应用点；测试钩子**不写 store**（避免测试污染用户设置）
                    ctx.applyFullHouse(on);
                    return ctx.fullHouse;
                };
                // 静止重绘：**只重绘，不推进任何状态**。
                //   不能调用 tickOnce() —— 那会继续更新 gameSec（昼夜/太阳/天空），画面会缓慢变化。
                window.__cabinStartStillRepaint = function () {
                    (function still() {
                        requestAnimationFrame(still);
                        ctx.renderer.render(ctx.scene, ctx.camera);
                    })();
                };
            } else {
                animate(0);
            }

            // J0.6：渲染统计钩子 —— **仅当宿主通过 `?stats=1` 请求时**才暴露（正常游玩路径上不存在这个接口）。
            //       与 J0.4 的机位钩子不同，它**不挂在 manual 分支**：性能必须在 realtime（rAF 自驱动）下量。
            //       数据源：three 的 `renderer.info`（每帧自动复位，读到的是最近一帧的值）+ 场景图计数。
            //       `calls / triangles / geometries / textures` 与渲染后端无关，是判断
            //       "重构是否引入性能回归"最可靠的硬指标。
            if (window.__CABIN_WANT_STATS) {
                window.__cabinRenderStats = function () {
                    const r = ctx.renderer.info;
                    let objects = 0, meshes = 0, lineObjs = 0, points = 0;
                    ctx.scene.traverse(o => {
                        objects++;
                        if (o.isMesh) meshes++; else if (o.isLine || o.isLineSegments) lineObjs++; else if (o.isPoints) points++;
                    });
                    return {
                        frame: clock.frame,
                        calls: r.render.calls, triangles: r.render.triangles, renderLines: r.render.lines, renderPoints: r.render.points,
                        geometries: r.memory.geometries, textures: r.memory.textures,
                        programs: r.programs ? r.programs.length : null,
                        sceneObjects: objects, sceneMeshes: meshes, sceneLines: lineObjs, scenePoints: points
                    };
                };
            }
            addEventListener('resize', () => { ctx.camera.aspect = innerWidth / innerHeight; ctx.camera.updateProjectionMatrix(); ctx.renderer.setSize(innerWidth, innerHeight); });
        })(ctx);
}
