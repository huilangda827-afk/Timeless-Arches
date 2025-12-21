import * as THREE from "three";

/**
 * InteractionManager - 交互管理模块
 * 职责：坐标映射（2D→3D）、抓取/释放逻辑、磁吸判定
 */
export class InteractionManager {
  constructor(sceneManager, config = {}) {
    this.sceneManager = sceneManager;
    this.scene = sceneManager.getScene();
    this.camera = sceneManager.getCamera();
    this.pieces = sceneManager.getPieces();
    this.slots = sceneManager.getSlots();

    // 配置参数
    this.snapDistance = config.snapDistance ?? 0.7;
    this.snapAngleRad = config.snapAngleRad ?? THREE.MathUtils.degToRad(25);
    this.dragPlaneY = sceneManager.getDragPlaneY();
    this.pieceHoverY = sceneManager.getPieceHoverY();
    this.rotateStep = config.rotateStep ?? 0.12;

    // 动态深度平面（支持滚轮调节）
    this.depthPlane = config.depthPlane ?? 5.0;
    this.depthMin = config.depthMin ?? 2.0;
    this.depthMax = config.depthMax ?? 10.0;
    this.depthStep = config.depthStep ?? 0.5; // 每次滚轮调节的步长

    // 射线投射器
    this.raycaster = new THREE.Raycaster();
    this.mouseNDC = new THREE.Vector2();
    this.planeHit = new THREE.Vector3();

    // 鼠标控制状态
    this.mouseSelected = null;
    this.mouseDragging = false;
    this.mouseDragOffset = new THREE.Vector3();

    // 手势控制状态
    this.grabbed = null;
    this.gestureDragOffset = new THREE.Vector3();

    // 磁吸状态（用于渐进式吸附）
    this.snappingPiece = null;
    this.snappingTarget = null;

    // 回调函数
    this.onSnapCallback = null;
    this.onHighlightCallback = null;
  }

  /**
   * 每帧更新
   * @param {number} deltaTime - 帧时间差（秒）
   * @param {Object} gestureState - 手势状态对象
   */
  update(deltaTime, gestureState) {
    // 处理手势控制
    if (gestureState && gestureState.connected) {
      this.updateGestureControl(deltaTime, gestureState);
    }

    // 处理渐进式磁吸
    this.updateMagneticSnap(deltaTime);
  }

  /**
   * 更新手势控制
   */
  updateGestureControl(deltaTime, gestureState) {
    const { ndc, edgeGrab, edgeRelease, holding, rotateDir } = gestureState;

    // 使用虚拟光标射线
    this.raycaster.setFromCamera(ndc, this.camera);

    // 抓取边沿：open→fist
    if (edgeGrab && !this.grabbed) {
      // ✅ 修复模型交互：使用recursive: true以检测GLB模型的子对象
      const hits = this.raycaster
        .intersectObjects(this.pieces, true)
        .filter((h) => {
          // 找到实际的piece对象（可能是子对象）
          let obj = h.object;
          while (obj && !obj.userData.pieceId && obj.parent) {
            obj = obj.parent;
          }
          return obj && obj.userData.pieceId !== undefined && !obj.userData.snapped;
        })
        .map((h) => {
          // 返回实际的piece对象
          let obj = h.object;
          while (obj && !obj.userData.pieceId && obj.parent) {
            obj = obj.parent;
          }
          return { ...h, object: obj };
        });
      if (hits.length) {
        this.grabbed = hits[0].object;
        this.highlightAll(false);
        this.highlight(this.grabbed, true);

        // 计算拖拽偏移
        const hitPoint = this.mapNDCTo3D(ndc);
        if (hitPoint) {
          this.gestureDragOffset.copy(hitPoint).sub(this.grabbed.position);
        }

        if (this.onHighlightCallback) {
          this.onHighlightCallback({ piece: this.grabbed, on: true });
        }
      }
    }

    // holding 中：拖动 + 旋转
    if (holding && this.grabbed) {
      const hitPoint = this.mapNDCTo3D(ndc);
      if (hitPoint) {
        this.grabbed.position.copy(hitPoint.sub(this.gestureDragOffset));
        this.grabbed.position.y = this.dragPlaneY + this.pieceHoverY;
      }

      if (rotateDir !== 0) {
        this.grabbed.rotation.y += rotateDir * this.rotateStep;
      }
    }

    // 释放边沿：fist→open
    if (edgeRelease && this.grabbed) {
      this.highlight(this.grabbed, false);
      if (this.onHighlightCallback) {
        this.onHighlightCallback({ piece: this.grabbed, on: false });
      }

      // 尝试立即吸附（如果距离足够近）
      const snapped = this.trySnap(this.grabbed);
      if (snapped) {
        this.grabbed.userData.snapped = true;
        if (this.onSnapCallback) {
          this.onSnapCallback({ piece: this.grabbed, slot: this.snappingTarget });
        }
      }

      this.grabbed = null;
      this.snappingPiece = null;
      this.snappingTarget = null;
    }
  }

