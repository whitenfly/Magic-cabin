/**
 * 配置解析工具 —— 环境变量覆盖
 *
 * 对齐 Firefly 的编排方法第 6 条（见 docs/BuildPlaning/04-模块增量开发与配置编排.md §3.1）：
 *   **文件是默认值来源，环境变量优先级更高**；未设置或取值无法识别时用文件里的值。
 *
 * 用途举例：
 *   本地开发：改 site.config.js 的标题
 *   线上部署：Vercel / Cloudflare 设 PUBLIC_MODULES=M01,M02,M03a,M04 —— 不用改任何文件
 *
 * ⚠️ 客户端只注入 `PUBLIC_` 前缀的变量（Vite / Astro 的约定）。
 *    非 PUBLIC_ 的变量只在构建脚本（Node）里可见。
 */

/**
 * 读取一个环境变量（同时兼容 Vite/Astro 的 `import.meta.env` 与 Node 的 `process.env`）。
 * @param {string} name
 * @returns {string | undefined}
 */
export function readEnv(name) {
  try {
    const env = import.meta?.env
    if (env && env[name] !== undefined && env[name] !== null) return String(env[name])
  } catch {
    /* 非 Vite 环境：忽略 */
  }
  try {
    if (typeof process !== 'undefined' && process.env && process.env[name] !== undefined) {
      return String(process.env[name])
    }
  } catch {
    /* 浏览器：忽略 */
  }
  return undefined
}

/** 取值视为 true 的字面量 */
const TRUTHY = new Set(['true', '1', 'on', 'yes'])
/** 取值视为 false 的字面量 */
const FALSY = new Set(['false', '0', 'off', 'no'])

/**
 * 布尔覆盖。
 * @param {string} name 环境变量名
 * @param {boolean} fallback 文件里的默认值
 * @returns {boolean}
 */
export function resolveBoolean(name, fallback) {
  const raw = readEnv(name)
  if (raw === undefined) return fallback
  const v = raw.trim().toLowerCase()
  if (TRUTHY.has(v)) return true
  if (FALSY.has(v)) return false
  return fallback
}

/**
 * 数值覆盖（非法值回落到默认值）。
 * @param {string} name
 * @param {number} fallback
 * @returns {number}
 */
export function resolveNumber(name, fallback) {
  const raw = readEnv(name)
  if (raw === undefined) return fallback
  const n = Number(raw)
  return Number.isFinite(n) ? n : fallback
}

/**
 * 枚举覆盖（不在白名单内则回落到默认值）。
 * @template {string} T
 * @param {string} name
 * @param {readonly T[]} values
 * @param {T} fallback
 * @returns {T}
 */
export function resolveEnum(name, values, fallback) {
  const raw = readEnv(name)
  if (raw === undefined) return fallback
  const v = raw.trim()
  return /** @type {T} */ (values.includes(/** @type {T} */ (v)) ? v : fallback)
}

/**
 * 字符串覆盖（空串视为未设置）。
 * @param {string} name
 * @param {string} fallback
 * @returns {string}
 */
export function resolveString(name, fallback) {
  const raw = readEnv(name)
  return raw === undefined || raw.trim() === '' ? fallback : raw
}

/**
 * ★ 模块总开关覆盖（决策 5 的核心）。
 *
 * `PUBLIC_MODULES=M01,M02,M03a,M04`
 *   → **白名单语义**：列出的模块启用，其余一律关闭。
 *     适合"线上只发布某几个模块"的场景。
 * `PUBLIC_MODULES` 未设置
 *   → 使用 `modules.config.js` 里写死的开关，一个都不改。
 *
 * @param {Record<string, boolean>} toggles 文件里的默认开关
 * @returns {Record<string, boolean>}
 */
export function resolveModules(toggles) {
  const raw = readEnv('PUBLIC_MODULES')
  if (raw === undefined || raw.trim() === '') return { ...toggles }

  const enabled = new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  )
  /** @type {Record<string, boolean>} */
  const out = {}
  for (const id of Object.keys(toggles)) out[id] = enabled.has(id)
  return out
}

/**
 * 校验模块开关表与 `docs/BuildPlaning/mapping.yaml` 的 id 集合是否一致。
 *
 * 由 J2.5 的构建门禁调用（验收 CF3 / 风险 R30）：不一致即**构建失败**，
 * 防止"加了模块忘了配置"或"删了配置模块还在"这类漂移。
 *
 * @param {Record<string, boolean>} toggles
 * @param {string[]} mappingIds mapping.yaml 里的全部模块 id
 * @returns {{ ok: boolean, missing: string[], extra: string[] }}
 */
export function validateModuleToggles(toggles, mappingIds) {
  const a = new Set(Object.keys(toggles))
  const b = new Set(mappingIds)
  return {
    ok: a.size === b.size && [...a].every((x) => b.has(x)),
    missing: [...b].filter((x) => !a.has(x)),
    extra: [...a].filter((x) => !b.has(x)),
  }
}
