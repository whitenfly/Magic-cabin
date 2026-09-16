/**
 * 单元测试 —— 性能基线报告的渲染器（`tests/e2e/perf-report.mjs`）
 *
 * 运行：`node --test "tests/unit/*.test.mjs"`
 *
 * ## 为什么这几条断言存在（`J4.12` 的真实事故）
 *
 * 报告模板里的相对链接前缀曾被写成 `../../docs/实施结果/`。那个前缀**本身没错** ——
 * 对 `tests/e2e/perf.mjs` 自身所在目录它是正确的；错的是它被用在了**生成物**
 * （`docs/*.md`）身上：从 `docs/` 出发会解析到 `FrontProj/docs/实施结果/`，**不存在**。
 *
 * 「按引用方所在目录重算相对路径」这条规则本身是对的（`840c1db` 的集中化重构立的），
 * 事故出在**引用方被认成了脚本，而不是脚本产出的文档**。
 *
 * ## 为什么不能靠"跑一遍看看"
 *
 * 这类缺陷**跑采集发现不了**：脚本跑完是绿的、退出码 0、数字全对 ——
 * 只是文档里的链接悄悄变成了死链。它和 `VERSIONING.md` §附录B 的 **P8**（PowerShell 加 BOM）
 * 属于同一类：**"跑起来是绿的"不等于"东西是对的"**，只能靠断言去守。
 *
 * ## 三层判据
 *
 * | # | 守什么 |
 * |---|---|
 * | ① | `linkPrefix()` 的基准是**生成物所在目录**（含"同一前缀换个位置才对"的事故形态） |
 * | ② | `renderMarkdown()` 在两个**真实产物路径**下，产出的每个相对链接都能解析到真实文件 |
 * | ③ | 仓库里**现存**的两份报告，相对链接也全部可解析（手工编辑同样不许写死链） |
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { renderMarkdown, backendVerdict, linkPrefix } from '../e2e/perf-report.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')

/** 两份报告的**真实**位置 + 对应的机器可读基线文件名（与 perf.mjs 的 `PROFILE_FILES` 一致） */
const REPORTS = [
  { mdRel: 'docs/baseline.md', profile: 'swiftshader', dataFile: 'perf.json' },
  { mdRel: 'docs/baseline.gpu.md', profile: 'gpu', dataFile: 'perf.gpu.json' },
]

/**
 * "参考项"集合（噪声大、不作判据）。
 * 与 `perf.mjs` 的 `REFERENCE_ONLY` 同义 —— 这里只是**喂给被测函数的输入**，
 * 不断言它本身（阈值语义的事实来源仍是 `perf.mjs`）。
 */
const REFERENCE_ONLY = new Set(['readyMs', 'fps'])

/** 渲染只读字段，所以一份结构完整的假基线就够 —— 不必真跑一轮采集（那需要真实浏览器） */
function fakeBaseline(profile) {
  const round = (i) => ({ readyMs: 500 + i, bootMs: 460 + i, fps: 78 - i, calls: 3138, triangles: 86158 })
  return {
    spec: 'J0.6 性能基线',
    profile,
    profileLabel: profile === 'gpu' ? '本机 / 真实 GPU' : '沙箱 / 软件渲染（SwiftShader）',
    generatedAt: '2026-09-16T00:00:00.000Z',
    url: 'http://127.0.0.1:5173/?deterministic=1&stats=1&bare=1',
    viewport: { width: 1440, height: 900 },
    rounds: 5,
    env: {
      browser: 'HeadlessChrome/153.0.0.0',
      devicePixelRatio: 1,
      renderer: profile === 'gpu' ? 'ANGLE (NVIDIA, NVIDIA GeForce RTX 5060 Laptop GPU, D3D11)' : 'SwiftShader',
      seed: '20260214',
    },
    metrics: {
      readyMs: { median: 502, min: 501, max: 504 },
      bootMs: { median: 462, min: 460, max: 464 },
      fps: { median: 76, min: 74, max: 78 },
      cold: { readyMs: 850, bootMs: 800, fps: 105, calls: 3138, triangles: 86158 },
    },
    render: {
      frame: 624,
      calls: 3138,
      triangles: 86158,
      renderLines: 61252,
      renderPoints: 2638,
      geometries: 2843,
      textures: 38,
      programs: 15,
      sceneObjects: 5365,
      sceneMeshes: 1812,
      sceneLines: 1907,
      scenePoints: 7,
    },
    thresholds: { calls: 0.1, triangles: 0.1, geometries: 0.1, textures: 0.1, sceneObjects: 0.1, readyMs: 0.3, fps: 0.25 },
    quality: { fpsSpread: 0.06, readySpread: 0.19, fpsTrend: -0.03, stable: true, note: '轮间波动与趋势均在正常范围' },
    samples: [0, 1, 2, 3, 4].map(round),
  }
}

/** 按真实位置渲染一份报告 */
const renderReal = ({ mdRel, profile, dataFile }) =>
  renderMarkdown(fakeBaseline(profile), {
    mdRel,
    dataFile,
    warmupMs: 3000,
    fpsSampleMs: 5000,
    referenceOnly: REFERENCE_ONLY,
  })

