# 跳过：`floor1/kotatsu`（12.13 暖桌 + 收音机 + 果盆橘子 + 方坐垫 + 茶杯 ×2）—— `J3` / B4

> 本目录 `*.json` 才会被 `_j3-apply.mjs` 读；这是一份**说明**（`.md`），故意不写 spec。
> 结论：**本件本轮不搬** —— 两个**各自独立**的硬阻塞（任务书硬约束 4 + 光源槽序），
> 与 `floor1-crystal-ball.SKIP.md` 同一类，且比它多一条"跨分区复用几何"的依赖。

## 分区边界（逐字核对，两个标记在 monolith 里各出现 1 次）

- `startMarker`：`            /* ---- 12.13 暖桌（八角桌板 + 等腰梯形垂帘 + 四角倒三角填补）+ 收音机 + 果盆橘子 + 方坐垫 ---- */`（当前 monolith **L1432**）
- `endMarker`  ：`            /* ---- 门铃【墙外侧，与门中间齐平高度】 ---- */`（当前 monolith **L1652**）
  （★ 注意 `/* ---- 门铃` 这个**前缀**在文件里出现两次：L1652 是分区、L6834 是 tickOnce 里的
  `/* ---- 门铃：按钮按压 + 音波涟漪 ---- */`；用作标记时必须写**整行**，整行是唯一的。）
- 区间：**L1433–1651**（`kotatsuOn` / `kotGlowMat` / `radioNoteRun` + 八角桌板/垂帘/四角倒三角
  + `kotGlow` + `radioG`/`noteMat`/`radioNotes` + `regMagic(kotBody, …)` + `regMagic(radioG, …)`
  + `oranges`/`orangeState`/`orangeT` + **`makeCup(-0.34, -0.34, KTOP, kotatsuG)` ×2**（L1618–1619）
  + `cushions`）。
- 每帧分支（若搬则进 `update`）：**三段**，全在区间外：
  `/* ---- 暖桌：暖光呼吸 + 收音机音符 ---- */`（**L6568**）、
  `/* ---- 橘子：盆内 ⇄ 滚上桌面 ---- */`（**L6599**）、
  `/* ---- 坐垫：水平翻滚 180° ---- */`（**L6623**）。

## 阻塞一：`kotatsuOn` 是**光照场第 3 槽**的强度输入

```js
ptKot += ((kotatsuOn ? 1 : 0) - ptKot) * 0.07;        // ← 当前 monolith L6976
```

`kotatsuOn → ptKot → floor1/kotatsu（槽位 3）的 strength`，而 L6976 住在**替换区间之外**
（与 `ptLantern/ptMc/ptCb/ptPlant` 挤在同一段"室内点光源"里，紧随其后就是 `lightField.update`）。
搬走 ⇒ monolith 里 `kotatsuOn` 消失 ⇒ L6976 `ReferenceError`；把这一盏重注册进 `lights()`
则槽位从 3 变成 8 ⇒ 破 `defineProp.js` 纪律 3 ⇒ 像素回归。
（与 `12.7 吊挂木灯`、`12.11 水晶球`、`紫色魔法阵`、`月光魔法盆栽` **同一个病根**。）

## 阻塞二：`makeCup` / `cups` 是 **12.9f 长餐桌**分的产物（跨分区复用）

L1618–1619 调用的 `makeCup` 定义在**上一个分区**（`/* 茶杯（餐桌/暖桌通用） */`，当前 L1096–L1117），
`cups` 数组同时被三处读：

| 读者 | 位置 | 说明 |
|---|---|---|
| 提梁茶壶 | 当前 **L1121** `const CUP_T = cups[2];` | 茶壶往哪只杯子倒水由它决定 |
| 暖桌 | 当前 **L1618–1619** | 桌上摆两只茶杯 |
| 每帧 | 当前 **L6754** `for (const c of cups)` | 茶杯升腾/水汽动画 |

⇒ 暖桌与茶壶都**依赖长餐桌那一件的内部函数**。要搬暖桌，得先把 `makeCup` 抽成
`cabin/props/` 级别的共享工厂（`world/README.md` 已经写了这个方向："跨场景复用道具放在
`cabin/props/`，本目录只负责摆放"），那不是本轮能顺手做完的事。

## 下一轮（`J4`）要搬它，前置条件

1. 光源强度收进统一契约（`J4`），`ptKot` 这个中间量消失；
2. `makeCup` 抽成 `cabin/props/cup.js`（共享工厂），茶杯的"摆哪几只"由各物件自己声明；
3. 把上述三段 tick 按顺序搬（它们在 tickOnce 里是连续的），`tick.old` 取 L6568 起整段；
   `kotGlowMat` / `noteMat` / `radioNotes` / `radioG` / `oranges` / `cushions` 经 `parts` 交出。
