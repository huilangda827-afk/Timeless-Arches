// ============================================================================
// 精细模式（精微匠造）
//   - 完整建模可见 + 备料架展示零件，玩家用键鼠精确摆放
//   - 微调面板 XYZ 平移/旋转 + 数值输入 + 步进按钮 + 方向键
//   - 三档难度阈值，每件可即时校验，结束统一打分（S/A/B/C/F）
// 复用 forge.html 的 import map（Vite 依赖：three / three/addons）
// ============================================================================
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PRECISION_LEVELS, DIFFICULTY, getLevelById } from './levels.js';
import * as BGM from '../portal/bgm.js';

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const app = $('app');
const sidebar = $('sidebar');

// ---------- URL 参数 ----------
const urlParams = new URLSearchParams(location.search);
const wantedLevelId = parseInt(urlParams.get('level') || '2', 10);
const LEVEL = getLevelById(wantedLevelId);

let difficulty = 'normal';

// ---------- Three 场景 ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1612);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.05, 5000);
camera.position.set(LEVEL.cameraPos.x, LEVEL.cameraPos.y, LEVEL.cameraPos.z);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
app.appendChild(renderer.domElement);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// 灯光
scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const dir = new THREE.DirectionalLight(0xffffff, 0.85);
dir.position.set(5, 8, 5);
scene.add(dir);

// 网格 + 坐标轴（辅助定位）
//   - 网格默认显示（地面参考，颜色克制不抢戏）
//   - 三色坐标轴默认隐藏，由顶部按钮 / 快捷键 X 切换
const grid = new THREE.GridHelper(10, 10, 0x554a3a, 0x33291f);
scene.add(grid);
const axes = new THREE.AxesHelper(1.5);
axes.visible = false;
scene.add(axes);

// OrbitControls
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.target.set(LEVEL.cameraTarget.x, LEVEL.cameraTarget.y, LEVEL.cameraTarget.z);
orbit.enableDamping = true;
orbit.minDistance = 0.5;
orbit.maxDistance = 30;

// TransformControls（gizmo 拖拽）
// three 0.166+ 起 TransformControls 的 gizmo 实体在 _root 上，必须用 getHelper() 加到场景里
const tc = new TransformControls(camera, renderer.domElement);
tc.setSize(1.2);
tc.setMode('translate');
const tcHelper = tc.getHelper ? tc.getHelper() : tc;
scene.add(tcHelper);
tc.addEventListener('dragging-changed', (e) => { orbit.enabled = !e.value; });
tc.addEventListener('change', () => {
  if (!selectedPiece) return;
  syncTweakInputs();
  refreshPieceListRow(selectedPiece);
  // 锚件移动会改变所有非锚件的相对误差 → 全量刷新；其他件只刷新自己即可
  if (selectedPiece === getAnchorPiece()) {
    pieces.forEach(updatePieceErrorBar);
  } else {
    updatePieceErrorBar(selectedPiece);
  }
});

// ---------- GLTF Loader ----------
const gltfLoader = new GLTFLoader();
function applyTf(obj, tf) {
  obj.position.set(tf.position.x, tf.position.y, tf.position.z);
  obj.quaternion.set(tf.quaternion.x, tf.quaternion.y, tf.quaternion.z, tf.quaternion.w);
  obj.scale.set(tf.scale.x, tf.scale.y, tf.scale.z);
}

// ---------- 场景对象 ----------
let envObj = null;
let showcaseObj = null;

// 锚点件：以"组件集合陆 · 木栓"为基准，其他件按相对位姿校验
//   - 玩家点 [⚡ 一键对齐] 把陆放到目标位置 → 看到拼装应该在哪里开始
//   - 其余 5 件的 pos/rot 都按"相对锚点"判定，而不是绝对世界坐标
//   - 这样彻底摆脱了 ghost 与目标位姿不一致带来的视觉误导
const ANCHOR_NAME = '组件集合陆';

