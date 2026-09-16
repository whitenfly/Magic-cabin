/**
 * 天空 / 时间 / 天气 / 星空 —— 从 `legacy/monolith.js` 搬出的整段（weather）
 *
 * 来源：`J4` 段切片（段表见 `scripts/oneoff/_j4-segments.mjs`）。
 * 段内代码**逐字未改**，只做了三件事：包成函数、补 import、把跨段通信交给 `ctx`。
 * 因此这个文件的正确性判据与搬迁前完全一致：像素逐字节零差异。
 *
 * @param {object} ctx 段间通信载体（见 `installCabin` 的 `__J4_CTX__`）
 * @param {object} app 应用内核 —— 段里用到的 `registry`/`bus`/`scheduler`/`store` 从这里解构
 */
import * as THREE from 'three'
import { createEnvironment } from './environment.js'
import { createLightField } from '../../core/lighting/LightField.js'
import { createPointLightSource } from '../../core/lighting/PointLightSource.js'
import { runtime, scene } from '../../app/rng.js'

export function installWeatherSystem(ctx, app) {
  const { bus, registry, store } = app
  const skyRng = scene.sky
  const runtimeRng = runtime
            // ↓ J4 段导出（weather）：本段函数声明挂到 ctx（借提升，段内任何位置都可见）
            ctx.setWeather = setWeather; ctx.skyColorAt = skyColorAt; ctx.capDir = capDir; ctx.mwDir = mwDir; ctx.spawnMeteor = spawnMeteor; ctx.updateMeteors = updateMeteors;
            ctx.makeCloud = makeCloud; ctx.spawnBolt = spawnBolt; ctx.roofTopAt = roofTopAt;
            // J4.14：「每帧分支归位」把原 updateWeatherSystem() 拆成两段 —— 中间插入三个
            //        已归位到世界侧的帧任务（先后顺序见 app/scene/FrameBody.js）。
            ctx.updateWeatherAtmosphere = updateWeatherAtmosphere;
            ctx.updateWeatherEffects = updateWeatherEffects;
            ctx.gameSec = 10 * 3600, ctx.timeScale = store.get('time.scale');   // J2.8：时间流速来自设置
            const curHour = () => (ctx.gameSec / 3600) % 24;
            ctx.curHour = curHour;
            const WX_LIST = ['sunny', 'cloudy', 'fog', 'rain', 'storm', 'snow', 'blizzard'];
            ctx.WX_LIST = WX_LIST;
            const WX_NAME = { sunny: '晴', cloudy: '多云', fog: '雾', rain: '雨', storm: '暴雨', snow: '雪', blizzard: '暴雪' };
            ctx.WX_NAME = WX_NAME;
            const WX_CFG = {
                sunny: { clouds: 2, rain: 0, snow: 0, fog: 0, gray: 0, wind: 0.2 },
                cloudy: { clouds: 10, rain: 0, snow: 0, fog: 0.15, gray: 0.25, wind: 0.4 },
                fog: { clouds: 4, rain: 0, snow: 0, fog: 1.0, gray: 0.45, wind: 0.1 },
                rain: { clouds: 6, rain: 240, snow: 0, fog: 0.35, gray: 0.50, wind: 0.6 },
                storm: { clouds: 10, rain: 520, snow: 0, fog: 0.60, gray: 0.65, wind: 1.6 },
                snow: { clouds: 5, rain: 0, snow: 200, fog: 0.35, gray: 0.35, wind: 0.3 },
                blizzard: { clouds: 9, rain: 0, snow: 420, fog: 0.60, gray: 0.55, wind: 1.8 }
            };
            ctx.WX_CFG = WX_CFG;
            const wx = { type: 'sunny', random: false, timer: 14, clouds: 2, rain: 0, snow: 0, fog: 0, gray: 0, wind: 0.2 };
            ctx.wx = wx;
            const WIND_DIR = { x: 0.86, z: 0.51 };
            ctx.WIND_DIR = WIND_DIR;
            const wxChipsBox = document.getElementById('wxChips'), timeSlider = document.getElementById('timeSlider'), clockEl = document.getElementById('clock');
            ctx.wxChipsBox = wxChipsBox; ctx.timeSlider = timeSlider; ctx.clockEl = clockEl;
            const chipEls = [];
            ctx.chipEls = chipEls;
            for (const t of WX_LIST) { const b = document.createElement('div'); b.className = 'wxChip'; b.textContent = WX_NAME[t]; b.addEventListener('click', () => { ctx.SND.play('ui'); setWeather(t); }); wxChipsBox.appendChild(b); chipEls.push(b); }
            // J2.10：环境量（天气 / 时间 / 采光）有了唯一持有者，并通过 bus 广播 env:change。
            // 需要响应环境的东西改为**订阅事件**，而不是去读 wx.type / uDaylight（不变量 N1）。
            const environment = createEnvironment({ bus, fillMaterial: ctx.FILL });
            ctx.environment = environment;
            function setWeather(t) { wx.type = t; environment.setWeather(t); chipEls.forEach((el, i) => el.classList.toggle('on', WX_LIST[i] === t)); }
            setWeather('sunny');
            // J2.5：随机天气开关与流速滑杆都由 schema 生成（见 src/config/settings.config.js 的
            //      'weather.random' 与 'time.scale'），这里只订阅它们的值 —— 控件不再自己写状态。
            //      注意订阅只在**值变化**时触发，所以不会重置 `wx.timer` 的初值（与搬迁前一致）。
            store.subscribe('weather.random', ({ value }) => { wx.random = value; wx.timer = 6 + runtimeRng() * 10; });
            // 流速的非线性曲线（0–3600×）已搬到 config 的 `TIME_SCALE_CURVE`，公式一字未改；
            // 面板拖的是 0–1 的位置，存进 store 的与这里读到的都是**倍率**。
            store.subscribe('time.scale', ({ value }) => { ctx.timeScale = value; });
            ctx.draggingTime = false; timeSlider.addEventListener('pointerdown', () => ctx.draggingTime = true); addEventListener('pointerup', () => ctx.draggingTime = false);
            timeSlider.addEventListener('input', () => { ctx.gameSec = parseFloat(timeSlider.value) * 3600; });

            const SKY_STOPS = [
                [0.0, 0x040710], [3.5, 0x0d1322], [4.5, 0x1b2138], [5.3, 0x43355e],
                [6.0, 0x9c5a74], [6.4, 0xe8876a], [6.9, 0xffab7c], [7.5, 0xf7e3c8],
                [9.0, 0xfdfbf6], [15.0, 0xfdfbf6],
                [16.6, 0xfdeada], [17.4, 0xfcd3a0], [18.1, 0xffa268], [18.6, 0xf77452],
                [19.1, 0xc75a6e], [19.6, 0x6e4a78], [20.2, 0x33355e], [21.0, 0x141a30],
                [22.0, 0x080b14], [24.0, 0x040710]
            ];
            ctx.SKY_STOPS = SKY_STOPS;
            const _c1 = new THREE.Color(), _c2 = new THREE.Color(), _gray = new THREE.Color(), _sky = new THREE.Color(), _white = new THREE.Color(0xffffff), _amb = new THREE.Color(), _nightAmb = new THREE.Color(0x4a5570), _warm = new THREE.Color(0xffd9a0), _moonCol = new THREE.Color(0x8090a0), _fireGlowColor = new THREE.Color(0xff9040), _lampGlowColor = new THREE.Color(1.0, 0.76, 0.62);
            ctx._c1 = _c1; ctx._c2 = _c2; ctx._gray = _gray; ctx._sky = _sky; ctx._white = _white; ctx._amb = _amb;
            ctx._nightAmb = _nightAmb; ctx._warm = _warm; ctx._moonCol = _moonCol; ctx._fireGlowColor = _fireGlowColor; ctx._lampGlowColor = _lampGlowColor;
            function skyColorAt(h, out) { for (let i = 0; i < SKY_STOPS.length - 1; i++) { const [h0, c0] = SKY_STOPS[i]; const [h1, c1] = SKY_STOPS[i + 1]; if (h >= h0 && h <= h1) { const t = (h - h0) / (h1 - h0); return out.setHex(c0).lerp(_c2.setHex(c1), t); } } return out.setHex(SKY_STOPS[0][1]); }

            const glowCanvas = document.createElement('canvas');
            ctx.glowCanvas = glowCanvas; glowCanvas.width = 64; glowCanvas.height = 64; const gCtx = glowCanvas.getContext('2d');
            ctx.gCtx = gCtx;
            const gGrad = gCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
            ctx.gGrad = gGrad;
            gGrad.addColorStop(0, 'rgba(255,255,255,1)');
            gGrad.addColorStop(0.3, 'rgba(255,235,205,0.55)');
            gGrad.addColorStop(1, 'rgba(255,200,150,0)');
            gCtx.fillStyle = gGrad; gCtx.fillRect(0, 0, 64, 64);
            const glowTex = new THREE.CanvasTexture(glowCanvas);
            ctx.glowTex = glowTex;

            const sunGroup = new THREE.Group();
            ctx.sunGroup = sunGroup;
            const sunFillMat = new THREE.MeshBasicMaterial({ color: 0xffd75e, transparent: true, fog: false, side: THREE.DoubleSide });
            ctx.sunFillMat = sunFillMat;
            const sunLineMat = new THREE.LineBasicMaterial({ color: 0xc98a2e, transparent: true, fog: false });
            ctx.sunLineMat = sunLineMat;
            { const disc = new THREE.Mesh(new THREE.CircleGeometry(1.7, 28), sunFillMat); sunGroup.add(disc); sunGroup.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.CircleGeometry(1.7, 28), 15), sunLineMat)); const rayPts = []; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const c = Math.cos(a), s = Math.sin(a); rayPts.push(ctx.V(c * 2.05, s * 2.05, 0), ctx.V(c * 2.9, s * 2.9, 0)); } sunGroup.add(new THREE.LineSegments(ctx.geo(rayPts.map(p => [p.x, p.y, p.z])), sunLineMat)); }
            const sunGlowMatA = new THREE.MeshBasicMaterial({ map: glowTex, color: 0xffc8a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
            ctx.sunGlowMatA = sunGlowMatA;
            const sunGlowMatB = new THREE.MeshBasicMaterial({ map: glowTex, color: 0xff9760, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
            ctx.sunGlowMatB = sunGlowMatB;
            const sunGlowA = new THREE.Mesh(new THREE.PlaneGeometry(15, 15), sunGlowMatA);
            ctx.sunGlowA = sunGlowA;
            const sunGlowB = new THREE.Mesh(new THREE.PlaneGeometry(36, 36), sunGlowMatB);
            ctx.sunGlowB = sunGlowB;
            sunGlowA.position.z = 0.5; sunGlowB.position.z = 0.4;
            sunGroup.add(sunGlowA); sunGroup.add(sunGlowB);
            ctx.scene.add(sunGroup);

            const moonGroup = new THREE.Group();
            ctx.moonGroup = moonGroup;
            const moonFillMatA = new THREE.MeshBasicMaterial({ color: 0xcdb8f0, transparent: true, fog: false, side: THREE.DoubleSide });
            ctx.moonFillMatA = moonFillMatA;
            const moonLineMatA = new THREE.LineBasicMaterial({ color: 0x8068a8, transparent: true, fog: false });
            ctx.moonLineMatA = moonLineMatA;
            const moonFillMatB = new THREE.MeshBasicMaterial({ color: 0xbdd9f2, transparent: true, fog: false, side: THREE.DoubleSide });
            ctx.moonFillMatB = moonFillMatB;
            const moonLineMatB = new THREE.LineBasicMaterial({ color: 0x6088a8, transparent: true, fog: false });
            ctx.moonLineMatB = moonLineMatB;
            {
                const mA = new THREE.Group();
                mA.add(new THREE.Mesh(new THREE.CircleGeometry(1.3, 32), moonFillMatA));
                mA.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.CircleGeometry(1.3, 32), 15), moonLineMatA));
                for (const [kx, ky, kr] of [[0.38, 0.34, 0.28], [-0.36, -0.22, 0.18], [0.05, -0.5, 0.13]]) { const crater = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.CircleGeometry(kr, 12), 15), moonLineMatA); crater.position.set(kx, ky, 0.02); mA.add(crater); }
                mA.position.set(-2.0, 0.2, 0); moonGroup.add(mA);
                const mB = new THREE.Group();
                mB.add(new THREE.Mesh(new THREE.CircleGeometry(0.9, 26), moonFillMatB));
                mB.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.CircleGeometry(0.9, 26), 15), moonLineMatB));
                mB.position.set(2.2, -0.15, 0.05);
                moonGroup.add(mB);
            }
            const moonGlowMat = new THREE.MeshBasicMaterial({ map: glowTex, color: 0x93a8e8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
            ctx.moonGlowMat = moonGlowMat;
            const moonGlow = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), moonGlowMat);
            ctx.moonGlow = moonGlow;
            moonGlow.position.z = 0.3; moonGroup.add(moonGlow);
            ctx.scene.add(moonGroup);

            /* ============ 星空 ============ */
            function capDir(yMin) {
                const y = yMin + skyRng() * (1 - yMin);
                const t = Math.sqrt(Math.max(0, 1 - y * y));
                const th = skyRng() * Math.PI * 2;
                return { x: t * Math.cos(th), y: y, z: t * Math.sin(th) };
            }
            const mwN = ctx.V(0.58, 0.72, 0.38).normalize();
            ctx.mwN = mwN;
            const mwU = ctx.V(1, 0, 0).addScaledVector(mwN, -mwN.x).normalize();
            ctx.mwU = mwU;
            const mwV = new THREE.Vector3().crossVectors(mwN, mwU);
            ctx.mwV = mwV;
            function mwDir(yMin) {
                for (let k = 0; k < 40; k++) {
                    const a = skyRng() * Math.PI * 2;
                    const g = (skyRng() + skyRng() + skyRng() - 1.5) / 1.5 * 0.30;
                    const ca = Math.cos(a), sa = Math.sin(a);
                    const dx = mwU.x * ca + mwV.x * sa + mwN.x * g;
                    const dy = mwU.y * ca + mwV.y * sa + mwN.y * g;
                    const dz = mwU.z * ca + mwV.z * sa + mwN.z * g;
                    const dl = Math.hypot(dx, dy, dz);
                    if (dy / dl >= yMin) return { x: dx / dl, y: dy / dl, z: dz / dl };
                }
                return capDir(yMin);
            }

            const STAR_COUNT = 750;
            ctx.STAR_COUNT = STAR_COUNT;
            const MW_COUNT = 1650;
            ctx.MW_COUNT = MW_COUNT;
            const TOTAL_STARS = STAR_COUNT + MW_COUNT;
            ctx.TOTAL_STARS = TOTAL_STARS;
            const starPos = new Float32Array(TOTAL_STARS * 3);
            ctx.starPos = starPos;
            const starTwinkle = new Float32Array(TOTAL_STARS);
            ctx.starTwinkle = starTwinkle;
            const starSpeed = new Float32Array(TOTAL_STARS);
            ctx.starSpeed = starSpeed;
            const starColorMix = new Float32Array(TOTAL_STARS);
            ctx.starColorMix = starColorMix;
            const starSize = new Float32Array(TOTAL_STARS);
            ctx.starSize = starSize;
            const starGeo = new THREE.BufferGeometry();
            ctx.starGeo = starGeo;
            starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
            starGeo.setAttribute('aTwinkle', new THREE.BufferAttribute(starTwinkle, 1));
            starGeo.setAttribute('aSpeed', new THREE.BufferAttribute(starSpeed, 1));
            starGeo.setAttribute('aColorMix', new THREE.BufferAttribute(starColorMix, 1));
            starGeo.setAttribute('aSize', new THREE.BufferAttribute(starSize, 1));
            for (let i = 0; i < STAR_COUNT; i++) {
                const d = capDir(0.055); const r = 95;
                starPos[i * 3] = d.x * r; starPos[i * 3 + 1] = d.y * r; starPos[i * 3 + 2] = d.z * r;
                starTwinkle[i] = skyRng() * Math.PI * 2;
                starSpeed[i] = 0.45 + skyRng() * 1.55;
                starColorMix[i] = (skyRng() + skyRng()) * 0.5;
                starSize[i] = skyRng() < 0.07 ? 6.4 + skyRng() * 2.8 : 2.9 + skyRng() * 2.3;
            }
            {
                let wi = STAR_COUNT;
                while (wi < TOTAL_STARS) {
                    const d = mwDir(0.075); const r = 95;
                    starPos[wi * 3] = d.x * r; starPos[wi * 3 + 1] = d.y * r; starPos[wi * 3 + 2] = d.z * r;
                    starTwinkle[wi] = skyRng() * Math.PI * 2;
                    starSpeed[wi] = 0.2 + skyRng() * 0.85;
                    starColorMix[wi] = skyRng() < 0.82 ? skyRng() * 0.32 : skyRng();
                    starSize[wi] = skyRng() < 0.05 ? 2.3 + skyRng() * 1.3 : 0.9 + skyRng() * 1.3;
                    wi++;
                }
            }
            starGeo.attributes.position.needsUpdate = true;
            const starUniforms = { uTime: { value: 0 }, uOpacity: { value: 0 } };
            ctx.starUniforms = starUniforms;
            const starMat = new THREE.ShaderMaterial({
                uniforms: starUniforms,
                vertexShader: `
        attribute float aTwinkle; attribute float aSpeed; attribute float aColorMix; attribute float aSize;
        varying float vTwinkle; varying float vColorMix;
        uniform float uTime;
        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          float twinkle = 0.45 + 0.55 * abs(sin(uTime * aSpeed * 0.5 + aTwinkle));
          gl_PointSize = aSize * (0.75 + 0.55 * twinkle) * (200.0 / -mvPosition.z);
          vTwinkle = twinkle; vColorMix = aColorMix;
        }`,
                fragmentShader: `
        varying float vTwinkle; varying float vColorMix;
        uniform float uOpacity;
        void main() {
          vec2 c = gl_PointCoord - vec2(0.5);
          float d = length(c);
          if (d > 0.5) discard;
          float e = 1.0 - d * 2.0;
          float alpha = e * e * vTwinkle * uOpacity;
          float m = clamp(vColorMix, 0.0, 1.0);
          vec3 colA = vec3(0.66, 0.76, 1.00);
          vec3 colB = vec3(0.90, 0.94, 1.00);
          vec3 colC = vec3(1.00, 0.97, 0.88);
          vec3 colD = vec3(1.00, 0.78, 0.56);
          vec3 colE = vec3(1.00, 0.60, 0.48);
          vec3 starColor;
          if (m < 0.25)      starColor = mix(colA, colB, m / 0.25);
          else if (m < 0.55) starColor = mix(colB, colC, (m - 0.25) / 0.30);
          else if (m < 0.82) starColor = mix(colC, colD, (m - 0.55) / 0.27);
          else               starColor = mix(colD, colE, (m - 0.82) / 0.18);
          starColor *= 1.42;
          gl_FragColor = vec4(starColor, min(alpha, 1.0));
        }`,
                transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false
            });
            ctx.starMat = starMat;
            const stars = new THREE.Points(starGeo, starMat);
            ctx.stars = stars;
            stars.frustumCulled = false;
            ctx.scene.add(stars);

            const METEOR_N = 3, METEOR_PTS = 20;
            ctx.METEOR_N = METEOR_N; ctx.METEOR_PTS = METEOR_PTS;
            const meteorList = [];
            ctx.meteorList = meteorList;
            for (let i = 0; i < METEOR_N; i++) {
                const mg = new THREE.BufferGeometry();
                mg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(METEOR_PTS * 3), 3));
                mg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(METEOR_PTS * 3), 3));
                const mm = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
                const ml = new THREE.Line(mg, mm); ml.frustumCulled = false; ctx.scene.add(ml);
                meteorList.push({ geom: mg, mat: mm, active: false, t: 0, life: 1, px: 0, py: 0, pz: 0, vx: 0, vy: 0, vz: 0 });
            }
            ctx.meteorTimer = 5;
            function spawnMeteor(m) {
                const th = runtimeRng() * Math.PI * 2;
                const ph = Math.acos(0.25 + runtimeRng() * 0.65);
                const r = 78;
                m.px = r * Math.sin(ph) * Math.cos(th);
                m.py = r * Math.cos(ph) + 10;
                m.pz = r * Math.sin(ph) * Math.sin(th);
                const ang = runtimeRng() * Math.PI * 2;
                const sp = 55 + runtimeRng() * 30;
                m.vx = Math.cos(ang) * sp * 0.85;
                m.vz = Math.sin(ang) * sp * 0.85;
                m.vy = -(18 + runtimeRng() * 26);
                m.life = 0.75 + runtimeRng() * 0.5;
                m.t = 0; m.active = true;
            }
            function updateMeteors(dt, skyVis) {
                ctx.meteorTimer -= dt;
                if (ctx.meteorTimer <= 0) {
                    if (skyVis > 0.25) { const m = meteorList.find(x => !x.active); if (m) spawnMeteor(m); }
                    ctx.meteorTimer = 3.5 + runtimeRng() * 7.5;
                }
                for (const m of meteorList) {
                    if (!m.active) { if (m.mat.opacity !== 0) m.mat.opacity = 0; continue; }
                    m.t += dt;
                    if (m.t >= m.life) { m.active = false; m.mat.opacity = 0; continue; }
                    const fade = Math.sin(Math.PI * m.t / m.life);
                    m.mat.opacity = fade * Math.min(1, skyVis * 1.6);
                    const hx = m.px + m.vx * m.t, hy = m.py + m.vy * m.t, hz = m.pz + m.vz * m.t;
                    const vlen = Math.hypot(m.vx, m.vy, m.vz);
                    const L = 9 + vlen * 0.14;
                    const pos = m.geom.attributes.position.array;
                    const col = m.geom.attributes.color.array;
                    for (let k = 0; k < METEOR_PTS; k++) {
                        const d = k / (METEOR_PTS - 1);
                        pos[k * 3] = hx - m.vx / vlen * L * d;
                        pos[k * 3 + 1] = hy - m.vy / vlen * L * d;
                        pos[k * 3 + 2] = hz - m.vz / vlen * L * d;
                        const b = Math.pow(1 - d, 2.1);
                        col[k * 3] = b; col[k * 3 + 1] = b * 0.97; col[k * 3 + 2] = b * 0.9;
                    }
                    m.geom.attributes.position.needsUpdate = true;
                    m.geom.attributes.color.needsUpdate = true;
                }
            }

            const CLOUD_POOL = 14;
            ctx.CLOUD_POOL = CLOUD_POOL;
            const cloudList = [];
            ctx.cloudList = cloudList;
            const cloudFillMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.88, depthWrite: false });
            ctx.cloudFillMat = cloudFillMat;
            function makeCloud() {
                const g = new THREE.Group(); const n = 4 + Math.floor(skyRng() * 4); let cx = 0;
                for (let i = 0; i < n; i++) {
                    const w = 1.8 + skyRng() * 2.0, h = 1.2 + skyRng() * 1.0, d = 1.8 + skyRng() * 2.0;
                    const px = cx, py = (i > 0 && skyRng() < 0.4) ? h * 0.3 : (skyRng() - 0.3) * 0.2, pz = (skyRng() - 0.5) * 1.2;
                    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), cloudFillMat);
                    mesh.scale.set(w / 2, h / 2, d / 2);
                    mesh.position.set(px, py, pz);
                    g.add(mesh);
                    cx += w * 0.3;
                }
                g.scale.set(1, 0.68, 1);
                g.position.set((skyRng() - 0.5) * 90, 18 + skyRng() * 8, -30 + skyRng() * 60); g.visible = false;
                const c = { grp: g, op: 0, spd: 0.7 + skyRng() * 0.6, floatPh: skyRng() * 6.28 }; cloudList.push(c); ctx.scene.add(g); return c;
            }
            for (let i = 0; i < CLOUD_POOL; i++) makeCloud();
            const _cloudCol = new THREE.Color();
            ctx._cloudCol = _cloudCol;

            const RAIN_MAX = 560, rainPos = new Float32Array(RAIN_MAX * 6), rainGeo = new THREE.BufferGeometry();
            ctx.RAIN_MAX = RAIN_MAX; ctx.rainPos = rainPos; ctx.rainGeo = rainGeo;
            rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
            const rainMat = new THREE.LineBasicMaterial({ color: 0x7d93a8, transparent: true, opacity: 0.55, depthWrite: false });
            ctx.rainMat = rainMat;
            const rainLines = new THREE.LineSegments(rainGeo, rainMat);
            ctx.rainLines = rainLines; rainLines.frustumCulled = false; ctx.scene.add(rainLines);
            const rainDrops = [];
            ctx.rainDrops = rainDrops;
            for (let i = 0; i < RAIN_MAX; i++) rainDrops.push({ x: (skyRng() - 0.5) * 34, y: skyRng() * 14, z: (skyRng() - 0.5) * 34, v: 9 + skyRng() * 4 });

            const SNOW_MAX = 440, snowPos = new Float32Array(SNOW_MAX * 18), snowGeo = new THREE.BufferGeometry();
            ctx.SNOW_MAX = SNOW_MAX; ctx.snowPos = snowPos; ctx.snowGeo = snowGeo;
            snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
            const snowMat = new THREE.LineBasicMaterial({ color: 0xa8c0dc, transparent: true, opacity: 0.85, depthWrite: false });
            ctx.snowMat = snowMat;
            const snowLines = new THREE.LineSegments(snowGeo, snowMat);
            ctx.snowLines = snowLines; snowLines.frustumCulled = false; ctx.scene.add(snowLines);
            const snowFlakes = [];
            ctx.snowFlakes = snowFlakes;
            for (let i = 0; i < SNOW_MAX; i++) {
                const phi = Math.acos(skyRng() * 0.6 + 0.2);
                const theta = skyRng() * Math.PI * 2;
                const nx = Math.sin(phi) * Math.cos(theta);
                const ny = Math.cos(phi);
                const nz = Math.sin(phi) * Math.sin(theta);
                let ux, uy, uz, vx, vy, vz;
                if (Math.abs(ny) < 0.99) {
                    ux = nz; uy = 0; uz = -nx;
                    const ul = Math.hypot(ux, uy, uz);
                    ux /= ul; uy /= ul; uz /= ul;
                    vx = ny * uz - nz * uy;
                    vy = nz * ux - nx * uz;
                    vz = nx * uy - ny * ux;
                } else {
                    ux = 1; uy = 0; uz = 0;
                    vx = 0; vy = 0; vz = 1;
                }
                snowFlakes.push({ x: (skyRng() - 0.5) * 34, y: skyRng() * 14, z: (skyRng() - 0.5) * 34, v: 0.6 + skyRng() * 0.5, ph: skyRng() * 6.28, amp: 0.35 + skyRng() * 0.4, fq: 0.5 + skyRng() * 0.7, rot: skyRng() * 6.28, rotV: (skyRng() - 0.5) * 2, ux, uy, uz, vx, vy, vz });
            }

            const SNOW_BALL_MAX = 150;
            ctx.SNOW_BALL_MAX = SNOW_BALL_MAX; const snowBallPos = new Float32Array(SNOW_BALL_MAX * 3);
            ctx.snowBallPos = snowBallPos; const snowBallGeo = new THREE.BufferGeometry();
            ctx.snowBallGeo = snowBallGeo;
            snowBallGeo.setAttribute('position', new THREE.BufferAttribute(snowBallPos, 3));
            const snowBallCanvas = document.createElement('canvas');
            ctx.snowBallCanvas = snowBallCanvas; snowBallCanvas.width = 32; snowBallCanvas.height = 32; const sbCtx = snowBallCanvas.getContext('2d');
            ctx.sbCtx = sbCtx;
            const grad = sbCtx.createRadialGradient(16, 16, 0, 16, 16, 16);
            ctx.grad = grad; grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.5, 'rgba(255,255,255,0.6)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
            sbCtx.fillStyle = grad; sbCtx.fillRect(0, 0, 32, 32);
            const snowBallMat = new THREE.PointsMaterial({ size: 0.15, map: new THREE.CanvasTexture(snowBallCanvas), transparent: true, depthWrite: false, opacity: 0.85, sizeAttenuation: true });
            ctx.snowBallMat = snowBallMat;
            const snowBalls = new THREE.Points(snowBallGeo, snowBallMat);
            ctx.snowBalls = snowBalls; snowBalls.frustumCulled = false; ctx.scene.add(snowBalls);
            const snowBallFlakes = [];
            ctx.snowBallFlakes = snowBallFlakes;
            for (let i = 0; i < SNOW_BALL_MAX; i++) snowBallFlakes.push({ x: (skyRng() - 0.5) * 34, y: skyRng() * 14, z: (skyRng() - 0.5) * 34, v: 0.5 + skyRng() * 0.4, ph: skyRng() * 6.28, amp: 0.2 + skyRng() * 0.3, fq: 0.6 + skyRng() * 0.5 });

            const boltMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, fog: false });
            ctx.boltMat = boltMat;
            ctx.boltLine = new THREE.Line(new THREE.BufferGeometry(), boltMat); ctx.boltLine.frustumCulled = false; ctx.boltLine.visible = false; ctx.scene.add(ctx.boltLine);
            ctx.boltT = 0, ctx.nextBolt = 6 + runtimeRng() * 12;
            function spawnBolt() { const pts = []; let bx = -10 + runtimeRng() * 20, bz = -14 + runtimeRng() * 10, by = 13; pts.push(ctx.V(bx, by, bz)); while (by > 0.5) { by -= 1.5 + runtimeRng() * 1.5; bx += (runtimeRng() - 0.5) * 2.6; bz += (runtimeRng() - 0.5) * 1.2; pts.push(ctx.V(bx, Math.max(by, 0), bz)); } ctx.boltLine.geometry.dispose(); ctx.boltLine.geometry = ctx.geo(pts.map(p => [p.x, p.y, p.z])); ctx.boltLine.visible = true; }

            function roofTopAt(x, z) {
                if (x > -3.72 && x < -2.98 && z > 1.13 && z < 1.87) return 7.3;
                if (x > -4.4 && x < 4.4 && z > -4.6 && z < 4.6) return 6.6 - Math.abs(x) * 0.5;
                if (z > 4.45 && z < 5.05 && x > -1.15 && x < 1.15) return 3.0;
                return 0;
            }

            ctx.clockTick = 0;

            /**
             * `weather/atmosphere` → `weather/effects` 之间的**帧内状态传递**。
             *
             * `J4.14` 把原 `updateWeatherSystem()` 拆成两段，好让「路牌材质 / 花材质 /
             * 萤火虫不透明度」三个每帧分支**归位**到各自模块、并插回它们**原来的执行位置**
             * （见 `app/scene/FrameBody.js` 的登记顺序）。两段之间不再有别的天气代码，
             * 这些量只在**同一帧内**有效。
             */
            const frameSt = { hour: 0, night: 0, twilight: 0, moonFade: 0 };

            /**
             * 天气的**大气**半段（原 `updateWeatherSystem()` 的 L415–L459）：
             * 参数插值 → 天空色 / 雾 → `night` / `twilight` → 环境光 `_amb` → `FILL` → 窗体。
             *
             * 结束时把本帧状态写进 `frameSt`（供 `weather/effects`）与 `ctx._night`
             * （供世界侧的 `world/fireflyOpacity`）。
             */
            function updateWeatherAtmosphere(dt, time) {
                const cfg = WX_CFG[wx.type]; const k = 1 - Math.exp(-dt * 0.55);
                wx.clouds += (cfg.clouds - wx.clouds) * k; wx.rain += (cfg.rain - wx.rain) * k; wx.snow += (cfg.snow - wx.snow) * k; wx.fog += (cfg.fog - wx.fog) * k; wx.gray += (cfg.gray - wx.gray) * k; wx.wind += (cfg.wind - wx.wind) * k;
                if (wx.random) { wx.timer -= dt; if (wx.timer <= 0) { const others = WX_LIST.filter(t => t !== wx.type); setWeather(others[Math.floor(runtimeRng() * others.length)]); wx.timer = 16 + runtimeRng() * 18; } }
                ctx.gameSec += ctx.timeScale * dt; const hour = curHour();

                skyColorAt(hour, _sky);
                if (wx.gray > 0.005) { const L = _sky.r * 0.3 + _sky.g * 0.59 + _sky.b * 0.11; _gray.setScalar(L * 0.9 + 0.08); _sky.lerp(_gray, Math.min(1, wx.gray) * 0.75); }
                if (ctx.boltT > 0) { const flick = Math.max(0, Math.sin(ctx.boltT * 34)) * (ctx.boltT / 0.45); _sky.lerp(_white, flick * 0.4); boltMat.opacity = flick; ctx.boltT -= dt; if (ctx.boltT <= 0) ctx.boltLine.visible = false; }
                ctx.scene.background.copy(_sky); ctx.scene.fog.color.copy(_sky);
                ctx.scene.fog.near = 60 + (3 - 60) * wx.fog; ctx.scene.fog.far = 160 + (24 - 160) * wx.fog;

                let night = 0;
                if (hour < 5 || hour > 19) night = 1; else if (hour < 7) night = (7 - hour) / 2; else if (hour > 17) night = (hour - 17) / 2;
                let dayFactor = 1 - night;

                const twilight = (hour > 16.5 && hour < 19) ? Math.sin((hour - 16.5) / 2.5 * Math.PI) : (hour > 5 && hour < 7.5) ? Math.sin((hour - 5) / 2.5 * Math.PI) : 0;

                let mh = hour - 18; if (mh < 0) mh += 24; const moonA = (mh / 12) * Math.PI;
                moonGroup.position.set(Math.cos(moonA) * 40, Math.sin(moonA) * 40, -28); moonGroup.lookAt(0, 2, 0);
                const moonFade = Math.max(0, Math.min(1, moonGroup.position.y / 4));

                let moonStrength = 0;
                if (wx.type === 'sunny') moonStrength = 0.5;
                else if (wx.type === 'cloudy') moonStrength = 0.3;
                else if (wx.type === 'snow') moonStrength = 0.7;
                else if (wx.type === 'blizzard') moonStrength = 0.1;
                let moonlit = night * Math.max(0, moonFade) * moonStrength;

                _amb.copy(_white).lerp(_nightAmb, night * 0.8);
                _amb.lerp(_moonCol, moonlit);
                _amb.lerp(_warm, twilight * 0.5);
                _amb.lerp(_c1.setHex(0xff9e7e), twilight * 0.22);
                _amb.lerp(_gray, wx.gray * 0.4);
                let brightness = 1.0 - night * 0.4 - wx.gray * 0.3 + moonlit * 0.4;
                _amb.multiplyScalar(brightness);

                ctx.FILL.uniforms.uColor.value.copy(_amb);
                environment.applyDaylight(dayFactor);   // J2.10：采光走环境的唯一入口（内部写 uDaylight）

                ctx.WIN_GLASS.color.setHex(0xffffff);
                if (twilight > 0.03) ctx.WIN_GLASS.color.lerp(_warm, twilight * 0.3);
                if (ctx.fireP > 0) { ctx.WIN_GLASS.color.lerp(_fireGlowColor, ctx.fireP * 0.6 * (1 - dayFactor)); }
                ctx.WIN_GLASS_UP.color.setHex(0xffffff);
                if (twilight > 0.03) ctx.WIN_GLASS_UP.color.lerp(_warm, twilight * 0.3);
                if (ctx.lampP > 0) { ctx.WIN_GLASS_UP.color.lerp(_lampGlowColor, ctx.lampP * 0.65 * (1 - dayFactor)); }

                // ★ J4.14「每帧分支归位」：以下三段不再住这里 ——
                //   ① 路牌材质        → world/house/shell.js        的 updateSignMaterials()
                //   ② 花材质          → world/outdoor/yardStatic.js 的 updateFlowerMaterials()
                //   ③ 萤火虫不透明度  → world/outdoor/fireflies.js  的 updateFireflyOpacity()
                //   它们仍是本帧链的一环，登记为独立帧任务，**先后顺序与搬迁前逐字相同**
                //   （atmosphere → sign → flower → firefly → effects，见 app/scene/FrameBody.js）。

                // 本帧状态交给 effects 半段（以及读 ctx._night 的世界侧帧任务）
                frameSt.hour = hour; frameSt.night = night;
                frameSt.twilight = twilight; frameSt.moonFade = moonFade;
                ctx._night = night;
            }

            /**
             * 天气的**效果**半段（原 `updateWeatherSystem()` 的 L470–L578）：
             * 太阳 / 月亮 / 星星 / 云 / 雨 / 雪 / 闪电 / 时钟显示。
             *
             * 读 `frameSt` —— 由 `weather/atmosphere` 在**同一帧**写入。
             */
            function updateWeatherEffects(dt, time) {
                const { hour, night, twilight, moonFade } = frameSt;

                const sunA = ((hour - 6) / 12) * Math.PI;
                sunGroup.position.set(Math.cos(sunA) * 44, Math.sin(sunA) * 44, -30); sunGroup.lookAt(0, 2, 0);
                const sunFade = Math.max(0, Math.min(1, sunGroup.position.y / 4)); const cover = Math.min(1, wx.clouds / 10);
                const sunOp = Math.max(0, 1 - cover * 1.2) * sunFade; sunFillMat.opacity = sunOp; sunLineMat.opacity = sunOp;
                {
                    const sunEl = sunGroup.position.y / 44;
                    let hf = Math.max(0, Math.min(1, (sunEl + 0.02) / 0.12));
                    const horizonFade = hf * hf * (3 - 2 * hf);
                    const gauss = Math.exp(-Math.pow((sunEl - 0.06) / 0.16, 2));
                    const sunVis = Math.max(0, 1 - cover * 0.85) * horizonFade;
                    const horizonMix = Math.min(1, gauss * 1.3);
                    sunGlowMatA.color.setRGB(1.0, 0.80 + 0.10 * (1 - horizonMix), 0.58 + 0.24 * (1 - horizonMix));
                    sunGlowMatA.opacity = (0.10 + 0.58 * gauss) * sunVis;
                    sunGlowMatB.opacity = (0.05 + 0.28 * gauss) * sunVis;
                    sunGlowA.scale.setScalar(1 + 0.55 * gauss);
                    sunGlowB.scale.setScalar(1 + 0.35 * gauss);
                }

                const moonOp = Math.max(0, 1 - cover * 1.2) * moonFade;
                moonFillMatA.opacity = moonOp; moonLineMatA.opacity = moonOp * 0.9;
                moonFillMatB.opacity = moonOp; moonLineMatB.opacity = moonOp * 0.9;
                moonGlowMat.opacity = (0.20 + 0.05 * Math.sin(time * 0.6)) * moonOp;

                let starVis = 0;
                if (wx.type === 'sunny' || wx.type === 'cloudy') { starVis = Math.max(0, night - cover * 0.5); }
                starUniforms.uOpacity.value += (starVis * 1.25 - starUniforms.uOpacity.value) * Math.min(1, dt * 2.0);
                starUniforms.uTime.value = time;
                if (ctx.timeScale > 0) { stars.rotation.y += Math.sqrt(ctx.timeScale / 60) * 0.02 * dt; }
                updateMeteors(dt, starVis);

                const want = Math.round(wx.clouds); const flowFactor = ctx.timeScale > 0 ? Math.sqrt(ctx.timeScale / 60) : 0; const cloudSpeed = (0.3 + wx.wind * 0.45) * flowFactor;
                _cloudCol.setHex(0xffffff);
                if (twilight > 0.02) {
                    const duskMix = Math.min(1, Math.max(0, (hour - 16.5) / 2.6));
                    _c1.setHex(0xffd2a0).lerp(_c2.setHex(0xe08ba0), duskMix);
                    _cloudCol.lerp(_c1, twilight * 0.65);
                }
                _cloudCol.lerp(_gray.setHex(0x5a6470), Math.min(1, wx.gray * 1.15));
                _cloudCol.lerp(_c1.setHex(0x1f2740), night * 0.88);
                cloudFillMat.color.copy(_cloudCol);
                for (let i = 0; i < cloudList.length; i++) {
                    const c = cloudList[i]; const target = i < want ? 1 : 0; c.op += (target - c.op) * Math.min(1, dt * 0.9);
                    c.grp.visible = c.op > 0.02; c.grp.scale.setScalar(c.op * 0.68);
                    if (c.grp.visible) {
                        cloudFillMat.opacity = 0.88 - night * 0.30;
                        c.grp.position.x += WIND_DIR.x * cloudSpeed * c.spd * dt; c.grp.position.z += WIND_DIR.z * cloudSpeed * c.spd * dt;
                        if (c.grp.position.x > 60) { c.grp.position.x = -60; c.grp.position.z = -30 + runtimeRng() * 60; }
                        else if (c.grp.position.x < -60) { c.grp.position.x = 60; }
                        if (c.grp.position.z > 60) c.grp.position.z = -60; else if (c.grp.position.z < -60) c.grp.position.z = 60;
                        c.grp.position.y += Math.sin(time * 0.5 + c.floatPh) * 0.002;
                    }
                }

                const rainN = Math.min(RAIN_MAX, Math.round(wx.rain)); rainLines.visible = rainN > 0;
                if (rainLines.visible) {
                    rainGeo.setDrawRange(0, rainN * 2); const wSpeedUp = 1 + wx.wind * 0.35, wDrift = wx.wind * 5.5, wLen = 0.42 + wx.wind * 0.28; let idx = 0;
                    for (let i = 0; i < rainN; i++) {
                        const d = rainDrops[i];
                        d.y -= d.v * wSpeedUp * dt; d.x += WIND_DIR.x * wDrift * dt; d.z += WIND_DIR.z * wDrift * dt;
                        const vx = WIND_DIR.x * wDrift, vz = WIND_DIR.z * wDrift, vy = -d.v * wSpeedUp;
                        const m = wLen / Math.hypot(vx, vy, vz);
                        const tX = d.x + vx * m, tY = d.y + vy * m, tZ = d.z + vz * m;
                        if (d.y < roofTopAt(d.x, d.z) || tY < roofTopAt(tX, tZ) || d.y < 0) {
                            d.y = 11 + runtimeRng() * 3; d.x = (runtimeRng() - 0.5) * 34; d.z = (runtimeRng() - 0.5) * 34;
                        }
                        rainPos[idx++] = d.x; rainPos[idx++] = d.y; rainPos[idx++] = d.z;
                        rainPos[idx++] = d.x + vx * m; rainPos[idx++] = d.y + vy * m; rainPos[idx++] = d.z + vz * m;
                    }
                    rainGeo.attributes.position.needsUpdate = true; rainMat.opacity = 0.35 + 0.25 * Math.min(1, wx.rain / 300);
                }

                const snowN = Math.min(SNOW_MAX, Math.round(wx.snow)); const snowBN = Math.min(SNOW_BALL_MAX, Math.round(wx.snow * 0.35));
                snowLines.visible = snowN > 0; snowBalls.visible = snowBN > 0;
                if (snowLines.visible) {
                    snowGeo.setDrawRange(0, snowN * 6); const arm = 0.085, sDrift = wx.wind * 3.2; let idx = 0;
                    for (let i = 0; i < snowN; i++) {
                        const f = snowFlakes[i]; f.y -= f.v * (1 + wx.wind * 1.3) * dt; f.x += (Math.sin(time * f.fq + f.ph) * f.amp + WIND_DIR.x * sDrift) * dt; f.z += (Math.cos(time * f.fq * 0.8 + f.ph) * f.amp * 0.6 + WIND_DIR.z * sDrift) * dt; f.rot += f.rotV * dt;
                        if (f.y < roofTopAt(f.x, f.z) + arm || f.y < 0) { f.y = 11 + runtimeRng() * 3; f.x = (runtimeRng() - 0.5) * 34; f.z = (runtimeRng() - 0.5) * 34; }
                        const cosR = Math.cos(f.rot), sinR = Math.sin(f.rot);
                        for (let kk = 0; kk < 3; kk++) {
                            const a = kk * Math.PI / 3;
                            const px = Math.cos(a) * cosR - Math.sin(a) * sinR;
                            const py = Math.sin(a) * cosR + Math.cos(a) * sinR;
                            const dx = f.ux * px + f.vx * py;
                            const dy = f.uy * px + f.vy * py;
                            const dz = f.uz * px + f.vz * py;
                            snowPos[idx++] = f.x - dx * arm; snowPos[idx++] = f.y - dy * arm; snowPos[idx++] = f.z - dz * arm;
                            snowPos[idx++] = f.x + dx * arm; snowPos[idx++] = f.y + dy * arm; snowPos[idx++] = f.z + dz * arm;
                        }
                    }
                    snowGeo.attributes.position.needsUpdate = true;
                }
                if (snowBalls.visible) {
                    snowBallGeo.setDrawRange(0, snowBN); const sDrift = wx.wind * 3.2; let idx = 0;
                    for (let i = 0; i < snowBN; i++) {
                        const f = snowBallFlakes[i]; f.y -= f.v * (1 + wx.wind * 1.3) * dt; f.x += (Math.sin(time * f.fq + f.ph) * f.amp + WIND_DIR.x * sDrift) * dt; f.z += (Math.cos(time * f.fq * 0.8 + f.ph) * f.amp * 0.6 + WIND_DIR.z * sDrift) * dt;
                        if (f.y < roofTopAt(f.x, f.z) + 0.08 || f.y < 0) { f.y = 11 + runtimeRng() * 3; f.x = (runtimeRng() - 0.5) * 34; f.z = (runtimeRng() - 0.5) * 34; }
                        snowBallPos[idx++] = f.x; snowBallPos[idx++] = f.y; snowBallPos[idx++] = f.z;
                    }
                    snowBallGeo.attributes.position.needsUpdate = true;
                }

                if (wx.type === 'storm' && wx.rain > 260) { ctx.nextBolt -= dt; if (ctx.nextBolt <= 0) { spawnBolt(); ctx.boltT = 0.45; ctx.nextBolt = 6 + runtimeRng() * 14; } }

                ctx.clockTick -= dt;
                if (ctx.clockTick <= 0) {
                    ctx.clockTick = 0.25; const hh = String(Math.floor(hour)).padStart(2, '0'); const mm = String(Math.floor((hour % 1) * 60)).padStart(2, '0'); clockEl.textContent = hh + ':' + mm + ' · ' + WX_NAME[wx.type];
                    if (ctx.menuPanel.classList.contains('open') && !ctx.draggingTime) timeSlider.value = hour;
                }
            }

            // J0.4：截图回归的测试机位覆盖（六元数组 [px,py,pz,lx,ly,lz]）。
            //       仅 manual 模式由宿主设置；null = 不覆盖 —— realtime 下恒为 null，画面与改动前完全一致。
            ctx.testCam = null;
            // ★ J4.22/J4.23：`ctx.ptLantern` 与 `ctx.ptPlant` 已随各自的物件搬走
            //   （改为 `world/floor1/hangingLantern.js` / `world/floor1/moonPlant.js` 的 `state.pt`，
            //    初值仍是 1 / 0，平滑也由各自物件的 `update` 做）。
            ctx.ptKot = 1, ctx.ptMc = 0, ctx.ptCb = 0;
            // F0.3：帧体（原 animate 的函数体）。时间来自 clock —— realtime 下等价于原实现，
            //       manual 下可逐帧定格，用于像素级回归比对。
}
