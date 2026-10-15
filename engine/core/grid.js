// 字符网格：写字、画框、背景、字符场（视觉方案 §4.1）
import { W, H, CW, CH, COLS, ROWS } from './const.js';
import { glyphs } from './glyphs.js';
import { hash, rnd, vnoise } from './rand.js';
import { newCanvas } from './env.js';

// 占用表：被窗口、精灵、歌词盖住的格子，字符场不画（保证轮廓干净）
export class Occ {
  constructor() { this.a = new Uint8Array(COLS * ROWS); }
  rect(c0, r0, c1, r1) {
    c0 = Math.max(0, Math.floor(c0)); r0 = Math.max(0, Math.floor(r0));
    c1 = Math.min(COLS, Math.ceil(c1)); r1 = Math.min(ROWS, Math.ceil(r1));
    for (let r = r0; r < r1; r++) this.a.fill(1, r * COLS + c0, r * COLS + c1);
    return this;
  }
  px(x0, y0, x1, y1) { return this.rect(x0 / CW, y0 / CH, x1 / CW, y1 / CH); }
  has(c, r) { return this.a[c + r * COLS] === 1; }
}

// 在 (col,row) 起写一行字，全角字占 2 格。返回占用的格数
export function putText(ctx, gs, col, row, str, { maxCol = COLS, bg = null, dx = 0, dy = 0 } = {}) {
  let c = col;
  for (const ch of str) {
    const w = gs.cells(ch);
    if (c + w > maxCol) break;
    if (bg) { ctx.fillStyle = bg; ctx.fillRect(c * CW, row * CH, w * CW, CH); }
    if (ch !== ' ') gs.draw(ctx, ch, c * CW + dx, row * CH + dy);
    c += w;
  }
  return c - col;
}

export function textCells(gs, str) {
  let n = 0;
  for (const ch of str) n += gs.cells(ch);
  return n;
}

// 背景色 + 每 4 格一条的极淡网格线
export function background(ctx, pal, { grid = true } = {}) {
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, W, H);
  if (!grid) return;
  ctx.fillStyle = pal.grid;
  for (let c = 4; c < COLS; c += 4) ctx.fillRect(c * CW, 0, 1, H);
  for (let r = 4; r < ROWS; r += 4) ctx.fillRect(0, r * CH, W, 1);
}

// 圆角制表符框。progress < 1 时从左上角沿两条路同时画出：上边→右边，左边→下边
// gaps：Set(c + r*COLS)，这些边框格不画（溢出的字穿过时边框让位）
export function drawBox(ctx, gs, c0, r0, c1, r1, { progress = 1, gaps = null } = {}) {
  const w = c1 - c0, h = r1 - r0, L = w + h - 1;
  const n = Math.min(L, Math.floor(progress * L + 1e-6));
  const put = (c, r, ch) => { if (!gaps || !gaps.has(c + r * COLS)) gs.draw(ctx, ch, c * CW, r * CH); };
  for (let i = 0; i < n; i++) {
    if (i < w) { const c = c0 + i; put(c, r0, c === c0 ? '╭' : c === c1 - 1 ? '╮' : '─'); }
    else { const r = r0 + i - w + 1; put(c1 - 1, r, r === r1 - 1 ? '╯' : '│'); }
    if (i < h) { const r = r0 + i; put(c0, r, r === r0 ? '╭' : r === r1 - 1 ? '╰' : '│'); }
    else { const c = c0 + i - h + 1; put(c, r1 - 1, c === c1 - 1 ? '╯' : '─'); }
  }
}

// ---------------------------------------------------------------- 字符场

export const TIERS = [".,:;'`~_", '0123456789+-*/<>=[]{}()', 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄ'];
const ALL_TIERS = TIERS.join('');
const RESHUF = [0, 0.35, 0.12, 0.25, 0.12]; // 按小节内拍号：强拍 35%、次强拍 25%、弱拍 12%

// density(c, r, t, S) → 0..1；密度决定字符层级和墨色（A 随机变字 + B 节拍重排）
// freeze：给定时刻则字符停止变化（前奏 9.4 定格）；reshuffle：节拍重排的倍率，落点用 1/0.35 ≈ 全换
// tiers：换字符集（疏 / 中 / 密三层），如 L05 只用 0 和 1：['01', '01', '01']
export function charField(ctx, S, { occ = null, density, freeze = null, inkCap = 4, reshuffle = 1, fontKey = 'SC', tiers = TIERS } = {}) {
  const sets = S.pal.ink.map(c => glyphs(fontKey, c).warm(tiers === TIERS ? ALL_TIERS : tiers.join('')));
  const t = freeze ?? S.t;
  const kick = freeze == null && S.sub < 0.25 && reshuffle > 0;
  const ratio = RESHUF[S.beat] * reshuffle;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (occ && occ.a[c + r * COLS]) continue;
      const d = density(c, r, t, S);
      if (d < 0.06) continue;
      const tier = d < 0.34 ? 0 : d < 0.67 ? 1 : 2;
      let lv = Math.min(inkCap, Math.floor(d * 5));
      let k = Math.floor(t * (2 + 10 * d) + rnd(c, r, 11) * 7);
      if (kick && rnd(c, r, S.ni, 3) < ratio) { k = 100000 + S.ni; lv = Math.min(4, lv + 1); }
      const set = tiers[tier];
      sets[lv].draw(ctx, set[hash(c, r, k) % set.length], c * CW, r * CH);
    }
  }
}

// 把任意路径光栅化成格子掩码：draw(c2d, w, h) 在 cols×rows 的小画布上画出形状（1 px = 1 格）
// 返回 Uint8Array(cols*rows)，1 = 形状内。结果按 key 缓存
const MASKS = new Map();
export function rasterCells(key, cols, rows, draw) {
  let m = MASKS.get(key);
  if (m) return m;
  const cv = newCanvas(cols, rows), c = cv.getContext('2d');
  c.fillStyle = '#000';
  draw(c, cols, rows);
  const d = c.getImageData(0, 0, cols, rows).data;
  m = new Uint8Array(cols * rows);
  for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3] > 110 ? 1 : 0;
  MASKS.set(key, m);
  return m;
}

// 心形路径（给 rasterCells 用）：在 w×h 里画一个心
export function heartPath(c, w, h) {
  c.beginPath();
  c.moveTo(w / 2, h * 0.28);
  c.bezierCurveTo(w * 0.5, h * 0.05, w * 0.02, h * 0.02, w * 0.02, h * 0.35);
  c.bezierCurveTo(w * 0.02, h * 0.62, w * 0.35, h * 0.78, w / 2, h * 0.98);
  c.bezierCurveTo(w * 0.65, h * 0.78, w * 0.98, h * 0.62, w * 0.98, h * 0.35);
  c.bezierCurveTo(w * 0.98, h * 0.02, w * 0.5, h * 0.05, w / 2, h * 0.28);
  c.fill();
}

// 默认背景密度：缓慢流动的噪声，覆盖率约 20–30%，只用最淡的两级墨色
export const bgDensity = (amount = 1) => (c, r, t) => {
  const d = vnoise(c * 0.08, r * 0.12, t * 0.25, 5) * 0.75 + vnoise(c * 0.3, r * 0.3, t * 0.6, 9) * 0.25;
  return d > 0.6 ? (d - 0.6) * amount : 0;
};
