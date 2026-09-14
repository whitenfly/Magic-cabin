/**
 * 3D 场景配置
 *
 * 只放"整个小屋"级别的开关。**单件物件的参数不放这里**（那属于对应模块的配置，
 * 例如书架层规格在 shelf.config.js、书页规格在 reader.config.js）。
 *
 * 对应实现：cabin/app/store.js（状态）+ cabin/systems/ui/SettingsForm.js（面板自动生成）
 */
import { resolveBoolean, resolveEnum, resolveNumber } from './resolve.js'

/** 三种视角（现状代码里是 `let viewMode = 'fixed'`，见原 L8185） */
export const VIEW_MODES = /** @type {const} */ (['fixed', 'tp', 'fp'])

/** 画质档位 */
export const QUALITY_LEVELS = /** @type {const} */ (['low', 'medium', 'high'])

/** @type {import('./types.js').CabinConfig} */
export const cabinConfig = {
  // ── 视角 ────────────────────────────────────────────────────

  // 默认视角。fixed = 固定视角（现状默认，最省操作）；tp = 第三人称；fp = 第一人称
  // ⚠️ 记住风险 R1：固定视角下只有 proximity 条目可用 → 每个模块都必须补近距条目（验收 BB2b）
  defaultViewMode: resolveEnum('PUBLIC_VIEW_MODE', VIEW_MODES, 'fixed'),

  // 固定视角的相机距离（原 fixDist 约 15.7；改小会让屋子更"近"，但会改变现有观感）
  cameraDistance: resolveNumber('PUBLIC_CAMERA_DISTANCE', 15.7),

  // ── 画质 ────────────────────────────────────────────────────

  // 画质档。low：像素比 1 / 天气粒子减半 / 关闭星空与萤火虫；high：全开
  // 低端设备（hardwareConcurrency ≤ 4 或 deviceMemory ≤ 4）会自动落到 low
  quality: resolveEnum('PUBLIC_QUALITY', QUALITY_LEVELS, 'high'),

  // ── 时间与天气 ──────────────────────────────────────────────

  time: {
    // 初始天气类型（7 种：sunny / cloudy / rain / snow / thunder / fog / wind，以 WeatherSystem 为准）
    type: 'sunny',
    // 初始小时（0–24）。10 点 = 上午，暖桌与炉火的光照最平衡
    hour: 10,
    // 时间流速（0 = 冻结，1 = 最快）
    scale: 0.5,
  },

  // ── 启动策略（门厅）────────────────────────────────────────

  // 「门厅」策略（K18）：HTML 先行，3D 在浏览器空闲时挂载
  foyer: {
    // 桌面：preload = 预载 3D；button = 显示"推门进入小屋"按钮由用户触发
    desktop: /** @type {'preload' | 'button'} */ ('preload'),
    // 移动端：默认只读门厅 + 按钮（避免在弱设备上先加载 three 再被用户放弃）
    mobile: /** @type {'preload' | 'button'} */ ('button'),
  },

  // ── 性能与持久化 ────────────────────────────────────────────

  // 阅读文章时挂起渲染循环（移动端推荐开；桌面可关以保留背景 3D）
  suspendWhileReading: resolveBoolean('PUBLIC_SUSPEND_WHILE_READING', true),

  // localStorage 键前缀。现状小屋零持久化，本项为 J2 新增
  // 用途：视角 / 画质 / 天气 / 时间 / 音量 / 阅读进度 —— 刷新后保留（验收 BB17）
  storagePrefix: 'cabin:',
}
