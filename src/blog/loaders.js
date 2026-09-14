/**
 * 依赖零外部包的内容加载器（J1.5.3 的实现细节）
 * ============================================================================
 * ## 为什么不用 `astro/loaders` 的 `glob()`
 *
 * `glob()` 是我们**想要**的东西，但它在本项目的依赖拓扑下会**在 `astro sync` 阶段崩溃**：
 *
 * ```
 * [GenerateContentTypesError] `astro sync` failed: require is not defined
 *   at eval (.../picomatch@4.0.7/node_modules/picomatch/index.js:6:14)
 *   at ModuleRunner.directRequest (vite/dist/node/module-runner.js)
 * ```
 *
 * 成因链（在 Astro 7.3.2 + pnpm + Windows 上必现，已用一个**最小空白工程**复现过，
 * 与本项目的代码无关）：
 *   ① Astro 的 `syncContentCollections` 用 Vite 的 **ModuleRunner** 执行 `src/content.config.ts`；
 *   ② 该 config 一旦 `import { glob } from 'astro/loaders'`，`astro/loaders` 就被 Vite
 *      **外部化**（external）而不是内联打包 —— 实测此时 config 里 `glob` 会变成 `not defined`；
 *   ③ 外部化的模块由 Vite 逐个 `eval` 执行，而 `glob` 依赖的 `picomatch` 是 **CJS**，
 *      `eval` 出来的作用域里没有 `require` ⇒ 直接抛错。
 *   （`vite.ssr.noExternal` 对这条路径无效，试过 `['picomatch']`、`['astro/loaders','astro']` 均不生效。）
 *
 * ## 本文件的做法
 *
 * **完全不 import 任何第三方包**，只用 Node 内置模块（`node:fs` / `node:path`）。
 * 关键技巧：内置模块用**带 `@vite-ignore` 的动态 `import()`** 取用 —— 这样 Vite 不会改写它，
 * 请求直达 Node（已实测：静态 `import 'js-yaml'` 会失败，而 `await import('node:fs')` 正常）。
 *
 * 剩下要自己做的只有两件事，都很小：
 *   ① 递归列出 `*.md`；
 *   ② 解析 front-matter（**只支持 `src/content/README.md` §3 记录的那套子集**）。
 *
 * ## front-matter 子集（有意限制，配合 `src/content.config.ts` 的 Zod schema 兜底）
 *
 * ```yaml
 * title: 魔法阵的推导                  # 标量（可带引号）
 * date: 2026-02-14                    # 日期照样当字符串交给 z.coerce.date()
 * tags: [three.js, shader, 数学]        # 行内数组
 * tags:                               # 块状数组
 *   - three.js
 *   - shader
 * pinned: true                        # 布尔
 * seriesOrder: 3                      # 数字
 * book:                               # 一层嵌套对象
 *   spineColor: "#8a4fd6"
 * ```
 *
 * **不支持**：多行字符串（`|` / `>`）、锚点、多文档、数组套对象。
 * 真需要时 Zod 会先报"字段类型不对"（`InvalidContentEntryDataError`），
 * 而不会静默产出一篇字段错误的文章 —— 这正是"构建期 fail-fast"想要的行为。
 *
 * > 若将来 `astro/loaders` 的外部化问题被上游修掉，把 `src/content.config.ts` 里的
 * > `fileCollection(...)` 换回 `glob(...)` 即可，本文件可整体删除。
 */

/** Node 内置模块：用 `@vite-ignore` 的动态 import 取，绕开 Vite 的模块改写 */
const fs = await import(/* @vite-ignore */ 'node:fs/promises')
const nodePath = await import(/* @vite-ignore */ 'node:path')

/** front-matter 分隔块：文件**开头**的 `---` … `---` */
const FRONT_MATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?/

