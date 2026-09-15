/**
 * 便签编辑器（二楼计划板） —— 从 `legacy/monolith.js` 搬出的整段（noteEditor）
 *
 * 来源：`J4` 段切片（段表见 `scripts/oneoff/_j4-segments.mjs`）。
 * 段内代码**逐字未改**，只做了三件事：包成函数、补 import、把跨段通信交给 `ctx`。
 * 因此这个文件的正确性判据与搬迁前完全一致：像素逐字节零差异。
 *
 * @param {object} ctx 段间通信载体（见 `installCabin` 的 `__J4_CTX__`）
 * @param {object} app 应用内核 —— 段里用到的 `registry`/`bus`/`scheduler`/`store` 从这里解构
 */
export function installNoteEditor(ctx, app) {
            // ↓ J4 段导出（noteEditor）：本段函数声明挂到 ctx（借提升，段内任何位置都可见）
            ctx.applyNote = applyNote;
            const noteInput = document.getElementById('noteInput');
            ctx.noteInput = noteInput;
            const noteEditor = document.getElementById('noteEditor');
            ctx.noteEditor = noteEditor;
            function applyNote() {
                ctx.notes[ctx.noteEditing].txt = noteInput.value.trim() || '...';
                ctx.drawNote(ctx.noteEditing);
                noteEditor.classList.remove('show');
                noteInput.blur();
                ctx.SND.play('chim');
            }
            document.getElementById('noteOk').addEventListener('click', applyNote);
            noteInput.addEventListener('keydown', e => {
                if (e.key === 'Enter') applyNote();
                if (e.key === 'Escape') {
                    noteEditor.classList.remove('show');
                    noteInput.blur();
                }
                e.stopPropagation();
            });


            /* ========================================================== */
            /* ============ 二楼顶中央魔法吊灯 ============ */
            /* ========================================================== */
}
