/**
 * 18.8 小魔女计划板（点击便签编辑 / 翻板擦 / 粉笔写字 / 4 个卷轴）—— `J4.43` 升格 `defineProp`
 *
 * 来源：`legacy/monolith.js` 原 `18.8` 分区（`J4.42` 施工图 §1 记的 `install.js` L209–544，336 行）。
 * 它是**任务 D 最大的一件**，也是**单件消耗 `textureRng` 最多**的一件。
 *
 * ## ★ 一个段里其实有三块内容（`J4.42` §1）
 *
 * | 段 | 内容 |
 * |---|---|
 * | **A** | **计划板本体 + 3 张便签 + 便签编辑器** |
 * | **B** | **粉笔与字形组**（`GLYPHS` / `glyphCanvas` / `glyphPlane` / `drawGlyphSet` / `chalkG` / `updateChalk`） |
 * | **C** | **`scrollRoll` 工厂 + 4 次调用**（卷轴在房间角落）—— **与计划板无语义关系** |
 *
 * 按 `J4.42` §1 的裁决**一并搬**（一件 = 一个段，风险最低）；C 段自包含，将来可拆成 `floor2/scrolls`。
 *
 * ## ★★ 编辑器归物件（`J4.42` §2 的裁决）
 *
 * `systems/ui/editors/NoteEditor.js`（39 行）的 `applyNote()` 原先直接读计划板私有量
 * （`ctx.notes` / `ctx.noteEditing` / `ctx.drawNote`）—— 系统层反向伸手进物件。
 *
 * **本件照 `floor2/picture.js`（`J3` 已升格）的既有先例**：它的 `openPicEditor` / `applyPic` /
 * 两个 DOM 监听**全在模块内**，只经 `state` 暴露给 `interactables`。
 * ⇒ **`applyNote` + 两个 DOM 监听搬进本模块**，`NoteEditor.js` **被删除**，
 * `installCabin.js` 的段调用一并去掉。
 *
 * ### ✅ 跨层豁免已取消（`J4.51`）
 *
 * `J4.42` §2.4 方案 (a) 曾在这里保留**唯一一处跨层豁免**：本模块经 `parts.noteInput` 把便签
 * 输入框交给 `install.js`，由它写 `ctx.noteInput`，供两个**系统层**读者
 * （`Input.js` · `PlayerController.js` —— "在输入框里打字时吞掉游戏快捷键"）使用。
 *
 * `J4.51` 把那两处改成**统一判据** `ctx.isTypingTarget()`（焦点在 `INPUT` / `TEXTAREA` /
 * `contentEditable` 上就吞按键）⇒ 系统层不再需要认识任何具体输入框，本模块**不必再交出去**，
 * `parts.noteInput` 一并删除。判据：`pnpm test:input`。
 *
 * ## ★ `rng`：1020 次 `textureRng()`（不变量 `N8`）
 *
 * `drawBoardFace()` 里 `for (i < 340)` 循环内 3 次 `textureRng()`
 * ⇒ **340 × 3 = 1020 次**（★ **全项目单件最多**，多于 `star-particles` 的 672 次）。
 * 该函数只被调用**一次**、全在 `build` 期 ⇒ **`installProp(board)` 的位置必须与原 18.8 段一致**。
 * 本件从装配环境取 `rng.texture`（与 `install.js` 顶部的 `const textureRng = scene.texture` 同一实例）。
 *
 * ## ★ 三个帧任务全部相邻（`J4.42` §3）
 *
 * `frame/55`（`eraserT` 一阶低通）· `frame/56`（`eraserG.rotation.x = π·smooth`）·
 * `frame/57`（`updateChalk`）—— **三条连续** ⇒ 合并**天然等价**（判据 ①「相邻」），
 * 登记在 `frame/55` 的位置即可，**无需**论证"中间任务无读者/写者"。
 *
 * ## `clock.now` → `s.now`
 *
 * 原 `chalkState.start = clock.now` 改为 `s.chalkStart = s.now`（`update` 第一行写 `s.now = time`）——
 * 与 `floor2/rubik.js` / `floor2/magicBook.js` 同法。
 *
 * ## 逐字搬运说明
 *
 * 全部数值一个没改：`boardG` 位置 `(-2.9, FY, 2.8)` 与 `rotation.y = 2.33`、
 * `boardTilt.rotation.x = -0.09`、画布 `512×392`、木纹循环 `340` 次与 `0.045`、
 * 面板/托板/边框的全部尺寸与位置、3 张便签的 `col/txt/rz/px/py` 与 `128×128` 画布及字号阶梯、
 * 橡皮擦 `box(0.18, 0.05, 0.08)` 与 `iline` 两笔、`eraserT` 系数 `0.06`、
 * 字形画布 `512×200` 与 8 个字形的位置公式、字形渐变的 `0.02` 羽化、
 * `updateChalk` 的 `RISE 0.7 / WPS 0.55 / HOLD 1.8 / FADE 0.8 / FALL 0.7` 与全部位置/透明度公式、
 * `SCROLL_R = 0.055` 与 4 次 `scrollRoll` 的坐标。
 */
