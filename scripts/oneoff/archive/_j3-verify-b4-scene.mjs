/**
 * B4 场景图等价性核对（4 层：场景图摘要 + 动态逐帧） —— `J3` 搬迁的证据脚本
 *
 * 来源：新增（`J3` B4）。它回答的问题只有一个：
 *
 * > **把 18.10 的衣柜 / 18.11 的墙钩挎包·置物箱·魔女帽·垃圾桶·抽纸盒搬成
 * > `world/floor2/**` 之后，场景图还是不是同一张？**
 *
 * 像素回归（`pnpm test:visual`）比较的是**结果**；本脚本比较的是**成因** ——
 * 它把**迁移前**的 monolith 区段（从 `git HEAD` 里取，程序化切片，不手抄）
 * 与**迁移后**的 6 个 `defineProp` 模块放进同一个装配环境里各建一遍，
 * 然后逐节点比对：层级路径 / 对象类型 / 位置 / 旋转 / 缩放 / `visible` /
 * 几何类型与全部参数 / 材质（颜色·透明度·透明开关·side·polygonOffset·贴图尺寸）/
 * 契约 `userData`（`base` `delta` `spring` `slide` `wob` `bounce` …）。
 *
 * 两条判据：
 *   ① **静态**：装配完成后的场景图摘要逐行相同（节点数也必须相同）；
 *   ② **动态**：触发魔女帽（起飞 → 悬浮撒糖 → 落回）与抽纸盒（抽纸 → 摊开 → 归位），
 *      连续 420 帧**每帧**比对 —— 这条同时验到了 `runtimeRng` 的**调用次数与顺序**
 *      （撒糖用的是一个可复现的 LCG 替身；顺序一变，糖的位置/转速就会分叉）。
 *
 * ## 用法
 *
 * ```bash
 * node scripts/oneoff/_j3-verify-b4-scene.mjs
 * ```
 *
 * ⚠️ 它用 `git show <REF>:src/cabin/legacy/monolith.js` 取"迁移前"的原文，
 * 所以**要在本批被提交之前运行**；提交之后请把 `REF` 改成"该批之前的那次提交"。
 * 若切片失败，脚本会直接抛错（不会给出"看起来通过"的假绿）。
 *
 * 只读：不写 `monolith.js` / `layout.js`，不启动浏览器。生成的临时模块写进系统临时目录。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import * as THREE from 'three'

import { createLayout } from '../../src/cabin/world/layout.js'
import { createSketch } from '../../src/cabin/core/geometry/sketch.js'
import { createRoundBox } from '../../src/cabin/core/geometry/roundBox.js'
import { createSolid } from '../../src/cabin/core/geometry/solid.js'
import { createLineMaterials } from '../../src/cabin/core/materials/lineMaterials.js'
import { createFillMaterial } from '../../src/cabin/core/materials/FillMaterial.js'
import { createLitMaterialFactory } from '../../src/cabin/core/materials/litMaterial.js'
import { createSpringSystem } from '../../src/cabin/core/util/spring.js'
import { createRegistry } from '../../src/cabin/app/Registry.js'
import { createUpdateScheduler } from '../../src/cabin/app/UpdateScheduler.js'
import { createPropInstaller } from '../../src/cabin/app/installProp.js'

import wardrobe from '../../src/cabin/world/floor2/wardrobe.js'
import bag from '../../src/cabin/world/floor2/bag.js'
import crate from '../../src/cabin/world/floor2/crate.js'
import witchHat from '../../src/cabin/world/floor2/witchHat.js'
import bin from '../../src/cabin/world/floor2/bin.js'
import tissueBox from '../../src/cabin/world/floor2/tissueBox.js'

/** 取"迁移前"的 monolith 的 git 引用（本批提交后改成该批之前的提交） */
const REF = process.env.J3_B4_REF || 'HEAD'
const ROOT = path.resolve(import.meta.dirname, '../..')

