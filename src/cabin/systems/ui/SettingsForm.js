/**
 * 设置面板 —— 由 schema **自动生成**控件，并**自动持久化**
 *
 * 来源：新增（`J2.5` 配置编排层）。它消解的是决策 5 要解决的问题：
 * 「各个功能模块的配置参考 Firefly 的编排方法，需要**用户友好**且**将设置集中在一起**」。
 *
 * 搬迁前（也就是 `J2.5` 之前）的状态：菜单里的每一个旋钮都是**手写**的 ——
 * `dom.js` 里写 `<div class="toggle" id="houseToggle">`，实现里写
 * `houseToggle.addEventListener('click', …)` 加上 `store.set('house.full', …)`。
 * 于是"加一个可调项"要改 **3 个地方**（DOM / 事件 / store），漏一处就静默失效。
 *
 * 现在只有一条路径：
 *
 * ```
 *   src/config/settings.config.js   加一个字段（type / default / group / label）
 *            │
 *            ▼  本文件按 type 自动选控件
 *   #menuPanel 里对应分组的锚点 [data-setting-group="<group>"]
 *            │
 *            ▼  双向绑定
 *   store.set(key, v) ──► localStorage（cabin: 前缀）+ 通知订阅者（场景据此变化）
 * ```
 *
 * ## 三条判据（验收 `CF2`）
 *
 * | 判据 | 实现处 |
 * |---|---|
 * | 新增一个配置项 = 改 **1 个文件** + 加 **1 个字段** | `planGroups()` 只读 schema，不认识任何具体键 |
 * | 控件**自动出现** | `render()` 按 `type` 生成，锚点缺失时连分组标题一起生成 |
 * | 改完**自动持久化** | 所有交互都只调 `store.set()`，写盘由 `store` 单点负责（不变量 `BB17`） |
 *
 * ## 分组锚点：为什么 DOM 里要留空 `<div data-setting-group="…">`
 *
 * 分组的**位置与标题**（「房 屋」「天 气」…）仍然写在 `cabin/dom.js` 的菜单 HTML 里，
 * 因为那里还夹着**不是设置项**的东西（天气选择 chips、时刻滑杆、魔法槽位）。
 * 本文件只往锚点里**填控件**，不动排版 —— 于是 `J2.5` 不改变用户看到的菜单结构。
 *
 * 锚点找不到时（例如将来某个模块新增了自己的分组），本文件会**连标题一起生成**，
 * 追加到 `#settingsAuto` 容器 —— 这就是"零 HTML 改动"的部分。
 *
 * ## 视觉同源（不新增 CSS）
 *
 * 控件复用菜单既有的 class：`boolean → .row + .toggle`、`number → .sliderRow`、
 * `enum → .viewBtn`。所以面板与菜单其余部分天然是同一套外观。
 */
import { settingsSchema, SETTING_GROUPS } from '../../../config/settings.config.js'
import { displayConfig } from '../../../config/display.config.js'

/** 每个分组锚点的属性名（`dom.js` 里写 `<div data-setting-group="house"></div>`） */
export const GROUP_ATTR = 'data-setting-group'
/** 自动生成的分组（schema 里有、DOM 里没有锚点）落在这个容器里 */
export const AUTO_CONTAINER_ID = 'settingsAuto'

/**
 * ★ 纯函数：把 schema 摊成"要渲染哪些分组、每组哪些控件"的计划。
 *
 * 与 DOM 无关 ⇒ 可以直接单测（验收 `CF2` 的"改 1 个文件加 1 个字段"就靠它保证）。
 *
 * 过滤规则（顺序即优先级）：
 *   ① `display.enable === false` → 整个面板不渲染（返回空计划）；
 *   ② 键出现在 `display.hidden` 里 → 跳过（过渡期显式排除，值仍在 `store` 里生效）；
 *   ③ `display.panels[group] === false` → 该分组整体不渲染；
 *   ④ 其余按 schema 的**声明顺序**分组（顺序即面板顺序，不再另设排序表）。
 *
 * @param {Record<string, any>} settings schema（**键 → 定义**的对象，即 `settingsSchema`）
 * @param {Record<string, string>} [groups] 分组 id → 显示名
 * @param {import('../../../config/types.js').DisplayConfig} [display]
 * @returns {{ group: string, title: string, items: { key: string, spec: any }[] }[]}
 */
export function planGroups(settings, groups = SETTING_GROUPS, display = displayConfig) {
  // ⚠️ 必须是**对象**。曾经这里收过 `SETTINGS`（`cabin/app/settings.js` 派生出的**数组**），
  //    于是 `Object.entries` 给出的"键"是 `'0' / '1' / …` 索引，`store.get('0')` 全是
  //    `undefined` —— 面板挂载时静默炸在读数格式化上，而画面完全正常（所以像素回归
  //    只报"页面有错"、不报"画面变了"）。这一行就是防它复发的：宁可抛错，不要静默错位。
  if (Array.isArray(settings)) {
    throw new TypeError('planGroups 需要 schema **对象**（键 → 定义），收到的是数组；数组的 Object.entries 会变成索引键')
  }
  if (display?.enable === false) return []
  const hidden = display?.hidden || {}
  const panels = display?.panels || {}
  /** @type {Map<string, { key: string, spec: any }[]>} */
  const byGroup = new Map()

  for (const [key, spec] of Object.entries(settings)) {
    if (Object.prototype.hasOwnProperty.call(hidden, key)) continue
    if (panels[spec.group] === false) continue
    if (!byGroup.has(spec.group)) byGroup.set(spec.group, [])
    byGroup.get(spec.group).push({ key, spec })
  }

  return [...byGroup.entries()].map(([group, items]) => ({
    group,
    title: groups?.[group] || group,
    items,
  }))
}

