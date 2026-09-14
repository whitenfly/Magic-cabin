// J2.2 一次性脚本：从 legacy/monolith.js 精确提取 FILL 材质的 shader 与 uniforms，
// 生成 cabin/core/materials/ 下的模块。用完即可删除（scripts/oneoff/ 就是放这类脚本的地方）。
//
// 为什么要用脚本而不是手抄：shader 与 uniform 的**空白与数值必须逐字节一致** ——
// 手抄一个空格或一个小数点就可能改变画面，而像素回归只会说"不一样"。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const MONO = path.join(ROOT, 'src/cabin/legacy/monolith.js')
const OUT = path.join(ROOT, 'src/cabin/core/materials')

const src = fs.readFileSync(MONO, 'utf8')

/** 取 `` key: `...` `` 模板字符串的内容（GLSL 里不含反引号与 ${） */
function grabTemplate(key) {
  const at = src.indexOf(`${key}: \``)
  if (at < 0) throw new Error(`未找到 ${key} 的模板字符串`)
  const start = src.indexOf('`', at) + 1
  const end = src.indexOf('`', start)
  if (end < 0) throw new Error(`${key} 模板字符串未闭合`)
  return src.slice(start, end)
}

/** 取 `uniforms: {` 起、按花括号配对到结束的那一段（**含**外层的 `{` 与 `}`） */
function grabUniforms() {
  const at = src.indexOf('uniforms: {')
  if (at < 0) throw new Error('未找到 uniforms 块')
  const open = src.indexOf('{', at)
  let depth = 0
  for (let i = open; i < src.length; i++) {
    const c = src[i]
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) return src.slice(open, i + 1)
    }
  }
  throw new Error('uniforms 块未闭合')
}

const vert = grabTemplate('vertexShader')
const frag = grabTemplate('fragmentShader')
const uniforms = grabUniforms()

fs.mkdirSync(OUT, { recursive: true })

const shaderHeader = (what) => `/**
 * ${what}
 *
 * ★ 本文件由 \`scripts/oneoff/_j22-extract.mjs\` 从 \`legacy/monolith.js\` **逐字节提取**（\`J2.2\`），
 *   不是手抄 —— shader 里的空白与数值必须与原实现完全一致。
 *   后续若要改 shader，请连同像素回归一起改（\`pnpm test:visual\`）。
 */
`

fs.writeFileSync(
  path.join(OUT, 'fill.vert.glsl.js'),
  `${shaderHeader('全局 FILL 材质的顶点着色器 —— 把世界坐标与法线传给片元（光照在世界空间里算）')}
export const FILL_VERT = \`${vert}\`
`,
  'utf8',
)

fs.writeFileSync(
  path.join(OUT, 'fill.frag.glsl.js'),
  `${shaderHeader('全局 FILL 材质的片元着色器 —— 线稿风格的"全场光照"：一楼炉火 + 二楼吊灯 + N 个室内点光源')}
export const FILL_FRAG = \`${frag}\`
`,
  'utf8',
)

fs.writeFileSync(
  path.join(OUT, 'FillMaterial.js'),
  `/**
 * 全局 FILL 材质 —— 线稿风格的"全场光照"材质
 *
 * 来源：\`legacy/monolith.js\` 的 \`FILL\`（原样搬迁，\`J2.2\`）。uniforms 块由
 * \`scripts/oneoff/_j22-extract.mjs\` 逐字节提取，材质参数（DoubleSide / polygonOffset）照搬。
 *
 * 为什么它值得单独成模块：**全屋每一个填充面共用这一份 uniforms** ——
 * \`litMaterial()\` 造出的彩色材质只是换掉 \`uTint\`，其余 uniform 引用**共享**。
 * 因此"改一处光照全场生效"这件事在架构上就成立，也是 \`J2.3\` 把
 * 「8 个硬编码槽位」改成「N 个注册光源」的落点。
 */
import * as THREE from 'three'
import { FILL_VERT } from './fill.vert.glsl.js'
import { FILL_FRAG } from './fill.frag.glsl.js'

/** 室内点光源的**槽位上限**（shader 里 \`uPtPos[8]\` / \`uPtCol[8]\` / \`uPtCfg[8]\` 的长度） */
export const POINT_LIGHT_SLOTS = 8

/** 造一份新的 FILL 材质（每个"世界"一份；monolith 全局只有一份） */
export function createFillMaterial() {
    return new THREE.ShaderMaterial({
        uniforms: ${uniforms},
        vertexShader: FILL_VERT,
        fragmentShader: FILL_FRAG,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1
    })
}
`,
  'utf8',
)

console.log('✓ 已生成：')
for (const f of ['fill.vert.glsl.js', 'fill.frag.glsl.js', 'FillMaterial.js']) {
  console.log(`  src/cabin/core/materials/${f}`)
}
console.log(`  vertex ${vert.length} 字符 / fragment ${frag.length} 字符 / uniforms ${uniforms.length} 字符`)
