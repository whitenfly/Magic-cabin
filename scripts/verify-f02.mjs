// F0.2 专项验证
//
// 核心思路：把替换后的代码里所有 `xxx()` 反向替换回 `Math.random()`，
//          应当与源文件（line-art-style-magic-cabin-main/index.html 第 844–9807 行）**逐字节一致**。
//          这证明本次改动**只做了随机源替换**，没有碰任何其他逻辑。
import fs from 'node:fs'

const SRC = 'D:/FireflyQAQ/Project/FrontProj/line-art-style-magic-cabin-main/index.html'
const ROOT = 'D:/FireflyQAQ/Project/FrontProj/Magic-cabin'
// ⚠️ 检查对象是 **F0.2 完成时的快照**，不是当前文件。
//    原因：F0.3 之后当前文件又注入了时钟，与源文件不再只差「随机源替换」。
//    可追溯链：源文件 --F1+F0.2--> 本快照 --F0.3--> 当前文件
//    当前文件与快照的关系由 scripts/verify-f03.mjs 验证。
const TARGET = `${ROOT}/.cache/monolith.after-f02.js`

const RNG_NAMES = ['outdoorRng', 'floor1Rng', 'floor2Rng', 'skyRng', 'textureRng', 'slimeRng', 'runtimeRng']
const RE_RNG = new RegExp(`\\b(${RNG_NAMES.join('|')})\\(\\)`, 'g')
const N = (s) => s.replace(/\s+$/, '')

