// PNG 内容分析（零依赖）：解码后统计像素分布，用于确认截图**不是空白页**
// 用法：node scripts/analyze-png.mjs <a.png> [b.png] …
import fs from 'node:fs'
import zlib from 'node:zlib'

/** 反滤波用的 Paeth 预测器 */
function paeth(a, b, c) {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}

/** 极简 PNG 解码（支持 8 位 RGB / RGBA，非隔行） */
function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('不是 PNG')
  let pos = 8
  let width = 0
  let height = 0
  let colorType = 6
  const idat = []
  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos)
    const type = buf.toString('ascii', pos + 4, pos + 8)
    const data = buf.subarray(pos + 8, pos + 8 + len)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      colorType = data[9]
      if (data[8] !== 8) throw new Error('仅支持 8 位深度，实际 ' + data[8])
      if (data[12] !== 0) throw new Error('不支持隔行扫描')
    } else if (type === 'IDAT') {
      idat.push(Buffer.from(data))
    } else if (type === 'IEND') break
    pos += 12 + len
  }
  const raw = zlib.inflateSync(Buffer.concat(idat))
  const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 0 ? 1 : 4
  const stride = width * bpp
  const out = Buffer.alloc(height * stride)
  let prev = Buffer.alloc(stride)
  for (let y = 0; y < height; y++) {
    const ft = raw[y * (stride + 1)]
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    const cur = Buffer.alloc(stride)
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0
      const b = prev[x]
      const c = x >= bpp ? prev[x - bpp] : 0
      let v = line[x]
      if (ft === 1) v += a
      else if (ft === 2) v += b
      else if (ft === 3) v += (a + b) >> 1
      else if (ft === 4) v += paeth(a, b, c)
      cur[x] = v & 0xff
    }
    cur.copy(out, y * stride)
    prev = cur
  }
  return { width, height, bpp, pixels: out }
}

function analyze(file) {
  const buf = fs.readFileSync(file)
  const img = decodePng(buf)
  const { width, height, bpp, pixels } = img
  const total = width * height

  // 统计颜色（量化到 5 位/通道以压缩计数空间）
  const colors = new Map()
  let sumR = 0
  let sumG = 0
  let sumB = 0
  let edge = 0 // 与右邻差异较大的像素数（用于判断"是否有线条/内容"）
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * bpp
      const r = pixels[i]
      const g = pixels[i + 1]
      const b = pixels[i + 2]
      sumR += r
      sumG += g
      sumB += b
      const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)
      colors.set(key, (colors.get(key) || 0) + 1)
      if (x + 1 < width) {
        const j = i + bpp
        if (Math.abs(r - pixels[j]) + Math.abs(g - pixels[j + 1]) + Math.abs(b - pixels[j + 2]) > 30) edge++
      }
    }
  }

  // 主色
  const top = [...colors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)
  const fmt = (k) => {
    const r = ((k >> 10) & 31) << 3
    const g = ((k >> 5) & 31) << 3
    const b = (k & 31) << 3
    return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
  }

  console.log(`\n${file}`)
  console.log(`  ${buf.length} 字节 · ${width}×${height} · ${total} 像素 · ${colors.size} 种颜色（量化后）`)
  console.log(`  平均色 rgb(${(sumR / total) | 0}, ${(sumG / total) | 0}, ${(sumB / total) | 0})`)
  console.log(`  边缘像素比例 ${((edge / total) * 100).toFixed(2)}%   ← 线稿场景应有可观的边缘占比`)
  console.log(`  主色: ${top.map(([k, v]) => `${fmt(k)} ${((v / total) * 100).toFixed(1)}%`).join('  ')}`)
  return { file, bytes: buf.length, colors: colors.size, edgeRatio: edge / total }
}

const files = process.argv.slice(2)
if (!files.length) {
  console.error('用法: node scripts/analyze-png.mjs <a.png> [b.png] …')
  process.exit(1)
}
const results = files.map(analyze)

if (results.length > 1) {
  console.log('\n对比：')
  for (const r of results) {
    console.log(`  ${r.file.padEnd(34)} ${String(r.bytes).padStart(8)} B  颜色 ${String(r.colors).padStart(5)}  边缘 ${(r.edgeRatio * 100).toFixed(2)}%`)
  }
}
