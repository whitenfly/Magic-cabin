/**
 * J3-F 扫描器（临时工具，非交付物）
 *
 * ⚠️ 本脚本里 `expect` 的行号是 **B4 应用前**的行号；那 6 件已于提交 `87843b1` 搬走，
 * ⇒ 现在跑它会全部报 FAIL（"startMarker 出现 0 次"）—— 那是"已经搬走了"，不是边界写错。
 * 它当时的作用是：把每件候选的 `startMarker` / `endMarker` / `tick.old` 在 monolith 里
 * 做**逐字唯一性**核对（判据与 `scripts/oneoff/_j3-apply.mjs` 的 `lineIndexOf` 完全一致：
 * 标记必须出现在行首），结果 6/6 通过；`--dump=<名字>` 会把几何段（去 8 空格缩进）与
 * 每帧块原样打印出来，避免手工转写。
 *
 * 用法：node _tmp-j3f-scan.mjs [--dump=<id 或中文名片段>]
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = import.meta.dirname
const MONO = path.join(ROOT, 'src/cabin/legacy/monolith.js')
const src = fs.readFileSync(MONO, 'utf8')
const lines = src.split('\n')

/** 与 _j3-apply.mjs 同款的整行匹配 */
function lineIndexOf(text, marker) {
  const needle = '\n' + marker
  const hits = []
  let from = 0
  for (;;) {
    const i = text.indexOf(needle, from)
    if (i === -1) break
    hits.push(i + 1)
    from = i + 1
  }
  return hits
}

/** 字符下标 → 行号（1-based） */
const lineOf = (charIdx) => src.slice(0, charIdx).split('\n').length
/** 取 [a,b] 闭区间行号的行数组 */
const range = (a, b) => lines.slice(a - 1, b)

const candidates = [
  {
    id: 'floor1/orrery', label: '12.2 星象仪',
    start: '            // ---- 12.2 星象仪 ----',
    end: '            // ---- 12.3 魔法药剂瓶 ----',
    expect: [711, 748],
    tickOld: [6684, 6693],
  },
  {
    id: 'floor1/potion-bottle', label: '12.3 魔法药剂瓶',
    start: '            // ---- 12.3 魔法药剂瓶 ----',
    end: '            // ---- 12.4 魔法书 ----',
    expect: [748, 835],
    tickOld: [6695, 6725],
  },
  {
    id: 'floor1/dining-book', label: '12.4 魔法书',
    start: '            // ---- 12.4 魔法书 ----',
    end: '            // ---- 12.5 三脚圆凳 ----',
    expect: [835, 878],
    tickOld: [6727, 6761],
  },
  {
    id: 'floor1/cauldron', label: '12.9e 大魔女坩埚',
    start: '            /* ---- 12.9e 大魔女坩埚 ---- */',
    end: '            /* ---- 灶台旁：固定木台 ---- */',
    expect: [1083, 1175],
    tickOld: [7160, 7199],
  },
  {
    id: 'floor1/long-table', label: '12.9f 长餐桌 + 三只餐盘',
    start: '            /* ---- 12.9f 长餐桌 ---- */',
    end: '            /* 茶杯（餐桌/暖桌通用） */',
    expect: [1333, 1379],
    tickOld: [7202, 7205],
  },
  {
    id: 'floor1/tableware', label: '桌面散放餐具',
    start: '            /* ---- 桌面散放餐具 ---- */',
    end: '            const chairs = [];',
    expect: [1454, 1526],
    tickOld: [7220, 7228],
  },
]

let bad = 0
for (const c of candidates) {
  const sCh = lineIndexOf(src, c.start)
  const eCh = lineIndexOf(src, c.end)
  const s = sCh.map(lineOf)
  const e = eCh.map(lineOf)
  const okS = s.length === 1 && s[0] === c.expect[0]
  const okE = e.length === 1 && e[0] === c.expect[1]
  const okBody = okS && okE && e[0] > s[0]
  const tickOldText = range(c.tickOld[0], c.tickOld[1]).join('\n')
  const nTick = src.split(tickOldText).length - 1
  if (!okS || !okE || !okBody || nTick !== 1) bad++
  console.log(
    `${okS && okE && okBody && nTick === 1 ? 'OK  ' : 'FAIL'} ${c.id.padEnd(24)} ` +
    `start=${JSON.stringify(s)} (期望 ${c.expect[0]})  end=${JSON.stringify(e)} (期望 ${c.expect[1]})  ` +
    `body=[${s[0] + 1},${e[0] - 1}]  tick.old 命中=${nTick} (期望 1, 行 ${c.tickOld[0]}–${c.tickOld[1]})`
  )
}

// ── dump：把某个候选的行区间按「去掉 8 空格缩进」打印出来（供核对/生成模块）──
const dumpArg = process.argv.find((a) => a.startsWith('--dump='))
if (dumpArg) {
  const name = dumpArg.slice('--dump='.length)
  const c = candidates.find((x) => x.id.endsWith(name) || x.label.includes(name))
  if (!c) { console.error('未找到候选：' + name); process.exit(1) }
  const s = lineOf(lineIndexOf(src, c.start)[0])
  const e = lineOf(lineIndexOf(src, c.end)[0])
  const body = range(s + 1, e - 1)
  console.log(`\n===== ${c.id} 几何段 [${s + 1},${e - 1}]（共 ${body.length} 行，已去 8 空格缩进）=====`)
  for (const l of body) console.log(l.startsWith('        ') ? l.slice(8) : l)
  console.log(`===== ${c.id} 每帧分支 [${c.tickOld[0]},${c.tickOld[1]}]（共 ${c.tickOld[1] - c.tickOld[0] + 1} 行，原样）=====`)
  for (const l of range(c.tickOld[0], c.tickOld[1])) console.log(l)
  console.log('===== end =====')
}

process.exit(bad ? 1 : 0)
