// L05（18–19 小节，0:27.27–0:30.47）· "除了 0 和 1 什么都不知道"（视觉方案 §5.2a 第六轮）
// 背景：巨大的「0♪1」（歌词关键词，唱到哪个字砸哪个字），字里填满滚动的 0/1
// 中间：她（I03）变成彩色马赛克，每格上叠一个 0 或 1（彩色才认得出是她）；开头逐行解码出来，每拍有一条带重新乱码
// 左：FP8 E4M3 位格式卡（每拍翻几位、实时算出数值）；右：「9.11 > 9.9 ?」→ Wait. → 「9.9 > 9.11」
// 最后一拍：马赛克上的 0/1 往上飞走（L06 开头它们聚成 AI）
import { W, H, BRAND, BEAT, STEP } from '../core/const.js';
import { barStart, beatTime, clamp, lerp, smooth, easeIn, easeOut, easeOutBack, decay } from '../core/time.js';
import { rev } from '../rev.js';
import { cutAt } from '../core/cuts.js';
import { hash, rnd } from '../core/rand.js';
import { font, fonts, glyphs } from '../core/glyphs.js';
import { keyword } from '../core/data.js';
import { photo } from '../core/portrait.js';
import { newCanvas } from '../core/env.js';
import { camAt, withCam, pooled, camToScreen } from '../core/cam.js';
import { hud } from '../core/hud.js';
import { card, stamp } from '../core/kit.js';
import { drawFormula, fnum } from '../core/math.js';
import { rrect } from '../core/ui.js';
import { paper, backDeco, frontDeco, punch, camBeat, safeZoom, formulaFx } from './scene.js';
import { css } from '../core/color.js';

// 第十六轮：镜头的起止跟着切点走（cutAt，画帧时取）；按拍走的东西（漏下的比特、位格式）仍按小节线 B18 数拍
const B18 = barStart(18), T0 = () => cutAt(18), T1 = () => cutAt(20), T_OUT = beatTime(19, 4);
const T_911 = beatTime(19, 1), T_WAIT = beatTime(19, 3), T_OK = beatTime(19, 4);
const SUB = [0.11, 0.03, 0.70, 0.80];          // I03 胸像（与 L04 同一块）
// 第八轮（用户：背景 0/1 的字体不好看、前面的框挡太多）：巨字换成圆体 Zen Maru Black、往上提；马赛克缩小放到下方正中，两张卡挪到两个下角
const MC = 32, MR = 36, CELL = 14;             // 马赛克 32×36 格，每格 14 px
const MX = W / 2 - (MC * CELL) / 2, MY = 548;  // 马赛克左上角

const CAM = () => [
  { t: T0(), x: 0, y: 30, zoom: 1.0, rot: -0.006 },
  { t: T1() - 0.4, x: 0, y: 10, zoom: 1.05, rot: 0.006 },
];

// 马赛克的每格颜色与亮度（只算一次）
let MOS = null;
function mosaic() {
  if (MOS) return MOS;
  const small = photo('I03', SUB, MC, MR), d = small.getContext('2d').getImageData(0, 0, MC, MR).data;
  const lum = new Float32Array(MC * MR), a = new Uint8Array(MC * MR);
  for (let i = 0; i < MC * MR; i++) { lum[i] = (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) / 255; a[i] = d[i * 4 + 3]; }
  MOS = { small, lum, a };
  return MOS;
}

