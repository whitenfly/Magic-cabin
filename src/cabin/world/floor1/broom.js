/**
 * 12.10 魔法扫帚 —— `J3` 搬迁（B3）
 *
 * 来源：`legacy/monolith.js` 原 `12.10` 分区（原 `index.html` L2577–2630）的**几何段**，
 * 以及 `tickOnce()` 里 `/* ---- 魔法扫帚 ---- *\/` 那段**每帧分支**（原 L9094 一带）。
 *
 * ## ★ 它是"有动画的物件"的标准样板
 *
 * 前面两件（桌下地毯、固定木台）都是纯装饰 —— 没有状态、没有每帧逻辑，搬起来最省事。
 * 而本阶段绝大多数物件都有动画，且**动画分支还留在 `tickOnce()` 里**
 * （`UpdateScheduler` 到 `J4` 才接管主循环）。于是本件示范了完整的一套：
 *
 * | 原来住哪 | 现在住哪 |
 * |---|---|
 * | 顶层 `let broomHover / broomP` | `state: () => ({ hover: false, p: 0 })` |
 * | 顶层 `const BROOM_REST / BROOM_FLY` | `world/layout.js`（不变量 `N9`，数值一个没改） |
 * | `const broomG / broomGlow` + 几何 | `build()`，并通过 `{ root, parts }` 把两个 Group **都**交出去 |
 * | `regMagic(broomG, onClick)` | `interactables()`（`label` 语义化 + `mode: 'both'`，消解风险 `R1`） |
 * | `tickOnce()` 里的 `{ … }` 块 | `update()`，由 `tickOnce()` **原位置**调用 `broomApi.tick(dt, time)` |
 *
 * 「原地 tick」是 `J3` 的过渡形态：状态与几何都进了物件，而**执行顺序一个字节没变**。
 * `J4` 只需删掉 `tickOnce()` 里那一行调用，改由调度器驱动（`update` 已经登记进 scheduler）。
 *
 * ## 为什么 `build` 返回 `{ root, parts }` 而不是直接返回 `broomG`
 *
 * 悬浮光环 `broomGlow` 是 `broomG` 的子节点，但每帧逻辑要单独改它的 `visible` / `scale`。
 * 「一件物件里有多个需要后续访问的 Group」时，用 `parts` 交出去 ——
 * 它同时写进 `mounts` 的挂载点记录，于是功能模块也能按部件名认领（如 `broom/glow`）。
 */
import * as THREE from 'three'
import { defineProp } from '../../app/defineProp.js'

