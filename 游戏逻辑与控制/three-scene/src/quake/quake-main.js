// ============================================================
// 稳如山 · 地震台试炼（游艺坊）
//
//   左：第一关的 5 件斗拱构件按装配位姿叠放（每件独立刚体，靠摩擦咬合）
//   右：程序化刚性砖墙（对照组）
//   下：振动台（运动学刚体，按震级做正弦往复运动）
//
//   物理：cannon-es。斗拱构件用包围盒近似碰撞体，木-木接触高摩擦低弹性；
//   砖墙细高、重心高，中震即倒；斗拱矮壮、层层咬合，摇而不散——
//   一屏对照讲清"以柔克刚"的榫卯抗震智慧。
// ============================================================
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { markQuake } from '../shared/records.js';
import { mountBgm } from '../shared/bgm-widget.js';
import { encodeAssetUrl } from '../shared/asset-url.js';

mountBgm('forge');

const $ = (id) => document.getElementById(id);

// ---------------- Three 场景 ----------------
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 200);
camera.position.set(2.8, 2.1, 4.0);

scene.add(new THREE.HemisphereLight(0xffe9c4, 0x3a2c1a, 1.0));
const key = new THREE.DirectionalLight(0xffd9a0, 2.2);
key.position.set(4, 6, 5);
scene.add(key);
const rim = new THREE.DirectionalLight(0xc8392b, 0.55);
rim.position.set(-5, 2, -4);
scene.add(rim);

const orbit = new OrbitControls(camera, canvas);
orbit.enableDamping = true;
orbit.dampingFactor = 0.08;
orbit.target.set(0, 0.7, 0);
orbit.maxPolarAngle = Math.PI * 0.52;
orbit.minDistance = 2;
orbit.maxDistance = 14;

// ---------------- 物理世界 ----------------
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
// 注意：不要用 SAPBroadphase——实测对后续动态加入的刚体漏检碰撞（砖块互相穿透），
// 本场景刚体总数 <30，默认 NaiveBroadphase 完全够用且可靠。
world.allowSleep = true;           // 静止即休眠：砖墙不再因求解器抖动自己散掉
world.solver.iterations = 24;      // 多层堆叠需要更高迭代精度（默认 10 会塌）

const matWood = new CANNON.Material('wood');
const matBrick = new CANNON.Material('brick');
const matTable = new CANNON.Material('table');
world.addContactMaterial(new CANNON.ContactMaterial(matWood, matWood, { friction: 0.85, restitution: 0.02 }));
world.addContactMaterial(new CANNON.ContactMaterial(matWood, matTable, { friction: 0.9, restitution: 0.02 }));
world.addContactMaterial(new CANNON.ContactMaterial(matBrick, matBrick, { friction: 0.45, restitution: 0.05 }));
world.addContactMaterial(new CANNON.ContactMaterial(matBrick, matTable, { friction: 0.5, restitution: 0.05 }));

// ---------------- 振动台 ----------------
const TABLE = { w: 4.2, h: 0.24, d: 2.0 };
const tableMesh = new THREE.Mesh(
  new THREE.BoxGeometry(TABLE.w, TABLE.h, TABLE.d),
  new THREE.MeshStandardMaterial({ color: 0x2c2118, roughness: 0.85, metalness: 0.1 })
);
// 台面鎏金描边
const edge = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(TABLE.w, TABLE.h, TABLE.d)),
  new THREE.LineBasicMaterial({ color: 0xc9a24b, transparent: true, opacity: 0.7 })
);
tableMesh.add(edge);
tableMesh.position.set(0, TABLE.h / 2, 0);
scene.add(tableMesh);

const tableBody = new CANNON.Body({
  type: CANNON.Body.KINEMATIC,
  material: matTable,
  shape: new CANNON.Box(new CANNON.Vec3(TABLE.w / 2, TABLE.h / 2, TABLE.d / 2)),
});
tableBody.position.set(0, TABLE.h / 2, 0);
world.addBody(tableBody);

// 底座（静止装饰）
const base = new THREE.Mesh(
  new THREE.CylinderGeometry(3.4, 3.8, 0.35, 48),
  new THREE.MeshStandardMaterial({ color: 0x17110b, roughness: 0.95 })
);
base.position.y = -0.28;
scene.add(base);

