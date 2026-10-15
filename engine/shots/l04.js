// L04（16–17 小节，0:23.67–0:26.87）· 层 · "因为你会开心"（视觉方案 §5.2a）
// 范例：公式代入实时数值、环形仪表组、圈注引线、出图（平均奖励曲线）、galgame 梗「好感度 +1」
// 主公式：GRPO 组内优势 Â_i = (r_i − mean) / std（DeepSeek-R1）。一组 16 个采样（facts grpo_group_size），
// 每拍刷新一次奖励（演出值，平均值从 0.61 涨到 0.98）；"你点赞的那一个"被圈注，它的 Â 实时代入
import { W, H, CW, CH, BRAND, BEAT, FPS } from '../core/const.js';
import { barStart, beatTime, clamp, lerp, smooth, easeOut, decay } from '../core/time.js';
import { cutAt } from '../core/cuts.js';
import { rev } from '../rev.js';
import { heartPath } from '../core/trans.js';
import { rnd, hash } from '../core/rand.js';
import { font, glyphs } from '../core/glyphs.js';
import { Occ, background, charField, bgDensity } from '../core/grid.js';
import { beatSprites, drawBeatSprites, drawSprite, spriteCells, offbeatFlashes } from '../core/sprites.js';
import { fact, onset } from '../core/data.js';
import { photo, halftone } from '../core/portrait.js';
import { flash, framed, drawCover } from '../core/fx.js';
import { newCanvas } from '../core/env.js';
import { rrect } from '../core/ui.js';
import { css, mix } from '../core/color.js';
import { card, leader, ring, dots, hatch, popIn } from '../core/kit.js';
import { camAt, withCam } from '../core/cam.js';
import { hud } from '../core/hud.js';
import { paper, backDeco, frontDeco, punch, safeZoom, formulaFx } from './scene.js';
import { T_IRIS03 } from './l03.js';
import { zeroScreenPts05 } from './l05.js';
import { drawFormula, slotNum } from '../core/math.js';

const T0 = barStart(16);
const HI = 2; // 你点赞的那一个（放在第一行，引线不穿过别的仪表）
const FCARD = [820, 40, 1060, 230], GCARD = [820, 310, 560, 560], SCARD = [1420, 310, 460, 250], RCARD = [1420, 600, 460, 270], CCARD = [820, 910, 1060, 140];

// 第 k 拍（0..7）的一组奖励（演出值）
function rewards(k, G) {
  const m = 0.61 + (0.37 * clamp(k, 0, 7)) / 7, spread = 0.34 * (1 - (0.5 * clamp(k, 0, 7)) / 7);
  return Array.from({ length: G }, (_, i) => (i === HI ? clamp(m + 0.1 + 0.06 * rnd(k, 43), 0, 1) : clamp(m + (rnd(i, k, 41) - 0.5) * spread, 0.02, 1)));
}
const meanOf = a => a.reduce((s, x) => s + x, 0) / a.length;
const stdOf = a => { const m = meanOf(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length) || 1e-6; };

// I03 照片 + 0.35 透明度的半色调网点，只合成一次。SUB 的宽高比与 620×720 相同（halftone 不做 cover 裁切）
const SUB = [0.11, 0.03, 0.70, 0.80];
let PORTRAIT = null;
function portrait(w, h) {
  if (PORTRAIT) return PORTRAIT;
  PORTRAIT = newCanvas(w, h);
  const c = PORTRAIT.getContext('2d');
  c.drawImage(photo('I03', SUB, w, h), 0, 0);
  c.globalAlpha = 0.35;
  drawCover(c, halftone('I03', SUB, w, h, BRAND, { cell: 9 }), 0, 0, w, h);
  return PORTRAIT;
}

