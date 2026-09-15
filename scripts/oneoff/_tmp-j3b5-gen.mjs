/**
 * 临时生成器（B5 v2）：从 `legacy/monolith.js` **逐行抽原文**生成 `world/floor2/*.js`。
 *
 * v1 用硬编码行号 —— 但 monolith 正被并发批次改写，行号会漂移（已实测 +363 行）。
 * v2 改为**按标记文本 / 锚点文本定位**，与 spec 的 startMarker/endMarker 同一套依据。
 *
 * 缩进约定：monolith IIFE 内基准缩进 12 → 目标基准缩进 4（去掉 8 个空格）。
 * 替换表的 from/to 都写「去缩进后」的原文（多行片段第一行可省前导空格，后续行必须写足）。
 * 不是交付物，跑完即删。
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '../..')
const MONO = path.join(ROOT, 'src/cabin/legacy/monolith.js')
const lines = fs.readFileSync(MONO, 'utf8').split('\n')

const deindent = (l) => (l.startsWith('        ') ? l.slice(8) : l)

/** 整行完全等于 `text` 的行（0-based 下标），要求全文唯一 */
function lineExact(text) {
  const hits = []
  for (let i = 0; i < lines.length; i++) if (lines[i] === text) hits.push(i)
  if (hits.length !== 1) throw new Error(`标记必须全文唯一，实得 ${hits.length} 次：${JSON.stringify(text)}`)
  return hits[0]
}

/** 在 [from, to) 内**含** `frag` 的行（0-based），要求恰好一处 */
function anchor(frag, from, to) {
  const hits = []
  for (let i = from; i < to; i++) if (lines[i].includes(frag)) hits.push(i)
  if (hits.length !== 1) throw new Error(`锚点 [${from},${to}) 内需恰好 1 处，实得 ${hits.length}：${JSON.stringify(frag)}`)
  return hits[0]
}

function applySubs(t, subs, where) {
  for (const [from, to, mode] of subs) {
    const n = t.split(from).length - 1
    if (n === 0) throw new Error(`${where} 替换表未命中：${JSON.stringify(from.slice(0, 90))}`)
    if (mode !== 'all' && n !== 1) throw new Error(`${where} 替换表命中 ${n} 次（须 1 次）：${JSON.stringify(from.slice(0, 90))}`)
    t = t.split(from).join(to)
  }
  return t
}

/** 去掉尾部空行与纯 `/* ==== *\/` 分隔线 */
function trimTail(t) {
  const ls = t.split('\n')
  while (ls.length) {
    const last = ls[ls.length - 1].trim()
    if (last === '' || /^\/\* =+ \*\/$/.test(last)) ls.pop()
    else break
  }
  return ls.join('\n')
}

/**
 * 建一个「分区 → 分段」抽取器。
 * @param {string} start 分区起始标记行（整行逐字）
 * @param {string} end   下一分区的起始标记行（整行逐字）
 */
function makeRegion(start, end) {
  const s = lineExact(start)
  const e = lineExact(end)
  if (!(e > s)) throw new Error(`endMarker 必须在 startMarker 之后：${start}`)
  const body = [s + 1, e]   // 0-based 半开区间
  return {
    start, end, lines1: [s + 1, e - 1],   // 1-based 含端点（写文档用）
    /** 取 [a, b) 两行下标之间的原文；a=null 表示分区首行，b=null 表示分区末行之后 */
    seg(aFrag, bFrag, subs = []) {
      const ia = aFrag === null ? body[0] : anchor(aFrag, body[0], body[1])
      const ib = bFrag === null ? body[1] : anchor(bFrag, ia + 1, body[1])
      const raw = lines.slice(ia, ib).map(deindent).join('\n')
      return applySubs(trimTail(raw), subs, `${start} [${ia + 1}..${ib}]`)
    },
  }
}

const DL = (s) => [`${s}\n`, '']
const F = {}
const put = (name, text) => { F[name] = text }

/* ── 分区 ──────────────────────────────────────────────────────────── */
const R_DESK = makeRegion('            /* ---- 18.4 书桌 + 椅子 + 桌面玩具 ---- */', '            /* —— 椅子 —— */')
const R_RUBIK = makeRegion('            /* —— 魔方 —— */', '            /* —— 通用倒塌/恢复 —— */')
const R_COIN = makeRegion('            /* —— 通用倒塌/恢复 —— */', '            /* —— 扑克牌堆 —— */')
const R_DECK = makeRegion('            /* —— 扑克牌堆 —— */', '            /* —— 玻璃雪景球 —— */')
const R_SNOW = makeRegion('            /* —— 玻璃雪景球 —— */', '            /* —— 沙漏 —— */')
const R_HG = makeRegion('            /* —— 沙漏 —— */', '            /* —— 台历（转轴位于背板面顶端：未翻页贴板前面、翻过页贴板背面， */')
const R_CAL = makeRegion('            /* —— 台历（转轴位于背板面顶端：未翻页贴板前面、翻过页贴板背面， */', '            /* —— 魔法书本 —— */')
const R_PIC = makeRegion('            /* 18.13 前墙挂画（镜子旁，点击编辑链接，支持 gif 动图） */', '            /* 18.14 拱形全身镜（点击镜面泛起水波涟漪） */')

/* ═══════════════ 1. floor2/desk ═══════════════ */
put('desk.js', `/**
 * 18.4 书桌（桌腿 ×4 + 桌面 + 两侧横撑） —— \`J3\` 搬迁（B5）
 *
 * 来源：\`legacy/monolith.js\` 原 \`18.4\` 分区**第一小节**（\`/* ---- 18.4 书桌 + 椅子 + 桌面玩具 ---- *\\/\`
 * 与 \`/* —— 椅子 —— *\\/\` 之间）的纯几何段。
 *
 * ## 为什么 18.4 要拆成多个模块
 *
 * \`18.4\` 一个分区里塞了桌体 / 椅子 / 魔方 / 金币柱 / 扑克牌堆 / 玻璃雪景球 / 沙漏 / 台历 /
 * 魔法书本共 **9 件互相独立的陈设**（各自有独立的根 Group、独立的状态、独立的 \`regMagic\`）。
 * \`defineProp\` 的粒度就是「一件陈设」（\`defineProp.js\` 文件头：**「加一件陈设」= 一个文件**），
 * 所以按原注释小节切开搬，每一件各自一个模块。
 *
 * 本件是其中最薄的一件：**纯几何、无状态、无交互、无每帧逻辑** ⇒ \`assign\` / \`tick\` 都不需要。
 *
 * ## 搬迁对照
 *
 * | 原来住哪 | 现在住哪 |
 * |---|---|
 * | \`TBLX\` / \`TBLZ\` / \`FY\`（**本来就是 layout 常量**） | \`world/layout.js\`（本件**不新增**任何常量，不变量 \`N9\`） |
 * | \`for (const sxsz of …) put(…)\` 等 6 行 | \`build()\`（逐字搬运，只改缩进） |
 *
 * ## ctx 键
 *
 * \`L(TBLX, TBLZ, FY)\` / \`put\` / \`edge\` / \`box\`（按需解构，不展开 \`ctx\`）。
 * 本件**不消耗 \`rng\`**（原段一个随机调用都没有）⇒ \`rng\` 调用序列一个字节没变。
 * 本件**不声明 \`mount\` / \`interactables\` / \`lights\` / \`update\`** —— 与搬迁前一致（原来没有 \`regMagic\`）。
 */
import * as THREE from 'three'
import { defineProp } from '../../app/defineProp.js'

export default defineProp({
  id: 'floor2/desk',
  kind: 'furniture',

  build({ L, put, edge, box }) {
    const { TBLX, TBLZ, FY } = L

${R_DESK.seg(null, null)}
  },
})
`)