// 0/1 纹理（给巨字填充）：一张缓存的网格字，绘制时按时间滚动
// 第二十二轮（用户：0♪1 去掉描边，里面的字符加随机不透明度，再加早期第五轮那种随机字符掉落）：每个字一个随机不透明度（0.15–1）。第二十四轮并开关
let TEX = null;
function binTexture(pal) {
  if (TEX) return TEX;
  const cv = (TEX = newCanvas(W, H * 2)), c = cv.getContext('2d');
  c.font = fonts(22, 'DOT'); c.textBaseline = 'top'; // 像素字体的 0/1
  for (let r = 0; r < 90; r++) for (let k = 0; k < 120; k++) {
    c.globalAlpha = 0.3 + 0.7 * rnd(k, r, 5) ** 1.3;
    c.fillStyle = hash(k, r, 3) % 2 ? pal.ink[3] : pal.ink[4]; c.fillText(hash(k, r) % 2 ? '1' : '0', k * 16, r * 24);
  }
  return cv;
}
// 第二十三轮：巨字里面的格点（16 × 24 一格，和 0/1 纹理同一个网格），相对字的中心。只算一次
// 用在两处：字符雨只从字里面开始掉；L04 的心散成的 0/1 落进「0」里（l04.js heartTo0）
const GPTS = new Map();
export function glyphPts05(ch) {
  let P = GPTS.get(ch);
  if (P) return P;
  const N = 800, c = newCanvas(N, N).getContext('2d');
  c.font = fonts(640, 'ZENB', 'J'); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#000'; c.fillText(ch, N / 2, N / 2);
  const d = c.getImageData(0, 0, N, N).data;
  P = [];
  for (let y = 12; y < N; y += 24) for (let x = 8; x < N; x += 16) if (d[(y * N + x) * 4 + 3] > 160) P.push([x - N / 2, y - N / 2]);
  GPTS.set(ch, P);
  return P;
}
export const WORD05 = { xs: [330, 960, 1590], WY: 360 };
// 「0」里的格点在 L05 开头那一刻的屏幕位置（巨字层在相机深度 0.6 上）
let ZP = null;
export function zeroScreenPts05() {
  if (ZP) return ZP;
  const cam = camAt(CAM(), T0() + 0.15), c = { ...cam, zoom: cam.zoom * safeZoom() };
  ZP = glyphPts05('0').map(([dx, dy]) => camToScreen(c, 0.6, WORD05.xs[0] + dx, WORD05.WY + dy));
  return ZP;
}
// 字符雨：字出来以后，每个字里不断有 0/1 往下掉（一串 5 个、头亮尾淡、掉的时候字在 0 和 1 之间翻），掉出画面
// 第二十三轮（用户：0♪1 周围的粒子掉落范围改到只在字符内开始掉落）：起点从"字周围 380 × 300 的一块"改成字里面随机一个格点，每轮换一个（第二十五轮并开关 l05r23）
function rain05(g, S, live, xs, WY) {
  const t = S.t, pal = S.pal, sets = [glyphs('DOT', pal.ink[3]), glyphs('DOT', pal.ink[4] ?? BRAND), glyphs('DOT', BRAND)];
  for (const o of live) for (let k = 0; k < 34; k++) {
    const sd = o.i * 101 + k, period = 0.9 + rnd(sd, 2) * 1.1, d0 = rnd(sd, 5) * 0.5, age = o.a - d0;
    if (age < 0) continue;
    const cyc = age / period + rnd(sd, 3) * (age > period ? 1 : 0), ph = cyc % 1;
    const P = glyphPts05(o.k.c), q = P[Math.floor(rnd(sd, Math.floor(cyc), 7) * P.length)], x = xs[o.i] + q[0] - 8, y0 = WY + q[1] - 12;
    const y = y0 + ph * ph * (H + 260 - y0), fade = 1 - clamp((ph - 0.75) / 0.25);
    for (let j = 0; j < 5; j++) {
      const ch = hash(sd, Math.floor(t * 14) - j, 9) % 2 ? '1' : '0';
      g.save(); g.globalAlpha = fade * (j === 0 ? 0.95 : 0.6 - j * 0.11); sets[j === 0 ? 2 : j < 3 ? 1 : 0].draw(g, ch, x, y - j * 22); g.restore();
    }
  }
}

// 第十七轮（用户：背景大数字「1」出现时间晚了，要在唱到「♪」的时候出现）：对时数据在这里错了一个音——「♪」实测
// （人声分轨，每个辅音前的空隙之后的起音）是 ♪ 26.86、♪ 27.08、♪ 27.27、♪ 27.68、♪ 28.05，对时数据把「♪」放在 27.68、「1」放在 28.13，
// 都晚了约 0.4 s。巨字「♪」「1」改钉在实测的「♪」「♪」上、提前 0.07 s 砸下来。rev l05n17
const KW17 = [null, 27.27, 27.68];
const kwT = (k, i) => (KW17[i] ? KW17[i] - 0.07 : k.t0);

