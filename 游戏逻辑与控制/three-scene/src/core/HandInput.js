import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.module.js";

/**
 * HandInput - 手势输入处理模块（重写版）
 * 职责：WebSocket 通信、手势数据平滑处理、坐标转换
 */
export class HandInput {
  constructor(config = {}) {
    // 配置参数
    this.wsUrl = config.wsUrl ?? "ws://localhost:12345";
    this.wsRetryMs = config.wsRetryMs ?? 2000;  // 重连间隔（毫秒）
    this.gestureHz = config.gestureHz ?? 30;     // 手势更新频率
    this.smoothAlpha = config.smoothAlpha ?? 0.4; // 平滑系数（0~1，越大越跟手）
    this.staleMs = config.staleMs ?? 500;        // 手离开后自动松手的延迟时间

    // WebSocket 连接状态
    this.connected = false;
    this.socket = null;
    this.reconnectTimer = null;
    this._hasLoggedDisconnect = false;

    // 是否允许本地输入（例如鼠标模式下仍分发 update）
    this.allowLocalInput = config.allowLocalInput ?? false;

    // 手势状态
    this.gesture = {
      // 原始坐标（服务器发送的 0-1 范围）
      raw: new THREE.Vector2(0.5, 0.5),
      // NDC 坐标（-1 到 1，用于 Three.js）
      ndc: new THREE.Vector2(0, 0),

      // 抓取状态
      holding: false,
      prevHolding: false,
      edgeGrab: false,      // 抓取边沿（open→fist）
      edgeRelease: false,   // 释放边沿（fist→open）

      // 消息时间戳
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
    // 如果已有连接，先关闭
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    // 清除重连定时器
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    try {
      console.log(`[HandInput] 正在连接 WebSocket: ${this.wsUrl}`);
      this.socket = new WebSocket(this.wsUrl);
    } catch (e) {
      console.error("[HandInput] WebSocket 初始化失败", e);
      this.scheduleReconnect();
      return;
    }

    this.socket.onopen = () => {
      this.connected = true;
      this._hasLoggedDisconnect = false;
      console.log("[HandInput] ✅ WebSocket 已连接，手势识别已启用");
      if (this.onGestureCallback) {
        this.onGestureCallback({ type: "connected" });
      }
    };

    this.socket.onclose = (event) => {
      this.connected = false;
      this.socket = null;
      
      // 只在第一次断开时显示详细提示
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
      
      this.scheduleReconnect();
    };

    this.socket.onerror = (error) => {
      // 错误处理由 onclose 完成
      console.error("[HandInput] WebSocket 错误:", error);
    };

    this.socket.onmessage = async (event) => {
      // 节流：避免太高频
      const now = performance.now();
      const minInterval = 1000 / this.gestureHz;
      if (now - this.gesture.lastAcceptedAt < minInterval) {
        return;
      }
      this.gesture.lastAcceptedAt = now;

      // 解析消息
      let text = event.data;
      if (text instanceof Blob) {
        text = await text.text();
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.warn("[HandInput] 无法解析消息:", e);
        return;
      }

      // 检查是否有错误
      if (data.error) {
        console.error(`[HandInput] 服务器错误: ${data.message || data.error}`);
        return;
      }

      this.gesture.lastMsgAt = now;
      // 调试：打印接收到的原始数据，便于在浏览器控制台验证
      try {
        console.log("[HandInput] 收到消息:", data);
      } catch (e) {}
      this.applyGestureInput(data);
    };
  }

  /**
   * 安排重连
   */
  scheduleReconnect() {
    if (this.reconnectTimer) {
      return; // 已有重连计划
    }
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.connected) {
        this.connect();
      }
    }, this.wsRetryMs);
  }

  /**
   * 应用手势输入数据
   * @param {Object} g - 手势数据 { gesture, x, y }
   * 注意：x, y 是 0-1 范围的归一化坐标，需要转换为 NDC (-1 到 1)
   */
  applyGestureInput(g) {
    if (!g || g.gesture === undefined) return;

    // 更新最后消息时间（用于 stale 检测）
    this.gesture.lastMsgAt = performance.now();

    // ✅ 修复：将服务器发送的 0-1 坐标转换为 NDC 坐标 (-1 到 1)
    // 服务器发送：x, y 在 0-1 范围
    // Three.js 需要：NDC 坐标在 -1 到 1 范围
    const rx = this.clamp(g.x, 0, 1) * 2 - 1;  // 0-1 -> -1 到 1
    // 修正：正确的 Y 映射为 ndcY = 1 - 2*y （0 -> 1, 1 -> -1）
    const ry = 1 - 2 * this.clamp(g.y, 0, 1);  // 0-1 -> 1 到 -1（Y轴翻转）
    
    this.gesture.raw.set(rx, ry);
    
    // 平滑插值
    this.gesture.ndc.lerp(this.gesture.raw, this.smoothAlpha);

    // 更新 holding 状态与边沿检测
    const holdingNow = g.gesture === "fist" ? true : 
                      g.gesture === "open" ? false : 
                      this.gesture.holding;
    
    this.gesture.prevHolding = this.gesture.holding;
    this.gesture.holding = holdingNow;

    // 检测边沿（状态变化）
    this.gesture.edgeGrab = !this.gesture.prevHolding && this.gesture.holding;
    this.gesture.edgeRelease = this.gesture.prevHolding && !this.gesture.holding;

    // 通知外部更新：仅在已连接或允许本地输入时分发
    if (this.onGestureCallback && (this.connected || this.allowLocalInput)) {
      this.onGestureCallback({ 
        type: "update", 
        gesture: { ...this.gesture }  // 传递副本
      });
    }

    // 调试：打印映射后的 NDC 坐标和手势状态（便于确认坐标方向与抓取/释放）
    try {
      console.log(`[HandInput] gesture=${g.gesture} raw=(${Number(g.x).toFixed(3)},${Number(g.y).toFixed(3)}) ndc=(${this.gesture.ndc.x.toFixed(3)},${this.gesture.ndc.y.toFixed(3)}) holding=${this.gesture.holding}`);
    } catch (e) {}
  }

  /**
   * 每帧更新（处理超时、状态重置等）
   * @param {number} deltaTime - 帧时间差（秒）
   */
  update(deltaTime) {
    // 如果既未连接也不允许本地输入，则跳过更新
    if (!this.connected && !this.allowLocalInput) return;

    const now = performance.now();

    // 超时保护：手离开/断帧 → 自动松手
    if (now - this.gesture.lastMsgAt > this.staleMs) {
      if (this.gesture.holding) {
        this.gesture.prevHolding = true;
        this.gesture.holding = false;
        this.gesture.edgeRelease = true;
        
        // 通知释放
        if (this.onGestureCallback) {
          this.onGestureCallback({ 
            type: "update", 
            gesture: { ...this.gesture }
          });
        }
      }
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
    return {
      ...this.gesture,
      connected: this.connected
    };
  }

  /**
   * 检查是否已连接
   */
  isConnected() {
    return this.connected;
  }

  /**
   * 断开连接
   */
  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.connected = false;
  }

  /**
   * 工具函数：限制值在范围内
   */
  clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }
}
