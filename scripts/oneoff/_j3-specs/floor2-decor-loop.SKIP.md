# 跳过：`floor2/decor-loop`（18.17 新增装饰统一刷新 / 独立动画循环）+ 便签编辑器 —— `J3` / B5

> 本目录 `*.json` 才会被 `_j3-apply.mjs` 读；这是一份**说明**（`.md`），故意不写 spec。
> 结论：**本件不是"物件"，不能也不该搬** —— 依据任务书「`18.17` 新增装饰统一刷新（这是装饰循环本身，
> 多半不能搬）」。本文件把「为什么」写清楚，供 `J4` 收主循环时当输入。

## 1. 它是什么（写作时 L4217–L4245 一带）

```js
            /* 18.17 新增装饰统一刷新（独立动画循环） */
            /* ========================================================== */
            function updateNewDecor(time, dt) {
                drawClock();                       // 18.12
                if (picState.img && …) { … }       // 18.13（本批已搬 → pictureApi.tick）
                mirrorApi.tick(dt, time);          // 18.14（B4 已搬）
                junkApi.tick(dt, time);            // 18.16（B3 已搬）
            }
            let decorLastT = 0;
            let mirrorDirtyT = 0;
            // F0.3：装饰循环（时钟 / 镜子涟漪 / 挂画 GIF / 纸箱）
            //   realtime：沿用 performance.now()，行为与改动前完全一致
            //   manual  ：读 clock.now / clock.dt，跟随手动步进（由主循环驱动，见 tickOnce 末尾）
            (function decorLoop() {
                requestAnimationFrame(decorLoop);
                if (clock.mode === 'manual') return;   // 手动模式由 tickOnce 负责调用
                const t = performance.now() * 0.001;
                const dt = Math.min(0.05, Math.max(0.001, t - decorLastT));
                decorLastT = t;
                updateNewDecor(t, dt);
            })();
```

## 2. 为什么它不是物件（三条，逐条对应 `defineProp` 的字段）

| 原因 | 说明 |
|---|---|
| **它没有几何** | `defineProp.build` 是必填项，而 `updateNewDecor` 一行 `scene.add` 都没有 —— 它是**调度器**，不是陈设 |
| **它有两条驱动路径** | realtime 由自己的 `requestAnimationFrame` 自驱动；manual 由 `tickOnce()` 末尾调用（`if (clock.mode === 'manual') updateNewDecor(time, dt);`）。`UpdateScheduler` 在 `J3` 期间**不执行**，搬进 `update` 等于把这条循环拔掉 ⇒ 时钟 / 挂画 GIF **直接停摆** |
| **`clock` 不在 `ctx` 里** | `decorLoop` 读 `clock.mode`、`updateNewDecor` 的 manual 路径读 `clock.now/clock.dt`（monolith L664–695 的 ctx 清单里没有 `clock`） |

另外，**`let decorLastT = 0;` / `let mirrorDirtyT = 0;` 两行必须原地留着** ——
`scripts/verify-f03.mjs` 的第 ⑥ 项断言 `let decorLastT = 0;` / `let mirrorDirtyT = 0;` /
`// F0.3：装饰循环…` 三行**连续存在**（它靠这个反向还原出 `F0.3` 之前的版本）。
删掉它们静态门禁立刻变红（`mirrorDirtyT` 已迁进 `state`，此后它是死变量，但**必须留着**）。

## 3. 便签编辑器（L4246 起，同类）

```js
            /* ============ 便签编辑器（二楼计划板） ============ */
            const noteInput = document.getElementById('noteInput');
            const noteEditor = document.getElementById('noteEditor');
            function applyNote() {
                notes[noteEditing].txt = noteInput.value.trim() || '...';
                drawNote(noteEditing);
                …
            }
            document.getElementById('noteOk').addEventListener('click', applyNote);
            noteInput.addEventListener('keydown', e => { … });
```

它是**功能层**（DOM 编辑器），却直接读 18.8 计划板的私有量 `notes` / `noteEditing` / `drawNote`
—— 这正是 `J3` 硬约束 4 描述的情形。归属应留给 `J4`：由 `features/**` 经 `mounts` 认领
`floor2/board` 的 `parts`（不变量 `N3`），而不是让 monolith 伸手进物件。详见
[`floor2-board.SKIP.md`](./floor2-board.SKIP.md) §2②。

## 4. `J4` 收口时的输入（本文件的价值）

`J4` 把主循环收成调度骨架时，需要回答三个问题 —— 本文件给出已核实的现状：

1. **装饰循环的两条路径要合并成一条**：realtime 的 rAF 与 manual 的 `tickOnce` 末尾调用，
   目前靠 `if (clock.mode === 'manual') return;` 分流。合并后 `updateNewDecor` 应当变成
   `scheduler` 上的一个 `tier: 'idle'` 任务。
2. **节流语义要保住**：`decorLastT` 让 realtime 的 `dt` 来自 `performance.now()` 差值（而非
   `clock.dt`），`mirrorDirtyT` 让镜面每 0.12 秒重绘一次、挂画每 0.1 秒重绘一次。这三处节流
   都不是「每帧都做」，收口时不能简单改成无条件每帧执行（会改变 canvas 重绘次数）。
3. **本批已把 4 件中的 3 件搬走了**（镜子 B4 / 纸箱 B3 / 挂画 B5），`updateNewDecor` 里现在
   只剩 `drawClock();`（18.12，SKIP，见 [`floor2-magic-clock.SKIP.md`](./floor2-magic-clock.SKIP.md)）
   一行是"原生的" —— 收口时那 3 行 `xxxApi.tick(dt, time);` 就是调度器接管后要删掉的东西。
