// ============================================================
// 拾光筑梦 · 游艺坊（趣味模式集合入口）
//   - 斗拱在哪儿：建筑全貌图上标注斗拱位置（数据驱动，坐标可用热区工具精修）
//   - 模式卡片：千钧一刻 / 拾遗补缺 / 藏宝阁（已实装）+ 自在造 / 稳如山（规划中）
// ============================================================
import { getRecords } from '../shared/records.js';
import { mountBgm } from '../shared/bgm-widget.js';

mountBgm('portal');

const $ = (id) => document.getElementById(id);

// ------------------------------------------------------------
// 斗拱在哪儿：标注数据（百分比坐标，相对全貌图）
// 坐标为人工标定，可用 tools/hotspot-tagger.html 精修
// ------------------------------------------------------------
const WHEREIS = [
  {
    id: 'wanchunting',
    name: '万春亭',
    img: '/images/鉴赏/万春亭_全貌.png',
    note: '万春亭为上圆下方的重檐攒尖亭。斗拱藏在两层屋檐之下：上层圆檐下一圈密集的斗拱层层出挑，托起金色宝顶的伞盖；下层方檐下的斗拱则外露更明显，青绿彩画之间一攒攒整齐排布——它们不是装饰花边，而是把整个屋顶的重量传到立柱上的"力学关节"。',
    spots: [
      { x: 50, y: 36.5, w: 44, h: 11, label: '上檐斗拱带' },
      { x: 53, y: 56, w: 50, h: 12, label: '下檐斗拱带' },
    ],
  },
  {
    id: 'xian-gulou',
    name: '西安鼓楼',
    img: '/images/鉴赏/西安鼓楼_全貌.png',
    note: '西安鼓楼是"重檐三滴水"形制。仔细看两层屋檐下各有一条深色的横向条带——那就是成排的重昂五踩斗拱。每一攒都像强壮的臂膀，把深远出挑的飞檐稳稳托住；成百攒斗拱连成檐下阴影里最精密的结构层。',
    spots: [
      { x: 50, y: 37, w: 50, h: 9, label: '上檐斗拱带' },
      { x: 50, y: 60, w: 64, h: 11, label: '下檐斗拱带' },
    ],
  },
];

let wiIndex = 0;
let wiRevealed = false;

function renderWhereis() {
  const item = WHEREIS[wiIndex];
  $('wi-img').src = item.img;
  $('wi-note').textContent = item.note;
  const tabs = $('wi-tabs');
  tabs.innerHTML = '';
  WHEREIS.forEach((w, i) => {
    const b = document.createElement('button');
    b.className = 'wi-tab' + (i === wiIndex ? ' on' : '');
    b.textContent = w.name;
    b.addEventListener('click', () => { wiIndex = i; wiRevealed = false; renderWhereis(); });
    tabs.appendChild(b);
  });
  renderSpots();
  const btn = $('wi-reveal');
  btn.textContent = wiRevealed ? '✦ 隐藏标注' : '✦ 标出斗拱位置';
  btn.classList.toggle('active', wiRevealed);
}

function renderSpots() {
  const box = $('wi-spots');
  box.innerHTML = '';
  if (!wiRevealed) return;
  const item = WHEREIS[wiIndex];
  item.spots.forEach((s, i) => {
    const el = document.createElement('div');
    el.className = 'wi-spot';
    el.style.left = s.x - s.w / 2 + '%';
    el.style.top = s.y - s.h / 2 + '%';
    el.style.width = s.w + '%';
    el.style.height = s.h + '%';
    el.style.animationDelay = i * 0.25 + 's';
    el.innerHTML = `<span class="wi-spot-label">${s.label}</span>`;
    box.appendChild(el);
  });
}

$('wi-reveal').addEventListener('click', () => {
  wiRevealed = !wiRevealed;
  renderWhereis();
});

// ------------------------------------------------------------
// 模式卡片
// ------------------------------------------------------------
function fmtMs(ms) {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function buildModes() {
  const rec = getRecords();
  const timedBest = rec.timed[1] || rec.timed[2];

  const MODES = [
    {
      key: '刻', name: '千钧一刻', sub: '限时挑战 · 手势竞速',
      desc: '在计时压力下完成斗拱拼装，按用时评定 S/A/B/C 段位，最佳成绩存入藏宝阁。',
      href: '/forge.html?level=1&timed=1',
      cta: '开始挑战',
      stat: timedBest ? `本机最佳 ${fmtMs(timedBest.bestMs)} · ${timedBest.rank} 级` : '尚无成绩',
      ready: true,
    },
    {
      key: '遗', name: '拾遗补缺', sub: '残件修复 · 慧眼识构',
      desc: '一座斗拱缺了几件，从备选构件中找出正确的补上。旁边就是完整参照——考的是你的形制眼力。',
      href: '/repair.html',
      cta: '进入修复',
      stat: rec.repair.wins > 0 ? `已成功修复 ${rec.repair.wins} 次` : '尚未通关',
      ready: true,
    },
    {
      key: '藏', name: '藏宝阁', sub: '成就卡牌 · 游历足迹',
      desc: '鉴赏过的建筑、拼装过的关卡、精调评级、竞速段位——你的每一步游历都化作可收藏的卡牌。',
      href: '/collection2.html',
      cta: '打开藏阁',
      stat: `已点亮 ${Object.keys(rec.viewed).length} 座建筑`,
      ready: true,
    },
    {
      key: '造', name: '自在造', sub: 'DIY 自由拼装',
      desc: '从构件库自由取用斗、拱、昂、枋，不设标准答案，拼出你心中的木构造物并收藏分享。',
      href: null, cta: '敬请期待', stat: '规划中', ready: false,
    },
    {
      key: '稳', name: '稳如山', sub: '地震台试炼 · 物理模拟',
      desc: '斗拱与砖墙同台经受 M4–M8 地震：砖墙轰然倒塌，榫卯却摇而不散——亲眼见证以柔克刚的千年智慧。',
      href: '/quake.html',
      cta: '登台试炼',
      stat: rec.quake && rec.quake.bestMag > 0 ? `最高扛住 M ${rec.quake.bestMag.toFixed(1)}` : '尚无战绩',
      ready: true,
    },
  ];

  const grid = $('mode-grid');
  grid.innerHTML = '';
  MODES.forEach((m, i) => {
    const card = document.createElement(m.ready ? 'a' : 'div');
    card.className = 'mode-card' + (m.ready ? '' : ' pending');
    card.style.setProperty('--i', i);
    if (m.ready) card.href = m.href;
    card.innerHTML = `
      <div class="mc-glyph">${m.key}</div>
      <div class="mc-body">
        <div class="mc-title"><b>${m.name}</b><em>${m.sub}</em></div>
        <p class="mc-desc">${m.desc}</p>
        <div class="mc-foot">
          <span class="mc-stat">${m.stat}</span>
          <span class="mc-cta">${m.cta} ${m.ready ? '→' : ''}</span>
        </div>
      </div>`;
    if (!m.ready) {
      card.addEventListener('click', () => showToast('该模式正在打造中 · 敬请期待'));
    }
    grid.appendChild(card);
  });
}

let toastTimer = null;
function showToast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}

renderWhereis();
buildModes();
