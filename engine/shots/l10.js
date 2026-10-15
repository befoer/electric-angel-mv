// L10（28–29 小节，0:43.27–0:46.47）· 层 · C2 电子心 萝莉版（视觉方案 §5.0、§5.2a）
// 范例：出图（隐函数心形线随低频鼓胀、心电图按 150 BPM 跳）、推导（f = 150/60 Hz → 2.5 Hz）、歌词关键词拼成的心
// 中：「电子的心」几个字拼成的心，唱到哪个字哪个字亮起，随低频错位
// 左：心形线卡 (x²+y²−1)³ − x²y³ = 0，曲线按真实方程画；右：心电图卡 + 推导；左下：I03 色差小图；右下：节拍仪表
import { W, H, CW, CH, BRAND, BEAT, BAR, BAR0 } from '../core/const.js';
import { barStart, beatTime, clamp, decay } from '../core/time.js';
import { cutAt } from '../core/cuts.js';
import { glyphs, font, fonts } from '../core/glyphs.js';
import { Occ, background, charField, bgDensity, rasterCells, heartPath } from '../core/grid.js';
import { beatSprites, drawBeatSprites, drawSprite, spriteCells, offbeatFlashes } from '../core/sprites.js';
import { keyword, onset } from '../core/data.js';
import { rev } from '../rev.js';
import { photo } from '../core/portrait.js';
import { framed } from '../core/fx.js';
import { newCanvas } from '../core/env.js';
import { hud } from '../core/hud.js';
import { camAt, withCam } from '../core/cam.js';
import { paper, backDeco, frontDeco, punch, formulaFx } from './scene.js';
import { css } from '../core/color.js';
import { rrect } from '../core/ui.js';
import { card, ring, dots, hatch } from '../core/kit.js';
import { drawFormula, morphFormula } from '../core/math.js';

const T_HZ = beatTime(29, 1);
const LCARD8 = [40, 90, 520, 480], RCARD8 = [1360, 90, 520, 400];
// 第十轮（rev polish1）：两张卡离画面边 100 px，镜头推得小一点
const LCARD10 = [100, 100, 500, 460], RCARD10 = [1320, 100, 500, 390];
const FACE = [0.26, 0.13, 0.40, 0.30];

// 心形线 (x²+y²−1)³ = x²y³ 的极坐标采样：每个角度二分求半径（只算一次）
let CURVE = null;
function heartCurve(n = 240) {
  if (CURVE) return CURVE;
  CURVE = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    const f = r => (r * r - 1) ** 3 - r ** 5 * c * c * s ** 3;
    let lo = 0.01, hi = 2;
    for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (f(m) < 0) lo = m; else hi = m; }
    CURVE.push([lo * c, lo * s]);
  }
  return CURVE;
}

// 心电图：每拍一次，R 波落在拍头后 8 ms
function ecg(t) {
  const n = (t - BAR0) / BEAT, p = (((n % 1) + 1.2) % 1);
  const g = (c, w, a) => a * Math.exp(-(((p - c) / w) ** 2));
  return g(0.10, 0.03, 0.12) + g(0.20, 0.008, -0.15) + g(0.22, 0.010, 1) + g(0.245, 0.010, -0.25) + g(0.45, 0.05, 0.25);
}

