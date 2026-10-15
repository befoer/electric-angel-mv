// 贴纸组件（Kira 式，视觉方案 §4.13）：贴纸卡、引线、环形仪表、数据行、装饰、印章、条形码、剪影
import { BRAND } from './const.js';
import { rrect } from './ui.js';
import { font, fonts, midText } from './glyphs.js';
import { css } from './color.js';
import { clamp, easeOut, easeOutBack, smooth } from './time.js';
import { hash } from './rand.js';
import { keyed } from './portrait.js';
import { newCanvas } from './env.js';
import { voiceAt } from './sprites.js';

// 第十一轮（用户：黄色底和整体配色不搭）：贴纸卡的黄底（晴空 / 晨光调色板的 tint[1]）一律换成浅蓝。rev blue
export const LIGHT_BLUE = '#DCE6FF';
const YELLOWS = new Set(['#FFF2C2', '#FFF0C9']);
export const unYellow = c => (YELLOWS.has(c) ? LIGHT_BLUE : c);

const TAU = Math.PI * 2;
// 卡片、仪表、数字用 Zen Maru 粗体，缺字（简体中文）时退到更纱粗体
const zen = px => fonts(px, 'ZENB', 'SCB');
const circle = (ctx, x, y, r) => { ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, TAU); };

// 弹出缩放 0 → 1，手感按音色段（视觉方案 §七）：萝莉音回弹、御姐音干脆、少女音漂浮
export function popIn(S, age, dur = 0.14) {
  if (age < 0) return 0;
  const v = voiceAt(S.bar);
  if (v === 'loli') return easeOutBack(clamp(age / dur), 2.2);
  if (v === 'onee') return easeOut(clamp(age / dur));
  return smooth(clamp(age / (dur * 2.5)));
}

// 贴纸卡：圆角、外框 + 内侧第二道线、纯色底、右下硬投影。draw(content) 在卡片的变换里画内容
// o.fill 底色（默认窗口白）· o.line 线色 · o.shadow 投影色 · o.title 左上角标签 · o.titleFill
// o.age 弹出动画（出现后的秒数；不给 = 已出现）· o.rot 旋转（弧度）· o.alpha · o.r 圆角 · o.inner false 不画内线
// 返回内容区 { x, y, w, h }（未旋转、未缩放的坐标）
export function card(ctx, S, x, y, w, h, o = {}, draw = null) {
  const p = S.pal, r = o.r ?? 18, line = o.line ?? p.line;
  const pad = o.pad ?? 22, top = o.title ? pad + 22 : pad;
  const content = { x: x + pad, y: y + top, w: w - 2 * pad, h: h - top - pad };
  const sc = o.age == null ? 1 : popIn(S, o.age);
  if (sc <= 0.001 || (o.alpha ?? 1) <= 0) return content;
  ctx.save();
  ctx.globalAlpha *= o.alpha ?? 1;
  const cx = x + w / 2, cy = y + h / 2;
  ctx.translate(cx, cy); if (o.rot) ctx.rotate(o.rot); if (sc !== 1) ctx.scale(sc, sc); ctx.translate(-cx, -cy);
  ctx.fillStyle = o.shadow ?? css(line, 0.3);
  rrect(ctx, x + 7, y + 8, w, h, r); ctx.fill();
  ctx.fillStyle = unYellow(o.fill) ?? p.win;
  rrect(ctx, x, y, w, h, r); ctx.fill();
  ctx.lineWidth = o.lw ?? 4; ctx.strokeStyle = line; ctx.stroke();
  if (o.inner !== false) {
    ctx.lineWidth = 2; ctx.strokeStyle = css(line, 0.4);
    rrect(ctx, x + 8, y + 8, w - 16, h - 16, Math.max(4, r - 7)); ctx.stroke();
  }
  if (o.title) {
    ctx.font = zen(20);
    const tw = ctx.measureText(o.title).width + 28;
    ctx.fillStyle = o.titleFill ?? line;
    rrect(ctx, x + 20, y - 15, tw, 32, 16); ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    midText(ctx, o.title, x + 34, y + 1); // 第十二轮：按大写字母高度居中到胶囊中线（以前偏下）
    ctx.textBaseline = 'alphabetic';
  }
  if (draw) draw(content);
  ctx.restore();
  return content;
}

