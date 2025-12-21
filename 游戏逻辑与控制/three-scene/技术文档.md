# 拾光筑梦 (Timeless Arches) - 技术文档

## 项目概述

**拾光筑梦** 是一个基于 WebGL 的中国古建筑斗拱文化传播应用，使用 Three.js 实现 3D 场景渲染，通过 MediaPipe Hands 实现手势识别，让用户可以在 3D 空间中抓取、旋转并拼装斗拱构件。

### 核心特性

- 🎮 **3D 交互拼装**：使用 Three.js 渲染斗拱构件，支持鼠标和手势两种交互方式
- ✋ **手势识别**：基于 MediaPipe Hands 的实时手部追踪和手势识别
- 🧲 **磁吸辅助**：渐进式吸附系统，帮助用户精准拼接构件
- 🎨 **中国风 UI**：朱红色、金色主题，水墨风格界面设计
- 📚 **寓教于乐**：通过互动拼装学习传统建筑结构

---

## 技术栈

### 核心技术

- **Three.js** (^0.180.0): 3D 渲染引擎
- **MediaPipe Hands**: 手势识别（通过 Python WebSocket 服务器）
- **Vanilla JavaScript** (ES6+): 无框架，模块化架构
- **Vite**: 构建工具和开发服务器

### 依赖库

- **lil-gui** (^0.19.2): 调试工具（用于调整构件位置）
- **ws** (^8.18.3): WebSocket 客户端

---

## 项目结构

```
three-scene/
├── src/
│   ├── main.js                    # 入口文件，模块组装和渲染循环
│   ├── style.css                  # 全局样式（中国风主题）
│   │
│   ├── core/                      # 核心模块
│   │   ├── SceneManager.js        # Three.js 场景管理
│   │   ├── HandInput.js           # 手势输入处理
│   │   ├── EffectManager.js       # 特效管理（粒子、光圈）
│   │   └── levels/
│   │       ├── Level1Config.js    # 第一关配置
│   │       └── README.md
│   │
│   ├── interaction/               # 交互模块
│   │   └── InteractionManager.js  # 坐标映射、抓取、磁吸
│   │
│   ├── game/                      # 游戏逻辑
│   │   ├── GameLogic.js           # 游戏状态管理
│   │   └── DebugGUI.js            # 调试工具 GUI
│   │
│   └── ui/                        # UI 模块
│       └── UIManager.js           # UI 界面管理（主菜单、HUD等）
│
├── public/                        # 静态资源
│   ├── models/                    # GLB 3D 模型文件
│   ├── audio/                     # 音效文件
│   └── background-menu.jpg        # 主菜单背景
│   └── background-game.jpg        # 游戏场景背景
│
├── 手势识别服务器/                # Python MediaPipe 服务器
│   ├── server.py                  # WebSocket 服务器
│   ├── requirements.txt           # Python 依赖
│   └── README.md                  # 服务器说明
│
├── index.html                     # HTML 入口
├── package.json                   # 项目配置
└── vite.config.js                 # Vite 配置（可选）
```

---

## 核心模块说明

### 1. SceneManager (场景管理)

**文件**: `src/core/SceneManager.js`

**职责**:
- Three.js 场景初始化（场景、相机、渲染器、光照）
- GLB 模型加载和管理
- 阴影和光照设置
- 地面和 Shadow Catcher 创建

**主要 API**:

```javascript
constructor(config = {})
  - dragPlaneY: 拖拽平面 Y 坐标
  - pieceHoverY: 构件悬停高度

init()
  - 初始化场景、相机、渲染器
  - 设置光照和阴影
  - 创建地面和 Shadow Catcher

loadLevelModels(levelConfig)
  - 异步加载关卡配置的 GLB 模型
  - 返回 Promise

getScene() → THREE.Scene
getCamera() → THREE.PerspectiveCamera
getRenderer() → THREE.WebGLRenderer
getControls() → OrbitControls
getPieces() → Array<THREE.Object3D>
getSlots() → Array<THREE.Mesh>

setRendererPointerEvents(enabled)
  - 控制渲染器的 pointer-events（用于 UI/3D 交互切换）
```

---

### 2. HandInput (手势输入)

**文件**: `src/core/HandInput.js`

**职责**:
- WebSocket 连接管理（连接 MediaPipe Python 服务器）
- 手势数据平滑处理
- 手势状态管理（抓取、释放、旋转）

**主要 API**:

