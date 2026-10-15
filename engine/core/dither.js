// 第二十五轮（用户：2:11 蓝色渐变背景有明显的色带，想办法去掉）
// 大面积、颜色跨度小的渐变（间奏二线稿段的深蓝底：#1C2A78 → #101850，红只差 12 级、绿 18 级）在 8 位色深里只有十几个色阶，
// 每一级是一整圈几十 px 宽的环，出片编码以后更明显。这里逐像素按浮点算渐变，加一点三角分布的抖动再量化（色阶之间的边被打散成细颗粒），
// 算一次缓存成静态图——只由参数决定、和时刻无关；颗粒不动，编码器也容易保住它。
import { newCanvas } from './env.js';

const CACHE = new Map();
const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const h01 = (x, y, s) => { // 每个像素一个确定的 [0, 1) 随机数（整数哈希，比 rand.js 的 hash 快，200 万像素只算一次）
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(s, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};
// 和 ctx.createRadialGradient(x0, y0, r0, x1, y1, r1) + 两个色标（0 → col0，1 → col1）一样的双圆锥渐变，铺满 w × h；amp = 抖动幅度（色阶）
export function ditheredRadial(w, h, [x0, y0, r0], [x1, y1, r1], col0, col1, amp = 1.6) {
  const key = [w, h, x0, y0, r0, x1, y1, r1, col0, col1, amp].join(',');
  if (CACHE.has(key)) return CACHE.get(key);
  const c = newCanvas(w, h), g = c.getContext('2d'), im = g.createImageData(w, h), d = im.data, A = rgb(col0), B = rgb(col1);
  const cdx = x1 - x0, cdy = y1 - y0, dr = r1 - r0, a = cdx * cdx + cdy * cdy - dr * dr;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const px = x + 0.5 - x0, py = y + 0.5 - y0, b = -2 * (px * cdx + py * cdy + r0 * dr), cc = px * px + py * py - r0 * r0;
    let om;
    if (Math.abs(a) < 1e-9) om = -cc / b;
    else { const disc = Math.max(0, b * b - 4 * a * cc), s = Math.sqrt(disc), w1 = (-b + s) / (2 * a), w2 = (-b - s) / (2 * a); om = Math.max(w1, w2); if (r0 + om * dr < 0) om = Math.min(w1, w2); }
    const u = Math.min(1, Math.max(0, om)), o = (y * w + x) * 4;
    for (let ch = 0; ch < 3; ch++) {
      const n = (h01(x, y, ch * 2 + 1) + h01(x, y, ch * 2 + 2) - 1) * amp; // 三角分布 [−amp, amp]
      d[o + ch] = Math.max(0, Math.min(255, Math.round(A[ch] + (B[ch] - A[ch]) * u + n)));
    }
    d[o + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  CACHE.set(key, c);
  return c;
}
