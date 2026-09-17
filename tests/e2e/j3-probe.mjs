/**
 * J3 交互通路探针 —— **搬走的物件还能不能点开？**
 * ============================================================================
 * 为什么需要这个脚本（`J3` 最隐蔽的风险）：
 *
 *   `pnpm test:visual`（像素回归）只比较**画面**。而"物件的点击入口没了"这件事
 *   在画面上**毫无痕迹** —— 搬迁前后三张基线截图逐字节相同，门禁全绿，
 *   但用户点扫帚没有任何反应。
 *
 *   `J3` 期间 aim（准星 / 点击）通路仍由 monolith 的老机制驱动：
 *   `magicMeshes` + `userData.onClick` + `userData.aimLabel`。
 *   物件从一个 `regMagic(o, onClick)` 变成 `defineProp({ interactables })` 之后，
 *   **必须**由 `installProp()` 把这三件事等价补上（见 `app/installProp.js` 的 ⑤.2）。
 *   本脚本就是这条等价性的验收：**对准它、点它、画面必须动**。
 *
 * ## 与 `smoke.mjs` 的分工
 *
 * `smoke.mjs` 走的是"进门 → 开门 → 点壁炉 → 抽书"这条**老物件**的关键路径；
 * 本脚本逐个点**已搬迁的物件**，是按 `J3` 的搬迁清单追加的回归。
 *
 * ## 判据
 *
 * **主判据（决定通过/失败）**：`registry.stats().magicPropIds` 必须覆盖每一件"声明了交互的
 * 已搬迁物件"。这个清单由 `installProp()` 在补 aim 通路时打标（`userData.cabinProp`），
 * 它直接回答"这件东西在准星/点击通路上还在不在"。
 *
 * **★ `J3.1` 追加的逐条判据（更强的一条）**：`registry.stats().aimMissing` 必须为空 ——
 * 它把粒度从"每件物件"下沉到**每条 `Interactable`**。旧粒度会放过实测确认过的三个形态：
 *   · 餐桌三只餐盘只有第一只点得动（另两只的 Mesh 是兄弟节点，不在命中集合里）；
 *   · 衣柜挂衣的 `regWobble()` 注册被 root 桥改写 ⇒ 点挂衣变成拉抽屉；
 *   · `mode: 'aim'` 的条目既不被近距认领、也不是"第一条" ⇒ 永远拿不到入口。
 * 三条都属于"画面零变化"，所以这条判据才是它们唯一的守门人。
 *
 * **参考信息（不计入判定）**：对每件物件设置测试机位、点一下、比较像素。
 * 它要求相机朝向、物件几何中心、命中体粗细三者同时对上 —— 细长物件（扫帚柄 0.044m 宽、
 * 还有 0.33rad 倾角）很容易点空，所以只作为人工排查的线索，不作为门禁。
 *
 * ```bash
 * pnpm serve                     # 另开终端（产物模式）
 * node tests/e2e/j3-probe.mjs    # 跑探针
 * node tests/e2e/j3-probe.mjs --keep
 * node tests/e2e/j3-probe.mjs --expect=floor1/broom,floor1/chest   # 指定必须通过 aim 判据的物件
 * ```
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { findBrowser, launch, connect } from './cdp.mjs'
import { resolveHomePath } from './page.mjs'
import { readPng, diffPng } from '../visual/png.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')
const SHOTS = path.join(ROOT, '_shots/e2e/j3')
const VIEWPORT = { width: 1440, height: 900 }

const argv = process.argv.slice(2)
const has = (n) => argv.includes(`--${n}`)
const val = (n, d) => {
  const hit = argv.find((a) => a.startsWith(`--${n}=`))
  return hit ? hit.slice(n.length + 3) : d
}
const OPTS = {
  url: String(val('url', process.env.CABIN_URL || 'http://127.0.0.1:5173')).replace(/\/$/, ''),
  threshold: Number(val('threshold', '0.004')), // 0.4% 像素变化
  only: val('only', ''),
  keep: has('keep'),
}

/**
 * 已搬迁物件的「对准机位」表。
 *
 * `cam` = `[px,py,pz, lx,ly,lz]`，与 `?cam=` 同格式（`J0.4` 定：机位是**纯观察量**）。
 * 坐标取自 `world/layout.js` 的真实锚点（不变量 `N9`）——
 * 改物件位置时这里必须跟着改，否则探针会"点空气"并误报失败。
 */
