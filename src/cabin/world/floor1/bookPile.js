/**
 * 12.9a 左窗下魔法书堆 —— `J3` 搬迁（B3：几何 + 状态 + 交互 + 每帧分支）
 *
 * 来源：`legacy/monolith.js` 原 `12.9a` 分区（搬迁时 `L1061–1113`）的**几何段**，
 * 以及 `tickOnce()` 里 `/* ---- 书堆 ---- *\/` 那段**每帧分支**（搬迁时 `L7724–7760`）。
 *
 * ## 搬迁对照
 *
 * | 原来住哪 | 现在住哪 |
 * |---|---|
 * | 顶层 `let pileState / pileT` | `state: () => ({ … })`（**变量名一个没改**） |
 * | 顶层 `const pileBooks = []` | `build()` 内的同名局部数组，经 `parts.books` 交出（**同一个数组实例**） |
 * | 行内 `-3.62 / 0 / -1.4` | `world/layout.js` 的 `BOOK_PILE_POS`（不变量 `N9`；数值一个没改） |
 * | `regMagic(bookPileG, …)` 的回调体 | `interactables()` 的 `onActivate`（`label` 语义化 + `mode: 'both'`） |
 * | `tickOnce()` 里那个 `{ … }` 块 | `update()`，由 `tickOnce()` **原位置**调用 `bookPileApi.tick(dt, time)` |
 *
 * ## 逐字搬运说明
 *
 * 几何段与每帧分支**逐行相同**（只改缩进）：状态变量只加 `s.` 前缀（名字一个没改）、
 * 书堆数组经 `parts.books` 取回同名局部量、`regMagic` 的回调体原样搬进 `onActivate`。
 * `floor1Rng()` 每本书调 6 次（`userData` 里共 6 处）共 13 本 = 78 次 —— **次数与顺序都没变** ⇒ 后续随机数序列与画面不变。
 *
 * 本件只按需解构 ctx 的 `scene / L / put / box / line / rng`（未用 `cbox` / `crboxCol` /
 * `colEdge` / `crumpleBall` / `arcPos` / `jitterGeo` / `hash01` / `smooth` / `regSlide` /
 * `registerHinge` / `regWobble` / `makeWavyFlame` / `updateWavyFlame` —— 原段本来就没用）。
 */
import * as THREE from 'three'
import { defineProp } from '../../app/defineProp.js'

