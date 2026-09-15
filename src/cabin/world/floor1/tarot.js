/**
 * 12.12 塔罗牌牌堆 —— `J3` 搬迁（B3：几何 + 状态 + 交互 + 每帧分支）
 *
 * 来源：`legacy/monolith.js` 原 `12.12` 分区（搬迁时 `L1841–1900`）的**几何段**，
 * 以及 `tickOnce()` 里 `/* ---- 塔罗牌 ---- *\/` 那段**每帧分支**（搬迁时 `L8048–8094`）。
 *
 * ## 搬迁对照
 *
 * | 原来住哪 | 现在住哪 |
 * |---|---|
 * | 顶层 `let tarotState / tarotT` | `state: () => ({ … })`（**变量名一个没改**） |
 * | 顶层 `const tarotCards = []` | `build()` 内的同名局部数组，经 `parts.cards` 交出（**同一个数组实例**） |
 * | 顶层 `TAROT_N`（物件内部尺寸） | 留在 `build()` 内（局部量不进 `layout.js`） |
 * | 顶层 `function tarotPose(u, i, t)` | **本文件模块级同名函数**（`update` 要用它，`build` 不用） |
 * | 行内 `-0.75 / 0 / -2.8` | `world/layout.js` 的 `TAROT_POS`（不变量 `N9`；数值一个没改） |
 * | `regMagic(tarotG, …)` 的回调体 | `interactables()` 的 `onActivate`（`label` 语义化 + `mode: 'both'`） |
 * | `tickOnce()` 里 `/* ---- 塔罗牌 ---- *\/` 块 | `update()`，由 `tickOnce()` **原位置**调用 `tarotApi.tick(dt, time)` |
 *
 * ## 逐字搬运说明
 *
 * 几何段与每帧分支**逐行相同**（只改缩进）：状态变量只加 `s.` 前缀（名字一个没改）、
 * 牌数组经 `parts.cards` 取回同名局部量、`regMagic` 的回调体原样搬进 `onActivate`。
 * `tarotPose` 的**函数体一字未改**，只从 IIFE 闭包挪到模块作用域（它只读自己的三个参数，
 * 不碰任何闭包变量 ⇒ 调用结果逐位相同）；挪出来的原因是 `update` 也要用它，
 * 而 `build` 的局部作用域对 `update` 不可见。
 * `floor1Rng()` 每张牌调 2 次、共 9 张 —— **次数与顺序都没变** ⇒ 后续随机数序列不变。
 *
 * 本件只按需解构 ctx 的 `scene / L / put / box / line / edge / logBetween / rng`。
 */
import * as THREE from 'three'
import { defineProp } from '../../app/defineProp.js'

/** 原 `12.12` 分区里的同名函数，逐字搬运（只去掉 12 空格缩进） */
function tarotPose(u, i, t) {
    return {
        x: Math.cos(u.fa) * u.fr,
        y: u.fy + Math.sin(t * 1.6 + i * 0.9) * 0.03,
        z: Math.sin(u.fa) * u.fr,
        ry: u.fa + Math.PI / 2 + Math.sin(t * 0.8 + i * 0.7) * 0.25,
        rx: -0.30 + Math.sin(t * 0.6 + i) * 0.08,
        rz: Math.sin(t * 0.7 + i * 1.3) * 0.10
    };
}

