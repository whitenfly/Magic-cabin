# cabin/app

> **占位目录** —— 尚未实现。本文档说明它将来放什么、依赖谁、由哪个阶段填充。
> 填充阶段：**`J2`（小屋核心设施）**，`mounts.js` 属 **`J3`**。
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
| **`mounts.js`** ★ | **挂载点 ID 表**：`id → { prop, anchor, radius, parts() }` | 散落各处的物件坐标与命中体 | **J3** |

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
