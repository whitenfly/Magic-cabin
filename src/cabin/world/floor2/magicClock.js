/**
 * 18.12 烟囱墙：魔法时钟（与现实时间同步）—— `J4.30` 升格 `defineProp`
 *
 * 来源：`legacy/monolith.js` 原 `18.12` 分区里**时钟本体**那一段（`J3` 记的 L2593 一带，
 * 实际起点是 `const clockCanvas = …`），以及 `updateNewDecor()` 的**第一行** `drawClock();`。
 *
 * ## ★ 这是「任务 D 专项 ④」：`J4.15` 曾尝试并**回退**，本次重做
 *
 * `docs/实施结果/J4.15-实施结果.md` §2 记着一次**完整搬迁 + 184 像素差异 + 6 条假设逐条证伪**
 * 的排查矩阵。本任务按同一配方重做，并按 §2.5 的**捷径**先做那个"一次 `visual` 就能区分
 * 两类原因"的实验（见 §「第一个实验」）。
 *
 * ## ⚠️ 关键偏离：`startMarker` **跳过** `colEdge` 那 6 行
 *
 * `18.12` 分区标题行的**后 6 行**是一个**共享工具** `colEdge(g, col, th)` ——
 * 它被**四处区间外**使用（`floor2/mirror.js` / `floor2/junkBoxes.js` / `floor2/picture.js`
 * 的 `build` 各 1 处 + 本段自己 3 处）。按分区标题整段搬会让那三件在**装配时立刻
 * `ReferenceError`**（不是像素差异，是启动崩）。
 *
 * ⇒ 本件的区间**从 `const clockCanvas` 那一行开始**，`colEdge` **原地留在 `install.js`**
 * （它仍是那个文件的 `ctx.colEdge` 导出）。代价是 `install.js` 里会留下一段
 * 「标题 + 分隔线 + `colEdge` + 空行」的碎片 —— 可读性略差，功能完整。
 * 这与 `J4.15` §3 的"现成配方"完全一致，也是它标注的**唯一偏离**。
 *
 * ## 搬迁对照
 *
 * | 原来住哪 | 现在住哪 |
 * |---|---|
 * | `ctx.clockLastKey`（秒级字符串缓存） | `state.clockLastKey`（**跨帧缓存**：一秒只重画一次） |
 * | `ctx.clockCanvas` / `ctx.cctx` / `ctx.clockTex` / `ctx.clockG` | `build()` 内的同名局部量；`cctx` / `clockTex` 经 `parts` 交出 |
 * | `clockHand(ang, len, w, col)`（闭包捕获 `cctx`） | **模块级**函数，**显式接收 canvas 上下文**（`clockHand(c, ang, …)`） |
 * | `function drawClock()` | **模块级** `paintClock(c, tex, st)`（函数体逐字搬运，只把 `cctx` → 形参 `c`、`ctx.clockLastKey` → `st.clockLastKey`） |
 * | 硬编码 `-2.95` | `world/layout.js` 的 `CLOCK_X`（不变量 `N9`；数值一个没改） |
 * | `updateNewDecor()` 第一行的 `drawClock();` | `clockApi.tick(dt, time);`（**原位置**，仍是第一行） |
 *
 * ## ⚠️ `world → app` 的具体实现依赖（`J4.15` §3 条件 2 的两条路之一）
 *
 * `paintClock` 要读 `clock.mode` / `clock.frozenDateMs` 才能算出"此刻该显示几点"——
 * 这是**相机外的真实墙上时间**（`new Date()`），不是动画时间，所以 `floor2/rubik.js`
 * 那套 `s.now` 的替身**在这里不适用**。
 *
 * `J4.15` 给的两条路：① 把 `clock` 加进 `propCtx`；② 由物件 `import { clock } from '../../app/clock.js'`。
 * 本件采用 **②**（与 `J4.15` §2.1 的落点一致）：`clock` 是**核心模块**
 * （`app/clock.js`，与 `defineProp` 同级、无场景依赖），且 `app/installProp.js` 文件头
 * 已经为"契约定义"开过同类先例（依赖 `systems/interaction/types.js`）。
 * ⚠️ 它确实是 `world/**` 直接依赖 `app/**` **具体实现**的一处 —— 按不变量 `N3` 的口径
 * 这是一次**需要记账的例外**，已在 `docs/实施结果/J4.30-实施结果.md` §4 逐条论证并记账
 * （含"为什么不走 `propCtx` 加 `clock` 那条路"的取舍）。
 *
 * ## ⚠️ `clockCanvas` 的尺寸与纹理上传
 *
 * `clockCanvas.width = clockCanvas.height = 256` 与 `new THREE.CanvasTexture(clockCanvas)`
 * 都在 `build` 内、位置不变；`paintClock` 在 `build` 末尾被调用**一次**（对应原来的
 * `drawClock();` 那一行），此后每帧由 `update` 调用 —— **与原实现的调用时机逐帧一致**。
 *
 * ## 逐字搬运说明
 *
 * 全部数值（画布 `256`、表盘底 `#faf4e4` 与半径 `122/119`、12 段刻度 `100→112` 与
 * `i % 3 === 0 ? 5 : 2.5`、四个数字 `26px serif` 与坐标、`✦` 的 `15px serif`、
 * 三根指针的 `56/6.5`·`86/4.5`·`98/2` 与颜色、中心两个圆点 `7`/`3`、
 * 挂钟位置 `-2.95` / `FY + 1.42` / `rotation.y = Math.PI/2`、表圈 `0.30/0.042/8/30`、
 * 表盘面 `0.285/30` 与 `z = 0.028`、三颗装饰八面体 `0.05`/`0.028` 与 `±0.36`）**一个没改**。
 * 本件**不消耗 `rng`**（原段没有 `floor1Rng` / `runtimeRng` 调用）。
 *
 * ## ★ 第一个实验（`J4.15` §2.5 的捷径）
 *
 * 那个实验的做法是"**把 `paintClock` 的调用从 `build` 里移到 `update` 里**"
 * （装配期不画、只在第一帧画），用来一次性区分：
 *
 * - **若差异消失** ⇒ 问题在"**装配期绘制**"这个环境（canvas 纹理上传时机 / 字体竞态）；
 * - **若差异不变** ⇒ 问题在"**绘制内容**"本身（与何时画无关）。
 *
 * 本任务的结果见 `docs/实施结果/J4.30-实施结果.md`。
 */
