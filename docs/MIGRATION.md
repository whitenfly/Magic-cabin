# Magic-cabin 重构说明

> **当前阶段：J1（工程化骨架）✅ 已完成** —— 把单文件 9811 行拆为工程化结构，**实现零改动**，页面表现与重构前一致。
> 依据：[`FrontProj/docs/improve/07-最终定位与重构方案.md`](../../docs/improve/07-最终定位与重构方案.md)（最终定位）
> + [`docs/BuildPlaning/`](./BuildPlaning/README.md)（路线 `J0`–`J8`、渲染通道、模块映射）。
>
> ⚠️ **本文 §4 的原始依据 `ArtLine-Part/07`（数据架构与归属）与 `08`（双端集成与部署）已失效** ——
> 它们的前提（"Firefly 作为数据源"、"两个项目组装"）不存在。
> 其产物 `src/data/` 已删除、`src/domains/` 已替换为 `src/features/`，见
> [`BuildPlaning/02-架构与目录调整.md`](./BuildPlaning/02-架构与目录调整.md) §3。

---

## 1. 本次搬迁记录

源：`FrontProj/line-art-style-magic-cabin-main/`（**只读，未改动任何文件**）

| 原位置 | 内容 | 现位置 | 校验 |
|---|---|---|---|
| `index.html` 10–748 行 | `<style>` 全部样式 | `src/styles/cabin.css` | ✓ 逐字节一致（19,069 字符） |
| `index.html` 753–835 行 | UI DOM（菜单 / 编辑器 / HUD / 触屏按钮） | `src/cabin/dom.js`（`UI_HTML` 常量） | ✓ 逐字节一致（3,607 字符） |
| `index.html` 844–9807 行 | **主实现（IIFE，约 9000 行）** | `src/cabin/legacy/monolith.js` | ✓ 逐字节一致（533,269 字符） |
| `sounds/*.mp3`（11 个） | 音效 | `public/sounds/` | ✓ 数量一致 |
| `three.min.js`（r128，603 KB） | 全局 `THREE` | npm `three@0.128.0`（ESM） | ✓ 版本相同 |
| `index.html` 837–842 行 | CDN 回退脚本 | **移除**（npm 依赖不再需要） | — |

### 实现代码的**唯一改动**

`src/cabin/legacy/monolith.js` 顶部新增一行：

```js
import * as THREE from 'three'   // 原为全局 THREE（来自 three.min.js）
```

**其余 533,269 字符逐字节未变。**

---

## 2. 一致性校验

### 2.1 静态校验（代码级）

```bash
node scripts/verify-migration.mjs
```

当前结果：**19 通过 / 0 失败**，覆盖：

- 主脚本 / 样式 / UI DOM 三段与源文件**逐字节比对**
  （533,269 / 19,069 / 3,607 字符）
- 8 项关键 API 计数一致（`Math.random()` 286、`new THREE.Mesh(` 184、`new THREE.Group(` 198、
  `ShaderMaterial(` 6、`regMagic(` 64、`addEventListener(` 51、`getElementById(` 49、`SND.play(` 22）
- 已无 `three.min.js` 的 `<script>` 引用与 CDN 回退逻辑
- **外部依赖未新增**（源文件 7 个 URL → 现 3 个；移除的是 CDN 回退，
  保留的 3 个是原代码本就有的挂画图床代理 weserv / allorigins / corsproxy）
- 音效资源齐全、`three@0.128.0` 就位、无外部静态资源文件

> **代码逐字节相同 + 依赖版本相同 + 入口链路完整 ⇒ 画面必然一致。**
> 这比截图比对更严格 —— 截图还会受布局随机性的干扰（见 §6 的 J0）。

### 2.2 运行时校验（浏览器级）

```bash
# 需要 headless 浏览器；受限沙箱下需放宽权限（Edge 多进程架构依赖命名管道）
msedge --headless=new --dump-dom --virtual-time-budget=25000 \
       http://127.0.0.1:5173/index.html > _shots/dom-after.html
node scripts/verify-runtime.mjs
```

当前结果：**11 通过 / 0 失败** —— 证明页面在浏览器中**真正跑起来了**：