let pass = 0
let fail = 0
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? '  → ' + detail : ''}`)
  ok ? pass++ : fail++
}

// ── 源文件对应区间 ──
const srcLines = fs.readFileSync(SRC, 'utf8').split(/\r?\n/)
const srcBody = N(srcLines.slice(843, 9807).join('\n')) // 844–9807

// ── 替换后的代码体（去掉头部注释与 import 块） ──
const cur = fs.readFileSync(TARGET, 'utf8')
const marker = 'const runtimeRng = runtime;\n'
const curBody = N(cur.slice(cur.indexOf(marker) + marker.length).replace(/^\s*\n/, ''))

console.log('\n【F0.2-1】反向替换后应与源文件逐字节一致')
{
  const reversed = N(curBody.replace(RE_RNG, 'Math.random()'))
  const same = reversed === srcBody
  check('代码体逐字节一致', same, same ? `${srcBody.length} 字符` : `长度 ${reversed.length} vs ${srcBody.length}`)
  if (!same) {
    let i = 0
    while (i < Math.min(reversed.length, srcBody.length) && reversed[i] === srcBody[i]) i++
    console.log('     首个差异位置:', i)
    console.log('     源文件:', JSON.stringify(srcBody.slice(Math.max(0, i - 50), i + 50)))
    console.log('     当前  :', JSON.stringify(reversed.slice(Math.max(0, i - 50), i + 50)))
  }
}

console.log('\n【F0.2-2】替换归零与分布')
{
  const left = (cur.match(/Math\.random\(\)/g) || []).length
  check('monolith.js 中残留裸 Math.random() 为 0', left === 0, left ? `残留 ${left} 处` : '')

  const replaced = (cur.match(RE_RNG) || []).length
  check('替换点数量 = 源文件调用数 286', replaced === 286, `实际 ${replaced}`)

  const byRng = {}
  for (const m of cur.matchAll(RE_RNG)) byRng[m[1]] = (byRng[m[1]] || 0) + 1
  console.log('     分布:', JSON.stringify(byRng))
  check(
    '场景随机 149 处（A/C 类）',
    Object.entries(byRng).filter(([k]) => k !== 'runtimeRng').reduce((a, [, v]) => a + v, 0) === 149,
  )
  check('运行期随机 137 处（B 类）', byRng.runtimeRng === 137)
}

console.log('\n【F0.2-3】注入完整性')
{
  check("已 import rng 模块", cur.includes("from '../app/rng.js'"))
  check('已解构 6 个场景随机源（带 Rng 后缀）', /outdoor: outdoorRng/.test(cur) && /slime: slimeRng/.test(cur))
  check('运行期随机源已绑定', /const runtimeRng = runtime/.test(cur))
  check('rng.js 存在', fs.existsSync(`${ROOT}/src/cabin/app/rng.js`))
  // 关键：注入的随机源名字（*Rng）不得与场景内任何业务标识符同名。
  // 教训：最初用短名（slime）时与 IIFE 内的 `const slime`（史莱姆状态对象）冲突 → TDZ 崩溃。
  // 注意：只在 IIFE 体（curBody）内检查，排除注入块自身。
  const injected = ['outdoorRng', 'floor1Rng', 'floor2Rng', 'skyRng', 'textureRng', 'slimeRng', 'runtimeRng']
  const shadowed = injected.filter((n) => new RegExp(`(?:const|let|var|function)\\s+${n}\\b`).test(curBody))
  check('注入的随机源名未与业务标识符同名', shadowed.length === 0, shadowed.join(', '))
  // 确认业务标识符本身仍在（未被误改）
  check('业务标识符 slime 仍然存在（史莱姆状态对象）', /const slime = \{ squash:/.test(cur))
}

console.log('\n【F0.2-4】随机源确定性（LCG 可复现）')
{
  // 动态载入 rng.js 做行为验证（用 data: URL 避免路径解析问题）
  const rngSrc = fs.readFileSync(`${ROOT}/src/cabin/app/rng.js`, 'utf8')
  const mod = await import('data:text/javascript;base64,' + Buffer.from(rngSrc).toString('base64'))

  const a = mod.createRng(12345)
  const b = mod.createRng(12345)
  const seqA = Array.from({ length: 8 }, () => a())
  const seqB = Array.from({ length: 8 }, () => b())
  check('同种子产生相同序列', JSON.stringify(seqA) === JSON.stringify(seqB), seqA.map((v) => v.toFixed(4)).join(', '))

  const c = mod.createRng(12346)
  check('不同种子产生不同序列', JSON.stringify(seqA) !== JSON.stringify(Array.from({ length: 8 }, () => c())))

  const f1 = mod.createRng(999).fork('a')
  const f2 = mod.createRng(999).fork('a')
  const f3 = mod.createRng(999).fork('b')
  check('fork 同标签可复现', f1() === f2())
  check('fork 不同标签相互独立', f1() !== f3())

  // 分布均匀性：用**同一个实例**连续取样（每次重建实例只会重复取到首值）
  const gen = mod.createRng(7)
  const all = Array.from({ length: 4000 }, () => gen())
  const inRange = all.every((v) => v >= 0 && v < 1)
  const mean = all.reduce((s, v) => s + v, 0) / all.length
  check('取值恒在 [0,1)', inRange)
  check('均值接近 0.5（±0.02）', Math.abs(mean - 0.5) < 0.02, `mean=${mean.toFixed(4)}`)

  // 分桶均匀性：10 桶，每桶应接近 10%
  const buckets = new Array(10).fill(0)
  for (const v of all) buckets[Math.min(9, Math.floor(v * 10))]++
  const maxDev = Math.max(...buckets.map((b) => Math.abs(b / all.length - 0.1)))
  check('10 分桶最大偏差 < 2%', maxDev < 0.02, buckets.join(' / '))

  // 场景随机源的确定性
  const s1 = mod.snapshotRandomState()
  const out1 = [mod.scene.outdoor(), mod.scene.sky(), mod.scene.texture()]
  mod.resetAllRandom()
  const s2 = mod.snapshotRandomState()
  const out2 = [mod.scene.outdoor(), mod.scene.sky(), mod.scene.texture()]
  check('resetAllRandom() 可复位场景随机源', JSON.stringify(out1) === JSON.stringify(out2))
  check('场景种子公开可配置', typeof mod.SCENE_SEED === 'number', `SCENE_SEED=${mod.SCENE_SEED}`)

  // 运行期随机可切换
  mod.setDeterministicRuntime(true)
  const r1 = [mod.runtime(), mod.runtime(), mod.runtime()]
  mod.setDeterministicRuntime(true)
  const r2 = [mod.runtime(), mod.runtime(), mod.runtime()]
  check('运行期随机可切换为确定模式', JSON.stringify(r1) === JSON.stringify(r2))
  check('isRuntimeDeterministic() 反映状态', mod.isRuntimeDeterministic() === true)
  mod.setDeterministicRuntime(false)
  check('可切回真随机模式', mod.isRuntimeDeterministic() === false)
}

console.log(`\n结果：${pass} 通过 / ${fail} 失败\n`)
process.exit(fail ? 1 : 0)
