/**
 * 每帧任务登记 —— `tickOnce()` 的 719 行按**原执行顺序**切成 102 个帧任务
 *
 * 来源：`J4.7`（由 `scripts/oneoff/_j4-frame.mjs` 生成，段表见 `_j4-segments.mjs`）。
 *
 * ★ **顺序就是语义**。原来 `animate()` 直接调 `tickOnce()`，716 行从上往下跑；
 *   现在它们变成 102 个登记进 `UpdateScheduler` 的任务，**登记顺序 = 原执行顺序**
 *   （`rng` 调用顺序、`scene.add` 顺序、`lightField.register` 槽序都压在它上面）。
 *   切分点只取"声明的名字不被后续语句引用"的语句之后 —— 判据见 `_j4-tick-analyze.mjs`。
 *
 * ★ **25 处原地 `.tick(dt, time)` 在这里清零**（monolith 里一处不剩）：`installProp()` 也把
 *   物件的 `update` 登记进了同一个调度器，但那个顺序是**装配顺序**，与帧任务的顺序不同 ——
 *   所以下面先把自动登记的那些**撤销**，再按原位置重新登记。
 *
 * @param {object} ctx 段间通信载体
 * @param {object} app 应用内核（`scheduler` 从这里取）
 */
import { clock } from '../clock.js'
// ★ J4.14「每帧分支归位」：三个原住在 WeatherSystem.js 里的每帧分支，现在从**各自模块**取。
//   路径从 app/scene/ 到 cabin/ 是两级（J4.9 §2.3 坑①：级数写错只有 build 能拦下）。
import { updateSignMaterials } from '../../world/house/shell.js'
import { updateFlowerMaterials } from '../../world/outdoor/yardStatic.js'
import { updateFireflyOpacity } from '../../world/outdoor/fireflies.js'

