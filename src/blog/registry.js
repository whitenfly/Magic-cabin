/**
 * 功能模块装配 —— 按 `modules.config.js` 的开关过滤后逐个装配
 *
 * 来源：新增（`J2.5` 配置编排层）。它把"关掉一个模块"从一个口号变成三段真实行为
 * （对齐 Firefly 的 `siteConfig.pages.*`，验收 `BB3` / `CF1`）：
 *
 * | 层面 | 关闭后发生什么 | 实现处 |
 * |---|---|---|
 * | **加载侧** | 它的 `features/<id>/**` **不被 import、不被下载** | 本文件的 `load()` 是 thunk，未启用就**根本不调用** |
 * | **场景侧** | 它的 `interactable` 不注册，物品恢复纯装饰 | 本文件不 `register` → 它的 `setup()` 不会跑 |
 * | **站点侧** | 它的页面 / 面板不生成 | Astro 页面在 `getStaticPaths()` 里读同一个 `modulesConfig` |
 *
 * ## 为什么清单由调用方注入（而不是本文件 import `features/_index.js`）
 *
 * `src/blog/README.md` §2 的依赖规则写明 **`blog/**` 不得 import `features/**`**
 * —— 内核不该依赖任何一个模块。所以 `features/_index.js` 由 `cabin/boot.js`
 * （唯一同时认识"内核"与"实现"的地方）读进来交给本文件，本文件只负责**过滤与装配**。
 * 副作用是它变成了纯函数式的编排逻辑，可以直接单测（不需要真的存在 features 目录）。
 *
 * ## 开关表缺项 = 报错，不是"默认关闭"
 *
 * `modules.config.js` 的键必须覆盖清单里的每一个 `id`。少了就抛错 ——
 * 这正是 `04` §3.2 的规则 4「可缺省即失败」（对应风险 `R30` 的漂移）。
 * 若这里静默按 `false` 处理，一个拼错的模块 id 会表现为"模块神秘消失"而不是构建失败。
 */
import { modulesConfig } from '../config/modules.config.js'

/** 未启用模块的交互被触发时，给用户的一句话（验收 `BB3`） */
export function notEnabledHint(label) {
  return `「${label}」还没启用 —— 在 src/config/modules.config.js 里打开它`
}

/**
 * 按开关表过滤并装配功能模块。
 *
 * @param {object} app `createApp()` 的产物（需要 `register(feature)`）
 * @param {object} options
 * @param {{ id: string, load: () => Promise<any> }[]} options.manifests 模块清单（`features/_index.js`）
 * @param {Record<string, boolean>} [options.config] 开关表（默认读 `src/config/modules.config.js`）
 * @param {(msg: string) => void} [options.log] 诊断出口
 * @returns {Promise<{ enabled: string[], disabled: string[], failed: { id: string, error: string }[] }>}
 */
export async function registerFeatures(app, options = {}) {
  const { manifests, config = modulesConfig, log = () => {} } = options
  if (!app || typeof app.register !== 'function') throw new TypeError('registerFeatures 需要 App 实例')
  if (!Array.isArray(manifests)) throw new TypeError('registerFeatures 需要 manifests 数组')

  // ① 清单里的每个 id 都必须在开关表里有位置（缺失即失败，见文件头）
  const unknown = manifests.filter((m) => !Object.prototype.hasOwnProperty.call(config, m.id)).map((m) => m.id)
  if (unknown.length) {
    throw new Error(
      `模块清单里的 id 在 src/config/modules.config.js 里没有开关：${unknown.join(' / ')}` +
        ` —— 每个模块必须恰好有一个开关（验收 CF3）`,
    )
  }

  const enabled = []
  const disabled = []
  const failed = []

  // ② 逐个装配。★ 关键：只有启用的才 `await load()` ——
  //    未启用模块的 chunk 因此**不会被浏览器请求**（这是"关闭即不下载"的实现方式）。
  for (const manifest of manifests) {
    if (!config[manifest.id]) {
      disabled.push(manifest.id)
      continue
    }
    try {
      const mod = await manifest.load()
      const feature = mod?.default ?? mod
      app.register(feature)
      enabled.push(manifest.id)
    } catch (err) {
      // 单个模块坏掉不该让整局小屋起不来：如实记录，其余模块继续。
      failed.push({ id: manifest.id, error: err?.message || String(err) })
      log(`[registry] 模块 ${manifest.id} 装配失败：${err?.message || err}`)
    }
  }

  log(
    `[registry] 已启用 ${enabled.length} 个模块${enabled.length ? `（${enabled.join(' / ')}）` : ''}` +
      `${disabled.length ? `；已关闭 ${disabled.length} 个（${disabled.join(' / ')}）` : ''}`,
  )
  return { enabled, disabled, failed }
}
