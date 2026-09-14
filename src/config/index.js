/**
 * 配置索引 —— 统一导出
 *
 * 对齐 Firefly 的 `src/config/index.ts`：组件可以一次性导入多个相关配置，减少重复的 import 语句。
 *
 * 推荐用法：
 *   import { siteConfig, modulesConfig } from '@/config'
 *
 * 也可以直接导入单个配置：
 *   import { shelfConfig } from '@/config/shelf.config.js'
 *
 * ⚠️ 当前状态：本目录已按目标架构写就（J2.5 的产物形态），但**消费方尚未实现**——
 *    `cabin/app/store.js`（读取默认值 + 持久化）与 `cabin/systems/ui/SettingsForm.js`
 *    （由 schema 自动生成设置面板）都在 J2 / J2.5 落地。
 *    在它们落地之前，改这里的值**不会有效果**（现状代码仍是 legacy 里的硬编码常量）。
 */

// ── 类型 ────────────────────────────────────────────────────────
// 本项目是 JS（非 TS），所以**不能**写 `export type { … }`（那是 TS 语法，esbuild 会直接报错）。
// 形状声明都在 ./types.js 里以 JSDoc typedef 的形式存在，需要时这样引用：
//
//   /** @type {import('@/config/types.js').ShelfConfig} */
//   /** @param {import('@/config/types.js').SettingSpec} spec */
//
// types.js 是**纯类型文件**：运行时 `export {}`，没有任何实际导出，import 它没有副作用。

// ── 站点与场景 ──────────────────────────────────────────────────
export { siteConfig } from './site.config.js'
export { cabinConfig, VIEW_MODES, QUALITY_LEVELS } from './cabin.config.js'

// ── 模块总开关（决策 5 的核心）───────────────────────────────────
export { modulesConfig } from './modules.config.js'

// ── 内容骨架 ────────────────────────────────────────────────────
export { shelfConfig } from './shelf.config.js'
export { readerConfig } from './reader.config.js'
export { homeConfig } from './home.config.js'

// ── 环境变量覆盖工具（配置文件内部使用，导出以便测试与门禁复用）────
export {
  readEnv,
  resolveBoolean,
  resolveNumber,
  resolveEnum,
  resolveString,
  resolveModules,
  validateModuleToggles,
} from './resolve.js'

// ── 各功能模块的配置 ────────────────────────────────────────────
// 每上线一个模块，在这里加一行（与 modules.config.js 的开关一一对应，验收 CF3）。
//
// export { archiveConfig }     from './archive.config.js'      // M02 时间归档
// export { searchConfig }      from './search.config.js'       // M03a 搜索
// export { randomConfig }      from './random.config.js'       // M03b 随机一篇
// export { taxonomyConfig }    from './taxonomy.config.js'     // M04 主题聚类
// export { authoringConfig }   from './authoring.config.js'    // M05 创作管线
// export { aboutConfig }       from './about.config.js'        // M06 关于本站
// export { profileConfig }     from './profile.config.js'      // M07 名片与导航
// export { commentsConfig }    from './comments.config.js'     // M08 评论互动
// export { sponsorConfig }     from './sponsor.config.js'      // M09 打赏（不映射场景）
// export { galleryConfig }     from './gallery.config.js'      // M10 照片相册
// export { musicConfig }       from './music.config.js'        // M11 音频播放
// export { aggregatorConfig }  from './aggregator.config.js'   // M12 影音收藏
// export { statsConfig }       from './stats.config.js'        // M13 站点统计
// export { trendingConfig }    from './trending.config.js'     // M14 热点榜单
// export { booknavConfig }     from './booknav.config.js'      // M15 收藏导航
// export { fontsConfig }       from './fonts.config.js'        // M16 字体设定
// export { displayConfig }     from './display.config.js'      // M17 显示设定
// export { srsConfig }         from './srs.config.js'          // M18 背单词（SRS）
