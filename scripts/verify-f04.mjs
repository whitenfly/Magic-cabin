// J0.4（F0.4）专项验证
//
// 与 F0.2 / F0.3 同一个思路：把 J0.4 的改动**反向还原**后，应与 F0.3 完成时的快照
// （`.cache/monolith.after-f03.js`）**一致** —— 证明本次只加了"测试机位"这一件事，
// 没有触碰任何画面逻辑。这是"搬迁期零优化、零画面变化"在代码层面的证据。
//
// 完整可追溯链：
//   源文件(844–9807 行) --F1+F0.2--> after-f02 --F0.3--> after-f03 --J0.4--> after-j04 --J0.6--> 当前文件
//   verify-f02/migration 验证第一段；verify-f03 验证第二段；本脚本验证第三段；verify-f06 验证第四段。
//
// 另有两组**架构**断言（J0.4 的文件摆放要求）：
//   · 机位数据不得进入产品代码（不变量 N9：坐标只能来自 cabin/world/layout.js）
//   · 基线（tests/visual/baseline）必须与 manifest 的 sha256 自洽
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
// ⚠️ 检查对象是 **J0.4 完成态的快照**，不是当前文件 ——
//    J0.6 之后当前文件又多了「渲染统计钩子」，与 F0.3 快照已不再只差 J0.4 的改动。
//    当前文件与 after-j04 的关系由 scripts/verify-f06.mjs 验证。
const TARGET = path.join(ROOT, '.cache/monolith.after-j04.js')
const BOOT = path.join(ROOT, 'src/cabin/boot.js')
const SNAPSHOT = path.join(ROOT, '.cache/monolith.after-f03.js')
const POSES = path.join(ROOT, 'tests/visual/poses.js')
const BASELINE = path.join(ROOT, 'tests/visual/baseline')