const TABLE_TOP = TABLE.h;

// ---------------- 刚体登记 ----------------
// entries: { mesh, body, group: 'dougong' | 'brick', home: {pos, quat} }
const entries = [];

function register(mesh, body, group) {
  scene.add(mesh);
  world.addBody(body);
  entries.push({
    mesh, body, group,
    home: { pos: body.position.clone(), quat: body.quaternion.clone() },
  });
}

// ---------------- 斗拱结构库（三套可选，位姿数据与关卡校准同步） ----------------
const DG_CENTER_X = -1.1;  // 斗拱在台面左侧
const WOOD_DENSITY = 480;  // kg/m³

// tf: { p: 位置, q: 四元数(可省=单位), s: 缩放(可省=1) }；scale = 整体再放大倍数
const STRUCTURES = [
  {
    id: 'danqiao', name: '单翘斗拱', scale: 2.2, prefix: '/models/',
    items: [
      { file: '大斗',      tf: { p: [0, 0, 0] } },
      { file: '正心瓜拱',  tf: { p: [-0.007, 0.011, 0.005] } },
      { file: '华拱',      tf: { p: [0.007, 0.032, -0.006] } },
      { file: '散科-右边', tf: { p: [0.005, 0.090, -0.208] } },
      { file: '散科-左边', tf: { p: [0.020, 0.095, 0.195] } },
    ],
  },
  {
    id: 'wanchunting', name: '万春亭铺作', scale: 3.0, prefix: '/models/level2/',
    items: [
      { file: '组件集合陆', tf: { p: [1.9532, 0.3855, -1.0534], q: [0, 0.5736, 0, 0.8191], s: [0.3379, 0.3379, 0.3379] } },
      { file: '组件集合伍', tf: { p: [1.9532, 0.465, -1.0534], q: [0, 0.5736, 0, 0.8191], s: [0.3776, 0.3776, 0.3776] } },
      { file: '组件集合肆', tf: { p: [1.9532, 0.5445, -1.0534], q: [-0.0714, 0.5714, -0.05, 0.816], s: [0.2385, 0.2385, 0.2385] } },
      { file: '组件集合叁', tf: { p: [1.9532, 0.5842, -1.0534], q: [0, -0.8191, 0, 0.5736], s: [0.3577, 0.3578, 0.3577] } },
      { file: '组件集合贰', tf: { p: [1.9532, 0.6637, -1.0534], q: [-0.0101, -0.819, -0.0144, 0.5735], s: [0.3578, 0.3578, 0.3578] } },
      { file: '组件集合壹', tf: { p: [1.9159, 0.7432, -1.067], q: [0, -0.8191, 0, 0.5736], s: [0.3577, 0.3578, 0.3577] } },
    ],
  },
  {
    id: 'shengmudian', name: '圣母殿铺作', scale: 1.6, prefix: '/models/level3/',
    items: [
      { file: '1底部', tf: { p: [2.9, 0.1, 1.1], q: [0, -0.2588, 0, 0.9659], s: [0.65, 0.65, 0.65] } },
      { file: '2泥道栱、散斗与一跳华栱、散斗与交互斗与阑额一道柱头枋、散斗', tf: { p: [2.883, 0.3, 1.0813], q: [0, -0.2588, 0, 0.9659], s: [0.55, 0.55, 0.55] } },
      { file: '3华头子出头（出一折）、交互斗、梭形栱', tf: { p: [2.883, 0.4, 1.081], q: [0, 0.5, 0, 0.866], s: [0.4, 0.4, 0.4] } },
      { file: '4瓜子栱与散斗、丁头栱（充当鞾楔作用）与散斗', tf: { p: [2.9, 0.47, 1.1], q: [0, 0.9659, 0, 0.2588], s: [0.5, 0.5, 0.5] } },
      { file: '5二道柱头枋（隐刻短栱）、散斗', tf: { p: [3.14, 0.47, 0.781], q: [0, -0.2588, 0, 0.9659], s: [0.6, 0.6, 0.6] } },
      { file: '6昂尾下皮置鞾楔与一道下昂（批竹昂起棱出尖）、昂尾上置散斗、替木、平槫', tf: { p: [2.883, 0.49, 1.081], q: [0, 0.9659, 0, 0.2588], s: [0.55, 0.55, 0.55] } },
      { file: '7罗汉枋、令栱、散斗', tf: { p: [2.881, 0.4, 0.937], q: [0, -0.2588, 0, 0.9659], s: [0.6, 0.6, 0.6] } },
      { file: '9三道柱头枋（隐刻长栱）、散斗、替木（通檐', tf: { p: [2.9, 0.7, 1], q: [0, -0.2588, 0, 0.9659], s: [0.55, 0.55, 0.55] } },
      { file: '10压槽枋、撩檐槫', tf: { p: [2.97, 0.63, 0.781], q: [0, 0.9659, 0, 0.2588], s: [0.4, 0.4, 0.4] } },
      { file: '11顶部', tf: { p: [2.683, 0.87, 1.019], q: [0, 0.9659, 0, 0.2588], s: [0.85, 0.85, 0.85] } },
    ],
  },
];

