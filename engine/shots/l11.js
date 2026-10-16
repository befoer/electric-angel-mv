// L11（30–31 小节，0:46.47–0:49.67）· C3 量子的风 · "就像量子的风一样"（视觉方案 §5.2b，第七轮改）
// 第七轮（用户：立绘和粒子的结合要更精细）：她是一张清晰的立绘，被风从下风侧（右边）一格一格吹散成像素粒子——
// 散开的格子带着原来的颜色、拖着短尾巴飘走，散开的边缘有一圈亮格；身后两份蓝 / 粉的叠影（叠加态）随风错开。
// 每拍吹得更散，拍尾粒子倒着飞回来，拍头"测量"一次：扫描线扫过、锁定框收拢、她完整清晰。最后一拍整个人被吹走（甩镜头接 L12）。
// 左下：采样分布像草一样随风摆，测量时坍缩到一根柱；右上：叠加态 / 玻恩规则卡（薛定谔的鲸）、seed 114514
import { W, H, BRAND, BEAT } from '../core/const.js';
import { barStart, clamp, lerp, smooth, easeOut, easeOutBack, decay } from '../core/time.js';
import { cutAt } from '../core/cuts.js';
import { hash, rnd, vnoise } from '../core/rand.js';
import { font, fonts } from '../core/glyphs.js';
import { fact } from '../core/data.js';
import { photo } from '../core/portrait.js';
import { camAt, withCam, pooled } from '../core/cam.js';
import { hud } from '../core/hud.js';
import { card, ring, corners } from '../core/kit.js';
import { drawFormula } from '../core/math.js';
import { lyricKinetic } from '../core/lyric.js';
import { css } from '../core/color.js';
import { rrect } from '../core/ui.js';
import { newCanvas } from '../core/env.js';
import { paper, backDeco, frontDeco, punch, formulaFx } from './scene.js';

// 第十五轮：镜头从切点开始（core/cuts.js，画帧时取）
const T0 = () => cutAt(30), T1 = () => cutAt(32); // 第十六轮：结尾也跟着切点走
const FX = 760, FY = 560, FH = 900; // 她的中心与高度
const CS = 6;                       // 像素格大小

const CAM = () => [{ t: T0(), x: -40, y: 0, zoom: 1.0, rot: 0 }, { t: T1(), x: 60, y: -10, zoom: 1.05, rot: 0.01 }];

// 立绘按格子取样（只做一次）：每格的颜色组、散开的先后（右边先散，带噪声）
let G = null;
function grid() {
  if (G) return G;
  const img = photo('I01', null, Math.round(FH * 0.5), FH, { keyed: true });
  const cols = Math.ceil(img.width / CS), rows = Math.ceil(img.height / CS);
  const sm = newCanvas(cols, rows), c = sm.getContext('2d');
  c.drawImage(img, 0, 0, cols, rows);
  const d = c.getImageData(0, 0, cols, rows).data, pal = [], palIdx = new Map(), cells = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const o = (y * cols + x) * 4;
    if (d[o + 3] < 128) continue;
    let r = d[o], g = d[o + 1], b = d[o + 2];
    if (0.299 * r + 0.587 * g + 0.114 * b > 205) { r = 0x9F; g = 0xB3; b = 0xF0; } // 白围裙、白袜在纸白底上看不见，换浅蓝
    const q = v => Math.min(255, Math.round(v / 20) * 20), key = `rgb(${q(r)},${q(g)},${q(b)})`;
    if (!palIdx.has(key)) { palIdx.set(key, pal.length); pal.push(key); }
    const xn = x / cols, thr = 0.04 + 0.62 * (1 - xn) + 0.34 * vnoise(x * 0.09, y * 0.05, 0, 13);
    // 第十二轮：另有一个按小块随机的阈值——身上零星几小块先消失（vnoise 高的地方阈值低）
    const p = vnoise(x * 0.32, y * 0.32, 0, 57), thrP = p > 0.62 ? 0.04 + 1.6 * (0.9 - p) * (0.9 - p) * 4 : 9;
    cells.push({ x, y, g: palIdx.get(key), thr, thr12: Math.min(thr, thrP + 0.12 * rnd(x, y, 58)), lag: 0.55 + 0.9 * rnd(x, y, 5), i: cells.length });
  }
  const groups = pal.map((_, gi) => cells.filter(cl => cl.g === gi));
  const mask = newCanvas(cols, rows);
  // 第九轮：飞出去的粒子用提亮 25% 的颜色（深藏青的方块在浅底上像脏点）
  const light = pal.map(s => { const [r, g, b] = s.match(/\d+/g).map(Number), u = v => Math.round(v + (255 - v) * 0.25); return `rgb(${u(r)},${u(g)},${u(b)})`; });
  G = { img, cols, rows, cells, pal, light, groups, mask, mctx: mask.getContext('2d'), md: mask.getContext('2d').createImageData(cols, rows) };
  return G;
}

