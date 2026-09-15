/**
 * `tickOnce()` 拆解前的结构分析 —— 回答"哪些顶层语句能被切成独立的帧任务"
 *
 * 来源：新增（`J4.7`）。`animate()` 要收缩为调度骨架（DoD：≤ 60 行、更新顺序由
 * `UpdateScheduler` 决定），就必须把 `tickOnce()` 的 719 行按**原执行顺序**切成帧任务。
 *
 * 切分唯一的硬约束是**跨语句的变量依赖**：
 *   · 若 `S_i` 声明的名字被 `S_j`（j>i）引用，切开后 `S_j` 会 `ReferenceError`；
 *   · 这类名字必须提升到 `installFrameBody()` 的函数作用域（`S_i` 里改成赋值）。
 *
 * 用法：`node scripts/oneoff/_j4-tick-analyze.mjs [--all]`
 */
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const ROOT = path.resolve(import.meta.dirname, '../..')
const MONOLITH = path.join(ROOT, 'src/cabin/legacy/monolith.js')
const ALL = process.argv.includes('--all')

const program = ts.createProgram([MONOLITH], {
  allowJs: true, checkJs: false, target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext, noResolve: true, skipLibCheck: true,
})
const sf = program.getSourceFile(MONOLITH)
const checker = program.getTypeChecker()
const src = fs.readFileSync(MONOLITH, 'utf8')
const lineOf = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1

let fn = null
const find = (n) => {
  if (ts.isFunctionDeclaration(n) && n.name?.text === 'tickOnce') fn = n
  return ts.forEachChild(n, find)
}
find(sf)
if (!fn) { console.error('找不到 tickOnce'); process.exit(1) }

const stmts = fn.body.statements
/** 每条语句声明的顶层名字 */
const declsOf = (st) => {
  const out = []
  if (ts.isVariableStatement(st)) {
    for (const d of st.declarationList.declarations) {
      if (ts.isIdentifier(d.name)) out.push(d.name.text)
      else for (const el of d.name.elements) if (ts.isIdentifier(el.name)) out.push(el.name.text)
    }
  } else if (ts.isFunctionDeclaration(st) && st.name) out.push(st.name.text)
  else if (ts.isClassDeclaration(st) && st.name) out.push(st.name.text)
  return out
}

// 每条语句里"指向**本函数体顶层声明**"的引用
const declSet = new Map() // name -> stmtIndex
stmts.forEach((st, i) => { for (const n of declsOf(st)) if (!declSet.has(n)) declSet.set(n, i) })

const refsOf = (st) => {
  const out = new Set()
  const walk = (n) => {
    if (ts.isIdentifier(n)) {
      const p = n.parent
      const skip =
        (ts.isPropertyAccessExpression(p) && p.name === n) ||
        (ts.isPropertyAssignment(p) && p.name === n) ||
        (ts.isVariableDeclaration(p) && p.name === n) ||
        (ts.isBindingElement(p) && p.name === n) ||
        (ts.isParameter(p) && p.name === n) ||
        (ts.isFunctionDeclaration(p) && p.name === n)
      if (!skip && declSet.has(n.text)) {
        const sym = checker.getSymbolAtLocation(n)
        const d = sym?.declarations?.[0]
        if (d && d.getSourceFile() === sf && d.name && ts.isIdentifier(d.name) && declSet.has(d.name.text)) out.add(n.text)
      }
    }
    ts.forEachChild(n, walk)
  }
  walk(st)
  return out
}

const rows = stmts.map((st, i) => {
  const decls = declsOf(st)
  const refs = refsOf(st)
  // 它引用了**更早**语句声明的名字？（这是"切开就炸"的判据）
  const crossIn = [...refs].filter((r) => declSet.get(r) < i)
  // 它声明的名字被**后续**语句引用？（这些必须提升）
  const crossOut = decls.filter((d) => {
    for (let j = i + 1; j < stmts.length; j++) if (refsOf(stmts[j]).has(d)) return true
    return false
  })
  return { i, line: lineOf(st), endLine: sf.getLineAndCharacterOfPosition(st.getEnd()).line + 1, decls, crossIn, crossOut, text: src.slice(st.getStart(sf), st.getStart(sf) + 70).replace(/\s+/g, ' ') }
})

console.log(`\ntickOnce() 拆解分析 —— 顶层语句 ${stmts.length} 条（L${lineOf(fn)} 起）`)
console.log('─'.repeat(100))
const risky = rows.filter((r) => r.crossOut.length)
for (const r of ALL ? rows : rows) {
  const flag = r.crossOut.length ? ' ★需提升' : ''
  console.log(`  #${String(r.i).padStart(3)} L${r.line}–${r.endLine}  ${(r.decls.join(',') || '-').slice(0, 34).padEnd(34)} ← ${(r.crossIn.join(',') || '-').slice(0, 24).padEnd(24)} → ${(r.crossOut.join(',') || '-').slice(0, 40)}${flag}`)
}
console.log(`\n★ 需要提升到 installFrameBody() 作用域的名字（被后续语句引用）：`)
const promote = [...new Set(risky.flatMap((r) => r.crossOut))]
console.log(`  ${promote.length} 个：${promote.join(', ')}`)
console.log('')
