const sfxSnap = new Audio('/snap.mp3');
const sfxWin = new Audio('/win.mp3');
sfxSnap.volume = 0.6;
sfxWin.volume = 0.8;
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
// ===================== 粒子/特效（超轻量） =====================
const fxGroup = new THREE.Group();
const fxItems = []; // { obj, t, life, type, extra }
let lastFrameTime = performance.now();

function addFxToScene() {
  // 确保只加一次
  if (!scene || fxGroup.parent) return;
  scene.add(fxGroup);
}

// 光圈扩散（用于吸附/完成）
function spawnRingFx(worldPos, { life = 0.35, start = 0.2, end = 1.6 } = {}) {
  const geo = new THREE.RingGeometry(0.35, 0.55, 48);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(geo, mat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.copy(worldPos);
  ring.position.y += 0.02;

  ring.scale.setScalar(start);

  fxGroup.add(ring);
  fxItems.push({ obj: ring, t: 0, life, type: "ring", extra: { start, end } });
}

// 小碎点爆开（用于完成）
function spawnBurstFx(worldPos, { life = 0.6, count = 22, speed = 2.2 } = {}) {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    // 初始点在中心附近
    positions[i * 3 + 0] = worldPos.x;
    positions[i * 3 + 1] = worldPos.y + 0.25;
    positions[i * 3 + 2] = worldPos.z;

    // 随机速度（上抛 + 四散）
    const vx = (Math.random() * 2 - 1) * speed;
    const vy = (Math.random() * 0.9 + 0.6) * speed;
    const vz = (Math.random() * 2 - 1) * speed;

    velocities[i * 3 + 0] = vx;
    velocities[i * 3 + 1] = vy;
    velocities[i * 3 + 2] = vz;
  }

  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.06,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  const pts = new THREE.Points(geo, mat);

  fxGroup.add(pts);
  fxItems.push({ obj: pts, t: 0, life, type: "burst", extra: { velocities } });
}

// 吸附成功特效：一个小光圈
function spawnSnapFx(worldPos) {
  spawnRingFx(worldPos, { life: 0.28, start: 0.25, end: 1.35 });
}

// 完成特效：大光圈 + 碎点爆开
function spawnWinFx() {
  const center = new THREE.Vector3(0, DRAG_PLANE_Y + 0.2, 0);
  spawnRingFx(center, { life: 0.55, start: 0.2, end: 2.8 });
  spawnBurstFx(center, { life: 0.75, count: 26, speed: 1.8 });
}

// 每帧更新并自动销毁
function updateFx(dt) {
  for (let i = fxItems.length - 1; i >= 0; i--) {
    const it = fxItems[i];
    it.t += dt;
    const p = Math.min(1, it.t / it.life);

    if (it.type === "ring") {
      const { start, end } = it.extra;
      const s = start + (end - start) * p;
      it.obj.scale.setScalar(s);
      it.obj.material.opacity = 0.9 * (1 - p);
    } else if (it.type === "burst") {
      const posAttr = it.obj.geometry.getAttribute("position");
      const v = it.extra.velocities;

      for (let k = 0; k < posAttr.count; k++) {
        // 简单重力 + 阻尼
        v[k * 3 + 1] -= 3.6 * dt;
        v[k * 3 + 0] *= (1 - 0.6 * dt);
        v[k * 3 + 1] *= (1 - 0.35 * dt);
        v[k * 3 + 2] *= (1 - 0.6 * dt);

        posAttr.array[k * 3 + 0] += v[k * 3 + 0] * dt;
        posAttr.array[k * 3 + 1] += v[k * 3 + 1] * dt;
        posAttr.array[k * 3 + 2] += v[k * 3 + 2] * dt;
      }

      posAttr.needsUpdate = true;
      it.obj.material.opacity = 0.9 * (1 - p);
    }

    if (p >= 1) {
      fxGroup.remove(it.obj);
      it.obj.geometry?.dispose?.();
      it.obj.material?.dispose?.();
      fxItems.splice(i, 1);
    }
  }
}
/**
 * Module 3 - 최优工程版（可交付）
 * - 鼠标：选中/拖动/旋转/吸附/完成
 * - 手势：fist=抓取并拖动；open=释放并吸附；rotate-left/right=旋转
 * - 输入来自 WS：{ gesture: "open"|"fist"|"rotate-left"|"rotate-right", x: -1..1, y: -1..1 }
 */

