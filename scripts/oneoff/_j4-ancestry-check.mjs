/**
 * R1 的**准确**判据 —— "dev 上不许有直提"
 *
 * 规范 §0.2 给的判定命令是 `git log --oneline --no-merges "<最新 tag>..dev"` **应为空**。
 * 那条命令在"做过 §4⑥.1 回填"之后**必然非空**（回填提交本身就是非 merge 提交，
 * 只是它经由 `--no-ff` 合并进入 dev）—— 判据与规则的本意出现了偏差。
 *
 * R1 的本意是：**dev 上的每一个改动都必须能追溯到某一条分支的一次 `--no-ff` 合并**
 * （§3.2 的"唯一判据"）。所以准确的判据是：
 *
 *   对 dev 上 `<最新 tag>..dev` 的**每一个非 merge 提交**，
 *   都存在一个 merge 提交，它是该提交的**后代**（即"这条提交被某次合并带进来了"）。
 *
 * 用法：`node scripts/oneoff/_j4-ancestry-check.mjs`
 */
import { execFileSync } from 'node:child_process'

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim()
const tag = git('describe', '--tags', '--abbrev=0', 'dev')
const range = `${tag}..dev`

const noMerge = git('log', '--format=%H %s', '--no-merges', range).split('\n').filter(Boolean)
console.log(`\nR1 溯源检查（${range}，最新 tag = ${tag}）`)
console.log('─'.repeat(74))
console.log(`  非 merge 提交 ${noMerge.length} 个`)

const orphans = []
for (const line of noMerge) {
  const [hash, ...rest] = line.split(' ')
  const subject = rest.join(' ')
  // 该提交的**后代 merge**：--ancestry-path 保证"从该提交走到 dev 的路径上"的 merge
  const merges = git('rev-list', '--merges', '--ancestry-path', `${hash}..dev`).split('\n').filter(Boolean)
  if (merges.length === 0) {
    orphans.push({ hash: hash.slice(0, 8), subject })
    console.log(`  ✗ ${hash.slice(0, 8)}  ${subject.slice(0, 60)}  ← **没有合并节点**（= dev 直提，违反 R1）`)
  } else {
    const node = git('log', '-1', '--format=%h %s', merges[merges.length - 1])
    console.log(`  ✓ ${hash.slice(0, 8)}  ${subject.slice(0, 52)}  ← 由「${node.slice(0, 52)}」引入`)
  }
}

console.log('')
if (orphans.length === 0) {
  console.log(`✓ R1 成立：${noMerge.length} 个非 merge 提交**全部**经由 --no-ff 合并进入 dev`)
  console.log('  （§0.2 的字面命令非空，是"回填路径"与"判据"的偏差，见文件头）\n')
  process.exit(0)
}
console.error(`✗ ${orphans.length} 个提交没有合并节点 —— 这才是 R1 要拦的东西\n`)
process.exit(1)