// 引线：锚点（实心圆点 + 白圈）→ 45° 斜线 → 水平到 (bx, by)。u 画出的比例（0..1）
export function leader(ctx, S, ax, ay, bx, by, u = 1, o = {}) {
  if (u <= 0) return;
  const color = o.color ?? S.pal.line;
  const sx = Math.sign(bx - ax) || 1, diag = Math.min(Math.abs(bx - ax), Math.abs(by - ay));
  const ex = ax + sx * diag, ey = by;
  const l1 = Math.hypot(ex - ax, ey - ay), l2 = Math.abs(bx - ex), L = l1 + l2 || 1;
  let rem = clamp(u) * L;
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = o.lw ?? 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(ax, ay);
  if (rem <= l1) ctx.lineTo(ax + ((ex - ax) * rem) / (l1 || 1), ay + ((ey - ay) * rem) / (l1 || 1));
  else { ctx.lineTo(ex, ey); rem -= l1; ctx.lineTo(ex + sx * rem, ey); }
  ctx.stroke();
  const r = (o.r ?? 8) * easeOutBack(clamp(u * 4), 2);
  ctx.fillStyle = '#FFFFFF'; circle(ctx, ax, ay, r + 4); ctx.fill();
  ctx.fillStyle = o.dot ?? color; circle(ctx, ax, ay, r); ctx.fill();
  ctx.restore();
}

// 环形仪表：外细线 + 底环 + 进度弧 + 白芯 + 数字。v 0..1；o.text 中间的字（默认百分数）· o.label 下方小字 · o.color 弧色
export function ring(ctx, S, cx, cy, r, v, o = {}) {
  const p = S.pal, w = o.w ?? r * 0.24, line = o.line ?? p.line;
  ctx.save();
  ctx.globalAlpha *= o.alpha ?? 1;
  ctx.lineWidth = 3; ctx.strokeStyle = line; circle(ctx, cx, cy, r + w * 0.75); ctx.stroke();
  ctx.lineWidth = w; ctx.strokeStyle = o.track ?? p.tint[3]; circle(ctx, cx, cy, r); ctx.stroke();
  const a = clamp(v);
  if (a > 0.002) {
    ctx.lineCap = 'round'; ctx.strokeStyle = o.color ?? p.acc[0];
    // 第二十二轮（用户：缓存命中的环形进度条到 100 后不要消失）：出片用的画布 arc(−90°, 270°) 整整一圈时什么都不画，满了改画整圆（第二十四轮并开关）
    if (a >= 0.9995) circle(ctx, cx, cy, r);
    else { ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + TAU * a); }
    ctx.stroke();
  }
  ctx.fillStyle = '#FFFFFF'; circle(ctx, cx, cy, r - w * 0.75); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = line; ctx.stroke();
  const text = o.text ?? String(Math.round(a * 100));
  ctx.font = zen(Math.round(o.fs ?? r * 0.52)); ctx.fillStyle = o.textColor ?? p.text;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, cy + 2);
  if (o.label) {
    ctx.font = zen(Math.round(o.labelSize ?? Math.max(15, r * 0.3))); ctx.fillStyle = o.labelColor ?? p.gray;
    ctx.fillText(o.label, cx, cy + r + w + (o.labelSize ?? Math.max(15, r * 0.3)) * 0.9);
  }
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.restore();
}

// 数据行：items [{ k 标签, v 数值串, unit 单位, u 横条 0..1, hi 高亮 }]，左上角 (x, y)
// o.rh 行高 · o.fs 字号 · o.kw 标签列宽 · o.vw 数值列宽 · o.bw 横条宽 · o.kFont 标签字体
export function rows(ctx, S, x, y, items, o = {}) {
  const p = S.pal, fs = o.fs ?? 32, rh = o.rh ?? Math.round(fs * 1.6), kw = o.kw ?? fs * 2, vw = o.vw ?? fs * 3.4, bw = o.bw ?? 200;
  items.forEach((it, i) => {
    const cy = y + i * rh + rh / 2, a = it.alpha ?? 1;
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha *= a;
    if (it.hi) { ctx.fillStyle = o.hiFill ?? p.tint[0]; rrect(ctx, x - 14, cy - rh / 2 + 4, kw + vw + bw + 72, rh - 8, (rh - 8) / 2); ctx.fill(); }
    ctx.textBaseline = 'middle';
    ctx.font = font(o.kFont ?? 'SMILEY', fs); ctx.fillStyle = it.hi ? BRAND : p.text;
    ctx.fillText(it.k, x, cy + 2);
    ctx.font = zen(fs); ctx.textAlign = 'right'; ctx.fillStyle = it.hi ? BRAND : p.text;
    ctx.fillText(it.v, x + kw + vw, cy + 2);
    ctx.textAlign = 'left';
    let bx = x + kw + vw + 12;
    if (it.unit) { ctx.font = zen(Math.round(fs * 0.55)); ctx.fillStyle = p.gray; ctx.fillText(it.unit, bx, cy + 4); bx += ctx.measureText(it.unit).width + 12; }
    if (it.u != null) {
      const bh = Math.round(fs * 0.42);
      ctx.fillStyle = '#FFFFFF'; rrect(ctx, bx, cy - bh / 2, bw, bh, 4); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = p.line; ctx.stroke();
      ctx.fillStyle = it.hi ? p.acc[0] : p.acc[1]; rrect(ctx, bx + 3, cy - bh / 2 + 3, Math.max(0, (bw - 6) * clamp(it.u)), bh - 6, 3); ctx.fill();
    }
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  });
  return items.length * rh;
}

