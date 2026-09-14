/**
 * `/rss.xml` —— RSS 2.0 订阅源
 * ============================================================================
 * **自己写，不引入 `@astrojs/rss`**：`01` §8 明确"不做后端"，而 RSS 是纯字符串拼接，
 * 一个依赖换 30 行代码不划算（`03` §5.2 的净账里，RSS 只值 0.5 人日）。
 *
 * ⚠️ 端点必须导出 **`GET`**（`output: 'static'` 下由构建期调用并落盘成文件）。
 *    在模块顶层直接 `return new Response(...)` 会在打包后变成 `Illegal return statement`
 *    —— 这是 Astro 端点最常见的写法错误。
 *
 * ⚠️ 正文摘要里的 `&`、`<` 必须转义，否则源站是"看起来能打开、阅读器里全乱"的典型故障。
 *    `summaryOf()` 已经剥掉了 Markdown 与链接，这里只做 XML 转义。
 *
 * ⚠️ `sitemap.xml` **本阶段不生成**：它需要 `@astrojs/sitemap` 集成（`J5.6`）。
 *    这里先给出 RSS —— 它是"订阅"这一侧的最小可用产物，且零依赖。
 */
import { hrefOf, loadPosts, summaryOf } from '@/blog/posts.js'
import { siteConfig } from '@/config/site.config.js'

export const prerender = true

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

export async function GET() {
  const posts = await loadPosts()
  const site = new URL(siteConfig.url)
  const abs = (pathname) => new URL(pathname, site).href

  const items = posts
    .map((post) => {
      const url = abs(hrefOf(post))
      const categories = (post.data.tags ?? []).map((t) => `      <category>${esc(t)}</category>`).join('\n')
      return `    <item>
      <title>${esc(post.data.title)}</title>
      <link>${esc(url)}</link>
      <guid isPermaLink="true">${esc(url)}</guid>
      <pubDate>${new Date(post.data.date).toUTCString()}</pubDate>
${categories}
      <description>${esc(summaryOf(post, 200))}</description>
    </item>`
    })
    .join('\n')

  const lastBuild = posts[0] ? new Date(posts[0].data.date).toUTCString() : new Date(0).toUTCString()

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(siteConfig.title)}</title>
    <link>${esc(abs('/'))}</link>
    <description>${esc(siteConfig.description)}</description>
    <language>${esc(siteConfig.language)}</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
    <atom:link href="${esc(abs('/rss.xml'))}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`

  return new Response(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  })
}
