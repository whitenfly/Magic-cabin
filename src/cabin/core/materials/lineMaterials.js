/**
 * 线材质 —— 线稿风格里"线"这一半的三种基本材质
 *
 * 来源：`legacy/monolith.js` 的 `MAT` / `DASHMAT` / `IN_MAT`（原样搬迁，`J2.2`）。
 * 实现零改动：颜色、虚线 `dashSize/gapSize`、透明度全部照搬。
 *
 * | 材质 | 用途 |
 * |---|---|
 * | `MAT` | 主描边（近黑 `0x111111`）—— 绝大多数线 |
 * | `DASHMAT` | 虚线（灰 `0xa9a9a9`）—— **剖切模式下省略的墙与屋顶**用它表示"这里其实有东西" |
 * | `IN_MAT` | 内部线（`0x8a8a8a`）—— 次要结构线 |
 *
 * ⚠️ 虚线材质要求几何调用 `computeLineDistances()` 才能正确分段 ——
 * `sketch.js` 的 `dline()` 已经处理，别绕过它直接用 `DASHMAT` 造 `Line`。
 */
import * as THREE from 'three'

/** @returns {{ MAT: any, DASHMAT: any, IN_MAT: any }} 三种共享线材质 */
export function createLineMaterials() {
  const MAT = new THREE.LineBasicMaterial({ color: 0x111111 })
  const DASHMAT = new THREE.LineDashedMaterial({
    color: 0xa9a9a9,
    dashSize: 0.22,
    gapSize: 0.16,
    transparent: true,
    opacity: 0.85,
  })
  const IN_MAT = new THREE.LineBasicMaterial({ color: 0x8a8a8a })
  return { MAT, DASHMAT, IN_MAT }
}
