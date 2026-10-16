// 视频封面（第二十八轮第二版，按 封面修改方案.md 改；第一版"编辑排版拼贴"、第二十七轮晴空版、第二十四轮代码翅膀版都在 归档/快照/ 里）。
// 只画一帧，不进镜头表；render/cover.mjs 调它出 PNG。层次从下到上：
// 1 纸面：细网格按脸框的格子四等分（整张图只有一套网格）
// 2 背景：脸外的虚线大圆、超大描边英文、几扇淡淡的倾斜窗口（片子里的画面、ComfyUI 节点图）和它们之间的淡连线
// 3 插画：往右挪（以前太居中）；横向错位除了几条大的，还有很多细条和几条带颜色的；左上气泡「唱首歌吧」按气泡的倾斜对齐、居中
// 4 中间层：以脸上的方形选框为一格，用行列字母、交点十字、刻度、坐标小字暗示出网格；脸是主框（8 个控制点），
//   fins / tail / bow / emblem / hand / headdress 是浅蓝的次级框（没有控制点）；深色马赛克在几处呼应、从四边往里侵入；ComfyUI 式的节点连线
// 5 最上层：4 组窗口，每组 2–3 扇大小不一、整组按聊天框的角度倾斜（网格不跟着斜）；每组最大的那扇是不同的窗口：
//   记事本（主标题，叠几层"重复打开"的副本、一只鼠标、Q 版的她从窗口上沿探头）、播放器、终端、资源管理器；大窗口后面露出文件夹图标
// 6 颗粒、四角裁切标记
// o.img：主图（render/cover.mjs 读好传进来）
import { W, H, BRAND, OUT_W, OUT_H, FPS, DURATION, filmStart } from '../core/const.js';
// 成片帧数（和 render/render.mjs 出全片时一样算：从成片起点到结尾），千位加逗号
const NFRAMES_FILM = String(Math.round(DURATION * FPS) - Math.round(filmStart() * FPS)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
import { clamp } from '../core/time.js';
import { rnd, hash, vnoise } from '../core/rand.js';
import { fonts, midText } from '../core/glyphs.js';
import { css } from '../core/color.js';
import { drawSprite } from '../core/sprites.js';
import { rrect } from '../core/ui.js';
import { newCanvas } from '../core/env.js';
import { keyword } from '../core/data.js';
import { photo } from '../core/portrait.js';
import { memoryFrame } from '../core/memory.js';

export const COVER_T = 15.6; // 取这一刻的调色板（第一段晴空）
const NAVY = '#1D2541', DEEP = '#2A3F9E', PALE = '#DCE6FF', PAPER = '#F3F6FC', PINK = '#FF6FA8', TEAL = '#34D1BF', LIGHT = '#8FB0FF', GOLD = '#FFCB3D';
const TILT = 0.11; // 插画里左上那个聊天气泡的倾斜（在原图上量的：上下沿都是约 0.11 rad）
// 主图：原图 2048×1152 缩放 IS，原图坐标 (1024, 576) 放在 (IX, IY)
const IS = 1.22, IX = 1212.6, IY = 584.7;
const M = (x, y) => [IX + (x - 1024) * IS, IY + (y - 576) * IS];
const rectM = (x0, y0, x1, y1) => { const [a, b] = M(x0, y0), [c, d] = M(x1, y1); return [a, b, c - a, d - b]; };
// 脸上的方形主框（原图里脸的中心 (1042, 492)），边长 FS；网格一格 G = 半个脸框，原点在脸框左上角
const FC = M(1042, 492), FS = 360, FACE = [FC[0] - FS / 2, FC[1] - FS / 2, FS, FS];
const G = FS / 2, GX0 = FACE[0], GY0 = FACE[1];
const gx = i => GX0 + i * G, gy = j => GY0 + j * G;
const I0 = Math.ceil(-GX0 / G), I1 = Math.floor((W - GX0) / G), J0 = Math.ceil(-GY0 / G), J1 = Math.floor((H - GY0) / G);

// ---------------------------------------------------------------- 图像处理（按参数缓存）
const CACHE = new Map();
const cached = (k, f) => { if (!CACHE.has(k)) CACHE.set(k, f()); return CACHE.get(k); };
const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
function duotone(img, [sx, sy, sw, sh], dw, dh, dark, light, key) {
  return cached(`duo|${key}|${dw}|${dh}`, () => {
    const cv = newCanvas(dw, dh), c = cv.getContext('2d'); c.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);
    const id = c.getImageData(0, 0, dw, dh), d = id.data, A = hexRgb(dark), B = hexRgb(light);
    for (let i = 0; i < d.length; i += 4) {
      const l = clamp((0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255), u = l * l * (3 - 2 * l);
      d[i] = A[0] + (B[0] - A[0]) * u; d[i + 1] = A[1] + (B[1] - A[1]) * u; d[i + 2] = A[2] + (B[2] - A[2]) * u;
    }
    c.putImageData(id, 0, 0); return cv;
  });
}
function halftone(img, [sx, sy, sw, sh], dw, dh, cell, color, key) {
  return cached(`ht|${key}|${dw}|${dh}|${cell}`, () => {
    const nx = Math.ceil(dw / cell), ny = Math.ceil(dh / cell), sm = newCanvas(nx, ny), s = sm.getContext('2d');
    s.drawImage(img, sx, sy, sw, sh, 0, 0, nx, ny);
    const d = s.getImageData(0, 0, nx, ny).data, cv = newCanvas(dw, dh), c = cv.getContext('2d');
    c.fillStyle = color;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const o = (j * nx + i) * 4, a = d[o + 3] / 255, dk = (1 - (0.299 * d[o] + 0.587 * d[o + 1] + 0.114 * d[o + 2]) / 255) * a;
      if (dk < 0.04) continue;
      c.beginPath(); c.arc((i + 0.5) * cell + (j % 2) * cell * 0.5, (j + 0.5) * cell, cell * 0.62 * Math.sqrt(dk), 0, Math.PI * 2); c.fill();
    }
    return cv;
  });
}
function grain(w, h) {
  return cached(`grain|${w}|${h}`, () => {
    const cv = newCanvas(w, h), c = cv.getContext('2d'), id = c.createImageData(w, h), d = id.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = (y * w + x) * 4, v = hash(x, y, 2801) % 255; d[o] = d[o + 1] = d[o + 2] = v; d[o + 3] = 255; }
    c.putImageData(id, 0, 0); return cv;
  });
}
// 主图的横向错位：几条大的 + 很多细条 + 几条带颜色的细条（都在一张原图大小的离屏画布上切，只在有图的地方）
// 脸周围（原图坐标 x0, y0, x1, y1）：脸框在原图里约 894–1190 × 344–640，再往外放一圈
const FACE_ZONE = [760, 220, 1320, 770];
function glitched(img) {
  return cached('glitch3', () => {
    const big = [[262, 22, -40], [668, 12, 52], [786, 28, -28], [150, 9, 70]];
    const fine = Array.from({ length: 13 }, (_, i) => [Math.round(90 + rnd(i, 2901) * 980), 1 + Math.round(rnd(i, 2902) * 4), Math.round((rnd(i, 2903) - 0.5) * 2 * (6 + 26 * rnd(i, 2904)))]);
    const tint = [[214, 3, 18, PINK], [430, 2, -24, TEAL], [592, 3, 14, BRAND], [733, 2, -12, PINK], [905, 4, 22, TEAL], [356, 2, 30, '#7FE0FF'], [128, 2, -16, PINK], [508, 3, 20, '#7FE0FF'], [652, 2, -30, TEAL], [826, 3, 12, PINK], [1010, 2, -18, BRAND]];
    const bands = [...big, ...fine];
    const cv = newCanvas(img.width, img.height), c = cv.getContext('2d');
    c.save(); c.beginPath(); c.rect(0, 0, img.width, img.height); for (const [y0, hh] of bands) c.rect(img.width, y0, -img.width, hh); c.clip('evenodd'); c.drawImage(img, 0, 0); c.restore();
    for (const [y0, hh, dx] of bands) {
      c.save(); c.beginPath(); c.rect(0, y0, img.width, hh); c.clip(); c.drawImage(img, dx, 0);
      c.globalCompositeOperation = 'source-atop'; c.fillStyle = css(BRAND, hh > 8 ? 0.16 : 0.08); c.fillRect(0, y0, img.width, hh); c.restore();
    }
    const [fx0, fy0, fx1, fy1] = FACE_ZONE;
    tint.forEach(([y0, hh, dx, col], k) => { // 带颜色的细条：一小段（不是整行），错开的那份染色（只在有图的地方）；不进脸周围（用户第二十八轮封面四改）
      const len = Math.round(120 + rnd(k, 2912) * 380);
      let x0 = Math.round(300 + rnd(k, 2911) * 1300);
      if (y0 + hh > fy0 && y0 < fy1 && x0 + len > fx0 && x0 < fx1) { const off = 30 + Math.round(rnd(k, 2913) * 160); x0 = x0 + len / 2 < (fx0 + fx1) / 2 ? fx0 - off - len : fx1 + off; }
      const s = newCanvas(len, hh), sc = s.getContext('2d');
      sc.drawImage(img, x0 - dx, y0, len, hh, 0, 0, len, hh);
      sc.globalCompositeOperation = 'source-atop'; sc.fillStyle = css(col, 0.8); sc.fillRect(0, 0, len, hh);
      c.drawImage(s, x0, y0);
    });
    return cv;
  });
}

