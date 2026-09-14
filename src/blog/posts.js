/**
 * 文章集合的**读取层**（`src/blog/**` 的第一个文件）
 * ============================================================================
 * 为什么现在就有它：`src/pages/**` 的三个页面（首页列表、归档、标签）都要同一套
 * "取 → 过滤 → 排序 → 摘要"的逻辑。放在页面里各写一遍，就会出现三份互相漂移的排序规则
 * —— 而排序规则属于**书架算法**（`J6.1` 的 `ShelfLayout`），它必须只有一个真源。
 *
 * 依赖规则（`docs/BuildPlaning/02-架构与目录调整.md` §2）：
 *   `src/pages/**` → **可以** import 本目录；本目录**不得** import `src/pages/**`。
 *   本目录也**不得** import `src/cabin/**`（3D 侧只能通过 `posts.json` 契约读内容）。
 *
 * ⚠️ 与 `J6.1` 的 `ShelfLayout` 的关系：
 *   本书架**厚度 / 高度公式**（`shelfConfig.thickness` / `height`）现在还不参与静态页 ——
 *   它要有"字数"才成立，而字数统计属于 `J5` 的构建期管线。
 *   所以这里只做**顺序与筛选**（书架也需要的部分），尺寸推导留给 `J6.1`。
 */
import { getCollection } from 'astro:content'

/** 内容里的日期统一按 UTC 零点处理，避免不同时区构建出不同的排序 */
function timeOf(date) {
  const t = date instanceof Date ? date.getTime() : new Date(date).getTime()
  return Number.isFinite(t) ? t : 0
}

/**
 * 取全部**可公开**的文章（已排除草稿与隐藏）。
 *
 * 排序规则（与 `shelfConfig.sort: 'date'` 对齐）：
 *   ① 置顶的排在最前（书架上 = 最靠门口）
 *   ② 其余按日期倒序
 *   ③ 日期相同按 slug 字典序 —— **保证构建结果可复现**（同一份内容必然得到同一份产物）
 *
 * @returns {Promise<Array<import('astro:content').CollectionEntry<'posts'>>>}
 */
export async function loadPosts() {
  const all = await getCollection('posts', ({ data }) => !data.draft && !data.hidden)
  return all.sort((a, b) => {
    const pin = Number(b.data.pinned) - Number(a.data.pinned)
    if (pin) return pin
    const byDate = timeOf(b.data.date) - timeOf(a.data.date)
    if (byDate) return byDate
    return a.id.localeCompare(b.id)
  })
}

/** 从目录条目里取规范 slug（front-matter 覆盖优先，缺省用文件名派生的 id） */
export function slugOf(entry) {
  return entry.data.slug ?? entry.id
}

/** 规范站内 URL（末尾带 `/`，与 `astro.config.mjs` 的 `trailingSlash: 'always'` 一致） */
export function hrefOf(entry) {
  return `/posts/${slugOf(entry)}/`
}

/**
 * 摘要：front-matter 的 `summary` 优先；缺省取正文首个非标题段落并截断。
 * 截断而不是"取第一行"，是因为正文首段经常很长，列表页会被撑成一片文字墙。
 */
export function summaryOf(entry, maxLength = 96) {
  if (entry.data.summary) return entry.data.summary
  const body = (entry.body ?? '')
    .replace(/```[\s\S]*?```/g, '') // 代码块
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // 图片
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // 链接保留文字
    .replace(/^#{1,6}\s+.*$/gm, '') // 标题
    .replace(/^\s*\|.*$/gm, '') // 表格
    .replace(/^\s*>\s?/gm, '') // 引用
    .replace(/[*_`~]/g, '')
    .trim()
  const firstPara = body.split(/\n\s*\n/).find((p) => p.trim().length > 0)?.replace(/\s+/g, ' ').trim() ?? ''
  return firstPara.length > maxLength ? `${firstPara.slice(0, maxLength)}…` : firstPara
}

/** 列表页与 RSS 共用的日期写法：`2026-09-13`（不做本地化，保证构建产物稳定） */
export function isoDate(date) {
  return new Date(timeOf(date)).toISOString().slice(0, 10)
}

/**
 * 按标签聚合（M04 主题聚类 → 左墙试剂架的那 7 瓶）
 * @returns {Promise<Array<{ tag: string, posts: Array<any> }>>} 按文章数倒序
 */
export async function groupByTag() {
  const posts = await loadPosts()
  /** @type {Map<string, any[]>} */
  const buckets = new Map()
  for (const p of posts) {
    for (const tag of p.data.tags ?? []) {
      if (!buckets.has(tag)) buckets.set(tag, [])
      buckets.get(tag).push(p)
    }
  }
  return [...buckets.entries()]
    .map(([tag, list]) => ({ tag, posts: list }))
    .sort((a, b) => b.posts.length - a.posts.length || a.tag.localeCompare(b.tag))
}

/** 按年份聚合（M02 时间归档 → 毛茸茸大地毯的年历格） */
export async function groupByYear() {
  const posts = await loadPosts()
  /** @type {Map<string, any[]>} */
  const buckets = new Map()
  for (const p of posts) {
    const year = isoDate(p.data.date).slice(0, 4)
    if (!buckets.has(year)) buckets.set(year, [])
    buckets.get(year).push(p)
  }
  return [...buckets.entries()]
    .map(([year, list]) => ({ year, posts: list }))
    .sort((a, b) => b.year.localeCompare(a.year))
}
