/**
 * 截图查看器：把 PNG 转成**字符图**（文字化视觉）
 * ============================================================================
 * 移植自原型 `_probe/classify.mjs`（材质分类字符图）与 `_probe/diffmap.mjs`（差异分布图），
 * 位置遵循 [`03-渲染通道与构建选型.md`](../../docs/BuildPlaning/03-渲染通道与构建选型.md) §7 的移植表。
 *
 * 为什么需要它：**基线是否"拍到了东西"，不能靠肉眼看图来确认**——
 * 这个项目的判据是脚本跑出来的，而"图是空的/全黑的"这种情况恰恰会让哈希判据产生
 * **假阳性**（F0.3 §6.1 的教训：`sha256 相同`在画面全黑时同样成立）。
 * 有了字符图，人和模型都能在终端里"看"到构图。
 *
 * 两种模式：
 *   · **亮度图**（默认）：10 级灰度 → ` .:-=+*#%@`，用于判断构图与曝光
 *   · **差异图**（`--diff`）：与另一张图逐像素比较 → `.` 相同 / `-` 轻微 / `#` 明显
 *
 * 用法：
 *
 *     node tests/visual/view.mjs tests/visual/baseline/default-fixed.png
 *     node tests/visual/view.mjs <png> --cols=100 --crop=0,0,50,100     # 只看左半
 *     node tests/visual/view.mjs _shots/visual/x.png --diff tests/visual/baseline/x.png
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readPng, diffPng, analyzeImage } from './png.mjs'

/** 10 级灰度字符（左暗右亮）—— 线稿场景大面积为白，肉眼对"哪里有线"最敏感 */
const RAMP = '@%#*+=-:. '

/** 取该格的统计值（默认平均亮度，比中心像素更能反映结构） */
function sample(img, x0, y0, x1, y1, mode) {
  const { width, bpp, pixels } = img
  let sum = 0
  let n = 0
  let edge = 0
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * bpp
      const lum = pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114
      sum += lum
      n++
      // 与 analyzeImage 一致：横向线条（叠木墙的木纹）只有在**垂直差分**里才看得出来
      let strong = false
      if (x + 1 < x1) {
        const j = i + bpp
        if (Math.abs(pixels[i] - pixels[j]) + Math.abs(pixels[i + 1] - pixels[j + 1]) + Math.abs(pixels[i + 2] - pixels[j + 2]) > 30) strong = true
      }
      if (!strong && y + 1 < y1) {
        const j = i + img.width * bpp
        if (Math.abs(pixels[i] - pixels[j]) + Math.abs(pixels[i + 1] - pixels[j + 1]) + Math.abs(pixels[i + 2] - pixels[j + 2]) > 30) strong = true
      }
      if (strong) edge++
    }
  }
  if (mode === 'edge') return n ? edge / n : 0
  return n ? sum / n / 255 : 1
}

/**
 * 生成字符图。
 * @param {object} img decodePng 的结果
 * @param {{cols?:number, crop?:number[], mode?:'lum'|'edge'}} [opts]
 *        crop = [x0%, y0%, x1%, y1%]
 */
export function asciiView(img, { cols = 96, crop = [0, 0, 100, 100], mode = 'lum' } = {}) {
  const { width, height } = img
  const cx0 = Math.floor((width * crop[0]) / 100)
  const cy0 = Math.floor((height * crop[1]) / 100)
  const cx1 = Math.ceil((width * crop[2]) / 100)
  const cy1 = Math.ceil((height * crop[3]) / 100)
  const cw = Math.max(1, cx1 - cx0)
  const ch = Math.max(1, cy1 - cy0)

  const stepX = Math.max(1, Math.round(cw / cols))
  const stepY = stepX * 2 // 字符高宽比约 2:1，纵向步长取两倍才不会拉伸
  const rows = Math.max(1, Math.floor(ch / stepY))
  const lines = []
  for (let r = 0; r < rows; r++) {
    let line = ''
    for (let c = 0; c < Math.floor(cw / stepX); c++) {
      const x0 = cx0 + c * stepX
      const y0 = cy0 + r * stepY
      const v = sample(img, x0, y0, Math.min(cx1, x0 + stepX), Math.min(cy1, y0 + stepY), mode)
      line += mode === 'edge' ? (v > 0.25 ? '#' : v > 0.10 ? '+' : v > 0.03 ? '.' : ' ') : RAMP[Math.min(RAMP.length - 1, Math.round(v * (RAMP.length - 1)))]
    }
    lines.push(line)
  }
  return { lines, box: { cx0, cy0, cx1, cy1 }, cols: Math.floor(cw / stepX), rows }
}

