/**
 * 相机机位 —— 小屋里**唯一**决定"从哪看"的地方
 *
 * 来源：新增（`J2.7`）。搬迁前全文件只有 3 处直接写 `camera.position`（三段 if / else if / else），
 * 与 `camShake`、测试机位覆盖散在不同段落里 —— 于是**没有任何运镜能力**（风险 `R3`，
 * 等级 H），而 `J6` 的"推移聚焦"与"平面视角（垂直俯视阅读）"都依赖它。
 *
 * ## 三种内置视角由**调用方注入**（不是写死在这里）
 *
 * 原实现的三段解算读的是 `fixYaw` / `camPitch` / `viewDist` 这些**小屋自己的状态量**，
 * 而 `core/` 不该知道它们（不变量 `N1`）。所以 `CameraRig` 只提供：
 *
 * ```js
 *   rig.defineMode('fixed', (state, cam) => { …原来的三段解算，逐字照搬… })
 *   rig.update({ fixYaw, fixPitch, fixDist, camYaw, camPitch, viewDist, player, look })
 * ```
 *
 * 状态由 `state` 传进来，`rig` 自己不持有任何视角状态 —— 于是"搬迁期零差异"与
 * "`core/` 不碰具体状态"两件事同时成立。
 *
 * ## `mode: 'scripted'` 与 `BB16`（转场后正确交还）
 *
 * `playScript({ duration, apply, easing })` 进入脚本化运镜：每帧调用 `apply(k)`，
 * `k` 是 `0→1` 的插值系数。**结束时自动把 `mode` 交还给进入前的那个视角**
 * —— 这就是验收 `BB16`（「`CameraRig` 在 3 视角下转场后均能正确交还」）的实现点，
 * 也是 `J6.5` 平面视角能"看完自动回到原来位置"的前提。
 *
 * ## ⚠️ 给 `J6` 的一条硬约定
 *
 * **平面视角（俯视）的姿态不能用 `lookAt` 求**：视线 `(0,-1,0)` 与默认 `up=(0,1,0)` 平行，
 * 叉积退化成零向量 ⇒ 矩阵坏掉**且不报错**。要直接由欧拉角构造
 * （见 `BuildPlaning/03` §3.4）。本模块不做限制，但请用 `apply` 自己构造姿态。
 */

/** 缓入缓出（`J6.5` 的推移转场默认用它；与 monolith 里同名的 `easeOutCubic` 无关） */
export const easeInOutCubic = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)

/**
 * @param {object} deps
 * @param {import('three').PerspectiveCamera} deps.camera
 * @param {string} [deps.mode] 初始视角（须已 `defineMode` 或稍后补上）
 */
