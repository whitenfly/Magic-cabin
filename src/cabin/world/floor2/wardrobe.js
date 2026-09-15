/**
 * 18.10 二楼衣柜（双开门 + 底部抽屉 + 挂衣杆 + 挂衣 + 叠放衣物） —— `J3` 搬迁（B4）
 *
 * 来源：`legacy/monolith.js` 原 `18.10` 分区里 `/* 衣柜 *\/` 那一小节
 * （装配时 L4438–L4589：`const WD_W = 1.25;` 起，到该小节的裸块 `}` 止）。
 *
 * ## 与搬迁前逐项对应
 *
 * | 原来住哪 | 现在住哪 |
 * |---|---|
 * | 行内字面量 `-1.40 / 3.55`（`wardrobeG.position.set(...)`） | `world/layout.js` 的 `WD_X / WD_Z`（不变量 `N9`，数值一个没改） |
 * | `const WD_W / WD_D / WD_H / WD_COL / WD_DARK`（物件内部尺寸与配色） | 留在 `build()` 内（局部尺寸不进 `layout.js`） |
 * | `const wardrobeG / wardrobeDrawerG / dl / dr` + 几何 | `build()`，经 `{ root, parts }` 交出四个 Group |
 * | 抽屉与两扇门的开合进度 | **原样**：住在 `userData.slide`（`regSlide`）/ `userData.spring`（`registerHinge`）里 |
 * | 挂衣的晃动 | **原样**：`regWobble(hg)`（`ctx` 注入；`wobblers` / `updateWobblers` 仍住 monolith） |
 * | `regMagic(wardrobeDrawerG, () => { … })` | `interactables()` 一条（`label` 语义化 + `mode: 'both'`） |
 * | 两扇门的点击 | **不动**：仍是 monolith 既有的 hinge 通路（`registerHinge` + `userData.onToggle` / `aimLabel`），逐字留在 `build` 内 |
 *
 * 没有 `state()`：本件的全部可变状态原本就活在 `userData`（`slide` / `spring` / `closing`）里，
 * 不是顶层 `let`，也不需要新状态 ⇒ 逐字保留（不变量 `N7`：不新增全局可变状态）。
 *
 * ## ★ 三处**必须知情**的细节
 *
 * 1. **`startMarker` 不是 `/* 18.10 … *\/` 那个分区标题行。** 18.10 的标题行后面紧跟着
 *    **共享工具**（`cbox` / `crboxCol` / `crumpleBall` / `arcPos` / `wobblers` / `regWobble` /
 *    `updateWobblers`，当前 L4384–4435）—— 它们被 18.12 时钟 / 18.13 挂画 / 18.14 镜子 /
 *    18.16 纸箱 + `tickOnce()` 的 `updateWobblers(dt)`（L8379）引用，**必须留在 monolith**。
 *    若拿 18.10 标题行当 `startMarker`，这些工具会被一并删掉 ⇒ `ctx` 的
 *    `cbox` / `crboxCol` / `regWobble` 立即 `ReferenceError`（不是像素差异，是直接崩）。
 *    故本件的 `startMarker` 取衣柜小节自己的注释行 `            /* 衣柜 *\/`（全文唯一）。
 *
 * 2. **唯一改写的语句是抽屉的交互体。** 原 `regMagic` 的箭头函数里用了 `build` 闭包内的
 *    `doorsBothOpen()`（它住在抽屉几何之后），而 `interactables()` 看不到 `build` 的局部量 ——
 *    故把 `doorsBothOpen()` 的三项判据**逐字展开**进 `onActivate`（语义逐字等价：
 *    `dl.userData.spring.open && dr.userData.spring.open && !dl.userData.closing && !dr.userData.closing`）。
 *    `build` 内的 `doorsBothOpen` 本身一字未动（`closeWardrobeDoor` 仍在用）。
 *
 * 3. **原来的裸块 `{ … }` 被展开到 `build` 顶层**（只为把 `wardrobeDrawerG / dl / dr` 交给
 *    `parts`）。三者在原实现里是块级 `const`，块外拿不到 —— 展开后**没有**任何重名冲突
 *    （`p` / `knob` / `hw` / `hh` 各自住在更内层的子块里），对父子结构与渲染顺序**零影响**。
 *
 * 未用 `rng`：本件不消耗任何种子随机源 ⇒ 后续随机数序列不变（不变量 `N8`）。
 */
