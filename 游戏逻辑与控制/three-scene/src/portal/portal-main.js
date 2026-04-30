/**
 * 拾光筑梦门户主逻辑
 *
 * 接管原 mockup inline script 的全部职责（路由 + 热区 + 调试）
 * 并扩展：
 *  · 鉴赏页：用 9 建筑卡片网格覆盖原 PNG 上的 6 张 AI 卡片区
 *  · 万象页：原 6 个 AI 图建筑改为 toast 提示（暂未制作真实 3D 模型）
 *  · 顶部 NAV / 首页大卡：筑梦/探微 跳转改为真实功能（万春亭直入或弹"待制作"）
 *  · 鉴赏卡 click → 鉴赏浮层（左 GLB + 右介绍）
 *  · 鉴赏浮层"进入筑梦" / "进入探微" 按钮联动
 */

import './portal.css';
import { BUILDINGS, getBuildingById } from './buildings.js';
import { openAppreciation } from './appreciation-overlay.js';
import { openExplore } from './explore-overlay.js';
import { openInspect } from './inspect-overlay.js';

// IMG 字典由 mockup 内联保留为 window.MOCKUP_IMG
const IMG = window.MOCKUP_IMG || {};

const TITLE = {
  home: '首页',
  catalog: '万象',
  appreciation: '鉴赏',
  detail: '鉴赏详情',
  collection: '藏阁',
  map: '古建舆图',
};

const NAV = [
  { name: '首页', page: 'home', x: 30.2, y: 1.2, w: 5.2, h: 8.2 },
  { name: '万象', page: 'catalog', x: 38.0, y: 1.2, w: 5.2, h: 8.2 },
  { name: '鉴赏', page: 'appreciation', x: 45.7, y: 1.2, w: 5.2, h: 8.2 },
  { name: '探微', action: 'explore-direct', x: 53.4, y: 1.2, w: 5.2, h: 8.2 },
  { name: '筑梦', action: 'forge-direct', x: 61.1, y: 1.2, w: 5.2, h: 8.2 },
  { name: '藏阁', page: 'collection', x: 68.6, y: 1.2, w: 5.2, h: 8.2 },
];

// 6 个 AI 图建筑统一 toast：引导用户去鉴赏页看真实模型
const AI_TOAST = (n) => `「${n}」的精模正在筹备中。可前往"鉴赏"页查看 9 栋已建模的真实古建。`;

