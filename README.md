# 魔法小屋 · Magic-cabin

> **线稿风格 3D 魔法小屋** —— 从 9811 行单文件重构为模块化工程，
> 并最终成为一个**完全独立、以 3D 场景为主页的静态博客**。
> 操控一只软软的史莱姆在魔法小屋里生活：昼夜循环、7 种天气、120+ 可交互物件、24 层魔法阵与超位爆裂魔法；
> **书架上的书 = 我写的文章，点开就在书页里读**。

**当前阶段：`J3` 物件模块化 ✅ 已完成**（基础设施 100% + 35/67 件搬迁，其余 32 件因四类结构性阻塞交由 `J4`；含 `J3.1` 交互通路回归修复 —— 见 [`docs/实施结果/J3-实施结果.md`](./docs/实施结果/J3-实施结果.md)、[`J3.1-实施结果.md`](./docs/实施结果/J3.1-实施结果.md)）
**当前稳定版：`v0.3.0`**（tag `v0.3.0`，开发主线在 `dev` 分支；本阶段任务快照 `v0.3.0-dev.1`–`dev.7` —— 见 [`docs/VERSIONING.md`](./docs/VERSIONING.md)）
下一步：**`J4` 系统模块化**（player / weather / audio / magic / ui，最后删除 `legacy/`）——
`J3` 剩下的 32 件里有四类结构性阻塞（每帧分支与主循环耦合 / 光源槽位 / `addStatic` 链 / 自建射线），
解锁条件逐件留痕在结果文档 §3 与 `scripts/oneoff/_j3-specs/*.SKIP.md`；
`J3`/`J3.1` 交接的既有缺口（含**镜面涟漪**）另见路线图 `J4` §「J4 承接的既有缺口」。

`J3` 把「一件物件 = 一个文件」落成了流水线：**契约**（`app/defineProp.js`）+ **装配器**（`app/installProp.js`）
+ **挂载点 ID 表**（`app/mounts.js`）+ **搬迁应用器**（`scripts/oneoff/_j3-apply.mjs`），
并用 35 件物件验证到像素逐字节零差异（`legacy/monolith.js` 8973 → 6217 行）。
它也补上了一条**没有任何测试守得住**的通路：
搬走 `regMagic` 之后，若不同时补上 `magicMeshes` + `userData.onClick`，物件会「点不动」而画面毫无变化 ——
`tests/e2e/j3-probe.mjs` 与 `registry.stats().magicPropIds`（26 件）就是为它造的判据。

> ★ **`J3.1`（2026-09-15）修了这条通路的两个回归**（均由用户实机实测发现）：
> ① `J2.6` 契约改名漏改一处 ⇒ **第一人称下左键点击全部失效**（`aimHit.act()` 抛 `TypeError`）；
> ② aim 桥"一件物件只认一个 `root`" ⇒ 餐桌煎蛋盘 / 松饼盘 / 碗叠等**多个部件点不动**，
> 衣柜挂衣还被覆盖成"拉抽屉"。
> 契约因此扩成「**每条交互可声明 `hits`**」（省略即沿用物件根，已搬物件行为不变），
> 判据也从"每件物件"**下沉到每条 `Interactable`**：`registry.stats().aimMissing` 必须为空
> （当前 35 条交互各有 aim 入口）。详见 [`docs/实施结果/J3.1-实施结果.md`](./docs/实施结果/J3.1-实施结果.md)。
画面与性能**与阶段开始前完全相同**：

| 判据 | 结果 |
|---|---|
| 像素回归 | 3 机位 sha256 **逐字节相同**（`J3` 每批都跑；`J2.5` 3/3、`J2` 全程 10/10 次） |
| 交互冒烟 | **32 / 0**（`J3` 各轮全绿；`J3.1` 新增第一人称交互段） |
| 性能 | 3138 calls / 86158 tris —— **+0.0%**，一个指标都没动 |
| 单元测试 | **179 项**（零新依赖，Node 内置 `node:test`） |

搬迁**只搬位置，不改实现** —— 页面表现与重构前完全一致，而且**可以机器证明**，六条安全网各司其职：

