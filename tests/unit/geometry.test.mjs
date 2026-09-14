/**
 * 单元测试 —— 几何模块（`J2.1`）
 *
 * 运行：`node --test tests/unit/`
 *
 * 零依赖：Node 22+ 自带的 `node:test` + `node:assert`。
 * 不引入 vitest / jest —— 与 `J0.4` 的 CDP 客户端同一个取舍（见 `01-完善路线图.md` §3 的
 * J0.4 实施要点「新增依赖：零」）。
 *
 * 为什么先测这几个函数：`shapes2d` 的点集函数是**纯函数**（输入数字、输出点列），
 * 是 24 层魔法阵的唯一来源 —— 它们一旦回归，画面会大规模变形而像素回归只会说"不一样"。
 * 单元测试把"错在哪一个函数"直接指出来。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ringPts,
  polyPts,
  starPts,
  arcPts,
  spiralPts,
  wavyRingPts,
  zigPts,
} from '../../src/cabin/core/geometry/shapes2d.js'

/** 点到原点距离（点列是 z=0 平面上的 [x,y,0]） */
const radiusOf = (p) => Math.hypot(p[0], p[1])

test('ringPts：点数等于 n，且每点都落在半径 r 上', () => {
  const pts = ringPts(2.5, 16)
  assert.equal(pts.length, 16)
  for (const p of pts) assert.ok(Math.abs(radiusOf(p) - 2.5) < 1e-12)
})

test('ringPts：rot 只做整体旋转，不改变点数与半径', () => {
  const a = ringPts(1, 8, 0)
  const b = ringPts(1, 8, Math.PI / 2)
  assert.equal(b.length, a.length)
  for (const p of b) assert.ok(Math.abs(radiusOf(p) - 1) < 1e-12)
  // 转 90° 后首点应落在原第二点的位置
  assert.ok(Math.abs(b[0][0] - a[2][0]) < 1e-12)
  assert.ok(Math.abs(b[0][1] - a[2][1]) < 1e-12)
})

test('polyPts：点数等于边数，顶点在半径 r 上', () => {
  const pts = polyPts(1.2, 6)
  assert.equal(pts.length, 6)
  for (const p of pts) assert.ok(Math.abs(radiusOf(p) - 1.2) < 1e-12)
})

test('starPts：点数等于 sides，且全部落在半径 r 上（跳点只改连线顺序）', () => {
  const pts = starPts(3, 5, 2)
  assert.equal(pts.length, 5)
  for (const p of pts) assert.ok(Math.abs(radiusOf(p) - 3) < 1e-12)
})

test('arcPts：含首尾两端，共 n+1 点；首尾角度正确', () => {
  const pts = arcPts(2, 0, Math.PI, 4)
  assert.equal(pts.length, 5)
  assert.ok(Math.abs(pts[0][0] - 2) < 1e-12) // a0 = 0 → (r, 0)
  assert.ok(Math.abs(pts[0][1]) < 1e-12)
  assert.ok(Math.abs(pts[4][0] + 2) < 1e-12) // a1 = π → (-r, 0)
  assert.ok(Math.abs(pts[4][1]) < 1e-12)
})

test('spiralPts：半径由 r0 线性过渡到 r1，共 n+1 点', () => {
  const pts = spiralPts(0.5, 3, 2, 8, 0)
  assert.equal(pts.length, 9)
  assert.ok(Math.abs(radiusOf(pts[0]) - 0.5) < 1e-12)
  assert.ok(Math.abs(radiusOf(pts[8]) - 3) < 1e-12)
  // 单调递增（本用例 r1 > r0）
  for (let i = 1; i < pts.length; i++) {
    assert.ok(radiusOf(pts[i]) >= radiusOf(pts[i - 1]) - 1e-12)
  }
})

test('wavyRingPts：固定 121 个点，半径落在 r ± amp 之间', () => {
  const r = 5.4
  const amp = 0.4
  const pts = wavyRingPts(r, 9, amp, 0)
  assert.equal(pts.length, 121)
  for (const p of pts) {
    const d = radiusOf(p)
    assert.ok(d >= r - amp - 1e-12 && d <= r + amp + 1e-12, `半径 ${d} 越界`)
  }
})

test('zigPts：点数为 teeth*2，内外半径交替', () => {
  const pts = zigPts(3.1, 4.6, 12)
  assert.equal(pts.length, 24)
  assert.ok(Math.abs(radiusOf(pts[0]) - 4.6) < 1e-12) // i=0 为偶数 → r2
  assert.ok(Math.abs(radiusOf(pts[1]) - 3.1) < 1e-12) // i=1 为奇数 → r1
})