const N = (s) => s.replace(/\s+$/, '')
let pass = 0
let fail = 0
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? '  → ' + detail : ''}`)
  ok ? pass++ : fail++
}

const cur = fs.readFileSync(TARGET, 'utf8')
const boot = fs.readFileSync(BOOT, 'utf8')

// `.cache/` 不进版本库：快照缺失时给出可执行的提示，而不是一句 ENOENT
if (!fs.existsSync(TARGET)) {
  console.error(`\n✗ 缺少 J0.4 快照：${path.relative(ROOT, TARGET).replace(/\\/g, '/')}`)
  console.error('  它是 J0.4 完成态的 monolith.js（含 testCam 与两个机位钩子，不含 J0.6 的渲染统计钩子）。')
  console.error('  重建：node scripts/oneoff/_j06-freeze.mjs（会对当前文件撤销 J0.6 并自检）\n')
  process.exit(2)
}
if (!fs.existsSync(SNAPSHOT)) {
  console.error(`\n✗ 缺少 F0.3 快照：${path.relative(ROOT, SNAPSHOT).replace(/\\/g, '/')}`)
  console.error('  它是 F0.3 完成态的 monolith.js（只有「时钟注入」，不含 testCam 与两个 J0.4 钩子）。')
  console.error('  重建：把 J0.4 之前的 monolith.js 复制过去，或对 after-j04 执行本脚本的 undoJ04() 后另存。\n')
  process.exit(2)
}

// ── 反向还原 J0.4 的三处改动 ──
function undoJ04(text) {
  let t = text
  const must = (name, fn) => {
    const before = t
    t = fn(t)
    if (t === before) throw new Error(`反向还原失败：${name}`)
  }

  // ① 删除 testCam 声明（连同其前两行注释）
  must('删除 testCam 声明', (s) =>
    s.replace(
      /\n[ \t]*\/\/ J0\.4：截图回归的测试机位覆盖（六元数组 \[px,py,pz,lx,ly,lz\]）。\n[ \t]*\/\/       仅 manual 模式由宿主设置；null = 不覆盖 —— realtime 下恒为 null，画面与改动前完全一致。\n[ \t]*let testCam = null;/,
      '',
    ),
  )

  // ② 删除 render 前的相机覆盖
  must('删除相机覆盖', (s) =>
    s.replace(
      /\n[ \t]*\/\/ J0\.4：测试机位覆盖 —— 固定相机位用于截图回归（realtime 下 testCam 恒为 null，不生效）\n[ \t]*if \(testCam\) \{ camera\.position\.set\(testCam\[0\], testCam\[1\], testCam\[2\]\); camera\.lookAt\(testCam\[3\], testCam\[4\], testCam\[5\]\); \}\n/,
      '',
    ),
  )

  // ③ 删除 manual 分支里的设置钩子
  must('删除设置钩子', (s) =>
    s.replace(
      /\n[ \t]*\/\/ J0\.4：测试机位设置 —— 截图回归用固定相机位（六元数组 \[px,py,pz,lx,ly,lz\]；null \/ 非法值 = 清除覆盖）。\n[ \t]*\/\/       与单帧钩子一样\*\*只在 manual 模式暴露\*\*，所以正常游玩路径上不存在这个接口。\n[ \t]*window\.__cabinSetTestCamera = function \(p\) \{\n[ \t]*testCam = Array\.isArray\(p\) && p\.length >= 6 && p\.slice\(0, 6\)\.every\(Number\.isFinite\) \? p\.slice\(0, 6\) : null;\n[ \t]*return testCam \? testCam\.slice\(\) : null;\n[ \t]*\};/,
      '',
    ),
  )

  // ④ 删除完整小屋开关钩子
  must('删除完整小屋钩子', (s) =>
    s.replace(
      /\n[ \t]*\/\/ J0\.4：完整小屋开关 —— 与菜单里的 houseToggle 按钮\*\*等效\*\*（只少了音效），同样只在 manual 模式暴露。\n[ \t]*\/\/       默认是剖切模式：省略的墙\/屋顶用虚线表示，便于从外面看到室内；\n[ \t]*\/\/       true = 显示完整外观（实墙 \+ 屋顶）。截图机位据此选择「看室内」还是「看整体」。\n[ \t]*window\.__cabinSetFullHouse = function \(on\) \{\n[ \t]*fullHouse = !!on;\n[ \t]*houseToggle\.classList\.toggle\('on', fullHouse\);\n[ \t]*fullHouseGroup\.visible = fullHouse;\n[ \t]*dashedGroup\.visible = !fullHouse;\n[ \t]*return fullHouse;\n[ \t]*\};/,
      '',
    ),
  )

  return t
}

console.log('\n【J0.4-1】反向还原后应与 F0.3 快照一致（证明只加了测试机位）')
{
  let restored = null
  try {
    restored = undoJ04(cur)
  } catch (e) {
    check('反向还原', false, e.message)
  }
  if (restored !== null) {
    const want = N(fs.readFileSync(SNAPSHOT, 'utf8'))
    const a = N(restored)
    const rawSame = a === want
    // 反向还原涉及删块，容易在空行上产生 ±1 行差异 —— 主判据用空白归一化，原始差异作为参考输出
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
    const added = cur.length - want.length
    console.log(`  · J0.4 净增 ${added} 字符（三处：声明 + 覆盖 + 钩子）`)
  }
}

console.log('\n【J0.4-2】机位钩子完整性（monolith）')
{
  check('testCam 声明存在且初值为 null', /let testCam = null;/.test(cur))
  check(
    '相机覆盖写在 renderer.render 之前',
    /if \(testCam\) \{ camera\.position\.set\([^)]*\); camera\.lookAt\([^)]*\); \}\s*\n\s*\n\s*renderer\.render\(scene, camera\);/.test(cur),
  )
  const manualAt = cur.indexOf("if (clock.mode === 'manual') {")
  const hookAt = cur.indexOf('window.__cabinSetTestCamera')
  check('设置钩子位于 manual 分支内（realtime 下不存在）', manualAt > 0 && hookAt > manualAt)
  check('钩子校验六个有限数（非法值 = 清除覆盖）', /Array\.isArray\(p\) && p\.length >= 6 && p\.slice\(0, 6\)\.every\(Number\.isFinite\)/.test(cur))

  // testCam 只应被"声明"与"钩子"写；任何第三处赋值都意味着有人绕过钩子改相机
  const assigns = (cur.match(/testCam\s*=/g) || []).length
  check('testCam 只有声明与钩子两处赋值', assigns === 2, `实际 ${assigns} 处`)
  const reads = (cur.match(/if \(testCam\)/g) || []).length
  check('只有一处读取 testCam（渲染前覆盖）', reads === 1, `实际 ${reads} 处`)

  // 完整小屋开关：必须与菜单按钮等价，且同样只在 manual 模式暴露
  const houseAt = cur.indexOf('window.__cabinSetFullHouse')
  check('完整小屋钩子存在', houseAt > 0)
  check('完整小屋钩子也在 manual 分支内', houseAt > manualAt)
  check(
    '完整小屋钩子与按钮点击等效（fullHouse / classList / 两个分组）',
    /fullHouse = !!on;[\s\S]{0,220}houseToggle\.classList\.toggle\('on', fullHouse\);[\s\S]{0,120}fullHouseGroup\.visible = fullHouse;[\s\S]{0,120}dashedGroup\.visible = !fullHouse;/.test(cur),
  )
  // 三层可见性必须成对：按钮与钩子都同时翻转这两个分组，不能只翻开不关虚线
  const pairCount = (cur.match(/dashedGroup\.visible = !fullHouse/g) || []).length
  check('虚线分组与完整分组的翻转在按钮与钩子中各一处', pairCount === 2, `实际 ${pairCount} 处`)
}

console.log('\n【J0.4-3】机位数据不进产品代码（架构 N9 + 目录边界）')
{
  check('src/cabin/app/poses.js 不存在（机位表属测试资产）', !fs.existsSync(path.join(ROOT, 'src/cabin/app/poses.js')))
  check('boot.js 不 import 任何机位表', !/^\s*import[^\n]*['"][^'"]*poses[^'"]*['"]/m.test(boot))
  check('boot.js 提供通用入口 applyTestCamera', /function applyTestCamera\(opts\)/.test(boot))
  check('boot.js 记录生效机位到 data-cabin-cam', /dataset\.cabinCam = camLabel/.test(boot))
  check('boot.js 提供小屋形态入口 applyHouse', /function applyHouse\(opts\)/.test(boot))
  check('boot.js 记录小屋形态到 data-cabin-house', /dataset\.cabinHouse = houseLabel/.test(boot))
  check('house 只接受 full / cutaway 两个取值', /\$\{opts\.house\}|opts\.house !== 'full' && opts\.house !== 'cutaway'/.test(boot))
  // 产品代码里不应出现"六个数一组的世界坐标"
  const coordLike = boot.match(/\[\s*-?\d+\.\d+\s*,\s*-?\d+\.\d+\s*,\s*-?\d+\.\d+/) || []
  check('boot.js 不含世界坐标常量', coordLike.length === 0, coordLike.length ? `发现 ${coordLike.length} 处` : '')

  check('机位表位于 tests/visual/poses.js', fs.existsSync(POSES))
  if (fs.existsSync(POSES)) {
    const posesSrc = fs.readFileSync(POSES, 'utf8')
    const names = [...posesSrc.matchAll(/^\s{2}'([a-z0-9-]+)':\s*\{/gm)].map((m) => m[1])
    check('机位表含 3 个机位', names.length === 3, names.join(' / '))
    check('机位表声明了坐标来源（可追溯）', /FLOOR_TOP|monolith\.js/.test(posesSrc))
    check('机位表记录了视场角换算依据（改坐标前必须读）', /fov|视场角|覆盖半宽/.test(posesSrc))
    check('机位表记录了"白墙不是渲染缺失"的排查结论', /不是渲染缺失|不要重复排查/.test(posesSrc))
  }
}

console.log('\n【J0.4-4】基线自洽（tests/visual/baseline）')
{
  const manifestFile = path.join(BASELINE, 'manifest.json')
  if (!fs.existsSync(manifestFile)) {
    check('基线 manifest 存在', false, '尚未建立：node tests/visual/capture.mjs --update')
  } else {
    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'))
    check('manifest 存在', true)
    check('观测条件为 1440×900', manifest.viewport?.width === 1440 && manifest.viewport?.height === 900)
    check('定格帧数为 120', manifest.frames === 120, String(manifest.frames))
    check('机位数为 3', manifest.poses?.length === 3, (manifest.poses || []).map((p) => p.name).join(' / '))
    check('记录了场景种子与随机摘要', Boolean(manifest.seed) && Boolean(manifest.sceneDigest))

    // 基线 PNG 必须与 manifest 的 sha256 自洽 —— 否则"判据"和"证据"已经脱节
    let allMatch = true
    for (const p of manifest.poses || []) {
      const f = path.join(BASELINE, p.file)
      if (!fs.existsSync(f)) {
        check(`基线文件存在：${p.file}`, false)
        allMatch = false
        continue
      }
      const buf = fs.readFileSync(f)
      const h = crypto.createHash('sha256').update(buf).digest('hex')
      const ok = h === p.sha256 && buf.length === p.bytes
      if (!ok) check(`sha256 / 字节数自洽：${p.file}`, false, `manifest ${p.sha256.slice(0, 12)}… ≠ 实际 ${h.slice(0, 12)}…`)
      allMatch = allMatch && ok
    }
    check('全部基线 PNG 与 manifest 的 sha256 一致', allMatch)

    // 三个机位必须有不同的哈希（否则"三个机位"其实看的是同一个画面）
    const hashes = new Set((manifest.poses || []).map((p) => p.sha256))
    check('三个机位的哈希互不相同（确实是三个画面）', hashes.size === (manifest.poses || []).length, `${hashes.size} 种`)
  }
}

console.log(`\n结果：${pass} 通过 / ${fail} 失败\n`)
process.exit(fail ? 1 : 0)
