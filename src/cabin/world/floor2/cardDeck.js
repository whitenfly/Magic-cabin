/**
 * 18.4 桌面玩具：扑克牌堆（点击 → 浮起、扇开、洗牌，最后翻出一张牌再收回） —— `J3` 搬迁（B5）
 *
 * 来源：`legacy/monolith.js` 原 `18.4` 分区里 `/* —— 扑克牌堆 —— *\/` 那一小节
 * （2028–2196 行区间内：11 张牌 + 牌背 canvas 纹理 + 翻牌面 canvas + `drawFace` +
 * `regMagic` + `updateDeck`），以及 `tickOnce()` 里那一行 `updateDeck(time);`。
 *
 * ## 搬迁对照
 *
 * | 原来住哪 | 现在住哪 |
 * |---|---|
 * | 行内 `V(3.35, TBL_TOP + 0.002, -2.15)` | `world/layout.js` 的 `DECK_HOME`（不变量 `N9`） |
 * | 顶层 `const deckState = { phase, t0 }` | `state()` + `now`（替 `clock.now`） |
 * | `deckG / deckCards / revealCard` | `build()` 经 `{ root, parts }` 交出 |
 * | `regMagic(deckG, …)` | `interactables()`（`label` 语义化 + `mode: 'both'`） |
 * | `tickOnce()` 的 `updateDeck(time);` | `update()`（**原地 tick**，参数顺序 `(dt, time)`） |
 *
 * ## `clock.now` → `s.now`
 *
 * 原 `regMagic` 回调里 `deckState.t0 = clock.now`。与 `floor2/witchHat.js` / `floor2/rubik.js`
 * 同一处置：`update` 第一行把本帧 `time` 存进 `s.now`，二者**恒等**（不是近似）。
 *
 * ## rng
 *
 * 翻牌面用的是 `Math.floor(runtimeRng() * 4)`（每次点击 **1 次**）；`build` 不消耗随机源。
 * `rng.runtime` 是同一个真随机源实例，调用次数与顺序未变（不变量 `N8`）。
 *
 * ## ctx 键
 *
 * `scene` / `L(DECK_HOME)` / `LITMAT` / `rng.runtime` / `smooth`（**只在 `update` 里解构** ——
 * `smooth` 在原 monolith 里住在 18.8 段，`build` 期间还在 TDZ，只有每帧调用时才取得到）。
 */
import * as THREE from 'three'
import { defineProp } from '../../app/defineProp.js'

