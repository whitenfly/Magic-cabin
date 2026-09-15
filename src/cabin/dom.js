/**
 * 魔法小屋 —— UI DOM（原 index.html 第 753–835 行原样搬迁）
 *
 * 这些节点的 id / class 被实现代码大量依赖（`getElementById`），
 * **不得改名、不得改变结构**，否则交互会静默失效。
 *
 * 之所以做成模块常量而不是写死在 HTML 里：
 *   UI 节点必须在 legacy 实现执行**之前**存在于 DOM 中。
 *   由 JS 注入可以保证这个顺序（HTML 里写死则依赖解析顺序，易碎）。
 *
 * ── `J2.5` 的改动：设置控件交给 schema 生成 ────────────────────────────────
 *
 * 原先散在这里的**设置类控件**（完整房屋开关、随机天气开关、流速滑杆、
 * 音效开关与音量、三个视角按钮）已删除，改为 `<div data-setting-group="…">` 锚点 ——
 * 控件由 `cabin/systems/ui/SettingsForm.js` 按 `src/config/settings.config.js`
 * **自动生成**并自动持久化（验收 `CF2`）。
 *
 * | 分组锚点 | 原来的手写节点 |
 * |---|---|
 * | `data-setting-group="house"` | `#houseToggle` |
 * | `data-setting-group="weather"` | `#wxRandToggle` |
 * | `data-setting-group="time"` | `#speedSlider` |
 * | `data-setting-group="audio"` | `#sfxToggle` + `#sfxSlider` |
 * | `data-setting-group="view"` | `#viewFixedBtn` + `#viewTpBtn` + `#viewFpBtn` |
 *
 * ⚠️ **这些 id 仍然存在**（由生成器赋值，取自 `settings.config.js` 的 `domId`/`domIds`），
 * 因为 `legacy/monolith.js` 还在按 id 取节点。`J4` 搬完 `ui` 之后这些兼容字段应当移除。
 *
 * **留在本文件里的都"不是设置项"**：天气选择（`#wxChips`）、时刻滑杆（`#timeSlider`）
 * 是"当前状态"不是"持久化偏好"；魔法槽位、重置按钮、关于区同理。
 *
 * `#settingsAuto` 是给"schema 里有、而本文件里没有锚点"的分组准备的落点
 * （模块自己的配置项走这条路，仍然零 HTML 改动）。
 *
 * F3 阶段起，这些节点会逐步改由 src/cabin/systems/ui/ 动态创建，
 * 届时本文件会被删除。
 */
export const UI_HTML = `
    <button id="menuDot">●</button>
    <div id="menuPanel">
        <div class="title">菜单</div>
        <div class="sub">房 屋</div>
        <div data-setting-group="house"></div>
        <div class="sep"></div>
        <div class="sub">天 气</div>
        <div id="wxChips"></div>
        <div data-setting-group="weather"></div>
        <div class="sep"></div>
        <div class="sub">时 间</div>
        <div class="sliderRow"><span class="slbl">时刻</span><input type="range" id="timeSlider" min="0" max="24"
                step="0.05" value="10"></div>
        <div data-setting-group="time"></div>
        <div class="sep"></div>
        <div class="sub">音 效</div>
        <div data-setting-group="audio"></div>
        <div class="sep"></div>
        <div class="sub">魔 法</div>
        <div id="spellSlots">
            <div class="slot on" id="slot1" title="空手 · 默认状态"><span class="ico"></span><span class="kb">1 空手</span>
            </div>
            <div class="slot" id="slot2" title="魔杖 · 可释放魔法"><span class="ico">🪄</span><span class="kb">2 魔杖</span>
            </div>
            <div class="slot empty"></div>
            <div class="slot empty"></div>
        </div>
        <div class="sep"></div>
        <div class="sub">视 角</div>
        <div data-setting-group="view"></div>
        <div class="sep"></div>
        <div class="viewBtn" id="resetBtn">重置史莱姆位置</div>
        <div class="sep"></div>
        <div class="sub">关 于</div>
        <!-- ★ 作者信息 ★ -->
        <div class="aboutBox">
            <div class="authorName">作者：YIBI2333</div>
            <a class="aboutLink" href="https://yibi2333.fun" target="_blank" rel="noopener">个人网站 ↗</a>
            <a class="aboutLink" href="https://github.com/YIBI2333" target="_blank" rel="noopener">GitHub ↗</a>
            <a class="aboutLink" href="https://space.bilibili.com/312607590" target="_blank" rel="noopener">B站 ↗</a>

        </div>
        <div id="settingsAuto"></div>
    </div>
    <div id="signEditor">
        <div class="lbl">✏️ 编辑路牌文字</div><input id="signInput" maxlength="10" value="魔女小屋"><button
            id="signOk">确定</button>
    </div>
    <div id="noteEditor">
        <div class="lbl">📝 便签</div><input id="noteInput" maxlength="10" value=""><button id="noteOk">确定</button>
    </div>
    <div id="picEditor">
        <div class="lbl">🖼️ 编辑画像链接</div><input id="picInput" maxlength="500" placeholder="输入图片链接"><button
            id="picOk">确定</button>
    </div>
    <div id="clock">10:00 · 晴</div>
    <div id="hint"></div>
    <div id="crosshair"></div>
    <div id="lockTip">点击画面锁定鼠标 · Esc 退出</div>
    <div id="flashOverlay"></div>
    <div id="joyZone"></div>
    <div id="joyBase">
        <div id="joyKnob"></div>
    </div>
    <div class="touchBtn" id="btnSprint">疾跑</div>
    <div class="touchBtn" id="btnJump">跳</div>
    <div class="touchBtn" id="btnAct">交互</div>
    <div class="touchBtn" id="btnCast">施法</div>
`

/** 把 UI DOM 插入 body（必须在 legacy 实现执行前调用） */
export function mountUI(root = document.body) {
  const holder = document.createElement('div')
  holder.innerHTML = UI_HTML
  const frag = document.createDocumentFragment()
  while (holder.firstChild) frag.appendChild(holder.firstChild)
  root.insertBefore(frag, root.firstChild)
}
