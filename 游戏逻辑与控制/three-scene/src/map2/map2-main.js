/**
 * 拾光筑梦 · 古建舆图 v2（独立新线，与 home2 / catalog2 同一设计语言）
 *
 * 数据化设计要点：
 * 1. 地图不用美术底图，而是运行时渲染真实省级边界 GeoJSON（/data/china-provinces.json，
 *    来源 DataV.GeoAtlas，基于自然资源部标准地图 审图号 GS(2024)0650号，含台湾与南海诸岛）
 * 2. 点位使用真实经纬度经 Web 墨卡托投影落点，而非人工在图片上目测
 * 3. 文保等级 / 批次 / 保存现状均来自国家文物局公布名单与公开资料，
 *    数字复原类（无实体遗存）明确标注，不冒充实物遗存
 */

import { BUILDINGS, getBuildingById } from '../portal/buildings.js';
import { mountBgm } from '../shared/bgm-widget.js';

mountBgm('portal');

// ============================================================
// 真实地理与文保数据（id 对齐 buildings.js）
// ============================================================

const SITE_META = {
  wanchunting: {
    lon: 116.397, lat: 39.925,
    level: '全国重点文物保护单位（第一批 · 1961 · 故宫）',
    heritage: '世界文化遗产 · 故宫（1987）',
    preserve: '保存完好',
    open: '开放参观（故宫御花园）',
  },
  hanyuandian: {
    lon: 108.959, lat: 34.289,
    level: '全国重点文物保护单位（第一批 · 1961 · 大明宫遗址）',
    heritage: '世界文化遗产 · 丝绸之路（2014）',
    preserve: '遗址（地面木构无存）',
    open: '大明宫国家遗址公园开放',
    restore: '基于遗址与敦煌壁画的数字复原',
  },
  guanfu: {
    lon: 114.307, lat: 34.797,
    level: '《营造法式》规制复原（非单体遗存）',
    preserve: '文献规制 · 数字复原',
    open: '——',
    restore: '按北宋官颁《营造法式》厅堂造规制复原',
    posNote: '点位示意：《营造法式》颁行于北宋东京（今开封）',
  },
  sanchuque: {
    lon: 108.945, lat: 34.34,
    level: '唐代阙制复原（据考古与懿德太子墓壁画）',
    preserve: '形制复原 · 数字复原',
    open: '——',
    restore: '据考古发掘与唐墓壁画复原的礼制建筑',
  },
  'xian-gulou': {
    lon: 108.942, lat: 34.265,
    level: '全国重点文物保护单位（第四批 · 1996）',
    preserve: '保存完好',
    open: '开放参观',
  },
  'jishi-minju': {
    lon: 112.92, lat: 35.79,
    level: '全国重点文物保护单位（第四批 · 1996）',
    preserve: '保存良好',
    open: '暂不对外开放',
  },
  'pingyao-xianya': {
    lon: 112.174, lat: 37.198,
    level: '世界文化遗产 · 平遥古城组成部分（1997）',
    preserve: '保存完好',
    open: '开放参观（平遥县衙博物馆）',
  },
  'niuwangmiao-xitai': {
    lon: 111.52, lat: 36.17,
    level: '全国重点文物保护单位（第四批 · 1996 · 魏村牛王庙）',
    preserve: '保存良好',
    open: '开放参观',
  },
  rishengchang: {
    lon: 112.176, lat: 37.202,
    level: '全国重点文物保护单位（第六批 · 2006 · 日昇昌旧址）',
    heritage: '世界文化遗产 · 平遥古城组成部分（1997）',
    preserve: '保存完好',
    open: '开放参观（中国票号博物馆）',
  },
  'tiantai-an': {
    lon: 113.44, lat: 36.34,
    level: '全国重点文物保护单位（第三批 · 1988）',
    preserve: '保存良好（经落架大修）',
    open: '开放参观',
  },
  'pingyao-wenmiao': {
    lon: 112.18, lat: 37.195,
    level: '全国重点文物保护单位（第五批 · 2001）',
    heritage: '世界文化遗产 · 平遥古城组成部分（1997）',
    preserve: '保存完好',
    open: '开放参观',
  },
  'jinci-shengmudian': {
    lon: 112.435, lat: 37.71,
    level: '全国重点文物保护单位（第一批 · 1961 · 晋祠）',
    preserve: '保存完好',
    open: '开放参观（晋祠博物馆）',
  },
  'jinci-xiandian': {
    lon: 112.437, lat: 37.708,
    level: '全国重点文物保护单位（第一批 · 1961 · 晋祠）',
    preserve: '保存完好',
    open: '开放参观（晋祠博物馆）',
  },
  'xingguosi-boruodian': {
    lon: 105.674, lat: 34.862,
    level: '全国重点文物保护单位（第四批 · 1996 · 兴国寺）',
    preserve: '保存良好',
    open: '开放参观',
  },
  'xingguosi-xiegong': {
    lon: 105.675, lat: 34.861,
    level: '全国重点文物保护单位（第四批 · 1996 · 兴国寺）',
    preserve: '保存良好',
    open: '开放参观',
  },
};

