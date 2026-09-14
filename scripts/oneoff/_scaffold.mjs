// 创建占位目录与 README（F1 阶段一次性执行）
// 目的：让后续「一个个功能模块填进来」时有明确的落点，避免边想边建目录。
import fs from 'node:fs'
import path from 'node:path'

const ROOT = 'D:/FireflyQAQ/Project/FrontProj/Magic-cabin'

const write = (rel, content) => {
  const p = path.join(ROOT, rel)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, content, 'utf8')
  console.log('  +', rel)
}

const stub = (title, body) => `# ${title}

> **占位目录（F1 阶段）** —— 尚未实现。本文档说明它将来放什么、依赖谁、由哪个阶段填充。

${body}
`

// ────────────────────────────────────────────────
// 一、小屋自身的模块（F3–F5 填充）
// ────────────────────────────────────────────────
const cabin = {
  'src/cabin/app': [
    '小屋应用内核',
    `| 计划文件 | 职责 | 来源 | 填充阶段 |
|---|---|---|---|
| \`App.js\` | 生命周期 setup/start/stop/dispose、子系统编排 | — | F3 |
| \`Feature.js\` | Feature 契约（id / requires / order / settings / setup / start / dispose） | — | F3 |
| \`Clock.js\` | 三级时间源：wall / game / anim（可定格，供视觉回归） | 原 \`animate(t)\` 的时间计算 | F3 |
| \`EventBus.js\` | 类型化事件总线，解耦模块 | — | F3 |
| \`UpdateScheduler.js\` | 更新调度：tier（always/near/idle）+ LOD + 视锥裁剪 | 原 \`animate()\` 内联调用 | F3 |
| \`Registry.js\` | 注册中心（prop / interactable / light / feature） | 原 \`regMagic\` 的收集逻辑 | F3 |
| \`rng.js\` | 种子随机（构建期永久确定 / 运行期测试时确定） | 186 处 \`Math.random()\` | F3 |
| \`store.js\` | 全局状态 + \`settingsSchema\` + 持久化 | 小屋现状零持久化 | F3 |

依赖方向：\`app/\` 不依赖 \`world/\` \`systems/\` 的任何具体实现。`,
  ].join('\n\n'),

  'src/cabin/core': [
    '小屋内核（渲染 / 材质 / 光照 / 几何）',
    `| 子目录 | 计划文件 | 来源（monolith.js 内） |
|---|---|---|
| \`core/render/\` | \`createRenderer.js\` \`createScene.js\` \`CameraRig.js\` | 原 872–884、8337–8375、9796–9800 |
| \`core/materials/\` | \`fill.frag.glsl.js\` \`fill.vert.glsl.js\` \`FillMaterial.js\` \`litMaterial.js\` \`lineMaterials.js\` | 原 886–1034 |
| \`core/lighting/\` | \`LightField.js\` \`PointLightSource.js\` \`roomMask.js\` | 原 903–906、9778–9794 |
| \`core/geometry/\` | \`sketch.js\` \`roundBox.js\` \`solid.js\` \`shapes2d.js\` | 原 1036–1053、1517–1569、7168–7182 |

**两条关键重构**（详见 \`docs/ArtLine-Part/02-目标架构.md\` §3.4）：
1. **\`LightField\`**：把光源从「8 个硬编码 uniform 槽位」改为「N 个注册式光源 + 重要性裁剪」——
   现状新增一盏灯要改 4 处代码（shader 数组长度、循环上界、\`uPtCount\`、\`animate()\` 里的 \`PP[i]\` 赋值）。
2. **\`CameraRig\`**：现状全文件只有 3 处直接写 \`camera.position\`，没有任何运镜能力；
   而 9 个博客模块的「推移聚焦」转场都依赖它。`,
  ].join('\n\n'),

  'src/cabin/systems': [
    '小屋系统层',
    `| 子目录 | 计划文件 | 来源（monolith.js 内） |
|---|---|---|
| \`systems/player/\` | \`Slime.js\` \`PlayerController.js\` \`collision.js\` \`Input.js\` | 原 6937–6960、8206–8246、8276–8339 |
| \`systems/interaction/\` | \`InteractionSystem.js\` \`types.js\` \`HintUI.js\` | 原 1268–1272、8254–8274、8316 |
| \`systems/weather/\` | \`WeatherSystem.js\` \`sky.js\` \`precip.js\` \`clouds.js\` \`stars.js\` \`environment.js\` | 原 8378–8855 |
| \`systems/audio/\` | \`AudioSystem.js\` | 原 851–870 |
| \`systems/magic/\` | \`Wand.js\` \`spellArray.js\` \`explosion.js\` \`BlastSequence.js\` | 原 6962–8205 |
| \`systems/ui/\` | \`MenuPanel.js\` \`SettingsForm.js\` \`InteractTargetList.js\` \`editors/\` | 原 752–835、660–748、8323–8336 |

**三个阻塞项**（不做则后续模块只能做最朴素版本）：
- \`CameraRig\`（\`core/render/\`）—— 所有推移转场的前提
- 统一 \`Interactable\` 契约（\`systems/interaction/\`）—— 现状 \`regMagic\`(64 处) + \`interactables\`(9 条) + 镜子自建射线三套并行
- 持久化（\`app/store.js\`）—— 小屋现状零持久化，刷新即丢`,
  ].join('\n\n'),

  'src/cabin/world': [
    '小屋场景内容',
    `| 子目录 | 内容 | 来源（monolith.js 内的注释分区） |
|---|---|---|
| \`world/layout.js\` | **全部坐标常量集中于此** | 散落全文的魔法数字 |
| \`world/house/\` | 墙体 / 屋顶 / 地板 / 旋转楼梯 / 门窗 / 二楼吊灯 | 原 1062–1288、6894–6961 |
| \`world/outdoor/\` | 森林 / 草地 / 石头 / 花 / 蘑菇 / 萤火虫 / 路牌 | 原 1290–1516 |
| \`world/floor1/\` | 一楼陈设（原 12.1–12.13 分区，约 28 件） | 原 1570–3315 |
| \`world/floor2/\` | 二楼陈设（原 18.1–18.17 分区，约 26 件） | 原 3316–6893 |
| \`props/\` | 跨场景复用道具（茶杯 / 蜡烛 / 书 / 沙漏 / 火焰…） | 原代码内多处重复的实现 |

**搬迁方式**：每一件物件迁出为一个 \`defineProp\` 模块（契约见 \`docs/ArtLine-Part/02-目标架构.md\` §3.2），
并从 \`legacy/monolith.js\` 删除对应区段。**一个物件一次提交**。

分区 ↔ 文件的完整映射表见 \`docs/MIGRATION.md\` §3。`,
  ].join('\n\n'),
}

