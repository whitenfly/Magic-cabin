/**
 * 18.13 前墙挂画（镜子旁；点击编辑图片链接，支持 gif 动图） —— `J3` 搬迁（B5）
 *
 * 来源：`legacy/monolith.js` 原 `18.13` 分区（4104–4206 行区间内：木框 + 画布 + `picState` +
 * `drawPicBlank` / `drawPicImage` / `PIC_SOURCES` / `tryLoadPic` / `setPicture` /
 * `openPicEditor` / `applyPic` + 两个 DOM 监听 + `regMagic`），以及 `updateNewDecor()` 里
 * **那 4 行 GIF 重绘**（`if (picState.img && time - picState.lastT > 0.1) { … }`）。
 *
 * ## ★ 本轮为什么可以搬了（上一轮 B4 判为 SKIP）
 *
 * 上一轮的判断（见 `floor2-picture.SKIP.md`）是：`picState` 与 `drawPicImage` 在区间**外**
 * 被 `updateNewDecor()` 读了 4 行，而"应用器只做整段替换、摘不掉区间外的这 4 行"，
 * 一旦删了几何段就会 `ReferenceError` ⇒ 装饰循环整条停摆。
 *
 * **本轮的差别只有一个：应用器现在支持 `spec.tick`（逐字替换任意一处唯一原文）** ——
 * 正是 `floor2/mirror`（`updateNewDecor` 里 8 行）与 `floor2/junkBoxes`（6 行）用过的同一机制。
 * 于是"人工去改区间外那 4 行"这一步被 spec 声明下来、由应用器代劳，
 * **GIF 动图这个功能完整保住**（上一轮的备选方案"只搬几何、把那 4 行删掉"等于静默废掉它，
 * 那份 SKIP 已明确拒绝）。
 *
 * ## 搬迁对照
 *
 * | 原来住哪 | 现在住哪 |
 * |---|---|
 * | 行内 `(1.45, FY + 1.55, 3.82)` | `world/layout.js` 的 `PIC_POS`（**沿用 SKIP.md §4 的配方**，不变量 `N9`） |
 * | 顶层 `const picState = { url, img, lastT }` | `state()`（`build` 里以原名 `picState` 别住，绘制/加载函数一字未改） |
 * | `regMagic(picG, openPicEditor)` | `interactables()`（`label` 语义化 + `mode: 'both'`） |
 * | `updateNewDecor()` 的 4 行 GIF 重绘 | `update()`（**原地 tick**，参数顺序 `(dt, time)`） |
 *
 * `drawPicBlank / drawPicImage / tryLoadPic / setPicture / openPicEditor / applyPic` 与
 * **两个 DOM 监听**全部留在 `build()` 里 —— 与搬迁前**完全同一个位置、同一个时机**
 * （`build` 仍在 monolith 的原位置被调用）⇒ 监听注册顺序不变、`SND.play('chim')` 的时机不变。
 *
 * ## ★ 两行"新增胶水"（本文件唯一多出来的代码）
 *
 * `state.drawPicImage = drawPicImage;` / `state.openPicEditor = openPicEditor;` ——
 * 这两个闭包住在 `build` 里，而 `update` 与 `interactables` 需要它们。
 * 与 `floor2/mirror.js` 交出 `state.drawMirror` / `state.spawnRipple` 是同一手法。
 *
 * ## ⚠️ 知情：准星文案由 `'交互'` 变成 `'编辑挂画图片链接'`
 *
 * 这是 `J3` 的 DoD 要的「`label` 有语义」在地面上的落法，与其它已搬物件（扫帚 / 魔女帽 /
 * 纸箱…）一致；但它确实是**可见文案变化**，按"新增式改动"该机位应单独审一眼
 * （`SKIP.md` §4 已预先声明）。点击音效不变：原实现没有 `userData.sfx`，
 * `fireMagic` 里 `o.userData.sfx || 'toggle'` 落到同一个 `'toggle'`（`installProp` 补的也是它）。
 *
 * ## `clock.now` 不需要
 *
 * 原 `updateNewDecor()` 里用的是形参 `time`（不是 `clock.now`）⇒ `update` 直接用形参；
 * `picState.lastT = time` 存的仍是**动画时间**，语义与搬迁前一致。
 *
 * ## 门禁提醒
 *
 * 段内两行 `addEventListener(` 随几何段移出 monolith ⇒ `scripts/verify-migration.mjs` ④ 的
 * `addEventListener(` 计数会再 −2（镜子的先例已把 `J25_DELTA` 调过一次）；
 * `regMagic(` 再 −1。这两处期望值需同步（`J3` 期间本就在按批次更新）。
 */
import * as THREE from 'three'
import { defineProp } from '../../app/defineProp.js'

