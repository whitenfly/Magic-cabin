/**
 * 18.4 桌面玩具：魔方（点击 → 浮起自转打乱 / 再点还原） —— `J3` 搬迁（B5）
 *
 * 来源：`legacy/monolith.js` 原 `18.4` 分区里 `/* —— 魔方 —— *\/` 那一小节
 * （1812–1947 行区间内：27 个小方块几何 + `beginLayer` / `updateLayerAnim` /
 * `startNextTurn` / `updateRubik` 四个函数 + `regMagic`），以及 `tickOnce()` 里相邻两行
 * `updateRubik(time);` / `updateLayerAnim(dt);`。
 *
 * ## 搬迁对照
 *
 * | 原来住哪 | 现在住哪 |
 * |---|---|
 * | 行内 `V(3.15, TBL_TOP + 0.085, -2.68)` | `world/layout.js` 的 `RUBIK_HOME`（不变量 `N9`；数值一个没改） |
 * | 顶层 `const rubikState = { … }` | `state()`（字段名不变：`phase/t0/moves/mi/scrambled/history`） |
 * | 顶层 `let layerAnim = null` | `s.layerAnim` |
 * | `regMagic(rubikG, …)` | `interactables()`（`label` 语义化 + `mode: 'both'`） |
 * | `tickOnce()` 的两行 | `update()`（**原地 tick**，见下） |
 *
 * ## ★ 细节 1：`clock.now` → `s.now`（**同一个数**，不是近似）
 *
 * 原实现两处读 `clock.now`：`regMagic` 回调里 `s.t0 = clock.now`、
 * `startNextTurn()` 里 `s.t0 = clock.now`。
 * `clock` 只在每帧 `clock.tick(t)` 里推进，而 `tickOnce()` 开头是 `const time = clock.now;` ——
 * 于是**任何时刻**读到 `clock.now`，都等于**上一帧**传给 `update` 的那个 `time`。
 * `update` 第一行 `s.now = time;` 把它存下来，两处一律改读 `s.now`：与原实现**同一个数**。
 * （`ctx` 里没有 `clock`，也不该为此新增一个 `ctx` 键 —— 与 `floor2/witchHat.js` 同一处置。）
 *
 * ## ★ 细节 2：四个函数搬到模块作用域，捕获量按原名从 `parts` 解构回来
 *
 * 模块作用域与 monolith 的 IIFE 闭包不通，于是 `rubikPivot / cubies / rubikG / AXV /
 * RUBIK_HOME` 都变成显式参数。做法与 `floor1/broom.js` 的 `parts` 一致：
 * `build` 里**再解构回原名**（`const rubikPivot = parts.pivot` 等），于是四个函数的函数体
 * **逐字未改**。`AXV`（三个单位轴）由 `build` 用 ctx 的 `V` 造好后经 `parts.axv` 交出 ——
 * 它是 `V(1,0,0)` 这类"几何 DSL 产物"，只有 `build` 拿得到 `V`。
 *
 * ## ★ tick 接线（应用器的 `spec.tick` 直接代劳）
 *
 * `tickOnce()` 里相邻两行 `updateRubik(time);` + `updateLayerAnim(dt);` 合并成一行
 * `rubikApi.tick(dt, time);`。⚠️ **参数顺序与原名相反**（原名分别是 `(time)` 与 `(dt)`）。
 *
 * ## rng
 *
 * `build` **不消耗**随机源；只有"点一下"时那 18 次 `runtimeRng()`（6 步 × 3 次）——
 * 经 `rng.runtime` 取的是**同一个真随机源实例**，调用次数与顺序未变（不变量 `N8`）。
 */
import * as THREE from 'three'
import { defineProp } from '../../app/defineProp.js'

