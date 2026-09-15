/**
 * 12.9c 小宝箱 —— `J3` 搬迁（B2 简单开关动画）
 *
 * 来源：`legacy/monolith.js` 原 `12.9c` 分区（原 `index.html` L2063–2079）的**几何段**，
 * 以及 `tickOnce()` 里那段**每帧分支**（搬迁时 `L8522–8533`，`const target = chestOpen ? 1 : 0;` 起）。
 *
 * ## 搬迁对照
 *
 * | 原来住哪 | 现在住哪 |
 * |---|---|
 * | 顶层 `let chestOpen / chestP / chestV` | `state: () => ({ … })`（**变量名一个没改**） |
 * | 行内 `SFX` / `0.805` / `-2.66` | `world/layout.js` 的 `CHEST_POS`（不变量 `N9`；数值一个没改） |
 * | `const chest / chestLid / chestGem` + 几何 | `build()`，经 `{ root, parts }` 交出 |
 * | `regMagic(chest, () => { chestOpen = !chestOpen; })` | `interactables()`（`label` 语义化 + `mode: 'both'`） |
 * | `tickOnce()` 里的 `{ … }` 块 | `update()`，由 `tickOnce()` **原位置**调用 `chestApi.tick(dt, time)` |
 *
 * 盒盖上的绿宝石 `chestGem` 是**线框**（`edge(new THREE.OctahedronGeometry(0.02), …)`）——
 * 它不进 `magicMeshes` 那类命中集合，故不需要 `HITMAT` 隐形命中体：搬迁前
 * 点击命中的是 `chest` 分组里 `put` 出来的那个盒子 Mesh，搬迁后交互入口改为
 * `interactables` 声明的近距 + 准星判定（`J3` 的统一契约）。
 *
 * ## 逐字搬运说明
 *
 * 分支与原实现**逐行相同**（状态变量只加 `s.` 前缀、名字保持不变），几何段只有缩进重排。
 * 未用 `rng`（不消耗种子随机源 ⇒ 后续随机数序列不变）。
 */
import * as THREE from 'three'
import { defineProp } from '../../app/defineProp.js'

export default defineProp({
  id: 'floor1/chest',
  kind: 'furniture',

  state: () => ({ chestOpen: false, chestP: 0, chestV: 0 }),

  build({ scene, L, put, box, line, edge }) {
    const { CHEST_POS } = L

    const chest = new THREE.Group();
    chest.position.set(CHEST_POS.x, CHEST_POS.y, CHEST_POS.z);
    scene.add(chest);
    put(box(0.16, 0.1, 0.12), 0, 0.05, 0, 0, 0, 0, chest);
    const chestLid = new THREE.Group();
    chestLid.position.set(0, 0.1, -0.06);
    put(box(0.16, 0.035, 0.12), 0, 0.0175, 0.06, 0, 0, 0, chestLid);
    chest.add(chestLid);
    put(line([[-0.05, 0.101, 0.06], [-0.05, 0.101, -0.06]]), 0, 0, 0, 0, 0, 0, chest);
    put(line([[0.05, 0.101, 0.06], [0.05, 0.101, -0.06]]), 0, 0, 0, 0, 0, 0, chest);
    const chestGem = edge(new THREE.OctahedronGeometry(0.02), 1, new THREE.LineBasicMaterial({ color: 0x2e8b57 }));
    put(chestGem, 0, 0.115, 0, 0, 0, 0, chest);
    chestGem.visible = false;

    return { root: chest, parts: { body: chest, lid: chestLid, gem: chestGem } }
  },

  // 主入口同时给 aim（准星）与 proximity（近距）两条 —— 否则默认固定视角下点不开（风险 `R1`，验收 `BB2b`）
  interactables: (s, { L }) => [{
    id: 'chest/open',
    label: '打开 / 合上小宝箱',
    mode: 'both',
    // 锚点与几何同源：都取自 `L.CHEST_POS`（不变量 N9）
    anchor: { x: L.CHEST_POS.x, z: L.CHEST_POS.z },
    radius: 1.6,
    onActivate: () => { s.chestOpen = !s.chestOpen; },
  }],

  /** 原 `tickOnce()` 里宝箱那段分支，逐字搬运（状态变量加 `s.` 前缀） */
  update(dt, time, s, { parts }) {
    const chestLid = parts.lid, chestGem = parts.gem

    {
        const target = s.chestOpen ? 1 : 0;
        s.chestV += (target - s.chestP) * 0.02;
        s.chestV *= 0.9;
        s.chestP += s.chestV;
        chestLid.rotation.x = -1.25 * s.chestP;
        chestGem.visible = s.chestP > 0.3;
        if (chestGem.visible) {
            chestGem.position.y = 0.11 + Math.sin(time * 2.5) * 0.008 + s.chestP * 0.015;
            chestGem.rotation.y = time * 1.2;
        }
    }
  },
})
