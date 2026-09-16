/**
 * `J4.8`（C1）判据 —— 「点击镜面真的泛起涟漪」
 *
 * ## 为什么必须有这个脚本
 *
 * C1 是 `J3` 留下的**静默功能回归**：镜面的自建射线随几何区间一起被删掉，
 * 于是"点镜面"这个入口消失了 —— 而**画面逐字节没有变化**（镜面的高光与星星闪烁由
 * `dirtyT` 每 0.12 秒重绘驱动，时序未变）。所以：
 *
 *   · **像素回归看不见它**（三机位是固定视角的定格帧，根本没人去点镜子）；
 *   · **冒烟看不见它**（S4/S6 点的是壁炉与书堆）；
 *   · **交互探针看不见它**（镜面**刻意**没有 `interactables`，不在 `aimMissing` 的判据范围内）。
 *
 * 三条一起漏 —— 与 `J3.1` 的教训同源。所以这里补一条**直指问题本身**的判据：
 * 对准镜面 → 发一次真实的 `pointerdown`+`pointerup` → 看**画面是否真的变了**，
 * 并且用一组"不点击"的对照，把"推进帧本身造成的变化"扣掉。
 *
 * 用法：`pnpm test:mirror`（需要先 `pnpm build` + `pnpm serve`）
 *
 * > 它由 `J4.8`（缺口 **C1**）建立：那一次是"把 `J3` 删掉的射线接回来"，
 * > 而这条判据负责**不让它再被删掉**。归属 `tests/e2e/` —— 与冒烟、探针同级。
 */
import fs from 'node:fs'
import path from 'node:path'
import { findBrowser, launch, connect } from './cdp.mjs'
import { resolveHomePath } from './page.mjs'
import { readPng, diffPng } from '../visual/png.mjs'

const ROOT = path.resolve(import.meta.dirname, '../..')
const BASE = String(process.env.CABIN_URL || 'http://127.0.0.1:4321').replace(/\/$/, '')
const SHOTS = path.join(ROOT, '_shots/j48')

// 镜面世界坐标从 `layout.js` 读（不变量 N9：坐标只有一个来源）。
// ⚠️ 直接 import 而不是正则抠字面量 —— `FY` 是 `const FY = FLOOR_TOP`（**表达式**，不是数字），
//    抠字面量会当场抛"找不到 FY"（实测）。
const { createLayout } = await import('../../src/cabin/world/layout.js')
const L = createLayout()
const MX = L.MIRROR_X
const MZ = L.MIRROR_Z
const FY = L.FY
// ★ 相机必须站在**镜面正面**那一侧。`mirrorG.rotation.y = Math.PI`（见 `mirror.js`）——
//   镜面朝 **-Z**（贴在前墙内侧、朝向屋内），所以相机要在 `MZ` **更小**的一侧；
//   站在 `MZ + 2.2`（镜背面）时 `Raycaster` 打不到：`PlaneGeometry` 是单面的，
//   默认只测正面 ⇒ 点击永远"落空"，而画面**看起来完全正常**（实测踩过）。
const CAM = [MX, FY + 1.15, MZ - 1.6, MX, FY + 0.85, MZ]

const browser = findBrowser()
if (!browser) { console.error('找不到 Chrome/Edge'); process.exit(1) }
const HOME = await resolveHomePath(BASE, { onError: (w) => console.error('无法访问：' + w) })
if (!HOME) process.exit(2)

fs.mkdirSync(SHOTS, { recursive: true })
const chrome = await launch({ port: 9351, width: 900, height: 600 })
const page = await connect(chrome.port)
let fail = 0
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? '  →  ' + detail : ''}`)
  if (!ok) fail++
}

try {
  await page.setViewport(900, 600)
  await page.navigate(`${BASE}${HOME}?deterministic=1&frames=1`)
  await page.waitFor('document.documentElement.dataset.cabin === "ready"', { timeoutMs: 120000 })

  // 对准镜面
  const applied = await page.eval(`JSON.stringify(window.__cabinSetTestCamera(${JSON.stringify(CAM)}))`)
  await page.eval('window.__cabinStepFrame()')
  await page.eval('window.__cabinStepFrame()')
  check('测试机位已生效（对准镜面）', applied && applied !== 'null', applied)

  const shot = async (name) => {
    const p = path.join(SHOTS, name)
    await page.screenshot(p)
    return p
  }
  const changed = (a, b) => {
    const d = diffPng(readPng(a), readPng(b))
    return d.diff ?? d.changed ?? d.diffPixels ?? 0
  }

  // ── 对照组：只推进帧，不点击 ─────────────────────────────────────────────
  const c0 = await shot('control-before.png')
  for (let i = 0; i < 3; i++) await page.eval('window.__cabinStepFrame()')
  const c1 = await shot('control-after.png')
  const control = changed(c0, c1)

  // ── 实验组：在镜面中心发一次真实点击 ──────────────────────────────────────
  const a0 = await shot('click-before.png')
  const fired = await page.eval(`(() => {
    const el = document.querySelector('canvas');
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const opt = { clientX: x, clientY: y, bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', button: 0, buttons: 1 };
    el.dispatchEvent(new PointerEvent('pointerdown', opt));
    el.dispatchEvent(new PointerEvent('pointerup', { ...opt, buttons: 0 }));
    return JSON.stringify({ x: Math.round(x), y: Math.round(y) });
  })()`)
  for (let i = 0; i < 3; i++) await page.eval('window.__cabinStepFrame()')
  const a1 = await shot('click-after.png')
  const clicked = changed(a0, a1)

  console.log(`\n  对照（不点击，推 3 帧）：差异像素 ${control}`)
  console.log(`  实验（点镜面，推 3 帧）：差异像素 ${clicked}   点击点 ${fired}`)

  check('点击镜面后画面**显著**变化（涟漪真的生成了）', clicked > Math.max(control * 3 + 50, 120), `实验 ${clicked} vs 对照 ${control}`)
  check('对照组本身几乎没有变化（说明差异来自点击，不是推帧）', control < clicked / 2, `对照 ${control}`)
  const errs = page.errors()
  check('全程无未捕获页面异常', errs.length === 0, errs.slice(0, 2).map((e) => e.text).join(' | '))
} finally {
  await page.close().catch(() => {})
  chrome.kill()
}

console.log(`\n  结果：${fail === 0 ? '通过' : fail + ' 项失败'}   截图产物 _shots/j48/\n`)
process.exit(fail === 0 ? 0 : 1)
