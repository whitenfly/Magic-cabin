/**
 * J4 段表 —— `legacy/monolith.js` 的 IIFE 体如何切成模块
 *
 * 来源：新增（`J4`）。**这是 J4 全部工作的唯一事实来源**：哪一段代码住哪、
 * 段与段之间的通信只能走 `ctx`。
 *
 * ## 为什么是"段"而不是"逐行搬"
 *
 * `installCabin()` 是一个 6105 行的 IIFE，780 个顶层声明彼此交错引用，
 * 靠"函数声明提升 + 同一个作用域链"活着。逐件手搬在这里走不通：每搬一处都要手改引用点，
 * 而 `_j4-analyze.mjs` 量出**立即执行的引用有 2190 处**。
 *
 * 于是 `J4` 换了个做法：**先把整个 IIFE 体按段切开、段间改成 `ctx` 通信**（一次机械变换），
 * 再逐段把归属换到目标模块（纯剪切，代码一个字不改）。
 *
 * ## 段边界的安全性（已实测，不是推断）
 *
 * `node scripts/oneoff/_j4-analyze.mjs` 量出：**立即执行的前向引用 = 0 处**。
 * 也就是说，原文里"随执行流程立即求值"的引用**全都指向更早（或同段）的声明** ——
 * 所以只要段按原顺序执行，任何切点都不会拿到 undefined。
 * 那 33 处"前向引用"全部住在函数体里（延迟求值），切片后走 `ctx` 完全安全。
 *
 * ## 三件必须守住的事（写在这里，因为没人会去读 6105 行）
 *
 * 1. **段序 = 执行序**。原文件是"从上往下跑"的，段必须按 `hint` 升序调用；
 *    `rng` 调用顺序、`scene.add` 顺序、`lightField.register` 槽序都由此决定。
 * 2. **顶层 `let` 一律改写成 `ctx.x`**（声明与引用都是）。它是**跨段共享的可变状态**，
 *    留成局部变量会让两段各持一份副本 —— 那种错只在某个值不同步时才显形。
 * 3. **顶层 `const` / `function` 段内保留原名，导出到 `ctx`**。★ 导出的**位置**
 *    另有一条硬约束（`function` 段首、`const` 紧跟声明），见 `_j4-apply.mjs` 的 ① 节 ——
 *    放错位置会让页面完全起不来。
 *
 * ## `module` 的路径基准
 *
 * `module` 一律相对 **`src/cabin/`**（与 `systems/README.md` 的写法一致），
 * 由 `_j4-apply.mjs --move` 解析。**一个段一个文件** —— 两个段写同一个文件会互相覆盖。
 *
 * ## `bind`：段模块自己的"模块级绑定"
 *
 * 有些名字住在 monolith 的**模块顶层**（IIFE 之外），既不是 import、也不是 `app` 的解构 ——
 * 它们的符号声明落在段外，`_j4-apply.mjs` 的 `unknown` 判据会（正确地）报出来。
 * `bind` 就是回答"它们从哪来"：段模块里就地重建同样的绑定。
 */

/**
 * monolith 模块顶层的**随机源**：6 个构建期种子随机 + 1 个运行期随机。
 *
 * ```js
 * const { outdoor: outdoorRng, floor1: floor1Rng, …, slime: slimeRng } = scene
 * const runtimeRng = runtime
 * ```
 *
 * 搬到段模块时按需重建 —— 它们是**同一个对象/函数**的别名，
 * 重建后 `rng` 的调用序列与搬迁前完全一致（这正是像素零差异的前提之一）。
 */
export const RNG_BIND = {
  outdoorRng: { expr: 'scene.outdoor', import: { from: '../app/rng.js', names: ['scene'] } },
  floor1Rng: { expr: 'scene.floor1', import: { from: '../app/rng.js', names: ['scene'] } },
  floor2Rng: { expr: 'scene.floor2', import: { from: '../app/rng.js', names: ['scene'] } },
  skyRng: { expr: 'scene.sky', import: { from: '../app/rng.js', names: ['scene'] } },
  textureRng: { expr: 'scene.texture', import: { from: '../app/rng.js', names: ['scene'] } },
  slimeRng: { expr: 'scene.slime', import: { from: '../app/rng.js', names: ['scene'] } },
  runtimeRng: { expr: 'runtime', import: { from: '../app/rng.js', names: ['runtime'] } },
}

/** 从 `RNG_BIND` 里取若干项拼成某一段的 `bind` */
const rng = (...names) => Object.fromEntries(names.map((n) => [n, RNG_BIND[n]]))