export default defineProp({
  id: 'floor1/tarot',
  kind: 'furniture',

  state: () => ({ tarotState: 'stacked', tarotT: 0 }),

  build({ scene, L, put, box, line, edge, logBetween, rng }) {
    const { TAROT_POS } = L
    const floor1Rng = rng.floor1

    const tarotG = new THREE.Group();
    tarotG.position.set(TAROT_POS.x, TAROT_POS.y, TAROT_POS.z);
    scene.add(tarotG);
    {
        for (let i = 0; i < 3; i++) {
            const a = i * Math.PI * 2 / 3 + 0.9;
            logBetween([Math.cos(a) * 0.10, 0.44, Math.sin(a) * 0.10],
                [Math.cos(a) * 0.17, 0.02, Math.sin(a) * 0.17], 0.024, tarotG);
        }
        put(edge(new THREE.CylinderGeometry(0.24, 0.20, 0.035, 14)), 0, 0.46, 0, 0, 0, 0, tarotG);
    }
    const tarotCards = [];
    const TAROT_N = 9;
    for (let i = 0; i < TAROT_N; i++) {
        const c = new THREE.Group();
        put(box(0.15, 0.005, 0.23), 0, 0, 0, 0, 0, 0, c);
        put(edge(new THREE.TorusGeometry(0.034, 0.004, 4, 18)), 0, 0.004, 0, Math.PI / 2, 0, 0, c);
        put(edge(new THREE.OctahedronGeometry(0.011)), 0, 0.0055, 0, 0, 0, 0, c);
        for (const s of [-1, 1])
            put(line([[s * 0.052, 0.004, -0.075], [s * 0.052, 0.004, 0.075]]), 0, 0, 0, 0, 0, 0, c);
        put(line([[-0.055, 0.004, -0.095], [0.055, 0.004, -0.095]]), 0, 0, 0, 0, 0, 0, c);
        put(line([[-0.055, 0.004, 0.095], [0.055, 0.004, 0.095]]), 0, 0, 0, 0, 0, 0, c);
        const sy = 0.482 + i * 0.0065;
        const sry = (i % 2 ? 1 : -1) * (0.08 + i * 0.045);
        c.userData = {
            sx: (floor1Rng() - 0.5) * 0.01, sy, sz: (floor1Rng() - 0.5) * 0.01, sry,
            fa: i * (Math.PI * 2 * 1.05 / TAROT_N),
            fr: 0.15 + i * 0.022,
            fy: 1.05 + i * 0.14,
            px: 0, py: 0, pz: 0, prx: 0, pry: 0, prz: 0
        };
        c.position.set(c.userData.sx, sy, c.userData.sz);
        c.rotation.y = sry;
        tarotG.add(c);
        tarotCards.push(c);
    }

    // 牌数组经 `parts` 交出（与 `stools` 同法）：每帧分支要逐张读 `userData`
    return { root: tarotG, parts: { body: tarotG, cards: tarotCards } }
  },

  // 原 `regMagic(tarotG, …)` 的回调体逐字搬来（状态量加 `s.` 前缀，牌数组取自 `parts.cards`）。
  // 主入口同时给 aim（准星）与 proximity（近距）两条 —— 否则默认固定视角下点不开（风险 `R1`）
  interactables: (s, { L, parts }) => [{
    id: 'tarot/flip',
    label: '掀开 / 收起塔罗牌阵',
    mode: 'both',
    // 锚点与几何同源：都取自 `L.TAROT_POS`（不变量 N9）
    anchor: { x: L.TAROT_POS.x, z: L.TAROT_POS.z },
    radius: 1.8,
    onActivate: () => {
        if (s.tarotState === 'stacked') { s.tarotState = 'flying'; s.tarotT = 0; }
        else if (s.tarotState === 'floating') {
            for (const c of parts.cards) {
                const u = c.userData;
                u.px = c.position.x; u.py = c.position.y; u.pz = c.position.z;
                u.prx = c.rotation.x; u.pry = c.rotation.y; u.prz = c.rotation.z;
            }
            s.tarotState = 'returning'; s.tarotT = 0;
        }
    },
  }],

  /** 原 `tickOnce()` 里 `/* ---- 塔罗牌 ---- *\/` 那段分支，逐字搬运（`s.` 前缀 / `parts.cards` 见文件头） */
  update(dt, time, s, { parts }) {
    const tarotCards = parts.cards

    /* ---- 塔罗牌 ---- */
    {
        const n = tarotCards.length;
        if (s.tarotState === 'flying') {
            s.tarotT += dt;
            let done = true;
            for (let i = 0; i < n; i++) {
                const c = tarotCards[i], u = c.userData;
                const delay = i * 0.08;
                const p = Math.min(Math.max((s.tarotT - delay) / 0.75, 0), 1);
                if (p < 1) done = false;
                const e = p * p * (3 - 2 * p);
                const fp = tarotPose(u, i, time);
                c.position.x = u.sx + (fp.x - u.sx) * e;
                c.position.y = u.sy + (fp.y - u.sy) * e + Math.sin(p * Math.PI) * 0.18;
                c.position.z = u.sz + (fp.z - u.sz) * e;
                c.rotation.y = u.sry + (fp.ry - u.sry) * e;
                c.rotation.x = fp.rx * e;
                c.rotation.z = fp.rz * e;
            }
            if (done) s.tarotState = 'floating';
        } else if (s.tarotState === 'floating') {
            for (let i = 0; i < n; i++) {
                const c = tarotCards[i], u = c.userData;
                const fp = tarotPose(u, i, time);
                c.position.set(fp.x, fp.y, fp.z);
                c.rotation.set(fp.rx, fp.ry, fp.rz);
            }
        } else if (s.tarotState === 'returning') {
            s.tarotT += dt;
            let done = true;
            for (let i = 0; i < n; i++) {
                const c = tarotCards[i], u = c.userData;
                const delay = (n - 1 - i) * 0.07;
                const p = Math.min(Math.max((s.tarotT - delay) / 0.65, 0), 1);
                if (p < 1) done = false;
                const e = p * p * (3 - 2 * p);
                c.position.x = u.px + (u.sx - u.px) * e;
                c.position.y = u.py + (u.sy - u.py) * e + Math.sin(p * Math.PI) * 0.15;
                c.position.z = u.pz + (u.sz - u.pz) * e;
                c.rotation.y = u.pry + (u.sry - u.pry) * e;
                c.rotation.x = u.prx * (1 - e);
                c.rotation.z = u.prz * (1 - e);
            }
            if (done) s.tarotState = 'stacked';
        }
    }
  },
})
