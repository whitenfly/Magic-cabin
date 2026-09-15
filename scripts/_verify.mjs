// `pnpm verify` 的运行器：统一解释各校验脚本的退出码
// ============================================================================
// 退出码约定（沿用 verify-f04 / f06 既有的语义）：
//   0 = 全部通过
//   1 = 有断言失败            → 让 verify 整体失败（真正的门禁）
//   2 = 前置缺失，**明确跳过** → 不算失败（例：`.cache/` 快照或仓库外的上游源文件在 CI 上不存在）
//
// 为什么不直接在 package.json 里用 `a && b && c`：
//   exit 2 会被 `&&` 当成失败，导致「CI 上没有快照」这种**预期情况**把整条 verify 链判成红。
//   而本地（快照齐全）时每个脚本都应真跑，所以这里逐个执行、按上面的规则汇总。
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const SCRIPTS = [
  'verify-j15.mjs',
  'verify-migration.mjs',
  'verify-f02.mjs',
  'verify-f03.mjs',
  'verify-f04.mjs',
  'verify-f06.mjs',
  'verify-cf.mjs',
]

let failed = 0
const skipped = []

for (const name of SCRIPTS) {
  const file = path.join(ROOT, 'scripts', name)
  if (!fs.existsSync(file)) {
    console.error(`✗ 脚本不存在：scripts/${name}`)
    failed += 1
    continue
  }

  console.log(`\n${'═'.repeat(66)}\n▶ ${name}\n${'═'.repeat(66)}`)

  // 受限环境下拿不到子进程管道（EPERM）→ 退回 inherit：直接透传输出，用退出码判定
  let r = spawnSync(process.execPath, [file], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  if (r.status === null || r.error) {
    process.stdout.write('（受限环境：改为直通输出模式）\n')
    r = spawnSync(process.execPath, [file], { cwd: ROOT, stdio: 'inherit' })
  } else {
    if (r.stdout) process.stdout.write(r.stdout)
    if (r.stderr) process.stderr.write(r.stderr)
  }

  const code = r.status ?? 1
  if (code === 0) continue
  if (code === 2) {
    skipped.push(name)
    continue
  }
  failed += 1
}

console.log(`\n${'═'.repeat(66)}`)
if (skipped.length) {
  console.log(`⚠ 跳过 ${skipped.length} 个脚本（前置缺失，不算失败）：${skipped.join('、')}`)
  console.log('  本地补齐快照 / 上游源文件后即可真正执行，详见各脚本的跳过提示。')
}
if (failed) {
  console.error(`✗ verify 失败：${failed} 个脚本有断言未通过\n`)
  process.exit(1)
}
console.log(`✓ verify 通过（${SCRIPTS.length - skipped.length} 个脚本全过，${skipped.length} 个跳过）\n`)
