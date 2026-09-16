/**
 * 单元测试 —— 光照场（`J2.3`）
 *
 * 运行：`node --test "tests/unit/*.test.mjs"`
 *
 * 这一组测试守的是 `J2` 的 DoD 之一：
 *
 * > **新增一盏灯 / 一个交互的"改动文件数" = 1**（要写测试用例证明）
 *
 * 这里的证明方式是：造一份假的 FILL 材质，注册第 9 盏灯，断言它**只通过一次
 * `register()` 调用**就进入了 uniform —— 不改 shader、不改槽位代码、不碰 monolith。
 *
 * 另一半是**槽位顺序**：shader 的闪烁相位含 `float(i)`，所以"注册顺序 = 槽位顺序"
 * 是画面零差异的前提，必须锁死。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { createLightField } from '../../src/cabin/core/lighting/LightField.js'
import { createPointLightSource } from '../../src/cabin/core/lighting/PointLightSource.js'
import { POINT_LIGHT_SLOTS } from '../../src/cabin/core/materials/FillMaterial.js'

/** 一份与真 FILL 同构的假材质（只要 uniform 的形状对） */
function fakeFill(slots = POINT_LIGHT_SLOTS) {
  return {
    uniforms: {
      uPtPos: { value: Array.from({ length: slots }, () => new THREE.Vector3()) },
      uPtCol: { value: Array.from({ length: slots }, () => new THREE.Color()) },
      uPtCfg: { value: Array.from({ length: slots }, () => new THREE.Vector4()) },
      uPtCount: { value: slots },
    },
  }
}

const lamp = (id, opts = {}) =>
  createPointLightSource({
    id,
    slot: opts.slot,
    position: opts.position || [0, 1, 0],
    color: opts.color ?? 0xffffff,
    radius: opts.radius ?? 4,
    strength: opts.strength ?? 1,
    yMin: opts.yMin ?? 0,
    yMax: opts.yMax ?? 3.04,
    priority: opts.priority,
  })

test('槽位顺序 = 注册顺序（画面零差异的前提）', () => {
  const fill = fakeFill()
  const lf = createLightField({ fillMaterial: fill })
  lf.register(lamp('a', { position: [1, 0, 0], color: 0xff0000 }))
  lf.register(lamp('b', { position: [2, 0, 0], color: 0x00ff00 }))
  lf.register(lamp('c', { position: [3, 0, 0], color: 0x0000ff }))
  lf.update(0, 0)
  assert.equal(fill.uniforms.uPtPos.value[0].x, 1)
  assert.equal(fill.uniforms.uPtPos.value[1].x, 2)
  assert.equal(fill.uniforms.uPtPos.value[2].x, 3)
  assert.equal(fill.uniforms.uPtCol.value[0].getHex(), 0xff0000)
  assert.equal(fill.uniforms.uPtCount.value, 3)
})

test('★ 新增一盏灯 = 注册一次（DoD：改动文件数 = 1）', () => {
  const fill = fakeFill()
  const warn = []
  const lf = createLightField({ fillMaterial: fill, warn: (m) => warn.push(m) })
  // 先铺满 8 盏（模拟现有场景）
  for (let i = 0; i < POINT_LIGHT_SLOTS; i++) lf.register(lamp(`old-${i}`, { position: [i, 0, 0] }))
  lf.update(0, 0)
  assert.equal(fill.uniforms.uPtCount.value, POINT_LIGHT_SLOTS)

  // 第 9 盏：**只做一次 register** —— 不改 shader、不改槽位代码、不碰 monolith
  const extra = lamp('new-lamp', { position: [42, 1, 42], color: 0x123456, strength: 2 })
  lf.register(extra)
  assert.ok(lf.sources.includes(extra), '新灯已在光源表里')
  assert.equal(lf.stats().registered, 9, '注册数 +1')
  assert.equal(warn.length, 1, '超编只警告一次（提示可提升 POINT_LIGHT_SLOTS）')

  // 它按强度参与竞争并占到一个槽位 —— 全程没有第二处改动
  lf.update(0, 0)
  const xs = fill.uniforms.uPtPos.value.map((v) => v.x)
  assert.ok(xs.includes(42), '新增的灯进入了渲染槽位')
  assert.equal(fill.uniforms.uPtCount.value, POINT_LIGHT_SLOTS, '槽位上限不变')
})

test('空槽位被清零（否则上一帧的残留值会继续影响画面）', () => {
  const fill = fakeFill()
  const lf = createLightField({ fillMaterial: fill })
  lf.register(lamp('a'))
  lf.register(lamp('b'))
  lf.register(lamp('c'))
  lf.update(0, 0)
  for (let i = 3; i < POINT_LIGHT_SLOTS; i++) {
    assert.equal(fill.uniforms.uPtCfg.value[i].y, 0, `槽位 ${i} 的强度应为 0（shader 会 continue）`)
  }
})

