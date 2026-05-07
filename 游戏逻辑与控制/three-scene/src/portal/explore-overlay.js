/**
 * 探微浮层 · Explore Overlay（万春亭）
 *
 * 加载万春亭的 6 个组件集合 GLB（与第二关 piece 共用），
 * 按 main.js LEVELS[1].targetOverrides 摆放为完整组装姿态。
 *
 * 交互：
 *  · OrbitControls 拖拽 / 缩放
 *  · 顶部工具栏：[整体/解体] + 强度滑条 + 重置视角
 *  · 解体动画：每个集合沿"模型中心 → 集合中心" 向外辐射
 *  · 鼠标 hover：金色 emissive 高亮整个集合
 *  · 单击：弹出右侧介绍卡（集合中文标题 + 包含的所有部件名 + 力学/装饰解析）
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// ========= 万春亭 6 个集合的 target 位置（与 main.js LEVELS[1].targetOverrides 同步）=========
const GROUP_TARGETS = {
  '组件集合壹': {
    position: { x: 1.9159, y: 0.7432, z: -1.067 },
    quaternion: { x: 0, y: -0.8191, z: 0, w: 0.5736 },
    scale: { x: 0.3577, y: 0.3578, z: 0.3577 },
  },
  '组件集合贰': {
    position: { x: 1.9532, y: 0.6637, z: -1.0534 },
    quaternion: { x: -0.0101, y: -0.819, z: -0.0144, w: 0.5735 },
    scale: { x: 0.3578, y: 0.3578, z: 0.3578 },
  },
  '组件集合叁': {
    position: { x: 1.9532, y: 0.5842, z: -1.0534 },
    quaternion: { x: 0, y: -0.8191, z: 0, w: 0.5736 },
    scale: { x: 0.3577, y: 0.3578, z: 0.3577 },
  },
  '组件集合肆': {
    position: { x: 1.9532, y: 0.5445, z: -1.0534 },
    quaternion: { x: -0.0714, y: 0.5714, z: -0.05, w: 0.816 },
    scale: { x: 0.2385, y: 0.2385, z: 0.2385 },
  },
  '组件集合伍': {
    position: { x: 1.9532, y: 0.465, z: -1.0534 },
    quaternion: { x: 0, y: 0.5736, z: 0, w: 0.8191 },
    scale: { x: 0.3776, y: 0.3776, z: 0.3776 },
  },
  '组件集合陆': {
    position: { x: 1.9532, y: 0.3855, z: -1.0534 },
    quaternion: { x: 0, y: 0.5736, z: 0, w: 0.8191 },
    scale: { x: 0.3379, y: 0.3379, z: 0.3379 },
  },
};

// 万春亭中心（六个集合 target.position 的近似几何中心）—— 解体辐射方向以此为原点
const ASSEMBLY_CENTER = new THREE.Vector3(1.945, 0.564, -1.054);

// ========= 6 个组件集合的中文名 + 包含部件 + 力学/装饰解析 =========
const GROUPS = [
  {
    id: '组件集合壹',
    title: '集合壹 · 撩檐榑组',
    glb: '/models/level2/组件集合壹.glb',
    parts: ['撩檐榑', '压槽枋', '罗汉枋', '替木'],
    desc:
      '位于万春亭斗拱铺作的最顶层。撩檐榑承接屋面下传的全部荷载，由替木分担至下方枋木，再经压槽枋传入斗拱主体。罗汉枋作纵向拉接，构成檐部最末端的力流出口。这一组合是"承屋传力"的最后一环，决定屋檐能否平稳无晃。',
  },
  {
    id: '组件集合贰',
    title: '集合贰 · 乳栿与耍头组',
    glb: '/models/level2/组件集合贰.glb',
    parts: ['乳栿', '耍头里转', '齐心斗', '蚂蚱头', '耍头', '慢拱', '令拱'],
    desc:
      '万春亭斗拱中体量最大、构件最多的一组。乳栿是横跨柱距的主梁；耍头向外伸出做"蚂蚱头"雕饰，里转端嵌入梁内成"耍头里转"；慢拱与令拱左右对称构成横向"十字"拉接；齐心斗居中承上层枋木。整组由"杠杆 + 拉接 + 受压"三类构件协同，是斗拱受力最复杂的中段。',
  },
  {
    id: '组件集合叁',
    title: '集合叁 · 琴面昂铺作',
    glb: '/models/level2/组件集合叁.glb',
    parts: ['柱头枋', '㭼头', '交互斗（隔口包耳）', '琴面昂（下折假昂）', '瓜子拱'],
    desc:
      '万春亭最具工艺特征的一层。"隔口包耳"交互斗是清代官式独有做法 —— 斗内开口让两根拱十字相交而不打架；"下折假昂"琴面昂模仿真昂的曲面与下折趋势，但不实际承重，纯供装饰美感。瓜子拱与㭼头一起承托上层，呈现"装饰与受力并重"的清代典型风格。',
  },
  {
    id: '组件集合肆',
    title: '集合肆 · 外檐铺作',
    glb: '/models/level2/组件集合肆.glb',
    parts: ['柱头枋', '琴面昂', '散斗', '交互斗'],
    desc:
      '与集合叁结构相似，但位于外檐方向，专门承担屋顶向外伸出的悬挑荷载。散斗承托对侧拱端，交互斗与琴面昂层叠咬合，把外伸的力流逐层向内回收到柱头之上。',
  },
  {
    id: '组件集合伍',
    title: '集合伍 · 栌斗与基座枋',
    glb: '/models/level2/组件集合伍.glb',
    parts: ['泥道拱', '栌斗（四耳栌斗）', '阑额', '普拍枋'],
    desc:
      '斗拱体系的最底层 —— 整座万春亭斗拱"起步"的地方。栌斗为四耳形制，四个方向同时承托拱列；泥道拱在栌斗正面横置，承接竖向拱列；阑额连接柱与柱构成横向框架，普拍枋垫在阑额之上为拱列提供平整底座。',
  },
  {
    id: '组件集合陆',
    title: '集合陆 · 木栓',
    glb: '/models/level2/组件集合陆.glb',
    parts: ['木栓'],
    desc:
      '万春亭斗拱的"守门员"。在榫卯接合处插入的小木销，防止构件脱落 —— 是中国木构建筑"不用一钉"的关键所在。看似不起眼的一根木栓，往往决定整组斗拱在地震、风雨中能否屹立千年。',
  },
];

// ========= 状态 =========
let overlay = null;
let renderer = null;
let scene = null;
let camera = null;
let controls = null;
let raycaster = null;
let mouseNDC = null;
let rafId = 0;
let resizeObserver = null;
let currentBuilding = null;

// 解体相关
let groupNodes = []; // [{ id, root, basePos, baseQuat, baseScale, dir, def }]
let highlightedGroup = null;
let originalEmissive = new Map();
let explodeAmount = 0;
let explodeTarget = 0;
let explodeStrength = 2.6; // 默认值（解体后零件向外位移的世界单位距离，slider 0.5–6.0 可调）
let lastTime = performance.now();

// ========= UI 构建 =========
function ensureOverlay() {
  if (overlay) return overlay;
  overlay = document.createElement('div');
  overlay.className = 'portal-overlay explore-overlay';
  overlay.innerHTML = `
    <div class="overlay-header">
      <div style="display:flex;align-items:baseline;">
        <span class="overlay-title" data-name>探微 · 万春亭</span>
        <span class="overlay-subtitle" data-meta>明代 · 紫禁城御花园</span>
      </div>
      <button class="overlay-close" data-close>关闭 ✕</button>
    </div>
    <div class="overlay-body">
      <div class="ov-3d" data-3d>
        <div class="ov-3d-loading" data-loading>正在加载万春亭…</div>

        <div class="explore-toolbar">
          <button data-mode="whole" class="active">整体</button>
          <button data-mode="explode">一键解体</button>
          <button data-action="reset">重置视角</button>
          <span style="display:flex;align-items:center;gap:6px;color:#c9b58a;font-size:12px;letter-spacing:.16em;padding:0 6px;">
            强度
            <input type="range" min="0.5" max="6.0" step="0.1" value="2.6" data-strength
                   style="width:120px;">
          </span>
        </div>

        <div class="part-info-card" data-info>
          <h4 data-info-name>—</h4>
          <p data-info-parts style="color:#f5b94a;font-size:12px;letter-spacing:.1em;margin:0 0 8px;">—</p>
          <p data-info-desc>—</p>
        </div>

        <div class="explore-status">
          鼠标悬停查看集合 · 单击锁定介绍 · 拖拽旋转 · 滚轮缩放
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('[data-close]').addEventListener('click', closeExplore);
  overlay.querySelector('[data-mode="whole"]').addEventListener('click', () => setExplodeMode('whole'));
  overlay.querySelector('[data-mode="explode"]').addEventListener('click', () => setExplodeMode('explode'));
  overlay.querySelector('[data-action="reset"]').addEventListener('click', resetCamera);
  overlay.querySelector('[data-strength]').addEventListener('input', (e) => {
    explodeStrength = parseFloat(e.target.value);
    if (explodeTarget > 0) explodeTarget = explodeStrength;
  });

  return overlay;
}

function setExplodeMode(mode) {
  overlay.querySelectorAll('.explore-toolbar [data-mode]').forEach((b) => {
    b.classList.toggle('active', b.getAttribute('data-mode') === mode);
  });
  if (mode === 'whole') {
    explodeTarget = 0;
    overlay.querySelector('[data-info]').classList.remove('show');
  } else {
    explodeTarget = explodeStrength;
  }
}

// ========= Three.js =========
function setupThree(container) {
  if (renderer) return;

  scene = new THREE.Scene();
  scene.background = null;
  scene.fog = new THREE.FogExp2(0x14100a, 0.012);

  camera = new THREE.PerspectiveCamera(38, 1, 0.1, 400);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  container.appendChild(renderer.domElement);

  const hemi = new THREE.HemisphereLight(0xfff0d6, 0x1a1408, 0.7);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffe0b0, 1.6);
  key.position.set(8, 10, 6);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x88aaff, 0.4);
  fill.position.set(-6, 4, -8);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffaa55, 0.7);
  rim.position.set(0, 4, -10);
  scene.add(rim);

  // 中心装饰光环
  const ringGeo = new THREE.RingGeometry(2.2, 2.5, 64);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xb69563, transparent: true, opacity: 0.25, side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.copy(ASSEMBLY_CENTER);
  ring.position.y = 0.05;
  scene.add(ring);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 0.6;
  controls.maxDistance = 25;
  controls.maxPolarAngle = Math.PI * 0.95;

  raycaster = new THREE.Raycaster();
  mouseNDC = new THREE.Vector2(0, 0);

  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('click', onPointerClick);
  renderer.domElement.addEventListener('pointerleave', () => setHighlight(null));

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

    // 解体动画 - smoothstep
    const da = explodeTarget - explodeAmount;
    if (Math.abs(da) > 0.001) {
      explodeAmount += da * Math.min(1, dt * 4.5);
      applyExplode();
    }
    controls.update();
    renderer.render(scene, camera);
  }
  lastTime = performance.now();
  loop(lastTime);
}

// ========= 加载 6 个集合并按 target 摆放 =========
async function loadAllGroups(loadingEl) {
  loadingEl.style.display = 'grid';
  loadingEl.textContent = '正在加载万春亭…（0/6）';
  clearGroups();

  const loader = new GLTFLoader();
  let loaded = 0;
  for (let idx = 0; idx < GROUPS.length; idx++) {
    const def = GROUPS[idx];
    try {
      const gltf = await loader.loadAsync(def.glb);
      const root = gltf.scene;
      const tgt = GROUP_TARGETS[def.id];
      if (tgt) {
        root.position.set(tgt.position.x, tgt.position.y, tgt.position.z);
        root.quaternion.set(tgt.quaternion.x, tgt.quaternion.y, tgt.quaternion.z, tgt.quaternion.w);
        root.scale.set(tgt.scale.x, tgt.scale.y, tgt.scale.z);
      }
      root.userData.groupId = def.id;
      root.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = false;
          o.receiveShadow = false;
          o.userData.groupId = def.id; // 方便 raycast 反查
        }
      });
      scene.add(root);

      // 解体辐射方向：万春亭 6 件主要在 Y 轴上垂直堆叠，水平差异微弱（≤2cm），
      // 直接按"几何中心 − 装配中心"会让所有件几乎沿同一垂直线散开，看起来散得不够。
      // 这里用「分层 Y + 等角横向」混合方向，保证视觉上呈现明显的扇形/花瓣展开。
      const box = new THREE.Box3().setFromObject(root);
      const center = box.getCenter(new THREE.Vector3());
      const yComp = center.y - ASSEMBLY_CENTER.y;
      const ySign = yComp >= 0 ? 1 : -1;
      // 横向角度：6 件按 60° 等分，从 -90° 起逆时针展开（让上层向上、下层向下且各有不同方位）
      const angle = (idx / GROUPS.length) * Math.PI * 2 - Math.PI / 2;
      const horizontal = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)).multiplyScalar(0.85);
      const vertical = new THREE.Vector3(0, ySign * 0.55, 0);
      const dir = horizontal.add(vertical).normalize();

      groupNodes.push({
        id: def.id,
        def,
        root,
        basePos: root.position.clone(),
        baseQuat: root.quaternion.clone(),
        baseScale: root.scale.clone(),
        dir,
      });

      loaded++;
      loadingEl.textContent = `正在加载万春亭…（${loaded}/${GROUPS.length}）`;
    } catch (err) {
      console.error('[explore] GLB 加载失败:', def.glb, err);
    }
  }

  if (groupNodes.length === 0) {
    loadingEl.textContent = '万春亭模型加载失败，请检查 public/models/level2/ 目录';
    return;
  }

  loadingEl.style.display = 'none';
  console.log('[explore] 万春亭 6 集合加载完成');
  resetCamera();
}

function clearGroups() {
  for (const g of groupNodes) {
    scene.remove(g.root);
    g.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        else o.material.dispose();
      }
    });
  }
  groupNodes = [];
  originalEmissive.clear();
  highlightedGroup = null;
  explodeAmount = 0;
  explodeTarget = 0;
}

// ========= 解体应用 =========
function applyExplode() {
  for (const g of groupNodes) {
    g.root.position.copy(g.basePos).addScaledVector(g.dir, explodeAmount);
  }
}

// ========= 高亮 =========
function setHighlight(g) {
  if (highlightedGroup === g) return;
  if (highlightedGroup) {
    highlightedGroup.root.traverse((o) => {
      if (o.isMesh && o.material && o.material.emissive) {
        const orig = originalEmissive.get(o.uuid);
        if (orig !== undefined) {
          o.material.emissive.setHex(orig);
          o.material.emissiveIntensity = 1;
        }
      }
    });
  }
  highlightedGroup = g;
  if (g) {
    g.root.traverse((o) => {
      if (o.isMesh && o.material && o.material.emissive) {
        if (!originalEmissive.has(o.uuid)) {
          originalEmissive.set(o.uuid, o.material.emissive.getHex());
        }
        o.material.emissive.setHex(0xf5b94a);
        o.material.emissiveIntensity = 0.6;
      }
    });
    overlay.querySelector('.explore-status').textContent =
      `· ${g.def.title} · 单击查看详细解析 ·`;
  } else {
    overlay.querySelector('.explore-status').textContent =
      '鼠标悬停查看集合 · 单击锁定介绍 · 拖拽旋转 · 滚轮缩放';
  }
}

function onPointerMove(e) {
  if (!overlay || !overlay.classList.contains('show')) return;
  const rect = renderer.domElement.getBoundingClientRect();
  mouseNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouseNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouseNDC, camera);
  const meshes = [];
  groupNodes.forEach((g) => g.root.traverse((o) => o.isMesh && meshes.push(o)));
  const hits = raycaster.intersectObjects(meshes, false);
  if (!hits.length) {
    setHighlight(null);
    return;
  }
  const hitId = hits[0].object.userData.groupId;
  const g = groupNodes.find((x) => x.id === hitId);
  setHighlight(g || null);
}

function onPointerClick() {
  if (!highlightedGroup) {
    overlay.querySelector('[data-info]').classList.remove('show');
    return;
  }
  const card = overlay.querySelector('[data-info]');
  card.querySelector('[data-info-name]').textContent = highlightedGroup.def.title;
  card.querySelector('[data-info-parts]').textContent =
    '包含部件：' + highlightedGroup.def.parts.join(' · ');
  card.querySelector('[data-info-desc]').textContent = highlightedGroup.def.desc;
  card.classList.add('show');
}

function resetCamera() {
  // 算所有集合的 boundingBox，自适应距离
  const box = new THREE.Box3();
  for (const g of groupNodes) {
    box.expandByObject(g.root);
  }
  const center = box.isEmpty() ? ASSEMBLY_CENTER.clone() : box.getCenter(new THREE.Vector3());
  const size = box.isEmpty() ? new THREE.Vector3(2, 2, 2) : box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const dist = Math.max(2.5, maxDim * 2.2);
  camera.position.set(center.x + dist * 0.7, center.y + dist * 0.5, center.z + dist * 0.7);
  controls.target.copy(center);
  controls.update();
  overlay.querySelector('[data-info]').classList.remove('show');
}

// ========= 公共 API =========
export function openExplore(building) {
  currentBuilding = building;
  ensureOverlay();
  overlay.classList.add('show');
  document.body.classList.add('portal-overlay-active');
  // 探微 BGM = 末代皇帝
  import('./bgm.js').then((BGM) => BGM.play('explore'));
  if (building) {
    overlay.querySelector('[data-name]').textContent = `探微 · ${building.shortName}`;
    overlay.querySelector('[data-meta]').textContent = `${building.era} · ${building.location}`;
  }
  // 重置 UI
  overlay.querySelectorAll('.explore-toolbar [data-mode]').forEach((b) => {
    b.classList.toggle('active', b.getAttribute('data-mode') === 'whole');
  });
  overlay.querySelector('[data-info]').classList.remove('show');
  explodeTarget = 0;

  const container = overlay.querySelector('[data-3d]');
  setupThree(container);
  loadAllGroups(overlay.querySelector('[data-loading]'));
}

export function closeExplore() {
  if (!overlay) return;
  overlay.classList.remove('show');
  setTimeout(() => {
    clearGroups();
    overlay.querySelector('[data-info]').classList.remove('show');
    if (!document.querySelector('.portal-overlay.show')) {
      document.body.classList.remove('portal-overlay-active');
      // 回到门户：恢复浮光
      import('./bgm.js').then((BGM) => BGM.play('portal'));
    }
  }, 400);
}

// 注册 Esc 关闭钩子（与 appreciation 共享）
const prevCloseOverlays = window._closeOverlays;
window._closeOverlays = () => {
  if (overlay && overlay.classList.contains('show')) {
    closeExplore();
    return true;
  }
  if (prevCloseOverlays) return prevCloseOverlays();
  return false;
};
