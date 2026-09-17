/**
 * `J4.49` 判据 —— 「点魔法书本，六相位翻页真的走完了」
 *
 * ## 为什么必须有这个脚本
 *
 * 与 `test:wand` / `test:board` 同一个理由：`test:visual` 的三个机位是**没人去点的定格帧**
 * ——书本静止时 `phase === 'closed'`，封面合着、书页没动，三张定格图与"翻页动画全坏掉"
 * 长得**一模一样**；而 `j3-probe` 只能证明 `magic-book/toggle` 这个 aim 入口存在。
 *
 * ## 判据（只断言**确定性事实**）
 *
 * 六相位机（`magicBook.js` 的 `state()`）：
 *
 * ```
 * closed ──点──▶ opening ──▶ flipping ──▶ fanning ──▶ open
 *   ▲                                                   │
 *   └──────────── closing ◀────────点───────────────────┘
 * ```
 *
 * 1. 初始 `phase === 'closed'`，且**中间相位不响应**（`opening`/`flipping`/`fanning` 时点击无效）；
 * 2. 点一次 ⇒ 逐帧采样，去重后的相位序列必须**按序**出现 `opening → flipping → fanning → open`；
 * 3. 停在 `open` 后再点一次 ⇒ 序列按序出现 `closing → closed`；
 * 4. 全程无未捕获页面异常。
 *
 * ★ **不断言任何角度/时长数值** —— 那是搬运时的逐字实现细节，断言它会让判据在"合理调参"时误报。
 *
 * ## 用法
 *
 * ```
 * node tests/e2e/magic-book.mjs                      # 需要先 pnpm build + pnpm serve
 * node tests/e2e/magic-book.mjs --url=http://127.0.0.1:5173
 * ```
 */
import path from 'node:path'
import { findBrowser, launch, connect } from './cdp.mjs'
import { resolveHomePath } from './page.mjs'
import { aimAndClick as aimAndClickCore } from './aim.mjs'

const ROOT = path.resolve(import.meta.dirname, '../..')

const OPTS = { url: 'http://127.0.0.1:4321' }
for (const a of process.argv.slice(2)) {
  if (a.startsWith('--url=')) OPTS.url = a.slice('--url='.length)
}
const BASE = OPTS.url.replace(/\/$/, '')

/** 单程翻页的上限（600 帧 = 10s，仍远超实际所需）—— 只用来防"永远走不完"，不作为时长判据。
 *  ⚠️ 原值 2400 帧是"极宽"设的，实测代价很大：一旦点击没生效就会空推满上限，
 *    在软件渲染（3D 场景 ~3.5 FPS）下足以把一个核烧满。现在同时做了两件事：
 *    ① 上限降到 600；② 点击未生效时**直接跳过推帧**（见下方 `p1 === 'closed'` 的三元）。 */
const LIMIT = 600

