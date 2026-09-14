import fs from 'node:fs'
const SRC='D:/FireflyQAQ/Project/FrontProj/line-art-style-magic-cabin-main/index.html'
const ROOT='D:/FireflyQAQ/Project/FrontProj/Magic-cabin'
const srcLines=fs.readFileSync(SRC,'utf8').split(/\r?\n/)
const want=srcLines.slice(843,9807).join('\n')          // 844..9807
const mono=fs.readFileSync(`${ROOT}/src/cabin/legacy/monolith.js`,'utf8')
const marker="import * as THREE from 'three'\n"
const got=mono.slice(mono.indexOf(marker)+marker.length).replace(/^\n/,'')
console.log('want 长度:',want.length,' got 长度:',got.length,' 差:',got.length-want.length)
let i=0; while(i<Math.min(want.length,got.length)&&want[i]===got[i])i++
console.log('首个差异位置:',i)
console.log('want 上下文:',JSON.stringify(want.slice(Math.max(0,i-60),i+60)))
console.log('got  上下文:',JSON.stringify(got.slice(Math.max(0,i-60),i+60)))
console.log('--- 末尾对比 ---')
console.log('want 尾:',JSON.stringify(want.slice(-40)))
console.log('got  尾:',JSON.stringify(got.slice(-40)))
