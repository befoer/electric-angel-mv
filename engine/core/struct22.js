// 密集的结构化图形（第二十二轮，用户：最后一段少女音整体效果不如前面，是因为少了你擅长做的密集型结构化的图形元素动画）。
// 和 hudkit.js 的小部件配合用，但不是随手撒一团：每块都"连在"画面里的某个东西上（引线从主体的角 / 边长出来），
// 进场有过程（引线画出来 → 四角张开 → 内容亮起），跟拍子有节奏（引线上每拍跑一个光点、刻度环每拍点亮一格）。
//   tickRing：一圈密刻度（可以一格一个单位，比如 150 格 = 150 BPM），扫描头随拍走、后面拖一段亮尾，外圈虚线反转
//   satellite：卫星面板——引线（折线）+ 四角框 + 标签 + 内容（ring / bars / data / hex / spec / ecg / ruler）
import { BEAT, BRAND } from './const.js';
import { clamp, decay, easeOut, smooth } from './time.js';
import { rnd } from './rand.js';
import { fonts } from './glyphs.js';
import { css } from './color.js';
import { ringScanner, ruler, ecgStrip, dataColumn, segBar, hexPatch, miniSpectrum, tag } from './hudkit.js';

const TAU = Math.PI * 2;

// 一圈密刻度。o：n 格数、age 进场时间（刻度按角度依次长出来，0.5 s）、lit 0..1 前多少比例常亮、color、accent、alpha、speed 整圈转速、labels [[角度比例, 字]]
export function tickRing(g, S, cx, cy, r, o = {}) {
  const n = o.n ?? 120, age = o.age ?? 9, col = o.color ?? S.pal.line, acc = o.accent ?? BRAND, t = S.t, rot = -Math.PI / 2 + (o.speed ?? 0.05) * t;
  const grow = clamp(age / 0.5), beats = (t - (o.t0 ?? 0)) / BEAT, head = ((beats % n) + n) % n, kick = decay(S.sub * BEAT, 8);
  g.save(); g.globalAlpha *= o.alpha ?? 1; g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    if (i / n > grow) break;
    const ang = rot + (i / n) * TAU, major = i % 5 === 0, behind = (head - i + n) % n, tail = behind < 12 ? 1 - behind / 12 : 0;
    const on = (o.lit ?? 0) * n > i, len = (major ? 18 : 9) + 10 * tail + (on ? 4 : 0);
    g.strokeStyle = tail > 0 || on ? acc : col; g.globalAlpha = (o.alpha ?? 1) * (tail > 0 ? 0.35 + 0.65 * tail : on ? 0.8 : 0.45);
    g.lineWidth = major ? 2.5 : 1.5;
    g.beginPath(); g.moveTo(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r); g.lineTo(cx + Math.cos(ang) * (r - len), cy + Math.sin(ang) * (r - len)); g.stroke();
  }
  g.globalAlpha = (o.alpha ?? 1) * 0.6 * grow; g.strokeStyle = col; g.lineWidth = 1.5;
  g.setLineDash([4, 10]); g.lineDashOffset = t * 24; g.beginPath(); g.arc(cx, cy, r + 14, 0, TAU); g.stroke(); g.setLineDash([]);
  // 四段括号弧：拍头往外弹一下
  g.strokeStyle = acc; g.lineWidth = 3; g.globalAlpha = (o.alpha ?? 1) * 0.8 * grow;
  for (let k = 0; k < 4; k++) { const a0 = -rot * 0.6 + (k * TAU) / 4; g.beginPath(); g.arc(cx, cy, r + 26 + 6 * kick, a0, a0 + 0.35); g.stroke(); }
  if (o.labels) {
    g.font = fonts(13, 'JB'); g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const [f, s] of o.labels) { if (f > grow) continue; const ang = rot + f * TAU; g.globalAlpha = (o.alpha ?? 1) * 0.8; g.fillText(s, cx + Math.cos(ang) * (r - 34), cy + Math.sin(ang) * (r - 34)); }
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  }
  g.restore();
}

