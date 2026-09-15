/**
 * 18.11 垃圾桶（二楼东北角，白色开口圆桶 + 桶内揉皱纸团 / 小盒） —— `J3` 搬迁（B4）
 *
 * 来源：`legacy/monolith.js` 原 `18.11` 分区里 `/* 垃圾桶 *\/` 那一小节
 * （装配时 L4962–L5023：`const BIN_X = 1.85;` 起，到裸块 `}` 止）。
 *
 * ## 与搬迁前逐项对应
 *
 * | 原来住哪 | 现在住哪 |
 * |---|---|
 * | 顶层 `const BIN_X = 1.85 / BIN_Z = -3.40` | `world/layout.js` 的 `BIN_X / BIN_Z`（不变量 `N9`，数值一个没改） |
 * | 顶层 `const BIN_H = 0.60` | `world/layout.js` 的 `BIN_H`（**跨件共享**：抽纸盒的抛纸终点要用它，见下） |
 * | 顶层 `const BIN_R = 0.26` | 留在 `build()` 内（只有桶自己用；口径是最纯粹的物件私有尺寸） |
 * | `const binG` + 桶壁 / 桶底 / 桶沿 / 16 个纸团 / 两个小盒 | `build()`，经 `{ root, parts }` 交出 `binG` |
 *
 * `build` 里用**重命名解构**把 layout 常量名映射回原来的标识符名，于是桶的每一行几何代码
 * 与搬迁前**逐字相同**（连局部变量名都不动）。
 *
 * ## ★ 为什么 `BIN_H` 进了 `layout.js`
 *
 * 抽纸盒的抛纸动画终点是**桶口与桶底**：
 * `BIN_MOUTH = V(BIN_X, FY + BIN_H + 0.10, BIN_Z)`、`BIN_FALL = V(BIN_X, FY + 0.18, BIN_Z)`
 * —— 它们住在 [`tissueBox.js`](./tissueBox.js) 里，却必须与桶的几何同源（不变量 `N9`：
 * 否则会出现"纸团扔到空气里"）。故 `BIN_X / BIN_Z / BIN_H` 进坐标真源，`BIN_R` 留在本件。
 *
 * ⚠️ 因此本件的 spec **必须与 `floor2/tissue-box` 同批应用**（应用器只在同一次运行里
 * 写入 layout 常量；单独 `--only=floor2/tissue-box` 会让 `L.BIN_X` 是 `undefined`）。
 *
 * ## 没有 `state()` / `update()` / `interactables()`
 *
 * 本段**原本就没有** `regMagic`（全文 62 处 `regMagic` 里，L4962–5023 一处也没有）——
 * 垃圾桶是纯装饰：不可点、无动画、无状态。
 * 16 个纸团由 `crumpleBall(0.05)`（`ctx` 注入，内部 `jitterGeo` + `hash01` 是**纯函数**，
 * 不消耗种子随机源）生成，调用次数与顺序一字未改。
 */
import * as THREE from 'three'
import { defineProp } from '../../app/defineProp.js'

export default defineProp({
  id: 'floor2/bin',
  kind: 'decor',

  build({ scene, L, edge, cbox, crumpleBall, LITMAT, MAT }) {
    // 重命名解构：把 layout 常量名映射回原实现的标识符名（几何代码因此逐字不变）
    const { BIN_X, BIN_Z, BIN_H, FY } = L

    const BIN_R = 0.26;
    const binG = new THREE.Group();
    binG.position.set(BIN_X, FY, BIN_Z);
    scene.add(binG);
    {
        const wallG = new THREE.CylinderGeometry(BIN_R, BIN_R - 0.03, BIN_H, 16, 1, true);
        const wall = new THREE.Mesh(wallG, LITMAT(0xeef0ec, { side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
        wall.position.y = BIN_H / 2;
        binG.add(wall);
        const bottomGeo = new THREE.CircleGeometry(BIN_R - 0.026, 16);
        const bottom = new THREE.Mesh(bottomGeo, LITMAT(0xe3e6e3, { side: THREE.DoubleSide }));
        bottom.rotation.x = -Math.PI / 2;
        bottom.position.y = 0.008;
        binG.add(bottom);
        const bottomEdgeGeo = new THREE.EdgesGeometry(bottomGeo);
        const bottomEdge = new THREE.LineSegments(bottomEdgeGeo, MAT);
        bottomEdge.rotation.x = -Math.PI / 2;
        bottomEdge.position.y = 0.008;
        binG.add(bottomEdge);
        const rim = edge(new THREE.TorusGeometry(BIN_R + 0.003, 0.014, 6, 20));
        rim.rotation.x = Math.PI / 2;
        rim.position.y = BIN_H;
        binG.add(rim);
        for (let i = 0; i < 6; i++) {
            const a = i * Math.PI / 3;
            const pb = crumpleBall(0.05);
            pb.position.set(Math.cos(a) * 0.13, 0.065, Math.sin(a) * 0.13);
            pb.rotation.y = a;
            binG.add(pb);
        }
        for (let i = 0; i < 6; i++) {
            const a = i * Math.PI / 3 + Math.PI / 6;
            const pb = crumpleBall(0.05);
            pb.position.set(Math.cos(a) * 0.13, 0.16, Math.sin(a) * 0.13);
            pb.rotation.y = a + 0.7;
            binG.add(pb);
        }
        for (let i = 0; i < 3; i++) {
            const a = i * Math.PI * 2 / 3;
            const pb = crumpleBall(0.05);
            pb.position.set(Math.cos(a) * 0.105, 0.26, Math.sin(a) * 0.105);
            pb.rotation.y = a + 1.3;
            binG.add(pb);
        }
        {
            const pb = crumpleBall(0.05);
            pb.position.set(0, 0.26, 0);
            pb.rotation.y = 0.8;
            binG.add(pb);
        }
        const boxA = cbox(0.09, 0.05, 0.07, 0xcf8a76);
        boxA.position.set(0.11, 0.34, 0.02);
        boxA.rotation.y = 0.5;
        binG.add(boxA);
        const boxB = cbox(0.09, 0.05, 0.07, 0x8fb4c9);
        boxB.position.set(-0.10, 0.34, -0.06);
        boxB.rotation.y = -0.4;
        binG.add(boxB);
    }

    return { root: binG, parts: { body: binG } }
  },
})
