/**
 * 单元测试 —— 统一交互（`J2.6`）
 *
 * 运行：`node --test "tests/unit/*.test.mjs"`
 *
 * 这一组守两件事：
 *
 * 1. **★ DoD**：「新增一个交互的"改动文件数" = 1」—— 用"只做一次 `registerProximity()`
 *    就出现在近距判定里"来证明（另一半"新增一盏灯"在 `lighting.test.mjs`）。
 * 2. **零差异的前提**：`aimTarget()` 必须**按注册顺序短路** ——
 *    搬迁前的行为是"铰链命中就返回、否则试魔法物件、再试壁炉"，
 *    顺序一变，同一次点击就会命中不同的物件。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { createInteractionSystem } from '../../src/cabin/systems/interaction/InteractionSystem.js'
import { defineInteractable, makeTarget, ancestorVisible } from '../../src/cabin/systems/interaction/types.js'

/** 造一个位于 (x,0,0) 的命中体，射线沿 -x 打过去时按 x 从小到大命中 */
function meshAt(x, extra = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5))
  m.position.set(x, 0, 0)
  Object.assign(m.userData, extra)
  // ⚠️ three 的 Raycaster 用 matrixWorld 做求交，而 matrixWorld 平时由渲染循环更新 ——
  //    单元测试里必须手动更新，否则射线永远打不中（这一步踩过）。
  m.updateMatrixWorld(true)
  return m
}

/** 从原点朝 -x 方向的射线 */
function rayTowardNegX() {
  const rc = new THREE.Raycaster(new THREE.Vector3(0, 0, 0), new THREE.Vector3(-1, 0, 0))
  return rc
}

test('★ 新增一个交互 = 注册一次（DoD：改动文件数 = 1）', () => {
  const registryEntries = []
  const sys = createInteractionSystem({ registry: { registerInteractable: (e) => registryEntries.push(e) } })
  // 现有 9 条（模拟）
  for (let i = 0; i < 9; i++) {
    sys.registerProximity({ id: `old-${i}`, label: `旧交互 ${i}`, mode: 'proximity', anchor: { x: i * 10, z: 0 }, radius: 1, onActivate: () => {} })
  }
  // 新增一条：**只做一次 registerProximity**
  const added = sys.registerProximity({
    id: 'floor1/new-thing',
    label: '看看这个新东西',
    mode: 'proximity',
    anchor: { x: 2, z: 3 },
    radius: 1.8,
    onActivate: () => {},
  })
  assert.equal(sys.proximityEntries.length, 10)
  assert.equal(registryEntries.length, 10, '同时进了注册中心（进度可视化读它）')
  assert.ok(sys.nearestTarget({ x: 2.2, z: 3.1 }, {}) === added, '走到跟前就能选中它')
})

test('aimTarget：按注册顺序短路（与搬迁前的三段优先一致）', () => {
  const sys = createInteractionSystem()
  const hinges = [meshAt(-5, { hingeGroup: { userData: { aimLabel: '开 / 关门' } } })]
  const magic = [meshAt(-3, { magicRoot: { userData: { aimLabel: '点亮水晶球' } } })]
  const fire = [meshAt(-8)]
  sys.registerAimSource({ id: 'hinges', meshes: hinges, resolve: (h) => makeTarget({ id: 'hinge:door', label: h.object.userData.hingeGroup.userData.aimLabel, activate: () => {} }) })
  sys.registerAimSource({ id: 'magic', meshes: magic, resolve: (h) => makeTarget({ id: 'magic:x', label: h.object.userData.magicRoot.userData.aimLabel, activate: () => {} }) })
  sys.registerAimSource({ id: 'fire', meshes: fire, resolve: () => makeTarget({ id: 'fire', label: '点燃 / 熄灭壁炉', activate: () => {} }) })

  // 铰链组先注册 ⇒ 即使壁炉更近，也先返回铰链（这就是原来的短路行为）
  const t = sys.aimTarget(rayTowardNegX())
  assert.equal(t.id, 'hinge:door')
  assert.equal(sys.lastAim.source, 'hinges')
})

test('aimTarget：不可见的祖先被过滤（ancestorVisible）', () => {
  const sys = createInteractionSystem()
  const hidden = new THREE.Group()
  hidden.visible = false
  const m = meshAt(-1, { magicRoot: { userData: {} } })
  hidden.add(m)
  hidden.updateMatrixWorld(true)
  sys.registerAimSource({ id: 'magic', meshes: [m], resolve: () => makeTarget({ id: 'x', label: 'x', activate: () => {} }) })
  assert.equal(sys.aimTarget(rayTowardNegX()), null, '祖先不可见 ⇒ 不构成交互')
  hidden.visible = true
  assert.ok(sys.aimTarget(rayTowardNegX()))
})

test('aimTarget：resolve 返回 null 时继续尝试下一个源', () => {
  const sys = createInteractionSystem()
  sys.registerAimSource({ id: 'a', meshes: [meshAt(-1)], resolve: () => null })
  sys.registerAimSource({ id: 'b', meshes: [meshAt(-2)], resolve: () => makeTarget({ id: 'b', label: 'B', activate: () => {} }) })
  const t = sys.aimTarget(rayTowardNegX())
  assert.equal(t.id, 'b')
})

