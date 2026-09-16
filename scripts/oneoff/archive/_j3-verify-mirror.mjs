/**
 * `J3` 单件核对：`floor2/mirror`（拱形全身镜）
 *
 * 用途：在**不跑浏览器**的前提下，用逐行文本比对证明"搬迁 = 只改缩进"。
 * 只读，不写盘（唯一写者仍是 `_j3-apply.mjs`）。
 *
 * 判据：
 *   ① 两个边界标记在 monolith 中**各出现恰好一次**且前者在后者之前；
 *   ② 区间内不含**别的 spec** 的 startMarker（应用器的自检项，这里先自查）；
 *   ③ 区间里**每一行非空代码**都能在 `world/floor2/mirror.js` 里按原序找到
 *      （缩进按"去掉 8/12 空格前缀"对齐）—— 允许的改写逐条列在 REWRITES 里；
 *   ④ 唯一"整块不在"的是射线 6 行（留给 `J4`，见物件文件头），逐行列出以证明没多删；
 *   ⑤ `update()` 承载的是 `updateNewDecor()` 里那 8 行（逐行等价，只改 `s.` 前缀）；
 *   ⑥ 物件文件里"多出来的行"逐条列出（应只有 import / state / 别名 / 交接 / return）。
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '../..')
const MONO = path.join(ROOT, 'src/cabin/legacy/monolith.js')
const PROP = path.join(ROOT, 'src/cabin/world/floor2/mirror.js')
const SPECS = path.join(ROOT, 'scripts/oneoff/_j3-specs')

const START = '            /* 18.14 拱形全身镜（点击镜面泛起水波涟漪） */'
const END = '            /* 18.15 毛茸茸大地毯（右前角与书桌之间） */'

