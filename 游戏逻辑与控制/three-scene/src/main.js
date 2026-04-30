/**
 * 斗拱拼装游戏 - 主入口文件
 * 
 * 功能：
 * - 加载背景环境和幽灵参照物
 * - 解析目标位置（从幽灵组件）
 * - 加载玩家可交互组件
 * - 实现手势/鼠标拖拽和自动吸附
 */

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { HandInput } from "./core/HandInput.js";

// ===================== 全局变量 =====================
let scene, camera, renderer, controls;
let handInput;
let gltfLoader = new GLTFLoader();

// 场景对象
let environmentModel = null; // 背景版.glb
let ghostModel = null;       // 幽灵组件.glb（半透明目标参照，含 partID 解析）
let showcaseModel = null;    // 实体成品 GLB（仅展示，第二关起摆在拼接区旁）
let interactivePieces = [];  // 玩家可交互的组件数组
let TARGET_CONFIG = {};      // 目标位置配置字典

// 手势/拖拽状态
// ⭐⭐ 光标视觉风格：'B' = 指尖印记（朱砂点 + 极细金圈轮廓），'C' = 双点捏合（青玉双点合并）
//     改这一行字符串即可即时切换风格，无需其他改动 — 方便对比效果后回滚
let CURSOR_STYLE = 'B'; // 'B' = 单点+光环；'C' = 双点。可被设置面板/localStorage 覆盖

let cursorSphere;       // Group 容器（通用）
// 方案 C 专用引用
let cursorDotA;         // 左点（青玉）
let cursorDotB;         // 右点（青玉）
// 方案 B 专用引用
let cursorMain;         // 主点（朱砂红）
let cursorOutline;      // 极细金线轮廓圈

let cursorPinchProgress = 0; // 通用"抓取程度"进度（0=空闲，1=抓取），由 updateCursorPinchAnim 平滑驱动
let cursorPinchTarget = 0;   // 目标值（由 setCursorGrabState 设置）

// 方案 C 视觉常量（双点）
const CURSOR_DOT_GAP = 0.18;
const CURSOR_DOT_RADIUS = 0.05;
const CURSOR_COLOR_IDLE = 0x7ca6a8;
const CURSOR_COLOR_GRAB = 0xc8202c;

// 方案 B 视觉常量（指尖印记 — 参考图微调版）
const CURSOR_MAIN_RADIUS_B = 0.06;
const CURSOR_OUTLINE_INNER_B = 0.10;
const CURSOR_OUTLINE_OUTER_B = 0.108;
const CURSOR_COLOR_MAIN_IDLE_B = 0x9eb8bd;   // ⭐ 青灰柔和（替代原朱砂）
const CURSOR_COLOR_MAIN_GRAB_B = 0xff2a2a;   // 鲜朱砂（抓取态变亮更紧）
const CURSOR_COLOR_OUTLINE_B = 0xffd24a;
const CURSOR_B_SHOW_OUTLINE = false;         // ⭐ 默认隐藏金圈轮廓（参考图无金圈），改 true 即恢复

const CURSOR_PINCH_LERP = 0.20; // 状态插值速度（C/B 共用）

// 拖尾（参考图三态：松开浅蓝长拖尾 / 抓取红色短拖尾 / 成功金色由 spawnSnapPulse 接管）
const cursorTrail = [];
let trailFrameCounter = 0;
const TRAIL_SPAWN_INTERVAL_FRAMES = 4; // 第二关多模型同时渲染，trail 降密以保帧率
const TRAIL_MAX_COUNT = 8;             // 同上，从 16 降到 8
const CURSOR_COLOR_TRAIL_IDLE = 0xa8c4dc; // 浅冷青蓝（松开拖尾）
const CURSOR_COLOR_TRAIL_GRAB = 0xff5544; // 暖红（抓取拖尾）
const TRAIL_LIFETIME_IDLE_MS = 260;       // 松开 — 长（柔和飘逸）
const TRAIL_LIFETIME_GRAB_MS = 180;       // 抓取 — 短（紧凑聚焦），但要看得见
const TRAIL_OPACITY_IDLE = 0.55;          // 松开 — 柔和半透明
const TRAIL_OPACITY_GRAB = 0.85;          // 抓取 — 红色饱和度低需更亮才显眼
const TRAIL_RADIUS_IDLE = 0.025;          // 松开粒子大小
const TRAIL_RADIUS_GRAB = 0.035;          // 抓取粒子稍大，弥补短寿命

// 抓取瞬间脉冲环（仅 220ms，不常驻，替代原来的常驻金光晕）
const grabPulses = [];
let isGrabbing = false;
let grabbedObject = null;
let smoothCursorX = 0;
let smoothCursorY = 0;
let smoothCursorZ = 0.75; // ✅ 初始化Z轴平滑值（备料架Z=1.5和柱子Z=0之间）
const cursorSmoothAlpha = 0.35; // 平滑系数（值越大越跟手；0.35 比原来的 0.2 更跟手）

// 松手防抖：捏合断开持续达到这个帧数才视为真正松手，过滤 MediaPipe 阈值附近的抖动
const PINCH_RELEASE_DEBOUNCE_FRAMES = 5; // 约 80ms @60fps
let pinchOffFrames = 0;

// ✅ 放大模式：摄像机推进 + 灵敏度同步缩小，让小幅手势对应小幅光标位移，提升精细操作能力
// 数学：摄像机距离 ÷ 1.8，灵敏度 × 1/1.8 → 屏幕视觉范围基本不变，但手势"覆盖范围"缩小到 1/1.8，光标更精细
const ZOOM_FACTOR = 1.8;
const ZOOM_ANIM_DURATION = 280; // 推进/退出动画时长（ms）
let zoomEnabled = false;
let zoomAnimating = false; // 防止动画期间重复触发
const GESTURE_SENSITIVITY_X = 8.0; // 原写死 8.0，提取为常量便于 zoom 缩放
const GESTURE_SENSITIVITY_Y = 5.0; // 原 4.0 配合 +0.5 偏移光标只能到达 [0.5, 4.5]
                                    // 第二关 dock Y=0.1 永远够不到。改 5.0 + 偏移 -0.5 → [-0.5, 4.5] 全覆盖

// 吸附参数******
const SNAP_DISTANCE = 0.4; // 吸附阈值：构件离目标小于此值才能拼接成功
const INTENT_ZONE = 1.5;   // 意图区：松手时构件离目标超过此值，视为"还在搬运"，不算拼接尝试，无失败反馈
const SNAP_ANGLE_THRESHOLD = Math.PI / 2; // 角度阈值（可后续收紧，当前旋转操控未实现故保持宽松）

// 拼接顺序配置：每个子数组是一个步骤，同一步骤内的构件可任意顺序完成
// 前一步骤的所有构件必须全部完成，才能开始下一步骤
// ⚠️ 由 buildAssemblyOrder() 在幽灵模型解析完成后按 Y 坐标自动推导
let ASSEMBLY_ORDER = [];

// Y 坐标分层容差：两个目标点 Y 差值小于此值，视为同一层（可任意顺序）
// 当前模型 Y 差异极小（前 3 个仅 3cm），用 0.01 才能区分出大斗/正心瓜拱/华拱 各自独立的层
const ASSEMBLY_LAYER_Y_TOLERANCE = 0.01;

// ⚠️ 未来模型若命名不同 / 几何不规整 / Y 差距不可靠 时，可在此手写顺序覆盖自动推导
// 格式同 ASSEMBLY_ORDER：[ ['第1层构件1','第1层构件2'], ['第2层构件1'], ... ]
// 设为非空数组即生效；保持 null 则走自动推导
// 例：const MANUAL_ASSEMBLY_ORDER = [['大斗'], ['正心瓜拱'], ['华拱'], ['散科-左边','散科-右边']];
const MANUAL_ASSEMBLY_ORDER = null;

// ===================== 关卡配置（多关支持） =====================
// 每关的全部数据集中在这里。要加新关 → push 一个对象即可。
// 切关时 applyLevelConfig() 把这些字段同步到运行时使用的全局别名（PIECE_NAMES 等）
const LEVELS = [
  {
    id: 1,
    name: '单翘单昂平身科',
    ghostPath: '/models/幽灵组件.glb',
    showcasePath: null, // 第一关无独立的实体成品参照（幽灵已直接放在拼接区）
    piecePathPrefix: '/models/',
    pieceNames: ['大斗', '华拱', '正心瓜拱', '散科-左边', '散科-右边'],
    displayNames: {
      '大斗': '大斗',
      '华拱': '单翘',
      '正心瓜拱': '正心瓜拱',
      '散科-左边': '十八斗',
      '散科-右边': '槽升子',
    },
    pieceLore: {
      '大斗':       { brief: '柱头之上最底层的斗形构件，承托上方所有栱、昂、枋的总重量。' },
      '华拱':       { brief: '亦称"单翘"，由柱中向外伸出的弓形件，是斗拱悬挑外延的核心受力构件。' },
      '正心瓜拱':   { brief: '横置于大斗正中、形似短瓜的弧形小拱，承托上层正心枋与齐心斗。' },
      '散科-左边':  { brief: '即"十八斗"，斗口宽十八分故名，承托翘端两侧的拱、枋。' },
      '散科-右边':  { brief: '即"槽升子"，与十八斗对称，上口收为升状，承托外侧令拱。' },
    },
    finishLore: {
      title: '单翘单昂平身科',
      subtitle: '一翘三升 · 清代官式木构精髓',
      body: '单翘单昂平身科是清代官式建筑檐下最具代表性的小木作单元。"翘"为外伸悬挑的弓形件，"昂"为前低后高斜置的杠杆件，二者合力将屋顶重量层层传至柱身。此式属《工部工程做法则例》"五彩单翘单昂"，常见于殿宇、廊庑檐下，是清代营造技艺的精炼缩影。',
      source: '《工部工程做法则例》清·雍正',
    },
    manualAssemblyOrder: null, // null 表示自动按 Y 坐标推导
    targetOverrides: null,     // 第一关 ghost 含"配套"mesh，可自动提取，无需 overrides
    ghostAlwaysVisible: false, // 第一关靠按 H 提示按需显示，ghost 默认隐藏
    ghostOpacity: 0.4,
    environmentPath: '/models/背景版.glb',  // 第一关背景：岛屿 + 山体 + 道具
    knowledgeImage: '/第一场景知识图.jpg',
    // 默认相机机位（按 V 键 / 进入关卡时自动到这里）
    cameraPos: { x: 6.0, y: 4.0, z: 6.0 },
    cameraTarget: { x: 0, y: 1.5, z: 0 },
    environmentScale: 1, // 第一关背景原始尺寸即合适
  },
  {
    id: 2,
    name: '北京紫禁城御花园万春亭',                 // 第二关正式名（沿用 GLB 原文件名作为路径）
    ghostPath: '/models/level2/宋金官府.glb',     // 整体成品 GLB（同时复用为半透明幽灵参照）
    showcasePath: '/models/level2/宋金官府.glb', // 实体成品（实色摆在拼接区旁作展示）
    showcasePosition: { x: -3.5, y: 0, z: 0 },    // 实体成品摆位（拼接区左侧）
    piecePathPrefix: '/models/level2/',
    // 6 个拼接单位（每个是若干部件的合集，由组员在 Blender 内合并导出）
    pieceNames: [
      '组件集合壹', '组件集合贰', '组件集合叁',
      '组件集合肆', '组件集合伍', '组件集合陆',
    ],
    displayNames: {
      '组件集合壹': '集合壹',
      '组件集合贰': '集合贰',
      '组件集合叁': '集合叁',
      '组件集合肆': '集合肆',
      '组件集合伍': '集合伍',
      '组件集合陆': '集合陆',
    },
    pieceLore: {
      '组件集合壹': { brief: '含：撩檐榑 · 压槽枋 · 罗汉枋 · 替木' },
      '组件集合贰': { brief: '含：乳栿 · 耍头里转 · 齐心斗 · 蚂蚱头 · 耍头 · 慢拱 · 令拱' },
      '组件集合叁': { brief: '含：柱头枋 · 㭼头 · 交互斗（隔口包耳）· 琴面昂（下折假昂）· 瓜子拱' },
      '组件集合肆': { brief: '含：柱头枋 · 琴面昂 · 散斗 · 交互斗' },
      '组件集合伍': { brief: '含：泥道拱 · 栌斗（四耳栌斗）· 阑额 · 普拍枋' },
      '组件集合陆': { brief: '含：木栓' },
    },
    finishLore: {
      title: '北京紫禁城御花园万春亭',
      subtitle: '清代官式 · 皇家园林斗拱精品',
      body: '万春亭位于紫禁城御花园东北隅，与西侧千秋亭对称，为清乾隆时期所建方形重檐攒尖小亭。檐下采用多层斗拱铺作：自栌斗起，逐层挑出琴面昂、瓜子拱、慢拱、令拱、蚂蚱头与耍头，由替木与撩檐榑承托上檐之重。其中"隔口包耳"交互斗、"下折假昂"琴面昂等做法，皆为清官式建筑的典型工艺，体现"立柱顶千斤、巧拱托万钧"的传统木构智慧。',
      source: '《故宫志·御花园》',
    },
    manualAssemblyOrder: null,
    environmentPath: '/models/level2/level2-scene.glb',
    knowledgeImage: '/models/level2/knowledgecard.JPG', // 第二关知识卡片（K 键 / 知识图按钮触发）
    // === 由 tools/calibrator.html 校准导出（v4: 2026-04-30 +dockOverrides）===
    targetOverrides: {
      '组件集合壹': {
        position: { x: 1.9159, y: 0.7432, z: -1.067 },
        quaternion: { x: 0, y: -0.8191, z: 0, w: 0.5736 },
        scale: { x: 0.3577, y: 0.3578, z: 0.3577 },
      },
      '组件集合贰': {
        position: { x: 1.9532, y: 0.6637, z: -1.0534 },
        quaternion: { x: -0.0101, y: -0.819, z: -0.0144, w: 0.5735 },
        scale: { x: 0.3578, y: 0.3578, z: 0.3578 },
      },
      '组件集合叁': {
        position: { x: 1.9532, y: 0.5842, z: -1.0534 },
        quaternion: { x: 0, y: -0.8191, z: 0, w: 0.5736 },
        scale: { x: 0.3577, y: 0.3578, z: 0.3577 },
      },
      '组件集合肆': {
        position: { x: 1.9532, y: 0.5445, z: -1.0534 },
        quaternion: { x: 0, y: 0.5736, z: 0, w: 0.8191 },
        scale: { x: 0.2385, y: 0.2385, z: 0.2385 },
      },
      '组件集合伍': {
        position: { x: 1.9532, y: 0.465, z: -1.0534 },
        quaternion: { x: 0, y: 0.5736, z: 0, w: 0.8191 },
        scale: { x: 0.3776, y: 0.3776, z: 0.3776 },
      },
      '组件集合陆': {
        position: { x: 1.9532, y: 0.3855, z: -1.0534 },
        quaternion: { x: 0, y: 0.5736, z: 0, w: 0.8191 },
        scale: { x: 0.3379, y: 0.3379, z: 0.3379 },
      },
    },
    // === 备料架坐标（v6: dock 朝向贴近 target，磁吸旋转幅度大幅减小）===
    dockOverrides: {
      '组件集合壹': {
        position: { x: 2, y: 2.4, z: -2 },
        quaternion: { x: 0, y: -0.866, z: 0, w: 0.5 },
        scale: { x: 0.35, y: 0.35, z: 0.35 },
      },
      '组件集合贰': {
        position: { x: 2, y: 2.5, z: 0.8 },
        quaternion: { x: 0, y: -0.7934, z: 0, w: 0.6088 },
        scale: { x: 0.35, y: 0.35, z: 0.35 },
      },
      '组件集合叁': {
        position: { x: 2.5, y: 1.9, z: -0.2 },
        quaternion: { x: 0, y: -0.866, z: 0, w: 0.5 },
        scale: { x: 0.35, y: 0.35, z: 0.35 },
      },
      '组件集合肆': {
        position: { x: 2.5, y: 2.4, z: -1.5 },
        quaternion: { x: 0.0338, y: 0.9577, z: 0.1261, w: 0.2566 },
        scale: { x: 0.35, y: 0.35, z: 0.35 },
      },
      '组件集合伍': {
        position: { x: 3.2, y: 1.9, z: -1.2 },
        quaternion: { x: 0, y: 0.3827, z: 0, w: 0.9239 },
        scale: { x: 0.35, y: 0.35, z: 0.35 },
      },
      '组件集合陆': {
        position: { x: 3.2, y: 1.5, z: 0 },
        quaternion: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 0.35, y: 0.35, z: 0.35 },
      },
    },
    environmentTransform: {
      position: { x: -0.1, y: 0.1, z: -0.5 },
      quaternion: { x: 0, y: 0.6088, z: 0, w: 0.7934 },
      scale: { x: 3.35, y: 3.35, z: 3.35 },
    },
    showcaseTransform: {
      position: { x: 1.5, y: 0.4, z: 1.3 },
      quaternion: { x: 0, y: 0.7934, z: 0, w: 0.6088 },
      scale: { x: 0.4, y: 0.4, z: 0.4 },
    },
    ghostTransform: {
      position: { x: 1.9, y: 0.4, z: -1.2 },
      quaternion: { x: 0, y: 0.2164, z: 0, w: 0.9763 },
      scale: { x: 0.45, y: 0.45, z: 0.45 },
    },
    // 方案 C：第二关不显示半透明幽灵，玩家靠左侧实物 showcase + H 键提示
    ghostAlwaysVisible: false,
    ghostOpacity: 0.35,
    // 复用第一关默认机位 → 所有交互参数（手势/吸附/提示）自动复用
    cameraPos: { x: 6.0, y: 4.0, z: 6.0 },
    cameraTarget: { x: 0, y: 1.5, z: 0 },
  },
];

// 从 URL 参数读取初始关卡（门户跳转过来：forge.html?level=2 进入万春亭）
function _parseInitialLevelIndex() {
  try {
    const v = new URLSearchParams(location.search).get('level');
    if (!v) return 0;
    const id = parseInt(v, 10);
    if (Number.isNaN(id)) return 0;
    const idx = LEVELS.findIndex((L) => L.id === id);
    return idx >= 0 ? idx : 0;
  } catch (_) {
    return 0;
  }
}
let currentLevelIndex = _parseInitialLevelIndex();
let currentLevel = LEVELS[currentLevelIndex];