/* ── 程序化抽取原区段（不手抄；小凳子 L4693–L4729 本批不搬，故跳过） ─────── */
const monoText = execFileSync('git', ['show', `${REF}:src/cabin/legacy/monolith.js`], {
  encoding: 'utf8', maxBuffer: 1 << 28, cwd: ROOT,
})
const monoLines = monoText.split('\n')
function sliceBetween(startMarker, endMarker) {
  const a = monoLines.findIndex((l) => l === startMarker)
  const b = monoLines.findIndex((l, i) => i > a && l === endMarker)
  if (a < 0 || b < 0) throw new Error(`切片失败：${startMarker.trim()} → ${endMarker.trim()}（a=${a} b=${b}；REF 是否早于本批？）`)
  return monoLines.slice(a, b).join('\n')
}
const M_WARDROBE = '            /* 衣柜 */'
const M_1811 = '            /* 18.11 墙钩挎包 / 置物箱与魔女帽 / 可推拉小凳子 */'
const M_STOOL = '            /* 可推拉小凳子（挎包下方、箱子旁的地上，点击拉出/推回） */'
const M_HAT = '            /* 魔女帽：更大帽檐 + 低弯折尖，点击飞起撒糖果 */'
const M_1812 = '            /* 18.12 烟囱墙：魔法时钟（与现实时间同步） */'
const partA = sliceBetween(M_WARDROBE, M_1811)  // 衣柜
const partB = sliceBetween(M_1811, M_STOOL)     // 墙钩挎包 + 置物箱
const partC = sliceBetween(M_HAT, M_1812)       // 魔女帽 + 垃圾桶 + 抽纸盒

const THREE_URL = pathToFileURL(path.join(ROOT, 'node_modules/three/build/three.module.js')).href
const GEN = `import * as THREE from '${THREE_URL}'
export function buildOriginal(ctx) {
    const { scene, L, V, geo, line, iline, dline, edge, box, log, put, logBetween, lloop, solid, solidCyl, roundBoxGeo, rbox, colEdge, cbox, crboxCol, crumpleBall, arcPos, jitterGeo, hash01, smooth, regSlide, registerHinge, regWobble, regMagic, MAT, LITMAT, DARK, PINK, HITMAT, SND, clock } = ctx
    const { FY, TBL_TOP } = L
    const runtimeRng = ctx.rng.runtime
${partA}
${partB}
${partC}
    return { updateTissue, updateHat, updateCandies }
}
`
const genPath = path.join(os.tmpdir(), `_j3-b4-orig-${process.pid}.mjs`)
fs.writeFileSync(genPath, GEN, 'utf8')
const { buildOriginal } = await import(pathToFileURL(genPath).href)
fs.rmSync(genPath, { force: true })

/* ── monolith IIFE 内那几个共享工具的逐字副本（两边共用同一份实现） ───────── */
function hash01(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 997
  return h / 997
}
function jitterGeo(geo, amp) {
  const pa = geo.attributes.position
  for (let i = 0; i < pa.count; i++) {
    const k = pa.getX(i).toFixed(3) + ',' + pa.getY(i).toFixed(3) + ',' + pa.getZ(i).toFixed(3)
    pa.setXYZ(i, pa.getX(i) + (hash01(k + 'x') - 0.5) * 2 * amp, pa.getY(i) + (hash01(k + 'y') - 0.5) * 2 * amp, pa.getZ(i) + (hash01(k + 'z') - 0.5) * 2 * amp)
  }
  geo.computeVertexNormals()
  return geo
}

function makeTools(scene) {
  const { MAT, DASHMAT, IN_MAT } = createLineMaterials()
  const FILL = createFillMaterial()
  const LITMAT = createLitMaterialFactory(FILL)
  const sketch = createSketch({ scene, materials: { line: MAT, inner: IN_MAT, dash: DASHMAT, fill: FILL } })
  const { roundBoxGeo, rbox } = createRoundBox({ edge: sketch.edge })
  const CATMAT = LITMAT(0xece6da)
  const { lloop, solid, solidCyl } = createSolid({ V: sketch.V, geo: sketch.geo, scene, lineMaterial: MAT, defaultSolidMaterial: CATMAT })
  return { ...sketch, ...createSpringSystem(), MAT, DASHMAT, IN_MAT, FILL, LITMAT, roundBoxGeo, rbox, lloop, solid, solidCyl }
}

