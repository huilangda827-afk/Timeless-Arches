// 精细模式关卡配置（从 src/main.js LEVELS 中拆出来给精细模式独立使用）
// 设计原则：
//   - targetOverrides 是「世界坐标」(校准器导出时已 bake 到 identity holder)
//   - dockOverrides 是初始备料架位置（也是世界坐标）
//   - environmentTransform 应用在背景 GLB 自身的 transform 上
//   - 精细模式不显示半透明 ghost，但保留 ghostPath 作为「显示参考实物」
export const PRECISION_LEVELS = [
  {
    id: 2,
    name: '北京紫禁城御花园万春亭',
    subtitle: '清代官式 · 皇家园林斗拱精品',
    body:
      '万春亭位于紫禁城御花园东北隅，与西侧千秋亭对称，为清乾隆时期所建方形重檐攒尖小亭。' +
      '檐下采用多层斗拱铺作：自栌斗起，逐层挑出琴面昂、瓜子拱、慢拱、令拱、蚂蚱头与耍头，' +
      '由替木与撩檐榑承托上檐之重。',

    environmentPath: '/models/level2/level2-scene.glb',
    showcasePath: '/models/level2/宋金官府.glb', // 实体成品（旁置作参考）
    ghostPath: '/models/level2/宋金官府.glb',    // 半透明幽灵（默认隐藏，可切换）
    piecePathPrefix: '/models/level2/',

    pieceNames: [
      '组件集合壹', '组件集合贰', '组件集合叁',
      '组件集合肆', '组件集合伍', '组件集合陆',
    ],
    displayNames: {
      '组件集合壹': '集合壹 · 撩檐榑组',
      '组件集合贰': '集合贰 · 乳栿耍头组',
      '组件集合叁': '集合叁 · 琴面昂组',
      '组件集合肆': '集合肆 · 假昂散斗组',
      '组件集合伍': '集合伍 · 栌斗阑额组',
      '组件集合陆': '集合陆 · 木栓',
    },
    pieceLore: {
      '组件集合壹': '含：撩檐榑 · 压槽枋 · 罗汉枋 · 替木',
      '组件集合贰': '含：乳栿 · 耍头里转 · 齐心斗 · 蚂蚱头 · 耍头 · 慢拱 · 令拱',
      '组件集合叁': '含：柱头枋 · 㭼头 · 交互斗（隔口包耳）· 琴面昂（下折假昂）· 瓜子拱',
      '组件集合肆': '含：柱头枋 · 琴面昂 · 散斗 · 交互斗',
      '组件集合伍': '含：泥道拱 · 栌斗（四耳栌斗）· 阑额 · 普拍枋',
      '组件集合陆': '含：木栓',
    },

    targetOverrides: {
      '组件集合壹': { position:{x:1.9159,y:0.7432,z:-1.067},  quaternion:{x:0,y:-0.8191,z:0,w:0.5736}, scale:{x:0.3577,y:0.3578,z:0.3577} },
      '组件集合贰': { position:{x:1.9532,y:0.6637,z:-1.0534}, quaternion:{x:-0.0101,y:-0.819,z:-0.0144,w:0.5735}, scale:{x:0.3578,y:0.3578,z:0.3578} },
      '组件集合叁': { position:{x:1.9532,y:0.5842,z:-1.0534}, quaternion:{x:0,y:-0.8191,z:0,w:0.5736}, scale:{x:0.3577,y:0.3578,z:0.3577} },
      '组件集合肆': { position:{x:1.9532,y:0.5445,z:-1.0534}, quaternion:{x:-0.0714,y:0.5714,z:-0.05,w:0.816}, scale:{x:0.2385,y:0.2385,z:0.2385} },
      '组件集合伍': { position:{x:1.9532,y:0.465, z:-1.0534}, quaternion:{x:0,y:0.5736,z:0,w:0.8191}, scale:{x:0.3776,y:0.3776,z:0.3776} },
      '组件集合陆': { position:{x:1.9532,y:0.3855,z:-1.0534}, quaternion:{x:0,y:0.5736,z:0,w:0.8191}, scale:{x:0.3379,y:0.3379,z:0.3379} },
    },
    dockOverrides: {
      '组件集合壹': { position:{x:2,  y:2.4,z:-2},   quaternion:{x:0,y:-0.866,z:0,w:0.5},     scale:{x:0.35,y:0.35,z:0.35} },
      '组件集合贰': { position:{x:2,  y:2.5,z:0.8},  quaternion:{x:0,y:-0.7934,z:0,w:0.6088}, scale:{x:0.35,y:0.35,z:0.35} },
      '组件集合叁': { position:{x:2.5,y:1.9,z:-0.2}, quaternion:{x:0,y:-0.866,z:0,w:0.5},     scale:{x:0.35,y:0.35,z:0.35} },
      '组件集合肆': { position:{x:2.5,y:2.4,z:-1.5}, quaternion:{x:0,y:0.3827,z:0,w:0.9239}, scale:{x:0.35,y:0.35,z:0.35} },
      '组件集合伍': { position:{x:3.2,y:1.9,z:-1.2}, quaternion:{x:0,y:0.3827,z:0,w:0.9239},  scale:{x:0.35,y:0.35,z:0.35} },
      '组件集合陆': { position:{x:3.2,y:1.5,z:0},    quaternion:{x:0,y:0,z:0,w:1},            scale:{x:0.35,y:0.35,z:0.35} },
    },
    environmentTransform: {
      position:   { x: -0.1, y: 0.1, z: -0.5 },
      quaternion: { x: 0,    y: 0.6088, z: 0, w: 0.7934 },
      scale:      { x: 3.35, y: 3.35,   z: 3.35 },
    },
    showcaseTransform: {
      position:   { x: 1.5, y: 0.4, z: 1.3 },
      quaternion: { x: 0,   y: 0.7934, z: 0, w: 0.6088 },
      scale:      { x: 0.4, y: 0.4,    z: 0.4 },
    },
    ghostTransform: {
      position:   { x: 1.9, y: 0.4, z: -1.2 },
      quaternion: { x: 0,   y: 0.2164, z: 0, w: 0.9763 },
      scale:      { x: 0.45,y: 0.45, z: 0.45 },
    },

    cameraPos:    { x: 6.0, y: 4.0, z: 6.0 },
    cameraTarget: { x: 0,   y: 1.5, z: 0 },
  },
];

// 三档难度阈值
//   pos: 米   |   rot: 度
export const DIFFICULTY = {
  easy:   { label: '容易',   pos: 0.20, rot: 15, color: '#9bcc9b' },
  normal: { label: '普通',   pos: 0.10, rot: 8,  color: '#ffd24a' },
  strict: { label: '严格',   pos: 0.03, rot: 2,  color: '#e87878' },
};

export function getLevelById(id) {
  return PRECISION_LEVELS.find((l) => l.id === id) || PRECISION_LEVELS[0];
}
