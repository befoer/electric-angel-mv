// 视频封面（第二十八轮重做；第二十七轮的「晴空」装饰铺满版、第二十四轮的「代码翅膀」三版在 归档/快照/ 里）。只画一帧，不进镜头表；render/cover.mjs 调它出 PNG。
// 用户第二十八轮：「当前封面缺少美感，我在 资料 中放了两张封面参考，只参考感觉，不要参考题材和配色。图片可以再放大，边缘到画布外也没关系」。
// 参考图的感觉是"编辑排版的拼贴"：一个很大、出画的主体；贯穿画面的细参考线；带方形控制点的选择框 + 小标签；穿插的小窗口和裁切小图；
// 字号对比极大（一个大标题 + 很多极小的说明文字）；底色素、只有一个强调色；颗粒和错位的质感。配色仍用第一段「晴空」的蓝（用户上一轮定的）。
// · 主图（她趴在对话窗口里）放大到 1.22 倍，脸在 (1190, 470)，窗口四边出画；横向错开几条（扫描错位），后面垫一张放大的淡蓝单色副本
// · 脸上一个选择框（8 个方形控制点）+ 标签，框的四条边延长成贯穿画面的细参考线，交点打小十字；脸外一圈虚线大圆
// · 三个小窗口（标题栏 + 关闭钮）：从主图裁出来的眼睛（深蓝单色）、尾鳍（品牌蓝网点）、胸前的宝石（圆形）
// · 标题卡（左下）：白底细框，「电子天使」点阵字（深蓝 + 错位一层品牌蓝），下面片名、署名、几行极小的说明字
// · 背景：素白纸 + 颗粒 + 很淡的方格，背后一行超大的描边英文 ELECTRONIC ANGEL
// o.img：主图（render/cover.mjs 读好传进来）
import { W, H, BRAND } from '../core/const.js';
import { clamp } from '../core/time.js';
import { rnd, hash } from '../core/rand.js';
import { fonts, midText } from '../core/glyphs.js';
import { css } from '../core/color.js';
import { drawSprite } from '../core/sprites.js';
import { rrect } from '../core/ui.js';
import { newCanvas } from '../core/env.js';
import { keyword } from '../core/data.js';

export const COVER_T = 15.6; // 取这一刻的调色板（第一段晴空）
const NAVY = '#1D2541', DEEP = '#2A3F9E', PALE = '#DCE6FF', PAPER = '#F3F6FC', PINK = '#FF6FA8';
// 主图在画面里：原图 2048×1152，缩放 IS，原图坐标 (1024, 576) 放在 (IX, IY)。脸（原图 (1112, 482)）落在 (1190, 470)
const IS = 1.22, IX = 1190 - (1112 - 1024) * IS, IY = 470 - (482 - 576) * IS;
const M = (x, y) => [IX + (x - 1024) * IS, IY + (y - 576) * IS];
const FACE = (() => { const [x0, y0] = M(880, 345), [x1, y1] = M(1205, 640); return [x0, y0, x1 - x0, y1 - y0]; })(); // 脸（额前到下巴、两只眼睛都在框里），在出的图上量的

// ---------------------------------------------------------------- 图像处理（都按参数缓存）
const CACHE = new Map();
const cached = (k, f) => { if (!CACHE.has(k)) CACHE.set(k, f()); return CACHE.get(k); };
// 单色：按亮度在 dark → light 之间取色（保留原图的透明度）
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
// 网点：按暗度画圆点（越暗点越大）
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
const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
// 颗粒：每个像素一个按位置哈希的灰度，叠一层很淡的
function grain(w, h) {
  return cached(`grain|${w}|${h}`, () => {
    const cv = newCanvas(w, h), c = cv.getContext('2d'), id = c.createImageData(w, h), d = id.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = (y * w + x) * 4, v = hash(x, y, 2801) % 255; d[o] = d[o + 1] = d[o + 2] = v; d[o + 3] = 255; }
    c.putImageData(id, 0, 0); return cv;
  });
}

