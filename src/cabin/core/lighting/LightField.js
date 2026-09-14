/**
 * 光照场 —— 把注册进来的光源填进 `FILL` 材质的槽位
 *
 * 来源：新增（`J2.3`）。它消解的是「**新增一盏灯要改 4 处代码**」这件事
 * （`ArtLine-Part/02` §3.4）：
 *
 * | 搬迁前要改的地方 | 现在 |
 * |---|---|
 * | shader 里 `uPtPos[8]` 的数组长度 | 不改（槽位上限是一个常量） |
 * | shader 里 `for (i < 8)` 的循环上界 | 不改（同上） |
 * | `uPtCount` 的初值 | 不改（由 `update()` 自动维护） |
 * | `animate()` 里的 `PP[i].set(...)` 一行 | **改成注册一次** |
 *
 * ⇒ `J2` 的 DoD「新增一盏灯的**改动文件数 = 1**」就是这条。
 *
 * ## ★ 槽位顺序 = 注册顺序（像素零差异的关键）
 *
 * shader 的闪烁相位里有 `float(i)`：
 *
 * ```glsl
 * float flickPt = 0.90 + 0.06 * sin(uTime * (5.3 + float(i) * 1.7) + dPt * 1.1 + float(i) * 2.4) + …
 * ```
 *
 * **槽位索引参与计算** —— 所以顺序一换，同一盏灯的闪烁相位就变了，画面立刻不同。
 * 因此本模块保证：注册数不超过槽位上限时，**严格按注册顺序填入 0…n-1**。
 *
 * ## 超编时的行为（`N 个注册光源` 的"重要性裁剪"）
 *
 * 注册数超过 `slots`（= 8）时，按**当前强度 × priority** 降序取前 `slots` 个
 * （强度为 0 的最先让位），同强度时保持注册顺序（稳定）。
 * 这一步会改变槽位分配与闪烁相位 —— 但它只在"真的超过了槽位上限"时发生，
 * 而且此时必然有画面变化（多了一盏灯），属于预期。
 *
 * ## 空槽位
 *
 * 未使用的槽位会被写成 `y = 0`（强度 0）—— shader 里 `if (ptS < 0.003) continue`，
 * 于是它不参与任何计算。若不清理，上一帧的残留值会留在 uniform 里。
 */
import { POINT_LIGHT_SLOTS } from '../materials/FillMaterial.js'

/**
 * @param {object} deps
 * @param {import('three').ShaderMaterial} deps.fillMaterial 全局 FILL 材质（`createFillMaterial()` 的产物）
 * @param {number} [deps.slots] 槽位上限（默认取 `POINT_LIGHT_SLOTS`，与 shader 声明同源）
 * @param {(msg: string) => void} [deps.warn] 超编提示出口
 */
export function createLightField({ fillMaterial, slots = POINT_LIGHT_SLOTS, warn = () => {} } = {}) {
  if (!fillMaterial || !fillMaterial.uniforms || !fillMaterial.uniforms.uPtPos) {
    throw new TypeError('createLightField 需要一份带 uPtPos/uPtCol/uPtCfg 的 FILL 材质')
  }
  /** 已注册的光源（**按注册顺序**，这个顺序就是槽位顺序） */
  const sources = []
  /** 需要重新计算槽位分配的标记（注册/注销后置位；`J2` 期间只有注册，但留着接口） */
  let overCapacityWarned = false

  /**
   * 注册一盏灯。
   * @returns 传入的光源（便于链式书写）
   */
  function register(source) {
    if (!source || typeof source.strengthOf !== 'function') {
      throw new TypeError('register 需要 createPointLightSource() 的产物')
    }
    sources.push(source)
    if (sources.length > slots && !overCapacityWarned) {
      overCapacityWarned = true
      warn(
        `[LightField] 已注册 ${sources.length} 盏灯，超过槽位上限 ${slots} —— ` +
          `将按强度裁剪（画面会因槽位重排而变化）。要全量显示请提升 POINT_LIGHT_SLOTS 并同步 shader 声明。`,
      )
    }
    return source
  }

  /** 注销（按 id） */
  function unregister(id) {
    const i = sources.findIndex((s) => s.id === id)
    if (i >= 0) sources.splice(i, 1)
    return i >= 0
  }

  /**
   * 每帧填充槽位（由 `tickOnce()` 在原来的位置调用）。
   *
   * @param {number} time 场景时间（秒）—— `strength` 是函数时用它求值
   * @param {number} dt 帧间隔
   */
  function update(time, dt) {
    const PP = fillMaterial.uniforms.uPtPos.value
    const PC = fillMaterial.uniforms.uPtCol.value
    const PG = fillMaterial.uniforms.uPtCfg.value

    // 注册顺序 = 槽位顺序（零差异路径）
    let active = sources
    if (sources.length > slots) {
      active = sources
        .map((s, i) => ({ s, i, w: s.strengthOf(time, dt) * s.priority }))
        .sort((a, b) => b.w - a.w || a.i - b.i) // 稳定：强度相同时保持注册顺序
        .slice(0, slots)
        .map((e) => e.s)
    }

    const n = Math.min(active.length, slots)
    for (let i = 0; i < slots; i++) {
      const s = active[i]
      if (!s) {
        // 空槽位：强度 0 → shader 直接 continue（不清理会留下上一帧的残留值）
        PG[i].set(0, 0, 0, 0)
        continue
      }
      PP[i].set(s.position[0], s.position[1], s.position[2])
      PC[i].set(s.color)
      PG[i].set(s.radius, s.strengthOf(time, dt), s.yMin, s.yMax)
    }
    fillMaterial.uniforms.uPtCount.value = n
    return n
  }

  return {
    register,
    unregister,
    update,
    sources,
    /** 诊断：已注册数 / 槽位上限 / 本帧生效数 */
    stats: () => ({ registered: sources.length, slots, ids: sources.map((s) => s.id) }),
  }
}
