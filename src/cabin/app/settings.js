/**
 * 设置项定义 —— "用户能调什么"的唯一清单
 *
 * 来源：新增（`J2.8`）。搬迁前这些值散落在各处且**零持久化**（风险 `R4`）：
 * 音量在 `SND` 闭包里、视角在 `viewMode`、小屋形态在 `fullHouse`、时间流速在 `timeScale`，
 * 刷新即回到初始值，用户每次进小屋都要重调一遍。
 *
 * ## 这份清单的三个用途
 *
 * 1. **`store` 的默认值来源**：`store.get('view.mode')` 没存过时取这里的 `default`；
 * 2. **校验与钳制**：`number` 会被 `min`/`max` 夹住，`enum` 只接受 `values` 里的值
 *    —— 手工改过 `localStorage` 的脏数据不会把场景搞坏；
 * 3. **`SettingsForm` 的生成源**（子阶段 `J2.5` 配置编排层）：面板控件由 `type` 自动生成，
 *    不手写表单（验收 `CF1`–`CF4`）。
 *
 * ## 命名约定
 *
 * `键` 用 `<域>.<项>` 的两段式：域是 `audio` / `view` / `house` / `time`。
 * `store` 实际写进 `localStorage` 的键是 `cabin:` 前缀 + 这个键（如 `cabin:view.mode`）。
 *
 * ⚠️ **改这里的 `default` 就等于改画面**（`?deterministic=1` 下读的就是它）——
 * 必须同时重跑像素回归。
 */

/** 控件类型 → `SettingsForm` 该生成什么（子阶段 `J2.5` 用） */
export const SETTING_TYPES = ['number', 'boolean', 'enum']

/**
 * @type {{
 *   key: string, type: 'number'|'boolean'|'enum', default: any, label: string,
 *   min?: number, max?: number, step?: number, values?: string[], valueLabels?: Record<string,string>,
 *   hint?: string,
 * }[]}
 */
export const SETTINGS = [
  {
    key: 'audio.enabled',
    type: 'boolean',
    default: true,
    label: '音效',
    hint: '门、窗、炉火、施法等音效的总开关',
  },
  {
    key: 'audio.volume',
    type: 'number',
    default: 0.6,
    min: 0,
    max: 1,
    step: 0.05,
    label: '音量',
  },
  {
    key: 'view.mode',
    type: 'enum',
    values: ['fixed', 'tp', 'fp'],
    valueLabels: { fixed: '固定视角', tp: '第三人称', fp: '第一人称' },
    default: 'fixed',
    label: '视角',
    hint: '固定视角适合看陈设与点选物件；第一人称适合走进去看',
  },
  {
    key: 'house.full',
    type: 'boolean',
    default: false,
    label: '完整小屋',
    hint: '关闭时是剖切模式：省略的墙与屋顶用虚线表示，便于从外面看到室内',
  },
  {
    key: 'time.scale',
    type: 'number',
    default: 60,
    min: 0,
    max: 600,
    step: 10,
    label: '时间流速',
    hint: '游戏内秒数相对真实秒数的倍率；0 = 时间静止',
  },
]

/** `key → 定义` 的快查表 */
export const SETTINGS_BY_KEY = new Map(SETTINGS.map((s) => [s.key, s]))

/** 只取默认值组成一份初始状态 */
export function defaultSettings() {
  const out = {}
  for (const s of SETTINGS) out[s.key] = s.default
  return out
}

/**
 * 按定义校验并钳制一个值。
 *
 * @returns {{ ok: true, value: any } | { ok: false, reason: string }}
 */
export function coerceSetting(key, value) {
  const def = SETTINGS_BY_KEY.get(key)
  if (!def) return { ok: false, reason: `未知设置项：${key}` }
  switch (def.type) {
    case 'boolean':
      if (typeof value !== 'boolean') return { ok: false, reason: `${key} 需要布尔值` }
      return { ok: true, value }
    case 'number': {
      const n = typeof value === 'number' ? value : Number(value)
      if (!Number.isFinite(n)) return { ok: false, reason: `${key} 需要数字` }
      const clamped = Math.min(def.max ?? Infinity, Math.max(def.min ?? -Infinity, n))
      return { ok: true, value: clamped }
    }
    case 'enum':
      if (!def.values.includes(value)) return { ok: false, reason: `${key} 只接受 ${def.values.join(' / ')}` }
      return { ok: true, value }
    default:
      return { ok: false, reason: `${key} 的类型 ${def.type} 未知` }
  }
}