/* ═══════════════ 2. floor2/rubik ═══════════════ */
const RUBIK_GEOM = R_RUBIK.seg('const rubikG = new THREE.Group();', 'function beginLayer(', [
  DL("    const RUBIK_HOME = V(3.15, TBL_TOP + 0.085, -2.68);"),
  DL("    const rubikState = { phase: 'idle', t0: 0, moves: [], mi: 0, scrambled: false, history: [] };"),
  DL("    let layerAnim = null;"),
])
const RUBIK_FNS = R_RUBIK.seg('function beginLayer(', 'regMagic(rubikG, () => {', [
  ["function beginLayer(axis, layer, dir, dur, onDone) {",
    "function beginLayer(s, env, axis, layer, dir, dur, onDone) {\n    const { parts } = env;\n    const rubikPivot = parts.pivot, cubies = parts.cubies;"],
  ["layerAnim = { axis: axis,", "s.layerAnim = { axis: axis,"],
  ["function updateLayerAnim(dt) {",
    "function updateLayerAnim(s, dt, env) {\n    const { parts } = env;\n    const rubikPivot = parts.pivot, cubies = parts.cubies, rubikG = parts.body, AXV = parts.axv;"],
  ["if (!layerAnim) return;", "if (!s.layerAnim) return;"],
  ["const la = layerAnim;", "const la = s.layerAnim;"],
  ["layerAnim = null;", "s.layerAnim = null;"],
  ["function startNextTurn() {\n        const s = rubikState;\n", "function startNextTurn(s, env) {\n"],
  ["beginLayer(mv.a, mv.l, mv.d, 0.30, () => {", "beginLayer(s, env, mv.a, mv.l, mv.d, 0.30, () => {"],
  ["startNextTurn();", "startNextTurn(s, env);"],
  ["s.t0 = clock.now;", "s.t0 = s.now;"],
])
const RUBIK_UPDATE = R_RUBIK.seg('function updateRubik(time) {', null, [
  ["function updateRubik(time) {\n        const s = rubikState;\n",
    "function updateRubik(s, time, env) {\n    const { parts } = env;\n    const rubikG = parts.body, RUBIK_HOME = parts.home;"],
  ["startNextTurn();", "startNextTurn(s, env);"],
])

