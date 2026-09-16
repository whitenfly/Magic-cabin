// F0.2 实施：把 monolith.js 中的 Math.random() 替换为注入的种子随机源
//
// 设计依据见 src/cabin/app/rng.js 与 docs/ArtLine-Part/10-F0.2-实施结果.md
// 输出：
//   · 改写 src/cabin/legacy/monolith.js
//   · 备份原件到 .cache/monolith.before-f02.js
//   · 替换记录到 .cache/f02-replacements.json
import fs from 'node:fs'
import path from 'node:path'

const ROOT = 'D:/FireflyQAQ/Project/FrontProj/Magic-cabin'
const TARGET = path.join(ROOT, 'src/cabin/legacy/monolith.js')
const BACKUP = path.join(ROOT, '.cache/monolith.before-f02.js')
const RECORD = path.join(ROOT, '.cache/f02-replacements.json')

// ── 行号区间 → 随机源 映射 ──
// [起, 止, 随机源, 类别, 说明]
//   A = 构建期（场景生成）  C = 初始化（影响后续动画）  B = 运行期瞬态
//
// ⚠️ 随机源变量一律带 `Rng` 后缀。
//    原因：最初用短名（outdoor / sky / slime …）时与 IIFE 内的 `const slime`（史莱姆状态对象，
//    第 6138 行）同名冲突 → 触发 TDZ 报错 "Cannot access 'slime' before initialization"，
//    导致整个 IIFE 抛错、3D 完全不渲染。加后缀可彻底避免与业务标识符撞名。
const MAP = [
  [438, 438, 'runtime', 'B', '壁炉火花初始漂移（影响火焰粒子动画）'],
  [516, 610, 'outdoor', 'A', '室外场景：森林树木 / 草丛 / 石头 / 蘑菇 / 花 / 树桩 / 木桩'],
  [649, 657, 'outdoor', 'A', '萤火虫初始位置、相位、速度、振幅'],
  [873, 873, 'floor1', 'C', '坩埚气泡摆动相位'],
  [906, 913, 'floor1', 'C', '壁炉烟雾粒子初始化（位置 / 寿命 / 漂移 / 摆幅）'],
  [1107, 1107, 'floor1', 'C', '毛线球自旋初速'],
  [1180, 1184, 'floor1', 'A', '左窗下魔法书堆：每本书的微小位置/旋转偏移'],
  [1360, 1361, 'floor1', 'C', '大魔女坩埚气泡半径与相位'],
  [1520, 1521, 'floor1', 'C', '紫色魔法阵漂浮粒子（角度/半径/相位/速度）'],
  [1847, 1847, 'floor1', 'A', '水晶球占卜台内的星点'],
  [2020, 2021, 'floor1', 'A', '滑轮置物台纸堆（下层）'],
  [2062, 2062, 'floor1', 'A', '塔罗牌牌堆'],
  [2685, 2688, 'runtime', 'B', '魔方打乱（用户点击触发）'],
  [2797, 2797, 'floor2', 'C', '金币柱倒塌初始姿态'],
  [2895, 2895, 'runtime', 'B', '扑克牌翻牌花色'],
  [3037, 3046, 'floor2', 'A', '玻璃雪景球：球内雪花粒子初始化'],
  [3051, 3081, 'runtime', 'B', '玻璃雪景球：摇动冲量与落底重生'],
  [3488, 3507, 'runtime', 'B', '魔法书本翻页时浮出的魔法符号'],
  [3755, 3763, 'floor2', 'A', '二楼宇宙星空粒子系统初始化'],
  [3788, 3789, 'texture', 'A', '计划板（黑板）Canvas 纹理噪点'],
  [4323, 4323, 'runtime', 'B', '魔法阵余烬粒子（施法时构建）'],
  [4489, 4501, 'runtime', 'B', '魔法阵电光束（施法时生成）'],
  [4585, 4585, 'runtime', 'B', '魔杖随机元素选择（每次施法）'],
  [5103, 5147, 'runtime', 'B', '魔女帽：撒糖果（颜色/糖型/位置/速度/角速度）'],
  [5794, 5799, 'runtime', 'B', '拱形全身镜：点击泛起的水波涟漪'],
  [5881, 5901, 'texture', 'A', '毛茸茸大地毯 Canvas 纹理噪点与流苏抖动'],
  [6130, 6130, 'slime', 'C', '史莱姆体表气泡'],
  [6190, 6302, 'runtime', 'B', '超位魔法系统粒子（杖尖蓄力 / 空中魔力 / 十字星 / 地面光尘）'],
  [6748, 7080, 'runtime', 'B', '超级爆炸（碎屑 / 火花 / 余烬 / 烟球 / 闪电束 / 地面龟裂）'],
  [7572, 7572, 'runtime', 'B', '天气随机切换的计时'],
  [7633, 7685, 'sky', 'A', '星空初始化（星星位置 / 闪烁相位 / 亮度 / 大小 / 颜色混合）'],
  [7745, 7763, 'runtime', 'B', '流星（轨道 / 速度 / 生命周期 / 下次出现时间）'],
  [7793, 7805, 'sky', 'A', '云块生成（数量 / 尺寸 / 堆叠 / 位置 / 漂浮速度）'],
  [7815, 7815, 'sky', 'A', '雨滴初始位置与速度'],
  [7823, 7824, 'sky', 'A', '雪花初始方向（球面均匀分布）'],
  [7840, 7840, 'sky', 'A', '雪花初始位置与运动参数'],
  [7851, 7851, 'sky', 'A', '雪球粒子初始位置与运动参数'],
  [7855, 7856, 'runtime', 'B', '闪电：首次触发计时与闪电折线生成'],
  [7869, 7869, 'runtime', 'B', '天气自动轮换（随机挑选下一种天气与间隔）'],
  [7968, 7968, 'runtime', 'B', '云循环出界后重置位置'],
  [7985, 7985, 'runtime', 'B', '雨滴落地后重置位置'],
  [7999, 8018, 'runtime', 'B', '雪花落到屋顶/地面后重置位置'],
  [8024, 8024, 'runtime', 'B', '暴雨时闪电的循环触发'],
  [8135, 8138, 'runtime', 'B', '魔法书浮字的生命周期与漂移参数重生'],
  [8970, 8972, 'runtime', 'B', '爆炸冲击波到达脚下的相机震屏'],
]

