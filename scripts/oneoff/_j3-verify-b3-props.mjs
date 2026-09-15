/**
 * 一次性自检（`J3` / B3）：`floor1/book-pile`、`floor1/star-bell`、`floor1/tarot` 三件是否**逐字未改**
 *
 * 四组判据，全部不依赖浏览器：
 *   ① **文本判据**：monolith 原区间每一行（trim 后）必须在新模块里**连续**出现且逐行相同
 *      （只允许四类已知改写：位置行换成 layout 常量、状态行搬进 `state()`、状态量加 `s.` 前缀、
 *        `regMagic` 回调体搬进 `onActivate`、牌数组 `tarotCards → parts.cards`）；
 *   ② **运行判据**：真 `createSketch` + 桩 `rng` 跑 `build` ⇒ 场景层级 / 几何数量 / 世界坐标 /
 *      `rng` 调用次数逐项核对（`rng` 调用次数决定后续随机数序列，是像素零差异的关键之一）；
 *   ③ **装配判据**：`createPropInstaller().install()` 全流程 —— 交互（`mode:'both'`、锚点与 layout 同源）、
 *      `scheduler` 任务、以及 ★ **准星/点击通路**（`magicMeshes` + `userData.onClick` / `aimLabel`）。
 *      `app/installProp.js` 的 ⑤.2 明说"这条通路没有任何测试守得住"，本文件就是给它补的一处守卫；
 *   ④ **行为判据**：`tick()` 跑完整轮状态机（书堆 推倒→落定→叠回 / 星铃 转动 / 塔罗 飞起→悬浮→归位）。
 *
 * 用 `node scripts/oneoff/_j3-verify-b3-props.mjs` 跑；**只读**，不写盘。
 */
import fs from 'node:fs'
import path from 'node:path'
import * as THREE from 'three'
import { createLayout } from '../../src/cabin/world/layout.js'
import { createSketch } from '../../src/cabin/core/geometry/sketch.js'
import { createRegistry } from '../../src/cabin/app/Registry.js'
import { createUpdateScheduler } from '../../src/cabin/app/UpdateScheduler.js'
import { createPropInstaller } from '../../src/cabin/app/installProp.js'
import bookPile from '../../src/cabin/world/floor1/bookPile.js'
import starBell from '../../src/cabin/world/floor1/starBell.js'
import tarot from '../../src/cabin/world/floor1/tarot.js'

const ROOT = path.resolve(import.meta.dirname, '../..')
const MONO = fs.readFileSync(path.join(ROOT, 'src/cabin/legacy/monolith.js'), 'utf8').split('\n')
const fail = []
const ok = (cond, label) => { if (!cond) fail.push(label); console.log(`${cond ? '  ✓' : '  ✗'} ${label}`) }
const near = (a, b, eps = 1e-12) => Math.abs(a - b) < eps

/* ══════════ ① 文本判据 ══════════ */
const unPrefix = (l) => l.replace(/\bs\.(pileState|pileT|carOn|carP|tarotState|tarotT)\b/g, '$1')
/** 已知改写：左 = 原文（trim），右 = 新模块里的对应行（null = 搬进 state()，产物里没有） */
const REPL = new Map([
  ['bookPileG.position.set(-3.62, 0, -1.4);', 'bookPileG.position.set(BOOK_PILE_POS.x, BOOK_PILE_POS.y, BOOK_PILE_POS.z);'],
  ['car.position.set(SFX, 1.975, -3.05);', 'car.position.set(STARBELL_POS.x, STARBELL_POS.y, STARBELL_POS.z);'],
  ['tarotG.position.set(-0.75, 0, -2.8);', 'tarotG.position.set(TAROT_POS.x, TAROT_POS.y, TAROT_POS.z);'],
  ["let pileState = 'stacked', pileT = 0;", null],
  ['let carOn = false, carP = 0;', null],
  ["let tarotState = 'stacked', tarotT = 0;", null],
  ['for (const c of tarotCards) {', 'for (const c of parts.cards) {'],
])

