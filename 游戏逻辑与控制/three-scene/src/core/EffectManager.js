import * as THREE from "three";

/**
 * EffectManager - 特效管理模块
 * 职责：粒子特效、光圈特效、音效播放
 */
export class EffectManager {
  constructor(scene, config = {}) {
    this.scene = scene;
    this.dragPlaneY = config.dragPlaneY ?? 0.0;

    // 特效组
    this.fxGroup = new THREE.Group();
    this.fxItems = []; // { obj, t, life, type, extra }

    // 音效
    this.sfxSnap = new Audio("/snap.mp3");
    this.sfxWin = new Audio("/win(2).mp3");
    this.sfxSnap.volume = 0.6;
    this.sfxWin.volume = 0.8;

    // 添加到场景
    this.scene.add(this.fxGroup);
  }

  /**
   * 生成光圈扩散特效
   * @param {THREE.Vector3} worldPos - 世界坐标位置
   * @param {Object} options - 配置选项
   */
  spawnRingFx(worldPos, { life = 0.35, start = 0.2, end = 1.6 } = {}) {
    const geo = new THREE.RingGeometry(0.35, 0.55, 48);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(geo, mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(worldPos);
    ring.position.y += 0.02;

    ring.scale.setScalar(start);

    this.fxGroup.add(ring);
    this.fxItems.push({ obj: ring, t: 0, life, type: "ring", extra: { start, end } });
  }

  /**
   * 生成碎点爆开特效
   * @param {THREE.Vector3} worldPos - 世界坐标位置
   * @param {Object} options - 配置选项
   */
  spawnBurstFx(worldPos, { life = 0.6, count = 22, speed = 2.2 } = {}) {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      // 初始点在中心附近
      positions[i * 3 + 0] = worldPos.x;
      positions[i * 3 + 1] = worldPos.y + 0.25;
      positions[i * 3 + 2] = worldPos.z;

      // 随机速度（上抛 + 四散）
      const vx = (Math.random() * 2 - 1) * speed;
      const vy = (Math.random() * 0.9 + 0.6) * speed;
      const vz = (Math.random() * 2 - 1) * speed;

      velocities[i * 3 + 0] = vx;
      velocities[i * 3 + 1] = vy;
      velocities[i * 3 + 2] = vz;
    }

    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.06,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    const pts = new THREE.Points(geo, mat);

    this.fxGroup.add(pts);
    this.fxItems.push({ obj: pts, t: 0, life, type: "burst", extra: { velocities } });
  }

  /**
   * 吸附成功特效
   */
  spawnSnapFx(worldPos) {
    this.spawnRingFx(worldPos, { life: 0.28, start: 0.25, end: 1.35 });
    this.sfxSnap.currentTime = 0;
    this.sfxSnap.play().catch(() => {});
  }

  /**
   * 完成特效
   */
  spawnWinFx() {
    const center = new THREE.Vector3(0, this.dragPlaneY + 0.2, 0);
    this.spawnRingFx(center, { life: 0.55, start: 0.2, end: 2.8 });
    this.spawnBurstFx(center, { life: 0.75, count: 26, speed: 1.8 });
    this.sfxWin.currentTime = 0;
    this.sfxWin.play().catch(() => {});
  }

  /**
   * 每帧更新特效
   * @param {number} dt - 帧时间差（秒）
   */
  update(dt) {
    for (let i = this.fxItems.length - 1; i >= 0; i--) {
      const it = this.fxItems[i];
      it.t += dt;
      const p = Math.min(1, it.t / it.life);

      if (it.type === "ring") {
        const { start, end } = it.extra;
        const s = start + (end - start) * p;
        it.obj.scale.setScalar(s);
        it.obj.material.opacity = 0.9 * (1 - p);
      } else if (it.type === "burst") {
        const posAttr = it.obj.geometry.getAttribute("position");
        const v = it.extra.velocities;

        for (let k = 0; k < posAttr.count; k++) {
          // 简单重力 + 阻尼
          v[k * 3 + 1] -= 3.6 * dt;
          v[k * 3 + 0] *= 1 - 0.6 * dt;
          v[k * 3 + 1] *= 1 - 0.35 * dt;
          v[k * 3 + 2] *= 1 - 0.6 * dt;

          posAttr.array[k * 3 + 0] += v[k * 3 + 0] * dt;
          posAttr.array[k * 3 + 1] += v[k * 3 + 1] * dt;
          posAttr.array[k * 3 + 2] += v[k * 3 + 2] * dt;
        }

        posAttr.needsUpdate = true;
        it.obj.material.opacity = 0.9 * (1 - p);
      }

      if (p >= 1) {
        this.fxGroup.remove(it.obj);
        it.obj.geometry?.dispose?.();
        it.obj.material?.dispose?.();
        this.fxItems.splice(i, 1);
      }
    }
  }
}

