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

  /** 灶台旁固定木台（原无编号分区）—— 位置与朝向 */
  const PLATFORM_X = -1.35
  const PLATFORM_Z = -1.5
  const PLATFORM_ROT = 0.4

  /** 魔法扫帚（12.10）：静止位与悬浮位。`rz` 是 Z 轴倾角 */
  const BROOM_REST = { x: -3.3, y: 0.105, z: 3.35, rz: 0.33 }
  const BROOM_FLY = { x: -2.7, y: 0.95, z: 2.65, rz: 0.05 }

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

  /* ══════════ J3 搬迁新增 ══════════ */
  /** 二楼书桌桌面台历（18.4）中心 x（floor2/calendar） */
  const CAL_X = 2.62
  /** 二楼书桌桌面台历（18.4）中心 z（floor2/calendar） */
  const CAL_Z = -2.34
  /** 二楼书桌桌面扑克牌堆（18.4）的静止位（组原点）（floor2/card-deck） */
  const DECK_HOME = { x: 3.35, y: TBL_TOP + 0.002, z: -2.15 }
  /** 二楼书桌桌面金币柱（18.4）的基座（交互锚点与几何同源）（floor2/coin-towers） */
  const COIN_BASE = { x: 3.34, z: -2.28 }
  /** 二楼书桌桌面沙漏（18.4）中心 x（floor2/desk-hourglass） */
  const DESK_HG_X = 2.15
  /** 二楼书桌桌面沙漏（18.4）中心 z（floor2/desk-hourglass） */
  const DESK_HG_Z = -2.50
  /** 书桌椅（18.4）中心 x（floor2/desk-chair；原分区行内常量 `2.6`，也是交互锚点的来源） */
  const CHAIR_X = 2.6
  /** 书桌椅（18.4）**推入**时的 z（floor2/desk-chair；原 `const CHAIR_IN = -3.20`） */
  const CHAIR_IN = -3.20
  /** 书桌椅（18.4）**拉开**时的 z（floor2/desk-chair；原 `const CHAIR_OUT = -3.60`） */
  const CHAIR_OUT = -3.60
  /** 二楼前墙挂画（18.13）中心（原 `picG.position.set(1.45, FY + 1.55, 3.82)` 拆出，y 是相对二楼楼面的高度）（floor2/picture） */
  const PIC_POS = { x: 1.45, y: 1.55, z: 3.82 }
  /** 二楼书桌桌面魔方（18.4）的静止位（组原点）（floor2/rubik） */
  const RUBIK_HOME = { x: 3.15, y: TBL_TOP + 0.085, z: -2.68 }
  /** 二楼书桌桌面玻璃雪景球（18.4）中心 x（floor2/snow-globe） */
  const SNOW_X = 3.50
  /** 二楼书桌桌面玻璃雪景球（18.4）中心 z（floor2/snow-globe） */
  const SNOW_Z = -2.80
  /** 二楼烟囱墙魔法时钟（18.12）中心 x（floor2/magic-clock；原段内硬编码 `-2.95`；y/z 用 `FY + 1.42` 与 `CHZ`） */
  const CLOCK_X = -2.95
  /** 左窗下魔法书堆（12.9a）的组原点（`bookPileG.position`）（floor1/book-pile） */
  const BOOK_PILE_POS = { x: -3.62, y: 0, z: -1.4 }
  /**
   * 左墙书架（12.9 + 12.9f 余段）中心 x（floor1/bookshelf）
   *
   * 原 `12.9` 分区里的局部常量 `SFX`（`-3.72`）。搬进 layout 的原因与不变量 `N9` 一致：
   * **碰撞表也在读它**（`systems/player/collision.js` 的 `platformBoxes` 里那行"左墙书架（实心阻挡）"）
   * —— 位置必须与几何**同源**，否则书架的实体阻挡会与画面对不上。
   *
   * ⚠️ `STARBELL_POS.x` / `CHEST_POS.x` / `HG_POS.x` 亦取自同一个 `-3.72`，
   * 但它们是**各自物件自己的位置**，已按 `N9` 独立落在 layout 里，不引用本常量。
   */
  const SHELF_X = -3.72
  /** 左墙书架（12.9）中心 z（floor1/bookshelf；原分区局部常量 `SFZ`） */
  const SHELF_Z = -2.85
  /** 滑轮置物台（12.11b，含墨水瓶羽毛笔 + 纸堆）的初始位（floor1/cart-shelf；原分区常量 `CART_P0`） */
  const CART_POS = { x: 2.85, z: 2.2 }
  /** 滑轮置物台（12.11b）的滑出方向：朝被炉方向（-z，向屋内）滑出，不再撞花盆（floor1/cart-shelf；原 `CART_DIR`） */
  const CART_DIR = { x: 0, z: -1 }
  /** 滑轮置物台（12.11b）的滑出距离（floor1/cart-shelf；原 `CART_DIST`） */
  const CART_DIST = 0.55
  /** 旋转星铃（12.9d）的组原点（x 与 12.9 左墙书架的 SFX 同值，y 是吊挂高度）（floor1/star-bell） */
  const STARBELL_POS = { x: -3.72, y: 1.975, z: -3.05 }
  /** 塔罗牌牌堆（12.12）的组原点（`tarotG.position`）（floor1/tarot） */
  const TAROT_POS = { x: -0.75, y: 0, z: -2.8 }
  /** 门口旁墙钩中心 x（挎包挂在它上面）（floor2/bag） */
  const BAG_HOOK_X = 0.15
  /** 墙钩中心高度 y（floor2/bag） */
  const BAG_HOOK_Y = FY + 1.38
  /** 墙钩中心 z（前墙内侧）（floor2/bag） */
  const BAG_HOOK_Z = 3.825
  /** 二楼垃圾桶中心 x（floor2/tissue-box 的抛纸终点也用它）（floor2/bin） */
  const BIN_X = 1.85
  /** 二楼垃圾桶中心 z（floor2/tissue-box 的抛纸终点也用它）（floor2/bin） */
  const BIN_Z = -3.40
  /** 垃圾桶高度（floor2/tissue-box 的桶口高度 FY + BIN_H + 0.10 由它推出）（floor2/bin） */
  const BIN_H = 0.60
  /** 二楼置物箱中心 x（floor2/crate 与 floor2/witch-hat 共用）（floor2/crate） */
  const CRATE_X = 0.95
  /** 二楼置物箱中心 z（floor2/crate 与 floor2/witch-hat 共用）（floor2/crate） */
  const CRATE_Z = 3.48
  /** 置物箱箱体宽（魔女帽撒糖的落点判定也用，floor2/witch-hat 共用）（floor2/crate） */
  const CR_W = 0.68
  /** 置物箱箱体深（魔女帽撒糖的落点判定也用，floor2/witch-hat 共用）（floor2/crate） */
  const CR_D = 0.55
  /** 置物箱箱体高（CRATE_TOP 由它推出，floor2/witch-hat 共用）（floor2/crate） */
  const CR_H = 0.32
  /** 置物箱盖顶面高度（魔女帽的帽座 HAT_HOME_POS 与糖果落点判定，floor2/witch-hat 共用）（floor2/crate） */
  const CRATE_TOP = FY + CR_H + 0.092
  /** 二楼拱形全身镜（18.14）中心 x（floor2/mirror） */
  const MIRROR_X = 2.55
  /** 二楼拱形全身镜（18.14）中心 z（floor2/mirror） */
  const MIRROR_Z = 3.60
  /** 二楼书桌上的抽纸盒中心 x（floor2/tissue-box） */
  const TISSUE_X = 1.42
  /** 二楼书桌上的抽纸盒中心 z（floor2/tissue-box） */
  const TISSUE_Z = -2.15
  /** 二楼衣柜中心 x（floor2/wardrobe） */
  const WD_X = -1.40
  /** 二楼衣柜中心 z（floor2/wardrobe） */
  const WD_Z = 3.55
  /** 小宝箱（12.9c）在楼梯下储物架台面上的位置（x 与原 12.9a 的 SFX 同值，y 是架子台面高）（floor1/chest） */
  const CHEST_POS = { x: -3.72, y: 0.805, z: -2.66 }
  /** 门口上方挂杆（含晴天娃娃 / 玻璃风铃）中心 x（floor1/hang-bar） */
  const HANGBAR_X = 0
  /** 门口上方挂杆中心高度 y（floor1/hang-bar） */
  const HANGBAR_Y = 2.66
  /** 门口上方挂杆中心 z（门内侧）（floor1/hang-bar） */
  const HANGBAR_Z = 3.86
  /** 沙漏（12.9b）在楼梯下储物架台面上的位置（x 与原 12.9a 的 SFX 同值，y 是架子台面高）（floor1/hourglass） */
  const HG_POS = { x: -3.72, y: 0.805, z: -2.44 }
  /** 右前角杂物纸箱（18.16）中心 x（floor2/junk-boxes） */
  const JUNK_X = 3.34
  /** 右前角杂物纸箱（18.16）中心 z（floor2/junk-boxes） */
  const JUNK_Z = 3.34
  /** 二楼毛茸茸大地毯（18.15）中心 x（floor2/rug-large） */
  const RUG2_X = 2.7
  /** 二楼毛茸茸大地毯（18.15）中心 z（floor2/rug-large） */
  const RUG2_Z = 0.7

  return {
    // 建筑外壳
    HOLE_R, FLOOR_TOP, DOOR_HOLE, WIN_F_L, WIN_F_R, WIN_LEFT, WIN_GABLE, LOG_R, LOG_GAP, WALL_TOP, WALL_Y0,
    // 一楼
    CHX, CHZ, HEARTH, FX, FZ, MTX, MTZ, MTTOP, CCX, CCZ, MC_X, MC_Z, KOT_X, KOT_Z, KTOP,
    CBX, CBZ, PLX, PLZ, DT_X, DT_Z, DTOP,
    PLATFORM_X, PLATFORM_Z, PLATFORM_ROT,
    BROOM_REST, BROOM_FLY,
    // 二楼
    FY, BEDX, BEDZ, NSX, NSZ, TBLX, TBLZ, TBL_TOP,
    // J3 搬迁新增
    CHEST_POS, HANGBAR_X, HANGBAR_Y, HANGBAR_Z, HG_POS, JUNK_X, JUNK_Z, RUG2_X, RUG2_Z,
    // J3 搬迁新增
    BOOK_PILE_POS, STARBELL_POS, TAROT_POS, BAG_HOOK_X, BAG_HOOK_Y, BAG_HOOK_Z, BIN_X, BIN_Z, BIN_H, CRATE_X, CRATE_Z, CR_W, CR_D, CR_H, CRATE_TOP, MIRROR_X, MIRROR_Z, TISSUE_X, TISSUE_Z, WD_X, WD_Z,
    // J4.19 搬迁新增（左墙书架 —— 碰撞表也读它）
    SHELF_X, SHELF_Z,
    // J4.20 搬迁新增（滑轮置物台 —— 碰撞表也读它的 `cartG` 位置）
    CART_POS, CART_DIR, CART_DIST,
    // J4.21 搬迁新增（书桌椅 —— 碰撞表也读它的 `chairG` 位置）
    CHAIR_X, CHAIR_IN, CHAIR_OUT,
    // J3 搬迁新增
    CAL_X, CAL_Z, DECK_HOME, COIN_BASE, DESK_HG_X, DESK_HG_Z, PIC_POS, RUBIK_HOME, SNOW_X, SNOW_Z,
    // J4.30 搬迁新增（二楼魔法时钟）
    CLOCK_X,
  }
}
