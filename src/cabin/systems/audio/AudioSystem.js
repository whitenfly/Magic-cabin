/**
 * SND 音效池 —— 从 `legacy/monolith.js` 搬出的整段（audio）
 *
 * 来源：`J4` 段切片（段表见 `scripts/oneoff/_j4-segments.mjs`）。
 * 段内代码**逐字未改**，只做了三件事：包成函数、补 import、把跨段通信交给 `ctx`。
 * 因此这个文件的正确性判据与搬迁前完全一致：像素逐字节零差异。
 *
 * @param {object} ctx 段间通信载体（见 `installCabin` 的 `__J4_CTX__`）
 * @param {object} app 应用内核 —— 段里用到的 `registry`/`bus`/`scheduler`/`store` 从这里解构
 */
export function installAudio(ctx, app) {
  const { store } = app
            const SND = (() => {
                const NAMES = ['door', 'window', 'fire', 'lamp', 'cast', 'magic', 'cat', 'toggle', 'ui', 'chim', 'doorbell'];
                const pool = {};
                for (const n of NAMES) { const a = new Audio('sounds/' + n + '.mp3'); a.preload = 'auto'; pool[n] = a; }
                // J2.8：音量与音效开关由 store 决定（刷新后保持上次的选择；?deterministic=1 下不持久化）
                let vol = store.get('audio.volume'), on = store.get('audio.enabled');
                function play(name) {
                    if (!on) return;
                    const a = pool[name];
                    if (!a || a.error) return;
                    try { const c = a.cloneNode(); c.volume = vol; c.play().catch(() => { }); } catch (e) { }
                }
                return {
                    play,
                    setVolume(v) { vol = Math.max(0, Math.min(1, v)); },
                    getVolume() { return vol; },
                    setEnabled(v) { on = !!v; },
                    isEnabled() { return on; }
                };
            })();
            ctx.SND = SND;
}
