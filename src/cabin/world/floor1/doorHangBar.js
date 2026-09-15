/**
 * 门口上方挂杆（挂杆 + 晴天娃娃 + 玻璃风铃） —— `J3` 搬迁
 *
 * 来源：`legacy/monolith.js` 原三段**互相咬合**的分区
 *   · `/* ---- 门口上方挂杆 ---- *\/`（原 L3174 一带）
 *   · `/* —— 晴天娃娃【无眉毛：眼睛 + 大微笑 + 腮红，五官贴球面外】—— *\/`
 *   · `/* —— 玻璃风铃 —— *\/`
 * 以及 `tickOnce()` 里 `/* ---- 晴天娃娃 + 风铃 ---- *\/` 那段**每帧分支**。
 *
 * ## ★ 为什么三段合成**一件**物件（而不是拆成三件）
 *
 * `sunPivot` / `chimePivot` 都是 `hangBar.add(...)` 的**子节点**，且每帧分支
 * 把两者放在同一个循环里更新（`for (const h of [sunPivot, chimePivot])`）。
 * 拆开会立刻产生两处悬空引用：
 *   ① 挂杆自己搬走后，monolith 里 `hangBar.add(sunPivot)` 找不到 `hangBar`
 *      （模块作用域与 IIFE 闭包不通，`hangBar` 又不在 ctx 里）；
 *   ② 每帧分支的循环跨两件物件。
 * 因此按"**整段一起搬**"处理 —— 三段的几何 + 交互 + 每帧分支全部收进本文件，
 * 是任务书里对这一段明确允许的做法。
 *
 * ## 与搬迁前逐项对应
 *
 * | 原来住哪 | 现在住哪 |
 * |---|---|
 * | 顶层 `const hangBar / sunPivot / chimePivot` | `build()`，并用 `{ root, parts }` 交出根与两个摆锤 |
 * | 行内字面量 `0 / 2.66 / 3.86` | `world/layout.js` 的 `HANGBAR_X / HANGBAR_Y / HANGBAR_Z`（不变量 `N9`，数值一个没改） |
 * | `sunPivot.userData = { energy: 0, ph: 0 }`（含风铃的 `ph: 2`） | **原样保留**：状态本来就活在 `userData` 里，不属于顶层 `let`，逐字照搬最忠实 |
 * | `regMagic(sunPivot, …)` / `regMagic(chimePivot, …)` | `interactables()` 两条（`label` 语义化、`mode: 'both'`，消解风险 `R1`） |
 * | `tickOnce()` 里的 `{ for (const h of [sunPivot, chimePivot]) … }` | `update()`（函数体逐字搬运，只把变量来源换成 `parts`） |
 *
 * ⚠️ **需要人工在 monolith 侧做两件事**（应用器只管几何段，见 `_j3-apply.mjs` 文件头）：
 *   ① 把装配行改成接住句柄：`const doorHangBarApi = installProp(doorHangBar);`
 *   ② 把 `tickOnce()` 里 `/* ---- 晴天娃娃 + 风铃 ---- *\/` 那个 `{ … }` 块换成
 *      `doorHangBarApi.tick(dt, time);`（**原位置**调用 ⇒ 每帧顺序一个字节没变）。
 * 这是 `J3` 的过渡形态（"原地 tick"），与 `world/floor1/broom.js` 完全同款。
 *
 * 无 `state()`：本例的状态就在两个摆锤的 `userData` 上（原实现如此），
 * `interactables()` / `update()` 都通过 `parts` 拿到它们，不引入任何新的全局可变状态（`N7`）。
 */
import * as THREE from 'three'
import { defineProp } from '../../app/defineProp.js'

