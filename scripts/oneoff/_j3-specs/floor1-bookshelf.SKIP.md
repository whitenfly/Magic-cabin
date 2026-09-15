# 跳过：`floor1/bookshelf`（12.9 左墙书架 + 可抽拉的书）—— `J3` / B4

> 本目录 `*.json` 才会被 `_j3-apply.mjs` 读；这是一份**说明**（`.md`），故意不写 spec。
> 结论：**本件本轮不搬** —— 依据是任务书硬约束 4「区间外被引用的变量 ⇒ 跳过并说明」。

## 分区边界（逐字核对，两个标记在 monolith 里各出现 1 次）

- `startMarker`：`            /* ---- 12.9 左墙书架 + 可抽拉的书 ---- */`（当前 monolith **L884**）
- `endMarker`  ：`            /* ---- 12.9a 左窗下魔法书堆 ---- */`（当前 monolith **L919**）
- 区间：**L885–918**（`const shelfBooks = []` + `const SFX = -3.72, SFZ = -2.85, SFW = 1.3;`
  + 层板/立板 + `function addBook(z, yBase, h, th)` + 12 本书的三层摆书循环）。
- 每帧分支（若搬则进 `update`）：**L6647–6654**（`for (const b of shelfBooks) { … }`）。

## 为什么搬不动：`SFX` / `SFZ` 是**区间外**被读的

书架自己在区间里声明了三个局部常量，其中两个被**碰撞表**读：

```js
const SFX = -3.72, SFZ = -2.85, SFW = 1.3;                    // ← 区间内（当前 L886）
…
{ x1: SFX - 0.25, z1: SFZ - 0.70, x2: SFX + 0.25, z2: SFZ + 0.70, top: 2.02 },   // ← 当前 L5583（platformBoxes）
```

`platformBoxes`（当前 **L5583**）住在 `tickOnce()` 之前的碰撞段，**既不是本分区的几何段、
也不是它的 `tick` 块** ⇒ 应用器（只管几何段 + 一处原地 tick）表达不了它，而任务书禁止手改
`monolith.js`。搬走 = `SFX`/`SFZ` 从 monolith 消失 ⇒ `refreshPlatforms()` 每帧抛
`ReferenceError`（不是像素差异，是直接崩）。

> 这正是 `stools` 当初踩过的同一个坑（`movingPlatforms` 读 `stools[0]`），
> 它靠**人工手改两行**（`stoolsApi.parts.stoolA/B`）才过；本轮不允许手改 monolith，故跳过。

## 另外两处"搬了也要妥协"的点（记下来省下一轮的时间）

1. **12 本书各自 `regMagic(g, …)`**（写在 `addBook` 里）⇒ 12 条交互。按 `installProp` 的准星通路，
   只有 `root` 的命中体会进 `magicMeshes`（`stools` 同款取舍）—— 12 本书只有 1 本能保准星入口，
   其余靠近距入口覆盖。
2. **12 本书是直接 `scene.add(g)`** 的（没有共同父节点）⇒ 加包装层会改 `scene.children`
   ⇒ 像素回归；只能照 `stools` 的 `root = shelfBooks[0]`（仅登记用元数据）处理。

## 下一轮要搬它，前置条件

1. 决定 `SFX/SFZ` 的归属：**最省事**的是把这两个值写进 `world/layout.js`（新增
   `SHELF_X = -3.72` / `SHELF_Z = -2.85`），再把 L5583 的碰撞行改成引用它 ——
   但那需要**人工改一行 monolith**（或让应用器支持"区间外替换"）；
2. `addBook` 里的 `regMagic` → `interactables()`：12 条（每本一条，`anchor` 与 `g.position` 同源，
   即 `{ x: SFX + 0.02, z }`），并接受"只有第一本有准星入口"；
3. `tick.old` = 当前 L6647–6654 原文（`for (const b of shelfBooks) {` 起 8 行），
   `tick.new` = 原地 `bookshelfApi.tick(dt, time);`。

> 顺带一提：`12.9d 旋转星铃`（B3 已搬）当初也**借了 `SFX` 当 x 坐标**，
> 它是把同一个数值写进 layout 的 `STARBELL_POS.x` 绕过去的 —— 但那只解决了"读一个值"，
> 解决不了"这个值必须继续活在 monolith 里供碰撞表读"。
