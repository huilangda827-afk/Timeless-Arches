/**
 * 斗拱拼装游戏 - 主入口文件
 * 
 * 功能：
 * - 加载背景环境和幽灵参照物
 * - 解析目标位置（从幽灵组件）
 * - 加载玩家可交互组件
 * - 实现手势/鼠标拖拽和自动吸附
 */

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { HandInput } from "./core/HandInput.js";

// ===================== 全局变量 =====================
let scene, camera, renderer, controls;
let handInput;
let gltfLoader = new GLTFLoader();

// 场景对象
let environmentModel = null; // 背景版.glb
let ghostModel = null; // 幽灵组件.glb
let interactivePieces = []; // 玩家可交互的组件数组
let TARGET_CONFIG = {}; // 目标位置配置字典

// 手势/拖拽状态
let cursorSphere; // 绿色小球（虚拟手光标）
let isGrabbing = false;
let grabbedObject = null;
let smoothCursorX = 0;
let smoothCursorY = 0;
let smoothCursorZ = 0.75; // ✅ 初始化Z轴平滑值（备料架Z=1.5和柱子Z=0之间）
const cursorSmoothAlpha = 0.2;

// 吸附参数
const SNAP_DISTANCE = 2.0; // ✅ 吸附阈值（调整为2.0米，更容易吸附，匹配肉眼判断）
const SNAP_ANGLE_THRESHOLD = Math.PI / 2; // 角度阈值（90度，更宽松）

// 组件列表（需要加载的玩家组件）
const PIECE_NAMES = ['大斗', '华拱', '正心瓜拱', '散科-左边', '散科-右边'];

// 音效
let audioSnap = null;
let audioWin = null;

// 停靠区配置（组件初始位置）- 已改为线性排列
// 实际使用：startX = -4, gap = 2, height = 1.5, depth = 3.0
const DOCKING_AREA = {
  startX: -4,    // 起始X位置
  gap: 2,        // 组件间距
  height: 1.5,   // 基准高度
  depth: 3.0     // 前后位置
};