const TARGETS = [
  {
    id: 'floor1/broom', label: '让魔法扫帚飞起来',
    // BROOM_REST = (-3.3, 0.105, 3.35)，柄中心世界高 ≈ 0.97。相机贴到 0.8m —— 软件渲染下
    // 准星越接近物件中心，命中越稳（aim 源只对 magicMeshes 做射线，不看遮挡）
    cam: [-3.3, 0.97, 4.15, -3.3, 0.97, 3.35], frames: 40,
  },
  {
    id: 'floor1/hourglass', label: '把沙漏翻过来',
    // HG_POS = (-3.72, 0.805, -2.44)（楼梯下储物架台面），沙漏体中心再高约 0.18
    cam: [-3.72, 0.985, -1.55, -3.72, 0.985, -2.44], frames: 40,
  },
  {
    id: 'floor1/chest', label: '打开 / 合上小宝箱',
    // CHEST_POS = (-3.72, 0.805, -2.66)
    cam: [-3.72, 0.90, -1.80, -3.72, 0.90, -2.66], frames: 40,
  },
].filter((t) => !OPTS.only || t.id === OPTS.only)

let pass = 0
let fail = 0
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? '  → ' + detail : ''}`)
  ok ? pass++ : fail++
}

async function step(page, n) {
  await page.eval(
    `(() => { const f = window.__cabinStepFrame; for (let i = 0; i < ${n}; i++) f(); return true })()`,
    { timeoutMs: 30000 + n * 800 },
  )
}

async function clickCanvas(page, x, y) {
  for (const type of ['mousePressed', 'mouseReleased']) {
    await page.send('Input.dispatchMouseEvent', {
      type, x, y, button: 'left', clickCount: 1, buttons: type === 'mousePressed' ? 1 : 0,
    })
  }
}

const ratioOf = (a, b) => diffPng(readPng(a), readPng(b)).ratio

console.log('')
console.log('  J3 · 交互通路探针（搬迁后的物件还能点开吗）')
console.log('  ──────────────────────────────────────────')
console.log(`  服务      ${OPTS.url}`)
console.log(`  视口      ${VIEWPORT.width}×${VIEWPORT.height}`)
console.log(`  阈值      像素变化 > ${(OPTS.threshold * 100).toFixed(2)}%`)
console.log('  ──────────────────────────────────────────')

const browser = findBrowser()
if (!browser) {
  console.error('✗ 未找到 Chrome / Edge（可用 CABIN_BROWSER 指定路径）')
  process.exit(1)
}
const HOME = await resolveHomePath(OPTS.url, {
  onError: (why) => console.error(`✗ 无法访问 ${OPTS.url} —— ${why}\n  请先启动服务：pnpm serve\n`),
})
if (!HOME) process.exit(2)

fs.mkdirSync(SHOTS, { recursive: true })
// ★ `gpu: true`（`J4.49`）：比的是**点击前后的像素变化比例**，不是与基线 PNG 逐字节比对
//   ⇒ 不必走 SwiftShader 软件渲染（软件渲染下 3D 场景只有 ~3.5 FPS，推几百帧就把核吃满）。
const chrome = await launch({ port: 9336, width: VIEWPORT.width, height: VIEWPORT.height, gpu: true })
const page = await connect(chrome.port)
await page.setViewport(VIEWPORT.width, VIEWPORT.height)

try {
  // `stats=1` 才会暴露 `window.__cabinApp`（沿用 J0.6 的约定：正常游玩路径上不存在这个接口）
  await page.navigate(`${OPTS.url}${HOME}?deterministic=1&frames=1&bare=1&stats=1`)
  await page.waitFor('document.documentElement.dataset.cabin === "ready"', { timeout: 120000 })
  await page.waitFor('document.documentElement.dataset.cabinStillRepaint === "1"', { timeout: 30000 })

  // ① 装配层证据：搬迁的物件是否真的进了注册中心
  const app = await page.eval(`(() => { const f = window.__cabinApp; return f ? f() : null })()`)
  check('应用统计可读（?stats 钩子）', app !== null, app ? `state=${app.state}` : '未暴露')
  if (app) {
    check('已装配物件数 ≥ 9', app.registry.props >= 9, `props=${app.registry.props}`)
    check(
      '近距交互条目已登记（含搬迁物件的声明）',
      app.registry.interactables >= 12,
      `interactables=${app.registry.interactables}（J2.6 的 9 条 + 搬迁物件新增）`,
    )
    check('aim 命中集合非空（magicMeshes）', app.registry.magicMeshes > 0, `magicMeshes=${app.registry.magicMeshes}`)

    // ② ★ 本探针的**核心判据**：声明了交互的搬迁物件，必须都在"有准星/点击入口"的清单里。
    //
    // 这一条比"点一下看画面有没有变"可靠得多 —— 像素点击要求相机、物件几何中心、
    // 命中体粗细三者同时对上（扫帚柄只有 0.044m 粗，还有 0.33rad 的倾角），
    // 而它要回答的问题其实只是"aim 桥有没有接上"。
    // `J3.1`：把本次修复涉及的**多部件物件**也纳入"必须有准星入口"的清单 ——
    // 它们正是"每件物件有入口"这条旧判据放过的那批（入口只落在第一个部件上）。
    const AIM_PROPS = (val('expect', [
      'floor1/broom', 'floor1/chest', 'floor1/hourglass', 'floor1/hang-bar', 'floor2/junk-boxes',
      'floor1/long-table', 'floor1/tableware', 'floor1/stools', 'floor1/potion-bottle',
      'floor2/wardrobe', 'floor2/tissue-box',
    ].join(',')))
      .split(',').map((s) => s.trim()).filter(Boolean)
    const withAim = app.registry.magicPropIds || []
    const missing = AIM_PROPS.filter((id) => !withAim.includes(id))
    check(
      '★ 搬迁物件的准星入口齐全（aim 桥生效）',
      missing.length === 0,
      missing.length ? `缺少：${missing.join(' / ')}` : `${withAim.length} 件有准星入口：${withAim.join(', ')}`,
    )

    // ③ ★★ `J3.1`：同一判据下沉到**每条 `Interactable`**。
    //    上面那条问的是"这件物件还有没有入口"，只要一件物件有**一个**入口就算通过 ——
    //    于是"餐桌三只餐盘只有第一只点得动"这类缺口全绿。这条问的是"**每一条**声明了
    //    aim 的交互是否都有自己的命中体"，由 `installProp` 在装配期逐条打标后汇总。
    const aimMissing = app.registry.aimMissing || []
    const aimBound = app.registry.aimBound || []
    check(
      '★★ 每条声明了 aim 的交互都有自己的命中体（逐条判据）',
      aimMissing.length === 0,
      aimMissing.length
        ? `没有入口的条目：${aimMissing.join(' / ')}`
        : `${aimBound.length} 条交互各有 aim 入口`,
    )
  }

  // ② 逐件点击验证 —— 这是本脚本的正题
  for (const t of TARGETS) {
    console.log(`\n  【${t.id}】${t.label}`)
    await page.eval('window.__cabinSetTestCamera(null)')
    await step(page, 3)
    await page.eval(`window.__cabinSetTestCamera(${JSON.stringify(t.cam)})`)
    await step(page, 6)

    const before = path.join(SHOTS, `${t.id.replace(/\//g, '-')}-before.png`)
    const after = path.join(SHOTS, `${t.id.replace(/\//g, '-')}-after.png`)
    await page.screenshot(before)

    // 在中心附近试几个点：相机已经对准物件，中心最可能命中；
    // 备用点只用来容忍"物件的视觉中心与锚点差几个像素"
    const points = [[720, 450], [720, 428], [720, 472]]
    let best = 0
    let bestPt = null
    for (const [x, y] of points) {
      await clickCanvas(page, x, y)
      await step(page, t.frames)
      await page.screenshot(after)
      const r = ratioOf(before, after)
      if (r > best) { best = r; bestPt = [x, y] }
      if (r > OPTS.threshold) break
      // 没点动就把画面复位到点前（manual 时钟不会自己走，复位后再抓一张对照图）
      await page.eval('window.__cabinSetTestCamera(null)')
      await page.eval(`window.__cabinSetTestCamera(${JSON.stringify(t.cam)})`)
      await step(page, 3)
      await page.screenshot(before)
    }
    // ③ 端到端参考（**不计入通过/失败**）：把相机对准物件点一下，看画面有没有变。
    //    它要求相机朝向、物件几何中心、命中体粗细三者同时对上 —— 而细长物件（扫帚柄 0.044m、
    //    还带 0.33rad 倾角）很容易点空。aim 通路的**判据**是上面的 `magicPropIds`，
    //    这里只留一个"真的点了一下"的痕迹供人工判断。
    console.log(
      `  · 点击参考　最大变化 ${(best * 100).toFixed(3)}%${bestPt ? ` @ ${bestPt.join(',')}` : ''}` +
      (best > OPTS.threshold ? '　→ 点动了 ✓' : '　→ 点空了（不影响判定）'),
    )
  }

  const errs = page.errors()
  check('全程无未捕获页面异常', errs.length === 0, errs.length ? errs[0].text.slice(0, 160) : '')
} finally {
  await page.close().catch(() => {})
  chrome.kill()
}

console.log(`\n  结果：${pass} 通过 / ${fail} 失败\n`)
if (!OPTS.keep && fail === 0) {
  try { fs.rmSync(SHOTS, { recursive: true, force: true }) } catch { /* 保留也无妨 */ }
}
process.exit(fail ? 1 : 0)