const pieces = []; // { name, displayName, lore, obj, target: tf, dock: tf, status: {pos,rot,ok} }
let selectedPiece = null;
function getAnchorPiece() { return pieces.find((p) => p.name === ANCHOR_NAME); }

// ---------- 状态指示 ----------
function status(msg, isErr = false) {
  const el = $('status');
  if (!el) return;
  el.textContent = msg;
  el.style.color = isErr ? '#e87878' : '#9bcc9b';
}

// ---------- 加载流程 ----------
async function loadAll() {
  status('载入背景场景…');
  // 背景
  try {
    const env = await gltfLoader.loadAsync(LEVEL.environmentPath);
    envObj = env.scene;
    if (LEVEL.environmentTransform) applyTf(envObj, LEVEL.environmentTransform);
    envObj.traverse((n) => { if (n.isMesh) n.castShadow = false; });
    scene.add(envObj);
  } catch (e) { console.warn('背景加载失败:', e); }

  // 实体成品（旁置参考）
  status('载入参考实物…');
  if (LEVEL.showcasePath) {
    try {
      const sc = await gltfLoader.loadAsync(LEVEL.showcasePath);
      showcaseObj = sc.scene;
      if (LEVEL.showcaseTransform) applyTf(showcaseObj, LEVEL.showcaseTransform);
      scene.add(showcaseObj);
    } catch (e) { console.warn('showcase 加载失败:', e); }
  }

  // 注：幽灵刚体（半透明参考）已移除——其位姿与拼装目标不一致会误导用户。
  // 现在的玩法是「相对锚点」校验：玩家点击"集合陆 · 木栓"的 ⚡一键对齐 → 陆到目标位 → 其他件按相对它的位姿摆放即可。

  // 零件
  status('载入零件…');
  for (let i = 0; i < LEVEL.pieceNames.length; i++) {
    const name = LEVEL.pieceNames[i];
    const url = LEVEL.piecePathPrefix + name + '.glb';
    try {
      const gltf = await gltfLoader.loadAsync(url);
      const obj = gltf.scene;
      const dock = LEVEL.dockOverrides[name];
      const target = LEVEL.targetOverrides[name];
      if (dock) applyTf(obj, dock);
      else if (target) applyTf(obj, target);
      scene.add(obj);
      pieces.push({
        name,
        displayName: LEVEL.displayNames[name] || name,
        lore: LEVEL.pieceLore[name] || '',
        obj,
        target,
        dock,
        status: { pos: Infinity, rot: Infinity, ok: false },
      });
    } catch (e) {
      console.warn(`零件 ${name} 加载失败:`, e);
    }
  }
  status(`✅ 已载入 ${pieces.length}/${LEVEL.pieceNames.length} 个零件`);
  renderPieceList();
}

// ---------- 选择零件 ----------
function selectPiece(p) {
  selectedPiece = p;
  tc.attach(p.obj);
  syncTweakInputs();
  $('tweak-panel').style.display = 'block';
  $('tweak-title').textContent = `精调 · ${p.displayName}`;
  $('tweak-lore').textContent = p.lore || '';
  renderPieceList();
  updatePieceErrorBar(p);
}
function deselect() {
  selectedPiece = null;
  tc.detach();
  $('tweak-panel').style.display = 'none';
  renderPieceList();
}

// ---------- 鼠标拾取 ----------
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
renderer.domElement.addEventListener('pointerdown', (e) => {
  // 让 TransformControls 优先处理
  if (tc.dragging) return;
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const targets = pieces.map((p) => p.obj);
  const hits = raycaster.intersectObjects(targets, true);
  if (hits.length === 0) return;
  // 找到 hit 所属的 root piece
  let root = hits[0].object;
  while (root.parent && !pieces.some((p) => p.obj === root)) root = root.parent;
  const p = pieces.find((x) => x.obj === root);
  if (p) selectPiece(p);
});