/** 原 `updateDeck(time)`，逐字搬运（`deckState` → 形参 `s`；三个捕获量按原名从 `parts` 解构回来） */
function updateDeck(s, time, env) {
    const { parts, smooth } = env;
    const deckG = parts.body, deckCards = parts.cards, revealCard = parts.revealCard;
    const DECK_HOME = parts.home;
    if (s.phase === 'idle') return;
    const e = time - s.t0;
    const rc = revealCard.grp;
    const go = ph => { s.phase = ph; s.t0 = time; };
    if (s.phase === 'rise') {
        const k = smooth(Math.min(e / 0.35, 1));
        deckG.position.y = DECK_HOME.y + 0.22 * k;
        if (e >= 0.35) go('split');
    } else if (s.phase === 'split') {
        deckG.position.y = DECK_HOME.y + 0.22 + Math.sin(time * 5) * 0.004;
        const k = smooth(Math.min(e / 0.28, 1));
        for (const c of deckCards) {
            const side = (c.userData.i < 6) ? -1 : 1;
            c.position.x = side * 0.052 * k;
            c.position.y = c.userData.base.y + (side > 0 ? 0.005 : 0) * k;
            c.rotation.y = side * 0.12 * k;
        }
        rc.position.x = 0.026 * k;
        if (e >= 0.36) go('riffle');
    } else if (s.phase === 'riffle') {
        deckG.position.y = DECK_HOME.y + 0.22 + Math.sin(time * 5) * 0.004;
        for (const c of deckCards) {
            const side = (c.userData.i < 6) ? -1 : 1;
            const tk = smooth(Math.max(0, Math.min(1, (e - (side > 0 ? 0.14 : 0)) / 0.30)));
            c.position.x = side * 0.052 * (1 - tk);
            c.position.y = c.userData.base.y + (side > 0 ? 0.005 : 0) * (1 - tk) + Math.sin(tk * Math.PI) * 0.006;
            c.rotation.y = side * 0.12 * (1 - tk);
        }
        const rtk = smooth(Math.max(0, Math.min(1, (e - 0.14) / 0.30)));
        rc.position.x = 0.026 * (1 - rtk);
        if (e >= 0.52) go('settle');
    } else if (s.phase === 'settle') {
        for (const c of deckCards) {
            c.position.copy(c.userData.base);
            c.rotation.y = 0;
        }
        rc.position.set(0, revealCard.homeY, 0);
        if (e >= 0.15) go('rup');
    } else if (s.phase === 'rup') {
        const k = smooth(Math.min(e / 0.30, 1));
        rc.position.y = revealCard.homeY + 0.11 * k;
        if (e >= 0.30) go('rflip');
    } else if (s.phase === 'rflip') {
        const k = smooth(Math.min(e / 0.45, 1));
        rc.rotation.x = Math.PI * k;
        rc.position.y = revealCard.homeY + 0.11 + 0.025 * Math.sin(k * Math.PI);
        if (e >= 0.45) go('rhold');
    } else if (s.phase === 'rhold') {
        rc.position.y = revealCard.homeY + 0.11 + Math.sin(time * 2.5) * 0.004;
        if (e >= 1.5) go('rback');
    } else if (s.phase === 'rback') {
        const k = smooth(Math.min(e / 0.45, 1));
        rc.rotation.x = Math.PI * (1 - k);
        rc.position.y = revealCard.homeY + 0.11 + 0.025 * Math.sin((1 - k) * Math.PI);
        if (e >= 0.45) go('rdown');
    } else if (s.phase === 'rdown') {
        const k = smooth(Math.min(e / 0.30, 1));
        rc.position.y = revealCard.homeY + 0.11 * (1 - k);
        if (e >= 0.30) go('down');
    } else if (s.phase === 'down') {
        rc.rotation.x = 0;
        const k = smooth(Math.min(e / 0.40, 1));
        deckG.position.y = DECK_HOME.y + 0.22 * (1 - k);
        if (e >= 0.40) {
            deckG.position.copy(DECK_HOME);
            s.phase = 'idle';
        }
    }
}

