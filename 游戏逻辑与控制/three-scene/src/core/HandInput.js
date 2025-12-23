/**
 * HandInput - MVP 版本
 * 基于浏览器端 MediaPipe Hands 的简化手势输入模块
 * 
 * 功能：启动摄像头，获取手部数据
 * 输出：{ x, y, isPinching }
 */

export class HandInput {
  constructor() {
    this.hands = null;
    this.camera = null;
    this.videoElement = null;
    this.rafId = null;
    
    // 当前手势数据
    this.currentGesture = {
      x: 0.5, // 屏幕中心
      y: 0.5,
      isPinching: false,
      isOpen: false, // 是否张开手掌
    };
    
    // 平滑处理
    this.smoothX = 0.5;
    this.smoothY = 0.5;
    this.smoothAlpha = 0.15; // 平滑系数（越小越平滑，但延迟越大）
    
    this.isInitialized = false;
    this.isRunning = false;
    
    // 等待 MediaPipe 加载
    this.waitForMediaPipeAndInit();
  }

  /**
   * 等待 MediaPipe 全局对象加载完成
   */
  waitForMediaPipeAndInit() {
    if (typeof Hands !== 'undefined') {
      this.init();
    } else {
      const checkInterval = setInterval(() => {
        if (typeof Hands !== 'undefined') {
          clearInterval(checkInterval);
          this.init();
        }
      }, 100);
      
      // 10秒后超时
      setTimeout(() => {
        clearInterval(checkInterval);
        if (!this.isInitialized) {
          console.warn('[HandInput] MediaPipe Hands 未在 10 秒内加载');
        }
      }, 10000);
    }
  }

  /**
   * 初始化 MediaPipe Hands
   */
  async init() {
    if (this.isInitialized) return;
    
    if (typeof Hands === 'undefined') {
      console.error('[HandInput] MediaPipe Hands 未加载');
      return;
    }

    try {
      // 创建隐藏的 video 元素
      this.videoElement = document.createElement('video');
      this.videoElement.width = 640;
      this.videoElement.height = 480;
      this.videoElement.autoplay = true;
      this.videoElement.playsInline = true;
      this.videoElement.style.position = 'fixed';
      this.videoElement.style.top = '-9999px';
      this.videoElement.style.left = '-9999px';
      this.videoElement.style.opacity = '0';
      this.videoElement.style.pointerEvents = 'none';
      document.body.appendChild(this.videoElement);

      // 初始化 MediaPipe Hands
      this.hands = new Hands({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
      });

      this.hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      // 设置结果回调
      this.hands.onResults((results) => {
        this.onResults(results);
      });

      this.isInitialized = true;
      console.log('[HandInput] ✅ MediaPipe Hands 已初始化');
    } catch (error) {
      console.error('[HandInput] 初始化失败:', error);
    }
  }

  /**
   * 处理 MediaPipe 识别结果
   */
  onResults(results) {
    if (!results || !results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      // 没有检测到手，保持当前位置
      this.currentGesture.isOpen = false;
      return;
    }

    // 使用第一只手的关节点
    const landmarks = results.multiHandLandmarks[0];
    
    // 关键点索引
    const WRIST = 0;
    const THUMB_TIP = 4;
    const THUMB_IP = 3;
    const INDEX_TIP = 8;
    const INDEX_PIP = 6;
    const MIDDLE_TIP = 12;
    const MIDDLE_PIP = 10;
    const RING_TIP = 16;
    const RING_PIP = 14;
    const PINKY_TIP = 20;
    const PINKY_PIP = 18;
    
    // 获取手腕位置（归一化坐标 0-1）
    const wrist = landmarks[WRIST];
    
    // ✅ 修复：添加平滑处理
    this.smoothX += (wrist.x - this.smoothX) * this.smoothAlpha;
    this.smoothY += (wrist.y - this.smoothY) * this.smoothAlpha;
    
    this.currentGesture.x = this.smoothX;
    this.currentGesture.y = this.smoothY;
    
    // 判断是否捏合：计算拇指和食指的距离
    const thumbTip = landmarks[THUMB_TIP];
    const indexTip = landmarks[INDEX_TIP];
    
    const dx = thumbTip.x - indexTip.x;
    const dy = thumbTip.y - indexTip.y;
    const dz = (thumbTip.z || 0) - (indexTip.z || 0);
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    this.currentGesture.isPinching = distance < 0.05;
    
    // ✅ 新增：判断是否张开手掌（用于旋转功能）
    // 检查所有手指是否伸直
    const isFingerExtended = (tip, pip) => tip.y < pip.y;
    const thumbExtended = thumbTip.x > landmarks[THUMB_IP].x;
    const indexExtended = isFingerExtended(indexTip, landmarks[INDEX_PIP]);
    const middleExtended = isFingerExtended(landmarks[MIDDLE_TIP], landmarks[MIDDLE_PIP]);
    const ringExtended = isFingerExtended(landmarks[RING_TIP], landmarks[RING_PIP]);
    const pinkyExtended = isFingerExtended(landmarks[PINKY_TIP], landmarks[PINKY_PIP]);
    
    const extendedCount = [thumbExtended, indexExtended, middleExtended, ringExtended, pinkyExtended]
      .filter(Boolean).length;
    
    // 张开手掌：至少4个手指伸直，且不是捏合状态
    this.currentGesture.isOpen = extendedCount >= 4 && !this.currentGesture.isPinching;
  }

