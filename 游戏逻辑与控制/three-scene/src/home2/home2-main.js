// ============================================================
// 拾光筑梦 · 首页 Demo v2（深色沉浸版）
// 第一幕：倾斜图片墙（缝隙 4px）+ 数据栏
// 第二幕：六境选择器（拱形大图 + 底部图标导航）
// 第三幕：古建长廊走马灯（浅色区）
// 第四幕：斗拱 GLB 实时渲染（深色文物区）
// ============================================================
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mountBgm } from '../shared/bgm-widget.js';

// 用户提供的实景素材（public/images/home2/1..27）
// 仅使用主题安全图（民居/官府/皇宫/桥梁）：1,2,3,4,5,6,7,8,9,10,11,21,22,23,24,25,27
const P = '/images/home2/';
const E = '/images/鉴赏/';

const FALLBACK = [
  `${E}万春亭_全貌.png`, `${E}大明宫含元殿_全貌.png`, `${E}西安鼓楼_全貌.png`,
  `${E}姬氏民居_全貌.png`, `${E}日昇昌票号_全貌.png`, `${E}宋金官府_全貌.png`,
];

// 图片墙素材（顺序即视觉节奏：全景/特写/夜景/彩图穿插）
const MOSAIC_IMGS = [
  `${P}23.jpg`, `${P}4.jpg`, `${P}5.jpg`, `${P}2.jpg`,
  `${P}10.jpg`, `${P}21.jpg`, `${P}8.jpg`, `${P}27.jpg`,
  `${P}1.jpg`, `${P}25.jpg`, `${P}6.jpg`, `${P}9.jpg`,
  `${P}22.jpg`, `${P}11.jpg`, `${P}7.jpg`, `${P}24.jpg`,
];

// ---------------- 第一幕：图片墙 ----------------
function buildMosaic() {
  const wall = document.getElementById('hero-mosaic');
  if (!wall) return;
  const TILES = 64; // 8 列 × 8 行，旋转裁切后仍需完整覆盖四角
  let html = '';
  for (let i = 0; i < TILES; i++) {
    const src = MOSAIC_IMGS[i % MOSAIC_IMGS.length];
    const fb = FALLBACK[i % FALLBACK.length];
    const big = i % 7 === 0 ? 'w2' : i % 11 === 0 ? 'h2' : '';
    html += `<div class="tile ${big}"><img src="${src}" onerror="this.onerror=null;this.src='${fb}'" alt="" loading="lazy" /></div>`;
  }
  wall.innerHTML = html;
}

// ---------------- 第二幕：六境选择器 ----------------
const REALMS = [
  {
    key: '览', name: '万象图鉴', poem: '览尽千构', href: '/catalog2.html',
    img: `${P}23.jpg`, fb: `${E}大明宫含元殿_全貌.png`,
    desc: '代表性古建案例总览，从民居到皇宫，建立对中国木构建筑的整体认知。',
  },
  {
    key: '舆', name: '古建舆图', poem: '按图索骥', href: '/map2.html',
    img: `${P}10.jpg`, fb: `${E}西安鼓楼_全貌.png`,
    desc: '真实经纬点位落于舆图之上，纵览古建的地域分布与保护现状。',
  },
  {
    key: '鉴', name: '鉴赏', poem: '观其形制', href: '/view2.html',
    img: `${P}8.jpg`, fb: `${E}万春亭_全貌.png`,
    desc: '三维模型 360 度自由旋转，配合多角度实景图文，观其营造之美。',
  },
  {
    key: '微', name: '探微', poem: '拆解入微', href: '/explore2.html',
    img: `${P}5.jpg`, fb: `${E}姬氏民居_全貌.png`,
    desc: '斗拱一键炸开，构件逐一命名释义，看清斗、拱、昂、枋的承托关系。',
  },
  {
    key: '筑', name: '筑梦', poem: '亲手筑之', href: '/forge.html',
    img: `${P}3.jpg`, fb: `${E}日昇昌票号_全貌.png`,
    desc: '摄像头手势识别，捏合抓取构件，指尖重现千年榫卯的拼装智慧。',
  },
  {
    key: '精', name: '精微匠造', poem: '毫厘之功', href: '/precision.html',
    img: `${P}24.jpg`, fb: `${E}宋金官府_全貌.png`,
    desc: '键鼠拖拽与数值面板双精调，专业级位姿校验，体验毫厘之间的匠心。',
  },
  {
    key: '游', name: '游艺坊', poem: '游于艺', href: '/arcade.html',
    img: `${P}6.jpg`, fb: `${E}日昇昌票号_全貌.png`,
    desc: '斗拱在哪儿、千钧一刻、拾遗补缺——以戏入学，成就皆入藏宝阁。',
  },
];

