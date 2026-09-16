/**
 * 室内点光源 —— **8 个槽位的注册**（原 `core3d` 段末尾那段，`J4.10` 从天气模块移回）
 *
 * 来源：原 `monolith.js` L5417–L5432。`J4.7` 的段切片按**行区间**切，那几行落在
 * `weather` 段的区间内 ⇒ 光照注册一度住在 `systems/weather/WeatherSystem.js` 里
 * （光照与天气毫无关系）。本文件只是**把位置搬回来**，注册内容一字未改。
 *
 * ## ★ 硬约束：槽序 = 注册顺序
 *
 * `FILL` shader 的闪烁相位含 `float(i)` —— 第 i 个 `register` 就是第 i 个槽位，
 * **顺序一换画面就变**（像素回归会当场抓住）。所以下面这 8 行的**次序不可调整**，
 * 位置/颜色/半径/`yMin`/`yMax` 也必须逐字保持。
 *
 * ## 强度是惰性读取的
 *
 * `strength: () => ctx.ptLantern` 这类闭包由 `lightField.update()` 每帧调用，
 * 而那几个状态量（`ptLantern` / `ptKot` / `ptMc` / `ptCb` / `candleP` / `magicP` / `ptPlant`）
 * **仍住在 `WeatherSystem.js`（初值）与 `app/scene/FrameBody.js`（每帧平滑）** ——
 * 它们是"环境"算出来的，本文件只负责"注册"。
 *
 * ## ★ `slot`：槽序不再依赖"谁来注册"（`J4.18`）
 *
 * 原来这 8 盏灯全在这里**一次注册完**，槽位 = 注册位次。而物件住在段 08–10（远晚于本段），
 * ⇒ 任何一盏灯的注册只要跟着它的物件搬走，槽位就会改变；shader 的闪烁相位含 `float(i)`，
 * 槽位一变画面就变。这就是 `J3` 判定「6 件含光源物件搬不动」的病根
 * （见 `scripts/oneoff/_j3-specs/floor1-hanging-lantern.SKIP.md`）。
 *
 * 现在每一行都**显式写出自己的槽位号**（`slot: 0…7`）：槽序由**声明**决定，
 * 与"第几个注册、在哪一段注册"完全无关 ⇒ 灯可以整体搬进物件文件（连同它的
 * `strength` 闭包与 `state`），而槽序一个字节不动。
 *
 * 通路已通：`app/installProp.js` 的 ⑥ 会把物件 `lights()` 声明的光源注册进**同一个**
 * `lightField`；`app/scene/PropInstaller.js` 已把 `lightField` 交给装配环境。
 *
 * ⚠️ **本文件目前的 8 行尚未搬走** —— `J4.18` 只做通道（契约 + 注册通路 + 槽位定序），
 * 搬迁留给后续批次（`hanging-lantern` / `crystal-ball` / `kotatsu` / `magic-circle` /
 * `moon-plant`，以及已在一楼的 `cauldron-fire`）。届时本文件的行**逐条减少**，
 * 而槽位号**原样带走**。
 *
 * ## ⚠️ 还有一笔同类债务（未处理）
 *
 * 「花 / 路牌材质 / 萤火虫不透明度的每帧分支」也被段切片切进了 `WeatherSystem.js`
 * （`ctx.flowerMats` / `ctx.signSideMat` / `ctx.ffOpacity` …）。那些是**每帧**动作、
 * 且依赖 `_amb` 先算出来 ⇒ 搬它们会改变**帧顺序**（= 改变画面）。
 * 本任务刻意不动，见 `docs/实施结果/J4.10-实施结果.md` 的遗留。
 *
 * 另有一笔**同源**的债务由 `J4.18` 记下、留给搬迁批处理：`ptXxx` 的每帧平滑住在
 * `app/scene/FrameBody.js` 的 `frame/92`–`frame/96`（各占一个任务），而 `lightField.update`
 * 是 `frame/97` —— 搬灯时**这五个任务的执行位置就是 `update` 的执行位置**
 * （必须在 `frame/97` 之前，且与原来同帧内相对次序一致）。
 */
import { createLightField } from '../core/lighting/LightField.js'
import { createPointLightSource } from '../core/lighting/PointLightSource.js'

