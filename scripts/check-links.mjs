// 校验 Markdown 文档中的相对链接是否都能解析到存在的文件
// 用法：node scripts/check-links.mjs <文件...>
import fs from 'node:fs'
import path from 'node:path'

const files = process.argv.slice(2)
if (!files.length) {
  console.error('用法: node scripts/check-links.mjs <文件...>')
  process.exit(1)
}

let bad = 0
let total = 0
for (const f of files) {
  const abs = path.resolve(f)
  if (!fs.existsSync(abs)) {
    console.log(`✗ 文件不存在: ${f}`)
    bad++
    continue
  }
  const dir = path.dirname(abs)
  const text = fs.readFileSync(abs, 'utf8')
  const links = [...text.matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)].map((m) => m[1])
  console.log(`\n${path.relative(process.cwd(), abs)}  （${links.length} 个链接）`)
  for (const l of links) {
    if (/^https?:\/\//.test(l) || l.startsWith('mailto:')) continue
    total++
    const target = path.resolve(dir, l)
    const ok = fs.existsSync(target)
    if (!ok) bad++
    console.log(`  ${ok ? '✓' : '✗'} ${l}${ok ? '' : '  → 未找到'}`)
  }
}
console.log(`\n结果：${total} 个本地链接，${bad} 个失效`)
process.exit(bad ? 1 : 0)