// 第九轮（用户：48 秒的粒子问题很大；左下柱状图要稳、要直立，不要往各个方向晃；右上公式也要动起来）。rev l11
// 吹散不再每拍一散一收：只在两个小节头"测量"（扫描线 + 锁定框，散开的格子飞回来），中间慢慢被吹散；最后两拍整个人被吹走。
// 粒子不画拖尾线（以前几千条细线叠成一团乱麻），改成提亮过的方块 + 一个淡淡的残影，风更平顺
// 第十一轮（用户：一半变成粒子后突然跳回没有粒子、两边窗口的数值也大变，像 bug）：第九轮在第 31 小节头又"测量"了一次，把她收回完整——
// 意图是量子测量的坍缩，但看起来就是跳帧。现在只在开头测量一次，之后一路单调地散开、不再收回；开头一秒先有稀疏的粒子从身上飘走
const MEAS_ON = () => [T0()];
const measAt = t => Math.max(...MEAS_ON().map(m => (t >= m ? decay(t - m, 6) : 0)));
// 第十二轮（用户：开头的粒子不要一直是那么一点点，要慢慢变多，身上随机的小块也跟着消失；整个人变成粒子的过程中不要先变慢再变快）。rev l11b
// 一条从头到尾单调加速的曲线（导数一直在增大，中途不再有一段缓下来）；散开的阈值换成 thr12（右边先散 + 身上随机小块）
const dissolve12 = t => { const u = clamp((t - T0()) / (T1() - T0())); return 2.05 * Math.pow(u, 2.4); };
const thrOf = cl => cl.thr12;

// 吹散程度 D（0 = 完整）
function dissolve(S) {
  return dissolve12(S.t);
}

export function l11(ctx, S) {
  const cam = camAt(CAM(), S.t), c = { ...cam, zoom: cam.zoom * punch(S, 0.025) };
  paper(ctx, S, c);
  backDeco(ctx, S, c, 110, { alpha: 0.4, boxes: [[1100, 640, 700, 300], [40, 40, 500, 160]] });
  withCam(ctx, c, 1, g => content(g, S));
  frontDeco(ctx, S, c, 111, { alpha: 0.5, items: [['ecg', 1400, -30, 600], ['hex', -80, 100, 30]] });
  hud(ctx, S, { spectrum: false });
}