| 检查项 | 结果 |
|---|---|
| `canvas` 已创建（renderer 初始化成功） | ✓ |
| `data-cabin="ready"`（boot 完成） | ✓ |
| UI DOM 全部注入（菜单 / 面板 / 天气 / 法术槽 / 摇杆 / 时间滑块） | ✓ |
| 中文正常渲染 | ✓ |
| UI 节点位于 canvas **之前**（与原实现的 DOM 顺序一致） | ✓ |

渲染出的 canvas 元素：`<canvas width="750" height="485" style="display: block; ...">`。

---

## 3. 搬迁映射索引

> 自动提取，供搬迁时定位。**完整清单以源文件（`line-art-style-magic-cabin-main/index.html`）的注释为准。**
> 人工核对版的详尽映射见 `FrontProj/docs/ArtLine-Part/02-目标架构.md` §5。

### 3.1 一楼陈设（原 `12.x` 分区 → `src/cabin/world/floor1/`）

自动提取到 **13** 个带编号的一楼分区。完整清单以源文件注释为准。

| 原行号 | 分区 | 目标模块 |
|---|---|---|
| L1826 | 12.8 壁炉旁的猫 | `world/floor1/壁炉旁的猫` |
| L1937 | 12.9 左墙书架 + 可抽拉的书 | `world/floor1/左墙书架-可抽拉的书` |
| L1972 | 12.9a 左窗下魔法书堆 | `world/floor1/左窗下魔法书堆` |
| L2025 | 12.9b 沙漏 | `world/floor1/沙漏` |
| L2063 | 12.9c 宝箱 | `world/floor1/宝箱` |
| L2080 | 12.9d 旋转星铃 | `world/floor1/旋转星铃` |
| L2102 | 12.9e 大魔女坩埚 | `world/floor1/大魔女坩埚` |
| L2360 | 12.9f 长餐桌 | `world/floor1/长餐桌` |
| L2577 | 12.10 魔法扫帚 | `world/floor1/魔法扫帚` |
| L2631 | 12.11 水晶球占卜台【门侧前右墙角】 | `world/floor1/水晶球占卜台` |
| L2720 | 12.11b 滑轮置物台【魔法餐桌另一侧】：可滑动 + 墨水瓶羽毛笔 + 纸堆 | `world/floor1/滑轮置物台` |
| L2862 | 12.12 塔罗牌牌堆 | `world/floor1/塔罗牌牌堆` |
| L2922 | 12.13 暖桌（八角桌板 + 等腰梯形垂帘 + 四角倒三角填补）+ 收音机 + 果盆橘子 + 方坐垫 | `world/floor1/暖桌-收音机-果盆橘子-方坐垫` |

### 3.2 二楼陈设（原 `18.x` 分区 → `src/cabin/world/floor2/`）

自动提取到 **4** 个带编号的二楼分区。

| 原行号 | 分区 | 目标模块 |
|---|---|---|
| L3322 | 18.1 大床 | `world/floor2/大床` |
| L3344 | 18.2 床头柜 + 可拉开抽屉 | `world/floor2/床头柜-可拉开抽屉` |
| L3360 | 18.3 蜡烛 | `world/floor2/蜡烛` |
| L3389 | 18.4 书桌 + 椅子 + 桌面玩具 | `world/floor2/书桌-椅子-桌面玩具` |

### 3.3 其他分区注释（非 12/18 编号）

