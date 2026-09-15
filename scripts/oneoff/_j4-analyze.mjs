/**
 * J4 结构分析器 —— 回答"哪些声明住在哪、谁引用谁、有没有前向引用"
 *
 * 来源：新增（`J4`）。`J4` 要把 `legacy/monolith.js`（6217 行、单个 `installCabin()`
 * 里的一个巨型 IIFE）切成 `systems/**` + `world/**` 的多个模块。切之前必须先知道：
 *
 *   · 哪些顶层声明是 `const`（可当只读快照）、`let`（跨段共享的**可变**状态）、`function`
 *   · 每个声明被哪些行引用 —— 决定"哪几段必须连续"
 *   · **前向引用**（引用行 < 声明行）—— 切片后跨段前向引用会变成**运行时 undefined**，
 *     因为原来靠"函数声明提升"活着，切片后只能靠"前一段先执行"。这是切片的头号杀手。
 *
 * ## 为什么用 TypeScript 的 checker 而不是手写作用域遍历
 *
 * 手写要正确处理 var 提升 / let 块级 / 函数声明 / 参数默认值 / catch 绑定 / class 名……
 * 一处写错就会把"段内引用"误判成"自由变量"，从而生成 `ctx.x` 把局部变量shadow掉 ——
 * 那种错**编译能过**、门禁也可能绿、只在某个角落炸。`checker.getSymbolAtLocation()`
 * 直接给出符号与声明位置，是唯一可信的判据。
 *
 * ## 用法
 *
 * ```bash
 * node scripts/oneoff/_j4-analyze.mjs                 # 概览
 * node scripts/oneoff/_j4-analyze.mjs --forward       # 只列前向引用（切片前必看）
 * node scripts/oneoff/_j4-analyze.mjs --refs=<name>   # 某个声明的全部引用点
 * node scripts/oneoff/_j4-analyze.mjs --json          # 机器可读（给切片器用）
 * ```
 */
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const ROOT = path.resolve(import.meta.dirname, '../..')
const MONOLITH = path.join(ROOT, 'src/cabin/legacy/monolith.js')

const argv = process.argv.slice(2)
const ONLY_FORWARD = argv.includes('--forward')
const AS_JSON = argv.includes('--json')
const refsArg = argv.find((a) => a.startsWith('--refs='))
const REFS = refsArg ? refsArg.slice('--refs='.length) : null

const program = ts.createProgram([MONOLITH], {
  allowJs: true,
  checkJs: false,
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
  noResolve: true,
  skipLibCheck: true,
})
const checker = program.getTypeChecker()
const sf = program.getSourceFile(MONOLITH)
if (!sf) {
  console.error('无法解析 ' + MONOLITH)
  process.exit(1)
}

/** 1-based 行号 */
const lineOf = (node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1

// ── ① 定位 installCabin 里的 IIFE 体 ───────────────────────────────────────
let body = null
let bodyStart = 0
let bodyEnd = 0
function visitForIife(node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'installCabin') {
    const walk = (n) => {
      if (ts.isCallExpression(n) && ts.isParenthesizedExpression(n.expression) && ts.isFunctionExpression(n.expression.expression)) {
        body = n.expression.expression.body
        bodyStart = lineOf(body)
        bodyEnd = sf.getLineAndCharacterOfPosition(body.getEnd()).line + 1
        return true
      }
      return ts.forEachChild(n, walk) || false
    }
    walk(node.body)
  }
  return ts.forEachChild(node, visitForIife)
}
visitForIife(sf)
if (!body) {
  console.error('找不到 installCabin 里的 IIFE')
  process.exit(1)
}

// ── ② body 顶层的声明 ──────────────────────────────────────────────────────
/** @type {Map<string, {name:string, kind:string, line:number, node:any, blockScoped:boolean}>} */
const topDecls = new Map()
const inBody = (n) => n.getStart(sf) >= body.getStart(sf) && n.getEnd() <= body.getEnd()

