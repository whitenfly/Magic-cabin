/**
 * 弹簧与滑轨 —— 可开合 / 可滑动物件的公共运动实现
 *
 * 来源：`cabin/legacy/monolith.js` 原 382–385 行（原样搬迁，`J2.4`）。
 *
 * 搬迁原则（`docs/BuildPlaning/01-完善路线图.md` §1 原则 2「搬迁期零优化」）：
 * **系数、更新顺序、公式逐字照搬** —— 只把单行压缩写法重新排版成多行，
 * 无语义改动。因此画面与搬迁前逐字节一致（`pnpm test:visual` 判据）。
 *
 * 为什么是工厂而不是模块级单例：
 * 集合的生命周期与「一局小屋」绑定，且 monolith 内部**直接引用** `hingeMeshes`
 * （准星射线 `aimRay()` 与点击射线都靠它做命中集合）。工厂把"谁持有集合"交回调用方，
 * 同时满足不变量 `N7`（禁止新增全局可变状态）。
 *
 * 与 `core/` 的约束一致：本文件不知道任何具体物件的名字（不变量 `N1`）——
 * 它只认 `userData.spring` / `userData.slide` 这两个契约字段。
 */

/**
 * 创建一套弹簧系统。
 *
 * @returns {{
 *   hinges: THREE.Object3D[], hingeMeshes: THREE.Mesh[], slides: THREE.Object3D[],
 *   registerHinge: (g: THREE.Object3D) => void,
 *   regSlide: (g: THREE.Object3D, axis: 'x'|'y'|'z', dist: number) => THREE.Object3D,
 *   updateSprings: () => void,
 * }}
 */
export function createSpringSystem() {
  /** 铰链（门 / 窗 / 抽屉盖 / 凳子…）：进度存在 `g.userData.spring`，绕 `rotation.y` 开合 */
  const hinges = []
  /** 铰链上所有 Mesh 的扁平表 —— 两条射线（准星 / 点击）的**唯一**命中集合 */
  const hingeMeshes = []
  /** 滑轨（抽屉 / 滑台）：进度存在 `g.userData.slide`，沿单一轴平移 */
  const slides = []

  /**
   * 注册一个铰链物件。
   * 读取字段（由各 prop 自己写进 `userData`）：`base`（闭合角）、`delta`（开合角差）、
   * 可选 `bounce`（回弹）、`sfx` / `aimLabel` / `onToggle`（交互侧读）。
   */
  function registerHinge(g) {
    g.userData.spring = { cur: 0, vel: 0, open: false }
    hinges.push(g)
    g.traverse((o) => {
      if (o.isMesh) {
        o.userData.hingeGroup = g
        hingeMeshes.push(o)
      }
    })
  }

  /**
   * 注册一个滑轨物件。
   * `base` 取注册时刻的位置（即"闭合位"），`dist` 为相对位移。
   */
  function regSlide(g, axis, dist) {
    g.userData.slide = { cur: 0, vel: 0, open: false, base: g.position[axis], axis: axis, dist: dist }
    slides.push(g)
    return g
  }

  /**
   * 每帧推进所有弹簧（由 `app/UpdateScheduler.js` 以 always 档调用）。
   *
   * 两段结构照搬原实现：先铰链（阻尼 0.95 / 刚度 0.015），再滑轨（阻尼 0.92 / 刚度 0.02）。
   * 顺序不可换 —— 铰链与滑轨虽互不影响，但保持原顺序是"零差异"的一部分。
   */
  function updateSprings() {
    for (const g of hinges) {
      const s = g.userData.spring
      const target = s.open ? 1 : 0
      s.vel += (target - s.cur) * 0.015
      s.vel *= 0.95
      s.cur += s.vel
      if (s.cur < 0 && g.userData.bounce) {
        s.cur = 0
        s.vel = -s.vel * 0.35
      }
      g.rotation.y = g.userData.base + g.userData.delta * s.cur
    }
    for (const g of slides) {
      const s = g.userData.slide
      const target = s.open ? 1 : 0
      s.vel += (target - s.cur) * 0.02
      s.vel *= 0.92
      s.cur += s.vel
      g.position[s.axis] = s.base + s.dist * s.cur
    }
  }

  return { hinges, hingeMeshes, slides, registerHinge, regSlide, updateSprings }
}
