/**
 * 一次性诊断：找出 `astro dev` 崩溃时是**谁**在 import `picomatch`（CJS）。
 *
 * 背景：`astro build` 与 `astro dev` 都会报
 *   `require is not defined  at eval (…/picomatch/index.js:…)  at ModuleRunner.directRequest`
 * 构建那条已经用"零依赖内容加载器"绕过了；dev 这条还需要定位真正的导入方。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (p.endsWith('.js') || p.endsWith('.mjs')) out.push(p)
  }
  return out
}

function scan(label, dir) {
  if (!fs.existsSync(dir)) return console.log(`${label}: 目录不存在 ${dir}`)
  const files = walk(dir)
  const importers = []
  const mentioners = []
  for (const f of files) {
    const s = fs.readFileSync(f, 'utf8')
    if (!s.includes('picomatch')) continue
    mentioners.push(path.relative(ROOT, f).replace(/\\/g, '/'))
    // 真正的 import / require（含 from 'picomatch' 与 import('picomatch')）
    if (/from\s*['"]picomatch['"]/.test(s) || /require\(\s*['"]picomatch['"]\s*\)/.test(s) || /import\(\s*['"]picomatch['"]\s*\)/.test(s)) {
      const line = s.split('\n').find((l) => l.includes('picomatch') && /(from|require|import)/.test(l))
      importers.push(`${path.relative(ROOT, f).replace(/\\/g, '/')}\n      ${(line ?? '').trim().slice(0, 150)}`)
    }
  }
  console.log(`\n── ${label} ──`)
  console.log(`  提到 picomatch 的文件：${mentioners.length}`)
  console.log(`  其中真正 import 的：${importers.length}`)
  for (const i of importers) console.log(`    · ${i}`)
  if (!importers.length && mentioners.length) {
    for (const m of mentioners.slice(0, 8)) console.log(`    (仅提及) ${m}`)
  }
}

scan('astro/dist', path.join(ROOT, 'node_modules/astro/dist'))

// vite 装在哪
const pnpm = path.join(ROOT, 'node_modules/.pnpm')
const viteDir = fs
  .readdirSync(pnpm)
  .filter((n) => /^vite@/.test(n))
  .map((n) => path.join(pnpm, n, 'node_modules/vite/dist'))
  .filter((d) => fs.existsSync(d))
for (const d of viteDir) scan(`vite (${path.basename(path.dirname(path.dirname(d)))})`, d)