// ────────────────────────────────────────────────
// 二、Firefly 相关（本次仅占位，后续逐个填）
// ────────────────────────────────────────────────
const dataStub = [
  '数据机制层（占位）',
  `## 定位

**只放机制，零业务数据。** 这是 \`docs/ArtLine-Part/07-数据架构与归属设计.md\` 中"三条边界"的第二条：

| 边界 | 位置 | 谁维护 |
|---|---|---|
| 配置集中 | \`src/config/\` | 博客作者 |
| **机制集中** | **\`src/data/\`（本目录）** | 开发者 |
| 实现分散 | \`src/domains/<功能>/\` | 开发者 |

## 计划文件

| 文件 | 职责 |
|---|---|
| \`client.js\` | 统一 fetch：超时 / 重试 / 去重 / AbortSignal（吸收原 \`utils/fetch-dedup.ts\`） |
| \`cache.js\` | 三级缓存：内存 → sessionStorage → localStorage（TTL） |
| \`result.js\` | \`Result<T>\` + \`from\` 来源标记（network / cache / fallback） |
| \`errors.js\` | 错误分类（network / timeout / http / schema / unavailable / internal） |
| \`transport.js\` | 可注入传输层（测试时替换为 mock） |
| \`source.js\` | \`DataSource\` 声明类型 + \`collectSources()\` 自动聚合 |
| \`contract.js\` | 契约导出（内联注入 / 落盘 \`public/data/*.json\`） |

## 不变量

- **N1**：任何网络请求必须经 \`@/data/client\`（约束机制，不约束位置）
- **N2**：每个域必须有 \`source.ts\` 声明数据源；全站清单由 \`collectSources()\` 自动聚合
- **N8**：构建产物不得进源码目录，一律 \`.cache/build/\`

## 当前状态

⬜ 尚未实现。对应实施阶段的 **F2（架构归属，7–10 人日）**。`,
].join('\n\n')

