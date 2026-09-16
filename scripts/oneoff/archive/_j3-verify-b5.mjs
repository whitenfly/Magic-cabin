/**
 * `J3` / B5 逐行核对 —— 二楼 18.4 拆分件 + 18.13 挂画
 *
 * 来源：新增（`J3`）。与 `_j3-verify-mirror.mjs` / `_j3-verify-b2.mjs` 同一套路：
 * 把 monolith 里**即将被删掉的那一段**按行取出，逐行在物件文件里找**逐字相同**的对应行，
 * 只有"声明过的改写行"允许对不上。改写行数 / 逐字对上行数都打印出来，供人工复核。
 *
 * 用法：
 *   node scripts/oneoff/_j3-verify-b5.mjs
 *
 * ⚠️ 它读的是**当前** monolith。若本批已被应用器写盘（几何段已删），它会报"分区已不存在" ——
 *    那属于正常现象（说明已搬迁完成），不是失败。
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '../..')
const MONO = path.join(ROOT, 'src/cabin/legacy/monolith.js')
const lines = fs.readFileSync(MONO, 'utf8').split('\n')

/** 与生成器一致：monolith IIFE 基准缩进 12 → 4 */
const deindent = (l) => (l.startsWith('        ') ? l.slice(8) : l)

function lineExact(text) {
  const hits = []
  for (let i = 0; i < lines.length; i++) if (lines[i] === text) hits.push(i)
  return hits
}

/**
 * 每件：分区边界 + 「允许对不上的行」的两份白名单。
 *   · `touched`：行内含**声明过的改写标识**（改名 / 换源），该行的内容会变；
 *   · `dropped`：**整行被删掉**且属于纯脚手架/纯注释（`regMagic(...)` 的收尾 `});`、
 *     分区之间的 `/* ==== *\/` 分隔线、被 startMarker 挡在区间外的注释尾巴）——
 *     逐字比较时按 trim 后的原文列出，一行不多一行不少。
 */
const ITEMS = [
  { id: 'floor2/desk', file: 'src/cabin/world/floor2/desk.js', touched: [], dropped: [] },
  {
    id: 'floor2/rubik', file: 'src/cabin/world/floor2/rubik.js',
    start: '            /* —— 魔方 —— */', end: '            /* —— 通用倒塌/恢复 —— */',
    touched: ['RUBIK_HOME = V(', 'rubikState', 'layerAnim', 'clock.now', 'regMagic(', 'beginLayer(', 'updateLayerAnim(', 'startNextTurn(', 'function updateRubik'],
    dropped: [],
  },
  {
    id: 'floor2/coin-towers', file: 'src/cabin/world/floor2/coinTowers.js',
    start: '            /* —— 通用倒塌/恢复 —— */', end: '            /* —— 扑克牌堆 —— */',
    touched: ['toppleGroups', 'regTopple(', 'regMagic(', 'const BASE = '],
    dropped: [],
  },
  {
    id: 'floor2/card-deck', file: 'src/cabin/world/floor2/cardDeck.js',
    start: '            /* —— 扑克牌堆 —— */', end: '            /* —— 玻璃雪景球 —— */',
    touched: ['DECK_HOME = V(', 'deckState', 'updateDeck(', 'regMagic('],
    dropped: ['});', 'revealCard.draw(Math.floor(runtimeRng() * 4));'],
  },
  {
    id: 'floor2/snow-globe', file: 'src/cabin/world/floor2/snowGlobe.js',
    start: '            /* —— 玻璃雪景球 —— */', end: '            /* —— 沙漏 —— */',
    touched: ['snowG.position.set(3.50', 'regMagic(', 'snowParts', 'function updateSnow'],
    dropped: ['});'],
  },
  {
    id: 'floor2/desk-hourglass', file: 'src/cabin/world/floor2/deskHourglass.js',
    start: '            /* —— 沙漏 —— */',
    end: '            /* —— 台历（转轴位于背板面顶端：未翻页贴板前面、翻过页贴板背面， */',
    touched: ['hourG.position.set(2.15', 'hourSand = {', 'hourState', 'regMagic(', 'function updateHourglass'],
    dropped: ['});', '/* ========================================================== */'],
  },
  {
    id: 'floor2/calendar', file: 'src/cabin/world/floor2/calendar.js',
    start: '            /* —— 台历（转轴位于背板面顶端：未翻页贴板前面、翻过页贴板背面， */',
    end: '            /* —— 魔法书本 —— */',
    touched: ['calG.position.set(2.62', 'calState', 'regMagic(', 'calZFor(pg, rot)', 'function updateCal'],
    dropped: ['/*       由背板物理隔开，翻到任何月份都互不交叉）—— */', '/* ========================================================== */'],
  },
  {
    id: 'floor2/picture', file: 'src/cabin/world/floor2/picture.js',
    start: '            /* 18.13 前墙挂画（镜子旁，点击编辑链接，支持 gif 动图） */',
    end: '            /* 18.14 拱形全身镜（点击镜面泛起水波涟漪） */',
    touched: ['picG.position.set(1.45', 'picState', 'regMagic(picG', 'drawPicImage();'],
    dropped: ['/* ========================================================== */'],
  },
]

let bad = 0
for (const it of ITEMS) {
  const propPath = path.join(ROOT, it.file)
  if (!fs.existsSync(propPath)) { console.log(`✗ ${it.id}：物件文件不存在 ${it.file}`); bad++; continue }
  const propLines = new Set(fs.readFileSync(propPath, 'utf8').split('\n').map((l) => l.trim()))
  const src = fs.readFileSync(MONO, 'utf8')
  if (!src.includes('export function installCabin')) { console.log('✗ 找不到 monolith'); process.exit(1) }

  // desk 用 18.4 标题行 → 椅子行；其余用各自标记
  const start = it.start || '            /* ---- 18.4 书桌 + 椅子 + 桌面玩具 ---- */'
  const end = it.end || '            /* —— 椅子 —— */'
  const si = lineExact(start), ei = lineExact(end)
  if (si.length !== 1 || ei.length !== 1 || ei[0] < si[0]) {
    console.log(`· ${it.id}：分区已不存在（start=${si.length} end=${ei.length}）—— 若本批已写盘则属正常`)
    continue
  }
  const body = lines.slice(si[0] + 1, ei[0]).map(deindent)
  const dropped = new Set((it.dropped || []).map((s) => s.trim()))
  let verbatim = 0, touched = 0, gone = 0, miss = []
  for (const raw of body) {
    const t = raw.trim()
    if (!t) continue
    if (dropped.has(t)) { gone++; continue }
    const isTouched = it.touched.some((f) => raw.includes(f))
    if (isTouched) { touched++; continue }
    if (propLines.has(t)) verbatim++
    else miss.push(raw)
  }
  const total = body.filter((l) => l.trim()).length
  if (miss.length) {
    bad++
    console.log(`✗ ${it.id}：${total} 行中 ${miss.length} 行**对不上**，且未在 touched / dropped 里声明：`)
    for (const m of miss.slice(0, 12)) console.log(`     ${JSON.stringify(m)}`)
  } else {
    console.log(`✓ ${it.id.padEnd(24)} 共 ${String(total).padStart(4)} 行：逐字对上 ${String(verbatim).padStart(4)} / 声明改写 ${String(touched).padStart(3)} / 声明删除 ${String(gone).padStart(2)} —— 无遗漏`)
  }
}
console.log(bad ? `\n✗ ${bad} 项未通过\n` : '\n✓ 全部通过\n')
process.exit(bad ? 1 : 0)
