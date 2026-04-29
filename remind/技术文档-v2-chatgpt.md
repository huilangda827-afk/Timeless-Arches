## 技术交接 — 已遇到的问题与失败（手势识别 / 3D 建模）

作者：集成工程师（第一版）
时间：2025-12-18

本文档聚焦于迄今为止在手势识别和 3D 建模协作中实际遇到的失败、根因分析、已采取的缓解措施与下一步建议。目标是让第二版开发者能快速理解风险并避免重复错误。

---

## 一、总体结论（要点）
- 手势识别（感知层）和 3D 交互（渲染/物理层）天然存在不对称误差：感知提供的是二维/概率化信息，3D 拼装要求高精度位置与角度。
- 项目中最致命的失败来自“假定感知足够精确以驱动精确吸附”的设计决策；在没有深度估计或外部校准的情况下，这个假设不成立。

---

## 二、手势识别相关的失败（详列）

1) Python/MediaPipe 服务无法在目标环境稳定运行
- 现象：`手势识别服务器/server.py` 在用户机器上启动报错（例如：AttributeError: module 'mediapipe' has no attribute 'solutions.hands'）。
- 根因：MediaPipe 与 Python 版本/安装不兼容、环境缺少依赖或 pip wheel 版本问题。
- 影响：真实摄像头流无法被解析并发送到前端，前端无法得到真实手势输入。
- 已做的缓解：实现 Node.js WebSocket 模拟器 `gesture-simulator.js` 以保持前端开发可用性；在前端加入摄像头预览 overlay 作为临时交互反馈。
- 未消除的风险：生产环境需要统一安装说明或 Docker 镜像以保证 MediaPipe 可用。

2) 感知输出与前端坐标系映射混淆（NDC 映射错误）
- 现象：最初 Y 轴映射错误导致手势在屏幕上下颠倒，后修复为 `ndcY = 1 - 2*y`。
- 根因：服务端与前端对坐标系（0..1 vs NDC）的假定不一致。
- 影响：拾取/射线投射命中方向错误，导致抓取失败或交互位置偏移。

3) 无深度信息导致交互不稳定
- 现象：单纯用平面投影（drag plane 或 depth plane）会在输入抖动时产生“平面上下跳动”或抓取错位。
- 根因：MediaPipe 提供关键点二维坐标，未提供可靠深度；没有使用 ToF/双目/估算深度策略。
- 缓解：实现“抓取开始时锁定拖拽平面”的策略并增加 lerp 平滑，显著降低但无法完全消除误差。

4) 手势类别识别边沿检测容易误触
- 现象：open↔fist 状态切换噪声导致多次边沿触发（重复抓取/释放）。
- 根因：手势分类阈值/抖动、帧丢失、节流逻辑导致状态不一致。
- 缓解：加入 `staleMs` 自动松手、edgeGrab/edgeRelease 检测并在前端节流；仍需通过更稳健的滤波或更高质量感知降低误报。

5) 延迟与帧率差异的交互影响
- 现象：WebSocket 网络延迟、前端节流与渲染帧率结合，产生滞后或不连贯的手感。
- 建议：测量端到端延迟，基于延迟做时间戳校正（插值/预测），或在低延迟链路（本地）优先部署感知。

---

## 三、3D 建模 / 场景 与 交互 的失败（详列）

1) GLB 模型原点/尺度/旋转不一致
- 现象：不同模型导出时原点(0,0,0)、朝向与尺度不同；直接使用 targetPosition/rotation 导致视觉偏离和错误吸附。
- 根因：建模者导出标准不统一（Blender/3ds Max/SketchUp 导出设置差异），模型未归一化。
- 影响：需要为每个模型做单独校准，拼接流程复杂且不可自动化。

2) 槽位（slot）与模型的精确对齐脆弱
- 现象：吸附（snap）判定基于简单阈值（距离/角度），但由于模型内部偏移即使阈值满足也会看起来错位。
- 建议：为每个 slot/piece 保存校准偏移（`<model>.calib.json`），并在加载时应用。

3) GLB 层级结构导致射线检测复杂化
- 现象：模型内部是 Group/多个 Mesh 导致 raycaster 命中的是子网格而不是根对象。
- 缓解：在 `SceneManager` 与 `InteractionManager` 中遍历父链并把 `userData` 复制到所有子对象，以确保能找到 `pieceId`。

