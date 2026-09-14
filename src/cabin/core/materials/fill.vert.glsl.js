/**
 * 全局 FILL 材质的顶点着色器 —— 把世界坐标与法线传给片元（光照在世界空间里算）
 *
 * ★ 本文件由 `scripts/oneoff/_j22-extract.mjs` 从 `legacy/monolith.js` **逐字节提取**（`J2.2`），
 *   不是手抄 —— shader 里的空白与数值必须与原实现完全一致。
 *   后续若要改 shader，请连同像素回归一起改（`pnpm test:visual`）。
 */

export const FILL_VERT = `
            varying vec3 vWorldPos;
            varying vec3 vWorldNormal;
            void main() {
                vec4 worldPos = modelMatrix * vec4(position, 1.0);
                vWorldPos = worldPos.xyz;
                vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
                gl_Position = projectionMatrix * viewMatrix * worldPos;
            }
        `
