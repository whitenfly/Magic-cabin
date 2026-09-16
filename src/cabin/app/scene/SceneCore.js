/**
 * scene / camera / renderer / 材质 / 几何 DSL / L —— 从 `legacy/monolith.js` 搬出的整段（core3d）
 *
 * 来源：`J4` 段切片（段表见 `scripts/oneoff/_j4-segments.mjs`）。
 * 段内代码**逐字未改**，只做了三件事：包成函数、补 import、把跨段通信交给 `ctx`。
 * 因此这个文件的正确性判据与搬迁前完全一致：像素逐字节零差异。
 *
 * @param {object} ctx 段间通信载体（见 `installCabin` 的 `__J4_CTX__`）
 * @param {object} app 应用内核 —— 段里用到的 `registry`/`bus`/`scheduler`/`store` 从这里解构
 */
import * as THREE from 'three'
import { createFillMaterial } from '../../core/materials/FillMaterial.js'
import { createLayout } from '../../world/layout.js'
import { createLineMaterials } from '../../core/materials/lineMaterials.js'
import { createLitMaterialFactory } from '../../core/materials/litMaterial.js'
import { createSketch } from '../../core/geometry/sketch.js'

export function installSceneCore(ctx, app) {
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
}
