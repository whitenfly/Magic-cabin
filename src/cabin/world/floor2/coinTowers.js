/**
 * 18.4 桌面玩具：金币柱 ×3（点击 → 25 枚金币"哗啦"倒塌铺开 → 再点复位） —— `J3` 搬迁（B5）
 *
 * 来源：`legacy/monolith.js` 原 `18.4` 分区里 `/* —— 通用倒塌/恢复 —— *\/` 与
 * `/* —— 金币柱 ×3 —— *\/` 两小节（1949–2026 行区间内），以及 `tickOnce()` 里那一行
 * `for (const tg of toppleGroups) updateTopple(tg);`。
 *
 * ## 搬迁对照
 *
 * | 原来住哪 | 现在住哪 |
 * |---|---|
 * | 顶层 `const toppleGroups = []` | `state.groups`（`regTopple` 在 `build` 里 push，**同一个数组**） |
 * | 行内 `const BASE = { x: 3.34, z: -2.28 }` | `world/layout.js` 的 `COIN_BASE`（不变量 `N9`） |
 * | `regTopple` 末尾的 `regMagic(group, …)` | `interactables()`（**每个 group 一条**，与原实现条数一致） |
 * | `tickOnce()` 的那一行 | `update()`（**原地 tick**） |
 *
 * `updateTopple(group)` 与 `regTopple` 是**本件私有**的两个函数（已 grep 核对：`toppleGroups` /
 * `regTopple` / `updateTopple` 只出现在本段与 `tickOnce()` 那一行）——
 * 所以随本段一起搬走，不构成"共享工具"缺口。
 *
 * ## rng
 *
 * `build` 里每枚金币两次 `floor2Rng()`（`fr` 的 y 旋转与 `delay`），共 49 枚。
 * 经 `rng.floor2` 取的是**同一个种子随机源实例**，调用次数与顺序未变（不变量 `N8`）——
 * `build` 仍在 monolith 的原位置被调用（`installProp` 替换的正是那一行）。
 */
import * as THREE from 'three'
import { defineProp } from '../../app/defineProp.js'

/** 原 `regTopple()` / `updateTopple()`，逐字搬运（`toppleGroups` → `s.groups`；末尾的 `regMagic` 移到 `interactables`） */

function regTopple(s, group, items) {
    let maxD = 0;
    for (const it of items) if ((it.delay || 0) > maxD) maxD = it.delay || 0;
    group.userData.tp = { t: 0, open: false, items: items, maxD: maxD };
    s.groups.push(group);
}

function updateTopple(group) {
    const s = group.userData.tp;
    s.t += ((s.open ? 1 : 0) - s.t) * 0.055;
    for (const it of s.items) {
        let e = s.t * (1 + s.maxD) - (it.delay || 0);
        e = Math.max(0, Math.min(1, e));
        e = e * e * (3 - 2 * e);
        it.o.position.lerpVectors(it.hp, it.fp, e);
        it.o.rotation.set(
            it.hr[0] + (it.fr[0] - it.hr[0]) * e,
            it.hr[1] + (it.fr[1] - it.hr[1]) * e,
            it.hr[2] + (it.fr[2] - it.hr[2]) * e
        );
    }
}

/* —— 金币柱 ×3 —— */

export default defineProp({
  id: 'floor2/coin-towers',
  kind: 'decor',

  /** 原顶层 `const toppleGroups = []` */
  state: () => ({ groups: [] }),

  build({ scene, L, V, LITMAT, rng, state }) {
    // 金币柱基座来自 layout（不变量 N9）—— 与几何同源，交互锚点也用它
    const { COIN_BASE: BASE, TBL_TOP } = L
    const floor2Rng = rng.floor2

    const coinG = new THREE.Group();
    scene.add(coinG);
    {
        const goldMat = LITMAT(0xd9b23a, { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
        const goldEdge = new THREE.LineBasicMaterial({ color: 0x8a6a1e });
        const coinItems = [];
        const cols = [
            { x: 3.275, z: -2.282, n: 8, dOff: 0.00 },
            { x: 3.340, z: -2.276, n: 10, dOff: 0.03 },
            { x: 3.405, z: -2.284, n: 7, dOff: 0.06 }
        ];
        const dl = Math.hypot(0.25, 1.0);
        const DIR = { x: 0.25 / dl, z: -1.0 / dl };
        const PER = { x: -DIR.z, z: DIR.x };
        const colOrder = [2, 0, 3, 1];
        const slots = [];
        for (let k = 0; k < 24; k++) {
            const r = Math.floor(k / 4);
            const cRaw = colOrder[k % 4];
            const c = (r % 2 === 1) ? (cRaw + 2) % 4 : cRaw;
            const d = 0.055 + r * 0.063;
            const s = (c - 1.5) * 0.064 + (r % 2 === 1 ? 0.032 : 0);
            slots.push({ x: BASE.x + DIR.x * d + PER.x * s, z: BASE.z + DIR.z * d + PER.z * s });
        }
        const all = [];
        for (const col of cols) {
            for (let h = 0; h < col.n; h++) all.push({ col: col, h: h });
        }
        all.sort((a, b) => (a.h - b.h) || (a.col.x - b.col.x));
        all.forEach((it, k) => {
            const c = new THREE.Group();
            const cg = new THREE.CylinderGeometry(0.030, 0.030, 0.007, 14);
            c.add(new THREE.Mesh(cg, goldMat));
            c.add(new THREE.LineSegments(new THREE.EdgesGeometry(cg, 20), goldEdge));
            const hp = V(it.col.x, TBL_TOP + 0.0035 + it.h * 0.0072, it.col.z);
            let fp;
            if (k < 24) {
                const sl = slots[k];
                fp = V(sl.x, TBL_TOP + 0.0035, sl.z);
            } else {
                const sl = slots[1];
                fp = V(sl.x, TBL_TOP + 0.0035 + 0.0072, sl.z);
            }
            c.position.copy(hp);
            coinG.add(c);
            coinItems.push({ o: c, hp: hp, fp: fp, hr: [0, 0, 0], fr: [0, floor2Rng() * 6.28, 0], delay: it.col.dOff + it.h * 0.055 + floor2Rng() * 0.02 });
        });
        regTopple(state, coinG, coinItems);
    }

    return coinG
  },

  /**
   * 原 `regTopple()` 里那行 `regMagic(group, …)` 的替身 —— **每个 group 一条**
   * （原来是"注册一个 group 就配一条交互"，这里用 `s.groups.map` 保持同样的条数）。
   */
  interactables: (s, { L }) => s.groups.map((g, i) => ({
    id: `coin-towers/topple-${i}`,
    label: '推倒桌上的金币柱',
    mode: 'both',
    // 锚点与几何同源：金币柱基座就是 `COIN_BASE`（不变量 N9）
    anchor: { x: L.COIN_BASE.x, z: L.COIN_BASE.z },
    radius: 1.5,
    onActivate: () => { g.userData.tp.open = !g.userData.tp.open; },
  })),

  /** 原 `tickOnce()` 里那行 `for (const tg of toppleGroups) updateTopple(tg);`，逐字搬运 */
  update(dt, time, s) {
    for (const tg of s.groups) updateTopple(tg);
  },
})