// ---------------------------------------------------------------- 部件
const cross = (ctx, x, y, s = 6) => { ctx.beginPath(); ctx.moveTo(x - s, y); ctx.lineTo(x + s, y); ctx.moveTo(x, y - s); ctx.lineTo(x, y + s); ctx.stroke(); };
function tinyText(ctx, x, y, lines, { size = 13, lh = 1.45, color = NAVY, font = 'JB', align = 'left' } = {}) {
  ctx.save(); ctx.font = fonts(size, font, 'SC'); ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'top';
  lines.forEach((s, i) => ctx.fillText(s, x, y + i * size * lh));
  ctx.restore();
}
function labelBox(ctx, x, y, text, { size = 26, ink = NAVY } = {}) {
  ctx.save(); ctx.font = fonts(size, 'MIN0', 'SC'); const w = ctx.measureText(text).width + 26, h = size + 16;
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x, y, w, h); ctx.strokeStyle = ink; ctx.lineWidth = 1.5; ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = ink; midText(ctx, text, x + 13, y + h / 2);
  ctx.restore();
}
// 主框：细框 + 8 个方形控制点
function selection(ctx, x, y, w, h, { color = NAVY, lw = 1.5, hs = 11 } = {}) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.strokeRect(x, y, w, h);
  for (const [u, v] of [[0, 0], [0.5, 0], [1, 0], [0, 0.5], [1, 0.5], [0, 1], [0.5, 1], [1, 1]]) {
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x + u * w - hs / 2, y + v * h - hs / 2, hs, hs); ctx.strokeRect(x + u * w - hs / 2, y + v * h - hs / 2, hs, hs);
  }
  ctx.restore();
}
// 次级框（识别到的 tag）：浅蓝细框、只有四个角稍重一点、左上一个小标签，没有控制点
function tagBox(ctx, [x, y, w, h], tag, score) {
  ctx.save(); ctx.strokeStyle = css(LIGHT, 0.9); ctx.lineWidth = 1.2; ctx.setLineDash([5, 4]); ctx.strokeRect(x, y, w, h); ctx.setLineDash([]);
  ctx.lineWidth = 2.2; const L = 10; ctx.beginPath();
  for (const [px, py, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) { ctx.moveTo(px, py + sy * L); ctx.lineTo(px, py); ctx.lineTo(px + sx * L, py); }
  ctx.stroke();
  ctx.font = fonts(12, 'JB'); const t = `${tag} ${score}`, tw = ctx.measureText(t).width + 10;
  ctx.fillStyle = css(LIGHT, 0.9); ctx.fillRect(x, y - 17, tw, 17); ctx.fillStyle = '#FFFFFF'; midText(ctx, t, x + 5, y - 8.5);
  ctx.restore();
}
// 深色马赛克：按网格的 1/12 对齐的小方块。edge：从哪条边往里侵入（越往里越稀）
const MC = G / 12;
function mosaic(ctx, x0, y0, cols, rows, seed, { p = 0.55, edge = null, depth = 1 } = {}) {
  const sx = GX0 + Math.round((x0 - GX0) / MC) * MC, sy = GY0 + Math.round((y0 - GY0) / MC) * MC;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    let q = p;
    if (edge === 'l') q *= (1 - i / cols) ** depth; if (edge === 'r') q *= (i / cols) ** depth;
    if (edge === 't') q *= (1 - j / rows) ** depth; if (edge === 'b') q *= (j / rows) ** depth;
    const h = rnd(i, j, seed); if (h > q) continue;
    ctx.fillStyle = rnd(i, j, seed + 1) < 0.18 ? DEEP : NAVY; ctx.globalAlpha = 0.86 + 0.14 * rnd(i, j, seed + 2);
    ctx.fillRect(sx + i * MC, sy + j * MC, MC, MC);
  }
  ctx.globalAlpha = 1;
}
// ComfyUI 式连线：两端水平切线的三次贝塞尔，深色描边 + 颜色芯，两端端口圆点
function wire(ctx, x0, y0, x1, y1, color, { alpha = 1, lw = 2.2, dir0 = null, dir1 = null, dx = null } = {}) {
  const sgn = x1 >= x0 ? 1 : -1, d0 = dir0 ?? sgn, d1 = dir1 ?? sgn, h = dx ?? Math.max(60, Math.abs(x1 - x0) * 0.5), [h0, h1] = Array.isArray(h) ? h : [h, h];
  const path = () => { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.bezierCurveTo(x0 + d0 * h0, y0, x1 - d1 * h1, y1, x1, y1); };
  ctx.save(); ctx.globalAlpha = alpha; ctx.lineCap = 'round';
  path(); ctx.strokeStyle = css(NAVY, 0.3); ctx.lineWidth = lw + 2.4; ctx.stroke();
  path(); ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.stroke();
  for (const [x, y] of [[x0, y0], [x1, y1]]) { ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(x, y, lw + 3, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, lw + 1, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}
// 窗口外框：标题栏（文件名 + 三个钮），可选菜单栏、状态栏、深色正文。返回正文区域
function chrome(ctx, x, y, w, h, title, { dark = false, menu = null, status = null, tb = NAVY, ghost = false } = {}) {
  ctx.save();
  if (!ghost) { ctx.fillStyle = css(NAVY, 0.16); ctx.fillRect(x + 8, y + 10, w, h); }
  ctx.fillStyle = dark ? '#151B33' : '#FFFFFF'; ctx.fillRect(x, y, w, h); ctx.strokeStyle = NAVY; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = tb; ctx.fillRect(x, y, w, 28);
  ctx.font = fonts(15, 'JB', 'SC'); ctx.fillStyle = '#FFFFFF'; midText(ctx, title, x + 12, y + 14);
  ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) ctx.strokeRect(x + w - 26 - i * 24, y + 7, 15, 15);
  ctx.beginPath(); ctx.moveTo(x + w - 23, y + 10); ctx.lineTo(x + w - 14, y + 19); ctx.moveTo(x + w - 14, y + 10); ctx.lineTo(x + w - 23, y + 19); ctx.stroke();
  let top = y + 28, bot = y + h;
  if (menu) {
    ctx.font = fonts(14, 'SC'); ctx.fillStyle = css(NAVY, 0.8); let mx = x + 12;
    for (const m of menu) { midText(ctx, m, mx, top + 12); mx += ctx.measureText(m).width + 18; }
    ctx.fillStyle = css(NAVY, 0.25); ctx.fillRect(x, top + 24, w, 1); top += 25;
  }
  if (status) {
    ctx.fillStyle = css(NAVY, 0.06); ctx.fillRect(x + 1, bot - 23, w - 2, 22); ctx.fillStyle = css(NAVY, 0.25); ctx.fillRect(x, bot - 24, w, 1);
    ctx.font = fonts(12, 'JB', 'SC'); ctx.fillStyle = css(NAVY, 0.75); midText(ctx, status, x + 12, bot - 12); bot -= 24;
  }
  ctx.restore();
  return [x + 2, top + 1, w - 4, bot - top - 2];
}
function inRect(ctx, [x, y, w, h], f) { ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); f(x, y, w, h); ctx.restore(); }
function folder(ctx, x, y, s, label) {
  ctx.save(); ctx.lineJoin = 'round';
  ctx.fillStyle = '#B9CCFF'; ctx.beginPath(); ctx.moveTo(x, y + s * 0.12); ctx.lineTo(x + s * 0.38, y + s * 0.12); ctx.lineTo(x + s * 0.46, y + s * 0.24); ctx.lineTo(x + s, y + s * 0.24); ctx.lineTo(x + s, y + s * 0.8); ctx.lineTo(x, y + s * 0.8); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = NAVY; ctx.lineWidth = 1.6; ctx.stroke();
  ctx.fillStyle = PALE; ctx.beginPath(); ctx.moveTo(x, y + s * 0.34); ctx.lineTo(x + s, y + s * 0.34); ctx.lineTo(x + s, y + s * 0.8); ctx.lineTo(x, y + s * 0.8); ctx.closePath(); ctx.fill(); ctx.stroke();
  if (label) { ctx.font = fonts(12, 'SC'); ctx.fillStyle = NAVY; ctx.textAlign = 'center'; ctx.fillText(label, x + s / 2, y + s * 0.8 + 15); }
  ctx.restore();
}
function cursorArrow(ctx, x, y, k = 1.7) {
  const P = [[0, 0], [0, 17], [4, 13], [7, 20], [10, 19], [7, 12], [12, 12]];
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k); ctx.beginPath(); P.forEach(([a, b], i) => (i ? ctx.lineTo(a, b) : ctx.moveTo(a, b))); ctx.closePath();
  ctx.fillStyle = css(NAVY, 0.25); ctx.save(); ctx.translate(1.2, 1.4); ctx.fill(); ctx.restore();
  ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.strokeStyle = '#000000'; ctx.lineWidth = 1.1; ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore();
}
// 整组倾斜：绕 (cx, cy) 转 TILT
function tilted(ctx, cx, cy, f, ang = TILT) { ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang); ctx.translate(-cx, -cy); f(); ctx.restore(); }

