/**
 * Feature 契约 —— 一个功能模块"长什么样"的唯一约定
 *
 * 来源：新增（`J2.5`）。`J3` 搬物件、`J4` 搬系统、`J7` 加功能模块，都用它。
 *
 * ## 生命周期（由 `App.register()` / `App.start()` 驱动）
 *
 * ```
 *   register(feature)  →  setup(ctx)     一次性准备：建对象、登记交互（**不碰 DOM**）
 *   app.start()        →  start(ctx)     开始每帧参与（登记 scheduler 任务、订阅事件）
 *   app.stop()         →  （调度器停跑）
 *   app.dispose()      →  dispose(ctx)   退订、释放（重建一局时用）
 * ```
 *
 * ## `requires` 与 `order`
 *
 * · `requires` 是**模块 id 列表**：`J4`/`J7` 里模块之间有真实依赖
 *   （书架要先有 `CameraRig` 才能做"推移聚焦"），缺失时 `register` 直接报错，
 *   而不是等到运行时某个 `undefined` 才炸。
 * · `order` 只在同批装配里决定先后（小整数，默认 0）。
 *
 * ## 与 `modules.config` 的关系（`J2.5` 配置层）
 *
 * 配置层决定"装哪些模块"，`Feature.id` 就是配置里的键
 * （`modules.config.js` 里一个模块一个开关）—— 所以 `id` 必须稳定、可读、
 * 与 `mapping.yaml` 里的模块 id 对得上。
 */

/**
 * 定义一个功能模块（返回普通对象，不做任何注册 —— 注册是 `App.register()` 的事）。
 *
 * @param {object} spec
 * @param {string} spec.id 模块 id（= `modules.config` 的键 = `mapping.yaml` 的 id）
 * @param {string[]} [spec.requires] 依赖的模块 id
 * @param {number} [spec.order] 同批装配顺序（默认 0）
 * @param {object|null} [spec.settings] 设置项 schema（`J2.8` 的 `SettingsForm` 由它自动生成）
 * @param {(ctx: object) => void|Promise<void>} [spec.setup]
 * @param {(ctx: object) => void|Promise<void>} [spec.start]
 * @param {(ctx: object) => void|Promise<void>} [spec.dispose]
 */
export function defineFeature(spec) {
  if (!spec || typeof spec !== 'object') throw new TypeError('defineFeature 需要一个对象')
  const { id, requires = [], order = 0, settings = null, setup, start, dispose } = spec
  if (!id || typeof id !== 'string') throw new TypeError('defineFeature 需要字符串 id')
  for (const [k, fn] of Object.entries({ setup, start, dispose })) {
    if (fn !== undefined && typeof fn !== 'function') throw new TypeError(`${id}.${k} 必须是函数`)
  }
  return { id, requires: [...requires], order, settings, setup, start, dispose }
}
