/**
 * 室外片的**共享纯函数** —— `J4.9`（缺口 C7）从 `yard.js` 提取

 * 两件都要用它：`yardStatic`（`addStatic` 的散布点）与 `fireflies`（萤火虫落点）。
 * `_j3-b6-report.md` §4.2 明确要求**不可复制实现**（复制会让两处漂移）。
 */
import * as THREE from 'three'

export const STUMPS = [[7.6, -5.8], [-8.2, 3.6], [-6.5, -8.5]];
export function yardSpotFree(x, z) {
    if (x > -5.05 && x < 5.05 && z > -5.05 && z < 5.05) return false;
    if (x > -1.35 && x < 1.35 && z > 4.35 && z < 5.3) return false;
    if (x > -0.7 && x < 0.7 && z > 4.9 && z < 7.9) return false;
    if (x > 2.5 && x < 3.7 && z > 5.7 && z < 6.9) return false;
    for (const st of STUMPS) if (Math.hypot(x - st[0], z - st[1]) < 0.6) return false;
    return true;
}

