# cabin/app

> **填充阶段**：`J2`（小屋核心设施）✅ 已完成；**`J3`（物件模块化）** 新增了
> `mounts.js`、`defineProp.js`、`installProp.js` 三个文件 —— 它们是「一件物件 = 一个文件」的落点。
> 见 [`docs/BuildPlaning/01-完善路线图.md`](../../../docs/BuildPlaning/01-完善路线图.md) §3。

小屋应用内核

| 计划文件 | 职责 | 来源 | 填充阶段 |
|---|---|---|---|
| `App.js` | 生命周期 setup/start/stop/dispose、子系统编排 | — | J2 |
| `Feature.js` | Feature 契约（id / requires / order / settings / setup / start / dispose） | — | J2 |
| `Clock.js` | 三级时间源：wall / game / anim（可定格，供视觉回归） | 原 `animate(t)` 的时间计算 | J2 |
| `EventBus.js` | 类型化事件总线，解耦模块 | — | J2 |
| `UpdateScheduler.js` | 更新调度：tier（always/near/idle）+ LOD + 视锥裁剪 | 原 `animate()` 内联调用 | J2 |
| `Registry.js` | 注册中心（prop / interactable / light / feature） | 原 `regMagic` 的收集逻辑 | J2 |
| `rng.js` | 种子随机（构建期永久确定 / 运行期测试时确定） | 286 处 `Math.random()` | ✅ F0.2 |
| `clock.js` | 可步进时钟（`?deterministic=1&frames=120` 定格到第 N 帧） | — | ✅ F0.3 |
| `store.js` | 全局状态 + `settingsSchema` + 持久化 | 小屋现状零持久化 | J2 |
| **`mounts.js`** ★ | **挂载点 ID 表**：`id → { prop, anchor, radius, parts() }` | 散落各处的物件坐标与命中体 | ✅ **J3** |
| **`defineProp.js`** ★ | **物件契约**：`id` / `build` / `state` / `update` / `interactables` / `lights` / `mount` / `parts` | 搬迁前"加一件家具要动五个地方" | ✅ **J3** |
| **`installProp.js`** ★ | **物件装配器**：把一份 `defineProp` 声明翻译成 物件 / 挂载点 / 交互 / 光源 / 更新 五项登记 | 各物件自己往四个数组里塞 | ✅ **J3** |

## 依赖方向

`app/` 不依赖 `world/` `systems/` 的任何具体实现。

## ★ `mounts.js` 为什么必须存在

它是「**物品 ↔ 功能模块**」两侧能**互不 import** 的唯一原因：

```
world/floor1/bookshelf.js   defineProp({ mount: 'shelf/main', … })
        │ 注册
        ▼
app/mounts.js  ──── ctx.mounts.get('shelf/main') ────►  features/01-posts/scene.js
        ▲                                                        │
        └──── onActivate: ctx.commands.run('shelf:open') ◄────────┘ （命令实现注册）
```

| 不变量 | 内容 |
|---|---|
| `N2` | `cabin/world/**` **不得** import `blog/**` 或 `features/**`；物品只发命令名 |
| `N3` | `features/**` **不得** import `cabin/world/**` 的具体实现；只能通过本表的挂载点 ID 拿对象 |
| `N9` | 坐标只能来自 `cabin/world/layout.js`；挂载点的 `anchor` 与几何**同源** |

违反任一条，模块就无法独立关闭（验收 `BB3` / `CF1` 会失败）。
详见 [`docs/BuildPlaning/02-架构与目录调整.md`](../../../docs/BuildPlaning/02-架构与目录调整.md) §5。

---

## ★ 一件物件 = 一个文件（`J3`）

`J2` 造好注册机制后，`J3` 用三个文件把它接到物件上：

```
world/floor1/bookshelf.js
  export default defineProp({ id, mount, build, state, interactables, lights, update, parts })
        │   import 的是**契约**（defineProp.js），不是内核
        ▼
legacy/monolith.js  installProp(bookshelf)      ← 在**原位置**同步调用
        │
        ├─ build(ctx)           建几何（内部自己 scene.add，与原实现逐字节等价）
        ├─ registry.registerProp(root, { id, kind, mount })
        ├─ mounts.claim(mount, { prop, anchor, radius, parts })
        ├─ registry.registerInteractable(...)   ← 取代 64 处 `regMagic`
        ├─ registry.registerLight(...)          ← 取代末尾硬编码的 `PP[i]`
        └─ scheduler.add(id, update, { tier })  ← 取代 `animate()` 里的内联分支
```

**为什么 `installProp` 在 `app/` 而不是让物件自己登记**：`J2` 的 DoD 是「新增一盏灯 / 一个交互的
**改动文件数 = 1**」。物件只声明"我有什么"，"怎么登记"由内核代劳。

⚠️ **装配顺序是行为的一部分**（三条不可破的规矩，见 `installProp.js` 文件头）：
`build` 必须在 monolith 的**原位置**调用（`rng` 是种子随机源，调用顺序决定后面所有随机数）、
装配只写元数据不碰对象父子关系、`lights` 的声明顺序 = 原来 `PP[i]` 的槽位顺序。
