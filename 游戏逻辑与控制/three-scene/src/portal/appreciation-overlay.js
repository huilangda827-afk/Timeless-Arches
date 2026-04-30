/**
 * 鉴赏浮层 · Appreciation Overlay
 * 左侧 three.js GLB 交互预览（OrbitControls）
 * 右侧文字介绍 + 缩略图 + 跳转按钮
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

let overlay = null;
let renderer = null;
let scene = null;
let camera = null;
let controls = null;
let currentModel = null;
let rafId = 0;
let resizeObserver = null;

function ensureOverlay() {
  if (overlay) return overlay;
  overlay = document.createElement('div');
  overlay.className = 'portal-overlay appreciation-overlay';
  overlay.innerHTML = `
    <div class="overlay-header">
      <div style="display:flex;align-items:baseline;">
        <span class="overlay-title" data-name>—</span>
        <span class="overlay-subtitle" data-meta>—</span>
      </div>
      <button class="overlay-close" data-close>关闭 ✕</button>
    </div>
    <div class="overlay-body">
      <div class="ov-3d" data-3d>
        <div class="ov-3d-loading" data-loading>正在加载模型…</div>
        <div class="ov-3d-hint">鼠标拖拽旋转 · 滚轮缩放 · 右键平移</div>
      </div>
      <div class="ov-info">
        <div class="ov-meta" data-tags></div>
        <div class="ov-section">
          <h3>建筑背景</h3>
          <p data-bg>—</p>
        </div>
        <div class="ov-section">
          <h3>斗拱特点</h3>
          <p data-feature>—</p>
        </div>
        <div class="ov-section">
          <h3>实景与结构图</h3>
          <div class="ov-thumbs" data-thumbs></div>
        </div>
        <div class="ov-actions">
          <button class="ov-btn primary" data-forge>进入筑梦</button>
          <button class="ov-btn" data-explore>进入探微</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('[data-close]').addEventListener('click', closeAppreciation);
  return overlay;
}

function setupThree(container) {
  if (renderer) return;
  scene = new THREE.Scene();
  scene.background = null;
  scene.fog = new THREE.FogExp2(0x14100a, 0.025);

  camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
  camera.position.set(8, 6, 12);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  container.appendChild(renderer.domElement);

  // 灯光
  const hemi = new THREE.HemisphereLight(0xfff0d6, 0x2a2218, 0.7);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffe7b8, 1.4);
  key.position.set(8, 12, 6);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x88aaff, 0.4);
  fill.position.set(-6, 4, -8);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffaa55, 0.6);
  rim.position.set(0, 4, -10);
  scene.add(rim);

  // 地面光晕
  const platformGeo = new THREE.CircleGeometry(8, 64);
  const platformMat = new THREE.MeshBasicMaterial({
    color: 0xb69563,
    transparent: true,
    opacity: 0.18,
  });
  const platform = new THREE.Mesh(platformGeo, platformMat);
  platform.rotation.x = -Math.PI / 2;
  platform.position.y = -0.01;
  scene.add(platform);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 2;
  controls.maxDistance = 40;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.target.set(0, 1.5, 0);

  function onResize() {
    if (!container) return;
    const r = container.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
  }
  onResize();
  resizeObserver = new ResizeObserver(onResize);
  resizeObserver.observe(container);

  function loop() {
    rafId = requestAnimationFrame(loop);
    controls.update();
    renderer.render(scene, camera);
  }
  loop();
}

function clearModel() {
  if (currentModel) {
    scene.remove(currentModel);
    currentModel.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        else o.material.dispose();
      }
    });
    currentModel = null;
  }
}

async function loadGlb(url, loadingEl) {
  loadingEl.style.display = 'grid';
  loadingEl.textContent = '正在加载模型…';
  clearModel();
  try {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(url);
    const model = gltf.scene;

    // 居中缩放
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const targetSize = 6;
    const scale = targetSize / maxDim;
    model.scale.setScalar(scale);
    model.position.sub(center.multiplyScalar(scale));
    model.position.y -= (-box.min.y) * scale;

    // 阴影/灯光
    model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = false;
        o.receiveShadow = false;
        if (o.material) {
          o.material.envMapIntensity = 1.0;
        }
      }
    });

    scene.add(model);
    currentModel = model;

    // 视角调整
    const newBox = new THREE.Box3().setFromObject(model);
    const newSize = newBox.getSize(new THREE.Vector3());
    const newCenter = newBox.getCenter(new THREE.Vector3());
    const dist = Math.max(newSize.x, newSize.y, newSize.z) * 1.8;
    camera.position.set(dist, dist * 0.7, dist);
    controls.target.copy(newCenter);
    controls.update();

    loadingEl.style.display = 'none';
  } catch (err) {
    console.error('GLB load failed:', url, err);
    loadingEl.textContent = '模型加载失败：' + (err.message || err);
  }
}

export function openAppreciation(building) {
  if (!building) return;
  ensureOverlay();
  const o = overlay;

  o.querySelector('[data-name]').textContent = building.shortName;
  o.querySelector('[data-meta]').textContent = `${building.era} · ${building.location}`;

  const tags = [building.category, building.keyword].filter(Boolean);
  o.querySelector('[data-tags]').innerHTML = tags
    .map((t) => `<span class="ov-tag">${t}</span>`)
    .join('');

  o.querySelector('[data-bg]').textContent = building.background;
  o.querySelector('[data-feature]').textContent = building.feature;

  // 缩略图
  const thumbsEl = o.querySelector('[data-thumbs]');
  thumbsEl.innerHTML = '';
  const imgs = Object.values(building.images).filter(Boolean);
  imgs.forEach((src) => {
    const im = document.createElement('img');
    im.src = src;
    im.alt = building.shortName;
    im.addEventListener('click', () => openLightbox(src));
    thumbsEl.appendChild(im);
  });

  // 按钮
  const forgeBtn = o.querySelector('[data-forge]');
  const exploreBtn = o.querySelector('[data-explore]');

  forgeBtn.disabled = !building.canForge;
  forgeBtn.textContent = building.canForge ? '进入筑梦' : '筑梦关卡待制作';
  forgeBtn.onclick = () => {
    if (!building.canForge) {
      flashTip('该建筑的筑梦关卡正在制作中');
      return;
    }
    // 筑梦统一从第 1 关开始（不带 ?level 参数）
    window.location.href = './forge.html';
  };

  exploreBtn.disabled = !building.canExplore;
  exploreBtn.textContent = building.canExplore ? '进入探微' : '探微待制作';
  exploreBtn.onclick = () => {
    if (!building.canExplore) {
      flashTip('该建筑的探微功能正在制作中');
      return;
    }
    closeAppreciation();
    setTimeout(() => {
      import('./explore-overlay.js').then((m) => m.openExplore(building));
    }, 350);
  };

  // 显示
  o.classList.add('show');
  document.body.classList.add('portal-overlay-active');
  const container = o.querySelector('[data-3d]');
  setupThree(container);
  loadGlb(building.glb, o.querySelector('[data-loading]'));
}

export function closeAppreciation() {
  if (!overlay) return;
  overlay.classList.remove('show');
  // 仅当没有其他浮层显示时才解除 body 标记
  setTimeout(() => {
    clearModel();
    if (!document.querySelector('.portal-overlay.show')) {
      document.body.classList.remove('portal-overlay-active');
    }
  }, 400);
}

function flashTip(text) {
  const tip = document.getElementById('tip');
  if (!tip) return;
  tip.textContent = text;
  tip.classList.add('show');
  clearTimeout(flashTip._t);
  flashTip._t = setTimeout(() => tip.classList.remove('show'), 1800);
}

// 图片放大
let lightbox = null;
function openLightbox(src) {
  if (!lightbox) {
    lightbox = document.createElement('div');
    lightbox.className = 'image-lightbox';
    lightbox.innerHTML = `<span class="lb-close">✕</span><img alt=""/>`;
    document.body.appendChild(lightbox);
    lightbox.addEventListener('click', () => lightbox.classList.remove('show'));
  }
  lightbox.querySelector('img').src = src;
  lightbox.classList.add('show');
}

// 注册全局 Esc 关闭钩子
window._closeOverlays = window._closeOverlays || (() => {
  if (lightbox && lightbox.classList.contains('show')) {
    lightbox.classList.remove('show');
    return true;
  }
  if (overlay && overlay.classList.contains('show')) {
    closeAppreciation();
    return true;
  }
  return false;
});
