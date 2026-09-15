# 跳过：`floor2/magic-clock`（18.12 烟囱墙上的魔法时钟，与现实时间同步） —— `J3` / B5

> 本目录 `*.json` 才会被 `_j3-apply.mjs` 读；这是一份**说明**（`.md`），故意不写 spec。
> 结论：**本轮不搬** —— 依据任务书「★ 拿不准就跳过」，以及硬约束 4。
> 上级 agent 已明确点名本件：「若不能干净搬迁就直接 SKIP」——**判据是：不干净**，理由见 §2①②。

## 1. 分区边界（整行逐字唯一，已核对）

- 标题行：`            /* 18.12 烟囱墙：魔法时钟（与现实时间同步） */`
- 「常规」端点：`            /* 18.13 前墙挂画（镜子旁，点击编辑链接，支持 gif 动图） */`
- 但**真正的安全起点在标题行之后 7 行**，因为区间开头就是一件**共享工具**（见 §2①）：

| 行 | 原文 | 归属 |
|---|---|---|
| 标题行 | `/* 18.12 烟囱墙：魔法时钟（与现实时间同步） */` | 分区标题 |
| +1 | `/* ========================================================== */` | 分隔线（全文件几十处） |
| **+2 … +7** | `            function colEdge(g, col, th) { … }`（6 行） | ★ **共享工具**，不属于时钟 |
| +8 | `            const clockCanvas = document.createElement('canvas');` | ← **这里才是时钟自己的第一行** |
| … | `clockHand` / `drawClock` / `drawClock();` / `clockG` + 表盘几何 | 时钟本体 |
| 末尾 | 空行 + `/* ==== */` + 18.13 标题 | 边界 |

每帧分支：`updateNewDecor()` 的 **第一行**：`                drawClock();`（写作时 **L4220**）。

## 2. 阻塞点

### ① `colEdge` 长在区间里，却被 4 处区间外使用

```js
// 18.12 段开头（6 行）
            function colEdge(g, col, th) { … }
```

`propCtx` 的 `propTool('colEdge', () => colEdge)`（monolith L680）指的就是它；区间外读取它的地方：

| 位置 | 用途 |
|---|---|
| `floor2/mirror.js` 的 `build({ …, colEdge, … })` | 已搬物件，**装配时**就会求值这个 getter |
| `floor2/junkBoxes.js` 的 `build({ …, colEdge, … })` | 同上 |
| 18.13 挂画（本批已搬，`floor2/picture.js` 的 build 里 1 处） | 同上 |
| 18.12 自己（3 处 `put(colEdge(…))`） | 本段 |

⇒ 按「18.12 标题行 → 18.13 标题行」整段搬，`colEdge` 会一起消失，**所有引用它的物件在装配时立刻
`ReferenceError`**（不是像素差异，是启动崩）。这一点与 `floor1-crystal-ball.SKIP.md` §2 的
「`cbRun` 被区间外读」同类，只是这里的受害面更大。

### ② `drawClock` 被装饰循环**无条件每帧**调用，且带一个模块级缓存

```js
// updateNewDecor(time, dt)
                drawClock();                                    // ← 永远是第一行，无条件
                if (picState.img && time - picState.lastT > 0.1) { … }
```
```js
// 18.12 段内
            let clockLastKey = '';                              // ← 秒级字符串缓存
            function drawClock() {
                const now = clock.mode === 'manual' && clock.frozenDateMs !== null
                    ? new Date(clock.frozenDateMs) : new Date();
                const key = now.getHours() + ':' + now.getMinutes() + ':' + now.getSeconds();
                if (key === clockLastKey) return;               // ← 同一秒内直接返回
```

两点麻烦：
- **`clock` 不在 `ctx` 里**（monolith L664–695 的清单里没有它）⇒ 搬进 `world/**` 后
  `clock.mode` / `clock.frozenDateMs` 取不到。`floor2/rubik.js` 那套 `s.now` 的处置**在这里不适用**：
  时钟读的是**相机外的真实墙上时间**（`new Date()`），不是动画时间。
- `clockLastKey` 是**跨帧缓存**，决定「一秒只重画一次」；它必须与 `drawClock` 一起进 `state`，
  否则 manual 定格模式下同一秒会被反复重画（虽然视觉相同，但 `clockTex.needsUpdate` 的
  触发次数变了，属于「行为不等价」）。

## 3. 现成配方（下一轮，若出题人裁决要搬）

```json
{
  "id": "floor2/magic-clock", "name": "magicClock", "assign": "clockApi",
  "file": "src/cabin/world/floor2/magicClock.js", "batch": "B5",
  "startMarker": "            const clockCanvas = document.createElement('canvas');",
  "endMarker": "            /* 18.13 前墙挂画（镜子旁，点击编辑链接，支持 gif 动图） */",
  "layout": [{ "name": "CLOCK_X", "value": "-2.95", "doc": "二楼烟囱墙魔法时钟中心 x" }],
  "tick": {
    "at": "updateNewDecor() 第一行",
    "old": "                drawClock();",
    "new": "                clockApi.tick(dt, time);"
  }
}
```

配套前置（3 件，缺一不可）：

1. **`startMarker` 必须跳过 `colEdge` 那 6 行**（如上：锚在 `const clockCanvas` 那一行）
   —— 这是本方案的**关键偏离**：分区标题行留在 monolith 里当"孤儿注释"，`colEdge` 原地保留。
   代价是 monolith 里会留下一段「标题 + 分隔线 + colEdge + 空行」的碎片，可读性略差但功能完整。
2. **`clock` 要么进 `ctx`**（在 monolith L695 后加 `propTool('clock', () => clock);`，一行、零像素影响），
   **要么**由物件 `import { clock } from '../../app/clock.js'`（`app/clock.js` 是核心模块，
   与 `defineProp` 同级；但它会成为 `world/**` 直接依赖 `app/**` 具体实现的**首例**，
   需要按不变量 `N3` 的口径先裁决）。
3. `state` 收 `clockLastKey`；`CHZ` 已在 layout（`const CHZ = 1.5`），只有 `-2.95` 与
   `FY + 1.42` / `rotation.y = Math.PI / 2` 需要落 layout / 留在 build。

> 本轮不做：第 1 条偏离了「分区标题行当 startMarker」的约定，第 2 条要么改 `monolith` 的 ctx 清单、
> 要么新开一条 `world → app` 依赖 —— **两件都够得着"拿不准"**，按硬约束 7 跳过。
> 相对收益：约 70 行。

## 4. 不清真的一点补充

时钟的**几何**其实非常干净（`clockCanvas / cctx / clockTex / clockHand / drawClock / clockG` +
6 行表盘几何，全部只在本段内使用，已逐名 grep 核对），唯一的问题就是 §2 的两条。
换句话说：**它不是"拆不干净"，而是"要动区间外的两处约定"** —— 留给下一轮的裁决点很小、很明确。
