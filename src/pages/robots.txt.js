/**
 * `/robots.txt` —— 爬虫指令 + sitemap 指引
 * ============================================================================
 * `Sitemap:` 一行指向 `/sitemap.xml`，而 sitemap 由 `J5.6`（`@astrojs/sitemap`）生成。
 * 现在就写上它是**刻意**的：等 `J5.6` 落地时，这一行不用再改，
 * 而在此之前 404 一个 sitemap 对爬虫没有危害（它们会重试）。
 *
 * ⚠️ 与 `rss.xml.js` 同理：静态端点必须导出 **`GET`**，不能在模块顶层 `return`。
 */
import { siteConfig } from '@/config/site.config.js'

export const prerender = true

export async function GET() {
  const site = new URL(siteConfig.url)
  const txt = `User-agent: *
Allow: /

Sitemap: ${new URL('/sitemap.xml', site).href}
`
  return new Response(txt, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
