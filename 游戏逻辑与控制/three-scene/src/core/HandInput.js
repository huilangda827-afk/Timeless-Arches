/**
 * HandInput - MVP 版本
 * 基于浏览器端 MediaPipe Hands 的简化手势输入模块
 * 
 * 功能：启动摄像头，获取手部数据
 * 输出：{ x, y, isPinching }
 */

// MediaPipe Hands 锁定版本号 —— 与 forge.html 中 <script> 的 hands.js 版本必须一致，
// 否则 jsdelivr 的 hands.js 与本地 locateFile 拉到的 WASM 版本错位，会导致 wasm-instantiate 永远 pending。
const MP_VERSION = '0.4.1675469240';

// 多 CDN 镜像：jsdelivr 国内时段性不稳定，准备 unpkg / fastly / gcore 兜底；
// 失败时通过 localStorage(MP_CDN_KEY) 轮换索引，下次刷新自动换下一家。
const MP_CDNS = [
  `https://cdn.jsdelivr.net/npm/@mediapipe/hands@${MP_VERSION}/`,
  `https://fastly.jsdelivr.net/npm/@mediapipe/hands@${MP_VERSION}/`,
  `https://gcore.jsdelivr.net/npm/@mediapipe/hands@${MP_VERSION}/`,
  `https://unpkg.com/@mediapipe/hands@${MP_VERSION}/`,
];
const MP_CDN_KEY = 'mp_cdn_idx';

