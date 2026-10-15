// L06（20–21 小节，0:30.47–0:33.67）· "你教会了我什么是 I（爱）"（视觉方案 §5.2a 第六轮）
// 一个连贯的变形：L05 飞走的 0/1 从上面落下来聚成「AI」→ 20.3 粒子散开重组成「愛」，上面注音「♪」（愛读作 ai）
// → 唱到"I"的那一刻，「愛」变回「AI」，「A」掉下去、只剩「I」——左下公式卡同时把 king − man + woman ≈ queen 推导成 AI − A ≈ I
// → 她的手从右下伸进来碰那个 I，泛起波纹。左上：词向量卡（三根箭头转到几乎重合，cos 0.99 演出值）
import { W, H, BRAND, BEAT, STEP } from '../core/const.js';
import { barStart, beatTime, clamp, lerp, easeIn, easeOut, easeOutBack, smooth, decay } from '../core/time.js';
import { cutAt } from '../core/cuts.js';
import { hash, rnd } from '../core/rand.js';
import { font, fonts, glyphs } from '../core/glyphs.js';
import { keyword, onset } from '../core/data.js';
import { rev } from '../rev.js';
import { photo } from '../core/portrait.js';
import { drawSprite } from '../core/sprites.js';
import { flash } from '../core/fx.js';
import { camAt, withCam, camToScreen, pooled } from '../core/cam.js';
import { hud } from '../core/hud.js';
import { card } from '../core/kit.js';
import { drawFormula, morphFormula, fnum } from '../core/math.js';
import { sampleText, drawPoints } from '../core/particles.js';
import { newCanvas } from '../core/env.js';
import { paper, backDeco, frontDeco, punch, camBeat, safeZoom, formulaFx } from './scene.js';
import { binCells } from './l05.js';
import { css } from '../core/color.js';

// 第十六轮：镜头的起止跟着切点走（cutAt，画帧时取）
const T0 = () => cutAt(20), T1 = () => cutAt(22), T_LOVE = beatTime(20, 3), T_TOUCH = beatTime(21, 3);
const T_A17 = 31.09; // 第十七轮：「I（♪）」的「♪」实测起音（build/stems/vocals.wav 的谱通量）
const CX = 1000, CY = 470, PX = 300, SC = 1.6, N = 1400; // 巨字中心、采样字号、显示倍数、粒子数
const HAND = [0.0, 0.33, 0.42, 0.2];                     // 第八轮：I05（伸手向镜头）里伸出的手和小臂，手掌在这块的左边

const CAM = () => [
  { t: T0(), x: 0, y: -40, zoom: 1.08, rot: 0.01 },
  { t: T_LOVE, x: 20, y: 0, zoom: 1.0, rot: -0.006 },
  { t: T1() - 0.3, x: -30, y: 10, zoom: 1.06, rot: 0.008 },
];

// "A" 与 "I" 各自的中心（与 sampleText 同字体同字号量出来）
let SPLIT = null;
function split() {
  if (SPLIT) return SPLIT;
  const m = newCanvas(8, 8).getContext('2d');
  m.font = fonts(PX, 'DELA');
  const wA = m.measureText('A').width, wAI = m.measureText('AI').width, wI = wAI - wA;
  SPLIT = { a: (-wAI / 2 + wA / 2) * SC, i: (-wAI / 2 + wA + wI / 2) * SC };
  return SPLIT;
}