// ── 读取与备份 ──
const original = fs.readFileSync(TARGET, 'utf8')
if (!fs.existsSync(BACKUP)) {
  fs.mkdirSync(path.dirname(BACKUP), { recursive: true })
  fs.writeFileSync(BACKUP, original, 'utf8')
}
const lines = original.split('\n')

// ── 覆盖校验：每一处 Math.random() 都必须落在某个区间内 ──
const uncovered = []
for (let i = 0; i < lines.length; i++) {
  const no = i + 1
  if (!lines[i].includes('Math.random()')) continue
  if (!MAP.some(([a, b]) => no >= a && no <= b)) uncovered.push(no)
}
if (uncovered.length) {
  console.error('✗ 以下行含 Math.random() 但未被映射覆盖：', uncovered.join(', '))
  process.exit(1)
}

// ── 执行替换 ──
const records = []
let totalCalls = 0
for (let i = 0; i < lines.length; i++) {
  const no = i + 1
  if (!lines[i].includes('Math.random()')) continue
  const entry = MAP.find(([a, b]) => no >= a && no <= b)
  const [from, to, rngName, cls, desc] = entry
  const before = lines[i]
  const count = (before.match(/Math\.random\(\)/g) || []).length
  const call = `${rngName}Rng()`
  const after = before.split('Math.random()').join(call)
  lines[i] = after
  totalCalls += count
  records.push({
    line: no,
    calls: count,
    rng: call.slice(0, -2),
    cls,
    desc,
    section: `${from}-${to}`,
    before: before,
    after: after,
  })
}

// ── 注入 import ──
let out = lines.join('\n')
const anchor = "import * as THREE from 'three'\n"
const inject =
  anchor +
  `import { scene, runtime } from '../app/rng.js'\n` +
  `\n` +
  `// F0.2：把原本的裸随机调用替换为注入的种子随机源（见 src/cabin/app/rng.js）\n` +
  `//   *Rng（6 个） = 构建期/初始化随机（永久确定，保证每次加载场景一致）\n` +
  `//   runtimeRng   = 运行期随机（默认真随机，测试模式下可切换为确定）\n` +
  `// 命名一律带 Rng 后缀，避免与场景内的业务标识符撞名（如 IIFE 内的 slime 状态对象）。\n` +
  `const {\n` +
  `    outdoor: outdoorRng,\n` +
  `    floor1: floor1Rng,\n` +
  `    floor2: floor2Rng,\n` +
  `    sky: skyRng,\n` +
  `    texture: textureRng,\n` +
  `    slime: slimeRng,\n` +
  `} = scene\n` +
  `// ⚠️ 下面这行**必须带分号**：\n` +
  `//    若写成 "const runtimeRng = runtime" 而下一行以 ( 开头（顶层 IIFE），\n` +
  `//    JS 的自动分号插入不会生效，会被解析为 runtime(function(){...})() —— 即把 IIFE\n` +
  `//    当成 runtime 的参数调用，抛出 "runtime(...) is not a function"。\n` +
  `const runtimeRng = runtime;\n`

if (!out.includes("from '../app/rng.js'")) {
  out = out.replace(anchor, inject)
}

fs.writeFileSync(TARGET, out, 'utf8')

// ── 输出记录 ──
const byRng = {}
const byCls = {}
for (const r of records) {
  byRng[r.rng] = (byRng[r.rng] || 0) + r.calls
  byCls[r.cls] = (byCls[r.cls] || 0) + r.calls
}

fs.writeFileSync(
  RECORD,
  JSON.stringify({ totals: { lines: records.length, calls: totalCalls }, byRng, byCls, map: MAP, records }, null, 2),
  'utf8',
)

console.log('✓ F0.2 替换完成')
console.log(`  替换调用数: ${totalCalls} 处（${records.length} 行）`)
console.log('  按随机源:', JSON.stringify(byRng))
console.log('  按类别  :', JSON.stringify(byCls))
console.log(`  备份    : .cache/monolith.before-f02.js`)
console.log(`  记录    : .cache/f02-replacements.json`)

// ── 归零校验 ──
const after = fs.readFileSync(TARGET, 'utf8')
const left = (after.match(/Math\.random\(\)/g) || []).length
console.log(`\n  残留 Math.random() 调用: ${left}`)
if (left > 0) {
  const ln = after.split('\n').map((l, i) => (l.includes('Math.random()') ? i + 1 : 0)).filter(Boolean)
  console.log('  位于行:', ln.join(', '))
}
