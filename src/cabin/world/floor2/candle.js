/**
 * 18.3 床头柜上的蜡烛（点击点燃 / 熄灭）—— `J4.39` 升格 `defineProp`
 *
 * 来源：`legacy/monolith.js` 原 `18.3` 分区（`J4.37` 施工图 §2 记的 `install.js` L93–125）。
 * 含**光源槽 5**。
 *
 * ## ★ 本件是任务 D 到目前为止**帧任务最分散**的一件（`J4.37` §3.1 查明）
 *
 * `FrameBody` 原本给本件分配了**四条**帧任务，其中两条相隔 **35 个帧任务**：
 *
 * ```
 * frame/35  for (f of candleWavy) { f.obj.visible = true; updateWavyFlame(f, time, 0.9+0.1sin(11t)) }  ← 无条件
 * ┈┈┈┈┈┈┈┈┈┈┈┈┈┈ 中间隔着 35 个别的帧任务（猫 / 书架 / 水晶球 / 暖桌 / 星象仪 …）┈┈┈┈┈┈┈┈┈┈┈┈┈┈
 * frame/70  candleP += ((candleLit ? 1 : 0) - candleP) * 0.03
 * frame/71  candleVisible = candleP > 0.02；f.obj.visible = candleVisible；条件 updateWavyFlame(… candleP*(0.9+0.1sin(9t)))
 * frame/74  candleGlows 的 opacity / scale，boost = 0.30 + 0.50 * magicP      ← ★ 读 astro 的 magicP
 * ```
 *
 * 四条**不相邻**（`35` 与 `70` 之间隔 35 个；`70/71` 与 `74` 之间夹着 `astro` 的 `72` 与 `veil` 的 `73`）。
 *
 * ## 合并方案（`J4.37` §3.3）
 *
 * 合并成**一个** `update`，内部顺序保持 `35 → 70 → 71 → 74` 不变，登记在
 * **`astro` 之后**（`J4.37` 定的组 9 顺序：`astro → candle → veil → star-particles`）。
 *
 * **等价性**（`J4.37` §3.4 判据 ②）：
 * `frame/35` 与 `frame/70` 之间那 35 个帧任务，**既不读也不写 `candleWavy`** ——
 * 已 grep 全仓证实：`candleWavy` 的**全部**读者就是 `FrameBody` 的 L268（`frame/35`）与
 * L534/L537（`frame/71`），**两者都在本 `update` 内部**，且内部顺序不变。
 *
 * ## ★ `frame/74` 读 `astro` 的 `magicP`（本件唯一的跨件耦合）
 *
 * `boost = 0.30 + 0.50 * magicP`。`magicP` 是组 9 的共享状态轴，已由 `J4.38` 搬进
 * `floor2/astro.js`（它的 owner）。本件经**装配选项**注入取用：
 *
 * ```js
 * const astroApi = ctx.installProp(astro);
 * ctx.installProp(candleProp, { ctx: { astroApi } });   // 本件读 astroApi.state.magicP
 * ```
 *
 * ⇒ 由于 `astro` 的 `update` 排在**本件之前**，`magicP` 已是**本帧**值
 * （`J4.37` §3.4 判据 ①）—— 与原实现逐帧等价。
 *
 * ## ★ 火焰材质：经 `propCtx` 注入（不重复常量）
 *
 * 原实现用 `ctx.fireMid` / `ctx.fireIn`（定义在 `world/house/shell.js` L244–245，
 * 与壁炉共用**同一对材质实例**）。它们原先**不在** `propCtx` 的工具表里，
 * 而 `J4.34` §2.1 的先例（`D2R`）是"自造同值常量"—— 但那条处置会**复制色值**，
 * 将来 `shell.js` 改火焰颜色时本件不会跟着变。
 *
 * ⇒ `J4.39` 把这两个材质**补进 `propCtx` 的共享工具表**（与 `makeWavyFlame` /
 * `updateWavyFlame` 同类，见 `app/scene/PropInstaller.js`），**保持单一实例**。
 * 对照：`floor1/cauldron.js`（`J4.29`）自造了三个材质，但那是**另一套颜色**
 * （坩埚的蓝色魔法火），并非重复常量。
 *
 * ## 逐字搬运说明
 *
 * 全部数值一个没改：位置 `(NSX, FY + 0.60, NSZ)`（取自 `L`，与 `floor2/nightstand.js` 同源）、
 * 五段几何（`Cylinder(0.055, 0.075, 0.05, 10)` @y=0.025、`(0.016, 0.016, 0.09, 8)` @y=0.09、
 * `(0.05, 0.06, 0.035, 10)` @y=0.155、烛身 `(0.035, 0.038, 0.20, 10)` @y=0.27、
 * 烛芯 `(0.006, 0.006, 0.035, 6)` @y=0.385）、
 * 两支火苗（`FY+1.00 / 0.12 / 0.034 / 相位 0.0 / 速度 3.2`、`FY+1.02 / 0.07 / 0.016 / 2.0 / 3.8`）、
 * 三层辉光（`Sphere(r, 12, 10)` + `renderOrder = 8` + `maxOp 0.55 / 0.28 / 0.12` +
 * 色 `0xfff0c0 / 0xffc06a / 0xff9a3c` + 位置 `FY + 1.02`）、
 * 积分系数 `0.03`、可见阈值 `0.02`、
 * 火焰强度 `0.9 + 0.1·sin(11t)`（`frame/35`）与 `candleP·(0.9 + 0.1·sin(9t))`（`frame/71`）、
 * 闪烁 `0.9 + 0.1·sin(9t) + 0.04·sin(23t)`、`boost = 0.30 + 0.50·magicP`、
 * 辉光缩放 `1 + 0.05·sin(9t + maxOp·10)`。
 *
 * **`rng`（`N8`）**：本件**不消耗**任何 `rng`（与 `J4.37` §6 的清单一致）。
 */
