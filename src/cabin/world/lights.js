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
 * **仍住在 `WeatherSystem.js`** —— 它们是"环境"算出来的，本文件只负责"注册"。
 *
 * ## ⚠️ 还有一笔同类债务（未处理）
 *
 * 「花 / 路牌材质 / 萤火虫不透明度的每帧分支」也被段切片切进了 `WeatherSystem.js`
 * （`ctx.flowerMats` / `ctx.signSideMat` / `ctx.ffOpacity` …）。那些是**每帧**动作、
 * 且依赖 `_amb` 先算出来 ⇒ 搬它们会改变**帧顺序**（= 改变画面）。
 * 本任务刻意不动，见 `docs/实施结果/J4.10-实施结果.md` 的遗留。
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
const lightField = createLightField({ fillMaterial: ctx.FILL, warn: (m) => console.warn(m) });
ctx.lightField = lightField;
lightField.register(createPointLightSource({ id: 'floor1/lantern', position: [ctx.MTX, 2.52, ctx.MTZ], color: 0xffb066, radius: 4.6, strength: () => ctx.ptLantern, yMin: 0.0, yMax: 3.04 }));
lightField.register(createPointLightSource({ id: 'floor1/cauldron-fire', position: [ctx.CCX, 1.14, ctx.CCZ], color: 0x6fa8ff, radius: 5.6, strength: 0.92, yMin: 0.0, yMax: 3.04 }));
lightField.register(createPointLightSource({ id: 'floor1/magic-circle', position: [ctx.MC_X, 0.36, ctx.MC_Z], color: 0x9b6fe8, radius: 5.2, strength: () => ctx.ptMc, yMin: 0.0, yMax: 3.04 }));
lightField.register(createPointLightSource({ id: 'floor1/kotatsu', position: [ctx.KOT_X, 0.48, ctx.KOT_Z], color: 0xffa858, radius: 4.2, strength: (time) => ctx.ptKot * (0.82 + 0.18 * (0.5 + 0.5 * Math.sin(time * 4.2))), yMin: 0.0, yMax: 3.04 }));
lightField.register(createPointLightSource({ id: 'floor1/crystal-ball', position: [ctx.CBX, 0.88, ctx.CBZ], color: 0xb5a0f2, radius: 3.6, strength: () => ctx.ptCb, yMin: 0.0, yMax: 3.04 }));
lightField.register(createPointLightSource({ id: 'floor2/candle', position: [ctx.NSX, ctx.FY + 1.00, ctx.NSZ], color: 0xffc06a, radius: 3.6, strength: () => ctx.candleP, yMin: 3.02, yMax: 6.9 }));
lightField.register(createPointLightSource({ id: 'floor2/magic-veil', position: [1.75, ctx.TBL_TOP + 0.52, -2.72], color: 0xffe08a, radius: 4.6, strength: () => ctx.magicP, yMin: 3.02, yMax: 6.9 }));
lightField.register(createPointLightSource({ id: 'floor1/moon-plant', position: [ctx.PLX, 0.48, ctx.PLZ], color: 0x9bc0e8, radius: 3.8, strength: () => ctx.ptPlant, yMin: 0.0, yMax: 3.04 }));
// 同步登记到应用内核（J2.5 的注册中心）—— 进度可视化的「已登记 PointLightSource 数 ≥ 8」读它
for (const src of lightField.sources) registry.registerLight(src);
}
