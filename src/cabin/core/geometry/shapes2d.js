/**
 * 平面图形点集 —— 生成 2D 环 / 多边形 / 星形 / 弧 / 螺旋等点列
 *
 * 来源：`cabin/legacy/monolith.js` 原 6365–6379 行（原样搬迁，`J2.1`）。
 *
 * 这一组的分工很干净，因此拆成两种导出：
 *   · **纯函数**（`ringPts` … `zigPts`）：只做三角函数 → 返回 `[x, y, z]` 点列，
 *     零依赖、无副作用 —— 可以直接单元测试（`tests/unit/` 自 `J2` 起）；
 *   · **构建器**（`lineFromPts` / `segsFromPairs`）：需要 `V` 才能造 `BufferGeometry`，
 *     故走工厂注入。
 *
 * 用途：24 层魔法阵的每一层、卫星小阵、光尘轨迹 —— 全部由这几个函数拼出来。
 * 实现零改动：点数、步进、闭合方式逐字照搬。
 */
import * as THREE from 'three'

/** 整圆均分点列 */
export function ringPts(r, n, rot) {
  const a = []
  for (let i = 0; i < n; i++) {
    const t = (rot || 0) + (i / n) * Math.PI * 2
    a.push([Math.cos(t) * r, Math.sin(t) * r, 0])
  }
  return a
}

/** 正多边形点列 */
export function polyPts(r, sides, rot) {
  const a = []
  for (let i = 0; i < sides; i++) {
    const t = (rot || 0) + (i / sides) * Math.PI * 2
    a.push([Math.cos(t) * r, Math.sin(t) * r, 0])
  }
  return a
}

/** 星形（按 `step` 跳点连线，`step` 与 `sides` 互质时才是标准星形） */
export function starPts(r, sides, step, rot) {
  const a = []
  for (let i = 0; i < sides; i++) {
    const t = (rot || 0) + (((i * step) % sides) / sides) * Math.PI * 2
    a.push([Math.cos(t) * r, Math.sin(t) * r, 0])
  }
  return a
}

/** 圆弧点列（含首尾两端点，故 `n+1` 个点） */
export function arcPts(r, a0, a1, n) {
  const a = []
  for (let i = 0; i <= n; i++) {
    const t = a0 + ((a1 - a0) * i) / n
    a.push([Math.cos(t) * r, Math.sin(t) * r, 0])
  }
  return a
}

/** 螺旋（半径由 r0 线性过渡到 r1，转 `turns` 圈） */
export function spiralPts(r0, r1, turns, n, a0) {
  const a = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const ang = a0 + t * turns * Math.PI * 2
    const rr = r0 + (r1 - r0) * t
    a.push([Math.cos(ang) * rr, Math.sin(ang) * rr, 0])
  }
  return a
}

/** 波纹环（半径上叠加正弦起伏；固定 120 段） */
export function wavyRingPts(r, waves, amp, ph) {
  const a = []
  const n = 120
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2
    const rr = r + Math.sin(t * waves + ph) * amp
    a.push([Math.cos(t) * rr, Math.sin(t) * rr, 0])
  }
  return a
}

/** 锯齿环（内外半径交替，形成齿轮状） */
export function zigPts(r1, r2, teeth) {
  const a = []
  const n = teeth * 2
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2
    const rr = i % 2 ? r1 : r2
    a.push([Math.cos(t) * rr, Math.sin(t) * rr, 0])
  }
  return a
}

/**
 * @param {object} deps
 * @param {(x: number, y: number, z: number) => THREE.Vector3} deps.V 向量简写（来自 `sketch.js`）
 */
export function createShapes2d({ V }) {
  /** 点列 → 线 / 闭合折线 */
  function lineFromPts(pts, mat, loop) {
    const g = new THREE.BufferGeometry().setFromPoints(pts.map((p) => V(p[0], p[1], p[2])))
    return loop ? new THREE.LineLoop(g, mat) : new THREE.Line(g, mat)
  }

  /** 线段对 → 一次性 LineSegments（比逐条 Line 少 draw call） */
  function segsFromPairs(pairs, mat) {
    const pts = []
    for (const pr of pairs) pts.push(V(pr[0][0], pr[0][1], 0), V(pr[1][0], pr[1][1], 0))
    return new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), mat)
  }

  return { lineFromPts, segsFromPairs }
}
