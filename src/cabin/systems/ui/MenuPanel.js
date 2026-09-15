/**
 * 菜单面板 + 设置 → 场景 唯一通道 —— 从 `legacy/monolith.js` 搬出的整段（menuUi）
 *
 * 来源：`J4` 段切片（段表见 `scripts/oneoff/_j4-segments.mjs`）。
 * 段内代码**逐字未改**，只做了三件事：包成函数、补 import、把跨段通信交给 `ctx`。
 * 因此这个文件的正确性判据与搬迁前完全一致：像素逐字节零差异。
 *
 * @param {object} ctx 段间通信载体（见 `installCabin` 的 `__J4_CTX__`）
 * @param {object} app 应用内核 —— 段里用到的 `registry`/`bus`/`scheduler`/`store` 从这里解构
 */
export function installMenuPanel(ctx, app) {
  const { bus, store } = app
            // ↓ J4 段导出（menuUi）：本段函数声明挂到 ctx（借提升，段内任何位置都可见）
            ctx.applyFullHouse = applyFullHouse; ctx.resetSlime = resetSlime; ctx.applyViewMode = applyViewMode; ctx.setViewMode = setViewMode; ctx.applySign = applySign;
            const menuPanel = document.getElementById('menuPanel'), resetBtn = document.getElementById('resetBtn');
            ctx.menuPanel = menuPanel; ctx.resetBtn = resetBtn;
            document.getElementById('menuDot').addEventListener('click', () => { ctx.SND.play('ui'); menuPanel.classList.toggle('open'); });
            // J2.5：设置面板控件的**点击音**。由面板广播、这里播放 —— 面板在 `systems/ui/`，
            //      不该认识 `SND`（它住在 3D 实现里）。拖动滑块不发这个事件，与搬迁前的行为一致。
            bus.on('ui:click', () => ctx.SND.play('ui'));
            /** J2.8：小屋形态的**唯一**应用点 —— 菜单按钮、持久化初始化、测试钩子共用它，
             *  避免"改了一处忘了另一处"（搬迁前这段逻辑在 3 个地方各写了一遍）。
             *  J2.5：不再自己 toggle 控件的 class —— 控件的视觉状态归 `SettingsForm`（订阅同一个 store）。 */
            function applyFullHouse(on) { ctx.fullHouse = !!on; ctx.fullHouseGroup.visible = ctx.fullHouse; ctx.dashedGroup.visible = !ctx.fullHouse; }
            function resetSlime() { ctx.player.pos.set(0, 0, 5.2); ctx.player.vy = 0; ctx.player.yaw = Math.PI; ctx.player.moveSpeed = 0; ctx.player.onGround = true; ctx.camYaw = Math.PI; ctx.camPitch = 0.32; ctx.pendYaw = 0; ctx.pendPitch = 0; ctx.slime.squash = ctx.SLIME_FLAT; ctx.slime.squashV = 0; ctx.slime.wob = 0; ctx.slime.wobV = 0; }
            resetBtn.addEventListener('click', () => { ctx.SND.play('ui'); resetSlime(); });
            /** J2.5：视角的**唯一**应用点（同上，控件视觉归 SettingsForm）。
             *  与 `applyFullHouse` 一样，它只负责"把值变成画面"，不负责存值。 */
            function applyViewMode(m) { ctx.viewMode = m; ctx.cameraRig.setMode(m); if (m === 'fixed') { if (document.pointerLockElement) document.exitPointerLock(); ctx.slimeRoot.visible = true; ctx.crosshairEl.classList.remove('show'); ctx.lockTipEl.classList.remove('show'); } else { ctx.slimeRoot.visible = (m !== 'fp'); if (m === 'fp') { if (ctx.IS_TOUCH) ctx.crosshairEl.classList.add('show'); else ctx.lockTipEl.classList.add('show'); } else { if (document.pointerLockElement) document.exitPointerLock(); ctx.crosshairEl.classList.remove('show'); ctx.lockTipEl.classList.remove('show'); } } }
            /** J2.5：切视角 = 只写 store。应用与控件视觉都由订阅者负责（单向数据流）。 */
            function setViewMode(m) { store.set('view.mode', m); }
            // ── ★ J2.5：设置 → 场景 的**唯一通道** ────────────────────────────────
            //    控件（由 `src/config/settings.config.js` 的 schema 生成）只调 `store.set()`；
            //    这里订阅 store，把值应用到场景。**单向数据流** ——
            //    不存在"控件改完值、又自己应用一遍"的双写，加一个设置项只需加一条订阅。
            //    `store.subscribe` 只在**值真的变化**时触发 ⇒ 首屏那一次显式应用仍由下面两行负责。
            store.subscribe('house.full', ({ value }) => applyFullHouse(value));
            store.subscribe('view.mode', ({ value }) => applyViewMode(value));
            // 音效：打开的那一刻补一声 ui —— 让用户立刻听到音量（搬迁前该按钮单独做过这件事）
            store.subscribe('audio.enabled', ({ value }) => { ctx.SND.setEnabled(value); if (value) ctx.SND.play('ui'); });
            store.subscribe('audio.volume', ({ value }) => ctx.SND.setVolume(value));
            // J2.8：把持久化的设置**应用回场景** —— 刷新后保持上次的选择（风险 R4 的正面）。
            // `?deterministic=1` 下 store 不持久化，读到的必然是默认值 ⇒ 像素回归与冒烟仍然**环境无关**。
            // 控件的视觉状态由 `SettingsForm` 在挂载时同步（读的是同一个 store），这里只管场景。
            applyFullHouse(store.get('house.full'));
            applyViewMode(store.get('view.mode'));
            function applySign() { ctx.signText = ctx.signInput.value.trim() || '魔女小屋'; ctx.drawSign(ctx.signText); ctx.signEditor.classList.remove('show'); ctx.signInput.blur(); ctx.SND.play('chim'); }
            document.getElementById('signOk').addEventListener('click', applySign);
            ctx.signInput.addEventListener('keydown', e => { if (e.key === 'Enter') applySign(); if (e.key === 'Escape') { ctx.signEditor.classList.remove('show'); ctx.signInput.blur(); } e.stopPropagation(); });
}
