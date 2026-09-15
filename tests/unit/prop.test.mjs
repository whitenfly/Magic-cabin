/**
 * 单元测试 —— 物件契约与装配（`J3`）
 *
 * 运行：`node --test "tests/unit/*.test.mjs"`
 *
 * 这里测的是 `J3` 那 67 件物件搬迁时**真正会踩的坑**：
 *   · `defineProp` 的字段校验（id / build / tier / radius / 各声明必须是函数）
 *   · 装配顺序与登记动作（物件 → 挂载点 → 交互 → 光源 → 更新）
 *   · `label` 语义化与 `mode: 'both'` 的 anchor/radius（验收 `BB2` / `BB2b`）
 *   · 挂载点重复声明、物件重复装配（搬迁期最容易犯的两个错）
 *   · `update` 按**登记顺序**执行（顺序即行为）
 * 全部用真实内核件（`createRegistry` / `createUpdateScheduler` / `createMounts`），
 * 不用替身 —— 免得测过的是替身的行为。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { defineProp, PROP_TIERS } from '../../src/cabin/app/defineProp.js'
import { createMounts } from '../../src/cabin/app/mounts.js'
import { createPropInstaller } from '../../src/cabin/app/installProp.js'
import { createRegistry } from '../../src/cabin/app/Registry.js'
import { createUpdateScheduler } from '../../src/cabin/app/UpdateScheduler.js'

const build = () => ({})

/** 造一套最小的装配环境（三个内核件 + 挂载点表） */
function makeEnv(ctx = {}) {
  const registry = createRegistry()
  const scheduler = createUpdateScheduler()
  const mounts = createMounts()
  const installer = createPropInstaller({ registry, scheduler, mounts, ctx })
  return { registry, scheduler, mounts, installer }
}

/* ────────────────────────── defineProp 契约 ────────────────────────── */

test('defineProp：归一化默认值（kind / tier / 可选声明为 null）', () => {
  const p = defineProp({ id: 'floor1/x', build })
  assert.equal(p.id, 'floor1/x')
  assert.equal(p.mount, null)
  assert.equal(p.kind, 'decor')
  assert.equal(p.tier, 'always')
  assert.equal(p.radius, null)
  assert.equal(p.state, null)
  assert.equal(p.update, null)
  assert.equal(p.interactables, null)
  assert.equal(p.lights, null)
  assert.equal(p.anchor, null)
  assert.equal(p.parts, null)
})

test('defineProp：缺 id / build 一律拒绝', () => {
  assert.throws(() => defineProp({ build }), /字符串 id/)
  assert.throws(() => defineProp({ id: 'a/b' }), /需要 build 函数/)
  assert.throws(() => defineProp(null), /需要一个对象/)
})

test('defineProp：mount 必须是非空字符串（不能是空串骗过检查）', () => {
  assert.throws(() => defineProp({ id: 'a/b', build, mount: '   ' }), /mount 必须是非空字符串/)
  assert.throws(() => defineProp({ id: 'a/b', build, mount: 42 }), /mount 必须是非空字符串/)
  assert.equal(defineProp({ id: 'a/b', build, mount: 'shelf/main' }).mount, 'shelf/main')
})

test('defineProp：tier 只接受 always / near / idle', () => {
  for (const t of PROP_TIERS) assert.equal(defineProp({ id: 'a/b', build, tier: t }).tier, t)
  assert.throws(() => defineProp({ id: 'a/b', build, tier: 'fast' }), /tier 非法/)
})

test('defineProp：radius 必须是正数（0 与负数都拒绝 —— 否则近距判定永远不触发）', () => {
  assert.equal(defineProp({ id: 'a/b', build, radius: 1.8 }).radius, 1.8)
  assert.throws(() => defineProp({ id: 'a/b', build, radius: 0 }), /radius 必须是正数/)
  assert.throws(() => defineProp({ id: 'a/b', build, radius: -1 }), /radius 必须是正数/)
})

test('defineProp：声明字段必须是函数（否则拿不到最新 state）', () => {
  assert.throws(() => defineProp({ id: 'a/b', build, update: {} }), /update 必须是函数/)
  assert.throws(() => defineProp({ id: 'a/b', build, interactables: [] }), /interactables 必须是函数/)
  assert.throws(() => defineProp({ id: 'a/b', build, lights: 'yes' }), /lights 必须是函数/)
})

