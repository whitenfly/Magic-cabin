/**
 * 楼梯下储物箱 —— 从 `legacy/monolith.js` 搬出的整段（junkBoxes）
 *
 * 来源：`J4` 段切片（段表见 `scripts/oneoff/_j4-segments.mjs`）。
 * 段内代码**逐字未改**，只做了三件事：包成函数、补 import、把跨段通信交给 `ctx`。
 * 因此这个文件的正确性判据与搬迁前完全一致：像素逐字节零差异。
 *
 * @param {object} ctx 段间通信载体（见 `installCabin` 的 `__J4_CTX__`）
 * @param {object} app 应用内核 —— 段里用到的 `registry`/`bus`/`scheduler`/`store` 从这里解构
 */
import * as THREE from 'three'

export function installJunkBoxes(ctx, app) {
            ctx.storageOpen = false, ctx.storageP = 0, ctx.storageV = 0;
            const storageChest = new THREE.Group();
            ctx.storageChest = storageChest;
            storageChest.position.set(0, 0, -0.78);
            storageChest.rotation.y = Math.PI;
            ctx.scene.add(storageChest);
            const storageLid = new THREE.Group();
            ctx.storageLid = storageLid;
            const oreMeshes = [];
            ctx.oreMeshes = oreMeshes;
            {
                const woodMat = ctx.LITMAT(0x8a6a4a, { side: THREE.DoubleSide });
                const darkMat = ctx.LITMAT(0x6b4e35, { side: THREE.DoubleSide });
                const W = 0.78, D = 0.52, H = 0.40, T = 0.03;
                ctx.put(ctx.solid(new THREE.BoxGeometry(W, T, D), woodMat), 0, T / 2, 0, 0, 0, 0, storageChest);
                ctx.put(ctx.solid(new THREE.BoxGeometry(W, H, T), woodMat), 0, T + H / 2, D / 2 - T / 2, 0, 0, 0, storageChest);
                ctx.put(ctx.solid(new THREE.BoxGeometry(W, H, T), woodMat), 0, T + H / 2, -D / 2 + T / 2, 0, 0, 0, storageChest);
                ctx.put(ctx.solid(new THREE.BoxGeometry(T, H, D - 2 * T), woodMat), W / 2 - T / 2, T + H / 2, 0, 0, 0, 0, storageChest);
                ctx.put(ctx.solid(new THREE.BoxGeometry(T, H, D - 2 * T), woodMat), -W / 2 + T / 2, T + H / 2, 0, 0, 0, 0, storageChest);
                ctx.put(ctx.solid(new THREE.BoxGeometry(W + 0.04, 0.05, 0.05), darkMat), 0, H + 0.015, D / 2, 0, 0, 0, storageChest);
                ctx.put(ctx.solid(new THREE.BoxGeometry(W + 0.04, 0.05, 0.05), darkMat), 0, H + 0.015, -D / 2, 0, 0, 0, storageChest);
                ctx.put(ctx.line([[-0.09, H - 0.06, D / 2 + 0.012], [0.09, H - 0.06, D / 2 + 0.012]]), 0, 0, 0, 0, 0, 0, storageChest);
                storageLid.position.set(0, H + 0.03, -D / 2);
                ctx.put(ctx.solid(new THREE.BoxGeometry(W + 0.04, 0.06, D + 0.04), darkMat), 0, 0.03, D / 2, 0, 0, 0, storageLid);
                ctx.put(ctx.line([[-W / 2 - 0.02, 0.06, D / 2], [-W / 2 + 0.06, 0.06, D / 2]]), 0, 0, 0, 0, 0, 0, storageLid);
                ctx.put(ctx.line([[W / 2 - 0.06, 0.06, D / 2], [W / 2 + 0.02, 0.06, D / 2]]), 0, 0, 0, 0, 0, 0, storageLid);
                storageChest.add(storageLid);
                const ORES = [
                    [0x9b4fd8, 'oct'], [0x2fbf6f, 'ico'], [0xd84444, 'oct'],
                    [0x3f7fd8, 'dod'], [0xe8b93a, 'oct'], [0x3fc8d8, 'ico'],
                    [0xe07bb8, 'dod'], [0xd89a3a, 'oct']
                ];
                const oreEdgeMat = new THREE.LineBasicMaterial({ color: 0xffffff });
                ORES.forEach((o, i) => {
                    const g = o[1] === 'oct' ? new THREE.OctahedronGeometry(0.052)
                        : o[1] === 'ico' ? new THREE.IcosahedronGeometry(0.050, 0)
                            : new THREE.DodecahedronGeometry(0.048);
                    const m = ctx.solid(g, new THREE.MeshBasicMaterial({ color: o[0] }), oreEdgeMat);
                    const col = i % 4, row = Math.floor(i / 4);
                    m.position.set(-0.27 + col * 0.18, 0.10 + row * 0.045, 0.10 - row * 0.21);
                    m.rotation.y = i * 0.7;
                    m.visible = false;
                    storageChest.add(m);
                    oreMeshes.push({ g: m, by: m.position.y });
                });
            }
            ctx.regMagic(storageChest, () => { ctx.storageOpen = !ctx.storageOpen; });

            /* ========================================================== */
            /* ============ 二楼陈设（床·书桌·魔杖·星象仪·挂画等） ============ */
            /* ========================================================== */

            /* ---- 18.1 大床 ---- */
}
