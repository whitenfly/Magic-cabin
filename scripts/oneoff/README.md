# oneoff —— 一次性脚本（F1 搬迁 + J0.4 机位，已执行完毕，保留以便重现）

这些脚本**各执行过一次**，记录在此是为了让过程**可重现、可审计**。
日常开发**不需要**运行它们。

| 脚本 | 作用 | 产物 |
|---|---|---|
| `_probe.mjs` | 用 Node（UTF-8）精确探明源文件各处边界行号 | 控制台输出 |
| `_diag.mjs` | 定位搬迁差异的精确字符位置（用于确认「仅末尾多 1 个换行」） | 控制台输出 |
| `_migrate.mjs` | 切分源文件：CSS / 主脚本 / UI DOM | `src/styles/cabin.css`、`src/cabin/legacy/monolith.js` |
| `_gen-html.mjs` | 生成 UI DOM 模块与新 `index.html` | `src/cabin/dom.js`、`index.html` |
| `_assemble.mjs` | （已并入 `_gen-html.mjs`） | — |
| `_scaffold.mjs` | 批量创建占位目录与 README | `src/cabin/*`、`src/data/`、`src/domains/*`、`src/config/` ⚠️ 见下方注意 |
| `_extract.mjs` | 从源文件提取注释分区，生成搬迁索引 | `docs/_partition-map.md` |
| `_doc.mjs` | 组装 `docs/MIGRATION.md`（并入分区索引） | `docs/MIGRATION.md` |
| `_probe-kill.mjs` | 探测受限环境下能否用 `process.kill` 终止进程（结论：可以；`taskkill` 被拒绝） | 控制台输出 |
| `_f02-*.mjs` / `_f03-*.mjs` | F0.2 种子随机 / F0.3 可步进时钟的替换与诊断脚本 | `.cache/` 快照 + 逐行清单 |
| **`_j04-explore.mjs`** | **J0.4 挑机位**：用一张候选表（`capturePoses` 的 `poseTable` 通道）批量抓图，人工/视觉审查后再写进正式机位表 | `_shots/explore/*.png` |
| **`_j06-freeze.mjs`** | **J0.6 冻结快照**：撤销 J0.6 的改动得到 `after-j04` 快照，并**自检**"再撤销 J0.4 能否回到 `after-f03`"；自检不过则拒绝写入 | `.cache/monolith.after-j04.js` |

## 注意

- 这些脚本**读取** `line-art-style-magic-cabin-main/index.html`（只读），**写入**本工程。
- 重跑 `_migrate.mjs` 会**覆盖** `src/cabin/legacy/monolith.js` —— 若 J3 已开始搬迁，
  重跑会丢失已迁出的改动。仅在没有搬迁进度时才可重跑。
- ⚠️ **`_scaffold.mjs` 不要重跑**：它创建的两个目录 `src/data/` 与 `src/domains/` 来自
  已失效的 `ArtLine-Part/07`/`08`，**已于 2026-09-13 按规划删除**，
  由 `src/features/`（一模块一目录）取代。见
  [`docs/BuildPlaning/02-架构与目录调整.md`](../../docs/BuildPlaning/02-架构与目录调整.md) §3 的 M-1 / M-2。
- `_j04-explore.mjs` 的候选机位与正式机位**是两回事**：正式机位的唯一真源是
  [`tests/visual/poses.js`](../../tests/visual/poses.js)（它与基线同住，是判据的一部分）；
  脚本里的候选表只用于"挑"，不要反过来把候选表当成机位定义。
- ⚠️ **改 `legacy/monolith.js` 之前先冻结快照**（`cp src/cabin/legacy/monolith.js .cache/monolith.after-<阶段>.js`）。
  `verify-f02/f03/f04/f06` 的判据都是"撤销本次改动后与上一份快照逐字节一致"，
  少一份快照就少一环证据。`_j06-freeze.mjs` 是**事后补**的做法（靠撤销规则可验证才成立），不要当成常规流程。

## 日常使用的脚本（在上级 `scripts/`）

| 脚本 | 作用 |
|---|---|
| `scripts/serve.mjs` | 零依赖静态服务器（零构建路径）；写 PID 文件、端口自动顺延、优雅退出 |
| `scripts/ctl.mjs` | 服务管理：`status` 查看状态 / `stop` 停止（轮询确认进程退出） |
| `scripts/verify-migration.mjs` | 搬迁一致性静态校验（19 项） |
| `scripts/verify-runtime.mjs` | 运行时 DOM 校验（11 项，需先导出 headless DOM） |
