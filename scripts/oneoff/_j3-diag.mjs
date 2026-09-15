/**
 * J3 运行时诊断 —— 页面起不来时，把 console 错误原样打出来
 *
 * 用途：`pnpm test:visual` 报 "等待超时（120000ms）: data-cabin === ready" 时，
 * 说明 boot 阶段抛了异常。像素回归只会说"超时"，不会说"哪里错了"——本脚本补这一环。
 *
 * 用法：先 `pnpm serve`，再
 *   node scripts/oneoff/_j3-diag.mjs
 */
import { findBrowser, launch, connect } from '../../tests/e2e/cdp.mjs'
import { resolveHomePath } from '../../tests/e2e/page.mjs'

const URL_BASE = String(process.env.CABIN_URL || 'http://127.0.0.1:4173').replace(/\/$/, '')
const browser = findBrowser()
if (!browser) { console.error('找不到 Chrome/Edge'); process.exit(1) }
const HOME = await resolveHomePath(URL_BASE, { onError: (w) => console.error('无法访问：' + w) })
if (!HOME) process.exit(2)

const chrome = await launch({ port: 9341, width: 900, height: 600 })
const page = await connect(chrome.port)
await page.setViewport(900, 600)
try {
  await page.navigate(`${URL_BASE}${HOME}?deterministic=1&frames=1&bare=1&stats=1`)
  await new Promise((r) => setTimeout(r, 8000))
  const state = await page.eval(`(() => ({
    ready: document.documentElement.dataset.cabin || '(未写入)',
    hasCanvas: !!document.querySelector('canvas'),
    app: typeof window.__cabinApp === 'function' ? (() => { try { return JSON.stringify(window.__cabinApp()).slice(0, 400) } catch (e) { return 'stats() 抛错: ' + e.message } })() : '(未暴露)',
  }))()`)
  console.log('\n页面状态：')
  console.log(JSON.stringify(state, null, 2))
  const errs = page.errors()
  console.log(`\n捕获到的错误（${errs.length}）：`)
  for (const e of errs.slice(0, 12)) {
    console.log('─'.repeat(70))
    console.log(e.text || JSON.stringify(e))
    if (e.stack) console.log(String(e.stack).split('\n').slice(0, 6).join('\n'))
  }
} finally {
  await page.close().catch(() => {})
  chrome.kill()
}
