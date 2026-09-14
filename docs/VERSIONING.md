# 版本管理规范（Git 分支 / 版本号 / 发布与回滚）★ 强制执行

> 本文档是**版本管理的唯一入口**：分支怎么用、版本号怎么定、一个开发任务如何变成一个版本、
> 出错怎么退回去。制定依据是 [`BuildPlaning/01-完善路线图.md`](./BuildPlaning/01-完善路线图.md)
> 的执行原则 3「**一步一提交，一提交一验证**」——本文把它放大到**一个开发任务 = 一个版本**。
>
> 路线图回答"**做什么、按什么顺序做**"；本文只回答"**做完之后怎么留下一个可回退的版本**"。
>
> ★ **后续所有阶段的开发都必须遵守本文流程。** 流程已工具化（`scripts/release.mjs` + git 钩子）：
> 不必记命令，跑 `pnpm task:start` / `pnpm task:done` / `pnpm ship` 即可，动作会自动记入
> `GitPushHistory.md`（见 §11、§12）。

---

## 0. TL;DR

```bash
# 一个任务 = 一条分支 + 一次 --no-ff 合并 + 一个 -dev.N tag
git switch -c task/J2.1-camera-rig
# …… 开发，跑门禁 ……
git switch dev && git merge --no-ff task/J2.1-camera-rig -m "merge J2.1 CameraRig"
git tag -a v0.2.0-dev.1 -m "J2.1 CameraRig 完成（开发版）"

# 一个阶段验收通过 = dev 合进 main + 去掉 -dev 后缀的正式 tag
git switch main && git merge --no-ff dev -m "release: v0.2.0（J2 小屋核心设施）"
git tag -a v0.2.0 -m "J2 小屋核心设施"
```

**核心规矩一句话**：**只有 `main` 上的 commit 才配叫「稳定版」**；`dev` 上的东西永远是「开发版」，哪怕门禁全绿。

**推荐直接用工具**（命令细节见 §11，每个动作都会自动记入 `GitPushHistory.md`）：

```bash
pnpm task:start J2.1 camera-rig   # ① 开任务分支（自动前置检查 + 记录）
# …… 开发 ……
pnpm task:done J2.1               # ② 门禁 → 合并回 dev → 打 v0.2.0-dev.N tag → 记录
pnpm ship                         # ③ 生成待人工执行的推送命令（工具绝不自动 push）
pnpm git:status                   # ④ 随时查看分支 / 未推送 / tag 同步状态（只读）
```

---

## 1. 分支模型

```
origin/main   ← 稳定版：永远能 build、能 serve、能玩、门禁全绿
     ▲
     │  发布：任务/阶段验收通过才合并（--no-ff），合并后打正式 tag
     │
origin/dev    ← 开发版：日常开发主线，允许处于「做了一半」的状态
     ▲
     │  完成：任务做完即合并回 dev（--no-ff，保留任务边界），打 -dev.N tag
     │
task/J2.1-camera-rig   ← 一次性分支：一个开发任务一条，用完即删
```

| 分支 | 角色 | 允许直接 push | 生命周期 |
|---|---|---|---|
| `main` | **稳定版**。只接受来自 `dev`（或 `hotfix/*`）的 `--no-ff` 合并 | ❌ 不直接提交 | 永久 |
| `dev` | **开发版**。日常开发主线，所有任务分支从这里切、合回这里 | ✅ | 永久 |
| `task/<任务号>-<短名>` | 单个开发任务 | ✅（自己的分支） | 任务合并后删除 |
| `hotfix/<版本号>` | 稳定版紧急修复（从 `main` 切，修完双向合并） | ✅ | 修完删除 |

### 为什么不用长期 `release` 分支

tag 已经能永久冻结任意 commit，而且**不会和后续开发打架**。多一条长期分支只会多一份需要同步的状态，
对单人项目是纯负债。**版本快照一律用 tag，不用分支。**

---

## 2. 版本号规范

版本号**沿用项目已有的 `J` 编号做主轴**，不另起一套。`package.json` 的 `version` 必须与最近一次 tag 一致。

| 阶段 | 版本号 | 说明 |
|---|---|---|
| `F0.2`–`F0.6` | `0.1.2` … `0.1.6` | **补丁位** = 保障性任务（护栏，不新增玩法） |
| `J1.5` | `0.1.5` | Astro 落地 |
| `J2` | `0.2.0` | 小屋核心设施 |
| `J2.5` | `0.2.5` | 配置编排层 |
| `J3` | `0.3.0` | 物件模块化 |
| `J4` | `0.4.0` | 系统模块化（删 `legacy/`） |
| `J5` | `0.5.0` | 内容管线与静态页 |
| `J6` | `0.6.0` | 书架即博客 + 方案 B 阅读器 |
| `J7` | `0.7.0` | 功能模块增量（17+） |
| `J8` | `0.8.0` | 升级与调优 |
| 第一个可对外发布的版本 | `1.0.0` | 达到「完全独立、以 3D 场景为主页的静态博客」定位 |

