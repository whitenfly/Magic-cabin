// 临时诊断：把 monolith.js 的 IIFE 包装为具名函数并加 try/catch，
// 以便 V8 报告**真实出错行号**（模块顶层错误只会指向文件末尾）。
// 诊断完成后自动还原。
import fs from 'node:fs'
import path from 'node:path'

const ROOT = 'D:/FireflyQAQ/Project/FrontProj/Magic-cabin'
const TARGET = path.join(ROOT, 'src/cabin/legacy/monolith.js')
const SAVE = path.join(ROOT, '.cache/monolith.f02-current.js')

const mode = process.argv[2] || 'wrap'

if (mode === 'wrap') {
  const src = fs.readFileSync(TARGET, 'utf8')
  fs.writeFileSync(SAVE, src, 'utf8')

  let out = src.replace(/\n(\s*)\(function \(\) \{/, '\n$1function __cabinMain() {')
  // 末尾的 })();   →  } + try/catch
  out = out.replace(
    /\n(\s*)\}\)\(\);\s*$/,
    "\n$1}\n\ntry { __cabinMain() } catch (e) {" +
      " document.title = 'CABINERR|' + String(e && e.stack ? e.stack : e).replace(/\\s+/g, ' ').slice(0, 500); }\n",
  )
  if (out === src) {
    console.error('✗ 未匹配到 IIFE 结构，未做修改')
    process.exit(1)
  }
  fs.writeFileSync(TARGET, out, 'utf8')
  console.log('✓ 已包装为 __cabinMain() 并加 try/catch；原文件备份到 .cache/monolith.f02-current.js')
} else {
  fs.copyFileSync(SAVE, TARGET)
  console.log('✓ 已还原')
}
