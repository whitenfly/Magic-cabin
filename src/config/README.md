# src/config — 用户配置层

> ★ **这是"用户唯一需要看的目录"。**
> 想把小屋改成自己的样子，**只需要改这里**，不需要读 `cabin/`、`blog/`、`features/` 里的任何代码。
>
> 编排方法照搬 Firefly 的九条（见 [`docs/BuildPlaning/04-模块增量开发与配置编排.md`](../../docs/BuildPlaning/04-模块增量开发与配置编排.md) §3.1）：
> **一模块一文件 · 类型分离 · 索引汇总 · README 是第一站 · 分区注释 · 环境变量覆盖 · 模块总开关 · 配置影响构建体积 · 面板只做运行时覆盖。**

---

## ⚠️ 当前状态（2026-09-13）

**本目录已按目标架构写就，但消费方尚未实现。**

| 消费方 | 职责 | 落在哪个阶段 |
|---|---|---|
| `cabin/app/store.js` + `settings.js` | 读默认值、双向绑定、写 `localStorage` | **J2** |
| `cabin/systems/ui/SettingsForm.js` | 由 schema **自动生成**设置面板控件 | **J2.5** |
| `blog/registry.js` | 按 `modulesConfig` 过滤后装配功能模块 | **J2.5 / J6** |
| `blog/ShelfLayout.js`、`blog/reader/*` | 读 `shelfConfig` / `readerConfig` | **J6** |
| 站点页（Astro） | 读 `siteConfig` / `homeConfig` | **J1.5 / J5** |

**在 `J2` / `J2.5` 落地之前，改这里的值不会有效果** —— 现状代码里仍是 `cabin/legacy/monolith.js` 中的硬编码常量。
（这是有意的：先把"用户唯一目录"的形状定下来，再让实现逐段接过来，避免 18 个模块各自发明配置方式。）

---

## 1. 文件清单

| 文件 | 管什么 | 对应模块 |
|---|---|---|
| `index.js` | **统一导出**（组件可一次导入多个配置） | — |
| `types.js` | 每个配置的**形状声明**（JSDoc typedef，纯类型、无默认值） | — |
| `resolve.js` | **环境变量覆盖**工具（`resolve*()`）+ 模块开关校验 | — |
| `site.config.js` | 站点标题 / 副标题 / URL / 作者 / 导航 / 社交链接 / 页脚 / **开站日期** | 全站 + M06 / M07 / M13 |
| `cabin.config.js` | 3D：默认视角 / 相机距离 / 画质档 / 天气与时间 / **门厅策略** / 持久化前缀 | 全站 3D |
| `modules.config.js` | ★★ **模块总开关表**（一行关掉一个功能模块） | 全部 18 个模块 |
| `shelf.config.js` | 书架：层板规格 / 容量 / 策展视图 / 排序分组 / 书脊尺寸公式 / 图集 | **M01** |
| `reader.config.js` | 阅读器：书页规格 / **平面视角** / 长文阈值与兜底 / 移动端 / **CSS3D 层次约定** | **M01** |
| `home.config.js` | 门厅（首屏 HTML 先行、3D 空闲挂载、文案） | 首页 |
| `<模块>.config.js` | 每个功能模块自己的可调项 | 每上线一个加一个 |

---

## 2. 依赖规则（不变量 N11）

| 允许 | 禁止 |
|---|---|
| `config/` → `resolve.js`、`types.js` 等纯工具 | ★ **`config/` → `cabin/**`、`blog/**`、`features/**`** |

**配置是叶子**：实现（模块）**读**配置，配置**不读**实现。
违反了会出现"改一个配置要先加载整个 3D 场景"这种循环依赖。

---

## 3. 三种日常改法

### 3.1 改一个值（最常见）

```js
// src/config/site.config.js
title: '魔女的魔法小木屋',        // ← 直接改
```

每个字段上方都有一行中文注释说明"**改了会怎样**"。改完刷新即可。

### 3.2 关掉一个功能模块（一行）

```js
// src/config/modules.config.js
M14: false, // 热点榜单 → 旋转星铃（依赖内网服务）
```

置 `false` 后三件事同时发生：
① 场景侧物品恢复**纯装饰**（点击给「这件东西还没启用」浮签，不报错）；
② 站点侧它的页面/面板**不生成**；
③ 加载侧它的 `src/features/<id>/**` **不被下载**。

### 3.3 加一个模块的配置

每上线一个功能模块（走 [`04`](../../docs/BuildPlaning/04-模块增量开发与配置编排.md) §2 九步 SOP 的 **S2**）：

1. 新建 `src/config/<短名>.config.js`
2. 在 `index.js` 加一行 re-export
3. 在 `types.js` 加 `@typedef`
4. 在 `modules.config.js` 的开关表里把该模块置 `true`
5. 在**本 README 的上表**加一行

> ⚠️ 门禁（验收 `CF3`）：**每个已上线模块必须恰好有一个配置文件**，缺一个即构建失败 ——
> 防止"删了配置还以为是默认值"。

---

## 4. 环境变量覆盖

**文件是默认值来源，环境变量优先级更高**；未设置或取值无法识别时用文件里的值。
所以在 Vercel / Cloudflare Pages 上部署时，**不需要改任何文件**。

| 环境变量 | 作用 | 取值 |
|---|---|---|
| `PUBLIC_MODULES` | ★ **模块白名单**。列出即启用，未列出一律关闭 | `M01,M02,M03a,M04` |
| `PUBLIC_SITE_TITLE` | 站点标题 | 任意字符串 |
| `PUBLIC_SITE_URL` | 站点规范 URL（末尾带 `/`） | `https://…/` |
| `PUBLIC_VIEW_MODE` | 默认视角 | `fixed` / `tp` / `fp` |
| `PUBLIC_QUALITY` | 画质档 | `low` / `medium` / `high` |
| `PUBLIC_FOYER` | 是否启用门厅 | `true` / `false` / `1` / `0` / `on` / `off` |
| `PUBLIC_SUSPEND_WHILE_READING` | 阅读时挂起渲染循环 | 同上 |
| `PUBLIC_CAMERA_DISTANCE` | 固定视角相机距离 | 数值 |
| `PUBLIC_SHELF_ZOOM` | 书架浏览时的相机缩放 | 数值 |
| `PUBLIC_READER_FLAT_DISTANCE` | 平面视角相机距离 | 数值 |
| `PUBLIC_FOYER_DELAY` | 3D 空闲挂载延迟（ms） | 数值 |

> 只有 `PUBLIC_` 前缀的变量会注入客户端（Vite / Astro 的约定）。

---

## 5. 分区注释约定

每个配置文件内部用**分区标题**分隔，字段上方各有一行中文注释：

```js
export const xxxConfig = {
  // ── 分区名 ──────────────────────────────────

  // 这个字段控制什么；改了会怎样；取值范围
  field: value,
}
```

**新增字段时必须写注释，且必须说清"改了会怎样"** —— 这是"用户友好"的唯一实际含义。

---

## 6. 相关文档

| 文档 | 关系 |
|---|---|
| [`docs/BuildPlaning/04`](../../docs/BuildPlaning/04-模块增量开发与配置编排.md) §3 | 编排方法的完整说明（Firefly 九条 → 小屋映射）与验收 `CF1`–`CF4` |
| [`docs/BuildPlaning/02`](../../docs/BuildPlaning/02-架构与目录调整.md) §5 | 架构不变量（`N11` 就是本目录的依赖规则） |
| [`docs/BuildPlaning/mapping.yaml`](../../docs/BuildPlaning/mapping.yaml) | 每个模块用哪些配置键（`configKeys` 字段） |