// 四边的马赛克侵蚀：沿一条边的一段，从画布外一格画起（出血），深度沿边起伏，越往里越稀，再撒几颗散的
function erosion(ctx, side, a, b, maxD, seed, loose = 5) { // loose：散出去的方块最远多少格
  const vert = side === 'l' || side === 'r', o0 = vert ? GY0 : GX0;
  const k0 = Math.floor((a - o0) / MC), k1 = Math.ceil((b - o0) / MC);
  const edge0 = side === 'l' ? GX0 - Math.ceil(GX0 / MC) * MC : side === 't' ? GY0 - Math.ceil(GY0 / MC) * MC : side === 'r' ? GX0 + Math.floor((W - GX0) / MC) * MC : GY0 + Math.floor((H - GY0) / MC) * MC;
  for (let k = k0; k <= k1; k++) {
    const u = (k - k0) / Math.max(1, k1 - k0), env = Math.sin(Math.PI * clamp(u)) ** 0.5, d = Math.max(1, maxD * env * (0.45 + 0.55 * vnoise(k * 0.21, seed * 0.01, 0, seed)));
    for (let q = -1; q < d + loose; q++) {
      const pr = q < d * 0.55 ? 0.97 : q < d ? 0.75 - 0.4 * ((q - d * 0.55) / (d * 0.45)) : 0.12 * (1 - (q - d) / loose);
      if (rnd(k, q + 3, seed) > pr) continue;
      const along = o0 + k * MC, inward = side === 'l' || side === 't' ? edge0 + q * MC : edge0 - q * MC;
      const r = rnd(k, q, seed + 7);
      ctx.fillStyle = r < 0.12 ? DEEP : r < 0.17 ? BRAND : NAVY; ctx.globalAlpha = 0.88 + 0.12 * rnd(k, q, seed + 9);
      if (vert) ctx.fillRect(inward, along, MC, MC); else ctx.fillRect(along, inward, MC, MC);
    }
  }
  ctx.globalAlpha = 1;
}
// 最外沿的小缺口：沿整条边一格一格走，噪声决定这里啃 0（空着）或 1–3 格，从画布外一格画起
function nibble(ctx, side, seed) {
  const vert = side === 'l' || side === 'r', o0 = vert ? GY0 : GX0, len = vert ? H : W;
  const edge0 = side === 'l' ? GX0 - Math.ceil(GX0 / MC) * MC : side === 't' ? GY0 - Math.ceil(GY0 / MC) * MC : side === 'r' ? GX0 + Math.floor((W - GX0) / MC) * MC : GY0 + Math.floor((H - GY0) / MC) * MC;
  for (let k = Math.floor(-o0 / MC) - 1; k <= Math.ceil((len - o0) / MC); k++) {
    const n = vnoise(k * 0.3, seed * 0.01, 0, seed) * 0.75 + rnd(k, seed) * 0.25;
    if (n < 0.42) continue;
    const d = 1 + Math.min(side === 'l' ? 1 : 2, Math.floor((n - 0.42) / 0.58 * 3.4)); // 左边最多 2 格，不碰左栏的字
    for (let q = -1; q <= d; q++) {
      if (q === d && rnd(k, q, seed + 3) > 0.45) continue; // 最里面那格时有时无，边才不齐
      const along = o0 + k * MC, inward = side === 'l' || side === 't' ? edge0 + q * MC : edge0 - q * MC;
      const r = rnd(k, q, seed + 7);
      ctx.fillStyle = r < 0.12 ? DEEP : r < 0.17 ? BRAND : NAVY; ctx.globalAlpha = 0.88 + 0.12 * rnd(k, q, seed + 9);
      if (vert) ctx.fillRect(inward, along, MC, MC); else ctx.fillRect(along, inward, MC, MC);
    }
  }
  ctx.globalAlpha = 1;
}
// 瑞士风的文字组：左上角钉在网格交点上（一道短粗线 + 一行小标题 + 几行小字）
function textGroup(ctx, x, y, head, lines, { chip = false } = {}) {
  const lh = 17, w = 132;
  if (chip) { ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(x - 4, y - 4, w + 8, 22 + lines.length * lh + 6); }
  ctx.fillStyle = NAVY; ctx.fillRect(x, y, 26, 3);
  tinyText(ctx, x, y + 8, [head], { size: 12, color: NAVY, font: 'JB' });
  tinyText(ctx, x, y + 8 + lh + 2, lines, { size: 12, lh: lh / 12, color: css(NAVY, 0.72), font: 'JB' });
}
// 网格交点上的坐标小签（白底，左上角钉在交点上）
function coordChip(ctx, x, y, text) {
  ctx.save(); ctx.font = fonts(11, 'JB', 'SC'); const w = ctx.measureText(text).width + 10;
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(x + 3, y + 3, w, 16); ctx.fillStyle = css(NAVY, 0.75); midText(ctx, text, x + 8, y + 11); ctx.restore();
}