- **次版本位（`0.x`）** = 新增功能模块（一个 `J` 阶段）
- **补丁位（`0.x.y`）** = 修复、护栏、纯文档、纯重构
- **预发布后缀 `-dev.N`** = 开发版快照，**只打在 `dev` 上**

### 2.1 tag 类型

| tag | 打在哪 | 何时打 | 用途 |
|---|---|---|---|
| `v0.2.0-dev.1` | `dev` | 每个任务合并回 `dev` 时 | 任务级快照，细粒度回滚 |
| `task/J2.1` | `dev` | 同上（可选，便于人读） | 让 `git log` 一眼看到任务号 |
| `v0.2.0` | `main` | 阶段/子阶段验收通过时 | **正式版本**，能给别人、能部署 |

> ⚠️ **绝不在 `dev` 上打正式版本号**（不带 `-dev` 的那种）。否则「稳定版」这个词就没有意义了。

---

## 3. 一个开发任务的标准流程（SOP）

以 `J2.1 CameraRig` 为例。前提：当前在 `dev`，且 `dev` 是干净的。

### ① 开任务分支

```bash
git switch dev && git pull
git switch -c task/J2.1-camera-rig      # 名字带任务号，与 docs/ 文档同号
```

### ② 开发

写代码；同时按 [`J1.5-实施结果.md`](./J1.5-实施结果.md) 的格式准备 `docs/J2.1-实施结果.md`。

### ③ 跑门禁（见 §5 分级，任务级必须全绿）

```bash
pnpm typecheck
pnpm verify
pnpm build
pnpm serve            # 另开一个终端，下列三条依赖它托管 dist/
pnpm test:visual      # 画面有没有被改坏
pnpm test:smoke       # 还能不能玩
pnpm test:perf        # 有没有悄悄变慢
```

### ④ 补齐记录 + 对齐版本号

- `docs/J2.1-实施结果.md`（DoD 核对 / 落点 / 门禁项数 / 遗留与交接）
- `package.json` 的 `version` → `0.2.0-dev.1`
- 若是阶段收尾，同步更新根 `README.md` 顶部的「当前阶段」

### ⑤ 提交（信息带任务号，历史才能自解释）

```bash
git add -A
git commit -m "J2.1 CameraRig：统一相机运动与视角切换

- 落点：src/cabin/app/camera-rig.js
- 门禁：typecheck / verify / visual / smoke / perf 全绿
- 验收：见 docs/J2.1-实施结果.md"
```

> 建议沿用路线图的粒度：**一个文件一次提交**，让 `git log` 能直接回答「这个文件是什么时候、为哪个任务改的」。

### ⑥ 合并回 `dev` 并打开发版 tag

```bash
git switch dev
git merge --no-ff task/J2.1-camera-rig -m "merge J2.1 CameraRig"
git tag -a v0.2.0-dev.1 -m "J2.1 CameraRig 完成（开发版）"
git tag -a task/J2.1 -m "J2.1"
git push origin dev --follow-tags
git branch -d task/J2.1-camera-rig
```

> **`--no-ff` 是关键**：它让每个任务在历史上是一个**独立可识别的合并节点**。
> 将来要撤掉某个任务，一条 `git revert -m 1 <merge>` 就够，不需要手工挑文件。

---

## 4. 发布：`dev` → `main`

**不要每个任务都发稳定版**——那会让版本号变成噪音。触发条件二选一：

1. 一个 `J` 阶段（或 `.5` 子阶段）验收通过；
2. 出现**用户可感知**的成果（例如「书架上的书能打开、能在书页里读完一篇文章」）。

```bash
git switch dev && git pull
git switch main && git pull
git merge --no-ff dev -m "release: v0.2.0（J2 小屋核心设施）"

# 去掉 -dev 后缀：package.json version → 0.2.0
git commit -am "chore(release): v0.2.0"
git tag -a v0.2.0 -m "J2 小屋核心设施：CameraRig + 统一 Interactable + 持久化 + 内核"
git push origin main --follow-tags

git switch dev        # ★ 立刻回到 dev，别在 main 上写代码
```

发布说明直接引用 [`BuildPlaning/01-完善路线图.md`](./BuildPlaning/01-完善路线图.md) §5.3 的量化指标，例如：

