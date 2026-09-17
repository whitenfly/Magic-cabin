/**
 * `J4.47` 判据 —— 「碰撞表还是原来那张表」
 *
 * ## 为什么必须有这个脚本
 *
 * 碰撞**不参与渲染**。于是本项目的三条既有门禁**原理上都看不见它**：
 *
 * | 门禁 | 为什么看不见 |
 * |---|---|
 * | `test:visual` | 三个机位是**没人去走的**定格帧 —— 碰撞盒错 0.1 也不改一个像素 |
 * | `j3-probe` | 只问"交互入口存不存在"（`magicMeshes` / `aimLabel`），不问能不能站上去 |
 * | `verify-migration` | 只数**标识符出现次数**，不解释数值 |
 *
 * `J4` 阶段搬走 35 件物件时，碰撞表里大量盒子的坐标**改成了从 `layout.js` 取值**
 * （不变量 N9：坐标只有一个来源），另有多处移动平台改成读**装配记录里的部件实例**。
 * 这些改动全靠**人工论证**兜底（"数值逐字未变 + 用的是同一个实例"）——
 * 而论证**不能被自动重跑**，下一个人也无法复核。
 *
 * ## 判据形态（用户拍板：结构化数值摘要 + 基线比对）
 *
 * 页面在 `?stats=1` 下暴露 `window.__cabinCollisionDigest(probes)`（见 `SceneLoop.js`），
 * 返回**结构化数值摘要**（不是哈希 —— 失败时能直接指出是哪一项、差多少）：
 *
 * | 字段 | 内容 | 抓什么 |
 * |---|---|---|
 * | `platformBoxes` | 17 个固定碰撞盒的 `[x1,z1,x2,z2,top,bot]` | 坐标 / 尺寸被改动 |
 * | `activePlatforms` | 加上 10 个**移动平台**（读物件实例位置）后的完整表 | 物件的**引用或初始位置**错了 |
 * | `ground` / `stairs` / `collide` / `rails` | 五个纯函数在**本文件给定探测点**上的输出 | 数值没变、但**判据逻辑**被改坏 |
 *
 * ★ 探测点是**本文件里的硬编码常量**：不从被测数据推导 —— 否则"盒改了、探测点跟着改"，
 * 摘要就永远不变了（判据会瞎）。
 *
 * ## 用法
 *
 * ```
 * node tests/e2e/collision.mjs                    # 与基线比对（需要先 pnpm build + pnpm serve）
 * node tests/e2e/collision.mjs --record           # 确认改动**有意**之后重录基线
 * node tests/e2e/collision.mjs --url=http://127.0.0.1:5173
 * ```
 *
 * 实测：① 未改动代码 ⇒ 绿；② 任一碰撞盒坐标改错 0.1 ⇒ **红**（负例见 `J4.47-实施结果.md`）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { findBrowser, launch, connect } from './cdp.mjs'
import { resolveHomePath } from './page.mjs'

const ROOT = path.resolve(import.meta.dirname, '../..')
const BASELINE = path.join(ROOT, 'tests/baseline/collision-digest.json')

const OPTS = { url: 'http://127.0.0.1:4321', record: false }
for (const a of process.argv.slice(2)) {
  if (a.startsWith('--url=')) OPTS.url = a.slice('--url='.length)
  else if (a === '--record') OPTS.record = true
}
const BASE = OPTS.url.replace(/\/$/, '')

/* ─────────────────────── 探测点（硬编码常量 · 测试资产） ─────────────────────── */

/**
 * ★ 探测点的**选取原则**：不是随手撒点，而是**覆盖被测函数的判据边界**。
 *
 *   第一版只用 8×8 直角网格 —— 负例测试当场揭穿了它：把 `groundAt` 的 `r < 1.20`
 *   改成 `1.10`（判据逻辑被改坏）时**判据照样绿** —— 因为网格点的 `r = hypot(x, z)`
 *   全部落在 (1.10, 1.20) **之外**，那次改动对它们毫无影响。
 *   ⇒ 改成「半径环 × 角度扇区」：半径取 `groundAt` / `railCollide` 里**出现过的每一个分界值**
 *     （0.10 · 0.30 · 0.98 · 1.12 · 1.14 · 1.20 · 1.24 · 1.25 · 1.27 … 各带 ±0.01 邻域），
 *     角度取扇区边界（18 / 30 / 60 / 62 / 160 / 300 …）。
 */