// 兼容旧代码：这些"全局变量"指向当前关卡字段，切关时由 applyLevelConfig() 重赋值
let PIECE_NAMES = currentLevel.pieceNames;
let DISPLAY_NAMES = currentLevel.displayNames;
let PIECE_LORE = currentLevel.pieceLore;
let FINISH_CARD_LORE = currentLevel.finishLore;

function getDisplayName(partID) {
  return DISPLAY_NAMES[partID] || partID;
}
function getPieceLore(partID) {
  return PIECE_LORE[partID]?.brief || '';
}

/** 把指定关卡的配置同步到运行时全局别名 */
function applyLevelConfig(index) {
  currentLevelIndex = index;
  currentLevel = LEVELS[index];
  PIECE_NAMES = currentLevel.pieceNames;
  DISPLAY_NAMES = currentLevel.displayNames;
  PIECE_LORE = currentLevel.pieceLore;
  FINISH_CARD_LORE = currentLevel.finishLore;
  // 同步本关默认机位（"复位 V"按钮 + loadLevel 自动用此机位）
  if (currentLevel.cameraPos) {
    DEFAULT_CAMERA_POS.set(currentLevel.cameraPos.x, currentLevel.cameraPos.y, currentLevel.cameraPos.z);
  }
  if (currentLevel.cameraTarget) {
    DEFAULT_CAMERA_TARGET.set(currentLevel.cameraTarget.x, currentLevel.cameraTarget.y, currentLevel.cameraTarget.z);
  }
  console.log(`[Level] 应用配置: ${currentLevel.name} (id=${currentLevel.id}) · cam=${DEFAULT_CAMERA_POS.toArray().map(v=>v.toFixed(2)).join(',')}`);
}

// 音效
let audioSnap = null;
let audioWin = null;
let audioFailure = null;

// 完成特效：金色粒子环绕（在 checkAllComplete 后启动）
const victoryParticles = []; // 数组元素：{ mesh, angle, radius, vy, angularSpeed, startTime, lifetime }
let victoryEffectActive = false;

// 完成后摄像机绕飞：5.2 秒缓慢转一圈，期间禁用 OrbitControls
let flyAroundActive = false;
const FLY_AROUND_DURATION = 5200; // ms
let flyAroundEnabled = true; // 设置面板里可关

// 默认机位（init 时记录，"复位 V" 按钮平滑回到这里）
const DEFAULT_CAMERA_POS = new THREE.Vector3(6.0, 4.0, 6.0);
const DEFAULT_CAMERA_TARGET = new THREE.Vector3(0, 1.5, 0);
const CAMERA_RESET_DURATION = 700; // ms
let cameraResetting = false;

// 背景音乐（江上清风游）
let audioBGM = null;
let bgmEnabled = true;
let bgmVolume = 0.35; // 默认 BGM 比音效更轻

// 设置面板可调参数（可被 settings 面板写入并持久化到 localStorage）
let gestureSensitivityScale = 1.0; // 0.5 - 2.0，乘进 mapGestureTo3D
let audioVolume = 0.7;             // 0 - 1，应用到所有音效

// 环境粒子：常驻飘落的金色尘埃，营造匠心氛围（init 时一次性生成 N 颗，animate 里循环重用）
const AMBIENT_PARTICLE_COUNT = 35;
const ambientParticles = [];
let ambientParticlesEnabled = true; // 设置面板里可关
let _ambientLastTime = performance.now();

// 停靠区配置（组件初始位置）- 已改为线性排列
// 实际使用：startX = -4, gap = 2, height = 1.5, depth = 3.0
const DOCKING_AREA = {
  startX: -4,    // 起始X位置
  gap: 2,        // 组件间距
  height: 1.5,   // 基准高度
  depth: 3.0     // 前后位置
};

// ===================== 初始化 =====================
async function init() {
  // 提前读取持久化的光标风格（必须在创建 cursorDotA/cursorMain 之前读取）
  try {
    const raw = localStorage.getItem(SETTINGS_LS_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data.cursorStyle === 'B' || data.cursorStyle === 'C') {
        CURSOR_STYLE = data.cursorStyle;
      }
    }
  } catch (e) {}

  // 创建场景
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a1a);

  // 创建相机 - 拉近镜头聚焦工作台
  camera = new THREE.PerspectiveCamera(
    50, // ✅ 修改FOV为50，获得更好的透视感（从60改为50）
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  // 应用初始关卡（默认 LEVELS[0]，URL ?level=N 解析后可能是其他关）
  applyLevelConfig(currentLevelIndex);
  camera.position.copy(DEFAULT_CAMERA_POS);

  // 创建渲染器
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  
  // 设置渲染器样式 - 占80%页面高度
  renderer.domElement.style.position = 'fixed';
  renderer.domElement.style.top = '10%'; // 顶部留10%
  renderer.domElement.style.left = '0';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '80%'; // 占80%高度
  renderer.domElement.style.zIndex = '0';
  renderer.domElement.style.pointerEvents = 'none';
  
  document.body.appendChild(renderer.domElement);

  // 创建轨道控制器
  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(DEFAULT_CAMERA_TARGET); // 由 applyLevelConfig(0) 同步过来
  controls.minDistance = 2;
  controls.maxDistance = 20;
  controls.maxPolarAngle = Math.PI / 2; // 防止钻入地底
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.enableZoom = true; // ✅ 确保鼠标滚轮缩放启用
  controls.zoomSpeed = 1.0; // ✅ 缩放速度
  controls.enablePan = true; // ✅ 允许平移
  controls.enableRotate = true; // ✅ 允许旋转
  controls.panSpeed = 1.2; // ✅ 平移速度（含键盘平移）
  controls.keyPanSpeed = 12; // ✅ 方向键每次按下平移的像素数（默认 7，调大让一次响应更明显）
  // ⭐ 必须显式监听键盘事件，否则方向键不响应（OrbitControls 默认不监听全局键盘）
  controls.listenToKeyEvents(window);
  controls.update(); // 立即更新
  
  // ✅ 注意：OrbitControls 会自动处理滚轮事件
  // 只要 renderer.domElement.style.pointerEvents = 'auto'，滚轮就能正常工作

  // 添加光照
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
  directionalLight.position.set(5, 10, 5);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = 50;
  directionalLight.shadow.camera.left = -10;
  directionalLight.shadow.camera.right = 10;
  directionalLight.shadow.camera.top = 10;
  directionalLight.shadow.camera.bottom = -10;
  scene.add(directionalLight);

  // ⭐ 光标根据 CURSOR_STYLE 走不同分支：'B' 指尖印记 / 'C' 双点捏合
  cursorSphere = new THREE.Group();
  cursorSphere.position.set(0, 2, 0.75);
  cursorSphere.visible = false;
  cursorSphere.renderOrder = 999;

  if (CURSOR_STYLE === 'C') {
    // ── 方案 C：双点捏合 ──
    const dotGeo = new THREE.SphereGeometry(CURSOR_DOT_RADIUS, 16, 16);
    const makeDotMat = () =>
      new THREE.MeshBasicMaterial({
        color: CURSOR_COLOR_IDLE,
    transparent: true,
        opacity: 0.92,
        depthTest: false,
        depthWrite: false,
      });

    cursorDotA = new THREE.Mesh(dotGeo, makeDotMat());
    cursorDotA.position.x = -CURSOR_DOT_GAP / 2;
    cursorDotA.renderOrder = 1000;
    cursorSphere.add(cursorDotA);

    cursorDotB = new THREE.Mesh(dotGeo.clone(), makeDotMat());
    cursorDotB.position.x = CURSOR_DOT_GAP / 2;
    cursorDotB.renderOrder = 1000;
    cursorSphere.add(cursorDotB);
  } else if (CURSOR_STYLE === 'B') {
    // ── 方案 B：指尖印记（朱砂主点 + 极细金圈轮廓）──
    cursorMain = new THREE.Mesh(
      new THREE.SphereGeometry(CURSOR_MAIN_RADIUS_B, 16, 16),
      new THREE.MeshBasicMaterial({
        color: CURSOR_COLOR_MAIN_IDLE_B,
        transparent: true,
        opacity: 0.85,
        depthTest: false,
        depthWrite: false,
      })
    );
    cursorMain.renderOrder = 1000;
    cursorSphere.add(cursorMain);

    // 极细金线轮廓圈（只 0.008 厚），始终面向相机做 billboard
    cursorOutline = new THREE.Mesh(
      new THREE.RingGeometry(CURSOR_OUTLINE_INNER_B, CURSOR_OUTLINE_OUTER_B, 48),
      new THREE.MeshBasicMaterial({
        color: CURSOR_COLOR_OUTLINE_B,
        transparent: true,
        opacity: 0.40,
        side: THREE.DoubleSide,
        depthTest: false,
        depthWrite: false,
      })
    );
    cursorOutline.renderOrder = 999;
    cursorSphere.add(cursorOutline);
  }

  scene.add(cursorSphere);

  // 初始化手势输入
  handInput = new HandInput();

  // 初始化音效
  try {
    audioSnap = new Audio('/snap.mp3');
    audioSnap.volume = 0.6;
    audioWin = new Audio('/win (2).mp3');
    audioWin.volume = 0.7;
    audioFailure = new Audio('/failure.mp3');
    audioFailure.volume = 0.6;
    // BGM：江上清风游（循环、轻量）
    audioBGM = new Audio('/江上清风游.mp3');
    audioBGM.loop = true;
    audioBGM.volume = bgmVolume; // 后续会被 applyAudioVolume 覆盖
    audioBGM.preload = 'auto';
    console.log('[Main] ✅ 音效 + BGM 已加载');
  } catch (error) {
    console.warn('[Main] ⚠️ 音效/BGM 加载失败:', error);
  }

  // 窗口大小调整
  window.addEventListener('resize', onWindowResize);

  // 绑定UI事件
  setupUIEvents();

  // 按顺序加载资源
  console.log('[Main] 开始加载游戏资源...');
  await loadEnvironment();
  await loadGhostReference();
  // 幽灵目标点解析完成后，自动按 Y 坐标推导拼接顺序（从下往上）
  buildAssemblyOrder();
  await loadInteractivePieces();

  console.log('[Main] ✅ 游戏初始化完成');
  
  // ✅ 调试：最终对账单 - 验证名称匹配
  console.log("=== [DEBUG] 最终对账单 - 名称匹配验证 ===");
  console.log("目标点数量:", Object.keys(TARGET_CONFIG).length);
  console.log("玩家组件数量:", interactivePieces.length);
  console.log("\n目标点列表:", Object.keys(TARGET_CONFIG));
  console.log("玩家组件列表:", interactivePieces.map(p => p.userData.partID));
  
  // 检查匹配情况
  const missingTargets = interactivePieces.filter(p => !TARGET_CONFIG[p.userData.partID]);
  const missingPieces = Object.keys(TARGET_CONFIG).filter(key => !interactivePieces.find(p => p.userData.partID === key));
  
  if (missingTargets.length > 0) {
    console.warn("⚠️ 以下组件没有对应的目标位置:", missingTargets.map(p => p.userData.partID));
  }
  if (missingPieces.length > 0) {
    console.warn("⚠️ 以下目标位置没有对应的组件:", missingPieces);
  }
  if (missingTargets.length === 0 && missingPieces.length === 0) {
    console.log("✅ 所有组件和目标位置都匹配！");
  }
  console.log("==================================");

  // 初始化 HUD 状态（显示第一个应拼构件）
  updateHUDStatus();

  // 初始化环境尘埃粒子（常驻氛围）
  initAmbientParticles();

  // 加载用户设置（在所有可控对象创建之后）并应用
  loadSettings();
  applyAudioVolume();
  // 同步粒子可见性（loadSettings 只改了标志位）
  setAmbientParticlesEnabled(ambientParticlesEnabled);
  // 应用持久化的光标风格（CURSOR_STYLE 是 const，但若设置不同则提示"刷新生效"——
  // 这里在面板里已说明，启动时不再重复提示）

  // 从门户带参数（?level=N）跳进来：自动跳过主菜单，直接进入游戏 HUD
  try {
    if (new URLSearchParams(location.search).get('level')) {
      setTimeout(() => {
        const btn = document.getElementById('btn-start');
        if (btn) btn.click();
      }, 250);
    }
  } catch (_) {}
}

// ===================== Step 1: 加载静态环境 =====================
async function loadEnvironment(pathOverride) {
  // 切换关卡时移除旧环境
  if (environmentModel) {
    scene.remove(environmentModel);
    environmentModel.traverse((c) => {
      if (c.isMesh) {
        c.geometry?.dispose();
        if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
        else c.material?.dispose();
      }
    });
    environmentModel = null;
  }
  const envPath = pathOverride || (currentLevel && currentLevel.environmentPath) || '/models/背景版.glb';
  return new Promise((resolve, reject) => {
    console.log(`[Main] 加载背景环境: ${envPath}`);
    gltfLoader.load(
      envPath,
      (gltf) => {
        const model = gltf.scene;
        model.position.set(0, 0, 0); // 世界原点对齐
        
        // 阴影策略：背景大模型只接收阴影（地面接 piece 阴影），不投射阴影
        // 原版 castShadow=true 会让山体/岛屿投射 shadow map，第二关 3.35x 缩放后开销翻倍
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = false; // 背景不投射（性能）
            child.receiveShadow = true; // 仍能接收 piece 投下来的阴影（视觉）
          }
        });
        
        // 应用关卡 transform（优先 environmentTransform，否则退化到旧 environmentScale）
        const envT = currentLevel && currentLevel.environmentTransform;
        if (envT) {
          if (envT.position) model.position.set(envT.position.x, envT.position.y, envT.position.z);
          if (envT.quaternion) model.quaternion.set(envT.quaternion.x, envT.quaternion.y, envT.quaternion.z, envT.quaternion.w);
          if (envT.scale) model.scale.set(envT.scale.x, envT.scale.y, envT.scale.z);
          console.log(`[Main] 背景 transform:`, envT);
        } else {
          const envScale = (currentLevel && currentLevel.environmentScale) || 1;
          if (envScale !== 1) {
            model.scale.setScalar(envScale);
            console.log(`[Main] 背景缩放: ×${envScale}`);
          }
        }
        
        environmentModel = model;
        environmentModel.userData.isStatic = true;
        environmentModel.userData.envPath = envPath;
        scene.add(environmentModel);
        
        console.log(`[Main] ✅ 背景环境已加载: ${envPath}`);
        resolve();
      },
      undefined,
      (error) => {
        console.error('[Main] ❌ 背景环境加载失败:', error);
        reject(error);
      }
    );
  });
}

// ===================== Step 2: 解析幽灵参照物 =====================
async function loadGhostReference() {
  const ghostPath = currentLevel.ghostPath;
  return new Promise((resolve, reject) => {
    console.log(`[Main] 加载幽灵参照物: ${ghostPath} (关卡:${currentLevel.name})`);
    gltfLoader.load(
      ghostPath,
      (gltf) => {
        const model = gltf.scene;
        // 应用关卡指定的 ghostTransform（仅影响视觉，不影响 targetOverrides 数据驱动的吸附）
        const gt = currentLevel.ghostTransform;
        if (gt) {
          if (gt.position) model.position.set(gt.position.x, gt.position.y, gt.position.z);
          if (gt.quaternion) model.quaternion.set(gt.quaternion.x, gt.quaternion.y, gt.quaternion.z, gt.quaternion.w);
          if (gt.scale) model.scale.set(gt.scale.x, gt.scale.y, gt.scale.z);
        } else {
          model.position.set(0, 0, 0);
        }

        // 分支 A：targetOverrides 不为空 → 用人工校准的目标配置（整体建模成品走这条路）
        // 分支 B：targetOverrides 为 null → 自动从 ghost 内部"配套"mesh 提取（第一关走这条路）
        if (currentLevel.targetOverrides) {
          console.log('[Main] 使用 targetOverrides 人工校准配置');
          for (const [baseName, t] of Object.entries(currentLevel.targetOverrides)) {
            TARGET_CONFIG[baseName] = {
              position: new THREE.Vector3(t.position.x, t.position.y, t.position.z),
              quaternion: new THREE.Quaternion(t.quaternion.x, t.quaternion.y, t.quaternion.z, t.quaternion.w),
              scale: t.scale ? new THREE.Vector3(t.scale.x, t.scale.y, t.scale.z) : null,
              isOccupied: false,
              originalNode: model,
            };
            console.log(`[Main] ✅ 注入目标位置（人工校准）: ${baseName}`, t.position, t.scale || '(scale=1)');
          }
        } else {
        model.traverse((node) => {
          if (node.isMesh && node.name && node.name.includes('配套')) {
            const baseName = node.name.replace('配套', '').trim();
            const worldPosition = new THREE.Vector3();
            const worldQuaternion = new THREE.Quaternion();
            node.getWorldPosition(worldPosition);
            node.getWorldQuaternion(worldQuaternion);
            TARGET_CONFIG[baseName] = {
              position: worldPosition.clone(),
              quaternion: worldQuaternion.clone(),
              isOccupied: false,
              originalNode: node
            };
              console.log(`[Main] ✅ 找到目标位置（自动）: ${baseName}`, worldPosition);
            }
          });
        }

        // 根据关卡配置决定 ghost 的可见性 + 半透明度
        if (currentLevel.ghostAlwaysVisible) {
          const op = currentLevel.ghostOpacity ?? 0.4;
          model.visible = true;
          model.traverse((node) => {
            if (node.isMesh && node.material) {
              // clone 材质避免影响其他实例
              node.material = node.material.clone();
              node.material.transparent = true;
              node.material.opacity = op;
              node.material.depthWrite = false; // 半透明叠加更稳定
            }
          });
          console.log(`[Main] ✅ 幽灵设为半透明虚色常驻显示 (opacity=${op})`);
        } else {
          model.visible = false; // 第一关：默认隐藏，靠按 H 显示 hint
        }
        ghostModel = model;
        scene.add(ghostModel);
        
        console.log('[Main] ✅ 幽灵参照物已解析，找到', Object.keys(TARGET_CONFIG).length, '个目标位置');
        
        // ✅ 调试：打印幽灵目标数据解析结果（对账单格式）
        console.log("=== [DEBUG] 幽灵目标数据解析结果 ===");
        console.log("目标点 (Target) 列表:");
        Object.keys(TARGET_CONFIG).forEach(key => {
          const target = TARGET_CONFIG[key];
          console.log(`  ${key} | 世界坐标 (${target.position.x.toFixed(3)}, ${target.position.y.toFixed(3)}, ${target.position.z.toFixed(3)})`);
        });
        console.log("==================================");
        
        resolve();
      },
      undefined,
      (error) => {
        console.error('[Main] ❌ 幽灵参照物加载失败:', error);
        reject(error);
      }
    );
  });
}

