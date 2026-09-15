# cabin/systems

> **占位目录** —— 尚未实现。本文档说明它将来放什么、依赖谁、由哪个阶段填充。
> 填充阶段：**`J2`（交互与音频等基础设施）→ `J4`（player / weather / magic / ui）**。
> 见 [`docs/BuildPlaning/01-完善路线图.md`](../../../docs/BuildPlaning/01-完善路线图.md) §3。

小屋系统层

| 子目录 | 计划文件 | 来源（monolith.js 内） | 阶段 |
|---|---|---|---|
| `systems/interaction/` | `InteractionSystem.js` `types.js` `HintUI.js` | 原 1268–1272、8254–8274、8316 | **J2** |
| `systems/audio/` | `AudioSystem.js` | 原 851–870 | J4 |
| `systems/player/` | `Slime.js` `PlayerController.js` `collision.js` `Input.js` | 原 6937–6960、8206–8246、8276–8339 | J4 |
| `systems/weather/` | `WeatherSystem.js` `sky.js` `precip.js` `clouds.js` `stars.js` `environment.js` | 原 8378–8855 | J4 |
| `systems/magic/` | `Wand.js` `spellArray.js` `explosion.js` `BlastSequence.js` | 原 6962–8205 | J4 |
| `systems/ui/` | `MenuPanel.js` **`SettingsForm.js` ✅** `InteractTargetList.js` `editors/` | 原 752–835、660–748、8323–8336 | J4（`SettingsForm` 已在 **`J2.5`** 落地） |

> ✅ **`systems/ui/SettingsForm.js`（`J2.5` 已落地）**：由 `src/config/settings.config.js` 的
> **schema 自动生成**设置面板控件并自动持久化 —— "加一个配置项 = 改 1 个文件 + 加 1 个字段"
> 由 `pnpm verify:cf` 的 `CF2` 守着。它只往菜单里的分组锚点 `[data-setting-group="…"]` **填控件**，
> 分组的位置与标题仍手写在 `cabin/dom.js`（那里还夹着天气 chips、时刻滑杆、魔法槽位 ——
> 它们不是持久化设置）。`MenuPanel.js` / `InteractTargetList.js` / `editors/` 仍属 `J4`。
>
> ⚠️ 迁移期兼容：生成的控件沿用原 id（`houseToggle` / `sfxSlider` / `viewXxxBtn` …），
> 因为 `legacy/monolith.js` 还在按 id 取节点；`J4` 搬完 `ui` 后这些 `domId` 应当移除。

**三个阻塞项**（不做则后续模块只能做最朴素版本）：

- **`CameraRig`**（`cabin/core/render/`）—— 6 个模块的推移转场 + `J6` 的平面视角的前提
- **统一 `Interactable` 契约**（`cabin/systems/interaction/`）—— 现状 `regMagic`(64 处) + `interactables`(9 条) + 镜子自建射线**三套并行**；
  不统一则博客模块无法在默认固定视角下点开（**风险 `R1`，本项目最大的可用性坑**）
- **持久化**（`cabin/app/store.js`）—— 小屋现状零持久化，刷新即丢

## 交互契约的两条硬要求

1. **`mode` 必须支持 `both`**：`aim`（准星射线，第一人称/触屏用）+ `proximity`（近距判定，固定视角/第三人称用）。
   每个模块的主入口都必须同时有这两条（验收 `BB2b`）。
2. **`label` 必须语义化**：现状 62 处 `regMagic` 的默认提示是 `aimLabel || '交互'`（原 L8268），
   导致大量物件在准星上只显示"交互"两字。新契约要求**每一处都有语义化文案**，且优先用引导性措辞
   （"看看有哪些主题"而非"交互"）（验收 `BB2`）。

## 唯一文案出口

`systems/ui/HintUI.js` 是**提示文案的唯一出口**。现状 `aimRay()` 与 `updateInteractHint()` 两份实现
导致文案与判定分散；重构后只有一处。同时**面向用户的文案不得散落在更新逻辑里**（不变量 `N10`）。