export default defineProp({
  id: 'floor1/hang-bar',
  kind: 'decor',

  build({ scene, L, put, box, line, edge, geo, LITMAT, MAT, DARK }) {
    const { HANGBAR_X, HANGBAR_Y, HANGBAR_Z } = L

    const hangBar = new THREE.Group();
    hangBar.position.set(HANGBAR_X, HANGBAR_Y, HANGBAR_Z);
    scene.add(hangBar);
    put(box(0.95, 0.035, 0.05), 0, 0, 0, 0, 0, 0, hangBar);
    for (const ex of [-0.45, 0.45])
      put(line([[ex, 0, 0.05], [ex * 1.08, 0.10, 0.10]]), 0, 0, 0, 0, 0, 0, hangBar);

    /* —— 晴天娃娃【无眉毛：眼睛 + 大微笑 + 腮红，五官贴球面外】—— */
    const CLOTH = LITMAT(0xfdfcf8, { side: THREE.DoubleSide });
    const sunPivot = new THREE.Group();
    sunPivot.position.set(-0.27, -0.017, 0);
    sunPivot.rotation.y = Math.PI;   /* 转向室内（-z），默认相机可见正脸 */
    hangBar.add(sunPivot);
    {
      /* 头球参数：中心 (0,-0.098,0)，半径 0.058 */
      const HC_Y = -0.098, HC_R = 0.058;
      const fz = (x, y) => Math.sqrt(Math.max(HC_R * HC_R - x * x - (y - HC_Y) * (y - HC_Y), 1e-4)) + 0.004;

      put(line([[0, 0, 0], [0, -0.045, 0]]), 0, 0, 0, 0, 0, 0, sunPivot);
      put(new THREE.Mesh(new THREE.SphereGeometry(HC_R, 14, 10), CLOTH), 0, HC_Y, 0, 0, 0, 0, sunPivot);
      put(new THREE.Mesh(new THREE.CylinderGeometry(0.030, 0.088, 0.24, 12), CLOTH), 0, -0.243, 0, 0, 0, 0, sunPivot);
      const zb = [];
      for (let i = 0; i <= 18; i++) {
        const a = i / 18 * Math.PI * 2;
        zb.push([Math.cos(a) * 0.088, -0.363 + Math.sin(a * 3) * 0.014, Math.sin(a) * 0.088]);
      }
      put(new THREE.LineLoop(geo(zb), MAT), 0, 0, 0, 0, 0, 0, sunPivot);
      put(line([[-0.028, -0.135, -0.045], [-0.048, -0.33, -0.062]]), 0, 0, 0, 0, 0, 0, sunPivot);
      put(line([[0.028, -0.135, -0.045], [0.048, -0.33, -0.062]]), 0, 0, 0, 0, 0, 0, sunPivot);
      /* 眼睛（球面外凸，无眉毛） */
      put(new THREE.Mesh(new THREE.SphereGeometry(0.0065, 6, 5), DARK), -0.020, -0.094, fz(-0.020, -0.094), 0, 0, 0, sunPivot);
      put(new THREE.Mesh(new THREE.SphereGeometry(0.0065, 6, 5), DARK), 0.020, -0.094, fz(0.020, -0.094), 0, 0, 0, sunPivot);
      /* 大微笑（五点弧线，贴球面） */
      put(line([
        [-0.024, -0.112, fz(-0.024, -0.112)],
        [-0.012, -0.120, fz(-0.012, -0.120)],
        [0.000, -0.124, fz(0.000, -0.124)],
        [0.012, -0.120, fz(0.012, -0.120)],
        [0.024, -0.112, fz(0.024, -0.112)]
      ]), 0, 0, 0, 0, 0, 0, sunPivot);
      /* 腮红（球面外） */
      put(new THREE.Mesh(new THREE.SphereGeometry(0.010, 6, 5),
        new THREE.MeshBasicMaterial({ color: 0xf2b0b6, transparent: true, opacity: 0.55 })),
        -0.034, -0.108, fz(-0.034, -0.108), 0, 0, 0, sunPivot);
      put(new THREE.Mesh(new THREE.SphereGeometry(0.010, 6, 5),
        new THREE.MeshBasicMaterial({ color: 0xf2b0b6, transparent: true, opacity: 0.55 })),
        0.034, -0.108, fz(0.034, -0.108), 0, 0, 0, sunPivot);
    }
    sunPivot.userData = { energy: 0, ph: 0 };

    /* —— 玻璃风铃 —— */
    const glassMat = new THREE.MeshBasicMaterial({
      color: 0x9fdce8, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide
    });
    const glassLineMat = new THREE.LineBasicMaterial({ color: 0x4f9bb0 });
    const glass = g => {
      const grp = new THREE.Group();
      grp.add(new THREE.Mesh(g, glassMat));
      grp.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, 1), glassLineMat));
      return grp;
    };
    const chimePivot = new THREE.Group();
    chimePivot.position.set(0.27, -0.017, 0);
    hangBar.add(chimePivot);
    {
      put(line([[0, 0, 0], [0, -0.05, 0]]), 0, 0, 0, 0, 0, 0, chimePivot);
      put(edge(new THREE.TorusGeometry(0.026, 0.005, 6, 14)), 0, -0.056, 0, 0, 0, 0, chimePivot);
      const prof = [];
      for (let i = 0; i <= 6; i++) {
        const a = i / 6 * Math.PI / 2;
        prof.push(new THREE.Vector2(Math.sin(a) * 0.055, -0.062 - Math.cos(a) * 0.055));
      }
      prof.push(new THREE.Vector2(0.075, -0.140));
      prof.push(new THREE.Vector2(0.078, -0.148));
      const dome = new THREE.Mesh(new THREE.LatheGeometry(prof, 14), glassMat);
      put(dome, 0, 0, 0, 0, 0, 0, chimePivot);
      const rimPts = [];
      for (let i = 0; i <= 18; i++) { const a = i / 18 * Math.PI * 2; rimPts.push([Math.cos(a) * 0.078, -0.148, Math.sin(a) * 0.078]); }
      put(new THREE.LineLoop(geo(rimPts), glassLineMat), 0, 0, 0, 0, 0, 0, chimePivot);
      const midPts = [];
      for (let i = 0; i <= 18; i++) { const a = i / 18 * Math.PI * 2; midPts.push([Math.cos(a) * 0.055, -0.062, Math.sin(a) * 0.055]); }
      put(new THREE.LineLoop(geo(midPts), glassLineMat), 0, 0, 0, 0, 0, 0, chimePivot);
      put(line([[0, -0.062, 0], [0, -0.165, 0]]), 0, 0, 0, 0, 0, 0, chimePivot);
      put(new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), DARK), 0, -0.170, 0, 0, 0, 0, chimePivot);
      put(line([[0, -0.178, 0], [0, -0.19, 0.002]]), 0, 0, 0, 0, 0, 0, chimePivot);
      put(edge(new THREE.BoxGeometry(0.038, 0.26, 0.005)), 0, -0.32, 0, 0, 0.12, 0, chimePivot);
      put(line([[-0.018, -0.275, 0.004], [0.018, -0.30, 0.004]]), 0, 0, 0, 0, 0, 0, chimePivot);
      put(line([[-0.018, -0.335, 0.004], [0.018, -0.36, 0.004]]), 0, 0, 0, 0, 0, 0, chimePivot);
      put(line([[0, -0.45, 0], [0.022, -0.50, 0.01]]), 0, 0, 0, 0, 0, 0, chimePivot);
      put(line([[0, -0.45, 0], [-0.022, -0.50, 0.01]]), 0, 0, 0, 0, 0, 0, chimePivot);
    }
    chimePivot.userData = { energy: 0, ph: 2 };

    // 返回根 + 两个摆锤：`installProp` 把 `parts` 交给 `interactables()` / `update()`
    return { root: hangBar, parts: { sunPivot, chimePivot } }
  },

  // 原 `regMagic(sunPivot, …)` / `regMagic(chimePivot, …)` —— 一处一条，`label` 语义化
  interactables: (s, { L, parts }) => [
    {
      id: 'sun-doll/pat',
      label: '拍拍晴天娃娃',
      mode: 'both',
      // 锚点与几何同源：挂杆在 L.HANGBAR_X / L.HANGBAR_Z，娃娃是它的 -0.27 偏移（不变量 N9）
      anchor: { x: L.HANGBAR_X - 0.27, z: L.HANGBAR_Z },
      radius: 1.8,
      onActivate: () => { parts.sunPivot.userData.energy = 1; },
    },
    {
      id: 'glass-chime/ring',
      label: '拨响玻璃风铃',
      mode: 'both',
      anchor: { x: L.HANGBAR_X + 0.27, z: L.HANGBAR_Z },
      radius: 1.8,
      onActivate: () => { parts.chimePivot.userData.energy = 1; },
    },
  ],

  /** 原 `tickOnce()` 里 `/* ---- 晴天娃娃 + 风铃 ---- *\/` 那段分支，逐字搬运 */
  update(dt, time, s, { parts }) {
    for (const h of [parts.sunPivot, parts.chimePivot]) {
      const u = h.userData;
      u.energy *= Math.pow(0.35, dt);
      if (u.energy < 0.002) u.energy = 0;
      h.rotation.z = Math.sin(time * 1.1 + u.ph) * 0.045 + u.energy * Math.sin(time * 9 + u.ph) * 0.30;
      h.rotation.x = Math.cos(time * 0.9 + u.ph) * 0.040 + u.energy * Math.cos(time * 8 + u.ph) * 0.22;
    }
  },
})