let currentStructure = STRUCTURES[0];
const dgConstraints = [];
const glbCache = new Map();
const loader = new GLTFLoader();

async function loadCached(url) {
  if (glbCache.has(url)) return glbCache.get(url).clone(true);
  const gltf = await loader.loadAsync(encodeAssetUrl(url));
  glbCache.set(url, gltf.scene);
  return gltf.scene.clone(true);
}

async function buildDougong() {
  const S = currentStructure.scale;
  // 逐件加载 → 摆到校准位姿（整体再放大 S 倍）→ 统一算包围盒 → 整体落到台面
  const loaded = [];
  for (const item of currentStructure.items) {
    const mesh = await loadCached(currentStructure.prefix + item.file + '.glb');
    const tf = item.tf;
    mesh.position.set(tf.p[0] * S, tf.p[1] * S, tf.p[2] * S);
    if (tf.q) mesh.quaternion.set(tf.q[0], tf.q[1], tf.q[2], tf.q[3]);
    const baseS = tf.s ? tf.s[0] : 1;
    mesh.scale.set(baseS * S, (tf.s ? tf.s[1] : 1) * S, (tf.s ? tf.s[2] : 1) * S);
    loaded.push({ mesh });
    $('loading').textContent = `${currentStructure.name} 载入中…（${loaded.length}/${currentStructure.items.length}）`;
  }

  // 组合包围盒 → 平移量：水平居中到 DG_CENTER_X、底面贴台面
  const groupBox = new THREE.Box3();
  loaded.forEach((it) => groupBox.expandByObject(it.mesh));
  const center = groupBox.getCenter(new THREE.Vector3());
  const shift = new THREE.Vector3(DG_CENTER_X - center.x, TABLE_TOP - groupBox.min.y + 0.005, -center.z);

  for (const it of loaded) {
    it.mesh.position.add(shift);
    it.mesh.updateMatrixWorld(true);

    // 包围盒碰撞体 + 体积估质量。
    // 关键：斗拱构件互相咬合，包围盒必然大面积重叠。若允许构件互撞，
    // 求解器开局就会产生巨大分离冲量把结构炸飞。
    // 解法（榫卯的完整物理表达）：五件同属碰撞组 2 且互不碰撞——
    // 内部相对位姿完全由 LockConstraint（榫卯）维持，对台面/砖块正常碰撞。
    const SHRINK = 0.85;
    const box = new THREE.Box3().setFromObject(it.mesh);
    const size = box.getSize(new THREE.Vector3());
    const boxCenter = box.getCenter(new THREE.Vector3());
    const mass = Math.max(2, size.x * size.y * size.z * WOOD_DENSITY);

    const body = new CANNON.Body({
      mass,
      material: matWood,
      shape: new CANNON.Box(new CANNON.Vec3(
        (size.x / 2) * SHRINK,
        (size.y / 2) * SHRINK,
        (size.z / 2) * SHRINK
      )),
      linearDamping: 0.12,
      angularDamping: 0.2,
      collisionFilterGroup: 2,
      collisionFilterMask: -1 & ~2, // 与除组 2 之外的一切碰撞
    });
    body.position.set(boxCenter.x, boxCenter.y, boxCenter.z);

    // mesh 原点 ≠ 包围盒中心：记录偏移，同步时补回
    it.mesh.userData.offset = it.mesh.position.clone().sub(boxCenter);
    register(it.mesh, body, 'dougong');
  }

  // 榫卯约束：按高度排序后逐层锁定（LockConstraint），咬合成整体。
  // maxForce 大值 → 榫卯咬合不崩开；极限工况下整体滑移/倾覆仍触发失稳判定。
  const dgBodies = entries
    .filter((e) => e.group === 'dougong')
    .map((e) => e.body)
    .sort((a, b) => a.position.y - b.position.y);
  for (let i = 0; i < dgBodies.length - 1; i++) {
    const c = new CANNON.LockConstraint(dgBodies[i], dgBodies[i + 1], { maxForce: 1e6 });
    world.addConstraint(c);
    dgConstraints.push(c);
  }
}

