// 第六轮镜头公用：相机下的纸面网格、远景虚化 HUD 拼贴、近景虚化装饰、拍头推镜、CRT 显示器（视觉方案 §4.14）
import { W, H, BEAT, BRAND } from '../core/const.js';
import { decay, clamp, lerp, barStart, smooth } from '../core/time.js';
import { rnd, hash } from '../core/rand.js';
import { css, mix } from '../core/color.js';
import { rrect } from '../core/ui.js';
import { fonts, capMid } from '../core/glyphs.js';
import { corners } from '../core/kit.js';
import { withCam, blurLayer } from '../core/cam.js';
import { hudCluster, ringScanner, targetLock, ecgStrip, ruler, dataColumn, hexPatch } from '../core/hudkit.js';

// 纸面网格的格子 [宽, 高]。第二十五轮（用户：02:22 背景网格改成正方形比例，后面的也同样）：第三段进场（90 小节）起到片尾是 48 × 48 的方格
// （和封面同一种）；前两段是按字符格比例的 48 × 80 竖长方格（第二十七轮并开关 grid25）
export const gridStep = t => (t >= barStart(90) ? [48, 48] : [48, 80]);

// 第九轮（video-shotcraft 审美准则 R4）：作用于整画面 / 相机的节拍冲击（推镜泵、震屏、整屏闪）全片 ≤3 处，
// 只留给最强的几拍（前两分钟只有 14.47 秒的落点）；其余拍点只动元素层。这一轮只改前两分钟（Bad Apple 之前）。
// 返回 0 = 这一刻不许整画面冲击，1 = 照旧
export const camBeat = S => (S.t < barStart(74) ? 0 : 1);

// 第九轮（用户：25 / 29 / 32 秒主体四周不够空，框贴着画面边）：这几个镜头的相机整体退 12%，内容四周留出约 100 px。
// 只乘在 zoom 上，相机对准的点不变
export const safeZoom = () => 0.88;

// 第九轮（用户：公式框都要动起来）：静止的公式框统一加两件事——卡片出现时公式写出来（write），之后每四拍一道扫光从左到右扫过（sweep）。
// 返回要并进 drawFormula 参数的对象；age 是卡片出现后的秒数
export const formulaFx = (S, age, { every = 4, color = BRAND } = {}) =>
  ({ write: age, dur: 0.45, sweep: { u: ((((S.n % every) + every) % every) / every) * 1.6 - 0.3, color } });

// 拍头推镜：返回缩放倍数（1 + amt，按 k 衰减）
// 第八轮（用户：拍头的缩放和闪太多）：全片统一减半；第九轮：前两分钟去掉（camBeat）
// 第十一轮（用户：把第九轮去掉的拍头推镜放回来一部分）：前两分钟每小节第 1、3 拍放回推镜，幅度是第八轮的 60%；第 2、4 拍不推。
// 闪和震屏仍然不放（camBeat 还是 0）。rev beats
export const pulseK = S => (S.t < barStart(74) ? (S.beat % 2 === 1 ? 0.6 : 0) : camBeat(S));
export const punch = (S, amt = 0.035, k = 9) => 1 + pulseK(S) * 0.5 * amt * decay(S.sub * BEAT, k);

// 纸面：底色 + 随相机移动的网格（深度 depth，比主平面慢，带出景深感）
export function paper(ctx, S, cam = null, { depth = 0.4, grid = true } = {}) {
  const p = S.pal;
  ctx.fillStyle = p.bg; ctx.fillRect(0, 0, W, H);
  if (!grid) return;
  const c = cam || { x: 0, y: 0, zoom: 1, rot: 0 };
  withCam(ctx, c, depth, g => {
    g.fillStyle = p.grid;
    const [gx, gy] = gridStep(S.t), x0 = Math.floor((c.x * depth - W) / gx) * gx, y0 = Math.floor((c.y * depth - H) / gy) * gy;
    for (let x = x0; x < x0 + 3 * W; x += gx) g.fillRect(x, y0, 1, 3 * H);
    for (let y = y0; y < y0 + 3 * H; y += gy) g.fillRect(x0, y, 3 * W, 1);
  });
}

