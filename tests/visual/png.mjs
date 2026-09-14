/**
 * 零依赖 PNG 解码与像素比对（J0.4）
 * ============================================================================
 * 来源：`scripts/analyze-png.mjs` 的 `decodePng()`（F0.3 期为了确认"定格帧不是黑屏"写的）。
 * 这里把它抽成库，供 `tests/visual/compare.mjs` 做**差异百分比**判定。
 *
 * 只做两件事：解码 PNG（8 位 RGB/RGBA、非隔行 —— 浏览器截图就是这种）与逐像素比对。
 * 不生成 PNG（基线就是浏览器截的原图，不做任何再编码 —— 再编码会引入变量）。
 */
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

/**
 * 解码 PNG。
 * @param {Buffer} buf
 * @returns {{width:number,height:number,bpp:number,pixels:Buffer}}
 */
export function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('不是 PNG 文件')
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

/** 读文件并解码 */
export function readPng(file) {
  return decodePng(fs.readFileSync(file))
}

/**
 * 逐像素比对两张同尺寸图像。
 *
 * 判据设计（沿用原型 `_probe/probe4`「逐帧像素差分 + 参考帧」的思路）：
 * 返回的 `ratio` 是**期望为 0** 的那个数 —— 搬迁期"零画面变化"是硬规矩，
 * 所以任何非零差异都必须能解释。
 *
 * @param {{width:number,height:number,bpp:number,pixels:Buffer}} a 基线
 * @param {{width:number,height:number,bpp:number,pixels:Buffer}} b 当前
 * @param {number} tol 单通道容差（默认 0 = 逐字节严格比较）
 */
export function diffPng(a, b, tol = 0) {
  if (a.width !== b.width || a.height !== b.height) {
    return {
      sameSize: false,
      width: [a.width, b.width],
      height: [a.height, b.height],
      total: a.width * a.height,
      diff: a.width * a.height,
      ratio: 1,
      maxDelta: 255,
      firstDiff: null,
      bbox: null,
    }
  }
  const total = a.width * a.height
  let diff = 0
  let maxDelta = 0
  let firstDiff = null
  let x1 = Infinity
  let y1 = Infinity
  let x2 = -1
  let y2 = -1
  for (let y = 0; y < a.height; y++) {
    for (let x = 0; x < a.width; x++) {
      const i = (y * a.width + x) * a.bpp
      const d =
        Math.abs(a.pixels[i] - b.pixels[i]) +
        Math.abs(a.pixels[i + 1] - b.pixels[i + 1]) +
        Math.abs(a.pixels[i + 2] - b.pixels[i + 2])
      if (d > tol) {
        diff++
        if (firstDiff === null) firstDiff = { x, y, delta: d }
        if (d > maxDelta) maxDelta = d
        if (x < x1) x1 = x
        if (y < y1) y1 = y
        if (x > x2) x2 = x
        if (y > y2) y2 = y
      }
    }
  }
  return {
    sameSize: true,
    width: [a.width, a.width],
    height: [a.height, a.height],
    total,
    diff,
    ratio: total ? diff / total : 0,
    maxDelta,
    firstDiff,
    bbox: x2 >= 0 ? { x1, y1, x2, y2, w: x2 - x1 + 1, h: y2 - y1 + 1 } : null,
  }
}

/**
 * 画面内容统计 —— 用来识别「全黑 / 全白」这类**会让哈希比对产生假阳性**的情况
 * （F0.3 §6.1 的教训：`sha256 相同`在画面全黑时同样成立）。
 */
export function analyzeImage(img) {
  const { width, height, bpp, pixels } = img
  const total = width * height
  const colors = new Map()
  let sumR = 0
  let sumG = 0
  let sumB = 0
  let edge = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * bpp
      const r = pixels[i]
      const g = pixels[i + 1]
      const b = pixels[i + 2]
      sumR += r
      sumG += g
      sumB += b
      colors.set(((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3), (colors.get(((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)) || 0) + 1)
      // ⚠️ 必须**同时**看水平与垂直方向的差分。
      //    只看水平会漏掉**横向线条**（叠木墙的水平木纹、地板横线、横梁都是横向的），
      //    于是"一面有木纹的白墙"会被统计成"空白" —— 这是 J0.4 排查墙面问题时踩过的坑。
      let strong = false
      if (x + 1 < width) {
        const j = i + bpp
        if (Math.abs(r - pixels[j]) + Math.abs(g - pixels[j + 1]) + Math.abs(b - pixels[j + 2]) > 30) strong = true
      }
      if (!strong && y + 1 < height) {
        const j = i + width * bpp
        if (Math.abs(r - pixels[j]) + Math.abs(g - pixels[j + 1]) + Math.abs(b - pixels[j + 2]) > 30) strong = true
      }
      if (strong) edge++
    }
  }
  const top = [...colors.entries()].sort((p, q) => q[1] - p[1])[0]
  return {
    width,
    height,
    colors: colors.size,
    mean: { r: Math.round(sumR / total), g: Math.round(sumG / total), b: Math.round(sumB / total) },
    edgeRatio: edge / total,
    topColorRatio: top ? top[1] / total : 0,
  }
}
