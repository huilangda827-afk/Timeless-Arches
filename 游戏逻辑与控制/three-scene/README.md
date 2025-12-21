# 拾光筑梦 (Timeless Arches)

基于 WebGL 的中国古建筑斗拱文化传播应用

## 快速开始

### 安装

```bash
npm install
```

### 运行

```bash
npm run dev
```

访问 `http://localhost:5173`

### 手势识别（可选）

```bash
cd 手势识别服务器
pip install -r requirements.txt
python server.py
```

## 项目结构

```
src/
├── main.js              # 入口文件
├── core/                # 核心模块（场景、手势、特效）
├── interaction/         # 交互管理（坐标映射、磁吸）
├── game/                # 游戏逻辑
└── ui/                  # UI 管理
```

## 核心功能

- ✅ 3D 场景渲染（Three.js）
- ✅ 手势识别（MediaPipe Hands）
- ✅ 鼠标/手势双模式交互
- ✅ 磁吸辅助拼接
- ✅ 中国风 UI 设计

## 详细文档

查看 [技术文档.md](./技术文档.md) 了解完整的 API 文档、配置说明和开发指南。

## 技术栈

- Three.js ^0.180.0
- MediaPipe Hands
- Vanilla JavaScript (ES6+)
- Vite

## 许可证

私有项目，版权所有。