import * as THREE from 'three'
import { defineProp } from '../../app/defineProp.js'
import { clock } from '../../app/clock.js'

/**
 * 画一根指针（原 `18.12` 段内的局部函数，**逐字搬运**）。
 *
 * ⚠️ 与原实现的唯一差别：canvas 上下文由**第一个参数显式传入**（原来靠闭包捕获 `cctx`）——
 * 这样它才能与 `paintClock` 一起住在模块作用域，被 `build` 与 `update` 共用。
 */
function clockHand(c, ang, len, w, col) {
    c.strokeStyle = col;
    c.lineWidth = w;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(128 - Math.cos(ang) * 14, 128 - Math.sin(ang) * 14);
    c.lineTo(128 + Math.cos(ang) * len, 128 + Math.sin(ang) * len);
    c.stroke();
}

/**
 * 重画表盘（原 `function drawClock()`，**函数体逐字搬运**）。
 *
 * @param {CanvasRenderingContext2D} c 表盘画布上下文（原闭包里的 `cctx`）
 * @param {THREE.CanvasTexture} tex 表盘纹理（原闭包里的 `clockTex`）
 * @param {{clockLastKey: string}} st 物件的 state（原 `ctx.clockLastKey` —— **跨帧缓存**，
 *   决定"一秒只重画一次"；搬进 state 后语义不变）
 */
function paintClock(c, tex, st) {
    const now = clock.mode === 'manual' && clock.frozenDateMs !== null ? new Date(clock.frozenDateMs) : new Date();
    const key = now.getHours() + ':' + now.getMinutes() + ':' + now.getSeconds();
    if (key === st.clockLastKey) return;
    st.clockLastKey = key;
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
    clockHand(c, (h + m / 60) / 12 * Math.PI * 2 - Math.PI / 2, 56, 6.5, '#3a3a3a');
    clockHand(c, (m + s / 60) / 60 * Math.PI * 2 - Math.PI / 2, 86, 4.5, '#3a3a3a');
    clockHand(c, s / 60 * Math.PI * 2 - Math.PI / 2, 98, 2, '#b04a4a');
    c.fillStyle = '#3a3a3a';
    c.beginPath(); c.arc(128, 128, 7, 0, 7); c.fill();
    c.fillStyle = '#b04a4a';
    c.beginPath(); c.arc(128, 128, 3, 0, 7); c.fill();
    tex.needsUpdate = true;
}

export default defineProp({
  id: 'floor2/magic-clock',
  kind: 'decor',

  // `clockLastKey` 是原来的 `ctx.clockLastKey`（跨帧的秒级缓存）
  state: () => ({ clockLastKey: '' }),

  build({ scene, L, put, edge, colEdge, state }) {
    const { FY, CHZ, CLOCK_X } = L

    const clockCanvas = document.createElement('canvas');
    clockCanvas.width = 256;
    clockCanvas.height = 256;
    const cctx = clockCanvas.getContext('2d');
    const clockTex = new THREE.CanvasTexture(clockCanvas);
    // 装配期就画一次（对应原实现 `drawClock();` 那一行；此后每帧由 `update` 调用）
    // ★ J4.30 实测：把这一行去掉**画面也不变** —— 说明 `update` 通路能在第一帧独立画对
    //   （这正是 `J4.15` §2.5"第一个实验"的答案，见 docs/实施结果/J4.30-实施结果.md §3）
    paintClock(cctx, clockTex, state);
    const clockG = new THREE.Group();
    clockG.position.set(CLOCK_X, FY + 1.42, CHZ);
    clockG.rotation.y = Math.PI / 2;
    scene.add(clockG);
    {
        clockG.add(edge(new THREE.TorusGeometry(0.30, 0.042, 8, 30)));
        const face = new THREE.Mesh(new THREE.CircleGeometry(0.285, 30), new THREE.MeshBasicMaterial({ map: clockTex }));
        face.position.z = 0.028;
        clockG.add(face);
        put(colEdge(new THREE.OctahedronGeometry(0.05), 0xb8912a), 0, 0.40, 0.02, 0, 0, 0, clockG);
        put(colEdge(new THREE.OctahedronGeometry(0.028), 0xb8912a), -0.36, 0, 0.02, 0, 0, 0, clockG);
        put(colEdge(new THREE.OctahedronGeometry(0.028), 0xb8912a), 0.36, 0, 0.02, 0, 0, 0, clockG);
    }

    return { root: clockG, parts: { clockG, cctx, clockTex } }
  },

  /**
   * 原 `updateNewDecor()` 的**第一行** `drawClock();` —— 在**原位置**被调用
   * （`decor-loop` 的两条驱动路径 realtime rAF / manual `frame/101` 都不变）。
   */
  update(dt, time, s, { parts }) {
    paintClock(parts.cctx, parts.clockTex, s);
  },
})
