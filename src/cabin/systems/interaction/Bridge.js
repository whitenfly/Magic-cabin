/**
 * 音效辅助 + 交互通路接线 —— 从 `legacy/monolith.js` 搬出的整段（sfxBridge）
 *
 * 来源：`J4` 段切片（段表见 `scripts/oneoff/_j4-segments.mjs`）。
 * 段内代码**逐字未改**，只做了三件事：包成函数、补 import、把跨段通信交给 `ctx`。
 * 因此这个文件的正确性判据与搬迁前完全一致：像素逐字节零差异。
 *
 * @param {object} ctx 段间通信载体（见 `installCabin` 的 `__J4_CTX__`）
 * @param {object} app 应用内核 —— 段里用到的 `registry`/`bus`/`scheduler`/`store` 从这里解构
 */
import * as THREE from 'three'
import { clock } from '../../app/clock.js'
import { createHintUI } from './HintUI.js'
import { createInteractionSystem, makeTarget } from './InteractionSystem.js'

export function installInteractionBridge(ctx, app) {
  const { registry } = app
            // ↓ J4 段导出（sfxBridge）：本段函数声明挂到 ctx（借提升，段内任何位置都可见）
            ctx.toggleFire = toggleFire; ctx.toggleLamp = toggleLamp; ctx.ancestorVisible = ancestorVisible; ctx.aimRay = aimRay; ctx.doInteract = doInteract; ctx.updateInteractHint = updateInteractHint;
            ctx.doorGroup.userData.sfx = 'door';
            for (const w of [ctx.winFL, ctx.winFR, ctx.winL, ctx.winR, ctx.winB, ctx.winG]) w.userData.sfx = 'window';
            const toggleSpring = g => { if (g.userData.onToggle) { g.userData.onToggle(); return; } g.userData.spring.open = !g.userData.spring.open; ctx.SND.play(g.userData.sfx || 'toggle'); };
            ctx.toggleSpring = toggleSpring;
            function toggleFire() { ctx.fireLit = !ctx.fireLit; ctx.SND.play('fire'); }
            function toggleLamp() { ctx.lampLit = !ctx.lampLit; ctx.SND.play('lamp'); }
            const fireMagic = o => { ctx.SND.play(o.userData.sfx || 'toggle'); o.userData.onClick(); };
            ctx.fireMagic = fireMagic;
            // J2.6：9 条近距条目改为**注册式**（统一交互契约）。顺序、半径、锚点逐条照搬 ⇒ 行为零差异；
            // anchor 全部来自 cabin/world/layout.js（不变量 N9），label 是面向用户的语义化文案（不变量 N10）。
            const interaction = createInteractionSystem({ registry, warn: (m) => console.warn(m) });
            ctx.interaction = interaction;
            interaction.registerProximity({ id: 'floor1/fireplace', label: '点燃 / 熄灭壁炉', mode: 'proximity', anchor: { x: ctx.FX, z: ctx.FZ }, radius: 2.0, onActivate: toggleFire });
            interaction.registerProximity({ id: 'floor1/chandelier', label: '点亮 / 熄灭魔法吊灯', mode: 'proximity', anchor: { x: 0, z: 0 }, radius: 2.4, onActivate: toggleLamp });
            interaction.registerProximity({ id: 'house/door', label: '打开 / 关上大门', mode: 'proximity', anchor: { x: 0, z: 4 }, radius: 1.8, onActivate: () => toggleSpring(ctx.doorGroup) });
            interaction.registerProximity({ id: 'house/window-front-left', label: '开 / 关前左窗', mode: 'proximity', anchor: { x: ctx.WIN_F_L.c, z: 4 }, radius: 1.6, onActivate: () => toggleSpring(ctx.winFL) });
            interaction.registerProximity({ id: 'house/window-front-right', label: '开 / 关前右窗', mode: 'proximity', anchor: { x: ctx.WIN_F_R.c, z: 4 }, radius: 1.6, onActivate: () => toggleSpring(ctx.winFR) });
            interaction.registerProximity({ id: 'house/window-left', label: '开 / 关左侧窗', mode: 'proximity', anchor: { x: -4, z: ctx.WIN_LEFT.c }, radius: 1.6, onActivate: () => toggleSpring(ctx.winL) });
            interaction.registerProximity({ id: 'outdoor/signpost', label: '编辑路牌文字', mode: 'proximity', anchor: { x: 3.1, z: 6.3 }, radius: 2.2, onActivate: ctx.openSignEditor });
            interaction.registerProximity({ id: 'house/window-right', label: '开 / 关右侧窗', mode: 'proximity', anchor: { x: 4, z: -1.5 }, radius: 1.7, fullHouseOnly: true, onActivate: () => toggleSpring(ctx.winR) });
            interaction.registerProximity({ id: 'house/window-back', label: '开 / 关后窗', mode: 'proximity', anchor: { x: 1.5, z: -4 }, radius: 1.7, fullHouseOnly: true, onActivate: () => toggleSpring(ctx.winB) });
            const hintEl = document.getElementById('hint'), crosshairEl = document.getElementById('crosshair'), lockTipEl = document.getElementById('lockTip');
            ctx.hintEl = hintEl; ctx.crosshairEl = crosshairEl; ctx.lockTipEl = lockTipEl;
            // J2.6：提示文案的唯一出口（原先 #hint 的 innerHTML 被直接写了 4 处，违反不变量 N10）
            const hintUI = createHintUI({ element: hintEl, clock, isTouch: ctx.IS_TOUCH });
            ctx.hintUI = hintUI;
            ctx.nearestInteract = null, ctx.aimHit = null; const raycaster = new THREE.Raycaster();
            ctx.raycaster = raycaster; const CENTER = new THREE.Vector2(0, 0);
            ctx.CENTER = CENTER; const mouse = new THREE.Vector2();
            ctx.mouse = mouse;
            function ancestorVisible(o) { let p = o; while (p) { if (p.visible === false) return false; p = p.parent; } return true; }
            // J2.6：把原先硬编码在 aimRay() 里的「铰链 → 魔法物件 → 壁炉」三段优先，改为按注册顺序的命中源。
            // ★ 注册次序必须与搬迁前的短路次序**完全一致**，否则同一次点击会命中不同的物件。
            //   每个源自己负责"命中的 Mesh → 可执行目标"这一步（label 取自各物件的 aimLabel）。
            interaction.registerAimSource({ id: 'hinges', meshes: ctx.hingeMeshes, resolve: (hit) => { const g = hit.object.userData.hingeGroup; return makeTarget({ id: 'hinge:' + (g.userData.aimLabel || 'unnamed'), label: g.userData.aimLabel || '交互', activate: () => toggleSpring(g) }); } });
            interaction.registerAimSource({ id: 'magic', meshes: ctx.magicMeshes, resolve: (hit) => { const o = hit.object.userData.magicRoot; return makeTarget({ id: 'magic:' + (o.userData.aimLabel || 'unnamed'), label: o.userData.aimLabel || '交互', activate: () => fireMagic(o) }); } });
            interaction.registerAimSource({ id: 'fire', meshes: ctx.fireMeshes, resolve: () => makeTarget({ id: 'fire/hearth', label: '点燃 / 熄灭壁炉', activate: toggleFire }) });
            function aimRay() { raycaster.setFromCamera(CENTER, ctx.camera); return interaction.aimTarget(raycaster); }
            const isLocked = () => document.pointerLockElement === ctx.renderer.domElement;
            ctx.isLocked = isLocked;
            function doInteract() { if (ctx.viewMode === 'fp' && (ctx.aimHit || ctx.IS_TOUCH)) { if (ctx.aimHit) interaction.activate(ctx.aimHit); return; } if (ctx.nearestInteract) interaction.activate(ctx.nearestInteract); }
            function updateInteractHint() {
                if (hintUI.applyOverride()) return;
                if (ctx.viewMode === 'fp' && (isLocked() || ctx.IS_TOUCH)) { ctx.nearestInteract = null; ctx.aimHit = aimRay(); if (ctx.aimHit) hintUI.showAim(ctx.aimHit.label); else hintUI.hide(); return; } ctx.aimHit = null; ctx.nearestInteract = interaction.nearestTarget(ctx.player.pos, { fullHouse: ctx.fullHouse }); if (ctx.nearestInteract) hintUI.showProximity(ctx.nearestInteract.label); else hintUI.hide();
            }
}
