/**
 * 18.4 桌面玩具：台历（点击 → 翻过当月那一页，翻满 12 页后整体翻回 1 月） —— `J3` 搬迁（B5）
 *
 * 来源：`legacy/monolith.js` 原 `18.4` 分区里 `/* —— 台历（…）—— *\/` 那一小节
 * （2405–2590 行区间内：底座 + 前倾背板 + 转轴 + 12 页月历 canvas + `regMagic` +
 * `calZFor` + `updateCal`），以及 `tickOnce()` 里那一行 `updateCal(dt);`。
 *
 * ## 搬迁对照
 *
 * | 原来住哪 | 现在住哪 |
 * |---|---|
 * | 行内 `2.62` / `-2.34` | `world/layout.js` 的 `CAL_X` / `CAL_Z`（不变量 `N9`） |
 * | 顶层 `const calState = { month, phase, animT, animDur, animPage }` | `state()`（字段名不变） |
 * | `calPages` | `build()` 经 `parts.pages` 交出（**同一个数组实例**） |
 * | `calZFor(pg, rot)` | 模块作用域同名函数（多一个显式参数 `smooth`，函数体逐字未改） |
 * | `regMagic(calG, …)` | `interactables()`（`label` 语义化 + `mode: 'both'`） |
 * | `tickOnce()` 的 `updateCal(dt);` | `update()`（**原地 tick**，参数顺序 `(dt, time)`） |
 *
 * ## ★ `updateCal` 的形参知会
 *
 * 原名是 `updateCal(dt)`（**只有一个参数，就是 dt**），搬迁后是 `updateCal(s, dt, env)`；
 * 而 `defineProp` 的 `update(dt, time, s, ctx)` 第一个参数才是 `dt` ——
 * 所以 `update` 体里写的是 `updateCal(s, dt, env)`，`dt` 从第二位进（原 `tickOnce()` 的
 * 调用行也是 `updateCal(dt);`）⇒ 语义完全一致。
 *
 * ## rng
 *
 * 本件**完全不消耗随机源**（月历页的画布是纯函数式绘制）⇒ `rng` 调用序列一个字节没变。
 *
 * ## ctx 键
 *
 * `scene` / `L(CAL_X, CAL_Z, TBL_TOP)` / `MAT` / `smooth`（**只在 `update` 里解构** ——
 * `smooth` 在原 monolith 里住在 18.8 段，`build` 期间还在 TDZ）。
 */
import * as THREE from 'three'
import { defineProp } from '../../app/defineProp.js'

/** 原 `calZFor(pg, rot)`，逐字搬运（`smooth` 改为显式参数） */
// 根据当前旋转角计算页面沿杆的 z 偏移：
// 前半圈（页在前方）保持板前层叠位置，翻过顶部（rot > π）后平滑滑到板后层叠位置
function calZFor(pg, rot, smooth) {
    const kk = smooth(Math.max(0, Math.min(1, (rot - Math.PI) / Math.PI)));
    return pg.zInit + (pg.zFlip - pg.zInit) * kk;
}

/** 原 `updateCal(dt)`，逐字搬运（`calState` 以原名别住形参 `s`；`calPages` 从 `parts` 取） */
function updateCal(s, dt, env) {
    const { parts, smooth } = env;
    const calPages = parts.pages;
    const calState = s;   /* 原名别名：下面函数体逐字未改 */
    if (calState.phase === 'idle') return;
    calState.animT += dt;
    const e = calState.animT;
    const k = smooth(Math.min(e / calState.animDur, 1));
    if (calState.phase === 'flipping') {
        const pg = calState.animPage;
        const rot = pg.initRot + (pg.flippedRot - pg.initRot) * k;
        pg.grp.rotation.x = rot;
        pg.mesh.position.z = calZFor(pg, rot, smooth);
        if (e >= calState.animDur) {
            pg.grp.rotation.x = pg.flippedRot;
            pg.mesh.position.z = pg.zFlip;
            calState.month++;
            calState.phase = 'idle';
        }
    } else if (calState.phase === 'returning') {
        for (const pg of calPages) {
            const rot = pg.flippedRot + (pg.initRot - pg.flippedRot) * k;
            pg.grp.rotation.x = rot;
            pg.mesh.position.z = calZFor(pg, rot, smooth);
        }
        if (e >= calState.animDur) {
            for (const pg of calPages) {
                pg.grp.rotation.x = pg.initRot;
                pg.mesh.position.z = pg.zInit;
            }
            calState.month = 1;
            calState.phase = 'idle';
        }
    }
}

