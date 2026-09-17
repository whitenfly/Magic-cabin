/**
 * 18.5 星象仪（点击开关「魔法」）—— `J4.38` 升格 `defineProp`
 *
 * 来源：`legacy/monolith.js` 原 `18.5` 分区（`J4.37` 施工图 §2 记的 `install.js` L171–215）。
 *
 * ## ★ 本件是组 9 的 `magicP` **owner**
 *
 * `magicP` 是「魔法强度」的低通滤波值，原本是 `install.js` 的顶层 `ctx` 状态，
 * 却被 **`veil`（`frame/73`）**、**`candle`（`frame/74`）** 以及
 * **`lights.js` 的槽 6 光源强度**三处读。
 *
 * `J4.37` §1.1 的决策：**`magicP` 归 `astro`**（它本来就是星象仪的状态轴），
 * 另两件经**装配选项**注入取用 —— 与 `J4.34` 的
 * `installProp(teapot, { ctx: { cupFactory } })` 同一手法（已有先例，非新机制）：
 *
 * ```js
 * const astroApi = ctx.installProp(astro);
 * ctx.installProp(veil,           { ctx: { astroApi } });   // veil 读 astroApi.state.magicP
 * ctx.installProp(deskCandle,     { ctx: { astroApi } });   // candle 同理
 * ```
 *
 * ## ★ 帧序：三条不相邻的帧任务合并进一个 `update`（`J4.37` §3）
 *
 * `FrameBody` 原本是三条**不相邻**的调用（`J4.37` §3.1 的帧序全表）：
 *
 * ```
 * frame/72  ctx.magicP += ((ctx.magicOn ? 1 : 0) - ctx.magicP) * 0.012;   ← 状态轴积分
 * frame/73  ctx.veil.material.opacity = ctx.magicP * 0.28;                 ← veil（不属本件）
 * frame/74  … candleGlows … boost = 0.30 + 0.50 * ctx.magicP               ← candle（不属本件）
 * frame/75  if (ctx.magicP > 0.01) { spinG.rotation.y += …; innerG … }     ← 本件
 * frame/76  glows[i].material.opacity = … * ctx.magicP * pulse             ← 本件
 * ```
 *
 * 合并成**一个** `update`，登记在**最前**（`J4.37` §3.3 决定的顺序：
 * **astro → candle → veil → star-particles**），内部三段顺序 `72 → 75 → 76` 与原实现一致。
 *
 * **等价性**（`J4.37` §3.4 判据 ①）：`magicP` 的**全部**读者（`veil` 的 73、`candle` 的 74、
 * 本件的 75/76、`star-particles` 的 77、以及渲染期的槽 6 光源强度）都排在
 * **本 `update` 之后** ⇒ 读到的都是**本帧**值，与原来完全相同。
 *
 * ## 逐字搬运说明
 *
 * 全部数值一个没改：位置 `(1.75, TBL_TOP, -2.72)`、`GOLD 0xc9a227` / `GOLDL 0xb8912a`、
 * 九件几何（底座 `0.15/0.19/0.09`、立柱 `0.055/0.085/0.16`、顶球 `0.04`、
 * `tiltG.rotation.z = 0.41` / `position.y = 0.30`、`spinG.position.y = 0.16`、
 * 轴杆 `0.011/0.60`、中心球 `0.062`、双环 `Torus(0.27, 0.011, 6, 34)`、
 * 内环 `Torus(0.21, 0.009, 6, 28)` / `Torus(0.15, 0.008, 6, 24)`、
 * 辉光球 `0.10/0.55`、`0.20/0.28`、`0.34/0.12`）、
 * `renderOrder = 9`、积分系数 `0.012`、阈值 `0.01`、转速 `+0.020 / −0.008`、
 * 脉动 `0.8 + 0.2·sin(2.4t)`、缩放 `1 + 0.06·sin(2.4t + i·1.1)`。
 *
 * ## `rng`（不变量 `N8`）
 *
 * 本件**不消耗**任何 `rng`（几何全为常量，与 `J4.37` §6 的清单一致）
 * ⇒ 装配位置对后续随机数**无影响**，但 `scene.add` 顺序仍须在原位置。
 */
import * as THREE from 'three'
import { defineProp } from '../../app/defineProp.js'

