/**
 * ★ 运行时设置面板 —— schema 真源（决策 5 / 验收 `CF2`）
 *
 * 这一份对象是"**用户能在面板里调什么**"的**唯一清单**。改这里一个字段，
 * `cabin/systems/ui/SettingsForm.js` 就会自动生成对应控件并自动持久化
 * —— **不需要动 HTML、CSS 或事件绑定**（这就是验收 `CF2` 的内容）。
 *
 * ## 三件事由它同时决定
 *
 * | 用途 | 读它的地方 |
 * |---|---|
 * | ① `store` 的默认值（没存过任何值时用什么） | `cabin/app/settings.js` → `cabin/app/store.js` |
 * | ② 取值范围与校验（脏数据钳制 / 拒绝） | `cabin/app/settings.js` 的 `coerceSetting()` |
 * | ③ 面板控件长什么样（滑块 / 开关 / 按钮组） | `cabin/systems/ui/SettingsForm.js` |
 *
 * ## 一模块一文件（方法 F1）
 *
 * 本文件管的是**小屋自身的运行时设置**（视角 / 房屋 / 时间 / 天气 / 音效）。
 * 每个功能模块（`M02`…`M18`）自己的可调项写进它自己的 `src/config/<短名>.config.js`，
 * 需要出现在面板里时**再往这里加一项**（走 `04` §2 的 S2）。
 *
 * ## 字段说明（新增一项时要写全）
 *
 * | 字段 | 必填 | 含义 |
 * |---|---|---|
 * | `type` | ✅ | `boolean` → 开关；`number` → 滑块；`enum` → 按钮组 |
 * | `default` | ✅ | **没存过时的值**。改了它就等于改首屏画面，必须重跑像素回归 |
 * | `group` | ✅ | 面板分组 id，取值见 `display.config.js` 的 `panels` |
 * | `label` | ✅ | 控件上显示的中文标签 |
 * | `hint` | — | 一行说明，显示为 `title` 提示（**写"改了会怎样"**，方法 F5） |
 * | `min`/`max`/`step` | `number` 必填 | 滑块范围与步长；`store` 也按它钳制 |
 * | `values`/`valueLabels` | `enum` 必填 | 可选值（英文/内部值）与它们的中文标签 |
 * | `slider.toValue`/`fromValue` | — | 非线性映射：滑块位置 ↔ 实际值（见 `time.scale`） |
 * | `domId`/`domIds` | — | ⚠️ **迁移期兼容字段**，见下 |
 *
 * ## ⚠️ `domId` 为什么存在（以及什么时候删掉它）
 *
 * `cabin/legacy/monolith.js` 现在还直接 `getElementById('houseToggle')` 取节点。
 * `J2.5` 把控件交给 schema 生成之后，为了让那 9000 行搬迁期代码**一行不改**，
 * 生成出来的控件沿用原来的 id。
 *
 * `J4`（系统模块化）把 `ui` 搬完、`legacy/` 删除之后，这些字段应当**全部移除** ——
 * 那时不会再有任何代码按 id 找控件（谁控制视觉状态，谁就持有元素引用）。
 *
 * ## 环境变量覆盖
 *
 * 每一项都可以用 `PUBLIC_<大写下划线键名>` 覆盖默认值，例如
 * `PUBLIC_VIEW_MODE=fp`、`PUBLIC_AUDIO_VOLUME=0.3`（方法 F6，部署时无需改文件）。
 */
import { resolveBoolean, resolveEnum, resolveNumber } from './resolve.js'
import { cabinConfig, VIEW_MODES } from './cabin.config.js'

/**
 * 时间流速的**滑块曲线**（从 `monolith.js` 的 `sliderToScale()` 原样移植，公式一字未改）。
 *
 * 为什么需要曲线：0 → 3600 倍是 3 个数量级，线性滑块会让 1×–60× 这段最常用的区间
 * 挤在最左边 1.7% 的行程里。原实现的处理是"前半个滑块走 0–60×，后半个走 60×–3600×"。
 *
 * | 滑块位置 | 时间倍率 |
 * |---|---|
 * | `0` | `0`（时间静止） |
 * | `0.5` | `60`（现实 1 秒 = 游戏 1 分钟，默认值） |
 * | `1` | `3600`（现实 1 秒 = 游戏 1 小时） |
 *
 * @type {{ toValue: (pos: number) => number, fromValue: (v: number) => number }}
 */