| 原行号 | 分区 |
|---|---|
| L851 | 音效系统：文件放 sounds/ 目录，缺失时静默跳过 |
| L886 | 全局 FILL 材质：内置一楼炉火 + 二楼魔法吊灯光照 |
| L947 | 一楼炉火 |
| L969 | 二楼魔法吊灯 |
| L988 | 室内点光源（吊挂木灯·坩埚魔火·魔法阵·暖桌·水晶球·蜡烛·星象仪·月光盆栽） |
| L1022 | 彩色物品材质工厂：与 FILL 共享环境/光照 uniform（uTint 独立） |
| L1312 | 室外场景：森林 · 草地 · 石头 · 花 · 萤火虫 |
| L1518 | 室内陈设专用：圆角几何与材质工具 |
| L1545 | 一楼陈设专用：材质与工具 |
| L1571 | 一楼生活陈设（魔法餐桌·书架·暖桌·猫等） |
| L1916 | 猫旁边：毛线球 |
| L2195 | 灶台旁：固定木台 |
| L2205 | 左墙试剂药水架 |
| L2247 | 紫色魔法阵 |
| L2432 | 提梁茶壶 |
| L2483 | 桌面散放餐具 |
| L2688 | 月光魔法盆栽【门侧前右墙角】 |
| L2757 | 墨水瓶（上层） |
| L2769 | 羽毛笔（插在墨水瓶里） |
| L2794 | 发光魔法符号（Sprite 池：花体/哥特数学字母 + 柔光，无描边） |
| L2838 | 纸堆（下层） |
| L3011 | 收音机（点击播放音符） |
| L3048 | 果盆 + 橘子 6 颗 |
| L3108 | 茶杯 ×2 |
| L3112 | 方坐垫 ×2 |
| L3143 | 门铃【墙外侧，与门中间齐平高度】 |
| L3174 | 门口上方挂杆 |
| L3182 | 晴天娃娃【无眉毛：眼睛 + 大微笑 + 腮红，五官贴球面外】 |
| L3225 | 玻璃风铃 |
| L3270 | 楼梯下储物箱（点击开盖，内藏彩色矿石） |
| L3317 | 二楼陈设（床·书桌·魔杖·星象仪·挂画等） |
| L3399 | 椅子 |
| L3413 | 魔方 |
| L3550 | 通用倒塌/恢复 |
| L3577 | 金币柱 ×3 |
| L3629 | 扑克牌堆 |
| L3799 | 玻璃雪景球 |
| L3918 | 沙漏 |
| L4193 | 魔法书本 |
| L5756 | 挎包：两条绷紧的背带从包顶两角拉向钩上挂环，构成三角 |
| L5922 | 魔女帽交互：飞起悬浮撒糖果后落回 |
| L6873 | 便签编辑器（二楼计划板） |
| L6895 | 二楼顶中央魔法吊灯 |
| L6963 | 超位魔法系统：魔杖 + 超级爆裂魔法 |
| L6993 | 魔杖模型 |
| L7013 | 杖尖蓄力粒子 |
| L7026 | 空中彩色魔力粒子（向魔法阵中心聚集） |
| L7048 | 十字/四芒星粒子（修复：属性名 aColor 对齐；加大加亮；可漂浮自转） |
| L7101 | 施法期间：环绕阵塔的十字星 |
| L7118 | 施法期间：地面上升光尘 |
| L7167 | 魔法阵几何辅助 |
| L7197 | 施法时间轴 |
| L7212 | 24 层魔法阵定义（颜色 / 样式 / 转速各异） |
| L7493 | 构建水平巨型魔法阵塔（从下往上逐层错高） |
| L7524 | 网状光球（膨胀→缩点→爆） |
| L7537 | 超级爆炸 |
| L7935 | 施法目标 |
| L7983 | 魔杖：一阶惯性跟随转向（无回正摆动）+ 施法瞄准 |
| L8031 | 施法压暗 |
| L8040 | 爆裂魔法总调度 |
| L8206 | 家具平台碰撞体：史莱姆可跳跃站上（top 为台面高度） |
| L8247 | 音效辅助：门窗弹簧 / 壁炉 / 吊灯 / 魔法物件 |
| L8378 | 天空·时间·天气系统 |
| L8458 | 星空 |
| L8883 | 室内陈设动画（一二楼家具·猫·坩埚·塔罗牌·茶壶等） |
| L8982 | 书堆 |
| L9033 | 实体猫 |
| L9051 | 毛线球 |
| L9066 | 水晶球 |
| L9080 | 月光魔法盆栽 |
| L9094 | 滑轮置物台：滑动 + 轮子滚动（朝被炉 -z 方向） |
| L9106 | 羽毛笔：飞出书写魔法符号后归位 |
| L9160 | 魔法符号：上升渐隐 |
| L9178 | 纸堆：腾空扇动绕一楼一圈后飞回 |
| L9237 | 暖桌：暖光呼吸 + 收音机音符 |
| L9268 | 橘子：盆内 ⇄ 滚上桌面 |
| L9292 | 坐垫：水平翻滚 180° |
| L9306 | 塔罗牌 |
| L9368 | 试剂瓶 |
| L9382 | 紫色魔法阵 |
| L9461 | 楼梯下储物箱：开盖 + 矿石旋转起伏 |
| L9488 | 大魔女坩埚 |
| L9529 | 长餐桌 |
| L9558 | 茶壶 |
| L9633 | 门铃：按钮按压 + 音波涟漪 |
| L9653 | 晴天娃娃 + 风铃 |
| L9778 | 室内点光源：吊挂木灯·坩埚魔火·魔法阵·暖桌·水晶球·蜡烛·星象仪·月光盆栽 |