/* ────────────────────────── aim 通路（J3 过渡期的桥） ────────────────────────── */

/** 造一个能被 `registerMagic` 处理的假物件根 */
function fakeRoot(name = 'g') {
  const mesh = { isMesh: true, userData: {}, name: name + ':mesh' }
  const hidden = { isMesh: true, userData: { noHit: true }, name: name + ':hidden' }
  const children = [mesh, hidden]
  return {
    isObject3D: true,
    name,
    userData: {},
    children,
    traverse(fn) { fn(this); for (const c of children) fn(c) },
    __mesh: mesh,
  }
}

test('★ aim 桥：声明了交互的物件必须同时接上 magicMeshes 与 userData.onClick', () => {
  const env = makeEnv()
  const root = fakeRoot('broom')
  let fired = 0
  env.installer.install(defineProp({
    id: 'floor1/broom',
    build: () => root,
    interactables: (s) => [{
      id: 'broom/toggle', label: '让魔法扫帚飞起来', mode: 'both',
      anchor: { x: -3.3, z: 3.35 }, radius: 1.8, onActivate: () => { fired += 1 },
    }],
  }))

  // ① 命中集合：只有 isMesh 且未被 noHit 排除的会进去
  assert.equal(env.registry.magicMeshes.length, 1, '命中集合应恰好收 1 个 mesh（noHit 的被排除）')
  assert.equal(env.registry.magicMeshes[0], root.__mesh)
  assert.equal(root.__mesh.userData.magicRoot, root, 'raycast 需要靠 magicRoot 找回物件根')

  // ② 激活通路：monolith 的 fireMagic 读的就是 userData.onClick
  assert.equal(typeof root.userData.onClick, 'function')
  assert.equal(root.userData.aimLabel, '让魔法扫帚飞起来', '准星提示要语义化，不能落回"交互"')
  assert.equal(root.userData.sfx, 'toggle', '与 regMagic 的默认音效一致')
  root.userData.onClick()
  assert.equal(fired, 1, 'onClick 应当真的激活了交互')

  // ③ 近距通路：条目进了 registry，会被 InteractionSystem 认领
  assert.equal(env.registry.interactables.length, 1)
  assert.equal(env.registry.interactables[0].mode, 'both')
})

test('aim 桥：纯装饰物件不污染 magicMeshes（没有交互就不该进命中集合）', () => {
  const env = makeEnv()
  env.installer.install(defineProp({ id: 'floor1/rug', build: () => fakeRoot('rug') }))
  assert.equal(env.registry.magicMeshes.length, 0)
})

test('aim 桥：mode 只含 proximity 的物件不进 aim 命中集合', () => {
  const env = makeEnv()
  const root = fakeRoot('shelf')
  env.installer.install(defineProp({
    id: 'floor1/shelf',
    build: () => root,
    interactables: () => [{
      id: 'shelf/browse', label: '浏览书架', mode: 'proximity',
      anchor: { x: 0, z: 0 }, radius: 1.8, onActivate: () => {},
    }],
  }))
  assert.equal(env.registry.magicMeshes.length, 0, 'proximity-only 不该占 aim 命中集合')
  assert.equal(env.registry.interactables.length, 1, '但它仍应进 registry 供近距消费')
})

test('★ 近距认领：InteractionSystem 建立时必须收编 registry 里已有的条目', async () => {
  const { createInteractionSystem } = await import('../../src/cabin/systems/interaction/InteractionSystem.js')
  const env = makeEnv()
  env.installer.install(defineProp({
    id: 'floor1/shelf',
    build: () => fakeRoot('shelf'),
    interactables: () => [{
      id: 'shelf/browse', label: '浏览书架', mode: 'both',
      anchor: { x: 1.6, z: -3.35 }, radius: 2.0, onActivate: () => {},
    }],
  }))

  // 装配在前、交互系统在后 —— 与 monolith 里的真实时序一致
  const interaction = createInteractionSystem({ registry: env.registry })
  assert.equal(interaction.proximityEntries.length, 1, '装配期声明的近距条目必须被认领')
  assert.equal(interaction.proximityEntries[0].id, 'shelf/browse')

  // 认领之后，玩家走到锚点附近就能选中它
  const near = interaction.nearestTarget({ x: 1.6, z: -3.3 })
  assert.equal(near.id, 'shelf/browse')
  assert.equal(interaction.nearestTarget({ x: 20, z: 20 }), null)
})

