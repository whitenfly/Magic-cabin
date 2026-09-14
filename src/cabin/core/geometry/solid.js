/**
 * 实体几何 —— 任意几何 + 材质的"填充 + 描边"组装，以及两点之间的实心圆柱
 *
 * 来源：`cabin/legacy/monolith.js` 原 747、749–762 行（原样搬迁，`J2.1`）。
 * 实现零改动：棱边阈值固定 1、圆柱固定 8 边、四元数对齐方向，全部逐字照搬。
 *
 * `solidCyl` 的**默认材质是注入的**：原实现硬编码了一个具体物件（猫）的材质
 * `CATMAT`。按不变量 `N1`（`core/**` 不得出现具体物件的变量名），
 * 这里改为中性参数 `defaultSolidMaterial`，由调用方传什么就是什么 —— 行为不变。
 */
import * as THREE from 'three'

/**
 * @param {object} deps
 * @param {(x: number, y: number, z: number) => THREE.Vector3} deps.V 向量简写（来自 `sketch.js`）
 * @param {(pts: number[][]) => THREE.BufferGeometry} deps.geo 点列 → 几何（来自 `sketch.js`）
 * @param {THREE.Scene} deps.scene 默认父级
 * @param {any} deps.lineMaterial 描边线材质（原 `MAT`）
 * @param {any} deps.defaultSolidMaterial `solidCyl` 未指定材质时的默认值（原 `CATMAT`）
 */
export function createSolid({ V, geo, scene, lineMaterial, defaultSolidMaterial }) {
  /** 闭合折线（悬挂绳、锅沿、藤蔓…） */
  const lloop = (pts, parent) => {
    const l = new THREE.LineLoop(geo(pts), lineMaterial)
    ;(parent || scene).add(l)
    return l
  }

  /** 任意几何 → 「填充面 + 棱边线」分组（与 `edge` 同构，区别是可指定实体材质） */
  function solid(g, mat, lmat) {
    const grp = new THREE.Group()
    grp.add(new THREE.Mesh(g, mat))
    grp.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, 1), lmat || lineMaterial))
    return grp
  }

  /** 两点之间的实心圆柱（猫尾、灯绳、坩埚支架…） */
  function solidCyl(p1, p2, r, parent, mat) {
    const v = V(p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2])
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, v.length(), 8), mat || defaultSolidMaterial)
    m.position.set((p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2, (p1[2] + p2[2]) / 2)
    m.quaternion.setFromUnitVectors(V(0, 1, 0), v.normalize())
    ;(parent || scene).add(m)
    return m
  }

  return { lloop, solid, solidCyl }
}