// ---------- 精调面板 ----------
function syncTweakInputs() {
  if (!selectedPiece) return;
  const o = selectedPiece.obj;
  $('tw-px').value = (+o.position.x).toFixed(3);
  $('tw-py').value = (+o.position.y).toFixed(3);
  $('tw-pz').value = (+o.position.z).toFixed(3);
  // 用 Euler XYZ 给用户友好显示
  const eu = new THREE.Euler().setFromQuaternion(o.quaternion, 'XYZ');
  $('tw-rx').value = THREE.MathUtils.radToDeg(eu.x).toFixed(1);
  $('tw-ry').value = THREE.MathUtils.radToDeg(eu.y).toFixed(1);
  $('tw-rz').value = THREE.MathUtils.radToDeg(eu.z).toFixed(1);
}
// 选中件 transform 改动后的统一刷新：锚件改动会牵动所有件的相对误差
function refreshAfterEdit() {
  if (!selectedPiece) return;
  refreshPieceListRow(selectedPiece);
  if (selectedPiece === getAnchorPiece()) {
    pieces.forEach(updatePieceErrorBar);
  } else {
    updatePieceErrorBar(selectedPiece);
  }
}
function applyTweakInputs() {
  if (!selectedPiece) return;
  const o = selectedPiece.obj;
  const px = parseFloat($('tw-px').value); if (!isNaN(px)) o.position.x = px;
  const py = parseFloat($('tw-py').value); if (!isNaN(py)) o.position.y = py;
  const pz = parseFloat($('tw-pz').value); if (!isNaN(pz)) o.position.z = pz;
  const rx = parseFloat($('tw-rx').value);
  const ry = parseFloat($('tw-ry').value);
  const rz = parseFloat($('tw-rz').value);
  if (![rx, ry, rz].some(isNaN)) {
    const eu = new THREE.Euler(
      THREE.MathUtils.degToRad(rx),
      THREE.MathUtils.degToRad(ry),
      THREE.MathUtils.degToRad(rz),
      'XYZ',
    );
    o.quaternion.setFromEuler(eu);
  }
  refreshAfterEdit();
}

// 步进按钮（事件委托）
$('tweak-panel').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-step]');
  if (!btn || !selectedPiece) return;
  const step = parseFloat(btn.dataset.step);
  const row = btn.closest('.tweak-row');
  const input = row.querySelector('input');
  if (!input) return;
  input.value = (parseFloat(input.value || 0) + step).toFixed(3);
  applyTweakInputs();
  syncTweakInputs();
});
['tw-px','tw-py','tw-pz','tw-rx','tw-ry','tw-rz'].forEach((id) => {
  $(id).addEventListener('input', applyTweakInputs);
});

// 方向键 / PgUp / PgDn / W、E 微调
//   W / E       = 选中件绕 Y 轴 ±5°（Shift = ±15°）—— 斗拱场景最常用的「水平转向」
//   方向键      = XZ 平移 0.1 m（Shift = 0.5 m）
//   PgUp/PgDn   = Y 升降 0.1 m（Shift = 0.5 m）
//   M           = 切换 gizmo 模式 translate ↔ rotate
//   Enter       = 校验当前件
//   G/V/Esc     = 幽灵 / 复位机位 / 取消选中
const ROTATE_KEYS = new Set(['w', 'W', 'e', 'E']);
const MOVE_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown']);
window.addEventListener('keydown', (e) => {
  const tag = (e.target.tagName || '').toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;

  if (e.key === 'm' || e.key === 'M') {
    tc.setMode(tc.mode === 'translate' ? 'rotate' : 'translate');
    toast(`Gizmo 模式：${tc.mode === 'translate' ? '平移' : '旋转'}`, 'info');
    return;
  }
  if (e.key === 'Escape') { deselect(); return; }
  if (e.key === 'v' || e.key === 'V') { resetCamera(); return; }
  if (e.key === 'x' || e.key === 'X') { toggleAxes(); return; }
  if (e.key === 'Enter' && selectedPiece) { e.preventDefault(); validatePiece(selectedPiece, true); return; }

  if (!selectedPiece) return;
  const o = selectedPiece.obj;

  if (ROTATE_KEYS.has(e.key)) {
    e.preventDefault();
    const deg = e.shiftKey ? 15 : 5;
    const sign = (e.key === 'w' || e.key === 'W') ? -1 : +1; // W = 顺时针(俯视)，E = 逆时针
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(sign * deg));
    o.quaternion.premultiply(q);
    syncTweakInputs();
    refreshAfterEdit();
    return;
  }

  if (MOVE_KEYS.has(e.key)) {
    const step = e.shiftKey ? 0.5 : 0.1;
    if (e.key === 'ArrowLeft')       o.position.x -= step;
    else if (e.key === 'ArrowRight') o.position.x += step;
    else if (e.key === 'ArrowUp')    o.position.z -= step;
    else if (e.key === 'ArrowDown')  o.position.z += step;
    else if (e.key === 'PageUp')     o.position.y += step;
    else if (e.key === 'PageDown')   o.position.y -= step;
    e.preventDefault();
    syncTweakInputs();
    refreshAfterEdit();
  }
});

