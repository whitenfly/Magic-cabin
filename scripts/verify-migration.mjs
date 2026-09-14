// 静态校验：确认搬迁过程**零逻辑改动**
//   ① monolith.js（去掉头部注释与 import）应与源文件 844–9807 行相同
//   ② cabin.css（去掉头部注释）应与源文件 10–748 行相同
//   ③ dom.js 内的 UI DOM 应与源文件 753–835 行相同
//   ④ 关键 API 计数与源文件一致
//   ⑤ 音效资源齐全
// 说明：比对时忽略**末尾空白**（写入时模板字符串会多一个换行，不影响行为）。
import fs from 'node:fs'
import path from 'node:path'
import { ROOT, requireEnv, resolveUpstream } from './_verifyEnv.mjs'

// ★ 路径一律由 _verifyEnv.mjs 推导，不再硬编码本机绝对路径。
//   上游源文件是**仓库外**的单文件版解压目录，CI 上必然缺失 ⇒ 缺了就明确跳过（exit 2），
//   而不是抛 ENOENT 把整条 `pnpm verify` 链断在半截。
const SRC_DIR = path.resolve(ROOT, '../line-art-style-magic-cabin-main')
const SNAP = path.join(ROOT, '.cache/monolith.after-f02.js')
requireEnv({ src: true, files: [SNAP] })
const srcText = resolveUpstream().text
const srcLines = srcText.split(/\r?\n/)
const slice = (a, b) => srcLines.slice(a - 1, b).join('\n')
const N = (s) => s.replace(/\s+$/, '')

let pass = 0
let fail = 0
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? '  → ' + detail : ''}`)
  ok ? pass++ : fail++
}

/** 从文件中取“正文”：跳过头部块注释，可再跳过一段前缀标记 */
function bodyOf(file, afterMarker) {
  const t = fs.readFileSync(file, 'utf8')
  let s = t.slice(t.indexOf('*/') + 2)
  if (afterMarker) {
    const i = s.indexOf(afterMarker)
    s = s.slice(i + afterMarker.length)
  }
  return s.replace(/^\s*\n/, '')
}

console.log('\n【① 主脚本 src/cabin/legacy/monolith.js  ←  源 844–9807 行】')
{
  // ⚠️ 检查对象是 **F0.2 完成时的快照**（源文件 + 搬迁 + 随机源替换），
  //    因为 F0.3 之后当前文件又注入了时钟。当前文件与快照的关系由 verify-f03.mjs 验证。
  const cur = fs.readFileSync(SNAP, 'utf8')
  // F0.2 之后，随机调用已被替换为种子随机源；把替换**反向还原**后应与源文件逐字节一致，
  // 这证明历次改动只涉及"随机源替换"，没有触碰任何其他逻辑。
  const RNG = /\b(outdoorRng|floor1Rng|floor2Rng|skyRng|textureRng|slimeRng|runtimeRng)\(\)/g
  const marker = 'const runtimeRng = runtime;\n'
  const body = cur.slice(cur.indexOf(marker) + marker.length).replace(/^\s*\n/, '')
  const got = N(body.replace(RNG, 'Math.random()'))
  const want = N(slice(844, 9807))
  check(
    '代码逐字节一致（随机源反向还原后）',
    got === want,
    got === want ? `${want.length} 字符` : `${got.length} vs ${want.length}`,
  )
  check('顶部含 THREE ESM 导入', /^import \* as THREE from 'three'/m.test(cur))
  check('已注入种子随机源（F0.2）', /from '\.\.\/app\/rng\.js'/.test(cur))
  const left = (cur.match(/Math\.random\(\)/g) || []).length
  check('裸 Math.random() 已归零', left === 0, left ? `残留 ${left} 处` : '')

  // 当前文件侧：时钟注入（F0.3）
  const live = fs.readFileSync(`${ROOT}/src/cabin/legacy/monolith.js`, 'utf8')
  check('当前文件已注入时钟（F0.3）', /from '\.\.\/app\/clock\.js'/.test(live))
}

console.log('\n【② 样式 src/styles/cabin.css  ←  源 10–748 行】')
{
  const got = N(bodyOf(`${ROOT}/src/styles/cabin.css`))
  const want = N(slice(10, 748))
  check('逐字节一致', got === want, got === want ? `${want.length} 字符` : `${got.length} vs ${want.length}`)
}

console.log('\n【③ UI DOM src/cabin/dom.js  ←  源 753–835 行】')
{
  const t = fs.readFileSync(`${ROOT}/src/cabin/dom.js`, 'utf8')
  const open = 'export const UI_HTML = `\n'
  const got = N(t.slice(t.indexOf(open) + open.length, t.lastIndexOf('`\n\n/** 把 UI DOM')))
  const want = N(slice(753, 835))
  check('逐字节一致', got === want, got === want ? `${want.length} 字符` : `${got.length} vs ${want.length}`)
}

