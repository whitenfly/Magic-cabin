/**
 * 18.11 墙钩 + 挎包（挂在前墙内侧、门旁） —— `J3` 搬迁（B4）
 *
 * 来源：`legacy/monolith.js` 原 `18.11` 分区开头的那两小节
 * （装配时 L4594–L4671：`const wallHookZ = 3.825;` 起，到挎包裸块 `}` 止）。
 *
 * ## 为什么两小节合成**一件**物件
 *
 * 挎包是**挂在墙钩上**的：`bagHookPt = V(bagHookX, hookBaseY - 0.055, wallHookZ - 0.05)`
 * 直接由墙钩的三个定位常量和 `makeWallHook(bagHookX, hookBaseY, wallHookZ)` 的落点推出
 * （包顶的挂环 `hookLocal` 与两条绷紧的背带 `tautStrapGeo` 都以它为三角顶点）。
 * 拆成两件会让"钩"与"包"的公共常量跨模块 —— 故按"整段一起搬"处理，与
 * [`floor1/doorHangBar.js`](../floor1/doorHangBar.js) 同款。
 *
 * ## 与搬迁前逐项对应
 *
 * | 原来住哪 | 现在住哪 |
 * |---|---|
 * | 顶层 `const wallHookZ / hookBaseY / bagHookX` | `world/layout.js` 的 `BAG_HOOK_Z / BAG_HOOK_Y / BAG_HOOK_X`（不变量 `N9`，数值一个没改） |
 * | `const bagG` + `makeWallHook` + 两段几何 | `build()`（`bagG` 作为 `root`，同时进 `parts.bag`） |
 *
 * `build` 里用**重命名解构**把新常量名映射回原来的标识符名
 * （`const { BAG_HOOK_X: bagHookX, … } = L`）—— 于是墙钩与挎包的每一行几何代码
 * （`makeWallHook` 的 J 形曲线、包身 / 包盖 / 搭扣 / 缝线 / 挂环 / 两条背带）
 * 与搬迁前**逐字相同**，连局部变量名都不用动。
 *
 * ## 没有 `state()` / `update()` / `interactables()`
 *
 * 本段**原本就没有** `regMagic`（全文 62 处 `regMagic` 里，L4594–4671 一处也没有）——
 * 墙钩与挎包是**纯装饰**：不可点、无动画、无状态。故按契约只声明 `build`，
 * 既不新增交互（不变量 `N5`），也不新增射线命中集合。
 * 特别说明：**不要**为了让"包"看起来能点而补一条 `interactables` ——
 * 那会新增一条近距条目（正对大门处的第三人称提示会从"大门"变成"挎包"，
 * 而 `tests/e2e/smoke.mjs` 的 S1/S2 断言要求的正是"提示条指向大门"）。
 *
 * 未用 `rng`（不消耗种子随机源 ⇒ 后续随机数序列不变，不变量 `N8`）。
 */
import * as THREE from 'three'
import { defineProp } from '../../app/defineProp.js'

export default defineProp({
  id: 'floor2/bag',
  kind: 'decor',

  build({ scene, L, put, edge, iline, cbox, crboxCol, LITMAT, MAT, V }) {
    // 重命名解构：把 layout 常量名映射回原实现的标识符名（几何代码因此逐字不变）
    const { BAG_HOOK_Z: wallHookZ, BAG_HOOK_Y: hookBaseY, BAG_HOOK_X: bagHookX } = L

    // J 形墙钩：钩身向下再向上勾起，开口朝上
    function makeWallHook(x, y, z) {
        const g = new THREE.Group();
        put(cbox(0.06, 0.09, 0.028, 0x9a7d55), 0, 0.03, 0.014, 0, 0, 0, g);
        const hookCurve = new THREE.CatmullRomCurve3([
            V(0, 0.05, 0.012),
            V(0, 0.015, -0.008),
            V(0, -0.02, -0.038),
            V(0, -0.06, -0.055),
            V(0, -0.048, -0.078),
            V(0, -0.012, -0.082)
        ]);
        const tubeGeo = new THREE.TubeGeometry(hookCurve, 32, 0.008, 6, false);
        const hookMat = LITMAT(0x5a4128, { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
        g.add(new THREE.Mesh(tubeGeo, hookMat));
        g.add(new THREE.LineSegments(new THREE.EdgesGeometry(tubeGeo, 20), MAT));
        const tip = edge(new THREE.SphereGeometry(0.011, 8, 6));
        tip.position.set(0, -0.012, -0.082);
        g.add(tip);
        g.position.set(x, y, z);
        scene.add(g);
        return g;
    }

    makeWallHook(bagHookX, hookBaseY, wallHookZ);

    /* —— 挎包：两条绷紧的背带从包顶两角拉向钩上挂环，构成三角 —— */
    const bagG = new THREE.Group();
    const bagHookPt = V(bagHookX, hookBaseY - 0.055, wallHookZ - 0.05);
    const BAG_DROP = 0.50;
    bagG.position.set(bagHookPt.x, bagHookPt.y - BAG_DROP, bagHookPt.z + 0.02);
    scene.add(bagG);
    {
        const strapMat = LITMAT(0x4a2a1a, { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });

        // 包身
        bagG.add(crboxCol(0.24, 0.24, 0.10, 0.03, 0x8a5a3a));
        // 包盖
        const flap = crboxCol(0.245, 0.018, 0.108, 0.012, 0x6a3a2a);
        flap.position.y = 0.125;
        bagG.add(flap);
        const front = crboxCol(0.245, 0.095, 0.016, 0.012, 0x6a3a2a);
        front.position.set(0, 0.072, 0.051);
        bagG.add(front);
        // 金色搭扣
        put(cbox(0.048, 0.03, 0.014, 0xc9a05a), 0, 0.052, 0.062, 0, 0, 0, bagG);
        // 缝线装饰
        bagG.add(iline([[-0.10, -0.11, 0.052], [0.10, -0.11, 0.052]]));
        bagG.add(iline([[-0.10, -0.02, 0.052], [0.10, -0.02, 0.052]]));

        // 顶部挂环
        const hookLocal = V(0, BAG_DROP, -0.02);
        const ringGeo = new THREE.TorusGeometry(0.022, 0.006, 6, 14);
        const ring = new THREE.Mesh(ringGeo, strapMat);
        ring.add(new THREE.LineSegments(new THREE.EdgesGeometry(ringGeo), MAT));
        ring.rotation.y = Math.PI / 2;
        ring.position.copy(hookLocal);
        bagG.add(ring);

        // 两条绷紧的背带
        const strapTop = V(0, hookLocal.y - 0.02, hookLocal.z);
        function tautStrapGeo(x0) {
            const from = V(x0, 0.115, 0.015);
            const mid = from.clone().lerp(strapTop, 0.5);
            mid.y -= 0.005;
            return new THREE.TubeGeometry(new THREE.CatmullRomCurve3([from, mid, strapTop]), 24, 0.008, 6, false);
        }
        const strapLGeo = tautStrapGeo(-0.095);
        bagG.add(new THREE.Mesh(strapLGeo, strapMat));
        bagG.add(new THREE.LineSegments(new THREE.EdgesGeometry(strapLGeo, 20), MAT));
        const strapRGeo = tautStrapGeo(0.095);
        bagG.add(new THREE.Mesh(strapRGeo, strapMat));
        bagG.add(new THREE.LineSegments(new THREE.EdgesGeometry(strapRGeo, 20), MAT));
    }

    return { root: bagG, parts: { bag: bagG } }
  },
})
