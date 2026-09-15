// J2.5 配置编排层专项验证（验收 CF1–CF4）
// ============================================================================
// 退出码（沿用 verify-f04 / f06 的语义，见 scripts/_verify.mjs 头部）：
//   0 = 全部通过
//   1 = 有断言失败 → 让 `pnpm verify` 整体失败
//   2 = 前置缺失，明确跳过（本脚本**不**使用 —— 它只依赖版本库内的文件）
//
// ── 这份门禁守什么 ──────────────────────────────────────────────────────────
//
// `J2.5` 把"用户唯一需要看的目录"从 `src/config/` 落成了真东西：设置面板由 schema
// 生成、模块由开关表装配。但"生成"和"过滤"这类机制**最容易在后续阶段被绕过** ——
// 某天为了赶进度，一个模块把参数写死在代码里，或者加了个模块却忘了加开关。
// 这个脚本就是拦这件事的（风险 R29「配置层被绕过」/ R30「mapping 与实现漂移」）。
//
//   CF1  关掉任一模块 → 不加载、不注册、不报错          ← 用真实 `registerFeatures` 跑假清单
//   CF2  加一个配置项 = 改 1 个文件 + 加 1 个字段        ← 用真实 `planGroups` 跑注入的 schema
//   CF3  清单与文件一一对应；缺配置即失败                ← 静态清点 + 反例断言
//   CF4  `config/**` 不 import 实现；实现里没有硬编码清单 ← 静态 import 图
//
// ── 为什么用"跑一遍"而不是"读源码找字符串" ──────────────────────────────────
//
// CF1/CF2 的判据本身是**行为**（"未启用就不调用 load""新键自动进计划"）。
// 只 grep 源码看不出这两件事 —— 所以本脚本动态 import 真的模块、喂进构造的输入，
// 断言输出。CF3/CF4 才是静态的（它们问的是"文件在不在、import 指向哪"）。
//
// 用法：
//   node scripts/verify-cf.mjs        校验（不一致即 exit 1）
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

let pass = 0
let fail = 0
const failures = []

function check(label, ok, detail = '') {
  if (ok) {
    pass++
    console.log(`  ✓ ${label}${detail ? `  ${detail}` : ''}`)
  } else {
    fail++
    failures.push(label)
    console.log(`  ✗ ${label}${detail ? `  ${detail}` : ''}`)
  }
}

function section(title) {
  console.log('')
  console.log(`  ── ${title} ${'─'.repeat(Math.max(0, 52 - title.length))}`)
}

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')
const exists = (rel) => fs.existsSync(path.join(ROOT, rel))
const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/')

/** 递归列目录下所有文件（相对路径，posix 风格，稳定排序） */
function walk(dir, base = dir) {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full, base))
    else out.push(path.relative(base, full).replace(/\\/g, '/'))
  }
  return out
}

/**
 * ★ 先剥注释再扫 import。
 *   `verify-j15.mjs` 在这个坑上摔过一次：文件头那段"为什么不用 xxx"的说明文字
 *   被自己的门禁当成了真的 import。这里统一走这个函数。
 */
function codeOnly(src) {
  return src
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join('\n')
}

/** 取出一段代码里所有静态 import / 动态 import 的模块说明符 */
function specifiersOf(src) {
  const code = codeOnly(src)
  const statics = [...code.matchAll(/(?:from|import)\s+['"]([^'"]+)['"]/g)].map((m) => m[1])
  const dynamics = [...code.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1])
  return [...statics, ...dynamics]
}

/** 动态载入一个项目内模块（用 file:// URL，避免 Windows 路径被当协议） */
const load = (relPath) => import(pathToFileURL(path.join(ROOT, relPath)).href)

console.log('')
console.log('  J2.5 门禁 · 配置编排层（CF1–CF4）')
console.log('  ══════════════════════════════════════════════════════════════')

