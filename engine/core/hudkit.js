// 科幻 HUD 小部件与拼贴（视觉方案 §4.13b，第六轮）：扫描环、刻度尺、心电图、锁定框、数据列、分段条、蜂窝、轨道点……
// 每个部件都随时间动（转、跳、滚、闪），参数里的 S 用来取时间、拍、调色板。hudCluster 把它们不规则地叠成一团
import { BAR0, BEAT, BRAND } from './const.js';
import { clamp, decay, easeOut, easeOutBack } from './time.js';
import { hash, rnd, vnoise } from './rand.js';
import { font, fonts, midText } from './glyphs.js';
import { css } from './color.js';
import { feat, vspec } from './data.js';
import { rrect } from './ui.js';

const TAU = Math.PI * 2;
const mono = px => fonts(px, 'SC');
const zen = px => fonts(px, 'ZENB', 'SCB');

// 心电图：每拍一次，R 波落在拍头后 8 ms。返回 −0.25..1
// k：波形宽度倍数（第十四轮 HUD 的扫描式心电图用 2.4，采样跟得上、尖峰不闪）
export function ecg(t, k = 1) {
  const n = (t - BAR0) / BEAT, p = (((n % 1) + 1.2) % 1);
  const g = (c, w, a) => a * Math.exp(-(((p - c) / (w * k)) ** 2));
  return g(0.10, 0.03, 0.12) + g(0.20, 0.008, -0.15) + g(0.22, 0.010, 1) + g(0.245, 0.010, -0.25) + g(0.45, 0.05, 0.25);
}

// 扫描环：外圈虚线慢转、中圈刻度反转、内圈三段弧快转、中心十字。拍头闪一下
export function ringScanner(ctx, S, cx, cy, r, { color = null, accent = null, alpha = 1, seed = 0 } = {}) {
  const p = S.pal, c = color || p.line, a = accent || BRAND, t = S.t, kick = decay(S.sub * BEAT, 9);
  ctx.save(); ctx.globalAlpha *= alpha; ctx.strokeStyle = c; ctx.lineCap = 'round';
  ctx.lineWidth = 2; ctx.setLineDash([6, 8]); ctx.lineDashOffset = -t * 30;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  const rot = -t * 0.6 + seed;
  for (let i = 0; i < 72; i++) {
    const ang = rot + (i / 72) * TAU, l = i % 6 === 0 ? 0.12 : 0.05;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(ang) * r * 0.86, cy + Math.sin(ang) * r * 0.86);
    ctx.lineTo(cx + Math.cos(ang) * r * (0.86 - l), cy + Math.sin(ang) * r * (0.86 - l)); ctx.stroke();
  }
  ctx.strokeStyle = a; ctx.lineWidth = 4 + 3 * kick;
  const fast = t * 2.4 + seed * 2;
  for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(cx, cy, r * 0.6, fast + (k * TAU) / 3, fast + (k * TAU) / 3 + 0.9); ctx.stroke(); }
  ctx.strokeStyle = c; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx - r * 0.2, cy); ctx.lineTo(cx + r * 0.2, cy); ctx.moveTo(cx, cy - r * 0.2); ctx.lineTo(cx, cy + r * 0.2); ctx.stroke();
  ctx.fillStyle = a; ctx.beginPath(); ctx.arc(cx + Math.cos(fast) * r * 0.6, cy + Math.sin(fast) * r * 0.6, 4 + 3 * kick, 0, TAU); ctx.fill();
  ctx.restore();
}

// 刻度尺：每拍滚一格，中间一个游标三角。vertical 竖排
export function ruler(ctx, S, x, y, len, { vertical = false, color = null, alpha = 1, step = 12, label = true } = {}) {
  const p = S.pal, c = color || p.line, off = ((S.n % 4) / 4) * step * 5;
  ctx.save(); ctx.globalAlpha *= alpha; ctx.strokeStyle = c; ctx.fillStyle = c; ctx.lineWidth = 2;
  ctx.beginPath();
  for (let d = -off; d < len; d += step) {
    if (d < 0) continue;
    const i = Math.round((d + off) / step), l = i % 5 === 0 ? 14 : 7;
    if (vertical) { ctx.moveTo(x, y + d); ctx.lineTo(x + l, y + d); } else { ctx.moveTo(x + d, y); ctx.lineTo(x + d, y + l); }
  }
  ctx.stroke();
  if (vertical) { ctx.moveTo(x, y); ctx.lineTo(x, y + len); } else { ctx.moveTo(x, y); ctx.lineTo(x + len, y); }
  ctx.stroke();
  const cur = len * (0.5 + 0.35 * Math.sin(S.t * 1.3));
  ctx.fillStyle = p.acc[0]; ctx.beginPath();
  if (vertical) { ctx.moveTo(x + 18, y + cur); ctx.lineTo(x + 28, y + cur - 6); ctx.lineTo(x + 28, y + cur + 6); }
  else { ctx.moveTo(x + cur, y + 18); ctx.lineTo(x + cur - 6, y + 28); ctx.lineTo(x + cur + 6, y + 28); }
  ctx.fill();
  if (label) { ctx.font = mono(13); ctx.fillStyle = c; const v = (S.t * 37.5).toFixed(1); vertical ? ctx.fillText(v, x + 32, y + cur + 4) : ctx.fillText(v, x + cur + 10, y + 40); }
  ctx.restore();
}

