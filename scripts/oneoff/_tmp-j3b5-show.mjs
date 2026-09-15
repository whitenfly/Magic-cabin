import fs from 'node:fs'
import path from 'node:path'
const ROOT = path.resolve(import.meta.dirname, '../..')
const lines = fs.readFileSync(path.join(ROOT, 'src/cabin/legacy/monolith.js'), 'utf8').split('\n')
const ranges = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '_tmp-j3b5-show.json'), 'utf8'))
for (const [a, b] of ranges) {
  console.log(`--- ${a}..${b} ---`)
  for (let i = a; i <= b; i++) console.log(`${String(i).padStart(5)}|${lines[i - 1]}`)
}
