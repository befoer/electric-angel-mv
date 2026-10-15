// 点云：从立绘或文字采样点，做吹散、坍缩、变形（第六轮）
// 采样只在第一次用到时做一次（离屏画布 + getImageData），之后每帧只算位置、画小方块
import { newCanvas } from './env.js';
import { fonts } from './glyphs.js';
import { hash, rnd, vnoise } from './rand.js';
import { clamp, lerp } from './time.js';

const CACHE = new Map();

// 从画布采样 n 个点（不透明处）。返回 { n, x, y（中心为原点，单位像素，按 src 尺寸）, col（颜色索引）, pal（颜色表）, w, h }
// o.maxDim 采样分辨率；o.thr 透明度阈值；o.order 'random'|'y'|'x'|'angle'（决定与另一组点配对时的对应关系）；o.colors false 不取颜色
export function sampleCanvas(key, src, n, { maxDim = 360, thr = 120, order = 'random', colors = true } = {}) {
  const k = `${key}|${n}|${maxDim}|${order}`;
  let P = CACHE.get(k);
  if (P) return P;
  const sc = Math.min(1, maxDim / Math.max(src.width, src.height));
  const w = Math.max(1, Math.round(src.width * sc)), h = Math.max(1, Math.round(src.height * sc));
  const cv = newCanvas(w, h), c = cv.getContext('2d');
  c.drawImage(src, 0, 0, w, h);
  const d = c.getImageData(0, 0, w, h).data, cand = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > thr) cand.push(y * w + x);
  // 确定性打乱后取前 n 个（不够就重复）
  const idx = cand.map((p, i) => [hash(p, 17) , p]).sort((a, b) => a[0] - b[0]).map(a => a[1]);
  const pick = Array.from({ length: n }, (_, i) => idx[i % Math.max(1, idx.length)] ?? 0);
  const keyOf = p => {
    const x = p % w, y = (p / w) | 0;
    return order === 'y' ? y * w + x : order === 'x' ? x * h + y : order === 'angle' ? Math.atan2(y - h / 2, x - w / 2) : 0;
  };
  if (order !== 'random') pick.sort((a, b) => keyOf(a) - keyOf(b));
  P = { n, x: new Float32Array(n), y: new Float32Array(n), col: new Uint16Array(n), pal: [], w: src.width, h: src.height };
  const palIdx = new Map();
  pick.forEach((p, i) => {
    const px = p % w, py = (p / w) | 0;
    P.x[i] = (px + rnd(i, 1) - w / 2) / sc; P.y[i] = (py + rnd(i, 2) - h / 2) / sc;
    if (colors) {
      const o = p * 4, q = v => Math.min(255, Math.round(v / 24) * 24);
      const ck = `rgb(${q(d[o])},${q(d[o + 1])},${q(d[o + 2])})`;
      if (!palIdx.has(ck)) { palIdx.set(ck, P.pal.length); P.pal.push(ck); }
      P.col[i] = palIdx.get(ck);
    }
  });
  CACHE.set(k, P);
  return P;
}

// 文字采样：用 fonts(px, ...keys) 的字体把 str 画出来再采样
const TXT = new Map();
export function sampleText(str, n, { keys = ['DELA'], px = 400, order = 'random' } = {}) {
  const k = `${str}|${keys}|${px}`;
  let cv = TXT.get(k);
  if (!cv) {
    const m = newCanvas(8, 8).getContext('2d');
    m.font = fonts(px, ...keys);
    const mt = m.measureText(str), w = Math.ceil(mt.width + px * 0.2), h = Math.ceil(px * 1.3);
    cv = newCanvas(w, h);
    const c = cv.getContext('2d');
    c.font = fonts(px, ...keys); c.fillStyle = '#000'; c.textBaseline = 'middle'; c.textAlign = 'center';
    c.fillText(str, w / 2, h / 2);
    TXT.set(k, cv);
  }
  return sampleCanvas(`txt:${k}`, cv, n, { maxDim: 320, order, colors: false });
}

// 风：每个点按流场漂移。strength 0 = 原位；1 = 吹出约 dist 像素。返回位移 [dx, dy]
export function windOffset(i, x, y, t, strength, { dist = 420, dir = [1, -0.15], seed = 0 } = {}) {
  if (strength <= 0) return [0, 0];
  const a = (vnoise(x * 0.004, y * 0.004, t * 0.6, seed) - 0.5) * 3.2;
  const lag = 0.4 + 0.6 * rnd(i, seed, 3); // 每个点被吹走的快慢不同
  const s = strength * lag * dist;
  return [s * (dir[0] + Math.cos(a) * 0.45), s * (dir[1] + Math.sin(a) * 0.45)];
}

// 画点云：中心 (cx, cy)，缩放 scale，点大小 size（像素）。o.color 统一颜色（否则用采样颜色）；
// o.offset(i, x, y) → [dx, dy] 额外位移；o.alpha；o.morph { to: 另一组点, u } 向另一组点变形
export function drawPoints(ctx, P, cx, cy, scale, size, o = {}) {
  const n = P.n, M = o.morph, mu = M ? clamp(M.u) : 0, to = M?.to;
  ctx.save();
  ctx.globalAlpha *= o.alpha ?? 1;
  const groups = o.color || !P.pal.length ? [[o.color || '#4D6BFE', null]] : P.pal.map((c, g) => [c, g]);
  for (const [color, g] of groups) {
    ctx.fillStyle = color;
    for (let i = 0; i < n; i++) {
      if (g !== null && P.col[i] !== g) continue;
      let x = P.x[i] * scale, y = P.y[i] * scale;
      if (to) {
        const j = i % to.n, e = clamp(mu * 1.3 - rnd(i, 7) * 0.3);
        const s = e * e * (3 - 2 * e), tx = to.x[j] * (M.scale ?? scale) + (M.dx ?? 0), ty = to.y[j] * (M.scale ?? scale) + (M.dy ?? 0);
        const arc = Math.sin(Math.PI * s) * (M.arc ?? 120) * (rnd(i, 8) - 0.5);
        x = lerp(x, tx, s) + arc; y = lerp(y, ty, s) - Math.abs(arc) * 0.5;
      }
      if (o.offset) { const d = o.offset(i, x, y); x += d[0]; y += d[1]; }
      const sz = o.sizeOf ? o.sizeOf(i) * size : size;
      ctx.fillRect(cx + x - sz / 2, cy + y - sz / 2, sz, sz);
    }
  }
  ctx.restore();
}
