/**
 * J4 状态副本同步器 —— 把 `v0.4.0-dev.N` 一次推到**全部六处**
 *
 * 来源：新增（`J4.2`）。规范 §5.3 规定阶段状态在**五处**各有一份（外加 `package.json` 的
 * `version`，R9 要求它与最新 dev tag 一致），而历史上**多次漏同步** —— 判例 **P4** 就是这么来的：
 * 「路线图章节标题长期停在 ⬜、与总表的 🟡 不一致」，第 5 处则完全不在旧清单里。
 *
 * 漏同步之所以反复发生，是因为"记住改五处"本身就是个不可靠的判据。
 * 本脚本把它换成两条可执行的判据：
 *
 *   · `--check`：**六处必须写着同一个 dev.N**，不一致就逐处报出来（非零退出）；
 *   · 带序号运行时：一次改完六处，并复跑自检。
 *
 * ## 为什么不直接全局替换 `v0.4.0-dev.N`
 *
 * `docs/VERSIONING.md` 的**正文**里还有 5 处 `v0.4.0-dev.1`（§2.4 序列规则、§4④ 示例、
 * §4⑦ 推送示例、§11 `--base` 速查、§9.2 状态判定表）—— 那些是**规则的示例**，
 * 把它们跟着改会篡改规范。所以本脚本按**行前缀**精确定位六处，一处不多一处不少。
 *
 * 用法：
 * ```bash
 * node scripts/oneoff/_j4-dev-sync.mjs --check      # 只自检（六处是否一致）
 * node scripts/oneoff/_j4-dev-sync.mjs 2            # 同步到 v0.4.0-dev.2
 * ```
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '../..')
const CHECK = process.argv.includes('--check')
const N = process.argv.slice(2).find((a) => /^\d+$/.test(a))

/**
 * 六处状态副本。`match` 判据是**行前缀/整行形态**，不是"文件里出现过" ——
 * 后者会把规范正文里的示例一起改掉。
 */
const TARGETS = [
  {
    file: 'package.json',
    label: 'package.json 的 version（R9）',
    match: (l) => l.trimStart().startsWith('"version"'),
    rewrite: (l, tag) => l.replace(/"version":\s*"[^"]+"/, `"version": "${tag.replace(/^v/, '')}"`),
  },
  {
    file: 'docs/VERSIONING.md',
    label: '§5.4 版本历史表（第 1 处）',
    match: (l) => l.startsWith('| `0.4.0` |'),
    rewrite: (l, tag) => l.replace(/v0\.4\.0-dev\.\d+/g, tag),
  },
  {
    file: 'README.md',
    label: 'README 顶部「当前稳定版 / 任务快照」（第 2 处）',
    match: (l) => l.includes('本阶段任务快照'),
    rewrite: (l, tag) => (/v0\.4\.0-dev\.\d+/.test(l) ? l.replace(/v0\.4\.0-dev\.\d+/g, tag) : l.replace(/(本阶段任务快照\s*)`/, `$1\`${tag}\``)),
  },
  {
    file: 'docs/BuildPlaning/01-完善路线图.md',
    label: '路线图「阶段总表」J4 行（第 3 处）',
    match: (l) => l.startsWith('| **J4** | 系统模块化'),
    rewrite: (l, tag) => l.replace(/v0\.4\.0-dev\.\d+/g, tag),
  },
  {
    file: 'docs/BuildPlaning/01-完善路线图.md',
    label: '路线图「阶段章节标题」J4（第 4 处，最易漏）',
    match: (l) => l.startsWith('### J4 · 系统模块化'),
    rewrite: (l, tag) => l.replace(/v0\.4\.0-dev\.\d+/g, tag),
  },
  {
    file: 'docs/BuildPlaning/01-完善路线图.md',
    label: '路线图「执行顺序状态表」J4 行（第 5 处）',
    match: (l) => /^\|\s*7\s*\|.*启动 `J4`/.test(l),
    rewrite: (l, tag) => l.replace(/v0\.4\.0-dev\.\d+/g, tag),
  },
]

/** 读一处，返回 { file, label, lineNo, text, tag } */
function readOne(t) {
  const p = path.join(ROOT, t.file)
  if (!fs.existsSync(p)) return { ...t, error: `文件不存在：${t.file}` }
  const lines = fs.readFileSync(p, 'utf8').split('\n')
  const i = lines.findIndex((l) => t.match(l))
  if (i === -1) return { ...t, error: `找不到目标行（判据：${t.label}）` }
  const tag = (lines[i].match(/v0\.4\.0-dev\.\d+/) || lines[i].match(/"version":\s*"([^"]+)"/) || [])[0]
  return { ...t, file: t.file, lineNo: i + 1, text: lines[i], tag: String(tag).replace(/"/g, '').replace('version: ', '') }
}

const cur = TARGETS.map(readOne)
const errs = cur.filter((c) => c.error)

console.log('\nJ4 状态副本同步器')
console.log('─'.repeat(74))
for (const c of cur) {
  if (c.error) console.log(`  ✗ ${c.label}\n      ${c.error}`)
  else console.log(`  · ${c.label}\n      ${c.file}:${c.lineNo}  →  ${c.tag}`)
}

if (errs.length) {
  console.error(`\n✗ ${errs.length} 处定位失败（判据可能已被改写）\n`)
  process.exit(1)
}

// ⚠️ 比较前必须**归一化掉 `v` 前缀**：`package.json` 的 `version` 是 `0.4.0-dev.2`（不带 v），
//    而 tag 是 `v0.4.0-dev.2` —— 两者本来就该差一个 `v`，直接比会永远报"不一致"（实测踩过）。
const norm = (t) => String(t).replace(/^v/, '')
const tags = new Set(cur.map((c) => norm(c.tag)))
if (CHECK || !N) {
  if (tags.size === 1) {
    console.log(`\n✓ 六处一致：v${[...tags][0]}（package.json 记 0.4.0-dev.N，其余记 v0.4.0-dev.N）\n`)
    process.exit(0)
  }
  console.error(`\n✗ **六处不一致**（判例 P4 的复发形态）：${[...tags].sort().join(' / ')}`)
  console.error('  修法：node scripts/oneoff/_j4-dev-sync.mjs <N>\n')
  process.exit(1)
}

const TAG = `v0.4.0-dev.${N}`
let changed = 0
for (const t of TARGETS) {
  const p = path.join(ROOT, t.file)
  const lines = fs.readFileSync(p, 'utf8').split('\n')
  const i = lines.findIndex((l) => t.match(l))
  const next = t.rewrite(lines[i], TAG)
  if (next !== lines[i]) {
    lines[i] = next
    fs.writeFileSync(p, lines.join('\n'), 'utf8')
    changed++
    console.log(`  ✓ ${t.file}:${i + 1}  →  ${TAG}`)
  }
}
console.log(`\n改动 ${changed} 处。复跑自检：node scripts/oneoff/_j4-dev-sync.mjs --check`)
console.log('⚠ 各处的**任务描述文字**（"已完成 `J4.x`"）仍需人工更新 —— 脚本只管版本号。\n')
