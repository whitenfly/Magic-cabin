/**
 * 12.5 三脚圆凳 —— `J3` 搬迁（B2 简单开关动画）【★ 待前置条件，暂未写 spec】
 *
 * 来源：`legacy/monolith.js` 原 `12.5` 分区（当前 monolith L840–857）的**几何段**，
 * 以及 `tickOnce()` 里那段每帧分支（当前 `L7631–7637`，`for (const s of stools) {` 起）。
 *
 * ## 搬迁对照
 *
 * | 原来住哪 | 现在住哪 |
 * |---|---|
 * | 顶层 `const stools = []` | `build()` 内的同名局部数组，经 `parts.stools` 交出（**同一个数组实例**） |
 * | `function makeStool(x, z, dz)` | `build()` 内的同名局部函数（逐字搬运） |
 * | 每只凳子的 `bx/bz/dz/cur/vel/open` | **仍在 `g.userData`**（原本就住在物件自己身上，不动它） |
 * | `regMagic(g, …)` | `interactables()`：**每只凳子一条**（`mode: 'both'`，两条 label 语义化） |
 * | `tickOnce()` 里的 `for (const s of stools) { … }` | `update()`（`for (const stool of parts.stools)`，仅循环变量改名） |
 *
 * ## ★ 为什么现在还不能写 spec（两条硬前置）
 *
 * 1. **`movingPlatforms` 引用了这个数组**（当前 monolith `L6911–6912`）：
 *    `{ g: stools[0], hx: 0.23, hz: 0.23, top: 0.475 }, { g: stools[1], … }`
 *    —— 它是"史莱姆可站上去的移动平台"，在应用器替换区间**之外**，没人替它改。
 *    搬走后 `stools` 这个名字在 monolith 里消失 ⇒ 该处 `undefined.position` 会每帧抛错
 *    （不是像素差异，是直接崩）。要一起改成装配记录里的部件，例如：
 *    `const stoolsApi = installProp(stools);` + `{ g: stoolsApi.parts.stoolA, … }` / `parts.stoolB`
 *    （spec 里可写 `"assign": "stoolsApi"`，应用器支持这个字段）。
 * 2. **每帧分支要原地换掉**：`{ … }` 块 → `stoolsApi.tick(dt, time);`（同 12.10 魔法扫帚那处）。
 *
 * 两条都做完，本文件即可直接用（spec 的 startMarker `// ---- 12.5 三脚圆凳 ----`、
 * endMarker `// ---- 12.6 桌下椭圆地毯 ----`，两者在 monolith 里各只出现一次）。
 *
 * ## 关于 `root`
 *
 * 两只凳子是**各自直接挂到 `scene`** 的两个 Group（搬迁前就没有共同父节点，加一层包装
 * 会改动 `scene.children` ⇒ 像素回归）。故 `build` 返回 `root: stools[0]`（登记用，
 * 只进 `registry` 的元数据、不进渲染），两只凳子本体都在 `parts` 里。
 *
 * ⚠️ `root` 在 `J3.1` 之前还兼着"准星入口"的活（只有它进 `magicMeshes`）⇒ 只有第一只凳子点得动。
 * 现在两条 `interactables` 各自声明 `hits`（= `parts.stoolA` / `stoolB`），`root` 纯粹是登记元数据。
 *
 * 只用 `MTX` / `MTZ`（本就在 `world/layout.js`），故 spec 的 `layout` 留空 ——
 * 避免应用器写出重复常量。局部偏移 `0.85` 与三脚几何尺寸留在原地。
 */
import * as THREE from 'three'
import { defineProp } from '../../app/defineProp.js'

export default defineProp({
  id: 'floor1/stools',
  kind: 'furniture',

  build({ scene, L, put, edge, logBetween }) {
    const { MTX, MTZ } = L

    const stools = [];
    function makeStool(x, z, dz) {
        const g = new THREE.Group();
        put(edge(new THREE.CylinderGeometry(0.21, 0.18, 0.05, 12)), 0, 0.45, 0, 0, 0, 0, g);
        for (let i = 0; i < 3; i++) {
            const a = i * (Math.PI * 2 / 3) + 0.55;
            logBetween([Math.cos(a) * 0.12, 0.43, Math.sin(a) * 0.12],
                [Math.cos(a) * 0.19, 0.03, Math.sin(a) * 0.19], 0.024, g);
        }
        g.position.set(x, 0, z);
        g.userData = { bx: x, bz: z, dz, cur: 0, vel: 0, open: false };
        scene.add(g);
        stools.push(g);
    }
    makeStool(MTX, MTZ - 0.85, -1);
    makeStool(MTX, MTZ + 0.85, 1);

    return { root: stools[0], parts: { stools, stoolA: stools[0], stoolB: stools[1] } }
  },

  // 每只凳子一条（原来就是"点哪只动哪只"）：mode 必须 both，否则固定视角下点不开（风险 `R1`）
  // 锚点与几何同源 —— 都是 `makeStool(MTX, MTZ ∓ 0.85, ∓1)` 的落点（不变量 N9）
  // `hits` = **这一条自己的**命中体（`J3.1`）：两只凳子各点各的，否则只有第一只点得动。
  interactables: (s, { L, parts }) => [
    {
      id: 'stools/pull-north',
      label: '把靠里的三脚圆凳挪开 / 推回',
      mode: 'both',
      anchor: { x: L.MTX, z: L.MTZ - 0.85 },
      radius: 1.3,
      hits: parts.stoolA,
      onActivate: () => { parts.stoolA.userData.open = !parts.stoolA.userData.open; },
    },
    {
      id: 'stools/pull-south',
      label: '把靠门的三脚圆凳挪开 / 推回',
      mode: 'both',
      anchor: { x: L.MTX, z: L.MTZ + 0.85 },
      radius: 1.3,
      hits: parts.stoolB,
      onActivate: () => { parts.stoolB.userData.open = !parts.stoolB.userData.open; },
    },
  ],

  /** 原 `tickOnce()` 里的 `for (const s of stools) { … }`，逐字搬运（循环变量改名 `stool`，避开状态形参 `s`） */
  update(dt, time, s, { parts }) {
    for (const stool of parts.stools) {
        const u = stool.userData;
        const target = u.open ? 0.42 : 0;
        u.vel += (target - u.cur) * 0.02;
        u.vel *= 0.88;
        u.cur += u.vel;
        stool.position.z = u.bz + u.dz * u.cur;
    }
  },
})