### 3.4 基础设施（无分区注释，按行号范围划分）

| 原行号 | 内容 | 目标模块 |
|---|---|---|
| 843–849 | `IS_TOUCH` 探测 | `systems/player/Input.js` |
| 851–870 | `SND` 音效池 | `systems/audio/AudioSystem.js` |
| 872–884 | scene / camera / renderer | `core/render/` |
| 882–885 | `MAT` / `DASHMAT` / `IN_MAT` | `core/materials/lineMaterials.js` |
| 886–1020 | **`FILL` 全场光照 shader** | `core/materials/fill.*.glsl.js` |
| 1022–1031 | `LITMAT` 工厂 | `core/materials/litMaterial.js` |
| 1033–1034 | 玻璃材质 | `world/house/windows.js` |
| 1036–1053 | `V/geo/dline/edge/box/log/put/logBetween` | `core/geometry/sketch.js` |
| 1062–1192 | 房屋尺寸常量 + `logWall/logGable/interiorWallLines` | `world/layout.js` + `world/house/shell.js` |
| 1190–1192 | `registerHinge/regSlide/updateSprings` | `core/util/spring.js` |
| 1194–1240 | `squareWindow` / 门 | `world/house/windows.js` / `door.js` |
| 1241–1270 | 火焰系统 | `props/fire.js` |
| 1272 | `regMagic` | 由 `defineProp.interactables` 取代 |
| 1274–1288 | 旋转楼梯 | `world/house/stairs.js` |
| 1290–1310 | 路牌 + 编辑器 | `world/outdoor/signpost.js` |
| 1311–1516 | 室外（森林/草地/石头/花/萤火虫） | `world/outdoor/*` |
| 1517–1569 | 圆角几何、`solid/solidCyl/lloop` | `core/geometry/roundBox.js`、`solid.js` |
| 6937–6961 | 史莱姆模型 + `deformSlime` | `systems/player/Slime.js` |
| 6962–8205 | **超位魔法系统**（魔杖 / 24 层阵 / 爆炸 / 时间轴） | `systems/magic/*` |
| 8206–8246 | 碰撞、`collideXZ/groundAt/railCollide` | `systems/player/collision.js` |
| 8247–8336 | 交互辅助 + 输入 + 设置绑定 | `systems/interaction/*` + `systems/ui/*` |
| 8337–8376 | `updatePlayer` / 相机解算 | `systems/player/PlayerController.js` + `core/render/CameraRig.js` |
| 8378–8855 | **天空·时间·天气** | `systems/weather/*` |
| 8862–9804 | 主循环 `animate()`（约 940 行） | 拆解为各 prop 的 `update` + `app/UpdateScheduler.js` |
| 9778–9794 | 8 个点光源硬编码赋值 | `core/lighting/LightField.js` + 各 prop 的 `lights()` |

---

## 4. 如何运行

### 方式 A：Vite（主力路径）

```bash
pnpm install
pnpm dev        # http://localhost:4321
pnpm build      # → dist/
pnpm build:single   # → dist-single/（单文件版，保留「双击即玩」形态）
```

> ⚠️ **受限环境注意**：Vite 依赖 esbuild，而 esbuild 需要 **spawn 子进程并用管道通信**。
> 在禁止命名管道的沙箱中会报 `spawn EPERM`，这是**环境限制而非项目问题**。
> 此时请用方式 B。

