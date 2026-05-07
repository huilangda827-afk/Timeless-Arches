// ============================================================================
// 门户 / 探微 / 筑梦 共用的 BGM 控制器
//
//   - 单例：page 之间切换时不会有多份音轨叠加播放
//   - 首次用户交互自动解锁（绕开浏览器 autoplay policy）
//   - 不同 track 切换时做 300ms crossfade，避免突兀
//   - mute 状态写 localStorage，跨页/刷新保持
//
// 路径表（mp3 在 /public 根下）：
//   portal  → 浮光.mp3        ：首页 / 万象 / 鉴赏
//   explore → 末代皇帝.mp3    ：探微浮层
//   forge   → 江上清风游.mp3  ：筑梦（当前由 src/main.js 自己管理，这里仅留 hook）
// ============================================================================

const TRACKS = {
  portal:  { src: '/浮光.mp3',        volume: 0.32 },
  explore: { src: '/末代皇帝.mp3',    volume: 0.36 },
  forge:   { src: '/江上清风游.mp3',  volume: 0.32 },
};

const LS_MUTE_KEY = 'portal_bgm_muted';

// audios[trackId] = HTMLAudioElement
const audios = {};
let currentTrack = null;          // 当前正在播（未必正在响）的 track id
let userUnlocked = false;          // 是否已收到第一次用户交互
let muted = false;
try { muted = localStorage.getItem(LS_MUTE_KEY) === '1'; } catch (e) {}

// ---------- 首次交互解锁 ----------
// HTML5 Audio 在多数浏览器中需要 user gesture 才能 play。我们注册一次性 pointerdown 监听，
// 第一次点击时强行 play+pause 一次以"激活"音频上下文，之后才能用代码自由 play。
function attachUnlock() {
  if (userUnlocked) return;
  const onFirst = () => {
    if (userUnlocked) return;
    userUnlocked = true;
    // 如果有挂起的 track，立即开播
    if (currentTrack) play(currentTrack, /*forceFromStart*/false);
    document.removeEventListener('pointerdown', onFirst);
    document.removeEventListener('keydown', onFirst);
  };
  document.addEventListener('pointerdown', onFirst, { once: false });
  document.addEventListener('keydown', onFirst, { once: false });
}
attachUnlock();

function getOrCreate(id) {
  if (audios[id]) return audios[id];
  const t = TRACKS[id];
  if (!t) return null;
  const a = new Audio(t.src);
  a.loop = true;
  a.preload = 'auto';
  a.volume = 0;
  audios[id] = a;
  return a;
}

// crossfade 实现：旧轨在 ms 内淡到 0，新轨从 0 升到目标
function fadeTo(audio, target, ms) {
  if (!audio) return;
  if (audio._fadeT) { clearInterval(audio._fadeT); audio._fadeT = null; }
  const start = audio.volume;
  const t0 = performance.now();
  audio._fadeT = setInterval(() => {
    const k = Math.min(1, (performance.now() - t0) / ms);
    audio.volume = start + (target - start) * k;
    if (k >= 1) {
      clearInterval(audio._fadeT);
      audio._fadeT = null;
      if (target <= 0.001) {
        try { audio.pause(); } catch (e) {}
      }
    }
  }, 30);
}

// ---------- 公开 API ----------
export function play(trackId, forceFromStart = false) {
  if (!TRACKS[trackId]) return;
  if (currentTrack === trackId && audios[trackId] && !audios[trackId].paused) {
    return; // 已经在放同一首，不打扰
  }
  // 暂停其它音轨（带淡出）
  Object.entries(audios).forEach(([id, a]) => {
    if (id !== trackId && !a.paused) fadeTo(a, 0, 300);
  });

  currentTrack = trackId;
  if (!userUnlocked) {
    // 浏览器还没解锁，留待第一次交互后由 onFirst() 重新调用
    return;
  }

  const a = getOrCreate(trackId);
  if (!a) return;
  if (forceFromStart) { try { a.currentTime = 0; } catch (e) {} }
  const target = muted ? 0 : TRACKS[trackId].volume;
  a.play().then(() => fadeTo(a, target, 320)).catch((err) => {
    // 大概率是 user gesture 未完成 — 静默退化，由下次交互再触发
    console.debug('[BGM] play 阻止：', err.message);
  });
}

export function pause() {
  if (currentTrack && audios[currentTrack]) {
    fadeTo(audios[currentTrack], 0, 250);
  }
  currentTrack = null;
}

export function toggleMute() {
  setMuted(!muted);
  return muted;
}

export function setMuted(v) {
  muted = !!v;
  try { localStorage.setItem(LS_MUTE_KEY, muted ? '1' : '0'); } catch (e) {}
  // 立刻应用到当前音轨
  if (currentTrack && audios[currentTrack]) {
    const t = TRACKS[currentTrack];
    fadeTo(audios[currentTrack], muted ? 0 : t.volume, 200);
  }
}

export function isMuted() { return muted; }
export function currentId() { return currentTrack; }
