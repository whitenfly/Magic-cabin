/**
 * strict / 触屏探测 —— 从 `legacy/monolith.js` 搬出的整段（prelude）
 *
 * 来源：`J4` 段切片（段表见 `scripts/oneoff/_j4-segments.mjs`）。
 * 段内代码**逐字未改**，只做了三件事：包成函数、补 import、把跨段通信交给 `ctx`。
 * 因此这个文件的正确性判据与搬迁前完全一致：像素逐字节零差异。
 *
 * @param {object} ctx 段间通信载体（见 `installCabin` 的 `__J4_CTX__`）
 * @param {object} app 应用内核 —— 段里用到的 `registry`/`bus`/`scheduler`/`store` 从这里解构
 */
export function installEnv(ctx, app) {
            'use strict';
            const mqCoarse = window.matchMedia ? window.matchMedia('(pointer: coarse)').matches : false;
            ctx.mqCoarse = mqCoarse;
            const mqFine = window.matchMedia ? window.matchMedia('(pointer: fine)').matches : true;
            ctx.mqFine = mqFine;
            const IS_TOUCH = mqCoarse || (('ontouchstart' in window) && navigator.maxTouchPoints > 0 && !mqFine);
            ctx.IS_TOUCH = IS_TOUCH;
            if (IS_TOUCH) document.body.classList.add('touch');

            /* ============ 音效系统：文件放 sounds/ 目录，缺失时静默跳过 ============ */
}