put('rubik.js', `/**
 * 18.4 桌面玩具：魔方（点击 → 浮起自转打乱 / 再点还原） —— \`J3\` 搬迁（B5）
 *
 * 来源：\`legacy/monolith.js\` 原 \`18.4\` 分区里 \`/* —— 魔方 —— *\\/\` 那一小节
 * （${R_RUBIK.lines1[0]}–${R_RUBIK.lines1[1]} 行区间内：27 个小方块几何 + \`beginLayer\` / \`updateLayerAnim\` /
 * \`startNextTurn\` / \`updateRubik\` 四个函数 + \`regMagic\`），以及 \`tickOnce()\` 里相邻两行
 * \`updateRubik(time);\` / \`updateLayerAnim(dt);\`。
 *
 * ## 搬迁对照
 *
 * | 原来住哪 | 现在住哪 |
 * |---|---|
 * | 行内 \`V(3.15, TBL_TOP + 0.085, -2.68)\` | \`world/layout.js\` 的 \`RUBIK_HOME\`（不变量 \`N9\`；数值一个没改） |
 * | 顶层 \`const rubikState = { … }\` | \`state()\`（字段名不变：\`phase/t0/moves/mi/scrambled/history\`） |
 * | 顶层 \`let layerAnim = null\` | \`s.layerAnim\` |
 * | \`regMagic(rubikG, …)\` | \`interactables()\`（\`label\` 语义化 + \`mode: 'both'\`） |
 * | \`tickOnce()\` 的两行 | \`update()\`（**原地 tick**，见下） |
 *
 * ## ★ 细节 1：\`clock.now\` → \`s.now\`（**同一个数**，不是近似）
 *
 * 原实现两处读 \`clock.now\`：\`regMagic\` 回调里 \`s.t0 = clock.now\`、
 * \`startNextTurn()\` 里 \`s.t0 = clock.now\`。
 * \`clock\` 只在每帧 \`clock.tick(t)\` 里推进，而 \`tickOnce()\` 开头是 \`const time = clock.now;\` ——
 * 于是**任何时刻**读到 \`clock.now\`，都等于**上一帧**传给 \`update\` 的那个 \`time\`。
 * \`update\` 第一行 \`s.now = time;\` 把它存下来，两处一律改读 \`s.now\`：与原实现**同一个数**。
 * （\`ctx\` 里没有 \`clock\`，也不该为此新增一个 \`ctx\` 键 —— 与 \`floor2/witchHat.js\` 同一处置。）
 *
 * ## ★ 细节 2：四个函数搬到模块作用域，捕获量按原名从 \`parts\` 解构回来
 *
 * 模块作用域与 monolith 的 IIFE 闭包不通，于是 \`rubikPivot / cubies / rubikG / AXV /
 * RUBIK_HOME\` 都变成显式参数。做法与 \`floor1/broom.js\` 的 \`parts\` 一致：
 * \`build\` 里**再解构回原名**（\`const rubikPivot = parts.pivot\` 等），于是四个函数的函数体
 * **逐字未改**。\`AXV\`（三个单位轴）由 \`build\` 用 ctx 的 \`V\` 造好后经 \`parts.axv\` 交出 ——
 * 它是 \`V(1,0,0)\` 这类"几何 DSL 产物"，只有 \`build\` 拿得到 \`V\`。
 *
 * ## ★ tick 接线（应用器的 \`spec.tick\` 直接代劳）
 *
 * \`tickOnce()\` 里相邻两行 \`updateRubik(time);\` + \`updateLayerAnim(dt);\` 合并成一行
 * \`rubikApi.tick(dt, time);\`。⚠️ **参数顺序与原名相反**（原名分别是 \`(time)\` 与 \`(dt)\`）。
 *
 * ## rng
 *
 * \`build\` **不消耗**随机源；只有"点一下"时那 18 次 \`runtimeRng()\`（6 步 × 3 次）——
 * 经 \`rng.runtime\` 取的是**同一个真随机源实例**，调用次数与顺序未变（不变量 \`N8\`）。
 */
import * as THREE from 'three'
import { defineProp } from '../../app/defineProp.js'

/** 原 \`beginLayer()\` / \`updateLayerAnim(dt)\` / \`startNextTurn()\`，逐字搬运（捕获量按原名从 \`env.parts\` 解构） */
${RUBIK_FNS}

/** 原 \`updateRubik(time)\`，逐字搬运 */
${RUBIK_UPDATE}

export default defineProp({
  id: 'floor2/rubik',
  kind: 'decor',

  /** 原 \`const rubikState = { … }\` + \`let layerAnim = null\`，外加 \`now\`（替 \`clock.now\`，见文件头细节 1） */
  state: () => ({
    phase: 'idle', t0: 0, moves: [], mi: 0, scrambled: false, history: [],
    layerAnim: null, now: 0,
  }),

  build({ scene, L, V, LITMAT }) {
    // \`RUBIK_HOME\` 来自 layout（不变量 N9）—— 与几何同源，交互锚点也用它
    const { RUBIK_HOME } = L

${RUBIK_GEOM}

    // 根 + 后续要访问的部件（对齐 \`floor1/broom.js\` 的 \`{ root, parts }\` 契约）
    return { root: rubikG, parts: { body: rubikG, pivot: rubikPivot, cubies, home: RUBIK_HOME, axv: AXV } }
  },

  /** 原 \`regMagic(rubikG, …)\` 的替身（\`label\` 语义化 + \`mode: 'both'\`，消解风险 \`R1\`） */
  interactables: (s, { L, rng }) => {
    const runtimeRng = rng.runtime;
    return [{
      id: 'rubik/scramble',
      label: '转动桌上的魔方',
      mode: 'both',
      // 锚点与几何同源：魔方就摆在 \`RUBIK_HOME\`（不变量 N9）
      anchor: { x: L.RUBIK_HOME.x, z: L.RUBIK_HOME.z },
      radius: 1.4,
      onActivate: () => {
        if (s.phase !== 'idle') return;
        if (!s.scrambled) {
          const AX = ['x', 'y', 'z'], LS = [-1, 0, 1];
          s.moves = [];
          let lastAxis = '';
          for (let i = 0; i < 6; i++) {
            let ax;
            do {
              ax = AX[Math.floor(runtimeRng() * 3)];
            } while (ax === lastAxis);
            lastAxis = ax;
            s.moves.push({ a: ax, l: LS[Math.floor(runtimeRng() * 3)], d: runtimeRng() < 0.5 ? 1 : -1 });
          }
          s.history = s.moves.slice();
        } else {
          s.moves = s.history.slice().reverse().map(m => ({ a: m.a, l: m.l, d: -m.d }));
        }
        s.mi = 0;
        s.phase = 'up';
        s.t0 = s.now;
      },
    }];
  },

  /** 原 \`tickOnce()\` 里相邻两行 \`updateRubik(time);\` + \`updateLayerAnim(dt);\`，逐字搬运 */
  update(dt, time, s, env) {
    s.now = time;   // ★ 见文件头「细节 1」：\`onActivate\` 用它取替 \`clock.now\`
    updateRubik(s, time, env);
    updateLayerAnim(s, dt, env);
  },
})
`)

/* ═══════════════ 3. floor2/coin-towers ═══════════════ */
const TOPPLE_FNS = R_COIN.seg('const toppleGroups = [];', 'const coinG = new THREE.Group();', [
  DL("    const toppleGroups = [];"),
  ["function regTopple(group, items) {", "function regTopple(s, group, items) {"],
  ["toppleGroups.push(group);", "s.groups.push(group);"],
  DL("        regMagic(group, () => { group.userData.tp.open = !group.userData.tp.open; });"),
])
const COIN_GEOM = R_COIN.seg('const coinG = new THREE.Group();', null, [
  DL("        const BASE = { x: 3.34, z: -2.28 };"),
  ["regTopple(coinG, coinItems);", "regTopple(state, coinG, coinItems);"],
])

