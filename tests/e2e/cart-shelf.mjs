/**
 * `J4.20` 判据 —— 「点滑轮置物台，四段动画真的还在跑」
 *
 * ## 为什么必须有这个脚本
 *
 * `J4.20` 把 `12.11b` 滑轮置物台的**四段连续的每帧分支**（`tickOnce()` 原 L6425 / L6437 /
 * L6491 / L6509）合并进了物件的**一个** `update()` —— 那是本任务最大的一处结构改动。
 *
 * 但这一刻**静止帧**里的四个状态全都是"休眠"的：
 *
 * | 状态 | 静止值 | 只有谁能唤醒它 |
 * |---|---|---|
 * | `cartOut` / `cartP` | `false` / `0`（车在初始位） | 点车体 |
 * | `quillRun` | `0`（笔插在墨水瓶里） | 点墨水瓶或羽毛笔 |
 * | `paperRun` | `0`（纸堆叠在车上） | 点纸堆 |
 *
 * ⇒ **像素回归看不见它**（三机位是没人去点的定格帧）、**探针也看不见它**
 * （探针只问"有没有 aim 入口"，不问"点了之后动不动"）。
 * 这与 `J4.8` 的镜面涟漪是**同一类静默回归**（见 `mirror-ripple.mjs` 的文件头）。
 *
 * ## 判据
 *
 * 对准置物台 → 发一次真实的 `pointerdown`+`pointerup` → 推帧 → 看**画面是否真的变了**；
 * 并用一组"不点击"的对照，把"推进帧本身造成的变化"扣掉。
 * 两台不同高度的机位（车身中部 / 车上层）各测一次，**至少一台**必须显著变化 ——
 * 命中车体是「滑动」、命中墨水瓶/羽毛笔是「书写」、命中纸堆是「纸堆起飞」，
 * 三条通路**任何一条活着**都会让画面动起来。
 *
 * 用法：`pnpm test:cart`（需要先 `pnpm build` + `pnpm serve`）
 */
import fs from 'node:fs'
import path from 'node:path'
import { findBrowser, launch, connect } from './cdp.mjs'
import { resolveHomePath } from './page.mjs'
import { readPng, diffPng } from '../visual/png.mjs'

const ROOT = path.resolve(import.meta.dirname, '../..')
const BASE = String(process.env.CABIN_URL || 'http://127.0.0.1:4321').replace(/\/$/, '')
const SHOTS = path.join(ROOT, '_shots/j420')

// 置物台的世界坐标从 `layout.js` 读（不变量 N9：坐标只有一个来源）
const { createLayout } = await import('../../src/cabin/world/layout.js')
const L = createLayout()
const CX = L.CART_POS.x
const CZ = L.CART_POS.z

/**
 * 两台机位：都站在置物台的 **+z 一侧**（朝屋内那一面，与 `cartG.rotation.y = π` 朝向一致）。
 * `look` 的高度分别对上车身中部与车上层（墨水瓶 / 羽毛笔）。
 */
const POSES = [
  { name: 'body', cam: [CX, 0.95, CZ + 1.15, CX, 0.30, CZ] },
  { name: 'top', cam: [CX, 1.00, CZ + 0.95, CX, 0.52, CZ] },
]

/** 推多少帧 —— `cartP` 的平滑系数是 0.07/帧 ⇒ 40 帧后约 0.94，滑动看得出来 */
const STEPS = 40

const browser = findBrowser()
if (!browser) { console.error('找不到 Chrome/Edge'); process.exit(1) }
const HOME = await resolveHomePath(BASE, { onError: (w) => console.error('无法访问：' + w) })
if (!HOME) process.exit(2)