export default defineProp({
  id: 'floor1/book-pile',
  kind: 'decor',

  state: () => ({ pileState: 'stacked', pileT: 0 }),

  build({ scene, L, put, box, line, rng }) {
    const { BOOK_PILE_POS } = L
    const floor1Rng = rng.floor1

    const bookPileG = new THREE.Group();
    bookPileG.position.set(BOOK_PILE_POS.x, BOOK_PILE_POS.y, BOOK_PILE_POS.z);
    scene.add(bookPileG);
    const pileBooks = [];
    {
        const DIMS = [
            [0.24, 0.058, 0.17], [0.21, 0.052, 0.155], [0.25, 0.062, 0.16],
            [0.24, 0.024, 0.17],
            [0.235, 0.055, 0.165], [0.22, 0.050, 0.15], [0.245, 0.060, 0.17],
            [0.22, 0.024, 0.155],
            [0.23, 0.056, 0.16], [0.20, 0.046, 0.15],
            [0.24, 0.024, 0.165],
            [0.235, 0.058, 0.16], [0.22, 0.055, 0.155]
        ];
        let cy = 0;
        DIMS.forEach((dm, i) => {
            const [w, h, d] = dm;
            const b = new THREE.Group();
            const isOpen = (h < 0.03);
            if (isOpen) {
                const lp = box(w / 2 - 0.012, 0.010, d - 0.02); lp.rotation.z = 0.10;
                put(lp, -(w / 4 - 0.004), 0.006, 0, 0, 0, 0, b);
                const rp = box(w / 2 - 0.012, 0.010, d - 0.02); rp.rotation.z = -0.10;
                put(rp, (w / 4 - 0.004), 0.006, 0, 0, 0, 0, b);
                put(line([[-(w / 4) + 0.01, 0.013, -d * 0.36], [-(w / 4) + 0.03, 0.013, d * 0.34]]), 0, 0, 0, 0, 0, 0, b);
                put(line([[(w / 4) - 0.03, 0.013, -d * 0.34], [(w / 4) - 0.01, 0.013, d * 0.36]]), 0, 0, 0, 0, 0, 0, b);
            } else {
                put(box(w, h, d), 0, h / 2, 0, 0, 0, 0, b);
                put(line([[w / 2, h * 0.35, -d * 0.42], [w / 2, h * 0.35, d * 0.42]]), 0, 0, 0, 0, 0, 0, b);
                put(line([[w / 2, h * 0.65, -d * 0.42], [w / 2, h * 0.65, d * 0.42]]), 0, 0, 0, 0, 0, 0, b);
            }
            const fy = isOpen ? 0.014 : h / 2 + 0.004;
            b.userData = {
                sx: (floor1Rng() - 0.5) * 0.04, sy: cy, sz: (floor1Rng() - 0.5) * 0.04,
                sry: (floor1Rng() - 0.5) * 0.35,
                fx: 0.16 + i * 0.048 + (floor1Rng() - 0.5) * 0.04,
                fz: -(0.22 + i * 0.052 + (floor1Rng() - 0.5) * 0.06),
                fy, fry: floor1Rng() * Math.PI * 2
            };
            b.position.set(b.userData.sx, cy, b.userData.sz);
            b.rotation.y = b.userData.sry;
            cy += h + 0.003;
            bookPileG.add(b);
            pileBooks.push(b);
        });
    }

    // 书堆数组经 `parts` 交出（与 `stools` 同法）：每帧分支要逐本读 `userData`
    return { root: bookPileG, parts: { body: bookPileG, books: pileBooks } }
  },

  // 原 `regMagic(bookPileG, …)` 的回调体逐字搬来（状态量加 `s.` 前缀）。
  // 主入口同时给 aim（准星）与 proximity（近距）两条 —— 否则默认固定视角下点不开（风险 `R1`）
  interactables: (s, { L }) => [{
    id: 'book-pile/topple',
    label: '推倒 / 叠回左窗下的魔法书堆',
    mode: 'both',
    // 锚点与几何同源：都取自 `L.BOOK_PILE_POS`（不变量 N9）
    anchor: { x: L.BOOK_PILE_POS.x, z: L.BOOK_PILE_POS.z },
    radius: 1.8,
    onActivate: () => {
        if (s.pileState === 'stacked') { s.pileState = 'falling'; s.pileT = 0; }
        else if (s.pileState === 'fallen') { s.pileState = 'rising'; s.pileT = 0; }
    },
  }],

  /** 原 `tickOnce()` 里 `/* ---- 书堆 ---- *\/` 那段分支，逐字搬运（`s.` 前缀 / `parts.books` 见文件头） */
  update(dt, time, s, { parts }) {
    const pileBooks = parts.books

    /* ---- 书堆 ---- */
    {
        const n = pileBooks.length;
        if (s.pileState === 'falling') {
            s.pileT += dt;
            let done = true;
            for (let i = 0; i < n; i++) {
                const b = pileBooks[i], u = b.userData;
                const delay = (n - 1 - i) * 0.075;
                const p = Math.min(Math.max((s.pileT - delay) / 0.55, 0), 1);
                if (p < 1) done = false;
                const e = p * p;
                b.position.x = u.sx + (u.fx - u.sx) * e;
                b.position.z = u.sz + (u.fz - u.sz) * e;
                b.position.y = u.sy + (u.fy - u.sy) * e + Math.sin(p * Math.PI) * 0.05;
                b.rotation.y = u.sry + (u.fry - u.sry) * e;
                b.rotation.z = Math.sin(p * Math.PI) * 0.45;
            }
            if (done) s.pileState = 'fallen';
        } else if (s.pileState === 'rising') {
            s.pileT += dt;
            let done = true;
            for (let i = 0; i < n; i++) {
                const b = pileBooks[i], u = b.userData;
                const delay = i * 0.11;
                const p = Math.min(Math.max((s.pileT - delay) / 0.65, 0), 1);
                if (p < 1) done = false;
                const e = p * p * (3 - 2 * p);
                b.position.x = u.fx + (u.sx - u.fx) * e;
                b.position.z = u.fz + (u.sz - u.fz) * e;
                b.position.y = u.fy + (u.sy - u.fy) * e + Math.sin(p * Math.PI) * 0.24;
                b.rotation.y = u.fry + (u.sry - u.fry) * e + Math.sin(p * Math.PI * 2) * 0.4;
                b.rotation.z = Math.sin((1 - p) * Math.PI) * 0.3;
            }
            if (done) s.pileState = 'stacked';
        }
    }
  },
})