function makeCtx(scene, L, t) {
  const { MAT, LITMAT, roundBoxGeo } = t
  function cbox(w, h, d, col) {
    const grp = new THREE.Group()
    const g = new THREE.BoxGeometry(w, h, d)
    grp.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: col, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })))
    grp.add(new THREE.LineSegments(new THREE.EdgesGeometry(g), MAT))
    return grp
  }
  function crboxCol(w, h, d, r, col) {
    const grp = new THREE.Group()
    const g = roundBoxGeo(w, h, d, r)
    grp.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: col, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })))
    grp.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, 12), MAT))
    return grp
  }
  function crumpleBall(r) {
    const grp = new THREE.Group()
    const g = jitterGeo(new THREE.SphereGeometry(r, 10, 8), r * 0.15)
    grp.add(new THREE.Mesh(g, LITMAT(0xffffff, { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })))
    grp.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, 20), MAT))
    return grp
  }
  function arcPos(a, b, k, h) {
    const p = a.clone().lerp(b, k)
    p.y += Math.sin(Math.PI * k) * h
    return p
  }
  function colEdge(g, col, th) {
    const grp = new THREE.Group()
    grp.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: col, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })))
    grp.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, th === undefined ? 20 : th), MAT))
    return grp
  }
  const wob = []
  return {
    ...t, scene, L,
    cbox, crboxCol, crumpleBall, arcPos, colEdge, jitterGeo, hash01,
    smooth: (k) => k * k * (3 - 2 * k),
    regWobble: (g) => { g.userData.wob = { amp: 0, t: 0 }; wob.push(g) },
    regMagic: (o, fn) => { o.userData.onClick = fn; return o },
    HITMAT: new THREE.MeshBasicMaterial(), DARK: LITMAT(0x2b2b2b), PINK: LITMAT(0xd98a94),
    CATMAT: LITMAT(0xece6da), CATMAT2: LITMAT(0xe2dbcd),
    SND: { play: () => {} },
    clock: { now: 0 },
    rng: { runtime: () => 0.5 },
  }
}

/** 与 spec 里声明的 layout 常量一致（应用器负责把它们写进 layout.js） */
function withSharedLayout(L) {
  L.WD_X = -1.40; L.WD_Z = 3.55
  L.BAG_HOOK_X = 0.15; L.BAG_HOOK_Y = L.FY + 1.38; L.BAG_HOOK_Z = 3.825
  L.CRATE_X = 0.95; L.CRATE_Z = 3.48
  L.CR_W = 0.68; L.CR_D = 0.55; L.CR_H = 0.32; L.CRATE_TOP = L.FY + L.CR_H + 0.092
  L.BIN_X = 1.85; L.BIN_Z = -3.40; L.BIN_H = 0.60
  L.TISSUE_X = 1.42; L.TISSUE_Z = -2.15
  return L
}

const round = (n) => (typeof n === 'number' ? Math.round(n * 1e6) / 1e6 : n)
const geoParams = (g) => {
  const out = {}
  for (const [k, v] of Object.entries(g.parameters || {})) {
    if (v && v.isVector2) out[k] = [round(v.x), round(v.y)]
    else if (Array.isArray(v)) out[k] = v.map((x) => (x && x.x !== undefined ? [round(x.x), round(x.y), round(x.z)] : round(x)))
    else if (v && v.x !== undefined) out[k] = [round(v.x), round(v.y), round(v.z)]
    else if (v && v.points) out[k] = v.points.map((q) => [round(q.x), round(q.y), round(q.z)])
    else out[k] = round(v)
  }
  return JSON.stringify(out)
}
/** `aimLabel` / `onClick` / `sfx` 不在比较范围内：它们是 `installProp` 的 aim 桥写上去的**元数据**（不参与渲染） */
const UD_KEYS = ['base', 'delta', 'spring', 'slide', 'wob', 'bounce', 'isFire', 'out', 'run']
function digest(scene) {
  const out = []
  const walk = (o, path) => {
    const u = o.userData || {}
    out.push(JSON.stringify({
      path, type: o.type,
      pos: [round(o.position.x), round(o.position.y), round(o.position.z)],
      rot: [round(o.rotation.x), round(o.rotation.y), round(o.rotation.z)],
      scl: [round(o.scale.x), round(o.scale.y), round(o.scale.z)],
      visible: o.visible,
      geo: o.geometry ? o.geometry.type + ':' + geoParams(o.geometry) : null,
      mat: o.material ? [o.material.type,
        o.material.color && o.material.color.isColor ? '#' + o.material.color.getHex().toString(16) : null,
        round(o.material.opacity), !!o.material.transparent, o.material.side,
        o.material.polygonOffset ? [o.material.polygonOffsetFactor, o.material.polygonOffsetUnits] : null,
        o.material.map ? 'map:' + (o.material.map.image ? o.material.map.image.width + 'x' + o.material.map.image.height : '?') : null,
      ] : null,
      ud: Object.keys(u).filter((k) => UD_KEYS.includes(k)).sort().map((k) => k + '=' + JSON.stringify(u[k])),
    }))
    o.children.forEach((c, i) => walk(c, `${path}/${i}`))
  }
  scene.children.forEach((c, i) => walk(c, String(i)))
  return out
}