/** 极坐标 → 世界坐标（与 `groundAt` 内部的 `hypot` / `atan2(x, z)` 严格同构） */
const polar = (r, aDeg) => {
  const a = (aDeg * Math.PI) / 180
  return [r * Math.sin(a), r * Math.cos(a)]
}

/** 半径环：全是 `groundAt` / `railCollide` 里出现过的分界值 */
const RS = [0.05, 0.10, 0.11, 0.50, 0.98, 1.10, 1.12, 1.14, 1.19, 1.20, 1.21, 1.24, 1.25, 1.27, 1.60, 2.00, 2.90, 3.10]
/** 角度扇区：30 / 60 / 160 / 300 是判据边界，其余是扇区内部的代表点 */
const AS = [0, 18, 29, 30, 31, 45, 60, 61, 62, 90, 135, 160, 180, 225, 270, 299, 300, 301, 330]

/** 地面采样：极坐标环（楼梯 / 栏杆 / 二楼门槛边界）+ 直角网格（家具平台的上方与下方） */
const GROUND = []
for (const r of RS) for (const a of AS) { const [x, z] = polar(r, a); GROUND.push([x, z, 1.2]) }
for (const x of [-3.5, -2.5, -1.5, -0.5, 0.5, 1.5, 2.5, 3.5]) {
  for (const z of [-3.5, -2.5, -1.5, -0.5, 0.5, 1.5, 2.5, 3.5]) { GROUND.push([x, z, 0.3]); GROUND.push([x, z, 1.2]) }
}

/** 楼梯高度：**含判据边界**（`aDeg > 30 && aDeg < 300` —— 30 / 300 两侧各取一点） */
const STAIRS = [-10, 0, 15, 29, 30, 31, 45, 90, 135, 180, 225, 270, 299, 300, 301, 330, 359]

/** XZ 推挤：屋内外若干点（含书架 / 坩埚 / 门口 / 二楼家具走廊 / 墙体与栏杆半径） */
const COLLIDE = [
  [0, 0, 1.5], [0, 0, 0.3], [0, 0, 2.6], [0.5, 0.5, 1.5], [-0.5, -0.5, 1.5],
  [3.2, 3.6, 1.5], [-3.7, -2.85, 1.5], [1.8, 1.8, 0.3], [-1.8, -1.5, 0.3],
  [0, -3.2, 1.2], [2.6, -3.4, 2.2], [-2.5, 2.8, 2.2], [4, 0, 1], [0, 4, 1],
  [3.9, 3.9, 1.5], [-3.9, -3.9, 1.5], [0, 3.9, 1.5], [3.9, 0, 1.5],
  [1.19, 0.10, 1.5], [1.24, 0, 2.6], [0, 1.25, 1.0],
]

/** 栏杆：`(px, pz, y, prevX, prevZ)` —— 跨越 `railCollide` 的半径分界（**双向**）× 三个高度带 */
const RAILS = []
for (const [rA, rB] of [[1.14, 1.34], [0.90, 1.04], [0.24, 0.36]]) {
  for (const a of [0, 45, 90, 135, 180, 225, 270, 315]) {
    for (const y of [0.3, 0.6, 1.2]) {
      const [xa, za] = polar(rA, a)
      const [xb, zb] = polar(rB, a)
      RAILS.push([xb, zb, y, xa, za])
      RAILS.push([xa, za, y, xb, zb])
    }
  }
}

const PROBES = { ground: GROUND, stairs: STAIRS, collide: COLLIDE, rails: RAILS }

