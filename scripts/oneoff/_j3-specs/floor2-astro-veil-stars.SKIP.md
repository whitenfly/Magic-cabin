# 跳过：`floor2/astro` + `floor2/veil` + `floor2/star-particles`（18.5 星象仪 / 18.6 二楼夜幕 / 18.7 宇宙星空粒子） —— `J3` / B5

> 本目录 `*.json` 才会被 `_j3-apply.mjs` 读；这是一份**说明**（`.md`），故意不写 spec。
> 结论：**三件一起不搬** —— 依据任务书硬约束 4 与「★ 光源槽位」那条：
> **含光源又不能保槽序的，一律跳过**（`floor1-crystal-ball.SKIP.md` 是先例，本案是它的加强版）。

## 1. 为什么三件一起

三个分区被**同一个变量 `magicP` 串成一台机器**：

```
18.5 星象仪   let magicOn = false, magicP = 0;   ← 点击切换的是它
18.6 二楼夜幕  veil.material.opacity = magicP * 0.28;
18.7 星空粒子  96 个 magicParts 的 visible / scale / halo 全部乘 magicP
光源槽位 6     lightField.register({ id: 'floor2/magic-veil', strength: () => magicP, … })
```

搬走 18.5 就必须同时改 18.6 与 18.7 的每帧分支，反之亦然 —— 三者是一个不可分的单元。

## 2. 分区边界（整行逐字唯一，已核对）

| 件 | `startMarker` | `endMarker` | 区间（写作时） |
|---|---|---|---|
| 18.5 星象仪 | `            /* 18.5 星象仪 */` | `            /* 18.6 二楼夜幕 */` | L2853–L2889 |
| 18.6 二楼夜幕 | `            /* 18.6 二楼夜幕 */` | `            /* 18.7 宇宙星空粒子系统 */` | L2890–L2906 |
| 18.7 星空粒子 | `            /* 18.7 宇宙星空粒子系统 */` | `            /* 18.8 小魔女计划板 */` | L2907–L2995 |

每帧分支：`tickOnce()` 的 **L6893–L6915**（`magicP += …` / `veil.material.opacity` / `spinG` /
`innerG` / `glows[i]` / `for (const g of magicParts)`）—— **一个连续的 23 行块**，
其中 L6895 是 18.6、L6904–6911 是 18.5、L6914 起是 18.7。

## 3. 阻塞点（两条，任一条都足以否决）

### ① 光源槽位（硬约束，不可绕）

```js
// monolith 的 8 槽注册（顺序即 shader 闪烁相位里的 float(i)）
lantern(0) / cauldron-fire(1) / magic-circle(2) / kotatsu(3) / crystal-ball(4) /
candle(5) / magic-veil(6) / moon-plant(7)
```

第 6 槽 `{ id: 'floor2/magic-veil', position: [1.75, TBL_TOP + 0.52, -2.72], color: 0xffe08a,
radius: 4.6, strength: () => magicP, yMin: 3.02, yMax: 6.9 }` 的强度函数**读的就是 `magicP`**。
`magicP` 属于 18.5。搬走 18.5 ⇒ 要么把光源也搬进物件的 `lights()`（**注册顺序不再是原来的 6 号槽**
⇒ 破 `defineProp.js` 纪律 3、破像素判据），要么让人工去改那条注册里的 `magicP`（超出应用器能力，
也把物件状态漏回 monolith，违反 `N7`）。两条都破硬约束。

### ② `magicP` 在区间外被**每帧**读写

区间外命中（已 grep 核对）：`magicP` 出现在 L6641（光源）、L6894/6895/6904/6905/6910/6911/6914…（tickOnce）；
`magicOn` 出现在 L6894；`spinG` / `innerG` 出现在 L6905/6906（它们是 18.5 的局部 Group，
却要在 tickOnce 里被转）；`glows` 出现在 L6909–6911；`veil` 出现在 L6895/6897（18.6 的 Mesh）；
`magicParts` 出现在 L6914（18.7 的 96 个 Group 数组）。

## 4. 下一轮 / `J4` 的前置条件

1. **先还光源的债**：让 `lights()` 能声明「我复用第 N 号槽」，或者让 `lightField` 支持
   「按 id 取槽 + 强度仍由物件提供」——`J4` 的活（[`LightField`](../../../src/cabin/core/lighting/LightField.js) 已按 id 注册，
   缺的是「槽序锚定」这一层）。
2. **再决定 `magicP` 的归属**：它是三件共用的一根强度轴 ⇒ 正规做法是提出一个
   `floor2/magic-veil`（夜幕 + 光源 + 强度轴）作为**唯一** owner，星象仪与星空粒子改成
   `mount` 认领它的 `parts`（不变量 `N3` 的用法）。
3. 三件的 `tick` 都落在 L6893–L6915 那个**连续块**里，且块内有交错 ⇒ 需要按行段切成
   3 处替换（应用器目前一个 spec 只支持一处 `tick`）。

> 本轮**不做**的理由：动它就必须先动 `lightField` 的槽序语义，而「像素逐字节零差异」的判据
> 正是被槽序守住的 —— 收益（省下约 140 行）远小于风险。