let pass = 0, fail = 0
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? '  → ' + detail : ''}`)
  ok ? pass++ : fail++
}

const mono = fs.readFileSync(MONO, 'utf8')
const prop = fs.readFileSync(PROP, 'utf8')
const monoLines = mono.split('\n')
const propLines = prop.split('\n')

console.log('\n【① 边界】')
const starts = monoLines.map((l, i) => (l === START ? i : -1)).filter((i) => i >= 0)
const ends = monoLines.map((l, i) => (l === END ? i : -1)).filter((i) => i >= 0)
check('startMarker 恰好 1 次', starts.length === 1, starts.length ? `L${starts[0] + 1}` : '找不到')
check('endMarker 恰好 1 次', ends.length === 1, ends.length ? `L${ends[0] + 1}` : '找不到')
if (starts.length === 0) {
  console.log('\n（区间已不存在 = 本 spec 已应用；逐行比对跳过）\n')
  process.exit(0)
}
check('endMarker 在 startMarker 之后', ends[0] > starts[0], `L${starts[0] + 1} → L${ends[0] + 1}`)

const body = monoLines.slice(starts[0] + 1, ends[0])

console.log('\n【② 区间不吞别的分区】')
const otherMarkers = fs.readdirSync(SPECS).filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(fs.readFileSync(path.join(SPECS, f), 'utf8')))
  .filter((s) => s.id !== 'floor2/mirror')
  .map((s) => s.startMarker)
  .filter((m) => body.includes(m))
check('区间内无其它 spec 的 startMarker', otherMarkers.length === 0, otherMarkers.join(' | ') || '（无）')

// ── 逐行比对 ────────────────────────────────────────────────────────────────
// 已知改写（原文行 trim 后 → 物件文件里的对应行，**含缩进**）
const REWRITES = new Map([
  ['mirrorG.position.set(2.55, FY, 3.60);', '    mirrorG.position.set(MIRROR_X, FY, MIRROR_Z);'],
  ['const mirrorRipples = [];', '    const mirrorRipples = state.ripples;   // 别名 = `state.ripples`（**同一个数组实例**，下面函数体一字未改）'],
])

// 留给 J4 的射线段（原文行号区间以内容为锚：从 `let mirrorDown = null;` 到最后一个 `});`）
const rayFrom = body.findIndex((l) => l.trim() === 'let mirrorDown = null;')
const rayTo = body.length - 1 - [...body].reverse().findIndex((l) => l.trim() === '});')
const rayLines = rayFrom >= 0 ? body.slice(rayFrom, rayTo + 1) : []

console.log('\n【③ 几何与绘制：逐行等价】')
// monolith 里 `18.14` 段的底层缩进是 12 空格，`build()` 体内是 4 空格 ⇒ 去掉 8 空格前缀后应逐字相同
const dedent = (l) => l.replace(/^ {8}/, '')
const matched = new Set()
const missing = []
let cursor = -1
for (let i = 0; i < body.length; i++) {
  if (i >= rayFrom && i <= rayTo) continue                 // 射线段（④ 单独核）
  const raw = body[i]
  if (!raw.trim() || raw.trim() === '/* ========================================================== */') continue
  const want = REWRITES.get(raw.trim()) ?? dedent(raw)
  const hit = propLines.findIndex((l, j) => j > cursor && l.trimEnd() === want.trimEnd())
  if (hit === -1) missing.push({ line: starts[0] + 2 + i, text: raw })
  else { matched.add(hit); cursor = hit }
}
check('区间内每一行都在物件文件里按原序、按原缩进找到', missing.length === 0,
  missing.length ? `${missing.length} 行找不到` : `${matched.size} 行全部对上（含相对缩进）`)
for (const m of missing) console.log(`      ✗ monolith L${m.line}: ${m.text}`)

console.log('\n【④ 射线段：整块留给 J4（逐行列出，证明没多删）】')
check('射线段起点命中（`let mirrorDown = null;`）', rayFrom >= 0, `区间内第 ${rayFrom + 1} 行`)
check('射线段终点命中（最后一个 `});`）', rayTo >= rayFrom, `区间内第 ${rayTo + 1} 行`)
check('射线段共 6 个"语句块头"（1 个 let + 2 个 const + 2 个监听 + 1 个收尾）',
  rayLines.filter((l) => /mirrorDown|mirrorRay|mirrorMouse|addEventListener|\}\);/.test(l)).length >= 6,
  `${rayLines.length} 行（含块内缩进行）`)
for (const l of rayLines) console.log(`      · ${l.trim()}`)

console.log('\n【⑤ update() 与 updateNewDecor() 的那 8 行逐行等价】')
const branchFrom = monoLines.findIndex((l) => l.trim() === 'for (let i = mirrorRipples.length - 1; i >= 0; i--) {')
const branchTo = monoLines.findIndex((l) => l.includes('mirrorRipples.length || mirrorDirtyT > 0.12'))
check('原分支找到（8 行）', branchFrom > 0 && branchTo === branchFrom + 7, `L${branchFrom + 1}–L${branchTo + 1}`)
const branch = monoLines.slice(branchFrom, branchTo + 1)
const updateAt = propLines.findIndex((l) => l.includes('update(dt, time, s) {'))
const upd = propLines.slice(updateAt + 1, propLines.findIndex((l, i) => i > updateAt && l.trim() === '},'))
const branchMissing = []
for (const raw of branch) {
  if (!raw.trim()) continue
  // `updateNewDecor()` 体内是 16 空格底层缩进，`update()` 体内是 4 空格 ⇒ 去掉 12 空格前缀
  const want = raw.replace(/^ {12}/, '').replace(/mirrorDirtyT/g, 's.dirtyT').replace(/(?<![.\w])drawMirror\(/g, 's.drawMirror(')
  const hit = upd.findIndex((l) => l.trimEnd() === want)
  if (hit === -1) branchMissing.push(want.trim())
  else matched.add(updateAt + 1 + hit)          // 记进"已对上"，免得 ⑥ 把它们算成"多出来的行"
}
check('8 行全部逐字对上（只加 `s.` 前缀）', branchMissing.length === 0, branchMissing.join(' | ') || '8/8')
check('update 里不含任何 mirrorDirtyT（旧顶层 let 已进 state）', !upd.some((l) => /(?<![.\w])mirrorDirtyT/.test(l)))

console.log('\n【⑥ 物件文件里"多出来的代码行"（应只有搬迁必需的胶水）】')
const extraInProp = new Set(propLines.map((l, i) => i))
for (const i of matched) extraInProp.delete(i)
const isComment = (l) => /^\s*(\/\*|\*|\/\/|$)/.test(l)
const extras = [...extraInProp].filter((i) => !isComment(propLines[i])).map((i) => propLines[i])
check('多出的代码行 ≤ 26（模板 + state + ctx 解构 + 别名 / 交接 / return）',
  extras.length <= 26, `${extras.length} 行；已对上 ${matched.size} 行`)
for (const l of extras) console.log(`      + ${l.trim()}`)

console.log('\n【⑦ 交付一致性】')
const propCode = prop.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
check("文件里声明 id: 'floor2/mirror'", /id: 'floor2\/mirror'/.test(prop))
check('代码里没有 regMagic / interactables（本件走自建射线，留给 J4）',
  !/regMagic/.test(propCode) && !/interactables/.test(propCode))
check('射线代码没有以任何形式留在物件文件里（不留死代码）',
  !/addEventListener|Raycaster|setFromCamera/.test(propCode))
check('state 交出了 J4 要用的两样（drawMirror / spawnRipple）',
  /state\.drawMirror = drawMirror;/.test(propCode) && /state\.spawnRipple = spawnMirrorRipple;/.test(propCode))
check('parts 交出了 pane / tilt', /parts: \{ pane: mirrorPane, tilt: mirrorTilt \}/.test(propCode))

console.log(`\n结果：${pass} 通过 / ${fail} 失败\n`)
process.exit(fail ? 1 : 0)
