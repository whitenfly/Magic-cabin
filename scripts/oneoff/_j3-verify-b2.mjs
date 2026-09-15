/**
 * 一次性自检（`J3` / B2）：四件物件的搬运是否**逐字未改**且装配后行为等价
 *
 * 覆盖：`floor1/hourglass`（沙漏）、`floor1/chest`（小宝箱）、`floor1/stools`（三脚圆凳）、
 *      `floor2/nightstand`（床头柜 + 抽屉）。
 *
 * 判据（全部不依赖浏览器，`node scripts/oneoff/_j3-verify-b2.mjs`，只读不写盘）：
 *   ① 装配判据：`createPropInstaller().install()` 不抛；id / kind / 交互条数 / update 任务正确
 *   ② 几何判据：桩 ctx 记录到的 `put` 调用（位置 / 旋转 / 父节点）与原实现逐项相同
 *   ③ 行为判据：点交互（`onActivate`）后连跑 `tick`，状态与变换按原公式演进
 *      —— 证明"每帧分支搬进 `update` 后仍由原地 tick 驱动"这条通路是活的
 *   ④ 标签判据：每条 `Interactable` 的 `label` 有语义（不是"交互"）、`mode` 含 both、锚点在半径内
 */
import * as THREE from 'three'
import { createLayout } from '../../src/cabin/world/layout.js'
import { createRegistry } from '../../src/cabin/app/Registry.js'
import { createUpdateScheduler } from '../../src/cabin/app/UpdateScheduler.js'
import { createPropInstaller } from '../../src/cabin/app/installProp.js'
import hourglass from '../../src/cabin/world/floor1/hourglass.js'
import chest from '../../src/cabin/world/floor1/chest.js'
import stools from '../../src/cabin/world/floor1/stools.js'
import nightstand from '../../src/cabin/world/floor2/nightstand.js'

const L = createLayout()
const fail = []
const ok = (cond, label) => { console.log(`${cond ? '  ✓' : '  ✗'} ${label}`); if (!cond) fail.push(label) }
const near = (a, b) => Math.abs(a - b) < 1e-12
const v3 = (o) => [o.position.x, o.position.y, o.position.z]

/** 造一个记录几何调用的桩 ctx（真实 three 对象 —— 父子关系、变换都能被检查） */
function makeCtx() {
  const scene = new THREE.Group()
  const calls = { put: [], box: 0, line: 0, edge: 0, lloop: 0, logBetween: 0, regSlide: [] }
  const MATS = new THREE.LineBasicMaterial()
  const geo = (pts) => new THREE.BufferGeometry().setFromPoints((pts || []).map((p) => new THREE.Vector3(p[0], p[1] || 0, p[2] || 0)))
  const line = (pts) => { calls.line++; return new THREE.Line(geo(pts), MATS) }
  const edge = (g) => { calls.edge++; const grp = new THREE.Group(); grp.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial())); return grp }
  const box = (w, h, d) => { calls.box++; return edge(new THREE.BoxGeometry(w, h, d)) }
  const lloop = (pts, parent) => { calls.lloop++; const l = new THREE.LineLoop(geo(pts), MATS); (parent || scene).add(l); return l }
  const logBetween = (a, b, r, parent) => { calls.logBetween++; const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 8)); (parent || scene).add(m); return m }
  const put = (o, x, y, z, rx, ry, rz, parent) => {
    o.position.set(x, y, z)
    if (rx) o.rotation.x = rx
    if (ry) o.rotation.y = ry
    if (rz) o.rotation.z = rz
    ;(parent || scene).add(o)
    calls.put.push({ o, pos: [x, y, z], rot: [rx || 0, ry || 0, rz || 0], parent: parent || scene })
    return o
  }
  // 与 core/util/spring.js 的 regSlide 同构（L 里的物件拿不到真弹簧系统，故此处复刻其语义）
  const regSlide = (g, axis, dist) => {
    const slide = { cur: 0, vel: 0, open: false, base: g.position[axis], axis, dist }
    g.userData.slide = slide
    calls.regSlide.push({ g, axis, dist, base: slide.base })
    return g
  }
  return { ctx: { scene, L, put, box, line, edge, lloop, geo, logBetween, regSlide, MAT: MATS, FILL: new THREE.MeshBasicMaterial() }, scene, calls }
}

