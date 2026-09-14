/**
 * 魔法小屋 —— 本地静态服务器（**受限环境下的兜底验证路径**）
 * ============================================================================
 * 为什么需要它：Astro 与 Vite 都依赖 esbuild，而 esbuild 通过**子进程 + 命名管道**与原生
 * 二进制通信；在禁止管道的受限环境（沙箱）里会报 `spawn EPERM`。本服务器不使用任何子进程，
 * 于是"构建产物能不能跑"这件事在任何环境里都验证得了（这是 `J1.5.5` 的目的）。
 *
 * 两种托管模式（J1.5 起）：
 *
 * | 模式 | 托管内容 | 用途 |
 * |---|---|---|
 * | **`dist`（默认）** | `dist/`（`astro build` 的产物）；`/src/**`、`/node_modules/**` 回落到仓库根 | 验证**真实产物**：路由、尾斜杠、相对资源都按线上行为走 |
 * | `legacy`（`--legacy`） | 仓库根（`index.html` + `src/**`，零构建 ESM + importmap） | `J1` 就有的兜底：连构建都不做也能跑起 3D |
 *
 * 解析顺序（先命中者胜）：
 *   dist 模式：`dist/<path>`  →  `<仓库根>/<path>`（只给 /src、/node_modules 这类源码路径用）
 *   legacy 模式：`<仓库根>/<path>`  →  `public/<path>`
 *
 * 特性：
 *   · 端口被占用时自动顺延，不会崩溃
 *   · 写入 PID 文件，支持 stop / status 管理（不遗留孤儿进程）
 *   · 目录缺尾斜杠时 301 到带尾斜杠的规范 URL（与 `trailingSlash: 'always'` 一致）
 *   · 未命中时返回 `dist/404.html`（若存在），否则纯文本 404
 *
 * 用法：
 *   node scripts/serve.mjs [--port=5173] [--host] [--open] [--quiet] [--legacy] [--dir=<路径>]
 *   或   pnpm serve / serve:open / serve:lan / serve:legacy
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const STATE_DIR = path.join(ROOT, '.cache')
const STATE_FILE = path.join(STATE_DIR, 'serve.json')

/** 默认产物目录（与 astro.config.mjs 的 `outDir` 一致） */
const DIST_DIR = path.join(ROOT, 'dist')
const LEGACY_INDEX = path.join(ROOT, 'index.html')