```javascript
constructor(config = {})
  - wsUrl: WebSocket 服务器地址（默认 ws://localhost:12345）
  - wsRetryMs: 重连间隔（毫秒）
  - gestureHz: 手势更新频率
  - smoothAlpha: 平滑系数（0~1，越大越跟手）
  - staleMs: 手离开后自动松手的延迟时间

init()
  - 初始化 WebSocket 连接

update(deltaTime)
  - 每帧更新手势状态
  - 处理平滑和超时

onGesture(callback)
  - 设置手势事件回调
  - 事件类型: "connected", "disconnected", "update"

isConnected() → boolean
  - 检查 WebSocket 连接状态

getCurrentGesture() → Object
  - 获取当前手势状态
```

**手势状态对象**:

```javascript
{
  raw: THREE.Vector2,      // 原始 NDC 坐标
  ndc: THREE.Vector2,      // 平滑后的 NDC 坐标
  holding: boolean,        // 是否抓取
  edgeGrab: boolean,       // 抓取边沿（open→fist）
  edgeRelease: boolean,    // 释放边沿（fist→open）
  rotateDir: number        // 旋转方向（-1/0/+1）
}
```

---

### 3. InteractionManager (交互管理)

**文件**: `src/interaction/InteractionManager.js`

**职责**:
- 2D 屏幕坐标到 3D 世界坐标的映射
- 鼠标/手势抓取和释放逻辑
- 磁吸判定和渐进式吸附

**主要 API**:

```javascript
constructor(sceneManager, config = {})
  - snapDistance: 吸附距离阈值
  - snapAngleRad: 吸附角度阈值（弧度）
  - rotateStep: 旋转步长
  - depthPlane: 深度平面（默认 5.0）
  - depthMin/depthMax: 深度范围（2.0~10.0）

update(deltaTime, gestureState)
  - 每帧更新交互状态
  - 处理手势抓取、释放、磁吸

onMouseDown(ndc) → THREE.Object3D | null
  - 处理鼠标按下，返回选中的构件

onMouseMove(ndc)
  - 处理鼠标移动（拖拽）

onMouseUp() → boolean
  - 处理鼠标释放，返回是否成功吸附

tryGrab(gestureState) → boolean
  - 尝试手势抓取

tryRelease() → boolean
  - 尝试手势释放

updatePiecesReference(newPieces)
  - 更新构件引用（模型加载后调用）

updateSlotsReference(newSlots)
  - 更新槽位引用（模型加载后调用）

onSnap(callback)
  - 设置吸附成功回调

onHighlight(callback)
  - 设置高亮回调

adjustDepthByWheel(delta)
  - 通过滚轮调节深度平面
```

**坐标映射算法**:

使用射线投射（Raycasting）和动态深度平面实现 2D→3D 映射：
1. 屏幕坐标 (x, y) → NDC 坐标 (-1~1)
2. NDC 坐标 + 相机 → Raycaster
3. 与深度平面（可滚轮调节，2.0~10.0）求交
4. 得到 3D 世界坐标

**磁吸算法**:

渐进式吸附（Progressive Snapping）：
- 计算构件与槽位的距离和角度差
- 距离越近，吸附强度越大：`strength = 1 - distance / snapDistance`
- 使用 `lerp()` 平滑插值位置和旋转
- 完全吸附阈值：距离 < 0.1 且角度 < 0.05 弧度

---

### 4. GameLogic (游戏逻辑)

**文件**: `src/game/GameLogic.js`

**职责**:
- 游戏状态机管理（Ready/Playing/Completed）
- 拼装完成判定
- 调试工具集成（lil-gui）

**主要 API**:

```javascript
constructor()

Phase = {
  Ready: "Ready",
  Playing: "Playing",
  Completed: "Completed"
}

getPhase() → string
setPhase(phase)
checkCompleted(pieces) → boolean
  - 检查所有构件是否已正确拼装

onCompleted(callback)
  - 设置完成回调

reset()
  - 重置游戏状态

selectPieceForDebug(piece)
  - 选择构件用于调试（显示 lil-gui）

getDebugGUI() → Object
  - 获取调试 GUI 对象
```

---

### 5. UIManager (UI 管理)

**文件**: `src/ui/UIManager.js`

**职责**:
- 主菜单管理（显示/隐藏）
- 游戏 HUD 管理
- 登录/设置/藏阁页面管理
- UI 与 3D 场景的交互控制

**主要 API**:

```javascript
constructor(sceneManager = null)

init()
  - 初始化 UI 元素和事件绑定

update(phase, input, grab)
  - 更新 HUD 显示

showMainMenu() / hideMainMenu()
  - 显示/隐藏主菜单

showLogin() / hideLogin()
  - 显示/隐藏登录页面

showSettings() / hideSettings()
  - 显示/隐藏设置页面

showGallery() / hideGallery()
  - 显示/隐藏藏阁页面

exitGame()
  - 退出游戏，返回主菜单

onStartGame(callback)
  - 设置开始游戏回调
```

