/**
 * 小屋坐标真源 —— 建筑外壳尺寸与主要陈设锚点
 *
 * 来源：`legacy/monolith.js` 里散落的顶层常量（原样搬迁，`J2.9`）。**数值一个没改。**
 *
 * ## 为什么必须有这个文件（不变量 `N9`）
 *
 * 搬迁前，同一个坐标在两个地方各写一遍：
 *   · **几何构建**：`put(box(...), MTX, 0.75, MTZ)`
 *   · **交互判定**：`{ x: FX, z: FZ, r: 2.0, label: '点燃 / 熄灭壁炉' }`
 * 两边一旦不同步，就会出现"看得见点不着"或"点得着看不见"——
 * 而 `J2.6` 的统一交互契约要求每个物件声明自己的 `anchor`，那时这条不变量就从"建议"变成"必需"。
 *
 * ## 与 `tests/visual/poses.js` 的关系
 *
 * 截图机位（`?cam=px,py,pz,lx,ly,lz`）**不进产品代码**（`J0.4` 定的），它住在测试目录里，
 * 但它选的坐标与本文件同源 —— 换机位时要到这里核对真实锚点。
 *
 * ## 单位与朝向
 *
 * 单位是米；`+x` 向东、`+z` 向南（大门朝 `+z`，即"前"）。剖切模式默认开启。
 * 一楼层高 `FLOOR_TOP = 3.12`，墙顶 `WALL_TOP = 4.42`，屋脊在 `ridgeY`（见 monolith 的屋顶段）。
 */

/**
 * 造一份坐标表。
 *
 * 为什么是工厂而不是散落的 `export const`：常量之间有**依赖顺序**
 * （`FX = CHX + 0.15`、`FX` 又被交互判定引用；`TBL_TOP = FY + 0.80`），
 * 工厂把这个顺序收在一处，调用方拿到的是一个完整的、自洽的坐标表。
 *
 * @returns 全部常量（调用方通常整体解构，以保持原标识符名不变）
 */
export function createLayout() {
  /* ══════════ 建筑外壳 ══════════ */

  /** 楼梯中心的空洞半径 */
  const HOLE_R = 1.2
  /** 二楼楼面高度（也是"一楼净高"） */
  const FLOOR_TOP = 3.12
  /** 大门洞：`c` 中心、`hw` 半宽、`y0..y1` 高度区间 */
  const DOOR_HOLE = { c: 0, hw: 0.78, y0: 0, y1: 2.35 }
  /** 前墙左窗 */
  const WIN_F_L = { c: -2.4, hw: 0.58, y0: 1.1, y1: 2.1 }
  /** 前墙右窗 */
  const WIN_F_R = { c: 2.4, hw: 0.58, y0: 1.1, y1: 2.1 }
  /** 左侧墙窗 */
  const WIN_LEFT = { c: -1.5, hw: 0.58, y0: 1.1, y1: 2.1 }
  /** 山墙窗（二楼） */
  const WIN_GABLE = { c: 0, hw: 0.52, y0: 4.95, y1: 5.8 }
  /** 原木半径 */
  const LOG_R = 0.15
  /** 原木层间距 */
  const LOG_GAP = 0.27
  /** 墙顶 */
  const WALL_TOP = 4.42
  /** 墙底 */
  const WALL_Y0 = 0

  /* ══════════ 一楼锚点 ══════════ */

  /** 壁炉中心（`FX/FZ` 是炉膛中心，交互判定用的是它） */
  const CHX = -3.35
  const CHZ = 1.5
  /** 炉床高度 */
  const HEARTH = 0.12
  /** 壁炉炉膛中心 */
  const FX = CHX + 0.15
  const FZ = CHZ

  /** 魔法餐桌（12.1）中心与桌面高度 */
  const MTX = 1.8
  const MTZ = 2.2
  const MTTOP = 0.78

  /** 大魔女坩埚（12.9e） */
  const CCX = -2.35
  const CCZ = -0.45

  /** 紫色魔法阵（一楼） */
  const MC_X = -2.75
  const MC_Z = -2.15

  /** 暖桌（12.13）中心与桌面高度 */
  const KOT_X = 2.55
  const KOT_Z = -0.5
  const KTOP = 0.4475

  /** 水晶球占卜台（12.11） */
  const CBX = 3.05
  const CBZ = 3.25

  /** 月光魔法盆栽（门侧前右墙角） */
  const PLX = 3.55
  const PLZ = 2.45

  /** 长餐桌（12.9f）中心与桌面高度 */
  const DT_X = 1.6
  const DT_Z = -3.35
  const DTOP = 0.77

  /* ══════════ 二楼锚点 ══════════ */

  /** 二楼楼面（语义别名，方便"二楼的东西都以它为准"） */
  const FY = FLOOR_TOP

  /** 大床（18.1） */
  const BEDX = -2.4
  const BEDZ = -2.55

  /** 床头柜（18.2）与蜡烛 */
  const NSX = -1.15
  const NSZ = -3.3

  /** 书桌（18.4）中心与桌面高度 */
  const TBLX = 2.5
  const TBLZ = -2.5
  const TBL_TOP = FY + 0.80

  return {
    // 建筑外壳
    HOLE_R, FLOOR_TOP, DOOR_HOLE, WIN_F_L, WIN_F_R, WIN_LEFT, WIN_GABLE, LOG_R, LOG_GAP, WALL_TOP, WALL_Y0,
    // 一楼
    CHX, CHZ, HEARTH, FX, FZ, MTX, MTZ, MTTOP, CCX, CCZ, MC_X, MC_Z, KOT_X, KOT_Z, KTOP,
    CBX, CBZ, PLX, PLZ, DT_X, DT_Z, DTOP,
    // 二楼
    FY, BEDX, BEDZ, NSX, NSZ, TBLX, TBLZ, TBL_TOP,
  }
}
