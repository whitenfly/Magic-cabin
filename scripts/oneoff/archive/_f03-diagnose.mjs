// F0.3 诊断：检查页面运行时状态与控制台错误
import fs from 'node:fs'

const domFile = process.argv[2] || '_shots/f03-dom.html'
const errFile = process.argv[3] || '_shots/f03-err.txt'

if (!fs.existsSync(domFile)) {
  console.log('✗ 缺少 DOM 文件:', domFile)
  process.exit(1)
}
const t = fs.readFileSync(domFile, 'utf8')

console.log('=== DOM 状态 ===')
console.log('  长度:', t.length)
console.log('  含 <canvas>:', /<canvas/i.test(t))
console.log('  含 menuDot:', /id="menuDot"/.test(t))

const attr = (name) => {
  const m = t.match(new RegExp(name + '="([^"]*)"'))
  return m ? m[1] : '（无）'
}
for (const k of [
  'data-cabin',
  'data-cabin-deterministic',
  'data-cabin-manual-clock',
  'data-cabin-scene-digest',
  'data-cabin-clock',
  'data-cabin-seed',
]) {
  console.log(`  ${k}: ${attr(k)}`)
}

if (fs.existsSync(errFile)) {
  const e = fs.readFileSync(errFile, 'utf8')
  console.log('\n=== 控制台输出（过滤） ===')
  const lines = e
    .split('\n')
    .filter((l) => /CONSOLE|Uncaught|Unhandled|Error:|error/i.test(l))
    .filter((l) => !/crashpad|external_registry|QQBrowser|update_service|missing value path/i.test(l))
  if (lines.length === 0) console.log('  （无相关输出）')
  else lines.slice(0, 15).forEach((l) => console.log('  ' + l.trim().slice(0, 220)))
} else {
  console.log('\n（无控制台日志文件）')
}