export const TIME_SCALE_CURVE = {
  /** 滑块位置（0–1）→ 时间倍率（游戏秒 / 真实秒） */
  toValue(v) {
    if (v <= 0) return 0
    if (v <= 0.5) return v * 120
    return 60 + (v - 0.5) * 2 * (3600 - 60)
  },
  /** 时间倍率 → 滑块位置（`toValue` 的逆函数；用于把已存的值还原到滑块上） */
  fromValue(s) {
    if (s <= 0) return 0
    if (s <= 60) return s / 120
    return 0.5 + (s - 60) / (2 * (3600 - 60))
  },
}

/**
 * ★ 设置面板的 schema。
 *
 * 键 = `store` 的键（写进 `localStorage` 时是 `cabin:` + 键，如 `cabin:view.mode`）。
 * 用 `<域>.<项>` 的两段式；域目前有 `view` / `house` / `time` / `weather` / `audio`。
 *
 * @type {Record<string, import('./types.js').SettingSpec>}
 */
export const settingsSchema = {
  // ── 视 角 ──────────────────────────────────────────────────────
  'view.mode': {
    type: 'enum',
    values: VIEW_MODES,
    valueLabels: { fixed: '固定视角', tp: '第三人称', fp: '第一人称' },
    default: resolveEnum('PUBLIC_VIEW_MODE', VIEW_MODES, cabinConfig.defaultViewMode),
    group: 'view',
    label: '视角',
    hint: '固定视角适合看陈设与点选物件；第一人称适合走进去看',
    // 迁移期兼容：三个按钮沿用菜单里原来的 id（J4 删）
    domIds: { fixed: 'viewFixedBtn', tp: 'viewTpBtn', fp: 'viewFpBtn' },
  },

  // ── 房 屋 ──────────────────────────────────────────────────────
  'house.full': {
    type: 'boolean',
    default: resolveBoolean('PUBLIC_HOUSE_FULL', false),
    group: 'house',
    label: '完整房屋',
    hint: '关闭时是剖切模式：省略的墙与屋顶用虚线表示，便于从外面看到室内',
    domId: 'houseToggle',
  },

  // ── 时 间 ──────────────────────────────────────────────────────
  'time.scale': {
    type: 'number',
    min: 0,
    max: 3600,
    step: 10,
    // 单位是"游戏秒 / 真实秒"：60 表示现实 1 秒过去，小屋里过了 1 分钟
    default: resolveNumber('PUBLIC_TIME_SCALE', cabinConfig.time.scale),
    group: 'time',
    label: '流速',
    hint: '时间流速：0 = 静止，60 = 现实 1 秒等于游戏 1 分钟，3600 = 1 秒等于 1 小时',
    // 非线性滑块：面板上拖的是 0–1 的位置，存下来的是倍率（见 TIME_SCALE_CURVE）
    slider: { min: 0, max: 1, step: 0.01, toValue: TIME_SCALE_CURVE.toValue, fromValue: TIME_SCALE_CURVE.fromValue },
    domId: 'speedSlider',
  },

  // ── 天 气 ──────────────────────────────────────────────────────
  'weather.random': {
    type: 'boolean',
    default: resolveBoolean('PUBLIC_WEATHER_RANDOM', false),
    group: 'weather',
    label: '随机切换天气',
    hint: '开启后每隔十几秒自动换一种天气；关掉则一直停在手选的那一种',
    domId: 'wxRandToggle',
  },

  // ── 音 效 ──────────────────────────────────────────────────────
  'audio.enabled': {
    type: 'boolean',
    default: resolveBoolean('PUBLIC_AUDIO_ENABLED', true),
    group: 'audio',
    label: '音效',
    hint: '门、窗、炉火、施法等音效的总开关',
    domId: 'sfxToggle',
  },
  'audio.volume': {
    type: 'number',
    min: 0,
    max: 1,
    step: 0.01,
    default: resolveNumber('PUBLIC_AUDIO_VOLUME', 0.6),
    group: 'audio',
    label: '音量',
    hint: '0 = 静音，1 = 最大',
    domId: 'sfxSlider',
  },
}

/**
 * 分组显示名与**面板里的顺序**（`display.config.js` 的 `panels` 控制可见性）。
 * 用中文全角空格分隔两字，与菜单里既有的「房 屋」「天 气」排版一致。
 *
 * @type {Record<string, string>}
 */
export const SETTING_GROUPS = {
  view: '视 角',
  house: '房 屋',
  weather: '天 气',
  time: '时 间',
  audio: '音 效',
}

/** 控件的三种形态（`SettingsForm` 按它选渲染方式） */
export const SETTING_TYPES = /** @type {const} */ (['boolean', 'number', 'enum'])
