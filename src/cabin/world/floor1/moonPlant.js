/**
 * 月光魔法盆栽【门侧前右墙角】—— `J4.23` 升格 `defineProp`
 *
 * 来源：`legacy/monolith.js` 原 `月光魔法盆栽【门侧前右墙角】` 分区（`J3` 记的 L1256–1285）的
 * **几何段**，以及 `tickOnce()` 里 `frame/26` 那段每帧分支（`J3` 记的 L6351 之后那一带）。
 * 「点亮」交互来自 `regMagic(plantG, …)`。
 *
 * ## ★ `J4.18` 契约的第二个真实用户（光源**槽位 7**）
 *
 * `floor1-moon-plant.SKIP.md` 把病根与**两条走不通的路**写得很清楚：
 *
 * ```js
 * // 光源注册（槽 7，住在 world/lights.js）
 * lightField.register(createPointLightSource({ id: 'floor1/moon-plant', …, strength: () => ptPlant, … }));
 * // 区间外赋值（住在 tickOnce() 的「室内点光源」段）
 * ptPlant += ((plantRun > 0 ? 1 : 0) - ptPlant) * 0.055;
 * ```
 *
 * | `J3` 记的走不通的路 | `J4.23` 之后 |
 * |---|---|
 * | 把光源写进 `lights()` ⇒ 会在**盆栽所在位置**注册 ⇒ 盆栽变槽位 0、其余 7 盏相位全部移位 ⇒ **画面必变** | ✅ `slot: 7` **显式声明**槽位 —— 在哪一段注册都不影响它落在第 7 槽 |
 * | 保留 `plantRun` 在 monolith ⇒ 状态漏回（违反 `N7`），交互逻辑也得留着 ⇒ 等于没搬 | ✅ `s.run` / `s.pt` 都是物件私有 state，`strength` 闭包直接读它 |
 *
 * ## 搬迁对照
 *
 * | 原来住哪 | 现在住哪 |
 * |---|---|
 * | 顶层 `let plantRun = 0` | `state: () => ({ run: 0, pt: 0 })` |
 * | `ctx.ptPlant`（`WeatherSystem.js` 初值 `0`） | `state.pt`（**同一个初值**） |
 * | `ctx.ptPlant += …`（`tickOnce()` 末尾那 5 行之一） | `update()` 的第二段（见下 ★） |
 * | `plantG` / `plantStems` / `plantBerries` | `build()` 内的同名局部量，经 `parts` 交出（**同一个数组实例**） |
 * | `ctx.potMat`（设置后**无人读**） | `build()` 内的局部常量（本就只有本件用） |
 * | 末尾硬编码的 `lightField.register(… 'floor1/moon-plant' …)` | `lights()`：`slot: 7` + `strength: () => s.pt` |
 * | `regMagic(plantG, …)` | `interactables()`：一条（`mode: 'both'`） |
 * | `tickOnce()` 里的 `frame/26` | `update()` 的第一段 |
 *
 * ## ★ 帧顺序：`ptPlant` 的平滑**提前**了，为什么等价
 *
 * 一件物件只有一个 `update`：几何分支在 `frame/26`，而强度平滑在 `frame/96`
 * （`lightField.update` 是 `frame/97`）⇒ 两段必须合并到同一位置。本件选**几何分支的位置**（早）。
 * 论证与 `hangingLantern.js` 同款，两条都可查：
 *
 * 1. **数值序列完全相同**：一阶低通 `p += (目标 − p) × 0.055`，同一帧内 `dt` 相同、
 *    输入 `(plantRun > 0)` 相同 ⇒ 逐位相同。唯一能破坏它的是"两位置之间有人改了输入"——
 *    `grep plantRun` 的全部命中只有本物件在这里与 `frame/26`（现已并入本 `update`），
 *    外加 `lights()` 的闭包（`frame/97` 才被调用）⇒ **中间没有任何读者或写者**；
 * 2. **仍然早于读者**：本 `update` 在 `frame/26` 位置，远早于 `frame/97`。
 *
 * ## 逐字搬运说明
 *
 * 几何与那段每帧分支**逐行相同**（只改缩进与状态前缀）：`ctx.plantRun` → `s.run`、
 * `ctx.ptPlant` → `s.pt`、`ctx.plantStems` → `parts.plantStems`。
 * 全部数值（花盆三段 `0.14/0.10/0.20`、`0.155/0.155/0.03`、`0.125/0.125/0.02` 与高度
 * `0.10/0.215/0.228`、五根茎的角度与折线点、叶环 13 点 `0.045/0.035`、
 * 浆果 `0.026/8/6` 与两种颜色、`0.85` 的基础不透明度、摆动正弦 `1.2 / 0.9 / 5 / 7`
 * 与各系数、`4.0` 的持续时长、`0.055` 的平滑系数）**一个没改**。
 *
 * ⚠️ 本件**不改 `rng`**：原段没有 `floor1Rng()` 调用（浆果颜色是 `i % 2` 决定的）。
 */
import * as THREE from 'three'
import { defineProp } from '../../app/defineProp.js'
import { createPointLightSource } from '../../core/lighting/PointLightSource.js'

