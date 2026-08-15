// ============================================================
// 拾光筑梦 · 万象图鉴 v2（独立新线）
// 数据：直接复用 src/portal/buildings.js（只读，不改原文件）
// 能力：搜索 / 类别筛选 / 建筑弹窗（鉴赏·探微·筑梦·精微匠造）
// canForge / canExplore 为 false 的模式显示"敬请期待"
// ============================================================
import { BUILDINGS } from '../portal/buildings.js';
import { mountBgm } from '../shared/bgm-widget.js';

mountBgm('portal');

// ---------------- 类别归组（原始 category 较碎，归为六组便于筛选） ----------------
const GROUPS = [
  { key: 'all', label: '全部' },
  { key: 'royal', label: '皇家', match: ['皇家园林', '皇家宫殿', '皇家礼制'] },
  { key: 'gov', label: '官府', match: ['官署建筑', '官府建筑'] },
  { key: 'folk', label: '民居', match: ['平民住宅', '民居/商业'] },
  { key: 'public', label: '公共', match: ['城市公共', '公共娱乐'] },
  { key: 'rite', label: '祠庙礼制', match: ['礼制建筑', '祠庙建筑', '祭祀礼制', '宗教建筑'] },
  { key: 'detail', label: '构件特写', match: ['局部特写'] },
];

function groupOf(b) {
  for (const g of GROUPS) {
    if (g.match && g.match.includes(b.category)) return g.key;
  }
  return 'all';
}

let activeGroup = 'all';
let keyword = '';

// ---------------- 工具 ----------------
const $ = (id) => document.getElementById(id);

function showToast(text) {
  const t = $('toast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => t.classList.remove('show'), 2200);
}

// ---------------- 筛选 chips ----------------
function buildChips() {
  const box = $('chips');
  box.innerHTML = GROUPS.map(
    (g) => `<button class="chip${g.key === 'all' ? ' on' : ''}" data-key="${g.key}">${g.label}</button>`
  ).join('');
  box.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    activeGroup = btn.dataset.key;
    box.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === btn));
    render();
  });
}

// ---------------- 渲染卡片 ----------------
function matched() {
  const kw = keyword.trim().toLowerCase();
  return BUILDINGS.filter((b) => {
    if (activeGroup !== 'all' && groupOf(b) !== activeGroup) return false;
    if (!kw) return true;
    const hay = [b.name, b.shortName, b.era, b.location, b.category, b.keyword]
      .join(' ')
      .toLowerCase();
    return hay.includes(kw);
  });
}

function render() {
  const list = matched();
  const grid = $('grid');
  $('empty').hidden = list.length > 0;
  $('total-count').textContent = BUILDINGS.length;

  grid.innerHTML = list
    .map((b, i) => {
      const badges = [
        b.canForge ? '<span class="badge">可筑梦</span>' : '',
        b.canExplore ? '<span class="badge gold">可探微</span>' : '',
      ].join('');
      return `
      <article class="b-card" style="--i:${i}" data-id="${b.id}">
        <div class="bc-img">
          <div class="bc-badges">${badges}</div>
          <img src="${b.images.full}" alt="${b.shortName}" loading="lazy" />
        </div>
        <div class="bc-body">
          <div class="bc-name">${b.shortName}</div>
          <div class="bc-meta">${b.era.split('（')[0]}<i>·</i>${b.location}</div>
          <span class="bc-keyword">${b.keyword}</span>
        </div>
      </article>`;
    })
    .join('');
}

// ---------------- 弹窗 ----------------
function openModal(b) {
  $('m-img').src = b.images.full;
  $('m-img').alt = b.shortName;
  $('m-category').textContent = b.category;
  $('m-name').textContent = b.name;
  $('m-era').textContent = b.era;
  $('m-location').textContent = b.location;
  $('m-keyword').textContent = '「 ' + b.keyword + ' 」';
  $('m-desc').textContent = b.background;

  // 四个模式入口：鉴赏永远可用；探微/筑梦/精微按数据实事求是
  const actions = [
    {
      name: '鉴 赏', sub: '三维模型 · 图文详解',
      ok: true, href: '/view2.html?b=' + b.id, cls: 'primary',
    },
    {
      name: '探 微', sub: b.canExplore ? '斗拱爆炸拆解' : '敬请期待',
      ok: b.canExplore, href: '/explore2.html', cls: 'outline',
    },
    {
      name: '筑 梦', sub: b.canForge ? '手势拼装体验' : '敬请期待',
      ok: b.canForge, href: b.forgeLevelId ? `/forge.html?level=${b.forgeLevelId}` : '/forge.html', cls: 'outline',
    },
    {
      name: '精微匠造', sub: b.canForge ? '键鼠精调装配' : '敬请期待',
      ok: b.canForge, href: '/precision.html', cls: 'outline',
    },
  ];

  $('m-actions').innerHTML = actions
    .map((a, i) => {
      if (a.ok) {
        return `<a class="m-btn ${a.cls}" href="${a.href}"><b>${a.name}</b><em>${a.sub}</em></a>`;
      }
      return `<button class="m-btn disabled" data-name="${a.name.replace(/\s/g, '')}"><b>${a.name}</b><em>${a.sub}</em></button>`;
    })
    .join('');

  $('m-actions').querySelectorAll('.m-btn.disabled').forEach((btn) => {
    btn.addEventListener('click', () => {
      showToast(`「${b.shortName}」的${btn.dataset.name}模式 · 敬请期待`);
    });
  });

  $('modal').hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  $('modal').hidden = true;
  document.body.style.overflow = '';
}

// ---------------- 事件绑定 ----------------
function init() {
  buildChips();
  render();

  $('grid').addEventListener('click', (e) => {
    const card = e.target.closest('.b-card');
    if (!card) return;
    const b = BUILDINGS.find((x) => x.id === card.dataset.id);
    if (b) openModal(b);
  });

  $('search-input').addEventListener('input', (e) => {
    keyword = e.target.value;
    render();
  });

  $('modal-close').addEventListener('click', closeModal);
  $('modal-mask').addEventListener('click', closeModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('modal').hidden) closeModal();
  });
}

init();
