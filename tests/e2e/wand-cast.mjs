/**
 * `J4.48` 判据 —— 「点了魔杖之后，五段状态机真的走完了」
 *
 * ## 为什么必须有这个脚本
 *
 * `J4.20` 得出的结论是：**"能点开" ≠ "点开后行为正确"**。而这两件事之间，
 * 本项目此前只有 `cart-shelf` 一件补了运行期判据（`test:cart`，用"画面有没有变"回答"活没活"）。
 *
 * 魔杖的运行期行为**一条判据都没有**，只有两条弱保证：
 *   · `j3-probe` 证明「`wand/cast` 这个 aim 入口存在」；
 *   · "同构先例"证明「别的物件搬完也正常」。
 *
 * 于是「五段状态机是否真的依次推进」「造物是否被**清理**干净」「魔杖是否**归位**」
 * 全靠人工看画面 —— 而这三件事里任何一件坏掉，**画面回归都看不见**
 * （三个机位是没人去点的定格帧）。
 *
 * ## 判据（只断言**确定性事实**，绝不断言随机结果）
 *
 * 对准魔杖发一次真实 `pointerdown`+`pointerup` ⇒ 逐帧推 **330 帧**（一个完整循环 = 5.0s = 300 帧，
 * 常量见 `wand.js` 的 `FLY/GROW/HOLD/FADE/RET`）⇒ 断言：
 *
 * 1. **阶段序列**：`fly → cast → fade → return → idle` 按序出现（去重后按序匹配）；
 * 2. **造物清理**：`s.circleHolder` / `s.crea` **出现过**（非 null）且最终**回到 null**；
 * 3. **归位**：末帧 `wandG` 的位置 ≈ `parts.WAND_REST`、四元数 ≈ 单位四元数；
 * 4. 全程无未捕获页面异常。
 *
 * ★ **不断言"抽到哪个元素"或"造物长什么样"** —— `wand.js` 有 **9 处 `runtimeRng()`**，
 *   施法时抽元素（`s.idx = Math.floor(runtimeRng() * ELEMENTS.length)`）本来就是随机的。
 *   判据只问"**走完了、清理了、归位了**"。
 *
 * ## 用法
 *
 * ```
 * node tests/e2e/wand-cast.mjs                       # 需要先 pnpm build + pnpm serve
 * node tests/e2e/wand-cast.mjs --url=http://127.0.0.1:5173
 * ```
 *
 * 实测：① 未改动代码 ⇒ 绿（330 帧，约 40s）；② 把状态机任一段的推进条件改坏 ⇒ **红**。
 */
import path from 'node:path'
import { findBrowser, launch, connect } from './cdp.mjs'
import { resolveHomePath } from './page.mjs'

const ROOT = path.resolve(import.meta.dirname, '../..')

const OPTS = { url: 'http://127.0.0.1:4321' }
for (const a of process.argv.slice(2)) {
  if (a.startsWith('--url=')) OPTS.url = a.slice('--url='.length)
}
const BASE = OPTS.url.replace(/\/$/, '')

/** 一个完整循环 5.0s（`FLY 0.8 + (GROW 0.5 + HOLD 2.3) + FADE 0.6 + RET 0.8`），manual 步长固定 1/60 ⇒ 300 帧；留 10% 余量 */
const FRAMES = 330
/** 归位容差：`return` 结束时是 `copy(WAND_REST)` / `copy(IDENTITY_Q)`，属**精确赋值** ⇒ 容差只需覆盖浮点往返 */
const EPS = 1e-3

