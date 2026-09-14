/**
 * 全局 FILL 材质的片元着色器 —— 线稿风格的"全场光照"：一楼炉火 + 二楼吊灯 + N 个室内点光源
 *
 * ★ 本文件由 `scripts/oneoff/_j22-extract.mjs` 从 `legacy/monolith.js` **逐字节提取**（`J2.2`），
 *   不是手抄 —— shader 里的空白与数值必须与原实现完全一致。
 *   后续若要改 shader，请连同像素回归一起改（`pnpm test:visual`）。
 */

export const FILL_FRAG = `
            uniform vec3 uColor;
            uniform vec3 uTint;
            uniform vec3 uFireCenter;
            uniform float uFireRadius;
            uniform vec3 uFireColorNear;
            uniform vec3 uFireColorFar;
            uniform float uFireStrength;
            uniform vec3 uLampCenter;
            uniform float uLampRadius;
            uniform vec3 uLampColorNear;
            uniform vec3 uLampColorFar;
            uniform float uLampStrength;
            uniform float uDaylight;
            uniform float uTime;
            uniform vec3 uPtPos[8];
            uniform vec3 uPtCol[8];
            uniform vec4 uPtCfg[8];
            uniform int uPtCount;
            varying vec3 vWorldPos;
            varying vec3 vWorldNormal;

            void main() {
                vec3 finalColor = uColor * uTint;

                float limX = min(4.0, 13.2 - 2.0 * vWorldPos.y);
                float inX = 1.0 - smoothstep(limX, limX + 0.12, abs(vWorldPos.x));
                float inZ = smoothstep(-4.12, -4.0, vWorldPos.z) * (1.0 - smoothstep(4.0, 4.12, vWorldPos.z));

                /* ---- 一楼炉火 ---- */
                float inYF = 1.0 - smoothstep(2.98, 3.10, vWorldPos.y);
                float roomMaskF = inX * inZ * inYF * step(-0.05, vWorldPos.y);
                if (roomMaskF > 0.002 && uFireStrength > 0.002) {
                    vec3 toFire = uFireCenter - vWorldPos;
                    float dist = length(toFire);
                    vec3 dirToFire = toFire / max(dist, 0.0001);
                    float ndl = dot(normalize(vWorldNormal), dirToFire);
                    float facing = smoothstep(-0.08, 0.45, ndl);
                    float t = clamp(1.0 - dist / uFireRadius, 0.0, 1.0);
                    float atten = t * t * 0.78 + t * 0.22;
                    vec3 fireCol = mix(uFireColorFar, uFireColorNear, t);
                    float flicker = 0.87
                        + 0.08 * sin(uTime * 6.7 + dist * 1.3)
                        + 0.03 * sin(uTime * 11.3 + 2.1)
                        + 0.02 * sin(uTime * 19.7 + 5.0);
                    float dayFade = 1.0 - uDaylight * 0.75;
                    float direct = atten * facing * 0.55;
                    float bounce = atten * 0.18 * (0.35 + 0.65 * smoothstep(-0.5, 0.3, ndl));
                    finalColor += fireCol * uFireStrength * flicker * dayFade * (direct + bounce) * roomMaskF;
                }

                /* ---- 二楼魔法吊灯 ---- */
                float inYL = smoothstep(3.0, 3.12, vWorldPos.y) * (1.0 - smoothstep(6.65, 6.95, vWorldPos.y));
                float roomMaskL = inX * inZ * inYL;
                if (roomMaskL > 0.002 && uLampStrength > 0.002) {
                    vec3 toLamp = uLampCenter - vWorldPos;
                    float distL = length(toLamp);
                    vec3 dirToLamp = toLamp / max(distL, 0.0001);
                    float ndlL = dot(normalize(vWorldNormal), dirToLamp);
                    float facingL = smoothstep(-0.08, 0.45, ndlL);
                    float tL = clamp(1.0 - distL / uLampRadius, 0.0, 1.0);
                    float attenL = tL * tL * 0.78 + tL * 0.22;
                    vec3 lampCol = mix(uLampColorFar, uLampColorNear, tL);
                    float flickerL = 0.93 + 0.045 * sin(uTime * 2.1 + distL * 0.8) + 0.025 * sin(uTime * 4.7 + 1.3);
                    float dayFadeL = 1.0 - uDaylight * 0.75;
                    float directL = attenL * facingL * 0.6;
                    float bounceL = attenL * 0.2 * (0.35 + 0.65 * smoothstep(-0.5, 0.3, ndlL));
                    finalColor += lampCol * uLampStrength * flickerL * dayFadeL * (directL + bounceL) * roomMaskL;
                }

                /* ---- 室内点光源（吊挂木灯·坩埚魔火·魔法阵·暖桌·水晶球·蜡烛·星象仪·月光盆栽） ---- */
                for (int i = 0; i < 8; i++) {
                    if (i >= uPtCount) break;
                    float ptS = uPtCfg[i].y;
                    if (ptS < 0.003) continue;
                    float yMaskPt = smoothstep(uPtCfg[i].z, uPtCfg[i].z + 0.12, vWorldPos.y)
                        * (1.0 - smoothstep(uPtCfg[i].w - 0.12, uPtCfg[i].w, vWorldPos.y));
                    float roomPt = inX * inZ * yMaskPt;
                    if (roomPt < 0.003) continue;
                    vec3 toPt = uPtPos[i] - vWorldPos;
                    float dPt = length(toPt);
                    float tPt = clamp(1.0 - dPt / uPtCfg[i].x, 0.0, 1.0);
                    float aPt = tPt * tPt * 0.78 + tPt * 0.22;
                    vec3 cPt = uPtCol[i] * (0.60 + 0.40 * tPt);
                    vec3 dirPt = toPt / max(dPt, 0.0001);
                    float ndlPt = dot(normalize(vWorldNormal), dirPt);
                    float facingPt = smoothstep(-0.08, 0.45, ndlPt);
                    float flickPt = 0.90 + 0.06 * sin(uTime * (5.3 + float(i) * 1.7) + dPt * 1.1 + float(i) * 2.4)
                        + 0.04 * sin(uTime * (9.1 + float(i) * 0.9) + float(i));
                    float fadePt = 1.0 - uDaylight * 0.75;
                    float dirLPt = aPt * facingPt * 0.50;
                    float bncPt = aPt * 0.16 * (0.35 + 0.65 * smoothstep(-0.5, 0.3, ndlPt));
                    finalColor += cPt * ptS * flickPt * fadePt * (dirLPt + bncPt) * roomPt;
                }

                gl_FragColor = vec4(finalColor, 1.0);
            }
        `
