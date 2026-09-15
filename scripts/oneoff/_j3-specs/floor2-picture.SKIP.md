# 跳过：`floor2/picture`（18.13 前墙挂画，镜子旁，点击编辑链接，支持 gif 动图） —— `J3` / B4

> 本目录 `*.json` 才会被 `_j3-apply.mjs` 读；这是一份**说明**（`.md`），故意不写 spec，
> 否则别人跑一次不带 `--only` 的应用器就会把下面这个 `ReferenceError` 写进 `monolith.js`。
> 结论：**本轮不搬** —— 依据任务书硬约束 4「**区间外被引用的变量**（如挂画的 gif/链接状态被
> `animate()` 或 `updateNewDecor()` 读）⇒ 该物件**跳过**并说明」，以及硬约束 7「拿不准就跳过」。

## 1. 分区边界（三者各只出现一次，已逐字实测）

> ⚠️ `monolith.js` 正被其它批次并行改写（行号会漂移）—— 下表行号是**写作时的快照**，
> 判断只依赖**原文内容**（应用器也是按整行原文匹配的）。

- `startMarker`：`            /* 18.13 前墙挂画（镜子旁，点击编辑链接，支持 gif 动图） */`（monolith **L5257**）
- `endMarker`  ：`            /* 18.14 拱形全身镜（点击镜面泛起水波涟漪） */`（monolith **L5361**）
- 区间：**L5258–L5360** —— `picG` 与画框几何、`picCv/pctx/picTex/picPlane`、
  `picState`、`drawPicBlank`、`drawPicImage`、`PIC_SOURCES`、`tryLoadPic`、`setPicture`、
  `openPicEditor`、`regMagic(picG, openPicEditor)`、`applyPic` 与两个 DOM 监听。
- 每帧分支（若搬则进 `update`）：`updateNewDecor()` 内 **L5530–L5533**。

## 2. 为什么拆不干净：`picState` / `drawPicImage` 的读者住在区间外

| 位置 | 原文 | 说明 |
|---|---|---|
| `updateNewDecor()` **L5530** | `if (picState.img && time - picState.lastT > 0.1) {` | 区间外（段内 L5282 声明、L5293/5314/5322/5323/5333/5345 使用） |
| **L5531** | `drawPicImage();` | 区间外（段内 L5292 定义、L5324 使用） |
| **L5532** | `picState.lastT = time;` | 区间外 |

`picState` 与 `drawPicImage` 在整个文件里的命中**只有**上表 3 行落在区间外（其余全在 L5258–L5360 内，已逐名 grep 核对：

```
picState       5282 5293 5314 5322 5323 5333 5345 | 5530 5531 5532   ← 后 3 行在区间外
drawPicImage   5292 5324                          | 5531             ← 该行在区间外
```

`L6970/6974/7063` 出现的 `picInput` 是**另一个**同名局部量（`document.getElementById('picInput')` 的缓存），
与本段无引用关系。）

这 4 行正是「**支持 gif 动图**」的唯一驱动（浏览器里 GIF 的 `Image` 会自走帧，
靠每 0.1 秒把当前帧重绘进 canvas 才看得出来）。应用器只做 `[startMarker, endMarker)` 整段替换，
**摘不掉**区间外的这 4 行；而 `picState` 一旦随区间删除，装饰循环里那 4 行就会抛
`ReferenceError` ⇒ `updateNewDecor()` 整条停摆（时钟 / 镜子 / 纸箱一起不跑）。

## 3. 两条路，本轮都不走

1. **整件搬（含原地 tick）—— 技术可行，但需要人工动区间外**：
   与 `floor2/junkBoxes`（B3）同款 —— 纸箱那 6 行就在**同一个** `updateNewDecor()` 里、
   离这 4 行只有 6 行，也是靠"应用器删几何段 + 人工把每帧块换成 `xxxApi.tick(dt, time);`"搬走的。
   本轮按硬约束 4 保守处理，**留给出题人裁决**（配方见 §4，随时可执行）。
2. **只搬几何与状态、把区间外那 4 行删掉**：**不做**。默认状态下画面零差异（
   挂画的 canvas 由 `build` 里的 `drawPicBlank()` 画好，4 行只影响"用户贴了链接之后"），
   但等于**静默废掉 GIF 动图**这个功能 —— 比跳过更糟。

## 4. 若下一轮要搬它：前置条件与现成配方（本轮未写盘）

- **边界**：`startMarker` = `            /* 18.13 前墙挂画（镜子旁，点击编辑链接，支持 gif 动图） */`、
  `endMarker` = `            /* 18.14 拱形全身镜（点击镜面泛起水波涟漪） */`（各只出现一次）。
- **物件文件**：`src/cabin/world/floor2/picture.js`，`id: 'floor2/picture'`、`kind: 'decor'`、
  `assign: 'picApi'`、`batch: 'B4'`。
- **layout**：`PIC_POS = { x: 1.45, y: 1.55, z: 3.82 }`（原 `picG.position.set(1.45, FY + 1.55, 3.82);` 拆出，
  与 `HG_POS` / `CHEST_POS` 同风格）。
- **`interactables`**：原 `regMagic(picG, openPicEditor)` → `id 'picture/edit-link'`、
  `label '编辑挂画图片链接'`、`mode 'both'`、`anchor { x: PIC_POS.x, z: PIC_POS.z }`、`radius 1.6`、
  `onActivate: openPicEditor`。
  ⚠️ 知会：迁移后准星文案会由默认的 `'交互'` 变成这个语义化 label（`J3` 的 DoD 要的正是它），
  但**属可见文案变化**，按"新增式改动"该机位要单独审一遍。
- **`update`**：`if (s.img && time - s.lastT > 0.1) { s.drawPicImage(); s.lastT = time; }`
  （`drawPicImage` 经 `state.drawPicImage = drawPicImage` 交接 —— 与 `floor2/mirror.js` 同一手法）。
- **人工步骤**：① 装配行 `const picApi = installProp(picture);`；
  ② 把 `updateNewDecor()` 里 L5530–L5533 那 4 行换成 `picApi.tick(dt, time);`
  （**参数顺序 `(dt, time)`**，而 `updateNewDecor(time, dt)` 自己的形参是反的）。
- **计数门禁**：段内的 DOM 监听与 `SND.play('chim')` 随 `build` 在原位置登记 ⇒ 计数不变；
  `regMagic(` 会 −1，需同步 `scripts/verify-migration.mjs` ④ 的期望值。

## 5. 与镜子（18.14）的情形为什么不同（本轮搬了它）

`floor2/mirror` 的每帧分支同样住在 `updateNewDecor()`（L5534–L5541），本轮**搬了** —— 因为：

- 不搬它，镜面 canvas **永远画不出第一帧**（原实现不在建几何时画，第一笔由那条分支触发）
  ⇒ 拱形镜面会从浅蓝渐变**变成一块空白/黑**，**像素判据当场失败**；
- 挂画则相反：默认 canvas 由 `build` 里的 `drawPicBlank()` 画好，那 4 行只服务"用户贴了链接之后"的场景
  ⇒ 跳过它**零像素影响**。

即：镜子是"不搬就破判据"，挂画是"搬了要多动一处区间外代码、跳过则完全无损" —— 两者的处理因此不同。
