/**
 * MVP 版本 - 手势控制验证场景
 * 
 * 场景：大斗.glb（基座）+ 蓝色球、黄色立方体、紫色柱子（拼装物品）+ 绿色小球（光标）
 * 交互：捏合手势抓取物品，移动到基座上方自动吸附
 */

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { HandInput } from "./core/HandInput.js";

// ===================== 场景设置 =====================
let scene, camera, renderer;
let baseModel = null; // ✅ 基座模型（大斗.glb）
let cursorSphere; // 绿色小球（光标）
let handInput;
let isGrabbing = false; // 是否正在抓取
let grabbedObject = null; // 当前抓取的对象（避免频繁切换）

// ✅ 新增：拼装物品（需要找到并吸附的物品）
let puzzlePieces = []; // 拼装物品数组：蓝色球、黄色立方体、紫色柱子
let snapSlots = []; // 吸附位置数组（基座上方，按顺序）

// ✅ 新增：平滑处理（让移动更流畅）
let smoothCursorX = 0;
let smoothCursorY = 0;
const cursorSmoothAlpha = 0.2; // 光标平滑系数

// ✅ 新增：吸附参数
const snapDistance = 0.5; // 吸附距离阈值

// ✅ 新增：音效
let audioSnap = null; // 拼接音效
let audioWin = null; // 成功音效

// ✅ 新增：模型加载器
const gltfLoader = new GLTFLoader();

