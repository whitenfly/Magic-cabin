/**
 * 功能模块装配清单 —— ★ 唯一总装文件
 *
 * ── 怎么用 ────────────────────────────────────────────────────────────────
 * 加一个功能模块 = 在这里**加一行**（其余动作走 04 §2 的九步 SOP）。
 * 每个条目的 `load` 是**动态 import 的 thunk**：`blog/registry.js` 会先按
 * `src/config/modules.config.js` 过滤，只对**启用**的模块调用 `load()`。
 *
 * 为什么用 thunk 而不是静态 `import`：
 *   静态 import 会把模块无条件打进产物；thunk 让被关闭的模块
 *   **既不注册、也不下载**（对齐 Firefly 的 siteConfig.pages.* = 关闭即不产出，
 *   见 docs/BuildPlaning/04-模块增量开发与配置编排.md §3.4）。
 *
 * ── 消费方 ────────────────────────────────────────────────────────────────
 *   src/blog/registry.js
 *     for (const m of moduleManifests)
 *       if (modulesConfig[m.id]) register(await m.load(), ctx)
 *
 * ── 契约 ──────────────────────────────────────────────────────────────────
 * 每个模块的 `index.js` 默认导出（详见 src/features/README.md §2）：
 *   {
 *     id: 'M04',                    // 必须与 mapping.yaml 的 id 一致
 *     requires?: string[],          // 依赖的其他模块 id（App 据此拓扑排序）
 *     order?: number,               // 每帧更新顺序（越小越早）
 *     settings?: Record<string, SettingSpec>,   // 自动进入设置面板并持久化
 *     mount(ctx): void | Promise<void>,         // 认领挂载点、注册 interactable、订阅更新
 *     dispose?(): void,
 *   }
 *
 * ── 当前状态 ──────────────────────────────────────────────────────────────
 * ⬜ 空清单。第一个模块 `M01`（内容存档 / 书架 + 阅读器）随 J6 落地，
 *    见 docs/BuildPlaning/01-完善路线图.md §3 的 J6。
 *
 * ⚠️ 这里只登记**已进入实现**的模块。模块的映射（承载物品 / 交互 / 呈现通道 /
 *    状态 / 批次 / 依赖）一律记在 docs/BuildPlaning/mapping.yaml，不要复制到本文件。
 */

/** @typedef {{ id: string, load: () => Promise<unknown> }} ModuleManifest */

/** @type {ModuleManifest[]} */
export const moduleManifests = [
  // ── P1 内容骨架 ────────────────────────────────────────────────
  // { id: 'M01',  load: () => import('./01-posts/index.js') },

  // ── P2 内容发现 ────────────────────────────────────────────────
  // { id: 'M02',  load: () => import('./02-archive/index.js') },
  // { id: 'M03a', load: () => import('./03a-search/index.js') },
  // { id: 'M03b', load: () => import('./03b-random/index.js') },
  // { id: 'M04',  load: () => import('./04-taxonomy/index.js') },

  // ── P3 社交面 ──────────────────────────────────────────────────
  // { id: 'M07',  load: () => import('./07-profile/index.js') },
  // { id: 'M08',  load: () => import('./08-community/index.js') },
  // { id: 'M10',  load: () => import('./10-gallery/index.js') },

  // ── P4 氛围与个性化 ────────────────────────────────────────────
  // { id: 'M11',  load: () => import('./11-music/index.js') },
  // { id: 'M13',  load: () => import('./13-stats/index.js') },
  // { id: 'M16',  load: () => import('./16-fonts/index.js') },
  // { id: 'M17',  load: () => import('./17-display/index.js') },

  // ── P5 外部世界 ────────────────────────────────────────────────
  // { id: 'M12',  load: () => import('./12-aggregator/index.js') },
  // { id: 'M14',  load: () => import('./14-trending/index.js') },
  // { id: 'M15',  load: () => import('./15-booknav/index.js') },

  // ── P6 长尾收尾 ────────────────────────────────────────────────
  // { id: 'M05',  load: () => import('./05-authoring/index.js') },
  // { id: 'M06',  load: () => import('./06-about/index.js') },
  // { id: 'M18',  load: () => import('./18-srs/index.js') },

  // 注：M09（打赏）不映射到场景，只在文章页底部保留按钮，因此不在本清单里。
]