// 心电图条：最近 span 秒的波形，右端一个亮点
// 第十四轮（用户：右上角 BPM 旁的心电图跳得非常快，像 bug）：以前整条波形往左滚、按屏幕像素等间距取样（约 24 ms 一个点），
// 4 ms 宽的尖峰每帧被取到的高度都不一样，看起来一直在抽搐。o.sweep：改成监护仪那种扫描式——波形不动，一根写入头每 span 秒
// 从左扫到右，扫过的地方写上新的波形、前面留一小段空隙；每一列只在写入头经过时取一次样，形状稳定
export function ecgStrip(ctx, S, x, y, w, h, { color = BRAND, alpha = 1, span = 1.6, lw = 2.5, grid = true, sweep = false } = {}) {
  if (sweep) return ecgSweep(ctx, S, x, y, w, h, { color, alpha, span, lw });
  ctx.save(); ctx.globalAlpha *= alpha;
  if (grid) { ctx.strokeStyle = css(S.pal.line, 0.25); ctx.lineWidth = 1; ctx.beginPath(); for (let gx = 0; gx <= w; gx += w / 8) { ctx.moveTo(x + gx, y); ctx.lineTo(x + gx, y + h); } ctx.moveTo(x, y + h * 0.62); ctx.lineTo(x + w, y + h * 0.62); ctx.stroke(); }
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineJoin = 'round';
  ctx.beginPath();
  const n = Math.max(40, Math.round(w / 3));
  for (let i = 0; i <= n; i++) { const tt = S.t - span + (i / n) * span, X = x + (i / n) * w, Y = y + h * 0.62 - h * 0.55 * ecg(tt); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
  ctx.stroke();
  ctx.fillStyle = S.pal.acc[0]; ctx.beginPath(); ctx.arc(x + w, y + h * 0.62 - h * 0.55 * ecg(S.t), lw + 2, 0, TAU); ctx.fill();
  ctx.restore();
}

function ecgSweep(ctx, S, x, y, w, h, { color, alpha, span, lw }) {
  const N = Math.round(w), ph = ((S.t / span) % 1 + 1) % 1, head = ph * N, gap = 0.07 * N, base = y + h * 0.62;
  const val = i => { const back = ((head - i) / N + 1) % 1; return base - h * 0.55 * ecg(S.t - back * span, 2.4); };
  ctx.save(); ctx.globalAlpha *= alpha; ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineJoin = 'round';
  ctx.beginPath(); let pen = false;
  for (let i = 0; i <= N; i++) {
    const ahead = (i - head + N) % N; // 写入头前面的空隙不画
    if (ahead > 0 && ahead < gap) { pen = false; continue; }
    if (pen && i - 1 < head && i >= head) pen = false; // 写入头处断开（左边是新的、右边是上一圈的）
    const X = x + (i / N) * w, Y = val(i);
    if (pen) ctx.lineTo(X, Y); else { ctx.moveTo(X, Y); pen = true; }
  }
  ctx.stroke();
  ctx.fillStyle = S.pal.acc[0]; ctx.beginPath(); ctx.arc(x + ph * w, base - h * 0.55 * ecg(S.t, 2.4), lw + 2, 0, TAU); ctx.fill();
  ctx.restore();
}
// 锁定框：四个直角从 2 倍大小收拢到 1 倍，转 45°，附标签
// o.labelAt（第十二轮）：'side' 右上角外侧（默认，以前的位置）· 'top' 右上角正上方、右对齐角线 · 'in' 框内右上角
export function targetLock(ctx, S, cx, cy, size, age, { label = 'LOCK', color = null, alpha = 1, labelAt = 'side' } = {}) {
  if (age < 0) return;
  const p = S.pal, c = color || p.acc[0], e = easeOutBack(clamp(age / 0.25), 1.4), s = size * (2 - e), rot = (1 - e) * 0.8 + Math.sin(S.t * 2) * 0.03;
  ctx.save(); ctx.globalAlpha *= alpha * clamp(age / 0.08); ctx.translate(cx, cy); ctx.rotate(rot);
  ctx.strokeStyle = c; ctx.lineWidth = 4; ctx.lineCap = 'round';
  const L = s * 0.28;
  ctx.beginPath();
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { ctx.moveTo(sx * s / 2, sy * (s / 2 - L)); ctx.lineTo(sx * s / 2, sy * s / 2); ctx.lineTo(sx * (s / 2 - L), sy * s / 2); }
  ctx.stroke();
  ctx.rotate(-rot);
  if (label && e > 0.6) {
    ctx.font = zen(16); ctx.fillStyle = c; ctx.textAlign = 'left'; // 第十三轮：调用方留着 textAlign = 'center' 时标签会往左偏半个字宽（L17 的 SEARCH）
    if (labelAt === 'side') ctx.fillText(label, s / 2 + 8, -s / 2 + 12);
    else { const tw = ctx.measureText(label).width; ctx.fillText(label, s / 2 - tw - (labelAt === 'in' ? 10 : 0), labelAt === 'in' ? -s / 2 + 26 : -s / 2 - 12); }
  }
  ctx.restore();
}

// 数据列：一列滚动的十六进制 / 标签行（等宽小字）
const WORDS = ['tok', 'attn', 'kv', 'moe', 'fp8', 'rope', 'mtp', 'grpo', 'mla', 'seed', 'top_p', 'temp', 'ctx', 'logit'];
export function dataColumn(ctx, S, x, y, rows, { color = null, alpha = 1, seed = 0, size = 14, speed = 1 } = {}) {
  const c = color || S.pal.gray, line = Math.floor(S.n * 2 * speed);
  ctx.save(); ctx.globalAlpha *= alpha; ctx.font = mono(size); ctx.fillStyle = c;
  for (let r = 0; r < rows; r++) {
    const k = line + r, h = hash(k, seed, 3);
    const s = `${(h >>> 8).toString(16).padStart(6, '0').slice(0, 6)}  ${WORDS[h % WORDS.length].padEnd(5)} ${((h % 1000) / 1000).toFixed(3)}`;
    if (r === rows - 1) ctx.fillStyle = BRAND;
    ctx.fillText(s, x, y + r * size * 1.35);
  }
  ctx.restore();
}

// 分段进度条：n 段，前 v 比例点亮，拍头最后一段闪
export function segBar(ctx, S, x, y, w, n, v, { h = 10, color = null, alpha = 1 } = {}) {
  const p = S.pal, gap = 3, sw = (w - gap * (n - 1)) / n, lit = Math.round(clamp(v) * n);
  ctx.save(); ctx.globalAlpha *= alpha;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = i < lit ? (i === lit - 1 && S.sub < 0.25 ? p.acc[0] : color || BRAND) : css(p.line, 0.25);
    ctx.fillRect(x + i * (sw + gap), y, sw, h);
  }
  ctx.restore();
}