// ── 参数解析 ──
const argv = process.argv.slice(2)
const arg = (name, def) => {
  const hit = argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`))
  if (!hit) return def
  const eq = hit.indexOf('=')
  return eq === -1 ? true : hit.slice(eq + 1)
}
const PORT = Number(arg('port', process.env.PORT || 5173))
const HOST = arg('host', false) ? '0.0.0.0' : process.env.HOST || '127.0.0.1'
const OPEN = Boolean(arg('open', false))
const QUIET = Boolean(arg('quiet', false))
const LEGACY = Boolean(arg('legacy', false))
const MAX_PORT_TRIES = 10

/** 产物目录：`--dir=` 覆盖，否则 dist/ */
const OUT_DIR = path.resolve(ROOT, String(arg('dir', DIST_DIR)))
const HAS_DIST = fs.existsSync(path.join(OUT_DIR, 'index.html'))

/**
 * 托管根（按顺序查找）。与旧版的区别只有一处：
 * **产物目录排在仓库根之前** —— 这样 `/`、`/archive/`、`/posts/<slug>/` 命中的都是真产物，
 * 而 `/src/**`、`/node_modules/three/**` 仍然回落到仓库根（零构建兜底路径继续可用）。
 */
const ROOTS = LEGACY
  ? [ROOT]
  : [OUT_DIR, ...(OUT_DIR === ROOT ? [] : [ROOT])]
/** legacy 模式还要认 public/（旧的零构建约定：/sounds/ui.mp3 → public/sounds/ui.mp3） */
const EXTRA_ROOTS = LEGACY ? [path.join(ROOT, 'public')] : []

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.ts': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

let requestCount = 0
let startTime = Date.now()

/** 在候选根里找一个真实文件；路径越界（`..`）一律拒绝 */
function findFile(urlPath) {
  for (const base of [...ROOTS, ...EXTRA_ROOTS]) {
    const candidate = path.resolve(base, `.${urlPath}`)
    if (!candidate.startsWith(base)) continue
    try {
      if (fs.statSync(candidate).isFile()) return candidate
    } catch {
      /* 不存在，继续找下一个根 */
    }
  }
  return null
}

/** 目录里找 index.html（尾斜杠 URL 的落点） */
function findIndex(urlPath) {
  for (const base of [...ROOTS, ...EXTRA_ROOTS]) {
    const candidate = path.resolve(base, `.${urlPath}`, 'index.html')
    if (!candidate.startsWith(base)) continue
    try {
      if (fs.statSync(candidate).isFile()) return candidate
    } catch {
      /* 继续 */
    }
  }
  return null
}

/** 目录存在但没有 index.html 时，仍要把它当成"目录"（用于 301 到带尾斜杠的规范 URL） */
function isDir(urlPath) {
  for (const base of [...ROOTS, ...EXTRA_ROOTS]) {
    const candidate = path.resolve(base, `.${urlPath}`)
    if (!candidate.startsWith(base)) continue
    try {
      if (fs.statSync(candidate).isDirectory()) return true
    } catch {
      /* 继续 */
    }
  }
  return false
}

const server = http.createServer((req, res) => {
  requestCount++
  try {
    const parsed = new URL(req.url, `http://${req.headers.host}`)
    const urlPath = decodeURIComponent(parsed.pathname)

    // ① 不带尾斜杠的目录 → 301 到规范 URL（与 astro.config 的 trailingSlash: 'always' 一致）
    //    不做这一步，`/archive` 的 HTML 里所有相对资源都会相对上一级解析 —— 典型"样式全丢"
    if (!urlPath.endsWith('/') && isDir(urlPath) && urlPath !== '/') {
      res.writeHead(301, { Location: `${urlPath}/${parsed.search}` })
      res.end()
      return
    }

    // ② 命中文件
    //    · 路径以 `/` 结尾：目标是该目录的 index.html
    //    · legacy 模式的 `/`：必须给仓库根的旧入口（而不是 dist/）
    let filePath = null
    if (LEGACY && urlPath === '/') filePath = LEGACY_INDEX
    if (!filePath && (urlPath === '/' || urlPath.endsWith('/'))) filePath = findIndex(urlPath)
    if (!filePath) filePath = findFile(urlPath)

    if (!filePath) {
      const status = urlPath === '/' ? 500 : 404
      const fallback = findFile('/404.html')
      if (status === 404 && fallback) {
        res.writeHead(404, { 'Content-Type': MIME['.html'] })
        fs.createReadStream(fallback).pipe(res)
      } else {
        res.writeHead(status, { 'Content-Type': MIME['.txt'] })
        res.end(status === 500 ? '还没有构建产物：先跑 pnpm build，或用 pnpm serve:legacy' : `404 ${urlPath}`)
      }
      if (!QUIET) console.log(`  ${status}  ${urlPath}`)
      return
    }

    const ext = path.extname(filePath).toLowerCase()
    // HTML 不缓存（改了立刻能看见）；带内容哈希的静态资源可以长缓存
    const hashed = /\.[0-9a-f]{8,}\.(js|css|woff2?|png|jpe?g|webp|avif|svg|mp3)$/i.test(filePath)
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache',
    })
    fs.createReadStream(filePath).pipe(res)
    if (!QUIET && !/\.(mp3|png|jpe?g|webp|avif|ico|woff2?)$/i.test(filePath)) {
      console.log(`  200  ${urlPath}`)
    }
  } catch (err) {
    res.writeHead(500, { 'Content-Type': MIME['.txt'] }).end(String(err))
    console.error('  500 ', err?.message || err)
  }
})

