# B6（室外场景）搬迁可行性判定 —— **结论：当前整片不可搬，本次零写盘**

来源：`J3` 搬迁 B6 分批。目标区段 = `src/cabin/legacy/monolith.js` 的
`/* ============ 室外场景：森林 · 草地 · 石头 · 花 · 萤火虫 ============ */` 分区
（含标题行共 3 行装饰 + 内容，当前 ≈ L404–L609；**行号会随并行搬迁漂移，下文一律以原文行为锚**）。

> ⚠️ 本文件写作时，`monolith.js` 正被其他批次并行改写（8990 → 8928 → … 行）。
> 下文行号是**当时的快照**，判断结论只依赖**原文内容**，不依赖行号。

> 本文件只是**证据与预案**，不是 spec。`scripts/oneoff/_j3-apply.mjs` 只读
> `scripts/oneoff/_j3-specs/*.json`，不会读到本文件。
> **本次未写任何 spec、未写任何 `world/outdoor/*.js`、未改 `monolith.js` / `layout.js` / `App.js`。**

---

## 0. 为什么一个文件都没产出：两条**独立**的阻塞

| # | 阻塞 | 性质 |
|---|---|---|
| A | 该区段**整体位于 `installProp` 定义之前**（装配器 TDZ） | 结构性：插入 `installProp(...)` 必抛 `ReferenceError` |
| B | 该区段内部由 `addStatic` / `staticFillGeoms` / `staticEdgeGeoms` / `yardSpotFree` 串成**不可切分的一条链**，且链上的「花」与「萤火虫」被 `animate()` 直接引用 | 依赖锁：即使 A 解决，任意切法都会 ReferenceError 或改变画面 |

两条都成立 ⇒ 无论怎么切都失败。**A 单独就足以否决本批全部候选件。**

---

## 1. 阻塞 A：装配点（`installProp`）在室外段之后

原文（当前 L639，唯一出现）：

```js
            const { install: installProp, stats: propStats } = createPropInstaller({
```

它在 `/* ============ 室内陈设专用：圆角几何与材质工具 ============ */`（当前 L611）与
`roundBoxGeo/rbox`（L614）、`HITMAT/DARK/PINK/CATMAT/CATMAT2`（L618–L623）、
`lloop/solid/solidCyl`（L626）**之后**才求值 —— 因为 `ctx` 里要用到这些材质与几何工具。

而 `_j3-apply.mjs` 的语义是**在原位置**把 `[startMarker, endMarker)` 换成
`installProp(name);`（第 144–149 行）。于是任何落在 L639 之前的分区，替换后必然变成：

```js
installProp(outdoorYard);   // ← ReferenceError: Cannot access 'installProp' before initialization
```

**已搬迁的物件全部落在装配点之后**，正好印证这条隐含前提：

| spec | 装配调用（当前行号） |
|---|---|
| `floor1/rug-under-table` | L861 |
| `floor1/stove-platform` | L1273 |
| `floor1/broom`（并行批次） | L1647 |

室外段内容当前在 L407–L608，**全部早于 L639** —— 12 行缩进、与装配点同属 `installCabin` 的
IIFE 块作用域，`const` 的 TDZ 生效，不存在"提前可用"的余地。

> 另外，室外段之前还夹着"门口路牌 / 栅栏 / 蘑菇"（当前 L383–L402），
> 它们同样早于 L639，**同一条 TDZ 一概否决**。

---

## 2. 阻塞 B：`addStatic` 链不可切分（即使 A 已解决）

区段内的依赖地图（行号为当前值，原文为准）：