| 命令 | 回答的问题 |
|---|---|
| `pnpm test:visual` | 画面**有没有被改坏**（3 机位 × 基线 sha256 逐字节比对） |
| `pnpm test:smoke` | 还能**不能玩**（28 项交互断言，manual 时钟下可复现） |
| `pnpm test:perf` | 有没有**悄悄变慢**（draw calls / triangles 等硬指标） |
| `pnpm test:unit` | 契约有没有被破坏（**151 项**，含"新增一盏灯/一个交互 = 改 1 处"的 DoD 证明与设置面板的生成/绑定） |
| `pnpm verify` | 静态校验**七件套**（含 `verify:j15` 的 `src/cabin/**` 摘要、依赖不变量与 **`verify:cf` 的配置编排专项**） |
| `pnpm verify:cf` | **配置层有没有被绕过**（`CF1`–`CF4`：总开关 / schema 驱动 / 清单一一对应 / `config` 是叶子 —— `J2.5` 新增，31 项） |

前三条是 `J3` 那 67 件物件搬迁的前提 —— 没有它们，每次改动都只能靠肉眼猜；
`test:unit` 是 `J2` 新增的：**契约与坐标的自洽性**不再依赖人工审查；
`verify:cf` 是 `J2.5` 新增的：**"用户唯一需要看的目录"不会在后续阶段被悄悄绕过**。

> ★ **接下来的路线与每个功能模块的映射，全部在 [`docs/BuildPlaning/`](./docs/BuildPlaning/README.md)。**
> 那里是"做什么、按什么顺序做、每个模块挂到哪件物品上"的唯一入口；
> 本文档只讲**怎么跑起来**。

---

## 快速开始

`J1.5` 起，**主产线是 Astro**（站点 + 内容），3D 仍是原生 ESM 且**一行未改**。

```bash
pnpm install

# 方式 A：Astro 开发服务器（主力路径，正常环境）
pnpm dev                # → http://localhost:4321

# 方式 B：构建产物 + 本地托管（★ 视觉/冒烟/性能测试请用这一条）
pnpm build              # → dist/（Astro 静态产物）
pnpm serve              # → http://127.0.0.1:5173，托管 dist/

# 方式 C：零构建兜底（不需要任何打包器）
pnpm serve:legacy       # → http://127.0.0.1:5173，托管仓库根（index.html + src/main.js）

# 方式 D：第二条产线（离线分发用，OD-2 选项①）
pnpm build:single && pnpm serve:single   # → dist-single/，3D 正常、回归全绿
```

> **受限环境请用方式 C**：Astro 与 Vite 都依赖 esbuild，而 esbuild 需要 spawn 子进程并用管道通信，
> 在禁止命名管道的沙箱中会报 `spawn EPERM`（环境限制，非项目问题）。
> 方式 C **完全不经过打包器**，是那条环境里唯一能跑起来的路径 ——
> 所以 `scripts/serve.mjs --legacy` 与根 `index.html` **不会被删除**。
>
> **三条产线跑的是同一份 3D 代码**：`dist/`、零构建、`dist-single/` 都通过了同一套截图基线
> （3 机位 sha256 **逐字节相同**），后两者还各自通过 28/28 冒烟。
>
> ⚠️ `dist-single/` **不能靠双击打开**（`file://` 下模块脚本被 CORS 拦，是浏览器规则）。
> 它当前的定位是"离线分发的相对路径产物"，"双击即玩"留给 `J8.6` 定稿 —— 见
> [`docs/实施结果/J1.5-实施结果.md`](./docs/实施结果/J1.5-实施结果.md) §5。

## 本地服务管理

零构建服务器默认**前台运行**（`Ctrl+C` 即停，不产生孤儿进程）。

| 命令 | 说明 |
|---|---|
| `pnpm serve` | 启动（前台，端口默认 5173） |
| `pnpm serve:open` | 启动并自动打开浏览器 |
| `pnpm serve:lan` | 监听 `0.0.0.0`，手机等局域网设备可访问 |
| `pnpm status` | 查看运行状态（地址 / PID / 运行时长 / HTTP 响应） |
| `pnpm stop` | 停止服务（发送终止信号并**轮询确认进程已退出**） |

**其它特性**

