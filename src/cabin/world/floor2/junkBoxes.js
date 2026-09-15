/**
 * 18.16 右前角杂物纸箱（左右两片盖向外翻开） —— `J3` 搬迁
 *
 * 来源：`legacy/monolith.js` 原 `18.16` 分区的**几何段**，以及 `updateNewDecor()`
 * 里那 6 行纸箱开合动画（原 L18.17 装饰循环内）。
 *
 * ## 与搬迁前逐项对应
 *
 * | 原来住哪 | 现在住哪 |
 * |---|---|
 * | 顶层 `let junkOpen = false, junkT = 0` | `state: () => ({ open: false, t: 0 })` |
 * | 行内字面量 `3.34 / 3.34` | `world/layout.js` 的 `JUNK_X / JUNK_Z`（不变量 `N9`，数值一个没改） |
 * | `const junkG / junkFlaps / junkInside` + 几何 | `build()`，用 `{ root, parts }` 把盖子数组与内胆交出去 |
 * | `regMagic`（箱体一处） | `interactables()`（`label` 语义化 + `mode: 'both'`，消解风险 `R1`） |
 * | `updateNewDecor()` 里的 6 行 | `update()`（逐字搬运，`junkT/junkOpen` → `s.t/s.open`，`junkFlaps/junkInside` → `parts`） |
 *
 * ## ★ 关于 `cbox` / `colEdge` / `smooth`（曾经的"复刻"，已改为取 `ctx`）
 *
 * `cbox` / `colEdge` 是 monolith 里的**共享工具函数**（分别住在 18.10 与 18.12 分区开头，
 * 被衣柜 / 垃圾桶 / 抽纸盒 / 魔法时钟 / 挂画 / 镜子 … 几十处调用），
 * `smooth` 是 IIFE 里的缓动（`const smooth = k => k * k * (3 - 2 * k)`）。
 *
 * 搬迁当时 `ctx` 还没有它们，本文件因此**逐字复刻**过 `cbox` / `colEdge`（进 `build()`）。
 * 后来 `ctx` 改成**惰性求值**并补上了这批工具，复刻体随即删除 ——
 * 现在调用的是 monolith 那**同一个函数本身**（装配点 L4569 晚于它们的定义 L4268 / L4380）。
 * `smooth` 仍取自 `ctx`。教训见 [`world/README.md`](../../README.md)
 * 的「共享工具：用 ctx 取，不要复制实现」一节。
 *
 * ## ⚠️ 需要人工在 monolith 侧做两件事（应用器只管几何段）
 *
 * ① 装配行接住句柄：`const junkApi = installProp(junkBoxes);`
 * ② 把 `updateNewDecor()` 里那 6 行（`junkT += …` 到 `junkInside.position.y = …`）换成
 *    `junkApi.tick(dt, time);` —— **注意参数顺序是 (dt, time)**，而 `updateNewDecor(time, dt)`
 *    自己的形参是反的，写错会让纸箱动画速度完全不同。
 *    调用点仍在 `updateNewDecor` 内（原位置）⇒ realtime 的 rAF 与 manual 的 tickOnce 两条路径
 *    的调用时机与搬迁前一致。
 */
import * as THREE from 'three'
import { defineProp } from '../../app/defineProp.js'

