# 跳过：`floor2/wand`（18.9 左墙中央的魔法杖：飞起 → 悬停 → 施法 → 生成元素造物 → 归位） —— `J3` / B5

> 本目录 `*.json` 才会被 `_j3-apply.mjs` 读；这是一份**说明**（`.md`），故意不写 spec。
> 结论：**本轮不搬** —— 依据任务书硬约束 4「区间外被引用的变量 ⇒ 跳过并说明」。
> 这是二楼**最大**的一个分区（约 600 行），但也是依赖面最广的一个。

## 1. 分区边界（整行逐字唯一，已核对）

- `startMarker`：`            /* 18.9 左墙中央的魔法杖 */`
- `endMarker`  ：`            /* 18.10 垃圾桶 / 抽纸盒 / 衣柜（二楼） */`
- 区间：该两行之间（写作时 **L3311–L3911**）：`WAND_Y / WAND_Z / HOOK_X / WAND_REST / WAND_HOVER /
  CAST_POS`、两根墙钩、`wandG`、`crystalG`、`wGlow1/2`、`ELEMENTS[6]`、`loopLine / openLine /
  ringPts2 / polyPts2 / starPts2 / spiralPts2 / buildMagicCircle /` **`hash01` / `jitterGeo`**`/
  makeSolidFlame / buildCreation（6 种元素造物，约 260 行）/ wandState / crystalColor / aimQ /
  regMagic(wandG, …) / clearCast / updateWand2`。
- 每帧分支（若搬则进 `update`）：`tickOnce()` 的 **L6871**（`updateWand2(time);`）。

## 2. 阻塞点（两条）

### ① `hash01` / `jitterGeo` 就定义在这个区间里 —— 而它们是 `ctx` 里的**共享工具**

```js
// L3473 / L3481（区间内）
            function hash01(s) { … }
            function jitterGeo(geo, amp) { … }
```

`propCtx` 里 `propTool('jitterGeo', () => jitterGeo)` / `propTool('hash01', () => hash01)`（L687–688）
指的就是这两个函数；`floor2/junkBoxes.js` 的兄弟件 `crumpleBall`（18.10 段，**L3933**）也在调
`jitterGeo(...)`。区间一删，`ctx.jitterGeo` / `ctx.hash01` 双双 `ReferenceError` ——
凡是 `build` 里解构了它们的已搬物件都会在装配时炸。

### ② `smooth` 由 18.8 段提供，本件每帧都用

`updateWand2` 用了 3 处 `smooth`（起飞 / 生长 / 归位三段缓动）。它与 18.8 的 SKIP 是**同一个债**：
`smooth` 住在 18.8 区间内（见 `floor2-board.SKIP.md` §2①），18.8 不动，18.9 就不能假设它还在。
（换句话说：先把 `smooth` 提取出去，18.8 与 18.9 会同时解锁。）

## 3. 其余依赖（下一轮要一次处理完的清单）

| 依赖 | 位置 | 说明 |
|---|---|---|
| `clock.now` | `regMagic(wandG, …)` 里 `wandState.t0 = clock.now` | 照 `floor2/rubik.js` 的处置改 `s.now`（二者恒等） |
| `runtimeRng` | `regMagic` 里 1 次、`buildCreation` 里数十次、`buildMagicCircle` 无 | 必须保持调用**次数与顺序**（不变量 `N8`）—— `buildCreation` 是**点击时**才调用的，所以它的 rng 消耗属于运行期 |
| `scene.add / scene.remove` | `updateWand2` 里 `clearCast()` 与施法段各有一处 | 需要 `ctx.scene`（有） |
| `IN_MAT` | 区间**前**（18.8 的 `scrollRoll` 用了它），本件不用 | 与本案无关，只是提醒 `IN_MAT` 在 ctx 里 |

## 4. 下一轮 / `J4` 的前置条件（按顺序）

1. **提取 `smooth`**（`core/math/easing.js`）→ 由 `propCtx` 注入。这一步同时解锁 18.8 与 18.9，
   并让 `floor2/junkBoxes.js` 里那份「复刻的 `smooth`」可以删掉。
2. **提取 `hash01` / `jitterGeo`**（`core/geometry/jitter.js`）→ 由 `propCtx` 注入。
   注意 `jitterGeo` 内部就用 `hash01`，两者要一起搬，且必须**逐字**搬运
   （它对顶点做的是 `toFixed(3)` 字符串哈希，改一个字符画面就变）。
3. 然后照本目录其它 spec 写 `floor2-wand.json`：
   `id: "floor2/wand"`、`name: "wand"`、`assign: "wandApi"`、`file: "src/cabin/world/floor2/wand.js"`、
   `layout` 声明 `WAND_Y / WAND_Z / HOOK_X / WAND_REST / WAND_HOVER / CAST_POS`
   （注意 `WAND_REST/HOVER/CAST_POS` 是 `V(...)` 造出来的 Vector3，按 `BROOM_REST` 的写法落成 `{x,y,z}` 对象，
   `updateWand2` 里用到的 `lerpVectors` / `copy` / `addScaledVector` 对普通对象**不成立** ⇒ 推荐经
   `parts` 交出 `build` 里 `V(...)` 造的那三个实例，与 `floor2/witchHat.js` 的「细节 3」同一手法）、
   `state` 收 `wandState`（含 `dir` 这个 Vector3）+ `crystalColor/crystalTarget` + `now`、
   `interactables`：`id 'wand/cast'`、`label '挥动魔法杖施法'`、`mode 'both'`、
   `anchor` 取 `WAND_REST`、`radius` 1.8、`onActivate` 保留 `if (s.phase !== 'idle') return;` 守卫、
   `tick.old` = `                updateWand2(time);` → `wandApi.tick(dt, time);`。
4. ⚠️ `updateWand2` 里 `buildMagicCircle(s.el, s.idx)` / `buildCreation(s.idx, s.el)` 会把新 Group
   `scene.add` 进场景、`clearCast()` 再 `scene.remove` —— 这是**动态增删场景节点**，
   搬迁时必须保证 `scene` 是 ctx 给的那一个（是），且增删顺序不变（渲染顺序敏感）。
