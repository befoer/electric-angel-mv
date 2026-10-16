// 后期与画面效果（视觉方案 §4.3、§4.10）
import { W, H } from './const.js';
import { rnd, hash, vnoise } from './rand.js';
import { css } from './color.js';
import { clamp } from './time.js';
import { newCanvas, hiCanvas } from './env.js';

export function flash(ctx, a, color = '#FFFFFF') {
  if (a <= 0.003) return;
  ctx.globalAlpha = Math.min(1, a);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;
}

export function invert(ctx, a = 1) {
  ctx.globalCompositeOperation = 'difference';
  ctx.globalAlpha = a;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

// 抖动偏移（每 1/30 秒换一次），返回 [dx, dy]
export const shake = (t, amp, seed = 0) => {
  const k = Math.floor(t * 30);
  return [(rnd(k, seed, 1) - 0.5) * 2 * amp, (rnd(k, seed, 2) - 0.5) * 2 * amp];
};

export function scanlines(ctx, a = 0.04, color = '#141A3A') {
  ctx.fillStyle = css(color, a);
  for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
}

// 把 src 按 cover 方式画进 w×h；src 为 illust() 的返回值或画布
export function drawCover(ctx, src, x, y, w, h) {
  const s = src.img ? src : { img: src, sx: 0, sy: 0, sw: src.width, sh: src.height };
  const ta = w / h, sa = s.sw / s.sh;
  let sx = s.sx, sy = s.sy, sw = s.sw, sh = s.sh;
  if (sa > ta) { sw = sh * ta; sx += (s.sw - sw) / 2; } else { sh = sw / ta; sy += (s.sh - sh) / 2; }
  ctx.drawImage(s.img, sx, sy, sw, sh, x, y, w, h);
}

// 漫画分格式的白框图片：以 (cx, cy) 为中心，旋转 rot 弧度
export function framed(ctx, src, cx, cy, w, h, { rot = 0, scale = 1, border = 10, color = '#FFFFFF', shadow = 'rgba(77,107,254,0.18)', alpha = 1 } = {}) {
  if (alpha <= 0 || scale <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy); ctx.rotate(rot); ctx.scale(scale, scale);
  ctx.fillStyle = shadow; ctx.fillRect(-w / 2 - border + 8, -h / 2 - border + 10, w + 2 * border, h + 2 * border);
  ctx.fillStyle = color; ctx.fillRect(-w / 2 - border, -h / 2 - border, w + 2 * border, h + 2 * border);
  drawCover(ctx, src, -w / 2, -h / 2, w, h);
  ctx.restore();
}

// 纯色剪影副本（缓存）：src 的不透明部分填成 color。用于色差、残影
const TINTS = new Map();
let tintId = 0;
export function tinted(src, color) {
  if (!src.__tid) src.__tid = ++tintId;
  const k = `${src.__tid}|${color}|${src.width}x${src.height}`;
  let cv = TINTS.get(k);
  if (cv) return cv;
  cv = src.__ss ? hiCanvas(src.width, src.height) : newCanvas(src.width, src.height);
  const c = cv.getContext('2d');
  c.drawImage(src, 0, 0);
  c.globalCompositeOperation = 'source-in'; c.fillStyle = color; c.fillRect(0, 0, cv.width, cv.height);
  TINTS.set(k, cv);
  return cv;
}

// 老电视信号不好：2 px 一行的水平抖动 + 撕裂带 + 垂直滚动 + 色差 + 扫描线 + 雪花（视觉方案 §4.10，第六轮）
// src 画进 (x, y, w, h)；amt 0..1 强度；t 时刻；o.rows 行高；o.fringe [左色, 右色]（默认樱粉 / 青）；o.snow 雪花强度
export function badTV(ctx, src, x, y, w, h, amt, t, { rows = 2, seed = 0, fringe = ['#FF6FA8', '#3FC6E8'], snow = 1, roll = true } = {}) {
  const sw = src.width, sh = src.height, k = Math.floor(t * 30), a = clamp(amt);
  const rollY = roll && a > 0.3 ? ((t * 900 * (a - 0.3)) % h) * (vnoise(t * 2, seed, 7) > 0.6 ? 1 : 0) : 0;
  const tearY = (hash(Math.floor(t * 9), seed, 1) % 1000) / 1000 * h, tearH = 20 + (hash(Math.floor(t * 9), seed, 2) % 70);
  const tearOff = (rnd(Math.floor(t * 9), seed, 3) - 0.5) * 220 * a;
  const off = r => {
    let o = a * (14 * Math.sin(r * 0.045 + t * 13) * vnoise(t * 3, 1, seed) + 46 * (vnoise(r * 0.03, t * 22, seed) - 0.5));
    if (r >= tearY && r < tearY + tearH) o += tearOff;
    if (rnd(r >> 3, k, seed) < 0.02 * a) o += (rnd(r, k, 9) - 0.5) * 160 * a;
    return o;
  };
  const strips = (img, dx0, alpha) => {
    ctx.globalAlpha = alpha;
    for (let r = 0; r < h; r += rows) {
      const rr = (r + rollY) % h, sy = (rr / h) * sh;
      ctx.drawImage(img, 0, sy, sw, Math.max(1, (rows / h) * sh), x + dx0 + off(r), y + r, w, rows);
    }
  };
  ctx.save();
  if (a > 0.02 && fringe) {
    const d = 3 + 9 * a;
    strips(tinted(src, fringe[0]), -d, 0.45 * a + 0.1);
    strips(tinted(src, fringe[1]), d, 0.45 * a + 0.1);
  }
  strips(src, 0, 1);
  ctx.globalAlpha = 1;
  // 扫描线与亮带
  ctx.fillStyle = 'rgba(20,26,58,0.10)';
  for (let r = 0; r < h; r += 3) ctx.fillRect(x, y + r, w, 1);
  const band = ((t * 0.35) % 1) * (h + 200) - 100;
  ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fillRect(x, y + band, w, 60);
  // 雪花
  const n = Math.floor(260 * a * snow);
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = rnd(i, k, 5) < 0.5 ? 'rgba(255,255,255,0.85)' : 'rgba(20,26,58,0.5)';
    ctx.fillRect(x + rnd(i, k, 6) * w, y + rnd(i, k, 7) * h, 1 + (hash(i, k) % 4), 1 + (hash(i, k, 1) % 2));
  }
  ctx.restore();
}

// 横向撕裂：把 src 的水平条带按随机偏移重画。amount 0..1
export function glitchSlices(ctx, src, x, y, w, h, amount, seed, { strip = 16 } = {}) {
  for (let sy = 0; sy < h; sy += strip) {
    const sh = Math.min(strip, h - sy);
    const off = rnd(seed, sy, 1) < amount ? (rnd(seed, sy, 2) - 0.5) * 120 * amount : 0;
    ctx.drawImage(src, 0, (sy / h) * src.height, src.width, (sh / h) * src.height, x + off, y + sy, w, sh);
  }
}