export function l05(ctx, S) {
  const cam = camAt(CAM(), S.t), kw = keyword('L05', 0, 3);
  const hit = Math.max(...kw.map((k, i) => (S.t >= kwT(k, i) ? decay(S.t - kwT(k, i), 7) : 0)));
  const c = { ...cam, zoom: cam.zoom * punch(S, 0.02) * (1 + 0.05 * hit * camBeat(S)) * safeZoom() };
  paper(ctx, S, c);
  bigWord(ctx, S, c, kw);
  backDeco(ctx, S, c, 50, { alpha: 0.4, boxes: [[40, 40, 480, 180], [1400, 40, 480, 180]] });
  withCam(ctx, c, 1, g => content(g, S));
  frontDeco(ctx, S, c, 51, { alpha: 0.55, items: [['data', -30, 420, 0], ['ring', 1930, 560, 240]] });
  hud(ctx, S, { spectrum: false });
}

// 背景巨字「0♪1」：唱到时从 1.5 倍砸下来，字里是滚动的 0/1；描边 BRAND
function bigWord(ctx, S, cam, kw) {
  const pal = S.pal, buf = pooled('l05word', W, H), b = buf.getContext('2d');
  b.setTransform(1, 0, 0, 1, 0, 0); b.clearRect(0, 0, W, H);
  b.font = fonts(640, 'ZENB', 'J'); b.textAlign = 'center'; b.textBaseline = 'middle';
  const xs = [330, 960, 1590], WY = 360;
  const live = kw.map((k, i) => ({ k, i, a: S.t - kwT(k, i) })).filter(o => o.a >= 0);
  // 第二十二轮：「0」不再从 1.5 倍砸下来，在 L04 的心变成的那个椭圆里原地淡出来（l04.js heartTo0；第二十四轮并开关）
  // 第二十三轮：心散成的 0/1 落进「0」以后（l04.js heartTo0），「0」的纹理从 T0 + 0.08 起 0.18 s 淡出来、接住它们（第二十五轮并开关 l04p23）
  const z0 = [0.08, 0.18];
  const look = o => (o.i === 0 ? { s: 1, a: smooth(clamp((S.t - (T0() + z0[0])) / z0[1])) } : { s: 1.5 - 0.5 * easeOutBack(clamp(o.a / 0.14), 1.8), a: 1 });
  for (const o of live) {
    const { s, a } = look(o);
    b.save(); b.globalAlpha = a; b.translate(xs[o.i], WY); b.scale(s, s); b.fillStyle = '#000'; b.fillText(o.k.c, 0, 0); b.restore();
  }
  b.globalCompositeOperation = 'source-in';
  b.globalAlpha = 0.9;
  b.drawImage(binTexture(pal), 0, -((S.t * 60) % H));
  b.globalCompositeOperation = 'source-over'; b.globalAlpha = 1;
  withCam(ctx, cam, 0.6, g => {
    g.save(); g.globalAlpha = 0.85; g.drawImage(buf, 0, 0); g.restore();
    rain05(g, S, live, xs, WY); // 第二十二轮：去掉描边，加字符雨
    strokeIn05(g, S, live, look, xs, WY); // 第二十六轮并开关 l05s24
  });
}
// 第二十四轮（用户：0:26 背景大字 0♪1 在出场的时候增加短暂的描边动画）：每个字出来时，一圈品牌蓝的描边沿轮廓画出来
// （0.3 s，字的几条轮廓同时起笔），停一下就淡掉（约 0.75 s 后没了），画完时外面再跟一圈细描边往外扩散淡掉。描边不留下来，
// 字里面仍只有 0/1。「0」从心散成的 0/1 落进来那一刻（T0 + 0.08）起笔，「♪」「1」从砸下来那一刻起笔、跟着字的缩放（第二十六轮并开关 l05s24）
// 第二十七轮（用户：0:27 背景 0♪1 的短暂描边减细一半）：描边 7 → 3.5 px，往外扩散的那圈 2.5 → 1.25 px。rev l05w27
function strokeIn05(g, S, live, look, xs, WY) {
  const thin = rev('l05w27') >= 27;
  g.font = fonts(640, 'ZENB', 'J'); g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.lineCap = 'round';
  for (const o of live) {
    const age = o.i === 0 ? S.t - (T0() + 0.08) : o.a;
    if (age < 0 || age > 0.8) continue;
    const { s } = look(o), draw = easeOut(clamp(age / 0.3)), fade = 1 - smooth(clamp((age - 0.42) / 0.33));
    g.save(); g.translate(xs[o.i], WY); g.scale(s, s);
    g.setLineDash([1900 * draw + 0.01, 4000]); g.lineWidth = thin ? 3.5 : 7; g.strokeStyle = css(BRAND, 0.95 * fade); g.strokeText(o.k.c, 0, 0);
    const e = clamp((age - 0.24) / 0.45);
    if (e > 0 && e < 1) { g.setLineDash([]); g.scale(1 + 0.07 * easeOut(e), 1 + 0.07 * easeOut(e)); g.lineWidth = thin ? 1.25 : 2.5; g.strokeStyle = css(BRAND, 0.6 * (1 - e)); g.strokeText(o.k.c, 0, 0); }
    g.restore();
  }
  g.setLineDash([]); g.textAlign = 'left'; g.textBaseline = 'alphabetic';
}

