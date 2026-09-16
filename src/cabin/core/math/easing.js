/**
 * 缓动函数 —— 共享数学工具（`J4.31` 提取）
 *
 * 来源：`legacy/monolith.js` 里 **18.8 段内**的那一行
 * `const smooth = k => k * k * (3 - 2 * k);`（`J3` 记的 L830 一带）。
 *
 * ## 为什么把它提到这里
 *
 * `floor2-board.SKIP.md` §2① 与 `floor2-wand.SKIP.md` §2② 记的是**同一笔债**：
 * `smooth` 住在 **18.8（计划板）** 的区间里，却被 **18.9（魔法杖）** 的每帧分支用了
 * **3 处**（起飞 / 生长 / 归位三段缓动）。
 *
 * ⇒ 18.8 一动，18.9 立刻 `ReferenceError`；反之 18.9 也搬不动。
 * `wand` 的 SKIP §4 把这件事列成**前置第 1 条**：
 *
 * > **提取 `smooth`**（`core/math/easing.js`）→ 由 `propCtx` 注入。
 * > 这一步同时解锁 18.8 与 18.9，并让 `floor2/junkBoxes.js` 里那份「复刻的 `smooth`」可以删掉。
 *
 * 本文件就是那件事。函数体**逐字相同**（`k * k * (3 - 2 * k)`，即 smoothstep）。
 */
export const smooth = k => k * k * (3 - 2 * k)
