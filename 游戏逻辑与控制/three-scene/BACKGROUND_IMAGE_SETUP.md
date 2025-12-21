# 背景图片设置说明

## 📸 需要提供的背景图片

为了显示设计稿中的斗拱背景，您需要提供一张背景图片。

### 文件要求

1. **文件名**：`background-dougong.jpg`（或 `.png`）
2. **放置位置**：`游戏逻辑与控制/three-scene/public/background-dougong.jpg`
3. **图片规格建议**：
   - **尺寸**：1920x1080 或更高（16:9 比例）
   - **格式**：JPG（推荐，文件小）或 PNG（支持透明）
   - **内容**：斗拱结构图片（根据设计稿）
   - **文件大小**：建议 < 2MB（优化加载速度）

### 当前配置

背景图已配置在 `src/style.css` 中：

```css
body {
  background: #000 url('/background-dougong.jpg') center center / cover no-repeat;
  background-color: #000; /* 备用纯色背景 */
}
```

### 如果暂时没有背景图

如果暂时没有背景图，系统会使用纯黑色背景（`#000`）作为备用。

### 如何添加背景图

1. 将背景图片文件命名为 `background-dougong.jpg`
2. 放入 `public/` 目录：
   ```
   游戏逻辑与控制/three-scene/
   └── public/
       └── background-dougong.jpg  ← 放在这里
   ```
3. 刷新浏览器页面，背景图会自动加载

### 可选：调整背景图显示方式

如果需要调整背景图的显示效果，可以修改 `src/style.css` 中的 `body` 样式：

- **覆盖整个页面**：`background-size: cover;`（当前设置）
- **完整显示**：`background-size: contain;`
- **固定背景**：`background-attachment: fixed;`
- **调整位置**：`background-position: center center;`（当前设置）

### 注意事项

- 如果图片文件不存在，浏览器会显示纯色背景，不会报错
- 建议使用压缩后的图片以提升加载速度
- 如果背景图太亮，可能需要在 CSS 中添加半透明遮罩层

