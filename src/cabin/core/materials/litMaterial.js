/**
 * 彩色物品材质工厂 —— 与 FILL **共享**环境/光照 uniform，只把 `uTint` 换成自己的颜色
 *
 * 来源：`legacy/monolith.js` 的 `LITMAT`（原样搬迁，`J2.2`）。实现零改动。
 *
 * 关键点（这也是性能基线里 draw call / 三角面不涨的原因）：
 * `for (const k in FILL.uniforms) if (k !== 'uTint') u[k] = FILL.uniforms[k]`
 * 是**引用共享**而不是拷贝 —— 全屋几百个彩色材质共用同一份 `uFireCenter` / `uPtPos[… ]`，
 * 于是"改一处光照，全场生效"在架构上天然成立（不变量 `N4`：新增光源不得修改 shader）。
 */
import * as THREE from 'three'

/**
 * @param {import('three').ShaderMaterial} FILL 全局填充材质（`createFillMaterial()` 的产物）
 * @returns {(hex: number, opts?: object) => import('three').ShaderMaterial} `LITMAT`
 */
export function createLitMaterialFactory(FILL) {
  /** 造一个彩色材质：`hex` 作为 `uTint`，其余 uniform 与 FILL 共享 */
  return function LITMAT(hex, opts) {
    const u = { uTint: { value: new THREE.Color(hex) } }
    for (const k in FILL.uniforms) if (k !== 'uTint') u[k] = FILL.uniforms[k]
    const m = new THREE.ShaderMaterial({
      uniforms: u,
      vertexShader: FILL.vertexShader,
      fragmentShader: FILL.fragmentShader,
    })
    if (opts) for (const k in opts) m[k] = opts[k]
    return m
  }
}