/** 段：`hint` 是提示行号（吸附到该行之后最近的顶层语句起点），实际边界由应用器算 */
export const SEGMENTS = [
  // ── 基础设施（`app/`）────────────────────────────────────────────────────
  { id: 'prelude', hint: 112, module: 'app/scene/Env.js', fn: 'installEnv', note: 'strict / 触屏探测' },
  { id: 'audio', hint: 118, module: 'systems/audio/AudioSystem.js', fn: 'installAudio', note: 'SND 音效池' },
  { id: 'core3d', hint: 139, module: 'app/scene/SceneCore.js', fn: 'installSceneCore', note: 'scene / camera / renderer / 材质 / 几何 DSL / L' },
  // ── 世界（`world/`）──────────────────────────────────────────────────────
  {
    // ★ J4.10（缺口 C6）：8 个点光源的注册从 `weather` 段移回"光照"的归属 ——
    //   原段切片按行切，把它切进了天气模块（光照与天气无关）。
    id: 'lights', hint: 4924, module: 'world/lights.js', fn: 'installWorldLights',
    note: '室内点光源 8 槽位注册（★ 槽序 = 注册顺序；shader 相位含 float(i)）',
  },
  {
    id: 'houseShell', hint: 184, module: 'world/house/shell.js', fn: 'installHouseShell',
    note: '墙 / 屋顶 / 门窗 / 楼梯 / 路牌', bind: rng('runtimeRng'),
  },
  {
    id: 'outdoor', hint: 437, module: 'world/outdoor/yardStatic.js', fn: 'installOutdoorYardStatic',
    note: '森林 / 草地 / 石头 / 树桩 / 花（含 addStatic 收集器与 mergeStatic）', bind: rng('outdoorRng'),
  },
  {
    // ★ J4.9（缺口 C7）：室外片从"一条不可切分的链"切成两件 + 一个共享模块（`outdoor/yardSpot.js`）。
    //   仍然**只是段形态**，不是 `defineProp` —— 升格为 prop 是另一件事（见 `J4.9-实施结果.md` 遗留）。
    id: 'fireflies', hint: 592, module: 'world/outdoor/fireflies.js', fn: 'installOutdoorFireflies',
    note: '萤火虫（几何 + 状态；每帧分支仍在 FrameBody/WeatherSystem，经 ctx.ff* 取值）',
    bind: rng('outdoorRng'),
  },
  { id: 'propsTools', hint: 643, module: 'core/geometry/propTools.js', fn: 'installPropTools', note: '圆角几何 / 陈设工具' },
  {
    id: 'installer', hint: 664, module: 'app/scene/PropInstaller.js', fn: 'installPropInstaller',
    note: 'J3 装配器接线 + 装配环境 ctx',
    // 装配环境把 7 个随机源一并交给物件（`propTool('rng', () => ({ … }))`）
    bind: rng('outdoorRng', 'floor1Rng', 'floor2Rng', 'skyRng', 'textureRng', 'slimeRng', 'runtimeRng'),
  },
  {
    id: 'floor1', hint: 719, module: 'world/floor1/install.js', fn: 'installFloor1',
    note: '一楼陈设', bind: rng('floor1Rng'),
  },
  { id: 'junkBoxes', hint: 1694, module: 'world/floor1/junkBoxes.js', fn: 'installJunkBoxes', note: '楼梯下储物箱' },
  {
    id: 'floor2', hint: 1741, module: 'world/floor2/install.js', fn: 'installFloor2',
    note: '二楼陈设', bind: rng('runtimeRng', 'floor2Rng', 'textureRng'),
  },
  // ── 系统（`systems/`）────────────────────────────────────────────────────
  { id: 'noteEditor', hint: 3384, module: 'systems/ui/editors/NoteEditor.js', fn: 'installNoteEditor', note: '便签编辑器（二楼计划板）' },
  {
    id: 'chandelier', hint: 3406, module: 'world/floor2/chandelier.js', fn: 'installChandelier',
    note: '二楼顶中央魔法吊灯', bind: rng('slimeRng'),
  },
  {
    id: 'magic', hint: 3474, module: 'systems/magic/MagicSystem.js', fn: 'installMagicSystem',
    note: '超位魔法系统：魔杖 / 24 层阵 / 爆炸', bind: rng('runtimeRng'),
  },
  // ── 玩家 ────────────────────────────────────────────────────────────────
  { id: 'collision', hint: 4715, module: 'systems/player/collision.js', fn: 'installCollision', note: '家具平台碰撞体 + collideXZ / groundAt' },
  { id: 'sfxBridge', hint: 4757, module: 'systems/interaction/Bridge.js', fn: 'installInteractionBridge', note: '音效辅助 + 交互通路接线' },
  { id: 'input', hint: 4795, module: 'systems/player/Input.js', fn: 'installInput', note: '键鼠 / 摇杆 / 触屏按钮' },
  { id: 'menuUi', hint: 4846, module: 'systems/ui/MenuPanel.js', fn: 'installMenuPanel', note: '菜单面板 + 设置 → 场景 唯一通道' },
  { id: 'playerCtrl', hint: 4884, module: 'systems/player/PlayerController.js', fn: 'installPlayerController', note: 'updatePlayer / 相机解算 / 史莱姆落地' },
  // ── 天气与主循环 ────────────────────────────────────────────────────────
  {
    id: 'weather', hint: 4924, module: 'systems/weather/WeatherSystem.js', fn: 'installWeatherSystem',
    note: '天空 / 时间 / 天气 / 星空', bind: rng('skyRng', 'runtimeRng'),
  },
  { id: 'tick', hint: 5435, module: 'app/scene/FrameBody.js', fn: 'installFrameBody', note: 'tickOnce：716 行的每帧体' },
  { id: 'boot', hint: 6151, module: 'app/scene/SceneLoop.js', fn: 'installSceneLoop', note: 'animate + manual 钩子 + 统计钩子' },
]