// ---------------------------------------------------------------- 小部件
// 选择框：细框 + 8 个方形控制点 + 左上一个小标签
function selection(ctx, x, y, w, h, label, { color = NAVY, lw = 1.5, hs = 11 } = {}) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.strokeRect(x, y, w, h);
  for (const [u, v] of [[0, 0], [0.5, 0], [1, 0], [0, 0.5], [1, 0.5], [0, 1], [0.5, 1], [1, 1]]) {
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x + u * w - hs / 2, y + v * h - hs / 2, hs, hs); ctx.strokeRect(x + u * w - hs / 2, y + v * h - hs / 2, hs, hs);
  }
  if (label) labelBox(ctx, x, y - 44, label);
  ctx.restore();
}
// 标签：白底细框，衬线字（明朝体的拉丁字母）
function labelBox(ctx, x, y, text, { size = 26, ink = NAVY } = {}) {
  ctx.save(); ctx.font = fonts(size, 'MIN0', 'SC'); const w = ctx.measureText(text).width + 26, h = size + 16;
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x, y, w, h); ctx.strokeStyle = ink; ctx.lineWidth = 1.5; ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = ink; midText(ctx, text, x + 13, y + h / 2);
  ctx.restore();
}
// 小窗口：标题栏（文件名 + 三个钮）+ 内容
function miniWindow(ctx, x, y, w, h, title, draw, { rot = 0 } = {}) {
  ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(rot); ctx.translate(-w / 2, -h / 2);
  ctx.fillStyle = css(NAVY, 0.16); ctx.fillRect(8, 10, w, h);
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, w, h); ctx.strokeStyle = NAVY; ctx.lineWidth = 2; ctx.strokeRect(0, 0, w, h);
  ctx.fillStyle = NAVY; ctx.fillRect(0, 0, w, 30);
  ctx.font = fonts(16, 'JB'); ctx.fillStyle = '#FFFFFF'; midText(ctx, title, 12, 15);
  for (let i = 0; i < 3; i++) { const bx = w - 26 - i * 24; ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1.5; ctx.strokeRect(bx, 8, 15, 15); }
  ctx.beginPath(); ctx.moveTo(w - 23, 11); ctx.lineTo(w - 14, 20); ctx.moveTo(w - 14, 11); ctx.lineTo(w - 23, 20); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.rect(4, 34, w - 8, h - 38); ctx.clip(); draw(ctx, 4, 34, w - 8, h - 38); ctx.restore();
  ctx.restore();
}
const cross = (ctx, x, y, s = 7) => { ctx.beginPath(); ctx.moveTo(x - s, y); ctx.lineTo(x + s, y); ctx.moveTo(x, y - s); ctx.lineTo(x, y + s); ctx.stroke(); };
function tinyText(ctx, x, y, lines, { size = 13, lh = 1.45, color = NAVY, font = 'JB', align = 'left' } = {}) {
  ctx.save(); ctx.font = fonts(size, font, 'SC'); ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'top';
  lines.forEach((s, i) => ctx.fillText(s, x, y + i * size * lh));
  ctx.restore();
}

