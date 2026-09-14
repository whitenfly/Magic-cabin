/**
 * J0.5 · 交互冒烟
 * ============================================================================
 * 与 `J0.4`（像素回归）互补：**像素回归只能证明"画面没变"，证明不了"还能玩"。**
 * 搬迁期最典型的 bug 是——画面一模一样，但那个东西点不开了。
 *
 * 覆盖的关键路径（`BuildPlaning/01-完善路线图.md` §3 的 `J0.5`）：
 *
 *     进小屋 → 开门 → 点壁炉 → 切 3 视角 → 抽出书架上的一本书 → 切天气 → 退出
 *
 * ## 为什么"抽出一本书"在这一阶段指的是书籍类物件的点击
 *
 * 书架本身是装饰 + 实心阻挡，**不是**交互物件；"书架即博客"要 `J6` 才有。
 * 所以本阶段把这一步映射为现状存在的书籍类交互（书堆 `bookPileG`），
 * 到 `J6` 时替换为真正的"抽书"路径（`mapping.yaml` 的 `M01`）。
 *
 * ## 确定性怎么来（这是脚本能稳定跑的前提）
 *
 * `?deterministic=1&frames=1` 进入 **manual 时钟**：页面**不会自己推进**，
 * 每一帧都由脚本调用 `window.__cabinStepFrame()` 推进。于是：
 *
 *     keydown(W) → 推进 N 帧 → 玩家走了确定的一段距离
 *
 * 不再有"等 1.5 秒看看"这种写法。配合 `F0.2` 的种子随机，
 * 整个冒烟过程在字节级可复现 —— 失败时可以稳定重放。
 *
 * ## 断言写在"可观测的副作用"上
 *
 * 场景状态全部在 `legacy/monolith.js` 的 IIFE 里，外部拿不到。所以断言只用三类证据：
 *
 * | 证据 | 用在哪 |
 * |---|---|
 * | `#hint` 的文本与 `show` 类（提示条 = 当前可交互对象） | 可达性：走到哪、能不能交互 |
 * | DOM 状态（`.on` / `.open` 类、`#clock` 文本） | 视角、菜单、天气 |
 * | **像素差分**（点击/按键前 vs 后） | 3D 物件是否真的响应了 |
 *
 * 第三类是通用判据：**"操作后画面确实变了"就是交互生效**。
 *
 * ## 用法
 *
 * ```bash
 * pnpm serve            # 另开一个终端
 * pnpm test:smoke       # 跑冒烟
 * node tests/e2e/smoke.mjs --keep   # 保留截图产物便于排查
 * ```
 *
 * ⚠️ 需要真实浏览器（同 J0.4）：受限沙箱禁止命名管道时 Chrome 会以
 *    `FATAL: platform_channel.cc … 拒绝访问 (0x5)` 退出。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { findBrowser, launch, connect, sleep } from './cdp.mjs'
import { resolveHomePath } from './page.mjs' // J1.5：首页解析（dist 产物 与 零构建 两种形态）
import { readPng, diffPng } from '../visual/png.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')
const SHOTS = path.join(ROOT, '_shots/e2e')
const BASELINE_VIEWPORT = { width: 1440, height: 900 }

// ── 参数 ────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2)
const has = (n) => argv.includes(`--${n}`)
const val = (n, d) => {
  const hit = argv.find((a) => a.startsWith(`--${n}=`))
  return hit ? hit.slice(n.length + 3) : d
}
const OPTS = {
  url: String(val('url', process.env.CABIN_URL || 'http://127.0.0.1:5173')).replace(/\/$/, ''),
  keep: has('keep'),
  verbose: has('verbose'),
  viewport: BASELINE_VIEWPORT,
}

// ── 断言 ────────────────────────────────────────────────────────────────────
let pass = 0
let fail = 0
const failures = []
function check(name, ok, detail = '') {
  const line = `  ${ok ? '✓' : '✗'} ${name}${detail ? '  → ' + detail : ''}`
  console.log(line)
  if (ok) pass++
  else {
    fail++
    failures.push(`${name}${detail ? ` (${detail})` : ''}`)
  }
}
function step_(msg) {
  console.log(`\n【${msg}】`)
}

// ── 页面操作工具 ────────────────────────────────────────────────────────────

/**
 * 推进 N 帧（manual 时钟下唯一的状态推进方式）。
 *
 * ⚠️ 超时按帧数放大：headless + SwiftShader 下每帧渲染约 0.2s，
 *    推 90 帧就要 ~20s，默认的 60s 在更大批量时会不够。
 */