// 蜂窝格：描边六边形，每拍点亮几格
export function hexPatch(ctx, S, x, y, cols, rows, r, { color = null, alpha = 1, seed = 0 } = {}) {
  const p = S.pal, c = color || p.line, hw = r * Math.sqrt(3);
  ctx.save(); ctx.globalAlpha *= alpha; ctx.lineWidth = 1.5;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const cx = x + i * hw + (j % 2) * hw / 2, cy = y + j * r * 1.5;
    ctx.beginPath();
    for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + (k * TAU) / 6; k ? ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a)) : ctx.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a)); }
    ctx.closePath();
    if (rnd(i, j, S.ni, seed) < 0.12) { ctx.fillStyle = css(rnd(i, j, seed) < 0.5 ? BRAND : p.acc[0], 0.35); ctx.fill(); }
    ctx.strokeStyle = css(c, 0.6); ctx.stroke();
  }
  ctx.restore();
}

// 迷你频谱：人声频谱 n 根柱
export function miniSpectrum(ctx, S, x, y, w, h, { n = 16, color = BRAND, alpha = 1 } = {}) {
  const sp = vspec(S.t), bw = w / n;
  ctx.save(); ctx.globalAlpha *= alpha; ctx.fillStyle = color;
  for (let i = 0; i < n; i++) { const v = sp[Math.floor((i / n) * 32)], bh = 2 + v * h; ctx.fillRect(x + i * bw + 1, y + h - bh, bw - 2, bh); }
  ctx.restore();
}

// 轨道点：n 个点绕圆转
export function orbit(ctx, S, cx, cy, r, n, { color = null, alpha = 1, speed = 1 } = {}) {
  ctx.save(); ctx.globalAlpha *= alpha; ctx.fillStyle = color || S.pal.acc[0];
  for (let i = 0; i < n; i++) { const a = S.t * speed + (i / n) * TAU; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.4, 3 + (i === 0 ? 2 : 0), 0, TAU); ctx.fill(); }
  ctx.strokeStyle = css(S.pal.line, 0.4); ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.4, 0, 0, TAU); ctx.stroke();
  ctx.restore();
}

