/**
 * `J4.7` 帧任务生成器 —— 把 `tickOnce()` 的 719 行切成"按原顺序登记的帧任务"
 *
 * 来源：新增（`J4.7`）。`J4` 阶段的最后一件实事：
 * **`animate()` 收缩为调度骨架**（DoD：≤ 60 行、更新顺序由 `UpdateScheduler` 决定、
 * 25 处原地 `.tick(dt, time)` 全部清零）。
 *
 * ## 为什么不能用 `--move` 直接搬
 *
 * 其余 20 个段都是"纯剪切"（代码一个字不改）。`tick` 段不行：它必须**换一种存在形式** ——
 * 从"一个被 `animate()` 直接调用的 719 行函数"变成"一组登记进调度器的帧任务"。
 *
 * ## 切分规则（唯一的硬约束是跨语句变量依赖）
 *
 * `_j4-tick-analyze.mjs` 量出：113 条顶层语句里，只有 **11 个名字**被后续语句引用
 * （`time` / `dt` + 9 个"相邻两语句成对"的局部量，如 `pe`→`#57`、`ee`→`#61`）。
 * 于是：
 *
 *   1. **`time` / `dt`** → 由调度器作为 `(dt, time)` 参数传入（原声明语句删掉）；
 *   2. **其余成对量** → 切分时**把语句并进同一组**（遇到"声明的名字被后续引用"就不切）；
 *   3. 组序 = 原语句顺序 —— 这一步不能变：`rng` 调用顺序、`scene.add` 顺序都压在它上面。
 *
 * ## 25 处原地 `.tick()` 怎么清零
 *
 * `installProp()` 会把自己的 `update` 登记进调度器，但**登记顺序是装配顺序**，
 * 而帧任务的顺序必须是**原 `tickOnce()` 的执行顺序** —— 两者不同。
 * 所以本脚本：
 *   · 先把 `installProp()` 自动登记的那些任务**撤销**（`scheduler.remove`）；
 *   · 再按 `tickOnce()` 里的原位置，把每个物件的 `tick` 作为**帧任务**登记。
 * 于是 monolith 里不再有任何 `<xxx>Api.tick(dt, time);` —— 它们变成了调度器的任务。
 *
 * 用法：
 * ```bash
 * node scripts/oneoff/_j4-frame.mjs --dry-run
 * node scripts/oneoff/_j4-frame.mjs
 * ```
 */
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const ROOT = path.resolve(import.meta.dirname, '../..')
const MONOLITH = path.join(ROOT, 'src/cabin/legacy/monolith.js')
const OUT = path.join(ROOT, 'src/cabin/app/scene/FrameBody.js')
const DRY = process.argv.includes('--dry-run')
const IND = '            '

const src = fs.readFileSync(MONOLITH, 'utf8')
const program = ts.createProgram([MONOLITH], {
  allowJs: true, checkJs: false, target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext, noResolve: true, skipLibCheck: true,
})
const sf = program.getSourceFile(MONOLITH)
const checker = program.getTypeChecker()
const lineOf = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1

// ── 定位 tick 段 ───────────────────────────────────────────────────────────
const lines = src.split('\n')
const segStart = lines.findIndex((l) => l.includes('[J4:seg tick]'))
if (segStart === -1) { console.error('找不到 [J4:seg tick] 标记'); process.exit(1) }
let segEnd = lines.length
for (let i = segStart + 1; i < lines.length; i++) if (/\[J4:seg [\w-]+\]/.test(lines[i])) { segEnd = i; break }

let fn = null
const find = (n) => {
  if (ts.isFunctionDeclaration(n) && n.name?.text === 'tickOnce') fn = n
  return ts.forEachChild(n, find)
}
find(sf)
if (!fn) { console.error('找不到 tickOnce'); process.exit(1) }

const stmts = fn.body.statements
const declsOf = (st) => {
  const out = []
  if (ts.isVariableStatement(st)) {
    for (const d of st.declarationList.declarations) {
      if (ts.isIdentifier(d.name)) out.push(d.name.text)
      else for (const el of d.name.elements) if (ts.isIdentifier(el.name)) out.push(el.name.text)
    }
  } else if (ts.isFunctionDeclaration(st) && st.name) out.push(st.name.text)
  return out
}
const declSet = new Map()
stmts.forEach((st, i) => { for (const n of declsOf(st)) if (!declSet.has(n)) declSet.set(n, i) })