const SPOTS = {
  home: [
    ...NAV,
    { name: '万象卡', page: 'catalog', x: 4.2, y: 43.0, w: 17.6, h: 50.2 },
    { name: '鉴赏卡', page: 'appreciation', x: 22.3, y: 43.0, w: 17.6, h: 50.2 },
    { name: '探微卡', action: 'explore-direct', x: 40.4, y: 43.0, w: 17.6, h: 50.2 },
    { name: '筑梦卡', action: 'forge-direct', x: 58.5, y: 43.0, w: 17.6, h: 50.2 },
    { name: '藏阁卡', page: 'collection', x: 76.6, y: 43.0, w: 17.6, h: 50.2 },
  ],
  catalog: [
    ...NAV,
    { name: '古建舆图入口', page: 'map', x: 74.2, y: 10.6, w: 22.2, h: 11.8 },
    { name: '应县木塔', toast: AI_TOAST('应县木塔'), x: 23.9, y: 24.0, w: 23.2, h: 34.4 },
    { name: '佛光寺', toast: AI_TOAST('佛光寺'), x: 49.3, y: 24.0, w: 23.2, h: 34.4 },
    { name: '太和殿', toast: AI_TOAST('故宫太和殿'), x: 74.7, y: 24.0, w: 23.2, h: 34.4 },
    { name: '赵州桥', toast: AI_TOAST('赵州桥'), x: 23.9, y: 61.5, w: 23.2, h: 32.8 },
    { name: '晋祠圣母殿', toast: AI_TOAST('晋祠圣母殿'), x: 49.3, y: 61.5, w: 23.2, h: 32.8 },
    { name: '岳阳楼', toast: AI_TOAST('岳阳楼'), x: 74.7, y: 61.5, w: 23.2, h: 32.8 },
    { name: '探微按钮组', action: 'explore-direct', x: 31.5, y: 50.0, w: 6.8, h: 4.0 },
    { name: '筑梦按钮组', action: 'forge-direct', x: 40.2, y: 50.0, w: 6.8, h: 4.0 },
  ],
  appreciation: [
    // 只保留顶部 NAV，原 PNG 中央卡片区将被 9 建筑网格完全覆盖
    ...NAV,
  ],
  detail: [
    ...NAV,
    { name: '返回鉴赏列表', page: 'appreciation', x: 2.5, y: 9.4, w: 10.8, h: 5.8 },
  ],
  collection: [
    ...NAV,
    // 应县木塔卡：唯一可"检视"的卡片，点击进入 CS 仓库式 GLB 浮层
    { name: '应县木塔卡（可检视）', action: 'inspect-yingxian', x: 22.4, y: 23.0, w: 12.9, h: 34.5 },
    { name: '藏阁卡2', toast: '故宫太和殿 · 敬请期待', x: 36.0, y: 23.0, w: 12.9, h: 34.5 },
    { name: '藏阁卡3', toast: '赵州桥 · 敬请期待', x: 49.6, y: 23.0, w: 12.9, h: 34.5 },
    { name: '藏阁卡4', toast: '岳阳楼 · 敬请期待', x: 63.2, y: 23.0, w: 12.9, h: 34.5 },
    { name: '藏阁卡5', toast: '大斗 · 敬请期待', x: 22.4, y: 59.0, w: 12.9, h: 33.8 },
    { name: '藏阁卡6', toast: '华拱 · 敬请期待', x: 36.0, y: 59.0, w: 12.9, h: 33.8 },
    { name: '藏阁卡7', toast: '昂 · 敬请期待', x: 49.6, y: 59.0, w: 12.9, h: 33.8 },
    { name: '藏阁卡8', toast: '《营造法式》· 敬请期待', x: 63.2, y: 59.0, w: 12.9, h: 33.8 },
    // 把 mockup PNG 上的"翻面查看"按钮改造为"检视"入口（与卡 1 等价）
    { name: '检视', action: 'inspect-yingxian', x: 78.0, y: 55.6, w: 7.4, h: 7.0 },
    { name: '拓展延伸', toast: '拓展延伸 · 敬请期待', x: 88.0, y: 55.6, w: 7.4, h: 7.0 },
  ],
  map: [
    ...NAV,
    { name: '返回万象', page: 'catalog', x: 84.0, y: 11.0, w: 12.0, h: 5.0 },
    // 不再用一整块 toast 热区遮罩地图：9 个建筑点位由 renderMapSpots() 动态生成
  ],
};

let current = 'home';
let stage, pageImage, hotspotRoot, tip, routeLabel;

function showTip(text = '该功能正在筹备中，敬请期待') {
  tip.textContent = text;
  tip.classList.add('show');
  clearTimeout(showTip.t);
  showTip.t = setTimeout(() => tip.classList.remove('show'), 2200);
}

function go(page) {
  current = page;
  if (IMG[page]) {
    pageImage.src = IMG[page];
    pageImage.style.display = '';
  }
  routeLabel.textContent = '当前：' + (TITLE[page] || page);
  // 同步 body class（用于 catalog 滚动 / 其他页面相关样式）
  document.body.className = document.body.className
    .replace(/\bpage-\w+/g, '')
    .trim();
  document.body.classList.add('page-' + page);
  renderHotspots();
  renderAppreciationGrid();
  renderCatalogExtras();
  renderMapSpots();
  renderTopSearch();
  // 滚动复位（万象页可能上一次滚到底）
  if (page !== 'catalog') window.scrollTo(0, 0);
}

function handleAction(action) {
  if (action === 'forge-direct') {
    // 直接进筑梦：从第 1 关开始（不带 ?level 参数）
    window.location.href = './forge.html';
  } else if (action === 'explore-direct') {
    // 直接打开探微（万春亭爆炸图浮层），不弹任何中间选择
    openExplore(getBuildingById('wanchunting'));
  } else if (action === 'inspect-yingxian') {
    // 藏阁 · 检视应县木塔（CS 仓库式 GLB 旋转）
    openInspect({
      title: '应县木塔',
      subtitle: '辽 · 山西应县',
      infoTitle: '应县木塔',
      infoMeta: '辽代（清宁二年 · 1056 年）· 山西应县佛宫寺',
      infoDesc:
        '建于辽清宁二年（1056 年）的应县木塔，是我国现存最古老最高大的纯木构塔式建筑。' +
        '通体不施一钉，54 种斗拱以榫卯精密咬合，历经千年地震风雨而岿然不倒，' +
        '被誉为"中国古建筑斗拱博物馆"。',
    });
  }
}

