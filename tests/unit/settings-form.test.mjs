/**
 * 单元测试 —— 设置面板（`J2.5` 配置编排层 / 验收 `CF2`）
 *
 * 运行：`node --test "tests/unit/*.test.mjs"`
 *
 * 这一组守的是 `J2.5` 引入的**新契约**：面板控件不再手写，而是由
 * `src/config/settings.config.js` 的 schema 生成、值经 `store` 单向流动。
 * 它在搬迁中替换掉了 **6 个手写控件 + 6 段手写事件绑定**，所以要有测试回答三件事：
 *
 *   1. **生成对了没**：控件数量、id 契约（`domId`/`domIds`）、分组归属；
 *   2. **通了没**：点控件 → `store` 变；`store` 变 → 控件外观变（双向但单写者）；
 *   3. **加一项要改几处**：注入一个 schema 里没有的键 → 控件必须自动出现。
 *
 * ## 为什么要自带一个 DOM 替身
 *
 * 本项目**零测试依赖**（不引 jsdom，与"零依赖 RSS"同一条理由，见 `tsconfig.json` 注释）。
 * 下面这 60 行的微型 DOM 只实现 `SettingsForm` 真正用到的那几个方法 ——
 * 它测的是**语义**（有几个控件、id 是什么、点下去 store 变成什么），
 * 不是浏览器的渲染行为（那由 `pnpm test:smoke` 的真浏览器覆盖）。
 *
 * ⚠️ 已知边界：假 DOM **不做**选择器引擎，只认 `[attr="值"]` 与 `#id` 两种形态
 * （`SettingsForm` 恰好只用这两种）。若将来它开始用别的选择器，这里会**失败而不是静默通过**
 * —— 那正是想要的行为。
 */
import test from 'node:test'
import assert from 'node:assert/strict'

// ── 微型 DOM ────────────────────────────────────────────────────────────────

class FakeElement {
  constructor(tag, fragment = false) {
    this.tagName = String(tag).toUpperCase()
    this.__fragment = fragment
    this.children = []
    this.parentNode = null
    this.attributes = {}
    this.dataset = {}
    this.listeners = new Map()
    this.classes = new Set()
    this.id = ''
    this.title = ''
    this.value = ''
    this.type = ''
    this.min = ''
    this.max = ''
    this.step = ''
    this._text = ''
  }

  get className() {
    return [...this.classes].join(' ')
  }
  set className(v) {
    this.classes = new Set(String(v).split(/\s+/).filter(Boolean))
  }

  get textContent() {
    return this._text
  }
  set textContent(v) {
    this._text = String(v)
    this.children.length = 0
  }

  get firstChild() {
    return this.children[0] || null
  }

  get classList() {
    const self = this
    return {
      add: (c) => self.classes.add(c),
      remove: (c) => self.classes.delete(c),
      contains: (c) => self.classes.has(c),
      toggle: (c, on) => {
        const want = on === undefined ? !self.classes.has(c) : !!on
        if (want) self.classes.add(c)
        else self.classes.delete(c)
        return want
      },
    }
  }

  appendChild(node) {
    if (!node) return node
    if (node.__fragment) {
      for (const c of [...node.children]) this.appendChild(c)
      node.children.length = 0
      return node
    }
    node.parentNode = this
    this.children.push(node)
    return node
  }

  append(...nodes) {
    for (const n of nodes) this.appendChild(n)
  }

  removeChild(node) {
    const i = this.children.indexOf(node)
    if (i >= 0) this.children.splice(i, 1)
    node.parentNode = null
    return node
  }

