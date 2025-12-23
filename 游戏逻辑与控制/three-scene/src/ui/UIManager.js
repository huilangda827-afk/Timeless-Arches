/**
 * UIManager - UI 管理模块
 * 职责：HUD 显示、状态更新、主菜单控制
 */
export class UIManager {
  constructor(sceneManager = null) {
    this.hudElement = null;
    this.mainMenuElement = null;
    this.uiContainerElement = null;
    this.hudCache = { phase: "", input: "", grab: "" };
    this.sceneManager = sceneManager; // 保存 sceneManager 引用，用于控制渲染器交互
    
    // ✅ 修复：确保DOM完全加载后再初始化
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.init());
    } else {
      // DOM已经加载完成，延迟一点确保所有元素都已渲染
      setTimeout(() => this.init(), 100);
    }
  }

  /**
   * 初始化 HUD 和主菜单
   */
  init() {
    // 初始化 HUD（调试信息）
    const hud = document.createElement("div");
    hud.style.position = "fixed";
    hud.style.left = "12px";
    hud.style.top = "12px";
    hud.style.color = "#fff";
    hud.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, monospace";
    hud.style.fontSize = "12px";
    hud.style.background = "rgba(0,0,0,.35)";
    hud.style.padding = "10px 12px";
    hud.style.borderRadius = "10px";
    hud.style.lineHeight = "1.5";
    hud.style.zIndex = "9999";
    hud.innerHTML =
      `Phase: <span id="hudPhase"></span><br/>` +
      `Input: <span id="hudInput"></span><br/>` +
      `Grabbed: <span id="hudGrab"></span><br/>` +
      `Tip: fist=grab/move, open=release+snap, thumb=L/R rotate<br/>` +
      `Debug: <span id="hudDebug"></span>`;
    document.body.appendChild(hud);
    this.hudElement = hud;

    // 获取主菜单和 UI 容器元素（匹配 index.html 中的 ID）
    this.mainMenuElement = document.getElementById("page-menu");
    this.uiContainerElement = document.getElementById("ui-layer");

    // ✅ 确保渲染器不拦截事件（主菜单显示时）
    if (this.sceneManager) {
      this.sceneManager.setRendererPointerEvents(false);
    }

    // 绑定主菜单按钮事件
    this.setupMainMenuEvents();
    
    // ✅ 修复：绑定游戏HUD的退出按钮
    this.setupGameHUDEvents();
    
    // ✅ 调试：检查主菜单元素和按钮
    const btnStart = document.getElementById("btn-start");
    const btnCollection = document.getElementById("btn-collection");
    const btnLogin = document.getElementById("btn-login");
    const btnSettings = document.getElementById("btn-settings");
    console.log("[UIManager] 初始化完成:", {
      mainMenuElement: !!this.mainMenuElement,
      uiContainerElement: !!this.uiContainerElement,
      sceneManager: !!this.sceneManager,
      btnStart: !!btnStart,
      btnCollection: !!btnCollection,
      btnLogin: !!btnLogin,
      btnSettings: !!btnSettings,
      readyState: document.readyState,
    });
    
    // ✅ 修复：如果按钮还没找到，延迟重试绑定
    if (!btnStart || !btnCollection || !btnLogin || !btnSettings) {
      console.warn("[UIManager] ⚠️ 部分按钮未找到，将在500ms后重试绑定");
      setTimeout(() => {
        this.setupMainMenuEvents();
      }, 500);
    }

    // 创建本地摄像头 overlay（延迟创建）
    this._createCameraOverlay();
  }

  /**
   * 设置手势调试信息显示（短文本）
   * @param {string} txt
   */
  setHandDebug(txt) {
    try {
      const el = document.getElementById('hudDebug');
      if (el) el.textContent = txt;
    } catch (e) {}
  }

  /**
   * 创建摄像头视频与手势 overlay DOM 元素
   */
  _createCameraOverlay() {
    try {
      // video container
      const container = document.createElement('div');
      container.id = 'camera-container';
      container.style.position = 'fixed';
      container.style.right = '12px';
      container.style.top = '80px';
      container.style.width = '320px';
      container.style.height = '240px';
      container.style.background = 'rgba(0,0,0,0.35)';
      container.style.borderRadius = '8px';
      container.style.overflow = 'hidden';
      container.style.display = 'none';
      container.style.zIndex = '10002';
      container.style.pointerEvents = 'auto';

      const video = document.createElement('video');
      video.id = 'local-camera-video';
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true;
      video.style.width = '100%';
      video.style.height = '100%';
      video.style.objectFit = 'cover';
      container.appendChild(video);

      // overlay hand indicator
      const hand = document.createElement('div');
      hand.id = 'hand-overlay';
      hand.style.position = 'fixed';
      hand.style.width = '48px';
      hand.style.height = '48px';
      hand.style.background = 'rgba(255,200,120,0.95)';
      hand.style.borderRadius = '50%';
      hand.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
      hand.style.pointerEvents = 'none';
      hand.style.display = 'none';
      hand.style.zIndex = '10003';

      document.body.appendChild(container);
      document.body.appendChild(hand);

      this._cameraContainer = container;
      this._cameraVideo = video;
      this._handOverlay = hand;
      this._handFollowMode = false; // 当为 true 时，手势由视频内鼠标控制（本地调试）

      // video mouse move -> move overlay when follow mode is on
      video.addEventListener('mousemove', (ev) => {
        if (!this._handFollowMode) return;
        const rect = video.getBoundingClientRect();
        const x = ev.clientX; const y = ev.clientY;
        this.setHandOverlayPosition(x, y, false);
      });

      // ✅ 修复：找到 HUD 的按钮并绑定事件（参考视觉部分.html，手动启动摄像头）
      const btnCam = document.getElementById('btn-open-camera');
      const btnFollow = document.getElementById('btn-toggle-hand-follow');
      if (btnCam) {
        btnCam.addEventListener('click', async () => {
          // ✅ 修复：启动 HandInput 的手势识别（参考视觉部分.html 的 startCamera）
          if (!this._handInputStarted) {
            try {
              const center = document.getElementById('hud-center-status');
              if (center) {
                const span = center.querySelector('.center-status-text');
                if (span) span.textContent = '🔄 正在启动摄像头...';
              }
              
              // 通知外部启动 HandInput（通过回调）
              if (this._onStartHandInput) {
                await this._onStartHandInput();
                this._handInputStarted = true;
                btnCam.textContent = '关闭摄像头';
                
                if (center) {
                  const span = center.querySelector('.center-status-text');
                  if (span) span.textContent = '✅ 手势识别已连接（浏览器端 MediaPipe）';
                }
              } else {
                console.warn('[UIManager] 未设置 onStartHandInput 回调');
              }
            } catch (e) {
              console.error('[UIManager] 启动手势识别失败:', e);
              const center = document.getElementById('hud-center-status');
              if (center) {
                const span = center.querySelector('.center-status-text');
                if (span) span.textContent = '❌ 摄像头启动失败，请检查权限或使用鼠标模式';
              }
            }
          } else {
            // 关闭手势识别
            if (this._onStopHandInput) {
              this._onStopHandInput();
              this._handInputStarted = false;
              btnCam.textContent = '打开摄像头';
              
              const center = document.getElementById('hud-center-status');
              if (center) {
                const span = center.querySelector('.center-status-text');
                if (span) span.textContent = '手势未连接 - 使用鼠标模式';
              }
            }
          }
        }, false);
      }
      if (btnFollow) {
        btnFollow.addEventListener('click', () => {
          this._handFollowMode = !this._handFollowMode;
          btnFollow.textContent = this._handFollowMode ? '追踪: 鼠标' : '手动追踪';
        }, false);
      }
    } catch (e) {
      console.warn('[UIManager] 无法创建摄像头 overlay', e);
    }
  }

  /**
   * 注册本地摄像头开启/关闭回调：callback(videoElement, open:boolean)
   */
  onLocalCameraToggle(callback) {
    this._onLocalCameraToggle = callback;
  }

  /**
   * ✅ 修复：注册 HandInput 启动/停止回调（参考视觉部分.html）
   */
  onStartHandInput(callback) {
    this._onStartHandInput = callback;
  }

  /**
   * ✅ 修复：注册 HandInput 停止回调
   */
  onStopHandInput(callback) {
    this._onStopHandInput = callback;
  }

  /**
   * 设置手势 overlay 屏幕坐标（由外部调用）
   * @param {number} screenX - 屏幕像素 X
   * @param {number} screenY - 屏幕像素 Y
   * @param {boolean} holding - 是否为抓取状态（改变样式）
   */
  setHandOverlayPosition(screenX, screenY, holding = false) {
    try {
      if (!this._handOverlay) return;
      // 仅在本地摄像头可见或手动追踪模式开启时显示 overlay
      const cameraVisible = this._cameraContainer && this._cameraContainer.style && this._cameraContainer.style.display !== 'none';
      if (!cameraVisible && !this._handFollowMode) {
        this._handOverlay.style.display = 'none';
        return;
      }
      this._handOverlay.style.left = `${Math.round(screenX - 24)}px`;
      this._handOverlay.style.top = `${Math.round(screenY - 24)}px`;
      this._handOverlay.style.display = (cameraVisible || this._handFollowMode) ? 'block' : 'none';
      this._handOverlay.style.transform = holding ? 'scale(0.9)' : 'scale(1)';
      this._handOverlay.style.background = holding ? 'rgba(200,80,80,0.95)' : 'rgba(255,200,120,0.95)';
    } catch (e) {}
  }

  /**
   * ✅ 修复：设置游戏HUD的事件（退出按钮等）
   */
  setupGameHUDEvents() {
    const btnHome = document.getElementById("btn-home");
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/aa6999dc-f03f-450f-a3b9-6dcf420c0b8f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'UIManager.js:66',message:'setupGameHUDEvents entry',data:{btnHomeFound:!!btnHome,btnHomeDisplay:btnHome?.style?.display,btnHomeComputedDisplay:btnHome?window.getComputedStyle(btnHome)?.display:null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H4'})}).catch(()=>{});
    // #endregion
    
    if (btnHome) {
      const handleHomeClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log("[UIManager] ✅ 游戏退出按钮被点击");
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/aa6999dc-f03f-450f-a3b9-6dcf420c0b8f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'UIManager.js:70',message:'btn-home clicked',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H4'})}).catch(()=>{});
        // #endregion
        
        this.exitGame();
      };
      btnHome.addEventListener("click", handleHomeClick, true);
      btnHome.addEventListener("click", handleHomeClick, false);
      btnHome.onclick = handleHomeClick;
      console.log("[UIManager] ✅ 游戏退出按钮事件已绑定");
    } else {
      console.error("[UIManager] ❌ 未找到 btn-home 按钮！");
    }
  }

  /**
   * ✅ 修复：退出游戏，返回主菜单
   */
  exitGame() {
    // 隐藏游戏HUD
    const gameHud = document.getElementById("page-game-hud");
    if (gameHud) {
      gameHud.style.display = "none";
    }
    
    // 显示主菜单
    this.showMainMenu();
    
    console.log("[UIManager] ✅ 已退出游戏，返回主菜单");
  }

  /**
   * 设置主菜单按钮事件
   */
  setupMainMenuEvents() {
    const btnStart = document.getElementById("btn-start");
    const btnCollection = document.getElementById("btn-collection");
    const btnLogin = document.getElementById("btn-login");
    const btnSettings = document.getElementById("btn-settings");

    // ✅ 调试：检查按钮是否找到
    console.log("[UIManager] 按钮查找结果:", {
      btnStart: !!btnStart,
      btnCollection: !!btnCollection,
      btnLogin: !!btnLogin,
      btnSettings: !!btnSettings,
    });
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/aa6999dc-f03f-450f-a3b9-6dcf420c0b8f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'UIManager.js:113',message:'setupMainMenuEvents entry',data:{btnStart:!!btnStart,btnCollection:!!btnCollection,btnLogin:!!btnLogin,btnSettings:!!btnSettings},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H6'})}).catch(()=>{});
    // #endregion

    if (btnStart) {
      // ✅ 修复：使用多种方式确保事件能触发
      const handleStartClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log("[UIManager] ✅ 开始筑梦按钮被点击！");
        this.hideMainMenu();
        if (this.onStartGameCallback) {
          this.onStartGameCallback();
        }
        return false;
      };
      
      // 同时使用捕获和冒泡阶段
      btnStart.addEventListener("click", handleStartClick, true); // 捕获阶段
      btnStart.addEventListener("click", handleStartClick, false); // 冒泡阶段
      
      // 也支持 mousedown（更早触发）
      btnStart.addEventListener("mousedown", (e) => {
        e.preventDefault();
        console.log("[UIManager] ✅ 开始筑梦按钮 mousedown 事件触发");
      });
      
      // 测试悬停
      btnStart.addEventListener("mouseenter", () => {
        console.log("[UIManager] ✅ 鼠标进入开始筑梦按钮区域");
        btnStart.style.opacity = "0.9"; // 视觉反馈
      });
      btnStart.addEventListener("mouseleave", () => {
        btnStart.style.opacity = "1";
      });
      
      // ✅ 直接设置 onclick（备用方案）
      btnStart.onclick = handleStartClick;
      
      console.log("[UIManager] ✅ 开始筑梦按钮事件已绑定（多种方式）");
    } else {
      console.error("[UIManager] ❌ 未找到 btn-start 按钮！");
      // ✅ 修复：延迟重试绑定
      setTimeout(() => {
        const retryBtn = document.getElementById("btn-start");
        if (retryBtn) {
          const handleStartClick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log("[UIManager] ✅ 开始筑梦按钮被点击（延迟绑定）！");
            this.hideMainMenu();
            if (this.onStartGameCallback) {
              this.onStartGameCallback();
            }
            return false;
          };
          retryBtn.addEventListener("click", handleStartClick, true);
          retryBtn.addEventListener("click", handleStartClick, false);
          retryBtn.onclick = handleStartClick;
          console.log("[UIManager] ✅ 开始筑梦按钮事件已绑定（延迟重试成功）");
        }
      }, 500);
    }

    // ✅ 修复：备用全局捕获（即使按钮找到也添加，作为双重保险）
    document.addEventListener('pointerdown', (e) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (el && (el.id === 'btn-start' || el.closest('#btn-start'))) {
        const btn = el.id === 'btn-start' ? el : el.closest('#btn-start');
        if (btn && btn.onclick) {
          btn.onclick(e);
        }
      }
    }, { capture: true });

    if (btnCollection) {
      const handleCollectionClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log("[UIManager] 我的藏阁按钮被点击");
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/aa6999dc-f03f-450f-a3b9-6dcf420c0b8f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'UIManager.js:167',message:'btn-collection clicked',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H6'})}).catch(()=>{});
        // #endregion
        
        this.showGallery();
      };
      btnCollection.addEventListener("click", handleCollectionClick, true);
      btnCollection.addEventListener("click", handleCollectionClick, false);
      btnCollection.onclick = handleCollectionClick;
    } else {
      console.error("[UIManager] 未找到 btn-collection 按钮！");
    }

    if (btnLogin) {
      const handleLoginClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log("[UIManager] 登录/注册按钮被点击");
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/aa6999dc-f03f-450f-a3b9-6dcf420c0b8f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'UIManager.js:178',message:'btn-login clicked',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H6'})}).catch(()=>{});
        // #endregion
        
        this.showLogin();
      };
      btnLogin.addEventListener("click", handleLoginClick, true);
      btnLogin.addEventListener("click", handleLoginClick, false);
      btnLogin.onclick = handleLoginClick;
    } else {
      console.error("[UIManager] 未找到 btn-login 按钮！");
    }

    if (btnSettings) {
      const handleSettingsClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log("[UIManager] 秘境设置按钮被点击");
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/aa6999dc-f03f-450f-a3b9-6dcf420c0b8f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'UIManager.js:189',message:'btn-settings clicked',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H6'})}).catch(()=>{});
        // #endregion
        
        this.showSettings();
      };
      btnSettings.addEventListener("click", handleSettingsClick, true);
      btnSettings.addEventListener("click", handleSettingsClick, false);
      btnSettings.onclick = handleSettingsClick;
    } else {
      console.error("[UIManager] 未找到 btn-settings 按钮！");
    }

    // ✅ 修复：绑定关闭按钮（使用多种方式确保事件能触发）
    const loginClose = document.getElementById("login-close");
    const settingsClose = document.getElementById("settings-close");
    const galleryReturn = document.getElementById("gallery-return");

    if (loginClose) {
      const handleLoginClose = (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log("[UIManager] ✅ 登录关闭按钮被点击");
        this.hideLogin();
      };
      loginClose.addEventListener("click", handleLoginClose, true);
      loginClose.addEventListener("click", handleLoginClose, false);
      loginClose.onclick = handleLoginClose;
      console.log("[UIManager] ✅ 登录关闭按钮事件已绑定");
    } else {
      console.error("[UIManager] ❌ 未找到 login-close 按钮！");
    }

    if (settingsClose) {
      const handleSettingsClose = (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log("[UIManager] ✅ 设置关闭按钮被点击");
        this.hideSettings();
      };
      settingsClose.addEventListener("click", handleSettingsClose, true);
      settingsClose.addEventListener("click", handleSettingsClose, false);
      settingsClose.onclick = handleSettingsClose;
      console.log("[UIManager] ✅ 设置关闭按钮事件已绑定");
    } else {
      console.error("[UIManager] ❌ 未找到 settings-close 按钮！");
    }

    if (galleryReturn) {
      const handleGalleryReturn = (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log("[UIManager] ✅ 藏阁返回按钮被点击");
        this.hideGallery();
        return false;
      };
      // ✅ 修复：使用多种方式确保事件能触发
      galleryReturn.addEventListener("click", handleGalleryReturn, true);
      galleryReturn.addEventListener("click", handleGalleryReturn, false);
      galleryReturn.onclick = handleGalleryReturn;
      // 也支持 mousedown（更早触发）
      galleryReturn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        console.log("[UIManager] ✅ 藏阁返回按钮 mousedown 事件触发");
      });
      console.log("[UIManager] ✅ 藏阁返回按钮事件已绑定（多种方式）");
    } else {
      console.error("[UIManager] ❌ 未找到 gallery-return 按钮！");
      // ✅ 修复：延迟重试绑定（DOM 可能还未完全加载）
      setTimeout(() => {
        const retryBtn = document.getElementById("gallery-return");
        if (retryBtn) {
          const handleGalleryReturn = (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log("[UIManager] ✅ 藏阁返回按钮被点击（延迟绑定）");
            this.hideGallery();
            return false;
          };
          retryBtn.addEventListener("click", handleGalleryReturn, true);
          retryBtn.addEventListener("click", handleGalleryReturn, false);
          retryBtn.onclick = handleGalleryReturn;
          console.log("[UIManager] ✅ 藏阁返回按钮事件已绑定（延迟重试成功）");
        }
      }, 500);
    }

    // 点击遮罩层关闭模态框
    const loginOverlay = document.getElementById("page-login");
    const settingsOverlay = document.getElementById("page-settings");

    if (loginOverlay) {
      loginOverlay.addEventListener("click", (e) => {
        if (e.target === loginOverlay) {
          this.hideLogin();
        }
      });
    }

    if (settingsOverlay) {
      settingsOverlay.addEventListener("click", (e) => {
        if (e.target === settingsOverlay) {
          this.hideSettings();
        }
      });
    }

    // 绑定设置页面的交互
    this.setupSettingsInteractions();

    // 绑定登录表单
    this.setupLoginForm();
  }

  /**
   * 更新 HUD 显示
   * @param {string} phase - 游戏阶段
   * @param {string} input - 输入方式（"gesture" 或 "mouse"）
   * @param {string} grab - 抓取状态
   */
  update(phase, input, grab) {
    const p = document.getElementById("hudPhase");
    const i = document.getElementById("hudInput");
    const g = document.getElementById("hudGrab");
    if (!p || !i || !g) return;

    const phaseText = phase || "";
    const inputText = input || "";
    const grabText = grab || "none";

    if (this.hudCache.phase !== phaseText) {
      p.textContent = phaseText;
      this.hudCache.phase = phaseText;
    }
    if (this.hudCache.input !== inputText) {
      i.textContent = inputText;
      this.hudCache.input = inputText;
    }
    if (this.hudCache.grab !== grabText) {
      g.textContent = grabText;
      this.hudCache.grab = grabText;
    }
  }

  /**
   * 显示消息
   * @param {string} text - 消息文本
   * @param {number} duration - 显示时长（毫秒），0 表示永久显示
   */
  showMessage(text, duration = 0) {
    // 显示临时居中消息浮层
    try {
      let existing = document.getElementById('ui-message-overlay');
      if (!existing) {
        existing = document.createElement('div');
        existing.id = 'ui-message-overlay';
        existing.style.position = 'fixed';
        existing.style.left = '50%';
        existing.style.top = '10%';
        existing.style.transform = 'translateX(-50%)';
        existing.style.padding = '12px 18px';
        existing.style.background = 'rgba(0,0,0,0.7)';
        existing.style.color = '#fff';
        existing.style.fontSize = '16px';
        existing.style.borderRadius = '8px';
        existing.style.zIndex = '10001';
        existing.style.pointerEvents = 'none';
        document.body.appendChild(existing);
      }
      existing.textContent = text;
      existing.style.display = 'block';

      if (duration && duration > 0) {
        clearTimeout(existing._hideTimer);
        existing._hideTimer = setTimeout(() => {
          existing.style.display = 'none';
        }, duration);
      }
      console.log(`[UIManager] ${text}`);
    } catch (e) {
      console.log(`[UIManager] ${text}`);
    }
  }

  /**
   * 隐藏主菜单
   */
  hideMainMenu() {
    if (this.mainMenuElement) {
      this.mainMenuElement.classList.add("hidden");
    }
    
    // ✅ 修复 UI 交互：隐藏菜单后，允许 Three.js 场景交互
    if (this.sceneManager) {
      this.sceneManager.setRendererPointerEvents(true);
    }
    
    // ✅ 修复：显示游戏HUD
    const gameHud = document.getElementById("page-game-hud");
    if (gameHud) {
      gameHud.style.display = "flex";
      console.log("[UIManager] ✅ 显示游戏HUD");
    }
  }

  /**
   * 显示主菜单
   */
  showMainMenu() {
    if (this.mainMenuElement) {
      this.mainMenuElement.classList.remove("hidden");
    }
    
    // ✅ 修复：隐藏游戏HUD
    const gameHud = document.getElementById("page-game-hud");
    if (gameHud) {
      gameHud.style.display = "none";
    }
    
    // ✅ 修复 UI 交互：显示菜单时，禁止 Three.js 场景拦截事件
    if (this.sceneManager) {
      this.sceneManager.setRendererPointerEvents(false);
    }
  }

  /**
   * 隐藏整个 UI 容器
   */
  hideUIContainer() {
    if (this.uiContainerElement) {
      this.uiContainerElement.classList.add("hidden");
    }
  }

  /**
   * 显示整个 UI 容器
   */
  showUIContainer() {
    if (this.uiContainerElement) {
      this.uiContainerElement.classList.remove("hidden");
    }
  }

  /**
   * 设置开始游戏回调
   */
  onStartGame(callback) {
    this.onStartGameCallback = callback;
  }

  /**
   * 显示登录页面
   */
  showLogin() {
    // ✅ 修复页面重合：确保只显示一个页面
    this.hideSettings();
    this.hideGallery();
    // 隐藏主菜单，显示登录
    if (this.mainMenuElement) {
      this.mainMenuElement.classList.add("hidden");
    }
    
    const page = document.getElementById("page-login");
    const mainMenu = this.mainMenuElement;
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/aa6999dc-f03f-450f-a3b9-6dcf420c0b8f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'UIManager.js:368',message:'showLogin entry',data:{pageFound:!!page,mainMenuFound:!!mainMenu,mainMenuHasHidden:mainMenu?.classList?.contains('hidden')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H6'})}).catch(()=>{});
    // #endregion
    
    if (page) {
      page.classList.add("active");
      console.log("[UIManager] ✅ 显示登录页面");
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/aa6999dc-f03f-450f-a3b9-6dcf420c0b8f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'UIManager.js:377',message:'showLogin after add active',data:{pageHasActive:page.classList.contains('active'),pageComputedDisplay:window.getComputedStyle(page)?.display},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H6'})}).catch(()=>{});
      // #endregion
    }
  }

  /**
   * 隐藏登录页面
   */
  hideLogin() {
    const page = document.getElementById("page-login");
    if (page) {
      page.classList.remove("active");
      console.log("[UIManager] ✅ 隐藏登录页面");
    }
    // ✅ 修复：登录关闭后，显示主菜单
    this.showMainMenu();
  }

  /**
   * 显示设置页面
   */
  showSettings() {
    // ✅ 修复页面重合：确保只显示一个页面
    this.hideLogin();
    this.hideGallery();
    // 隐藏主菜单，显示设置
    if (this.mainMenuElement) {
      this.mainMenuElement.classList.add("hidden");
    }
    
    const page = document.getElementById("page-settings");
    const mainMenu = this.mainMenuElement;
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/aa6999dc-f03f-450f-a3b9-6dcf420c0b8f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'UIManager.js:397',message:'showSettings entry',data:{pageFound:!!page,mainMenuFound:!!mainMenu,mainMenuHasHidden:mainMenu?.classList?.contains('hidden')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H6'})}).catch(()=>{});
    // #endregion
    
    if (page) {
      page.classList.add("active");
      console.log("[UIManager] ✅ 显示设置页面");
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/aa6999dc-f03f-450f-a3b9-6dcf420c0b8f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'UIManager.js:405',message:'showSettings after add active',data:{pageHasActive:page.classList.contains('active'),pageComputedDisplay:window.getComputedStyle(page)?.display},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H6'})}).catch(()=>{});
      // #endregion
    }
  }

  /**
   * 隐藏设置页面
   */
  hideSettings() {
    const page = document.getElementById("page-settings");
    if (page) {
      page.classList.remove("active");
      console.log("[UIManager] ✅ 隐藏设置页面");
    }
    // ✅ 修复：设置关闭后，显示主菜单
    this.showMainMenu();
  }

  /**
   * 显示藏阁页面
   */
  showGallery() {
    // ✅ 修复页面重合：确保只显示一个页面
    this.hideLogin();
    this.hideSettings();
    // 隐藏主菜单，显示藏阁
    if (this.mainMenuElement) {
      this.mainMenuElement.classList.add("hidden");
    }
    
    const page = document.getElementById("page-gallery");
    const mainMenu = this.mainMenuElement;
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/aa6999dc-f03f-450f-a3b9-6dcf420c0b8f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'UIManager.js:425',message:'showGallery entry',data:{pageFound:!!page,mainMenuFound:!!mainMenu,mainMenuHasHidden:mainMenu?.classList?.contains('hidden'),pageHasActive:page?.classList?.contains('active')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H6'})}).catch(()=>{});
    // #endregion
    
    if (page) {
      page.classList.add("active");
      console.log("[UIManager] ✅ 显示藏阁页面");
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/aa6999dc-f03f-450f-a3b9-6dcf420c0b8f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'UIManager.js:433',message:'showGallery after add active',data:{pageHasActive:page.classList.contains('active'),pageComputedDisplay:window.getComputedStyle(page)?.display},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H6'})}).catch(()=>{});
      // #endregion
    }
  }

  /**
   * 隐藏藏阁页面
   */
  hideGallery() {
    const page = document.getElementById("page-gallery");
    const galleryReturn = document.getElementById("gallery-return");
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/aa6999dc-f03f-450f-a3b9-6dcf420c0b8f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'UIManager.js:440',message:'hideGallery entry',data:{pageFound:!!page,galleryReturnFound:!!galleryReturn},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H5'})}).catch(()=>{});
    // #endregion
    
    if (page) {
      page.classList.remove("active");
      console.log("[UIManager] ✅ 隐藏藏阁页面");
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/aa6999dc-f03f-450f-a3b9-6dcf420c0b8f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'UIManager.js:444',message:'hideGallery after remove active',data:{pageHasActive:page.classList.contains('active')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H6'})}).catch(()=>{});
      // #endregion
    }
    // ✅ 修复：藏阁关闭后，显示主菜单
    this.showMainMenu();
  }

  /**
   * 设置设置页面的交互
   */
  setupSettingsInteractions() {
    // 背景音乐滑动条
    const musicSlider = document.getElementById("setting-music");
    const musicValue = document.getElementById("music-value");
    if (musicSlider && musicValue) {
      const updateMusicSlider = (value) => {
        musicValue.textContent = `${value}%`;
        // 更新滑动条的视觉进度（使用 --slider-value CSS 变量）
        musicSlider.style.setProperty("--slider-value", `${value}%`);
      };
      
      musicSlider.addEventListener("input", (e) => {
        updateMusicSlider(e.target.value);
        // TODO: 实际更新背景音乐音量
      });
      // 初始化显示
      updateMusicSlider(musicSlider.value);
    }

    // 灵敏度滑动条
    const sensitivitySlider = document.getElementById("setting-sensitivity");
    const sensitivityValue = document.getElementById("sensitivity-value");
    if (sensitivitySlider && sensitivityValue) {
      const updateSensitivitySlider = (value) => {
        sensitivityValue.textContent = `${value}%`;
        // 更新滑动条的视觉进度
        sensitivitySlider.style.setProperty("--slider-value", `${value}%`);
      };
      
      sensitivitySlider.addEventListener("input", (e) => {
        updateSensitivitySlider(e.target.value);
        // TODO: 实际更新灵敏度设置
      });
      // 初始化显示
      updateSensitivitySlider(sensitivitySlider.value);
    }

    // ✅ 修复：返回主殿按钮（不应该重置设置，应该直接返回）
    const resetBtn = document.getElementById("btn-reset");
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/aa6999dc-f03f-450f-a3b9-6dcf420c0b8f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'UIManager.js:545',message:'setupSettingsInteractions resetBtn check',data:{resetBtnFound:!!resetBtn},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H7'})}).catch(()=>{});
    // #endregion
    
    if (resetBtn) {
      // ✅ 修复：使用命名函数，以便后续可以移除
      const handleResetClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log("[UIManager] ✅ 返回主殿按钮被点击");
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/aa6999dc-f03f-450f-a3b9-6dcf420c0b8f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'UIManager.js:557',message:'btn-reset clicked',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H7'})}).catch(()=>{});
        // #endregion
        
        // 直接返回主菜单，不重置设置
        this.hideSettings();
      };
      
      // ✅ 修复：先移除可能存在的旧事件监听器（通过onclick）
      resetBtn.onclick = null;
      
      // 绑定新的事件监听器（多种方式确保能触发）
      resetBtn.addEventListener("click", handleResetClick, true);
      resetBtn.addEventListener("click", handleResetClick, false);
      resetBtn.onclick = handleResetClick;
      console.log("[UIManager] ✅ 返回主殿按钮事件已绑定");
    }
    
    // 如果有重置设置的功能，可以添加一个单独的重置按钮（暂时注释掉）
    /*
    const resetSettingsBtn = document.getElementById("btn-reset-settings");
    if (resetSettingsBtn) {
      resetSettingsBtn.addEventListener("click", () => {
        if (confirm("确定要重置所有设置吗？")) {
          // 重置滑动条
          if (musicSlider) {
            musicSlider.value = 59;
            musicSlider.style.setProperty("--slider-value", "59%");
            if (musicValue) musicValue.textContent = "59%";
          }
          if (sensitivitySlider) {
            sensitivitySlider.value = 79;
            sensitivitySlider.style.setProperty("--slider-value", "79%");
            if (sensitivityValue) sensitivityValue.textContent = "79%";
          }
          // 重置开关
          const auxiliaryToggle = document.getElementById("setting-auxiliary");
          if (auxiliaryToggle) {
            auxiliaryToggle.checked = true;
          }
          console.log("[UIManager] 设置已重置");
        }
      });
    }
    */
  }

  /**
   * 设置登录表单
   */
  setupLoginForm() {
    const loginForm = document.querySelector(".login-form");
    const passwordToggle = document.getElementById("password-toggle");
    const passwordInput = document.getElementById("login-password");
    const registerBtn = document.getElementById("btn-register");

    // 密码显示/隐藏切换
    if (passwordToggle && passwordInput) {
      passwordToggle.addEventListener("click", () => {
        const type = passwordInput.getAttribute("type") === "password" ? "text" : "password";
        passwordInput.setAttribute("type", type);
        // 可以在这里更新图标
      });
    }

    // 登录表单提交
    if (loginForm) {
      loginForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const account = document.getElementById("login-account").value;
        const password = passwordInput.value;
        
        // TODO: 实现实际的登录逻辑
        console.log("[UIManager] 登录尝试:", { account });
        
        // 模拟登录成功
        setTimeout(() => {
          this.hideLogin();
          console.log("[UIManager] 登录成功");
        }, 500);
      });
    }

    // 注册按钮
    if (registerBtn) {
      registerBtn.addEventListener("click", () => {
        console.log("[UIManager] 跳转到注册页面");
        // TODO: 实现注册功能
      });
    }
  }
}

