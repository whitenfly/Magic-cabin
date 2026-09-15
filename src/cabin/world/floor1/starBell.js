/**
 * 12.9d 旋转星铃（左墙书架上方的挂饰） —— `J3` 搬迁（B3：几何 + 状态 + 交互 + 每帧分支）
 *
 * 来源：`legacy/monolith.js` 原 `12.9d` 分区（搬迁时 `L1120–1141`）的**几何段**，
 * 以及 `tickOnce()` 里紧跟在 `/* ---- 楼梯下储物箱：开盖 + 矿石旋转起伏 ---- *\/` 块之后、
 * `/* ---- 大魔女坩埚 ---- *\/` 块之前的那个 `{ … }` 块（搬迁时 `L8192–8198`，
 * `carP += ((carOn ? 1 : 0) - carP) * 0.015;` 起）。★ 该每帧块**没有注释头**。
 *
 * ## 搬迁对照
 *
 * | 原来住哪 | 现在住哪 |
 * |---|---|
 * | 顶层 `let carOn / carP` | `state: () => ({ … })`（**变量名一个没改**） |
 * | 行内 `SFX / 1.975 / -3.05` | `world/layout.js` 的 `STARBELL_POS`（不变量 `N9`；数值一个没改） |
 * | `const car / carCanopy / carStars` + 几何 | `build()`，经 `{ root, parts }` 交出 |
 * | `regMagic(car, () => { carOn = !carOn; })` | `interactables()`（`label` 语义化 + `mode: 'both'`） |
 * | `tickOnce()` 里那个 `{ … }` 块 | `update()`，由 `tickOnce()` **原位置**调用 `starBellApi.tick(dt, time)` |
 *
 * ★ `SFX`（`-3.72`）是 monolith 里「12.9 左墙书架 + 可抽拉的书」那个分区的局部常量，
 * 住在替换区间**之外**（它还被书架几何与碰撞盒引用）。星铃只是借它当 x 坐标，
 * 故按不变量 `N9` 把**同一个数值**写进 `layout.js` 的 `STARBELL_POS.x` ——
 * 数值一个没改，世界坐标逐位相同（与 `12.9b 沙漏` 的 `HG_POS` 同一处理）。
 *
 * ## 逐字搬运说明
 *
 * 几何段与每帧分支**逐行相同**（只改缩进）：状态变量只加 `s.` 前缀（名字一个没改）、
 * `carCanopy` / `carStars` 经 `parts` 取回同名局部量。
 * 未用 `rng`（不消耗种子随机源 ⇒ 后续随机数序列不变）。
 *
 * 本件只按需解构 ctx 的 `scene / L / put / edge / line`。
 */
import * as THREE from 'three'
import { defineProp } from '../../app/defineProp.js'

export default defineProp({
  id: 'floor1/star-bell',
  kind: 'decor',

  state: () => ({ carOn: false, carP: 0 }),

  build({ scene, L, put, edge, line }) {
    const { STARBELL_POS } = L

    const car = new THREE.Group();
    car.position.set(STARBELL_POS.x, STARBELL_POS.y, STARBELL_POS.z);
    scene.add(car);
    put(edge(new THREE.CylinderGeometry(0.075, 0.09, 0.05, 10)), 0, 0.025, 0, 0, 0, 0, car);
    put(edge(new THREE.CylinderGeometry(0.012, 0.012, 0.32, 6)), 0, 0.21, 0, 0, 0, 0, car);
    const carCanopy = new THREE.Group();
    carCanopy.position.y = 0.38;
    car.add(carCanopy);
    put(edge(new THREE.ConeGeometry(0.11, 0.07, 10)), 0, 0.035, 0, 0, 0, 0, carCanopy);
    const carStars = [];
    for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2;
        const sx = Math.cos(a) * 0.09, sz = Math.sin(a) * 0.09;
        put(line([[sx, 0, sz], [sx, -0.06, sz]]), 0, 0, 0, 0, 0, 0, carCanopy);
        const st = edge(new THREE.OctahedronGeometry(0.015));
        put(st, sx, -0.072, sz, 0, 0, 0, carCanopy);
        carStars.push(st);
    }

    // 顶篷与四颗小星要每帧单独转/摆 ⇒ 用 parts 交出去（与 `broom` 同法）
    return { root: car, parts: { body: car, canopy: carCanopy, stars: carStars } }
  },

  // 原 `regMagic(car, () => { carOn = !carOn; })`（状态量加 `s.` 前缀）。
  // 主入口同时给 aim（准星）与 proximity（近距）两条 —— 否则默认固定视角下点不开（风险 `R1`）
  interactables: (s, { L }) => [{
    id: 'star-bell/spin',
    label: '转动 / 停下旋转星铃',
    mode: 'both',
    // 锚点与几何同源：都取自 `L.STARBELL_POS`（不变量 N9）
    anchor: { x: L.STARBELL_POS.x, z: L.STARBELL_POS.z },
    radius: 1.8,
    onActivate: () => { s.carOn = !s.carOn; },
  }],

  /** 原 `tickOnce()` 里星铃那段（无注释）分支，逐字搬运（`s.` 前缀 / `parts` 见文件头） */
  update(dt, time, s, { parts }) {
    const carCanopy = parts.canopy, carStars = parts.stars

    {
        s.carP += ((s.carOn ? 1 : 0) - s.carP) * 0.015;
        carCanopy.rotation.y += 0.05 * s.carP;
        for (let i = 0; i < carStars.length; i++) {
            carStars[i].position.y = -0.072 + Math.sin(time * 3 + i * 1.57) * 0.01 * s.carP;
        }
    }
  },
})
