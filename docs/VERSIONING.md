# 版本管理执行规范 · SPEC-1.3.0 ★ 强制执行

<!-- ⛔ 修改本文件前必须先读 §12。规范是执行判据，禁止"顺手改"。 -->

| 项 | 值 |
|---|---|
| 规范版本 | **SPEC-1.3.0**（修订历史见 §12.4） |
| 状态 | ★ **执行期冻结**（修订须走 §12 完整流程） |
| 生效日期 | 2026-09-15 |
| 适用对象 | 在本仓库执行开发的**模型**与**人工** |
| 效力 | 本文件是版本管理**唯一判据**；与任何口头约定冲突时以本文件为准 |
| 人类答疑 | [`VERSIONING-QA.md`](./VERSIONING-QA.md)（只解释"为什么"，**不含规则**） |
| 上游路线图 | [`BuildPlaning/01-完善路线图.md`](./BuildPlaning/01-完善路线图.md)（回答"做什么、按什么顺序"） |
| 工具实现 | `scripts/release.mjs`（**命令行为以脚本为准**） |

> ## 给模型的阅读约定（先读这 5 行）
>
> 1. 本文件是**执行规范**：只写「做什么 / 怎么做 / 怎么判定」，不写「为什么」——为什么去 Q&A。
> 2. 模态词严格定义：
>    - **必须**（MUST）＝ 不做即违规，可被 §1 的判定命令查出来；
>    - **禁止**（MUST NOT）＝ 做即触红线，按 §13 处置；
>    - **应当**（SHOULD）＝ 默认遵守，偏离必须在 `docs/实施结果/<编号>-实施结果.md` 写明理由；
>    - **可以**（MAY）＝ 可选。
> 3. 每条红线都带**判定命令**。收尾时跑命令自查，**不要靠记忆**。
> 4. §11 的命令表是 `scripts/release.mjs` 的镜像。两者不一致时：**以脚本为准**，并按 §12 报修订。
> 5. 本文件**不重复描述**同一条规则。看到一个规则出现在两处，说明有人违规改了规范——按 §12 处理。

---

## 0. 模型执行摘要

### 0.1 黄金路径（一个任务的全过程，6 条命令）

```bash
node scripts/release.mjs start J4.1 player-module   # ① 开分支（禁止在 dev 上写代码）
# …… 开发 → 跑门禁 → 写 docs/实施结果/J4.1-实施结果.md → 改 package.json version ……
node scripts/release.mjs verify J4.1                # ③ 静态门禁并留痕
git add -A && node scripts/release.mjs exec -- git commit -F .cache/commit-msg.txt
node scripts/release.mjs done J4.1 --base=0.4.0     # ⑥ 收尾：合并回 dev + 打 tag + 删分支
node scripts/release.mjs ship                       # ⑦ 生成推送命令（**绝不自动 push**）
node scripts/release.mjs status                     # ⑧ 复查（会把已执行的 [ ] 翻成 [x]）
```

> `pnpm task:start` 等价于 `node scripts/release.mjs start`。**`pnpm` 不可用时（如受限沙箱）直接用 `node scripts/release.mjs <子命令>`**，两者行为一致。

### 0.2 三条绝对禁令（违反即回退重做）

| # | 禁令 | 判定命令（必须为空输出） |
|---|---|---|
| **禁 1** | **禁止在 `dev` 或 `main` 上做开发提交** —— 已由**两层机械防护**强制（见 §9.3） | `git log --oneline --no-merges "$(git describe --tags --abbrev=0 dev)..dev"` |
| **禁 2** | **禁止在 `dev` 上打正式版 tag**（不带 `-dev.` 的） | 见 §1 R2 |
| **禁 3** | **禁止在任务分支之外执行 `task:done`** | 工具已强制（在 `dev`/`main` 上直接 `die`） |

### 0.3 收尾自检（每次收尾**必须**跑，三条都要过）

```bash
node scripts/release.mjs status                                   # ① 状态：分支 ahead=0、tag 全 ✓
git log --oneline --no-merges "$(git describe --tags --abbrev=0 dev)..dev"   # ② 应为空（禁 1）
node scripts/release.mjs history | Select-String "\[ \]"          # ③ 待执行命令是否已执行完
```

---

## 1. 红线清单（14 条，按组归类）

> 违规判定方式一律**客观可查**；查出来即按 §13 处置。**没有"这次情况特殊"的例外通道**——真需要例外，走 §12 改规范，而不是破例。

### A 组 · 分支与提交（禁止绕过分支）

| # | 红线 | 判定方式 |
|---|---|---|
| **R1** | **禁止在 `dev` / `main` 上做开发提交**（`feat` / `fix` / `chore` / `refactor` / `docs` / `test`）。所有改动**必须**在 `task/*` 分支上产生，并以 `--no-ff` 合并进入。★ **已由两层机械防护强制**（§9.3）：模型路径 `exec` 入口直接拒绝，人工路径 `pre-commit` 钩子拒绝 | `git log --oneline --no-merges "$(git describe --tags --abbrev=0 dev)..dev"` 输出为空；且违规尝试会留下 `kind: blocked` 记录 |
| **R2** | **禁止在 `dev` 上打正式版 tag**（不带 `-dev.` 后缀的那种） | `for t in $(git tag -l "v*" \| grep -vE -- "-dev\.[0-9]+$"); do git merge-base --is-ancestor "$t" main \|\| echo "违规：$t 不在 main 上"; done` 无输出 |
| **R3** | **禁止在任务分支之外提交**（`dev` 上只允许 merge commit 与 §5.2 的发布元数据提交） | `git status` 的当前分支必须是 `task/<编号>-<短名>` |
| **R4** | **禁止用 `squash` / `rebase` 合并代替 `--no-ff`** ——那会让任务失去可整体 `revert` 的边界 | `git log --merges --oneline -10` 中每个任务/阶段各有一个合并节点 |
| **R5** | **禁止强删未合并分支**（`git branch -D`）。工具一律用 `git branch -d`（小写，未合并会被 git 拒绝） | 分支删除只由 `task:done` 完成 |

### B 组 · 编号与版本号（禁止撞号与复用）

| # | 红线 | 判定方式 |
|---|---|---|
| **R6** | **禁止复用已分配过的编号**（任务取消也不归还号码） | `git log --oneline --grep="<编号>"` 必须为空才算该编号可用（§2.3 四条查重命令） |
| **R7** | **禁止阶段内任务使用序号 `5`**（`.5` 永久保留给插层子阶段） | 分支名匹配 `^task/J\d+\.5-` 即违规（`.5` 子阶段见 §2.2 的例外写法） |
| **R8** | **禁止重用 `-dev.N` 序号**（删掉 tag 也不归还 N；N 取同 base 下**历史最大值 +1**） | `git tag -l "v0.4.0-dev.*"` 序号严格递增、无空洞复用 |
| **R9** | **禁止让 `package.json` 的 `version` 与最近 tag 脱节** | `node -p "require('./package.json').version"` 必须等于当前阶段 base 去掉后缀后的最新 dev tag |

### C 组 · 记录与追溯（禁止污染历史）

| # | 红线 | 判定方式 |
|---|---|---|
| **R10** | **模型执行的变更类 git 命令必须走 `exec` 入口**（`node scripts/release.mjs exec -- git …`），只读查询可直接跑、且**不该**进记录 | `GitPushHistory.md` 里能看到本任务的每条变更命令与退出码 |
| **R11** | **禁止改写已推送的历史**（向 `main` / `dev` 的 `push --force`） | 远端分支必须是本地分支的祖先；回退一律用 `git revert` |
| **R12** | **`GitPushHistory.md` 只增不改**（唯一允许的原地改动是把已执行命令的 `[ ]` 翻成 `[x]`） | 记录尾部追加，历史条目不得被编辑或删除 |

### D 组 · 仓库边界（禁止结构性破坏）

| # | 红线 | 判定方式 |
|---|---|---|
| **R13** | **禁止在 `FrontProj/` 或 `Project/` 再 `git init`**（会把本仓库变成 gitlink） | `Magic-cabin/` 自身就是仓库根；父目录只有普通文件 |
| **R14** | **禁止修改本规范而不走 §12**；**禁止**把规范修订混进功能任务的同一分支/提交 | 本文件顶部的 SPEC 版本号与 §12.4 修订历史一致；`git log <规范修订 commit>` 只含规范相关文件 |

> ### 补充约束（不列为红线，但违反会被门禁或人工拒绝）
>
> - **禁止**给 `package.json` 加 `packageManager` 字段（pnpm 12 会重写 `pnpm-lock.yaml`，详见 §10.2）。
> - **禁止**把临时脚本/调试产物留在仓库根（一律放 `scripts/oneoff/` 或加进 `.gitignore`）。
> - **禁止**把 `core.autocrlf` 设为 `true`，或把 `.gitattributes` 改成 `* text=auto`（本仓库有逐字节判据，详见 §10.1）。

---

## 2. 标识符规范（编号 / 版本号 / 序列）

> ★ 本节的存在理由是**撞号事故**：`J2.5` 曾同时表示"阶段内第 5 个任务"与"插层子阶段"，导致 `--base` 推断错误、tag 打错一次（判例 P2/P3）。以下规则**一次性消除**这类歧义。

### 2.1 命名空间账本（8 个命名空间，一一对应）

