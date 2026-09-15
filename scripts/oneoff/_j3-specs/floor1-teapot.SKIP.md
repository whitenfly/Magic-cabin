# 跳过：`floor1/teapot`（提梁茶壶）＋ `12.9f` 余段（茶杯 ×3 / 椅子 ×5）—— `J3` / B4

> 本目录 `*.json` 才会被 `_j3-apply.mjs` 读；这是一份**说明**（`.md`），故意不写 spec。
> 结论：**本件本轮不搬** —— 依据是任务书硬约束 4「区间外被引用的变量 ⇒ 跳过并说明」。
> 同一次跳过还把 **12.9f 的余段**（茶杯 / 椅子）一起记在这里，因为它们与本件同源。

## 已搬的是哪一半

`12.9f 长餐桌` 的**前半段**已经搬走（`floor1/long-table.json`，区间停在
`/* 茶杯（餐桌/暖桌通用） */` 那一行前）：桌体两片 + 四条桌腿 + 三只餐盘。留在 monolith 的是：

```
/* 茶杯（餐桌/暖桌通用） */   →  const cups = [] + function makeCup(x, z, baseY, parent)   （当前 L1095–L1118）
/* ---- 提梁茶壶 ---- */      →  POT_BX / CUP_T / POT_RY / POT_TILT / POT_TIP_FWD + teapot 全套（当前 L1119–L1168）
/* ---- 桌面散放餐具 ---- */   →  已搬走（floor1/tableware.json）
const chairs = [];            →  makeChair ×5                                              （当前 L1173–L1193）
```

## 提梁茶壶的边界与阻塞行

- `startMarker`：`            /* ---- 提梁茶壶 ---- */`（当前 monolith **L1119**）
- `endMarker`  ：`            /* ---- 桌面散放餐具 ---- */`（当前 monolith **L1170**，已被应用器保留）
- 区间：**L1120–1169**（`POT_BX/POT_BZ`、`CUP_T`、`POT_RY`、`POT_TILT`、`POT_TIP_FWD`
  + `teapotPos` / `teapot` / `potHalo` / `potHaloMat` / `potSpoutTip` / `potStream*`
  + `POT_T` / `potRun` / `_tv` + `regMagic(teapotPos, …)`）。
- 每帧分支（若搬则进 `update`）：`/* ---- 茶壶 ---- */` 那个块（当前 **L6773–L6826**）。

### 阻塞行（住在区间之外）

```js
const CUP_T = cups[2];        // ← 当前 monolith L1121（区间内！）
```

真正的问题是它读的 **`cups`**：`cups` 与 `makeCup` 定义在**上一个分区**（L1096–L1118），
并且还被**再下一个分区**的暖桌读（`makeCup(-0.34, -0.34, KTOP, kotatsuG)`，当前 L1618–1619）、
被每帧块读（`for (const c of cups)`，当前 L6754）。于是：

- 只搬茶壶 ⇒ `cups` 不在模块里 ⇒ 得让茶壶模块 import 长餐桌模块的内部数组（**新的跨模块耦合**，
  现有 21 件里没有这种先例）；
- 连茶杯一起搬 ⇒ 暖桌（L1618）与每帧块（L6754）立刻断引用 —— 而暖桌本身因**光源槽位**
  已判定跳过（见 `floor1-kotatsu.SKIP.md`），搬不动它也就腾不出这几处引用。

### 另外两处小依赖（记下来省下一轮时间）

1. **`D2R`**：本区间里的提梁弧线用 `(20 + i * 14) * D2R`（当前 L1140），而 `D2R` 定义在
   文件早段（当前 **L275**：`const RAIL_R = 1.24, RAIL_H = 0.85, D2R = Math.PI / 180;`）——
   搬走时要在模块里自己写 `const D2R = Math.PI / 180;`（同值，零差异）或从 ctx 取；
2. **★ `_tv` 是被跨分区共用的临时向量**：`const _tv = new THREE.Vector3();` 声明在**茶壶区间内**
   （当前 **L1167**），但读者有两拨：
   - 茶壶自己的每帧块（当前 **L6812 / L6818–6820**，`potSpoutTip.getWorldPosition(_tv)`）；
   - **暖桌收音机的音符块**（当前 **L6582 / L6584–6586**，`src.getWorldPosition(_tv)`）。
   ⇒ 茶壶一搬走，暖桌那 5 行立刻 `ReferenceError`。这一条**单独就足以判本件跳过**，
   而且它与"暖桌搬不动"叠在一起（要搬茶壶就得先动暖桌的 tick，而暖桌因光源槽位已跳过）。

## 椅子（`const chairs = [];` ×5）为什么也不能搬

```js
...chairs.map(c => ({ g: c, hx: 0.23, hz: 0.23, top: 0.475 }))     // ← 当前 monolith L5603
```

`movingPlatforms` 读 `chairs`（当前 **L5603**），住在碰撞段、既不是几何段也不是 tick 块
⇒ 应用器表达不了，任务书又禁止手改 `monolith.js`。与 `floor1-bookshelf`（`SFX/SFZ`）、
`floor1/cart-shelf`（`cartG`）、`floor1/stools`（当初人工改过两行）**同一个坑**。
椅子也没有自己的分区注释（直接接在 `/* ---- 桌面散放餐具 ---- */` 之后、`12.10 魔法扫帚` 之前），
所以连边界都不好写 —— 当年 `floor1/tableware` 只能把 `endMarker` 定在 `            const chairs = [];`
这一**行代码**上。

## 下一轮要搬它们，前置条件

1. `makeCup` / `cups` 抽成共享件（`cabin/props/cup.js` 工厂 + 各物件自报"摆几只"）——
   这是**三件（长餐桌余段 / 茶壶 / 暖桌）共同的前置**；
2. `movingPlatforms` 对 `chairs` 的引用改成装配记录的 `parts`（同 `stools` 的做法，需人工改一行）；
3. `_tv` 私有化（每件一个 `THREE.Vector3`，暖桌那份归暖桌）—— 否则茶壶与暖桌抢同一个临时量；
4. 之后按 `floor1-long-table.json` 的写法补两个 spec：
   `floor1/cup`（茶壶 + 茶杯，或茶杯单独一件）与 `floor1/dining-chairs`。