function content(ctx, S) {
  const pal = S.pal, t = S.t, D = dissolve(S), w = clamp(D / 0.9);

  // 风线：细长的白 / 蓝线往右飞（第九轮：少一半、更淡）
  for (let i = 0; i < 20; i++) {
    const y = rnd(i, 1) * H, len = 120 + rnd(i, 2) * 380, sp = 900 + rnd(i, 3) * 900;
    const x = ((rnd(i, 4) * (W + len) + t * sp) % (W + len)) - len;
    ctx.fillStyle = css(i % 3 ? '#FFFFFF' : BRAND, 0.18 + 0.25 * w);
    ctx.fillRect(x, y + Math.sin(t * 2 + i) * 20, len, 2);
  }

  const Gd = grid(), x0 = FX - Gd.img.width / 2, y0 = FY - FH / 2;
  // 还没散开的格子做成蒙版，盖在清晰的立绘上
  const md = Gd.md.data;
  md.fill(0);
  for (const cl of Gd.cells) if (D - thrOf(cl) <= 0) md[(cl.y * Gd.cols + cl.x) * 4 + 3] = 255;
  Gd.mctx.putImageData(Gd.md, 0, 0);
  const body = pooled('l11body', Gd.img.width, Gd.img.height, true), bc = body.getContext('2d');
  bc.globalCompositeOperation = 'source-over'; bc.clearRect(0, 0, body.width, body.height);
  bc.drawImage(Gd.img, 0, 0);
  bc.globalCompositeOperation = 'destination-in'; bc.imageSmoothingEnabled = false;
  bc.drawImage(Gd.mask, 0, 0, Gd.cols * CS, Gd.rows * CS);
  bc.globalCompositeOperation = 'source-over';

  // 叠加态：身后两份纯色叠影，随风左右错开
  const ghost = pooled('l11ghost', body.width, body.height, true), gc = ghost.getContext('2d');
  const spread = 6 + 30 * w;
  for (const [col, dx, a] of [[BRAND, -spread, 0.32], [pal.acc[0], spread * 0.8, 0.26]]) {
    gc.globalCompositeOperation = 'source-over'; gc.clearRect(0, 0, ghost.width, ghost.height);
    gc.drawImage(body, 0, 0);
    gc.globalCompositeOperation = 'source-in'; gc.fillStyle = col; gc.fillRect(0, 0, ghost.width, ghost.height);
    ctx.save(); ctx.globalAlpha = a * (0.4 + 0.6 * w); ctx.drawImage(ghost, x0 + dx, y0 + dx * 0.1); ctx.restore();
  }
  ctx.drawImage(body, x0, y0);

  // 第十一轮：开头约一秒的稀疏粒子——身上零星的格子"复制"出一颗往右后方飘走（身体不缺块），每颗活 0.9 s，越往后越多
  if (t < T0() + 2.4) {
    const dens = Math.pow(clamp((t - T0()) / 1.6), 1.5); // 第十二轮：从几乎没有慢慢变多
    ctx.save();
    for (let k = 0; k < Gd.cells.length; k += 9) {
      const cl = Gd.cells[k], tb = T0() + rnd(k, 91) * 1.9, a = t - tb;
      if (a < 0 || a > 0.9 || rnd(k, 92) > 0.05 + 0.8 * dens) continue;
      const e = a / 0.9, [px, py] = flyPos(cl, 0.6 * e, t), sz = CS * (1 - 0.4 * e);
      ctx.globalAlpha = (1 - e) * 0.9; ctx.fillStyle = Gd.light[cl.g];
      ctx.fillRect(x0 + px - sz / 2, y0 + py - sz / 2, sz, sz);
    }
    ctx.restore();
  }
  // 散开的格子：带原色的方块 + 短尾巴，越飘越小、越淡；刚散开的边缘一圈亮格
  ctx.save();
  Gd.groups.forEach((cells, gi) => { // 第九轮：提亮的方块 + 一个淡残影，飘远的隔一个画一个
    ctx.fillStyle = Gd.light[gi];
    for (const cl of cells) {
      const e = (D - thrOf(cl)) / 0.42;
      if (e <= 0 || (e > 0.45 && cl.i % 2)) continue;
      const [px, py] = flyPos(cl, e, t), sz = CS * Math.max(0.35, 1 - 0.5 * e), al = clamp(1.1 - 0.8 * e);
      ctx.globalAlpha = al;
      ctx.fillRect(x0 + px - sz / 2, y0 + py - sz / 2, sz, sz);
      if (e > 0.2) { const [qx, qy] = flyPos(cl, e - 0.07, t); ctx.globalAlpha = al * 0.3; ctx.fillRect(x0 + qx - sz / 2, y0 + qy - sz / 2, sz, sz); }
    }
  });
  ctx.globalAlpha = 1;
  const edge = 0.02; // 第九轮：散开边缘的亮格窄一些、淡一些（以前是一整条青白棋盘带）
  ctx.globalAlpha = 0.65;
  for (const cl of Gd.cells) {
    const f = D - thrOf(cl);
    if (f > 0 || f < -edge || D < 0.02) continue;
    ctx.fillStyle = (cl.i % 3) ? '#FFFFFF' : '#BFF4FF';
    ctx.fillRect(x0 + cl.x * CS, y0 + cl.y * CS, CS, CS);
  }
  ctx.restore();

  // 测量：拍头扫描线从上往下扫过，锁定框收拢，标签（第九轮：只在两个小节头）
  const m = measAt(S.t);
  if (m > 0.02) {
    const ma = S.t - T0();
    const sy = y0 + FH * clamp(ma / 0.3);
    const grad = ctx.createLinearGradient(0, sy - 60, 0, sy);
    grad.addColorStop(0, css('#BFF4FF', 0)); grad.addColorStop(1, css('#FFFFFF', 0.85 * m));
    ctx.fillStyle = grad; ctx.fillRect(x0 - 40, sy - 60, Gd.img.width + 80, 60);
    ctx.fillStyle = css(BRAND, m); ctx.fillRect(x0 - 40, sy, Gd.img.width + 80, 3);
    corners(ctx, x0 - 30 - 20 * (1 - m), y0 - 16 - 20 * (1 - m), Gd.img.width + 60 + 40 * (1 - m), FH + 32 + 40 * (1 - m), css(pal.acc[0], m), { len: 40, lw: 4, plus: false });
    ctx.font = fonts(20, 'ZENB', 'SCB'); ctx.fillStyle = css(pal.acc[0], m);
    ctx.fillText(`MEASURED · |ψ⟩ → |${hash(S.ni, 3) % 16}⟩`, x0 - 30, y0 - 30);
  }

  // 「量♪風」：唱到的字出现在她身边，然后被风吹走
  lyricKinetic(ctx, S, 'L11', (i, age, ch) => {
    if (i < 3 || i > 6 || age < 0) return null;
    const e = easeOutBack(clamp(age / 0.15), 2), drift = Math.max(0, age - 0.25);
    return { x: 1120 + (i - 3) * 130 + drift * drift * 260 + drift * 160, y: 600 + Math.sin(age * 4 + i) * 20 - drift * 40, s: e, r: drift * 0.4 * (i % 2 ? 1 : -1), a: 1 - clamp((drift - 1.2) / 0.6) };
  }, { size: 110, stroke: 14 });

  // 左下：采样分布（像草一样摆），拍头坍缩到一根柱。第九轮：柱子不再歪，只上下长，测量时坍缩
  const [bx0, by0, bw0, bh0] = [96, 640, 560, 360];
  card(ctx, S, bx0, by0, bw0, bh0, { title: 'sampling', age: S.lt - 0.1 }, c => {
    const pick = hash(1, 77) % 20, col = m > 0.05;
    for (let i = 0; i < 20; i++) {
      let v = 0.15 + 0.85 * vnoise(i * 0.6, t * 0.9, 0, 7) * (0.6 + 0.4 * w);
      if (col) v = i === pick ? lerp(v, 1, m) : v * (1 - 0.8 * m);
      const bw = c.w / 20, bh = v * (c.h - 110);
      ctx.save(); ctx.translate(c.x + i * bw + bw / 2, c.y + c.h - 70);
      ctx.fillStyle = i === pick && col ? pal.acc[0] : [BRAND, pal.ink[2], '#1FA88F'][i % 3];
      rrect(ctx, -bw / 2 + 3, -bh, bw - 6, bh, 4); ctx.fill(); ctx.restore();
    }
    const T = fact('recommended_temperature', 'r1'), Pp = fact('recommended_top_p', 'r1');
    ctx.font = font('ZENB', 22); ctx.fillStyle = pal.gray;
    ctx.fillText(`temperature ${T} · top_p ${Pp} · seed 114514`, c.x, c.y + c.h - 20);
  });

  // 右上：叠加态卡
  psiCard9(ctx, S, D, m);
}

