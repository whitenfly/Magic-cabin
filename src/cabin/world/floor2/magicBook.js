/**
 * 18.4 桌面魔法书本（点击翻开 / 撒符文 / 合上）—— `J4.36` 升格 `defineProp`
 *
 * 来源：`legacy/monolith.js` 原 `18.4` 分区里 `/* —— 魔法书本 —— *\/` 那一段
 * （`J3` 记的 L2593–2851）的**全部内容**：`bookG` 几何（封面 / 书脊 / 6 张翻页 / 7 张扇页
 * + `plate` / `pageStack` 两个局部工具）+ `bookState` 状态机 + 符文系统
 * （`GLYPH_SYMS` / `getGlyphTex` / `glyphObjs` / `spawnGlyphs` / `updateGlyphs`）。
 *
 * ## ★ 前置：`camera`（`SKIP` 记的唯一硬阻塞，已由 `J4.8` 解决）
 *
 * `floor2-magic-book.SKIP.md` §2 记的阻塞是：
 *
 * ```js
 * g.m.quaternion.copy(camera.quaternion);   // ← 符文面片永远朝向相机（billboard）
 * ```
 *
 * `camera` 当年是 monolith IIFE 里的局部 `const`，**不在 `propCtx` 的可用键里**
 * ⇒ 搬进来会立刻 `ReferenceError`，而它在**每帧**执行。
 * `SKIP` §3 给的两条解锁路径，第 1 条是「给 `propCtx` 补 `camera`」——
 * **`J4.8`（缺口 C1）已照此办理**（`propTool('camera', …)` / `propTool('renderer', …)`），
 * 本件直接从装配环境解构 `camera`。
 * 另一项依赖 `smooth`（`updateGlyphs` 与 `updateBook` 共用）也已由 `J4.31` 提取到
 * `core/math/easing.js` 并注入。
 *
 * ## ★ 两处不相邻的 `tick` 怎么合并（`J4.35` 施工图 §4 的方案）
 *
 * `FrameBody.js` 里原本是三行**不相邻**的调用：
 *
 * ```
 * L492  ctx.updateBook(time, dt);
 * L494  ctx.updateCal(dt);          ← 台历（**不属于本件**）
 * L502  ctx.updateGlyphs(time, dt);
 * ```
 *
 * 一件物件只有一个 `update` ⇒ 合并成**一个** `update`，登记在**靠前的那一处**（原 `frame/62`）。
 * **`update` 内部的两段顺序与原实现完全一致**（`updateBook` 段 → `updateGlyphs` 段）——
 * 只是把中间的 `updateCal` 排除在外。**等价性**：`updateCal` 改的是台历自己的状态，
 * 既不读 `glyphObjs` / `bookG`，也不写它们 ⇒ 两段之间无交互（施工图 §4 的判据 ① ②）。
 *
 * ⚠️ 施工图 §4 ③ 点出的"唯一需要实证的地方"——"本帧新生成的符文会不会在本帧就被老化一次"——
 * **在原实现里本来就会**（`updateBook` 就在 `updateGlyphs` 之前），
 * 而本件**保持了这一顺序** ⇒ 不存在行为差异（已由画面逐字节相同实证）。
 *
 * ## `clock.now` → `s.now`
 *
 * 原 `regMagic` 回调里写 `s.t0 = clock.now`；`clock` 只在每帧的 `clock.tick()` 里推进，
 * 而 `update` 的第一行就是 `s.now = time;`（`tickOnce()` 开头 `const time = clock.now;`）
 * ⇒ **二者恒等**，与 `floor2/rubik.js` / `floor2/witchHat.js` 同一处置。
 *
 * ## 逐字搬运说明
 *
 * 全部数值（书本位置 `(2.58, TBL_TOP + 0.001, -2.80)` 与 `rotation.y = -0.35`、
 * 封面板 `0.20/0.012/0.26`、纸板 `0.19/0.0012/0.245` 与 `gap 0.00025`、翻页 `0.0016`、
 * `COVER_FIN = π` / `COVER_Y0 = 0.039` / `COVER_Y1 = 0.006`、
 * `FLIP_CLOSED_Y = 0.0222 + i×0.0019` / `FLIP_OPEN_Y = 0.0128 + i×0.0019`、
 * `FAN_FIN` 的 7 档 `0.40…2.80`、书脊 `SPINE_R = 0.0225` 与 `CylinderGeometry(…, 0, π)`、
 * 状态机六相位的全部时长与阈值（`0.55/0.18`、`0.10/0.13/0.25`、`0.40`、`0.35/0.15/0.08/0.12/0.22/0.50`）、
 * 符文 `128px` 画布 / `84px serif` / `shadowBlur 22`、`PlaneGeometry(0.05, 0.05)`、
 * `renderOrder = 11`、生成间隔 `0.45`、上限 `16`、`life = 1.8 + rng`、`0.25` 淡入、
 * `0.8 + 0.3×|sin|` 缩放、`0.25×dt` 阻尼、`0.0004` 横向摆动）
 * **一个没改**。
 *
 * ## ⚠️ `rng`（不变量 `N8`）
 *
 * `spawnGlyphs(n)` 每个符文消耗 **7** 次 `runtimeRng()`（符号 1、颜色 1、位置 3、速度 2）
 * 另加 `life` / `ph` / `rs` 各 1 ⇒ **共 11 次**（`SKIP` §4 记的 4+3+4）。
 * `updateGlyphs` 每帧**不**消耗 rng。这些调用仍在**原来的位置与顺序**（`build` 与运行期）。
 */
