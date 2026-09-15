/**
 * 18.4 桌面玩具：沙漏（点击 → 翻个身，沙子从上球流到下球，流完停住） —— `J3` 搬迁（B5）
 *
 * 来源：`legacy/monolith.js` 原 `18.4` 分区里 `/* —— 沙漏 —— *\/` 那一小节
 * （2317–2403 行区间内：木框 + 玻璃双锥 + 上下沙堆 + 沙流 + `regMagic` + `updateHourglass`），
 * 以及 `tickOnce()` 里那一行 `updateHourglass(time);`。
 *
 * ## 与 `floor1/hourglass.js` 不是同一件
 *
 * `floor1/hourglass` 是**楼梯下储物架台面上**那只（原 `12.9b`，位置来自 `L.HG_POS`）；
 * 本件是**二楼书桌桌面**上这只（原 `18.4`，位置 `(2.15, TBL_TOP + 0.106, -2.50)`）。
 * 两者的几何、状态机与交互完全独立，只是外形相同 —— 所以 `id` 用 `floor2/desk-hourglass`
 * 以免与前者撞名（`registry` 的 id 查重会立刻炸）。
 *
 * ## 搬迁对照
 *
 * | 原来住哪 | 现在住哪 |
 * |---|---|
 * | 行内 `2.15` / `-2.50` | `world/layout.js` 的 `DESK_HG_X` / `DESK_HG_Z`（不变量 `N9`） |
 * | 顶层 `const hourState = { phase: 'flow', t0: clock.now }` | `state()` 的 `phase / t0`（`t0` 取 **0**） |
 * | 顶层 `const hourSand = { up: 1.0, dn: 0.05 }` | `state.sand`（字段名不变，`update` 里以原名 `hourSand` 别住） |
 * | `sandUp / sandDn / sandStream` | `build()` 经 `parts` 交出 |
 * | `regMagic(hourG, …)` | `interactables()`（`label` 语义化 + `mode: 'both'`） |
 * | `tickOnce()` 的 `updateHourglass(time);` | `update()`（**原地 tick**，参数顺序 `(dt, time)`） |
 *
 * ## ★ `t0: clock.now` 为什么写成 `t0: 0`
 *
 * `clock` 只在 `animate()` 里的 `clock.tick(t)` 推进，而**全部建几何代码都在第一次
 * `animate()` 之前**（`monolith.js` 末尾：`if (clock.mode === 'manual') { … } else { animate(0); }`）。
 * 于是建几何时 `clock.now` **恒为 0**（`app/clock.js` 的初值也是 0）——
 * 写死 0 与原实现**同一个数**，不是近似。
 * 点击时的那处 `clock.now` 则走 `s.now`（`update` 第一行存的上一帧 `time`），与
 * `floor2/witchHat.js` / `floor2/rubik.js` 同一处置。
 */
import * as THREE from 'three'
import { defineProp } from '../../app/defineProp.js'

/** 原 `updateHourglass(time)`，逐字搬运（`hourState` → 形参 `s`；`hourSand` 以原名别住 `s.sand`） */
function updateHourglass(s, time, env) {
    const { parts, smooth } = env;
    const hourG = parts.body, sandUp = parts.up, sandDn = parts.dn, sandStream = parts.stream;
    const hourSand = s.sand;
    if (s.phase === 'flip') {
        const e = time - s.t0;
        const kk = smooth(Math.min(e / 0.6, 1));
        hourG.rotation.z = kk * Math.PI;
        sandStream.visible = false;
        if (e >= 0.6) {
            hourG.rotation.z = 0;
            const t = hourSand.up;
            hourSand.up = hourSand.dn;
            hourSand.dn = t;
            s.phase = 'flow';
            s.t0 = time;
        }
    } else if (s.phase === 'flow') {
        const e = time - s.t0;
        const kk = smooth(Math.min(e / 3.0, 1));
        hourSand.up = 1 - 0.95 * kk;
        hourSand.dn = 0.05 + 0.95 * kk;
        sandStream.visible = e < 2.9;
        if (e >= 3.0) {
            sandStream.visible = false;
            s.phase = 'idle';
        }
    }
    sandUp.scale.setScalar(Math.max(0.05, hourSand.up));
    sandDn.scale.setScalar(Math.max(0.05, hourSand.dn));
}