// ===================== 初始化 =====================
async function init() {
  // 创建场景
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a1a);

  // 创建相机 - 拉近镜头聚焦工作台
  camera = new THREE.PerspectiveCamera(
    50, // ✅ 修改FOV为50，获得更好的透视感（从60改为50）
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  // ✅ 修改相机位置：从右前方俯视，更近的视角
  const startPos = new THREE.Vector3(6.0, 4.0, 6.0); // 从(10.79, 2.76, 0.42)改为更近
  camera.position.copy(startPos);

  // 创建渲染器
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  
  // 设置渲染器样式 - 占80%页面高度
  renderer.domElement.style.position = 'fixed';
  renderer.domElement.style.top = '10%'; // 顶部留10%
  renderer.domElement.style.left = '0';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '80%'; // 占80%高度
  renderer.domElement.style.zIndex = '0';
  renderer.domElement.style.pointerEvents = 'none';
  
  document.body.appendChild(renderer.domElement);

  // 创建轨道控制器
  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.5, 0); // ✅ 修改观察点：盯着红柱子中心（从2.0改为1.5）
  controls.minDistance = 2;
  controls.maxDistance = 20;
  controls.maxPolarAngle = Math.PI / 2; // 防止钻入地底
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.enableZoom = true; // ✅ 确保鼠标滚轮缩放启用
  controls.zoomSpeed = 1.0; // ✅ 缩放速度
  controls.enablePan = true; // ✅ 允许平移
  controls.enableRotate = true; // ✅ 允许旋转
  controls.update(); // 立即更新
  
  // ✅ 注意：OrbitControls 会自动处理滚轮事件
  // 只要 renderer.domElement.style.pointerEvents = 'auto'，滚轮就能正常工作

  // 添加光照
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
  directionalLight.position.set(5, 10, 5);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = 50;
  directionalLight.shadow.camera.left = -10;
  directionalLight.shadow.camera.right = 10;
  directionalLight.shadow.camera.top = 10;
  directionalLight.shadow.camera.bottom = -10;
  scene.add(directionalLight);

  // 创建虚拟手光标（绿色小球）
  const sphereGeometry = new THREE.SphereGeometry(0.15, 16, 16);
  const sphereMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x00ff00,
    transparent: true,
    opacity: 0.8, // 稍微透明
    depthTest: false, // ✅ 关键：禁用深度测试，确保永远渲染在最上层
    depthWrite: false // ✅ 不写入深度缓冲
  });
  cursorSphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
  cursorSphere.position.set(0, 2, 0.75); // ✅ 初始位置在中间深度（备料架Z=1.5和柱子Z=0之间）
  cursorSphere.visible = false; // 初始隐藏，手势激活时显示
  cursorSphere.renderOrder = 999; // ✅ 设置渲染顺序，确保在最上层
  scene.add(cursorSphere);

  // 初始化手势输入
  handInput = new HandInput();

  // 初始化音效
  try {
    audioSnap = new Audio('/snap.mp3');
    audioSnap.volume = 0.6;
    audioWin = new Audio('/win (2).mp3');
    audioWin.volume = 0.7;
    console.log('[Main] ✅ 音效已加载');
  } catch (error) {
    console.warn('[Main] ⚠️ 音效加载失败:', error);
  }

  // 窗口大小调整
  window.addEventListener('resize', onWindowResize);

  // 绑定UI事件
  setupUIEvents();

  // 按顺序加载资源
  console.log('[Main] 开始加载游戏资源...');
  await loadEnvironment();
  await loadGhostReference();
  await loadInteractivePieces();

  console.log('[Main] ✅ 游戏初始化完成');
  
  // ✅ 调试：最终对账单 - 验证名称匹配
  console.log("=== [DEBUG] 最终对账单 - 名称匹配验证 ===");
  console.log("目标点数量:", Object.keys(TARGET_CONFIG).length);
  console.log("玩家组件数量:", interactivePieces.length);
  console.log("\n目标点列表:", Object.keys(TARGET_CONFIG));
  console.log("玩家组件列表:", interactivePieces.map(p => p.userData.partID));
  
  // 检查匹配情况
  const missingTargets = interactivePieces.filter(p => !TARGET_CONFIG[p.userData.partID]);
  const missingPieces = Object.keys(TARGET_CONFIG).filter(key => !interactivePieces.find(p => p.userData.partID === key));
  
  if (missingTargets.length > 0) {
    console.warn("⚠️ 以下组件没有对应的目标位置:", missingTargets.map(p => p.userData.partID));
  }
  if (missingPieces.length > 0) {
    console.warn("⚠️ 以下目标位置没有对应的组件:", missingPieces);
  }
  if (missingTargets.length === 0 && missingPieces.length === 0) {
    console.log("✅ 所有组件和目标位置都匹配！");
  }
  console.log("==================================");
}

// ===================== Step 1: 加载静态环境 =====================
async function loadEnvironment() {
  return new Promise((resolve, reject) => {
    console.log('[Main] 加载背景环境: /models/背景版.glb');
    gltfLoader.load(
      '/models/背景版.glb',
      (gltf) => {
        const model = gltf.scene;
        model.position.set(0, 0, 0); // 世界原点对齐
        
        // 启用阴影
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        
        environmentModel = model;
        environmentModel.userData.isStatic = true;
        scene.add(environmentModel);
        
        console.log('[Main] ✅ 背景环境已加载');
        resolve();
      },
      undefined,
      (error) => {
        console.error('[Main] ❌ 背景环境加载失败:', error);
        reject(error);
      }
    );
  });
}

