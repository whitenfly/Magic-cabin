/**
 * 单元测试 —— 环境广播（`J2.10`）
 *
 * 运行：`node --test "tests/unit/*.test.mjs"`
 *
 * 这一组守的是**解耦的实质**：需要响应环境的东西应该**订阅事件**，
 * 而不是去读别人的 `wx.type` / `uDaylight`（不变量 `N1`）。因此测试关心的是：
 *   · 天气变化**立刻**广播（离散量，不需要节流）；
 *   · 采光每帧在变但**不逐帧广播**（节流），只有跨过 1% 才 emit；
 *   · 采光写进 `uDaylight` 时走的是唯一入口（不会有人绕过它）；
 *   · 时间跨过 0.02 小时也会触发广播。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { createEnvironment } from '../../src/cabin/systems/weather/environment.js'
import { createEventBus } from '../../src/cabin/app/EventBus.js'

/** 假 FILL：只需要 uDaylight */
const fakeFill = () => ({ uniforms: { uDaylight: { value: 0 } } })

test('天气变化立刻广播 env:change（离散量不节流）', () => {
  const bus = createEventBus()
  const env = createEnvironment({ bus })
  const seen = []
  bus.on('env:change', (s) => seen.push(s))
  env.setWeather('snow')
  assert.equal(seen.length, 1)
  assert.equal(seen[0].weather, 'snow')
  assert.equal(env.setWeather('snow'), false, '设成同一个天气不算变化')
  assert.equal(seen.length, 1)
})

test('采光每帧在变，但只在跨过 1% 时才广播（节流）', () => {
  const bus = createEventBus()
  const env = createEnvironment({ bus })
  let n = 0
  bus.on('env:change', () => n++)
  env.applyDaylight(0)
  env.flush() // 首次：与"上一次"不同（lastEmitted 为空）⇒ 广播一次
  const base = n
  for (let i = 1; i <= 50; i++) {
    env.applyDaylight(0.005) // 每次只涨 0.5% —— 不会触发
    env.flush()
  }
  assert.equal(n, base, '累计 0.5% 以内的抖动不该广播')
  env.applyDaylight(0.2) // 一次跨过 1%
  assert.ok(env.flush(), '跨过阈值应广播')
  assert.equal(n, base + 1)
  assert.equal(env.flush(), null, '没有新变化时 flush 返回 null')
})

test('applyDaylight 是写 uDaylight 的唯一入口', () => {
  const fill = fakeFill()
  const env = createEnvironment({ bus: createEventBus(), fillMaterial: fill })
  env.applyDaylight(0.42)
  assert.equal(fill.uniforms.uDaylight.value, 0.42, '内部已写入 uniform')
  assert.equal(env.daylight, 0.42)
})

test('没有 fillMaterial 时不报错（单元测试 / 无材质的场景）', () => {
  const env = createEnvironment({ bus: createEventBus() })
  assert.equal(env.applyDaylight(0.3), 0.3)
  assert.equal(env.daylight, 0.3)
})

test('时间跨过 0.02 小时也会广播（"天黑了"这类判断靠它）', () => {
  const bus = createEventBus()
  const env = createEnvironment({ bus })
  env.setGameHour(10)
  env.flush()
  const before = env.emitted
  env.setGameHour(10.001)
  assert.equal(env.flush(), null, '0.001 小时的变化不触发')
  env.setGameHour(10.05)
  assert.ok(env.flush())
  assert.equal(env.emitted, before + 1)
})

test('snapshot 交出的是当前环境量（订阅者收到的就是它）', () => {
  const env = createEnvironment({ bus: createEventBus() })
  env.setWeather('rain')
  env.applyDaylight(0.7)
  env.setGameHour(17.5)
  assert.deepEqual(env.snapshot(), { weather: 'rain', daylight: 0.7, gameHour: 17.5 })
})

test('createEnvironment 的参数校验', () => {
  assert.throws(() => createEnvironment({}), /事件总线/)
})

test('广播出去的对象与 snapshot 同构（订阅者拿到 weather/daylight/gameHour）', () => {
  const bus = createEventBus()
  const env = createEnvironment({ bus })
  let got = null
  bus.on('env:change', (s) => (got = s))
  env.applyDaylight(0.1)
  env.setWeather('fog')
  assert.equal(got.weather, 'fog')
  assert.equal(got.daylight, 0.1)
  assert.equal(typeof got.gameHour, 'number')
})

test('与 three 的 Color/Vector 无关：环境量是纯数据（可序列化）', () => {
  const env = createEnvironment({ bus: createEventBus() })
  const s = env.snapshot()
  assert.equal(typeof s.weather, 'string')
  assert.equal(typeof s.daylight, 'number')
  assert.equal(typeof s.gameHour, 'number')
  assert.ok(!(s.daylight instanceof THREE.Vector3))
})
