# 跳过：`floor2/magic-book`（18.4 桌面魔法书本，点击翻开 / 撒符文 / 合上） —— `J3` / B5

> 本目录 `*.json` 才会被 `_j3-apply.mjs` 读；这是一份**说明**（`.md`），故意不写 spec。
> 结论：**本轮不搬** —— 依据任务书硬约束 4「区间外被引用的变量 ⇒ 跳过并说明」。
> 本件是 `18.4` 九个陈设里**唯一**因为「拿不到 `camera`」而搬不动的一件（其余八件已搬或已另案跳过）。

## 1. 分区边界（整行逐字唯一，已断言）

- `startMarker`：`            /* —— 魔法书本 —— */`
- `endMarker`  ：`            /* 18.5 星象仪 */`
- 区间：该两行之间（写作时 **L2593–L2851**）：`bookG` + 封面/书脊/6 张翻页/7 张扇页（`plate` /
  `pageStack` 两个局部工具）/ `bookState` / `regMagic(bookG, …)` / `GLYPH_SYMS` / `GLYPH_COLS` /
  `glyphTexCache` / `getGlyphTex` / `glyphObjs` / `glyphGeoShared` / `spawnGlyphs` / `updateGlyphs` /
  `let bookGlyphT = 0` / `updateBook`。
- 每帧分支（若搬则进 `update`）：`tickOnce()` 的 **L6876**（`updateBook(time, dt);`）与
  **L6878**（`updateGlyphs(time, dt);`）—— 两行**不相邻**（中间夹着 `updateCal(dt);`）。

## 2. 为什么拆不干净：`updateGlyphs` 里读了 `camera`

`monolith.js` **L2755**：

```js
                g.m.quaternion.copy(camera.quaternion);   // ← 符文面片永远朝向相机（billboard）
```

`camera` 是 monolith IIFE 里的局部 `const`（`new THREE.PerspectiveCamera(...)`，L130 一带），
**不在 `propCtx` 的可用键里**（清单见 monolith L664–695：几何 DSL / 材质 / 共享工具 / `rng` / `SND`，
**没有** `camera`，也没有 `renderer`）。模块作用域与 IIFE 闭包不通 ⇒ 搬进 `world/floor2/*.js` 后
这一行立刻 `ReferenceError`；而它在**每帧**执行，属于「不搬则破判据、硬搬则直接崩」的那一类。

> 这不是本件独有的问题：`floor2/mirror.js` 的**自建射线**（`mirrorRay.setFromCamera(mirrorMouse, camera)`）
> 就是因为同样缺 `camera` / `renderer` 而被明确留给 `J4`（见该文件头「欠账」一节）。
> 本件只是同一缺口在**每帧路径**上的第二次显形。

第二处麻烦（次要）：`glyphObjs` / `glyphGeoShared` / `glyphTexCache` / `bookGlyphT` 被
`spawnGlyphs`（`updateBook` 调）与 `updateGlyphs`（`tickOnce` 调）**两边共用** ——
若把区间切成两个 spec 分别搬，共享量就得跨模块交接，收益不抵风险。

## 3. 下一轮（或 `J4`）的前置条件

任选其一即可解锁整件：

1. **给 `propCtx` 补 `camera`**（在 monolith L663 一带加一行 `propTool('camera', () => camera);`）
   —— 一行、零像素影响，`mirror` 的射线欠账也一并解开；
2. 或让交互/渲染契约提供「面向相机」的能力（`J4` 的 `ctx.view` 之类），物件不再直接摸 `camera`。

解锁后照本目录其它 spec 写：`id: "floor2/magic-book"`、`name: "magicBook"`、
`assign: "magicBookApi"`、`file: "src/cabin/world/floor2/magicBook.js"`；
`state` 收 `bookState.phase/t0` + `bookGlyphT` + `now`（`clock.now` 的替身，与 `floor2/rubik.js` 同法）；
`parts` 交出 `coverPivot / spineG / flipperPivots / fanPivots / glyphObjs`；
`layout` 声明 `V(2.58, TBL_TOP + 0.001, -2.80)` 与 `rotation.y = -0.35`；
**两处 `tick`**（L6876 与 L6878 各一处，目前一个 spec 只能声明一处 ⇒ 需要两条 spec 或让应用器支持数组）：

- `tick.old` = `                updateBook(time, dt);` → `bookApi.tick(dt, time);`
- `tick.old` = `                updateGlyphs(time, dt);` → `bookApi.tick(dt, time);`（**第二处需要同日回调**）

⚠️ `updateBook(time, dt)` 与 `updateGlyphs(time, dt)` 的形参顺序都**已经是 `(time, dt)`** ——
tick 调用一律写 `(dt, time)`，别被名字骗了。

## 4. rng 知会（下一轮照抄）

`spawnGlyphs` 每次 4 + 3 = **7 次** `runtimeRng()`（符号、颜色、位置 3 次）+
每条 4 次的 `v / life / ph / rs` —— 共 **11 次**；`updateGlyphs` 每帧可能 1 次 `runtimeRng()`。
这些都必须保持**调用次数与顺序不变**（不变量 `N8`），否则「运行期瞬态」的序列会变。