| # | 命名空间 | 语法 | 示例 | 唯一范围 | 谁分配 |
|---|---|---|---|---|---|
| 1 | **阶段** | `J<d>` | `J4` | 全局 | 路线图 §3 |
| 2 | **插层子阶段** | `J<d>.5` | `J2.5` | 全局 | 路线图 §2.2 |
| 3 | **阶段内任务** | `J<d>.<y>`，**`y ∈ {1,2,3,4,6,7,…}`** | `J4.1` | 阶段内 | 开工时（§2.3 查重后） |
| 4 | **任务分支** | `task/<编号>-<短名>` | `task/J4.1-player-module` | 任务存续期 | `task:start` |
| 5 | **开发版 tag** | `v0.<x>.0-dev.<N>` | `v0.4.0-dev.3` | base 内 | `task:done` |
| 6 | **正式版 tag** | `v0.<x>.0` ／ `v0.<x>.5` | `v0.4.0` | 全局 | 发布（§5） |
| 7 | **实施结果文档** | `docs/实施结果/<编号>-实施结果.md` | `J4.1-实施结果.md` | 全局 | 开发者 |
| 8 | **提交信息前缀** | `<编号> <摘要>` | `J4.1 player 模块化：…` | — | 开发者 |

**读数口诀**：编号 `J4.1` 一出现，它的分支（`task/J4.1-…`）、文档（`J4.1-实施结果.md`）、提交（`J4.1 …`）**全部同号**，三处同名即为合法。

> ⚠️ **已废止的形态：`task/<编号>` tag**（SPEC-1.0.2 起）。
> 它在 0.x 版被登记为"可选的**人读便利**标记"，但事实上**工具不打它**（`task:done` 无此步）、`ship` **不收它**（只收 `v*`），
> 且其功能与账本第 8 行「提交信息前缀」完全重复（`git log --grep="<编号>"` 即可定位）
> ⇒ **已从账本移除**。历史遗留的 `task/J3` **已于 2026-09-16 删除**（SPEC-1.0.3，见 **§2.5**）；
> §2.3 的查重 ① 仍然保留，作为"该形态是否死灰复燃"的防御性检查（并兼防 R6 的编号复用）。

### 2.2 编号的三条硬约束

| 约束 | 内容 | 反例 |
|---|---|---|
| **C1** | **`y = 5` 永久保留给插层子阶段** —— 阶段内任务编号**跳过 5**，即 `J4.1`→`J4.4` 之后直接 `J4.6` | ❌ `task/J4.5-ui-module`（会被误读为".5 子阶段"） |
| **C2** | **编号永久不复用** —— 任务即使取消、回滚、改名，原编号也不再分配 | ❌ 取消 `J4.3` 后把新任务也叫 `J4.3` |
| **C3** | **短名必须写**，格式 `[a-z0-9]+(-[a-z0-9]+)*`，且与实施结果文档同号 | ❌ `task/J4.1`（无短名）、`task/J4.1-PlayerModule`（大写） |

> **`.5` 子阶段的分支写法**（唯一例外，用于区分"子阶段"与"任务"）：
> `task/J<d>.5-<短名>`，且编号必须写全 `.5`，例：`task/J2.5-config-layer`。
> 判据：**分支名里 `.5` 出现在编号位**即为子阶段；阶段内任务**永远不会**出现 `.5`（因为 C1 跳过了 5）。

### 2.3 开工前查重（**必须**执行的四条命令）

```bash
NUM=J4.1                                    # ← 换成要用的编号
git tag -l "task/$NUM"                      # ① 该编号是否被历史 tag 形态占用（§2.5 / R6）
git log --format="%s" | grep -E "^(spec: )?${NUM//./\\.}[ ：:]"   # ② 是否被用作任务编号（★ 只匹配【主题】）
ls docs/实施结果/ | grep "^$NUM-"           # ③ 结果文档是否已存在
git branch -a | grep "$NUM"                 # ④ 本地/远端分支是否还在
```

**四条全部无输出**，该编号才可用。任一条命中 ⇒ 换下一个可用序号（跳过 5）。

> ⚠️ **② 必须只匹配提交【主题】**（SPEC-1.2.0 修正）：
> `git log --grep=` 会把提交**正文**一起搜，于是"在正文里预告某个编号"会被误判成"该编号已被占用"。
> **实证**：`J3.8` 的提交正文写了"建议在 `J3.9` 里一并优化"，导致 `J3.9` 的查重 ② 误报 1 条。
> **提及 ≠ 占用。**

### 2.4 版本号与 dev 序列

| 编号形态 | 版本号 base | dev tag 序列 | 正式 tag |
|---|---|---|---|
| 阶段 `J4` | `0.4.0` | `v0.4.0-dev.1`、`.2`、`.3`… | `v0.4.0` |
| 插层子阶段 `J2.5` | `0.2.5` | `v0.2.5-dev.1`… | `v0.2.5` |
| 阶段内任务 `J4.1` | **共用** `0.4.0` | 与阶段**同一条** `v0.4.0-dev.N` 序列 | 由阶段统一发布 |

**序列规则（`N` 的取法）**：

1. `N` = 同 base 下**历史出现过的最大 N + 1**（**不是**"现存 tag 数量 + 1"——删过 tag 会算错）。
2. `N` **不重用**：删掉 `v0.4.0-dev.2` 后，下一个仍是 `dev.3`（R8）。
3. **阶段内任务必须显式传 `--base=0.<x>.0`**：

```bash
node scripts/release.mjs done J4.1 --base=0.4.0     # ✅ 正确 → v0.4.0-dev.1
node scripts/release.mjs done J4.1                  # ❌ 会推断成 v0.4.1-dev.1（判例 P2）
```

> 为什么必须显式传：脚本按任务号推断 `J4.1` → `0.4.1`，而规范要求阶段内任务**共用** `0.4.0`。
> **整阶段（`J4`）与 `.5` 子阶段（`J2.5`）可以不传**——脚本能正确推断。

### 2.5 冻结的历史编号（**只读，不得重解读**）

| 历史形态 | 事实 | 现行处理 |
|---|---|---|
| `F0.2`–`F0.6` | 是 `J0.2`–`J0.6` 的**历史别名**（实施结果文档沿用 `F0.x` 文件名） | 文件名**不改**；**禁止**再新造 `F` 前缀编号；新编号一律 `J<d>` |
| `J2.5` 的双义 | 既指"阶段内第 5 个任务（应用内核）"，又指"插层子阶段（配置编排层）"——两义均已发生并归档 | 两份文档并存：`J2.5-实施结果.md`（内核）／`J2.5-配置编排层-实施结果.md`（配置层）。**冻结**：不再重新解释，新阶段用 C1 规避 |
| `J3` 无合并节点 | 6 个提交直接落在 `dev` 上，无法一条 `revert` 撤销（判例 P1） | **冻结**为反例；不追溯改写历史，规则向前生效 |
| `task/J3` tag | **`task/<编号>` tag 这一形态的孤例**（`J2.1`–`J2.10`、`J2.5`、`J3.1` 及之后**都没打**）；与 `v0.3.0-dev.1` 指向**同一提交**，是纯同义标记、不携带额外信息。**从未推送**（`ship` 只收 `v*`），远端不存在 | **已于 2026-09-16 删除**（SPEC-1.0.3）。删除**无损**（实测）：该提交仍被 `v0.3.0-dev.1` 引用、且是 `dev` 的祖先（**双重可达**），提交信息本身含 `J3 收尾：…`；删除**只走 `exec` 入口**并留痕。此后**不应再出现**该形态的 tag |

---

## 3. 分支模型与使用流程

### 3.1 三条分支线（职责表）

```
origin/main   ← 稳定版：永远能 build / serve / 玩 / 门禁全绿
     ▲  只接受 dev（或 hotfix/*）的 --no-ff 合并
     │
origin/dev    ← 开发版主线：允许"做了一半"的状态
     ▲  任务分支 --no-ff 合回这里，随即打 -dev.N tag
     │
task/<编号>-<短名>   ← 一次性分支：一个任务一条，合并后立即删除
```

| 分支 | 角色 | 允许的提交类型 | 直接 push | 生命周期 |
|---|---|---|---|---|
| `main` | **稳定版** | ① merge commit（来自 `dev`/`hotfix`）② 发布元数据提交（§5.2） | ❌ 只 push 不提交 | 永久 |
| `dev` | **开发版** | 只有 merge commit（来自 `task/*`） | ✅ | 永久 |
| `task/<编号>-<短名>` | 单任务工作区 | 任意开发提交 | ✅（自己的分支） | **合并后立即删除** |
| `hotfix/<版本号>` | 稳定版紧急修复 | 修复提交 | ✅ | 修完删除 |

> **不用长期 `release` 分支**：tag 已能永久冻结任意 commit，多一条长期分支只多一份要同步的状态。**版本快照一律用 tag。**

### 3.2 分支的三种粒度（用法完全相同）

| 执行单位 | 编号形态 | 分支名示例 | 何时用 |
|---|---|---|---|
| **阶段** | `Jx` | `task/J4-system-modularization` | 阶段不再细分任务，或改动**强耦合**时，一条分支贯穿到底 |
| **子阶段** | `Jx.5` | `task/J2.5-config-layer` | 插层子阶段（§2.2 例外写法） |
| **阶段内任务** | `Jx.y`（`y≠5`） | `task/J4.1-player-module` | 阶段被拆成多个独立任务（`J2` 就这么走的） |

**嵌套与不嵌套都合法**（阶段不为此负责）：

- **嵌套**：`task/J4-…` ← `task/J4.1-…`，任务合回**阶段分支**，阶段分支最后 `--no-ff` 合回 `dev`；
- **不嵌套**：直接在 `dev` 上开任务分支，各自合回 `dev`。

**唯一判据**：任何一条改动都必须能追溯到「**某个分支的一次 `--no-ff` 合并**」。

> **不属于任何阶段任务的改动**（规范修订、工具改进、文档 typo…）**也必须走分支**。
> 做法：归到**当前阶段的下一个可用编号**（先跑 §2.3 查重）。
> 若当前没有进行中的阶段，取**最近一个已完成阶段**的号，或单开一条 `.5` 子阶段线。
> ⚠️ 这条规则对本规范自己的修订同样适用（见 §12）。

### 3.3 创建分支：`task:start`（含前置条件）

```bash
node scripts/release.mjs start J4.1 player-module
```