- **端口占用自动顺延**：5173 被占用时自动尝试 5174、5175…（最多 10 个），不会崩溃
- **状态文件**：`.cache/serve.json` 记录 `{ pid, port, url, startedAt }`，供 `status` / `stop` 使用
- **优雅退出**：`Ctrl+C` 打印运行时长与请求数后清理退出
- **参数覆盖**：`node scripts/serve.mjs --port=8080 --host --open --quiet`

> `stop` 使用 Node 内置的 `process.kill` 而非 `taskkill` —— 外部命令在受限环境中可能被拒绝
> （实测 `taskkill` 返回 `Access denied`，而 `process.kill` 正常）。信号发出后会**轮询验证**进程
> 是否真正退出，失败时保留状态文件并返回非零退出码，不会出现「报告成功但进程还在」。

## 常用命令

| 命令 | 说明 |
|---|---|
| `pnpm dev` | Astro 开发服务器（4321，HMR） |
| `pnpm build` | **主产线**：Astro 构建 → `dist/` |
| `pnpm preview` | Astro 预览 `dist/` |
| `pnpm build:single` | 第二条产线：单文件构建 → `dist-single/`（OD-2 选项①） |
| `pnpm serve` | 本地托管 `dist/`（产物模式，端口默认 5173） |
| `pnpm serve:legacy` | 本地托管仓库根（**零构建兜底路径**，不经过任何打包器） |
| `pnpm serve:single` | 本地托管 `dist-single/` |
| `pnpm typecheck` | TypeScript 检查（`allowJs`，覆盖搬迁代码 + `tests/**/*.mjs` + `.astro` 外的全部源码） |
| `pnpm sync` | `astro sync`：生成内容集合类型到 `.astro/`（`pnpm dev` / `pnpm build` 会自动跑） |
| `pnpm verify` | **全部静态校验**：**`J1.5` 75** + 搬迁一致性 22 + `F0.2` 23 + `F0.3` 23 + `J0.4` 31 + `J0.6` 34 |
| `pnpm verify:j15` | ★ **`J1.5` 门禁**：构建形态 / 一个岛 + 不变量 `N12` / 内容集合 / 门厅 / 兜底路径 / 双管线 / **`src/cabin/**` 逐字节摘要**（`--built` 追加产物断言） |
| `pnpm verify:visual` | ★ **截图回归 DoD**：3 机位 × 连续 3 轮，轮间必须零差异（需先 `pnpm build && pnpm serve`） |
| `pnpm test:visual` | 与截图基线比对（搬迁/改动后跑这个；自动识别产物与零构建两种形态） |
| `pnpm test:smoke` | ★ **交互冒烟**：进小屋 / 开门 / 点壁炉 / 切 3 视角 / 点书籍物件 / 切天气 / 退出（28 项断言） |
| `pnpm test:perf` | ★ **性能回归判定**：与 `docs/baseline.md` 的基线比对（渲染统计阈值 10%） |
| `pnpm baseline:visual` | 重建截图基线（⚠️ 先人工审查画面，不要盲目接受差异） |
| `pnpm baseline:perf` | 重建性能基线（⚠️ 换机器/换渲染后端后必须重建） |
| `pnpm verify:determinism` | 连拍 3 次断言场景确定性（`F0.2` + `F0.3` 的旧入口） |
| `pnpm analyze:png` | 零依赖 PNG 像素分布分析（确认截图不是空白页） |
| `node scripts/verify-runtime.mjs` | 运行时 DOM 校验（11 项，需先导出 headless DOM） |

> ⚠️ **`J1.5` 之后，三条测试命令的前置变了**：先 `pnpm build` 再 `pnpm serve`（托管产物）。
> 想验证零构建兜底，则用 `pnpm serve:legacy`；想验证单文件产线，则用 `pnpm serve:single`。
> 测试脚本通过 `tests/e2e/page.mjs` 自动识别首页形态，**不需要额外参数**。

---

## 版本管理（一个开发任务 = 一个版本）

日常开发在 **`dev`**（开发版）上，`main` 只存**稳定版**；每个任务一条 `task/<任务号>` 分支，
合并回 `dev` 时打 `-dev.N` 预发布 tag，阶段验收通过才合进 `main` 并打正式版本号。

