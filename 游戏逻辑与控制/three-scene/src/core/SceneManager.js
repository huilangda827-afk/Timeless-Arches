import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.module.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/**
 * SceneManager - Three.js 场景管理模块
 * 职责：场景初始化、相机控制、光照设置、地面渲染
 */
export class SceneManager {
  constructor(config = {}) {
    // 配置参数
    this.dragPlaneY = config.dragPlaneY ?? 0.0;
    this.pieceHoverY = config.pieceHoverY ?? 0.5;
    this.backgroundColor = config.backgroundColor ?? 0x202020;
    
    // Three.js 核心对象
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    
    // 场景对象
    this.ground = null;
    this.pieces = [];
    this.slots = [];
    this.base = null; // 基座（大斗-底层）
    
    // 模型加载器
    this.gltfLoader = new GLTFLoader();
  }

  /**
   * 初始化场景
   */
  init() {
    // 创建场景
    this.scene = new THREE.Scene();
    
    // ✅ 加载游戏场景背景纹理（照片级融合）
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(
      '/background-game.jpg',
      (texture) => {
        // 设置正确的颜色空间，防止颜色泛白
        texture.colorSpace = THREE.SRGBColorSpace;
        this.scene.background = texture;
        console.log('[SceneManager] 游戏场景背景图已加载');
        
        // 基于背景图创建暗色调 Fog（雾），让远处物体自然隐入背景
        const fogColor = new THREE.Color(0x1a1a1a); // 暗色调
        this.scene.fog = new THREE.Fog(fogColor, 10, 50);
        this.scene.fog.density = 0.02;
      },
      undefined,
      (error) => {
        // 加载失败，使用备用纯色背景
        console.warn('[SceneManager] 游戏场景背景图加载失败，使用纯色背景:', error);
        this.scene.background = new THREE.Color(this.backgroundColor);
        // 即使没有背景图，也添加 Fog
        const fogColor = new THREE.Color(this.backgroundColor);
        this.scene.fog = new THREE.Fog(fogColor, 10, 50);
        this.scene.fog.density = 0.02;
      }
    );

    // 创建相机
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    // ✅ 修复布局：调整相机位置，确保模型在视野中心
    this.camera.position.set(6, 7, 12);
    this.camera.lookAt(0, 1.5, 0); // 看向模型中心（稍微抬高）

    // 创建渲染器
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    // ✅ 启用阴影渲染
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // 使用软阴影
    
    // ✅ 修复：不清空 body，只添加渲染器（确保 UI 层不被删除）
    // 设置渲染器样式，确保在 UI 层下方
    this.renderer.domElement.style.position = "fixed";
    this.renderer.domElement.style.top = "0";
    this.renderer.domElement.style.left = "0";
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.renderer.domElement.style.zIndex = "0"; // 确保在 UI 层（z-index: 1000）下方
    // ✅ 修复 UI 交互：默认不拦截事件（主菜单显示时）
    this.renderer.domElement.style.pointerEvents = "none";
    
    // 只在渲染器不存在时添加（避免重复添加）
    if (!document.body.contains(this.renderer.domElement)) {
      document.body.insertBefore(this.renderer.domElement, document.body.firstChild);
    }

    // 创建轨道控制器
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;

    // 设置光照
    this.setupLights();

    // 创建 Shadow Catcher（阴影捕获器）
    this.createShadowCatcher();

    // 创建地面（保留原有地面，但可能被 Shadow Catcher 替代）
    this.createGround();

    // 绑定窗口大小调整事件
    window.addEventListener("resize", () => this.onResize());

    console.log("[SceneManager] 场景初始化完成");
  }

  /**
   * 加载关卡配置的模型
   * @param {Object} levelConfig - 关卡配置对象
   */
  async loadLevelModels(levelConfig) {
    console.log("[SceneManager] 开始加载关卡模型...");
    
    // 1. 加载基座（大斗-底层）
    if (levelConfig.base) {
      await this.loadBaseModel(levelConfig.base);
    }
    
    // 2. 创建槽位（根据构件配置）
    if (levelConfig.pieces && levelConfig.pieces.length > 0) {
      this.createSlotsFromConfig(levelConfig.pieces);
    }
    
    // 3. 加载构件
    if (levelConfig.pieces && levelConfig.pieces.length > 0) {
      await this.loadPieceModels(levelConfig.pieces);
    }
    
    console.log("[SceneManager] 关卡模型加载完成");

    // 调试：打印加载后 pieces/slots 统计
    try {
      console.log(`[SceneManager] pieces=${this.pieces.length} slots=${this.slots.length} base=${this.base ? 'yes' : 'no'}`);
    } catch (e) {}
  }