// ===================== 调参区（只改这里就能调体验） =====================
const SNAP_DISTANCE = 0.7;
const SNAP_ANGLE_RAD = THREE.MathUtils.degToRad(25);

const DRAG_PLANE_Y = 0.0;
const PIECE_HOVER_Y = 0.5;

const ROTATE_STEP = 0.12;           // 旋转速度
const ROTATE_HOLD_MS = 160;         // 旋转指令保持（抗抖）

const GESTURE_HZ = 30;              // WS 节流
const SMOOTH_ALPHA = 0.35;          // 0~1，越大越跟手（越小越稳）
const STALE_MS = 320;               // 手离开/断帧后，多久自动松手

const WS_URL = "ws://localhost:12345";
const WS_RETRY_MS = 900;

// ===================== 游戏状态 =====================
const Phase = { Ready: "ready", Playing: "playing", Completed: "completed" };
let phase = Phase.Ready;

// ===================== Three 基础对象 =====================
let scene, camera, renderer, controls;
const raycaster = new THREE.Raycaster();
const mouseNDC = new THREE.Vector2();
const planeHit = new THREE.Vector3();
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -DRAG_PLANE_Y);

const pieces = [];
const slots = [];

// 鼠标控制
let mouseSelected = null;
let mouseDragging = false;
const mouseDragOffset = new THREE.Vector3();

// 手势控制
let grabbed = null;
const gestureDragOffset = new THREE.Vector3();

const gesture = {
  connected: false,

  // NDC
  raw: new THREE.Vector2(0, 0),
  ndc: new THREE.Vector2(0, 0),

  // holding 边沿
  holding: false,
  prevHolding: false,
  edgeGrab: false,
  edgeRelease: false,

  // rotate 方向保持
  rotateDir: 0,           // -1 / 0 / +1
  rotateUntil: 0,

  // 消息节流 + 超时
  lastMsgAt: 0,
  lastAcceptedAt: 0,
};

// HUD 缓存（避免每帧改 DOM）
const hudCache = { phase: "", input: "", grab: "" };

// ===================== 启动 =====================
init();
initGestureSocket();
animate();

// ===================== 初始化场景 =====================
function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x202020);

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(4, 5, 8);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.innerHTML = "";
  document.body.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  // lights
  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const dir = new THREE.DirectionalLight(0xffffff, 0.6);
  dir.position.set(5, 10, 7);
  scene.add(dir);

  // ground
  const groundGeo = new THREE.PlaneGeometry(30, 30);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = DRAG_PLANE_Y;
  scene.add(ground);

  createPuzzle();
  addHUD();
  setHUD();
  addFxToScene();

  // mouse events（备用 + 调试）
  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  renderer.domElement.addEventListener("pointermove", onPointerMove);
  renderer.domElement.addEventListener("pointerup", onPointerUp);
  renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("resize", onResize);

  console.log("[Game] Module3 initialized.");
}

