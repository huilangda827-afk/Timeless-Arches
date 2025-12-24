// BrowserHands - 使用 MediaPipe Hands 在浏览器端直接识别手势并回调简化结果
export class BrowserHands {
  constructor() {
    this.hands = null;
    this._raf = null;
    this._video = null;
    this._onGesture = null;
  }

  // 基于 landmarks 判断手势（open/fist/point/none）
  _detectGesture(landmarks) {
    if (!landmarks || landmarks.length < 21) return 'none';

    const wrist = landmarks[0];
    const thumb_tip = landmarks[4];
    const thumb_ip = landmarks[3];
    const index_tip = landmarks[8];
    const index_pip = landmarks[6];
    const middle_tip = landmarks[12];
    const middle_pip = landmarks[10];
    const ring_tip = landmarks[16];
    const ring_pip = landmarks[14];
    const pinky_tip = landmarks[20];
    const pinky_pip = landmarks[18];

    // 判断各手指是否伸直（在图像坐标系中，y 越小说明越靠上）
    const thumbUp = thumb_tip.x > thumb_ip.x; // 简单处理
    const indexUp = index_tip.y < index_pip.y;
    const middleUp = middle_tip.y < middle_pip.y;
    const ringUp = ring_tip.y < ring_pip.y;
    const pinkyUp = pinky_tip.y < pinky_pip.y;

    const upCount = [thumbUp, indexUp, middleUp, ringUp, pinkyUp].filter(Boolean).length;

    if (upCount === 5) return 'open';
    if (upCount === 0 || (upCount === 1 && thumbUp)) return 'fist';
    if (upCount === 1 && indexUp) return 'point';
    return 'none';
  }

  start(videoElement, onGesture) {
    if (!videoElement) return;
    this._video = videoElement;
    this._onGesture = onGesture;

    if (typeof Hands === 'undefined') {
      console.error('[BrowserHands] MediaPipe Hands 未加载（请在 index.html 中添加 CDN 脚本）');
      return;
    }

    if (this.hands) this.stop();

    this.hands = new Hands({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
    this.hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    this.hands.onResults((results) => {
      if (!results || !results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
        if (this._onGesture) this._onGesture({ gesture: 'none', x: 0.5, y: 0.5 });
        return;
      }

      const lm = results.multiHandLandmarks[0];
      try {
        const idx = lm[8];
        const x = idx.x;
        const y = idx.y;
        const gesture = this._detectGesture(lm);
        if (this._onGesture) this._onGesture({ gesture, x, y });
      } catch (e) {
        console.debug('[BrowserHands] onResults 解析失败', e);
      }
    });

    const loop = async () => {
      if (!this.hands || !this._video) return;
      try {
        await this.hands.send({ image: this._video });
      } catch (e) {
        // 忽略短暂错误
      }
      this._raf = requestAnimationFrame(loop);
    };

    // 如果 video 尚未播放，尝试 play
    try { this._video.play().catch(()=>{}); } catch (e) {}

    this._raf = requestAnimationFrame(loop);
    console.log('[BrowserHands] 已启动（使用浏览器 MediaPipe）');
  }

  stop() {
    try { if (this._raf) cancelAnimationFrame(this._raf); } catch (e) {}
    this._raf = null;
    if (this.hands) {
      try { this.hands.close(); } catch (e) {}
      this.hands = null;
    }
    this._video = null;
    this._onGesture = null;
    console.log('[BrowserHands] 已停止');
  }
}

export default BrowserHands;
