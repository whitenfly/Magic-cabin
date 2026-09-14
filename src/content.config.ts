/**
 * ★ 内容集合 schema（J1.5.3）★
 * ============================================================================
 * **这是"新增一篇文章不需要改任何代码"的实现基础**（验收 `BB4`）。
 *
 * 位置约定：Astro 5 起集合定义写在 `src/` 根的 `src/content.config.ts`（不再是 `src/content/config.ts`）。
 * 本文件即那唯一一处 —— 不要在两个位置各写一份。
 *
 * 本阶段（J1.5）只建立**骨架**：
 *   · 字段以 `src/content/README.md` §3 的 front-matter 规范为准，**先全部可选**，
 *     让样例文章与后续文章都能通过；真正的强制校验（必填 / slug 唯一 / 书架容量 / 死链）
 *     属于 `J5.7` 的 `validate-content` 门禁，届时在这里把字段收紧为必填。
 *   · 形态保持"用户只写 Markdown + front-matter"，不引入任何需要作者理解的机制。
 *
 * ⚠️ `src/content/**` 是**内容源**，不是实现：它不得 import `src/cabin/**` 或 `src/blog/**`。
 *    反向是允许的（实现读内容），方向见 `docs/BuildPlaning/02-架构与目录调整.md` §2。
 *
 * ⚠️ 加载器用的是 `@/blog/loaders.js` 的 `markdownDir()`，**不是** `astro/loaders` 的 `glob()`。
 *    原因（必读，否则会有人"顺手改回去"）：`glob()` 会让 `astro sync` 在 `require is not defined`
 *    上崩溃 —— 这是 Astro 7 + pnpm 的外部化问题，**已用最小空白工程复现**，与本项目代码无关。
 *    完整成因链与替代方案的等价性说明写在 `src/blog/loaders.js` 的文件头。
 */
import { defineCollection, z } from 'astro:content'
import { markdownDir } from '@/blog/loaders.js'

/** 十六进制颜色（书脊外观覆盖用；非法值在构建期直接报错，而不是画出一本透明书） */
const hexColor = z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, '必须是 #RGB 或 #RRGGBB')

/**
 * `posts` —— 一篇文章 = 一本书（M01 内容存档）
 *
 * 字段与 `src/content/README.md` §3 一一对应；括号里是它最终会出现在哪：
 *   title       书名 / 静态页 <h1>（必填）
 *   date        书架排序依据（必填）
 *   tags        映射到 M04 试剂架的药水瓶；同时驱动书脊配色（`shelfConfig.spineTintByTag`）
 *   shelf       书架分组（`shelfConfig.groupBy`）
 *   pinned      置顶 → 书架最左（最靠门口），书脊高度 +`height.pinnedBonus`
 *   hidden      隐藏 → 只在宝箱彩蛋里出现，不进书架与列表
 *   draft       草稿 → 构建时跳过（本地 dev 仍可见）
 *   series      系列名 + 系列内序号（书架上同系列相邻）
 *   book.*      书脊外观覆盖；缺省由 `shelfConfig` 的公式推导（验收 BB14 的图集只认颜色，不认尺寸）
 */
const posts = defineCollection({
  loader: markdownDir({ base: 'src/content/posts', label: 'posts' }),
  schema: z.object({
    // ── 必填（J5.7 会在这里追加更严的规则：slug 唯一性、标题长度、日期区间）──
    title: z.string(),
    date: z.coerce.date(),

    // ── 标识与摘要 ────────────────────────────────────────────
    /** 规范 slug；缺省由文件名生成。全站唯一性由 J5.7 的 validate-content 守 */
    slug: z
      .string()
      .regex(/^[a-z0-9-]+$/, 'slug 只能是小写字母、数字与连字符')
      .optional(),
    updated: z.coerce.date().optional(),
    summary: z.string().optional(),
    cover: z.string().optional(),

    // ── 书架归属 ──────────────────────────────────────────────
    /** 分组（书架的 `groupBy` 用；缺省归入 'main'） */
    shelf: z.string().optional(),
    pinned: z.boolean().default(false),
    hidden: z.boolean().default(false),
    draft: z.boolean().default(false),

    // ── 系列 ──────────────────────────────────────────────────
    series: z.string().optional(),
    seriesOrder: z.number().optional(),

    // ── 书脊外观覆盖（缺省由算法推导）────────────────────────
    book: z
      .object({
        spineColor: hexColor.optional(),
        spineAccent: hexColor.optional(),
      })
      .optional(),

    // ── 其他 ──────────────────────────────────────────────────
    tags: z.array(z.string()).default([]),
    /** 语言（缺省跟站点；用于未来多语言，现在只是把字段位置留出来） */
    lang: z.string().optional(),
  }),
})

/**
 * `pages` —— 非文章的独立页（M06 关于本站 → 二楼书桌上的魔法书本）
 * 与 `posts` 分开的理由：它不出现在书架 / 归档 / RSS 里，但同样需要 Markdown 正文。
 */
const pages = defineCollection({
  loader: markdownDir({ base: 'src/content/pages', label: 'pages' }),
  schema: z.object({
    title: z.string(),
    updated: z.coerce.date().optional(),
    /** 是否进主导航（M07 的导航与门厅共用 siteConfig.nav，这里的开关只影响页脚） */
    hidden: z.boolean().default(false),
  }),
})

export const collections = { posts, pages }