### 方式 B：零构建（兜底路径）

```bash
pnpm serve      # 零依赖静态服务器 → http://127.0.0.1:5173（前台运行）
```

浏览器用原生 ESM 直接加载 `src/main.js`，裸模块名 `three` 由 `index.html` 的 `importmap` 解析
→ `node_modules/three/build/three.module.js`。

**两种方式共用同一个入口与同一份代码，无需任何改动。**

服务端的解析顺序与 Vite 的 `public/` 约定一致（`/sounds/ui.mp3` → `public/sounds/ui.mp3`），
因此实现里的相对路径 `sounds/xxx.mp3` 在两种模式下都有效。

### 服务管理

零构建服务器默认**前台运行**（`Ctrl+C` 即停，不产生孤儿进程）。

| 命令 | 说明 |
|---|---|
| `pnpm serve` | 启动（前台，默认端口 5173） |
| `pnpm serve:open` | 启动并自动打开浏览器 |
| `pnpm serve:lan` | 监听 `0.0.0.0`（局域网设备可访问） |
| `pnpm status` | 查看状态（地址 / PID / 运行时长 / HTTP 响应） |
| `pnpm stop` | 停止服务（发信号后**轮询确认进程已退出**） |

- **端口占用自动顺延**：5173 被占用时自动试 5174、5175…（最多 10 个）
- **状态文件** `.cache/serve.json`：`{ pid, port, url, startedAt }`
- **参数覆盖**：`node scripts/serve.mjs --port=8080 --host --open --quiet`

> **实现要点**：`stop` 使用 Node 内置的 `process.kill` 而**不是 `taskkill`** ——
> 外部命令在受限环境中可能被拒绝（实测 `taskkill` 返回 `Access denied`，`process.kill` 正常）。
> 发送信号后会**轮询验证**进程是否真正退出；失败时保留状态文件并返回非零退出码，
> 因此不会出现「报告成功但进程还在」的情况。

---

## 5. 目录结构

```
Magic-cabin/
├─ index.html                       # 唯一入口（Vite 与零构建通用）；J1.5 后并入 src/layouts/
├─ package.json  tsconfig.json  vite.config.ts  pnpm-workspace.yaml
├─ scripts/
│  ├─ serve.mjs                     # 零依赖静态服务器（零构建兜底路径）
│  └─ verify-*.mjs                  # J1 的搬迁一致性校验（19 项静态 + 11 项运行时）
├─ public/
│  └─ sounds/*.mp3                  # 11 个音效（原样）
├─ src/
│  ├─ main.js                       # 应用入口
│  ├─ styles/cabin.css              # 样式（原样）
│  │
│  ├─ cabin/                        # ★ 3D 场景（自身重构的对象）
│  │  ├─ boot.js                    #   启动开关（唯一知道 legacy 存在的地方）
│  │  ├─ dom.js                     #   UI DOM（原样）
│  │  ├─ legacy/monolith.js         #   ★ 主实现（原样，J3/J4 逐步掏空，J4 末删除）
│  │  ├─ app/                       #   ✅ J2：App/Clock/EventBus/Scheduler/Registry/rng/store
│  │  │                             #        ⬜ J3：mounts.js（★ 挂载点 ID 表）
│  │  ├─ core/                      #   ✅ J2：render(CameraRig)/materials/lighting/geometry/util
│  │  ├─ systems/                   #   ✅ J2：interaction/weather（environment）  ⬜ J4：player/audio/magic/ui
│  │  ├─ world/                     #   ✅ J2：layout.js  ⬜ J3：house/outdoor/floor1/floor2
│  │  └─ props/                     #   ⬜ J3：跨场景复用道具
│  │
│  ├─ config/                       # ★★ 用户配置层（一模块一文件 + 模块总开关表）
│  │  ├─ README.md  index.js  types.js  resolve.js
│  │  ├─ site.config.js  cabin.config.js  modules.config.js
│  │  └─ shelf.config.js  reader.config.js  home.config.js
│  │
│  ├─ blog/                         # ⬜ J5/J6：博客内核
│  │  ├─ generated/                 #   posts.json + bodies/*.html（构建产物，gitignore）
│  │  ├─ ContentLoader.js  ShelfLayout.js  BookSpine.js
│  │  ├─ reader/                    #   ★ 方案 B：CSS3DRenderer 真 DOM 书页
│  │  └─ Router.js  commands.js  registry.js
│  │
│  ├─ features/                     # ★★ 功能模块（一模块一目录 = 一个增量开发单元）
│  │  ├─ README.md  _index.js       #   _index.js 是唯一总装文件
│  │  └─ <NN>-<id>/                 #   ⬜ 按需创建（不预置空目录）
│  │
│  └─ content/                      # ✅ J1.5：内容源（作者唯一手写的目录）  ⬜ J5：集合 schema 收紧
│     └─ posts/*.md                 #   一篇文章 = 一本书
│
├─ tests/
│  ├─ visual/                        # ✅ J0.4：截图基线 + sha256 判据 + 抓图/比对/字符图工具
│  ├─ e2e/                          # ✅ cdp.mjs + page.mjs + 冒烟 28 项 + 性能基线与比对
│  └─ unit/                         # ✅ J2：105 项（几何/材质/坐标/内核/存储/光照/交互/相机/环境/版本工具）
└─ docs/
   ├─ BuildPlaning/                 # ★ 建设规划（路线 J0–J8 + 模块映射 mapping.yaml）
   ├─ 实施结果/                      # 每个阶段的实施结果（F0.2–F0.6 / J1.5 / J2 …）
   ├─ MIGRATION.md                  # 本文件
   └─ _partition-map.md             # 分区索引源
```

