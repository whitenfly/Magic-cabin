/**
 * 单元测试 —— 材质与 shader（`J2.2`）
 *
 * 运行：`node --test "tests/unit/*.test.mjs"`
 *
 * 这一组测试守的是**跨文件的一致性**：`POINT_LIGHT_SLOTS`（JS 侧的槽位上限）
 * 与 shader 里的数组声明必须同步。`J2.3` 的 `LightField` 要在这两者之间做注册式填充，
 * 一旦一方改了另一方没跟上，画面会静默错乱（多余的槽位不生效、或着色器编译失败）。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { FILL_VERT } from '../../src/cabin/core/materials/fill.vert.glsl.js'
import { FILL_FRAG } from '../../src/cabin/core/materials/fill.frag.glsl.js'
import { POINT_LIGHT_SLOTS } from '../../src/cabin/core/materials/FillMaterial.js'

test('FILL 顶点着色器交出世界坐标与法线（光照在世界空间里算）', () => {
  assert.ok(FILL_VERT.includes('varying vec3 vWorldPos'), '缺少 vWorldPos')
  assert.ok(FILL_VERT.includes('varying vec3 vWorldNormal'), '缺少 vWorldNormal')
})

test('FILL 片元着色器保留三段光照（炉火 / 吊灯 / 点光源）', () => {
  for (const anchor of ['一楼炉火', '二楼魔法吊灯', '室内点光源']) {
    assert.ok(FILL_FRAG.includes(anchor), `shader 里缺少「${anchor}」这一段`)
  }
})

test('POINT_LIGHT_SLOTS 与 shader 的数组声明一致', () => {
  assert.equal(POINT_LIGHT_SLOTS, 8, 'JS 侧槽位上限应为 8')
  const decls = [
    ['uPtPos', 'uniform vec3 uPtPos[8];'],
    ['uPtCol', 'uniform vec3 uPtCol[8];'],
    ['uPtCfg', 'uniform vec4 uPtCfg[8];'],
  ]
  for (const [name, decl] of decls) {
    assert.ok(FILL_FRAG.includes(decl), `shader 缺少声明：${decl}（${name} 与 POINT_LIGHT_SLOTS 脱节）`)
  }
  assert.ok(FILL_FRAG.includes('uniform int uPtCount;'), 'shader 缺少 uPtCount')
})

test('片元着色器的点光源循环上界就是槽位上限', () => {
  assert.ok(/for \(int i = 0; i < \d+; i\+\+\)/.test(FILL_FRAG), '未找到点光源循环')
  const m = /for \(int i = 0; i < (\d+); i\+\+\)/.exec(FILL_FRAG)
  assert.equal(Number(m[1]), POINT_LIGHT_SLOTS, '循环上界与 POINT_LIGHT_SLOTS 不一致')
})