export function installFrameBody(ctx, app) {
  const { scheduler } = app

  // ① 撤销 installProp() 的自动登记 —— 它的顺序是装配顺序，不是帧顺序
  for (const rec of ctx.propInstalled.values()) if (rec.task) scheduler.remove(rec.task)

  // ② 按原 tickOnce() 的执行顺序登记帧任务
  const F = (name, fn) => scheduler.add(name, fn)

  // L197–L197（1 行）
  F('frame/00', (dt, time) => {
ctx.updateSprings();
  })

  // L197–L197（1 行）
  F('frame/01', (dt, time) => {
ctx.updatePlayer(dt, time);
  })

  // L197–L197（1 行）—— ★ J4.14：原 `frame/02`（一个任务）拆成 5 个，把「路牌材质 /
  //   花材质 / 萤火虫不透明度」三个每帧分支**归还各自模块**。
  //   拆分的唯一要求是 **登记顺序 = 拆分前的执行顺序** —— 它们原来是 updateWeatherSystem()
  //   里的第 ⑨⑩⑪ 段，夹在"大气"与"效果"之间。顺序不变，画面才逐字节不变。
  F('weather/atmosphere', (dt, time) => {
ctx.updateWeatherAtmosphere(dt, time);
  })

  // 归位①：路牌材质（原 WeatherSystem L461–L462）
  F('world/signMaterials', (dt, time) => {
updateSignMaterials(ctx);
  })

  // 归位②：花材质（原 WeatherSystem L463）
  F('world/flowerMaterials', (dt, time) => {
updateFlowerMaterials(ctx);
  })

  // 归位③：萤火虫不透明度（原 WeatherSystem L465–L468）
  //   读 `ctx._night`，因此必须排在 weather/atmosphere **之后**；
  //   又必须排在 frame/10（萤火虫位置更新）之前 —— 那个任务用 ctx.ffOpacity 判可见性。
  F('world/fireflyOpacity', (dt, time) => {
updateFireflyOpacity(ctx, dt);
  })

  // 原 frame/02 的后半段：太阳 / 月亮 / 星星 / 云 / 雨 / 雪 / 闪电 / 时钟
  F('weather/effects', (dt, time) => {
ctx.updateWeatherEffects(dt, time);
  })

  // L197–L197（1 行）
  F('frame/03', (dt, time) => {
ctx.updateInteractHint();
  })

  // L200–L200（1 行）
  F('frame/04', (dt, time) => {
ctx.environment.setGameHour(ctx.curHour());
  })

  // L200–L200（1 行）
  F('frame/05', (dt, time) => {
ctx.environment.flush();
  })

  // L201–L201（1 行）
  F('frame/06', (dt, time) => {
ctx.updateWand(dt, time);
  })

  // L202–L202（1 行）
  F('frame/07', (dt, time) => {
ctx.updateBlast(dt, time);
  })

  // L204–L204（1 行）
  F('frame/08', (dt, time) => {
ctx.FILL.uniforms.uTime.value = time;
  })

  // L205–L205（1 行）
  F('frame/09', (dt, time) => {
ctx.FILL.uniforms.uFireStrength.value = ctx.fireP;
  })

  // L207–L207（1 行）
  F('frame/10', (dt, time) => {
if (ctx.ffOpacity > 0.01) {
                    for (let i = 0; i < ctx.FF_N; i++) {
                        const f = ctx.fireflies[i];
                        ctx.ffPos[i * 3] = f.bx + Math.sin(time * f.sp + f.ph) * f.amp;
                        ctx.ffPos[i * 3 + 1] = f.by + Math.sin(time * f.sp * 0.8 + f.ph * 1.3) * 0.32;
                        ctx.ffPos[i * 3 + 2] = f.bz + Math.cos(time * f.sp * 0.9 + f.ph * 0.7) * f.amp;
                    }
                    ctx.ffGeo.attributes.position.needsUpdate = true;
                }
  })

  // L216–L216（1 行）
  F('frame/11', (dt, time) => {
ctx.ffUniforms.uTime.value = time;
  })

  // L220–L220（1 行）
  F('prop/stools', (dt, time) => {
ctx.stoolsApi.tick(dt, time);
  })

  // L222–L222（1 行）
  // ★ J4.33：长餐桌旁的 5 把椅子已升格为 `world/floor1/diningChairs.js` —— 本段搬进物件的
  //   `update()`。这里**在原位置**调用（登记顺序 = 原执行顺序，帧顺序一个字节没变）。
  F('frame/13', (dt, time) => {
ctx.diningChairsApi.tick(dt, time);
  })

  // L232–L232（1 行）
  F('frame/14', (dt, time) => {
{
                    // J3（B4）：星象仪的每帧分支已搬入 world/floor1/orrery.js（原地 tick）
                    ctx.orreryApi.tick(dt, time);
                }
  })

  // L237–L237（1 行）
  F('frame/15', (dt, time) => {
{
                    // J3（B4）：魔法药剂瓶的每帧分支已搬入 world/floor1/potionBottle.js（原地 tick）
                    ctx.potionBottleApi.tick(dt, time);
                }
  })

  // L242–L242（1 行）
  F('frame/16', (dt, time) => {
{
                    // J3（B4）：魔法书的每帧分支已搬入 world/floor1/diningBook.js（原地 tick）
                    ctx.diningBookApi.tick(dt, time);
                }
  })

  // L247–L247（1 行）
  F('frame/17', (dt, time) => {
{
                    // J3（B3）：左窗下魔法书堆的每帧分支已搬入 world/floor1/bookPile.js（原地 tick）
                    ctx.bookPileApi.tick(dt, time);
                }
  })

  // L252–L256（5 行）
  // ★ J4.22：吊挂木灯已升格为 `world/floor1/hangingLantern.js` —— 它那**五段连续的每帧分支**
  //   （原 `frame/18`–`frame/22`，在下面相邻）全部搬进物件的 `update()`；
  //   同时把 `frame/92` 的强度平滑也并进同一个 `update`（一件物件只有一个 update），
  //   于是那一段**提前**到本位置执行 —— 等价性论证见该模块文件头「★ 帧顺序」。
  //   ⚠️ 合并后只在这里登记一次；`frame/19`–`frame/22` 与 `frame/92` 的任务已删除。
  F('frame/18', (dt, time) => {
ctx.hangingLanternApi.tick(dt, time);
  })

  // L267–L267（1 行）
  F('frame/23', (dt, time) => {
{
                    ctx.catP += ((ctx.catAwake ? 1 : 0) - ctx.catP) * 0.03;
                    const br = 1 + Math.sin(time * 2.2) * 0.025 * (1 - 0.6 * ctx.catP);
                    ctx.catBody.scale.set(1, br, 1);
                    ctx.catHead.position.y = 0.265 + 0.05 * ctx.catP;
                    ctx.catHead.position.x = 0.215 - 0.03 * ctx.catP;
                    const blink = ctx.catP > 0.5 && (time % 3.6) < 0.14;
                    ctx.eyesOpen.visible = ctx.catP > 0.5 && !blink;
                    ctx.eyesClosed.visible = !ctx.eyesOpen.visible;
                    const twitch = Math.max(0, Math.sin(time * 0.37) - 0.985) * 30;
                    ctx.earLG.rotation.z = -0.05 + twitch * 0.25;
                    ctx.earRG.rotation.z = 0.05 + twitch * 0.25;
                    for (let i = 0; i < ctx.tailSegs.length; i++)
                        ctx.tailSegs[i].rotation.y = Math.sin(time * 1.1 + i * 0.7) * (0.03 + 0.06 * ctx.catP);
                }
  })

  // L284–L284（1 行）
  F('frame/24', (dt, time) => {
{
                    const u = ctx.yarnG.userData;
                    u.vy -= 9.8 * dt;
                    u.y += u.vy * dt;
                    if (u.y <= 0) {
                        u.y = 0;
                        if (Math.abs(u.vy) > 0.45) { u.vy = -u.vy * 0.45; u.spinV *= 0.72; }
                        else { u.vy = 0; u.spinV *= (1 - 2.5 * dt); }
                    }
                    ctx.yarnBall.position.y = u.y;
                    ctx.yarnBall.rotation.y += u.spinV * dt;
                    u.spinV *= (1 - 0.4 * dt);
                }
  })

  // L299–L299（1 行）
  // ★ J4.25：水晶球占卜台已升格为 `world/floor1/crystalBall.js` —— 本段与 `frame/95`
  //   的强度平滑并进同一个 `update`（一件物件只有一个 `update`），登记位置取本段（早）。
  //   等价性论证见该模块文件头「★ 帧顺序」。`frame/95` 的任务已删除。
  F('frame/25', (dt, time) => {
ctx.crystalBallApi.tick(dt, time);
  })

  // L313–L313（1 行）
  // ★ J4.23：月光魔法盆栽已升格为 `world/floor1/moonPlant.js` —— 本段几何分支与 `frame/96`
  //   的强度平滑并进同一个 `update`（一件物件只有一个 update），登记位置取本段（早）。
  //   等价性论证见该模块文件头「★ 帧顺序」。`frame/96` 的任务已删除。
  F('frame/26', (dt, time) => {
ctx.moonPlantApi.tick(dt, time);
  })

  // L327–L327（1 行）
  // ★ J4.20：滑轮置物台已升格为 `world/floor1/cartShelf.js` —— 它那**四段连续的每帧分支**
  //   （原 `frame/27`–`frame/30`）全部搬进物件的 `update()`。四段在原 `tickOnce()` 里本就连续
  //   （L6425 → 纸堆块结束，中间只隔空行）⇒ 合并成一个任务与原来**逐帧等价**。
  //   ⚠️ 合并后**只在这里登记一次**；后三段（羽毛笔 / 魔法符号 / 纸堆）的帧任务已删除。
  F('frame/27', (dt, time) => {
ctx.cartShelfApi.tick(dt, time);
  })

  // ★ J4.20：原 `frame/28`（羽毛笔：飞出书写魔法符号后归位）已并入上面的 `cartShelfApi.tick`。

  // ★ J4.20：原 `frame/29`（魔法符号：上升渐隐）已并入上面的 `cartShelfApi.tick`。

  // ★ J4.20：原 `frame/30`（纸堆：腾空扇动绕一楼一圈后飞回）已并入上面的 `cartShelfApi.tick`。

  // L470–L470（1 行）
  // ★ J4.28：暖桌已升格为 `world/floor1/kotatsu.js` —— 它那**三段连续的每帧分支**
  //   （原 `frame/31` 暖光呼吸 + 收音机音符 / `frame/32` 橘子 / `frame/33` 坐垫）全部搬进物件的
  //   `update()`；同时把 `frame/94` 的强度平滑也并进同一个 `update`（一件物件只有一个 `update`），
  //   于是那一段**提前**到本位置执行 —— 等价性论证见该模块文件头「★ 帧顺序」。
  //   ⚠️ 合并后只在这里登记一次；`frame/32` / `frame/33` 与 `frame/94` 的任务已删除。
  F('frame/31', (dt, time) => {
ctx.kotatsuApi.tick(dt, time);
  })

  // L538–L538（1 行）
  F('frame/34', (dt, time) => {
{
                    // J3（B3）：塔罗牌阵的每帧分支已搬入 world/floor1/tarot.js（原地 tick）
                    ctx.tarotApi.tick(dt, time);
                }
  })

  // L543–L543（1 行）
  F('frame/35', (dt, time) => {
for (const f of ctx.candleWavy) {
                    f.obj.visible = true;
                    ctx.updateWavyFlame(f, time, 0.9 + 0.1 * Math.sin(time * 11));
                }
  })

  // L548–L548（1 行）
  // J4.19：左墙书架已升格为 `world/floor1/bookshelf.js`，那段 `for (const b of shelfBooks)` 搬进它的
  //   `update()`。这里**在原位置**调用（登记顺序 = 原执行顺序，帧顺序一个字节没变）。
  F('frame/36', (dt, time) => {
ctx.bookshelfApi.tick(dt, time);
  })

  // L558–L558（1 行）
  F('frame/37', (dt, time) => {
for (const rg of ctx.reagents) {
                    const u = rg.userData;
                    if (u.run > 0) u.run -= dt;
                    if (u.run > 0) {
                        const k = u.run / 1.3;
                        rg.rotation.z = Math.sin((1.3 - u.run) * 24) * 0.20 * k;
                        rg.position.y = u.by + Math.abs(Math.sin((1.3 - u.run) * 24)) * 0.006 * k;
                    } else {
                        rg.rotation.z = 0;
                        rg.position.y = u.by;
                    }
                }
  })

  // L572–L572（1 行）
  // ★ J4.24：紫色魔法阵已升格为 `world/floor1/magicCircle.js` —— 本段与 `frame/94`
  //   的强度平滑并进同一个 `update`（一件物件只有一个 `update`），登记位置取本段（早）。
  //   等价性论证见该模块文件头「★ 帧顺序」。`frame/94` 的任务已删除。
  F('frame/38', (dt, time) => {
ctx.magicCircleApi.tick(dt, time);
  })

  // L609–L609（1 行）
  F('frame/39', (dt, time) => {
{
                    // J3（B2）：沙漏的每帧分支已搬入 world/floor1/hourglass.js。
                    // **原位置调用** —— 每帧顺序与搬迁前一个字节不差，画面因此逐字节不变。
                    ctx.hourglassApi.tick(dt, time);
                }
  })

  // L615–L615（1 行）
  F('frame/40', (dt, time) => {
{
                    // J3（B2）：小宝箱的每帧分支已搬入 world/floor1/chest.js（原地 tick）
                    ctx.chestApi.tick(dt, time);
                }
  })

  // L621–L621（1 行）
  F('frame/41', (dt, time) => {
{
                    const target = ctx.storageOpen ? 1 : 0;
                    ctx.storageV += (target - ctx.storageP) * 0.02;
                    ctx.storageV *= 0.9;
                    ctx.storageP += ctx.storageV;
                    ctx.storageLid.rotation.x = -1.35 * ctx.storageP;
                    const show = ctx.storageP > 0.25;
                    for (let i = 0; i < ctx.oreMeshes.length; i++) {
                        const o = ctx.oreMeshes[i];
                        o.g.visible = show;
                        if (show) {
                            o.g.rotation.y += dt * 0.8;
                            if (ctx.storageP > 0.9)
                                o.g.position.y = o.by + Math.sin(time * 2 + i * 1.1) * 0.006;
                        }
                    }
                }
  })

  // L639–L639（1 行）
  F('frame/42', (dt, time) => {
{
                    // J3（B3）：旋转星铃的每帧分支已搬入 world/floor1/starBell.js（原地 tick）
                    ctx.starBellApi.tick(dt, time);
                }
  })

  // L645–L645（1 行）
  F('frame/43', (dt, time) => {
{
                    // J3（B4）：大魔女坩埚的每帧分支已搬入 world/floor1/cauldron.js（原地 tick）
                    ctx.cauldronApi.tick(dt, time);
                }
  })

  // L651–L651（1 行）
  F('frame/44', (dt, time) => {
{
                    // J3（B4）：三只餐盘的转动已搬入 world/floor1/longTable.js（原地 tick）
                    ctx.longTableApi.tick(dt, time);
                }
  })

  // L655–L655（1 行）
  // ★ J4.26：茶杯（餐桌/暖桌通用）的每帧分支已抽到 `src/cabin/props/cup.js` ——
  //   这里**在原位置**调用（帧顺序一个字节没变）。`cups` 是跨物件的共享集合
  //   （长餐桌 3 只 + 暖桌 2 只），由装配点创建的 `cupFactory` 持有。
  F('frame/45', (dt, time) => {
ctx.cupFactory.update(dt, time);
  })

  // L669–L669（1 行）
  F('frame/46', (dt, time) => {
{
                    // J3（B4）：桌面散放餐具的弹跳已搬入 world/floor1/tableware.js（原地 tick）
                    ctx.tablewareApi.tick(dt, time);
                }
  })

  // L675–L675（1 行）
  // ★ J4.34：提梁茶壶已升格为 `world/floor1/teapot.js` —— 本段搬进物件的 `update()`。
  //   这里**在原位置**调用（登记顺序 = 原执行顺序，帧顺序一个字节没变）。
  F('frame/47', (dt, time) => {
ctx.teapotApi.tick(dt, time);
  })

  // L729–L729（1 行）
  F('frame/48', (dt, time) => {
{
                    // J3：魔法扫帚的每帧分支已搬入 world/floor1/broom.js。
                    // **原位置调用** —— 顺序与搬迁前一致，画面因此逐字节不变。
                    ctx.broomApi.tick(dt, time);
                }
  })

  // L736–L736（1 行）
  F('frame/49', (dt, time) => {
{
                    if (ctx.bellRun > 0) ctx.bellRun -= dt;
                    if (ctx.bellRun > 0) {
                        ctx.btnG.position.z = -0.014 * Math.sin(Math.min((1.4 - ctx.bellRun) * 9, Math.PI));
                    } else {
                        ctx.btnG.position.z = 0;
                    }
                    if (ctx.bellRipple > 0) ctx.bellRipple -= dt;
                    for (const r of ctx.bellRipples) {
                        if (ctx.bellRipple > 0) {
                            const s = 1 + (1 - ctx.bellRipple) * 2.4;
                            r.l.scale.setScalar(Math.max(s, 0.001));
                            r.m.opacity = Math.max(0, ctx.bellRipple * 0.7);
                        } else {
                            r.m.opacity = 0;
                        }
                    }
                }
  })

  // L756–L756（1 行）
  F('frame/50', (dt, time) => {
{
                    // J3（B3）：挂杆 / 晴天娃娃 / 风铃三段的每帧分支已合并搬入
                    // world/floor1/doorHangBar.js（原地 tick，顺序不变）。
                    ctx.doorHangBarApi.tick(dt, time);
                }
  })

  // L762–L762（1 行）
  // ★ J4.21：书桌椅已升格为 `world/floor2/deskChair.js` —— 它的两段每帧分支（原 `frame/51` +
  //   `frame/52`，在下面**相邻**）合并进物件的 `update()`。合并后只在原 `frame/51` 的位置
  //   登记一次，每帧执行序列不变；`frame/52` 的任务已删除。
  F('frame/51', (dt, time) => {
ctx.deskChairApi.tick(dt, time);
  })

  // L765–L765（1 行）
  F('frame/53', (dt, time) => {
ctx.pillowT += ((ctx.pillowOpen ? 1 : 0) - ctx.pillowT) * 0.05;
  })

  // L766–L767（2 行）
  F('frame/54', (dt, time) => {
const pe = ctx.pillowT * ctx.pillowT * (3 - 2 * ctx.pillowT);
ctx.pillowG.rotation.x = Math.PI * pe;
  })

  // L768–L768（1 行）
  F('frame/55', (dt, time) => {
ctx.eraserT += ((ctx.eraserOpen ? 1 : 0) - ctx.eraserT) * 0.06;
  })

  // L769–L770（2 行）
  F('frame/56', (dt, time) => {
const ee = ctx.eraserT * ctx.eraserT * (3 - 2 * ctx.eraserT);
ctx.eraserG.rotation.x = Math.PI * ee;
  })

  // L771–L771（1 行）
  F('frame/57', (dt, time) => {
ctx.updateChalk(time);
  })

  // L772–L772（1 行）
  F('frame/58', (dt, time) => {
ctx.updateWand2(time);
  })

  // L775–L775（1 行）
  F('prop/rubik', (dt, time) => {
ctx.rubikApi.tick(dt, time);
  })

  // L778–L778（1 行）
  F('prop/snowGlobe', (dt, time) => {
ctx.snowGlobeApi.tick(dt, time);
  })

  // L781–L781（1 行）
  F('prop/deskHourglass', (dt, time) => {
ctx.deskHourglassApi.tick(dt, time);
  })

  // L784–L784（1 行）
  F('prop/cardDeck', (dt, time) => {
ctx.cardDeckApi.tick(dt, time);
  })

  // L785–L785（1 行）—— 原 `updateBook(time, dt);`
  // ★ J4.36：18.4 魔法书本升格 `defineProp` ⇒ 改走本物件自己的 `update`。
  //   这一个 `update` 同时接管了原 **L789 的 `updateGlyphs(time, dt);`**（两处不相邻的 tick
  //   合并进一个 `update`，内部两段顺序与原实现一致 —— 见 `world/floor2/magicBook.js` 文件头）。
  //   登记在**靠前**的这处（即原 `updateBook` 的位置）：中间原夹着的 `updateCal(dt)` 与本件无交互。
  F('prop/magicBook', (dt, time) => {
ctx.magicBookApi.tick(dt, time);
  })

  // L788–L788（1 行）
  F('prop/calendar', (dt, time) => {
ctx.calendarApi.tick(dt, time);
  })

  // L789–L789：原 `updateGlyphs(time, dt);` —— J4.36 已并入上面的 `prop/magicBook`，此处不再单列

  // L792–L792（1 行）
  F('prop/coinTowers', (dt, time) => {
ctx.coinTowersApi.tick(dt, time);
  })

  // L793–L793（1 行）
  F('prop/tissueBox', (dt, time) => {
ctx.tissueBoxApi.tick(dt, time);
  })

  // L794–L794（1 行）
  F('frame/68', (dt, time) => {
ctx.updateWobblers(dt);
  })

  // L795–L795（1 行）
  F('prop/witchHat', (dt, time) => {
ctx.witchHatApi.tick(dt, time);
  })

  // L797–L797（1 行）
  F('frame/70', (dt, time) => {
ctx.candleP += ((ctx.candleLit ? 1 : 0) - ctx.candleP) * 0.03;
  })

  // L798–L799（2 行）
  F('frame/71', (dt, time) => {
const candleVisible = ctx.candleP > 0.02;
for (const f of ctx.candleWavy) {
                    f.obj.visible = candleVisible;
                    if (candleVisible) {
                        ctx.updateWavyFlame(f, time, ctx.candleP * (0.9 + 0.1 * Math.sin(time * 9)));
                    }
                }
  })

  // L806–L806（1 行）
  F('frame/72', (dt, time) => {
ctx.magicP += ((ctx.magicOn ? 1 : 0) - ctx.magicP) * 0.012;
  })

  // L807–L807（1 行）
  F('frame/73', (dt, time) => {
ctx.veil.material.opacity = ctx.magicP * 0.28;
  })

  // L808–L808（1 行）
  F('frame/74', (dt, time) => {
{
                    const flick = 0.9 + 0.1 * Math.sin(time * 9) + 0.04 * Math.sin(time * 23);
                    const boost = 0.30 + 0.50 * ctx.magicP;
                    for (const cg of ctx.candleGlows) {
                        cg.m.material.opacity = cg.maxOp * ctx.candleP * boost * flick;
                        cg.m.scale.setScalar(1 + 0.05 * Math.sin(time * 9 + cg.maxOp * 10));
                    }
                }
  })

  // L816–L816（1 行）
  F('frame/75', (dt, time) => {
if (ctx.magicP > 0.01) {
                    ctx.spinG.rotation.y += 0.020 * ctx.magicP;
                    ctx.innerG.rotation.y -= 0.008 * ctx.magicP;
                }
  })

  // L820–L821（2 行）
  F('frame/76', (dt, time) => {
const pulse = 0.8 + 0.2 * Math.sin(time * 2.4);
for (let i = 0; i < ctx.glows.length; i++) {
                    ctx.glows[i].material.opacity = ctx.glows[i].userData.maxOp * ctx.magicP * pulse;
                    ctx.glows[i].scale.setScalar(1 + 0.06 * Math.sin(time * 2.4 + i * 1.1));
                }
  })

  // L825–L826（2 行）
  F('frame/77', (dt, time) => {
const partsOn = ctx.magicP > 0.02;
for (const g of ctx.magicParts) {
                    g.visible = partsOn;
                    if (!partsOn) continue;
                    const b = g.userData.p;
                    const th = time * b.sp + b.ph;
                    g.position.set(
                        b.cx + Math.sin(th * 0.6) * 0.15,
                        b.y0 + Math.sin(th) * b.bob,
                        b.cz + Math.cos(th * 0.5) * 0.12
                    );
                    g.rotation.y += b.rs;
                    let tw;
                    if (g.userData.vivid) {
                        tw = Math.max(0.05, Math.pow(Math.abs(Math.sin(time * 3.4 + b.ph * 11)), 2.5) * 1.25);
                    } else if (g.userData.sharp) {
                        tw = Math.max(0.12, Math.pow(Math.abs(Math.sin(time * 2.2 + b.ph * 7)), 3) * 1.15);
                    } else if (g.userData.nebula) {
                        tw = 0.75 + 0.25 * Math.sin(time * 0.8 + b.ph * 3);
                    } else {
                        tw = 0.7 + 0.4 * Math.sin(time * 2.0 + b.ph * 5);
                    }
                    g.scale.setScalar(Math.max(0.001, ctx.magicP * (0.8 + 0.35 * tw)));
                    if (g.userData.halo) {
                        g.userData.halo.h1.material.opacity = g.userData.halo.opIn * tw * ctx.magicP;
                        g.userData.halo.h2.material.opacity = g.userData.halo.opOut * tw * ctx.magicP;
                    }
                    if (g.userData.spikes) {
                        g.userData.spikes.opacity = 0.85 * tw * ctx.magicP;
                    }
                    if (g.userData.cluster) {
                        for (const c of g.userData.cluster) {
                            const a = time * 0.5 + c.ph;
                            c.g.position.set(Math.cos(a) * 0.030, Math.sin(a * 0.8) * 0.008, Math.sin(a) * 0.030);
                        }
                    }
                    if (g.userData.tails) {
                        for (const tl of g.userData.tails) {
                            tl.m.material.opacity = (0.5 / tl.s) * tw * ctx.magicP;
                            tl.m.position.set(-Math.sin(th) * 0.045 * tl.s, -Math.cos(th * 0.5) * 0.018 * tl.s, 0);
                        }
                    }
                }
  })

  // L868–L868（1 行）
  F('frame/78', (dt, time) => {
ctx.fireP += ((ctx.fireLit ? 1 : 0) - ctx.fireP) * 0.016;
  })

  // L868–L869（2 行）
  F('frame/79', (dt, time) => {
const fireVisible = ctx.fireP > 0.02;
for (const f of ctx.wavyFlames) { f.obj.visible = fireVisible; if (fireVisible) ctx.updateWavyFlame(f, time, ctx.fireP); }
  })

  // L870–L870（1 行）
  F('frame/80', (dt, time) => {
for (const sp of ctx.sparks) { sp.visible = ctx.fireP > 0.05; if (sp.visible) { const prog = (time * 0.22 + sp.userData.phase) % 1; sp.position.set(ctx.FX + sp.userData.drift * prog + Math.sin(time * 2.5 + sp.userData.phase * 9) * 0.04, 0.55 + prog * 1.0, ctx.FZ + Math.cos(time * 2 + sp.userData.phase * 7) * 0.1); const sc = ((1 - prog) * 0.9 + 0.15) * (0.35 + 0.65 * ctx.fireP); sp.scale.set(sc, sc, sc); } }
  })

  // L871–L871（1 行）
  F('frame/81', (dt, time) => {
for (const p of ctx.smokePuffs) { p.visible = ctx.fireP > 0.03; if (p.visible) { const prog = (time * 0.25 + p.userData.phase) % 1; const s = (0.5 + prog * 1.6) * ctx.fireP; p.scale.set(s, s, s); p.position.set(ctx.CHX - prog * 0.7, 7.35 + prog * 1.6, ctx.CHZ + Math.sin(time * 2 + p.userData.phase * 10) * 0.08); } }
  })

  // L873–L873（1 行）
  F('frame/82', (dt, time) => {
ctx.lampP += ((ctx.lampLit ? 1 : 0) - ctx.lampP) * 0.016;
  })

  // L874–L874（1 行）
  F('frame/83', (dt, time) => {
ctx.FILL.uniforms.uLampStrength.value = ctx.lampP;
  })

  // L875–L876（2 行）
  F('frame/84', (dt, time) => {
const lampVisible = ctx.lampP > 0.02;
for (const f of ctx.chandelierFlames) { f.obj.visible = lampVisible; if (lampVisible) ctx.updateWavyFlame(f, time, ctx.lampP * (0.9 + 0.1 * Math.sin(time * 9 + f.phase))); }
  })

  // L877–L877（1 行）
  F('frame/85', (dt, time) => {
ctx.chandelier.rotation.x = Math.sin(time * 0.7) * 0.012;
  })

  // L878–L878（1 行）
  F('frame/86', (dt, time) => {
ctx.chandelier.rotation.z = Math.cos(time * 0.53) * 0.012;
  })

  // L879–L880（2 行）
  F('frame/87', (dt, time) => {
const lampBreath = 0.9 + 0.1 * Math.sin(time * 2.1);
ctx.lampGlowMatA.opacity = ctx.lampP * 0.38 * lampBreath;
  })

  // L881–L881（1 行）
  F('frame/88', (dt, time) => {
ctx.lampGlowMatB.opacity = ctx.lampP * 0.13 * (0.9 + 0.1 * Math.sin(time * 2.1 + 1.0));
  })

  // L882–L882（1 行）
  F('frame/89', (dt, time) => {
ctx.lampCrystalMat.color.setRGB(0.45 + 0.55 * ctx.lampP, 0.45 + 0.4 * ctx.lampP, 0.5 + 0.12 * ctx.lampP);
  })

  // L883–L883（1 行）
  F('frame/90', (dt, time) => {
ctx.lampCrystal.rotation.y += 0.012;
  })

  // L884–L884（1 行）
  F('frame/91', (dt, time) => {
ctx.pendant.rotation.y -= 0.008;
  })

  // ★ J4.22：原 `frame/92`（`ctx.ptLantern += …`）已并入吊挂木灯物件的 `update()`
  //   —— 一件物件只有一个 `update`，故它与那五段几何分支合并在 `frame/18` 的位置执行
  //   （提前约 74 个帧任务，等价性论证见 `world/floor1/hangingLantern.js` 文件头「★ 帧顺序」）。
  //   本帧任务已删除，槽位 0 的强度改由 `lights()` 的 `strength: () => s.pt` 惰性读取。

  // ★ J4.28：原 `frame/93`（`ctx.ptKot += …`）已并入暖桌物件的 `update()`
  //   —— 与 `frame/31`–`frame/33` 的三段几何分支合并在那里执行（提前，等价性论证见
  //   `world/floor1/kotatsu.js` 文件头「★ 帧顺序」）。槽位 3 的强度改由
  //   `lights()` 的 `strength: (time) => s.pt * (0.82 + …)` 惰性读取。

  // ★ J4.24：原 `frame/94`（`ctx.ptMc += …`）已并入紫色魔法阵物件的 `update()`
  //   —— 与 `frame/38` 的几何分支合并在那里执行（提前，等价性论证见
  //   `world/floor1/magicCircle.js` 文件头「★ 帧顺序」）。槽位 2 的强度改由
  //   `lights()` 的 `strength: () => s.pt` 惰性读取。

  // ★ J4.25：原 `frame/95`（`ctx.ptCb += …`）已并入水晶球占卜台物件的 `update()`
  //   —— 与 `frame/25` 的几何分支合并在那里执行（提前，等价性论证见
  //   `world/floor1/crystalBall.js` 文件头「★ 帧顺序」）。槽位 4 的强度改由
  //   `lights()` 的 `strength: () => s.pt` 惰性读取。

  // ★ J4.23：原 `frame/96`（`ctx.ptPlant += …`）已并入月光魔法盆栽物件的 `update()`
  //   —— 与 `frame/26` 的几何分支合并在那里执行（提前，等价性论证见
  //   `world/floor1/moonPlant.js` 文件头「★ 帧顺序」）。槽位 7 的强度改由
  //   `lights()` 的 `strength: () => s.pt` 惰性读取。

  // L894–L894（1 行）
  F('frame/97', (dt, time) => {
ctx.lightField.update(time, dt);
  })

  // L896–L896（1 行）
  F('frame/98', (dt, time) => {
if (ctx.camShake > 0.002) {
                    // J2.7：抖动位移交给 CameraRig；衰减与判据留在这里（它们是本文件的状态量）
                    ctx.cameraRig.applyShake(ctx.camShake, runtimeRng);
                    ctx.camShake *= Math.exp(-3.2 * dt);
                }
  })

  // L903–L903（1 行）
  F('frame/99', (dt, time) => {
if (ctx.testCam) ctx.cameraRig.applyTestCamera(ctx.testCam);
  })

  // L905–L905（1 行）
  F('frame/100', (dt, time) => {
ctx.renderer.render(ctx.scene, ctx.camera);
  })

  // L907–L907（1 行）
  F('frame/101', (dt, time) => {
if (clock.mode === 'manual') ctx.updateNewDecor(time, dt);
  })
}