// ===================== 初始化 =====================
function init() {
  // 创建场景
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a1a);

  // 创建相机
  camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  // ✅ 调整相机位置，确保能看到基座和所有物品
  camera.position.set(0, 2, 8);
  camera.lookAt(0, -0.5, 0); // 看向基座附近

  // 创建渲染器
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  
  // ✅ 修复：确保渲染器在UI层下方，不遮挡UI
  renderer.domElement.style.position = 'fixed';
  renderer.domElement.style.top = '0';
  renderer.domElement.style.left = '0';
  renderer.domElement.style.zIndex = '0';
  renderer.domElement.style.pointerEvents = 'none'; // 默认不拦截事件（主菜单显示时）
  
  document.body.appendChild(renderer.domElement);

  // 添加光照
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(5, 5, 5);
  scene.add(directionalLight);

  // ✅ 加载大斗.glb作为基座（替换红色立方体）
  console.log('[Main] 开始加载基座模型: /models/大斗.glb');
  console.log('[Main] GLTFLoader 状态:', gltfLoader ? '已初始化' : '未初始化');
  
  gltfLoader.load(
    '/models/大斗.glb',
    (gltf) => {
      console.log('[Main] GLB 文件加载成功，开始处理模型...');
      const model = gltf.scene;
      
      // 计算模型边界框，用于定位
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const min = box.min; // 模型底部Y坐标
      
      // 调整模型位置：固定在底部
      // 将模型的底部对齐到 baseY 位置
      const baseY = -1.5; // 基座底部Y位置
      // 计算需要移动的距离：baseY - min.y（将模型底部移动到baseY）
      model.position.set(0, baseY - min.y, 0);
      
      // 启用阴影
      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      
      baseModel = model;
      baseModel.userData.isBase = true; // 标记为基座
      baseModel.userData.baseY = baseY; // 保存基座底部Y位置
      baseModel.userData.baseHeight = size.y; // 保存基座高度
      scene.add(baseModel);
      
      // ✅ 根据实际模型高度更新吸附位置
      updateSnapSlots(baseY, size.y);
      
      console.log('[Main] ✅ 基座模型（大斗.glb）已加载');
      console.log('[Main] 模型尺寸:', size);
      console.log('[Main] 模型中心:', center);
      console.log('[Main] 模型底部(min.y):', min.y);
      console.log('[Main] 模型位置:', model.position);
      console.log('[Main] 基座底部Y:', baseY);
      console.log('[Main] 基座高度:', size.y);
    },
    (progress) => {
      // 加载进度回调
      if (progress.lengthComputable) {
        const percentComplete = (progress.loaded / progress.total) * 100;
        console.log(`[Main] 基座模型加载进度: ${percentComplete.toFixed(1)}%`);
      }
    },
    (error) => {
      console.error('[Main] ❌ 基座模型加载失败！');
      console.error('[Main] 错误详情:', error);
      console.error('[Main] 错误类型:', error?.type);
      console.error('[Main] 错误消息:', error?.message);
      console.error('[Main] 错误URL:', error?.url || '/models/大斗.glb');
      console.warn('[Main] ⚠️ 使用红色立方体作为备用方案');
      // 备用方案：使用红色立方体
      const baseGeometry = new THREE.BoxGeometry(0.6, 0.3, 0.6);
      const baseMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
      baseModel = new THREE.Mesh(baseGeometry, baseMaterial);
      const baseY = -1.5;
      const baseHeight = 0.3;
      baseModel.position.set(0, baseY, 0);
      baseModel.userData.isBase = true;
      baseModel.userData.baseY = baseY;
      baseModel.userData.baseHeight = baseHeight;
      scene.add(baseModel);
      
      // ✅ 更新吸附位置（使用备用立方体的尺寸）
      updateSnapSlots(baseY, baseHeight);
    }
  );

  // 创建绿色小球（光标）
  const sphereGeometry = new THREE.SphereGeometry(0.1, 16, 16);
  const sphereMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
  cursorSphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
  cursorSphere.position.set(0, 0, 0);
  scene.add(cursorSphere);

  // ✅ 创建拼装物品（集中放置在一起，便于拾取）
  // 1. 蓝色球（最底层，放在基座上方）
  const blueSphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0x0088ff })
  );
  blueSphere.position.set(1.5, 0, 0); // ✅ 集中放置，便于拾取
  blueSphere.userData.pieceId = 'blue-sphere';
  blueSphere.userData.originalColor = 0x0088ff;
  blueSphere.userData.isSnapped = false;
  scene.add(blueSphere);
  puzzlePieces.push(blueSphere);

  // 2. 黄色立方体（中间层）
  const yellowCube = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.35, 0.35),
    new THREE.MeshStandardMaterial({ color: 0xffff00 })
  );
  yellowCube.position.set(1.5, 0.5, 0); // ✅ 集中放置，在蓝色球上方
  yellowCube.userData.pieceId = 'yellow-cube';
  yellowCube.userData.originalColor = 0xffff00;
  yellowCube.userData.isSnapped = false;
  scene.add(yellowCube);
  puzzlePieces.push(yellowCube);

  // 3. 紫色柱子（最顶层）
  const purpleCylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.15, 0.5, 16),
    new THREE.MeshStandardMaterial({ color: 0xaa00ff })
  );
  purpleCylinder.position.set(1.5, 1.0, 0); // ✅ 集中放置，在黄色立方体上方
  purpleCylinder.userData.pieceId = 'purple-cylinder';
  purpleCylinder.userData.originalColor = 0xaa00ff;
  purpleCylinder.userData.isSnapped = false;
  scene.add(purpleCylinder);
  puzzlePieces.push(purpleCylinder);

  // ✅ 创建吸附位置（基座上方，按顺序：蓝球、黄立方体、紫柱子）
  // 注意：如果基座模型加载成功，吸附位置会在模型加载完成后更新
  // 这里先使用默认值（红色立方体的尺寸），模型加载后会覆盖
  const defaultBaseY = -1.5; // 默认基座Y位置
  const defaultBaseHeight = 0.3; // 默认基座高度
  updateSnapSlots(defaultBaseY, defaultBaseHeight);

  // 初始化手势输入
  handInput = new HandInput();

  // 启动摄像头（自动启动）
  handInput.start().catch((error) => {
    console.error('[Main] 摄像头启动失败:', error);
    // 即使摄像头启动失败，也继续运行（可以使用鼠标测试）
  });

  // ✅ 新增：初始化音效
  try {
    audioSnap = new Audio('/snap.mp3');
    audioSnap.volume = 0.6; // 设置音量
    audioWin = new Audio('/win (2).mp3');
    audioWin.volume = 0.7; // 设置音量
    console.log('[Main] ✅ 音效已加载');
  } catch (error) {
    console.warn('[Main] ⚠️ 音效加载失败:', error);
  }

  // 窗口大小调整
  window.addEventListener('resize', onWindowResize);

  // ✅ 修复：绑定UI按钮事件
  setupUIEvents();

  console.log('[Main] ✅ MVP 场景初始化完成');
  console.log('[Main] 提示：捏合手势（食指+拇指）可以抓取物品，移动到基座上方自动吸附');
}