// 同址/近址聚合点（相距过近的收录项合并为一个可展开的点位）
const CLUSTERS = [
  { key: 'beijing',  name: '北京 · 故宫',       ids: ['wanchunting'] },
  { key: 'xian',     name: '陕西 · 西安',       ids: ['xian-gulou', 'hanyuandian', 'sanchuque'] },
  { key: 'kaifeng',  name: '河南 · 开封（示意）', ids: ['guanfu'] },
  { key: 'taiyuan',  name: '山西 · 太原晋祠',    ids: ['jinci-shengmudian', 'jinci-xiandian'] },
  { key: 'pingyao',  name: '山西 · 平遥古城',    ids: ['pingyao-xianya', 'rishengchang', 'pingyao-wenmiao'] },
  { key: 'gaoping',  name: '山西 · 晋城高平',    ids: ['jishi-minju'] },
  { key: 'pingshun', name: '山西 · 长治平顺',    ids: ['tiantai-an'] },
  { key: 'linfen',   name: '山西 · 临汾',       ids: ['niuwangmiao-xitai'] },
  { key: 'qinan',    name: '甘肃 · 天水秦安',    ids: ['xingguosi-boruodian', 'xingguosi-xiegong'] },
];

// 筛选维度
const ERA_FILTERS = [
  { key: 'all',   label: '全部',   test: () => true },
  { key: 'tang',  label: '唐·五代', test: (b) => /唐|五代/.test(b.era) },
  { key: 'song',  label: '宋·金',  test: (b) => /宋|金/.test(b.era) },
  { key: 'yuan',  label: '元',     test: (b) => /元代/.test(b.era) },
  { key: 'mingqing', label: '明·清', test: (b) => /明|清/.test(b.era) },
];

const REGION_FILTERS = [
  { key: 'all',     label: '全部',  test: () => true },
  { key: 'beijing', label: '北京',  test: (b) => b.location.includes('北京') },
  { key: 'shanxi',  label: '山西',  test: (b) => b.location.includes('山西') },
  { key: 'shaanxi', label: '陕西',  test: (b) => b.location.includes('陕西') },
  { key: 'gansu',   label: '甘肃',  test: (b) => b.location.includes('甘肃') },
  { key: 'other',   label: '其他',  test: (b) => !/北京|山西|陕西|甘肃/.test(b.location) },
];

// 朝代分布（概览条形图，按 buildings.js 实际统计）
const ERA_DIST = [
  { label: '唐 · 五代', count: 3 },
  { label: '宋 · 金',   count: 5 },
  { label: '元',        count: 4 },
  { label: '明 · 清',   count: 3 },
];

