/**
 * 家具平台碰撞体 + collideXZ / groundAt —— 从 `legacy/monolith.js` 搬出的整段（collision）
 *
 * 来源：`J4` 段切片（段表见 `scripts/oneoff/_j4-segments.mjs`）。
 * 段内代码**逐字未改**，只做了三件事：包成函数、补 import、把跨段通信交给 `ctx`。
 * 因此这个文件的正确性判据与搬迁前完全一致：像素逐字节零差异。
 *
 * @param {object} ctx 段间通信载体（见 `installCabin` 的 `__J4_CTX__`）
 * @param {object} app 应用内核 —— 段里用到的 `registry`/`bus`/`scheduler`/`store` 从这里解构
 */
export function installCollision(ctx, app) {
            // ↓ J4 段导出（collision）：本段函数声明挂到 ctx（借提升，段内任何位置都可见）
            ctx.refreshPlatforms = refreshPlatforms; ctx.collideXZ = collideXZ; ctx.stairHeightAt = stairHeightAt; ctx.railCollide = railCollide; ctx.groundAt = groundAt;
            const platformBoxes = [
                { x1: ctx.MTX - 0.64, z1: ctx.MTZ - 0.46, x2: ctx.MTX + 0.64, z2: ctx.MTZ + 0.46, top: ctx.MTTOP },          // 原木餐桌
                { x1: ctx.DT_X - 1.36, z1: ctx.DT_Z - 0.46, x2: ctx.DT_X + 1.36, z2: ctx.DT_Z + 0.46, top: ctx.DTOP },      // 长餐桌
                { x1: ctx.KOT_X - 0.62, z1: ctx.KOT_Z - 0.62, x2: ctx.KOT_X + 0.62, z2: ctx.KOT_Z + 0.62, top: ctx.KTOP },  // 暖桌
                { x1: ctx.CBX - 0.28, z1: ctx.CBZ - 0.28, x2: ctx.CBX + 0.28, z2: ctx.CBZ + 0.28, top: 0.65 },         // 水晶球占卜台
                { x1: -1.84, z1: -1.97, x2: -0.86, z2: -1.03, top: 0.345 },                             // 灶台旁固定木台
                // J4.19：左墙书架已升格为 `world/floor1/bookshelf.js`，它的 `SFX`/`SFZ` 随之搬进
                // `world/layout.js`（不变量 N9）—— 碰撞表按 layout 取值，与几何**同源**。
                // ★ 数值逐字未变（-3.72 / -2.85）⇒ 碰撞行为与搬迁前完全一致。
                { x1: ctx.L.SHELF_X - 0.25, z1: ctx.L.SHELF_Z - 0.70, x2: ctx.L.SHELF_X + 0.25, z2: ctx.L.SHELF_Z + 0.70, top: 2.02 },         // 左墙书架（实心阻挡）
                { x1: ctx.CCX - 0.66, z1: ctx.CCZ - 0.66, x2: ctx.CCX + 0.66, z2: ctx.CCZ + 0.66, top: 1.28 },         // 大魔女坩埚（实心阻挡）
                { x1: -0.41, z1: -1.06, x2: 0.41, z2: -0.50, top: 0.49 },                              // 楼梯下储物箱
                { x1: -0.99, z1: -3.04, x2: -0.51, z2: -2.56, top: 0.48 },                             // 塔罗牌小圆凳
                { x1: ctx.BEDX - 0.68, z1: ctx.BEDZ - 1.18, x2: ctx.BEDX + 0.68, z2: ctx.BEDZ + 1.13, top: ctx.FY + 0.85, bot: ctx.FY }, // 二楼大床
                { x1: ctx.NSX - 0.29, z1: ctx.NSZ - 0.26, x2: ctx.NSX + 0.29, z2: ctx.NSZ + 0.26, top: ctx.FY + 0.60, bot: ctx.FY },    // 二楼床头柜
                { x1: ctx.TBLX - 1.22, z1: ctx.TBLZ - 0.58, x2: ctx.TBLX + 1.22, z2: ctx.TBLZ + 0.58, top: ctx.FY + 0.80, bot: ctx.FY }, // 二楼书桌
                { x1: -2.03, z1: 3.26, x2: -0.77, z2: 3.84, top: ctx.FY + 1.95, bot: ctx.FY },                 // 二楼衣柜（实心阻挡）
                { x1: 2.22, z1: 3.53, x2: 2.88, z2: 3.68, top: ctx.FY + 1.85, bot: ctx.FY },                   // 二楼拱形全身镜（实心阻挡）
                { x1: -3.58, z1: 2.28, x2: -2.40, z2: 3.48, top: ctx.FY + 2.0, bot: ctx.FY },                  // 二楼小黑板画架（实心阻挡）
                { x1: 0.61, z1: 3.21, x2: 1.29, z2: 3.76, top: ctx.FY + 0.41, bot: ctx.FY },                  // 二楼置物箱
                { x1: 1.59, z1: -3.66, x2: 2.11, z2: -3.14, top: ctx.FY + 0.60, bot: ctx.FY }                 // 二楼垃圾桶
            ];
            ctx.platformBoxes = platformBoxes;
            const movingPlatforms = [
                // J3（B2）：三脚圆凳已搬入 world/floor1/stools.js —— 碰撞平台改用装配记录里的部件
                { g: ctx.stoolsApi.parts.stoolA, hx: 0.23, hz: 0.23, top: 0.475 },
                { g: ctx.stoolsApi.parts.stoolB, hx: 0.23, hz: 0.23, top: 0.475 },
                { g: ctx.cartG, hx: 0.21, hz: 0.16, top: 0.482 },
                { g: ctx.chairG, hx: 0.24, hz: 0.24, top: ctx.FY + 0.49, bot: ctx.FY },
                { g: ctx.stoolG, hx: 0.17, hz: 0.15, top: ctx.FY + 0.33, bot: ctx.FY },
                ...ctx.chairs.map(c => ({ g: c, hx: 0.23, hz: 0.23, top: 0.475 }))
            ];
            ctx.movingPlatforms = movingPlatforms;
            ctx.activePlatforms = platformBoxes;
            function refreshPlatforms() {
                ctx.activePlatforms = platformBoxes.slice();
                for (const m of movingPlatforms) {
                    const px = m.g.position.x, pz = m.g.position.z;
                    ctx.activePlatforms.push({ x1: px - m.hx, z1: pz - m.hz, x2: px + m.hx, z2: pz + m.hz, top: m.top, bot: m.bot || 0 });
                }
            }
            function collideXZ(px, pz, y) { const boxes = ctx.solidBoxes.slice(); if (y >= 2.35 || !ctx.doorGroup.userData.spring.open) boxes.push(ctx.DOOR_BOX); for (const p of ctx.activePlatforms) { if (y < p.top - 0.42 && y + 0.5 > (p.bot || 0)) boxes.push(p); } for (const b of boxes) { const cx = Math.max(b.x1, Math.min(px, b.x2)); const cz = Math.max(b.z1, Math.min(pz, b.z2)); let dx = px - cx, dz = pz - cz; const d2 = dx * dx + dz * dz; if (d2 < ctx.PLAYER_R * ctx.PLAYER_R) { if (d2 < 1e-9) { const l = px - b.x1, rr = b.x2 - px; const tt = pz - b.z1, bb = b.z2 - pz; const m = Math.min(l, rr, tt, bb); if (m === l) px = b.x1 - ctx.PLAYER_R; else if (m === rr) px = b.x2 + ctx.PLAYER_R; else if (m === tt) pz = b.z1 - ctx.PLAYER_R; else pz = b.z2 + ctx.PLAYER_R; } else { const d = Math.sqrt(d2); px = cx + dx / d * ctx.PLAYER_R; pz = cz + dz / d * ctx.PLAYER_R; } } } return [px, pz]; }
            function stairHeightAt(aDeg) { if (aDeg > 30 && aDeg < 300) return ((aDeg - 30) / 270) * ctx.FLOOR_TOP; return 0; }
            function railCollide(px, pz, y, prevX, prevZ) { const r = Math.hypot(px, pz); if (r < 1e-5) return [px, pz]; const a = (Math.atan2(px, pz) * 180 / Math.PI + 360) % 360; const pR = Math.hypot(prevX, prevZ); const pA = (Math.atan2(prevX, prevZ) * 180 / Math.PI + 360) % 360; const inLand = ang => (ang >= 300 || ang <= 60); if (y > ctx.FLOOR_TOP - 0.30 && y < ctx.FLOOR_TOP + 0.95) { if (a > 60 && a < 300 && pA > 60 && pA < 300) { if (pR < 1.24 && r > 1.24) { const s = 1.21 / r; px *= s; pz *= s; } else if (pR > 1.24 && r < 1.24) { const s = 1.27 / r; px *= s; pz *= s; } } if (Math.min(r, pR) < 1.24 && inLand(a) !== inLand(pA)) { if ((a > 60 && a < 160) || (pA > 60 && pA < 160)) { px = prevX; pz = prevZ; } } } else if (y > 0.45 && y <= ctx.FLOOR_TOP - 0.30) { const sh = stairHeightAt(a); if (pR < 1.25 && Math.abs(y - sh) < 0.85) { if (r > 0.98 && r < 1.12) { const s = 0.98 / r; px *= s; pz *= s; } else if (r < 0.30) { const s = 0.30 / r; px *= s; pz *= s; } } } else if (y <= 0.45) { if (pR >= 1.14 && r < 1.14 && !(a > 18 && a < 62)) { const s = 1.14 / r; px *= s; pz *= s; } } return [px, pz]; }
            function groundAt(x, z, curY) { let g = 0; const r = Math.hypot(x, z); const a = (Math.atan2(x, z) * 180 / Math.PI + 360) % 360; if (r > 0.10 && r < 1.20 && a > 30 && a < 300) { const h = Math.min(((a - 30) / 270) * ctx.FLOOR_TOP, ctx.FLOOR_TOP); if (curY > h - 0.5) g = Math.max(g, h); } for (const p of ctx.activePlatforms) { if (x > p.x1 && x < p.x2 && z > p.z1 && z < p.z2 && curY > p.top - 0.45) g = Math.max(g, p.top); } if (x > -4 && x < 4 && z > -4 && z < 4 && curY > 2.6) { if (r >= 1.20) g = Math.max(g, ctx.FLOOR_TOP); else if (a >= 300 || a <= 60) g = Math.max(g, ctx.FLOOR_TOP); } return g; }

            /* ---- 音效辅助：门窗弹簧 / 壁炉 / 吊灯 / 魔法物件 ---- */
}