async function step(page, n) {
  await page.eval(
    `(() => { const f = window.__cabinStepFrame; for (let i = 0; i < ${n}; i++) f(); return true })()`,
    { timeoutMs: 30000 + n * 800 },
  )
}

/** 读提示条：{ text, show } —— 提示条就是"当前可交互对象"的显示 */
function readHint(page) {
  return page.eval(
    `(() => { const h = document.getElementById('hint'); return { text: (h.textContent || '').trim(), show: h.classList.contains('show') } })()`,
  )
}

const VK = {
  KeyW: 87, KeyA: 65, KeyS: 83, KeyD: 68, KeyE: 69, KeyV: 86,
  Space: 32, Escape: 27, ShiftLeft: 16, Digit1: 49, Digit2: 50, KeyF: 70,
}
const keyName = (code) => (code.startsWith('Key') ? code.slice(3).toLowerCase() : code)

/** 派发真实键盘事件（走页面的 addEventListener('keydown') 路径） */
async function keyDown(page, code) {
  const vk = VK[code] || 0
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyDown', code, key: keyName(code), windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk,
  })
}
async function keyUp(page, code) {
  const vk = VK[code] || 0
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyUp', code, key: keyName(code), windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk,
  })
}
/** 按一下（down + 推进 + up） */
async function press(page, code, frames = 2) {
  await keyDown(page, code)
  await step(page, frames)
  await keyUp(page, code)
}

/** 元素上点击（走真实 click 事件；UI 按钮监听的是 'click'） */
async function clickEl(page, selector) {
  const ok = await page.eval(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return false; e.click(); return true })()`)
  if (!ok) throw new Error(`元素不存在：${selector}`)
}
const hasClass = (page, selector, cls) =>
  page.eval(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); return !!e && e.classList.contains(${JSON.stringify(cls)}) })()`)
