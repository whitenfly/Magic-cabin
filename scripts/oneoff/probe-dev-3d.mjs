// 一次性诊断：确认 `astro dev`（Vite dev / ModuleRunner 路径）下 3D 能真正就绪。
//
// 为什么单独探一次：dev 与 build 的模块加载路径不同 —— build 走 Rollup 打包，
// dev 走 Vite 的按需转换 + ModuleRunner。服务器"启动成功"不等于"页面能跑"。
//
// 用法：node scripts/oneoff/probe-dev-3d.mjs [url]
import { launch, connect } from '../../tests/e2e/cdp.mjs'

const URL_BASE = process.argv[2] || 'http://localhost:4321/'
const url = `${URL_BASE.replace(/\/$/, '')}/?deterministic=1&frames=30`

const chrome = await launch({ port: 9336, width: 1440, height: 900 })
const page = await connect(chrome.port)
try {
  await page.setViewport(1440, 900)
  await page.navigate(url)
  const ready = await page.waitFor('document.documentElement.dataset.cabin === "ready"', { timeout: 120000 })
  console.log(`  URL            ${url}`)
  console.log(`  3D 就绪        ${ready ? '✓' : '✗'}`)
  const info = await page.eval(`JSON.stringify({
    cabin: document.documentElement.dataset.cabin || null,
    digest: (document.documentElement.dataset.cabinSceneDigest || '').slice(0, 16) || null,
    frames: document.documentElement.dataset.cabinFrames || null,
    canvas: !!document.querySelector('canvas'),
    foyer: !!document.getElementById('cabin-foyer'),
  })`)
  console.log(`  页面状态       ${info}`)
  const errs = page.errors()
  console.log(`  页面异常       ${errs.length === 0 ? '无' : errs.map((e) => e.text).join(' | ')}`)
  process.exitCode = ready && errs.length === 0 ? 0 : 1
} finally {
  await page.close()
  chrome.kill()
}