export default defineProp({
  id: 'floor2/card-deck',
  kind: 'decor',

  /** 原 `const deckState = { phase: 'idle', t0: 0 }` + `now`（替 `clock.now`） */
  state: () => ({ phase: 'idle', t0: 0, now: 0 }),

  build({ scene, L, V, LITMAT }) {
    // `DECK_HOME` 来自 layout（不变量 N9）—— 与几何同源，交互锚点也用它
    const { DECK_HOME } = L

    const deckG = new THREE.Group();
    deckG.position.copy(DECK_HOME);
    scene.add(deckG);
    const DECK_N = 11;
    const deckCards = [];
    let revealCard = null, revealFaceMat = null;
    const SUITS = [
        { ch: '♥', col: '#d0342c' },
        { ch: '♦', col: '#d0342c' },
        { ch: '♣', col: '#222222' },
        { ch: '♠', col: '#222222' }
    ];
    {
        const backCv = document.createElement('canvas');
        backCv.width = 128;
        backCv.height = 180;
        const bc = backCv.getContext('2d');
        bc.fillStyle = '#b04a4a';
        bc.fillRect(0, 0, 128, 180);
        bc.strokeStyle = 'rgba(255,255,255,0.75)';
        bc.lineWidth = 2;
        for (let k = -180; k < 180; k += 14) {
            bc.beginPath();
            bc.moveTo(k, 0);
            bc.lineTo(k + 180, 180);
            bc.stroke();
            bc.beginPath();
            bc.moveTo(k + 180, 0);
            bc.lineTo(k, 180);
            bc.stroke();
        }
        bc.strokeStyle = '#7a2a2a';
        bc.lineWidth = 8;
        bc.strokeRect(4, 4, 120, 172);
        const backTex = new THREE.CanvasTexture(backCv);
        const backMat = new THREE.MeshBasicMaterial({ map: backTex });
        const whiteMat = LITMAT(0xfdfdf6);
        const sideMat = LITMAT(0xe8e2d0);
        const cardGeo = new THREE.BoxGeometry(0.055, 0.0016, 0.078);
        const cardEdgeMat = new THREE.LineBasicMaterial({ color: 0x8a3a3a });
        for (let i = 0; i < DECK_N; i++) {
            const c = new THREE.Group();
            const m = new THREE.Mesh(cardGeo, [sideMat, sideMat, backMat, whiteMat, sideMat, sideMat]);
            c.add(m);
            c.add(new THREE.LineSegments(new THREE.EdgesGeometry(cardGeo), cardEdgeMat));
            const by = i * 0.0017;
            c.position.set(0, by, 0);
            c.userData = { i: i, base: V(0, by, 0) };
            deckG.add(c);
            deckCards.push(c);
        }
        const faceCv = document.createElement('canvas');
        faceCv.width = 128;
        faceCv.height = 180;
        const faceTex = new THREE.CanvasTexture(faceCv);
        revealFaceMat = new THREE.MeshBasicMaterial({ map: faceTex });
        revealCard = { canvas: faceCv, tex: faceTex };

        function drawFace(si) {
            const fc = faceCv.getContext('2d');
            const su = SUITS[si];
            fc.fillStyle = '#fdfdf6';
            fc.fillRect(0, 0, 128, 180);
            fc.strokeStyle = '#cccccc';
            fc.lineWidth = 4;
            fc.strokeRect(4, 4, 120, 172);
            fc.fillStyle = su.col;
            fc.textAlign = 'center';
            fc.textBaseline = 'middle';
            fc.font = '88px serif';
            fc.fillText(su.ch, 64, 96);
            fc.font = '26px serif';
            fc.fillText(su.ch, 20, 24);
            fc.fillText(su.ch, 108, 156);
            faceTex.needsUpdate = true;
        }
        drawFace(0);
        const rc = new THREE.Group();
        const rGeo = new THREE.BoxGeometry(0.055, 0.0016, 0.078);
        const rm = new THREE.Mesh(rGeo, [sideMat, sideMat, backMat, revealFaceMat, sideMat, sideMat]);
        rc.add(rm);
        rc.add(new THREE.LineSegments(new THREE.EdgesGeometry(rGeo), cardEdgeMat));
        rc.position.set(0, DECK_N * 0.0017, 0);
        deckG.add(rc);
        revealCard.grp = rc;
        revealCard.draw = drawFace;
        revealCard.homeY = rc.position.y;
    }

    return { root: deckG, parts: { body: deckG, cards: deckCards, revealCard, home: DECK_HOME } }
  },

  /** 原 `regMagic(deckG, …)` 的替身（`label` 语义化 + `mode: 'both'`，消解风险 `R1`） */
  interactables: (s, { L, parts, rng }) => {
    const runtimeRng = rng.runtime;
    return [{
      id: 'card-deck/reveal',
      label: '翻开扑克牌堆顶上的牌',
      mode: 'both',
      // 锚点与几何同源：牌堆就摆在 `DECK_HOME`（不变量 N9）
      anchor: { x: L.DECK_HOME.x, z: L.DECK_HOME.z },
      radius: 1.5,
      onActivate: () => {
        if (s.phase !== 'idle') return;
        parts.revealCard.draw(Math.floor(runtimeRng() * 4));
        s.phase = 'rise';
        s.t0 = s.now;
      },
    }];
  },

  /** 原 `tickOnce()` 里那行 `updateDeck(time);`，逐字搬运 */
  update(dt, time, s, env) {
    s.now = time;   // ★ 见文件头：`onActivate` 用它取替 `clock.now`
    updateDeck(s, time, env);
  },
})