test('近距认领：mode 只含 aim 的条目不进 proximity 列表（否则会多出一条永远不触发的近距）', async () => {
  const { createInteractionSystem } = await import('../../src/cabin/systems/interaction/InteractionSystem.js')
  const registry = createRegistry()
  registry.registerInteractable({
    id: 'mirror/ripple', label: '摸一摸镜面', mode: 'aim', anchor: null, radius: 0, onActivate: () => {},
  })
  const interaction = createInteractionSystem({ registry })
  assert.equal(interaction.proximityEntries.length, 0)
})

test('defineProp 是幂等的：归一化产物可以再传回来（便于派生 / 覆写 id）', () => {
  const p = defineProp({ id: 'a/b', build, mount: 'x/y', radius: 1.5 })
  const again = defineProp({ ...p, id: 'a/c' })
  assert.equal(again.id, 'a/c')
  assert.equal(again.mount, 'x/y')
  assert.equal(again.radius, 1.5)
  assert.equal(again.build, p.build)
})

/* ────────────────────────── 挂载点 ID 表 ────────────────────────── */

test('mounts：认领与取用；缺失时 get 返回 null、require 抛错', () => {
  const m = createMounts()
  assert.equal(m.get('shelf/main'), null)
  assert.throws(() => m.require('shelf/main', 'M01'), /M01：挂载点不存在：shelf\/main/)
  m.claim('shelf/main', { prop: 'floor1/bookshelf', anchor: { x: 1, z: 2 }, radius: 1.8 })
  assert.equal(m.has('shelf/main'), true)
  assert.equal(m.get('shelf/main').prop, 'floor1/bookshelf')
  assert.deepEqual(m.get('shelf/main').anchor, { x: 1, z: 2 })
})

test('mounts：同一挂载点被两件物件声明 ⇒ 立即报错（搬迁期最常见的错）', () => {
  const m = createMounts()
  m.claim('shelf/main', { prop: 'floor1/bookshelf' })
  assert.throws(
    () => m.claim('shelf/main', { prop: 'floor2/bookshelf2' }),
    /挂载点重复声明：shelf\/main（已由 floor1\/bookshelf 占用，又被 floor2\/bookshelf2 声明）/,
  )
})

test('mounts：stats 报告挂载点总数与带部件的数量', () => {
  const m = createMounts()
  m.claim('shelf/main', { prop: 'floor1/bookshelf', parts: { board: {} } })
  m.claim('cauldron/rim', { prop: 'floor1/cauldron', parts: {} })
  const s = m.stats()
  assert.equal(s.total, 2)
  assert.equal(s.props, 2)
  assert.equal(s.withParts, 1)
})

/* ────────────────────────── 装配器 ────────────────────────── */

test('installProp：七步装配 —— 物件 / 挂载点 / 交互 / 光源 / 更新 全部登记到位', () => {
  const env = makeEnv({ tag: 'env' })
  const installed = env.installer.install(defineProp({
    id: 'floor1/bookshelf',
    mount: 'shelf/main',
    radius: 1.8,
    anchor: () => ({ x: 1.6, z: -3.35 }),
    parts: () => ({ board: { name: 'board' } }),
    state: () => ({ open: false }),
    build: (c) => {
      // 装配环境必须原样传进来（几何工具 / layout / rng）
      assert.equal(c.tag, 'env')
      assert.deepEqual(c.state, { open: false })
      return fakeRoot('floor1/bookshelf')
    },
    interactables: (s) => [{
      id: 'shelf/browse', label: '浏览书架', mode: 'both',
      anchor: { x: 1.6, z: -3.35 }, radius: 1.8,
      onActivate: () => { s.open = true },
    }],
    lights: () => [{ id: 'shelf/glow', color: 0xffdd88, radius: 2 }],
    update: () => {},
  }))

  assert.equal(env.registry.stats().props, 1)
  assert.equal(env.registry.stats().interactables, 1)
  assert.equal(env.registry.stats().lights, 1)
  assert.equal(env.registry.stats().features, 0)
  assert.equal(env.scheduler.stats().total, 1)

  const mount = env.mounts.get('shelf/main')
  assert.equal(mount.prop, 'floor1/bookshelf')
  assert.deepEqual(mount.anchor, { x: 1.6, z: -3.35 })
  assert.equal(mount.radius, 1.8)
  assert.equal(mount.parts.board.name, 'board')

  // 光源带上来源物件（诊断用）
  assert.equal(env.registry.lights[0].prop, 'floor1/bookshelf')
  assert.equal(installed.state.open, false)
})