**UI 页面结构**:

- `page-menu`: 主菜单
- `page-game-hud`: 游戏 HUD（状态栏、手势指引、退出按钮）
- `page-login`: 登录/注册模态框
- `page-settings`: 设置模态框
- `page-gallery`: 藏阁页面（网格布局）

---

### 6. EffectManager (特效管理)

**文件**: `src/core/EffectManager.js`

**职责**:
- 粒子特效（拼接成功、胜利特效）
- 光圈特效（磁吸提示）

**主要 API**:

```javascript
constructor(scene, config = {})

update(deltaTime)
  - 每帧更新特效

spawnSnapFx(position)
  - 生成拼接成功特效

spawnWinFx()
  - 生成胜利特效
```

---

## 配置文件

### 主配置 (`src/main.js`)

```javascript
const CONFIG = {
  snapDistance: 0.7,           // 吸附距离阈值
  snapAngleRad: 0.436,         // 吸附角度阈值（25度，弧度）
  dragPlaneY: 0.0,             // 拖拽平面 Y 坐标
  pieceHoverY: 0.5,            // 构件悬停高度
  rotateStep: 0.12,            // 旋转步长
  rotateHoldMs: 160,           // 旋转保持时间（毫秒）
  gestureHz: 30,               // 手势更新频率
  smoothAlpha: 0.35,           // 平滑系数（0~1）
  staleMs: 320,                // 手势超时时间（毫秒）
  wsUrl: "ws://localhost:12345", // WebSocket 服务器地址
  wsRetryMs: 900,              // 重连间隔（毫秒）
  depthPlane: 5.0,             // 深度平面（默认）
  depthMin: 2.0,               // 深度最小值
  depthMax: 10.0,              // 深度最大值
};
```

### 关卡配置 (`src/core/levels/Level1Config.js`)

```javascript
export const level1Config = {
  snapThreshold: 0.3,          // 吸附阈值
  base: {                       // 基座配置（不可动）
    modelPath: "大斗-底层.glb",
    targetPosition: Vector3,
    targetRotation: Euler,
    isInteractive: false,
  },
  pieces: [                     // 构件配置数组
    {
      modelPath: "正心瓜拱-中层.glb",
      targetPosition: Vector3,  // 目标位置
      targetRotation: Euler,    // 目标旋转
      startPosition: Vector3,   // 初始位置（散落状态）
      isInteractive: true,
      pieceId: 0,
      slotId: 0,
      displayName: "正心瓜拱-中层",
    },
    // ... 更多构件
  ],
  metadata: {
    levelId: 1,
    levelName: "第一关：基础斗拱拼接",
    description: "学习传统斗拱结构的基础拼接",
    targetCount: 4,
  },
};
```

---

## 使用指南

### 安装依赖

```bash
cd 游戏逻辑与控制/three-scene
npm install
```

### 启动开发服务器

```bash
npm run dev
```

访问 `http://localhost:5173`（Vite 默认端口）

### 启动手势识别服务器（可选）

如果需要使用手势识别功能：

```bash
cd 手势识别服务器
pip install -r requirements.txt
python server.py
```

服务器将在 `ws://localhost:12345` 启动。

### 构建生产版本

```bash
npm run build
```

构建产物在 `dist/` 目录。

---

## 资源文件配置

### 3D 模型文件

将 GLB 模型文件放置在 `public/models/` 目录：

```
public/models/
├── 大斗-底层.glb
├── 正心瓜拱-中层.glb
├── 华拱高层.glb
├── 散枓-左上角.glb
└── 散枓-右上角.glb
```

**注意**: 文件名必须与 `Level1Config.js` 中的 `modelPath` 匹配。

### 音频文件

将音效文件放置在 `public/audio/` 目录：

```
public/audio/
├── snap.mp3      # 拼接成功音效
└── win(2).mp3    # 胜利音效
```

### 背景图片

将背景图片放置在 `public/` 目录：

```
public/
├── background-menu.jpg   # 主菜单背景
└── background-game.jpg   # 游戏场景背景
```

---

## 开发指南

### 添加新关卡

1. 在 `src/core/levels/` 目录创建新配置文件（如 `Level2Config.js`）
2. 按照 `Level1Config.js` 的格式定义关卡配置
3. 在 `main.js` 中导入并使用新配置：

