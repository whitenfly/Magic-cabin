/**
 * 设置项定义 —— "用户能调什么"的唯一清单
 *
 * 来源：新增（`J2.8`）。搬迁前这些值散落在各处且**零持久化**（风险 `R4`）：
 * 音量在 `SND` 闭包里、视角在 `viewMode`、小屋形态在 `fullHouse`、时间流速在 `timeScale`，
 * 刷新即回到初始值，用户每次进小屋都要重调一遍。
 *
 * ## `J2.5` 起：本文件不再自己写死清单
 *
 * 设置的**真源**搬到了 [`src/config/settings.config.js`](../../config/settings.config.js)
 * （决策 5：用户唯一需要看的目录是 `src/config/`）。本文件退化成一层**薄适配**：
 *
 * ```
 *   src/config/settings.config.js   ← 真源：类型 / 默认值 / 范围 / 分组 / 控件形态
 *            │  派生
 *            ▼
 *   cabin/app/settings.js           ← 本文件：数组形态 + 校验钳制（store 与单测的入口）
 * ```
 *
 * 为什么还要这一层：`store` 与既有单测都按**数组**遍历（`for (const def of SETTINGS)`），
 * 而 schema 用**对象**（键即 `store` 的键，可读性更好、增删一项不会错位）。
 * 两种形态各有各的用处，转换放在这里，不必让两边互相妥协。
 *
 * ## 三个用途（与搬迁前一致，调用方无感）
 *
 * 1. **`store` 的默认值来源**：`store.get('view.mode')` 没存过时取 schema 里的 `default`；
 * 2. **校验与钳制**：`number` 会被 `min`/`max` 夹住，`enum` 只接受 `values` 里的值
 *    —— 手工改过 `localStorage` 的脏数据不会把场景搞坏；
 * 3. **`SettingsForm` 的生成源**（子阶段 `J2.5` 配置编排层）：面板控件由 `type` 自动生成，
 *    不手写表单（验收 `CF1`–`CF4`）。
 *
 * ## 命名约定
 *
 * 键用 `<域>.<项>` 的两段式：域是 `view` / `house` / `time` / `weather` / `audio`。
 * `store` 实际写进 `localStorage` 的键是 `cabin:` 前缀 + 这个键（如 `cabin:view.mode`）。
 *
 * ⚠️ **改默认值就等于改画面**（`?deterministic=1` 下读的就是它）——
 * 必须同时重跑像素回归。默认值现在写在 `src/config/settings.config.js` 里。
 */
import { settingsSchema, SETTING_TYPES } from '../../config/settings.config.js'

/** 控件类型 → `SettingsForm` 该生成什么（`J2.5` 用） */
export { SETTING_TYPES }

/**
 * 全部设置项（数组形态，顺序 = `settingsSchema` 的声明顺序）。
 *
 * 每项至少含 `key` / `type` / `default` / `label` / `group`；
 * `number` 另有 `min` / `max` / `step`（或 `slider` 曲线），`enum` 另有 `values` / `valueLabels`。
 *
 * @type {{
 *   key: string, type: 'number'|'boolean'|'enum', default: any, label: string, group: string,
 *   min?: number, max?: number, step?: number, values?: readonly string[],
 *   valueLabels?: Record<string,string>, hint?: string,
 *   slider?: { min: number, max: number, step: number, toValue: (p: number) => number, fromValue: (v: number) => number },
 *   domId?: string, domIds?: Record<string,string>,
 * }[]}
 */
export const SETTINGS = Object.entries(settingsSchema).map(([key, spec]) => ({ key, ...spec }))

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
