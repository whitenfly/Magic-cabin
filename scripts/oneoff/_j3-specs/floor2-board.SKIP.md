# 跳过：`floor2/board`（18.8 小魔女计划板：黑板 + 便签 ×3 + 黑板擦 + 粉笔自动书写） —— `J3` / B5

> 本目录 `*.json` 才会被 `_j3-apply.mjs` 读；这是一份**说明**（`.md`），故意不写 spec。
> 结论：**本轮不搬** —— 依据任务书硬约束 4「区间外被引用的变量 ⇒ 跳过并说明」，
> 以及「★ 拿不准就跳过」（`floor1-crystal-ball.SKIP.md` 是先例）。

## 1. 分区边界（整行逐字唯一，已核对）

- `startMarker`：`            /* 18.8 小魔女计划板 */`
- `endMarker`  ：`            /* 18.9 左墙中央的魔法杖 */`
- 区间：该两行之间（写作时 **L2997–L3309**）：`boardG / boardTilt / boardCanvas / bctx /
  drawBoardFace / boardTex / notes[3] / noteEditing / drawNote / openNoteEditor / eraserG /
  GLYPHS / GLYPH_WARM / GLYPH_COOL / glyphCanvas / gctx / glyphTex / glyphPlane / drawGlyphSet /
  chalkG / CHALK_HOME / chalkState / glyphLocalX / glyphLocalY / **const smooth** / updateChalk /
  SCROLL_R / scrollRoll + 4 次调用`。
- 每帧分支（若搬则进 `update`）：`tickOnce()` 的 **L6867–L6870**
  （`eraserT += …` / `const ee = …` / `eraserG.rotation.x = Math.PI * ee;` / `updateChalk(time);`）。

## 2. 阻塞点（三条，任一条都足以否决）

### ① `smooth` 就定义在这个区间里 —— 而它是**全屋共享工具**

```js
// L3230（区间内）
            const smooth = k => k * k * (3 - 2 * k);
```

`propCtx` 里 `propTool('smooth', () => smooth)`（L688）指的就是这一个 `const`。
区间外读取它的地方（已 grep 核对，共 25 处）：`tickOnce` 的 L6862（椅子缓动）、
**本批新搬的 `floor2/cardDeck` / `floor2/deskHourglass` / `floor2/calendar` 三个模块**
（`update` 里按需解构 `smooth`）、以及原 18.4 / 18.9 段的多处。
⇒ 区间一旦删除，`smooth` 连同它的定义一起消失：**所有已搬物件的 `update` 会在第一次调用时
`ReferenceError`** —— 那不是像素差异，是整条 `tickOnce` 停摆。

### ② `notes` / `noteEditing` / `drawNote` 被区间外的「便签编辑器」读

```js
// L4248–L4249（便签编辑器区块，在 18.17 之后）
            function applyNote() {
                notes[noteEditing].txt = noteInput.value.trim() || '...';
                drawNote(noteEditing);
```

这是 `18.13 挂画` 的同款结构（区间外读写物件的私有状态），但**比挂画更难**：
挂画那 4 行是「每帧重绘」，可以用 `spec.tick` 换掉；而这里是**两个 DOM 监听器的事件体**
（`noteOk` 的 click 与 `noteInput` 的 keydown），既不在每帧路径上、也不是一处唯一文本，
`tick` 机制语义上不适用。

### ③ 区间外每帧读 `eraserOpen / eraserT / eraserG / updateChalk`

`tickOnce()` L6867–L6870 四行读这四个量（`eraserOpen`/`eraserT`/`eraserG` 是 18.8 的局部量，
`updateChalk` 是 18.8 的函数）。这四行**可以**用 `tick` 换掉，但它们**夹在**
`pillowT`（18.1 大床）与 `updateWand2(time)`（18.9）之间 —— 只能整段替换，不能只替换其中一部分。

## 3. 下一轮 / `J4` 的前置条件

1. **先把 `smooth` 从 18.8 段搬出来**（提到 `core/math/` 或 `core/geometry/`，再由 `propCtx` 注入）——
   这一步是**独立且低风险**的（纯函数、零像素影响），而且是**其它批次也需要的**：
   `floor2/junkBoxes.js` 至今还在文件里**复刻**了一份 `smooth`，就是因为它所在的段不能动。
   做完这一步，`world/**` 里所有「复刻工具」的欠账一起还清。
2. 便签编辑器的归属：`notes` / `noteEditing` / `drawNote` 应当由**功能模块**（`features/**`）
   经 `mounts` 认领（不变量 `N3`），而不是让 monolith 直接读物件私有量 —— 这是 `J4` 的统一契约。
3. 之后照本目录其它 spec 写：`id: "floor2/board"`、`name: "board"`、`assign: "boardApi"`、
   `file: "src/cabin/world/floor2/witchBoard.js"`、`layout` 声明 `(-2.9, FY, 2.8)` 与 `rotation.y = 2.33`、
   `state` 收 `noteEditing` / `chalkState` / `eraserOpen` / `eraserT`（+ `now` 替 `clock.now`）、
   `parts` 交出 `boardTilt / chalkG / glyphPlane / eraserG / notes`、
   `tick.old` = L6867–L6870 四行、`tick.new` = `boardApi.tick(dt, time);`。

## 4. 顺带记录：`scrollRoll` 与 4 个卷轴

区间**末尾**还有 `SCROLL_R` + `scrollRoll()` + 4 次调用（`scrollRoll(-3.42, 3.28, 0.42)` 等），
它们是**左墙边的 4 个卷轴道具**，与计划板无关，只是恰好被写在同一分区里
（用到了 `IN_MAT`，那是 core 材质、ctx 里有）。下一轮拆分时应当把它们**另立一件**
（`floor2/scrolls`，纯几何、无状态、无交互 ⇒ 不需要 `tick`），而不是塞进计划板模块。
