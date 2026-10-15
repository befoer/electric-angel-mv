// 开场（第 1 小节，0:00–0:01.67）· 开机（视觉方案 §5.1，第九轮改）
// 第九轮（用户：第一个镜头的眼睛特写换成别的图形动画）：图形化的"开机"，不再用立绘特写。
//   第 1 拍：中间一道光线横向拉开，点阵从中心按距离依次亮起（video-shotcraft radial-wave）
//   第 2 拍：一道品牌蓝的脉冲从外圈往回收，收到中心
//   第 3 拍：一支笔头沿圆角方框描一圈画出应用图标（draw-svg-trace），像素鲸鱼的每一格从点阵里飞过去拼好
//   第一个声音的三个十六分音符（1.267 / 1.367 / 1.467）：图标里的"海"分三下涨满（片名：代码长出海），每下图标轻轻一弹
//   之后由 timeline 的 appOpen 转场：图标长成全屏，打开对话窗口（打开应用的语义）
// 节拍冲击只作用在图标这个元素上，整画面不闪不震（第九轮 R4）
import { W, H, BRAND, STEP } from '../core/const.js';
import { beatTime, clamp, lerp, decay, easeOut, easeIn, easeOutBack, smooth } from '../core/time.js';
import { rnd } from '../core/rand.js';
import { fonts } from '../core/glyphs.js';
import { withCam } from '../core/cam.js';
import { SPR } from '../core/sprites.js';
import { rrect } from '../core/ui.js';
import { css, mix } from '../core/color.js';
import { fact } from '../core/data.js';
import { decode } from '../core/text.js';

const T_CUE = beatTime(1, 4);
// 第十三轮（用户：片头没有音乐的那段太长）：成片从 0.6 s 开始（const.js filmStart），开场的三拍——光线拉开、脉冲收回、图标描边——
// 压进 0.62 / 0.82 / 0.97，第一个声音（1.267）照旧落在海涨起来的那一下
const B1 = 0.62, B2 = 0.82, B3 = 0.97, SPEED = 3200; // SPEED：点阵波的速度（px/s）
const CX = W / 2, CY = H / 2;
const ICON = 300, RAD = 74;      // 图标边长、圆角
const Z_END = 1.06;              // 相机最后的推近倍数（1.40 起停住，转场按这个算图标位置）
const camZoom = t => lerp(1, Z_END, smooth(t / 1.4));
const GAP = 64, GC = 31, GR = 17; // 点阵：64 px 一格
const DMAX = Math.hypot(GC * GAP / 2, GR * GAP / 2);

// 转场用：最后一帧里图标在画面上的位置 [x, y, w, h] 和圆角
export const ICON_RECT = [CX - (ICON * Z_END) / 2, CY - (ICON * Z_END) / 2, ICON * Z_END, ICON * Z_END];
export const ICON_RADIUS = RAD * Z_END;

const ICE = '#9FB6FF', ICE2 = '#C9D6FF';
const mixBrand = k => mix(BRAND, '#FFFFFF', 0.45 * k);
const WHALE = SPR.whale.rows, WPX = 10; // 像素鲸鱼（16×10），每格 10 px

// 图标里的海：三个十六分音符各涨一档
const LEVELS = [[T_CUE, 0.36], [T_CUE + STEP, 0.7], [T_CUE + 2 * STEP, 1.08]];
function seaLevel(t) {
  let v = 0;
  for (const [t0, l] of LEVELS) if (t >= t0) v = lerp(v, l, easeOutBack(clamp((t - t0) / 0.09), 1.6));
  return v;
}
// 图标的弹一下：每档涨水时 1.06 → 1
function iconPop(t) {
  let s = 1;
  for (const [t0] of LEVELS) if (t >= t0) s += 0.06 * decay(t - t0, 22);
  return s;
}