// ---------- 渲染零件列表 ----------
function renderPieceList() {
  const ul = $('piece-list');
  ul.innerHTML = '';
  pieces.forEach((p) => {
    const isAnchor = p.name === ANCHOR_NAME;
    const li = document.createElement('li');
    li.className = 'piece-row'
      + (selectedPiece === p ? ' selected' : '')
      + (isAnchor ? ' anchor' : '');
    li.dataset.name = p.name;
    li.innerHTML = `
      <div class="row-main">
        <span class="row-name">${isAnchor ? '<span class="anchor-badge" title="锚点件 · 其他件按它的相对位姿校验">锚</span> ' : ''}${p.displayName}</span>
        <span class="row-status" data-status></span>
      </div>
      <div class="row-bar"><div class="row-bar-fill" data-fill></div></div>
    `;
    li.addEventListener('click', () => {
      selectPiece(p);
      focusOn(p.obj);
    });
    ul.appendChild(li);
    refreshPieceListRow(p);
  });
}
function refreshPieceListRow(p) {
  const li = document.querySelector(`.piece-row[data-name="${CSS.escape(p.name)}"]`);
  if (!li) return;
  const stEl = li.querySelector('[data-status]');
  const fillEl = li.querySelector('[data-fill]');
  // 锚件特殊：永远满分（其它件都按它来）
  if (p.name === ANCHOR_NAME) {
    stEl.textContent = '锚点（参考件）';
    stEl.style.color = '#ffd24a';
    fillEl.style.width = '100%';
    fillEl.style.background = '#ffd24a';
    return;
  }
  if (!isFinite(p.status.pos)) {
    stEl.textContent = '—';
    stEl.style.color = '#88766c';
    fillEl.style.width = '0%';
    return;
  }
  const D = DIFFICULTY[difficulty];
  const posOk = p.status.pos <= D.pos;
  const rotOk = p.status.rot <= D.rot;
  const ok = posOk && rotOk;
  stEl.textContent = `${(p.status.pos * 100).toFixed(1)}cm / ${p.status.rot.toFixed(1)}°`;
  stEl.style.color = ok ? '#9bcc9b' : (posOk || rotOk ? '#ffd24a' : '#e87878');
  const ratio = Math.min(1, Math.max(p.status.pos / D.pos, p.status.rot / D.rot));
  const score = Math.max(0, 1 - ratio);
  fillEl.style.width = (score * 100).toFixed(0) + '%';
  fillEl.style.background = ok ? '#9bcc9b' : (score > 0.5 ? '#ffd24a' : '#e87878');
}