function moduleLines(file) {
  const out = []
  let inHeader = false
  for (const raw of fs.readFileSync(path.join(ROOT, file), 'utf8').split('\n')) {
    const l = raw.trim()
    if (inHeader) { if (l.endsWith('*/')) inHeader = false; continue }
    if (l.startsWith('/**')) { if (!l.endsWith('*/')) inHeader = true; continue }
    if (!l || l.startsWith('//') || l.startsWith('*')) continue
    if (l.startsWith('/*')) { out.push(unPrefix(l)); continue }
    if (l.startsWith('import ') || l.startsWith('export ')) continue
    out.push(unPrefix(l))
  }
  return out
}
function textCheck(name, file, blocks) {
  const lines = moduleLines(file)
  for (const [tag, a, b] of blocks) {
    const want = MONO.slice(a - 1, b).map((l) => l.trim()).filter((l) => l !== '')
      .map((l) => (REPL.has(l) ? REPL.get(l) : l)).filter((l) => l !== null).map(unPrefix)
    let hit = -1
    for (let s = 0; s + want.length <= lines.length; s++) {
      let good = true
      for (let k = 0; k < want.length; k++) if (lines[s + k] !== want[k]) { good = false; break }
      if (good) { hit = s; break }
    }
    ok(hit >= 0, `${name} ${tag}（monolith L${a}–L${b}，${want.length} 行）在新模块里连续且逐行相同`)
  }
}
console.log('\n① 文本：monolith 原区间 vs 新模块（逐行相同，只含已声明改写）')
textCheck('floor1/book-pile', 'src/cabin/world/floor1/bookPile.js', [
  ['几何段', 1062, 1108], ['regMagic 回调体', 1110, 1111], ['每帧段', 7724, 7760],
])
textCheck('floor1/star-bell', 'src/cabin/world/floor1/starBell.js', [
  ['几何段', 1122, 1139], ['每帧段', 8192, 8198],
])
textCheck('floor1/tarot', 'src/cabin/world/floor1/tarot.js', [
  ['几何段', 1842, 1878], ['tarotPose（挪到模块作用域）', 1879, 1888],
  ['regMagic 回调体', 1890, 1898], ['每帧段', 8048, 8094],
])

/* 区间外零引用：这些名字的全部命中必须落在本件区间内 */
const NAMES = ['bookPileG', 'pileBooks', 'pileState', 'pileT', 'carOn', 'carP', 'carCanopy', 'carStars',
  'tarotG', 'tarotCards', 'tarotState', 'tarotT', 'TAROT_N', 'tarotPose']
const RANGES = [[1062, 1112], [1121, 1140], [1842, 1899], [7726, 7758], [8050, 8092], [8193, 8196]]
const stray = []
for (const nm of NAMES) {
  const re = new RegExp(`\\b${nm}\\b`)
  MONO.forEach((l, i) => {
    if (re.test(l) && !RANGES.some(([a, b]) => i + 1 >= a && i + 1 <= b)) stray.push(`${nm}@L${i + 1}`)
  })
}
ok(stray.length === 0, `14 个名字区间外零引用${stray.length ? '（越界：' + stray.join(' ') + '）' : ''}`)

/* ══════════ ② 运行判据 ══════════ */
console.log('\n② 运行：真 createSketch + 桩 rng 跑 build（rng 恒返回 0.5 ⇒ 位置可解析核对）')
const SPECS = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/oneoff/_j3-specs/floor1-book-pile.json'), 'utf8'))
const SPECB = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/oneoff/_j3-specs/floor1-star-bell.json'), 'utf8'))
const SPECT = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/oneoff/_j3-specs/floor1-tarot.json'), 'utf8'))
/** spec 声明的 layout 常量（应用器会照着写进 world/layout.js）——本脚本先补上，好让 build 跑起来 */
const LAYOUT_ADD = {
  BOOK_PILE_POS: { x: -3.62, y: 0, z: -1.4 },
  STARBELL_POS: { x: -3.72, y: 1.975, z: -3.05 },
  TAROT_POS: { x: -0.75, y: 0, z: -2.8 },
}
/** spec ↔ 本脚本 双向核对（数值一个都不能差） */
for (const [spec, name] of [[SPECS, 'BOOK_PILE_POS'], [SPECB, 'STARBELL_POS'], [SPECT, 'TAROT_POS']]) {
  const c = (spec.layout || []).find((x) => x.name === name)
  const v = LAYOUT_ADD[name]
  ok(!!c && c.value === `{ x: ${v.x}, y: ${v.y}, z: ${v.z} }`, `spec 的 ${name} 声明与几何同源：${c && c.value}`)
}

function makeEnv() {
  const scene = new THREE.Scene()
  const materials = {
    line: new THREE.LineBasicMaterial(), inner: new THREE.LineBasicMaterial(),
    dash: new THREE.LineBasicMaterial(), fill: new THREE.MeshBasicMaterial(),
  }
  const dsl = createSketch({ scene, materials })
  const L = { ...createLayout(), ...LAYOUT_ADD }
  const rngState = { calls: 0 }
  const rng = { floor1: () => { rngState.calls++; return 0.5 } }
  return { scene, L, rng, rngState, ...dsl }
}

