/**
 * 检视浮层 · Inspect Overlay
 *
 * "CS 仓库"风格 GLB 检视：
 *  · 黑色雾蒙暗光背景 + 居中模型
 *  · 鼠标在屏幕上移动，模型按光标位置 X/Y 双轴跟随旋转（带 damping）
 *  · 滚轮缩放、双击复位
 *  · 左下角物品标题 + 副标题 + 描述
 *  · ESC 关闭
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const PRIMARY_GLB = '/show.glb';      // 用户指定路径（待确认）
const FALLBACK_GLB = '/models/全貌.glb'; // 找不到时退化到现有的整体斗拱模型

// ========= 状态 =========
let overlay = null;
let renderer = null;
let scene = null;
let camera = null;
let modelRoot = null;
let pivot = null;          // 用 pivot 来旋转，避免污染模型自身 quaternion
let rafId = 0;
let resizeObserver = null;
let lastTime = performance.now();

// 鼠标跟随：当前 yaw/pitch + 目标 yaw/pitch（input lerps to target）
const rotState = {
  yaw: 0, pitch: 0,         // 当前
  targetYaw: 0, targetPitch: 0, // 目标
};
const ROT_DAMPING = 0.1;          // 越小越缓
const YAW_RANGE = Math.PI * 0.55; // ±99 度
const PITCH_RANGE = Math.PI * 0.25; // ±45 度

let zoom = 1;
let zoomTarget = 1;
const ZOOM_DAMPING = 0.15;

// ========= UI =========
function ensureOverlay() {
  if (overlay) return overlay;
  overlay = document.createElement('div');
  overlay.className = 'portal-overlay inspect-overlay';
  overlay.innerHTML = `
    <div class="overlay-header">
      <div style="display:flex;align-items:baseline;">
        <span class="overlay-title" data-name>检视 · 应县木塔</span>
        <span class="overlay-subtitle" data-meta>辽 · 山西应县</span>
      </div>
      <button class="overlay-close" data-close>关闭 ✕</button>
    </div>
    <div class="overlay-body">
      <div class="ov-3d insp-stage" data-3d>
        <div class="ov-3d-loading" data-loading>正在加载模型…</div>

        <div class="insp-info">
          <h3 data-info-title>应县木塔</h3>
          <div class="insp-meta" data-info-meta>辽代 · 山西应县佛宫寺</div>
          <p data-info-desc>
            建于辽清宁二年（1056 年）的应县木塔，是我国现存最古老最高大的纯木构塔式建筑。
            通体不施一钉，54 种斗拱以榫卯精密咬合，历经千年地震风雨而岿然不倒。
          </p>
          <div class="insp-tags">
            <span class="ov-tag">国宝级文物</span>
            <span class="ov-tag">纯木构</span>
            <span class="ov-tag">54 种斗拱</span>
          </div>
        </div>

        <div class="insp-hint">
          移动鼠标查看 · 滚轮缩放 · 双击复位
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('[data-close]').addEventListener('click', closeInspect);
  return overlay;
}

function setupThree(container) {
  if (renderer) return;
  scene = new THREE.Scene();
  scene.background = null;
  // 漂亮的背景：径向米黄→暗夜
  scene.fog = new THREE.FogExp2(0x0a0805, 0.04);

  camera = new THREE.PerspectiveCamera(35, 1, 0.05, 200);
  camera.position.set(0, 0, 8);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  container.appendChild(renderer.domElement);

  // 灯光：CS 仓库风 —— key 暖光 + rim 冷光 + ambient 浅
  const hemi = new THREE.HemisphereLight(0xffe7c4, 0x1a1408, 0.5);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffd9a0, 1.6);
  key.position.set(5, 4, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xa0c8ff, 0.9);
  rim.position.set(-6, 2, -4);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffffff, 0.3);
  fill.position.set(0, -3, 4);
  scene.add(fill);

  // 地面光晕（橙金色圆盘）
  const platform = new THREE.Mesh(
    new THREE.CircleGeometry(3.5, 96),
    new THREE.MeshBasicMaterial({ color: 0xb69563, transparent: true, opacity: 0.16 })
  );
  platform.rotation.x = -Math.PI / 2;
  platform.position.y = -2.4;
  scene.add(platform);

  pivot = new THREE.Group();
  scene.add(pivot);

  // 鼠标移动跟踪
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
  renderer.domElement.addEventListener('dblclick', () => {
    rotState.targetYaw = 0;
    rotState.targetPitch = 0;
    zoomTarget = 1;
  });

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

  function loop(t) {
    rafId = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (t - lastTime) / 1000);
    lastTime = t;

    // 旋转 lerp
    rotState.yaw += (rotState.targetYaw - rotState.yaw) * ROT_DAMPING;
    rotState.pitch += (rotState.targetPitch - rotState.pitch) * ROT_DAMPING;
    if (pivot) {
      pivot.rotation.y = rotState.yaw;
      pivot.rotation.x = rotState.pitch;
    }

    // 缩放 lerp
    zoom += (zoomTarget - zoom) * ZOOM_DAMPING;
    camera.position.z = 8 / zoom;

    renderer.render(scene, camera);
  }
  lastTime = performance.now();
  loop(lastTime);
}

function onPointerMove(e) {
  const rect = renderer.domElement.getBoundingClientRect();
  const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;   // [-1, 1]
  const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;  // [-1, 1]
  rotState.targetYaw = nx * YAW_RANGE;
  rotState.targetPitch = -ny * PITCH_RANGE;
}

function onWheel(e) {
  e.preventDefault();
  const delta = e.deltaY > 0 ? 0.92 : 1.08;
  zoomTarget = Math.max(0.4, Math.min(3.0, zoomTarget * delta));
}

function clearModel() {
  if (modelRoot) {
    pivot.remove(modelRoot);
    modelRoot.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        else o.material.dispose();
      }
    });
    modelRoot = null;
  }
}

async function tryLoad(loader, url) {
  try {
    return await loader.loadAsync(url);
  } catch (e) {
    return null;
  }
}

async function loadGlb(loadingEl) {
  loadingEl.style.display = 'grid';
  loadingEl.textContent = '正在加载模型…';
  clearModel();

  const loader = new GLTFLoader();
  let gltf = await tryLoad(loader, PRIMARY_GLB);
  let usedFallback = false;
  if (!gltf) {
    console.warn(`[inspect] ${PRIMARY_GLB} 加载失败，回退到 ${FALLBACK_GLB}`);
    gltf = await tryLoad(loader, FALLBACK_GLB);
    usedFallback = true;
  }
  if (!gltf) {
    loadingEl.textContent = '模型加载失败：show.glb 与 fallback 都不可用';
    return;
  }

  const model = gltf.scene;

  // 居中归一化到 4m
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const TARGET = 4;
  const scale = TARGET / maxDim;
  model.scale.setScalar(scale);
  model.position.copy(center.multiplyScalar(-scale));

  model.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = false;
      o.receiveShadow = false;
    }
  });

  pivot.add(model);
  modelRoot = model;

  loadingEl.style.display = 'none';

  if (usedFallback) {
    // 在副标题区显示 fallback 提示
    const meta = overlay.querySelector('[data-info-meta]');
    if (meta) meta.innerHTML = '辽代 · 山西应县佛宫寺 <span style="color:#f5b94a;font-size:11px;letter-spacing:.1em;">（占位模型，待替换 show.glb）</span>';
  }
}

// ========= 公共 API =========
export function openInspect(options = {}) {
  ensureOverlay();
  overlay.classList.add('show');
  document.body.classList.add('portal-overlay-active');

  if (options.title) overlay.querySelector('[data-name]').textContent = `检视 · ${options.title}`;
  if (options.subtitle) overlay.querySelector('[data-meta]').textContent = options.subtitle;
  if (options.infoTitle) overlay.querySelector('[data-info-title]').textContent = options.infoTitle;
  if (options.infoMeta) overlay.querySelector('[data-info-meta]').textContent = options.infoMeta;
  if (options.infoDesc) overlay.querySelector('[data-info-desc]').textContent = options.infoDesc;

  rotState.yaw = 0;
  rotState.pitch = 0;
  rotState.targetYaw = 0;
  rotState.targetPitch = 0;
  zoom = 1;
  zoomTarget = 1;

  const container = overlay.querySelector('[data-3d]');
  setupThree(container);
  loadGlb(overlay.querySelector('[data-loading]'));
}

export function closeInspect() {
  if (!overlay) return;
  overlay.classList.remove('show');
  setTimeout(() => {
    clearModel();
    if (!document.querySelector('.portal-overlay.show')) {
      document.body.classList.remove('portal-overlay-active');
    }
  }, 400);
}

const prevCloseOverlays = window._closeOverlays;
window._closeOverlays = () => {
  if (overlay && overlay.classList.contains('show')) {
    closeInspect();
    return true;
  }
  if (prevCloseOverlays) return prevCloseOverlays();
  return false;
};