function renderHotspots() {
  hotspotRoot.innerHTML = '';
  (SPOTS[current] || []).forEach((s) => {
    const btn = document.createElement('button');
    btn.className = 'hotspot';
    btn.title = s.name || '';
    btn.style.left = s.x + '%';
    btn.style.top = s.y + '%';
    btn.style.width = s.w + '%';
    btn.style.height = s.h + '%';
    btn.onclick = () => {
      if (s.toast) showTip(s.toast);
      else if (s.future) showTip();
      else if (s.action) handleAction(s.action);
      else if (s.page) go(s.page);
    };
    hotspotRoot.appendChild(btn);
  });
}

// ========================================================
// 万象页：在 stage 下方追加 9 张真实古建图卡（仅图片，无 3D）
// ========================================================
function renderCatalogExtras() {
  document.querySelectorAll('.catalog-extras').forEach((el) => el.remove());
  if (current !== 'catalog') return;
  const app = document.getElementById('app');
  const block = document.createElement('div');
  block.className = 'catalog-extras';
  block.innerHTML = `
    <div class="ce-header">
      <h2>九 栋 真 实 古 建 · 已 建 模</h2>
      <p>下列建筑均为本团队自建 GLB 模型，可在"鉴赏"页 360° 交互查看</p>
    </div>
    <div class="ce-grid">
      ${BUILDINGS.map((b) => `
        <button class="ce-card" data-id="${b.id}" title="${b.name}">
          <img src="${b.images.full}" alt="${b.name}" />
          <div class="ce-overlay">
            <div class="ce-name">${b.shortName}</div>
            <div class="ce-sub">${b.era.split('（')[0]} · ${b.location.split(' · ')[0]}</div>
          </div>
        </button>
      `).join('')}
    </div>
  `;
  app.appendChild(block);
  block.querySelectorAll('.ce-card').forEach((c) => {
    c.addEventListener('click', () => {
      openAppreciation(getBuildingById(c.getAttribute('data-id')));
    });
  });
}

// ========================================================
// 古建舆图：在地图 PNG 上覆盖 9 个金色脉冲点位
// ========================================================
// 点位坐标（% 相对 stage）—— 按地理位置近似标定，可在调试模式下进一步微调
const MAP_SPOTS = [
  { id: 'wanchunting', x: 71.5, y: 33.5 },     // 北京
  { id: 'hanyuandian', x: 56.0, y: 47.0 },     // 西安
  { id: 'sanchuque', x: 56.6, y: 46.5 },       // 西安（陕西）—— 与含元殿同地区错开 1%
  { id: 'xian-gulou', x: 55.4, y: 47.5 },      // 西安
  { id: 'rishengchang', x: 60.0, y: 41.0 },    // 山西平遥
  { id: 'pingyao-xianya', x: 60.6, y: 41.5 },  // 山西平遥（与日昇昌同地）
  { id: 'jishi-minju', x: 61.5, y: 44.0 },     // 山西高平
  { id: 'niuwangmiao-xitai', x: 60.2, y: 45.5 }, // 山西临汾
  { id: 'guanfu', x: 64.0, y: 50.5 },          // 全国通用，标在中原（河南/山西交界）
];

function renderMapSpots() {
  document.querySelectorAll('.map-spot').forEach((el) => el.remove());
  if (current !== 'map') return;
  for (const spot of MAP_SPOTS) {
    const b = getBuildingById(spot.id);
    if (!b) continue;
    const dot = document.createElement('button');
    dot.className = 'map-spot';
    dot.title = b.name;
    dot.setAttribute('data-name', b.shortName);
    dot.style.left = spot.x + '%';
    dot.style.top = spot.y + '%';
    dot.addEventListener('click', () => openAppreciation(b));
    stage.appendChild(dot);
  }
}

// ========================================================
// 顶部搜索框：在 mockup PNG 左上角搜索图案位置叠加 input
// ========================================================
let _searchEl = null;
let _searchInput = null;
let _searchResults = null;

function renderTopSearch() {
  // 仅在 home / catalog / appreciation 三个页面显示搜索框
  if (!['home', 'catalog', 'appreciation'].includes(current)) {
    if (_searchEl) _searchEl.style.display = 'none';
    return;
  }
  if (!_searchEl) {
    _searchEl = document.createElement('div');
    _searchEl.className = 'portal-search';
    _searchEl.innerHTML = `
      <span class="ps-icon">🔍</span>
      <input type="text" placeholder="搜索古建（如：万春亭 / 唐 / 山西）" />
      <div class="portal-search-results"></div>
    `;
    // 位置：mockup PNG 左上角搜索栏区域的近似位置（% 相对 stage）
    _searchEl.style.left = '4%';
    _searchEl.style.top = '2%';
    _searchEl.style.width = '24%';
    stage.appendChild(_searchEl);
    _searchInput = _searchEl.querySelector('input');
    _searchResults = _searchEl.querySelector('.portal-search-results');
    _searchInput.addEventListener('input', onSearchInput);
    _searchInput.addEventListener('focus', () => {
      if (_searchInput.value.trim()) _searchEl.classList.add('open');
    });
    document.addEventListener('click', (e) => {
      if (!_searchEl.contains(e.target)) {
        _searchEl.classList.remove('open');
      }
    });
  }
  _searchEl.style.display = '';
}