  setAttribute(k, v) {
    this.attributes[k] = String(v)
  }
  getAttribute(k) {
    return Object.prototype.hasOwnProperty.call(this.attributes, k) ? this.attributes[k] : null
  }

  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, [])
    this.listeners.get(type).push(fn)
  }

  /** 触发监听（假 DOM 专用；真实 DOM 里由浏览器派发） */
  fire(type, ev = {}) {
    for (const fn of [...(this.listeners.get(type) || [])]) fn({ target: this, type, ...ev })
  }

  /** 只支持 `[attr="值"]` 与 `#id`（见文件头"已知边界"） */
  querySelector(sel) {
    const attr = sel.match(/^\[([\w-]+)="([^"]*)"\]$/)
    const id = sel.match(/^#(.+)$/)
    if (!attr && !id) throw new Error(`假 DOM 不认识选择器：${sel}`)
    const walk = (node) => {
      for (const c of node.children) {
        if (attr && c.attributes[attr[1]] === attr[2]) return c
        if (id && c.id === id[1]) return c
        const r = walk(c)
        if (r) return r
      }
      return null
    }
    return walk(this)
  }

  /** 便于断言的扁平遍历 */
  all(predicate = () => true, out = []) {
    for (const c of this.children) {
      if (predicate(c)) out.push(c)
      c.all(predicate, out)
    }
    return out
  }
}

function installFakeDom() {
  const document = {
    createElement: (tag) => new FakeElement(tag),
    createDocumentFragment: () => new FakeElement('#fragment', true),
  }
  globalThis.document = document
  return document
}

/** 一个带分组锚点的假菜单（形状取自 `src/cabin/dom.js` 的 `#menuPanel`） */
function makeMenu(document, groups = ['house', 'weather', 'time', 'audio', 'view'], withAuto = true) {
  const menu = document.createElement('div')
  menu.id = 'menuPanel'
  for (const g of groups) {
    const anchor = document.createElement('div')
    anchor.setAttribute('data-setting-group', g)
    menu.appendChild(anchor)
  }
  if (withAuto) {
    const auto = document.createElement('div')
    auto.id = 'settingsAuto'
    menu.appendChild(auto)
  }
  return menu
}

// ── 被测对象 ────────────────────────────────────────────────────────────────

const { createStore } = await import('../../src/cabin/app/store.js')
const { createSettingsForm, planGroups, formatSettingValue, GROUP_ATTR } = await import(
  '../../src/cabin/systems/ui/SettingsForm.js'
)
const { settingsSchema, SETTING_GROUPS } = await import('../../src/config/settings.config.js')
const { displayConfig } = await import('../../src/config/display.config.js')

/** 造一组依赖（每个测试独立，互不污染） */
function setup(overrides = {}) {
  const document = installFakeDom()
  const store = createStore({ storage: null, warn: () => {} })
  const events = []
  const bus = { emit: (type, payload) => events.push({ type, payload }) }
  const root = makeMenu(document, overrides.groups)
  const form = createSettingsForm({
    store,
    bus,
    root,
    settings: overrides.settings ?? settingsSchema,
    groups: overrides.groups2 ?? SETTING_GROUPS,
    display: overrides.display ?? displayConfig,
    log: () => {},
  })
  return { document, store, bus, events, root, form }
}

// ── 1. 纯函数：分组计划 ─────────────────────────────────────────────────────

test('planGroups：按 schema 声明顺序分组，每项落在自己的组里', () => {
  const plan = planGroups(settingsSchema, SETTING_GROUPS, displayConfig)
  const groups = plan.map((g) => g.group)
  assert.deepEqual(groups, ['view', 'house', 'time', 'weather', 'audio'])
  for (const g of plan) {
    for (const item of g.items) assert.equal(item.spec.group, g.group, `${item.key} 不该出现在 ${g.group} 组`)
  }
})

test('planGroups：分组标题取中文显示名（面板上看到的是「房 屋」而不是 house）', () => {
  const plan = planGroups(settingsSchema, SETTING_GROUPS, displayConfig)
  const house = plan.find((g) => g.group === 'house')
  assert.equal(house.title, '房 屋')
})

test('planGroups：★ 注入一个全新字段 → 自动进计划（这就是"加一项只改 1 个文件"）', () => {
  const injected = { ...settingsSchema, 'brand.new': { type: 'boolean', default: true, group: 'audio', label: '新的' } }
  const flat = planGroups(injected, SETTING_GROUPS, displayConfig).flatMap((g) => g.items.map((i) => i.key))
  assert.ok(flat.includes('brand.new'), `没进计划：${flat.join(',')}`)
})

test('planGroups：总开关关掉 → 空计划；分组关掉 → 只少那一组', () => {
  assert.equal(planGroups(settingsSchema, SETTING_GROUPS, { ...displayConfig, enable: false }).length, 0)
  const off = planGroups(settingsSchema, SETTING_GROUPS, { ...displayConfig, panels: { ...displayConfig.panels, time: false } })
  assert.ok(!off.some((g) => g.group === 'time'))
  assert.ok(off.some((g) => g.group === 'view'), '关一组不该影响别的组')
})