test('强度支持函数形式，并拿到 time / dt', () => {
  const fill = fakeFill()
  const lf = createLightField({ fillMaterial: fill })
  lf.register(lamp('breathing', { strength: (t) => 0.5 + 0.5 * Math.sin(t) }))
  lf.update(Math.PI / 2, 0)
  assert.ok(Math.abs(fill.uniforms.uPtCfg.value[0].y - 1) < 1e-9)
})

test('强度返回非有限值时按 0 处理（不把 NaN 送进 shader）', () => {
  const fill = fakeFill()
  const lf = createLightField({ fillMaterial: fill })
  lf.register(lamp('bad', { strength: () => NaN }))
  lf.update(0, 0)
  assert.equal(fill.uniforms.uPtCfg.value[0].y, 0)
})

test('超编裁剪：强度为 0 的灯最先让位，且同强度时保持注册顺序', () => {
  const fill = fakeFill()
  const lf = createLightField({ fillMaterial: fill, warn: () => {} })
  // 第 9 盏强度最高 → 应当挤掉一盏强度为 0 的
  for (let i = 0; i < POINT_LIGHT_SLOTS; i++) lf.register(lamp(`s${i}`, { position: [i, 0, 0], strength: i === 0 ? 0 : 1 }))
  lf.register(lamp('bright', { position: [99, 0, 0], strength: 2 }))
  lf.update(0, 0)
  const xs = fill.uniforms.uPtPos.value.map((v) => v.x)
  assert.ok(xs.includes(99), '强度最高的新灯必须在槽位里')
  assert.ok(!xs.includes(0), '强度为 0 的那盏应当让位')
})

test('createPointLightSource 校验：id 必填、position 必须三元', () => {
  assert.throws(() => createPointLightSource({ position: [0, 0, 0] }), /需要字符串 id/)
  assert.throws(() => createPointLightSource({ id: 'x', position: [0, 0] }), /三元数组/)
})

test('createLightField 校验：材质必须带 uPtPos/uPtCol/uPtCfg', () => {
  assert.throws(() => createLightField({ fillMaterial: {} }), /FILL 材质/)
})

test('unregister 按 id 移除（★ 且不移位 —— 索引就是槽位号）', () => {
  const lf = createLightField({ fillMaterial: fakeFill() })
  lf.register(lamp('a'))
  lf.register(lamp('b'))
  assert.equal(lf.unregister('a'), true)
  assert.equal(lf.unregister('不存在'), false)
  assert.deepEqual(lf.stats().ids, ['b'])
  // ★ J4.18：移除是**留洞**而不是 `splice` —— 移位会让后面所有灯集体换槽，
  //   而 shader 的闪烁相位含 `float(i)` ⇒ 画面立刻变。'b' 必须还在 1 号槽。
  assert.equal(lf.sources[1].id, 'b', 'b 没有被挤到 0 号槽')
  assert.equal(lf.sources[0], undefined, '0 号槽是洞（由 update() 写成强度 0）')
})

/* ==========================================================================
 * ★ J4.18：`slot` —— 槽位脱离注册时机
 *
 * 病根：8 盏灯原本全在 `world/lights.js` **一次注册完**（段 03 之后），槽位 = 注册位次；
 * 而物件在段 08–10 装配 ⇒ 把一盏灯的注册跟着物件搬走，槽位就变，画面就变。
 * 这就是 `J3` 判定「6 件含光源物件搬不动」的唯一原因。
 *
 * 下面两条是这一契约的判据：
 *   ① **等价性** —— 显式 `slot: 0…7` 与原来的"按顺序 push"必须产出**逐位相同**的 uniform；
 *   ② **定序** —— 声明 `slot` 的灯，落在哪个槽只由它自己决定，与注册先后无关。
 * ======================================================================== */

/** 把整张 uniform 读成可比较的普通值（逐槽：位置 / 颜色 / 强度 / yMin / yMax） */
function readUniform(fill) {
  return fill.uniforms.uPtPos.value.map((p, i) => ({
    pos: [p.x, p.y, p.z],
    col: fill.uniforms.uPtCol.value[i].getHex(),
    cfg: [
      fill.uniforms.uPtCfg.value[i].x,
      fill.uniforms.uPtCfg.value[i].y,
      fill.uniforms.uPtCfg.value[i].z,
      fill.uniforms.uPtCfg.value[i].w,
    ],
  }))
}