for (const stmt of body.statements) {
  const add = (nameNode, kind, blockScoped) => {
    const name = nameNode.text
    if (!topDecls.has(name)) {
      topDecls.set(name, { name, kind, line: lineOf(nameNode), node: nameNode, blockScoped })
    }
  }
  if (ts.isVariableStatement(stmt)) {
    const kind = stmt.declarationList.flags & ts.NodeFlags.Const ? 'const' : 'let'
    for (const d of stmt.declarationList.declarations) {
      if (ts.isIdentifier(d.name)) add(d.name, kind, kind === 'let')
      else if (ts.isObjectBindingPattern(d.name) || ts.isArrayBindingPattern(d.name)) {
        for (const el of d.name.elements) if (ts.isIdentifier(el.name)) add(el.name, kind, kind === 'let')
      }
    }
  } else if (ts.isFunctionDeclaration(stmt) && stmt.name) {
    add(stmt.name, 'function', false)
  } else if (ts.isClassDeclaration(stmt) && stmt.name) {
    add(stmt.name, 'class', true)
  }
}

// ── ③ 每个引用的符号归属 ───────────────────────────────────────────────────
/** name -> [{line, kind}] */
const refs = new Map()
/** 前向引用：引用行 < 声明行 */
const forward = []
/** 赋值/自增等**写**引用 */
const writes = []

function symDeclLine(node) {
  const sym = checker.getSymbolAtLocation(node)
  if (!sym) return null
  const decls = sym.declarations
  if (!decls || !decls.length) return null
  // 以第一个声明为准（同文件内顶层声明不会有多个）
  return decls[0]
}

/**
 * 引用点的求值时机。
 *
 * ★ 这是切片可行性的**唯一硬约束**：
 *   · `deferred`（住在函数体 / 箭头函数 / getter 里）—— 只在被调用时才解析名字，
 *     切片后写成 `ctx.x` 完全安全，**哪怕 ctx.x 是后面几段才赋的值**；
 *   · `immediate`（住在 IIFE 体顶层、随执行流程立即求值）—— 切片后必须在**它之前**的
 *     段里已经给 `ctx.x` 赋过值，否则拿到 undefined。
 * 原代码里这两类都由"函数声明提升"掩盖着，所以必须分开统计。
 */
let fnDepth = 0
/** 立即执行的自由变量引用：{name, line, declLine} */
const immediate = []

function isFnLike(n) {
  return (
    ts.isFunctionDeclaration(n) ||
    ts.isFunctionExpression(n) ||
    ts.isArrowFunction(n) ||
    ts.isMethodDeclaration(n) ||
    ts.isGetAccessorDeclaration(n) ||
    ts.isSetAccessorDeclaration(n) ||
    ts.isConstructorDeclaration(n)
  )
}

function walkRefs(node) {
  const fnLike = isFnLike(node)
  if (fnLike) fnDepth++
  if (ts.isIdentifier(node)) {
    const parent = node.parent
    const isDeclName =
      (ts.isVariableDeclaration(parent) && parent.name === node) ||
      (ts.isFunctionDeclaration(parent) && parent.name === node) ||
      (ts.isClassDeclaration(parent) && parent.name === node) ||
      (ts.isParameter(parent) && parent.name === node) ||
      (ts.isPropertyAssignment(parent) && parent.name === node) ||
      (ts.isPropertyAccessExpression(parent) && parent.name === node) ||
      (ts.isMethodDeclaration(parent) && parent.name === node) ||
      (ts.isPropertySignature(parent) && parent.name === node) ||
      (ts.isBindingElement(parent) && parent.name === node) ||
      (ts.isImportSpecifier(parent) || ts.isImportClause(parent) || ts.isNamespaceImport(parent)) ||
      (ts.isLabeledStatement(parent) && parent.label === node)
    if (!isDeclName) {
      const decl = symDeclLine(node)
      if (decl && inBody(decl)) {
        const name = node.text
        const entry = topDecls.get(name)
        // 只统计"确实绑定到 body 顶层那个声明"的引用
        if (entry && decl.getStart(sf) === entry.node.getStart(sf)) {
          const line = lineOf(node)
          if (!refs.has(name)) refs.set(name, [])
          refs.get(name).push(line)
          if (line < entry.line) forward.push({ name, refLine: line, declLine: entry.line, kind: entry.kind })
          if (fnDepth === 0) immediate.push({ name, line, declLine: entry.line, kind: entry.kind })
          const isWrite =
            (ts.isBinaryExpression(parent) && parent.left === node && parent.operatorToken.kind !== ts.SyntaxKind.EqualsEqualsEqualsToken) ||
            (ts.isPrefixUnaryExpression(parent) && (parent.operator === ts.SyntaxKind.PlusPlusToken || parent.operator === ts.SyntaxKind.MinusMinusToken)) ||
            (ts.isPostfixUnaryExpression(parent))
          if (isWrite) writes.push({ name, line })
        }
      }
    }
  }
  ts.forEachChild(node, walkRefs)
  if (fnLike) fnDepth--
}
walkRefs(body)

