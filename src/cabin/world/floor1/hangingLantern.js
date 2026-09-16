/**
 * 12.7 吊挂木灯 —— `J4.22` 升格 `defineProp`
 *
 * 来源：`legacy/monolith.js` 原 `12.7 吊挂木灯` 分区（`J3` 记的 L734–772）的**几何段**，
 * 以及 `tickOnce()` 里那**五段连续的每帧分支**（`J3` 记的 L6351–6362）。
 * 「点灯」交互来自那一段末尾的 `regMagic(lanternPivot, …)`。
 *
 * ## ★ 这是 `J4.18` 那条前置通道的**第一个真实用户**
 *
 * `floor1-hanging-lantern.SKIP.md` 把病根写得很清楚：`lanternLit → ptLantern → 槽位 0 的强度`，
 * 而 `ptLantern` 那一行**住在替换区间之外**（灯自己的每帧分支之后约 340 行）。
 * 于是 `J3` 的两条路都走不通：
 *
 * | `J3` 记的走不通的路 | `J4.18` 之后 |
 * |---|---|
 * | `lights()` 里重注册这一盏 ⇒ 变 9 盏、新的一盏排在第 8 槽 | ✅ 现在 `slot: 0` **显式声明**槽位，与注册时机无关 |
 * | 把状态漏回 monolith（`hangingLanternApi.state.lanternLit`） | ✅ `s.lit` / `s.pt` 都是物件私有 state，`strength` 闭包直接读它 |
 *
 * ## 搬迁对照
 *
 * | 原来住哪 | 现在住哪 |
 * |---|---|
 * | 顶层 `let lanternLit = true` | `state: () => ({ lit: true, pt: 1 })` |
 * | `ctx.ptLantern`（`WeatherSystem.js` L619 初始化 = `1`） | `state.pt`（**同一个初值**） |
 * | `ctx.ptLantern += …`（`tickOnce()` 末尾那 5 行之一） | `update()` 的最后一段（见下 ★） |
 * | `lanternPivot` / `lantG` / `lanternFlame` / `halo` / `beam` / `floorPool` / `floorPool2` / `tablePool` | `build()` 内的同名局部量，经 `parts` 交出（**同一个实例**） |
 * | `haloMat` / `beamMat` / `glowMatA` / `glowMatB` | 同上（每帧块要改它们的 `opacity`） |
 * | 末尾硬编码的 `lightField.register(… 'floor1/lantern' …)`（`world/lights.js`） | `lights()`：`slot: 0` + `strength: () => s.pt` |
 * | `regMagic(lanternPivot, …)` | `interactables()`：一条（`mode: 'both'`） |
 * | `tickOnce()` 里那五段（`frame/18`–`frame/22`） | `update()` 的前五段 |
 *
 * ## ★ 帧顺序：`ptLantern` 的平滑**提前**了，为什么等价
 *
 * 原实现里它的位置是 `frame/92`（`lightField.update` 是 `frame/97`），而本物件几何分支的位置是
 * `frame/18`–`frame/22`。**一件物件只有一个 `update`**，所以两处必须合并到同一个位置
 * —— 本件选择**几何分支的位置**（早），于是 `ptLantern` 的平滑**提前**约 74 个帧任务执行。
 *
 * 这**不改变画面**，论证有两条、都可查：
 *
 * 1. **数值序列完全相同**：它是一阶低通 `p += (目标 - p) * 0.07`，同一帧内 `dt` 相同、
 *    输入 `lanternLit` 相同 ⇒ 逐位相同。唯一会破坏它的是"两个位置之间有人改了输入" ——
 *    `grep ctx.lanternLit` 的全部命中只有本物件的五段与这里（外加 `lights()` 的闭包，
 *    而它在 `frame/97` 才被调用）⇒ **中间没有任何读者或写者**；
 * 2. **仍然早于读者**：`lightField.update` 在 `frame/97`，本 `update` 在 `frame/18` 位置
 *    ⇒ 本帧读到的强度与搬迁前**同一帧、同一个数**。
 *
 * > 这条约束与 `world/lights.js` 文件头记的是同一条（`J4.18` §6.2 预告过）。
 *
 * ## 逐字搬运说明
 *
 * 几何与五段**逐行相同**（只改缩进与状态前缀）：`ctx.lanternLit` → `s.lit`、`ctx.ptLantern` → `s.pt`、
 * `ctx.lanternPivot` → `lanternPivot`（局部解构）。全部数值（吊挂点 `2.88`、灯体 `0.16×0.2×0.16`、
 * 光锥 `0.14/0.85/2.35`、光斑半径 `1.15/0.7/0.8` 与高度 `0.012/0.014/0.795`、
 * 闪烁三项正弦 `9 / 13.7` 与各 `opacity` 系数、平滑系数 `0.07`）**一个没改**。
 * 本件**不消耗 `rng`**（原段就没有）。
 */