export default defineProp({
  id: 'floor2/picture',
  kind: 'decor',

  /** 原顶层 `const picState = { url: '', img: null, lastT: 0 }`（`build` 里以原名别住） */
  state: () => ({ url: '', img: null, lastT: 0, drawPicImage: null, openPicEditor: null }),

  build({ scene, L, put, cbox, colEdge, iline, SND, state }) {
    const { PIC_POS, FY } = L

    const picG = new THREE.Group();
    picG.position.set(PIC_POS.x, FY + PIC_POS.y, PIC_POS.z);
    picG.rotation.y = Math.PI;
    scene.add(picG);
    {
        const FR_W = 0.72, FR_H = 0.54, FR_B = 0.06;
        put(cbox(FR_W, FR_B, 0.04, 0x8a6238), 0, FR_H / 2 - FR_B / 2, 0, 0, 0, 0, picG);
        put(cbox(FR_W, FR_B, 0.04, 0x8a6238), 0, -FR_H / 2 + FR_B / 2, 0, 0, 0, 0, picG);
        put(cbox(FR_B, FR_H - 2 * FR_B, 0.04, 0x8a6238), -FR_W / 2 + FR_B / 2, 0, 0, 0, 0, 0, picG);
        put(cbox(FR_B, FR_H - 2 * FR_B, 0.04, 0x8a6238), FR_W / 2 - FR_B / 2, 0, 0, 0, 0, 0, picG);
        put(cbox(FR_W - 2 * FR_B, FR_H - 2 * FR_B, 0.016, 0xf5efdf), 0, 0, -0.006, 0, 0, 0, picG);
        put(colEdge(new THREE.CylinderGeometry(0.011, 0.011, 0.05, 6), 0x5a4128), 0, 0.52, -0.03, Math.PI / 2, 0, 0, picG);
        picG.add(iline([[-0.26, 0.25, 0.005], [0, 0.50, -0.012], [0.26, 0.25, 0.005]]));
    }
    const picCv = document.createElement('canvas');
    picCv.width = 256;
    picCv.height = 176;
    const pctx = picCv.getContext('2d');
    const picTex = new THREE.CanvasTexture(picCv);
    const picPlane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: picTex }));
    picPlane.position.set(0, 0, 0.008);
    picPlane.scale.set(0.58, 0.40, 1);
    picG.add(picPlane);
    const picState = state;   // 原顶层 `const picState = { url: '', img: null, lastT: 0 };` → state（**同一个对象实例**，下面函数体一字未改）
    function drawPicBlank() {
        pctx.fillStyle = '#f7f2e6';
        pctx.fillRect(0, 0, 256, 176);
        pctx.strokeStyle = 'rgba(180,168,140,0.5)';
        pctx.lineWidth = 2;
        pctx.strokeRect(6, 6, 244, 164);
        picTex.needsUpdate = true;
    }
    drawPicBlank();
    function drawPicImage() {
        const img = picState.img;
        if (!img || !img.width || !img.height) return;
        const iw = img.width, ih = img.height;
        const maxW = 244, maxH = 164;
        const a = iw / ih;
        let w = maxW, h = maxW / a;
        if (h > maxH) { h = maxH; w = maxH * a; }
        pctx.fillStyle = '#f7f2e6';
        pctx.fillRect(0, 0, 256, 176);
        pctx.drawImage(img, (256 - w) / 2, (176 - h) / 2, w, h);
        picTex.needsUpdate = true;
    }
    /* 图片加载：直连失败时依次走中转代理（解决防盗链 / 无CORS / http链接） */
    const PIC_SOURCES = [
        function (u) { return u; },
        function (u) { return 'https://images.weserv.nl/?url=' + encodeURIComponent(u); },
        function (u) { return 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u); },
        function (u) { return 'https://corsproxy.io/?url=' + encodeURIComponent(u); }
    ];
    function tryLoadPic(url, idx) {
        if (idx >= PIC_SOURCES.length) {
            picState.img = null;
            drawPicBlank();
            return;
        }
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = function () {
            if (!img.width || !img.height) { tryLoadPic(url, idx + 1); return; }
            picState.img = img;
            picState.lastT = 0;
            drawPicImage();
        };
        img.onerror = function () { tryLoadPic(url, idx + 1); };
        img.src = PIC_SOURCES[idx](url);
    }
    function setPicture(url) { tryLoadPic(url, 0); }
    function openPicEditor() {
        const ed = document.getElementById('picEditor');
        const inp = document.getElementById('picInput');
        inp.value = picState.url;
        ed.classList.add('show');
        inp.focus();
        inp.select();
    }
    // 原 `regMagic(picG, openPicEditor);` → `interactables()`（label 语义化 + mode both）
    function applyPic() {
        let u = document.getElementById('picInput').value.trim();
        document.getElementById('picEditor').classList.remove('show');
        document.getElementById('picInput').blur();
        if (!u) return;
        if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
        picState.url = u;
        setPicture(u);
        SND.play('chim');
    }
    document.getElementById('picOk').addEventListener('click', applyPic);
    document.getElementById('picInput').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') applyPic();
        if (e.key === 'Escape') {
            document.getElementById('picEditor').classList.remove('show');
            document.getElementById('picInput').blur();
        }
        e.stopPropagation();
    });

    // 交接：`update` 要重绘 GIF 帧；`interactables` 要打开编辑器（本文件唯一的"新增胶水"，两行）
    state.drawPicImage = drawPicImage;
    state.openPicEditor = openPicEditor;

    return { root: picG, parts: { frame: picG, plane: picPlane } }
  },

  /** 原 `regMagic(picG, openPicEditor)` 的替身（`label` 语义化 + `mode: 'both'`） */
  interactables: (s, { L }) => [{
    id: 'picture/edit-link',
    label: '编辑挂画图片链接',
    mode: 'both',
    // 锚点与几何同源：画框中心就是 `PIC_POS`（不变量 N9）
    anchor: { x: L.PIC_POS.x, z: L.PIC_POS.z },
    radius: 1.6,
    onActivate: () => { s.openPicEditor(); },
  }],

  /** 原 `updateNewDecor()` 里那 4 行（GIF 帧重绘），逐字搬运 */
  update(dt, time, s) {
    if (s.img && time - s.lastT > 0.1) {
      s.drawPicImage();
      s.lastT = time;
    }
  },
})