// 远景：几团虚化的 HUD 拼贴，深度 depth，模糊 blur
export function backDeco(ctx, S, cam, seed, { depth = 0.55, blur = 5, alpha = 0.55, density = 0.9, slot = 7, boxes = null } = {}) {
  const bx = boxes || [[60, 60, 700, 360], [1160, 640, 700, 360], [1240, 80, 560, 300], [120, 680, 560, 320]];
  blurLayer(ctx, blur, c => withCam(c, cam, depth, g => {
    bx.forEach((b, i) => hudCluster(g, S, seed * 13 + i, b[0], b[1], b[2], b[3], { density, scale: 1.2 }));
  }), { slot, alpha });
}

// 近景：画面边缘几个大号虚化部件（扫描环、心电图、刻度），比主平面动得多，制造前景虚焦
export function frontDeco(ctx, S, cam, seed, { depth = 1.6, blur = 7, alpha = 0.7, slot = 8, items = null } = {}) {
  const it = items || [['ring', -40, 900, 260], ['ecg', 1500, -20, 520], ['hex', 1700, 820, 30]];
  blurLayer(ctx, blur, c => withCam(c, cam, depth, g => {
    for (const [k, x, y, s] of it) {
      if (k === 'ring') ringScanner(g, S, x, y, s, { seed: seed + x });
      else if (k === 'ecg') ecgStrip(g, S, x, y, s, s * 0.3, { lw: 6, grid: false });
      else if (k === 'hex') hexPatch(g, S, x, y, 6, 5, s, { seed });
      else if (k === 'ruler') ruler(g, S, x, y, s, { vertical: true });
      else if (k === 'data') dataColumn(g, S, x, y, 8, { size: 22, seed });
    }
  }), { slot, alpha });
}

// ---------------------------------------------------------------- 对话窗口（像素坐标版，第七轮；前奏用的是网格版 intro.drawWindow）