const refsOf = (st) => {
  const out = new Set()
  const walk = (n) => {
    if (ts.isIdentifier(n)) {
      const p = n.parent
      const skip =
        (ts.isPropertyAccessExpression(p) && p.name === n) ||
        (ts.isPropertyAssignment(p) && p.name === n) ||
        (ts.isVariableDeclaration(p) && p.name === n) ||
        (ts.isBindingElement(p) && p.name === n) ||
        (ts.isParameter(p) && p.name === n) ||
        (ts.isFunctionDeclaration(p) && p.name === n)
      if (!skip && declSet.has(n.text)) {
        const sym = checker.getSymbolAtLocation(n)
        const d = sym?.declarations?.[0]
        if (d && d.getSourceFile() === sf && d.name && ts.isIdentifier(d.name) && declSet.has(d.name.text)) out.add(n.text)
      }
    }
    ts.forEachChild(n, walk)
  }
  walk(st)
  return out
}
const refsCache = stmts.map(refsOf)

// 开头两条声明 `const time = clock.now;` / `const dt = clock.dt;` → 由调度器参数提供，跳过
//
// ⚠️ 它们是**两条**独立的 `VariableStatement`（`const a = 1; const b = 2;` 在 AST 里是两个节点）。
//    第一版按"一条语句"匹配，判据永远不成立、skip 恒为 false —— 后果是 time/dt 被当成普通声明
//    留在第一个帧任务里，**其余 101 个任务全都拿不到它们**。
const txt = (st) => st.getText(sf).trim()
let skipCount = 0
if (/^const\s+time\s*=\s*clock\.now;?$/.test(txt(stmts[0]))) skipCount++
if (skipCount < stmts.length && /^const\s+dt\s*=\s*clock\.dt;?$/.test(txt(stmts[skipCount]))) skipCount++
const body = stmts.slice(skipCount)
if (skipCount < 2) console.warn(`⚠ 只跳过了 ${skipCount} 条 time/dt 声明 —— 请人工确认它们的来源`)

// ── 分组：声明的名字被后续引用 ⇒ 不在这里切 ────────────────────────────────
const groups = []
let cur = []
body.forEach((st, k) => {
  const i = k + skipCount
  cur.push({ st, i })
  const decls = declsOf(st)
  const usedLater = decls.some((d) => {
    for (let j = i + 1; j < stmts.length; j++) if (refsCache[j].has(d)) return true
    return false
  })
  if (!usedLater) { groups.push(cur); cur = [] }
})
if (cur.length) groups.push(cur)

// ── 生成 ───────────────────────────────────────────────────────────────────
const tasks = []
const props = []
groups.forEach((g, gi) => {
  const from = g[0].i
  const to = g[g.length - 1].i
  const code = g.map((x) => src.slice(x.st.getStart(sf), x.st.getEnd())).join('\n')
  // 25 处原地 tick：`ctx.<api>.tick(dt, time);` → 作为帧任务登记（见文件头）
  const m = /^\s*ctx\.(\w+)\.tick\(dt, time\);?\s*$/.exec(code)
  const name = m ? `prop/${m[1].replace(/Api$/, '')}` : `frame/${String(gi).padStart(2, '0')}`
  if (m) props.push(m[1])
  tasks.push({ name, code, from: lineOf(g[0].st), to: lineOf(g[g.length - 1].st), lines: to - from + 1 })
})