export default defineProp({
  id: 'floor2/astro',
  kind: 'decor',

  // 原来的 `ctx.magicOn` / `ctx.magicP`（顶层 `ctx` 状态）—— 现在归本件私有，
  // 由 `veil` / `candle` 经装配选项读取（见文件头）。
  state: () => ({ magicOn: false, magicP: 0 }),

  build({ scene, L, put, edge }) {
    const { TBL_TOP } = L

    // 星象仪在桌面上的位置 —— 提成常量，`anchor` 与几何同源（不变量 `N9`）。
    // ⚠️ 与 `floor2/magic-veil` 的锚点**相同**：夜幕本来就是罩在星象仪上的那一层（非笔误）。
    const ASTRO_X = 1.75;
    const ASTRO_Z = -2.72;

    const GOLD = new THREE.LineBasicMaterial({ color: 0xc9a227 });
    const GOLDL = new THREE.LineBasicMaterial({ color: 0xb8912a });
    const astro = new THREE.Group();
    astro.position.set(ASTRO_X, TBL_TOP, ASTRO_Z);
    scene.add(astro);
    put(edge(new THREE.CylinderGeometry(0.15, 0.19, 0.09, 10)), 0, 0.045, 0, 0, 0, 0, astro);
    put(edge(new THREE.CylinderGeometry(0.055, 0.085, 0.16, 8)), 0, 0.17, 0, 0, 0, 0, astro);
    put(edge(new THREE.SphereGeometry(0.04, 8, 6)), 0, 0.265, 0, 0, 0, 0, astro);
    const tiltG = new THREE.Group();
    tiltG.position.y = 0.30;
    tiltG.rotation.z = 0.41;
    astro.add(tiltG);
    const spinG = new THREE.Group();
    spinG.position.y = 0.16;
    tiltG.add(spinG);
    put(edge(new THREE.CylinderGeometry(0.011, 0.011, 0.60, 6)), 0, 0, 0, 0, 0, 0, spinG);
    put(edge(new THREE.SphereGeometry(0.062, 10, 8), 1, GOLD), 0, 0, 0, 0, 0, 0, spinG);
    put(edge(new THREE.TorusGeometry(0.27, 0.011, 6, 34), 1, GOLD), 0, 0, 0, 0, 0, Math.PI / 2, spinG);
    put(edge(new THREE.TorusGeometry(0.27, 0.011, 6, 34), 1, GOLD), 0, 0, 0, 0, 0, 0, spinG);
    const innerG = new THREE.Group();
    spinG.add(innerG);
    put(edge(new THREE.TorusGeometry(0.21, 0.009, 6, 28), 1, GOLDL), 0, 0, 0, Math.PI / 3, 0, Math.PI / 4, innerG);
    put(edge(new THREE.TorusGeometry(0.15, 0.008, 6, 24), 1, GOLDL), 0, 0, 0, Math.PI / 2, 0.8, 0, innerG);

    // 原 `glowBall(r, op)` + `glows` —— 逐字搬运（局部工厂，不进 `ctx`）
    function glowBall(r, op) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
        m.renderOrder = 9;
        m.userData.maxOp = op;
        spinG.add(m);
        return m;
    }
    const glows = [glowBall(0.10, 0.55), glowBall(0.20, 0.28), glowBall(0.34, 0.12)];

    return {
      root: astro,
      parts: {
        astro, tiltG, spinG, innerG, glows,
        consts: { ASTRO_X, ASTRO_Z },
      },
    }
  },

  // 原 `ctx.regMagic(astro, () => { ctx.magicOn = !ctx.magicOn; })` 的等价声明
  interactables: (s, { parts }) => [{
    id: 'astro/toggle-magic',
    label: '启动 / 关闭桌上的星象仪',
    mode: 'both',
    anchor: { x: parts.consts.ASTRO_X, z: parts.consts.ASTRO_Z },
    radius: 1.5,
    hits: parts.astro,
    onActivate: () => { s.magicOn = !s.magicOn; },
  }],

  /**
   * 原 `FrameBody` 的 `frame/72`（L544）、`frame/75`（L566–569）、`frame/76`（L574–578）
   * 三段合并而成 —— **内部顺序与原实现完全一致**（见文件头「帧序」）。
   */
  update(dt, time, s, { parts }) {
    const { spinG, innerG, glows } = parts

    // —— 原 `frame/72`：状态轴积分（★ 全项目所有 `magicP` 读者的唯一写者）——
    s.magicP += ((s.magicOn ? 1 : 0) - s.magicP) * 0.012;

    // —— 原 `frame/75`：两圈环的自转 ——
    if (s.magicP > 0.01) {
        spinG.rotation.y += 0.020 * s.magicP;
        innerG.rotation.y -= 0.008 * s.magicP;
    }

    // —— 原 `frame/76`：三颗辉光球的脉动 ——
    const pulse = 0.8 + 0.2 * Math.sin(time * 2.4);
    for (let i = 0; i < glows.length; i++) {
        glows[i].material.opacity = glows[i].userData.maxOp * s.magicP * pulse;
        glows[i].scale.setScalar(1 + 0.06 * Math.sin(time * 2.4 + i * 1.1));
    }
  },
})
