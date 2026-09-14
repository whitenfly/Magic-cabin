import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'

/**
 * ★ 第二条产线：单文件产物（决策点 OD-2 的选项①）★
 * ============================================================================
 * 决策记录（`docs/BuildPlaning/06-决策点对照.md` §2，2026-09-13 拍板）：
 *   **保留双管线** —— Astro 管站点（`pnpm build` → `dist/`），
 *   本文件生成"离线分发用"的那份产物（`pnpm build:single` → `dist-single/`）。
 *
 * 为什么不能只用 Astro：Astro 的产物是"多文件 + 绝对 base + 按需分块"，
 * 它不便于产出**相对 base + 全内联**的形态；而"发给朋友、离线看、当作品集附件"
 * 这个分发形态对小屋有实际价值（OD-2 的取舍论证）。
 *
 * ⚠️ **两条产线可能漂移**（画面/行为不一致）。缓解手段是现成的：
 *    单文件产物同样跑一遍 `J0.4` 的截图回归 —— 基线已经在了，多跑一次几乎零成本：
 *
 *      pnpm build:single && pnpm serve:single      # 另开一个终端
 *      pnpm test:visual -- --url=http://127.0.0.1:5173
 *      pnpm test:smoke  -- --url=http://127.0.0.1:5173
 *
 * ⚠️ 这里**故意**只保留第二条产线必需的最小配置（相对 base + 内联资源），
 *    不再承担日常 `dev` / `build`（那两件事已经归 Astro，见 `astro.config.mjs`）。
 *    因此没有 `server` 段 —— 产物靠 `pnpm serve:single` 在本地验证。
 *
 * ── ★ 当前真实状态（J1.5 实测，详见 `docs/J1.5-实施结果.md` §5）★ ──────────
 *
 * | 能力 | 状态 |
 * |---|---|
 * | 3D 在 HTTP 托管下启动 | ✅ `data-cabin: ready`，零页面错误 |
 * | `J0.4` 截图回归（3 机位） | ✅ **逐字节相同** |
 * | 交互冒烟 | ✅ **28 / 28** |
 * | 产物形态 | 🟡 "物理单文件"名不副实：`index.html` + `assets/{index,monolith,style}-*` 共 **4 个文件** |
 * | `file://` 直接双击 | ⚠️ **做不到**（见下） |
 *
 * **"双击即玩"做不到的原因是浏览器规则**：`file://` 页面的 origin 是 opaque，
 * 浏览器把每个本地文件都当成跨源，**`<script type="module">` 必须过 CORS ⇒ 被拦**。
 * 四条路都试过（`scripts/oneoff/probe-single-file.mjs` 用真实 Chrome + CDP 读 `data-cabin`）：
 *
 * | 配置 | 结果 |
 * |---|---|
 * | `type="module"` + Vite 注入的 `crossorigin` | `canvas: false`，**页面零报错**、画面空白（最坏的失败模式） |
 * | 去掉 `crossorigin`，保持 module | 仍 `canvas: false` ⇒ **module 本身是主因**，不是属性 |
 * | 经典脚本（`format: 'iife'`）+ `defer` | `canvas: true`，但 3D 未就绪：`Cannot access 'QT' before initialization`（TDZ） |
 * | module 格式 + 把 JS/CSS 内联进 HTML | 内联脚本本身语法正确、DOM 里也在，但**整段脚本不执行** |
 *
 * **结论**：本产线当前的正确定位是"**可离线分发 + 可回归**"，不是"双击即玩"。
 * 真正做到"双击即玩"是 **`J8.6`（单文件产线定稿）** 的任务，不在 `J1.5` 决定
 * （可行方向：内联模块脚本不受 CORS 限制，代价是产物涨到约 1 MB 且失去增量缓存）。
 */
export default defineConfig({
  // ★ 单文件形态必须用相对 base：产物被放到任意路径下都要能找到自己的资源
  base: './',

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  plugins: [tidySingleHtml()],

  build: {
    target: 'es2020',
    outDir: 'dist-single',
    emptyOutDir: true,
    // 尽量内联资源（图片/音频/字体不产生额外请求）
    assetsInlineLimit: 100 * 1024 * 1024,
    cssCodeSplit: false,
    // 单入口 ⇒ 本来就只有 1 个 chunk，不需要额外强制
    //
    // ⚠️ **不要再加 `output.inlineDynamicImports: true`**：实测它会让产物在 **HTTP 托管下也起不来**：
    //    把模块图塌缩进一个 chunk 之后，three 的导出在声明前被访问，报
    //    `ReferenceError: Cannot access 'yA' before initialization`，
    //    连带 `document.body` 的监听器也挂在 null 上（`TypeError: … reading 'addEventListener'`）。
    //    症状有个很好认的特征：**canvas 已经建出来了**（`canvas: true 1440x900`）却没有 `data-cabin`，
    //    且 `window.THREE` / `__cabinStepFrame` 全是 `undefined`。
    //    诊断方法：`node scripts/oneoff/probe-page.mjs http://127.0.0.1:5173/`
    //
    //    注：`J1` 时期的 `vite --mode single` 也带着这个开关，所以**这条产线此前就没跑通过** ——
    //    `OD-2` 决定"保留双管线"时，它的真实状态是"从未被端到端验证过"。
    rollupOptions: {
      input: fileURLToPath(new URL('./index.html', import.meta.url)),
    },
    // 3D 是单个应用入口，本来就该是一个大 chunk；关掉这条噪音警告
    chunkSizeWarningLimit: 1200,
  },
})

/**
 * 单文件产物的小扫尾：去掉 Vite 注入的 `crossorigin`，以及零构建路径专用的 `importmap`。
 *
 * 为什么去掉 `crossorigin`：它会让浏览器对脚本/样式发起一次 **CORS 检查**。
 * 放在 HTTP 托管下无害，但在 `file://` 下会让**样式表**也一起被拦 ——
 * 去掉它至少能让"打开就能看到排版正确的页面"（3D 仍受上面那条 module 限制）。
 *
 * 为什么去掉 `importmap`：那个表是给**零构建路径**解析裸模块名 `three` 用的；
 * 打包产物里 `three` 已经被内联进 bundle，留着只会误导下一个人。
 */
function tidySingleHtml(): Plugin {
  return {
    name: 'magic-cabin:tidy-single-html',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler: (html) =>
        html
          .replace(/<script\s+type="importmap">[\s\S]*?<\/script>\s*/i, '')
          .replace(/\s+crossorigin(?:="[^"]*")?/g, ''),
    },
  }
}