put('coinTowers.js', `/**
 * 18.4 桌面玩具：金币柱 ×3（点击 → 25 枚金币"哗啦"倒塌铺开 → 再点复位） —— \`J3\` 搬迁（B5）
 *
 * 来源：\`legacy/monolith.js\` 原 \`18.4\` 分区里 \`/* —— 通用倒塌/恢复 —— *\\/\` 与
 * \`/* —— 金币柱 ×3 —— *\\/\` 两小节（${R_COIN.lines1[0]}–${R_COIN.lines1[1]} 行区间内），以及 \`tickOnce()\` 里那一行
 * \`for (const tg of toppleGroups) updateTopple(tg);\`。
 *
 * ## 搬迁对照
 *
 * | 原来住哪 | 现在住哪 |
 * |---|---|
 * | 顶层 \`const toppleGroups = []\` | \`state.groups\`（\`regTopple\` 在 \`build\` 里 push，**同一个数组**） |
 * | 行内 \`const BASE = { x: 3.34, z: -2.28 }\` | \`world/layout.js\` 的 \`COIN_BASE\`（不变量 \`N9\`） |
 * | \`regTopple\` 末尾的 \`regMagic(group, …)\` | \`interactables()\`（**每个 group 一条**，与原实现条数一致） |
 * | \`tickOnce()\` 的那一行 | \`update()\`（**原地 tick**） |
 *
 * \`updateTopple(group)\` 与 \`regTopple\` 是**本件私有**的两个函数（已 grep 核对：\`toppleGroups\` /
 * \`regTopple\` / \`updateTopple\` 只出现在本段与 \`tickOnce()\` 那一行）——
 * 所以随本段一起搬走，不构成"共享工具"缺口。
 *
 * ## rng
 *
 * \`build\` 里每枚金币两次 \`floor2Rng()\`（\`fr\` 的 y 旋转与 \`delay\`），共 49 枚。
 * 经 \`rng.floor2\` 取的是**同一个种子随机源实例**，调用次数与顺序未变（不变量 \`N8\`）——
 * \`build\` 仍在 monolith 的原位置被调用（\`installProp\` 替换的正是那一行）。
 */
import * as THREE from 'three'
import { defineProp } from '../../app/defineProp.js'

/** 原 \`regTopple()\` / \`updateTopple()\`，逐字搬运（\`toppleGroups\` → \`s.groups\`；末尾的 \`regMagic\` 移到 \`interactables\`） */
${TOPPLE_FNS}

export default defineProp({
  id: 'floor2/coin-towers',
  kind: 'decor',

  /** 原顶层 \`const toppleGroups = []\` */
  state: () => ({ groups: [] }),

  build({ scene, L, LITMAT, rng, state }) {
    // 金币柱基座来自 layout（不变量 N9）—— 与几何同源，交互锚点也用它
    const { COIN_BASE: BASE } = L
    const floor2Rng = rng.floor2

${COIN_GEOM}

    return coinG
  },

  /**
   * 原 \`regTopple()\` 里那行 \`regMagic(group, …)\` 的替身 —— **每个 group 一条**
   * （原来是"注册一个 group 就配一条交互"，这里用 \`s.groups.map\` 保持同样的条数）。
   */
  interactables: (s, { L }) => s.groups.map((g, i) => ({
    id: \`coin-towers/topple-\${i}\`,
    label: '推倒桌上的金币柱',
    mode: 'both',
    // 锚点与几何同源：金币柱基座就是 \`COIN_BASE\`（不变量 N9）
    anchor: { x: L.COIN_BASE.x, z: L.COIN_BASE.z },
    radius: 1.5,
    onActivate: () => { g.userData.tp.open = !g.userData.tp.open; },
  })),

  /** 原 \`tickOnce()\` 里那行 \`for (const tg of toppleGroups) updateTopple(tg);\`，逐字搬运 */
  update(dt, time, s) {
    for (const tg of s.groups) updateTopple(tg);
  },
})
`)

/* ═══════════════ 4. floor2/card-deck ═══════════════ */
const DECK_GEOM = R_DECK.seg('const deckG = new THREE.Group();', "const deckState = { phase: 'idle', t0: 0 };", [
  DL("    const DECK_HOME = V(3.35, TBL_TOP + 0.002, -2.15);"),
])
const DECK_UPDATE = R_DECK.seg('function updateDeck(time) {', null, [
  ["function updateDeck(time) {\n        const s = deckState;\n",
    `function updateDeck(s, time, env) {
    const { parts, smooth } = env;
    const deckG = parts.body, deckCards = parts.cards, revealCard = parts.revealCard;
    const DECK_HOME = parts.home;`],
])

put('cardDeck.js', `/**
 * 18.4 桌面玩具：扑克牌堆（点击 → 浮起、扇开、洗牌，最后翻出一张牌再收回） —— \`J3\` 搬迁（B5）
 *
 * 来源：\`legacy/monolith.js\` 原 \`18.4\` 分区里 \`/* —— 扑克牌堆 —— *\\/\` 那一小节
 * （${R_DECK.lines1[0]}–${R_DECK.lines1[1]} 行区间内：11 张牌 + 牌背 canvas 纹理 + 翻牌面 canvas + \`drawFace\` +
 * \`regMagic\` + \`updateDeck\`），以及 \`tickOnce()\` 里那一行 \`updateDeck(time);\`。
 *
 * ## 搬迁对照
 *
 * | 原来住哪 | 现在住哪 |
 * |---|---|
 * | 行内 \`V(3.35, TBL_TOP + 0.002, -2.15)\` | \`world/layout.js\` 的 \`DECK_HOME\`（不变量 \`N9\`） |
 * | 顶层 \`const deckState = { phase, t0 }\` | \`state()\` + \`now\`（替 \`clock.now\`） |
 * | \`deckG / deckCards / revealCard\` | \`build()\` 经 \`{ root, parts }\` 交出 |
 * | \`regMagic(deckG, …)\` | \`interactables()\`（\`label\` 语义化 + \`mode: 'both'\`） |
 * | \`tickOnce()\` 的 \`updateDeck(time);\` | \`update()\`（**原地 tick**，参数顺序 \`(dt, time)\`） |
 *
 * ## \`clock.now\` → \`s.now\`
 *
 * 原 \`regMagic\` 回调里 \`deckState.t0 = clock.now\`。与 \`floor2/witchHat.js\` / \`floor2/rubik.js\`
 * 同一处置：\`update\` 第一行把本帧 \`time\` 存进 \`s.now\`，二者**恒等**（不是近似）。
 *
 * ## rng
 *
 * 翻牌面用的是 \`Math.floor(runtimeRng() * 4)\`（每次点击 **1 次**）；\`build\` 不消耗随机源。
 * \`rng.runtime\` 是同一个真随机源实例，调用次数与顺序未变（不变量 \`N8\`）。
 *
 * ## ctx 键
 *
 * \`scene\` / \`L(DECK_HOME)\` / \`LITMAT\` / \`rng.runtime\` / \`smooth\`（**只在 \`update\` 里解构** ——
 * \`smooth\` 在原 monolith 里住在 18.8 段，\`build\` 期间还在 TDZ，只有每帧调用时才取得到）。
 */
import * as THREE from 'three'
import { defineProp } from '../../app/defineProp.js'

/** 原 \`updateDeck(time)\`，逐字搬运（\`deckState\` → 形参 \`s\`；三个捕获量按原名从 \`parts\` 解构回来） */
${DECK_UPDATE}

export default defineProp({
  id: 'floor2/card-deck',
  kind: 'decor',

  /** 原 \`const deckState = { phase: 'idle', t0: 0 }\` + \`now\`（替 \`clock.now\`） */
  state: () => ({ phase: 'idle', t0: 0, now: 0 }),

  build({ scene, L, LITMAT }) {
    // \`DECK_HOME\` 来自 layout（不变量 N9）—— 与几何同源，交互锚点也用它
    const { DECK_HOME } = L

${DECK_GEOM}

    return { root: deckG, parts: { body: deckG, cards: deckCards, revealCard, home: DECK_HOME } }
  },

  /** 原 \`regMagic(deckG, …)\` 的替身（\`label\` 语义化 + \`mode: 'both'\`，消解风险 \`R1\`） */
  interactables: (s, { L, parts, rng }) => {
    const runtimeRng = rng.runtime;
    return [{
      id: 'card-deck/reveal',
      label: '翻开扑克牌堆顶上的牌',
      mode: 'both',
      // 锚点与几何同源：牌堆就摆在 \`DECK_HOME\`（不变量 N9）
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

  /** 原 \`tickOnce()\` 里那行 \`updateDeck(time);\`，逐字搬运 */
  update(dt, time, s, env) {
    s.now = time;   // ★ 见文件头：\`onActivate\` 用它取替 \`clock.now\`
    updateDeck(s, time, env);
  },
})
`)