// ===================== Step 3: 生成玩家组件 =====================
async function loadInteractivePieces() {
  const prefix = currentLevel.piecePathPrefix || '/models/';
  const loadPromises = PIECE_NAMES.map((pieceName, index) => {
    return new Promise((resolve, reject) => {
      const url = `${prefix}${pieceName}.glb`;
      console.log(`[Main] 加载组件 [${index + 1}/${PIECE_NAMES.length}]: ${url}`);
      gltfLoader.load(
        url,
        (gltf) => {
          const model = gltf.scene;
          
          // ✅ 调试：检查模型原始缩放（Blender导出后应该是1.0）
          const originalScale = model.scale.clone();
          console.log(`[Main]   组件 ${pieceName} 原始缩放: [x:${originalScale.x.toFixed(3)}, y:${originalScale.y.toFixed(3)}, z:${originalScale.z.toFixed(3)}]`);
          
          // 身份绑定
          model.userData.partID = pieceName;
          model.userData.isSnapped = false;
          model.userData.isDraggable = true;
          
          // ✅ 调试：检查是否有对应的目标位置
          const target = TARGET_CONFIG[pieceName];
          if (target) {
            console.log(`[Main] ✅ 组件 ${pieceName} 有对应的目标位置:`, target.position);
          } else {
            console.warn(`[Main] ⚠️ 组件 ${pieceName} 没有对应的目标位置！可用目标:`, Object.keys(TARGET_CONFIG));
          }
          
          // ✅ 备料架布局：优先级 dockOverrides[pieceName] > 第一关硬编码 > 通用 fallback
          let dockPos;
          let dockQuat = null;
          let dockScale = null;
          const dockOv = currentLevel.dockOverrides && currentLevel.dockOverrides[pieceName];
          if (dockOv) {
            // 用校准器导出的备料架坐标（含 position / quaternion / scale）
            dockPos = new THREE.Vector3(dockOv.position.x, dockOv.position.y, dockOv.position.z);
            if (dockOv.quaternion) dockQuat = new THREE.Quaternion(dockOv.quaternion.x, dockOv.quaternion.y, dockOv.quaternion.z, dockOv.quaternion.w);
            if (dockOv.scale) dockScale = new THREE.Vector3(dockOv.scale.x, dockOv.scale.y, dockOv.scale.z);
            console.log(`[Main] ✅ ${pieceName} 使用 dockOverrides 备料架坐标`);
          } else if (pieceName === '散科-左边' || pieceName === '散科-右边') {
            const sideIndex = pieceName === '散科-左边' ? 0 : 1;
            dockPos = new THREE.Vector3(1.5 + sideIndex * 1.5, 1.2, 1.0);
          } else if (pieceName === '正心瓜拱') {
            dockPos = new THREE.Vector3(3.8, 1.0, 0.5);
          } else {
            const spacing = 1.2;
            const startX = 2.0;
            dockPos = new THREE.Vector3(startX + index * spacing, 1.0, 0.5);
          }
          
          model.position.copy(dockPos);
          model.userData.initialPosition = dockPos.clone();
          if (dockQuat) {
            model.quaternion.copy(dockQuat);
            model.userData.initialQuaternion = dockQuat.clone();
          }
          if (dockScale) {
            model.scale.copy(dockScale);
            model.userData.initialScale = dockScale.clone();
          }
          
          // ✅ 调试辅助：确保组件可见
          model.visible = true;
          
          // ✅ 调试：输出组件最终位置和缩放
          console.log(`[Main]   组件 ${pieceName} 已放置到备料架: 位置(${dockPos.x.toFixed(2)}, ${dockPos.y.toFixed(2)}, ${dockPos.z.toFixed(2)}), 缩放[${model.scale.x.toFixed(3)}, ${model.scale.y.toFixed(3)}, ${model.scale.z.toFixed(3)}]`);
          
          // 启用阴影
          let meshCount = 0;
          model.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              child.visible = true; // ✅ 确保所有子网格可见
              meshCount++;
              // ✅ 调试：输出每个Mesh的名称和可见性
              console.log(`[Main]     Mesh: ${child.name || '未命名'}, 可见: ${child.visible}, 位置: [${child.position.x.toFixed(2)}, ${child.position.y.toFixed(2)}, ${child.position.z.toFixed(2)}]`);
            }
          });
          
          // ✅ 调试：检查是否有Mesh
          if (meshCount === 0) {
            console.warn(`[Main] ⚠️ 组件 ${pieceName} 没有找到任何Mesh！`);
          } else {
            console.log(`[Main] ✅ 组件 ${pieceName} 包含 ${meshCount} 个Mesh`);
          }
          
          interactivePieces.push(model);
          scene.add(model);
          
          console.log(`[Main] ✅ 组件 ${pieceName} 已加载并添加到场景`);
          resolve();
        },
        undefined,
        (error) => {
          console.error(`[Main] ❌ 组件 ${pieceName} 加载失败:`, error);
          reject(error);
        }
      );
    });
  });
  
  await Promise.all(loadPromises);
  console.log('[Main] ✅ 所有玩家组件已加载到备料架');
  
  // ✅ 调试：打印玩家组件对账单
  console.log("=== [DEBUG] 玩家组件加载对账单 ===");
  console.log("玩家组件 (Part) 列表:");
  interactivePieces.forEach((piece) => {
    const partID = piece.userData.partID;
    const scale = piece.scale;
    console.log(`  ${partID} | 初始坐标 (${piece.position.x.toFixed(3)}, ${piece.position.y.toFixed(3)}, ${piece.position.z.toFixed(3)}) | 缩放比例 [${scale.x.toFixed(3)}, ${scale.y.toFixed(3)}, ${scale.z.toFixed(3)}]`);
  });
  console.log("==================================");
}

// ===================== Step 3.5: 实体成品参照（第二关起） =====================
/**
 * 加载实体成品 GLB（不可交互、仅作展示）。
 * 摆在拼接区左侧，作为玩家的"目标长什么样"的视觉参照。
 * 第一关 currentLevel.showcasePath 为 null，此函数静默返回。
 */
async function loadShowcaseModel() {
  if (!currentLevel.showcasePath) {
    showcaseModel = null;
    return;
  }
  return new Promise((resolve) => {
    console.log(`[Showcase] 加载实体成品: ${currentLevel.showcasePath}`);
    gltfLoader.load(
      currentLevel.showcasePath,
      (gltf) => {
        const model = gltf.scene;
        // 优先 showcaseTransform（含 position + quaternion + scale），退化到旧 showcasePosition
        const st = currentLevel.showcaseTransform;
        if (st) {
          if (st.position) model.position.set(st.position.x, st.position.y, st.position.z);
          if (st.quaternion) model.quaternion.set(st.quaternion.x, st.quaternion.y, st.quaternion.z, st.quaternion.w);
          if (st.scale) model.scale.set(st.scale.x, st.scale.y, st.scale.z);
        } else {
          const sp = currentLevel.showcasePosition || { x: -3.5, y: 0, z: 0 };
          model.position.set(sp.x, sp.y, sp.z);
        }
        model.traverse((node) => {
          if (node.isMesh && node.material) {
            node.material = node.material.clone();
            node.material.transparent = false;
            node.material.opacity = 1.0;
            // 性能：showcase 不参与阴影计算（避免大模型 shadow map 开销翻倍）
            node.castShadow = false;
            node.receiveShadow = false;
          }
        });
        showcaseModel = model;
        scene.add(showcaseModel);
        const tag = st ? 'transform' : `pos(${model.position.x.toFixed(2)},${model.position.y.toFixed(2)},${model.position.z.toFixed(2)})`;
        console.log(`[Showcase] ✅ 实体成品已就位 @ ${tag}`);
        resolve();
      },
      undefined,
      (err) => {
        console.warn(`[Showcase] ⚠️ 加载失败（路径未配置或文件缺失）: ${err.message || err}`);
        showcaseModel = null;
        resolve(); // 加载失败不阻塞游戏
      }
    );
  });
}

// ===================== 关卡切换 =====================
/**
 * 切换到指定关卡：清场 + 应用新配置 + 重新加载所有模型
 * @param {number} index LEVELS 数组下标
 */
async function loadLevel(index) {
  if (index < 0 || index >= LEVELS.length) {
    console.warn(`[Level] 无效关卡 index=${index}`);
    return;
  }

  console.log(`[Level] === 切换到关卡 ${index + 1}: ${LEVELS[index].name} ===`);
  showToast(`正在加载：${LEVELS[index].name}…`, 2000, 'info');

  // 1. 清空当前关卡的所有交互组件
  interactivePieces.forEach(piece => {
    scene.remove(piece);
    piece.traverse((node) => {
      if (node.isMesh) {
        node.geometry?.dispose();
        if (Array.isArray(node.material)) node.material.forEach(m => m.dispose());
        else node.material?.dispose();
      }
    });
  });
  interactivePieces.length = 0;

  // 2. 移除幽灵 + 实体成品
  if (ghostModel) {
    scene.remove(ghostModel);
    ghostModel = null;
  }
  if (showcaseModel) {
    scene.remove(showcaseModel);
    showcaseModel = null;
  }

  // 3. 清空目标配置
  TARGET_CONFIG = {};
  ASSEMBLY_ORDER = [];

  // 4. 清残留特效（与 resetLevel 第 3-7 步类似）
  victoryParticles.forEach(p => { scene.remove(p.mesh); p.mesh.geometry.dispose(); p.mesh.material.dispose(); });
  victoryParticles.length = 0;
  victoryEffectActive = false;
  snapPulses.forEach(p => { scene.remove(p.mesh); p.mesh.geometry.dispose(); p.mesh.material.dispose(); });
  snapPulses.length = 0;
  if (hintEnabled) { hideHintPreview(); hintEnabled = false; }
  if (proximityActive) { hideProximityHint(); proximityActive = false; }
  if (isGrabbing && grabbedObject) {
    unhighlightPiece(grabbedObject);
    setCursorGrabState(false);
    grabbedObject = null;
    isGrabbing = false;
    pinchOffFrames = 0;
  }
  if (flyAroundActive) flyAroundActive = false;
  if (cameraResetting) cameraResetting = false;
  // 切关时把引导脉冲指针置空（旧 piece 即将被 dispose，无需 clearNextPiecePulse）
  nextPiecePulseID = null;
  // 切关时彻底清理首步锚点（避免新关卡 ID !== 2 时残留）
  disposeFirstPieceAnchor();
  document.getElementById('finish-card-overlay')?.remove();
  document.getElementById('knowledge-overlay')?.remove();

  applyLevelConfig(index);

  try {
    // 6.0 切换背景（仅当新关卡指定了不同的 environmentPath 时）
    const newEnvPath = currentLevel.environmentPath;
    const currentEnvPath = environmentModel?.userData?.envPath;
    if (newEnvPath && newEnvPath !== currentEnvPath) {
      console.log(`[Level] 切换背景: ${currentEnvPath || '(无)'} → ${newEnvPath}`);
      await loadEnvironment(newEnvPath);
      if (environmentModel) environmentModel.userData.envPath = newEnvPath;
    }
    // 6.1-6.4
    await loadGhostReference();
    buildAssemblyOrder();
    await loadInteractivePieces();
    await loadShowcaseModel();
    updateHUDStatus();
    // 6.5 新关卡：平滑飞到本关默认机位（含手势识别基准）
    if (index !== 0) resetCameraToDefault();
    // 6.6 引导：在备料架上柔和高亮"下一应装构件"（第二关首步=集合陆，逐层向上推进）
    refreshNextPiecePulse();
    showToast(`${currentLevel.name} 已就绪`, 1800, 'success');
    console.log(`[Level] ✅ 关卡 ${index + 1} 加载完成`);
  } catch (err) {
    console.error('[Level] ❌ 关卡加载失败', err);
    showToast(`关卡加载失败：${err.message || err}`, 3000, 'error');
  }
}

// ===================== Step 4: 拼接判定系统（松手触发、多条件判定） =====================

// 目标槽位提示环（抓取时显示）
let targetHintMesh = null;

// 目标轮廓预览（提示按钮控制）
let hintEnabled = false;       // 是否开启提示模式（H 键主动开启）
let hintMesh = null;           // 临时克隆出的提示 mesh（场景里独立存在）

// 槽位"靠近呼吸"提示：抓住构件且距目标 < 1m 时自动显示金色目标轮廓 + 呼吸
let proximityMesh = null;
let proximityActive = false;
const PROXIMITY_SHOW_DIST = 1.0;   // 进入距离
const PROXIMITY_HIDE_DIST = 1.25;  // 退出距离（滞后避免抖动）

// 单构件吸附时的"短促金线脉冲"：金环 + 几颗散点，180-380ms 自然消散，不常驻
const snapPulses = [];

// 下一构件提示脉冲：当前应安装的构件在备料架上柔和地金色呼吸，引导玩家自然找到下一步
// （第二关首步 = 集合陆，逐层向上推进；第一关按 ASSEMBLY_ORDER 自动适配）
let nextPiecePulseID = null;        // 当前正在脉动的 partID，null 表示无目标
let nextPiecePulseStartTime = 0;    // 性能时间戳，用于正弦相位

// ===================== HUD 反馈系统（顶部状态 + 中央气泡） =====================

// 中央气泡定时器（避免多次调用相互覆盖）
let toastTimerId = null;

/**
 * 更新顶部状态栏：显示当前应该拼装的构件
 * 调用时机：初始化完成 / 每次成功吸附后
 */
function updateHUDStatus() {
  const el = document.getElementById('status-text');
  if (!el) return;

  // 找当前还没完成的第一步
  const remaining = getCurrentStepPieces();

  if (remaining.length === 0) {
    el.textContent = '🎉 拼接完成！';
    // 全部完成时自动关掉提示
    if (hintEnabled) toggleHintMode();
    return;
  }
  const displayList = remaining.map(getDisplayName);
  if (displayList.length === 1) {
    el.textContent = `当前请安装：${displayList[0]}`;
  } else {
    el.textContent = `当前请安装：${displayList.join(' 或 ')}`;
  }

  // 提示模式开启时，每次状态变化自动跳到新目标
  if (hintEnabled) showHintPreview();
}

/**
 * 中央气泡提示（用于失败原因、复位说明等短暂反馈）
 * @param {string} text  显示文字
 * @param {number} duration  显示时长（ms），默认 1500
 * @param {string} tone  'error' | 'info' | 'success'，影响颜色
 */
function showToast(text, duration = 1500, tone = 'info') {
  const wrapper = document.getElementById('hud-center-status');
  if (!wrapper) return;
  const inner = wrapper.querySelector('.center-status-text');
  if (!inner) return;

  // 颜色：错误用朱红，信息用金，成功用绿
  const color =
    tone === 'error' ? '#FF4444' :
    tone === 'success' ? '#88FF88' : '#FFD700';
  inner.style.color = color;
  inner.textContent = text;
  wrapper.style.display = 'block';

  if (toastTimerId) clearTimeout(toastTimerId);
  toastTimerId = setTimeout(() => {
    wrapper.style.display = 'none';
    toastTimerId = null;
  }, duration);
}

// ===================== 目标轮廓预览（提示按钮触发） =====================

/**
 * 显示当前应拼构件的目标位置：克隆一个 mesh 单独放到场景里
 * （不动幽灵模型本身，避免误显示其他配套 mesh）
 */
function showHintPreview() {
  hideHintPreview();

  const remaining = getCurrentStepPieces();
  if (remaining.length === 0) return;

  const partID = remaining[0];
  const target = TARGET_CONFIG[partID];
  if (!target) return;

  // 分支 A：originalNode 是单个 Mesh（第一关，自动从 ghost 内部 "配套" mesh 抽出）
  // 直接复用源 geometry 即可，最轻量
  if (target.originalNode && target.originalNode.geometry) {
    const sourceNode = target.originalNode;
    const worldScale = new THREE.Vector3();
    sourceNode.getWorldScale(worldScale);
    hintMesh = new THREE.Mesh(
      sourceNode.geometry,
      new THREE.MeshBasicMaterial({
        color: 0xffd700, transparent: true, opacity: 0.4,
        depthWrite: false, side: THREE.DoubleSide,
      })
    );
    hintMesh.position.copy(target.position);
    hintMesh.quaternion.copy(target.quaternion);
    hintMesh.scale.copy(worldScale);
    hintMesh.userData.isHint = true;
    hintMesh.userData._meshHint = true; // 标记：dispose 时只释放 material（geometry 是源 mesh 的）
    scene.add(hintMesh);
    console.log(`[Hint] 显示目标预览（mesh 模式）: ${partID}`);
    return;
  }

  // 分支 B：originalNode 是 Group / 缺失（第二关，整体建模）
  // 克隆对应零件做"金色虚影"，应用 target 的 position/quaternion/scale
  const piece = interactivePieces.find(p => p.userData.partID === partID);
  if (!piece) {
    console.warn(`[Hint] ⚠️ 未找到 piece ${partID}，无法生成 hint`);
    return;
  }
  hintMesh = piece.clone(true); // deep clone 子树（geometry 共享）
  hintMesh.userData.isHint = true;
  hintMesh.userData._cloneHint = true; // 标记：dispose 时只 dispose 新建的材质
  hintMesh.traverse((child) => {
    if (child.isMesh) {
      child.material = new THREE.MeshBasicMaterial({
        color: 0xffd700, transparent: true, opacity: 0.45,
        depthWrite: false, side: THREE.DoubleSide,
      });
      child.castShadow = false;
      child.receiveShadow = false;
    }
  });
  hintMesh.position.copy(target.position);
  hintMesh.quaternion.copy(target.quaternion);
  if (target.scale) hintMesh.scale.copy(target.scale);
  scene.add(hintMesh);
  console.log(`[Hint] 显示目标预览（克隆 piece 模式）: ${partID}`);
}

/**
 * 关闭目标预览：从场景移除并释放材质
 * - mesh 模式：geometry 共享自源 mesh，只 dispose material
 * - clone 模式：geometry 共享自 piece，只 dispose 新建的所有材质
 */
function hideHintPreview() {
  if (!hintMesh) return;
  scene.remove(hintMesh);
  hintMesh.traverse((child) => {
    if (child.isMesh && child.material) {
      child.material.dispose();
    }
  });
  hintMesh = null;
}

