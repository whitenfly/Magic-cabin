/**
 * 线稿几何 DSL —— 全屋几何的公共构造原语
 *
 * 来源：`cabin/legacy/monolith.js` 原 230–251 行（原样搬迁，`J2.1`）。
 *
 * 搬迁原则（`01-完善路线图.md` §1 原则 2「搬迁期零优化」）：**实现零改动** ——
 * 只把依赖从"闭包捕获"改为**显式注入**，函数体逐字照搬。
 *
 * 为什么注入 `scene` 与材质（而不是 import 一个全局场景）：
 *   · 不变量 `N1`：`core/**` 不得出现具体物件的变量名 —— 这里只认中性材质名
 *     （`line` / `inner` / `dash` / `fill`），`MAT` / `FILL` 这些业务命名留在调用方；
 *   · 不变量 `N7`：禁止新增全局可变状态 —— 场景对象由调用方持有并传入。
 *
 * 这一层是 `J3` 物件模块化的地基：67 件物件的几何全部由这几个原语构造，
 * 提前独立出来，搬迁每个物件时才不需要再从 monolith 里抠代码。
 */
import * as THREE from 'three'

/**
 * @param {object} deps
 * @param {import('three').Scene} deps.scene 默认父级（`put` / `logBetween` 未指定 parent 时的落点）
 * @param {{ line: any, inner: any, dash: any, fill: any }} deps.materials 四种共享材质
 * @returns 几何原语集合（名字与原实现完全一致，调用点零改动）
 */
export function createSketch({ scene, materials }) {
  const MAT = materials.line
  const IN_MAT = materials.inner
  const DASHMAT = materials.dash
  const FILL = materials.fill

  /** 向量简写 */
  const V = (x, y, z) => new THREE.Vector3(x, y, z)
  /** 由 `[[x,y,z], …]` 点列构造线几何 */
  const geo = (pts) => new THREE.BufferGeometry().setFromPoints(pts.map((p) => V(p[0], p[1], p[2])))
  /** 实线 */
  const line = (pts) => new THREE.Line(geo(pts), MAT)
  /** 内部线（浅灰，用于剖切时的次要线） */
  const iline = (pts) => new THREE.Line(geo(pts), IN_MAT)
  /** 虚线（需 `computeLineDistances` 才能正确分段） */
  function dline(pts) {
    const l = new THREE.Line(geo(pts), DASHMAT)
    l.computeLineDistances()
    return l
  }

  /**
   * ★ 核心原语：**填充 + 描边**的分组。
   * 线稿风格的画面 = 每个几何体「先一层全场光照的填充面，再叠一层棱边线」，
   * 本函数就是这条规则的唯一实现；`box` / `log` / `rbox` 都建立在它之上。
   */
  function edge(g, threshold = 1, lmat) {
    const grp = new THREE.Group()
    grp.add(new THREE.Mesh(g, FILL))
    grp.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, threshold), lmat || MAT))
    return grp
  }
  const box = (w, h, d) => edge(new THREE.BoxGeometry(w, h, d))
  const log = (len, r = 0.15) => edge(new THREE.CylinderGeometry(r, r, len, 8))

  /** 摆放并挂载（`parent` 省略时挂到场景根） */
  function put(o, x, y, z, rx, ry, rz, parent) {
    o.position.set(x, y, z)
    if (rx) o.rotation.x = rx
    if (ry) o.rotation.y = ry
    if (rz) o.rotation.z = rz
    ;(parent || scene).add(o)
    return o
  }

  /** 在两点之间架一根圆木（用四元数把 +Y 对齐到 p1→p2 方向） */
  function logBetween(p1, p2, r, parent) {
    const v = V(p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2])
    const L = edge(new THREE.CylinderGeometry(r, r, v.length(), 8))
    L.position.set((p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2, (p1[2] + p2[2]) / 2)
    L.quaternion.setFromUnitVectors(V(0, 1, 0), v.normalize())
    ;(parent || scene).add(L)
    return L
  }

  return { V, geo, line, iline, dline, edge, box, log, put, logBetween }
}
