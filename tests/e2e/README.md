# tests/e2e — 交互冒烟、性能基线与层次验证

> **当前状态**：🟢 **`cdp.mjs` + `smoke.mjs`（`J0.5` ✅）+ `perf.mjs`（`J0.6` ✅）已就位**；
> 层次 / 闪烁 / 平面视角脚本待 **`J6`** 填充。

## 放什么

| 文件 | 内容 | 对应验收 | 状态 |
|---|---|---|---|
| `cdp.mjs` | **零依赖 CDP 客户端**（Node 22+ 自带 `WebSocket`，**不需要 puppeteer / playwright**）：精确视口、轮询等待、求值、截图、报错收集 | 基础设施 | ✅ `J0.4` |
| `smoke.mjs` | **交互冒烟**：进小屋 / 开门 / 点壁炉 / 切 3 视角 / 点书籍物件 / 切天气 / 退出 | `J0.5` | ✅ |
| `perf.mjs` | **性能基线**：首屏时间 / 稳态 FPS / `renderer.info`（calls·triangles·geometries·textures）；`--update` 写基线、`--compare` 判回归、`--gpu` 走真实 GPU（增量） | `J0.6` | ✅ |
| `perf-report.mjs` | **基线报告的渲染**（纯函数 `linkPrefix()` / `backendVerdict()` / `renderMarkdown()`）—— 从 `perf.mjs` 抽出，因为后者顶层有副作用、**不能被单测 import**；文内相对链接一律按**生成物自己的位置**算 | `J4.12` | ✅ |
| `baseline/perf.json` | 性能基线数据（**必须提交** —— 它是判据本身，人类可读版在 `docs/baseline.md`） | `J0.6` | ✅ |
| `baseline/perf.gpu.json` | GPU 增量基线（**必须提交**；报告在 `docs/baseline.gpu.md`） | `J0.6` | ✅ |
| `layer-map.mjs` | hit-test 网格地图：屏幕上每块区域最上层是谁 | `CH1` | ⬜ |
| `layer-regression.mjs` | 反复 翻开 / 翻页 / 合上，断言每一步"谁在最上面" | `CH1` | ⬜ |
| `flicker-diff.mjs` | 逐帧像素差分（`Page.startScreencast`），异常跳变 = 闪烁 | `CH3` | ⬜ |
| `flat-view.mjs` | 平面视角的投影几何断言（是不是正矩形） | `CH5` | ⬜ |

> ★ **不要重新造这些** —— 原型 [`Test/CSS3DRender原型验证/_probe/`](../../../Test/CSS3DRender原型验证/CSS3DRender原型验证结果.md)
> 已有一套验证过的实现（`cdp.mjs` + `probe1/4/5/6/7.mjs`），移植改路径即可。

---

## 1. 跑冒烟

```bash
pnpm serve          # 另开一个终端
pnpm test:smoke     # → 28 项断言；约 200s（软件渲染下每帧 ~0.2s，时间主要花在推进帧上）
```

产物：`_shots/e2e/*.png`（操作前后对照图，已 gitignore）。
排查某一步失败时用它：

```bash
node tests/visual/view.mjs _shots/e2e/stove-before.png --diff _shots/e2e/stove-after.png
```

---

## 1.5 跑性能基线

```bash
pnpm baseline:perf          # 采集并写基线（docs/baseline.md + baseline/perf.json），默认 5 轮取中位数
pnpm test:perf              # 与基线比对，任一指标超阈值即非零退出
node tests/e2e/perf.mjs --rounds=5    # 只采集不落盘（试采）
```

**主判据是渲染统计，不是 FPS**：`calls` / `triangles` / `geometries` / `textures` 只取决于**场景构成**，
与 GPU 或软件渲染无关；而 FPS 受运行环境支配 ——
它只能说明"同一台机器上变快了还是变慢了"，不能说明"性能好不好"。

### 两种采集环境（profile）

| profile | 命令 | 渲染后端 | 产物 |
|---|---|---|---|
| `swiftshader`（默认） | `pnpm baseline:perf` | 软件渲染 | `baseline/perf.json` + `docs/baseline.md` |
| `gpu`（**增量**） | `node tests/e2e/perf.mjs --gpu --rounds=5 --update` | 真实 GPU | `baseline/perf.gpu.json` + `docs/baseline.gpu.md` |

