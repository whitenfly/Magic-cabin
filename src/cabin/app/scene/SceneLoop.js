/**
 * animate + manual 钩子 + 统计钩子 —— 从 `legacy/monolith.js` 搬出的整段（boot）
 *
 * 来源：`J4` 段切片（段表见 `scripts/oneoff/_j4-segments.mjs`）。
 * 段内代码**逐字未改**，只做了三件事：包成函数、补 import、把跨段通信交给 `ctx`。
 * 因此这个文件的正确性判据与搬迁前完全一致：像素逐字节零差异。
 *
 * @param {object} ctx 段间通信载体（见 `installCabin` 的 `__J4_CTX__`）
 * @param {object} app 应用内核 —— 段里用到的 `registry`/`bus`/`scheduler`/`store` 从这里解构
 */
import { clock } from '../clock.js'

export function installSceneLoop(ctx, app) {
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
}
