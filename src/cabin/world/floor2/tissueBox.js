/**
 * 18.11 抽纸盒（书桌上；点击 → 抽出一张纸 → 摊在桌面 → 揉成团 → 抛进垃圾桶） —— `J3` 搬迁（B4）
 *
 * 来源：`legacy/monolith.js` 原 `18.11` 分区里 `/* 抽纸盒 *\/` 那一小节
 * （装配时 L5028–L5175：盒体/备用纸 + 飞行纸的几何 + 两条 `regMagic` + `updateTissue`），
 * 以及 `tickOnce()` 里的 `updateTissue(time, dt);`（L8378）那一行**每帧分支**。
 *
 * ## 与搬迁前逐项对应
 *
 * | 原来住哪 | 现在住哪 |
 * |---|---|
 * | 顶层 `const TISSUE_X = 1.42 / TISSUE_Z = -2.15` | `world/layout.js` 的 `TISSUE_X / TISSUE_Z`（不变量 `N9`，数值一个没改） |
 * | 顶层 `const tissueState = { phase, t }` | `state()` 的 `s.phase / s.t` |
 * | 顶层 `let standbyAnimT = -1` | `s.standbyT` |
 * | 顶层 `let standbyPaper`（盒口备用纸，几何里才赋值） | `build()` 内的同名 `let`，经 `parts.standby` 交出 |
 * | `const tissueBoxG / tissuePaperG / paperFlat / paperBallFly` | `build()`，经 `parts` 交出（两个 Group 都**直接挂 `scene`**，与原实现一致） |
 * | `SLOT_POS / DESK_REST / BIN_MOUTH / BIN_FALL`（四个推导坐标） | `build()` 里推导一次，经 `parts` 交出（见「细节 1」） |
 * | `BIN_X / BIN_Z / BIN_H`（抛纸终点要用） | `world/layout.js`（**由 `floor2/bin` 的 spec 声明**，本件只读，`N9`） |
 * | `regMagic(tissueBoxG, …)` | `interactables()` 第一条（主入口，`mode: 'both'`，`label` 语义化） |
 * | `regMagic(tissuePaperG, …)` | `interactables()` 第二条（见「细节 2」的已知缺口） |
 * | `updateTissue(time, dt)` | `update()`（**原地 tick**，见「需要人工做的两件事」） |
 *
 * ## ★ 三处**必须知情**的细节
 *
 * 1. **四个推导坐标经 `parts` 交给 `interactables` / `update`。** 它们不是字面量，而是
 *    `V(TISSUE_X, TBL_TOP + 0.135, TISSUE_Z)` 这类推导 —— 按不变量 `N9` 只能有**一处**推导，
 *    故留在 `build` 的原文位置，用 `parts.slot / desk / mouth / fall` 交出去，
 *    在两个消费者里再按**原名**解构回来（`const SLOT_POS = parts.slot, …`），于是函数体逐字不变。
 *    （与 [`witchHat.js`](./witchHat.js) 的「细节 3」同款做法。）
 *
 * 2. **⚠️ 已知缺口：飞行纸那一侧的 aim（准星/点击）入口在 `J3` 期间会丢失。**
 *    原实现的第二条 `regMagic(tissuePaperG, …)` 把**纸**的 Mesh 收进 `magicMeshes`；
 *    而 `installProp` 的 aim 桥只认**一个** `root`（本件是 `tissueBoxG`），
 *    `tissuePaperG` 是 `scene` 的**兄弟节点**（不是 `tissueBoxG` 的子节点，搬迁前后都如此），
 *    因此它的 Mesh 不会被桥收进去 ⇒ **"纸摊在桌上时点它揉成团"这一步在 J3 期间点不动**
 *    （纸会一直摊在桌上；画面完全不受影响，像素回归也看不见）。
 *    两件都不能动：给两者套一层共同父 Group 会改动 `scene.children` 与透明物体的绘制顺序
 *    （像素回归的雷区）；把纸挂到盒下同理。**这条缺口应由 `J4` 的统一交互契约收编**
 *    （`installProp` 文件头已经写明：`J4` 把 aim 收进统一契约后，⑤.2 那一段连同 `magicMeshes` 一并删除）。
 *    在此之前，`interactables` 里仍**如实声明**这一条（`J4` 一到位即可用），
 *    并且**不要**把它的逻辑并进盒子的 `onActivate`（那会捏造一条原实现没有的交互）。
 *
 * 3. **`s.t` 是把 `tissueState.t` 扁平化**（`const s = tissueState;` 那一行随状态入 `state()` 消失），
 *    `standbyAnimT → s.standbyT`。`updateTissue` 的其余每一行与搬迁前逐字相同。
 *
 * ## ★ tick 接线（`J3` 的「原地 tick」；应用器的 `spec.tick` 直接代劳，无需人工）
 *
 * ① 装配行接住句柄（spec 的 `assign`）：`const tissueBoxApi = installProp(tissueBox);`
 * ② 把 `tickOnce()` 里那一行（当前 L8378，就在 `for (const tg of toppleGroups) …` 之后）
 *
 *    ```js
 *                    updateTissue(time, dt);
 *    ```
 *
 *    换成 `tissueBoxApi.tick(dt, time);` —— 这正是 spec 的 `tick: { old, new }` 所声明的那次替换
 *    （`old` 逐字给出该行，全文唯一）。⚠️ 新调用是 `(dt, time)`，原函数是 `(time, dt)`。
 *    它后面紧跟的 `updateWobblers(dt);`（L8379）**必须留在原地**，再往后是 `updateHat(…)`（本批已搬）。
 */