// 移除当前斗拱（切换结构用）
function removeDougong() {
  for (const c of dgConstraints) world.removeConstraint(c);
  dgConstraints.length = 0;
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].group !== 'dougong') continue;
    scene.remove(entries[i].mesh);
    world.removeBody(entries[i].body);
    entries.splice(i, 1);
  }
}

// 切换结构：重置砖墙 → 拆旧装新 → 预沉降 → 重记原位
let switching = false;
async function switchStructure(st) {
  if (switching || st === currentStructure) return;
  switching = true;
  stopShake();
  $('result').hidden = true;
  currentStructure = st;
  renderStructureTabs();
  // 砖墙归位
  for (const e of entries.filter((x) => x.group === 'brick')) {
    e.body.position.copy(e.home.pos);
    e.body.quaternion.copy(e.home.quat);
    e.body.velocity.set(0, 0, 0);
    e.body.angularVelocity.set(0, 0, 0);
  }
  removeDougong();
  $('loading').style.display = 'block';
  try {
    await buildDougong();
    for (let i = 0; i < 60; i++) world.step(1 / 60);
    entries.forEach((e) => {
      e.home.pos = e.body.position.clone();
      e.home.quat = e.body.quaternion.clone();
    });
    setStatus('dougong', '静候试炼', '');
    setStatus('brick', '静候试炼', '');
    failed.dougong = false;
    failed.brick = false;
  } catch (err) {
    console.error('[quake] 结构加载失败', err);
  }
  $('loading').style.display = 'none';
  switching = false;
}

function renderStructureTabs() {
  const box = $('structure-tabs');
  box.innerHTML = '';
  for (const st of STRUCTURES) {
    const b = document.createElement('button');
    b.className = 'c-tab' + (st === currentStructure ? ' on' : '');
    b.textContent = st.name;
    b.disabled = switching;
    b.addEventListener('click', () => switchStructure(st));
    box.appendChild(b);
  }
}

// ---------------- 砖墙（对照组，程序化生成） ----------------
const BRICK = { w: 0.3, h: 0.15, d: 0.16 };
const BRICK_DENSITY = 1800;

function buildBrickWall() {
  const brickGeo = new THREE.BoxGeometry(BRICK.w, BRICK.h, BRICK.d);
  const brickMats = [
    new THREE.MeshStandardMaterial({ color: 0x8a8078, roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ color: 0x7a7068, roughness: 0.9 }),
  ];
  // 对齐砌法（错缝偏移会让端部悬空，预沉降阶段就自己塌了）
  const COLS = 3, ROWS = 6;
  const cx = 1.2; // 台面右侧
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = cx + (c - (COLS - 1) / 2) * (BRICK.w + 0.006);
      const y = TABLE_TOP + BRICK.h / 2 + r * (BRICK.h + 0.004);
      const mesh = new THREE.Mesh(brickGeo, brickMats[(r + c) % 2]);
      mesh.position.set(x, y, 0);
      const mass = BRICK.w * BRICK.h * BRICK.d * BRICK_DENSITY;
      const body = new CANNON.Body({
        mass,
        material: matBrick,
        shape: new CANNON.Box(new CANNON.Vec3(BRICK.w / 2, BRICK.h / 2, BRICK.d / 2)),
        linearDamping: 0.05,
        angularDamping: 0.08,
      });
      body.position.set(x, y, 0);
      mesh.userData.offset = new THREE.Vector3(0, 0, 0);
      register(mesh, body, 'brick');
    }
  }
}