/* ── 甲：原区段 ─────────────────────────────────────────────────────── */
const sceneA = new THREE.Scene()
const ctxA = makeCtx(sceneA, withSharedLayout(createLayout()), makeTools(sceneA))
let seedA = 12345
ctxA.rng.runtime = () => { seedA = (seedA * 1103515245 + 12345) % 2147483648; return seedA / 2147483648 }
const origApi = buildOriginal(ctxA)

/* ── 乙：6 个新模块（按搬迁前的顺序装配） ────────────────────────────── */
const sceneB = new THREE.Scene()
const ctxB = makeCtx(sceneB, withSharedLayout(createLayout()), makeTools(sceneB))
let seedB = 12345
ctxB.rng.runtime = () => { seedB = (seedB * 1103515245 + 12345) % 2147483648; return seedB / 2147483648 }
const registry = createRegistry()
const scheduler = createUpdateScheduler()
const installer = createPropInstaller({ registry, scheduler, ctx: ctxB })
const recs = {}
for (const p of [wardrobe, bag, crate, witchHat, bin, tissueBox]) recs[p.id] = installer.install(p)

let failures = 0
const report = (label, a, b, max = 6) => {
  let bad = 0
  const n = Math.max(a.length, b.length)
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) {
      bad++
      if (bad <= max) console.log(`  ✗ #${i}\n    原: ${a[i]}\n    新: ${b[i]}`)
    }
  }
  console.log(`── ${label}：节点 ${a.length} / ${b.length} → ${bad ? bad + ' 处差异' : '逐行完全相同 ✓'}`)
  return bad
}

console.log('')
console.log('  J3 · B4 场景图等价性核对（原区段 vs 6 个新模块）')
console.log(`  原区段取自  git show ${REF}:src/cabin/legacy/monolith.js`)
console.log('')
failures += report('① 静态（装配完成后的场景图）', digest(sceneA), digest(sceneB))

/* ── ② 动态：420 帧，中途触发魔女帽与抽纸盒 ──────────────────────────── */
const dt = 1 / 60
let t = 0
const tickA = (time) => { origApi.updateTissue(time, dt); origApi.updateHat(time, dt); origApi.updateCandies(dt) }
const tickB = (time) => { recs['floor2/tissue-box'].tick(dt, time); recs['floor2/witch-hat'].tick(dt, time) }
const findByPos = (scene, x, y, z) => scene.children.find((o) => Math.abs(o.position.x - x) < 1e-9 && Math.abs(o.position.y - y) < 1e-9 && Math.abs(o.position.z - z) < 1e-9)

for (let i = 0; i < 5; i++) { t += dt; tickA(t); tickB(t) }
const LA = ctxA.L
ctxA.clock.now = t // 原实现：点击时读 clock.now（= 上一帧的 time，与新实现的 s.now 恒等）
findByPos(sceneA, LA.CRATE_X, LA.CRATE_TOP, LA.CRATE_Z).userData.onClick()
findByPos(sceneA, LA.TISSUE_X, LA.TBL_TOP, LA.TISSUE_Z).userData.onClick()
registry.interactables.find((e) => e.id === 'witch-hat/fly').onActivate()
registry.interactables.find((e) => e.id === 'tissue-box/pull').onActivate()

let dynamicBad = 0
for (let i = 0; i < 420; i++) {
  t += dt
  tickA(t); tickB(t)
  const a = digest(sceneA), b = digest(sceneB)
  if (a.length !== b.length || a.some((line, k) => line !== b[k])) {
    dynamicBad = report(`② 第 ${i + 1} 帧`, a, b)
    break
  }
}
if (!dynamicBad) console.log('── ② 动态 420 帧（魔女帽起飞撒糖 + 抽纸盒抽纸摊开）：每帧逐行完全相同 ✓')
failures += dynamicBad

console.log('')
console.log(failures ? `  ✗ ${failures} 项不通过\n` : '  ✓ 静态 + 动态全部一致\n')
process.exit(failures ? 1 : 0)