// ============================================================
// 全国文保态势层（数据来源：国务院第八批国保公布 + 国新办发布会，2019-10）
// 仅呈现官方发布会明确公布的国保数量前五省份，不对其余省份估算
// ============================================================

const NATIONAL_STATS = [
  { num: '5058', unit: '处', label: '全国重点文物保护单位（共八批）' },
  { num: '2160', unit: '处', label: '其中古建筑类国保' },
  { num: '76.7', unit: '万处', label: '全国登记不可移动文物（三普）' },
  { num: '421',  unit: '处', label: '山西古建筑类国保 · 约占全国 1/5' },
];

// 国保数量前五省（山西自 1996 年起稳居第一）；centroid 为标签落点经纬度，
// 刻意避开现有收录点位，避免遮挡
const PROVINCE_HERITAGE = [
  { name: '山西省', short: '山西', count: 531, lon: 112.6, lat: 39.2 },
  { name: '河南省', short: '河南', count: 419, lon: 113.8, lat: 33.4 },
  { name: '河北省', short: '河北', count: 286, lon: 116.2, lat: 38.1 },
  { name: '浙江省', short: '浙江', count: 279, lon: 120.2, lat: 29.1 },
  { name: '陕西省', short: '陕西', count: 268, lon: 109.1, lat: 37.2 },
];

const HERITAGE_MAX = 531;

// ============================================================
// 投影：Web 墨卡托，主图范围 lon 73.4–135.2 / lat 17.8–53.8
// ============================================================

const D2R = Math.PI / 180;
const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * D2R) / 2));

function makeProjection(lonMin, lonMax, latMin, latMax, width) {
  const x0 = lonMin * D2R;
  const x1 = lonMax * D2R;
  const y0 = mercY(latMin);
  const y1 = mercY(latMax);
  const height = (width * (y1 - y0)) / (x1 - x0);
  return {
    width,
    height,
    project(lon, lat) {
      const px = ((lon * D2R - x0) / (x1 - x0)) * width;
      const py = ((y1 - mercY(lat)) / (y1 - y0)) * height;
      return [px, py];
    },
  };
}

const MAIN = makeProjection(73.4, 135.2, 17.8, 53.8, 1000);   // ≈ 1000 x 743
const INSET = makeProjection(106.5, 122.5, 2.8, 24.5, 150);   // ≈ 150 x 190

// ============================================================
// DOM
// ============================================================

const svg = document.getElementById('map-svg');
const insetSvg = document.getElementById('inset-svg');
const pinsBox = document.getElementById('pins');
const pop = document.getElementById('spot-pop');
const toast = document.getElementById('toast');
const mapStatus = document.getElementById('map-status');

let eraKey = 'all';
let regionKey = 'all';
let selectedId = null;

// ============================================================
// GeoJSON → SVG path
// ============================================================

function ringToPath(ring, proj) {
  let d = '';
  for (let i = 0; i < ring.length; i++) {
    const [x, y] = proj.project(ring[i][0], ring[i][1]);
    d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1);
  }
  return d + 'Z';
}

function geomToPath(geom, proj) {
  let d = '';
  if (geom.type === 'Polygon') {
    for (const ring of geom.coordinates) d += ringToPath(ring, proj);
  } else if (geom.type === 'MultiPolygon') {
    for (const poly of geom.coordinates) for (const ring of poly) d += ringToPath(ring, proj);
  } else if (geom.type === 'LineString') {
    d += ringToPath(geom.coordinates, proj).replace(/Z$/, '');
  } else if (geom.type === 'MultiLineString') {
    for (const line of geom.coordinates) d += ringToPath(line, proj).replace(/Z$/, '');
  }
  return d;
}

