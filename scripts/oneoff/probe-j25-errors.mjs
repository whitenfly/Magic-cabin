/**
 * 一次性探针（`J2.5`）：把页面上的控制台错误原样打出来。
 *
 * 用途：`pnpm test:visual` 报"3 个无效截图"时，`compare.mjs` 只在**哈希不同**的
 * 分支里打印 `shot.problems`（见 compare.mjs:151），所以哈希相同却 `ok:false` 时
 * 看不到原因。这个脚本绕过那层，直接读 `page.errors()`。
 *
 * 用法：
 *   node scripts/oneoff/probe-j25-errors.mjs                       # 默认打默认机位
 *   $env:CABIN_URL=...; $env:CDP_PORT=...; node scripts/oneoff/probe-j25-errors.mjs
 */
import { launch, connect } from '../../tests/e2e/cdp.mjs'
import { resolveHomePath, pageUrl } from '../../tests/e2e/page.mjs'

const base = String(process.env.CABIN_URL || 'http://127.0.0.1:8123').replace(/\/$/, '')
const port = Number(process.env.CDP_PORT || 9451)

const homePath = await resolveHomePath(base, {
  onError: (why) => {
    console.error(`✗ 无法访问 ${base} —— ${why}`)
    process.exit(2)
  },
})

const query = '?deterministic=1&frames=120&frameStep=0.016666666666666666&bare=1&house=full&stats=1&run=1'
const browser = await launch({ port })
try {
  const page = await connect(port)
  await page.navigate(pageUrl(base, homePath, query))
  await page.waitFor('document.documentElement.dataset.cabin === "ready"', { timeout: 120000 })
  await page.waitFor('document.documentElement.dataset.cabinStillRepaint === "1"', { timeout: 60000 })

  console.log('\n=== 页面错误 / 控制台 ===')
  const errs = page.errors()
  if (!errs.length) console.log('（无）')
  for (const e of errs) console.log(`  [${e.type || e.level || '?'}] ${String(e.text).slice(0, 400)}`)

  console.log('\n=== 全部日志 ===')
  for (const l of page.logs || []) console.log(`  [${l.type || l.level || '?'}] ${String(l.text).slice(0, 300)}`)

  console.log('\n=== 设置面板诊断 ===')
  const diag = await page.eval(`JSON.stringify({
    ready: document.documentElement.dataset.cabin,
    house: document.documentElement.dataset.cabinHouse || null,
    settingsAuto: !!document.getElementById('settingsAuto'),
    houseToggle: !!document.getElementById('houseToggle'),
    viewFixedBtn: !!document.getElementById('viewFixedBtn'),
    sfxToggle: !!document.getElementById('sfxToggle'),
    sfxSlider: !!document.getElementById('sfxSlider'),
    speedSlider: !!document.getElementById('speedSlider'),
    wxRandToggle: !!document.getElementById('wxRandToggle'),
    settingsResetBtn: !!document.getElementById('settingsResetBtn'),
    settingNodes: document.querySelectorAll('[data-setting]').length,
    anchors: [...document.querySelectorAll('[data-setting-group]')].map(e => e.dataset.settingGroup),
  })`)
  console.log('  ' + diag.replace(/","/g, '",\n  "'))

  console.log('\n=== store 快照（哪些键是 undefined）===')
  const snap = await page.eval(
    `(() => { const s = window.__cabinApp ? window.__cabinApp().settings : null; return JSON.stringify(s) })()`,
  )
  console.log('  ' + String(snap))
  await page.close()
} finally {
  browser.kill()
}
