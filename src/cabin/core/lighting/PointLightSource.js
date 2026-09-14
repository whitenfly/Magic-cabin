/**
 * 点光源 —— 一盏"室内照明"的完整描述
 *
 * 来源：新增（`J2.3`）。搬迁前这盏灯的四个参数是散在 `animate()` 里的一行硬编码：
 *
 * ```js
 * PP[0].set(MTX, 2.52, MTZ); PC[0].set(0xffb066); PG[0].set(4.6, ptLantern, 0.0, 3.04);
 * //   ↑位置                     ↑颜色                  ↑半径 ↑强度   ↑yMin ↑yMax
 * ```
 *
 * 现在它是**一个对象**：位置与颜色是常量、`strength` 是每帧求值的函数
 * （吊灯会呼吸、烛火会闪、暖桌的暖光带正弦起伏），`yMin/yMax` 是"影响的高度区间"
 * （shader 用它做房间分层：一楼的光不该照到二楼）。
 *
 * ## 为什么强度是函数而不是数值
 *
 * 8 个光源里有 5 个的强度是**状态量**（`lanternLit`、`kotatsuOn`、`mcRun`…），
 * 它们在 `tickOnce()` 里被平滑地趋近目标值。传一个 `strength: () => ptLantern` 的闭包，
 * 光源本身就不需要知道"谁是 lanternLit"——`core/` 里不出现具体物件的名字（不变量 `N1`）。
 */

/**
 * @param {object} spec
 * @param {string} spec.id 光源 id（诊断 / 去重；如 `floor1/lantern`）
 * @param {[number, number, number]} spec.position 世界坐标
 * @param {number} spec.color 十六进制颜色（如 `0xffb066`）
 * @param {number} spec.radius 影响半径
 * @param {number|((time: number, dt: number) => number)} spec.strength 强度（0 = 熄灭）
 * @param {number} [spec.yMin=0] 影响区间的下界
 * @param {number} [spec.yMax=3.04] 影响区间的上界（一楼的灯通常到楼面为止）
 * @param {number} [spec.priority=1] 超编时的额外权重（`J2.3` 的重要性裁剪用）
 */
export function createPointLightSource(spec) {
  if (!spec || typeof spec.id !== 'string') throw new TypeError('createPointLightSource 需要字符串 id')
  if (!Array.isArray(spec.position) || spec.position.length !== 3) {
    throw new TypeError(`${spec.id} 的 position 必须是三元数组`)
  }
  const strength = spec.strength === undefined ? 1 : spec.strength
  return {
    id: spec.id,
    position: spec.position,
    color: spec.color,
    radius: spec.radius,
    yMin: spec.yMin ?? 0,
    yMax: spec.yMax ?? 3.04,
    priority: spec.priority ?? 1,
    /** 取当前强度（常量直接返回，函数则求值） */
    strengthOf(time, dt) {
      const v = typeof strength === 'function' ? strength(time, dt) : strength
      return Number.isFinite(v) ? v : 0
    },
  }
}
