// F0.3 实施：注入可步进时钟
//
// 设计见 src/cabin/app/clock.js 与 docs/实施结果/F0.3-实施结果.md
// 原则：**realtime 模式行为与改动前完全等价**；只有 manual 模式新增「定格」能力。
//
// 输出：
//   · 改写 src/cabin/legacy/monolith.js
//   · 备份到 .cache/monolith.before-f03.js
//   · 记录到 .cache/f03-replacements.json
import fs from 'node:fs'
import path from 'node:path'

const ROOT = 'D:/FireflyQAQ/Project/FrontProj/Magic-cabin'
const TARGET = path.join(ROOT, 'src/cabin/legacy/monolith.js')
const BACKUP = path.join(ROOT, '.cache/monolith.before-f03.js')
const RECORD = path.join(ROOT, '.cache/f03-replacements.json')

const original = fs.readFileSync(TARGET, 'utf8')
if (!fs.existsSync(BACKUP)) {
  fs.mkdirSync(path.dirname(BACKUP), { recursive: true })
  fs.writeFileSync(BACKUP, original, 'utf8')
}
let lines = original.split('\n')
const records = []

/** 按行号替换（1-based），带内容断言。返回实际替换的行数 */
function editOne(lineNo, test, newLines, desc, cls) {
  const cur = lines[lineNo - 1]
  if (!test.test(cur)) {
    console.error(`✗ L${lineNo} 内容不符预期\n  期望匹配: ${test}\n  实际内容: ${cur}`)
    process.exit(1)
  }
  const before = cur
  lines.splice(lineNo - 1, 1, ...newLines)
  records.push({ line: lineNo, cls, desc, before, after: newLines.join('\n'), delta: newLines.length - 1 })
}

// ── ① 顶部注入 import（在 rng import 之后） ──
{
  const idx = lines.findIndex((l) => l.includes("from '../app/rng.js'"))
  if (idx < 0) {
    console.error('✗ 未找到 rng import 行')
    process.exit(1)
  }
  lines.splice(idx + 1, 0, `import { clock } from '../app/clock.js'`)
  records.push({ line: idx + 2, cls: '接入', desc: '注入 clock 模块', before: '(新增)', after: `import { clock } from '../app/clock.js'`, delta: 1 })
  // 行号整体下移 1
}

// 注入后所有行号 +1，重新计算
const SHIFT = 1
const at = (n) => n + SHIFT

// ── ② animate 的帧体抽出（从后往前改，避免行号漂移） ──

// ②-1 末尾：插入 animate 包装（在 animate(0); 之前）
{
  const idx = lines.findIndex((l) => /^\s*animate\(0\);\s*$/.test(l))
  if (idx < 0) {
    console.error('✗ 未找到 animate(0);')
    process.exit(1)
  }
  const indent = lines[idx].match(/^\s*/)[0]
  lines.splice(
    idx,
    0,
    '',
    `${indent}// F0.3：主循环只负责「推进时钟 + 跑一帧」——时间源可切换为手动步进`,
    `${indent}function animate(t) {`,
    `${indent}    requestAnimationFrame(animate);`,
    `${indent}    clock.tick(t);`,
    `${indent}    tickOnce();`,
    `${indent}}`,
  )
  records.push({ line: idx + 1, cls: '主循环', desc: '新增 animate 包装（rAF + clock.tick + tickOnce）', before: '(无)', after: 'function animate(t) { … }', delta: 7 })
}

