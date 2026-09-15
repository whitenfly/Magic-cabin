/**
 * 18.15 毛茸茸大地毯（右前角与书桌之间） —— `J3` 搬迁
 *
 * 来源：`legacy/monolith.js` 原 `18.15` 分区（原 `index.html` L5756–5836 一带）。
 * **几何代码原样搬运**，只做三处搬迁必需的调整：
 *   ① `rugG` / `rugCv` / `rctx` / `rugTex` / `canvasRoundRect` / `drawRug` 这些原本悬在 IIFE 里的
 *      顶层声明，全部收进 `build()`（它们只在本段被使用，已 grep 核对）；
 *   ② 坐标 `2.7` / `0.7` 按不变量 `N9` 提进 `world/layout.js`（`RUG2_X` / `RUG2_Z`，数值一个没改）；
 *   ③ `textureRng` 改从 ctx 的 `rng.texture` 解构（同一个种子随机源实例，调用**次数与顺序**未变
 *      —— 这正是"像素零差异"的关键之一，见 `defineProp.js` 的三条纪律）。
 *
 * ## ★ 关于本文件里那份 `crboxCol`（唯一一处"多出来的代码"，务必知情）
 *
 * 原段里那一行 `rugG.add(crboxCol(2.2, 0.04, 1.8, 0.02, 0x7d5064));`，
 * 而 `crboxCol` 是 monolith 里 `/* 18.10 *\/` 分区开头定义的**共享工具函数**
 * （原 L4582–4588，被衣柜 / 挎包 / 坐垫 / 相框 / 镜子 … 十几处调用），
 * 它住在 IIFE 闭包里、**不在 ctx 的可用键里**（ctx 只有 `roundBoxGeo` / `rbox` / `MAT` …）。
 *
 * 因此这里做了一件必须显式声明的事：**把 `crboxCol` 逐字复刻一份到 `build()` 的私有作用域**，
 * 好让原段的调用行**一字不改**地留下来（比"把这一行拆成 5 行内联展开"更忠实于"原样搬运"）。
 * 复刻体与被搬走的实现逐字相同，且用的是**同一个** `roundBoxGeo`（ctx 注入）与**同一个** `MAT`
 * （ctx 传入的共享线材质实例）—— 输出对象（Group + Mesh + LineSegments 的层级、几何参数、
 * 材质参数、父节点）与搬迁前逐项一致，故像素零差异。
 *
 * ⚠️ 知会：这是"共享工具函数尚未提取"导致的重复。等 `cbox` / `crboxCol` / `crumpleBall` /
 * `arcPos` / `smooth` 这批工具统一提取进 `core/geometry` 并由 ctx 注入后，本段应改回用 ctx 的版本、
 * 删掉这份复刻（见报告里的"给上下游的提醒"）。
 *
 * 无状态、无交互、无光源、无 `update` —— 纯装饰。
 */
import * as THREE from 'three'
import { defineProp } from '../../app/defineProp.js'

export default defineProp({
  id: 'floor2/rug-large',
  kind: 'decor',

  build({ scene, L, rng, roundBoxGeo, MAT }) {
    const { RUG2_X, RUG2_Z, FY } = L
    const textureRng = rng.texture

    /* `crboxCol` —— monolith（IIFE 闭包）里"圆角盒 + 彩色面 + 描边"的共享工具，逐字复刻 */
    function crboxCol(w, h, d, r, col) {
      const grp = new THREE.Group();
      const g = roundBoxGeo(w, h, d, r);
      grp.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: col, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })));
      grp.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, 12), MAT));
      return grp;
    }

    const rugG = new THREE.Group();
    rugG.position.set(RUG2_X, FY + 0.02, RUG2_Z);
    scene.add(rugG);
    const rugCv = document.createElement('canvas');
    rugCv.width = 512;
    rugCv.height = 420;
    const rctx = rugCv.getContext('2d');
    const rugTex = new THREE.CanvasTexture(rugCv);
    {
      rugG.add(crboxCol(2.2, 0.04, 1.8, 0.02, 0x7d5064));
      const rugPlane = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.8), new THREE.MeshBasicMaterial({ map: rugTex }));
      rugPlane.rotation.x = -Math.PI / 2;
      rugPlane.position.y = 0.024;
      rugG.add(rugPlane);
    }
    function canvasRoundRect(c, x, y, w, h, r) {
      c.beginPath();
      c.moveTo(x + r, y);
      c.lineTo(x + w - r, y);
      c.arcTo(x + w, y, x + w, y + r, r);
      c.lineTo(x + w, y + h - r);
      c.arcTo(x + w, y + h, x + w - r, y + h, r);
      c.lineTo(x + r, y + h);
      c.arcTo(x, y + h, x, y + h - r, r);
      c.lineTo(x, y + r);
      c.arcTo(x, y, x + r, y, r);
      c.closePath();
    }
    function drawRug() {
      const c = rctx;
      c.fillStyle = '#8a5a70';
      c.fillRect(0, 0, 512, 420);
      c.strokeStyle = '#e9dcc8';
      c.lineWidth = 7;
      canvasRoundRect(c, 22, 22, 468, 376, 34);
      c.stroke();
      c.lineWidth = 2.5;
      canvasRoundRect(c, 38, 38, 436, 344, 26);
      c.stroke();
      c.fillStyle = '#e9dcc8';
      c.beginPath(); c.arc(225, 210, 60, 0, 7); c.fill();
      c.fillStyle = '#8a5a70';
      c.beginPath(); c.arc(248, 194, 52, 0, 7); c.fill();
      c.fillStyle = '#e9dcc8';
      c.font = '34px serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('✦', 320, 160);
      c.fillText('✧', 360, 215);
      c.fillText('✦', 318, 262);
      c.font = '22px serif';
      c.fillText('✧', 78, 76); c.fillText('✦', 434, 76);
      c.fillText('✦', 78, 344); c.fillText('✧', 434, 344);
      for (let i = 0; i < 3400; i++) {
        const x = textureRng() * 512, y = textureRng() * 420;
        const a = textureRng() * Math.PI * 2;
        const l = 4 + textureRng() * 7;
        c.strokeStyle = textureRng() < 0.5 ? 'rgba(255,214,228,0.09)' : 'rgba(48,20,36,0.09)';
        c.lineWidth = 1.6;
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
        c.stroke();
      }
      c.strokeStyle = '#c9a2b4';
      c.lineWidth = 2;
      for (let i = 0; i < 58; i++) {
        const x = 14 + i * 8.4;
        c.beginPath(); c.moveTo(x, 26); c.lineTo(x + (textureRng() - 0.5) * 7, 5 + textureRng() * 6); c.stroke();
        c.beginPath(); c.moveTo(x, 394); c.lineTo(x + (textureRng() - 0.5) * 7, 415 - textureRng() * 6); c.stroke();
      }
      for (let i = 0; i < 46; i++) {
        const y = 14 + i * 8.6;
        c.beginPath(); c.moveTo(26, y); c.lineTo(5 + textureRng() * 6, y + (textureRng() - 0.5) * 7); c.stroke();
        c.beginPath(); c.moveTo(486, y); c.lineTo(507 - textureRng() * 6, y + (textureRng() - 0.5) * 7); c.stroke();
      }
      rugTex.needsUpdate = true;
    }
    drawRug();

    // 返回根对象 ⇒ `installProp` 据此登记（`registry.registerProp` 的 id 查重在这里生效）
    return rugG
  },
})
