# cabin/core

> **占位目录** —— 尚未实现。本文档说明它将来放什么、依赖谁、由哪个阶段填充。
> 填充阶段：**`J2`（小屋核心设施）**。见 [`docs/BuildPlaning/01-完善路线图.md`](../../../docs/BuildPlaning/01-完善路线图.md) §3。

小屋内核（渲染 / 材质 / 光照 / 几何）

| 子目录 | 计划文件 | 来源（monolith.js 内） |
|---|---|---|
| `core/render/` | `createRenderer.js` `createScene.js` `CameraRig.js` | 原 872–884、8337–8375、9796–9800 |
| `core/materials/` | `fill.frag.glsl.js` `fill.vert.glsl.js` `FillMaterial.js` `litMaterial.js` `lineMaterials.js` | 原 886–1034 |
| `core/lighting/` | `LightField.js` `PointLightSource.js` `roomMask.js` | 原 903–906、9778–9794 |
| `core/geometry/` | `sketch.js` `roundBox.js` `solid.js` `shapes2d.js` | 原 1036–1053、1517–1569、7168–7182 |

**两条关键重构**（详见 [`docs/ArtLine-Part/02-目标架构.md`](../../../../docs/ArtLine-Part/02-目标架构.md) §3.4）：
1. **`LightField`**：把光源从「8 个硬编码 uniform 槽位」改为「N 个注册式光源 + 重要性裁剪」——
   现状新增一盏灯要改 4 处代码（shader 数组长度、循环上界、`uPtCount`、`animate()` 里的 `PP[i]` 赋值）。
2. **`CameraRig`**：现状全文件只有 3 处直接写 `camera.position`，没有任何运镜能力；
   而 **6 个模块**（M02 / M07 / M10 / M12 / M13 / M15）的「推移聚焦」转场都依赖它，
   `J6` 的**平面视角**（垂直俯视阅读）也依赖它。

> ⚠️ 平面视角的实现有一条硬约定：**姿态不能用 `lookAt` 求**（视线 `(0,-1,0)` 与默认 `up=(0,1,0)` 平行
> → 叉积退化成零向量 → 矩阵坏掉且不报错），要直接由欧拉角构造。见
> [`03-渲染通道与构建选型.md`](../../../docs/BuildPlaning/03-渲染通道与构建选型.md) §3.4。
