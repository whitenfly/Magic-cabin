/**
 * 12.11b 滑轮置物台（可滑动 + 墨水瓶羽毛笔 + 纸堆）—— `J4.20` 升格 `defineProp`
 *
 * 来源：`legacy/monolith.js` 原 `12.11b` 分区（`J3` 记的 L1288–1428）的**几何段**，
 * 以及 `tickOnce()` 里那**四段连续的每帧分支**（`J3` 记的 L6425 / L6437 / L6491 / L6509）。
 *
 * ## 搬迁对照
 *
 * | 原来住哪 | 现在住哪 |
 * |---|---|
 * | 顶层 `cartOut` / `cartP` / `cartPrevP` / `quillRun` / `paperRun` | `state: () => ({ … })`（**变量名一个没改**） |
 * | 顶层 `CART_P0` / `CART_DIR` / `CART_DIST` | `world/layout.js` 的 `CART_POS` / `CART_DIR` / `CART_DIST`（不变量 `N9`；**数值一个没改**） |
 * | 顶层 `cartG` / `cartWheels` / `cartBody` / `inkG` / `quillG` / `paperG` / `magicGlyphs` / `papers` / `_cw` | `build()` 内的同名局部量，经 `parts` 交出（**同一个实例**） |
 * | 顶层 `QUILL_REST` / `QUILL_T` / `PAPER_T` / `QW_A` / `QW_B` / `GLYPH_CHARS` / `GLYPH_COLORS` | `QUILL_T` / `PAPER_T` / `QUILL_REST` 等经 `parts.consts` 交出；`GLYPH_CHARS` / `GLYPH_COLORS` 只在 `build` 内用 ⇒ 留作局部常量 |
 * | `regMagic(cartBody/inkG/quillG/paperG, …)` × 4 | `interactables()`：**4 条**（各带 `hits`） |
 * | `tickOnce()` 里那**四段**（L6425→纸堆块结束） | `update()`（**一个**方法，顺序与分段逐字保留） |
 *
 * ## ★ 为什么当年搬不动（`J3` 的两条前置，本任务都已解决）
 *
 * `floor1-cart-shelf.SKIP.md` 记的病根是 `cartG` 被**碰撞表**读：
 *
 * ```js
 * { g: cartG, hx: 0.21, hz: 0.16, top: 0.482 },   // movingPlatforms（"史莱姆可站上去的移动平台"）
 * ```
 *
 * `movingPlatforms` 住在碰撞段 ⇒ 搬走 = `cartG` 消失 ⇒ `refreshPlatforms()` 每帧 `ReferenceError`
 * （**直接崩**，不是像素差异）。处置与 `floor1/stools` 一致：
 * 改读**装配记录里的部件**（`ctx.cartShelfApi.parts.cartG`）。
 *
 * `SKIP` 另记了三条"只能整段一起搬"的耦合，本任务照办：
 *
 * 1. 羽毛笔与纸堆的每帧分支用 `cartG.localToWorld` / `cartG.worldToLocal` —— 坐标**相对购物车**，
 *    拆开就没有参照物；
 * 2. `_cw` 是四段共用的**同一个 `THREE.Vector3`**；`magicGlyphs`（羽毛笔写字的产物）由 `quillRun`
 *    驱动 —— 二者必须同属一件物件；
 * 3. `cartG.updateMatrixWorld(true)`（每帧显式刷新世界矩阵）是后两段 `localToWorld`/`worldToLocal`
 *    的**前提** —— 四段合并后这段顺序**必须保持最前**（见 `update` 内 ① 的注释）。
 *
 * ## 关于 `root`
 *
 * `cartG` 本身就是共同父节点（车体 / 轮子 / 墨水瓶 / 羽毛笔 / 纸堆都挂在它下面）⇒ `root: cartG`。
 * 8 个魔法符号 Sprite 是**各自直接挂 `scene`** 的（原实现如此），保持不动。
 *
 * ## 逐字搬运说明
 *
 * 几何段与四段每帧分支**逐行相同**（只改缩进与状态前缀）：`ctx.cartOut` → `s.cartOut`、
 * `ctx.cartG` → `cartG`（局部解构）、`ctx._cw` → `_cw`、`ctx.sm01` → `sm01`。
 * 全部数值（车体尺寸 / 轮位 / 羽毛笔姿态表 / 书写路径 `QW_A`/`QW_B` / 各段时间常数
 * `QUILL_T=7.0` / `PAPER_T=8.5` / 纸堆环飞半径与相位）**一个没改**。
 *
 * ⚠️ **`rng` 顺序**：纸堆那 8 张纸每张调 2 次 `floor1Rng()`（`ry0` 与 `pg.position.z` 的抖动），
 * 共 16 次 —— `build` 在原位置被调用，**次数与顺序都没变** ⇒ 后续随机数序列与画面不变。
 */
