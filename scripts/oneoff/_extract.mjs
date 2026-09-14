// 从源文件提取主要注释分区，生成搬迁索引（docs/MIGRATION.md 的 §3）
import fs from 'node:fs'

const SRC = 'D:/FireflyQAQ/Project/FrontProj/line-art-style-magic-cabin-main/index.html'
const ROOT = 'D:/FireflyQAQ/Project/FrontProj/Magic-cabin'

const lines = fs.readFileSync(SRC, 'utf8').split(/\r?\n/)

// 匹配 /* ---- 标题 ---- */、/* ==== 标题 ==== */、/* ---- 12.9 标题 ---- */
const RE = /^\s*\/\*\s*[-—=]{2,}\s*(.+?)\s*[-—=]{2,}\s*\*\/\s*$/

const found = []
const seenLine = new Set()
for (let i = 0; i < lines.length; i++) {
  const l = lines[i]
  const m = l.match(RE)
  if (!m) continue
  let title = m[1].trim().replace(/[-—=]+\s*$/, '').trim()
  if (title.length < 2 || title.length > 80) continue
  if (seenLine.has(i + 1)) continue
  seenLine.add(i + 1)
  found.push({ line: i + 1, title })
}

const inRange = found.filter((x) => x.line >= 844 && x.line <= 9807)

// 楼层判定：12.x → 一楼；18.x → 二楼；其余按内容归类
function target(title, line) {
  const num = title.match(/^(12|18)\./)
  const slug = (s) =>
    s
      .replace(/^[0-9]+\.[0-9]+[a-z]?\s*/, '')       // 去掉编号
      .replace(/[【（(].*?[】）)]/g, '')                  // 去掉括号说明
      .replace(/[：:].*$/, '')                        // 去掉冒号后的补充
      .replace(/[^\u4e00-\u9fa5A-Za-z0-9]+/g, '-')   // 非字母数字汉字 → -
      .replace(/^-+|-+$/g, '')
      .slice(0, 20) || 'unnamed'
  if (num && num[1] === '12') return `world/floor1/${slug(title)}`
  if (num && num[1] === '18') return `world/floor2/${slug(title)}`
  return `（见 §3.3 基础设施表）`
}

const rows = (arr) =>
  arr.map((x) => `| L${x.line} | ${x.title.replace(/\|/g, '\\|')} | \`${target(x.title, x.line)}\` |`).join('\n')

const f1 = inRange.filter((x) => /^12\./.test(x.title))
const f2 = inRange.filter((x) => /^18\./.test(x.title))
const other = inRange.filter((x) => !/^(12|18)\./.test(x.title))

let out = `### 3.1 一楼陈设（原 \`12.x\` 分区 → \`src/cabin/world/floor1/\`）

自动提取到 **${f1.length}** 个带编号的一楼分区。完整清单以源文件注释为准。

| 原行号 | 分区 | 目标模块 |
|---|---|---|
${rows(f1)}

### 3.2 二楼陈设（原 \`18.x\` 分区 → \`src/cabin/world/floor2/\`）

自动提取到 **${f2.length}** 个带编号的二楼分区。

| 原行号 | 分区 | 目标模块 |
|---|---|---|
${rows(f2)}
`

if (other.length) {
  out += `
### 3.3 其他分区注释（非 12/18 编号）

| 原行号 | 分区 |
|---|---|
${other.map((x) => `| L${x.line} | ${x.title.replace(/\|/g, '\\|')} |`).join('\n')}
`
}

out += `
### 3.4 基础设施（无分区注释，按行号范围划分）

| 原行号 | 内容 | 目标模块 |
|---|---|---|
| 843–849 | \`IS_TOUCH\` 探测 | \`systems/player/Input.js\` |
| 851–870 | \`SND\` 音效池 | \`systems/audio/AudioSystem.js\` |
| 872–884 | scene / camera / renderer | \`core/render/\` |
| 882–885 | \`MAT\` / \`DASHMAT\` / \`IN_MAT\` | \`core/materials/lineMaterials.js\` |
| 886–1020 | **\`FILL\` 全场光照 shader** | \`core/materials/fill.*.glsl.js\` |
| 1022–1031 | \`LITMAT\` 工厂 | \`core/materials/litMaterial.js\` |
| 1033–1034 | 玻璃材质 | \`world/house/windows.js\` |
| 1036–1053 | \`V/geo/dline/edge/box/log/put/logBetween\` | \`core/geometry/sketch.js\` |
| 1062–1192 | 房屋尺寸常量 + \`logWall/logGable/interiorWallLines\` | \`world/layout.js\` + \`world/house/shell.js\` |
| 1190–1192 | \`registerHinge/regSlide/updateSprings\` | \`core/util/spring.js\` |
| 1194–1240 | \`squareWindow\` / 门 | \`world/house/windows.js\` / \`door.js\` |
| 1241–1270 | 火焰系统 | \`props/fire.js\` |
| 1272 | \`regMagic\` | 由 \`defineProp.interactables\` 取代 |
| 1274–1288 | 旋转楼梯 | \`world/house/stairs.js\` |
| 1290–1310 | 路牌 + 编辑器 | \`world/outdoor/signpost.js\` |
| 1311–1516 | 室外（森林/草地/石头/花/萤火虫） | \`world/outdoor/*\` |
| 1517–1569 | 圆角几何、\`solid/solidCyl/lloop\` | \`core/geometry/roundBox.js\`、\`solid.js\` |
| 6937–6961 | 史莱姆模型 + \`deformSlime\` | \`systems/player/Slime.js\` |
| 6962–8205 | **超位魔法系统**（魔杖 / 24 层阵 / 爆炸 / 时间轴） | \`systems/magic/*\` |
| 8206–8246 | 碰撞、\`collideXZ/groundAt/railCollide\` | \`systems/player/collision.js\` |
| 8247–8336 | 交互辅助 + 输入 + 设置绑定 | \`systems/interaction/*\` + \`systems/ui/*\` |
| 8337–8376 | \`updatePlayer\` / 相机解算 | \`systems/player/PlayerController.js\` + \`core/render/CameraRig.js\` |
| 8378–8855 | **天空·时间·天气** | \`systems/weather/*\` |
| 8862–9804 | 主循环 \`animate()\`（约 940 行） | 拆解为各 prop 的 \`update\` + \`app/UpdateScheduler.js\` |
| 9778–9794 | 8 个点光源硬编码赋值 | \`core/lighting/LightField.js\` + 各 prop 的 \`lights()\` |
`

fs.writeFileSync(`${ROOT}/docs/_partition-map.md`, out, 'utf8')
console.log('范围内分区注释:', inRange.length, `(一楼 ${f1.length} / 二楼 ${f2.length} / 其他 ${other.length})`)