| 前置条件 | 工具行为 | 模型/人工必须做 |
|---|---|---|
| 当前在 `dev` 上 | **仅提醒**（不阻塞） | 若不在 `dev`，**先切回 `dev`** 再开工 |
| 工作区干净 | **仅提醒**（不阻塞） | **可以**带着未提交改动开分支（改动会跟到新分支，见 §3.6 场景 1），但**应当**尽快提交 |
| `dev` 无未推送提交 | **仅提醒**（不阻塞） | 别忘 `ship`；不影响开工 |
| 分支名已存在 | **阻塞**（`die`） | 换编号或清掉旧分支 |

> ★ 三条提醒是"提醒型检查"，**不阻塞**。不要因为看到 ✓ 就以为前置条件都满足了——**R1 的判定命令才是硬判据**。

### 3.4 分支上的工作

- 提交信息**必须**以编号开头：`J4.1 player 模块化：史莱姆/控制/碰撞/输入`
- **应当**沿用路线图粒度：**一个文件一次提交**，让 `git log` 能回答"这个文件什么时候、为哪个任务改的"
- 每个**变更类** git 命令**必须**走 exec 入口（R10）：
  ```bash
  node scripts/release.mjs exec -- git add -A
  node scripts/release.mjs exec -- git commit -F .cache/commit-msg.txt
  ```
  > 用 `-F <文件>` 而非 `-m "…"` 可绕开 PowerShell 引号截断坑（§8.4）。

### 3.5 合并与删除：`task:done`（分支的终点）

```bash
node scripts/release.mjs done J4.1 --base=0.4.0
```

工具按固定顺序执行（**顺序不可调换**）：

| 序 | 动作 | 失败行为 |
|---|---|---|
| 1 | 校验工作区干净 | `die`（先提交再收尾） |
| 2 | 校验**在任务分支上**（不在 `dev`/`main`） | `die` —— 这就是"禁止在 `dev` 上收尾"的机械保证 |
| 3 | 跑静态门禁 `typecheck + verify + build` | `die` + 中止合并 + 记录失败原因 |
| 4 | `git switch dev && git merge --no-ff <分支>` | 中止 |
| 5 | `git tag -a v0.4.0-dev.N -m "<编号> 完成（开发版）"` | 中止 |
| 6 | **`git branch -d <分支>`（小写，自动删分支）** | 见 §3.6 |
| 7 | 追加记录（含原命令）+ 生成推送命令（三件套） | 仅记录 |

> ### ★ 为什么删分支是安全的（消除"提交会不会丢"的顾虑）
>
> `--no-ff` 合并后，merge commit 的**第二父**就是任务分支的尖端，任务的所有提交因而**成为 `dev` 的祖先**。
> 删除分支只删掉"路牌"（一个 41 字节的指针文件），**commit 对象一个字节都不会动**。
>
> ```bash
> # 自证：分支删了，提交还在
> git merge-base --is-ancestor <该任务的任意提交> dev && echo "还在 dev 历史里"
> git log --oneline --grep="<编号>"          # 不依赖分支名也能捞回全部提交
> ```
>
> - 用**小写 `-d`**：git 会拒绝删除**未合并**的分支（双保险）。
> - 真会丢数据的只有三种：未合并就 `-D` 强删、`gc` 宽限期（90 天）过期、用 `rebase`/`squash` 代替 `--no-ff`。
> - **风险方向与直觉相反**：task 分支**不推远端**，所以"留着分支"是**假安全**；真正的持久化是**已合并 + 已 push**。

### 3.6 分支与 tag 的生命周期**相反**

| | 谁创建 | 用完怎么办 | 推不推 |
|---|---|---|---|
| **分支** `task/<编号>-<短名>` | `task:start` | **合并后删除**（`task:done` 自动 `git branch -d`） | 不推（本地工作分支） |
| **tag** `v0.<x>.0-dev.<N>` | `task:done` | **不删** | **推**（`ship` 三件套之一） |
| ~~tag `task/<编号>`~~ | —— **形态已废止**（§2.1 注 / §2.5）：现行流程两条路径（工具 / 手工等价）**都不产生**它 | 孤例 `task/J3` **已于 2026-09-16 删除**（SPEC-1.0.3）；此后**不应再存在**该形态的 tag | 不推（`ship` 只收 `v*`） |

**四个高频场景的处置**：

| 场景 | 正确做法 |
|---|---|
| **1. 已经在 `dev` 上改了文件，还没提交** | **先开分支**（`start` 会带着改动切过去），再在分支上提交。❌ 不要"先提交再补分支"——那已经违反 R1 |
| **2. 在 `dev` 上误提交了** | 立刻开分支把提交"接"过去：`git branch <新分支>` → `git switch dev && git reset --hard HEAD~1` → `git switch <新分支>`。**若已推送**，改用 `git revert` 并记录 |
| **3. 任务做了一半不想做了** | **合并前**：`git switch dev && git branch -D task/…`（提交变不可达，`git reflog` 可救 90 天）。**合并后**：`git revert -m 1 <merge commit>` |
| **4. 想找回已删分支的某个提交** | `git log --grep="<编号>"` / `git reflog`（90 天内）/ `git show <merge commit>` |

---

## 4. 标准开发流程（SOP · 七步）

> **粒度无关**：阶段内任务（`J4.1`）、插层子阶段（`J2.5`）、整个阶段（`J4`）走**同一套七步**，
> 区别只在**编号**（§2）与 **`--base`**（§2.4）。**①和⑥一步都不能少**——跳过即放弃"一条 `revert` 撤掉整个任务"的能力。

### ① 开工：查重 → 开分支

```bash
# 1) 查重（§2.3 四条命令，必须全空）
# 2) 确认在 dev 且尽量干净
git switch dev
node scripts/release.mjs start J4.1 player-module
```

- **必须**：分支名带编号 + 短名，与 `docs/实施结果/J4.1-实施结果.md` **同号**。
- **记录**：工具自动追加「开任务分支」条目（含实际执行的命令）。
- **失败处理**：分支已存在 ⇒ `die`，换编号（跑查重）。

### ② 开发

- 写代码；同时按 `docs/实施结果/J1.5-实施结果.md` 的格式准备 `docs/实施结果/J4.1-实施结果.md`。
- 实施结果文档**必须**含四节：**DoD 核对 / 落点 / 门禁项数 / 遗留与交接**。

### ③ 门禁（分级见 §6）

```bash
node scripts/release.mjs verify J4.1     # 跑 typecheck + verify + build 并逐项留痕
```

**任务完成（DoD）**要求下表六项**全绿**——注意 `verify` 子命令**只跑前三项**：

| # | 命令 | 谁跑 | 说明 |
|---|---|---|---|
| 1–3 | `typecheck` / `verify` / `build` | `task:verify` 自动 | 静态三件套 |
| 4 | `test:visual` | **人工必须跑** | 需先 `build` 再 `serve` 托管 `dist/` |
| 5 | `test:smoke` | **人工必须跑** | 同上 |
| 6 | `test:perf` | **人工必须跑** | 同上；GPU 与 CI 基线**不可混用** |

```bash
node scripts/serve.mjs                  # 另开终端托管 dist/（第 4–6 项的前置）
node tests/visual/compare.mjs           # 4 画面有没有被改坏（3 机位 sha256 逐字节）
node tests/e2e/smoke.mjs                # 5 还能不能玩
node tests/e2e/perf.mjs --compare       # 6 有没有悄悄变慢
```

- **失败处理**：任一项红 ⇒ **不得进入 ⑥**；修复后重跑。
- **记录**：六项的结论（项数 + 结果）**必须**写进实施结果文档。

### ④ 补齐记录 + 对齐版本号

| 动作 | 内容 |
|---|---|
| 实施结果文档 | `docs/实施结果/J4.1-实施结果.md`（四节见 ②） |
| `package.json` | `version` → **`0.4.0-dev.1`**（与将要打的 tag 一致，R9） |
| 阶段收尾时额外 | 同步 §5.3 的**五处状态副本** |

> ⚠️ 改 `package.json` 的 `version` 目前是**人工步骤**（`task:done` 只提示、不代改）。
> 忘了改 ⇒ 违反 R9。收尾前用这条命令自检：
> ```bash
> node -p "require('./package.json').version"    # 必须等于 §2.4 推出的下一个 dev.N
> ```

### ⑤ 提交（信息带编号，历史才能自解释）

```bash
node scripts/release.mjs exec -- git add -A
node scripts/release.mjs exec -- git commit -F .cache/commit-msg.txt
```

提交信息格式（**必须**以编号开头）：

```
J4.1 player 模块化：史莱姆/控制/碰撞/输入

- 落点：src/cabin/features/player/**
- 门禁：typecheck / verify / visual / smoke / perf 全绿
- 验收：见 docs/实施结果/J4.1-实施结果.md
```

### ⑥ 收尾：`task:done`（合并 + 打 tag + 删分支）

```bash
node scripts/release.mjs done J4.1 --base=0.4.0      # ★ 阶段内任务必须显式传 --base
```

**产物**：`v0.4.0-dev.N` tag + dev 上的一个合并节点 + 分支已删除 + 一条含原命令的记录 + 待推送命令。

- **失败处理**：见 §3.5 表格（工作区脏 / 不在任务分支 / 门禁红 ⇒ 各自 `die`）。
- **自检**（**必须**跑）：
  ```bash
  git log --merges --oneline -10      # 本任务应有一个合并节点
  git log --oneline --no-merges "$(git describe --tags --abbrev=0 dev)..dev"   # 应为空
  ```

#### ⑥.1 收尾实测结果的**回填**（★ 轻量路径，SPEC-1.2.0 新增）

有些章节**只有在收尾之后才能填**（例如"门禁实际耗时""`task:done` 的实测输出""收尾自检结果"）。
此时任务分支已合并、tag 已打 —— **再为回填单独开一个任务显然过重**。

**规定路径**：