// 小标签：线框矩形 + 文字（如 SYS.01）
export function tag(ctx, S, x, y, text, { color = null, fill = null, alpha = 1, size = 14 } = {}) {
  ctx.save(); ctx.globalAlpha *= alpha; ctx.font = zen(size); ctx.textAlign = 'left'; // 第十三轮：不继承调用方的 textAlign（L17 的 NOT FOUND 偏左）
  const w = ctx.measureText(text).width + 14, h = size + 10, c = color || S.pal.line;
  if (fill) { ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); }
  ctx.strokeStyle = c; ctx.lineWidth = 1.5; ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = fill ? '#FFFFFF' : c;
  midText(ctx, text, x + 7, y + h / 2);
  ctx.restore();
  return w;
}

// 十字点阵
export function plusGrid(ctx, S, x, y, cols, rows, gap, { color = null, alpha = 1 } = {}) {
  ctx.save(); ctx.globalAlpha *= alpha; ctx.strokeStyle = color || S.pal.line; ctx.lineWidth = 1.5; ctx.beginPath();
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const cx = x + i * gap, cy = y + j * gap; ctx.moveTo(cx - 4, cy); ctx.lineTo(cx + 4, cy); ctx.moveTo(cx, cy - 4); ctx.lineTo(cx, cy + 4); }
  ctx.stroke(); ctx.restore();
}

// 弧形文字：沿圆弧排一圈小字，慢慢转
export function arcText(ctx, S, cx, cy, r, text, { color = null, alpha = 1, size = 13, speed = 0.3 } = {}) {
  ctx.save(); ctx.globalAlpha *= alpha; ctx.font = mono(size); ctx.fillStyle = color || S.pal.gray;
  const chars = [...text], step = (size * 0.62) / r;
  chars.forEach((ch, i) => {
    const a = S.t * speed + i * step;
    ctx.save(); ctx.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r); ctx.rotate(a + Math.PI / 2); ctx.fillText(ch, 0, 0); ctx.restore();
  });
  ctx.restore();
}

// 不规则 HUD 拼贴：在 (x, y, w, h) 里按 seed 挑几个部件，错落、旋转、重叠地摆，每个都在动
// o.density 0..1 部件多少；o.alpha；o.scale 整体缩放
export function hudCluster(ctx, S, seed, x, y, w, h, { density = 0.7, alpha = 1, scale = 1 } = {}) {
  const n = 3 + Math.round(density * 6);
  ctx.save(); ctx.globalAlpha *= alpha;
  for (let i = 0; i < n; i++) {
    const kind = hash(seed, i, 1) % 11, px = x + rnd(seed, i, 2) * w, py = y + rnd(seed, i, 3) * h;
    const s = scale * (0.7 + rnd(seed, i, 4) * 0.7), rot = (rnd(seed, i, 5) - 0.5) * 0.35, a = 0.55 + rnd(seed, i, 6) * 0.45;
    ctx.save(); ctx.translate(px, py); ctx.rotate(rot); ctx.scale(s, s);
    switch (kind) {
      case 0: ringScanner(ctx, S, 0, 0, 60, { alpha: a, seed: i }); break;
      case 1: ruler(ctx, S, -90, 0, 180, { alpha: a, vertical: rnd(seed, i, 7) < 0.4 }); break;
      case 2: ecgStrip(ctx, S, -90, -24, 180, 48, { alpha: a }); break;
      case 3: dataColumn(ctx, S, -80, -40, 6, { alpha: a, seed: seed * 7 + i }); break;
      case 4: segBar(ctx, S, -80, 0, 160, 12, vnoise(S.t * 0.7, seed, i), { alpha: a }); break;
      case 5: hexPatch(ctx, S, -60, -40, 5, 4, 14, { alpha: a, seed: i }); break;
      case 6: miniSpectrum(ctx, S, -70, -30, 140, 60, { alpha: a }); break;
      case 7: orbit(ctx, S, 0, 0, 70, 5, { alpha: a, speed: 0.8 + rnd(seed, i, 8) }); break;
      case 8: plusGrid(ctx, S, -60, -30, 6, 4, 24, { alpha: a }); break;
      case 9: tag(ctx, S, -40, -12, `${['SYS', 'NODE', 'CH', 'MOE', 'KV'][hash(seed, i) % 5]}.${String(hash(seed, i, 9) % 100).padStart(2, '0')}`, { alpha: a, fill: rnd(seed, i, 9) < 0.4 ? BRAND : null }); break;
      default: arcText(ctx, S, 0, 0, 56, 'DEEPSEEK · 150 BPM · SEED 114514 · ', { alpha: a });
    }
    ctx.restore();
  }
  ctx.restore();
}