console.log('\n【④ 关键标识符计数（搬迁后 vs 源文件）】')
{
  // ★ J2 起：搬迁把实现从 monolith 逐个移进模块（cabin/core/**、cabin/systems/**），
  //   若仍只扫 monolith，计数会**合法下降**（J2.1 就把 3 个 `new THREE.Mesh(` 与
  //   2 个 `new THREE.Group(` 搬进了 cabin/core/geometry/）。
  //   判据随之改为扫描**整棵 3D 源码树**（`src/cabin/**`）：搬运不改变总数，
  //   只有"真的增删了几何/交互/监听"才会让计数变化 —— 强度不降，适用面扩大。
  //   ⚠️ 扫描范围 = **源自 monolith 的实现所在目录**（legacy / core / systems / world / props
  //   与 `dom.js`），**排除** F0.2/F0.3/J1 新增的基础设施（`app/**`、`boot.js`）——
  //   后者不是从源文件搬来的（如 `boot.js` 自带的 1 个 `addEventListener`），
  //   计入会让"源文件 vs 当前"这条等式永远差一截。
  const walkJs = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) return walkJs(p)
      return e.isFile() && p.endsWith('.js') ? [p] : []
    })
  const cabinRoot = path.join(ROOT, 'src/cabin')
  const MIGRATED_DIRS = ['legacy', 'core', 'systems', 'world', 'props']
  const cabinFiles = [
    ...MIGRATED_DIRS.flatMap((d) => (fs.existsSync(path.join(cabinRoot, d)) ? walkJs(path.join(cabinRoot, d)) : [])),
    path.join(cabinRoot, 'dom.js'),
  ]
  const parts = cabinFiles.map((f) => fs.readFileSync(f, 'utf8')).join('\n')
  console.log(
    `  扫描范围：${MIGRATED_DIRS.join('/')} + dom.js 共 ${cabinFiles.length} 个 .js（不含 app/** 与 boot.js）`,
  )
  // Math.random() 已被 F0.2 替换为种子随机源，比对时先反向还原
  const restored = parts.replace(/\b(outdoorRng|floor1Rng|floor2Rng|skyRng|textureRng|slimeRng|runtimeRng)\(\)/g, 'Math.random()')
  const count = (s, re) => (s.match(re) || []).length
  for (const [label, re] of [
    ['Math.random()', /Math\.random\(\)/g],
    ['new THREE.Mesh(', /new THREE\.Mesh\(/g],
    ['new THREE.Group(', /new THREE\.Group\(/g],
    ['new THREE.ShaderMaterial(', /new THREE\.ShaderMaterial\(/g],
    ['regMagic(', /regMagic\(/g],
    ['addEventListener(', /addEventListener\(/g],
    ['getElementById(', /getElementById\(/g],
    ["SND.play(", /SND\.play\(/g],
  ]) {
    const a = count(srcText, re)
    const b = count(restored, re)
    check(`${label}  ${a} → ${b}`, a === b)
  }
  check('已无 three.min.js 的 <script> 引用', !/<script\s+src="three\.min\.js"/.test(parts))
}

console.log('\n【⑤ 资源与依赖】')
{
  const n = fs.readdirSync(`${ROOT}/public/sounds`).filter((f) => f.endsWith('.mp3')).length
  const s = fs.readdirSync(`${SRC_DIR}/sounds`).filter((f) => f.endsWith('.mp3')).length
  check(`音效 mp3  ${s} → ${n}`, n === s)
  check('three@0.128.0 已入 node_modules', fs.existsSync(`${ROOT}/node_modules/three/build/three.module.js`))
}

console.log('\n【⑥ 外部依赖未新增（与源文件对比）】')
{
  const mono = fs.readFileSync(`${ROOT}/src/cabin/legacy/monolith.js`, 'utf8')
  // 去掉块注释与行注释后再检查，避免把说明文字当成代码
  const codeOnly = mono.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  const urls = (s) => [...new Set([...s.matchAll(/https?:\/\/[^'"`\s)]+/g)].map((m) => m[0]))]
  const srcUrls = urls(srcText)
  const newUrls = urls(codeOnly)
  const added = newUrls.filter((u) => !srcUrls.includes(u))
  check(
    `外部 URL 未新增（源 ${srcUrls.length} 个 → 现 ${newUrls.length} 个）`,
    added.length === 0,
    added.length ? '新增: ' + added.join(', ') : '（均为原代码已有的挂画图床代理）',
  )

  // three.min.js：只应出现在注释里，代码中不得再有加载它的痕迹
  check('代码中无 three.min.js / CDN 回退逻辑', !/three\.min\.js|document\.write/.test(codeOnly))
  check('音效路径保持相对 sounds/', /'sounds\/'\s*\+/.test(codeOnly))

  // 静态资源字面量（排除拼接片段如 '.mp3'）
  const assets = [...new Set([...codeOnly.matchAll(/['"`]([^'"`\s/]*\.(?:png|jpe?g|gif|webp|svg|woff2?|ttf|glb|gltf|fbx))['"`]/gi)].map((m) => m[1]))]
  check(`无外部静态资源文件（找到 ${assets.length} 个）`, assets.length === 0, assets.join(', '))
}

console.log(`\n结果：${pass} 通过 / ${fail} 失败\n`)
process.exit(fail ? 1 : 0)