// ---------- 校验：相对锚点位姿 ----------
// 思路：选 "组件集合陆" 作为锚。
//   - 锚件本身：error = 0（永远视为达标，不计入分母）
//   - 其它件 P：用「四元数 + 位置」直接计算相对位姿，绕开矩阵分解
//   - 关键：各件的 target.scale 不同（0.24 ~ 0.38），如果走 Matrix4 分解会让 scale 渗透到 rot/pos
//     里产生伪误差。这里只用 pos/quat，scale 单独处理（不进入误差判定）
function _q(qd) { return new THREE.Quaternion(qd.x, qd.y, qd.z, qd.w); }
function _v(vd) { return new THREE.Vector3(vd.x, vd.y, vd.z); }
// 在锚 (aPos, aQuat) 的局部坐标系下，求 (pPos, pQuat) 的相对位姿
//   relPos = (pPos − aPos) 旋转回锚的局部系
//   relQuat = aQuat⁻¹ ∘ pQuat
function _relPose(aPos, aQuat, pPos, pQuat) {
  const aQinv = aQuat.clone().invert();
  const relPos = pPos.clone().sub(aPos).applyQuaternion(aQinv);
  const relQuat = aQinv.clone().multiply(pQuat);
  return { pos: relPos, quat: relQuat };
}
function calcError(p) {
  if (p.name === ANCHOR_NAME) return { pos: 0, rot: 0, isAnchor: true };
  if (!p.target) return { pos: Infinity, rot: Infinity, isAnchor: false };
  const anchor = getAnchorPiece();
  if (!anchor || !anchor.target) {
    return { pos: Infinity, rot: Infinity, isAnchor: false };
  }

  // 目标侧（在 anchor.target 的局部系下）
  const tRel = _relPose(_v(anchor.target.position), _q(anchor.target.quaternion),
                        _v(p.target.position),       _q(p.target.quaternion));
  // 实际侧（在 anchor 当前位姿的局部系下）
  const aRel = _relPose(anchor.obj.position.clone(), anchor.obj.quaternion.clone(),
                        p.obj.position.clone(),       p.obj.quaternion.clone());

  const pos = aRel.pos.distanceTo(tRel.pos);
  const rot = THREE.MathUtils.radToDeg(aRel.quat.angleTo(tRel.quat));
  return { pos, rot, isAnchor: false };
}
function updatePieceErrorBar(p) {
  const e = calcError(p);
  p.status.pos = e.pos;
  p.status.rot = e.rot;
  const D = DIFFICULTY[difficulty];
  p.status.ok = e.pos <= D.pos && e.rot <= D.rot;
  refreshPieceListRow(p);
  updateTweakError(p);
}
function updateTweakError(p) {
  if (!selectedPiece || selectedPiece !== p) return;
  const D = DIFFICULTY[difficulty];
  $('err-pos').textContent = (p.status.pos * 100).toFixed(2) + ' cm';
  $('err-rot').textContent = p.status.rot.toFixed(2) + '°';
  $('err-pos').style.color = p.status.pos <= D.pos ? '#9bcc9b' : '#e87878';
  $('err-rot').style.color = p.status.rot <= D.rot ? '#9bcc9b' : '#e87878';
}
function validatePiece(p, withToast = false) {
  updatePieceErrorBar(p);
  const D = DIFFICULTY[difficulty];
  const ok = p.status.ok;
  if (withToast) {
    if (ok) toast(`✅ ${p.displayName} 通过！`, 'ok');
    else toast(`位置差 ${(p.status.pos * 100).toFixed(1)}cm（需 ≤${(D.pos * 100).toFixed(0)}cm）· 角度差 ${p.status.rot.toFixed(1)}°（需 ≤${D.rot}°）`, 'warn');
  }
}