/** 盒标签：失败时能直接说"**是哪一件家具**的哪条边变了"，而不是一个下标 */
const FIXED_LABELS = [
  '原木餐桌', '长餐桌', '暖桌', '水晶球占卜台', '灶台旁固定木台', '左墙书架', '大魔女坩埚',
  '楼梯下储物箱', '塔罗牌小圆凳', '二楼大床', '二楼床头柜', '二楼书桌', '二楼衣柜', '二楼拱形全身镜',
  '二楼小黑板画架', '二楼置物箱', '二楼垃圾桶',
]
const MOVING_LABELS = [
  '圆凳A', '圆凳B', '滑轮置物台', '二楼书桌椅', '高脚凳',
  '餐椅1', '餐椅2', '餐椅3', '餐椅4', '餐椅5',
]
const BOX_LABELS = [...FIXED_LABELS, ...MOVING_LABELS]
const FIELD = ['x1', 'z1', 'x2', 'z2', 'top', 'bot']

/* ───────────────────────────── 展平与比对 ───────────────────────────── */

/** 把摘要展平成 `路径 → 数值`，便于逐项定位差异 */
function flatten(d) {
  const out = {}
  const put = (k, v) => { out[k] = v }
  d.platformBoxes.forEach((b, i) => b.forEach((v, j) => put(`platformBoxes[${i}].${FIELD[j]}`, v)))
  d.activePlatforms.forEach((b, i) => b.forEach((v, j) => put(`activePlatforms[${i}].${FIELD[j]}`, v)))
  d.ground.forEach((v, i) => put(`ground[${i}] (x=${GROUND[i][0]}, z=${GROUND[i][1]}, y=${GROUND[i][2]})`, v))
  d.stairs.forEach((v, i) => put(`stairs[${i}] (a=${STAIRS[i]}°)`, v))
  d.collide.forEach((v, i) => put(`collide[${i}] (${COLLIDE[i].join(', ')}) → x`, v[0]))
  d.collide.forEach((v, i) => put(`collide[${i}] (${COLLIDE[i].join(', ')}) → z`, v[1]))
  d.rails.forEach((v, i) => put(`rails[${i}] (${RAILS[i].join(', ')}) → x`, v[0]))
  d.rails.forEach((v, i) => put(`rails[${i}] (${RAILS[i].join(', ')}) → z`, v[1]))
  return out
}

/** 把下标路径翻译成"人话"（家具名 + 字段名） */
function humanize(key) {
  const m = key.match(/^(platformBoxes|activePlatforms)\[(\d+)\]\.(\w+)$/)
  if (m) {
    // `activePlatforms` = 固定盒 + 移动平台（前 17 项就是固定盒）—— 标签按实际来源给
    const i = +m[2]
    const kind = i < FIXED_LABELS.length ? '固定盒' : '移动平台'
    return `${kind}「${BOX_LABELS[i] || '未知'}」的 ${m[3]}`
  }
  return key
}

