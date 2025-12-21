# GLB 模型文件设置说明

## 📁 模型文件目录结构

请将 GLB 模型文件放入以下目录：

```
游戏逻辑与控制/three-scene/
└── public/
    └── models/          ← 需要创建这个目录
        ├── 大斗-底层.glb
        ├── 正心瓜拱-中层.glb
        ├── 华拱高层.glb
        ├── 散枓-左上角.glb
        └── 散枓-右上角.glb
```

## 🔧 设置步骤

### 方法1：手动创建（推荐）

1. 在 `游戏逻辑与控制/three-scene/public/` 目录下创建 `models` 文件夹
2. 将模型文件从 `建模/` 目录复制到 `public/models/` 目录

### 方法2：使用命令

在项目根目录执行：

```bash
# Windows PowerShell
cd "游戏逻辑与控制\three-scene"
New-Item -ItemType Directory -Path "public\models" -Force
Copy-Item "..\..\建模\*.glb" -Destination "public\models\" -Force
```

## ✅ 验证

模型文件应该位于：
- `public/models/大斗-底层.glb`
- `public/models/正心瓜拱-中层.glb`
- `public/models/华拱高层.glb`
- `public/models/散枓-左上角.glb`
- `public/models/散枓-右上角.glb`

## 📝 注意事项

1. **文件名必须完全匹配**（区分大小写）
2. **路径**：模型路径是 `/models/文件名.glb`（相对于 public 目录）
3. **如果模型加载失败**：系统会自动使用测试立方体作为备用



