/**
 * J4 段切片护栏 —— 守"段间通信是否真的全走 `ctx`"
 *
 * 来源：新增（`J4.1`）。`J4` 把 `legacy/monolith.js` 的 6105 行 IIFE 体按段切开，
 * 段与段之间**只能**通过 `ctx` 通信（段表见 `scripts/oneoff/_j4-segments.mjs`）。
 *
 * ## 为什么要有这条判据（`J3.1` 的教训）
 *
 * 判据的粒度决定它能不能发现问题。旧判据"每件物件 ≥1 个入口"让 `long-table` 只要有
 * **鱼盘**一个入口就算通过，9 个缺口全部漏网。这里同理 —— 如果只断言"`ctxify` 跑过了"，
 * 那么**任何一处漏改**（新形态的引用、简写属性、后加的代码）都能蒙混过关，
 * 而它们全都只在运行时炸：页面起不来，像素回归只会说"等待超时（120000ms）"。
 *
 * 所以本文件的判据是**逐个引用**地重算一遍"这个引用该不该带 `ctx` 前缀"。
 *
 * ## 三条护栏
 *
 * | # | 断言 | 守什么 |
 * |---|---|---|
 * | 1 | monolith 的段标记与段表**一一对应、顺序一致** | 段序 = 执行序（rng / scene.add / 光源槽序） |
 * | 2 | ★ **没有跨段裸引用**、**没有未 ctx 化的顶层 `let`** | 段已经不是同一个作用域了 |
 * | 3 | 已搬出的段：模块存在、导出 `installXxx(ctx, app)`、monolith 里只剩一次调用 | 搬迁是"剪切"不是"复制" |
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { SEGMENTS } from '../../scripts/oneoff/_j4-segments.mjs'

const ROOT = path.resolve(import.meta.dirname, '../..')
const MONOLITH = path.join(ROOT, 'src/cabin/legacy/monolith.js')
const SRC = fs.readFileSync(MONOLITH, 'utf8')

const lineStartOffset = (src, lineNo1) => {
  let off = 0
  for (let i = 1; i < lineNo1; i++) off = src.indexOf('\n', off) + 1
  return off
}

/** 段标记：`[J4:seg <id>]` —— 顺序即执行序 */
function marks() {
  const out = []
  SRC.split('\n').forEach((l, i) => {
    const m = l.match(/\[J4:seg ([\w-]+)\]/)
    if (m) out.push({ id: m[1], line: i + 1 })
  })
  return out
}

test('J4 段切片：段标记与段表一一对应、顺序一致', () => {
  const ms = marks()
  assert.equal(ms.length, SEGMENTS.length, `段标记数 ${ms.length} ≠ 段表 ${SEGMENTS.length}`)
  ms.forEach((m, i) => {
    assert.equal(m.id, SEGMENTS[i].id, `第 ${i + 1} 个段标记是 ${m.id}，段表写的是 ${SEGMENTS[i].id}（段序 = 执行序，不能换）`)
  })
})

