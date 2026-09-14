/**
 * 站点基础配置
 *
 * 对齐 Firefly 的 `siteConfig.ts`：**只放站点核心信息，不聚合其他模块的配置**。
 * 每个功能模块的可调项在自己的 `<模块>.config.js` 里（见 src/config/README.md）。
 *
 * 这些值会同时被两侧消费：
 *   · 站点侧（Astro）：页面标题、meta、OG、footer、导航
 *   · 3D 侧（cabin）：M06 魔法书本的封面标题、M07 全屋地图与盆栽浆果、M13 挂钟的"运行天数"
 */
import { resolveString } from './resolve.js'

/** @type {import('./types.js').SiteConfig} */
export const siteConfig = {
  // ── 基本信息 ────────────────────────────────────────────────

  // 站点标题（出现在：首页 <title>、M06 魔法书本封面、M07 全屋地图顶部）
  title: resolveString('PUBLIC_SITE_TITLE', '魔女的魔法小木屋'),

  // 站点副标题（首页横幅）
  subtitle: '一间会呼吸的线稿小屋',

  // 站点描述（<meta name="description">，也用于 OG 卡片）
  description: '一个线稿风格的 3D 魔法小屋。操控一只软软的史莱姆在魔法小屋里生活，屋子里藏着我的文章、相册与收藏。',

  // 站点规范 URL。★ 末尾必须带 `/`（路由为 `trailingSlash: 'always'` 风格）
  // 影响：canonical / OG / sitemap / RSS / JSON-LD。留空会让这些全部退化
  url: resolveString('PUBLIC_SITE_URL', 'https://example.com/'),

  // 站点语言（决定 <html lang> 与字体回退；本项目暂定只做中文）
  language: 'zh-CN',

  // ── 作者身份 ────────────────────────────────────────────────
  // 出现在：M07 个人信息卡、文章页作者署名、JSON-LD 的 Person
  author: {
    name: 'YIBI2333', // ← 场景便签里已写死这个名字（原 L4717「作者：YIBI2333」）
    avatar: '/img/avatar.png', // 留空则不显示头像
    bio: '写代码，也写小屋。',
  },

  // 站点起始日 `YYYY-MM-DD`
  // ★ 驱动 M13 魔法时钟的「运行天数」指针 —— 这是 M13 最有表现力的一处（T4 通道）
  // ★ 请改成真实的开站日期
  siteStartDate: '2026-01-01',

  // ── 导航（M07 魔女帽 → 全屋地图 + 门厅列表共用同一份）──────────
  nav: [
    { label: '首页', href: '/', icon: 'home' },
    { label: '归档', href: '/archive/', icon: 'archive' },
    { label: '标签', href: '/tags/', icon: 'tags' },
    { label: '关于', href: '/about/', icon: 'book' },
    { label: '搜索', href: '/search/', icon: 'search' },
  ],

  // ── 社交链接（M07 月光盆栽的 5 颗发光浆果，1 : 1 对应）──────────
  // ★ 超过 5 条时，前 5 条上浆果，其余走 DOM 列表
  social: [
    { name: 'GitHub', url: 'https://github.com/', color: '#9b6fd8' },
    { name: 'Email', url: 'mailto:you@example.com', color: '#4fb0d8' },
    { name: 'RSS', url: '/rss.xml', color: '#9b6fd8' },
    { name: 'QQ', url: '', color: '#4fb0d8' }, // 留空则不生成该颗浆果
    { name: '友链', url: '/friends/', color: '#9b6fd8' },
  ],

  // ── 页脚 ────────────────────────────────────────────────────
  // 允许直接注入自定义 HTML（备案号等）。3D 场景中不体现（M07 的"页脚归入便签体系"是可选增强）
  footerHtml: '© 2026 YIBI2333 · 保留所有权利',
}