/* ═══════════════ 5. floor2/snow-globe ═══════════════ */
const SNOW_GEOM = R_SNOW.seg('const snowG = new THREE.Group();', 'regMagic(snowG, () => {', [
  ["snowG.position.set(3.50, TBL_TOP, -2.80);", "snowG.position.set(SNOW_X, TBL_TOP, SNOW_Z);"],
])
const SNOW_UPDATE = R_SNOW.seg('function updateSnow(time, dt) {', null, [
  ["function updateSnow(time, dt) {",
    `function updateSnow(time, dt, env) {
    const { parts, rng } = env;
    const snowParts = parts.flakes, SNOW_C = parts.center, SNOW_R = parts.radius, SNOW_FLOOR = parts.floor;
    const runtimeRng = rng.runtime;`],
])

put('snowGlobe.js', `/**
 * 18.4 桌面玩具：玻璃雪景球（点击 → 雪花被吹起，在球内翻滚、落回、复位） —— \`J3\` 搬迁（B5）
 *
 * 来源：\`legacy/monolith.js\` 原 \`18.4\` 分区里 \`/* —— 玻璃雪景球 —— *\\/\` 那一小节
 * （${R_SNOW.lines1[0]}–${R_SNOW.lines1[1]} 行区间内：木座 + 玻璃罩 + 小树/小屋 + 24 片雪花 + \`regMagic\` + \`updateSnow\`），
 * 以及 \`tickOnce()\` 里那一行 \`updateSnow(time, dt);\`。
 *
 * ## 搬迁对照
 *
 * | 原来住哪 | 现在住哪 |
 * |---|---|
 * | 行内 \`3.50\` / \`-2.80\` | \`world/layout.js\` 的 \`SNOW_X\` / \`SNOW_Z\`（不变量 \`N9\`） |
 * | \`SNOW_C / SNOW_R / SNOW_FLOOR\`（**局部空间的球心/半径/落点高度**，不是摆放坐标） | 留在 \`build()\`（与 \`floor2/mirror.js\` 的 \`OUT_W / IN_H\` 同类），经 \`parts\` 交给 \`update\` |
 * | \`snowParts\` | \`parts.flakes\`（**同一个数组实例**） |
 * | \`regMagic(snowG, …)\` | \`interactables()\`（\`label\` 语义化 + \`mode: 'both'\`） |
 * | \`tickOnce()\` 的 \`updateSnow(time, dt);\` | \`update()\`（**原地 tick**，参数顺序 \`(dt, time)\`） |
 *
 * 本件**没有 \`state\`** —— 原来也没有任何跨帧状态（雪花的运动全在 \`snowParts\` 的每个元素上，
 * 而它属于几何）。于是 \`update\` 里连 \`s\` 都不用。
 *
 * ## rng
 *
 * \`build\` 里每片雪花 5 次 \`floor2Rng()\`（\`a / ph / r / ph / sf\`），共 24 片；
 * "点一下"与每帧的落底重抛用 \`runtimeRng\`。两者经 \`rng.floor2\` / \`rng.runtime\` 取的是
 * **同一个种子随机源实例**，调用次数与顺序未变（不变量 \`N8\`）。
 *
 * ## 命名知会
 *
 * \`interactables\` 里的循环变量仍叫 \`s\`（原实现就是 \`for (const s of snowParts)\`），
 * 它**遮蔽**外层的 state 形参 —— 该块内不使用 state，故无歧义，函数体得以逐字未改。
 */
import * as THREE from 'three'
import { defineProp } from '../../app/defineProp.js'

/** 原 \`updateSnow(time, dt)\`，逐字搬运（捕获量按原名从 \`parts\` / \`rng\` 解构回来） */
${SNOW_UPDATE}

export default defineProp({
  id: 'floor2/snow-globe',
  kind: 'decor',

  build({ scene, L, V, LITMAT, rng }) {
    const { SNOW_X, SNOW_Z, TBL_TOP } = L
    const floor2Rng = rng.floor2

${SNOW_GEOM}

    return {
      root: snowG,
      parts: { body: snowG, flakes: snowParts, center: SNOW_C, radius: SNOW_R, floor: SNOW_FLOOR },
    }
  },

  /** 原 \`regMagic(snowG, …)\` 的替身（\`label\` 语义化 + \`mode: 'both'\`，消解风险 \`R1\`） */
  interactables: (state, { L, parts, rng }) => {
    const runtimeRng = rng.runtime;
    return [{
      id: 'snow-globe/shake',
      label: '摇晃玻璃雪景球',
      mode: 'both',
      // 锚点与几何同源：雪景球就在 \`SNOW_X / SNOW_Z\`（不变量 N9）
      anchor: { x: L.SNOW_X, z: L.SNOW_Z },
      radius: 1.4,
      onActivate: () => {
        for (const s of parts.flakes) {
          const a = runtimeRng() * 6.28, ph = Math.acos(2 * runtimeRng() - 1);
          s.v.x += Math.sin(ph) * Math.cos(a) * (0.15 + runtimeRng() * 0.20);
          s.v.z += Math.sin(ph) * Math.sin(a) * (0.15 + runtimeRng() * 0.20);
          s.v.y += 0.10 + runtimeRng() * 0.14;
        }
      },
    }];
  },

  /** 原 \`tickOnce()\` 里那行 \`updateSnow(time, dt);\`，逐字搬运 */
  update(dt, time, s, env) {
    updateSnow(time, dt, env);
  },
})
`)