test('J4 段切片：★ 段间通信全走 ctx（没有跨段裸引用，没有漏 ctx 化的顶层 let）', () => {
  const program = ts.createProgram([MONOLITH], {
    allowJs: true, checkJs: false, target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext, noResolve: true, skipLibCheck: true,
  })
  const sf = program.getSourceFile(MONOLITH)
  const checker = program.getTypeChecker()
  assert.ok(sf, '无法解析 monolith')

  let body = null
  const find = (n) => {
    if (ts.isFunctionDeclaration(n) && n.name?.text === 'installCabin') {
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
  assert.ok(body, '找不到 installCabin 里的 IIFE（`ctxify` 之后的形态是 `(function (ctx) { … })(ctx)`）')

  // 段区间（按标记行切）
  const ms = marks()
  const ranges = ms.map((m, i) => ({
    id: m.id,
    start: lineStartOffset(SRC, m.line),
    end: i + 1 < ms.length ? lineStartOffset(SRC, ms[i + 1].line) : body.getEnd(),
  }))
  const segAt = (off) => {
    for (let i = ranges.length - 1; i >= 0; i--) if (off >= ranges[i].start) return ranges[i].id
    return null
  }

  // 段内顶层声明（`ctxify` 之后顶层 let 已变成 `ctx.x = …` 赋值，只剩 const/function）
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
  }

  const problems = []
  const walk = (node) => {
    if (ts.isIdentifier(node)) {
      const p = node.parent
      const L = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1
      const isCtxAccess = ts.isPropertyAccessExpression(p) && p.name === node && p.expression.getText(sf) === 'ctx'
      const isShorthand = ts.isShorthandPropertyAssignment(p) && p.name === node
      const skip =
        isCtxAccess ||
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
        // ★ 简写属性 `{ x }` 必须用 getShorthandAssignmentValueSymbol ——
        //   `getSymbolAtLocation` 对它会返回**节点自己**的属性符号（`declName` 就是 `x`），
        //   永远匹配不上任何声明，于是漏改被静默放过（`J4.1` 实测踩过 5 处）。
        let sym = isShorthand ? checker.getShorthandAssignmentValueSymbol(p) : checker.getSymbolAtLocation(node)
        if (sym && sym.flags & ts.SymbolFlags.Alias) sym = checker.getAliasedSymbol(sym)
        const d = sym?.declarations?.[0]
        if (d && d.getSourceFile() === sf && d.name && ts.isIdentifier(d.name)) {
          const info = declSeg.get(d.name.getStart(sf))
          if (info) {
            const here = segAt(node.getStart(sf))
            if (info.segId !== here) {
              problems.push(`L${L} 跨段裸引用 \`${node.text}\`（段 ${here} ← 声明在段 ${info.segId}）—— 必须写成 ctx.${node.text}`)
            } else if (info.kind === 'let') {
              problems.push(`L${L} 顶层 let \`${node.text}\` 未 ctx 化 —— 可变状态会各持一份副本`)
            }
          }
        }
      }
    }
    ts.forEachChild(node, walk)
  }
  walk(sf)

  assert.deepEqual(problems, [], `发现 ${problems.length} 处绕过 ctx 的引用：\n  ` + problems.slice(0, 20).join('\n  '))
})

test('J4 段切片：已搬出的段是「剪切」而不是「复制」', () => {
  const ms = marks()
  let movedCount = 0
  ms.forEach((m, i) => {
    const seg = SEGMENTS.find((s) => s.id === m.id)
    assert.ok(seg, `段标记 ${m.id} 不在段表里`)
    const bodyLines = SRC.split('\n').slice(m.line, i + 1 < ms.length ? ms[i + 1].line - 1 : undefined)
    const code = bodyLines.filter((l) => l.trim() && !l.trim().startsWith('//'))

    const isMoved = code.length === 1 && /^\s*[\w$]+\(ctx[,)]/.test(code[0])
    if (!isMoved) {
      // 还没搬：段体应当**整段仍住在 monolith 里**（`module` 字段此时只是计划）
      assert.ok(code.length > 1, `段 ${seg.id} 在 monolith 里只剩 ${code.length} 行，但既不像"未搬"也不像"已搬"`)
      return
    }
    movedCount++
    assert.ok(seg.module && seg.fn, `段 ${seg.id} 已经搬走了（monolith 里只剩调用），但段表没写 module/fn`)
    const p = path.join(ROOT, 'src/cabin', seg.module)
    assert.ok(fs.existsSync(p), `段 ${seg.id} 声明搬到了 ${seg.module}，但文件不存在`)
    const mod = fs.readFileSync(p, 'utf8')
    assert.match(mod, new RegExp(`export function ${seg.fn}\\s*\\(ctx`), `${seg.module} 没有导出 ${seg.fn}(ctx, …)`)
    assert.ok(code[0].includes(`${seg.fn}(ctx`), `段 ${seg.id} 在 monolith 里的那一行不是调用 ${seg.fn}(ctx, …)`)
  })
  assert.ok(movedCount > 0, '一个已搬出的段都没有？（`J4.1` 之后 ui 两段应当已搬）')
})