export default defineProp({
  id: 'floor1/broom',
  kind: 'furniture',

  state: () => ({ hover: false, p: 0 }),

  build({ scene, L, put, edge, line }) {
    const { BROOM_REST } = L

    const broomG = new THREE.Group();
    broomG.position.set(BROOM_REST.x, BROOM_REST.y, BROOM_REST.z);
    broomG.rotation.z = BROOM_REST.rz;
    scene.add(broomG);
    {
      put(edge(new THREE.CylinderGeometry(0.022, 0.026, 1.45, 8)), 0, 0.865, 0, 0, 0, 0, broomG);
      put(edge(new THREE.SphereGeometry(0.026, 8, 6)), 0, 1.59, 0, 0, 0, 0, broomG);
      put(line([[-0.026, 1.25, 0], [0.026, 1.25, 0]]), 0, 0, 0, 0, 0, 0, broomG);
      put(line([[-0.026, 0.95, 0], [0.026, 0.95, 0]]), 0, 0, 0, 0, 0, 0, broomG);

      const SEGS = [
        [0.140, 0.026],
        [0.090, 0.048],
        [0.045, 0.072],
        [0.000, 0.092],
        [-0.055, 0.104],
        [-0.100, 0.112]
      ];
      const ringAt = (y, r, seg) => {
        const pts = [];
        for (let i = 0; i <= seg; i++) { const a = i / seg * Math.PI * 2; pts.push([Math.cos(a) * r, y, Math.sin(a) * r]); }
        put(line(pts), 0, 0, 0, 0, 0, 0, broomG);
      };
      for (const [yy, rr] of SEGS) ringAt(yy, rr, yy === 0.140 ? 10 : 14);
      for (let i = 0; i < 16; i++) {
        const a = i / 16 * Math.PI * 2;
        const pts = SEGS.map(([yy, rr]) => [Math.cos(a) * rr, yy, Math.sin(a) * rr]);
        put(line(pts), 0, 0, 0, 0, 0, 0, broomG);
      }
      put(line([[-0.038, 0.09, 0], [0.050, 0.045, 0]]), 0, 0, 0, 0, 0, 0, broomG);
      put(line([[0.038, 0.09, 0], [-0.050, 0.045, 0]]), 0, 0, 0, 0, 0, 0, broomG);
      put(line([[0, 0.09, -0.038], [0, 0.045, 0.050]]), 0, 0, 0, 0, 0, 0, broomG);
      put(line([[0, 0.09, 0.038], [0, 0.045, -0.050]]), 0, 0, 0, 0, 0, 0, broomG);
    }
    const broomGlow = new THREE.Group();
    broomGlow.visible = false;
    {
      const gp = [], gp2 = [];
      for (let i = 0; i <= 30; i++) {
        const a = i / 30 * Math.PI * 2;
        gp.push([Math.cos(a) * 0.24, 0, Math.sin(a) * 0.24]);
        const r2 = 0.24 + Math.sin(a * 4) * 0.02;
        gp2.push([Math.cos(a) * r2, 0.012, Math.sin(a) * r2]);
      }
      put(line(gp), 0, 0, 0, 0, 0, 0, broomGlow);
      put(line(gp2), 0, 0, 0, 0, 0, 0, broomGlow);
    }
    broomG.add(broomGlow);

    return { root: broomG, parts: { body: broomG, glow: broomGlow } }
  },

  // 主入口同时给 aim（准星）与 proximity（近距）两条 —— 否则默认固定视角下点不开（风险 `R1`，验收 `BB2b`）
  interactables: (s, { L }) => [{
    id: 'broom/toggle',
    label: '让魔法扫帚飞起来',
    mode: 'both',
    // 锚点与几何同源：都取自 `L.BROOM_REST`（不变量 N9）
    anchor: { x: L.BROOM_REST.x, z: L.BROOM_REST.z },
    radius: 1.8,
    onActivate: () => { s.hover = !s.hover; },
  }],

  /** 原 `tickOnce()` 里 `/* ---- 魔法扫帚 ---- *\/` 那段分支，逐字搬运 */
  update(dt, time, s, { L, parts }) {
    const { BROOM_REST, BROOM_FLY } = L
    const broomG = parts.body, broomGlow = parts.glow

    s.p += ((s.hover ? 1 : 0) - s.p) * 0.02;
    const p = s.p;
    broomG.position.x = BROOM_REST.x + (BROOM_FLY.x - BROOM_REST.x) * p;
    broomG.position.z = BROOM_REST.z + (BROOM_FLY.z - BROOM_REST.z) * p;
    broomG.position.y = BROOM_REST.y + (BROOM_FLY.y - BROOM_REST.y) * p
      + Math.sin(time * 1.3) * 0.03 * p;
    broomG.rotation.z = BROOM_REST.rz + (BROOM_FLY.rz - BROOM_REST.rz) * p
      + Math.sin(time * 1.1) * 0.02 * p;
    broomG.rotation.x = Math.sin(time * 0.9) * 0.03 * p;
    broomG.rotation.y = Math.sin(time * 0.5) * 0.12 * p;
    broomGlow.visible = p > 0.05;
    if (broomGlow.visible) {
      broomGlow.position.set(0, -0.20 + Math.sin(time * 2.2) * 0.012, 0);
      broomGlow.rotation.y = time * 0.6;
      const gs = 0.85 + 0.15 * Math.sin(time * 2.5);
      broomGlow.scale.setScalar(gs * Math.min(p * 1.5, 1));
    }
  },
})
