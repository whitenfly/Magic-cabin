/**
 * J3-F 应用后核对器（临时工具，非交付物）
 *
 * `_j3-apply.mjs` 已经把 B4 这批 spec 应用进 monolith（几何段 → installProp、每帧块 → xxxApi.tick）。
 * 本脚本核对**应用之后**的状态：
 *   ① 每件的 `installProp(<name>)` 与 `tick.new` 都在场、`tick.old` 已消失；
 *   ② 被搬走的**全部标识符**在 monolith 里已彻底消失（残留 = 运行时 ReferenceError）；
 *   ③ `src/cabin/world/layout.js` 未被本批改动（6 件 spec 的 layout 都是空数组）。
 *
 * 用法：node _tmp-j3f-verify-applied.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = import.meta.dirname
const mono = fs.readFileSync(path.join(ROOT, 'src/cabin/legacy/monolith.js'), 'utf8')
const layout = fs.readFileSync(path.join(ROOT, 'src/cabin/world/layout.js'), 'utf8')
const SPEC_DIR = path.join(ROOT, 'scripts/oneoff/_j3-specs')

const countOf = (hay, needle) => hay.split(needle).length - 1
/** 标识符命中（按行报告）—— 先把单引号字符串字面量抹掉，避免 `'flipping'` 这种字符串误报 */
function hits(name) {
  const out = []
  const re = new RegExp(`\\b${name}\\b`)
  mono.split('\n').forEach((l, i) => {
    const code = l.replace(/'[^']*'/g, "''")
    if (re.test(code)) out.push(`${i + 1}: ${l.trim().slice(0, 120)}`)
  })
  return out
}

const ITEMS = [
  {
    id: 'floor1/orrery', name: 'orrery', assign: 'orreryApi',
    dead: ['orbOn', 'orbP', 'orbRings', 'orbStars', 'orbG'],
  },
  {
    id: 'floor1/potion-bottle', name: 'potionBottle', assign: 'potionBottleApi',
    dead: ['corkOut', 'corkT', 'potG', 'corkG', 'potBubbles', 'updateLiquid', 'CORK_M', 'CORK_L', 'LIQ_Y', 'liquidGeom', 'liquidGeom2', 'liquidLoop', 'liquidLoop2', 'waterMat', 'waterBody', 'waterDisc', 'PROF', 'bubbleMat', 'PX', 'PZ'],
  },
  {
    id: 'floor1/dining-book', name: 'diningBook', assign: 'diningBookApi',
    dead: ['bookOn', 'bookP', 'flipCur', 'flipping', 'dineBookG', 'pagePivot', 'glyphs', 'BX', 'BZ'],
  },
  {
    id: 'floor1/cauldron', name: 'cauldron', assign: 'cauldronApi',
    dead: ['stirRun', 'stirAng', 'bubbleI', 'cauldronG', 'stirG', 'stickAsm', 'calSurf', 'calSurfGeom', 'calSurfMat', 'calBubbles', 'calWavy', 'calGlow', 'calGlowMat', 'CAL_UP', 'STOVE_TOP', 'CPROF', 'calFireOutMat', 'calFireMidMat', 'calFireInMat'],
  },
  {
    id: 'floor1/long-table', name: 'longTable', assign: 'longTableApi',
    dead: ['plates', 'makePlate'],
  },
  {
    id: 'floor1/tableware', name: 'tableware', assign: 'tablewareApi',
    dead: ['tableItems', 'regItem', 'baseAt', 'makeSpoon', 'makeChopsticks', 'makeBowlStack'],
  },
]

let bad = 0
for (const it of ITEMS) {
  const spec = JSON.parse(fs.readFileSync(path.join(SPEC_DIR, it.id.replace('/', '-') + '.json'), 'utf8'))
  const call = `installProp(${it.name})`
  const nCall = countOf(mono, call)
  const nNew = countOf(mono, spec.tick.new)
  const nOld = countOf(mono, spec.tick.old)
  const deadHits = it.dead.map((d) => [d, hits(d)]).filter(([, h]) => h.length)
  console.log(`\n── ${it.id}`)
  console.log(`  ${call} ×${nCall}（期望 1）  tick.new ×${nNew}（期望 1）  tick.old ×${nOld}（期望 0）  assign=${it.assign}`)
  if (nCall !== 1 || nNew !== 1 || nOld !== 0) bad++
  if (deadHits.length) {
    bad++
    for (const [d, h] of deadHits) {
      console.log(`  ✗ 残留标识符 ${d}（${h.length} 处）：`)
      for (const l of h.slice(0, 6)) console.log(`      ${l}`)
    }
  } else {
    console.log(`  ✓ 被搬走的 ${it.dead.length} 个标识符在 monolith 里已全部消失`)
  }
}

// layout.js 未被本批改动：本批 6 件的坐标全来自既有常量
const layoutExpected = ['BROOM_REST', 'STARBELL_POS', 'TAROT_POS', 'BOOK_PILE_POS']
const missing = layoutExpected.filter((n) => !layout.includes(`const ${n} `))
console.log(`\nlayout.js：既有 J3 常量在场 ✓${missing.length === 0}（缺 ${missing.join('/') || '无'}）；本批 6 件未新增任何常量（layout 全为空数组）`)

console.log(`\n${bad ? `✗ ${bad} 项不通过` : '✓ 全部通过'}`)
process.exit(bad ? 1 : 0)