// ===================== Step 2: 解析幽灵参照物 =====================
async function loadGhostReference() {
  return new Promise((resolve, reject) => {
    console.log('[Main] 加载幽灵参照物: /models/幽灵组件.glb');
    gltfLoader.load(
      '/models/幽灵组件.glb',
      (gltf) => {
        const model = gltf.scene;
        model.position.set(0, 0, 0); // 世界原点对齐
        
        // 遍历所有子节点，查找包含"配套"的节点
        model.traverse((node) => {
          if (node.isMesh && node.name && node.name.includes('配套')) {
            // 提取基础名称（去掉"配套"后缀）
            const baseName = node.name.replace('配套', '').trim();
            
            // ✅ 获取世界坐标和旋转（模型原点已对齐，直接读取，无需偏移）
            const worldPosition = new THREE.Vector3();
            const worldQuaternion = new THREE.Quaternion();
            node.getWorldPosition(worldPosition);
            node.getWorldQuaternion(worldQuaternion);
            
            // 存入目标配置
            TARGET_CONFIG[baseName] = {
              position: worldPosition.clone(),
              quaternion: worldQuaternion.clone(),
              isOccupied: false,
              originalNode: node
            };
            
            console.log(`[Main] ✅ 找到目标位置: ${baseName}`, worldPosition);
          }
        });
        
        // 隐藏幽灵模型
        model.visible = false;
        ghostModel = model;
        scene.add(ghostModel);
        
        console.log('[Main] ✅ 幽灵参照物已解析，找到', Object.keys(TARGET_CONFIG).length, '个目标位置');
        
        // ✅ 调试：打印幽灵目标数据解析结果（对账单格式）
        console.log("=== [DEBUG] 幽灵目标数据解析结果 ===");
        console.log("目标点 (Target) 列表:");
        Object.keys(TARGET_CONFIG).forEach(key => {
          const target = TARGET_CONFIG[key];
          console.log(`  ${key} | 世界坐标 (${target.position.x.toFixed(3)}, ${target.position.y.toFixed(3)}, ${target.position.z.toFixed(3)})`);
        });
        console.log("==================================");
        
        resolve();
      },
      undefined,
      (error) => {
        console.error('[Main] ❌ 幽灵参照物加载失败:', error);
        reject(error);
      }
    );
  });
}