```
v0.2.0（J2）
- src/cabin/legacy/monolith.js 行数：8965 → 0
- 已登记 Interactable：0 → 73
- 四条门禁：visual 3 机位逐字节一致 / smoke 28/28 / perf 阈值内 / verify 全绿
```

### 4.1 hotfix（稳定版出事了）

```bash
git switch -c hotfix/0.2.1 main
# …… 修复 + 门禁 ……
git commit -am "fix: ..."
git switch main && git merge --no-ff hotfix/0.2.1
git tag -a v0.2.1 -m "hotfix: ..."
git push origin main --follow-tags

git switch dev && git merge --no-ff hotfix/0.2.1    # ★ 别让修复只留在 main 上
git branch -d hotfix/0.2.1
```

---

## 5. 门禁分级：什么时候跑什么

| 时机 | 命令 | 理由 |
|---|---|---|
| 每次提交前（可选 hook） | `pnpm typecheck` + `pnpm verify` | 秒级静态校验，挡住绝大多数低级错误 |
| **任务完成时（必做）** | 上面 + `pnpm build` + `test:visual` + `test:smoke` + `test:perf` | 这就是任务的 DoD，全绿才算完成 |
| 发布到 `main` 前（必做） | `pnpm verify:visual`（3 轮零差异）+ 完整门禁 | 稳定版必须比任务级更严 |
| CI（每次 push / PR） | `pnpm typecheck` → `pnpm verify` → `pnpm build` | 见 `.github/workflows/ci.yml` |

> **`test:visual` / `test:perf` / `test:smoke` 的前置**：先 `pnpm build` 再 `pnpm serve`（托管 `dist/`）。
> 想验证零构建兜底走 `pnpm serve:legacy`，单文件产线走 `pnpm serve:single` —— 测试脚本会自动识别首页形态。
>
> **CI 与本地后端不同**：CI 是 `swiftshader`，本地可能是 `gpu`。性能基线分两套
> （`perf.json` / `perf.gpu.json`，`baseline.md` / `baseline.gpu.md`），**不要混用**。

---

## 6. 回滚：三档，按慌乱程度选

```bash
# 第 1 档：某个任务做坏了，但还没发版
git switch dev
git revert -m 1 <该任务的 merge commit>     # 生成反向提交，历史完整留痕

# 第 2 档：稳定版出事了，立刻回到上一个能玩的版本
git switch main
git revert <坏的 commit>                     # ★ 千万别用 reset —— main 已被 push
git tag -a v0.2.1 -m "hotfix: ..."

# 第 3 档：只想看看 / 跑一下某个历史版本（不切分支）
git switch --detach v0.1.5
pnpm install && pnpm build && pnpm serve     # 上个稳定版就地跑起来
git switch dev                               # 看完回来
```

> 这正是 `v0.1.5` 这类基线 tag 的价值，也是**它取代 `FrontProj/Backup/*.zip` 的原因**：
> zip 是「以防万一」，tag 是「随时可回到那一版并真的跑起来」。

---

## 7. 仓库边界（★ 不要踩的坑）

