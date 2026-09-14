// 组装 index.html：新骨架（SEO/门厅预留）+ 原 body DOM 原样
import fs from 'node:fs'
import path from 'node:path'

const ROOT = 'D:/FireflyQAQ/Project/FrontProj/Magic-cabin'
const dom = fs.readFileSync(path.join(ROOT, '_body-dom.fragment.html'), 'utf8').replace(/\s+$/, '')

const html = `<!DOCTYPE html>
<html lang="zh">

<head>
    <meta charset="utf-8">
    <meta name="viewport"
        content="width=device-width, initial-scale=1, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
    <title>线稿风格魔女小屋</title>
    <meta name="description" content="一个线稿风格的 3D 魔法小屋。操控一只软软的史莱姆在魔法小屋里生活。">
    <!--
      样式与脚本全部由 Vite 从 src/ 打包注入。
      原单文件版本的 <style> 已迁至 src/styles/cabin.css，
      主脚本已迁至 src/cabin/legacy/monolith.js（原样，零逻辑改动）。

      门厅策略（ArtLine-Part/03 §8.3、08 §4.4）：
      F1 阶段由 src/main.ts 直接启动 3D；
      F6 阶段将改为「门厅 HTML 先渲染 → 3D 空闲时挂载」，届时本文件会新增
      文章列表与 <noscript> 降级内容。
    -->
</head>

<body>
${dom}

    <script type="module" src="/src/main.ts"></script>
</body>

</html>
`
fs.writeFileSync(path.join(ROOT, 'index.html'), html, 'utf8')
console.log('index.html →', html.split('\n').length, '行')