/**
 * 切换提示模式（提示按钮点击事件）
 */
function toggleHintMode() {
  console.log('[Hint] 切换提示模式，原状态:', hintEnabled);
  hintEnabled = !hintEnabled;
  const btn = document.getElementById('btn-hint');
  if (hintEnabled) {
    showHintPreview();
    if (btn) {
      btn.textContent = '关闭提示 (H)';
      btn.style.setProperty('background', 'rgba(255, 215, 0, 0.25)', 'important');
    }
  } else {
    hideHintPreview();
    if (btn) {
      btn.textContent = '提示 (H)';
      btn.style.removeProperty('background');
    }
  }
}

/**
 * 切换知识图浮层（按 K 或点知识图按钮）
 * 点击浮层任意位置或再按 K 关闭；图片路径由 currentLevel.knowledgeImage 提供
 */
function toggleKnowledgeImage() {
  const existing = document.getElementById('knowledge-overlay');
  if (existing) {
    existing.remove();
    return;
  }

  // 当前关卡的知识图路径（fallback 到第一关默认）
  const knowledgeImagePath = (currentLevel && currentLevel.knowledgeImage) || '/第一场景知识图.jpg';

  const overlay = document.createElement('div');
  overlay.id = 'knowledge-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.82);
    z-index: 3000;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    backdrop-filter: blur(4px);
    animation: knowledgeFadeIn 200ms ease-out;
  `;
  overlay.title = '点击任意位置 / 再按 K 关闭';

  const img = document.createElement('img');
  img.src = knowledgeImagePath;
  img.alt = '本关斗拱知识图';
  img.style.cssText = `
    max-width: 90vw;
    max-height: 90vh;
    border: 2px solid rgba(255, 215, 0, 0.4);
    border-radius: 8px;
    box-shadow: 0 8px 40px rgba(0, 0, 0, 0.6);
    background: #fff;
  `;
  img.onerror = () => {
    img.remove();
    const tip = document.createElement('div');
    tip.style.cssText = 'color:#fff;font-size:1.2rem;text-align:center;padding:32px;background:rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.2);border-radius:8px;';
    tip.innerHTML = `⚠️ 知识图未找到<br><br>请把图片放到 <code style="color:#ffd24a;">public${knowledgeImagePath}</code> 后刷新`;
    overlay.appendChild(tip);
  };
  overlay.appendChild(img);

  // 注入 fade-in 关键帧（仅一次）
  if (!document.getElementById('knowledge-keyframes')) {
    const style = document.createElement('style');
    style.id = 'knowledge-keyframes';
    style.textContent = `
      @keyframes knowledgeFadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }

  // 点击任意位置关闭
  overlay.addEventListener('click', () => overlay.remove());
  document.body.appendChild(overlay);

  console.log('[Knowledge] 知识图浮层已打开');
}

// ===================== 设置面板（齿轮按钮） =====================
const SETTINGS_LS_KEY = 'dougong-settings-v1';

/** 把当前内存中的设置写到 localStorage */
function saveSettings() {
  try {
    const data = {
      gestureSensitivityScale,
      audioVolume,
      ambientParticlesEnabled,
      flyAroundEnabled,
      cursorStyle: CURSOR_STYLE, // 仅记录，下次启动生效
      bgmEnabled,
      bgmVolume,
    };
    localStorage.setItem(SETTINGS_LS_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('[Settings] 保存失败', e);
  }
}

/** 应用音量到所有音效对象（含 BGM） */
function applyAudioVolume() {
  if (audioSnap) audioSnap.volume = audioVolume * 0.85;     // snap 略轻
  if (audioWin) audioWin.volume = audioVolume;
  if (audioFailure) audioFailure.volume = audioVolume * 0.85;
  if (audioBGM) audioBGM.volume = bgmEnabled ? bgmVolume : 0;
}

/** 启动 BGM（必须在用户交互后调用，否则浏览器会阻止自动播放） */
function startBGM() {
  if (!audioBGM || !bgmEnabled) return;
  audioBGM.volume = bgmVolume;
  audioBGM.play().catch((err) => {
    console.warn('[BGM] 自动播放被阻止：', err.message);
  });
}

/** 暂停 BGM（返回主页 / 关闭开关时调用） */
function stopBGM() {
  if (!audioBGM) return;
  try { audioBGM.pause(); } catch (e) {}
}

/** 切换环境粒子可见性（关闭时直接隐藏 mesh，避免视觉残留） */
function setAmbientParticlesEnabled(enabled) {
  ambientParticlesEnabled = enabled;
  for (const p of ambientParticles) {
    if (p?.mesh) p.mesh.visible = enabled;
  }
}

/** 启动时调用：把 localStorage 配置应用到内存 */
function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_LS_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (typeof data.gestureSensitivityScale === 'number') {
      gestureSensitivityScale = Math.min(2.0, Math.max(0.5, data.gestureSensitivityScale));
    }
    if (typeof data.audioVolume === 'number') {
      audioVolume = Math.min(1.0, Math.max(0, data.audioVolume));
    }
    if (typeof data.ambientParticlesEnabled === 'boolean') {
      // 注意：此时粒子尚未创建，仅同步标志位；init 后会用此值控制
      ambientParticlesEnabled = data.ambientParticlesEnabled;
    }
    if (typeof data.flyAroundEnabled === 'boolean') {
      flyAroundEnabled = data.flyAroundEnabled;
    }
    if (typeof data.bgmEnabled === 'boolean') {
      bgmEnabled = data.bgmEnabled;
    }
    if (typeof data.bgmVolume === 'number') {
      bgmVolume = Math.min(1.0, Math.max(0, data.bgmVolume));
    }
    // 光标风格不在这里直接改 CURSOR_STYLE（const），只保留给面板读取
    console.log('[Settings] 配置已加载', data);
  } catch (e) {
    console.warn('[Settings] 加载失败', e);
  }
}

/** 打开/关闭设置面板 */
function toggleSettingsPanel() {
  const existing = document.getElementById('settings-overlay');
  if (existing) {
    existing.remove();
    return;
  }

  const overlay = document.createElement('div');
  overlay.id = 'settings-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.65);
    z-index: 3500;
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(6px);
    animation: knowledgeFadeIn 180ms ease-out;
  `;

  const panel = document.createElement('div');
  panel.style.cssText = `
    width: min(440px, 92vw);
    max-height: 88vh;
    overflow-y: auto;
    background: linear-gradient(180deg, #2a1f1a 0%, #1a1410 100%);
    border: 1px solid rgba(255, 215, 0, 0.35);
    border-radius: 12px;
    box-shadow: 0 12px 48px rgba(0, 0, 0, 0.7), 0 0 24px rgba(255, 200, 80, 0.15);
    padding: 24px 28px;
    color: #f5e9d0;
    font-family: inherit;
  `;

  // 阻止冒泡，避免点面板内部时关闭浮层
  panel.addEventListener('click', (e) => e.stopPropagation());

  panel.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">
      <h2 style="margin:0;font-size:1.3rem;color:#ffd680;letter-spacing:1px;">⚙ 设置</h2>
      <button id="settings-close" style="
        background:transparent;border:1px solid rgba(255,215,0,0.4);
        color:#ffd680;border-radius:6px;padding:4px 12px;cursor:pointer;font-size:0.9rem;">关闭 (Esc)</button>
    </div>

    <div class="settings-row" style="margin-bottom:20px;">
      <label style="display:flex;justify-content:space-between;font-size:0.95rem;margin-bottom:8px;">
        <span>手势灵敏度</span>
        <span id="setting-sens-val" style="color:#ffd680;">${gestureSensitivityScale.toFixed(1)}x</span>
      </label>
      <input id="setting-sens" type="range" min="0.5" max="2.0" step="0.1"
        value="${gestureSensitivityScale}" style="width:100%;accent-color:#ffd680;">
      <div style="font-size:0.78rem;color:#a89880;margin-top:4px;">小→精细可控；大→快速大幅移动</div>
    </div>

    <div class="settings-row" style="margin-bottom:20px;">
      <label style="display:flex;justify-content:space-between;font-size:0.95rem;margin-bottom:8px;">
        <span>音效音量</span>
        <span id="setting-vol-val" style="color:#ffd680;">${Math.round(audioVolume * 100)}%</span>
      </label>
      <input id="setting-vol" type="range" min="0" max="1" step="0.05"
        value="${audioVolume}" style="width:100%;accent-color:#ffd680;">
    </div>

    <div class="settings-row" style="margin-bottom:18px;display:flex;align-items:center;justify-content:space-between;">
      <div>
        <div style="font-size:0.95rem;">背景音乐 · 江上清风游</div>
        <div style="font-size:0.78rem;color:#a89880;margin-top:2px;">关闭后即时静音</div>
      </div>
      <label class="switch" style="position:relative;display:inline-block;width:48px;height:26px;">
        <input id="setting-bgm-toggle" type="checkbox" ${bgmEnabled ? 'checked' : ''}
          style="opacity:0;width:0;height:0;">
        <span class="slider-track" style="
          position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;
          background:${bgmEnabled ? '#ffd680' : '#3a2c22'};
          transition:.2s;border-radius:13px;">
          <span style="
            position:absolute;height:20px;width:20px;left:${bgmEnabled ? '25px' : '3px'};top:3px;
            background:#1a1410;transition:.2s;border-radius:50%;"></span>
        </span>
      </label>
    </div>

    <div class="settings-row" style="margin-bottom:20px;">
      <label style="display:flex;justify-content:space-between;font-size:0.95rem;margin-bottom:8px;">
        <span>BGM 音量</span>
        <span id="setting-bgm-vol-val" style="color:#ffd680;">${Math.round(bgmVolume * 100)}%</span>
      </label>
      <input id="setting-bgm-vol" type="range" min="0" max="1" step="0.05"
        value="${bgmVolume}" style="width:100%;accent-color:#ffd680;">
    </div>

    <div class="settings-row" style="margin-bottom:18px;display:flex;align-items:center;justify-content:space-between;">
      <div>
        <div style="font-size:0.95rem;">环境尘埃粒子</div>
        <div style="font-size:0.78rem;color:#a89880;margin-top:2px;">飘落金色光点，营造氛围</div>
      </div>
      <label class="switch" style="position:relative;display:inline-block;width:48px;height:26px;">
        <input id="setting-ambient" type="checkbox" ${ambientParticlesEnabled ? 'checked' : ''}
          style="opacity:0;width:0;height:0;">
        <span class="slider-track" style="
          position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;
          background:${ambientParticlesEnabled ? '#ffd680' : '#3a2c22'};
          transition:.2s;border-radius:13px;">
          <span style="
            position:absolute;height:20px;width:20px;left:${ambientParticlesEnabled ? '25px' : '3px'};top:3px;
            background:#1a1410;transition:.2s;border-radius:50%;"></span>
        </span>
      </label>
    </div>

    <div class="settings-row" style="margin-bottom:18px;display:flex;align-items:center;justify-content:space-between;">
      <div>
        <div style="font-size:0.95rem;">完成后绕飞镜头</div>
        <div style="font-size:0.78rem;color:#a89880;margin-top:2px;">5 秒缓慢绕一圈展示成果</div>
      </div>
      <label class="switch" style="position:relative;display:inline-block;width:48px;height:26px;">
        <input id="setting-fly" type="checkbox" ${flyAroundEnabled ? 'checked' : ''}
          style="opacity:0;width:0;height:0;">
        <span class="slider-track" style="
          position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;
          background:${flyAroundEnabled ? '#ffd680' : '#3a2c22'};
          transition:.2s;border-radius:13px;">
          <span style="
            position:absolute;height:20px;width:20px;left:${flyAroundEnabled ? '25px' : '3px'};top:3px;
            background:#1a1410;transition:.2s;border-radius:50%;"></span>
        </span>
      </label>
    </div>

    <div class="settings-row" style="margin-bottom:8px;padding-top:14px;border-top:1px solid rgba(255,215,0,0.12);">
      <div style="font-size:0.95rem;margin-bottom:8px;">光标风格 <span style="font-size:0.75rem;color:#a89880;">（切换后刷新页面生效）</span></div>
      <div style="display:flex;gap:10px;">
        <label style="flex:1;cursor:pointer;padding:10px;border:1px solid ${CURSOR_STYLE === 'B' ? 'rgba(255,215,0,0.6)' : 'rgba(255,255,255,0.15)'};border-radius:6px;text-align:center;background:${CURSOR_STYLE === 'B' ? 'rgba(255,215,0,0.08)' : 'transparent'};">
          <input type="radio" name="cursor-style" value="B" ${CURSOR_STYLE === 'B' ? 'checked' : ''} style="margin-right:6px;">
          单点+光环
        </label>
        <label style="flex:1;cursor:pointer;padding:10px;border:1px solid ${CURSOR_STYLE === 'C' ? 'rgba(255,215,0,0.6)' : 'rgba(255,255,255,0.15)'};border-radius:6px;text-align:center;background:${CURSOR_STYLE === 'C' ? 'rgba(255,215,0,0.08)' : 'transparent'};">
          <input type="radio" name="cursor-style" value="C" ${CURSOR_STYLE === 'C' ? 'checked' : ''} style="margin-right:6px;">
          双点
        </label>
      </div>
    </div>

    <div style="margin-top:20px;text-align:right;">
      <button id="settings-reset-defaults" style="
        background:transparent;border:1px solid rgba(255,255,255,0.18);
        color:#a89880;border-radius:6px;padding:6px 14px;cursor:pointer;font-size:0.85rem;">恢复默认</button>
    </div>
  `;

  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  // —— 事件绑定 ——
  const sensInput = panel.querySelector('#setting-sens');
  const sensVal = panel.querySelector('#setting-sens-val');
  sensInput.addEventListener('input', () => {
    gestureSensitivityScale = parseFloat(sensInput.value);
    sensVal.textContent = gestureSensitivityScale.toFixed(1) + 'x';
    saveSettings();
  });

  const volInput = panel.querySelector('#setting-vol');
  const volVal = panel.querySelector('#setting-vol-val');
  volInput.addEventListener('input', () => {
    audioVolume = parseFloat(volInput.value);
    volVal.textContent = Math.round(audioVolume * 100) + '%';
    applyAudioVolume();
    saveSettings();
  });

  const bgmToggle = panel.querySelector('#setting-bgm-toggle');
  bgmToggle.addEventListener('change', () => {
    bgmEnabled = bgmToggle.checked;
    const track = bgmToggle.nextElementSibling;
    track.style.background = bgmEnabled ? '#ffd680' : '#3a2c22';
    track.firstElementChild.style.left = bgmEnabled ? '25px' : '3px';
    if (bgmEnabled) {
      startBGM();
    } else {
      stopBGM();
    }
    applyAudioVolume();
    saveSettings();
  });

  const bgmVolInput = panel.querySelector('#setting-bgm-vol');
  const bgmVolVal = panel.querySelector('#setting-bgm-vol-val');
  bgmVolInput.addEventListener('input', () => {
    bgmVolume = parseFloat(bgmVolInput.value);
    bgmVolVal.textContent = Math.round(bgmVolume * 100) + '%';
    applyAudioVolume();
    saveSettings();
  });

  const ambientToggle = panel.querySelector('#setting-ambient');
  ambientToggle.addEventListener('change', () => {
    setAmbientParticlesEnabled(ambientToggle.checked);
    // 视觉反馈：更新滑块颜色
    const track = ambientToggle.nextElementSibling;
    track.style.background = ambientToggle.checked ? '#ffd680' : '#3a2c22';
    track.firstElementChild.style.left = ambientToggle.checked ? '25px' : '3px';
    saveSettings();
  });

  const flyToggle = panel.querySelector('#setting-fly');
  flyToggle.addEventListener('change', () => {
    flyAroundEnabled = flyToggle.checked;
    const track = flyToggle.nextElementSibling;
    track.style.background = flyToggle.checked ? '#ffd680' : '#3a2c22';
    track.firstElementChild.style.left = flyToggle.checked ? '25px' : '3px';
    saveSettings();
  });

  // 光标风格只保存，不立即生效（避免重建 mesh 的复杂性）
  panel.querySelectorAll('input[name="cursor-style"]').forEach((r) => {
    r.addEventListener('change', (e) => {
      const newStyle = e.target.value;
      try {
        const raw = localStorage.getItem(SETTINGS_LS_KEY);
        const data = raw ? JSON.parse(raw) : {};
        data.cursorStyle = newStyle;
        localStorage.setItem(SETTINGS_LS_KEY, JSON.stringify(data));
      } catch (err) {}
      showToast('光标风格已保存 · 刷新页面后生效', 1800, 'info');
    });
  });

  // 关闭按钮 / 点遮罩外 / Esc
  const close = () => overlay.remove();
  panel.querySelector('#settings-close').addEventListener('click', close);
  overlay.addEventListener('click', close);
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

  // 恢复默认
  panel.querySelector('#settings-reset-defaults').addEventListener('click', () => {
    gestureSensitivityScale = 1.0;
    audioVolume = 0.7;
    bgmEnabled = true;
    bgmVolume = 0.35;
    setAmbientParticlesEnabled(true);
    flyAroundEnabled = true;
    applyAudioVolume();
    if (bgmEnabled) startBGM();
    saveSettings();
    overlay.remove();
    toggleSettingsPanel(); // 重开以刷新 UI
    showToast('设置已恢复默认', 1400, 'info');
  });

  console.log('[Settings] 面板已打开');
}

/**
 * 切换放大模式（按 Z 或点放大按钮）
 * 实现方式：摄像机沿当前观察方向推进/退出 ZOOM_FACTOR 倍，灵敏度同步缩放
 * 视觉范围基本不变，但小幅手势对应小幅光标位移 → 操作变精细
 */
function toggleZoomMode() {
  if (zoomAnimating) {
    // 动画期间忽略重复触发，避免数学不一致
    console.log('[Zoom] 切换被忽略（动画中）');
    return;
  }
  console.log('[Zoom] 切换放大模式，原状态:', zoomEnabled);

  zoomEnabled = !zoomEnabled;
  zoomAnimating = true;

  // 当前摄像机相对 target 的偏移
  const startOffset = camera.position.clone().sub(controls.target);
  const endOffset = startOffset.clone();
  // 进入放大：距离 ÷ ZOOM_FACTOR；退出：× ZOOM_FACTOR
  endOffset.multiplyScalar(zoomEnabled ? (1 / ZOOM_FACTOR) : ZOOM_FACTOR);

  const startTime = performance.now();
  const targetCenter = controls.target.clone();

  function step() {
    const elapsed = performance.now() - startTime;
    const t = Math.min(1, elapsed / ZOOM_ANIM_DURATION);
    // easeOutCubic
    const ease = 1 - Math.pow(1 - t, 3);

    const curOffset = startOffset.clone().lerp(endOffset, ease);
    camera.position.copy(targetCenter).add(curOffset);
    controls.update();

    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      zoomAnimating = false;
    }
  }
  requestAnimationFrame(step);

  // UI 反馈：按钮文本 + 屏幕金色边框 + 鼠标键位切换
  const btn = document.getElementById('btn-zoom');
  if (zoomEnabled) {
    if (btn) {
      btn.textContent = '退出放大 (Z)';
      btn.style.setProperty('background', 'rgba(255, 215, 0, 0.25)', 'important');
    }
    showZoomBorder(true);
    // ⭐ 放大状态下左键改为 pan，方便用户拖动视野看偏僻部件
    if (controls && controls.mouseButtons) {
      controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
    }
    showToast('已进入放大模式 · 光标更精细 · 左键拖动可平移视野', 2200, 'info');
  } else {
    if (btn) {
      btn.textContent = '放大 (Z)';
      btn.style.removeProperty('background');
    }
    showZoomBorder(false);
    // 恢复左键旋转
    if (controls && controls.mouseButtons) {
      controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    }
  }
}