test('★ J4.18 等价性：显式 slot 0…7 与原「按注册顺序填充」逐位相同', () => {
  const specs = Array.from({ length: POINT_LIGHT_SLOTS }, (_, i) => ({
    id: `lamp-${i}`,
    position: [i * 1.5, 0.5 + i * 0.1, -i],
    color: [0xffb066, 0x6fa8ff, 0x9b6fe8, 0xffa858, 0xb5a0f2, 0xffc06a, 0xffe08a, 0x9bc0e8][i],
    radius: 3 + i * 0.2,
    strength: i === 5 ? 0.92 : () => 0.5 + i,
    yMin: i >= 5 ? 3.02 : 0.0,
    yMax: i >= 5 ? 6.9 : 3.04,
  }))

  // 路径 A：原来那一种 —— 不声明 slot，按注册顺序填充（0,1,2…7）
  const fillA = fakeFill()
  const lfA = createLightField({ fillMaterial: fillA })
  for (const sp of specs) lfA.register(lamp(sp.id, sp))
  lfA.update(1.25, 0.016)

  // 路径 B：J4.18 这一种 —— 每盏显式写自己的槽位，且**故意乱序注册**
  const fillB = fakeFill()
  const lfB = createLightField({ fillMaterial: fillB })
  for (const sp of [...specs].reverse()) lfB.register(lamp(sp.id, { ...sp, slot: specs.indexOf(sp) }))
  lfB.update(1.25, 0.016)

  assert.deepEqual(readUniform(fillB), readUniform(fillA), '两条路径必须产出逐位相同的 uniform')
  assert.equal(fillB.uniforms.uPtCount.value, fillA.uniforms.uPtCount.value)
})

test('★ J4.18 定序：声明 slot 的灯落在它自己的槽位，与注册先后无关', () => {
  const fill = fakeFill()
  const lf = createLightField({ fillMaterial: fill })
  // 先注册"最后一个槽"的灯 —— 若仍按注册顺序，它会落到 0 号槽
  lf.register(lamp('moon-plant', { slot: 7, position: [7, 0, 0] }))
  lf.register(lamp('lantern', { slot: 0, position: [0, 0, 0] }))
  lf.update(0, 0)
  assert.equal(fill.uniforms.uPtPos.value[0].x, 0, 'lantern 必须在 0 号槽')
  assert.equal(fill.uniforms.uPtPos.value[7].x, 7, 'moon-plant 必须在 7 号槽')
  // 中间的洞被写成强度 0（shader 的 `if (ptS < 0.003) continue` 会跳过）
  for (let i = 1; i < 7; i++) assert.equal(fill.uniforms.uPtCfg.value[i].y, 0, `槽位 ${i} 应为空`)
})

test('★ J4.18 槽位冲突：后来者被拒（不静默换掉先到者），并给出警告', () => {
  const fill = fakeFill()
  const warn = []
  const lf = createLightField({ fillMaterial: fill, warn: (m) => warn.push(m) })
  const first = lamp('lantern', { slot: 0, position: [1, 0, 0] })
  const second = lamp('impostor', { slot: 0, position: [2, 0, 0] })
  lf.register(first)
  assert.equal(lf.register(second), first, '被拒时返回占位者')
  lf.update(0, 0)
  assert.equal(fill.uniforms.uPtPos.value[0].x, 1, '先到者仍在槽位上')
  assert.equal(lf.stats().registered, 1, '被拒的灯没有被算作已注册')
  assert.equal(warn.length, 1)
  assert.match(warn[0], /占用/)
})

test('★ J4.18 槽位越界：拒绝注册并警告（不静默落进别的槽）', () => {
  const warn = []
  const lf2 = createLightField({ fillMaterial: fakeFill(), warn: (m) => warn.push(m) })
  assert.equal(lf2.register(lamp('over', { slot: POINT_LIGHT_SLOTS })), null)
  assert.equal(lf2.register(lamp('negative', { slot: -1 })), null)
  assert.equal(lf2.stats().registered, 0)
  assert.equal(warn.length, 2)
  assert.match(warn[0], /越界/)
})

test('★ J4.18 校验：slot 必须是整数（或省略）', () => {
  assert.throws(() => createPointLightSource({ id: 'x', position: [0, 0, 0], slot: 1.5 }), /slot 必须是整数/)
  assert.throws(() => createPointLightSource({ id: 'x', position: [0, 0, 0], slot: '0' }), /slot 必须是整数/)
  // 省略 / null 都合法（= 走注册顺序）
  assert.equal(createPointLightSource({ id: 'x', position: [0, 0, 0] }).slot, null)
  assert.equal(createPointLightSource({ id: 'x', position: [0, 0, 0], slot: null }).slot, null)
})
