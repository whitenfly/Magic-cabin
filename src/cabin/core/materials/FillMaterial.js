/**
 * 全局 FILL 材质 —— 线稿风格的"全场光照"材质
 *
 * 来源：`legacy/monolith.js` 的 `FILL`（原样搬迁，`J2.2`）。uniforms 块由
 * `scripts/oneoff/_j22-extract.mjs` 逐字节提取，材质参数（DoubleSide / polygonOffset）照搬。
 *
 * 为什么它值得单独成模块：**全屋每一个填充面共用这一份 uniforms** ——
 * `litMaterial()` 造出的彩色材质只是换掉 `uTint`，其余 uniform 引用**共享**。
 * 因此"改一处光照全场生效"这件事在架构上就成立，也是 `J2.3` 把
 * 「8 个硬编码槽位」改成「N 个注册光源」的落点。
 */
import * as THREE from 'three'
import { FILL_VERT } from './fill.vert.glsl.js'
import { FILL_FRAG } from './fill.frag.glsl.js'

/** 室内点光源的**槽位上限**（shader 里 `uPtPos[8]` / `uPtCol[8]` / `uPtCfg[8]` 的长度） */
export const POINT_LIGHT_SLOTS = 8

/** 造一份新的 FILL 材质（每个"世界"一份；monolith 全局只有一份） */
export function createFillMaterial() {
    return new THREE.ShaderMaterial({
        uniforms: {
                    uColor: { value: new THREE.Color(0xffffff) },
                    uTint: { value: new THREE.Color(0xffffff) },
                    uFireCenter: { value: new THREE.Vector3(0, 0, 0) },
                    uFireRadius: { value: 11.0 },
                    uFireColorNear: { value: new THREE.Color(1.0, 0.62, 0.26) },
                    uFireColorFar: { value: new THREE.Color(0.78, 0.26, 0.09) },
                    uFireStrength: { value: 0.0 },
                    uLampCenter: { value: new THREE.Vector3(0, 5.45, 0) },
                    uLampRadius: { value: 12.0 },
                    uLampColorNear: { value: new THREE.Color(1.0, 0.80, 0.58) },
                    uLampColorFar: { value: new THREE.Color(0.72, 0.50, 0.85) },
                    uLampStrength: { value: 0.0 },
                    uDaylight: { value: 0.0 },
                    uTime: { value: 0 },
                    uPtPos: { value: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] },
                    uPtCol: { value: [new THREE.Color(), new THREE.Color(), new THREE.Color(), new THREE.Color(), new THREE.Color(), new THREE.Color(), new THREE.Color(), new THREE.Color()] },
                    uPtCfg: { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] },
                    uPtCount: { value: 8 }
                },
        vertexShader: FILL_VERT,
        fragmentShader: FILL_FRAG,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1
    })
}