const out = `/**
 * 每帧任务登记 —— \`tickOnce()\` 的 719 行按**原执行顺序**切成 ${groups.length} 个帧任务
 *
 * 来源：\`J4.7\`（由 \`scripts/oneoff/_j4-frame.mjs\` 生成，段表见 \`_j4-segments.mjs\`）。
 *
 * ★ **顺序就是语义**。原来 \`animate()\` 直接调 \`tickOnce()\`，716 行从上往下跑；
 *   现在它们变成 ${groups.length} 个登记进 \`UpdateScheduler\` 的任务，**登记顺序 = 原执行顺序**
 *   （\`rng\` 调用顺序、\`scene.add\` 顺序、\`lightField.register\` 槽序都压在它上面）。
 *   切分点只取"声明的名字不被后续语句引用"的语句之后 —— 判据见 \`_j4-tick-analyze.mjs\`。
 *
 * ★ **25 处原地 \`.tick(dt, time)\` 在这里清零**（monolith 里一处不剩）：\`installProp()\` 也把
 *   物件的 \`update\` 登记进了同一个调度器，但那个顺序是**装配顺序**，与帧任务的顺序不同 ——
 *   所以下面先把自动登记的那些**撤销**，再按原位置重新登记。
 *
 * @param {object} ctx 段间通信载体
 * @param {object} app 应用内核（\`scheduler\` 从这里取）
 */
${/\bclock\b/.test(tasks.map((t) => t.code).join('\n')) ? "import { clock } from '../clock.js'\n\n" : ''}export function installFrameBody(ctx, app) {
  const { scheduler } = app

  // ① 撤销 installProp() 的自动登记 —— 它的顺序是装配顺序，不是帧顺序
  for (const rec of ctx.propInstalled.values()) if (rec.task) scheduler.remove(rec.task)

  // ② 按原 tickOnce() 的执行顺序登记帧任务
  const F = (name, fn) => scheduler.add(name, fn)

${tasks.map((t) => `  // L${t.from}–L${t.to}（${t.lines} 行）\n  F('${t.name}', (dt, time) => {\n${t.code}\n  })`).join('\n\n')}
}
`

console.log(`\nJ4.7 帧任务生成器`)
console.log('─'.repeat(74))
console.log(`  tickOnce(): ${stmts.length} 条顶层语句（跳过 time/dt 声明 ${skipCount} 条）`)
console.log(`  → ${groups.length} 个帧任务，其中 ${props.length} 个是原地 tick 转来的：`)
console.log(`    ${props.join(', ')}`)
console.log(`  输出 ${path.relative(ROOT, OUT)}（${out.split('\n').length} 行）`)
const stillTick = (out.match(/\.tick\(dt, time\)/g) || []).length
console.log(`  生成的代码里仍有 \`.tick(dt, time)\`：${stillTick} 处（应为 0）`)

if (DRY) { console.log('\n--dry-run：未写盘。\n'); process.exit(0) }
fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, out, 'utf8')
const replaced =
  `${IND}// J4（tick）：本段已拆解为帧任务，见 ${path.relative(ROOT, OUT).replace(/\\/g, '/').replace(/^src\/cabin\//, '')}\n` +
  `${IND}installFrameBody(ctx, app);\n` +
  `${IND}/** ★ J4.7 的 DoD：\`animate()\` 收缩为调度骨架 —— 它只调这一个函数，\n` +
  `${IND} *  而"这一帧跑什么、按什么顺序"由 UpdateScheduler 的**登记顺序**决定\n` +
  `${IND} *  （登记顺序 = 原 tickOnce() 的执行顺序，见 FrameBody.js 的注释）。\n` +
  `${IND} *  25 处原地 \`.tick(dt, time)\` 已全部变成调度器任务，monolith 里一处不剩。 */\n` +
  `${IND}function tickOnce() { app.scheduler.update(clock.dt, clock.now); }\n` +
  `${IND}ctx.tickOnce = tickOnce;\n`
const anchor = "import { createPropInstaller } from '../app/installProp.js'"
if (!src.includes(anchor)) { console.error('找不到 import 锚点'); process.exit(1) }
const next = src
  .split('\n')
  .slice(0, segStart + 1)
  .concat(replaced.trimEnd().split('\n'), lines.slice(segEnd))
  .join('\n')
  .replace(anchor, `${anchor}\nimport { installFrameBody } from '../app/scene/FrameBody.js'`)
fs.writeFileSync(MONOLITH, next, 'utf8')
console.log(`✓ 已写盘 ${path.relative(ROOT, OUT)}`)
console.log(`✓ 已写盘 ${path.relative(ROOT, MONOLITH)}（tick 段 ${segEnd - segStart - 1} 行 → 1 行调用）\n`)
