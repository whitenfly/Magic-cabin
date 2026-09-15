/**
 * J3 物件引用检查 —— 找出 `world/**` 里"用了但没拿到"的外部名字
 *
 * ## 为什么需要它
 *
 * 一个 `defineProp` 模块里能用的**外部名字**只有两类：
 *
 * | 类别 | 来源 | 拿法 |
 * |---|---|---|
 * | **layout 常量**（`TBL_TOP` / `MTX` / `BROOM_REST` …） | `world/layout.js` 的 `return` 表 | `const { TBL_TOP } = L` |
 * | **装配环境键**（`V` / `put` / `LITMAT` / `cbox` …） | `monolith.js` 的 `propTool(...)` 清单 | `build({ V, put })` 解构 |
 *
 * 这两类名字**在模块里都是裸的**（模块作用域与 IIFE 闭包不通）——
 * 少解构一个，`build` 就会在**运行时**抛 `ReferenceError`，而：
 *   · `node --check` 看不出（语法没错）；
 *   · 单元测试看不出（它们不 import 物件模块）；
 *   · 像素回归只会说"等待超时（120000ms）"——**不会告诉你是哪个名字**。
 *
 * 本轮就踩过两次：`coinTowers.js` 少解构 `V`、接着又少解构 `TBL_TOP`。
 * 每次都要重建 + 起浏览器 + 等 8 秒才拿到一行错误 —— 这个脚本把那一轮变成 1 秒。
 *
 * ## 用法
 *
 * ```bash
 * node scripts/oneoff/_j3-check-refs.mjs          # 检查（有遗漏则非零退出）
 * node scripts/oneoff/_j3-check-refs.mjs --quiet  # 只列出有问题的文件
 * ```
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '../..')
const QUIET = process.argv.includes('--quiet')

// ★ J4.7：`legacy/monolith.js` 已删除 —— 本脚本**整体退役**。
//   它原来回答的是"像素回归报超时（data-cabin === ready）时，静态查一下
//   '用了但没拿到的 layout 常量 / ctx 键'"。那个问题的对象（monolith 里手写解构的
//   layout 常量、手写的 `propCtx`）随段切片消失了 —— 现在这两件事分别由
//   `_j4-apply.mjs --check`（段间通信完整性）与 `tests/unit/segments.test.mjs`（段序 =
//   执行序 / 模块契约）守着，而且粒度更细（逐引用 vs 逐文件）。
if (!fs.existsSync(path.join(ROOT, 'src/cabin/legacy/monolith.js'))) {
  console.log('')
  console.log('  _j3-check-refs：legacy/monolith.js 已删除（J4.7）—— 本脚本整体退役')
  console.log('    替代判据：node scripts/oneoff/_j4-apply.mjs --check')
  console.log('              node --test tests/unit/segments.test.mjs')
  console.log('')
  process.exit(0)
}

/** 剥掉块注释、行注释与字符串字面量（搬迁对照表与文案里会出现这些名字，不能算"使用"） */
const stripComments = (s) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:\w"'`])\/\/[^\n]*/g, '$1')
    // ⚠️ 字符串也要剥：`id: 'junk-box/open'` 会让 `box` 被误判成裸用
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``')

/** 1. layout 常量：解析 `world/layout.js` 的 return 表 */
function layoutKeys() {
  const src = fs.readFileSync(path.join(ROOT, 'src/cabin/world/layout.js'), 'utf8')
  const ret = src.slice(src.indexOf('\n  return {'))
  const body = ret.slice(ret.indexOf('{') + 1, ret.lastIndexOf('}'))
  return new Set(
    body.split('\n')
      .map((l) => l.replace(/\/\/.*$/, '').trim())
      .join(' ')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => /^[A-Za-z_$][\w$]*$/.test(s)),
  )
}

/** 2. 装配环境键：解析 `monolith.js` 的 `propTool('xxx', …)` 调用 */
function ctxKeys() {
  const src = fs.readFileSync(path.join(ROOT, 'src/cabin/legacy/monolith.js'), 'utf8')
  const keys = new Set()
  for (const m of src.matchAll(/propTool\(\s*'([^']+)'/g)) keys.add(m[1])
  return keys
}

/** 收集一个文件里"已经拿到手"的名字：解构、变量声明、函数参数、函数名 */
function declaredNames(code) {
  const names = new Set()
  // 解构：`{ a, b: c, d = 1 }` → a, b, c, d
  // ⚠️ `b: c` 形式**两边都收**：`b` 是"外部名"（在这里被取了），`c` 是本地别名。
  //    只收别名会让 `const { CRATE_X: crateX } = L` 里的 `CRATE_X` 被误判成"裸用"。
  for (const m of code.matchAll(/\{([^{}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const t = part.trim().replace(/=.*$/, '').trim()
      if (!t) continue
      const key = t.includes(':') ? t.split(':')[0].trim() : t
      const alias = t.includes(':') ? t.split(':').pop().trim() : t
      for (const n of [key, alias]) if (/^[A-Za-z_$][\w$]*$/.test(n)) names.add(n)
    }
  }
  // 声明与函数
  for (const m of code.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1])
  for (const m of code.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1])
  for (const m of code.matchAll(/([A-Za-z_$][\w$]*)\s*=>/g)) names.add(m[1])
  for (const m of code.matchAll(/\bfor\s*\(\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1])
  // 函数参数（含形参里的解构已由上面的 `{}` 规则覆盖）
  for (const m of code.matchAll(/\bfunction\s*\w*\s*\(([^)]*)\)/g)) {
    for (const p of m[1].split(',')) {
      const t = p.trim().replace(/=.*$/, '').trim()
      if (/^[A-Za-z_$][\w$]*$/.test(t)) names.add(t)
    }
  }
  return names
}

/** 该名字是否在代码里被"使用"（作为函数调用或属性访问，或裸标识符） */
function usesName(code, name) {
  const re = new RegExp(`(?<![\\w$.])${name.replace(/\$/g, '\\$')}(?![\\w$])`)
  return re.test(code)
}

const LAYOUT = layoutKeys()
const CTX = ctxKeys()
const walk = (d) =>
  fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.js') ? [path.join(d, e.name)] : [],
  )

const files = walk(path.join(ROOT, 'src/cabin/world'))
let bad = 0
console.log(`\nJ3 物件引用检查　（layout 常量 ${LAYOUT.size} 个 / 装配环境键 ${CTX.size} 个）`)
console.log('─'.repeat(72))

for (const f of files) {
  const rel = path.relative(ROOT, f).replace(/\\/g, '/')
  if (rel.endsWith('layout.js')) continue
  const code = stripComments(fs.readFileSync(f, 'utf8'))
  const have = declaredNames(code)
  const missing = []
  for (const [kind, pool] of [['layout', LAYOUT], ['ctx', CTX]]) {
    for (const k of pool) {
      if (have.has(k)) continue
      if (usesName(code, k)) missing.push(`${k}(${kind})`)
    }
  }
  if (missing.length) {
    bad++
    console.log(`  ✗ ${rel}`)
    for (const m of missing) console.log(`      ${m}`)
  } else if (!QUIET) {
    console.log(`  ✓ ${rel}`)
  }
}

console.log('─'.repeat(72))
if (bad) {
  console.log(`\n✗ ${bad} 个文件里有"用了但没拿到"的外部名字 —— 它们会在运行时抛 ReferenceError，`)
  console.log('  而像素回归只会说"等待超时（120000ms）"。补上解构即可。\n')
  process.exit(1)
}
console.log('\n✓ 全部物件模块的外部引用都能拿到（layout 常量解构 + 装配环境键解构齐全）\n')