/* ── 书堆：13 本，每本 4 次 rng ── */
{
  const env = makeEnv()
  const built = bookPile.build(env)
  ok(built.root === built.parts.body && env.scene.children.length === 1 && env.scene.children[0] === built.root,
    '书堆：只在 scene 下新增 1 个 Group（未引入额外层级）')
  ok(near(env.scene.children[0].position.x, -3.62) && near(env.scene.children[0].position.y, 0)
    && near(env.scene.children[0].position.z, -1.4), '书堆：组原点 = BOOK_PILE_POS(-3.62, 0, -1.4)')
  ok(built.parts.books.length === 13 && built.root.children.length === 13, '书堆：13 本书（与原文 DIMS 同长）')
  ok(env.rngState.calls === 78, `书堆：floor1Rng() 调用 78 次（13 × 6，实际 ${env.rngState.calls}）`)
  const bad = []
  built.parts.books.forEach((b, i) => {
    const u = b.userData
    if (!(near(u.sx, 0) && near(u.sz, 0) && near(u.sry, 0))) bad.push(`#${i} s*`)
    if (!near(u.fx, 0.16 + i * 0.048)) bad.push(`#${i} fx`)
    if (!near(u.fz, -(0.22 + i * 0.052))) bad.push(`#${i} fz`)
    if (!near(u.fry, Math.PI)) bad.push(`#${i} fry`)
    if (![u.sx, u.sy, u.sz, u.fx, u.fy, u.fz, u.sry, u.fry].every(Number.isFinite)) bad.push(`#${i} NaN`)
  })
  ok(bad.length === 0, `书堆：13 本的 userData 契约字段与解析值一致${bad.length ? '（' + bad.join(' ') + '）' : ''}`)
}

/* ── 星铃：不消耗 rng ── */
{
  const env = makeEnv()
  const built = starBell.build(env)
  const car = env.scene.children[0]
  ok(env.scene.children.length === 1 && car === built.root && built.parts.body === car,
    '星铃：只在 scene 下新增 1 个 Group（未引入额外层级）')
  ok(near(car.position.x, -3.72) && near(car.position.y, 1.975) && near(car.position.z, -3.05),
    '星铃：组原点 = STARBELL_POS(-3.72, 1.975, -3.05)（x 与书架 SFX 同值）')
  ok(built.parts.canopy.parent === car && built.parts.stars.length === 4, '星铃：顶篷是 car 的子节点，四颗小星齐备')
  ok(env.rngState.calls === 0, '星铃：不消耗种子随机源（rng 调用 0 次）')
}

/* ── 塔罗：9 张，每张 2 次 rng ── */
{
  const env = makeEnv()
  const built = tarot.build(env)
  const g = env.scene.children[0]
  ok(env.scene.children.length === 1 && g === built.root, '塔罗：只在 scene 下新增 1 个 Group（未引入额外层级）')
  ok(near(g.position.x, -0.75) && near(g.position.y, 0) && near(g.position.z, -2.8),
    '塔罗：组原点 = TAROT_POS(-0.75, 0, -2.8)')
  ok(built.parts.cards.length === 9 && g.children.length === 13,
    `塔罗：9 张牌 + 3 条腿 + 1 个台面 = 13 个子节点（实际 ${g.children.length}）`)
  ok(env.rngState.calls === 18, `塔罗：floor1Rng() 调用 18 次（9 × 2，实际 ${env.rngState.calls}）`)
  const bad = []
  built.parts.cards.forEach((c, i) => {
    const u = c.userData
    if (!near(u.sx, 0) || !near(u.sz, 0)) bad.push(`#${i} s*`)
    if (!near(u.sy, 0.482 + i * 0.0065)) bad.push(`#${i} sy`)
    if (!near(u.fa, i * (Math.PI * 2 * 1.05 / 9))) bad.push(`#${i} fa`)
    if (!near(u.fr, 0.15 + i * 0.022) || !near(u.fy, 1.05 + i * 0.14)) bad.push(`#${i} fr/fy`)
  })
  ok(bad.length === 0, `塔罗：9 张的 userData 契约字段与解析值一致${bad.length ? '（' + bad.join(' ') + '）' : ''}`)
}