import * as THREE from 'three'
import { defineProp } from '../../app/defineProp.js'

export default defineProp({
  id: 'floor2/board',
  kind: 'decor',

  // 原来的 `ctx.noteEditing` / `ctx.eraserOpen` / `ctx.eraserT` / `ctx.chalkState.active,start`
  // `now` 是 `clock.now` 的替身（`update` 第一行写入，与 `time` 恒等）
  state: () => ({
    noteEditing: 0,
    eraserOpen: false,
    eraserT: 0,
    chalkActive: false,
    chalkStart: 0,
    now: 0,
  }),

  // ⚠️ `state: s` —— `installProp` 在调 `build` **之前**已把 state 实例写进 env
  //    （`app/installProp.js` L96–97：`const state = prop.state(env); env.state = state`）
  //    ⇒ `build` 内可直接读写物件自己的 state（`floor2/coinTowers.js` 即如此）。
  build({ scene, L, put, box, log, edge, iline, LITMAT, MAT, IN_MAT, V, SND, smooth, rng, state: s }) {
    const { FY } = L
    const textureRng = rng.texture

    /* ==================================================================== */
    /* ============ A 段：计划板本体 + 3 张便签 + 便签编辑器 ============== */
    /* ==================================================================== */

    const boardG = new THREE.Group();
    boardG.position.set(-2.9, FY, 2.8);
    boardG.rotation.y = 2.33;
    scene.add(boardG);
    const boardTilt = new THREE.Group();
    boardTilt.rotation.x = -0.09;
    boardG.add(boardTilt);
    const boardCanvas = document.createElement('canvas');
    boardCanvas.width = 512;
    boardCanvas.height = 392;
    const bctx = boardCanvas.getContext('2d');

    function drawBoardFace() {
        bctx.fillStyle = '#2f4136';
        bctx.fillRect(0, 0, 512, 392);
        for (let i = 0; i < 340; i++) {
            bctx.fillStyle = 'rgba(255,255,255,' + (textureRng() * 0.045).toFixed(3) + ')';
            bctx.fillRect(textureRng() * 512, textureRng() * 392, 2, 2);
        }
        const chalk = 'rgba(238,244,238,0.88)';
        bctx.fillStyle = chalk;
        bctx.strokeStyle = chalk;
        bctx.font = '34px serif';
        bctx.textAlign = 'center';
        bctx.textBaseline = 'alphabetic';
        bctx.fillText('✦ ✧ ❖ ✧ ✦', 256, 52);
        bctx.lineWidth = 2;
        bctx.beginPath();
        bctx.moveTo(120, 68);
        bctx.lineTo(392, 68);
        bctx.stroke();
        bctx.beginPath();
        bctx.moveTo(150, 76);
        bctx.lineTo(362, 76);
        bctx.stroke();
        bctx.lineWidth = 2.2;
        bctx.beginPath();
        bctx.arc(120, 215, 62, 0, 7);
        bctx.stroke();
        bctx.beginPath();
        bctx.arc(120, 215, 40, 0, 7);
        bctx.stroke();
        bctx.beginPath();
        bctx.moveTo(120, 162);
        bctx.lineTo(167, 246);
        bctx.lineTo(73, 246);
        bctx.closePath();
        bctx.stroke();
        bctx.beginPath();
        bctx.moveTo(120, 268);
        bctx.lineTo(73, 184);
        bctx.lineTo(167, 184);
        bctx.closePath();
        bctx.stroke();
        for (let k = 0; k < 8; k++) {
            const a = k * Math.PI / 4;
            bctx.beginPath();
            bctx.moveTo(120 + Math.cos(a) * 62, 215 + Math.sin(a) * 62);
            bctx.lineTo(120 + Math.cos(a) * 70, 215 + Math.sin(a) * 70);
            bctx.stroke();
        }
        bctx.font = '22px serif';
        bctx.fillText('✦', 120, 223);
        bctx.textAlign = 'left';
        bctx.font = '26px serif';
        bctx.fillText('△ + ◯ ⇒ ✦', 245, 130);
        bctx.fillText('∴ ✦ ∝ ☽', 262, 172);
        bctx.fillText('☾ ∝ ✱ ∝ ❍', 248, 214);
        bctx.fillText('⟡ ☽ → ● ⟡', 250, 258);
        bctx.fillText('☽ ◐ ● ◑ ☾', 250, 308);
        bctx.font = '16px serif';
        bctx.fillText('✧', 60, 110);
        bctx.fillText('✦', 440, 100);
        bctx.fillText('✧', 470, 225);
        bctx.fillText('✦', 62, 335);
        bctx.fillText('✧', 310, 350);
        bctx.fillText('❖', 455, 175);

        function sticker(x, y, w, h, col, rot) {
            bctx.save();
            bctx.translate(x, y);
            bctx.rotate(rot);
            bctx.fillStyle = col;
            bctx.fillRect(-w / 2, -h / 2, w, h);
            bctx.strokeStyle = 'rgba(0,0,0,0.35)';
            bctx.lineWidth = 2;
            bctx.strokeRect(-w / 2, -h / 2, w, h);
            bctx.fillStyle = 'rgba(255,255,255,0.45)';
            bctx.fillRect(-w / 2 - 8, -h / 2 - 6, 16, 10);
            bctx.restore();
        }
        sticker(455, 335, 46, 34, '#ffd166', 0.3);
        sticker(52, 185, 38, 30, '#ff8fab', -0.35);
        sticker(462, 58, 36, 28, '#8fd6ff', 0.15);
        boardTex.needsUpdate = true;
    }
    const boardTex = new THREE.CanvasTexture(boardCanvas);
    drawBoardFace();
    put(log(1.55, 0.035), -0.56, 0.77, 0.04, 0.05, 0, 0.05, boardTilt);
    put(log(1.55, 0.035), 0.56, 0.77, 0.04, 0.05, 0, -0.05, boardTilt);
    put(log(1.40, 0.035), 0.00, 0.70, -0.32, 0.30, 0, 0, boardTilt);
    put(log(1.10, 0.025), 0.00, 0.45, 0.06, 0, 0, Math.PI / 2, boardTilt);
    put(log(1.10, 0.025), 0.00, 1.30, 0.02, 0, 0, Math.PI / 2, boardTilt);
    put(box(1.27, 1.00, 0.06), 0, 1.00, 0, 0, 0, 0, boardTilt);
    {
        const woodSide = LITMAT(0xe8e2d0);
        const faceMat = new THREE.MeshBasicMaterial({ map: boardTex });
        const faceMesh = new THREE.Mesh(new THREE.BoxGeometry(1.13, 0.86, 0.03), [woodSide, woodSide, woodSide, woodSide, faceMat, woodSide]);
        faceMesh.position.set(0, 1.00, 0.032);
        boardTilt.add(faceMesh);
        const eLines = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.13, 0.86, 0.03)), MAT);
        eLines.position.set(0, 1.00, 0.032);
        boardTilt.add(eLines);
    }
    put(box(1.20, 0.04, 0.14), 0, 0.54, 0.09, 0, 0, 0, boardTilt);
    const notes = [
        { col: '#ffe66d', txt: '采月光草', rz: 0.12, px: -0.40, py: 1.26 },
        { col: '#ffb3c6', txt: '归还魔法书', rz: -0.08, px: -0.05, py: 1.14 },
        { col: '#aecdff', txt: '作者：YIBI2333', rz: 0.18, px: 0.36, py: 0.84 }
    ];
    for (let i = 0; i < notes.length; i++) {
        const n = notes[i];
        n.canvas = document.createElement('canvas');
        n.canvas.width = 128;
        n.canvas.height = 128;
        n.ctx = n.canvas.getContext('2d');
        n.tex = new THREE.CanvasTexture(n.canvas);
        drawNote(i);
        const g = new THREE.Group();
        const sideMat = LITMAT(0xffffff);
        const faceMat = new THREE.MeshBasicMaterial({ map: n.tex });
        g.add(new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.17, 0.008), [sideMat, sideMat, sideMat, sideMat, faceMat, sideMat]));
        g.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.17, 0.17, 0.008)), MAT));
        g.position.set(n.px, n.py, 0.052);
        g.rotation.z = n.rz;
        boardTilt.add(g);
        n.g = g;
    }

    function drawNote(i) {
        const n = notes[i];
        const c = n.ctx;
        c.fillStyle = n.col;
        c.fillRect(0, 0, 128, 128);
        c.fillStyle = 'rgba(0,0,0,0.08)';
        c.fillRect(0, 112, 128, 16);
        c.fillStyle = 'rgba(255,255,255,0.55)';
        c.fillRect(44, 0, 40, 14);
        const len = Math.max(n.txt.length, 1);
        const size = len <= 3 ? 34 : len <= 5 ? 26 : len <= 7 ? 20 : 16;
        c.fillStyle = '#3a3a3a';
        c.font = 'bold ' + size + 'px "Microsoft YaHei", monospace';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(n.txt, 64, 68);
        n.tex.needsUpdate = true;
    }

    function openNoteEditor(i) {
        s.noteEditing = i;
        const ed = document.getElementById('noteEditor');
        const inp = document.getElementById('noteInput');
        inp.value = notes[i].txt;
        ed.classList.add('show');
        inp.focus();
        inp.select();
    }

    /* —— 便签编辑器（原先在 `systems/ui/editors/NoteEditor.js`，`J4.43` 按裁决搬回物件）—— */
    const noteInput = document.getElementById('noteInput');
    const noteEditor = document.getElementById('noteEditor');
    function applyNote() {
        notes[s.noteEditing].txt = noteInput.value.trim() || '...';
        drawNote(s.noteEditing);
        noteEditor.classList.remove('show');
        noteInput.blur();
        SND.play('chim');
    }
    document.getElementById('noteOk').addEventListener('click', applyNote);
    noteInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') applyNote();
        if (e.key === 'Escape') {
            noteEditor.classList.remove('show');
            noteInput.blur();
        }
        e.stopPropagation();
    });

    const eraserG = new THREE.Group();
    eraserG.position.set(-0.30, 0.585, 0.09);
    boardTilt.add(eraserG);
    put(box(0.18, 0.05, 0.08), 0, 0, 0, 0, 0, 0, eraserG);
    put(iline([[-0.08, 0.028, -0.035], [-0.08, 0.028, 0.035]]), 0, 0, 0, 0, 0, 0, eraserG);

    /* ==================================================================== */
    /* ============ B 段：粉笔与字形组 ==================================== */
    /* ==================================================================== */

    const GLYPHS = ['✦', '☾', '✧', '∴', '⟡', '✱', '☽', '✸'];
    const GLYPH_WARM = ['#fff3c9', '#ffd97a'];
    const GLYPH_COOL = ['#d9fbff', '#8ff3ff'];
    const glyphCanvas = document.createElement('canvas');
    glyphCanvas.width = 512;
    glyphCanvas.height = 200;
    const gctx = glyphCanvas.getContext('2d');
    const glyphTex = new THREE.CanvasTexture(glyphCanvas);
    const glyphPlane = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.4), new THREE.MeshBasicMaterial({ map: glyphTex, transparent: true, opacity: 0, depthWrite: false }));
    glyphPlane.position.set(0, 0.95, 0.056);
    glyphPlane.renderOrder = 10;
    boardTilt.add(glyphPlane);

    function drawGlyphSet(curIdx, prog) {
        gctx.clearRect(0, 0, 512, 200);
        for (let i = 0; i < GLYPHS.length; i++) {
            const gx = 40 + i * 62;
            const gy = 100 + Math.sin(i * 1.3) * 14;
            const warm = i % 2 === 1;
            const col = warm ? GLYPH_WARM[0] : GLYPH_COOL[0];
            const tr0 = warm ? 'rgba(255,243,201,0)' : 'rgba(217,251,255,0)';
            gctx.save();
            gctx.shadowColor = warm ? GLYPH_WARM[1] : GLYPH_COOL[1];
            gctx.shadowBlur = 22;
            gctx.font = 'bold 64px serif';
            gctx.textAlign = 'center';
            gctx.textBaseline = 'middle';
            if (i < curIdx) {
                gctx.fillStyle = col;
                gctx.fillText(GLYPHS[i], gx, gy);
            } else if (i === curIdx) {
                const p = Math.max(0, Math.min(1, prog));
                const top = gy - 38, bot = gy + 38;
                const grad = gctx.createLinearGradient(0, top, 0, bot);
                const wipe = top + (bot - top) * p;
                const g0 = Math.max(0, (wipe - top) / (bot - top));
                grad.addColorStop(0, col);
                grad.addColorStop(Math.max(0.001, g0 - 0.02), col);
                grad.addColorStop(Math.min(0.999, g0 + 0.02), tr0);
                grad.addColorStop(1, tr0);
                gctx.fillStyle = grad;
                gctx.fillText(GLYPHS[i], gx, gy);
            }
            gctx.restore();
        }
        glyphTex.needsUpdate = true;
    }
    drawGlyphSet(0, 0);
    const chalkG = new THREE.Group();
    const CHALK_HOME = V(0.18, 0.578, 0.09);
    chalkG.position.copy(CHALK_HOME);
    boardTilt.add(chalkG);
    put(edge(new THREE.CylinderGeometry(0.013, 0.013, 0.11, 8)), 0, 0, 0, 0, 0, Math.PI / 2, chalkG);
    put(edge(new THREE.CircleGeometry(0.011, 8)), 0.056, 0, 0, 0, Math.PI / 2, 0, chalkG);
    const glyphLocalX = i => ((40 + i * 62) / 512 - 0.5) * 1.0;
    const glyphLocalY = i => 0.95 - (Math.sin(i * 1.3) * 14) / 200 * 0.4;

    /** 原 `updateChalk(time)` —— 逐字搬运（`chalkState.active/start` → `s.chalkActive/chalkStart`） */
    function updateChalk(time) {
        if (!s.chalkActive) return;
        const RISE = 0.7, WPS = 0.55, HOLD = 1.8, FADE = 0.8, FALL = 0.7;
        const N = GLYPHS.length;
        const tWrite = RISE + N * WPS;
        const tHold = tWrite + HOLD;
        const tFade = tHold + FADE;
        const tEnd = tFade + FALL;
        const e = time - s.chalkStart;
        if (e < RISE) {
            const k = smooth(e / RISE);
            const i = 0;
            chalkG.position.lerpVectors(CHALK_HOME, V(glyphLocalX(i) + 0.06, glyphLocalY(i) + 0.05, 0.10), k);
            chalkG.position.y += Math.sin(e * 10) * 0.02 * k;
            glyphPlane.material.opacity = 0;
        } else if (e < tWrite) {
            const k = (e - RISE) / WPS;
            const i = Math.min(Math.floor(k), N - 1);
            const prog = k - i;
            drawGlyphSet(i, prog);
            glyphPlane.material.opacity = Math.min(1, (e - RISE) * 3);
            const revealY = glyphLocalY(i) + (prog - 0.5) * 0.15;
            chalkG.position.set(
                glyphLocalX(i) + 0.06 + Math.sin(time * 26) * 0.012,
                Math.min(glyphLocalY(i) + 0.05, revealY + 0.03) + Math.sin(time * 19) * 0.008, 0.10
            );
        } else if (e < tHold) {
            drawGlyphSet(N, 1);
            glyphPlane.material.opacity = 0.75 + 0.25 * Math.sin(time * 4);
            const i = N - 1;
            chalkG.position.set(glyphLocalX(i) + 0.06, glyphLocalY(i) + 0.05, 0.10);
        } else if (e < tFade) {
            glyphPlane.material.opacity = Math.max(0, 1 - (e - tHold) / FADE);
            const i = N - 1;
            chalkG.position.set(glyphLocalX(i) + 0.06, glyphLocalY(i) + 0.05, 0.10);
        } else if (e < tEnd) {
            const k = smooth((e - tFade) / FALL);
            glyphPlane.material.opacity = 0;
            chalkG.position.lerpVectors(V(glyphLocalX(N - 1) + 0.06, glyphLocalY(N - 1) + 0.05, 0.10), CHALK_HOME, k);
        } else {
            s.chalkActive = false;
            glyphPlane.material.opacity = 0;
            drawGlyphSet(0, 0);
            chalkG.position.copy(CHALK_HOME);
        }
    }

    /* ==================================================================== */
    /* ============ C 段：卷轴工厂 + 4 个卷轴 ============================= */
    /* ==================================================================== */

    const SCROLL_R = 0.055;

    function scrollRoll(x, z, ry, y) {
        const s2 = new THREE.Group();
        const body = edge(new THREE.CylinderGeometry(SCROLL_R, SCROLL_R, 0.52, 10));
        body.rotation.z = Math.PI / 2;
        s2.add(body);
        for (const ex of [-0.26, 0.26]) {
            const c = edge(new THREE.CircleGeometry(SCROLL_R * 0.9, 10), 1, IN_MAT);
            c.position.x = ex;
            c.rotation.y = Math.sign(ex) * Math.PI / 2;
            s2.add(c);
        }
        const band = edge(new THREE.TorusGeometry(SCROLL_R + 0.003, 0.012, 6, 16));
        band.rotation.y = Math.PI / 2;
        band.position.x = 0.10;
        s2.add(band);
        s2.position.set(x, y !== undefined ? y : FY + SCROLL_R, z);
        s2.rotation.y = ry;
        scene.add(s2);
    }
    scrollRoll(-3.42, 3.28, 0.42);
    scrollRoll(-3.44, 3.50, 0.42);
    scrollRoll(-3.43, 3.39, 0.42, FY + SCROLL_R * (1 + Math.sqrt(3)));
    scrollRoll(-3.72, 3.02, 1.05);

    return {
      root: boardG,
      parts: {
        boardG, boardTilt, boardTex, boardCanvas, bctx,
        notes, eraserG, chalkG, CHALK_HOME, glyphPlane, glyphTex, glyphCanvas,
        glyphLocalX, glyphLocalY, SCROLL_R,
        // ★ J4.51：`noteInput` 已从 `parts` 移除 —— 跨层豁免取消，系统层改用统一判据
        openNoteEditor, updateChalk,
        consts: { BOARD_X: -2.9, BOARD_Z: 2.8 },
      },
    }
  },

  /**
   * 原 18.8 段里的 5 处 `regMagic`：
   * 3 张便签各一条（`onActivate: () => openNoteEditor(i)`）+ 橡皮擦一条 + 粉笔一条。
   * ⚠️ 与原实现一致：**计划板本体上没有交互**（只能点便签 / 板擦 / 粉笔）。
   */
  interactables: (s, { parts }) => [
    ...parts.notes.map((n, i) => ({
      id: `board/note-${i + 1}`,
      label: `编辑第 ${i + 1} 张便签`,
      mode: 'both',
      anchor: { x: parts.consts.BOARD_X, z: parts.consts.BOARD_Z },
      radius: 1.8,
      hits: n.g,
      onActivate: () => { parts.openNoteEditor(i) },
    })),
    {
      id: 'board/eraser',
      label: '翻开 / 收起板擦',
      mode: 'both',
      anchor: { x: parts.consts.BOARD_X, z: parts.consts.BOARD_Z },
      radius: 1.8,
      hits: parts.eraserG,
      onActivate: () => { s.eraserOpen = !s.eraserOpen },
    },
    {
      id: 'board/chalk',
      label: '拿起粉笔写一行字',
      mode: 'both',
      anchor: { x: parts.consts.BOARD_X, z: parts.consts.BOARD_Z },
      radius: 1.8,
      hits: parts.chalkG,
      onActivate: () => {
        if (!s.chalkActive) {
          s.chalkActive = true;
          s.chalkStart = s.now;
        }
      },
    },
  ],

  /**
   * 原 `FrameBody` 的 `frame/55`（板擦强度一阶低通）、`frame/56`（板擦翻面）、
   * `frame/57`（粉笔写字）**三条合并**而成 —— 三条**相邻** ⇒ 判据 ① 天然等价，
   * 内部顺序与原实现一致。登记在 `frame/55` 的位置。
   */
  update(dt, time, s, { parts }) {
    s.now = time;

    // —— 原 `frame/55` ——
    s.eraserT += ((s.eraserOpen ? 1 : 0) - s.eraserT) * 0.06;

    // —— 原 `frame/56` ——
    const ee = s.eraserT * s.eraserT * (3 - 2 * s.eraserT);
    parts.eraserG.rotation.x = Math.PI * ee;

    // —— 原 `frame/57`：`updateChalk(time)` ——
    parts.updateChalk(time);
  },
})
