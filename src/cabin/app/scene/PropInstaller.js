/**
 * J3 装配器接线 + 装配环境 ctx —— 从 `legacy/monolith.js` 搬出的整段（installer）
 *
 * 来源：`J4` 段切片（段表见 `scripts/oneoff/_j4-segments.mjs`）。
 * 段内代码**逐字未改**，只做了三件事：包成函数、补 import、把跨段通信交给 `ctx`。
 * 因此这个文件的正确性判据与搬迁前完全一致：像素逐字节零差异。
 *
 * @param {object} ctx 段间通信载体（见 `installCabin` 的 `__J4_CTX__`）
 * @param {object} app 应用内核 —— 段里用到的 `registry`/`bus`/`scheduler`/`store` 从这里解构
 */
import { createPropInstaller } from '../installProp.js'
import { runtime, scene } from '../rng.js'

export function installPropInstaller(ctx, app) {
  const { registry, scheduler } = app
  const outdoorRng = scene.outdoor
  const floor1Rng = scene.floor1
  const floor2Rng = scene.floor2
  const skyRng = scene.sky
  const textureRng = scene.texture
  const slimeRng = scene.slime
  const runtimeRng = runtime
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
            // ★ J4.8（路线图 J4 的缺口 C1）：把 `camera` / `renderer` 交给物件。
            //   全身镜的**自建射线**需要这两样（射线起点 + 监听器挂载点）—— 它是唯一
            //   "不看遮挡"的交互，因此**不能**改走 `magicMeshes` 主射线（那会变成"被家具挡住就点不到"）。
            //   两者都由 `core3d` 段创建、在装配器之前就绪，惰性 getter 取用安全。
            propTool('camera', () => ctx.camera); propTool('renderer', () => ctx.renderer);
            // 音效（交互的 `sfx` 由物件声明）
            propTool('SND', () => ctx.SND);
            // ★ J4.18：光照场也交给物件 —— `lights()` 声明的光源由 `installProp` 注册进它
            //   （此前只登记进 registry ⇒ 物件声明的灯不会亮，见 app/installProp.js ⑥）。
            //   槽序由声明里的 `slot` 决定，与装配时机无关 ⇒ 6 件含光源物件可以整体搬家。
            //   `lightField` 在 `installWorldLights`（段 03 之后）就已建好，早于本段，惰性 getter 安全。
            propTool('lightField', () => ctx.lightField);

            // J4.7：`installed` 也交出去 —— 帧任务登记（`app/scene/FrameBody.js`）要先把
            // `installProp()` 自动登记的那些任务**撤销**再按原 tickOnce() 的顺序重登，
            // 因为自动登记的顺序是**装配顺序**，与帧顺序不同。
            const { install: installProp, stats: propStats, installed: propInstalled } = createPropInstaller({
                registry,
                scheduler,
                mounts: app.mounts,
                ctx: propCtx,
            });
            ctx.installProp = installProp; ctx.propStats = propStats; ctx.propInstalled = propInstalled;

            /* ========================================================== */
            /* ============ 一楼生活陈设（魔法餐桌·书架·暖桌·猫等） ============ */
            /* ========================================================== */

            // ---- 12.1 原木餐桌 ----
            // J3（B3）：几何已搬入 src/cabin/world/floor1/diningTable.js，此处只留装配调用。
}