import * as THREE from 'three'
import { defineProp } from '../../app/defineProp.js'

/** 原 `updateTissue(time, dt)`，逐字搬运（原函数体只用 `dt`；`tissueState` → `s`、`standbyAnimT` → `s.standbyT`） */
function updateTissue(s, time, dt, env) {
    const { V, arcPos, smooth, parts } = env;
    const tissuePaperG = parts.paper, paperFlat = parts.flat, paperBallFly = parts.ball, standbyPaper = parts.standby;
    const SLOT_POS = parts.slot, DESK_REST = parts.desk, BIN_MOUTH = parts.mouth, BIN_FALL = parts.fall;

    if (s.standbyT >= 0) {
        s.standbyT += dt;
        const e = s.standbyT;
        if (e < 0.35) {
            standbyPaper.scale.y = 1 - 0.78 * smooth(e / 0.35);
        } else if (e < 0.75) {
            standbyPaper.scale.y = 0.22 + 0.78 * smooth((e - 0.35) / 0.40);
        } else {
            standbyPaper.scale.y = 1;
            s.standbyT = -1;
        }
    }
    if (s.phase === 'idle') return;
    s.t += dt;
    const e = s.t;
    if (s.phase === 'rise') {
        const k = smooth(Math.min(e / 0.50, 1));
        paperFlat.scale.y = 0.15 + 0.85 * k;
        if (e >= 0.50) {
            paperFlat.scale.y = 1;
            s.phase = 'lift';
            s.t = 0;
        }
    } else if (s.phase === 'lift') {
        const k = smooth(Math.min(e / 0.30, 1));
        tissuePaperG.position.y = SLOT_POS.y + 0.10 * k;
        if (e >= 0.30) {
            s.phase = 'lay';
            s.t = 0;
        }
    } else if (s.phase === 'lay') {
        const k = smooth(Math.min(e / 0.45, 1));
        const from = V(SLOT_POS.x, SLOT_POS.y + 0.10, SLOT_POS.z);
        tissuePaperG.position.copy(arcPos(from, DESK_REST, k, 0.03));
        paperFlat.rotation.x = -Math.PI / 2 * k;
        if (e >= 0.45) {
            tissuePaperG.position.copy(DESK_REST);
            paperFlat.rotation.x = -Math.PI / 2;
            s.phase = 'rest';
        }
    } else if (s.phase === 'crumple') {
        const k = smooth(Math.min(e / 0.70, 1));
        const sc = 1 - 0.85 * k;
        paperFlat.scale.set(sc, sc, 1);
        paperFlat.rotation.z = Math.sin(e * 22) * 0.30 * k;
        paperFlat.position.x = Math.sin(e * 31) * 0.012 * k;
        paperFlat.position.y = Math.sin(e * 27) * 0.006 * k;
        paperBallFly.visible = true;
        paperBallFly.scale.setScalar(0.15 + 0.85 * k);
        paperBallFly.rotation.y += dt * 7;
        paperBallFly.rotation.x += dt * 4;
        if (e >= 0.70) {
            paperFlat.visible = false;
            paperFlat.scale.set(1, 1, 1);
            paperFlat.rotation.set(-Math.PI / 2, 0, 0);
            paperFlat.position.set(0, 0, 0);
            s.phase = 'toss';
            s.t = 0;
        }
    } else if (s.phase === 'toss') {
        const k = smooth(Math.min(e / 1.15, 1));
        tissuePaperG.position.copy(arcPos(DESK_REST, BIN_MOUTH, k, 1.2));
        paperBallFly.rotation.x += dt * 9;
        paperBallFly.rotation.y += dt * 6;
        if (e >= 1.15) {
            s.phase = 'drop';
            s.t = 0;
        }
    } else if (s.phase === 'drop') {
        const k = smooth(Math.min(e / 0.5, 1));
        tissuePaperG.position.lerpVectors(BIN_MOUTH, BIN_FALL, k);
        paperBallFly.rotation.x += dt * 6;
        if (k > 0.7) {
            paperBallFly.scale.setScalar(Math.max(0.001, 1 - (k - 0.7) / 0.3));
        }
        if (e >= 0.5) {
            tissuePaperG.visible = false;
            paperBallFly.scale.setScalar(1);
            s.phase = 'idle';
        }
    }
}

