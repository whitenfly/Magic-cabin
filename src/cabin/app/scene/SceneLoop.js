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
                // J4.48：推进 N 帧**并推进时钟** —— 与 `__cabinStepFrame` 的区别**很重要**：
                //   后者就是 `tickOnce()`，**不推进 `clock`**（这正是 J0.4「定格帧」要的：
                //   120 帧定格之后画面必须停住，`gameSec` 不许继续走）。
                //   但**由绝对时间驱动**的动画（`e = time - s.t0`，如魔杖的五段状态机、
                //   沙漏的 `t0`、魔术书的 `t0`）在时钟冻结时**永远走不出第一段** ——
                //   实测：点魔杖后推 330 次 `__cabinStepFrame`，`phase` 一直停在 `fly`。
                //   ⇒ 判据需要一个"带时钟"的推进器；步长默认 `1/60`，与 `clock.step()` 的
                //     手动步长一致（`F0.3`：120 帧 = 2 秒，精确）。
                window.__cabinAdvance = function (n, dt) {
                    const k = Math.max(0, Math.floor(n || 1));
                    const step = Number.isFinite(dt) && dt > 0 ? dt : 1 / 60;
                    for (let i = 0; i < k; i++) { clock.step(step); ctx.tickOnce(); }
                    return k;
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

                // J4.47：碰撞表摘要钩子 —— 与 `__cabinRenderStats` **同一个开关**（`?stats=1`）、同一个理由：
                //   正常游玩路径上不存在这个接口。
                //   ★ 为什么必须有它：碰撞**不参与渲染** ⇒ `test:visual` 原理上看不见它
                //     （像素逐字节相同**也证明不了**碰撞没坏），而 `j3-probe` 只问交互入口存不存在。
                //     于是"物件搬走后碰撞坐标 / 引用错了"此前**只有人工论证**兜底 —— 论证不能自动重跑。
                //   形态：**结构化数值摘要**（不是哈希）—— 判据失败时能直接指出是哪一项、差多少。
                //     ① `platformBoxes` / `activePlatforms`：碰撞盒的**数值本身**（坐标改 0.1 当场可见）；
                //     ② `ground` / `stairs` / `collide` / `rails`：五个纯函数在**测试给定探测点**上的输出
                //        （抓"数值没变但判据逻辑被改坏"）。
                //   ⚠️ 探测点由**测试**传入（`tests/e2e/collision.mjs`）：世界坐标常量属测试资产，
                //     不进产品代码（沿用 J0.4「机位表不进产品代码」的边界）。
                window.__cabinCollisionDigest = function (probes) {
                    const r6 = (v) => Math.round(v * 1e6) / 1e6;
                    const box = (b) => [r6(b.x1), r6(b.z1), r6(b.x2), r6(b.z2), r6(b.top), r6(b.bot || 0)];
                    const p = probes || {};
                    return {
                        platformBoxes: ctx.platformBoxes.map(box),
                        activePlatforms: ctx.activePlatforms.map(box),
                        ground: (p.ground || []).map((q) => r6(ctx.groundAt(q[0], q[1], q[2]))),
                        stairs: (p.stairs || []).map((a) => r6(ctx.stairHeightAt(a))),
                        collide: (p.collide || []).map((q) => ctx.collideXZ(q[0], q[1], q[2]).map(r6)),
                        rails: (p.rails || []).map((q) => ctx.railCollide(q[0], q[1], q[2], q[3], q[4]).map(r6)),
                    };
                };

                // J4.48：物件运行期状态钩子 —— 与上面两个钩子同一个开关（`?stats=1`）、同一个理由。
                //   ★ 为什么需要它：`j3-probe` 只能证明"交互入口**存在**"，证明不了"点开之后**行为正确**"
                //     （`J4.20` 的结论就是：**"能点开" ≠ "点开后行为正确"**）；`test:visual` 看的是
                //     **没人去点的**定格帧。于是 wand 的五段状态机 / 造物"加了又清" / 归位、
                //     board 的便签编辑、magic-book 的六相位翻页…… 此前都只有"同构先例"这一条弱保证。
                //   数据源：`ctx.propInstalled`（`installProp` 的装配记录 Map，每件物件含 `state`）——
                //     它本来就导出了 `get(id)`（`installProp.js` 里写着"诊断与测试用"），
                //     这里只是把这条**已存在**的只读通路接到页面上，**不新增任何状态**。
                //   ⚠️ 返回**可序列化视图**：原始值原样；`Object3D` 给 `type + 位姿`；
                //     几何 / 材质 / 数组 / 函数只给占位符 —— 避免把整个场景图塞进测试。
                window.__cabinPropState = function (id) {
                    const rec = ctx.propInstalled && ctx.propInstalled.get(id);
                    if (!rec) return null;
                    const r6 = (v) => Math.round(v * 1e6) / 1e6;
                    const vec = (v) => [r6(v.x), r6(v.y), r6(v.z)];
                    const snap = (v) => {
                        if (v === null || v === undefined) return null;
                        const t = typeof v;
                        if (t === 'number' || t === 'string' || t === 'boolean') return v;
                        if (t === 'function') return '<function>';
                        if (Array.isArray(v)) return `<array[${v.length}]>`;
                        // `inScene`：对象是否**还挂在场景图上**（`scene.remove()` 会把 `parent` 置回 null）。
                        // ★ 判据只读 `state.crea === null` 是**不够的** —— "状态置空了、对象却还留在场景里"
                        //   （漏掉 `scene.remove`）会**假绿**。这个字段让"真的移除了"成为可断言的事实。
                        if (v.isObject3D) return { type: v.type, uuid: v.uuid, inScene: !!v.parent, pos: vec(v.position), quat: [r6(v.quaternion.x), r6(v.quaternion.y), r6(v.quaternion.z), r6(v.quaternion.w)] };
                        if (v.isVector3) return vec(v);
                        if (v.isQuaternion) return [r6(v.x), r6(v.y), r6(v.z), r6(v.w)];
                        if (v.isBufferGeometry || v.isGeometry) return '<geometry>';
                        if (v.isMaterial) return '<material>';
                        return `<${(v.constructor && v.constructor.name) || 'object'}>`;
                    };
                    const outState = {};
                    for (const k of Object.keys(rec.state || {})) outState[k] = snap(rec.state[k]);
                    const outParts = {};
                    for (const k of Object.keys(rec.parts || {})) outParts[k] = snap(rec.parts[k]);
                    return { id: rec.prop.id, state: outState, parts: outParts };
                };

                // J4.48：按 `uuid` 查场景 —— 与 `__cabinPropState` 成套使用，补上后者**查不到**的那一类问题。
                //   ★ 为什么需要它：`__cabinPropState().state.crea` 一旦被置 null，**就再也指不到**
                //     那个对象了。于是"`s.crea = null` 置空了、但 `scene.remove(s.crea)` 漏掉了"
                //     这种**场景泄漏**在状态视图里完全看不见（实测：负例删掉 `scene.remove` 后判据**照样绿**）。
                //   用法：测试在采样中把见过的 `uuid` 记下来，最后逐个回场景图里查 —— 断言
                //     "它**确实离开了**"，而不是"状态变量被清空了"。
                window.__cabinSceneHas = function (uuid) {
                    if (typeof uuid !== 'string' || !uuid) return false;
                    let hit = false;
                    ctx.scene.traverse((o) => { if (o.uuid === uuid) hit = true; });
                    return hit;
                };
            }
            addEventListener('resize', () => { ctx.camera.aspect = innerWidth / innerHeight; ctx.camera.updateProjectionMatrix(); ctx.renderer.setSize(innerWidth, innerHeight); });
}
