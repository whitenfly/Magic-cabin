/**
 * 键鼠 / 摇杆 / 触屏按钮 —— 从 `legacy/monolith.js` 搬出的整段（input）
 *
 * 来源：`J4` 段切片（段表见 `scripts/oneoff/_j4-segments.mjs`）。
 * 段内代码**逐字未改**，只做了三件事：包成函数、补 import、把跨段通信交给 `ctx`。
 * 因此这个文件的正确性判据与搬迁前完全一致：像素逐字节零差异。
 *
 * @param {object} ctx 段间通信载体（见 `installCabin` 的 `__J4_CTX__`）
 * @param {object} app 应用内核 —— 段里用到的 `registry`/`bus`/`scheduler`/`store` 从这里解构
 */
import { clock } from '../../app/clock.js'

export function installInput(ctx, app) {
            // ↓ J4 段导出（input）：本段函数声明挂到 ctx（借提升，段内任何位置都可见）
            ctx.tryJump = tryJump; ctx.setKnob = setKnob; ctx.joyEnd = joyEnd; ctx.sprintEnd = sprintEnd;
            const keys = {};
            ctx.keys = keys; const signInput = document.getElementById('signInput');
            ctx.signInput = signInput; const signEditor = document.getElementById('signEditor');
            ctx.signEditor = signEditor; const picInput = document.getElementById('picInput');
            ctx.picInput = picInput;
            ctx.joyX = 0, ctx.joyY = 0, ctx.sprintBtnDown = false;
            /**
             * ★ J4.51（R4b）：**统一判据** —— 焦点是否落在"正在输入"的元素上。
             *
             * 原来是**逐个列举**（`signInput` / `ctx.noteInput` / `picInput`），有两个毛病：
             *   · 任何**新增**的输入框（设置面板的 range 滑块、将来 `features/**` 带来的控件）
             *     都得记得回来补一句 —— 漏了就"打字时人还在走"；
             *   · `ctx.noteInput` 还得靠 `install.js` 里一处**跨层豁免**才能拿到（`J4.42` §2.4）。
             * 现在只看 `tagName`：`INPUT` / `TEXTAREA`（外加 `contentEditable`）一律算"正在输入"。
             *
             * ⚠️ 这是**有意的行为变更**：range 滑块等控件从此也会吞按键。
             *    而滑块拖完**不会 blur**（`SettingsForm.js` 只把 `dragging` 清掉）⇒ 拖过音量 /
             *    时间流速之后若不去点别处，键盘就走不动了。判据 `pnpm test:input` 把这个行为
             *    写成了断言（`J4.51`），所以它是"被记录的决定"，不是悄悄发生的事故。
             */
            function isTypingTarget() {
                const el = document.activeElement;
                if (!el) return false;
                return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable === true;
            }
            ctx.isTypingTarget = isTypingTarget;
            function tryJump() { const now = clock.now; if (ctx.player.onGround || (now - ctx.player.groundT) < 0.15) { ctx.player.vy = 7.0; ctx.player.onGround = false; ctx.player.groundT = -10; ctx.slime.squashV += 1.3; ctx.slime.wobV += 2.2; } }
            addEventListener('keydown', e => {
                if (isTypingTarget()) return;   // ★ J4.51：统一判据（原来是逐个列举三个输入框 + 一处跨层豁免）
                keys[e.code] = true;
                if (e.code === 'KeyV' && ctx.viewMode !== 'fixed') ctx.setViewMode(ctx.viewMode === 'fp' ? 'tp' : 'fp');
                if (e.code === 'Space') { e.preventDefault(); tryJump(); }
                // J3.1：不再以 `nearestInteract` 为前置 —— 第一人称（准星通路）下它按设计是 null，
                // 旧写法会让"准星对准 + 按 E"依赖一个陈旧值才能生效。是否真有可激活目标由 doInteract() 判定。
                if (e.code === 'KeyE') ctx.doInteract();
                if (e.code === 'Digit1' || e.code === 'Numpad1') ctx.selectSlot(1);
                if (e.code === 'Digit2' || e.code === 'Numpad2') ctx.selectSlot(2);
                if (e.code === 'KeyF') ctx.tryCast();
            });
            addEventListener('keyup', e => { keys[e.code] = false; if (e.code === 'Space' && ctx.player.vy > 2.6) ctx.player.vy = 2.6; });
            const joyZone = document.getElementById('joyZone'), joyBase = document.getElementById('joyBase'), joyKnob = document.getElementById('joyKnob');
            ctx.joyZone = joyZone; ctx.joyBase = joyBase; ctx.joyKnob = joyKnob;
            const JOY_R = 44;
            ctx.JOY_R = JOY_R; ctx.joyId = null, ctx.joyCx = 0, ctx.joyCy = 0;
            function setKnob(dx, dy) { joyKnob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; }
            joyZone.addEventListener('pointerdown', e => { if (ctx.joyId !== null) return; ctx.joyId = e.pointerId; ctx.joyCx = e.clientX; ctx.joyCy = e.clientY; joyBase.style.display = 'block'; joyBase.style.left = ctx.joyCx + 'px'; joyBase.style.top = ctx.joyCy + 'px'; setKnob(0, 0); joyZone.setPointerCapture(e.pointerId); e.preventDefault(); });
            joyZone.addEventListener('pointermove', e => { if (e.pointerId !== ctx.joyId) return; let dx = e.clientX - ctx.joyCx, dy = e.clientY - ctx.joyCy; const m = Math.hypot(dx, dy); if (m > JOY_R) { dx = dx / m * JOY_R; dy = dy / m * JOY_R; } setKnob(dx, dy); ctx.joyX = dx / JOY_R; ctx.joyY = dy / JOY_R; e.preventDefault(); });
            function joyEnd(e) { if (e.pointerId !== ctx.joyId) return; ctx.joyId = null; ctx.joyX = 0; ctx.joyY = 0; joyBase.style.display = 'none'; setKnob(0, 0); }
            joyZone.addEventListener('pointerup', joyEnd); joyZone.addEventListener('pointercancel', joyEnd);
            const btnSprint = document.getElementById('btnSprint'), btnJump = document.getElementById('btnJump'), btnAct = document.getElementById('btnAct'), btnCast = document.getElementById('btnCast');
            ctx.btnSprint = btnSprint; ctx.btnJump = btnJump; ctx.btnAct = btnAct; ctx.btnCast = btnCast;
            btnSprint.addEventListener('pointerdown', e => { ctx.sprintBtnDown = true; btnSprint.classList.add('pressed'); e.preventDefault(); });
            function sprintEnd() { ctx.sprintBtnDown = false; btnSprint.classList.remove('pressed'); }
            btnSprint.addEventListener('pointerup', sprintEnd); btnSprint.addEventListener('pointercancel', sprintEnd);
            btnJump.addEventListener('pointerdown', e => { btnJump.classList.add('pressed'); tryJump(); e.preventDefault(); });
            btnJump.addEventListener('pointerup', () => { btnJump.classList.remove('pressed'); if (ctx.player.vy > 2.6) ctx.player.vy = 2.6; });
            btnJump.addEventListener('pointercancel', () => btnJump.classList.remove('pressed'));
            btnAct.addEventListener('pointerdown', e => { btnAct.classList.add('pressed'); ctx.doInteract(); e.preventDefault(); });
            btnAct.addEventListener('pointerup', () => btnAct.classList.remove('pressed')); btnAct.addEventListener('pointercancel', () => btnAct.classList.remove('pressed'));
            btnCast.addEventListener('pointerdown', e => { btnCast.classList.add('pressed'); ctx.tryCast(); e.preventDefault(); });
            btnCast.addEventListener('pointerup', () => btnCast.classList.remove('pressed')); btnCast.addEventListener('pointercancel', () => btnCast.classList.remove('pressed'));
            document.getElementById('slot1').addEventListener('click', () => ctx.selectSlot(1));
            document.getElementById('slot2').addEventListener('click', () => ctx.selectSlot(2));
            ctx.dragInfo = null; const ptrs = new Map();
            ctx.ptrs = ptrs; ctx.pinchMode = false, ctx.pinchD = 0, ctx.didPinch = false;
            ctx.renderer.domElement.addEventListener('pointerdown', e => {
                if (e.button === 2) { ctx.tryCast(); return; }
                ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; ctx.pinchD = Math.hypot(a.x - b.x, a.y - b.y); ctx.pinchMode = true; ctx.didPinch = true; ctx.dragInfo = null; } else if (ptrs.size === 1) { ctx.dragInfo = { x: e.clientX, y: e.clientY, moved: 0 }; ctx.didPinch = false; }
            });
            ctx.renderer.domElement.addEventListener('pointermove', e => { if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (ctx.pinchMode && ptrs.size >= 2) { const [a, b] = [...ptrs.values()]; const nd = Math.hypot(a.x - b.x, a.y - b.y); const diff = ctx.pinchD - nd; if (ctx.viewMode === 'fixed') ctx.fixDist = Math.max(4, Math.min(40, ctx.fixDist + diff * 0.02)); else ctx.viewDist = Math.max(1.4, Math.min(7.0, ctx.viewDist + diff * 0.006)); ctx.pinchD = nd; return; } if (!ctx.dragInfo) return; if (ctx.viewMode === 'fp' && ctx.isLocked()) return; const dx = e.clientX - ctx.dragInfo.x, dy = e.clientY - ctx.dragInfo.y; ctx.dragInfo.x = e.clientX; ctx.dragInfo.y = e.clientY; ctx.dragInfo.moved += Math.abs(dx) + Math.abs(dy); ctx.pendYaw -= dx * 0.0055; ctx.pendPitch += dy * 0.0045 * (ctx.viewMode === 'fp' ? -1 : 1); });
            ctx.renderer.domElement.addEventListener('pointerup', e => { ptrs.delete(e.pointerId); if (ptrs.size < 2) ctx.pinchMode = false; if (!ctx.dragInfo) return; const wasClick = ctx.dragInfo.moved < 6 && !ctx.didPinch; ctx.dragInfo = null; if (!wasClick) return; if (ctx.viewMode === 'fp' && (ctx.isLocked() || ctx.IS_TOUCH)) { if (ctx.aimHit) ctx.interaction.activate(ctx.aimHit); return; } if (ctx.viewMode === 'fp' && !ctx.IS_TOUCH && !ctx.isLocked()) { ctx.renderer.domElement.requestPointerLock(); return; } ctx.mouse.x = (e.clientX / innerWidth) * 2 - 1; ctx.mouse.y = -(e.clientY / innerHeight) * 2 + 1; ctx.raycaster.setFromCamera(ctx.mouse, ctx.camera);
                // J2.6：点击与准星**共用**同一个目标查找 —— 原先这段「铰链 → 魔法物件 → 壁炉」在这里又抄了一遍
                const clickTarget = ctx.interaction.aimTarget(ctx.raycaster); if (clickTarget) ctx.interaction.activate(clickTarget); });
            ctx.renderer.domElement.addEventListener('pointercancel', e => { ptrs.delete(e.pointerId); if (ptrs.size < 2) ctx.pinchMode = false; ctx.dragInfo = null; });
            document.addEventListener('mousemove', e => { if (ctx.isLocked() && ctx.viewMode === 'fp') { ctx.camYaw -= e.movementX * 0.0026; ctx.camPitch -= e.movementY * 0.0022; ctx.camPitch = Math.max(-1.2, Math.min(1.2, ctx.camPitch)); } });
            document.addEventListener('pointerlockchange', () => { const locked = ctx.isLocked(); ctx.crosshairEl.classList.toggle('show', ctx.viewMode === 'fp' && (locked || ctx.IS_TOUCH)); ctx.lockTipEl.classList.toggle('show', ctx.viewMode === 'fp' && !locked && !ctx.IS_TOUCH); });
            ctx.renderer.domElement.addEventListener('wheel', e => { if (ctx.viewMode === 'fixed') ctx.fixDist = Math.max(4, Math.min(40, ctx.fixDist + e.deltaY * 0.012)); else ctx.viewDist = Math.max(1.4, Math.min(7.0, ctx.viewDist + e.deltaY * 0.0025)); }, { passive: true });
            addEventListener('contextmenu', e => { if (e.target === ctx.renderer.domElement || e.target.closest('#joyZone, .touchBtn')) e.preventDefault(); });

            // J2.5：设置类控件（houseToggle / viewXxxBtn / sfxToggle / sfxSlider / wxRandToggle /
            //      speedSlider）已交给 `cabin/systems/ui/SettingsForm.js` 由 schema 生成，
            //      这里**不再持有元素引用** —— 场景只订阅 store 的值（见下面的 applySetting 段）。
}
