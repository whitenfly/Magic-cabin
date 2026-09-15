# 跳过：`floor1/hanging-lantern`（12.7 吊挂木灯）—— `J3` / B4

> 本目录 `*.json` 才会被 `_j3-apply.mjs` 读；这是一份**说明**（`.md`），故意不写 spec。
> 结论：**本件本轮不搬** —— 依据是任务书硬约束 4「区间外被引用的变量 ⇒ 跳过并说明」，
> 以及「**含光源的物件若不能保槽序，一律跳过**」（见 `floor1-crystal-ball.SKIP.md` 的同款论证）。

## 分区边界（逐字核对，两个标记在 monolith 里各出现 1 次）

- `startMarker`：`            // ---- 12.7 吊挂木灯 ----`（当前 monolith **L733**）
- `endMarker`  ：`            /* ---- 12.8 壁炉旁的猫 ---- */`（当前 monolith **L773**）
- 区间：**L734–772**（`let lanternLit = true;` + `lanternPivot` / `lantG` / `lanternFlame`
  + `haloMat`/`halo`/`beamMat`/`beam` + `glowMatA`/`glowMatB`/`floorPool`/`floorPool2`/`tablePool`
  + `regMagic(lanternPivot, …)`），区间末尾 L772 是空行。
- 每帧分支（若搬则进 `update`）：**L6351–6362**（`lanternPivot.rotation.*` / `lanternFlame.visible`
  / `halo.visible = beam.visible = …` / `if (lanternLit) { … }`，无注释头，紧跟 `bookPileApi.tick` 那个块之后）。

## 为什么搬不动：`lanternLit` 是**光照场第 0 槽**的强度输入

`tickOnce()` 末尾「室内点光源」那一段（当前 **L6974–6979**）里，第 1 行就是：

```js
lightField.register(createPointLightSource({ id: 'floor1/lantern', position: [MTX, 2.52, MTZ], … strength: () => ptLantern, … }));
```

```js
ptLantern += ((lanternLit ? 1 : 0) - ptLantern) * 0.07;      // ← 当前 monolith L6975
```

即 `lanternLit → ptLantern → 槽位 0 的强度`。这行**住在替换区间之外**（在灯自己的每帧分支之后
约 340 行），既不是本分区的几何段、也不是它的 `tick` 块 ⇒ 应用器（只管几何段 + 一处原地 tick）
表达不了它。

槽序 = 注册顺序 = `lantern(0) / cauldron-fire(1) / magic-circle(2) / kotatsu(3) / crystal-ball(4)
/ candle(5) / magic-veil(6) / moon-plant(7)`，而 shader 的闪烁相位含 `float(i)`
⇒ **槽位一变画面就变**。把灯搬走会让 `lanternLit` 从 monolith 里消失，L6975 立刻变成
`ReferenceError`（不是像素差异，是直接崩）。

## 两条走不通的路（都破一条硬约束）

1. **`lights()` 里重注册这一盏**：`lightField` 已经在 L6282 注册过它（槽位 0），再注册一次会变成
   9 盏、且新的一盏排在**第 8 个槽**⇒ 破 `defineProp.js` 纪律 3、破像素判据。
2. **把状态漏回 monolith**（`hangingLanternApi.state.lanternLit`）：需要人工手改 L6975，
   超出应用器能力，也把"物件状态"漏回 monolith（违反 `N7`）—— 与水晶球那件同款的两难。

## 下一轮（`J4`）要搬它的前置条件

1. 「点光源强度」也收进统一契约（`J4` 的活）：让 `lights(s)` 声明 `strength: (time) => …` 的闭包
   **引用物件自己的 state**，`ptLantern` 这个中间量随之消失，灯就能整体搬家而不动槽序；
2. `haloMat` / `beamMat` / `glowMatA` / `glowMatB` 四个材质经 `parts` 交出（每帧块要改它们的 `opacity`）；
3. 之后照本目录其它 spec 写 `floor1-hanging-lantern.json`：`assign: "hangingLanternApi"`、
   `layout` 无需新增（`MTX/MTZ` 已在 `world/layout.js`）、`tick.old` = 当前 L6351–6362 原文、
   `tick.new` = 原地 `hangingLanternApi.tick(dt, time);`。

## 同类（同一轮不要碰）

`12.11 水晶球`（`ptCb`，槽位 4，已单独 SKIP）、`紫色魔法阵`（`ptMc`，槽位 2）、
`12.13 暖桌`（`ptKot`，槽位 3）、`月光魔法盆栽`（`ptPlant`，槽位 7）—— 四件同一个病根，
都等 `J4` 把光源强度收进契约。