/* ══════════ ③ 装配判据（含 ★ 准星/点击通路） ══════════ */
console.log('\n③ 装配：installProp 全流程 + 准星/点击通路（magicMeshes / onClick / aimLabel）')
function assemble(prop, anchorName, expectLabel) {
  const env = makeEnv()
  const registry = createRegistry()
  const installer = createPropInstaller({ registry, scheduler: createUpdateScheduler(), mounts: null })
  let rec = null
  try { rec = installer.install(prop, { ctx: env }) } catch (e) { ok(false, `${prop.id} install 抛错：${e.message}`); return null }
  ok(registry.stats().props === 1, `${prop.id}：registry 恰好 1 件物件`)
  ok(rec.interactions.length === 1 && rec.interactions[0].mode === 'both', `${prop.id}：1 条交互且 mode='both'（近距 + 准星）`)
  const it = rec.interactions[0]
  ok(it.anchor.x === env.L[anchorName].x && it.anchor.z === env.L[anchorName].z,
    `${prop.id}：anchor 与几何同源（= L.${anchorName}）`)
  ok(it.radius === 1.8, `${prop.id}：radius = 1.8`)
  ok(it.label === expectLabel && it.label !== '交互', `${prop.id}：label 语义化「${it.label}」`)
  ok(!!rec.task && typeof rec.tick === 'function', `${prop.id}：update 已登记进 scheduler 且拿到 tick 句柄`)
  const ud = rec.root.userData
  ok(typeof ud.onClick === 'function' && ud.aimLabel === it.label && ud.sfx === 'toggle',
    `${prop.id}：★ 准星通路已补（userData.onClick / aimLabel / sfx）`)
  const meshes = []
  rec.root.traverse((m) => { if (m.isMesh && !m.userData.noHit) meshes.push(m) })
  ok(registry.magicMeshes.length === meshes.length && meshes.length > 0,
    `${prop.id}：★ magicMeshes 收录了全部可命中 Mesh（${meshes.length} 个）`)
  return { rec, env, it }
}

const bp = assemble(bookPile, 'BOOK_PILE_POS', '推倒 / 叠回左窗下的魔法书堆')
const sb = assemble(starBell, 'STARBELL_POS', '转动 / 停下旋转星铃')
const tb = assemble(tarot, 'TAROT_POS', '掀开 / 收起塔罗牌阵')

/* ══════════ ④ 行为判据：tick 跑完状态机 ══════════ */
console.log('\n④ 行为：原地 tick 的状态机（推倒→落定→叠回 / 转动 / 飞起→悬浮→归位）')
const run = (rec, dt, n, t0 = 0) => { for (let i = 0; i < n; i++) rec.tick(dt, t0 + i * dt) }

if (bp) {
  const s = bp.rec.state, books = bp.rec.parts.books
  bp.it.onActivate()
  ok(s.pileState === 'falling', '书堆：第一次交互 → falling')
  run(bp.rec, 0.1, 20)
  ok(s.pileState === 'fallen', '书堆：~1.5s 后 → fallen（13 本全部落定）')
  const allAt = books.every((b, i) => near(b.position.x, b.userData.fx) && near(b.position.z, b.userData.fz))
  ok(allAt, '书堆：落定后每本书都在自己的 fx/fz 上')
  bp.it.onActivate()
  ok(s.pileState === 'rising', '书堆：再次交互 → rising')
  run(bp.rec, 0.1, 30)
  ok(s.pileState === 'stacked' && books.every((b) => near(b.position.x, b.userData.sx)),
    '书堆：~2s 后 → stacked（每本书回到 sx）')
}
if (sb) {
  const s = sb.rec.state, canopy = sb.rec.parts.canopy, stars = sb.rec.parts.stars
  const y0 = canopy.rotation.y
  sb.it.onActivate()
  ok(s.carOn === true, '星铃：交互 → carOn = true')
  run(sb.rec, 1 / 60, 60, 0)
  ok(s.carP > 0 && s.carP < 1, `星铃：carP 平滑趋近 1（1s 后 ${s.carP.toFixed(4)}）`)
  ok(canopy.rotation.y > y0, '星铃：顶篷持续旋转')
  ok(stars.every((st) => near(st.position.y, -0.072, 0.02)), '星铃：四颗小星在 ±0.01 幅度内摆动')
  sb.it.onActivate()
  ok(s.carOn === false, '星铃：再次交互 → carOn = false')
}
if (tb) {
  const s = tb.rec.state, cards = tb.rec.parts.cards
  tb.it.onActivate()
  ok(s.tarotState === 'flying', '塔罗：第一次交互 → flying')
  run(tb.rec, 0.1, 20)
  ok(s.tarotState === 'floating', '塔罗：~1.4s 后 → floating')
  const spread = cards.map((c) => Math.hypot(c.position.x, c.position.z))
  ok(spread.every((d, i) => near(d, 0.15 + i * 0.022, 1e-9)), '塔罗：悬浮半径 = fr（0.15 + i·0.022）')
  tb.it.onActivate()
  ok(s.tarotState === 'returning', '塔罗：第二次交互（floating 态）→ returning（先记住当前位置）')
  run(tb.rec, 0.1, 20)
  ok(s.tarotState === 'stacked' && cards.every((c) => near(c.position.x, c.userData.sx) && near(c.position.y, c.userData.sy)),
    '塔罗：~1.3s 后 → stacked（每张牌回到 sx/sy/sz）')
}

console.log(fail.length ? `\n✗ ${fail.length} 项不通过\n` : '\n✓ 全部通过\n')
process.exit(fail.length ? 1 : 0)
