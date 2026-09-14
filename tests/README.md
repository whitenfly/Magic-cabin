# tests — 测试与护栏

> **定位**：把"改动没改坏东西"变成**机器可证明**的事。
> `J0` 的核心目标就是这个（`improve/05` U3 已判定：**截图回归是必做前提，不是可选优化**）。
>
> **当前状态**：🟢 **`J0` 三条安全网 + `J1.5` 一条新护栏全部就位** ——
> `visual/` 截图回归（`J0.4` ✅）、`e2e/` 交互冒烟（`J0.5` ✅）与性能基线（`J0.6` ✅）、
> `baseline/cabin-digest.json`（`J1.5` ✅「3D 一行未改」的判据）；`unit/` 待 `J2` 起填充。
> `J1` 时代的校验脚本仍在仓库根 `scripts/`（`verify-*.mjs`），**保留不动**；
> 本目录放的是**新增**的、需要固定位置的测试资产（尤其是截图 / 性能 / 源码摘要三类基线）。

---

## 0. ★ `J1.5` 起：前置命令变了（三条测试都要看这一段）

`J1.5` 把主产线换成了 Astro，**首页有三种合法形态**，取决于 `serve.mjs` 托管哪一份：

| 启动方式 | 首页 | 3D 入口 |
|---|---|---|
| `pnpm build && pnpm serve`（★ 推荐） | `/` | `/_astro/CabinMount…js` |
| `pnpm serve:legacy`（零构建兜底） | `/index.html` | `./src/main.js` |
| `pnpm build:single && pnpm serve:single` | `/` | `./assets/index-…js` |

三条测试脚本（`visual/capture` · `visual/compare` · `e2e/smoke` · `e2e/perf`）通过
[`e2e/page.mjs`](./e2e/page.mjs) **自动识别**形态，**不需要额外参数**：

```bash
pnpm build && pnpm serve     # 另开一个终端
pnpm test:visual             # 产物上的截图回归
pnpm test:smoke              # 产物上的冒烟
```

它同时承担"健康检查"：**判据不是"文件存在"，而是"这段 HTML 确实是本项目的页面"**
（特征：`cabin-mount` / `monolith` / `src/main.js`）。
⚠️ **不要用 `cabin.css` 判断** —— Astro 会把它并入 `_astro/BaseLayout.<hash>.css`，不保留文件名
（这个判据写错过一次，后果是"测试拒绝跑"却看起来像环境问题）。

---

## 1. 目录与职责

```
tests/
├─ baseline/
│  └─ cabin-digest.json  ★ J1.5：src/cabin/** 的逐字节摘要（「一行未改」的判据本身）
├─ visual/   截图回归：固定种子 + 定格时钟 + 固定机位 → PNG + sha256 基线
├─ e2e/      交互冒烟 + 性能基线 + 零依赖 CDP 工具链 + 首页形态解析（page.mjs）
└─ unit/     纯函数单测：ShelfLayout / 内容查询 / 四通道参数 / 碰撞 / CSS3D 护栏
```

| 目录 | 覆盖什么 | 关键验收 |
|---|---|---|
| `visual/` | 画面回归（3 个机位起）✅ 已落地 | `J0.4` ✅ |
| `e2e/` | 关键路径冒烟 ✅ + 性能基线 ✅ 已落地；层次正确性、闪烁检测待 `J6` | `J0.5` ✅ `J0.6` ✅ `BB6` `BB7` `BB16` `CH1` `CH3` |
| `baseline/` | `src/cabin/**` 摘要（`J1.5` 新增） | `J1.5` DoD ✅ |
| `unit/` | 纯逻辑正确性 + "不抛异常只会闪"的约定 | `BB11` `CH2` |

---

## 1.5 源码摘要基线（`J1.5` ✅ 已完成）

```bash
node scripts/verify-j15.mjs            # 校验（含摘要比对）
node scripts/verify-j15.mjs --built    # 附产物断言（需先 pnpm build）
```

`J1.5` 的 DoD 里有一条"`src/cabin/**` 的 `git diff` 为空"。**本项目不是 git 仓库**
（磁盘上实测无 `.git`），所以用**逐字节摘要**回答同一个问题：
`tests/baseline/cabin-digest.json` 记录 10 个文件 / 9959 行的合并 sha256，
任何一处改动都会让它失败并**列出具体是哪几个文件**。

> ⚠️ **`J3`/`J4` 开始掏空 `legacy/` 时，这个摘要会合法变化。**
> 改之前先在 `docs/J3-实施结果.md` 一类的文档里记一笔原因，再执行：
> `node scripts/verify-j15.mjs --record`

---

## 2. 截图回归（`J0.4` ✅ 已完成）

