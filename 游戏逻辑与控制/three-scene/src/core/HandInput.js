import * as THREE from "three";

/**
 * HandInput - 手势输入处理模块
 * 职责：MediaPipe Hands 集成、WebSocket 通信、手势数据平滑处理
 */
export class HandInput {
  constructor(config = {}) {
    // 配置参数
    this.wsUrl = config.wsUrl ?? "ws://localhost:12345";
    this.wsRetryMs = config.wsRetryMs ?? 900;
    this.gestureHz = config.gestureHz ?? 30;
    this.smoothAlpha = config.smoothAlpha ?? 0.35; // 0~1，越大越跟手（越小越稳）
    this.staleMs = config.staleMs ?? 320; // 手离开/断帧后，多久自动松手
    this.rotateStep = config.rotateStep ?? 0.12;
    this.rotateHoldMs = config.rotateHoldMs ?? 160;

    // WebSocket 连接状态
    this.connected = false;
    this.socket = null;

    // 手势状态
    this.gesture = {
      // NDC 坐标（归一化设备坐标）
      raw: new THREE.Vector2(0, 0),
      ndc: new THREE.Vector2(0, 0),

      // 抓取状态
      holding: false,
      prevHolding: false,
      edgeGrab: false,      // 抓取边沿（open→fist）
      edgeRelease: false,   // 释放边沿（fist→open）

      // 旋转指令
      rotateDir: 0,        // -1 / 0 / +1
      rotateUntil: 0,      // 旋转指令保持到期时间

      // 消息节流 + 超时
      lastMsgAt: 0,
      lastAcceptedAt: 0,
    };

    // 回调函数
    this.onGestureCallback = null;
  }

  /**
   * 初始化 WebSocket 连接
   */
  init() {
    this.connect();
  }

  /**
   * 连接 WebSocket
   */
  connect() {
    let sock;
    try {
      sock = new WebSocket(this.wsUrl);
    } catch (e) {
      console.error("[HandInput] WebSocket 初始化失败", e);
      setTimeout(() => this.connect(), this.wsRetryMs);
      return;
    }

    sock.onopen = () => {
      this.connected = true;
      this.socket = sock;
      console.log("[HandInput] WebSocket 已连接");
      if (this.onGestureCallback) {
        this.onGestureCallback({ type: "connected" });
      }
    };

    sock.onclose = () => {
      this.connected = false;
      this.socket = null;
      // ✅ 减少日志噪音：只在第一次断开时显示，后续静默重连
      if (!this._hasLoggedDisconnect) {
        console.warn("[HandInput] ⚠️  WebSocket 连接失败（手势识别服务器未运行）");
        console.warn("[HandInput] 💡 提示：如需使用手势识别，请启动手势识别服务器：");
        console.warn("[HandInput]    1. 打开终端，进入：游戏逻辑与控制/three-scene/手势识别服务器");
        console.warn("[HandInput]    2. 运行：python server.py");
        console.warn("[HandInput]    3. 或双击：启动服务器.bat（Windows）");
        console.warn("[HandInput] ✅ 当前使用鼠标模式，功能正常");
        console.warn("[HandInput] 🔄 将在后台静默重连...");
        this._hasLoggedDisconnect = true;
      }
      if (this.onGestureCallback) {
        this.onGestureCallback({ type: "disconnected" });
      }
      setTimeout(() => this.connect(), this.wsRetryMs);
    };

    sock.onerror = () => {
      // 交给 onclose 处理重连
    };

    sock.onmessage = async (event) => {
      // 节流：避免太高频
      const now = performance.now();
      if (now - this.gesture.lastAcceptedAt < 1000 / this.gestureHz) return;
      this.gesture.lastAcceptedAt = now;

      // 兼容 Blob / string
      let text = event.data;
      if (text instanceof Blob) text = await text.text();

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        return;
      }

      this.gesture.lastMsgAt = now;
      this.applyGestureInput(data);
    };
  }

  /**
   * 应用手势输入数据
   * @param {Object} g - 手势数据 { gesture, x, y }
   */
  applyGestureInput(g) {
    if (!g || !g.gesture) return;

    // 1) 更新光标（平滑插值）
    const rx = this.clamp(g.x, -1, 1);
    const ry = this.clamp(g.y, -1, 1);
    this.gesture.raw.set(rx, ry);
    this.gesture.ndc.lerp(this.gesture.raw, this.smoothAlpha);

    // 2) holding 状态与边沿检测
    const holdingNow =
      g.gesture === "fist"
        ? true
        : g.gesture === "open"
        ? false
        : this.gesture.holding;
    this.gesture.prevHolding = this.gesture.holding;
    this.gesture.holding = holdingNow;

    this.gesture.edgeGrab = !this.gesture.prevHolding && this.gesture.holding;
    this.gesture.edgeRelease = this.gesture.prevHolding && !this.gesture.holding;

    // 3) rotate 指令（短暂保持，抗抖）
    const now = performance.now();
    if (g.gesture === "rotate-left") {
      this.gesture.rotateDir = -1;
      this.gesture.rotateUntil = now + this.rotateHoldMs;
    } else if (g.gesture === "rotate-right") {
      this.gesture.rotateDir = 1;
      this.gesture.rotateUntil = now + this.rotateHoldMs;
    }

    // 通知外部更新
    if (this.onGestureCallback) {
      this.onGestureCallback({ type: "update", gesture: this.gesture });
    }
  }

  /**
   * 每帧更新（处理超时、旋转到期等）
   * @param {number} deltaTime - 帧时间差（秒）
   */
  update(deltaTime) {
    if (!this.connected) return;

    const now = performance.now();

    // 超时保护：手离开/断帧 → 自动松手
    if (now - this.gesture.lastMsgAt > this.staleMs) {
      if (this.gesture.holding) {
        this.gesture.prevHolding = true;
        this.gesture.holding = false;
        this.gesture.edgeRelease = true;
      }
      this.gesture.rotateDir = 0;
      this.gesture.rotateUntil = 0;
    }

    // rotate 保持到期
    if (this.gesture.rotateUntil && now > this.gesture.rotateUntil) {
      this.gesture.rotateDir = 0;
      this.gesture.rotateUntil = 0;
    }
  }

  /**
   * 设置手势更新回调
   * @param {Function} callback - 回调函数
   */
  onGesture(callback) {
    this.onGestureCallback = callback;
  }

  /**
   * 获取当前手势状态
   */
  getCurrentGesture() {
    return this.gesture;
  }

  /**
   * 检查是否已连接
   */
  isConnected() {
    return this.connected;
  }

  /**
   * 工具函数：限制值在范围内
   */
  clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }
}

