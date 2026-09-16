/**
 * J4 段切片护栏 —— 守「段序 = 执行序」「legacy 已清零」「animate 是调度骨架」
 *
 * 来源：`J4.1` 建立、`J4.7` 改造。
 *
 * ## 为什么判据要跟着"形态"走，而不是被删掉
 *
 * `J4.1`–`J4.6` 期间 `legacy/monolith.js` 还在，判据是「**逐个引用**复算段间通信是否全走 `ctx`」
 * （`J3.1` 的教训：判据的粒度决定它能不能发现问题）。`J4.7` 把 `legacy/` 删掉之后，
 * **那条判据没有对象了** —— 但**它守的那件事还在**，只是换了形态：
 *
 * | 原来守的事 | 现在由谁守 |
 * |---|---|
 * | 段间通信全走 `ctx` | 每个段模块都必须是 `(ctx, app)` 函数，且不 import `legacy/**` |
 * | 段序 = 执行序 | `app/scene/installCabin.js` 里 21 次调用的**顺序必须等于段表顺序** |
 * | 剪切不是复制 | `legacy/` 必须不存在（阶段 DoD） |
 * | 25 处原地 `.tick` 清零 | `SceneLoop.js` 的 `animate()` 必须是**调度骨架**（≤ 60 行） |
 *
 * 判据换了，**强度没降**：前三条是"文件存在性 + 顺序"，比原来更难糊弄；
 * 第四条直接量 DoD 里写死的数字。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { SEGMENTS } from '../../scripts/oneoff/_j4-segments.mjs'

const ROOT = path.resolve(import.meta.dirname, '../..')
const CABIN = path.join(ROOT, 'src/cabin')
const INSTALL = path.join(CABIN, 'app/scene/installCabin.js')

/** 遍历 `src/cabin/**` 下的所有 .js */
function allJs(dir = CABIN) {
  const out = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...allJs(p))
    else if (e.isFile() && p.endsWith('.js')) out.push(p)
  }
  return out
}
const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/')

test('J4.7：legacy/ 已清零（阶段 DoD）', () => {
  assert.ok(!fs.existsSync(path.join(CABIN, 'legacy')), 'src/cabin/legacy 仍然存在 —— J4 的 DoD 是整目录消失')
})

test('J4：段序 = 执行序（installCabin.js 的调用顺序必须等于段表顺序）', () => {
  const src = fs.readFileSync(INSTALL, 'utf8')
  // 只认"顶层调用"形态：两个空格缩进 + `installXxx(ctx, app)`
  const called = [...src.matchAll(/^ {2}(install\w+)\(ctx, app\)$/gm)].map((m) => m[1])
  assert.ok(called.length > 0, 'installCabin.js 里一次 installXxx(ctx, app) 都没找到')
  const expected = SEGMENTS.map((s) => s.fn)
  assert.deepEqual(
    called,
    expected,
    `调用顺序与段表不符：\n  实际 ${called.join(' → ')}\n  段表 ${expected.join(' → ')}\n` +
      '（rng 调用顺序 / scene.add 顺序 / 光源槽序都压在段序上，换序 = 画面必变）',
  )
})

test('J4：每个段都有模块、都导出 (ctx, app)、都不 import legacy/**', () => {
  const problems = []
  for (const seg of SEGMENTS) {
    const p = path.join(CABIN, seg.module)
    if (!fs.existsSync(p)) { problems.push(`段 ${seg.id} 的模块不存在：${seg.module}`); continue }
    const src = fs.readFileSync(p, 'utf8')
    if (!new RegExp(`export function ${seg.fn}\\s*\\(ctx`).test(src)) {
      problems.push(`段 ${seg.id}（${seg.module}）没有导出 ${seg.fn}(ctx, …)`)
    }
    if (/(?:from|import)\s*['"][^'"]*legacy\//.test(src)) problems.push(`段 ${seg.id}（${seg.module}）import 了 legacy/**`)
  }
  assert.deepEqual(problems, [], problems.join('\n'))
})

test('J4.7：animate() 是调度骨架（≤ 60 行），更新顺序由调度器决定', () => {
  const found = []
  for (const p of allJs()) {
    const text = fs.readFileSync(p, 'utf8')
    if (!/\bfunction animate\s*\(/.test(text)) continue
    const sf = ts.createSourceFile(p, text, ts.ScriptTarget.ESNext, true, ts.ScriptKind.JS)
    const visit = (n) => {
      if (ts.isFunctionDeclaration(n) && n.name?.text === 'animate' && n.body) {
        const lines =
          sf.getLineAndCharacterOfPosition(n.getEnd()).line - sf.getLineAndCharacterOfPosition(n.getStart()).line + 1
        found.push({ file: rel(p), lines, text })
      }
      ts.forEachChild(n, visit)
    }
    visit(sf)
  }
  assert.equal(found.length, 1, `animate() 应当恰好有一处，实际 ${found.length} 处：${found.map((f) => f.file).join(', ')}`)
  assert.ok(found[0].lines <= 60, `animate() 有 ${found[0].lines} 行 —— DoD 要求 ≤ 60 行（${found[0].file}）`)
  // 骨架的判据：`animate()` 自己不写更新逻辑，只把这一帧交给 `tickOnce()`；
  // 而 `tickOnce()`（定义在装配骨架里）必须把这一帧交给**调度器**。
  assert.match(found[0].text, /tickOnce\(\)/, 'animate() 没有调用 tickOnce() —— 主循环被改写了？')
  assert.match(
    fs.readFileSync(INSTALL, 'utf8'),
    /scheduler\.update\(clock\.dt, clock\.now\)/,
    'installCabin.js 里没有 `tickOnce() { scheduler.update(clock.dt, clock.now) }` —— 更新顺序不是调度器决定的',
  )
})

test('J4.7：原地 .tick(dt, time) 已清零（25 处 = 22 处 tickOnce + 3 处装饰循环）', () => {
  const problems = []
  for (const p of allJs()) {
    // 允许出现在注释里（本项目用注释记录"清零"这件事）
    const code = fs
      .readFileSync(p, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
    const n = (code.match(/\.tick\(dt, time\)/g) || []).length
    if (n) problems.push(`${rel(p)}：${n} 处`)
  }
  // ★ 两处**允许**，而且是必须区分的两件事 —— "原地 tick"这个词只适用于后者之外的那些：
  //   · `app/scene/FrameBody.js`   —— 帧任务的**函数体**：由调度器按登记顺序驱动
  //     （它们原来正是 `tickOnce()` 里那 22 处原地调用，`J4.7` 把 tickOnce 拆成帧任务时
  //      把这些调用一起带了进去）；
  //   · `world/floor2/install.js`  —— `updateNewDecor()` **装饰循环**里的 3 处
  //     （`pictureApi` / `mirrorApi` / `junkApi`）。它本来就是与主循环并列的独立刷新，
  //     原实现里由 `animate()` 在 `manual` 分支显式调用、`realtime` 下由自己的 rAF 驱动 ——
  //     `J4.7` 一个字没动它。
  //   22 + 3 = 25，正是路线图 C4 记的那个数字。
  const ALLOW = ['src/cabin/app/scene/FrameBody.js', 'src/cabin/world/floor2/install.js']
  const illegal = problems.filter((p) => !ALLOW.some((a) => p.startsWith(a)))
  assert.deepEqual(illegal, [], `除 FrameBody.js（帧任务体）与 floor2/install.js（装饰循环）外不应再有 .tick(dt, time)：\n  ${illegal.join('\n  ')}`)
})