// ===================== 更新吸附位置 =====================
function updateSnapSlots(baseY, baseHeight) {
  // 清空现有吸附位置
  snapSlots.length = 0;
  
  const pieceSpacing = 0.4; // 物品间距
  
  // 吸附位置1：蓝色球（基座上方）
  snapSlots.push({
    position: new THREE.Vector3(0, baseY + baseHeight / 2 + 0.2, 0),
    pieceId: 'blue-sphere',
    isOccupied: false
  });
  
  // 吸附位置2：黄色立方体（蓝色球上方）
  snapSlots.push({
    position: new THREE.Vector3(0, baseY + baseHeight / 2 + 0.2 + pieceSpacing, 0),
    pieceId: 'yellow-cube',
    isOccupied: false
  });
  
  // 吸附位置3：紫色柱子（黄色立方体上方）
  snapSlots.push({
    position: new THREE.Vector3(0, baseY + baseHeight / 2 + 0.2 + pieceSpacing * 2, 0),
    pieceId: 'purple-cylinder',
    isOccupied: false
  });
  
  console.log('[Main] ✅ 吸附位置已更新，基座Y:', baseY, '高度:', baseHeight);
}

// ===================== UI 事件绑定 =====================
function setupUIEvents() {
  // 等待DOM完全加载
  const bindEvents = () => {
    const btnStart = document.getElementById('btn-start');
    const btnCollection = document.getElementById('btn-collection');
    const btnLogin = document.getElementById('btn-login');
    const btnSettings = document.getElementById('btn-settings');
    const pageMenu = document.getElementById('page-menu');
    const gameHud = document.getElementById('page-game-hud');

    console.log('[Main] UI按钮查找结果:', {
      btnStart: !!btnStart,
      btnCollection: !!btnCollection,
      btnLogin: !!btnLogin,
      btnSettings: !!btnSettings,
      pageMenu: !!pageMenu,
      gameHud: !!gameHud,
    });

    // ✅ 修复：开始筑梦按钮（使用多种方式确保能触发）
    if (btnStart) {
      const handleStartClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('[Main] ✅ 开始筑梦按钮被点击');
        
        // 隐藏主菜单
        if (pageMenu) {
          pageMenu.classList.add('hidden');
        }
        
        // 显示游戏HUD
        if (gameHud) {
          gameHud.style.display = 'flex';
        }
        
        // 允许渲染器接收事件（游戏进行时）
        if (renderer) {
          renderer.domElement.style.pointerEvents = 'auto';
        }
        
        return false;
      };
      
      // 使用多种方式绑定
      btnStart.addEventListener('click', handleStartClick, true); // 捕获阶段
      btnStart.addEventListener('click', handleStartClick, false); // 冒泡阶段
      btnStart.onclick = handleStartClick; // 直接设置onclick
      
      // 测试悬停
      btnStart.addEventListener('mouseenter', () => {
        console.log('[Main] 鼠标进入开始筑梦按钮');
        btnStart.style.opacity = '0.9';
      });
      btnStart.addEventListener('mouseleave', () => {
        btnStart.style.opacity = '1';
      });
      
      console.log('[Main] ✅ 开始筑梦按钮事件已绑定（多种方式）');
    } else {
      console.error('[Main] ❌ 未找到 btn-start 按钮！');
      // 延迟重试
      setTimeout(() => {
        const retryBtn = document.getElementById('btn-start');
        if (retryBtn) {
          retryBtn.onclick = () => {
            console.log('[Main] ✅ 开始筑梦按钮被点击（延迟绑定）');
            const pageMenu = document.getElementById('page-menu');
            const gameHud = document.getElementById('page-game-hud');
            if (pageMenu) pageMenu.classList.add('hidden');
            if (gameHud) gameHud.style.display = 'flex';
            if (renderer) renderer.domElement.style.pointerEvents = 'auto';
          };
          console.log('[Main] ✅ 开始筑梦按钮事件已绑定（延迟重试成功）');
        }
      }, 500);
    }

    // ✅ 修复：我的藏阁按钮（使用多种方式）
    if (btnCollection) {
      const handleCollectionClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('[Main] ✅ 我的藏阁按钮被点击');
        alert('我的藏阁功能（MVP版本暂未实现）');
        return false;
      };
      btnCollection.addEventListener('click', handleCollectionClick, true);
      btnCollection.addEventListener('click', handleCollectionClick, false);
      btnCollection.onclick = handleCollectionClick;
    }

    // ✅ 修复：登录/注册按钮（使用多种方式）
    if (btnLogin) {
      const handleLoginClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('[Main] ✅ 登录/注册按钮被点击');
        alert('登录/注册功能（MVP版本暂未实现）');
        return false;
      };
      btnLogin.addEventListener('click', handleLoginClick, true);
      btnLogin.addEventListener('click', handleLoginClick, false);
      btnLogin.onclick = handleLoginClick;
    }

    // ✅ 修复：秘境设置按钮（使用多种方式）
    if (btnSettings) {
      const handleSettingsClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('[Main] ✅ 秘境设置按钮被点击');
        alert('秘境设置功能（MVP版本暂未实现）');
        return false;
      };
      btnSettings.addEventListener('click', handleSettingsClick, true);
      btnSettings.addEventListener('click', handleSettingsClick, false);
      btnSettings.onclick = handleSettingsClick;
    }

    // 游戏HUD的返回按钮
    const btnHome = document.getElementById('btn-home');
    if (btnHome) {
      btnHome.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('[Main] ✅ 返回主页按钮被点击');
        
        // 显示主菜单
        if (pageMenu) {
          pageMenu.classList.remove('hidden');
        }
        
        // 隐藏游戏HUD
        if (gameHud) {
          gameHud.style.display = 'none';
        }
        
        // 禁止渲染器接收事件（主菜单显示时）
        if (renderer) {
          renderer.domElement.style.pointerEvents = 'none';
        }
      });
      console.log('[Main] ✅ 返回主页按钮事件已绑定');
    }
  };

  // 确保DOM完全加载
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindEvents);
  } else {
    // 延迟一点确保所有元素都已渲染
    setTimeout(bindEvents, 100);
  }
}

