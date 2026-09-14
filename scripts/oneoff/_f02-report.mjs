// 用模板 + 替换记录生成 F0.2 实施报告
// 模板：scripts/oneoff/_f02-report.template.md
// 数据：.cache/f02-replacements.json
// 输出：Magic-cabin/docs/实施结果/F0.2-实施结果.md
//
// 命名约定：实施记录以**阶段号**标识（F0.2 / F2 / F3…），不使用位置序号 ——
// 它属于工程自身的文档，不延续 ArtLine-Part 设计文档的 01–09 编号。
import fs from 'node:fs'
import path from 'node:path'

const ROOT = 'D:/FireflyQAQ/Project/FrontProj/Magic-cabin'
const OUT = path.join(ROOT, 'docs/实施结果/F0.2-实施结果.md')

const tpl = fs.readFileSync(path.join(ROOT, 'scripts/oneoff/_f02-report.template.md'), 'utf8')
const data = JSON.parse(fs.readFileSync(path.join(ROOT, '.cache/f02-replacements.json'), 'utf8'))

const CLS_NAME = { A: 'A 构建期', B: 'B 运行期', C: 'C 初始化' }

// ── 区段汇总 ──
const segs = data.map
  .map(([from, to, rng, cls, desc]) => {
    const recs = data.records.filter((x) => x.line >= from && x.line <= to)
    return {
      from,
      to,
      rng: rng + 'Rng',
      cls,
      desc,
      lines: recs.length,
      calls: recs.reduce((a, b) => a + b.calls, 0),
    }
  })
  .sort((a, b) => a.from - b.from)

const segTable = segs
  .map(
    (s) =>
      `| L${s.from}${s.to !== s.from ? '–' + s.to : ''} | \`${s.rng}\` | ${CLS_NAME[s.cls]} | ${s.calls} | ${s.lines} | ${s.desc} |`,
  )
  .join('\n')

// ── 逐行明细 ──
const compact = (s, n = 92) => {
  const t = s.replace(/\s+/g, ' ').trim().replace(/\|/g, '\\|')
  return t.length > n ? t.slice(0, n) + '…' : t
}
const segOf = (line) => {
  const s = segs.find((x) => line >= x.from && line <= x.to)
  return s ? `L${s.from}${s.to !== s.from ? '–' + s.to : ''}` : '—'
}
const lineTable = data.records
  .map((r) => `| ${r.line} | ${segOf(r.line)} | \`${r.rng}\` | ${r.calls} | \`${compact(r.after)}\` |`)
  .join('\n')

const byCls = Object.entries(data.byCls)
  .map(([k, v]) => `| ${CLS_NAME[k]} | ${v} | ${((v / data.totals.calls) * 100).toFixed(1)}% |`)
  .join('\n')
const byRng = Object.entries(data.byRng)
  .sort((a, b) => b[1] - a[1])
  .map(([k, v]) => `| \`${k}\` | ${v} |`)
  .join('\n')

// ⚠️ 必须用 replaceAll：占位符在正文中出现多次，String.replace 只替换第一个匹配
//    （曾因此把模板开头注释里的占位符替换掉，而正文里的全部残留）
const doc = tpl
  .replaceAll('{{TOTALS_CALLS}}', String(data.totals.calls))
  .replaceAll('{{TOTALS_LINES}}', String(data.totals.lines))
  .replaceAll('{{SEG_COUNT}}', String(segs.length))
  .replaceAll('{{SEG_TABLE}}', segTable)
  .replaceAll('{{LINE_TABLE}}', lineTable)
  .replaceAll('{{BY_CLS}}', byCls)
  .replaceAll('{{BY_RNG}}', byRng)

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, doc, 'utf8')

// 校验：不应残留占位符
const left = doc.match(/\{\{[A-Z_]+\}\}/g)
console.log('已生成', OUT)
console.log('行数:', doc.split('\n').length, '｜ 大小:', (doc.length / 1024).toFixed(1), 'KB')
console.log('区段表:', segs.length, '行 ｜ 明细表:', data.records.length, '行')
console.log('残留占位符:', left ? left.join(', ') : '无')
