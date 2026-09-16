# B4 · `18.13` 挂画 + `18.14` 全身镜 —— 搬迁交付与判定

本轮交付方：`J3` 搬迁执行者（子代理）。`monolith.js` / `world/layout.js` / `App.js` **未动**
（`scripts/oneoff/_j3-apply.mjs` 仍是唯一的写者）。写盘 5 个文件、全部为新增：

| 文件 | 说明 |
|---|---|
| `src/cabin/world/floor2/mirror.js` | **18.14 拱形全身镜** 搬出（几何 + 状态 + 画布绘制 + 每帧刷新）；自建射线留给 `J4` |
| `scripts/oneoff/_j3-specs/floor2-mirror.json` | 该件的 spec（边界 / layout / 人工步骤） |
| `scripts/oneoff/_j3-verify-mirror.mjs` | 逐行核对脚本（只读，不写盘）：**17 项全过** |
| `scripts/oneoff/_j3-specs/floor2-picture.SKIP.md` | **18.13 前墙挂画** 的跳过说明（含下一轮现成配方） |
| `scripts/oneoff/_j3-b4-mirror-report.md` | 本文件 |

`18.13 前墙挂画` **本轮跳过**（判据与配方见 `floor2-picture.SKIP.md`），未建物件文件、未写 spec。

---

## 1. `floor2/mirror` 的边界（原文逐字，各在文件中**只出现一次**，已实测）

```
startMarker  第 12 空格 + /* 18.14 拱形全身镜（点击镜面泛起水波涟漪） */
endMarker    第 12 空格 + /* 18.15 毛茸茸大地毯（右前角与书桌之间） */
```

- 应用器会删掉两行之间的全部内容（当前 **156 行**），其中含两行 `/* ===== */` 分隔线
  （全文件重复几十处、不能当标记；纯注释，零像素影响）。
- 区间内**不含**别的 spec 的 `startMarker`（应用器的自检项已用本目录脚本先自查）。
- `--only=floor2/mirror --check` 实测：**自检通过，未写盘**。

## 2. 逐行核对（`node scripts/oneoff/_j3-verify-mirror.mjs`）

| # | 判据 | 结果 |
|---|---|---|
| ① | 两标记各恰好 1 次、先后正确 | ✓ |
| ② | 区间不吞别的分区 | ✓ |
| ③ | 区间内 135 行几何/绘制代码按原序、**按原缩进**逐字对上 | ✓ |
| ④ | 唯一整块不在的是射线 6 条语句（20 行）——逐行列出，证明没多删 | ✓ |
| ⑤ | `update()` = `updateNewDecor()` 里那 8 行（只加 `s.` 前缀） | ✓ 8/8 |
| ⑥ | 物件文件"多出来的代码行"= 22 行，逐条列出（模板 / state / ctx 解构 / 别名 / 交接 / return） | ✓ |
| ⑦ | 无 `regMagic`/`interactables`/射线残留；`state` 与 `parts` 交出了 J4 需要的两样 | ✓ |

改写只有 **2 处**：
1. `mirrorG.position.set(2.55, FY, 3.60)` → `(MIRROR_X, FY, MIRROR_Z)`（坐标进 `layout.js`，不变量 `N9`）；
2. `const mirrorRipples = []` → `const mirrorRipples = state.ripples`（**同一个数组实例**，`build()` 里的绘制函数一字未改）。

`ctx` 键：`scene` / `L(MIRROR_X, MIRROR_Z, FY)` / `put` / `cbox` / `colEdge` / `MAT` / `LITMAT` / `rng.runtime`
（按需解构；`cbox`/`colEdge` 就是 monolith 那三个函数本身 —— 已核在原 `L4384` / `L5180` 各只有一处声明）。
`rng`：`build` 不消耗随机源；只有 `spawnMirrorRipple` 用 `rng.runtime`（同一个真随机源实例）。

## 3. 挂账：**镜子只还了一半**

**还上的那一半**：几何、状态（`ripples` / `dirtyT` / 画布 / 星表）、`drawMirror`、`spawnMirrorRipple`、
每帧刷新（涟漪老化 + 每 0.12 秒重绘）。

**没还的那一半（留给 `J4`）**：自建射线（原 `L5498–L5517`）。它需要三样本物件拿不到的东西：

