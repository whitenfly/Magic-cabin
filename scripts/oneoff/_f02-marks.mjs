// 定位诊断：在 monolith.js 的 IIFE 内按间隔插入进度标记
// 标记写入 document.documentElement[data-mark]，dump-dom 可读到最后一个标记
// 用法： node _f02-marks.mjs place   插入标记
//        node _f02-marks.mjs clear   还原
import fs from 'node:fs'
import path from 'node:path'

const ROOT = 'D:/FireflyQAQ/Project/FrontProj/Magic-cabin'
const TARGET = path.join(ROOT, 'src/cabin/legacy/monolith.js')
const SAVE = path.join(ROOT, '.cache/monolith.f02-current.js')
const mode = process.argv[2] || 'place'
const STEP = Number(process.argv[3] || 500)

if (mode === 'clear') {
  fs.copyFileSync(SAVE, TARGET)
  console.log('✓ 已还原')
  process.exit(0)
}

// 保存当前（已还原的）版本
if (!fs.existsSync(SAVE) || process.argv[4] === 'fresh') {
  fs.copyFileSync(TARGET, SAVE)
}
const src = fs.readFileSync(SAVE, 'utf8')
const lines = src.split('\n')

// 找顶层 IIFE 的起止
const start = lines.findIndex((l) => /^\s*\(function \(\) \{\s*$/.test(l))
const end = lines.length - 1
if (start < 0) {
  console.error('✗ 未找到顶层 IIFE')
  process.exit(1)
}

// 在空行处插入标记（避开表达式中间）
let inserted = 0
const out = []
for (let i = 0; i < lines.length; i++) {
  out.push(lines[i])
  if (i > start + 5 && i < lines.length - 5 && i % STEP === 0) {
    // 向后找最近的空行作为插入点
    let j = i
    while (j < lines.length - 5 && lines[j].trim() !== '') j++
    if (j < lines.length - 5) {
      out.push(`            document.documentElement.setAttribute('data-mark', 'L${j + 1}');`)
      inserted++
    }
    i = j
  }
}

fs.writeFileSync(TARGET, out.join('\n'), 'utf8')
console.log(`✓ 已插入 ${inserted} 个进度标记（每 ${STEP} 行一个），原文件备份在 .cache/monolith.f02-current.js`)
