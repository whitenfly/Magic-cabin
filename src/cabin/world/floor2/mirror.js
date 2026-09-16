/**
 * 18.14 拱形全身镜（点击镜面泛起水波涟漪） —— `J3` 搬迁（B4）
 *
 * 来源：`legacy/monolith.js` 原 `18.14` 分区（搬迁前 `L5360–L5517`）的**几何段**与画布绘制
 * （`mirrorArchPath` / `drawMirror` / `spawnMirrorRipple`），以及原 `18.17` 装饰循环里
 * `updateNewDecor()` 的**镜子每帧分支**（搬迁前 `L5534–L5541`）。
 *
 * ## 搬迁对照
 *
 * | 原来住哪 | 现在住哪 |
 * |---|---|
 * | 行内 `2.55` / `3.60` | `world/layout.js` 的 `MIRROR_X` / `MIRROR_Z`（不变量 `N9`；数值一个没改） |
 * | `const mirrorG / mirrorTilt / mirrorCv / mctx / mirrorTex` + 拱形木框几何 | `build()`，经 `{ root, parts }` 交出（`parts.pane` / `parts.tilt`） |
 * | 顶层 `const mirrorRipples = []` | `state.ripples`（**同一个数组实例**；`build()` 里以原名 `mirrorRipples` 别住，绘制函数一字未改） |
 * | 顶层 `let mirrorDirtyT = 0`（住在 `18.17` 装饰段） | `state.dirtyT`（只服务镜子的每帧分支） |
 * | `spawnMirrorRipple()` 里的 `runtimeRng()` | `rng.runtime`（**同一个随机源实例**，调用次数与顺序未变 —— `F0.2` 的"运行期瞬态保持真随机"因此不变） |
 * | `updateNewDecor()` 里那 8 行（涟漪老化 + 每 0.12 秒重绘） | `update()`，由 `updateNewDecor()` **原位置**调用 `mirrorApi.tick(dt, time)` |
 *
 * 几何与绘制**逐字搬运**（只有缩进重排）；`cbox` / `colEdge` / `MAT` / `LITMAT` 全部取自 `ctx`
 * （`ctx` 里的就是 monolith 那三个同名函数本身 —— 已核 `cbox` 在原 `L4384`、`colEdge` 在原 `L5180`，
 * 各只有一处声明），因此"圆角盒 + 描边"与"彩色几何 + 描边"的产出对象逐项不变。
 *
 * ## ★ 欠账：只还了一半 —— **自建射线留给 `J4`**
 *
 * ★ **`J4.8`（路线图 `J4` 的缺口 **C1**）已把这一半接回** —— 见下方 `build()` 里的自建射线段。
 *   下面这段是 `J3` 当时的判断记录（事实仍然成立：那 6 行确实需要 `camera`/`renderer`），
 *   `J4` 的做法就是给装配环境补上它们，然后原样贴回。
 *
 * `J2.6` 的 §5 把「镜子的自建射线」明确留给 `J3`（`types.js` 里已备好 `localPointOf()`）。
 * 本轮**没还上这一半**，理由可复核：射线那 6 行（搬迁前 `L5498–L5517`：`let mirrorDown = null;`
 * → 第二个 `addEventListener('pointerup', …)` 结束）需要三样本物件拿不到的东西 ——
 *
 * · `renderer.domElement`（射线的挂载点）；
 * · `camera`（`mirrorRay.setFromCamera(mirrorMouse, camera)`）；
 * · 命中点的**局部坐标**（`mirrorPane.worldToLocal(hits[0].point.clone())`）。
 *
 * 而 `installProp` 的 `ctx` **只有** `scene / L / rng / 几何 DSL / 材质 / SND`（见 monolith 里
 * `propTool(...)` 的清单）—— **没有** `camera` 与 `renderer`；`installProp` 补的 aim 通路
 * （`magicMeshes` + `userData.onClick`）又只传"激活"、**不传命中点**，且镜子**不能**改走主射线
 * （它不看遮挡，进了 `magicMeshes` 就变成"被家具挡住就点不到镜子"，`J2.6` §5 已明确拒绝）。
 * ⇒ 让射线**等价**搬迁必须先改 `monolith.js`（给 `ctx` 补 `camera`/`renderer`，或让 aim 契约带上
 * 命中点），超出本轮"只加一行 `installProp(...)` + 一行 `tick`"的约定 ⇒ 按任务要求留给 `J4`。
 *
 * **还上的那一半**：几何、状态（涟漪数组 / 画布 / 星表）、画布绘制、涟漪生成函数与每帧刷新 ——
 * 并已把 `J4` 接回射线所需的两样东西交出去：`parts.pane`（求交对象）与 `state.spawnRipple`
 * （加涟漪入口）。`J4` 的最短路径：给 `ctx` 补 `camera`/`renderer`（或让交互契约带 `hit.point`），
 * 然后在这两样之上把那 6 行射线代码贴回来即可，`mirrorPane` 的局部坐标换算仍是
 * `spawnMirrorRipple((lp.x / 0.54 + 0.5) * 160, (0.5 - lp.y / 1.60) * 480);`。
 *
 * **后果（诚实说明）**：`J3` 期间镜面**点不出涟漪**了。**画面本身不变** —— 镜面的高光扫过与
 * 星星闪烁靠 `dirtyT` 每 0.12 秒重绘一次，与搬迁前逐帧一致（搬迁前也不会在建几何时画第一帧：
 * 第一笔发生在第一次 `updateNewDecor` 之后，本文件保持同一时序）。丢的只是"点击"这一个入口。
 *
 * ## ⚠️ 需要人工在 monolith 侧做两件事（应用器只管几何段）
 *
 * ① 装配行接住句柄：`const mirrorApi = installProp(mirror);`（`spec.assign` 已声明，应用器会写成这样）。
 * ② 把 `updateNewDecor()` 里镜子那 8 行整段替换为 `mirrorApi.tick(dt, time);`
 *    （搬迁前 `L5534–L5541`：`for (let i = mirrorRipples.length - 1; …` 起，到
 *    `if (mirrorRipples.length || mirrorDirtyT > 0.12) { drawMirror(time); mirrorDirtyT = 0; }` 止）。
 *    **参数顺序是 (dt, time)** —— 而 `updateNewDecor(time, dt)` 自己的形参是反的，写反会让涟漪
 *    老化速度差三个数量级（纸箱那件踩过同一个坑，见 `floor2/junkBoxes.js` 文件头）。
 * ③ **`let mirrorDirtyT = 0;` 必须留着不删** —— `scripts/verify-f03.mjs` 的第 ⑥ 项断言
 *    `let decorLastT = 0;` / `let mirrorDirtyT = 0;` / `// F0.3：装饰循环…` 三行**连续存在**
 *    （它靠这个反向还原出 `F0.3` 之前的版本）；删掉它静态门禁立刻变红。此后它是死变量
 *    （计数器已归 `state.dirtyT`），但必须留着。
 *
 * 不做 ② 的后果是**立刻可见**的 `ReferenceError`（`mirrorRipples` 已随几何段删除）——
 * 装饰循环整条停摆（时钟 / 挂画 GIF / 纸箱一起不跑）。做了 ② 则时机与搬迁前完全一致：
 * 调用点仍在 `updateNewDecor` 内（原位置）⇒ realtime 的 rAF 与 manual 步进两条路径都不变。
 *
 * ## 本件**没有** `interactables`（这是判断，不是遗漏）
 *
 * 搬迁前镜子没有 `regMagic` —— 它的交互入口就是那条自建射线。若为它补一条 aim 条目，
 * `installProp` 会把镜面 Mesh 加进 `magicMeshes`，准星/点击射线从此能命中镜子，且行为变成
 * "被挡住就点不到"（`J2.6` §5 拒绝过的那次行为变化）。射线本轮不搬 ⇒ 本件在 `J3` 期间
 * 保持"纯陈设"，等 `J4` 用统一契约（能带命中点的那种）接管。
 *
 * ## ctx 键与门禁提醒
 *
 * `scene` / `L(MIRROR_X, MIRROR_Z, FY)` / `put` / `cbox` / `colEdge` / `MAT` / `LITMAT` /
 * `rng.runtime`（**按需解构**，不展开 `ctx`）。
 * 射线那两行 `renderer.domElement.addEventListener(...)` 随区间删除 ⇒
 * `scripts/verify-migration.mjs` 的 ④ 里 `addEventListener(` 会由 −1 变 −3，
 * 该脚本的 `J25_DELTA` 需同步（`J3` 期间本就在按批次更新这些期望值）。
 */
