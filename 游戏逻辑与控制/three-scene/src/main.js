import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.module.js";
import { SceneManager } from "./core/SceneManager.js";
import { HandInput } from "./core/HandInput.js";
import BrowserHands from "./core/BrowserHands.js";
import { EffectManager } from "./core/EffectManager.js";
import { InteractionManager } from "./interaction/InteractionManager.js";
import { GameLogic } from "./game/GameLogic.js";
import { UIManager } from "./ui/UIManager.js";
import { level1Config } from "./core/levels/Level1Config.js";

// ===================== 配置参数 =====================
const CONFIG = {
  snapDistance: 0.7,
  snapAngleRad: THREE.MathUtils.degToRad(25),
  dragPlaneY: 0.0,
  pieceHoverY: 0.5,
  rotateStep: 0.12,
  rotateHoldMs: 160,
  gestureHz: 30,
  // 增强平滑，减少抖动（鼠标模式仍灵敏）
  smoothAlpha: 0.72,
  staleMs: 320,
  wsUrl: "ws://localhost:12345",
  wsRetryMs: 900,
  depthPlane: 5.0,
  depthMin: 2.0,
  depthMax: 10.0,
};

// ===================== 模块实例 =====================
let sceneManager, handInput, effectManager, interactionManager, gameLogic, uiManager;
let lastFrameTime = performance.now();
// 是否优先使用浏览器端 MediaPipe（纯前端模式），如果为 true 将跳过 WebSocket 初始化
const USE_BROWSER_HANDS = true;