// ---------------------------------------------------------------- 主标题：点阵字 + 图形
const CELLS = new Map();
function cells(ch, N) {
  const k = `${ch}|${N}`;
  if (CELLS.has(k)) return CELLS.get(k);
  const cv = newCanvas(N, N), c = cv.getContext('2d');
  c.font = fonts(Math.round(N * 0.92), 'SMILEY', 'SCB'); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#000'; c.fillText(ch, N / 2, N / 2 + 1);
  const d = c.getImageData(0, 0, N, N).data, L = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (d[(j * N + i) * 4 + 3] > 110) L.push([i, j]);
  CELLS.set(k, L); return L;
}
// 记事本里的「电子天使」：后两个字被"选中"（品牌蓝高亮、点变白），一条心电线（150 BPM）从字中间穿过，
// 「天」上光环、「使」右边点阵小翅膀、文字光标停在最后；鼠标在选区末尾（刚拖完选区）
function titleGraphic(ctx, x, y, px) {
  const N = 21, pitch = px / N, r = pitch * 0.44, chars = [...'电子天使'];
  ctx.save(); ctx.font = fonts(Math.round(px * 0.92), 'SMILEY', 'SCB');
  const adv = chars.map(ch => ctx.measureText(ch).width * 0.98);
  let xx = x; const C = chars.map((ch, k) => { const c = { ch, k, cx: xx + adv[k] / 2, a: adv[k] }; xx += adv[k]; return c; });
  const x2 = C[2].cx - C[2].a / 2 - 6, x3 = C[3].cx + C[3].a / 2 + 6;
  ctx.fillStyle = BRAND; ctx.fillRect(x2, y - px * 0.54, x3 - x2, px * 1.04); // 选区
  // 心电线：平 → 每个字缝里一次 QRS
  ctx.strokeStyle = PINK; ctx.lineWidth = 3.5; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(x - 30, y + 4);
  for (let k = 0; k <= 4; k++) { const gxp = k < 4 ? C[k].cx - C[k].a / 2 : xx; ctx.lineTo(gxp - 14, y + 4); ctx.lineTo(gxp - 8, y - 10); ctx.lineTo(gxp - 2, y + 30); ctx.lineTo(gxp + 6, y - px * 0.42); ctx.lineTo(gxp + 13, y + 16); ctx.lineTo(gxp + 20, y + 4); }
  ctx.lineTo(xx + 70, y + 4); ctx.stroke();
  for (const c of C) for (const [i, j] of cells(c.ch, N)) { // 不加投影；每个点一个随机不透明度
    const sel = c.k >= 2, h = rnd(i, j, c.k * 5 + 2810), a = 0.45 + 0.55 * rnd(i, j, c.k * 5 + 2811);
    ctx.fillStyle = sel ? css('#FFFFFF', 0.55 + 0.45 * a) : h < 0.035 ? css(PINK, a) : css(NAVY, a);
    ctx.beginPath(); ctx.arc(c.cx + (i - N / 2 + 0.5) * pitch, y + (j - N / 2 + 0.5) * pitch, r, 0, Math.PI * 2); ctx.fill();
  }
  // 小翅膀（点）
  const wx = C[3].cx + C[3].a * 0.46, wy = y - px * 0.18;
  for (let f = 0; f < 4; f++) { const an = -1.0 + f * 0.3, len = px * (0.5 - Math.abs(f - 1.5) * 0.06); for (let s = 0; s < 7; s++) { const q = s / 6; ctx.fillStyle = s % 2 ? css('#FFFFFF', 0.95) : '#BFD3FF'; ctx.beginPath(); ctx.arc(wx + Math.cos(an) * len * q, wy + Math.sin(an) * len * q - px * 0.06 * q * q, r * (1.15 - 0.55 * q), 0, Math.PI * 2); ctx.fill(); } }
  // 文字光标
  ctx.fillStyle = NAVY; ctx.fillRect(x3 + 10, y - px * 0.52, 5, px * 1.04);
  ctx.restore();
  return { x2, x3, xx, hx: C[2].cx, hy: y - px * 0.6 };
}