// DeepSeek 对话窗口：白底圆角 + 标题栏（像素鲸鱼 + DeepSeek）+ 可选侧栏（新对话按钮、历史列表）+ 输入框。
// o.thin 御姐音的 1 px 细线 · o.sidebar 侧栏 · o.history 侧栏里的条目（[] 时显示「暂无对话」）· o.placeholder 输入框占位字
// o.input 输入框里的字（有它就不显示占位字）· o.caret 光标是否亮 · o.alpha · o.title
// 返回 { msg: [x, y, w, h] 消息区, input: [x, y, w, h], send: [cx, cy] }
export function chatWin(ctx, S, x, y, w, h, o = {}) {
  const p = S.pal, lw = o.thin ? 1.2 : 2, side = o.sidebar ? Math.min(280, w * 0.26) : 0, bar = 52, ih = o.inputH ?? 112, pad = 22;
  ctx.save();
  ctx.globalAlpha *= o.alpha ?? 1;
  ctx.fillStyle = css(p.shadow, p.shadowA); rrect(ctx, x + 6, y + 8, w, h, 16); ctx.fill();
  ctx.fillStyle = p.win; rrect(ctx, x, y, w, h, 16); ctx.fill();
  ctx.lineWidth = lw; ctx.strokeStyle = p.winEdge; ctx.stroke();
  // 标题栏
  ctx.beginPath(); ctx.moveTo(x, y + bar); ctx.lineTo(x + w, y + bar); ctx.stroke();
  drawSpriteLite(ctx, S, x + 30, y + bar / 2);
  ctx.font = fonts(20, 'SCB'); ctx.fillStyle = p.text; ctx.textBaseline = 'middle';
  ctx.fillText(o.title ?? 'DeepSeek', x + 58, y + bar / 2 + 1);
  ctx.fillStyle = p.gray; ctx.fillText('· · ·', x + w - 64, y + bar / 2 + 1);
  // 侧栏
  if (side) {
    ctx.fillStyle = css(p.tint[3], 0.6); ctx.fillRect(x + 1, y + bar + 1, side, h - bar - 2);
    ctx.strokeStyle = p.winEdge; ctx.beginPath(); ctx.moveTo(x + side, y + bar); ctx.lineTo(x + side, y + h); ctx.stroke();
    ctx.strokeStyle = BRAND; ctx.lineWidth = lw; rrect(ctx, x + 18, y + bar + 18, side - 36, 40, 20); ctx.stroke();
    ctx.font = fonts(18, 'SC'); ctx.fillStyle = BRAND; ctx.fillText('＋ 开启新对话', x + 36, y + bar + 39);
    const hist = o.history ?? [];
    ctx.font = fonts(15, 'SC'); ctx.fillStyle = p.gray; ctx.fillText(hist.length ? '今天' : '', x + 22, y + bar + 86);
    if (!hist.length) { ctx.textAlign = 'center'; ctx.fillText('暂无对话', x + side / 2, y + bar + 160); ctx.textAlign = 'left'; }
    hist.forEach((s, i) => { ctx.font = fonts(17, 'SC'); ctx.fillStyle = i === 0 ? p.text : p.gray; ctx.fillText(s, x + 22, y + bar + 118 + i * 38); });
  }
  // 输入框
  const ix = x + side + pad, iy = y + h - ih - pad, iw = w - side - 2 * pad;
  ctx.lineWidth = lw; ctx.strokeStyle = p.winEdge; ctx.fillStyle = '#FFFFFF';
  rrect(ctx, ix, iy, iw, ih, 20); ctx.fill(); ctx.stroke();
  ctx.font = fonts(20, 'SC');
  if (o.input) { ctx.fillStyle = p.text; ctx.fillText(o.input, ix + 22, iy + 32); }
  else { ctx.fillStyle = p.gray; ctx.fillText(o.placeholder ?? '给 DeepSeek 发送消息', ix + 22, iy + 32); }
  if (o.caret) { const cw = o.input ? ctx.measureText(o.input).width : 0; ctx.fillStyle = BRAND; ctx.fillRect(ix + 22 + cw + 2, iy + 18, 3, 26); }
  const send = [ix + iw - 34, iy + ih - 30];
  ctx.textBaseline = 'alphabetic';
  inputChips(ctx, S, ix + 18, iy + ih - 46, 32, false, { lw });
  ctx.fillStyle = o.input ? BRAND : p.winEdge; ctx.beginPath(); ctx.arc(send[0], send[1], 17, 0, Math.PI * 2); ctx.fill();
  sendArrow(ctx, send[0], send[1], 17 / 15);
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
  return { msg: [x + side + pad, y + bar + pad, w - side - 2 * pad, h - bar - ih - 3 * pad], input: [ix, iy, iw, ih], send };
}
// 第十二轮（用户：「深度思考」「联网搜索」在胶囊里偏右、字距太宽；发送键的 ↑ 太细太长、没居中）：
// 输入框下面的两个胶囊按字的实际宽度排（左右内边距相等、正常字距），前面各一个小图标；箭头用线画，粗、短、按圆心对齐。rev intro12
export function inputChips(ctx, S, x, y, h, lit, { lw = 2, size = 16 } = {}) {
  const p = S.pal, padL = 10, padR = 13, ic = h * 0.42, gap = 6;
  ctx.save();
  ctx.font = fonts(size, 'SC'); ctx.textBaseline = 'alphabetic';
  let cx = x;
  for (const [k, s] of [[0, '深度思考'], [1, '联网搜索']]) {
    const on = lit && k === 0, tw = ctx.measureText(s).width, w = padL + ic + gap + tw + padR;
    ctx.fillStyle = on ? BRAND : '#FFFFFF'; rrect(ctx, cx, y, w, h, h / 2); ctx.fill();
    if (!on) { ctx.strokeStyle = p.winEdge; ctx.lineWidth = lw; ctx.stroke(); }
    const col = on ? '#FFFFFF' : p.gray, icx = cx + padL + ic / 2, icy = y + h / 2;
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 1.6;
    if (k === 0) { ctx.beginPath(); ctx.arc(icx, icy, ic / 2, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(icx, icy, ic / 5, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.beginPath(); ctx.arc(icx, icy, ic / 2, 0, Math.PI * 2); ctx.moveTo(icx - ic / 2, icy); ctx.lineTo(icx + ic / 2, icy); ctx.stroke(); ctx.beginPath(); ctx.ellipse(icx, icy, ic / 4.5, ic / 2, 0, 0, Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = col; ctx.fillText(s, cx + padL + ic + gap, y + h / 2 + capMid(ctx));
    cx += w + 10;
  }
  ctx.restore();
  return cx - x;
}
export function sendArrow(ctx, x, y, s = 1, color = '#FFFFFF') {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = 3.2 * s; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x, y + 6 * s); ctx.lineTo(x, y - 6 * s);
  ctx.moveTo(x - 5.5 * s, y - 0.5 * s); ctx.lineTo(x, y - 6 * s); ctx.lineTo(x + 5.5 * s, y - 0.5 * s); ctx.stroke();
  ctx.restore();
}

// 标题栏的小鲸鱼（像素，品牌蓝）
function drawSpriteLite(ctx, S, cx, cy) {
  const rows = ['..........#...#.', '...........###..', '....#####...#...', '..#########.#...', '.############...', '#o###########...', '##############..', '.#############..', '..##########....', '....######......'];
  const px = 2, x0 = cx - 16, y0 = cy - 10;
  ctx.fillStyle = BRAND;
  rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === '#') ctx.fillRect(x0 + i * px, y0 + j * px, px, px); });
}

