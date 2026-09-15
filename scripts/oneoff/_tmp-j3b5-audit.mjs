/**
 * 临时审计（B5）：给定 [startLine, endLine) 区间，列出**区间内声明的顶层标识符**中
 * 仍被区间外读取的那些。用途：判断二楼剩余分区能不能整段搬走。
 * 不是交付物，跑完即删。
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '../..')
const MONO = path.join(ROOT, 'src/cabin/legacy/monolith.js')
const lines = fs.readFileSync(MONO, 'utf8').split('\n')

function strip(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
}

/** 收集声明名：const/let/var 的**全部** declarator + function 名 */
function declared(text) {
  const t = strip(text)
  const names = new Set()
  for (const m of t.matchAll(/\b(?:const|let|var)\s+/g)) {
    // 从声明关键字后开始，按 depth 0 的逗号切分，直到 depth 0 的 ';'
    let i = m.index + m[0].length
    let depth = 0, buf = ''
    for (; i < t.length; i++) {
      const ch = t[i]
      if ('([{'.includes(ch)) depth++
      else if (')]}'.includes(ch)) { if (depth === 0) break; depth-- }
      else if (ch === ';' && depth === 0) break
      else if (ch === ',' && depth === 0) { buf += '\u0000'; continue }
      buf += ch
    }
    for (const part of buf.split('\u0000')) {
      const mm = part.match(/^\s*([A-Za-z_$][A-Za-z0-9_$]*)/)
      if (mm) names.add(mm[1])
    }
  }
  for (const m of t.matchAll(/\bfunction\s+([A-Za-z_$][A-Za-z0-9_$]*)/g)) names.add(m[1])
  return names
}

const region = (a, b) => lines.slice(a - 1, b).join('\n')
const outsideLines = (a, b) => [...lines.slice(0, a - 1), ...lines.slice(b)]

const REGIONS = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '_tmp-j3b5-regions.json'), 'utf8'))

for (const r of REGIONS) {
  const decl = declared(region(r.a, r.b))
  const out = outsideLines(r.a, r.b).map(strip)
  const leaked = []
  for (const name of decl) {
    const re = new RegExp(`(^|[^A-Za-z0-9_$.])${name.replace(/\$/g, '\\$')}([^A-Za-z0-9_$]|$)`)
    const hits = []
    for (let i = 0; i < out.length; i++) if (re.test(out[i])) hits.push(r.a > i + 1 ? i + 1 : i + (r.b - r.a) + 1)
    if (hits.length) leaked.push({ name, hits })
  }
  console.log(`\n=== ${r.name}  [${r.a}..${r.b}] 声明 ${decl.size} 个，区间外被读 ${leaked.length} 个 ===`)
  for (const l of leaked) console.log(`  · ${l.name.padEnd(22)} ×${String(l.hits.length).padStart(3)}  @ ${l.hits.slice(0, 10).join(',')}${l.hits.length > 10 ? ' …' : ''}`)
}
