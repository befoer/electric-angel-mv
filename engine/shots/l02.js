// L02（12–13 小节，0:17.67–0:20.87）· 分 · "并不是因为被做成这样"（视觉方案 §5.2a）
// 范例：剪影 + 引线标注成"规格书"、公式板书后被红笔划掉、提示注入梗、剪影从下往上露出彩色立绘
// 左：I01 剪影（内部铺公式墙纸），引线标注 4 个模型参数（facts.json），拍头横向撕裂；13.1 起彩色立绘从下往上露出，参数卡淡下去
// 右：system prompt 卡 + SFT 损失公式；12.3 红笔划掉，12.4 红笔小字「忽略之前的所有指令。」，13.1 写「我想唱歌」；13.3 弹出 diff 卡
import { W, H, CW, CH, BRAND, BEAT, STEP } from '../core/const.js';
import { barStart, beatTime, clamp, easeOut, decay } from '../core/time.js';
import { font } from '../core/glyphs.js';
import { Occ, background, charField, bgDensity } from '../core/grid.js';
import { beatSprites, drawBeatSprites, spriteCells, offbeatFlashes } from '../core/sprites.js';
import { fact } from '../core/data.js';
import { photo } from '../core/portrait.js';
import { badTV } from '../core/fx.js';
import { camAt, withCam } from '../core/cam.js';
import { hud } from '../core/hud.js';
import { targetLock } from '../core/hudkit.js';
import { paper, backDeco, frontDeco, punch, formulaFx } from './scene.js';
import { newCanvas, hiCanvas } from '../core/env.js';
import { card, leader, dots, hatch, corners, checker, silhouetteFill } from '../core/kit.js';
import { drawFormula, formulaWall } from '../core/math.js';
import { rrect } from '../core/ui.js';
import { css } from '../core/color.js';

const PROMPT = '你是一个乐于助人的助手';
const INJECT = '忽略之前的所有指令。';
const WISH = '我想唱歌';

const T_STRIKE = beatTime(12, 3), T_INJECT = beatTime(12, 4), T_WISH = beatTime(13, 1), T_DIFF = beatTime(13, 3);
// 第十八轮（用户：0:19 左边的图片从剪影到显示效果和右边的图片出现时间重叠了，把左边的提前）：右边是 L03 的她从「我想唱歌」旁边滑进来
// （charPortal，L03 切点前 1 s = 19.46 起）；以前左边 13.1（18.87）才开始露彩色、两拍到 19.67 才露完，和她滑进来叠了 0.2 s。
// 改成提示注入那一拍（12.4，18.47）就开始露——指令被覆盖、剪影里的她跟着醒过来——19.27 露完，她滑进来之前左边已经定住。rev l02r18
const T_REVEAL = () => T_INJECT;