test('planGroups：`hidden` 里的键被跳过（值仍在 store 里生效）', () => {
  const plan = planGroups(settingsSchema, SETTING_GROUPS, { ...displayConfig, hidden: { 'audio.volume': '暂由别处呈现' } })
  const flat = plan.flatMap((g) => g.items.map((i) => i.key))
  assert.ok(!flat.includes('audio.volume'))
  assert.ok(flat.includes('audio.enabled'))
})

// ── 2. 纯函数：数值读数 ─────────────────────────────────────────────────────

test('formatSettingValue：有曲线的项带倍率单位，其余按 step 定小数位', () => {
  assert.equal(formatSettingValue(settingsSchema['time.scale'], 60), '60×')
  assert.equal(formatSettingValue(settingsSchema['time.scale'], 3600), '3600×')
  assert.equal(formatSettingValue(settingsSchema['audio.volume'], 0.6), '0.60')
  assert.equal(formatSettingValue({ step: 1 }, 18.4), '18')
})

// ── 3. 渲染：控件数量、id 契约、分组归属 ─────────────────────────────────────

test('渲染：每个 schema 项都生成了控件（一个不多一个不少）', () => {
  const { form } = setup()
  assert.deepEqual([...form.controls.keys()].sort(), Object.keys(settingsSchema).sort())
})

test('渲染：★ 控件沿用原来的 id 契约（monolith 还在按 id 找节点）', () => {
  const { form } = setup()
  const toggleIds = form.controls.get('house.full').el.all((e) => e.tagName === 'DIV').map((e) => e.id)
  assert.ok(toggleIds.includes('houseToggle'), `房 屋开关的 id 丢了：${toggleIds.join(',')}`)
  const viewBtns = form.controls.get('view.mode').el.children
  assert.deepEqual(viewBtns.map((b) => b.id), ['viewFixedBtn', 'viewTpBtn', 'viewFpBtn'])
  const volume = form.controls.get('audio.volume').el.all((e) => e.tagName === 'INPUT')
  assert.equal(volume[0]?.id, 'sfxSlider')
})

test('渲染：三种类型各自用对的控件（boolean→toggle / number→range / enum→按钮组）', () => {
  const { form } = setup()
  assert.ok(form.controls.get('house.full').el.all((e) => e.classes.has('toggle')).length === 1)
  const range = form.controls.get('audio.volume').el.all((e) => e.tagName === 'INPUT')
  assert.equal(range.length, 1)
  assert.equal(range[0].type, 'range')
  assert.equal(form.controls.get('view.mode').el.children.length, 3)
  assert.ok(form.controls.get('view.mode').el.children.every((b) => b.classes.has('viewBtn')))
})

test('渲染：控件落在 schema 声明所属的分组锚点里（不是全堆在一处）', () => {
  const { root, form } = setup()
  const audioAnchor = root.querySelector(`[${GROUP_ATTR}="audio"]`)
  assert.equal(audioAnchor.children.length, 2, '音效组应有 2 个控件')
  const viewAnchor = root.querySelector(`[${GROUP_ATTR}="view"]`)
  const enumBox = form.controls.get('view.mode').el
  assert.equal(enumBox.parentNode, viewAnchor, '视角按钮组应当挂在自己的锚点下')
  assert.equal(enumBox.children.length, 3, '组里三个按钮')
})

test('渲染：「恢复默认」落在面板末尾，不属于任何一个分组', () => {
  const { root } = setup()
  const reset = root.all((e) => e.id === 'settingsResetBtn')[0]
  assert.ok(reset, '应当生成该按钮')
  for (const g of ['house', 'weather', 'time', 'audio', 'view']) {
    assert.ok(!root.querySelector(`[${GROUP_ATTR}="${g}"]`).all((e) => e.id === 'settingsResetBtn').length, `不该出现在 ${g} 组里`)
  }
})