import * as THREE from 'three'
import { defineProp } from '../../app/defineProp.js'

export default defineProp({
  id: 'floor2/mirror',
  kind: 'furniture',

  state: () => ({
    ripples: [],        // 原顶层 `const mirrorRipples = []`
    dirtyT: 0,          // 原顶层 `let mirrorDirtyT = 0`（住在 18.17 装饰段）
    drawMirror: null,   // build 里填入：每帧重绘镜面 canvas 的闭包
    spawnRipple: null,  // build 里填入：加涟漪的入口（J4 接回射线时用它）
  }),

  build({ scene, L, put, cbox, colEdge, MAT, LITMAT, rng, state, camera, renderer }) {
    const { MIRROR_X, MIRROR_Z, FY } = L
    const runtimeRng = rng.runtime

    const mirrorG = new THREE.Group();
    mirrorG.position.set(MIRROR_X, FY, MIRROR_Z);
    mirrorG.rotation.y = Math.PI;
    scene.add(mirrorG);
    const mirrorTilt = new THREE.Group();
    mirrorTilt.rotation.x = -0.09;
    mirrorG.add(mirrorTilt);
    const mirrorCv = document.createElement('canvas');
    mirrorCv.width = 160;
    mirrorCv.height = 480;
    const mctx = mirrorCv.getContext('2d');
    const mirrorTex = new THREE.CanvasTexture(mirrorCv);
    const mirrorRipples = state.ripples;   // 别名 = `state.ripples`（**同一个数组实例**，下面函数体一字未改）
    let mirrorPane;
    {
        // ---- 拱形木框：外拱形轮廓挖内拱形孔，挤出厚度 ----
        const OUT_W = 0.66, OUT_H = 1.80;
        const IN_W = 0.54, IN_H = 1.66, IN_Y0 = 0.07;
        const frameShape = new THREE.Shape();
        const oR = OUT_W / 2, oTop = OUT_H - oR;
        frameShape.moveTo(-oR, 0);
        frameShape.lineTo(-oR, oTop);
        frameShape.absarc(0, oTop, oR, Math.PI, 0, true);
        frameShape.lineTo(oR, 0);
        frameShape.closePath();
        const holePath2 = new THREE.Path();
        const iR = IN_W / 2, iBot = IN_Y0, iTop = IN_Y0 + IN_H - iR;
        holePath2.moveTo(-iR, iBot);
        holePath2.lineTo(-iR, iTop);
        holePath2.absarc(0, iTop, iR, Math.PI, 0, true);
        holePath2.lineTo(iR, iBot);
        holePath2.closePath();
        frameShape.holes.push(holePath2);
        const frameGeo = new THREE.ExtrudeGeometry(frameShape, { depth: 0.05, bevelEnabled: false, curveSegments: 20 });
        const frameMesh = new THREE.Mesh(frameGeo, LITMAT(0x7a5a3a, { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
        frameMesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(frameGeo, 8), MAT));
        frameMesh.position.z = -0.025;
        mirrorTilt.add(frameMesh);
        // ---- 镜面（拱形绘制在 canvas 上，嵌入框内 ----
        mirrorPane = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 1.60), new THREE.MeshBasicMaterial({ map: mirrorTex }));
        mirrorPane.position.set(0, IN_Y0 + IN_H / 2, 0.018);
        mirrorTilt.add(mirrorPane);
        // ---- 框顶金色月牙 ----
        const moonShape = new THREE.Shape();
        moonShape.absarc(0, 0, 0.058, Math.PI / 2, Math.PI * 1.5, false);
        moonShape.absarc(0.024, 0, 0.046, Math.PI * 1.5, Math.PI / 2, true);
        const moonGeo = new THREE.ExtrudeGeometry(moonShape, { depth: 0.012, bevelEnabled: false, curveSegments: 14 });
        const moon = new THREE.Mesh(moonGeo, LITMAT(0xc9a227, { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
        moon.add(new THREE.LineSegments(new THREE.EdgesGeometry(moonGeo, 8), MAT));
        moon.position.set(0, 1.87, 0);
        mirrorTilt.add(moon);
        // ---- 月牙两侧小星（拉长八面体） ----
        for (const sxy of [[-0.20, 1.74], [0.20, 1.74]]) {
            const st = colEdge(new THREE.OctahedronGeometry(0.026), 0xc9a227);
            st.scale.set(0.7, 1.4, 0.7);
            st.position.set(sxy[0], sxy[1], 0.01);
            mirrorTilt.add(st);
        }
        // ---- 底部横木底座 ----
        put(cbox(0.58, 0.06, 0.11, 0x5a4128), 0, 0.02, 0.01, 0, 0, 0, mirrorTilt);
    }
    const mirrorStars = [];
    for (let i = 0; i < 16; i++) {
        mirrorStars.push({ x: 12 + (i * 53 + 23) % 136, y: 120 + (i * 97 + 41) % 340, s: i % 3 === 0 ? 1.8 : 1.1 });
    }
    function mirrorArchPath(c) {
        c.beginPath();
        c.moveTo(2, 480);
        c.lineTo(2, 72);
        c.arc(80, 72, 78, Math.PI, 0, false);
        c.lineTo(158, 480);
        c.closePath();
    }
    function drawMirror(time) {
        const c = mctx;
        c.fillStyle = '#4a3a2c';
        c.fillRect(0, 0, 160, 480);
        c.save();
        mirrorArchPath(c);
        c.clip();
        const g = c.createLinearGradient(0, 0, 0, 480);
        g.addColorStop(0, '#eef5f8');
        g.addColorStop(0.5, '#d8e9f0');
        g.addColorStop(1, '#c6dbe6');
        c.fillStyle = g;
        c.fillRect(0, 0, 160, 480);
        const sx = 45 + Math.sin(time * 0.45) * 55;
        const g2 = c.createLinearGradient(sx - 40, 0, sx + 40, 0);
        g2.addColorStop(0, 'rgba(255,255,255,0)');
        g2.addColorStop(0.5, 'rgba(255,255,255,0.4)');
        g2.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = g2;
        c.fillRect(0, 0, 160, 480);
        c.fillStyle = 'rgba(250,244,214,0.5)';
        c.beginPath(); c.arc(106, 150, 27, 0, 7); c.fill();
        c.fillStyle = 'rgba(214,232,240,0.6)';
        c.beginPath(); c.arc(114, 142, 23, 0, 7); c.fill();
        for (let i = 0; i < mirrorStars.length; i++) {
            const st = mirrorStars[i];
            const tw = 0.3 + 0.3 * Math.abs(Math.sin(time * 1.8 + i * 1.7));
            c.fillStyle = 'rgba(255,255,255,' + tw.toFixed(2) + ')';
            c.beginPath(); c.arc(st.x, st.y, st.s, 0, 7); c.fill();
        }
        for (const rp of mirrorRipples) {
            for (let k = 0; k < 3; k++) {
                const rr = rp.r * (1 - k * 0.18);
                if (rr < 2) continue;
                c.strokeStyle = 'rgba(255,255,255,' + (rp.a * (1 - k * 0.28)).toFixed(3) + ')';
                c.lineWidth = 2.6 - k * 0.8;
                c.beginPath();
                c.ellipse(rp.x, rp.y, rr, rr * 0.62, 0, 0, 7);
                c.stroke();
                c.strokeStyle = 'rgba(90,130,155,' + (rp.a * 0.35 * (1 - k * 0.28)).toFixed(3) + ')';
                c.beginPath();
                c.ellipse(rp.x, rp.y, rr * 0.9, rr * 0.62 * 0.9, 0, 0, 7);
                c.stroke();
            }
        }
        c.restore();
        mirrorArchPath(c);
        c.strokeStyle = 'rgba(70,52,36,0.6)';
        c.lineWidth = 3;
        c.stroke();
        mirrorTex.needsUpdate = true;
    }
    function spawnMirrorRipple(x, y) {
        mirrorRipples.push({ x: x, y: y, r: 3, a: 1, max: 130 + runtimeRng() * 40 });
        for (let i = 0; i < 3; i++) {
            mirrorRipples.push({
                x: x + (runtimeRng() - 0.5) * 46,
                y: y + (runtimeRng() - 0.5) * 90,
                r: 2, a: 0.7, max: 40 + runtimeRng() * 30
            });
        }
    }

    // 交接：`update()` 要重绘镜面；`J4` 接回射线时要加涟漪（本文件唯一的"新增胶水"，两行）
    state.drawMirror = drawMirror;
    state.spawnRipple = spawnMirrorRipple;

    // 返回根 + 需要后续访问的两个部件（`parts.pane` 是 J4 射线的求交对象）
    // ── 自建射线：点击镜面泛起涟漪（原 `index.html` L6630–L6649，逐字搬迁）──────────
    //
    // ★ 为什么**不能**改走 `magicMeshes` 主射线（路线图 `J4` 的 C1 已写明）：
    //   主射线要过家具遮挡判定 ⇒ 镜子一旦被家具挡住就点不到；而这条射线只对 `mirrorPane`
    //   求交（`intersectObject(mirrorPane, false)`）—— **不看遮挡**，这正是原语义。
    //   所以本件**不声明** `interactables`（见文件头「本件没有 interactables」），探针的 26 件
    //   准星入口列表里也没有它 —— 这是设计，不是遗漏。
    //
    // 它需要 `camera` / `renderer`（`J4.8` 起由 `installProp` 的装配环境提供），
    // 以及 `mirrorPane` / `spawnMirrorRipple` —— 两者都是本函数内的局部（`J3` 已分别作为
    // `parts.pane` 与 `state.spawnRipple` 交出去；射线用局部名即可，与原实现同源）。
    let mirrorDown = null;
    const mirrorRay = new THREE.Raycaster();
    const mirrorMouse = new THREE.Vector2();
    renderer.domElement.addEventListener('pointerdown', function (e) {
      mirrorDown = { x: e.clientX, y: e.clientY };
    });
    renderer.domElement.addEventListener('pointerup', function (e) {
      if (!mirrorDown) return;
      const moved = Math.abs(e.clientX - mirrorDown.x) + Math.abs(e.clientY - mirrorDown.y);
      mirrorDown = null;
      if (moved >= 6) return;
      mirrorMouse.x = (e.clientX / innerWidth) * 2 - 1;
      mirrorMouse.y = -(e.clientY / innerHeight) * 2 + 1;
      mirrorRay.setFromCamera(mirrorMouse, camera);
      const hits = mirrorRay.intersectObject(mirrorPane, false);
      if (hits.length) {
        const lp = mirrorPane.worldToLocal(hits[0].point.clone());
        spawnMirrorRipple((lp.x / 0.54 + 0.5) * 160, (0.5 - lp.y / 1.60) * 480);
      }
    });

    return { root: mirrorG, parts: { pane: mirrorPane, tilt: mirrorTilt } }
  },

  /** 原 `updateNewDecor()` 里镜子那段（涟漪老化 + 每 0.12 秒重绘），逐字搬运 */
  update(dt, time, s) {
    const mirrorRipples = s.ripples

    for (let i = mirrorRipples.length - 1; i >= 0; i--) {
        const rp = mirrorRipples[i];
        rp.r += 62 * dt;
        rp.a = Math.max(0, 1 - rp.r / rp.max);
        if (rp.a <= 0.01) mirrorRipples.splice(i, 1);
    }
    s.dirtyT += dt;
    if (mirrorRipples.length || s.dirtyT > 0.12) { s.drawMirror(time); s.dirtyT = 0; }
  },
})
