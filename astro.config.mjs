/**
 * 魔法小屋 —— Astro 配置（J1.5.1）
 * ============================================================================
 * 决策 3 的落点：**Astro 管"内容站"那一半，原生 ESM 管"3D"那一半**。
 *
 * 职责边界（docs/BuildPlaning/03-渲染通道与构建选型.md §5.4）：
 *   · Astro 负责：src/content/** 内容源、src/pages/** 静态路由、SEO/OG/JSON-LD、门厅 HTML
 *   · 原生 ESM 负责：src/cabin/**（3D 场景，**一行不改**）、src/blog/**（博客内核）
 *
 * 两条禁止（架构不变量 `N12`，由 scripts/verify-j15.mjs 机器守住）：
 *   ① 3D 侧不得 import `*.astro`
 *   ② Astro 侧不得 import `cabin/**` 的实现 —— 唯一例外是 `CabinMount.astro` 里的一次 `client:only` 挂载
 *
 * 为什么 `output: 'static'`：静态博客不需要服务器；SSG 已满足 SEO 与首屏（01 §8「明确不做的事」）。
 *
 * ⚠️ 这里**不再重复声明** `base` / `resolve.alias` 的字面值，而是从 `src/config/` 读 ——
 *    与 src/config/site.config.js（PUBLIC_SITE_URL）和 tsconfig.json 的 `@/*` 保持单一真源。
 *    （Astro 底层就是 Vite：这两项最终写进下面的 `vite: {}` 段。）
 */
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'astro/config'

import { siteConfig } from './src/config/site.config.js'

/** 站点规范 URL（末尾必须带 `/`）—— canonical / OG / sitemap / RSS 都读它 */
const site = siteConfig.url

export default defineConfig({
  // ── 站点 ────────────────────────────────────────────────────
  site,

  // 静态产物：dist/ 可部署到任意托管（GitHub Pages / Netlify / 对象存储 / 本地 file://）
  output: 'static',

  // ── 路由 ────────────────────────────────────────────────────
  // `trailingSlash: 'always'` ⇒ 规范 URL 形如 `/posts/hello-cabin/`。
  // ★ 这一条与 3D 侧的路由（J6.7 的 `pushState('/posts/<slug>/')`）**必须一致**，
  //   否则"点书架上的书"与"直接访问静态页"会得到两个 URL（违反验收 BB7）。
  trailingSlash: 'always',

  // 构建输出目录固定为 dist/（scripts/serve.mjs 与 CI 都按这个路径找产物）
  outDir: './dist',

  // ── base ────────────────────────────────────────────────────
  // ★ 必须是 `/`（不能省，也不能写 `'./'`）：
  //   ① 3D 实现用**相对根**的路径取音频（`new Audio('sounds/door.mp3')`，monolith 第 48 行）
  //      ⇒ `/` 页必须在站点根，`base` 才与它一致；
  //   ② 省略 `base` 时 Astro 会把资源写成 `//_astro/x.js`（协议相对 URL），
  //      在 `file://` 下会解析成 UNC 路径 —— 显式写 `/` 换来干净的 `/_astro/x.js`。
  // 单文件"双击即玩"形态不受影响：它走**另一条产线** `vite.single.config.ts`（决策点 OD-2 选项①）。
  base: '/',

  // ── 构建 ────────────────────────────────────────────────────
  build: {
    // 站点侧几乎无客户端 JS；内联小样式可少两次请求
    inlineStylesheets: 'auto',
  },

  // ── 资源目录 ────────────────────────────────────────────────
  // public/ 下的 sounds/*.mp3 必须原样出现在 dist/sounds/：
  // 3D 实现里写的是**相对路径** `new Audio('sounds/door.mp3')`（monolith 第 48 行），
  // 因此 `/` 页的 URL 必须保持根路径语义（base 只能是 '/' 或 './' 中语义等价的那个）。
  publicDir: './public',

  // ── 开发服务器 ──────────────────────────────────────────────
  // 端口与旧的 Vite 配置一致（4321），避免"换了构建器就换了地址"
  server: { port: 4321, host: true },

  // ── Vite 段：继承 J1 已有的 alias ───────────────────────────
  // ⚠️ `base` 与 `build.target` **不在这里重复声明**：它们由上面的顶层 `base` /
  //    顶层 `build` 统一决定（Astro 自己就是 Vite，重复声明会出现两处真源）。
  vite: {
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },

    // ── ★ picomatch：本项目与 Astro 7 + pnpm 的一处**真实不兼容**（必读）──────
    //
    // 现象：`astro build` 与 `astro dev` 都会崩在
    //   `require is not defined  at eval (…/picomatch/index.js:…)  at ModuleRunner.directRequest`
    //
    // 成因：Astro 有**三处**静态 `import picomatch from "picomatch"`（已用
    //   `scripts/oneoff/probe-picomatch.mjs` 定位）：
    //     · `assets/vite-plugin-assets.js`   ← **dev 下必被加载**，所以 dev 必崩
    //     · `content/loaders/glob.js`        ← 本项目已不用（改用 src/blog/loaders.js）
    //     · `core/cache/memory-provider.js`
    //   而 `picomatch@4` 是 **CJS**。一旦它被 Vite **外部化**，就会被 ModuleRunner 用 `eval` 执行，
    //   那个作用域里没有 `require` ⇒ 直接抛错。pnpm 的嵌套 `node_modules` 让外部化必然发生。
    //
    // 处理：让它**走预打包/内联路径**，而不是被外部化。三个键一起给是刻意的 ——
    //   实测只给 `ssr.noExternal` 不生效（外部化发生在更早的一步）；
    //   `optimizeDeps.include` 让 Vite 把它预打包成 ESM，`ssr.optimizeDeps` 覆盖服务端那一半。
    //
    // ⚠️ 这里面**不能**再列 `'astro'` / `'astro/loaders'`：那样会把 Astro 内部的
    //    `glob` 导出也拖进外部化路径，反而让 config 里的 `glob` 变成 `not defined`（试过，更糟）。
    optimizeDeps: {
      include: ['picomatch'],
    },
    ssr: {
      noExternal: ['picomatch'],
      optimizeDeps: {
        include: ['picomatch'],
      },
    },

    build: {
      target: 'es2020',
    },

    // Astro 的 `import.meta.env` 替换插件默认用 **es2022** 作为 esbuild 目标，
    // 而本项目的 `target: 'es2020'` 会让顶层 await（`src/pages/rss.xml.js` 从内容集合取文章时用到）
    // 变成 `[TOLERATED_TRANSFORM]` 警告。这里把它对齐到 es2022 —— 与 `build.target` 一致，
    // 也与"静态站点只在现代浏览器里跑"的事实一致（`J8.3` 的低配档管的是设备能力，不是语法级别）。
    esbuild: {
      target: 'es2022',
    },
  },
})