// ②-2 头部：animate(t) → tickOnce()，时间源改为 clock
{
  const idx = lines.findIndex((l) => /^\s*function animate\(t\) \{\s*$/.test(l))
  if (idx < 0) {
    console.error('✗ 未找到 function animate(t) {')
    process.exit(1)
  }
  const indent = lines[idx].match(/^\s*/)[0]
  const rafLine = lines[idx + 1]
  const timeLine = lines[idx + 2]
  if (!/requestAnimationFrame\(animate\)/.test(rafLine) || !/const time = t \* 0\.001/.test(timeLine)) {
    console.error('✗ animate 头部结构不符预期：\n  ' + rafLine + '\n  ' + timeLine)
    process.exit(1)
  }
  lines.splice(
    idx,
    3,
    `${indent}// F0.3：帧体（原 animate 的函数体）。时间来自 clock —— realtime 下等价于原实现，`,
    `${indent}//       manual 下可逐帧定格，用于像素级回归比对。`,
    `${indent}function tickOnce() {`,
    `${indent}    const time = clock.now; const dt = clock.dt;`,
  )
  records.push({
    line: idx + 1,
    cls: '主循环',
    desc: '帧体抽出为 tickOnce()，时间源改为 clock.now / clock.dt',
    before: 'function animate(t) { rAF; const time = t*0.001; dt = min(time-lastT,0.05) }',
    after: 'function tickOnce() { const time = clock.now; const dt = clock.dt; }',
    delta: 1,
  })
}

// ②-3 删除不再需要的 lastT
{
  const idx = lines.findIndex((l) => /^\s*let lastT = 0;\s*$/.test(l))
  if (idx < 0) {
    console.error('✗ 未找到 let lastT = 0;')
    process.exit(1)
  }
  lines.splice(idx, 1)
  records.push({ line: idx + 1, cls: '主循环', desc: '移除 lastT（时间差由 clock 内部维护）', before: 'let lastT = 0;', after: '(删除)', delta: -1 })
}

// ── ③ decorLoop：改为读 clock（realtime 行为不变，manual 由主循环驱动） ──
{
  const idx = lines.findIndex((l) => /let decorLastT = performance\.now\(\) \* 0\.001;/.test(l))
  if (idx < 0) {
    console.error('✗ 未找到 decorLastT 初始化')
    process.exit(1)
  }
  const indent = lines[idx].match(/^\s*/)[0]
  // 找到该循环的结束（updateNewDecor(t, dt); 之后的 })();）
  let end = idx
  for (let i = idx; i < idx + 15; i++) {
    if (/updateNewDecor\(t, dt\);/.test(lines[i])) {
      end = i
      break
    }
  }
  const block = lines.slice(idx, end + 3)
  records.push({
    line: idx + 1,
    cls: '装饰循环',
    desc: 'decorLoop 时间源改为 clock：realtime 保持 performance.now() 原行为，manual 用 clock.now/clock.dt',
    before: block.join('\n'),
    after: '(见下)',
    delta: 0,
  })
  lines.splice(
    idx,
    end + 3 - idx,
    `${indent}let decorLastT = 0;`,
    `${indent}let mirrorDirtyT = 0;`,
    `${indent}// F0.3：装饰循环（时钟 / 镜子涟漪 / 挂画 GIF / 纸箱）`,
    `${indent}//   realtime：沿用 performance.now()，行为与改动前完全一致`,
    `${indent}//   manual  ：读 clock.now / clock.dt，跟随手动步进（由主循环驱动，见 tickOnce 末尾）`,
    `${indent}(function decorLoop() {`,
    `${indent}    requestAnimationFrame(decorLoop);`,
    `${indent}    if (clock.mode === 'manual') return;   // 手动模式由 tickOnce 负责调用`,
    `${indent}    const t = performance.now() * 0.001;`,
    `${indent}    const dt = Math.min(0.05, Math.max(0.001, t - decorLastT));`,
    `${indent}    decorLastT = t;`,
    `${indent}    updateNewDecor(t, dt);`,
    `${indent}})();`,
  )
  records[records.length - 1].after = lines.slice(idx, idx + 12).join('\n')
}

// ── ④ 在 tickOnce 末尾补上「manual 模式驱动装饰循环」 ──
{
  const idx = lines.findIndex((l) => /renderer\.render\(scene, camera\);/.test(l))
  if (idx < 0) {
    console.error('✗ 未找到 renderer.render')
    process.exit(1)
  }
  const indent = lines[idx].match(/^\s*/)[0]
  lines.splice(
    idx + 1,
    0,
    `${indent}// F0.3：手动模式下由主循环驱动装饰循环（realtime 模式由它自己的 rAF 驱动）`,
    `${indent}if (clock.mode === 'manual') updateNewDecor(time, dt);`,
  )
  records.push({
    line: idx + 1,
    cls: '装饰循环',
    desc: 'manual 模式下由 tickOnce 驱动 updateNewDecor，保证定格一致',
    before: '(无)',
    after: 'if (clock.mode === \'manual\') updateNewDecor(time, dt);',
    delta: 2,
  })
}

// ── ⑤ 事件起始时刻：performance.now() → clock.now ──
// 覆盖两种写法：赋值式 `s.t0 = …` 与对象属性式 `{ t0: … }`
{
  const re = /performance\.now\(\) \* 0\.001/
  const hits = []
  lines.forEach((l, i) => {
    if (!re.test(l)) return
    if (/\.(t0|start)\s*=/.test(l) || /\b(t0|start)\s*:/.test(l)) hits.push(i + 1)
  })
  for (const no of hits) {
    const before = lines[no - 1]
    lines[no - 1] = before.replace(/performance\.now\(\) \* 0\.001/g, 'clock.now')
    records.push({
      line: no,
      cls: '事件起点',
      desc: '动画起始时刻改用 clock.now（与 time 同尺度，否则 time - t0 会算错）',
      before,
      after: lines[no - 1],
      delta: 0,
    })
  }
  console.log(`  事件起始时刻 t0/start：${hits.length} 处`)
}

// ── ⑥ drawClock：manual 模式冻结日期 ──
{
  const idx = lines.findIndex((l) => /const now = new Date\(\);/.test(l))
  if (idx < 0) {
    console.error('✗ 未找到 drawClock 的 new Date()')
    process.exit(1)
  }
  const before = lines[idx]
  lines[idx] = lines[idx].replace(
    /const now = new Date\(\);/,
    'const now = clock.mode === \'manual\' && clock.frozenDateMs !== null ? new Date(clock.frozenDateMs) : new Date();',
  )
  records.push({
    line: idx + 1,
    cls: '挂钟',
    desc: 'drawClock 在 manual 模式使用冻结日期（否则秒针每次都不同）',
    before,
    after: lines[idx],
    delta: 0,
  })
}

// ── ⑦ tryJump：与 groundT 同尺度 ──
{
  const idx = lines.findIndex((l) => /function tryJump\(\) \{ const now = performance\.now\(\) \* 0\.001;/.test(l))
  if (idx < 0) {
    console.error('✗ 未找到 tryJump')
    process.exit(1)
  }
  const before = lines[idx]
  // player.groundT 由 slimeLand(time) 赋值，time 现在是 clock.now → 此处必须同尺度
  lines[idx] = before.replace('const now = performance.now() * 0.001;', 'const now = clock.now;')
  records.push({
    line: idx + 1,
    cls: '输入手感',
    desc: 'tryJump 改用 clock.now —— 必须与 groundT（来自 time）同尺度，否则防连点失效',
    before,
    after: lines[idx],
    delta: 0,
  })
}

// ── ⑧ 提示条覆盖：改用 wallNow（UI 语义；manual 下冻结） ──
{
  let n = 0
  lines = lines.map((l, i) => {
    if (/hintOverrideUntil = performance\.now\(\) \* 0\.001 \+ 2\.4;/.test(l)) {
      records.push({ line: i + 1, cls: 'UI 节流', desc: '提示覆盖起点改用 clock.wallNow()', before: l, after: l.replace('performance.now() * 0.001', 'clock.wallNow()'), delta: 0 })
      n++
      return l.replace('performance.now() * 0.001', 'clock.wallNow()')
    }
    if (/if \(performance\.now\(\) \* 0\.001 < hintOverrideUntil\)/.test(l)) {
      records.push({ line: i + 1, cls: 'UI 节流', desc: '提示覆盖判断改用 clock.wallNow()（与起点同源）', before: '(长行)', after: '(改 wallNow)', delta: 0 })
      n++
      return l.replace('performance.now() * 0.001 < hintOverrideUntil', 'clock.wallNow() < hintOverrideUntil')
    }
    return l
  })
  console.log(`  UI 节流（hintOverride）：${n} 处`)
}

const out = lines.join('\n')
fs.writeFileSync(TARGET, out, 'utf8')
fs.writeFileSync(
  RECORD,
  JSON.stringify({ records: records.sort((a, b) => a.line - b.line) }, null, 2),
  'utf8',
)

console.log('\n✓ F0.3 替换完成')
console.log(`  改动点：${records.length} 处`)
console.log('  备份：.cache/monolith.before-f03.js')
console.log('  记录：.cache/f03-replacements.json')

// ── 残留检查 ──
const left = (out.match(/performance\.now\(\)/g) || []).length
console.log(`\n  剩余 performance.now() 调用：${left} 处`)
out.split('\n').forEach((l, i) => {
  if (/performance\.now\(\)/.test(l)) console.log(`    L${i + 1}: ${l.trim().slice(0, 110)}`)
})
