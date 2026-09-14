// J2.2 一次性脚本：把 legacy/monolith.js 里的三块材质定义替换为对
// cabin/core/materials/ 的解构。用完即可删除。
//
// 为什么用脚本：FILL 块有 135 行（含两段 GLSL），用字面替换既长又容易漏字符。
// 这里按**内容边界**定位并整块替换，跑完打印替换掉的字符数以便核对。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const MONO = path.join(ROOT, 'src/cabin/legacy/monolith.js')
let src = fs.readFileSync(MONO, 'utf8')

if (src.includes('createLineMaterials()')) {
  console.log('· monolith 已改写（检测到 createLineMaterials()），跳过')
  process.exit(0)
}

/** 吃掉结束标记本身 */
function replaceInclusive(text, startMarker, endMarker, replacement, label) {
  const i = text.indexOf(startMarker)
  if (i < 0) throw new Error(`未找到起点（${label}）`)
  const j = text.indexOf(endMarker, i)
  if (j < 0) throw new Error(`未找到终点（${label}）`)
  console.log(`  ${label}：替换 ${j + endMarker.length - i} 字符`)
  return text.slice(0, i) + replacement + text.slice(j + endMarker.length)
}

/** 保留结束标记（只吃到它前面） */
function replaceUpTo(text, startMarker, endMarker, replacement, label) {
  const i = text.indexOf(startMarker)
  if (i < 0) throw new Error(`未找到起点（${label}）`)
  const j = text.indexOf(endMarker, i)
  if (j < 0) throw new Error(`未找到终点（${label}）`)
  console.log(`  ${label}：替换 ${j - i} 字符`)
  return text.slice(0, i) + replacement + text.slice(j)
}

// ── ① 三种线材质 ──
src = replaceInclusive(
  src,
  '            const MAT = new THREE.LineBasicMaterial({ color: 0x111111 });',
  '            const IN_MAT = new THREE.LineBasicMaterial({ color: 0x8a8a8a });',
  `            // J2.2：三种线材质已提取到 cabin/core/materials/lineMaterials.js（实现零改动）
            const { MAT, DASHMAT, IN_MAT } = createLineMaterials();`,
  '线材质',
)

// ── ② FILL 材质块 + ③ LITMAT 工厂（两块相邻，一并替换）──
src = replaceUpTo(
  src,
  '            /* ============ 全局 FILL 材质：内置一楼炉火 + 二楼魔法吊灯光照 ============ */',
  '            const WIN_GLASS = ',
  `            // J2.2：全局 FILL 材质与彩色材质工厂已提取到 cabin/core/materials/。
            // shader 与 uniforms 由 scripts/oneoff/_j22-extract.mjs **逐字节提取**（非手抄）。
            // 全屋的彩色材质都与这里的 FILL **共享 uniform 引用**，只换 uTint。
            const FILL = createFillMaterial();
            const LITMAT = createLitMaterialFactory(FILL);

`,
  'FILL + LITMAT',
)

// ── ④ 顶部 import ──
const importAnchor = `} from '../core/geometry/shapes2d.js'`
if (!src.includes(importAnchor)) throw new Error('未找到 shapes2d 的 import 锚点')
src = src.replace(
  importAnchor,
  `${importAnchor}
import { createLineMaterials } from '../core/materials/lineMaterials.js'
import { createFillMaterial } from '../core/materials/FillMaterial.js'
import { createLitMaterialFactory } from '../core/materials/litMaterial.js'`,
)

fs.writeFileSync(MONO, src, 'utf8')
console.log(`✓ 已改写 ${path.relative(ROOT, MONO)}（${src.split('\n').length} 行）`)
