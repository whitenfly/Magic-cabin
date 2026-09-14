/**
 * 门厅配置（首页首屏策略）
 *
 * 对应实现：src/pages/index.astro（站点侧）+ src/components/CabinMount.astro（3D 岛）
 * 对应设计：ArtLine-Part/03 §8.3 的「门厅」策略 + K18（HTML 先行，3D 空闲挂载）
 *
 * 要解决的问题：3D 主页的首屏成本很高，但它同时必须是"一个可被爬虫读到、无 JS 也能读的博客首页"。
 * 解法：HTML 先出（标题 + 最新 N 篇 + 推门按钮），3D 就绪后再接管；3D 失败则用户留在可用的列表页。
 */
import { resolveBoolean, resolveNumber } from './resolve.js'

/** @type {import('./types.js').HomeConfig} */
export const homeConfig = {
  // 总开关。false = 首页直接进 3D（放弃"HTML 先行"的健壮性与 SEO 兜底）
  enabled: resolveBoolean('PUBLIC_FOYER', true),

  // 门厅列出的最新文章条数（爬虫与无 JS 用户在此即可获得完整内容入口）
  latestCount: 5,

  // 移动端是否显示门厅。true = 先给列表 + "推门进入小屋"按钮（默认，见 cabin.config.foyer.mobile）
  showOnMobile: true,

  // 3D 空闲挂载的延迟（ms）：留给首屏 HTML 的渲染时间，避免与文字争夺主线程
  mountDelayMs: resolveNumber('PUBLIC_FOYER_DELAY', 600),

  // 门厅文案（改动只影响首屏，3D 场景内不受影响）
  text: {
    enter: '推门进入小屋',
    latest: '最近写下的',
    archive: '看看全部',
    // 3D 加载失败时的提示（不弹错误框，只换一句文案，保持可用）
    fallbackHint: '小屋的门暂时推不开，先用目录读吧。',
  },
}
