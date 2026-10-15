// L12（32–33 小节，0:49.67–0:52.87）· C4 摇晃 · "我的心在摇晃"（视觉方案 §5.0、§5.2a 第六轮）
// 一台巨大的节拍器按 150 BPM 摆（摆到两端时正好是拍，"嗒"一下），摆锤是一颗像素心；
// 她的眼睛、脸的碎片用细线吊在上面，跟着各自晚一点地摆；镜头也跟着摆锤侧倾。
// 33.3：摆幅失控，公式卡 x(t) 推导成 ℒ = NaN，盖章「炸炉」；33.4：全部甩出画面，留出纸白接间奏一
import { W, H, BRAND, BEAT } from '../core/const.js';
import { barStart, beatTime, clamp, lerp, easeIn, easeOut, decay } from '../core/time.js';
import { rnd } from '../core/rand.js';
import { font, fonts } from '../core/glyphs.js';
import { photo } from '../core/portrait.js';
import { drawSprite } from '../core/sprites.js';
import { framed } from '../core/fx.js';
import { camAt, withCam } from '../core/cam.js';
import { hud } from '../core/hud.js';
import { card, stamp } from '../core/kit.js';
import { morphFormula } from '../core/math.js';
import { hudCluster } from '../core/hudkit.js';
import { css } from '../core/color.js';
import { rrect } from '../core/ui.js';
import { paper, backDeco, camBeat, pulseK } from './scene.js';

const T0 = barStart(32), T_OVER = beatTime(33, 3), T_EXIT = beatTime(33, 4);
const PIV = [960, 1040], ARM = 820;
const EYES = [0.30, 0.222, 0.32, 0.092], FACE = [0.26, 0.13, 0.40, 0.30], MOUTH = [0.37, 0.295, 0.2, 0.11];
// 吊着的碎片：[局部, 吊点 x, 线长, 宽, 高, 摆幅, 相位滞后]
const HANG = [
  [EYES, 420, 360, 520, 150, 0.16, 0.25],
  [FACE, 1520, 420, 340, 280, 0.2, 0.4],
  [MOUTH, 260, 640, 280, 150, 0.24, 0.55],
  [EYES, 1700, 700, 300, 90, 0.26, 0.7],
];

// 摆角：拍头在两端（cos），33.3 起摆幅失控
function swing(S, lag = 0, amp = 0.42) {
  const over = 1 + 1.6 * easeIn(clamp((S.t - T_OVER) / BEAT));
  return amp * over * Math.cos(Math.PI * (S.n - lag));
}

export function l12(ctx, S) {
  const exit = easeIn(clamp((S.t - T_EXIT) / BEAT));
  const cam = { x: 0, y: 0, zoom: 1.02 + 0.03 * pulseK(S) * decay(S.sub * BEAT, 8), rot: 0.05 * swing(S, 0.18, 1) };
  paper(ctx, S, cam);
  ctx.save();
  ctx.translate(-(W + 200) * exit, 0); ctx.rotate(-0.25 * exit);
  backDeco(ctx, S, { ...cam, rot: cam.rot * 1.5 }, 120, { alpha: 0.4 });
  withCam(ctx, cam, 1, g => content(g, S));
  ctx.restore();
  hud(ctx, S, { spectrum: false, alpha: 1 - exit });
}

