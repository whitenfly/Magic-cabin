/**
 * 茶杯（餐桌 / 暖桌通用）—— **共享工厂** + 每帧更新（`J4.26` 抽取）
 *
 * 来源：`legacy/monolith.js` 原 `/* 茶杯（餐桌/暖桌通用） *\/` 那一段
 * —— `makeCup(x, z, baseY, parent)` 与 `cups` 数组（`J3` 记的 L1096–1117），
 * 以及 `tickOnce()` 里 `for (const c of cups) { … }` 那段每帧分支（`J3` 记的 L6754 一带）。
 *
 * ## 为什么要有这个文件（`J3` 留下的两条前置之一）
 *
 * `floor1-kotatsu.SKIP.md` §「阻塞二」写得很清楚：`makeCup` 定义在**长餐桌**那个分区，
 * 却有**三个**读者：
 *
 * | 读者 | 位置 | 用途 |
 * |---|---|---|
 * | 提梁茶壶 | `const CUP_T = cups[2]` | 茶壶往哪只杯子倒水由它决定 |
 * | 暖桌（12.13） | `makeCup(-0.34, -0.34, KTOP, kotatsuG)` ×2 | 桌上摆两只茶杯 |
 * | 每帧 | `for (const c of cups)` | 茶杯升腾 / 水汽动画 |
 *
 * ⇒ **暖桌与提梁茶壶都依赖长餐桌那一件的内部函数**。`J3` 的结论：
 * "得先把 `makeCup` 抽成 `cabin/props/` 级别的共享工厂（`world/README.md` 已经写了这个方向：
 * 「跨场景复用道具放在 `cabin/props/`，本目录只负责摆放」），那不是本轮能顺手做完的事。"
 *
 * 本文件就是那件事：把工厂与每帧更新搬进来，**摆放由各物件自己声明**
 * （谁放几只、放在哪，仍写在各自的装配点里）。
 *
 * ## 为什么是「工厂」而不是「模块级单例」
 *
 * `cups` 是**跨物件的共享集合**（长餐桌 3 只 + 暖桌 2 只 = 5 只），每帧动画要遍历它。
 * 但它**不能**做成模块级单例 —— 那会引入全局可变状态（违反不变量 `N7`：
 * "物件状态活在闭包（`state()`）里"）。所以这里导出 `createCupFactory(deps)`：
 * 集合住在**闭包**里，由装配点在**原位置**创建一次，再把 `cups` 交给需要它的读者
 * （与 `J4.18` 的 `LightField`、`J4.20` 的 `consts` 同一思路）。
 *
 * ## 逐字搬运说明
 *
 * 两个函数的**函数体一字未改**，只把外来的 `ctx` 依赖改成显式的 `deps`
 * 参数 / 闭包捕获：`ctx.put` → `put`、`ctx.edge` → `edge`、`ctx.line` → `line`、
 * `ctx.scene` → `scene`、`ctx.DTOP` → `defaultBaseY`、`ctx.regMagic` → `regMagic`。
 * 全部数值（杯身 `0.045/0.038/0.09/12`、把手 `0.03/0.008/6/12` 与 `0.052/0.045`、
 * 三缕水汽的折线点、`steam.position.y = 0.10`、`2.6` 秒的升腾时长、
 * 每帧的 `0.13` 抬升、`0.25` 与 `0.07` 的水汽滚动、`0.85 + 0.15×sin(5t)` 的缩放）
 * **一个没改**。
 *
 * ⚠️ `regMagic(g, …)` 这一行**留在本文件里**（它是茶杯自己的交互）——
 * `verify-migration.mjs` ④ 的调用点计数因此**净变化为 0**（`install.js` 少 1、本文件多 1，
 * 而本文件在 `src/cabin/` 下、**在计数范围内**）。这是**正确**的：茶杯的交互并没有消失，
 * 只是跟着工厂一起搬了家。`J4.22` §6.2 那个"行注释里写出字面量会抵平计数"的坑
 * 在本文件里**不适用**（这里是真正的代码，不是注释）。
 */
import * as THREE from 'three'

/**
 * 造一个茶杯工厂。
 *
 * @param {object} deps 装配期依赖（全部来自装配环境 `ctx`，**在原位置取一次**）
 * @param {Function} deps.put 几何放置 DSL
 * @param {Function} deps.edge 描边材质工具
 * @param {Function} deps.line 折线工具
 * @param {object} deps.scene 场景根（没有 `parent` 时茶杯挂这里）
 * @param {number} deps.defaultBaseY 未传 `baseY` 时的默认台面高度（原 `ctx.DTOP`）
 * @param {Function} deps.regMagic 交互注册（原 `ctx.regMagic`）
 * @returns {{cups: Array, makeCup: Function, update: Function}}
 */
export function createCupFactory({ put, edge, line, scene, defaultBaseY, regMagic }) {
  /** 全部茶杯（**跨物件的共享集合**：长餐桌 3 只 + 暖桌 2 只）—— 住在闭包里 */
  const cups = []

  /**
   * 摆一只茶杯。
   *
   * @param {number} x 世界 x
   * @param {number} z 世界 z
   * @param {number} [baseY] 杯底高度（省略 = `deps.defaultBaseY`）
   * @param {object} [parent] 父节点（省略 = `deps.scene`）
   */
  function makeCup(x, z, baseY, parent) {
      const by = (baseY === undefined) ? defaultBaseY : baseY;
      const g = new THREE.Group();
      put(edge(new THREE.CylinderGeometry(0.045, 0.038, 0.09, 12)), 0, 0.045, 0, 0, 0, 0, g);
      put(edge(new THREE.TorusGeometry(0.03, 0.008, 6, 12)), 0.052, 0.045, 0, 0, 0, 0, g);
      const steam = new THREE.Group();
      for (const off of [-0.015, 0, 0.015])
          put(line([[off, 0, 0], [off + 0.012, 0.035, 0.003], [off - 0.01, 0.07, -0.003], [off + 0.008, 0.105, 0.002]]),
              0, 0, 0, 0, 0, 0, steam);
      steam.position.y = 0.10;
      steam.visible = false;
      g.add(steam);
      g.position.set(x, by, z);
      (parent || scene).add(g);
      g.userData = { run: 0, lift: 0, steam, baseY: by };
      cups.push(g);
      regMagic(g, () => { g.userData.run = 2.6; });
  }

  /**
   * 每帧更新（原 `tickOnce()` 里的 `for (const c of cups) { … }`，逐字搬运）。
   *
   * ⚠️ 它在 `tickOnce()` 里的**原位置**是 `frame/45` —— 调用方必须仍在那个位置调用它，
   * 否则帧顺序变了、画面就会变。
   */
  function update(dt, time) {
      for (const c of cups) {
          const u = c.userData;
          if (u.run > 0) u.run -= dt;
          const prog = u.run > 0 ? Math.min(Math.max(1 - u.run / 2.6, 0), 1) : 1;
          const env = u.run > 0 ? Math.sin(Math.PI * prog) : 0;
          u.lift = env * 0.13;
          c.position.y = u.baseY + u.lift;
          u.steam.visible = u.run > 0;
          if (u.steam.visible) {
              u.steam.position.y = 0.10 + (time * 0.25) % 0.07;
              const ss = 0.85 + 0.15 * Math.sin(time * 5);
              u.steam.scale.set(ss, 1, ss);
          }
      }
  }

  return { cups, makeCup, update }
}
