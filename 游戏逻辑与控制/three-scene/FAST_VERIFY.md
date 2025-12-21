# 快速验收指南 — HandInput + 3D 拼接

目标：用手势（或模拟器）实现“抓取 → 移动 → 释放 → 吸附”流程，拼接 `Level1` 红框内的构件。

准备步骤（1 次）
1. 打开命令行，启动前端：

```bash
cd "d:\\multisim\\Timeless Arches\\游戏逻辑与控制\\three-scene"
npm install
npm run dev
```

2. 在另一个终端启动手势模拟器（无需安装 MediaPipe）：

```bash
cd "d:\\multisim\\Timeless Arches\\游戏逻辑与控制\\three-scene\\手势识别服务器"
# 如果尚未安装 ws（只需在该目录运行一次）
npm init -y
npm install ws
node gesture-simulator.js
```

快速检查（在浏览器 DevTools Console）
- 等待模型加载完成，观察以下关键日志（必须出现）：
  - `[SceneManager] pieces=... slots=... base=...` — 确认 `pieces` 与 `slots` 个数（期望 pieces >= 4，slots >=4）。
  - `[HandInput] ✅ WebSocket 已连接` 或 `[HandInput] 收到消息:` — 确认前端收到手势数据。
  - `[HandInput] gesture=... ndc=(...,...)` — 确认 NDC 映射有意义（范围约 -1..1）。
  - `[InteractionManager]` 日志 — 当尝试抓取时若未命中会打印原因；若成功抓取会有高亮和后续吸附日志。

视觉辅助
- 页面中现在会显示：
  - 红色小球（虚拟光标）表示手势映射到 3D 的位置；
  - 绿色小球表示槽位（吸附目标位置）；
 这能帮助你判断虚拟光标是否落在槽位附近。

若流程失败，请把 Console 中全部与上述前缀相关的日志（或截屏）发给我，我会在 10 分钟内根据日志修补参数或代码。

常见快速修复（我会自动尝试）
- 若 `pieces` 为 0：说明模型未加载或路径错误；我会确保 `SceneManager.loadLevelModels()` 完成后自动调用 `interactionManager.updatePiecesReference(...)`。
- 若 虚拟光标与槽位高度不匹配：我会微调 `dragPlaneY` 和 `pieceHoverY`。
- 若 拾取频繁命中错误物体：我会减小 `proximityPickThreshold`（默认 1.2m）。

验收标准（你将检查）
1. 使用模拟器或摄像头能看到控制台显示连接与持续手势数据。
2. 做“握拳（抓）→ 移动手 → 张开（放手）”，至少能将 `Level1` 的一个构件吸附到正确槽位。
3. UI 显示高亮与拼接特效（若启用）。

我会在接下来的迭代里持续自动微调，若你在 2 小时内没有额外指示，我将依据你机器的运行日志持续改进并提交最终说明。

---
快速提交人: 自动化修复脚本（见项目内 `手势识别服务器/gesture-simulator.js` 和 `src/interaction/InteractionManager.js` 的改动）