import * as THREE from 'three'
import { defineProp } from '../../app/defineProp.js'

export default defineProp({
  id: 'floor2/wardrobe',
  kind: 'furniture',

  build({ scene, L, put, edge, logBetween, iline, cbox, crboxCol, regSlide, registerHinge, regWobble, MAT, SND }) {
    const { WD_X, WD_Z, FY } = L

    const WD_W = 1.25;
    const WD_D = 0.58;
    const WD_H = 1.95;
    const WD_COL = 0xc9b391;
    const WD_DARK = 0x9a7d55;
    const wardrobeG = new THREE.Group();
    wardrobeG.position.set(WD_X, FY, WD_Z);
    wardrobeG.rotation.y = Math.PI;
    scene.add(wardrobeG);
    put(cbox(WD_W, WD_H, 0.04, WD_COL), 0, WD_H / 2, -WD_D / 2 + 0.02, 0, 0, 0, wardrobeG);
    put(cbox(0.04, WD_H, WD_D, WD_COL), -WD_W / 2 + 0.02, WD_H / 2, 0, 0, 0, 0, wardrobeG);
    put(cbox(0.04, WD_H, WD_D, WD_COL), WD_W / 2 - 0.02, WD_H / 2, 0, 0, 0, 0, wardrobeG);
    put(cbox(WD_W, 0.04, WD_D, WD_COL), 0, WD_H - 0.02, 0, 0, 0, 0, wardrobeG);
    put(cbox(WD_W, 0.45, WD_D, WD_COL), 0, 0.225, 0, 0, 0, 0, wardrobeG);
    const wardrobeDrawerG = new THREE.Group();
    wardrobeDrawerG.position.set(0, 0.20, WD_D / 2 - 0.10);
    wardrobeG.add(wardrobeDrawerG);
    {
        const p = crboxCol(WD_W - 0.08, 0.35, 0.05, 0.01, WD_DARK);
        p.position.set(0, 0, 0.05);
        wardrobeDrawerG.add(p);
        const knob = edge(new THREE.CylinderGeometry(0.017, 0.017, 0.03, 8));
        knob.rotation.x = Math.PI / 2;
        knob.position.set(0, 0, 0.092);
        wardrobeDrawerG.add(knob);
        const drawerInsideMat = new THREE.MeshBasicMaterial({ color: WD_DARK, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
        const insideGeo = new THREE.BoxGeometry(WD_W - 0.12, 0.25, WD_D - 0.2);
        const inside = new THREE.Group();
        inside.add(new THREE.Mesh(insideGeo, drawerInsideMat));
        inside.add(new THREE.LineSegments(new THREE.EdgesGeometry(insideGeo), MAT));
        inside.position.set(0, 0, -0.10);
        wardrobeDrawerG.add(inside);
    }
    regSlide(wardrobeDrawerG, 'z', 0.25);
    // 原 `regMagic(wardrobeDrawerG, () => { … })`：几何侧的注册由 `installProp` 的 aim 桥代劳，
    // onActivate 的搬迁见本文件头「细节 2」。音效仍是 monolith `fireMagic` 的默认 `toggle`。
    const ROD_Y = 1.50;
    const ROD_Z = -0.05;
    for (const sx of [-1, 1]) {
        put(cbox(0.07, 0.07, 0.07, WD_DARK), sx * (WD_W / 2 - 0.06), ROD_Y, ROD_Z, 0, 0, 0, wardrobeG);
    }
    const rod = edge(new THREE.CylinderGeometry(0.016, 0.016, WD_W - 0.10, 8));
    rod.rotation.z = Math.PI / 2;
    rod.position.set(0, ROD_Y, ROD_Z);
    wardrobeG.add(rod);

    function makeHanger(hx, clothCol) {
        const hg = new THREE.Group();
        hg.position.set(hx, ROD_Y, ROD_Z);
        hg.rotation.y = Math.PI / 2;
        wardrobeG.add(hg);
        const hook = edge(new THREE.TorusGeometry(0.026, 0.005, 6, 12));
        hg.add(hook);
        put(edge(new THREE.CylinderGeometry(0.006, 0.006, 0.05, 6)), 0, -0.04, 0, 0, 0, 0, hg);
        logBetween([0, -0.065, 0], [-0.15, -0.17, 0], 0.007, hg);
        logBetween([0, -0.065, 0], [0.15, -0.17, 0], 0.007, hg);
        logBetween([-0.15, -0.17, 0], [0.15, -0.17, 0], 0.007, hg);
        if (clothCol !== null && clothCol !== undefined) {
            const cl = crboxCol(0.27, 0.30, 0.03, 0.035, clothCol);
            cl.position.set(0, -0.34, 0);
            hg.add(cl);
            hg.add(iline([[-0.05, -0.20, 0.018], [0, -0.23, 0.018], [0.05, -0.20, 0.018]]));
        }
        regWobble(hg);
    }
    makeHanger(-0.40, 0xe3b3b8);
    makeHanger(-0.12, null);
    makeHanger(0.34, 0xa9c6e2);
    const stackCols = [0xd9a5a0, 0xbcd4b0, 0xe6d9b8, 0xb9aede];
    let syL = 0.45;
    for (let i = 0; i < 4; i++) {
        const w = 0.35 - (i % 2) * 0.03;
        const d = 0.32 - (i % 2) * 0.02;
        const c = crboxCol(w, 0.07, d, 0.032, stackCols[i % stackCols.length]);
        c.position.set(-0.28, syL + 0.035, (i % 2 ? -0.012 : 0.010));
        c.rotation.y = (i % 2 ? 0.05 : -0.06);
        wardrobeG.add(c);
        syL += 0.07;
    }
    let syR = 0.45;
    for (let i = 0; i < 4; i++) {
        const w = 0.35 - (i % 2) * 0.03;
        const d = 0.32 - (i % 2) * 0.02;
        const c = crboxCol(w, 0.07, d, 0.032, stackCols[(i + 2) % stackCols.length]);
        c.position.set(0.28, syR + 0.035, (i % 2 ? -0.012 : 0.010));
        c.rotation.y = (i % 2 ? 0.05 : -0.06);
        wardrobeG.add(c);
        syR += 0.07;
    }
    const doorW = WD_W / 2 - 0.02;
    const doorH = WD_H - 0.10;
    const dl = new THREE.Group();
    dl.userData = { base: 0, delta: -1.8 };
    dl.position.set(-WD_W / 2 + 0.02, WD_H / 2, WD_D / 2 + 0.025);
    wardrobeG.add(dl);
    {
        const p = crboxCol(doorW - 0.03, doorH, 0.035, 0.012, WD_COL);
        p.position.set(doorW / 2, 0, 0);
        dl.add(p);
        const hw = doorW / 2 - 0.10, hh = doorH / 2 - 0.14;
        dl.add(iline([
            [doorW / 2 - hw, -hh, 0.022], [doorW / 2 + hw, -hh, 0.022],
            [doorW / 2 + hw, hh, 0.022], [doorW / 2 - hw, hh, 0.022],
            [doorW / 2 - hw, -hh, 0.022]
        ]));
        const knob = edge(new THREE.CylinderGeometry(0.016, 0.016, 0.03, 8));
        knob.rotation.x = Math.PI / 2;
        knob.position.set(doorW - 0.10, 0, 0.038);
        dl.add(knob);
    }
    registerHinge(dl);
    const dr = new THREE.Group();
    dr.userData = { base: 0, delta: 1.8 };
    dr.position.set(WD_W / 2 - 0.02, WD_H / 2, WD_D / 2 + 0.025);
    wardrobeG.add(dr);
    {
        const p = crboxCol(doorW - 0.03, doorH, 0.035, 0.012, WD_COL);
        p.position.set(-doorW / 2, 0, 0);
        dr.add(p);
        const hw = doorW / 2 - 0.10, hh = doorH / 2 - 0.14;
        dr.add(iline([
            [-doorW / 2 - hw, -hh, 0.022], [-doorW / 2 + hw, -hh, 0.022],
            [-doorW / 2 + hw, hh, 0.022], [-doorW / 2 - hw, hh, 0.022],
            [-doorW / 2 - hw, -hh, 0.022]
        ]));
        const knob = edge(new THREE.CylinderGeometry(0.016, 0.016, 0.03, 8));
        knob.rotation.x = Math.PI / 2;
        knob.position.set(-(doorW - 0.10), 0, 0.038);
        dr.add(knob);
    }
    registerHinge(dr);
    /* 关衣柜门时若底部抽屉还开着，先收抽屉再关门，避免穿模；抽屉必须两扇门都开才能拉出 */
    const doorsBothOpen = () => dl.userData.spring.open && dr.userData.spring.open && !dl.userData.closing && !dr.userData.closing;
    const closeWardrobeDoor = door => {
        const s = door.userData.spring;
        if (!s.open || !wardrobeDrawerG.userData.slide.open) { s.open = !s.open; SND.play('toggle'); return; }
        wardrobeDrawerG.userData.slide.open = false; SND.play('toggle');
        door.userData.closing = true;
        setTimeout(() => { door.userData.closing = false; s.open = false; SND.play('toggle'); }, 420);
    };
    dl.userData.onToggle = () => closeWardrobeDoor(dl);
    dr.userData.onToggle = () => closeWardrobeDoor(dr);
    dl.userData.aimLabel = dr.userData.aimLabel = '开 / 关衣柜门';
    dl.userData.bounce = dr.userData.bounce = true; /* 关门回弹打到关闭位反弹，不向内穿进柜体 */
    wardrobeDrawerG.userData.aimLabel = '开 / 关抽屉';

    // 返回根 + 三个后续要访问的 Group：`installProp` 把 `parts` 交给 `interactables()`
    return { root: wardrobeG, parts: { body: wardrobeG, drawer: wardrobeDrawerG, doorL: dl, doorR: dr } }
  },

  /**
   * 原 `regMagic(wardrobeDrawerG, …)` 的替身（`label` 语义化 + `mode: 'both'`，消解风险 `R1`）。
   *
   * 门的交互**不在这里重复声明** —— 它原本就不是 `regMagic`，而是 hinge 通路
   * （`registerHinge(dl/dr)` + `userData.onToggle` / `aimLabel`），两者都逐字留在 `build` 内，
   * 且 `interaction.registerAimSource({ id: 'hinges' })` 先于 `{ id: 'magic' }` 注册
   * ⇒ 门上的准星/点击仍解析到「开 / 关衣柜门」，与搬迁前一致。
   * 声明成第二条近距条目只会新增一条同锚点的 proximity（第三人称提示会变），故不加。
   */
  interactables: (s, { L, parts, SND }) => [{
    id: 'wardrobe/drawer',
    label: '开 / 关抽屉',
    mode: 'both',
    // 锚点与几何同源：衣柜根就落在 L.WD_X / L.WD_Z（不变量 N9）
    anchor: { x: L.WD_X, z: L.WD_Z },
    radius: 1.8,
    onActivate: () => {
      // 原 `regMagic` 的箭头函数体逐字搬运；`doorsBothOpen()`（build 闭包内）按本文件头「细节 2」展开
      const sl = parts.drawer.userData.slide;
      const bothOpen = parts.doorL.userData.spring.open && parts.doorR.userData.spring.open
        && !parts.doorL.userData.closing && !parts.doorR.userData.closing;
      if (!sl.open && !bothOpen) { SND.play('ui'); return; }
      sl.open = !sl.open;
    },
  }],
})
