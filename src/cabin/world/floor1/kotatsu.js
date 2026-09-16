/**
 * 12.13 暖桌（八角桌板 + 等腰梯形垂帘 + 四角倒三角）+ 收音机 + 果盆橘子 + 方坐垫
 * —— `J4.28` 升格 `defineProp`
 *
 * 来源：`legacy/monolith.js` 原 `12.13` 分区（`J3` 记的 L1433–1651）的**几何段**，
 * 以及 `tickOnce()` 里那**三段连续的每帧分支**（`J3` 记的 L6568 / L6599 / L6623）。
 * 交互来自 4 处 `regMagic`（桌体 / 收音机 / 橘子 / 坐垫 ×2 共 5 条）。
 *
 * ## ★ `J4.18` 契约的第五个真实用户（光源**槽位 3**）—— 也是最后一个一楼光源件
 *
 * `floor1-kotatsu.SKIP.md` 记了**两条各自独立的硬阻塞**，本任务把它们**都**解决了：
 *
 * | `J3` 记的阻塞 | 本任务之后 |
 * |---|---|
 * | **阻塞一**：`kotatsuOn` 是光照场第 3 槽的强度输入，而 `ptKot += …` 住在替换区间之外 | ✅ `J4.18` 的 `slot: 3` + `strength: () => s.pt * (…)`，`ptKot` 中间量消失 |
 * | **阻塞二**：`makeCup` 是 12.9f 长餐桌分的产物（跨分区复用） | ✅ `J4.26` 抽出的 `props/cup.js` 共享工厂 —— 本件经装配选项拿到 `cupFactory` |
 *
 * ## 搬迁对照
 *
 * | 原来住哪 | 现在住哪 |
 * |---|---|
 * | `ctx.kotatsuOn`（`true`）/ `ctx.radioNoteRun`（`0`）/ `ctx.orangeState`（`'inbowl'`）/ `ctx.orangeT`（`0`） | `state` 的同名字段（`on` / `noteRun` / `oState` / `oT`，**初值一个没改**） |
 * | `ctx.ptKot`（`WeatherSystem.js` 初值 `1`） | `state.pt`（**同一个初值**） |
 * | `ctx.ptKot += …`（`tickOnce()` 末尾那 5 行之一） | `update()` 的最后一段（见下 ★） |
 * | `kotatsuG` / `kotBody` / `kotGlowMat` / `radioG` / `noteMat` / `radioNotes` / `oranges` / `cushions` | `build()` 内的同名局部量，经 `parts` 交出（**同一个实例**） |
 * | `FB_X` / `FB_Z` / `OR` / `makeCushion`（局部） | 留在 `build()` 内（只有本件用） |
 * | `ctx._tv`（**茶壶段**的临时向量） | ★ **本件私有**的 `new THREE.Vector3()`（见下 ⚠️） |
 * | 末尾硬编码的 `lightField.register(… 'floor1/kotatsu' …)` | `lights()`：`slot: 3` + `strength` **逐字照搬**（含那串 `0.82 + 0.18 * (0.5 + 0.5 * Math.sin(time * 4.2))`） |
 * | 4 处 `regMagic` | `interactables()`：**5 条**（坐垫 2 只各一条） |
 * | `tickOnce()` 里的 `frame/31` / `frame/32` / `frame/33` | `update()` 的前三段 |
 *
 * ## ⚠️ `_tv` 私有化（`SKIP` 明确要求的前置之一）
 *
 * 原实现里 `ctx._tv` 是**茶壶段**创建的临时向量，却有**两个**读者：
 * 暖桌的收音机音符（原 `frame/31`）与提梁茶壶的溪流（原 `frame/47` 一带）。
 * `SKIP` 的原话：「`_tv` 私有化（每件一个 `THREE.Vector3`，暖桌那份归暖桌）——
 * 否则茶壶与暖桌抢同一个临时量」。
 *
 * 本件照办：`build` 里造一个**自己的** `_tv` 经 `parts` 交出；`ctx._tv` **原样保留**
 * （茶壶那一半仍用它，留待 `floor1/teapot` 组处理）。
 * ⇒ 两件从此不再共用同一个可变临时量（**这是本任务顺带消除的一处跨件耦合**）。
 *
 * ## ★ 帧顺序：三段合并 + `ptKot` 提前，为什么等价
 *
 * 三段在原 `tickOnce()` 里是 `frame/31` / `frame/32` / `frame/33`，**相邻**（中间没有别的帧任务）
 * ⇒ 合并成一个 `update` 后**每帧执行序列不变**；合并后只在 `frame/31` 的位置登记一次。
 *
 * 而 `ptKot` 的平滑原本在 `frame/94`（`lightField.update` 是 `frame/97`）⇒ 合并后会**提前**执行。
 * 等价性两条（同 `hangingLantern.js`）：① 一阶低通 `p += (目标 − p) × 0.07`，同帧同 `dt` 同输入
 * ⇒ 逐位相同，而 `grep kotatsuOn` 的全部命中只有本件（外加 `frame/97` 才被调用的 `lights()` 闭包）
 * ⇒ **两位置之间无读者/写者**；② 本 `update` 在 `frame/31` 位置，远早于 `frame/97`。
 *
 * ## 一处**去掉的死代码**（有论证）
 *
 * 原 `frame/31` 开头是 `if (ctx.kotGlowMat) { … }` —— 而 `kotGlowMat` 初始为 `null`、
 * 在**同一段**（`installFloor1`，段 08）里才被赋值为材质，而帧体在**段 20** 装配
 * ⇒ 首次运行 `frame/31` 时它**必然非 null**，那个判空**从不生效**。
 * 本件直写 `parts.kotGlowMat.opacity = …`（去掉判空，行为等价）。
 *
 * ## 逐字搬运说明
 *
 * 几何与三段**逐行相同**（只改缩进与状态前缀）。全部数值（八角桌板 `C=0.595` / `0.165` /
 * `depth 0.055`、桌腿 `0.07×0.40×0.07` 与 `±0.42`、垂帘 `wt=0.87` / `tilt=0.16` / `topY=0.405` /
 * `Lc=0.38` / `depth 0.03` / 裙摆 25 点 `sin(t2×π×5)×0.012`、四角倒三角、暖光 `0.52/24` 与 `0.015`、
 * 收音机 `0.20×0.115×0.10` 与旋钮/天线、4 个音符的头部 13 点与符干、果盆 Lathe 剖面 6 点与三圈环、
 * 橘子 `OR=0.033` / `RA=0.075` / `homes` 6 组 / `rolls` 6 组、坐垫 `0.44×0.085×0.44` 等、
 * 每帧的 `4.2` / `0.55` / `0.85` / `0.7` / `0.15` / `0.28` / `0.030` / `0.025` / `0.6` / `0.25` /
 * `0.085` / `0.65` / `0.09` / `2.2` / `0.24` / `0.125` / `0.07`）**一个没改**。
 *
 * ⚠️ 本件**不消耗 `rng`**（原段没有任何 `floor1Rng()` 调用）。
 */