export default defineProp({
  id: 'floor1/moon-plant',
  kind: 'decor',

  // `run` 是原来的 `let plantRun = 0`；`pt` 是原来的 `ctx.ptPlant`（初值 `0`）。
  state: () => ({ run: 0, pt: 0 }),

  build({ scene, L, put, solid, line, geo, MAT, LITMAT }) {
    const { PLX, PLZ } = L

    const plantG = new THREE.Group();
    plantG.position.set(PLX, 0, PLZ);
    scene.add(plantG);
    const potMat = LITMAT(0xa9744f);
    put(solid(new THREE.CylinderGeometry(0.14, 0.10, 0.20, 10), potMat), 0, 0.10, 0, 0, 0, 0, plantG);
    put(solid(new THREE.CylinderGeometry(0.155, 0.155, 0.03, 10), potMat), 0, 0.215, 0, 0, 0, 0, plantG);
    put(solid(new THREE.CylinderGeometry(0.125, 0.125, 0.02, 10),
        LITMAT(0x5a4632)), 0, 0.228, 0, 0, 0, 0, plantG);
    const plantStems = [], plantBerries = [];
    for (let i = 0; i < 5; i++) {
        const a = i * Math.PI * 2 / 5 + 0.4;
        const tipX = Math.cos(a) * 0.17, tipZ = Math.sin(a) * 0.17;
        const stem = new THREE.Group();
        stem.position.set(0, 0.23, 0);
        put(line([[0, 0, 0], [tipX * 0.35, 0.13, tipZ * 0.35], [tipX * 0.8, 0.25, tipZ * 0.8], [tipX, 0.35, tipZ]]), 0, 0, 0, 0, 0, 0, stem);
        const lp = [];
        for (let k = 0; k <= 12; k++) { const t = k / 12 * Math.PI * 2; lp.push([Math.cos(t) * 0.045, Math.sin(t) * 0.035, 0]); }
        put(new THREE.LineLoop(geo(lp), MAT), tipX * 0.45, 0.16, tipZ * 0.45, 0, a, 0, stem);
        const bm = new THREE.MeshBasicMaterial({
            color: i % 2 ? 0x9b6fd8 : 0x4fb0d8, transparent: true, opacity: 0.85
        });
        const berry = solid(new THREE.SphereGeometry(0.026, 8, 6), bm);
        put(berry, tipX, 0.37, tipZ, 0, 0, 0, stem);
        plantG.add(stem);
        plantStems.push({ stem, ph: i * 1.3 });
        plantBerries.push({ obj: berry, m: bm, ph: i });
    }

    return { root: plantG, parts: { plantG, plantStems, plantBerries } }
  },

  /**
   * ★ 光源槽位 7 —— 取代 `world/lights.js` 里原来那一行注册。
   *
   * `slot` **显式声明**：本件在段 08 装配，而 `world/lights.js` 的一次性注册在段 03 之后
   * —— `J3` 记的第一条走不通的路（"提前注册 ⇒ 盆栽变槽位 0、其余 7 盏相位全移位"）
   * 正是被这个字段解决的（`J4.18` 契约）。
   * 位置 / 颜色 / 半径 / `yMin` / `yMax` 与搬迁前那一行**逐字相同**。
   */
  lights: (s, { L }) => [
    createPointLightSource({
      id: 'floor1/moon-plant', slot: 7,
      position: [L.PLX, 0.48, L.PLZ], color: 0x9bc0e8, radius: 3.8,
      strength: () => s.pt,
      yMin: 0.0, yMax: 3.04,
    }),
  ],

  // 原 `plantG` 上那条交互的等价声明（点一下把 `plantRun` 置为 4.0 秒）。
  // 锚点与几何**同源**：`plantG.position` 的来源就是 `L.PLX` / `L.PLZ`（不变量 `N9`）。
  // `mode: 'both'` —— 否则默认固定视角下点不开（风险 `R1`）。
  interactables: (s, { L, parts }) => [{
    id: 'moon-plant/glow',
    label: '让月光魔法盆栽发光 / 停下',
    mode: 'both',
    anchor: { x: L.PLX, z: L.PLZ },
    radius: 1.5,
    hits: parts.plantG,
    onActivate: () => { s.run = 4.0 },
  }],

  /**
   * 原 `tickOnce()` 里的 `frame/26`（第一段）+ `frame/96` 的强度平滑（第二段）。
   * 分段与顺序**逐字保留**（合并理由见文件头 ★）。
   */
  update(dt, time, s, { parts }) {
    const { plantStems, plantBerries } = parts

    /* ---- ㉖ 五根茎的摆动 + 五颗浆果的缩放 / 不透明度 ---- */
    {
        if (s.run > 0) s.run -= dt;
        const act = s.run > 0;
        for (const st of plantStems) {
            st.stem.rotation.z = Math.sin(time * 1.2 + st.ph) * 0.05 + (act ? Math.sin(time * 5 + st.ph) * 0.06 : 0);
            st.stem.rotation.x = Math.cos(time * 0.9 + st.ph) * 0.04;
        }
        for (const b of plantBerries) {
            b.obj.scale.setScalar(act ? 1 + 0.25 * Math.sin(time * 7 + b.ph) : 1);
            b.m.opacity = act ? 1 : 0.85;
        }
    }

    /* ---- ⑨⑥ 强度平滑（原 `tickOnce()` 末尾「室内点光源」那 5 行之一）----
     * ★ 原本排在 `frame/96`，合并到本 `update` 后**提前**执行 —— 等价性论证见文件头「★ 帧顺序」。 */
    s.pt += ((s.run > 0 ? 1 : 0) - s.pt) * 0.055;
  },
})
