# oneoff —— 一次性脚本

这些脚本**各执行过一次**，记录在此是为了让过程**可重现、可审计**。
日常开发**不需要**运行它们。

---

## `archive/` —— 已退役（`J4.16` 归档，2026-09-16）

`src/cabin/legacy/monolith.js` 已于 **`J4.7` 删除**。
**所有读写它的脚本随之失效** —— 已移入 [`archive/`](./archive/)，作为历史档案保留。

> **判据是确定性的，不是凭印象**：
> 脚本在**运行时**引用 `src/cabin/legacy/monolith.js` ⇒ 该文件不存在 ⇒ 必然失效
> （多数还在文件头自带"整体退役"分支，跑一下就打印一行提示然后退出）。
>
> 归档时**不修内部路径** —— 它们已经没有对象可操作了，修了也只是让档案失真。

| 归档的脚本 | 原属阶段 |
|---|---|
| `_diag.mjs` · `_migrate.mjs` | F1 源文件切分与差异定位 |
| `_f02-analyze/apply/marks/diagnose-wrap/report.mjs` + `.template.md` | F0.2 种子随机 |
| `_f03-apply.mjs` · `_f03-diagnose.mjs` | F0.3 可步进时钟 |
| `_j06-freeze.mjs` | J0.6 渲染统计钩子 |
| `_j22-extract.mjs` · `_j22-rewrite.mjs` · `_j29-rewrite.mjs` | J2.2 材质逐字节提取 / J2.9 坐标常量 |
| `_j3-apply.mjs` · `_j3-check-refs.mjs` · `_j3-verify-b3-props/b4-scene/b5/dining-table/mirror.mjs` | J3 物件搬迁（35 件的应用器与逐批验证） |
| `_j4-analyze.mjs` · `_j4-apply.mjs` · `_j4-frame.mjs` · `_j4-tick-analyze.mjs` | J4 段切片（21 段的应用器与两个分析器） |
| `_j3-b4-mirror-report.md` · `_j3-b6-report.md` | J3 阶段报告（含阻塞地图） |

---

## ★ 仍在使用 —— **不要**归档

| 脚本 | 作用 | 谁在用 |
|---|---|---|
| **`_j4-segments.mjs`** | **段表** —— `installCabin.js` 的 21 次调用顺序由它守 | `tests/unit/segments.test.mjs` **会 import 它** |
| **`_j4-dev-sync.mjs`** | **五处状态副本同步**（专防判例 P4 复发） | **阶段发布收尾必须跑**（`--check` 自检 / `<N>` 同步） |
| `_j3-diag.mjs` | 页面诊断（约 20 秒）—— **每切开一个函数边界都要跑** | `J4` 搬迁期的固定动作（`tsc`/`build` 查不出的自由变量它查得出） |
| `probe-page.mjs` · `probe-dev-3d.mjs` · `probe-picomatch.mjs` · `probe-cdp.mjs` · `probe-j25-errors.mjs` · `probe-single-file.mjs` | 各类运行期 / 构建期诊断 | 排障（`astro.config.mjs` 与 `verify-j15.mjs` 的注释指向它们） |
| `_j3-specs/`（**目录**） | **未升格物件的施工图**：35 份 `.json`（已搬）+ 16 份 `.SKIP.md`（未搬，含阻塞点与前置条件） | ★ **任务 D（35 件升格 `defineProp`）的唯一权威清单** —— 见 `docs/实施结果/J4.15-实施结果.md` |

---

## 暂留 —— 未确认是否退役

`_probe.mjs` · `_probe-kill.mjs` · `_rng-digest-test.mjs` · `_scaffold.mjs` · `_v8-msg.mjs` ·
`_assemble.mjs` · `_doc.mjs` · `_extract.mjs` · `_gen-html.mjs` · `_j04-explore.mjs` · `_j3-verify-b2.mjs`

它们**不读** `monolith.js`，因此不会立刻失效；但也**没有活跃引用**。
按「**质量高于数量**」（`J3` 跳过 32 件的同一条纪律）**暂不归档** —— 归档要基于确定性判据，
而不是"看起来像是一次性的"。

---

## 注意

- ⚠️ **`_scaffold.mjs` 不要重跑**：它创建的两个目录 `src/data/` 与 `src/domains/` 来自
  已失效的 `ArtLine-Part/07`/`08`，**已于 2026-09-13 按规划删除**，
  由 `src/features/`（一模块一目录）取代。见
  [`docs/BuildPlaning/02-架构与目录调整.md`](../../docs/BuildPlaning/02-架构与目录调整.md) §3 的 M-1 / M-2。
- `_j04-explore.mjs` 的候选机位与正式机位**是两回事**：正式机位的唯一真源是
  [`tests/visual/poses.js`](../../tests/visual/poses.js)（它与基线同住，是判据的一部分）；
  脚本里的候选表只用于"挑"，不要反过来把候选表当成机位定义。
- **`archive/` 里的脚本不要再跑**：它们的操作对象（`legacy/monolith.js`、源 `index.html`）已不存在。
  留着是为了"当时到底改了什么"可查，不是为了重放。

## 日常使用的脚本（在上级 `scripts/`）

| 脚本 | 作用 |
|---|---|
| `scripts/release.mjs` | ★ 版本管理唯一入口（`start` / `verify` / `done` / `ship` / `status` / `exec`） |
| `scripts/serve.mjs` | 零依赖静态服务器；写 PID 文件、端口自动顺延、优雅退出 |
| `scripts/ctl.mjs` | 服务管理：`status` / `stop` |
| `scripts/_verify.mjs` | 静态门禁七件套（`typecheck` 之外的 57 项断言） |
| `scripts/verify-j15.mjs` | 工程化骨架 + `src/cabin/**` 逐字节摘要（`--record` 重录基线） |
| `scripts/verify-migration.mjs` | 搬迁一致性静态校验 |
