/**
 * J0.4 一次性脚本：**挑机位 + 定小屋形态**
 * ============================================================================
 * 为什么要它：`tests/visual/poses.js` 里的三个机位是"判据"，不该在挑选过程中反复改动。
 * 本脚本用一张**候选表**（`capturePoses` 的 `poseTable` 通道）把候选视角一次抓完，
 * 人工看图后，只把选中的写进 `poses.js`。
 *
 * 本轮要定的两个问题：
 *   ① 三个机位（默认固定视角 / 一楼室内 / 二楼书桌）的相机坐标；
 *   ② 每个机位用哪种**小屋形态** —— 场景默认是**剖切模式**（被省略的墙与屋顶用虚线表示），
 *      完整外观要显式打开（菜单里的「小屋」按钮，等价于 `?house=full`）。
 *
 * 用法：
 *   pnpm serve                       # 另开一个终端
 *   node scripts/oneoff/_j04-explore.mjs
 *   # 产物：_shots/explore/*.png（临时目录，不入库）
 *   node tests/visual/view.mjs _shots/explore/<某个>.png --cols=80
 *
 * 坐标来源：`src/cabin/legacy/monolith.js` 的场景常量
 *   · 内墙约 ±4.2，中央螺旋楼梯半径约 1.2，大门在 z≈4
 *   · 二楼地板 `FLOOR_TOP = 3.12`，二楼书桌 `TBLX/TBLZ = 2.5 / -2.5`
 * 脚本执行过一次即可；之后机位的真源只有 `tests/visual/poses.js`。
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { capturePoses, DEFAULTS } from '../../tests/visual/capture.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

/**
 * 诊断轮 2：从**室外**对比 full / cutaway，并对贴墙机位做左右对照
 *
 * 已知（诊断轮 1）：
 *   · 贴近右墙 1.5m（full）→ 边缘 0.07%（几乎纯白）
 *   · 正对右墙（cutaway）→ 边缘 4.97%（能看到虚线 + 室外）
 *   · 正对左墙（full，常驻墙）→ 边缘 1.04%
 * 本轮要分清三种可能：
 *   A. `fullHouse` 开关根本没生效（室外 full 与 cutaway 应当明显不同，若相同即证伪）
 *   B. 右墙/后墙渲染了，但只画了白色填充、没有描边（贴墙图应当能看到墙，但边缘率极低）
 *   C. 右墙/后墙压根没画（贴墙图应当能看到墙后的室外景物）
 */
const CANDIDATES = {
  'ext-right-front-full': { label: '室外右前上方·完整', note: 'E1 看外观是否多出右墙/后墙/屋顶', cam: [10, 6, 10, 0, 2, 0], house: 'full' },
  'ext-right-front-cut': { label: '室外右前上方·剖切', note: 'E2 对照', cam: [10, 6, 10, 0, 2, 0], house: 'cutaway' },
  'near-right-cut': { label: '贴右墙 1.5m·剖切', note: 'E3 与 full 版对比', cam: [2.5, 3.9, -1.0, 4.0, 3.9, -1.0], house: 'cutaway' },
  'near-left-full': { label: '贴左墙 1.5m·完整（常驻墙对照）', note: 'E4 常驻墙在同样距离下的样子', cam: [-2.5, 3.9, -1.0, -4.0, 3.9, -1.0], house: 'full' },
}

const opts = {
  url: process.env.CABIN_URL || 'http://127.0.0.1:5173',
  viewport: DEFAULTS.viewport,
  frames: DEFAULTS.frames,
  frameStep: DEFAULTS.frameStep,
  poses: Object.keys(CANDIDATES),
  poseTable: CANDIDATES,
  outDir: path.join(ROOT, '_shots/explore'),
  quiet: false,
}

console.log('\n  J0.4 · 挑机位 + 定小屋形态（候选 %d 个，输出 _shots/explore/）\n', opts.poses.length)
const shots = await capturePoses(opts)
const bad = shots.filter((s) => !s.ok)
console.log(`\n  完成：${shots.length} 张（${bad.length} 张有告警）`)
for (const s of bad) console.log(`   ⚠ ${s.name}: ${s.problems.join('；')}`)
console.log('\n  下一步：node tests/visual/view.mjs _shots/explore/<file>.png --cols=80')
console.log('         人工看构图后，把选中的写进 tests/visual/poses.js\n')
