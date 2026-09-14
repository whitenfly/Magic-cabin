/**
 * 单元测试 —— 设置与持久化（`J2.8`）
 *
 * 运行：`node --test "tests/unit/*.test.mjs"`
 *
 * 持久化最容易出的三类问题，这里各有一组测试守着：
 *   1. **脏数据**把场景搞坏（手改过 `localStorage`）→ `coerceSetting` 钳制与拒绝；
 *   2. **测试被环境污染**（上次跑测试留下的音量/视角影响画面）→ `persist: false` 时只写内存；
 *   3. **写入风暴**（值没变也通知、也写盘）→ 值相同则不通知不写盘。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { createStore } from '../../src/cabin/app/store.js'
import { SETTINGS, defaultSettings, coerceSetting } from '../../src/cabin/app/settings.js'

/** 一个最小的内存 Storage 替身（并记录写入次数） */
function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    get size() {
      return map.size
    },
    raw: map,
  }
}

test('默认值覆盖全部设置项，且都是合法值', () => {
  const d = defaultSettings()
  assert.equal(Object.keys(d).length, SETTINGS.length)
  for (const def of SETTINGS) {
    const r = coerceSetting(def.key, d[def.key])
    assert.ok(r.ok, `${def.key} 的默认值不合法：${r.reason}`)
    assert.equal(r.value, def.default)
  }
})

test('coerceSetting：数字被 min/max 钳制，非法值被拒绝', () => {
  assert.deepEqual(coerceSetting('audio.volume', 5), { ok: true, value: 1 })
  assert.deepEqual(coerceSetting('audio.volume', -3), { ok: true, value: 0 })
  assert.equal(coerceSetting('audio.volume', '不是数字').ok, false)
  assert.equal(coerceSetting('view.mode', '第四人称').ok, false)
  assert.equal(coerceSetting('audio.enabled', 'true').ok, false, '字符串 "true" 不该被当成布尔真')
  assert.equal(coerceSetting('不存在的键', 1).ok, false)
})

test('store：没存过时读默认值；persist=false 时不碰存储', () => {
  const st = fakeStorage()
  const store = createStore({ storage: st, persist: false })
  assert.equal(store.get('view.mode'), 'fixed')
  store.set('view.mode', 'fp')
  assert.equal(store.get('view.mode'), 'fp', '内存里能读回')
  assert.equal(st.size, 0, '一行都不该写进存储')
  assert.equal(store.persist, false)
})

test('store：persist=true 时写入带 cabin: 前缀，并能被新实例读回', () => {
  const st = fakeStorage()
  const a = createStore({ storage: st })
  a.set('audio.volume', 0.25)
  assert.equal(st.getItem('cabin:audio.volume'), '0.25', '前缀 + JSON 序列化')
  const b = createStore({ storage: st })
  assert.equal(b.get('audio.volume'), 0.25, '新实例应读回已存的值')
})

test('store：脏数据被钳制或丢弃，不会污染状态', () => {
  const st = fakeStorage({
    'cabin:audio.volume': '999', // 超范围 → 钳到 1
    'cabin:view.mode': '"火星视角"', // 非法枚举 → 丢弃，退回默认
    'cabin:house.full': '{坏 JSON', // 解析失败 → 丢弃
  })
  const store = createStore({ storage: st, warn: () => {} })
  assert.equal(store.get('audio.volume'), 1)
  assert.equal(store.get('view.mode'), 'fixed')
  assert.equal(store.get('house.full'), false)
})

test('store：值没变时不通知、不重复写盘', () => {
  const st = fakeStorage()
  const store = createStore({ storage: st })
  let n = 0
  store.subscribe('audio.volume', () => n++)
  assert.equal(store.set('audio.volume', 0.6), false, '与默认值相同 → 无变化')
  assert.equal(n, 0)
  assert.equal(store.set('audio.volume', 0.3), true)
  assert.equal(store.set('audio.volume', 0.3), false, '重复设同一个值 → 无变化')
  assert.equal(n, 1, '只通知一次')
})

test('store：subscribe 能拿到 { key, value, prev }，退订后不再收到', () => {
  const store = createStore({ storage: fakeStorage() })
  const seen = []
  const un = store.subscribe('view.mode', (p) => seen.push(p))
  store.set('view.mode', 'tp')
  un()
  store.set('view.mode', 'fp')
  assert.equal(seen.length, 1)
  assert.deepEqual(seen[0], { key: 'view.mode', value: 'tp', prev: 'fixed' })
})

test('store：通配订阅 "*" 能收到所有键的变化', () => {
  const store = createStore({ storage: fakeStorage() })
  const keys = []
  store.subscribe('*', (p) => keys.push(p.key))
  store.set('view.mode', 'tp')
  store.set('audio.volume', 0.1)
  assert.deepEqual(keys, ['view.mode', 'audio.volume'])
})

test('store：非法 set 被拒绝且不改变状态（不抛错）', () => {
  const store = createStore({ storage: fakeStorage(), warn: () => {} })
  assert.equal(store.set('view.mode', '不存在'), false)
  assert.equal(store.get('view.mode'), 'fixed')
})

test('store：reset 恢复默认值（单项与全部）', () => {
  const store = createStore({ storage: fakeStorage() })
  store.set('view.mode', 'fp')
  store.set('audio.volume', 0.1)
  store.reset('view.mode')
  assert.equal(store.get('view.mode'), 'fixed')
  assert.equal(store.get('audio.volume'), 0.1, '单项 reset 不该动别的键')
  store.reset()
  assert.equal(store.get('audio.volume'), 0.6)
})

test('store：拿不到存储后端时降级为内存模式（不抛错）', () => {
  const store = createStore({ storage: null })
  assert.equal(store.persist, false)
  assert.equal(store.set('view.mode', 'tp'), true)
  assert.equal(store.get('view.mode'), 'tp')
})