// ===================== Step 3: 生成玩家组件 =====================
async function loadInteractivePieces() {
  const loadPromises = PIECE_NAMES.map((pieceName, index) => {
    return new Promise((resolve, reject) => {
      console.log(`[Main] 加载组件 [${index + 1}/${PIECE_NAMES.length}]: ${pieceName}`);
      gltfLoader.load(
        `/models/${pieceName}.glb`,
        (gltf) => {
          const model = gltf.scene;
          
          // ✅ 调试：检查模型原始缩放（Blender导出后应该是1.0）
          const originalScale = model.scale.clone();
          console.log(`[Main]   组件 ${pieceName} 原始缩放: [x:${originalScale.x.toFixed(3)}, y:${originalScale.y.toFixed(3)}, z:${originalScale.z.toFixed(3)}]`);
          
          // 身份绑定
          model.userData.partID = pieceName;
          model.userData.isSnapped = false;
          model.userData.isDraggable = true;
          
          // ✅ 调试：检查是否有对应的目标位置
          const target = TARGET_CONFIG[pieceName];
          if (target) {
            console.log(`[Main] ✅ 组件 ${pieceName} 有对应的目标位置:`, target.position);
          } else {
            console.warn(`[Main] ⚠️ 组件 ${pieceName} 没有对应的目标位置！可用目标:`, Object.keys(TARGET_CONFIG));
          }
          
          // ✅ 修复：建立"备料架" - 放在红柱子右侧，更靠近工作区
          // 红柱子大约在(0, 0, 0)，备料架放在右侧，方便拿取
          const count = PIECE_NAMES.length;
          const spacing = 1.2; // 组件间距
          const startX = 2.0; // ✅ 起始X位置（红柱子右侧，从居中改为右侧）
          
          // ✅ 特殊处理：散科-左边和散科-右边放到更容易看到和抓取的位置
          let dockPos;
          if (pieceName === '散科-左边' || pieceName === '散科-右边') {
            // 放到备料架前排（Z轴更靠前，更容易看到）
            // 散科-左边放在左侧，散科-右边放在右侧
            const sideIndex = pieceName === '散科-左边' ? 0 : 1;
            dockPos = new THREE.Vector3(
              1.5 + sideIndex * 1.5,  // X轴：左侧1.5，右侧3.0（更靠近红柱子）
              1.2,                     // Y轴：稍微高一点，更容易看到
              1.0                      // Z轴：更靠前，在备料架前排
            );
            console.log(`[Main] ✅ ${pieceName} 已放置到前排易抓取位置`);
          } else {
            // 其他组件正常排列在备料架
            dockPos = new THREE.Vector3(
              startX + index * spacing, // X轴从右侧开始排列
              1.0,                      // Y轴高度1米（悬浮，不被地面遮挡）
              0.5                       // ✅ Z轴接近红柱子（从1.5改为0.5，更靠近）
            );
          }
          
          model.position.copy(dockPos);
          
          // ✅ 保持原始缩放为1.0（Blender已导出为1.0，不需要额外缩放）
          // model.scale.set(1.5, 1.5, 1.5); // 移除1.5倍缩放，保持原始1.0
          
          // ✅ 调试辅助：确保组件可见
          model.visible = true;
          
          // ✅ 调试：输出组件最终位置和缩放
          console.log(`[Main]   组件 ${pieceName} 已放置到备料架: 位置(${dockPos.x.toFixed(2)}, ${dockPos.y.toFixed(2)}, ${dockPos.z.toFixed(2)}), 缩放[${model.scale.x.toFixed(3)}, ${model.scale.y.toFixed(3)}, ${model.scale.z.toFixed(3)}]`);
          
          // 启用阴影
          let meshCount = 0;
          model.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              child.visible = true; // ✅ 确保所有子网格可见
              meshCount++;
              // ✅ 调试：输出每个Mesh的名称和可见性
              console.log(`[Main]     Mesh: ${child.name || '未命名'}, 可见: ${child.visible}, 位置: [${child.position.x.toFixed(2)}, ${child.position.y.toFixed(2)}, ${child.position.z.toFixed(2)}]`);
            }
          });
          
          // ✅ 调试：检查是否有Mesh
          if (meshCount === 0) {
            console.warn(`[Main] ⚠️ 组件 ${pieceName} 没有找到任何Mesh！`);
          } else {
            console.log(`[Main] ✅ 组件 ${pieceName} 包含 ${meshCount} 个Mesh`);
          }
          
          interactivePieces.push(model);
          scene.add(model);
          
          console.log(`[Main] ✅ 组件 ${pieceName} 已加载并添加到场景`);
          resolve();
        },
        undefined,
        (error) => {
          console.error(`[Main] ❌ 组件 ${pieceName} 加载失败:`, error);
          reject(error);
        }
      );
    });
  });
  
  await Promise.all(loadPromises);
  console.log('[Main] ✅ 所有玩家组件已加载到备料架');
  
  // ✅ 调试：打印玩家组件对账单
  console.log("=== [DEBUG] 玩家组件加载对账单 ===");
  console.log("玩家组件 (Part) 列表:");
  interactivePieces.forEach((piece) => {
    const partID = piece.userData.partID;
    const scale = piece.scale;
    console.log(`  ${partID} | 初始坐标 (${piece.position.x.toFixed(3)}, ${piece.position.y.toFixed(3)}, ${piece.position.z.toFixed(3)}) | 缩放比例 [${scale.x.toFixed(3)}, ${scale.y.toFixed(3)}, ${scale.z.toFixed(3)}]`);
  });
  console.log("==================================");
}