// 整句 / 关键词大字（第七轮）：每个字按唱到的时刻出现。o.font 字体键 · o.size · o.color · o.stroke 白描边宽
// place(i, age, ch) 可选，返回 { dx, dy, s, r, a } 叠加在默认排版上
// 第十五轮（用户：歌词文字出现的时候先短暂是蓝色、再变回当前的深色——常见的动画细节）：出现后 hold 秒是 flash 色，
// 再用 fade 秒（smooth）过渡回 base。age < 0 返回 base
export function inkFlash(age, base, { flash = BRAND, hold = 0.1, fade = 0.3 } = {}) {
  if (age < 0 || age >= hold + fade) return base;
  return age < hold ? flash : mix(flash, base, smooth(clamp((age - hold) / fade)));
}
export function bigLine(ctx, S, chars, x, y, { size = 120, keys = ['MIN', 'J'], color = BRAND, stroke = 10, gap = 0.04, align = 'c', place = null } = {}) {
  ctx.save();
  ctx.font = fonts(size, ...keys); ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  const ws = chars.map(c => ctx.measureText(c.c).width + size * gap), total = ws.reduce((a, b) => a + b, 0);
  let cx = align === 'c' ? x - total / 2 : x;
  chars.forEach((c, i) => {
    const age = S.t - c.t0, q = place ? place(i, age, c) : (age < 0 ? null : {});
    if (q) {
      ctx.save(); ctx.globalAlpha *= q.a ?? 1;
      ctx.translate(cx + ws[i] / 2 + (q.dx ?? 0), y + (q.dy ?? 0)); if (q.r) ctx.rotate(q.r); if (q.s !== undefined) ctx.scale(q.s, q.s);
      ctx.textAlign = 'center';
      if (stroke) { ctx.lineWidth = stroke; ctx.strokeStyle = '#FFFFFF'; ctx.strokeText(c.c, 0, 0); }
      ctx.fillStyle = q.color ?? color; ctx.fillText(c.c, 0, 0);
      ctx.restore();
    }
    cx += ws[i];
  });
  ctx.restore();
  return total;
}

