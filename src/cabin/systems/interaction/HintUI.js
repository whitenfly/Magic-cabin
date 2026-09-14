/**
 * 提示文案 UI —— 面向用户的提示**唯一**出口
 *
 * 来源：新增（`J2.6`）。搬迁前 `hintEl.innerHTML` 被直接写了 **4 处**
 * （`updateInteractHint()` 的 override 分支、准星分支、近距分支，以及别处的直接赋值），
 * 于是"文案长什么样"这件事散在更新逻辑里 —— 违反不变量 `N10`
 * （面向用户的文案必须集中，不得散落在更新逻辑里）。
 *
 * 现在只有这里会碰 `#hint`：
 *
 * | 方法 | 场景 | 文案模板 |
 * |---|---|---|
 * | `showAim(label)` | 第一人称准星指到东西 | `点击 左键 <label>`（触屏：`点按 准星 或 交互键 <label>`） |
 * | `showProximity(label)` | 固定/第三人称走到近处 | `按 E <label>`（触屏：`点按 交互键 <label>`） |
 * | `showOverride(html, sec)` | 临时消息（如"路牌已更新"） | 调用方给整段 HTML，`sec` 秒后自动让位 |
 *
 * ## 为什么要"临时消息"这一档
 *
 * 交互提示与临时消息**抢同一块 DOM**（`#hint`）。搬迁前用两个变量
 * （`hintOverrideUntil` / `hintOverrideText`）+ 一处时间比较解决；
 * 这里把它收进 `showOverride()`，调用方不再需要知道"比较 `clock.wallNow()`"这个细节。
 */
export function createHintUI({ element, clock, isTouch = false, overrideSeconds = 2.4 } = {}) {
  if (!element) throw new TypeError('createHintUI 需要 #hint 元素')
  if (!clock) throw new TypeError('createHintUI 需要 clock（用于临时消息的过期判断）')
  let overrideUntil = 0
  let overrideText = ''

  /** 直接显示一段 HTML（内部用；外部请用 showAim / showProximity / showOverride） */
  function show(html) {
    element.innerHTML = html
    element.classList.add('show')
  }

  /** 隐藏 */
  function hide() {
    element.classList.remove('show')
  }

  /** 准星指到某个可交互物件 */
  function showAim(label) {
    show(
      (isTouch ? '点按 <b>准星</b> 或 <b>交互键</b> ' : '点击 <b>左键</b> ') + label,
    )
  }

  /** 走到某个可交互物件的近处 */
  function showProximity(label) {
    show((isTouch ? '点按 <b>交互键</b> ' : '按 <b>E</b> ') + label)
  }

  /** 临时消息（会在一段时间内压过交互提示） */
  function showOverride(html, seconds = overrideSeconds) {
    overrideText = html
    overrideUntil = clock.wallNow() + seconds
    show(html)
  }

  /**
   * 若临时消息仍在有效期内：把它渲染出来并返回 `true`（调用方据此提前返回）。
   * 否则返回 `false`，让调用方继续走常规提示逻辑。
   */
  function applyOverride() {
    if (clock.wallNow() < overrideUntil) {
      show(overrideText)
      return true
    }
    return false
  }

  return {
    show,
    hide,
    showAim,
    showProximity,
    showOverride,
    applyOverride,
    get overrideActive() {
      return clock.wallNow() < overrideUntil
    },
  }
}
