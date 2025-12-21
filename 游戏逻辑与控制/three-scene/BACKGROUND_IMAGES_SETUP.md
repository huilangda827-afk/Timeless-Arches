# 背景图片设置说明（方案 3）

## 📸 需要提供的背景图片

为了实现方案 3（主菜单和游戏场景各用一张背景图），您需要提供两张背景图片。

### 文件要求

请将以下两张图片放入 `public/` 目录：

```
游戏逻辑与控制/three-scene/
└── public/
    ├── background-menu.jpg  ← 主菜单背景图（斗拱结构）
    ├── background-game.jpg  ← 游戏场景背景图（用于照片级融合）
    ├── snap.mp3
    └── win(2).mp3
```

### 图片规格建议

#### 1. `background-menu.jpg`（主菜单背景图）
- **尺寸**：1920x1080 或更高（16:9 比例）
- **格式**：JPG（推荐，文件小）或 PNG
- **内容**：斗拱结构图片（根据设计稿）
- **文件大小**：建议 < 2MB

#### 2. `background-game.jpg`（游戏场景背景图）
- **尺寸**：建议正方形或接近正方形（如 2048x2048 或 1920x1920）
- **格式**：JPG（推荐）或 PNG
- **内容**：带有地面和光照的斗拱场景图片
- **文件大小**：建议 < 3MB
- **重要**：图片中应该有明显的地面区域，用于接收 3D 模型的阴影

---

## 🎨 当前配置

### 主菜单背景图

配置在 `src/style.css` 的 `#ui-layer` 中：

```css
#ui-layer {
  background: url('/background-menu.jpg') center center / cover no-repeat;
}

/* 当主菜单隐藏时，背景图自动隐藏 */
#ui-layer:has(.page-menu.hidden) {
  background: transparent;
}
```

**效果**：
- 主菜单显示时：显示背景图
- 游戏进行时：背景图隐藏，显示 Three.js 场景

### 游戏场景背景图

配置在 `src/core/SceneManager.js` 中：

1. **背景纹理加载**：
   - 使用 `THREE.TextureLoader` 加载 `/background-game.jpg`
   - 设置 `colorSpace = THREE.SRGBColorSpace`（防止颜色泛白）
   - 设置为 `scene.background`

2. **Fog（雾）效果**：
   - 基于背景图创建暗色调 Fog
   - `density = 0.02`，让远处物体自然隐入背景

3. **Shadow Catcher（阴影捕获器）**：
   - 在 `y = -1.0` 位置创建巨大的平面
   - 使用 `THREE.ShadowMaterial`（`opacity: 0.6`）
   - 接收 3D 模型的阴影，实现照片级融合

4. **灯光系统**：
   - **Main Light**: SpotLight（顶光，`intensity: 2.0`）
   - **Fill Light**: AmbientLight（`color: #404040`, `intensity: 0.5`）
   - **Rim Light**: PointLight（边缘光，`color: #4a5a6a`, `intensity: 1.0`）

---

## 🔧 如何添加背景图

1. **准备图片文件**：
   - 确保图片文件名完全匹配：`background-menu.jpg` 和 `background-game.jpg`
   - 如果文件名不同，需要修改代码中的路径

2. **放置文件**：
   ```
   将图片文件放入：游戏逻辑与控制/three-scene/public/
   ```

3. **刷新页面**：
   - 刷新浏览器，背景图会自动加载
   - 如果图片加载失败，会使用备用纯色背景（不会报错）

---

## ⚙️ 调整参数

### Shadow Catcher 位置调整

如果阴影位置不对，可以调整 `createShadowCatcher()` 中的 `y` 坐标：

```javascript
shadowCatcher.position.y = -1.0; // 根据模型底部位置调整
```

### 阴影透明度调整

如果阴影太深或太浅，可以调整 `opacity`：

```javascript
const shadowCatcherMat = new THREE.ShadowMaterial({
  opacity: 0.6, // 调整这个值（0.0 - 1.0）
  color: 0x000000,
});
```

### Fog 密度调整

如果雾效果太强或太弱，可以调整 `density`：

```javascript
this.scene.fog.density = 0.02; // 调整这个值
```

### 灯光强度调整

如果需要调整光照效果，可以修改 `setupLights()` 中的参数：

```javascript
// Main Light
spotLight.intensity = 2.0; // 调整主光强度

// Fill Light
ambientLight.intensity = 0.5; // 调整环境光强度

// Rim Light
rimLight.intensity = 1.0; // 调整边缘光强度
```

---

## 📝 注意事项

1. **图片文件不存在**：
   - 主菜单：会使用纯黑色背景（`#000`）
   - 游戏场景：会使用纯色背景（`0x202020`）
   - 不会报错，但视觉效果会不同

2. **图片加载失败**：
   - 会自动使用备用背景
   - 控制台会显示警告信息

3. **性能优化**：
   - 建议压缩图片以提升加载速度
   - 游戏场景背景图建议使用 JPG 格式（文件更小）

4. **Shadow Catcher 位置**：
   - 默认位置是 `y = -1.0`
   - 如果模型底部位置不同，需要相应调整

---

## ✅ 验证步骤

1. **主菜单背景**：
   - 刷新页面，应该能看到主菜单背景图
   - 点击"开始筑梦"，背景图应该消失

2. **游戏场景背景**：
   - 进入游戏后，应该能看到游戏场景背景图
   - 3D 模型应该投射阴影到背景图的地面上

3. **阴影效果**：
   - 3D 构件应该在地面上投射阴影
   - 阴影应该与背景图融合自然

4. **灯光效果**：
   - 模型应该有顶光照射
   - 背光面不应该完全死黑（有 Fill Light）
   - 模型边缘应该有轮廓光（Rim Light）



