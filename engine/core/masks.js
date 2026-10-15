// 视频蒙版（第八轮）：scripts/video_masks.mjs 把舞蹈视频抠成按行游程编码的剪影（build/masks/<编号>.json），这里按时刻取一帧画成画布。
// 视频的动作偏慢：取帧时乘一个速度（speed），ping-pong 往返或循环；尾巴甩出视频画框的地方，画框左右边缘做一段渐隐，切口就看不出来
import { ENV, newCanvas } from './env.js';
import { clamp } from './time.js';

const M = new Map();
export async function loadMasks() {
  for (const id of ['V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V8', 'V9', 'V10']) { // 第十五轮：V9 / V10（间奏二）
    const f = `build/masks/${id}.json`;
    if (await ENV.P.exists(f)) M.set(id, await ENV.P.loadJSON(f));
  }
}
export const hasMask = id => M.has(id);
export const maskInfo = id => M.get(id);

// 时刻 → 帧号。o.speed 倍速；o.t0 从这个时刻起算；o.mode 'loop' | 'pingpong' | 'clamp'；o.from / o.to 只用这一段（帧号，0..1 比例）
export function maskIndex(id, t, { speed = 1, t0 = 0, mode = 'clamp', from = 0, to = 1 } = {}) {
  const m = M.get(id); if (!m) return 0;
  const a = Math.floor(from * (m.n - 1)), b = Math.max(a + 1, Math.floor(to * (m.n - 1))), len = b - a;
  let k = Math.max(0, (t - t0) * speed * m.fps);
  if (mode === 'loop') k %= len + 1;
  else if (mode === 'pingpong') { k %= 2 * len; if (k > len) k = 2 * len - k; }
  else k = Math.min(k, len);
  return a + Math.floor(k);
}

// 第 k 帧的剪影画布（黑色实心、透明底，原视频的一半分辨率）。缓存最近用过的 24 帧，画布循环复用（不每帧新建）
const CACHE = new Map(), SLOTS = [];
let next = 0;
export function maskFrame(id, k, { fade = 0.07 } = {}) {
  const m = M.get(id); if (!m) return null;
  k = clamp(k, 0, m.n - 1) | 0;
  const key = `${id}|${k}|${fade}`;
  let cv = CACHE.get(key);
  if (cv) return cv;
  const slot = next++ % 24;
  if (SLOTS[slot]) CACHE.delete(SLOTS[slot].key);
  if (!SLOTS[slot] || SLOTS[slot].cv.width !== m.w || SLOTS[slot].cv.height !== m.h) SLOTS[slot] = { cv: newCanvas(m.w, m.h) };
  SLOTS[slot].key = key; cv = SLOTS[slot].cv;
  const c = cv.getContext('2d');
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, m.w, m.h);
  c.fillStyle = '#000';
  m.rows[k].forEach((r, y) => { for (let i = 0; i < r.length; i += 2) c.fillRect(r[i], y, r[i + 1], 1); });
  if (fade > 0) { // 左右边缘渐隐（尾巴出画的切口）
    const g = c.createLinearGradient(0, 0, m.w, 0), f = fade;
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(f, 'rgba(0,0,0,1)'); g.addColorStop(1 - f, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.globalCompositeOperation = 'destination-in'; c.fillStyle = g; c.fillRect(0, 0, m.w, m.h); c.globalCompositeOperation = 'source-over';
  }
  CACHE.set(key, cv);
  return cv;
}

// 一帧剪影按格子取样（字符画用）：cols×rows 的 Uint8Array，1 = 在剪影里。缓存最近几帧
const CELLS = new Map(), CELL_ORDER = [];
let cellCv = null;
export function maskCells(id, k, cols, rows) {
  const key = `${id}|${k}|${cols}|${rows}`;
  let a = CELLS.get(key);
  if (a) return a;
  const cv = maskFrame(id, k, { fade: 0 }); if (!cv) return null;
  if (!cellCv || cellCv.width !== cols || cellCv.height !== rows) cellCv = newCanvas(cols, rows);
  const c = cellCv.getContext('2d');
  c.clearRect(0, 0, cols, rows); c.imageSmoothingEnabled = true; c.drawImage(cv, 0, 0, cols, rows);
  const d = c.getImageData(0, 0, cols, rows).data;
  a = new Uint8Array(cols * rows);
  for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3] > 110 ? 1 : 0;
  CELLS.set(key, a); CELL_ORDER.push(key);
  if (CELL_ORDER.length > 12) CELLS.delete(CELL_ORDER.shift());
  return a;
}

// 方便用：在 (cx, footY) 画一帧剪影，高度 h（视频画框的高度，不是人的高度）
export function drawMask(ctx, id, k, cx, footY, h, pose = {}, alpha = 1) {
  const cv = maskFrame(id, k); if (!cv) return false;
  const w = (cv.width / cv.height) * h;
  ctx.save(); ctx.globalAlpha *= alpha;
  ctx.translate(cx + (pose.dx || 0), footY + (pose.dy || 0)); ctx.rotate(pose.rot || 0); ctx.scale(pose.sx ?? 1, pose.sy ?? 1);
  ctx.imageSmoothingEnabled = true; ctx.drawImage(cv, -w / 2, -h, w, h);
  ctx.restore();
  return true;
}
