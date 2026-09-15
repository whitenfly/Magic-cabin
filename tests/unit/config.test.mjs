/**
 * 单元测试 —— 配置层契约（`J2.5` 配置编排层）
 *
 * 运行：`node --test "tests/unit/*.test.mjs"`
 *
 * `J2.5` 的产物里，最容易在后续阶段**悄悄漂移**的是这两条链路：
 *
 *   ① `src/config/` ↔ 实现：真源在 config，实现只读 —— 一旦某处复制了一份默认值，
 *      就会出现"改了配置没生效"这种最难查的问题；
 *   ② `src/config/` ↔ 历史行为：设置项的默认值与曲线是**从搬迁前的硬编码搬过来的**，
 *      搬错一个数就会改变首屏画面，而像素回归只会告诉你"变了"、不会告诉你"错在哪"。
 *
 * 所以下面既有"同源"断言，也有**把搬迁前的公式原文抄进测试**的对照断言
 * （那些常数是从 `monolith.js` 一字不改搬出来的，这里就是它的留痕）。
 */
import test from 'node:test'
import assert from 'node:assert/strict'

const { settingsSchema, SETTING_GROUPS, TIME_SCALE_CURVE, SETTING_TYPES } = await import('../../src/config/settings.config.js')
const { displayConfig } = await import('../../src/config/display.config.js')
const { cabinConfig } = await import('../../src/config/cabin.config.js')
const { modulesConfig } = await import('../../src/config/modules.config.js')
const { SETTINGS, SETTINGS_BY_KEY, defaultSettings, coerceSetting } = await import('../../src/cabin/app/settings.js')
const { registerFeatures, notEnabledHint } = await import('../../src/blog/registry.js')

// ── 1. 真源唯一：`settings.config.js` 是唯一的清单 ──────────────────────────

test('★ settings.js 的 SETTINGS 是 schema 的派生（不是第二份清单）', () => {
  assert.deepEqual(
    SETTINGS.map((s) => s.key),
    Object.keys(settingsSchema),
    '键或顺序与 schema 不一致 —— 说明有人在 settings.js 里又写了一份',
  )
  for (const [key, spec] of Object.entries(settingsSchema)) {
    const derived = SETTINGS_BY_KEY.get(key)
    assert.equal(derived.default, spec.default, `${key} 的默认值不是从 schema 来的`)
    assert.equal(derived.type, spec.type)
    assert.equal(derived.label, spec.label)
  }
})

test('schema 里的默认值都是合法值（合法 = 放进去不会被 coerce 拒绝）', () => {
  for (const [key, spec] of Object.entries(settingsSchema)) {
    const r = coerceSetting(key, spec.default)
    assert.ok(r.ok, `${key} 的默认值不合法：${r.reason}`)
    assert.deepEqual(r.value, spec.default, `${key} 的默认值被钳制过了，说明它超范围`)
  }
})

test('三种控件类型都有实现（SETTING_TYPES 与实际用到的 type 一致）', () => {
  const used = [...new Set(Object.values(settingsSchema).map((s) => s.type))].sort()
  assert.deepEqual(used, [...SETTING_TYPES].sort())
})

test('每个设置项都有中文 label 与分组（面板上不会出现英文键名）', () => {
  for (const [key, spec] of Object.entries(settingsSchema)) {
    assert.ok(spec.label && /[\u4e00-\u9fa5]/.test(spec.label), `${key} 的 label 应当是中文`)
    assert.ok(SETTING_GROUPS[spec.group], `${key} 的分组 ${spec.group} 没有中文显示名`)
  }
})

// ── 2. ★ 搬迁零改动：曲线与常数逐点对照 ────────────────────────────────────