  /**
   * ✅ 修复模型交互：根据配置创建槽位
   * @param {Array} piecesConfig - 构件配置数组
   */
  createSlotsFromConfig(piecesConfig) {
    // 清空现有槽位
    this.slots.forEach(slot => this.scene.remove(slot));
    this.slots = [];
    
    piecesConfig.forEach((pieceConfig) => {
      // 创建槽位几何体（半透明盒子，用于显示目标位置）
      // 槽位适当放大以匹配构件放大比例
      const SLOT_SCALE = 1.6;
      const slotGeo = new THREE.BoxGeometry(1 * SLOT_SCALE, 0.35 * SLOT_SCALE, 1 * SLOT_SCALE);
      const slotMat = new THREE.MeshStandardMaterial({
        color: 0x777777,
        transparent: true,
        opacity: 0.45,
      });
      
      const slot = new THREE.Mesh(slotGeo, slotMat);
      
      // 设置槽位位置和旋转（使用目标位置）
      if (pieceConfig.targetPosition) {
        slot.position.copy(pieceConfig.targetPosition);
        slot.position.y = this.dragPlaneY + 0.18 * SLOT_SCALE; // 稍微抬高
      }
      if (pieceConfig.targetRotation) {
        slot.rotation.set(
          pieceConfig.targetRotation.x,
          pieceConfig.targetRotation.y,
          pieceConfig.targetRotation.z
        );
      }
      
      // 保存槽位数据
      slot.userData = {
        slotId: pieceConfig.slotId,
        pieceId: pieceConfig.pieceId,
      };
      
      // 启用阴影接收
      slot.receiveShadow = true;
      
      this.slots.push(slot);
      this.scene.add(slot);
      
      console.log(`[SceneManager] ✅ 槽位已创建 [${pieceConfig.slotId}]: ${pieceConfig.displayName}`);
    });
    
    console.log(`[SceneManager] ✅ 共创建 ${this.slots.length} 个槽位`);
  }

  /**
   * 计算模型边界框并自动调整尺寸
   * @param {THREE.Object3D} model - 模型对象
   * @param {number} targetSize - 目标尺寸（默认1.0）
   * @returns {THREE.Box3} 边界框
   */
  adjustModelSize(model, targetSize = 1.0) {
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const maxDimension = Math.max(size.x, size.y, size.z);
    
    // 如果模型太大或太小，自动缩放
    if (maxDimension > 0.01 && maxDimension !== targetSize) {
      const scale = targetSize / maxDimension;
      model.scale.multiplyScalar(scale);
      console.log(`[SceneManager] 模型已自动缩放: ${maxDimension.toFixed(3)} → ${targetSize.toFixed(3)} (scale: ${scale.toFixed(3)})`);
    }
    
    // 重新计算边界框
    box.setFromObject(model);
    return box;
  }

  /**
   * 加载基座模型（大斗-底层）
   * @param {Object} baseConfig - 基座配置
   */
  async loadBaseModel(baseConfig) {
    return new Promise((resolve, reject) => {
      const modelPath = `/models/${baseConfig.modelPath}`;
      console.log(`[SceneManager] 加载基座模型: ${modelPath}`);
      
      this.gltfLoader.load(
        modelPath,
        (gltf) => {
          const model = gltf.scene;
          
          // ✅ 修复布局：自动调整模型尺寸（基座应该稍大一些）
          this.adjustModelSize(model, 1.2);
          
          // 设置位置和旋转
          if (baseConfig.targetPosition) {
            model.position.copy(baseConfig.targetPosition);
          }
          if (baseConfig.targetRotation) {
            model.rotation.set(
              baseConfig.targetRotation.x,
              baseConfig.targetRotation.y,
              baseConfig.targetRotation.z
            );
          }
          
          // 启用阴影
          model.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
          
          // 保存基座引用
          this.base = model;
          model.userData = {
            type: "base",
            displayName: baseConfig.displayName || "基座",
            isInteractive: false,
          };
          
          this.scene.add(model);
          console.log(`[SceneManager] ✅ 基座模型已加载: ${baseConfig.displayName}`);
          resolve(model);
        },
        (progress) => {
          // 加载进度
          if (progress.lengthComputable) {
            const percentComplete = (progress.loaded / progress.total) * 100;
            console.log(`[SceneManager] 基座模型加载进度: ${percentComplete.toFixed(1)}%`);
          }
        },
        (error) => {
          console.error(`[SceneManager] ❌ 基座模型加载失败: ${modelPath}`, error);
          console.error(`[SceneManager] 请检查文件是否存在: public/models/${baseConfig.modelPath}`);
          reject(error);
        }
      );
    });
  }