```
L407  const staticFillGeoms = [], staticEdgeGeoms = [];      ┐ 收集器（两个数组）
L408  function addStatic(...)  → push 进上面两个数组          ┘
L418  const STUMPS = [[7.6, -5.8], [-8.2, 3.6], [-6.5, -8.5]];
L419  function yardSpotFree(x, z)                            ← 依赖 L418 的 STUMPS
L428-432  TREE_TRUNK / TREE_C1..C4     ┐
L433-453  树圈循环（r = 20.8 … 34.5）   │ 用 outdoorRng + addStatic
L455-467  GRASS_BLADE + grassClumpStatic │ 用 outdoorRng + addStatic
L469-489  vHash + stoneStatic          │ 用 outdoorRng + addStatic
L491-495  STUMP_G + 树桩 + 木板         │ 用 outdoorRng + addStatic + STUMPS
L497-512  { 草 70 株循环 + 石 26 块循环 }  ← 草与石**共用同一个块作用域**
L514-533  花 12 朵（flowerMats / PETAL_G / FLOWER_COLORS）
            用 outdoorRng + yardSpotFree(L522) + addStatic(L523)
L535-562  (function mergeStatic() { ... })()  ← 一次性消费两个数组，生成 1 个 Mesh + 1 个 LineSegments
L564-608  萤火虫（FF_N / fireflies / ffPos / ffPhase / ffGeo / ffUniforms / ffMat / fireflyPts / ffOpacity）
            用 outdoorRng + yardSpotFree(L572)
```

### 2.1 为什么"树"不能单独搬

树段（L428–L453：`TREE_TRUNK`/`TREE_C1..C4` + 树圈循环块）只做一件事：`addStatic(TREE_*, ...)`。
`addStatic` 把几何 push 进 `staticFillGeoms` / `staticEdgeGeoms`，
最终由 `mergeStatic` **把所有静态散布合并成一个 Mesh + 一个 LineSegments** 再加进 `scene`。

- 若树单独搬走并自带合并 ⇒ 场景里会多出一个 Mesh/LineSegments，`scene.children` 构成、
  绘制顺序、透明混合全部改变 ⇒ **像素零差异必失败**；
- 若树搬走但继续用 `addStatic` ⇒ 模块拿不到它：`ctx` 里**没有** `addStatic`
  （`installProp` 的 ctx 只有 `scene/L/rng/V,geo,line,…,put,…/MAT,FILL,…/SND`），
  而 `monolith` 里给它补一行 `const addStatic = …` 属改 monolith，被硬约束禁止。

### 2.2 为什么"花"与"萤火虫"必须留在 monolith

`animate()` 里直接按名字引用它们的变量：

| 原文（`animate()` 内） | 被引用的区段私有变量 | 后果 |
|---|---|---|
| `signSideMat.color.copy(FILL.uniforms.uColor.value);`<br>`signFaceMat.color.copy(FILL.uniforms.uColor.value);` | 路牌段 `signSideMat` / `signFaceMat` | 路牌不能搬 |
| `for (const f of flowerMats) f.mat.color.copy(f.base).multiply(_amb);` | 花段 `flowerMats`（`_amb` 随昼夜/天气变化，见 L7774–L7780 的 `_amb` 组装） | 花不能搬 |
| `let ffTarget = 0; … ffOpacity += …; ffUniforms.uOpacity.value = ffOpacity;` | 萤火虫段 `ffOpacity` / `ffUniforms` | 萤火虫不能搬 |
| `if (ffOpacity > 0.01) { for (let i = 0; i < FF_N; i++) { const f = fireflies[i]; ffPos[…] … } ffGeo.attributes.position.needsUpdate = true; }`<br>`ffUniforms.uTime.value = time;` | `FF_N` / `fireflies` / `ffPos` / `ffGeo` / `ffUniforms` | 萤火虫不能搬 |

按硬约束 5 的判据：这些变量**既被几何段创建/写、又被 `animate()` 读写** ⇒ **跳过该件**。

于是产生连锁锁（这是本批的关键）：

```
花段（必须留下）→ 引用 addStatic(L523) 与 yardSpotFree(L522)
萤火虫段（必须留下）→ 引用 yardSpotFree(L572)
        ⇒ addStatic / staticFillGeoms / staticEdgeGeoms / STUMPS / yardSpotFree **必须留在 monolith**
        ⇒ 所有用 addStatic 的段（树、草、石、树桩、木板、花）**都不能搬**
        ⇒ mergeStatic（消费那两个数组）也**不能搬**
```

即：**不是"某一件拆不干净"，而是整片共享同一台"静态散布收集器"，
其中两个消费者（花、萤火虫）被 `animate()` 钉在 monolith 里。**

### 2.3 逐候选件判定