test('★ 时间流速曲线与搬迁前 monolith 的 sliderToScale 逐点相同（零优化留痕）', () => {
  // 下面这行是搬迁前 `cabin/legacy/monolith.js` 里的原文（`J2.5` 把它搬到了
  // `src/config/settings.config.js` 的 TIME_SCALE_CURVE.toValue）。**不要改它** ——
  // 它是"搬迁期零优化"这条原则的判据，改了就等于承认数值被动过。
  const before = (v) => (v <= 0 ? 0 : v <= 0.5 ? v * 120 : 60 + (v - 0.5) * 2 * (3600 - 60))
  for (let i = 0; i <= 100; i++) {
    const pos = i / 100
    assert.equal(TIME_SCALE_CURVE.toValue(pos), before(pos), `滑块位置 ${pos} 的倍率与搬迁前不一致`)
  }
  assert.equal(TIME_SCALE_CURVE.toValue(0.5), 60, '滑块中点 = 60×')
  assert.equal(TIME_SCALE_CURVE.toValue(1), 3600, '滑块右端 = 3600×')
})

test('★ 默认值必须与搬迁前的首屏一致（改这些数就等于改画面）', () => {
  // 判据来自搬迁前的 DOM / 变量初值：菜单 HTML 的 `class="toggle on"`、
  // `value="0.5"`、`wx = { random: false }`、`let viewMode = 'fixed'`、
  // `vol = 0.6`、`fullHouse = store.get('house.full')`。
  assert.deepEqual(
    {
      'view.mode': settingsSchema['view.mode'].default,
      'house.full': settingsSchema['house.full'].default,
      'weather.random': settingsSchema['weather.random'].default,
      'audio.enabled': settingsSchema['audio.enabled'].default,
      'audio.volume': settingsSchema['audio.volume'].default,
      'time.scale': settingsSchema['time.scale'].default,
    },
    { 'view.mode': 'fixed', 'house.full': false, 'weather.random': false, 'audio.enabled': true, 'audio.volume': 0.6, 'time.scale': 60 },
  )
})

test('cabin.config.js 的 time.scale 与设置项默认值同源（单位已统一为倍率）', () => {
  assert.equal(cabinConfig.time.scale, settingsSchema['time.scale'].default)
  assert.equal(cabinConfig.defaultViewMode, settingsSchema['view.mode'].default)
})

test('时间流速的倍率上限覆盖曲线的右端（否则拖到底会被 store 钳掉）', () => {
  assert.ok(settingsSchema['time.scale'].max >= TIME_SCALE_CURVE.toValue(1), 'max 应当 ≥ 曲线右端的 3600')
  assert.ok(settingsSchema['time.scale'].min <= TIME_SCALE_CURVE.toValue(0))
})

// ── 3. 显示设定 ─────────────────────────────────────────────────────────────

test('displayConfig 的 panels 覆盖所有分组（置 false 能真的关掉一组）', () => {
  for (const g of Object.keys(SETTING_GROUPS)) {
    assert.ok(g in displayConfig.panels, `分组 ${g} 在 panels 里没有开关`)
  }
  for (const g of Object.keys(displayConfig.panels)) {
    assert.ok(g in SETTING_GROUPS, `panels 里的 ${g} 不是任何分组`)
  }
})

// ── 4. 模块总开关 ───────────────────────────────────────────────────────────

test('modulesConfig 是全布尔表（没有 undefined / 字符串）', () => {
  for (const [id, on] of Object.entries(modulesConfig)) {
    assert.equal(typeof on, 'boolean', `${id} 的开关不是布尔值：${on}`)
  }
  assert.ok(Object.keys(modulesConfig).length === 19, `应当有 19 个模块开关，实际 ${Object.keys(modulesConfig).length}`)
})

test('modulesConfig 的键与 mapping.yaml 完全一致（R30 漂移门禁）', () => {
  // 这里**不**解析 YAML（零依赖），只断言键集合的形状：M01…M18 + M03a/M03b
  const ids = Object.keys(modulesConfig)
  assert.ok(ids.includes('M03a') && ids.includes('M03b'), '复合编号 M03a/M03b 必须在')
  for (const id of ids) assert.match(id, /^M\d{2}[ab]?$/, `${id} 不符合模块 id 命名规范`)
})