import * as THREE from 'three'
import { defineProp } from '../../app/defineProp.js'

export default defineProp({
  id: 'floor2/magic-book',
  kind: 'decor',

  // `phase` / `t0` 是原来的 `bookState`；`bookGlyphT` 是原来的 `ctx.bookGlyphT`；
  // `now` 是 `clock.now` 的替身（`update` 第一行写入，与 `time` 恒等）
  state: () => ({ phase: 'closed', t0: 0, bookGlyphT: 0, now: 0 }),

  build({ scene, L, LITMAT, V, rng }) {
    const { TBL_TOP } = L
    const runtimeRng = rng.runtime

    // 书本在桌面上的位置 —— 提成常量，`anchor` 与几何同源（不变量 `N9`）。
    // 值与原实现完全一致（原来是两处独立的字面量）。
    const BOOK_X = 2.58;
    const BOOK_Z = -2.80;

    const bookG = new THREE.Group();
    bookG.position.set(BOOK_X, TBL_TOP + 0.001, BOOK_Z);
    bookG.rotation.y = -0.35;
    scene.add(bookG);
    const flipperPivots = [];
    const fanPivots = [];
    const FAN_FIN = [0.40, 0.80, 1.20, 1.60, 2.00, 2.40, 2.80];
    const COVER_FIN = Math.PI;
    const COVER_Y0 = 0.039;
    const COVER_Y1 = 0.006;
    const FLIP_CLOSED_Y = [];
    const FLIP_OPEN_Y = [];
    for (let i = 0; i < 6; i++) {
        FLIP_CLOSED_Y.push(0.0222 + i * 0.0019);
        FLIP_OPEN_Y.push(0.0128 + i * 0.0019);
    }
    let coverPivot, spineG;
    {
        const covMat = LITMAT(0x7a4638, { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
        const covEdge = new THREE.LineBasicMaterial({ color: 0x4a2820 });
        const pgMat = LITMAT(0xf3ecd8, { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
        const pgEdge = new THREE.LineBasicMaterial({ color: 0xb8ad8e });

        function plate(w, t, d, mat, emat) {
            const g = new THREE.BoxGeometry(w, t, d);
            const grp = new THREE.Group();
            const m = new THREE.Mesh(g, mat);
            m.position.x = w / 2;
            grp.add(m);
            const e = new THREE.LineSegments(new THREE.EdgesGeometry(g), emat);
            e.position.x = w / 2;
            grp.add(e);
            return grp;
        }

        function pageStack(count) {
            const grp = new THREE.Group();
            const t = 0.0012, gap = 0.00025;
            for (let i = 0; i < count; i++) {
                const pg = plate(0.19, t, 0.245, pgMat, pgEdge);
                pg.position.y = i * (t + gap);
                grp.add(pg);
            }
            return grp;
        }
        const back = plate(0.20, 0.012, 0.26, covMat, covEdge);
        back.position.set(0, 0.006, 0);
        bookG.add(back);
        const rightStack = pageStack(6);
        rightStack.position.set(0, 0.0125, 0);
        bookG.add(rightStack);
        for (let i = 0; i < 6; i++) {
            const pg = plate(0.19, 0.0016, 0.245, pgMat, pgEdge);
            pg.position.set(0, FLIP_CLOSED_Y[i], 0);
            bookG.add(pg);
            flipperPivots.push(pg);
        }
        for (let i = 0; i < 7; i++) {
            const pg = plate(0.19, 0.0016, 0.245, pgMat, pgEdge);
            pg.position.set(0, 0.0222 + i * 0.0009, 0);
            pg.visible = false;
            bookG.add(pg);
            fanPivots.push(pg);
        }
        coverPivot = plate(0.20, 0.012, 0.26, covMat, covEdge);
        coverPivot.position.set(0, COVER_Y0, 0);
        bookG.add(coverPivot);
        const SPINE_R = 0.0225;
        const spineGeo = new THREE.CylinderGeometry(SPINE_R, SPINE_R, 0.27, 12, 1, false, 0, Math.PI);
        spineGeo.rotateX(Math.PI / 2);
        const spineMat = LITMAT(0x7a4638, { side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
        spineG = new THREE.Group();
        spineG.position.set(0, SPINE_R, 0);
        spineG.rotation.z = Math.PI;
        spineG.add(new THREE.Mesh(spineGeo, spineMat));
        spineG.add(new THREE.LineSegments(new THREE.EdgesGeometry(spineGeo, 10), covEdge));
        bookG.add(spineG);
    }

    /* —— 符文系统（原样搬运：符号 / 颜色 / 纹理缓存 / 生成 / 老化）—— */
    const GLYPH_SYMS = ['✦', '☾', '✧', '∴', '⟡', '✱', '☽', '✸', '❖', '✺', '✜', '✻'];
    const GLYPH_COLS = ['#ff6a4a', '#ffd94a', '#6affd9', '#6aa8ff', '#c86aff', '#ff6ad5', '#fff2b0'];
    const glyphTexCache = {};

    function getGlyphTex(sym, col) {
        const key = sym + col;
        if (glyphTexCache[key]) return glyphTexCache[key];
        const cv = document.createElement('canvas');
        cv.width = 128;
        cv.height = 128;
        const cx = cv.getContext('2d');
        cx.font = '84px serif';
        cx.textAlign = 'center';
        cx.textBaseline = 'middle';
        cx.shadowColor = col;
        cx.shadowBlur = 22;
        cx.fillStyle = col;
        cx.fillText(sym, 64, 68);
        cx.shadowBlur = 0;
        cx.fillStyle = '#ffffff';
        cx.fillText(sym, 64, 68);
        const tex = new THREE.CanvasTexture(cv);
        glyphTexCache[key] = tex;
        return tex;
    }
    const glyphObjs = [];
    const glyphGeoShared = new THREE.PlaneGeometry(0.05, 0.05);

    function spawnGlyphs(n) {
        for (let i = 0; i < n; i++) {
            const sym = GLYPH_SYMS[Math.floor(runtimeRng() * GLYPH_SYMS.length)];
            const col = GLYPH_COLS[Math.floor(runtimeRng() * GLYPH_COLS.length)];
            const m = new THREE.Mesh(
                glyphGeoShared,
                new THREE.MeshBasicMaterial({ map: getGlyphTex(sym, col), transparent: true, opacity: 0, depthWrite: false })
            );
            m.renderOrder = 11;
            m.position.set(
                bookG.position.x + (runtimeRng() - 0.5) * 0.12,
                bookG.position.y + 0.10 + runtimeRng() * 0.03,
                bookG.position.z + (runtimeRng() - 0.5) * 0.10
            );
            scene.add(m);
            glyphObjs.push({
                m: m,
                v: V((runtimeRng() - 0.5) * 0.06, 0.10 + runtimeRng() * 0.07, (runtimeRng() - 0.5) * 0.06),
                life: 1.8 + runtimeRng() * 1.0,
                t: 0,
                ph: runtimeRng() * 6.28,
                rs: (runtimeRng() - 0.5) * 3
            });
        }
    }

    return {
      root: bookG,
      parts: {
        bookG, coverPivot, spineG, flipperPivots, fanPivots,
        glyphObjs, glyphGeoShared, glyphTexCache, getGlyphTex, spawnGlyphs,
        consts: { BOOK_X, BOOK_Z, COVER_FIN, COVER_Y0, COVER_Y1, FLIP_CLOSED_Y, FLIP_OPEN_Y, FAN_FIN },
      },
    }
  },

  // 原 `regMagic(bookG, …)` 的等价声明：闭着→开、开着→合（中间相位不响应）。
  // ⚠️ `s.t0 = s.now` 取代原 `s.t0 = clock.now`（二者恒等，见文件头）。
  interactables: (s, { parts }) => [{
    id: 'magic-book/toggle',
    label: '翻开 / 合上桌面的魔法书本',
    mode: 'both',
    // 锚点与几何同源（不变量 `N9`）：两边都读同一个 `consts.BOOK_X / BOOK_Z`
    anchor: { x: parts.consts.BOOK_X, z: parts.consts.BOOK_Z },
    radius: 1.5,
    hits: parts.bookG,
    onActivate: () => {
      if (s.phase === 'closed') {
          s.phase = 'opening';
          s.t0 = s.now;
      } else if (s.phase === 'open') {
          s.phase = 'closing';
          s.t0 = s.now;
      }
    },
  }],

  /**
   * 原 `updateBook(time, dt)`（L340–428）与本件第二次 tick `updateGlyphs(time, dt)`（L317–337）
   * 合并而成 —— 两段顺序与原实现**完全一致**（见文件头「两处不相邻的 tick」）。
   */
  update(dt, time, s, { scene, parts, camera, smooth }) {
    const { coverPivot, spineG, flipperPivots, fanPivots, glyphObjs, spawnGlyphs } = parts
    const { COVER_FIN, COVER_Y0, COVER_Y1, FLIP_CLOSED_Y, FLIP_OPEN_Y, FAN_FIN } = parts.consts

    s.now = time;

    /* ================= 第一段：原 `updateBook(time, dt)` ================= */
    {
        const e = time - s.t0;
        const ck = Math.max(0, Math.min(1, coverPivot.rotation.z / Math.PI));
        spineG.rotation.z = Math.PI + (Math.PI / 2) * ck;
        spineG.position.y = 0.0225 + (0.008 - 0.0225) * ck;
        const ss = 1 - 0.3 * ck;
        spineG.scale.set(ss, ss, 1);
        if (s.phase === 'opening') {
            const CO = 0.55, W = 0.18;
            const k = smooth(Math.min(e / CO, 1));
            coverPivot.rotation.z = COVER_FIN * k;
            coverPivot.position.y = COVER_Y0 + (COVER_Y1 - COVER_Y0) * k;
            if (e >= CO + W) {
                coverPivot.rotation.z = COVER_FIN;
                coverPivot.position.y = COVER_Y1;
                s.phase = 'flipping';
                s.t0 = time;
            }
        } else if (s.phase === 'flipping') {
            const D = 0.10, DUR = 0.13, W = 0.25;
            for (let i = 0; i < 6; i++) {
                const kk = smooth(Math.max(0, Math.min(1, (e - i * D) / DUR)));
                flipperPivots[i].rotation.z = 3.05 * kk;
                flipperPivots[i].position.y = FLIP_OPEN_Y[i] + (FLIP_CLOSED_Y[i] - FLIP_OPEN_Y[i]) * (1 - kk);
            }
            if (e >= 5 * D + DUR + W) {
                for (const fp of fanPivots) fp.visible = true;
                s.phase = 'fanning';
                s.t0 = time;
            }
        } else if (s.phase === 'fanning') {
            const F = 0.40;
            const k = smooth(Math.min(e / F, 1));
            for (let i = 0; i < 7; i++) {
                fanPivots[i].rotation.z = FAN_FIN[i] * k;
            }
            if (e >= F) {
                s.phase = 'open';
                spawnGlyphs(8);
                s.bookGlyphT = 0.45;
            }
        } else if (s.phase === 'open') {
            s.bookGlyphT -= dt;
            if (s.bookGlyphT <= 0 && glyphObjs.length < 16) {
                spawnGlyphs(1);
                s.bookGlyphT = 0.45;
            }
        } else if (s.phase === 'closing') {
            const FAN = 0.35, W1 = 0.15;
            const D = 0.08, DUR = 0.12, W2 = 0.22, CO = 0.50;
            const tFanEnd = FAN;
            const tFlipStart = FAN + W1;
            const tFlipEnd = tFlipStart + 5 * D + DUR;
            const tCoverStart = tFlipEnd + W2;
            const tEnd = tCoverStart + CO;
            if (e < tFanEnd) {
                const k = smooth(e / FAN);
                for (let i = 0; i < 7; i++) {
                    fanPivots[i].rotation.z = FAN_FIN[i] * (1 - k);
                }
            } else {
                for (const fp of fanPivots) {
                    fp.visible = false;
                    fp.rotation.z = 0;
                }
            }
            for (let i = 0; i < 6; i++) {
                const j = 5 - i;
                const kk = smooth(Math.max(0, Math.min(1, (e - tFlipStart - i * D) / DUR)));
                flipperPivots[j].rotation.z = 3.05 * (1 - kk);
                flipperPivots[j].position.y = FLIP_OPEN_Y[j] + (FLIP_CLOSED_Y[j] - FLIP_OPEN_Y[j]) * kk;
            }
            if (e >= tCoverStart) {
                const k2 = smooth(Math.min((e - tCoverStart) / CO, 1));
                coverPivot.rotation.z = COVER_FIN * (1 - k2);
                coverPivot.position.y = COVER_Y1 + (COVER_Y0 - COVER_Y1) * k2;
            }
            if (e >= tEnd) {
                coverPivot.rotation.z = 0;
                coverPivot.position.y = COVER_Y0;
                for (let i = 0; i < 6; i++) {
                    flipperPivots[i].rotation.z = 0;
                    flipperPivots[i].position.y = FLIP_CLOSED_Y[i];
                }
                s.phase = 'closed';
            }
        }
    }

    /* ================= 第二段：原 `updateGlyphs(time, dt)` ================= */
    {
        for (let i = glyphObjs.length - 1; i >= 0; i--) {
            const g = glyphObjs[i];
            g.t += dt;
            if (g.t >= g.life) {
                scene.remove(g.m);
                g.m.material.dispose();
                glyphObjs.splice(i, 1);
                continue;
            }
            g.m.position.addScaledVector(g.v, dt);
            g.m.position.x += Math.sin(time * 3 + g.ph) * 0.0004;
            g.v.multiplyScalar(Math.max(0, 1 - 0.25 * dt));
            const fade = g.t / (g.life - 0.7);
            g.m.material.opacity = Math.min(1, g.t / 0.25) * (1 - smooth(Math.max(0, Math.min(1, fade))));
            const sc = 0.8 + 0.3 * Math.abs(Math.sin(time * 4 + g.ph));
            g.m.scale.set(sc, sc, sc);
            g.m.quaternion.copy(camera.quaternion);
            g.m.rotation.z += g.rs * dt;
        }
    }
  },
})