const configStub = [
  '用户配置层（占位）',
  `## 定位

★ **这是"用户唯一需要看的目录"** —— Firefly 主题的核心卖点：

- 「本目录包含 Firefly 主题的**所有**配置文件」（\`src/config/README.md\`）
- 上游上手流程第 4 步：「**配置博客**：编辑 \`src/config/\` 目录下的配置文件自定义博客设置」
- 特性宣传：「🔧 **高度可配置**：大部分功能模块均可通过配置文件自定义」

**因此本目录必须保持集中，不得被拆分到各域中。**（\`07\` §3.3）

## 依赖规则

| 允许 | 禁止 |
|---|---|
| \`config/\` → \`types/\`、\`lib/\` 的纯工具 | ★ **\`config/\` → \`@/domains\`、\`@/data\`、\`@/cabin\`**（不变量 N4） |

配置是**叶子**：实现（域）**引用**配置，而不是配置迁入域。

## 接入方式（F6 起）

小屋侧**不复制** Firefly 的配置，而是：

1. 原样保留 Firefly 的 \`src/config/*.ts\`（28 个文件，零迁移）；
2. 小屋侧新增一份**自己的配置**（本目录），承载 3D 场景相关的参数：
   - 场景默认视角 / 画质档位 / 天气与时间默认值
   - 启动时是否预载 3D（门厅策略）
   - 各场景物品与博客域的绑定开关
3. 双方通过 \`src/domains/*/present.js\` 与契约产物连接，**不互相 import 配置**。

## 当前状态

⬜ 尚未实现。本次重构**不迁移 Firefly 的任何配置与组件**（用户要求），仅占位。`,
].join('\n\n')

// 17+ 个功能域（对应 Blog-Part 的 M01–M17 与基础设施域）
const domains = [
  ['posts', 'M01 内容存档', '左墙三层书架 + 左窗书堆', 'config/coverImageConfig、licenseConfig', '文章本体、列表、分页、排序、系列、上下篇、相关推荐、草稿、加密标记'],
  ['taxonomy', 'M04 主题聚类', '左墙试剂药水架（7 瓶，液面 = 文章数）', '—', '分类、标签、系列'],
  ['archive', 'M02 时间归档', '毛茸茸大地毯（年历）+ 台历', '—', '按年月归档、年度发文热力图'],
  ['search', 'M03a 搜索', '水晶球占卜台', 'navBarConfig（搜索配置）', '全文检索（Pagefind）'],
  ['trending', 'M14 热点榜单', '旋转星铃', 'config/trendingConfig', 'HotSpot 服务的总榜与分榜'],
  ['moments', 'M08 动态', '抽纸盒', 'config/dynamicConfig', '动态/说说（本地 JSON 或 Memos）'],
  ['comments', 'M08 评论互动', '抽纸盒（写）+ 计划板便签（看）', 'config/commentConfig', '评论（Twikoo/Waline/Artalk/Giscus/Disqus）'],
  ['friends', 'M08 友链', '计划板便签', 'config/friendsConfig', '友情链接'],
  ['announcement', '站点公告', '门口晴天娃娃', 'config/announcementConfig', '站点公告'],
  ['sponsor', 'M09 打赏（不映射到场景）', '—', 'config/sponsorConfig', '打赏（仅保留文章页底部按钮）'],
  ['gallery', 'M10 照片相册', '前墙挂画 → 相框组 + 雪景球', 'config/galleryConfig', '相册、标签筛选、加密相册'],
  ['music', 'M11 音频播放', '暖桌收音机', 'config/musicConfig', '音乐播放器（播放/切歌/音量/歌词）'],
  ['booknav', 'M15 收藏导航', '屋外路牌（5 箭头）', 'config/booknavConfig', '书签导航（5 组 13 个链接）'],
  ['profile', 'M07 名片与导航', '月光盆栽（5 浆果）+ 魔女帽', 'config/profileConfig', '个人信息卡、社交链接'],
  ['aggregator', 'M12 影音收藏', '书桌星象仪（4 环 = 4 平台）', 'siteConfig.pages.*', 'Bilibili / Bangumi / VNDB / MyAnimeList（默认全关）'],
  ['site', 'M13 站点统计', '烟囱墙魔法时钟（365 刻度 = 运行天数）', 'config/siteConfig', '文章数/分类数/标签数/总字数/运行天数、构建信息'],
  ['srs', '背单词（SRS）', '试剂架旁的坩埚（联动入口）', '—', 'FSRS 间隔重复；**IndexedDB 库名 \\`firefly-srs\\` 一个字不能改**'],
  ['nav', '导航结构', '魔女帽 → 全屋地图', 'config/navBarConfig、sidebarConfig、footerConfig', '导航结构解析'],
  ['analytics', '统计分析（K13 建议整体移除）', '—', 'config/analyticsConfig', 'GA / Clarity / Umami / 51LA'],
]