/**
 * 屏幕金色边框：标示当前处于放大模式
 */
function showZoomBorder(enabled) {
  let border = document.getElementById('zoom-border');
  if (enabled) {
    if (!border) {
      border = document.createElement('div');
      border.id = 'zoom-border';
      border.style.cssText = `
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        pointer-events: none;
        border: 4px solid rgba(255, 215, 0, 0.7);
        box-shadow: inset 0 0 24px rgba(255, 215, 0, 0.35);
        z-index: 1500;
        animation: zoom-border-pulse 2s ease-in-out infinite;
      `;
      document.body.appendChild(border);
      // 注入呼吸动画样式（只注入一次）
      if (!document.getElementById('zoom-border-keyframes')) {
        const style = document.createElement('style');
        style.id = 'zoom-border-keyframes';
        style.textContent = `
          @keyframes zoom-border-pulse {
            0%, 100% { border-color: rgba(255, 215, 0, 0.5); box-shadow: inset 0 0 18px rgba(255, 215, 0, 0.25); }
            50%      { border-color: rgba(255, 215, 0, 0.9); box-shadow: inset 0 0 32px rgba(255, 215, 0, 0.45); }
          }
        `;
        document.head.appendChild(style);
      }
    }
  } else if (border) {
    border.remove();
  }
}

/**
 * 按幽灵模型目标点的 Y 坐标自动推导拼接顺序（从下往上）
 * - Y 升序排列
 * - Y 差值 < ASSEMBLY_LAYER_Y_TOLERANCE 视为同一层，可任意顺序
 * - 必须在 TARGET_CONFIG 填充完成后调用
 */
function buildAssemblyOrder() {
  // 优先使用关卡配置里的手动顺序，回退到全局 MANUAL_ASSEMBLY_ORDER
  const manual = currentLevel.manualAssemblyOrder
    || (Array.isArray(MANUAL_ASSEMBLY_ORDER) && MANUAL_ASSEMBLY_ORDER.length > 0 ? MANUAL_ASSEMBLY_ORDER : null);
  if (Array.isArray(manual) && manual.length > 0) {
    ASSEMBLY_ORDER = manual;
    console.log('=== [Assembly] 使用手动配置的拼接顺序 ===');
    manual.forEach((layer, i) => {
      console.log(`  第 ${i + 1} 步: [${layer.join(', ')}]`);
    });
    console.log('=========================================');
    return ASSEMBLY_ORDER;
  }

  // 否则按 Y 坐标自动推导（从下往上）
  const entries = Object.entries(TARGET_CONFIG)
    .map(([id, t]) => ({ id, y: t.position.y }))
    .sort((a, b) => a.y - b.y);

  const order = [];
  let currentLayer = [];
  let layerY = -Infinity;

  for (const e of entries) {
    if (currentLayer.length === 0 || Math.abs(e.y - layerY) <= ASSEMBLY_LAYER_Y_TOLERANCE) {
      currentLayer.push(e.id);
      // 同层用首个元素的 Y 作为基准，避免逐步漂移
      if (currentLayer.length === 1) layerY = e.y;
    } else {
      order.push(currentLayer);
      currentLayer = [e.id];
      layerY = e.y;
    }
  }
  if (currentLayer.length > 0) order.push(currentLayer);

  ASSEMBLY_ORDER = order;

  console.log('=== [Assembly] 拼接顺序自动推导（按 Y 升序，从下往上）===');
  console.log(`  容差: ASSEMBLY_LAYER_Y_TOLERANCE = ${ASSEMBLY_LAYER_Y_TOLERANCE}m`);
  console.log('  ─ 各目标点原始 Y 值 ─');
  entries.forEach(e => console.log(`    ${e.id.padEnd(15)} Y = ${e.y.toFixed(4)}`));
  console.log('  ─ 分层结果 ─');
  order.forEach((layer, i) => {
    const ys = layer.map(id => TARGET_CONFIG[id].position.y.toFixed(4)).join(', ');
    console.log(`    第 ${i + 1} 步: [${layer.join(', ')}]  (Y = ${ys})`);
  });
  if (order.length === 1) {
    console.warn('  ⚠️ 只分到 1 层 — 所有构件 Y 值都很接近，顺序约束实际不起作用！');
    console.warn('     如需强顺序，把 ASSEMBLY_LAYER_Y_TOLERANCE 调小（比如 0.01）');
  }
  console.log('=====================================================');

  return order;
}

/**
 * 检查拼接顺序是否满足：逐步骤检查，前置步骤的所有构件必须已完成
 */
function isOrderSatisfied(partID) {
  for (const stepPieces of ASSEMBLY_ORDER) {
    if (stepPieces.includes(partID)) {
      return true;
    }
    const allStepComplete = stepPieces.every(name => {
      const p = interactivePieces.find(x => x.userData.partID === name);
      return p && p.userData.isSnapped;
    });
    if (!allStepComplete) {
      return false;
    }
  }
    return false;
  }
  
/**
 * 获取当前步骤中尚未完成的构件名称（用于提示）
 */
function getCurrentStepPieces() {
  for (const stepPieces of ASSEMBLY_ORDER) {
    const remaining = stepPieces.filter(name => {
      const p = interactivePieces.find(x => x.userData.partID === name);
      return !p || !p.userData.isSnapped;
    });
    if (remaining.length > 0) {
      return remaining;
    }
  }
  return [];
}

/**
 * 统一拼接判定入口（构件匹配 → 顺序约束 → 距离判定 → 角度判定）
 * @returns {{ success: boolean, reason?: string, target?, distance?, angleDiff? }}
 */
function canSnap(piece) {
  const partID = piece.userData.partID;

  if (!piece.userData.isDraggable || piece.userData.isSnapped) {
    return { success: false, reason: 'not_draggable' };
  }

  // 1. 构件匹配：必须有对应的目标槽位
  const target = TARGET_CONFIG[partID];
  if (!target) {
    return { success: false, reason: 'no_target', partID };
  }
  if (target.isOccupied) {
    return { success: false, reason: 'slot_occupied', partID };
  }

  // 2. 顺序约束：前置步骤未完成时，不能拼接
  if (!isOrderSatisfied(partID)) {
    return { success: false, reason: 'wrong_order', partID, expected: getCurrentStepPieces() };
  }

  // 3. 距离判定
  const distance = piece.position.distanceTo(target.position);
  if (distance >= SNAP_DISTANCE) {
    return { success: false, reason: 'too_far', partID, distance, required: SNAP_DISTANCE };
  }

  // 4. 角度判定
      const pieceQuat = new THREE.Quaternion();
      piece.getWorldQuaternion(pieceQuat);
      const angleDiff = pieceQuat.angleTo(target.quaternion);
  if (angleDiff >= SNAP_ANGLE_THRESHOLD) {
    return {
      success: false, reason: 'wrong_angle', partID,
      angleDiff: angleDiff * 180 / Math.PI,
      required: SNAP_ANGLE_THRESHOLD * 180 / Math.PI
    };
  }

  return { success: true, target, distance, angleDiff };
}

/**
 * 松手时的统一判定入口（四分支处理）
 *
 *   ┌─ 不在意图区   → 复位 + 静默（用户没真的尝试拼接）
 *   ├─ 在意图区 + 顺序错（用错部件）→ 复位 + 震动（明确错误反馈）
 *   ├─ 在意图区 + 顺序对但距离/角度不够 → 复位 + 静默（态度对，给重试机会）
 *   └─ 全部条件满足 → 吸附成功 + 音效
 */
function trySnapOnRelease(piece) {
  const partID = piece.userData.partID;
  const target = TARGET_CONFIG[partID];

  // 没目标点（理论不会发生）：直接复位
  if (!target) {
    console.log(`[Snap] 💤 ${partID} 没有目标点，复位`);
    returnToInitial(piece);
    return false;
  }

  const distance = piece.position.distanceTo(target.position);

  // 分支①：离目标超过意图区 — 用户只是放下/取消，复位 + 轻提示
  if (distance > INTENT_ZONE) {
    console.log(`[Snap] 💤 ${partID} 松手时离目标 ${distance.toFixed(2)}m > 意图区 ${INTENT_ZONE}m，复位`);
    returnToInitial(piece);
    showToast('已放回备料架', 1000, 'info');
    return false;
  }

  // 进入意图区：执行完整判定
  const result = canSnap(piece);

  // 分支④：成功
  if (result.success) {
    performSnap(piece, result.target);
    console.log(`[Snap] ✅ ${partID} 拼接成功！距离: ${result.distance.toFixed(3)}m, 角度差: ${(result.angleDiff * 180 / Math.PI).toFixed(1)}°`);
    return true;
  }

  // 分支②：在意图区 + 顺序错（用错部件）— 复位 + 震动 + 错误音效 + 朱红气泡
  if (result.reason === 'wrong_order') {
    console.log(`[Snap] ❌ ${partID} 在意图区但顺序不对，当前应拼: [${result.expected.join(', ')}]`);
    returnToInitial(piece);
    shakeCamera();
    if (audioFailure) {
      try { audioFailure.currentTime = 0; audioFailure.play().catch(() => {}); } catch (e) {}
    }
    const expectedText = result.expected.map(getDisplayName).join('、');
    showToast(`顺序不对！请先安装【${expectedText}】`, 1800, 'error');
    return false;
  }

  // 分支③：在意图区 + 顺序对，但距离/角度不够 — 复位 + 金色气泡引导重试
  if (result.reason === 'too_far') {
    console.log(`[Snap] 🔄 ${partID} 距离不够: ${result.distance.toFixed(2)}m`);
    returnToInitial(piece);
    showToast('再凑近目标位置一些', 1400, 'info');
    return false;
  }
  if (result.reason === 'wrong_angle') {
    console.log(`[Snap] 🔄 ${partID} 角度不对: ${result.angleDiff.toFixed(1)}°`);
    returnToInitial(piece);
    showToast('对齐方向稍微调一下', 1400, 'info');
    return false;
  }

  // 兜底
  console.log(`[Snap] 🔄 ${partID} 失败原因: ${result.reason}`);
  returnToInitial(piece);
  showToast('再试一次', 1200, 'info');
  return false;
}

/**
 * 把构件平滑复位到备料架初始位置（位置 + 旋转）
 * - 250ms 补间，缓出曲线，避免瞬移突兀
 * - 动画期间锁住 isDraggable，防止用户在飞行中又抓住它（动画结束自动解锁）
 */
const RETURN_ANIM_DURATION = 250; // ms

function returnToInitial(piece) {
  const initialPos = piece.userData.initialPosition;
  if (!initialPos) return;

  // 锁定，防止动画中被抓
  const wasDraggable = piece.userData.isDraggable;
  piece.userData.isDraggable = false;

  const startPos = piece.position.clone();
  const startQuat = piece.quaternion.clone();
  const startScale = piece.scale.clone();
  // 优先用初始 quaternion / scale（dockOverrides 提供）；没有则恢复为 identity / 1
  const endQuat = piece.userData.initialQuaternion ? piece.userData.initialQuaternion.clone() : new THREE.Quaternion();
  const endScale = piece.userData.initialScale ? piece.userData.initialScale.clone() : new THREE.Vector3(1, 1, 1);
  const startTime = performance.now();

  function tick() {
    const elapsed = performance.now() - startTime;
    const t = Math.min(elapsed / RETURN_ANIM_DURATION, 1);
    const eased = 1 - Math.pow(1 - t, 3);

    piece.position.lerpVectors(startPos, initialPos, eased);
    piece.quaternion.copy(startQuat).slerp(endQuat, eased);
    piece.scale.lerpVectors(startScale, endScale, eased);

    if (t < 1) {
      requestAnimationFrame(tick);
    } else {
      piece.position.copy(initialPos);
      piece.quaternion.copy(endQuat);
      piece.scale.copy(endScale);
      if (!piece.userData.isSnapped) {
        piece.userData.isDraggable = wasDraggable;
      }
    }
  }
  tick();
}

/**
 * 执行吸附：对齐位姿 → 锁定构件 → 播放音效 → 更新 HUD → 检查全局完成
 */
function performSnap(piece, target) {
    piece.position.copy(target.position);
    piece.quaternion.copy(target.quaternion);
  if (target.scale) piece.scale.copy(target.scale);
    
    piece.userData.isSnapped = true;
    piece.userData.isDraggable = false;
    target.isOccupied = true;
    
    if (audioSnap) {
    try { audioSnap.currentTime = 0; audioSnap.play().catch(() => {}); } catch (e) {}
  }

  showToast(`✅ ${getDisplayName(piece.userData.partID)} 安装成功`, 1200, 'success');
  spawnSnapPulse(piece); // 短促金色脉冲反馈，替代常驻光晕
  updateHUDStatus();
  checkAllComplete();
}

/**
 * 检查是否全部拼接完成（二次校验位置+角度）
 */
function checkAllComplete() {
  const allSnapped = interactivePieces.every(p => p.userData.isSnapped);
  if (!allSnapped) return;

  const allVerified = interactivePieces.every(p => {
    const t = TARGET_CONFIG[p.userData.partID];
    if (!t) return false;
    if (p.position.distanceTo(t.position) > 0.5) return false;
    const q = new THREE.Quaternion();
    p.getWorldQuaternion(q);
    if (q.angleTo(t.quaternion) > Math.PI / 6) return false;
    return true;
  });

  if (allVerified) {
    console.log('[Main] 🎉 所有构件拼接完成！');
    if (audioWin) {
      try { audioWin.currentTime = 0; audioWin.play().catch(() => {}); } catch (e) {}
    }
    showToast('🎉 单翘斗拱搭建完成 · 静观片刻', 2200, 'success');
    spawnVictoryParticles();

    // 时序：粒子立即喷出 → 0.4s 后启动 5.2s 绕飞 → 绕飞结束 0.4s 弹讲解卡
    if (flyAroundEnabled) {
      setTimeout(startFlyAround, 400);
      setTimeout(showFinishCard, 400 + FLY_AROUND_DURATION + 400);
    } else {
      // 关闭绕飞时退化到原行为：1.2s 直接弹卡
      setTimeout(showFinishCard, 1200);
    }
  }
}

/**
 * 完成后摄像机绕飞：以 controls.target 为中心，保持当前距离/俯角，绕 Y 轴一周
 * 期间禁用 OrbitControls 防止用户拖拽冲突；结束恢复
 */
function startFlyAround() {
  if (flyAroundActive) return;
  flyAroundActive = true;

  const target = controls.target.clone();
  const offset = camera.position.clone().sub(target);
  const radius = Math.sqrt(offset.x * offset.x + offset.z * offset.z);
  const startAngle = Math.atan2(offset.z, offset.x);
  const yHeight = offset.y; // 保持俯视高度不变

  const wasEnabled = controls.enabled;
  controls.enabled = false;

  const startTime = performance.now();
  console.log('[FlyAround] 开始绕飞展示');

  function step() {
    // 外部中断（重置/返回主页时把 flyAroundActive 设为 false）
    if (!flyAroundActive) {
      controls.enabled = wasEnabled;
      controls.update();
      console.log('[FlyAround] 被外部中断');
      return;
    }

    const elapsed = performance.now() - startTime;
    const t = Math.min(1, elapsed / FLY_AROUND_DURATION);

    // easeInOutCubic：两端慢、中间快，更"电影感"
    const ease = t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const angle = startAngle + Math.PI * 2 * ease;
    camera.position.x = target.x + Math.cos(angle) * radius;
    camera.position.z = target.z + Math.sin(angle) * radius;
    camera.position.y = target.y + yHeight;
    camera.lookAt(target);

    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      flyAroundActive = false;
      controls.enabled = wasEnabled;
      controls.update();
      console.log('[FlyAround] 绕飞结束');
    }
  }
  requestAnimationFrame(step);
}

/**
 * 复位机位：平滑动画回到 init 时的默认观察角度（含 controls.target）
 * 若处于放大模式，先退出再复位（保留放大状态会让 ZOOM 计算错乱）
 * 若处于绕飞动画中，先中断绕飞
 */
function resetCameraToDefault() {
  if (cameraResetting) return;
  // 中断绕飞
  if (flyAroundActive) flyAroundActive = false;

  // 若处于放大模式，先无动画退出（避免和复位动画叠加）
  if (zoomEnabled) {
    zoomEnabled = false;
    zoomAnimating = false;
    if (controls.mouseButtons) controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    showZoomBorder(false);
    const btnZoom2 = document.getElementById('btn-zoom');
    if (btnZoom2) {
      btnZoom2.textContent = '放大 (Z)';
      btnZoom2.style.removeProperty('background');
    }
  }

  cameraResetting = true;
  const fromPos = camera.position.clone();
  const fromTarget = controls.target.clone();
  const toPos = DEFAULT_CAMERA_POS.clone();
  const toTarget = DEFAULT_CAMERA_TARGET.clone();
  const startTime = performance.now();
  const wasEnabled = controls.enabled;
  controls.enabled = false;

  function step() {
    // 外部中断（resetLevel 时把 cameraResetting 设为 false）
    if (!cameraResetting) {
      controls.enabled = wasEnabled;
      controls.update();
      return;
    }
    const t = Math.min(1, (performance.now() - startTime) / CAMERA_RESET_DURATION);
    // easeOutCubic：起步快、末段缓
    const ease = 1 - Math.pow(1 - t, 3);
    camera.position.lerpVectors(fromPos, toPos, ease);
    controls.target.lerpVectors(fromTarget, toTarget, ease);
    camera.lookAt(controls.target);

    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      cameraResetting = false;
      controls.enabled = wasEnabled;
      controls.update();
      console.log('[Camera] 已复位到默认机位');
    }
  }
  requestAnimationFrame(step);
  showToast('视角已复位', 1200, 'info');
}

