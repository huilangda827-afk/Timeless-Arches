// ============================================================
// 拾光筑梦 · 藏宝阁（成就卡牌 + 建筑图鉴）
//   数据源：src/shared/records.js（localStorage 全站足迹）
//   - 建筑卡牌：鉴赏过 → 点亮；拼装/精调过 → 追加徽记
//   - 技艺成就：按记录自动判定解锁
// ============================================================
import { BUILDINGS } from '../portal/buildings.js';
import { getRecords } from '../shared/records.js';
import { mountBgm } from '../shared/bgm-widget.js';

mountBgm('portal');

const $ = (id) => document.getElementById(id);
const rec = getRecords();

// 筑梦关卡 ↔ 建筑映射（第一关是通用斗拱教学，不对应具体建筑）
const LEVEL_BUILDING = { 2: 'wanchunting', 3: 'jinci-shengmudian' };

function fmtMs(ms) {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

// ---------------- 页头统计 ----------------
function renderStats() {
  const viewedCount = Object.keys(rec.viewed).length;
  const forgedTotal = Object.values(rec.forged).reduce((a, r) => a + r.count, 0);
  const precisionBest = Object.values(rec.precision)
    .map((x) => x.grade)
    .sort((a, b) => 'SABCF'.indexOf(a) - 'SABCF'.indexOf(b))[0] || '—';
  const timedList = Object.values(rec.timed);
  const timedBest = timedList.length
    ? timedList.reduce((a, b) => (a.bestMs < b.bestMs ? a : b))
    : null;

  const items = [
    { num: `${viewedCount}<i>/${BUILDINGS.length}</i>`, label: '已鉴赏建筑' },
    { num: String(forgedTotal), label: '筑梦通关次数' },
    { num: precisionBest, label: '精微最高评级' },
    { num: timedBest ? fmtMs(timedBest.bestMs) : '—', label: '千钧一刻最佳' },
    { num: String(rec.repair.wins), label: '拾遗修复成功' },
  ];
  $('stats').innerHTML = items
    .map((s) => `<div class="st"><b class="mono">${s.num}</b><em>${s.label}</em></div>`)
    .join('');
}

// ---------------- 技艺成就徽章 ----------------
function renderBadges() {
  const viewedCount = Object.keys(rec.viewed).length;
  const bestRank = Object.values(rec.timed).map((t) => t.rank).sort()[0];

  const BADGES = [
    {
      key: '筑', name: '初执斗拱', desc: '完成任意一关筑梦拼装',
      ok: Object.keys(rec.forged).length > 0,
    },
    {
      key: '亭', name: '万春妙手', desc: '完成第二关 · 万春亭铺作',
      ok: !!rec.forged[2],
    },
    {
      key: '毫', name: '毫厘匠心', desc: '精微匠造获得 A 级以上评价',
      ok: Object.values(rec.precision).some((p) => p.grade === 'S' || p.grade === 'A'),
    },
    {
      key: '疾', name: '疾手快斗', desc: '千钧一刻取得 A 级以上段位',
      ok: bestRank === 'S' || bestRank === 'A',
    },
    {
      key: '慧', name: '慧眼识构', desc: '拾遗补缺成功修复一次',
      ok: rec.repair.wins > 0,
    },
    {
      key: '稳', name: '撼而不倒', desc: '地震台试炼中斗拱扛住 M6 以上强震',
      ok: (rec.quake?.bestMag || 0) >= 6,
    },
    {
      key: '览', name: '博览群构', desc: '鉴赏 5 座以上古建',
      ok: viewedCount >= 5,
    },
    {
      key: '通', name: '通览千构', desc: `点亮全部 ${BUILDINGS.length} 座建筑图鉴`,
      ok: viewedCount >= BUILDINGS.length,
    },
  ];

  $('badge-grid').innerHTML = BADGES.map(
    (b, i) => `
    <div class="badge ${b.ok ? 'ok' : ''}" style="--i:${i}">
      <span class="bd-glyph">${b.key}</span>
      <span class="bd-txt"><b>${b.name}</b><em>${b.desc}</em></span>
      <span class="bd-state">${b.ok ? '已解锁' : '未解锁'}</span>
    </div>`
  ).join('');
}

// ---------------- 建筑图鉴卡牌 ----------------
function renderCards() {
  const grid = $('card-grid');
  grid.innerHTML = '';
  BUILDINGS.forEach((b, i) => {
    const viewed = !!rec.viewed[b.id];
    // 该建筑是否有拼装/精调记录
    const forgedHere = Object.entries(LEVEL_BUILDING).some(([lv, bid]) => bid === b.id && rec.forged[lv]);
    const precHere = Object.entries(LEVEL_BUILDING).find(([lv, bid]) => bid === b.id && rec.precision[lv]);
    const thumb = (b.images && (b.images.full || b.images.real)) || '';

    const card = document.createElement(viewed ? 'a' : 'div');
    card.className = 'b-card' + (viewed ? ' lit' : ' locked');
    card.style.setProperty('--i', i);
    if (viewed) card.href = '/view2.html?b=' + b.id;
    card.innerHTML = `
      <div class="bc-img">
        ${thumb ? `<img src="${thumb}" alt="${b.shortName}" loading="lazy" onerror="this.remove()" />` : ''}
        ${viewed ? '' : '<div class="bc-lock">?</div>'}
      </div>
      <div class="bc-body">
        <b>${viewed ? b.shortName : '？？？'}</b>
        <em>${viewed ? b.era.split('（')[0] + ' · ' + b.location : '前往鉴赏点亮此卡'}</em>
        <div class="bc-marks">
          ${viewed ? '<span class="mk">鉴赏 ✓</span>' : ''}
          ${forgedHere ? '<span class="mk red">筑梦 ✓</span>' : ''}
          ${precHere ? `<span class="mk gold">精调 ${rec.precision[precHere[0]].grade}</span>` : ''}
        </div>
      </div>`;
    grid.appendChild(card);
  });
}

renderStats();
renderBadges();
renderCards();
