/**
 * 12.9 左墙书架 + 可抽拉的书（12 本）—— `J4.19` 升格 `defineProp`
 *
 * 来源：`legacy/monolith.js` 原 `12.9` 分区（`J3` 记的 L885–918）的**几何段**，
 * 以及 `tickOnce()` 里那段每帧分支（`J3` 记的 L6647–6654，`for (const b of shelfBooks) {` 起 8 行）。
 * 「可抽拉」的交互来自 `addBook()` 里那 12 次 `regMagic`。
 *
 * ## 搬迁对照
 *
 * | 原来住哪 | 现在住哪 |
 * |---|---|
 * | 顶层 `const shelfBooks = []` | `build()` 内的同名局部数组，经 `parts.books` 交出（**同一个数组实例**） |
 * | 顶层 `const SFX = -3.72, SFZ = -2.85` | `world/layout.js` 的 `SHELF_X` / `SHELF_Z`（不变量 `N9`；**数值一个没改**） |
 * | 顶层 `const SFW = 1.3` | `build()` 内的同名局部常量（只有本文件用，不进 layout） |
 * | `function addBook(z, yBase, h, th)` | `build()` 内的同名局部函数（逐字搬运） |
 * | 每本书的 `out/cur/vel/bx` | **仍在 `g.userData`**（原本就住在物件自己身上，不动它） |
 * | `regMagic(g, …)` × 12 | `interactables()`：**每本一条**（`mode: 'both'`，各带 `hits`） |
 * | `tickOnce()` 里的 `for (const b of shelfBooks) { … }` | `update()`，由 `tickOnce()` **原位置**调用 `bookshelfApi.tick(dt, time)` |
 *
 * ## ★ 为什么当年搬不动（`J3` 的两条前置，本任务都已解决）
 *
 * `scripts/oneoff/_j3-specs/floor1-bookshelf.SKIP.md` 记的病根是
 * **`SFX` / `SFZ` 被碰撞表读**：
 *
 * ```js
 * { x1: SFX - 0.25, z1: SFZ - 0.70, x2: SFX + 0.25, z2: SFZ + 0.70, top: 2.02 }   // platformBoxes
 * ```
 *
 * 那一行住在 `systems/player/collision.js`（`J3` 时代还在 monolith 里）⇒
 * 搬走书架 = `SFX` 从 monolith 消失 ⇒ `refreshPlatforms()` 每帧抛 `ReferenceError`
 * （不是像素差异，是**直接崩**）。
 *
 * 1. **位置归属**：`J3` 建议"最省事的是把这两个值写进 `world/layout.js`"—— 本任务正是这么做的
 *    （`SHELF_X` / `SHELF_Z`），碰撞表随之改读 layout。数值逐字未变 ⇒ 碰撞行为不变。
 * 2. **12 条交互**：`J3` 当时代价是"只有第一本有准星入口"。`J3.1` 之后
 *    `defineProp` 的 `interactables` 支持**逐条 `hits`**（先例 `floor1/stools` 的两只圆凳），
 *    于是 12 本书**各有自己的准星入口** —— 比 `J3` 当年的取舍更好。
 *
 * ## 关于 `root`
 *
 * 12 本书是**各自直接挂到 `scene`** 的（`addBook` 里那行 `scene.add(g)`，搬迁前就没有共同父节点；
 * 加一层包装会改动 `scene.children` ⇒ 像素回归），书架本体则由 `put(...)` 依次挂到 `scene`。
 * 故 `build` 返回 `root: shelfBooks[0]`（同 `floor1/stools` 的处置）：
 * `root` 纯粹是 `registry` 的登记元数据，**不参与渲染**，12 本书本体都在 `parts.books` 里。
 *
 * ## 逐字搬运说明
 *
 * 几何段与每帧分支**逐行相同**（只改缩进）：`SFX` → `L.SHELF_X`、`SFZ` → `L.SHELF_Z`，
 * 其余数值（层板高度 `1.05` / `0.18, 0.78, 1.38, 1.95`、书高表 `HS`、书厚表 `TS`、
 * 三层摆书的 `z0` / `z1`、抽拉公式 `u.vel += (target - u.cur) * 0.03 …`）**一个没改**。
 *
 * 本件**没有 `rng` 调用**（原段一个都没有）⇒ 不影响后续随机数序列。
 */
import * as THREE from 'three'
import { defineProp } from '../../app/defineProp.js'