  /**
   * 启动摄像头
   */
  async start() {
    if (!this.isInitialized) {
      await this.init();
    }

    if (this.isRunning) {
      console.warn('[HandInput] 摄像头已在运行');
      return;
    }

    try {
      // 优先使用 MediaPipe Camera
      if (typeof Camera !== 'undefined') {
        this.camera = new Camera(this.videoElement, {
          onFrame: async () => {
            if (this.hands && this.isRunning) {
              try {
                await this.hands.send({ image: this.videoElement });
              } catch (e) {
                console.debug('[HandInput] hands.send 错误', e);
              }
            }
          },
          width: 640,
          height: 480,
        });

        await this.camera.start();
        this.isRunning = true;
        console.log('[HandInput] ✅ 摄像头已启动（MediaPipe Camera）');
      } else {
        // Fallback: 使用 getUserMedia
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('浏览器不支持 navigator.mediaDevices.getUserMedia');
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 }
        });

        this.videoElement.srcObject = stream;
        await this.videoElement.play();

        // 创建 RAF 循环发送帧
        let rafId = null;
        const step = async () => {
          if (this.hands && this.isRunning) {
            try {
              await this.hands.send({ image: this.videoElement });
            } catch (e) {
              console.debug('[HandInput] hands.send 错误', e);
            }
          }
          if (this.isRunning) {
            rafId = requestAnimationFrame(step);
            this.rafId = rafId;
          }
        };
        step();

        // 提供统一的 stop 接口
        const originalStream = stream;
        this.camera = {
          stop: () => {
            if (rafId) cancelAnimationFrame(rafId);
            try {
              const tracks = originalStream.getTracks();
              tracks.forEach(t => t.stop());
            } catch (e) {}
          }
        };

        this.isRunning = true;
        console.log('[HandInput] ✅ 摄像头已启动（getUserMedia fallback）');
      }
    } catch (error) {
      console.error('[HandInput] ❌ 摄像头启动失败:', error);
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * 停止摄像头
   */
  stop() {
    if (!this.isRunning) return;

    try {
      if (this.camera && typeof this.camera.stop === 'function') {
        this.camera.stop();
      } else if (this.videoElement && this.videoElement.srcObject) {
        const stream = this.videoElement.srcObject;
        if (stream && stream.getTracks) {
          stream.getTracks().forEach(t => t.stop());
        }
        this.videoElement.srcObject = null;
      }

      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
    } catch (e) {
      console.warn('[HandInput] 停止摄像头时出现错误', e);
    }

    this.camera = null;
    this.isRunning = false;
    console.log('[HandInput] 摄像头已停止');
  }

  /**
   * 获取当前手势数据
   * @returns {Object} { x, y, isPinching }
   */
  getGesture() {
    return { ...this.currentGesture };
  }

  /**
   * 检查是否正在运行
   */
  isConnected() {
    return this.isRunning;
  }
}
