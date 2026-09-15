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

  // L197–L197（1 行）
  F('frame/02', (dt, time) => {
ctx.updateWeatherSystem(dt, time);
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
  F('frame/13', (dt, time) => {
for (const c of ctx.chairs) {
                    const u = c.userData;
                    const target = u.open ? 0.45 : 0;
                    u.vel += (target - u.cur) * 0.02;
                    u.vel *= 0.88;
                    u.cur += u.vel;
                    c.position.x = u.bx + u.ax * u.cur;
                    c.position.z = u.bz + u.az * u.cur;
                }
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

  // L252–L252（1 行）
  F('frame/18', (dt, time) => {
ctx.lanternPivot.rotation.x = Math.sin(time * 1.2) * 0.045;
  })

  // L253–L253（1 行）
  F('frame/19', (dt, time) => {
ctx.lanternPivot.rotation.z = Math.sin(time * 0.9 + 1) * 0.05;
  })

  // L254–L254（1 行）
  F('frame/20', (dt, time) => {
ctx.lanternFlame.visible = ctx.lanternLit;
  })

  // L255–L255（1 行）
  F('frame/21', (dt, time) => {
ctx.halo.visible = ctx.beam.visible = ctx.floorPool.visible = ctx.floorPool2.visible = ctx.tablePool.visible = ctx.lanternLit;
  })

  // L256–L256（1 行）
  F('frame/22', (dt, time) => {
if (ctx.lanternLit) {
                    const fk = 1 + Math.sin(time * 9) * 0.10 + Math.sin(time * 13.7) * 0.04;
                    ctx.lanternFlame.scale.set(1, fk, 1);
                    ctx.haloMat.opacity = 0.11 + 0.04 * fk;
                    ctx.beamMat.opacity = 0.07 + 0.025 * fk;
                    ctx.glowMatA.opacity = 0.07 + 0.025 * fk;
                    ctx.glowMatB.opacity = 0.06 + 0.02 * fk;
                }
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
  F('frame/25', (dt, time) => {
{
                    if (ctx.cbRun > 0) ctx.cbRun -= dt;
                    const act = ctx.cbRun > 0;
                    for (let i = 0; i < ctx.cbMists.length; i++)
                        ctx.cbMists[i].l.rotation.y += dt * (act ? 2.0 + i * 0.5 : 0.35 + i * 0.1);
                    for (let i = 0; i < ctx.cbStars.length; i++) {
                        ctx.cbStars[i].rotation.y += dt * (act ? 3.0 : 0.8);
                        ctx.cbStars[i].position.y = (i % 2 ? 0.07 : -0.05) + Math.sin(time * 1.4 + i * 1.7) * 0.02;
                    }
                    ctx.cbMistMat.opacity = act ? 0.85 : 0.5;
                    ctx.cbGlowMat.opacity = act ? 0.10 + 0.06 * Math.sin(time * 6) : 0;
                }
  })

  // L313–L313（1 行）
  F('frame/26', (dt, time) => {
{
                    if (ctx.plantRun > 0) ctx.plantRun -= dt;
                    const act = ctx.plantRun > 0;
                    for (const s of ctx.plantStems) {
                        s.stem.rotation.z = Math.sin(time * 1.2 + s.ph) * 0.05 + (act ? Math.sin(time * 5 + s.ph) * 0.06 : 0);
                        s.stem.rotation.x = Math.cos(time * 0.9 + s.ph) * 0.04;
                    }
                    for (const b of ctx.plantBerries) {
                        b.obj.scale.setScalar(act ? 1 + 0.25 * Math.sin(time * 7 + b.ph) : 1);
                        b.m.opacity = act ? 1 : 0.85;
                    }
                }
  })

  // L327–L327（1 行）
  F('frame/27', (dt, time) => {
{
                    ctx.cartP += ((ctx.cartOut ? 1 : 0) - ctx.cartP) * 0.07;
                    ctx.cartG.position.set(ctx.CART_P0.x + ctx.CART_DIR.x * ctx.CART_DIST * ctx.cartP, 0,
                        ctx.CART_P0.z + ctx.CART_DIR.z * ctx.CART_DIST * ctx.cartP);
                    ctx.cartG.updateMatrixWorld(true);
                    const dC = ctx.cartP - ctx.cartPrevP;
                    if (Math.abs(dC) > 1e-5)
                        for (const w of ctx.cartWheels) w.children[0].rotation.y -= dC * 16;
                    ctx.cartPrevP = ctx.cartP;
                }
  })

  // L339–L339（1 行）
  F('frame/28', (dt, time) => {
{
                    if (ctx.quillRun > 0) {
                        ctx.quillRun -= dt;
                        const p = 1 - Math.max(ctx.quillRun, 0) / ctx.QUILL_T;
                        ctx._cw.set(ctx.QUILL_REST.pos[0], ctx.QUILL_REST.pos[1], ctx.QUILL_REST.pos[2]);
                        ctx.cartG.localToWorld(ctx._cw);
                        const restX = ctx._cw.x, restY = ctx._cw.y, restZ = ctx._cw.z;
                        const sX = ctx.QW_A.x, sY = ctx.QW_A.y + 0.08, sZ = ctx.QW_A.z;
                        const eX = ctx.QW_B.x, eY = ctx.QW_B.y + 0.08, eZ = ctx.QW_B.z;
                        let px, py, pz, rx = ctx.QUILL_REST.rotX, rz = ctx.QUILL_REST.rotZ;
                        if (p < 0.10) {
                            const u = ctx.sm01(p / 0.10);
                            px = restX + (sX - restX) * u;
                            py = restY + (sY - restY) * u + Math.sin(u * Math.PI) * 0.30;
                            pz = restZ + (sZ - restZ) * u;
                            rx = -0.25; rz = 0.10;
                        } else if (p < 0.70) {
                            const u = (p - 0.10) / 0.60;
                            px = sX + (eX - sX) * u;
                            py = sY + (eY - sY) * u + Math.sin(u * Math.PI * 6) * 0.02;
                            pz = sZ + (eZ - sZ) * u;
                            rx = -0.85 + Math.sin(u * Math.PI * 10) * 0.10;
                            rz = 0.22;
                            for (let i = 0; i < 8; i++) {
                                if (!ctx.magicGlyphs[i].active && u > (i + 0.25) / 8) {
                                    ctx.magicGlyphs[i].active = true;
                                    ctx.magicGlyphs[i].age = 0;
                                    ctx.magicGlyphs[i].sp.visible = true;
                                }
                            }
                        } else if (p < 0.80) {
                            const u = (p - 0.70) / 0.10;
                            px = eX; py = eY + Math.sin(u * Math.PI) * 0.05; pz = eZ;
                            rx = -0.5; rz = 0.15;
                        } else {
                            const u = ctx.sm01((p - 0.80) / 0.20);
                            px = eX + (restX - eX) * u;
                            py = eY + (restY - eY) * u + Math.sin(u * Math.PI) * 0.30;
                            pz = eZ + (restZ - eZ) * u;
                            rx = -0.25 * (1 - u) + ctx.QUILL_REST.rotX * u;
                            rz = 0.10 * (1 - u) + ctx.QUILL_REST.rotZ * u;
                        }
                        ctx._cw.set(px, py, pz);
                        ctx.cartG.worldToLocal(ctx._cw);
                        ctx.quillG.position.copy(ctx._cw);
                        ctx.quillG.rotation.set(rx, 0, rz);
                        if (ctx.quillRun <= 0) {
                            ctx.quillG.position.set(ctx.QUILL_REST.pos[0], ctx.QUILL_REST.pos[1], ctx.QUILL_REST.pos[2]);
                            ctx.quillG.rotation.set(ctx.QUILL_REST.rotX, 0, ctx.QUILL_REST.rotZ);
                        }
                    }
                }
  })

  // L393–L393（1 行）
  F('frame/29', (dt, time) => {
{
                    for (const g of ctx.magicGlyphs) {
                        if (g.active) {
                            g.age += dt;
                            const k = g.age / g.life;
                            if (k >= 1) { g.active = false; g.sp.visible = false; continue; }
                            const pop = Math.min(g.age * 7, 1);
                            g.mat.opacity = 0.95 * pop * (1 - Math.max(0, (k - 0.55) / 0.45));
                            g.sp.position.set(g.base.x + Math.sin(g.age * 2.2) * 0.02,
                                g.base.y + k * 0.20,
                                g.base.z);
                            const s = 0.16 * pop * (1 + 0.10 * Math.sin(g.age * 7));
                            g.sp.scale.set(s, s, 1);
                        }
                    }
                }
  })

  // L411–L411（1 行）
  F('frame/30', (dt, time) => {
{
                    if (ctx.paperRun > 0) {
                        ctx.paperRun -= dt;
                        const elapsed = ctx.PAPER_T - ctx.paperRun;
                        for (let i = 0; i < ctx.papers.length; i++) {
                            const pp = ctx.papers[i];
                            const delay = i * 0.12;
                            const D = ctx.PAPER_T - delay;
                            let ti = (elapsed - delay) / D;
                            if (ti < 0) ti = 0;
                            if (ti > 1) ti = 1;
                            ctx._cw.copy(pp.home);
                            ctx.cartG.localToWorld(ctx._cw);
                            const hx = ctx._cw.x, hy = ctx._cw.y, hz = ctx._cw.z;
                            const a0 = pp.a0, r = pp.r;
                            const cirY = (a) => 1.45 + Math.sin(a * 3 + i) * 0.22;
                            let pos;
                            if (ti < 0.18) {
                                const u = ctx.sm01(ti / 0.18);
                                const cx = Math.cos(a0) * r, cy = cirY(a0), cz = Math.sin(a0) * r;
                                pos = {
                                    x: hx + (cx - hx) * u,
                                    y: hy + (cy - hy) * u + Math.sin(u * Math.PI) * 0.40,
                                    z: hz + (cz - hz) * u
                                };
                            } else if (ti < 0.78) {
                                const s = (ti - 0.18) / 0.60;
                                const a = a0 + s * Math.PI * 2;
                                pos = { x: Math.cos(a) * r, y: cirY(a), z: Math.sin(a) * r };
                            } else {
                                const u = ctx.sm01((ti - 0.78) / 0.22);
                                const cx = Math.cos(a0 + Math.PI * 2) * r, cy = cirY(a0 + Math.PI * 2), cz = Math.sin(a0 + Math.PI * 2) * r;
                                pos = {
                                    x: cx + (hx - cx) * u,
                                    y: cy + (hy - cy) * u + Math.sin(u * Math.PI) * 0.35,
                                    z: cz + (hz - cz) * u
                                };
                            }
                            ctx._cw.set(pos.x, pos.y, pos.z);
                            ctx.cartG.worldToLocal(ctx._cw);
                            pp.g.position.copy(ctx._cw);
                            if (ti > 0.02 && ti < 0.98) {
                                pp.g.rotation.set(Math.sin(time * 7 + i * 1.3) * 0.9,
                                    time * 2.5 + i,
                                    Math.cos(time * 5 + i * 0.9) * 0.7);
                            } else {
                                pp.g.rotation.set(0, pp.ry0, 0);
                            }
                        }
                        if (ctx.paperRun <= 0) {
                            for (const pp of ctx.papers) {
                                pp.g.position.copy(pp.home);
                                pp.g.rotation.set(0, pp.ry0, 0);
                            }
                        }
                    }
                }
  })

  // L470–L470（1 行）
  F('frame/31', (dt, time) => {
{
                    if (ctx.kotGlowMat) {
                        ctx.kotGlowMat.opacity = ctx.kotatsuOn ? 0.07 + 0.05 * (0.5 + 0.5 * Math.sin(time * 4.2)) : 0;
                    }
                    if (ctx.radioNoteRun > 0) {
                        ctx.radioNoteRun -= dt;
                        for (const nt of ctx.radioNotes) {
                            const p = (time * 0.55 + nt.ph) % 1;
                            if (p < 0.85) {
                                nt.g.visible = true;
                                const env = Math.min(p * 7, 1) * (1 - Math.max(0, (p - 0.7) / 0.15));
                                ctx.noteMat.opacity = 0.9 * env;
                                const src = ctx.radioG.userData.noteSrc;
                                src.getWorldPosition(ctx._tv);
                                nt.g.position.set(
                                    ctx._tv.x + Math.sin(time * 2 + nt.ph * 6) * 0.030 + p * 0.06,
                                    ctx._tv.y + p * 0.28,
                                    ctx._tv.z + Math.cos(time * 1.6 + nt.ph * 5) * 0.025
                                );
                                nt.g.rotation.y = Math.sin(time * 3 + nt.ph * 4) * 0.6;
                                nt.g.rotation.z = Math.sin(time * 2.5 + nt.ph * 3) * 0.25;
                            } else {
                                nt.g.visible = false;
                            }
                        }
                    } else {
                        for (const nt of ctx.radioNotes) nt.g.visible = false;
                    }
                }
  })

  // L501–L501（1 行）
  F('frame/32', (dt, time) => {
{
                    const n = ctx.oranges.length;
                    if (ctx.orangeState === 'out' || ctx.orangeState === 'back') {
                        ctx.orangeT += dt;
                        let done = true;
                        for (let i = 0; i < n; i++) {
                            const o = ctx.oranges[i];
                            const delay = i * 0.085;
                            let p = Math.min(Math.max((ctx.orangeT - delay) / 0.65, 0), 1);
                            if (p < 1) done = false;
                            const e = p * p * (3 - 2 * p);
                            const f = ctx.orangeState === 'out' ? e : 1 - e;
                            o.mesh.position.set(
                                o.hx + (o.tx - o.hx) * f,
                                o.hy + (o.ty - o.hy) * f + Math.sin(f * Math.PI) * 0.09,
                                o.hz + (o.tz - o.hz) * f
                            );
                            o.mesh.rotation.set(o.ax * f, 0, o.az * f);
                        }
                        if (done) ctx.orangeState = ctx.orangeState === 'out' ? 'rolled' : 'inbowl';
                    }
                }
  })

  // L525–L525（1 行）
  F('frame/33', (dt, time) => {
{
                    for (const c of ctx.cushions) {
                        if (c.anim) {
                            c.p += dt * 2.2;
                            if (c.p >= 1) { c.p = 1; c.anim = 0; }
                            const e = c.p * c.p * (3 - 2 * c.p);
                            const ang = c.from + (c.to - c.from) * e;
                            c.g.rotation.x = ang;
                            c.g.position.y = Math.sin(c.p * Math.PI) * 0.24 + (ang / Math.PI) * 0.125;
                        }
                    }
                }
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
  F('frame/36', (dt, time) => {
for (const b of ctx.shelfBooks) {
                    const u = b.userData;
                    const target = u.out ? 1 : 0;
                    u.vel += (target - u.cur) * 0.03;
                    u.vel *= 0.85;
                    u.cur += u.vel;
                    b.position.x = u.bx + 0.11 * u.cur;
                }
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
  F('frame/38', (dt, time) => {
{
                    if (ctx.mcRun > 0) ctx.mcRun -= dt;
                    const prog = ctx.mcRun > 0 ? 1 - ctx.mcRun / 8.0 : 1;
                    let inten = 0;
                    if (ctx.mcRun > 0) {
                        if (prog < 0.12) inten = prog / 0.12;
                        else if (prog < 0.82) inten = 1;
                        else inten = 1 - (prog - 0.82) / 0.18;
                    }
                    ctx.mcMat.opacity = 0.5 + 0.5 * inten;
                    ctx.mcBase.rotation.y += dt * (0.15 + 2.8 * inten);
                    for (const f of ctx.mcFloats) {
                        const ap = Math.min(Math.max((prog - (0.10 + f.ph * 0.07)) / 0.20, 0), 1);
                        const show = ctx.mcRun > 0 && ap > 0 && inten > 0.02;
                        f.g.visible = show;
                        if (show) {
                            const e = ap * ap * (3 - 2 * ap);
                            f.g.position.y = 0.05 + f.ty * e + Math.sin(time * 1.5 + f.ph) * 0.03;
                            f.g.rotation.y += dt * f.spd;
                            f.g.scale.setScalar(0.5 + 0.5 * e);
                            f.m.opacity = 0.85 * inten * e;
                        }
                    }
                    for (const q of ctx.mcParts) {
                        const show = inten > 0.04;
                        q.p.visible = show;
                        if (show) {
                            const pr = (q.ph + time * 0.35) % 1;
                            const a = q.a + time * q.spd;
                            q.p.position.set(ctx.MC_X + Math.cos(a) * q.r, 0.05 + pr * 2.5, ctx.MC_Z + Math.sin(a) * q.r);
                            const sc = Math.sin(pr * Math.PI) * inten;
                            q.p.scale.setScalar(Math.max(sc, 0.001));
                            q.p.rotation.y = time * 2;
                        }
                    }
                }
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
  F('frame/45', (dt, time) => {
for (const c of ctx.cups) {
                    const u = c.userData;
                    if (u.run > 0) u.run -= dt;
                    const prog = u.run > 0 ? Math.min(Math.max(1 - u.run / 2.6, 0), 1) : 1;
                    const env = u.run > 0 ? Math.sin(Math.PI * prog) : 0;
                    u.lift = env * 0.13;
                    c.position.y = u.baseY + u.lift;
                    u.steam.visible = u.run > 0;
                    if (u.steam.visible) {
                        u.steam.position.y = 0.10 + (time * 0.25) % 0.07;
                        const ss = 0.85 + 0.15 * Math.sin(time * 5);
                        u.steam.scale.set(ss, 1, ss);
                    }
                }
  })

  // L669–L669（1 行）
  F('frame/46', (dt, time) => {
{
                    // J3（B4）：桌面散放餐具的弹跳已搬入 world/floor1/tableware.js（原地 tick）
                    ctx.tablewareApi.tick(dt, time);
                }
  })

  // L675–L675（1 行）
  F('frame/47', (dt, time) => {
{
                    if (ctx.potRun > 0) ctx.potRun -= dt;
                    const p = ctx.potRun > 0 ? 1 - ctx.potRun / ctx.POT_T : 0;
                    const dirX = Math.sin(ctx.POT_RY), dirZ = Math.cos(ctx.POT_RY);
                    const hx = ctx.CUP_T.position.x - dirX * ctx.POT_TIP_FWD;
                    const hz = ctx.CUP_T.position.z - dirZ * ctx.POT_TIP_FWD;
                    const sm = tt => tt * tt * (3 - 2 * tt);
                    let ly = 0, dx = 0, dz = 0, tilt = 0;
                    if (p > 0) {
                        if (p < 0.14) {
                            ly = sm(p / 0.14) * 0.45;
                        } else if (p < 0.30) {
                            const u = sm((p - 0.14) / 0.16);
                            ly = 0.45; dx = u * (hx - ctx.POT_BX); dz = u * (hz - ctx.POT_BZ);
                        } else if (p < 0.40) {
                            const u = sm((p - 0.30) / 0.10);
                            ly = 0.45; dx = hx - ctx.POT_BX; dz = hz - ctx.POT_BZ; tilt = u * ctx.POT_TILT;
                        } else if (p < 0.70) {
                            ly = 0.45; dx = hx - ctx.POT_BX; dz = hz - ctx.POT_BZ; tilt = ctx.POT_TILT;
                        } else if (p < 0.80) {
                            const u = sm((p - 0.70) / 0.10);
                            ly = 0.45; dx = hx - ctx.POT_BX; dz = hz - ctx.POT_BZ; tilt = (1 - u) * ctx.POT_TILT;
                        } else if (p < 0.94) {
                            const u = sm((p - 0.80) / 0.14);
                            ly = 0.45; dx = (1 - u) * (hx - ctx.POT_BX); dz = (1 - u) * (hz - ctx.POT_BZ);
                        } else {
                            const u = sm((p - 0.94) / 0.06);
                            ly = (1 - u) * 0.45;
                        }
                    }
                    const floating = p > 0.02 && p < 0.98;
                    const bob = floating ? Math.sin(time * 3) * 0.012 : 0;
                    ctx.teapotPos.position.set(ctx.POT_BX + dx, ctx.DTOP + ly + bob, ctx.POT_BZ + dz);
                    ctx.teapot.rotation.x = tilt;
                    ctx.potHalo.visible = floating;
                    if (floating) ctx.potHaloMat.opacity = 0.09 + 0.04 * (0.5 + 0.5 * Math.sin(time * 5));
                    if (tilt > 0.45) {
                        ctx.potStream.visible = true;
                        ctx.potSpoutTip.getWorldPosition(ctx._tv);
                        const ex = ctx.CUP_T.position.x, ey = ctx.CUP_T.position.y + 0.10, ezz = ctx.CUP_T.position.z;
                        const arr = ctx.potStreamGeom.attributes.position.array;
                        for (let i = 0; i < 10; i++) {
                            const tt = i / 9;
                            const wob = Math.sin(tt * Math.PI);
                            arr[i * 3] = ctx._tv.x + (ex - ctx._tv.x) * tt + Math.sin(tt * 9 + time * 8) * 0.008 * wob;
                            arr[i * 3 + 1] = ctx._tv.y + (ey - ctx._tv.y) * tt - 0.035 * wob;
                            arr[i * 3 + 2] = ctx._tv.z + (ezz - ctx._tv.z) * tt + Math.cos(tt * 7 + time * 6) * 0.008 * wob;
                        }
                        ctx.potStreamGeom.attributes.position.needsUpdate = true;
                    } else {
                        ctx.potStream.visible = false;
                    }
                }
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
  F('frame/51', (dt, time) => {
ctx.chairT += ((ctx.chairOpen ? 1 : 0) - ctx.chairT) * 0.07;
  })

  // L763–L764（2 行）
  F('frame/52', (dt, time) => {
const ck = ctx.smooth(Math.max(0, Math.min(1, ctx.chairT)));
ctx.chairG.position.z = ctx.CHAIR_IN + (ctx.CHAIR_OUT - ctx.CHAIR_IN) * ck;
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

  // L785–L785（1 行）
  F('frame/63', (dt, time) => {
ctx.updateBook(time, dt);
  })

  // L788–L788（1 行）
  F('prop/calendar', (dt, time) => {
ctx.calendarApi.tick(dt, time);
  })

  // L789–L789（1 行）
  F('frame/65', (dt, time) => {
ctx.updateGlyphs(time, dt);
  })

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

  // L887–L887（1 行）
  F('frame/92', (dt, time) => {
ctx.ptLantern += ((ctx.lanternLit ? 1 : 0) - ctx.ptLantern) * 0.07;
  })

  // L888–L888（1 行）
  F('frame/93', (dt, time) => {
ctx.ptKot += ((ctx.kotatsuOn ? 1 : 0) - ctx.ptKot) * 0.07;
  })

  // L889–L889（1 行）
  F('frame/94', (dt, time) => {
ctx.ptMc += ((ctx.mcRun > 0 ? 1 : 0) - ctx.ptMc) * 0.055;
  })

  // L890–L890（1 行）
  F('frame/95', (dt, time) => {
ctx.ptCb += ((ctx.cbRun > 0 ? 1 : 0) - ctx.ptCb) * 0.055;
  })

  // L891–L891（1 行）
  F('frame/96', (dt, time) => {
ctx.ptPlant += ((ctx.plantRun > 0 ? 1 : 0) - ctx.ptPlant) * 0.055;
  })

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
