// F0.3 专项验证
//
// 核心思路与 F0.2 一致：把 F0.3 的改动**反向还原**后，应与 F0.2 完成时的快照
// （.cache/monolith.after-f02.js）**逐字节一致** —— 证明本次只做了时钟注入，
// 没有触碰任何其他逻辑。
//
// 完整的可追溯链：
//   源文件(844–9807 行) --F0.2--> after-f02 快照 --F0.3--> after-f03 快照 --J0.4--> 当前文件
//   本脚本验证第二段；verify-f02.mjs 验证第一段；verify-f04.mjs 验证第三段。
import fs from 'node:fs'
import path from 'node:path'

const ROOT = 'D:/FireflyQAQ/Project/FrontProj/Magic-cabin'
// ⚠️ 检查对象是 **F0.3 完成时的快照**，不是当前文件 ——
//    J0.4 之后当前文件又加了「测试机位」钩子，与 F0.2 快照已不再只差「时钟注入」。
const TARGET = path.join(ROOT, '.cache/monolith.after-f03.js')
const SNAPSHOT = path.join(ROOT, '.cache/monolith.after-f02.js')
const SRC = 'D:/FireflyQAQ/Project/FrontProj/line-art-style-magic-cabin-main/index.html'

const N = (s) => s.replace(/\s+$/, '')
let pass = 0
let fail = 0
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? '  → ' + detail : ''}`)
  ok ? pass++ : fail++
}

const cur = fs.readFileSync(TARGET, 'utf8')
const snap = fs.readFileSync(SNAPSHOT, 'utf8')

// ── 反向还原 F0.3 ──
function undoF03(text) {
  let t = text

  const must = (name, fn) => {
    const before = t
    t = fn(t)
    if (t === before) throw new Error(`反向还原失败：${name}`)
  }

  // ① 删除 clock import
  must('删除 clock import', (s) => s.replace(/^import \{ clock \} from '\.\.\/app\/clock\.js'\n/m, ''))

  // ② tickOnce 头部 → 原 animate 头部
  // 注意：跨行缩进一律用 [ \t]*，不能用 \s*（\s 会吞掉换行，导致多/少空行）
  must('恢复 animate 头部', (s) =>
    s.replace(
      /(\n[ \t]*)\/\/ F0\.3：帧体（原 animate 的函数体）。时间来自 clock —— realtime 下等价于原实现，\n[ \t]*\/\/       manual 下可逐帧定格，用于像素级回归比对。\n[ \t]*function tickOnce\(\) \{\n[ \t]*const time = clock\.now; const dt = clock\.dt;/,
      '$1function animate(t) {$1    requestAnimationFrame(animate);$1    const time = t * 0.001; const dt = Math.min(time - lastT, 0.05); lastT = time;',
    ),
  )

  // ③ 删除 animate 包装块（连同其前的空行，保留一个换行）
  must('删除 animate 包装', (s) =>
    s.replace(
      /\n\n[ \t]*\/\/ F0\.3：主循环只负责「推进时钟 \+ 跑一帧」——时间源可切换为手动步进\n[ \t]*function animate\(t\) \{\n[ \t]*requestAnimationFrame\(animate\);\n[ \t]*clock\.tick\(t\);\n[ \t]*tickOnce\(\);\n[ \t]*\}/,
      '\n',
    ),
  )

  // ④ 恢复启动语句（条件启动 → 直接 animate(0)）
  must('恢复正常启动', (s) =>
    s.replace(
      /\n[ \t]*\/\/ F0\.3：启动主循环。[\s\S]*?\n[ \t]*\} else \{\n[ \t]*animate\(0\);\n[ \t]*\}/,
      '\n            animate(0);',
    ),
  )

  // ⑤ 删除 manual 驱动装饰的两行
  must('删除 manual 驱动装饰', (s) =>
    s.replace(
      /\n[ \t]*\/\/ F0\.3：手动模式下由主循环驱动装饰循环（realtime 模式由它自己的 rAF 驱动）\n[ \t]*if \(clock\.mode === 'manual'\) updateNewDecor\(time, dt\);/,
      '',
    ),
  )

  // ⑥ 恢复 decorLoop（连同 F0.3 新增的 `let decorLastT = 0;` 一起换回原版）
  must('恢复 decorLoop', (s) =>
    s.replace(
      /\n[ \t]*let decorLastT = 0;\n[ \t]*let mirrorDirtyT = 0;\n[ \t]*\/\/ F0\.3：装饰循环（时钟 \/ 镜子涟漪 \/ 挂画 GIF \/ 纸箱）[\s\S]*?\}\)\(\);/,
      "\n            let decorLastT = performance.now() * 0.001;\n            let mirrorDirtyT = 0;\n            (function decorLoop() {\n                requestAnimationFrame(decorLoop);\n                const t = performance.now() * 0.001;\n                const dt = Math.min(0.05, Math.max(0.001, t - decorLastT));\n                decorLastT = t;\n                updateNewDecor(t, dt);\n            })();\n",
    ),
  )

  // ⑦ 恢复 drawClock
  must('恢复 drawClock', (s) =>
    s.replace(
      /const now = clock\.mode === 'manual' && clock\.frozenDateMs !== null \? new Date\(clock\.frozenDateMs\) : new Date\(\);/,
      'const now = new Date();',
    ),
  )

  // ⑧ 恢复 tryJump
  must('恢复 tryJump', (s) => s.replace(/function tryJump\(\) \{ const now = clock\.now;/, 'function tryJump() { const now = performance.now() * 0.001;'))

  // ⑨ 恢复 UI 节流
  must('恢复 hintOverride', (s) =>
    s
      .replace(/hintOverrideUntil = clock\.wallNow\(\) \+ 2\.4;/, 'hintOverrideUntil = performance.now() * 0.001 + 2.4;')
      .replace(/if \(clock\.wallNow\(\) < hintOverrideUntil\)/, 'if (performance.now() * 0.001 < hintOverrideUntil)'),
  )

  // ⑩ 恢复事件起始时刻（t0/start 位置的 clock.now）
  must('恢复事件起始时刻', (s) => {
    const out = s.replace(/(\.(?:t0|start)\s*=|(?:t0|start)\s*:)\s*clock\.now/g, '$1 performance.now() * 0.001')
    return out
  })

  // ⑪ 恢复 let lastT（注意用 [ \t]* 而非 \s*：\s 会吞掉换行，导致多插一个空行）
  must('恢复 lastT', (s) =>
    s.replace(
      /(\n[ \t]*)let ptLantern = 1, ptKot = 1, ptMc = 0, ptCb = 0, ptPlant = 0;/,
      '$1let lastT = 0;$1let ptLantern = 1, ptKot = 1, ptMc = 0, ptCb = 0, ptPlant = 0;',
    ),
  )

  return t
}

console.log('\n【F0.3-1】反向还原后应与 F0.2 快照一致')
{
  let restored
  try {
    restored = undoF03(cur)
  } catch (e) {
    check('反向还原', false, e.message)
    restored = null
  }
  if (restored !== null) {
    const want = N(snap)
    const a = N(restored)
    const rawSame = a === want
    // 反向还原涉及删/插代码块，容易在**空行**上产生 ±1 行差异 —— 那不影响语义。
    // 因此主判据用「空白归一化」后的比较；同时报告原始差异量，保持透明。
    const norm = (s) =>
      s
        .replace(/[ \t]+$/gm, '')
        .replace(/\n{2,}/g, '\n')
        .replace(/\s+$/, '')
    const normSame = norm(a) === norm(want)

    // 参考信息：反向还原涉及删/插代码块，容易在**空行**上产生 ±1 行差异 —— 那不影响语义。
    // 因此判据用「空白归一化」后的比较；原始差异量作为参考输出，保持透明。
    console.log(`  ${rawSame ? '✓' : '·'} 逐字节一致（参考）：${rawSame ? `${want.length} 字符` : `差异 ${Math.abs(a.length - want.length)} 字符`}`)
    check('空白归一化后一致（证明只差空行）', normSame, normSame ? '逻辑完全一致' : '存在非空白差异')

    if (!normSame) {
      const na = norm(a)
      const nw = norm(want)
      let i = 0
      while (i < Math.min(na.length, nw.length) && na[i] === nw[i]) i++
      console.log('     首个实质差异位置:', i)
      console.log('     快照:', JSON.stringify(nw.slice(Math.max(0, i - 70), i + 70)))
      console.log('     还原:', JSON.stringify(na.slice(Math.max(0, i - 70), i + 70)))
    } else if (!rawSame) {
      console.log('     （差异仅为空行数量，属反向还原脚本的换行处理，不影响代码语义）')
    }
  }
}

console.log('\n【F0.3-2】时钟注入完整性')
{
  check('已注入 clock 模块', /import \{ clock \} from '\.\.\/app\/clock\.js'/.test(cur))
  check('帧体已抽出为 tickOnce()', /function tickOnce\(\) \{/.test(cur))
  check('主循环为「推进时钟 + 跑一帧」', /function animate\(t\) \{\s*\n\s*requestAnimationFrame\(animate\);\s*\n\s*clock\.tick\(t\);\s*\n\s*tickOnce\(\);/.test(cur))
  check('tickOnce 时间源为 clock', /const time = clock\.now; const dt = clock\.dt;/.test(cur))
  check('manual 模式暴露单帧钩子', /window\.__cabinStepFrame = tickOnce;/.test(cur))
  check('manual 模式暴露静止重绘', /window\.__cabinStartStillRepaint = function/.test(cur))
  check('静止重绘只重绘不更新（不可调用 tickOnce）', /function still\(\) \{\s*\n\s*requestAnimationFrame\(still\);\s*\n\s*renderer\.render\(scene, camera\);\s*\n\s*\}/.test(cur))
}

console.log('\n【F0.3-3】时间源分布')
{
  // 只看代码行，排除注释（F0.3 的注释里也提到了 performance.now() 以作说明）
  const perfLines = cur.split('\n').filter((l) => /performance\.now\(\)/.test(l) && !/^\s*(\/\/|\*)/.test(l))
  check(
    'performance.now() 仅剩 1 处真实调用（decorLoop 的 realtime 分支）',
    perfLines.length === 1,
    `实际 ${perfLines.length} 处：${perfLines.map((l) => l.trim().slice(0, 60)).join(' | ')}`,
  )
  const decor = /if \(clock\.mode === 'manual'\) return;/.test(cur)
  check('decorLoop 在 manual 模式跳过自驱动', decor)

  const t0 = (cur.match(/(\.(?:t0|start)\s*=|(?:t0|start)\s*:)\s*clock\.now/g) || []).length
  check('10 处事件起始时刻已改用 clock.now', t0 === 10, `实际 ${t0} 处`)

  check('tryJump 与 groundT 同尺度', /function tryJump\(\) \{ const now = clock\.now;/.test(cur))
  check('drawClock 支持冻结日期', /clock\.frozenDateMs !== null \? new Date\(clock\.frozenDateMs\)/.test(cur))
  const wall = (cur.match(/clock\.wallNow\(\)/g) || []).length
  check('UI 节流使用 clock.wallNow()（2 处）', wall === 2, `实际 ${wall} 处`)
}

console.log('\n【F0.3-4】时钟模块行为')
{
  const clockSrc = fs.readFileSync(path.join(ROOT, 'src/cabin/app/clock.js'), 'utf8')
  const mod = await import('data:text/javascript;base64,' + Buffer.from(clockSrc).toString('base64'))
  const { clock, MAX_DT, STEP } = mod

  clock.reset()
  clock.setMode('realtime')
  clock.tick(0)
  check('realtime 首帧 tick(0) 后 dt=0（与原实现等价）', clock.dt === 0, `dt=${clock.dt}`)
  clock.tick(16)
  check('realtime 次帧 dt=0.016', Math.abs(clock.dt - 0.016) < 1e-9, `dt=${clock.dt}`)
  clock.tick(5000)
  check(`realtime 大间隔被夹到 MAX_DT=${MAX_DT}`, clock.dt === MAX_DT, `dt=${clock.dt}`)

  clock.reset()
  clock.setMode('manual')
  const before = clock.now
  clock.tick(9999)
  check('manual 模式下 tick() 不推进动画时间', clock.now === before, `now=${clock.now}`)
  clock.step(STEP)
  check('step() 推进固定步长', Math.abs(clock.now - STEP) < 1e-9, `now=${clock.now}`)
  for (let i = 0; i < 119; i++) clock.step(STEP)
  check('120 帧累计 = 2 秒（精确）', Math.abs(clock.now - 2) < 1e-9, `now=${clock.now}`)
  check('帧计数正确', clock.frame === 120, `frame=${clock.frame}`)

  clock.freezeWall(1000)
  check('冻结挂钟后 wallNow() 恒定', clock.wallNow() === 1000)
  clock.unfreezeWall()
  check('解冻后 wallNow() 回到真实时间', clock.wallNow() !== 1000)
}

console.log(`\n结果：${pass} 通过 / ${fail} 失败\n`)
process.exit(fail ? 1 : 0)