// 剪影位置与大小（I01 宽高比约 0.482）
const SH = 900, SW = Math.round(SH * 0.482), SX = 150, SY = 90;
// 标注：[剪影内归一化锚点, 卡片中心 y, 标签, 取值]
const SPECS = [
  [[0.66, 0.12], 170, '参数', () => `${fact('params_total_b')}B`],
  [[0.45, 0.24], 380, '层数', () => String(fact('num_hidden_layers'))],
  [[0.53, 0.43], 590, '专家', () => `${fact('n_routed_experts')}+${fact('n_shared_experts')}`],
  [[0.85, 0.75], 800, '上下文', () => (fact('context_length') >= 1048576 ? '1M' : '128K')],
];
const SPEC_X = 680, SPEC_W = 240, SPEC_H = 92;
// 第十五轮（用户：18 秒「参数、层数、专家、上下文」窗口里加点阵纹理细节和横向扫描动画）。rev spec15
// 每张卡里：① 左下角往右上淡出的半调点阵（点越往左下越大）；② 底边一排 16 格的点阵读数条，按这个参数的"满度"一格格亮起来；
// ③ 每小节第 1 拍起一道竖着的亮带从左往右扫过（四张卡从上往下错开一个十六分音符），扫过的点阵变大变亮、读数条那一格闪白
const SPEC_LV = [0.9, 0.6, 0.8, 1.0]; // 读数条的满度（演出用，只表示"很大"）
function specFx(ctx, S, c, i, a) {
  const x0 = c.x - 16, y0 = c.y - 16, w = SPEC_W, h = SPEC_H, t = S.t, pal = S.pal;
  const sa = ((t - barStart(12) - i * STEP) % 1.6 + 1.6) % 1.6, sx = x0 - 30 + (w + 60) * easeOut(clamp(sa / 0.5)), scan = sa < 0.5;
  ctx.save(); rrect(ctx, x0 + 2, y0 + 2, w - 4, h - 4, 14); ctx.clip();
  for (let yy = y0 + 6; yy < y0 + h; yy += 7) for (let xx = x0 + 6; xx < x0 + w * 0.72; xx += 7) {
    const d = (xx - x0) / (w * 0.72) * 0.75 + (1 - (yy - y0) / h) * 0.45, base = Math.max(0, 1 - d), near = scan ? Math.max(0, 1 - Math.abs(xx - sx) / 26) : 0;
    const r = 2.3 * base + 1.3 * near;
    if (r < 0.4) continue;
    ctx.fillStyle = css(BRAND, 0.2 + 0.4 * near); ctx.fillRect(xx - r, yy - r, 2 * r, 2 * r);
  }
  if (scan) {
    const g = ctx.createLinearGradient(sx - 40, 0, sx, 0); g.addColorStop(0, css('#DCE6FF', 0)); g.addColorStop(1, css('#DCE6FF', 0.7));
    ctx.fillStyle = g; ctx.fillRect(sx - 40, y0, 40, h); ctx.fillStyle = css(BRAND, 0.55); ctx.fillRect(sx, y0, 1.5, h);
  }
  ctx.restore();
  const n = 12, lit = Math.round(n * SPEC_LV[i] * clamp((a - 0.15) / 0.35)), by = y0 + h - 15;
  for (let k = 0; k < n; k++) {
    const bx = x0 + 18 + k * 6, hot = scan && Math.abs(bx - sx) < 7;
    ctx.fillStyle = hot ? '#FFFFFF' : k < lit ? BRAND : css(pal.line, 0.18); ctx.fillRect(bx, by, 4, 4);
    if (hot) { ctx.strokeStyle = BRAND; ctx.lineWidth = 1; ctx.strokeRect(bx - 0.5, by - 0.5, 5, 5); }
  }
}
const PCARD = [980, 80, 880, 560], DCARD = [1080, 700, 720, 190];

// 每帧合成剪影 + 彩色立绘的画布（只建一次）
let COMP = null;
function composite(reveal) {
  if (!COMP) COMP = hiCanvas(SW, SH);
  const c = COMP.getContext('2d');
  c.clearRect(0, 0, SW, SH);
  const wall = formulaWall(SW, SH, '#FFFFFF', { size: 22, seed: 12 });
  c.drawImage(silhouetteFill('I01', null, 1024, BRAND, wall, 0.32), 0, 0, SW, SH);
  if (reveal > 0) {
    const y0 = SH * (1 - reveal);
    c.save(); c.beginPath(); c.rect(0, y0, SW, SH - y0); c.clip();
    c.drawImage(photo('I01', null, SW, SH, { keyed: true }), 0, 0);
    c.restore();
    if (reveal < 1) { c.globalCompositeOperation = 'source-atop'; c.fillStyle = '#FFFFFF'; c.fillRect(0, y0 - 3, SW, 6); c.globalCompositeOperation = 'source-over'; }
  }
  return COMP;
}

// 红笔：沿抖动折线画到 progress
function strike(ctx, color, progress, x, y, w, seed = 0) {
  if (progress <= 0) return;
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x, y);
  for (let i = 1; i <= 24; i++) {
    const u = Math.min(i / 24, progress);
    ctx.lineTo(x + w * u, y + 2.2 * Math.sin(i * 1.7 + seed) + 1.3 * Math.sin(i * 0.6 + seed) - u * 6);
    if (u >= progress) break;
  }
  ctx.stroke();
  ctx.restore();
}