> **GPU 那条是纯增量**：只新增文件，**不覆盖也不改写**默认 profile 的任何产物 ——
> 所以它不影响既有回归判据与校验脚本（`verify-f06` 只在文件存在时才校验它）。
> `--gpu` 只是去掉 `--disable-gpu --use-angle=swiftshader` 等开关，让 Chrome 自己挑后端；
> **务必看输出里的「渲染后端」**：若仍显示 SwiftShader，说明回落了，那份不是 GPU 数据。

### 当前基线

| 指标 | 沙箱 / SwiftShader（默认） | 本机 / RTX 5060 Laptop（GPU 增量） |
|---|---|---|
| 渲染后端 | SwiftShader（软件） | **ANGLE D3D11（硬件加速）** |
| 采集质量 | ✅ 稳定（FPS 波动 7%） | ✅ 稳定（FPS 波动 11%） |
| **draw calls** | **3138** | **3138** ← 必须相同 |
| **triangles** | **86158** | **86158** ← 必须相同 |
| geometries / textures / programs | 2843 / 38 / 15 | 2843 / 38 / 15 |
| 场景对象 | 5365（Mesh 1812 / Line 1907 / Points 7） | 同左 |
| 首屏时间（**冷启动**） | 536 ms | **853 ms** |
| 首屏时间（**稳态中位**） | 858 ms | **504 ms** |
| 稳态 FPS（中位） | 4.15 | **78.05** |

**两个环境里渲染统计完全相同，而 FPS 差 19 倍** —— 这正是"FPS 不能当判据、渲染统计才能"的实证。

### 冷启动 vs 稳态：为什么不分开统计就会得出矛盾结论

同一个浏览器进程里，**第一次加载**要额外付出 V8 编译与首次 JIT、GPU 上下文与 shader 初始化、
几何/纹理首次上传、资源首取；后续轮次共享这些缓存。两者测的不是同一件事：

| | 代表什么 | 该怎么用 |
|---|---|---|
| **冷启动**（第 0 轮） | 用户**第一次打开**页面的体验 | 看首访；优化首屏时盯这个 |
| **稳态 / 热**（第 1…N 轮） | 页面已经在跑时的表现 | 看 FPS 与渲染开销；**回归判定用这个** |

**实测两个环境的方向刚好相反** —— 这是"必须分开"最硬的证据：

| | 冷启动 | 稳态 | 谁更快 | 原因 |
|---|---|---|---|---|
| 沙箱 / SwiftShader | 536 ms | 858 ms | **冷启动快** | 持续满载渲染让 CPU 降频；冷启动那轮机器刚从空闲开始 |
| 本机 / RTX 5060 | 853 ms | 504 ms | **稳态快** | 驱动初始化（D3D11 设备、shader 编译）在冷启动一次性付出，之后 GPU 上下文就绪 |

如果不分开统计，两个环境的"首屏时间"会得到**互相矛盾**的结论。所以脚本先单独跑一轮冷启动
（`第 0 轮`）**不计入**稳态统计；质量自检里还带**逐轮趋势**检测（防降频被误读成波动）。

### 一条关于测量本身的发现

GPU 下冷启动那轮测到 **105.62 fps**、稳态最高 84.49 —— 都高于 60，
说明 **headless 模式的 `requestAnimationFrame` 不受显示器垂直同步限制**。
所以 GPU 环境下 FPS 是有区分度的参考项；而在软件渲染下它只是"能跑"的量级 ——
这也是它只做参考项的原因。

> 采集口径固定为：视口 1440×900、`?deterministic=1&stats=1`（**realtime**，不带 `frames`）、
> 预热 3s、采样 5s、5 轮取中位数。
> 换机器或换渲染后端后**必须重建对应 profile 的基线**，不能拿旧数字做判定。

---

## 2. 它怎么做到"可复现"

关键在 **manual 时钟**：以 `?deterministic=1&frames=1` 打开，页面**不会自行推进**，
每一帧都由脚本调用 `window.__cabinStepFrame()` 推进：

```
keydown(W) + keydown(D) → 推进 174 帧 → 玩家走出确定的一段距离 → 提示条变成"魔法吊灯"
```

于是没有"等 1.5 秒看看"这种写法，失败可以稳定重放。三个断言证据来源：