// ── ④ 输出 ─────────────────────────────────────────────────────────────────
const kinds = { const: 0, let: 0, function: 0, class: 0 }
for (const d of topDecls.values()) kinds[d.kind]++

if (AS_JSON) {
  const out = {
    bodyStart,
    bodyEnd,
    totalLines: sf.getLineAndCharacterOfPosition(sf.end).line + 1,
    kinds,
    decls: [...topDecls.values()].map((d) => ({
      name: d.name,
      kind: d.kind,
      line: d.line,
      refs: refs.get(d.name) || [],
      firstRef: Math.min(d.line, ...(refs.get(d.name) || [d.line])),
      lastRef: Math.max(d.line, ...(refs.get(d.name) || [d.line])),
      writes: writes.filter((w) => w.name === d.name).map((w) => w.line),
    })),
    forward,
  }
  const dest = path.join(ROOT, 'scripts/oneoff/_j4-map.json')
  fs.writeFileSync(dest, JSON.stringify(out, null, 1))
  console.log(`✓ 已写出 ${path.relative(ROOT, dest)}（${out.decls.length} 个顶层声明）`)
  process.exit(0)
}

if (REFS) {
  const d = topDecls.get(REFS)
  if (!d) {
    console.error(`没有名为 ${REFS} 的顶层声明`)
    process.exit(1)
  }
  const rs = refs.get(REFS) || []
  console.log(`\n${REFS}  (${d.kind})  声明于 L${d.line}`)
  console.log(`引用 ${rs.length} 处：L${rs.join(', L')}`)
  const ws = writes.filter((w) => w.name === REFS).map((w) => w.line)
  if (ws.length) console.log(`其中**写**引用：L${ws.join(', L')}`)
  console.log('')
  process.exit(0)
}

console.log('\nJ4 结构分析 · legacy/monolith.js')
console.log('─'.repeat(64))
console.log(`文件总行数      ${sf.getLineAndCharacterOfPosition(sf.end).line + 1}`)
console.log(`installCabin IIFE 体   L${bodyStart} – L${bodyEnd}`)
console.log(`顶层声明        ${topDecls.size}  （const ${kinds.const} / let ${kinds.let} / function ${kinds.function} / class ${kinds.class}）`)
console.log(`可写状态（let）  ${kinds.let}`)
console.log(`前向引用        ${forward.length}`)

// ★ 立即执行的跨段引用：它们把"必须同段"或"必须按序"钉死
const immediateForward = immediate.filter((r) => r.line < r.declLine)
console.log(`立即执行的引用  ${immediate.length} 处（其中**前向** ${immediateForward.length} 处 —— 这些必须在同一段内）`)
if (immediateForward.length) {
  const byName = new Map()
  for (const r of immediateForward) {
    if (!byName.has(r.name)) byName.set(r.name, [])
    byName.get(r.name).push(r)
  }
  console.log('\n★ 立即执行的前向引用（切片时**必须**与声明同段，否则运行时 undefined）')
  for (const [name, list] of [...byName.entries()].sort((a, b) => a[1][0].line - b[1][0].line)) {
    console.log(`  ${name.padEnd(28)} 声明 L${list[0].declLine}  ← 引用 L${list.map((x) => x.line).join(', L')}`)
  }
}

if (ONLY_FORWARD || forward.length) {
  const grouped = new Map()
  for (const f of forward) {
    if (!grouped.has(f.name)) grouped.set(f.name, [])
    grouped.get(f.name).push(f)
  }
  console.log(`\n★ 前向引用（引用点早于声明点 —— 切片时最危险的一类）`)
  const sorted = [...grouped.entries()].sort((a, b) => Math.min(...a[1].map((x) => x.refLine)) - Math.min(...b[1].map((x) => x.refLine)))
  for (const [name, list] of sorted) {
    const refLines = list.map((x) => x.refLine)
    const span = Math.max(...refLines) - Math.min(...refLines)
    console.log(`  ${name.padEnd(30)} ${list[0].kind.padEnd(9)} 声明 L${list[0].declLine}  ← 最早引用 L${Math.min(...refLines)}  （${list.length} 处，跨度 ${span} 行）`)
  }
}
console.log('')
