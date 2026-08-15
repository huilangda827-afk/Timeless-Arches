// ============================================================
// 拾遗补缺（游艺坊 · 残件修复）—— 关卡制版本
//
//   关卡壹 · 单翘斗拱：幽灵组件.glb 内含 5 个 "X配套" 节点，缺 2 件
//   关卡贰 · 万春亭铺作：level2 六大组件集合按校准位姿组装，缺 3 件
//
//   - 缺口金色残影提示可开关（关闭后全凭对照参照的眼力）
//   - 完整参照模型摆在左侧
//   - 备选托盘缩略图由已加载节点离屏渲染（零额外下载）
// ============================================================
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { markRepair } from '../shared/records.js';
import { mountBgm } from '../shared/bgm-widget.js';

mountBgm('forge');

const $ = (id) => document.getElementById(id);

// ------------------------------------------------------------
// 关卡数据
// ------------------------------------------------------------

const LEVELS = [
  {
    id: 'danqiao',
    tab: '壹 · 单翘斗拱',
    title: '单翘单昂平身科',
    mode: 'ghostFile', // 单文件多节点：节点名 = `${name}配套`
    file: '/models/幽灵组件.glb',
    missCount: 2,
    trayCount: 4, // 2 正确 + 2 干扰
    refGap: 1.9,  // 参照模型相对拼装体的横向间距系数
    winBody:
      '大斗承重、华拱出挑、散斗匀布——五件构件各司其职，一攒斗拱又能再托千年屋檐。你的眼力已经胜过许多只看热闹的游客了。',
    pieces: [
      { name: '大斗',      display: '大斗',         lore: '柱头之上最底层的斗形构件，承托上方所有栱、昂、枋的总重量。' },
      { name: '华拱',      display: '单翘（华拱）', lore: '由柱中向外伸出的弓形件，是斗拱悬挑外延的核心受力构件。' },
      { name: '正心瓜拱',  display: '正心瓜拱',     lore: '横置于大斗正中、形似短瓜的弧形小拱，承托上层正心枋与齐心斗。' },
      { name: '散科-左边', display: '十八斗',       lore: '斗口宽十八分故名，承托翘端两侧的拱、枋。' },
      { name: '散科-右边', display: '槽升子',       lore: '与十八斗对称，上口收为升状，承托外侧令拱。' },
    ],
  },
  {
    id: 'wanchunting',
    tab: '贰 · 万春亭铺作',
    title: '万春亭铺作（六大集合）',
    mode: 'multiFile', // 多文件：按校准位姿组装
    prefix: '/models/level2/',
    missCount: 3,
    trayCount: 6, // 全部 6 件上托盘（3 正确 + 3 已在结构里的干扰）
    refGap: 2.1,
    winBody:
      '撩檐榑、乳栿、琴面昂、栌斗、木栓——六大集合层层归位，紫禁城御花园的万春亭斗拱又能撑起攒尖宝顶。清代官式小木作的精髓，被你亲手复原了。',
    // target 位姿与 main.js LEVELS[1].targetOverrides 同步
    pieces: [
      {
        name: '组件集合壹', display: '撩檐榑组',
        lore: '铺作最顶层：撩檐榑承接屋面荷载，替木分担、压槽枋传力，罗汉枋纵向拉接。',
        tf: { p: [1.9159, 0.7432, -1.067], q: [0, -0.8191, 0, 0.5736], s: [0.3577, 0.3578, 0.3577] },
      },
      {
        name: '组件集合贰', display: '乳栿耍头组',
        lore: '体量最大的一组：乳栿横跨柱距，耍头外伸雕成蚂蚱头，慢拱令拱十字拉接。',
        tf: { p: [1.9532, 0.6637, -1.0534], q: [-0.0101, -0.819, -0.0144, 0.5735], s: [0.3578, 0.3578, 0.3578] },
      },
      {
        name: '组件集合叁', display: '琴面昂铺作',
        lore: '"隔口包耳"交互斗与"下折假昂"琴面昂——清代官式独有的工艺担当。',
        tf: { p: [1.9532, 0.5842, -1.0534], q: [0, -0.8191, 0, 0.5736], s: [0.3577, 0.3578, 0.3577] },
      },
      {
        name: '组件集合肆', display: '外檐铺作',
        lore: '位于外檐方向，散斗与交互斗层叠咬合，把悬挑的力流逐层收回柱头。',
        tf: { p: [1.9532, 0.5445, -1.0534], q: [-0.0714, 0.5714, -0.05, 0.816], s: [0.2385, 0.2385, 0.2385] },
      },
      {
        name: '组件集合伍', display: '栌斗基座',
        lore: '整攒斗拱起步之处：四耳栌斗四向承托，阑额连柱、普拍枋垫底。',
        tf: { p: [1.9532, 0.465, -1.0534], q: [0, 0.5736, 0, 0.8191], s: [0.3776, 0.3776, 0.3776] },
      },
      {
        name: '组件集合陆', display: '木栓',
        lore: '榫卯的"守门员"：一根小木销防止构件脱落，不用一钉的关键所在。',
        tf: { p: [1.9532, 0.3855, -1.0534], q: [0, 0.5736, 0, 0.8191], s: [0.3379, 0.3379, 0.3379] },
      },
    ],
  },
];