function bigText(ctx, S, str, x, y, { s = 1, r = 0, alpha = 1, age = 1, sx = 1, sy = 1, color = BRAND } = {}) {
  const pal = S.pal, off = 4 + 8 * decay(age, 10);
  ctx.save(); ctx.globalAlpha *= alpha;
  ctx.translate(x, y); ctx.rotate(r); ctx.scale(s * sx, s * sy);
  ctx.font = fonts(PX * SC, 'DELA', 'JB'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  ctx.globalAlpha *= 0.45; ctx.fillStyle = pal.acc[0]; ctx.fillText(str, -off, 0); ctx.fillStyle = pal.acc[2]; ctx.fillText(str, off, 0);
  ctx.globalAlpha /= 0.45; ctx.lineWidth = 18; ctx.strokeStyle = '#FFFFFF'; ctx.strokeText(str, 0, 0);
  ctx.fillStyle = color; ctx.fillText(str, 0, 0);
  ctx.restore();
}

// 第十一轮（用户：AI 的字效和动画节奏太僵；伸手图的裁切太突兀；embedding 指针加抖动；换一个更合适的转场）。
// 第十二轮（用户：AI 散成粒子云再聚回 AI 没有意义也不好看；A 掉下去以后 I 变粉；小臂那头的渐隐短一点，上下也加渐隐）。rev l06
const PINK = '#FF6FA8';
// 阻尼弹簧：事件后 dt 秒的偏移系数（1 → 0，带回摆）
const spring = (dt, k = 7, w = 18) => (dt < 0 ? 1 : Math.exp(-k * dt) * Math.cos(w * dt));
// 落地的挤压与拉伸：dt 秒前落地，返回 [sx, sy]
const squash = dt => { if (dt < 0) return [1, 1]; const v = Math.exp(-9 * dt) * Math.cos(26 * dt); return [1 + 0.12 * v, 1 - 0.16 * v]; };
// L07 从左上的 embedding 卡里打开（video-shotcraft shot-transitions F 式「穿窗」：记忆向量 → 记忆的提交记录）
const EMB = [40, 60, 520, 440];
export function embRect() {
  const cam = camAt(CAM(), T1() - 1 / 60), c = { ...cam, zoom: cam.zoom * safeZoom() };
  const [x0, y0] = camToScreen(c, 1, EMB[0], EMB[1]), [x1, y1] = camToScreen(c, 1, EMB[0] + EMB[2], EMB[1] + EMB[3]);
  return [x0, y0, x1 - x0, y1 - y0];
}

// 第十一轮的巨字：0/1 先落成 A、再落成 I（错开 0.08 s），每个字落定时压扁回弹、色差收拢；字平时左右两个字反相轻摆（跟随），
// 「愛」到位时过冲一下；唱到 I 时 A 先抖两下（预备）再掉下去，I 带过冲滑到中间
function bigWord11(ctx, S, kw, AI, LOVE, sp) {
  const pal = S.pal, t = S.t, land = [T0() + 0.24, T0() + 0.32]; // A、I 落定的时刻
  const sway = (i, a) => ({ r: 0.03 * Math.sin(S.n * Math.PI + i * Math.PI) * clamp(a / 0.3), dy: -5 * Math.sin(S.n * Math.PI * 2 + i) });
  // 第十二轮起 0/1 由转场从 L05 带过来（binHandoff），这里不再从画面上方落
  // 第十五轮（用户：中间翻转的「愛」出来得晚了一点，没和唱到「愛（I）」对齐）：翻牌提前 0.15 s 开始、翻得快一点（0.24 → 0.18 s），
  // 唱到「♪」（约 31.44）之前「愛」已经完整翻过来，一直停到「I」那一刻再翻回去
  // 第十七轮（用户：AI 变成爱的时间晚了，要在唱到「♪」的时候出现）：对时数据把「I」放在 31.49，其实「♪」在 31.09 就唱了
  // （人声分轨 31.03–31.05 的空隙之后的起音），以前 31.12 才开始翻、31.30 翻完，比「♪」晚。改成钉在实测的「♪」上：
  // 提前 0.25 s 开始翻，「♪」唱出来之前 0.07 s 已经翻完；翻回 AI、A 被撞掉仍在「I」那一刻。rev l06a17
  const FD = 0.18, TL = T_A17 - 0.25;
  if (t >= TL && t < kw.t0 + 0.15) { // 第十二轮：AI ⇄ 愛 改成翻牌（绕竖轴翻过去），读得出"AI 读作 ♪ = 愛"，不再散成粒子云
    const back = t >= kw.t0, f = back ? (t - kw.t0) / 0.15 : clamp((t - TL) / FD), first = f < 0.5, k = Math.abs(Math.cos(Math.PI * f));
    const str = back ? (first ? '愛' : 'AI') : first ? 'AI' : '愛', a = back ? t - kw.t0 : t - TL - FD / 2;
    const over = !back && !first ? 1 + 0.1 * spring(t - TL - FD, 6, 16) * (t > TL + FD ? 1 : 0) : 1;
    bigText(ctx, S, str, CX, CY + 4 * Math.sin(S.n * Math.PI * 2), { sx: Math.max(0.02, k) * over, sy: (1 + 0.06 * (1 - k)) * over, age: a, color: str === '愛' ? PINK : BRAND });
    if (!back && !first) furigana(ctx, S, t - TL - FD / 2);
    return;
  }
  if (t < TL) {
    ['A', 'I'].forEach((ch, i) => {
      const a = t - land[i];
      if (a < 0) return;
      const [sx, sy] = squash(a), w = sway(i, a);
      bigText(ctx, S, ch, CX + (i ? sp.i : sp.a), CY + w.dy, { sx, sy, r: w.r, age: a, alpha: clamp(a / 0.04) });
    });
  } else knock13(ctx, S, kw, sp, t - kw.t0 - 0.15);
}
const easeInOut = u => { u = clamp(u); return u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2; };

// 第十三轮（用户：I 把 A 撞下去时加碰撞模拟）。rev l06
// 0–0.08 s I 往右蓄一下（预备）→ 0.08–0.15 I 猛地往左撞 → 0.15 碰撞：A 拿到一个往左上的冲量和逆时针的角速度，之后按重力抛出去，
// 落到地面线（CY + 400）弹一次（竖向速度 ×−0.42、横向 ×0.6、角速度反向减半）再滚出画面；碰撞点迸出一圈小方块和两道速度线；
// I 撞完被反作用力弹回、挤压回弹，再滑到正中、染粉（同第十二轮）。物理按 1/240 s 定步长从碰撞那一刻积分，只由 t 决定
const T_HIT = 0.15, FLOOR13 = CY + 400;
function aBody(dt) {
  let x = 0, y = 0, r = 0, vx = -1250, vy = -720, w = -7.5, bounced = false;
  const h = 1 / 240;
  for (let s = 0; s < dt; s += h) {
    vy += 3300 * h; x += vx * h; y += vy * h; r += w * h;
    if (!bounced && CY + y > FLOOR13) { y = FLOOR13 - CY; vy *= -0.42; vx *= 0.6; w *= -0.5; bounced = true; }
  }
  return { x, y, r };
}
function knock13(ctx, S, kw, sp, a) {
  const pal = S.pal, t = S.t, ax0 = CX + sp.a, ix0 = CX + sp.i;
  // A
  if (a < T_HIT) { const sh = a > 0.03 ? 4 * Math.sin(a * 120) : 0; bigText(ctx, S, 'A', ax0 + sh, CY, { age: 1 }); }
  else {
    const b = aBody(a - T_HIT), [sx, sy] = a - T_HIT < 0.12 ? [0.86, 1.1] : [1, 1];
    if (CY + b.y < H + 400 && ax0 + b.x > -500) bigText(ctx, S, 'A', ax0 + b.x, CY + b.y, { r: b.r, sx, sy, age: 1, alpha: 1 - clamp((a - T_HIT - 1.1) / 0.3) });
  }
  // I：蓄力 → 撞 → 反弹 → 滑到中间
  const off = a < 0.08 ? 30 * Math.sin((Math.PI / 2) * (a / 0.08)) : a < T_HIT ? lerp(30, -46, easeIn((a - 0.08) / (T_HIT - 0.08))) : -46 * spring(a - T_HIT, 9, 16);
  const move = easeOutBack(clamp((a - T_HIT - 0.12) / 0.4), 1.6), ix = lerp(ix0, CX, move) + off;
  const touch = t >= T_TOUCH ? decay(t - T_TOUCH, 5) : 0, hit = a >= T_HIT ? Math.exp(-9 * (a - T_HIT)) * Math.cos(30 * (a - T_HIT)) : 0;
  const pink = smooth(clamp((a - 0.55) / 0.3));
  bigText(ctx, S, 'I', ix, CY, { s: 1 + 0.15 * clamp(move) + 0.08 * touch, sx: 1 - 0.14 * hit, sy: 1 + 0.12 * hit, r: a < T_HIT ? -0.05 * clamp(a / 0.08) : 0.04 * hit, age: a, color: pink > 0 ? mixHex(BRAND, PINK, pink) : BRAND });
  // 碰撞点：小方块迸开 + 两道速度线 + 一圈环
  const ia = a - T_HIT;
  if (ia >= 0 && ia < 0.5) {
    const px = (ax0 + ix0) / 2 - 20, py = CY - 20, e = easeOut(clamp(ia / 0.4)), f = 1 - clamp(ia / 0.45);
    ctx.save();
    ctx.strokeStyle = css(BRAND, 0.7 * f); ctx.lineWidth = 6 * f + 1; ctx.beginPath(); ctx.arc(px, py, 30 + 160 * e, 0, Math.PI * 2); ctx.stroke();
    for (let k = 0; k < 14; k++) {
      const ang = Math.PI * (0.55 + 0.9 * rnd(k, 51)), d = (80 + 180 * rnd(k, 52)) * e, s = 8 + 10 * rnd(k, 53);
      ctx.fillStyle = css(k % 3 ? BRAND : pal.acc[0], f); ctx.fillRect(px + Math.cos(ang) * d - s / 2, py - Math.sin(ang) * d * 0.8 + 120 * ia * ia - s / 2, s, s);
    }
    ctx.fillStyle = css('#FFFFFF', 0.9 * f);
    for (let k = 0; k < 2; k++) ctx.fillRect(px - 260 * e - 80, py - 60 + k * 120, 240 * f + 20, 5);
    ctx.restore();
  }
  if (t >= T_TOUCH) touchFx(ctx, S, t - T_TOUCH);
}
// 手碰到 I：粉色波纹、「I = 愛 = AI」、几颗心（从第十一轮的写法挪出来，两版共用）
function touchFx(ctx, S, ta) {
  const pal = S.pal;
  for (let k = 0; k < 3; k++) {
    const r = 60 + (ta - k * 0.12) * 700;
    if (r < 60) continue;
    ctx.strokeStyle = `rgba(255,111,168,${Math.max(0, 0.8 - (ta - k * 0.12) * 1.1)})`; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(CX, CY + 200, r, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.save(); ctx.globalAlpha = clamp(ta / 0.12);
  ctx.font = fonts(54, 'ZENB', 'J'); ctx.textAlign = 'center'; ctx.fillStyle = pal.acc[0];
  ctx.fillText('I = 愛 = AI', CX - 320, CY + 300 - 16 * spring(ta, 7, 18)); ctx.restore();
  for (let k = 0; k < 6; k++) drawSprite(ctx, 'heart', 5, pal, CX + Math.cos(k + ta) * (180 + ta * 200), CY + Math.sin(k * 2.1) * 160 - ta * 120, 1, 1 - clamp((ta - 0.4) / 0.4));
}
// 「愛」上面的注音 ♪ = ai
function furigana(ctx, S, a) {
  ctx.save(); ctx.globalAlpha = clamp(a / 0.12);
  ctx.font = fonts(70, 'ZENB', 'J'); ctx.textAlign = 'center'; ctx.fillStyle = S.pal.acc[0];
  ctx.fillText('あい', CX, CY - 290 - 20 * (1 - easeOutBack(clamp(a / 0.2), 2)));
  ctx.font = fonts(34, 'ZENB', 'SCB'); ctx.fillStyle = S.pal.gray; ctx.fillText('= ai', CX + 150, CY - 290);
  ctx.restore();
}

// 转场用（第十二轮，L06 → L07：粉色的 I 变成 L07 的粉色焦点框）：t 时刻 I 在屏幕上的外框 [x, y, w, h]
let IBOX = null;
export function iShape(t) {
  if (!IBOX) {
    const m = newCanvas(8, 8).getContext('2d'); m.font = fonts(PX * SC, 'DELA', 'JB'); m.textBaseline = 'middle'; m.textAlign = 'center';
    const q = m.measureText('I'); IBOX = [-q.actualBoundingBoxLeft, -q.actualBoundingBoxAscent, q.actualBoundingBoxLeft + q.actualBoundingBoxRight, q.actualBoundingBoxAscent + q.actualBoundingBoxDescent];
  }
  const kw = keyword('L06', 5, 6)[0], a = t - kw.t0 - 0.15, touch = t >= T_TOUCH ? decay(t - T_TOUCH, 5) : 0;
  const s = 1 + 0.15 + 0.08 * touch, c = camOfL06(t);
  const [x0, y0] = camToScreen(c, 1, CX + IBOX[0] * s, CY + IBOX[1] * s), [x1, y1] = camToScreen(c, 1, CX + (IBOX[0] + IBOX[2]) * s, CY + (IBOX[1] + IBOX[3]) * s);
  return a > 0.5 ? [x0, y0, x1 - x0, y1 - y0] : null;
}
const camOfL06 = t => { const cam = camAt(CAM(), t); return { ...cam, zoom: cam.zoom * safeZoom() }; };

// 第十二轮 L05 → L06 的转场叠层（rev l05to06）：L05 马赛克的每一格带着自己的颜色和 0/1 起飞，划一道弧线落到「AI」的一个采样点上，
// 落 A 的在 A 落定时到、落 I 的晚 0.08 s 到（和 bigWord11 的 land 一致）。飞行中颜色块缩小、0/1 由马赛克的深 / 白字变成品牌蓝
let HAND_CELLS = null;
export function binHandoff(ctx, S) {
  const t = S.t, cells = (HAND_CELLS ??= binCells()), sp = split(), AI = sampleText('AI', N, { keys: ['DELA'], px: PX });
  const land = [T0() + 0.24, T0() + 0.32], c = camOfL06(t), g = [glyphs('SCB', BRAND), glyphs('SCB', '#1D2541'), glyphs('SCB', '#FFFFFF')];
  cells.forEach((q, j) => {
    if (t < q.dep) return;
    const i = (j * 2) % N, right = AI.x[i] * SC > (sp.a + sp.i) / 2, tl = land[right ? 1 : 0] - 0.02;
    if (t >= tl) return;
    const [tx, ty] = camToScreen(c, 1, CX + AI.x[i] * SC, CY + AI.y[i] * SC);
    const u = clamp((t - q.dep) / (tl - q.dep)), e = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2; // 二次缓入缓出
    const pop = Math.sin(Math.PI * clamp((t - q.dep) / 0.12)) * 14 * (1 - u);                        // 起飞先往上弹一下
    const cx = lerp(q.x, tx, 0.5) + (rnd(j, 31) - 0.5) * 420, cy = Math.min(q.y, ty) - 220 - rnd(j, 32) * 260;
    const x = (1 - e) ** 2 * q.x + 2 * (1 - e) * e * cx + e * e * tx, y = (1 - e) ** 2 * q.y + 2 * (1 - e) * e * cy + e * e * ty - pop;
    const sq = q.size * (1 - 0.85 * smooth(clamp(u / 0.7)));
    if (sq > 1) { ctx.fillStyle = q.col; ctx.fillRect(x - sq / 2, y - sq / 2, sq, sq); }
    (u > 0.45 ? g[0] : q.dark ? g[1] : g[2]).draw(ctx, q.ch, x - 6, y - 10);
  });
}
const mixHex = (a, b, u) => { const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), A = p(a), B = p(b); return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], u))).join(',')})`; };

// 第十一轮的手：不再是一块硬裁的长方形——往小臂那一头渐隐，渐隐的地方散成像素点（像从数据里伸出来），手的边缘一圈淡淡的白光
function hand11(ctx, S, ha, t) {
  const reach = easeOut(clamp(ha / (T_TOUCH - handStart()))), hw = 560, hh = 500;
  const hx = lerp(W + 300, CX + 150 + 0.28 * hw, reach) + 10 * spring(t - T_TOUCH, 6, 14) * (t >= T_TOUCH ? 1 : 0), hy = lerp(H + 100, CY + 230, reach) + 6 * Math.sin(t * 3);
  const src = photo('I05', HAND, hw, hh, { keyed: true }), cv = pooled('l06hand', hw + 40, hh + 40), c = cv.getContext('2d');
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height);
  c.drawImage(src, 20, 20);
  c.globalCompositeOperation = 'destination-in';
  // 第十三轮（用户：上下还是看得出硬裁）：不再用横、竖两条线性渐隐（裁切边是直线，渐隐再宽也看得出一条线），
  // 改成以手掌为中心的椭圆渐隐，四周都是软的；白色光晕在羽化之后再加，光晕跟着软边走，不再描出裁切线
  c.save(); c.translate(20 + hw * 0.36, 20 + hh * 0.52); c.scale(1, 0.86);
  const rg = c.createRadialGradient(0, 0, hw * 0.16, 0, 0, hw * 0.58);
  rg.addColorStop(0, 'rgba(0,0,0,1)'); rg.addColorStop(0.55, 'rgba(0,0,0,0.85)'); rg.addColorStop(0.8, 'rgba(0,0,0,0.35)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = rg; c.fillRect(-hw, -hh * 1.4, hw * 2, hh * 2.8); c.restore();
  // 第十五轮（用户：伸手图的上下仍有明显硬切——柔和过渡的起点是否对准切割线、起点透明度是不是 0%）：查了，不是——
  // 椭圆渐隐以手掌为中心，到裁切的上边还剩约 12% 的不透明度、下边约 25%，所以一条直的裁切线还在，白光晕又把它描了出来。
  // 现在再乘一层贴着四条裁切边的羽化：每条边上不透明度正好是 0，向里按 smootherstep 升到 1（上下各 30%、小臂一侧 35%、指尖一侧 6%）。rev l06c
  {
    const iw = src.width, ih = src.height, ramp = (g, a, b) => { for (let k = 0; k <= 8; k++) { const s = k / 8; g.addColorStop(a + (b - a) * s, `rgba(0,0,0,${(s * s * s * (s * (6 * s - 15) + 10)).toFixed(4)})`); } };
    const gy = c.createLinearGradient(0, 20, 0, 20 + ih); ramp(gy, 0, 0.3); gy.addColorStop(0.5, 'rgba(0,0,0,1)'); for (let k = 0; k <= 8; k++) { const s = k / 8; gy.addColorStop(0.7 + 0.3 * s, `rgba(0,0,0,${(1 - s * s * s * (s * (6 * s - 15) + 10)).toFixed(4)})`); }
    c.fillStyle = gy; c.fillRect(0, 0, cv.width, cv.height);
    const gx = c.createLinearGradient(20, 0, 20 + iw, 0); ramp(gx, 0, 0.06); gx.addColorStop(0.4, 'rgba(0,0,0,1)'); for (let k = 0; k <= 8; k++) { const s = k / 8; gx.addColorStop(0.65 + 0.35 * s, `rgba(0,0,0,${(1 - s * s * s * (s * (6 * s - 15) + 10)).toFixed(4)})`); }
    c.fillStyle = gx; c.fillRect(0, 0, cv.width, cv.height);
  }
  c.globalCompositeOperation = 'source-over';
  ctx.save(); ctx.translate(hx, hy); ctx.rotate(-0.25 + 0.1 * reach);
  ctx.save(); ctx.shadowColor = 'rgba(255,255,255,0.8)'; ctx.shadowBlur = 16; ctx.drawImage(cv, -hw / 2 - 20, -hh / 2 - 20); ctx.restore();
  // 渐隐处散开的像素：沿着小臂往右后方飘
  for (let i = 0; i < 46; i++) {
    const u = (t * (0.6 + rnd(i, 3) * 0.5) + rnd(i, 4)) % 1, x = -hw / 2 + hw * (0.55 + 0.4 * rnd(i, 5)) + u * 90, y = -hh / 2 + hh * (0.25 + 0.5 * rnd(i, 6)) - u * 30;
    const s = 6 + (i % 3) * 4;
    ctx.fillStyle = css(i % 3 ? BRAND : S.pal.acc[0], (1 - u) * 0.8 * reach); ctx.fillRect(x, y, s, s);
  }
  ctx.restore();
}

export function l06(ctx, S) {
  const kw = keyword('L06', 5, 6)[0], cam = camAt(CAM(), S.t);
  const hit = Math.max(decay(S.t - T_LOVE, 8) * (S.t >= T_LOVE ? 1 : 0), S.t >= kw.t0 ? decay(S.t - kw.t0, 8) : 0, S.t >= T_TOUCH ? decay(S.t - T_TOUCH, 8) : 0);
  const c = { ...cam, zoom: cam.zoom * punch(S, 0.02) * (1 + 0.05 * hit * camBeat(S)) * safeZoom() };
  paper(ctx, S, c);
  backDeco(ctx, S, c, 60, { alpha: 0.45 });
  withCam(ctx, c, 1, g => content(g, S, kw));
  frontDeco(ctx, S, c, 61, { alpha: 0.55, items: [['ring', 1900, 80, 260], ['hex', -80, 960, 30]] });
  hud(ctx, S, { spectrum: false });
  flash(ctx, camBeat(S) * (0.18 * (S.t >= T_LOVE ? decay(S.t - T_LOVE, 18) : 0) + 0.18 * (S.t >= kw.t0 ? decay(S.t - kw.t0, 18) : 0)));
}

function content(ctx, S, kw) {
  const pal = S.pal, t = S.t, sp = split();
  const AI = sampleText('AI', N, { keys: ['DELA'], px: PX }), LOVE = sampleText('愛', N, { keys: ['DELA', 'JB'], px: PX });

  // 左上：词向量卡
  card(ctx, S, 40, 60, 520, 440, { title: 'embedding', age: S.lt - 0.15 }, c => {
    const ox = c.x + 60, oy = c.y + c.h - 90, R = 250;
    ctx.strokeStyle = pal.tint[3]; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(ox - 20, oy); ctx.lineTo(ox + R + 40, oy); ctx.moveTo(ox, oy + 20); ctx.lineTo(ox, oy - R - 20); ctx.stroke();
    let angAI = 40, angLove = lerp(80, 43, easeOut(clamp((t - T_LOVE) / 0.3))), angI = lerp(10, 38, easeOut(clamp((t - kw.t0) / 0.3)));
    { // 指针像指南针：转到位时过冲回摆，平时也轻轻颤
      angAI += 1.2 * Math.sin(t * 7.3) + (t > T0() + 0.2 ? 6 * spring(t - T0() - 0.2, 5, 16) : 0);
      angLove = lerp(80, 43, clamp((t - T_LOVE) / 0.2)) + (t >= T_LOVE + 0.2 ? -9 * spring(t - T_LOVE - 0.2, 6, 20) : 0) + 1.4 * Math.sin(t * 8.1 + 1);
      angI = lerp(10, 38, clamp((t - kw.t0) / 0.2)) + (t >= kw.t0 + 0.2 ? 10 * spring(t - kw.t0 - 0.2, 6, 20) : 0) + 1.1 * Math.sin(t * 6.7 + 2);
    }
    const arrows = [['AI', angAI, BRAND], ['愛', angLove, pal.acc[0]], ['I', angI, '#1FA88F']];
    for (const [lab, deg, col] of arrows) {
      const a = (deg * Math.PI) / 180, x = ox + Math.cos(a) * R, y = oy - Math.sin(a) * R;
      ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(x, y); ctx.stroke();
      ctx.save(); ctx.translate(x, y); ctx.rotate(-a); ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-14, -9); ctx.lineTo(-14, 9); ctx.closePath(); ctx.fill(); ctx.restore();
      ctx.font = fonts(30, 'ZENB', 'JB'); ctx.fillText(lab, x + 10, y - 6);
    }
    drawFormula(ctx, 'cos', c.x + 4, c.y + c.h - 4, { size: 30, valign: 'bottom', color: pal.text, ...formulaFx(S, S.lt - 0.3) });
    if (t >= kw.t0) fnum(ctx, '= 0.99', c.x + 250, c.y + c.h - 20, 36, { color: BRAND, alpha: clamp((t - kw.t0) / 0.2) });
  });

  // 左下：推导卡 king − man + woman ≈ queen → AI − A ≈ I
  const fa = t - (beatTime(20, 2));
  if (fa >= 0) card(ctx, S, 40, 790, 820, 180, { title: 'word2vec', age: fa, fill: pal.tint[1] }, c => {
    const mu = clamp((t - kw.t0) / 0.35);
    {  // 第十轮：逐字插值时箭头和字会错位，改成旧式子上浮淡出、新式子重新写出来
      const o = { size: 46, align: 'c', valign: 'mid', color: pal.text };
      if (mu < 0.5) { ctx.save(); ctx.translate(0, -24 * easeOut(mu * 2)); drawFormula(ctx, 'w2v_king', c.x + c.w / 2, c.y + c.h / 2, { ...o, write: fa, dur: 0.4, alpha: 1 - mu * 2 }); ctx.restore(); }
      if (t >= kw.t0 + 0.15) drawFormula(ctx, 'w2v_ai', c.x + c.w / 2, c.y + c.h / 2, { ...o, write: t - kw.t0 - 0.15, dur: 0.3, sweep: formulaFx(S, 0).sweep });
    }
  });

  // 巨字的变化
  bigWord11(ctx, S, kw, AI, LOVE, sp);

  // 她的手：21.1 起从右下伸进来，21.3 碰到 I
  // 第二十二轮（用户：伸手素材提前到唱到「♪」的「♪」时进入）：「♪」实测 32.08（21 小节强拍），以前手 32.07 才从画面外起步、
  // 约 0.15 s 后才露进画面；改成提前 0.2 s 起步，唱到「♪」时手已经在往里伸，碰到 I 的时刻不变。（第二十四轮并开关）
  // 第二十四轮（用户：0:31 伸手素材再提前一个节拍）：起步再早一拍（「♪」前 0.2 s + 一拍），碰到 I 仍在 21 小节第 3 拍；
  // 伸进来还是同一条缓出曲线（只是拉长），前半段就已经伸进画面大半（第二十六轮并开关 l06h24）
  const ha = t - handStart();
  if (ha >= 0) hand11(ctx, S, ha, t);
}
const handStart = () => onset('L06', 9) - 0.2 - BEAT; // 第二十六轮并开关 l06h24