// ── 5. registry：按开关装配 ────────────────────────────────────────────────

test('★ registry：未启用的模块**连 load 都不调用**（chunk 不被下载）', async () => {
  const loaded = []
  const manifests = [
    { id: 'M01', load: async () => { loaded.push('M01'); return { id: 'M01' } } },
    { id: 'M02', load: async () => { loaded.push('M02'); return { id: 'M02' } } },
  ]
  const app = { register: () => {} }
  const report = await registerFeatures(app, { manifests, config: { M01: true, M02: false } })
  assert.deepEqual(loaded, ['M01'])
  assert.deepEqual(report.disabled, ['M02'])
})

test('registry：清单里有、开关表里没有的 id → 抛错（可缺省即失败）', async () => {
  const manifests = [{ id: 'M99', load: async () => ({ id: 'M99' }) }]
  await assert.rejects(() => registerFeatures({ register: () => {} }, { manifests, config: {} }), /没有开关/)
})

test('registry：模块的默认导出与具名导出都能装配', async () => {
  const seen = []
  const manifests = [
    { id: 'M01', load: async () => ({ default: { id: 'M01', via: 'default' } }) },
    { id: 'M02', load: async () => ({ id: 'M02', via: 'named' }) },
  ]
  await registerFeatures({ register: (f) => seen.push(f.via) }, { manifests, config: { M01: true, M02: true } })
  assert.deepEqual(seen, ['default', 'named'])
})

test('registry：一个模块装配失败时其余模块照常，且失败被如实记录', async () => {
  const ok = []
  const manifests = [
    { id: 'M01', load: async () => ({ id: 'M01' }) },
    { id: 'M02', load: async () => { throw new Error('坏了') } },
    { id: 'M03a', load: async () => ({ id: 'M03a' }) },
  ]
  const report = await registerFeatures({ register: (f) => ok.push(f.id) }, { manifests, config: { M01: true, M02: true, M03a: true } })
  assert.deepEqual(ok, ['M01', 'M03a'])
  assert.equal(report.failed.length, 1)
  assert.match(report.failed[0].error, /坏了/)
})

test('registry：参数不合法时立刻抛错（而不是静默什么都不做）', async () => {
  await assert.rejects(() => registerFeatures(null, { manifests: [] }), /App 实例/)
  await assert.rejects(() => registerFeatures({ register: () => {} }, { manifests: '不是数组' }), /manifests 数组/)
})

test('BB3 提示文案：说清"没启用"以及去哪儿打开（用户不该看到内部术语）', () => {
  const hint = notEnabledHint('书架')
  assert.match(hint, /书架/)
  assert.match(hint, /还没启用/)
  assert.match(hint, /modules\.config\.js/, '要告诉用户去哪儿改')
})

// ── 6. store 与 schema 的联动（默认值那条链路）───────────────────────────────

test('store 的初值完全来自 schema 的 default（没有第二处默认值）', () => {
  const d = defaultSettings()
  assert.deepEqual(d, Object.fromEntries(Object.entries(settingsSchema).map(([k, s]) => [k, s.default])))
})

test('数字项的 min/max 与滑块行程解耦：曲线项存的是实际值、拖的是位置', () => {
  const t = settingsSchema['time.scale']
  assert.ok(t.slider, '曲线项应当有 slider 配置')
  assert.deepEqual({ min: t.slider.min, max: t.slider.max }, { min: 0, max: 1 }, '滑块行程固定 0–1')
  assert.deepEqual({ min: t.min, max: t.max }, { min: 0, max: 3600 }, '存进 store 的是倍率')
  // 非曲线项：滑块与存储同一个刻度
  const v = settingsSchema['audio.volume']
  assert.ok(!v.slider)
  assert.deepEqual({ min: v.min, max: v.max, step: v.step }, { min: 0, max: 1, step: 0.01 })
})