/**
 * 完成讲解卡：屏幕中央弹出，含本关文化介绍 + "再玩一次" + "继续欣赏"
 */
function showFinishCard() {
  if (document.getElementById('finish-card-overlay')) return; // 防重复

  const overlay = document.createElement('div');
  overlay.id = 'finish-card-overlay';
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.55);
    z-index: 2800;
    display: flex; align-items: center; justify-content: center;
    backdrop-filter: blur(3px);
    animation: finishCardFadeIn 280ms ease-out;
  `;

  const card = document.createElement('div');
  card.style.cssText = `
    width: min(560px, 90vw);
    background: linear-gradient(180deg, rgba(40, 28, 22, 0.96) 0%, rgba(30, 22, 18, 0.96) 100%);
    border: 1.5px solid rgba(255, 215, 0, 0.45);
    border-radius: 14px;
    box-shadow: 0 12px 56px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 215, 0, 0.18);
    padding: 36px 42px 28px;
    color: #f4e8d8;
    font-family: var(--font-body, system-ui);
  `;

  card.innerHTML = `
    <div style="text-align:center;font-size:0.85rem;letter-spacing:4px;color:#c8a063;margin-bottom:6px;">
      ◆◆◆  搭 建 完 成  ◆◆◆
    </div>
    <h2 style="text-align:center;font-size:1.85rem;margin:8px 0 4px;color:#ffd24a;font-weight:600;letter-spacing:2px;">
      ${FINISH_CARD_LORE.title}
    </h2>
    <div style="text-align:center;font-size:0.95rem;color:#d8b88a;margin-bottom:22px;letter-spacing:1px;">
      ${FINISH_CARD_LORE.subtitle}
    </div>
    <div style="height:1px;background:linear-gradient(90deg, transparent, rgba(255,215,0,0.35), transparent);margin:0 0 22px;"></div>
    <div style="font-size:1rem;line-height:1.85;color:#e8dcc8;text-align:justify;">
      ${FINISH_CARD_LORE.body}
    </div>
    ${FINISH_CARD_LORE.source ? `<div style="text-align:right;font-size:0.85rem;color:#a89070;margin-top:14px;">— ${FINISH_CARD_LORE.source}</div>` : ''}
    <div id="finish-card-actions" style="display:flex;gap:12px;justify-content:center;margin-top:28px;flex-wrap:wrap;">
      <button id="finish-card-replay" class="btn btn-outline"
        style="min-width:120px;padding:10px 20px;font-size:0.95rem;">再玩一次</button>
      <button id="finish-card-close" class="btn btn-outline"
        style="min-width:120px;padding:10px 20px;font-size:0.95rem;">继续欣赏</button>
      ${currentLevelIndex + 1 < LEVELS.length
        ? `<button id="finish-card-next" class="btn btn-primary"
            style="min-width:140px;padding:10px 22px;font-size:0.95rem;">进入下一关 →</button>`
        : ''}
    </div>
  `;

  overlay.appendChild(card);

  // 注入动画样式（一次性）
  if (!document.getElementById('finish-card-keyframes')) {
    const style = document.createElement('style');
    style.id = 'finish-card-keyframes';
    style.textContent = `
      @keyframes finishCardFadeIn {
        from { opacity: 0; transform: scale(0.94); }
        to   { opacity: 1; transform: scale(1); }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(overlay);

  // 按钮事件
  document.getElementById('finish-card-close').addEventListener('click', () => overlay.remove());
  document.getElementById('finish-card-replay').addEventListener('click', () => {
    overlay.remove();
    resetLevel();
  });
  // 进入下一关（若存在）
  const btnNext = document.getElementById('finish-card-next');
  if (btnNext) {
    btnNext.addEventListener('click', async () => {
      overlay.remove();
      await loadLevel(currentLevelIndex + 1);
    });
  }
}

/**
 * 构件百科气泡：抓取瞬间在屏幕左下角弹出小卡片
 * 显示「构件名 + 一句介绍」，松手时或 5 秒后自动隐藏
 */
let _piecePopupTimer = null;
function showPiecePopup(partID) {
  hidePiecePopup(); // 先清旧

  let popup = document.getElementById('piece-popup');
  if (!popup) {
    popup = document.createElement('div');
    popup.id = 'piece-popup';
    popup.style.cssText = `
      position: fixed;
      left: 24px;
      bottom: 110px;
      max-width: 320px;
      padding: 14px 18px;
      background: linear-gradient(180deg, rgba(40, 28, 22, 0.94), rgba(28, 20, 16, 0.94));
      border: 1px solid rgba(255, 215, 0, 0.40);
      border-left: 3px solid #ffd24a;
      border-radius: 8px;
      box-shadow: 0 6px 24px rgba(0, 0, 0, 0.5);
      color: #f4e8d8;
      font-family: var(--font-body, system-ui);
      pointer-events: none;
      z-index: 1600;
      opacity: 0;
      transform: translateX(-12px);
      transition: opacity 220ms ease-out, transform 220ms ease-out;
    `;
    document.body.appendChild(popup);
  }

  const displayName = getDisplayName(partID);
  const lore = getPieceLore(partID);
  popup.innerHTML = `
    <div style="font-size:1.05rem;font-weight:600;color:#ffd24a;margin-bottom:6px;letter-spacing:1px;">
      ${displayName}
    </div>
    <div style="font-size:0.88rem;line-height:1.6;color:#e8dcc8;">
      ${lore || '<span style="color:#a89070;font-style:italic;">（待补充介绍）</span>'}
    </div>
  `;

  // 动画进入
  requestAnimationFrame(() => {
    popup.style.opacity = '1';
    popup.style.transform = 'translateX(0)';
  });

  // 自动隐藏（兜底，如果用户长时间抓着）
  if (_piecePopupTimer) clearTimeout(_piecePopupTimer);
  _piecePopupTimer = setTimeout(hidePiecePopup, 5000);
}

function hidePiecePopup() {
  if (_piecePopupTimer) { clearTimeout(_piecePopupTimer); _piecePopupTimer = null; }
  const popup = document.getElementById('piece-popup');
  if (!popup) return;
  popup.style.opacity = '0';
  popup.style.transform = 'translateX(-12px)';
  setTimeout(() => popup.remove(), 240);
}

/**
 * 重置当前关卡：所有构件回备料架、清状态、清特效、HUD 刷新
 * 触发：点底部"重新开始"按钮 / 按 R 键 / 点完成讲解卡的"再玩一次"
 */
function resetLevel() {
  console.log('[Reset] 重置关卡');

  // 1. 所有构件回到初始位置 + 重置状态
  interactivePieces.forEach(piece => {
    if (piece.userData.initialPosition) {
      piece.position.copy(piece.userData.initialPosition);
    }
    if (piece.userData.initialQuaternion) {
      piece.quaternion.copy(piece.userData.initialQuaternion);
    } else {
      piece.quaternion.identity();
    }
    if (piece.userData.initialScale) {
      piece.scale.copy(piece.userData.initialScale);
    }
    piece.userData.isSnapped = false;
    piece.userData.isDraggable = true;
    unhighlightPiece(piece);
    clearNextPiecePulse(piece);
  });
  nextPiecePulseID = null;

  // 2. 清除目标占用标记
  Object.values(TARGET_CONFIG).forEach(t => { t.isOccupied = false; });

  // 3. 清除胜利粒子（可能还在动画中）
  victoryParticles.forEach(p => {
    scene.remove(p.mesh);
    p.mesh.geometry.dispose();
    p.mesh.material.dispose();
  });
  victoryParticles.length = 0;
  victoryEffectActive = false;

  // 4. 清除残留吸附脉冲
  snapPulses.forEach(p => {
    scene.remove(p.mesh);
    p.mesh.geometry.dispose();
    p.mesh.material.dispose();
  });
  snapPulses.length = 0;

  // 5. 关闭提示模式（如果开着）
  if (hintEnabled) {
    hideHintPreview();
    hintEnabled = false;
    const btn = document.getElementById('btn-hint');
    if (btn) {
      btn.textContent = '提示 (H)';
      btn.style.removeProperty('background');
    }
  }

  // 6. 清空当前抓取状态
  if (isGrabbing && grabbedObject) {
    unhighlightPiece(grabbedObject);
    setCursorGrabState(false);
    grabbedObject = null;
    isGrabbing = false;
    pinchOffFrames = 0;
  }

  // 7. 隐藏接近呼吸提示
  if (proximityActive) {
    hideProximityHint();
    proximityActive = false;
  }

  // 8. 中断进行中的绕飞 / 复位动画
  if (flyAroundActive) flyAroundActive = false;
  if (cameraResetting) cameraResetting = false;

  // 9. 关闭可能还开着的讲解卡 / 知识图浮层
  document.getElementById('finish-card-overlay')?.remove();
  document.getElementById('knowledge-overlay')?.remove();

  // 10. 刷新 HUD
  updateHUDStatus();
  // 11. 重新点亮"下一应装构件"的备料架引导脉冲（重置后通常仍然是首步）
  refreshNextPiecePulse();
  showToast('关卡已重置 · 重新开始', 1400, 'info');
}

/**
 * 完成特效：在斗拱中心生成 60 个金色粒子，螺旋上升 + 旋转 + 渐隐，约 4 秒
 */
function spawnVictoryParticles() {
  if (victoryEffectActive) return; // 防止重复触发
  victoryEffectActive = true;

  // 取所有已就位构件的中心点作为粒子中心，避免硬编码
  const center = new THREE.Vector3(0, 0, 0);
  let count = 0;
  interactivePieces.forEach(p => {
    if (p.userData.isSnapped) {
      center.add(p.position);
      count++;
    }
  });
  if (count > 0) center.divideScalar(count);
  else center.set(0, 1.85, 0);

  const PARTICLE_COUNT = 60;
  const COLORS = [0xffd700, 0xffae42, 0xffe89c, 0xff8c42]; // 金/橙金/浅金/朱

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const radius = 0.25 + Math.random() * 1.4;
    const angle = Math.random() * Math.PI * 2;
    const yOffset = (Math.random() - 0.3) * 0.6;

    const size = 0.025 + Math.random() * 0.035;
    const geo = new THREE.SphereGeometry(size, 8, 8);
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const mat = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
      blending: THREE.AdditiveBlending, // 加色混合让金光叠出辉光感
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(
      center.x + Math.cos(angle) * radius,
      center.y + yOffset,
      center.z + Math.sin(angle) * radius
    );
    scene.add(mesh);

    victoryParticles.push({
      mesh,
      center: center.clone(),
      angle,
      radius,
      yOffset,
      vy: 0.4 + Math.random() * 0.6,           // 上升速度（米/秒）
      angularSpeed: 0.8 + Math.random() * 1.6, // 弧度/秒
      radiusShrink: 0.15 + Math.random() * 0.35, // 半径收缩比例
      startTime: performance.now(),
      lifetime: 3500 + Math.random() * 1500,
    });
  }
  console.log(`[Particles] 已生成 ${PARTICLE_COUNT} 颗金色粒子`);
}

/**
 * 在 animate 循环里调用：更新所有金色粒子的位置和透明度
 */
function updateVictoryParticles() {
  if (victoryParticles.length === 0) return;
  const now = performance.now();

  for (let i = victoryParticles.length - 1; i >= 0; i--) {
    const p = victoryParticles[i];
    const elapsed = now - p.startTime;
    const t = Math.min(1, elapsed / p.lifetime);

    if (t >= 1) {
      scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
      victoryParticles.splice(i, 1);
      continue;
    }

    // easeOutQuad 让粒子前期快上升、后期减速
    const ease = 1 - (1 - t) * (1 - t);

    const curAngle = p.angle + p.angularSpeed * (elapsed / 1000);
    const curRadius = p.radius * (1 - p.radiusShrink * t);
    p.mesh.position.x = p.center.x + Math.cos(curAngle) * curRadius;
    p.mesh.position.z = p.center.z + Math.sin(curAngle) * curRadius;
    p.mesh.position.y = p.center.y + p.yOffset + p.vy * (elapsed / 1000);

    // 透明度：先稳定一阵再渐隐（前 60% 时间满透明，后 40% 渐隐）
    if (t < 0.6) {
      p.mesh.material.opacity = 1.0;
    } else {
      p.mesh.material.opacity = 1.0 - (t - 0.6) / 0.4;
    }
  }

  // 全部消散后释放标志
  if (victoryParticles.length === 0) {
    victoryEffectActive = false;
  }
}

/**
 * 环境尘埃粒子：N 颗常驻金色光点缓慢下落 + 水平漂移 + 闪烁
 * 落出场景边界时回到顶部继续，不创建/销毁，性能稳定
 */
