# Browser 直连模式说明（纯前端，不使用 Python 服务器）

本项目支持两种手势输入方式：

- Python 服务端（MediaPipe 在服务器运行，通过 WebSocket 发送手势数据）
- 浏览器端直连（在用户浏览器中通过 MediaPipe CDN 直接识别）

你已选择“纯前端”（浏览器直连）。下面说明如何确保该模式可用及注意事项。

## 启用条件

- 使用本地或 HTTPS 服务访问 `three-scene/index.html`（getUserMedia 仅在 `https` 或 `localhost` 生效）。
- 页面中已包含 MediaPipe CDN 脚本（在 `index.html` 中），无需额外安装。 

## 使用步骤

1. 启动本地静态服务器（示例使用 Python）：
```bash
cd "d:\multisim\Timeless Arches\游戏逻辑与控制\three-scene"
python -m http.server 8000
# 然后在浏览器打开 http://localhost:8000
```

2. 打开页面，进入游戏 HUD，点击“打开摄像头”按钮，浏览器会询问摄像头权限，允许后会看到摄像头画面。

3. 当摄像头打开，浏览器会自动启动 MediaPipe（BrowserHands），并将检测到的手势通过前端逻辑传入 `HandInput.applyGestureInput`，驱动场景交互。

## 调试点

- 控制台日志：查找 `[BrowserHands] 已启动`、`[Main] 使用浏览器端 MediaPipe`、以及 `HandInput 收到消息` 等日志。
- 若摄像头无响应，检查浏览器地址是否为 `http://localhost` 或 `https`（file:// 不可用）。
- 若检测不稳定，可尝试更强光照、靠近摄像头或改进手势判定阈值（BrowserHands 中 `_detectGesture`）。

## 优缺点

- 优点：无需 Python 环境或额外依赖，部署简单，适合调试与演示。 
- 缺点：浏览器端性能开销高，检测精度与稳定性受设备影响；对旧设备可能不友好。

---
如果你在使用浏览器模式时遇到问题（例如 MediaPipe 未加载、摄像头不工作或手势判断不准确），把浏览器控制台的第一条错误或日志发送给我，我会继续调试或改进 `BrowserHands` 的判定逻辑。
