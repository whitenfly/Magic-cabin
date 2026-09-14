/**
 * 种子随机（F0.2）
 * ============================================================================
 * 目的：让场景**每次加载都完全一致**，从而让「重构前后截图对比」成为可行的验证手段。
 *
 * 背景：搬迁前的实现里有 286 处 `Math.random()` 调用（分布在 185 行），
 * 它们让同一份代码每次加载都画出不同的树、石头、星空排布 ——
 * 于是"改了 A 之后截图变了"这件事无法归因：可能是改坏了，也可能只是随机不同。
 *
 * ## 设计：三类分离，而不是一刀切
 *
 * | 类 | 含义 | 处理 |
 * |---|---|---|
 * | A | **构建期**（场景生成）：树木/石头/星空/云/纹理噪点 | 永久确定，每次加载一致 |
 * | C | **初始化**（一次性算出、之后一直影响动画）：粒子相位、气泡半径 | 永久确定 |
 * | B | **运行期瞬态**（用户触发或循环重置）：爆炸、涟漪、撒糖、震屏 | 默认**保持真随机**（保自然感）；测试模式可切换为确定 |
 *
 * A/C 走 `scene.*`（不可切换）；B 走 `runtime()`（可切换）。
 *
 * ## 为什么按区域 fork，而不是共用一个全局序列
 *
 * 若所有模块共用一个序列，那么「在森林里多加一棵树」会让后续所有模块的随机值
 * 整体错位 —— 星空、云、雨雪全变，回归基线立刻失效，你无法判断是改动生效还是随机位移。
 *
 * 按区域 fork 后，**改森林不影响星空**，局部改动只影响局部比对。
 */

/** 全局场景种子。改动它会得到"整体不同但风格一致"的另一个小屋（可用于生成多套布局） */
export const SCENE_SEED = 20260214

/** FNV-1a 32 位哈希：把标签映射为种子 */
function hash32(str) {
  let h = 2166136261 >>> 0
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h >>> 0
}

/**
 * 线性同余发生器（LCG）
 * 选它是因为：够快、状态极小、跨环境完全确定（不依赖引擎实现）。
 * 统计质量足够场景布局使用（不需要密码学强度）。
 */
export function createRng(seed) {
  let s = seed >>> 0
  // 取值序列摘要：用于验证「同一版本两次运行产生了完全相同的随机序列」
  // 只要两轮的 digest 相同，就说明场景布局必然一致（与截图无关，不受动画相位影响）
  let digest = 2166136261 >>> 0
  let calls = 0
  const next = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    const v = s / 4294967296
    digest ^= (s & 0xffff) >>> 0
    digest = Math.imul(digest, 16777619) >>> 0
    calls++
    return v
  }
  const rng = next
  rng.range = (a, b) => a + next() * (b - a)
  /** [0, n) 整数 */
  rng.int = (n) => Math.floor(next() * n)
  /** 从数组随机取一个 */
  rng.pick = (arr) => arr[Math.floor(next() * arr.length)]
  /** 以概率 p 返回 true */
  rng.bool = (p = 0.5) => next() < p
  /** 派生一个独立序列（同 label 恒定，不同 label 互不影响） */
  rng.fork = (label) => createRng(hash32(label) ^ seed)
  // ⚠️ 必须用 defineProperty：Object.assign 会「读取」getter 的值并复制成数据属性，
  //    导致 digest/calls 永远停在初始值（曾因此让确定性验证出现假阳性）。
  Object.defineProperty(rng, 'state', { get: () => s, enumerable: true })
  Object.defineProperty(rng, 'digest', { get: () => digest.toString(16).padStart(8, '0'), enumerable: true })
  Object.defineProperty(rng, 'calls', { get: () => calls, enumerable: true })
  return rng
}