// 相机：开场贴着公式（先看懂规则），一小节内拉开露出 16 个奖励和她；之后缓慢漂移，17.3 推向贴纸
const CAM = [
  { t: T0, x: 390, y: -380, zoom: 1.75, rot: 0.02 },
  { t: T0 + 0.25, x: 390, y: -380, zoom: 1.75, rot: 0.02 },
  { t: T0 + 1.5, x: 0, y: 0, zoom: 1.0, rot: 0, e: 'smooth' },
  { t: beatTime(17, 3), x: -40, y: 10, zoom: 1.03, rot: -0.006 },
  { t: beatTime(17, 3) + 0.3, x: -60, y: 0, zoom: 1.08, rot: 0, e: 'out' },
  { t: barStart(18), x: -30, y: 0, zoom: 1.04 },
];
// 第十七轮（用户：转场提前以后，「好感度 MAX」心形头像只出现了很短的时间，改到唱到「♪」的「♪」时出现）：
// 以前在 17 小节第 3 拍（26.47），离转场（26.64 起）只剩 0.17 s。人声分轨里「♪」在 25.87 起音（对时数据写的 26.00 偏晚），
// 贴纸提前 0.07 s 开始弹（弹出 0.16 s，唱到「♪」时已经大半出来），到转场前停留约 0.85 s。rev l04h17
// 第十八轮（用户：好感度 MAX 出现时间晚了，要在唱到「♪」时出现）：上一轮量的 25.87 其实是「♪」——连音高一起看，「♪」的「♪」25.46（F#4），
// 25.58–25.68 一段 −40 dB 的空隙（k 的闭塞）之后「♪」在 25.66 起音（E4），「♪」25.86 换到 D#4。贴纸在「♪」前 0.1 s 开始弹（data/vocal_onsets.json）。rev l04h18
const T_STICK = () => onset('L04', 7) - 0.1;
// 第十一轮（rev l04in）：转场的圆从 L03 的点赞按钮里长出来时，L04 已经在跑——一开始镜头对着 16 个采样（GCARD 的中心落在按钮的位置），
// 圆快撑满时其余窗口从 0 弹出来（错开 60 ms）；随后镜头用四次缓入缓出 0.8 秒拉开（起步和落定柔、中段快，不再是匀速的慢拉）
// 第十六轮（切点提前到「♪」前）：开场的运镜和窗口弹出都钉在转场的圆上（TA = 圆开始后 0.2 s，和以前切在小节线上时的相对位置一样），
// 不再钉在小节线上；每拍的奖励和「好感度 +1」仍按小节线数拍
const TA = () => T_IRIS03() + 0.2;
const CAM11 = () => [
  { t: TA() - 1.5, x: 478, y: -231, zoom: 1.477, rot: 0.012 },
  { t: TA() + 0.1, x: 462, y: -220, zoom: 1.55, rot: 0.008 },
  { t: TA() + 0.9, x: 0, y: 0, zoom: 1.0, rot: 0, e: 'inout4' },
  // 推向贴纸跟着贴纸走（第十七轮）
  ...CAM.slice(3).map(k => (k.t < barStart(18) ? { ...k, t: k.t - beatTime(17, 3) + T_STICK() } : k)),
];
// 各窗口出现的时刻（相对 T0）：16 个采样跟着圆一起出现，其余在圆 90% 的时候依次弹出
const inAt = k => ({ G: -1.53, F: -0.08, P: -0.04, S: 0.0, R: 0.04, C: 0.08 })[k];

export function l04(ctx, S) {
  const cam = camAt(CAM11(), S.t), cc = { ...cam, zoom: cam.zoom * punch(S, 0.02) * safeZoom() };
  paper(ctx, S, cc);
  backDeco(ctx, S, cc, 40, { alpha: 0.4, boxes: [[40, 40, 560, 160], [40, 900, 700, 160]] });
  withCam(ctx, cc, 1, g => content(g, S));
  frontDeco(ctx, S, cc, 41, { alpha: 0.55, items: [['ring', -60, 1080, 300], ['data', 1700, -60, 0]] });
  sticker(ctx, S);
  hud(ctx, S, { spectrum: false });
}