// ---------------------------------------------------------------- 装饰

// 圆点阵：cols×rows 个，间距 gap。o.hollow 空心
export function dots(ctx, x, y, cols, rows, gap, r, color, { hollow = false, lw = 3 } = {}) {
  ctx.save();
  ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineWidth = lw;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    circle(ctx, x + i * gap, y + j * gap, r);
    if (hollow) ctx.stroke(); else ctx.fill();
  }
  ctx.restore();
}

// /// 斜线：n 条平行四边形
export function hatch(ctx, x, y, n, h, color, { w = 10, gap = 16, slant = 0.45 } = {}) {
  ctx.save(); ctx.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const x0 = x + i * gap;
    ctx.beginPath(); ctx.moveTo(x0 + h * slant, y); ctx.lineTo(x0 + h * slant + w, y); ctx.lineTo(x0 + w, y + h); ctx.lineTo(x0, y + h); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// 圆角三角警示牌，中间一个感叹号
export function warn(ctx, S, cx, cy, size, { fill = null, line = null } = {}) {
  const p = S.pal, h = size * 0.88, r = size * 0.16;
  const pts = [[cx, cy - h / 2], [cx + size / 2, cy + h / 2], [cx - size / 2, cy + h / 2]];
  ctx.save();
  ctx.beginPath();
  ctx.moveTo((pts[0][0] + pts[2][0]) / 2, (pts[0][1] + pts[2][1]) / 2);
  for (let i = 0; i < 3; i++) { const a = pts[i], b = pts[(i + 1) % 3]; ctx.arcTo(a[0], a[1], b[0], b[1], r); }
  ctx.closePath();
  ctx.fillStyle = fill ?? '#C9C2FF'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = line ?? p.line; ctx.stroke();
  ctx.fillStyle = p.text;
  rrect(ctx, cx - size * 0.05, cy - h * 0.12, size * 0.1, h * 0.3, size * 0.05); ctx.fill();
  circle(ctx, cx, cy + h * 0.3, size * 0.06); ctx.fill();
  ctx.restore();
}

// 取景角：四个直角 + 中心十字
export function corners(ctx, x, y, w, h, color, { len = 26, lw = 4, plus = true } = {}) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round';
  const L = [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]];
  ctx.beginPath();
  for (const [px, py, sx, sy] of L) { ctx.moveTo(px + sx * len, py); ctx.lineTo(px, py); ctx.lineTo(px, py + sy * len); }
  if (plus) { const cx = x + w / 2, cy = y + h / 2; ctx.moveTo(cx - 12, cy); ctx.lineTo(cx + 12, cy); ctx.moveTo(cx, cy - 12); ctx.lineTo(cx, cy + 12); }
  ctx.stroke(); ctx.restore();
}

// ＋ / － 两个圆角按钮，竖排
export function plusMinus(ctx, S, x, y, size) {
  const p = S.pal;
  ctx.save(); ctx.lineWidth = 3; ctx.strokeStyle = p.line; ctx.lineCap = 'round';
  for (let k = 0; k < 2; k++) {
    const yy = y + k * (size + 10);
    ctx.fillStyle = '#FFFFFF'; rrect(ctx, x, yy, size, size, size * 0.24); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = k ? p.line : p.acc[0]; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(x + size * 0.28, yy + size / 2); ctx.lineTo(x + size * 0.72, yy + size / 2);
    if (!k) { ctx.moveTo(x + size / 2, yy + size * 0.28); ctx.lineTo(x + size / 2, yy + size * 0.72); }
    ctx.stroke(); ctx.lineWidth = 3; ctx.strokeStyle = p.line;
  }
  ctx.restore();
}

// 棋盘格：cell 像素一格，两色
export function checker(ctx, x, y, w, h, cell, c1, c2) {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = c1; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = c2;
  for (let j = 0; j * cell < h; j++) for (let i = j % 2; i * cell < w; i += 2) ctx.fillRect(x + i * cell, y + j * cell, cell, cell);
  ctx.restore();
}

