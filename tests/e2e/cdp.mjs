/**
 * 零依赖 CDP 客户端（J0.4 移植）
 * ============================================================================
 * 来源：`Test/CSS3DRender原型验证/_probe/cdp.mjs`（原型验证期的工具，约 200 行）。
 * 本工程只依赖 node 内置模块，因此**不引入 puppeteer / playwright**：
 * Node 22+ 自带全局 `WebSocket` 与 `fetch`，"启动一个 headless 浏览器 + 截图 + 求值"
 * 用 200 行就够了。
 *
 * 为什么截图回归需要它（而不是 `chrome --screenshot`）：
 *
 * | 能力 | `--screenshot` | 本模块 |
 * |---|---|---|
 * | 等页面真正就绪（`data-cabin="ready"`） | ✗ 只能靠 `--virtual-time-budget` 赌时间 | ✓ 轮询断言 |
 * | 精确视口（与 `--window-size` 解耦） | ✗ 受窗口边框/DPI 影响 | ✓ `Emulation.setDeviceMetricsOverride` |
 * | 一个浏览器里连拍多机位 | ✗ 每次冷启动 ≈15s | ✓ 复用同一 target |
 * | 页面报错可诊断 | ✗ 静默 | ✓ 收集 console / exception |
 *
 * 用法（作为库）：
 *
 *     const { findBrowser, launch, connect } = await import('./cdp.mjs')
 *     const chrome = await launch()
 *     const page = await connect(chrome.port)
 *     await page.setViewport(1440, 900)
 *     await page.navigate(url)
 *     await page.waitFor('document.documentElement.dataset.cabin === "ready"')
 *     await page.screenshot('shot.png')
 *     await page.close(); chrome.kill()
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/** 常见安装位置；`CABIN_BROWSER` 环境变量可覆盖 */
const BROWSER_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
]

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** 找到可用的浏览器可执行文件；找不到返回 null */
export function findBrowser() {
  const fromEnv = process.env.CABIN_BROWSER
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv
  return BROWSER_CANDIDATES.find((p) => fs.existsSync(p)) || null
}

/**
 * 启动 headless 浏览器，返回 { proc, port, kill() }
 *
 * @param {object} [opts]
 * @param {boolean} [opts.gpu=false]
 *   `false`（默认）= **软件渲染**（SwiftShader）：沙箱与 CI 里唯一能跑通的路径，
 *   结果确定、可复现，但 FPS 只是"能跑"的量级。
 *   `true` = **真实 GPU**：不注入任何 GPU 相关开关，让 Chrome 自己挑（Windows 上通常走 ANGLE D3D11）——
 *   用于采集"真实设备上的性能"。若机器没有可用 GPU，Chrome 会自行回落到 SwiftShader，
 *   所以**务必检查报告里的"渲染后端"字段**，别把回落的结果当 GPU 数据。
 */
export async function launch({ port = 9333, width = 1440, height = 900, browser, gpu = false } = {}) {
  const exe = browser || findBrowser()
  if (!exe) throw new Error('找不到 Chrome / Edge（可用 CABIN_BROWSER 指定路径）')

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cabin-cdp-'))
  const args = [
    '--headless=new',
    '--no-sandbox',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    `--window-size=${width},${height}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    '--hide-scrollbars',
    '--mute-audio',
  ]
  if (!gpu) {
    // headless 下默认没有 GPU，WebGL 走 SwiftShader；新版 Chrome 需要显式允许
    args.push('--disable-gpu', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader')
  }
  args.push('about:blank')

  // stdio: 'ignore' —— 受限环境下管道 stdio 可能被拒（EPERM），而我们不需要它的输出
  const proc = spawn(exe, args, { stdio: 'ignore', detached: false })

  let ready = false
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`)
      if (r.ok) {
        ready = true
        break
      }
    } catch {
      /* 还没起来 */
    }
    await sleep(250)
  }
  if (!ready) {
    try {
      proc.kill()
    } catch {
      /* 忽略 */
    }
    throw new Error(`浏览器调试端口 ${port} 未就绪（可能端口被占用）`)
  }

  return {
    proc,
    port,
    exe,
    userDataDir,
    kill() {
      try {
        proc.kill()
      } catch {
        /* 忽略 */
      }
      try {
        fs.rmSync(userDataDir, { recursive: true, force: true })
      } catch {
        /* 忽略 */
      }
    },
  }
}

/** 列出当前 target 列表 */
export async function listTargets(port) {
  const r = await fetch(`http://127.0.0.1:${port}/json/list`)
  return r.json()
}

