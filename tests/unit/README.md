# tests/unit — 纯函数与护栏单测

> **当前状态**：⬜ 空壳。随 `J2`（内核）起逐步填充。

## 放什么

| 目标 | 文件 | 对应验收 |
|---|---|---|
| 书架排列：排序 / 分组 / 尺寸推导 / **容量溢出** | `shelf-layout.test.mjs` | `BB11`、`H2` |
| 内容查询：标签计数 / 年月聚合 / 上下篇 / 相关推荐 | `content-query.test.mjs` | — |
| **四通道参数函数**（通道 A / T4 的映射公式） | `channels.test.mjs` | `CH6` |
| 碰撞与平台：`collideXZ` / `groundAt` / `railCollide` | `collision.test.mjs` | — |
| **CSS3D 护栏**（把"不抛异常只会闪"的约定变成机器校验） | `css3d-guards.test.mjs` | `CH2`、`CH3` |
| 配置：模块开关表与 `mapping.yaml` 的 id 集合一致 | `config-toggles.test.mjs` | `CF3`、`R30` |

## ★ 为什么"四通道参数函数"值得单测

通道 A 与 T4 的表达方式是**数据 → 一个连续属性**（液面高度、指针角度、光点亮度、转速）。
这类映射**算错了画面也看不出来**（"瓶子里的药水少了一点"没人会觉得是 bug），
所以必须用断言把它钉死：

```
liquidLevel(ratio) = clamp(0.25 + ratio * 0.75, 0.25, 1.0)    // 最少留 25% 液面
时钟指针角 = 运行天数 / 365 * 2π                                // 走一圈 = 一年
```

## ★ CSS3D 护栏要断言什么（来自原型的机器校验）

```
✓ 纸的枢轴【抬离】书页平面（PAGE_TOP_Y + PAPER_LIFT）
✓ 纸的正面相对枢轴 + 半纸厚 / 背面 − 半纸厚（对称）
✓ 数值复核：PAPER_LIFT(0.0018) > PAPER_HALF_T(0.0009) → 纸的最低点仍高于书页平面
✓ ❌ CSS 不得使用 backface-visibility（组合旋转下判定不可靠）
✓ 重排顺序 = 封底 → 封面正/反面 → 左右页 → 纸（后者在上）
✓ ❌ 已删除按状态切换层次的 relayer（它从未真正生效）
✓ ❌ loop() 内不得出现 innerHTML / createElement / replaceChildren / appendChild / querySelector / insertBefore
```

**护栏的价值**：这类错误**不抛异常，只表现为闪烁**。
有人把 `PAPER_LIFT` 调小、把 `backface-visibility` 加回来、或者用 `cssBook.add()` 去"重排层次"，
这些断言会立刻变红。参数值见 [`src/config/reader.config.js`](../../src/config/reader.config.js) 的 `css3d` 段。

## 怎么跑

```bash
# J0.4 之后接入；先保持零依赖（node --test）
node --test tests/unit
```
