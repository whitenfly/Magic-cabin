/**
 * J3-F 逐字节核对器（临时工具，非交付物）
 *
 * 对每件已搬迁的物件做三件事：
 *   ① **几何段**：把 monolith 原区间（去缩进 + 施加"已知改写"）与模块 `build` 体逐行 diff，
 *      必须**零残差**（`regMagic` / 顶层 `let` 这些"必然换写法"的行在 `geomDrop` 里显式列出并计数）；
 *   ② **每帧分支**：把 monolith 的原块（施加 `s.` 前缀改写）与模块 `update` 体逐行 diff，同样零残差；
 *   ③ **spec**：`startMarker` / `endMarker` / `tick.old` 在 monolith 里各恰好出现 1 次，
 *      且 `id` / `file` 与模块文件自洽（`id`、`export default defineProp(`）。
 *
 * 两侧共用的"搬迁脚手架"行（`const { … } = L` / `const xRng = rng.x` / `parts` 解构 / 注释 /
 * 结尾的 `return { … }`）在 `scaffold` 里统一剔除 —— 它们是搬迁新增的接线，不是被搬的几何。
 *
 * 用法：node _tmp-j3f-verify.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = import.meta.dirname
const src = fs.readFileSync(path.join(ROOT, 'src/cabin/legacy/monolith.js'), 'utf8')
const monoLines = src.split('\n')
const SPEC_DIR = path.join(ROOT, 'scripts/oneoff/_j3-specs')

const countOf = (hay, needle) => hay.split(needle).length - 1
const range = (a, b) => monoLines.slice(a - 1, b)
const norm = (l) => l.trim()
const rename = (l, subs) => subs.reduce((acc, [re, to]) => acc.replace(re, to), l)

/** 搬迁脚手架（只可能出现在模块一侧） */
const scaffold = [
  /^const \{[^}]*\} = L$/,
  /^const \{[^}]*\} = parts$/,
  /^const \{[^}]*\} = \(.*\)$/,
  /^const [A-Za-z_$][\w$]* = rng\.\w+$/,
  /^const [A-Za-z_$][\w$]* = parts\./,
  /^\/\//,
]

/** 逐行 diff（LCS） */
function diffLines(A, B) {
  const n = A.length, m = B.length
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const onlyA = [], onlyB = []
  let i = 0, j = 0
  while (i < n && j < m) {
    if (A[i] === B[j]) { i++; j++ }
    else if (dp[i + 1][j] >= dp[i][j + 1]) onlyA.push(A[i++])
    else onlyB.push(B[j++])
  }
  while (i < n) onlyA.push(A[i++])
  while (j < m) onlyB.push(B[j++])
  return [onlyA, onlyB]
}

/** 抽出模块里 `build(` / `update(` 的函数体 */
function extractBody(fileSrc, prop) {
  const at = fileSrc.indexOf(`\n  ${prop}(`)
  if (at < 0) throw new Error(`找不到 ${prop}(`)
  const open = fileSrc.indexOf(') {', at)
  if (open < 0) throw new Error(`${prop}( 之后找不到 {`)
  let depth = 0, k = open + 2
  for (; k < fileSrc.length; k++) {
    const ch = fileSrc[k]
    if (ch === '{') depth++
    else if (ch === '}') { depth--; if (depth === 0) break }
  }
  return fileSrc.slice(open + 3, k)
}

/** 模块体 → 可比行：去空行 / 去脚手架 / 在 `return` 处截断 */
function bodyLines(fileSrc, prop) {
  const out = []
  for (const raw of extractBody(fileSrc, prop).split('\n')) {
    const l = norm(raw)
    if (!l) continue
    if (l === 'return' || l.startsWith('return ') || l.startsWith('return{')) break
    if (scaffold.some((re) => re.test(l))) continue
    out.push(l)
  }
  return out
}