/**
 * 连接到第一个 page target，返回简易 page 对象。
 * 若已有页面则复用（多机位连拍时避免反复开标签页）。
 */
export async function connect(port, { timeout = 60000 } = {}) {
  let targets = (await listTargets(port)).filter((t) => t.type === 'page')
  if (!targets.length) {
    await fetch(`http://127.0.0.1:${port}/json/new?about:blank`)
    await sleep(300)
    targets = (await listTargets(port)).filter((t) => t.type === 'page')
  }
  const target = targets[0]

  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true })
    ws.addEventListener('error', () => rej(new Error('CDP WebSocket 连接失败')), { once: true })
    setTimeout(() => rej(new Error('CDP WebSocket 连接超时')), timeout)
  })

  let nextId = 1
  const pending = new Map()
  const listeners = new Map()

  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id)
      pending.delete(msg.id)
      if (msg.error) reject(new Error(msg.error.message))
      else resolve(msg.result)
    } else if (msg.method) {
      for (const fn of listeners.get(msg.method) ?? []) fn(msg.params)
    }
  })

  const send = (method, params = {}, timeoutMs = timeout) =>
    new Promise((resolve, reject) => {
      const id = nextId++
      pending.set(id, { resolve, reject })
      ws.send(JSON.stringify({ id, method, params }))
      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id)
          reject(new Error(`CDP 超时: ${method}`))
        }
      }, timeoutMs)
    })

  const on = (method, fn) => {
    if (!listeners.has(method)) listeners.set(method, [])
    listeners.get(method).push(fn)
  }

  await send('Page.enable')
  await send('Runtime.enable')
  await send('Log.enable')

  const logs = []
  on('Runtime.consoleAPICalled', (p) => {
    const text = p.args.map((a) => a.value ?? a.description ?? a.type).join(' ')
    logs.push({ level: p.type, text })
  })
  on('Runtime.exceptionThrown', (p) => {
    logs.push({ level: 'exception', text: p.exceptionDetails?.exception?.description || p.exceptionDetails?.text || '未知异常' })
  })

  const page = {
    send,
    on,
    logs,

    /** 精确设置视口（与 --window-size 解耦，保证截图尺寸就是 width×height） */
    async setViewport(width, height, deviceScaleFactor = 1) {
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor, mobile: false })
    },

    async navigate(url, { waitMs = 0 } = {}) {
      await send('Page.navigate', { url })
      if (waitMs) await sleep(waitMs)
    },

    /**
     * 在页面里求值；表达式可以是 Promise（默认等待）。
     *
     * ⚠️ `timeoutMs` 在**同步长循环**里必须显式给大：headless + SwiftShader 下每帧渲染
     *    1440×900 要 0.2s 量级，页面内推进几十帧就会超过默认的 60s（J0.5 踩过）。
     */
    async eval(expression, { awaitPromise = true, timeoutMs } = {}) {
      const r = await send(
        'Runtime.evaluate',
        {
          expression,
          returnByValue: true,
          awaitPromise,
          userGesture: true,
        },
        timeoutMs,
      )
      if (r.exceptionDetails) {
        throw new Error('页面异常: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text))
      }
      return r.result.value
    },

    /** 轮询等待表达式为真（导航过程中的求值失败会被忽略并重试） */
    async waitFor(expression, { timeout = 60000, interval = 200 } = {}) {
      const t0 = Date.now()
      for (;;) {
        let v = false
        try {
          v = await page.eval(`!!(${expression})`)
        } catch {
          v = false // 导航中 / 执行上下文已销毁 —— 继续等
        }
        if (v) return true
        if (Date.now() - t0 > timeout) throw new Error(`等待超时（${timeout}ms）: ${expression}`)
        await sleep(interval)
      }
    },

    /** 截图到文件（返回写入的字节数）
     *  ⚠️ 超时给得很宽：headless + SwiftShader 软件渲染下，抓一帧 1440×900 可能要几十秒 */
    async screenshot(file) {
      const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, 180000)
      const buf = Buffer.from(r.data, 'base64')
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, buf)
      return buf.length
    },

    /** 最近一次页面内的报错（用于"截图必须是有效画面"的健康检查） */
    errors() {
      return logs.filter((l) => l.level === 'exception' || l.level === 'error')
    },

    /** 清空日志（每个机位重新导航前调用，避免把上一个机位的报错算到这一次） */
    clearLogs() {
      logs.length = 0
    },

    async close() {
      try {
        ws.close()
      } catch {
        /* 忽略 */
      }
    },
  }

  return page
}
