// J0.6（F0.6）专项验证
//
// 与前几轮同一个思路：把 J0.6 的改动**反向还原**后，应与 J0.4 完成时的快照
// （`.cache/monolith.after-j04.js`）**一致** —— 证明本次只加了「渲染统计钩子」这一件事。
//
// 完整可追溯链：
//   源文件 --F1+F0.2--> after-f02 --F0.3--> after-f03 --J0.4--> after-j04 --J0.6--> 当前文件
//   verify-f02/migration ⟶ 第一段 ｜ verify-f03 ⟶ 第二段 ｜ verify-f04 ⟶ 第三段 ｜ 本脚本 ⟶ 第四段
//
// 另有两组**契约**断言：钩子必须"要了才给"（正常游玩路径上不存在），
// 以及性能基线（`docs/baseline.md` + `tests/e2e/baseline/perf.json`）自洽。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TARGET = path.join(ROOT, 'src/cabin/legacy/monolith.js')
const BOOT = path.join(ROOT, 'src/cabin/boot.js')
const SNAPSHOT = path.join(ROOT, '.cache/monolith.after-j04.js')
const PERF_JSON = path.join(ROOT, 'tests/e2e/baseline/perf.json')
const PERF_MD = path.join(ROOT, 'docs/baseline.md')
const PERF_MJS = path.join(ROOT, 'tests/e2e/perf.mjs')

