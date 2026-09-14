// F0.x 系列校验脚本的**共享环境探测**（verify-f02 / f03 / f04 / f06 / migration）
// ============================================================================
// 存在的理由：这些脚本原先各自硬编码了作者本机的绝对路径，导致两类问题在 CI 上必现：
//
//   ① `ROOT` 写成 `D:/FireflyQAQ/Project/FrontProj/Magic-cabin` —— 换机器 / 进 CI 直接失效；
//   ② `SRC` 指向**仓库外**的上游解压目录
//      （`../line-art-style-magic-cabin-main/index.html`）—— 它不在版本库里，CI 上必然缺失，
//      于是 readFileSync 抛 ENOENT，整个 `pnpm verify` 链断在半截。
//
// 本模块把这两件事收敛到一处：
//   · 路径一律由 `import.meta.url` 推导（谁都不再依赖本机目录结构）；
//   · 缺依赖时给出**可执行的提示**并明确「跳过」，而不是一句 ENOENT
//     —— 沿用 `verify-f04.mjs` 已有的 exit 2 语义：0 = 全过，1 = 有断言失败，2 = 前置缺失（跳过）。
//   · 上游源文件可用 `MAGIC_CABIN_SRC` 覆盖；缺失时自动尝试**同级目录**的常见解压名。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** 仓库根（本文件在 scripts/ 下） */
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** 未提交的中间快照目录（.gitignore） */
export const CACHE = path.join(ROOT, '.cache')

/** 常见提示：让跳过不是"静默略过"，而是给出一条能照做的命令 */
export const SKIP_HINT = `  在 CI 上这是**预期**行为（该目录不进版本库），本地则可这样补齐：`

/**
 * 解析上游源文件（单文件版 index.html）。
 * @returns {{ path: string, text: string } | null} 缺失返回 null
 */
export function resolveUpstream() {
  const candidates = [
    process.env.MAGIC_CABIN_SRC, // ① 显式覆盖优先
    path.resolve(ROOT, '../line-art-style-magic-cabin-main/index.html'), // ② 同级解压目录（本机）
    path.resolve(ROOT, '../line-art-style-magic-cabin/index.html'), // ③ 同级克隆目录
  ].filter(Boolean)

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return { path: candidate, text: fs.readFileSync(candidate, 'utf8') }
  }
  return null
}

/**
 * 检查前置文件是否齐全；缺失则打印可执行提示并以 exit 2 退出（= 跳过，不算失败）。
 * @param {{ src?: boolean, files?: string[] }} need
 */
export function requireEnv({ src = false, files = [] } = {}) {
  const missing = files.filter((f) => !fs.existsSync(f))
  const srcMissing = src && !resolveUpstream()

  if (missing.length === 0 && !srcMissing) return

  const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/')
  console.error('\n✗ 前置缺失，本脚本跳过（exit 2）')
  for (const f of missing) console.error(`  · 快照缺失：${rel(f)}`)
  if (srcMissing) console.error('  · 上游源文件缺失：../line-art-style-magic-cabin-main/index.html')
  console.error(SKIP_HINT)
  if (srcMissing) {
    console.error('    解压上游「线稿风格魔法小屋」单文件版到本仓库同级目录，或显式指定：')
    console.error('    $env:MAGIC_CABIN_SRC="<...>/index.html"   # PowerShell')
    console.error('    export MAGIC_CABIN_SRC="<...>/index.html" # bash')
  }
  if (missing.length) {
    console.error('    快照由 scripts/oneoff/ 下的冻结脚本产出，或直接跑一次对应的 verify 脚本按提示重建。')
  }
  console.error('')
  process.exit(2)
}