test('installProp：label 语义化由契约强制 —— 空 label / 缺 anchor 一律在装配期炸', () => {
  const env = makeEnv()
  assert.throws(
    () => env.installer.install(defineProp({
      id: 'floor1/bad',
      build,
      interactables: () => [{ id: 'bad/x', label: '  ', mode: 'both', anchor: { x: 0, z: 0 }, radius: 1, onActivate() {} }],
    })),
    /需要语义化 label/,
  )
  assert.throws(
    () => env.installer.install(defineProp({
      id: 'floor1/bad2',
      build,
      interactables: () => [{ id: 'bad/y', label: '按一下', mode: 'both', onActivate() {} }],
    })),
    /必须给 anchor/,
  )
})

test('installProp：物件重复装配 ⇒ 报错（两处定义了同一个物件）', () => {
  const env = makeEnv()
  const p = defineProp({ id: 'floor1/dup', build })
  env.installer.install(p)
  assert.throws(() => env.installer.install(p), /物件重复装配：floor1\/dup/)
  // 换一份声明、同一个 id 也必须炸（搬迁期"搬了但忘了删原段"就是这个症状）
  assert.throws(
    () => env.installer.install(defineProp({ id: 'floor1/dup', build })),
    /物件重复装配：floor1\/dup/,
  )
})

test('installProp：未声明 mount 的物件不写挂载点表（纯装饰不占接口）', () => {
  const env = makeEnv()
  env.installer.install(defineProp({ id: 'floor1/rug', build }))
  assert.equal(env.mounts.stats().total, 0)
  assert.equal(env.installer.stats().withMount, 0)
})

test('installProp：没有挂载点表时只 warn，不打断装配（渐进搬迁期容忍）', () => {
  const registry = createRegistry()
  const scheduler = createUpdateScheduler()
  const warns = []
  const installer = createPropInstaller({ registry, scheduler, warn: (m) => warns.push(m) })
  installer.install(defineProp({ id: 'floor1/x', mount: 'shelf/main', build }))
  assert.equal(warns.length, 1)
  assert.match(warns[0], /没有挂载点表/)
})

test('同屏多物件的 update 严格按**登记顺序**执行（顺序即行为）', () => {
  const env = makeEnv()
  const order = []
  for (const name of ['a', 'b', 'c']) {
    env.installer.install(defineProp({
      id: `floor1/${name}`,
      build,
      update: () => order.push(name),
    }))
  }
  env.scheduler.update(0.016, 1)
  assert.deepEqual(order, ['a', 'b', 'c'])
  assert.equal(env.scheduler.lastRun, 3)
})

test('installProp：state 是每次装配的独立闭包（同一份声明装配两次不同 id 互不干扰）', () => {
  const env = makeEnv()
  const spec = () => defineProp({
    id: 'floor1/x',
    build,
    state: () => ({ n: 0 }),
    update: (dt, time, s) => { s.n += 1 },
  })
  env.installer.install(spec())
  const second = defineProp({ ...spec(), id: 'floor1/y' })
  env.installer.install(second)
  env.scheduler.update(0.016, 1)
  env.scheduler.update(0.016, 2)
  assert.equal(env.installer.get('floor1/x').state.n, 2)
  assert.equal(env.installer.get('floor1/y').state.n, 2)
  assert.notEqual(env.installer.get('floor1/x').state, env.installer.get('floor1/y').state)
})
