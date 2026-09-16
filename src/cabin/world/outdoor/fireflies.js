/**
 * 室外片 · 件 2「萤火虫」—— `J4.9`（缺口 C7）从 `world/outdoor/yard.js` 切出

 * 内容：`FF_N` / `fireflies` 分布 / `ffPos` / `ffGeo` / `ffUniforms` / `Points`。

 * ⚠️ **每帧逻辑不在这里**：萤火虫的位置更新住在 `app/scene/FrameBody.js` 的帧任务里、
 * 不透明度渐变住在 `systems/weather/WeatherSystem.js` 的环境分支里 —— 两者都经 `ctx.ff*`
 * 取值。本次**不动**它们（动了就改变帧顺序），只把几何与状态搬成独立一件。
 * 「把这些每帧分支归位到本件的 `update`」记在 `J4.9` 结果文档的遗留里。
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