let currentLevel = LEVELS[0];

// ------------------------------------------------------------
// Three 场景
// ------------------------------------------------------------

const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 500);

scene.add(new THREE.HemisphereLight(0xffe9c4, 0x3a2c1a, 1.05));
const key = new THREE.DirectionalLight(0xffd9a0, 2.4);
key.position.set(4, 6, 5);
scene.add(key);
const rim = new THREE.DirectionalLight(0xc8392b, 0.6);
rim.position.set(-5, 2, -4);
scene.add(rim);

const orbit = new OrbitControls(camera, canvas);
orbit.enableDamping = true;
orbit.dampingFactor = 0.08;

const loader = new GLTFLoader();
const glbCache = new Map(); // url → gltf.scene（原始，不直接进场景）

async function loadCached(url) {
  if (glbCache.has(url)) return glbCache.get(url).clone(true);
  const gltf = await loader.loadAsync(url);
  glbCache.set(url, gltf.scene);
  return gltf.scene.clone(true);
}

// ------------------------------------------------------------
// 局状态
// ------------------------------------------------------------

let puzzleRoot = null;
let refRoot = null;
let missing = [];      // [{ name, node, ghost, fixed }]
let ghostMats = [];
let fxItems = [];
let roundOver = false;
let ghostHintOn = true;
let modelRadius = 1;

function clearRound() {
  if (puzzleRoot) { scene.remove(puzzleRoot); puzzleRoot = null; }
  if (refRoot) { scene.remove(refRoot); refRoot = null; }
  missing = [];
  ghostMats = [];
}

// 缺口残影
function makeGhost(node) {
  const g = node.clone(true);
  g.name = (node.name || 'piece') + '_ghost';
  const mat = new THREE.MeshBasicMaterial({
    color: 0xc9a24b, transparent: true, opacity: 0.22, depthWrite: false,
  });
  ghostMats.push(mat);
  g.traverse((n) => { if (n.isMesh) n.material = mat; });
  return g;
}

