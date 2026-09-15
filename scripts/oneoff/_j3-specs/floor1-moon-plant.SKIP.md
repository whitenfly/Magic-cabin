# SKIP —— `floor1/moon-plant`（12.x 月光魔法盆栽【门侧前右墙角】）

> `J3` 判定：**跳过**（不写 prop、不写 `.json` spec）。
> 写下这份说明是为了让 `J4` 不必重新分析一遍 —— 边界、阻塞行、槽位、解锁条件都在这里。
> 同类先例：`floor1-crystal-ball.SKIP.md`、`floor1-kotatsu.SKIP.md`、`floor1-hanging-lantern.SKIP.md`、
> `floor1-magic-circle.SKIP.md`。

## 边界（若将来要搬）

| 项 | 值 |
|---|---|
| `id` | `floor1/moon-plant` |
| 新文件 | `src/cabin/world/floor1/moonPlant.js` |
| `startMarker` | `            /* ---- 月光魔法盆栽【门侧前右墙角】 ---- */` |
| `endMarker` | `            /* ---- 12.12 塔罗牌牌堆 ---- */` |
| layout | `PLX` / `PLZ` **已**在 `layout.js`（一楼锚点区），无需新增 |
| 建议 ctx 键 | `scene / L / put / line / edge / lloop` |

## 阻塞：光源强度经**区间外**的中间量喂进光照场

```
几何 + 状态      L1256  /* ---- 月光魔法盆栽【门侧前右墙角】 ---- */   →  L1284  let plantRun = 0;
交互             L1285  regMagic(plantG, () => { plantRun = 4.0; });
光源注册（槽 7）  L6289  lightField.register(createPointLightSource({ id: 'floor1/moon-plant',
                          …, strength: () => ptPlant, … }));
                ↑ 它读的是 ptPlant，不是 plantRun
区间外赋值        L6979  ptPlant += ((plantRun > 0 ? 1 : 0) - ptPlant) * 0.055;
                ↑ 这一行住在 tickOnce() 的「室内点光源」段里 —— 应用器替换不到它
```

`plantRun` 随几何段搬走之后，L6979 会 `ReferenceError`（整个 `tickOnce` 当场停摆）。

两条路都不通：

1. **把光源写进 `lights()`** —— 它会在**盆栽所在位置**（L1256 附近）注册，而 `lightField` 的
   **注册顺序 = shader 闪烁相位 `float(i)` 的槽位**。当前槽序是
   `lantern(0) / cauldron(1) / magic-circle(2) / kotatsu(3) / crystal-ball(4) / candle(5) / veil(6) / moon-plant(7)`；
   提前注册 ⇒ 盆栽变槽位 0、其余 7 盏相位全部移位 ⇒ **画面必变**。
2. **保留 `plantRun` 在 monolith** —— 状态漏回 monolith，违反不变量 `N7`（禁止新增全局可变状态），
   而且交互逻辑也得跟着留下 ⇒ 等于没搬。

## `J4` 的解锁条件

1. **光源注册按原槽序批量进行**（把 8 盏灯收进一个"按固定顺序注册"的通道），或
2. 让 `ptXxx` 这类"强度中间量"成为**物件的状态**（`state()`）并由 `lights()` 的 `intensity` 直接读 ——
   前提是注册顺序不再决定相位（即 ① 先落地）。

在此之前，本件与 `crystal-ball` / `kotatsu` / `hanging-lantern` / `magic-circle` / `candle`
属于**同一个病根**（6 件），应当一并处理。
