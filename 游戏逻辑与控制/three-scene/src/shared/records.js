/**
 * 拾光筑梦 · 全站成就记录（localStorage）
 *
 * 记录玩家足迹，供「藏宝阁」成就卡牌展示：
 *   viewed    —— 在鉴赏(view2)中看过哪些建筑        { [buildingId]: 首次时间戳 }
 *   forged    —— 筑梦通关记录                        { [levelId]: { count, bestMs } }
 *   precision —— 精微匠造评级                        { [levelId]: { grade, score } }
 *   timed     —— 千钧一刻（限时模式）最佳成绩        { [levelId]: { bestMs, rank } }
 *   repair    —— 拾遗补缺（修复模式）               { plays, wins, bestMiss }
 *
 * 所有写入都是幂等/防御式的：localStorage 不可用时静默降级，绝不影响主流程。
 */

const KEY = 'ta_records_v1';

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    const data = raw ? JSON.parse(raw) : {};
    return {
      viewed: data.viewed || {},
      forged: data.forged || {},
      precision: data.precision || {},
      timed: data.timed || {},
      repair: data.repair || { plays: 0, wins: 0 },
      quake: data.quake || { plays: 0, bestMag: 0 },
    };
  } catch (_) {
    return { viewed: {}, forged: {}, precision: {}, timed: {}, repair: { plays: 0, wins: 0 }, quake: { plays: 0, bestMag: 0 } };
  }
}

function save(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (_) {}
}

export function getRecords() {
  return load();
}

/** 鉴赏：看过某建筑 */
export function markViewed(buildingId) {
  if (!buildingId) return;
  const d = load();
  if (!d.viewed[buildingId]) {
    d.viewed[buildingId] = Date.now();
    save(d);
  }
}

/** 筑梦：通关（elapsedMs 可选） */
export function markForged(levelId, elapsedMs) {
  if (!levelId) return;
  const d = load();
  const rec = d.forged[levelId] || { count: 0, bestMs: null };
  rec.count += 1;
  if (Number.isFinite(elapsedMs) && elapsedMs > 0) {
    rec.bestMs = rec.bestMs == null ? elapsedMs : Math.min(rec.bestMs, elapsedMs);
  }
  d.forged[levelId] = rec;
  save(d);
}

/** 千钧一刻：限时模式成绩（只保留最好） */
export function markTimed(levelId, elapsedMs, rank) {
  if (!levelId || !Number.isFinite(elapsedMs)) return;
  const d = load();
  const rec = d.timed[levelId];
  if (!rec || elapsedMs < rec.bestMs) {
    d.timed[levelId] = { bestMs: elapsedMs, rank };
    save(d);
  }
}

/** 精微匠造：评级（只保留更高分） */
export function markPrecision(levelId, grade, score) {
  if (!levelId) return;
  const d = load();
  const rec = d.precision[levelId];
  if (!rec || score > rec.score) {
    d.precision[levelId] = { grade, score };
    save(d);
  }
}

/** 拾遗补缺：一局结束（win = 全部补对） */
export function markRepair(win) {
  const d = load();
  d.repair.plays += 1;
  if (win) d.repair.wins += 1;
  save(d);
}

/** 稳如山（地震台）：一次试炼结束，survived = 斗拱扛住了全程 */
export function markQuake(magnitude, survived) {
  const d = load();
  if (!d.quake) d.quake = { plays: 0, bestMag: 0 };
  d.quake.plays += 1;
  if (survived && magnitude > d.quake.bestMag) d.quake.bestMag = magnitude;
  save(d);
}

/** 汇总统计（藏宝阁页头用） */
export function getSummary() {
  const d = load();
  return {
    viewedCount: Object.keys(d.viewed).length,
    forgedCount: Object.keys(d.forged).length,
    precisionBest: Object.values(d.precision).map((x) => x.grade).sort()[0] || null,
    timedBest: d.timed,
    repairWins: d.repair.wins,
  };
}