// ===================== 初始化 =====================
function init() {
  // 初始化场景管理器
  sceneManager = new SceneManager({
    dragPlaneY: CONFIG.dragPlaneY,
    pieceHoverY: CONFIG.pieceHoverY,
  });
  sceneManager.init();
  
  // 初始化特效管理器
  effectManager = new EffectManager(sceneManager.getScene(), {
    dragPlaneY: CONFIG.dragPlaneY,
  });

  // 初始化交互管理器（先创建，模型加载后会更新pieces引用）
  interactionManager = new InteractionManager(sceneManager, {
    snapDistance: CONFIG.snapDistance,
    snapAngleRad: CONFIG.snapAngleRad,
    rotateStep: CONFIG.rotateStep,
    depthPlane: CONFIG.depthPlane,
    depthMin: CONFIG.depthMin,
    depthMax: CONFIG.depthMax,
    proximityPickThreshold: 1.2,
  });
  
  // ✅ 阶段2：加载GLB模型（替换测试立方体）
  // 先加载关卡模型，如果失败则使用测试立方体作为备用
  sceneManager.loadLevelModels(level1Config)
    .then(() => {
      // ✅ 修复模型交互：模型加载完成后，更新InteractionManager的pieces引用
      console.log("[Main] ✅ 模型加载完成，更新InteractionManager的pieces引用");
      interactionManager.updatePiecesReference(sceneManager.getPieces());
      interactionManager.updateSlotsReference(sceneManager.getSlots());
    })
    .catch((error) => {
      console.warn("[Main] GLB模型加载失败，使用测试立方体作为备用", error);
      sceneManager.createPuzzle(); // 备用方案：使用测试立方体
      // 即使使用测试立方体，也要更新引用
      interactionManager.updatePiecesReference(sceneManager.getPieces());
      interactionManager.updateSlotsReference(sceneManager.getSlots());
    });

  // 设置交互回调
  interactionManager.onSnap(({ piece, slot }) => {
    effectManager.spawnSnapFx(slot.position);
    gameLogic.checkCompleted(sceneManager.getPieces());
  });

  interactionManager.onHighlight(({ piece, on }) => {
    // 高亮已由 InteractionManager 内部处理
  });

  // 初始化游戏逻辑
  gameLogic = new GameLogic();
  gameLogic.onCompleted(() => {
    effectManager.spawnWinFx();
    sceneManager.getControls().enabled = true;
    // 显示完成提示
    try { uiManager.showMessage('拼接完成！恭喜，使用鼠标可尝试独立控制每个构件。', 3500); } catch (e) {}
  });

  // 初始化手势输入
  handInput = new HandInput({
    wsUrl: CONFIG.wsUrl,
    wsRetryMs: CONFIG.wsRetryMs,
    gestureHz: CONFIG.gestureHz,
    smoothAlpha: CONFIG.smoothAlpha,
    staleMs: CONFIG.staleMs,
    rotateStep: CONFIG.rotateStep,
    rotateHoldMs: CONFIG.rotateHoldMs,
    // 允许在未连接手势服务器时仍接收本地输入（便于本地调试/鼠标模式）
    // 如需严格依赖远端手势服务以关闭本地输入，请将此项设为 false
    allowLocalInput: true,
  });
  handInput.onGesture((event) => {
    if (event.type === "update") {
      // 调试：在控制台显示手势更新摘要
      try {
        const g = event.gesture;
        console.log('[Main] HandInput update ndc:', g.ndc.x.toFixed(3), g.ndc.y.toFixed(3), 'holding:', g.holding, 'edgeGrab:', g.edgeGrab, 'edgeRelease:', g.edgeRelease);
        // 将 NDC 映射到屏幕坐标并更新 UI 手势 overlay（如果存在）
        try {
          const canvas = sceneManager.getRenderer().domElement;
          const w = canvas.clientWidth;
          const h = canvas.clientHeight;
          const sx = ((g.ndc.x + 1) / 2) * w + canvas.getBoundingClientRect().left;
          const sy = ((1 - g.ndc.y) / 2) * h + canvas.getBoundingClientRect().top;
          if (uiManager && uiManager.setHandOverlayPosition) uiManager.setHandOverlayPosition(sx, sy, g.holding);
        } catch (e) {}
      } catch (e) {}
    } else if (event.type === "connected" || event.type === "disconnected") {
      console.log('[Main] HandInput', event.type);
      updateUI();
    }
  });
  // 仅在未使用浏览器端直连时初始化 WebSocket 客户端
  if (!USE_BROWSER_HANDS) {
    handInput.init();
  } else {
    console.log('[Main] 使用浏览器端 MediaPipe（BrowserHands），已跳过 WebSocket 初始化');
  }

  // 初始化 UI 管理器（传入 sceneManager 以便控制渲染器交互）
  uiManager = new UIManager(sceneManager);
  // 浏览器端 MediaPipe（可选）：在本地摄像头开启时启动
  const browserHands = new BrowserHands();
  uiManager.onLocalCameraToggle((video, open) => {
    try {
      if (open) {
        browserHands.start(video, (g) => {
          // g: { gesture, x, y } (0-1)
          try { handInput.applyGestureInput(g); } catch (e) {}
          try {
            // 显示调试信息到 HUD（raw 及 NDC）
            if (uiManager && uiManager.setHandDebug) {
              const ndcX = (g.x * 2 - 1).toFixed(3);
              const ndcY = (1 - 2 * g.y).toFixed(3);
              uiManager.setHandDebug(`${g.gesture} raw=(${g.x.toFixed(3)},${g.y.toFixed(3)}) ndc=(${ndcX},${ndcY})`);
            }
          } catch (e) {}
        });
      } else {
        browserHands.stop();
      }
    } catch (e) { console.error('[Main] BrowserHands toggle error', e); }
  });
  uiManager.onStartGame(() => {
    // 开始游戏时，可以在这里初始化游戏状态
    gameLogic.setPhase(gameLogic.Phase.Ready);
    console.log("[Main] 游戏开始");
    // 确保渲染器可以接收鼠标事件
    try { sceneManager.setRendererPointerEvents(true); } catch (e) {}
  });

  // 绑定鼠标事件
  setupMouseEvents();

  console.log("[Main] 初始化完成");
}

