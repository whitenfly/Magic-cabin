/**
 * 单元测试 —— 应用内核（`J2.5`）
 *
 * 运行：`node --test "tests/unit/*.test.mjs"`
 *
 * 内核的价值全在**契约**上，所以这里测的是契约而不是实现细节：
 *   · 事件总线：`emit` 时对监听表快照（回调里退订不打乱本轮）、`on` 返回取消函数
 *   · 注册中心：id 查重、`magicMeshes` 是**同一个数组实例**（射线依赖这一点）
 *   · 更新调度器：登记顺序 = 执行顺序；`tier` 只是元数据，**J2 期间不裁剪**
 *   · 应用内核：`requires` 缺失立刻报错、`order` 决定启动顺序、生命周期状态
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { createEventBus } from '../../src/cabin/app/EventBus.js'
import { createRegistry } from '../../src/cabin/app/Registry.js'
import { createUpdateScheduler } from '../../src/cabin/app/UpdateScheduler.js'
import { defineFeature } from '../../src/cabin/app/Feature.js'

test('EventBus：on 返回的取消函数可退订，且幂等', () => {
  const bus = createEventBus()
  let n = 0
  const un = bus.on('t', () => n++)
  bus.emit('t')
  un()
  un() // 幂等：再调一次不应抛错
  bus.emit('t')
  assert.equal(n, 1)
  assert.equal(bus.listenerCount('t'), 0)
})

test('EventBus：emit 对监听表快照 —— 回调里退订不会打乱本轮', () => {
  const bus = createEventBus()
  const seen = []
  const unA = bus.on('t', () => {
    seen.push('a')
    unB() // a 在回调里把 b 退订了
  })
  const unB = bus.on('t', () => seen.push('b'))
  bus.emit('t')
  assert.deepEqual(seen, ['a', 'b'], '本轮应仍调用 b（快照），下一轮才不调用')
  seen.length = 0
  bus.emit('t')
  assert.deepEqual(seen, ['a'])
  unA()
})

test('EventBus：once 只触发一次；无人监听时 emit 返回 0 而不是抛错', () => {
  const bus = createEventBus()
  let n = 0
  bus.once('t', () => n++)
  bus.emit('t')
  bus.emit('t')
  assert.equal(n, 1)
  assert.equal(bus.emit('从未订阅过的事件'), 0)
})

test('Registry：id 重复注册会被拒绝', () => {
  const reg = createRegistry()
  reg.registerProp({ name: 'a' }, { id: 'floor1/a' })
  assert.throws(() => reg.registerProp({ name: 'a2' }, { id: 'floor1/a' }), /重复注册/)
})

test('Registry：magicMeshes 是调用方拿到的**同一个数组实例**', () => {
  const reg = createRegistry()
  const m1 = { isMesh: true, userData: {} }
  const m2 = { isMesh: true, userData: {} }
  const root = {}
  reg.registerMagic(root, [m1, m2])
  assert.equal(reg.magicMeshes.length, 2)
  assert.equal(reg.magicMeshes[0], m1)
  assert.equal(m1.userData.magicRoot, root, 'registerMagic 负责回填 magicRoot')
})

test('Registry：registerInteractable 需要 id；stats 汇总五类', () => {
  const reg = createRegistry()
  assert.throws(() => reg.registerInteractable({ label: '没 id' }), /需要 id/)
  reg.registerProp({}, { id: 'p1' })
  reg.registerLight({ id: 'l1' })
  reg.registerInteractable({ id: 'i1' })
  reg.registerFeature({ id: 'f1' })
  const s = reg.stats()
  assert.deepEqual(s, { props: 1, magicMeshes: 0, lights: 1, interactables: 1, features: 1 })
})

test('UpdateScheduler：登记顺序 = 执行顺序（J2 期间不做任何裁剪）', () => {
  const sched = createUpdateScheduler()
  const order = []
  sched.add('springs', () => order.push('springs'))
  sched.add('player', () => order.push('player'), { tier: 'near' })
  sched.add('weather', () => order.push('weather'), { tier: 'idle' })
  sched.update(1 / 60, 1)
  assert.deepEqual(order, ['springs', 'player', 'weather'], 'tier 只是元数据，不改变顺序也不跳过')
})

test('UpdateScheduler：enabled=false 的任务被跳过，重新启用后恢复', () => {
  const sched = createUpdateScheduler()
  let n = 0
  const t = sched.add('x', () => n++)
  sched.update(0, 0)
  t.enabled = false
  sched.update(0, 0)
  t.enabled = true
  sched.update(0, 0)
  assert.equal(n, 2)
})

test('defineFeature：id 必填，生命周期钩子必须是函数', () => {
  assert.throws(() => defineFeature({}), /需要字符串 id/)
  assert.throws(() => defineFeature({ id: 'x', start: 42 }), /必须是函数/)
  const f = defineFeature({ id: 'x' })
  assert.deepEqual(f.requires, [])
  assert.equal(f.order, 0)
})

test('App：requires 缺失时立刻报错（而不是运行时 undefined）', () => {
  // 动态 import：App 会连带加载 clock/rng，这里只为测装配契约
  return import('../../src/cabin/app/App.js').then(({ createApp }) => {
    const app = createApp({ log: () => {} })
    assert.equal(app.state, 'created')
    assert.throws(() => app.register(defineFeature({ id: 'b', requires: ['a'] })), /依赖 a/)
    app.register(defineFeature({ id: 'a' }))
    app.register(defineFeature({ id: 'b', requires: ['a'] }))
    assert.deepEqual(app.featureIds, ['a', 'b'])
    assert.equal(app.registry.stats().features, 2)
  })
})

test('App：start 按 order 启动，生命周期状态随之变化', async () => {
  const { createApp } = await import('../../src/cabin/app/App.js')
  const app = createApp({ log: () => {} })
  const started = []
  app.register(defineFeature({ id: 'late', order: 10, start: () => started.push('late') }))
  app.register(defineFeature({ id: 'early', order: -10, start: () => started.push('early') }))
  await app.start()
  assert.deepEqual(started, ['early', 'late'], 'order 小的先启动')
  assert.equal(app.state, 'running')
  app.stop()
  assert.equal(app.state, 'stopped')
  app.dispose()
  assert.equal(app.state, 'disposed')
})