function renderMap(geo) {
  const NS = 'http://www.w3.org/2000/svg';

  // 经纬网（10° 网格，科技感底纹）
  const grat = document.createElementNS(NS, 'g');
  grat.setAttribute('class', 'graticule');
  for (let lon = 80; lon <= 130; lon += 10) {
    const p = document.createElementNS(NS, 'path');
    let d = '';
    for (let lat = 17.8; lat <= 53.8; lat += 1) {
      const [x, y] = MAIN.project(lon, lat);
      d += (d ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
    }
    p.setAttribute('d', d);
    grat.appendChild(p);
  }
  for (let lat = 20; lat <= 50; lat += 10) {
    const p = document.createElementNS(NS, 'path');
    let d = '';
    for (let lon = 73.4; lon <= 135.2; lon += 1) {
      const [x, y] = MAIN.project(lon, lat);
      d += (d ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
    }
    p.setAttribute('d', d);
    grat.appendChild(p);
  }
  svg.appendChild(grat);

  // 省界（主图 + 插图各画一遍，插图自动裁掉视窗外部分）
  const heritageByName = new Map(PROVINCE_HERITAGE.map((p) => [p.name, p]));

  const drawFeatures = (target, proj, withHeat) => {
    const g = document.createElementNS(NS, 'g');
    for (const f of geo.features) {
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', geomToPath(f.geometry, proj));
      const isLine = /LineString/.test(f.geometry.type);
      path.setAttribute('class', isLine ? 'boundary-line' : 'province');
      const name = (f.properties && f.properties.name) || '';
      if (!isLine && name) {
        path.setAttribute('data-name', name);
        const hp = heritageByName.get(name);
        if (withHeat && hp) {
          // 文保态势层：按国保数量给前五省渐进鎏金填充（0.10 ~ 0.30）
          path.classList.add('heat');
          path.style.setProperty('--heat', (0.1 + 0.2 * (hp.count / HERITAGE_MAX)).toFixed(3));
          const title = document.createElementNS(NS, 'title');
          title.textContent = `${name} · 全国重点文物保护单位 ${hp.count} 处`;
          path.appendChild(title);
        }
      }
      g.appendChild(path);
    }
    target.appendChild(g);
  };
  drawFeatures(svg, MAIN, true);
  drawFeatures(insetSvg, INSET, false);

  renderHeritageTags();

  mapStatus.textContent = '边界数据 · GS(2024)0650号';
  mapStatus.classList.add('ok');
}

// ============================================================
// 点位
// ============================================================

function clusterState(cluster) {
  const items = cluster.ids.map((id) => ({ id, b: getBuildingById(id) })).filter((x) => x.b);
  const eraTest = ERA_FILTERS.find((f) => f.key === eraKey).test;
  const regionTest = REGION_FILTERS.find((f) => f.key === regionKey).test;
  const active = items.filter(({ b }) => eraTest(b) && regionTest(b));
  return { items, active };
}

function renderPins() {
  pinsBox.innerHTML = '';
  for (const cluster of CLUSTERS) {
    const { items, active } = clusterState(cluster);
    if (!items.length) continue;
    const meta = SITE_META[items[0].id];
    const [x, y] = MAIN.project(meta.lon, meta.lat);

    const pin = document.createElement('button');
    pin.className = 'pin';
    pin.style.left = (x / MAIN.width) * 100 + '%';
    pin.style.top = (y / MAIN.height) * 100 + '%';
    pin.setAttribute('data-label', cluster.name);

    const hasForge = active.some(({ b }) => b.canForge);
    if (!active.length) pin.classList.add('dim');
    else if (hasForge) pin.classList.add('forge');
    if (selectedId && cluster.ids.includes(selectedId)) pin.classList.add('sel');

    if (items.length > 1) {
      const n = document.createElement('i');
      n.className = 'pin-n';
      n.textContent = active.length || items.length;
      pin.appendChild(n);
    }

    pin.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const list = active.length ? active : items;
      if (list.length === 1) {
        select(list[0].id);
        hidePop();
      } else {
        showPop(cluster, list, pin);
      }
    });

    pinsBox.appendChild(pin);
  }
}

