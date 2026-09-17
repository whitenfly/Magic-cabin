/**
 * 一次性探测（`J4.49`）：`launch({ gpu: true })` 到底有没有真的用上 GPU？
 *
 * 起因：用户看任务管理器发现"Chrome 的 GPU 占用为 0"。而 `smoke` 在切 `gpu: true` 后
 * 从 236.8s 降到 9.8s（24×）—— 这两个观察**互相矛盾**，必须实测澄清：
 * 读 WebGL 自己报告的渲染器字符串（`UNMASKED_RENDERER_WEBGL`），而不是靠推测。
 *
 * 用法：node scripts/oneoff/_j449-gpu-check.mjs
 */
import { launch, connect } from '../../tests/e2e/cdp.mjs'
import { resolveHomePath } from '../../tests/e2e/page.mjs'

const BASE = process.env.CABIN_URL || 'http://127.0.0.1:5173'
const HOME = await resolveHomePath(BASE)
if (!HOME) {
  console.error('无法访问 ' + BASE)
  process.exit(2)
}

/** 在页面里新建一个 canvas 读 WebGL 渲染器字符串（反映该浏览器的 GPU 配置） */
const READ_RENDERER = `(() => {
  const c = document.createElement('canvas');
  const gl = c.getContext('webgl2') || c.getContext('webgl');
  if (!gl) return 'no-webgl';
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const r = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  const v = ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
  return v + ' | ' + r;
})()`

for (const gpu of [false, true]) {
  const port = gpu ? 9381 : 9382
  const chrome = await launch({ port, width: 640, height: 400, gpu })
  const page = await connect(chrome.port)
  try {
    await page.navigate(`${BASE}${HOME}?bare=1&stats=1&frames=1`)
    await page.waitFor('document.documentElement.dataset.cabin === "ready"', { timeout: 120000 })
    const r = await page.eval(READ_RENDERER)
    console.log(`launch({ gpu: ${String(gpu).padEnd(5)} })  →  ${r}`)
  } finally {
    await page.close().catch(() => {})
    chrome.kill()
  }
}