  /**
   * 坐标映射：将 NDC（归一化设备坐标）转换为 3D 世界坐标
   * @param {THREE.Vector2} ndc - 归一化设备坐标 (-1 到 1)
   * @returns {THREE.Vector3|null} - 3D 世界坐标，失败返回 null
   */
  mapNDCTo3D(ndc) {
    this.raycaster.setFromCamera(ndc, this.camera);

    // ✅ 修复：使用拖拽平面（Y平面）进行坐标映射
    // 创建垂直于 Y 轴的平面，在拖拽平面高度
    const dragPlane = new THREE.Plane(
      new THREE.Vector3(0, 1, 0),
      -this.dragPlaneY
    );

    if (this.raycaster.ray.intersectPlane(dragPlane, this.planeHit)) {
      return this.planeHit.clone();
    }
    
    // ✅ 备用方案：如果拖拽平面失败，尝试使用深度平面（Z方向）
    const depthPlane = new THREE.Plane(
      new THREE.Vector3(0, 0, 1),  // 垂直于Z轴
      -this.depthPlane
    );
    
    if (this.raycaster.ray.intersectPlane(depthPlane, this.planeHit)) {
      // 将Z平面的交点投影到拖拽平面
      this.planeHit.y = this.dragPlaneY;
      return this.planeHit.clone();
    }
    
    return null;
  }

  /**
   * 通过滚轮调节深度平面
   * @param {number} delta - 滚轮增量（通常来自 wheel 事件的 deltaY）
   */
  adjustDepthByWheel(delta) {
    // delta > 0 表示向下滚动（远离），delta < 0 表示向上滚动（靠近）
    const direction = delta > 0 ? 1 : -1;
    this.depthPlane += direction * this.depthStep;
    this.depthPlane = Math.max(this.depthMin, Math.min(this.depthMax, this.depthPlane));
    console.log(`[InteractionManager] 深度平面调整为: ${this.depthPlane.toFixed(2)}`);
  }

  /**
   * 尝试抓取（鼠标或手势）
   * @param {THREE.Vector2} ndc - 归一化设备坐标
   * @returns {THREE.Mesh|null} - 抓取到的构件，失败返回 null
   */
  tryGrab(ndc) {
    this.raycaster.setFromCamera(ndc, this.camera);
      // ✅ 修复模型交互：使用recursive: true以检测GLB模型的子对象
      const hits = this.raycaster
        .intersectObjects(this.pieces, true)
        .filter((h) => {
          // 找到实际的piece对象（可能是子对象）
          let obj = h.object;
          while (obj && !obj.userData.pieceId && obj.parent) {
            obj = obj.parent;
          }
          return obj && obj.userData.pieceId !== undefined && !obj.userData.snapped;
        })
        .map((h) => {
          // 返回实际的piece对象
          let obj = h.object;
          while (obj && !obj.userData.pieceId && obj.parent) {
            obj = obj.parent;
          }
          return { ...h, object: obj };
        });

    if (hits.length) {
      const piece = hits[0].object;
      this.grabbed = piece;
      this.highlightAll(false);
      this.highlight(piece, true);

      // 计算拖拽偏移
      const hitPoint = this.mapNDCTo3D(ndc);
      if (hitPoint) {
        this.gestureDragOffset.copy(hitPoint).sub(piece.position);
      }

      if (this.onHighlightCallback) {
        this.onHighlightCallback({ piece, on: true });
      }

      return piece;
    }
    return null;
  }