export default defineProp({
  id: 'floor2/tissue-box',
  kind: 'decor',

  /** 原 `const tissueState = { phase: 'idle', t: 0 }` + `let standbyAnimT = -1` */
  state: () => ({ phase: 'idle', t: 0, standbyT: -1 }),

  build({ scene, L, V, cbox, crboxCol, iline, crumpleBall }) {
    // 重命名解构：把 layout 常量名映射回原实现的标识符名（几何代码因此逐字不变）
    const { TISSUE_X, TISSUE_Z, TBL_TOP } = L
    const { BIN_X, BIN_Z, BIN_H, FY } = L

    const tissueBoxG = new THREE.Group();
    tissueBoxG.position.set(TISSUE_X, TBL_TOP, TISSUE_Z);
    tissueBoxG.rotation.y = 0.22;
    scene.add(tissueBoxG);
    let standbyPaper = null;
    {
        const body = crboxCol(0.22, 0.13, 0.16, 0.015, 0xa9c29b);
        body.position.y = 0.065;
        tissueBoxG.add(body);
        const slot = cbox(0.13, 0.008, 0.03, 0x4e5a4e);
        slot.position.y = 0.132;
        tissueBoxG.add(slot);
        standbyPaper = new THREE.Group();
        const sb = crboxCol(0.10, 0.07, 0.005, 0.004, 0xfdfdf6);
        standbyPaper.add(sb);
        standbyPaper.add(iline([[-0.03, -0.028, 0.004], [0.032, -0.028, 0.004]]));
        standbyPaper.position.set(0, 0.168, 0);
        standbyPaper.rotation.x = 0.06;
        tissueBoxG.add(standbyPaper);
    }
    const SLOT_POS = V(TISSUE_X, TBL_TOP + 0.135, TISSUE_Z);
    const DESK_REST = V(2.05, TBL_TOP + 0.008, -2.00);
    const BIN_MOUTH = V(BIN_X, FY + BIN_H + 0.10, BIN_Z);
    const BIN_FALL = V(BIN_X, FY + 0.18, BIN_Z);
    const tissuePaperG = new THREE.Group();
    tissuePaperG.visible = false;
    scene.add(tissuePaperG);
    const paperFlat = new THREE.Group();
    {
        const sheet = crboxCol(0.10, 0.15, 0.005, 0.004, 0xfdfdf6);
        sheet.position.y = 0.075;
        paperFlat.add(sheet);
        paperFlat.add(iline([[-0.025, 0.03, 0.004], [-0.032, 0.12, 0.004]]));
        paperFlat.add(iline([[0.025, 0.03, 0.004], [0.018, 0.12, 0.004]]));
    }
    tissuePaperG.add(paperFlat);
    const paperBallFly = crumpleBall(0.05);
    paperBallFly.visible = false;
    tissuePaperG.add(paperBallFly);

    // 两个 Group + 四个推导坐标：`interactables()` 与 `update()` 都要用（见文件头「细节 1」）
    return {
      root: tissueBoxG,
      parts: {
        box: tissueBoxG, paper: tissuePaperG, flat: paperFlat, ball: paperBallFly, standby: standbyPaper,
        slot: SLOT_POS, desk: DESK_REST, mouth: BIN_MOUTH, fall: BIN_FALL,
      },
    }
  },

  /**
   * 两条 = 原两条 `regMagic`（一条一处，`label` 语义化 + `mode: 'both'`）。
   * 第一条是主入口（`installProp` 的 aim 桥把它接到 `tissueBoxG.userData.onClick`）；
   * 第二条（纸）在 `J3` 期间的 aim 缺口见文件头「细节 2」。
   */
  interactables: (s, { L, parts }) => [
    {
      id: 'tissue-box/pull',
      label: '从抽纸盒里抽一张纸',
      mode: 'both',
      // 锚点与几何同源：盒子就落在 L.TISSUE_X / L.TISSUE_Z（不变量 N9）
      anchor: { x: L.TISSUE_X, z: L.TISSUE_Z },
      radius: 1.6,
      onActivate: () => {
        // 原 `regMagic(tissueBoxG, function () { … })` 的函数体逐字搬运（名字按原名从 parts 解构回来）
        const tissuePaperG = parts.paper, paperFlat = parts.flat, paperBallFly = parts.ball, SLOT_POS = parts.slot;
        if (s.phase !== 'idle') return;
        s.phase = 'rise';
        s.t = 0;
        s.standbyT = 0;
        paperFlat.visible = true;
        paperFlat.scale.set(1, 0.15, 1);
        paperFlat.rotation.set(0, 0, 0);
        paperFlat.position.set(0, 0, 0);
        paperBallFly.visible = false;
        paperBallFly.scale.setScalar(1);
        tissuePaperG.rotation.set(0, 0.22, 0);
        tissuePaperG.position.copy(SLOT_POS);
        tissuePaperG.visible = true;
      },
    },
    {
      id: 'tissue-paper/crumple',
      label: '把摊在桌上的纸巾揉成团',
      // ★ `mode: 'aim'`（不是 both）：原实现这一条只有 `regMagic`（aim 通路），没有近距条目；
      //   而且纸巾多数时间 `visible = false` —— 给它一条常驻近距会让玩家站在书桌旁
      //   看到"把摊在桌上的纸巾揉成团"这条根本没东西可揉的提示。主入口是上面那条（`both`）。
      mode: 'aim',
      // 锚点与几何同源：纸巾摊在书桌上的落点就是 `DESK_REST`（`V(2.05, TBL_TOP + 0.008, -2.00)`）
      anchor: { x: parts.desk.x, z: parts.desk.z },
      radius: 1.6,
      onActivate: () => {
        // 原 `regMagic(tissuePaperG, function () { … })` 的函数体逐字搬运
        if (s.phase !== 'rest') return;
        s.phase = 'crumple';
        s.t = 0;
      },
    },
  ],

  /** 原 `tickOnce()` 里的 `updateTissue(time, dt);`，逐字搬运（见文件头上方的模块函数） */
  update(dt, time, s, env) {
    updateTissue(s, time, dt, env);
  },
})