test('渲染：初始值来自 store，视觉状态立刻正确（开关该亮的亮着）', () => {
  const { form } = setup()
  const toggle = form.controls.get('audio.enabled').el.all((e) => e.classes.has('toggle'))[0]
  assert.ok(toggle.classes.has('on'), 'audio.enabled 默认 true → 开关应当是 on')
  const fixedBtn = form.controls.get('view.mode').el.children[0]
  assert.ok(fixedBtn.classes.has('on'), '默认视角 fixed → 第一个按钮应当是 on')
  const houseToggle = form.controls.get('house.full').el.all((e) => e.classes.has('toggle'))[0]
  assert.ok(!houseToggle.classes.has('on'), 'house.full 默认 false → 开关应当是 off')
})

test('渲染：schema 里有、DOM 里没锚点的分组 → 自动生成标题与容器（零 HTML 改动）', () => {
  const document = installFakeDom()
  const store = createStore({ storage: null, warn: () => {} })
  const root = makeMenu(document, [], true) // 一个锚点都不给
  const form = createSettingsForm({ store, root, settings: settingsSchema, groups: SETTING_GROUPS, display: displayConfig, log: () => {} })
  assert.equal(form.controls.size, Object.keys(settingsSchema).length, '没有锚点也该全部生成')
  const auto = root.querySelector('#settingsAuto')
  assert.ok(auto.children.length > 0, '自动分组应当落在 #settingsAuto 里')
  const titles = root.all((e) => e.classes.has('sub')).map((e) => e.textContent)
  assert.ok(titles.includes('房 屋'), `自动生成的标题：${titles.join(' / ')}`)
})

// ── 4. 上行：点控件 → store 变（自动持久化那条路）────────────────────────────

test('交互：点开关 → store 翻转（并广播 ui:click 让场景放音效）', () => {
  const { form, store, events } = setup()
  const toggle = form.controls.get('house.full').el.all((e) => e.classes.has('toggle'))[0]
  assert.equal(store.get('house.full'), false)
  toggle.fire('click')
  assert.equal(store.get('house.full'), true, 'store 应当被写')
  assert.equal(events.at(-1)?.type, 'ui:click', '点击类控件要广播 ui:click')
})

test('交互：点枚举按钮 → store 变成对应值', () => {
  const { form, store } = setup()
  form.controls.get('view.mode').el.children[2].fire('click')
  assert.equal(store.get('view.mode'), 'fp')
})

test('交互：拖滑块 → store 存的是**实际值**而不是滑块位置（曲线项）', () => {
  const { form, store } = setup()
  const input = form.controls.get('time.scale').el.all((e) => e.tagName === 'INPUT')[0]
  assert.equal(input.min, '0', '滑块行程是 0–1')
  assert.equal(input.max, '1')
  input.value = '0.5'
  input.fire('input')
  assert.equal(store.get('time.scale'), 60, '滑块中点应当映射到 60×')
  input.value = '1'
  input.fire('input')
  assert.equal(store.get('time.scale'), 3600)
})

test('交互：滑块读数随拖动更新（用户要看得见数值）', () => {
  const { form, store } = setup()
  const input = form.controls.get('time.scale').el.all((e) => e.tagName === 'INPUT')[0]
  input.value = '0'
  input.fire('input')
  const readout = form.controls.get('time.scale').el.all((e) => e.classes.has('sval'))[0]
  assert.equal(readout.textContent, '0×')
  assert.equal(store.get('time.scale'), 0)
})

test('交互：滑块拖动中不被回流值覆写（否则手指底下会抖）', () => {
  const { form } = setup()
  const input = form.controls.get('audio.volume').el.all((e) => e.tagName === 'INPUT')[0]
  input.fire('pointerdown')
  input.value = '0.33'
  input.fire('input') // 上行写 store → 回流 sync
  assert.equal(input.value, '0.33', '拖动中不该被改写')
  input.fire('pointerup')
  input.value = '0.42'
  input.fire('input')
  assert.equal(input.value, '0.42')
})

// ── 5. 下行：store 变 → 控件跟着变（两条路共用同一个真源）───────────────────