/** 三层书架的中文名 —— 只用于 `label` 语义化（不参与渲染） */
const LAYER_NAME = ['下层', '中层', '上层']

export default defineProp({
  id: 'floor1/bookshelf',
  kind: 'furniture',

  build({ scene, L, put, box, line }) {
    const { SHELF_X: SFX, SHELF_Z: SFZ } = L
    const SFW = 1.3

    const shelfBooks = [];
    /** 与 `shelfBooks` **同序**的元数据（层号 / 层内序号）—— 只用于 `label`，不参与渲染 */
    const bookMeta = [];
    {
        put(box(0.3, 1.86, 0.05), SFX, 1.05, SFZ - SFW / 2);
        put(box(0.3, 1.86, 0.05), SFX, 1.05, SFZ + SFW / 2);
        put(box(0.02, 1.86, 1.3), SFX - 0.15, 1.05, SFZ);
        for (const sy of [0.18, 0.78, 1.38, 1.95]) put(box(0.3, 0.05, 1.3), SFX, sy, SFZ);

        function addBook(z, yBase, h, th) {
            const g = new THREE.Group();
            put(box(0.18, h, th), 0, h / 2, 0, 0, 0, 0, g);
            put(line([[0.092, h * 0.55, -th * 0.3], [0.092, h * 0.55, th * 0.3]]), 0, 0, 0, 0, 0, 0, g);
            g.position.set(SFX + 0.02, yBase, z);
            g.userData = { out: false, cur: 0, vel: 0, bx: SFX + 0.02 };
            scene.add(g);
            shelfBooks.push(g);
            // 原 `regMagic(g, () => { g.userData.out = !g.userData.out; })` 已改由
            // `interactables()` 逐本声明（`mode: 'both'` + `hits: g`，见下）。
        }
        const HS = [0.36, 0.30, 0.40, 0.33, 0.27, 0.38, 0.31, 0.35, 0.29, 0.37, 0.34, 0.28];
        const TS = [0.07, 0.06, 0.075, 0.065, 0.07, 0.062, 0.072];
        let hi = 0, ti = 0;
        let layer = 0;
        for (const s of [{ y: 0.205, z0: -3.42, z1: -2.30 },
        { y: 0.805, z0: -3.42, z1: -2.78 },
        { y: 1.405, z0: -3.42, z1: -2.30 }]) {
            let z = s.z0;
            let n = 0;
            while (z < s.z1 - 0.07) {
                const h = HS[hi++ % HS.length];
                const th = TS[ti++ % TS.length];
                addBook(z + th / 2, s.y, h, th);
                bookMeta.push({ layer, idx: n++ });
                z += th + 0.012;
            }
            layer++;
        }
    }

    return { root: shelfBooks[0], parts: { books: shelfBooks, bookMeta } }
  },

  // 每本书一条（原来就是"点哪本抽哪本"）：`mode` 必须 `both`，否则固定视角下点不开（风险 `R1`）。
  // 锚点与几何**同源**：`{ x: SHELF_X + 0.02, z: g.position.z }`，其中 x 取自 `layout.SHELF_X`
  // （= `addBook` 里 `g.position.x` 的来源）、z 直接读这本书自己的落点（不变量 `N9`）。
  // `hits` = **这一条自己的**命中体（`J3.1`）：12 本书各点各的 —— 若无 `hits`，
  // 根兜底桥只会把第一本书接上准星，其余 11 本点不动（`J3` 当年就是这个取舍）。
  interactables: (s, { L, parts }) => parts.books.map((g, i) => {
    const m = parts.bookMeta[i]
    return {
      id: `bookshelf/pull-${i + 1}`,
      label: `抽出左墙书架${LAYER_NAME[m.layer]}的第 ${m.idx + 1} 本魔法书`,
      mode: 'both',
      anchor: { x: L.SHELF_X + 0.02, z: g.position.z },
      radius: 1.3,
      hits: g,
      onActivate: () => { g.userData.out = !g.userData.out },
    }
  }),

  /** 原 `tickOnce()` 里的 `for (const b of shelfBooks) { … }`，逐字搬运（只把来源换成 `parts.books`） */
  update(dt, time, s, { parts }) {
    for (const b of parts.books) {
        const u = b.userData;
        const target = u.out ? 1 : 0;
        u.vel += (target - u.cur) * 0.03;
        u.vel *= 0.85;
        u.cur += u.vel;
        b.position.x = u.bx + 0.11 * u.cur;
    }
  },
})
