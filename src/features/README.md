# src/features — 功能模块（一模块一目录）

> **定位**：★ **这里是"增量开发单元"**。决策 4 规定"一个功能模块一个功能模块地来"，
> 所以一个模块 = **一个目录**，而不是"一行注册"。
>
> 真源是 [`docs/BuildPlaning/mapping.yaml`](../../docs/BuildPlaning/mapping.yaml)：
> 每个模块承载哪件物品、怎么交互、用什么呈现通道、用哪些配置键，**都在那里写一次**。
> 本目录只承载**实现**。
>
> **当前状态**：⬜ 空壳（清单为空）。除本 README 与 `_index.js` 外无任何模块目录 ——
> 按 `02-架构与目录调整.md` §3 的要求"**按需创建，不预置空目录**"。
> 第一个模块 `01-posts`（M01 内容存档）随 `J6` 落地。
>
> ✅ **但装配链路已经通了**（`J2.5`）：`cabin/boot.js` → `blog/registry.js` 会按
> `src/config/modules.config.js` 过滤本清单、只对**启用**的模块调用 `load()`。
> 也就是说——**现在往下面加一行、再在 `modules.config.js` 里加一个开关，就有一个真模块了**，
> 不需要再动任何装配代码。

---

## 1. 与 `mapping.yaml` 的对应

| mapping.yaml | 本目录 | 配置 |
|---|---|---|
| `id: M04` | `src/features/04-taxonomy/` | `src/config/taxonomy.config.js` |
| `id: M03a` | `src/features/03a-search/` | `src/config/search.config.js` |
| `id: M03b` | `src/features/03b-random/` | `src/config/random.config.js` |

**命名规范**：

| 项 | 规范 | 例 |
|---|---|---|
| 目录 | `<两位序号>-<短名>`（序号取 `mapping.yaml` 的 id 数字位） | `04-taxonomy` |
| Feature id | 与 `mapping.yaml` 的 `id` 完全一致 | `M04` |
| 配置文件 | `src/config/<短名>.config.js` | `taxonomy.config.js` |
| 挂载点 | `<物品>/<部位>`，注册在 `cabin/app/mounts.js` | `reagent/rack` |
| 命令 | `<域>:<动作>`，沿用 `Blog-Part/03` §5.1 的命名表 | `taxonomy:open` |

---

## 2. 一个模块目录里有什么

```
src/features/04-taxonomy/
├─ index.js        Feature 契约：{ id, requires, order, settings, setup(ctx), start?(ctx), dispose?(ctx) }
├─ model.js        ★ 纯函数：数据 → 呈现参数（零 3D 依赖、零副作用、可单测）
├─ data.js         数据适配：只读（posts.json / 集合 / 本地 JSON）
├─ scene.js        场景挂载：认领挂载点、注册 interactable、按帧写物件属性
├─ panel.dom.js    通道 D 的面板（原生 ESM 动态 import）
├─ panel.canvas.js 通道 A 的 Canvas 绘制函数
├─ content.js      通道 B 的正文 DOM（交给 blog/reader 装填进书页）
├─ commands.js     该模块注册的命令实现
└─ README.md       本模块的映射摘要（**引用** mapping.yaml，不复制表格）
```

> **不是每个模块都需要全部文件**：通道 `T4` 的模块可能只有 `index.js` + `model.js` + `scene.js`。
> 判据见 [`03-渲染通道与构建选型.md`](../../docs/BuildPlaning/03-渲染通道与构建选型.md) §4.2 的五问。

---

## 3. 依赖规则（违反即回归）

| 规则 | 内容 | 出处 |
|---|---|---|
| **N2** | `cabin/world/**` **不得** import `blog/**` 或 `features/**`；物品只发命令名 | `02` §5 |
| **N3** | 本目录 **不得** import `cabin/world/**` 的具体实现；只能通过 `cabin/app/mounts.js` 的**挂载点 ID** 与 `ctx` 拿到场景对象 | `02` §5 |
| **N11** | 可调参数一律来自 `src/config/`，**不得**在模块里写死 | `02` §5 |
| **N12** | 本目录不得 import `*.astro`；Astro 侧不得 import 本目录（除唯一入口 `CabinMount.astro`） | `02` §5 |

```
物品侧（world）                     模块侧（features）
  defineProp({ mount: 'reagent/rack' })
        │                                   │
        │ 注册挂载点                         │ ctx.mounts.get('reagent/rack')
        ▼                                   ▼
  cabin/app/mounts.js  ────────►  Object3D / anchor / radius
        ▲                                   │
        │                                   ▼
  onActivate: ctx.commands.run('shelf:focus')  ◄── commands.js 注册实现
```

**两侧互不 import，只通过"挂载点 ID"与"命令名"相认。** 这是模块能独立关闭（验收 `BB3`）的前提。

---

## 4. 加一个模块的标准动作

**严格走 [`04-模块增量开发与配置编排.md`](../../docs/BuildPlaning/04-模块增量开发与配置编排.md) §2 的九步 SOP**：

```
S0 选模块（看 mapping.yaml 的 status: proposed 与 depends）
S1 ★ 作者拍板（改 mapping.yaml，status → confirmed）        ← 唯一需要人工决策的一步
S2 写配置（src/config/<短名>.config.js + index.js + types.js + modules.config.js + config/README.md）
S3 写纯函数模型 model.js
S4 写数据适配 data.js
S5 场景挂载 scene.js（mode 必须 both，label 必须语义化）
S6 写面板 panel.*（按 render.channels 选形态）
S7 注册命令 commands.js
S8 验收（mapping.yaml 的 accept + 通用清单）
S9 回填（mapping.yaml status → shipped，impl 填本目录路径）
```

**每完成一步项目都处于可运行、可部署状态** —— 这是"独立可停"的含义。

---

## 5. 装配与开关

- **装配**：`_index.js` 是**唯一总装文件**（一行一个模块）。
  `cabin/boot.js` 在 `installCabin()` 之后把它交给 `blog/registry.js`，
  后者按 `src/config/modules.config.js` 过滤，再对启用的模块调 `load()` 并 `app.register(feature)`。
  （清单由 `boot.js` **注入**而不是 `registry.js` import —— 因为 `blog/**` 不得依赖任何一个模块。）
- **开关**：把 `modules.config.js` 里对应模块置 `false` →
  ① 它的 `interactable` 不注册，物品恢复纯装饰（点击给「这件东西还没启用」浮标）；
  ② 它的页面/面板不生成；
  ③ 它的 `features/<id>/**` **不被 import、不被下载**（`load()` 是 thunk，未启用就根本不调用）。
  —— 三条合起来就是验收 `BB3` / `CF1`。

> ✅ **`J2.5` 已落地的部分**：②③ 与 ① 的"不注册"由 `blog/registry.js` 实现，
  并由 `pnpm verify:cf` 的 `CF1`（8 项断言，含"逐个关闭任一模块"）机器守住。
> ⚠️ ① 的"**物品恢复纯装饰**"还差一半：需要"哪件物品属于哪个模块"这个信息，
> 而那要等 `J3` 的挂载点 ID 表（`cabin/app/mounts.js`）。
> 文案出口已经备好：`blog/registry.js` 的 `notEnabledHint(label)`。

---

## 6. 模块清单与批次

模块清单、承载物品、呈现通道、批次、依赖、验收项 **全部在
[`mapping.yaml`](../../docs/BuildPlaning/mapping.yaml)**（19 个条目 / 18 个编号模块）。
批次一览见 [`04`](../../docs/BuildPlaning/04-模块增量开发与配置编排.md) §5.1。

**不要在本 README 里复制那份表** —— 会产生两份真源。
