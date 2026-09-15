# 跳过：`floor1/cart-shelf`（12.11b 滑轮置物台：可滑动 + 墨水瓶羽毛笔 + 纸堆）—— `J3` / B4

> 本目录 `*.json` 才会被 `_j3-apply.mjs` 读；这是一份**说明**（`.md`），故意不写 spec。
> 结论：**本件本轮不搬** —— 依据是任务书硬约束 4「区间外被引用的变量 ⇒ 跳过并说明」。

## 分区边界（逐字核对，两个标记在 monolith 里各出现 1 次）

- `startMarker`：`            /* ---- 12.11b 滑轮置物台【魔法餐桌另一侧】：可滑动 + 墨水瓶羽毛笔 + 纸堆 ---- */`（当前 monolith **L1287**）
- `endMarker`  ：`            /* ---- 12.12 塔罗牌牌堆 ---- */`（当前 monolith **L1429**）
- 区间：**L1288–1428**（`CART_P0` / `CART_DIR` / `CART_DIST` + `cartOut/cartP/cartPrevP`
  + `cartG` / `cartBody` / 轮子 / 墨水瓶 / 羽毛笔 `quillG` + `QUILL_REST` / `quillRun` / `QUILL_T`
  + 纸堆 `paperG` / `papers` / `paperRun` / `PAPER_T` / `_cw` + `regMagic(cartBody, …)`
  + `regMagic(paperG, …)`）。
- 每帧分支（若搬则进 `update`）：**四段**，都在区间外：
  `/* ---- 滑轮置物台：滑动 + 轮子滚动 ---- */`（**L6425**）、
  `/* ---- 羽毛笔：飞出书写魔法符号后归位 ---- */`（**L6437**）、
  `/* ---- 魔法符号：上升渐隐 ---- */`（**L6491**）、
  `/* ---- 纸堆：腾空扇动绕一楼一圈后飞回 ---- */`（**L6509**）。

## 为什么搬不动：`cartG` 被**碰撞表**读

```js
{ g: cartG, hx: 0.21, hz: 0.16, top: 0.482 },        // ← 当前 monolith L5600（movingPlatforms）
```

`movingPlatforms`（当前 **L5600**）住在碰撞段，**既不是本分区的几何段、也不是 `tick` 块**
⇒ 应用器表达不了它，而任务书禁止手改 `monolith.js`。搬走 = `cartG` 从 monolith 消失
⇒ `refreshPlatforms()` 每帧 `ReferenceError`（直接崩）。

## 还有两处"整体搬"才能对的耦合（都指向同一个结论：只能整段一起搬）

1. **羽毛笔与纸堆的每帧分支用 `cartG.localToWorld` / `cartG.worldToLocal`**（L6437–L6508）——
   它们的坐标是**相对购物车**的，拆开就没有参照物；
2. **`_cw` 是四段共用的同一个 `THREE.Vector3`**（在区间内声明）；
   `magicGlyphs`（创建于当前 L1364–L1401，**在本区间内**）是羽毛笔写字的产物，
   由 `quillRun` 驱动 —— 二者必须同属一件物件；
3. 四段块在 `tickOnce()` 里本来就是**连续的**（L6425 → 纸堆块结束，中间只隔空行），
   所以"整段一起搬"在应用器上只需**一处** `tick.old`；真正的拦路虎只有 L5600 的 `cartG`。

6. **`cartG.updateMatrixWorld(true)`**（L6430）是每帧的**显式世界矩阵刷新** ——
   纸堆/羽毛笔随后用 `cartG.localToWorld` / `worldToLocal` 换算（依赖它），搬进 `update` 时
   这段顺序不能变（原地 tick 天然满足）。

## 下一轮要搬它，前置条件

1. 先解决 L5600 的 `cartG`（同上：或者人工改一行、或者把"移动平台"也收进契约）；
2. 四段 tick（L6425 起、连续到纸堆块结束）**合并成一次** `cartShelfApi.tick(dt, time);` ——
   好消息是它们在 `tickOnce()` 里本来就是**连续的**（中间只隔空行），故一处 `tick.old` 就能覆盖；
3. 把四段用到的状态全收进 `state`（`cartOut` / `cartP` / `cartPrevP` / `quillRun` / `paperRun`
   / `magicGlyphs`），几何经 `parts` 交出（`cartG` / `cartWheels` / `cartBody` / `quillG`
   / `magicGlyphs` / `papers` / `_cw`）；`QUILL_REST` / `QUILL_T` / `PAPER_T` / `CART_P0/DIR/DIST`
   是**局部常量**，照 `long-table` 的做法留在 build 里经 `parts` 交出或直接用 `L`；
4. `magicGlyphs` 的创建（当前 L1364–L1401，**在 12.11b 区间内**）与 `quillG` 的书写动画是同一套 ——
   一起搬，别拆。