// ---------------- 地震控制 ----------------
let shaking = false;
let shakeStart = 0;
let magnitude = 6.0;
const SHAKE_DURATION = 12; // 秒

// 震级 → 振幅/频率。台面峰值加速度 a = A·(2πf)²：
//   M4 ≈ 1.8 m/s²（有感晃动）  M6 ≈ 8.7 m/s²（≈木-台摩擦极限，斗拱微滑而不散）
//   M8 ≈ 24 m/s²（远超摩擦极限，任何无锚固结构都将失稳）
function shakeParams(mag) {
  const k = (mag - 4) / 4; // 0..1
  return {
    amp: 0.02 + k * 0.07,      // 振幅（米）
    freq: 1.5 + k * 1.1,       // 频率（Hz）
  };
}

$('mag').addEventListener('input', () => {
  magnitude = parseFloat($('mag').value);
  $('mag-val').textContent = `M ${magnitude.toFixed(1)}`;
});

function setStatus(group, text, tone) {
  const el = $(group === 'dougong' ? 'status-dougong' : 'status-brick');
  el.textContent = text;
  el.className = tone || '';
}

function startShake() {
  if (shaking) return;
  $('result').hidden = true;
  entries.forEach((e) => e.body.wakeUp()); // 唤醒休眠刚体，否则台面在它们脚下白晃
  shaking = true;
  shakeStart = performance.now();
  failed.dougong = false;
  failed.brick = false;
  setStatus('dougong', '试炼中…', 'run');
  setStatus('brick', '试炼中…', 'run');
  $('btn-shake').disabled = true;
  $('timer').hidden = false;
}

function stopShake() {
  shaking = false;
  tableBody.velocity.set(0, 0, 0);
  tableBody.position.x = 0;
  $('btn-shake').disabled = false;
  $('timer').hidden = true;
}

function resetAll() {
  stopShake();
  $('result').hidden = true;
  for (const e of entries) {
    e.body.position.copy(e.home.pos);
    e.body.quaternion.copy(e.home.quat);
    e.body.velocity.set(0, 0, 0);
    e.body.angularVelocity.set(0, 0, 0);
  }
  failed.dougong = false;
  failed.brick = false;
  setStatus('dougong', '静候试炼', '');
  setStatus('brick', '静候试炼', '');
}

$('btn-shake').addEventListener('click', startShake);
$('btn-reset').addEventListener('click', resetAll);
$('rc-again').addEventListener('click', () => { $('result').hidden = true; resetAll(); });
$('rc-stronger').addEventListener('click', () => {
  $('result').hidden = true;
  resetAll();
  magnitude = Math.min(8, magnitude + 0.5);
  $('mag').value = magnitude;
  $('mag-val').textContent = `M ${magnitude.toFixed(1)}`;
  startShake();
});

// ---------------- 失稳判定 ----------------
const failed = { dougong: false, brick: false };