| 建议件 | 区段 | 判定 | 原因 |
|---|---|---|---|
| `outdoor/forest` | L428–L453 | ✗ | 用 `addStatic`（见 2.1） |
| `outdoor/ground`（草） | L455–L467 | ✗ | 用 `addStatic`；且调用点在 L497–L503 的共享块内 |
| `outdoor/rocks` | L469–L489 | ✗ | 用 `addStatic`；且调用点在 L504–L511 的**同一个**块 |
| （树桩+木板） | L491–L495 | ✗ | 用 `addStatic` + `STUMPS` |
| （草/石散布循环） | L497–L512 | ✗ | 草与石**共用一个 `{}`**（`let gN…guard` / `let sN…guard`），切开即语法崩 |
| `outdoor/flowers` | L514–L533 | ✗ | `flowerMats` 被 `animate()` 引用（硬约束 5） |
| （静态合并 mergeStatic） | L535–L562 | ✗ | 消费留下的两个数组；且 `scene.add` 顺序参与渲染 |
| `outdoor/fireflies` | L564–L608 | ✗ | `ffOpacity/ffUniforms/fireflies/ffPos/ffGeo/FF_N` 被 `animate()` 引用；并用 `yardSpotFree` |
| `outdoor/signpost`（路牌） | L383–L393 | ✗ | ① 不在本分区内；② `signSideMat/signFaceMat` 被 `animate()` 引用；③ `openSignEditor` 被 `interaction.registerProximity({ id: 'outdoor/signpost', … })` 引用；`signText/drawSign` 被便签/路牌编辑器（`applySign`）引用；④ **无可用边界**（见 §4） |
| （栅栏 + 蘑菇，附带） | L397–L402 | ✗ | 内容自洽（`GATE_L/GATE_R/mushroom/picket` 无区外引用），但 ① 早于 L639（TDZ）；② **无可用边界**（见 §4） |

**没有一件满足"所有使用点都落在划给它的范围内"这条判据。**

---

## 3. 边界可行性（`startMarker` / `endMarker` 唯一性核验）

用 `Select-String -SimpleMatch` 在当前文件上实测（每个都恰好 1 次）：

| 原文行（含 12 空格缩进） | 出现次数 |
|---|---|
| `            /* ============ 室外场景：森林 · 草地 · 石头 · 花 · 萤火虫 ============ */` | 1 |
| `            const staticFillGeoms = [], staticEdgeGeoms = [];` | 1 |
| `            const flowerMats = [];` | 1 |
| `            const STUMP_G = new THREE.CylinderGeometry(0.24, 0.3, 0.55, 9);` | 1 |
| `            const FF_N = 26;` | 1 |
| `            /* ============ 室内陈设专用：圆角几何与材质工具 ============ */` | 1 |

而 `            /* ========================================================== */`（分隔线）在文件里出现**几十次** ——
按任务要求**不可用作边界**。

---

## 4. 将来可搬的前提条件与建议边界（**现在不可应用**）

### 4.1 需要先具备的两个能力

1. **让室外段能拿到 `installProp`**。可选路径（都属 monolith / app 层改动，须由应用器或主控执行）：
   - 把 `createPropInstaller({...})` 的求值提前到室外段之前（注意：其 `ctx` 依赖 L614 的
     `roundBoxGeo/rbox`、L618–L623 的 `HITMAT/DARK/PINK/CATMAT/CATMAT2`、L626 的 `lloop/solid/solidCyl`，
     **不能简单上移** ⇒ 需要把 `ctx` 改为延迟求值/分段装配，或让 `createPropInstaller` 接受 `ctx` 工厂）；
   - 或让 `_j3-apply.mjs` 支持"删除区间"与"装配调用插入点"分离（`callAt`）。
2. **让应用器能把 `animate()` 内的分支摘除**（搬进物件的 `update`）。当前应用器只做
   `[startMarker, endMarker)` 整段替换，**无法**摘掉 `animate()` 里那几行；
   而 `flowerMats` / `ffOpacity` / `signSideMat` 的分支不搬走，几何就搬不走。

**能力 1 + 2 同时具备后**，本片才谈得上拆分。

### 4.2 那时建议的切法（2 件，边界首尾相接、无重叠无空隙）

先说明：`collector(addStatic) + 树 + 草 + 石 + 树桩 + 花 + mergeStatic` 必须**同件**
（§2.1/§2.2），因此**做不到**任务建议的 7 件细粒度 —— 只有下面这一种干净切法：

