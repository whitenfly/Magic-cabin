/**
 * 18.11 魔女帽（摆在置物箱盖上；点击 → 飞起悬浮撒糖果 → 落回） —— `J3` 搬迁（B4）
 *
 * 来源：`legacy/monolith.js` 原 `18.11` 分区里 `/* 魔女帽：更大帽檐 + 低弯折尖，点击飞起撒糖果 *\/`
 * 那一小节（装配时 L4731–L4957：帽体几何 + `/* —— 魔女帽交互：飞起悬浮撒糖果后落回 —— *\/`
 * 的状态与四个函数 + `regMagic(hatG, …)`），以及 `tickOnce()` 里
 * `updateHat(time, dt);`（L8380）与 `updateCandies(dt);`（L8381）两行**每帧分支**。
 *
 * ## 与搬迁前逐项对应
 *
 * | 原来住哪 | 现在住哪 |
 * |---|---|
 * | 顶层 `const hatState = { phase, t0 }` | `state()` 的 `s.phase / s.t0`（扁平化，见下） |
 * | 顶层 `let hatCandyT` | `s.candyT` |
 * | 顶层 `const candies = []` | `s.candies` |
 * | 顶层 `const CANDY_COLORS` | **模块作用域的常量**（纯配色表，供 `makeCandy` 用） |
 * | `const hatG / HAT_HOME_POS / HAT_HOVER_POS / HAT_TILT` + 帽体几何 | `build()`，位姿常量经 `parts` 交出（见「细节 3」） |
 * | `crateX / crateZ / CRATE_TOP / CR_W / CR_D / FY` | `world/layout.js` 的 `CRATE_X / CRATE_Z / CRATE_TOP / CR_W / CR_D / FY`（**由 `floor2/crate` 的 spec 声明**，本件只读） |
 * | `makeCandy / spawnCandy / updateHat / updateCandies` | 本文件**模块作用域的四个同名函数**（见「细节 2」） |
 * | `regMagic(hatG, …)` | `interactables()`（`label` 语义化 + `mode: 'both'`，消解风险 `R1`） |
 * | `tickOnce()` 的 `updateHat(time, dt);` + `updateCandies(dt);` | `update()`（**原地 tick**，见「需要人工做的两件事」） |
 *
 * ## ★ 三处**必须知情**的细节
 *
 * 1. **`hatState.t0 = clock.now` → `s.t0 = s.now`，二者恒等（不是近似）。**
 *    `clock` 只在每帧的 `clock.tick()` 里推进，而 `tickOnce()` 开头就是
 *    `const time = clock.now;`（当前 L7609）—— 于是**任何两次帧之间**（点击恰好发生在这个窗口里）
 *    读到 `clock.now`，都等于**上一帧**传给 `update` 的那个 `time`。
 *    `update` 第一行 `s.now = time;` 把它存下来，`onActivate` 里 `s.t0 = s.now;`
 *    与原实现**同一个数**。（`ctx` 里没有 `clock`，也不该为此新增一个 ctx 键。）
 *
 * 2. **四个函数搬到模块作用域，签名多了一个显式参数。** 模块作用域与 monolith 的 IIFE 闭包不通，
 *    `scene / MAT / crboxCol / rng / L / parts` 都得显式传进来 —— 于是
 *    `makeCandy(env)` / `spawnCandy(s, env)` / `updateHat(s, time, dt, env)` / `updateCandies(s, dt, env)`。
 *    **函数体逐字搬运**（只把捕获变量按下面的改名表换成 `s.xxx`），
 *    `runtimeRng()` 的调用**次数与顺序**一个没变（`const runtimeRng = rng.runtime;` 就是同一个种子随机源）
 *    ⇒ 糖果的外观/初速序列与搬迁前完全一致（不变量 `N8` 的实质要求）。
 *    状态改名表：`hatState.phase → s.phase`、`hatState.t0 → s.t0`、`hatCandyT → s.candyT`、`candies → s.candies`。
 *
 * 3. **`HAT_HOME_POS / HAT_HOVER_POS / HAT_TILT` 经 `parts` 交给 `update`。**
 *    三者是**推导出来的位姿**（`V(crateX, CRATE_TOP, crateZ)` 与 `V(crateX - 0.05, FY + 1.45, crateZ - 0.10)`），
 *    不是字面量坐标 ⇒ 按不变量 `N9` 的正确做法是**只保留一处推导**（`build` 里那一行原文），
 *    由 `parts.home / parts.hover / parts.tilt` 交给 `updateHat`（在那边再按原名解构回
 *    `HAT_HOME_POS / HAT_HOVER_POS / HAT_TILT`，于是 `updateHat` 的函数体逐字不变）。
 *    若改到 `layout.js` 里写死，就会让箱子坐标出现第二份真源。
 *
 * ## ★ tick 接线（`J3` 的「原地 tick」；应用器的 `spec.tick` 直接代劳，无需人工）
 *
 * ① 装配行接住句柄（spec 的 `assign`）：`const witchHatApi = installProp(witchHat);`
 * ② 把 `tickOnce()` 里的**两行**（原位置、**相邻**，当前 L8380–8381）
 *
 *    ```js
 *                    updateHat(time, dt);
 *                    updateCandies(dt);
 *    ```
 *
 *    合并成**一行** `witchHatApi.tick(dt, time);` ——
 *    这正是 spec 的 `tick: { old, new }` 所声明的那次替换（`old` 逐字给出上面两行，全文唯一）。
 *    ⚠️ 新调用是 `(dt, time)`，而原函数是 `(time, dt)`：写反会让动画速度完全不同。
 *    它前面那行 `updateWobblers(dt);`（L8379）**必须留在原地**（`wobblers` 是 18.10 的共享工具，
 *    见 [`wardrobe.js`](./wardrobe.js) 文件头「细节 1」）；它后面是 `candleP += …`，顺序一个字节都不变。
 *
 * ## 关于 `parts` 里放的不是 Object3D
 *
 * `parts` 的契约是「一件物件里有多个需要后续访问的东西」（`installProp` 文件头），
 * 本件除了帽体 Group，还要把三个位姿常量交出去 —— 与 `floor1/stools` 用 `parts.stools`
 * 交出数组同理。本件没有声明 `mount`，故 `parts` 不会进挂载点表。
 */