console.log('创建占位目录：')
for (const [dir, body] of Object.entries(cabin)) write(`${dir}/README.md`, stub(dir.replace('src/cabin/', 'cabin/'), body))
write('src/data/README.md', stub('src/data — 数据机制层', dataStub))
write('src/config/README.md', stub('src/config — 用户配置层', configStub))

for (const [name, mod, item, cfg, desc] of domains) {
  write(
    `src/domains/${name}/README.md`,
    stub(`domains/${name} — ${mod}`, `## 对应关系

| 项 | 值 |
|---|---|
| 模块 | **${mod}**（\`docs/Blog-Part/02-功能模块划分.md\`） |
| 承载物品 | ${item} |
| 相关用户配置 | ${cfg} |
| 核心功能 | ${desc} |

## 计划文件

\`\`\`
domains/${name}/
├─ index.js       # 对外 API（唯一被外部 import 的文件）
├─ schema.js      # Zod 契约（外部数据形状）
├─ source.js      # 数据源声明（时机/缓存/降级）—— 引用 @/config
├─ fetch.js       # 获取（必须经 @/data/client）
├─ adapter.js     # 规范化（纯函数，可单测）
├─ query.js       # 站内查询/筛选/排序（纯函数）
├─ fallback.js    # 失败降级数据
├─ present.js     # ★ 给 3D 的呈现数据（纯函数，零 3D 依赖）
├─ ui/            # 该域的 DOM UI
└─ README.md
\`\`\`

## 依赖规则

| 允许 | 禁止 |
|---|---|
| \`domains/${name}/\` → \`@/config\`、\`@/data\`、\`@/lib\` | \`@/config\` → \`domains/${name}/\` |
| \`src/cabin/**\` → \`domains/${name}/present.js\` | \`domains/${name}/\` → \`src/cabin/**\` |
| 外部 → \`domains/${name}/index.js\` | 外部直接 import 该域的内部文件（不变量 N7） |

## 当前状态

⬜ 尚未实现（本次重构只做小屋，不迁移 Firefly 模块）。填充阶段见 \`docs/ArtLine-Part/09-最终实施路线图与验收.md\` 的 **F2 / F7**。`),
  )
}
write('src/domains/README.md', stub('src/domains — 业务域（垂直切片）', `## 定位

每个功能一个**自包含切片**：把散在 \`types/\`、\`utils/\`、\`components/\`、\`pages/\` 的实现聚拢到一处。

**现状的病灶**（实测）：热榜的实现散在 **5 处**、SRS 散在 **6 处** —— 加功能要改 5 处，删功能留残渣。

## 目录清单（19 个）

${domains.map(([n, m]) => `- [\`${n}/\`](./${n}/README.md) —— ${m}`).join('\n')}

## 依赖方向

\`\`\`
src/cabin/** ──┐
               ├──► src/domains/** ──┬──► src/config/**   （实现消费用户配置）
src/pages/** ──┘                     └──► src/data/**     （实现消费机制）
\`\`\`

**禁止**：\`config/\` → \`domains/\`；\`data/\` → \`config/\`；\`domains/\` → \`cabin/\`。

## 当前状态

⬜ 全部为占位（用户要求：本次重构只做小屋，Firefly 模块后续一个个填）。`))

console.log('\n完成。')