function showPop(cluster, list, pin) {
  pop.innerHTML = `<div class="pop-title">${cluster.name} · 收录 ${list.length} 项</div>`;
  for (const { id, b } of list) {
    const row = document.createElement('button');
    row.className = 'pop-row';
    row.innerHTML = `<b>${b.shortName}</b><em>${b.era.split('（')[0]}</em>`;
    row.addEventListener('click', (ev) => {
      ev.stopPropagation();
      select(id);
      hidePop();
    });
    pop.appendChild(row);
  }
  pop.hidden = false;
  // 定位在点位旁，越界翻转
  const wrapRect = pinsBox.getBoundingClientRect();
  const pinRect = pin.getBoundingClientRect();
  let left = pinRect.left - wrapRect.left + 24;
  let top = pinRect.top - wrapRect.top - 10;
  pop.style.left = '0px'; pop.style.top = '0px';
  const popW = pop.offsetWidth || 200;
  const popH = pop.offsetHeight || 120;
  if (left + popW > wrapRect.width - 8) left = pinRect.left - wrapRect.left - popW - 24;
  if (top + popH > wrapRect.height - 8) top = wrapRect.height - popH - 8;
  if (top < 8) top = 8;
  pop.style.left = left + 'px';
  pop.style.top = top + 'px';
}

function hidePop() { pop.hidden = true; }
document.addEventListener('click', hidePop);

// ============================================================
// 文保态势层：前五省数量标签 + 开关
// ============================================================

function renderHeritageTags() {
  const box = document.getElementById('heat-tags');
  box.innerHTML = '';
  PROVINCE_HERITAGE.forEach((p, i) => {
    const [x, y] = MAIN.project(p.lon, p.lat);
    const tag = document.createElement('div');
    tag.className = 'heat-tag';
    tag.style.left = (x / MAIN.width) * 100 + '%';
    tag.style.top = (y / MAIN.height) * 100 + '%';
    tag.style.setProperty('--d', i * 0.1 + 's');
    tag.innerHTML = `<b>${p.short}</b><span class="mono">${p.count}</span>`;
    tag.title = `${p.name} · 全国重点文物保护单位 ${p.count} 处（第八批公布后）`;
    box.appendChild(tag);
  });
}

function bindHeatToggle() {
  const btn = document.getElementById('heat-toggle');
  const wrap = document.getElementById('map-wrap');
  btn.addEventListener('click', () => {
    const off = wrap.classList.toggle('heat-off');
    btn.classList.toggle('off', off);
    btn.querySelector('em').textContent = off ? '已隐藏' : '已开启';
  });
}

// ============================================================
// 右侧面板
// ============================================================

function select(id) {
  selectedId = id;
  const b = getBuildingById(id);
  const meta = SITE_META[id] || {};
  if (!b) return;

  document.getElementById('s-name').textContent = b.name;
  const img = document.getElementById('s-img');
  img.src = (b.images && (b.images.full || b.images.real)) || '';
  img.alt = b.name;

  const badges = document.getElementById('s-badges');
  badges.innerHTML = '';
  const addBadge = (text, cls) => {
    const s = document.createElement('span');
    s.className = 'sb ' + cls;
    s.textContent = text;
    badges.appendChild(s);
  };
  if (/全国重点/.test(meta.level || '')) addBadge('全国重点文保单位', 'red');
  else if (/世界文化遗产/.test(meta.level || '')) addBadge('世界遗产组成部分', 'red');
  else addBadge('数字复原', 'ink');
  if (meta.heritage) addBadge('世界遗产关联', 'gold');
  if (/开放/.test(meta.open || '')) addBadge('开放参观', 'green');
  if (b.canForge) addBadge('可交互拼装', 'gold');

  const rows = document.getElementById('s-rows');
  const row = (k, v) => (v && v !== '——') ? `<div class="r"><dt>${k}</dt><dd>${v}</dd></div>` : '';
  rows.innerHTML =
    row('建筑类别', b.category) +
    row('所在地区', b.location) +
    row('建造年代', b.era) +
    row('保护等级', meta.level) +
    row('保存现状', meta.preserve) +
    row('开放情况', meta.open) +
    row('复原依据', meta.restore) +
    row('坐标说明', meta.posNote) +
    row('经纬坐标', `<span class="mono">${meta.lon.toFixed(3)}°E , ${meta.lat.toFixed(3)}°N</span>`);

  document.getElementById('s-kw').textContent = '斗拱看点 · ' + b.keyword;
  const goto = document.getElementById('s-goto');
  goto.href = '/view2.html?b=' + id;
  goto.textContent = '进入鉴赏 · 三维模型 →';
  renderPins();
}

