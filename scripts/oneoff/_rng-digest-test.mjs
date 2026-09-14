// 验证 rng 的 digest 是否真的随取值更新
import { createRng, scene, sceneDigest } from '../../src/cabin/app/rng.js'

console.log('初始 sceneDigest:', sceneDigest().combined)

const r = createRng(12345)
console.log('新实例 digest（未取值）:', r.digest, 'calls:', r.calls)
r()
r()
r()
console.log('取值 3 次后 digest:', r.digest, 'calls:', r.calls)

console.log('调用前 sceneDigest:', sceneDigest().combined)
scene.outdoor()
scene.outdoor()
console.log('调用 2 次后 sceneDigest:', sceneDigest().combined)
console.log('scene.outdoor calls:', scene.outdoor.calls, 'digest:', scene.outdoor.digest)

// 模拟两次独立运行：同一 seed 应产生相同 digest
const a = createRng(999)
const b = createRng(999)
for (let i = 0; i < 10; i++) {
  a()
  b()
}
console.log('同种子两次运行 digest 相同:', a.digest === b.digest, a.digest, b.digest)

const c = createRng(1000)
for (let i = 0; i < 10; i++) c()
console.log('不同种子 digest 不同:', a.digest !== c.digest, c.digest)