export default defineProp({
  id: 'floor2/junk-boxes',
  kind: 'decor',

  state: () => ({ open: false, t: 0 }),

  // `cbox` / `colEdge` 直接取自装配环境 —— `ctx` 里的就是 monolith 那两个同名函数本身
  // （装配点 L4569 晚于它们的定义 L4268 / L4380，惰性 getter 取得到）。**不再复制实现**。
  build({ scene, L, put, cbox, colEdge }) {
    const { JUNK_X, JUNK_Z, FY } = L

    const junkG = new THREE.Group();
    junkG.position.set(JUNK_X, FY, JUNK_Z);
    junkG.rotation.y = Math.PI / 4;
    scene.add(junkG);
    const CB_COL = 0xc9a878, CB_DARK = 0xb0906a;
    const junkFlaps = [];
    const junkInside = new THREE.Group();
    junkG.add(junkInside);
    {
      const S = 0.56, H = 0.40, T = 0.028;
      // 箱体五面（底 + 四壁，顶部敞开由盖子封）
      put(cbox(S, T, S, CB_COL), 0, T / 2, 0, 0, 0, 0, junkG);
      put(cbox(S, H, T, CB_COL), 0, H / 2, -S / 2 + T / 2, 0, 0, 0, junkG);
      put(cbox(S, H, T, CB_COL), 0, H / 2, S / 2 - T / 2, 0, 0, 0, junkG);
      put(cbox(T, H, S - 2 * T, CB_COL), -S / 2 + T / 2, H / 2, 0, 0, 0, 0, junkG);
      put(cbox(T, H, S - 2 * T, CB_COL), S / 2 - T / 2, H / 2, 0, 0, 0, 0, junkG);
      // 正面胶带与手写标签
      put(cbox(0.10, 0.34, 0.008, CB_DARK), 0.07, 0.20, -S / 2 - 0.004, 0, 0, 0, junkG);
      const junkCv = document.createElement('canvas');
      junkCv.width = 96;
      junkCv.height = 48;
      const jc = junkCv.getContext('2d');
      jc.fillStyle = '#f2ead6';
      jc.fillRect(0, 0, 96, 48);
      jc.strokeStyle = '#8a6a4a';
      jc.lineWidth = 3;
      jc.strokeRect(3, 3, 90, 42);
      jc.fillStyle = '#5a4a3a';
      jc.font = 'bold 19px "Microsoft YaHei", serif';
      jc.textAlign = 'center';
      jc.textBaseline = 'middle';
      jc.fillText('杂物 ✦', 48, 26);
      const junkTex = new THREE.CanvasTexture(junkCv);
      const junkLabel = new THREE.Mesh(new THREE.PlaneGeometry(0.20, 0.10), new THREE.MeshBasicMaterial({ map: junkTex }));
      junkLabel.position.set(-0.15, 0.24, -S / 2 - 0.006);
      junkLabel.rotation.y = Math.PI;
      junkG.add(junkLabel);
      // 左盖：铰链在箱口左缘，盖板向右平铺盖住左半箱口
      const flapL = new THREE.Group();
      flapL.position.set(-S / 2, H, 0);
      const pl = cbox(S / 2 - 0.005, 0.018, S - 0.05, CB_COL);
      pl.position.set(S / 4, 0, 0);
      flapL.add(pl);
      junkG.add(flapL);
      junkFlaps.push({ pivot: flapL, target: Math.PI + 0.35 });
      // 右盖：铰链在箱口右缘，盖板向左平铺盖住右半箱口
      const flapR = new THREE.Group();
      flapR.position.set(S / 2, H, 0);
      const pr = cbox(S / 2 - 0.005, 0.018, S - 0.05, CB_COL);
      pr.position.set(-S / 4, 0, 0);
      flapR.add(pr);
      junkG.add(flapR);
      junkFlaps.push({ pivot: flapR, target: -(Math.PI + 0.35) });
      // ---- 箱内杂物 ----
      const bottle = new THREE.Group();
      const bb = colEdge(new THREE.CylinderGeometry(0.040, 0.048, 0.13, 10), 0x6a9a7a);
      bb.position.y = 0.065;
      bottle.add(bb);
      const bn = colEdge(new THREE.CylinderGeometry(0.013, 0.013, 0.05, 8), 0x8a6238);
      bn.position.y = 0.155;
      bottle.add(bn);
      const bc = colEdge(new THREE.SphereGeometry(0.017, 8, 6), 0xb08a5a);
      bc.position.y = 0.185;
      bottle.add(bc);
      bottle.position.set(-0.13, T, 0.07);
      bottle.rotation.y = 0.5;
      junkInside.add(bottle);
      const yarn = colEdge(new THREE.SphereGeometry(0.062, 12, 10), 0xc26a8a, 15);
      yarn.position.set(0.14, T + 0.062, -0.10);
      junkInside.add(yarn);
      for (let k = 0; k < 3; k++) {
        const tr = colEdge(new THREE.TorusGeometry(0.062, 0.005, 6, 18), 0xe8a8c0);
        tr.rotation.set(k * 0.9, k * 1.2, 0);
        tr.position.copy(yarn.position);
        junkInside.add(tr);
      }
      const bk1 = cbox(0.17, 0.035, 0.12, 0x7a4638);
      bk1.position.set(0.06, T + 0.018, 0.13);
      bk1.rotation.y = 0.45;
      junkInside.add(bk1);
      const bk2 = cbox(0.15, 0.03, 0.11, 0x4a6a8a);
      bk2.position.set(0.075, T + 0.05, 0.125);
      bk2.rotation.y = 0.12;
      junkInside.add(bk2);
      const bone = new THREE.Group();
      const shaft = colEdge(new THREE.CylinderGeometry(0.011, 0.011, 0.15, 8), 0xf0ead8);
      shaft.rotation.z = Math.PI / 2;
      bone.add(shaft);
      for (const e of [-1, 1]) {
        for (const o of [-0.011, 0.011]) {
          const knob = colEdge(new THREE.SphereGeometry(0.019, 8, 6), 0xf0ead8);
          knob.position.set(e * 0.078, o, 0);
          bone.add(knob);
        }
      }
      bone.position.set(-0.08, T + 0.02, -0.12);
      bone.rotation.y = 0.6;
      junkInside.add(bone);
    }

    // 返回根 + 两片盖子（含各自的翻开角度）+ 内胆：`update()` 靠 `parts` 拿到它们
    return { root: junkG, parts: { flaps: junkFlaps, inside: junkInside } }
  },

  // 原 `regMagic`（点箱体翻转 `junkOpen`）的替身
  interactables: (s, { L }) => [{
    id: 'junk-box/open',
    label: '翻开杂物纸箱的盖子',
    mode: 'both',
    // 锚点与几何同源：纸箱就在 L.JUNK_X / L.JUNK_Z（不变量 N9）
    anchor: { x: L.JUNK_X, z: L.JUNK_Z },
    radius: 1.8,
    onActivate: () => { s.open = !s.open; },
  }],

  /** 原 `updateNewDecor()` 里的 6 行纸箱开合，逐字搬运（`junkT/junkOpen` → `s.t/s.open`） */
  update(dt, time, s, { parts }) {
    const smooth = k => k * k * (3 - 2 * k);   /* 复刻 monolith IIFE 里的同名缓动 */

    s.t += ((s.open ? 1 : 0) - s.t) * 0.075;
    const jk = smooth(Math.max(0, Math.min(1, s.t)));
    for (const f of parts.flaps) {
      f.pivot.rotation.z = f.target * jk;
    }
    parts.inside.position.y = Math.sin(Math.min(1, s.t) * Math.PI) * 0.05;
  },
})