**本次未迁移 Firefly 的任何组件与配置**（按要求）。
`src/features/`、`src/blog/`、`src/content/`、`src/cabin/props/` 目前只有 README 占位，
说明各自将来放什么、依赖谁、由哪个阶段填充。

> **已删除**（原为不符合最终定位的占位）：`src/data/`（Firefly 的网络机制层，小屋零外部数据源）、
> `src/domains/`（19 个 Firefly 内部切片的镜像）→ 由 `src/features/` 取代。
> 见 [`BuildPlaning/02-架构与目录调整.md`](./BuildPlaning/02-架构与目录调整.md) §3 的 M-1 / M-2。

---

## 6. 后续路线

| 阶段 | 内容 | 对应文档 |
|---|---|---|
| **J0** | ✅ **基线与护栏（已完成）**：**F0.2 注入种子随机**（[`F0.2-实施结果.md`](./实施结果/F0.2-实施结果.md)）、**F0.3 注入可步进时钟**（[`F0.3-实施结果.md`](./实施结果/F0.3-实施结果.md)）、**F0.4 最小截图回归**（[`F0.4-实施结果.md`](./实施结果/F0.4-实施结果.md)）、**F0.5 交互冒烟**（[`F0.5-实施结果.md`](./实施结果/F0.5-实施结果.md)）、**F0.6 性能基线**（[`F0.6-实施结果.md`](./实施结果/F0.6-实施结果.md)）—— 布局固定 + 画面定格 + 3 机位 × 3 轮 sha256 逐字节相同 + 28 项冒烟断言全绿 + 3138 calls / 86158 triangles 基线 | `BuildPlaning/01` §3、§9 |
| **J1** | ✅ **已完成**：工程化骨架、目录边界、原样搬迁 | — |
| **J1.5** | ✅ **已完成（2026-09-14）**：构建与内容地基（Astro 落地、`src/content/` 集合骨架、门厅）—— 见 [`实施结果/J1.5-实施结果.md`](./实施结果/J1.5-实施结果.md) | `BuildPlaning/03` §5 |
| **J2** | ✅ **已完成（2026-09-14）**：核心设施 —— **`CameraRig`** + 统一 `Interactable` + **持久化**；另含 `LightField`、`Clock`/`EventBus`/`Scheduler`，以及几何 DSL / 材质 / 坐标 / 天气解耦。四个 DoD 全部由机器判据证明 —— 见 [`实施结果/J2-实施结果.md`](./实施结果/J2-实施结果.md) | `BuildPlaning/01` §3 |
| **J2.5** | ✅ **已完成（2026-09-15）**：配置编排层（**插层子阶段**，版本 `0.2.5`）—— `src/config/` 接线 + `SettingsForm` 由 schema 自动生成面板并自动持久化 + `blog/registry.js` 按 `modules.config` 过滤装配 + **`pnpm verify:cf`（31 项，`CF1`–`CF4`）**。见 [`实施结果/J2.5-配置编排层-实施结果.md`](./实施结果/J2.5-配置编排层-实施结果.md) | `BuildPlaning/04` §3 |
| **J3** | 🟡 **基础设施已完成 + 35/67 件搬迁**：`defineProp` 契约（`app/defineProp.js`）、装配器（`app/installProp.js`）、**`mounts.js` 挂载点 ID 表**、惰性装配环境、搬迁应用器（`scripts/oneoff/_j3-apply.mjs`）与四条新门禁（`tests/e2e/j3-probe.mjs`、`scripts/oneoff/_j3-check-refs.mjs`、`_j3-diag.mjs`、场景图比对脚本）。其余 32 件因**四类结构性阻塞**（每帧分支与主循环耦合 / 光源槽位 / `addStatic` 链 / 自建射线）留给 `J4` —— 见 [`实施结果/J3-实施结果.md`](./实施结果/J3-实施结果.md) §3 | `BuildPlaning/01` §3 |
| **J4** | 系统模块化：player / weather / audio / magic / ui；**删除 `legacy/`** | `BuildPlaning/01` §3 |
| **J5** | 内容管线与静态页（Astro 版）：集合 schema、`posts.json`、`/posts/<slug>/`、RSS/sitemap/JSON-LD/Pagefind | `BuildPlaning/01` §3 |
| **J6** | ★ **书架即博客 + 方案 B 阅读器**（CSS3DRenderer 真 DOM 书页、平面视角、路由、门厅） | `BuildPlaning/03` §3 |
| **J7** | 增量挂模块：`mapping.yaml` 的 18 个模块条目，逐个走九步 SOP | `BuildPlaning/04` §2 |
| **J8** | Three.js 升级、性能调优、低配档、无障碍、移动端 | `BuildPlaning/01` §3 |