/**
 * ★ 纯函数：把存下来的值格式化成控件旁边的读数。
 *
 * - 有 `slider` 曲线的项显示实际值 + 单位（`time.scale` → `60×`）；
 * - 其余按 `step` 推导小数位数（`step: 0.01` → `0.60`；`step: 1` → `18`）。
 *
 * @param {any} spec
 * @param {number} value
 * @returns {string}
 */
export function formatSettingValue(spec, value) {
  // 非有限数（`undefined` / `NaN`）不该让整个面板挂掉：显示一个占位，
  // 让用户还能看到别的旋钮。真出了这种情况，`pnpm test:smoke` 的"页面无异常"会报出来。
  if (!Number.isFinite(value)) return '—'
  if (spec?.slider) return `${Math.round(value)}×`
  const step = spec?.step ?? 1
  const text = String(step)
  const dot = text.indexOf('.')
  const decimals = dot < 0 ? 0 : text.length - dot - 1
  return decimals > 0 ? value.toFixed(decimals) : String(Math.round(value))
}

/**
 * 造设置面板。
 *
 * @param {object} options
 * @param {object} options.store 状态存储（`cabin/app/store.js` 的实例）—— 值的唯一真源
 * @param {HTMLElement} options.root 锚点所在的子树（菜单面板 `#menuPanel`）
 * @param {object} [options.bus] 事件总线；点击类控件会 `emit('ui:click')`，供音效等订阅
 * @param {Record<string, any>} [options.settings] 覆盖 schema（默认 `src/config/settings.config.js` 的 `settingsSchema`）
 * @param {Record<string, string>} [options.groups] 覆盖分组显示名
 * @param {object} [options.display] 覆盖显示设定
 * @param {(msg: string) => void} [options.log] 诊断出口
 * @returns {{ element: HTMLElement|null, controls: Map<string, any>, syncAll: () => void, dispose: () => void }}
 */
