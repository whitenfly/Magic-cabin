/**
 * 单元测试 —— 相机机位（`J2.7`）
 *
 * 运行：`node --test "tests/unit/*.test.mjs"`
 *
 * 这一组守两件事：
 *
 * 1. **零差异的前提**：`update()` 必须调用**当前视角注册的那个 solver**，
 *    且 solver 只在 `update()` 里被调用（不会有人绕过它直接写 `camera.position`）。
 * 2. **★ 验收 `BB16`**：「`CameraRig` 在 3 视角下**转场后均能正确交还**」——
 *    三种视角各跑一次脚本运镜，断言结束后 `mode` 回到原视角，且相机重新由该视角接管。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { createCameraRig, easeInOutCubic } from '../../src/cabin/core/render/CameraRig.js'

const cam = () => new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 300)

/** 一台"记录被谁摆过"的相机 rig */
function rigWithModes() {
  const camera = cam()
  const rig = createCameraRig({ camera, mode: 'fixed' })
  const calls = []
  rig.defineMode('fixed', (s, c) => {
    calls.push('fixed')
    c.position.set(0, 2.2, 10)
  })
  rig.defineMode('fp', (s, c) => {
    calls.push('fp')
    c.position.set(1, 1, 1)
  })
  rig.defineMode('tp', (s, c) => {
    calls.push('tp')
    c.position.set(2, 2, 2)
  })
  return { rig, camera, calls }
}

test('update：调用当前视角的 solver（其余不跑）', () => {
  const { rig, camera, calls } = rigWithModes()
  rig.update({}, 0)
  assert.deepEqual(calls, ['fixed'])
  assert.equal(camera.position.z, 10)
  rig.setMode('fp')
  rig.update({}, 0)
  assert.deepEqual(calls, ['fixed', 'fp'])
  assert.equal(camera.position.x, 1)
})

test('setMode：未注册的视角被拒绝（不静默切到空视角）', () => {
  const { rig } = rigWithModes()
  assert.equal(rig.setMode('第四人称'), false)
  assert.equal(rig.mode, 'fixed')
  assert.equal(rig.setMode('tp'), true)
  assert.deepEqual(rig.modes, ['fixed', 'fp', 'tp'])
})

test('★ BB16：三种视角下脚本运镜结束后都能正确交还', () => {
  for (const start of ['fixed', 'tp', 'fp']) {
    const { rig, camera, calls } = rigWithModes()
    rig.setMode(start)
    calls.length = 0

    let done = null
    rig.playScript({
      duration: 1,
      apply: (k, s, c) => c.position.set(k * 100, 0, 0),
      onDone: (restored) => {
        done = restored
      },
    })
    assert.equal(rig.scripted, true)

    rig.update({}, 0.5)
    assert.equal(camera.position.x, 50, '脚本期间由 apply 接管（0.5 → k=0.5）')
    rig.update({}, 0.5) // 到点

    assert.equal(rig.scripted, false, '脚本应已结束')
    assert.equal(rig.mode, start, `运镜后应回到 ${start}`)
    assert.equal(done, start, 'onDone 收到交还后的视角名')
    assert.equal(rig.lastRestored, start)

    // 交还后由该视角的 solver 重新接管
    calls.length = 0
    rig.update({}, 0)
    assert.deepEqual(calls, [start], `${start} 应重新接管相机`)
  }
})

test('playScript：脚本期间 setMode 不生效（避免转场中途被切走）', () => {
  const { rig } = rigWithModes()
  rig.playScript({ duration: 1, apply: () => {} })
  assert.equal(rig.setMode('fp'), false)
  assert.equal(rig.mode, 'fixed')
  rig.cancelScript()
  assert.equal(rig.setMode('fp'), true)
})

test('cancelScript：中断并立即交还（不触发 onDone）', () => {
  const { rig } = rigWithModes()
  let onDoneCalled = false
  rig.setMode('tp')
  rig.playScript({ duration: 1, apply: () => {}, onDone: () => (onDoneCalled = true) })
  assert.equal(rig.cancelScript(), true)
  assert.equal(rig.mode, 'tp', '中断也要交还')
  assert.equal(rig.scripted, false)
  assert.equal(onDoneCalled, false)
  assert.equal(rig.cancelScript(), false, '没有脚本时返回 false')
})

test('playScript：replace=false 时不打断正在进行的运镜', () => {
  const { rig } = rigWithModes()
  assert.equal(rig.playScript({ duration: 2, apply: () => {} }), true)
  assert.equal(rig.playScript({ duration: 1, apply: () => {}, replace: false }), false)
})

test('playScript 的参数校验', () => {
  const { rig } = rigWithModes()
  assert.throws(() => rig.playScript({ duration: 1 }), /apply/)
  assert.throws(() => rig.playScript({ duration: 0, apply: () => {} }), /正的 duration/)
})

test('easing：默认 easeInOutCubic，传入时按传入的算', () => {
  assert.equal(easeInOutCubic(0), 0)
  assert.equal(easeInOutCubic(1), 1)
  const { rig, camera } = rigWithModes()
  rig.playScript({ duration: 1, apply: (k, s, c) => c.position.set(k, 0, 0), easing: (x) => x })
  rig.update({}, 0.25)
  assert.equal(camera.position.x, 0.25, '线性缓动下 k 就是进度')
})

test('applyShake：只在超过阈值时位移；三轴各加 (rng-0.5)*amount', () => {
  const camera = cam()
  const rig = createCameraRig({ camera })
  camera.position.set(0, 0, 0)
  const half = () => 0.5 // rng 恒为 0.5 ⇒ 位移为 0
  assert.equal(rig.applyShake(0.001, half), false, '低于阈值不动')
  camera.position.set(0, 0, 0)
  assert.equal(rig.applyShake(1, half), true)
  assert.deepEqual([camera.position.x, camera.position.y, camera.position.z], [0, 0, 0])
  camera.position.set(0, 0, 0)
  rig.applyShake(1, () => 1) // (1 - 0.5) * 1 = 0.5
  assert.deepEqual([camera.position.x, camera.position.y, camera.position.z], [0.5, 0.5, 0.5])
})

test('applyTestCamera：六个数直接摆相机；非法输入不动相机', () => {
  const camera = cam()
  const rig = createCameraRig({ camera })
  assert.equal(rig.applyTestCamera([0, 1.55, 3, -1.6, 1.1, -1.2]), true)
  assert.deepEqual([camera.position.x, camera.position.y, camera.position.z], [0, 1.55, 3])
  assert.equal(rig.applyTestCamera(null), false)
  assert.equal(rig.applyTestCamera([1, 2]), false)
})

test('createCameraRig 的参数校验', () => {
  assert.throws(() => createCameraRig({}), /相机/)
  const rig = createCameraRig({ camera: cam() })
  assert.throws(() => rig.defineMode('', () => {}), /字符串名字/)
  assert.throws(() => rig.defineMode('x', 42), /必须是函数/)
})