// 第十二轮（用户：中间那个梯形做得更丰富、更有设计感）
// 机身改成"仪器"：切角的白壳 + 品牌蓝双线 + 硬投影；正面一块浅蓝渐变面板（不再是黄色），中间一道深色导槽（摆臂在它前面摆），
// 两侧刻度：长短刻线 + BPM 数字 + 意大利速度术语，150 那一格是粉色胶囊；顶上一个小尖帽、拍头亮一下的指示灯；
// 摆动范围画成顶上一道虚线弧和刻度；底座加宽，支点两边各一块铭牌、两颗螺丝
const TEMPO = [[40, 'Grave'], [60, 'Largo'], [80, 'Adagio'], [100, 'Andante'], [120, 'Moderato'], [150, 'Allegro'], [180, 'Vivace'], [208, 'Presto']];
function body12(ctx, S, px, py) {
  const pal = S.pal, top = py - 720, bot = py + 60, tw = 150, bw = 310, tick = decay(S.sub * BEAT, 9);
  const shape = (inset, c0 = 18) => { const t = top + inset, b = bot - inset, l = tw - inset * 0.8, r = bw - inset * 1.1; ctx.beginPath(); ctx.moveTo(px - l + c0, t); ctx.lineTo(px + l - c0, t); ctx.lineTo(px + l, t + c0); ctx.lineTo(px + r, b); ctx.lineTo(px - r, b); ctx.lineTo(px - l, t + c0); ctx.closePath(); };
  ctx.save();
  // 摆动范围：顶上一道虚线弧 + 刻度（-25° … 25°）
  ctx.strokeStyle = css(BRAND, 0.45); ctx.lineWidth = 2; ctx.setLineDash([6, 8]);
  ctx.beginPath(); ctx.arc(px, py, ARM + 40, -Math.PI / 2 - 0.62, -Math.PI / 2 + 0.62); ctx.stroke(); ctx.setLineDash([]);
  for (let k = -6; k <= 6; k++) { const a = -Math.PI / 2 + k * 0.1, r0 = ARM + (k % 3 ? 30 : 18), r1 = ARM + 52; ctx.lineWidth = k % 3 ? 1.5 : 3; ctx.beginPath(); ctx.moveTo(px + Math.cos(a) * r0, py + Math.sin(a) * r0); ctx.lineTo(px + Math.cos(a) * r1, py + Math.sin(a) * r1); ctx.stroke(); }
  // 第十三轮（用户：顶上的小三角和梯形顶边差 1–2 px 没对齐，改成小梯形）：顶帽改成小梯形，底边正好压在机身顶边上（先画顶帽，
  // 机身的顶边描线再盖过它们的接缝，线是连着的），只描上、左、右三条边
  ctx.beginPath(); ctx.moveTo(px - 96, top); ctx.lineTo(px - 60, top - 46); ctx.lineTo(px + 60, top - 46); ctx.lineTo(px + 96, top); ctx.closePath(); ctx.fillStyle = '#FFFFFF'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(px - 96, top); ctx.lineTo(px - 60, top - 46); ctx.lineTo(px + 60, top - 46); ctx.lineTo(px + 96, top); ctx.lineWidth = 6; ctx.strokeStyle = BRAND; ctx.lineJoin = 'round'; ctx.stroke();
  // 投影 + 壳
  ctx.save(); ctx.translate(14, 16); shape(0); ctx.fillStyle = css(pal.line, 0.25); ctx.fill(); ctx.restore();
  shape(0); ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = BRAND; ctx.lineJoin = 'round'; ctx.stroke();
  shape(14, 12); ctx.lineWidth = 2; ctx.strokeStyle = css(pal.line, 0.55); ctx.stroke();
  // 正面面板：浅蓝渐变
  shape(30, 8); const gr = ctx.createLinearGradient(0, top, 0, bot); gr.addColorStop(0, '#EEF2FF'); gr.addColorStop(1, '#C9D6FF'); ctx.fillStyle = gr; ctx.fill();
  // 导槽
  // 第十三轮（用户：中间深色长条和里面的细线没居中）：里面那条亮线以前偏左 2 px，现在居中；导槽下端停在底座上方，上下留白一样
  const slotB = bot - 144;
  ctx.fillStyle = '#1D2541'; rrect(ctx, px - 13, top + 60, 26, slotB - top - 60, 13); ctx.fill();
  ctx.fillStyle = css('#FFFFFF', 0.25); rrect(ctx, px - 2, top + 72, 4, slotB - top - 84, 2); ctx.fill();
  // 刻度
  TEMPO.forEach(([bpm, name], i) => {
    const y = top + 90 + i * 82, half = tw + ((bw - tw) * (y - top)) / (bot - top) - 46, on = bpm === 150;
    ctx.strokeStyle = on ? pal.acc[0] : css(pal.line, 0.8); ctx.lineWidth = on ? 4 : 2.5;
    ctx.beginPath(); ctx.moveTo(px - 26, y); ctx.lineTo(px - 70, y); ctx.moveTo(px + 26, y); ctx.lineTo(px + 70, y); ctx.stroke();
    ctx.lineWidth = 1.5; ctx.strokeStyle = css(pal.line, 0.45);
    for (let k = 1; k < 4 && i < TEMPO.length - 1; k++) { const yy = y + (k * 82) / 4; ctx.beginPath(); ctx.moveTo(px - 26, yy); ctx.lineTo(px - 44, yy); ctx.moveTo(px + 26, yy); ctx.lineTo(px + 44, yy); ctx.stroke(); }
    ctx.textBaseline = 'middle';
    if (on) { ctx.fillStyle = pal.acc[0]; rrect(ctx, px - half, y - 20, 78, 40, 20); ctx.fill(); ctx.fillStyle = '#FFFFFF'; }
    else ctx.fillStyle = pal.text;
    ctx.font = font('ZENB', on ? 28 : 22); ctx.textAlign = 'center'; ctx.fillText(String(bpm), px - half + 39, y + 1);
    ctx.font = fonts(on ? 18 : 15, 'ZENB'); ctx.fillStyle = on ? pal.acc[0] : pal.gray; ctx.textAlign = 'left'; ctx.fillText(name, px + 80, y + 1);
  });
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  // 顶帽 + 指示灯（拍头亮）
  const ly = top - 23;
  ctx.fillStyle = css(pal.acc[0], 0.3 + 0.7 * tick); ctx.beginPath(); ctx.arc(px, ly, 11, 0, Math.PI * 2); ctx.fill();
  if (tick > 0.05) { ctx.strokeStyle = css(pal.acc[0], 0.6 * tick); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(px, ly, 11 + 22 * (1 - tick), 0, Math.PI * 2); ctx.stroke(); }
  // 底座：加宽的台子、铭牌、旋钮、螺丝
  const by = bot - 120;
  ctx.fillStyle = '#FFFFFF'; rrect(ctx, px - bw - 40, by, 2 * bw + 80, 150, 20); ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = BRAND; ctx.stroke();
  for (const [x0, w, s] of [[px - bw + 30, 210, 'DS-METRO'], [px + bw - 240, 210, '150 BPM']]) { // 铭牌在摆臂支点两边
    ctx.fillStyle = BRAND; rrect(ctx, x0, by + 22, w, 36, 18); ctx.fill();
    ctx.font = fonts(19, 'ZENB'); ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(s, x0 + w / 2, by + 41);
  }
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  for (const sx of [-1, 1]) { ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(px + sx * (bw - 10), by + 40, 10, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = pal.line; ctx.stroke(); ctx.beginPath(); ctx.moveTo(px + sx * (bw - 10) - 5, by + 40); ctx.lineTo(px + sx * (bw - 10) + 5, by + 40); ctx.stroke(); }
  ctx.restore();
}

function content(ctx, S) {
  const pal = S.pal, t = S.t;

  // 吊着的碎片（细线 + 白框照片），各自晚一点地摆
  for (const [sub, hx, len, w, h, amp, lag] of HANG) {
    const a = swing(S, lag, amp);
    const ex = hx + Math.sin(a) * len, ey = -40 + Math.cos(a) * len;
    ctx.strokeStyle = css(pal.line, 0.7); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(hx, -40); ctx.lineTo(ex, ey); ctx.stroke();
    framed(ctx, photo('I03', sub, w, h), ex, ey + h / 2, w, h, { rot: a, border: 10 });
  }
  // HUD 拼贴也挂着摆
  ctx.save(); ctx.translate(960, 120); ctx.rotate(swing(S, 0.3, 0.12));
  hudCluster(ctx, S, 12, -500, -60, 1000, 200, { density: 0.8, alpha: 0.8 });
  ctx.restore();

  // 节拍器机身：梯形 + 刻度
  const [px, py] = PIV;
  body12(ctx, S, px, py);

  // 摆臂 + 摆锤（像素心），拍头"嗒"一下：扩散环
  const a = swing(S), bx = px + Math.sin(a) * ARM * 0.62, by = py - Math.cos(a) * ARM * 0.62;
  ctx.strokeStyle = BRAND; ctx.lineWidth = 14; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.sin(a) * ARM, py - Math.cos(a) * ARM); ctx.stroke();
  ctx.fillStyle = pal.line; ctx.beginPath(); ctx.arc(px, py, 22, 0, Math.PI * 2); ctx.fill();
  const tick = decay(S.sub * BEAT, 10);
  ctx.strokeStyle = css(pal.acc[0], 0.7 * tick); ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(bx, by, 60 + 120 * (1 - tick), 0, Math.PI * 2); ctx.stroke();
  drawSprite(ctx, 'heart', 14, pal, bx, by, 1 + 0.25 * tick);
  ctx.font = font('ZENB', 34); ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center'; ctx.fillText('150', bx, by + 10); ctx.textAlign = 'left';
  if (tick > 0.3) { ctx.font = font('ZENB', 26); ctx.fillStyle = css(pal.acc[0], tick); ctx.fillText(S.beat % 2 ? 'TICK' : 'TOCK', bx + (a > 0 ? 70 : -150), by - 60); }

  // 公式卡：阻尼振动 → 33.3 炸成 NaN
  const oa = t - T_OVER, red = oa >= 0;
  card(ctx, S, 100, 640, 520, 210, { title: red ? 'loss' : 'spring', age: S.lt - 0.1, fill: red ? pal.tint[0] : '#FFFFFF', line: red ? pal.acc[0] : undefined, rot: swing(S, 0.5, 0.06) }, c => {
    morphFormula(ctx, 'spring', 'nan', clamp(oa / 0.15), c.x + c.w / 2, c.y + c.h / 2, { size: 50, align: 'c', valign: 'mid', color: red ? pal.acc[0] : pal.text });
  });
  if (red) stamp(ctx, S, '炸炉', 520, 650, 54, oa);
}