function initAmbientParticles() {
  if (ambientParticles.length > 0) return; // 防重复

  for (let i = 0; i < AMBIENT_PARTICLE_COUNT; i++) {
    const size = 0.012 + Math.random() * 0.016;
    const colors = [0xffe88a, 0xffd24a, 0xfff0b8]; // 三档暖金
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(size, 6, 6),
      new THREE.MeshBasicMaterial({
        color: colors[Math.floor(Math.random() * colors.length)],
        transparent: true,
        opacity: 0.25 + Math.random() * 0.30,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    // 场景大约 X[-6, 6] Z[-3, 3] Y[0, 5]
    mesh.position.set(
      (Math.random() - 0.5) * 12,
      Math.random() * 5,
      (Math.random() - 0.5) * 6
    );
    mesh.renderOrder = 100; // 在大部分构件之上但在光标之下
    scene.add(mesh);

    ambientParticles.push({
      mesh,
      vy: -0.05 - Math.random() * 0.10, // 下降速度（米/秒）
      vx: (Math.random() - 0.5) * 0.04, // 水平漂移
      vz: (Math.random() - 0.5) * 0.04,
      twinkleSpeed: 0.6 + Math.random() * 1.8,
      twinkleOffset: Math.random() * Math.PI * 2,
      baseOpacity: 0.30 + Math.random() * 0.25,
    });
  }
  console.log(`[Ambient] 已初始化 ${AMBIENT_PARTICLE_COUNT} 颗环境粒子`);
}

function updateAmbientParticles() {
  if (!ambientParticlesEnabled || ambientParticles.length === 0) return;

  const now = performance.now();
  const dt = Math.min(0.05, (now - _ambientLastTime) / 1000); // 钳制避免卡顿/标签隐藏导致大跳
  _ambientLastTime = now;

  for (const p of ambientParticles) {
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt;
    p.mesh.position.z += p.vz * dt;

    // 落出范围 → 回到顶部重生
    if (p.mesh.position.y < -0.3 ||
        Math.abs(p.mesh.position.x) > 6.5 ||
        Math.abs(p.mesh.position.z) > 3.5) {
      p.mesh.position.set(
        (Math.random() - 0.5) * 12,
        4.5 + Math.random() * 0.8,
        (Math.random() - 0.5) * 6
      );
    }

    // 闪烁：透明度正弦脉动
    const phase = (now / 1000) * p.twinkleSpeed + p.twinkleOffset;
    p.mesh.material.opacity = p.baseOpacity * (0.55 + 0.45 * Math.sin(phase));
  }
}

/**
 * 切换光标抓取状态：仅设置目标 pinchProgress，实际过渡由 updateCursorPinchAnim 每帧插值
 * 抓取瞬间额外 spawn 一次金色脉冲环（不常驻）
 */
function setCursorGrabState(grabbing) {
  cursorPinchTarget = grabbing ? 1 : 0;
  if (grabbing) spawnGrabPulse();
}

/**
 * 通用光标状态动画：每帧把 pinchProgress 向 pinchTarget 平滑逼近，再根据当前风格驱动视觉
 *   方案 C：t=0 双点分离 + 青玉色，t=1 合并 + 朱砂红 + 微变大
 *   方案 B：t=0 朱砂主点 + 极细金圈淡，t=1 主点缩紧+鲜红、金圈缩紧+亮起
 */
function updateCursorPinchAnim() {
  // 平滑逼近目标（C / B 通用）
  cursorPinchProgress += (cursorPinchTarget - cursorPinchProgress) * CURSOR_PINCH_LERP;
  if (Math.abs(cursorPinchTarget - cursorPinchProgress) < 0.001) {
    cursorPinchProgress = cursorPinchTarget;
  }
  const t = cursorPinchProgress;

  if (CURSOR_STYLE === 'C') {
    if (!cursorDotA || !cursorDotB) return;

    // 距离插值：t=0 GAP 全开，t=1 合并
    const gap = CURSOR_DOT_GAP * (1 - t);
    cursorDotA.position.x = -gap / 2;
    cursorDotB.position.x = gap / 2;

    // 颜色 IDLE → GRAB
    const ir = (CURSOR_COLOR_IDLE >> 16) & 0xff;
    const ig = (CURSOR_COLOR_IDLE >> 8) & 0xff;
    const ib = CURSOR_COLOR_IDLE & 0xff;
    const gr = (CURSOR_COLOR_GRAB >> 16) & 0xff;
    const gg = (CURSOR_COLOR_GRAB >> 8) & 0xff;
    const gb = CURSOR_COLOR_GRAB & 0xff;
    const r = Math.round(ir * (1 - t) + gr * t);
    const g = Math.round(ig * (1 - t) + gg * t);
    const b = Math.round(ib * (1 - t) + gb * t);
    const blend = (r << 16) | (g << 8) | b;
    cursorDotA.material.color.setHex(blend);
    cursorDotB.material.color.setHex(blend);

    let scale = 1 + t * 0.4;
    if (t < 0.3) {
      const breathe = 1 + Math.sin(performance.now() * 0.0022) * 0.07;
      scale *= breathe;
    }
    cursorDotA.scale.setScalar(scale);
    cursorDotB.scale.setScalar(scale);
  } else if (CURSOR_STYLE === 'B') {
    if (!cursorMain || !cursorOutline) return;

    // 主点：朱砂 → 鲜红，缩紧 1.0 → 0.78
    const ir = (CURSOR_COLOR_MAIN_IDLE_B >> 16) & 0xff;
    const ig = (CURSOR_COLOR_MAIN_IDLE_B >> 8) & 0xff;
    const ib = CURSOR_COLOR_MAIN_IDLE_B & 0xff;
    const gr = (CURSOR_COLOR_MAIN_GRAB_B >> 16) & 0xff;
    const gg = (CURSOR_COLOR_MAIN_GRAB_B >> 8) & 0xff;
    const gb = CURSOR_COLOR_MAIN_GRAB_B & 0xff;
    const r = Math.round(ir * (1 - t) + gr * t);
    const g = Math.round(ig * (1 - t) + gg * t);
    const b = Math.round(ib * (1 - t) + gb * t);
    cursorMain.material.color.setHex((r << 16) | (g << 8) | b);
    cursorMain.material.opacity = 0.85 + t * 0.12; // 0.85 → 0.97

    let mainScale = 1 - t * 0.22; // 抓取时缩紧
    if (t < 0.3) {
      const breathe = 1 + Math.sin(performance.now() * 0.0022) * 0.08;
      mainScale *= breathe;
    }
    cursorMain.scale.setScalar(mainScale);

    // 金圈轮廓：变亮 + 略缩紧
    cursorOutline.material.opacity = 0.40 + t * 0.45; // 0.40 → 0.85
    cursorOutline.scale.setScalar(1 - t * 0.15);      // 1.0 → 0.85
    // billboard：始终面向相机，避免轮廓圈侧视看成一条线
    cursorOutline.lookAt(camera.position);
  }
}

/**
 * 抓取瞬间脉冲环：金色 RingGeometry，220ms 内由小变大并渐隐，替代常驻光晕
 */
function spawnGrabPulse() {
  if (!cursorSphere) return;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.08, 0.10, 32),
    new THREE.MeshBasicMaterial({
      color: 0xffd24a, // 金色
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  ring.position.copy(cursorSphere.position);
  ring.lookAt(camera.position);
  ring.renderOrder = 998;
  scene.add(ring);
  grabPulses.push({
    mesh: ring,
    startTime: performance.now(),
    lifetime: 220,
  });
}

function updateGrabPulses() {
  if (grabPulses.length === 0) return;
  const now = performance.now();
  for (let i = grabPulses.length - 1; i >= 0; i--) {
    const p = grabPulses[i];
    const t = (now - p.startTime) / p.lifetime;
    if (t >= 1) {
      scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
      grabPulses.splice(i, 1);
      continue;
    }
    p.mesh.lookAt(camera.position);
    p.mesh.scale.setScalar(1 + t * 4);   // 从 0.1 扩到 ~0.5
    p.mesh.material.opacity = 0.85 * (1 - t);
  }
}

/**
 * 单构件吸附时的短促反馈：3 层同心金环（参考图）+ 6 颗散点，错峰扩散
 * 替代原来的常驻金光晕，避免和槽位高亮抢信息
 */
function spawnSnapPulse(piece) {
  const pos = piece.position.clone();
  const now = performance.now();

  // 三层同心金环：内环最快/最亮，外环最慢/最淡 — 营造"涟漪"层次感
  const ringSpecs = [
    { inner: 0.08, outer: 0.090, opacity: 0.95, lifetime: 240, scaleMax: 5,  delay: 0   },
    { inner: 0.14, outer: 0.155, opacity: 0.78, lifetime: 320, scaleMax: 4,  delay: 60  },
    { inner: 0.20, outer: 0.218, opacity: 0.55, lifetime: 420, scaleMax: 3,  delay: 130 },
  ];
  ringSpecs.forEach((spec) => {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(spec.inner, spec.outer, 36),
      new THREE.MeshBasicMaterial({
        color: 0xffd24a,
        transparent: true,
        opacity: spec.opacity,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    ring.position.copy(pos);
    ring.lookAt(camera.position);
    ring.renderOrder = 998;
    scene.add(ring);
    snapPulses.push({
      mesh: ring,
      type: 'ring',
      startTime: now + spec.delay,   // 延迟启动，错峰扩散
      lifetime: spec.lifetime,
      basePos: pos.clone(),
      maxScale: spec.scaleMax,
      baseOpacity: spec.opacity,
    });
  });

  // 6 颗金色散点：以构件中心为圆心向外抛散
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + Math.random() * 0.3;
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.025, 8, 8),
      new THREE.MeshBasicMaterial({
        color: 0xffd24a,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    dot.position.copy(pos);
    dot.renderOrder = 998;
    scene.add(dot);
    snapPulses.push({
      mesh: dot,
      type: 'dot',
      startTime: now,
      lifetime: 380,
      basePos: pos.clone(),
      angle,
      maxRadius: 0.35 + Math.random() * 0.25,
    });
  }
}

function updateSnapPulses() {
  if (snapPulses.length === 0) return;
  const now = performance.now();
  for (let i = snapPulses.length - 1; i >= 0; i--) {
    const p = snapPulses[i];
    // delay 期间还没开始，先保持隐藏
    const elapsed = now - p.startTime;
    if (elapsed < 0) {
      p.mesh.material.opacity = 0;
      continue;
    }
    const t = elapsed / p.lifetime;
    if (t >= 1) {
      scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
      snapPulses.splice(i, 1);
      continue;
    }
    if (p.type === 'ring') {
      p.mesh.lookAt(camera.position);
      const maxScale = p.maxScale || 4;
      const baseOp = p.baseOpacity || 0.85;
      p.mesh.scale.setScalar(1 + t * (maxScale - 1));
      p.mesh.material.opacity = baseOp * (1 - t);
    } else {
      // 散点：圆周扩散 + 轻微抛物线 + 渐隐
      const r = p.maxRadius * t;
      p.mesh.position.x = p.basePos.x + Math.cos(p.angle) * r;
      p.mesh.position.z = p.basePos.z + Math.sin(p.angle) * r;
      p.mesh.position.y = p.basePos.y + 0.12 * Math.sin(t * Math.PI);
      p.mesh.material.opacity = 0.9 * (1 - t);
      p.mesh.scale.setScalar(1 - t * 0.6);
    }
  }
}

/**
 * 槽位"靠近呼吸"提示：抓住构件且接近目标时自动显示金色目标轮廓
 * - hintEnabled = true 时不显示（避免和 H 键主动提示重复）
 * - 距离 < PROXIMITY_SHOW_DIST 时显示，距离 > PROXIMITY_HIDE_DIST 时隐藏（滞后防抖）
 */
function showProximityHint(piece) {
  if (proximityMesh) return;
  const target = TARGET_CONFIG[piece.userData.partID];
  if (!target) return;

  // 分支 A：originalNode 是 Mesh（第一关 ghost 内部"配套"mesh）— 复用 geometry，开销低
  if (target.originalNode && target.originalNode.geometry) {
    const sourceNode = target.originalNode;
    const worldScale = new THREE.Vector3();
    sourceNode.getWorldScale(worldScale);
    proximityMesh = new THREE.Mesh(
      sourceNode.geometry,
      new THREE.MeshBasicMaterial({
        color: 0xffd24a, transparent: true, opacity: 0.4,
        depthWrite: false, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      })
    );
    proximityMesh.position.copy(target.position);
    proximityMesh.quaternion.copy(target.quaternion);
    proximityMesh.scale.copy(worldScale);
    scene.add(proximityMesh);
    return;
  }

  // 分支 B：第二关整体建模（性能优化版）— 用简单金色环替代克隆 piece
  // 原版 piece.clone(true) 渲染整组 mesh 太重，第二关 GLB 上百面 ×3 同模型同时渲染会卡顿
  // 改成单个圆环（24 面）：玩家看到金色光晕就知道"接近 target"，体感等价但 GPU 开销 1/100
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.18, 0.30, 24),
    new THREE.MeshBasicMaterial({
      color: 0xffd24a, transparent: true, opacity: 0.55,
      side: THREE.DoubleSide, depthTest: false, depthWrite: false,
    })
  );
  ring.userData._proxyHint = true;
  ring.position.copy(target.position);
  ring.lookAt(camera.position); // 始终面对相机
  ring.renderOrder = 998;
  proximityMesh = ring;
  scene.add(proximityMesh);
}

function hideProximityHint() {
  if (!proximityMesh) return;
  scene.remove(proximityMesh);
  // 第二关 ring 模式：geometry 是新建的，可以 dispose；material 也新建可 dispose
  if (proximityMesh.userData && proximityMesh.userData._proxyHint) {
    if (proximityMesh.geometry) proximityMesh.geometry.dispose();
  }
  // 通用：material 总是新建的，可 dispose（第一关 geometry 共享自 ghost mesh，不动）
  if (proximityMesh.material) proximityMesh.material.dispose();
  proximityMesh = null;
}

function updateProximityHint() {
  // 没有抓 / 主动提示已开 → 不显示
  if (!isGrabbing || !grabbedObject || hintEnabled) {
    if (proximityActive) {
      hideProximityHint();
      proximityActive = false;
    }
    return;
  }

  const target = TARGET_CONFIG[grabbedObject.userData.partID];
  if (!target) return;

  const dist = grabbedObject.position.distanceTo(target.position);

  // 进入条件
  if (!proximityActive && dist < PROXIMITY_SHOW_DIST) {
    showProximityHint(grabbedObject);
    proximityActive = true;
  }
  // 退出条件（滞后）
  else if (proximityActive && dist > PROXIMITY_HIDE_DIST) {
    hideProximityHint();
    proximityActive = false;
  }

  // 呼吸：opacity 在 0.25 ~ 0.65 之间正弦波动，2 秒一周期
  if (proximityActive && proximityMesh) {
    const opacity = 0.45 + Math.sin(performance.now() * 0.003) * 0.20;
    proximityMesh.material.opacity = opacity;
  }
}

/**
 * 三态拖尾：颜色（青→红）、寿命（长→短）随 cursorPinchProgress 平滑插值
 */
function spawnCursorTrail() {
  if (!cursorSphere || !cursorSphere.visible) return;
  trailFrameCounter++;
  if (trailFrameCounter < TRAIL_SPAWN_INTERVAL_FRAMES) return;
  trailFrameCounter = 0;

  // 满载时丢弃最早的一颗，防止无限增长
  if (cursorTrail.length >= TRAIL_MAX_COUNT) {
    const old = cursorTrail.shift();
    scene.remove(old.mesh);
    old.mesh.geometry.dispose();
    old.mesh.material.dispose();
  }

  // 当前状态进度：0=松开，1=抓取
  const t = cursorPinchProgress;

  // 颜色插值：浅冷青蓝 → 暖红
  const ir = (CURSOR_COLOR_TRAIL_IDLE >> 16) & 0xff;
  const ig = (CURSOR_COLOR_TRAIL_IDLE >> 8) & 0xff;
  const ib = CURSOR_COLOR_TRAIL_IDLE & 0xff;
  const gr = (CURSOR_COLOR_TRAIL_GRAB >> 16) & 0xff;
  const gg = (CURSOR_COLOR_TRAIL_GRAB >> 8) & 0xff;
  const gb = CURSOR_COLOR_TRAIL_GRAB & 0xff;
  const r = Math.round(ir * (1 - t) + gr * t);
  const g = Math.round(ig * (1 - t) + gg * t);
  const b = Math.round(ib * (1 - t) + gb * t);
  const trailColor = (r << 16) | (g << 8) | b;

  // 寿命/透明度/尺寸都随状态插值
  const lifetime = TRAIL_LIFETIME_IDLE_MS * (1 - t) + TRAIL_LIFETIME_GRAB_MS * t;
  const baseOpacity = TRAIL_OPACITY_IDLE * (1 - t) + TRAIL_OPACITY_GRAB * t;
  const radius = TRAIL_RADIUS_IDLE * (1 - t) + TRAIL_RADIUS_GRAB * t;

  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 8, 8),
    new THREE.MeshBasicMaterial({
      color: trailColor,
      transparent: true,
      opacity: baseOpacity,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  mesh.position.copy(cursorSphere.position);
  mesh.renderOrder = 998;
  scene.add(mesh);

  cursorTrail.push({
    mesh,
    startTime: performance.now(),
    lifetime,
    baseOpacity, // 保留初始透明度，update 里按 (1-t) 衰减
  });
}

/**
 * 在 animate 主循环里调用：更新拖尾粒子的透明度和大小
 */
function updateCursorTrail() {
  if (cursorTrail.length === 0) return;
  const now = performance.now();
  for (let i = cursorTrail.length - 1; i >= 0; i--) {
    const p = cursorTrail[i];
    const t = (now - p.startTime) / p.lifetime;
    if (t >= 1) {
      scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
      cursorTrail.splice(i, 1);
      continue;
    }
    p.mesh.material.opacity = (p.baseOpacity ?? 0.55) * (1 - t);
    const s = 1.0 - t * 0.7; // 缩小到 30%
    p.mesh.scale.setScalar(s);
  }
}

/**
 * 屏幕晃动效果（拼接失败反馈）— 减弱版本，避免过度打扰
 */
function shakeCamera() {
  const originalPos = camera.position.clone();
  const intensity = 0.04;
  const duration = 200;
  const startTime = performance.now();

  function doShake() {
    const elapsed = performance.now() - startTime;
    if (elapsed >= duration) {
      camera.position.copy(originalPos);
      return;
    }
    const decay = 1 - elapsed / duration;
    camera.position.x = originalPos.x + (Math.random() - 0.5) * intensity * 2 * decay;
    camera.position.y = originalPos.y + (Math.random() - 0.5) * intensity * 2 * decay;
    requestAnimationFrame(doShake);
  }
  doShake();
}

/**
 * 抓取时高亮构件（强烈的金黄色发光，确保用户清晰看到自己抓住了哪个构件）
 */
function highlightPiece(piece) {
  piece.traverse((child) => {
    if (child.isMesh && child.material) {
      child.userData._savedEmissive = child.material.emissive ? child.material.emissive.clone() : null;
      child.userData._savedEmissiveIntensity = child.material.emissiveIntensity ?? 0;
      if (child.material.emissive) {
        child.material.emissive.setHex(0xffcc33); // 金黄色
        child.material.emissiveIntensity = 1.2;    // 高强度，明显可见
      }
    }
  });
}

/**
 * 释放时取消高亮
 */
function unhighlightPiece(piece) {
  piece.traverse((child) => {
    if (child.isMesh && child.material) {
      if (child.userData._savedEmissive) {
        child.material.emissive.copy(child.userData._savedEmissive);
        child.material.emissiveIntensity = child.userData._savedEmissiveIntensity ?? 0;
        delete child.userData._savedEmissive;
        delete child.userData._savedEmissiveIntensity;
      }
    }
  });
}

/**
 * 还原指定 piece 上由 next-piece 脉冲叠加的 emissive 颜色/强度。
 * 使用独立的 _pulseSavedEmissive 备份槽，避免与 grab 高亮的 _savedEmissive 互相覆盖。
 */
function clearNextPiecePulse(piece) {
  if (!piece) return;
  piece.traverse((child) => {
    if (child.isMesh && child.material && child.userData._pulseSavedEmissive !== undefined) {
      if (child.material.emissive) {
        child.material.emissive.copy(child.userData._pulseSavedEmissive);
      }
      child.material.emissiveIntensity = child.userData._pulseSavedEmissiveIntensity ?? 0;
      delete child.userData._pulseSavedEmissive;
      delete child.userData._pulseSavedEmissiveIntensity;
    }
  });
}

/**
 * 把"下一应装构件"的脉冲目标推进到 ASSEMBLY_ORDER 当前步的第一个未完成 piece。
 * 调用时机：关卡加载完成 / 重置关卡 / 每次松手判定后。
 * 同层多构件时只脉动顺序里的第一个，与 showHintPreview 的策略保持一致，避免视觉杂乱。
 */
function refreshNextPiecePulse() {
  if (nextPiecePulseID) {
    const prev = interactivePieces.find(p => p.userData.partID === nextPiecePulseID);
    if (prev) clearNextPiecePulse(prev);
  }
  nextPiecePulseID = null;

  const remaining = getCurrentStepPieces();
  if (!remaining || remaining.length === 0) return;
  nextPiecePulseID = remaining[0];
  nextPiecePulseStartTime = performance.now();
}

/**
 * 渲染循环中调用：在备料架上的下一构件应用一次柔和的金色 emissive 呼吸。
 * - 周期 1.6s，强度 0.25 ~ 0.9 正弦摆动
 * - 玩家正在抓该构件时让位给 grab 高亮，避免 emissive 互相覆盖
 * - 该 piece 已被吸附则自动推进到下一目标
 */
function updateNextPiecePulse() {
  if (!nextPiecePulseID) return;
  const piece = interactivePieces.find(p => p.userData.partID === nextPiecePulseID);
  if (!piece) return;

  if (piece.userData.isSnapped) {
    refreshNextPiecePulse();
    return;
  }
  if (isGrabbing && grabbedObject === piece) return;

  const t = (performance.now() - nextPiecePulseStartTime) / 1000;
  const intensity = 0.25 + 0.65 * (0.5 + 0.5 * Math.sin(t * 2 * Math.PI / 1.6));

  piece.traverse((child) => {
    if (child.isMesh && child.material && child.material.emissive) {
      if (child.userData._pulseSavedEmissive === undefined) {
        child.userData._pulseSavedEmissive = child.material.emissive.clone();
        child.userData._pulseSavedEmissiveIntensity = child.material.emissiveIntensity ?? 0;
      }
      child.material.emissive.setHex(0xffcc33);
      child.material.emissiveIntensity = intensity;
    }
  });
}

// ===================== 首步锚点（仅第二关）=====================
// 第二关木质材质 emissive 反应弱，再叠加一个浮空金色倒锥 + 光环作为视觉锚点。
// 触发条件：currentLevel.id === 2 && piece 是 ASSEMBLY_ORDER 第一步 && 未拼接 && 不在抓取
let firstPieceAnchor = null;
function createFirstPieceAnchor() {
  const grp = new THREE.Group();
  // 倒锥（尖朝下指向零件）
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(0.08, 0.22, 18),
    new THREE.MeshBasicMaterial({
      color: 0xffd24a, transparent: true, opacity: 0.9,
      depthTest: false, depthWrite: false,
    })
  );
  cone.rotation.x = Math.PI;
  cone.position.y = 0.0;
  cone.renderOrder = 998;
  grp.add(cone);
  // 圆环底座（在锥尖下方扁平摆放，强化"这里"）
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.11, 0.18, 28),
    new THREE.MeshBasicMaterial({
      color: 0xffd24a, transparent: true, opacity: 0.55,
      side: THREE.DoubleSide, depthTest: false, depthWrite: false,
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -0.13;
  ring.renderOrder = 998;
  grp.add(ring);
  return grp;
}
function disposeFirstPieceAnchor() {
  if (!firstPieceAnchor) return;
  scene.remove(firstPieceAnchor);
  firstPieceAnchor.traverse((c) => {
    if (c.geometry) c.geometry.dispose();
    if (c.material) c.material.dispose();
  });
  firstPieceAnchor = null;
}
function updateFirstPieceAnchor() {
  // 仅第二关启用
  const enable = currentLevel && currentLevel.id === 2;
  if (!enable) {
    if (firstPieceAnchor) firstPieceAnchor.visible = false;
    return;
  }
  // 找到首步首个 piece
  if (!ASSEMBLY_ORDER || ASSEMBLY_ORDER.length === 0) {
    if (firstPieceAnchor) firstPieceAnchor.visible = false;
    return;
  }
  const firstID = ASSEMBLY_ORDER[0][0];
  const piece = interactivePieces.find(p => p.userData.partID === firstID);
  if (!piece || piece.userData.isSnapped || (isGrabbing && grabbedObject === piece)) {
    if (firstPieceAnchor) firstPieceAnchor.visible = false;
    return;
  }
  if (!firstPieceAnchor) {
    firstPieceAnchor = createFirstPieceAnchor();
    scene.add(firstPieceAnchor);
  }
  firstPieceAnchor.visible = true;
  // 跟随 piece 头顶
  const wp = new THREE.Vector3();
  piece.getWorldPosition(wp);
  const t = performance.now() * 0.001;
  const bob = Math.sin(t * 2 * Math.PI / 1.8) * 0.07;
  firstPieceAnchor.position.set(wp.x, wp.y + 0.55 + bob, wp.z);
  // 透明度呼吸：0.45 ~ 0.95
  const breath = 0.45 + 0.50 * (0.5 + 0.5 * Math.sin(t * 2 * Math.PI / 1.6));
  if (firstPieceAnchor.children[0] && firstPieceAnchor.children[0].material) {
    firstPieceAnchor.children[0].material.opacity = breath;
  }
  if (firstPieceAnchor.children[1] && firstPieceAnchor.children[1].material) {
    firstPieceAnchor.children[1].material.opacity = breath * 0.7;
  }
  // 让锥+环始终面对相机的 Y 轴方向无关（旋转一圈以增加生命感）
  firstPieceAnchor.rotation.y = t * 0.6;
}

/**
 * 抓取时显示目标槽位提示（半透明光环）
 */
function showTargetHint(partID) {
  hideTargetHint();
  const target = TARGET_CONFIG[partID];
  if (!target) return;

  const geo = new THREE.RingGeometry(0.25, 0.45, 32);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffcc00, transparent: true, opacity: 0.45,
    side: THREE.DoubleSide, depthTest: false
  });
  targetHintMesh = new THREE.Mesh(geo, mat);
  targetHintMesh.position.copy(target.position);
  targetHintMesh.lookAt(camera.position);
  targetHintMesh.renderOrder = 998;
  scene.add(targetHintMesh);
}

/**
 * 隐藏目标槽位提示
 */
function hideTargetHint() {
  if (targetHintMesh) {
    scene.remove(targetHintMesh);
    targetHintMesh.geometry.dispose();
    targetHintMesh.material.dispose();
    targetHintMesh = null;
  }
}

// ===================== 手势映射到3D空间 =====================
function mapGestureTo3D(gesture) {
  // MediaPipe坐标：x(0-1, 左到右), y(0-1, 上到下)
  // 摄像头镜像导致左右相反，需要翻转X轴
  
  // ⭐ 放大模式真精度方案：灵敏度 × 1/ZOOM_FACTOR²
  // 数学：摄像机已推进 ZOOM_FACTOR 倍（屏幕单位变大），若灵敏度仅 ÷ZOOM_FACTOR 则两者相消，
  // 屏幕上手势-光标比仍 1:1 → 精度未变。再多 ÷ZOOM_FACTOR 一次，光标在屏幕上的移动速度
  // 才会变成手势的 1/ZOOM_FACTOR，得到真正的精细操作（精度提升 ZOOM_FACTOR 倍）。
  // 副作用：光标可达范围缩到屏幕中央 ~1/ZOOM_FACTOR，边缘部件需要左键拖动/方向键平移视野补偿。
  const sensFactor = zoomEnabled ? (1 / (ZOOM_FACTOR * ZOOM_FACTOR)) : 1.0;
  // 设置面板可调灵敏度倍率（默认 1.0，范围 0.5 ~ 2.0）
  const userScale = gestureSensitivityScale;

  const targetX = -(gesture.x - 0.5) * GESTURE_SENSITIVITY_X * sensFactor * userScale;
  // ⭐ Y 偏移：原 +0.5 让光标永远在 0.5m 以上，第二关 dock 零件 Y=0.1 永远够不着（左下死区）。
  // 改为 -0.5 → 光标可达 Y ∈ [-0.5, 4.5]（GESTURE_SENSITIVITY_Y=4），覆盖地面到 4.5m 高范围。
  const targetY = (1.0 - gesture.y) * GESTURE_SENSITIVITY_Y * sensFactor * userScale - 0.5;
  const targetZ = -0.5;

  return new THREE.Vector3(targetX, targetY, targetZ);
}

// ===================== UI 事件绑定 =====================
function setupUIEvents() {
  const bindEvents = () => {
    const btnStart = document.getElementById('btn-start');
    const pageMenu = document.getElementById('page-menu');
    const gameHud = document.getElementById('page-game-hud');
    const btnHome = document.getElementById('btn-home');
    const btnHint = document.getElementById('btn-hint');
    const btnZoom = document.getElementById('btn-zoom');
    const btnKnowledge = document.getElementById('btn-knowledge');
    const btnReset = document.getElementById('btn-reset');
    const btnSettings = document.getElementById('btn-settings-game');
    const btnCameraReset = document.getElementById('btn-camera-reset');

    // 提示按钮：切换目标轮廓预览
    if (btnHint) {
      btnHint.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleHintMode();
      });
    }

    // 放大按钮：切换放大模式
    if (btnZoom) {
      btnZoom.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleZoomMode();
      });
    }

    // 知识图按钮：弹出/收起本关斗拱知识图浮层
    if (btnKnowledge) {
      btnKnowledge.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleKnowledgeImage();
      });
    }

    // 重置按钮：所有构件回备料架
    if (btnReset) {
      btnReset.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        resetLevel();
      });
    }

    // 设置按钮：打开/关闭设置面板
    if (btnSettings) {
      btnSettings.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleSettingsPanel();
      });
    }

    // 复位机位按钮：平滑动画回到默认视角
    if (btnCameraReset) {
      btnCameraReset.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        resetCameraToDefault();
      });
    }

    // 键盘快捷键：H 提示 / Z 放大 / K 知识图 / R 重置 / , 设置
    document.addEventListener('keydown', (e) => {
      // 只在游戏 HUD 显示时生效，避免在主菜单也响应
      if (!gameHud || gameHud.style.display === 'none') return;
      // 设置面板打开时只放行 Esc，其他热键交给面板自己/避免误触发
      if (document.getElementById('settings-overlay') && e.key !== 'Escape') return;

      if (e.key === 'h' || e.key === 'H') {
        toggleHintMode();
      } else if (e.key === 'z' || e.key === 'Z') {
        toggleZoomMode();
      } else if (e.key === 'k' || e.key === 'K') {
        toggleKnowledgeImage();
      } else if (e.key === 'r' || e.key === 'R') {
        resetLevel();
      } else if (e.key === 'v' || e.key === 'V') {
        resetCameraToDefault();
      } else if (e.key === 'n' || e.key === 'N') {
        // 开发/测试用：N 键直接跳下一关（不必完成当前关）
        const next = currentLevelIndex + 1;
        if (next < LEVELS.length) {
          loadLevel(next);
        } else {
          showToast('已是最后一关', 1400, 'info');
        }
      } else if (e.key === ',') {
        // 半角逗号是齿轮按钮的快捷键（与许多游戏的"设置"键一致）
        toggleSettingsPanel();
      }
    });

    // 开始筑梦按钮
    if (btnStart) {
      btnStart.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('[Main] ✅ 开始筑梦按钮被点击');
        
        if (pageMenu) pageMenu.classList.add('hidden');
        if (gameHud) gameHud.style.display = 'flex';
        if (renderer) {
          renderer.domElement.style.pointerEvents = 'auto'; // ✅ 启用鼠标事件（包括滚轮）
          // ✅ 确保 OrbitControls 能接收事件
          if (controls) {
            controls.enabled = true;
          }
        }
        
        // 启动 BGM（必须放在用户点击后，浏览器才允许 audio.play）
        startBGM();
        
        // 启动手势输入
        try {
          await handInput.start();
          cursorSphere.visible = true;
          console.log('[Main] ✅ 手势输入已启动');
        } catch (error) {
          console.error('[Main] ❌ 手势输入启动失败:', error);
    }
  });
}

    // 返回主页按钮
    if (btnHome) {
      btnHome.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('[Main] ✅ 返回主页按钮被点击');

        // 中断进行中的绕飞动画
        if (flyAroundActive) flyAroundActive = false;

        // 暂停 BGM（让主菜单安静）
        stopBGM();

        // 退出放大模式（不带动画，瞬时还原），避免下次进游戏时仍在放大
        if (zoomEnabled) {
          zoomEnabled = false;
          zoomAnimating = false;
          const offset = camera.position.clone().sub(controls.target);
          offset.multiplyScalar(ZOOM_FACTOR);
          camera.position.copy(controls.target).add(offset);
          if (controls.mouseButtons) {
            controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
          }
          controls.update();
          showZoomBorder(false);
          const btnZoom2 = document.getElementById('btn-zoom');
          if (btnZoom2) {
            btnZoom2.textContent = '放大 (Z)';
            btnZoom2.style.removeProperty('background');
          }
        }
        
        if (pageMenu) pageMenu.classList.remove('hidden');
        if (gameHud) gameHud.style.display = 'none';
        if (renderer) {
          renderer.domElement.style.pointerEvents = 'none';
          // ✅ 禁用 OrbitControls
          if (controls) {
            controls.enabled = false;
          }
        }
        
        // 停止手势输入
        if (handInput) {
          handInput.stop();
          cursorSphere.visible = false;
        }
      });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindEvents);
  } else {
    setTimeout(bindEvents, 100);
  }
}