// ===================== 创建拼图（槽位 + 构件） =====================
function createPuzzle() {
  // slots
  const slotGeo = new THREE.BoxGeometry(1, 0.35, 1);
  const slotMatBase = new THREE.MeshStandardMaterial({
    color: 0x777777,
    transparent: true,
    opacity: 0.45,
  });

  const slotPositions = [
    new THREE.Vector3(-3, DRAG_PLANE_Y + 0.18, 0),
    new THREE.Vector3(0, DRAG_PLANE_Y + 0.18, 0),
    new THREE.Vector3(3, DRAG_PLANE_Y + 0.18, 0),
  ];
  const slotRot = [0, Math.PI / 4, -Math.PI / 4];

  slotPositions.forEach((pos, i) => {
    const s = new THREE.Mesh(slotGeo, slotMatBase.clone());
    s.position.copy(pos);
    s.rotation.y = slotRot[i];
    s.userData.slotId = i;
    slots.push(s);
    scene.add(s);
  });

  // pieces
  const pieceGeo = new THREE.BoxGeometry(1, 1, 1);
  const colors = [0xff6666, 0x66ff66, 0x6666ff];
  const start = [
    new THREE.Vector3(-4, DRAG_PLANE_Y + PIECE_HOVER_Y, -3),
    new THREE.Vector3(0, DRAG_PLANE_Y + PIECE_HOVER_Y, -3),
    new THREE.Vector3(4, DRAG_PLANE_Y + PIECE_HOVER_Y, -3),
  ];

  start.forEach((pos, i) => {
    const mat = new THREE.MeshStandardMaterial({ color: colors[i] });
    mat.emissive = new THREE.Color(0x000000); // 用于高亮
    const p = new THREE.Mesh(pieceGeo, mat);
    p.position.copy(pos);
    p.userData = { pieceId: i, slotId: i, snapped: false };
    pieces.push(p);
    scene.add(p);
  });
}

// ===================== HUD =====================
function addHUD() {
  const hud = document.createElement("div");
  hud.style.position = "fixed";
  hud.style.left = "12px";
  hud.style.top = "12px";
  hud.style.color = "#fff";
  hud.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, monospace";
  hud.style.fontSize = "12px";
  hud.style.background = "rgba(0,0,0,.35)";
  hud.style.padding = "10px 12px";
  hud.style.borderRadius = "10px";
  hud.style.lineHeight = "1.5";
  hud.style.zIndex = "9999";
  hud.innerHTML =
    `Phase: <span id="hudPhase"></span><br/>` +
    `Input: <span id="hudInput"></span><br/>` +
    `Grabbed: <span id="hudGrab"></span><br/>` +
    `Tip: fist=grab/move, open=release+snap, thumb=L/R rotate`;
  document.body.appendChild(hud);
}

function setHUD() {
  const p = document.getElementById("hudPhase");
  const i = document.getElementById("hudInput");
  const g = document.getElementById("hudGrab");
  if (!p || !i || !g) return;

  const phaseText = phase;
  const inputText = gesture.connected ? "gesture" : "mouse";
  const grabText = grabbed ? `piece ${grabbed.userData.pieceId}` : "none";

  if (hudCache.phase !== phaseText) { p.textContent = phaseText; hudCache.phase = phaseText; }
  if (hudCache.input !== inputText) { i.textContent = inputText; hudCache.input = inputText; }
  if (hudCache.grab !== grabText) { g.textContent = grabText; hudCache.grab = grabText; }
}

// ===================== 鼠标输入（备用） =====================
function getMouseNDC(ev) {
  const rect = renderer.domElement.getBoundingClientRect();
  return {
    x: ((ev.clientX - rect.left) / rect.width) * 2 - 1,
    y: -((ev.clientY - rect.top) / rect.height) * 2 + 1,
  };
}

function onPointerDown(ev) {
  if (phase === Phase.Completed) return;

  const { x, y } = getMouseNDC(ev);
  mouseNDC.set(x, y);
  raycaster.setFromCamera(mouseNDC, camera);

  const hits = raycaster.intersectObjects(pieces, false);
  if (!hits.length) return;

  const obj = hits[0].object;
  if (obj.userData.snapped) return; // 已拼好不允许拖

  // 若手势正在抓取，则不让鼠标抢控制
  if (grabbed) return;

  mouseSelected = obj;
  mouseDragging = true;
  phase = Phase.Playing;

  highlightAll(false);
  highlight(mouseSelected, true);

  if (raycaster.ray.intersectPlane(dragPlane, planeHit)) {
    mouseDragOffset.copy(planeHit).sub(mouseSelected.position);
  }

  controls.enabled = false;
  setHUD();
}