// ---------- 全局评分 ----------
function gradeAll() {
  pieces.forEach(updatePieceErrorBar);
  const D = DIFFICULTY[difficulty];
  // 锚件不计入评分（它本身就是参考系），其他 5 件按相对锚的位姿评
  const evalSet = pieces.filter((p) => p.name !== ANCHOR_NAME);
  let posSum = 0, rotSum = 0, okCount = 0;
  evalSet.forEach((p) => {
    const posScore = Math.max(0, 1 - p.status.pos / D.pos);
    const rotScore = Math.max(0, 1 - p.status.rot / D.rot);
    posSum += posScore;
    rotSum += rotScore;
    if (p.status.ok) okCount++;
  });
  const N = Math.max(1, evalSet.length);
  const score = (posSum + rotSum) / (2 * N); // 0-1
  let grade = 'F';
  if (score >= 0.95) grade = 'S';
  else if (score >= 0.85) grade = 'A';
  else if (score >= 0.70) grade = 'B';
  else if (score >= 0.50) grade = 'C';
  showResultCard({ score, grade, okCount, total: N });
}

// ---------- UI: toast / 结果 / 摄像 / ghost ----------
function toast(text, type = 'info') {
  const el = $('toast');
  el.textContent = text;
  el.className = 'toast show ' + type;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.className = 'toast'; }, 1800);
}
function showResultCard({ score, grade, okCount, total }) {
  const el = $('result-card');
  $('result-grade').textContent = grade;
  $('result-grade').className = 'grade grade-' + grade.toLowerCase();
  $('result-score').textContent = (score * 100).toFixed(1);
  $('result-meta').textContent = `${okCount} / ${total} 件达标 · ${DIFFICULTY[difficulty].label}模式`;
  el.classList.add('show');
}
$('result-close').addEventListener('click', () => $('result-card').classList.remove('show'));

function focusOn(obj) {
  const target = new THREE.Vector3();
  obj.getWorldPosition(target);
  const box = new THREE.Box3().setFromObject(obj);
  const size = new THREE.Vector3();
  box.getSize(size);
  const r = Math.max(size.x, size.y, size.z, 0.5) * 2.2;
  orbit.target.copy(target);
  const direction = new THREE.Vector3().subVectors(camera.position, target).normalize();
  if (direction.lengthSq() < 0.001) direction.set(1, 0.6, 1).normalize();
  camera.position.copy(target).addScaledVector(direction, r);
  orbit.update();
}
function resetCamera() {
  camera.position.set(LEVEL.cameraPos.x, LEVEL.cameraPos.y, LEVEL.cameraPos.z);
  orbit.target.set(LEVEL.cameraTarget.x, LEVEL.cameraTarget.y, LEVEL.cameraTarget.z);
  orbit.update();
}
// 坐标轴总开关：同时控制
//   1) 选中零件时出现的 TransformControls 三色 gizmo（红/绿/蓝箭头）
//   2) 世界原点的 AxesHelper（小三色坐标轴）
// 关闭时，画面更干净；纯键盘 / 数值面板照常调整
let coordVisible = false;
function applyCoordVisibility() {
  tcHelper.visible = coordVisible;
  tc.enabled = coordVisible; // 隐藏时禁用 gizmo 拾取，避免误点
  axes.visible = coordVisible;
  const btn = $('btn-axes');
  if (btn) {
    btn.textContent = coordVisible ? '隐藏坐标轴 (X)' : '显示坐标轴 (X)';
    btn.classList.toggle('active', coordVisible);
  }
}
function toggleAxes() {
  coordVisible = !coordVisible;
  applyCoordVisibility();
}
applyCoordVisibility(); // 初始：默认关闭

function snapToTarget() {
  // 一键对齐 = 把当前选中件直接放到它的「绝对目标位姿」
  // 校验是相对的（对锚件而言），所以一旦用户把所有件都 snap 一遍，
  // 锚件也就到了它的绝对 target → 全部相对误差自然为 0。
  // 这种"无脑绝对对齐"对用户最友好：snap 顺序无关、心智模型最简单。
  if (!selectedPiece || !selectedPiece.target) return;
  applyTf(selectedPiece.obj, selectedPiece.target);
  syncTweakInputs();
  refreshPieceListRow(selectedPiece);
  // 任意一件移动后，相对计算可能改变（特别是锚件），全量刷新误差
  pieces.forEach(updatePieceErrorBar);
  toast(`${selectedPiece.displayName} 已对齐目标`, 'ok');
}
function returnToDock() {
  if (!selectedPiece || !selectedPiece.dock) return;
  applyTf(selectedPiece.obj, selectedPiece.dock);
  syncTweakInputs();
  refreshPieceListRow(selectedPiece);
  updatePieceErrorBar(selectedPiece);
}