import * as THREE from 'three'
import { defineProp } from '../../app/defineProp.js'

/**
 * 「让羽毛笔开始书写」—— 原 `12.11b` 区间内的 `function startQuill()`，逐字搬运。
 *
 * 它同时被**两条**交互调用（墨水瓶与羽毛笔），所以做成模块级函数、显式收参数
 * （`state` / `magicGlyphs` / `QUILL_T`），避免在 `interactables` 里写两遍。
 */
function startQuill(s, magicGlyphs, QUILL_T) {
    if (s.quillRun <= 0.4) {
        s.quillRun = QUILL_T;
        for (const g of magicGlyphs) { g.active = false; g.sp.visible = false; g.mat.opacity = 0; }
    }
}

export default defineProp({
  id: 'floor1/cart-shelf',
  kind: 'furniture',

  state: () => ({
    cartOut: false, cartP: 0, cartPrevP: 0,
    quillRun: 0, paperRun: 0,
  }),

  build({ scene, L, put, solid, edge, logBetween, line, geo, MAT, LITMAT, FILL, rng }) {
    const { CART_POS: CART_P0, CART_DIR, CART_DIST } = L
    const floor1Rng = rng.floor1

    const cartG = new THREE.Group();
    cartG.position.set(CART_P0.x, 0, CART_P0.z);
    cartG.rotation.y = Math.atan2(CART_DIR.x, CART_DIR.z);
    scene.add(cartG);

    const cartWheels = [];
    const cartBody = new THREE.Group();
    cartG.add(cartBody);
    {
        const woodMat = LITMAT(0x9c7a58, { side: THREE.DoubleSide });
        const darkMat = LITMAT(0x6b543f, { side: THREE.DoubleSide });
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
            const wh = new THREE.Group();
            wh.rotation.z = Math.PI / 2;
            put(edge(new THREE.CylinderGeometry(0.034, 0.034, 0.024, 10)), 0, 0, 0, 0, 0, 0, wh);
            put(edge(new THREE.CylinderGeometry(0.011, 0.011, 0.028, 6)), 0, 0, 0, 0, 0, 0, wh);
            wh.position.set(sx * 0.15, 0.034, sz * 0.10);
            cartG.add(wh);
            cartWheels.push(wh);
        }
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]])
            put(edge(new THREE.CylinderGeometry(0.011, 0.011, 0.46, 6)),
                sx * 0.155, 0.26, sz * 0.115, 0, 0, 0, cartBody);
        put(solid(new THREE.BoxGeometry(0.40, 0.024, 0.30), woodMat), 0, 0.185, 0, 0, 0, 0, cartBody);
        put(solid(new THREE.BoxGeometry(0.40, 0.024, 0.30), woodMat), 0, 0.47, 0, 0, 0, 0, cartBody);
        put(solid(new THREE.BoxGeometry(0.40, 0.05, 0.012), darkMat), 0, 0.21, -0.145, 0, 0, 0, cartBody);
        put(solid(new THREE.BoxGeometry(0.40, 0.05, 0.012), darkMat), 0, 0.495, -0.145, 0, 0, 0, cartBody);
        logBetween([-0.14, 0.48, 0.14], [-0.14, 0.78, 0.14], 0.011, cartBody);
        logBetween([0.14, 0.48, 0.14], [0.14, 0.78, 0.14], 0.011, cartBody);
        logBetween([-0.14, 0.78, 0.14], [0.14, 0.78, 0.14], 0.011, cartBody);
    }

    /* —— 墨水瓶（上层）—— */
    const inkG = new THREE.Group();
    inkG.position.set(-0.10, 0.482, 0.02);
    cartG.add(inkG);
    {
        const glassMat = new THREE.MeshBasicMaterial({ color: 0x2a3a6e, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
        const inkMat = LITMAT(0x1a2a5e);
        put(solid(new THREE.CylinderGeometry(0.036, 0.042, 0.075, 10), glassMat), 0, 0.0375, 0, 0, 0, 0, inkG);
        put(solid(new THREE.CylinderGeometry(0.02, 0.028, 0.024, 8), glassMat), 0, 0.086, 0, 0, 0, 0, inkG);
        put(solid(new THREE.CylinderGeometry(0.031, 0.031, 0.052, 10), inkMat), 0, 0.030, 0, 0, 0, 0, inkG);
    }

    /* —— 羽毛笔（插在墨水瓶里）—— */
    const quillG = new THREE.Group();
    cartG.add(quillG);
    const QUILL_REST = { pos: [-0.10, 0.505, 0.02], rotX: -0.15, rotZ: 0.30 };
    {
        const featherMat = LITMAT(0xf4f0e6, { side: THREE.DoubleSide });
        put(solid(new THREE.CylinderGeometry(0.0035, 0.0035, 0.15, 6),
            LITMAT(0xd9c9a8)), 0, 0.085, 0, 0, 0, 0, quillG);
        put(solid(new THREE.ConeGeometry(0.0035, 0.03, 6),
            LITMAT(0x4a3b28)), 0, 0.005, 0, 0, 0, Math.PI, quillG);
        const f = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), featherMat);
        f.scale.set(0.32, 1.5, 0.55);
        f.position.set(0.012, 0.155, 0);
        f.rotation.z = -0.18;
        quillG.add(f);
        put(line([[0, 0.09, 0], [0.006, 0.22, 0]]), 0, 0, 0, 0, 0, 0, quillG);
        for (let k = 0; k < 5; k++) {
            const yy = 0.11 + k * 0.024;
            put(line([[0.002, yy, 0], [0.028 - k * 0.002, yy + 0.014, 0]]), 0, 0, 0, 0, 0, 0, quillG);
            put(line([[0.002, yy, 0], [-0.016 + k * 0.001, yy + 0.012, 0]]), 0, 0, 0, 0, 0, 0, quillG);
        }
    }
    quillG.position.set(QUILL_REST.pos[0], QUILL_REST.pos[1], QUILL_REST.pos[2]);
    quillG.rotation.set(QUILL_REST.rotX, 0, QUILL_REST.rotZ);

    /* —— 发光魔法符号（Sprite 池：花体/哥特数学字母 + 柔光，无描边）—— */
    const GLYPH_CHARS = ['𝔑', '𝔎', '𝓇', '𝔓', '𝒻', '𝓀', '𝔖', '𝓌'];
    const GLYPH_COLORS = ['#d84fd0', '#4f9bd8', '#d8a84f', '#e05555', '#4fd8b0', '#f0e04f', '#9b6fd8', '#e084f0'];
    const magicGlyphs = [];
    for (let i = 0; i < 8; i++) {
        const cv = document.createElement('canvas');
        cv.width = cv.height = 128;
        const cx = cv.getContext('2d');
        cx.font = 'bold 84px "STIX Two Math", "Cambria Math", serif';
        cx.textAlign = 'center';
        cx.textBaseline = 'middle';
        cx.shadowColor = GLYPH_COLORS[i];
        cx.shadowBlur = 12;
        cx.fillStyle = GLYPH_COLORS[i];
        cx.fillText(GLYPH_CHARS[i], 64, 68);
        cx.fillText(GLYPH_CHARS[i], 64, 68);
        const tex = new THREE.CanvasTexture(cv);
        const mat = new THREE.SpriteMaterial({
            map: tex, transparent: true, opacity: 0, depthWrite: false
        });
        const sp = new THREE.Sprite(mat);
        sp.scale.setScalar(0.001);
        sp.visible = false;
        scene.add(sp);
        magicGlyphs.push({ sp, mat, active: false, age: 0, life: 2.4, base: new THREE.Vector3() });
    }

    /* 书写路径（世界坐标）：餐桌上方空中（右侧） */
    const QW_A = new THREE.Vector3(2.75, 1.30, 1.75);
    const QW_B = new THREE.Vector3(1.65, 1.55, 1.05);
    for (let i = 0; i < 8; i++) {
        magicGlyphs[i].base.lerpVectors(QW_A, QW_B, (i + 0.5) / 8);
        magicGlyphs[i].base.y += Math.sin(i * 2.2) * 0.05;
    }

    const QUILL_T = 7.0;

    /* —— 纸堆（下层）—— */
    const paperG = new THREE.Group();
    cartG.add(paperG);
    const papers = [];
    for (let i = 0; i < 8; i++) {
        const pg = new THREE.Group();
        put(solid(new THREE.BoxGeometry(0.13, 0.0022, 0.18), FILL), 0, 0, 0, 0, 0, 0, pg);
        for (const ly of [-0.03, 0, 0.03])
            put(line([[-0.045, 0.0025, ly], [0.045, 0.0025, ly]]), 0, 0, 0, 0, 0, 0, pg);
        const ry0 = (floor1Rng() - 0.5) * 0.3;
        pg.position.set(0.08 + (i % 3) * 0.003, 0.198 + i * 0.0028, -0.02 + (floor1Rng() - 0.5) * 0.012);
        pg.rotation.y = ry0;
        paperG.add(pg);
        papers.push({ g: pg, home: pg.position.clone(), ry0, a0: 1.0 + i * 0.8, r: 2.1 + (i % 3) * 0.28 });
    }
    const PAPER_T = 8.5;
    const _cw = new THREE.Vector3();

    return {
      root: cartG,
      parts: {
        cartG, cartWheels, cartBody, inkG, quillG, paperG, magicGlyphs, papers, _cw,
        /** 本件私有的常量（原 `12.11b` 区间内的顶层 `const`）—— `update` 与 `interactables` 都要用 */
        consts: { CART_P0, CART_DIR, CART_DIST, QUILL_REST, QUILL_T, PAPER_T, QW_A, QW_B },
      },
    }
  },

  // 原 4 处 `regMagic` 的等价声明（`regMagic` 只给 aim 通路；这里按 `J3` 的先例给 `both`，
  // 于是近距也能触发 —— 与 `floor1/stools` / `floor1/book-pile` 的处置一致）。
  // 锚点与几何**同源**：整车都在 `layout.CART_POS` 上（`build` 里 `cartG.position` 的来源，不变量 `N9`）。
  interactables: (s, { L, parts }) => [
    {
      id: 'cart-shelf/slide',
      label: '把滑轮置物台推向屋内 / 拉回',
      mode: 'both',
      anchor: { x: L.CART_POS.x, z: L.CART_POS.z },
      radius: 1.5,
      hits: parts.cartBody,
      onActivate: () => { s.cartOut = !s.cartOut },
    },
    {
      id: 'cart-shelf/ink',
      label: '点一点墨水瓶，让羽毛笔自动书写魔法符号',
      mode: 'both',
      anchor: { x: L.CART_POS.x, z: L.CART_POS.z },
      radius: 1.5,
      hits: parts.inkG,
      onActivate: () => { startQuill(s, parts.magicGlyphs, parts.consts.QUILL_T) },
    },
    {
      id: 'cart-shelf/quill',
      label: '拿起羽毛笔，让它自动书写魔法符号',
      mode: 'both',
      anchor: { x: L.CART_POS.x, z: L.CART_POS.z },
      radius: 1.5,
      hits: parts.quillG,
      onActivate: () => { startQuill(s, parts.magicGlyphs, parts.consts.QUILL_T) },
    },
    {
      id: 'cart-shelf/papers',
      label: '让纸堆腾空扇动，绕一楼飞一圈',
      mode: 'both',
      anchor: { x: L.CART_POS.x, z: L.CART_POS.z },
      radius: 1.5,
      hits: parts.paperG,
      onActivate: () => { if (s.paperRun <= 0) s.paperRun = parts.consts.PAPER_T },
    },
  ],

  /**
   * 原 `tickOnce()` 里那**四段连续的每帧分支**，逐字搬运并**保持分段与顺序**
   * （它们在原 `tickOnce()` 里就是连续的：L6425 → 纸堆块结束，中间只隔空行
   * ⇒ 合并成一个 `update` 与原来逐帧等价）。
   *
   * ★ 顺序不可调换，尤其 ① 必须最前 —— 它那行 `cartG.updateMatrixWorld(true)` 是
   *   ②④ 里 `localToWorld` / `worldToLocal` 的**前提**（原 `SKIP` 第 6 条）。
   */
  update(dt, time, s, { parts, sm01 }) {
    const { cartG, cartWheels, quillG, magicGlyphs, papers, _cw, consts } = parts
    const { CART_P0, CART_DIR, CART_DIST, QUILL_REST, QUILL_T, PAPER_T, QW_A, QW_B } = consts

    /* ---- ① 滑轮置物台：滑动 + 轮子滚动 ---- */
    {
        s.cartP += ((s.cartOut ? 1 : 0) - s.cartP) * 0.07;
        cartG.position.set(CART_P0.x + CART_DIR.x * CART_DIST * s.cartP, 0,
            CART_P0.z + CART_DIR.z * CART_DIST * s.cartP);
        cartG.updateMatrixWorld(true);
        const dC = s.cartP - s.cartPrevP;
        if (Math.abs(dC) > 1e-5)
            for (const w of cartWheels) w.children[0].rotation.y -= dC * 16;
        s.cartPrevP = s.cartP;
    }

    /* ---- ② 羽毛笔：飞出书写魔法符号后归位 ---- */
    {
        if (s.quillRun > 0) {
            s.quillRun -= dt;
            const p = 1 - Math.max(s.quillRun, 0) / QUILL_T;
            _cw.set(QUILL_REST.pos[0], QUILL_REST.pos[1], QUILL_REST.pos[2]);
            cartG.localToWorld(_cw);
            const restX = _cw.x, restY = _cw.y, restZ = _cw.z;
            const sX = QW_A.x, sY = QW_A.y + 0.08, sZ = QW_A.z;
            const eX = QW_B.x, eY = QW_B.y + 0.08, eZ = QW_B.z;
            let px, py, pz, rx = QUILL_REST.rotX, rz = QUILL_REST.rotZ;
            if (p < 0.10) {
                const u = sm01(p / 0.10);
                px = restX + (sX - restX) * u;
                py = restY + (sY - restY) * u + Math.sin(u * Math.PI) * 0.30;
                pz = restZ + (sZ - restZ) * u;
                rx = -0.25; rz = 0.10;
            } else if (p < 0.70) {
                const u = (p - 0.10) / 0.60;
                px = sX + (eX - sX) * u;
                py = sY + (eY - sY) * u + Math.sin(u * Math.PI * 6) * 0.02;
                pz = sZ + (eZ - sZ) * u;
                rx = -0.85 + Math.sin(u * Math.PI * 10) * 0.10;
                rz = 0.22;
                for (let i = 0; i < 8; i++) {
                    if (!magicGlyphs[i].active && u > (i + 0.25) / 8) {
                        magicGlyphs[i].active = true;
                        magicGlyphs[i].age = 0;
                        magicGlyphs[i].sp.visible = true;
                    }
                }
            } else if (p < 0.80) {
                const u = (p - 0.70) / 0.10;
                px = eX; py = eY + Math.sin(u * Math.PI) * 0.05; pz = eZ;
                rx = -0.5; rz = 0.15;
            } else {
                const u = sm01((p - 0.80) / 0.20);
                px = eX + (restX - eX) * u;
                py = eY + (restY - eY) * u + Math.sin(u * Math.PI) * 0.30;
                pz = eZ + (restZ - eZ) * u;
                rx = -0.25 * (1 - u) + QUILL_REST.rotX * u;
                rz = 0.10 * (1 - u) + QUILL_REST.rotZ * u;
            }
            _cw.set(px, py, pz);
            cartG.worldToLocal(_cw);
            quillG.position.copy(_cw);
            quillG.rotation.set(rx, 0, rz);
            if (s.quillRun <= 0) {
                quillG.position.set(QUILL_REST.pos[0], QUILL_REST.pos[1], QUILL_REST.pos[2]);
                quillG.rotation.set(QUILL_REST.rotX, 0, QUILL_REST.rotZ);
            }
        }
    }

    /* ---- ③ 魔法符号：上升渐隐 ---- */
    {
        for (const g of magicGlyphs) {
            if (g.active) {
                g.age += dt;
                const k = g.age / g.life;
                if (k >= 1) { g.active = false; g.sp.visible = false; continue; }
                const pop = Math.min(g.age * 7, 1);
                g.mat.opacity = 0.95 * pop * (1 - Math.max(0, (k - 0.55) / 0.45));
                g.sp.position.set(g.base.x + Math.sin(g.age * 2.2) * 0.02,
                    g.base.y + k * 0.20,
                    g.base.z);
                const sc = 0.16 * pop * (1 + 0.10 * Math.sin(g.age * 7));
                g.sp.scale.set(sc, sc, 1);
            }
        }
    }

    /* ---- ④ 纸堆：腾空扇动绕一楼一圈后飞回 ---- */
    {
        if (s.paperRun > 0) {
            s.paperRun -= dt;
            const elapsed = PAPER_T - s.paperRun;
            for (let i = 0; i < papers.length; i++) {
                const pp = papers[i];
                const delay = i * 0.12;
                const D = PAPER_T - delay;
                let ti = (elapsed - delay) / D;
                if (ti < 0) ti = 0;
                if (ti > 1) ti = 1;
                _cw.copy(pp.home);
                cartG.localToWorld(_cw);
                const hx = _cw.x, hy = _cw.y, hz = _cw.z;
                const a0 = pp.a0, r = pp.r;
                const cirY = (a) => 1.45 + Math.sin(a * 3 + i) * 0.22;
                let pos;
                if (ti < 0.18) {
                    const u = sm01(ti / 0.18);
                    const cx = Math.cos(a0) * r, cy = cirY(a0), cz = Math.sin(a0) * r;
                    pos = {
                        x: hx + (cx - hx) * u,
                        y: hy + (cy - hy) * u + Math.sin(u * Math.PI) * 0.40,
                        z: hz + (cz - hz) * u
                    };
                } else if (ti < 0.78) {
                    const sc = (ti - 0.18) / 0.60;
                    const a = a0 + sc * Math.PI * 2;
                    pos = { x: Math.cos(a) * r, y: cirY(a), z: Math.sin(a) * r };
                } else {
                    const u = sm01((ti - 0.78) / 0.22);
                    const cx = Math.cos(a0 + Math.PI * 2) * r, cy = cirY(a0 + Math.PI * 2), cz = Math.sin(a0 + Math.PI * 2) * r;
                    pos = {
                        x: cx + (hx - cx) * u,
                        y: cy + (hy - cy) * u + Math.sin(u * Math.PI) * 0.35,
                        z: cz + (hz - cz) * u
                    };
                }
                _cw.set(pos.x, pos.y, pos.z);
                cartG.worldToLocal(_cw);
                pp.g.position.copy(_cw);
                if (ti > 0.02 && ti < 0.98) {
                    pp.g.rotation.set(Math.sin(time * 7 + i * 1.3) * 0.9,
                        time * 2.5 + i,
                        Math.cos(time * 5 + i * 0.9) * 0.7);
                } else {
                    pp.g.rotation.set(0, pp.ry0, 0);
                }
            }
            if (s.paperRun <= 0) {
                for (const pp of papers) {
                    pp.g.position.copy(pp.home);
                    pp.g.rotation.set(0, pp.ry0, 0);
                }
            }
        }
    }
  },
})
