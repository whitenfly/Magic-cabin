# src/content — 内容源（作者手写）

> ★ **这是作者唯一需要手写的目录。**
> 一篇文章 = 一个 `.md` 文件 = 书架上的**一本书**。新增文章**不需要改任何代码**。
>
> **当前状态**：🟢 **`J1.5` 已落地** —— 集合骨架与 schema 在 [`src/content.config.ts`](../content.config.ts)，
> 已有样例文章 `posts/hello-cabin.md` 与 `pages/about.md`。
> **`J5` 会在此基础上补**：remark/rehype 插件、Shiki 高亮、`posts.json` 契约、容量与死链校验（`validate-content`）。

---

## 1. 位置说明（决策 3 已拍板：采用 Astro）

本目录取 **`src/content/`** 而不是仓库根 `content/`，理由是决策 3 采用 Astro 后，
Astro 的**内容集合约定**就是 `src/content/` + `src/content.config.ts` —— 少一套约定，
并能直接使用 `getCollection()` 与 Zod schema。

> ✅ **OD-1 已拍板（2026-09-13）：采用 Astro**，本目录位置确定，不会再迁移。
> （`J1.5` 之前的"若回退 Vite MPA 则整体迁到仓库根 `content/`"已作废。）

---

## 2. 计划结构

```
src/content/
├─ posts/               一篇文章 = 一个 .md = 一本书
│  └─ hello-cabin.md    ✅ 样例（J1.5）
└─ pages/               自定义页（非文章集合）
   └─ about.md          → M06 魔法书本（/about/ 的正文来源）
```

> **schema 的位置**：Astro 5 起集合定义写在 `src/` 根的 [`src/content.config.ts`](../content.config.ts)，
> **不是** `src/content/config.ts`。本仓库只保留那一处。
>
> ⚠️ **加载器不是 `astro/loaders` 的 `glob()`，而是 [`src/blog/loaders.js`](../blog/loaders.js) 的 `markdownDir()`。**
> 原因：`glob()` 在本项目的依赖拓扑下会让 `astro sync` 报 `require is not defined`（上游外部化问题，
> 已用最小空白工程复现）。完整成因链与替代方案的等价性说明写在 `loaders.js` 的文件头，
> 门禁 `pnpm verify:j15` 会守住这一点。**对作者完全透明：写法不变，还是"放一个 `.md`"。**

---

## 3. front-matter 规范

```yaml
---
title: 魔法阵的推导                    # 必填，书脊与阅读器标题
slug: magic-circle-derivation          # 必填，唯一；缺省由文件名生成
date: 2026-02-14                       # 必填，ISO 日期
updated: 2026-03-02                    # 选填
tags: [three.js, shader, 数学]         # 选填，映射到 M04 试剂架的 7 个药水瓶
summary: 把 24 层魔法阵拆成可以复用的几何函数……   # 选填，缺省取首段
cover: /img/magic-circle.png           # 选填，用于列表页 / OG image
shelf: main                            # 选填，书架分组
pinned: false                          # 选填，置顶（书架最左、最显眼位置）
hidden: false                          # 选填，隐藏（仅宝箱彩蛋可见）
draft: false                           # 选填，true 则构建时跳过
series: shader-notes                   # 选填，系列
seriesOrder: 3                         # 选填，系列内顺序
book:                                  # 选填，书脊外观覆盖（缺省由算法推导）
  spineColor: "#8a4fd6"
  spineAccent: "#ffd76e"
---
```

### 3.1 构建期校验（`J5` 的 `validate-content`，**违反即构建失败**）

| 规则 | 后果 |
|---|---|
| `title` / `date` 必填 | 构建失败 |
| `slug` 全站唯一且符合 `[a-z0-9-]+` | 构建失败 |
| `book.spineColor` 为合法十六进制 | 构建失败 |
| **书架容量溢出**（所有书厚度之和 > 可用总宽） | **构建失败**，提示"启用策展视图或溢出到书堆"（硬约束 `H2` / 验收 `BB11`） |
| `tags` 在标签白名单内 | 警告（或自动新增并警告） |
| 书脊文字宽度适配书脊高度 | 警告（会自动缩小字号） |
| 正文中的站内链接指向存在的 slug | 警告（防死链） |

> 「容量溢出在构建期报错」很重要：否则运行时会出现"文章静默消失"这种最难排查的问题。
> 默认策略见 [`src/config/shelf.config.js`](../config/shelf.config.js) 的 `curatedView` / `overflow`。

---

## 4. 写一篇新文章（作者视角，3 步）

```bash
# 1. 新建（脚手架命令，由 M05 创作管线提供入口）
pnpm new "魔法阵的推导"        # 生成 src/content/posts/<slug>.md 并填好 front-matter 模板

# 2. 写 Markdown（本地 dev 环境实时看到它出现在书架上）
pnpm dev

# 3. 发布
git add src/content/posts/magic-circle-derivation.md
git commit -m "post: 魔法阵的推导"
git push                       # CI：校验 → 构建 → 部署
```

**新增文章 = 新增一个 Markdown 文件**：书架自动多出一本书，书脊的颜色/厚度/高度由
[`src/config/shelf.config.js`](../config/shelf.config.js) 的公式推导，
阅读器、目录、RSS、sitemap、标签页全部自动更新（验收 `BB4`）。

---

## 5. 与内容无关的"内容"

| 类型 | 放哪 | 说明 |
|---|---|---|
| 自定义页（关于） | `src/content/pages/about.md` | → M06 魔法书本 |
| 相册元数据 | 待定（`src/data-local/` 或 `public/`） | M10；图片本身进 `public/img/` |
| 书签 / 友链 / 歌单 | 待定（本地 JSON） | M15 / M08 / M11；**构建期静态化，不做运行时外链** |
| 第三方聚合（ACG 收藏 / 热点） | **构建期抓取** | M12 / M14；失败时构建告警，运行时表现为"那个环不亮"（风险 `R10`） |