// 第十一轮（用户：中间她的那个窗口放大，加层次和装饰细节）。rev l05
// 马赛克每格 14 → 17 px（窗口 448×504 → 544×612），往上挪；后面叠三层错开的「位平面」（亮度按 3 个阈值二值化的她，像把一张图拆成几个 bit），
// 窗口加标题条、左边和上边的像素刻度、四角括号、每拍从上往下扫一遍的解码线、一个沿路径移动的放大镜（读出那一格的颜色值）

// 第十二轮（用户：转场改成上一个镜头她身上的 10110101 粒子，转移成下一个镜头 AI 的 0101101 粒子）。rev l05to06
// 马赛克的每一格（连同上面的 0/1）在 DEP0 之后错开起飞：上面的行先走、同一行里随机；起飞后这里就不画它，由转场接着画
const DEP0 = () => T1() - 0.52;
const depOf = (k, r) => DEP0() + 0.3 * (0.55 * (r / MR) + 0.45 * rnd(k, r, 8));
let CELLS = null;
function cells() {
  if (CELLS) return CELLS;
  const M = mosaic(), d = M.small.getContext('2d').getImageData(0, 0, MC, MR).data;
  CELLS = [];
  for (let r = 0; r < MR; r++) for (let k = 0; k < MC; k++) {
    const i = r * MC + k;
    if (M.a[i] < 100) continue;
    CELLS.push({ k, r, dep: depOf(k, r), col: `rgb(${d[i * 4]},${d[i * 4 + 1]},${d[i * 4 + 2]})`, dark: M.lum[i] > 0.55, ch: hash(k, r, 77) % 2 ? '1' : '0' });
  }
  return CELLS;
}
// 转场用：所有格子（起飞时刻、颜色、字）和它们起飞那一刻在屏幕上的中心（按 L05 那一刻的相机算）
export function binCells() {
  const { CELL, MX, MY } = geo();
  return cells().map(q => {
    const cam = camAt(CAM(), q.dep), c = { ...cam, zoom: cam.zoom * safeZoom() };
    const [x, y] = camToScreen(c, 1, MX + (q.k + 0.5) * CELL, MY + (q.r + 0.5) * CELL);
    return { ...q, x, y, size: CELL * c.zoom };
  });
}
const geo = () => ({ CELL: 17, MX: W / 2 - (MC * 17) / 2 - 30, MY: 430 });
let PLANES = null;
function planes(M) {
  if (PLANES) return PLANES;
  PLANES = [0.72, 0.5, 0.3].map(th => { const cv = newCanvas(MC, MR), c = cv.getContext('2d'), im = c.createImageData(MC, MR);
    for (let i = 0; i < MC * MR; i++) { const on = M.a[i] > 100 && M.lum[i] < th; im.data[i * 4] = 77; im.data[i * 4 + 1] = 107; im.data[i * 4 + 2] = 254; im.data[i * 4 + 3] = on ? 255 : 0; }
    c.putImageData(im, 0, 0); return cv; });
  return PLANES;
}
function decor(ctx, S, M, back) {
  const pal = S.pal, t = S.t, { CELL, MX, MY } = geo(), ww = MC * CELL, hh = MR * CELL, a = clamp((t - T0()) / 0.3);
  if (back) { // 位平面：三张错开的板，越往后越淡
    planes(M).forEach((pl, j) => {
      const d = (3 - j) * 30, x = MX - 18 + d, y = MY - 18 - d * 0.9;
      ctx.save(); ctx.globalAlpha = a * (0.35 + j * 0.15);
      ctx.fillStyle = '#FFFFFF'; rrect(ctx, x, y, ww + 36, hh + 36, 18); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = css(pal.line, 0.7); ctx.stroke();
      ctx.globalAlpha *= 0.55; ctx.imageSmoothingEnabled = false; ctx.drawImage(pl, x + 18, y + 18, ww, hh); ctx.imageSmoothingEnabled = true;
      ctx.restore();
      ctx.save(); ctx.globalAlpha = a; ctx.font = fonts(15, 'ZENB', 'SCB'); ctx.fillStyle = BRAND;
      ctx.fillText(`bit ${7 - j}`, x + ww + 46, y + 28 + j * 2); ctx.restore();
    });
    return;
  }
  ctx.save(); ctx.globalAlpha = a;
  // 标题条（压在窗口上边）
  ctx.fillStyle = BRAND; rrect(ctx, MX - 18, MY - 62, ww + 36, 38, 12); ctx.fill();
  ctx.font = fonts(17, 'ZENB', 'SCB'); ctx.fillStyle = '#FFFFFF'; ctx.textBaseline = 'middle';
  ctx.fillText(`I03.png → 1-bit · `+ MC + '×' + MR, MX - 2, MY - 43);
  ctx.textAlign = 'right'; ctx.fillText(`decode `+ String(Math.round(100 * clamp((t - T0()) / (BEAT * 1.2)))).padStart(3, ' ') + '%', MX + ww + 2, MY - 43); ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  // 像素刻度：左边、上边每 4 格一个刻度和编号
  ctx.strokeStyle = css(pal.line, 0.8); ctx.lineWidth = 1.5; ctx.font = fonts(11, 'ZENB'); ctx.fillStyle = pal.gray;
  ctx.beginPath();
  for (let k = 0; k <= MC; k += 2) { const x = MX + k * CELL, l = k % 4 ? 5 : 10; ctx.moveTo(x, MY + hh + 20); ctx.lineTo(x, MY + hh + 20 + l); if (k % 8 === 0) ctx.fillText(String(k), x - 4, MY + hh + 44); }
  for (let r = 0; r <= MR; r += 2) { const y = MY + r * CELL, l = r % 4 ? 5 : 10; ctx.moveTo(MX - 20, y); ctx.lineTo(MX - 20 - l, y); if (r % 8 === 0) ctx.fillText(String(r), MX - 48, y + 4); }
  ctx.stroke();
  // 四角括号
  ctx.strokeStyle = pal.acc[0]; ctx.lineWidth = 4; ctx.beginPath();
  const bx0 = MX - 34, by0 = MY - 76, bx1 = MX + ww + 34, by1 = MY + hh + 34, L = 34;
  for (const [x, y, sx, sy] of [[bx0, by0, 1, 1], [bx1, by0, -1, 1], [bx0, by1, 1, -1], [bx1, by1, -1, -1]]) { ctx.moveTo(x, y + sy * L); ctx.lineTo(x, y); ctx.lineTo(x + sx * L, y); }
  ctx.stroke();
  ctx.restore();
  // 解码线：每拍从上往下扫一遍
  const sw = (S.sub * BEAT) / 0.3;
  if (sw < 1 && t >= T0() + BEAT) {
    const y = MY + sw * hh;
    const gr = ctx.createLinearGradient(0, y - 40, 0, y);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,0.55)');
    ctx.fillStyle = gr; ctx.fillRect(MX, y - 40, ww, 40); ctx.fillStyle = BRAND; ctx.fillRect(MX - 6, y, ww + 12, 2);
  }
  // 放大镜：沿一条慢慢移动的路径看 3×3 格，旁边读出那一格的颜色
  if (t >= T0() + 0.6 && t < T_OUT) {
    const u = (t - T0() - 0.6) / (T_OUT - T0() - 0.6), gk = Math.round(8 + 16 * u + 3 * Math.sin(u * 7)), gr2 = Math.round(10 + 8 * Math.sin(u * 4) + 6 * u);
    const cx = MX + (gk + 0.5) * CELL, cy = MY + (gr2 + 0.5) * CELL, R = 66, lx = cx + 120, ly = cy - 110;
    const d = M.small.getContext('2d').getImageData(gk, gr2, 1, 1).data, hex = '#' + [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
    ctx.save();
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(cx + 10, cy - 10); ctx.lineTo(lx - R * 0.7, ly + R * 0.7); ctx.stroke();
    ctx.strokeStyle = BRAND; ctx.lineWidth = 3; ctx.stroke();
    ctx.strokeRect(cx - CELL * 1.5, cy - CELL * 1.5, CELL * 3, CELL * 3);
    ctx.beginPath(); ctx.arc(lx, ly, R, 0, Math.PI * 2); ctx.save(); ctx.clip();
    ctx.imageSmoothingEnabled = false; ctx.drawImage(M.small, gk - 1, gr2 - 1, 3, 3, lx - R, ly - R, 2 * R, 2 * R); ctx.imageSmoothingEnabled = true;
    ctx.restore();
    ctx.lineWidth = 6; ctx.strokeStyle = '#FFFFFF'; ctx.stroke(); ctx.lineWidth = 3; ctx.strokeStyle = BRAND; ctx.stroke();
    ctx.fillStyle = '#FFFFFF'; rrect(ctx, lx + R + 10, ly - 22, 150, 44, 10); ctx.fill(); ctx.strokeStyle = css(pal.line, 0.7); ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = hex; ctx.fillRect(lx + R + 20, ly - 10, 20, 20);
    ctx.font = fonts(16, 'ZENB', 'SCB'); ctx.fillStyle = pal.text; ctx.textBaseline = 'middle'; ctx.fillText(hex, lx + R + 48, ly + 1); ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }
}