function makeEnv() {
  const registry = createRegistry()
  const scheduler = createUpdateScheduler()
  return { registry, scheduler, installer: createPropInstaller({ registry, scheduler, mounts: null }) }
}

const labelOk = (it) => typeof it.label === 'string' && it.label.trim() && it.label !== '交互' && (it.mode === 'both')

/* ══════════════════════ ① 沙漏 ══════════════════════ */
{
  console.log('\n① floor1/hourglass（沙漏）')
  const { ctx, scene, calls } = makeCtx()
  const env = makeEnv()
  let rec = null
  try { rec = env.installer.install(hourglass, { ctx }) } catch (e) { ok(false, `install 抛错：${e.message}`) }
  ok(!!rec, 'install 成功')
  ok(rec && rec.prop.id === 'floor1/hourglass' && rec.prop.kind === 'furniture', 'id / kind 正确')
  ok(rec && rec.task !== null && typeof rec.tick === 'function', '声明了 update ⇒ 拿到 tick 句柄（原地 tick 用）')
  ok(rec && rec.interactions.length === 1 && labelOk(rec.interactions[0]), `交互 1 条且 label 语义化：${rec && rec.interactions[0].label}`)
  ok(rec && rec.interactions[0].anchor.x === L.HG_POS.x && rec.interactions[0].anchor.z === L.HG_POS.z, 'anchor 与几何同源（L.HG_POS）')

  // 几何：外层 Group 的位置（原代码 `hg.position.set(SFX, 0.805 + HG_MID, -2.44)`）
  const hg = rec.root
  ok(near(hg.position.x, -3.72) && near(hg.position.y, 0.805 + 0.18) && near(hg.position.z, -2.44), `hg.position = (${v3(hg).join(', ')}) —— 与原 (SFX, 0.805+0.18, -2.44) 一致`)
  ok(hg.parent === scene, 'hg 直接挂 scene（未新增层级）')
  ok(calls.box === 2 && calls.edge === 6 && calls.lloop === 2 && calls.line === 0, `几何调用计数 box=${calls.box}（2）edge=${calls.edge}（2 个木盖 + 4 根立柱）lloop=${calls.lloop}（2 段玻璃轮廓）`)
  ok(rec.parts.inner.position.y === -0.18, 'hgInner.position.y = -HG_MID')
  ok(rec.parts.pileTop.position.y === 0.315 && rec.parts.pileBot.position.y === 0.045, '两个沙堆 Group 的位置（0.315 / 0.045）')
  ok(rec.parts.streams.length === 3 && rec.parts.streams.every((s) => s.visible === false), '3 条沙流初始不可见')

  // 行为：点一下 → 倒转 → 连跑 tick，旋转逼近 π、沙量随时间衰减
  ok(rec.state.hgFlip === false && rec.state.hgSand === 1 && rec.state.hgRun === 0, '初始状态 flip=false / sand=1 / run=0')
  rec.interactions[0].onActivate()
  ok(rec.state.hgFlip === true && rec.state.hgRun === 5 && rec.state.hgSand === 1, '激活后 flip=true / run=5 / sand=1（与原 onClick 一致）')
  ok(rec.parts.pileTop.scale.x === 1 && rec.parts.pileBot.scale.x === 1, '未跑 tick 前两个沙堆未被缩放（分支确实只在 update 里）')
  for (let i = 0; i < 120; i++) rec.tick(1 / 60, i / 60)
  ok(Math.abs(rec.state.hgRot - Math.PI) < 0.3, `120 帧后 hgRot ≈ π（实际 ${rec.state.hgRot.toFixed(3)}）`)
  ok(hg.rotation.x === rec.state.hgRot, 'hg.rotation.x 跟着 hgRot（分支真的在驱动画面）')
  ok(rec.state.hgRun < 5 && rec.state.hgSand < 1, `沙量随时间衰减（run=${rec.state.hgRun.toFixed(2)} sand=${rec.state.hgSand.toFixed(3)}）`)
  ok(rec.parts.pileTop.scale.x !== 1 || rec.parts.pileBot.scale.x !== 1, '两个沙堆按 sand 缩放（0.25+0.75·sand / 0.3+0.8·(1-sand)）')
}