// 关键词心：64×30 格的心形掩码里排满关键词，某个字唱到后心里所有这个字一起亮起
// 第十八轮（用户：0:42 转场结束后中间文字组成的爱心出现晚了，中间还是空白）：对时数据把「電」放在 43.25，其实 42.86 就唱了
// （L10 在 28 小节的强拍上起唱，不是弱起；「子」43.10、「♪」43.30、「♪」43.86 / 44.08 / 44.29，data/vocal_onsets.json），
// 心形转场 43.25 才开完，所以开完时心里一个字都没有。改成按实测起音、提前 0.1 s 亮；还没唱到的字先用最浅的墨淡淡排好心形——
// 转场一开始就从心的中间往外一圈圈出来——唱到哪个字，心里所有这个字一起变深、闪一下。rev l10h18
// 第二十轮（用户：0:42 中间文字组成的爱心动画改得太早了，镜头入场时已经是比较密的状态）：心改成"跟着唱从中间长出来"——
// 唱到的字不再提前 0.1 s、也不再一下子全心一起亮：从心的中间往外 0.6 s 一圈圈亮开；没唱到的淡字晚一点（切点后 0.25 s）才从中间出来、
// 1.1 s 才铺到边、也更淡。转场开完（切点后约 0.45 s）时心只亮了中间一团，之后随着「電♪」一个字一个字铺满
function keywordHeart(ctx, S, words, cx, cy, scale) {
  const p = S.pal, f = S.f, pulse = scale * (1 + 0.04 * f.onset);
  const start = new Map();
  words.forEach((w, i) => start.set(w.c, Math.min(start.get(w.c) ?? Infinity, onset('L10', i))));
  const mask = rasterCells('heart64', 64, 30, heartPath);
  const sets = p.ink.map(c => glyphs('JB', c).warm(words.map(x => x.c).join('')));
  const g0 = cutAt(28) + 0.25, gSpread = 1.1, gAlpha = 0.4, litSpread = 0.6;
  ctx.save(); ctx.translate(cx, cy); ctx.scale(pulse, pulse);
  for (let y = 0; y < 30; y++) for (let x = 0; x < 64; x += 2) {
    if (!mask[y * 64 + x] || !mask[y * 64 + x + 1]) continue;
    const shift = Math.round(2 * f.low * Math.sin(y * 0.7 + S.t * 9)), dist = Math.hypot((x - 32) / 32, (y - 15) / 15) / 1.42;
    const ch = words[(x / 2 + y * 7) % words.length], t0 = start.get(ch.c) + litSpread * dist;
    if (S.t < t0) {
      const ga = clamp((S.t - g0 - gSpread * dist) / 0.12);
      if (ga <= 0) continue;
      ctx.save(); ctx.globalAlpha *= gAlpha * ga; sets[1].draw(ctx, ch.c, (x - 32 + shift) * CW, (y - 15) * CH); ctx.restore();
      continue;
    }
    sets[3 + (S.t - t0 < 0.12 ? 1 : y % 4 === 0 ? 1 : 0)].draw(ctx, ch.c, (x - 32 + shift) * CW, (y - 15) * CH);
  }
  ctx.restore();
}

// 色差：同一张小图染成纯色（缓存）
const TINT = new Map();
function tinted(src, color) {
  const k = `${src.width}x${src.height}|${color}`;
  let cv = TINT.get(k);
  if (cv) return cv;
  cv = newCanvas(src.width, src.height);
  const c = cv.getContext('2d');
  c.drawImage(src, 0, 0); c.globalCompositeOperation = 'source-in'; c.fillStyle = color; c.fillRect(0, 0, cv.width, cv.height);
  TINT.set(k, cv);
  return cv;
}

// 相机：心从远处推近，两小节里缓慢绕一点；拍头随心跳推镜
// 第十五轮：从切点开始（core/cuts.js）
const CAM10 = () => { const a = cutAt(28), b = cutAt(30); return [
  { t: a, x: 0, y: 40, zoom: 0.9, rot: -0.02 },
  { t: a + 0.6, x: 0, y: 0, zoom: 0.98, rot: 0, e: 'out' },
  { t: b, x: 10, y: -10, zoom: 1.02, rot: 0.01 },
]; };

