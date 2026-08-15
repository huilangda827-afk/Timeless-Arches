// ============================================================
// 拾光筑梦 · 古建鉴赏 v2（独立新线，与 home2 / catalog2 / map2 同一设计语言）
// 左：GLB 三维舞台（OrbitControls 自由视角） 右：大图版式图文详解
// 数据只读复用 src/portal/buildings.js；支持 ?b=<id> 深链
// ============================================================
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { BUILDINGS, getBuildingById } from '../portal/buildings.js';
import { markViewed } from '../shared/records.js';
import { mountBgm } from '../shared/bgm-widget.js';

mountBgm('portal');

const $ = (id) => document.getElementById(id);
const toast = $('toast');
let toastTimer = null;

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
}

// ============================================================
// 三维舞台
// ============================================================

const canvas = $('gl');
const loadingEl = $('viewer-loading');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 800);

scene.add(new THREE.HemisphereLight(0xffe9c4, 0x3a2c1a, 1.05));
const key = new THREE.DirectionalLight(0xffd9a0, 2.5);
key.position.set(4, 6, 5);
scene.add(key);
const rim = new THREE.DirectionalLight(0xc8392b, 0.65);
rim.position.set(-5, 2, -4);
scene.add(rim);

// 金色微尘
const dustGeo = new THREE.BufferGeometry();
const N = 200;
const pos = new Float32Array(N * 3);
for (let i = 0; i < N; i++) {
  pos[i * 3] = (Math.random() - 0.5) * 14;
  pos[i * 3 + 1] = (Math.random() - 0.5) * 10;
  pos[i * 3 + 2] = (Math.random() - 0.5) * 8;
}
dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
const dust = new THREE.Points(
  dustGeo,
  new THREE.PointsMaterial({ color: 0xc9a24b, size: 0.05, transparent: true, opacity: 0.65, depthWrite: false })
);
scene.add(dust);

const pivot = new THREE.Group();
scene.add(pivot);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.autoRotate = true;
controls.autoRotateSpeed = 1.1;
canvas.addEventListener('pointerdown', () => { controls.autoRotate = false; });

let homePos = new THREE.Vector3(6, 3, 8);
let homeTarget = new THREE.Vector3(0, 0, 0);

$('btn-reset').addEventListener('click', () => {
  camera.position.copy(homePos);
  controls.target.copy(homeTarget);
  controls.autoRotate = true;
});

const loader = new GLTFLoader();
let currentModel = null;
let loadSeq = 0;

function disposeModel(root) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        for (const k of Object.keys(m)) {
          if (m[k] && m[k].isTexture) m[k].dispose();
        }
        m.dispose();
      }
    }
  });
}

function loadModel(b) {
  const seq = ++loadSeq;
  loadingEl.textContent = '模型加载中…';
  loadingEl.classList.remove('done', 'error');

  if (currentModel) {
    pivot.remove(currentModel);
    disposeModel(currentModel);
    currentModel = null;
  }

  loader.load(
    b.glb,
    (gltf) => {
      if (seq !== loadSeq) { disposeModel(gltf.scene); return; }
      const model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      model.position.sub(center);
      pivot.add(model);
      currentModel = model;

      const radius = Math.max(size.x, size.y, size.z) * 0.5;
      const dist = (radius / Math.tan((camera.fov * Math.PI) / 360)) * 1.3;
      homePos = new THREE.Vector3(dist * 0.62, radius * 0.55, dist * 0.82);
      homeTarget = new THREE.Vector3(0, size.y * 0.02, 0);
      camera.position.copy(homePos);
      controls.target.copy(homeTarget);
      controls.autoRotate = true;

      loadingEl.classList.add('done');
    },
    undefined,
    () => {
      if (seq !== loadSeq) return;
      loadingEl.textContent = '模型加载失败';
      loadingEl.classList.add('error');
    }
  );
}

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
  dust.rotation.y = clock.getElapsedTime() * 0.02;
  controls.update();
  renderer.render(scene, camera);
});

// ============================================================
// 图文详解
// ============================================================

const FIG_LABELS = { real: '实景实拍', full: '建筑全貌', struct: '结构解析' };
const FIG_ORDER = ['real', 'full', 'struct'];