/* ══════════════════════ ② 小宝箱 ══════════════════════ */
{
  console.log('\n② floor1/chest（小宝箱）')
  const { ctx, scene, calls } = makeCtx()
  const env = makeEnv()
  let rec = null
  try { rec = env.installer.install(chest, { ctx }) } catch (e) { ok(false, `install 抛错：${e.message}`) }
  ok(!!rec, 'install 成功')
  ok(rec && rec.prop.id === 'floor1/chest', 'id 正确')
  ok(rec && rec.task !== null && typeof rec.tick === 'function', '声明了 update ⇒ 拿到 tick 句柄')
  ok(rec && rec.interactions.length === 1 && labelOk(rec.interactions[0]), `交互 1 条且 label 语义化：${rec && rec.interactions[0].label}`)
  ok(rec && rec.interactions[0].anchor.x === L.CHEST_POS.x && rec.interactions[0].anchor.z === L.CHEST_POS.z, 'anchor 与几何同源（L.CHEST_POS）')

  const grp = rec.root
  ok(near(grp.position.x, -3.72) && near(grp.position.y, 0.805) && near(grp.position.z, -2.66), `chest.position = (${v3(grp).join(', ')}) —— 与原 (SFX, 0.805, -2.66) 一致`)
  ok(grp.parent === scene, 'chest 直接挂 scene')
  ok(calls.box === 2 && calls.edge === 3 && calls.line === 2, `几何调用计数 box=${calls.box}（2）edge=${calls.edge}（2 个箱体 + 1 颗绿宝石）line=${calls.line}（2 条箱箍）`)
  ok(rec.parts.lid.position.y === 0.1 && rec.parts.lid.position.z === -0.06, '箱盖挂点 (0, 0.1, -0.06)')
  ok(rec.parts.lid.parent === grp && rec.parts.gem.visible === false, '箱盖是 chest 的子节点 / 宝石初始隐藏')

  ok(rec.state.chestOpen === false && rec.state.chestP === 0 && rec.state.chestV === 0, '初始状态 closed / p=0 / v=0')
  rec.interactions[0].onActivate()
  for (let i = 0; i < 60; i++) rec.tick(1 / 60, i / 60)
  ok(rec.state.chestP > 0.9, `60 帧后 chestP → 1（实际 ${rec.state.chestP.toFixed(3)}）`)
  ok(rec.parts.lid.rotation.x === -1.25 * rec.state.chestP, '箱盖角度 = -1.25·p（与原公式一致）')
  ok(rec.parts.gem.visible === true, 'p>0.3 ⇒ 宝石可见')
  rec.interactions[0].onActivate()
  for (let i = 0; i < 60; i++) rec.tick(1 / 60, 1 + i / 60)
  ok(rec.state.chestP < 0.1, `再点一下 → 合上（p=${rec.state.chestP.toFixed(3)}）`)
}

/* ══════════════════════ ③ 三脚圆凳 ══════════════════════ */
{
  console.log('\n③ floor1/stools（三脚圆凳）')
  const { ctx, scene, calls } = makeCtx()
  const env = makeEnv()
  let rec = null
  try { rec = env.installer.install(stools, { ctx }) } catch (e) { ok(false, `install 抛错：${e.message}`) }
  ok(!!rec, 'install 成功')
  ok(rec && rec.prop.id === 'floor1/stools', 'id 正确')
  ok(rec && rec.task !== null && typeof rec.tick === 'function', '声明了 update ⇒ 拿到 tick 句柄')

  const list = rec.parts.stools
  ok(Array.isArray(list) && list.length === 2, '两只凳子都在 parts.stools 里（同一个数组实例）')
  ok(list[0].parent === scene && list[1].parent === scene, '两只凳子各自直接挂 scene（未新增包装层级）')
  ok(near(list[0].position.z, L.MTZ - 0.85) && near(list[1].position.z, L.MTZ + 0.85), `落点 z = MTZ ∓ 0.85（${list[0].position.z} / ${list[1].position.z}）`)
  ok(list.every((g) => g.userData.open === false && g.userData.cur === 0 && g.userData.vel === 0), 'userData 初始 open=false / cur=0 / vel=0')
  ok(list[0].userData.dz === -1 && list[1].userData.dz === 1, '两只凳子的滑动方向 dz = ∓1')
  ok(calls.edge === 2 && calls.logBetween === 6, `几何调用计数 edge=${calls.edge}（2 个凳面）logBetween=${calls.logBetween}（2×3 条腿）`)

  ok(rec.interactions.length === 2 && rec.interactions.every(labelOk), `每只凳子一条交互、label 都语义化：${rec.interactions.map((i) => i.label).join(' / ')}`)
  ok(rec.interactions[0].anchor.z === L.MTZ - 0.85 && rec.interactions[1].anchor.z === L.MTZ + 0.85, '两条 anchor 分别落在两只凳子上（与几何同源）')

  rec.interactions[0].onActivate()
  for (let i = 0; i < 60; i++) rec.tick(1 / 60, i / 60)
  const a = list[0], b = list[1]
  ok(a.userData.open === true && Math.abs(a.position.z - (a.userData.bz + a.userData.dz * a.userData.cur)) < 1e-12, '被点的那只按 dz 滑出去（位置 = bz + dz·cur）')
  ok(a.position.z < a.userData.bz, `靠里的凳子往 -z 滑（${a.userData.bz} → ${a.position.z.toFixed(3)}）`)
  ok(b.position.z === b.userData.bz, '另一只纹丝不动（交互是"点哪只动哪只"）')
}