// 卫星面板。o：x y w h（面板）、anchor [ax, ay]（引线起点：主体的角或边）、title、kind、age（进场时间）、seed、color、accent、alpha、value（0..1，给 bars / ring）、text（大读数）
export function satellite(g, S, o) {
  const t = S.t, age = o.age ?? 9, al = o.alpha ?? 1;
  if (age <= 0 || al <= 0.01) return;
  const col = o.color ?? S.pal.line, acc = o.accent ?? BRAND, { x, y, w, h } = o, [ax, ay] = o.anchor;
  // 引线：主体 → 面板最近的一边（先横后竖的折线）
  const px = ax < x ? x : ax > x + w ? x + w : x + w / 2, py = ay < y ? y : ay > y + h ? y + h : y + h / 2, mx = px;
  const L1 = Math.abs(mx - ax), L2 = Math.abs(py - ay), L = L1 + L2 || 1, d = easeOut(clamp(age / 0.3)) * L;
  g.save(); g.globalAlpha *= al; g.strokeStyle = acc; g.lineWidth = 1.5; g.setLineDash([]);
  g.beginPath(); g.moveTo(ax, ay);
  if (d <= L1) g.lineTo(ax + Math.sign(mx - ax) * d, ay); else { g.lineTo(mx, ay); g.lineTo(mx, ay + Math.sign(py - ay) * (d - L1)); }
  g.stroke();
  g.fillStyle = acc; g.beginPath(); g.arc(ax, ay, 4, 0, TAU); g.fill();
  g.strokeStyle = acc; g.lineWidth = 1.5; g.beginPath(); g.arc(ax, ay, 9 + 4 * decay(S.sub * BEAT, 8), 0, TAU); g.stroke();
  if (age > 0.3) { // 每拍一个光点沿引线跑到面板
    const f = clamp((S.sub * BEAT) / 0.25), s = f * L, [qx, qy] = s <= L1 ? [ax + Math.sign(mx - ax) * s, ay] : [mx, ay + Math.sign(py - ay) * (s - L1)];
    if (f < 1) { g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(qx, qy, 4, 0, TAU); g.fill(); g.strokeStyle = acc; g.lineWidth = 2; g.stroke(); }
  }
  // 四角框：从中心张开
  const e = easeOut(clamp((age - 0.2) / 0.25)), cw = (w / 2) * e, ch = (h / 2) * e, cx = x + w / 2, cy = y + h / 2, k = 14;
  if (e > 0) {
    g.fillStyle = css('#FFFFFF', 0.55 * e); g.fillRect(cx - cw, cy - ch, cw * 2, ch * 2);
    g.strokeStyle = acc; g.lineWidth = 2.5;
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const qx = cx + sx * cw, qy = cy + sy * ch; g.beginPath(); g.moveTo(qx, qy - sy * k); g.lineTo(qx, qy); g.lineTo(qx - sx * k, qy); g.stroke(); }
    g.strokeStyle = css(col, 0.5); g.lineWidth = 1; g.strokeRect(cx - cw, cy - ch, cw * 2, ch * 2);
  }
  const ca = smooth(clamp((age - 0.4) / 0.25));
  if (ca > 0) {
    g.globalAlpha = al * ca;
    if (o.title) tag(g, S, x + 10, y - 12, o.title, { color: '#FFFFFF', fill: acc, size: 13 });
    const ix = x + 14, iy = y + 22, iw = w - 28, ih = h - 34, seed = o.seed ?? 0;
    switch (o.kind) {
      case 'ring': ringScanner(g, S, ix + ih / 2, iy + ih / 2, ih / 2 - 4, { accent: acc, seed }); break;
      case 'bars': for (let r = 0; r < 4; r++) { const v = clamp((o.value ?? 0.6) * (0.7 + 0.5 * rnd(seed, r, 7)) + 0.08 * Math.sin(t * 3 + r)); g.font = fonts(12, 'JB'); g.fillStyle = col; g.fillText(`${o.rows?.[r] ?? 'ch' + r}`, ix, iy + 10 + r * (ih / 4)); segBar(g, S, ix + 64, iy + 4 + r * (ih / 4), iw - 64, 16, v, { h: 8, color: acc }); } break;
      case 'data': dataColumn(g, S, ix, iy + 6, Math.floor(ih / 18), { seed, size: 13, speed: 1.5 }); dataColumn(g, S, ix + iw / 2, iy + 6, Math.floor(ih / 18), { seed: seed + 3, size: 13, speed: 2.2 }); break;
      case 'hex': hexPatch(g, S, ix + 8, iy + 8, Math.floor(iw / 26), Math.floor(ih / 24), 13, { seed, color: acc }); break;
      case 'spec': miniSpectrum(g, S, ix, iy + 4, iw, ih - 8, { n: 24, color: acc }); break;
      case 'ecg': ecgStrip(g, S, ix, iy, iw, ih, { color: acc, sweep: true, grid: true }); break;
      case 'ruler': ruler(g, S, ix, iy + ih / 2, iw, { color: col }); break;
    }
    if (o.text) { // 大读数：右下角
      g.font = fonts(22, 'ZENB', 'SCB'); g.fillStyle = acc; g.textAlign = 'right'; g.fillText(o.text, x + w - 12, y + h - 10); g.textAlign = 'left';
    }
  }
  g.restore();
}