// 第十轮（DeepSeek 视觉灵感《电气之躯》里「拍频的心」，rev graphics）：下方一条示波带——她的一路（蓝）和你的一路（粉）
// 频率很接近，两路叠在一起就出现拍频：合成的波一鼓一缩，包络（虚线）的每一鼓就是一下心跳。两条线的频率是演出值
function beatStrip(ctx, S, x, y, w, h) {
  const p = S.pal, t = S.t, a = clamp((S.lt - 0.5) / 0.3);
  if (a <= 0) return;
  const f1 = 9.0, f2 = 7.75, N = 160, span = 1.6, mid = y + h / 2, A = h * 0.22;
  ctx.save(); ctx.globalAlpha *= a;
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; rrect(ctx, x - 16, y - 12, w + 32, h + 24, 14); ctx.fill();
  ctx.strokeStyle = css(p.line, 0.5); ctx.lineWidth = 1.5; ctx.stroke();
  const wave = (fn, col, lw, al) => {
    ctx.strokeStyle = css(col, al); ctx.lineWidth = lw; ctx.beginPath();
    for (let i = 0; i <= N; i++) { const tt = t - span + (i / N) * span, X = x + (i / N) * w, Y = mid - fn(tt); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
    ctx.stroke();
  };
  const her = tt => A * Math.sin(2 * Math.PI * f1 * tt), you = tt => A * Math.sin(2 * Math.PI * f2 * tt + 1);
  const env = tt => 2 * A * Math.abs(Math.cos(Math.PI * (f1 - f2) * tt + 0.5));
  wave(her, BRAND, 1.2, 0.45); wave(you, p.acc[0], 1.2, 0.45);
  ctx.setLineDash([6, 6]); wave(env, p.acc[0], 1.5, 0.7); wave(tt => -env(tt), p.acc[0], 1.5, 0.7); ctx.setLineDash([]);
  wave(tt => her(tt) + you(tt), BRAND, 3, 1);
  ctx.font = fonts(15, 'ZENB', 'SCB'); ctx.fillStyle = p.gray; ctx.textBaseline = 'bottom';
  ctx.fillText('her ♪ + you  →  beat', x, y - 16);
  ctx.textAlign = 'right'; ctx.fillStyle = p.acc[0]; ctx.fillText('f_beat = |f₁ − f₂|', x + w, y - 16); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.restore();
}

export function l10(ctx, S) {
  const cam = camAt(CAM10(), S.t), c = { ...cam, zoom: cam.zoom * punch(S, 0.04, 7) };
  paper(ctx, S, c);
  backDeco(ctx, S, c, 100, { alpha: 0.4, boxes: [[600, 40, 700, 140], [600, 900, 700, 140]] });
  withCam(ctx, c, 1, g => content(g, S));
  frontDeco(ctx, S, c, 101, { alpha: 0.6, items: [['ring', 960, 560, 520], ['ecg', -100, 1030, 700]] , depth: 1.5, blur: 9 });
  hud(ctx, S);
}

function content(ctx, S) {
  const pal = S.pal, t = S.t, kick = decay(S.sub * BEAT, 8);
  const rects = [[2, 3, 48, 30], [112, 3, 158, 26], [36, 8, 124, 47], [3, 36, 32, 52], [132, 36, 158, 52], [41, 42, 119, 50]];
  const LCARD = LCARD10, RCARD = RCARD10;
  const occ = new Occ();
  for (const r of rects) occ.rect(...r);
  const sprites = beatSprites(S, { mult: 0.8, avoid: rects });
  for (const s of sprites) occ.rect(...spriteCells(s));
  charField(ctx, S, { occ, density: bgDensity(0.8) });

  keywordHeart(ctx, S, keyword('L10', 0, 6), 960, 560, 1.0);

  // 左：心形线
  card(ctx, S, ...LCARD10, { title: 'heart curve', age: S.lt }, c => {
    drawFormula(ctx, 'heart', c.x + c.w / 2, c.y + 4, { size: 40, align: 'c', color: pal.text, write: S.lt - 0.1, dur: 0.5, sweep: formulaFx(S, 0).sweep });
    const px = c.x + c.w / 2, py = c.y + 250, R = 120 * (1 + 0.1 * S.f.low + 0.12 * kick);
    ctx.strokeStyle = pal.tint[3]; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(c.x + 20, py); ctx.lineTo(c.x + c.w - 20, py); ctx.moveTo(px, c.y + 90); ctx.lineTo(px, c.y + c.h - 4); ctx.stroke();
    const pts = heartCurve(), draw = Math.min(pts.length, Math.floor(pts.length * clamp((S.lt - 0.3) / 0.6)));
    ctx.strokeStyle = pal.acc[0]; ctx.lineWidth = 5; ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i <= draw && draw > 1; i++) { const [x, y] = pts[i % pts.length]; const X = px + x * R, Y = py - y * R; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
    ctx.stroke();
    // 一个点每小节绕心形线走一圈
    if (draw >= pts.length) {
      const [x, y] = pts[Math.floor((((t - cutAt(28)) / BAR) % 1) * pts.length)];
      ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(px + x * R, py - y * R, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = BRAND; ctx.beginPath(); ctx.arc(px + x * R, py - y * R, 8, 0, Math.PI * 2); ctx.fill();
    }
  });
  dots(ctx, LCARD[0] + 30, LCARD[1] + LCARD[3] + 40, 3, 3, 22, 5, pal.line);

  // 右：心电图 + 推导 f = 150/60 Hz → 2.5 Hz
  card(ctx, S, ...RCARD10, { title: 'heart rate', age: S.lt - 0.15 }, c => {
    const gx = c.x, gy = c.y + 90, gw = c.w, span = BAR;
    ctx.strokeStyle = pal.tint[3]; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + gw, gy); ctx.stroke();
    ctx.strokeStyle = BRAND; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i <= 200; i++) { const tt = t - span + (i / 200) * span, X = gx + (i / 200) * gw, Y = gy - 70 * ecg(tt); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
    ctx.stroke();
    ctx.fillStyle = pal.acc[0]; ctx.beginPath(); ctx.arc(gx + gw, gy - 70 * ecg(t), 7, 0, Math.PI * 2); ctx.fill();
    ctx.font = font('ZENB', 24); ctx.fillStyle = pal.gray;
    drawSprite(ctx, 'heart', 3, pal, gx + 12, gy + 48, 1 + 0.2 * kick);
    ctx.fillText('150 BPM · 4/4', gx + 34, gy + 56);
    morphFormula(ctx, 'bpm_a', 'bpm_b', clamp((t - T_HZ) / BEAT), c.x + c.w / 2, c.y + c.h - 70, { size: 48, align: 'c', valign: 'mid', color: pal.text });
  });
  hatch(ctx, RCARD[0] + 20, RCARD[1] + RCARD[3] + 26, 3, 26, pal.acc[1], { w: 8, gap: 14 });

  // 左下：I03 小图，拍头粉 / 薄荷两色错开 6 px 正片叠底（色差），随拍衰减
  const p10 = true, mini = photo('I03', FACE, 300, 230), mx = p10 ? 260 : 210, my = p10 ? 860 : 870;
  framed(ctx, mini, mx, my, 300, 230, { rot: -0.05 });
  beatStrip(ctx, S, 520, 878, 880, 90);
  if (kick > 0.02) {
    ctx.save(); ctx.translate(mx, my); ctx.rotate(-0.05);
    ctx.beginPath(); ctx.rect(-150, -115, 300, 230); ctx.clip();
    ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.6 * kick;
    ctx.drawImage(tinted(mini, pal.acc[0]), -156, -115, 300, 230);
    ctx.drawImage(tinted(mini, pal.acc[2]), -144, -115, 300, 230);
    ctx.restore();
  }

  // 右下：节拍仪表，每拍走完一圈
  ring(ctx, S, p10 ? 1690 : 1740, 870, 70, 1 - S.sub, { text: '150', label: 'BPM', color: pal.acc[0] });

  drawBeatSprites(ctx, S, sprites);
  offbeatFlashes(ctx, S, { avoid: rects });
}