import * as THREE from 'three'
import { defineProp } from '../../app/defineProp.js'
import { createPointLightSource } from '../../core/lighting/PointLightSource.js'

export default defineProp({
  id: 'floor1/hanging-lantern',
  kind: 'decor',

  // `lit` 是原来的 `let lanternLit = true`；`pt` 是原来的 `ctx.ptLantern`
  // （初值 `1`，来自 `WeatherSystem.js` 末尾那行 —— 搬到这里之后那里已删除）。
  state: () => ({ lit: true, pt: 1 }),

  build({ scene, L, put, edge, box, line }) {
    const { MTX, MTZ } = L

    const lanternPivot = new THREE.Group();
    lanternPivot.position.set(MTX, 2.88, MTZ);
    scene.add(lanternPivot);
    put(line([[0, 0, 0], [0, -0.26, 0]]), 0, 0, 0, 0, 0, 0, lanternPivot);
    const lantG = new THREE.Group();
    lantG.position.y = -0.44;
    lanternPivot.add(lantG);
    put(edge(new THREE.ConeGeometry(0.09, 0.07, 4)), 0, 0.13, 0, 0, 0, 0, lantG);
    put(box(0.16, 0.2, 0.16), 0, 0, 0, 0, 0, 0, lantG);
    for (const s of [[0, 0.085], [0, -0.085], [0.085, 0], [-0.085, 0]])
        put(line([[s[0], 0.1, s[1]], [s[0], -0.1, s[1]]]), 0, 0, 0, 0, 0, 0, lantG);
    const lanternFlame = new THREE.Group();
    put(line([[0, -0.06, 0], [0.014, -0.02, 0], [0.014, 0.015, 0], [0, 0.06, 0]]), 0, 0, 0, 0, 0, 0, lanternFlame);
    lantG.add(lanternFlame);

    const haloMat = new THREE.MeshBasicMaterial({ color: 0xffd88f, transparent: true, opacity: 0.14, depthWrite: false });
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), haloMat);
    halo.userData.noHit = true;
    put(halo, 0, 0, 0, 0, 0, 0, lantG);

    const beamMat = new THREE.MeshBasicMaterial({ color: 0xffc46b, transparent: true, opacity: 0.09, depthWrite: false, side: THREE.DoubleSide });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.85, 2.35, 24, 1, true), beamMat);
    beam.userData.noHit = true;
    put(beam, 0, -1.52, 0, 0, 0, 0, lanternPivot);

    const glowMatA = new THREE.MeshBasicMaterial({ color: 0xffc46b, transparent: true, opacity: 0.09, depthWrite: false, side: THREE.DoubleSide });
    const glowMatB = new THREE.MeshBasicMaterial({ color: 0xffd88f, transparent: true, opacity: 0.075, depthWrite: false, side: THREE.DoubleSide });
    const floorPool = new THREE.Mesh(new THREE.CircleGeometry(1.15, 28), glowMatA);
    floorPool.userData.noHit = true;
    put(floorPool, MTX, 0.012, MTZ, -Math.PI / 2, 0, 0);
    const floorPool2 = new THREE.Mesh(new THREE.CircleGeometry(0.7, 24), glowMatB);
    floorPool2.userData.noHit = true;
    put(floorPool2, MTX, 0.014, MTZ, -Math.PI / 2, 0, 0);
    const tablePool = new THREE.Mesh(new THREE.CircleGeometry(0.8, 24), glowMatB);
    tablePool.userData.noHit = true;
    put(tablePool, MTX, 0.795, MTZ, -Math.PI / 2, 0, 0);

    return {
      root: lanternPivot,
      parts: {
        lanternPivot, lantG, lanternFlame, halo, beam, floorPool, floorPool2, tablePool,
        haloMat, beamMat, glowMatA, glowMatB,
      },
    }
  },

  /**
   * ★ 光源槽位 0 —— 取代 `world/lights.js` 里原来那一行 `lightField.register(…)`。
   *
   * `slot` **显式声明**：物件的装配时机（段 08）远晚于 `world/lights.js` 的一次性注册（段 03 之后），
   * 靠"按顺序追加"必然换槽；写死 `slot: 0` 之后槽序与装配时机无关（`J4.18` 契约）。
   * `strength` 闭包读**物件自己的 state** `s.pt` —— `ptLantern` 这个中间量从此不存在。
   *
   * 位置 / 颜色 / 半径 / `yMin` / `yMax` 与搬迁前那一行**逐字相同**。
   */
  lights: (s, { L }) => [
    createPointLightSource({
      id: 'floor1/lantern', slot: 0,
      position: [L.MTX, 2.52, L.MTZ], color: 0xffb066, radius: 4.6,
      strength: () => s.pt,
      yMin: 0.0, yMax: 3.04,
    }),
  ],

  // 原 `lanternPivot` 上那条交互的等价声明（点一下把 `lanternLit` 取反 → `s.lit`）。
  // ⚠️ 与 `deskChair.js` 同一条注意：**不写出那个「函数名 + 左括号」的字面量**
  //    —— `verify-migration.mjs` 的 `stripComments` 只剥块注释、不剥行注释（J4.20 §4.2）。
  // 锚点与几何**同源**：吊挂点就是 `lanternPivot.position` 的来源（不变量 `N9`）。
  // `mode: 'both'` —— 否则默认固定视角下点不开（风险 `R1`），与已搬各件一致。
  interactables: (s, { L, parts }) => [{
    id: 'hanging-lantern/toggle',
    label: '点亮 / 熄灭吊挂木灯',
    mode: 'both',
    anchor: { x: L.MTX, z: L.MTZ },
    radius: 1.6,
    hits: parts.lanternPivot,
    onActivate: () => { s.lit = !s.lit },
  }],

  /**
   * 原 `tickOnce()` 里的**五段**（`frame/18`–`frame/22`）+ `frame/92` 的强度平滑。
   * 分段与顺序**逐字保留**（合并成一个 `update` 的理由见文件头 ★）。
   */
  update(dt, time, s, { parts }) {
    const {
      lanternPivot, lanternFlame, halo, beam, floorPool, floorPool2, tablePool,
      haloMat, beamMat, glowMatA, glowMatB,
    } = parts

    /* ---- ⑱ 灯体摆动 x ---- */
    lanternPivot.rotation.x = Math.sin(time * 1.2) * 0.045;

    /* ---- ⑲ 灯体摆动 z ---- */
    lanternPivot.rotation.z = Math.sin(time * 0.9 + 1) * 0.05;

    /* ---- ⑳ 火苗可见性 ---- */
    lanternFlame.visible = s.lit;

    /* ---- ㉑ 光晕 / 光锥 / 三块光斑的可见性 ---- */
    halo.visible = beam.visible = floorPool.visible = floorPool2.visible = tablePool.visible = s.lit;

    /* ---- ㉒ 点亮时的闪烁（缩放 + 四个材质的 opacity）---- */
    if (s.lit) {
        const fk = 1 + Math.sin(time * 9) * 0.10 + Math.sin(time * 13.7) * 0.04;
        lanternFlame.scale.set(1, fk, 1);
        haloMat.opacity = 0.11 + 0.04 * fk;
        beamMat.opacity = 0.07 + 0.025 * fk;
        glowMatA.opacity = 0.07 + 0.025 * fk;
        glowMatB.opacity = 0.06 + 0.02 * fk;
    }

    /* ---- ⑨② 强度平滑（原 `tickOnce()` 末尾「室内点光源」那 5 行之一）----
     * ★ 它原本排在 `frame/92`（几何分支之后约 74 个帧任务）。合并到本 `update` 后**提前**执行，
     *   等价性论证见文件头「★ 帧顺序」：中间无读者/写者，且仍早于 `frame/97` 的 `lightField.update`。 */
    s.pt += ((s.lit ? 1 : 0) - s.pt) * 0.07;
  },
})