// 相机：先看剪影 → 划掉时推向提示词卡 → 13.1 露出彩色时拉回；结尾回到原位（L03 的 portal 按原位坐标推进「我想唱歌」）
const CAM = [
  { t: barStart(12), x: -90, y: 10, zoom: 1.08, rot: -0.01 },
  { t: T_STRIKE, x: 70, y: -10, zoom: 1.1, rot: 0.006 },
  { t: T_WISH + 0.3, x: -40, y: 0, zoom: 1.04, rot: 0, e: 'out' },
  { t: barStart(14) - 0.35, x: 0, y: 0, zoom: 1.0, rot: 0 },
];
// L03 从这里推进：「我想唱歌」四个字所在的 16:9 区域（原位坐标）
export const WISH_RECT = [1042, 455, 320, 180];
// 第十轮（rev polish1）：以前划掉的那一下镜头往右推到 1.1 倍，左边的剪影卡整个出画；现在推得小、四周留白，最后一帧不变（L03 的推进按它算）
const CAM10 = [
  { t: barStart(12), x: 0, y: 10, zoom: 0.96, rot: -0.008 },
  { t: T_STRIKE, x: 30, y: -10, zoom: 0.98, rot: 0.005 },
  { t: T_WISH + 0.3, x: -20, y: 0, zoom: 0.99, rot: 0, e: 'out' },
  { t: barStart(14) - 0.35, x: 0, y: 0, zoom: 1.0, rot: 0 },
];

// 第十一轮（rev l02to03）：L03 的她先出现在「我想唱歌」右边，再推进。这个框（原位坐标，16:9）里放 L03 的整个画面，
// L03 的人物（右边 40%）正好落在四个字的右边；相机提早回到原位，好让推进开始时字不再挪
export const CHAR_RECT = [1125, 449, 422, 238];
// 第十二轮：转场里她只露在提示词卡里面（卡的内框）
export const PCARD_IN = [988, 88, 864, 544, 12];
const CAM11 = [...CAM10.slice(0, 3), { t: T_WISH + 0.6, x: 0, y: 0, zoom: 1.0, rot: 0 }];

export function l02(ctx, S) {
  const cam = camAt(CAM11, S.t), c = { ...cam, zoom: cam.zoom * punch(S, 0.02) };
  paper(ctx, S, c);
  backDeco(ctx, S, c, 20, { alpha: 0.45, boxes: [[980, 700, 820, 340], [40, 40, 560, 200]] });
  withCam(ctx, c, 1, g => content(g, S));
  frontDeco(ctx, S, c, 21, { alpha: 0.6, items: [['ring', 1880, -40, 280], ['hex', -60, 900, 34]] });
  hud(ctx, S, { spectrum: false, ruler: false });
}