// ===================== Step 4: 拖拽与吸附系统 =====================
function checkSnap(piece) {
  if (!piece.userData.isDraggable || piece.userData.isSnapped) {
    return false;
  }
  
  const partID = piece.userData.partID;
  const target = TARGET_CONFIG[partID];
  
  if (!target) {
    // ✅ 调试：如果找不到目标，输出所有可用的目标
    console.warn(`[Main] ⚠️ 组件 ${partID} 没有对应的目标位置。可用目标:`, Object.keys(TARGET_CONFIG));
    return false;
  }
  
  if (target.isOccupied) {
    console.debug(`[Main] 目标位置 ${partID} 已被占用`);
    return false;
  }
  
  // 计算距离
  const distance = piece.position.distanceTo(target.position);
  
  // ✅ 减少调试日志输出（只在距离很近但未吸附时输出）
  // if (distance < 1.5) {
  //   console.log(`[Main] 📍 ${partID} 吸附检查: 距离 ${distance.toFixed(2)}米`);
  // }
  
    // ✅ 吸附判定：距离小于阈值即可（调整为0.8米，更容易吸附）
    let shouldSnap = false;
    if (distance < SNAP_DISTANCE) {
      // 计算角度差异（简化：只检查Y轴旋转）
      const pieceQuat = new THREE.Quaternion();
      piece.getWorldQuaternion(pieceQuat);
      const angleDiff = pieceQuat.angleTo(target.quaternion);
      
      // ✅ 如果距离很近（小于1.0），忽略角度；否则检查角度
      if (distance < 1.0 || angleDiff < SNAP_ANGLE_THRESHOLD) {
        shouldSnap = true;
      } else {
        // ✅ 减少日志输出
        // console.log(`[Main] ${partID} 距离: ${distance.toFixed(2)}米, 角度差: ${(angleDiff * 180 / Math.PI).toFixed(1)}°`);
      }
    }
    // 移除距离太远时的日志，减少控制台噪音
  
  // 吸附判定
  if (shouldSnap) {
    // ✅ 调试：输出吸附前的信息
    console.log(`[Main] 🎯 触发吸附！${partID} 距离: ${distance.toFixed(2)}米`);
    console.log(`[Main]   当前位置:`, piece.position);
    console.log(`[Main]   目标位置:`, target.position);
    
    // 强制设置位置和旋转
    piece.position.copy(target.position);
    piece.quaternion.copy(target.quaternion);
    
    // 锁定组件
    piece.userData.isSnapped = true;
    piece.userData.isDraggable = false;
    target.isOccupied = true;
    
    // 播放音效
    if (audioSnap) {
      try {
        audioSnap.currentTime = 0;
        audioSnap.play().catch(e => console.debug('[Main] 音效播放失败:', e));
      } catch (e) {
        console.debug('[Main] 音效播放错误:', e);
      }
    }
    
    console.log(`[Main] ✅ ${partID} 已安装到目标位置！位置:`, piece.position);
    
    // ✅ 检查是否全部完成（需要验证位置和角度是否正确）
    const allSnapped = interactivePieces.every(p => {
      if (!p.userData.isSnapped) return false;
      
      // ✅ 验证：检查组件是否真的在目标位置附近（距离 < 0.5米）
      const partID = p.userData.partID;
      const target = TARGET_CONFIG[partID];
      if (!target) return false;
      
      const dist = p.position.distanceTo(target.position);
      if (dist > 0.5) {
        console.warn(`[Main] ⚠️ ${partID} 标记为已吸附，但距离目标还有 ${dist.toFixed(2)}米，未真正完成`);
        return false;
      }
      
      // ✅ 验证：检查角度是否正确（角度差 < 30度）
      const pieceQuat = new THREE.Quaternion();
      p.getWorldQuaternion(pieceQuat);
      const angleDiff = pieceQuat.angleTo(target.quaternion);
      if (angleDiff > Math.PI / 6) { // 30度
        console.warn(`[Main] ⚠️ ${partID} 标记为已吸附，但角度差还有 ${(angleDiff * 180 / Math.PI).toFixed(1)}°，未真正完成`);
        return false;
      }
      
      return true;
    });
    
    if (allSnapped) {
      console.log('[Main] 🎉 恭喜！所有组件都已拼装完成！');
      if (audioWin) {
        try {
          audioWin.currentTime = 0;
          audioWin.play().catch(e => console.debug('[Main] 成功音效播放失败:', e));
        } catch (e) {
          console.debug('[Main] 成功音效播放错误:', e);
        }
      }
    }
    
    return true;
  }
  
  return false;
}

