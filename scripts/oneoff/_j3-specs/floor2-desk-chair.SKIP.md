# 跳过：`floor2/desk-chair`（18.4 书桌椅，可推拉） —— `J3` / B5

> 本目录 `*.json` 才会被 `_j3-apply.mjs` 读；这是一份**说明**（`.md`），故意不写 spec。
> 结论：**本轮不搬** —— 依据任务书硬约束 4「**区间外被引用的变量** ⇒ 该物件跳过并说明」，
> 以及硬约束 7「拿不准就跳过 —— 质量高于数量」。
> 本件是 `18.4` 九个陈设里，除了「魔法书本」之外**唯一**没能搬走的一件。

## 1. 分区边界（已用整行逐字断言核对，三者各只出现一次）

- `startMarker`：`            /* —— 椅子 —— */`
- `endMarker`  ：`            /* —— 魔方 —— */`
- 区间：该两行之间（写作时 **L1799–L1811**）：`const CHAIR_IN = -3.20;` / `const CHAIR_OUT = -3.60;`
  / `chairG` + 四条腿 + 坐面 + 靠背 / `let chairOpen = false, chairT = 0;` / `regMagic(chairG, …)`。
- 每帧分支（若搬则进 `update`）：`tickOnce()` 的 **L6861–L6863** 三行
  （`chairT += …` / `const ck = smooth(…)` / `chairG.position.z = CHAIR_IN + (CHAIR_OUT - CHAIR_IN) * ck;`）。

## 2. 为什么拆不干净：`chairG` 是**区间外**被读的（而且需要两处非连续修改）

本案与 `floor1-crystal-ball.SKIP.md` 属**同一类型**，但比它更麻烦一点：

| 位置 | 原文 | 能否由 `spec.tick` 覆盖 |
|---|---|---|
| `tickOnce()` L6860–L6868 | `chairT += ((chairOpen ? 1 : 0) - chairT) * 0.07;` … `eraserG.rotation.x = Math.PI * ee;` 这 9 行**混着三个物件**（椅子 / 枕头 / 黑板擦） | ✅ 其中 L6861–6863 三行可以整体换成 `chairApi.tick(dt, time);`，前后两段原地保留 |
| `movingPlatforms` **L5601** | `{ g: chairG, hx: 0.24, hz: 0.24, top: FY + 0.49, bot: FY },` | ❌ **搬不动** —— 它在 `movingPlatforms` 表里，被 `refreshPlatforms()` **每帧**读 `m.g.position.x/z` 做玩家碰撞（椅子会沿 z 平移，碰撞盒必须跟着走） |

`chairG` 一旦随几何段删除，L5601 立刻 `ReferenceError` ⇒ `refreshPlatforms()` 每帧抛错
（不是像素差异，是**直接崩**）。而 `spec` 只有**一个** `tick` 字段，
装不下「tickOnce 里那三行」+「movingPlatforms 里那一行」两处**互不相邻**的替换。

## 3. 现成配方（`floor1/stools` 的先例，下一轮可直接执行）

`floor1/stools.json` 的 `prereq` 就是同一情形，且**已经落地**（见 monolith L5597–5599：
`{ g: stoolsApi.parts.stoolA, … }`）。照抄它即可：

1. `spec`：`id: "floor2/desk-chair"`、`name: "chair"`、`assign: "chairApi"`、
   `file: "src/cabin/world/floor2/deskChair.js"`、`startMarker` / `endMarker` 见 §1；
2. 物件文件把 `CHAIR_IN` / `CHAIR_OUT` 与 `2.6` 的摆放位声明进 `layout`（不变量 `N9`），
   `build` 返回 `{ root: chairG, parts: { body: chairG } }`；
   `state: () => ({ open: false, t: 0, now: 0 })`；`update` 里 `s.t = chairT`、`s.open = chairOpen`；
3. `interactables`：`id 'desk-chair/pull'`、`label '把书桌前的椅子拉开'`、`mode 'both'`、
   `anchor` 取椅子静止位（`{ x: 2.6, z: CHAIR_IN }`）、`radius` 1.5、
   `onActivate: () => { s.open = !s.open; }`；
4. `tick.old` = L6861–6863 原文、`tick.new` = `const chairApi = installProp(chair);` 之后一行
   `chairApi.tick(dt, time);`（⚠️ 原三行用的是 `smooth`，tick 的顺序是 `(dt, time)`）；
5. **人工前置（应用器表达不了）**：把 L5601 改成
   `{ g: chairApi.parts.body, hx: 0.24, hz: 0.24, top: FY + 0.49, bot: FY },`
   —— 与 L5598/L5599 的写法一致，数值一个不改。
6. 前置做完再把 spec 从 `.pending` 改名成 `.json`（`floor1/stools` 当年就是这么做的）。

> 本轮不做的理由：第 5 步必须**人工**动区间外一行，而「一个 spec 只能声明一处 tick 替换」
> ⇒ 装配完会留下一个**会崩**的中间态。等 `J4` 把 `movingPlatforms` 也收进统一契约
> （或允许 spec 声明第二处替换）再搬，成本最低。

## 4. 不计入本件的部分

椅子的**座椅碰撞盒**（`movingPlatforms` 那条）与椅子几何**同源**，但它是物理系统的一部分，
搬迁时必须一起处理 —— 这正是 `J4`「暂停/关闭模块」要解决的问题，`J3` 不动它。