function spawnRing(worldPos) {
  const r = modelRadius * 0.22;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(r * 0.75, r, 40),
    new THREE.MeshBasicMaterial({ color: 0xc9a24b, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.copy(worldPos);
  scene.add(ring);
  fxItems.push({ mesh: ring, t: 0 });
}

// ------------------------------------------------------------
// 组装拼装体（两种模式统一产出：assembly Group + name→node 映射）
// ------------------------------------------------------------

async function buildAssembly(level) {
  const assembly = new THREE.Group();
  const nodeMap = new Map();

  if (level.mode === 'ghostFile') {
    const root = await loadCached(level.file);
    assembly.add(root);
    for (const p of level.pieces) {
      const node = root.getObjectByName(p.name + '配套');
      if (node) nodeMap.set(p.name, node);
      else console.warn('[repair] 未找到节点:', p.name);
    }
  } else {
    let i = 0;
    for (const p of level.pieces) {
      $('loading').textContent = `构件载入中…（${++i}/${level.pieces.length}）`;
      const root = await loadCached(level.prefix + p.name + '.glb');
      root.position.set(p.tf.p[0], p.tf.p[1], p.tf.p[2]);
      root.quaternion.set(p.tf.q[0], p.tf.q[1], p.tf.q[2], p.tf.q[3]);
      root.scale.set(p.tf.s[0], p.tf.s[1], p.tf.s[2]);
      assembly.add(root);
      nodeMap.set(p.name, root);
    }
  }
  return { assembly, nodeMap };
}

// ------------------------------------------------------------
// 开局
// ------------------------------------------------------------

async function setupRound() {
  const level = currentLevel;
  roundOver = false;
  $('result').hidden = true;
  $('lore').hidden = true;
  clearRound();

  $('loading').style.display = 'block';
  $('loading').textContent = '构件载入中…';

  const { assembly, nodeMap } = await buildAssembly(level);
  puzzleRoot = assembly;

  // 完整参照 = 克隆整组放左侧
  refRoot = assembly.clone(true);

  const box = new THREE.Box3().setFromObject(puzzleRoot);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  puzzleRoot.position.sub(center);
  scene.add(puzzleRoot);

  refRoot.position.sub(center);
  refRoot.position.x -= size.x * level.refGap;
  refRoot.scale.setScalar(0.85);
  scene.add(refRoot);

  modelRadius = Math.max(size.x, size.y, size.z) * 0.5;
  const radius = Math.max(size.x * 2.6, size.y, size.z) * 0.5;
  const dist = (radius / Math.tan((camera.fov * Math.PI) / 360)) * 1.25;
  camera.position.set(dist * 0.25, radius * 0.7, dist * 0.95);
  orbit.target.set(-size.x * 0.6, 0, 0);
  orbit.update();

  // 随机抽缺失件
  const missNames = [...level.pieces].sort(() => Math.random() - 0.5)
    .slice(0, level.missCount)
    .map((p) => p.name);

  for (const name of missNames) {
    // 注意：node 引用要从"平移后的 puzzleRoot"里重取（clone 前的 map 指向原 assembly 层级，仍有效）
    const node = nodeMap.get(name);
    if (!node) continue;
    node.visible = false;
    const ghost = makeGhost(node);
    ghost.visible = ghostHintOn;
    node.parent.add(ghost);
    missing.push({ name, node, ghost, fixed: false, origScale: node.scale.clone() });
  }

  buildTray(level, missNames, nodeMap);
  refreshProgress();
  $('brief-title').textContent = `这座「${level.title}」缺了${['零', '一', '两', '三', '四'][level.missCount]}件构件。`;
  $('loading').style.display = 'none';
}

// ------------------------------------------------------------
// 备选托盘：缩略图直接离屏渲染已加载节点（零额外下载）
// ------------------------------------------------------------

const thumbCache = new Map(); // levelId:name → dataURL

function makeThumbFromNode(node, cacheKey) {
  if (thumbCache.has(cacheKey)) return thumbCache.get(cacheKey);

  const obj = node.clone(true);
  obj.visible = true;
  obj.traverse((n) => { n.visible = true; });
  // 复位到原点独立取景
  obj.position.set(0, 0, 0);
  obj.quaternion.identity();

  const tScene = new THREE.Scene();
  tScene.add(new THREE.HemisphereLight(0xffe9c4, 0x3a2c1a, 1.2));
  const tKey = new THREE.DirectionalLight(0xffd9a0, 2.6);
  tKey.position.set(3, 5, 4);
  tScene.add(tKey);

  const bx = new THREE.Box3().setFromObject(obj);
  const c = bx.getCenter(new THREE.Vector3());
  const s = bx.getSize(new THREE.Vector3());
  obj.position.sub(c);
  tScene.add(obj);

  const tCam = new THREE.PerspectiveCamera(38, 1, 0.01, 100);
  const r = Math.max(s.x, s.y, s.z) * 0.5;
  const d = (r / Math.tan((tCam.fov * Math.PI) / 360)) * 1.35;
  tCam.position.set(d * 0.7, d * 0.5, d * 0.75);
  tCam.lookAt(0, 0, 0);

  const tRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  tRenderer.setSize(180, 180);
  tRenderer.outputColorSpace = THREE.SRGBColorSpace;
  tRenderer.render(tScene, tCam);
  const url = tRenderer.domElement.toDataURL('image/png');
  tRenderer.dispose();
  thumbCache.set(cacheKey, url);
  return url;
}

function buildTray(level, missNames, nodeMap) {
  const tray = $('tray');
  tray.innerHTML = '';
  let options;
  if (level.trayCount >= level.pieces.length) {
    options = level.pieces.map((p) => p.name); // 全员上托盘
  } else {
    const decoys = level.pieces.filter((p) => !missNames.includes(p.name))
      .sort(() => Math.random() - 0.5)
      .slice(0, level.trayCount - missNames.length)
      .map((p) => p.name);
    options = [...missNames, ...decoys];
  }
  options = options.sort(() => Math.random() - 0.5);

  for (const name of options) {
    const piece = level.pieces.find((p) => p.name === name);
    const btn = document.createElement('button');
    btn.className = 'tray-item';
    btn.dataset.name = name;
    btn.innerHTML = `<span class="ti-img"><i>…</i></span><b>${piece.display}</b>`;
    btn.addEventListener('click', () => pick(name, btn));
    tray.appendChild(btn);
    // 缩略图（异步微任务，避免阻塞首帧）
    requestAnimationFrame(() => {
      try {
        const node = nodeMap.get(name);
        if (!node) return;
        const url = makeThumbFromNode(node, `${level.id}:${name}`);
        btn.querySelector('.ti-img').innerHTML = `<img src="${url}" alt="${piece.display}" />`;
      } catch (e) { console.warn('[repair] 缩略图失败:', name, e); }
    });
  }
}

// ------------------------------------------------------------
// 判定
// ------------------------------------------------------------

let loreTimer = null;
function showLore(piece) {
  const el = $('lore');
  el.innerHTML = `<b>${piece.display}</b>${piece.lore}`;
  el.hidden = false;
  clearTimeout(loreTimer);
  loreTimer = setTimeout(() => { el.hidden = true; }, 5200);
}

let toastTimer = null;
function showToast(msg, tone = 'warn') {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast show ' + tone;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = 'toast'; }, 2000);
}

function refreshProgress() {
  const left = missing.filter((m) => !m.fixed).length;
  $('bar-progress').textContent = left > 0 ? `缺失 ${left} 件` : '修复完成！';
}

function pick(name, btn) {
  if (roundOver) return;
  const slot = missing.find((m) => m.name === name && !m.fixed);
  const piece = currentLevel.pieces.find((p) => p.name === name);

  if (!slot) {
    btn.classList.add('shake');
    setTimeout(() => btn.classList.remove('shake'), 500);
    showToast(`「${piece.display}」已经在结构里了——再仔细对照参照看看`, 'warn');
    return;
  }

  slot.fixed = true;
  slot.ghost.removeFromParent();
  slot.node.visible = true;
  const base = slot.origScale;
  slot.node.scale.copy(base).multiplyScalar(0.6);
  const grow = { t: 0 };
  const tick = () => {
    grow.t += 0.08;
    const k = Math.min(1, grow.t);
    slot.node.scale.copy(base).multiplyScalar(0.6 + 0.4 * (1 - Math.pow(1 - k, 3)));
    if (k < 1) requestAnimationFrame(tick);
  };
  tick();
  const wp = new THREE.Vector3();
  slot.node.getWorldPosition(wp);
  spawnRing(wp);

  btn.classList.add('used');
  btn.disabled = true;
  showToast(`✅ 补对了：${piece.display}`, 'ok');
  showLore(piece);
  refreshProgress();

  if (missing.every((m) => m.fixed)) {
    roundOver = true;
    markRepair(true);
    $('rc-body').textContent = currentLevel.winBody;
    setTimeout(() => { $('result').hidden = false; }, 1100);
  }
}

// ------------------------------------------------------------
// 主循环
// ------------------------------------------------------------

const clock = new THREE.Clock();

function resize() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== w || canvas.height !== h) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
}