// ── 场景随机（A / C 类）：永久确定，每次加载一致 ──
// 区域划分与 monolith.js 的行号区间一一对应，见 docs/实施结果/F0.2-实施结果.md
export const scene = {
  /** 室外景物（森林 / 草地 / 石头 / 蘑菇 / 花 / 树桩 / 萤火虫） —— 行 516–657 */
  outdoor: createRng(hash32('scene/outdoor') ^ SCENE_SEED),
  /** 一楼陈设的初始化随机（书堆 / 坩埚 / 魔法阵 / 水晶球 / 纸堆 / 塔罗 / 毛线球 / 烟） */
  floor1: createRng(hash32('scene/floor1') ^ SCENE_SEED),
  /** 二楼陈设的初始化随机（金币柱 / 雪景球雪花 / 星空粒子） */
  floor2: createRng(hash32('scene/floor2') ^ SCENE_SEED),
  /** 天空与天气的初始化随机（星空 / 云 / 雨滴 / 雪花初始位置） */
  sky: createRng(hash32('scene/sky') ^ SCENE_SEED),
  /** Canvas 程序化纹理的噪点（黑板 / 地毯） */
  texture: createRng(hash32('scene/texture') ^ SCENE_SEED),
  /** 史莱姆气泡 */
  slime: createRng(hash32('scene/slime') ^ SCENE_SEED),
}

// ── 运行期随机（B 类）：默认真随机，测试模式可切换为确定 ──
let runtimeImpl = Math.random
let deterministic = false

/**
 * 运行期随机源。
 * 用法与原 `Math.random()` 完全一致：`runtime()` 返回 [0, 1)。
 *
 * 正常模式：真随机（爆炸碎屑、涟漪、撒糖每次都不同，观感自然）
 * 测试模式：确定（同一帧序列可逐帧复现，用于视觉回归）
 */
export function runtime() {
  return runtimeImpl()
}

/**
 * 切换运行期随机源。
 * @param {boolean} on true = 确定（测试）；false = 真随机（正常）
 * @param {number} [seed] 可选的自定义种子
 */
export function setDeterministicRuntime(on, seed) {
  deterministic = !!on
  runtimeImpl = on ? createRng((seed ?? hash32('runtime')) ^ SCENE_SEED) : Math.random
}

/** 当前运行期随机是否为确定模式 */
export function isRuntimeDeterministic() {
  return deterministic
}

/**
 * 重置全部随机源到初始状态。
 * 视觉回归时在"开始截图"之前调用，保证每次运行从同一状态出发。
 */
export function resetAllRandom() {
  scene.outdoor = createRng(hash32('scene/outdoor') ^ SCENE_SEED)
  scene.floor1 = createRng(hash32('scene/floor1') ^ SCENE_SEED)
  scene.floor2 = createRng(hash32('scene/floor2') ^ SCENE_SEED)
  scene.sky = createRng(hash32('scene/sky') ^ SCENE_SEED)
  scene.texture = createRng(hash32('scene/texture') ^ SCENE_SEED)
  scene.slime = createRng(hash32('scene/slime') ^ SCENE_SEED)
  const wasDet = deterministic
  setDeterministicRuntime(wasDet)
}

/** 便于在控制台/测试里观察随机状态 */
export function snapshotRandomState() {
  return {
    seed: SCENE_SEED,
    deterministic,
    state: {
      outdoor: scene.outdoor.state,
      floor1: scene.floor1.state,
      floor2: scene.floor2.state,
      sky: scene.sky.state,
      texture: scene.texture.state,
      slime: scene.slime.state,
    },
  }
}

/**
 * 场景随机源的取值序列摘要（F0.2 的验收依据）。
 *
 * 两个不同时刻调用它：若结果相同，说明**场景布局完全一致** ——
 * 这比截图比对更精确，因为它不受动画相位（火焰摆动、水面、时间驱动效果）的干扰。
 */
export function sceneDigest() {
  return {
    seed: SCENE_SEED,
    entries: Object.entries(scene).map(([k, r]) => `${k}:${r.digest}(${r.calls})`).join(' '),
    combined: Object.values(scene)
      .map((r) => r.digest)
      .join('-'),
  }
}