/* ═══════════════ 6. floor2/desk-hourglass ═══════════════ */
const HG_GEOM = R_HG.seg('const hourG = new THREE.Group();', 'regMagic(hourG, () => {', [
  ["hourG.position.set(2.15, TBL_TOP + 0.106, -2.50);", "hourG.position.set(DESK_HG_X, TBL_TOP + 0.106, DESK_HG_Z);"],
  DL("    const hourSand = { up: 1.0, dn: 0.05 };"),
  DL("    const hourState = { phase: 'flow', t0: clock.now };"),
])
const HG_UPDATE = R_HG.seg('function updateHourglass(time) {', null, [
  ["function updateHourglass(time) {\n        const s = hourState;\n",
    `function updateHourglass(s, time, env) {
    const { parts, smooth } = env;
    const hourG = parts.body, sandUp = parts.up, sandDn = parts.dn, sandStream = parts.stream;
    const hourSand = s.sand;`],
])

put('deskHourglass.js', `/**
 * 18.4 桌面玩具：沙漏（点击 → 翻个身，沙子从上球流到下球，流完停住） —— \`J3\` 搬迁（B5）
 *
 * 来源：\`legacy/monolith.js\` 原 \`18.4\` 分区里 \`/* —— 沙漏 —— *\\/\` 那一小节
 * （${R_HG.lines1[0]}–${R_HG.lines1[1]} 行区间内：木框 + 玻璃双锥 + 上下沙堆 + 沙流 + \`regMagic\` + \`updateHourglass\`），
 * 以及 \`tickOnce()\` 里那一行 \`updateHourglass(time);\`。
 *
 * ## 与 \`floor1/hourglass.js\` 不是同一件
 *
 * \`floor1/hourglass\` 是**楼梯下储物架台面上**那只（原 \`12.9b\`，位置来自 \`L.HG_POS\`）；
 * 本件是**二楼书桌桌面**上这只（原 \`18.4\`，位置 \`(2.15, TBL_TOP + 0.106, -2.50)\`）。
 * 两者的几何、状态机与交互完全独立，只是外形相同 —— 所以 \`id\` 用 \`floor2/desk-hourglass\`
 * 以免与前者撞名（\`registry\` 的 id 查重会立刻炸）。
 *
 * ## 搬迁对照
 *
 * | 原来住哪 | 现在住哪 |
 * |---|---|
 * | 行内 \`2.15\` / \`-2.50\` | \`world/layout.js\` 的 \`DESK_HG_X\` / \`DESK_HG_Z\`（不变量 \`N9\`） |
 * | 顶层 \`const hourState = { phase: 'flow', t0: clock.now }\` | \`state()\` 的 \`phase / t0\`（\`t0\` 取 **0**） |
 * | 顶层 \`const hourSand = { up: 1.0, dn: 0.05 }\` | \`state.sand\`（字段名不变，\`update\` 里以原名 \`hourSand\` 别住） |
 * | \`sandUp / sandDn / sandStream\` | \`build()\` 经 \`parts\` 交出 |
 * | \`regMagic(hourG, …)\` | \`interactables()\`（\`label\` 语义化 + \`mode: 'both'\`） |
 * | \`tickOnce()\` 的 \`updateHourglass(time);\` | \`update()\`（**原地 tick**，参数顺序 \`(dt, time)\`） |
 *
 * ## ★ \`t0: clock.now\` 为什么写成 \`t0: 0\`
 *
 * \`clock\` 只在 \`animate()\` 里的 \`clock.tick(t)\` 推进，而**全部建几何代码都在第一次
 * \`animate()\` 之前**（\`monolith.js\` 末尾：\`if (clock.mode === 'manual') { … } else { animate(0); }\`）。
 * 于是建几何时 \`clock.now\` **恒为 0**（\`app/clock.js\` 的初值也是 0）——
 * 写死 0 与原实现**同一个数**，不是近似。
 * 点击时的那处 \`clock.now\` 则走 \`s.now\`（\`update\` 第一行存的上一帧 \`time\`），与
 * \`floor2/witchHat.js\` / \`floor2/rubik.js\` 同一处置。
 */
import * as THREE from 'three'
import { defineProp } from '../../app/defineProp.js'

/** 原 \`updateHourglass(time)\`，逐字搬运（\`hourState\` → 形参 \`s\`；\`hourSand\` 以原名别住 \`s.sand\`） */
${HG_UPDATE}

export default defineProp({
  id: 'floor2/desk-hourglass',
  kind: 'decor',

  /**
   * 原 \`const hourState = { phase: 'flow', t0: clock.now }\` + \`const hourSand = { up: 1.0, dn: 0.05 }\`，
   * 外加 \`now\`（替"点击时的 \`clock.now\`"，见文件头）。\`t0: 0\` = 建几何时的 \`clock.now\`。
   */
  state: () => ({ phase: 'flow', t0: 0, now: 0, sand: { up: 1.0, dn: 0.05 } }),

  build({ scene, L, LITMAT }) {
    const { DESK_HG_X, DESK_HG_Z, TBL_TOP } = L

${HG_GEOM}

    return { root: hourG, parts: { body: hourG, up: sandUp, dn: sandDn, stream: sandStream } }
  },

  /** 原 \`regMagic(hourG, …)\` 的替身（\`label\` 语义化 + \`mode: 'both'\`，消解风险 \`R1\`） */
  interactables: (s, { L }) => [{
    id: 'desk-hourglass/flip',
    label: '把桌上的沙漏翻过来',
    mode: 'both',
    // 锚点与几何同源：沙漏就在 \`DESK_HG_X / DESK_HG_Z\`（不变量 N9）
    anchor: { x: L.DESK_HG_X, z: L.DESK_HG_Z },
    radius: 1.4,
    onActivate: () => {
      if (s.phase !== 'idle') return;
      s.phase = 'flip';
      s.t0 = s.now;   // 原 \`clock.now\` —— 与上一帧的 \`time\` 恒等，见文件头
    },
  }],

  /** 原 \`tickOnce()\` 里那行 \`updateHourglass(time);\`，逐字搬运 */
  update(dt, time, s, env) {
    s.now = time;
    updateHourglass(s, time, env);
  },
})
`)

/* ═══════════════ 7. floor2/calendar ═══════════════ */
const CAL_HEAD = R_CAL.seg('const calG = new THREE.Group();', 'regMagic(calG, () => {', [
  ["calG.position.set(2.62, TBL_TOP, -2.34);", "calG.position.set(CAL_X, TBL_TOP, CAL_Z);"],
  DL("    const calState = { month: 1, phase: 'idle', animT: 0, animDur: 0.75, animPage: null };"),
])
const CAL_ZFOR = R_CAL.seg('// 根据当前旋转角计算页面沿杆的 z 偏移：', 'function updateCal(dt) {', [
  ["function calZFor(pg, rot) {", "function calZFor(pg, rot, smooth) {"],
])
const CAL_UPDATE = R_CAL.seg('function updateCal(dt) {', null, [
  ["function updateCal(dt) {", "function updateCal(s, dt, env) {"],
  ["    if (calState.phase === 'idle') return;",
    `    const { parts, smooth } = env;
    const calPages = parts.pages;
    const calState = s;   /* 原名别名：下面函数体逐字未改 */
    if (calState.phase === 'idle') return;`],
  ["calZFor(pg, rot)", "calZFor(pg, rot, smooth)", "all"],
])