| # | 规则 |
|---|---|
| 1 | 回填**属于该任务自身**的收尾动作 ⇒ **不另开编号** |
| 2 | **仍走独立分支 + `--no-ff` 合并**（R1 不可绕过）；分支名 `task/<编号>-<短名>-backfill` |
| 3 | ⚠️ **这不违反 C2「编号不复用」**：它不是新任务，是**同一任务的补充提交**；`-backfill` 后缀是对 C3「短名与文档同号」的**唯一豁免** |
| 4 | **不打新的 `-dev.N` tag**（该任务的 tag 已在 ⑥ 步打过，序号不因此变化 —— R8） |
| 5 | 提交信息前缀 `docs(<编号>):`，例：`docs(J3.9): 回填收尾实测结果` |
| 6 | 若回填内容**影响判据**（例如改了门禁结论的数字），**必须**在 `GitPushHistory.md` 追加说明 |

### ⑦ 推送（**必做，人工执行**）

工具**只生成命令，绝不自动 push**（受限沙箱里 SSH 会 `couldn't create signal pipe` 失败）。

```bash
node scripts/release.mjs ship        # 生成：dev + main（若落后）+ 所有未推送 tag
```

把记录末尾 `# [ ]` 的命令复制到**普通终端**执行：

```powershell
git push origin dev
git push origin v0.4.0-dev.1          # ★ tag 必须单独推：git push origin dev 不带 tag
```

```bash
node scripts/release.mjs status      # ★ 复查：能由 git 状态证明的命令自动翻成 [x]
```

- **判定完成**：`status` 里 `dev` 与 `main` 均 **0 ahead**、所有 tag 带 **✓**。
- **禁止**把 `[ ]` 留到下一个任务（R11 的姊妹条款：推送是流程的一部分，不是"想起来才做"）。

---

## 5. 阶段发布（`dev` → `main`）

### 5.1 触发条件（二选一，**不要每个任务都发稳定版**）

1. 一个 `J` 阶段（或 `.5` 子阶段）**验收通过**；
2. 出现**用户可感知**的成果。

### 5.2 发布 SOP（含 `main` 上提交的唯一豁免）

```bash
node scripts/release.mjs ship main        # ① 生成发布计划（写进记录待执行区）
```

```bash
# ② 按计划执行（等价手工动作）
git switch dev  && git pull
git switch main && git pull
git merge --no-ff dev -m "release: v0.4.0（J4 系统模块化）"
#   ← 唯一允许在 main 上出现的开发类动作

# ★★ package.json 会【冲突】—— 这是【预期】，不是异常：
#     dev 侧是 0.4.0-dev.K，main 侧停在上一次的正式号（如 0.3.0），两边改过同一行。
#     处理：直接在冲突处写成【即将发布的正式号】（下面本来就要写它）
#        <<<<<<< HEAD
#          "version": "0.3.0",        ← main 侧：弃
#        =======
#          "version": "0.4.0-dev.K",  ← dev 侧：弃
#        >>>>>>> dev
#        改为 →  "version": "0.4.0",
node scripts/release.mjs exec -- git add package.json
node scripts/release.mjs exec -- git commit --no-verify -m "release: v0.4.0（J4 系统模块化）"
#   ↑ 这个 merge commit 同时完成了「合并」与「去掉 -dev 后缀」
#     ⇒ ★ 因此**不再需要**单独的 chore(release) 提交

node scripts/release.mjs exec -- git tag -a v0.4.0 -m "J4 系统模块化：legacy/ 清零 + animate 收缩为调度骨架"
git push origin main --follow-tags
git switch dev                            # ★ 立刻回 dev，别在 main 上写代码

node scripts/release.mjs ship             # ③ 复查 dev 与开发版 tag 是否也遗漏
node scripts/release.mjs status           # ④ 全绿判定（同 §4⑦）
```

> **豁免边界（严格）**：`main` 上**只允许一个提交** —— 上面那个 `release:` **merge commit**。
> 它在冲突解决时**顺带写入**了 `package.json` 的正式版本号，因此**不需要**再补一次 `chore(release)`。
> 任何其他提交（功能、修复、文档、重构）出现在 `main` 上 ⇒ 违反 R1。

> ### ★ 发布提交**不回流** `dev`（与 §4.1 hotfix 的关键区别）
>
> 发布完成后**不要**把 `main` 合回 `dev`。判据是「**回流的到底是什么**」：
>
> | | 回流对象 | 要不要回流 | 理由 |
> |---|---|---|---|
> | **hotfix**（§4.1） | **代码修复** | ★ **必须** | 修复是真实代码改动；dev 没有它，下次发布就会**把该修复丢掉** |
> | **阶段发布**（本节） | **版本号变更 + 一个合并节点** | **不需要** | dev 的 `version` 是自己的 `-dev.N`（R9 要求它与 dev tag 一致）；发布节点留在 `main` 上就是发布记录。回流只会引入一个**无编号**的 merge commit |
>
> **⇒ `main` 会随每次发布累积 1 个独有提交**（`release: vX.Y.Z`）。这是**预期行为，不是缺陷**。
> **判定**：`git log --oneline dev..main` 只应出现 `release:` 开头的发布节点；
> 若出现 `feat`/`fix` 等其他提交 ⇒ 说明有改动只落在 `main` 上，按 §4.1 补回流。

### 5.3 ★ 阶段收尾清单（**五处**状态副本，**必须一起改**）

阶段状态在**五个**地方各有一份，历史上已多次漏同步（判例 P4）。收尾时**逐条打勾**：

| # | 位置 | 改什么 |
|---|---|---|
| 1 | 本文件 **§5.4 版本历史表** | 该版本的 tag 列写入实际 tag、状态改 ✅ **稳定版**、日期填上 |
| 2 | `README.md` 顶部 | 「当前阶段」与「当前稳定版」 |
| 3 | `BuildPlaning/01-完善路线图.md` 的**阶段总表** | 该阶段状态标记 |
| 4 | `BuildPlaning/01-完善路线图.md` 的**阶段章节标题** | 标题末尾的状态标记（最易漏的一处） |
| 5 | `BuildPlaning/01-完善路线图.md` 的**执行顺序状态表** | 该阶段所在那一行的状态列（SPEC-1.1.0 补入） |

> 判定：**五处**状态一致；不一致时以**本文件 §5.4** 为准（它是版本事实的唯一来源）。
>
> ⚠️ **第 5 处是 SPEC-1.1.0 补进来的**（旧清单只写"四处"，漏了它）。
> `J3` 收尾那次同时暴露了两处问题：第 4 处长期停在 `⬜`、与总表的 `🟡` 不一致；第 5 处则完全不在清单里。
> 实证记录见 `docs/实施结果/J3.7-实施结果.md` §1。

### 5.4 版本历史（**只增不改**）

| 版本 | tag | 内容 | 日期 | 状态 |
|---|---|---|---|---|
| `0.1.2`–`0.1.6` | —— | `F0.2`–`F0.6` 保障性任务 | —— | ⬜ **未单独发版**（并入 `v0.1.5`，见 §2.5） |
| `0.1.5` | `v0.1.5` | `J0` 基线护栏 + `J1` 工程化骨架 + `J1.5` Astro 落地 | 2026-09-14 | ✅ 稳定版 |
| `0.2.0` | `v0.2.0` | `J2` 小屋核心设施（`CameraRig` + 统一 `Interactable` + 持久化 + 内核） | 2026-09-14 | ✅ 稳定版（任务快照 `dev.1`–`dev.11`） |
| `0.2.5` | `v0.2.5` | `J2.5` 配置编排层（`settings.config.js` + `SettingsForm` + `blog/registry.js` + `verify:cf`） | 2026-09-15 | ✅ 稳定版（任务快照 `dev.1`） |
| `0.3.0` | `v0.3.0` | `J3` 物件模块化（35/67 件，其余 32 件交 `J4`）+ `J3.1` 交互通路回归修复 + 版本规范 `SPEC-1.0.0`→`1.0.3` | 2026-09-16 | ✅ **稳定版**（任务快照 `v0.3.0-dev.1`–`dev.7`） |
| `0.4.0` | `v0.4.0-dev.7` | `J4` 系统模块化（`legacy/` 清零） | —— | 🟡 **开发中**（21 段全部搬完、`legacy/` 已删除、`animate()` ≤ 60 行 —— **阶段 DoD 全部达成**，待阶段发布 `v0.4.0`） |
| `0.5.0` | `v0.5.0` | `J5` 内容管线与静态页 | —— | ⬜ 计划 |
| `0.6.0` | `v0.6.0` | `J6` 书架即博客 + 方案 B 阅读器 | —— | ⬜ 计划 |
| `0.7.0` | `v0.7.0` | `J7` 功能模块增量 | —— | ⬜ 计划 |
| `0.8.0` | `v0.8.0` | `J8` 升级与调优 | —— | ⬜ 计划 |
| `1.0.0` | `v1.0.0` | 对外发布 | —— | ⬜ 计划 |

> 状态只有三种：⬜ **计划** / 🟡 **开发中**（须写最新 `dev.N`）/ ✅ **稳定版**（须写日期）。
> **禁止**让一个已打出 `-dev.N` 的阶段停留在「⬜ 计划」——那正是 P4 的成因。

### 5.5 hotfix（稳定版出事了）

```bash
git switch -c hotfix/0.4.1 main
# …… 修复 + 完整门禁 ……
node scripts/release.mjs exec -- git commit -F .cache/commit-msg.txt
git switch main && git merge --no-ff hotfix/0.4.1
git tag -a v0.4.1 -m "hotfix: …"
git push origin main --follow-tags

git switch dev && git merge --no-ff hotfix/0.4.1    # ★ 别让修复只留在 main 上
git branch -d hotfix/0.4.1
```

---

## 6. 门禁分级（什么时候跑什么）

