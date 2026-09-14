// 一次性搬迁脚本：把单文件 index.html 拆为 CSS / HTML / JS 三部分
// 只在 F1 阶段使用一次；执行后可删除。
import fs from 'node:fs'
import path from 'node:path'

const SRC = 'D:/FireflyQAQ/Project/FrontProj/line-art-style-magic-cabin-main/index.html'
const ROOT = 'D:/FireflyQAQ/Project/FrontProj/Magic-cabin'

const text = fs.readFileSync(SRC, 'utf8')
const lines = text.split(/\r?\n/)          // 1-based 访问用 lines[i-1]

const slice = (a, b) => lines.slice(a - 1, b).join('\n')   // 闭区间 [a, b]

// ── 1. CSS：第 10–748 行（<style> 9 / </style> 749） ──
const css = `/* 魔法小木屋 —— 样式（原 index.html 第 10–748 行原样搬迁）
 *
 * 内容零改动。F1 阶段的搬迁原则：只搬位置，不改实现。
 * 后续可拆分为 base / ui / editors / touch 等模块（见 docs/MIGRATION.md）。
 */
${slice(10, 748)}
`
fs.writeFileSync(path.join(ROOT, 'src/styles/cabin.css'), css, 'utf8')

// ── 2. 主脚本：第 844–9807 行（IIFE 的 (function(){ 到 })();） ──
const body = slice(844, 9807)
const monolith = `/**
 * 魔法小木屋 —— 原始实现（原样搬迁，F1 阶段）
 *
 * 来源：line-art-style-magic-cabin-main/index.html 第 844–9807 行
 * 改动：**仅两处**
 *   ① 顶部新增 \`import * as THREE from 'three'\`（原为全局 THREE，来自 three.min.js）
 *   ② 文件末尾无改动（IIFE 自执行，行为与原来一致）
 *
 * ⚠️ 本文件在 F4/F5 阶段会被逐步掏空：
 *   每一件物件迁出为 src/cabin/world/\\*\\*/[name].ts 后，就从这里删除对应区段，
 *   直到文件清空删除。搬迁期间它始终是**画面与行为的唯一真值来源**。
 *
 * 分区地图（原注释分区 → 目标模块）见 docs/MIGRATION.md §3。
 */
import * as THREE from 'three'

${body}
`
fs.writeFileSync(path.join(ROOT, 'src/cabin/legacy/monolith.js'), monolith, 'utf8')

// ── 3. body DOM：第 753–835 行 ──
const dom = slice(753, 835)
fs.writeFileSync(path.join(ROOT, '_body-dom.fragment.html'), dom, 'utf8')

console.log('CSS      →', css.split('\n').length, '行')
console.log('monolith →', monolith.split('\n').length, '行')
console.log('body DOM →', dom.split('\n').length, '行')
