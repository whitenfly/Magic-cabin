# src/blog — 博客内核

> **定位**：所有功能模块**共享**的内容能力。它不属于任何单个模块 ——
> 书架算法、书脊绘制、阅读器、路由、命令总线都在这里，模块通过命令名与它对接。
>
> **当前状态**：🟡 **部分落地**。
> 已实现 **`registry.js`**（`J2.5`，按 `modulesConfig` 过滤装配功能模块）；
> 其余（`ContentLoader` / `ShelfLayout` / `BookSpine` / `reader/**` / `Router` / `commands.js`）
> 由 **`J5`（内容管线与静态页）** 与 **`J6`（书架即博客 + 方案 B 阅读器）** 填充。
> 见 [`docs/BuildPlaning/01-完善路线图.md`](../../docs/BuildPlaning/01-完善路线图.md) §3。

---

## 1. 计划文件

```
src/blog/
├─ generated/            构建产物（gitignore）
│  ├─ posts.json         轻量元数据 + 摘要（供 3D 与书架消费）
│  └─ bodies/*.html      每篇正文的 HTML 片段（供阅读器按需加载）
│
├─ ContentLoader.js      内容读取与查询（内存缓存，零网络请求）
├─ ShelfLayout.js        ★ 纯函数：排序 / 分组 / 尺寸推导 / 溢出（可单测）
├─ BookSpine.js          书脊图集绘制（1 张 2048² 承载 32 本，每本只改 UV）
│
├─ reader/               ★ 方案 B：CSS3DRenderer 真 DOM 书页
│  ├─ Css3dReader.js     层次模型 + 正反面 + 装填时序 + 平面视角
│  ├─ Paginator.js       DOM 分页（列数 / 页数 / 跨页）
│  ├─ LongPostFallback.js 长文兜底（决策点 OD-3）
│  ├─ bookGeometry.js    平放的魔法书几何（移植自原型 shared/magic-book.js）
│  └─ reader.css         书页视觉（羊皮纸 #faf4e4 / 烫金 #b8912a / 衬线）
│
├─ Router.js             pushState / popstate / 深链接（与静态页共用同一规范 URL）
├─ commands.js           ★ 命令总线：模块 ↔ 物品的唯一接口
└─ registry.js           ✅ 按 modulesConfig 装配 src/features/**（`J2.5` 已落地）
```

### `registry.js`（已落地）的三条边界

| 项 | 做法 | 为什么 |
|---|---|---|
| 清单从哪来 | 由 `cabin/boot.js` **注入**（`features/_index.js`），本文件不 import `features/**` | `blog/**` 不得依赖任何一个模块（§2 的依赖规则）；副作用是它成了纯编排逻辑，可直接单测 |
| 未启用的模块 | **连 `load()` 都不调用** | thunk 清单的意义就在这里 —— 关闭的模块其 chunk 不会被浏览器请求（验收 `CF1`） |
| 清单里的 id 在开关表里缺项 | **抛错** | `04` §3.2 规则 4「可缺省即失败」；静默按关闭处理会让一个拼错的 id 表现为"模块神秘消失"（防 `R30`） |

另有 `notEnabledHint(label)`：未启用模块的交互被触发时给用户的一句话（验收 `BB3`）——
物品侧接上它需要 `J3` 的挂载点 ID 表。

---

## 2. 依赖规则

```
cabin/world/**  ──ctx.commands.run('name')──►  commands.js
                                                    ▲
                                                    │ 注册实现
src/features/**  ──ctx.mounts.get(id)──►  cabin/app/mounts.js
       │
       └──►  blog/**（ContentLoader / ShelfLayout / reader）
```

| 规则 | 内容 |
|---|---|
| 允许 | `features/**` → `blog/**`；`blog/**` → `cabin/{app,core,systems}` 的契约（**不含** `world` 的具体物件） |
| 禁止 | `blog/**` → `features/**`（内核不能依赖某个模块） |
| 禁止 | `cabin/world/**` → `blog/**`（物品只发命令名） |

---

## 3. 三个契约（两侧唯一的交互面）

| 契约 | 形态 | 方向 |
|---|---|---|
| **`posts.json`** | 构建产物（元数据 + 摘要，100 篇 ≈ 60–120 KB，gzip ≈ 20 KB） | 构建期写入 → 3D 只读 |
| **正文片段** | `generated/bodies/<slug>.html`；静态页与阅读器**共用同一份渲染结果** | 构建期写入 → 通道 B/D 消费 |
| **命令总线** | `ctx.commands.run(name, args)`；命名沿用 `Blog-Part/03` §5.1 的表，**不另起一套** | 3D ↔ 模块（只经名字） |

---

## 4. 关键约束（实现时不要忘）

| 约束 | 出处 |
|---|---|
| **`posts.json` 不含正文**（加密内容不进产物，硬约束 `H7`） | `improve/07` §7 |
| **跨边界数据过 Zod**（`content/` → `posts.json` 的校验） | 硬约束 `H8` |
| 书脊**必须用图集**，`CanvasTexture` 数量 ≤ 基线 + 2 | 验收 `BB14` |
| CSS3D 的三条硬约定（层次双保险 / 不用 `backface-visibility` / 动画中不碰 DOM） | `03` §3.1–3.3，验收 `CH1`–`CH3` |
| 平面视角的姿态**不能用 `lookAt`**（视线与 `up` 平行 → 叉积退化，矩阵坏掉且不报错） | `03` §3.4 |
| 贴图重绘（书脊图集 / 年历 / 通道 A 的卡面）挂 `decorLoop`，**不要挂主 `loop()`** | 风险 `R13` |
| 阅读进度归**博客侧**所有，3D 只读（单写者，不双写） | `Blog-Part/03` §6.1 / `R2` |

---

## 5. 相关文档

| 文档 | 内容 |
|---|---|
| [`docs/BuildPlaning/01`](../../docs/BuildPlaning/01-完善路线图.md) §3 | `J5` / `J6` 的任务分解与 DoD |
| [`docs/BuildPlaning/03`](../../docs/BuildPlaning/03-渲染通道与构建选型.md) | 四通道模型、方案 B 的四条硬约定、Astro 职责边界 |
| [`docs/ArtLine-Part/03-博客书架集成方案.md`](../../../docs/ArtLine-Part/03-博客书架集成方案.md) | 内容管线、front-matter 规范、书架算法、路由与 SEO 的原始设计（**§5.4 的"可选增强"已被本路线上调为主方案**） |