function buildRealms() {
  const nav = document.getElementById('realms-nav');
  const nameEl = document.getElementById('realm-name');
  const poemEl = document.getElementById('realm-poem');
  const descEl = document.getElementById('realm-desc');
  const enterEl = document.getElementById('realm-enter');
  const imgEl = document.getElementById('realm-img');
  if (!nav) return;

  nav.innerHTML = REALMS.map(
    (r, i) => `
    <button class="rn-item${i === 0 ? ' on' : ''}" data-i="${i}">
      <span class="rn-icon">${r.key}</span>
      <span class="rn-label">${r.name}</span>
    </button>`
  ).join('');

  function show(i) {
    const r = REALMS[i];
    nav.querySelectorAll('.rn-item').forEach((el, j) => el.classList.toggle('on', j === i));
    imgEl.classList.add('fading');
    setTimeout(() => {
      nameEl.textContent = r.name;
      poemEl.textContent = r.poem;
      descEl.textContent = r.desc;
      enterEl.href = r.href;
      imgEl.onerror = () => { imgEl.onerror = null; imgEl.src = r.fb; };
      imgEl.src = r.img;
      imgEl.classList.remove('fading');
    }, 240);
  }

  nav.addEventListener('click', (e) => {
    const btn = e.target.closest('.rn-item');
    if (btn) show(Number(btn.dataset.i));
  });

  // 自动轮播（用户点击后重置计时）
  let idx = 0;
  let timer = setInterval(() => { idx = (idx + 1) % REALMS.length; show(idx); }, 6000);
  nav.addEventListener('click', (e) => {
    const btn = e.target.closest('.rn-item');
    if (!btn) return;
    idx = Number(btn.dataset.i);
    clearInterval(timer);
    timer = setInterval(() => { idx = (idx + 1) % REALMS.length; show(idx); }, 6000);
  });
}

// ---------------- 第三幕：古建长廊 ----------------
const GALLERY = [
  { img: `${P}4.jpg`, fb: `${E}三出阙_全貌.png`, name: '十七孔桥', era: '清 · 颐和园' },
  { img: `${P}23.jpg`, fb: `${E}大明宫含元殿_全貌.png`, name: '太和殿', era: '明清 · 紫禁城' },
  { img: `${P}22.jpg`, fb: `${E}姬氏民居_全貌.png`, name: '宏村', era: '明清 · 皖南' },
  { img: `${P}1.jpg`, fb: `${E}宋金官府_全貌.png`, name: '赵州桥', era: '隋 · 河北赵县' },
  { img: `${P}27.jpg`, fb: `${E}西安鼓楼_全貌.png`, name: '平遥城楼', era: '明 · 山西' },
  { img: `${P}10.jpg`, fb: `${E}万春亭_全貌.png`, name: '福建土楼', era: '明清 · 闽西' },
  { img: `${P}2.jpg`, fb: `${E}姬氏民居_全貌.png`, name: '宏村月沼', era: '明 · 皖南' },
  { img: `${P}6.jpg`, fb: `${E}日昇昌票号_全貌.png`, name: '王家大院', era: '清 · 山西灵石' },
  { img: `${P}11.jpg`, fb: `${E}姬氏民居_全貌.png`, name: '西江吊脚楼', era: '传统民居 · 黔东南' },
  { img: `${P}21.jpg`, fb: `${E}日昇昌票号_全貌.png`, name: '砖雕影壁', era: '清 · 晋中' },
];

function buildMarquee() {
  const track = document.getElementById('marquee-track');
  if (!track) return;
  const html = GALLERY.map(
    (g) => `
    <div class="g-card" onclick="location.href='/view2.html'">
      <img src="${g.img}" onerror="this.onerror=null;this.src='${g.fb}'" alt="${g.name}" loading="lazy" />
      <div class="g-name">${g.name}</div>
      <div class="g-era">${g.era}</div>
    </div>`
  ).join('');
  track.innerHTML = html + html;
}

// ---------------- 滚动渐显 ----------------
function initReveal() {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('on');
          io.unobserve(e.target);
        }
      }
    },
    { threshold: 0.12 }
  );
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
}

// ---------------- 第四幕：斗拱 GLB ----------------
function initRelic() {
  const canvas = document.getElementById('relic-canvas');
  const loadingEl = document.getElementById('relic-loading');
  if (!canvas) return;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 500);

  scene.add(new THREE.HemisphereLight(0xffe9c4, 0x3a2c1a, 1.0));
  const key = new THREE.DirectionalLight(0xffd9a0, 2.6);
  key.position.set(4, 6, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xc8392b, 0.7);
  rim.position.set(-5, 2, -4);
  scene.add(rim);

  // 金色微尘
  const dustGeo = new THREE.BufferGeometry();
  const N = 220;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 12;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 9;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 7;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dust = new THREE.Points(
    dustGeo,
    new THREE.PointsMaterial({ color: 0xc9a24b, size: 0.05, transparent: true, opacity: 0.7, depthWrite: false })
  );
  scene.add(dust);

  const pivot = new THREE.Group();
  scene.add(pivot);

  new GLTFLoader().load(
    '/models/鉴赏/北京紫禁城御花园万春亭.glb',
    (gltf) => {
      const model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      model.position.sub(center);
      pivot.add(model);

      const radius = Math.max(size.x, size.y, size.z) * 0.5;
      const dist = (radius / Math.tan((camera.fov * Math.PI) / 360)) * 1.28;
      camera.position.set(dist * 0.62, radius * 0.5, dist * 0.82);
      camera.lookAt(0, size.y * 0.04, 0);

      loadingEl?.classList.add('done');
    },
    undefined,
    () => {
      if (loadingEl) loadingEl.textContent = '模型加载失败 · 请通过本地服务访问';
    }
  );

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== w || canvas.height !== h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  }

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    resize();
    const t = clock.getElapsedTime();
    pivot.rotation.y = t * 0.16;
    pivot.position.y = Math.sin(t * 0.6) * 0.07;
    dust.rotation.y = t * 0.02;
    renderer.render(scene, camera);
  });
}

buildMosaic();
buildRealms();
buildMarquee();
initReveal();
initRelic();
mountBgm('portal');
