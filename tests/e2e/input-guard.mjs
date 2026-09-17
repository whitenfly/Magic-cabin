/**
 * `J4.51` 判据 —— 「正在输入框里打字时，游戏快捷键真的被吞掉」（R4b）
 *
 * ## 为什么必须有它
 *
 * `J4.42` §2.4 裁决 `board` 编辑器归属时留下了一处**跨层豁免**（`ctx.noteInput`）：
 * `Input.js` 与 `PlayerController.js` 各自**逐个列举**"哪些输入框算正在输入"
 * （`signInput` / `noteInput` / `picInput`）。`J4.51` 把它换成**统一判据**
 * （`document.activeElement` 是 INPUT/TEXTAREA 就吞按键），并删掉那处豁免。
 *
 * ⚠️ **这会改变行为** —— 而"行为变了"必须有判据看着，否则改错了没人知道：
 *
 * | | 原来（列举式） | 现在（统一判据） |
 * |---|---|---|
 * | 那 3 个文本框 | 吞按键 | 吞按键（不变） |
 * | ★ **任何其它输入框**（含设置面板的 `<input type="range">` 滑块） | **不吞** | **吞** ← 行为变更 |
 *
 * 滑块那条尤其要留意：它拖完**不会 blur**（`SettingsForm.js` 只把 `dragging` 清掉），
 * ⇒ 拖过一次音量 / 时间流速滑块后，若不去点别处，**键盘就走不动路了**。
 * 本判据把这件事**写成断言**，让它成为"有意的行为变更"，而不是悄悄发生的事故。
 *
 * ## 判据
 *
 * 每个场景：把焦点放到指定元素 → **先断言焦点真的到位** → 按一次 `KeyW` + 推 40 帧 → 读**玩家位移**。
 *
 * | 场景 | 期望 |
 * |---|---|
 * | 不聚焦任何元素 | 玩家**明显移动**（否则"吞按键"没有对照组） |
 * | 聚焦 `#signInput`（原行为） | 玩家**不动** |
 * | ★ 聚焦**临时造出来的** input | 玩家**不动** ← 统一判据的目标行为；它**不在**原列举名单里 |
 *
 * ## 两个踩过的坑（都写进了代码注释）
 *
 * 1. **隐藏元素无法获得焦点**：`#signInput` 在默认隐藏的弹出容器里，直接 `focus()` 会**静默失败**
 *    （`activeElement` 仍是 `BODY`）⇒ 第一版判据测的其实是"没聚焦"，两个场景都假红。
 *    现在先让容器可见，**并断言焦点真的到位**。
 * 2. **相机不能代替玩家位置**：`viewMode === 'fixed'` 下相机固定在屋外，玩家走动时它一动不动。
 *    ⇒ 读 `window.__cabinPlayer()`。
 *
 * 用法：`node tests/e2e/input-guard.mjs`（需要先 `pnpm build` + `pnpm serve`）
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

/** 每步推多少帧：0.67s。玩家速度 1.6 m/s、加速时间常数 0.1s ⇒ 正常应移动约 0.9m（实测 0.70m） */
const FRAMES = 40
/** "动了"的门槛（远大于碰撞/落定的微动） */
const MOVED = 0.3
/** "没动"的门槛 */
const STILL = 0.02
/** 判据自己造的那个 input 的 id */
const PROBE_ID = '__guardProbe'

let pass = 0
let fail = 0
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? '  →  ' + detail : ''}`)
  ok ? pass++ : fail++
}

console.log('')
console.log('  J4.51 · 输入焦点判据（正在输入时，快捷键该被吞掉）')
console.log('  ──────────────────────────────────────────')
console.log(`  服务      ${BASE}`)
console.log('  断言      玩家位移（**不**看相机：fixed 模式下相机不随玩家动）')
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

// ★ `gpu: true`：本判据只读状态、不比对像素，没必要走 SwiftShader 软件渲染。
const chrome = await launch({ port: 9365, width: 900, height: 600, gpu: true })
const page = await connect(chrome.port)
await page.setViewport(900, 600)

/**
 * 聚焦 `id` 指定的元素并**返回实测焦点**（`id` 为空则主动 blur）。
 *
 * ⚠️ 隐藏元素**无法获得焦点** ⇒ 这里先把 `#signEditor` 这类弹出容器的 `show` 打开；
 *    返回值用于断言"焦点真的到位了"，避免判据测了个空。
 */
const focusOn = (id) =>
  page.eval(`(() => {
    const el = ${id ? `document.getElementById(${JSON.stringify(id)})` : 'null'};
    if (el) {
      const ed = document.getElementById('signEditor');
      if (ed && !ed.classList.contains('show')) ed.classList.add('show');
      el.focus();
    } else if (document.activeElement && document.activeElement.blur) {
      document.activeElement.blur();
    }
    const ae = document.activeElement;
    return ae ? (ae.id || ae.tagName) : '(无)';
  })()`)