fs.mkdirSync(SHOTS, { recursive: true })
const chrome = await launch({ port: 9352, width: 900, height: 600 })
const page = await connect(chrome.port)
let fail = 0
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? '  →  ' + detail : ''}`)
  if (!ok) fail++
}
const shot = async (name) => {
  const p = path.join(SHOTS, name)
  await page.screenshot(p)
  return p
}
const changed = (a, b) => {
  const d = diffPng(readPng(a), readPng(b))
  return d.diff ?? d.changed ?? d.diffPixels ?? 0
}
const step = async (n) => { for (let i = 0; i < n; i++) await page.eval('window.__cabinStepFrame()') }

try {
  await page.setViewport(900, 600)
  await page.navigate(`${BASE}${HOME}?deterministic=1&frames=1`)
  await page.waitFor('document.documentElement.dataset.cabin === "ready"', { timeoutMs: 120000 })
  // ★ 预热：页面刚 `ready` 时环境光 / 天气插值 / 烛火等**还在过渡**，先推到稳态再测量。
  //   实测教训：不做这一步时，第一台机位的"对照组"（不点击、只推帧）自己就有 3868 像素变化
  //   —— 那会把判据搅浑（分不清差异来自点击还是来自过渡）。
  await step(60)

  const results = []
  for (const pose of POSES) {
    const applied = await page.eval(`JSON.stringify(window.__cabinSetTestCamera(${JSON.stringify(pose.cam)}))`)
    if (!applied || applied === 'null') { check(`机位 ${pose.name} 生效`, false, String(applied)); continue }
    // 换机位之后也等画面稳定（相机插值 / 视线重建）
    await step(10)

    // ── 对照组：只推进帧，不点击 ──────────────────────────────────────────
    const c0 = await shot(`control-${pose.name}-before.png`)
    await step(STEPS)
    const c1 = await shot(`control-${pose.name}-after.png`)
    const control = changed(c0, c1)
    // 对照组之后把状态推回去：再点一次会把车送回原位，故每台机位都从"当前状态"起步，
    // 对照只量"推帧本身"的变化，不影响下面的实验。

    // ── 实验组：在置物台中心发一次真实点击 ────────────────────────────────
    const a0 = await shot(`click-${pose.name}-before.png`)
    const fired = await page.eval(`(() => {
      const el = document.querySelector('canvas');
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const opt = { clientX: x, clientY: y, bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', button: 0, buttons: 1 };
      el.dispatchEvent(new PointerEvent('pointerdown', opt));
      el.dispatchEvent(new PointerEvent('pointerup', { ...opt, buttons: 0 }));
      return JSON.stringify({ x: Math.round(x), y: Math.round(y) });
    })()`)
    await step(STEPS)
    const a1 = await shot(`click-${pose.name}-after.png`)
    const clicked = changed(a0, a1)

    console.log(`\n  【机位 ${pose.name}】点击点 ${fired}`)
    console.log(`    对照（不点击，推 ${STEPS} 帧）：差异像素 ${control}`)
    console.log(`    实验（点置物台，推 ${STEPS} 帧）：差异像素 ${clicked}`)
    results.push({ pose: pose.name, control, clicked })
  }

  // 判据：至少一台机位命中并让画面显著变化
  const hit = results.filter((r) => r.clicked > Math.max(r.control * 3 + 50, 120))
  check(
    '★ 点击置物台后画面**显著**变化（四段动画至少有一条被唤醒）',
    hit.length >= 1,
    hit.length ? `命中机位：${hit.map((r) => r.pose).join(' / ')}` : '两台机位都没让画面动起来',
  )
  // ★ 对照组判据**只对命中机位**提要求。未命中的机位视野里可能有**持续动画**
  //   （云在飘、星星在闪、萤火虫在飞），它的"对照"本来就大 —— 那与置物台无关，
  //   拿它当判据只会造成假红（实测：俯视机位对照 9、另一台 4781）。
  const clean = hit.filter((r) => r.control < Math.max(r.clicked / 2, 1))
  check(
    '★ 命中机位的对照组可忽略（差异确实来自点击，不是环境动画）',
    clean.length >= 1,
    clean.length ? `干净机位：${clean.map((r) => r.pose).join(' / ')}` : hit.map((r) => `${r.pose} 对照 ${r.control}`).join(' | '),
  )

  const errs = page.errors()
  check('全程无未捕获页面异常', errs.length === 0, errs.slice(0, 2).map((e) => e.text).join(' | '))
} finally {
  await page.close().catch(() => {})
  chrome.kill()
}

console.log(`\n  结果：${fail === 0 ? '通过' : fail + ' 项失败'}   截图产物 _shots/j420/\n`)
process.exit(fail === 0 ? 0 : 1)
