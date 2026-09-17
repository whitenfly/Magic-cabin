/**
 * 18.7 宇宙星空粒子系统（96 颗会飘会闪的星）—— `J4.41` 升格 `defineProp`
 *
 * 来源：`legacy/monolith.js` 原 `18.7` 分区（`J4.37` 施工图 §2 记的 `install.js` L236–327）。
 * 它是**组 9 的最后一件**，也是任务 D 里**单件消耗 `floor2Rng` 最多**的一件。
 *
 * ## ★ `rng`：96 × 7 = **672 次** `floor2Rng()`（`J4.37` §6 · 不变量 `N8`）
 *
 * 每颗星消耗 **7** 次：`th` · `orbR`（同一行，**顺序固定**）· `y0` · `ph` · `sp` · `bob` · `rs`。
 *
 * > ⚠️ 这是**全项目单件最多**的一次性消耗。它发生在 `build` 期 ⇒
 * > **`installProp(starParticles)` 的调用位置必须与原 18.7 段的位置完全一致**，
 * > 否则它之后所有依赖 `floor2Rng` 的段（18.8 计划板 / 18.9 魔法杖 / 18.10 垃圾桶…）
 * > 抽到的随机数**全部错位**，画面必变。
 * >
 * > 本件从装配环境取 **`rng.floor2`**（`app/rng.js` 里 `scene.floor2` 的**同一个实例**，
 * > `install.js` 顶部的 `const floor2Rng = scene.floor2` 也是它）⇒ 序列位置不变 ✓
 *
 * ## 唯一的帧任务：`frame/77`
 *
 * 约 45 行、逐字搬运（`J4.41` 保留了它的全部结构：`partsOn` 早退、六种 `tw` 闪烁曲线、
 * 位置/自转/缩放/`halo`/`spikes`/`cluster`/`tails` 的分支）。
 *
 * 登记在 `veil` 之后（`J4.37` §3.3 的组 9 顺序 `astro → candle → veil → star-particles`）。
 * 它读的 `magicP` 由最前面的 `prop/astro` 写入 ⇒ **本帧**值（判据 ①）✓
 *
 * ### ⚠️ 唯一的一处非逐字改动（**已论证等价**）
 *
 * 原实现每次用到强度都写 `ctx.magicP`（一层属性），本件对应 `astroApi.state.magicP`（**两层**）。
 * 那 6 处出现**全在同一个 `for` 循环体内**，且同一帧内 `state.magicP` **不会变**
 * ⇒ 提到循环外读一次（`const magicP = astroApi.state.magicP`）**语义完全等价**，
 * 同时省掉 96 帧内 5×96 = 480 次属性链读取。
 * **除此之外，本件的每一行、每一个数值都与原实现一字不差。**
 *
 * ## 与其它"多子节点"物件的同款处置
 *
 * 96 颗星**各自 `scene.add`**（搬迁前就没有共同父节点）⇒
 * `root` 取 `parts.magicParts[0]`（**仅用于登记**的元数据），与
 * `floor1/bookshelf.js`（12 本书）· `floor1/longTable.js`（3 只盘）·
 * `floor1/tableware.js`（5 件餐具）· `floor1/diningChairs.js` · `floor1/stools.js` 同一手法。
 *
 * ## 没有交互、没有光源
 *
 * 原 18.7 段**没有任何 `regMagic`** ⇒ 本件**不声明 `interactables()`**；
 * 它也不持有光源槽位（八 个槽位里没有它）⇒ **不声明 `lights()`**。
 *
 * ## 逐字搬运说明
 *
 * 全部数值一个没改：粒子数 `96`、`typ = i % 6` 的六种形态及其全部几何与材质参数
 * （见下 §「六种形态」）、`g.visible = false`、轨道 `orbR = 1.0 + rng×2.6` 与
 * `cx = cos(th)×orbR×0.85` / `cz = sin(th)×orbR`、`y0 = FY + 0.40 + rng×2.5`、
 * `sp = 0.10 + rng×0.28`、`bob = 0.06 + rng×0.10`、`rs = (rng−0.5)×0.012`；
 * 帧侧：`partsOn` 阈值 `0.02`、位置三分量 `sin(th×0.6)×0.15` / `sin(th)×bob` / `cos(th×0.5)×0.12`、
 * 六种 `tw` 表达式、缩放 `magicP×(0.8 + 0.35×tw)` 且下限 `0.001`、
 * `halo` 用 `opIn/opOut`、`spikes` 系数 `0.85`、`cluster` 半径 `0.030` 与高度 `0.008`、
 * `tails` 的 `0.5/s` 与位移 `0.045/0.018`。
 *
 * **六种形态**（`typ`）：
 *
 * | typ | 外形 | 本体 | halo `(r, opIn, opOut)` |
 * |---|---|---|---|
 * | 5 | `vivid` | `Sphere(0.012, 8, 6)` + `MeshBasicMaterial({color})` | `(0.028, 0.42, 0.14)` |
 * | 0 | `sharp` | `Octahedron(0.013)` + `MeshBasicMaterial({color})` | `(0.026, 0.35, 0.12)` |
 * | 1 | `spikes` | `Sphere(0.017, 8, 6)` + `LITMAT(0xffffff)` + 十字 `LineSegments`（`spikeLen 0.075`）| `(0.040, 0.45, 0.16)` |
 * | 2 | `nebula` | `Sphere(0.015, 10, 8)` + `Basic({color, transparent, opacity: 0.75})` | `(0.070, 0.30, 0.22)` |
 * | 3 | `tails` | `Sphere(0.016, 8, 6)` + `LITMAT(0xffffff)` + 4 段尾迹（`0.016×(1−(s−1)×0.16)`）| `(0.036, 0.40, 0.14)` |
 * | 4 | `cluster` | 3 个小 `Octahedron(0.009)`（首个白色）+ `ph = c×2.09` | `(0.042, 0.22, 0.10)` |
 *
 * 颜色池：`STAR_COLORS`（8 色，`typ ≠ 5`）· `VIVID_COLORS`（6 色，`typ = 5`），
 * 均按 `i % 池长` 取 —— 两个池都**不再挂 `ctx`**（搬前已 grep 确认无外部读者）。
 */
