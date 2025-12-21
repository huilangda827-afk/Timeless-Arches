import * as THREE from "three";
import { SceneManager } from "./core/SceneManager.js";
import { HandInput } from "./core/HandInput.js";
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
  smoothAlpha: 0.35,
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
  });
  handInput.onGesture((event) => {
    if (event.type === "update") {
      // 手势更新由 update 循环处理
    } else if (event.type === "connected" || event.type === "disconnected") {
      updateUI();
    }
  });
  handInput.init();

  // 初始化 UI 管理器（传入 sceneManager 以便控制渲染器交互）
  uiManager = new UIManager(sceneManager);
  uiManager.onStartGame(() => {
    // 开始游戏时，可以在这里初始化游戏状态
    gameLogic.setPhase(gameLogic.Phase.Ready);
    console.log("[Main] 游戏开始");
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
