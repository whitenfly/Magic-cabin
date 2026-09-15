/**
 * J3 搬迁应用器 —— `monolith.js` 与 `layout.js` 的**唯一写者**
 *
 * 来源：新增（`J3`）。为什么需要它（而不是每件物件手改 monolith）：
 *
 *   67 件物件要改同一个文件（`legacy/monolith.js`），手改 67 次的风险是
 *   "改错边界、漏删一行、把两段接错"——而像素回归只会说"不一样"，
 *   不会说"你在第 3412 行少删了一个 `}`"。J2 的经验是**脚本化改写 + 自检**：
 *   在写盘**之前**把结构校验做完。
 *
 * ## 分工
 *
 * ```
 *   子代理/人：读分区 → 写 src/cabin/world/<层>/<名字>.js（各自的文件，互不冲突）
 *              + 写 scripts/oneoff/_j3-specs/<id>.json（边界与依赖的声明）
 *        │
 *        ▼  本脚本（唯一写者，串行）
 *   legacy/monolith.js   把 [startMarker, endMarker) 换成一次 installProp(...)
 *                        + 在 import 区补一行 import
 *   world/layout.js      把 spec 里声明的坐标常量补进「J3 搬迁新增」区块
 * ```
 *
 * ## 用法
 *
 * ```bash
 * node scripts/oneoff/_j3-apply.mjs                 # 应用全部未应用的 spec
 * node scripts/oneoff/_j3-apply.mjs --dry-run        # 只报告将要做什么，不写盘
 * node scripts/oneoff/_j3-apply.mjs --only=<id>      # 只应用一个
 * node scripts/oneoff/_j3-apply.mjs --check          # 自检：spec 与磁盘是否一致
 * ```
 *
 * ## 自检项（任一不满足即**不写盘**）
 *
 * · `startMarker` 在 monolith 中**恰好出现一次**（出现 0 次 = 已搬或写错；≥2 次 = 边界不唯一）
 * · `endMarker` 在 startMarker **之后**，且恰好出现一次
 * · 该区间**非空**（空区间 = 边界写反了）
 * · prop 文件存在，且确实 `export default defineProp(`、`id` 与 spec 一致
 * · prop 文件没有把已被搬走的段重复实现（区间外不得再出现同名分区注释）
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '../..')
const MONOLITH = path.join(ROOT, 'src/cabin/legacy/monolith.js')
const LAYOUT = path.join(ROOT, 'src/cabin/world/layout.js')
const SPEC_DIR = path.join(ROOT, 'scripts/oneoff/_j3-specs')

const argv = process.argv.slice(2)
const DRY = argv.includes('--dry-run')
const CHECK = argv.includes('--check')
const onlyArg = argv.find((a) => a.startsWith('--only='))
const ONLY = onlyArg ? onlyArg.slice('--only='.length) : null

/** 装配调用行的缩进（monolith IIFE 内是 12 空格） */
const IND = '            '

const specs = fs.existsSync(SPEC_DIR)
  ? fs.readdirSync(SPEC_DIR).filter((f) => f.endsWith('.json')).map((f) => ({ file: f, ...JSON.parse(fs.readFileSync(path.join(SPEC_DIR, f), 'utf8')) }))
  : []

if (!specs.length) {
  console.log(`\n没有 spec（${path.relative(ROOT, SPEC_DIR)} 为空）。先让搬迁方写出 <id>.json。\n`)
  process.exit(0)
}

const todo = ONLY ? specs.filter((s) => s.id === ONLY) : specs
if (ONLY && !todo.length) {
  console.error(`\n--only=${ONLY} 没有匹配的 spec\n`)
  process.exit(1)
}

let mono = fs.readFileSync(MONOLITH, 'utf8')
let layout = fs.readFileSync(LAYOUT, 'utf8')

const problems = []
const applied = []
const already = []
const newImports = []

/** 找出标记行的**行首下标**（确保匹配的是整行） */
function lineIndexOf(text, marker) {
  const needle = `\n${marker}`
  const hits = []
  let from = 0
  for (;;) {
    const i = text.indexOf(needle, from)
    if (i === -1) break
    hits.push(i + 1) // 跳过 \n，指向行首
    from = i + 1
  }
  return hits
}

