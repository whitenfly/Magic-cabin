/**
 * 书架配置（M01 内容存档）
 *
 * 对应实现：src/blog/ShelfLayout.js（纯函数，可单测）+ src/blog/BookSpine.js（书脊图集）
 * 对应映射：docs/BuildPlaning/mapping.yaml 的 M01
 *
 * ⚠️ 层板坐标来自场景的**代码事实**（原 index.html L1958–1969 的三层填充循环），
 *    不是随意取值 —— 改了它书就会悬空或穿模。
 */
import { resolveNumber } from './resolve.js'

/** @type {import('./types.js').ShelfConfig} */
export const shelfConfig = {
  // ── 搁板规格（对应原 L1958–1969 的三个分区）──────────────────
  // 一楼左墙三层书架：层板顶面 y、可用 z 区间（z0 = 靠门一端）
  tiers: [
    { y: 0.205, z0: -3.42, z1: -2.30 }, // 第 1 层：可用宽 1.12 ≈ 14 本
    { y: 0.805, z0: -3.42, z1: -2.78 }, // 第 2 层：可用宽 0.64 ≈  8 本
    { y: 1.405, z0: -3.42, z1: -2.30 }, // 第 3 层：可用宽 1.12 ≈ 14 本
  ],

  // 相邻两本书之间预留的缝隙（原代码 `z += th + 0.012`）
  bookGap: 0.012,

  // ── 容量（H2 硬约束）────────────────────────────────────────
  // 书架 ≈36 本 + 左窗下书堆 ≈20 本 = **总计 ≈56 本**
  // 超出时必须走 overflow 策略；**静默丢弃会造成"文章凭空消失"，是最难排查的问题**
  capacity: { shelf: 36, pile: 20 },
  capacityWarnRatio: 0.9, // 占用超过 90% 时构建期告警（提示准备第二书架或精简内容）

  // 溢出策略（三级，按序尝试）
  //   'pile'       → 溢出到左窗下魔法书堆（已有 stacked/falling/risen 三态动画）
  //   'secondShelf'→ 溢出到第二书架（需新增物件，违反"必需新增 = 0"）
  //   'fail'       → 构建期**报错失败**（默认建议：宁可构建失败，也不要静默丢文章）
  overflow: 'fail',

  // ── 策展视图（Q1 的建议）────────────────────────────────────
  // true  = 架上只摆最新/精选 N 本，全量走 M02 时间归档
  //         → 彻底消除"第 57 篇 = 构建失败"
  // false = 全量上架，容量受 capacity 限制
  curatedView: true,
  curatedCount: 36,

  // ── 排序与分组 ──────────────────────────────────────────────
  sort: 'date', // 'date' | 'title' | 'pinned'（pinned 的书永远排在最左 = 最靠门口）
  groupBy: 'none', // 'none' | 'tag' | 'year' | 'series'（同标签/同系列的书相邻）

  // ── 书脊尺寸公式（让"厚度 = 文章长度"有物理意义）──────────────
  // thickness = clamp(base + wordCount / 4000 * per4k, min, max)
  //             4000 字 → 0.105；8000 字 → 被 clamp 到 0.14
  thickness: { base: 0.055, per4k: 0.05, min: 0.055, max: 0.14 },

  // height = clamp(base + (pinned ? pinnedBonus : 0) + tags.length * perTag, min, max)
  height: { base: 0.26, pinnedBonus: 0.08, perTag: 0.012, min: 0.26, max: 0.44 },

  // ── 书脊图集（性能硬要求，验收 BB14）────────────────────────
  // 所有书脊共用一张图集，每本书只改 UV —— 而不是每本书一张 CanvasTexture
  // 2048² ÷ (64×512) = 8 列 × 4 行 = 32 本/张；56 本 ≈ 2 张
  atlas: { atlasSize: 2048, spineW: 64, spineH: 512, perAtlas: 32 },

  // ── 视觉 ────────────────────────────────────────────────────
  // 书脊颜色由第一个标签的哈希派生（同标签 = 同色系）；置顶书书脊更亮
  spineTintByTag: true,
  pinnedEmphasis: true, // 置顶书的书名号/烫金线加亮

  // 书架浏览时的相机锚点（相对书架中心；由 J3 的挂载点提供真实坐标）
  browseAnchorOffset: { x: -1.1, z: 0.35 },
  browseDistanceScale: resolveNumber('PUBLIC_SHELF_ZOOM', 1.0),
}
