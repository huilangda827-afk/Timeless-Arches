import { GUI } from "lil-gui";

/**
 * DebugGUI - 调试工具
 * 使用 lil-gui 提供构件坐标调试功能
 */
export class DebugGUI {
  constructor() {
    this.gui = null;
    this.folder = null;
    this.currentPiece = null;
    this.controllers = {
      x: null,
      y: null,
      z: null,
    };
    this.position = { x: 0, y: 0, z: 0 };
    this.enabled = false;
  }

  /**
   * 初始化调试 GUI
   */
  init() {
    if (this.gui) return;

    this.gui = new GUI({ title: "构件坐标调试" });
    this.gui.hide(); // 默认隐藏

    // 创建位置控制文件夹
    this.folder = this.gui.addFolder("选中构件位置");
    
    // 位置控制器（初始值会在选中构件时更新）
    this.controllers.x = this.folder.add(this.position, "x", -10, 10, 0.01)
      .name("X")
      .onChange((value) => {
        if (this.currentPiece) {
          this.currentPiece.position.x = value;
          this.logPosition();
        }
      });

    this.controllers.y = this.folder.add(this.position, "y", -10, 10, 0.01)
      .name("Y")
      .onChange((value) => {
        if (this.currentPiece) {
          this.currentPiece.position.y = value;
          this.logPosition();
        }
      });

    this.controllers.z = this.folder.add(this.position, "z", -10, 10, 0.01)
      .name("Z")
      .onChange((value) => {
        if (this.currentPiece) {
          this.currentPiece.position.z = value;
          this.logPosition();
        }
      });

    // 复制坐标按钮（lil-gui 使用 add 方法添加函数作为按钮）
    const copyBtnObj = { copyPosition: () => {
      this.logPosition();
      this.copyPositionToClipboard();
    }};
    this.folder.add(copyBtnObj, "copyPosition").name("复制坐标到控制台");

    // 重置按钮
    const resetBtnObj = { resetPosition: () => {
      if (this.currentPiece && this.currentPiece.userData.originalPosition) {
        const original = this.currentPiece.userData.originalPosition;
        this.updatePiece(this.currentPiece);
      }
    }};
    this.folder.add(resetBtnObj, "resetPosition").name("重置为初始值");

    this.folder.open();

    // 显示/隐藏切换
    this.gui.add(this, "enabled").name("启用调试").onChange((value) => {
      if (value) {
        this.gui.show();
      } else {
        this.gui.hide();
      }
    });
  }

  /**
   * 更新选中的构件
   * @param {THREE.Object3D} piece - 要调试的构件对象
   */
  updatePiece(piece) {
    if (!this.gui) {
      this.init();
    }

    this.currentPiece = piece;

    if (!piece) {
      this.gui.hide();
      return;
    }

    // 保存原始位置（如果还没有保存）
    if (!piece.userData.originalPosition) {
      piece.userData.originalPosition = piece.position.clone();
    }

    // 更新 GUI 控制器的值
    this.position.x = piece.position.x;
    this.position.y = piece.position.y;
    this.position.z = piece.position.z;

    // 更新控制器值（不触发 onChange 事件）
    if (this.controllers.x) {
      this.controllers.x.updateDisplay();
      this.controllers.y.updateDisplay();
      this.controllers.z.updateDisplay();
    }

    // 显示 GUI
    if (this.enabled) {
      this.gui.show();
    }

    // 更新文件夹标题
    const pieceName = piece.userData.displayName || `Piece ${piece.userData.pieceId || "Unknown"}`;
    this.folder.title = `选中构件: ${pieceName}`;

    console.log(`[DebugGUI] 选中构件: ${pieceName}`);
    this.logPosition();
  }

  /**
   * 清除选中的构件
   */
  clearPiece() {
    this.currentPiece = null;
    if (this.gui) {
      this.gui.hide();
    }
  }

  /**
   * 每帧更新（同步构件位置到 GUI）
   */
  update() {
    if (this.currentPiece && this.gui && this.gui._hidden === false) {
      // 如果构件位置被外部修改（如拖拽），同步到 GUI
      const pos = this.currentPiece.position;
      if (
        Math.abs(this.position.x - pos.x) > 0.001 ||
        Math.abs(this.position.y - pos.y) > 0.001 ||
        Math.abs(this.position.z - pos.z) > 0.001
      ) {
        this.position.x = pos.x;
        this.position.y = pos.y;
        this.position.z = pos.z;
        this.controllers.x.updateDisplay();
        this.controllers.y.updateDisplay();
        this.controllers.z.updateDisplay();
      }
    }
  }

  /**
   * 输出当前位置到控制台
   */
  logPosition() {
    if (!this.currentPiece) return;

    const pos = this.currentPiece.position;
    const pieceName = this.currentPiece.userData.displayName || `Piece ${this.currentPiece.userData.pieceId || "Unknown"}`;
    
    console.log(`[DebugGUI] ${pieceName} 当前位置:`, {
      x: pos.x.toFixed(3),
      y: pos.y.toFixed(3),
      z: pos.z.toFixed(3),
    });

    // 输出 Three.js Vector3 格式（可直接复制到代码中）
    console.log(
      `new THREE.Vector3(${pos.x.toFixed(3)}, ${pos.y.toFixed(3)}, ${pos.z.toFixed(3)})`
    );
  }

  /**
   * 复制坐标到剪贴板（格式化为代码）
   */
  copyPositionToClipboard() {
    if (!this.currentPiece) return;

    const pos = this.currentPiece.position;
    const codeString = `new THREE.Vector3(${pos.x.toFixed(3)}, ${pos.y.toFixed(3)}, ${pos.z.toFixed(3)})`;
    
    // 尝试复制到剪贴板
    if (navigator.clipboard) {
      navigator.clipboard.writeText(codeString).then(() => {
        console.log("[DebugGUI] 坐标已复制到剪贴板:", codeString);
      }).catch((err) => {
        console.error("[DebugGUI] 复制失败:", err);
        console.log("[DebugGUI] 请手动复制:", codeString);
      });
    } else {
      console.log("[DebugGUI] 请手动复制:", codeString);
    }
  }

  /**
   * 销毁 GUI
   */
  destroy() {
    if (this.gui) {
      this.gui.destroy();
      this.gui = null;
      this.folder = null;
      this.controllers = { x: null, y: null, z: null };
    }
  }
}