function onPointerMove(ev) {
  if (!mouseDragging || !mouseSelected) return;

  const { x, y } = getMouseNDC(ev);
  mouseNDC.set(x, y);
  raycaster.setFromCamera(mouseNDC, camera);

  if (raycaster.ray.intersectPlane(dragPlane, planeHit)) {
    mouseSelected.position.copy(planeHit.sub(mouseDragOffset));
    mouseSelected.position.y = DRAG_PLANE_Y + PIECE_HOVER_Y;
  }
}

function onPointerUp() {
  if (!mouseSelected) {
    mouseDragging = false;
    controls.enabled = true;
    return;
  }

  highlight(mouseSelected, false);

  const snapped = trySnap(mouseSelected);
  if (snapped) {
    mouseSelected.userData.snapped = true;
    checkCompleted();
  }

  mouseSelected = null;
  mouseDragging = false;
  controls.enabled = true;
  setHUD();
}

function onWheel(ev) {
  if (!mouseSelected) return;
  ev.preventDefault();
  mouseSelected.rotation.y += (ev.deltaY > 0 ? 1 : -1) * ROTATE_STEP;
}

// ===================== WebSocket 输入（手势） =====================
function initGestureSocket() {
  const connect = () => {
    let sock;
    try {
      sock = new WebSocket(WS_URL);
    } catch (e) {
      console.error("[WS] init failed", e);
      setTimeout(connect, WS_RETRY_MS);
      return;
    }

    sock.onopen = () => {
      gesture.connected = true;
      console.log("[WS] three connected");
      setHUD();
    };

    sock.onclose = () => {
      gesture.connected = false;
      console.log("[WS] three disconnected; retrying...");
      setHUD();
      setTimeout(connect, WS_RETRY_MS);
    };

    sock.onerror = () => {
      // 交给 onclose 重连
    };

    sock.onmessage = async (event) => {
      // 节流：避免太高频
      const now = performance.now();
      if (now - gesture.lastAcceptedAt < 1000 / GESTURE_HZ) return;
      gesture.lastAcceptedAt = now;

      // 兼容 Blob / string
      let text = event.data;
      if (text instanceof Blob) text = await text.text();

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        return;
      }

      gesture.lastMsgAt = now;
      applyGestureInput(data);
    };
  };

  connect();
}

// 外部（WS）调用入口：更新状态即可（真正动作在每帧 gestureTick）
export function applyGestureInput(g) {
  console.log("WS in:", g);
  if (!g || !g.gesture) return;

  // 1) 更新光标（平滑）
  const rx = clamp(g.x, -1, 1);
  const ry = clamp(g.y, -1, 1);
  gesture.raw.set(rx, ry);
  gesture.ndc.lerp(gesture.raw, SMOOTH_ALPHA);

  // 2) holding 状态与边沿
  const holdingNow = (g.gesture === "fist") ? true : (g.gesture === "open") ? false : gesture.holding;
  gesture.prevHolding = gesture.holding;
  gesture.holding = holdingNow;

  gesture.edgeGrab = (!gesture.prevHolding && gesture.holding);
  gesture.edgeRelease = (gesture.prevHolding && !gesture.holding);

  // 3) rotate 指令（短暂保持，抗抖）
  const now = performance.now();
  if (g.gesture === "rotate-left") {
    gesture.rotateDir = -1;
    gesture.rotateUntil = now + ROTATE_HOLD_MS;
  } else if (g.gesture === "rotate-right") {
    gesture.rotateDir = 1;
    gesture.rotateUntil = now + ROTATE_HOLD_MS;
  }

  // 注意：这里不做实际 move/rotate，避免 WS 频率影响丝滑度
}