```bash
git switch dev
git switch -c task/J2.1-camera-rig          # ① 开任务分支（名字带任务号）
# …… 开发 + 跑门禁 ……
git switch dev
git merge --no-ff task/J2.1-camera-rig      # ② 合并回 dev，保留任务边界
git tag -a v0.2.0-dev.1 -m "J2.1 完成"       # ③ 开发版快照
```

| 我需要…… | 看这里 |
|---|---|
| 分支模型 / 版本号怎么定 | [`docs/VERSIONING.md`](./docs/VERSIONING.md) §1–§2 |
| 一个任务从头到尾怎么做 | [`docs/VERSIONING.md`](./docs/VERSIONING.md) §3 |
| 什么时候发稳定版 | [`docs/VERSIONING.md`](./docs/VERSIONING.md) §4 |
| 任务完成时该跑哪些门禁 | [`docs/VERSIONING.md`](./docs/VERSIONING.md) §5 |
| 做坏了怎么退回去 | [`docs/VERSIONING.md`](./docs/VERSIONING.md) §6 |
| **有哪些命令、怎么用** | [`docs/VERSIONING.md`](./docs/VERSIONING.md) §11 |
| **操作记录写在哪、怎么自动记** | [`docs/VERSIONING.md`](./docs/VERSIONING.md) §12 |

**流程已工具化**（`scripts/release.mjs` + git 钩子），日常只需要四条命令：

```bash
pnpm task:start J2.1 camera-rig   # 开任务分支
pnpm task:done J2.1               # 收尾：门禁 → 合并回 dev → 打 -dev.N tag
pnpm ship                         # 生成待人工执行的推送命令（不自动 push）
pnpm git:status                   # 分支 / 未推送 / tag 同步状态，并自动标记已完成命令
```

> 每个动作都会**自动追加**到 `GitPushHistory.md`（本地专用、不进版本库，规则见 §12）：
> `post-commit` / `post-merge` 钩子负责记录，换机器后跑一次 `pnpm hooks:install` 恢复。

> ⚠️ `Magic-cabin` 自身就是仓库根，**不要在 `FrontProj/` 或 `Project/` 再 `git init`**
> —— 那会让它变成 gitlink，任务级版本边界会全部失效。见 `docs/VERSIONING.md` §7。

---

## 操作

| 按键 | 动作 |
|---|---|
| WASD / 方向键 | 移动 |
| Shift | 疾跑 |
| 空格 | 跳跃（可跳上桌椅床凳） |
| E | 交互（门窗、壁炉、编辑文字） |
| 1 / 2 | 空手 / 魔杖 |
| 鼠标 | 视角（第三 / 第一人称） |
| F / 右键 | 施法（装备魔杖后） |
| Esc | 退出鼠标锁定 |
| 右上角 ● | 菜单 |

移动端：虚拟摇杆移动，右侧按钮为跳跃 / 交互 / 疾跑 / 施法。

---

## 目录结构