function renderInfo(b) {
  $('i-category').textContent = b.category;
  $('i-keyword').textContent = b.keyword;
  $('i-name').textContent = b.name;
  $('i-era').textContent = b.era;
  $('i-location').textContent = b.location;
  $('i-background').textContent = b.background;
  $('i-feature').textContent = b.feature;
  $('v-watermark').textContent = b.shortName.slice(0, 1);

  // 实景与结构图：大图卡，点击进灯箱
  const figs = $('figs');
  figs.innerHTML = '';
  for (const kind of FIG_ORDER) {
    const src = b.images && b.images[kind];
    if (!src) continue;
    const fig = document.createElement('figure');
    fig.className = 'fig';
    fig.innerHTML = `
      <img src="${src}" alt="${b.shortName} · ${FIG_LABELS[kind]}" loading="lazy" />
      <figcaption><b>${FIG_LABELS[kind]}</b><em>点击查看大图</em></figcaption>`;
    fig.querySelector('img').addEventListener('error', () => fig.remove());
    fig.addEventListener('click', () => openLightbox(src, `${b.name} · ${FIG_LABELS[kind]}`));
    figs.appendChild(fig);
  }
  if (b.imageCredit) {
    const credit = document.createElement('div');
    credit.className = 'fig-credit';
    credit.textContent = '配图来源：' + b.imageCredit;
    figs.appendChild(credit);
  }

  // 模式入口
  const actions = $('i-actions');
  actions.innerHTML = '';
  const mk = (name, sub, ok, href, cls) => {
    const a = document.createElement('a');
    a.className = 'a-btn ' + (ok ? cls : 'disabled');
    a.innerHTML = `<b>${name}</b><em>${sub}</em>`;
    if (ok) a.href = href;
    else a.addEventListener('click', (e) => { e.preventDefault(); showToast('该建筑的此模式 · 敬请期待'); });
    actions.appendChild(a);
  };
  mk('探 微', b.canExplore ? '斗拱爆炸拆解' : '敬请期待', b.canExplore, '/explore2.html', 'outline');
  const forgeHref = b.forgeLevelId ? `/forge.html?level=${b.forgeLevelId}` : '/forge.html';
  mk('筑 梦', b.canForge ? '手势拼装体验' : '敬请期待', b.canForge, forgeHref, 'primary');
}

// ============================================================
// 灯箱
// ============================================================

const lightbox = $('lightbox');

function openLightbox(src, caption) {
  $('lb-img').src = src;
  $('lb-caption').textContent = caption;
  lightbox.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  lightbox.hidden = true;
  document.body.style.overflow = '';
}

lightbox.addEventListener('click', closeLightbox);
$('lb-close').addEventListener('click', closeLightbox);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLightbox(); });

// ============================================================
// 建筑选择胶片条
// ============================================================

let currentId = null;

function buildStrip() {
  const strip = $('strip');
  strip.innerHTML = '';
  for (const b of BUILDINGS) {
    const chip = document.createElement('button');
    chip.className = 'schip';
    chip.dataset.id = b.id;
    const thumb = (b.images && (b.images.full || b.images.real)) || '';
    chip.innerHTML = `
      <span class="schip-img"><img src="${thumb}" alt="" loading="lazy" onerror="this.style.display='none'" /></span>
      <span class="schip-txt"><b>${b.shortName}</b><em>${b.era.split('（')[0]}</em></span>`;
    chip.addEventListener('click', () => select(b.id));
    strip.appendChild(chip);
  }
}

function select(id) {
  if (id === currentId) return;
  const b = getBuildingById(id);
  if (!b) return;
  currentId = id;
  document.querySelectorAll('.schip').forEach((el) => el.classList.toggle('on', el.dataset.id === id));
  document.querySelector(`.schip[data-id="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  renderInfo(b);
  loadModel(b);
  markViewed(id); // 藏宝阁成就：记录"鉴赏过"
  history.replaceState(null, '', '?b=' + id);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================================
// 启动（支持 ?b=<id> 深链）
// ============================================================

buildStrip();
const wanted = new URLSearchParams(location.search).get('b');
select(getBuildingById(wanted) ? wanted : BUILDINGS[0].id);