// ===================== 手势映射到3D空间 =====================
function mapGestureTo3D(gesture) {
  // ✅ 修复：简化映射逻辑，确保方向正确
  // MediaPipe坐标：x(0-1, 左到右), y(0-1, 上到下)
  // 摄像头镜像导致左右相反，需要翻转X轴
  
  // X轴映射：左右移动
  // 手向右移动(gesture.x增大) -> 小球应该向右移动(X增大)
  // 需要翻转：targetX = -(gesture.x - 0.5) * 范围
  const targetX = -(gesture.x - 0.5) * 8.0; // 范围约 -4 到 4
  
  // Y轴映射：上下移动
  // 手向上移动(gesture.y减小) -> 小球应该向上移动(Y增大)
  // MediaPipe的Y是从上到下，Three.js的Y是从下到上，需要翻转
  const targetY = (1.0 - gesture.y) * 4.0 + 0.5; // 范围约 0.5 到 4.5
  
  // Z轴映射：前后移动（倾斜操作台）
  // 手在屏幕下方(gesture.y接近1) -> Z较大（靠近备料架）
  // 手在屏幕上方(gesture.y接近0) -> Z较小（靠近红柱子）
  // 红柱子大约在Z=0，备料架在Z=1.5（调整后）
  const targetZ = gesture.y * 1.5; // 范围约 0 到 1.5
  
  return new THREE.Vector3(targetX, targetY, targetZ);
}

// ===================== UI 事件绑定 =====================
function setupUIEvents() {
  const bindEvents = () => {
    const btnStart = document.getElementById('btn-start');
    const pageMenu = document.getElementById('page-menu');
    const gameHud = document.getElementById('page-game-hud');
    const btnHome = document.getElementById('btn-home');

    // 开始筑梦按钮
    if (btnStart) {
      btnStart.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('[Main] ✅ 开始筑梦按钮被点击');
        
        if (pageMenu) pageMenu.classList.add('hidden');
        if (gameHud) gameHud.style.display = 'flex';
        if (renderer) {
          renderer.domElement.style.pointerEvents = 'auto'; // ✅ 启用鼠标事件（包括滚轮）
          // ✅ 确保 OrbitControls 能接收事件
          if (controls) {
            controls.enabled = true;
          }
        }
        
        // 启动手势输入
        try {
          await handInput.start();
          cursorSphere.visible = true;
          console.log('[Main] ✅ 手势输入已启动');
        } catch (error) {
          console.error('[Main] ❌ 手势输入启动失败:', error);
    }
  });
}

    // 返回主页按钮
    if (btnHome) {
      btnHome.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('[Main] ✅ 返回主页按钮被点击');
        
        if (pageMenu) pageMenu.classList.remove('hidden');
        if (gameHud) gameHud.style.display = 'none';
        if (renderer) {
          renderer.domElement.style.pointerEvents = 'none';
          // ✅ 禁用 OrbitControls
          if (controls) {
            controls.enabled = false;
          }
        }
        
        // 停止手势输入
        if (handInput) {
          handInput.stop();
          cursorSphere.visible = false;
        }
      });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindEvents);
  } else {
    setTimeout(bindEvents, 100);
  }
}

// ===================== 窗口大小调整 =====================
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  // 保持80%高度
  renderer.domElement.style.height = `${window.innerHeight * 0.8}px`;
}

