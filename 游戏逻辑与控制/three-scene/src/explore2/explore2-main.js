// ============================================================
// 拾光筑梦 · 探微 v2（独立新页，与 home2 系列同一设计语言）
//
// 核心逻辑移植自 src/portal/explore-overlay.js（旧版门户浮层），
// 数据（六集合 target 位姿 / 部件清单 / 解析文案）保持一致；
// 外壳改为独立全屏页：新版导航 + 页题 + 工具栏 + 介绍卡。
// ============================================================
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { mountBgm } from '../shared/bgm-widget.js';

mountBgm('explore'); // 探微 BGM = 末代皇帝（沿用旧版选曲）

// ========= 万春亭 6 个集合的 target 位姿（与 main.js LEVELS[1].targetOverrides 同步）=========
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

const ASSEMBLY_CENTER = new THREE.Vector3(1.945, 0.564, -1.054);

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
const container = document.getElementById('stage-3d');
const loadingEl = document.getElementById('stage-loading');
const infoCard = document.getElementById('info-card');
const statusEl = document.getElementById('status');

let groupNodes = [];
let highlightedGroup = null;
const originalEmissive = new Map();
let explodeAmount = 0;
let explodeTarget = 0;
let explodeStrength = 2.6;
let lastTime = performance.now();

// ========= Three =========
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x14100a, 0.012);

const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 400);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
container.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xfff0d6, 0x1a1408, 0.7));
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
const ring = new THREE.Mesh(
  new THREE.RingGeometry(2.2, 2.5, 64),
  new THREE.MeshBasicMaterial({ color: 0xb69563, transparent: true, opacity: 0.25, side: THREE.DoubleSide })
);
ring.rotation.x = -Math.PI / 2;
ring.position.copy(ASSEMBLY_CENTER);
ring.position.y = 0.05;
scene.add(ring);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 0.6;
controls.maxDistance = 25;
controls.maxPolarAngle = Math.PI * 0.95;

const raycaster = new THREE.Raycaster();
const mouseNDC = new THREE.Vector2(0, 0);

function onResize() {
  const r = container.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) return;
  renderer.setSize(r.width, r.height, false);
  camera.aspect = r.width / r.height;
  camera.updateProjectionMatrix();
}
onResize();
new ResizeObserver(onResize).observe(container);

// ========= 加载 =========
async function loadAllGroups() {
  loadingEl.style.display = 'grid';
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
      root.traverse((o) => { if (o.isMesh) o.userData.groupId = def.id; });
      scene.add(root);

      // 解体方向：分层 Y + 等角横向（万春亭六件近乎垂直堆叠，纯径向会散不开）
      const box = new THREE.Box3().setFromObject(root);
      const center = box.getCenter(new THREE.Vector3());
      const ySign = center.y - ASSEMBLY_CENTER.y >= 0 ? 1 : -1;
      const angle = (idx / GROUPS.length) * Math.PI * 2 - Math.PI / 2;
      const dir = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle))
        .multiplyScalar(0.85)
        .add(new THREE.Vector3(0, ySign * 0.55, 0))
        .normalize();

      groupNodes.push({ id: def.id, def, root, basePos: root.position.clone(), dir });
      loaded++;
      loadingEl.textContent = `正在加载万春亭…（${loaded}/${GROUPS.length}）`;
    } catch (err) {
      console.error('[explore2] GLB 加载失败:', def.glb, err);
    }
  }
  if (!groupNodes.length) {
    loadingEl.textContent = '模型加载失败，请检查 public/models/level2/ 目录';
    return;
  }
  loadingEl.style.display = 'none';
  resetCamera();
}

// ========= 解体 / 高亮 / 交互 =========
function applyExplode() {
  for (const g of groupNodes) {
    g.root.position.copy(g.basePos).addScaledVector(g.dir, explodeAmount);
  }
}

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
        if (!originalEmissive.has(o.uuid)) originalEmissive.set(o.uuid, o.material.emissive.getHex());
        o.material.emissive.setHex(0xf5b94a);
        o.material.emissiveIntensity = 0.6;
      }
    });
    statusEl.textContent = `· ${g.def.title} · 单击查看详细解析 ·`;
  } else {
    statusEl.textContent = '鼠标悬停查看集合 · 单击锁定介绍 · 拖拽旋转 · 滚轮缩放';
  }
}

renderer.domElement.addEventListener('pointermove', (e) => {
  const rect = renderer.domElement.getBoundingClientRect();
  mouseNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouseNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouseNDC, camera);
  const meshes = [];
  groupNodes.forEach((g) => g.root.traverse((o) => o.isMesh && meshes.push(o)));
  const hits = raycaster.intersectObjects(meshes, false);
  if (!hits.length) { setHighlight(null); return; }
  const g = groupNodes.find((x) => x.id === hits[0].object.userData.groupId);
  setHighlight(g || null);
});

renderer.domElement.addEventListener('pointerleave', () => setHighlight(null));

renderer.domElement.addEventListener('click', () => {
  if (!highlightedGroup) { infoCard.classList.remove('show'); return; }
  document.getElementById('info-name').textContent = highlightedGroup.def.title;
  document.getElementById('info-parts').textContent = '包含部件：' + highlightedGroup.def.parts.join(' · ');
  document.getElementById('info-desc').textContent = highlightedGroup.def.desc;
  infoCard.classList.add('show');
});

// 取景：extra = 需要额外容纳的解体位移（世界单位），解体时相机自动后撤
function fitCamera(extra = 0) {
  const box = new THREE.Box3();
  for (const g of groupNodes) box.expandByObject(g.root);
  const center = box.isEmpty() ? ASSEMBLY_CENTER.clone() : box.getCenter(new THREE.Vector3());
  const size = box.isEmpty() ? new THREE.Vector3(2, 2, 2) : box.getSize(new THREE.Vector3());
  const dist = Math.max(2.5, (Math.max(size.x, size.y, size.z) + extra * 2) * 1.6);
  camera.position.set(center.x + dist * 0.7, center.y + dist * 0.5, center.z + dist * 0.7);
  controls.target.copy(center);
  controls.update();
}

function resetCamera() {
  fitCamera(explodeTarget > 0 ? explodeStrength : 0);
  infoCard.classList.remove('show');
}

// ========= 工具栏 =========
function setMode(mode) {
  document.querySelectorAll('.toolbar [data-mode]').forEach((b) => {
    b.classList.toggle('active', b.getAttribute('data-mode') === mode);
  });
  if (mode === 'whole') {
    explodeTarget = 0;
    infoCard.classList.remove('show');
    fitCamera(0);
  } else {
    explodeTarget = explodeStrength;
    fitCamera(explodeStrength); // 解体时相机后撤，保证散开的集合全部在画面内
  }
}

document.querySelector('[data-mode="whole"]').addEventListener('click', () => setMode('whole'));
document.querySelector('[data-mode="explode"]').addEventListener('click', () => setMode('explode'));
document.querySelector('[data-action="reset"]').addEventListener('click', resetCamera);
document.getElementById('strength').addEventListener('input', (e) => {
  explodeStrength = parseFloat(e.target.value);
  if (explodeTarget > 0) explodeTarget = explodeStrength;
});

// ========= 主循环 =========
function loop(t) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (t - lastTime) / 1000);
  lastTime = t;
  const da = explodeTarget - explodeAmount;
  if (Math.abs(da) > 0.001) {
    explodeAmount += da * Math.min(1, dt * 4.5);
    applyExplode();
  }
  controls.update();
  renderer.render(scene, camera);
}
loop(performance.now());

loadAllGroups();
