/**
 * 18.6 二楼夜幕（罩住星象仪的那层紫幕）—— `J4.40` 升格 `defineProp`
 *
 * 来源：`legacy/monolith.js` 原 `18.6` 分区（`J4.37` 施工图 §2 记的 `install.js` L216–235）。
 * 含**光源槽 6**。
 *
 * ## 本件是组 9 里最"被动"的一件
 *
 * - **没有 `regMagic`** ⇒ 本件**没有 `interactables()`**（它不是可点击的陈设，
 *   而是随星象仪的开关一起明暗的**效果层**）；
 * - **只有一条帧任务**：`frame/73` 的 `veil.material.opacity = magicP * 0.28`；
 * - **没有自己的状态量** —— 它的唯一驱动量 `magicP` 属于 `astro`（组 9 的共享状态轴，
 *   见 `floor2/astro.js` 文件头与 `J4.37` §1.1）。
 *
 * ## 位置与 `astro` 重合（**不是笔误**）
 *
 * 夜幕是个 `ExtrudeGeometry` 挤出的大罩子（五边形轮廓 × 深 7.6），盖在星象仪上方；
 * 它那条**光源**（槽 6）的位置 `[1.75, TBL_TOP + 0.52, -2.72]` 与
 * `floor2/astro.js` 里星象仪的位置 `(1.75, TBL_TOP, −2.72)` **水平坐标相同** ——
 * 因为"夜幕的光"本来就来自星象仪本身（魔法光把幕布映亮）。
 *
 * ## 依赖：`magicP` 经装配选项注入
 *
 * ```js
 * const astroApi = ctx.installProp(astro1);          // 18.5
 * ctx.installProp(magicVeil, { ctx: { astroApi } }); // 18.6（本件）—— 晚于 astro，直接注入即可
 * ```
 *
 * ⚠️ 与 `floor2/candle.js` 的差别：蜡烛在 **18.3** 装配，那时 `astro` 还不存在，
 * 所以它用**可变引用容器 + 回填**；本件在 **18.6**，`astro` 已经装好
 * ⇒ **直接注入 `astroApi` 即可**，不需要容器。
 *
 * ## 帧序（`J4.37` §3.3）
 *
 * `frame/73` 单独一条，登记在 **`candle` 之后**（组 9 顺序 `astro → candle → veil → stars`）。
 * 它读 `magicP`，而 `astro` 的 `update` 排在更前面 ⇒ 读到的是**本帧**值（判据 ①）✓
 * 改动量极小：`frame/73` 在 `FrameBody` 里的**相对位置没有变**（原本就夹在
 * `candle` 的 `71` 与 `74` 之间；现在 `71`/`74` 已并入 `candle` 的 `update`，
 * 而那条 `update` 的登记点前移到了 `frame/35` 的位置 —— `73` 仍在它之后 ✓）。
 *
 * ## ★ 本件搬走之后 `world/lights.js` 即**清空**
 *
 * 槽 6 是 `lights.js` 里**最后一行** `lightField.register(…)`。本件把它收进 `lights()` 之后，
 * 那个文件只剩注释与"同步登记到应用内核"的循环 ⇒ **批 2（六件含光源件）到此收尾**。
 *
 * ## 逐字搬运说明
 *
 * 全部数值一个没改：五边形轮廓 `(-3.8,0) → (3.8,0) → (3.8,1.35) → (0,3.20) → (-3.8,1.35)`、
 * `ExtrudeGeometry({ depth: 7.6, bevelEnabled: false })`、两次 `translate(0, 0, −3.8)` 与
 * `translate(0, FLOOR_TOP, 0)`、材质 `0x5f5480` + `transparent` + `opacity: 0` +
 * `depthWrite: false` + `side: DoubleSide`、`renderOrder = 4`、
 * 帧侧 `opacity = magicP × 0.28`。
 *
 * **`rng`（`N8`）**：本件**不消耗**任何 `rng`（与 `J4.37` §6 的清单一致）。
 */
import * as THREE from 'three'
import { defineProp } from '../../app/defineProp.js'
import { createPointLightSource } from '../../core/lighting/PointLightSource.js'

export default defineProp({
  id: 'floor2/magic-veil',
  kind: 'decor',

  // 本件没有自己的状态量 —— 唯一驱动量 `magicP` 属于 `astro`（见文件头）。
  // 仍给一个空 state，让契约形状与其它物件一致（`defineProp` 允许省略，但显式更好读）。
  state: () => ({}),

  build({ scene, L }) {
    const { FLOOR_TOP } = L

    const veilShape = new THREE.Shape();
    veilShape.moveTo(-3.8, 0);
    veilShape.lineTo(3.8, 0);
    veilShape.lineTo(3.8, 1.35);
    veilShape.lineTo(0.0, 3.20);
    veilShape.lineTo(-3.8, 1.35);
    veilShape.closePath();
    const veilGeo = new THREE.ExtrudeGeometry(veilShape, { depth: 7.6, bevelEnabled: false });
    veilGeo.translate(0, 0, -3.8);
    veilGeo.translate(0, FLOOR_TOP, 0);
    const veil = new THREE.Mesh(veilGeo, new THREE.MeshBasicMaterial({ color: 0x5f5480, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    veil.renderOrder = 4;
    scene.add(veil);

    return { root: veil, parts: { veil } }
  },

  /**
   * ★ 光源槽位 6 —— 取代 `world/lights.js` 里**最后一行** `lightField.register(…)`。
   *
   * `slot` 显式声明：槽序与装配时机无关（`J4.18` 契约）。
   * `strength` 闭包由 `() => ctx.magicP` 改为读 **owner（`astro`）的 state**
   * `astroApi.state.magicP` —— 本件自己没有强度状态量（见文件头）。
   * `id` / `position` / `color` / `radius` / `yMin` / `yMax` 与搬走那一行**逐字相同**。
   */
  lights: (s, { L, astroApi }) => [
    createPointLightSource({
      id: 'floor2/magic-veil', slot: 6,
      position: [1.75, L.TBL_TOP + 0.52, -2.72], color: 0xffe08a, radius: 4.6,
      strength: () => astroApi.state.magicP,
      yMin: 3.02, yMax: 6.9,
    }),
  ],

  // ⚠️ 本件**没有 `interactables()`** —— 原实现里 18.6 段没有任何 `regMagic`（它不是可点的陈设）。

  /**
   * 原 `FrameBody` 的 `frame/73`（L549）—— 逐字搬运。
   */
  update(dt, time, s, { parts, astroApi }) {
    parts.veil.material.opacity = astroApi.state.magicP * 0.28;
  },
})
