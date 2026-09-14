/**
 * 圆角几何 —— 把盒子的顶点向"内芯盒"收拢到半径 r，得到圆角长方体
 *
 * 来源：`cabin/legacy/monolith.js` 原 714–737 行（原样搬迁，`J2.1`）。
 * 实现零改动：段数、半径钳制、`1e-9` 退化判据、法线重算，全部逐字照搬。
 *
 * 它是室内陈设（床垫 / 枕头 / 坐垫 / 抽屉面板…）的基础几何，
 * 用 `seg*2+1` 个分段保证倒角处有足够顶点可以"推圆"。
 */
import * as THREE from 'three'

/**
 * @param {object} deps
 * @param {(g: THREE.BufferGeometry, threshold?: number, lmat?: any) => THREE.Group} deps.edge
 *        `sketch.js` 的 `edge` —— 圆角几何同样遵守"填充 + 描边"规则
 */
export function createRoundBox({ edge }) {
  /**
   * 生成圆角长方体的**几何**（不带材质，便于调用方自行组装）。
   *
   * @param {number} w 宽 @param {number} h 高 @param {number} d 深
   * @param {number} r 圆角半径（会被 `min(r, w/2, h/2, d/2)` 钳制）
   * @param {number} [seg=2] 每边细分段数
   */
  function roundBoxGeo(w, h, d, r, seg) {
    if (seg === undefined) seg = 2
    r = Math.min(r, w / 2, h / 2, d / 2)
    const g = new THREE.BoxGeometry(w, h, d, seg * 2 + 1, seg * 2 + 1, seg * 2 + 1)
    const pa = g.attributes.position
    const hw = w / 2 - r
    const hh = h / 2 - r
    const hd = d / 2 - r
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i)
      const y = pa.getY(i)
      const z = pa.getZ(i)
      // 内芯盒上的最近点
      const cx = Math.max(-hw, Math.min(hw, x))
      const cy = Math.max(-hh, Math.min(hh, y))
      const cz = Math.max(-hd, Math.min(hd, z))
      const dx = x - cx
      const dy = y - cy
      const dz = z - cz
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz)
      if (len > 1e-9) {
        // 沿"内芯点 → 原顶点"方向推到半径 r 处
        pa.setXYZ(i, cx + (dx / len) * r, cy + (dy / len) * r, cz + (dz / len) * r)
      } else {
        // 退化：顶点已在内芯盒上，直接吸附
        pa.setXYZ(i, cx, cy, cz)
      }
    }
    g.computeVertexNormals()
    return g
  }

  /** 圆角长方体 + 描边（`seg` 省略时按 2 处理，棱边阈值固定 12） */
  const rbox = (w, h, d, r, seg) => edge(roundBoxGeo(w, h, d, r, seg === undefined ? 2 : seg), 12)

  return { roundBoxGeo, rbox }
}
