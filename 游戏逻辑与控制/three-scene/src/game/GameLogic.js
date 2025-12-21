/**
 * GameLogic - 游戏逻辑管理模块
 * 职责：游戏状态机、拼接顺序管理、完成判定、调试工具
 */
export class GameLogic {
  constructor() {
    // 游戏阶段枚举
    this.Phase = {
      Ready: "ready",
      Playing: "playing",
      Completed: "completed",
    };

    // 当前阶段
    this.phase = this.Phase.Ready;

    // 回调函数
    this.onPhaseChangeCallback = null;
    this.onCompletedCallback = null;

    // 调试工具（延迟加载，避免导入错误导致无法启动）
    this.debugGUI = null;
    this.initDebugGUI();
    
    // 监听鼠标点击，用于选择构件进行调试
    this.setupDebugSelection();
  }

  /**
   * 初始化调试工具（延迟加载）
   */
  async initDebugGUI() {
    try {
      const { DebugGUI } = await import("./DebugGUI.js");
      this.debugGUI = new DebugGUI();
      this.debugGUI.init();
      console.log("[GameLogic] 调试工具已加载");
    } catch (error) {
      console.warn("[GameLogic] 调试工具加载失败，继续运行（不影响游戏功能）:", error);
      // 创建一个空的调试 GUI 对象，避免调用错误
      this.debugGUI = {
        enabled: false,
        updatePiece: () => {},
        clearPiece: () => {},
        update: () => {},
      };
    }
  }

  /**
   * 获取当前阶段
   */
  getPhase() {
    return this.phase;
  }

  /**
   * 设置阶段
   * @param {string} newPhase - 新阶段
   */
  setPhase(newPhase) {
    if (this.phase !== newPhase) {
      const oldPhase = this.phase;
      this.phase = newPhase;
      console.log(`[GameLogic] 阶段变更: ${oldPhase} -> ${newPhase}`);
      
      if (this.onPhaseChangeCallback) {
        this.onPhaseChangeCallback({ oldPhase, newPhase });
      }
    }
  }

  /**
   * 检查是否完成
   * @param {Array} pieces - 构件数组
   * @returns {boolean} - 是否完成
   */
  checkCompleted(pieces) {
    if (!pieces || pieces.length === 0) return false;

    const allSnapped = pieces.every((p) => p.userData.snapped);
    if (allSnapped && this.phase !== this.Phase.Completed) {
      this.setPhase(this.Phase.Completed);
      
      if (this.onCompletedCallback) {
        this.onCompletedCallback();
      }
      
      return true;
    }
    return false;
  }

  /**
   * 重置游戏
   */
  reset() {
    this.phase = this.Phase.Ready;
    if (this.onPhaseChangeCallback) {
      this.onPhaseChangeCallback({ oldPhase: this.Phase.Completed, newPhase: this.Phase.Ready });
    }
  }

  /**
   * 设置阶段变更回调
   */
  onPhaseChange(callback) {
    this.onPhaseChangeCallback = callback;
  }

  /**
   * 设置完成回调
   */
  onCompleted(callback) {
    this.onCompletedCallback = callback;
  }

  /**
   * 设置调试选择（通过键盘快捷键或点击事件）
   */
  setupDebugSelection() {
    // 按 'D' 键切换调试模式
    window.addEventListener("keydown", (event) => {
      if (event.key === "d" || event.key === "D") {
        // 确保调试 GUI 已初始化
        if (!this.debugGUI) {
          console.warn("[GameLogic] 调试工具尚未加载，请稍后再试");
          return;
        }
        this.debugGUI.enabled = !this.debugGUI.enabled;
        if (this.debugGUI.enabled) {
          console.log("[GameLogic] 调试模式已启用，按住 Shift + 点击构件进行调试");
        } else {
          if (this.debugGUI.clearPiece) {
            this.debugGUI.clearPiece();
          }
          console.log("[GameLogic] 调试模式已禁用");
        }
      }
    });
  }

  /**
   * 选中构件进行调试
   * @param {THREE.Object3D} piece - 要调试的构件
   */
  selectPieceForDebug(piece) {
    if (this.debugGUI && this.debugGUI.enabled && piece) {
      this.debugGUI.updatePiece(piece);
    }
  }

  /**
   * 更新调试 GUI（每帧调用）
   */
  updateDebug() {
    if (this.debugGUI && this.debugGUI.enabled) {
      this.debugGUI.update();
    }
  }

  /**
   * 获取调试 GUI 实例
   */
  getDebugGUI() {
    return this.debugGUI;
  }
}

