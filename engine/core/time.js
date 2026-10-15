import { BAR0, BEAT, BAR, STEP } from './const.js';

export const barStart = k => BAR0 + BAR * (k - 1);
export const beatTime = (bar, beat = 1) => BAR0 + BAR * (bar - 1) + BEAT * (beat - 1);

// 时刻 → 拍位置。ni 是从第 1 小节第 1 拍起的整拍序号（可为负）
export function pos(t) {
  const n = (t - BAR0) / BEAT;
  const ni = Math.floor(n);
  return { n, ni, bar: Math.floor(ni / 4) + 1, beat: ((ni % 4) + 4) % 4 + 1, sub: n - ni };
}

export const q16 = t => BAR0 + Math.round((t - BAR0) / STEP) * STEP;

export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, u) => a + (b - a) * u;
export const easeOut = u => 1 - Math.pow(1 - clamp(u), 3);
export const easeIn = u => Math.pow(clamp(u), 3);
export const smooth = u => { u = clamp(u); return u * u * (3 - 2 * u); };
export function easeOutBack(u, s = 1.70158) { u = clamp(u) - 1; return u * u * ((s + 1) * u + s) + 1; }
// 距事件 dt 秒后的衰减包络（dt < 0 时为 0）
export const decay = (dt, k) => (dt < 0 ? 0 : Math.exp(-dt * k));

export function fmtTime(t) {
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${String(m).padStart(2, '0')}:${s.toFixed(3).padStart(6, '0')}`;
}