// ── 端口占用时自动顺延 ──
let port = PORT
let tries = 0
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE' && tries < MAX_PORT_TRIES) {
    tries++
    const next = PORT + tries
    console.log(`  端口 ${port} 被占用，改用 ${next}`)
    port = next
    setTimeout(() => server.listen(port, HOST), 60)
    return
  }
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  ✗ ${MAX_PORT_TRIES} 个端口均被占用，请先停止其他服务或指定 --port\n`)
  } else {
    console.error('\n  ✗ 服务器启动失败：', err.message, '\n')
  }
  cleanupState()
  process.exit(1)
})

server.listen(port, HOST, () => {
  startTime = Date.now()
  const shown = HOST === '0.0.0.0' ? '127.0.0.1' : HOST
  const url = `http://${shown}:${port}/`

  // 写 PID 文件，供 pnpm stop / pnpm status 使用
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true })
    fs.writeFileSync(
      STATE_FILE,
      JSON.stringify(
        {
          pid: process.pid,
          port,
          host: HOST,
          url,
          mode: LEGACY ? 'legacy' : 'dist',
          outDir: path.relative(ROOT, OUT_DIR).replace(/\\/g, '/'),
          startedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    )
  } catch (e) {
    console.warn('  ⚠ 无法写入 PID 文件（stop/status 将不可用）：', e.message)
  }

  console.log('')
  console.log(LEGACY ? '  魔法小屋 · 零构建模式（legacy）' : '  魔法小屋 · 产物模式（dist）')
  console.log('  ──────────────────────────────────────────')
  console.log(`  地址      ${url}`)
  if (HOST === '0.0.0.0') {
    console.log('  局域网    已监听 0.0.0.0（手机可用本机 IP 访问）')
  }
  if (LEGACY) {
    console.log(`  入口      index.html + src/**（浏览器原生 ESM + importmap，无构建）`)
  } else if (HAS_DIST) {
    console.log(`  托管      ${path.relative(ROOT, OUT_DIR).replace(/\\/g, '/')}/（astro build 产物）`)
    console.log(`  回落      仓库根（/src/**、/node_modules/** —— 零构建兜底路径仍可用）`)
  } else {
    console.warn(`  ⚠ 还没有构建产物：${path.relative(ROOT, OUT_DIR).replace(/\\/g, '/')}/index.html 不存在`)
    console.warn(`     先构建： pnpm build        （或直接用零构建模式： pnpm serve:legacy）`)
  }
  console.log(`  进程      PID ${process.pid}`)
  console.log('  ──────────────────────────────────────────')
  console.log('  Ctrl+C 停止    （或在另一个终端执行 pnpm stop）')
  console.log('')

  if (OPEN) openBrowser(url)
})

// ── 优雅退出 ──
function cleanupState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const s = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
      if (s.pid === process.pid) fs.unlinkSync(STATE_FILE)
    }
  } catch {
    /* 忽略 */
  }
}

let closing = false
function shutdown(signal) {
  if (closing) return
  closing = true
  const secs = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\n  收到 ${signal}，正在停止…（运行 ${secs}s，服务 ${requestCount} 个请求）`)
  cleanupState()
  server.close(() => {
    console.log('  已停止。\n')
    process.exit(0)
  })
  // 兜底：连接迟迟不关闭时强制退出
  setTimeout(() => process.exit(0), 1500).unref()
}
process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGHUP', () => shutdown('SIGHUP'))
process.on('exit', cleanupState)

/** 打开默认浏览器（stdio: 'ignore' 以避免管道限制；失败不影响服务） */
function openBrowser(url) {
  try {
    const cmd = process.platform === 'win32' ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open'
    const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url]
    spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref()
    console.log(`  已请求打开浏览器：${url}\n`)
  } catch (e) {
    console.warn(`  ⚠ 无法自动打开浏览器（${e.message}），请手动访问 ${url}\n`)
  }
}
