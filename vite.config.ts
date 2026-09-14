import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

/**
 * ⚠️ 本文件自 `J1.5` 起**不再是主产线** —— 保留它只为一件历史遗留的事：
 * **零构建兜底路径**（`index.html` + 浏览器原生 ESM + importmap）。
 *
 * | 用途 | J1.5 起归谁 |
 * |---|---|
 * | 站点构建（`pnpm build` → `dist/`） | **`astro.config.mjs`** |
 * | 开发服务器（`pnpm dev`） | **`astro dev`**（另见下方"受限环境"） |
 * | 单文件"双击即玩"（`pnpm build:single`） | **`vite.single.config.ts`**（决策点 OD-2 选项①） |
 * | 零构建兜底（`index.html` 直接跑） | 本文件 + `scripts/serve.mjs --legacy` |
 *
 * **为什么不能删它**：受限沙箱里 esbuild 无法派生子进程（`spawn EPERM`），
 * `astro dev` / `astro build` / `vite build` 全都起不来；
 * 而 `index.html` + `importmap` 这条路**完全不经过打包器**，是唯一"零依赖"的运行方式。
 * `J1` 把它定为"必须一直保留的兜底"，`J1.5` 不改这个决定（见 `docs/BuildPlaning/01` §3 的 J1 段）。
 *
 * 用法：`pnpm serve:legacy`（等价于 `node scripts/serve.mjs --legacy`）后访问首页。
 */
export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 4321,
    open: false,
  },
  build: {
    target: 'es2020',
    outDir: 'dist-vite',
    emptyOutDir: true,
  },
})