import * as THREE from 'three'
import { defineProp } from '../../app/defineProp.js'
import { createPointLightSource } from '../../core/lighting/PointLightSource.js'

export default defineProp({
  id: 'floor1/kotatsu',
  kind: 'furniture',

  // 四个状态量的**初值与原名一一对应**：`kotatsuOn:true` / `radioNoteRun:0` /
  // `orangeState:'inbowl'` / `orangeT:0`；`pt` 是原来的 `ctx.ptKot`（初值 `1`）。
  state: () => ({ on: true, noteRun: 0, oState: 'inbowl', oT: 0, pt: 1 }),

  build({ scene, L, put, box, edge, solid, lloop, line, logBetween, geo, LITMAT, FILL, cupFactory }) {
    const { KOT_X, KOT_Z, KTOP } = L

    const kotatsuG = new THREE.Group();
    kotatsuG.position.set(KOT_X, 0, KOT_Z);
    kotatsuG.rotation.y = 0.22;
    scene.add(kotatsuG);

    const kotBody = new THREE.Group();
    kotatsuG.add(kotBody);
    let kotGlowMat;
    {
        const tilt = 0.16;
        const C = 0.595;
        const topY = 0.405;
        const Lc = 0.38;
        const bz = C + Lc * Math.sin(tilt);
        const wt = 0.87;
        const wb = 2 * bz;

        const topShape = new THREE.Shape();
        topShape.moveTo(-C, -(C - 0.165));
        topShape.lineTo(-(C - 0.165), -C);
        topShape.lineTo((C - 0.165), -C);
        topShape.lineTo(C, -(C - 0.165));
        topShape.lineTo(C, (C - 0.165));
        topShape.lineTo((C - 0.165), C);
        topShape.lineTo(-(C - 0.165), C);
        topShape.lineTo(-C, (C - 0.165));
        topShape.closePath();
        const topGeo = new THREE.ExtrudeGeometry(topShape, { depth: 0.055, bevelEnabled: false });
        topGeo.rotateX(-Math.PI / 2);
        put(edge(topGeo), 0, KTOP - 0.055, 0, 0, 0, 0, kotBody);

        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]])
            put(box(0.07, 0.40, 0.07), sx * 0.42, 0.20, sz * 0.42, 0, 0, 0, kotBody);

        const quiltMat = LITMAT(0xc4a484, { side: THREE.DoubleSide });
        const trapShape = new THREE.Shape();
        trapShape.moveTo(-wt / 2, 0);
        trapShape.lineTo(wt / 2, 0);
        trapShape.lineTo(wb / 2, -Lc);
        trapShape.lineTo(-wb / 2, -Lc);
        trapShape.closePath();
        const trapGeo = new THREE.ExtrudeGeometry(trapShape, { depth: 0.03, bevelEnabled: false });
        function makeCurtain() {
            const g = solid(trapGeo, quiltMat);
            for (const s of [-0.22, 0.22])
                put(line([[s, -0.035, 0.034], [s, -Lc + 0.05, 0.034]]), 0, 0, 0, 0, 0, 0, g);
            const hem = [];
            for (let i = 0; i <= 24; i++) {
                const t2 = i / 24;
                hem.push([-wb / 2 + t2 * wb, -Lc + Math.sin(t2 * Math.PI * 5) * 0.012, 0.034]);
            }
            put(line(hem), 0, 0, 0, 0, 0, 0, g);
            return g;
        }
        for (const ry of [0, Math.PI, Math.PI / 2, -Math.PI / 2]) {
            const w = new THREE.Group();
            w.rotation.y = ry;
            kotBody.add(w);
            put(makeCurtain(), 0, topY, C, -tilt, 0, 0, w);
        }

        const yBot = topY - Lc * Math.cos(tilt);
        for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
            const P1 = [sx * (wt / 2), topY, sz * C];
            const P2 = [sx * C, topY, sz * (wt / 2)];
            const P3 = [sx * bz, yBot, sz * bz];
            const triGeo = new THREE.BufferGeometry();
            triGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
                P1[0], P1[1], P1[2],
                P2[0], P2[1], P2[2],
                P3[0], P3[1], P3[2]
            ]), 3));
            triGeo.computeVertexNormals();
            kotBody.add(solid(triGeo, quiltMat));
        }

        kotGlowMat = new THREE.MeshBasicMaterial({
            color: 0xffab5e, transparent: true, opacity: 0.10, depthWrite: false, side: THREE.DoubleSide
        });
        const kotGlow = new THREE.Mesh(new THREE.CircleGeometry(0.52, 24), kotGlowMat);
        kotGlow.userData.noHit = true;
        put(kotGlow, 0, 0.015, 0, -Math.PI / 2, 0, 0, kotBody);
    }

    /* —— 收音机（点击播放音符）—— */
    const radioG = new THREE.Group();
    radioG.position.set(-0.34, KTOP, 0.30);
    radioG.rotation.y = -0.45;
    kotatsuG.add(radioG);
    {
        const woodMat = LITMAT(0x8f6b4e, { side: THREE.DoubleSide });
        put(solid(new THREE.BoxGeometry(0.20, 0.115, 0.10), woodMat), 0, 0.0575, 0, 0, 0, 0, radioG);
        for (let i = 0; i < 4; i++)
            put(line([[-0.075, 0.032 + i * 0.018, 0.052], [-0.005, 0.032 + i * 0.018, 0.052]]), 0, 0, 0, 0, 0, 0, radioG);
        put(line([[-0.078, 0.026, 0.052], [-0.078, 0.092, 0.052]]), 0, 0, 0, 0, 0, 0, radioG);
        put(line([[-0.002, 0.026, 0.052], [-0.002, 0.092, 0.052]]), 0, 0, 0, 0, 0, 0, radioG);
        put(edge(new THREE.CylinderGeometry(0.014, 0.014, 0.012, 8)),
            0.035, 0.080, 0.052, Math.PI / 2, 0, 0, radioG);
        put(edge(new THREE.CylinderGeometry(0.011, 0.011, 0.012, 8)),
            0.070, 0.080, 0.052, Math.PI / 2, 0, 0, radioG);
        logBetween([0.085, 0.11, 0], [0.150, 0.235, -0.01], 0.005, radioG);
        const noteSrc = new THREE.Object3D();
        noteSrc.position.set(0.150, 0.245, -0.01);
        radioG.add(noteSrc);
        radioG.userData.noteSrc = noteSrc;
    }
    const noteMat = new THREE.LineBasicMaterial({ color: 0x6b4ea8, transparent: true, opacity: 0 });
    const radioNotes = [];
    for (let i = 0; i < 4; i++) {
        const g = new THREE.Group();
        const head = [];
        for (let k = 0; k <= 12; k++) { const a = k / 12 * Math.PI * 2; head.push([Math.cos(a) * 0.013, Math.sin(a) * 0.009, 0]); }
        g.add(new THREE.LineLoop(geo(head), noteMat));
        g.add(new THREE.Line(geo([[0.011, 0.007, 0], [0.011, 0.052, 0]]), noteMat));
        g.add(new THREE.Line(geo([[0.011, 0.052, 0], [0.024, 0.044, 0]]), noteMat));
        g.visible = false;
        scene.add(g);
        radioNotes.push({ g, ph: i / 4 });
    }

    /* —— 果盆 + 橘子 6 颗 —— */
    const FB_X = -0.24, FB_Z = 0.10;
    {
        const BP = [[0.055, 0], [0.07, 0.018], [0.10, 0.038], [0.14, 0.058], [0.165, 0.078], [0.155, 0.082]];
        put(new THREE.Mesh(new THREE.LatheGeometry(BP.map(p => new THREE.Vector2(p[0], p[1])), 18), FILL),
            FB_X, KTOP, FB_Z, 0, 0, 0, kotatsuG);
        for (const [ry, rr] of [[0.038, 0.10], [0.078, 0.165], [0.082, 0.155]]) {
            const pts = [];
            for (let k = 0; k <= 18; k++) { const a = k / 18 * Math.PI * 2; pts.push([FB_X + Math.cos(a) * rr, KTOP + ry, FB_Z + Math.sin(a) * rr]); }
            lloop(pts, kotatsuG);
        }
        for (const ang of [0, 2.1, 4.2]) {
            const c = Math.cos(ang), s = Math.sin(ang);
            put(line(BP.map(([px, py]) => [FB_X + c * px, KTOP + py, FB_Z + s * px])), 0, 0, 0, 0, 0, 0, kotatsuG);
        }
    }
    const oranges = [];
    const OR = 0.033;
    let orangeG;
    {
        orangeG = new THREE.Group();
        orangeG.position.set(FB_X, KTOP, FB_Z);
        kotatsuG.add(orangeG);
        const oMat = LITMAT(0xe8963c);
        const oMat2 = LITMAT(0xf0a44f);
        const RA = 0.075;
        const homes = [
            [RA, 0.000, 0.050],
            [RA * Math.cos(1.2566), RA * Math.sin(1.2566), 0.050],
            [RA * Math.cos(2.5133), RA * Math.sin(2.5133), 0.050],
            [RA * Math.cos(3.7699), RA * Math.sin(3.7699), 0.050],
            [RA * Math.cos(5.0265), RA * Math.sin(5.0265), 0.050],
            [0.000, 0.000, 0.102]
        ];
        const rolls = [
            [0.42, -0.36],
            [0.42, -0.12],
            [0.42, 0.12],
            [0.42, 0.36],
            [0.55, -0.24],
            [0.55, 0.02]
        ];
        for (let i = 0; i < 6; i++) {
            const mesh = solid(new THREE.SphereGeometry(OR, 10, 8), i % 2 ? oMat2 : oMat);
            const hx = homes[i][0], hy = homes[i][2], hz = homes[i][1];
            const tx = rolls[i][0], tz = rolls[i][1];
            mesh.position.set(hx, hy, hz);
            orangeG.add(mesh);
            const dx = tx - hx, dz = tz - hz;
            oranges.push({ mesh, hx, hy, hz, tx, ty: OR, tz, ax: dz / OR, az: -dx / OR });
        }
        const stem = solid(new THREE.CylinderGeometry(0.004, 0.004, 0.016, 5),
            LITMAT(0x7a5230));
        put(stem, 0, 0.038, 0, 0, 0, 0, oranges[5].mesh);
    }

    /* —— 茶杯 ×2（经 J4.26 的共享工厂；`cups` 是同一个数组，每帧动画一并覆盖）—— */
    cupFactory.makeCup(-0.34, -0.34, KTOP, kotatsuG);
    cupFactory.makeCup(-0.14, -0.44, KTOP, kotatsuG);

    /* —— 方坐垫 ×2 —— */
    const cushions = [];
    function makeCushion(x, z, ry, col, colBottom) {
        const g = new THREE.Group();
        const m = new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide });
        const m2 = new THREE.MeshBasicMaterial({ color: colBottom, side: THREE.DoubleSide });
        put(solid(new THREE.BoxGeometry(0.44, 0.085, 0.44), m), 0, 0.048, 0, 0, 0, 0, g);
        put(solid(new THREE.BoxGeometry(0.36, 0.032, 0.36), m), 0, 0.098, 0, 0, 0, 0, g);
        put(solid(new THREE.BoxGeometry(0.44, 0.014, 0.44), m2), 0, 0.008, 0, 0, 0, 0, g);
        put(edge(new THREE.CylinderGeometry(0.02, 0.02, 0.012, 8)), 0, 0.118, 0, 0, 0, 0, g);
        for (let k = 0; k < 4; k++) {
            const a = k / 4 * Math.PI * 2 + Math.PI / 4;
            put(line([[Math.cos(a) * 0.04, 0.115, Math.sin(a) * 0.04],
            [Math.cos(a) * 0.15, 0.102, Math.sin(a) * 0.15]]), 0, 0, 0, 0, 0, 0, g);
        }
        g.position.set(x, 0, z);
        g.rotation.y = ry;
        kotatsuG.add(g);
        const c = { g, anim: 0, p: 0, from: 0, to: 0 };
        cushions.push(c);
    }
    makeCushion(0.00, 0.98, 0.12, 0xd98a94, 0xb96a75);
    makeCushion(-0.98, 0.02, 1.62, 0x8fae6e, 0x74915a);

    return {
      root: kotatsuG,
      parts: {
        kotatsuG, kotBody, kotGlowMat, radioG, noteMat, radioNotes, oranges, orangeG, cushions,
        /** ★ 本件**私有**的临时向量（取代原来与提梁茶壶共用的 `ctx._tv`） */
        _tv: new THREE.Vector3(),
      },
    }
  },

  /**
   * ★ 光源槽位 3 —— 取代 `world/lights.js` 里原来那一行注册。
   * `slot` 显式声明 ⇒ 槽序与装配时机无关（`J4.18` 契约）。
   * 位置 / 颜色 / 半径 / `yMin` / `yMax` 与那一行**逐字相同**，
   * 强度表达式（含 `0.82 + 0.18 * (0.5 + 0.5 * Math.sin(time * 4.2))`）也**逐字照搬**。
   */
  lights: (s, { L }) => [
    createPointLightSource({
      id: 'floor1/kotatsu', slot: 3,
      position: [L.KOT_X, 0.48, L.KOT_Z], color: 0xffa858, radius: 4.2,
      strength: (time) => s.pt * (0.82 + 0.18 * (0.5 + 0.5 * Math.sin(time * 4.2))),
      yMin: 0.0, yMax: 3.04,
    }),
  ],

  // 原 4 处 `regMagic` 的等价声明（坐垫那两条原本就在 `makeCushion` 里逐只注册 ⇒ 共 5 条）。
  // 锚点与几何**同源**：整车都在 `layout.KOT_X` / `KOT_Z` 上（不变量 `N9`）。
  interactables: (s, { L, parts }) => [
    {
      id: 'kotatsu/toggle', label: '打开 / 关闭暖桌的暖光',
      mode: 'both', anchor: { x: L.KOT_X, z: L.KOT_Z }, radius: 2.2,
      hits: parts.kotBody,
      onActivate: () => { s.on = !s.on },
    },
    {
      id: 'kotatsu/radio', label: '拧开暖桌上的收音机',
      mode: 'both', anchor: { x: L.KOT_X, z: L.KOT_Z }, radius: 2.2,
      hits: parts.radioG,
      onActivate: () => { s.noteRun = 3.2 },
    },
    {
      id: 'kotatsu/oranges', label: '让果盆里的橘子滚上桌面 / 滚回盆里',
      mode: 'both', anchor: { x: L.KOT_X, z: L.KOT_Z }, radius: 2.2,
      hits: parts.orangeG,
      onActivate: () => {
        if (s.oState === 'inbowl') { s.oState = 'out'; s.oT = 0 }
        else if (s.oState === 'rolled') { s.oState = 'back'; s.oT = 0 }
      },
    },
    ...parts.cushions.map((c, i) => ({
      id: `kotatsu/cushion-${i + 1}`,
      label: i === 0 ? '把靠里的方坐垫翻个面' : '把靠门的方坐垫翻个面',
      mode: 'both',
      // 锚点与几何同源：坐垫自己的落点（`makeCushion(x, z, …)` 的 x/z）
      anchor: { x: L.KOT_X + c.g.position.x, z: L.KOT_Z + c.g.position.z },
      radius: 1.3,
      hits: c.g,
      onActivate: () => {
        if (c.anim === 0) {
          c.from = c.to;
          c.to = c.to > Math.PI / 2 ? 0 : Math.PI;
          c.anim = 1; c.p = 0;
        }
      },
    })),
  ],

  /**
   * 原 `tickOnce()` 里的三段（`frame/31` / `frame/32` / `frame/33`）+ `frame/94` 的强度平滑。
   * 分段与顺序**逐字保留**（合并理由见文件头）。
   */
  update(dt, time, s, { parts }) {
    const { kotGlowMat, radioNotes, noteMat, radioG, oranges, cushions, _tv } = parts

    /* ---- ㉛ 暖光呼吸 + 收音机音符 ---- */
    {
        // ★ 原代码这里是 `if (ctx.kotGlowMat) { … }` —— 那个判空从不生效（见文件头「一处去掉的死代码」）
        kotGlowMat.opacity = s.on ? 0.07 + 0.05 * (0.5 + 0.5 * Math.sin(time * 4.2)) : 0;
        if (s.noteRun > 0) {
            s.noteRun -= dt;
            for (const nt of radioNotes) {
                const p = (time * 0.55 + nt.ph) % 1;
                if (p < 0.85) {
                    nt.g.visible = true;
                    const env = Math.min(p * 7, 1) * (1 - Math.max(0, (p - 0.7) / 0.15));
                    noteMat.opacity = 0.9 * env;
                    const src = radioG.userData.noteSrc;
                    src.getWorldPosition(_tv);
                    nt.g.position.set(
                        _tv.x + Math.sin(time * 2 + nt.ph * 6) * 0.030 + p * 0.06,
                        _tv.y + p * 0.28,
                        _tv.z + Math.cos(time * 1.6 + nt.ph * 5) * 0.025
                    );
                    nt.g.rotation.y = Math.sin(time * 3 + nt.ph * 4) * 0.6;
                    nt.g.rotation.z = Math.sin(time * 2.5 + nt.ph * 3) * 0.25;
                } else {
                    nt.g.visible = false;
                }
            }
        } else {
            for (const nt of radioNotes) nt.g.visible = false;
        }
    }

    /* ---- ㉜ 橘子：盆内 ⇄ 滚上桌面 ---- */
    {
        const n = oranges.length;
        if (s.oState === 'out' || s.oState === 'back') {
            s.oT += dt;
            let done = true;
            for (let i = 0; i < n; i++) {
                const o = oranges[i];
                const delay = i * 0.085;
                let p = Math.min(Math.max((s.oT - delay) / 0.65, 0), 1);
                if (p < 1) done = false;
                const e = p * p * (3 - 2 * p);
                const f = s.oState === 'out' ? e : 1 - e;
                o.mesh.position.set(
                    o.hx + (o.tx - o.hx) * f,
                    o.hy + (o.ty - o.hy) * f + Math.sin(f * Math.PI) * 0.09,
                    o.hz + (o.tz - o.hz) * f
                );
                o.mesh.rotation.set(o.ax * f, 0, o.az * f);
            }
            if (done) s.oState = s.oState === 'out' ? 'rolled' : 'inbowl';
        }
    }

    /* ---- ㉝ 坐垫：水平翻滚 180° ---- */
    {
        for (const c of cushions) {
            if (c.anim) {
                c.p += dt * 2.2;
                if (c.p >= 1) { c.p = 1; c.anim = 0; }
                const e = c.p * c.p * (3 - 2 * c.p);
                const ang = c.from + (c.to - c.from) * e;
                c.g.rotation.x = ang;
                c.g.position.y = Math.sin(c.p * Math.PI) * 0.24 + (ang / Math.PI) * 0.125;
            }
        }
    }

    /* ---- ⑨④ 强度平滑（原 `tickOnce()` 末尾「室内点光源」那 5 行之一）----
     * ★ 原本排在 `frame/94`，合并到本 `update` 后**提前**执行 —— 等价性论证见文件头。 */
    s.pt += ((s.on ? 1 : 0) - s.pt) * 0.07;
  },
})