  /**
   * 更新拖拽位置
   * @param {THREE.Vector2} ndc - 归一化设备坐标
   */
  updateDrag(ndc) {
    if (!this.grabbed) return;

    const hitPoint = this.mapNDCTo3D(ndc);
    if (hitPoint) {
      this.grabbed.position.copy(hitPoint.sub(this.gestureDragOffset));
      this.grabbed.position.y = this.dragPlaneY + this.pieceHoverY;
    }
  }

  /**
   * 尝试释放并吸附
   * @returns {boolean} - 是否成功吸附
   */
  tryRelease() {
    if (!this.grabbed) return false;

    this.highlight(this.grabbed, false);
    if (this.onHighlightCallback) {
      this.onHighlightCallback({ piece: this.grabbed, on: false });
    }

    const snapped = this.trySnap(this.grabbed);
    if (snapped) {
      this.grabbed.userData.snapped = true;
      if (this.onSnapCallback) {
        this.onSnapCallback({ piece: this.grabbed, slot: this.snappingTarget });
      }
    }

    this.grabbed = null;
    this.snappingPiece = null;
    this.snappingTarget = null;
    return snapped;
  }

  /**
   * 更新渐进式磁吸（每帧调用）
   * @param {number} deltaTime - 帧时间差（秒）
   */
  updateMagneticSnap(deltaTime) {
    // 如果当前有抓取的构件，检查是否需要渐进式吸附
    const piece = this.grabbed || this.mouseSelected;
    if (!piece || piece.userData.snapped) {
      // 清除磁吸状态
      if (this.snappingPiece) {
        this.snappingPiece = null;
        this.snappingTarget = null;
      }
      return;
    }

    const slot = this.slots.find(
      (s) => s.userData.slotId === piece.userData.slotId
    );
    if (!slot) return;

    const dist = piece.position.distanceTo(slot.position);
    const angle = this.shortestAngleDiff(piece.rotation.y, slot.rotation.y);

    // 计算磁吸强度：距离越近，吸附力越强
    const magneticStrength = Math.max(0, 1 - dist / this.snapDistance);

    // 如果进入磁吸范围（强度 > 0.1），开始渐进式吸附
    if (magneticStrength > 0.1) {
      this.snappingPiece = piece;
      this.snappingTarget = slot;

      // 目标位置
      const targetPos = slot.position.clone();
      targetPos.y = this.dragPlaneY + this.pieceHoverY;

      // 位置平滑插值：吸附速度与磁吸强度和帧时间相关
      const positionLerpSpeed = magneticStrength * 0.15 * deltaTime * 60;
      piece.position.lerp(targetPos, positionLerpSpeed);

      // 旋转平滑插值
      const rotationLerpSpeed = magneticStrength * 0.2 * deltaTime * 60;
      piece.rotation.y = THREE.MathUtils.lerp(
        piece.rotation.y,
        slot.rotation.y,
        rotationLerpSpeed
      );

      // 完全吸附判定：距离和角度都足够接近
      if (dist < 0.1 && angle < 0.05) {
        piece.position.copy(targetPos);
        piece.rotation.y = slot.rotation.y;
        piece.userData.snapped = true;
        this.snappingPiece = null;
        this.snappingTarget = null;

        if (this.onSnapCallback) {
          this.onSnapCallback({ piece, slot });
        }
        return true;
      }
    } else {
      // 离开磁吸范围，清除状态
      this.snappingPiece = null;
      this.snappingTarget = null;
    }

    return false;
  }