  /**
   * 加载构件模型
   * @param {Array} piecesConfig - 构件配置数组
   */
  async loadPieceModels(piecesConfig) {
    const loadPromises = piecesConfig.map((pieceConfig, index) => {
      return new Promise((resolve, reject) => {
        const modelPath = `/models/${pieceConfig.modelPath}`;
        console.log(`[SceneManager] 加载构件模型 [${index}]: ${modelPath}`);
        
        this.gltfLoader.load(
          modelPath,
          (gltf) => {
            const model = gltf.scene;
            
            // ✅ 修复布局：自动调整模型尺寸（构件统一尺寸），并放大以增强视觉效果
            // 先计算边界框，确保模型可见
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const maxDimension = Math.max(size.x, size.y, size.z);
            
            // 如果模型太小或太大，进行缩放
            if (maxDimension > 0.01) {
              const targetSize = 1.6; // 放大视觉效果
              if (Math.abs(maxDimension - targetSize) > 0.05) {
                const scale = targetSize / maxDimension;
                model.scale.multiplyScalar(scale);
                console.log(`[SceneManager] 构件 [${index}] 已缩放: ${maxDimension.toFixed(3)} → ${targetSize.toFixed(3)}`);
              }
            }
            
            // 设置初始位置（散落状态）
            if (pieceConfig.startPosition) {
              model.position.copy(pieceConfig.startPosition);
              // 抬高至拖拽平面上方，避免与地面重叠
              model.position.y = this.dragPlaneY + this.pieceHoverY;
            } else if (pieceConfig.targetPosition) {
              // 如果没有初始位置，使用目标位置并抬高为可抓取状态
              model.position.copy(pieceConfig.targetPosition);
              model.position.y = this.dragPlaneY + this.pieceHoverY;
            }
            
            // 设置旋转
            if (pieceConfig.targetRotation) {
              model.rotation.set(
                pieceConfig.targetRotation.x,
                pieceConfig.targetRotation.y,
                pieceConfig.targetRotation.z
              );
            }
            
            // ✅ 修复3D组件清晰度：添加亮色材质（斗拱相关的朱红色/金色）
            // 斗拱传统颜色：朱红色(#c83c23)、金色(#d4af37)、木色(#8b4513)、深红(#a02020)
            const colors = [0xc83c23, 0xd4af37, 0x8b4513, 0xa02020]; // 朱红、金色、木色、深红
            const colorIndex = pieceConfig.pieceId % colors.length;
            const pieceColor = colors[colorIndex];
            
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/aa6999dc-f03f-450f-a3b9-6dcf420c0b8f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SceneManager.js:281',message:'material setup start',data:{pieceId:pieceConfig.pieceId,pieceColor:pieceColor.toString(16),modelPath:pieceConfig.modelPath},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
            // #endregion
            
            let meshCount = 0;
            let materialSetCount = 0;
            
            // 启用阴影并设置亮色材质
            model.traverse((child) => {
              if (child.isMesh) {
                meshCount++;
                child.castShadow = true;
                child.receiveShadow = true;
                
                // ✅ 设置亮色材质以提高可见度（处理单个材质或数组材质）
                if (child.material) {
                  const materials = Array.isArray(child.material) ? child.material : [child.material];
                  const newMaterials = materials.map((mat) => {
                    if (mat instanceof THREE.MeshStandardMaterial) {
                      mat.color.setHex(pieceColor);
                      mat.emissive.setHex(0x331100); // 轻微的发光（朱红色调）
                      mat.emissiveIntensity = 0.15;
                      mat.roughness = 0.6;
                      mat.metalness = 0.2;
                      return mat;
                    } else {
                      // 如果材质不支持这些属性，创建新材质
                      return new THREE.MeshStandardMaterial({
                        color: pieceColor,
                        emissive: 0x331100,
                        emissiveIntensity: 0.15,
                        roughness: 0.6,
                        metalness: 0.2,
                      });
                    }
                  });
                  
                  child.material = Array.isArray(child.material) ? newMaterials : newMaterials[0];
                  materialSetCount++;
                } else {
                  // 如果没有材质，创建新材质
                  child.material = new THREE.MeshStandardMaterial({
                    color: pieceColor,
                    emissive: 0x331100,
                    emissiveIntensity: 0.15,
                    roughness: 0.6,
                    metalness: 0.2,
                  });
                  materialSetCount++;
                }
              }
            });
            
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/aa6999dc-f03f-450f-a3b9-6dcf420c0b8f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SceneManager.js:325',message:'material setup complete',data:{pieceId:pieceConfig.pieceId,meshCount,materialSetCount,pieceColor:pieceColor.toString(16)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
            // #endregion
            
            // 保存用户数据（在根对象和所有子对象上设置，确保raycaster能检测到）
            const userData = {
              type: "piece",
              pieceId: pieceConfig.pieceId,
              slotId: pieceConfig.slotId,
              displayName: pieceConfig.displayName || `构件${pieceConfig.pieceId}`,
              isInteractive: pieceConfig.isInteractive !== false,
              snapped: false,
              targetPosition: pieceConfig.targetPosition,
              targetRotation: pieceConfig.targetRotation,
              originalPosition: model.position.clone(),
            };
            
            // ✅ 修复模型交互：在根对象和所有子对象上设置userData
            model.userData = userData;
            model.traverse((child) => {
              if (child.isMesh || child.isGroup) {
                child.userData = { ...userData };
              }
            });
            
            this.pieces.push(model);
            this.scene.add(model);
            console.log(`[SceneManager] ✅ 构件模型已加载 [${index}]: ${pieceConfig.displayName}`);
            resolve(model);
          },
          (progress) => {
            // 加载进度
            if (progress.lengthComputable) {
              const percentComplete = (progress.loaded / progress.total) * 100;
              console.log(`[SceneManager] 构件模型 [${index}] 加载进度: ${percentComplete.toFixed(1)}%`);
            }
          },
          (error) => {
            console.error(`[SceneManager] ❌ 构件模型加载失败 [${index}]: ${modelPath}`, error);
            console.error(`[SceneManager] 请检查文件是否存在: public/models/${pieceConfig.modelPath}`);
            reject(error);
          }
        );
      });
    });
    
    await Promise.all(loadPromises);
  }