// ============================================================
// 筛选 chips
// ============================================================

function buildChips(elId, filters, getKey, setKey) {
  const box = document.getElementById(elId);
  box.innerHTML = '';
  for (const f of filters) {
    const c = document.createElement('button');
    c.className = 'chip' + (getKey() === f.key ? ' on' : '');
    c.textContent = f.label;
    c.addEventListener('click', () => {
      setKey(f.key);
      buildChips('chips-era', ERA_FILTERS, () => eraKey, (k) => (eraKey = k));
      buildChips('chips-region', REGION_FILTERS, () => regionKey, (k) => (regionKey = k));
      renderPins();
      const eraTest = ERA_FILTERS.find((x) => x.key === eraKey).test;
      const regionTest = REGION_FILTERS.find((x) => x.key === regionKey).test;
      const n = BUILDINGS.filter((b) => eraTest(b) && regionTest(b)).length;
      showToast(`当前筛选命中 ${n} 座古建`);
    });
    box.appendChild(c);
  }
}

let toastTimer = null;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
}

// ============================================================
// 概览：计数动画 + 朝代分布条
// ============================================================

function animateCounters() {
  document.querySelectorAll('.head-stats b[data-count]').forEach((el) => {
    const target = Number(el.getAttribute('data-count'));
    const t0 = performance.now();
    const dur = 1100;
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

function renderNationalStats() {
  const box = document.getElementById('nat-stats');
  box.innerHTML = '';
  for (const s of NATIONAL_STATS) {
    const el = document.createElement('div');
    el.className = 'ns';
    el.innerHTML = `<b class="mono">${s.num}<i>${s.unit}</i></b><em>${s.label}</em>`;
    box.appendChild(el);
  }
}

function renderBars() {
  const box = document.getElementById('ov-bars');
  const max = Math.max(...ERA_DIST.map((d) => d.count));
  box.innerHTML = '<div class="ov-bars-title">朝代分布（座）</div>';
  ERA_DIST.forEach((d, i) => {
    const row = document.createElement('div');
    row.className = 'bar-row';
    row.innerHTML = `
      <span class="bar-label">${d.label}</span>
      <span class="bar-track"><i style="--w:${(d.count / max) * 100}%; --d:${i * 0.12}s"></i></span>
      <span class="bar-num mono">${d.count}</span>`;
    box.appendChild(row);
  });
}

// ============================================================
// 启动
// ============================================================

async function boot() {
  buildChips('chips-era', ERA_FILTERS, () => eraKey, (k) => (eraKey = k));
  buildChips('chips-region', REGION_FILTERS, () => regionKey, (k) => (regionKey = k));
  renderNationalStats();
  renderBars();
  animateCounters();
  bindHeatToggle();
  select('wanchunting');

  try {
    const res = await fetch('/data/china-provinces.json');
    const geo = await res.json();
    renderMap(geo);
  } catch (err) {
    mapStatus.textContent = '边界数据加载失败';
    console.error('[map2] geojson load failed', err);
  }
  renderPins();
}

boot();
