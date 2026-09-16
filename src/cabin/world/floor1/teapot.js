/**
 * 12.9f 提梁茶壶 —— `J4.34` 升格 `defineProp`
 *
 * 来源：`legacy/monolith.js` 原 `/* ---- 提梁茶壶 ---- *\/` 分区（`J3` 记的 L1119–1169）的
 * **几何段**，以及 `tickOnce()` 里 `frame/47` 那段每帧分支（`J3` 记的 L6773–6826）。
 *
 * ## ★ `teapot` 组的**另一半**（本件完成该组）
 *
 * `floor1-teapot.SKIP.md` 把这一带判为"互相咬合的三块"，并指出两块前置：
 *
 * | `SKIP` 记的前置 | 现在 |
 * |---|---|
 * | ① `makeCup` / `cups` 抽成共享工厂（`cups` 被暖桌与茶壶共用） | ✅ `J4.26` 抽出 `props/cup.js`；本件经**装配选项** `{ ctx: { cupFactory } }` 拿到它 |
 * | ② `_tv` 私有化（原 `ctx._tv` 被茶壶与暖桌抢） | ✅ `J4.28` 已让暖桌自造私有临时量；**本件照做** ⇒ `ctx._tv` 这个共享临时量**从此消失** |
 *
 * 另一半 `floor1/dining-chairs`（12.9f 余段的 5 把椅子）已由 `J4.33` 完成。
 *
 * ## 与茶杯的**边界**（为什么茶杯的摆放不搬进来）
 *
 * 3 只茶杯的摆放（`cupFactory.makeCup(DT_X ± 0.85, DT_Z + 0.20)` ×3）**留在 `install.js`** ——
 * 它们是**长餐桌**上的陈设（坐标取自 `DT_X/DT_Z`），本件只是**借用其中一只**当倒水目标
 * （`const CUP_T = cups[2]`，与原实现一致）。
 * `CUP_T` 存的是**对象引用**，茶杯被点击升腾时它的 `position` 是活的 ⇒ 每帧读到的仍是最新位置。
 *
 * ## 搬迁对照
 *
 * | 原来住哪 | 现在住哪 |
 * |---|---|
 * | `ctx.potRun` | `state.potRun`（初值 `0`） |
 * | `ctx.POT_BX/POT_BZ/POT_RY/POT_TILT/POT_TIP_FWD/POT_T/CUP_T` | `build()` 内的同名局部量，经 `parts.consts` 交出 |
 * | `ctx.teapotPos` / `ctx.teapot` / `ctx.potHalo` / `ctx.potHaloMat` / `ctx.potSpoutTip` / `ctx.potStream` / `ctx.potStreamGeom` | `build()` 内的同名局部量，经 `parts` 交出（**同一个实例**） |
 * | `ctx._tv`（**与暖桌共用的临时向量**） | ★ **本件私有**的 `new THREE.Vector3()`（见上 §★ 前置②） |
 * | `ctx.regMagic(teapotPos, …)` | `interactables()`：一条（`mode: 'both'`） |
 * | `tickOnce()` 里的 `frame/47` | `update()`（**逐字搬运**） |
 *
 * ## ⚠️ `ctx.D2R` 的处理
 *
 * 原几何段用 `(20 + i * 14) * ctx.D2R`（提梁弧线的 11 个采样点），而 `D2R` 定义在
 * **文件早段**（`const RAIL_R = 1.24, RAIL_H = 0.85, D2R = Math.PI / 180;`），
 * **不在装配环境里**。`SKIP` 给的处置是"在模块里自己写 `const D2R = Math.PI / 180;`（同值，零差异）"
 * —— 本件照办，且**只在本模块内可见**（不污染 `ctx`）。
 *
 * ## ⚠️ `DT_*` 与 `DTOP` 的取值
 *
 * 装配环境（`propCtx`）里**没有** `context.DT_X` 这类展开键，只有 `L`（layout 对象）
 * ⇒ 一律写 `L.DT_X` / `L.DT_Z` / `L.DTOP`（不变量 `N9`，数值一个没改）。
 *
 * ## 逐字搬运说明
 *
 * 几何与每帧**逐行相同**：壶身 `0.105/14/11` 与 `scale(1, 0.82, 1)`、壶底 `0.07/0.095/0.03/12`、
 * 壶口 `0.055/0.068/0.03/12`、壶盖珠 `0.02/8/6`、提梁弧线 `(20 + i×14)°` 与 `0.115` 半径、
 * 壶嘴两段 `0.011` / `0.017` / `0.013`、光晕 `0.16/12/8` 与 `0.12`、出水口 `(0, 0.175, 0.20)`、
 * 水流 10 点缓冲、`POT_TILT = 0.65`、`POT_TIP_FWD = 0.20×cos + 0.175×sin`、`POT_T = 3.6`，
 * 以及每帧的七段 `p` 区间（`0.14 / 0.30 / 0.40 / 0.70 / 0.80 / 0.94`）、`0.45` 抬升、
 * `bob` 的 `sin(time×3)×0.012`、光晕 `0.09 + 0.04×…`、`tilt > 0.45` 的出水阈值、
 * 水流的 `9 / 8 / 7 / 6` 频率与 `0.008 / 0.035` 振幅 **一个没改**。
 * 本件**不消耗 `rng`**。
 */