test('aimTarget：meshes 可以是函数（支持"稍后才建好"的命中集合）', () => {
  const sys = createInteractionSystem()
  let arr = []
  sys.registerAimSource({ id: 'lazy', meshes: () => arr, resolve: () => makeTarget({ id: 'lazy', label: 'L', activate: () => {} }) })
  assert.equal(sys.aimTarget(rayTowardNegX()), null, '空集合 ⇒ 不命中')
  arr = [meshAt(-1)]
  assert.ok(sys.aimTarget(rayTowardNegX()))
})

test('nearestTarget：取半径内最近的一条；超出半径不选', () => {
  const sys = createInteractionSystem()
  const far = sys.registerProximity({ id: 'far', label: '远', mode: 'proximity', anchor: { x: 10, z: 0 }, radius: 3, onActivate: () => {} })
  const near = sys.registerProximity({ id: 'near', label: '近', mode: 'proximity', anchor: { x: 1, z: 0 }, radius: 3, onActivate: () => {} })
  assert.equal(sys.nearestTarget({ x: 0, z: 0 }, {}), near, '都在半径内时取更近的')
  assert.equal(sys.nearestTarget({ x: 20, z: 0 }, {}), null, '都不在半径内')
  assert.ok(far)
})

test('nearestTarget：fullHouseOnly 的条目只在完整小屋形态下参与', () => {
  const sys = createInteractionSystem()
  sys.registerProximity({ id: 'back-window', label: '开 / 关后窗', mode: 'proximity', anchor: { x: 0, z: 0 }, radius: 5, fullHouseOnly: true, onActivate: () => {} })
  assert.equal(sys.nearestTarget({ x: 0, z: 0 }, { fullHouse: false }), null)
  assert.ok(sys.nearestTarget({ x: 0, z: 0 }, { fullHouse: true }))
})

test('activate：计数可在 stats 里看到（e2e 可断言"确实触发过"）', () => {
  let n = 0
  const sys = createInteractionSystem()
  const e = sys.registerProximity({ id: 'lamp', label: '点亮 / 熄灭魔法吊灯', mode: 'proximity', anchor: { x: 0, z: 0 }, radius: 1, onActivate: () => n++ })
  assert.equal(sys.activate(e), true)
  assert.equal(sys.activate(e), true)
  assert.equal(sys.activate(null), false)
  assert.equal(n, 2)
  assert.deepEqual(sys.stats().activations, { lamp: 2 })
})

test('defineInteractable 的校验：label 必填且非空', () => {
  assert.throws(() => defineInteractable({ id: 'x', mode: 'proximity', anchor: { x: 0, z: 0 }, radius: 1, onActivate: () => {} }), /语义化 label/)
  assert.throws(() => defineInteractable({ id: 'x', label: '   ', mode: 'proximity', anchor: { x: 0, z: 0 }, radius: 1, onActivate: () => {} }), /语义化 label/)
})

test('defineInteractable 的校验：含 proximity 就必须有 anchor/radius/onActivate', () => {
  assert.throws(() => defineInteractable({ id: 'x', label: 'L', mode: 'proximity', radius: 1, onActivate: () => {} }), /anchor/)
  assert.throws(() => defineInteractable({ id: 'x', label: 'L', mode: 'proximity', anchor: { x: 0, z: 0 }, onActivate: () => {} }), /radius/)
  assert.throws(() => defineInteractable({ id: 'x', label: 'L', mode: 'proximity', anchor: { x: 0, z: 0 }, radius: 1 }), /onActivate/)
  // mode 含 aim 时不需要 proximity 三件套
  assert.ok(defineInteractable({ id: 'x', label: 'L', mode: 'aim' }))
})

test('defineInteractable：mode 只接受三种值', () => {
  assert.throws(() => defineInteractable({ id: 'x', label: 'L', mode: '鼠标' }), /mode 非法/)
  for (const mode of ['aim', 'proximity', 'both']) {
    const e = defineInteractable({ id: 'x', label: 'L', mode, anchor: { x: 0, z: 0 }, radius: 1, onActivate: () => {} })
    assert.equal(e.mode, mode)
  }
})

test('registerAimSource 的校验', () => {
  const sys = createInteractionSystem()
  assert.throws(() => sys.registerAimSource({ meshes: [], resolve: () => null }), /字符串 id/)
  assert.throws(() => sys.registerAimSource({ id: 'a', meshes: '不是数组', resolve: () => null }), /数组/)
  assert.throws(() => sys.registerAimSource({ id: 'a', meshes: [] }), /resolve/)
})

test('ancestorVisible：自身或任一祖先不可见即为 false', () => {
  const g = new THREE.Group()
  const m = new THREE.Mesh()
  g.add(m)
  assert.equal(ancestorVisible(m), true)
  g.visible = false
  assert.equal(ancestorVisible(m), false)
  m.visible = false
  assert.equal(ancestorVisible(m), false)
})
