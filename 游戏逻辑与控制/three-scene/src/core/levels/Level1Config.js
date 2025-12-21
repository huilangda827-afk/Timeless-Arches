import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.module.js";

/**
 * Level1Config - 第一关斗拱配置
 * 根据垂直堆叠结构图配置
 */
export const level1Config = {
  // 吸附阈值
  snapThreshold: 0.3,

  // 基座配置（不可动）
  base: {
    modelPath: "大斗-底层.glb",
    targetPosition: new THREE.Vector3(0, 0, 0), // 基座位置
    targetRotation: new THREE.Euler(0, 0, 0),
    isInteractive: false, // 基座不可交互
    displayName: "大斗-底层",
  },

  // 构件配置（按堆叠顺序，从下到上）
  pieces: [
    {
      // Layer 1: 正心瓜拱-中层
      modelPath: "正心瓜拱-中层.glb",
      targetPosition: new THREE.Vector3(0, 0.6, 0), // 预估位置，需要校准
      targetRotation: new THREE.Euler(0, 0, 0),
      isInteractive: true,
      pieceId: 0,
      slotId: 0, // 对应的槽位ID
      displayName: "正心瓜拱-中层",
      startPosition: new THREE.Vector3(-2, 0.6, -3), // 初始位置（散落状态）
    },
    {
      // Layer 2: 华拱高层
      modelPath: "华拱高层.glb",
      targetPosition: new THREE.Vector3(0, 1.2, 0), // 预估位置，需要校准
      targetRotation: new THREE.Euler(0, 0, 0),
      isInteractive: true,
      pieceId: 1,
      slotId: 1,
      displayName: "华拱高层",
      startPosition: new THREE.Vector3(0, 1.2, -3),
    },
    {
      // Layer 3: 散枓左上角（注意：实际文件名是"散枓"，不是"散斗"）
      modelPath: "散枓-左上角.glb", // ✅ 修复：使用实际文件名
      targetPosition: new THREE.Vector3(-0.5, 1.8, 0), // 预估位置，需要校准（左侧）
      targetRotation: new THREE.Euler(0, 0, 0),
      isInteractive: true,
      pieceId: 2,
      slotId: 2,
      displayName: "散枓左上角",
      startPosition: new THREE.Vector3(-3, 1.8, -3),
    },
    {
      // Layer 3: 散枓右上角（注意：实际文件名是"散枓"，不是"散斗"）
      modelPath: "散枓-右上角.glb", // ✅ 修复：使用实际文件名
      targetPosition: new THREE.Vector3(0.5, 1.8, 0), // 预估位置，需要校准（右侧）
      targetRotation: new THREE.Euler(0, 0, 0),
      isInteractive: true,
      pieceId: 3,
      slotId: 3,
      displayName: "散枓右上角",
      startPosition: new THREE.Vector3(3, 1.8, -3),
    },
  ],

  // 关卡元数据
  metadata: {
    levelId: 1,
    levelName: "第一关：基础斗拱拼接",
    description: "学习传统斗拱结构的基础拼接",
    targetCount: 4, // 需要拼接的构件数量
  },
};

