/**
 * 12.11 水晶球占卜台【门侧前右墙角】—— `J4.25` 升格 `defineProp`
 *
 * 来源：`legacy/monolith.js` 原 `/* ---- 12.11 水晶球占卜台【门侧前右墙角】 ---- *\/` 分区
 * （`J3` 记的 L1613–1666）的**几何段**，以及 `tickOnce()` 里 `frame/25` 那段每帧分支
 * （`J3` 记的 L7808–7820）。「占卜」交互来自 `regMagic(orbStandG, …)`。
 *
 * ## ★ `J4.18` 契约的第四个真实用户（光源**槽位 4**）
 *
 * `floor1-crystal-ball.SKIP.md` 记的病根与其余四件同款：`cbRun` 是这一件**唯一**的状态量，
 * 但它被**区间外**的 `ptCb += ((cbRun > 0 ? 1 : 0) - ptCb) * 0.055;` 读；
 * 而 `ptCb` 又是光照场第 5 个注册（槽位 4）的强度输入 —— 搬走与重注册两条路都破判据。
 * `slot: 4` 显式声明之后两条路都通了。
 *
 * ## 搬迁对照
 *
 * | 原来住哪 | 现在住哪 |
 * |---|---|
 * | 顶层 `let cbRun = 0` | `state: () => ({ run: 0, pt: 0 })` |
 * | `ctx.ptCb`（`WeatherSystem.js` 初值 `0`） | `state.pt`（**同一个初值**） |
 * | `ctx.ptCb += …`（`tickOnce()` 末尾那 5 行之一） | `update()` 的第二段（见下 ★） |
 * | `orbStandG` / `cbInner` / `cbMistMat` / `cbMists` / `cbStars` / `cbGlowMat` / `cbGlow` / `cbHit` | `build()` 内的同名局部量，经 `parts` 交出（**同一个实例**） |
 * | 末尾硬编码的 `lightField.register(… 'floor1/crystal-ball' …)` | `lights()`：`slot: 4` + `strength: () => s.pt` |
 * | `regMagic(orbStandG, …)` + `orbStandG.userData.sfx = 'magic'` | `interactables()`（`sfx` 仍在 `build` 里写 —— 见下 ⚠️） |
 * | `tickOnce()` 里的 `frame/25` | `update()` 的第一段 |
 *
 * ⚠️ **`orbStandG.userData.sfx = 'magic'` 必须留在 `build` 里**：`installProp` 的 aim 桥
 * 只在 `ud.sfx` **还不是字符串**时才补 `'toggle'` —— 写晚了音效就变（同 `floor1/orrery`）。
 *
 * ## ★ 帧顺序：`ptCb` 的平滑**提前**了，为什么等价
 *
 * 一件物件只有一个 `update`：几何分支在 `frame/25`，强度平滑在 `frame/95`
 * （`lightField.update` 是 `frame/97`）⇒ 本件选**几何分支的位置**（早）。论证同 `hangingLantern.js`：
 *
 * 1. **数值序列完全相同**：一阶低通，同帧同 `dt` 同输入 ⇒ 逐位相同；`grep cbRun` 的全部命中
 *    只有本物件（外加 `frame/97` 才被调用的 `lights()` 闭包）⇒ **两位置之间无读者/写者**；
 * 2. **仍然早于读者**：本 `update` 在 `frame/25` 位置，远早于 `frame/97`。
 *
 * ## 逐字搬运说明
 *
 * 几何与那段每帧分支**逐行相同**（只改缩进与状态前缀）：`ctx.cbRun` → `s.run`、
 * `ctx.ptCb` → `s.pt`、`ctx.orbStandG` / `ctx.cbXxx` → 局部解构与 `parts.cbXxx`、
 * `ctx.CBX/CBZ` → `L.CBX/L.CBZ`。全部数值（三条腿的角度与端点 `0.15/0.62/0.26/0.02` 与 `0.028`、
 * 托环 `0.17/0.02/6/20` 与 `0.40`、底座 `0.13/0.17/0.06/12` 与 `0.62`、
 * 球体 `0.24/16/12` 与线框 `0.24/12/8`、赤道环 25 点、球心高度 `0.90`、
 * 三层雾 `0.08 + i×0.045` 与 25 点、5 颗星 `0.014` 与 `±0.075` / `±0.05` / `0.1` 抖动、
 * 辉光 `0.30/12/8`、命中球 `0.27/8/6`、旋转速度 `2.0+i×0.5` / `0.35+i×0.1` / `3.0` / `0.8`、
 * 摆动 `1.4/i×1.7` 与 `0.02`、不透明度 `0.85/0.5` 与 `0.10+0.06×sin(time×6)`、
 * 平滑系数 `0.055`、持续 `5.0` 秒）**一个没改**。
 *
 * ## ⚠️ `rng` 顺序
 *
 * `cbStars` 那 5 颗星每颗消耗 **1** 次 `floor1Rng()`（`(floor1Rng() - 0.5) * 0.1` 的 z 抖动）
 * ⇒ 共 **5 次**。仍在 `build` 内、位置即原区间 ⇒ 次数与顺序都没变。
 */