  /**
   * 设置光照（匹配背景图片的光源）
   */
  setupLights() {
    // ✅ Main Light: 顶光 SpotLight（匹配图片中的顶光效果）
    const spotLight = new THREE.SpotLight(0xffffff, 2.0);
    spotLight.position.set(0, 15, 0); // 正上方
    spotLight.angle = Math.PI / 4; // 45度锥角
    spotLight.penumbra = 0.3; // 边缘柔化
    spotLight.decay = 2; // 衰减
    spotLight.distance = 50;
    
    // 启用阴影
    spotLight.castShadow = true;
    spotLight.shadow.mapSize.width = 2048;
    spotLight.shadow.mapSize.height = 2048;
    spotLight.shadow.camera.near = 0.5;
    spotLight.shadow.camera.far = 50;
    spotLight.shadow.bias = -0.0001; // 减少阴影失真
    
    this.scene.add(spotLight);

    // ✅ Fill Light: 微弱的环境光，防止背光面死黑
    const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    this.scene.add(ambientLight);

    // ✅ Rim Light: 边缘光（在模型侧后方），勾勒轮廓
    const rimLight = new THREE.PointLight(0x4a5a6a, 1.0);
    rimLight.position.set(0, 5, -5);
    rimLight.distance = 20;
    rimLight.decay = 2;
    this.scene.add(rimLight);
  }

  /**
   * 创建 Shadow Catcher（阴影捕获器）
   * 关键：让 3D 模型的阴影投射到背景图片的地面上
   */
  createShadowCatcher() {
    // 在 y = -1.0 位置创建巨大的平面（根据模型底部位置调整）
    const shadowCatcherGeo = new THREE.PlaneGeometry(20, 20);
    const shadowCatcherMat = new THREE.ShadowMaterial({
      opacity: 0.6, // 背景较暗，影子需要深一点才看得见
      color: 0x000000,
    });
    
    const shadowCatcher = new THREE.Mesh(shadowCatcherGeo, shadowCatcherMat);
    shadowCatcher.rotation.x = -Math.PI / 2; // 放平
    shadowCatcher.position.y = -1.0; // 根据模型底部位置调整
    shadowCatcher.receiveShadow = true; // 接收阴影
    
    this.scene.add(shadowCatcher);
    this.shadowCatcher = shadowCatcher; // 保存引用，方便后续调整
    
    console.log('[SceneManager] Shadow Catcher 已创建');
  }

