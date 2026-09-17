/**
 * 判据共用：把准星对准一个**可能被邻居遮挡**的可点物件，然后点它
 *
 * ## 为什么需要它（`J4.49` 实测踩出来的）
 *
 * 点击射线是"对全部 `magicMeshes` 一次性求交、**取最近**"（`InteractionSystem.aimTarget`）
 * ⇒ **"把相机摆到目标正前方"并不保证命中目标**：目标前面任何可点物件都会截胡。
 * 实测：魔法书本 `[2.58, 3.921, -2.8]` 摆在二楼书桌上，从正前方 0.7m 处点下去，
 * 命中的是**台历**（`magic:calendar/flip-page`，距离 0.25）。表现只是"点了没反应"——
 * `test:visual` 的三张定格图完全看不出这件事。
 *
 * ⇒ 这里**不猜机位**：枚举候选机位、用射线探针逐个验证，返回第一个真正命中 `wantId` 的机位。
 *   探针读 `window.__cabinRayProbe(0, 0)` / `window.__cabinCameraInfo()`（都在 `?stats=1` 下暴露）。
 *
 * ## 用法
 *
 * ```js
 * const hit = await aimAt(page, parts.bookG.world, 'floor2/magic-book')
 * if (!hit) { check('对准书本', false, '所有候选机位都被别的物件挡住了'); }
 * await clickCenter(page, CX, CY)
 * ```
 */
import { sleep } from './cdp.mjs'

/**
 * 候选机位（相对目标的偏移）：**方向 × 距离 × 高度**。
 *
 * 以目标为原点，在水平面 6 个方向 + 3 个高度 + 2 个距离上取样 —— 任一方向只要能"看进"
 * 目标所在的缝隙就能命中。把"正前方近处"排在前面，因为它命中的概率最高。
 */
function candidateOffsets() {
  const out = []
  const dirs = [[0, 1], [0.55, 0.85], [-0.55, 0.85], [0.85, 0.25], [-0.85, 0.25], [0.75, -0.6], [-0.75, -0.6]]
  for (const dist of [0.5, 0.85]) {
    for (const dy of [0.12, 0.4, 0.75]) {
      for (const [ux, uz] of dirs) out.push([ux * dist, dy, uz * dist])
    }
  }
  return out
}

/** 读一次射线探针（命中列表，含每个命中属于哪个 aim 目标） */
async function probe(page) {
  const raw = await page.eval(`(() => { const f = window.__cabinRayProbe; return f ? JSON.stringify(f(0, 0)) : 'null' })()`)
  try {
    return JSON.parse(raw) || []
  } catch {
    return []
  }
}

/**
 * 找一个能真正命中 `wantId` 的机位（并把相机留在那儿）。
 *
 * @param {object} page `connect()` 返回的页面句柄
 * @param {number[]} world 目标的世界坐标 `[x, y, z]`
 * @param {string} wantId 期望命中的 aim 目标 id（如 `floor2/magic-book`）
 * @returns {Promise<{ cam: number[], hits: object[], tried: number } | null>}
 *          命中时返回生效的机位与命中列表；全部候选都被挡住时返回 `null`
 */
export async function aimAt(page, world, wantId) {
  const [x, y, z] = world
  const samples = []
  for (const [ox, oy, oz] of candidateOffsets()) {
    const cam = [x + ox, y + oy, z + oz, x, y, z]
    await page.eval(`window.__cabinSetTestCamera(${JSON.stringify(cam)})`)
    await page.eval(`window.__cabinAdvance(2, 1 / 60)`)
    const hits = await probe(page)
    // 记下**这个机位命中了谁** —— 全部失败时这份清单就是"谁挡在前面"的直接证据
    const aims = [...new Set(hits.map((h) => h.aim || '(在 magicMeshes 里但解析不出目标)'))]
    samples.push(aims.join(' / ') || '(射线无命中)')
    if (hits.some((h) => String(h.aim || '').includes(wantId))) {
      return { cam, hits, tried: samples.length, samples }
    }
  }
  return { failed: true, tried: samples.length, samples }
}

/** 在视口中心发一次真实点击（`mousePressed` + `mouseReleased`，走 CDP 输入通路） */
export async function clickCenter(page, cx, cy) {
  for (const type of ['mousePressed', 'mouseReleased']) {
    await page.send('Input.dispatchMouseEvent', {
      type, x: cx, y: cy, button: 'left', clickCount: 1, buttons: type === 'mousePressed' ? 1 : 0,
    })
  }
  await sleep(30)
}

/** 对准 + 点击一步到位；返回 `{ failed: true, samples }` 时**点击没有发生**（并附逐机位命中详情） */
export async function aimAndClick(page, world, wantId, cx, cy) {
  const aim = await aimAt(page, world, wantId)
  if (aim.failed) return aim
  await clickCenter(page, cx, cy)
  return aim
}