// ===================== 自动吸附逻辑 =====================
/**
 * 检查物品是否靠近吸附位置，如果靠近则自动吸附
 */
function checkAutoSnap(piece) {
  if (piece.userData.isSnapped) return; // 已经吸附，跳过
  
  // 找到对应的吸附位置
  const slot = snapSlots.find(s => s.pieceId === piece.userData.pieceId && !s.isOccupied);
  if (!slot) return; // 没有对应的吸附位置或已被占用
  
  // 计算距离（只考虑XZ平面，Y轴允许一定误差）
  const dx = piece.position.x - slot.position.x;
  const dz = piece.position.z - slot.position.z;
  const horizontalDist = Math.sqrt(dx * dx + dz * dz);
  const verticalDist = Math.abs(piece.position.y - slot.position.y);
  
  // 如果水平距离和垂直距离都小于阈值，则吸附
  if (horizontalDist < snapDistance && verticalDist < snapDistance) {
    piece.userData.isSnapped = true;
    piece.userData.snapSlot = slot;
    slot.isOccupied = true;
    
    // 立即移动到吸附位置
    piece.position.copy(slot.position);
    piece.material.color.setHex(0x00ff00); // 变绿色表示已吸附
    
    console.log(`[Main] ✅ ${piece.userData.pieceId} 已吸附到基座上方！`);
    
    // ✅ 播放拼接音效
    if (audioSnap) {
      try {
        audioSnap.currentTime = 0; // 重置到开头
        audioSnap.play().catch(e => console.debug('[Main] 音效播放失败:', e));
      } catch (e) {
        console.debug('[Main] 音效播放错误:', e);
      }
    }
    
    // 检查是否所有物品都已吸附
    const allSnapped = puzzlePieces.every(p => p.userData.isSnapped);
    if (allSnapped) {
      console.log('[Main] 🎉 恭喜！所有物品都已拼装完成！');
      
      // ✅ 播放成功音效
      if (audioWin) {
        try {
          audioWin.currentTime = 0; // 重置到开头
          audioWin.play().catch(e => console.debug('[Main] 成功音效播放失败:', e));
        } catch (e) {
          console.debug('[Main] 成功音效播放错误:', e);
        }
      }
    }
  }
}