4) 视觉表现与交互反馈不足
- 现象：材质、阴影、尺寸不明显会让用户难以辨识可交互对象。
- 缓解：增加更明显的材质/emissive、放大模型视觉尺寸、添加高亮缩放反馈与槽位标记。

5) 性能与感知协作测试不足
- 现象：缺少自动化回放/测试数据，模型数量与分辨率增加时未做压力测试。
- 建议：增加 gesture-record/playback 工具与回归测试套件。

---

## 四、我已尝试的解决与结果（实测）
- 用 Node 模拟器替代 MediaPipe：成功让前端在无 Python 环境下可继续迭代。意义：前端功能可验证，不再受 MediaPipe 环境阻断。
- 修正 NDC 映射和增加平滑：修复了坐标颠倒并减少抖动，但仍受深度缺失制约。
- 锁定拖拽平面与 lerp 平滑：显著降低“平面跳动”现象，尤其在鼠标与模拟器输入下表现稳定。
- 增加 per-piece `userData` 复制与 fallback raycast：解决部分因为子网格命中导致无法识别 piece 的问题。
- UI 摄像头预览 overlay：可以打开系统摄像头预览（前端），但这并不等同于后端 MediaPipe 服务已就绪；误导提示已改进为“手势服务已连接（非摄像头直连）”。

仍未解决/部分解决的问题：
- MediaPipe 在目标机器上的安装失败（需要环境层面处理或 Docker）；
- 无可靠深度信息，短期只能通过 UX 交互（放大 tolerances、手动微调）缓解；长期需引入 depth estimate 或外部定位参考。

---

## 五、短期/中期改进建议（可执行项，优先级排序）

短期（可在 1-3 天内完成）
- 为每个 GLB 生成并加入校准文件 `<model>.calib.json`（origin offset / rotation offset / scale / snapTolerance）。
- 在 `SceneManager` 加载时应用校准文件。
- 在 `手势识别服务器/README.md` 中列出 MediaPipe 推荐版本、Python 版本与常见安装步骤，并提供 Dockerfile（避免环境问题）。
- 使用模拟器 + replay 测试脚本验证交互稳定性，并保存若干“通过/失败”样本用于回归。

中期（1-3 周）
- 引入轻量深度估算策略（基于关键点间距或手掌 bbox）并把 `depth` 注入手势消息；更新 `InteractionManager` 以接受 `depth` 优化 mapping。 
- 实现 `perception/adapter` 抽象层，使感知模块替换更容易（mediapipe-python / tfjs / 模拟器）。
- 自动参数搜索（smoothAlpha、lerp speeds、proximity threshold）并记录结果到 `diagnostics.log`。

长期（按需求）
- 若需工业级精度：引入 ToF / 深度相机或在场景边界布置 marker（ArUco）用于相机位姿校准。

---

## 六、关键交付物与文件位置（快速索引）
- 前端入口：`游戏逻辑与控制/three-scene/src/main.js`
- 感知客户端：`游戏逻辑与控制/three-scene/src/core/HandInput.js`
- 场景管理：`游戏逻辑与控制/three-scene/src/core/SceneManager.js`
- 交互管理：`游戏逻辑与控制/three-scene/src/interaction/InteractionManager.js`
- UI/摄像头 overlay：`游戏逻辑与控制/three-scene/src/ui/UIManager.js`
- Python 服务：`游戏逻辑与控制/three-scene/手势识别服务器/server.py`
- Node 模拟器：`游戏逻辑与控制/three-scene/手势识别服务器/gesture-simulator.js`
- 快速验收：`游戏逻辑与控制/three-scene/FAST_VERIFY.md`

---

## 七、我能立即帮忙的三件事（选一或多项）
1. 为红框区域自动生成初版 `<model>.calib.json` 并把 loader 集成进 `SceneManager`（自动应用）；
2. 生成 `手势识别服务器/README.md`、`requirements.txt` 与推荐的 Dockerfile，用于一致化 MediaPipe 部署；
3. 编写 `tools/gesture-recorder.js`（浏览器）并提供 replay-to-simulator 的小工具，便于 CI 回归测试。

请选择要我立刻执行的项，或者让我把此文档保存（已经保存到仓库根目录 `TECH_HANDOFF.md`）。
