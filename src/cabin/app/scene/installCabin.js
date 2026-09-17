/**
 * 安装小屋 —— 原来的 `installCabin()` 骨架（`J4.7` 起）
 *
 * 来源：从 `legacy/monolith.js` 搬出（`J4.7`）。**这个文件是 `legacy/` 的最后一站**：
 * `J4` 把 6217 行的巨函数按 21 个段切开（段表见 `scripts/oneoff/_j4-segments.mjs`），
 * 逐段剪进各自的模块；剪完之后这里只剩下"造 `ctx` + 按顺序调用 21 段"。
 *
 * ## 段序 = 执行序（这一节是这个文件存在的全部理由）
 *
 * 原来 `installCabin()` 是一个 6105 行的 IIFE，从上往下跑。现在它变成 21 次调用，
 * **顺序一个都不能换**：
 *
 * | 被顺序决定的东西 | 由哪几段决定 |
 * |---|---|
 * | 种子随机（`rng`）的调用序列 | `houseShell` → `outdoor` → `floor1` → `floor2` |
 * | `scene.children` 的构成与顺序 | `core3d` → `houseShell` → `outdoor` → … |
 * | `LightField` 的 8 个光源槽位（shader 相位含 `float(i)`） | `core3d` 段末尾的 `lightField.register` |
 * | 交互命中集合（`magicMeshes`）的优先级 | `installer` → `floor1` → `floor2`（装配顺序） |
 * | 帧任务的登记顺序 | `tick` 段（`app/scene/FrameBody.js`） |
 *
 * 判据不是"读代码觉得对"，而是 `tests/visual/compare.mjs` 的**三机位 sha256 逐字节相同**。
 *
 * ## `ctx` 是什么
 *
 * 段与段之间**唯一**的通信载体（`Object.create(null)`，没有任何原型）。
 * 段内顶层 `let` 都住在这里；段内顶层 `const`/`function` 在段内导出到它。
 * 详见 `_j4-segments.mjs` 的文件头。
 *
 * @param {object} app `createApp()` 的产物（`registry` / `bus` / `scheduler` / `store` / `mounts`）
 */
import { clock } from '../clock.js'
import { installEnv } from './Env.js'
import { installSceneCore } from './SceneCore.js'
import { installWorldLights } from '../../world/lights.js'
import { installPropTools } from '../../core/geometry/propTools.js'
import { installPropInstaller } from './PropInstaller.js'
import { installHouseShell } from '../../world/house/shell.js'
import { installOutdoorYardStatic } from '../../world/outdoor/yardStatic.js'
import { installOutdoorFireflies } from '../../world/outdoor/fireflies.js'
import { installFloor1 } from '../../world/floor1/install.js'
import { installJunkBoxes } from '../../world/floor1/junkBoxes.js'
import { installFloor2 } from '../../world/floor2/install.js'
import { installChandelier } from '../../world/floor2/chandelier.js'
import { installAudio } from '../../systems/audio/AudioSystem.js'
import { installMagicSystem } from '../../systems/magic/MagicSystem.js'
import { installCollision } from '../../systems/player/collision.js'
import { installInteractionBridge } from '../../systems/interaction/Bridge.js'
import { installInput } from '../../systems/player/Input.js'
import { installMenuPanel } from '../../systems/ui/MenuPanel.js'
import { installPlayerController } from '../../systems/player/PlayerController.js'
import { installWeatherSystem } from '../../systems/weather/WeatherSystem.js'
import { installFrameBody } from './FrameBody.js'
import { installSceneLoop } from './SceneLoop.js'

export function installCabin(app) {
  /* __J4_CTX__ ★ J4 段间通信的唯一载体（段表见 scripts/oneoff/_j4-segments.mjs）。
     段内顶层 let 都住在这里；段内顶层 const/function 在段内导出到它。
     段序 = 执行序（rng 调用顺序 / scene.add 顺序 / 光源槽序都由它决定）。 */
  const ctx = Object.create(null)

  // ── 段 01–03：环境探测 / 音效池 / 场景核心 ──────────────────────────────
  installEnv(ctx, app)
  installAudio(ctx, app)
  installSceneCore(ctx, app)
  installWorldLights(ctx, app)
  // ── 段 04–07：房屋外壳 / 室外（静态陈设 + 萤火虫两件） / 陈设工具 / 物件装配器 ──
  installHouseShell(ctx, app)
  installOutdoorYardStatic(ctx, app)
  installOutdoorFireflies(ctx, app)
  installPropTools(ctx, app)
  installPropInstaller(ctx, app)
  // ── 段 08–10：一楼 / 楼梯下储物箱 / 二楼 ────────────────────────────────
  installFloor1(ctx, app)
  installJunkBoxes(ctx, app)
  installFloor2(ctx, app)
  // ── 段 11–13：魔法吊灯 / 超位魔法系统 ────────────────────────────────
  // ★ J4.43：原来的 `installNoteEditor(ctx, app)`（段 11）**已删除** —— 便签编辑器
  //   按 J4.42 §2 的裁决**整体归物件**：`applyNote` + 两个 DOM 监听已搬进
  //   `world/floor2/board.js` 的 `build` 闭包，`systems/ui/editors/NoteEditor.js` 文件已删除。
  //   ★ J4.51：原来 `installFloor2` 里的 `ctx.noteInput = boardApi.parts.noteInput;`
  //   （唯一一处跨层豁免）**也已删除** —— 系统层改用统一判据 `ctx.isTypingTarget()`。
  installChandelier(ctx, app)
  installMagicSystem(ctx, app)
  // ── 段 14–18：碰撞 / 交互通路 / 输入 / 菜单面板 / 玩家控制 ──────────────
  installCollision(ctx, app)
  installInteractionBridge(ctx, app)
  installInput(ctx, app)
  installMenuPanel(ctx, app)
  installPlayerController(ctx, app)
  // ── 段 19：天空 · 时间 · 天气 · 星空 ────────────────────────────────────
  installWeatherSystem(ctx, app)
  // ── 段 20：每帧任务（原 tickOnce() 的 719 行 → 102 个调度器任务）─────────
  installFrameBody(ctx, app)
  /** ★ `J4.7` 的 DoD：**`animate()` 收缩为调度骨架**。
   *  它只调这一个函数，而"这一帧跑什么、按什么顺序"由 `UpdateScheduler` 的
   *  **登记顺序**决定（登记顺序 = 原 `tickOnce()` 的执行顺序，见 `FrameBody.js`）。
   *  25 处原地 `.tick(dt, time)` 已全部变成调度器任务 —— `legacy/monolith.js` 里一处不剩。 */
  function tickOnce() { app.scheduler.update(clock.dt, clock.now) }
  ctx.tickOnce = tickOnce
  // ── 段 21：主循环 / manual 钩子 / 渲染统计钩子 ──────────────────────────
  installSceneLoop(ctx, app)
}
