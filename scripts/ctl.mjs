/**
 * 本地服务管理 —— 查看状态 / 停止服务
 *
 * 用法：
 *   node scripts/ctl.mjs status     或   pnpm status
 *   node scripts/ctl.mjs stop       或   pnpm stop
 *
 * 原理：serve.mjs 启动时把 { pid, port, url, startedAt } 写入 .cache/serve.json，
 *      本脚本据此判断服务是否在运行，并在停止时清理该文件。
 */
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const STATE_FILE = path.join(ROOT, '.cache', 'serve.json')
const cmd = process.argv[2] || 'status'

// 颜色：仅在支持 ANSI 的终端启用（非 TTY 或 NO_COLOR 时自动关闭，避免日志出现乱码）
const useColor = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR
const wrap = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : String(s))
const c = {
  dim: wrap(2),
  green: wrap(32),
  yellow: wrap(33),
  red: wrap(31),
  bold: wrap(1),
}

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
  } catch {
    return null
  }
}

function alive(pid) {
  if (!pid) return false
  try {
    process.kill(pid, 0) // 信号 0：只探测存在性
    return true
  } catch (e) {
    return e.code === 'EPERM' // 存在但无权限（也算活着）
  }
}

function probe(url) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: 1200 }, (res) => {
      res.resume()
      resolve(res.statusCode === 200)
    })
    req.on('error', () => resolve(false))
    req.on('timeout', () => {
      req.destroy()
      resolve(false)
    })
  })
}

function fmtDuration(iso) {
  const ms = Date.now() - new Date(iso).getTime()
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s} 秒`
  if (s < 3600) return `${Math.floor(s / 60)} 分 ${s % 60} 秒`
  return `${Math.floor(s / 3600)} 时 ${Math.floor((s % 3600) / 60)} 分`
}

// ── status ──
async function status() {
  const st = readState()
  console.log('')
  if (!st) {
    console.log(`  ${c.yellow('●')} 服务未运行 ${c.dim('（无 .cache/serve.json）')}`)
    console.log(`\n  启动： ${c.bold('pnpm serve')}   或   ${c.bold('pnpm serve:open')} ${c.dim('（自动开浏览器）')}\n`)
    return
  }

  const ok = alive(st.pid)
  const http404ok = ok ? await probe(st.url) : false

  if (!ok) {
    console.log(`  ${c.red('●')} 状态文件残留，但进程 ${st.pid} 已不存在`)
    console.log(`     ${c.dim('执行 pnpm stop 可清理状态文件')}\n`)
    return
  }

  console.log(`  ${c.green('●')} 服务运行中`)
  console.log(`  ──────────────────────────────────────────`)
  console.log(`  地址      ${c.bold(st.url)}`)
  console.log(`  进程      PID ${st.pid}`)
  console.log(`  运行时长  ${fmtDuration(st.startedAt)}`)
  console.log(`  响应      ${http404ok ? c.green('正常') : c.yellow('进程在但 HTTP 无响应')}`)
  console.log(`  ──────────────────────────────────────────`)
  console.log(`  停止： ${c.bold('pnpm stop')}\n`)
}

// ── stop ──
//
// 实现说明：
//   · 优先用 Node 内置的 process.kill（Windows 上等价于 TerminateProcess），
//     **不依赖 taskkill** —— 外部命令在受限环境中可能被拒绝（实测 taskkill 返回 Access denied）。
//   · 发送信号后**轮询验证**进程是否真的退出，避免"报告成功但进程还在"。
//   · 只有确认已退出才删除状态文件；失败时保留，便于再次 stop 或排查。
const WAIT_MS = 3000
const POLL_MS = 150

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function stop() {
  const st = readState()
  console.log('')
  if (!st) {
    console.log(`  ${c.yellow('●')} 服务未运行，无需停止\n`)
    return
  }

  if (!alive(st.pid)) {
    console.log(`  ${c.yellow('●')} 进程 ${st.pid} 已不存在，清理状态文件`)
    try {
      fs.unlinkSync(STATE_FILE)
    } catch {
      /* 忽略 */
    }
    console.log('')
    return
  }

  console.log(`  正在停止 PID ${st.pid} …`)

  let sent = false
  try {
    process.kill(st.pid, 'SIGTERM')
    sent = true
  } catch (e) {
    if (e.code === 'ESRCH') {
      sent = true // 已经不在了
    } else {
      console.log(`  ${c.red('✗')} 无法发送终止信号：${e.code || e.message}`)
    }
  }

  // 轮询等待真正退出
  if (sent) {
    const deadline = Date.now() + WAIT_MS
    while (Date.now() < deadline && alive(st.pid)) await sleep(POLL_MS)
  }

  const gone = !alive(st.pid)

  if (gone) {
    try {
      fs.unlinkSync(STATE_FILE)
    } catch {
      /* 忽略 */
    }
    console.log(`  ${c.green('✓')} 已停止（${st.url}）\n`)
  } else {
    // 保留状态文件，便于再次 stop 或人工排查
    console.log(`  ${c.red('✗')} 停止失败：进程 ${st.pid} 仍在运行`)
    console.log(`     ${c.dim('可再次执行 pnpm stop，或手动结束该进程')}\n`)
    process.exitCode = 1
  }
}

if (cmd === 'status') await status()
else if (cmd === 'stop') await stop()
else {
  console.log(`\n  未知命令：${cmd}`)
  console.log(`  用法： node scripts/ctl.mjs [status|stop]\n`)
  process.exit(1)
}
