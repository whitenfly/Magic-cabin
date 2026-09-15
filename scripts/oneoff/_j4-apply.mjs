/**
 * J4 段应用器 —— `legacy/monolith.js` 的**唯一写者**（`J4` 版）
 *
 * 来源：新增（`J4`）。它是 `J3` 的 `_j3-apply.mjs` 的继任者，但换了粒度：
 * `J3` 一次搬**一件物件**（几何区间），`J4` 一次搬**一段**（连续代码区间 + 段内声明）。
 *
 * ## 两个动作
 *
 * ```
 *   --ctxify        ① 全段 ctx 化：把 6105 行的 IIFE 体按段切开，段间通信改成 `ctx`，
 *                      并在每段首插一行 `[J4:seg <id>]` 标记。
 *                      ★ 只做一次，且**不搬任何代码**（所有段仍留在 monolith 里）——
 *                        这一步的唯一判据是"像素逐字节零差异"。
 *
 *   --move=<id>     ② 把某段搬到它的目标模块：代码**一个字不改**（已经是 ctx 形式），
 *                      monolith 里只留一行 `installXxx(ctx);`。
 * ```
 *
 * ## 改写规则（照 `_j4-segments.mjs`，这里是落地）
 *
 * 令 `d` 为某个标识符引用 `r` 指向的 body 顶层声明：
 *
 * | 情形 | 处理 | 为什么 |
 * |---|---|---|
 * | `d` 在**别的段** | `r` → `ctx.<name>` | 段已经不是同一个作用域了 |
 * | `d` 在**本段**且是 **`let`** | `let x = …` → `ctx.x = …`；引用 → `ctx.x` | **可变的跨段共享状态**，留成局部就会各持一份副本 |
 * | `d` 在**本段**且是 `const`/`function`/`class` | 原名保留，段末补 `ctx.<name> = <name>` | 段内代码几乎零改动，跨段才走 ctx |
 *
 * ## 段边界为什么安全（实测，不是推断）
 *
 * `_j4-analyze.mjs` 量出**立即执行的前向引用 = 0**：原文里随执行流程立即求值的引用
 * 全都指向更早（或同段）的声明。那 33 处跨行前向引用全部住在函数体里（延迟求值），
 * 切片后走 `ctx` 完全安全。
 *
 * 用法：
 * ```bash
 * node scripts/oneoff/_j4-apply.mjs --report
 * node scripts/oneoff/_j4-apply.mjs --ctxify [--dry-run]
 * node scripts/oneoff/_j4-apply.mjs --move=audio
 * ```
 */
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { SEGMENTS } from './_j4-segments.mjs'

const ROOT = path.resolve(import.meta.dirname, '../..')
const MONOLITH = path.join(ROOT, 'src/cabin/legacy/monolith.js')

const argv = process.argv.slice(2)
const DRY = argv.includes('--dry-run')
const CTXIFY = argv.includes('--ctxify')
const moveArg = argv.find((a) => a.startsWith('--move='))
const MOVE = moveArg ? moveArg.slice('--move='.length) : null

const IND = '            ' // IIFE 体内缩进（与原文一致）

// ── 装载 ───────────────────────────────────────────────────────────────────
function load() {
  const src = fs.readFileSync(MONOLITH, 'utf8')
  const program = ts.createProgram([MONOLITH], {
    allowJs: true, checkJs: false, target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext, noResolve: true, skipLibCheck: true,
  })
  const sf = program.getSourceFile(MONOLITH)
  const checker = program.getTypeChecker()
  let body = null
  let installBody = null
  const find = (n) => {
    if (ts.isFunctionDeclaration(n) && n.name?.text === 'installCabin') {
      installBody = n.body
      const walk = (m) => {
        if (ts.isCallExpression(m) && ts.isParenthesizedExpression(m.expression) && ts.isFunctionExpression(m.expression.expression)) {
          body = m.expression.expression.body
          return true
        }
        return ts.forEachChild(m, walk) || false
      }
      walk(n.body)
    }
    return ts.forEachChild(n, find)
  }
  find(sf)
  if (!body) throw new Error('找不到 installCabin 里的 IIFE')
  return { src, sf, body, installBody, checker }
}

