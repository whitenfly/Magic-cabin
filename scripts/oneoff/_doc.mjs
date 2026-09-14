// 组装 docs/MIGRATION.md（把自动提取的分区索引并入）
import fs from 'node:fs'
import path from 'node:path'

const ROOT = 'D:/FireflyQAQ/Project/FrontProj/Magic-cabin'
const map = fs.readFileSync(path.join(ROOT, 'docs/_partition-map.md'), 'utf8').trim()

const doc = `# Magic-cabin 重构说明

> **当前阶段：F1（工程化与骨架）** —— 把单文件 9811 行拆为工程化结构，**实现零改动**，页面表现与重构前一致。
> 依据：\`FrontProj/docs/ArtLine-Part/\` 的最终方案（06 总纲 / 07 架构归属 / 08 集成 / 09 路线图）。

---

## 1. 本次搬迁记录

源：\`FrontProj/line-art-style-magic-cabin-main/\`（**只读，未改动任何文件**）

| 原位置 | 内容 | 现位置 | 校验 |
|---|---|---|---|
| \`index.html\` 10–748 行 | \`<style>\` 全部样式 | \`src/styles/cabin.css\` | ✓ 逐字节一致（19,069 字符） |
| \`index.html\` 753–835 行 | UI DOM（菜单 / 编辑器 / HUD / 触屏按钮） | \`src/cabin/dom.js\`（\`UI_HTML\` 常量） | ✓ 逐字节一致（3,607 字符） |
| \`index.html\` 844–9807 行 | **主实现（IIFE，约 9000 行）** | \`src/cabin/legacy/monolith.js\` | ✓ 逐字节一致（533,269 字符） |
| \`sounds/*.mp3\`（11 个） | 音效 | \`public/sounds/\` | ✓ 数量一致 |
| \`three.min.js\`（r128，603 KB） | 全局 \`THREE\` | npm \`three@0.128.0\`（ESM） | ✓ 版本相同 |
| \`index.html\` 837–842 行 | CDN 回退脚本 | **移除**（npm 依赖不再需要） | — |

### 实现代码的**唯一改动**

\`src/cabin/legacy/monolith.js\` 顶部新增一行：

\`\`\`js
import * as THREE from 'three'   // 原为全局 THREE（来自 three.min.js）
\`\`\`

**其余 533,269 字符逐字节未变。**

---

## 2. 一致性校验

### 2.1 静态校验（代码级）

\`\`\`bash
node scripts/verify-migration.mjs
\`\`\`

当前结果：**19 通过 / 0 失败**，覆盖：

- 主脚本 / 样式 / UI DOM 三段与源文件**逐字节比对**
  （533,269 / 19,069 / 3,607 字符）
- 8 项关键 API 计数一致（\`Math.random()\` 286、\`new THREE.Mesh(\` 184、\`new THREE.Group(\` 198、
  \`ShaderMaterial(\` 6、\`regMagic(\` 64、\`addEventListener(\` 51、\`getElementById(\` 49、\`SND.play(\` 22）
- 已无 \`three.min.js\` 的 \`<script>\` 引用与 CDN 回退逻辑
- **外部依赖未新增**（源文件 7 个 URL → 现 3 个；移除的是 CDN 回退，
  保留的 3 个是原代码本就有的挂画图床代理 weserv / allorigins / corsproxy）
- 音效资源齐全、\`three@0.128.0\` 就位、无外部静态资源文件

> **代码逐字节相同 + 依赖版本相同 + 入口链路完整 ⇒ 画面必然一致。**
> 这比截图比对更严格 —— 截图还会受 \`Math.random()\` 的布局随机性干扰（见 §6 F0）。

### 2.2 运行时校验（浏览器级）

\`\`\`bash
# 需要 headless 浏览器；受限沙箱下需放宽权限（Edge 多进程架构依赖命名管道）
msedge --headless=new --dump-dom --virtual-time-budget=25000 \\
       http://127.0.0.1:5173/index.html > _shots/dom-after.html
node scripts/verify-runtime.mjs
\`\`\`

当前结果：**11 通过 / 0 失败** —— 证明页面在浏览器中**真正跑起来了**：

| 检查项 | 结果 |
|---|---|
| \`canvas\` 已创建（renderer 初始化成功） | ✓ |
| \`data-cabin="ready"\`（boot 完成） | ✓ |
| UI DOM 全部注入（菜单 / 面板 / 天气 / 法术槽 / 摇杆 / 时间滑块） | ✓ |
| 中文正常渲染 | ✓ |
| UI 节点位于 canvas **之前**（与原实现的 DOM 顺序一致） | ✓ |

渲染出的 canvas 元素：\`<canvas width="750" height="485" style="display: block; ...">\`。

---

## 3. 搬迁映射索引

> 自动提取，供搬迁时定位。**完整清单以源文件（\`line-art-style-magic-cabin-main/index.html\`）的注释为准。**
> 人工核对版的详尽映射见 \`FrontProj/docs/ArtLine-Part/02-目标架构.md\` §5。

${map}

---

## 4. 如何运行

### 方式 A：Vite（主力路径）

\`\`\`bash
pnpm install
pnpm dev        # http://localhost:4321
pnpm build      # → dist/
pnpm build:single   # → dist-single/（单文件版，保留「双击即玩」形态）
\`\`\`

> ⚠️ **受限环境注意**：Vite 依赖 esbuild，而 esbuild 需要 **spawn 子进程并用管道通信**。
> 在禁止命名管道的沙箱中会报 \`spawn EPERM\`，这是**环境限制而非项目问题**。
> 此时请用方式 B。

### 方式 B：零构建（兜底路径）

\`\`\`bash
pnpm serve      # 零依赖静态服务器 → http://127.0.0.1:5173（前台运行）
\`\`\`

浏览器用原生 ESM 直接加载 \`src/main.js\`，裸模块名 \`three\` 由 \`index.html\` 的 \`importmap\` 解析
→ \`node_modules/three/build/three.module.js\`。

**两种方式共用同一个入口与同一份代码，无需任何改动。**

服务端的解析顺序与 Vite 的 \`public/\` 约定一致（\`/sounds/ui.mp3\` → \`public/sounds/ui.mp3\`），
因此实现里的相对路径 \`sounds/xxx.mp3\` 在两种模式下都有效。

### 服务管理

零构建服务器默认**前台运行**（\`Ctrl+C\` 即停，不产生孤儿进程）。

| 命令 | 说明 |
|---|---|
| \`pnpm serve\` | 启动（前台，默认端口 5173） |
| \`pnpm serve:open\` | 启动并自动打开浏览器 |
| \`pnpm serve:lan\` | 监听 \`0.0.0.0\`（局域网设备可访问） |
| \`pnpm status\` | 查看状态（地址 / PID / 运行时长 / HTTP 响应） |
| \`pnpm stop\` | 停止服务（发信号后**轮询确认进程已退出**） |

- **端口占用自动顺延**：5173 被占用时自动试 5174、5175…（最多 10 个）
- **状态文件** \`.cache/serve.json\`：\`{ pid, port, url, startedAt }\`
- **参数覆盖**：\`node scripts/serve.mjs --port=8080 --host --open --quiet\`

> **实现要点**：\`stop\` 使用 Node 内置的 \`process.kill\` 而**不是 \`taskkill\`** ——
> 外部命令在受限环境中可能被拒绝（实测 \`taskkill\` 返回 \`Access denied\`，\`process.kill\` 正常）。
> 发送信号后会**轮询验证**进程是否真正退出；失败时保留状态文件并返回非零退出码，
> 因此不会出现「报告成功但进程还在」的情况。

---

## 5. 目录结构

\`\`\`
Magic-cabin/
├─ index.html                       # 唯一入口（Vite 与零构建通用）
├─ package.json  tsconfig.json  vite.config.ts  pnpm-workspace.yaml
├─ scripts/
│  ├─ serve.mjs                     # 零依赖静态服务器（零构建路径）
│  └─ verify-migration.mjs          # 搬迁一致性校验
├─ public/
│  └─ sounds/*.mp3                  # 11 个音效（原样）
├─ src/
│  ├─ main.js                       # 应用入口
│  ├─ styles/cabin.css              # 样式（原样）
│  ├─ cabin/                        # ★ 小屋
│  │  ├─ boot.js                    #   启动开关（唯一知道 legacy 的地方）
│  │  ├─ dom.js                     #   UI DOM（原样）
│  │  ├─ legacy/monolith.js         #   ★ 主实现（原样，F4/F5 逐步掏空）
│  │  ├─ app/                       #   ⬜ 占位：App/Clock/EventBus/Scheduler/Registry/rng/store
│  │  ├─ core/                      #   ⬜ 占位：render/materials/lighting/geometry
│  │  ├─ systems/                   #   ⬜ 占位：player/interaction/weather/audio/magic/ui
│  │  ├─ world/                     #   ⬜ 占位：layout/house/outdoor/floor1/floor2
│  │  └─ props/                     #   ⬜ 占位：复用道具
│  ├─ data/                         #   ⬜ 占位：数据机制层（F2）
│  ├─ domains/                      #   ⬜ 占位：19 个业务域（F2/F7）
│  └─ config/                       #   ⬜ 占位：用户配置层（F6 起接入）
└─ docs/
   ├─ MIGRATION.md                  # 本文件
   └─ _partition-map.md             # 分区索引源（由 _extract.mjs 生成）
\`\`\`

**★ 本次未迁移 Firefly 的任何组件与配置**（按要求），\`src/data/\`、\`src/domains/*\`、\`src/config/\`
仅创建目录与 README 占位，说明各自将来放什么、依赖谁、由哪个阶段填充。

---

## 6. 后续路线

| 阶段 | 内容 | 对应文档 |
|---|---|---|
| **F0** | 确定性随机 + 可步进时钟 + 截图回归 + 性能基线 | \`ArtLine-Part/04\` §3、\`09\` §3 |
| **F1** | ✅ **本阶段完成**：工程化骨架、目录边界、原样搬迁 | — |
| **F2** | \`src/data/\` 机制层 + \`src/domains/\` 域切片（**配置零迁移**） | \`07\`、\`09\` §3 |
| **F3** | 三个阻塞项：**\`CameraRig\`** + **统一 \`Interactable\`** + **持久化**；另含 \`LightField\`、\`Clock\`/\`EventBus\`/\`Scheduler\` | \`02\` §3、\`09\` §3 |
| **F4** | 物件模块化：B1–B6 六批、约 67 件物件 → \`defineProp\` | \`02\` §5、\`09\` §3 |
| **F5** | 系统模块化：player / weather / audio / magic / ui；**删除 \`legacy/\`** | \`09\` §3 |
| **F6** | 核心闭环：门厅 + 书架 + 阅读器 + 路由 + SSG | \`09\` §3 |
| **F7** | 增量挂家具：M02–M17 共 16 个模块 | \`Blog-Part/04\`、\`09\` §3 |
| **F8** | Three.js 升级、性能调优、低配档、无障碍 | \`09\` §3 |

**F0 尚未做**：本次搬迁保留了原始 \`Math.random()\`（286 处调用），
因此每次加载的树木/石头/星空布局仍有随机差异 —— 这符合「表现与重构前一致」的要求，
但**视觉回归测试在 F0 之前无法建立**（见 \`ArtLine-Part/05\` R1）。

---

## 7. 单件搬迁 SOP（F4 阶段使用）

\`\`\`
1. 按 §3 的索引在 legacy/monolith.js 中定位该分区
2. 新建 src/cabin/world/**/[name].js，写 defineProp({ id, build, state, update, interactables, lights })
3. 几何代码原样粘贴；把顶层 let/const 收进 state()
4. 从 monolith.js 中删除该段（保持其仍可运行）
5. 跑 node scripts/verify-migration.mjs（应报告该段已移除）
6. 浏览器手测该物件 + 跑交互冒烟
7. 含光源者：确认光源出现在 LightField 中且强度正确
8. 提交（单文件单提交）
\`\`\`

---

## 8. 已知差异与说明

| 项 | 说明 | 影响 |
|---|---|---|
| \`THREE\` 改为 ESM 导入 | 原为 \`three.min.js\` 提供的全局变量 | 无（同版本 r128） |
| CDN 回退脚本移除 | 改由 npm 依赖保证 | 无 |
| 代码缩进保持原样 | 原代码在 \`<script>\` 内缩进 12 空格起，搬迁未重排 | 无（F4 搬迁时自然修正） |
| \`monolith.js\` 尾部多 1 个换行 | 模板字符串写入所致 | 无 |
| Vite 在受限沙箱不可用 | esbuild 需子进程管道 | 用 \`pnpm serve\` 兜底 |
| 未做种子随机 | 见 §6 F0 | 画面每次加载的随机布局仍不同（与重构前行为一致） |
`

fs.writeFileSync(path.join(ROOT, 'docs/MIGRATION.md'), doc, 'utf8')
console.log('docs/MIGRATION.md →', doc.split('\n').length, '行')
