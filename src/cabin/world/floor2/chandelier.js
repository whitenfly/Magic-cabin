/**
 * 二楼顶中央魔法吊灯 —— 从 `legacy/monolith.js` 搬出的整段（chandelier）
 *
 * 来源：`J4` 段切片（段表见 `scripts/oneoff/_j4-segments.mjs`）。
 * 段内代码**逐字未改**，只做了三件事：包成函数、补 import、把跨段通信交给 `ctx`。
 * 因此这个文件的正确性判据与搬迁前完全一致：像素逐字节零差异。
 *
 * @param {object} ctx 段间通信载体（见 `installCabin` 的 `__J4_CTX__`）
 * @param {object} app 应用内核 —— 段里用到的 `registry`/`bus`/`scheduler`/`store` 从这里解构
 */
import * as THREE from 'three'
import { scene } from '../../app/rng.js'

export function installChandelier(ctx, app) {
  const slimeRng = scene.slime
            // ↓ J4 段导出（chandelier）：本段函数声明挂到 ctx（借提升，段内任何位置都可见）
            ctx.deformSlime = deformSlime;
            ctx.lampLit = true; ctx.lampP = 1;
            const LAMP_Y = -0.95;
            ctx.LAMP_Y = LAMP_Y;
            const chandelier = new THREE.Group();
            ctx.chandelier = chandelier;
            chandelier.position.set(0, 6.3, 0);
            ctx.scene.add(chandelier);
            ctx.put(ctx.edge(new THREE.ConeGeometry(0.06, 0.16, 6)), 0, 0.15, 0, 0, 0, 0, chandelier);
            for (let i = 0; i < 4; i++) {
                ctx.put(ctx.edge(new THREE.TorusGeometry(0.045, 0.013, 6, 12)), 0, -0.03 - i * 0.09, 0, 0, (i % 2) * Math.PI / 2, 0, chandelier);
            }
            ctx.put(ctx.edge(new THREE.CylinderGeometry(0.02, 0.026, 0.62, 8)), 0, -0.63, 0, 0, 0, 0, chandelier);
            for (let i = 0; i < 3; i++) {
                const ang = i * Math.PI * 2 / 3 + 0.5;
                ctx.logBetween([0, -0.6, 0], [Math.cos(ang) * 0.55, LAMP_Y, Math.sin(ang) * 0.55], 0.015, chandelier);
            }
            ctx.put(ctx.edge(new THREE.TorusGeometry(0.55, 0.035, 8, 26)), 0, LAMP_Y, 0, Math.PI / 2, 0, 0, chandelier);
            for (let i = 0; i < 6; i++) {
                const ang = i * Math.PI / 3 + 0.26;
                const cx = Math.cos(ang) * 0.55, cz = Math.sin(ang) * 0.55;
                ctx.put(ctx.edge(new THREE.CylinderGeometry(0.014, 0.02, 0.16, 6)), cx, LAMP_Y + 0.08, cz, 0, 0, 0, chandelier);
                ctx.put(ctx.edge(new THREE.CylinderGeometry(0.052, 0.036, 0.03, 8)), cx, LAMP_Y + 0.175, cz, 0, 0, 0, chandelier);
                ctx.put(ctx.edge(new THREE.CylinderGeometry(0.028, 0.028, 0.17, 8)), cx, LAMP_Y + 0.27, cz, 0, 0, 0, chandelier);
                ctx.put(ctx.edge(new THREE.CylinderGeometry(0.006, 0.006, 0.03, 6)), cx, LAMP_Y + 0.365, cz, 0, 0, 0, chandelier);
            }
            const lampCrystalMat = new THREE.MeshBasicMaterial({ color: 0x73737e, transparent: true, opacity: 0.95 });
            ctx.lampCrystalMat = lampCrystalMat;
            const lampCrystal = new THREE.Group();
            ctx.lampCrystal = lampCrystal;
            { const cryG = new THREE.OctahedronGeometry(0.13); lampCrystal.add(new THREE.Mesh(cryG, lampCrystalMat)); lampCrystal.add(new THREE.LineSegments(new THREE.EdgesGeometry(cryG), ctx.MAT)); }
            ctx.put(lampCrystal, 0, LAMP_Y + 0.06, 0, 0, 0, 0, chandelier);
            const pendant = new THREE.Group();
            ctx.pendant = pendant;
            { const pG = new THREE.OctahedronGeometry(0.09); pendant.add(new THREE.Mesh(pG, lampCrystalMat)); pendant.add(new THREE.LineSegments(new THREE.EdgesGeometry(pG), ctx.MAT)); }
            ctx.put(ctx.edge(new THREE.CylinderGeometry(0.008, 0.008, 0.5, 6)), 0, LAMP_Y - 0.25, 0, 0, 0, 0, chandelier);
            ctx.put(pendant, 0, LAMP_Y - 0.58, 0, 0, 0, 0, chandelier);
            const lampGlowMatA = new THREE.MeshBasicMaterial({ color: 0xffd9a8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
            ctx.lampGlowMatA = lampGlowMatA;
            const lampGlowMatB = new THREE.MeshBasicMaterial({ color: 0xe0b4ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
            ctx.lampGlowMatB = lampGlowMatB;
            const glowA = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), lampGlowMatA);
            ctx.glowA = glowA;
            const glowB = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), lampGlowMatB);
            ctx.glowB = glowB;
            glowA.renderOrder = 7; glowB.renderOrder = 7;
            ctx.put(glowA, 0, LAMP_Y + 0.06, 0, 0, 0, 0, chandelier);
            ctx.put(glowB, 0, LAMP_Y + 0.06, 0, 0, 0, 0, chandelier);
            const chandelierFlames = [];
            ctx.chandelierFlames = chandelierFlames;
            for (let i = 0; i < 6; i++) {
                const ang = i * Math.PI / 3 + 0.26;
                const cx = Math.cos(ang) * 0.55, cz = Math.sin(ang) * 0.55;
                ctx.makeWavyFlame(cx, cz, LAMP_Y + 0.375, 0.14, 0.042, ctx.fireMid, i * 1.1, 3.3, chandelierFlames);
                ctx.makeWavyFlame(cx, cz, LAMP_Y + 0.395, 0.075, 0.02, ctx.fireIn, i * 1.1 + 2.0, 3.8, chandelierFlames);
            }
            for (const f of chandelierFlames) chandelier.add(f.obj);
            chandelier.userData.aimLabel = '点亮 / 熄灭魔法吊灯';
            ctx.regMagic(chandelier, () => { ctx.lampLit = !ctx.lampLit; });
            chandelier.userData.sfx = 'lamp';

            const MEMB_MAT = new THREE.MeshBasicMaterial({ color: 0x4fd695, transparent: true, opacity: 0.40, side: THREE.DoubleSide, depthWrite: false });
            ctx.MEMB_MAT = MEMB_MAT;
            const MID_MAT = new THREE.MeshBasicMaterial({ color: 0x8ce8b6, transparent: true, opacity: 0.34, side: THREE.DoubleSide, depthWrite: false });
            ctx.MID_MAT = MID_MAT;
            const CORE_MAT = new THREE.MeshBasicMaterial({ color: 0x2fbb7c, transparent: true, opacity: 0.50, side: THREE.DoubleSide, depthWrite: false });
            ctx.CORE_MAT = CORE_MAT;
            const BUBBLE_MAT = new THREE.MeshBasicMaterial({ color: 0xeafff2, transparent: true, opacity: 0.35, depthWrite: false });
            ctx.BUBBLE_MAT = BUBBLE_MAT;
            const slimeRoot = new THREE.Group();
            ctx.slimeRoot = slimeRoot; ctx.scene.add(slimeRoot); const slimeBody = new THREE.Group();
            ctx.slimeBody = slimeBody; slimeRoot.add(slimeBody);
            const SLIME_R = 0.30;
            ctx.SLIME_R = SLIME_R; const slimeGeo = new THREE.SphereGeometry(SLIME_R, 26, 18);
            ctx.slimeGeo = slimeGeo; const slimeOrig = slimeGeo.attributes.position.array.slice();
            ctx.slimeOrig = slimeOrig;
            const membrane = new THREE.Mesh(slimeGeo, MEMB_MAT);
            ctx.membrane = membrane; membrane.renderOrder = 3; slimeBody.add(membrane);
            const midLayer = new THREE.Mesh(slimeGeo, MID_MAT);
            ctx.midLayer = midLayer; midLayer.scale.setScalar(0.86); midLayer.renderOrder = 2; slimeBody.add(midLayer);
            const core = new THREE.Mesh(new THREE.SphereGeometry(0.145, 18, 14), CORE_MAT);
            ctx.core = core; core.renderOrder = 1; slimeBody.add(core);
            const bubbles = [];
            ctx.bubbles = bubbles;
            for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.016 + slimeRng() * 0.012, 8, 6), BUBBLE_MAT); b.renderOrder = 1; b.userData = { ph: slimeRng(), ang: slimeRng() * 6.28, rr: 0.03 + slimeRng() * 0.07 }; slimeBody.add(b); bubbles.push(b); }
            const slimeShadow = new THREE.Mesh(new THREE.CircleGeometry(0.24, 20), new THREE.MeshBasicMaterial({ color: 0x1e5a40, transparent: true, opacity: 0.16, depthWrite: false }));
            ctx.slimeShadow = slimeShadow; slimeShadow.rotation.x = -Math.PI / 2; slimeShadow.position.y = 0.012; slimeRoot.add(slimeShadow);
            const SLIME_FLAT = 0.78;
            ctx.SLIME_FLAT = SLIME_FLAT; const slime = { squash: SLIME_FLAT, squashV: 0, wob: 0, wobV: 0, tilt: 0, tiltV: 0, pulse: 2.0 };
            ctx.slime = slime;
            function deformSlime(time, amp, speed) { const arr = slimeGeo.attributes.position.array; const n = slimeGeo.attributes.position.count; for (let i = 0; i < n; i++) { const x0 = slimeOrig[i * 3], y0 = slimeOrig[i * 3 + 1], z0 = slimeOrig[i * 3 + 2]; const h = y0 / SLIME_R; const spread = 1 + 0.20 * Math.max(0, -h); const ph = h * 3.4 - time * speed; const w = Math.sin(ph) * amp; const w2 = Math.sin(ph + 1.7) * amp * 0.4; arr[i * 3] = x0 * spread - w2; arr[i * 3 + 1] = y0 + Math.sin(ph * 0.8 + 0.6) * amp * 0.25; arr[i * 3 + 2] = z0 * spread + w; } slimeGeo.attributes.position.needsUpdate = true; }

            /* ================================================================ */
            /* ============ 超位魔法系统：魔杖 + 超级爆裂魔法 ============ */
            /* ================================================================ */
}
