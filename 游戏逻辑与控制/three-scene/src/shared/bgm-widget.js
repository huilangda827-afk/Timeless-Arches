/**
 * 新版页面（home2 / catalog2 / map2 / view2 / arcade / collection2）的 BGM 挂件
 *
 * 复用 src/portal/bgm.js 单例控制器（首次交互解锁、跨页静音记忆、切轨 crossfade），
 * 并在页面右下角注入一枚小巧的静音开关，风格与新设计语言一致。
 */
import * as BGM from '../portal/bgm.js';

export function mountBgm(track = 'portal') {
  BGM.play(track);

  const btn = document.createElement('button');
  btn.id = 'bgm-widget';
  btn.title = '背景音乐';
  btn.style.cssText = `
    position: fixed; right: 22px; bottom: 22px; z-index: 260;
    width: 44px; height: 44px; border-radius: 50%;
    border: 1px solid rgba(201, 162, 75, 0.5);
    background: rgba(19, 14, 8, 0.82);
    color: #c9a24b; font-size: 17px; cursor: pointer;
    backdrop-filter: blur(6px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.45);
    transition: all 0.25s;
  `;
  const refresh = () => {
    btn.textContent = BGM.isMuted() ? '🔇' : '🎵';
    btn.style.opacity = BGM.isMuted() ? '0.55' : '1';
  };
  btn.addEventListener('click', () => { BGM.toggleMute(); refresh(); });
  btn.addEventListener('mouseenter', () => { btn.style.borderColor = '#c9a24b'; });
  btn.addEventListener('mouseleave', () => { btn.style.borderColor = 'rgba(201, 162, 75, 0.5)'; });
  refresh();
  document.body.appendChild(btn);
}