import * as THREE from 'three'
import { defineProp } from '../../app/defineProp.js'
import { createPointLightSource } from '../../core/lighting/PointLightSource.js'

export default defineProp({
  id: 'floor1/crystal-ball',
  kind: 'decor',

  // `run` 是原来的 `let cbRun = 0`；`pt` 是原来的 `ctx.ptCb`（初值 `0`）。
  state: () => ({ run: 0, pt: 0 }),

  build({ scene, L, put, edge, logBetween, geo, solid, HITMAT, rng }) {
    const { CBX, CBZ } = L
    const floor1Rng = rng.floor1

    const orbStandG = new THREE.Group();
    orbStandG.position.set(CBX, 0, CBZ);
    scene.add(orbStandG);
    for (let i = 0; i < 3; i++) {
        const a = i * Math.PI * 2 / 3 + 0.5;
        logBetween([Math.cos(a) * 0.15, 0.62, Math.sin(a) * 0.15],
            [Math.cos(a) * 0.26, 0.02, Math.sin(a) * 0.26], 0.028, orbStandG);
    }
    put(edge(new THREE.TorusGeometry(0.17, 0.02, 6, 20)), 0, 0.40, 0, Math.PI / 2, 0, 0, orbStandG);
    put(edge(new THREE.CylinderGeometry(0.13, 0.17, 0.06, 12)), 0, 0.62, 0, 0, 0, 0, orbStandG);
    {
        const cbGlassMat = new THREE.MeshBasicMaterial({ color: 0xdceef5, transparent: true, opacity: 0.20, depthWrite: false });
        const cbLineMat = new THREE.LineBasicMaterial({ color: 0x8ab8c8 });
        const cbSphere = new THREE.Group();
        cbSphere.add(new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), cbGlassMat));
        cbSphere.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.SphereGeometry(0.24, 12, 8)), cbLineMat));
        const hc = [];
        for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI * 2; hc.push([Math.cos(a) * 0.24, 0, Math.sin(a) * 0.24]); }
        cbSphere.add(new THREE.LineLoop(geo(hc), cbLineMat));
        put(cbSphere, 0, 0.90, 0, 0, 0, 0, orbStandG);
    }
    const cbInner = new THREE.Group();
    cbInner.position.set(0, 0.90, 0);
    orbStandG.add(cbInner);
    const cbMistMat = new THREE.LineBasicMaterial({ color: 0x9b6fd8, transparent: true, opacity: 0.5 });
    const cbMists = [];
    for (let i = 0; i < 3; i++) {
        const pts = [];
        const r = 0.08 + i * 0.045;
        for (let k = 0; k <= 24; k++) {
            const a = k / 24 * Math.PI * 2;
            pts.push([Math.cos(a) * r, Math.sin(a * 2 + i) * 0.05, Math.sin(a) * r]);
        }
        const l = new THREE.Line(geo(pts), cbMistMat);
        cbInner.add(l);
        cbMists.push({ l, ph: i });
    }
    const cbStars = [];
    for (let i = 0; i < 5; i++) {
        const st = solid(new THREE.OctahedronGeometry(0.014),
            new THREE.MeshBasicMaterial({ color: 0xcab4f0 }));
        st.position.set((i - 2) * 0.075, (i % 2 ? 0.07 : -0.05), (floor1Rng() - 0.5) * 0.1);
        cbInner.add(st);
        cbStars.push(st);
    }
    const cbGlowMat = new THREE.MeshBasicMaterial({ color: 0xb49bf0, transparent: true, opacity: 0, depthWrite: false });
    const cbGlow = new THREE.Mesh(new THREE.SphereGeometry(0.30, 12, 8), cbGlowMat);
    cbGlow.userData.noHit = true;
    put(cbGlow, 0, 0.90, 0, 0, 0, 0, orbStandG);
    const cbHit = new THREE.Mesh(new THREE.SphereGeometry(0.27, 8, 6), HITMAT);
    put(cbHit, 0, 0.90, 0, 0, 0, 0, orbStandG);
    // ⚠️ 音效必须在 `build` 里写好：`installProp` 的 aim 桥只在 `ud.sfx` **非字符串**时才补 `'toggle'`
    orbStandG.userData.sfx = 'magic';

    return { root: orbStandG, parts: { orbStandG, cbInner, cbMistMat, cbMists, cbStars, cbGlowMat, cbGlow, cbHit } }
  },

  /**
   * ★ 光源槽位 4 —— 取代 `world/lights.js` 里原来那一行注册。
   * `slot` 显式声明 ⇒ 槽序与装配时机无关（`J4.18` 契约）。
   * 位置 / 颜色 / 半径 / `yMin` / `yMax` 与搬迁前那一行**逐字相同**。
   */
  lights: (s, { L }) => [
    createPointLightSource({
      id: 'floor1/crystal-ball', slot: 4,
      position: [L.CBX, 0.88, L.CBZ], color: 0xb5a0f2, radius: 3.6,
      strength: () => s.pt,
      yMin: 0.0, yMax: 3.04,
    }),
  ],

  // 原 `orbStandG` 上那条交互的等价声明（点一下开 5 秒占卜；与原实现同为"直接置 5.0"）。
  // 锚点与几何**同源**：`orbStandG.position` 的来源就是 `L.CBX` / `L.CBZ`（不变量 `N9`）。
  interactables: (s, { L, parts }) => [{
    id: 'crystal-ball/gaze',
    label: '向水晶球里窥探占卜',
    mode: 'both',
    anchor: { x: L.CBX, z: L.CBZ },
    radius: 1.6,
    hits: parts.orbStandG,
    onActivate: () => { s.run = 5.0 },
  }],

  /**
   * 原 `tickOnce()` 里的 `frame/25`（第一段）+ `frame/95` 的强度平滑（第二段）。
   * 分段与顺序**逐字保留**（合并理由见文件头 ★）。
   */
  update(dt, time, s, { parts }) {
    const { cbMists, cbStars, cbMistMat, cbGlowMat } = parts

    /* ---- ㉕ 三层雾的旋转、五颗星的旋转与浮动、两个材质的不透明度 ---- */
    {
        if (s.run > 0) s.run -= dt;
        const act = s.run > 0;
        for (let i = 0; i < cbMists.length; i++)
            cbMists[i].l.rotation.y += dt * (act ? 2.0 + i * 0.5 : 0.35 + i * 0.1);
        for (let i = 0; i < cbStars.length; i++) {
            cbStars[i].rotation.y += dt * (act ? 3.0 : 0.8);
            cbStars[i].position.y = (i % 2 ? 0.07 : -0.05) + Math.sin(time * 1.4 + i * 1.7) * 0.02;
        }
        cbMistMat.opacity = act ? 0.85 : 0.5;
        cbGlowMat.opacity = act ? 0.10 + 0.06 * Math.sin(time * 6) : 0;
    }

    /* ---- ⑨⑤ 强度平滑（原 `tickOnce()` 末尾「室内点光源」那 5 行之一）----
     * ★ 原本排在 `frame/95`，合并到本 `update` 后**提前**执行 —— 等价性论证见文件头「★ 帧顺序」。 */
    s.pt += ((s.run > 0 ? 1 : 0) - s.pt) * 0.055;
  },
})