三个确定性前提已全部就位：**种子随机**（`F0.2`）、**可步进时钟**（`F0.3`）、**固定机位**（`J0.4`）。

```bash
pnpm build && pnpm serve   # 前置：构建产物 + 托管 dist/（或用 pnpm serve:legacy 跑零构建兜底）
pnpm verify:visual         # ★ DoD：连续抓 3 轮，轮间 sha256 必须逐字节相同
pnpm test:visual           # 与基线比对（搬迁/改动后跑这个）
```

**基线机位（3 个，全部 `house=full`）**：

| # | 机位 | 相机 | 看什么 |
|---|---|---|---|
| 1 | `default-fixed` | 不覆盖（默认固定视角） | 完整小屋外壳 + 森林前景 |
| 2 | `floor1-indoor` | `[0, 1.6, 3.0] → [-1.6, 1.1, -1.2]` | 一楼：壁炉、大坩埚、置物架、天花板梁、餐桌 |
| 3 | `floor2-desk` | `[0.2, 4.55, 2.95] → [0.2, 3.85, -2.6]` | 二楼：大床与书桌（含桌面陈设）同时入画 |

判据、机位坐标的算法依据、以及排查过的坑，见 [`visual/README.md`](./visual/README.md) 与
[`docs/F0.4-实施结果.md`](../docs/F0.4-实施结果.md)。

> **改动后怎么判**：搬迁式改动（物件模块化）→ 全部机位 sha256 相同；新增式改动 → **只允许 1 个机位**有差异且需人工审查。

---

## 2.5 交互冒烟（`J0.5` ✅ 已完成）

```bash
pnpm build && pnpm serve   # 前置
pnpm test:smoke     # 28 项断言（约 200s；时间主要花在逐帧推进上）
```

覆盖：进小屋 → 开门 → 点壁炉 → 切 3 视角 → 点书籍物件 → 切天气 → 退出。
与 `J0.4` 互补 —— **像素回归证明"画面没变"，冒烟证明"还能玩"**。

做法上有一个关键点：冒烟同样跑在 **manual 时钟**下（`?deterministic=1&frames=1`），
每一帧由脚本推进，因此"走了多少帧、点了什么、画面变化多少"全部是确定值，
失败可稳定重放。细节见 [`e2e/README.md`](./e2e/README.md) 与
[`docs/F0.5-实施结果.md`](../docs/F0.5-实施结果.md)。

---

## 2.6 性能基线（`J0.6` ✅ 已完成）

```bash
pnpm build && pnpm serve   # 前置
pnpm baseline:perf    # 采集并写基线（docs/baseline.md + tests/e2e/baseline/perf.json）
pnpm test:perf        # 与基线比对，超阈值即非零退出
```

**主判据是渲染统计**（`calls` / `triangles` / `geometries` / `textures`）—— 它们只取决于场景构成，
与 GPU 或软件渲染无关，同一份代码连测多轮**完全一致**；
首屏时间与 FPS 受运行环境支配（批次间波动实测 ±15%），只是**参考项**。

| 指标 | 沙箱 / SwiftShader | 本机 / RTX 5060（GPU 增量） |
|---|---|---|
| **draw calls** | **3138** | **3138** ← 必须相同 |
| **triangles** | **86158** | **86158** ← 必须相同 |
| geometries / textures / programs | 2843 / 38 / 15 | 2843 / 38 / 15 |
| 场景对象 | 5365（Mesh 1812 / **Line 1907**） | 同左 |
| 首屏时间（**冷启动**） | 536 ms | **853 ms** |
| 首屏时间（**稳态中位**） | 858 ms | **504 ms** |
| 稳态 FPS（中位） | 4.15 | **78.05** |
| 采集质量 | ✅ 稳定 | ✅ 稳定 |

> **渲染统计只取决于场景构成**，与 GPU 或软件渲染无关 —— 所以两列必须相同，而 FPS 差 19 倍。
> 这正是"FPS 不能当判据"的实证。
>
> **冷启动与稳态必须分开统计**：实测两个环境的方向**刚好相反** ——
> 软件渲染下冷启动更快（536 < 858，因为持续满载让 CPU 降频），
> GPU 下稳态更快（504 < 853，因为驱动初始化在冷启动一次性付出）。
> 不分开看，两个环境的"首屏时间"会得出互相矛盾的结论。

GPU 采集是**纯增量**（只新增 `perf.gpu.json` / `docs/baseline.gpu.md`，不动默认 profile 的任何文件）：

```bash
node tests/e2e/perf.mjs --gpu --rounds=5 --update      # 建议机器空载时跑
```