renderer.setAnimationLoop(() => {
  resize();
  const t = clock.getElapsedTime();
  for (const m of ghostMats) m.opacity = 0.14 + 0.12 * (0.5 + 0.5 * Math.sin(t * 2.6));
  for (let i = fxItems.length - 1; i >= 0; i--) {
    const fx = fxItems[i];
    fx.t += 0.025;
    fx.mesh.scale.setScalar(1 + fx.t * 2.2);
    fx.mesh.material.opacity = Math.max(0, 0.9 - fx.t * 1.6);
    if (fx.mesh.material.opacity <= 0) {
      scene.remove(fx.mesh);
      fx.mesh.geometry.dispose();
      fx.mesh.material.dispose();
      fxItems.splice(i, 1);
    }
  }
  orbit.update();
  renderer.render(scene, camera);
});

// ------------------------------------------------------------
// UI：关卡切换 / 残影开关 / 重开
// ------------------------------------------------------------

function renderLevelTabs() {
  const box = $('level-tabs');
  box.innerHTML = '';
  for (const lv of LEVELS) {
    const b = document.createElement('button');
    b.className = 'bar-tab' + (lv === currentLevel ? ' on' : '');
    b.textContent = lv.tab;
    b.addEventListener('click', () => {
      if (lv === currentLevel) return;
      currentLevel = lv;
      renderLevelTabs();
      setupRound();
    });
    box.appendChild(b);
  }
}

$('btn-ghost').addEventListener('click', () => {
  ghostHintOn = !ghostHintOn;
  $('btn-ghost').textContent = `残影提示：${ghostHintOn ? '开' : '关'}`;
  $('btn-ghost').classList.toggle('off', !ghostHintOn);
  missing.forEach((m) => { if (!m.fixed) m.ghost.visible = ghostHintOn; });
  showToast(ghostHintOn ? '残影提示已开启' : '残影提示已关闭 · 全凭眼力', 'ok');
});

$('btn-restart').addEventListener('click', setupRound);
$('rc-again').addEventListener('click', setupRound);

renderLevelTabs();
setupRound();
