/**
 * 12.2 星象仪 —— `J3` 搬迁（B4：几何 + 状态 + 交互 + 每帧分支）
 *
 * 来源：`legacy/monolith.js` 原 `12.2` 分区（搬迁时 `L711–747`）的**几何段**，
 * 以及 `tickOnce()` 里那段**无注释**的每帧分支（搬迁时 `L6684–6693`，紧跟
 * `for (const c of chairs)` 块之后、`updateLiquid(time);` 之前）。
 *
 * ## 搬迁对照
 *
 * | 原来住哪 | 现在住哪 |
 * |---|---|
 * | 顶层 `let orbOn = true, orbP = 1` | `state: () => ({ orbOn: true, orbP: 1 })`（**变量名一个没改**） |
 * | 顶层 `const orbRings = []` / `orbStars` / `orbG` | `build()` 内的同名局部量，经 `parts` 交出（**同一批实例**） |
 * | 行内 `MTX - 0.38` / `MTZ - 0.14` / `MTTOP` | 仍是同一个表达式，`MTX/MTZ/MTTOP` 从 `world/layout.js` 的坐标表解构（不变量 `N9`，数值一个没改） |
 * | `regMagic(orbG, …)` | `interactables()`（`label` 语义化 + `mode: 'both'`，消解风险 `R1`） |
 * | `tickOnce()` 里那 10 行 | `update()`，由 `tickOnce()` **原位置**调用 `orreryApi.tick(dt, time)` |
 *
 * ## 为什么 `OX/OZ` 不进 `layout.js`
 *
 * 原实现写的就是 `const OX = MTX - 0.38, OZ = MTZ - 0.14;` —— 派生式本身才是真源，
 * 把它算成字面量写进 `layout.js` 反而会引入**浮点末位差异**的风险（`1.8 - 0.38` 与 `1.42`
 * 不是同一个 double）。故照抄原表达式，`MTX/MTZ` 已经来自 `layout.js`（`N9` 满足）。
 *
 * ## `userData.sfx` 为什么写在 `build` 里
 *
 * 原实现是 `regMagic(orbG, …)` 之后写 `orbG.userData.sfx = 'magic'`。
 * `installProp` 的准星通路只在 `ud.sfx` **还不是字符串**时才填 `'toggle'`，
 * 所以 `build` 里先把 `'magic'` 放好，音效与搬迁前完全一致。
 *
 * 不用 `rng`（不消耗种子随机源，故不影响后续任何随机数序列）。
 */
import * as THREE from 'three'
import { defineProp } from '../../app/defineProp.js'

export default defineProp({
  id: 'floor1/orrery',
  kind: 'decor',

  state: () => ({ orbOn: true, orbP: 1 }),

  build({ scene, L, put, line, edge }) {
    const { MTX, MTZ, MTTOP } = L

    const OX = MTX - 0.38, OZ = MTZ - 0.14;
    const orbG = new THREE.Group();
    orbG.position.set(OX, MTTOP, OZ);
    put(edge(new THREE.CylinderGeometry(0.09, 0.12, 0.06, 10)), 0, 0.03, 0, 0, 0, 0, orbG);
    put(edge(new THREE.CylinderGeometry(0.035, 0.05, 0.05, 8)), 0, 0.08, 0, 0, 0, 0, orbG);
    put(edge(new THREE.SphereGeometry(0.15, 14, 10)), 0, 0.21, 0, 0, 0, 0, orbG);
    put(line([[0, 0.14, 0.13], [0, 0.24, 0.145], [0, 0.29, 0.08]]), 0, 0, 0, orbG);
    put(line([[0, 0.14, -0.13], [0, 0.24, -0.145], [0, 0.29, -0.08]]), 0, 0, 0, orbG);

    const orbRings = [];
    for (const [tilt, spd] of [[0.5, 1.0], [-0.42, -0.75], [Math.PI / 2, 0.55]]) {
        const holder = new THREE.Group();
        holder.position.y = 0.21;
        const t = edge(new THREE.TorusGeometry(0.21, 0.006, 6, 44));
        t.rotation.x = tilt;
        holder.add(t);
        const pl = edge(new THREE.SphereGeometry(0.018, 8, 6));
        pl.position.set(0.21, 0, 0);
        holder.add(pl);
        orbG.add(holder);
        orbRings.push({ holder, spd });
    }
    const orbStars = new THREE.Group();
    orbStars.position.y = 0.21;
    for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2;
        const st = edge(new THREE.OctahedronGeometry(0.022));
        st.position.set(Math.cos(a) * 0.27, Math.sin(a * 2) * 0.07, Math.sin(a) * 0.27);
        orbStars.add(st);
    }
    orbG.add(orbStars);
    scene.add(orbG);
    // 音效必须在这里写好：`installProp` 的准星通路只在 `ud.sfx` 非字符串时才填 `'toggle'`
    orbG.userData.sfx = 'magic';

    // 每帧分支要逐环 / 逐星访问，故经 `parts` 交出（与 `broom` / `bookPile` 同法）
    return { root: orbG, parts: { body: orbG, rings: orbRings, stars: orbStars } }
  },

  // 原 `regMagic(orbG, () => { orbOn = !orbOn; })` 的回调体逐字搬来（状态量加 `s.` 前缀）。
  // 主入口同时给 aim（准星）与 proximity（近距）两条 —— 否则默认固定视角下点不开（风险 `R1`）
  interactables: (s, { L }) => [{
    id: 'orrery/toggle',
    label: '让星象仪转起来 / 停下来',
    mode: 'both',
    // 锚点与几何同源：都取自 `L.MTX / L.MTZ` 的同一对偏移（不变量 N9）
    anchor: { x: L.MTX - 0.38, z: L.MTZ - 0.14 },
    radius: 1.6,
    onActivate: () => { s.orbOn = !s.orbOn; },
  }],

  /** 原 `tickOnce()` 里那段**无注释**的分支（搬迁时 `L6684–6693`），逐字搬运 */
  update(dt, time, s, { parts }) {
    const orbRings = parts.rings, orbStars = parts.stars

    s.orbP += ((s.orbOn ? 1 : 0) - s.orbP) * 0.02;
    for (const r of orbRings) {
        r.holder.rotation.y += r.spd * 0.02 * s.orbP;
        const sc = Math.max(s.orbP, 0.001);
        r.holder.scale.set(sc, sc, sc);
        r.holder.visible = s.orbP > 0.02;
    }
    orbStars.rotation.y += 0.018 * s.orbP;
    orbStars.scale.setScalar(Math.max(s.orbP, 0.001));
    orbStars.visible = s.orbP > 0.03;
  },
})
