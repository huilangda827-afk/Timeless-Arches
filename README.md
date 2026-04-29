# 拾光筑梦 · Timeless Arches

> 基于手势交互的中国传统建筑文化沉浸式应用 · 4C 竞赛答辩项目

通过 MediaPipe 手部追踪 + Three.js 3D 场景，让用户隔空拼装中国古代斗拱构件，在交互中感受千年木作智慧。

## 当前进度（v3.0）

### 已完成功能
- **筑梦模式 · 第一关「单翘单昂平身科」**
  - 隔空手势抓取 / 释放（MediaPipe Pinch 检测 + 防抖）
  - 多条件吸附判定：组件匹配 + 装配顺序 + 距离 + 角度
  - 失败回退：松手未到位自动平滑回到备料架
  - 视觉反馈：抓取金色脉冲、吸附多层金环、目标轮廓提示、屏幕震动
  - 国风光标：朱砂红 + 金色拖尾，可在设置面板切换风格
- **沉浸感**
  - 环境金色尘埃粒子常驻
  - 完成后 5 秒摄像机绕飞展示
  - BGM 江上清风游 · 设置面板可调
- **教学层**
  - 抓取构件时左下角弹出百科气泡
  - 完成后中央讲解卡（含再玩 / 继续欣赏 / 进入下一关）
  - HUD 顶部「知识图」按钮 → 弹出本关斗拱知识图
- **用户控制**
  - 顶部 HUD：提示 (H) / 放大 (Z) / 知识图 (K) / 复位 (V) / ⚙ 设置
  - 底部 HUD：重新开始 (R)
  - 设置面板：手势灵敏度 / 音效音量 / BGM / 环境粒子 / 完成绕飞 / 光标风格
  - 持久化到 localStorage

### 进行中
- **第二关「北京紫禁城御花园万春亭斗拱」** — 关卡架构已就绪，等待组员补 6 个零件 GLB + 整体成品 GLB
- **校准工具** `tools/calibrator.html` — 浏览器内拖拽对齐零件，导出 `targetOverrides` JSON

## 技术栈

| 层 | 选型 |
|---|---|
| 3D 渲染 | Three.js 0.160 + GLTFLoader + OrbitControls + TransformControls |
| 手势识别 | MediaPipe Hands（Web 实时） |
| 构建 | Vite |
| 模块化 | ES Modules |

## 目录结构

```
游戏逻辑与控制/three-scene/    主项目（Vite + Three.js）
  src/main.js                  核心逻辑（关卡 / 拼接判定 / 视觉反馈 / UI）
  src/HandInput.js             MediaPipe 封装
  public/models/               关卡 1 模型（含幽灵成品 + 零件 GLB）
  tools/calibrator.html        独立校准工具
建模/                          Blender 源文件 + 备份模型
remind/                        参考资料
```

## 启动开发

```bash
cd 游戏逻辑与控制/three-scene
npm install
npm run dev
```

打开 http://localhost:5173

## 使用校准工具（添加新关卡）

1. 把新关的整体成品 GLB + 零件 GLB 放到 `public/models/levelN/`
2. 浏览器打开 http://localhost:5173/tools/calibrator.html
3. 加载成品 → 加载零件 → 拖动对齐 → 导出 `targetOverrides` JSON
4. 把 JSON 粘到 `src/main.js` 中对应 LEVEL 的 `targetOverrides` 字段

## License

仅用于 4C 竞赛答辩 · 中国传统建筑文化展示用途。
