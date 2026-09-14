// 验证浏览器中页面执行完毕后的运行时 DOM 状态
//
// 用法：
//   1) 先用 headless 浏览器导出执行后的 DOM：
//        msedge --headless=new --dump-dom --virtual-time-budget=25000 \
//               http://127.0.0.1:5173/index.html > _shots/dom-after.html
//   2) node scripts/verify-runtime.mjs [dom 文件路径]
//
// 说明：受限沙箱下 headless 浏览器需放宽权限（其多进程架构依赖命名管道）；
//       本脚本自身不需要任何特权。
import fs from 'node:fs'

const f = process.argv[2] || '_shots/dom-after.html'
if (!fs.existsSync(f)) {
  console.log(`缺少 ${f}（需先用 headless 浏览器执行 --dump-dom 导出）`)
  process.exit(1)
}
const d = fs.readFileSync(f, 'utf8')

let pass = 0
let fail = 0
const has = (re, label) => {
  const ok = re.test(d)
  console.log(`  ${ok ? '✓' : '✗'} ${label}`)
  ok ? pass++ : fail++
}

console.log('=== 运行时 DOM 验证（页面执行完毕后的状态）===')
has(/<canvas/i, 'canvas 已创建 → renderer 初始化成功')
has(/data-cabin="ready"/, 'boot 完成 → data-cabin="ready"')
has(/id="menuDot"/, 'UI DOM 注入：菜单按钮')
has(/id="menuPanel"/, 'UI DOM 注入：菜单面板')
has(/id="wxChips"/, 'UI DOM 注入：天气容器')
has(/id="spellSlots"/, 'UI DOM 注入：法术槽')
has(/id="joyZone"/, 'UI DOM 注入：触屏摇杆')
has(/id="timeSlider"/, 'UI DOM 注入：时间滑块')
has(/class="title">菜单</, '中文正常渲染（菜单）')
has(/晴天娃娃|魔女小屋|作者：YIBI2333|完整房屋/, '中文正常渲染（界面文案）')

const m = d.match(/<canvas[^>]*>/i)
console.log('\ncanvas 元素：')
console.log('  ' + (m ? m[0].slice(0, 200) : '（未找到）'))
console.log('DOM 总长度：' + d.length + ' 字符')

// UI 节点是否在 canvas 之前（与原实现的 DOM 顺序一致）
const iUi = d.indexOf('id="menuDot"')
const iCv = d.search(/<canvas/i)
if (iUi > -1 && iCv > -1) {
  const ok = iUi < iCv
  console.log(`  ${ok ? '✓' : '✗'} UI 节点位于 canvas 之前（与原实现 DOM 顺序一致）`)
  ok ? pass++ : fail++
}

console.log(`\n结果：${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