| 证据 | 用在哪 |
|---|---|
| `#hint` 的文本与 `show` 类 | 可达性：走到哪、能不能交互 |
| DOM 状态（`.on` / `.open` / `#clock` 文本） | 视角、菜单、天气 |
| **像素差分**（操作前 vs 后） | 3D 物件是否真的响应了 —— "操作后画面确实变了"就是交互生效 |

---

## 3. 覆盖的关键路径（`J0.5`）

```
S0 启动与确定性前提（canvas / manual 时钟 / 两个测试钩子 / UI 节点齐全 / 无异常）
S1 门外：提示条指向「打开 / 关上大门」
S2 按 E 开门
S3 按 W+D 前进 → 提示条变为「点亮 / 熄灭魔法吊灯」（证明 移动 + 碰撞 + 门开合 + 可达）
S4 点燃 / 熄灭壁炉 → 火焰与光照响应（像素差分）
S5 切 3 视角：固定 → 第三人称 → 第一人称 → 按 V 互换 → 回固定（逐项断言 `.on`）
S6 点击书堆（书籍类物件）→ 响应（像素差分）
S7 切天气：菜单打开 → 7 个选项齐全 → 选「雪」→ `#clock` 文本与选中态 + 画面变化
S8 关闭菜单退出 + 全程无未捕获异常
```

### 三个必须知道的实现细节

1. **`?deterministic=1&frames=1`**：只推进一帧建立场景，之后完全由脚本控制。
   注意 `frames>0` 才会启用 manual 时钟（见 `boot.js`）。
2. **走位不是随便定的**：固定视角下 `camYaw = fixYaw + π`，单按 `W` 的移动方向是
   `(sin, cos)(camYaw) ≈ (-0.63, -0.77)` —— 斜着走会在 `z=4` 撞上**门左侧的墙**
   （`solidBoxes` 的 `x∈[-4.85,-0.78]`），人卡在门外、提示条停在"前左窗"。
   叠加 `D` 后的合方向 ≈ `(0.10, -1.00)`，正对门洞（`x∈[-0.78, 0.78]`）。
3. **页面内长循环要给足 CDP 超时**：SwiftShader 下每帧渲染 1440×900 约 0.2s，
   一次 `Runtime.evaluate` 里推 400 帧必然超过默认的 60s。
   所以走位是**分批**的（每批 40 帧），并且 `page.eval` 显式传了 `timeoutMs`。

### "抽出一本书"为什么是点书堆

书架本身是**装饰 + 实心阻挡**，不是交互物件；"书架即博客"要 `J6` 才有。
本阶段把路线图里的"抽出书架上的一本书"映射为现状存在的书籍类交互（书堆 `bookPileG`），
到 `J6` 时替换为真正的抽书路径（`mapping.yaml` 的 `M01`）。

---

## 4. `cdp.mjs` 用法

```js
import { findBrowser, launch, connect } from './cdp.mjs'

const chrome = await launch()              // 起一个 headless 浏览器（自动找 Chrome/Edge）
const page = await connect(chrome.port)    // 连上第一个 page target
await page.setViewport(1440, 900)          // 精确视口（与 --window-size 解耦）
await page.navigate(url)
await page.waitFor('document.documentElement.dataset.cabin === "ready"')
await page.eval('window.__cabinStepFrame()', { timeoutMs: 60000 })  // 求值入口（注意超时）
await page.screenshot('shot.png')
console.log(page.errors())                 // 页面异常 / console.error
await page.close(); chrome.kill()
```

**页面上的测试钩子**（都**只在 manual 模式存在**，正常游玩路径上没有任何这些接口）：

| 钩子 | 来源 | 用途 |
|---|---|---|
| `window.__cabinStepFrame()` | `F0.3` | 同步推进一帧 |
| `window.__cabinSetTestCamera([px,py,pz,lx,ly,lz])` | `J0.4` | 覆盖相机（截图 / 对准后点击） |
| `window.__cabinSetFullHouse(bool)` | `J0.4` | 完整小屋外观 ↔ 剖切 |

> `J0.5` **没有新增任何产品代码** —— 冒烟完全建立在上面三个钩子 + 真实输入事件之上。

---

## 5. 环境要求

Chrome 启动需要创建 mojo 命名管道，**受限沙箱下会被拒绝**
（`FATAL: platform_channel.cc: Check failed: 拒绝访问 (0x5)`）——必须放宽文件/进程沙箱才能跑。
无法放宽时，改用 `tests/visual/` 的离线截图 + `tests/unit/` 的护栏断言作为替代门禁。