// ===================== 每帧处理手势控制（丝滑核心） =====================
function gestureTick() {
  if (!gesture.connected) return;
  if (phase === Phase.Completed) return;

  const now = performance.now();

  // 超时保护：手离开/断帧 → 自动松手
  if (now - gesture.lastMsgAt > STALE_MS) {
    // 触发释放边沿
    if (gesture.holding) {
      gesture.prevHolding = true;
      gesture.holding = false;
      gesture.edgeRelease = true;
    }
    gesture.rotateDir = 0;
    gesture.rotateUntil = 0;
  }

  // rotate 保持到期
  if (gesture.rotateUntil && now > gesture.rotateUntil) {
    gesture.rotateDir = 0;
    gesture.rotateUntil = 0;
  }

  // 使用虚拟光标射线
  raycaster.setFromCamera(gesture.ndc, camera);

  // 抓取边沿：open→fist
  if (gesture.edgeGrab && !grabbed) {
    const hits = raycaster.intersectObjects(pieces, false).filter(h => !h.object.userData.snapped);
    if (hits.length) {
      grabbed = hits[0].object;
      phase = Phase.Playing;

      highlightAll(false);
      highlight(grabbed, true);

      if (raycaster.ray.intersectPlane(dragPlane, planeHit)) {
        gestureDragOffset.copy(planeHit).sub(grabbed.position);
      }

      controls.enabled = false;
      setHUD();
    }
    gesture.edgeGrab = false;
  }

  // holding 中：拖动 + 旋转
  if (gesture.holding && grabbed) {
    if (raycaster.ray.intersectPlane(dragPlane, planeHit)) {
      grabbed.position.copy(planeHit.sub(gestureDragOffset));
      grabbed.position.y = DRAG_PLANE_Y + PIECE_HOVER_Y;
    }

    if (gesture.rotateDir !== 0) {
      grabbed.rotation.y += gesture.rotateDir * ROTATE_STEP;
    }
  }

  // 释放边沿：fist→open
  if (gesture.edgeRelease && grabbed) {
    highlight(grabbed, false);

    const snapped = trySnap(grabbed);
    if (snapped) {
      grabbed.userData.snapped = true;
      checkCompleted();
    }

    grabbed = null;
    controls.enabled = true;
    setHUD();

    gesture.edgeRelease = false;
  }
}

// ===================== 拼接判定 =====================
function trySnap(piece) {
  const slot = slots.find(s => s.userData.slotId === piece.userData.slotId);
  if (!slot) return false;

  const dist = piece.position.distanceTo(slot.position);
  const angle = shortestAngleDiff(piece.rotation.y, slot.rotation.y);

  if (dist < SNAP_DISTANCE && angle < SNAP_ANGLE_RAD) {
    piece.position.copy(slot.position);
    piece.position.y = DRAG_PLANE_Y + PIECE_HOVER_Y;
    piece.rotation.y = slot.rotation.y;
    sfxSnap.currentTime = 0;
    sfxSnap.play().catch(()=>{});
    spawnSnapFx(slot.position);
    return true;
  }
  return false;
}

function shortestAngleDiff(a, b) {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

function checkCompleted() {
  if (pieces.every(p => p.userData.snapped)) {
    phase = Phase.Completed;
    controls.enabled = true;
    highlightAll(false);
    console.log("[Game] Puzzle completed!");
    setHUD();
    sfxWin.currentTime = 0;
    sfxWin.play().catch(() => {});
    spawnWinFx();
  }
}

// ===================== 高亮工具 =====================
function highlight(obj, on) {
  if (!obj?.material?.emissive) return;
  obj.material.emissive.set(on ? 0x333333 : 0x000000);
}
function highlightAll(on) {
  pieces.forEach(p => highlight(p, on));
}

// ===================== resize / clamp =====================
function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// ===================== 渲染循环 =====================
function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const dt = Math.min(0.033, (now - lastFrameTime) / 1000);
  lastFrameTime = now;

  // ✅ 更新粒子特效
  updateFx(dt);

  gestureTick();  // 如果你有这行保留
  controls.update();
  renderer.render(scene, camera);

  setHUD();
}