const lineOf = (sf, node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1
const lineStartOffset = (src, lineNo1) => {
  let off = 0
  for (let i = 1; i < lineNo1; i++) off = src.indexOf('\n', off) + 1
  return off
}

/** 段边界：把每个 hint 吸附到「≥ hint 的最近顶层语句」 */
function computeSegments(sf, body) {
  const stmts = body.statements
  const starts = stmts.map((s) => lineOf(sf, s))
  const idxs = []
  const problems = []
  let prev = -1
  for (const seg of SEGMENTS) {
    let idx = -1
    for (let i = prev + 1; i < starts.length; i++) if (starts[i] >= seg.hint) { idx = i; break }
    if (idx === -1) { problems.push(`段 ${seg.id} 的 hint L${seg.hint} 找不到落点`); idx = prev + 1 }
    idxs.push(idx)
    prev = idx
  }
  return { stmts, idxs, problems }
}

const MARK = (id) => `[J4:seg ${id}]`
const markLine = (id) => `${IND}/* ==================== ${MARK(id)} ==================== */`

/**
 * 一个标识符引用指向的 **body 顶层声明**（没有则 null）。
 *
 * ★ 简写属性 `{ edge }` 是个必须绕开的坑（实测踩过）：
 *   `checker.getSymbolAtLocation(name)` 对简写属性返回的是
 *   **ShorthandPropertyAssignment 这个节点自身的属性符号**（`declName` 就是 `edge` 自己），
 *   而不是被引用的那个变量 —— 于是它永远匹配不上任何顶层声明，改写被**静默跳过**。
 *   `ctxify` 第一版就这样漏掉了 88 处中的 5 处真漏网（`{ edge }` / `{ V, geo, scene }`），
 *   而它们住的都是 `createRoundBox` / `createSolid` 的参数对象 —— 结果是运行时 `ReferenceError`。
 *   正确 API：`getShorthandAssignmentValueSymbol()`。
 */
function resolveTopDecl(checker, sf, declSeg, node) {
  const p = node.parent
  let sym =
    ts.isShorthandPropertyAssignment(p) && p.name === node
      ? checker.getShorthandAssignmentValueSymbol(p)
      : checker.getSymbolAtLocation(node)
  if (sym && sym.flags & ts.SymbolFlags.Alias) sym = checker.getAliasedSymbol(sym)
  const d = sym?.declarations?.[0]
  if (!d || !d.name || !ts.isIdentifier(d.name)) return null
  const off = d.name.getStart(sf)
  return declSeg.has(off) ? declSeg.get(off) : null
}

/** 段 → 字符区间 + 语句列表 */
function segmentRanges(src, sf, body) {
  const { stmts, idxs, problems } = computeSegments(sf, body)
  if (problems.length) {
    console.error('\n✗ 段边界有问题：')
    for (const p of problems) console.error('  · ' + p)
    console.error('')
    process.exit(1)
  }
  return idxs.map((idx, i) => {
    const nextIdx = idxs[i + 1]
    const endIdx = nextIdx === undefined ? stmts.length : nextIdx
    const statements = stmts.slice(idx, endIdx)
    const start = lineStartOffset(src, lineOf(sf, statements[0]))
    const end = nextIdx === undefined ? body.getEnd() - 1 : lineStartOffset(src, lineOf(sf, stmts[nextIdx]))
    return { seg: SEGMENTS[i], start, end, statements }
  })
}

// ── ① ctxify ───────────────────────────────────────────────────────────────
function ctxify() {
  const { src, sf, body, checker } = load()
  if (src.includes('__J4_CTX__')) {
    console.log('\n已经 ctx 化过（找到 __J4_CTX__ 标记）。--ctxify 只做一次。\n')
    return
  }
  const ranges = segmentRanges(src, sf, body)

  // 段内顶层声明 → {off: {segId, kind, name}}
  const declSeg = new Map()
  const exportList = new Map()
  for (const r of ranges) {
    for (const st of r.statements) {
      const add = (nameNode, kind) => {
        const off = nameNode.getStart(sf)
        declSeg.set(off, { segId: r.seg.id, kind, name: nameNode.text })
        if (kind !== 'let') {
          if (!exportList.has(r.seg.id)) exportList.set(r.seg.id, [])
          exportList.get(r.seg.id).push(nameNode.text)
        }
      }
      if (ts.isVariableStatement(st)) {
        const kind = st.declarationList.flags & ts.NodeFlags.Const ? 'const' : 'let'
        for (const d of st.declarationList.declarations) {
          if (ts.isIdentifier(d.name)) add(d.name, kind)
          else for (const el of d.name.elements) if (ts.isIdentifier(el.name)) add(el.name, kind)
        }
      } else if (ts.isFunctionDeclaration(st) && st.name) add(st.name, 'function')
      else if (ts.isClassDeclaration(st) && st.name) add(st.name, 'class')
    }
  }

  const segAtOffset = (off) => {
    for (let i = ranges.length - 1; i >= 0; i--) if (off >= ranges[i].start) return ranges[i]
    return ranges[0]
  }

  // ① 段内导出（先算，因为段标记那一行要把它一并写入 —— 见下面的注释）
  //
  // ★ 导出的**位置**是这套机制唯一的正确性陷阱（实测踩过，代价是页面完全起不来）：
  //
  //   第一版把整段的导出**统一放在段末**。于是 `floor2/wardrobe` 在 floor2 段**中间**装配时，
  //   经 `propTool('cbox', () => ctx.cbox)` 这条惰性 getter 读到 `ctx.cbox` —— 段末还没到，
  //   拿到 undefined ⇒ `TypeError: cbox is not a function` ⇒ 像素回归只报"等待超时（120000ms）"。
  //
  //   根因是导出位置**改变了可见性窗口**，而原文的窗口是：
  //     · `function` 声明 —— **提升**到整个 IIFE 顶部，任何位置都可见（哪怕在声明之前）；
  //     · `const` / `class` —— 在**声明点之后**可见。
  //   所以导出必须复刻这两个窗口：
  //     · `function` → 挂在**段的最前面**（借函数提升）；
  //     · `const` / `class` → **紧跟该声明语句**。
  const fnExports = new Map() // segId -> [names]
  const afterExports = [] // {at, names, segId}
  for (const r of ranges) {
    const fns = []
    r.statements.forEach((st) => {
      if (ts.isFunctionDeclaration(st) && st.name) { fns.push(st.name.text); return }
      const names = []
      if (ts.isVariableStatement(st) && st.declarationList.flags & ts.NodeFlags.Const) {
        for (const d of st.declarationList.declarations) {
          if (ts.isIdentifier(d.name)) names.push(d.name.text)
          else for (const el of d.name.elements) if (ts.isIdentifier(el.name)) names.push(el.name.text)
        }
      } else if (ts.isClassDeclaration(st) && st.name) names.push(st.name.text)
      if (names.length) afterExports.push({ at: st.getEnd(), names, segId: r.seg.id })
    })
    if (fns.length) fnExports.set(r.seg.id, fns)
  }
  /** 每行最多 6 个 `ctx.x = x;` */
  const exportLines = (names, segId, withNote) => {
    const out = []
    for (let i = 0; i < names.length; i += 6) out.push(IND + names.slice(i, i + 6).map((n) => `ctx.${n} = ${n};`).join(' '))
    if (withNote) out.unshift(`${IND}// ↓ J4 段导出（${segId}）：本段函数声明挂到 ctx（借提升，段内任何位置都可见）`)
    return out.join('\n')
  }

  const edits = []
  const stats = { refs: 0, bindings: 0, letPrefix: 0, shorthand: 0 }

  // ② 段标记 —— ★ 与函数导出**必须合成同一个 edit**。
  //    同一偏移上的两次零长插入，在"从后往前应用"时会按**后应用者在前**落位，
  //    分成两个 edit 会让导出行跑到段标记**之前**（实测），段边界随之错位。
  for (const r of ranges) {
    const fns = fnExports.get(r.seg.id)
    const first = r.statements[0]
    // `'use strict'` 必须是函数体的第一条**语句** —— 那种情况下把函数导出挪到它之后
    // （`prelude` 段目前没有函数声明，此分支是防御性的）。
    const isDirective = ts.isExpressionStatement(first) && ts.isStringLiteral(first.expression)
    const head = markLine(r.seg.id) + '\n'
    if (!fns || !fns.length) {
      edits.push({ start: r.start, end: r.start, text: head })
    } else if (isDirective) {
      edits.push({ start: r.start, end: r.start, text: head })
      edits.push({ start: first.getEnd(), end: first.getEnd(), text: `\n${exportLines(fns, r.seg.id, true)}\n` })
    } else {
      edits.push({ start: r.start, end: r.start, text: head + exportLines(fns, r.seg.id, true) + '\n' })
    }
  }
  for (const a of afterExports) {
    edits.push({ start: a.at, end: a.at, text: `\n${exportLines(a.names, a.segId, false)}` })
  }

  // ④ 标识符改写
  /** 引用 `node` 指向的 body 顶层声明（没有则 null） */
  const resolveInfo = (node) => resolveTopDecl(checker, sf, declSeg, node)
  const needsCtx = (node, info) => info && (info.segId !== segAtOffset(node.getStart(sf)).seg.id || info.kind === 'let')
  const walk = (node) => {
    if (ts.isIdentifier(node)) {
      const p = node.parent
      const skip =
        (ts.isPropertyAccessExpression(p) && p.name === node) ||
        (ts.isPropertyAssignment(p) && p.name === node) ||
        (ts.isMethodDeclaration(p) && p.name === node) ||
        (ts.isPropertySignature(p) && p.name === node) ||
        ts.isImportSpecifier(p) || ts.isImportClause(p) || ts.isNamespaceImport(p) ||
        (ts.isFunctionDeclaration(p) && p.name === node) ||
        (ts.isLabeledStatement(p) && p.label === node) ||
        (ts.isBreakOrContinueStatement(p) && p.label === node)
      // ★ 简写属性 `{ fullHouse }` 是个**必须单独处理**的形态：
      //   这个标识符既是键又是值，只改它会把对象变成 `{ ctx.fullHouse }`（语法错）。
      //   正确做法是替换**整个** ShorthandPropertyAssignment 为 `fullHouse: ctx.fullHouse`。
      //   ——`J5` 的 `nearestTarget(pos, { fullHouse })` 就是这样漏过第一版的（实测）。
      const isShorthand = ts.isShorthandPropertyAssignment(p) && p.name === node
      const isBinding = ts.isVariableDeclaration(p) && p.name === node
      if (!skip) {
        if (isShorthand) {
          const info = resolveInfo(node)
          if (needsCtx(node, info)) {
            edits.push({ start: p.getStart(sf), end: p.getEnd(), text: `${info.name}: ctx.${info.name}` })
            stats.shorthand++
          }
        } else if (isBinding) {
          const info = declSeg.get(node.getStart(sf)) || null
          if (info && info.kind === 'let') {
            edits.push({ start: node.getStart(sf), end: node.getEnd(), text: `ctx.${info.name}` })
            stats.bindings++
          }
        } else {
          const info = resolveInfo(node)
          if (needsCtx(node, info)) {
            edits.push({ start: node.getStart(sf), end: node.getEnd(), text: `ctx.${info.name}` })
            stats.refs++
          }
        }
      }
    }
    ts.forEachChild(node, walk)
  }
  walk(sf)

  // ④ `let ` 前缀删除（声明已变成纯赋值）
  for (const r of ranges) {
    for (const st of r.statements) {
      if (ts.isVariableStatement(st) && !(st.declarationList.flags & ts.NodeFlags.Const)) {
        const dl = st.declarationList
        edits.push({ start: dl.getStart(sf), end: dl.declarations[0].getStart(sf), text: '' })
        stats.letPrefix++
      }
    }
  }

  // ── 应用编辑（从后往前）─────────────────────────────────────────────────
  edits.sort((a, b) => (b.start - a.start) || (b.end - a.end))
  // 重叠自检：同一偏移上的多个零长插入要按原顺序拼回
  let out = src
  let prevStart = Infinity
  for (const e of edits) {
    if (e.end > prevStart) {
      console.error(`\n✗ 编辑区间重叠（未写盘）：[${e.start},${e.end}) 与上一个起点 ${prevStart}`)
      process.exit(1)
    }
    out = out.slice(0, e.start) + e.text + out.slice(e.end)
    prevStart = e.start
  }

  // ── IIFE 改成接受 ctx ───────────────────────────────────────────────────
  const head = '(function () {'
  const hi = out.indexOf(head)
  if (hi === -1) throw new Error('找不到 IIFE 头')
  out = out.slice(0, hi) + '(function (ctx) {' + out.slice(hi + head.length)
  const tail = '})();'
  const ti = out.lastIndexOf(tail)
  if (ti === -1) throw new Error('找不到 IIFE 尾')
  out = out.slice(0, ti) + '})(ctx);' + out.slice(ti + tail.length)

  const anchor = '    const { registry, bus, scheduler, store } = app;'
  if (!out.includes(anchor)) throw new Error('找不到 installCabin 的解构行')
  out = out.replace(
    anchor,
    `${anchor}\n` +
      `    /* __J4_CTX__ ★ J4 段间通信的唯一载体（段表见 scripts/oneoff/_j4-segments.mjs）。\n` +
      `       段内顶层 let 都住在这里；段内顶层 const/function 在段末挂到这里。\n` +
      `       段序 = 执行序（rng 调用顺序 / scene.add 顺序 / 光源槽序都由它决定）。 */\n` +
      `    const ctx = Object.create(null);`,
  )

  // ── 报告 ────────────────────────────────────────────────────────────────
  console.log('\nJ4 段应用器 · --ctxify')
  console.log('─'.repeat(74))
  for (const r of ranges) {
    const n = (exportList.get(r.seg.id) || []).length
    console.log(`  ${r.seg.id.padEnd(14)} L${lineOf(sf, r.statements[0])}–${sf.getLineAndCharacterOfPosition(r.end - 1).line + 1}  ${String(r.statements.length).padStart(3)} 语句  ${String(n).padStart(3)} 导出  ${r.seg.note}`)
  }
  console.log(`\n  跨段/可变引用改写 ${stats.refs} 处；简写属性改写 ${stats.shorthand} 处；let 绑定改写 ${stats.bindings} 处；let 前缀删除 ${stats.letPrefix} 处`)
  console.log(`  行数 ${src.split('\n').length} → ${out.split('\n').length}`)

  if (DRY) { console.log('\n--dry-run：未写盘。\n'); return }
  fs.writeFileSync(MONOLITH, out, 'utf8')
  console.log(`\n✓ 已写盘 ${path.relative(ROOT, MONOLITH)}\n`)
}

// ── ③ check：验证"段间通信是否真的全走 ctx" ───────────────────────────────
//
// ★ 这条判据表达的是**问题本身**，不是问题的影子。
//   `J3.1` 的教训：旧判据的粒度是"每件物件 ≥1 个入口"，于是只要有**一个**入口就算通过，
//   9 个缺口全部漏网。这里同理 —— "ctxify 跑过了"不等于"改写完整"：
//   只要有一个标识符漏改（简写属性、新形态的引用），那处就会在**运行时**变成
//   ReferenceError，而它多半住在某个只在特定分支才执行的函数里 —— 门禁与像素回归都看不见。
//   所以判据必须是**逐个引用**地重算一遍"这个引用该不该带 ctx 前缀"。
function check() {
  const { src, sf, body, checker } = load()
  if (!src.includes('__J4_CTX__')) {
    console.error('\n✗ monolith 尚未 ctx 化（找不到 __J4_CTX__）\n')
    process.exit(1)
  }
  const lines = src.split('\n')
  const marks = []
  lines.forEach((l, i) => {
    const m = l.match(/\[J4:seg ([\w-]+)\]/)
    if (m) marks.push({ id: m[1], line: i + 1 })
  })
  const ranges = marks.map((m, i) => ({
    id: m.id,
    start: lineStartOffset(src, m.line),
    end: i + 1 < marks.length ? lineStartOffset(src, marks[i + 1].line) : body.getEnd(),
  }))
  const segAt = (off) => {
    for (let i = ranges.length - 1; i >= 0; i--) if (off >= ranges[i].start) return ranges[i].id
    return null
  }

  // 段内顶层声明（ctx 化后只剩 const / function / class）
  const declSeg = new Map()
  for (const st of body.statements) {
    const id = segAt(st.getStart(sf))
    if (!id) continue
    const add = (nameNode, kind) => declSeg.set(nameNode.getStart(sf), { segId: id, kind, name: nameNode.text })
    if (ts.isVariableStatement(st)) {
      const kind = st.declarationList.flags & ts.NodeFlags.Const ? 'const' : 'let'
      for (const d of st.declarationList.declarations) {
        if (ts.isIdentifier(d.name)) add(d.name, kind)
        else for (const el of d.name.elements) if (ts.isIdentifier(el.name)) add(el.name, kind)
      }
    } else if (ts.isFunctionDeclaration(st) && st.name) add(st.name, 'function')
    else if (ts.isClassDeclaration(st) && st.name) add(st.name, 'class')
  }

  const problems = []
  const ctxUsed = new Set()
  let okInSeg = 0
  let okCtx = 0
  const walk = (node) => {
    if (ts.isIdentifier(node)) {
      const p = node.parent
      const L = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1
      if (ts.isPropertyAccessExpression(p) && p.name === node && p.expression.getText(sf) === 'ctx') {
        ctxUsed.add(node.text)
        okCtx++
      } else if (ts.isShorthandPropertyAssignment(p) && p.name === node) {
        // 简写属性**只有**当它引用的确实是"另一段的顶层声明"时才需要改写 ——
        // 绝大多数 `{ g }` / `{ m }` / `{ steam }` 引用的是函数局部变量或参数，本就不该动。
        const info = resolveTopDecl(checker, sf, declSeg, node)
        if (info && info.segId !== segAt(node.getStart(sf))) {
          problems.push(`L${L} 简写属性 { ${node.text} } 未改写（应为 { ${node.text}: ctx.${node.text} }）`)
        }
      } else {
        const skip =
          (ts.isPropertyAccessExpression(p) && p.name === node) ||
          (ts.isPropertyAssignment(p) && p.name === node) ||
          (ts.isMethodDeclaration(p) && p.name === node) ||
          (ts.isPropertySignature(p) && p.name === node) ||
          ts.isImportSpecifier(p) || ts.isImportClause(p) || ts.isNamespaceImport(p) ||
          (ts.isFunctionDeclaration(p) && p.name === node) ||
          (ts.isLabeledStatement(p) && p.label === node) ||
          (ts.isBreakOrContinueStatement(p) && p.label === node) ||
          (ts.isVariableDeclaration(p) && p.name === node) ||
          (ts.isBindingElement(p) && p.name === node)
        if (!skip) {
          const info = resolveTopDecl(checker, sf, declSeg, node)
          if (info) {
            const here = segAt(node.getStart(sf))
            if (info.segId !== here) {
              problems.push(`L${L} 跨段引用 \`${node.text}\`（当前段 ${here} ← 声明在段 ${info.segId}）未走 ctx`)
            } else if (info.kind === 'let') {
              problems.push(`L${L} 顶层 let \`${node.text}\` 未被 ctx 化（可变状态会各持一份副本）`)
            } else okInSeg++
          }
        }
      }
    }
    ts.forEachChild(node, walk)
  }
  walk(sf)

  // 段末导出是否覆盖了所有被跨段用到的名字。
  // ⚠️ 必须遍历**所有**赋值表达式而不是只看 `ExpressionStatement`：
  //    `let a = 1, b = 2` 被改写成 `ctx.a = 1, ctx.b = 2`（逗号表达式），
  //    只看语句层会漏掉后半截，于是 53 个顶层 let 被误报成"从未声明/导出"。
  const exported = new Set()
  const collectAssign = (n) => {
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      const left = n.left
      if (ts.isPropertyAccessExpression(left) && left.expression.getText(sf) === 'ctx') exported.add(left.name.text)
    }
    ts.forEachChild(n, collectAssign)
  }
  collectAssign(body)
  // ★ 已搬出的段模块里的 `ctx.x = …` 同样是"导出" —— 只扫 monolith 会把它们
  //   误报成"从未声明/导出"（实测：搬走 ui 两段后立刻出现 4 个假阳性）。
  const collectFrom = (text, file) => {
    const msf = ts.createSourceFile(file, text, ts.ScriptTarget.ESNext, true, ts.ScriptKind.JS)
    const w = (n) => {
      if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
        const left = n.left
        if (ts.isPropertyAccessExpression(left) && left.expression.getText(msf) === 'ctx') exported.add(left.name.text)
      }
      ts.forEachChild(n, w)
    }
    w(msf)
  }
  const movedModules = []
  for (const s of SEGMENTS) {
    if (!s.module) continue
    const p = path.join(ROOT, 'src/cabin', s.module)
    if (!fs.existsSync(p)) continue
    collectFrom(fs.readFileSync(p, 'utf8'), p)
    movedModules.push(s.id)
  }
  const missing = [...ctxUsed].filter((n) => !exported.has(n))
  // `ctx.x` 也可能是"段内 let"（本来就不导出）—— 只在没有任何段声明它时才报
  const declaredAnywhere = new Set([...declSeg.values()].map((d) => d.name))
  const reallyMissing = missing.filter((n) => !declaredAnywhere.has(n))

  console.log('\nJ4 段应用器 · --check（段间通信完整性）')
  console.log('─'.repeat(74))
  console.log(`  段数 ${ranges.length}；段内声明 ${declSeg.size} 个；ctx 引用 ${okCtx} 处；段内直引 ${okInSeg} 处`)
  console.log(`  段末导出 ${exported.size} 个键（含已搬出模块：${movedModules.join(' / ') || '无'}）`)
  if (reallyMissing.length) console.log(`  被 ctx 引用但从未声明/导出 ${reallyMissing.length} 个：${reallyMissing.slice(0, 20).join(', ')}`)
  if (problems.length) {
    console.log(`\n✗ ${problems.length} 项漏网：`)
    for (const p of problems.slice(0, 40)) console.log('  · ' + p)
    if (problems.length > 40) console.log(`  …… 另有 ${problems.length - 40} 项`)
    console.log('')
    process.exit(1)
  }
  console.log('\n✓ 段间通信完整：没有任何跨段 / 可变引用绕过 ctx\n')
}