// ===================== 鼠标事件处理 =====================
function setupMouseEvents() {
  const renderer = sceneManager.getRenderer();
  const controls = sceneManager.getControls();

function getMouseNDC(ev) {
  const rect = renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(
      ((ev.clientX - rect.left) / rect.width) * 2 - 1,
      -((ev.clientY - rect.top) / rect.height) * 2 + 1
    );
  }

  renderer.domElement.addEventListener("pointerdown", (ev) => {
    // ✅ 修复：检查renderer的pointer-events状态
    const pointerEvents = window.getComputedStyle(renderer.domElement).pointerEvents;
    if (pointerEvents === "none") {
      console.log("[Main] 警告：renderer的pointer-events为none，无法接收鼠标事件");
      return;
    }
    
    const ndc = getMouseNDC(ev);
    
    // 如果按住了 Shift 键，进入调试模式（选择构件但不拖拽）
    if (ev.shiftKey) {
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(ndc, sceneManager.getCamera());
      const pieces = sceneManager.getPieces();
      // ✅ 修复模型交互：使用recursive: true以检测GLB模型的子对象
      const hits = raycaster.intersectObjects(pieces, true);
      
      if (hits.length > 0) {
        const piece = hits[0].object;
        gameLogic.selectPieceForDebug(piece);
        const pieceName = piece.userData.displayName || `Piece ${piece.userData.pieceId || "Unknown"}`;
        console.log(`[Main] 调试模式：已选中构件 ${pieceName}`);
      } else {
        // 点击空白处，清除选择
        const debugGUI = gameLogic.getDebugGUI();
        if (debugGUI && debugGUI.clearPiece) {
          debugGUI.clearPiece();
        }
      }
      return;
    }

    // 正常拖拽模式
    if (gameLogic.getPhase() === gameLogic.Phase.Completed) return;
    if (interactionManager.getGrabbed()) return; // 手势正在抓取

    const piece = interactionManager.onMouseDown(ndc);
    if (piece) {
      gameLogic.setPhase(gameLogic.Phase.Playing);
      controls.enabled = false;
      updateUI();
    }
  });

  renderer.domElement.addEventListener("pointermove", (ev) => {
    const ndc = getMouseNDC(ev);
    interactionManager.onMouseMove(ndc);
  });

  renderer.domElement.addEventListener("pointerup", () => {
    const snapped = interactionManager.onMouseUp();
    if (snapped) {
      gameLogic.checkCompleted(sceneManager.getPieces());
    }
    sceneManager.getControls().enabled = true;
    updateUI();
  });

  renderer.domElement.addEventListener("wheel", (ev) => {
    ev.preventDefault();
    // 如果正在拖拽构件，用于旋转
    if (interactionManager.getGrabbed()) {
      interactionManager.onMouseWheel(ev.deltaY);
    } else {
      // 否则用于调节深度平面
      interactionManager.adjustDepthByWheel(ev.deltaY);
    }
  });
}

// ===================== UI 更新 =====================
function updateUI() {
  const phase = gameLogic.getPhase();
  const input = handInput.isConnected() ? "gesture" : "mouse";
  const grabbed = interactionManager.getGrabbed();
  const grabText = grabbed ? `piece ${grabbed.userData.pieceId}` : "none";
  uiManager.update(phase, input, grabText);

  // 更新中心状态提示（摄像头/手势状态）
  try {
    const center = document.getElementById('hud-center-status');
    if (center) {
      const txt = handInput.isConnected() ? '手势服务已连接（非摄像头直连）' : '手势未连接 - 使用模拟器或鼠标模式';
      const span = center.querySelector('.center-status-text');
      if (span) span.textContent = txt;
    }
  } catch (e) {}
}

// ===================== 渲染循环 =====================
function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const dt = Math.min(0.033, (now - lastFrameTime) / 1000);
  lastFrameTime = now;

  // 更新手势输入
  handInput.update(dt);

  // 更新交互管理器（包含手势控制和渐进式磁吸）
  const gestureState = handInput.getCurrentGesture();
  if (handInput.isConnected()) {
    gestureState.connected = true;
  }
  
  // 记录释放前的抓取状态
  const hadGrabbed = interactionManager.getGrabbed() !== null;
  
  interactionManager.update(dt, gestureState);
  
  // 如果手势抓取，更新游戏阶段
  if (handInput.isConnected() && gestureState.edgeGrab && interactionManager.getGrabbed()) {
    gameLogic.setPhase(gameLogic.Phase.Playing);
    sceneManager.getControls().enabled = false;
  }
  
  // 如果手势释放，恢复相机控制并检查完成状态
  if (handInput.isConnected() && gestureState.edgeRelease && hadGrabbed) {
    sceneManager.getControls().enabled = true;
    // 检查是否完成（吸附回调中也会检查，这里作为备用）
    gameLogic.checkCompleted(sceneManager.getPieces());
  }

  // 更新特效
  effectManager.update(dt);

  // 更新相机控制器
  sceneManager.getControls().update();

  // 渲染场景
  sceneManager.getRenderer().render(
    sceneManager.getScene(),
    sceneManager.getCamera()
  );

  // 更新 UI
  updateUI();

  // 更新调试 GUI
  gameLogic.updateDebug();
}

// ===================== 启动 =====================
init();
animate();
