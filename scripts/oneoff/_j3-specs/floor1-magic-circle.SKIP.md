# 跳过：`floor1/magic-circle`（紫色魔法阵）—— `J3` / B4

> 本目录 `*.json` 才会被 `_j3-apply.mjs` 读；这是一份**说明**（`.md`），故意不写 spec。
> 结论：**本件本轮不搬** —— 原因与 `12.7 吊挂木灯` / `12.11 水晶球` / `12.13 暖桌` /
> `月光魔法盆栽` **完全同款**：它是**光照场第 2 槽**的强度输入。

## 分区边界（逐字核对）

- `startMarker`：`            /* ---- 紫色魔法阵 ---- */`（当前 monolith **L980**）
- `endMarker`  ：`            /* ---- 12.9f 长餐桌 ---- */`（当前 monolith **L1092**）
- 区间：**L981–1091**（`mcG` / `mcMat` / `mcLoop` / `mcBase`（环、六芒、三芒、刻度）
  + `mcFloats`（6 层悬浮阵）+ `mcParts`（24 个八面体，消耗 `floor1Rng` ×3/个）
  + `mcHit` + `let mcRun = 0` + `regMagic(mcG, …)` + `mcG.userData.sfx = 'magic'`）。
- 每帧分支（若搬则进 `update`）：`/* ---- 紫色魔法阵 ---- */` 那个块（当前 **L6670–L6706**）。
- ⚠️ **标记不唯一的坑**：`/* ---- 紫色魔法阵 ---- */` 这行**在文件里出现两次**
  （L980 分区、L6670 tickOnce 里的块）。若将来要搬，`startMarker` 必须用 L980 那行 ——
  同款歧义还有 `/* ---- 月光魔法盆栽 ---- */`（L1256 分区 / L6411 tick）、
  `/* ---- 门铃 ---- */`（L1652 分区 / L6834 tick）。**`/* ---- 12.x ---- */` 那种带编号的行才是唯一的。**

## 阻塞行（住在区间之外）

```js
ptMc += ((mcRun > 0 ? 1 : 0) - ptMc) * 0.055;         // ← 当前 monolith L6977
```

`mcRun → ptMc → floor1/magic-circle（槽位 2）的 strength`，而 L6977 住在替换区间之外
（"室内点光源"那 5 行里，紧随其后就是 `lightField.update(time, dt)`）。搬走 ⇒ monolith 里
`mcRun` 消失 ⇒ `ReferenceError`；把光源重注册进 `lights()` ⇒ 槽位从 2 变成 8（排在末尾）
⇒ 破 `defineProp.js` 纪律 3（shader 闪烁相位含 `float(i)`）⇒ 像素回归。
**两条路都破判据，故跳过。**

## 顺带结论：一楼"含光源"的五件只能一起等 `J4`

| 槽位 | 光源 id | 强度读的状态量 | monolith 里的阻塞行（当前） |
|---|---|---|---|
| 0 | `floor1/lantern` | `lanternLit`（12.7 吊挂木灯） | L6975 |
| 1 | `floor1/cauldron-fire` | **常量 0.92**（大魔女坩埚） | 无 ⇒ **已搬走**（`floor1/cauldron.json`） |
| 2 | `floor1/magic-circle` | `mcRun`（紫色魔法阵） | L6977 |
| 3 | `floor1/kotatsu` | `kotatsuOn`（12.13 暖桌） | L6976 |
| 4 | `floor1/crystal-ball` | `cbRun`（12.11 水晶球） | L6978 |
| 7 | `floor1/moon-plant` | `plantRun`（月光魔法盆栽） | L6979 |

⇒ 一楼的**坩埚之所以能搬**，正是因为它的那一盏 `strength` 是常量、且没有任何一行读它的状态；
其余五件要等 `J4` 把"点光源强度"收进统一契约（`lights(s)` 的闭包直接读物件自己的 `state`），
`ptXxx` 这些中间量随之消失，槽序才能既不变又搬得动。

## 下一轮（`J4`）要搬它的前置条件

1. 光源强度进契约（同上）；
2. `mcMat` / `mcBase` / `mcFloats` / `mcParts` 经 `parts` 交出（每帧块要改它们的 `opacity`
   / `visible` / `position`），`mcRun` 进 `state`；
3. `floor1Rng()` 的消耗（24 个 `mcParts` × 4 次：`a` / `r` / `ph` / `spd`）必须仍在 build 内、位置不变；
4. `tick.old` = 当前 L6670–6706 原文、`tick.new` = 原地 `magicCircleApi.tick(dt, time);`。
