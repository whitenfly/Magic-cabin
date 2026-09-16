/**
 * 室外片 · 件 2「萤火虫」—— `J4.9`（缺口 C7）从 `world/outdoor/yard.js` 切出

 * 内容：`FF_N` / `fireflies` 分布 / `ffPos` / `ffGeo` / `ffUniforms` / `Points`。

 * 每帧逻辑分两处（`J4.14`「每帧分支归位」之后）：
 *   - **不透明度渐变** → 本文件的 `updateFireflyOpacity()` —— 原住在
 *     `systems/weather/WeatherSystem.js` 的环境分支里，`J4.14` 搬回本件；
 *   - **位置更新** → 仍住 `app/scene/FrameBody.js` 的 `frame/10`（它读 `ctx.ffOpacity` 判可见性）。
 * 两者都经 `ctx.ff*` 取值，先后顺序由 `FrameBody.js` 的登记顺序固定 —— 顺序即画面。
 */
import * as THREE from 'three'
import { scene } from '../../app/rng.js'
import { yardSpotFree } from './yardSpot.js'

export function installOutdoorFireflies(ctx, app) {
            const outdoorRng = scene.outdoor;
            const FF_N = 26;
            ctx.FF_N = FF_N;
            const fireflies = [];
            ctx.fireflies = fireflies;
            for (let i = 0; i < FF_N; i++) {
                let x = 0, z = 0, ok = false, guard = 0;
                while (!ok && guard++ < 200) {
                    x = (outdoorRng() - 0.5) * 33; z = (outdoorRng() - 0.5) * 33;
                    if (Math.abs(x) > 16.5 || Math.abs(z) > 16.5) continue;
                    ok = yardSpotFree(x, z);
                }
                fireflies.push({ bx: x, by: 0.35 + outdoorRng() * 1.25, bz: z, ph: outdoorRng() * 7, sp: 0.45 + outdoorRng() * 0.7, amp: 0.5 + outdoorRng() * 0.9 });
            }
            const ffPos = new Float32Array(FF_N * 3);
            ctx.ffPos = ffPos;
            const ffPhase = new Float32Array(FF_N);
            ctx.ffPhase = ffPhase;
            for (let i = 0; i < FF_N; i++) { ffPos[i * 3] = fireflies[i].bx; ffPos[i * 3 + 1] = fireflies[i].by; ffPos[i * 3 + 2] = fireflies[i].bz; ffPhase[i] = outdoorRng(); }
            const ffGeo = new THREE.BufferGeometry();
            ctx.ffGeo = ffGeo;
            ffGeo.setAttribute('position', new THREE.BufferAttribute(ffPos, 3));
            ffGeo.setAttribute('aPhase', new THREE.BufferAttribute(ffPhase, 1));
            const ffUniforms = { uTime: { value: 0 }, uOpacity: { value: 0 } };
            ctx.ffUniforms = ffUniforms;
            const ffMat = new THREE.ShaderMaterial({
                uniforms: ffUniforms,
                vertexShader: `
        attribute float aPhase;
        uniform float uTime;
        varying float vBlink;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          float tw = abs(sin(uTime * 1.25 + aPhase * 6.2831));
          vBlink = 0.15 + 0.85 * pow(tw, 3.0);
          gl_PointSize = (2.2 + 2.6 * vBlink) * (150.0 / -mv.z);
        }`,
                fragmentShader: `
        varying float vBlink;
        uniform float uOpacity;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          if (d > 0.5) discard;
          float a = (1.0 - d * 2.0) * (1.0 - d * 2.0) * vBlink * uOpacity * 0.9;
          gl_FragColor = vec4(0.82, 1.0, 0.52, a);
        }`,
                transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false
            });
            ctx.ffMat = ffMat;
            const fireflyPts = new THREE.Points(ffGeo, ffMat);
            ctx.fireflyPts = fireflyPts; fireflyPts.frustumCulled = false; ctx.scene.add(fireflyPts);
            ctx.ffOpacity = 0;

            /* ========================================================== */
            /* ============ 室内陈设专用：圆角几何与材质工具 ============ */
            /* ========================================================== */
            // J2.1：圆角几何已提取到 cabin/core/geometry/roundBox.js（实现零改动）
}

/**
 * 每帧：萤火虫整体不透明度的渐变。
 *
 * `J4.14`（缺口「每帧分支归位」）从 `systems/weather/WeatherSystem.js` 搬回这里 ——
 * `ctx.ffOpacity` / `ctx.ffUniforms` 都是本件的状态。原实现是天气模块里的四行
 * （`ffTarget` 计算 + 指数趋近 + 写 uniform）。
 *
 * **输入**：`ctx.wx`（天气类型）、`ctx._night`（由 `weather/atmosphere` 每帧写入）。
 * **约束**（两条都是搬迁前就成立的顺序，见 `app/scene/FrameBody.js`）：
 *   ① 必须排在 `weather/atmosphere` **之后** —— `_night` 由它写；
 *   ② 必须排在 `frame/10`（萤火虫**位置**更新）**之前** ——
 *      那个任务用 `ctx.ffOpacity > 0.01` 判断要不要更新顶点，本函数负责写它。
 *
 * @param {object} ctx 段间通信载体
 * @param {number} dt 帧间隔（秒）
 */
export function updateFireflyOpacity(ctx, dt) {
  const wx = ctx.wx
  const night = ctx._night
  let ffTarget = 0
  if ((wx.type === 'sunny' || wx.type === 'cloudy') && night > 0.5) ffTarget = night
  ctx.ffOpacity += (ffTarget - ctx.ffOpacity) * Math.min(1, dt * 1.2)
  ctx.ffUniforms.uOpacity.value = ctx.ffOpacity
}