const ITEMS = [
  {
    id: 'floor1/orrery',
    file: 'src/cabin/world/floor1/orrery.js',
    geom: [712, 747],
    geomDrop: [/^let orbOn = true, orbP = 1;$/, /^regMagic\(orbG, \(\) => \{ orbOn = !orbOn; \}\);$/],
    geomSub: [],
    tick: [6684, 6693],
    tickSub: [[/\borbP\b/g, 's.orbP'], [/\borbOn\b/g, 's.orbOn']],
  },
  {
    id: 'floor1/potion-bottle',
    file: 'src/cabin/world/floor1/potionBottle.js',
    geom: [749, 834],
    geomDrop: [
      /^let corkOut = false, corkT = 0;$/,
      /^regMagic\(potG, \(\) => \{ corkOut = !corkOut; \}\);$/,
      /^regMagic\(corkG, \(\) => \{ corkOut = !corkOut; \}\);$/,
    ],
    geomSub: [[/\bcorkOut\b/g, 'st.corkOut']],
    tick: [6695, 6725],
    tickSub: [[/\bcorkOut\b/g, 's.corkOut'], [/\bcorkT\b/g, 's.corkT']],
  },
  {
    id: 'floor1/dining-book',
    file: 'src/cabin/world/floor1/diningBook.js',
    geom: [836, 877],
    geomDrop: [
      /^let bookOn = true, bookP = 1;$/,
      /^let flipCur = 0, flipping = false;$/,
      /^regMagic\(dineBookG, \(\) => \{$/,
      /^bookOn = !bookOn;$/,
      /^if \(!flipping\) \{ flipping = true; flipCur = 0; \}$/,
      /^\}\);$/,
    ],
    geomSub: [],
    tick: [6727, 6761],
    tickSub: [
      [/\bbookP\b/g, 's.bookP'], [/\bbookOn\b/g, 's.bookOn'],
      [/\bflipping\b/g, 's.flipping'], [/\bflipCur\b/g, 's.flipCur'],
    ],
  },
  {
    id: 'floor1/cauldron',
    file: 'src/cabin/world/floor1/cauldron.js',
    geom: [1084, 1174],
    geomDrop: [
      /^let stirRun = 0, stirAng = 0, bubbleI = 0.3;$/,
      /^regMagic\(cauldronG, \(\) => \{ stirRun = 4.5; \}\);$/,
    ],
    geomSub: [],
    tick: [7160, 7199],
    tickDrop: [
      // 原块自带的注释头 + 外层花括号：模块里 `update` 的函数体**就是**那个块
      /^\/\* ---- 大魔女坩埚 ---- \*\/$/,
      /^\{$/,
      /^\}$/,
    ],
    tickSub: [
      [/\bstirRun\b/g, 's.stirRun'], [/\bstirAng\b/g, 's.stirAng'], [/\bbubbleI\b/g, 's.bubbleI'],
    ],
  },
  {
    id: 'floor1/long-table',
    file: 'src/cabin/world/floor1/longTable.js',
    geom: [1334, 1378],
    geomDrop: [/^regMagic\(g, \(\) => \{ g\.userData\.spinV = 9; \}\);$/],
    geomSub: [],
    tick: [7202, 7205],
    tickSub: [[/\bplates\b/g, 'parts.plates']],
  },
  {
    id: 'floor1/tableware',
    file: 'src/cabin/world/floor1/tableware.js',
    geom: [1455, 1525],
    geomDrop: [/^regMagic\(g, \(\) => \{ g\.userData\.run = 1.4; \}\);$/],
    geomSub: [],
    tick: [7220, 7228],
    tickSub: [[/\btableItems\b/g, 'parts.items']],
  },
]

let bad = 0
for (const it of ITEMS) {
  const propSrc = fs.readFileSync(path.join(ROOT, it.file), 'utf8')
  const specPath = path.join(SPEC_DIR, it.id.replace('/', '-') + '.json')
  console.log(`\n── ${it.id} ──────────────────────────────────`)

  // ① 几何段
  const rawGeom = range(it.geom[0], it.geom[1]).map(norm).filter(Boolean)
  const dropped = rawGeom.filter((l) => it.geomDrop.some((re) => re.test(l)))
  const gLeft = rawGeom.filter((l) => !it.geomDrop.some((re) => re.test(l))).map((l) => rename(l, it.geomSub))
  const gRight = bodyLines(propSrc, 'build')
  const [gA, gB] = diffLines(gLeft, gRight)
  console.log(`  几何段 ${it.geom[0]}–${it.geom[1]}：原 ${gLeft.length} 行 / 显式换写法 ${dropped.length} 行 / 模块 ${gRight.length} 行 → 残差 ${gA.length + gB.length}`)
  for (const l of gA) console.log(`    − ${l}`)
  for (const l of gB) console.log(`    + ${l}`)
  if (gA.length || gB.length || !dropped.length && it.geomDrop.length) bad++

  // ② 每帧分支
  const rawTick = range(it.tick[0], it.tick[1]).map(norm).filter(Boolean)
  const tickDrop = it.tickDrop || []
  const tickDropped = rawTick.filter((l) => tickDrop.some((re) => re.test(l)))
  const tLeft = rawTick.filter((l) => !tickDrop.some((re) => re.test(l))).map((l) => rename(l, it.tickSub))
  const tRight = bodyLines(propSrc, 'update')
  const [tA, tB] = diffLines(tLeft, tRight)
  console.log(`  每帧分支 ${it.tick[0]}–${it.tick[1]}：原 ${tLeft.length} 行 / 显式换写法 ${tickDropped.length} 行 / 模块 ${tRight.length} 行 → 残差 ${tA.length + tB.length}`)
  for (const l of tA) console.log(`    − ${l}`)
  for (const l of tB) console.log(`    + ${l}`)
  if (tA.length || tB.length) bad++

  // ③ spec ↔ monolith ↔ 模块
  if (!fs.existsSync(specPath)) { console.log(`  ✗ spec 缺失：${path.relative(ROOT, specPath)}`); bad++; continue }
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'))
  const sN = countOf(src, '\n' + spec.startMarker)
  const eN = countOf(src, '\n' + spec.endMarker)
  const tN = spec.tick ? countOf(src, spec.tick.old) : -1
  const idOk = spec.id === it.id
  const fileOk = spec.file === it.file
  const declOk = propSrc.includes('export default defineProp(') && new RegExp(`id:\\s*'${it.id}'`).test(propSrc)
  const lineOk = monoLines[it.geom[0] - 2].trim() === spec.startMarker.trim()
  console.log(`  spec：startMarker×${sN} endMarker×${eN} tick.old×${tN}  id✓${idOk} file✓${fileOk} 模块✓${declOk} 行号✓${lineOk}`)
  if (sN !== 1 || eN !== 1 || tN !== 1 || !idOk || !fileOk || !declOk || !lineOk) bad++
}

console.log(`\n${bad ? `✗ ${bad} 项不通过` : '✓ 全部通过'}`)
process.exit(bad ? 1 : 0)