> **原 `F2` 已失效**（"架构归属"阶段的前提是重构 Firefly 内部）——
> 它的正确形态由 **`J5`**（小屋自己的内容管线）与 **`J2.5`**（小屋自己的配置层）承担。
> 完整阶段表、工时与关键路径见 [`BuildPlaning/01-完善路线图.md`](./BuildPlaning/01-完善路线图.md) §2。

**`J0` 三个确定性前提已全部就位**（F0.2 消除随机性 → F0.3 消除时间不确定性 → **F0.4 消除观察点不确定性**）：

- `F0.2` 把 286 处裸随机替换为注入的随机源 ⇒ 场景布局每次加载一致；
- `F0.3` 把动画时间换成可步进时钟 ⇒ `?deterministic=1&frames=120` 能定格到第 N 帧；
- **`F0.4` 把相机位变成观测条件** ⇒ `?cam=x,y,z,lx,ly,lz`（+ `?house=full|cutaway`），
  3 个机位连续 3 轮抓图 **sha256 逐字节相同**。

于是"改动有没有改坏画面"变成一条命令：`pnpm test:visual`（判据与用法见
[`../tests/visual/README.md`](../tests/visual/README.md)）；"还能不能玩"是另一条：`pnpm test:smoke`
（见 [`../tests/e2e/README.md`](../tests/e2e/README.md)）—— 两者互补，前者管像素，后者管交互。

`J0.5` 的冒烟同样跑在 manual 时钟下（每帧由脚本推进），所以它也是**可复现**的：
"走了 174 帧""壁炉点燃后画面变化 1.027%"在每次运行中都是同一个数。

---

## 7. 单件搬迁 SOP（J3 阶段使用）