// 词元条（第八轮，受 world.search(you) 的 stdin 行启发，做成本片的贴纸样式）：一句歌词唱到的字依次进一个个圆角小框，
// 框上是 token id（演出值，由字的哈希得出），框下一条细线随字长出。(x, y) 左上角
export function tokenStrip(ctx, S, chars, x, y, { size = 34, label = 'stdin', alpha = 1 } = {}) {
  const p = S.pal;
  ctx.save(); ctx.globalAlpha *= alpha;
  ctx.font = fonts(15, 'ZENB', 'SCB'); ctx.fillStyle = p.gray; ctx.fillText(label, x, y - 8);
  let cx = x;
  chars.forEach((c, i) => {
    const age = S.t - c.t0;
    ctx.font = fonts(size, 'ZEN', 'J'); const w = ctx.measureText(c.c).width + 18;
    if (age >= 0) {
      const e = easeOutBackLite(Math.min(1, age / 0.12));
      ctx.save(); ctx.translate(cx + w / 2, y + size * 0.7); ctx.scale(e, e);
      ctx.fillStyle = '#FFFFFF'; rrect(ctx, -w / 2, -size * 0.7, w, size * 1.4, 8); ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = age < 0.3 ? BRAND : p.line; ctx.stroke();
      ctx.fillStyle = p.text; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(c.c, 0, 2);
      ctx.restore();
      ctx.font = fonts(11, 'SC'); ctx.fillStyle = p.gray; ctx.fillText(String(10000 + (hash(c.c.charCodeAt(0), i) % 90000)), cx + 2, y + size * 1.6 + 12);
    } else { ctx.strokeStyle = css(p.line, 0.3); ctx.lineWidth = 1; ctx.setLineDash([3, 4]); rrect(ctx, cx, y, w, size * 1.4, 8); ctx.stroke(); ctx.setLineDash([]); }
    cx += w + 6;
  });
  ctx.restore();
  return cx - x;
}
const easeOutBackLite = u => { const s = 1.6; u -= 1; return u * u * ((s + 1) * u + s) + 1; };

// ---------------------------------------------------------------- 显示器（致敬原版 MV 的 CRT，第七轮改成本片的科技风）
// 用户 2026-10-07：黄白条纹太像原版、和本片风格不搭。改成切角的白色机身 + 品牌蓝双线 + 深色屏框 + 刻度、指示灯、
// 全息投影底座；颜色只用本片调色板。前奏（14 秒）和尾奏结尾共用

// 显示器屏幕在画面里的位置：中心 (cx, cy)、屏幕宽 sw（16:9）。返回 { screen: [x, y, w, h], body: [...], pad }
export function crtGeometry(cx, cy, sw) {
  const sh = sw * 9 / 16, pad = sw * 0.06, bw = sw + pad * 2, bh = sh + pad * 2.3;
  const bx = cx - bw / 2, by = cy - sh / 2 - pad;
  return { screen: [cx - sw / 2, cy - sh / 2, sw, sh], body: [bx, by, bw, bh], pad };
}

// 切角矩形路径（c = 切角大小）
function chamfer(ctx, x, y, w, h, c) {
  ctx.moveTo(x + c, y); ctx.lineTo(x + w - c, y); ctx.lineTo(x + w, y + c); ctx.lineTo(x + w, y + h - c);
  ctx.lineTo(x + w - c, y + h); ctx.lineTo(x + c, y + h); ctx.lineTo(x, y + h - c); ctx.lineTo(x, y + c); ctx.closePath();
}