const N = (s) => s.replace(/\s+$/, '')
let pass = 0
let fail = 0
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? '  → ' + detail : ''}`)
  ok ? pass++ : fail++
}

if (!fs.existsSync(SNAPSHOT)) {
  console.error(`\n✗ 缺少 J0.4 快照：${path.relative(ROOT, SNAPSHOT).replace(/\\/g, '/')}`)
  console.error('  重建：node scripts/oneoff/_j06-freeze.mjs\n')
  process.exit(2)
}

const cur = fs.readFileSync(TARGET, 'utf8')
const boot = fs.readFileSync(BOOT, 'utf8')

/** 反向还原 J0.6：删掉渲染统计钩子整块 */
function undoJ06(text) {
  const re = /\n\n[ \t]*\/\/ J0\.6：渲染统计钩子[\s\S]*?\n[ \t]*\}\n(?=[ \t]*addEventListener\('resize')/
  if (!re.test(text)) throw new Error('未找到渲染统计钩子块')
  return text.replace(re, '\n')
}

console.log('\n【J0.6-1】反向还原后应与 J0.4 快照一致（证明只加了渲染统计钩子）')
{
  let restored = null
  try {
    restored = undoJ06(cur)
  } catch (e) {
    check('反向还原', false, e.message)
  }
  if (restored !== null) {
    const want = N(fs.readFileSync(SNAPSHOT, 'utf8'))
    const a = N(restored)
    const rawSame = a === want
    const norm = (s) =>
      s
        .replace(/[ \t]+$/gm, '')
        .replace(/\n{2,}/g, '\n')
        .replace(/\s+$/, '')
    const normSame = norm(a) === norm(want)
    console.log(
      `  ${rawSame ? '✓' : '·'} 逐字节一致（参考）：${rawSame ? `${want.length} 字符` : `差异 ${Math.abs(a.length - want.length)} 字符`}`,
    )
    check('空白归一化后一致（证明只差空行）', normSame, normSame ? '逻辑完全一致' : '存在非空白差异')
    if (!normSame) {
      const na = norm(a)
      const nw = norm(want)
      let i = 0
      while (i < Math.min(na.length, nw.length) && na[i] === nw[i]) i++
      console.log('     首个差异位置:', i)
      console.log('     快照:', JSON.stringify(nw.slice(Math.max(0, i - 70), i + 70)))
      console.log('     还原:', JSON.stringify(na.slice(Math.max(0, i - 70), i + 70)))
    }
    console.log(`  · J0.6 净增 ${cur.length - want.length} 字符（一处：渲染统计钩子）`)
  }
}

console.log('\n【J0.6-2】钩子契约：要了才给，且与 manual 模式无关')
{
  check('钩子条件暴露（window.__CABIN_WANT_STATS）', /if \(window\.__CABIN_WANT_STATS\) \{/.test(cur))
  check('钩子函数名为 __cabinRenderStats', /window\.__cabinRenderStats = function \(\)/.test(cur))

  // 必须在 `if (clock.mode === 'manual') { ... } else { animate(0); }` 之后 ——
  // 性能要在 realtime（rAF 自驱动）下量，挂在 manual 分支里就永远拿不到稳态数据
  const manualBlockEnd = cur.indexOf('} else {\n                animate(0);\n            }')
  const hookAt = cur.indexOf('if (window.__CABIN_WANT_STATS)')
  check('钩子位于 manual / realtime 分支之外', manualBlockEnd > 0 && hookAt > manualBlockEnd)

  // 数据字段齐全（性能基线与回归判定依赖这些键）
  for (const key of ['calls', 'triangles', 'geometries', 'textures', 'sceneObjects']) {
    check(`钩子返回 ${key}`, new RegExp(`\\b${key}\\b`).test(cur))
  }
  check('数据源是 three 的 renderer.info', /const r = renderer\.info;/.test(cur))
  check('场景计数用 scene.traverse 递归统计', /scene\.traverse\(/.test(cur))

  // boot 侧：必须**在 legacy 实现执行之前**置位，否则钩子挂不上
  const wantFlagAt = boot.indexOf('window.__CABIN_WANT_STATS = true')
  const importAt = boot.indexOf("await import('./legacy/monolith.js')")
  check('boot.js 在加载实现之前置位标志', wantFlagAt > 0 && wantFlagAt < importAt)
  check('boot.js 由 ?stats=1 触发（正常游玩路径不置位）', /if \(opts\.stats\) \{/.test(boot) && /stats: params\.has\('stats'\)/.test(boot))
  check('boot.js 记录首屏耗时 data-cabin-ready-ms', /dataset\.cabinReadyMs = /.test(boot))
  check('boot.js 记录 boot 耗时 data-cabin-boot-ms', /dataset\.cabinBootMs = /.test(boot))
}

console.log('\n【J0.6-3】采样脚本与基线自洽')
{
  check('采集脚本存在', fs.existsSync(PERF_MJS))
  if (fs.existsSync(PERF_MJS)) {
    const src = fs.readFileSync(PERF_MJS, 'utf8')
    check('用 realtime 模式采样（不带 frames）', /\?deterministic=1&stats=1/.test(src) && !/frames=/.test(src.split('SPEC')[0]))
    check('采样前有预热', /WARMUP_MS/.test(src))
    check('多轮取中位数', /const median = /.test(src))
    check('定义了回归阈值表', /const THRESHOLDS = \{/.test(src))
    check('支持 --compare 与 --update', /--compare|has\('compare'\)/.test(src) && /--update|has\('update'\)/.test(src))
  }

  if (!fs.existsSync(PERF_JSON)) {
    check('基线 perf.json 存在', false, '尚未采集：pnpm baseline:perf')
  } else {
    const b = JSON.parse(fs.readFileSync(PERF_JSON, 'utf8'))
    check('基线 perf.json 存在', true)
    check('记录了采集环境（浏览器 / 渲染后端）', Boolean(b.env?.browser) && Boolean(b.env?.renderer))
    check('记录了视口与种子', b.viewport?.width === 1440 && b.viewport?.height === 900 && Boolean(b.env?.seed))
    check('记录了轮次（≥3）', Number(b.rounds) >= 3, `${b.rounds} 轮`)
    check('含渲染统计（calls / triangles / geometries / textures）',
      ['calls', 'triangles', 'geometries', 'textures'].every((k) => typeof b.render?.[k] === 'number'),
      `calls=${b.render?.calls} triangles=${b.render?.triangles}`)
    check('含首屏时间与 FPS 的中位数/区间',
      b.metrics?.readyMs?.median > 0 && b.metrics?.fps?.median > 0,
      `稳态首屏 ${b.metrics?.readyMs?.median}ms · FPS ${b.metrics?.fps?.median}`)
    check('冷启动单独记录（不计入稳态统计）',
      b.metrics?.cold?.readyMs > 0 && b.metrics?.cold?.fps > 0,
      `冷启动首屏 ${b.metrics?.cold?.readyMs}ms · FPS ${b.metrics?.cold?.fps}`)
    check('冷启动与稳态的渲染统计一致（同一场景，必然相同）',
      b.metrics?.cold?.calls === b.render?.calls && b.metrics?.cold?.triangles === b.render?.triangles,
      `cold calls=${b.metrics?.cold?.calls} vs 稳态 calls=${b.render?.calls}`)
    check('含采集质量自检（波动 / 趋势 / 判定）',
      b.quality && typeof b.quality.fpsSpread === 'number' && typeof b.quality.stable === 'boolean',
      `FPS 波动 ${((b.quality?.fpsSpread ?? 0) * 100).toFixed(0)}% · 趋势 ${((b.quality?.fpsTrend ?? 0) * 100).toFixed(0)}% · ${b.quality?.stable ? '稳定' : '不稳'}`)
    check('阈值表随基线一同记录', Boolean(b.thresholds?.calls))
    check('每轮采样可追溯', Array.isArray(b.samples) && b.samples.length === b.rounds)

    check('人类可读报告存在（docs/baseline.md）', fs.existsSync(PERF_MD))
    if (fs.existsSync(PERF_MD)) {
      const md = fs.readFileSync(PERF_MD, 'utf8')
      check('报告标注了"由脚本生成、不要手改"', /由 .*perf\.mjs --update\*?\*? 生成|不要手改/.test(md))
      check('报告说明了 FPS 的可比性限制', /仅同环境/.test(md))
      check('报告写出了判定阈值', /阈值/.test(md))
      check('报告的 calls 与 perf.json 一致', md.includes(String(b.render.calls)), `calls=${b.render.calls}`)
    }

    // 增量 profile：GPU 基线是**可选**产物，存在才校验 —— 它不得影响默认 profile 的任何文件
    const gpuJson = path.join(ROOT, 'tests/e2e/baseline/perf.gpu.json')
    if (fs.existsSync(gpuJson)) {
      const g = JSON.parse(fs.readFileSync(gpuJson, 'utf8'))
      check('GPU 增量基线：profile 标记正确', g.profile === 'gpu', String(g.profile))
      check('GPU 增量基线：记录了渲染后端', Boolean(g.env?.renderer))
      check(
        'GPU 增量基线：渲染统计与默认 profile 一致（跨环境应当相同）',
        g.render.calls === b.render.calls && g.render.triangles === b.render.triangles,
        `gpu calls=${g.render.calls} vs 默认 calls=${b.render.calls}`,
      )
      check('GPU 增量基线：独立报告文件存在', fs.existsSync(path.join(ROOT, 'docs/baseline.gpu.md')))
    } else {
      console.log('  · 未采集 GPU 增量基线（可选）：node tests/e2e/perf.mjs --gpu --rounds=5 --update')
    }
  }
}

console.log(`\n结果：${pass} 通过 / ${fail} 失败\n`)
process.exit(fail ? 1 : 0)