for (const spec of todo) {
  const where = `[${spec.id}]`
  const missing = ['id', 'name', 'file', 'startMarker', 'endMarker'].filter((k) => !spec[k])
  if (missing.length) { problems.push(`${where} spec 缺字段：${missing.join(' / ')}`); continue }

  const propPath = path.join(ROOT, spec.file)
  if (!fs.existsSync(propPath)) { problems.push(`${where} 物件文件不存在：${spec.file}`); continue }

  const propSrc = fs.readFileSync(propPath, 'utf8')
  if (!propSrc.includes('export default defineProp(')) {
    problems.push(`${where} ${spec.file} 里没有 \`export default defineProp(\``)
    continue
  }
  if (!new RegExp(`id:\\s*'${spec.id.replace(/[/\\^$*+?.()|[\]{}]/g, '\\$&')}'`).test(propSrc)) {
    problems.push(`${where} ${spec.file} 的 id 与 spec 不一致（应为 '${spec.id}'）`)
    continue
  }

  // 已应用？—— 装配调用已在场。
  // ⚠️ 判定用**不带缩进**的子串：有的物件写成 `const xxxApi = installProp(xxx);`
  //    （需要在别处调用 `xxxApi.tick()`），那种写法也必须被判为"已应用"，
  //    否则重跑一次就会把 `const xxxApi = ` 前缀删掉，让 `.tick()` 变成未定义引用。
  if (mono.includes(`installProp(${spec.name})`)) { already.push(spec.id); continue }

  const starts = lineIndexOf(mono, spec.startMarker)
  if (starts.length !== 1) {
    problems.push(`${where} startMarker 在 monolith 中出现 ${starts.length} 次（必须恰好 1 次）`)
    continue
  }
  const startAt = starts[0]
  const endCandidates = lineIndexOf(mono.slice(startAt), spec.endMarker).map((i) => i + startAt)
  if (endCandidates.length !== 1) {
    problems.push(`${where} endMarker 在 startMarker 之后出现 ${endCandidates.length} 次（必须恰好 1 次）`)
    continue
  }
  const endAt = endCandidates[0]

  const startLineEnd = mono.indexOf('\n', startAt)
  const body = mono.slice(startLineEnd, endAt)
  const bodyLines = body.split('\n').filter((l) => l.trim())
  if (!bodyLines.length) { problems.push(`${where} 区间为空（startMarker 与 endMarker 相邻？）`); continue }

  // 自检：该段里不应再出现"另一个待搬分区"的注释（边界写太宽会吞掉别的物件）
  const otherMarkers = specs
    .filter((s) => s.id !== spec.id)
    .map((s) => s.startMarker)
    .filter((m) => body.includes(m))
  if (otherMarkers.length) {
    problems.push(`${where} 区间吞掉了别的分区：${otherMarkers.map((m) => m.trim()).join(' | ')}`)
    continue
  }

  // `assign` 存在时写成 `const xxxApi = installProp(xxx);` —— 供有每帧逻辑的物件
  // 在 `tickOnce()` 里写 `xxxApi.tick(dt, time)`（见 installProp.js 的"原地 tick"）。
  const callExpr = spec.assign
    ? `const ${spec.assign} = installProp(${spec.name});`
    : `installProp(${spec.name});`
  const replaceWith =
    `${spec.startMarker}\n` +
    `${IND}// J3（${spec.batch || '搬迁'}）：几何已搬入 ${spec.file.replace(/\\/g, '/')}，此处只留装配调用。\n` +
    `${IND}${callExpr}\n`

  mono = mono.slice(0, startAt) + replaceWith + mono.slice(endAt)
  newImports.push(spec)
  applied.push({ id: spec.id, removed: bodyLines.length - 1, file: spec.file })
}

// import 区：锚在 installProp 的 import 之后
if (newImports.length) {
  const anchor = "import { createPropInstaller } from '../app/installProp.js'"
  if (!mono.includes(anchor)) {
    problems.push('找不到 import 锚点（createPropInstaller 那一行）')
  } else {
    const lines = newImports
      .filter((s) => !mono.includes(`import ${s.name} from `))
      .map((s) => `import ${s.name} from '${s.rel || '../world/' + s.file.replace(/^src\/cabin\/world\//, '').replace(/\.js$/, '')}.js'`)
    if (lines.length) mono = mono.replace(anchor, [anchor, ...lines].join('\n'))
  }
}

// layout.js：把 spec 声明的坐标常量补进「J3 搬迁新增」区块
const layoutAdds = todo.flatMap((s) => (s.layout || []).map((c) => ({ ...c, from: s.id })))
if (layoutAdds.length) {
  const BLOCK_ANCHOR = '  /* ══════════ J3 搬迁新增 ══════════ */'
  const fresh = layoutAdds.filter((c) => !new RegExp(`\\bconst ${c.name}\\b`).test(layout))
  if (fresh.length) {
    const decls = fresh.map((c) => `  /** ${c.doc || ''}（${c.from}） */\n  const ${c.name} = ${c.value}`).join('\n')
    if (layout.includes(BLOCK_ANCHOR)) {
      layout = layout.replace(BLOCK_ANCHOR, `${BLOCK_ANCHOR}\n${decls}`)
    } else {
      layout = layout.replace('\n  return {', `\n${BLOCK_ANCHOR}\n${decls}\n\n  return {`)
    }
    // return 表里补上名字
    const names = fresh.map((c) => c.name)
    layout = layout.replace(/\n  \}\n\}\n$/, (m) => {
      return `\n    // J3 搬迁新增\n    ${names.join(', ')},\n  }\n}\n`
    })
  }
}

console.log('\nJ3 搬迁应用器')
console.log('─'.repeat(60))
if (applied.length) {
  console.log(`将应用 ${applied.length} 件：`)
  for (const a of applied) console.log(`  · ${a.id.padEnd(32)} 删 ${String(a.removed).padStart(4)} 行  →  ${a.file}`)
}
if (already.length) console.log(`已应用（跳过）：${already.join(' / ')}`)
if (!applied.length && !problems.length) console.log('没有需要应用的内容。')

if (problems.length) {
  console.log(`\n✗ ${problems.length} 项自检不通过（**未写盘**）：`)
  for (const p of problems) console.log(`  · ${p}`)
  console.log('')
  process.exit(1)
}

if (CHECK) {
  console.log('\n--check：自检通过，未写盘。\n')
  process.exit(0)
}

if (DRY) {
  console.log('\n--dry-run：自检通过，未写盘。\n')
  process.exit(0)
}

fs.writeFileSync(MONOLITH, mono, 'utf8')
fs.writeFileSync(LAYOUT, layout, 'utf8')
console.log(`\n✓ 已写盘：${path.relative(ROOT, MONOLITH)} / ${path.relative(ROOT, LAYOUT)}`)
console.log(`  monolith 现在 ${mono.split('\n').length} 行\n`)