  /**
   * 创建地面（保留原有地面，用于拖拽平面）
   */
  createGround() {
    const groundGeo = new THREE.PlaneGeometry(30, 30);
    const groundMat = new THREE.MeshStandardMaterial({ 
      color: 0x2a2a2a,
      transparent: true,
      opacity: 0.3, // 降低不透明度，让 Shadow Catcher 更明显
    });
    this.ground = new THREE.Mesh(groundGeo, groundMat);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = this.dragPlaneY;
    this.ground.receiveShadow = true; // 也接收阴影
    this.scene.add(this.ground);
  }

  /**
   * 创建拼图（槽位 + 构件）
   */
  createPuzzle() {
    // 创建槽位
    const SLOT_SCALE = 1.6;
    const slotGeo = new THREE.BoxGeometry(1 * SLOT_SCALE, 0.35 * SLOT_SCALE, 1 * SLOT_SCALE);
    const slotMatBase = new THREE.MeshStandardMaterial({
      color: 0x777777,
      transparent: true,
      opacity: 0.45,
    });

    const slotPositions = [
      new THREE.Vector3(-3, this.dragPlaneY + 0.18 * SLOT_SCALE, 0),
      new THREE.Vector3(0, this.dragPlaneY + 0.18 * SLOT_SCALE, 0),
      new THREE.Vector3(3, this.dragPlaneY + 0.18 * SLOT_SCALE, 0),
    ];
    const slotRot = [0, Math.PI / 4, -Math.PI / 4];

    slotPositions.forEach((pos, i) => {
      const slot = new THREE.Mesh(slotGeo, slotMatBase.clone());
      slot.position.copy(pos);
      slot.rotation.y = slotRot[i];
      slot.userData.slotId = i;
      
      // ✅ 槽位也接收阴影
      slot.receiveShadow = true;
      
      this.slots.push(slot);
      this.scene.add(slot);
    });

    // 创建构件
    const PIECE_SCALE = 1.6;
    const pieceGeo = new THREE.BoxGeometry(1 * PIECE_SCALE, 1 * PIECE_SCALE, 1 * PIECE_SCALE);
    const colors = [0xff6666, 0x66ff66, 0x6666ff];
    const startPositions = [
      new THREE.Vector3(-4, this.dragPlaneY + this.pieceHoverY, -3),
      new THREE.Vector3(0, this.dragPlaneY + this.pieceHoverY, -3),
      new THREE.Vector3(4, this.dragPlaneY + this.pieceHoverY, -3),
    ];

    startPositions.forEach((pos, i) => {
      const mat = new THREE.MeshStandardMaterial({ color: colors[i] });
      mat.emissive = new THREE.Color(0x000000); // 用于高亮
      const piece = new THREE.Mesh(pieceGeo, mat);
      piece.position.copy(pos);
      piece.userData = { pieceId: i, slotId: i, snapped: false };
      
      // ✅ 启用阴影投射和接收
      piece.castShadow = true;
      piece.receiveShadow = true;
      
      this.pieces.push(piece);
      this.scene.add(piece);
    });
  }

  /**
   * 窗口大小调整处理
   */
  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  /**
   * 获取场景对象
   */
  getScene() {
    return this.scene;
  }

  /**
   * 获取相机对象
   */
  getCamera() {
    return this.camera;
  }

  /**
   * 获取渲染器对象
   */
  getRenderer() {
    return this.renderer;
  }

  /**
   * 获取控制器对象
   */
  getControls() {
    return this.controls;
  }

  /**
   * 获取构件数组
   */
  getPieces() {
    return this.pieces;
  }

  /**
   * 获取槽位数组
   */
  getSlots() {
    return this.slots;
  }

  /**
   * 获取拖拽平面高度
   */
  getDragPlaneY() {
    return this.dragPlaneY;
  }

  /**
   * 获取构件悬停高度
   */
  getPieceHoverY() {
    return this.pieceHoverY;
  }

  /**
   * 设置渲染器的 pointer-events
   * @param {boolean} enabled - true 表示允许交互（游戏进行中），false 表示不拦截事件（UI 显示时）
   */
  setRendererPointerEvents(enabled) {
    if (this.renderer && this.renderer.domElement) {
      this.renderer.domElement.style.pointerEvents = enabled ? "auto" : "none";
      console.log(`[SceneManager] 渲染器 pointer-events: ${enabled ? "auto" : "none"}`);
    }
  }
}