- `renderer.domElement`（监听器挂载点）；
- `camera`（`mirrorRay.setFromCamera(mirrorMouse, camera)`）；
- 命中点的**局部坐标**（`mirrorPane.worldToLocal(hits[0].point.clone())`）。

而 `installProp` 的 `ctx` 只有 `scene / L / rng / 几何 DSL / 材质 / SND`（**没有** `camera`/`renderer`）；
它补的 aim 通路（`magicMeshes` + `userData.onClick`）只传"激活"、**不传命中点**，且镜子**不能**改走主射线
（它不看遮挡，`J2.6` §5 已拒绝"被家具挡住就点不到"这个行为变化）。
⇒ 射线等价搬迁必须先改 `monolith.js`（给 `ctx` 补 `camera`/`renderer`，或让 aim 契约带 `hit.point`），
超出本轮"只加一行 `installProp(...)` + 一行 `tick`"的约定，故按任务要求留给 `J4`。
`J4` 的最短路径：本文件已把两样交出去 —— `parts.pane`（求交对象）与 `state.spawnRipple`（加涟漪入口）。

**诚实后果**：`J3` 期间镜面**点不出涟漪**（用户可见的交互入口暂时消失）；但**画面零差异** ——
镜面的高光扫过与星星闪烁由 `dirtyT` 每 0.12 秒重绘驱动，时序与搬迁前逐帧一致
（搬迁前也不在 `build` 时画第一帧，本文件保持同一时序）。

## 4. 需要人工在 monolith 侧做的事（应用器只管几何段）

1. 装配行接住句柄：`const mirrorApi = installProp(mirror);`（`assign` 已声明，应用器自动写成这样）。
2. 把 `updateNewDecor()` 里镜子那 8 行（原 `L5534–L5541`）整段替换为 `mirrorApi.tick(dt, time);`
   —— **参数顺序是 `(dt, time)`**，而 `updateNewDecor(time, dt)` 自己的形参是反的（纸箱那件踩过同一个坑）。
   不做 = **立刻 `ReferenceError`**（`mirrorRipples` 已随区间删除）⇒ 装饰循环整条停摆。
3. **`let mirrorDirtyT = 0;`（原 `L5547`）必须留着别删**：`scripts/verify-f03.mjs` 第 ⑥ 项断言
   `let decorLastT = 0;` / `let mirrorDirtyT = 0;` / `// F0.3：装饰循环…` 三行**连续存在**；
   此后它是死变量（计数器已归 `state.dirtyT`）。
4. 计数门禁：射线那两行 `renderer.domElement.addEventListener(...)` 随区间删除 ⇒
   `scripts/verify-migration.mjs` ④ 的 `addEventListener(` 由 −1 变 −3，需同步 `J25_DELTA`
   （`new THREE.Mesh(` / `new THREE.Group(` 不受本件影响：几何原样搬走，一增一减）。

**本件不声明 `interactables`**（判断，不是遗漏）：搬迁前镜子没有 `regMagic`；若补 aim 条目，
`installProp` 会把镜面 Mesh 加进 `magicMeshes`，准星/点击从此能命中镜子且变成"被挡住就点不到"。

## 5. 跳过项：`18.13 前墙挂画`（按硬约束 4）

完整判定与"下一轮现成配方"见 **`scripts/oneoff/_j3-specs/floor2-picture.SKIP.md`**（与本目录 `floor1-crystal-ball.SKIP.md` 同一约定）。摘要：

- 该段的私有状态被 `updateNewDecor()` **区间外**读写：`picState`（L5530 / L5532）、`drawPicImage`（L5531），
  连同 L5533 构成 4 行「GIF 每 0.1 秒重绘」——"支持 gif 动图"正是靠它；
- 应用器只做 `[startMarker, endMarker)` 整段替换，**摘不掉**那 4 行；`picState` 随段删除后那 4 行会抛
  `ReferenceError`（装饰循环整条停摆）⇒ 按硬约束 4「区间外被引用的变量 ⇒ 跳过并说明」+ 硬约束 7 跳过；
- **不写 spec**（否则谁跑一次无 `--only` 的应用器就把这个崩溃写进 monolith）；
- 与镜子为何处理不同：镜子的每帧分支是**镜面 canvas 的唯一画笔**（不搬 ⇒ 镜面变空白 ⇒ 像素判据当场失败），
  挂画的 canvas 默认由 `build` 里的 `drawPicBlank()` 画好（那 4 行只影响"用户贴了链接之后"）⇒ 跳过**零像素影响**。