| 时机 | 命令 | 强制级 | 谁跑 |
|---|---|---|---|
| 每次提交前 | `typecheck` + `verify` | 可选（hook） | 人工 |
| **任务完成（DoD）** | 上表**六项全绿** | ★ **必须** | 前 3 项工具跑，后 3 项**人工必须跑** |
| 发布到 `main` 前 | `verify:visual`（3 轮零差异）+ 完整六项 | ★ **必须** | 人工 |
| CI（每次 push / PR） | `typecheck` → `verify` → `build` | 自动 | `.github/workflows/ci.yml` |

> ★ **术语澄清（原文档在这里有歧义）**：
> - **静态三件套** = `typecheck` + `verify` + `build` —— `task:verify` / `task:done` **只跑这三项**。
> - **完整门禁（六项）** = 静态三件套 + `test:visual` + `test:smoke` + `test:perf` —— 即 §4③ 的 DoD。
>
> **`task:done` 通过 ≠ DoD 达成**。视觉 / 冒烟 / 性能三项必须人工跑过，结论写进实施结果文档。
>
> **前置**：`test:visual` / `test:perf` / `test:smoke` 需要先 `build` 再 `serve`（托管 `dist/`）。
> 零构建兜底用 `serve:legacy`，单文件产线用 `serve:single`（脚本自动识别首页形态）。
>
> **基线不可混用**：CI 是 `swiftshader`，本地可能是 `gpu`，性能基线分两套（`perf.json` / `perf.gpu.json`）。

---

## 7. 回滚（三档，按慌乱程度选）

```bash
# 第 1 档：某个任务做坏了，还没发版（最常用）
git switch dev
node scripts/release.mjs exec -- git revert -m 1 <该任务的 merge commit>
#   ↑ 生成反向提交，历史完整留痕；靠的就是 --no-ff 那个合并节点

# 第 2 档：稳定版出事了 → 走 §5.5 hotfix
#   ★ 千万别用 reset —— main 已被 push（R11）

# 第 3 档：只想看/跑某个历史版本（不切分支）
git switch --detach v0.2.5
node scripts/serve.mjs           # 上个稳定版就地跑起来
git switch dev                   # 看完回来
```

> `v0.1.5` 这类基线 tag 的价值：**tag 是"随时可回到那一版并真的跑起来"**，这正是它取代早期 `FrontProj/Backup/*.zip` 的原因。

---

## 8. 模型执行 git 的协议

> 本节回答「AI 在开发过程中到底跑了哪些 git 命令」这个可追溯性问题。
> **只管模型执行的、对仓库有修改的命令；不管人工在终端敲的。**

### 8.1 入口（R10）

```bash
node scripts/release.mjs exec -- git add -A                    # 变更类 → 执行 + 记录
node scripts/release.mjs exec -- git status --short            # 只读 → 执行，**不记**
```

工具**代为执行**，把**原命令 + 退出码**写进记录——"模型跑过什么"不依赖事后回忆。

### 8.2 什么算"有修改"（`isMutatingGit()` 判据）

| 记（变更类） | 不记（只读查询） |
|---|---|
| `add` `commit` `merge` `rebase` `reset` `cherry-pick` `revert` `stash` | `log` `status` `diff` `show` `rev-parse` `reflog` `describe` `ls-files` |
| `switch` `checkout` `restore` `rm` `mv` `clean` `apply` `am` | `tag -l` / `tag --points-at`（查询用法） |
| `push` `pull` `fetch` `clone` `init` | `branch --show-current` / `-l` / `-vv` |
| `tag -a/-d/-s/-f`、`branch -d/-m/-c`、`remote add/set-url` | `config --get/--list`、`remote -v` |
| `update-ref` `symbolic-ref` `update-index` `read-tree` `write-tree` | `ls-remote` |
| `gc` `prune` `pack-refs` `filter-branch` `sparse-checkout` `notes` `submodule` `worktree` | —— |

> 判据带**同一命令的两种用法**（`tag -l` vs `tag -a`、`config --get` vs `config k v`）——别只按命令名判。

### 8.3 三条记录路径的分工

| 路径 | 覆盖范围 | 命令来源 | 可信度 |
|---|---|---|---|
| `exec` 入口 | 模型执行的**变更类**命令 | **原命令** | ★★★ 直接捕获 |
| `start` / `verify` / `done` / `ship` / `sync` | 工具自动执行的 git 操作 | **原命令** | ★★★ 直接捕获 |
| `post-commit` / `post-merge` 钩子 | 提交/合并**事件**（含人工做的） | 重建（素材来自 reflog） | ★★ 等价但非原样 |

**补登记**：`record --ops="git …"` 用于"忘了走 exec"的场景；传入的只读查询会被自动过滤并如实报告忽略了几条。

### 8.4 ⚠️ PowerShell 引号坑（实测）

给 `--ops=` 或 `-m` 传「**参数中间**带双引号」的值会被**静默截断**：

```powershell
# ✗ 记录里会变成 `git merge --no-ff dev -m release:`
--ops=git merge --no-ff dev -m "release: v0.4.0（J4）"

# ✓ 参数整体加引号是安全的（双引号在参数边界）
git log -1 --format="%h %s"

# ✓ 参数中间避免双引号：用尖括号，或改用 -F <文件>
--ops=git merge --no-ff dev -m <release: v0.4.0>
```

> **首选做法**：提交与合并信息一律写进文件，用 `-F .cache/commit-msg.txt`（§4⑤）。

### 8.5 ★ 变更类命令**禁止**用管道截断输出（实测 · SPEC-1.2.0）

**现象**：`switch` / `merge` / `tag -a` / `branch -d` 看起来"都跑过了"，实际**一条都没生效**。

**根因**：PowerShell 的 `Select-Object -First N` 在取够 N 个对象后**关闭管道**，
上游进程被**提前终止** —— 对只读查询无害，对**变更类命令等于随机中断**，而且是**静默失败**（看输出发现不了）。

```powershell
# ✗ 禁止：变更类命令截断输出 ⇒ 进程可能在写入完成前被终止
node scripts/release.mjs exec -- git switch dev | Select-Object -First 1

# ✓ 变更类命令：让输出完整流过，不要截断
node scripts/release.mjs exec -- git switch dev

# ✓ 确实要少输出时用 -Last（它必须消费完整输入流，不会提前终止）
node scripts/release.mjs exec -- git commit -F .cache/commit-msg.txt | Select-Object -Last 6
```

**复核判据**：一条变更命令执行后，**必须**用**只读查询**确认它生效：

```bash
git branch --show-current     # switch 是否生效
git tag -l "<tag>"            # tag 是否真的创建了
git branch -l                 # 分支是否真的删了
```

> **实证（判例 P7）**：`J3.8` 收尾时用 `Select-Object -First 1` 截断，
> 四条命令**全部未生效** —— tag 根本没创建（事后 `git tag -d` 报 `tag not found` 才证实），
> 而输出看起来"都成功"了。实际损失为零，但**这类失败只能靠只读查询复核发现**。

### 8.6 ★ 用 PowerShell 改文件会**加 BOM**（实测 · SPEC-1.3.0）

**现象**：`Set-Content -Encoding utf8` 写出的文件，开头会多出 `EF BB BF`（UTF-8 BOM）。

**为什么在本仓库特别危险**：本仓库有**逐字节判据**（§8）——
`tests/baseline/cabin-digest.json`（`src/cabin/**` 摘要）与 `tests/visual/baseline/*.png`（截图 sha256）。
**被摘要守住的文件一旦被加 BOM，门禁就会报警，而报错信息不会告诉你"是 BOM"** ——
正是 §8 开头警告的那类"报警却查不出原因"。

```powershell
# ✗ 会加 BOM（实测：文件前 3 字节从 35,32,71 变成 239,187,191）
Get-Content x.json -Raw | Set-Content x.json -Encoding utf8

# ✓ 方案 1：改用 node 写（readFileSync 读时会自动剥离 BOM；writeFileSync 默认不写 BOM）
node -e "const fs=require('fs');const s=fs.readFileSync('x.json','utf8');fs.writeFileSync('x.json',s)"

# ✓ 方案 2：PowerShell 里显式指定无 BOM（PS 7.4+）
Set-Content x.json -Value $s -NoNewline -Encoding utf8NoBOM
```

**复核判据**（改完**任何**文件后都值得跑一次）：

```powershell
Get-Content <file> -Encoding Byte -TotalCount 3      # 应是文件真实开头，不是 239,187,191
```

> **实证（判例 P8）**：`J3.12` 清理 `GitPushHistory.md` 的 `[ ]` 标记时，
> `Set-Content -Encoding utf8` 给文件加了 BOM（`35,32,71` → `239,187,191`），已用 node 重写剥离。
> **该文件恰好在 `.gitignore` 内、不受判据保护**才没酿成门禁报警 ——
> 若换成被摘要守住的文件，就会直接触发一次"查不出原因"的门禁失败。

---

## 9. 自动记录与 `GitPushHistory.md`

| 项 | 内容 |
|---|---|
| 是什么 | **本地专用** Git 操作流水：commit / tag / branch / push 与结果、待人工执行的命令 |
| 在哪 | 仓库根 `GitPushHistory.md`，**在 `.gitignore` 里**（不上传 GitHub，但保留在工作区） |
| 记什么 | 变更类命令（改仓库状态） |
| 不记什么 | 只读查询（`log` / `status` / `diff` / `rev-parse` / `ls-remote`…）——记进去只会让历史变噪音 |

### 9.1 五条维护铁律（工具严格遵守）

1. **只增不改**：历史一旦写入不再修改，新记录追加在末尾。
2. **唯一允许的原地改动**：把**已执行**命令的 `[ ]` 翻成 `[x]`。
3. **标记不猜**：只有 git 状态能证明命令确实执行了才翻；证明不了就保持 `[ ]`。
4. **推送由人工执行**：工具绝不自动 push。
5. **失败与报错如实记录**——否则下次还会踩同一个坑。