import * as THREE from 'three'
import { defineProp } from '../../app/defineProp.js'
import { createPointLightSource } from '../../core/lighting/PointLightSource.js'

export default defineProp({
  id: 'floor2/candle',
  kind: 'decor',

  // 原 `ctx.candleLit = true, ctx.candleP = 1`（顶层 `ctx` 状态）—— 现在归本件私有
  state: () => ({ candleLit: true, candleP: 1 }),

  build({ scene, L, put, edge, makeWavyFlame, fireMid, fireIn }) {
    const { NSX, NSZ, FY } = L

    // 蜡烛在床头柜上的位置 —— `anchor` 与几何同源（不变量 `N9`）
    const CANDLE_X = NSX;
    const CANDLE_Z = NSZ;

    const candleG = new THREE.Group();
    candleG.position.set(CANDLE_X, FY + 0.60, CANDLE_Z);
    scene.add(candleG);
    put(edge(new THREE.CylinderGeometry(0.055, 0.075, 0.05, 10)), 0, 0.025, 0, 0, 0, 0, candleG);
    put(edge(new THREE.CylinderGeometry(0.016, 0.016, 0.09, 8)), 0, 0.09, 0, 0, 0, 0, candleG);
    put(edge(new THREE.CylinderGeometry(0.05, 0.06, 0.035, 10)), 0, 0.155, 0, 0, 0, 0, candleG);
    const candleBody = edge(new THREE.CylinderGeometry(0.035, 0.038, 0.20, 10));
    candleBody.position.set(0, 0.27, 0);
    candleG.add(candleBody);
    put(edge(new THREE.CylinderGeometry(0.006, 0.006, 0.035, 6)), 0, 0.385, 0, 0, 0, 0, candleG);

    // 两支火苗 —— 材质是 `shell.js` 里与壁炉共用的那一对（经 `propCtx` 注入，不复制色值）
    const candleWavy = [];
    makeWavyFlame(CANDLE_X, CANDLE_Z, FY + 1.00, 0.12, 0.034, fireMid, 0.0, 3.2, candleWavy);
    makeWavyFlame(CANDLE_X, CANDLE_Z, FY + 1.02, 0.07, 0.016, fireIn, 2.0, 3.8, candleWavy);

    // 三层辉光 —— 原 `makeCandleGlow(r, op, col)` 逐字搬运（局部工厂，不再挂 `ctx`）
    const candleGlows = [];
    function makeCandleGlow(r, op, col) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
        m.position.set(CANDLE_X, FY + 1.02, CANDLE_Z);
        m.renderOrder = 8;
        scene.add(m);
        candleGlows.push({ m: m, maxOp: op });
    }
    makeCandleGlow(0.045, 0.55, 0xfff0c0);
    makeCandleGlow(0.10, 0.28, 0xffc06a);
    makeCandleGlow(0.18, 0.12, 0xff9a3c);

    return {
      root: candleG,
      parts: {
        candleG, candleBody, candleWavy, candleGlows,
        consts: { CANDLE_X, CANDLE_Z },
      },
    }
  },

  /**
   * ★ 光源槽位 5 —— 取代 `world/lights.js` 里原来那一行 `lightField.register(…)`。
   *
   * `slot` 显式声明：槽序与装配时机无关（`J4.18` 契约）。
   * `strength` 闭包读**物件自己的 state** `s.candleP` —— `ctx.candleP` 从此不存在。
   * 位置 / 颜色 / 半径 / `yMin` / `yMax` / `id` 与搬迁前那一行**逐字相同**。
   */
  lights: (s, { L }) => [
    createPointLightSource({
      id: 'floor2/candle', slot: 5,
      position: [L.NSX, L.FY + 1.00, L.NSZ], color: 0xffc06a, radius: 3.6,
      strength: () => s.candleP,
      yMin: 3.02, yMax: 6.9,
    }),
  ],

  // 原 `ctx.regMagic(candleG, …)` 的等价声明（点一下把 `candleLit` 取反 → `s.candleLit`）。
  // ⚠️ 与 `hangingLantern.js` / `deskChair.js` 同一条注意：**不写出那个「函数名 + 左括号」的字面量**
  //    —— `verify-migration.mjs` 的 `stripComments` 只剥块注释、不剥行注释（`J4.20` §4.2）。
  // 锚点与几何同源（不变量 `N9`）。`mode: 'both'` —— 否则默认固定视角下点不开（风险 `R1`）。
  interactables: (s, { parts }) => [{
    id: 'candle/toggle',
    label: '点燃 / 熄灭床头柜上的蜡烛',
    mode: 'both',
    anchor: { x: parts.consts.CANDLE_X, z: parts.consts.CANDLE_Z },
    radius: 1.5,
    hits: parts.candleG,
    onActivate: () => { s.candleLit = !s.candleLit },
  }],

  /**
   * 原 `FrameBody` 的 `frame/35`（L266–272）、`frame/70`（L528）、
   * `frame/71`（L532–539）、`frame/74`（L553–562）**四条合并**而成 ——
   * **内部顺序与原实现完全一致**（见文件头「合并方案」）。
   *
   * `astroApi` 经装配选项注入 —— `frame/74` 的 `boost` 读组 9 的共享状态轴 `magicP`。
   */
  update(dt, time, s, { parts, updateWavyFlame, astroRef }) {
    const { candleWavy, candleGlows } = parts

    // —— 原 `frame/35`：无条件把两支火苗点亮（★ 本阶段位移最大的一处：跨 35 个帧任务）——
    for (const f of candleWavy) {
        f.obj.visible = true;
        updateWavyFlame(f, time, 0.9 + 0.1 * Math.sin(time * 11));
    }

    // —— 原 `frame/70`：强度的一阶低通 ——
    s.candleP += ((s.candleLit ? 1 : 0) - s.candleP) * 0.03;

    // —— 原 `frame/71`：按强度决定可见性 + 火焰强度随强度走 ——
    const candleVisible = s.candleP > 0.02;
    for (const f of candleWavy) {
        f.obj.visible = candleVisible;
        if (candleVisible) {
            updateWavyFlame(f, time, s.candleP * (0.9 + 0.1 * Math.sin(time * 9)));
        }
    }

    // —— 原 `frame/74`：三层辉光的透明度与缩放（★ 读 astro 的 magicP）——
    {
        const flick = 0.9 + 0.1 * Math.sin(time * 9) + 0.04 * Math.sin(time * 23);
        const boost = 0.30 + 0.50 * astroRef.api.state.magicP;
        for (const cg of candleGlows) {
            cg.m.material.opacity = cg.maxOp * s.candleP * boost * flick;
            cg.m.scale.setScalar(1 + 0.05 * Math.sin(time * 9 + cg.maxOp * 10));
        }
    }
  },
})