/** 原 `beginLayer()` / `updateLayerAnim(dt)` / `startNextTurn()`，逐字搬运（捕获量按原名从 `env.parts` 解构） */
    function beginLayer(s, env, axis, layer, dir, dur, onDone) {
    const { parts } = env;
    const rubikPivot = parts.pivot, cubies = parts.cubies;
        rubikPivot.rotation.set(0, 0, 0);
        rubikPivot.updateMatrixWorld(true);
        for (const c of cubies) {
            if (Math.round(c.pos[axis]) === layer) rubikPivot.attach(c.mesh);
        }
        s.layerAnim = { axis: axis, layer: layer, dir: dir, t: 0, dur: dur, onDone: onDone };
    }

    function updateLayerAnim(s, dt, env) {
    const { parts } = env;
    const rubikPivot = parts.pivot, cubies = parts.cubies, rubikG = parts.body, AXV = parts.axv;
        if (!s.layerAnim) return;
        const la = s.layerAnim;
        la.t += dt;
        const k = la.t >= la.dur ? 1 : (la.t / la.dur) * (la.t / la.dur) * (3 - 2 * la.t / la.dur);
        rubikPivot.rotation[la.axis] = la.dir * Math.PI / 2 * k;
        if (la.t >= la.dur) {
            rubikPivot.rotation[la.axis] = la.dir * Math.PI / 2;
            rubikPivot.updateMatrixWorld(true);
            for (let i = cubies.length - 1; i >= 0; i--) {
                const c = cubies[i];
                if (c.mesh.parent === rubikPivot) {
                    rubikG.attach(c.mesh);
                    c.pos.applyAxisAngle(AXV[la.axis], la.dir * Math.PI / 2);
                    c.pos.set(Math.round(c.pos.x), Math.round(c.pos.y), Math.round(c.pos.z));
                    c.mesh.position.set(
                        Math.round(c.mesh.position.x / 0.05) * 0.05,
                        Math.round(c.mesh.position.y / 0.05) * 0.05,
                        Math.round(c.mesh.position.z / 0.05) * 0.05
                    );
                }
            }
            rubikPivot.rotation.set(0, 0, 0);
            const cb = la.onDone;
            s.layerAnim = null;
            if (cb) cb();
        }
    }

    function startNextTurn(s, env) {
        const mv = s.moves[s.mi];
        beginLayer(s, env, mv.a, mv.l, mv.d, 0.30, () => {
            s.mi++;
            if (s.mi < s.moves.length) {
                startNextTurn(s, env);
            } else {
                s.phase = 'down';
                s.t0 = s.now;
            }
        });
    }

/** 原 `updateRubik(time)`，逐字搬运 */
    function updateRubik(s, time, env) {
    const { parts } = env;
    const rubikG = parts.body, RUBIK_HOME = parts.home;        if (s.phase === 'idle') return;
        const e = time - s.t0;
        if (s.phase === 'up') {
            const k = Math.min(e / 0.4, 1);
            rubikG.position.y = RUBIK_HOME.y + (k * k * (3 - 2 * k)) * 0.25;
            if (e >= 0.4) {
                s.phase = 'turn';
                startNextTurn(s, env);
            }
        } else if (s.phase === 'turn') {
            rubikG.position.y = RUBIK_HOME.y + 0.25 + Math.sin(time * 3) * 0.006;
        } else if (s.phase === 'down') {
            const k = Math.min(e / 0.4, 1);
            rubikG.position.y = RUBIK_HOME.y + (1 - k * k * (3 - 2 * k)) * 0.25;
            if (e >= 0.4) {
                rubikG.position.copy(RUBIK_HOME);
                s.scrambled = !s.scrambled;
                s.phase = 'idle';
            }
        }
    }