```
1. 按 §3 的索引在 legacy/monolith.js 中定位该分区
2. 把坐标常量提到 cabin/world/layout.js（不变量 N9），几何与交互共用同一份
3. 新建 src/cabin/world/**/[name].js，写 defineProp({
     id, mount, build, state, update, interactables, lights })
     · mount   ★ 挂载点 ID（<物品>/<部位>），在 cabin/app/mounts.js 注册并暴露 parts()
     · 交互只发命令名：onActivate: (ctx) => ctx.commands.run('<name>', args)
       物品不得 import blog/** 或 features/**（不变量 N2）
4. 几何代码原样粘贴；把顶层 let/const 收进 state()
5. 从 monolith.js 中删除该段（保持其仍可运行）
6. 若物件是纯线框（Line/LineLoop/Points/Sprite）→ 补一个 HITMAT 隐形命中体，
   否则它不进交互集合（现状回归只收集 isMesh）
7. 跑 node scripts/verify-migration.mjs（应报告该段已移除）
8. 跑截图回归：`pnpm serve` + `pnpm test:visual`（搬迁式改动**必须零差异**）；
   涉及具体物品时用 `node tests/visual/capture.mjs --poses=<机位>` 定向看差异区域
9. 浏览器手测该物件 + 跑交互冒烟：
     · mode 必须 both（aim + proximity）—— 否则默认固定视角下点不开（风险 R1）
     · label 必须有语义（不得是字面量"交互"）
10. 含光源者：确认光源出现在 LightField 中且强度正确（不变量 N4，不得改 shader）
11. 提交（单文件单提交）
```

> **第 3 步的 `mount` 与命令名是本路线新增的要求**（原 SOP 没有）——
> 它是「物品 ↔ 功能模块」两侧能互不 import 的唯一接口。
> 详见 [`BuildPlaning/02-架构与目录调整.md`](./BuildPlaning/02-架构与目录调整.md) §5 的 `N2`/`N3`，
> 以及 [`BuildPlaning/04-模块增量开发与配置编排.md`](./BuildPlaning/04-模块增量开发与配置编排.md) §2 的九步模块 SOP。

> **新增式改动**（场景里原本没有的物件）走的是另一条判据：
> 画面**会**变化 → 只允许受影响机位有差异，且必须人工审查风格后**更新基线**；
> 其余机位仍必须零差异。
> 用 `pnpm test:visual:additive` 判定，用 `node tests/visual/view.mjs <png> --diff <baseline>` 看差异落在哪一块。
> 见 [`../tests/visual/README.md`](../tests/visual/README.md)。

---

## 8. 已知差异与说明

| 项 | 说明 | 影响 |
|---|---|---|
| `THREE` 改为 ESM 导入 | 原为 `three.min.js` 提供的全局变量 | 无（同版本 r128） |
| CDN 回退脚本移除 | 改由 npm 依赖保证 | 无 |
| 代码缩进保持原样 | 原代码在 `<script>` 内缩进 12 空格起，搬迁未重排 | 无（J3 搬迁时自然修正） |
| `monolith.js` 尾部多 1 个换行 | 模板字符串写入所致 | 无 |
| Vite 在受限沙箱不可用 | esbuild 需子进程管道 | 用 `pnpm serve` 兜底 |
| **F0.2 已实施种子随机** | 286 处裸随机调用已替换为注入的随机源；场景布局现在**每次加载一致**（这是一次可见的行为变化，但符合"画面等价"要求） | 见 [`F0.2-实施结果.md`](./实施结果/F0.2-实施结果.md)；运行期特效（爆炸/涟漪/撒糖）仍保持自然随机 |
| **F0.3 已注入可步进时钟** | 动画时间改为可外部推进：`?deterministic=1&frames=120` 可**定格到第 120 帧**，三轮截图 sha256 完全相同 | 见 [`F0.3-实施结果.md`](./实施结果/F0.3-实施结果.md)；realtime 模式行为与改动前完全一致 |
| 固定系数插值保持不变 | `updateSprings`、火/灯渐亮等 11+ 处按帧计数（与 `dt` 无关），过渡速度随帧率变化 | 原代码既有特性；改成 dt 形式会改变过渡速度，属视觉变化，留待 J8 决策 |
| 时间驱动动画仍不确定 | `animate(t)` 的 `t` 来自 `performance.now()` | 属 F0.3（可步进时钟）；截图仍有约 0.25% 的帧相位差异 |