// ─────────────────────────────────────────────────────────────────────────────
// CF1 · 关掉任一模块 → 不加载、不注册、不报错
// ─────────────────────────────────────────────────────────────────────────────
section('CF-1 模块总开关：关掉一个模块 = 不加载、不注册、不报错（BB3 / CF1）')
{
  const { registerFeatures } = await load('src/blog/registry.js')

  /** 造一个"谁被 load 过"可观测的假模块清单（不碰真实 features 目录） */
  const makeManifests = (loaded) =>
    ['M01', 'M02', 'M03a'].map((id) => ({
      id,
      load: async () => {
        loaded.push(id)
        return { id, setup() {} }
      },
    }))

  {
    const loaded = []
    const registered = []
    const app = { register: (f) => registered.push(f.id) }
    const report = await registerFeatures(app, {
      manifests: makeManifests(loaded),
      config: { M01: true, M02: false, M03a: true },
    })
    check('未启用的模块**不被 load**（chunk 不会被请求）', !loaded.includes('M02'), `实际 load 了：${loaded.join(' / ')}`)
    check('未启用的模块**不被注册**', !registered.includes('M02'), `实际注册了：${registered.join(' / ')}`)
    check('启用的模块按清单顺序注册', registered.join(',') === 'M01,M03a', registered.join(' / '))
    check('报告如实列出关闭项', report.disabled.join(',') === 'M02', report.disabled.join(' / '))
  }

  {
    // "关掉**任一**模块"—— 逐个关一遍，每次都应当是干净的（不抛错、其余照常）
    const ids = ['M01', 'M02', 'M03a']
    let allOk = true
    let detail = ''
    for (const off of ids) {
      const loaded = []
      const app = { register: () => {} }
      const config = Object.fromEntries(ids.map((id) => [id, id !== off]))
      try {
        const report = await registerFeatures(app, { manifests: makeManifests(loaded), config })
        const ok = report.disabled.join(',') === off && !loaded.includes(off)
        if (!ok) {
          allOk = false
          detail = `关闭 ${off} 时：loaded=${loaded.join('/')} disabled=${report.disabled.join('/')}`
          break
        }
      } catch (err) {
        allOk = false
        detail = `关闭 ${off} 时抛错：${err.message}`
        break
      }
    }
    check('逐个关闭任一模块都不抛错、且只影响它自己', allOk, detail || `${ids.length} 种关法均通过`)
  }

  {
    // 清单里有、开关表里没有 → 必须**报错**而不是静默按关闭处理（04 §3.2 规则 4）
    let threw = ''
    try {
      await registerFeatures({ register: () => {} }, { manifests: makeManifests([]), config: { M01: true } })
    } catch (err) {
      threw = err.message
    }
    check('清单里的 id 缺开关时**构建失败**（可缺省即失败）', /没有开关/.test(threw), threw || '（没有抛错）')
  }

  {
    // 单个模块坏掉不该拖垮整局：记入 failed，其余继续
    const loaded = []
    const registered = []
    const manifests = [
      { id: 'M01', load: async () => ({ id: 'M01', setup() {} }) },
      { id: 'M02', load: async () => { throw new Error('故意炸一个') } },
      { id: 'M03a', load: async () => ({ id: 'M03a', setup() {} }) },
    ]
    const report = await registerFeatures(
      { register: (f) => registered.push(f.id) },
      { manifests, config: { M01: true, M02: true, M03a: true } },
    )
    check('单个模块装配失败不拖垮其余模块', registered.join(',') === 'M01,M03a' && report.failed.length === 1, report.failed.map((f) => f.id).join(' / ') || '无失败')
  }

  {
    // 真实开关表：默认关掉的模块（M12 / M14）确实在清单里但没被启用
    const mod = await load('src/config/modules.config.js')
    const offByDefault = Object.entries(mod.modulesConfig).filter(([, v]) => v === false).map(([k]) => k)
    check('开关表存在默认关闭的模块（关掉一条路是常态）', offByDefault.length > 0, offByDefault.join(' / '))
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CF2 · 加一个配置项 = 改 1 个文件 + 加 1 个字段；面板自动出现该控件
// ─────────────────────────────────────────────────────────────────────────────
section('CF-2 schema 驱动：加一项 = 改 1 个文件 + 加 1 个字段（CF2）')
{
  const { planGroups, formatSettingValue } = await load('src/cabin/systems/ui/SettingsForm.js')
  const { settingsSchema, SETTING_GROUPS, TIME_SCALE_CURVE } = await load('src/config/settings.config.js')
  const { displayConfig } = await load('src/config/display.config.js')

  {
    // ★ 核心判据：塞一个从未见过的键进去，它必须**自动**出现在计划里
    const injected = {
      ...settingsSchema,
      'test.brandNew': { type: 'boolean', default: true, group: 'audio', label: '新开关', hint: '由门禁注入' },
    }
    const plan = planGroups(injected, SETTING_GROUPS, displayConfig)
    const flat = plan.flatMap((g) => g.items.map((i) => i.key))
    check('新增一个字段 → 自动进入面板计划（无需改 HTML / CSS / 事件）', flat.includes('test.brandNew'), flat.join(' / '))
    check('新字段落在它声明所属的分组里', plan.find((g) => g.group === 'audio')?.items.some((i) => i.key === 'test.brandNew') === true)
  }

  {
    // 面板渲染器**不认识任何具体的键**：这才是"零 HTML 改动"能成立的原因
    const src = read('src/cabin/systems/ui/SettingsForm.js')
    const hardCoded = Object.keys(settingsSchema).filter((key) => codeOnly(src).includes(`'${key}'`) || codeOnly(src).includes(`"${key}"`))
    check('SettingsForm 里不出现任何具体设置键（不认识 view.mode 之类）', hardCoded.length === 0, hardCoded.join(' / ') || '零硬编码')
  }

  {
    // 分组必须与 displayConfig.panels 一一对应，否则"置 false 关掉一组"会静默失效
    const groupKeys = Object.keys(SETTING_GROUPS).sort()
    const panelKeys = Object.keys(displayConfig.panels).sort()
    check('SETTING_GROUPS 与 displayConfig.panels 的键一一对应', groupKeys.join(',') === panelKeys.join(','), `${groupKeys.join('/')} vs ${panelKeys.join('/')}`)

    const orphan = Object.entries(settingsSchema).filter(([, s]) => !(s.group in displayConfig.panels)).map(([k]) => k)
    check('每个设置项的 group 都在 panels 里', orphan.length === 0, orphan.join(' / ') || '零孤儿')

    const noLabel = Object.entries(settingsSchema).filter(([, s]) => !SETTING_GROUPS[s.group]).map(([k]) => k)
    check('每个分组都有中文显示名（SETTING_GROUPS）', noLabel.length === 0, noLabel.join(' / ') || '零缺失')
  }

  {
    // 每项的形状必须完整 —— 缺 min/max 的 number、缺 values 的 enum 都会在生成控件时炸
    const bad = []
    for (const [key, s] of Object.entries(settingsSchema)) {
      if (!s.label) bad.push(`${key}:缺 label`)
      if (s.type === 'number' && !(Number.isFinite(s.min) && Number.isFinite(s.max) && Number.isFinite(s.step))) bad.push(`${key}:number 缺 min/max/step`)
      if (s.type === 'enum' && !(Array.isArray(s.values) && s.values.includes(s.default))) bad.push(`${key}:enum 的 default 不在 values 里`)
      if (s.type === 'boolean' && typeof s.default !== 'boolean') bad.push(`${key}:boolean 的 default 不是布尔`)
    }
    check('每个设置项的形状完整（label / 范围 / 默认值）', bad.length === 0, bad.join(' / ') || `${Object.keys(settingsSchema).length} 项全合格`)
  }

  {
    // 分组可见性置 false → 整组不渲染（对齐 Firefly 的 displaySettingsConfig.panels.*）
    const off = planGroups(settingsSchema, SETTING_GROUPS, { ...displayConfig, panels: { ...displayConfig.panels, audio: false } })
    check('分组置 false → 该组整体不渲染', !off.some((g) => g.group === 'audio'), off.map((g) => g.group).join(' / '))
    // 总开关关掉 → 一项都不渲染
    const none = planGroups(settingsSchema, SETTING_GROUPS, { ...displayConfig, enable: false })
    check('总开关 enable=false → 面板一项都不渲染', none.length === 0)
  }

  {
    // 非线性滑块的往返映射必须自洽（time.scale 的 0–3600 靠它）
    const curve = TIME_SCALE_CURVE
    const roundTrip = [0, 0.25, 0.5, 0.75, 1].every((pos) => Math.abs(curve.fromValue(curve.toValue(pos)) - pos) < 1e-9)
    check('时间流速曲线 toValue/fromValue 互为逆函数', roundTrip)
    check('曲线中点 = 默认值 60×（默认值必须落在滑块正中间）', curve.toValue(0.5) === 60, `${curve.toValue(0.5)}`)
    check('文本读数带单位（60×）', formatSettingValue(settingsSchema['time.scale'], 60) === '60×', formatSettingValue(settingsSchema['time.scale'], 60))
  }

  {
    // store 侧的数组形态必须与 schema 完全同源（否则"改了 schema 但面板与持久化不一致"）
    const { SETTINGS } = await load('src/cabin/app/settings.js')
    const schemaKeys = Object.keys(settingsSchema)
    check('cabin/app/settings.js 的 SETTINGS 与 schema 键同源同序', SETTINGS.map((s) => s.key).join(',') === schemaKeys.join(','), `${SETTINGS.length} 项`)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CF3 · 清单与文件一一对应；缺配置即失败
// ─────────────────────────────────────────────────────────────────────────────
section('CF-3 清单一一对应：README ↔ 文件 ↔ 开关表（CF3 / R30）')
{
  const readme = read('src/config/README.md')
  // ⚠️ 只解析 §1「文件清单」那一张表 —— README 里还有"消费方"与"环境变量"两张表，
  //    它们的首列也是反引号内容（`cabin/app/store.js` / `PUBLIC_MODULES` …），
  //    整篇扫会把它们当成悬空文件条目（第一版就是这么错的）。
  const listSection = readme.split('## 1. 文件清单')[1].split('\n## ')[0]
  const listed = [...listSection.matchAll(/^\|\s*`([^`]+)`\s*\|/gm)].map((m) => m[1]).filter((n) => !n.startsWith('<'))
  const actual = walk(path.join(ROOT, 'src/config'))

  const missingInReadme = actual.filter((f) => !listed.includes(f))
  const missingOnDisk = listed.filter((f) => !actual.includes(f))
  check('src/config/ 下的文件都在 README 清单里', missingInReadme.length === 0, missingInReadme.join(' / ') || `${actual.length} 个文件全在清单里`)
  check('README 清单里的文件都真实存在', missingOnDisk.length === 0, missingOnDisk.join(' / ') || '零悬空条目')

  {
    // 每个 `*.config.js` 都必须在 index.js 里有 re-export（否则"加了文件但没人能导入"）
    const indexSrc = codeOnly(read('src/config/index.js'))
    const configFiles = actual.filter((f) => f.endsWith('.config.js'))
    const notExported = configFiles.filter((f) => !indexSrc.includes(`'./${f}'`))
    check('每个 *.config.js 都在 index.js 里 re-export', notExported.length === 0, notExported.join(' / ') || `${configFiles.length} 个全已导出`)
  }

  {
    // 开关表 ↔ mapping.yaml 的模块 id 必须完全一致
    const { modulesConfig } = await load('src/config/modules.config.js')
    const { validateModuleToggles } = await load('src/config/resolve.js')
    const mappingIds = [...read('docs/BuildPlaning/mapping.yaml').matchAll(/^\s*-\s*id:\s*(M[0-9][A-Za-z0-9]*)\s*$/gm)].map((m) => m[1])
    const v = validateModuleToggles(modulesConfig, mappingIds)
    check('modules.config.js 的键 == mapping.yaml 的模块 id 集合', v.ok, `缺 ${v.missing.join('/') || '无'}；多 ${v.extra.join('/') || '无'}`)
    check('mapping.yaml 里解析出 19 个模块 id', mappingIds.length === 19, `${mappingIds.length} 个`)
  }

  {
    // ★ 反例：故意漏一个开关，校验函数必须报失败（证明"缺配置即失败"这条路是通的）
    const { validateModuleToggles } = await load('src/config/resolve.js')
    const bad = validateModuleToggles({ M01: true }, ['M01', 'M02'])
    check('漏一个开关时 validateModuleToggles 报失败（可缺省即失败）', bad.ok === false && bad.missing.join(',') === 'M02')
  }

  {
    // dom.js 里的分组锚点必须覆盖 displayConfig 里所有可见的分组。
    // ⚠️ 走 `codeOnly`：文件头的说明表格里也写着 `data-setting-group="house"`，
    //    不剥注释就会把"注释里提过"当成"HTML 里有"（门禁会静默失效）。
    const anchors = [...codeOnly(read('src/cabin/dom.js')).matchAll(/data-setting-group="([^"]+)"/g)].map((m) => m[1])
    const { displayConfig } = await load('src/config/display.config.js')
    const visible = Object.entries(displayConfig.panels).filter(([, v]) => v !== false).map(([k]) => k)
    const missing = visible.filter((g) => !anchors.includes(g))
    check('菜单里有每个可见分组的锚点（位置与标题仍由 dom.js 排版）', missing.length === 0, missing.join(' / ') || `锚点：${anchors.join(' / ')}`)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CF4 · config 是叶子；实现里没有第二份可调清单
// ─────────────────────────────────────────────────────────────────────────────
section('CF-4 config 是叶子 + 实现里没有第二份清单（N11 / R29）')
{
  const configFiles = walk(path.join(ROOT, 'src/config')).filter((f) => f.endsWith('.js'))
  const violations = []
  for (const f of configFiles) {
    for (const spec of specifiersOf(read(`src/config/${f}`))) {
      // 只允许：同目录相对导入（./x.js）。不得指向 cabin/、blog/、features/
      if (!spec.startsWith('.')) violations.push(`${f} → ${spec}`)
      else if (/^\.\.\//.test(spec)) violations.push(`${f} → ${spec}`)
    }
  }
  check('config/** 只 import 同目录文件（不 import cabin/**、blog/**、features/**）', violations.length === 0, violations.join(' / ') || '零违规')

  {
    // 实现侧不得再写一份"用户能调什么"的清单
    const settingsSrc = codeOnly(read('src/cabin/app/settings.js'))
    check('cabin/app/settings.js 不再自己声明 schema（只是派生）', !/type:\s*['"](boolean|number|enum)['"]/.test(settingsSrc))
  }

  {
    // 3D 实现不得自己读 config/**（它只能通过 store 拿值）——
    // 否则"面板改了值"与"场景读到的值"会成为两条路
    // ★ J4.7：monolith 已删除 —— 判据的**语义没变**（3D 实现不得自己读 config/**），
    //   范围从"一个文件"变成"整个 src/cabin/**"（实现现在散在 21 个段模块里）。
    const all = []
    const gather = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name)
        if (e.isDirectory()) gather(p)
        else if (p.endsWith('.js')) all.push(p)
      }
    }
    gather(path.join(ROOT, 'src/cabin'))
    // ★ 两处**合法**的 config 消费者 —— 它们是 `J2.5` 配置编排层刻意留下的接缝，
    //   不是"场景自己读配置"：
    //     · `app/settings.js`           —— 把 `settingsSchema` 派生成 `SETTINGS`（store 的默认值来源）
    //     · `systems/ui/SettingsForm.js` —— 由 schema **自动生成**设置面板控件（验收 CF2 的落点）
    //   判据的语义不变：**场景实现**一律经 store 取值，不得直接读 config。
    const CONFIG_ADAPTERS = ['src/cabin/app/settings.js', 'src/cabin/systems/ui/SettingsForm.js']
    const direct = []
    for (const p of all) {
      const r = path.relative(ROOT, p).replace(/\\/g, '/')
      if (CONFIG_ADAPTERS.includes(r)) continue
      for (const m of codeOnly(fs.readFileSync(p, 'utf8')).matchAll(/from\s+['"]([^'"]*config\/[^'"]*)['"]/g)) {
        direct.push(`${r} → ${m[1]}`)
      }
    }
    check('src/cabin/** 不直接 import config/**（设置值一律经 store）', direct.length === 0, direct.join(' / ') || `零直接依赖（扫 ${all.length} 个文件）`)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('')
console.log(`  结果：${pass} 项通过 / ${fail} 项失败`)
if (fail) {
  console.log('')
  for (const f of failures) console.log(`    ✗ ${f}`)
}
console.log('')
process.exit(fail ? 1 : 0)