// ── ④ move：把一段搬到它的目标模块 ────────────────────────────────────────
//
// 段代码**一个字不改**（它已经是 `ctx` 形式），只做三件事：
//   ① 包进 `export function installXxx(ctx, app) { … }`；
//   ② 把它引用的**模块级绑定**补成 import（`three` / `../app/rng.js` …）或
//      从 `app` 解构（`registry` / `bus` / `scheduler` / `store`）；
//   ③ monolith 里那一整段换成一次调用。
//
// ⚠️ 不给段模块"再抄一份实现"的机会：它 import 的是**原模块**，
//    不是复制品 —— 复制品会让代码库分叉（`world/README.md` ② 的同一条道理）。
function move() {
  const { src, sf, body, installBody, checker } = load()
  const seg = SEGMENTS.find((s) => s.id === MOVE)
  if (!seg) { console.error(`\n✗ 没有段 ${MOVE}\n`); process.exit(1) }
  if (!seg.module || !seg.fn) { console.error(`\n✗ 段 ${MOVE} 未声明 module/fn，不能搬\n`); process.exit(1) }

  const lines = src.split('\n')
  const startIdx = lines.findIndex((l) => l.includes(MARK(seg.id)))
  if (startIdx === -1) { console.error(`\n✗ monolith 里找不到段标记 ${MARK(seg.id)}（先跑 --ctxify）\n`); process.exit(1) }
  let endIdx = lines.length
  for (let i = startIdx + 1; i < lines.length; i++) if (/\[J4:seg [\w-]+\]/.test(lines[i])) { endIdx = i; break }
  const segBody = lines.slice(startIdx + 1, endIdx)
  while (segBody.length && !segBody[segBody.length - 1].trim()) segBody.pop()

  // 幂等：已经搬过（段体只剩一行调用）就跳过
  const calls = segBody.filter((l) => l.trim() && !l.trim().startsWith('//'))
  if (calls.length === 1 && calls[0].includes(`${seg.fn}(ctx`)) {
    console.log(`\n段 ${seg.id} 已经搬过了（monolith 里只剩调用）。\n`)
    return
  }

  const bodyStart = lineStartOffset(src, startIdx + 2)
  const bodyEnd = lineStartOffset(src, endIdx + 1)

  // ── monolith 的模块级绑定表 ─────────────────────────────────────────────
  const importOf = new Map() // declOffset -> {spec, name, kind}
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st)) continue
    const spec = st.moduleSpecifier.text
    const cl = st.importClause
    if (!cl) continue
    if (cl.name) importOf.set(cl.name.getStart(sf), { spec, name: cl.name.text, kind: 'namespace' })
    if (cl.namedBindings) {
      if (ts.isNamespaceImport(cl.namedBindings)) {
        importOf.set(cl.namedBindings.name.getStart(sf), { spec, name: cl.namedBindings.name.text, kind: 'namespace' })
      } else {
        for (const el of cl.namedBindings.elements) importOf.set(el.name.getStart(sf), { spec, name: el.name.text, kind: 'named' })
      }
    }
  }
  // `installCabin` 里的 `const { registry, bus, scheduler, store } = app;`
  //
  // ⚠️ 这一条**不在 IIFE 体内** —— 它在 `installCabin` 的函数体里、IIFE 之前。
  //    第一版只扫了 IIFE 顶层，于是 `bus` / `store` 没被认出来，生成的模块里
  //    `bus.on(...)` 成了未定义引用（`tsc` 对 `checkJs:false` 的 .js **不会报**，
  //    只有页面跑起来才炸）。判据见下面的 `unknown` 集合 —— 它专门守这类漏网。
  const appNames = new Map() // declOffset -> name
  for (const st of installBody.statements) {
    if (!ts.isVariableStatement(st)) continue
    for (const d of st.declarationList.declarations) {
      if (ts.isObjectBindingPattern(d.name) && d.initializer?.getText(sf) === 'app') {
        for (const el of d.name.elements) if (ts.isIdentifier(el.name)) appNames.set(el.name.getStart(sf), el.name.text)
      }
    }
  }

  // ── 段体的自由标识符 ───────────────────────────────────────────────────
  const bySpec = new Map() // spec -> Set(name)
  const appUsed = new Set()
  const unknown = new Set()
  const visit = (node) => {
    const s = node.getStart(sf)
    if (s >= bodyStart && s < bodyEnd && ts.isIdentifier(node)) {
      const p = node.parent
      const skip =
        (ts.isPropertyAccessExpression(p) && p.name === node) ||
        (ts.isPropertyAssignment(p) && p.name === node) ||
        (ts.isMethodDeclaration(p) && p.name === node) ||
        (ts.isPropertySignature(p) && p.name === node) ||
        ts.isImportSpecifier(p) || ts.isImportClause(p) || ts.isNamespaceImport(p) ||
        (ts.isFunctionDeclaration(p) && p.name === node) ||
        (ts.isVariableDeclaration(p) && p.name === node) ||
        (ts.isBindingElement(p) && p.name === node) ||
        (ts.isLabeledStatement(p) && p.label === node) ||
        (ts.isBreakOrContinueStatement(p) && p.label === node) ||
        (ts.isPropertyAccessExpression(p) && p.expression === node && p.expression.getText(sf) === 'ctx')
      if (!skip) {
        const sym = checker.getSymbolAtLocation(node)
        const d = sym?.declarations?.[0]
        // 只有**本文件**里的声明才需要搬运；`document` / `Math` 这类来自 lib.dom / lib.es*
        // 的声明不在 `sf` 里 —— 它们是 JS 全局，搬出去照样能用（第一版就是这样误报的）。
        if (d && d.getSourceFile() === sf) {
          const off = d.getStart(sf)
          if (importOf.has(off)) {
            const info = importOf.get(off)
            if (!bySpec.has(info.spec)) bySpec.set(info.spec, new Set())
            bySpec.get(info.spec).add(info.name)
          } else if (appNames.has(off)) {
            appUsed.add(appNames.get(off))
          } else if (off < bodyStart || off >= bodyEnd) {
            // 声明在段外、又不是 import / app 解构 ⇒ 搬出去以后这个裸标识符就没人给了。
            // 它**必须**被报出来：这类错 tsc 不查（checkJs:false），只有页面跑起来才炸，
            // 而像素回归只会说"等待超时"。
            unknown.add(node.text)
          }
        } else {
          // 完全解析不到 ⇒ JS 全局（window / document / Math …）或 `ctx`，都正常
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)

  // ── 生成模块 ───────────────────────────────────────────────────────────
  const CABIN = path.join(ROOT, 'src/cabin')
  // 段表里的 `module` 一律相对 `src/cabin/`（与 `systems/README.md` 的写法一致）
  const modPath = path.join(CABIN, seg.module)
  const modDir = path.dirname(modPath)
  const importLines = []
  for (const [spec, names] of bySpec) {
    let out = spec
    if (spec.startsWith('.')) {
      const abs = path.resolve(CABIN, 'legacy', spec)
      out = path.relative(modDir, abs).replace(/\\/g, '/')
      if (!out.startsWith('.')) out = './' + out
    }
    const list = [...names]
    const ns = list.find((n) => {
      const info = [...importOf.values()].find((i) => i.name === n && i.spec === spec)
      return info?.kind === 'namespace'
    })
    importLines.push(ns ? `import * as ${ns} from '${out}'` : `import { ${list.sort().join(', ')} } from '${out}'`)
  }
  importLines.sort()

  const note = seg.note || ''
  const head =
    `/**\n` +
    ` * ${note} —— 从 \`legacy/monolith.js\` 搬出的整段（${seg.id}）\n` +
    ` *\n` +
    ` * 来源：\`J4\` 段切片（段表见 \`scripts/oneoff/_j4-segments.mjs\`）。\n` +
    ` * 段内代码**逐字未改**，只做了三件事：包成函数、补 import、把跨段通信交给 \`ctx\`。\n` +
    ` * 因此这个文件的正确性判据与搬迁前完全一致：像素逐字节零差异。\n` +
    ` *\n` +
    ` * @param {object} ctx 段间通信载体（见 \`installCabin\` 的 \`__J4_CTX__\`）\n` +
    ` * @param {object} app 应用内核 —— 段里用到的 \`registry\`/\`bus\`/\`scheduler\`/\`store\` 从这里解构\n` +
    ` */\n`
  const fnSig = `export function ${seg.fn}(ctx, app) {\n`
  const appHead = appUsed.size ? `  const { ${[...appUsed].sort().join(', ')} } = app\n` : ''
  const modText = `${head}${importLines.length ? importLines.join('\n') + '\n\n' : ''}${fnSig}${appHead}${segBody.join('\n')}\n}\n`

  // ── 改写 monolith ──────────────────────────────────────────────────────
  const rel = './' + path.relative(path.dirname(MONOLITH), modPath).replace(/\\/g, '/')
  const callReplacement =
    `${IND}// J4（${seg.id}）：本段已搬入 ${seg.module.replace(/\\/g, '/')}\n` +
    `${IND}${seg.fn}(ctx, app);\n`
  let out = src.slice(0, bodyStart) + callReplacement + src.slice(bodyEnd)
  // import
  const anchor = "import { createPropInstaller } from '../app/installProp.js'"
  const imp = `import { ${seg.fn} } from '${rel}'`
  if (!out.includes(imp)) {
    if (!out.includes(anchor)) { console.error('\n✗ 找不到 import 锚点\n'); process.exit(1) }
    out = out.replace(anchor, `${anchor}\n${imp}`)
  }

  console.log(`\nJ4 段应用器 · --move=${seg.id}`)
  console.log('─'.repeat(74))
  console.log(`  monolith L${startIdx + 1}–L${endIdx}（${segBody.length} 行）→ ${seg.module}`)
  console.log(`  补 import ${importLines.length} 条${appUsed.size ? `；从 app 解构 ${[...appUsed].sort().join('/')}` : ''}`)
  if (unknown.size) console.log(`  ⚠ 未解析的标识符：${[...unknown].join(', ')}`)
  if (unknown.size) {
    console.error(`\n✗ 段 ${seg.id} 里有 ${unknown.size} 个标识符搬出去以后没人给（**未写盘**）：`)
    console.error(`    ${[...unknown].sort().join(', ')}`)
    console.error(`  它们既不是 import、也不是 app 的解构、也不住在段内 —— 需要先决定来源。\n`)
    process.exit(1)
  }
  if (DRY) { console.log('\n--dry-run：未写盘。\n'); return }
  fs.mkdirSync(path.dirname(modPath), { recursive: true })
  fs.writeFileSync(modPath, modText, 'utf8')
  fs.writeFileSync(MONOLITH, out, 'utf8')
  console.log(`\n✓ 已写盘 ${seg.module}\n✓ 已写盘 ${path.relative(ROOT, MONOLITH)}\n`)
}

if (CTXIFY) ctxify()
else if (argv.includes('--check')) check()
else if (MOVE) move()
else console.log('\n用法：--report / --ctxify [--dry-run] / --check / --move=<id>\n')