/** 去掉一层成对的引号 */
function unquote(value) {
  const v = value.trim()
  if (v.length >= 2 && ((v[0] === '"' && v.at(-1) === '"') || (v[0] === "'" && v.at(-1) === "'"))) {
    return v.slice(1, -1).replace(/\\(["'\\])/g, '$1')
  }
  return v
}

/** 标量：布尔 / 数字 / null / 字符串 */
function scalar(raw) {
  const v = unquote(raw)
  if (v === 'true') return true
  if (v === 'false') return false
  if (v === 'null' || v === '~' || v === '') return null
  // 只把"看起来纯粹是数字"的当数字（`2026-02-14` 不是；`3` 是）
  if (/^-?\d+(?:\.\d+)?$/.test(v)) return Number(v)
  return v
}

/** 行内数组 `[a, b, c]`；空数组写在**同一行**（跨行的 `[` 不支持，见文件头说明） */
function inlineArray(raw) {
  const inner = raw.trim().replace(/^\[/, '').replace(/\]$/, '')
  return inner
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '')
    .map(scalar)
}

/** 按缩进切出 (缩进, 内容, 行号) */
function lines(text) {
  return text.split(/\r?\n/).map((line, index) => {
    const match = /^([ \t]*)(.*)$/.exec(line)
    const indent = match[1].replace(/\t/g, '  ').length
    return { indent, content: match[2], index, raw: line }
  })
}

/** 剥掉行尾注释（只处理"空格 + #"，避免砍掉 `#8a4fd6` 这种颜色值） */
function stripComment(content) {
  const m = /^(.*?)\s+#(?!\w*['"]?\s*$).*$/.exec(content)
  return (m ? m[1] : content).trimEnd()
}

/**
 * 解析 front-matter 文本 → 普通对象。
 * @param {string} text
 * @returns {Record<string, unknown>}
 */
function parseFrontMatter(text) {
  const rows = lines(text).filter((r) => r.content.trim() !== '' && !r.content.trimStart().startsWith('#'))
  /** @type {Record<string, unknown>} */
  const out = {}
  /** 当前块状数组 / 嵌套对象的键 */
  let blockKey = null
  let blockIndent = -1
  let blockKind = null

  for (const row of rows) {
    const content = stripComment(row.content)
    if (content.trim() === '') continue

    // 块内的子项（数组项 `- xxx` 或嵌套对象的 `k: v`）
    if (blockKey !== null && row.indent > blockIndent) {
      if (blockKind === 'array') {
        const item = /^-\s*(.*)$/.exec(content.trim())
        if (item) out[blockKey].push(scalar(item[1]))
      } else if (blockKind === 'object') {
        const m = /^([^:]+):\s*(.*)$/.exec(content.trim())
        if (m) out[blockKey][unquote(m[1])] = m[2].trim() === '' ? null : parseValue(m[2])
      }
      continue
    }
    blockKey = null
    blockKind = null

    const m = /^([^:]+):\s*(.*)$/.exec(content.trim())
    if (!m) continue // 无法识别的行：忽略（Zod 会兜住真正重要的字段）
    const key = unquote(m[1])
    const rawValue = m[2]

    if (rawValue.trim() === '') {
      // 值写在下面的缩进块里：先按"可能是数组也可能是对象"占位，遇到第一行再定型
      blockKey = key
      blockIndent = row.indent
      blockKind = null
      out[key] = []
      // 预探一行决定是数组还是对象
      const next = rows[rows.indexOf(row) + 1]
      if (next && next.indent > row.indent) {
        blockKind = /^-\s/.test(next.content.trim()) ? 'array' : 'object'
        if (blockKind === 'object') out[key] = {}
      }
      continue
    }

    out[key] = parseValue(rawValue)
  }

  return out
}

/** 一个值：行内数组 / 标量 */
function parseValue(raw) {
  const v = stripComment(raw).trim()
  if (v.startsWith('[')) return inlineArray(v)
  return scalar(v)
}

/**
 * 创建一个"读一个目录下全部 Markdown"的内容加载器。
 *
 * 与 `glob({ pattern: '**\/*.md', base })` 的等价点：
 *   · 递归子目录；entry id = 相对路径去扩展名（`a/b.md` → `a/b`）
 *   · front-matter 不进正文；正文交给 `renderMarkdown()`（Astro 自己的 Markdown 管线）
 *   · `parseData()` 做 Zod 校验；`generateDigest()` 提供增量同步的摘要
 *
 * @param {{ base: string, label?: string }} options `base` 相对**项目根**（与 astro 的 cwd 一致）
 * @returns {import('astro').Loader}
 */
export function markdownDir({ base, label = 'markdown-dir' }) {
  return {
    name: `magic-cabin:${label}`,
    load: async ({ store, meta, logger, parseData, renderMarkdown, generateDigest, watcher }) => {
      const root = nodePath.resolve(process.cwd(), base)
      let files = []
      try {
        files = (await fs.readdir(root, { recursive: true })).map(String).filter((f) => f.toLowerCase().endsWith('.md'))
      } catch (error) {
        logger.warn(`内容目录不存在或不可读：${base}（${error.message}）`)
        return
      }
      files.sort() // 稳定顺序 ⇒ 同样的内容必然产出同样的 id 顺序（构建可复现）

      const seen = new Set()
      let count = 0
      for (const rel of files) {
        const relPosix = rel.replace(/\\/g, '/')
        const abs = nodePath.join(root, rel)
        /**
         * ★ 交给 Astro 的 filePath 必须是**以 `/` 分隔的相对路径**，不能是绝对路径。
         *
         * 依据 `astro/dist/content/mutable-data-store.js`：
         *   `if (filePath.startsWith("/")) throw new Error('File path must be relative to the site root.')`
         *
         * ⚠️ 这条坑在 Windows 上是**隐形**的：`D:\...\a.md` 不以 `/` 开头，检查被绕过，
         *    本地 `astro sync` / `astro build` 正常通过；到了 Linux CI（`/home/runner/...`）
         *    才抛出 `File path must be relative to the site root`，造成"本地过、CI 挂"。
         *    所以这里显式构造 POSIX 相对路径，不做任何平台判定。
         */
        const filePath = `${base.replace(/\\/g, '/').replace(/\/+$/, '')}/${relPosix}`
        let text = await fs.readFile(abs, 'utf8')
        text = text.replace(/^\uFEFF/, '') // 去 BOM（Windows 编辑器常带）
        const fm = FRONT_MATTER_RE.exec(text)
        const rawData = fm ? parseFrontMatter(fm[1]) : {}
        const body = fm ? text.slice(fm[0].length) : text
        const id = relPosix.replace(/\.md$/i, '')

        // 固定四步（与 Astro 内置 glob loader 同序）：
        //   ① parseData —— Zod 校验 + 补默认值；② 摘要；③ 渲染正文；④ 入库
        const data = await parseData({ id, data: rawData, filePath })
        const digest = generateDigest(body + '\u0000' + JSON.stringify(data))
        seen.add(id)
        store.set({ id, data, filePath, digest, body, rendered: await renderMarkdown(body) })
        count++
      }

      // 源文件被删除 ⇒ 条目也要消失（否则会出现"已删除的文章还在书架上"）
      for (const id of store.keys()) {
        if (!seen.has(id)) store.delete(id)
      }

      // dev 模式下把目录登记进 watcher，改动即时生效
      if (watcher) watcher.add(root)
      logger.info(`${label}: ${count} 篇（${base}）`)
    },
  }
}
