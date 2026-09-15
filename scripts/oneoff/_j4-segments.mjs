/**
 * J4 段表 —— `legacy/monolith.js` 的 IIFE 体如何切成模块
 *
 * 来源：新增（`J4`）。**这是 J4 全部工作的唯一事实来源**：哪一段代码住哪、
 * 段与段之间的通信只能走 `ctx`。
 *
 * ## 为什么是"段"而不是"逐行搬"
 *
 * `installCabin()` 是一个 6105 行的 IIFE，780 个顶层声明彼此交错引用，
 * 靠"函数声明提升 + 同一个作用域链"活着。逐件物件手搬（`J3` 的做法）在这里走不通：
 * 每搬一处都要手改引用点，而 `_j4-analyze.mjs` 量出**立即执行的引用有 2190 处**。
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
 * 3. **顶层 `const` / `function` 段内保留原名，段末挂到 `ctx`**。段内代码因此几乎零改动，
 *    跨段引用才走 `ctx`。
 */

/** 段：`hint` 是提示行号（吸附到该行之前最近的顶层语句起点），实际边界由应用器算并写回 */
export const SEGMENTS = [
  // ── 基础设施 ────────────────────────────────────────────────────────────
  { id: 'prelude', hint: 112, module: null, fn: null, note: 'strict / 触屏探测' },
  { id: 'audio', hint: 118, module: 'systems/audio/AudioSystem.js', fn: 'installAudio', note: 'SND 音效池' },
  { id: 'core3d', hint: 139, module: null, fn: null, note: 'scene / camera / renderer / 材质 / 几何 DSL / L' },
  // ── 世界 ────────────────────────────────────────────────────────────────
  { id: 'houseShell', hint: 184, module: null, fn: null, note: '墙 / 屋顶 / 门窗 / 楼梯 / 路牌' },
  { id: 'outdoor', hint: 437, module: null, fn: null, note: '森林 / 草地 / 石头 / 花 / 萤火虫' },
  { id: 'propsTools', hint: 643, module: null, fn: null, note: '圆角几何 / 陈设工具' },
  { id: 'installer', hint: 664, module: null, fn: null, note: 'J3 装配器接线 + 装配环境 ctx' },
  { id: 'floor1', hint: 719, module: null, fn: null, note: '一楼陈设' },
  { id: 'junkBoxes', hint: 1694, module: null, fn: null, note: '楼梯下储物箱' },
  { id: 'floor2', hint: 1741, module: null, fn: null, note: '二楼陈设' },
  // ── 系统 ────────────────────────────────────────────────────────────────
  { id: 'noteEditor', hint: 3384, module: 'systems/ui/editors/NoteEditor.js', fn: 'installNoteEditor', note: '便签编辑器（二楼计划板）' },
  { id: 'chandelier', hint: 3406, module: null, fn: null, note: '二楼顶中央魔法吊灯' },
  { id: 'magic', hint: 3474, module: null, fn: null, note: '超位魔法系统：魔杖 / 24 层阵 / 爆炸' },
  // ── 玩家 ────────────────────────────────────────────────────────────────
  { id: 'collision', hint: 4715, module: null, fn: null, note: '家具平台碰撞体 + collideXZ / groundAt' },
  { id: 'sfxBridge', hint: 4757, module: null, fn: null, note: '音效辅助 + 交互通路接线' },
  { id: 'input', hint: 4795, module: null, fn: null, note: '键鼠 / 摇杆 / 触屏按钮' },
  { id: 'menuUi', hint: 4846, module: 'systems/ui/MenuPanel.js', fn: 'installMenuPanel', note: '菜单面板 + 设置 → 场景 唯一通道' },
  { id: 'playerCtrl', hint: 4884, module: null, fn: null, note: 'updatePlayer / 相机解算 / 史莱姆落地' },
  // ── 天气与主循环 ────────────────────────────────────────────────────────
  { id: 'weather', hint: 4924, module: null, fn: null, note: '天空 / 时间 / 天气 / 星空' },
  { id: 'tick', hint: 5435, module: null, fn: null, note: 'tickOnce：716 行的每帧体' },
  { id: 'boot', hint: 6151, module: null, fn: null, note: 'animate + manual 钩子 + 统计钩子' },
]