// ===================== 窗口大小调整 =====================
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// ===================== 渲染循环 =====================
function animate() {
  requestAnimationFrame(animate);

  // 获取手势数据
  if (handInput && handInput.isConnected()) {
    const gesture = handInput.getGesture();
    
    // ✅ 修复：映射手势坐标到 3D 空间（z=0 平面）
    // MediaPipe 返回的坐标是归一化的 (0-1)，需要转换为 NDC (-1 到 1)
    // ✅ 修复X轴方向：摄像头镜像导致左右相反，需要翻转X轴
    const ndcX = -(gesture.x * 2 - 1);  // x: 0-1 -> -1 到 1，然后取反（翻转左右）
    // ✅ 修复Y轴方向：MediaPipe的Y轴是从上到下(0-1)，Three.js的Y轴是从下到上
    // 手向上移动(y减小) -> 小球应该向上移动(y增大)，所以需要翻转
    const ndcY = 1 - gesture.y * 2;  // y: 0-1 -> 1 到 -1（Y轴翻转，手向上=小球向上）
    
    // ✅ 修复：扩大视野范围，让边缘对象更容易交互
    const viewSize = 8; // 视野大小（单位）- 从4增加到8，扩大交互范围
    const targetWorldX = (ndcX * viewSize) / 2;
    const targetWorldY = (ndcY * viewSize) / 2;
    
    // ✅ 修复：添加平滑处理，让移动更流畅（捏合时减少平滑，响应更快）
    const smoothAlpha = gesture.isPinching ? 0.3 : cursorSmoothAlpha; // 捏合时响应更快
    smoothCursorX += (targetWorldX - smoothCursorX) * smoothAlpha;
    smoothCursorY += (targetWorldY - smoothCursorY) * smoothAlpha;
    
    // 更新绿色小球位置
    cursorSphere.position.x = smoothCursorX;
    cursorSphere.position.y = smoothCursorY;
    cursorSphere.position.z = 0;
    
    // ✅ 修复：检查是否捏合（抓取拼装物品）
    if (gesture.isPinching) {
      const grabThreshold = 0.4; // 抓取阈值
      const releaseThreshold = 0.6; // 释放阈值
      
      // 如果已经抓取了对象，检查是否还在范围内
      if (grabbedObject) {
        const dist = cursorSphere.position.distanceTo(grabbedObject.position);
        if (dist < releaseThreshold && !grabbedObject.userData.isSnapped) {
          // 还在范围内且未吸附，继续跟随
          grabbedObject.position.x = cursorSphere.position.x;
          grabbedObject.position.y = cursorSphere.position.y;
          grabbedObject.position.z = cursorSphere.position.z;
          
          // ✅ 检查是否靠近吸附位置（自动吸附逻辑）
          checkAutoSnap(grabbedObject);
        } else {
          // 超出范围或已吸附，释放
          if (!grabbedObject.userData.isSnapped) {
            grabbedObject.material.color.setHex(grabbedObject.userData.originalColor);
          }
          grabbedObject = null;
          isGrabbing = false;
        }
      } else {
        // 没有抓取对象，寻找最近的拼装物品（排除已吸附的）
        const availablePieces = puzzlePieces.filter(p => !p.userData.isSnapped);
        let closestPiece = null;
        let closestDist = Infinity;
        
        availablePieces.forEach((piece) => {
          const dist = cursorSphere.position.distanceTo(piece.position);
          if (dist < grabThreshold && dist < closestDist) {
            closestDist = dist;
            closestPiece = piece;
          }
        });
        
        // 如果找到最近的物品，抓取它
        if (closestPiece) {
          grabbedObject = closestPiece;
          isGrabbing = true;
          closestPiece.material.color.setHex(0xffffff); // 高亮显示（变白色）
          console.log(`[Main] ✅ 抓取 ${closestPiece.userData.pieceId} 成功！`);
        }
      }
    } else {
      // ✅ 修复：松开手，恢复颜色（如果未吸附）
      if (isGrabbing && grabbedObject && !grabbedObject.userData.isSnapped) {
        grabbedObject.material.color.setHex(grabbedObject.userData.originalColor);
        grabbedObject = null;
        isGrabbing = false;
        console.log('[Main] 松开对象');
      }
    }
    
    // ✅ 新增：更新已吸附物品的位置（平滑吸附动画）
    puzzlePieces.forEach((piece) => {
      if (piece.userData.isSnapped && piece.userData.snapSlot) {
        const slot = piece.userData.snapSlot;
        // 平滑移动到吸附位置
        piece.position.lerp(slot.position, 0.15);
      }
    });
  }

  // 渲染场景
  renderer.render(scene, camera);
}

// ===================== 启动 =====================
// 确保DOM完全加载
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    init();
    animate();
  });
} else {
init();
animate();
}
