/**
 * J0.6 一次性脚本：**冻结 J0.4 完成态的快照**
 * ============================================================================
 * 为什么需要它：`scripts/verify-f04.mjs` 的判据是"把 J0.4 的改动反向还原后，
 * 应与 **F0.3 完成态的快照**逐字节一致"。J0.6 又改了 `monolith.js`（新增渲染统计钩子），
 * 所以链条多了一环：
 *
 *     after-f03  --J0.4-->  after-j04  --J0.6-->  当前文件
 *     verify-f04 验证第二段      verify-f06 验证第三段
 *
 * 正常情况下 `after-j04` 应该在**动 J0.6 之前**复制一份。本次是事后补：
 * 拿当前文件**撤销 J0.6 的改动**，就得到 J0.4 完成态。
 *
 * 自检（脚本会自己跑）：`undoJ04(undoJ06(当前)) === after-f03`
 * —— 若一致，说明两条撤销规则都是精确的，快照可信。
 *
 * 用法：`node scripts/oneoff/_j06-freeze.mjs`
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const TARGET = path.join(ROOT, 'src/cabin/legacy/monolith.js')
const AFTER_F03 = path.join(ROOT, '.cache/monolith.after-f03.js')
const AFTER_J04 = path.join(ROOT, '.cache/monolith.after-j04.js')

const N = (s) => s.replace(/\s+$/, '')
const norm = (s) =>
  s
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{2,}/g, '\n')
    .replace(/\s+$/, '')

/** 撤销 J0.4 的 4 处改动（与 scripts/verify-f04.mjs 的 undoJ04 保持一致） */
function undoJ04(text) {
  let t = text
  const must = (name, fn) => {
    const before = t
    t = fn(t)
    if (t === before) throw new Error(`反向还原失败：${name}`)
  }
  must('testCam 声明', (s) =>
    s.replace(
      /\n[ \t]*\/\/ J0\.4：截图回归的测试机位覆盖（六元数组 \[px,py,pz,lx,ly,lz\]）。\n[ \t]*\/\/       仅 manual 模式由宿主设置；null = 不覆盖 —— realtime 下恒为 null，画面与改动前完全一致。\n[ \t]*let testCam = null;/,
      '',
    ),
  )
  must('相机覆盖', (s) =>
    s.replace(
      /\n[ \t]*\/\/ J0\.4：测试机位覆盖 —— 固定相机位用于截图回归（realtime 下 testCam 恒为 null，不生效）\n[ \t]*if \(testCam\) \{ camera\.position\.set\(testCam\[0\], testCam\[1\], testCam\[2\]\); camera\.lookAt\(testCam\[3\], testCam\[4\], testCam\[5\]\); \}\n/,
      '',
    ),
  )
  must('测试机位钩子', (s) =>
    s.replace(
      /\n[ \t]*\/\/ J0\.4：测试机位设置[\s\S]*?\n[ \t]*return testCam \? testCam\.slice\(\) : null;\n[ \t]*\};/,
      '',
    ),
  )
  must('完整小屋钩子', (s) =>
    s.replace(
      /\n[ \t]*\/\/ J0\.4：完整小屋开关[\s\S]*?\n[ \t]*return fullHouse;\n[ \t]*\};/,
      '',
    ),
  )
  return t
}

/** 撤销 J0.6 的渲染统计钩子（新增的一整块） */
function undoJ06(text) {
  const re = /\n\n[ \t]*\/\/ J0\.6：渲染统计钩子[\s\S]*?\n[ \t]*\}\n(?=[ \t]*addEventListener\('resize')/
  if (!re.test(text)) throw new Error('反向还原失败：未找到 J0.6 的渲染统计钩子块')
  return text.replace(re, '\n')
}

const cur = fs.readFileSync(TARGET, 'utf8')
const afterJ04 = undoJ06(cur)

// ── 自检：再撤销 J0.4，应当回到 F0.3 完成态 ──
if (!fs.existsSync(AFTER_F03)) {
  console.error(`✗ 缺少 F0.3 快照：${path.relative(ROOT, AFTER_F03)}（无法自检）`)
  process.exit(2)
}
const backToF03 = undoJ04(afterJ04)
const want = N(fs.readFileSync(AFTER_F03, 'utf8'))
const same = norm(backToF03) === norm(want)

console.log('')
console.log('  J0.6 · 冻结 J0.4 完成态快照')
console.log('  ──────────────────────────────────────────')
console.log(`  当前文件        ${cur.length} 字符`)
console.log(`  撤销 J0.6 后    ${afterJ04.length} 字符  （J0.6 净增 ${cur.length - afterJ04.length}）`)
console.log(`  再撤销 J0.4 后  ${backToF03.length} 字符  vs after-f03 ${want.length} 字符`)
console.log(`  自检            ${same ? '✓ 与 F0.3 快照一致（两条撤销规则都精确）' : '✗ 与 F0.3 快照不一致'}`)

if (!same) {
  const a = norm(backToF03)
  let i = 0
  while (i < Math.min(a.length, want.length) && a[i] === want[i]) i++
  console.log('     首个差异位置:', i)
  console.log('     快照:', JSON.stringify(want.slice(Math.max(0, i - 70), i + 70)))
  console.log('     还原:', JSON.stringify(a.slice(Math.max(0, i - 70), i + 70)))
  console.error('\n✗ 自检失败，拒绝写入快照（先修撤销规则）\n')
  process.exit(1)
}

if (fs.existsSync(AFTER_J04)) {
  const prev = fs.readFileSync(AFTER_J04, 'utf8')
  if (prev === afterJ04) {
    console.log(`  · 快照已存在且内容相同，无需重写`)
  } else {
    console.log(`  · 快照已存在但内容不同 —— 已覆盖（原 ${prev.length} → 新 ${afterJ04.length} 字符）`)
  }
} else {
  console.log('  · 新建快照')
}
fs.writeFileSync(AFTER_J04, afterJ04, 'utf8')
console.log(`  ✓ ${path.relative(ROOT, AFTER_J04).replace(/\\/g, '/')}`)
console.log('')