// ---------- 顶部按钮绑定 ----------
$('btn-validate').addEventListener('click', () => {
  if (selectedPiece) validatePiece(selectedPiece, true);
  else toast('请先在左侧或场景中选中一个零件', 'warn');
});
$('btn-grade').addEventListener('click', gradeAll);
$('btn-reset-cam').addEventListener('click', resetCamera);
$('btn-axes').addEventListener('click', toggleAxes);
$('btn-snap').addEventListener('click', snapToTarget);
$('btn-return-dock').addEventListener('click', returnToDock);
$('btn-back').addEventListener('click', () => {
  if (document.referrer && new URL(document.referrer).origin === location.origin) {
    history.back();
  } else {
    location.href = './forge.html';
  }
});

// 难度切换
document.querySelectorAll('.diff-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    difficulty = btn.dataset.diff;
    document.querySelectorAll('.diff-btn').forEach((b) => b.classList.toggle('active', b === btn));
    $('diff-tip').textContent =
      `${DIFFICULTY[difficulty].label}：位置 ≤ ${(DIFFICULTY[difficulty].pos * 100).toFixed(0)} cm · 角度 ≤ ${DIFFICULTY[difficulty].rot}°`;
    pieces.forEach(updatePieceErrorBar);
  });
});
// 默认普通
$('diff-tip').textContent = `普通：位置 ≤ ${(DIFFICULTY.normal.pos * 100).toFixed(0)} cm · 角度 ≤ ${DIFFICULTY.normal.rot}°`;

// ---------- 主循环 ----------
function animate() {
  orbit.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

// ---------- 入场欢迎弹窗 ----------
const INTRO_LS_KEY = 'precision_intro_seen_v1';
function maybeShowIntro() {
  // URL ?intro=1 强制显示；localStorage 记忆「不再提示」
  const force = urlParams.get('intro') === '1';
  if (!force && localStorage.getItem(INTRO_LS_KEY) === '1') return;
  $('intro-modal').classList.add('show');
}
$('intro-start').addEventListener('click', () => {
  if ($('intro-skip').checked) localStorage.setItem(INTRO_LS_KEY, '1');
  $('intro-modal').classList.remove('show');
});
$('btn-help').addEventListener('click', () => $('intro-modal').classList.add('show'));

// ---------- BGM 静音按钮（注入顶 bar，紧贴坐标轴/重置机位之前） ----------
const bgmBtn = document.createElement('button');
bgmBtn.id = 'btn-bgm';
bgmBtn.className = 'tb ghost';
bgmBtn.title = '背景音乐 · 江上清风游';
bgmBtn.style.cssText = 'min-width:44px;font-size:14px;';
const refreshBgmBtn = () => {
  bgmBtn.textContent = BGM.isMuted() ? '🔇' : '🎵';
  bgmBtn.style.opacity = BGM.isMuted() ? '0.6' : '1';
};
bgmBtn.addEventListener('click', () => { BGM.toggleMute(); refreshBgmBtn(); });
const axesBtn = $('btn-axes');
if (axesBtn && axesBtn.parentNode) {
  axesBtn.parentNode.insertBefore(bgmBtn, axesBtn);
} else {
  document.body.appendChild(bgmBtn);
}
refreshBgmBtn();

// 精微匠造 BGM = 江上清风游（与筑梦同家族）
BGM.play('forge');

// ---------- 启动 ----------
$('level-title').textContent = LEVEL.name;
$('level-subtitle').textContent = LEVEL.subtitle || '';
$('level-body').textContent = LEVEL.body || '';
maybeShowIntro();
loadAll();
animate();