let pass = 0
let fail = 0
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? '  →  ' + detail : ''}`)
  ok ? pass++ : fail++
}

console.log('')
console.log('  J4.47 · 碰撞表判据（碰撞盒数值 + 五个纯函数的探测点输出）')
console.log('  ──────────────────────────────────────────')
console.log(`  服务      ${BASE}`)
console.log(`  基线      tests/baseline/collision-digest.json`)
console.log(`  探测点    ground ${GROUND.length} · stairs ${STAIRS.length} · collide ${COLLIDE.length} · rails ${RAILS.length}`)
console.log(`  模式      ${OPTS.record ? '★ 录制基线（--record）' : '与基线比对'}`)
console.log('  ──────────────────────────────────────────')

const browser = findBrowser()
if (!browser) {
  console.error('✗ 未找到 Chrome / Edge（可用 CABIN_BROWSER 指定路径）')
  process.exit(1)
}
const HOME = await resolveHomePath(BASE, {
  onError: (why) => console.error(`✗ 无法访问 ${BASE} —— ${why}\n  请先启动服务：pnpm serve（需要先 pnpm build）\n`),
})
if (!HOME) process.exit(2)

const chrome = await launch({ port: 9361, width: 900, height: 600 })
const page = await connect(chrome.port)
await page.setViewport(900, 600)

try {
  // `stats=1` 才会暴露钩子（沿用 J0.6 的约定：正常游玩路径上不存在这个接口）
  await page.navigate(`${BASE}${HOME}?deterministic=1&frames=1&bare=1&stats=1`)
  await page.waitFor('document.documentElement.dataset.cabin === "ready"', { timeout: 120000 })

  const hasHook = await page.eval(`typeof window.__cabinCollisionDigest === 'function'`)
  check('碰撞摘要钩子可读（?stats=1）', hasHook === true, hasHook ? '' : '未暴露')
  if (!hasHook) throw new Error('钩子缺失 —— 无法继续')

  const digest = await page.eval(`window.__cabinCollisionDigest(${JSON.stringify(PROBES)})`)
  check('摘要结构完整', Boolean(digest && digest.platformBoxes && digest.ground), digest ? Object.keys(digest).join(' / ') : '空')

  const flat = flatten(digest)
  const errs = page.errors()
  check('全程无未捕获页面异常', errs.length === 0, errs.slice(0, 2).map((e) => e.text).join(' | '))

  if (OPTS.record) {
    const out = {
      what: '碰撞表摘要（J4.47）—— 碰撞盒数值 + 五个纯函数在固定探测点上的输出',
      why: '碰撞不参与渲染 ⇒ test:visual 原理上无感、j3-probe 只问交互入口。这是它唯一的自动判据。',
      note: '⚠️ 有意改动 collision.js / layout.js / 任何物件的初始位置后，本项会红 —— 确认无误后重跑 node tests/e2e/collision.mjs --record。',
      recordedAt: new Date().toISOString().slice(0, 10),
      probes: PROBES,
      digest,
    }
    fs.mkdirSync(path.dirname(BASELINE), { recursive: true })
    fs.writeFileSync(BASELINE, JSON.stringify(out, null, 2) + '\n')
    console.log(`\n  ★ 已录制基线：tests/baseline/collision-digest.json（${Object.keys(flat).length} 项）\n`)
  } else {
    if (!fs.existsSync(BASELINE)) {
      console.error(`\n  ✗ 基线不存在：tests/baseline/collision-digest.json`)
      console.error(`    先录一次：node tests/e2e/collision.mjs --record\n`)
      process.exit(1)
    }
    const base = JSON.parse(fs.readFileSync(BASELINE, 'utf8'))
    // ★ 先比探测点：改探测点 = 改判据 —— 必须**显式**重录基线，不能悄悄放宽
    const probesSame = JSON.stringify(base.probes) === JSON.stringify(PROBES)
    check('探测点与基线一致（改探测点必须 --record 重录）', probesSame, probesSame ? `${Object.keys(flat).length} 项` : '探测点被改动')

    const baseFlat = flatten(base.digest)
    const diffs = []
    for (const k of Object.keys(baseFlat)) {
      if (!(k in flat)) { diffs.push([k, baseFlat[k], '(缺失)']); continue }
      if (baseFlat[k] !== flat[k]) diffs.push([k, baseFlat[k], flat[k]])
    }
    for (const k of Object.keys(flat)) if (!(k in baseFlat)) diffs.push([k, '(新增)', flat[k]])

    check(
      '★ 碰撞摘要与基线**逐项一致**',
      diffs.length === 0,
      diffs.length ? `${diffs.length} 项不同（共 ${Object.keys(baseFlat).length} 项）` : `${Object.keys(baseFlat).length} 项全部相同`,
    )
    if (diffs.length) {
      console.log('\n  ── 差异明细（最多 15 条）──────────────────────────')
      for (const [k, a, b] of diffs.slice(0, 15)) {
        const d = typeof a === 'number' && typeof b === 'number' ? `（差 ${(b - a).toFixed(6)}）` : ''
        console.log(`    · ${humanize(k)}`)
        console.log(`        基线 ${a}  →  现在 ${b}${d}`)
      }
      if (diffs.length > 15) console.log(`    …另有 ${diffs.length - 15} 项`)
      console.log('')
    }
  }
} finally {
  await page.close().catch(() => {})
  chrome.kill()
}

console.log(`\n  结果：${fail === 0 ? '通过' : fail + ' 项失败'}\n`)
process.exit(fail === 0 ? 0 : 1)