`Magic-cabin` **自身就是仓库根**，它嵌在 `D:\FireflyQAQ\Project\FrontProj\` 下，
而 `README.md` 引用了仓库外的相对路径（`../docs/improve/`、`../docs/ArtLine-Part/`、`../Test/`）。

> ❌ **绝对不要在 `D:\FireflyQAQ\Project` 或 `FrontProj\` 再 `git init`。**
>
> 那样 `Magic-cabin` 会变成嵌套仓库 / gitlink，第 3 节的「一个任务一个版本」边界会全部失效——
> 父仓库只记录一个 commit 指针，子仓库的历史、tag、分支都不再受父仓库保护。

父目录的规划文档继续以普通文件形式被本文档引用即可，**不纳入版本控制**。

---

## 8. 换行符与二进制（`.gitattributes` 存在的理由）

本仓库有**逐字节判据**：`tests/baseline/cabin-digest.json`（`src/cabin/**` 摘要）、
`tests/visual/baseline/*.png`（截图 sha256）。因此：

- `.gitattributes` 用 `* -text` **全局关闭换行符转换**——工作区内容与库中内容字节一致，
  跨平台 checkout 不会改写任何文件的字节；
- **不要**改成 `* text=auto`，也不要把 `core.autocrlf` 设成 `true`：那会悄悄改写被摘要守住的文件，
  让门禁报警却查不出原因。
- `*.png` / `*.mp3` 显式声明为 binary，避免 diff 噪音。

### 8.1 不要给 `package.json` 加 `packageManager` 字段（实测坑）

本仓库用 **pnpm 12**，而 pnpm 12 一旦读到 `package.json` 的 `packageManager` 字段，
就会**重写 `pnpm-lock.yaml`**：插入「包管理器自身依赖」（`@pnpm/exe` 的各平台二进制条目，
实测 +120 行），lockfile 无谓膨胀，还会让 CI 的 `pnpm install --frozen-lockfile` 面临失败。

**所以 pnpm 版本固定在 `.github/workflows/ci.yml` 里显式声明**（`pnpm/action-setup` 的 `version`），
不要在 `package.json` 里引入该字段。lockfile 是判据的一部分，不接受这种副作用。

---

## 9. 版本历史

| 版本 | tag | 内容 | 日期 | 状态 |
|---|---|---|---|---|
| `0.1.5` | `v0.1.5` | `J0` 基线与护栏 + `J1` 工程化骨架 + `J1.5` Astro 落地 | 2026-09-14 | ✅ **稳定版** |
| `0.2.0` | `v0.2.0` | `J2` 小屋核心设施 | — | ⬜ 计划 |
| `0.2.5` | `v0.2.5` | `J2.5` 配置编排层 | — | ⬜ 计划 |
| `0.3.0` | `v0.3.0` | `J3` 物件模块化 | — | ⬜ 计划 |
| `0.4.0` | `v0.4.0` | `J4` 系统模块化 | — | ⬜ 计划 |
| `0.5.0` | `v0.5.0` | `J5` 内容管线与静态页 | — | ⬜ 计划 |
| `0.6.0` | `v0.6.0` | `J6` 书架即博客 + 方案 B 阅读器 | — | ⬜ 计划 |
| `0.7.0` | `v0.7.0` | `J7` 功能模块增量 | — | ⬜ 计划 |
| `0.8.0` | `v0.8.0` | `J8` 升级与调优 | — | ⬜ 计划 |
| `1.0.0` | `v1.0.0` | 对外发布 | — | ⬜ 计划 |

---

## 10. 常用查询

```bash
git tag -l -n1                          # 所有版本 + 说明
git tag -l -n1 --sort=-v:refname        # 按版本号倒序
git log --oneline --decorate --graph --all -20   # 分支与 tag 全景
git describe --tags                     # 当前 HEAD 相对最近 tag 的位置
git log v0.1.5..HEAD --oneline          # 基线之后都干了什么
git log --oneline --grep="J2.1"         # 某个任务的全部提交
git show v0.1.5 --stat                  # 某个版本改了什么
```

---

## 11. 版本管理命令速查（★ 工具化）

流程已封装成 `scripts/release.mjs`，通过 `package.json` 脚本调用。**不需要记 git 命令细节**，
每个动作都会自动追加到 `GitPushHistory.md`（§12）。

| 命令 | 作用 | 会做的事 |
|---|---|---|
| `pnpm task:start J2.1 camera-rig` | 开任务分支 | 前置检查（是否在 `dev`、工作区是否干净、`dev` 是否有未推送）→ `git switch -c task/J2.1-camera-rig` → 追加记录 |
| `pnpm task:verify J2.1` | 跑门禁并记录 | `typecheck + verify + build`，逐项记录耗时与结果（`-- --quick` 只跑前两项） |
| `pnpm task:done J2.1` | 收尾一个任务 | 校验工作区干净 → 跑完整门禁 → `git merge --no-ff` 回 `dev` → 打 `v0.2.0-dev.N` tag → 删任务分支 → 追加记录与推送命令 |
| `pnpm git:status` | 仓库状态总览 | 分支 / HEAD / 工作区 / 未推送提交 / 每个 tag 的同步状态。**只读，不改任何文件** |
| `pnpm ship` | 生成推送命令 | 按实际 git 状态生成**待人工执行**的 push 命令并追加记录。**绝不执行 push** |
| `pnpm ship main` | 生成发布计划 | `dev` → `main` 的合并 + 正式版 tag 的一整套命令（含要手工改的 `package.json` version） |
| `pnpm git:history` | 查看自动记录区 | 打印 `GitPushHistory.md` 的追加记录 |
| `pnpm git:sync` | **幂等补记** | 把最近若干提交中尚未记录的补进时间轴；已记过的不会重复追加 |
| `pnpm hooks:install` | 安装 git 钩子 | 把 `scripts/hooks/*` 装到 `.git/hooks/`（换机器 / 重新 clone 后跑一次） |

**`pnpm task:done` 等价于手工执行**（§3 的 ③④⑤⑥ 步），它是推荐路径。

> **推送永远由人工执行。** 工具只生成命令：SSH 推送在不同环境下表现不一致
> （实测受限沙箱里 `ssh.exe` 报 `couldn't create signal pipe, Win32 error 5`），
> 交给人工在普通终端执行最可靠。工具会在能**证明**命令已执行时自动把 `[ ]` 翻成 `[x]`。

---

## 12. 自动记录与 `GitPushHistory.md`

### 12.1 它是什么

`GitPushHistory.md` 是**本地专用的 Git 操作流水**：每阶段的 commit / tag / branch / push 命令与结果，
以及**等待人工执行的命令**。它在 `.gitignore` 里，**不上传 GitHub**，但保留在工作区。

### 12.2 维护铁律（工具严格遵守）

1. **只增不改**：历史记录一旦写入就不再修改，新记录追加在末尾。
2. **唯一允许的原地改动**：把**已执行**命令的 `[ ]` 翻成 `[x]`（完成标记）。
3. **标记不猜**：只有 git 状态能证明命令确实执行了才翻；证明不了就保持 `[ ]`。
4. **推送由人工执行**：工具绝不自动 push。
5. 失败与报错如实记录——否则下次还会踩同一个坑。

### 12.3 自动记录怎么发生

`scripts/hooks/` 下有两条钩子，`pnpm hooks:install` 安装到 `.git/hooks/`：

| 钩子 | 触发时机 | 记录内容 |
|---|---|---|
| `post-commit` | 每次 `git commit` 成功后 | 分支 / HEAD / 提交主题 / 该 commit 上的 tag |
| `post-merge` | 每次 `git merge` 成功后 | 同上（git 在 merge 时执行 post-merge 而非 post-commit，两者不会重复） |

钩子的设计原则是**绝不阻塞 git**：输出全部丢弃、任何异常都以 `exit 0` 收场、
且**跳过一切网络请求**（否则每次提交都要等 `ls-remote`，断网时会一直挂着）。

> ⚠️ `.git/hooks/` 不受版本控制，clone 不到新机器 —— 所以钩子源文件放在 `scripts/hooks/` 并提交，
> 换环境后跑一次 `pnpm hooks:install` 即可恢复自动化。
>
> ⚠️ **钩子可能在受限环境里跑不起来**：Git 执行 hook 时会用 `sh.exe`，而禁止创建命名管道的
> 沙箱会让它直接 `fatal error - couldn't create signal pipe`（实测）。此时记录**不会**丢失——
> 用 `pnpm git:sync` 补记即可，它是幂等的，重复执行不会产生重复条目。建议把它当作
> 每阶段收尾的固定收尾动作：`pnpm git:sync && pnpm ship`。

### 12.4 命令执行状态是怎么判定的

| 命令 | 判定依据 | 翻成 `[x]` 的条件 |
|---|---|---|
| `git push origin main …` | 本地远端跟踪引用 | `origin/main` 存在 且 `main` 不 ahead |
| `git push -u origin dev` | 同上 | `origin/dev` 存在 且 `dev` 不 ahead |
| `git push origin v0.2.0` | 远端 tag 列表 | `git ls-remote` 确认该 tag 已在远端 |
| 其他命令 | —— | **不自动标记**（人工判断） |

**受限环境的表现**：在禁止创建命名管道的沙箱里 `git ls-remote` 必定失败（exit 128），
此时脚本把 tag 状态标为 **`?` 未验证**，而**不是**「未推送」——
这两者含义完全不同，不要混为一谈。

```powershell
# 人工确认 tag 是否已推送（在能联网的普通终端执行）
git ls-remote --tags origin
```

### 12.5 强制红线

| # | 红线 | 为什么 |
|---|---|---|
| 1 | 不在 `main` 上直接开发 | `main` 是稳定版；所有改动经 `dev` 合并进来 |
| 2 | 不在 `dev` 上打正式版 tag（不带 `-dev` 的那种） | 否则「稳定版」失去意义 |
| 3 | 任务收尾必须走 `pnpm task:done`（或手写等价流程） | 保证「一个任务 = 一个可回退的版本」边界 |
| 4 | 门禁未全绿不合并 | 视觉 / 冒烟 / 性能基线是判据，不是装饰 |
| 5 | 不改写已推送的历史（`push --force` 到 `main`/`dev`） | 会让他人和 CI 的引用失效 |
| 6 | 不在 `FrontProj/` 或 `Project/` 再 `git init` | 见 §7，会把本仓库变成 gitlink |
| 7 | `GitPushHistory.md` 只增不改（除 `[ ]`→`[x]`） | 它是交接凭据，改了就失去可追溯性 |
| 8 | 不给 `package.json` 加 `packageManager` 字段 | 见 §8.1，会重写 lockfile |