// ---------------------------------------------------------------- 封面
export function cover(ctx, S, o = {}) {
  const img = o.img, p = S.pal, kw = keyword('L01', 5, 6)[0].c;
  // 片子里的画面先取好（memoryFrame 要在画别的之前调用）
  const MEM = [[75.6, 'preview · 01:15'], [33.9, 'preview · 00:33'], [128.5, 'preview · 02:08']].map(([t, name]) => ({ cv: memoryFrame(t, 480), name }));
  // 1. 纸：素白 + 细网格（按脸框的格子四等分）
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = css(DEEP, 0.045);
  for (let x = GX0 - Math.ceil(GX0 / (G / 4)) * (G / 4); x <= W; x += G / 4) ctx.fillRect(Math.round(x), 0, 1, H);
  for (let y = GY0 - Math.ceil(GY0 / (G / 4)) * (G / 4); y <= H; y += G / 4) ctx.fillRect(0, Math.round(y), W, 1);
  // 2. 背景：大圆、描边英文、淡窗口、淡连线
  ctx.save(); ctx.strokeStyle = css(NAVY, 0.3); ctx.lineWidth = 1.5; ctx.setLineDash([3, 9]); ctx.beginPath(); ctx.arc(FC[0], FC[1], 560, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
  ctx.save(); ctx.font = fonts(300, 'SMILEY', 'SCB'); ctx.lineWidth = 2; ctx.strokeStyle = css(DEEP, 0.14); ctx.strokeText('ELECTRONIC', -60, 300); ctx.strokeText('ANGEL', 820, 1030); ctx.restore();
  const bgWin = (x, y, w, h, title, draw) => tilted(ctx, x + w / 2, y + h / 2, () => { ctx.save(); ctx.globalAlpha = 0.42; const R = chrome(ctx, x, y, w, h, title, { tb: DEEP, ghost: true }); inRect(ctx, R, draw); ctx.restore(); });
  bgWin(1290, -60, 300, 200, 'workflow.json', (x, y, w, h) => { // ComfyUI 节点图
    ctx.fillStyle = '#E9EEF8'; ctx.fillRect(x, y, w, h);
    const nodes = [[x + 16, y + 36, 90, 60, '#7FA3E8'], [x + 130, y + 18, 100, 80, '#B39DDB'], [x + 160, y + 112, 110, 56, '#7FC8A9']];
    for (const [nx, ny, nw, nh, c] of nodes) { ctx.fillStyle = '#FFFFFF'; ctx.fillRect(nx, ny, nw, nh); ctx.fillStyle = c; ctx.fillRect(nx, ny, nw, 12); ctx.strokeStyle = css(NAVY, 0.4); ctx.lineWidth = 1; ctx.strokeRect(nx, ny, nw, nh); }
    ctx.strokeStyle = BRAND; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 106, y + 70); ctx.bezierCurveTo(x + 120, y + 70, x + 116, y + 60, x + 130, y + 60); ctx.moveTo(x + 230, y + 70); ctx.bezierCurveTo(x + 260, y + 70, x + 130, y + 140, x + 160, y + 140); ctx.stroke();
  });
  bgWin(-110, 958, 300, 200, MEM[0].name, (x, y, w, h) => MEM[0].cv && ctx.drawImage(MEM[0].cv, x, y, w, h));
  bgWin(1690, 350, 300, 190, MEM[1].name, (x, y, w, h) => MEM[1].cv && ctx.drawImage(MEM[1].cv, x, y, w, h));
  bgWin(540, -70, 280, 170, MEM[2].name, (x, y, w, h) => MEM[2].cv && ctx.drawImage(MEM[2].cv, x, y, w, h));
  wire(ctx, 270, 930, 60, 1070, css(BRAND, 0.9), { alpha: 0.35, lw: 1.6 });
  wire(ctx, 1590, 60, 1720, 420, css(PINK, 0.9), { alpha: 0.3, lw: 1.6 });
  wire(ctx, 820, 40, 1290, 10, css(TEAL, 0.9), { alpha: 0.3, lw: 1.6 });
  // 3. 主图（错位过的）+ 左上气泡里的字
  if (img) {
    ctx.save(); ctx.translate(IX, IY); ctx.scale(IS, IS); ctx.translate(-1024, -576); ctx.drawImage(glitched(img), 0, 0);
    // 「唱首歌吧」：气泡中心 (531, 304)、倾斜 0.11（原图上量的），字 + 小心整体居中
    ctx.save(); ctx.translate(531, 304); ctx.rotate(0.11); ctx.font = fonts(48, 'ZENB', 'SCB');
    const tw = ctx.measureText('唱首歌吧').width, sw = 42, gap = 10, x0 = -(tw + gap + sw) / 2;
    ctx.fillStyle = DEEP; midText(ctx, '唱首歌吧', x0, 0); drawSprite(ctx, 'heart', 4, p, x0 + tw + gap + sw / 2, 0, 1);
    ctx.restore();
    ctx.restore();
  }
  // 4. 中间层
  // 4a 四边的深色马赛克侵蚀（约四成的边长；从画布外画起，出血）+ 几处呼应
  for (const [side, a, b, d, seed, loose] of [['l', 300, 1000, 1.8, 3101, 0], ['l', 60, 300, 4.5, 3102], // 左边一长条只浅浅地啃一层（不压左栏的字）
    ['t', 1180, 1380, 4, 3109], ['r', 700, 860, 4, 3110], ['t', 500, 1000, 5, 3103], ['t', 1500, 1940, 4.5, 3104],
    ['r', 280, 640, 6.5, 3105], ['r', 860, 1100, 5, 3106], ['b', -20, 300, 5, 3107], ['b', 740, 1240, 6, 3108]]) erosion(ctx, side, a, b, d, seed, loose);
  for (const [side, seed] of [['t', 3121], ['r', 3122], ['b', 3123], ['l', 3124]]) nibble(ctx, side, seed); // 最外沿：整圈断断续续 1–3 格
  mosaic(ctx, 1590, 590, 6, 4, 3001, { p: 0.62 });
  mosaic(ctx, 1450, 300, 3, 2, 3031, { p: 0.8 });
  mosaic(ctx, 335, 452, 5, 3, 3011, { p: 0.55 });
  // 4b 网格：列号、行号、四边刻度、交点十字
  ctx.save();
  ctx.font = fonts(12, 'JB'); ctx.fillStyle = css(NAVY, 0.6); ctx.textAlign = 'center';
  for (let i = I0 - 1; i <= I1; i++) { const cx = gx(i) + G / 2; if (cx > 20 && cx < W - 20) ctx.fillText(String.fromCharCode(65 + i - I0 + 1), cx, 22); }
  ctx.textAlign = 'left';
  for (let j = J0 - 1; j <= J1; j++) { const cy = gy(j) + G / 2; if (cy > 40 && cy < H - 30) ctx.fillText(String(j - J0 + 2).padStart(2, '0'), 8, cy + 4); }
  ctx.fillStyle = css(NAVY, 0.55);
  for (let i = I0; i <= I1; i++) { ctx.fillRect(Math.round(gx(i)), 0, 1, 12); ctx.fillRect(Math.round(gx(i)), H - 12, 1, 12); for (let k = 1; k < 6; k++) ctx.fillRect(Math.round(gx(i) + (k * G) / 6), 0, 1, 5); }
  for (let j = J0; j <= J1; j++) { ctx.fillRect(0, Math.round(gy(j)), 12, 1); ctx.fillRect(W - 12, Math.round(gy(j)), 12, 1); for (let k = 1; k < 6; k++) ctx.fillRect(0, Math.round(gy(j) + (k * G) / 6), 5, 1); }
  ctx.lineWidth = 1;
  for (let i = I0; i <= I1; i++) for (let j = J0; j <= J1; j++) {
    const x = gx(i), y = gy(j), dfx = Math.hypot(x - FC[0], y - FC[1]) / 900, keep = hash(i + 20, j + 20, 2950) % 100 < 100 * clamp(1 - dfx * 0.6);
    if (!keep) continue; ctx.strokeStyle = css(NAVY, 0.3 + 0.45 * clamp(1 - dfx)); cross(ctx, x, y, 6);
  }
  ctx.restore();
  // 脸框四条边延长成贯穿画面的细线
  ctx.save(); ctx.strokeStyle = css(NAVY, 0.4); ctx.lineWidth = 1; ctx.beginPath();
  for (const y of [FACE[1], FACE[1] + FS]) { ctx.moveTo(0, y); ctx.lineTo(W, y); } for (const x of [FACE[0], FACE[0] + FS]) { ctx.moveTo(x, 0); ctx.lineTo(x, H); } ctx.stroke(); ctx.restore();
  // 4c 瑞士风的文字组：每组的上沿 / 左沿都钉在网格线上，用文字把看不见的网格撑出来
  const coord = (i, j) => `${String.fromCharCode(65 + i - I0 + 1)}${String(j - J0 + 2).padStart(2, '0')} · ${Math.round(gx(i))},${Math.round(gy(j))}`;
  // 左栏（左边距 x = 40）：03:11 的顶对齐脸框上沿那条线；下面每组的顶依次对齐一条横线
  { ctx.save(); ctx.font = fonts(58, 'JB'); const asc = ctx.measureText('03:11').actualBoundingBoxAscent; ctx.fillStyle = NAVY; ctx.textBaseline = 'alphabetic'; ctx.fillText('03:11', 40, gy(0) + asc); ctx.restore();
    tinyText(ctx, 42, gy(0) + asc + 12, ['THE WHOLE FILM', 'IS DRAWN BY CODE', '— frame = f(t)'], { size: 12 }); }
  textGroup(ctx, 40, gy(1), 'NEXT TOKEN', [`${kw}   0.92`, '饭   0.03', '鲸   0.02', '不   0.01']);
  textGroup(ctx, 40, gy(2), 'SPEC', [`${OUT_W} × ${OUT_H}`, `60 fps · ${NFRAMES_FILM} f`, '150 BPM · 4/4', 'cut −1 frame']);
  textGroup(ctx, 40, gy(3), 'TAGS · 9', ['face 0.99', 'tail 0.97', 'headdress 0.95', 'fin 0.93 / 0.91']);
  // 右栏（左沿对齐 x = gx(3)）
  // 交点上的坐标小签
  for (const [i, j] of [[-3, 1], [0, 2], [2, -1], [-1, 3], [-2, 0], [-4, -1], [3, 0], [-1, -1], [3, 2]]) coordChip(ctx, gx(i), gy(j), coord(i, j));
  // 竖线上的标注（左沿对齐竖线）
  coordChip(ctx, gx(0), gy(3) + 30, 'SCALE 1.22 · TILT 6.3°');
  coordChip(ctx, gx(-2), gy(-1) + 30, 'GRID 180 = ½ FACE');
  // 4d 次级框（tag）和主框
  if (img) {
    tagBox(ctx, rectM(668, 352, 845, 438), 'fin', '0.93');
    tagBox(ctx, rectM(1274, 520, 1418, 634), 'fin', '0.91');
    tagBox(ctx, rectM(782, 272, 868, 352), 'bow', '0.88');
    tagBox(ctx, rectM(1270, 432, 1368, 510), 'bow', '0.86');
    tagBox(ctx, rectM(462, 372, 730, 626), 'tail', '0.97');
    tagBox(ctx, rectM(958, 684, 1016, 756), 'emblem', '0.91');
    tagBox(ctx, rectM(954, 782, 1098, 886), 'hand', '0.84');
    tagBox(ctx, rectM(856, 126, 1172, 238), 'headdress', '0.95');
    selection(ctx, ...FACE);
    labelBox(ctx, FACE[0], FACE[1] - 46, 'face · 0.99');
  }
  // 像素方块（品牌蓝）
  ctx.fillStyle = BRAND; for (const [x, y] of [[gx(1) + MC, gy(-1) + MC], [gx(1) + 2 * MC, gy(-1) + 2 * MC], [gx(-4) + MC * 3, gy(3) + MC], [gx(3) - MC, gy(4) - 2 * MC]]) ctx.fillRect(x, y, MC, MC);
  // 4e 前景连线（ComfyUI 式；两端高度都错开，都是弧线）
  const P = (cx, cy, x, y) => { const c = Math.cos(TILT), s = Math.sin(TILT); return [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c]; }; // 组里的点 → 画面
  { const [x, y] = P(570, 760, 920, 660); wire(ctx, x, y, FACE[0], FC[1] + 70, BRAND); }                                               // 记事本 → 脸
  { const [x, y] = P(1770, 170, 1580, 110); wire(ctx, x, y, FACE[0] + FS, FACE[1] + FS * 0.25, PINK); }                                  // 播放器 → 脸框
  { const R = rectM(1274, 520, 1418, 634), [x, y] = P(1770, 170, 1660, 380); wire(ctx, x, y, R[0] + R[2], R[1] + 10, '#B39DDB'); }    // 属性 → 右边的 fin
  { const R = rectM(958, 684, 1016, 756), [x, y] = P(1690, 820, 1500, 840); wire(ctx, x, y, R[0] + R[2], R[1] + R[3] / 2, TEAL); }    // 终端 → emblem
  { const R = rectM(954, 782, 1098, 886), [x, y] = P(1690, 820, 1430, 960); wire(ctx, x, y, R[0] + R[2], R[1] + R[3] * 0.4, LIGHT); } // tail.png → hand

  // 5. 最上层：窗口组（整组倾斜）
  // B 左上（2 扇，叠得多一点）：资源管理器 + readme
  tilted(ctx, 190, 170, () => {
    folder(ctx, 306, 22, 60, 'shots'); folder(ctx, 8, 236, 52, 'assets');
    const R = chrome(ctx, 30, 40, 310, 206, 'C:\\electric-angel-mv\\assets', { status: '6 个项目 · 129 MB' });
    inRect(ctx, R, (x, y, w, h) => {
      ctx.fillStyle = css(NAVY, 0.05); ctx.fillRect(x, y, w, 26); ctx.font = fonts(12, 'JB', 'SC'); ctx.fillStyle = css(NAVY, 0.7); midText(ctx, '‹ › ↑  assets / illust', x + 10, y + 13);
      const items = [['illust', 1], ['fonts', 1], ['audio', 1], ['封面.png', 0], ['I01.png', 0], ['V8.mp4', 0]];
      items.forEach(([n, isDir], k) => { const ix = x + 16 + (k % 3) * 102, iy = y + 36 + Math.floor(k / 3) * 70; if (isDir) folder(ctx, ix + 16, iy, 44, null); else { ctx.fillStyle = '#FFFFFF'; ctx.fillRect(ix + 22, iy + 2, 32, 38); ctx.strokeStyle = NAVY; ctx.lineWidth = 1.4; ctx.strokeRect(ix + 22, iy + 2, 32, 38); ctx.fillStyle = k === 3 ? PINK : BRAND; ctx.fillRect(ix + 27, iy + 22, 22, 12); } ctx.font = fonts(12, 'SC'); ctx.fillStyle = NAVY; ctx.textAlign = 'center'; ctx.fillText(n, ix + 38, iy + 56); ctx.textAlign = 'left'; });
    });
    const R2 = chrome(ctx, 160, 166, 190, 120, 'readme.txt');
    inRect(ctx, R2, (x, y) => tinyText(ctx, x + 10, y + 8, ['frame = f(t)', `${OUT_W} × ${OUT_H} · 60 fps`, '191.69 s · 150 BPM', `next token: ${kw} 0.92`], { size: 12 }));
  });
  // C 右上（3 扇，往右挪、出画一点，不挡脸）：播放器 + fin.png + 属性
  if (img) tilted(ctx, 1770, 170, () => {
    folder(ctx, 1500, 6, 58, 'frames');
    const R = chrome(ctx, 1580, 30, 420, 268, 'eye.mp4 — 播放器');
    const bar = 40, V = [R[0], R[1], R[2], R[3] - bar];
    inRect(ctx, V, (x, y, w, h) => ctx.drawImage(duotone(img, [872, 412, 320, 150], 416, 196, NAVY, '#FFFFFF', 'eye'), x, y, w, h));
    const by = R[1] + R[3] - bar; ctx.fillStyle = '#FFFFFF'; ctx.fillRect(R[0], by, R[2], bar); ctx.fillStyle = css(NAVY, 0.25); ctx.fillRect(R[0], by, R[2], 1);
    ctx.fillStyle = NAVY; ctx.beginPath(); ctx.moveTo(R[0] + 14, by + 12); ctx.lineTo(R[0] + 28, by + 20); ctx.lineTo(R[0] + 14, by + 28); ctx.closePath(); ctx.fill();
    ctx.fillStyle = css(BRAND, 0.2); ctx.fillRect(R[0] + 42, by + 18, 200, 5); ctx.fillStyle = BRAND; ctx.fillRect(R[0] + 42, by + 18, 200 * (150 / 191), 5); ctx.beginPath(); ctx.arc(R[0] + 42 + 200 * (150 / 191), by + 20.5, 6, 0, Math.PI * 2); ctx.fill();
    ctx.font = fonts(12, 'JB'); ctx.fillStyle = NAVY; midText(ctx, '02:30 / 03:11', R[0] + 252, by + 20);
    const R2 = chrome(ctx, 1500, 200, 190, 158, 'fin.png');
    inRect(ctx, R2, (x, y, w, h) => { ctx.fillStyle = PALE; ctx.fillRect(x, y, w, h); ctx.drawImage(img, 1268, 512, 160, 128, x, y, w, h); });
    const R3 = chrome(ctx, 1660, 262, 210, 128, 'eye.mp4 属性');
    inRect(ctx, R3, (x, y) => tinyText(ctx, x + 10, y + 8, ['类型   MP4 视频', '时长   00:03:11', '帧率   60 fps', '大小   1.2 GB'], { size: 12, font: 'SC' }));
  });
  // D 右下（4 扇）：终端 + tail.png + 渲染进度 + CPU
  if (img) tilted(ctx, 1690, 820, () => {
    folder(ctx, 1436, 656, 54, 'out');
    const R = chrome(ctx, 1500, 700, 380, 230, 'PowerShell — render', { dark: true, tb: '#0F1428' });
    inRect(ctx, R, (x, y) => {
      const L = [['PS> ', 'node render/render.mjs', TEAL], ['', `出片 0.600–191.69 s，${NFRAMES_FILM} 帧`, '#C9D4F5'], ['', '  3 个进程 · 7.1 帧/秒', '#C9D4F5'], ['', '  [████████████░░░] 82%', BRAND], ['', '完成：out/电子天使.mp4', '#C9D4F5'], ['PS> ', '_', TEAL]];
      L.forEach(([a, b, c], k) => { ctx.font = fonts(13, 'JB', 'SC'); ctx.textBaseline = 'top'; ctx.fillStyle = PINK; ctx.fillText(a, x + 10, y + 10 + k * 22); ctx.fillStyle = c; ctx.fillText(b, x + 10 + (a ? 34 : 0), y + 10 + k * 22); });
    });
    const R4 = chrome(ctx, 1730, 628, 220, 98, '正在渲染…');
    inRect(ctx, R4, (x, y, w) => { tinyText(ctx, x + 12, y + 8, [`frame 9,404 / ${NFRAMES_FILM}`], { size: 12 }); ctx.fillStyle = css(BRAND, 0.18); ctx.fillRect(x + 12, y + 34, w - 24, 12); ctx.fillStyle = BRAND; ctx.fillRect(x + 12, y + 34, (w - 24) * 0.82, 12); });
    const R2 = chrome(ctx, 1430, 852, 210, 170, 'tail.png');
    inRect(ctx, R2, (x, y, w, h) => { ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x, y, w, h); ctx.drawImage(halftone(img, [440, 420, 300, 330], 206, 136, 6, BRAND, 'tail3'), x, y); });
    const R5 = chrome(ctx, 1740, 880, 210, 150, '任务管理器 · CPU');
    inRect(ctx, R5, (x, y, w, h) => { ctx.strokeStyle = css(NAVY, 0.15); ctx.lineWidth = 1; for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(x, y + (h * k) / 4); ctx.lineTo(x + w, y + (h * k) / 4); ctx.stroke(); }
      ctx.fillStyle = css(BRAND, 0.25); ctx.strokeStyle = BRAND; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y + h); for (let k = 0; k <= 24; k++) ctx.lineTo(x + (w * k) / 24, y + h * (0.12 + 0.18 * rnd(k, 3201))); ctx.lineTo(x + w, y + h); ctx.closePath(); ctx.fill(); ctx.stroke(); });
  });
  // A 左下（3 扇）：主标题——记事本（后面叠两层带版本号的副本）+ 查找 + 保存对话框；鼠标；探头的她
  tilted(ctx, 570, 760, () => {
    const X = 220, Y = 574, Wd = 700, Hd = 366, MENU = ['文件(F)', '编辑(E)', '格式(O)', '查看(V)', '帮助(H)'];
    [[2, '电子天使_v1.txt — 记事本', '#7F8FC8'], [1, '电子天使_v2_改.txt — 记事本', '#4A5893']].forEach(([k, name, tb]) => { const R = chrome(ctx, X - 26 * k, Y - 26 * k, Wd, Hd, name, { tb, menu: MENU }); inRect(ctx, R, (x, y) => tinyText(ctx, x + 50, y + 16, ['电子天使'], { size: 22, color: css(NAVY, 0.3), font: 'SCB' })); });
    // 查找对话框（压在两层副本的标题栏上，找的正是选中的「天使」）
    const F = chrome(ctx, 400, 452, 236, 98, '查找');
    inRect(ctx, F, (x, y) => { ctx.font = fonts(13, 'SC'); ctx.fillStyle = NAVY; midText(ctx, '查找内容', x + 10, y + 18); ctx.strokeStyle = NAVY; ctx.lineWidth = 1.2; ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x + 76, y + 7, 140, 22); ctx.strokeRect(x + 76, y + 7, 140, 22); ctx.fillStyle = NAVY; midText(ctx, '天使', x + 84, y + 18); ctx.fillStyle = BRAND; ctx.fillRect(x + 126, y + 40, 90, 24); ctx.font = fonts(12, 'SC'); ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center'; midText(ctx, '查找下一个', x + 171, y + 52); ctx.textAlign = 'left'; });
    let T = null;
    const R = chrome(ctx, X, Y, Wd, Hd, '电子天使_v28_最终版.txt — 记事本', { menu: MENU, status: '第 1 行，第 5 列    100%    UTF-8    ♥ 150 BPM' });
    inRect(ctx, R, (x, y, w, h) => {
      ctx.fillStyle = css(NAVY, 0.05); ctx.fillRect(x, y, 34, h); ctx.fillStyle = css(NAVY, 0.2); ctx.fillRect(x + 34, y, 1, h);
      ctx.font = fonts(13, 'JB'); ctx.fillStyle = css(NAVY, 0.45); ctx.textAlign = 'right'; [[1, 100], [2, 210], [3, 260]].forEach(([n, yy]) => ctx.fillText(String(n), x + 26, y + yy)); ctx.textAlign = 'left';
      T = titleGraphic(ctx, x + 66, y + 96, 152);
      cursorArrow(ctx, T.x3 - 18, y + 112);
      ctx.save(); ctx.font = fonts(34, 'SCB'); ctx.fillStyle = css(NAVY, 0.5); ctx.textBaseline = 'alphabetic'; ctx.fillText('如果代码能长出海', x + 64, y + 222);
      const w3 = ctx.measureText('如果代码能').width, w5 = ctx.measureText('如果代码能长出海').width; ctx.restore();
      ctx.strokeStyle = css(BRAND, 0.8); ctx.lineWidth = 3; ctx.beginPath(); for (let s = 0; s <= 60; s++) { const xx = x + 64 + w3 + ((w5 - w3) * s) / 60, yy = y + 234 + 4 * Math.sin(s * 0.62); s ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); } ctx.stroke();
      tinyText(ctx, x + 64, y + 262, ['// 音频：小缘翻唱版 · DeepSeek 鲸鱼娘 · 二创 MV · 作者：烧猫定食'], { size: 14, color: css(NAVY, 0.55), font: 'SC' });
    });
    if (T) { ctx.save(); ctx.shadowColor = css(GOLD, 0.9); ctx.shadowBlur = 12; ctx.strokeStyle = GOLD; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(T.hx, T.hy, 44, 11, -0.06, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
    // 保存对话框（比记事本下沿再低一截）
    const D = chrome(ctx, X + Wd - 110, Y + Hd - 40, 250, 112, '记事本');
    inRect(ctx, D, (x, y) => { tinyText(ctx, x + 14, y + 10, ['是否将更改保存到 v28_最终版？'], { size: 13, font: 'SC' }); [['保存', true], ['不保存', false]].forEach(([b, hot], k) => { const bx = x + 40 + k * 96, by = y + 44; ctx.fillStyle = hot ? BRAND : '#FFFFFF'; ctx.fillRect(bx, by, 80, 26); ctx.strokeStyle = NAVY; ctx.lineWidth = 1.4; ctx.strokeRect(bx, by, 80, 26); ctx.font = fonts(13, 'SC'); ctx.fillStyle = hot ? '#FFFFFF' : NAVY; ctx.textAlign = 'center'; midText(ctx, b, bx + 40, by + 13); ctx.textAlign = 'left'; }); });
    // Q 版表情包：在记事本里面的右下角、最右边——头的右边压住记事本的右边框约 16 px、右耳伸出窗口约 25 px，双手搭在保存对话框的上沿（画在对话框之后）
    { const sw = 150, sh = 119; ctx.drawImage(photo('S00', null, sw, sh, { keyed: true }), X + Wd + 27 - sw, Y + Hd - 40 + 3 - sh); }
    // 记事本上沿（以前 S00 探头的位置）：另一张表情包——趴着吐泡泡的 S03，胳膊压进标题栏 10 px（图里人物底边在 96.4% 高处）
    { const sw = 220, sh = Math.round((sw * 946) / 1421); ctx.drawImage(photo('S03', null, sw, sh, { keyed: true }), X + Wd - 260, Y + 10 - Math.round(sh * 0.964)); }
  });
  // 左上的绿线：资源管理器 → 最终版记事本（端口在它左边、正文中段，从左边接进来；画在记事本那组之后，端口才露得出来）。
  // 先往右走、从 readme 和气泡之间的空当落下来，再兜回左边接进端口，不压 readme 和副本的标题
  { const [x0, y0] = P(190, 170, 340, 130), [x1, y1] = P(570, 760, 220, 694); wire(ctx, x0, y0, x1, y1, '#7FC8A9', { dir0: 1, dir1: 1, dx: [215, 250] }); }
  // 6. 颗粒、四角裁切标记
  ctx.save(); ctx.globalAlpha = 0.05; ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(grain(W, H), 0, 0); ctx.restore();
  ctx.save(); ctx.strokeStyle = NAVY; ctx.lineWidth = 1.5; const m = 18, L = 30;
  ctx.beginPath(); for (const [x, y, sx, sy] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]]) { ctx.moveTo(x, y + sy * L); ctx.lineTo(x, y); ctx.lineTo(x + sx * L, y); } ctx.stroke();
  ctx.restore();
}