let pass = 0
let fail = 0
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? '  →  ' + detail : ''}`)
  ok ? pass++ : fail++
}

console.log('')
console.log('  J4.49 · 魔法书本运行期判据（六相位翻页）')
console.log('  ──────────────────────────────────────────')
console.log(`  服务      ${BASE}`)
console.log('  断言      相位序列（**不**断言角度与时长）')
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

// ★ `gpu: true`：运行期判据**不比对像素**，没必要走 SwiftShader 软件渲染 ——
//   实测软件渲染下这个 3D 场景只有 ~3.5 FPS（perf 报告的实测值），推几百帧就会把一个核吃满。
//   只有 `test:visual` 必须留软件渲染（它的像素基线就是用软件渲染录的）。
const chrome = await launch({ port: 9364, width: 900, height: 600, gpu: true })
const page = await connect(chrome.port)
await page.setViewport(900, 600)

const ID = 'floor2/magic-book'
/**
 * ★ 对准时要比对的 id —— **不是**物件 id（`floor2/magic-book`）！
 *
 * `registry.aimTargetOf(mesh)` 返回的是**交互条目**的 id（这里是 `magic-book/toggle`），
 * 由 `installProp` 注册时统一加 `magic:` 前缀（`Bridge.js` 的 aim 源再拼成 `magic:<id>`）。
 * 踩过：拿物件 id 去匹配 ⇒ 42 个候选机位**全被判成"没命中"**，而逐机位详情显示
 * 其中 41 个命中的**正是书本自己**（`magic:magic-book/toggle`）—— 白折腾一轮。
 */
const AIM_ID = 'magic-book/toggle'
const phase = () => page.eval(`window.__cabinPropState(${JSON.stringify(ID)}).state.phase`)

/** 推帧直到到达目标相位，返回**去重后的相位序列**（一次 eval 完成，避免几千次往返）
 *  ⚠️ 必须显式给 `timeoutMs`：`page.eval` 默认 60s，而这里最多推 2400 帧 —— 实测会超时。 */
const runUntil = (target) =>
  page.eval(
    `(() => {
    const seq = [];
    for (let i = 0; i < ${LIMIT}; i++) {
      window.__cabinAdvance(1, 1 / 60);
      const p = window.__cabinPropState(${JSON.stringify(ID)}).state.phase;
      if (seq[seq.length - 1] !== p) seq.push(p);
      if (p === ${JSON.stringify(target)}) return { seq, frames: i + 1 };
    }
    return { seq, frames: -1 };
  })()`,
    { timeoutMs: 600000 },
  )

/** 序列里是否**按序**出现了给定的相位（允许夹杂其它相位） */
const inOrder = (seq, order) => {
  let k = 0
  for (const p of seq) if (p === order[k]) k += 1
  return k === order.length
}

/**
 * 对准 + 点击 —— `J4.49` 起改用共享辅助 `aim.mjs`。
 *
 * ⚠️ 为什么不再自己摆机位：点击射线是"对全部 `magicMeshes` 一次性求交、**取最近**"，
 *   而书本**贴在书桌上**，同一张桌上还有台历 / 沙漏 / 魔方 / 雪景球 / 纸牌……
 *   实测：从正前方 0.7m 处点下去，命中距离 **0.25** 的**台历**（`magic:calendar/flip-page`）
 *   —— 表现只是"点了没反应"。⇒ 改成"枚举候选机位 + 射线探针验证"。
 *
 * 返回一句**人能读的诊断**，保持原来的调用契约（调用点不必改）。
 */
async function aimAndClick(world, cx, cy) {
  const aim = await aimAndClickCore(page, world, AIM_ID, cx, cy)
  if (aim.failed) {
    console.log(`      [对准] ✗ ${aim.tried} 个候选机位全部被挡；各机位实际命中的目标：`)
    aim.samples.slice(0, 10).forEach((s, i) => console.log(`         #${i + 1} ${s}`))
    if (aim.tried > 10) console.log(`         …（共 ${aim.tried} 个机位）`)
    return `✗ ${aim.tried} 个机位全被挡`
  }
  console.log(`      [对准] 第 ${aim.tried} 个候选机位命中 ${aim.hits[0].aim}`)
  return `命中 ${aim.hits[0].aim}（第 ${aim.tried} 个机位）`
}