/* ══════════════════════ ④ 床头柜 + 抽屉 ══════════════════════ */
{
  console.log('\n④ floor2/nightstand（床头柜 + 可拉开抽屉）')
  const { ctx, scene, calls } = makeCtx()
  const env = makeEnv()
  let rec = null
  try { rec = env.installer.install(nightstand, { ctx }) } catch (e) { ok(false, `install 抛错：${e.message}（若为 regSlide is not a function ⇒ ctx 还没补这一项，见文件头 ★）`) }
  ok(!!rec, 'install 成功')
  ok(rec && rec.prop.id === 'floor2/nightstand', 'id 正确')
  ok(rec && rec.task === null, '没有 update（抽屉由 updateSprings 的滑轨驱动，不需每帧分支）')
  ok(rec && rec.interactions.length === 1 && labelOk(rec.interactions[0]), `交互 1 条且 label 语义化：${rec && rec.interactions[0].label}`)
  ok(rec && rec.interactions[0].anchor.x === L.NSX && rec.interactions[0].anchor.z === L.NSZ, 'anchor 与几何同源（L.NSX / L.NSZ）')

  ok(calls.put.length === 9, `put 次数 = 9（四条腿 + 柜体 + 台面 + 抽屉三件；实际 ${calls.put.length}）`)
  ok(calls.edge === 9 && calls.box === 4, `几何调用计数 edge=${calls.edge}（4 条腿 + 1 个拉手 + 4 个盒体）box=${calls.box}（柜体 / 台面 / 抽屉面板 / 抽屉内胆）`)
  const bodies = calls.put.filter((c) => c.parent === scene)
  ok(bodies.length === 6, `柜体六件（四条腿 + 柜体 + 台面）直接挂 scene，另 3 件挂抽屉 Group（实际 ${bodies.length}）`)
  const drawer = rec.parts.drawer
  ok(drawer.parent === scene, '抽屉 Group 直接挂 scene（与原实现一致）')
  ok(near(drawer.position.x, L.NSX) && near(drawer.position.y, L.FY + 0.40) && near(drawer.position.z, L.NSZ + 0.20), `抽屉位置 (${v3(drawer).join(', ')}) —— 与原 (NSX, FY+0.40, NSZ+0.20) 一致`)
  ok(calls.regSlide.length === 1 && calls.regSlide[0].axis === 'z' && near(calls.regSlide[0].dist, 0.26), '登记了一条 z 向、位移 0.26 的滑轨（regSlide(drawerG, \'z\', 0.26)）')
  ok(calls.regSlide[0].base === drawer.position.z, '滑轨 base 取的是**登记时刻**的位置（故 regSlide 必须在 position.set 之后）')

  rec.interactions[0].onActivate()
  ok(drawer.userData.slide.open === true, '点一下 ⇒ slide.open = true（与原 onClick 一致）')
  rec.interactions[0].onActivate()
  ok(drawer.userData.slide.open === false, '再点一下 ⇒ 关上')
}

console.log(fail.length ? `\n✗ ${fail.length} 项不通过\n` : '\n✓ 全部通过（沙漏 / 小宝箱 / 三脚圆凳 / 床头柜）\n')
process.exit(fail.length ? 1 : 0)