```
Magic-cabin/
├─ astro.config.mjs            # ★ J1.5.1 主产线配置（output: 'static' + base + alias）
├─ vite.single.config.ts       # ★ J1.5.6 第二条产线（单文件产物）
├─ vite.config.ts              # ⬜ 只承担零构建兜底（受限环境唯一能跑的路径，不可删）
├─ index.html                  # ⬜ 零构建入口（importmap + ./src/main.js）
├─ LICENSE                     # ★ MIT 协议（含上游 YIBI2333 与本项目的版权归属说明）
├─ public/sounds/*.mp3         # 11 个音效
├─ scripts/
│  ├─ serve.mjs                # 零依赖静态服务器（默认托管 dist/，--legacy 托管仓库根）
│  ├─ verify-j15.mjs           # ★ J1.5 门禁（75 项：构建形态 / 不变量 / cabin 摘要 / 产物）
│  └─ verify-*.mjs             # J1 的搬迁一致性校验（19 项静态 + 11 项运行时）
├─ .github/workflows/ci.yml    # ★ CI 门禁：typecheck → verify → build（见 docs/VERSIONING.md §5）
├─ src/
│  ├─ content.config.ts        # ★ 内容集合 schema（Zod）
│  ├─ content/                 # ★ 内容源（作者唯一手写的目录）
│  │  ├─ posts/*.md            #   一篇文章 = 书架上一本书
│  │  └─ pages/about.md        #   非文章页（M06）
│  ├─ pages/                   # ★ Astro 路由：/ /posts/<slug>/ /tags/ /archive/ /about/ /404 /rss.xml /robots.txt
│  ├─ layouts/ components/     # ★ BaseLayout / CabinMount（唯一的 3D 岛）/ PostList
│  ├─ main.js                  # 零构建入口（`void bootCabin()`，不导出任何东西）
│  ├─ styles/cabin.css         # 样式（原样搬迁，Astro 侧原地引用）
│  │
│  ├─ cabin/                   # ★ 3D 场景（自身重构的对象；J1.5 起 10 文件 9959 行逐字节被守住）
│  │  ├─ boot.js               #   启动开关（唯一引用 legacy 的地方）
│  │  ├─ dom.js                #   UI DOM（原样搬迁）
│  │  ├─ legacy/monolith.js    #   ★ 主实现（原样，J3/J4 逐步掏空，J4 末删除）
│  │  ├─ app/ core/ systems/ world/   # ⬜ 占位（J2 / J3 填充）
│  │  └─ props/                #   ⬜ 占位：跨场景复用道具（J3）
│  │
│  ├─ config/                  # ★★ 用户配置层 —— 改小屋只需要改这里
│  ├─ blog/                    # ★ 博客内核：loaders.js（零依赖加载器）+ posts.js（读取层）；其余 J5/J6
│  ├─ features/                # ★★ 功能模块（一模块一目录 = 一个增量开发单元）
│  └─ content/                 # ★ 内容源：作者唯一手写的目录
│
├─ tests/
│  ├─ baseline/
│  │  └─ cabin-digest.json     # ★ J1.5：「src/cabin/** 一行未改」的判据基线
│  ├─ visual/                  # ✅ J0.4：截图基线 + sha256 判据 + 抓图 / 比对 / 字符图工具
│  ├─ e2e/                     # ✅ cdp.mjs（零依赖 CDP）+ page.mjs（首页形态解析）+ smoke + perf
│  └─ unit/                    # ⬜ J2 起：ShelfLayout / 内容查询 / 四通道参数 / 碰撞
├─ dist/                       # Astro 产物（gitignore）
├─ dist-single/                # 单文件产物（gitignore）
└─ docs/
   ├─ BuildPlaning/            # ★ 建设规划（路线 J0–J8 + 模块映射 mapping.yaml）
   ├─ 实施结果/                 # ★ 每个阶段的实施结果（DoD 核对 / 落点 / 门禁 / 遗留交接）
   │  ├─ J2-实施结果.md         #   阶段级：J2 小屋核心设施（10 项任务的索引与汇总）
   │  ├─ J2.1 … J2.10-实施结果.md
   │  ├─ J1.5-实施结果.md       #   构建与内容地基（Astro 落地）
   │  └─ F0.2 … F0.6-实施结果.md
   ├─ VERSIONING.md            # ★ 版本管理规范（分支模型 / 版本号 / 任务 SOP / 发布回滚）
   ├─ MIGRATION.md             # 重构说明（搬迁记录 / 校验 / 映射索引 / 后续路线）
   └─ baseline.md              # ★ 性能基线（由 tests/e2e/perf.mjs --update 生成）
```

**本次未迁移任何 Firefly 组件与配置**。`src/features/`、`src/cabin/props/` 目前只有 README 占位，
说明各自将来放什么、依赖谁、由哪个阶段填充。

> **已按规划删除**：`src/data/`（原为 Firefly 的网络机制层）与 `src/domains/`（19 个 Firefly 内部切片镜像）
> —— 两者都来自已失效的 `ArtLine-Part/07`/`08`。`src/domains/` 由 `src/features/` 取代。
> 依据：[`docs/BuildPlaning/02-架构与目录调整.md`](./docs/BuildPlaning/02-架构与目录调整.md) §3。
>
> **已按规划新增（`J1.5`）**：`astro.config.mjs`、`vite.single.config.ts`、`src/{content.config.ts,content,pages,layouts,components}`、
> `src/blog/{loaders,posts}.js`、`tests/e2e/page.mjs`、`tests/baseline/cabin-digest.json`、`scripts/verify-j15.mjs`。
> 详表见 [`docs/实施结果/J1.5-实施结果.md`](./docs/实施结果/J1.5-实施结果.md) §2。