test('同步：从别处改 store（如键盘 V 键切视角）→ 面板按钮跟着亮', () => {
  const { form, store } = setup()
  const [fixed, tp, fp] = form.controls.get('view.mode').el.children
  store.set('view.mode', 'tp') // 模拟 monolith 的 KeyV 分支
  assert.ok(tp.classes.has('on'))
  assert.ok(!fixed.classes.has('on'))
  assert.ok(!fp.classes.has('on'))
})

test('同步：值没变时不产生多余动作（store 侧已去重，这里只确认不抛错）', () => {
  const { form, store } = setup()
  assert.equal(store.set('house.full', false), false)
  const toggle = form.controls.get('house.full').el.all((e) => e.classes.has('toggle'))[0]
  assert.ok(!toggle.classes.has('on'))
})

// ── 6. 「恢复默认」与 dispose ───────────────────────────────────────────────

test('恢复默认：点一下把所有项退回 config 里写的默认值', () => {
  const { form, store, root } = setup()
  store.set('view.mode', 'fp')
  store.set('audio.volume', 0.1)
  const reset = root.all((e) => e.id === 'settingsResetBtn')[0]
  assert.ok(reset, '应当生成「恢复默认」按钮')
  reset.fire('click')
  assert.equal(store.get('view.mode'), 'fixed')
  assert.equal(store.get('audio.volume'), 0.6)
})

test('恢复默认：display.showReset=false 时不生成该按钮', () => {
  const { root } = setup({ display: { ...displayConfig, showReset: false } })
  assert.ok(!root.all((e) => e.id === 'settingsResetBtn').length)
})

test('总开关 enable=false → 一个控件都不生成（面板不渲染）', () => {
  const { form } = setup({ display: { ...displayConfig, enable: false } })
  assert.equal(form.controls.size, 0)
})

test('dispose：退订 store 并清空自己生成的控件（锚点留着，可再次渲染）', () => {
  const { form, store, root } = setup()
  const audioAnchor = root.querySelector(`[${GROUP_ATTR}="audio"]`)
  assert.equal(audioAnchor.children.length, 2)
  form.dispose()
  assert.equal(audioAnchor.children.length, 0, '控件应当被清掉')
  assert.equal(form.controls.size, 0)
  // 退订之后 store 再变化不该抛错（旧实现会去动已经摘掉的节点）
  store.set('audio.volume', 0.2)
})

// ── 7. ★ 默认参数路径（一个真实逃逸过的 bug 的回归测试）────────────────────

test('★ 不传 settings/groups/display 时也能挂载（= 生产路径 boot.js 的走法）', () => {
  // 这个 bug 真的逃逸过：上面所有用例都**显式注入** `settingsSchema`（对象），
  // 于是没人发现 `createSettingsForm` 的默认值曾经是 `SETTINGS`
  // （`cabin/app/settings.js` 派生出的**数组**）—— `Object.entries(数组)` 给出的是
  // `'0' / '1' / …` 索引，`store.get('0')` 全是 `undefined`，面板挂载时炸在读数格式化上，
  // 而 3D 场景完全正常（像素回归零差异，只报"页面有异常"）。
  const document = installFakeDom()
  const store = createStore({ storage: null, warn: () => {} })
  const root = makeMenu(document)
  const form = createSettingsForm({ store, root, log: () => {} })

  assert.deepEqual([...form.controls.keys()].sort(), Object.keys(settingsSchema).sort(), '控件键必须是设置键，不是索引')
  for (const key of form.controls.keys()) {
    assert.equal(store.get(key) !== undefined, true, `${key} 在 store 里取不到值`)
    for (const r of form.controls.get(key).el.all((e) => e.classes.has('sval'))) {
      assert.notEqual(r.textContent, '—', `${key} 的读数没取到值`)
    }
  }
})

test('planGroups：传数组要**抛错**，而不是把索引当键（同一类错误的护栏）', () => {
  assert.throws(() => planGroups([{ key: 'a', type: 'boolean' }], SETTING_GROUPS, displayConfig), /需要 schema/)
})

test('formatSettingValue：非有限数显示占位而不是抛错（面板不该因一个坏值全挂）', () => {
  assert.equal(formatSettingValue(settingsSchema['audio.volume'], undefined), '—')
  assert.equal(formatSettingValue(settingsSchema['audio.volume'], NaN), '—')
  assert.equal(formatSettingValue(settingsSchema['time.scale'], undefined), '—')
})
