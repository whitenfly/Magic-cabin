/**
 * 一次性探针：给定一个 URL，报告"3D 到底有没有起来、卡在哪一步"。
 *
 * 用途（`J1.5` 收尾时发现的单文件产物问题就靠它定位）：
 *   · 产物在 HTTP 托管下等不到 `data-cabin="ready"` 时，区分三种可能：
 *     ① 脚本压根没执行（`__cabinStepFrame` 等桥接函数不存在 / 页面报语法错）
 *     ② 脚本执行了但在 boot 中途抛错（有 `window.THREE` 但没有 `data-cabin`）
 *     ③ 起来了但很慢（都在，只是没等到）
 *
 * 用法：
 *   node scripts/oneoff/probe-page.mjs http://127.0.0.1:5191/
 *   node scripts/oneoff/probe-page.mjs file:///D:/…/dist-single/index.html
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { findBrowser, launch, connect, sleep } from '../../tests/e2e/cdp.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const target = process.argv[2]
if (!target) {
  console.error('用法：node scripts/oneoff/probe-page.mjs <url>')
  process.exit(2)
}

const browser = findBrowser()
if (!browser) {
  console.error('✗ 未找到 Chrome / Edge')
  process.exit(1)
}

const chrome = await launch({ port: 9337, width: 1440, height: 900 })
const page = await connect(chrome.port)
await page.setViewport(1440, 900)

try {
  const t0 = Date.now()
  await page.navigate(target)
  await sleep(9000) // 够 dist/ 起来（实测约 1–2s）

  const state = await page.eval(`(() => {
    const d = document.documentElement.dataset
    const scripts = [...document.querySelectorAll('script')]
    return {
      url: location.href,
      protocol: location.protocol,
      cabin: d.cabin || null,
      deterministic: d.cabinDeterministic || null,
      manual: d.cabinManualClock || null,
      frames: d.cabinFrames || null,
      seed: d.cabinSeed || null,
      canvas: !!document.querySelector('canvas'),
      canvasSize: (() => { const c = document.querySelector('canvas'); return c ? c.width + 'x' + c.height : null })(),
      hasTHREE: typeof window.THREE,
      bridgeStepFrame: typeof window.__cabinStepFrame,
      bridgeSetCam: typeof window.__cabinSetTestCamera,
      bridgeStats: typeof window.__cabinRenderStats,
      uiNodes: ['menuDot','menuPanel','hint','clock','wxChips','viewFixedBtn','viewTpBtn','viewFpBtn','houseToggle']
        .filter(id => !document.getElementById(id)),
      externalScripts: scripts.filter(s => s.src).map(s => s.getAttribute('src')),
      moduleScripts: scripts.filter(s => s.type === 'module').length,
      inlineScriptLens: scripts.filter(s => !s.src).map(s => (s.textContent || '').length),
    }
  })()`)

  const errs = page.errors()
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)

  console.log('')
  console.log('  页面探针')
  console.log('  ──────────────────────────────────────────')
  console.log(`  目标        ${state.url.slice(0, 72)}`)
  console.log(`  协议        ${state.protocol}      等待 ${elapsed}s`)
  console.log(`  data-cabin  ${state.cabin ?? '(未就绪)'}`)
  console.log(`  canvas      ${state.canvas}  ${state.canvasSize ?? ''}`)
  console.log(`  THREE       ${state.hasTHREE}     __cabinStepFrame ${state.bridgeStepFrame}     __cabinRenderStats ${state.bridgeStats}`)
  console.log(`  确定性      det=${state.deterministic} manual=${state.manual} frames=${state.frames} seed=${state.seed}`)
  console.log(`  缺失 UI 节点 ${state.uiNodes.length ? state.uiNodes.join(', ') : '(无)'}`)
  console.log(`  外部脚本    ${JSON.stringify(state.externalScripts)}`)
  console.log(`  模块脚本数  ${state.moduleScripts}      内联脚本长度 ${JSON.stringify(state.inlineScriptLens)}`)
  console.log(`  页面错误    ${errs.length}`)
  for (const e of errs.slice(0, 6)) console.log(`      · ${String(e.text).slice(0, 220)}`)
  console.log('')

  // 把内联脚本抽出来做语法复核（"脚本没执行"最常见的原因就是语法错）
  const inline = await page.eval(
    `(() => { const s = [...document.querySelectorAll('script:not([src])')].find(x => (x.textContent||'').length > 1000); return s ? s.textContent : null })()`,
  )
  if (inline) {
    const tmp = path.join(ROOT, '.cache/probe-inline.mjs')
    fs.mkdirSync(path.dirname(tmp), { recursive: true })
    fs.writeFileSync(tmp, inline, 'utf8')
    console.log(`  内联脚本已抽出 → ${path.relative(ROOT, tmp).replace(/\\/g, '/')}（${inline.length} 字符）`)
    console.log('  语法复核： node --check .cache/probe-inline.mjs')
    console.log('')
  }
} finally {
  await page.close()
  chrome.kill()
}
process.exit(0)
