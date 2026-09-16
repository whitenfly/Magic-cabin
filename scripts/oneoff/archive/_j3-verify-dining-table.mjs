/**
 * 一次性自检（`J3` / B3）：`floor1/dining-table` 的搬运是否**逐字未改**
 *
 * 三条判据，全部不依赖浏览器：
 *   ① 文本判据：monolith 原分区语句（归一化空白）=== 新模块 `build` 体内语句（归一化空白）
 *   ② 运行判据：`import` 模块 → 桩 ctx 调 `build` → 记录到的 8 次 `put` 与原始几何逐项相同
 *   ③ 装配判据：`createPropInstaller().install()` 不抛（`build` 不返回根也能登记，与 `rugUnderTable` 同型）
 *
 * 用 `node scripts/oneoff/_j3-verify-dining-table.mjs` 跑；只读，不写盘。
 */
import fs from 'node:fs'
import path from 'node:path'
import { createLayout } from '../../src/cabin/world/layout.js'
import diningTable from '../../src/cabin/world/floor1/diningTable.js'
import { createRegistry } from '../../src/cabin/app/Registry.js'
import { createUpdateScheduler } from '../../src/cabin/app/UpdateScheduler.js'
import { createPropInstaller } from '../../src/cabin/app/installProp.js'

const ROOT = path.resolve(import.meta.dirname, '../..')
const norm = (s) => s.replace(/\s+/g, ' ').trim()

const fail = []
const ok = (cond, label) => { console.log(`${cond ? '  ✓' : '  ✗'} ${label}`); if (!cond) fail.push(label) }

/* ── ① 文本判据 ── */
console.log('\n① 文本：原分区语句 vs 新模块 build 体（空白归一化后逐字比较）')
const monoLines = fs.readFileSync(path.join(ROOT, 'src/cabin/legacy/monolith.js'), 'utf8').split('\n')
const orig = norm(monoLines.slice(664, 671).join('\n'))            // 原分区体（标记行之后 7 行）
const src = fs.readFileSync(path.join(ROOT, 'src/cabin/world/floor1/diningTable.js'), 'utf8')
const bodyStart = src.indexOf('const { MTX, MTZ } = L')
const bodyEnd = src.lastIndexOf('  },\n})')
const body = norm(src.slice(bodyStart + 'const { MTX, MTZ } = L'.length, bodyEnd))
ok(bodyStart > 0 && bodyEnd > 0, '能定位 build 体（锚点齐全）')
ok(orig === body, '原分区语句 === 新模块语句（零字差异）')
if (orig !== body) { console.log('    orig:', orig); console.log('     new:', body) }
ok(!/\bMTTOP\b/.test(body), '桌面高度没有被"顺手"换成 MTTOP')

/* ── ② 运行判据 ── */
console.log('\n② 运行：桩 ctx 执行 build，记录几何调用')
const calls = []
const tk = (t, d) => ({ __t: t, __d: d })
const box = (...a) => { calls.push(['box', a]); return tk('box', a) }
const log = (...a) => { calls.push(['log', a]); return tk('log', a) }
const edge = (g) => {
  const p = g.parameters
  // `THREE.CylinderGeometry` 的构造参数顺序（供逐项比对；别的几何按对象值取）
  const d = g.type === 'CylinderGeometry'
    ? [p.radiusTop, p.radiusBottom, p.height, p.radialSegments]
    : Object.values(p)
  calls.push(['edge', g.type, d]); return tk('edge', d)
}
const put = (o, ...rest) => { calls.push(['put', o.__t, o.__d, rest]); return o }
const L = createLayout()

const root = diningTable.build({ scene: null, L, put, box, edge, log })
ok(root === undefined, 'build 不返回根（无自建 Group ⇒ 不新增父子层级）')

const puts = calls.filter((c) => c[0] === 'put')
ok(puts.length === 8, `put 次数 = 8（实际 ${puts.length}）`)

const near = (a, b) => Math.abs(a - b) < 1e-12
const { MTX, MTZ } = L
const exp = [
  ['box', [1.15, 0.06, 0.8], [MTX, 0.75, MTZ]],
  ['box', [1.27, 0.04, 0.92], [MTX, 0.70, MTZ]],
  ['edge', [0.035, 0.028, 0.7, 6], [MTX - 0.47, 0.36, MTZ - 0.28]],
  ['edge', [0.035, 0.028, 0.7, 6], [MTX + 0.47, 0.36, MTZ - 0.28]],
  ['edge', [0.035, 0.028, 0.7, 6], [MTX - 0.47, 0.36, MTZ + 0.28]],
  ['edge', [0.035, 0.028, 0.7, 6], [MTX + 0.47, 0.36, MTZ + 0.28]],
  ['log', [0.94, 0.02], [MTX, 0.28, MTZ - 0.28], [0, 0, Math.PI / 2]],
  ['log', [0.94, 0.02], [MTX, 0.28, MTZ + 0.28], [0, 0, Math.PI / 2]],
]
puts.forEach((p, i) => {
  const [kind, params, rest] = [p[1], p[2], p[3]]
  const e = exp[i]
  const pos = rest.slice(0, 3)
  const rot = rest.length >= 6 ? rest.slice(3, 6) : [0, 0, 0]
  ok(kind === e[0], `#${i + 1} 几何类型 ${kind} === ${e[0]}`)
  ok(params.every((v, k) => near(v, e[1][k])), `#${i + 1} 尺寸 ${JSON.stringify(params)} === ${JSON.stringify(e[1])}`)
  ok(pos.every((v, k) => near(v, e[2][k])), `#${i + 1} 位置 ${JSON.stringify(pos)} === ${JSON.stringify(e[2])}`)
  const erot = e[3] || [0, 0, 0]
  ok(rot.every((v, k) => near(v, erot[k])), `#${i + 1} 旋转 ${JSON.stringify(rot)} === ${JSON.stringify(erot)}`)
  ok(rest.length === 3 || rest[6] === undefined, `#${i + 1} 挂在 scene（未传父节点）`)
})

/* ── ③ 装配判据 ── */
console.log('\n③ 装配：installProp 全流程（registerProp / 无 mount / 无交互 / 无光源 / 无 update）')
const registry = createRegistry()
const installer = createPropInstaller({ registry, scheduler: createUpdateScheduler(), mounts: null })
let rec = null
try { rec = installer.install(diningTable, { ctx: { scene: null, L, put, box, edge, log } }) } catch (e) { ok(false, `install 抛错：${e.message}`) }
ok(!!rec, 'install 返回装配记录')
ok(registry.stats().props === 1, 'registry 里恰好 1 件物件')
ok(rec && rec.prop.id === 'floor1/dining-table' && rec.prop.kind === 'furniture', 'id / kind 正确')
ok(rec && rec.interactions.length === 0 && rec.task === null, '无交互、无 update 任务')

console.log(fail.length ? `\n✗ ${fail.length} 项不通过\n` : '\n✓ 全部通过\n')
process.exit(fail.length ? 1 : 0)
