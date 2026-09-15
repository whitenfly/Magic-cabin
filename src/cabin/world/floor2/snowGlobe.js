/**
 * 18.4 桌面玩具：玻璃雪景球（点击 → 雪花被吹起，在球内翻滚、落回、复位） —— `J3` 搬迁（B5）
 *
 * 来源：`legacy/monolith.js` 原 `18.4` 分区里 `/* —— 玻璃雪景球 —— *\/` 那一小节
 * （2198–2315 行区间内：木座 + 玻璃罩 + 小树/小屋 + 24 片雪花 + `regMagic` + `updateSnow`），
 * 以及 `tickOnce()` 里那一行 `updateSnow(time, dt);`。
 *
 * ## 搬迁对照
 *
 * | 原来住哪 | 现在住哪 |
 * |---|---|
 * | 行内 `3.50` / `-2.80` | `world/layout.js` 的 `SNOW_X` / `SNOW_Z`（不变量 `N9`） |
 * | `SNOW_C / SNOW_R / SNOW_FLOOR`（**局部空间的球心/半径/落点高度**，不是摆放坐标） | 留在 `build()`（与 `floor2/mirror.js` 的 `OUT_W / IN_H` 同类），经 `parts` 交给 `update` |
 * | `snowParts` | `parts.flakes`（**同一个数组实例**） |
 * | `regMagic(snowG, …)` | `interactables()`（`label` 语义化 + `mode: 'both'`） |
 * | `tickOnce()` 的 `updateSnow(time, dt);` | `update()`（**原地 tick**，参数顺序 `(dt, time)`） |
 *
 * 本件**没有 `state`** —— 原来也没有任何跨帧状态（雪花的运动全在 `snowParts` 的每个元素上，
 * 而它属于几何）。于是 `update` 里连 `s` 都不用。
 *
 * ## rng
 *
 * `build` 里每片雪花 5 次 `floor2Rng()`（`a / ph / r / ph / sf`），共 24 片；
 * "点一下"与每帧的落底重抛用 `runtimeRng`。两者经 `rng.floor2` / `rng.runtime` 取的是
 * **同一个种子随机源实例**，调用次数与顺序未变（不变量 `N8`）。
 *
 * ## 命名知会
 *
 * `interactables` 里的循环变量仍叫 `s`（原实现就是 `for (const s of snowParts)`），
 * 它**遮蔽**外层的 state 形参 —— 该块内不使用 state，故无歧义，函数体得以逐字未改。
 */
import * as THREE from 'three'
import { defineProp } from '../../app/defineProp.js'

/** 原 `updateSnow(time, dt)`，逐字搬运（捕获量按原名从 `parts` / `rng` 解构回来） */
    function updateSnow(time, dt, env) {
    const { parts, rng } = env;
    const snowParts = parts.flakes, SNOW_C = parts.center, SNOW_R = parts.radius, SNOW_FLOOR = parts.floor;
    const runtimeRng = rng.runtime;
        for (const s of snowParts) {
            s.v.y -= 0.05 * dt;
            s.v.multiplyScalar(Math.max(0, 1 - 1.4 * dt));
            s.p.addScaledVector(s.v, dt);
            s.p.x += Math.sin(time * s.sf + s.ph) * 0.00018;
            const dx = s.p.x - SNOW_C.x, dy = s.p.y - SNOW_C.y, dz = s.p.z - SNOW_C.z;
            const L = Math.sqrt(dx * dx + dy * dy + dz * dz);
            const R = SNOW_R - 0.004;
            if (L > R) {
                const k = R / L;
                s.p.set(SNOW_C.x + dx * k, SNOW_C.y + dy * k, SNOW_C.z + dz * k);
                s.v.multiplyScalar(0.35);
            }
            if (s.p.y < SNOW_FLOOR) {
                s.p.y = SNOW_FLOOR;
                s.v.y = Math.max(0, s.v.y);
                s.v.x *= 0.5;
                s.v.z *= 0.5;
                if (s.v.length() < 0.006 && runtimeRng() < 0.004) {
                    s.p.set(
                        SNOW_C.x + (runtimeRng() - 0.5) * 0.05,
                        SNOW_C.y + 0.028 + runtimeRng() * 0.032,
                        SNOW_C.z + (runtimeRng() - 0.5) * 0.05
                    );
                    s.v.set(0, -0.008, 0);
                }
            }
            s.mesh.position.copy(s.p);
            s.mesh.rotation.y += 1.8 * dt;
        }
    }