  /**
   * 尝试吸附（立即判定版本，用于释放时）
   * @param {THREE.Mesh} piece - 构件对象
   * @returns {boolean} - 是否成功吸附
   */
  trySnap(piece) {
    const slot = this.slots.find(
      (s) => s.userData.slotId === piece.userData.slotId
    );
    if (!slot) return false;

    const dist = piece.position.distanceTo(slot.position);
    const angle = this.shortestAngleDiff(piece.rotation.y, slot.rotation.y);

    // 如果距离和角度都在阈值内，立即吸附
    if (dist < this.snapDistance && angle < this.snapAngleRad) {
      piece.position.copy(slot.position);
      piece.position.y = this.dragPlaneY + this.pieceHoverY;
      piece.rotation.y = slot.rotation.y;
      this.snappingTarget = slot;
      return true;
    }
    return false;
  }

  /**
   * 计算两个角度之间的最短差值（考虑周期性）
   * @param {number} a - 角度1（弧度）
   * @param {number} b - 角度2（弧度）
   * @returns {number} - 角度差值（绝对值，弧度）
   */
  shortestAngleDiff(a, b) {
    let d = (a - b) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return Math.abs(d);
  }

  /**
   * 高亮构件
   */
  highlight(obj, on) {
    // ✅ 修复：GLB模型可能是Group，需要遍历所有子对象来高亮
    if (!obj) return;
    
    const highlightColor = on ? 0x666666 : 0x000000;
    
    // 如果是Group，遍历所有子对象
    if (obj.children && obj.children.length > 0) {
      obj.traverse((child) => {
        if (child.isMesh && child.material) {
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materials.forEach((mat) => {
            if (mat.emissive) {
              mat.emissive.setHex(highlightColor);
            }
          });
        }
      });
    } else if (obj.isMesh && obj.material) {
      // 直接是Mesh
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      materials.forEach((mat) => {
        if (mat.emissive) {
          mat.emissive.setHex(highlightColor);
        }
      });
    }
  }

  /**
   * 高亮所有构件
   */
  highlightAll(on) {
    this.pieces.forEach((p) => this.highlight(p, on));
  }

