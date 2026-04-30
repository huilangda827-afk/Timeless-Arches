/**
 * 拾光筑梦 · 鉴赏建筑数据源
 * 9 个真实古建筑，对应 public/models/鉴赏/*.glb 与 public/images/鉴赏/*
 *
 * canForge / canExplore 字段决定浮层中"筑梦/探微"按钮是可点击还是弹"敬请期待"
 * 当前仅"万春亭"实装第二关，其他建筑保留入口但 disabled
 */

export const BUILDINGS = [
  {
    id: 'wanchunting',
    name: '北京紫禁城御花园万春亭',
    shortName: '万春亭',
    era: '明代（嘉靖十五年 · 1536年）',
    location: '北京 · 紫禁城御花园',
    category: '皇家园林',
    glb: '/models/鉴赏/北京紫禁城御花园万春亭.glb',
    images: {
      full: '/images/鉴赏/万春亭_全貌.png',
      struct: '/images/鉴赏/万春亭_结构.jpg',
    },
    background:
      '建于明代嘉靖十五年（1536 年）的万春亭，静立于紫禁城御花园内。其外部呈现"上圆下方"的独特造型，寓意天圆地方，代表了中国古代皇家园林建筑"小木作"工艺的巅峰。',
    feature:
      '亭内隐藏着一个令人惊叹的木构"藻井"。成百上千个微小的斗拱层层叠涩、向内收缩，交织成一个犹如立体万花筒般的穹顶。这种不惜工本的极致拼接，将斗拱的装饰美学推向了登峰造极的境界。',
    keyword: '极致小木作',
    canForge: true,
    canExplore: true,
    forgeLevelIndex: 1,
  },
  {
    id: 'hanyuandian',
    name: '大明宫含元殿',
    shortName: '含元殿',
    era: '唐代',
    location: '陕西 · 西安',
    category: '皇家宫殿',
    glb: '/models/鉴赏/大明宫含元殿.glb',
    images: {
      full: '/images/鉴赏/大明宫含元殿_全貌.png',
      real: '/images/鉴赏/大明宫含元殿_实拍.jpg',
      struct: '/images/鉴赏/大明宫含元殿_结构.jpg',
    },
    background:
      '大明宫含元殿是唐长安城内最宏伟的建筑，是唐朝大朝会的正殿，代表了中国古代宫殿建筑的最高巅峰。虽然实体不存，但经由顶尖古建专家基于遗址与敦煌壁画的精准复原，其结构已完全清晰。',
    feature:
      '极度宏大：作为大唐最高等级的皇家建筑，其斗拱体量极大，出挑深远，展现了"如鸟斯革，如翚斯飞"的皇家威仪。双层出檐：下檐使用重抄（两跳）斗拱，上檐使用更复杂的斗拱结构，承重逻辑极其清晰，力学传导直接。',
    keyword: '盛唐威仪',
    canForge: false,
    canExplore: false,
  },
  {
    id: 'guanfu',
    name: '北宋《营造法式》标准官府',
    shortName: '宋金官府',
    era: '北宋至金代',
    location: '全国通用规制',
    category: '官署建筑',
    glb: '/models/鉴赏/宋金官府.glb',
    images: {
      full: '/images/鉴赏/宋金官府_全貌.png',
      real: '/images/鉴赏/宋金官府_实拍.jpg',
      struct: '/images/鉴赏/宋金官府_结构.jpg',
    },
    background:
      '宋代颁布的《营造法式》是中国乃至世界上最早的、最完备的建筑标准规范。当时各地的州府衙门、官署办公地，均严格按照此书中的"厅堂造"标准进行构筑。',
    feature:
      '模数化（材分制）：它规定了斗拱的每一个部件（斗、拱、昂）都有严格的尺寸比例（"材"与"栔"）。高度标准化：斗拱从唐代的"受力主导"开始转向"装饰与受力并重"，结构变得更加紧凑细密。',
    keyword: '《营造法式》范本',
    canForge: false,
    canExplore: false,
  },
  {
    id: 'sanchuque',
    name: '唐代三出阙阙楼',
    shortName: '三出阙',
    era: '唐代',
    location: '陕西 · 西安',
    category: '皇家礼制',
    glb: '/models/鉴赏/三出阙.glb',
    images: {
      full: '/images/鉴赏/三出阙_全貌.png',
      real: '/images/鉴赏/三出阙_实拍.png',
      struct: '/images/鉴赏/三出阙_结构.png',
    },
    background:
      '"阙"是建在宫门或陵门外的双柱楼观，是中国古代最高等级的威仪性建筑。唐代的"三出阙"（主体外附有两个子阙）仅限皇帝或特许的太子使用。我们在历史书和壁画上经常看到它挺拔的身姿，它是大唐气象的标志性符号。',
    feature:
      '垂直受力典范：与大殿的横向展开不同，阙楼是高耸的垂直建筑。它的斗拱极其紧凑，重点展示了转角铺作（角落的斗拱）是如何像花朵一样向四周绽放，支撑起复杂的攒尖或歇山屋顶的。',
    keyword: '转角绽放',
    canForge: false,
    canExplore: false,
  },
  {
    id: 'xian-gulou',
    name: '西安鼓楼',
    shortName: '西安鼓楼',
    era: '明代初期（洪武十三年 · 1380年）',
    location: '陕西 · 西安',
    category: '城市公共',
    glb: '/models/鉴赏/西安鼓楼.glb',
    images: {
      full: '/images/鉴赏/西安鼓楼_全貌.png',
      struct: '/images/鉴赏/西安鼓楼_结构.png',
    },
    background:
      '西安鼓楼建于明洪武十三年（1380 年），是中国现存形制最大、保存最完整的古代鼓楼建筑。它以重檐三滴水歇山顶的宏大体量镇守古城中心，代表了明初官方建筑的最高威仪。',
    feature:
      '上下两层屋檐下密布着硕大的重昂五踩斗拱。这些斗拱如同强壮的臂膀，不仅完美支撑起深远的飞檐，更赋予了整座高层木构建筑无与伦比的力量感与秩序美。',
    keyword: '重昂五踩',
    canForge: false,
    canExplore: false,
  },
  {
    id: 'jishi-minju',
    name: '山西高平姬氏民居',
    shortName: '姬氏民居',
    era: '元代（至元三十一年 · 1294年）',
    location: '山西 · 晋城高平',
    category: '平民住宅',
    glb: '/models/鉴赏/山西高平姬氏民居.glb',
    images: {
      full: '/images/鉴赏/姬氏民居_全貌.png',
      struct: '/images/鉴赏/姬氏民居_结构.png',
    },
    background:
      '建于元代至元三十一年（1294 年）的姬氏民居，是中国建筑史上的奇迹——它是目前已知并确认为中国现存最古老的平民住宅实体。它洗尽了皇家与官方的铅华，展现了最本真的中国传统居住形态。',
    feature:
      '在这座普通农家小院的正房前檐柱头上，赫然使用了"四铺作单抄斗拱"。这向我们证明，在一千年前，精妙的榫卯斗拱技术绝非庙堂专属，它早已深入民间，成为支撑百姓家园的底层建筑智慧。',
    keyword: '四铺作单抄',
    canForge: false,
    canExplore: false,
  },
  {
    id: 'pingyao-xianya',
    name: '平遥县衙大厅',
    shortName: '平遥县衙',
    era: '元代（至正六年 · 1346年）',
    location: '山西 · 平遥',
    category: '官府建筑',
    glb: '/models/鉴赏/平遥县衙大厅.glb',
    images: {
      full: '/images/鉴赏/平遥县衙_全貌.png',
      struct: '/images/鉴赏/平遥县衙_结构.png',
    },
    background:
      '始建于元代至正六年（1346 年）的平遥县衙大堂，是中国现存最古老、保存最完整的基层官署建筑实体。它严格遵循了古代官方的"厅堂造"标准，是古代地方行政权力和法治威严的物理载体。',
    feature:
      '大堂内部采用了经典的"减柱造"手法，以极少的柱子支撑起宽阔的审案空间。其斗拱结构扎实、粗犷，没有任何多余的装饰，完全为力学传导和空间实用性服务，是官式大木作的实用典范。',
    keyword: '减柱造',
    canForge: false,
    canExplore: false,
  },
  {
    id: 'niuwangmiao-xitai',
    name: '山西临汾牛王庙戏台',
    shortName: '牛王庙戏台',
    era: '金代（大定二十三年 · 1183年）',
    location: '山西 · 临汾',
    category: '公共娱乐',
    glb: '/models/鉴赏/牛王庙戏台.glb',
    images: {
      full: '/images/鉴赏/牛王庙戏台_全貌.jpg',
      struct: '/images/鉴赏/牛王庙戏台_结构.jpg',
    },
    background:
      '建于金代大定二十三年（1183 年），这是中国现存最古老的木构戏台实体。作为古代乡间集会与世俗娱乐的核心场所，它见证了中国戏曲艺术的早期繁荣。',
    feature:
      '为了保证台下观众拥有三面敞开的无死角视线，戏台转角处的斗拱出跳极深，受力结构极其复杂。粗犷的金代斗拱形制在这里交织咬合，撑起了古代民间丰富多彩的戏剧生活空间。',
    keyword: '三面敞角',
    canForge: false,
    canExplore: false,
  },
  {
    id: 'rishengchang',
    name: '平遥古城日昇昌票号',
    shortName: '日昇昌票号',
    era: '清代',
    location: '山西 · 平遥',
    category: '民居/商业',
    glb: '/models/鉴赏/平遥古城，日昇昌票号.glb',
    images: {
      full: '/images/鉴赏/日昇昌票号_全貌.png',
      real: '/images/鉴赏/日昇昌票号_实拍.png',
      struct: '/images/鉴赏/日昇昌票号_结构.jpg',
    },
    background:
      '日昇昌是中国第一家票号，被誉为"中国现代银行的鼻祖"。它的建筑格局是典型的晋商大院，青砖灰瓦，庭院深深，代表了清代北方民间商业建筑的最高规格。',
    feature:
      '由"实用"向"装饰"的演变：与唐宋时期硕大、承重的斗拱不同，清代民间大院的斗拱变得非常小巧精致。它们往往不再起主要的承重作用，而是演变成了门楼、檐下的高级装饰品（称为"牌科"）。极尽雕刻之美：这里的斗拱上往往雕刻着琴棋书画、飞禽走兽，是展示主人财富和地位的象征。',
    keyword: '牌科装饰',
    canForge: false,
    canExplore: false,
  },
];

export function getBuildingById(id) {
  return BUILDINGS.find((b) => b.id === id) || null;
}