export default defineProp({
  id: 'floor2/desk-hourglass',
  kind: 'decor',

  /**
   * 原 `const hourState = { phase: 'flow', t0: clock.now }` + `const hourSand = { up: 1.0, dn: 0.05 }`，
   * 外加 `now`（替"点击时的 `clock.now`"，见文件头）。`t0: 0` = 建几何时的 `clock.now`。
   */
  state: () => ({ phase: 'flow', t0: 0, now: 0, sand: { up: 1.0, dn: 0.05 } }),

  build({ scene, L, LITMAT, MAT }) {
    const { DESK_HG_X, DESK_HG_Z, TBL_TOP } = L

    const hourG = new THREE.Group();
    hourG.position.set(DESK_HG_X, TBL_TOP + 0.106, DESK_HG_Z);
    scene.add(hourG);
    let sandUp, sandDn, sandStream;
    {
        const woodM = LITMAT(0x8a6238, { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
        const dG = new THREE.CylinderGeometry(0.050, 0.050, 0.012, 14);
        const d1 = new THREE.Mesh(dG, woodM);
        d1.position.y = 0.098;
        hourG.add(d1);
        const d2 = new THREE.Mesh(dG, woodM);
        d2.position.y = -0.098;
        hourG.add(d2);
        hourG.add(new THREE.LineSegments(new THREE.EdgesGeometry(dG), MAT).translateY(0.098));
        hourG.add(new THREE.LineSegments(new THREE.EdgesGeometry(dG), MAT).translateY(-0.098));
        for (let i = 0; i < 3; i++) {
            const a = i * Math.PI * 2 / 3 + 0.5;
            const p = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.20, 6), woodM);
            p.position.set(Math.cos(a) * 0.044, 0, Math.sin(a) * 0.044);
            hourG.add(p);
        }
        const glassM = new THREE.MeshBasicMaterial({ color: 0xdff2f8, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide });
        const cupG = new THREE.ConeGeometry(0.038, 0.086, 14);
        const up = new THREE.Mesh(cupG, glassM);
        up.rotation.x = Math.PI;
        up.position.y = 0.047;
        hourG.add(up);
        const dn = new THREE.Mesh(cupG, glassM);
        dn.position.y = -0.047;
        hourG.add(dn);
        const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.014, 8), glassM);
        hourG.add(neck);
        const sandM = LITMAT(0xe8c26a);
        const gU = new THREE.ConeGeometry(0.031, 0.082, 12);
        gU.rotateX(Math.PI);
        gU.translate(0, 0.041, 0);
        sandUp = new THREE.Mesh(gU, sandM);
        sandUp.position.y = 0.004;
        hourG.add(sandUp);
        const gD = new THREE.ConeGeometry(0.033, 0.070, 12);
        gD.translate(0, 0.035, 0);
        sandDn = new THREE.Mesh(gD, sandM);
        sandDn.position.y = -0.090;
        hourG.add(sandDn);
        sandStream = new THREE.Mesh(new THREE.CylinderGeometry(0.0032, 0.0032, 0.066, 6), LITMAT(0xe8c26a));
        sandStream.position.y = -0.037;
        hourG.add(sandStream);
    }

    return { root: hourG, parts: { body: hourG, up: sandUp, dn: sandDn, stream: sandStream } }
  },

  /** 原 `regMagic(hourG, …)` 的替身（`label` 语义化 + `mode: 'both'`，消解风险 `R1`） */
  interactables: (s, { L }) => [{
    id: 'desk-hourglass/flip',
    label: '把桌上的沙漏翻过来',
    mode: 'both',
    // 锚点与几何同源：沙漏就在 `DESK_HG_X / DESK_HG_Z`（不变量 N9）
    anchor: { x: L.DESK_HG_X, z: L.DESK_HG_Z },
    radius: 1.4,
    onActivate: () => {
      if (s.phase !== 'idle') return;
      s.phase = 'flip';
      s.t0 = s.now;   // 原 `clock.now` —— 与上一帧的 `time` 恒等，见文件头
    },
  }],

  /** 原 `tickOnce()` 里那行 `updateHourglass(time);`，逐字搬运 */
  update(dt, time, s, env) {
    s.now = time;
    updateHourglass(s, time, env);
  },
})