let pass = 0
let fail = 0
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? '  →  ' + detail : ''}`)
  ok ? pass++ : fail++
}

console.log('')
console.log('  J4.48 · 魔杖运行期判据（五段状态机 / 造物清理 / 归位）')
console.log('  ──────────────────────────────────────────')
console.log(`  服务      ${BASE}`)
console.log(`  采样      逐帧 ${FRAMES} 帧（一个完整循环 300 帧）`)
console.log('  断言      确定性事实（**不**断言抽到哪个元素）')
console.log('  ──────────────────────────────────────────')

const browser = findBrowser()
if (!browser) {
  console.error('✗ 未找到 Chrome / Edge（可用 CABIN_BROWSER 指定路径）')
  process.exit(1)
}
const HOME = await resolveHomePath(BASE, {
  onError: (why) => console.error(`✗ 无法访问 ${BASE} —— ${why}\n  请先启动服务：pnpm serve（需要先 pnpm build）\n`),
})
if (!HOME) process.exit(2)

// ★ `gpu: true`：本判据**只读状态、不比对像素**，没必要走 SwiftShader 软件渲染 ——
//   实测软件渲染下这个 3D 场景只有 ~3.5 FPS（perf 报告的实测值），推几百帧就会把一个核吃满。
//   ⚠️ 反之，凡是用**像素阈值**做判据的脚本（`test:visual` / `test:cart` / `test:mirror` /
//   `test:smoke` / `j3-probe`）**必须**留软件渲染 —— 它们的阈值是在软件渲染下标定的。
const chrome = await launch({ port: 9362, width: 900, height: 600, gpu: true })
const page = await connect(chrome.port)
await page.setViewport(900, 600)

try {
  await page.navigate(`${BASE}${HOME}?deterministic=1&frames=1&bare=1&stats=1`)
  await page.waitFor('document.documentElement.dataset.cabin === "ready"', { timeout: 120000 })

  // ── ① 钩子与物件 id ────────────────────────────────────────────────────
  const hasHook = await page.eval(`typeof window.__cabinPropState === 'function'`)
  check('物件状态钩子可读（?stats=1）', hasHook === true, hasHook ? '' : '未暴露')
  if (!hasHook) throw new Error('钩子缺失 —— 无法继续')

  const hasAdvance = await page.eval(`typeof window.__cabinAdvance === 'function'`)
  check('带时钟的逐帧推进器可读（manual 模式）', hasAdvance === true, hasAdvance ? '' : '未暴露')
  if (!hasAdvance) throw new Error('推进器缺失 —— 无法继续')

  const app = await page.eval(`(() => { const f = window.__cabinApp; return f ? f() : null })()`)
  const ids = (app && app.registry && app.registry.magicPropIds) || []
  const ID = ids.find((x) => String(x).includes('wand'))
  check('魔杖已装配（注册中心里有它的 aim 入口）', Boolean(ID), ID ? `id=${ID}` : `可用 id：${ids.slice(0, 6).join(' / ')}…`)
  if (!ID) throw new Error('找不到魔杖物件')

  const st0 = await page.eval(`window.__cabinPropState(${JSON.stringify(ID)})`)
  check(
    '初始处于静止态（phase=idle，无造物）',
    st0 && st0.state.phase === 'idle' && st0.state.circleHolder === null && st0.state.crea === null,
    st0 ? `phase=${st0.state.phase} circleHolder=${st0.state.circleHolder} crea=${st0.state.crea}` : '读不到状态',
  )
  const REST = st0.parts.WAND_REST
  check('能读到魔杖静止位姿（parts.WAND_REST）', Array.isArray(REST) && REST.length === 3, JSON.stringify(REST))
  if (!Array.isArray(REST)) throw new Error('读不到 WAND_REST')

  // ── ② 机位对准魔杖（从 parts 读坐标，不硬编码世界坐标） ────────────────
  const cam = [REST[0], REST[1] + 0.06, REST[2] + 1.10, REST[0], REST[1], REST[2]]
  const applied = await page.eval(`JSON.stringify(window.__cabinSetTestCamera(${JSON.stringify(cam)}))`)
  check('测试机位已对准魔杖', Boolean(applied) && applied !== 'null', String(applied))
  await page.eval(`window.__cabinAdvance(5, 1 / 60)`)
  check('预热 5 帧完成（让 `s.now` 有上一帧的时间基准）', true)

  // ── ③ 真实点击（CDP 输入事件，落在**视口中心** = 准星） ──────────────────
  //   ⚠️ 不要用 `canvas.getBoundingClientRect()` 推点击点：`bare=1` 下 canvas 的 CSS 高度
  //      实测远大于视口（`r.top + r.height/2` 得到 **900**，而视口只有 600）⇒ 事件落在
  //      **视口外**，点击根本到不了场景（第一版就踩了这个，判据如实报红）。
  //      而 aim 通路的射线走的是**准星**（屏幕中心），所以直接用视口中心即可。
  const geo = await page.eval(`(() => {
    const c = document.querySelector('canvas');
    const r = c ? c.getBoundingClientRect() : null;
    return { w: innerWidth, h: innerHeight, rect: r ? [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] : null };
  })()`)
  const cx = Math.round(geo.w / 2)
  const cy = Math.round(geo.h / 2)
  for (const type of ['mousePressed', 'mouseReleased']) {
    await page.send('Input.dispatchMouseEvent', {
      type, x: cx, y: cy, button: 'left', clickCount: 1, buttons: type === 'mousePressed' ? 1 : 0,
    })
  }
  const phaseAfterClick = await page.eval(`window.__cabinPropState(${JSON.stringify(ID)}).state.phase`)
  check('点击已派发', Boolean(geo.w), `视口 ${geo.w}×${geo.h}，点击 (${cx}, ${cy})，canvas rect=${JSON.stringify(geo.rect)}`)
  check('点击**真的**触发了施法（phase 已离开 idle）', phaseAfterClick !== 'idle', `phase=${phaseAfterClick}`)

  // ── ④ 逐帧推 330 帧并采样（**一次**页面内循环，避免 330 次往返） ────────
  const t0 = Date.now()
  const sampled = await page.eval(
    `(() => {
      const out = [];
      const seen = {};
      for (let i = 0; i < ${FRAMES}; i++) {
        // ★ 必须用**带时钟**的推进器：__cabinStepFrame 就是 tickOnce()，不推进 clock
        //   （那是 J0.4「定格帧」要的语义），而本状态机由**绝对时间** e = time - s.t0 驱动
        //   ⇒ 用错推进器时 phase 会一直停在 fly（第一版实测踩过，判据如实报红）。
        window.__cabinAdvance(1, 1 / 60);
        const st = window.__cabinPropState(${JSON.stringify(ID)});
        const tri = (v) => (v === null ? 0 : v.inScene ? 2 : 1);
        for (const k of ['circleHolder', 'crea']) {
          const v = st.state[k];
          if (v && v.uuid) seen[k + ':' + v.uuid] = true;
        }
        out.push([st.state.phase, tri(st.state.circleHolder), tri(st.state.crea),
                  st.parts.wandG.pos[0], st.parts.wandG.pos[1], st.parts.wandG.pos[2],
                  st.parts.wandG.quat[0], st.parts.wandG.quat[1], st.parts.wandG.quat[2], st.parts.wandG.quat[3]]);
      }
      return { trace: out, uuids: Object.keys(seen) };
    })()`,
    { timeoutMs: 600000 },
  )
  const trace = sampled.trace
  const uuids = sampled.uuids
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
  check('采样完成', Array.isArray(trace) && trace.length === FRAMES, `${trace.length} 帧 / ${elapsed}s`)

  // ── ⑤ 阶段序列：去重后必须按序出现 fly → cast → fade → return → idle ──
  const seq = []
  for (const row of trace) if (seq[seq.length - 1] !== row[0]) seq.push(row[0])
  const ORDER = ['fly', 'cast', 'fade', 'return', 'idle']
  let k = 0
  for (const p of seq) if (p === ORDER[k]) k += 1
  check(
    '★ 五段状态机**依次**推进（fly → cast → fade → return → idle）',
    k === ORDER.length,
    `实际序列 ${seq.join(' → ')}（命中 ${k}/${ORDER.length}）`,
  )

  // ── ⑥ 造物：出现过，且最终被清理 ──────────────────────────────────────
  const sawCircle = trace.some((r) => r[1] === 2)
  const sawCrea = trace.some((r) => r[2] === 2)
  const lastRow = trace[trace.length - 1]
  check('circleHolder **真的加进了场景**（不只是状态变量被赋值）', sawCircle)
  check('crea **真的加进了场景**（不只是状态变量被赋值）', sawCrea)
  check(
    '★ 两者最终都**彻底清理**（状态置空 **且** 对象确实离开场景图）',
    lastRow[1] === 0 && lastRow[2] === 0,
    `末帧 circleHolder=${lastRow[1]} crea=${lastRow[2]}（0=已清理 / 1=状态清了但对象仍在场景里 / 2=仍在场景）`,
  )

  // ★ 回查 uuid：**不靠状态变量**，直接问场景图"这个对象还在不在"。
  //   必要性实测过：把 `scene.remove(s.crea)` 删掉、只留 `s.crea = null` 时，
  //   上面那条三态断言**照样绿** —— 因为对象一旦不再被状态引用，状态视图就看不见它了。
  check('采样到造物对象的 uuid（可回场景图复查）', uuids.length > 0, uuids.join(' / ') || '一个都没采到')
  const leaked = []
  for (const u of uuids) {
    const uuid = u.slice(u.indexOf(':') + 1)
    const still = await page.eval(`window.__cabinSceneHas(${JSON.stringify(uuid)})`)
    if (still === true) leaked.push(u)
  }
  check(
    '★ 出现过的造物对象**全部离开场景图**（按 uuid 回查）',
    leaked.length === 0,
    leaked.length ? `仍在场景里：${leaked.join(' / ')}` : `${uuids.length} 个对象已全部离开`,
  )

  // ── ⑦ 归位：位置 = WAND_REST、四元数 = 单位四元数 ─────────────────────
  const dPos = Math.max(Math.abs(lastRow[3] - REST[0]), Math.abs(lastRow[4] - REST[1]), Math.abs(lastRow[5] - REST[2]))
  const dQuat = Math.max(Math.abs(lastRow[6]), Math.abs(lastRow[7]), Math.abs(lastRow[8]), Math.abs(lastRow[9] - 1))
  check('★ 魔杖**回到静止位姿**（位置 = WAND_REST）', dPos <= EPS, `最大分量差 ${dPos.toExponential(2)}（容差 ${EPS}）`)
  check('★ 魔杖**回到静止位姿**（四元数 = 单位）', dQuat <= EPS, `最大分量差 ${dQuat.toExponential(2)}`)
  check('末帧 phase 回到 idle', lastRow[0] === 'idle', `phase=${lastRow[0]}`)

  const errs = page.errors()
  check('全程无未捕获页面异常', errs.length === 0, errs.slice(0, 2).map((e) => e.text).join(' | '))
} finally {
  await page.close().catch(() => {})
  chrome.kill()
}

console.log(`\n  结果：${fail === 0 ? '通过' : fail + ' 项失败'}\n`)
process.exit(fail === 0 ? 0 : 1)