export function installWorldLights(ctx, app) {
  const { registry } = app
// J2.3：室内点光源改为**注册式**（原实现是 tickOnce() 里 8 行硬编码的 PP[i]/PC[i]/PG[i]）。
// ★ 注册顺序 = 槽位顺序：shader 的闪烁相位含 float(i)，顺序一换画面就变 ——
//   所以这 8 个的次序必须与原 PP[0]…PP[7] **完全一致**，位置/颜色/半径/yMin/yMax 也逐字照搬。
//   位置来自 cabin/world/layout.js（不变量 N9），强度用闭包读状态量，于是 core/ 里
//   不出现任何具体物件的名字（不变量 N1）。
// ★ J4.18：每行**显式声明 `slot`**（0…7，与原 PP 下标一一对应）—— 槽位从此由声明决定，
//   而不是由"第几个被注册"决定。位置/颜色/半径/强度/yMin/yMax **一字未改**。
const lightField = createLightField({ fillMaterial: ctx.FILL, warn: (m) => console.warn(m) });
ctx.lightField = lightField;
// ★ J4.22：槽位 0（`floor1/lantern`）**已搬走** —— 它现在由 `world/floor1/hangingLantern.js`
//   的 `lights()` 声明（写着同样的 `slot: 0` 与同样的位置/颜色/半径/yMin/yMax），
//   强度闭包读的是**物件自己的 state**（`() => s.pt`），`ctx.ptLantern` 这个中间量已消失。
//   ⇒ 这正是 `J4.18` 那条前置通道的目的：**灯可以整体搬走，而槽序一个字节不动**。
//   ⚠️ 不要在这里补回这一行 —— 会与物件声明的槽位冲突（`LightField.register` 会 warn 并拒绝后来者）。
// ★ J4.29：槽位 1（`floor1/cauldron-fire`）**也已搬走** —— 由 `world/floor1/cauldron.js`
//   的 `lights()` 声明（`slot: 1` + 同样的位置/颜色/半径/强度/yMin/yMax；它的强度是**常量 0.92**）。
//   ⚠️ 它是**最后离开本文件的一楼槽位**：`J4.22`/`J4.23`/`J4.24`/`J4.25`/`J4.28` 依次搬走了
//   槽 0/7/2/4/3，本任务收尾槽 1 ⇒ 「**一楼的点光源全部由各自的物件声明**」到此**完整闭合**。
//   ⚠️ 不要在这里补回 —— 会与物件声明的槽位冲突。
// ★ J4.24：槽位 2（`floor1/magic-circle`）**已搬走** —— 由 `world/floor1/magicCircle.js`
//   的 `lights()` 声明（`slot: 2` + 同样的位置/颜色/半径/yMin/yMax），强度读物件自己的 `state.pt`。
//   ⚠️ 不要在这里补回 —— 会与物件声明的槽位冲突。
// ★ J4.28：槽位 3（`floor1/kotatsu`）**已搬走** —— 由 `world/floor1/kotatsu.js` 的 `lights()` 声明
//   （`slot: 3` + 同样的位置/颜色/半径/yMin/yMax + **逐字照搬**的强度表达式
//   `s.pt * (0.82 + 0.18 * (0.5 + 0.5 * Math.sin(time * 4.2)))`）。
//   ⇒ 一楼的点光源已全部搬进各自的物件（槽 0/1/2/3/4/7，各自文件里声明 `slot`）。
//     ⚠️ 本文件现在剩 **2** 行 —— 都是**二楼**的：槽 5 `floor2/candle` · 槽 6 `floor2/magic-veil`。
//     （`J4.28` 收尾自检曾把这一段误写成"只剩二楼两盏"而当时其实是 3 行，漏了槽 1；
//      勘误见 `J4.28-实施结果.md` §0/§5.3，`J4.29` 把它补搬之后那句话才真正成立。）
//   ⚠️ 不要在这里补回 —— 会与物件声明的槽位冲突。
// ★ J4.25：槽位 4（`floor1/crystal-ball`）**已搬走** —— 由 `world/floor1/crystalBall.js`
//   的 `lights()` 声明（`slot: 4` + 同样的位置/颜色/半径/yMin/yMax），强度读物件自己的 `state.pt`。
//   ⚠️ 不要在这里补回 —— 会与物件声明的槽位冲突。
lightField.register(createPointLightSource({ id: 'floor2/candle', slot: 5, position: [ctx.NSX, ctx.FY + 1.00, ctx.NSZ], color: 0xffc06a, radius: 3.6, strength: () => ctx.candleP, yMin: 3.02, yMax: 6.9 }));
// ★ J4.23：槽位 7（`floor1/moon-plant`）**已搬走** —— 同样由 `world/floor1/moonPlant.js`
//   的 `lights()` 声明（`slot: 7` + 同样的位置/颜色/半径/yMin/yMax），强度读物件自己的 `state.pt`。
//   ⚠️ 不要在这里补回 —— 会与物件声明的槽位冲突。
lightField.register(createPointLightSource({ id: 'floor2/magic-veil', slot: 6, position: [1.75, ctx.TBL_TOP + 0.52, -2.72], color: 0xffe08a, radius: 4.6, strength: () => ctx.magicP, yMin: 3.02, yMax: 6.9 }));
// 同步登记到应用内核（J2.5 的注册中心）—— 进度可视化的「已登记 PointLightSource 数 ≥ 8」读它
// `if (src)`：注销会**留洞**（`unregister` 用 delete 而非 splice，见 LightField.js），洞要跳过
for (const src of lightField.sources) if (src) registry.registerLight(src);
}