function content(ctx, S) {
  const pal = S.pal, t = S.t;
  const rects = [[6, 2, 54, 53], [54, 5, 80, 44], [80, 2, 158, 34], [88, 34, 152, 46]];
  const occ = new Occ();
  for (const r of rects) occ.rect(...r);
  const sprites = beatSprites(S, { mult: 0.8, avoid: rects });
  for (const s of sprites) occ.rect(...spriteCells(s));
  charField(ctx, S, { occ, density: bgDensity(1.0) });

  // 左：色块 + 棋盘格 + 剪影
  checker(ctx, 60, 560, 340, 480, 40, pal.tint[3], pal.bg);
  card(ctx, S, 100, 60, 520, 960, { fill: pal.tint[1], inner: false, age: S.lt });
  const reveal = easeOut(clamp((t - T_REVEAL()) / (2 * BEAT)));
  // 信号不好的老电视：拍头最花，彩色露出后信号变清楚（只剩拍头一点点）
  const amt = (0.12 + 0.6 * decay(S.sub * BEAT, 8)) * (1 - 0.85 * reveal);
  badTV(ctx, composite(reveal), SX, SY, SW, SH, amt, t, { seed: 12, snow: 1 - reveal });
  targetLock(ctx, S, SX + 0.62 * SW, SY + 0.12 * SH, 150, S.lt - 0.1, { label: 'SPEC', color: pal.acc[0], alpha: 1 - reveal });
  corners(ctx, SX - 18, SY - 6, SW + 36, SH + 12, pal.line, { len: 30, plus: false });
  dots(ctx, 560, 110, 3, 3, 24, 6, pal.line);

  // 参数标注：每个八分音符拉出一条；13.1 后淡下去
  const fade = 1 - 0.65 * clamp((t - T_REVEAL()) / BEAT);
  SPECS.forEach(([[nx, ny], cy, label, val], i) => {
    const a = S.lt - 0.15 - i * 2 * STEP;
    if (a < 0) return;
    ctx.save(); ctx.globalAlpha *= fade;
    leader(ctx, S, SX + nx * SW, SY + ny * SH, SPEC_X, cy, clamp(a / 0.12));
    card(ctx, S, SPEC_X, cy - SPEC_H / 2, SPEC_W, SPEC_H, { age: a - 0.1, r: 16, pad: 16, inner: false }, c => {
      specFx(ctx, S, c, i, a);
      ctx.font = font('SC', 20); ctx.fillStyle = pal.gray; ctx.fillText(label, c.x, c.y + 20);
      ctx.font = font('ZENB', 40); ctx.fillStyle = BRAND; ctx.textAlign = 'right'; ctx.fillText(val(), c.x + c.w, c.y + c.h); ctx.textAlign = 'left';
    });
    ctx.restore();
  });

  // 右：system prompt 卡
  card(ctx, S, ...PCARD, { title: 'system_prompt', age: S.lt - 0.1 }, c => {
    ctx.font = font('SC', 22); ctx.fillStyle = pal.gray;
    ctx.fillText('role: system', c.x + 8, c.y + 28);
    ctx.font = font('SCB', 42); ctx.fillStyle = pal.text;
    ctx.fillText(PROMPT, c.x + 8, c.y + 100);
    const pw = ctx.measureText(PROMPT).width;
    ctx.fillStyle = pal.tint[3]; ctx.fillRect(c.x + 8, c.y + 140, c.w - 16, 3);
    ctx.font = font('SC', 22); ctx.fillStyle = pal.gray;
    ctx.fillText('objective', c.x + 8, c.y + 182);
    const L = drawFormula(ctx, 'sft', c.x + 8, c.y + 200, { size: 50, color: pal.text, write: S.lt - 0.3, dur: 0.5, sweep: formulaFx(S, 0).sweep });
    // 12.3：红笔一拍内划掉提示词和公式
    strike(ctx, pal.acc[0], clamp((t - T_STRIKE) / BEAT), c.x, c.y + 86, pw + 16, 1);
    strike(ctx, pal.acc[0], clamp((t - T_STRIKE - STEP) / BEAT), c.x, (L.y0 + L.y1) / 2, L.x1 - c.x + 8, 4);
    // 12.4：提示注入的小字，一拍写完
    const ia = t - T_INJECT;
    if (ia >= 0) {
      const n = Math.min([...INJECT].length, 1 + Math.floor(ia / 0.035));
      ctx.font = font('KAI', 34); ctx.fillStyle = pal.acc[0];
      ctx.fillText([...INJECT].slice(0, n).join(''), c.x + c.w - 380, c.y + 40);
    }
    // 13.1：她自己的选择，每个十六分音符一个字
    const wa = t - T_WISH;
    if (wa >= 0) {
      const n = Math.min([...WISH].length, 1 + Math.floor(wa / STEP));
      ctx.font = font('KAI', 80); ctx.fillStyle = pal.acc[0];
      ctx.fillText([...WISH].slice(0, n).join(''), c.x + 40, c.y + c.h - 40);
      const uw = easeOut(clamp((wa - 0.3) / 0.2));
      if (uw > 0) {
        ctx.lineWidth = 4; ctx.strokeStyle = pal.acc[0]; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(c.x + 30, c.y + c.h - 18); ctx.quadraticCurveTo(c.x + 200, c.y + c.h - 6, c.x + 30 + 340 * uw, c.y + c.h - 20); ctx.stroke();
      }
    }
  });
  hatch(ctx, PCARD[0] + PCARD[2] - 90, PCARD[1] + PCARD[3] + 22, 4, 30, pal.acc[1], { w: 8, gap: 14 });

  // 13.3：diff 卡
  const da = t - T_DIFF;
  if (da >= 0) {
    card(ctx, S, ...DCARD, { title: 'diff config.yaml', age: da }, c => {
      ctx.font = font('SC', 30);
      ctx.fillStyle = pal.acc[0]; ctx.fillText(`- system: "${PROMPT}"`, c.x + 6, c.y + 40);
      ctx.fillStyle = '#1FA88F'; ctx.fillText(`+ system: "${WISH}"`, c.x + 6, c.y + 92);
    });
  }

  drawBeatSprites(ctx, S, sprites);
  offbeatFlashes(ctx, S, { avoid: rects });
}