function checkFailures() {
  for (const groupName of ['dougong', 'brick']) {
    if (failed[groupName]) continue;
    const groupEntries = entries.filter((e) => e.group === groupName);
    // 阈值分组：砖墙一旦明显错位/翻倒即算倒塌；斗拱允许更大幅度的滑移摇摆（以柔克刚）
    const limit = groupName === 'brick'
      ? { horiz: 0.3, vert: 0.12, tiltDot: 0.87 }   // 砖：位移 30cm / 掉层 12cm / 倾斜 >30°
      : { horiz: 0.9, vert: 0.5, tiltDot: 0.5 };    // 斗拱：位移 90cm / 60° 才算散架
    const up = new CANNON.Vec3(0, 1, 0);
    const fail = groupEntries.some((e) => {
      const fellOff = e.body.position.y < TABLE_TOP - 0.15; // 掉下台面
      const idealX = e.home.pos.x + tableBody.position.x;   // 跟随台面的理想位置
      const displaced = Math.abs(e.body.position.y - e.home.pos.y) > limit.vert
        || Math.hypot(e.body.position.x - idealX, e.body.position.z - e.home.pos.z) > limit.horiz;
      // 倾倒检测：本体 Y 轴与世界竖直方向的夹角
      const bodyUp = e.body.quaternion.vmult(up);
      const tilted = bodyUp.y < limit.tiltDot;
      return fellOff || displaced || tilted;
    });
    if (fail) {
      failed[groupName] = true;
      setStatus(groupName, groupName === 'brick' ? '倒塌！' : '散架了…', 'fail');
    }
  }
}

function finishShake() {
  stopShake();
  const dgOk = !failed.dougong;
  setStatus('dougong', dgOk ? '稳如山！' : '散架了…', dgOk ? 'ok' : 'fail');
  setStatus('brick', failed.brick ? '倒塌！' : '侥幸稳固', failed.brick ? 'fail' : 'ok');
  markQuake(magnitude, dgOk);

  $('rc-title').textContent = dgOk ? '稳如山！' : '这一震太猛了…';
  $('rc-kicker').textContent = `◆◆◆ M ${magnitude.toFixed(1)} 试炼结束 ◆◆◆`;
  $('rc-body').textContent = dgOk
    ? (failed.brick
        ? `${SHAKE_DURATION} 秒 M ${magnitude.toFixed(1)} 强震：刚性砖墙轰然倒塌，榫卯斗拱却在层层滑移与摩擦中卸去了冲击、稳稳立住。这正是应县木塔历经千年四十余次地震而不倒的秘密。`
        : `${SHAKE_DURATION} 秒摇撼，斗拱与砖墙都撑住了——试试加大震级，看看谁先到极限。`)
    : '构件散落了。真实的榫卯还有暗销与咬合槽提供额外约束，我们的简化模拟到这个震级就散了——不妨降半级再看看砖墙的表现。';
  $('result').hidden = false;
}

// ---------------- 主循环 ----------------
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
  const dt = Math.min(clock.getDelta(), 1 / 30);

  if (shaking) {
    const t = (performance.now() - shakeStart) / 1000;
    const { amp, freq } = shakeParams(magnitude);
    // 起震 1 秒缓入，尾段 1.5 秒缓出
    const envelope = Math.min(1, t / 1) * Math.min(1, Math.max(0, (SHAKE_DURATION - t) / 1.5));
    const x = Math.sin(t * Math.PI * 2 * freq) * amp * envelope;
    // 运动学刚体：直接给速度（位置差分），物理接触才能正确传递
    tableBody.velocity.x = (x - tableBody.position.x) / (1 / 60);
    $('timer').textContent = `${Math.min(SHAKE_DURATION, t).toFixed(1)} s`;
    if (t >= SHAKE_DURATION) finishShake();
  } else {
    tableBody.velocity.x = 0;
  }

  world.step(1 / 60, dt, 3);

  // 同步表现层
  tableMesh.position.copy(tableBody.position);
  for (const e of entries) {
    e.mesh.position.copy(e.body.position).add(e.mesh.userData.offset || new THREE.Vector3());
    e.mesh.quaternion.copy(e.body.quaternion);
  }
  if (shaking) checkFailures();

  orbit.update();
  renderer.render(scene, camera);
});

// ---------------- 启动 ----------------
(async () => {
  try {
    renderStructureTabs();
    buildBrickWall();
    await buildDougong();
    // 预沉降：静默跑 1 秒物理让构件落稳，再以稳定姿态作为"原位"基准
    for (let i = 0; i < 60; i++) world.step(1 / 60);
    entries.forEach((e) => {
      e.home.pos = e.body.position.clone();
      e.home.quat = e.body.quaternion.clone();
    });
    $('loading').style.display = 'none';
  } catch (err) {
    console.error('[quake] 加载失败', err);
    $('loading').textContent = '构件加载失败，请刷新重试';
  }
})();