try {
  await page.navigate(`${BASE}${HOME}?deterministic=1&frames=1&bare=1&stats=1`)
  await page.waitFor('document.documentElement.dataset.cabin === "ready"', { timeout: 120000 })

  const hasHook = await page.eval(`typeof window.__cabinPropState === 'function' && typeof window.__cabinAdvance === 'function'`)
  check('测试钩子可读（?stats=1 + manual）', hasHook === true, hasHook ? '' : '未暴露')
  if (!hasHook) throw new Error('钩子缺失 —— 无法继续')

  const geo = await page.eval(`({ w: innerWidth, h: innerHeight })`)
  const CX = Math.round(geo.w / 2)
  const CY = Math.round(geo.h / 2)

  const st0 = await page.eval(`window.__cabinPropState(${JSON.stringify(ID)})`)
  check('书本已装配且状态可读', Boolean(st0 && st0.state), st0 ? `id=${st0.id}` : `读不到（可用 id 见注册中心）`)
  if (!st0 || !st0.state) throw new Error('读不到魔法书本状态')

  // ★ 前置检查（`J4.49` 实测补）：书本在不在"有 aim 入口的物件"清单里 ——
  //   不在就说明它的交互**根本没注册**，那样无论怎么对准都点不到。
  //   这条把"判据找不到机位"与"产品真的点不动"当场分开。
  const app = await page.eval(`(() => { const f = window.__cabinApp; return f ? f() : null })()`)
  const ids = (app && app.registry && app.registry.magicPropIds) || []
  check('书本在 aim 入口清单里（注册中心）', ids.includes(ID), ids.includes(ID) ? `共 ${ids.length} 件` : `不在其中 —— 清单：${ids.join(' / ')}`)
  check('初始相位是 `closed`（合着）', st0.state.phase === 'closed', `phase=${st0.state.phase}`)

  const book = st0.parts.bookG.world
  check('能读到书本世界坐标（parts.bookG.world）', Array.isArray(book) && book.length === 3, JSON.stringify(book))

  /* ─────────────────── ① 翻开：opening → flipping → fanning → open ─────────────────── */
  console.log('\n  ── 翻开 ──────────────────────────────────')
  const aimed1 = await aimAndClick(book, CX, CY)
  const p1 = await phase()
  check('点一次 ⇒ 相位离开 `closed`', p1 !== 'closed', `phase=${p1}；准星命中 ${aimed1}`)

  // ★ 点击没生效时**绝不**去推帧：`runUntil` 会一路推满 `${LIMIT}` 帧才放弃 ——
  //   实测（3D 场景 + 软件渲染约 3.5 FPS）那是把一整个核烧满的元凶。后面每条断言照样如实报失败。
  const open = p1 === 'closed' ? { seq: ['(点击未生效，跳过推帧)'], frames: -1 } : await runUntil('open')
  check('★ 走到 `open`（合着的书真的翻开了）', open.frames > 0, open.frames > 0 ? `用了 ${open.frames} 帧` : `超过 ${LIMIT} 帧仍没到 open`)
  check(
    '★ 中间相位**依次**推进（opening → flipping → fanning → open）',
    inOrder(open.seq, ['opening', 'flipping', 'fanning', 'open']),
    `实际序列 ${open.seq.join(' → ')}`,
  )

  /* ─────────────────── ② 合上：closing → closed ─────────────────── */
  console.log('\n  ── 合上 ──────────────────────────────────')
  await aimAndClick(book, CX, CY)
  const p2 = await phase()
  check('再点一次 ⇒ 相位离开 `open`', p2 !== 'open', `phase=${p2}`)

  const closed = p2 === 'open' ? { seq: ['(点击未生效，跳过推帧)'], frames: -1 } : await runUntil('closed')
  check('★ 回到 `closed`', closed.frames > 0, closed.frames > 0 ? `用了 ${closed.frames} 帧` : `超过 ${LIMIT} 帧仍没回到 closed`)
  check(
    '★ 中间相位**依次**推进（closing → closed）',
    inOrder(closed.seq, ['closing', 'closed']),
    `实际序列 ${closed.seq.join(' → ')}`,
  )

  /* ─────────────────── ③ 中间相位不响应（原实现的语义） ─────────────────── */
  console.log('\n  ── 中间相位不响应 ────────────────────────')
  // 先点开（closed → opening），**趁它还在过渡相位**再点一次 —— 应当**无效**：
  // 原实现只在 `closed` / `open` 两端响应，中途点击不会把它拽去 `closing`。
  //
  // ⚠️ 踩过：第一版是在书**已经合上**（上一步刚回到 closed）时点第三次 —— 那当然会重新翻开，
  //    于是"收尾等它回到 closed"永远等不到（`runUntil('closed')` 一路推到 `open` 才放弃）。
  //    判据自身的设计错误，不是产品问题。
  await aimAndClick(book, CX, CY)
  await page.eval(`window.__cabinAdvance(20, 1 / 60)`)
  const midBefore = await phase()
  await aimAndClick(book, CX, CY)
  await page.eval(`window.__cabinAdvance(20, 1 / 60)`)
  const midAfter = await phase()
  check(
    '★ 过渡相位上点击**无效**（只在两端响应，不会被拽去 `closing`）',
    ['opening', 'flipping', 'fanning'].includes(midAfter),
    `点击前 ${midBefore} → 点击后 ${midAfter}`,
  )

  // 收尾：让它翻到 `open`，再点一次合上 ⇒ 停在 `closed`，不给下一次运行留半开状态
  await runUntil('open')
  await aimAndClick(book, CX, CY)
  const settle = await runUntil('closed')
  check('收尾回到 `closed`（状态可重复运行）', settle.frames > 0, `seq=${settle.seq.join(' → ')}`)

  const errs = page.errors()
  check('全程无未捕获页面异常', errs.length === 0, errs.slice(0, 2).map((e) => e.text).join(' | '))
} finally {
  await page.close().catch(() => {})
  chrome.kill()
}

console.log(`\n  结果：${fail === 0 ? '通过' : fail + ' 项失败'}\n`)
process.exit(fail === 0 ? 0 : 1)
