/**
 * 12.9b 沙漏 —— `J3` 搬迁（B2 简单开关动画）
 *
 * 来源：`legacy/monolith.js` 原 `12.9b` 分区（原 `index.html` L2025–2062）的**几何段**，
 * 以及 `tickOnce()` 里那段**每帧分支**（搬迁时 `L8494–8520`，`const target = hgFlip ? Math.PI : 0;` 起）。
 *
 * ## 与范例 B（`stovePlatform.js`）的差别：它有状态 + 交互 + 每帧逻辑
 *
 * | 原来住哪 | 现在住哪 |
 * |---|---|
 * | 顶层 `let hgFlip / hgRun / hgRot / hgRotV / hgSand` | `state: () => ({ … })`（**变量名一个没改**） |
 * | 顶层 `const HG_H / HG_MID`（物件内部尺寸） | 留在 `build()` 内（局部尺寸不进 `layout.js`） |
 * | 行内 `SFX` / `0.805 + HG_MID` / `-2.44` | `world/layout.js` 的 `HG_POS`（不变量 `N9`；数值一个没改） |
 * | `const hg / hgInner / pileTopG / pileBotG / hgStreams` + 几何 | `build()`，经 `{ root, parts }` 交出 |
 * | `regMagic(hg, () => { hgFlip = !hgFlip; hgSand = 1; hgRun = 5; })` | `interactables()`（`label` 语义化 + `mode: 'both'`） |
 * | `tickOnce()` 里的 `{ … }` 块 | `update()`，由 `tickOnce()` **原位置**调用 `hourglassApi.tick(dt, time)` |
 *
 * 最后一行是 `J3` 的过渡形态（见 [`installProp.js`](../../app/installProp.js) 文件头「原地 tick」）：
 * `UpdateScheduler` 到 `J4` 才接管主循环，所以 `update` 现在由 monolith **原地**调用 ——
 * 执行顺序一个字节都没变；`J4` 只需删掉那一行调用。
 *
 * ## 逐字搬运说明（唯一改写处）
 *
 * 原分支里的 `for (const s of hgStreams)` 会把循环变量命名为 `s`，与本物件
 * `update(dt, time, s, ctx)` 的**状态形参** `s` 撞名 —— 故仅此一处改名为 `stream`；
 * 其余每行与原分支逐字相同，状态变量只加 `s.` 前缀（名字保持不变，便于逐行对照）。
 *
 * 未用 `rng`（不消耗种子随机源 ⇒ 后续随机数序列不变）。
 */
import * as THREE from 'three'
import { defineProp } from '../../app/defineProp.js'

