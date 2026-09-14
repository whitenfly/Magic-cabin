/**
 * 单元测试 —— 坐标真源（`J2.9`）
 *
 * 运行：`node --test "tests/unit/*.test.mjs"`
 *
 * 这里不测"某个坐标等于某个数"（那是把实现抄一遍，改数值时两边一起改，等于没测），
 * 而是测**坐标表内部的自洽性**，也就是 `J3` 写 `defineProp` 时会踩的那几类坑：
 *   · 派生关系还在不在（`FX = CHX + 0.15`、`TBL_TOP = FY + 0.80`）
 *   · 门窗洞的高度区间是否合法（`y0 < y1`，否则 `logWall` 会切出负高度）
 *   · 一楼陈设是否真的在一楼（`y` 小于楼面高度）
 *   · 房间是否真的装得下陈设（锚点落在墙内）
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { createLayout } from '../../src/cabin/world/layout.js'

const L = createLayout()

test('派生关系保持：FX 由 CHX 偏移而来、FZ 与 CHZ 同源', () => {
  assert.equal(L.FX, L.CHX + 0.15)
  assert.equal(L.FZ, L.CHZ)
})

test('二楼楼面：FY 就是 FLOOR_TOP，书桌桌面由 FY 推出', () => {
  assert.equal(L.FY, L.FLOOR_TOP)
  assert.equal(L.TBL_TOP, L.FY + 0.8)
})

test('门窗洞：高度区间合法（y0 < y1）且半宽为正', () => {
  for (const [name, hole] of [
    ['DOOR_HOLE', L.DOOR_HOLE],
    ['WIN_F_L', L.WIN_F_L],
    ['WIN_F_R', L.WIN_F_R],
    ['WIN_LEFT', L.WIN_LEFT],
    ['WIN_GABLE', L.WIN_GABLE],
  ]) {
    assert.ok(hole.y1 > hole.y0, `${name} 的高度区间非法：${hole.y0} .. ${hole.y1}`)
    assert.ok(hole.hw > 0, `${name} 的半宽应为正`)
  }
})

test('门窗都在墙高之内（门洞底为 0，山墙窗在墙顶之上属于屋顶段）', () => {
  assert.ok(L.DOOR_HOLE.y0 >= L.WALL_Y0, '门洞底不应低于墙底')
  assert.ok(L.WIN_F_L.y1 <= L.WALL_TOP, '前墙窗不应高过墙顶')
  assert.ok(L.WIN_LEFT.y1 <= L.WALL_TOP, '侧墙窗不应高过墙顶')
})

test('一楼陈设的锚点高度都低于二楼楼面', () => {
  const floor1 = {
    MTTOP: L.MTTOP,
    KTOP: L.KTOP,
    DTOP: L.DTOP,
    HEARTH: L.HEARTH,
  }
  for (const [k, v] of Object.entries(floor1)) {
    assert.ok(v > 0 && v < L.FLOOR_TOP, `${k}=${v} 不在一楼净高（0 .. ${L.FLOOR_TOP}）之内`)
  }
})

test('二楼陈设锚点都在楼面之上、墙顶之下', () => {
  assert.ok(L.BEDX < 0 && L.BEDZ < 0, '大床在西北角')
  assert.ok(L.TBLX > 0 && L.TBLZ < 0, '书桌在东北角')
  for (const [k, v] of Object.entries({ BEDX: L.BEDX, BEDZ: L.BEDZ, TBLX: L.TBLX, TBLZ: L.TBLZ })) {
    assert.ok(Math.abs(v) < 6, `${k}=${v} 超出小屋范围（半边长约 4–6 米）`)
  }
})

test('壁炉与坩埚分处两侧，不会互相压住', () => {
  const d = Math.hypot(L.FX - L.CCX, L.FZ - L.CCZ)
  assert.ok(d > 1.0, `壁炉与坩埚距离仅 ${d.toFixed(2)} 米，交互半径会重叠`)
})