// ===================== 窗口大小调整 =====================
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  // 保持80%高度
  renderer.domElement.style.height = `${window.innerHeight * 0.8}px`;
}

// ===================== 渲染循环 =====================
function animate() {
  requestAnimationFrame(animate);

  // 更新控制器
  if (controls) {
    controls.update();
  }

  // 手势控制
  if (handInput && handInput.isConnected()) {
    const gesture = handInput.getGesture();
    
    // 映射手势到3D空间
    const worldPos = mapGestureTo3D(gesture);
    
    // ✅ 修复：平滑移动光标（包含Z轴，确保所有轴都平滑）
    smoothCursorX += (worldPos.x - smoothCursorX) * cursorSmoothAlpha;
    smoothCursorY += (worldPos.y - smoothCursorY) * cursorSmoothAlpha;
    smoothCursorZ += (worldPos.z - smoothCursorZ) * cursorSmoothAlpha;
    
    cursorSphere.position.set(smoothCursorX, smoothCursorY, smoothCursorZ);
    
    // 抓取逻辑（状态机：空闲 → 抓取开始 → 拖动中 → 松手防抖 → 松手判定）
    if (gesture.isPinching) {
      // 捏合中：清零防抖计数
      pinchOffFrames = 0;

      if (!isGrabbing) {
        // === 空闲 → 抓取开始 ===
        // ⚠️ 关键：用「屏幕空间」距离，不用世界 3D/2D 距离
        // 原因：摄像头透视下，世界距离 ≠ 用户视觉距离。
        //   - 光标 Z=-0.5，构件 Z=0.5~1.0，世界 XY 距离都很近（散科右与华拱仅 0.28m）
        //   - 用户视觉上"光标挨着哪个构件"取决于屏幕投影位置
        // 改用屏幕空间距离后，光标可视位置挨谁就抓谁，与用户视觉完全一致。
        // NDC 阈值：约 18% 屏幕高度（之前 0.15 在第二关零件分散布局 + 屏幕边缘 mediapipe
        // 检测精度下降时容易"差一点抓不到"。第二关备料架 X 跨度 1.5~2.7 是有意为之的散布，
        // 适度放宽对密集场景影响有限：吸引点用「最近 piece」拣选，不会误抓多个）
        const GRAB_RADIUS_NDC = 0.18;
        const availablePieces = interactivePieces.filter(p => p.userData.isDraggable && !p.userData.isSnapped);

        // 把光标投影到屏幕空间（NDC）
        const cursorNDC = cursorSphere.position.clone().project(camera);
        const pieceNDC = new THREE.Vector3();
        let closestPiece = null;
        let closestDist = Infinity;
        
        availablePieces.forEach((piece) => {
          pieceNDC.copy(piece.position).project(camera);
          const dx = cursorNDC.x - pieceNDC.x;
          const dy = cursorNDC.y - pieceNDC.y;
          const distScreen = Math.sqrt(dx * dx + dy * dy);
          if (distScreen < GRAB_RADIUS_NDC && distScreen < closestDist) {
            closestDist = distScreen;
            closestPiece = piece;
          }
        });
        
        if (closestPiece) {
          grabbedObject = closestPiece;
          isGrabbing = true;
          // 先恢复引导脉冲叠加在 emissive 上的金色，再让 highlightPiece 备份"原始"emissive
          // （顺序很重要，否则松手后会被错误地还原为金色高亮态）
          clearNextPiecePulse(grabbedObject);
          highlightPiece(grabbedObject);
          setCursorGrabState(true); // 双点合并 + 朱砂红 + 金色脉冲一次
          showPiecePopup(closestPiece.userData.partID); // 百科气泡
          console.log(`[Main] ✋ 抓取 ${closestPiece.userData.partID}，屏幕距离: ${closestDist.toFixed(3)} NDC`);
        }
      } else if (grabbedObject) {
        // === 拖动中：直接跟随 cursor + 智能 Z + 近距离自动磁吸 ===
        // 所见即所得：piece XY 直接 = cursor XY，Z 根据离 target 的 XY 距离三段式插值
        const cur = cursorSphere.position;
        const tgt = TARGET_CONFIG[grabbedObject.userData.partID];
        if (tgt) {
          const dx = cur.x - tgt.position.x;
          const dy = cur.y - tgt.position.y;
          const xyDist = Math.sqrt(dx * dx + dy * dy);
          if (xyDist < 0.20) {
            // 磁吸区：位置 + 旋转 + 缩放 都锁定到 target，松手必中
            grabbedObject.position.copy(tgt.position);
            grabbedObject.quaternion.copy(tgt.quaternion);
            if (tgt.scale) grabbedObject.scale.copy(tgt.scale);
    } else {
            // 智能区：XY 跟 cursor，Z 在中区逐渐插值到 target.z
            const t = THREE.MathUtils.smoothstep(xyDist, 0.20, 1.5);
            const blendedZ = THREE.MathUtils.lerp(tgt.position.z, cur.z, t);
            grabbedObject.position.set(cur.x, cur.y, blendedZ);
            // quaternion 在中区也插值（远端保持 dock 朝向，近端逐渐转向 target）
            const dockQ = grabbedObject.userData.initialQuaternion || new THREE.Quaternion();
            const blendedQ = dockQ.clone().slerp(tgt.quaternion, 1 - t);
            grabbedObject.quaternion.copy(blendedQ);
            if (tgt.scale && grabbedObject.userData.initialScale) {
              const blendedS = grabbedObject.userData.initialScale.clone().lerp(tgt.scale, 1 - t);
              grabbedObject.scale.copy(blendedS);
            }
          }
        } else {
          grabbedObject.position.copy(cur);
        }
      }
    } else {
      // 捏合断开：累计防抖帧数，过滤短暂抖动
      if (isGrabbing && grabbedObject) {
        pinchOffFrames++;
        if (pinchOffFrames >= PINCH_RELEASE_DEBOUNCE_FRAMES) {
          // === 真正松手：触发一次拼接判定 ===
          unhighlightPiece(grabbedObject);
          setCursorGrabState(false); // 双点平滑分开恢复青玉态
          hidePiecePopup(); // 收起百科气泡
          trySnapOnRelease(grabbedObject);
        grabbedObject = null;
        isGrabbing = false;
          pinchOffFrames = 0;
          // 推进/重置引导脉冲：吸附成功 → 下一个构件接力高亮；失败回备料架 → 同一构件继续脉冲
          refreshNextPiecePulse();
        }
        // 防抖期间构件不动，等待用户决定是真松还是临时抖动
      }
    }
    
    // ✅ 移除：减少不必要的调试日志输出
  }

  // 完成特效：金色粒子环绕（拼接全部完成后约 4 秒持续动画）
  updateVictoryParticles();

  // 双点光标：合并/分离动画 + 抓取脉冲环 + 拖尾余韵
  updateCursorPinchAnim();
  updateGrabPulses();
  spawnCursorTrail();
  updateCursorTrail();

  // 单构件吸附时的金色脉冲反馈（短促，不常驻）
  updateSnapPulses();

  // "下一应装构件"在备料架上的柔和金色呼吸（关卡开始默认指向第一步，吸附成功后自动接力）
  updateNextPiecePulse();

  // 首步锚点（仅第二关，浮空金色倒锥 + 光环 + 浮动 + 旋转 + 呼吸）
  updateFirstPieceAnchor();

  // 槽位靠近呼吸提示（仅抓取时 + 距目标 < 1m 触发）
  updateProximityHint();

  // 环境尘埃粒子（常驻氛围）
  updateAmbientParticles();

  // 渲染场景
  renderer.render(scene, camera);
}

// ===================== 启动 =====================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    init().then(() => {
      animate();
    }).catch(error => {
      console.error('[Main] ❌ 初始化失败:', error);
    });
  });
} else {
  init().then(() => {
animate();
  }).catch(error => {
    console.error('[Main] ❌ 初始化失败:', error);
  });
}