export default defineProp({
  id: 'floor1/hourglass',
  kind: 'furniture',

  state: () => ({ hgFlip: false, hgRun: 0, hgRot: 0, hgRotV: 0, hgSand: 1 }),

  build({ scene, L, put, edge, box, lloop, geo }) {
    const { HG_POS } = L

    const sandMat = new THREE.LineBasicMaterial({ color: 0xb08948 });
    const sloop = (pts, parent) => { const l = new THREE.LineLoop(geo(pts), sandMat); (parent || scene).add(l); return l; };
    const HG_H = 0.36, HG_MID = HG_H / 2;
    const hg = new THREE.Group();
    hg.position.set(HG_POS.x, HG_POS.y + HG_MID, HG_POS.z);
    scene.add(hg);
    const hgInner = new THREE.Group();
    hgInner.position.y = -HG_MID;
    hg.add(hgInner);
    {
        put(box(0.17, 0.016, 0.17), 0, 0.008, 0, 0, 0, 0, hgInner);
        put(box(0.17, 0.016, 0.17), 0, HG_H - 0.008, 0, 0, 0, 0, hgInner);
        for (const [px, pz] of [[-0.066, -0.066], [0.066, -0.066], [-0.066, 0.066], [0.066, 0.066]])
            put(edge(new THREE.CylinderGeometry(0.008, 0.008, HG_H - 0.032, 6)),
                px, HG_MID, pz, 0, 0, 0, hgInner);
        lloop([[-0.056, HG_H - 0.022], [-0.052, HG_H - 0.055], [-0.04, HG_H - 0.10], [-0.02, HG_H - 0.145],
        [-0.009, HG_H - 0.17], [0.009, HG_H - 0.17], [0.02, HG_H - 0.145], [0.04, HG_H - 0.10],
        [0.052, HG_H - 0.055], [0.056, HG_H - 0.022]], hgInner);
        lloop([[-0.009, 0.17], [-0.02, 0.145], [-0.04, 0.10], [-0.052, 0.055], [-0.056, 0.022],
        [0.056, 0.022], [0.052, 0.055], [0.04, 0.10], [0.02, 0.145], [0.009, 0.17]], hgInner);
    }
    const pileTopG = new THREE.Group(); pileTopG.position.set(0, 0.315, 0); hgInner.add(pileTopG);
    sloop([[-0.045, 0.02], [0.045, 0.02], [0, -0.08]], pileTopG);
    sloop([[-0.030, 0.02], [0.030, 0.02], [0, -0.05]], pileTopG);
    const pileBotG = new THREE.Group(); pileBotG.position.set(0, 0.045, 0); hgInner.add(pileBotG);
    sloop([[-0.045, -0.02], [0.045, -0.02], [0, 0.09]], pileBotG);
    sloop([[-0.030, -0.02], [0.030, -0.02], [0, 0.055]], pileBotG);
    const hgStreams = [];
    for (let i = 0; i < 3; i++) {
        const stream = new THREE.Line(geo([[0, 0, 0], [0, -0.02, 0]]), sandMat);
        hgInner.add(stream);
        stream.visible = false;
        hgStreams.push(stream);
    }

    // 「一件物件里有多个需要后续访问的 Group」⇒ 用 parts 交出去（与 broom 同法）
    return { root: hg, parts: { body: hg, inner: hgInner, pileTop: pileTopG, pileBot: pileBotG, streams: hgStreams } }
  },

  // 主入口同时给 aim（准星）与 proximity（近距）两条 —— 否则默认固定视角下点不开（风险 `R1`，验收 `BB2b`）
  interactables: (s, { L }) => [{
    id: 'hourglass/flip',
    label: '把沙漏翻过来',
    mode: 'both',
    // 锚点与几何同源：都取自 `L.HG_POS`（不变量 N9）
    anchor: { x: L.HG_POS.x, z: L.HG_POS.z },
    radius: 1.6,
    onActivate: () => { s.hgFlip = !s.hgFlip; s.hgSand = 1; s.hgRun = 5; },
  }],

  /** 原 `tickOnce()` 里沙漏那段分支，逐字搬运（`s` 前缀 / `stream` 改名见文件头） */
  update(dt, time, s, { parts }) {
    const hg = parts.body, pileTopG = parts.pileTop, pileBotG = parts.pileBot, hgStreams = parts.streams

    {
        const target = s.hgFlip ? Math.PI : 0;
        s.hgRotV += (target - s.hgRot) * 0.012;
        s.hgRotV *= 0.93;
        s.hgRot += s.hgRotV;
        hg.rotation.x = s.hgRot;
        if (s.hgRun > 0) {
            s.hgRun -= dt;
            s.hgSand = Math.max(0.2, s.hgRun / 5);
        }
        const topP = s.hgFlip ? pileBotG : pileTopG;
        const botP = s.hgFlip ? pileTopG : pileBotG;
        topP.scale.setScalar(0.25 + 0.75 * s.hgSand);
        botP.scale.setScalar(0.3 + 0.8 * (1 - s.hgSand));
        const settled = Math.abs(s.hgRot - target) < 0.3;
        const sv = s.hgRun > 0 && settled;
        for (let i = 0; i < hgStreams.length; i++) {
            const stream = hgStreams[i];
            stream.visible = sv;
            if (sv) {
                const prog = (time * 1.5 + i / 3) % 1;
                const y0 = 0.185;
                const y1 = s.hgFlip ? 0.235 : 0.14;
                stream.position.y = y0 + (y1 - y0) * prog;
            }
        }
    }
  },
})