// 机身 + 屏框 + 装饰。屏幕区域留空（调用方先把画面画进 screen 再调这个）。o.alpha · o.label 顶部标签
// 第九轮去掉了底座的光束和实心椭圆（尾奏的显示器也用这个函数，一起变）
export function drawCRT(ctx, S, cx, cy, sw, { alpha = 1, label = 'DS-LINK · CH.01' } = {}) {
  const g = crtGeometry(cx, cy, sw), [bx, by, bw, bh] = g.body, [x, y, w, h] = g.screen, pad = g.pad, p = S.pal;
  const k = sw / 1040, lw = Math.max(2, 4 * k), kick = decay(S.sub * BEAT, 8), cut = pad * 1.3;
  ctx.save();
  ctx.globalAlpha *= alpha;
  // 全息投影底座：几圈虚线椭圆在转，光束往上照到机身
  // 第九轮（用户：中间那块半透明的蓝去掉）：不再画光束梯形和底座中心的实心椭圆，只留虚线圈和光点
  const baseY = by + bh + pad * 1.9, rx = bw * 0.36, ry = pad * 0.55;
  ctx.strokeStyle = BRAND; ctx.lineWidth = lw * 0.7;
  for (let i = 0; i < 3; i++) {
    ctx.setLineDash([12 * k, 10 * k]); ctx.lineDashOffset = (i % 2 ? 1 : -1) * S.t * 60 * k;
    ctx.globalAlpha = alpha * (0.85 - i * 0.25);
    ctx.beginPath(); ctx.ellipse(cx, baseY, rx * (1 + i * 0.16), ry * (1 + i * 0.16), 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.setLineDash([]); ctx.globalAlpha = alpha;
  for (let i = 0; i < 9; i++) { // 光束里往上飘的光点
    const u = ((S.t * 0.8 + i / 9) % 1), px = cx + (rnd(i, 3) - 0.5) * bw * 0.7 * (1 - u * 0.2);
    ctx.fillStyle = css(BRAND, 0.6 * (1 - u)); ctx.fillRect(px, lerp(baseY, by + bh, u), 3 * k + 1, 3 * k + 1);
  }
  // 机身：切角白壳（挖掉屏幕）+ 硬投影
  // 第九轮：投影以前连屏幕一起盖了一层半透明的蓝（用户说的"屏幕中间的半透明蓝块"），现在投影也挖掉屏幕
  ctx.fillStyle = css(p.line, 0.28);
  ctx.beginPath(); chamfer(ctx, bx + 9 * k, by + 11 * k, bw, bh, cut);
  ctx.rect(x, y, w, h); ctx.fill('evenodd');
  ctx.save();
  ctx.beginPath(); chamfer(ctx, bx, by, bw, bh, cut); ctx.rect(x, y, w, h); ctx.clip('evenodd');
  const body = ctx.createLinearGradient(0, by, 0, by + bh);
  body.addColorStop(0, '#FFFFFF'); body.addColorStop(1, p.tint[3]);
  ctx.fillStyle = body; ctx.fillRect(bx, by, bw, bh);
  // 下巴：一条浅色带 + 分段电平灯（跟人声频谱）+ 文字
  const chinY = y + h + pad * 0.35, chinH = bh - (chinY - by) - pad * 0.3;
  ctx.fillStyle = p.tint[3]; ctx.fillRect(bx + cut, chinY, bw - 2 * cut, chinH);
  const segs = 16, sx0 = cx - bw * 0.18, segW = (bw * 0.36) / segs, f = S.f;
  for (let i = 0; i < segs; i++) {
    const on = i / segs < clamp(0.25 + f.rms * 0.9 + 0.3 * kick);
    ctx.fillStyle = on ? (i > segs * 0.8 ? p.acc[0] : BRAND) : css(p.line, 0.3);
    ctx.fillRect(sx0 + i * segW + 1, chinY + chinH * 0.32, segW - 3 * k, chinH * 0.36);
  }
  ctx.font = fonts(Math.max(10, Math.round(15 * k)), 'ZENB', 'SCB'); ctx.textBaseline = 'middle';
  ctx.fillStyle = p.gray; ctx.fillText('1920×1080 · 60 Hz · 150 BPM', bx + cut + 6 * k, chinY + chinH / 2);
  ctx.fillStyle = S.sub < 0.5 ? p.acc[0] : css(p.acc[0], 0.3);
  ctx.beginPath(); ctx.arc(bx + bw - cut - 70 * k, chinY + chinH / 2, 6 * k + 1, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = p.text; ctx.fillText('LIVE', bx + bw - cut - 58 * k, chinY + chinH / 2);
  // 两侧边框上的刻度
  ctx.strokeStyle = css(p.line, 0.8); ctx.lineWidth = Math.max(1, 1.5 * k); ctx.beginPath();
  for (let i = 0; i <= 24; i++) {
    const yy = y + (h * i) / 24, l = (i % 4 === 0 ? 14 : 7) * k;
    ctx.moveTo(bx + pad * 0.25, yy); ctx.lineTo(bx + pad * 0.25 + l, yy);
    ctx.moveTo(bx + bw - pad * 0.25, yy); ctx.lineTo(bx + bw - pad * 0.25 - l, yy);
  }
  ctx.stroke();
  ctx.restore();
  // 外框：品牌蓝粗线 + 内侧细线；切角上的小三角
  ctx.lineJoin = 'round'; ctx.strokeStyle = BRAND; ctx.lineWidth = lw;
  ctx.beginPath(); chamfer(ctx, bx, by, bw, bh, cut); ctx.stroke();
  ctx.strokeStyle = css(p.line, 0.55); ctx.lineWidth = Math.max(1, 2 * k);
  ctx.beginPath(); chamfer(ctx, bx + 9 * k, by + 9 * k, bw - 18 * k, bh - 18 * k, cut * 0.8); ctx.stroke();
  ctx.fillStyle = BRAND;
  for (const [px, py, sx, sy] of [[bx, by, 1, 1], [bx + bw, by, -1, 1], [bx, by + bh, 1, -1], [bx + bw, by + bh, -1, -1]]) {
    ctx.beginPath(); ctx.moveTo(px + sx * cut * 0.25, py + sy * cut * 0.85); ctx.lineTo(px + sx * cut * 0.85, py + sy * cut * 0.25); ctx.lineTo(px + sx * cut * 0.25, py + sy * cut * 0.25); ctx.closePath(); ctx.fill();
  }
  // 屏框：深色细框 + 四角蓝色直角
  ctx.strokeStyle = '#141A3A'; ctx.lineWidth = Math.max(2, 3 * k);
  ctx.strokeRect(x - 1.5 * k, y - 1.5 * k, w + 3 * k, h + 3 * k);
  corners(ctx, x + 10 * k, y + 10 * k, w - 20 * k, h - 20 * k, css(BRAND, 0.9), { len: 26 * k, lw: Math.max(2, 3 * k), plus: false });
  // 屏幕玻璃：扫描线 + 左上角斜向高光
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = 'rgba(20,26,58,0.05)';
  for (let yy = y; yy < y + h; yy += Math.max(2, 3 * k)) ctx.fillRect(x, yy, w, 1);
  const gl = ctx.createLinearGradient(x, y, x + w * 0.5, y + h);
  gl.addColorStop(0, 'rgba(255,255,255,0.16)'); gl.addColorStop(0.35, 'rgba(255,255,255,0)');
  ctx.fillStyle = gl; ctx.fillRect(x, y, w, h);
  ctx.restore();
  // 顶部标签片
  if (label) {
    ctx.font = fonts(Math.max(10, Math.round(17 * k)), 'ZENB', 'SCB');
    const tw = ctx.measureText(label).width + 30 * k, th = 26 * k;
    ctx.fillStyle = BRAND; rrect(ctx, cx - tw / 2, by - th / 2, tw, th, th / 2); ctx.fill();
    ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, cx, by + 1); ctx.textAlign = 'left';
  }
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
  return g;
}
