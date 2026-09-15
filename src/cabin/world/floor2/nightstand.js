/**
 * 18.2 床头柜 + 可拉开抽屉 —— `J3` 搬迁（B2 简单开关动画）【★ 待前置条件，暂未写 spec】
 *
 * 来源：`legacy/monolith.js` 原 `18.2` 分区（当前 monolith L2215–2228；原 `index.html` L3344–3359）。
 *
 * ## 它为什么比沙漏/宝箱简单：**没有** `tickOnce()` 里的每帧分支
 *
 * 抽屉的开合由 `core/util/spring.js` 的滑轨弹簧驱动 —— `updateSprings()` 在 `tickOnce()`
 * 开头就被调用（`J2.4` 已提取），物件只需要在装配时**登记一条滑轨**：
 *
 * | 原来住哪 | 现在住哪 |
 * |---|---|
 * | 四条腿 / 柜体 / 台面（直接 `put`，无 Group） | `build()`（逐字搬运，不新增层级） |
 * | `const drawerG` + 3 块几何 + `scene.add` | `build()`，经 `{ root, parts }` 交出（**它是真实场景子节点**，做 root 正合适） |
 * | `regSlide(drawerG, 'z', 0.26)` | 仍在 `build()` 内 —— **但它要拿得到弹簧系统**，见下 |
 * | `regMagic(drawerG, …)` | `interactables()`（`mode: 'both'`，`label` 语义化） |
 * | 抽屉进度 `userData.slide`（`cur/vel/open/base/axis/dist`） | **不动**（契约字段，`J2.4` 已固定） |
 *
 * ## ★ 为什么现在还不能写 spec：`ctx` 里没有 `regSlide`
 *
 * 滑轨登记必须落进 **monolith 闭包里那个 `slides` 数组**（`createSpringSystem()` 的产物，
 * 见 monolith `const { hinges, hingeMeshes, slides, registerHinge, regSlide, updateSprings } = createSpringSystem();`），
 * 而 `installProp` 的 `ctx` 目前只有几何 DSL / 材质 / 音效 —— 物件拿不到它。
 * 不登记 = 抽屉永远不会动（点了没反应，属行为回归）。
 *
 * 两条路（推荐 ①）：
 *
 * ① **`ctx` 加一行**（与本文件写法一致，零手工改动，还能顺带解开后面几批的同类物件：
 *    B4 衣柜抽屉 `regSlide`、B4 小凳 `regSlide`、B5 门窗 `registerHinge`）：
 *    ```js
 *    const { hinges, hingeMeshes, slides, registerHinge, regSlide, updateSprings } = createSpringSystem();
 *    // …在 createPropInstaller 的 ctx 里补：
 *    regSlide,
 *    ```
 * ② 保持 `ctx` 不变，改用 `assign` + 一行手工调用（与本批沙漏/宝箱的「原地 tick」同一手法）：
 *    ```js
 *    const nightstandApi = installProp(nightstand);
 *    regSlide(nightstandApi.parts.drawer, 'z', 0.26);
 *    ```
 *    若选 ②，把本文件 `build` 里的 `regSlide(drawerG, 'z', 0.26);` 一行删掉即可
 *    （其余一字不改；`parts.drawer` 就是 `drawerG`）。
 *
 * 前置条件就绪后，spec 为：startMarker `/* ---- 18.2 床头柜 + 可拉开抽屉 ---- *\/`、
 * endMarker `/* ---- 18.3 蜡烛 ---- *\/`（各只出现一次），`layout` 留空
 * （`NSX` / `NSZ` / `FY` 本就在 `world/layout.js`，写出重复常量反而是错）。
 *
 * ⚠️ 与沙漏/宝箱同理：搬进 `interactables` 后本件不再进 `magicMeshes` ⇒
 * `J3` 期间失去准星/点击入口、改为近距入口（`J4`/`J7` 把 `registry.interactables` 接进
 * `InteractionSystem` 后两条通路都回来）。
 */
import * as THREE from 'three'
import { defineProp } from '../../app/defineProp.js'

export default defineProp({
  id: 'floor2/nightstand',
  kind: 'furniture',

  // `regSlide` 来自 ctx（见文件头 ★）：登记一条「沿 z 轴、开合位移 0.26」的滑轨
  build({ scene, L, put, edge, box, regSlide }) {
    const { NSX, NSZ, FY } = L

    for (const sxsz of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        put(edge(new THREE.CylinderGeometry(0.022, 0.018, 0.16, 6)), NSX + sxsz[0] * 0.19, FY + 0.08, NSZ + sxsz[1] * 0.16, 0, 0, 0);
    }
    put(box(0.50, 0.40, 0.42), NSX, FY + 0.36, NSZ);
    put(box(0.56, 0.04, 0.48), NSX, FY + 0.58, NSZ);
    const drawerG = new THREE.Group();
    drawerG.position.set(NSX, FY + 0.40, NSZ + 0.20);
    scene.add(drawerG);
    put(box(0.42, 0.14, 0.05), 0, 0, 0, 0, 0, 0, drawerG);
    put(edge(new THREE.CylinderGeometry(0.017, 0.017, 0.028, 8)), 0, 0, 0.042, Math.PI / 2, 0, 0, drawerG);
    put(box(0.36, 0.11, 0.26), 0, 0, -0.16, 0, 0, 0, drawerG);
    // ⚠️ 必须在 `drawerG.position.set(...)` **之后**登记：`base` 取的是登记时刻的位置
    regSlide(drawerG, 'z', 0.26);

    return { root: drawerG, parts: { drawer: drawerG } }
  },

  // 主入口同时给 aim（准星）与 proximity（近距）两条 —— 否则默认固定视角下点不开（风险 `R1`，验收 `BB2b`）
  interactables: (s, { L, parts }) => [{
    id: 'nightstand/drawer',
    label: '拉开 / 推回床头柜抽屉',
    mode: 'both',
    // 锚点与几何同源：柜体中心取自 `L.NSX / L.NSZ`（抽屉是它的前侧 0.20，属柜内局部偏移）
    anchor: { x: L.NSX, z: L.NSZ },
    radius: 1.5,
    onActivate: () => { parts.drawer.userData.slide.open = !parts.drawer.userData.slide.open; },
  }],
})