import * as THREE from 'three'
import { defineProp } from '../../app/defineProp.js'

export default defineProp({
  id: 'floor2/star-particles',
  kind: 'decor',

  // 本件没有自己的状态量 —— 唯一驱动量 `magicP` 属于 `astro`（见文件头）。
  state: () => ({}),

  build({ scene, L, V, LITMAT, rng }) {
    const { FY } = L
    // ★ 与 `install.js` 顶部 `const floor2Rng = scene.floor2` 是**同一个实例**（不变量 N8）
    const floor2Rng = rng.floor2

    const STAR_COLORS = [0xffffff, 0xbfd8ff, 0xffe9b0, 0xd9c1ff, 0x9fd8ff, 0xc9a2ff, 0x9ffce8, 0xffd166];
    const VIVID_COLORS = [0xff2255, 0x22ee66, 0x00b4ff, 0xffee00, 0xff00cc, 0x00ffe0];
    const magicParts = [];

    function addHalo(parent, color, r, opIn, opOut) {
        const h1 = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
        const h2 = new THREE.Mesh(new THREE.SphereGeometry(r * 1.5, 10, 8), new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
        h1.renderOrder = 7;
        h2.renderOrder = 7;
        parent.add(h1);
        parent.add(h2);
        return { h1: h1, h2: h2, opIn: opIn, opOut: opOut };
    }
    for (let i = 0; i < 96; i++) {
        const typ = i % 6;
        const g = new THREE.Group();
        let cl;
        if (typ === 5) {
            cl = VIVID_COLORS[i % VIVID_COLORS.length];
            g.add(new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), new THREE.MeshBasicMaterial({ color: cl })));
            g.userData.halo = addHalo(g, cl, 0.028, 0.42, 0.14);
            g.userData.vivid = true;
        } else {
            cl = STAR_COLORS[i % STAR_COLORS.length];
            if (typ === 0) {
                g.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.013), new THREE.MeshBasicMaterial({ color: cl })));
                g.userData.halo = addHalo(g, cl, 0.026, 0.35, 0.12);
                g.userData.sharp = true;
            } else if (typ === 1) {
                g.add(new THREE.Mesh(new THREE.SphereGeometry(0.017, 8, 6), LITMAT(0xffffff)));
                const spikeMat = new THREE.LineBasicMaterial({ color: cl, transparent: true, opacity: 0 });
                const spikeLen = 0.075;
                g.add(new THREE.LineSegments(
                    new THREE.BufferGeometry().setFromPoints([
                        V(-spikeLen, 0, 0), V(spikeLen, 0, 0),
                        V(0, -spikeLen * 0.7, 0), V(0, spikeLen * 0.7, 0)
                    ]), spikeMat
                ));
                g.userData.spikes = spikeMat;
                g.userData.halo = addHalo(g, cl, 0.040, 0.45, 0.16);
            } else if (typ === 2) {
                g.add(new THREE.Mesh(
                    new THREE.SphereGeometry(0.015, 10, 8),
                    new THREE.MeshBasicMaterial({ color: cl, transparent: true, opacity: 0.75 })
                ));
                g.userData.halo = addHalo(g, cl, 0.070, 0.30, 0.22);
                g.userData.nebula = true;
            } else if (typ === 3) {
                g.add(new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), LITMAT(0xffffff)));
                g.userData.tails = [];
                for (let s = 1; s <= 4; s++) {
                    const tp = new THREE.Mesh(
                        new THREE.SphereGeometry(0.016 * (1 - (s - 1) * 0.16), 6, 5),
                        new THREE.MeshBasicMaterial({ color: cl, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
                    );
                    tp.renderOrder = 7;
                    g.add(tp);
                    g.userData.tails.push({ m: tp, s: s });
                }
                g.userData.halo = addHalo(g, cl, 0.036, 0.40, 0.14);
            } else {
                g.userData.cluster = [];
                for (let c = 0; c < 3; c++) {
                    const sg = new THREE.Group();
                    sg.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.009), new THREE.MeshBasicMaterial({ color: c === 0 ? 0xffffff : cl })));
                    g.add(sg);
                    g.userData.cluster.push({ g: sg, ph: c * 2.09 });
                }
                g.userData.halo = addHalo(g, cl, 0.042, 0.22, 0.10);
            }
        }
        g.visible = false;
        const th = floor2Rng() * 6.28, orbR = 1.0 + floor2Rng() * 2.6;
        g.userData.p = {
            cx: Math.cos(th) * orbR * 0.85,
            cz: Math.sin(th) * orbR,
            y0: FY + 0.40 + floor2Rng() * 2.5,
            ph: floor2Rng() * 6.28,
            sp: 0.10 + floor2Rng() * 0.28,
            bob: 0.06 + floor2Rng() * 0.10,
            rs: (floor2Rng() - 0.5) * 0.012
        };
        scene.add(g);
        magicParts.push(g);
    }

    // 96 颗星各自 `scene.add`（无共同父节点）⇒ `root` 取第一个，**仅用于登记**（见文件头）
    return { root: magicParts[0], parts: { magicParts } }
  },

  // ⚠️ 本件**没有 `interactables()`** —— 原 18.7 段没有任何 regMagic（它不是可点的陈设）。
  // ⚠️ 本件**没有 `lights()`** —— 它不持有任何光源槽位（八 个槽位里没有它）。

  /**
   * 原 `FrameBody` 的 `frame/77`（L556–600）—— 逐字搬运，只有一处等价改写（见文件头）。
   */
  update(dt, time, s, { parts, astroApi }) {
    const { magicParts } = parts
    // ⚠️ 唯一的非逐字改动：原实现 6 处都写 `ctx.magicP`，本件提到循环外读一次
    //    （同一帧内 `state.magicP` 不变 ⇒ 语义完全等价，见文件头）
    const magicP = astroApi.state.magicP;

    const partsOn = magicP > 0.02;
    for (const g of magicParts) {
        g.visible = partsOn;
        if (!partsOn) continue;
        const b = g.userData.p;
        const th = time * b.sp + b.ph;
        g.position.set(
            b.cx + Math.sin(th * 0.6) * 0.15,
            b.y0 + Math.sin(th) * b.bob,
            b.cz + Math.cos(th * 0.5) * 0.12
        );
        g.rotation.y += b.rs;
        let tw;
        if (g.userData.vivid) {
            tw = Math.max(0.05, Math.pow(Math.abs(Math.sin(time * 3.4 + b.ph * 11)), 2.5) * 1.25);
        } else if (g.userData.sharp) {
            tw = Math.max(0.12, Math.pow(Math.abs(Math.sin(time * 2.2 + b.ph * 7)), 3) * 1.15);
        } else if (g.userData.nebula) {
            tw = 0.75 + 0.25 * Math.sin(time * 0.8 + b.ph * 3);
        } else {
            tw = 0.7 + 0.4 * Math.sin(time * 2.0 + b.ph * 5);
        }
        g.scale.setScalar(Math.max(0.001, magicP * (0.8 + 0.35 * tw)));
        if (g.userData.halo) {
            g.userData.halo.h1.material.opacity = g.userData.halo.opIn * tw * magicP;
            g.userData.halo.h2.material.opacity = g.userData.halo.opOut * tw * magicP;
        }
        if (g.userData.spikes) {
            g.userData.spikes.opacity = 0.85 * tw * magicP;
        }
        if (g.userData.cluster) {
            for (const c of g.userData.cluster) {
                const a = time * 0.5 + c.ph;
                c.g.position.set(Math.cos(a) * 0.030, Math.sin(a * 0.8) * 0.008, Math.sin(a) * 0.030);
            }
        }
        if (g.userData.tails) {
            for (const tl of g.userData.tails) {
                tl.m.material.opacity = (0.5 / tl.s) * tw * magicP;
                tl.m.position.set(-Math.sin(th) * 0.045 * tl.s, -Math.cos(th * 0.5) * 0.018 * tl.s, 0);
            }
        }
    }
  },
})
