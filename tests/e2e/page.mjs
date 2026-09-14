/**
 * 测试入口解析（`J1.5` 起需要，三条测试脚本共用）
 * ============================================================================
 * ## 为什么需要它
 *
 * `J1.5` 之前，"项目首页"只有一个答案：`/index.html`（Vite 的根 HTML，直接 `<script src="./src/main.js">`）。
 * `J1.5` 之后有两个都合法的形态，取决于 `serve.mjs` 托管哪一份：
 *
 * | 服务方式 | 首页 | 3D 入口长什么样 |
 * |---|---|---|
 * | `pnpm serve`（托管 `dist/`） | `/` 或 `/index.html` | `<script type="module" src="/_astro/CabinMount...js">` |
 * | `pnpm serve:legacy`（托管仓库根） | `/index.html` | `<script type="module" src="./src/main.js">` |
 *
 * 三条测试脚本（`visual/capture`、`visual/compare`、`e2e/smoke`、`e2e/perf`）
 * 都曾硬编码 `html.includes('src/main.js')` 作为"这是本项目页面"的判据 ——
 * 那个判据在 Astro 产物下**必然失败**，于是测试会以"不是本项目页面"为由拒绝跑，
 * 看起来像环境问题，实际是判据过时了。
 *
 * ## 新的判据（两条，任一成立即可）
 *
 * 1. **HTML 里引用了本项目搬迁过来的样式表**（`cabin.css`）—— 两版页面都有；
 *    它的内容哈希在不同构建间会变，所以只匹配文件名主干。
 * 2. **HTML 里有 3D 实现的脚本**（`src/main.js` 或 Astro 打包出的 `monolith.*.js`）。
 *
 * 两条都不是"任意页面"能满足的，因此依然能挡住"截到错误页却伪装成一致"这种最坏的失败模式
 * （`tests/visual/README.md` 的教训）。
 */

/**
 * 本项目页面的特征（**任一命中即可**）：
 *
 * | 特征 | 产物首页 | 零构建首页 | 说明 |
 * |---|---|---|---|
 * | `cabin-mount` | ✅ | — | 岛的挂载标记（`CabinMount.astro` 渲染的零尺寸节点） |
 * | `monolith` | ✅（`_astro/monolith.<hash>.js`） | — | Astro 打包后的 3D 实现 chunk 名 |
 * | `src/main.js` | — | ✅ | 零构建入口脚本 |
 *
 * ⚠️ **不要用 `cabin.css` 判断**：Astro 不保留这个文件名 —— 它把所有样式合并压缩成
 *    `_astro/BaseLayout.<hash>.css`。这个判据我写错过一次，结果是"测试拒绝跑"却看起来像环境问题。
 */
const PAGE_HINTS = ['cabin-mount', 'monolith', 'src/main.js']

/**
 * 判断一段 HTML 是不是本项目的页面。
 * @param {string} html
 * @returns {{ ok: boolean, why: string }}
 */
export function looksLikeCabinPage(html) {
  const hit = PAGE_HINTS.filter((h) => html.includes(h))
  return {
    ok: hit.length > 0,
    why: hit.length ? `命中特征 ${hit.join(' / ')}` : `未命中任何特征（${PAGE_HINTS.join(' / ')}）`,
  }
}

/**
 * 解析"首页 URL 路径"。
 *
 * 先试 `/`（Astro 的规范首页，`trailingSlash: 'always'` 下由目录索引提供），
 * 失败再试 `/index.html`（零构建路径的显式入口）。两者都能被 `serve.mjs` 正确托管。
 *
 * @param {string} base 形如 `http://127.0.0.1:5173`（不带尾斜杠）
 * @param {{ onError?: (message: string) => void }} [opts]
 * @returns {Promise<string>} 形如 `/` 或 `/index.html`
 */
export async function resolveHomePath(base, opts = {}) {
  const problems = []
  for (const candidate of ['/', '/index.html']) {
    try {
      const res = await fetch(base + candidate)
      if (!res.ok) {
        problems.push(`${candidate} → HTTP ${res.status}`)
        continue
      }
      const html = await res.text()
      const verdict = looksLikeCabinPage(html)
      if (!verdict.ok) {
        problems.push(`${candidate} → 不是本项目页面（${verdict.why}）`)
        continue
      }
      return candidate
    } catch (error) {
      problems.push(`${candidate} → ${error.message}`)
    }
  }
  opts.onError?.(problems.join('；'))
  return null
}

/**
 * 拼一个页面 URL：`pageUrl('http://127.0.0.1:5173', '/', '?a=1')` → `http://127.0.0.1:5173/?a=1`
 * （`/index.html` 这种带文件名的路径也能正确拼接）
 */
export function pageUrl(base, homePath, query = '') {
  return `${base}${homePath}${query}`
}
