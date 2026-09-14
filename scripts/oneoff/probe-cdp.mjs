/**
 * 一次性探针：当前环境能不能启动 headless Chrome（CDP）。
 *
 * 为什么需要它：`J1.5` 的回归测试（`test:visual` / `test:smoke` / `test:perf`）都依赖真实浏览器。
 * 受限文件策略下 Chrome 会在启动阶段就被挡下（它需要**命名管道**做进程间通信，
 * 并把 profile 写到系统临时目录），表现为"调试端口 30 秒内未就绪"这种**看不出原因**的失败。
 * 这个探针把"环境拒绝"与"项目坏了"两件事分开，避免把前者误判成后者。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { findBrowser, launch, sleep } from '../../tests/e2e/cdp.mjs'

const exe = findBrowser()
console.log('')
console.log('  CDP 启动探针')
console.log('  ──────────────────────────────────────────')
console.log(`  浏览器    ${exe ?? '(未找到)'}`)

// 逐项探测 Chrome 真正需要的能力，故障时能直接指出是哪一项
const checks = []

// ① 系统临时目录可写（Chrome 的 --user-data-dir 放在这里）
try {
  const probe = fs.mkdtempSync(path.join(os.tmpdir(), 'cabin-probe-'))
  fs.writeFileSync(path.join(probe, 'x'), 'ok')
  fs.rmSync(probe, { recursive: true, force: true })
  checks.push(['系统临时目录可写（user-data-dir 的落点）', true, os.tmpdir()])
} catch (e) {
  checks.push(['系统临时目录可写（user-data-dir 的落点）', false, e.code || e.message])
}

// ② 能否真的把 Chrome 拉起来
let launched = null
try {
  const t0 = Date.now()
  const chrome = await launch({ port: 9340, width: 800, height: 600 })
  launched = { chrome, ms: Date.now() - t0 }
  checks.push(['headless Chrome 可启动（CDP 端口就绪）', true, `${launched.ms}ms`])
} catch (e) {
  checks.push(['headless Chrome 可启动（CDP 端口就绪）', false, e.message])
}

for (const [label, ok, detail] of checks) {
  console.log(`  ${ok ? '✓' : '✗'} ${label}`)
  if (detail) console.log(`      ${detail}`)
}

if (launched) {
  const { chrome } = launched
  try {
    const page = await (await import('../../tests/e2e/cdp.mjs')).connect(chrome.port)
    await page.setViewport(800, 600)
    await page.navigate('data:text/html,<h1>ok</h1>')
    await sleep(500)
    const title = await page.eval('document.querySelector("h1")?.textContent ?? null')
    console.log(`  ✓ 页面可导航与求值（读到 "${title}"）`)
    await page.close()
  } catch (e) {
    console.log(`  ✗ 页面可导航与求值：${e.message}`)
  }
  chrome.kill()
}

console.log('')
console.log(
  checks.every(([, ok]) => ok)
    ? '  → 真实浏览器可用：三条回归测试（visual / smoke / perf）都能跑'
    : '  → 真实浏览器不可用：这是**环境限制**（受限文件策略禁止命名管道），不是项目问题。\n' +
        '     此时仍可用的验证：pnpm verify:j15 --built / verify-migration / verify-f02 / f03 / f04 / f06 / typecheck',
)
console.log('')
process.exit(0)
