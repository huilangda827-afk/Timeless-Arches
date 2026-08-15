/**
 * 拾光筑梦 · 鉴赏建筑数据源
 * 15 个真实古建筑，对应 public/models/鉴赏/*.glb 与 public/images/鉴赏/*
 *
 * canForge / canExplore 字段决定浮层中"筑梦/探微"按钮是可点击还是弹"敬请期待"
 * 当前仅"万春亭"实装第二关，其他建筑保留入口但 disabled
 *
 * ⚠ 数据同步注意：BUILDINGS 也内嵌在 tools/map-pin-tagger.html，加/改建筑必须同步两处。
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
    forgeLevelId: 2, // forge.html?level=2
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

  // ===== 第二批扩展（2026-05，新增 6 项；图片素材待补，images 暂留空） =====

  {
    id: 'tiantai-an',
    name: '山西长治平顺天台庵大殿',
    shortName: '天台庵大殿',
    era: '五代后唐（天成四年 · 929年）',
    location: '山西 · 长治平顺',
    category: '宗教建筑',
    glb: '/models/鉴赏/天台庵大殿.glb',
    images: {
      full: '/images/鉴赏/天台庵_全貌.png',
      struct: '/images/鉴赏/天台庵_结构.png',
    },
    background:
      '天台庵大殿是中国现存极为罕见的五代时期木构建筑，建于后唐天成四年。大殿体量小巧，面阔三间，采用单檐歇山顶，出檐深远，完美继承了唐代建筑雄浑、质朴的遗风。其内部没有复杂的内外柱网，仅以极简的梁架结构便稳稳支撑起沉重的屋盖。这种"以简驭繁"的营造法式，不仅体现了早期木作技艺的精巧，更是研究中国建筑从唐代向宋代过渡演变的珍贵实物标本。',
    feature:
      '天台庵柱头科采用的"四铺作单抄"，是中国古建斗拱悬挑体系中最基础、最纯粹的形态。"四铺作"代表其在基座之上有一层向外的出挑；"单抄"则意味着仅有一根华拱向外水平伸出，且没有斜向的"昂"。它摒弃了所有冗余装饰，泥道拱与华拱在底部的栌斗内严丝合缝地十字交叉，力学传导直白有力。这种极简结构展现了精妙的受力智慧，是初学者看懂榫卯底层逻辑的完美范例。',
    keyword: '四铺作单抄',
    canForge: false,
    canExplore: false,
  },

  {
    id: 'pingyao-wenmiao',
    name: '平遥文庙大成殿',
    shortName: '平遥文庙',
    era: '金代（大定三年 · 1163年）',
    location: '山西 · 平遥',
    category: '礼制建筑',
    glb: '/models/鉴赏/平遥文庙大成殿.glb',
    images: {
      full: '/images/鉴赏/平遥文庙_全貌.png',
      struct: '/images/鉴赏/平遥文庙_结构.jpeg',
    },
    background:
      '平遥文庙大成殿是中国现存最早的孔庙大殿，重建于金代大定三年。大殿面阔五间，采用高等级的单檐歇山顶。其屋顶庞大，出檐极为深远，建筑气势宏阔，完美保留了宋金时期"古朴庄重、结构严谨"的木构特征。作为古代供奉孔圣的核心礼制空间，它不仅是平遥古城的文化灵魂，更是研究中国早期官式建筑与儒学文化融合的珍贵孤例。',
    feature:
      '这是展现高规格礼制的力学杰作。"七铺作"指斗拱向外层层悬挑了四次；"双杪"代表最底下的两层出挑是水平的华拱；"双下昂"是上方两层斜向下的杠杆构件，极大地延展了出檐的深度。"隔跳计心造"则是其精妙之处：在向外的出挑层级中，交替放置横向的横栱来拉结承重。这套系统不仅在力学上完美支撑了沉重屋盖，视觉上也犹如层层展翅的羽翼，华丽至极。',
    keyword: '七铺作双杪双下昂',
    canForge: false,
    canExplore: false,
  },

  {
    id: 'jinci-shengmudian',
    name: '太原晋祠圣母殿',
    shortName: '晋祠圣母殿',
    era: '北宋',
    location: '山西 · 太原晋源',
    category: '祠庙建筑',
    glb: '/models/鉴赏/晋祠圣母殿.glb',
    images: {
      full: '/images/鉴赏/晋祠圣母殿_全貌.png',
      struct: '/images/鉴赏/晋祠圣母殿_结构.png',
    },
    background:
      '晋祠圣母殿是宋代建筑的传世孤例，为祭祀唐叔虞之母邑姜而建。大殿采用极高等级的重檐歇山顶，并在中国古建史上罕见地保留了完整的"副阶周匝"（即殿身四周环绕一圈宽敞的回廊）形制。殿前廊柱上盘绕着八条栩栩如生的宋代木雕蟠龙，气宇轩昂。整座建筑屋面曲线柔美舒展，空间宏大深远，完美诠释了宋代木构建筑"雄伟与秀美并重"的巅峰美学。',
    feature:
      '圣母殿的"五铺作单杪单昂"，是《营造法式》标准下的经典力学范式。"五铺作"意味着斗拱向外悬挑了两次；"单杪"（杪同抄）指第一层伸出的是水平的华拱；"单昂"则指第二层伸出的是斜向下的杠杆构件。这种"一平一斜"的组合堪称绝妙：水平华拱提供稳固的承托，斜向下昂则利用杠杆原理，将深远屋檐的千钧之力巧妙转化为对柱心的向下压应力，展现了宋代极高超的物理制衡智慧。',
    keyword: '五铺作单杪单昂',
    canForge: true, // 第三关（2026-08-13 校准上线，10 组构件）
    canExplore: false,
    forgeLevelIndex: 2,
    forgeLevelId: 3, // forge.html?level=3
  },

  {
    id: 'jinci-xiandian',
    name: '太原晋祠献殿',
    shortName: '晋祠献殿',
    era: '金代',
    location: '山西 · 太原晋源',
    category: '祭祀礼制',
    glb: '/models/鉴赏/晋祠献殿.glb',
    images: {
      full: '/images/鉴赏/晋祠献殿_全貌.png',
      struct: '/images/鉴赏/晋祠献殿_结构.jpeg',
    },
    background:
      '晋祠献殿是中国现存极为珍贵且年代极早的祭祀敞殿。大殿面阔三间，单檐歇山顶，其最大的形制特色在于"似亭非殿"：四周不砌实体砖墙，仅以通透的直棂木栅栏围护。这种设计使得殿内光线充足、空气流通，专为祭祀圣母时陈列供品而筑。其梁架结构极其洗练，去除了所有非承重的繁冗部件，历经八百余年风雨依然坚挺，展现了金代匠人在实用主义与结构美学上的完美平衡。',
    feature:
      '这组斗拱是窥探古代工程"降本增效"的极佳窗口。"五铺作"指斗拱向外悬挑了两次；"双平出式"代表这两次出挑的构件在内部骨架上，其实都是水平受力的华拱，加工简单且堆叠稳固。然而其最精妙之处在于"假昂"：匠人将这些水平木构的外部末端，雕刻成了斜向下的"昂嘴"形状。这种做法在不增加复杂斜向受力计算和木材损耗的前提下，在视觉上完美模拟了真昂的华丽与灵动，堪称结构与装饰的智慧妥协。',
    keyword: '五铺作双平假昂',
    canForge: false,
    canExplore: false,
  },

  {
    id: 'xingguosi-boruodian',
    name: '兴国寺般若殿',
    shortName: '般若殿',
    era: '元代',
    location: '甘肃 · 天水秦安',
    category: '宗教建筑',
    glb: '/models/鉴赏/兴国寺般若殿.glb',
    images: {
      full: '/images/鉴赏/般若殿_全貌.png',
      struct: '/images/鉴赏/般若殿_结构.png',
    },
    background:
      '兴国寺般若殿是甘肃省现存最完整的元代木构大殿，为国家级重点文保单位。大殿面阔三间，采用单檐歇山顶，其整体造型沉稳内敛，带有浓郁的西北地方色彩。殿内梁架大量使用了粗犷的原木，保留了元代建筑"减柱造"的粗犷与奔放，使得殿内礼佛空间极为通透。它是研究黄河流域元代建筑从宋金向明清过渡、以及中原技艺在西北地区本土化演变的极其珍贵的实物坐标。',
    feature:
      '般若殿的斗拱是元代匠人"承前启后"的杰作。"六铺作"与"七踩"同义，指斗拱向外悬挑三次。其最外跳采用了"下假昂"，即将水平的木构件末端劈削出锐利的昂嘴，既省去了真昂的复杂受力，又模拟出了飞扬的动感。"重栱计心造"则是在每一跳出头处，密实地交叠两层横栱，极大增强了屋檐的整体拉结力。这组斗拱纵横交错、粗犷敦实，完美展现了西北元代木构兼具华丽与狂野的独特审美。',
    keyword: '六铺作下假昂',
    canForge: false,
    canExplore: false,
  },

  {
    id: 'xingguosi-xiegong',
    name: '兴国寺般若殿前檐斜栱',
    shortName: '般若殿斜栱',
    era: '元代',
    location: '甘肃 · 天水秦安',
    category: '局部特写',
    glb: '/models/鉴赏/兴国寺般若殿_斜栱特写.glb',
    images: {
      full: '/images/鉴赏/般若殿斜栱_全貌.jpg',
      struct: '/images/鉴赏/般若殿斜栱_结构.jpg',
    },
    // 配图来源:Wikimedia Commons "善化寺金代三圣殿补间铺作斜拱正面/侧面"
    // 作者 Patrick20242023,CC BY-SA 4.0(同期金代北方斜拱实例,代表斜栱形制)
    imageCredit: '善化寺斜拱 · CC BY-SA 4.0 · Patrick20242023',
    background:
      '般若殿前檐的"斜栱"设计，是整座大殿最具视觉冲击力的神来之笔。有别于传统木构仅在横纵正交的轴向上延伸，斜栱以斜角（通常为 45 度或 60 度）向外侧穿插挑出。这种打破常规网格的形制，是辽金元时期高级建筑的标志性语言。',
    feature:
      '交错伸出的斜栱在檐下如怒放的莲花或繁密的织网，极其华丽。它不仅在力学上增强了出檐的网状拉结力，更在视觉上彻底打破了方正木构的刻板，展现出元代匠人天马行空的几何想象力，在三维数字化拆解中极具挑战性与观赏性。',
    keyword: '斜栱出挑',
    canForge: false,
    canExplore: false,
  },
];

export function getBuildingById(id) {
  return BUILDINGS.find((b) => b.id === id) || null;
}
