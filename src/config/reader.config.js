/**
 * 阅读器配置（M01 的文章阅读）
 *
 * 对应实现：src/blog/reader/{Css3dReader,Paginator,LongPostFallback}.js
 * 对应决策：**方案 B —— CSS3DRenderer 真 DOM 书页**（见 docs/BuildPlaning/03-渲染通道与构建选型.md）
 *
 * ⚠️ 这个文件里的数大部分**不是审美偏好，而是几何约束**：
 *    改 `flatView` 会改变平面视角下的实际字号，必须重跑验收 **CH5**（实际字高 ≥ 14px）；
 *    改 `css3d` 的抬升量会破坏层次模型，必须重跑验收 **CH1/CH2**。
 */
import { resolveNumber } from './resolve.js'

/** @type {import('./types.js').ReaderConfig} */
export const readerConfig = {
  // ── 通道 B 的书页规格 ───────────────────────────────────────
  // 比例取自原型 shared/magic-book.js 的平放魔法书几何（勿随意改，会与书的模型对不上）
  page: {
    widthRatio: 0.19, // 单页宽 / 书宽
    heightRatio: 0.245, // 单页高 / 书宽
    columns: 2, // 左右对开两页
    fontSize: 17, // 正文基准字号（px，CSS3D 元素内）
    lineHeight: 1.7,
  },

  // ── 平面视角（垂直俯视阅读）★ 三个数必须一起调 ────────────────
  // 几何依据：书页是水平平面，相机正上方垂直俯视 → 投影是均匀缩放（透视 = 正交），
  //           实测投影宽高比偏差 0.0003（斜俯视是 0.587，明显梯形变形）。
  //
  // ① distance 必须是原来（约 0.42）的 3 倍以上：合上时封面在 y≈0.046、翻开后书页在 y≈0.023，
  //    相机太近会让两者缩放差达 6%，翻开瞬间内容"胀"一下；拉到 1.4 后降到 1.6%。
  // ② fov 必须与 distance **同比缩小**（屏幕上大小才不变）。
  // ③ fog 必须跟着相机走：原雾 near 1.4，相机退到 1.4 正好把内容吃掉、整块发暗。
  flatView: {
    distance: resolveNumber('PUBLIC_READER_FLAT_DISTANCE', 1.4),
    fov: 13,
    fogNear: 2.6,
    fogFar: 10,
  },

  // ── 长文兜底（决策点 OD-3）──────────────────────────────────
  // 原型实测：约 440 有效字 / 页。12 页 ≈ 5300 字。
  // 超过阈值时：3D 仍然是那本书（封面/书脊/翻页动效都在），但"走进书页"后切到全屏滚动阅读层。
  maxPagesInBook: 12,
  fallback: 'reading-layer', // 'reading-layer' | 'in-book-scroll' | 'none'

  // ── 移动端（决策点 OD-4）────────────────────────────────────
  // 原型只在桌面 1280×800 / 900×1100 验证过；触屏的翻页拖拽手势尚未实现。
  mobile: {
    channels: ['D'], // 移动端不做通道 B，正文走 2D 滚动阅读层
    skipCameraMove: true, // 跳过运镜（省电、避免误触）
    fallback: 'reading-layer',
  },

  // ── 转场 ────────────────────────────────────────────────────
  // 抽书 → 相机推近 → 翻开（原型 0.55s + 0.13s×6 翻页 + 0.40s 扇页）→ 平面视角 → 阅读
  // 置 0 = 直接跳位（供 prefers-reduced-motion，验收 BB18）
  transitionMs: 1800,

  // 是否记住并续读上次位置（localStorage；所有者是博客侧，小屋只读 —— 不双写）
  resumeReading: true,

  // ── ★ CSS3D 层次与装填的三条硬约定（改这些数会破坏验收 CH1/CH2）──
  // 详见 docs/BuildPlaning/03-渲染通道与构建选型.md §3.1–3.3
  css3d: {
    // 各层平面的高度（世界单位）。0.001 ≈ 屏幕上 1.5px。
    // 层次 = 深度 + DOM 顺序，**双保险**：只做对其中一个都会出现"看一眼就知道不对"的闪烁。
    stackY: {
      back: 0.0055, // 封底
      coverBack: 0.0132, // 封面反面（翻开后）
      page: 0.0232, // 书页
    },
    // 翻页中的纸相对书页平面的抬升量。
    // ⚠️ 必须 > paperHalfT，否则纸的最低点会低于书页平面、与书页共面 → 排序摇摆 → 闪烁
    paperLift: 0.0018,
    paperHalfT: 0.0009, // 半纸厚（正/反面各偏 ∓paperHalfT，对称）

    // 正反面切换阈值（弧度）。取 π/2：那时平面对视线几乎侧向，投影退化成一条线，换内容看不见。
    // ⚠️ **不要用 `backface-visibility: hidden`** —— 组合旋转下判定不可靠（两个面会同时被判为背面，
    //    整张纸消失一帧），且带 overflow/border-radius 的元素会在合上状态就整体消失。
    faceFlipAngle: Math.PI / 2,

    // 翻页热区（左右边缘的渐变条）：默认完全透明，只在 pointerenter 时浮现，
    // 否则纸收起后会"突然出现"细线/暗带。
    hotspotOpacity: { idle: 0, hover: 0.07 },
  },
}
