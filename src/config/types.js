/**
 * 配置形状声明（JSDoc typedef）
 *
 * 对齐 Firefly 的编排方法第 2 条（配置与类型分离）：配置文件只导出**数据**，
 * 形状声明集中在这里，供实现与校验共用。
 *
 * 本项目是 JS（`J1` 已按 JS 落地 + `allowJs: true`），因此用 JSDoc 而不是 TypeScript interface；
 * `tsconfig.json` 可按目录逐步打开 `checkJs`。
 *
 * ⚠️ 这里只声明形状，不含任何默认值。默认值一律在各 `*.config.js` 里。
 */

// ─────────────────────────────────────────────────────────────────────────────
// site.config.js
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {object} SiteNavItem
 * @property {string} label 显示文字
 * @property {string} href  站内路径（`/posts/xxx/`）或站外 URL
 * @property {string} [icon] 图标名（由 systems/ui 解析，勿写死 SVG）
 * @property {SiteNavItem[]} [children] 二级菜单
 */

/**
 * @typedef {object} SiteSocialLink
 * @property {string} name  QQ / GitHub / Email / RSS / 友链 …
 * @property {string} url   链接或 `mailto:`
 * @property {string} [color] 覆盖默认色（默认取月光盆栽浆果的紫/蓝交替色）
 */

/**
 * @typedef {object} SiteConfig
 * @property {string} title
 * @property {string} subtitle
 * @property {string} description
 * @property {string} url 站点规范 URL（末尾带 `/`）
 * @property {string} language
 * @property {{ name: string, avatar: string, bio: string }} author
 * @property {string} siteStartDate 站点起始日 `YYYY-MM-DD`（驱动 M13 挂钟的"运行天数"指针）
 * @property {SiteNavItem[]} nav
 * @property {SiteSocialLink[]} social
 * @property {string} footerHtml 允许注入自定义 HTML（备案号等）
 */

// ─────────────────────────────────────────────────────────────────────────────
// cabin.config.js
// ─────────────────────────────────────────────────────────────────────────────

/** @typedef {'fixed' | 'tp' | 'fp'} ViewMode */
/** @typedef {'low' | 'medium' | 'high'} QualityLevel */

/**
 * @typedef {object} CabinConfig
 * @property {ViewMode} defaultViewMode 默认视角（现状为 `fixed`，见原 L8185）
 * @property {number} cameraDistance 固定视角的相机距离
 * @property {QualityLevel} quality 画质档（驱动像素比 / 粒子密度 / 星空与萤火虫开关）
 * @property {{ type: string, hour: number, scale: number }} time 初始天气 / 小时 / 流速
 * @property {{ desktop: 'preload' | 'button', mobile: 'preload' | 'button' }} foyer 门厅策略
 * @property {boolean} suspendWhileReading 阅读时挂起渲染循环（移动端性能优先）
 * @property {string} storagePrefix localStorage 键前缀，避免与其他站点冲突
 */

// ─────────────────────────────────────────────────────────────────────────────
// shelf.config.js
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 一层搁板的可用区间（对应原 L1958–1969 的三个分区）。
 * @typedef {object} ShelfTier
 * @property {number} y   层板顶面高度
 * @property {number} z0  起点（靠门一端）
 * @property {number} z1  终点
 */

/**
 * @typedef {object} ShelfConfig
 * @property {ShelfTier[]} tiers
 * @property {number} bookGap 相邻两本之间预留的缝隙
 * @property {boolean} curatedView 策展视图：架上只摆最新/精选 N 本，全量走 M02 归档
 * @property {number} curatedCount 策展视图下架上摆几本
 * @property {'date' | 'title' | 'pinned'} sort 排序方式
 * @property {'none' | 'tag' | 'year' | 'series'} groupBy 分组方式
 * @property {{ base: number, per4k: number, min: number, max: number }} thickness 厚度公式系数
 * @property {{ base: number, pinnedBonus: number, perTag: number, min: number, max: number }} height 高度公式系数
 * @property {{ atlasSize: number, spineW: number, spineH: number, perAtlas: number }} atlas 书脊图集规格
 * @property {'pile' | 'secondShelf' | 'fail'} overflow 溢出策略（容量超限时的行为）
 * @property {number} capacityWarnRatio 容量占用比超过它时构建期告警
 */

// ─────────────────────────────────────────────────────────────────────────────
// reader.config.js
// ─────────────────────────────────────────────────────────────────────────────

/** @typedef {'reading-layer' | 'in-book-scroll' | 'none'} ReaderFallback */

/**
 * @typedef {object} ReaderConfig
 * @property {{ widthRatio: number, heightRatio: number, columns: number, fontSize: number, lineHeight: number }} page
 *   通道 B 的书页规格（比例取自 `shared/magic-book.js`；改 fontSize 要重跑验收 CH5）
 * @property {{ distance: number, fov: number, fogNear: number, fogFar: number }} flatView
 *   平面视角（垂直俯视）参数。**必须与相机距离同比例调整 fov，否则翻开瞬间内容会"胀"一下**
 * @property {number} maxPagesInBook 页数超过它就走 `fallback`
 * @property {ReaderFallback} fallback 长文兜底形态（决策点 OD-3）
 * @property {{ channels: string[], skipCameraMove: boolean, fallback: ReaderFallback }} mobile
 * @property {number} transitionMs 抽书 → 翻开 → 走进书页的总时长（0 = 直接跳位，供 reduced-motion）
 * @property {boolean} resumeReading 是否记住并续读上次位置
 */

// ─────────────────────────────────────────────────────────────────────────────
// home.config.js（门厅 / 首屏）
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {object} HomeConfig
 * @property {boolean} enabled 是否启用门厅（HTML 先行、3D 空闲挂载）
 * @property {number} latestCount 门厅列出的最新文章条数
 * @property {boolean} showOnMobile 移动端是否显示门厅（移动端默认只读门厅 + "进入 3D"按钮）
 * @property {number} mountDelayMs 3D 空闲挂载的延迟（留给首屏 HTML 的时间）
 */

// ─────────────────────────────────────────────────────────────────────────────
// modules.config.js
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 模块总开关表。键 = `docs/BuildPlaning/mapping.yaml` 的模块 id。
 * @typedef {Record<string, boolean>} ModulesConfig
 */

// ─────────────────────────────────────────────────────────────────────────────
// 运行时设置面板（由 schema 自动生成控件，见 02-架构与目录调整.md §3 M-3）
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {object} SettingSpecBase
 * @property {string} group 面板分组名（"视角" / "阅读" / "音效" …）
 * @property {string} label 控件标签
 * @property {string} [hint] 一行说明（显示为 tooltip）
 */

/**
 * @typedef {SettingSpecBase & { type: 'boolean', default: boolean }} BooleanSetting
 * @typedef {SettingSpecBase & { type: 'number', min: number, max: number, step: number, default: number }} NumberSetting
 * @typedef {SettingSpecBase & { type: 'enum', values: readonly string[], default: string }} EnumSetting
 * @typedef {SettingSpecBase & { type: 'string', default: string }} StringSetting
 * @typedef {BooleanSetting | NumberSetting | EnumSetting | StringSetting} SettingSpec
 */

export {}