const textOf = (page, selector) =>
  page.eval(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); return e ? (e.textContent || '').trim() : null })()`)

/** 在 canvas 上派发真实鼠标点击（走 pointerup → 射线检测 路径） */
async function clickCanvas(page, x, y) {
  for (const type of ['mousePressed', 'mouseReleased']) {
    await page.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1, buttons: type === 'mousePressed' ? 1 : 0 })
  }
}

async function shot(page, name) {
  const file = path.join(SHOTS, `${name}.png`)
  await page.screenshot(file)
  return file
}

/** 像素差分：返回变化像素比例 */
function diffRatio(aFile, bFile) {
  const d = diffPng(readPng(aFile), readPng(bFile))
  return { ratio: d.ratio, bbox: d.bbox, diff: d.diff }
}

// ── 主流程 ──────────────────────────────────────────────────────────────────
console.log('')
console.log('  J0.5 · 交互冒烟')
console.log('  ──────────────────────────────────────────')
console.log(`  服务      ${OPTS.url}`)
console.log(`  视口      ${OPTS.viewport.width}×${OPTS.viewport.height}`)
console.log('  时钟      manual（逐帧由脚本推进 —— 全程可复现）')
console.log('  ──────────────────────────────────────────')

const browser = findBrowser()
if (!browser) {
  console.error('✗ 未找到 Chrome / Edge（可用 CABIN_BROWSER 指定路径）')
  process.exit(1)
}

// 健康检查：截到错误页会伪装成"通过"
// `J1.5`：首页由 `tests/e2e/page.mjs` 解析 —— dist 产物是 `/`，零构建是 `/index.html`
const HOME = await resolveHomePath(OPTS.url, {
  onError: (why) => {
    console.error(`✗ 无法访问 ${OPTS.url} 或返回内容不是本项目页面 —— ${why}`)
    console.error('  请先启动服务：pnpm serve（产物）或 pnpm serve:legacy（零构建）\n')
  },
})
if (!HOME) process.exit(2)

fs.mkdirSync(SHOTS, { recursive: true })
const chrome = await launch({ port: 9334, width: OPTS.viewport.width, height: OPTS.viewport.height })
const page = await connect(chrome.port)
await page.setViewport(OPTS.viewport.width, OPTS.viewport.height)

const t0 = Date.now()
try {
  // ══ S0 · 启动 ══════════════════════════════════════════════════════════
  step_('S0 启动与确定性前提')
  // frames=1：只推进一帧让场景建立，此后完全由脚本控制
  // `bare=1`（J1.5）：Astro 版首页构建期就渲染了门厅，冒烟测试要的是纯 3D 起点
  await page.navigate(`${OPTS.url}${HOME}?deterministic=1&frames=1&bare=1`)
  await page.waitFor('document.documentElement.dataset.cabin === "ready"', { timeout: 120000 })
  await page.waitFor('document.documentElement.dataset.cabinStillRepaint === "1"', { timeout: 30000 })

  const meta = await page.eval(`(() => { const d = document.documentElement.dataset; return {
    canvas: !!document.querySelector('canvas'), det: d.cabinDeterministic, manual: d.cabinManualClock,
    frames: d.cabinFrames, seed: d.cabinSeed, stepFn: typeof window.__cabinStepFrame, camFn: typeof window.__cabinSetTestCamera,
    ui: ['menuDot','menuPanel','hint','clock','wxChips','viewFixedBtn','viewTpBtn','viewFpBtn','houseToggle'].filter(id => !document.getElementById(id))
  } })()`)
  check('boot 就绪（data-cabin=ready）', true)
  check('canvas 已创建', meta.canvas === true)
  check('确定性开关生效', meta.det === '1')
  check('manual 时钟已启用（页面不自行推进）', meta.manual === '1', `frames=${meta.frames}`)
  check('逐帧钩子可用', meta.stepFn === 'function')
  check('测试机位钩子可用', meta.camFn === 'function')
  check('UI 节点齐全', meta.ui.length === 0, meta.ui.length ? `缺少 ${meta.ui.join(', ')}` : '9 个关键节点')
  check('记录了场景种子', Boolean(meta.seed), String(meta.seed))

  const errs0 = page.errors()
  check('启动阶段无页面异常', errs0.length === 0, errs0.length ? errs0[0].text.slice(0, 140) : '')

  // ══ S1 · 门外：交互可达 ═══════════════════════════════════════════════
  step_('S1 门外 —— 提示条指向大门')
  await step(page, 5)
  const h1 = await readHint(page)
  check('提示条可见', h1.show === true)
  check('提示内容是"大门"', /大门/.test(h1.text), h1.text)

  // ══ S2 · 开门 ══════════════════════════════════════════════════════════
  step_('S2 按 E 开门')
  await press(page, 'KeyE', 2)
  await step(page, 30) // 门的弹簧动画
  const h2 = await readHint(page)
  check('开门后提示条仍在（门仍是最近交互对象）', /大门/.test(h2.text), h2.text)

  // ══ S3 · 进小屋（移动 + 碰撞 + 门开合的综合验证）══════════════════════
  step_('S3 按 W+D 前进 —— 穿过大门进入屋内')
  // ⚠️ 走位不是随便定的：固定视角下 `camYaw = fixYaw + π`，单按 W 的移动方向是
  //    `(sin, cos)(camYaw) ≈ (-0.63, -0.77)` —— 斜着走会在 z=4 处撞上**门左侧的墙**
  //    （`solidBoxes` 的 `x∈[-4.85,-0.78]`），人卡在门外、提示条停在"前左窗"。
  //    叠加 D 后的合方向 ≈ `(0.10, -1.00)`，正对门洞（`x∈[-0.78, 0.78]`）。
  await keyDown(page, 'KeyW')
  await keyDown(page, 'KeyD')
  // **分批**推进 + 逐帧检查提示条：每批最多 40 帧（约 8s），远低于 CDP 超时，
  // 又能把"达成条件的帧数"精确到帧 —— 同一份代码每次运行走出的帧数完全一致。
  const WALK_BATCH = 40
  const WALK_MAX = 400
  const walkSeen = []
  let walked = 0
  let insideHouse = false
  while (!insideHouse && walked < WALK_MAX) {
    const r = await page.eval(
      `(() => {
        const f = window.__cabinStepFrame, h = document.getElementById('hint'), seen = []
        for (let i = 0; i < ${WALK_BATCH}; i++) {
          f()
          const t = (h.textContent || '').trim()
          if (t && seen[seen.length - 1] !== t) seen.push(t)
          if (/吊灯/.test(t)) return { n: i + 1, seen, hit: true }
        }
        return { n: ${WALK_BATCH}, seen, hit: false }
      })()`,
      { timeoutMs: 60000 },
    )
    walked += r.n
    for (const t of r.seen) if (walkSeen[walkSeen.length - 1] !== t) walkSeen.push(t)
    insideHouse = r.hit === true
  }
  await keyUp(page, 'KeyW')
  await keyUp(page, 'KeyD')
  await step(page, 5)
  check('提示条随移动而变化（说明真的在走）', walkSeen.length > 0, walkSeen.join(' → ') || '(无变化)')
  check(
    '穿过大门进入屋内（移动 → 碰撞 → 门开合 → 交互可达）',
    insideHouse,
    `${walked} 帧 · ${walkSeen[walkSeen.length - 1] || ''}`,
  )

  // ══ S4 · 点壁炉（用像素差分证明"确实有响应"）═════════════════════════
  step_('S4 点燃 / 熄灭壁炉 —— 火焰与光照响应')
  // 壁炉在 x=-3.2 / z=1.5（`FX/FZ`）。把测试机位对准炉膛再点画面中心：
  // 视线只与 `fireMeshes` 求交（three 的 raycast 不考虑遮挡），因此一定能命中火焰。
  await page.eval('window.__cabinSetTestCamera([-1.2, 0.9, 1.5, -3.35, 0.55, 1.5])')
  await step(page, 5)
  const stoveBefore = await shot(page, 'stove-before')
  await clickCanvas(page, OPTS.viewport.width / 2, OPTS.viewport.height / 2)
  await step(page, 50) // 火光渐亮 / 渐灭的过渡（固定系数插值，按帧计数）
  const stoveAfter = await shot(page, 'stove-after')
  const dStove = diffRatio(stoveBefore, stoveAfter)
  check('壁炉有视觉响应（火焰粒子 / 光照变化）', dStove.ratio > 0.002, `${(dStove.ratio * 100).toFixed(3)}% 像素变化`)
  await page.eval('window.__cabinSetTestCamera(null)')
  await step(page, 5)

  // ══ S5 · 切 3 视角 ═════════════════════════════════════════════════════
  step_('S5 切换三种视角')
  const viewState = () =>
    page.eval(`(() => ({ fixed: document.getElementById('viewFixedBtn').classList.contains('on'),
                        tp: document.getElementById('viewTpBtn').classList.contains('on'),
                        fp: document.getElementById('viewFpBtn').classList.contains('on') }))()`)

  check('初始为固定视角', (await viewState()).fixed === true)
  await clickEl(page, '#viewTpBtn')
  await step(page, 5)
  let vs = await viewState()
  check('点击「第三人称」生效', vs.tp === true && vs.fixed === false, JSON.stringify(vs))
  await clickEl(page, '#viewFpBtn')
  await step(page, 5)
  vs = await viewState()
  check('点击「第一人称」生效', vs.fp === true && vs.tp === false, JSON.stringify(vs))
  await keyDown(page, 'KeyV'); await step(page, 5); await keyUp(page, 'KeyV')
  vs = await viewState()
  check('按 V 在第一/第三人称之间切换', vs.tp === true && vs.fp === false, JSON.stringify(vs))
  await clickEl(page, '#viewFixedBtn')
  await step(page, 5)
  vs = await viewState()
  check('点回「固定视角」生效', vs.fixed === true, JSON.stringify(vs))

  // ══ S6 · 书籍类物件点击（"抽出一本书"在本阶段的映射）═══════════════════
  step_('S6 点击书堆 —— 书籍类交互响应')
  // 用测试机位把相机对准书堆（bookPileG 在 x=-3.62, z=-1.4，堆高约 0.7m）
  await page.eval(`window.__cabinSetTestCamera([-1.5, 1.0, -1.4, -3.62, 0.35, -1.4])`)
  await step(page, 5)
  const booksBefore = await shot(page, 'books-before')
  await clickCanvas(page, OPTS.viewport.width / 2, OPTS.viewport.height / 2)
  await step(page, 40)
  const booksAfter = await shot(page, 'books-after')
  const dBooks = diffRatio(booksBefore, booksAfter)
  check('点击书堆有视觉响应', dBooks.ratio > 0.002, `${(dBooks.ratio * 100).toFixed(3)}% 像素变化`)
  await page.eval('window.__cabinSetTestCamera(null)') // 复位相机
  await step(page, 5)

  // ══ S7 · 切天气 ════════════════════════════════════════════════════════
  step_('S7 切换天气')
  await clickEl(page, '#menuDot')
  await step(page, 5)
  check('菜单打开', (await hasClass(page, '#menuPanel', 'open')) === true)
  const chips = await page.eval(`[...document.querySelectorAll('.wxChip')].map(e => e.textContent)`)
  check('天气选项齐全（7 种）', chips.length === 7, chips.join('/'))

  const wxBefore = await textOf(page, '#clock')
  await page.eval(`[...document.querySelectorAll('.wxChip')].find(e => e.textContent === '雪').click()`)
  await step(page, 30) // #clock 每 0.25s（15 帧）刷新一次
  const wxAfter = await textOf(page, '#clock')
  check('#clock 文本已更新为雪天', /雪/.test(wxAfter || ''), `${wxBefore} → ${wxAfter}`)
  const chipOn = await page.eval(`[...document.querySelectorAll('.wxChip')].find(e => e.textContent === '雪').classList.contains('on')`)
  check('「雪」选项处于选中态', chipOn === true)

  // 天气切换应当改变画面（天空 / 灰调 / 雪花）
  const snowBefore = await shot(page, 'weather-sunny')
  await step(page, 90)
  const snowAfter = await shot(page, 'weather-snow')
  const dSnow = diffRatio(snowBefore, snowAfter)
  check('天气切换有视觉响应', dSnow.ratio > 0.005, `${(dSnow.ratio * 100).toFixed(3)}% 像素变化`)

  // ══ S8 · 退出 ══════════════════════════════════════════════════════════
  step_('S8 退出菜单')
  await clickEl(page, '#menuDot')
  await step(page, 5)
  check('菜单已关闭', (await hasClass(page, '#menuPanel', 'open')) === false)
  await press(page, 'Escape', 2)
  const errsEnd = page.errors()
  check('全程无未捕获页面异常', errsEnd.length === 0, errsEnd.length ? errsEnd[0].text.slice(0, 140) : '')
} catch (e) {
  fail++
  failures.push(`脚本异常：${e.message}`)
  console.error(`\n✗ 冒烟中断：${e.message}`)
  const errs = page.errors()
  if (errs.length) console.error(`  页面报错：${errs[0].text.slice(0, 300)}`)
} finally {
  await page.close()
  chrome.kill()
}

const secs = ((Date.now() - t0) / 1000).toFixed(1)
console.log('')
console.log(`  结果：${pass} 通过 / ${fail} 失败   （${secs}s）`)
if (failures.length) {
  console.log('')
  for (const f of failures) console.log(`    ✗ ${f}`)
}
console.log(`  截图产物  ${path.relative(ROOT, SHOTS).replace(/\\/g, '/')}/  （排查用：node tests/visual/view.mjs <png>）`)
console.log('')
process.exit(fail ? 1 : 0)
