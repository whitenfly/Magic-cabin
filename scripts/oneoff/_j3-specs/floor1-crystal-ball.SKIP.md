# 跳过：`floor1/crystal-ball`（12.11 水晶球占卜台【门侧前右墙角】）—— `J3` / B3

> 本目录 `*.json` 才会被 `_j3-apply.mjs` 读；这是一份**说明**（`.md`），故意不写 spec。
> 结论：**本件本轮不搬** —— 依据是任务书硬约束 4「区间外被引用的变量（被 `animate()` /
> `updateNewDecor()` / `movingPlatforms` / `lightField` 读）⇒ 该物件跳过并说明」，
> 以及「拿不准就跳过 —— 搬错一件会让整个阶段的零差异判据失败」。

## 分区边界（已用 `-ceq` 逐字核对，三者各只出现一次）

- `startMarker`：`            /* ---- 12.11 水晶球占卜台【门侧前右墙角】 ---- */`（monolith **L1612**）
- `endMarker`  ：`            /* ---- 月光魔法盆栽【门侧前右墙角】 ---- */`（monolith **L1668**）
- 区间：**L1613–1666**（几何 + `let cbRun = 0;` + `regMagic(orbStandG, () => { cbRun = 5.0; });`
  + `orbStandG.userData.sfx = 'magic';`），区间末尾 L1667 是空行。
- 每帧分支（若搬则进 `update`）：`/* ---- 水晶球 ---- */` 那个 `{ … }` 块，**L7808–7820**。

## 为什么拆不干净：`cbRun` 是**区间外**被读的

`cbRun` 是这一件**唯一**的状态量（本该收进 `state: () => ({ cbRun: 0 })`），
但它有两处读者住在替换区间**之外**：

| 位置 | 原文 | 说明 |
|---|---|---|
| `tickOnce()` L7808–7820 | `/* ---- 水晶球 ---- */ { if (cbRun > 0) cbRun -= dt; … }` | **这一处能搬**（自足块，`cbMists`/`cbStars`/`cbMistMat`/`cbGlowMat` 都在区间内，可经 `parts` 交出） |
| `tickOnce()` **L8476** | `ptCb += ((cbRun > 0 ? 1 : 0) - ptCb) * 0.055;` | ✗ **这一处搬不动** —— 它和 `ptLantern/ptKot/ptMc/ptPlant` 挤在同一个「室内点光源」块里（L8472–8480），随后就是 `lightField.update(time, dt)` |

`ptCb` 又是光照场第 5 个光源的强度输入（L7600）：

```js
lightField.register(createPointLightSource({ id: 'floor1/crystal-ball', position: [CBX, 0.88, CBZ],
  color: 0xb5a0f2, radius: 3.6, strength: () => ptCb, yMin: 0.0, yMax: 3.04 }));
```

槽位顺序 = 注册顺序 = `lantern(0) / cauldron-fire(1) / magic-circle(2) / kotatsu(3) / crystal-ball(4) /
candle(5) / magic-veil(6) / moon-plant(7)`，而 shader 的闪烁相位含 `float(i)` ⇒ **槽位一变画面就变**。

## 两条走不通的路（都破一条硬约束）

1. **把光源写进物件的 `lights()`**：光照场已在 L7596–7603 注册过这一盏（并在 L7605 灌进 `registry`），
   再注册一次会变成 9 盏 / 重复 id，注册顺序也不再是原来的 5 号槽 ⇒ 破 `defineProp.js` 纪律 3、破像素判据。
2. **保留 monolith 侧的 `cbRun` 读取**：那 L8476 必须人工改成 `crystalBallApi.state.cbRun` ——
   这既超出应用器（它只管几何段）的能力，也把"物件状态"漏回了 monolith，违反 `N7`。

（数值上这么改确实零差异，但它需要人工动 L8476 那一行 —— 本轮不做，留给出题人决定。）

## 下一轮要搬它，前置条件

1. 决定 `cbRun` 的归属：要么允许人工把 L8476 改成 `crystalBallApi.state.cbRun`（数值一致、`ptCb` 序列不变），
   要么先把「点光源强度」也收进统一契约（`J4` 的活）；
2. `cbMistMat` / `cbGlowMat` 经 `parts` 交出（每帧块 L7818–7819 要改这两个材质的 `opacity`）；
3. 之后照本目录其它 spec 写 `floor1-crystal-ball.json`：`assign: "crystalBallApi"`、`layout` 无需新增
   （`CBX` / `CBZ` 已在 `world/layout.js`）、`tick.old` = L7808–7820 原文、`tick.new` = 原地
   `crystalBallApi.tick(dt, time);`。

> 注：`12.13 暖桌` 一带同样有光源（`floor1/kotatsu` 的 `strength: (time) => ptKot * …`，
> `ptKot` 由 `kotatsuOn` 驱动，L8474）—— 搬它之前会撞上**完全一样**的问题。
> 本轮 B3 交付的三件（`floor1/book-pile` / `floor1/star-bell` / `floor1/tarot`）**都不含光源、不喂 `lightField`**，
> 故不受此限。