  /**
   * 鼠标按下处理
   */
  onMouseDown(ndc) {
    console.log("[InteractionManager] 🔍 鼠标点击检测:", {
      ndc: `(${ndc.x.toFixed(3)}, ${ndc.y.toFixed(3)})`,
      piecesCount: this.pieces.length,
      dragPlaneY: this.dragPlaneY,
      depthPlane: this.depthPlane
    });
    
    this.mouseNDC.copy(ndc);
    this.raycaster.setFromCamera(this.mouseNDC, this.camera);

    // ✅ 修复模型交互：使用recursive: true以检测GLB模型的子对象
    const hits = this.raycaster.intersectObjects(this.pieces, true);
    
    console.log("[InteractionManager] 🔍 射线检测结果:", {
      hitsCount: hits.length,
      firstHit: hits[0] ? {
        object: hits[0].object.constructor.name,
        distance: hits[0].distance.toFixed(3),
        point: `(${hits[0].point.x.toFixed(2)}, ${hits[0].point.y.toFixed(2)}, ${hits[0].point.z.toFixed(2)})`
      } : null
    });
    
    if (!hits.length) {
      console.warn("[InteractionManager] ⚠️ 未检测到构件点击，尝试备用方案...");
      
      // ✅ 修复：如果直接点击检测不到，尝试使用深度平面映射找到附近的构件
      const hitPoint = this.mapNDCTo3D(ndc);
      if (hitPoint) {
        console.log("[InteractionManager] 💡 使用平面映射找到点:", hitPoint);
        // 检查是否有构件在附近（2.0单位内）
        let nearestPiece = null;
        let nearestDist = Infinity;
        for (const piece of this.pieces) {
          if (piece.userData.snapped || piece.userData.isInteractive === false) continue;
          const dist = piece.position.distanceTo(hitPoint);
          if (dist < 2.0 && dist < nearestDist) {
            nearestDist = dist;
            nearestPiece = piece;
          }
        }
        if (nearestPiece) {
          console.log(`[InteractionManager] ✅ 找到附近构件: ${nearestPiece.userData.displayName || nearestPiece.userData.pieceId} (距离: ${nearestDist.toFixed(2)})`);
          this.mouseSelected = nearestPiece;
          this.mouseDragging = true;
          this.highlightAll(false);
          this.highlight(this.mouseSelected, true);
          this.mouseDragOffset.copy(hitPoint).sub(this.mouseSelected.position);
          if (this.onHighlightCallback) {
            this.onHighlightCallback({ piece: this.mouseSelected, on: true });
          }
          return this.mouseSelected;
        } else {
          console.warn("[InteractionManager] ⚠️ 附近没有找到可交互的构件");
          console.warn("  提示：尝试点击构件本身，或使用滚轮调整深度平面");
        }
      } else {
        console.warn("[InteractionManager] ⚠️ 无法映射到3D坐标");
      }
      return null;
    }

    // ✅ 修复鼠标拖拽：找到实际的piece对象（可能是子对象）
    let obj = hits[0].object;
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/aa6999dc-f03f-450f-a3b9-6dcf420c0b8f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'InteractionManager.js:431',message:'before parent traversal',data:{objType:obj?.constructor?.name,hasPieceId:!!obj?.userData?.pieceId,hasParent:!!obj?.parent},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
    // #endregion
    
    while (obj && obj.userData.pieceId === undefined && obj.parent) {
      obj = obj.parent;
    }
    
    // 如果还是找不到pieceId，尝试从this.pieces中找到包含这个对象的piece
    if (!obj || obj.userData.pieceId === undefined) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/aa6999dc-f03f-450f-a3b9-6dcf420c0b8f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'InteractionManager.js:437',message:'searching in pieces array',data:{piecesCount:this.pieces.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
      // #endregion
      
      for (const piece of this.pieces) {
        piece.traverse((child) => {
          if (child === hits[0].object || child === hits[0].object.parent) {
            obj = piece;
          }
        });
      }
    }
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/aa6999dc-f03f-450f-a3b9-6dcf420c0b8f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'InteractionManager.js:447',message:'after piece search',data:{foundObj:!!obj,hasPieceId:!!obj?.userData?.pieceId,pieceId:obj?.userData?.pieceId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
    // #endregion
    
    if (!obj || obj.userData.pieceId === undefined) {
      console.error("[InteractionManager] ❌ 无法找到有效的piece对象");
      console.error("  点击的对象:", hits[0].object);
      console.error("  对象类型:", hits[0].object.constructor.name);
      console.error("  userData:", hits[0].object.userData);
      return null;
    }
    
    if (obj.userData.snapped) {
      console.log("[InteractionManager] 构件已拼好，不允许拖拽");
      return null; // 已拼好不允许拖
    }
    if (obj.userData.isInteractive === false) {
      console.log("[InteractionManager] 构件不可交互");
      return null;
    }
    if (this.grabbed) {
      console.log("[InteractionManager] 手势正在抓取，不让鼠标抢控制");
      return null; // 手势正在抓取，不让鼠标抢控制
    }

    console.log(`[InteractionManager] ✅ 鼠标选中构件: ${obj.userData.displayName || obj.userData.pieceId}`);
    this.mouseSelected = obj;
    this.mouseDragging = true;

    this.highlightAll(false);
    this.highlight(this.mouseSelected, true);

    const hitPoint = this.mapNDCTo3D(this.mouseNDC);
    if (hitPoint) {
      this.mouseDragOffset.copy(hitPoint).sub(this.mouseSelected.position);
      console.log("[InteractionManager] ✅ 拖拽偏移计算:", {
        hitPoint: `(${hitPoint.x.toFixed(2)}, ${hitPoint.y.toFixed(2)}, ${hitPoint.z.toFixed(2)})`,
        piecePos: `(${this.mouseSelected.position.x.toFixed(2)}, ${this.mouseSelected.position.y.toFixed(2)}, ${this.mouseSelected.position.z.toFixed(2)})`,
        offset: `(${this.mouseDragOffset.x.toFixed(2)}, ${this.mouseDragOffset.y.toFixed(2)}, ${this.mouseDragOffset.z.toFixed(2)})`
      });
    } else {
      console.warn("[InteractionManager] ⚠️ 无法映射到3D坐标，使用默认偏移");
      this.mouseDragOffset.set(0, 0, 0);
    }

    if (this.onHighlightCallback) {
      this.onHighlightCallback({ piece: this.mouseSelected, on: true });
    }

    return this.mouseSelected;
  }

  /**
   * 鼠标移动处理
   */
  onMouseMove(ndc) {
    if (!this.mouseDragging || !this.mouseSelected) return;

    this.mouseNDC.copy(ndc);
    
    const hitPoint = this.mapNDCTo3D(this.mouseNDC);
    if (hitPoint) {
      // ✅ 修复：正确计算新位置（减去偏移量）
      this.mouseSelected.position.copy(hitPoint).sub(this.mouseDragOffset);
      // 确保构件在拖拽平面上方
      this.mouseSelected.position.y = this.dragPlaneY + this.pieceHoverY;
    } else {
      console.warn("[InteractionManager] ⚠️ 鼠标移动时无法映射到3D坐标");
    }
  }

  /**
   * 鼠标释放处理
   */
  onMouseUp() {
    if (!this.mouseSelected) {
      this.mouseDragging = false;
      return false;
    }

    this.highlight(this.mouseSelected, false);
    if (this.onHighlightCallback) {
      this.onHighlightCallback({ piece: this.mouseSelected, on: false });
    }

    const snapped = this.trySnap(this.mouseSelected);
    if (snapped) {
      this.mouseSelected.userData.snapped = true;
      if (this.onSnapCallback) {
        this.onSnapCallback({ piece: this.mouseSelected, slot: this.snappingTarget });
      }
    }

    this.mouseSelected = null;
    this.mouseDragging = false;
    return snapped;
  }

  /**
   * 鼠标滚轮处理（用于旋转构件）
   */
  onMouseWheel(delta) {
    if (!this.mouseSelected) return;
    this.mouseSelected.rotation.y += (delta > 0 ? 1 : -1) * this.rotateStep;
  }

  /**
   * 获取当前抓取的构件
   */
  getGrabbed() {
    return this.grabbed || this.mouseSelected;
  }

  /**
   * 设置吸附回调
   */
  onSnap(callback) {
    this.onSnapCallback = callback;
  }

  /**
   * 设置高亮回调
   */
  onHighlight(callback) {
    this.onHighlightCallback = callback;
  }

  /**
   * 获取当前深度平面值
   */
  getDepthPlane() {
    return this.depthPlane;
  }

  /**
   * ✅ 修复模型交互：更新pieces引用（模型异步加载后调用）
   * @param {Array} newPieces - 新的构件数组
   */
  updatePiecesReference(newPieces) {
    this.pieces = newPieces;
    console.log(`[InteractionManager] ✅ 已更新pieces引用，当前构件数量: ${newPieces.length}`);
  }

  /**
   * ✅ 修复模型交互：更新slots引用（模型异步加载后调用）
   * @param {Array} newSlots - 新的槽位数组
   */
  updateSlotsReference(newSlots) {
    this.slots = newSlots;
    console.log(`[InteractionManager] ✅ 已更新slots引用，当前槽位数量: ${newSlots.length}`);
  }
}