```javascript
import { level2Config } from "./core/levels/Level2Config.js";

sceneManager.loadLevelModels(level2Config)
  .then(() => {
    interactionManager.updatePiecesReference(sceneManager.getPieces());
    interactionManager.updateSlotsReference(sceneManager.getSlots());
  });
```

### 调试工具

项目集成了 `lil-gui` 调试工具：

- **Shift + 点击构件**: 选中构件，显示调试面板
- 调试面板可以实时调整构件的 x, y, z 坐标
- 用于校准构件的 `targetPosition`

### 自定义样式

全局样式变量定义在 `src/style.css` 的 `:root` 中：

```css
:root {
  --color-primary: #c83c23;        /* 朱红色 */
  --color-text-primary: #FFFFFF;   /* 白色文字 */
  --color-text-secondary: #CCCCCC; /* 灰色文字 */
  --color-border-gold: #d4af37;    /* 金色边框 */
  --font-title: "STSong", serif;   /* 标题字体 */
  --font-body: "Microsoft YaHei", sans-serif; /* 正文字体 */
}
```

### 扩展手势识别

手势识别服务器 (`手势识别服务器/server.py`) 基于 MediaPipe Hands。如需扩展手势类型：

1. 在 `server.py` 中添加手势识别逻辑
2. 修改 `HandInput.js` 中的手势解析逻辑
3. 在 `InteractionManager.js` 中添加相应的交互处理

---

## 常见问题

### Q: 鼠标无法拖拽构件？

**A**: 检查以下几点：
1. 确保 renderer 的 `pointer-events` 为 `auto`（游戏开始时）
2. 检查控制台是否有错误信息
3. 确认模型已加载完成（查看控制台日志）
4. 检查构件的 `isInteractive` 是否为 `true`

### Q: 手势识别不工作？

**A**: 
1. 确认手势识别服务器已启动：`python 手势识别服务器/server.py`
2. 检查 WebSocket 连接状态（控制台会显示连接/断开信息）
3. 如果服务器未启动，系统会自动使用鼠标模式（这是正常的）

### Q: 页面重合或按钮无法点击？

**A**:
1. 检查 CSS 的 `pointer-events` 和 `z-index` 设置
2. 查看控制台是否有 JavaScript 错误
3. 确认按钮 ID 与 HTML 中的 ID 匹配

### Q: 3D 构件不清晰？

**A**:
1. 构件使用了斗拱相关颜色（朱红色、金色、木色、深红）
2. 如果仍然不清晰，可以在 `SceneManager.js` 的 `loadPieceModels` 中调整材质属性：
   - `emissiveIntensity`: 发光强度
   - `roughness`: 粗糙度
   - `metalness`: 金属度

### Q: 如何调整磁吸灵敏度？

**A**: 在 `src/main.js` 的 `CONFIG` 中调整：
- `snapDistance`: 吸附距离阈值（越大越容易吸附）
- `snapAngleRad`: 吸附角度阈值（弧度，越大越宽松）

---

## API 参考

### 事件系统

#### InteractionManager 事件

```javascript
// 吸附成功
interactionManager.onSnap(({ piece, slot }) => {
  console.log(`构件 ${piece.userData.displayName} 已吸附到槽位 ${slot.userData.slotId}`);
});

// 高亮
interactionManager.onHighlight(({ piece, on }) => {
  console.log(`构件 ${piece.userData.displayName} 高亮: ${on}`);
});
```

#### GameLogic 事件

```javascript
// 游戏完成
gameLogic.onCompleted(() => {
  console.log("恭喜！关卡完成！");
});
```

#### HandInput 事件

```javascript
// 手势状态变化
handInput.onGesture((event) => {
  if (event.type === "connected") {
    console.log("手势识别已连接");
  } else if (event.type === "disconnected") {
    console.log("手势识别已断开");
  }
});
```

---

## 性能优化建议

1. **模型优化**: 使用压缩的 GLB 格式，减少文件大小
2. **材质优化**: 合理使用 PBR 材质的粗糙度和金属度，避免过度复杂的纹理
3. **阴影优化**: 根据性能需求调整 `shadow.mapSize`（默认 2048x2048）
4. **帧率监控**: 集成 `Stats.js` 监控 FPS（可选）

---

## 版本信息

- **版本**: 0.0.0
- **Three.js**: ^0.180.0
- **Node.js**: 推荐 18+
- **浏览器**: 支持 WebGL 2.0 的现代浏览器（Chrome、Firefox、Edge、Safari）

---

## 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

---

## 许可证

本项目为私有项目，版权归项目所有者所有。

---

## 联系方式

如有问题或建议，请通过项目仓库提交 Issue 或联系项目维护者。

---

**最后更新**: 2025-01-20

