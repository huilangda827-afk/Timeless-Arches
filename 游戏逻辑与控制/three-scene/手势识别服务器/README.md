# MediaPipe 手势识别服务器

## 📋 功能说明

这是一个基于 MediaPipe 的手势识别 WebSocket 服务器，用于将摄像头捕获的手势数据实时传输到前端应用（例如 three-scene）。

## 🚀 快速开始（Windows 推荐）

### 一键安装（推荐，PowerShell）
1. 打开 PowerShell，进入服务器目录：

```powershell
cd "d:\multisim\Timeless Arches\游戏逻辑与控制\three-scene\手势识别服务器"
.\install_deps.ps1
```

脚本会创建虚拟环境（.venv）并尝试安装 `requirements.txt` 中的包。

### 手动安装（可选）

```powershell
cd 手势识别服务器
python -m venv .venv
.\.venv\Scripts\Activate.ps1   # 激活虚拟环境（PowerShell）
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### 启动服务器

在激活虚拟环境后运行：

```powershell
python server.py
```

默认监听： `ws://localhost:12345`。

## 📡 数据格式

服务器发送的 JSON 数据格式：

```json
{
  "gesture": "fist",  // 手势类型: "none", "open", "fist", "point"
  "x": 0.5,             // 归一化X坐标 (0-1)
  "y": 0.5,             // 归一化Y坐标 (0-1)
  "timestamp": 123456.78
}
```

## 🔧 常见问题与排查

1) 报错：`ModuleNotFoundError: No module named 'websockets'`
- 说明：Python 环境缺少 `websockets` 包。
- 解决：激活虚拟环境后运行 `pip install websockets`，或运行 `install_deps.ps1`。

2) 报错：安装 `mediapipe` 失败
- 说明：MediaPipe 在部分 Windows + Python 组合上安装有难度（缺少预编译 wheel）。
- 解决建议：
  - 尝试使用 `conda` 创建环境并通过 conda-forge 安装；或参考 MediaPipe 官方 issue。示例：
    ```bash
    conda create -n mp python=3.9
    conda activate mp
    pip install mediapipe
    ```
  - 若确实无法安装，可先使用浏览器端直连模式（前端已有 BrowserHands 支持），或使用其他机器运行服务器。

3) 报错：无法打开摄像头
- 说明：摄像头被占用或索引不对。
- 解决：关闭其它程序（如 Zoom/Edge），或编辑 `server.py` 顶部的 `CAMERA_INDEX` 尝试 0/1/2。

4) 报错：端口被占用（Address already in use）
- 解决：编辑 `server.py` 修改 `PORT`，或关闭占用端口的程序。

如果遇到其他报错，请把服务器控制台（PowerShell）的完整第一条红色错误输出贴给我，我会帮你定位并修复。

## 🎯 与前端集成

前端 (three-scene) 默认连接 `ws://localhost:12345`，若服务器工作正常，前端 HUD 会显示 “手势服务已连接（非摄像头直连）”。

如果你更愿意在浏览器端直接运行 MediaPipe（无需 Python 服务），three-scene 已包含可选 BrowserHands 实现并在 `index.html` 中引入了 MediaPipe CDN 脚本。

---
备注：Windows 上常见问题是 `mediapipe` 的安装失败以及缺少 ffmpeg/opencv 的二进制依赖。遇到安装报错请先把错误贴给我，我会一步步指导或修改代码以便临时绕过问题（例如改为浏览器端模式）。
# MediaPipe 手势识别服务器

## 📋 功能说明

这是一个基于 MediaPipe 的手势识别 WebSocket 服务器，用于将摄像头捕获的手势数据实时传输到前端应用。

## 🚀 快速开始

### 1. 安装依赖

```bash
cd 手势识别服务器
pip install -r requirements.txt
```

### 2. 启动服务器

```bash
python server.py
```

服务器将在 `ws://localhost:12345` 启动。

### 3. 在前端使用

前端应用会自动连接到服务器。如果服务器未运行，会自动使用鼠标模式。

## 📡 数据格式

服务器发送的 JSON 数据格式：

```json
{
  "gesture": "fist",  // 手势类型: "none", "open", "fist", "point"
  "x": 0.5,          // 归一化X坐标 (0-1)
  "y": 0.5           // 归一化Y坐标 (0-1)
}
```

## 🎮 手势类型

- **"none"**: 未检测到手
- **"open"**: 张开手掌
- **"fist"**: 握拳
- **"point"**: 指向（食指伸直）

## ⚙️ 配置

可以在 `server.py` 中修改：

- **端口**: 默认 `12345`
- **摄像头索引**: 默认 `0`（第一个摄像头）
- **帧率**: 默认 `30fps`

## 🔧 故障排除

### 摄像头无法打开

- 检查摄像头是否被其他程序占用
- 尝试修改 `cv2.VideoCapture(0)` 中的索引（0, 1, 2...）

### 连接失败

- 确保服务器正在运行
- 检查防火墙设置
- 确认端口 12345 未被占用

### 手势识别不准确

- 确保光线充足
- 手部与摄像头保持适当距离（30-80cm）
- 背景尽量简洁

## 📝 注意事项

1. **需要摄像头权限**：首次运行可能需要授权摄像头访问
2. **性能要求**：建议使用较新的 CPU 或 GPU
3. **网络要求**：WebSocket 连接需要本地网络正常

## 🎯 与前端集成

前端应用会自动检测服务器连接状态：
- **连接成功**：使用手势模式
- **连接失败**：自动切换到鼠标模式（不影响使用）



