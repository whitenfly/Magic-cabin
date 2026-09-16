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
 *
 * ## ★ `slot`：让槽位**脱离注册时机**（`J4.18`）
 *
 * `J3` 判定「6 件含光源物件搬不动」的病根是**槽序 = 注册顺序**：
 * 那 8 盏灯全在 `world/lights.js` 里**一次注册完**（段 03 之后），而物件分散在
 * 段 08–10 装配 —— 于是"把一盏灯的注册跟着物件搬走"必然改变它的注册位次，
 * 而 shader 的闪烁相位含 `float(i)` ⇒ 槽位一变画面就变（见 `LightField.js` 文件头）。
 *
 * 声明 `slot` 之后，这一盏灯的位置由**它自己**决定，与"第几个注册"无关：
 * 物件可以在任何装配时机声明 `slot: 0`，它照样落在第 0 槽。
 * ⇒ 灯可以整体搬进物件文件（连同它的 `strength` 闭包与 state），而槽序不动。
 *
 * 省略 `slot` 时沿用原语义（按注册顺序追加），因此**既有调用方逐字节不受影响**。
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
 * @param {number} [spec.slot] 显式槽位号（`0`…`slots-1`）—— 见文件头「`slot`：让槽位脱离注册时机」。
 *   省略（或传 `null`）= 按注册顺序追加（原语义）。
 */
export function createPointLightSource(spec) {
  if (!spec || typeof spec.id !== 'string') throw new TypeError('createPointLightSource 需要字符串 id')
  if (!Array.isArray(spec.position) || spec.position.length !== 3) {
    throw new TypeError(`${spec.id} 的 position 必须是三元数组`)
  }
  if (spec.slot !== undefined && spec.slot !== null && !Number.isInteger(spec.slot)) {
    throw new TypeError(`${spec.id} 的 slot 必须是整数（或省略）`)
  }
  const strength = spec.strength === undefined ? 1 : spec.strength
  return {
    id: spec.id,
    // `null` 与省略同义 = "没声明槽位" ⇒ 走注册顺序（归一化后由 `LightField.register` 判分支）
    slot: Number.isInteger(spec.slot) ? spec.slot : null,
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
