// 调色板与段落色调（视觉方案 §三）
import { BRAND, BAR } from './const.js';
import { pos, barStart, clamp } from './time.js';

const hex2 = n => n.toString(16).padStart(2, '0');
export const rgb = s => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
export const toHex = ([r, g, b]) => '#' + hex2(r) + hex2(g) + hex2(b);
export const mix = (a, b, u) => { const x = rgb(a), y = rgb(b); return toHex(x.map((v, i) => Math.round(v + (y[i] - v) * clamp(u)))); };
export const css = (c, a = 1) => { const [r, g, b] = rgb(c); return a >= 1 ? c : `rgba(${r},${g},${b},${a})`; };

function rgb2hsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hsl2rgb([h, s, l]) {
  h = ((h % 360) + 360) % 360 / 360;
  if (s === 0) return [l, l, l].map(v => Math.round(v * 255));
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)].map(v => Math.round(v * 255));
}
export const shiftHue = (c, deg, satMul = 1) => { const [h, s, l] = rgb2hsl(rgb(c)); return toHex(hsl2rgb([h + deg, clamp(s * satMul), l])); };

// 字段：bg 背景 · grid 网格线 · ink 字符墨色 5 级（疏 → 密）· text 正文 · gray 思考文字
//       acc 三个点缀色 · win / winEdge 窗口 · shadow 投影色（透明度 shadowA）
//       line 贴纸卡的线色 · tint 贴纸浅底 4 色（樱 / 柠 / 薄荷 / 天蓝，视觉方案 §4.13）
export const PAL = {
  sky: {
    name: '晴空', bg: '#F5F8FF', grid: '#E3EBFC',
    ink: ['#D3DEFA', '#A9BDF5', '#7B97F7', '#4D6BFE', '#2A3F9E'],
    text: '#1D2541', gray: '#8B93A7', acc: ['#FF6FA8', '#FFCB3D', '#34D1BF'],
    win: '#FFFFFF', winEdge: '#C7D3F5', shadow: '#4D6BFE', shadowA: 0.14,
    line: '#7B97F7', tint: ['#FFE1EC', '#FFF2C2', '#D2F4EF', '#E1E8FF'],
  },
  night: {
    name: '夜海', bg: '#F2F4FF', grid: '#DFE4FB',
    ink: ['#C9D2FA', '#9FAEEE', '#6E6AF0', '#4D5BD8', '#2B2F77'],
    text: '#1B2044', gray: '#8A90B8', acc: ['#FF4D9D', '#9A7BFF', '#3FC6E8'],
    win: '#FFFFFF', winEdge: '#C8CEF8', shadow: '#6E6AF0', shadowA: 0.16,
    line: '#6E6AF0', tint: ['#FFDDEB', '#E6DFFF', '#D3F0F9', '#E2E5FF'],
  },
  morning: {
    name: '晨光', bg: '#FFF7EC', grid: '#F6E6D0',
    ink: ['#F6D9BF', '#F2C4A6', '#EFAE8C', '#EC9973', '#E8835A'],
    text: '#1D2541', gray: '#A3978A', acc: ['#FF7FA8', '#FFC23D', BRAND],
    win: '#FFFFFF', winEdge: '#EED8C0', shadow: '#E8835A', shadowA: 0.16,
    line: '#EC9973', tint: ['#FFE3EC', '#FFF0C9', '#FFE6D6', '#E1E8FF'],
  },
  duo: {
    name: '蒙版双色', bg: '#F5F8FF', grid: '#E6E9F2',
    ink: ['#D9DCE6', '#AEB3C6', '#7C829C', '#4A5170', '#141A3A'],
    text: '#141A3A', gray: '#7C829C', acc: [BRAND, '#3FA9FF', '#141A3A'],
    win: '#F5F8FF', winEdge: '#141A3A', shadow: '#141A3A', shadowA: 0.18,
    line: '#141A3A', tint: ['#E6E9F2', '#E6E9F2', '#E6E9F2', '#E6E9F2'],
    dark: '#141A3A', eye: '#3FA9FF',
  },
};
export const CRT = { stripe: '#FFD84A', white: '#FFFFFF', screen: '#3E9C93' };
export const GLITCH = ['#00E5FF', '#FF2BD6', '#FFE600'];

const CACHE = new Map();
const memo = (key, make) => { let p = CACHE.get(key); if (!p) { p = make(); p.key = key; CACHE.set(key, p); } return p; };

export function lerpPal(a, b, u) {
  u = Math.round(clamp(u) * 8) / 8; // 量化成 8 级，避免每帧生成新的字形缓存
  return memo(`${a}>${b}@${u}`, () => {
    const A = PAL[a], B = PAL[b], o = { name: u < 0.5 ? A.name : B.name };
    for (const k of Object.keys(A)) {
      const x = A[k], y = B[k];
      if (Array.isArray(x)) o[k] = x.map((c, i) => mix(c, y[i], u));
      else if (typeof x === 'number') o[k] = x + (y - x) * u;
      else if (typeof x === 'string' && x[0] === '#' && typeof y === 'string') o[k] = mix(x, y, u);
      else o[k] = u < 0.5 ? x : y;
    }
    return o;
  });
}
export const pal = name => memo(name, () => ({ ...PAL[name] }));

// 高温（特效音间奏，k = 1..8）：夜海每小节色相 +15°、饱和度上调，并混入失真色
export function heat(k) {
  return memo(`heat${k}`, () => {
    const N = PAL.night, u = k / 8;
    return {
      ...N, name: '高温',
      ink: N.ink.map(c => shiftHue(c, 15 * k, 1 + 0.1 * k)),
      acc: N.acc.map((c, i) => mix(shiftHue(c, 15 * k, 1 + 0.1 * k), GLITCH[i], u)),
      grid: shiftHue(N.grid, 15 * k), gray: shiftHue(N.gray, 15 * k),
    };
  });
}

// 段落色调表（视觉方案 §3.1）
export function paletteAt(t) {
  const { bar } = pos(t);
  if (bar < 34) return pal('sky');
  if (bar <= 41) return lerpPal('sky', 'night', (bar - 33) / 8);
  if (bar <= 65) return pal('night');
  if (bar <= 73) return heat(bar - 65);
  if (bar <= 88) return pal('duo');
  if (bar === 89) return lerpPal('duo', 'morning', (t - barStart(89)) / BAR);
  if (bar <= 106) return pal('morning');
  if (bar <= 118) return lerpPal('morning', 'sky', (bar - 106) / 12);
  return pal('sky');
}

// 色值键（精灵定义里用）→ 实际颜色
export function resolveColor(p, key) {
  switch (key) {
    case 'brand': return BRAND;
    case 'acc0': return p.acc[0];
    case 'acc1': return p.acc[1];
    case 'acc2': return p.acc[2];
    case 'win': return p.win;
    case 'text': return p.text;
    case 'gray': return p.gray;
    default: return key.startsWith('ink') ? p.ink[+key[3]] : key;
  }
}
