/**
 * 显示设定（模块 `M17`）—— 决定"设置面板呈现什么"
 *
 * 对应 Firefly 的 `displaySettingsConfig`（编排方法 F8 / F9）：
 * **配置文件决定哪些项对用户可见，面板负责运行时的值**。两者的分工是：
 *
 * ```
 *   src/config/settings.config.js   ← 每一项的默认值、范围、控件形态（"能调什么"）
 *   src/config/display.config.js    ← 面板本身开不开、哪些分组显示（"看得见什么"）
 *   localStorage（cabin: 前缀）      ← 用户实际拖出来的值（"现在是多少"）
 * ```
 *
 * 一个分组置 `false` 后，它的控件**不生成**（不是隐藏）——
 * 对应项在 `store` 里仍然存在且仍用配置里的默认值，只是用户看不到旋钮。
 * 这与 Firefly 的 `displaySettingsConfig.panels.*` 语义一致。
 *
 * 对应实现：`cabin/systems/ui/SettingsForm.js`（`J2.5`）
 */
import { resolveBoolean } from './resolve.js'

/** @type {import('./types.js').DisplayConfig} */
export const displayConfig = {
  // ── 总开关 ────────────────────────────────────────────────────

  // 设置面板的总开关。关闭后菜单里不出现「设 置」分区，面板相关代码不被请求
  // （对齐 Firefly 的 `displaySettingsConfig.enable`：关掉即不为它付出体积）
  enable: resolveBoolean('PUBLIC_SETTINGS_PANEL', true),

  // ── 分组可见性 ────────────────────────────────────────────────
  // 键必须与 settings.config.js 里各项的 `group` 一一对应（验收 CF3 会检查）。
  // 置 false = 该分组的控件不生成；对应设置项仍在 store 里，只用默认值。
  panels: {
    view: true, // 视角（固定 / 第三人称 / 第一人称）
    house: true, // 房屋形态（剖切 / 完整）
    weather: true, // 天气（随机切换）
    time: true, // 时间（流速；时刻由时间滑杆单独控制，不是持久化设置）
    audio: true, // 音效（开关 + 音量）
  },

  // ── 面板形态 ──────────────────────────────────────────────────

  // 面板是否随菜单一起展开。false 时只在菜单里放一个「设 置」按钮，点开才是独立面板
  inlineInMenu: true,

  // 是否显示「恢复默认」按钮（一项一项调乱之后一键回到 config 里的默认值）
  showReset: true,

  // ── 隐藏项（★ 过渡期的显式清单，不是黑名单）────────────────────
  // 列在这里的键**不生成面板控件**，但仍在 store 里生效。
  // 用途：某项暂时由别处（如菜单里手写的滑杆）呈现，避免同一项出现两个旋钮。
  // ⚠️ 每一项都必须写清"为什么"与"什么时候移除"，否则它会变成永久的隐形配置。
  hidden: {
    // 时刻（`gameSec`）不是持久化设置：它是"当前几点"，由时间滑杆实时拖，
    // 刷新后应当回到场景初始时刻而不是上次拖到的位置。因此它不在 settings.config.js 里，
    // 本清单留空作为格式示范。
  },
}