import * as THREE from 'three'
import { defineProp } from '../../app/defineProp.js'

export default defineProp({
  id: 'floor1/teapot',
  kind: 'decor',

  // `potRun` 是原来的 `ctx.potRun`（点一下置 `POT_T` = 3.6 秒）
  state: () => ({ potRun: 0 }),

  build({ scene, L, put, edge, logBetween, cupFactory }) {
    const { DT_X, DT_Z, DTOP } = L
    // 原 `ctx.D2R`（文件早段的局部常量，不在装配环境里）—— 同值自写，只在本模块可见
    const D2R = Math.PI / 180

    const POT_BX = DT_X + 0.42, POT_BZ = DT_Z + 0.02;
    const CUP_T = cupFactory.cups[2];
    const POT_RY = Math.atan2(CUP_T.position.x - POT_BX, CUP_T.position.z - POT_BZ);
    const POT_TILT = 0.65;
    const POT_TIP_FWD = 0.20 * Math.cos(POT_TILT) + 0.175 * Math.sin(POT_TILT);
    const teapotPos = new THREE.Group();
    teapotPos.position.set(POT_BX, DTOP, POT_BZ);
    teapotPos.rotation.y = POT_RY;
    scene.add(teapotPos);
    const teapot = new THREE.Group();
    teapotPos.add(teapot);
    let potHaloMat, potHalo;
    {
        const body = put(edge(new THREE.SphereGeometry(0.105, 14, 11)), 0, 0.10, 0, 0, 0, 0, teapot);
        body.scale.set(1, 0.82, 1);
        put(edge(new THREE.CylinderGeometry(0.07, 0.095, 0.03, 12)), 0, 0.015, 0, 0, 0, 0, teapot);
        put(edge(new THREE.CylinderGeometry(0.055, 0.068, 0.03, 12)), 0, 0.185, 0, 0, 0, 0, teapot);
        put(edge(new THREE.SphereGeometry(0.02, 8, 6)), 0, 0.21, 0, 0, 0, 0, teapot);
        const arcPts = [];
        for (let i = 0; i <= 10; i++) {
            const a = (20 + i * 14) * D2R;
            arcPts.push([Math.cos(a) * 0.115, 0.115 + Math.sin(a) * 0.115, 0]);
        }
        for (let i = 0; i < arcPts.length - 1; i++)
            logBetween(arcPts[i], arcPts[i + 1], 0.011, teapot);
        logBetween([0, 0.07, 0.085], [0, 0.13, 0.145], 0.017, teapot);
        logBetween([0, 0.13, 0.145], [0, 0.175, 0.20], 0.013, teapot);
        potHaloMat = new THREE.MeshBasicMaterial({
            color: 0xbfe3ff, transparent: true, opacity: 0.12, depthWrite: false
        });
        potHalo = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), potHaloMat);
        potHalo.userData.noHit = true;
        put(potHalo, 0, 0.10, 0, 0, 0, 0, teapot);
        potHalo.visible = false;
    }
    const potSpoutTip = new THREE.Object3D();
    potSpoutTip.position.set(0, 0.175, 0.20);
    teapot.add(potSpoutTip);
    const potStreamMat = new THREE.LineBasicMaterial({ color: 0x7db8dd });
    const potStreamGeom = new THREE.BufferGeometry();
    potStreamGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(10 * 3), 3));
    const potStream = new THREE.Line(potStreamGeom, potStreamMat);
    potStream.frustumCulled = false;
    potStream.visible = false;
    scene.add(potStream);
    const POT_T = 3.6;
    /** ★ 本件**私有**的临时向量 —— 取代原来与暖桌共用的 `ctx._tv`（`J4.28` 已让暖桌自造一个） */
    const _tv = new THREE.Vector3();

    return {
      root: teapotPos,
      parts: {
        teapotPos, teapot, potHalo, potHaloMat, potSpoutTip, potStream, potStreamGeom, _tv,
        /** 本件私有的常量（原挂在 `ctx` 上的那批 `POT_*` / `CUP_T`，以及 `build` 里用到的 `DTOP`） */
        consts: { POT_BX, POT_BZ, POT_RY, POT_TILT, POT_TIP_FWD, POT_T, CUP_T, DTOP },
      },
    }
  },

  // 原 `teapotPos` 上那条交互的等价声明（点一下开始 3.6 秒的"飞起 → 悬停 → 倒水 → 归位"）。
  // 锚点与几何**同源**：壶座就是 `teapotPos.position` 的来源（`L.DT_X + 0.42` / `L.DT_Z + 0.02`，不变量 `N9`）。
  interactables: (s, { L, parts }) => [{
    id: 'teapot/pour',
    label: '提起梁茶壶给茶杯续水',
    mode: 'both',
    anchor: { x: L.DT_X + 0.42, z: L.DT_Z + 0.02 },
    radius: 1.5,
    hits: parts.teapotPos,
    onActivate: () => { s.potRun = parts.consts.POT_T },
  }],

  /** 原 `tickOnce()` 里的 `frame/47`，**逐字搬运**（`ctx.*` → `parts.*` / `parts.consts.*`） */
  update(dt, time, s, { parts }) {
    const { teapotPos, teapot, potHalo, potHaloMat, potSpoutTip, potStream, potStreamGeom, _tv } = parts
    const { POT_BX, POT_BZ, POT_RY, POT_TILT, POT_TIP_FWD, POT_T, CUP_T, DTOP } = parts.consts

    if (s.potRun > 0) s.potRun -= dt;
    const p = s.potRun > 0 ? 1 - s.potRun / POT_T : 0;
    const dirX = Math.sin(POT_RY), dirZ = Math.cos(POT_RY);
    const hx = CUP_T.position.x - dirX * POT_TIP_FWD;
    const hz = CUP_T.position.z - dirZ * POT_TIP_FWD;
    const sm = tt => tt * tt * (3 - 2 * tt);
    let ly = 0, dx = 0, dz = 0, tilt = 0;
    if (p > 0) {
        if (p < 0.14) {
            ly = sm(p / 0.14) * 0.45;
        } else if (p < 0.30) {
            const u = sm((p - 0.14) / 0.16);
            ly = 0.45; dx = u * (hx - POT_BX); dz = u * (hz - POT_BZ);
        } else if (p < 0.40) {
            const u = sm((p - 0.30) / 0.10);
            ly = 0.45; dx = hx - POT_BX; dz = hz - POT_BZ; tilt = u * POT_TILT;
        } else if (p < 0.70) {
            ly = 0.45; dx = hx - POT_BX; dz = hz - POT_BZ; tilt = POT_TILT;
        } else if (p < 0.80) {
            const u = sm((p - 0.70) / 0.10);
            ly = 0.45; dx = hx - POT_BX; dz = hz - POT_BZ; tilt = (1 - u) * POT_TILT;
        } else if (p < 0.94) {
            const u = sm((p - 0.80) / 0.14);
            ly = 0.45; dx = (1 - u) * (hx - POT_BX); dz = (1 - u) * (hz - POT_BZ);
        } else {
            const u = sm((p - 0.94) / 0.06);
            ly = (1 - u) * 0.45;
        }
    }
    const floating = p > 0.02 && p < 0.98;
    const bob = floating ? Math.sin(time * 3) * 0.012 : 0;
    teapotPos.position.set(POT_BX + dx, DTOP + ly + bob, POT_BZ + dz);
    teapot.rotation.x = tilt;
    potHalo.visible = floating;
    if (floating) potHaloMat.opacity = 0.09 + 0.04 * (0.5 + 0.5 * Math.sin(time * 5));
    if (tilt > 0.45) {
        potStream.visible = true;
        potSpoutTip.getWorldPosition(_tv);
        const ex = CUP_T.position.x, ey = CUP_T.position.y + 0.10, ezz = CUP_T.position.z;
        const arr = potStreamGeom.attributes.position.array;
        for (let i = 0; i < 10; i++) {
            const tt = i / 9;
            const wob = Math.sin(tt * Math.PI);
            arr[i * 3] = _tv.x + (ex - _tv.x) * tt + Math.sin(tt * 9 + time * 8) * 0.008 * wob;
            arr[i * 3 + 1] = _tv.y + (ey - _tv.y) * tt - 0.035 * wob;
            arr[i * 3 + 2] = _tv.z + (ezz - _tv.z) * tt + Math.cos(tt * 7 + time * 6) * 0.008 * wob;
        }
        potStreamGeom.attributes.position.needsUpdate = true;
    } else {
        potStream.visible = false;
    }
  },
})