import * as THREE from 'three'
import { defineProp } from '../../app/defineProp.js'

/** 糖果配色（原顶层 `const CANDY_COLORS`，纯常量 ⇒ 留在模块作用域供 `makeCandy` 使用） */
const CANDY_COLORS = [0xe05555, 0xf0973c, 0xf0d355, 0x66c266, 0x5a9ad8, 0xa86ac9, 0xe07ab0, 0x8adfcb];

/** 原 `makeCandy()`，逐字搬运（只把 `scene / MAT / crboxCol / runtimeRng` 改成从参数取） */
function makeCandy(env) {
    const { scene, MAT, crboxCol, rng } = env;
    const runtimeRng = rng.runtime;
    const g = new THREE.Group();
    const col = CANDY_COLORS[Math.floor(runtimeRng() * CANDY_COLORS.length)];
    const mat = new THREE.MeshBasicMaterial({ color: col, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    const type = Math.floor(runtimeRng() * 3);
    if (type === 0) {
        // 包裹糖：圆球 + 两侧糖纸角
        const sg = new THREE.SphereGeometry(0.02, 10, 8);
        const s = new THREE.Mesh(sg, mat);
        s.add(new THREE.LineSegments(new THREE.EdgesGeometry(sg, 15), MAT));
        g.add(s);
        for (const sd of [-1, 1]) {
            const cg = new THREE.ConeGeometry(0.012, 0.022, 6);
            cg.rotateZ(sd * Math.PI / 2);
            cg.translate(sd * 0.03, 0, 0);
            const cm = new THREE.Mesh(cg, mat);
            cm.add(new THREE.LineSegments(new THREE.EdgesGeometry(cg, 20), MAT));
            g.add(cm);
        }
    } else if (type === 1) {
        // 方块糖
        g.add(crboxCol(0.036, 0.036, 0.036, 0.008, col));
    } else {
        // 圆环糖
        const tg = new THREE.TorusGeometry(0.018, 0.009, 6, 14);
        const tm = new THREE.Mesh(tg, mat);
        tm.add(new THREE.LineSegments(new THREE.EdgesGeometry(tg), MAT));
        g.add(tm);
    }
    scene.add(g);
    return g;
}

/** 原 `spawnCandy()`，逐字搬运（`candies` → `s.candies`；`hatG` 取自 `parts.body`） */
function spawnCandy(s, env) {
    const { scene, MAT, crboxCol, rng, L, V, parts } = env;
    const runtimeRng = rng.runtime;
    const hatG = parts.body;
    const { CRATE_X: crateX, CRATE_Z: crateZ, CRATE_TOP } = L;
    const obj = makeCandy(env);
    const mouth = V(Math.sin(hatG.rotation.z), -Math.cos(hatG.rotation.z), 0);
    const p = hatG.position.clone().addScaledVector(mouth, 0.03);
    p.x += (runtimeRng() - 0.5) * 0.06;
    p.y += (runtimeRng() - 0.5) * 0.04;
    p.z += (runtimeRng() - 0.5) * 0.06;
    obj.position.copy(p);
    obj.rotation.set(runtimeRng() * 6.28, runtimeRng() * 6.28, runtimeRng() * 6.28);
    s.candies.push({
        obj: obj,
        v: mouth.clone().multiplyScalar(0.35 + runtimeRng() * 0.35)
            .add(V((runtimeRng() - 0.5) * 0.3, 0.1 + runtimeRng() * 0.3, (runtimeRng() - 0.62) * 0.5)),
        av: V((runtimeRng() - 0.5) * 10, (runtimeRng() - 0.5) * 10, (runtimeRng() - 0.5) * 10),
        r: 0.024,
        onCrate: false,
        resting: false, restT: 0,
        dying: false, dieT: 0
    });
}

/** 原 `updateHat(time, dt)`，逐字搬运（`hatState` → `s`；三个位姿常量按原名从 `parts` 解构回来） */
function updateHat(s, time, dt, env) {
    const { L, parts, smooth } = env;
    const hatG = parts.body;
    const HAT_HOME_POS = parts.home, HAT_HOVER_POS = parts.hover, HAT_TILT = parts.tilt;
    if (s.phase === 'idle') return;
    const e = time - s.t0;
    if (s.phase === 'rising') {
        const D = 0.9;
        const k = smooth(Math.min(e / D, 1));
        hatG.position.lerpVectors(HAT_HOME_POS, HAT_HOVER_POS, k);
        hatG.position.y += Math.sin(k * Math.PI) * 0.18;
        hatG.rotation.z = 0.05 + (HAT_TILT - 0.05) * k;
        if (e >= D) {
            s.phase = 'floating';
            s.t0 = time;
            s.candyT = 0.3;
        }
    } else if (s.phase === 'floating') {
        const D = 3.4;
        hatG.position.copy(HAT_HOVER_POS);
        hatG.position.y += Math.sin(time * 2.6) * 0.03;
        hatG.rotation.z = HAT_TILT + Math.sin(time * 2.0) * 0.10;
        hatG.rotation.x = Math.sin(time * 1.5) * 0.07;
        s.candyT -= dt;
        if (e < 2.1 && s.candyT <= 0) {
            s.candyT = 0.13;
            spawnCandy(s, env);
        }
        if (e >= D) {
            s.phase = 'returning';
            s.t0 = time;
        }
    } else if (s.phase === 'returning') {
        const D = 0.9;
        const k = smooth(Math.min(e / D, 1));
        hatG.position.lerpVectors(HAT_HOVER_POS, HAT_HOME_POS, k);
        hatG.position.y += Math.sin(k * Math.PI) * 0.12;
        hatG.rotation.z = HAT_TILT + (0.05 - HAT_TILT) * k;
        hatG.rotation.x = Math.sin(time * 1.5) * 0.07 * (1 - k);
        if (e >= D) {
            hatG.position.copy(HAT_HOME_POS);
            hatG.rotation.set(0, 0, 0.05);
            s.phase = 'idle';
        }
    }
}

/** 原 `updateCandies(dt)`，逐字搬运（`candies` → `s.candies`） */
function updateCandies(s, dt, env) {
    const { scene, L } = env;
    const { CRATE_X: crateX, CRATE_Z: crateZ, CR_W, CR_D, CRATE_TOP, FY } = L;
    for (let i = s.candies.length - 1; i >= 0; i--) {
        const c = s.candies[i];
        if (c.dying) {
            c.dieT += dt;
            const k = Math.min(c.dieT / 0.5, 1);
            c.obj.scale.setScalar(Math.max(0.001, 1 - k));
            if (k >= 1) {
                scene.remove(c.obj);
                c.obj.traverse(o => {
                    if (o.geometry) o.geometry.dispose();
                    if (o.material) o.material.dispose();
                });
                s.candies.splice(i, 1);
            }
            continue;
        }
        if (c.resting) {
            c.restT += dt;
            if (c.restT > (c.onCrate ? 0.8 : 3.2)) {
                c.dying = true;
                c.dieT = 0;
            }
            continue;
        }
        c.v.y -= 3.0 * dt;
        c.obj.position.addScaledVector(c.v, dt);
        c.obj.rotation.x += c.av.x * dt;
        c.obj.rotation.y += c.av.y * dt;
        c.obj.rotation.z += c.av.z * dt;
        let floorY = FY;
        if (Math.abs(c.obj.position.x - crateX) < CR_W / 2 + 0.02 &&
            Math.abs(c.obj.position.z - crateZ) < CR_D / 2 + 0.02) {
            floorY = CRATE_TOP;
        }
        if (c.obj.position.y < floorY + c.r) {
            c.obj.position.y = floorY + c.r;
            c.onCrate = (floorY > FY + 0.1);
            if (Math.abs(c.v.y) > 0.55) {
                c.v.y = -c.v.y * 0.42;
                c.v.x *= 0.72;
                c.v.z *= 0.72;
                c.av.multiplyScalar(0.6);
            } else {
                c.v.y = 0;
                c.v.x *= 0.8;
                c.v.z *= 0.8;
                c.av.multiplyScalar(0.6);
                if (c.v.length() < 0.05) {
                    c.resting = true;
                    c.restT = 0;
                    c.v.set(0, 0, 0);
                }
            }
        }
    }
}

export default defineProp({
  id: 'floor2/witch-hat',
  kind: 'decor',

  /**
   * 原 `const hatState = { phase: 'idle', t0: 0 }` + `let hatCandyT = 0` + `const candies = []`，
   * 外加 `now`（= 上一帧的 `time`，供 `onActivate` 取替 `clock.now`，见文件头「细节 1」）。
   */
  state: () => ({ phase: 'idle', t0: 0, candyT: 0, candies: [], now: 0 }),

  build({ scene, L, V, put, LITMAT, MAT }) {
    // `crateX / crateZ / CRATE_TOP` 由 floor2/crate 的 spec 写进 layout（本件只读，保持单一真源）
    const { CRATE_X: crateX, CRATE_Z: crateZ, CRATE_TOP, FY } = L

    const hatG = new THREE.Group();
    const HAT_HOME_POS = V(crateX, CRATE_TOP, crateZ);
    const HAT_HOVER_POS = V(crateX - 0.05, FY + 1.45, crateZ - 0.10);
    const HAT_TILT = 1.35;
    hatG.position.copy(HAT_HOME_POS);
    hatG.rotation.z = 0.05;
    scene.add(hatG);
    {
        const hatMat = LITMAT(0x2a1a3a, { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
        const ribbonMat = LITMAT(0x5a2a4a, { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
        const buckleMat = LITMAT(0xc9a05a, { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });

        // 超大帽檐
        const brimGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.022, 22);
        const brim = new THREE.Mesh(brimGeo, hatMat);
        brim.add(new THREE.LineSegments(new THREE.EdgesGeometry(brimGeo, 20), MAT));
        brim.position.y = 0.011;
        hatG.add(brim);

        // 帽身（锥台，底接帽檐）
        const bodyGeo = new THREE.CylinderGeometry(0.052, 0.16, 0.30, 18);
        const body = new THREE.Mesh(bodyGeo, hatMat);
        body.add(new THREE.LineSegments(new THREE.EdgesGeometry(bodyGeo, 20), MAT));
        body.position.y = 0.17;
        hatG.add(body);

        // 弯折关节球（弯折点 y = 0.32）
        const jointGeo = new THREE.SphereGeometry(0.052, 10, 8);
        const joint = new THREE.Mesh(jointGeo, hatMat);
        joint.add(new THREE.LineSegments(new THREE.EdgesGeometry(jointGeo, 15), MAT));
        joint.position.y = 0.32;
        hatG.add(joint);

        // 弯折帽尖（从低处关节向侧上方伸出并微微下垂）
        const tipGeo = new THREE.ConeGeometry(0.052, 0.17, 12);
        const tip = new THREE.Mesh(tipGeo, hatMat);
        tip.add(new THREE.LineSegments(new THREE.EdgesGeometry(tipGeo, 15), MAT));
        tip.rotation.z = -1.0;
        tip.position.set(0.072, 0.366, 0);
        hatG.add(tip);

        // 缎带环
        const bandGeo = new THREE.TorusGeometry(0.136, 0.015, 6, 20);
        const band = new THREE.Mesh(bandGeo, ribbonMat);
        band.add(new THREE.LineSegments(new THREE.EdgesGeometry(bandGeo), MAT));
        band.rotation.x = Math.PI / 2;
        band.position.y = 0.075;
        hatG.add(band);

        // 金色带扣
        const buckleGeo = new THREE.BoxGeometry(0.04, 0.03, 0.012);
        const buckle = new THREE.Mesh(buckleGeo, buckleMat);
        buckle.add(new THREE.LineSegments(new THREE.EdgesGeometry(buckleGeo), MAT));
        buckle.position.set(0, 0.075, 0.157);
        hatG.add(buckle);
    }

    // 帽体 + 三个位姿常量（`updateHat` 靠它们做 lerpVectors，见文件头「细节 3」）
    return { root: hatG, parts: { body: hatG, home: HAT_HOME_POS, hover: HAT_HOVER_POS, tilt: HAT_TILT } }
  },

  /** 原 `regMagic(hatG, () => { … })` 的替身（`label` 语义化 + `mode: 'both'`，消解风险 `R1`） */
  interactables: (s, { L }) => [{
    id: 'witch-hat/fly',
    label: '让魔女帽飞起来撒糖',
    mode: 'both',
    // 锚点与几何同源：帽子就摆在置物箱盖顶（`HAT_HOME_POS = V(crateX, CRATE_TOP, crateZ)`，不变量 N9）
    anchor: { x: L.CRATE_X, z: L.CRATE_Z },
    radius: 1.8,
    onActivate: () => {
      if (s.phase !== 'idle') return;
      s.phase = 'rising';
      s.t0 = s.now;   // 原 `clock.now` —— 与上一帧的 `time` 恒等，见文件头「细节 1」
    },
  }],

  /**
   * 原 `tickOnce()` 里相邻的两行 `updateHat(time, dt);` + `updateCandies(dt);`，
   * 逐字搬运（函数体见本文件上方的模块作用域函数）。
   * ⚠️ 人工接线时是 `witchHatApi.tick(dt, time)` —— 形参顺序与原名相反，见文件头。
   */
  update(dt, time, s, env) {
    s.now = time;   // ★ 存下本帧时间：`onActivate` 用它取替 `clock.now`（两值恒等，见文件头「细节 1」）
    updateHat(s, time, dt, env);
    updateCandies(s, dt, env);
  },
})