// 第九轮右上卡：公式先大大地写出来，站一拍后缩成卡片顶上的标签（video-shotcraft title-demote-to-label），
// 下面长出一组首尾相接的旋转箭头（|ψ⟩ = Σ α_k|k⟩ 的每一项是一根，长度 = |α_k|，各自以不同速度转，末端拖出轨迹）；
// 右边一排直立的小柱是 p_k = |α_k|²。测量时整串箭头坍缩成一根、柱子只剩一根，然后再慢慢散开
const AMP = [0.52, 0.42, 0.36, 0.3, 0.26, 0.22]; // 演出值
function psiCard9(ctx, S, D, m) {
  const pal = S.pal, t = S.t, a = S.lt;
  card(ctx, S, 1180, 80, 640, 400, { title: '薛定谔的鲸', age: a - 0.2 }, c => {
    // 公式：前 0.5 s 大字居中，0.5–0.85 s 缩到左上（44 → 26 px）
    const dm = smooth(clamp((a - 0.5) / 0.35)), sz = lerp(44, 26, dm);
    drawFormula(ctx, 'psi', lerp(c.x + 60, c.x, dm), lerp(c.y + 90, c.y + 2, dm), { size: sz, color: pal.text, write: a - 0.15, dur: 0.3, sweep: dm >= 1 ? formulaFx(S, 0).sweep : undefined });
    const bo = clamp((a - 0.75) / 0.25);
    if (bo > 0) { ctx.save(); ctx.globalAlpha = bo; drawFormula(ctx, 'born', c.x + 250, c.y + 2, { size: 22, color: pal.gray }); ctx.restore(); }
    const g = clamp((a - 0.8) / 0.4);
    if (g <= 0) return;
    // 测量时第几项"中了"（演出值）
    const pick = 0, col = Math.max(m, 0);
    const amps = AMP.map((v, k) => (k === pick ? lerp(v, 1, col) : v * (1 - col)) * g);
    // 首尾相接的旋转箭头
    const ox = c.x + 160, oy = c.y + 210, R = 130, trail = [];
    const chain = tt => { let x = ox, y = oy; const pts = [[x, y]]; amps.forEach((v, k) => { const ang = tt * (1.2 + k * 1.1) * (k % 2 ? -1 : 1) + k; x += Math.cos(ang) * v * R * 0.85; y += Math.sin(ang) * v * R * 0.85; pts.push([x, y]); }); return pts; };
    for (let k = 0; k <= 36; k++) { const p = chain(t - k * 0.02); trail.push(p[p.length - 1]); }
    ctx.strokeStyle = css(pal.line, 0.25); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(ox, oy, R, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ox - R - 10, oy); ctx.lineTo(ox + R + 10, oy); ctx.moveTo(ox, oy - R - 10); ctx.lineTo(ox, oy + R + 10); ctx.stroke();
    trail.forEach((p, k) => { if (k) { ctx.strokeStyle = css(pal.acc[0], 0.85 * (1 - k / trail.length)); ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(...trail[k - 1]); ctx.lineTo(...p); ctx.stroke(); } });
    const pts = chain(t);
    pts.forEach((p, k) => {
      if (!k) return;
      const [x0, y0] = pts[k - 1], r = Math.hypot(p[0] - x0, p[1] - y0);
      if (r < 0.5) return;
      ctx.strokeStyle = css(BRAND, 0.22); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x0, y0, r, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = k - 1 === pick && col > 0.3 ? pal.acc[0] : BRAND; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(p[0], p[1]); ctx.stroke();
      ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.arc(p[0], p[1], 5, 0, Math.PI * 2); ctx.fill();
    });
    // p_k：直立的小柱
    const sum = amps.reduce((s, v) => s + v * v, 0) || 1, px0 = c.x + 360, py0 = c.y + c.h - 40;
    amps.forEach((v, k) => {
      const p = (v * v) / sum, h = 230 * p * g;
      ctx.fillStyle = k === pick && col > 0.3 ? pal.acc[0] : [BRAND, pal.ink[2], '#1FA88F'][k % 3];
      rrect(ctx, px0 + k * 40, py0 - h, 30, Math.max(3, h), 6); ctx.fill();
      ctx.font = fonts(14, 'ZENB', 'SCB'); ctx.fillStyle = pal.gray; ctx.textAlign = 'center'; ctx.fillText(`|${k}〉`, px0 + k * 40 + 15, py0 + 20); ctx.textAlign = 'left';
    });
    ctx.font = fonts(16, 'ZENB', 'SCB'); ctx.fillStyle = pal.gray;
    ctx.fillText(m > 0.3 ? 'MEASURED' : `intact ${Math.round(100 * (1 - clamp(D)))}%`, px0, c.y + 120);
  });
}

// 一个散开的格子飘到哪（相对立绘左上角）：往右下风吹，越晚散开的越慢，带一点上下摆
function flyPos(cl, e, t) {
  const bx = cl.x * CS + CS / 2, by = cl.y * CS + CS / 2, L = cl.lag;
  const swirl = vnoise(bx * 0.01, by * 0.01, t * 0.7, 3) - 0.5;
  return [bx + e * 160 * L + e * e * 560 * L, by - e * 40 * L + swirl * 70 * e]; // 第九轮：风更平顺，不抖
}
