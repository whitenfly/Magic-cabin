# cabin/world

> **占位目录** —— 尚未实现。本文档说明它将来放什么、依赖谁、由哪个阶段填充。
> 填充阶段：**`J3`（物件模块化，B1–B6 六批）**。见 [`docs/BuildPlaning/01-完善路线图.md`](../../../docs/BuildPlaning/01-完善路线图.md) §3。

小屋场景内容

| 子目录 | 内容 | 来源（monolith.js 内的注释分区） |
|---|---|---|
| `world/layout.js` | **全部坐标常量集中于此** | 散落全文的魔法数字 |
| `world/house/` | 墙体 / 屋顶 / 地板 / 旋转楼梯 / 门窗 / 二楼吊灯 | 原 1062–1288、6894–6961 |
| `world/outdoor/` | 森林 / 草地 / 石头 / 花 / 蘑菇 / 萤火虫 / **路牌（M15）** | 原 1290–1516 |
| `world/floor1/` | 一楼陈设（原 12.x 分区，约 28 件；含**书架 M01**、**水晶球 M03a**、**试剂架 M04**） | 原 1570–3315 |
| `world/floor2/` | 二楼陈设（原 18.x 分区，约 26 件；含**台历 M02**、**扑克牌 M03b**、**魔法书本 M06**、**魔女帽 M07**、**挂钟 M13**） | 原 3316–6893 |

> **跨场景复用道具**（茶杯 / 茶壶 / 书 / 沙漏 / 纸品…）放在 [`cabin/props/`](../props/README.md)，
> 本目录只负责**摆放**（位置、朝向、状态、交互），不负责"长什么样"。

## 搬迁方式（`J3`）

每一件物件迁出为一个 `defineProp` 模块（契约见 [`docs/ArtLine-Part/02`](../../../../docs/ArtLine-Part/02-目标架构.md) §3.2），
并从 `legacy/monolith.js` 删除对应区段。**一个物件一次提交**。

标准动作见 [`docs/MIGRATION.md`](../../../docs/MIGRATION.md) §7，分区 ↔ 文件的完整映射表见同文 §3。

## ★ 本目录最重要的一条规矩：物品不认识模块

物件**不得** import `blog/**` 或 `features/**`（不变量 `N2`）。它只做两件事：

```js
export default defineProp({
  id: 'floor1/bookshelf',

  // ① 声明挂载点 ID —— 由 features/* 认领（不变量 N3）
  mount: 'shelf/main',

  // ② 交互只发命令名 —— 命令实现由模块注册（不变量 N2）
  interactables: (s) => [{
    id: 'shelf/browse',
    label: '浏览书架',
    mode: 'both',                       // ★ aim + proximity 都要（BB2b / 风险 R1）
    anchor: MOUNTS['shelf/main'].anchor, // ★ 坐标与几何同源（N9）
    radius: 1.8,
    onActivate: (ctx) => ctx.commands.run('shelf:open', { shelf: 'main' }),
  }],
})
```

| 不变量 | 内容 |
|---|---|
| `N2` | 本目录**不得** import `blog/**` / `features/**`；只发命令名 `ctx.commands.run()` |
| `N4` | 新增光源不得修改 shader，只能通过 `lights` 注册 |
| `N5` | 新增交互不得新增射线列表，只能通过 `interactables` 注册 |
| `N8` | 场景生成代码**禁止** `Math.random()`，一律用注入的 `rng`（否则截图回归失效） |
| `N9` | 所有坐标来自 `world/layout.js`，交互判定与几何构建共用同一常量 |

违反任一条，模块就无法独立关闭（验收 `BB3` / `CF1` 会失败）。
详见 [`docs/BuildPlaning/02-架构与目录调整.md`](../../../docs/BuildPlaning/02-架构与目录调整.md) §5。