function _readCdnIndex() {
  try {
    const v = parseInt(localStorage.getItem(MP_CDN_KEY) || '0', 10);
    return Number.isFinite(v) ? ((v % MP_CDNS.length) + MP_CDNS.length) % MP_CDNS.length : 0;
  } catch (_) { return 0; }
}
function _writeCdnIndex(idx) {
  try { localStorage.setItem(MP_CDN_KEY, String(idx)); } catch (_) {}
}

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
    
    // 平滑处理（速度自适应：慢速更稳、快速更跟手，见 onResults）
    this.smoothX = 0.5;
    this.smoothY = 0.5;
    this.smoothAlpha = 0.15; // 基础平滑系数（作为速度自适应的下限）

    // 捏合判定（按手掌尺寸归一化 + 迟滞，抗强光/距离变化）：
    //   ratio = 拇指-食指距离 ÷ 手掌跨度（手腕→中指根）
    //   ratio < ON 进入捏合，ratio > OFF 才释放，中间保持原状态（消除临界抖动）
    this._pinchRatioOn = 0.32;
    this._pinchRatioOff = 0.48;

    // 识别信号质量：最近 60 帧中检出手的比例（0~1），供 HUD 显示
    this._detectHist = new Array(60).fill(0);
    this._detectIdx = 0;

    // 强光自适应预处理：采样画面亮度，过曝时经 canvas 滤镜增强对比度再送模型
    this._lumaCanvas = null;   // 64x48 低成本采样画布
    this._filterCanvas = null; // 640x480 滤镜画布（仅强光模式使用）
    this._frameCount = 0;
    this._avgLuma = 128;
    this.brightMode = false;   // 当前是否处于强光增强模式（HUD 可读）
    
    this.isInitialized = false;
    this.isRunning = false;

    // 健康监测：onResults 第一次被调用 = WASM 已就绪
    this._lastResultsAt = 0;
    this._healthTimer = null;
    this._slowWarned = false;

    // 外部回调（main.js 注入）：
    //   onHealthWarn() —— 启动 8s 内仍未收到首帧，提示"加载较慢"
    //   onHealthError(err) —— 启动 20s 内仍未收到首帧，已自动轮换 CDN，提示用户刷新
    //   onHealthOk() —— 首帧成功收到，可清掉之前的"加载较慢"提示
    this.onHealthWarn = null;
    this.onHealthError = null;
    this.onHealthOk = null;

    // 当前选用的 CDN（从 localStorage 读取上次成功值，失败时会被外层轮换）
    this._cdnIdx = _readCdnIndex();
    this._cdnBase = MP_CDNS[this._cdnIdx];
    
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

      console.log(`[HandInput] 选用 CDN [${this._cdnIdx}]: ${this._cdnBase}`);

      this.hands = new Hands({
        locateFile: (file) => this._cdnBase + file,
      });

      this.hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        // 0.5 → 0.35：暗光/手离镜头远时更容易被首次检出（"低信号"的主因）；
        // 追踪阈值保持 0.5，检出后的稳定性不受影响
        minDetectionConfidence: 0.35,
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
    // 健康监测：首次进到这里 = WASM 已 instantiate 成功，模型在跑
    if (this._lastResultsAt === 0) {
      console.log('[HandInput] ✅ MediaPipe WASM 已就绪，开始处理帧');
      // 记下当前 CDN 为已知可用
      _writeCdnIndex(this._cdnIdx);
      if (typeof this.onHealthOk === 'function') {
        try { this.onHealthOk(); } catch (_) {}
      }
    }
    this._lastResultsAt = Date.now();

    const hasHand = !!(results && results.multiHandLandmarks && results.multiHandLandmarks.length > 0);

    // 信号质量：环形缓冲记录检出/丢失
    this._detectHist[this._detectIdx] = hasHand ? 1 : 0;
    this._detectIdx = (this._detectIdx + 1) % this._detectHist.length;

    if (!hasHand) {
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

    // 速度自适应平滑（One-Euro 思路简化版）：
    //   静止/慢速 → alpha 低（滤抖动），快速挥动 → alpha 高（跟手不拖延）
    const rawDx = wrist.x - this.smoothX;
    const rawDy = wrist.y - this.smoothY;
    const speed = Math.abs(rawDx) + Math.abs(rawDy);
    const alpha = Math.min(0.55, this.smoothAlpha * 0.8 + speed * 6.0);
    this.smoothX += rawDx * alpha;
    this.smoothY += rawDy * alpha;

    this.currentGesture.x = this.smoothX;
    this.currentGesture.y = this.smoothY;
    
    // 判断是否捏合：拇指-食指距离按手掌跨度归一化（抗远近距离与强光退化）
    const thumbTip = landmarks[THUMB_TIP];
    const indexTip = landmarks[INDEX_TIP];
    const middleMcp = landmarks[9];

    const dx = thumbTip.x - indexTip.x;
    const dy = thumbTip.y - indexTip.y;
    const dz = (thumbTip.z || 0) - (indexTip.z || 0);
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    const sx = middleMcp.x - wrist.x;
    const sy = middleMcp.y - wrist.y;
    const span = Math.sqrt(sx * sx + sy * sy); // 手掌跨度：手腕→中指根

    if (span > 0.06) {
      // 归一化 + 迟滞：进入捏合与释放使用不同阈值，消除临界抖动导致的"抓-掉-抓"
      const ratio = distance / span;
      if (this.currentGesture.isPinching) {
        if (ratio > this._pinchRatioOff) this.currentGesture.isPinching = false;
      } else {
        if (ratio < this._pinchRatioOn) this.currentGesture.isPinching = true;
      }
    } else {
      // 手掌过小/识别噪声，退回绝对阈值（带迟滞）
      if (this.currentGesture.isPinching) {
        if (distance > 0.07) this.currentGesture.isPinching = false;
      } else {
        if (distance < 0.05) this.currentGesture.isPinching = true;
      }
    }
    
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
   * 取本帧送给 MediaPipe 的图像源：
   *   常规 → 直接用 video；
   *   强光过曝 → 经 canvas 滤镜（提对比度、压亮度）后再送，改善手部关键点稳定性。
   * 亮度每 15 帧采样一次（64x48 低分辨率，成本可忽略），进出强光模式带迟滞。
   */
  _frameSource() {
    const v = this.videoElement;
    if (!v || !v.videoWidth) return v;
    this._frameCount++;

    if (this._frameCount % 15 === 0) {
      try {
        if (!this._lumaCanvas) {
          this._lumaCanvas = document.createElement('canvas');
          this._lumaCanvas.width = 64;
          this._lumaCanvas.height = 48;
        }
        const ctx = this._lumaCanvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(v, 0, 0, 64, 48);
        const data = ctx.getImageData(0, 0, 64, 48).data;
        let sum = 0;
        for (let i = 0; i < data.length; i += 16) {
          // Rec.601 亮度近似（步长 16 = 每 4 像素取 1）
          sum += data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        }
        this._avgLuma = sum / (data.length / 16);

        // 迟滞：>175 进入强光模式，<150 退出
        if (!this.brightMode && this._avgLuma > 175) {
          this.brightMode = true;
          console.log(`[HandInput] ☀️ 检测到强光环境（亮度 ${this._avgLuma.toFixed(0)}），已启用对比度增强`);
        } else if (this.brightMode && this._avgLuma < 150) {
          this.brightMode = false;
          console.log('[HandInput] 光照恢复正常，关闭对比度增强');
        }
      } catch (_) { /* 采样失败不影响主流程 */ }
    }

    if (!this.brightMode) return v;

    try {
      if (!this._filterCanvas) {
        this._filterCanvas = document.createElement('canvas');
        this._filterCanvas.width = 640;
        this._filterCanvas.height = 480;
      }
      const fctx = this._filterCanvas.getContext('2d');
      fctx.filter = 'contrast(1.3) brightness(0.85) saturate(1.15)';
      fctx.drawImage(v, 0, 0, 640, 480);
      return this._filterCanvas;
    } catch (_) {
      return v;
    }
  }

  /**
   * 识别信号质量（供 HUD 显示）：
   *   quality: 最近 60 帧检出手的比例（0~1）
   *   bright:  是否处于强光增强模式
   */
  getSignal() {
    let sum = 0;
    for (const v of this._detectHist) sum += v;
    return {
      quality: sum / this._detectHist.length,
      bright: this.brightMode,
      luma: this._avgLuma,
    };
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
                await this.hands.send({ image: this._frameSource() });
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
              await this.hands.send({ image: this._frameSource() });
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

      // 启动健康监测：等待 WASM 加载并产出第一帧 onResults
      this._beginHealthMonitor();

    } catch (error) {
      console.error('[HandInput] ❌ 摄像头启动失败:', error);
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * 健康监测：跟踪 WASM 是否在合理时间内开始产出识别结果。
   *   8s  无首帧  → onHealthWarn（提示"加载较慢"）
   *   20s 无首帧  → onHealthError（轮换 CDN，提示用户刷新）
   * 一旦收到首帧，立即停止监测并触发 onHealthOk。
   */
  _beginHealthMonitor() {
    this._lastResultsAt = 0;
    this._slowWarned = false;
    if (this._healthTimer) clearInterval(this._healthTimer);

    const startTs = Date.now();
    this._healthTimer = setInterval(() => {
      if (!this.isRunning) {
        clearInterval(this._healthTimer);
        this._healthTimer = null;
        return;
      }
      // 收到首帧 → 健康
      if (this._lastResultsAt > 0) {
        clearInterval(this._healthTimer);
        this._healthTimer = null;
        return;
      }
      const elapsed = Date.now() - startTs;
      if (elapsed > 20000) {
        clearInterval(this._healthTimer);
        this._healthTimer = null;
        // 自动轮换 CDN：下次刷新页面会用下一家
        const nextIdx = (this._cdnIdx + 1) % MP_CDNS.length;
        _writeCdnIndex(nextIdx);
        console.warn(`[HandInput] ⚠️ MediaPipe WASM 20s 内未就绪，已切换至备用线路 [${nextIdx}] ${MP_CDNS[nextIdx]}`);
        if (typeof this.onHealthError === 'function') {
          try {
            this.onHealthError(new Error('MediaPipe 模型加载超时（CDN 不可达）'));
          } catch (_) {}
        }
        return;
      }
      if (elapsed > 8000 && !this._slowWarned) {
        this._slowWarned = true;
        console.warn('[HandInput] ⚠️ MediaPipe WASM 加载较慢，已超过 8s');
        if (typeof this.onHealthWarn === 'function') {
          try { this.onHealthWarn(); } catch (_) {}
        }
      }
    }, 500);
  }

  /**
   * 停止摄像头
   */
  stop() {
    if (!this.isRunning) return;

    if (this._healthTimer) {
      clearInterval(this._healthTimer);
      this._healthTimer = null;
    }

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

  /**
   * WASM 是否已就绪（已收到至少一帧 onResults）
   */
  isModelReady() {
    return this._lastResultsAt > 0;
  }

  /**
   * 当前选用的 CDN 索引（调试用）
   */
  getCurrentCdn() {
    return { index: this._cdnIdx, url: this._cdnBase };
  }
}