export default defineProp({
  id: 'floor2/calendar',
  kind: 'decor',

  /** 原 `const calState = { month: 1, phase: 'idle', animT: 0, animDur: 0.75, animPage: null }` */
  state: () => ({ month: 1, phase: 'idle', animT: 0, animDur: 0.75, animPage: null }),

  build({ scene, L, LITMAT, MAT }) {
    const { CAL_X, CAL_Z, TBL_TOP } = L

    const calG = new THREE.Group();
    calG.position.set(CAL_X, TBL_TOP, CAL_Z);
    calG.rotation.y = -0.18;
    scene.add(calG);
    const calPages = [];
    {
        function calBox(w, h, d, col) {
            const grp = new THREE.Group();
            const g = new THREE.BoxGeometry(w, h, d);
            grp.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: col, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })));
            grp.add(new THREE.LineSegments(new THREE.EdgesGeometry(g), MAT));
            return grp;
        }

        // 2026 年各月天数与 1 日星期（0 = 周日）
        const CAL_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        const CAL_FIRST = [4, 0, 0, 3, 5, 1, 3, 6, 2, 4, 0, 2];

        function drawCalPage(month, isFront) {
            const cv = document.createElement('canvas');
            cv.width = 128;
            cv.height = 88;
            const c = cv.getContext('2d');
            if (!isFront) {
                c.fillStyle = '#eae6da';
                c.fillRect(0, 0, 128, 88);
                c.strokeStyle = '#c9c2b0';
                c.lineWidth = 2;
                c.strokeRect(3, 3, 122, 82);
                c.fillStyle = '#b8b0a0';
                c.font = '11px serif';
                c.textAlign = 'center';
                c.textBaseline = 'middle';
                c.fillText('✦ Magic ✦', 64, 44);
                return new THREE.CanvasTexture(cv);
            }
            c.fillStyle = '#fdfdf8';
            c.fillRect(0, 0, 128, 88);
            // 标题栏
            c.fillStyle = '#7a3a4a';
            c.fillRect(0, 0, 128, 14);
            c.fillStyle = '#ffffff';
            c.font = 'bold 10px serif';
            c.textAlign = 'center';
            c.textBaseline = 'middle';
            c.fillText(month + ' 月', 64, 8);
            // 星期行
            const days = ['日', '一', '二', '三', '四', '五', '六'];
            c.textBaseline = 'alphabetic';
            c.font = '7px serif';
            for (let i = 0; i < 7; i++) {
                c.fillStyle = i === 0 ? '#c05a5a' : (i === 6 ? '#5a7ac0' : '#8a8a8a');
                c.fillText(days[i], 11 + i * 17.7, 24);
            }
            // 日期网格：按当月真实天数与首日星期排布（支持 6 行）
            const nDays = CAL_DAYS[month - 1];
            const first = CAL_FIRST[month - 1];
            c.font = '7.5px serif';
            for (let d = 1; d <= nDays; d++) {
                const cell = first + d - 1;
                const col = cell % 7;
                const row = Math.floor(cell / 7);
                c.fillStyle = col === 0 ? '#b04a4a' : (col === 6 ? '#4a6ab0' : '#444444');
                c.fillText(d.toString(), 11 + col * 17.7, 33 + row * 8.6);
            }
            return new THREE.CanvasTexture(cv);
        }

        // 底座
        const base = calBox(0.20, 0.024, 0.13, 0x8a6238);
        base.position.y = 0.012;
        calG.add(base);

        // 背板组（前倾 0.32 rad；组内背板为竖直板，y 0~0.14，厚 z ±0.006）
        const backG = new THREE.Group();
        backG.position.set(0, 0.024, -0.028);
        backG.rotation.x = 0.32;
        calG.add(backG);

        // 背板
        const board = calBox(0.19, 0.14, 0.012, 0xa07850);
        board.position.set(0, 0.07, 0);
        backG.add(board);

        // 转轴托块（连接板顶与横杆，位于页面两侧之外）
        for (const sx of [-1, 1]) {
            const lug = calBox(0.024, 0.022, 0.02, 0x8a6238);
            lug.position.set(sx * 0.086, 0.146, 0);
            backG.add(lug);
        }

        // 横杆：精确置于背板面顶端延长处（组内 (0, 0.152, 0)）
        const ROD_Y = 0.152, ROD_Z = 0;
        const rodGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.19, 6);
        rodGeo.rotateZ(Math.PI / 2);
        const rodMesh = new THREE.Mesh(rodGeo, LITMAT(0x5a3c1e, { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
        rodMesh.position.set(0, ROD_Y, ROD_Z);
        rodMesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(rodGeo, 10), MAT));
        backG.add(rodMesh);

        // 12 页月历：铰点 = 杆心。未翻时贴背板前面层叠（1 月最外、先翻），
        // 翻过后绕杆翻转近一整圈贴背板背面层叠（1 月最贴板）。
        const CAL_W = 0.16, CAL_H = 0.11, CAL_T = 0.0015;
        const pageSideMat = LITMAT(0xf0ede4);
        for (let i = 1; i <= 12; i++) {
            const pgG = new THREE.Group();
            pgG.position.set(0, ROD_Y, ROD_Z);
            const frontMat = new THREE.MeshBasicMaterial({ map: drawCalPage(i, true) });
            const backMat = new THREE.MeshBasicMaterial({ map: drawCalPage(i, false) });
            const pgGeo = new THREE.BoxGeometry(CAL_W, CAL_H, CAL_T);
            // 材质数组：index 5 (-z 面，朝书本) 正面月份；index 4 (+z 面) 背面装饰
            const pgMesh = new THREE.Mesh(pgGeo, [pageSideMat, pageSideMat, pageSideMat, pageSideMat, backMat, frontMat]);
            const zInit = -0.0085 - (12 - i) * 0.0016;  // 板前层叠：12 月贴板，1 月最外
            const zFlip = 0.0085 + (i - 1) * 0.0016;    // 板后层叠：1 月贴板背，12 月最外
            pgMesh.position.set(0, -CAL_H / 2, zInit);
            pgMesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(pgGeo), MAT));
            pgG.add(pgMesh);
            backG.add(pgG);
            calPages.push({
                grp: pgG,
                mesh: pgMesh,
                zInit: zInit,
                zFlip: zFlip,
                initRot: 0,
                flippedRot: Math.PI * 2 - 0.03 - (i - 1) * 0.004
            });
        }
    }

    return { root: calG, parts: { body: calG, pages: calPages } }
  },

  /** 原 `regMagic(calG, …)` 的替身（`label` 语义化 + `mode: 'both'`，消解风险 `R1`） */
  interactables: (s, { L, parts }) => [{
    id: 'calendar/flip-page',
    label: '翻一页桌上的台历',
    mode: 'both',
    // 锚点与几何同源：台历就在 `CAL_X / CAL_Z`（不变量 N9）
    anchor: { x: L.CAL_X, z: L.CAL_Z },
    radius: 1.5,
    onActivate: () => {
      if (s.phase !== 'idle') return;
      if (s.month <= 12) {
        s.phase = 'flipping';
        s.animPage = parts.pages[s.month - 1];
        s.animT = 0;
        s.animDur = 0.75;
      } else {
        s.phase = 'returning';
        s.animT = 0;
        s.animDur = 0.9;
      }
    },
  }],

  /** 原 `tickOnce()` 里那行 `updateCal(dt);`，逐字搬运 */
  update(dt, time, s, env) {
    updateCal(s, dt, env);
  },
})