/** 抽出 markdown 里的**站内**链接（外链与锚点不参与"文件是否存在"的判定） */
function localLinks(md) {
  const out = []
  for (const m of md.matchAll(/\]\(([^)\s]+)\)/g)) {
    const href = m[1]
    if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('#')) continue
    out.push(href)
  }
  return out
}

/** 站内链接按「文档所在目录」解析成绝对路径 —— 这正是浏览器/编辑器的解析方式 */
const resolveFrom = (mdRel, href) => path.resolve(ROOT, path.posix.dirname(mdRel), href)

/* ─────────── ① 前缀的基准必须是「生成物所在目录」 ─────────── */

test('★ linkPrefix：基准是**生成物所在目录**，不是脚本所在目录', () => {
  assert.equal(linkPrefix('docs/baseline.md', 'docs/实施结果'), './实施结果')
  assert.equal(linkPrefix('docs/baseline.gpu.md', 'docs/实施结果'), './实施结果')
  assert.equal(linkPrefix('docs/baseline.gpu.md', 'tests/e2e/baseline'), '../tests/e2e/baseline')
  // 产物若落在仓库根（假想形态）也要正确 —— 前缀是按位置算出来的，不是查表得来的
  assert.equal(linkPrefix('baseline.md', 'docs/实施结果'), './docs/实施结果')
})

test('★ 事故形态：同一个前缀，换个位置才对 —— 两者不可互换', () => {
  // 对 tests/e2e/ 下的文档，`../../docs/实施结果` 是正确的
  assert.equal(linkPrefix('tests/e2e/baseline.gpu.md', 'docs/实施结果'), '../../docs/实施结果')
  // 但对 docs/ 下的产物就是死链 —— J4.12 的事故正是把这一条用错了地方
  const wrongOnPurpose = linkPrefix('tests/e2e/x.md', 'docs/实施结果')
  const right = linkPrefix('docs/baseline.gpu.md', 'docs/实施结果')
  assert.notEqual(wrongOnPurpose, right)
  assert.ok(fs.existsSync(resolveFrom('docs/baseline.gpu.md', `${right}/F0.6-实施结果.md`)))
  assert.ok(!fs.existsSync(resolveFrom('docs/baseline.gpu.md', `${wrongOnPurpose}/F0.6-实施结果.md`)))
})

/* ─────────── ② 产出的报告：每个相对链接都要能解析 ─────────── */

for (const report of REPORTS) {
  const { mdRel } = report

  test(`★ ${mdRel}：产出的每一个相对链接都能解析到真实文件`, () => {
    const md = renderReal(report)
    const links = localLinks(md)
    assert.ok(links.length >= 4, `链接数过少（${links.length}）—— 模板可能被改坏或删空了`)
    for (const href of links) {
      const abs = resolveFrom(mdRel, href)
      assert.ok(fs.existsSync(abs), `${mdRel} 产出里的链接解析不到：${href} → ${abs}`)
    }
  })

  test(`${mdRel}：产出里不再出现跨目录写死的前缀（J4.12 的回归锁）`, () => {
    const md = renderReal(report)
    assert.ok(!md.includes('../../docs/实施结果/'), '又出现了写死的 `../../docs/实施结果/` —— 产物在 docs/ 下时它是死链')
  })
}

/* ─────────── ③ 仓库里现存的产物：手工编辑也不许写死链 ─────────── */

for (const { mdRel } of REPORTS) {
  test(`仓库里现存的 ${mdRel}：相对链接全部可解析`, (t) => {
    const abs = path.join(ROOT, mdRel)
    if (!fs.existsSync(abs)) return t.skip(`${mdRel} 尚未生成（GPU 是可选增量产物）`)
    const links = localLinks(fs.readFileSync(abs, 'utf8'))
    assert.ok(links.length >= 4, `${mdRel} 里链接数过少（${links.length}）`)
    for (const href of links) {
      const target = resolveFrom(mdRel, href)
      assert.ok(fs.existsSync(target), `${mdRel} 里的链接解析不到：${href} → ${target}`)
    }
  })
}

/* ─────────── ④ 报告仍带着真实数据与两档语义（别把渲染函数改成空壳） ─────────── */

test('产出的报告带真实数据，且区分「判据」与「参考项」', () => {
  const md = renderReal(REPORTS[0])
  assert.match(md, /calls 3138/, '渲染统计必须写进报告')
  assert.match(md, /\| `calls` \| 10% \| 上升 \| \*\*判据\*\* \|/)
  assert.match(md, /\| `readyMs` \| 30% \| 上升 \| ⚠️ 参考项（噪声大） \|/)
  assert.match(md, /FPS 采样窗口 \| 5 s/, '采集口径表要写对采样窗口')
})

test('backendVerdict：把回落的软件渲染认出来（别把 SwiftShader 当 GPU 数据）', () => {
  assert.equal(backendVerdict({ renderer: 'SwiftShader' }), '软件渲染（SwiftShader）')
  assert.equal(backendVerdict({ renderer: 'llvmpipe (LLVM 15.0.6, 256 bits)' }), '软件渲染（SwiftShader）')
  assert.equal(backendVerdict({ renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 5060 Laptop GPU, D3D11)' }), '硬件加速')
  assert.equal(backendVerdict({ renderer: 'unknown' }), '未知')
})
