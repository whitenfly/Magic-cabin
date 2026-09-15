/**
 * 临时校验（用完即删）：逐字核对 B2 两件物件的几何段 / 每帧分支搬运保真度
 *
 * 做法：把 monolith 原区间（与原 animate() 分支块）按**已知改写表**归一化，
 * 与 prop 文件里对应函数体的行**多重集**比较 —— 少一行、多一行、抄错一个字都会报出来。
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '../..')
const mono = fs.readFileSync(path.join(ROOT, 'src/cabin/legacy/monolith.js'), 'utf8').split('\n')

/** 取 [startMarker, endMarker) 之间（不含两条边界注释行）的原文 */
function between(startMarker, endMarker) {
  const s = mono.findIndex((l) => l === startMarker)
  const e = mono.findIndex((l, i) => i > s && l === endMarker)
  if (s < 0 || e < 0) throw new Error(`找不到区间：${startMarker} -> ${endMarker}`)
  return mono.slice(s + 1, e)
}

/** 取 needle 行（含）之后到第一个恰好等于 end 的行（不含）之间的内容 */
function fnBody(src, needle, end = '  },') {
  const lines = src.split('\n')
  const s = lines.findIndex((l) => l.trim().startsWith(needle))
  if (s < 0) throw new Error(`找不到函数：${needle}`)
  const e = lines.findIndex((l, i) => i > s && l === end)
  if (e < 0) throw new Error(`找不到函数体结尾：${needle}`)
  return lines.slice(s + 1, e)
}

const norm = (ls) => ls.map((l) => l.trim()).filter((l) => l && !l.startsWith('//') && !l.startsWith('/*') && !l.startsWith('*'))

function multi(ls) {
  const m = new Map()
  for (const l of ls) m.set(l, (m.get(l) || 0) + 1)
  return m
}

function compare(label, aLines, bLines) {
  const a = multi(aLines), b = multi(bLines)
  const missing = []
  const extra = []
  for (const [k, v] of a) if ((b.get(k) || 0) < v) missing.push(`${k}   (x${v - (b.get(k) || 0)})`)
  for (const [k, v] of b) if ((a.get(k) || 0) < v) extra.push(`${k}   (x${v - (a.get(k) || 0)})`)
  const ok = !missing.length && !extra.length
  console.log(`\n${ok ? 'OK ' : 'BAD'} ${label}  （原文 ${aLines.length} 行 / prop ${bLines.length} 行）`)
  if (!ok) {
    for (const m of missing) console.log(`   - 原文有而 prop 无： ${m}`)
    for (const m of extra) console.log(`   + prop 有而原文无： ${m}`)
  }
  return ok
}

const sub = (lines, table) => lines.map((l) => {
  let out = l
  for (const [re, to] of table) out = out.replace(re, to)
  return out
})

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')
const HOURGLASS = 'src/cabin/world/floor1/hourglass.js'
const CHEST = 'src/cabin/world/floor1/chest.js'

let allOk = true

/* ① 沙漏几何段 */
{
  const orig = between('            /* ---- 12.9b 沙漏 ---- */', '            /* ---- 12.9c 宝箱 ---- */')
    .filter((l) => !l.includes('let hgFlip = false') && !l.includes('regMagic(hg, () =>'))
  const subbed = sub(orig, [
    [/SFX, 0\.805 \+ HG_MID, -2\.44/, 'HG_POS.x, HG_POS.y + HG_MID, HG_POS.z'],
    [/const s = new THREE\.Line\(/, 'const stream = new THREE.Line('],
    [/hgInner\.add\(s\);/, 'hgInner.add(stream);'],
    [/^\s*s\.visible = false;$/, 'stream.visible = false;'],
    [/hgStreams\.push\(s\);/, 'hgStreams.push(stream);'],
  ])
  const mine = fnBody(read(HOURGLASS), 'build({ scene')
    .filter((l) => !l.includes('const { HG_POS } = L') && !l.includes('return { root: hg, parts:'))
  allOk = compare('沙漏 · 几何段（build）', norm(subbed), norm(mine)) && allOk
}

/* ② 沙漏每帧分支 */
{
  const lines = mono
  const s = lines.findIndex((l) => l.trim() === 'const target = hgFlip ? Math.PI : 0;')
  const start = (() => { for (let i = s; i > 0; i--) if (lines[i].trim() === '{' && lines[i].length - lines[i].trimStart().length === 16) return i; throw new Error('找不到分支块首') })()
  const end = (() => { for (let i = s + 1; i < lines.length; i++) if (lines[i].trim() === '}' && lines[i].length - lines[i].trimStart().length === 16) return i; throw new Error('找不到分支块尾') })()
  const orig = sub(lines.slice(start, end + 1), [
    [/\b(hgFlip|hgRun|hgRotV|hgRot|hgSand)\b/g, 's.$1'],
    [/\bconst s = hgStreams\[i\];/, 'const stream = hgStreams[i];'],
    [/\bs\.visible = sv;/, 'stream.visible = sv;'],
    [/\bs\.position\.y = y0 \+ \(y1 - y0\) \* prog;/, 'stream.position.y = y0 + (y1 - y0) * prog;'],
  ])
  const mine = fnBody(read(HOURGLASS), 'update(dt, time, s, { parts }) {')
    .filter((l) => !l.includes('const hg = parts.body'))
  allOk = compare('沙漏 · 每帧分支（update）', norm(orig), norm(mine)) && allOk
}

/* ③ 宝箱几何段 */
{
  const orig = between('            /* ---- 12.9c 宝箱 ---- */', '            /* ---- 12.9d 旋转星铃 ---- */')
    .filter((l) => !l.includes('let chestOpen = false') && !l.includes('regMagic(chest, () =>'))
  const subbed = sub(orig, [[/SFX, 0\.805, -2\.66/, 'CHEST_POS.x, CHEST_POS.y, CHEST_POS.z']])
  const mine = fnBody(read(CHEST), 'build({ scene')
    .filter((l) => !l.includes('const { CHEST_POS } = L') && !l.includes('return { root: chest, parts:'))
  allOk = compare('宝箱 · 几何段（build）', norm(subbed), norm(mine)) && allOk
}

/* ④ 宝箱每帧分支 */
{
  const lines = mono
  const s = lines.findIndex((l) => l.trim() === 'const target = chestOpen ? 1 : 0;')
  const start = (() => { for (let i = s; i > 0; i--) if (lines[i].trim() === '{' && lines[i].length - lines[i].trimStart().length === 16) return i; throw new Error('找不到分支块首') })()
  const end = (() => { for (let i = s + 1; i < lines.length; i++) if (lines[i].trim() === '}' && lines[i].length - lines[i].trimStart().length === 16) return i; throw new Error('找不到分支块尾') })()
  const orig = sub(lines.slice(start, end + 1), [[/\b(chestOpen|chestV|chestP)\b/g, 's.$1']])
  const mine = fnBody(read(CHEST), 'update(dt, time, s, { parts }) {')
    .filter((l) => !l.includes('const chestLid = parts.lid'))
  allOk = compare('宝箱 · 每帧分支（update）', norm(orig), norm(mine)) && allOk
}

console.log(`\n${allOk ? '全部一致：几何段与每帧分支逐行等价（只差已知改写）' : '有不一致，见上'}\n`)
process.exit(allOk ? 0 : 1)