put('calendar.js', `/**
 * 18.4 桌面玩具：台历（点击 → 翻过当月那一页，翻满 12 页后整体翻回 1 月） —— \`J3\` 搬迁（B5）
 *
 * 来源：\`legacy/monolith.js\` 原 \`18.4\` 分区里 \`/* —— 台历（…）—— *\\/\` 那一小节
 * （${R_CAL.lines1[0]}–${R_CAL.lines1[1]} 行区间内：底座 + 前倾背板 + 转轴 + 12 页月历 canvas + \`regMagic\` +
 * \`calZFor\` + \`updateCal\`），以及 \`tickOnce()\` 里那一行 \`updateCal(dt);\`。
 *
 * ## 搬迁对照
 *
 * | 原来住哪 | 现在住哪 |
 * |---|---|
 * | 行内 \`2.62\` / \`-2.34\` | \`world/layout.js\` 的 \`CAL_X\` / \`CAL_Z\`（不变量 \`N9\`） |
 * | 顶层 \`const calState = { month, phase, animT, animDur, animPage }\` | \`state()\`（字段名不变） |
 * | \`calPages\` | \`build()\` 经 \`parts.pages\` 交出（**同一个数组实例**） |
 * | \`calZFor(pg, rot)\` | 模块作用域同名函数（多一个显式参数 \`smooth\`，函数体逐字未改） |
 * | \`regMagic(calG, …)\` | \`interactables()\`（\`label\` 语义化 + \`mode: 'both'\`） |
 * | \`tickOnce()\` 的 \`updateCal(dt);\` | \`update()\`（**原地 tick**，参数顺序 \`(dt, time)\`） |
 *
 * ## ★ \`updateCal\` 的形参知会
 *
 * 原名是 \`updateCal(dt)\`（**只有一个参数，就是 dt**），搬迁后是 \`updateCal(s, dt, env)\`；
 * 而 \`defineProp\` 的 \`update(dt, time, s, ctx)\` 第一个参数才是 \`dt\` ——
 * 所以 \`update\` 体里写的是 \`updateCal(s, dt, env)\`，\`dt\` 从第二位进（原 \`tickOnce()\` 的
 * 调用行也是 \`updateCal(dt);\`）⇒ 语义完全一致。
 *
 * ## rng
 *
 * 本件**完全不消耗随机源**（月历页的画布是纯函数式绘制）⇒ \`rng\` 调用序列一个字节没变。
 *
 * ## ctx 键
 *
 * \`scene\` / \`L(CAL_X, CAL_Z, TBL_TOP)\` / \`MAT\` / \`smooth\`（**只在 \`update\` 里解构** ——
 * \`smooth\` 在原 monolith 里住在 18.8 段，\`build\` 期间还在 TDZ）。
 */
import * as THREE from 'three'
import { defineProp } from '../../app/defineProp.js'

/** 原 \`calZFor(pg, rot)\`，逐字搬运（\`smooth\` 改为显式参数） */
${CAL_ZFOR}

/** 原 \`updateCal(dt)\`，逐字搬运（\`calState\` 以原名别住形参 \`s\`；\`calPages\` 从 \`parts\` 取） */
${CAL_UPDATE}

export default defineProp({
  id: 'floor2/calendar',
  kind: 'decor',

  /** 原 \`const calState = { month: 1, phase: 'idle', animT: 0, animDur: 0.75, animPage: null }\` */
  state: () => ({ month: 1, phase: 'idle', animT: 0, animDur: 0.75, animPage: null }),

  build({ scene, L, MAT }) {
    const { CAL_X, CAL_Z, TBL_TOP } = L

${CAL_HEAD}

    return { root: calG, parts: { body: calG, pages: calPages } }
  },

  /** 原 \`regMagic(calG, …)\` 的替身（\`label\` 语义化 + \`mode: 'both'\`，消解风险 \`R1\`） */
  interactables: (s, { L, parts }) => [{
    id: 'calendar/flip-page',
    label: '翻一页桌上的台历',
    mode: 'both',
    // 锚点与几何同源：台历就在 \`CAL_X / CAL_Z\`（不变量 N9）
    anchor: { x: L.CAL_X, z: L.CAL_Z },
    radius: 1.5,
    onActivate: () => {
      if (s.phase !== 'idle') return;
      if (s.month <= 12) {
        s.phase = 'flipping';
        s.animPage = parts.pages[s.month - 1];
        s.animT = 0;
        s.animDur = 0.75;
      } else {
        s.phase = 'returning';
        s.animT = 0;
        s.animDur = 0.9;
      }
    },
  }],

  /** 原 \`tickOnce()\` 里那行 \`updateCal(dt);\`，逐字搬运 */
  update(dt, time, s, env) {
    updateCal(s, dt, env);
  },
})
`)

/* ═══════════════ 8. floor2/picture ═══════════════ */
const PIC_BODY = R_PIC.seg('const picG = new THREE.Group();', null, [
  ["picG.position.set(1.45, FY + 1.55, 3.82);", "picG.position.set(PIC_POS.x, FY + PIC_POS.y, PIC_POS.z);"],
  ["    const picState = { url: '', img: null, lastT: 0 };",
    "    const picState = state;   // 原顶层 `const picState = { url: '', img: null, lastT: 0 };` → state（**同一个对象实例**，下面函数体一字未改）"],
  ["regMagic(picG, openPicEditor);", "// 原 `regMagic(picG, openPicEditor);` → `interactables()`（label 语义化 + mode both）"],
])

