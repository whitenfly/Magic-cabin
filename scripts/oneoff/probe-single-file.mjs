/**
 * 一次性探针：单文件产物（`dist-single/`）在 `file://` 下到底能不能跑。
 *
 * 目的：`docs/BuildPlaning/01` §3 的 `J1.5.6`（决策点 OD-2 选项①）要求保留
 * "双击即玩"这条产线。要回答的问题是：**双击之后 3D 能不能起来**。
 *
 * 已知的两个可能障碍：
 *   ① `<script type="module">` 在 `file://` 下被 CORS 规则拦住（模块脚本必须同源，而 file:// 的 origin 是 opaque）
 *   ② Vite 注入的 `crossorigin` 属性会进一步收紧这条限制
 *   ③ 音频用相对路径 `sounds/x.mp3` —— 这个在 file:// 下反而是正常的
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { findBrowser, launch, connect, sleep } from '../../tests/e2e/cdp.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const SINGLE = path.join(ROOT, 'dist-single/index.html')

if (!fs.existsSync(SINGLE)) {
  console.error('✗ 还没有单文件产物：先运行 pnpm build:single')
  process.exit(2)
}

const fileUrl = `file:///${SINGLE.replace(/\\/g, '/')}?deterministic=1&frames=1`
const browser = findBrowser()
if (!browser) {
  console.error('✗ 未找到 Chrome / Edge')
  process.exit(1)
}

const chrome = await launch({ port: 9336, width: 900, height: 600 })
const page = await connect(chrome.port)
await page.setViewport(900, 600)

try {
  await page.navigate(fileUrl)
  await sleep(7000) // 给足时间：能起来的话 data-cabin 早就是 ready 了
  const info = await page.eval(`(() => ({
    url: location.href.slice(0, 40),
    protocol: location.protocol,
    ready: document.documentElement.dataset.cabin || null,
    canvas: !!document.querySelector('canvas'),
    scripts: [...document.querySelectorAll('script[src]')].map(s => s.getAttribute('src')),
    inlineScripts: [...document.querySelectorAll('script:not([src])')].map(s => (s.textContent || '').length),
  }))()`)
  const errs = page.errors()
  console.log('')
  console.log('  file:// 探针')
  console.log('  ──────────────────────────────────────────')
  console.log(`  协议      ${info.protocol}`)
  console.log(`  3D 就绪   ${info.ready ?? '(未就绪)'}`)
  console.log(`  canvas    ${info.canvas}`)
  console.log(`  外部脚本  ${JSON.stringify(info.scripts)}`)
  console.log(`  内联脚本   ${JSON.stringify(info.inlineScripts)}（长度）`)
  console.log(`  页面错误  ${errs.length}`)
  for (const e of errs.slice(0, 5)) console.log(`      · ${String(e.text).slice(0, 200)}`)
  console.log('')
  console.log(info.ready === 'ready' ? '  ✓ 双击即玩可用' : '  ✗ 双击即玩不可用（见上方错误）')
  console.log('')

  // ── 诊断：把内联脚本的文本抽出来，用 Node 自己解析一遍，定位语法错误的确切位置 ──
  const inline = await page.eval(
    `(() => { const s = [...document.querySelectorAll('script:not([src])')].find(x => (x.textContent||'').length > 1000); return s ? s.textContent : null })()`,
  )
  if (inline) {
    const tmp = path.join(ROOT, '.cache/probe-inline-script.js')
    fs.mkdirSync(path.dirname(tmp), { recursive: true })
    fs.writeFileSync(tmp, inline, 'utf8')
    console.log(`  内联脚本已抽出 → ${path.relative(ROOT, tmp)}（${inline.length} 字符）`)
    console.log('  用 Node 复核语法： node --check .cache/probe-inline-script.js')
    console.log('')
  }
} finally {
  await page.close()
  chrome.kill()
}
process.exit(0)