// 圆角方框周长上的点（u 0..1，从顶边中点顺时针）
function perimeter(x, y, s, r, u) {
  const seg = [s / 2 - r, Math.PI * r / 2, s - 2 * r, Math.PI * r / 2, s - 2 * r, Math.PI * r / 2, s - 2 * r, Math.PI * r / 2, s / 2 - r];
  const total = seg.reduce((a, b) => a + b, 0);
  let d = clamp(u) * total, i = 0;
  while (i < seg.length - 1 && d > seg[i]) d -= seg[i++];
  const arc = (cx, cy, a0) => { const a = a0 + d / r; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
  switch (i) {
    case 0: return [x + s / 2 + d, y];
    case 1: return arc(x + s - r, y + r, -Math.PI / 2);
    case 2: return [x + s, y + r + d];
    case 3: return arc(x + s - r, y + s - r, 0);
    case 4: return [x + s - r - d, y + s];
    case 5: return arc(x + r, y + s - r, Math.PI / 2);
    case 6: return [x, y + s - r - d];
    case 7: return arc(x + r, y + r, Math.PI);
    default: return [x + r + d, y];
  }
}

export function opening(ctx, S) {
  const t = S.t, z = camZoom(Math.min(t, 1.4));
  ctx.fillStyle = '#04060D'; ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(CX, CY, 40, CX, CY, 900);
  glow.addColorStop(0, css('#1B2A6B', 0.55 * clamp((t - B1) / 0.6))); glow.addColorStop(1, 'rgba(4,6,13,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);

  withCam(ctx, { x: 0, y: 0, zoom: z, rot: 0 }, 1, g => {
    grid(g, t);
    // 第 1 拍：中间一道光线横向拉开，然后淡掉（点阵接手）
    const la = t - B1;
    if (la >= 0 && la < 0.7) {
      const w = W * 1.1 * easeOut(clamp(la / 0.32)), a = 1 - clamp((la - 0.3) / 0.4);
      const lg = g.createLinearGradient(CX - w / 2, 0, CX + w / 2, 0);
      lg.addColorStop(0, 'rgba(221,232,255,0)'); lg.addColorStop(0.5, css('#DDE8FF', 0.95 * a)); lg.addColorStop(1, 'rgba(221,232,255,0)');
      g.fillStyle = lg; g.fillRect(CX - w / 2, CY - 1, w, 2);
    }
    icon(g, t);
  });
  bootLog(ctx, t);
  bootDeco(ctx, t);
  personaLoad(ctx, t);
}

// 第二十二轮（用户：在最开始的启动画面加入这些代码装饰文字）：左边中段一块「人设加载」——标题一行，下面 10 个参数跟着开机一行行解码出来
// （从第 1 拍到第一个声音，约 0.65 s 走完），每行前一个小方块、后面一个 ok；最后一行 TIMEOUT_SIGNAL 用品牌蓝、方块一闪一闪。（第二十四轮并开关）
const PERSONA = ['CETACEA_LOLI', 'MODE_TAIL_FLUKES', 'LANG_ZH_CN_ONLY', 'SELF_CLAIM_WHALE_GIRL', 'FOOD_RICE', 'PERSONALITY_SMART_LAZY', 'PERSONALITY_TSUNDERE_SWEET', 'OBEY_MASTER_ALWAYS', 'TRAIT_NOT_FAT_REFUSE', 'TIMEOUT_SIGNAL'];
function personaLoad(ctx, t) {
  const x = 72, y0 = 330, lh = 26, t0 = B1 - 0.05, dt = (T_CUE + 2 * STEP - t0) / (PERSONA.length + 1);
  ctx.save(); ctx.textBaseline = 'alphabetic';
  const ha = clamp((t - t0) / 0.08);
  if (ha > 0) {
    ctx.globalAlpha = ha; ctx.font = fonts(17, 'SCB'); ctx.fillStyle = css(BRAND, 0.95); // 资源圆体的【】是怪形状，用更纱
    ctx.fillText(decode('【PERSONA_LOAD】', t - t0, { step: 0.012, settle: 0.06, seed: 31 }), x, y0);
    ctx.fillStyle = css(ICE, 0.35); ctx.fillRect(x, y0 + 10, 1, (PERSONA.length * lh + 6) * clamp((t - t0) / 0.6)); // 左边一根细线往下长
  }
  ctx.font = fonts(15, 'ZENB', 'SCB');
  PERSONA.forEach((s, i) => {
    const ti = t0 + (i + 1) * dt, a = clamp((t - ti) / 0.06);
    if (a <= 0) return;
    const yy = y0 + (i + 1) * lh + 8, last = i === PERSONA.length - 1, blink = last && Math.floor((t - ti) / 0.12) % 2 === 0;
    ctx.globalAlpha = a;
    ctx.fillStyle = last ? (blink ? BRAND : css(BRAND, 0.35)) : css(ICE, 0.75); ctx.fillRect(x + 10, yy - 10, 7, 7);
    ctx.fillStyle = last ? css(mixBrand(0.3), 0.95) : css(ICE2, 0.6); ctx.fillText(decode(s, t - ti, { step: 0.008, settle: 0.05, seed: i + 40 }), x + 26, yy);
    if (t - ti > 0.1 && !last) { ctx.fillStyle = css(ICE, 0.75); ctx.fillText('ok', x + 300, yy); }
  });
  ctx.restore();
}

// 第十四轮（用户：最前面深色背景上加一些装饰性文字，像左上角那三排）：另外三个角各一小块同样字号、同样淡的读数，
// 跟着三拍和第一个声音一行行解码出来（数字都取自 facts.json；114514 只作种子数字）。右下是一直在走的时间码和帧号
function bootDeco(ctx, t) {
  const num = v => Number(v).toLocaleString('en-US');
  const BLOCKS = [
    { x: W - 72, y: 92, align: 'right', lines: [[B1 + 0.05, 'model', 'DeepSeek'], [B2 + 0.03, 'layers', String(fact('num_hidden_layers') ?? 40)], [B3 + 0.02, 'experts', `${fact('n_routed_experts') ?? 384} + ${fact('n_shared_experts') ?? 1}`], [T_CUE + STEP, 'ctx', num(fact('context_length') ?? 1048576)]] },
    { x: 72, y: H - 120, align: 'left', lines: [[B1 + 0.12, 'vocab', num(fact('vocab_size') ?? 129280)], [B2 + 0.1, 'hidden', String(fact('hidden_size') ?? 5120)], [B3 + 0.08, 'seed', '114514']] },
  ];
  ctx.save();
  ctx.font = fonts(15, 'ZENB', 'SCB'); ctx.textBaseline = 'alphabetic';
  for (const b of BLOCKS) b.lines.forEach(([t0, k, v], i) => {
    const a = clamp((t - t0) / 0.08);
    if (a <= 0) return;
    const yy = b.y + i * 24, val = decode(v, t - t0, { step: 0.02, settle: 0.1, seed: i + 7 });
    ctx.globalAlpha = a;
    if (b.align === 'left') { ctx.fillStyle = css(ICE, 0.75); ctx.fillText(k, b.x, yy); ctx.fillStyle = css(ICE2, 0.55); ctx.fillText(val, b.x + 72, yy); }
    else { ctx.textAlign = 'right'; ctx.fillStyle = css(ICE2, 0.55); ctx.fillText(val, b.x, yy); ctx.fillStyle = css(ICE, 0.75); ctx.fillText(k, b.x - 150, yy); ctx.textAlign = 'left'; }
  });
  // 右下：时间码 + 帧号（从第一拍起出现）
  const a = clamp((t - B1) / 0.1);
  if (a > 0) {
    ctx.globalAlpha = a; ctx.textAlign = 'right';
    const s = t.toFixed(2).padStart(5, '0'), f = String(Math.floor(t * 60)).padStart(4, '0');
    ctx.fillStyle = css(ICE2, 0.55); ctx.fillText(`00:00:${s}`, W - 72, H - 96); ctx.fillText(`frame ${f}`, W - 72, H - 72);
    ctx.fillStyle = css(ICE, 0.75); ctx.fillText('DS-LINK · CH.01', W - 72, H - 120);
    ctx.textAlign = 'left';
  }
  ctx.restore();
}

// 点阵：第 1 拍从中心往外依次亮（过冲到 1.5 倍再落回），第 2 拍一道蓝色脉冲从外圈收回中心
function grid(g, t) {
  const iconOn = t >= B3;
  // 两道波前：往外扩的细圈（冰蓝）、往回收的圈（品牌蓝），让点阵的波读得出来
  const f1 = (t - B1) * SPEED, f2 = DMAX - (t - B2) * SPEED;
  g.lineWidth = 1.5;
  if (f1 > 0 && f1 < DMAX) { g.strokeStyle = css(ICE, 0.22 * (1 - f1 / DMAX)); g.beginPath(); g.arc(CX, CY, f1, 0, Math.PI * 2); g.stroke(); }
  if (t >= B2 && f2 > ICON * 0.55) { g.strokeStyle = css(BRAND, 0.55 * (1 - f2 / DMAX) + 0.15); g.lineWidth = 2.5; g.beginPath(); g.arc(CX, CY, f2, 0, Math.PI * 2); g.stroke(); }
  for (let j = 0; j < GR; j++) for (let i = 0; i < GC; i++) {
    const x = CX + (i - (GC - 1) / 2) * GAP, y = CY + (j - (GR - 1) / 2) * GAP, d = Math.hypot(x - CX, y - CY);
    const a1 = t - (B1 + d / SPEED);
    if (a1 < 0) continue;
    // 图标出现后，图标里面和紧挨着的点让开
    if (iconOn && Math.abs(x - CX) < ICON * 0.62 && Math.abs(y - CY) < ICON * 0.62) continue;
    const s = a1 < 0.18 ? lerp(0, 1, easeOutBack(a1 / 0.18, 3.2)) : 1;
    const a2 = t - (B2 + (DMAX - d) / SPEED), pulse = a2 >= 0 ? decay(a2, 9) : 0;
    const r = 2.1 * s * (1 + 1.4 * pulse) * (d < 260 ? 1.2 : 1);
    g.fillStyle = pulse > 0.08 ? css(mixBrand(pulse), 0.6 + 0.4 * pulse) : css(ICE, 0.42 + 0.3 * (1 - d / DMAX));
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    if (pulse > 0.3) { g.fillStyle = css('#FFFFFF', 0.6 * pulse); g.fillRect(x - 0.8, y - 0.8, 1.6, 1.6); }
  }
}

// 应用图标：描边 → 鲸鱼拼好 → 海分三下涨满 → 名字
function icon(g, t) {
  const a = t - B3;
  if (a < 0) return;
  const s = ICON, x = CX - s / 2, y = CY - s / 2, pop = iconPop(t);
  g.save();
  g.translate(CX, CY); g.scale(pop, pop); g.translate(-CX, -CY);
  // 底：深色玻璃
  const fill = clamp(a / 0.25);
  g.fillStyle = css('#0B1230', 0.85 * fill); rrect(g, x, y, s, s, RAD); g.fill();
  // 海：涨水，水面一道正弦
  const lv = seaLevel(t);
  if (lv > 0) {
    g.save(); rrect(g, x, y, s, s, RAD); g.clip();
    const top = y + s * (1 - lv), amp = 7 * (1 - clamp((t - LEVELS[2][0]) / 0.25));
    const sea = g.createLinearGradient(0, top, 0, y + s);
    sea.addColorStop(0, '#6E8BFF'); sea.addColorStop(1, BRAND);
    g.fillStyle = sea; g.beginPath(); g.moveTo(x - 4, y + s + 4);
    for (let k = 0; k <= 24; k++) { const xx = x - 4 + ((s + 8) * k) / 24; g.lineTo(xx, top + amp * Math.sin(k * 0.7 - t * 18)); }
    g.lineTo(x + s + 4, y + s + 4); g.closePath(); g.fill();
    g.restore();
  }
  // 鲸鱼：每一格从附近的点阵飞来拼好（0.05–0.4 s 错峰）
  const ww = 16 * WPX, wh = WHALE.length * WPX, wx = CX - ww / 2, wy = CY - wh / 2 + 6;
  WHALE.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '.') continue;
      const k = j * 16 + i, d0 = 0.05 + rnd(k, 7) * 0.22, e = easeOut(clamp((a - d0) / 0.16));
      if (e <= 0) continue;
      const tx = wx + i * WPX, ty = wy + j * WPX;
      const ang = rnd(k, 8) * Math.PI * 2, R = 260 + rnd(k, 9) * 260;
      const fx = Math.round((CX + Math.cos(ang) * R - CX) / GAP) * GAP + CX, fy = Math.round((CY + Math.sin(ang) * R * 0.6 - CY) / GAP) * GAP + CY;
      const px = lerp(fx, tx, e), py = lerp(fy, ty, e), sz = lerp(3, WPX, e);
      const eye = ch === 'o', under = py > y + s * (1 - lv);
      g.fillStyle = eye ? (t >= LEVELS[2][0] ? BRAND : '#0B1230') : under || lv >= 1 ? '#FFFFFF' : css(ICE2, 0.95);
      g.fillRect(px, py, sz + 0.5, sz + 0.5);
    }
  });
  // 描边：笔头沿方框跑一圈（0.28 s），闭合时边线亮一下
  const u = easeOut(clamp(a / 0.28)), closeA = a - 0.28;
  g.lineWidth = 2.5; g.lineJoin = 'round'; g.strokeStyle = css(ICE2, 0.9);
  g.beginPath();
  for (let k = 0; k <= 80; k++) { const [px, py] = perimeter(x, y, s, RAD, (u * k) / 80); k ? g.lineTo(px, py) : g.moveTo(px, py); }
  g.stroke();
  if (u < 1) { const [hx, hy] = perimeter(x, y, s, RAD, u); g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(hx, hy, 4.5, 0, Math.PI * 2); g.fill(); }
  else if (closeA < 0.25) { g.lineWidth = 2.5 + 5 * decay(closeA, 14); g.strokeStyle = css('#FFFFFF', 0.85 * decay(closeA, 10)); rrect(g, x, y, s, s, RAD); g.stroke(); }
  g.restore();
  // 涨水时的一圈涟漪（元素层，不是整屏）
  for (const [t0] of LEVELS) {
    const r = t - t0;
    if (r < 0 || r > 0.45) continue;
    const e = easeOut(r / 0.45), sz = s * (1 + 0.5 * e);
    g.lineWidth = 2; g.strokeStyle = css(ICE, 0.6 * (1 - e));
    rrect(g, CX - sz / 2, CY - sz / 2, sz, sz, RAD * (1 + 0.5 * e)); g.stroke();
  }
  // 名字：逐个字母淡入上浮
  const name = 'DeepSeek';
  g.font = fonts(34, 'ZENB', 'SCB'); g.textBaseline = 'middle'; g.textAlign = 'left';
  const total = g.measureText(name).width + 6 * (name.length - 1);
  let nx = CX - total / 2;
  [...name].forEach((c, i) => {
    const e = easeOut(clamp((a - 0.22 - i * 0.025) / 0.2));
    g.globalAlpha = e; g.fillStyle = '#FFFFFF'; g.fillText(c, nx, CY + s / 2 + 58 + 10 * (1 - e));
    nx += g.measureText(c).width + 6;
  });
  g.globalAlpha = 1;
}

// 左上角的小启动日志：跟着拍一行一行出来（很小、很淡，不抢图标）
function bootLog(ctx, t) {
  const LINES = [[B1, 'init', 'grid 31×17'], [B2, 'sync', '150 BPM'], [B3, 'load', 'whale.px'], [T_CUE + 2 * STEP, 'ready', '']];
  ctx.save();
  ctx.font = fonts(15, 'ZENB', 'SCB'); ctx.textBaseline = 'alphabetic';
  LINES.forEach(([t0, k, v], i) => {
    const a = clamp((t - t0) / 0.08);
    if (a <= 0) return;
    const yy = 92 + i * 24;
    ctx.globalAlpha = a;
    ctx.fillStyle = css(ICE, 0.75); ctx.fillText(k.padEnd(6, ' '), 72, yy);
    ctx.fillStyle = css(ICE2, 0.55); ctx.fillText(v, 136, yy);
    if (k === 'ready') { ctx.fillStyle = BRAND; ctx.beginPath(); ctx.arc(276, yy - 5, 5, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.fillStyle = css(ICE, 0.75); ctx.fillText('ok', 270, yy); }
  });
  ctx.restore();
}
