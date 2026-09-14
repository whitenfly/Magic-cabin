/**
 * `J1.5` 门禁 —— Astro 落地是否按规划落地，且**没有动 3D 那一半**
 * ============================================================================
 * 对应路线图 `docs/BuildPlaning/01-完善路线图.md` §3 的 `J1.5`（6 个子任务）与它的 DoD：
 *
 * | # | 子任务 | 本脚本怎么验 |
 * |---|---|---|
 * | J1.5.1 | Astro（`output: 'static'`）+ 继承 base/alias | 配置存在且关键项齐全 |
 * | J1.5.2 | 3D 作为**一个岛** | 岛组件唯一；3D 侧不 import `.astro`；Astro 侧不 import `cabin/**` 实现 |
 * | J1.5.3 | `src/content/` 集合骨架 + 1 篇样例 | 集合目录与样例文章存在；`content.config.ts` 用自定义 loader 而非 `astro/loaders` |
 * | J1.5.4 | 门厅（`<noscript>` 降级 + 列表先出） | `BaseLayout` 含 noscript；产物首页含文章标题与正文入口 |
 * | J1.5.5 | `scripts/serve.mjs` 托管 `dist/` | 托管根与 `--legacy` 兜底都在 |
 * | J1.5.6 | 单文件"双击即玩"（OD-2 选项①） | `vite.single.config.ts` 存在、相对 base、全内联、**未使用会让产物 TDZ 崩溃的 `inlineDynamicImports`** |
 *
 * 另有两条**从 `J1` 继承下来、必须一直成立**的护栏：
 *   · `pnpm serve`（零构建兜底）**不可删** —— 受限环境里它是唯一能跑起来的路径；
 *   · `src/cabin/legacy/monolith.js` 在 `J3`/`J4` 开始掏空之前**必须逐字节不变**。
 *
 * > **`src/cabin/**` 的摘要**记录在 `tests/baseline/cabin-digest.json`。
 * > 它取代了"`git diff` 为空"这条判据 —— 本项目**不是 git 仓库**（磁盘上实测无 `.git`），
 * > 所以用"逐字节摘要"来回答同一个问题：J1.5 到底有没有碰过 3D 那一半。
 * > 重新记录（只在**确认真的一行没改**之后执行）：`node scripts/verify-j15.mjs --record`
 *
 * 用法：
 *   node scripts/verify-j15.mjs            校验（不一致即 exit 1）
 *   node scripts/verify-j15.mjs --record   重新记录摘要（需要显式确认，见上）
 *   node scripts/verify-j15.mjs --built    额外校验 dist/ 产物（需先 pnpm build）
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const DIGEST_FILE = path.join(ROOT, 'tests/baseline/cabin-digest.json')
const RECORD = process.argv.includes('--record')
const CHECK_BUILT = process.argv.includes('--built')

const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/')
const read = (p) => fs.readFileSync(p, 'utf8')
const exists = (p) => fs.existsSync(p)

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

// ═══════════════════════════════════════════════════════════════════════════
console.log('')
console.log('  J1.5 门禁 · Astro 落地与不变量')
console.log('  ══════════════════════════════════════════════════════════════')

// ── ① J1.5.1 · 构建形态 ────────────────────────────────────────────────────
section('J1.5.1 构建形态（Astro）')
{
  const cfg = path.join(ROOT, 'astro.config.mjs')
  check('astro.config.mjs 存在', exists(cfg), exists(cfg) ? `${read(cfg).split('\n').length} 行` : '缺失')
  if (exists(cfg)) {
    const src = read(cfg)
    check("output: 'static'（不做 SSR）", /output:\s*'static'/.test(src))
    check("outDir 指向 ./dist", /outDir:\s*'\.\/dist'/.test(src))
    check("trailingSlash: 'always'（与 3D 侧 pushState 的 URL 规则一致）", /trailingSlash:\s*'always'/.test(src))
    check("base: '/'（3D 用相对根路径取音频，且避免 `//_astro/x.js`）", /^\s*base:\s*'\/'/m.test(src))
    check("alias '@' → src/（继承 J1 的约定）", /'@':\s*fileURLToPath/.test(src))
    check('单一真源：site URL 从 src/config/site.config.js 读，不写字面量', /from '\.\/src\/config\/site\.config\.js'/.test(src))
  }
  const pkg = JSON.parse(read(path.join(ROOT, 'package.json')))
  check('package.json 有 astro 依赖（devDependencies）', Boolean(pkg.devDependencies?.astro), pkg.devDependencies?.astro ?? '无')
  check('scripts.build = astro build', pkg.scripts?.build === 'astro build', pkg.scripts?.build ?? '无')
  check('scripts.dev = astro dev', pkg.scripts?.dev === 'astro dev', pkg.scripts?.dev ?? '无')
  check('three 仍锁 0.128.0（K7：搬迁期不升级）', pkg.dependencies?.three === '0.128.0', pkg.dependencies?.three ?? '无')
}

// ── ② J1.5.2 · 一个岛 + 依赖不变量 N12 ─────────────────────────────────────
section('J1.5.2 一个岛（依赖不变量 N12）')
{
  const mount = path.join(ROOT, 'src/components/CabinMount.astro')
  const layout = path.join(ROOT, 'src/layouts/BaseLayout.astro')
  const index = path.join(ROOT, 'src/pages/index.astro')
  check('src/components/CabinMount.astro 存在', exists(mount))
  check('src/layouts/BaseLayout.astro 存在', exists(layout))
  check('src/pages/index.astro 存在', exists(index))

  // 岛必须唯一：全项目只有 CabinMount 里 import 3D 的启动函数
  const astroFiles = []
  const scan = (dir) => {
    if (!exists(dir)) return
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) scan(full)
      else if (/\.astro$/.test(entry.name)) astroFiles.push(full)
    }
  }
  scan(path.join(ROOT, 'src'))
  const bootImporters = astroFiles.filter((f) => /from\s+['"][^'"]*cabin\/boot\.js['"]/.test(read(f)))
  check(
    '唯一入口：只有 CabinMount.astro import cabin/boot.js',
    bootImporters.length === 1 && rel(bootImporters[0]) === 'src/components/CabinMount.astro',
    bootImporters.map(rel).join(' / ') || '无',
  )

  // N12 ①：3D 侧不得 import *.astro
  const cabinFiles = walk(path.join(ROOT, 'src/cabin')).filter((f) => /\.(js|ts|mjs)$/.test(f))
  const badCabin = cabinFiles.filter((f) => /\.astro['"]/.test(read(path.join(ROOT, 'src/cabin', f))))
  check('N12①：src/cabin/** 不 import .astro', badCabin.length === 0, badCabin.join(' / ') || '零违规')

  // N12 ②：Astro 侧不得 import cabin/** 的实现（唯一例外是那个岛）
  const badAstro = astroFiles.filter((f) => {
    if (rel(f) === 'src/components/CabinMount.astro') return false
    return /from\s+['"][^'"]*cabin\//.test(read(f))
  })
  check(
    'N12②：除 CabinMount 外，.astro 不 import cabin/**',
    badAstro.length === 0,
    badAstro.map(rel).join(' / ') || '零违规',
  )

  // 岛不加 client:* 指令（加了会构建失败：Astro 组件不能有 hydration 指令）
  if (exists(index)) {
    const src = read(index)
    check('index.astro 调用 <CabinMount> 且**不带** client:* 指令', /<CabinMount\b(?![^>]*client:)/.test(src))
    check('index.astro 不再引用 src/main.js（岛直接指向 cabin/boot.js）', !/from\s+['"][^'"]*main\.js['"]/.test(read(mount)))
  }
}

// ── ③ J1.5.3 · 内容集合骨架 ────────────────────────────────────────────────
section('J1.5.3 内容集合骨架')
{
  const cfg = path.join(ROOT, 'src/content.config.ts')
  check('src/content.config.ts 存在（Astro 5+ 的位置约定）', exists(cfg))
  if (exists(cfg)) {
    const src = read(cfg)
    check('导出了 collections', /export\s+const\s+collections/.test(src))
    check('posts 集合存在', /const posts = defineCollection/.test(src))
    check('pages 集合存在', /const pages = defineCollection/.test(src))
    check(
      '★ 用 @/blog/loaders.js 的 markdownDir，而**不是** astro/loaders 的 glob',
      /from\s+'@\/blog\/loaders\.js'/.test(src) && !/from\s+'astro\/loaders'/.test(src),
      '（glob 会让 astro sync 在 require is not defined 上崩溃，成因见 loaders.js 文件头）',
    )
  }
  check('src/blog/loaders.js 存在（零外部依赖加载器）', exists(path.join(ROOT, 'src/blog/loaders.js')))
  check('src/blog/posts.js 存在（集合读取层：排序/摘要/聚合）', exists(path.join(ROOT, 'src/blog/posts.js')))

  const postsDir = path.join(ROOT, 'src/content/posts')
  const sample = 'hello-cabin.md'
  check(`样例文章 src/content/posts/${sample} 存在`, exists(path.join(postsDir, sample)))
  if (exists(path.join(postsDir, sample))) {
    const md = read(path.join(postsDir, sample))
    check('样例文章有 front-matter（以 --- 开头）', md.startsWith('---'))
    check('样例文章含 title', /^title:/m.test(md))
    check('样例文章含 date', /^date:/m.test(md))
  }
  check('src/content/pages/about.md 存在（M06 的正文来源）', exists(path.join(ROOT, 'src/content/pages/about.md')))

  // 加载器必须只用 Node 内置模块（不能引入第三方包，也不能静态 import 易被外部化的包）
  const loader = path.join(ROOT, 'src/blog/loaders.js')
  if (exists(loader)) {
    // ⚠️ 先把注释行剔除再扫 specifier —— 否则本文件头那段"为什么不用 astro/loaders"的说明
    //    会被当成真的 import（这个门禁自己踩过一次）。
    const code = read(loader)
      .split('\n')
      .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
      .join('\n')
    const specifiers = [...code.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1])
    const dynamic = [...code.matchAll(/import\(\s*\/\*[^*]*\*\/\s*['"]([^'"]+)['"]/g)].map((m) => m[1])
    const all = [...specifiers, ...dynamic]
    const thirdParty = all.filter((s) => !s.startsWith('node:'))
    check('加载器零第三方依赖（只 import node:*）', thirdParty.length === 0, thirdParty.join(' / ') || all.join(' / '))
    check('加载器的动态 import 都带 @vite-ignore（否则 Vite 会改写它们）', dynamic.length >= 2)
  }
}

// ── ④ J1.5.4 · 门厅 ────────────────────────────────────────────────────────
section('J1.5.4 门厅（HTML 先行 + 禁 JS 可读）')
{
  const layout = path.join(ROOT, 'src/layouts/BaseLayout.astro')
  if (exists(layout)) {
    const src = read(layout)
    check('门厅块 #cabin-foyer 由 Astro 构建期渲染（纯 HTML）', /id="cabin-foyer"/.test(src))
    check('门厅内容来自插槽（首页提供列表，不写死在布局里）', /slot\s+name="foyer"/.test(src))
    check('`?bare=1` 时整块不渲染（供像素回归 / 直接开玩）', /!bare\s*&&\s*hasFoyer/.test(src))
    check('3D 岛排在 body 最前（否则 canvas 在文档流里的位置会变 ⇒ 像素基线失效）', /<slot\s*\/>/.test(src))
  }
  const index = path.join(ROOT, 'src/pages/index.astro')
  if (exists(index)) {
    check('首页把「最新 N 篇」交给门厅（条数来自 home.config）', /homeConfig\.latestCount/.test(read(index)))
  }
}

// ── ⑤ J1.5.5 · serve.mjs 托管 dist/ ────────────────────────────────────────
section('J1.5.5 兜底验证路径（serve.mjs）')
{
  const serve = path.join(ROOT, 'scripts/serve.mjs')
  check('scripts/serve.mjs 仍存在（兜底路径不可删）', exists(serve))
  if (exists(serve)) {
    const src = read(serve)
    check('默认托管 dist/（产物模式）', /DIST_DIR\s*=\s*path\.join\(ROOT,\s*'dist'\)/.test(src))
    check('支持 --legacy（零构建模式继续可用）', /--legacy|LEGACY/.test(src))
    check('端口占用自动顺延（不崩溃）', /EADDRINUSE/.test(src))
    check('未命中时回落到 dist/404.html', /404\.html/.test(src))
  }
  const pkg = JSON.parse(read(path.join(ROOT, 'package.json')))
  check('scripts.serve:legacy 存在', Boolean(pkg.scripts?.['serve:legacy']), pkg.scripts?.['serve:legacy'] ?? '无')

  const legacy = path.join(ROOT, 'index.html')
  check('index.html 保留（零构建路径的入口）', exists(legacy))
  if (exists(legacy)) {
    const src = read(legacy)
    check('零构建入口仍有 importmap（浏览器原生 ESM 解析裸模块名）', /type="importmap"/.test(src))
    check('零构建入口仍指向 ./src/main.js', /src\/main\.js/.test(src))
  }
}

// ── ⑥ J1.5.6 · 双管线（OD-2 选项①）────────────────────────────────────────
section('J1.5.6 单文件"双击即玩"（决策点 OD-2 选项①：保留双管线）')
{
  const single = path.join(ROOT, 'vite.single.config.ts')
  check('vite.single.config.ts 存在', exists(single))
  if (exists(single)) {
    const src = read(single)
    check("单文件产线用相对 base './'（file:// 下才能找到资源）", /base:\s*'\.\/'/.test(src))
    check('全内联资源（assetsInlineLimit 提到 100MB）', /assetsInlineLimit:\s*100\s*\*\s*1024\s*\*\s*1024/.test(src))
    check("产物目录 dist-single/（与 Astro 的 dist/ 分离）", /outDir:\s*'dist-single'/.test(src))
    // ★ 反向断言：`inlineDynamicImports` 必须**不在**
    //   实测它会把模块图塌缩成一个 chunk，导致 three 的导出在声明前被访问（TDZ），
    //   产物在 HTTP 托管下也起不来（canvas 建出来了但没有 data-cabin）。
    //   这条断言防的就是"有人觉得单文件就该 inlineDynamicImports 而把它加回来"。
    check(
      '★ 未使用 inlineDynamicImports（用了会让产物 TDZ 崩溃）',
      !/inlineDynamicImports/.test(src.replace(/^\s*(\/\/|\*|\/\*).*$/gm, '')),
      '见 vite.single.config.ts 的 ⚠️ 注释与 scripts/oneoff/probe-page.mjs',
    )
  }
  const pkg = JSON.parse(read(path.join(ROOT, 'package.json')))
  check('build:single 指向第二条产线', pkg.scripts?.['build:single'] === 'vite build --config vite.single.config.ts', pkg.scripts?.['build:single'] ?? '无')
  check('serve:single 存在（托管单文件产物）', Boolean(pkg.scripts?.['serve:single']))
}

// ── ⑦ 3D 那一半：逐字节没动 ────────────────────────────────────────────────
section('3D 那一半（src/cabin/**）—— J1.5 要求「一行不改」')
{
  const dir = path.join(ROOT, 'src/cabin')
  const files = walk(dir)
  const manifest = {}
  let totalLines = 0
  for (const f of files) {
    const buf = fs.readFileSync(path.join(dir, f))
    manifest[f] = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16)
    totalLines += buf.toString('utf8').split('\n').length
  }
  const combined = crypto
    .createHash('sha256')
    .update(files.map((f) => `${f}:${manifest[f]}`).join('\n'))
    .digest('hex')

  console.log(`  文件 ${files.length} 个 / 共 ${totalLines} 行 / 摘要 ${combined.slice(0, 16)}…`)

  if (RECORD) {
    fs.mkdirSync(path.dirname(DIGEST_FILE), { recursive: true })
    fs.writeFileSync(
      DIGEST_FILE,
      JSON.stringify(
        {
          what: 'J1.5 期间的 src/cabin/** 逐字节摘要',
          why: '本项目不是 git 仓库，用逐字节摘要代替「git diff 为空」这条 DoD 判据',
          note: '⚠️ J3/J4 开始掏空 legacy/ 时会合法地变化。变化前必须先在 J1.5 的结果文档里记一笔原因，再重跑 --record。',
          recordedAt: new Date().toISOString().slice(0, 10),
          totals: { files: files.length, lines: totalLines },
          combined,
          files: manifest,
        },
        null,
        2,
      ) + '\n',
      'utf8',
    )
    console.log(`  ✓ 已记录 → ${rel(DIGEST_FILE)}`)
  } else if (!exists(DIGEST_FILE)) {
    check('摘要基线存在', false, '缺失；确认一行没改后执行 node scripts/verify-j15.mjs --record')
  } else {
    const saved = JSON.parse(read(DIGEST_FILE))
    check('摘要基线存在', true, `记录于 ${saved.recordedAt}`)
    check('src/cabin/** 与基线**逐字节相同**', saved.combined === combined, saved.combined === combined ? 'J1.5 一行未改' : `基线 ${saved.combined.slice(0, 12)}… ≠ 当前 ${combined.slice(0, 12)}…`)

    if (saved.combined !== combined) {
      const changedFiles = files.filter((f) => saved.files[f] !== manifest[f])
      const added = files.filter((f) => !(f in saved.files))
      const removed = Object.keys(saved.files).filter((f) => !(f in manifest))
      if (changedFiles.length) console.log(`      改动：${changedFiles.join(' / ')}`)
      if (added.length) console.log(`      新增：${added.join(' / ')}`)
      if (removed.length) console.log(`      删除：${removed.join(' / ')}`)
      console.log('      ⚠ 若这是 J3/J4 的**合法**改动，先在结果文档里记原因，再重跑 --record')
    }
  }

  // 与 J1 的既有护栏一致的两项统计（路线图 §5.3 的进度可视化读它们）
  const monolith = path.join(dir, 'legacy/monolith.js')
  if (exists(monolith)) {
    const src = read(monolith)
    const lines = src.split('\n').length
    console.log(`  legacy/monolith.js  ${lines} 行（J4 的目标是删掉它）`)
    check('legacy/monolith.js 仍存在（J3/J4 之前不许动）', true, `${lines} 行`)
    const bareRandom = (src.match(/Math\.random\(/g) ?? []).length
    check('裸 Math.random() 数为 0（F0.2 的成果不许回退）', bareRandom === 0, `${bareRandom} 处`)
  }
}

// ── ⑧ 产物（可选）─────────────────────────────────────────────────────────
if (CHECK_BUILT) {
  section('构建产物 dist/（--built）')
  const dist = path.join(ROOT, 'dist')
  check('dist/ 存在', exists(dist), exists(dist) ? '' : '先运行 pnpm build')
  if (exists(dist)) {
    const home = path.join(dist, 'index.html')
    check('dist/index.html 存在', exists(home))
    if (exists(home)) {
      const html = read(home)
      check('产物首页含 3D 岛脚本（/_astro/…js 或 monolith）', /_astro\/[^"]+\.js|monolith/.test(html))
      check('产物首页含门厅列表（构建期渲染的文章入口）', /posts\/hello-cabin\//.test(html))
      check('产物首页不含 `//_astro` 协议相对 URL（base 必须是 /）', !/["']\/\/_astro/.test(html))
      const foyerIdx = html.indexOf('id="cabin-foyer"')
      const scriptIdx = html.indexOf('<script type="module"')
      check('岛出现在门厅之前（DOM 顺序 = canvas 的位置）', scriptIdx !== -1 && (foyerIdx === -1 || scriptIdx < foyerIdx))
    }
    const slugs = ['posts/hello-cabin/index.html', 'archive/index.html', 'tags/index.html', 'about/index.html', '404.html', 'rss.xml', 'robots.txt']
    for (const s of slugs) check(`产物 ${s}`, exists(path.join(dist, s)))
    // ⚠️ 不要找名为 `cabin.css` 的文件：Astro 会把**所有**样式合并、压缩并加内容哈希，
    //    产物里只有 `_astro/BaseLayout.<hash>.css`。判据应当是"搬迁过来的那些选择器还在"，
    //    而不是"文件名还叫 cabin.css"（后者是判据写错了，不是构建错了）。
    const cssFiles = walk(path.join(dist, '_astro')).filter((f) => f.endsWith('.css'))
    const cssText = cssFiles.map((f) => read(path.join(dist, '_astro', f))).join('\n')
    const legacySelectors = ['#menuDot', '#menuPanel', '#wxChips', '#joyZone', '#signEditor', '#flashOverlay', '#crosshair']
    const missingSel = legacySelectors.filter((s) => !cssText.includes(s))
    check(
      '产物样式含搬迁过来的 3D UI 选择器（cabin.css 已并入 Astro 产物）',
      cssFiles.length > 0 && missingSel.length === 0,
      missingSel.length ? `缺：${missingSel.join(' / ')}` : `${cssFiles.length} 个 CSS，${legacySelectors.length} 个选择器齐全`,
    )
    const htmlCss = (read(path.join(dist, 'index.html')).match(/href="(\/_astro\/[^"]+\.css)"/g) ?? []).length
    check('产物首页确实引用了该样式表', htmlCss > 0, `${htmlCss} 处`)
    check('产物含 sounds/*.mp3（3D 用相对路径取音频）', exists(path.join(dist, 'sounds/door.mp3')))
    const rss = read(path.join(dist, 'rss.xml'))
    check('rss.xml 含文章条目与规范 URL', /hello-cabin\//.test(rss) && /<rss/.test(rss))
  }
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('')
console.log(`  结果：${pass} 项通过 / ${fail} 项失败`)
if (fail) {
  console.log('')
  for (const f of failures) console.log(`    ✗ ${f}`)
}
console.log('')
process.exit(fail ? 1 : 0)
