# 关卡配置说明

## Level1Config.js 使用指南

### 配置文件结构

`Level1Config.js` 包含第一关的完整配置，包括：
- 基座配置（不可动）
- 构件配置（可交互）
- 吸附阈值
- 关卡元数据

### 坐标校准流程

1. **启动项目并启用调试模式**：
   - 运行 `npm run dev`
   - 在浏览器中按 `D` 键启用调试 GUI

2. **选择构件进行调试**：
   - 按住 `Shift` 键 + 点击构件
   - 调试 GUI 面板会显示在右上角

3. **调整坐标**：
   - 在 GUI 面板中调整 X, Y, Z 滑块
   - 实时查看构件位置变化
   - 控制台会输出当前坐标

4. **复制坐标**：
   - 点击 "复制坐标到控制台" 按钮
   - 坐标会以 `new THREE.Vector3(x, y, z)` 格式输出
   - 可以直接复制到配置文件中

5. **更新配置**：
   - 将校准后的坐标替换 `Level1Config.js` 中的 `targetPosition`
   - 保存文件，重新加载页面查看效果

### 配置文件字段说明

```javascript
{
  modelPath: "模型文件名.glb",        // GLB 模型文件路径
  targetPosition: Vector3,            // 目标位置（需要校准）
  targetRotation: Euler,              // 目标旋转
  isInteractive: true/false,          // 是否可交互
  pieceId: 0,                         // 构件 ID
  slotId: 0,                          // 对应的槽位 ID
  displayName: "显示名称",            // 调试时显示的名称
  startPosition: Vector3              // 初始位置（散落状态）
}
```

### 快捷键

- `D` 键：切换调试模式（显示/隐藏调试 GUI）
- `Shift + 点击构件`：选择构件进行调试

### 注意事项

- 坐标基于场景中心 (0, 0, 0)
- Y 轴向上递增
- 基座通常在 Y = 0 位置
- 每个构件的 Y 坐标应该根据实际模型高度递增

