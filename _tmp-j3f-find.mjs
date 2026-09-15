/** 临时：定位若干行（非交付物） */
import fs from 'node:fs'
const L = fs.readFileSync('src/cabin/legacy/monolith.js', 'utf8').split('\n')
const find = (w) => { const r = []; L.forEach((l, i) => { if (l.includes(w)) r.push(i + 1) }); return r }
const show = (a, b) => { for (let i = a; i <= b; i++) console.log(i + ': ' + L[i - 1]) }
for (const w of process.argv.slice(2)) {
  if (w.startsWith('@')) { const [a, b] = w.slice(1).split('-').map(Number); console.log(`--- L${a}-${b} ---`); show(a, b); continue }
  console.log(w.padEnd(36), JSON.stringify(find(w)))
}