/** 造一个**可见**的测试用 input（挂在 body 上、固定定位）—— 它不在原"列举名单"里 */
const makeProbeInput = (type = 'text') => {
  const id = `${PROBE_ID}-${type}`
  return page.eval(`(() => {
    let el = document.getElementById(${JSON.stringify(id)});
    if (!el) {
      el = document.createElement('input');
      el.id = ${JSON.stringify(id)};
      el.type = ${JSON.stringify(type)};
      el.style.cssText = 'position:fixed;left:8px;top:8px;width:90px;height:20px;z-index:9999';
      document.body.appendChild(el);
    }
    return { id: el.id, type: el.type, visible: !!(el.offsetWidth || el.offsetHeight) };
  })()`)
}

const readPlayer = () => page.eval('window.__cabinPlayer()')

/** 按一次 W 并推帧（按下 → 推 40 帧 → 抬起，模拟"按住走一段"） */
async function tapW() {
  const k = { code: 'KeyW', key: 'w', windowsVirtualKeyCode: 87, nativeVirtualKeyCode: 87 }
  await page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...k })
  await page.eval(`window.__cabinAdvance(${FRAMES}, 1 / 60)`)
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...k })
}

/** 一次实验：聚焦 → 按 W → 返回位移与实测焦点 */
async function moveTest(focusId) {
  const active = await focusOn(focusId)
  const before = await readPlayer()
  await tapW()
  const after = await readPlayer()
  const d = Math.hypot(after.pos[0] - before.pos[0], after.pos[2] - before.pos[2])
  return { d, active, before, after }
}

try {
  await page.navigate(`${BASE}${HOME}?deterministic=1&frames=1&bare=1&stats=1`)
  await page.waitFor('document.documentElement.dataset.cabin === "ready"', { timeout: 120000 })

  const hasHook = await page.eval(`typeof window.__cabinPlayer === 'function' && typeof window.__cabinAdvance === 'function'`)
  check('测试钩子可读（?stats=1 + manual）', hasHook === true, hasHook ? '' : '未暴露')
  if (!hasHook) throw new Error('钩子缺失 —— 无法继续')

  const p0 = await readPlayer()
  check('玩家状态可读', Boolean(p0 && p0.pos), p0 ? `pos=${JSON.stringify(p0.pos)} viewMode=${p0.viewMode}` : '读不到')

  const textProbe = await makeProbeInput('text')
  const rangeProbe = await makeProbeInput('range')
  check(
    '判据自造的两个测试 input 都可见',
    textProbe.visible === true && rangeProbe.visible === true,
    `${textProbe.id}(visible=${textProbe.visible}) · ${rangeProbe.id}(visible=${rangeProbe.visible})`,
  )
  const sliderId = await page.eval(`(() => {
    const i = document.querySelector('input[type=range]');
    return i ? (i.id || '(无 id 的 range)') : null;
  })()`)
  console.log(`      （信息）页面里第一个 range 滑块：${sliderId || '未找到'}`)

  /* ───────── ① 对照组：不聚焦 ⇒ 玩家必须**能走** ───────── */
  console.log('\n  ── 对照组：不聚焦 ────────────────────────')
  const a = await moveTest(null)
  check('前提：焦点已清空', a.active === 'BODY' || a.active === '(无)', `焦点=${a.active}`)
  check(
    '★ 不聚焦时按 W ⇒ 玩家**明显移动**（对照组成立）',
    a.d > MOVED,
    `位移 ${a.d.toFixed(3)}m（门槛 > ${MOVED}）`,
  )

  /* ───────── ② 自造的 text input（覆盖"文本框类"） ───────── */
  console.log('\n  ── 自造 text input ──────────────────────')
  const b = await moveTest(textProbe.id)
  check('前提：焦点已在自造 text input 上', b.active === textProbe.id, `焦点=${b.active}`)
  check(
    '聚焦 text input 时按 W ⇒ 玩家**不动**',
    b.d < STILL,
    `位移 ${b.d.toFixed(3)}m（门槛 < ${STILL}）`,
  )

  /* ───────── ③ ★ 自造的 range input（= 设置面板滑块的同类） ───────── */
  console.log('\n  ── ★ 自造 range input（本次行为变更点） ──')
  const c = await moveTest(rangeProbe.id)
  check('前提：焦点已在自造 range input 上', c.active === rangeProbe.id, `焦点=${c.active}`)
  check(
    '★ 聚焦 range input 时按 W ⇒ 玩家**不动**（统一判据生效）',
    c.d < STILL,
    `位移 ${c.d.toFixed(3)}m（门槛 < ${STILL}）`,
  )

  const errs = page.errors()
  check('全程无未捕获页面异常', errs.length === 0, errs.slice(0, 2).map((e) => e.text).join(' | '))
} finally {
  await page.close().catch(() => {})
  chrome.kill()
}

console.log(`\n  结果：${fail === 0 ? '通过' : fail + ' 项失败'}\n`)
process.exit(fail === 0 ? 0 : 1)