### 9.2 命令执行状态怎么判定

| 命令形态 | 翻成 `[x]` 的条件 |
|---|---|
| `git push [-u] origin dev` | `origin/dev` 存在 且 `dev` 不 ahead |
| `git push [-u] origin main` | `origin/main` 存在 且 `main` 不 ahead |
| `git push origin main --follow-tags` | **只看分支**（tag 由它自己的命令负责） |
| `git push origin v0.4.0 v0.4.0-dev.1 …` | 该行列出的 tag **全部**已在远端 |
| 其他（merge / tag / 计划类） | **不自动标记**（人工判断） |

> **受限环境的表现**：禁止创建命名管道的沙箱里 `git ls-remote` 必定失败（exit 128），
> 此时 tag 状态标 **`?` 未验证**，而**不是**「未推送」——两者含义完全不同。
> ⚠️ 但**"无法确认"绝不影响命令的生成**：`ship` 在远端不可达时**仍会列出**这些 tag 的推送命令。**漏列才是危险的**（判例 P5）。

### 9.3 钩子与 R1 的两层机械防护

| 钩子 | 触发 | 行为 | 阻塞？ |
|---|---|---|---|
| `post-commit` | `git commit` 成功后 | 记录分支 / HEAD / 提交主题 / tag | ❌ 绝不阻塞 |
| `post-merge` | `git merge` 成功后 | 同上（git 在 merge 时执行 post-merge 而非 post-commit，不会重复） | ❌ 绝不阻塞 |
| **`pre-commit`** | `git commit` 之前 | ★ **在 `dev` / `main` 上拒绝开发提交**（R1） | ★ **故意阻塞** |

> ★ **`pre-commit` 是本仓库唯一的阻塞型钩子**——它存在的意义就是在违规发生的那一刻挡住它。
> 两类**合法豁免**（判据与 `release.mjs` 的 `guardProtectedBranch()` 完全一致，宁窄勿宽）：
> ① **合并提交**（`MERGE_HEAD` 存在，即冲突解决后的收尾提交）；② **发布元数据提交**（暂存区**只有** `package.json`，见 §5.2）。
> 紧急绕过：`git commit --no-verify` —— 会在 reflog 留痕，**用了就必须在 `GitPushHistory.md` 补记录说明理由**（§13）。

#### R1 的两层防护（为什么"确保不再违规"靠的是机制，不是自觉）

| 层 | 覆盖路径 | 实现 | 实测可靠性 |
|---|---|---|---|
| **第 1 层** | **模型**（所有变更类 git 命令必经 `exec`） | `guardProtectedBranch()` 在执行前拦截，`die` + 写 `kind: blocked` 记录 | ★★★ **已验证生效**（在 `dev` 上 `exec -- git commit` → 拒绝 + 留痕） |
| **第 2 层** | **人工**（在终端直接 `git commit`） | `scripts/hooks/pre-commit` | ★★ **普通终端**按设计生效；**受限沙箱里 hook 跑不起来**（`sh.exe: couldn't create signal pipe`）——此时靠崩溃阻断提交，属环境巧合，**不可依赖** |
| **第 3 层** | **事后**（兜底判定） | §附录A 的 A8 自检命令 | ★★★ 客观可查 |

> **为什么必须有第 1、2 层**：文档禁令在 0.x 版就已存在（旧红线 1），`J3` 依然违反了（判例 P1）。
> **光靠自觉不够** —— 规则要被机械执行，而不是被记住。
>
> ⚠️ **模型不得依赖第 2 层**：受限环境里它可能整个不执行。**模型路径的唯一保证是第 1 层**（`exec` 入口），
> 所以 R10（变更类命令必须走 `exec`）不是"为了记录好看"，它是 R1 得以强制的前提。

- 安装：`node scripts/install-hooks.mjs`（换机器 / 重新 clone 后**必须**跑一次——`.git/hooks/` 不受版本控制）。
- 记录类钩子的设计原则：**绝不阻塞 git**（输出丢弃、异常 `exit 0`、跳过一切网络请求）。
- ⚠️ **受限沙箱里钩子可能跑不起来**（Git 用 `sh.exe`，禁命名管道会 `couldn't create signal pipe`）。
  此时记录**不会丢**：`node scripts/release.mjs sync` 是**幂等补记**。建议把 `sync && ship` 作为每阶段固定收尾动作。

---

## 10. 仓库边界与工程约束

### 10.1 换行符与二进制（`.gitattributes` 存在的理由）

本仓库有**逐字节判据**（`tests/baseline/cabin-digest.json`、`tests/visual/baseline/*.png`），因此：

- `.gitattributes` 用 `* -text` **全局关闭换行符转换**——工作区与库中内容字节一致；
- **禁止**改成 `* text=auto`，**禁止**把 `core.autocrlf` 设为 `true`：那会悄悄改写被摘要守住的文件，让门禁报警却查不出原因；
- `*.png` / `*.mp3` 等显式声明为 binary，避免 diff 噪音。

### 10.2 不要给 `package.json` 加 `packageManager` 字段（实测坑）

pnpm 12 一旦读到该字段就会**重写 `pnpm-lock.yaml`**（插入包管理器自身依赖 `@pnpm/exe` 各平台二进制，实测 +120 行），
lockfile 无谓膨胀，并让 CI 的 `pnpm install --frozen-lockfile` 面临失败。

**所以 pnpm 版本固定在 `.github/workflows/ci.yml`**（`pnpm/action-setup` 的 `version`）。lockfile 是判据的一部分，不接受这种副作用。

### 10.3 仓库边界（★ 不要踩的坑）

