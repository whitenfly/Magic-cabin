// 探测：在受限环境下，Node 的 process.kill 能否终止本用户的其他 node 进程
// （taskkill 已被沙箱拒绝；process.kill 走 TerminateProcess，可能不受命名管道限制）
const pid = Number(process.argv[2])
if (!pid) {
  console.log('用法: node _probe-kill.mjs <pid>')
  process.exit(1)
}
const alive = (p) => {
  try {
    process.kill(p, 0)
    return true
  } catch (e) {
    return e.code === 'EPERM'
  }
}
console.log(`目标 PID ${pid} 存活: ${alive(pid)}`)
try {
  process.kill(pid, 'SIGTERM')
  console.log('已发送 SIGTERM')
} catch (e) {
  console.log('SIGTERM 失败:', e.code, e.message)
}
setTimeout(() => {
  console.log(`1.5 秒后存活: ${alive(pid)}`)
  process.exit(0)
}, 1500)
