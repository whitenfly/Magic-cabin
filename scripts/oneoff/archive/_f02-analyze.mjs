// F0.2 分析：为 monolith.js 中每一处 Math.random() 提取上下文并分类
// 输出：.cache/f02-analysis.json（供人工审核与替换脚本使用）
import fs from 'node:fs'
import path from 'node:path'

const ROOT = 'D:/FireflyQAQ/Project/FrontProj/Magic-cabin'
const FILE = path.join(ROOT, 'src/cabin/legacy/monolith.js')
const OUT = path.join(ROOT, '.cache/f02-analysis.json')

const lines = fs.readFileSync(FILE, 'utf8').split('\n')

// ── 上下文跟踪 ──
let section = '(文件开头)'
let func = '(IIFE 顶层)'

// 注释分区：/* ---- 标题 ---- */ 或 /* ==== 标题 ==== */
// 要求标题含实际内容（中文/字母/数字），以排除纯分隔线注释 /* ====== */
const RE_SECTION = /^\s*\/\*\s*[-—=]{2,}\s*([^\s*][^*]{1,80}?)\s*[-—=]{2,}\s*\*\/\s*$/
const hasContent = (t) => /[\u4e00-\u9fa5A-Za-z0-9]/.test(t)
// 具名函数：function name(  或  const name = function  （忽略匿名参数与临时变量）
const RE_FUNC = /(?:^|\s)function\s+([A-Za-z_$][\w$]*)\s*\(|^\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*function/

const records = []
for (let i = 0; i < lines.length; i++) {
  const line = lines[i]
  const no = i + 1

  const sm = line.match(RE_SECTION)
  if (sm && hasContent(sm[1])) section = sm[1].trim()

  const fm = line.match(RE_FUNC)
  if (fm) func = fm[1] || fm[2] || func

  const n = (line.match(/Math\.random\(\)/g) || []).length
  if (n > 0) {
    records.push({
      line: no,
      count: n,
      section,
      func,
      text: line.trim(),
    })
  }
}

// ── 分区汇总 ──
const bySection = new Map()
for (const r of records) {
  if (!bySection.has(r.section)) bySection.set(r.section, { section: r.section, lines: 0, calls: 0, from: r.line, to: r.line, funcs: new Set() })
  const s = bySection.get(r.section)
  s.lines++
  s.calls += r.count
  s.to = r.line
  s.funcs.add(r.func)
}

const summary = [...bySection.values()].map((s) => ({
  section: s.section,
  lines: s.lines,
  calls: s.calls,
  from: s.from,
  to: s.to,
  funcs: [...s.funcs],
}))

// ── 函数汇总（用于识别运行期特效）──
const byFunc = new Map()
for (const r of records) {
  byFunc.set(r.func, (byFunc.get(r.func) || 0) + r.count)
}

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(
  OUT,
  JSON.stringify(
    {
      totals: { lines: records.length, calls: records.reduce((a, r) => a + r.count, 0) },
      summary,
      byFunc: [...byFunc.entries()].sort((a, b) => b[1] - a[1]),
      records,
    },
    null,
    2,
  ),
  'utf8',
)

console.log('总调用:', records.reduce((a, r) => a + r.count, 0), '处，分布在', records.length, '行')
console.log('注释分区数:', summary.length)
console.log('\n── 按分区汇总（占位前 40 个）──')
for (const s of summary.slice(0, 40)) {
  console.log(`  L${String(s.from).padStart(5)}-${String(s.to).padStart(5)}  ${String(s.calls).padStart(3)} 处  ${s.section}`)
}
console.log('\n── 按函数汇总（前 30）──')
for (const [f, n] of [...byFunc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30)) {
  console.log(`  ${String(n).padStart(3)} 处  ${f}`)
}
console.log('\n明细已写入', OUT)