// ===================== 渲染循环 =====================
function animate() {
  requestAnimationFrame(animate);

  // 更新控制器
  if (controls) {
    controls.update();
  }

  // 手势控制
  if (handInput && handInput.isConnected()) {
    const gesture = handInput.getGesture();
    
    // 映射手势到3D空间
    const worldPos = mapGestureTo3D(gesture);
    
    // ✅ 修复：平滑移动光标（包含Z轴，确保所有轴都平滑）
    smoothCursorX += (worldPos.x - smoothCursorX) * cursorSmoothAlpha;
    smoothCursorY += (worldPos.y - smoothCursorY) * cursorSmoothAlpha;
    smoothCursorZ += (worldPos.z - smoothCursorZ) * cursorSmoothAlpha;
    
    cursorSphere.position.set(smoothCursorX, smoothCursorY, smoothCursorZ);
    
    // 抓取逻辑
    if (gesture.isPinching) {
      if (!isGrabbing) {
        // ✅ 只在未抓取时寻找最近的未吸附组件（防止意外切换）
        const availablePieces = interactivePieces.filter(p => p.userData.isDraggable && !p.userData.isSnapped);
        let closestPiece = null;
        let closestDist = Infinity;
        
        // ✅ 调试：输出抓取尝试信息（减少日志频率）
        // console.log(`[Main] 🔍 尝试抓取 - 光标位置: [x:${cursorSphere.position.x.toFixed(2)}, y:${cursorSphere.position.y.toFixed(2)}, z:${cursorSphere.position.z.toFixed(2)}], 可用组件数: ${availablePieces.length}`);
        
        availablePieces.forEach((piece) => {
          const dist = cursorSphere.position.distanceTo(piece.position);
          // console.log(`[Main]   组件 ${piece.userData.partID} 距离: ${dist.toFixed(2)}米, 位置: [x:${piece.position.x.toFixed(2)}, y:${piece.position.y.toFixed(2)}, z:${piece.position.z.toFixed(2)}]`);
          if (dist < 2.5 && dist < closestDist) { // ✅ 降低抓取阈值，更精确（从3.5改为2.5）
            closestDist = dist;
            closestPiece = piece;
          }
        });
        
        if (closestPiece) {
          grabbedObject = closestPiece;
          isGrabbing = true;
          console.log(`[Main] ✅ 抓取 ${closestPiece.userData.partID} 成功！距离: ${closestDist.toFixed(2)}米`);
        }
        // 移除未找到的日志，减少控制台噪音
      } else if (grabbedObject) {
        // ✅ 关键：一旦抓取，就锁定这个对象，直到松开（防止意外切换）
        // 移动被抓取的组件
        grabbedObject.position.copy(cursorSphere.position);
        
        // ✅ 每帧都检查吸附（确保能及时吸附）
        checkSnap(grabbedObject);
      }
    } else {
      // 松开
      if (isGrabbing && grabbedObject) {
        // ✅ 最终检查吸附（松开时也检查一次）
        const snapped = checkSnap(grabbedObject);
        if (!snapped) {
          // ✅ 减少日志输出，只在距离较近但未吸附时输出（帮助调试）
          const partID = grabbedObject.userData.partID;
          const target = TARGET_CONFIG[partID];
          if (target) {
            const dist = grabbedObject.position.distanceTo(target.position);
            // 只在距离较近但未吸附时输出
            if (dist < 3.0) {
              console.log(`[Main] 松开 ${partID}，距离目标: ${dist.toFixed(2)}米 (需要 < ${SNAP_DISTANCE}米)`);
            }
          }
        }
        grabbedObject = null;
        isGrabbing = false;
      }
    }
    
    // ✅ 移除：减少不必要的调试日志输出
  }

  // 渲染场景
  renderer.render(scene, camera);
}

// ===================== 启动 =====================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    init().then(() => {
      animate();
    }).catch(error => {
      console.error('[Main] ❌ 初始化失败:', error);
    });
  });
} else {
  init().then(() => {
animate();
  }).catch(error => {
    console.error('[Main] ❌ 初始化失败:', error);
  });
}