export function createSettingsForm(options = {}) {
  const {
    store,
    root,
    bus = null,
    settings = settingsSchema,
    groups = SETTING_GROUPS,
    display = displayConfig,
    log = () => {},
  } = options

  if (!store) throw new TypeError('createSettingsForm 需要 store')
  if (!root) throw new TypeError('createSettingsForm 需要挂载容器（菜单面板）')

  /** @type {Map<string, { sync: (v: any) => void }>} 键 → 该控件的同步函数 */
  const controls = new Map()
  /** 本次渲染用到的锚点容器（`dispose` 时清空，便于重复渲染） */
  const anchors = []
  let unsub = null

  const plan = planGroups(settings, groups, display)

  // ── ① 找到（或生成）每个分组的落点 ────────────────────────────────
  /** 取分组锚点；没有就带上标题生成一个，追加到 `#settingsAuto`（"零 HTML 改动"那条路） */
  function anchorFor(group) {
    let el = root.querySelector(`[${GROUP_ATTR}="${group}"]`)
    if (el) return el
    const box = document.createElement('div')
    const title = document.createElement('div')
    title.className = 'sub'
    title.textContent = groups?.[group] || group
    el = document.createElement('div')
    el.setAttribute(GROUP_ATTR, group)
    box.append(title, el)
    const auto = root.querySelector(`#${AUTO_CONTAINER_ID}`)
    ;(auto || root).appendChild(box)
    log(`[settings] 分组 ${group} 在 DOM 里没有锚点，已自动生成`)
    return el
  }

  // ── ② 三种控件的构造器（每个都返回 { el, sync }）─────────────────
  /** 布尔 → 开关（`.row > .toggle`，与搬迁前的手写开关同一套 DOM 与 class） */
  function buildBoolean(key, spec) {
    const row = document.createElement('div')
    row.className = 'row'
    row.dataset.setting = key
    if (spec.hint) row.title = spec.hint
    const label = document.createElement('span')
    label.textContent = spec.label
    const toggle = document.createElement('div')
    toggle.className = 'toggle'
    if (spec.domId) toggle.id = spec.domId
    const knob = document.createElement('div')
    knob.className = 'knob'
    toggle.appendChild(knob)
    row.append(label, toggle)
    toggle.addEventListener('click', () => {
      bus?.emit('ui:click', { source: 'settings', key })
      store.set(key, !store.get(key))
    })
    return {
      el: row,
      sync: (v) => toggle.classList.toggle('on', !!v),
    }
  }

  /** 数字 → 滑块（有 `slider` 曲线时，拖的是位置、存的是实际值） */
  function buildNumber(key, spec) {
    const curve = spec.slider
    const row = document.createElement('div')
    row.className = 'sliderRow'
    row.dataset.setting = key
    if (spec.hint) row.title = spec.hint
    const label = document.createElement('span')
    label.className = 'slbl'
    label.textContent = spec.label
    const input = document.createElement('input')
    input.type = 'range'
    input.min = String(curve ? curve.min : spec.min)
    input.max = String(curve ? curve.max : spec.max)
    input.step = String(curve ? curve.step : spec.step)
    if (spec.domId) input.id = spec.domId
    const readout = document.createElement('span')
    readout.className = 'sval'
    row.append(label, input, readout)

    // 拖动中不要用回流的 store 值覆写滑块位置：`coerceSetting` 的钳制 + 曲线往返
    // 会有浮点误差，写回去会让滑块在手指底下抖动。
    let dragging = false
    input.addEventListener('pointerdown', () => {
      dragging = true
    })
    for (const ev of ['pointerup', 'pointercancel', 'blur']) input.addEventListener(ev, () => {
      dragging = false
    })
    input.addEventListener('input', () => {
      const pos = Number(input.value)
      store.set(key, curve ? curve.toValue(pos) : pos)
    })
    return {
      el: row,
      sync: (v) => {
        if (!dragging) input.value = String(curve ? curve.fromValue(v) : v)
        readout.textContent = formatSettingValue(spec, v)
      },
    }
  }

  /** 枚举 → 按钮组（`.viewBtn`，与搬迁前的三个视角按钮同一套 DOM 与 class） */
  function buildEnum(key, spec) {
    // 包一层容器而不是直接返回 DocumentFragment：片段被 `appendChild` 之后会**清空自己**，
    // 那样 `controls.get(key).el` 就成了一个空壳（诊断与单测都拿不到按钮）。
    const box = document.createElement('div')
    box.dataset.settingValues = key
    /** @type {{ el: HTMLElement, value: string }[]} */
    const buttons = []
    for (const value of spec.values) {
      const btn = document.createElement('div')
      btn.className = 'viewBtn'
      btn.dataset.setting = key
      btn.dataset.value = value
      btn.textContent = spec.valueLabels?.[value] || value
      if (spec.hint) btn.title = spec.hint
      const id = spec.domIds?.[value]
      if (id) btn.id = id
      btn.addEventListener('click', () => {
        bus?.emit('ui:click', { source: 'settings', key })
        store.set(key, value)
      })
      buttons.push({ el: btn, value })
      box.appendChild(btn)
    }
    return {
      el: box,
      sync: (v) => {
        for (const b of buttons) b.el.classList.toggle('on', b.value === v)
      },
    }
  }

  const BUILDERS = { boolean: buildBoolean, number: buildNumber, enum: buildEnum }

  // ── ③ 渲染 ──────────────────────────────────────────────────────
  for (const { group, items } of plan) {
    const anchor = anchorFor(group)
    anchors.push(anchor)
    for (const { key, spec } of items) {
      const build = BUILDERS[spec.type]
      if (!build) {
        log(`[settings] ${key} 的类型 ${spec.type} 没有对应控件，已跳过`)
        continue
      }
      const ctrl = build(key, spec)
      anchor.appendChild(ctrl.el)
      controls.set(key, ctrl)
      ctrl.sync(store.get(key))
    }
  }

  // ── ④ 「恢复默认」 ───────────────────────────────────────────────
  if (display?.showReset !== false && controls.size > 0) {
    const reset = document.createElement('div')
    reset.className = 'viewBtn'
    reset.id = 'settingsResetBtn'
    reset.textContent = '恢复默认设置'
    reset.title = '把所有设置项退回 src/config/settings.config.js 里写的默认值'
    reset.addEventListener('click', () => {
      bus?.emit('ui:click', { source: 'settings', key: '*' })
      store.reset()
    })
    // 落在 `#settingsAuto`（面板最末尾）—— **不要**塞进最后一个分组锚点，
    // 那会让它看起来像是那个分组的一项（第一版就掉进过这个坑）。
    ;(root.querySelector(`#${AUTO_CONTAINER_ID}`) || root).appendChild(reset)
  }

  // ── ⑤ 反向同步：store 变了就更新控件 ─────────────────────────────
  //    单写者是 store（不变量 BB17）：本文件从不自己记值，只映射 store 的状态。
  unsub = store.subscribe('*', ({ key, value }) => {
    const ctrl = controls.get(key)
    if (ctrl) ctrl.sync(value)
  })

  /** 把 `store` 的当前值全部刷进控件（渲染后、以及外部整体改动后调用） */
  function syncAll() {
    for (const [key, ctrl] of controls) ctrl.sync(store.get(key))
  }

  /** 退订并清掉自己生成的控件（锚点本身保留，便于再次渲染） */
  function dispose() {
    unsub?.()
    unsub = null
    for (const anchor of anchors) {
      while (anchor.firstChild) anchor.removeChild(anchor.firstChild)
    }
    controls.clear()
    anchors.length = 0
  }

  return { element: anchors[0] || null, controls, syncAll, dispose }
}