`Magic-cabin` **自身就是仓库根**，它嵌在 `D:\FireflyQAQ\Project\FrontProj\` 下，
而 `README.md` 引用了仓库外的相对路径（`../docs/improve/`、`../docs/ArtLine-Part/`、`../Test/`）。

> ❌ **绝对不要在 `D:\FireflyQAQ\Project` 或 `FrontProj\` 再 `git init`**（R13）。
> 那样 `Magic-cabin` 会变成嵌套仓库 / gitlink，§3 的「一个任务一个版本」边界会全部失效——
> 父仓库只记录一个 commit 指针，子仓库的历史、tag、分支都不再受保护。

父目录的规划文档继续以**普通文件**形式被本文档引用即可，**不纳入版本控制**。

### 10.4 临时产物

- 临时脚本、调试产物**禁止**留在仓库根（放 `scripts/oneoff/`，或加进 `.gitignore`）。
- 已在 `.gitignore` 中：`node_modules/`、`dist/`、`dist-single/`、`.astro/`、`.cache/`、`_shots/`、`debug.log`、`GitPushHistory.md`、`src/blog/generated/`。
- ⚠️ `tests/visual/baseline/*.png` 与 `tests/e2e/baseline/perf.json` **必须提交**（它们是判据本身）。

---

## 11. 命令速查（`scripts/release.mjs` 的镜像）

> 每一行都对应脚本里的一个子命令。`pnpm <别名>` 与 `node scripts/release.mjs <子命令>` **等价**——
> **`pnpm` 不可用时（如受限沙箱会尝试重装 node_modules）一律用 node 直调。**

| 子命令 | pnpm 别名 | 作用 | 会做的事 |
|---|---|---|---|
| `start <编号> [短名]` | `task:start` | 开任务分支 | 前置**提醒**（不在 dev / 工作区脏 / dev 未推送）→ `git switch -c task/<编号>-<短名>` → 追加记录（含原命令）→ 打印待推送命令 |
| `verify <编号>` | `task:verify` | 跑**静态三件套**并记录 | `typecheck + verify + build`，逐项记录耗时与结果（`--quick` 只跑前两项） |
| `done <编号> --base=x.y.z` | `task:done` | 收尾（**须在任务分支上**） | 校验工作区干净 → 校验在任务分支 → 跑静态三件套 → `merge --no-ff` 回 `dev` → 打 `v<base>-dev.N` → **删任务分支** → 追加记录 + 生成推送命令。★ `Jx.y`（`y≠5`）**必须**显式传 `--base` |
| `ship [main]` | `ship` | ★ **生成推送命令（三件套）** | 按实际 git 状态生成**待人工执行**的命令并追加记录：**dev + main（若落后）+ 所有未推送 tag**（远端不可达时标"无法确认"但**仍列出**）。**绝不执行 push**。带 `main` 时生成 `dev → main` 的合并 + 正式 tag 计划 |
| `status` | `git:status` | 仓库状态总览 | 分支 / HEAD / 工作区 / 未推送提交 / 每个 tag 的同步状态；**自动把已验证执行的 `[ ]` 翻成 `[x]`**（除此之外不改动任何记录） |
| `history` | `git:history` | 查看自动记录区 | 打印 `GitPushHistory.md` 的追加记录 |
| `sync` | `git:sync` | **幂等补记** | 把最近若干提交中尚未记录的补进时间轴；已记过的不重复 |
| `exec -- git …` | `git:exec` | ★ 模型执行 git 的唯一入口 | 代为执行；**变更类**记入历史（原命令 + 退出码），**只读**执行但不记 |
| `record --ops="git …"` | —— | 事后补登记 | 给"忘了走 exec"兜底；只读查询自动过滤并报告忽略条数 |
| `hooks:install` | `node scripts/install-hooks.mjs` | 安装 git 钩子 | 把 `scripts/hooks/*` 装到 `.git/hooks/`（换机器后跑一次） |

**`--base=x.y.z` 速查**：

| 编号形态 | 要不要传 | 命令 |
|---|---|---|
| `J4.1`（阶段内任务） | ★ **必须** | `done J4.1 --base=0.4.0` |
| `J4`（整阶段） | 可以不传 | `done J4 --base=0.4.0`（显式传更稳） |
| `J2.5`（`.5` 子阶段） | 可以不传 | `done J2.5`（能正确推断 `0.2.5`） |

### 11.1 工具不可用时的降级路径（受限环境实测）

| 场景 | 现象 | 降级做法 |
|---|---|---|
| `pnpm <别名>` 启动失败 | `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` | ★ 见下方 **§11.1.1**（根因三条事实 + 判别命令） |
| `done` 内部门禁调 `pnpm` 失败 | `runGates()` 执行的是 `pnpm typecheck/verify/build` | 手工等价收尾（见下） |
| `git ls-remote` / `git push` 失败 | `ssh.exe: couldn't create signal pipe, Win32 error 5` | **推送一律在普通终端人工执行**（工具本来就只生成命令） |
| git 钩子不执行 | `sh.exe: couldn't create signal pipe` | 第 1 层防护（`exec`）不受影响；记录用 `sync` 幂等补记 |
| **`pre-commit` 崩溃并阻塞所有提交** | 同上——Git for Windows 用 `sh.exe` 执行 hook，崩溃 ⇒ 非零退出 ⇒ **连合法提交也被拒绝** | ★ 受限环境里提交**必须**加 `--no-verify`，并**在记录里写明理由**（§13）。**普通终端无需此步**（钩子按设计工作） |
| `git log` 中文乱码 | PowerShell 控制台编码 | 只影响显示，不影响判据；必要时 `chcp 65001` |

#### §11.1.1 pnpm 双重安装与 `.modules.yaml`（根因 · 实测）

**现象**：任何 `pnpm <别名>` 命令在跑脚本**之前**都会先执行 `runDepsStatusCheck()`，
判定 `node_modules` 需要重建并尝试 purge + install —— 于是**连一条只读命令都会触发重装**。

**根因（三条实测事实）**：

| # | 事实 | 后果 |
|---|---|---|
| 1 | PATH 上可能同时存在**两个 pnpm**，且宿主注入的 shim **优先**于用户自装版本（实测：shim `11.8.0` 先命中，自装 `12.3.4` 才是 `.github/workflows/ci.yml` 固定的版本） | 命中的可能是**版本不对**的那一个 |
| 2 | `node_modules/.modules.yaml` 是 pnpm 记录「由哪个 pnpm、用什么参数安装」的**状态文件**；**它缺失 ⇒ pnpm 无法确认 `node_modules` 完好 ⇒ 判定需要 install** | ★ **触发重装的直接原因** |
| 3 | 重装会在原生依赖的 postinstall 处失败（`esbuild` → `spawnSync … EPERM`，受限环境禁止创建子进程），**因此写不出 `.modules.yaml`** | ⇒ **每次都重复触发，永不收敛** |

**开工前判别（两条命令）**：

```bash
Test-Path node_modules/.modules.yaml    # False ⇒ 本环境 pnpm 不可用，直接走降级路径
pnpm --version                          # 与项目要求不符 ⇒ 命中的是宿主注入的 shim
```

**结论：受限环境里 §11.1 的降级路径是默认姿势，不是备选。**

- 受限环境：一律 `node scripts/release.mjs <子命令>`（完全等价，且不碰依赖检查）
- 普通终端：跑一次 `pnpm install` 补写 `.modules.yaml` 即可恢复正常。
  它只补状态文件、不改依赖图 ⇒ **不会改动 `pnpm-lock.yaml`**（lockfile 是判据的一部分，见 §10.2）

> ⚠️ **操作警告（对上述降级路径的补充说明，不构成 §1 红线）**：
> pnpm 的报错会建议「set the `CI` environment variable to `true`, or set `confirmModulesPurge` to `false`」——
> **禁止照做**。那会让 pnpm **真的删除 `node_modules` 并重装**；在无网络或受限环境里，这等于毁掉工作区。
> **那个 TTY 中止是保护，不是故障。**

#### 手工等价收尾（`node … done` 不可用时，逐步执行 §3.5 的动作）

```bash
# 前提：在 task/<编号>-<短名> 分支上、工作区干净、完整门禁六项已跑过

# 0) ★ 受限环境（sh.exe 不可用）里 pre-commit 会崩溃并阻塞提交 ⇒ 提交须加 --no-verify
node scripts/release.mjs exec -- git add -A
node scripts/release.mjs exec -- git commit --no-verify -F .cache/commit-msg.txt
#   ↑ 普通终端**不要**加 --no-verify：那里钩子按设计工作，是第 2 层防护

# 3) 门禁（等价直调，绕开 pnpm）
node_modules/.bin/tsc --noEmit           # = pnpm typecheck
node scripts/_verify.mjs                 # = pnpm verify
node_modules/.bin/astro build            # = pnpm build

# 4) 合并（★ --no-ff 不可省，否则失去可整体 revert 的边界）
node scripts/release.mjs exec -- git switch dev
node scripts/release.mjs exec -- git merge --no-ff task/J3.2-versioning-spec -m "merge J3.2：合入 dev"

# 5) 打 tag（N = 同 base 历史最大序号 + 1，见 §2.4）
node scripts/release.mjs exec -- git tag -a v0.3.0-dev.3 -m "J3.2 完成（开发版）"

# 6) 删分支（小写 -d，未合并会被 git 拒绝）
node scripts/release.mjs exec -- git branch -d task/J3.2-versioning-spec

# 7) 记录 + 生成推送命令（★ 必须补，否则记录断档）
node scripts/release.mjs record "J3.2 收尾（手工等价流程）" --kind=done
node scripts/release.mjs ship
node scripts/release.mjs status
```

> ⚠️ 手工路径**必须逐条走 `exec`**（R10）——否则第 1 层防护被绕过、记录也会断档。
> 这就是"工具不可用"与"可以不走流程"的区别：**流程可以手工执行，红线不会因此放松**。

---

## 12. ★ 规范修订协议（冻结条款）

> **本规范是执行判据，判据必须稳定。** 一条规则在执行期内被"顺手改掉"，会让**正在执行的任务**失去判据，
> 并极易引入自相矛盾的条款——这正是本节要防的事。

### 12.1 冻结声明

- 本文件当前版本 **SPEC-1.3.0**，处于**执行期冻结**状态。
- 「轻易不可修改」的**具体含义**：
  1. 任何修订**必须**走 §12.2 的完整流程，**禁止**"顺手改一下"；
  2. **禁止**在功能任务的同一分支 / 同一提交里修改本文件（R14）；
  3. **禁止**模型单方面冻结新版本 —— 修订**必须**经**人类确认**后才能合并；
  4. 复杂性与收益明显不成比例的修订，**应当**直接拒绝（规范越长越容易自相矛盾）。

### 12.2 修订 SOP（七步，缺一不可）

| 步 | 动作 | 产出 |
|---|---|---|
| 1 | **立项**：按 §2.3 查重后分配一个**独立编号**（如 `J4.7-spec-revision`） | 任务分支 |
| 2 | **影响面清单**（**必须**写进实施结果文档） | ① 受影响的章节 ② 会被重新解读的既有 tag/分支/文档 ③ 与 `scripts/release.mjs` 的一致性影响 ④ 与 `VERSIONING-QA.md` 的同步点 |
| 3 | **一致性核对**：§11 命令表逐条与实际脚本行为对齐 | 差异清单（有差异则先修脚本或先修文档，不可两边都不动） |
| 4 | **人类确认**（★ 硬门槛） | 明确的批准记录 |
| 5 | **版本递增**（见 §12.3 规则） | 新的 SPEC 号 |
| 6 | **记录**：在 §12.4 修订历史追加一行（**只增不改**） | 修订历史 |
| 7 | **提交**：独立分支 + `--no-ff` 合并；提交信息前缀 `spec:` | 合并节点 |

### 12.3 版本递增规则

| 变更性质 | 递增 | 例 |
|---|---|---|
| 措辞澄清、补漏、修错别字（**不改变任何规则含义**） | **补丁位** | `SPEC-1.0.0` → `1.0.1` |
| **新增**规则（不改既有规则） | **次版本位** | `1.0.1` → `1.1.0` |
| **改变既有规则的含义或删改红线** | **主版本位**（且必须在 §12.4 写明迁移方案） | `1.1.0` → `2.0.0` |

### 12.4 修订历史（**只增不改**）

| SPEC 版本 | 日期 | 变更摘要 | 依据编号 |
|---|---|---|---|
| **1.0.0** | 2026-09-15 | 首版定稿：由 0.x 草案重构为**面向模型的执行规范**；新增 §1 红线 14 条（每条带判定命令）、§2 标识符命名空间账本（消除 `Jx.5` 撞号 / 版本序列歧义）、§3.5 分支删除安全性说明、**§9.3 R1 两层机械防护**（`exec` 拦截 + `pre-commit` 钩子，判例 P1 的直接对策）、§12 规范修订协议（冻结条款）；人类答疑拆分至 `VERSIONING-QA.md` | `J3.2` |
| **1.0.1** | 2026-09-16 | **补漏，不改变任何规则含义**：§11.1 新增 **§11.1.1**——pnpm 双重安装与 `.modules.yaml` 缺失的根因（三条实测事实）、开工前判别命令（两条）、以及「禁止用 `CI=true` 绕过 TTY 中止」的操作警告。同步：`VERSIONING-QA.md` 新增 Q18。本次是 §12.2 修订 SOP 的**首次完整执行**（含影响面清单与人类确认） | `J3.3` |
| **1.0.2** | 2026-09-16 | **补漏，不改变任何规则含义**：**废止 `task/<编号>` tag 形态** —— §2.1 命名空间账本由 9 个收敛为 **8 个**（该形态的工具与手工两条路径都不产生它，且功能与账本第 8 行「提交信息前缀」重复）；§2.5 把 `task/J3` 明确为**该形态的孤例**并写明保留理由；§3.6 生命周期表标为废止；§2.3 查重 ① 的用途改注为"历史占用检查"。同步：`VERSIONING-QA.md` Q2 的相应说明 | `J3.4` |
| **1.0.3** | 2026-09-16 | **补漏，不改变任何规则含义**：**删除孤例 tag `task/J3`**（经确认**从未推送**）并同步规范 —— §2.5 的处理决定由"保留不删"改为"**已于 2026-09-16 删除**"并附无损理由（同一提交仍被 `v0.3.0-dev.1` 引用 + 是 `dev` 祖先 = 双重可达）；§2.1 注、§3.6 生命周期表同步；§2.3 查重 ① 保留为防御性检查。删除**只走 `exec` 入口**并留痕。同步：`VERSIONING-QA.md` Q2 | `J3.6` |
| **1.1.0** | 2026-09-16 | ★ **新增规则**（次版本位）：**① §5.2 明确「发布合并时 `package.json` 必然冲突」**及其处理方式 —— 直接在冲突处写成正式版号并完成 merge ⇒ **不再需要单独的 `chore(release)` 提交**，豁免边界随之收窄为「`main` 上只允许一个 merge commit」；**② 新增「发布提交不回流 `dev`」**，并用「**回流的到底是什么**」把它与 §4.1 hotfix 区分开（hotfix 回流**代码修复**⇒必须；发布只回流**版本号 + 合并节点**⇒不需要），附判定命令 `git log --oneline dev..main`；**③ §5.3 阶段收尾清单由「四处」补全为「五处」**（补入路线图执行顺序状态表），§4④ 与判例 P4 同步。依据：`v0.3.0` 发布时**实测冲突** + `main` 已累积 4 个未回流提交 | `J3.8` |
| **1.2.0** | 2026-09-16 | ★ **新增规则**（次版本位）：**① §8.5 新增「变更类命令禁止用管道截断输出」** —— PowerShell 的 `Select-Object -First N` 会提前关闭管道并终止上游进程，使变更命令**静默失效**（判例 **P7**），附正确写法与「只读查询复核」判据；**② §2.3 查重 ② 修正** —— 由 `git log --grep=`（连**正文**一起搜 ⇒ 把"提及"误判为"占用"）改为**只匹配提交主题**；**③ §4⑥.1 新增「收尾实测结果回填」的轻量路径** —— 不另开编号、`-backfill` 后缀分支、不打新 tag、`docs(<编号>):` 前缀，并明确它**不违反 C2 与 C3**。附录 B 同步补入判例 P7 | `J3.10` |
| **1.3.0** | 2026-09-16 | ★ **新增规则**（次版本位）：**§8.6 新增「用 PowerShell 改文件会加 BOM」** —— `Set-Content -Encoding utf8` 会写入 `EF BB BF`；本仓库有逐字节判据，**被摘要守住的文件被加 BOM 会导致门禁报警且查不出原因**。给出两条正确写法（改用 node / `-Encoding utf8NoBOM`）与**三字节复核判据**，附录 B 补入判例 **P8**。同步：`VERSIONING-QA.md` 新增 Q21 | `J3.14` |

### 12.5 禁止事项（写规范时）

1. **禁止**使用不可判定的措辞（"可能" / "大概" / "建议考虑" / "视情况"）——每条规则都要能写成判定命令。
2. **禁止**同一条规则在两处重复描述（**单一事实来源**）。重复 = 迟早自相矛盾。
3. **禁止**删除或改写 §附录B 的事故判例——判例是规则的事实依据，改了判例等于推翻规则。
4. **禁止**在任务开发中途修改本文件（会使正在执行的任务失去判据）。发现规范有缺陷时：**先按现行规范做完，另开 `spec:` 任务修**。
5. **禁止**把"为什么"写进本文件——那是 `VERSIONING-QA.md` 的职责。

---

## 13. 违规处置

| 发现时点 | 违规类型 | 处置 |
|---|---|---|
| **收尾自检** | 禁 1（dev 上有开发提交） | 未推送：开分支"接"走提交 + `reset --hard`；已推送：**不得改写历史**，改用 `revert` 并在记录里留痕 |
| **收尾自检** | 禁 2（dev 上有正式 tag） | 该 tag **从未推送** ⇒ 可 `git tag -d`，**必须**在 `GitPushHistory.md` 写更正记录；**已推送** ⇒ 不得删除，走 §12 报规范缺陷 |
| **收尾自检** | R6/R7/R8（编号撞号、序列重用） | 删除错误 tag（若未推送）+ 用正确编号重打 + 写更正记录（判例 P3 就是这么做的） |
| **任意时刻** | R10（变更命令未走 exec） | 用 `record --ops="git …"` **补登记**，并在记录里说明是补的 |
| **任意时刻** | R12（记录被改写） | 从 `git` 历史里无法恢复的记录：**如实追加一条"记录曾被改动"的说明**，不得再改回去 |
| **任意时刻** | R13（父目录被 `git init`） | **立即**删除父目录的 `.git`；本仓库不受影响（它有自己的 `.git`） |
| **任意时刻** | R11（已推送历史被改写） | 联系所有克隆方重新 clone；**本仓库禁止此操作**，属最严重违规 |

> **处置的共同要求**：**留一条记录，说明发生了什么、为什么、怎么补救**。
> 判例 P1–P5 全部来自"如实记录 + 向前修正"，而不是"悄悄改回去"。

---

## 附录 A · 收尾自检清单（每次任务收尾**必须**逐条打勾）

| # | 检查 | 命令 | 期望 |
|---|---|---|---|
| A1 | 在任务分支上 | `git branch --show-current` | `task/<编号>-<短名>` |
| A2 | 工作区干净 | `git status --short` | 空 |
| A3 | 静态三件套全绿 | `node scripts/release.mjs verify <编号>` | 3/3 ✓ |
| A4 | **完整门禁六项**（人工） | `test:visual` / `test:smoke` / `test:perf` | 全绿，结论已写入结果文档 |
| A5 | `package.json` 版本已对齐 | `node -p "require('./package.json').version"` | 等于 §2.4 推出的下一个 `dev.N` |
| A6 | 实施结果文档已写 | `ls docs/实施结果/<编号>-实施结果.md` | 存在，含四节 |
| A7 | 编号未撞号 | §2.3 四条查重命令 | 本编号四处同名、无冲突 |
| A8 | 收尾后无 dev 直提 | `git log --oneline --no-merges "$(git describe --tags --abbrev=0 dev)..dev"` | 空 |
| A9 | 推送已完成 | `node scripts/release.mjs status` | dev/main 均 0 ahead、tag 全 ✓ |
| A10 | 阶段收尾时四处状态一致 | §5.3 清单 | 4/4 已改 |

## 附录 B · 事故判例索引

> 判例是**规则的事实依据**（禁止删改，见 §12.5）。完整叙述见 [`VERSIONING-QA.md`](./VERSIONING-QA.md) §四。

| 判例 | 事故 | 由此产生的规则 |
|---|---|---|
| **P1** | `J3` 的 6 个提交**直接落在 `dev` 上**（无任务分支、无合并节点）⇒ 无法用一条 `revert` 撤销 6217 行 / 35 个模块的改动，只能逐个挑提交 | **R1**（禁止 dev 直提）、**R4**（`--no-ff` 是硬规则）、§3.2 唯一判据、§4①/⑥ 不可跳步 |
| **P2** | `J3.1` 漏传 `--base`，脚本按任务号推断出 `v0.3.1-dev.1`，与 `J3` 的 `0.3.0-dev.N` 序列矛盾 | **§2.4 序列规则**、**R6/R8**、`--base` 硬规定 |
| **P3** | 打错的 tag `v0.3.1-dev.1`（**从未推送**）被删除并改打 `v0.3.0-dev.2`，在 `GitPushHistory.md` 留了更正记录 | §13 违规处置的**正确示范**：留痕 + 向前修正 |
| **P4** | 阶段状态在**五处副本**（§5.4 表 / README / 路线图总表 / 路线图章节标题 / 路线图执行顺序表）各有一份，历史上多次漏同步 | **§5.3 阶段收尾清单**（SPEC-1.1.0 由"四处"补全为"五处"）；状态只允许三种取值 |
| **P5** | **2026-09-14**：`J2` 阶段收尾后 `main` 的 **37 个提交**与 **11 个 tag** 静静躺在本地，而记录上"看不出少做了什么"（任务级 `done` 只生成 dev 的推送命令，阶段收尾又漏跑 `ship`） | **R11 姊妹条款**（推送是流程的一部分）、§4⑦、§5.2、§9.2「无法确认 ≠ 未推送、仍必须列出」 |
| **P6** | `J2.5` **撞号**：`Jx.5` 同时被"阶段内第 5 个任务"与"插层子阶段"使用，两义均已归档 | **§2 标识符命名空间账本**、**C1**（阶段内任务跳过序号 5）、**R7** |
| **P7** | **管道截断导致变更命令静默失效**：`J3.8` 收尾用 `Select-Object -First 1` 截断输出，`switch`/`merge`/`tag -a`/`branch -d` **四条命令全部未生效**（tag 根本没创建，事后 `git tag -d` 报 `tag not found` 才证实），而输出看起来"都成功了" | **§8.5**（变更类命令禁用管道截断 + 用只读查询复核）；与 §11.1 的受限环境注意事项并列 |
| **P8** | **PowerShell 改文件会加 BOM**：`J3.12` 用 `Set-Content -Encoding utf8` 清理 `GitPushHistory.md` 时，文件前 3 字节从 `35,32,71` 变成 `239,187,191`（已用 node 重写剥离）。该文件在 `.gitignore` 内、**不受判据保护**才没酿成事故 | **§8.6**（改用 node 或 `-Encoding utf8NoBOM` + 三字节复核判据）；这正是 §8 警告的"被摘要守住的文件被改写却查不出原因" |

---

**规范结束。**
任何与本文件冲突的做法，以本文件为准；本文件与 `scripts/release.mjs` 的实际行为冲突时，**以脚本为准并立即按 §12 报修订**。
