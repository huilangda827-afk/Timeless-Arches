/**
 * DouGongGame - 斗拱拼装游戏核心管理器
 * 
 * 功能：
 * 1. 加载静态环境（背景版.glb）
 * 2. 解析幽灵参照（幽灵组件.glb）提取目标位置
 * 3. 生成玩家可交互组件
 * 4. 实现拖拽与吸附逻辑
 */

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export class DouGongGame {
  constructor(config = {}) {
    // 配置参数
    this.snapDistance = config.snapDistance ?? 0.4; // 吸附距离阈值（米）
    this.dockingArea = config.dockingArea ?? { x: -5, y: 0, z: -5 }; // 停靠区位置
    
    // Three.js 核心对象
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    
    // 场景对象
    this.environment = null; // 背景版（静态环境）
    this.ghostReference = null; // 幽灵组件（参考模型）
    this.interactiveParts = []; // 玩家可交互的组件数组
    
    // 目标配置字典
    this.TARGET_CONFIG = {}; // { "大斗": { pos: Vector3, quat: Quaternion, isOccupied: false }, ... }
    
    // 拖拽状态
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.draggedObject = null;
    this.isDragging = false;
    
    // 模型加载器
    this.gltfLoader = new GLTFLoader();
    
    // 组件列表
    this.partNames = ['大斗', '华拱', '正心瓜拱', '散科-左边', '散科-右边'];
    
    // 音效
    this.audioSnap = null;
    this.initAudio();
  }
  
  /**
   * 初始化音效
   */
  initAudio() {
    try {
      this.audioSnap = new Audio('/snap.mp3');
      this.audioSnap.volume = 0.6;
    } catch (error) {
      console.warn('[DouGongGame] 音效加载失败:', error);
    }
  }
  
  /**
   * 初始化场景
   */
  async init(container) {
    // 创建场景
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a1a);
    
    // 创建相机（使用指定参数）
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    
    // 设置相机位置（基于 Blender 坐标转换）
    const startPos = new THREE.Vector3(10.79, 2.76, 0.42);
    this.camera.position.copy(startPos);
    
    // 创建渲染器
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    container.appendChild(this.renderer.domElement);
    
    // 创建 OrbitControls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 2.0, 0); // 观察点：红色立柱顶端
    this.controls.minDistance = 2;
    this.controls.maxDistance = 20;
    this.controls.maxPolarAngle = Math.PI / 2; // 防止钻入地底
    this.controls.update();
    
    // 添加光照
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    this.scene.add(directionalLight);
    
    // Step 1: 加载静态环境
    await this.loadEnvironment();
    
    // Step 2: 解析幽灵参照
    await this.parseGhostReference();
    
    // Step 3: 生成玩家组件
    await this.spawnInteractiveParts();
    
    // 绑定事件
    this.setupEventListeners();
    
    // 窗口大小调整
    window.addEventListener('resize', () => this.onWindowResize());
    
    console.log('[DouGongGame] ✅ 初始化完成');
    console.log('[DouGongGame] 目标配置:', this.TARGET_CONFIG);
  }
  
  /**
   * Step 1: 加载静态环境（背景版.glb）
   */
  async loadEnvironment() {
    return new Promise((resolve, reject) => {
      console.log('[DouGongGame] 开始加载环境: /models/背景版.glb');
      
      this.gltfLoader.load(
        '/models/背景版.glb',
        (gltf) => {
          const model = gltf.scene;
          
          // 设置位置到世界原点
          model.position.set(0, 0, 0);
          
          // 设为不可交互
          model.traverse((child) => {
            if (child.isMesh) {
              child.userData.isStatic = true;
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
          
          this.environment = model;
          this.scene.add(model);
          
          console.log('[DouGongGame] ✅ 环境加载完成');
          resolve(model);
        },
        (progress) => {
          if (progress.lengthComputable) {
            const percent = (progress.loaded / progress.total) * 100;
            console.log(`[DouGongGame] 环境加载进度: ${percent.toFixed(1)}%`);
          }
        },
        (error) => {
          console.error('[DouGongGame] ❌ 环境加载失败:', error);
          reject(error);
        }
      );
    });
  }
  
  /**
   * Step 2: 解析幽灵参照（幽灵组件.glb）
   */
  async parseGhostReference() {
    return new Promise((resolve, reject) => {
      console.log('[DouGongGame] 开始加载幽灵参照: /models/幽灵组件.glb');
      
      this.gltfLoader.load(
        '/models/幽灵组件.glb',
        (gltf) => {
          const model = gltf.scene;
          
          // 设置位置到世界原点
          model.position.set(0, 0, 0);
          
          // 先添加到场景，这样 getWorldPosition 才能正确计算
          this.ghostReference = model;
          this.scene.add(model);
          
          // 更新矩阵，确保世界坐标计算正确
          model.updateMatrixWorld(true);
          
          // 遍历所有子节点，提取目标位置
          model.traverse((child) => {
            if (child.isMesh || child.isGroup) {
              const name = child.name;
              
              // 检查名称是否包含"配套"
              if (name && name.includes('配套')) {
                // 提取基础名称（去掉"配套"）
                const baseName = name.replace('配套', '').trim();
                
                // 计算世界坐标和旋转
                const worldPos = new THREE.Vector3();
                const worldQuat = new THREE.Quaternion();
                const worldScale = new THREE.Vector3();
                
                child.getWorldPosition(worldPos);
                child.getWorldQuaternion(worldQuat);
                child.getWorldScale(worldScale);
                
                // 存入目标配置字典
                this.TARGET_CONFIG[baseName] = {
                  pos: worldPos.clone(),
                  quat: worldQuat.clone(),
                  scale: worldScale.clone(),
                  isOccupied: false,
                  originalName: name
                };
                
                console.log(`[DouGongGame] ✅ 提取目标: "${baseName}" 位置:`, worldPos);
              }
            }
          });
          
          // 隐藏幽灵参照模型
          model.visible = false;
          
          console.log('[DouGongGame] ✅ 幽灵参照解析完成，共提取', Object.keys(this.TARGET_CONFIG).length, '个目标');
          resolve(model);
        },
        (progress) => {
          if (progress.lengthComputable) {
            const percent = (progress.loaded / progress.total) * 100;
            console.log(`[DouGongGame] 幽灵参照加载进度: ${percent.toFixed(1)}%`);
          }
        },
        (error) => {
          console.error('[DouGongGame] ❌ 幽灵参照加载失败:', error);
          reject(error);
        }
      );
    });
  }
  
  /**
   * Step 3: 生成玩家组件
   */
  async spawnInteractiveParts() {
    console.log('[DouGongGame] 开始生成玩家组件...');
    
    const loadPromises = this.partNames.map((partName, index) => {
      return new Promise((resolve, reject) => {
        const fileName = `${partName}.glb`;
        const filePath = `/models/${fileName}`;
        
        console.log(`[DouGongGame] 加载组件 [${index + 1}/${this.partNames.length}]: ${filePath}`);
        
        this.gltfLoader.load(
          filePath,
          (gltf) => {
            const model = gltf.scene;
            
            // 身份绑定
            model.userData.partID = partName;
            model.userData.isDraggable = true;
            model.userData.isSnapped = false;
            
            // 初始位置：停靠区（相机前方，避免与中央红柱子重叠）
            const spacing = 1.5; // 组件间距
            const offsetX = (index % 3) * spacing - spacing;
            const offsetZ = Math.floor(index / 3) * spacing;
            
            model.position.set(
              this.dockingArea.x + offsetX,
              this.dockingArea.y,
              this.dockingArea.z + offsetZ
            );
            
            // 启用阴影
            model.traverse((child) => {
              if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
              }
            });
            
            this.interactiveParts.push(model);
            this.scene.add(model);
            
            console.log(`[DouGongGame] ✅ 组件 "${partName}" 已生成`);
            resolve(model);
          },
          undefined,
          (error) => {
            console.warn(`[DouGongGame] ⚠️ 组件 "${partName}" 加载失败:`, error);
            // 即使某个组件加载失败，也继续加载其他组件
            resolve(null);
          }
        );
      });
    });
    
    await Promise.all(loadPromises);
    
    const loadedCount = this.interactiveParts.length;
    console.log(`[DouGongGame] ✅ 玩家组件生成完成，共 ${loadedCount}/${this.partNames.length} 个组件`);
  }
  
  /**
   * 设置事件监听器
   */
  setupEventListeners() {
    // 鼠标事件
    this.renderer.domElement.addEventListener('mousedown', (e) => this.onMouseDown(e));
    this.renderer.domElement.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.renderer.domElement.addEventListener('mouseup', (e) => this.onMouseUp(e));
    
    // 触摸事件（移动端支持）
    this.renderer.domElement.addEventListener('touchstart', (e) => this.onTouchStart(e));
    this.renderer.domElement.addEventListener('touchmove', (e) => this.onTouchMove(e));
    this.renderer.domElement.addEventListener('touchend', (e) => this.onTouchEnd(e));
  }
  
  /**
   * 鼠标按下
   */
  onMouseDown(event) {
    event.preventDefault();
    
    // 计算鼠标在归一化设备坐标中的位置
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // 射线投射
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.interactiveParts, true);
    
    if (intersects.length > 0) {
      // 找到被点击的对象（向上查找，直到找到有 partID 的对象）
      let target = intersects[0].object;
      while (target && !target.userData.partID) {
        target = target.parent;
      }
      
      if (target && target.userData.isDraggable && !target.userData.isSnapped) {
        this.draggedObject = target;
        this.isDragging = true;
        console.log(`[DouGongGame] 开始拖拽: ${target.userData.partID}`);
      }
    }
  }
  
  /**
   * 鼠标移动
   */
  onMouseMove(event) {
    if (!this.isDragging || !this.draggedObject) return;
    
    event.preventDefault();
    
    // 更新鼠标位置
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // 射线投射到 XY 平面（z=0）
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const intersectPoint = new THREE.Vector3();
    
    if (this.raycaster.ray.intersectPlane(plane, intersectPoint)) {
      // 更新对象位置（保持Y轴不变，或根据组件类型调整）
      this.draggedObject.position.x = intersectPoint.x;
      this.draggedObject.position.z = intersectPoint.z;
      
      // 检查吸附
      this.checkSnapping(this.draggedObject);
    }
  }
  
  /**
   * 鼠标释放
   */
  onMouseUp(event) {
    if (this.isDragging) {
      this.isDragging = false;
      if (this.draggedObject) {
        console.log(`[DouGongGame] 停止拖拽: ${this.draggedObject.userData.partID}`);
        this.draggedObject = null;
      }
    }
  }
  
  /**
   * 触摸开始
   */
  onTouchStart(event) {
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      const mouseEvent = {
        clientX: touch.clientX,
        clientY: touch.clientY,
        preventDefault: () => event.preventDefault()
      };
      this.onMouseDown(mouseEvent);
    }
  }
  
  /**
   * 触摸移动
   */
  onTouchMove(event) {
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      const mouseEvent = {
        clientX: touch.clientX,
        clientY: touch.clientY,
        preventDefault: () => event.preventDefault()
      };
      this.onMouseMove(mouseEvent);
    }
  }
  
  /**
   * 触摸结束
   */
  onTouchEnd(event) {
    this.onMouseUp(event);
  }
  
  /**
   * Step 4: 检查吸附
   */
  checkSnapping(part) {
    if (!part || !part.userData.partID) return;
    if (part.userData.isSnapped) return; // 已经吸附，跳过
    
    const partID = part.userData.partID;
    const target = this.TARGET_CONFIG[partID];
    
    if (!target || target.isOccupied) return; // 没有目标或已被占用
    
    // 计算距离
    const distance = part.position.distanceTo(target.pos);
    
    // 如果距离小于阈值，执行吸附
    if (distance < this.snapDistance) {
      // 强制设置位置和旋转
      part.position.copy(target.pos);
      part.quaternion.copy(target.quat);
      
      // 锁定组件
      part.userData.isDraggable = false;
      part.userData.isSnapped = true;
      target.isOccupied = true;
      
      // 播放音效
      if (this.audioSnap) {
        this.audioSnap.currentTime = 0;
        this.audioSnap.play().catch(e => console.debug('音效播放失败:', e));
      }
      
      console.log(`[DouGongGame] ✅ "${partID}" 已吸附到目标位置！`);
      
      // 检查是否所有组件都已吸附
      this.checkCompletion();
    }
  }
  
  /**
   * 检查完成状态
   */
  checkCompletion() {
    const allSnapped = this.interactiveParts.every(part => part.userData.isSnapped);
    const allOccupied = Object.values(this.TARGET_CONFIG).every(target => target.isOccupied);
    
    if (allSnapped && allOccupied) {
      console.log('[DouGongGame] 🎉 恭喜！所有组件都已成功拼装！');
      
      // 可以在这里触发完成动画或音效
      try {
        const audioWin = new Audio('/win (2).mp3');
        audioWin.volume = 0.7;
        audioWin.play().catch(e => console.debug('成功音效播放失败:', e));
      } catch (e) {
        console.debug('成功音效加载失败:', e);
      }
    }
  }
  
  /**
   * 窗口大小调整
   */
  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
  
  /**
   * 渲染循环
   */
  animate() {
    requestAnimationFrame(() => this.animate());
    
    // 更新控制器
    if (this.controls) {
      this.controls.update();
    }
    
    // 渲染场景
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }
  
  /**
   * 获取场景对象（用于外部访问）
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
}