---

## 接下来的路线与映射（★ 唯一入口）

| 文档 | 内容 |
|---|---|
| [`docs/BuildPlaning/README.md`](./docs/BuildPlaning/README.md) | 索引、五个决策快照、上游文档定性 |
| [`docs/BuildPlaning/01-完善路线图.md`](./docs/BuildPlaning/01-完善路线图.md) | **`J0`–`J8` 阶段、工时、关键路径、MVP、CI 门禁** |
| [`docs/BuildPlaning/02-架构与目录调整.md`](./docs/BuildPlaning/02-架构与目录调整.md) | 目录微调清单 + 12 条架构不变量 |
| [`docs/BuildPlaning/03-渲染通道与构建选型.md`](./docs/BuildPlaning/03-渲染通道与构建选型.md) | 四通道模型（文章走方案 B）+ Astro 落地 |
| [`docs/BuildPlaning/04-模块增量开发与配置编排.md`](./docs/BuildPlaning/04-模块增量开发与配置编排.md) | 模块九步 SOP + 配置编排（Firefly 九条） |
| [`docs/BuildPlaning/mapping.yaml`](./docs/BuildPlaning/mapping.yaml) | ★ **映射真源**：19 个条目 / 18 个编号模块的物品、交互、呈现通道、状态 |
| [`docs/实施结果/J1.5-实施结果.md`](./docs/实施结果/J1.5-实施结果.md) | ★ **已实施阶段的记录**：DoD 核对、落点、75 项门禁、上游坑与遗留交接 |
| [`docs/VERSIONING.md`](./docs/VERSIONING.md) | ★ **版本管理规范**：`main`/`dev` 分支模型、`J` 编号 ↔ 版本号映射、**一个任务一个版本**的 SOP、发布与回滚、门禁分级 |

## 上游设计依据

| 文档 | 状态 |
|---|---|
| [`../docs/improve/07-最终定位与重构方案.md`](../docs/improve/07-最终定位与重构方案.md) | ✅ **权威**（定位、独立架构、Firefly 代码参考索引） |
| [`../docs/ArtLine-Part/01`](../docs/ArtLine-Part/01-现状评估.md)–[`05`](../docs/ArtLine-Part/05-风险-验收-度量.md) | ✅ 有效（小屋自身的现状 / 目标架构 / 内容管线 / 路线 / 风险） |
| `../docs/ArtLine-Part/07` / `08` | ❌ **已失效**（前提是"重构 Firefly 内部"与"两个项目组装"，都不该做） |
| [`../docs/Blog-Part/`](../docs/Blog-Part/README.md) | ✅ 有效，角色是**功能 backlog + 代码参考索引** |
| [`../Test/CSS3DRender原型验证/`](../Test/CSS3DRender原型验证/CSS3DRender原型验证结果.md) | ✅ 新增依据（方案 A/B/C 的实测数据与**测量手段**） |

## 技术栈

| 项 | 值 |
|---|---|
| 3D | Three.js **r128**（锁版本，升级排在 `J8`） |
| 渲染 | 单 Shader 全场光照（`FILL`）+ `EdgesGeometry` 线稿 + **`CSS3DRenderer`（书页真 DOM）** |
| 构建 | **Astro 7（`output: 'static'`）管站点** + 原生 ESM 管 3D（二者零交叉，不变量 `N12`）；第二条产线 `vite.single.config.ts`；**零构建兜底路径一直保留** |
| 内容 | Markdown + front-matter → Zod schema（`src/content.config.ts`）→ 静态页 / 归档 / 标签 / RSS |
| 语言 | JS 为主，TS 渐进（`allowJs: true`）；新增代码用 JSDoc 标注类型 |
| 资源 | **0 KB 外部模型/贴图** —— 全部几何与纹理程序化生成（`BB13`） |
| 协议 | **MIT** —— 见 [`LICENSE`](./LICENSE)；上游原作为 [YIBI2333/line-art-style-magic-cabin](https://github.com/YIBI2333/line-art-style-magic-cabin) |