// 17.3 起：她的脸剪成心形贴纸弹出来（白边 + 投影），标签「好感度 MAX」，留到小节结束（不是一闪而过）
// 第二十二轮（用户：好感度 MAX 放到画面偏左；转场时爱心和下一个镜头的数字 0 过渡——下一个镜头第一个动画是左边的 0 出现，
// 这个镜头最后一个动画是右边的 MAX，会跳。马赛克转场也不错，保留）：贴纸挪到偏左（700, 470），转场里由 heartTo0 接着画——
// 心带着她的脸飞到 L05「0」的位置、放大到 0 那么高，轮廓从心变成 0 的椭圆、脸淡掉，L05 的 0 在原地淡出来。（第二十四轮并开关）
const STICK_AT = () => [700, 470, 570, 710];
export const ZERO05 = { cx: 330, cy: 345, w: 330, h: 470 }; // L05 背景巨字「0」大致的外形（屏幕坐标）
function sticker(ctx, S) {
  const a = S.t - T_STICK();
  if (a < 0 || S.t > cutAt(18) - 0.22) return; // 第二十二轮：转场里由 heartTo0 接着画
  const pal = S.pal, s = popIn(S, a, 0.16), wob = Math.sin(a * 9) * 0.04 * decay(a, 2), size = 420, [hx, hy, lx, ly] = STICK_AT();
  const face = photo('I03', [0.25, 0.12, 0.42, 0.34], size, size);
  ctx.save();
  ctx.translate(hx, hy); ctx.rotate(0.08 + wob); ctx.scale(s, s);
  ctx.translate(-size / 2, -size / 2);
  const heart = c => { c.beginPath(); c.moveTo(size / 2, size * 0.28); c.bezierCurveTo(size * 0.5, size * 0.05, size * 0.02, size * 0.02, size * 0.02, size * 0.35); c.bezierCurveTo(size * 0.02, size * 0.62, size * 0.35, size * 0.78, size / 2, size * 0.98); c.bezierCurveTo(size * 0.65, size * 0.78, size * 0.98, size * 0.62, size * 0.98, size * 0.35); c.bezierCurveTo(size * 0.98, size * 0.02, size * 0.5, size * 0.05, size / 2, size * 0.28); c.closePath(); };
  ctx.save(); ctx.translate(10, 14); heart(ctx); ctx.fillStyle = 'rgba(77,107,254,0.25)'; ctx.fill(); ctx.restore();
  heart(ctx); ctx.lineWidth = 26; ctx.strokeStyle = '#FFFFFF'; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.save(); heart(ctx); ctx.clip(); ctx.drawImage(face, 0, 0); ctx.restore();
  heart(ctx); ctx.lineWidth = 5; ctx.strokeStyle = pal.acc[0]; ctx.stroke();
  ctx.restore();
  card(ctx, S, lx, ly, 300, 70, { age: a - 0.1, fill: pal.acc[0], line: pal.acc[0], r: 35, pad: 10, inner: false, rot: -0.05 }, c => {
    ctx.font = font('ZENB', 34); ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('好感度 MAX', c.x + c.w / 2, c.y + c.h / 2 + 2); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  });
}
// 第二十三轮（用户：爱心的描边动画转场改成粒子效果，因为下一个镜头是 0101110 字符粒子而没有描边）（第二十五轮并开关 l04p23）
// 心（带她的脸）先在原地碎成一格格 0/1 像素字（和 L05「0」里的纹理同一种字），字沿弧线飞到 L05「0」字里面的格点上、落下时停止翻转；
// 「0」的纹理同时从底下淡出来接住它们（l05.js look），字再淡掉。不再画心 → 椭圆的描边变形。标签牌照旧往下掉
let HPTS = null;
function heartPts() { // 心里面的格点（相对心的中心，心宽 420），按角度排好
  if (HPTS) return HPTS;
  const N = 420, c = newCanvas(N, N).getContext('2d');
  heartPath(c, N / 2, N / 2, N); c.fillStyle = '#000'; c.fill();
  const d = c.getImageData(0, 0, N, N).data, P = [];
  for (let y = 9; y < N; y += 18) for (let x = 7; x < N; x += 14) if (d[(y * N + x) * 4 + 3] > 160) P.push([x - N / 2, y - N / 2]);
  return (HPTS = P.sort((a, b) => Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0])));
}
let ZSORT = null;
function zeroPts() { // L05「0」里的格点（屏幕坐标），按绕「0」中心的角度排好，和心的格点一一按角度对上
  if (ZSORT) return ZSORT;
  const P = zeroScreenPts05(), cx = P.reduce((s, q) => s + q[0], 0) / P.length, cy = P.reduce((s, q) => s + q[1], 0) / P.length;
  return (ZSORT = [...P].sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx)));
}
export function heartTo0(ctx, S, u) {
  const pal = S.pal, [hx, hy, lx, ly] = STICK_AT(), tau = S.t - (cutAt(18) - 0.22);
  // 标签牌：往下掉、转、淡（同第二十二轮）
  const da = clamp(u / 0.5);
  if (da < 1) { ctx.save(); ctx.globalAlpha = 1 - da; ctx.translate(lx + 150, ly + 35 + 300 * da * da); ctx.rotate(-0.05 + 0.6 * da); ctx.fillStyle = pal.acc[0]; rrect(ctx, -150, -35, 300, 70, 35); ctx.fill(); ctx.font = font('ZENB', 34); ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('好感度 MAX', 0, 2); ctx.restore(); }
  // 脸：心形裁切，0.14 s 里淡掉（变成上面的字）
  const fa = 1 - smooth(clamp((tau - 0.02) / 0.14));
  if (fa > 0) {
    ctx.save(); ctx.globalAlpha = fa; ctx.translate(hx, hy); ctx.rotate(0.08); ctx.translate(-hx, -hy);
    heartPath(ctx, hx, hy, 420); ctx.lineWidth = 26; ctx.strokeStyle = '#FFFFFF'; ctx.lineJoin = 'round'; ctx.stroke();
    heartPath(ctx, hx, hy, 420); ctx.clip(); ctx.drawImage(photo('I03', [0.25, 0.12, 0.42, 0.34], 420, 420), hx - 210, hy - 210, 420, 420);
    ctx.restore();
  }
  // 字：每个心里的格点一颗，飞到「0」里对应角度的格点
  const H0 = heartPts(), Z = zeroPts(), NS = H0.length, NZ = Z.length, out = 1 - smooth(clamp((tau - 0.36) / 0.14));
  if (out <= 0) return;
  const sets = { pink: glyphs('DOT', pal.acc[0]), blue: glyphs('DOT', BRAND), ink3: glyphs('DOT', pal.ink[3]), ink4: glyphs('DOT', pal.ink[4] ?? BRAND) };
  const cr = Math.cos(0.08), sr = Math.sin(0.08);
  for (let i = 0; i < NS; i++) {
    const [px, py] = H0[i], rd = Math.hypot(px, py) / 230, sx = hx + px * cr - py * sr, sy = hy + px * sr + py * cr, [zx, zy] = Z[Math.floor((i * NZ) / NS)];
    const ap = smooth(clamp((tau - 0.06 * rnd(i, 231)) / 0.08)); // 先在心上冒出来
    if (ap <= 0) continue;
    const dep = 0.05 + 0.12 * (0.6 * clamp(1 - rd) + 0.4 * rnd(i, 232)), fd = 0.2 + 0.05 * rnd(i, 233), f = clamp((tau - dep) / fd), e = f < 0.5 ? 4 * f ** 3 : 1 - (-2 * f + 2) ** 3 / 2;
    const mx = (sx + zx) / 2 + (rnd(i, 234) - 0.5) * 120, my = Math.min(sy, zy) - 120 - 90 * rnd(i, 235);
    const x = (1 - e) ** 2 * sx + 2 * (1 - e) * e * mx + e * e * zx, y = (1 - e) ** 2 * sy + 2 * (1 - e) * e * my + e * e * zy;
    const landed = f >= 1, ch = landed ? (hash(i, 236) % 2 ? '1' : '0') : (hash(i, Math.floor(S.t * 16), 237) % 2 ? '1' : '0');
    const set = landed ? (i % 2 ? sets.ink3 : sets.ink4) : f > 0 ? sets.blue : sets.pink;
    ctx.save(); ctx.globalAlpha = ap * out * (landed ? 0.9 : 1); set.draw(ctx, ch, Math.round(x - 8), Math.round(y - 12)); ctx.restore();
  }
}
// 第二十四轮（用户：0:24 左边图片周围增加一些类似养成游戏的简单小图标）（第二十六轮并开关 l04g24）
// 照片四周一套"养成游戏"的状态界面，都是像素小图标 + 小字，跟着照片之后一个个弹出来：
// · 照片上方：角色栏——Lv 圆章、名牌「鲸鱼娘 · 女仆」、EXP 条（这一句里一直在涨）
// · 照片左边：四个属性格（好感 / 饱腹 / 心情 / 元气），格子下面 5 格小量表。好感每拍 +1 跟着弹一下，
//   量表在「好感度 MAX」贴纸出来那一刻正好满格、变成 MAX；其余三个随拍小幅起伏
// · 照片下方：道具栏 5 格（白米饭 ×3、小鱼干 ×5、礼物、话筒、爱心），选中框每拍换一格，被选中的那格弹一下
const STATS24 = [['heart', '好感'], ['rice', '饱腹'], ['note', '心情'], ['star', '元气']];
const ITEMS24 = [['rice', '×3'], ['fish', '×5'], ['gift', '×1'], ['mic', ''], ['heart', '×9']];
// 第二十五轮（用户：0:24 立绘右边的一排改到左边，左下 4 个颜色改到右下，上面 DS娘 改成鲸鱼娘；第二十七轮并开关 l04u25）：
// 属性格在照片左边：照片倾斜了 −0.055 rad，左沿越往下越靠右，四格跟着它排成一条微斜的竖列（离照片左沿 48 px）；
// 4 个色块在右下，和道具栏同一行、排在它右边（content 里画）
function nurture24(ctx, S, k) {
  const pal = S.pal, t = S.t, a0 = S.t - TA() - inAt('P') - 0.12, kick = decay(S.t - (T0 + k * BEAT), 9);
  if (a0 < 0) return;
  const tile = (x, y, s, sz, pop, hot) => { ctx.save(); ctx.translate(x, y); ctx.scale(pop, pop); ctx.fillStyle = '#FFFFFF'; rrect(ctx, -sz / 2, -sz / 2, sz, sz, 14); ctx.fill(); ctx.lineWidth = hot ? 4 : 2.5; ctx.strokeStyle = hot ? pal.acc[0] : BRAND; ctx.stroke(); drawSprite(ctx, s, sz > 70 ? 6 : 5, pal, 0, 0); ctx.restore(); };
  // 角色栏
  // 第二十六轮（用户：0:24 人物上方的等级增加快速增加，exp 条也快速滚动）。rev l04v26
  // 等级从 Lv.17 起一级级往上冲：每秒升 4 级、匀加到 12 级（这一句约 2.5 s 冲到三十几级，之后保持 12 级 / 秒）——升级数按速度对时间积分，不跳；
  // EXP 条每升一级从 0 涨满一次（满的那一下闪白），所以是一直在"滚"；圆章每升一级弹一下，数字往上滚一格；EXP 读数的分母跟着等级涨（演出值）
  // 第二十七轮（用户：0:24 等级提升速度一开始慢点，然后再加快）。rev l04v27
  // 速度从每秒 0.8 级起、按平方曲线加到 14 级 / 秒（2.6 s 时），之后保持：头一级要涨约 0.85 s（看得清 EXP 条一点点涨满），
  // 第二、三级各约 0.3、0.25 s，再往后越来越快（这一句最后到三十级出头）；仍按速度对时间积分，不跳
  { const pa = popIn(S, a0, 0.16), v26 = rev('l04v26') >= 26;
    let lv = 17, exp = 0.42 + 0.5 * smooth(clamp((t - TA()) / (T_STICK() - TA() + 0.6))), pop = 0, roll = 1, need = 2000;
    if (v26) {
      const d = a0, v27 = rev('l04v27') >= 27;
      let P, rate;
      if (v27) { const D = 2.6, r0 = 0.8, r1 = 14; P = d < D ? r0 * d + ((r1 - r0) * d ** 3) / (3 * D * D) : r0 * D + ((r1 - r0) * D) / 3 + r1 * (d - D); rate = d < D ? r0 + (r1 - r0) * (d / D) ** 2 : r1; }
      else { const D = 2.5, r0 = 4, r1 = 12; P = d < D ? r0 * d + ((r1 - r0) / (2 * D)) * d * d : r0 * D + ((r1 - r0) * D) / 2 + r1 * (d - D); rate = d < D ? r0 + ((r1 - r0) * d) / D : r1; }
      lv = 17 + Math.floor(P); exp = P % 1; const since = exp / rate; pop = Math.exp(-since * 16); roll = smooth(clamp(since / 0.06)); need = 100 + 20 * lv;
    }
    ctx.save(); ctx.translate(140, 148); ctx.scale(pa, pa);
    ctx.save(); ctx.scale(1 + 0.16 * pop, 1 + 0.16 * pop);
    ctx.fillStyle = BRAND; ctx.beginPath(); ctx.arc(0, 0, 32, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = pop > 0.3 ? mix('#FFFFFF', '#FFD872', pop) : '#FFFFFF'; ctx.stroke();
    ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center'; ctx.font = font('ZENB', 13); ctx.fillText('Lv', 0, -8); ctx.font = font('ZENB', 24);
    if (v26 && roll < 1) { ctx.save(); ctx.beginPath(); ctx.rect(-26, -2, 52, 26); ctx.clip(); ctx.fillText(String(lv - 1), 0, 18 - 22 * roll); ctx.fillText(String(lv), 0, 18 + 22 * (1 - roll)); ctx.restore(); }
    else ctx.fillText(String(lv), 0, 18);
    ctx.restore();
    ctx.textAlign = 'left'; ctx.fillStyle = '#FFFFFF'; rrect(ctx, 44, -30, 196, 36, 18); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = BRAND; ctx.stroke();
    ctx.font = font('ZENB', 20); ctx.fillStyle = BRAND; ctx.fillText('鲸鱼娘 · 女仆', 60, -5);
    ctx.fillStyle = css(BRAND, 0.15); rrect(ctx, 48, 14, 340, 12, 6); ctx.fill(); ctx.fillStyle = pal.acc[0]; rrect(ctx, 48, 14, Math.max(12, 340 * exp), 12, 6); ctx.fill();
    if (v26 && pop > 0.05) { ctx.fillStyle = css('#FFFFFF', 0.8 * pop); rrect(ctx, 48, 14, 340, 12, 6); ctx.fill(); } // 涨满那一下闪白
    ctx.font = font('ZENB', 14); ctx.fillStyle = pal.gray; ctx.fillText(`EXP ${Math.round(need * exp)} / ${need}`, 398, 25);
    ctx.restore(); }
  // 属性格
  const full = clamp((t - TA()) / (T_STICK() - TA())), max = t >= T_STICK();
  STATS24.forEach(([s, name], i) => {
    const a = a0 - 0.08 - i * 0.06, pa = popIn(S, a, 0.14); if (pa <= 0.01) return;
    const y = 300 + i * 132, x = 90 + (y - 560) * 0.055 - 48, hot = i === 0, pop = pa * (1 + (hot ? 0.16 : 0.05) * kick);
    tile(x, y, s, 72, pop, hot);
    const v = hot ? full : 0.45 + 0.25 * Math.sin(t * 2.3 + i * 1.7) + 0.12 * kick, seg = Math.round(v * 5);
    ctx.save(); ctx.globalAlpha = clamp(a / 0.1);
    for (let j = 0; j < 5; j++) { ctx.fillStyle = j < seg ? (hot ? pal.acc[0] : BRAND) : css(BRAND, 0.15); ctx.fillRect(x - 36 + j * 15, y + 46, 12, 8); }
    ctx.font = font('ZENB', 15); ctx.fillStyle = hot && max ? pal.acc[0] : pal.gray; ctx.textAlign = 'center'; ctx.fillText(hot && max ? `${name} MAX` : name, x, y + 74); ctx.textAlign = 'left';
    ctx.restore();
  });
  // 道具栏
  const sel = k % ITEMS24.length;
  ITEMS24.forEach(([s, n], i) => {
    const a = a0 - 0.3 - i * 0.05, pa = popIn(S, a, 0.14); if (pa <= 0.01) return;
    const x = 150 + i * 84, y = 976, on = i === sel;
    tile(x, y, s, 64, pa * (1 + (on ? 0.12 * kick : 0)), on);
    if (n) { ctx.save(); ctx.globalAlpha = clamp(a / 0.1); ctx.font = font('ZENB', 15); ctx.fillStyle = BRAND; ctx.textAlign = 'right'; ctx.fillText(n, x + 30, y + 28); ctx.restore(); }
  });
}

function content(ctx, S) {
  const pal = S.pal, G = fact('grpo_group_size', 'r1') || 16;
  const rects = [[3, 2, 64, 53], [67, 1, 158, 15], [67, 14, 158, 45], [67, 44, 158, 54]];
  const occ = new Occ();
  for (const r of rects) occ.rect(...r);
  const sprites = beatSprites(S, { mult: 1.2, avoid: rects });
  for (const s of sprites) occ.rect(...spriteCells(s));
  charField(ctx, S, { occ, density: bgDensity(1.2) });

  // 本拍与上一拍的奖励，拍头 0.12 s 内过渡
  const k = clamp(Math.floor((S.t - T0) / BEAT), 0, 7), e = easeOut(clamp((S.t - T0 - k * BEAT) / 0.12));
  const prev = rewards(k - 1, G), cur = rewards(k, G), r = cur.map((v, i) => lerp(prev[i], v, e));
  const mean = meanOf(r), std = stdOf(r), adv = (r[HI] - mean) / std;

  // 左：柠黄色块 + I03 网点照片
  const pw = 620, ph = 720, pcx = 400, pcy = 560, rot = -0.055, ps = popIn(S, S.t - TA() - inAt('P'), 0.16);
  ctx.save(); ctx.translate(pcx, pcy); ctx.scale(ps, ps); ctx.translate(-pcx, -pcy); // 第十一轮：照片也从 0 弹出
  ctx.save(); ctx.translate(pcx + 18, pcy + 14); ctx.rotate(0.03);
  ctx.fillStyle = '#B9CBFF'; rrect(ctx, -pw / 2 - 16, -ph / 2 - 16, pw + 32, ph + 32, 18); ctx.fill(); ctx.restore(); // 第十一轮：照片后面的黄块换浅蓝
  framed(ctx, portrait(pw, ph), pcx, pcy, pw, ph, { rot, scale: 1 + 0.014 * decay(S.sub * BEAT, 9), border: 12 });
  { // 第二十五轮：4 个色块横着排在右下，道具栏同一行的右边
    const cols = [pal.tint[1], pal.tint[2], pal.tint[0], '#C9C2FF'], sz = 34, gp = 10, x0 = 552, y0 = 976 - (sz + 2 * gp) / 2;
    ctx.save(); ctx.fillStyle = '#FFFFFF'; rrect(ctx, x0, y0, cols.length * (sz + gp) + gp, sz + 2 * gp, 12); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = pal.line; ctx.stroke();
    cols.forEach((c, i) => { ctx.fillStyle = c; rrect(ctx, x0 + gp + i * (sz + gp), y0 + gp, sz, sz, 8); ctx.fill(); ctx.lineWidth = 2; ctx.stroke(); });
    ctx.restore();
  }
  ctx.restore();
  nurture24(ctx, S, k);

  // 好感度 +1：每拍从照片上冒一个，往上飘、淡出
  for (let b = Math.max(0, k - 1); b <= k; b++) {
    const a = S.t - (T0 + b * BEAT);
    if (a < 0 || a > 0.8) continue;
    const x = 160 + rnd(b, 51) * 420, y = 360 + rnd(b, 52) * 380 - 90 * easeOut(a / 0.8);
    ctx.save(); ctx.globalAlpha = 1 - clamp((a - 0.5) / 0.3);
    ctx.font = font('ZENB', 34); ctx.lineJoin = 'round'; ctx.lineWidth = 8; ctx.strokeStyle = '#FFFFFF';
    ctx.strokeText('好感度 +1', x + 30, y + 12); ctx.fillStyle = pal.acc[0]; ctx.fillText('好感度 +1', x + 30, y + 12);
    ctx.restore();
    drawSprite(ctx, 'heart', 4, pal, x, y, Math.min(1, a / 0.08) * (1 - clamp((a - 0.5) / 0.3)));
  }

  // 公式卡：GRPO 组内优势，r_i 圈注
  let riBox = null;
  card(ctx, S, ...FCARD, { title: 'GRPO · 组内优势', age: S.t - TA() - inAt('F') }, c => {
    const L = drawFormula(ctx, 'grpo_adv', c.x + 8, c.y + c.h / 2, { size: 54, valign: 'mid', color: pal.text, colors: { ri: pal.acc[0] }, marks: { ri: pal.tint[0] }, write: S.t - TA() - inAt('F') - 0.1, dur: 0.5, sweep: formulaFx(S, 0).sweep });
    riBox = L.box('ri');
    ctx.font = font('ZENB', 30); ctx.fillStyle = BRAND; ctx.textAlign = 'right';
    ctx.fillText(`G = ${G}`, c.x + c.w - 8, c.y + 40);
    ctx.font = font('SC', 18); ctx.fillStyle = pal.gray;
    ctx.fillText('DeepSeek-R1 · arXiv:2501.12948', c.x + c.w - 8, c.y + c.h - 6);
    ctx.textAlign = 'left';
  });

  // 一组 16 个采样的奖励
  let hiPos = null;
  card(ctx, S, ...GCARD, { title: `一组 ${G} 个采样`, age: S.t - TA() - inAt('G') }, c => {
    for (let i = 0; i < G; i++) {
      const cx = c.x + 64 + (i % 4) * 128, cy = c.y + 58 + Math.floor(i / 4) * 124;
      const hi = i === HI, grow = easeOut(clamp((S.t - TA() - inAt('G') - 0.1 - i * 0.04) / 0.5)); // 第十一轮：圆环一个个填上
      ring(ctx, S, cx, cy, 42, r[i] * grow, { text: r[i].toFixed(2), fs: 22, color: hi ? pal.acc[0] : pal.ink[2], track: hi ? pal.tint[0] : pal.tint[3] });
      if (hi) { hiPos = [cx, cy]; drawSprite(ctx, 'thumb', 3, pal, cx + 40, cy - 40, 1 + 0.3 * decay(S.sub * BEAT, 10)); }
    }
  });
  if (riBox && hiPos) leader(ctx, S, (riBox[0] + riBox[2]) / 2, riBox[3] + 10, hiPos[0] + 50, hiPos[1] - 60, clamp((S.t - TA() - inAt('F') - 0.5) / 0.2), { color: pal.acc[0] });

  // 代入卡：这一拍的真实数值
  card(ctx, S, ...SCARD, { title: '代入', fill: pal.tint[1], age: S.t - TA() - inAt('S') }, c => {
    drawFormula(ctx, 'grpo_sub', c.x + c.w / 2, c.y + c.h / 2, {
      size: 34, align: 'c', valign: 'mid', color: pal.text,
      slots: {
        s_i: (cx, b) => slotNum(cx, b, String(HI + 1).padStart(2, '0'), { color: pal.acc[0], em: 0.62 }),
        s_r: (cx, b) => slotNum(cx, b, r[HI].toFixed(2), { color: pal.acc[0] }),
        s_m: (cx, b) => slotNum(cx, b, mean.toFixed(2)),
        s_sd: (cx, b) => slotNum(cx, b, std.toFixed(2)),
        s_a: (cx, b) => slotNum(cx, b, (adv >= 0 ? '+' : '') + adv.toFixed(2), { color: BRAND }),
      },
    });
  });

  // reward 大数字
  card(ctx, S, ...RCARD, { title: 'reward', age: S.t - TA() - inAt('R') }, c => {
    ctx.font = font('ZENB', 116); ctx.fillStyle = BRAND; ctx.textAlign = 'center';
    ctx.fillText(r[HI].toFixed(2), c.x + c.w / 2, c.y + 120);
    ctx.textAlign = 'left';
    ctx.fillStyle = pal.tint[3]; rrect(ctx, c.x + 10, c.y + 150, c.w - 20, 26, 13); ctx.fill();
    ctx.fillStyle = pal.acc[0]; rrect(ctx, c.x + 10, c.y + 150, (c.w - 20) * r[HI], 26, 13); ctx.fill();
    ctx.font = font('SC', 20); ctx.fillStyle = pal.gray; ctx.fillText('signal: positive', c.x + 10, c.y + c.h - 4);
  });
  hatch(ctx, RCARD[0] + RCARD[2] - 70, RCARD[1] - 30, 3, 22, pal.acc[1], { w: 7, gap: 12 });

  // 平均奖励曲线：每拍一个点，当前点在拍上跳
  card(ctx, S, ...CCARD, { title: 'mean reward', age: S.t - TA() - inAt('C') }, c => {
    const pts = [];
    for (let b = 0; b <= k; b++) pts.push(b < k ? meanOf(rewards(b, G)) : mean);
    const X = b => c.x + 20 + (b / 7) * (c.w - 60), Y = v => c.y + c.h - 4 - (v - 0.5) / 0.5 * (c.h - 14);
    ctx.strokeStyle = pal.tint[3]; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(c.x + 10, Y(0.5)); ctx.lineTo(c.x + c.w - 10, Y(0.5)); ctx.stroke();
    ctx.strokeStyle = BRAND; ctx.lineWidth = 4; ctx.lineJoin = 'round';
    ctx.beginPath(); pts.forEach((v, b) => (b ? ctx.lineTo(X(b), Y(v)) : ctx.moveTo(X(b), Y(v)))); ctx.stroke();
    ctx.fillStyle = pal.acc[0];
    ctx.beginPath(); ctx.arc(X(k), Y(mean), 8 + 4 * decay(S.sub * BEAT, 10), 0, Math.PI * 2); ctx.fill();
    ctx.font = font('ZENB', 26); ctx.fillStyle = pal.text; ctx.textAlign = 'right';
    ctx.fillText(`step ${k + 1} · mean ${mean.toFixed(2)}`, c.x + c.w - 10, c.y + 6);
    ctx.textAlign = 'left';
  });

  drawBeatSprites(ctx, S, sprites);
  offbeatFlashes(ctx, S, { avoid: rects });
}
