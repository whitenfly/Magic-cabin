/**
 * 灶台旁固定木台 —— `J3` 搬迁（B1 静态装饰）
 *
 * 来源：`legacy/monolith.js` 原「灶台旁：固定木台」分区（原 `index.html` L2195–2204）。
 * **几何代码原样搬运**，只做两处搬迁必需的调整：
 *   ① 坐标与朝向改从 `world/layout.js` 取（`PLATFORM_X` / `PLATFORM_Z` / `PLATFORM_ROT`，不变量 `N9`）；
 *   ② `platformG` 从 IIFE 的顶层 `const` 收进 `build()`（私有作用域，不污染全局）。
 *
 * 无状态、无交互、无光源、无 `update` —— 纯装饰。
 */
import * as THREE from 'three'
import { defineProp } from '../../app/defineProp.js'

export default defineProp({
  id: 'floor1/stove-platform',
  kind: 'decor',

  build({ scene, L, put, box, line }) {
    const { PLATFORM_X, PLATFORM_Z, PLATFORM_ROT } = L

    const platformG = new THREE.Group();
    platformG.position.set(PLATFORM_X, 0, PLATFORM_Z);
    platformG.rotation.y = PLATFORM_ROT;
    scene.add(platformG);
    put(box(0.72, 0.30, 0.62), 0, 0.15, 0, 0, 0, 0, platformG);
    put(box(0.78, 0.045, 0.68), 0, 0.322, 0, 0, 0, 0, platformG);
    for (const px of [-0.19, 0, 0.19])
      put(line([[px - 0.09, 0.346, -0.335], [px - 0.09, 0.346, 0.335]]), 0, 0, 0, 0, 0, 0, platformG);

    // 返回根对象 ⇒ `installProp` 据此登记（`registry.registerProp` 的 id 查重在这里生效）
    return platformG
  },
})