/** 差异字符图：`.` 相同 / `-` 轻微（≤30）/ `+` 中等（≤90）/ `#` 明显 */
export function diffView(a, b, { cols = 96, crop = [0, 0, 100, 100] } = {}) {
  if (a.width !== b.width || a.height !== b.height) return { lines: [`尺寸不同：${a.width}×${a.height} vs ${b.width}×${b.height}`], cols: 0, rows: 0 }
  const { width, height, bpp, pixels } = a
  const cx0 = Math.floor((width * crop[0]) / 100)
  const cy0 = Math.floor((height * crop[1]) / 100)
  const cx1 = Math.ceil((width * crop[2]) / 100)
  const cy1 = Math.ceil((height * crop[3]) / 100)
  const cw = Math.max(1, cx1 - cx0)
  const ch = Math.max(1, cy1 - cy0)
  const stepX = Math.max(1, Math.round(cw / cols))
  const stepY = stepX * 2
  const lines = []
  for (let y = cy0; y < cy1; y += stepY) {
    let line = ''
    for (let x = cx0; x < cx1; x += stepX) {
      let worst = 0
      for (let yy = y; yy < Math.min(cy1, y + stepY) && worst <= 90; yy++) {
        for (let xx = x; xx < Math.min(cx1, x + stepX); xx++) {
          const i = (yy * width + xx) * bpp
          const d =
            Math.abs(pixels[i] - b.pixels[i]) + Math.abs(pixels[i + 1] - b.pixels[i + 1]) + Math.abs(pixels[i + 2] - b.pixels[i + 2])
          if (d > worst) worst = d
        }
      }
      line += worst === 0 ? '.' : worst <= 30 ? '-' : worst <= 90 ? '+' : '#'
    }
    lines.push(line)
  }
  return { lines, cols: Math.floor(cw / stepX), rows: lines.length }
}

// ── CLI ─────────────────────────────────────────────────────────────────────
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) {
  const argv = process.argv.slice(2)
  const flag = (name, def) => {
    const hit = argv.find((a) => a.startsWith(`--${name}=`))
    return hit ? hit.slice(name.length + 3) : def
  }
  const files = argv.filter((a) => !a.startsWith('--'))
  const diffWith = flag('diff', null)
  const cols = Number(flag('cols', 96))
  const crop = String(flag('crop', '0,0,100,100')).split(',').map(Number)
  const mode = String(flag('mode', 'lum'))

  if (!files.length) {
    console.error('用法: node tests/visual/view.mjs <png> [--cols=96] [--crop=x0,y0,x1,y1] [--mode=lum|edge] [--diff=<另一张png>]')
    process.exit(1)
  }

  const target = files[0]
  const img = readPng(target)
  const stats = analyzeImage(img)
  console.log(`\n${path.relative(process.cwd(), target)}  ${img.width}×${img.height}`)
  console.log(
    `平均色 rgb(${stats.mean.r},${stats.mean.g},${stats.mean.b})  颜色 ${stats.colors}  边缘 ${(stats.edgeRatio * 100).toFixed(2)}%  主色占比 ${(stats.topColorRatio * 100).toFixed(1)}%  字节 ${fs.statSync(target).size}`,
  )

  if (diffWith) {
    const other = readPng(diffWith)
    const d = diffPng(img, other)
    console.log(`\n差异 vs ${path.relative(process.cwd(), diffWith)}：${(d.ratio * 100).toFixed(4)}%（${d.diff}/${d.total}）  最大通道差 ${d.maxDelta}`)
    console.log('图例：. 相同   - 轻微   + 中等   # 明显\n')
    for (const l of diffView(img, other, { cols, crop }).lines) console.log(l)
  } else {
    console.log(`模式 ${mode}（图例：${mode === 'edge' ? '" "无边缘 → # 边缘密集' : `'${RAMP}' 左暗右亮`}）\n`)
    for (const l of asciiView(img, { cols, crop, mode }).lines) console.log(l)
  }
  console.log('')
}