export function createCameraRig({ camera, mode = 'fixed' } = {}) {
  if (!camera || !camera.position) throw new TypeError('createCameraRig 需要一台相机')

  /** @type {Map<string, (state: object, cam: any) => void>} */
  const solvers = new Map()
  let currentMode = mode
  /** 脚本化运镜的当前脚本；非 null 时接管一切 */
  let script = null
  /** 进入脚本前的视角 —— 交还的目标（`BB16`） */
  let modeBeforeScript = null
  /** 最近一次交还记录的视角（测试直接断言它） */
  let lastRestored = null

  /**
   * 注册一种视角的解算方式。
   * @param {string} name `fixed` / `fp` / `tp` / 任意自定义
   * @param {(state: object, cam: any) => void} solver 直接把相机摆好（可以调 `lookAt`）
   */
  function defineMode(name, solver) {
    if (typeof name !== 'string' || !name) throw new TypeError('defineMode 需要字符串名字')
    if (typeof solver !== 'function') throw new TypeError(`${name} 的 solver 必须是函数`)
    solvers.set(name, solver)
    return name
  }

  /** 切换视角（脚本运镜期间调用不生效 —— 脚本结束会交还给进入前的视角） */
  function setMode(m) {
    if (script) return false
    if (!solvers.has(m)) return false
    currentMode = m
    return true
  }

  /**
   * 每帧摆相机（在原 `updatePlayer()` 的位置调用）。
   * @param {object} state 传给 solver 的状态（视角参数 + 玩家位置等）
   * @param {number} [dt] 帧间隔（脚本运镜用它推进）
   */
  function update(state = {}, dt = 0) {
    if (script) {
      advance(dt, state)
      return
    }
    const solver = solvers.get(currentMode)
    if (solver) solver(state, camera)
  }

  function advance(dt, state) {
    const s = script
    s.t += dt
    const raw = s.duration > 0 ? Math.min(1, s.t / s.duration) : 1
    const k = s.easing ? s.easing(raw) : raw
    s.apply(k, state, camera, dt)
    if (raw >= 1) {
      script = null
      const back = modeBeforeScript
      modeBeforeScript = null
      if (back) {
        currentMode = back
        lastRestored = back
      }
      if (s.onDone) s.onDone(back)
    }
  }

  /**
   * 脚本化运镜（`mode: 'scripted'`）。
   *
   * @param {object} spec
   * @param {number} spec.duration 时长（秒）
   * @param {(k: number, state: object, cam: any, dt: number) => void} spec.apply 按插值系数摆相机（`k`：0→1）
   * @param {(x: number) => number} [spec.easing] 缓动（默认 `easeInOutCubic`）
   * @param {(restored: string|null) => void} [spec.onDone] 结束回调（交还后的视角名）
   * @param {boolean} [spec.replace] 已在运镜时是否替换当前脚本（默认 true）
   */
  function playScript({ duration, apply, easing, onDone, replace = true }) {
    if (typeof apply !== 'function') throw new TypeError('playScript 需要 apply(k, state, cam, dt)')
    if (!Number.isFinite(duration) || duration <= 0) throw new TypeError('playScript 需要正的 duration')
    if (script && !replace) return false
    if (!script) modeBeforeScript = currentMode
    script = { t: 0, duration, apply, easing: easing || easeInOutCubic, onDone }
    return true
  }

  /** 中断脚本运镜并**立即交还**（不触发 `onDone`；`BB8` 的"按 ESC 退出阅读"用它） */
  function cancelScript() {
    if (!script) return false
    script = null
    if (modeBeforeScript) {
      currentMode = modeBeforeScript
      lastRestored = modeBeforeScript
      modeBeforeScript = null
    }
    return true
  }

  /**
   * 施加相机抖动（`camShake`）。
   *
   * ⚠️ 只做**位移**，**不做衰减** —— 搬迁前的 `camShake *= Math.exp(-3.2 * dt)` 与
   * `camShake > 0.002` 的判据留在调用方（那是小屋的状态量）。这里逐字照搬位移公式：
   * 三轴各加「runtimeRng 的取值 − 0.5」× `amount`。
   *
   * ★ 形参名刻意叫 `runtimeRng`（而不是泛泛的 `rng`）：一是它就该是**运行期**随机源
   * （不是构建期的场景种子），二是 `verify-migration.mjs` 的「关键标识符计数」按名字
   * 追踪源文件里那 286 处裸随机调用的去向 —— 搬迁到模块里的调用若改了名字，判据会
   * 误报"少了几处随机"；反过来，**注释里也不能出现带括号的裸随机字样**，它同样会被
   * 计数（这两步都踩过）。
   */
  function applyShake(amount, runtimeRng) {
    if (!(amount > 0.002)) return false
    camera.position.x += (runtimeRng() - 0.5) * amount
    camera.position.y += (runtimeRng() - 0.5) * amount
    camera.position.z += (runtimeRng() - 0.5) * amount
    return true
  }

  /**
   * 应用测试机位覆盖（`J0.4` 的 `?cam=`）。
   * 机位数据**不进产品代码**（不变量 `N9`），这里只认"六个数"。
   */
  function applyTestCamera(cam) {
    if (!Array.isArray(cam) || cam.length < 6) return false
    camera.position.set(cam[0], cam[1], cam[2])
    camera.lookAt(cam[3], cam[4], cam[5])
    return true
  }

  return {
    defineMode,
    setMode,
    update,
    playScript,
    cancelScript,
    applyShake,
    applyTestCamera,
    get mode() {
      return currentMode
    },
    get scripted() {
      return script !== null
    },
    /** 最近一次交还到的视角（`BB16` 的断言读它） */
    get lastRestored() {
      return lastRestored
    },
    /** 已注册的视角名 */
    get modes() {
      return [...solvers.keys()]
    },
    stats: () => ({ mode: currentMode, modes: [...solvers.keys()], scripted: script !== null, lastRestored }),
  }
}