export default defineProp({
  id: 'floor2/rubik',
  kind: 'decor',

  /** 原 `const rubikState = { … }` + `let layerAnim = null`，外加 `now`（替 `clock.now`，见文件头细节 1） */
  state: () => ({
    phase: 'idle', t0: 0, moves: [], mi: 0, scrambled: false, history: [],
    layerAnim: null, now: 0,
  }),

  build({ scene, L, V, LITMAT }) {
    // `RUBIK_HOME` 来自 layout（不变量 N9）—— 与几何同源，交互锚点也用它
    const { RUBIK_HOME } = L

    const rubikG = new THREE.Group();
    rubikG.position.copy(RUBIK_HOME);
    scene.add(rubikG);
    const rubikPivot = new THREE.Group();
    rubikG.add(rubikPivot);
    const faceCol = { px: 0xd94a3d, nx: 0xf0a03c, py: 0xf3d04a, ny: 0x53c26a, pz: 0x4a86c8, nz: 0x9a5bb5 };
    const cmMat = {};
    for (const k in faceCol) cmMat[k] = new THREE.MeshBasicMaterial({ color: faceCol[k] });
    const cmDark = LITMAT(0x242424);
    const cubieEdgeMat = new THREE.LineBasicMaterial({ color: 0x0d0d0d });
    const cubies = [];
    for (let cx = -1; cx <= 1; cx++) {
        for (let cy = -1; cy <= 1; cy++) {
            for (let cz = -1; cz <= 1; cz++) {
                if (cx === 0 && cy === 0 && cz === 0) continue;
                const g = new THREE.BoxGeometry(0.046, 0.046, 0.046);
                const m = new THREE.Mesh(g, [
                    cx === 1 ? cmMat.px : cmDark,
                    cx === -1 ? cmMat.nx : cmDark,
                    cy === 1 ? cmMat.py : cmDark,
                    cy === -1 ? cmMat.ny : cmDark,
                    cz === 1 ? cmMat.pz : cmDark,
                    cz === -1 ? cmMat.nz : cmDark
                ]);
                m.add(new THREE.LineSegments(new THREE.EdgesGeometry(g), cubieEdgeMat));
                m.position.set(cx * 0.05, cy * 0.05, cz * 0.05);
                rubikG.add(m);
                cubies.push({ mesh: m, pos: V(cx, cy, cz) });
            }
        }
    }
    const AXV = { x: V(1, 0, 0), y: V(0, 1, 0), z: V(0, 0, 1) };

    // 根 + 后续要访问的部件（对齐 `floor1/broom.js` 的 `{ root, parts }` 契约）
    return { root: rubikG, parts: { body: rubikG, pivot: rubikPivot, cubies, home: RUBIK_HOME, axv: AXV } }
  },

  /** 原 `regMagic(rubikG, …)` 的替身（`label` 语义化 + `mode: 'both'`，消解风险 `R1`） */
  interactables: (s, { L, rng }) => {
    const runtimeRng = rng.runtime;
    return [{
      id: 'rubik/scramble',
      label: '转动桌上的魔方',
      mode: 'both',
      // 锚点与几何同源：魔方就摆在 `RUBIK_HOME`（不变量 N9）
      anchor: { x: L.RUBIK_HOME.x, z: L.RUBIK_HOME.z },
      radius: 1.4,
      onActivate: () => {
        if (s.phase !== 'idle') return;
        if (!s.scrambled) {
          const AX = ['x', 'y', 'z'], LS = [-1, 0, 1];
          s.moves = [];
          let lastAxis = '';
          for (let i = 0; i < 6; i++) {
            let ax;
            do {
              ax = AX[Math.floor(runtimeRng() * 3)];
            } while (ax === lastAxis);
            lastAxis = ax;
            s.moves.push({ a: ax, l: LS[Math.floor(runtimeRng() * 3)], d: runtimeRng() < 0.5 ? 1 : -1 });
          }
          s.history = s.moves.slice();
        } else {
          s.moves = s.history.slice().reverse().map(m => ({ a: m.a, l: m.l, d: -m.d }));
        }
        s.mi = 0;
        s.phase = 'up';
        s.t0 = s.now;
      },
    }];
  },

  /** 原 `tickOnce()` 里相邻两行 `updateRubik(time);` + `updateLayerAnim(dt);`，逐字搬运 */
  update(dt, time, s, env) {
    s.now = time;   // ★ 见文件头「细节 1」：`onActivate` 用它取替 `clock.now`
    updateRubik(s, time, env);
    updateLayerAnim(s, dt, env);
  },
})
