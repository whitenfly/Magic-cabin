/**
 * updatePlayer / 相机解算 / 史莱姆落地 —— 从 `legacy/monolith.js` 搬出的整段（playerCtrl）
 *
 * 来源：`J4` 段切片（段表见 `scripts/oneoff/_j4-segments.mjs`）。
 * 段内代码**逐字未改**，只做了三件事：包成函数、补 import、把跨段通信交给 `ctx`。
 * 因此这个文件的正确性判据与搬迁前完全一致：像素逐字节零差异。
 *
 * @param {object} ctx 段间通信载体（见 `installCabin` 的 `__J4_CTX__`）
 * @param {object} app 应用内核 —— 段里用到的 `registry`/`bus`/`scheduler`/`store` 从这里解构
 */
export function installPlayerController(ctx, app) {
            // ↓ J4 段导出（playerCtrl）：本段函数声明挂到 ctx（借提升，段内任何位置都可见）
            ctx.lerpAngle = lerpAngle; ctx.slimeLand = slimeLand; ctx.updatePlayer = updatePlayer;
            function lerpAngle(a, b, t) { let d = (b - a + Math.PI * 3) % (Math.PI * 2) - Math.PI; return a + d * t; }
            function slimeLand(time) { if (ctx.player.vy < -3.0) { const impact = Math.min(1.5, (-ctx.player.vy - 3.0) * 0.30); ctx.slime.squashV -= impact; ctx.slime.wobV += impact * 2.6; } ctx.player.pos.y = ctx.groundAt(ctx.player.pos.x, ctx.player.pos.z, ctx.player.pos.y); ctx.player.pos.y = Math.max(ctx.player.pos.y, 0); ctx.player.vy = 0; ctx.player.onGround = true; ctx.player.groundT = time; }
            function updatePlayer(dt, time) {
                ctx.refreshPlatforms();
                if (ctx.pendYaw !== 0 || ctx.pendPitch !== 0) { const APPLY = 0.6; if (ctx.viewMode === 'fixed') { ctx.fixYaw += ctx.pendYaw * APPLY; ctx.fixPitch += ctx.pendPitch * APPLY; ctx.fixPitch = Math.max(0.05, Math.min(1.45, ctx.fixPitch)); } else { ctx.camYaw += ctx.pendYaw * APPLY; ctx.camPitch += ctx.pendPitch * APPLY; if (ctx.viewMode === 'fp') ctx.camPitch = Math.max(-1.2, Math.min(1.2, ctx.camPitch)); else ctx.camPitch = Math.max(-0.25, Math.min(1.15, ctx.camPitch)); } ctx.pendYaw *= (1 - APPLY); ctx.pendPitch *= (1 - APPLY); if (Math.abs(ctx.pendYaw) < 1e-5) ctx.pendYaw = 0; if (Math.abs(ctx.pendPitch) < 1e-5) ctx.pendPitch = 0; }
                if (ctx.viewMode === 'fixed') ctx.camYaw = ctx.fixYaw + Math.PI;
                const typing = document.activeElement === ctx.signInput || document.activeElement === ctx.noteInput || document.activeElement === ctx.picInput; let ix = 0, iz = 0;
                if (!typing) { if (ctx.keys['KeyW'] || ctx.keys['ArrowUp']) iz += 1; if (ctx.keys['KeyS'] || ctx.keys['ArrowDown']) iz -= 1; if (ctx.keys['KeyA'] || ctx.keys['ArrowLeft']) ix -= 1; if (ctx.keys['KeyD'] || ctx.keys['ArrowRight']) ix += 1; ix += ctx.joyX; iz += -ctx.joyY; const m = Math.hypot(ix, iz); if (m > 1) { ix /= m; iz /= m; } }
                const joyFull = Math.hypot(ctx.joyX, ctx.joyY) > 0.85; const running = !!(ctx.keys['ShiftLeft'] || ctx.keys['ShiftRight']) || ctx.sprintBtnDown || joyFull; const maxSpeed = running ? 3.2 : 1.6;
                let tx = 0, tz = 0; if (ix !== 0 || iz !== 0) { const fx = Math.sin(ctx.camYaw), fz = Math.cos(ctx.camYaw); const rx = -Math.cos(ctx.camYaw), rz = Math.sin(ctx.camYaw); tx = (fx * iz + rx * ix) * maxSpeed; tz = (fz * iz + rz * ix) * maxSpeed; }
                ctx.player.moveSpeed += (Math.hypot(tx, tz) - ctx.player.moveSpeed) * Math.min(1, dt * 10); const spd = ctx.player.moveSpeed; const moving = spd > 0.12;
                if (moving) ctx.slime.pulse += dt * (2.6 + spd * 1.3);
                const creep = moving ? 0.45 + 0.55 * Math.max(0, Math.sin(ctx.slime.pulse - 0.5)) : 1;
                const ox = ctx.player.pos.x, oz = ctx.player.pos.z; let nx = ctx.player.pos.x + tx * dt * creep, nz = ctx.player.pos.z + tz * dt * creep;
                [nx, nz] = ctx.collideXZ(nx, nz, ctx.player.pos.y);[nx, nz] = ctx.railCollide(nx, nz, ctx.player.pos.y, ox, oz); ctx.player.pos.x = nx; ctx.player.pos.z = nz;
                const ground = ctx.groundAt(ctx.player.pos.x, ctx.player.pos.z, ctx.player.pos.y);
                if (ctx.player.pos.y <= ground + 0.001 && ctx.player.vy <= 0) { if (ctx.player.pos.y - ground > 0.5) ctx.player.vy = 0; else slimeLand(time); }
                if (ctx.player.pos.y > ground + 0.001 || ctx.player.vy > 0) { ctx.player.vy -= 22 * dt; ctx.player.pos.y += ctx.player.vy * dt; const g2 = ctx.groundAt(ctx.player.pos.x, ctx.player.pos.z, ctx.player.pos.y); if (ctx.player.pos.y <= g2 && ctx.player.vy <= 0) slimeLand(time); else if (ctx.player.pos.y > g2) ctx.player.onGround = false; }
                if (spd > 0.15) ctx.player.yaw = lerpAngle(ctx.player.yaw, Math.atan2(tx, tz), Math.min(1, dt * 9));
                const breathe = 1 + Math.sin(time * 1.7) * 0.03; const pulseSq = moving ? 1 - 0.10 * Math.max(0, Math.sin(ctx.slime.pulse - 0.9)) : 1; let jumpSq = 1;
                if (!ctx.player.onGround) jumpSq = ctx.player.vy > 2 ? 1.22 : (ctx.player.vy < -2 ? 1.12 : 1.07);
                const targetS = ctx.SLIME_FLAT * breathe * pulseSq * jumpSq;
                ctx.slime.squashV += (targetS - ctx.slime.squash) * 165 * dt; ctx.slime.squashV *= Math.exp(-6.2 * dt); ctx.slime.squash += ctx.slime.squashV * dt;
                const sy = Math.max(0.45, Math.min(1.5, ctx.slime.squash)); const sxz = (1 / Math.sqrt(sy)) * (1 + ctx.slime.wob * 0.10);
                ctx.slime.wobV += (-ctx.slime.wob) * 55 * dt; ctx.slime.wobV *= Math.exp(-3.4 * dt); ctx.slime.wob += ctx.slime.wobV * dt; const wob = Math.max(-0.35, Math.min(0.35, ctx.slime.wob));
                ctx.slimeRoot.position.set(ctx.player.pos.x, ctx.player.pos.y, ctx.player.pos.z); ctx.slimeRoot.rotation.y = ctx.player.yaw; ctx.slimeBody.scale.set(sxz, sy, sxz); ctx.slimeBody.position.y = ctx.SLIME_R * sy;
                const leanT = Math.min(spd / 1.6, 1) * 0.15; ctx.slime.tiltV += (leanT - ctx.slime.tilt) * 130 * dt; ctx.slime.tiltV *= Math.exp(-5 * dt); ctx.slime.tilt += ctx.slime.tiltV * dt;
                ctx.slimeBody.rotation.x = ctx.slime.tilt + wob * 0.35; ctx.slimeBody.rotation.z = Math.sin(time * 2.1) * 0.02 + Math.sin(ctx.slime.pulse * 0.5) * 0.035 * Math.min(spd / 1.6, 1) + wob * 0.55;
                const casting = ctx.blast.active && ctx.blast.t < ctx.T_BOOM;
                if (casting) ctx.slime.pulse += dt * 3;
                const wAmp = moving ? 0.013 + 0.007 * Math.min(spd / 1.6, 1) : (casting ? 0.016 : 0.005);
                const wSpd = moving ? 7.5 : (casting ? 5 : 1.5);
                ctx.deformSlime(time, wAmp, wSpd);
                ctx.core.scale.setScalar(1 + 0.06 * Math.sin(time * 2.4 + ctx.slime.pulse) + (casting ? 0.15 : 0)); ctx.core.position.set(Math.sin(time * 1.3) * 0.012, 0.015 * Math.sin(time * 1.9), Math.sin(time * 1.1) * 0.010);
                for (const b of ctx.bubbles) { const t = (time * 0.22 + b.userData.ph) % 1; const r2 = b.userData.rr * (1 - t * 0.45); b.position.set(Math.cos(b.userData.ang) * r2, -0.12 + t * 0.24, Math.sin(b.userData.ang) * r2); b.scale.setScalar(0.5 + 0.5 * Math.sin(t * Math.PI)); }
                const shs = 1 / Math.sqrt(sy); ctx.slimeShadow.scale.set(shs, shs, 1); ctx.slimeShadow.material.opacity = 0.10 + 0.10 / sy;
                // J2.7：三段解算搬进 CameraRig（按当前视角选 solver；原先是 if / else if / else 三段）
                ctx.cameraRig.update({ fixYaw: ctx.fixYaw, fixPitch: ctx.fixPitch, fixDist: ctx.fixDist, camYaw: ctx.camYaw, camPitch: ctx.camPitch, viewDist: ctx.viewDist, player: ctx.player, look: ctx.FIX_LOOK });
            }

            /* ==================== 天空·时间·天气系统 ==================== */
}