// 色板条：竖排圆角色块
export function swatches(ctx, S, x, y, colors, size = 40) {
  const p = S.pal, gap = 12, h = colors.length * (size + gap) + gap;
  ctx.save();
  ctx.fillStyle = '#FFFFFF'; rrect(ctx, x, y, size + 2 * gap, h, 12); ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = p.line; ctx.stroke();
  colors.forEach((c, i) => { ctx.fillStyle = c; rrect(ctx, x + gap, y + gap + i * (size + gap), size, size, 8); ctx.fill(); ctx.lineWidth = 2; ctx.stroke(); });
  ctx.restore();
}

// 红色印章：age 秒内从 1.6 倍砸到 1 倍。text 一行
// o.fill（第十二轮）：印章框里先垫一层底色（如白），压在复杂背景上也读得清
export function stamp(ctx, S, text, cx, cy, size, age, { color = null, rot = -0.14, fill = null } = {}) {
  if (age < 0) return;
  const c = color ?? S.pal.acc[0], sc = 1.6 - 0.6 * easeOut(clamp(age / 0.09));
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(rot); ctx.scale(sc, sc);
  ctx.globalAlpha *= 0.92 * clamp(age / 0.04);
  ctx.font = zen(size);
  const w = ctx.measureText(text).width + size * 0.9, h = size * 1.5;
  if (fill) { ctx.fillStyle = fill; rrect(ctx, -w / 2, -h / 2, w, h, size * 0.25); ctx.fill(); }
  ctx.strokeStyle = c; ctx.lineWidth = Math.max(3, size * 0.09);
  rrect(ctx, -w / 2, -h / 2, w, h, size * 0.25); ctx.stroke();
  ctx.lineWidth = Math.max(2, size * 0.04);
  rrect(ctx, -w / 2 + size * 0.14, -h / 2 + size * 0.14, w - size * 0.28, h - size * 0.28, size * 0.16); ctx.stroke();
  ctx.fillStyle = c; ctx.textAlign = 'center';
  // 第十五轮（用户：「显存不足」和底下的矩形没居中，字偏低）：以前 textBaseline 'middle'（按 em 框）再往下挪 0.06 字号，中文字的墨迹整体偏下；
  // 现在量这串字墨迹的上下沿，把墨迹的中线放到框的中线上（全片的印章一起改）
  ctx.textBaseline = 'alphabetic'; const m = ctx.measureText(text); ctx.fillText(text, 0, (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2);
  ctx.restore();
}

// 条形码：条宽由 str 的哈希决定，下面印 str
export function barcode(ctx, x, y, w, h, str, color, { digits = true } = {}) {
  const n = 46;
  const ws = Array.from({ length: n }, (_, i) => 1 + (hash(i, str.length, str.charCodeAt(i % str.length)) % 3));
  const total = ws.reduce((a, b) => a + b, 0) * 2, k = w / total;
  ctx.save(); ctx.fillStyle = color;
  let cx = x;
  ws.forEach((bw, i) => { if (i % 2 === 0) ctx.fillRect(Math.round(cx), y, Math.max(1, Math.round(bw * k * 1.4)), h); cx += bw * k * 2; });
  if (digits) {
    ctx.font = zen(Math.round(h * 0.32)); ctx.textAlign = 'center';
    ctx.fillText(str, x + w / 2, y + h + h * 0.36);
    ctx.textAlign = 'left';
  }
  ctx.restore();
}

// 剪影：立绘的透明通道填纯色（缓存）
const SIL = new Map();
export function silhouette(id, sub = null, maxDim = 1024, color = BRAND) {
  const k = `${id}|${sub}|${maxDim}|${color}`;
  let cv = SIL.get(k);
  if (cv) return cv;
  const src = keyed(id, sub, maxDim);
  cv = newCanvas(src.width, src.height);
  const c = cv.getContext('2d');
  c.drawImage(src, 0, 0);
  c.globalCompositeOperation = 'source-in';
  c.fillStyle = color; c.fillRect(0, 0, cv.width, cv.height);
  SIL.set(k, cv);
  return cv;
}

// 剪影内部铺一层纹理（公式墙纸等）：返回缓存画布
const SILTEX = new Map();
export function silhouetteFill(id, sub, maxDim, color, tex, texAlpha = 1) {
  const k = `${id}|${sub}|${maxDim}|${color}|${tex.width}x${tex.height}|${texAlpha}`;
  let cv = SILTEX.get(k);
  if (cv) return cv;
  const base = silhouette(id, sub, maxDim, color);
  cv = newCanvas(base.width, base.height);
  const c = cv.getContext('2d');
  c.drawImage(base, 0, 0);
  c.globalCompositeOperation = 'source-atop';
  c.globalAlpha = texAlpha;
  c.drawImage(tex, 0, 0, base.width, base.height);
  SILTEX.set(k, cv);
  return cv;
}
