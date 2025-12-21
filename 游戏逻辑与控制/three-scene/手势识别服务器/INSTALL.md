# WebSockets 依赖安装说明

## 🔧 问题

运行 `python server.py` 时出现错误：
```
ModuleNotFoundError: No module named 'websockets'
```

## ✅ 解决方案

### 方法1：使用 requirements.txt（推荐）

```bash
cd 游戏逻辑与控制/three-scene/手势识别服务器
pip install -r requirements.txt
```

这会自动安装所有依赖：
- `mediapipe`
- `opencv-python`
- `websockets`

### 方法2：手动安装

```bash
pip install websockets
```

或者安装所有依赖：

```bash
pip install mediapipe opencv-python websockets
```

## 📝 验证安装

安装完成后，运行：

```bash
python server.py
```

应该看到：
```
[服务器] 正在启动 WebSocket 服务器...
[服务器] 地址: ws://localhost:12345
[服务器] 等待客户端连接...
```

## ⚠️ 注意事项

1. **Python 版本**：建议使用 Python 3.8 或更高版本
2. **摄像头权限**：首次运行可能需要授权摄像头访问
3. **防火墙**：确保端口 12345 未被防火墙阻止

## 🐛 如果仍然有问题

### 问题：pip 命令找不到

**Windows**：
```bash
python -m pip install -r requirements.txt
```

**或者使用完整路径**：
```bash
C:\Users\白鸿瑜\AppData\Local\Programs\Python\Python311\python.exe -m pip install -r requirements.txt
```

### 问题：权限错误

**Windows**：
```bash
python -m pip install --user -r requirements.txt
```

### 问题：网络问题

使用国内镜像源：
```bash
pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
```