function content(ctx, S) {
  const pal = S.pal, t = S.t, M = mosaic(), { CELL, MX, MY } = geo(), gone = t >= DEP0();
  decor(ctx, S, M, true);

  // 马赛克：先逐行解码出来（一拍内），每拍随机一条带乱码
  const rowsShown = Math.floor(clamp((t - T0()) / (BEAT * 1.2)) * MR);
  const band = hash(S.ni, 5) % MR, bandOn = S.sub < 0.3;
  ctx.save();
  ctx.fillStyle = '#FFFFFF'; rrect(ctx, MX - 18, MY - 18, MC * CELL + 36, MR * CELL + 36, 18); ctx.fill();
  ctx.lineWidth = 4; ctx.strokeStyle = pal.line; ctx.stroke();
  ctx.beginPath(); ctx.rect(MX, MY, MC * CELL, rowsShown * CELL); ctx.clip();
  if (gone) { // 第十二轮：起飞了的格子连颜色一起带走（交给转场画），留下空格
    for (const q of cells()) if (t < q.dep) { ctx.fillStyle = q.col; ctx.fillRect(MX + q.k * CELL, MY + q.r * CELL, CELL + 0.5, CELL + 0.5); }
  } else {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(M.small, MX, MY, MC * CELL, MR * CELL);
    ctx.imageSmoothingEnabled = true;
  }
  ctx.restore();
  // 每格一个 0/1（亮格用深字、暗格用白字），最后一拍往上飞走（第十二轮：不在这里飞，交给转场把它们一个个带进 L06 的 AI）
  ctx.font = fonts(15, 'DOT'); ctx.textBaseline = 'top';
  for (let r = 0; r < rowsShown; r++) for (let k = 0; k < MC; k++) {
    const i = r * MC + k;
    if (M.a[i] < 100) continue;
    if (gone && t >= depOf(k, r)) continue;
    const flip = hash(k, r, bandOn && Math.abs(r - band) < 2 ? S.ni * 7 + Math.floor(t * 20) : S.ni);
    const ch = flip % 2 ? '1' : '0';
    const x = MX + k * CELL + 4, y = MY + r * CELL + 1;
    ctx.fillStyle = M.lum[i] > 0.55 ? '#1D2541' : '#FFFFFF'; ctx.fillText(ch, x, y);
  }
  // 底边漏下的比特
  const step = Math.floor((t - B18) / STEP), gs = glyphs('SCB', BRAND);
  for (let k = 0; k < MC; k += 3) for (let s = Math.max(0, step - 12); s <= step; s++) {
    if (hash(k, s, 56) % 3) continue;
    const yy = MY + MR * CELL + 20 + (step - s) * 20;
    if (yy > H) continue;
    ctx.globalAlpha = 1 - (step - s) / 13;
    gs.draw(ctx, hash(k, s, 57) % 2 ? '1' : '0', MX + k * CELL, yy);
  }
  ctx.globalAlpha = 1;

  decor(ctx, S, M, false);

  // 左：FP8 E4M3 位格式卡
  ctx.textBaseline = 'alphabetic';
  card(ctx, S, 36, 744, 560, 316, { title: 'FP8 · E4M3', age: S.lt - 0.2 }, c => {
    drawFormula(ctx, 'fp8', c.x, c.y + 2, { size: 28, color: pal.text, colors: { s: pal.acc[0], e: BRAND, m: '#1FA88F' }, ...formulaFx(S, S.lt - 0.2) });
    const bits = Array.from({ length: 8 }, (_, i) => (hash(i, Math.floor((t - B18) / BEAT), 61) % 3 === 0 ? 1 : 0) ^ (hash(i, 99) % 2));
    const sz = 46, gap = 8, x0 = c.x, y0 = c.y + 84;
    bits.forEach((b, i) => {
      const grp = i === 0 ? 0 : i < 5 ? 1 : 2, x = x0 + i * (sz + gap) + (grp > 0 ? 14 : 0) + (grp > 1 ? 14 : 0);
      ctx.fillStyle = [pal.tint[0], pal.tint[3], pal.tint[2]][grp]; rrect(ctx, x, y0, sz, sz, 10); ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = [pal.acc[0], BRAND, '#1FA88F'][grp]; ctx.stroke();
      ctx.font = font('ZENB', 30); ctx.fillStyle = pal.text; ctx.textAlign = 'center'; ctx.fillText(String(b), x + sz / 2, y0 + 34); ctx.textAlign = 'left';
    });
    const s = bits[0], e = bits.slice(1, 5).reduce((a, b) => a * 2 + b, 0), m = bits.slice(5).reduce((a, b) => a * 2 + b, 0);
    const v = e === 15 && m === 7 ? 'NaN' : (s ? -1 : 1) * (e === 0 ? Math.pow(2, -6) * (m / 8) : Math.pow(2, e - 7) * (1 + m / 8));
    ctx.font = font('ZENB', 22); ctx.fillStyle = pal.gray; ctx.fillText(`s=${s}  e=${e}  m=${m}`, c.x, c.y + 168);
    ctx.font = font('ZENB', 46); ctx.fillStyle = pal.text; ctx.fillText('=', c.x, c.y + 226);
    if (v === 'NaN') { ctx.fillStyle = pal.acc[0]; ctx.fillText('NaN', c.x + 46, c.y + 226); }
    else fnum(ctx, Math.abs(v) < 0.01 ? v.toFixed(5) : v.toFixed(4), c.x + 46, c.y + 226, 50, { color: BRAND });
  });

  // 右：9.11 > 9.9 ?
  const ma = t - T_911;
  if (ma >= 0) {
    card(ctx, S, 1330, 770, 550, 280, { title: '比大小', age: ma, fill: pal.tint[1] }, c => {
      ctx.font = font('ZENB', 62); ctx.fillStyle = pal.text; ctx.fillText('9.11 > 9.9 ?', c.x + 10, c.y + 70);
      if (t >= T_OK) {
        ctx.save(); ctx.globalAlpha = clamp((t - T_OK) / 0.06);
        ctx.font = font('ZENB', 62); ctx.fillStyle = '#1FA88F'; ctx.fillText('9.9 > 9.11', c.x + 10, c.y + 170);
        // 对勾：线段画
        const k = easeOut(clamp((t - T_OK - 0.05) / 0.15)), ox = c.x + 390, oy = c.y + 140;
        ctx.strokeStyle = '#1FA88F'; ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + 26 * Math.min(1, k * 2), oy + 26 * Math.min(1, k * 2));
        if (k > 0.5) ctx.lineTo(ox + 26 + 52 * (k - 0.5) * 2, oy + 26 - 64 * (k - 0.5) * 2);
        ctx.stroke(); ctx.restore();
      }
    });
    stamp(ctx, S, 'Wait.', 1760, 880, 44, t - T_WAIT, { color: pal.acc[0] });
  }
}
