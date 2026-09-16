// J2.9 一次性脚本：把 legacy/monolith.js 里散落的坐标常量定义删除，
// 改为从 cabin/world/layout.js 解构。用完即可删除。
//
// 为什么用脚本：要删的 15 处定义散落在 8600 行里（115 … 2412），
// 手工逐处删除既慢又容易漏；脚本按**精确行内容**匹配，并在末尾自检"确实一处不剩"。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const MONO = path.join(ROOT, 'src/cabin/legacy/monolith.js')
let src = fs.readFileSync(MONO, 'utf8')

if (src.includes('createLayout()')) {
  console.log('· monolith 已改写（检测到 createLayout()），跳过')
  process.exit(0)
}

const IND = '            ' // IIFE 内的缩进（12 空格）

/* ── ① 建筑外壳：7 行连续定义 → 一次解构 ── */
const SHELL_BLOCK = [
  'const HOLE_R = 1.2, FLOOR_TOP = 3.12;',
  'const DOOR_HOLE = { c: 0, hw: 0.78, y0: 0, y1: 2.35 };',
  'const WIN_F_L = { c: -2.4, hw: 0.58, y0: 1.1, y1: 2.1 };',
  'const WIN_F_R = { c: 2.4, hw: 0.58, y0: 1.1, y1: 2.1 };',
  'const WIN_LEFT = { c: -1.5, hw: 0.58, y0: 1.1, y1: 2.1 };',
  'const WIN_GABLE = { c: 0, hw: 0.52, y0: 4.95, y1: 5.8 };',
  'const LOG_R = 0.15, LOG_GAP = 0.27, WALL_TOP = 4.42, WALL_Y0 = 0;',
]
  .map((l) => IND + l)
  .join('\n')

const SHELL_REPLACEMENT = `${IND}// J2.9：建筑外壳尺寸与陈设锚点已集中到 cabin/world/layout.js（不变量 N9）。
${IND}// 数值一个没改 —— 交互判定与几何构建从此共用同一份坐标（J2.6 的 anchor 直接用它们）。
${IND}const {
${IND}    HOLE_R, FLOOR_TOP, DOOR_HOLE, WIN_F_L, WIN_F_R, WIN_LEFT, WIN_GABLE, LOG_R, LOG_GAP, WALL_TOP, WALL_Y0,
${IND}    CHX, CHZ, HEARTH, FX, FZ, MTX, MTZ, MTTOP, CCX, CCZ, MC_X, MC_Z, KOT_X, KOT_Z, KTOP,
${IND}    CBX, CBZ, PLX, PLZ, DT_X, DT_Z, DTOP,
${IND}    FY, BEDX, BEDZ, NSX, NSZ, TBLX, TBLZ, TBL_TOP,
${IND}} = createLayout();`

if (!src.includes(SHELL_BLOCK)) throw new Error('未找到建筑外壳常量块')
src = src.replace(SHELL_BLOCK, SHELL_REPLACEMENT)
console.log(`  建筑外壳：7 行 → 解构`)

/* ── ② 散落的陈设锚点定义：逐行删除 ── */
const SCATTERED = [
  'const CHX = -3.35, CHZ = 1.5, HEARTH = 0.12, FX = CHX + 0.15, FZ = CHZ;',
  'const MTX = 1.8, MTZ = 2.2, MTTOP = 0.78;',
  'const CCX = -2.35, CCZ = -0.45;',
  'const MC_X = -2.75, MC_Z = -2.15;',
  'const DT_X = 1.6, DT_Z = -3.35;',
  'const DTOP = 0.77;',
  'const CBX = 3.05, CBZ = 3.25;',
  'const PLX = 3.55, PLZ = 2.45;',
  'const KOT_X = 2.55, KOT_Z = -0.5, KTOP = 0.4475;',
  'const FY = FLOOR_TOP;',
  'const BEDX = -2.4, BEDZ = -2.55;',
  'const NSX = -1.15, NSZ = -3.3;',
  'const TBLX = 2.5, TBLZ = -2.5;',
  'const TBL_TOP = FY + 0.80;',
]

for (const line of SCATTERED) {
  const full = `\n${IND}${line}`
  if (!src.includes(full)) throw new Error(`未找到待删除的行：${line}`)
  src = src.replace(full, '')
}
console.log(`  陈设锚点：删除 ${SCATTERED.length} 行定义`)

/* ── ③ 顶部 import ── */
const anchor = `import { createLitMaterialFactory } from '../core/materials/litMaterial.js'`
if (!src.includes(anchor)) throw new Error('未找到 litMaterial 的 import 锚点')
src = src.replace(anchor, `${anchor}\nimport { createLayout } from '../world/layout.js'`)
console.log('  已加 import')

/* ── ④ 自检：列出仍以「NAME =」形式出现的位置，供人工核对 ── */
const NAMES = [
  'HOLE_R', 'FLOOR_TOP', 'DOOR_HOLE', 'WIN_F_L', 'WIN_F_R', 'WIN_LEFT', 'WIN_GABLE', 'LOG_R', 'LOG_GAP',
  'WALL_TOP', 'WALL_Y0', 'CHX', 'CHZ', 'HEARTH', 'FX', 'FZ', 'MTX', 'MTZ', 'MTTOP', 'CCX', 'CCZ',
  'MC_X', 'MC_Z', 'KOT_X', 'KOT_Z', 'KTOP', 'CBX', 'CBZ', 'PLX', 'PLZ', 'DT_X', 'DT_Z', 'DTOP',
  'FY', 'BEDX', 'BEDZ', 'NSX', 'NSZ', 'TBLX', 'TBLZ', 'TBL_TOP',
]
// 只判「声明」形态（`const NAME =` 或 `const A = 1, NAME =`）；
// 派生常量（`const OX = MTX - 0.38`）与引用（`= HEARTH + 0.62`）都该保留，不算残留。
const lines = src.split('\n')
const suspicious = []
for (const n of NAMES) {
  const re = new RegExp(`(?:const\\s+|,\\s*)${n}\\s*=`)
  lines.forEach((l, i) => {
    if (re.test(l)) suspicious.push(`${i + 1}: ${l.trim()}`)
  })
}
if (suspicious.length) {
  console.log(`  ⚠ 仍有 ${suspicious.length} 处「NAME =」形态（逐条核对是否只是派生常量）：`)
  for (const s of suspicious) console.log(`      ${s}`)
} else {
  console.log(`  ✓ 自检通过：${NAMES.length} 个名字在 monolith 中已无声明`)
}

fs.writeFileSync(MONO, src, 'utf8')
console.log(`✓ 已改写 ${path.relative(ROOT, MONO)}`)