export default defineProp({
  id: 'floor2/snow-globe',
  kind: 'decor',

  build({ scene, L, V, LITMAT, rng }) {
    const { SNOW_X, SNOW_Z, TBL_TOP } = L
    const floor2Rng = rng.floor2

    const snowG = new THREE.Group();
    snowG.position.set(SNOW_X, TBL_TOP, SNOW_Z);
    scene.add(snowG);
    const SNOW_C = V(0, 0.100, 0);
    const SNOW_R = 0.070;
    const SNOW_FLOOR = 0.040;
    const snowParts = [];
    {
        const woodM = LITMAT(0x8a6238, { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
        const baseG = new THREE.CylinderGeometry(0.052, 0.060, 0.026, 14);
        const base = new THREE.Mesh(baseG, woodM);
        base.position.y = 0.013;
        snowG.add(base);
        snowG.add(new THREE.LineSegments(new THREE.EdgesGeometry(baseG), MAT).translateY(0.013));
        const trim = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.006, 6, 18), LITMAT(0xcaa273));
        trim.rotation.x = Math.PI / 2;
        trim.position.y = 0.027;
        snowG.add(trim);
        const glass = new THREE.Mesh(new THREE.SphereGeometry(SNOW_R, 16, 12), new THREE.MeshBasicMaterial({ color: 0xdff2f8, transparent: true, opacity: 0.20, depthWrite: false, side: THREE.DoubleSide }));
        glass.position.copy(SNOW_C);
        glass.renderOrder = 6;
        snowG.add(glass);
        const whiteM = LITMAT(0xf4f8fc);
        const ground = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8), whiteM);
        ground.scale.set(1.15, 0.35, 1.15);
        ground.position.y = 0.034;
        snowG.add(ground);
        const TX = 0.018, TZ = 0.006;
        const trunkM = LITMAT(0x6a4a2a);
        const g1 = new THREE.CylinderGeometry(0.004, 0.005, 0.014, 6);
        const trunk = new THREE.Mesh(g1, trunkM);
        trunk.position.set(TX, 0.044, TZ);
        snowG.add(trunk);
        const grn1 = LITMAT(0x2e7a44);
        const grn2 = LITMAT(0x3a8a52);
        const t1 = new THREE.ConeGeometry(0.017, 0.020, 8);
        const m1 = new THREE.Mesh(t1, grn1);
        m1.position.set(TX, 0.054, TZ);
        snowG.add(m1);
        snowG.add(new THREE.LineSegments(new THREE.EdgesGeometry(t1), MAT).translateX(TX).translateY(0.054).translateZ(TZ));
        const t2 = new THREE.ConeGeometry(0.0135, 0.018, 8);
        const m2 = new THREE.Mesh(t2, grn2);
        m2.position.set(TX, 0.064, TZ);
        snowG.add(m2);
        snowG.add(new THREE.LineSegments(new THREE.EdgesGeometry(t2), MAT).translateX(TX).translateY(0.064).translateZ(TZ));
        const t3 = new THREE.ConeGeometry(0.010, 0.016, 8);
        const m3 = new THREE.Mesh(t3, grn1);
        m3.position.set(TX, 0.073, TZ);
        snowG.add(m3);
        snowG.add(new THREE.LineSegments(new THREE.EdgesGeometry(t3), MAT).translateX(TX).translateY(0.073).translateZ(TZ));
        const houseM = LITMAT(0xc9803c);
        const hG = new THREE.BoxGeometry(0.022, 0.016, 0.018);
        const house = new THREE.Mesh(hG, houseM);
        house.position.set(-0.014, 0.048, -0.006);
        snowG.add(house);
        snowG.add(new THREE.LineSegments(new THREE.EdgesGeometry(hG), MAT).translateX(-0.014).translateY(0.048).translateZ(-0.006));
        const roofG = new THREE.ConeGeometry(0.017, 0.012, 4);
        const roof = new THREE.Mesh(roofG, LITMAT(0xa04638));
        roof.position.set(-0.014, 0.062, -0.006);
        roof.rotation.y = Math.PI / 4;
        snowG.add(roof);
        const flakeM = LITMAT(0xffffff);
        for (let i = 0; i < 24; i++) {
            const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.0032), flakeM);
            const a = floor2Rng() * 6.28, ph = Math.acos(2 * floor2Rng() - 1);
            const r = 0.015 + floor2Rng() * 0.042;
            const p = V(
                SNOW_C.x + Math.sin(ph) * Math.cos(a) * r,
                Math.max(SNOW_FLOOR + 0.004, SNOW_C.y + Math.cos(ph) * r),
                SNOW_C.z + Math.sin(ph) * Math.sin(a) * r
            );
            m.position.copy(p);
            snowG.add(m);
            snowParts.push({ mesh: m, p: p, v: V(0, -0.008, 0), ph: floor2Rng() * 6.28, sf: 0.6 + floor2Rng() });
        }
    }

    return {
      root: snowG,
      parts: { body: snowG, flakes: snowParts, center: SNOW_C, radius: SNOW_R, floor: SNOW_FLOOR },
    }
  },

  /** 原 `regMagic(snowG, …)` 的替身（`label` 语义化 + `mode: 'both'`，消解风险 `R1`） */
  interactables: (state, { L, parts, rng }) => {
    const runtimeRng = rng.runtime;
    return [{
      id: 'snow-globe/shake',
      label: '摇晃玻璃雪景球',
      mode: 'both',
      // 锚点与几何同源：雪景球就在 `SNOW_X / SNOW_Z`（不变量 N9）
      anchor: { x: L.SNOW_X, z: L.SNOW_Z },
      radius: 1.4,
      onActivate: () => {
        for (const s of parts.flakes) {
          const a = runtimeRng() * 6.28, ph = Math.acos(2 * runtimeRng() - 1);
          s.v.x += Math.sin(ph) * Math.cos(a) * (0.15 + runtimeRng() * 0.20);
          s.v.z += Math.sin(ph) * Math.sin(a) * (0.15 + runtimeRng() * 0.20);
          s.v.y += 0.10 + runtimeRng() * 0.14;
        }
      },
    }];
  },

  /** 原 `tickOnce()` 里那行 `updateSnow(time, dt);`，逐字搬运 */
  update(dt, time, s, env) {
    updateSnow(time, dt, env);
  },
})