**件 1 `outdoor/yard-static`**
- `startMarker`：`            /* ============ 室外场景：森林 · 草地 · 石头 · 花 · 萤火虫 ============ */`
- `endMarker`：`            const FF_N = 26;`（= 件 2 的 startMarker，**首尾相接**）
- 区间内容：`staticFillGeoms/staticEdgeGeoms` + `addStatic` + `STUMPS/yardSpotFree` +
  `TREE_*` 与树圈循环 + `GRASS_BLADE/grassClumpStatic` + `vHash/stoneStatic` +
  `STUMP_G`/树桩/木板 + 草石循环块 + 花 12 朵 + `mergeStatic`
- `ctx` 键：`scene`、`rng.outdoor`、`FILL`、`MAT`、`put`（+ `THREE`）
- `update`：**必须承接** `for (const f of flowerMats) f.mat.color.copy(f.base).multiply(_amb);`
  （需要 `_amb` 进 ctx，或改为事件/环境注入）—— 目前不满足
- `layout`：段内坐标全是行内字面量且无交互引用（`yardSpotFree` 的 4 个矩形禁区、
  `STUMPS` 三点、栅栏 `±7`、`z=7.5` 等），可**不入 layout**，在 notes 里说明

**件 2 `outdoor/fireflies`**
- `startMarker`：`            const FF_N = 26;`
- `endMarker`：`            /* ============ 室内陈设专用：圆角几何与材质工具 ============ */`
  （⚠️ 该 endMarker 会**吸收**它前面那行 `/* =====…===== */` 分隔线 —— 因为分隔线不唯一、无法单独作标记；纯注释，零像素影响，但要在 spec 的 `notes` 里写明）
- `ctx` 键：`scene`、`rng.outdoor`（+ `THREE`）
- 跨件依赖：`yardSpotFree(x, z)`（L572 用）住在件 1 ⇒ 需要把它连同 `STUMPS`（L418）提取到一个
  纯函数共享模块（如 `world/outdoor/yardSpot.js`）由两件 import（**不可复制实现**，否则违反"不重复"且两处漂移）
- `update`：**必须承接** `ffTarget/ffOpacity/ffUniforms.uOpacity` 与
  `if (ffOpacity > 0.01) { …ffPos…ffGeo… }` + `ffUniforms.uTime = time` 两段

**件 3 `outdoor/signpost`（路牌）** —— 即使 A/B 解决也**仍需先解阻塞**：
- `startMarker` 无解：L383 之前没有任何注释标题行（L382 是空行、往上 L355–L357 是
  `regMagic` 的说明注释、"木箱/门廊"都是裸代码行），**代码行不能当 startMarker**
  （应用器会把它**保留**在 monolith 里 ⇒ 路牌建两份 ⇒ 像素差异）。
  必须先由 monolith 侧补一行注释标题（如 `// ---- 门口路牌 ----`）才谈得上 spec。
- 编辑器/动画四处引用需一并处理：`openSignEditor`（L7274 的 `registerProximity`）、
  `signText` / `drawSign`（`applySign`）、`signSideMat` / `signFaceMat`（`animate()`）。

**栅栏 + 蘑菇（L397–L402）**：内容自洽、是唯一"无区外引用"的块，但同样是
① TDZ、② 无注释边界（L396 是 `GATE_L` 上方的屋脊装饰代码、L402 后是空行）。
补一行注释标题后，它是本片最省事的搬迁候选（`kind: 'decor'`，无状态无动画）。

---

## 5. 本次交付清单

| 项 | 状态 |
|---|---|
| `src/cabin/world/outdoor/*.js` | **未创建**（不留死代码 / 避免与 J4 重复实现冲突） |
| `scripts/oneoff/_j3-specs/*.json` | **未创建**（若存在，别人跑一次无 `--only` 的 `_j3-apply.mjs` 就会把 TDZ 崩溃写进 monolith） |
| `monolith.js` / `layout.js` / `App.js` | **未改**（唯一写者是 `_j3-apply.mjs`） |
| 依赖地图 / 边界唯一性核验 / 预案 | 本文件 |

> 判据回顾：**"拿不准就跳过"**。这里不是拿不准，而是有两条可复核的硬阻塞（§1 与 §2）。
> B6 建议整体留给 `J4`，与"装配点提前 / animate 分支摘除"两项能力一起处理。