put('picture.js', `/**
 * 18.13 前墙挂画（镜子旁；点击编辑图片链接，支持 gif 动图） —— \`J3\` 搬迁（B5）
 *
 * 来源：\`legacy/monolith.js\` 原 \`18.13\` 分区（${R_PIC.lines1[0]}–${R_PIC.lines1[1]} 行区间内：木框 + 画布 + \`picState\` +
 * \`drawPicBlank\` / \`drawPicImage\` / \`PIC_SOURCES\` / \`tryLoadPic\` / \`setPicture\` /
 * \`openPicEditor\` / \`applyPic\` + 两个 DOM 监听 + \`regMagic\`），以及 \`updateNewDecor()\` 里
 * **那 4 行 GIF 重绘**（\`if (picState.img && time - picState.lastT > 0.1) { … }\`）。
 *
 * ## ★ 本轮为什么可以搬了（上一轮 B4 判为 SKIP）
 *
 * 上一轮的判断（见 \`floor2-picture.SKIP.md\`）是：\`picState\` 与 \`drawPicImage\` 在区间**外**
 * 被 \`updateNewDecor()\` 读了 4 行，而"应用器只做整段替换、摘不掉区间外的这 4 行"，
 * 一旦删了几何段就会 \`ReferenceError\` ⇒ 装饰循环整条停摆。
 *
 * **本轮的差别只有一个：应用器现在支持 \`spec.tick\`（逐字替换任意一处唯一原文）** ——
 * 正是 \`floor2/mirror\`（\`updateNewDecor\` 里 8 行）与 \`floor2/junkBoxes\`（6 行）用过的同一机制。
 * 于是"人工去改区间外那 4 行"这一步被 spec 声明下来、由应用器代劳，
 * **GIF 动图这个功能完整保住**（上一轮的备选方案"只搬几何、把那 4 行删掉"等于静默废掉它，
 * 那份 SKIP 已明确拒绝）。
 *
 * ## 搬迁对照
 *
 * | 原来住哪 | 现在住哪 |
 * |---|---|
 * | 行内 \`(1.45, FY + 1.55, 3.82)\` | \`world/layout.js\` 的 \`PIC_POS\`（**沿用 SKIP.md §4 的配方**，不变量 \`N9\`） |
 * | 顶层 \`const picState = { url, img, lastT }\` | \`state()\`（\`build\` 里以原名 \`picState\` 别住，绘制/加载函数一字未改） |
 * | \`regMagic(picG, openPicEditor)\` | \`interactables()\`（\`label\` 语义化 + \`mode: 'both'\`） |
 * | \`updateNewDecor()\` 的 4 行 GIF 重绘 | \`update()\`（**原地 tick**，参数顺序 \`(dt, time)\`） |
 *
 * \`drawPicBlank / drawPicImage / tryLoadPic / setPicture / openPicEditor / applyPic\` 与
 * **两个 DOM 监听**全部留在 \`build()\` 里 —— 与搬迁前**完全同一个位置、同一个时机**
 * （\`build\` 仍在 monolith 的原位置被调用）⇒ 监听注册顺序不变、\`SND.play('chim')\` 的时机不变。
 *
 * ## ★ 两行"新增胶水"（本文件唯一多出来的代码）
 *
 * \`state.drawPicImage = drawPicImage;\` / \`state.openPicEditor = openPicEditor;\` ——
 * 这两个闭包住在 \`build\` 里，而 \`update\` 与 \`interactables\` 需要它们。
 * 与 \`floor2/mirror.js\` 交出 \`state.drawMirror\` / \`state.spawnRipple\` 是同一手法。
 *
 * ## ⚠️ 知情：准星文案由 \`'交互'\` 变成 \`'编辑挂画图片链接'\`
 *
 * 这是 \`J3\` 的 DoD 要的「\`label\` 有语义」在地面上的落法，与其它已搬物件（扫帚 / 魔女帽 /
 * 纸箱…）一致；但它确实是**可见文案变化**，按"新增式改动"该机位应单独审一眼
 * （\`SKIP.md\` §4 已预先声明）。点击音效不变：原实现没有 \`userData.sfx\`，
 * \`fireMagic\` 里 \`o.userData.sfx || 'toggle'\` 落到同一个 \`'toggle'\`（\`installProp\` 补的也是它）。
 *
 * ## \`clock.now\` 不需要
 *
 * 原 \`updateNewDecor()\` 里用的是形参 \`time\`（不是 \`clock.now\`）⇒ \`update\` 直接用形参；
 * \`picState.lastT = time\` 存的仍是**动画时间**，语义与搬迁前一致。
 *
 * ## 门禁提醒
 *
 * 段内两行 \`addEventListener(\` 随几何段移出 monolith ⇒ \`scripts/verify-migration.mjs\` ④ 的
 * \`addEventListener(\` 计数会再 −2（镜子的先例已把 \`J25_DELTA\` 调过一次）；
 * \`regMagic(\` 再 −1。这两处期望值需同步（\`J3\` 期间本就在按批次更新）。
 */
import * as THREE from 'three'
import { defineProp } from '../../app/defineProp.js'

export default defineProp({
  id: 'floor2/picture',
  kind: 'decor',

  /** 原顶层 \`const picState = { url: '', img: null, lastT: 0 }\`（\`build\` 里以原名别住） */
  state: () => ({ url: '', img: null, lastT: 0, drawPicImage: null, openPicEditor: null }),

  build({ scene, L, put, cbox, colEdge, iline, SND, state }) {
    const { PIC_POS, FY } = L

${PIC_BODY}

    // 交接：\`update\` 要重绘 GIF 帧；\`interactables\` 要打开编辑器（本文件唯一的"新增胶水"，两行）
    state.drawPicImage = drawPicImage;
    state.openPicEditor = openPicEditor;

    return { root: picG, parts: { frame: picG, plane: picPlane } }
  },

  /** 原 \`regMagic(picG, openPicEditor)\` 的替身（\`label\` 语义化 + \`mode: 'both'\`） */
  interactables: (s, { L }) => [{
    id: 'picture/edit-link',
    label: '编辑挂画图片链接',
    mode: 'both',
    // 锚点与几何同源：画框中心就是 \`PIC_POS\`（不变量 N9）
    anchor: { x: L.PIC_POS.x, z: L.PIC_POS.z },
    radius: 1.6,
    onActivate: () => { s.openPicEditor(); },
  }],

  /** 原 \`updateNewDecor()\` 里那 4 行（GIF 帧重绘），逐字搬运 */
  update(dt, time, s) {
    if (s.img && time - s.lastT > 0.1) {
      s.drawPicImage();
      s.lastT = time;
    }
  },
})
`)

/* ══════════════════════════════════════════════════════════════════════ */
const DIR = path.join(ROOT, 'src/cabin/world/floor2')
for (const [name, text] of Object.entries(F)) {
  fs.writeFileSync(path.join(DIR, name), text, 'utf8')
  console.log(`写盘 ${name}  ${text.split('\n').length} 行`)
}
