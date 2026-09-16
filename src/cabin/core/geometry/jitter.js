/**
 * 顶点抖动 + 字符串哈希 —— 共享几何工具（`J4.31` 提取）
 *
 * 来源：`legacy/monolith.js` 里 **18.9 段内**的那两个函数
 * `hash01(s)` 与 `jitterGeo(geo, amp)`（`J3` 记的 L3473 / L3481）。
 *
 * ## 为什么把它提到这里
 *
 * `floor2-wand.SKIP.md` §2①：它们**定义在 18.9（魔法杖）的区间里**，
 * 却是 `ctx` 里的**共享工具** —— `propCtx` 的
 * `propTool('jitterGeo', …)` / `propTool('hash01', …)` 指的就是这两个函数，
 * 而已搬的 `floor2/junkBoxes.js` 的兄弟件 `crumpleBall` 也在调 `jitterGeo(...)`。
 *
 * ⇒ 区间一删，`ctx.jitterGeo` / `ctx.hash01` 双双 `ReferenceError` ——
 * **凡是 build 里解构了它们的已搬物件都会在装配时炸**。
 * `wand` 的 SKIP §4 把它列成**前置第 2 条**，并特别提醒：
 *
 * > 注意 `jitterGeo` 内部就用 `hash01`，两者要一起搬，且必须**逐字**搬运
 * > （它对顶点做的是 `toFixed(3)` 字符串哈希，**改一个字符画面就变**）。
 *
 * ## ⚠️ 逐字搬运（本文件是"一个字符都不能改"的典型）
 *
 * 两个函数体与原文**一字不差**：哈希用 `h * 31 + charCodeAt(i)` 对 **997** 取模、
 * 抖动用 `toFixed(3)` 拼出的**字符串**（含逗号与 `'x'`/`'y'`/`'z'` 后缀）做键。
 * 任何"看起来等价"的改写（例如换成数值哈希、或调整 `toFixed` 的位数）
 * 都会让顶点位移不同 ⇒ **像素回归当场变红**。
 */

/**
 * 把字符串映射到 `[0, 1)`（确定性，无随机源）。
 *
 * @param {string} s 键
 * @returns {number} `0 … 996/997`
 */
export function hash01(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
        h = (h * 31 + s.charCodeAt(i)) % 997;
    }
    return h / 997;
}

/**
 * 按顶点坐标的 `toFixed(3)` 字符串键抖动几何（**原地修改并返回同一个对象**）。
 *
 * @param {{attributes: {position: any}, computeVertexNormals: Function}} geo 几何
 * @param {number} amp 振幅（每个轴上的位移是 `±amp`）
 * @returns 传入的 `geo`（便于链式书写）
 */
export function jitterGeo(geo, amp) {
    const pa = geo.attributes.position;
    for (let i = 0; i < pa.count; i++) {
        const k = pa.getX(i).toFixed(3) + ',' + pa.getY(i).toFixed(3) + ',' + pa.getZ(i).toFixed(3);
        pa.setXYZ(i,
            pa.getX(i) + (hash01(k + 'x') - 0.5) * 2 * amp,
            pa.getY(i) + (hash01(k + 'y') - 0.5) * 2 * amp,
            pa.getZ(i) + (hash01(k + 'z') - 0.5) * 2 * amp
        );
    }
    geo.computeVertexNormals();
    return geo;
}