function onSearchInput(e) {
  const q = e.target.value.trim().toLowerCase();
  if (!q) {
    _searchEl.classList.remove('open');
    _searchResults.innerHTML = '';
    return;
  }
  // 在多个字段上匹配：name / shortName / era / location / category / keyword / parts
  const hits = BUILDINGS.filter((b) => {
    const haystack = [
      b.name, b.shortName, b.era, b.location, b.category, b.keyword,
      b.background, b.feature,
    ].join(' ').toLowerCase();
    return haystack.includes(q);
  });
  if (hits.length === 0) {
    _searchResults.innerHTML = `<div class="psr-empty">未找到与"${e.target.value}"相关的古建</div>`;
  } else {
    _searchResults.innerHTML = hits.map((b) => `
      <div class="psr-item" data-id="${b.id}">
        <img class="psr-thumb" src="${b.images.full}" alt="${b.name}" />
        <div class="psr-text">
          <div class="psr-name">${b.shortName}</div>
          <div class="psr-sub">${b.era.split('（')[0]} · ${b.location.split(' · ')[0]} · ${b.keyword}</div>
        </div>
      </div>
    `).join('');
    _searchResults.querySelectorAll('.psr-item').forEach((it) => {
      it.addEventListener('click', () => {
        const b = getBuildingById(it.getAttribute('data-id'));
        if (b) openAppreciation(b);
        _searchInput.value = '';
        _searchEl.classList.remove('open');
      });
    });
  }
  _searchEl.classList.add('open');
}

// 鉴赏页：动态生成 9 建筑卡片网格，覆盖原 PNG 中央
function renderAppreciationGrid() {
  document.querySelectorAll('.appreciation-grid').forEach((el) => el.remove());
  if (current !== 'appreciation') return;
  const grid = document.createElement('div');
  grid.className = 'appreciation-grid';
  grid.innerHTML = `
    <div class="grid-mask"></div>
    <div class="grid-header">
      <h2>古 建 鉴 赏 · 九 景</h2>
      <p>选取一栋斗拱建筑，进入它的木构世界</p>
    </div>
    <div class="grid-cards">
      ${BUILDINGS.map((b) => `
        <button class="bcard" data-id="${b.id}" title="${b.name}">
          <div class="bcard-img" style="background-image:url('${b.images.full}')"></div>
          <div class="bcard-info">
            <div class="bcard-title">${b.shortName}</div>
            <div class="bcard-sub">${b.era.split('（')[0]} · ${b.location.split(' · ')[0]}</div>
            <div class="bcard-keyword">${b.keyword}</div>
          </div>
        </button>
      `).join('')}
    </div>
  `;
  stage.appendChild(grid);
  grid.querySelectorAll('.bcard').forEach((card) => {
    card.addEventListener('click', () => {
      const id = card.getAttribute('data-id');
      openAppreciation(getBuildingById(id));
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  stage = document.getElementById('stage');
  pageImage = document.getElementById('pageImage');
  hotspotRoot = document.getElementById('hotspots');
  tip = document.getElementById('tip');
  routeLabel = document.getElementById('routeLabel');

  if (!stage || !pageImage || !hotspotRoot) {
    console.error('[portal] mockup DOM 缺失，无法启动');
    return;
  }

  document.getElementById('resetBtn').onclick = () => go('home');
  document.getElementById('debugBtn').onclick = () => {
    stage.classList.toggle('debug');
    document.getElementById('debugBtn').textContent =
      stage.classList.contains('debug') ? '隐藏热区' : '显示热区';
  };

  window.addEventListener('keydown', (e) => {
    if (e.key === 'd' || e.key === 'D') document.getElementById('debugBtn').click();
    if (e.key === 'Escape') {
      if (window._closeOverlays && window._closeOverlays()) return;
      go('home');
    }
  });

  // URL ?page=appreciation 等支持深链
  const urlPage = new URLSearchParams(location.search).get('page');
  go(urlPage && SPOTS[urlPage] ? urlPage : 'home');
});