// ---------------------------------------------------------------- 标题：点阵字，深蓝 + 错开一层品牌蓝
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
function dotTitle(ctx, text, x, y, px) {
  const N = 21, pitch = px / N, r = pitch * 0.44, chars = [...text];
  ctx.save(); ctx.font = fonts(Math.round(px * 0.92), 'SMILEY', 'SCB');
  const adv = chars.map(ch => ctx.measureText(ch).width * 0.98);
  let xx = x;
  const C = chars.map((ch, k) => { const c = { ch, k, cx: xx + adv[k] / 2 }; xx += adv[k]; return c; });
  for (const [dx, dy, col] of [[7, 6, BRAND], [0, 0, NAVY]]) for (const c of C) for (const [i, j] of cells(c.ch, N)) {
    const h = rnd(i, j, c.k * 5 + 2810);
    ctx.fillStyle = dx ? css(col, 0.85) : h < 0.03 ? PINK : col;
    ctx.beginPath(); ctx.arc(c.cx + (i - N / 2 + 0.5) * pitch + dx, y + (j - N / 2 + 0.5) * pitch + dy, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  return xx - x;
}

// ---------------------------------------------------------------- 封面
export function cover(ctx, S, o = {}) {
  const img = o.img, p = S.pal, kw = keyword('L01', 5, 6)[0].c;
  // 1. 纸：素白 + 很淡的方格 + 颗粒
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = css(DEEP, 0.045); for (let x = 0; x <= W; x += 48) ctx.fillRect(x, 0, 1, H); for (let y = 0; y <= H; y += 48) ctx.fillRect(0, y, W, 1);
  // 2. 背后：超大描边英文、放大的淡蓝单色主图副本、脸外的虚线大圆
  if (img) { const big = duotone(img, [0, 0, img.width, img.height], 1024, 576, '#9DB2F0', PAPER, 'bg'); ctx.save(); ctx.globalAlpha = 0.55; ctx.drawImage(big, -700, -260, 2048 * 1.25, 1152 * 1.25); ctx.restore(); }
  ctx.save(); ctx.font = fonts(300, 'SMILEY', 'SCB'); ctx.textBaseline = 'alphabetic'; ctx.lineWidth = 2; ctx.strokeStyle = css(DEEP, 0.2);
  ctx.strokeText('ELECTRONIC', -40, 330); ctx.strokeText('ANGEL', 760, 1010); ctx.restore();
  const [fx, fy, fw, fh] = FACE, fcx = fx + fw / 2, fcy = fy + fh / 2;
  ctx.save(); ctx.strokeStyle = css(NAVY, 0.35); ctx.lineWidth = 1.5; ctx.setLineDash([3, 9]); ctx.beginPath(); ctx.arc(fcx, fcy, 560, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]); ctx.strokeStyle = css(BRAND, 0.35); ctx.beginPath(); ctx.arc(fcx, fcy, 430, -2.6, 0.4); ctx.stroke(); ctx.restore();
  // 3. 主图：几条横向错位（在一张原图大小的离屏画布上切：条外照常画、条里换成错开的那份、只在有图的地方带一点品牌蓝）
  if (img) {
    const BANDS = [[262, 22, -40], [668, 12, 52], [786, 28, -28], [150, 9, 70]];
    const glitched = cached('glitch', () => {
      const cv = newCanvas(img.width, img.height), c = cv.getContext('2d');
      c.save(); c.beginPath(); c.rect(0, 0, img.width, img.height); for (const [y0, hh] of BANDS) c.rect(img.width, y0, -img.width, hh); c.clip('evenodd'); c.drawImage(img, 0, 0); c.restore();
      for (const [y0, hh, dx] of BANDS) {
        c.save(); c.beginPath(); c.rect(0, y0, img.width, hh); c.clip(); c.drawImage(img, dx, 0);
        c.globalCompositeOperation = 'source-atop'; c.fillStyle = css(BRAND, 0.16); c.fillRect(0, y0, img.width, hh); c.restore();
      }
      return cv;
    });
    ctx.save(); ctx.translate(IX, IY); ctx.scale(IS, IS); ctx.translate(-1024, -576); ctx.drawImage(glitched, 0, 0); ctx.restore();
  }
  // 气泡里的字（原图坐标；跟着窗口的透视各转一点）
  if (img) {
    ctx.save(); ctx.translate(IX, IY); ctx.scale(IS, IS); ctx.translate(-1024, -576);
    const say = (cx, cy, rot, t, px, spr) => { ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.font = fonts(px, 'ZENB', 'SCB'); const tw = ctx.measureText(t).width, sw = spr ? px : 0; ctx.fillStyle = DEEP; midText(ctx, t, -(tw + sw) / 2, 0); if (spr) drawSprite(ctx, spr, Math.round(px / 11), p, (tw - sw) / 2 + sw * 0.7, -2, 1); ctx.restore(); };
    say(534, 296, 0.04, '唱首歌吧', 54, 'heart');
    say(1571, 503, -0.145, '好呀～', 58, 'note');
    ctx.restore();
  }
  // 4. 参考线：脸上选择框的四条边延长到画面边上，交点打十字；一条斜线
  ctx.save(); ctx.strokeStyle = css(NAVY, 0.42); ctx.lineWidth = 1;
  ctx.beginPath(); for (const y of [fy, fy + fh]) { ctx.moveTo(0, y); ctx.lineTo(W, y); } for (const x of [fx, fx + fw]) { ctx.moveTo(x, 0); ctx.lineTo(x, H); } ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, 1010); ctx.lineTo(1010, 0); ctx.stroke();
  ctx.lineWidth = 1.5; for (const x of [fx, fx + fw, 250, 1680]) for (const y of [fy, fy + fh]) cross(ctx, x, y, 8);
  ctx.restore();
  // 5. 选择框：脸、左上的气泡
  selection(ctx, fx, fy, fw, fh, 'Sing.');
  { const [bx0, by0] = M(392, 226), [bx1, by1] = M(676, 368); selection(ctx, bx0, by0, bx1 - bx0, by1 - by0, null, { color: BRAND, lw: 1.5, hs: 9 }); labelBox(ctx, bx0 - 6, by1 + 16, 'Hello.', { size: 22 }); }
  // 脸框右上：文件信息
  ctx.save(); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(fx + fw + 12, fy, 150, 66); ctx.restore();
  tinyText(ctx, fx + fw + 20, fy + 8, ['鲸鱼娘.png', '2048 × 1152', 'layer 01 · 100%'], { size: 13, color: NAVY });
  // 6. 小窗口：眼睛（深蓝单色）、尾鳍（网点）、宝石（圆形）
  if (img) {
    miniWindow(ctx, 1482, 40, 400, 230, 'eye.png', (g, x, y, w, h) => { g.drawImage(duotone(img, [872, 412, 320, 150], 392, 184, NAVY, '#FFFFFF', 'eye'), x, y, w, h); }, { rot: 0.02 });
    tinyText(ctx, 1486, 290, ['① focus · right eye', '② temp 0.6 / top_p 0.95'], { size: 13 });
    miniWindow(ctx, 1600, 650, 290, 250, 'tail.png', (g, x, y, w, h) => { g.fillStyle = '#FFFFFF'; g.fillRect(x, y, w, h); g.drawImage(halftone(img, [440, 420, 300, 330], 282, 216, 7, BRAND, 'tail'), x, y); }, { rot: -0.03 });
    miniWindow(ctx, 40, 640, 200, 200, 'gem.png', (g, x, y, w, h) => { g.save(); g.beginPath(); g.arc(x + w / 2, y + h / 2, Math.min(w, h) / 2 - 8, 0, Math.PI * 2); g.clip(); g.fillStyle = PALE; g.fillRect(x, y, w, h); g.drawImage(img, 944, 675, 90, 90, x + w / 2 - 80, y + h / 2 - 80, 160, 160); g.restore(); }); // 宝石按原色（单色以后只剩一团灰）
    tinyText(ctx, 44, 860, ['③ brooch · 0x4D6BFE'], { size: 13 });
  }
  // 7. 像素方块和棋盘格（品牌蓝），一个粉色的点
  ctx.fillStyle = BRAND;
  for (const [x, y, s] of [[1418, 64, 22], [1440, 86, 22], [1418, 108, 22], [262, 568, 18], [280, 586, 18], [1846, 940, 16]]) ctx.fillRect(x, y, s, s);
  for (let j = 0; j < 4; j++) for (let i = 0; i < 6; i++) if ((i + j) % 2 === 0) { ctx.fillStyle = css(NAVY, 0.85); ctx.fillRect(1600 + i * 12, 610 + j * 12, 12, 12); }
  ctx.fillStyle = PINK; ctx.beginPath(); ctx.arc(1694, 618, 7, 0, Math.PI * 2); ctx.fill();
  tinyText(ctx, 1708, 610, ['REC'], { size: 13, color: PINK, font: 'JB' });
  // 8. 左边一列极小的说明字（参考图里那种密排小字）
  tinyText(ctx, 40, 120, ['SYSTEM DISPLAY ...', '', 'frame = f(t)', '1920 × 1080 · 60 fps', '191.69 s · 150 BPM', 'context · 1,048,576', '', 'next token', `${kw}  0.92`, '饭  0.03', '鲸  0.02'], { size: 13 });
  ctx.save(); ctx.font = fonts(54, 'JB'); ctx.fillStyle = NAVY; ctx.textBaseline = 'alphabetic'; ctx.fillText('03:11', 40, 470); ctx.restore();
  tinyText(ctx, 42, 482, ['THE WHOLE FILM', 'IS DRAWN BY CODE'], { size: 12 });
  // 9. 标题卡（左下，在 4:3 安全区里，下沿留出 130 px）
  const tx = 262, ty = 626, tw = 700, th = 318;
  ctx.save(); ctx.fillStyle = css(NAVY, 0.14); ctx.fillRect(tx + 10, ty + 12, tw, th);
  ctx.fillStyle = 'rgba(255,255,255,0.94)'; ctx.fillRect(tx, ty, tw, th); ctx.strokeStyle = NAVY; ctx.lineWidth = 2; ctx.strokeRect(tx, ty, tw, th);
  ctx.fillStyle = NAVY; ctx.fillRect(tx, ty, tw, 30); ctx.font = fonts(15, 'JB'); ctx.fillStyle = '#FFFFFF'; midText(ctx, 'title.txt — vocal cover · 二创 MV', tx + 14, ty + 15);
  ctx.restore();
  dotTitle(ctx, '电子天使', tx + 32, ty + 132, 172);
  ctx.save(); ctx.fillStyle = NAVY; ctx.fillRect(tx + 30, ty + 236, tw - 60, 1.5); ctx.restore();
  ctx.save(); ctx.font = fonts(34, 'SCB'); ctx.fillStyle = NAVY; ctx.textBaseline = 'alphabetic'; ctx.fillText('如果代码能长出海', tx + 30, ty + 284); ctx.restore();
  tinyText(ctx, tx + tw - 30, ty + 248, ['翻唱：小缘', '鲸鱼娘 · 二创 MV', '非官方 · 非商业'], { size: 14, align: 'right', font: 'SC' });
  // 10. 颗粒（最上面一层，很淡）和四角裁切标记
  ctx.save(); ctx.globalAlpha = 0.05; ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(grain(W, H), 0, 0); ctx.restore();
  ctx.save(); ctx.strokeStyle = NAVY; ctx.lineWidth = 1.5; const m = 18, L = 30;
  ctx.beginPath(); for (const [x, y, sx, sy] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]]) { ctx.moveTo(x, y + sy * L); ctx.lineTo(x, y); ctx.lineTo(x + sx * L, y); } ctx.stroke();
  ctx.restore();
}
