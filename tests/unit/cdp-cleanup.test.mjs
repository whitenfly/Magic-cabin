/**
 * `J4.49` 单元测试 —— `cdp.mjs` 的回收逻辑
 *
 * ## 为什么这几条必须有
 *
 * 实测事故：跑判据时 `chrome.exe` 留下 **4 个孤儿进程**（两个 `--type=gpu-process
 * --headless=new --use-angle=swiftshader` 的 SwiftShader 进程，累计 CPU 达 4295s / 1809s），
 * `%TEMP%` 里积了 **360 个 `cabin-cdp-*` 目录**（≈6 GB）。
 *
 * 两个根因都**不是"忘了删"**，而是"删的方式不对"，所以必须用**可断言的行为**钉住：
 *
 * 1. `proc.kill()` 只杀 root ⇒ Chrome 的 `gpu-process` / `crashpad-handler` 成孤儿。
 *    ⇒ 用"父进程 + 孙进程"模拟 root 与 gpu-process，断言**孙进程也必须死**。
 * 2. `proc.kill()` 是异步的，紧接着 `rmSync` 撞上未释放的句柄 ⇒ 静默失败、目录留下。
 *    ⇒ 断言 `removeProfileDir` 对**非空目录**返回 true 且确实删掉，且对不存在的路径也返回 true。
 *
 * ⚠️ 这里**不需要真的起 Chrome** —— 当前沙箱（`workspace-write`）下 Chrome 起不来
 *   （实测：连手工用 `Start-Process` 拉起都立即退出），所以"跑一次判据看残留"在受限环境里
 *   不可用；这两条单测覆盖的正是**与 Chrome 无关的那部分逻辑**。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { killTree, removeProfileDir } from '../e2e/cdp.mjs'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** 进程是否还活着；`EPERM` = 存在但无权限（仍算活着），`ESRCH` = 已不存在 */
function isAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return e.code === 'EPERM'
  }
}

test('killTree 连带杀掉**孙进程**（Chrome 的 gpu-process 正是这样漏掉的）', async () => {
  // 父进程（= Chrome root）自己常驻，并 spawn 一个常驻子进程（= gpu-process）。
  // ⚠️ 全程 `stdio: 'ignore'`：受限环境下**管道 stdio 会被拒（EPERM）**，
  //   所以孙进程的 pid 走**临时文件**回传，而不是 `stdout: 'pipe'`。
  const pidFile = path.join(os.tmpdir(), `cabin-cdp-test-pid-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`)
  const script =
    "const fs=require('node:fs');const{spawn}=require('node:child_process');" +
    "const c=spawn(process.execPath,['-e','setTimeout(()=>{},60000)'],{stdio:'ignore'});" +
    `fs.writeFileSync(${JSON.stringify(pidFile)},String(c.pid));` +
    'setTimeout(()=>{},60000);'
  const root = spawn(process.execPath, ['-e', script], { stdio: 'ignore' })

  let grandPid = 0
  for (let i = 0; i < 60; i++) {
    if (fs.existsSync(pidFile)) {
      grandPid = Number(fs.readFileSync(pidFile, 'utf8').trim())
      break
    }
    await sleep(150)
  }
  fs.rmSync(pidFile, { force: true })

  assert.ok(grandPid > 0, '没能拿到孙进程 pid（子进程可能没起来）')
  assert.equal(isAlive(root.pid), true, '前提：root 活着')
  assert.equal(isAlive(grandPid), true, '前提：孙进程活着')

  killTree(root)
  await sleep(2500)

  assert.equal(isAlive(root.pid), false, 'root 应被杀掉')
  assert.equal(isAlive(grandPid), false, '★ 孙进程也必须被杀掉（只杀 root 就会漏成孤儿）')
})

test('killTree 对已经退出的进程是安全的（不抛异常）', async () => {
  const p = spawn(process.execPath, ['-e', 'process.exit(0)'], { stdio: 'ignore' })
  await new Promise((r) => p.on('exit', r))
  await sleep(200)
  assert.doesNotThrow(() => killTree(p))
  assert.doesNotThrow(() => killTree(null))
})

test('removeProfileDir 删掉**非空**目录并返回 true', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cabin-cdp-test-'))
  fs.writeFileSync(path.join(dir, 'a.txt'), 'x')
  fs.mkdirSync(path.join(dir, 'sub'))
  fs.writeFileSync(path.join(dir, 'sub', 'b.txt'), 'y')

  assert.equal(removeProfileDir(dir), true, '应返回 true')
  assert.equal(fs.existsSync(dir), false, '目录必须真的没了')
})

test('removeProfileDir 对不存在的路径返回 true（幂等，收尾路径不许抛）', () => {
  const ghost = path.join(os.tmpdir(), 'cabin-cdp-definitely-not-here-' + Date.now())
  assert.equal(fs.existsSync(ghost), false)
  assert.equal(removeProfileDir(ghost), true)
})
