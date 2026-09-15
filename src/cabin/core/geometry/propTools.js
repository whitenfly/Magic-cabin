/**
 * 圆角几何 / 陈设工具 —— 从 `legacy/monolith.js` 搬出的整段（propsTools）
 *
 * 来源：`J4` 段切片（段表见 `scripts/oneoff/_j4-segments.mjs`）。
 * 段内代码**逐字未改**，只做了三件事：包成函数、补 import、把跨段通信交给 `ctx`。
 * 因此这个文件的正确性判据与搬迁前完全一致：像素逐字节零差异。
 *
 * @param {object} ctx 段间通信载体（见 `installCabin` 的 `__J4_CTX__`）
 * @param {object} app 应用内核 —— 段里用到的 `registry`/`bus`/`scheduler`/`store` 从这里解构
 */
import * as THREE from 'three'
import { createRoundBox } from './roundBox.js'
import { createSolid } from './solid.js'

export function installPropTools(ctx, app) {
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
}