用途：`J2`–`J4` 的模块化改造**不应该让渲染统计上升超过 10%** ——
一旦上升，就说明新架构引入了额外的渲染批次（材质/几何不再共享、光照槽位重复提交）。

细节见 [`e2e/README.md`](./e2e/README.md) §1.5 与 [`docs/baseline.md`](../docs/baseline.md)
（GPU 采集后会生成 `docs/baseline.gpu.md`；实施记录见 [`docs/F0.6-实施结果.md`](../docs/F0.6-实施结果.md)）。

---

## 3. ★ 直接复用原型已验证的工具链（不要重新造）

[`Test/CSS3DRender原型验证/`](../../Test/CSS3DRender原型验证/CSS3DRender原型验证结果.md) §4 的产出是**本次最值钱的资产**：
两层零依赖验证 + 三套判据设计。**移植过来改路径即可用**：

| 原型资产 | 移植到 | 解决什么 |
|---|---|---|
| `_probe/cdp.mjs`（~150 行，用 Node 内置 `WebSocket`，**不需要 puppeteer/playwright**） | `e2e/cdp.mjs` | 任何"需要真实浏览器验证"的场合 |
| `_probe/probe1.mjs` hit-test 网格地图 | `e2e/layer-map.mjs` | 逐帧"看见"谁盖着谁（`elementFromPoint` 的命中顺序 = 绘制顺序） |
| `_probe/probe4.mjs` 逐帧像素差分（`Page.startScreencast`） | `e2e/flicker-diff.mjs` | **异常跳变 = 闪烁**（比肉眼看动画可靠得多） |
| `_probe/probe5.mjs` 层次回归 | `e2e/layer-regression.mjs` | 反复开合/翻页，断言每一步"谁在最上面"（`CH1`） |
| `_probe/probe6.mjs` 投影几何断言 | `e2e/flat-view.mjs` | 平面视角是不是正矩形（`CH5` 的前置几何保证） |
| `_probe/classify.mjs`、`diffmap.mjs`（自解码 PNG，零依赖） | `visual/` | 截图 → 材质分类字符图 / 差异分布图："无法肉眼看图时的文字化视觉" |
| `verify-boot.mjs` 的 Node 端 stub + **护栏校验写法** | `unit/css3d-guards.mjs` | 把"不抛异常只会闪"的约定变成机器校验（`CH2` `CH3`） |

> ⚠️ 环境要求：Chrome 启动需要创建 mojo 命名管道，**受限沙箱下会被拒绝**
> （`FATAL: platform_channel.cc: Check failed: 拒绝访问`），必须放宽文件/进程沙箱才能跑真实浏览器验证。

---

## 4. 单元测试覆盖什么（`unit/`）

| 目标 | 为什么值得单测 |
|---|---|
| `blog/ShelfLayout.js` | 排序 / 分组 / 厚度高度推导 / **容量溢出**（构造超量数据断言构建失败，`BB11`） |
| 内容查询 | 标签计数、按年月聚合、上下篇与相关推荐 |
| **四通道参数函数** | 通道 A/T4 的映射公式是纯函数（液面高度、指针角度、光点位置）—— 数据错了画面就错了，但画面看不出来 |
| 碰撞与平台 | `collideXZ` / `groundAt` / `railCollide`（原有行为，回归保护） |
| **CSS3D 护栏** | 断言 `PAPER_LIFT > PAPER_HALF_T`；断言 CSS 中**不出现** `backface-visibility`；断言 `loop()` 内无 `innerHTML`/`createElement`/`replaceChildren`/`appendChild`/`querySelector`/`insertBefore` |

---

## 5. 验收编号索引

| 编号段 | 内容 | 出处 |
|---|---|---|
| `J0.4`–`J0.6` | 截图回归 ✅ / 交互冒烟 ✅ / 性能基线 ⬜ | [`01-完善路线图.md`](../docs/BuildPlaning/01-完善路线图.md) §3 |
| `F1`–`F13` | 重构期功能验收（三视角 / 移动 / 天气 / 昼夜 / 光照 / 交互 / 动效…） | [`ArtLine-Part/05`](../../docs/ArtLine-Part/05-风险-验收-度量.md) §3.1 |
| `BB*` | Blog-Part 专项 18 项 | [`Blog-Part/05`](../../docs/Blog-Part/05-待确认事项与风险.md) §4 |
| `CH1`–`CH7` | 四通道专项 | [`03-渲染通道与构建选型.md`](../docs/BuildPlaning/03-渲染通道与构建选型.md) §8 |
| `CF1`–`CF4` | 配置编排专项 | [`04-模块增量开发与配置编排.md`](../docs/BuildPlaning/04-模块增量开发与配置编排.md) §3.6 |
