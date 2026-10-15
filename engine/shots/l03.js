// L03（14–15 小节，0:20.87–0:24.07）· "说喜欢这个声音"（视觉方案 §5.2a 第六轮）
// 她的声音从 I02（闭眼轻唱）的嘴边流出来，变成一条横贯画面的真实人声波形，往左流走；
// 这句歌词的每个字钉在它被唱出的那一刻的波形上，跟着波形一起流（字 = 声音的那一瞬间）。
// 左上：真实人声频谱卡（DFT 小公式当装饰）；左下：消息操作栏，15.1 点赞迸心 → 转场从点赞按钮处展开到 L04
import { W, H, BRAND, BEAT } from '../core/const.js';
import { barStart, beatTime, clamp, easeOut, easeOutBack, decay, smooth } from '../core/time.js';
import { rnd } from '../core/rand.js';
import { fonts } from '../core/glyphs.js';
import { vspec, lyric, onset } from '../core/data.js';
import { photo } from '../core/portrait.js';
import { drawSprite } from '../core/sprites.js';
import { camAt, withCam, camToScreen } from '../core/cam.js';
import { hud } from '../core/hud.js';
import { card } from '../core/kit.js';
import { drawFormula } from '../core/math.js';
import { lyricKinetic } from '../core/lyric.js';
import { targetLock, segBar } from '../core/hudkit.js';
import { rrect } from '../core/ui.js';
import { paper, backDeco, frontDeco } from './scene.js';
import { cutAt } from '../core/cuts.js';

const T0 = barStart(14), T1 = barStart(16), T_LIKE = beatTime(15, 1);
const SPAN = 3.2;                 // 波形显示最近 3.2 秒
const NOW_X = 1430, MID_Y = 470;  // 波形右端（= 现在，她的嘴边）
const PORTRAIT = [1160, 90, 760, 920];
const THUMB = [520, 905];         // 👍 的位置（原位坐标）

const CAM = [
  { t: T0, x: 50, y: -10, zoom: 1.06, rot: 0.006 },
  { t: T_LIKE - 0.05, x: -30, y: 0, zoom: 1.02, rot: -0.004 },
  { t: T_LIKE + 0.35, x: -40, y: 40, zoom: 1.08, e: 'out' },
  { t: T1 - 0.3, x: 0, y: 0, zoom: 1.0, rot: 0 },
];
// 转场到 L04 用：结尾时 👍 在屏幕上的位置
export const THUMB_END = camToScreen(camAt(CAM, T1 - 1 / 60), 1, THUMB[0], THUMB[1]);
// 第十轮（rev polish1）：频谱卡离画面边留白，镜头推拉收小；最后一帧和以前一样（L04 从点赞按钮展开按它算）
const CAM10 = [
  { t: T0, x: 10, y: -10, zoom: 1.0, rot: 0.004 },
  { t: T_LIKE - 0.05, x: -20, y: 0, zoom: 0.99, rot: -0.003 },
  { t: T_LIKE + 0.35, x: -30, y: 10, zoom: 1.04, e: 'out' },
  { t: T1 - 0.3, x: 0, y: 0, zoom: 1.0, rot: 0 },
];

// 第十一轮：点赞之后镜头不停，慢慢推向点赞按钮（转场的圆从按钮里长出来、中心跟着按钮走）
// 第十六轮：推到按钮的终点跟着切点走（cutAt，画帧时取）
const CAM11 = () => [...CAM10.slice(0, 3), { t: cutAt(16) + 0.3, x: -140, y: 70, zoom: 1.1, rot: -0.004, e: 'smooth' }];
const camOf = t => camAt(CAM11(), t);
// 第十二轮（用户：在「♪」点了赞，圆要等到下一句才展开，又慢又脱节）：从「♪」起连点几下赞、间隔不均，
// 最后一下之后圆马上从按钮里长出来（timeline 的 iris 从 T_IRIS03() 开始）。rev l03
// 第十六轮（切点提前到 L04 的「♪」前）：六下的间隔按比例收紧到 0.88 s（节奏的疏密不变），圆在「♪」之前 0.2 s 就开始长
const LIKES16 = [0, 0.22, 0.37, 0.66, 0.77, 0.88].map(d => T_LIKE + d);
const LIKES_ = () => LIKES16;
export const T_IRIS03 = () => LIKES_()[LIKES_().length - 1] + 0.07;
const likesUpTo = t => LIKES_().filter(x => x <= t);
// 某一刻 👍 在屏幕上的位置（转场的圆心）
export function thumbAt(t) { const [x, y] = camToScreen(camOf(t), 1, THUMB[0], THUMB[1]); return { x, y }; }
export const T_LIKE03 = T_LIKE;

// 她：I02 半身，贴纸白边，随拍轻轻呼吸。bare：只画人（L02 → L03 转场先只露她，第十二轮）
function figure(ctx, S, bare = false, only = '') { // only：'bg' 只画底卡，'her' 只画人（第十五轮：声波夹在两者之间）
  const [px, py, pw, ph] = PORTRAIT, br = 1 + 0.012 * decay(S.sub * BEAT, 8);
  ctx.save();
  ctx.translate(px + pw / 2, py + ph / 2); ctx.rotate(-0.03); ctx.scale(br, br);
  if (!bare && only !== 'her') { ctx.fillStyle = S.pal.tint[3]; rrect(ctx, -pw / 2 + 40, -ph / 2 + 30, pw - 60, ph - 20, 40); ctx.fill(); }
  if (only !== 'bg') ctx.drawImage(photo('I02', null, pw, ph, { keyed: true }), -pw / 2, -ph / 2);
  ctx.restore();
}
export const l03Figure = (ctx, S) => withCam(ctx, camOf(S.t), 1, g => figure(g, S, true));

// 歌词每个字此刻的 x（第十二轮）：本来的位置跟着波形流走，相邻两个字至少隔 GAP
// 第十五轮（用户：「声 ♪」出来得比歌声晚一点）：画面可以比声音早一点，每个字提前 0.2 s 出来
// 第十七轮（用户：「♪」出来得早了一点，「声」慢了一点）：查了人声分轨的起音——对时数据（stable-ts）把「声」放在 21.77，
// 其实「♪」的「♪」在 21.29 就唱了（前面一段 −36 dB 的空隙之后的起音），所以「声」晚了约 0.3 s；
// 「♪」在 20.49 才唱，提前 0.2 s 就落在 L02 → L03 的转场里（切点 20.46 之前）。按实测起音改这两个字，「♪」只提前 0.04 s
// 第十八轮（用户：0:21 中间歌词「♪」出现时间快了一点；歌词图层放到立绘后方）：上一轮把 L02 句尾「♪」的「♪」（20.49）当成了「♪」。
// 这次连音高一起看（scripts/vocal_onsets.py --notes）：「♪」「♪」之后 20.64–20.88 是一口气（没有音高的气声），「♪」的 k 送气在 20.82、元音 20.90 才出来。
// 整句改用实测起音（data/vocal_onsets.json），每个字提前 0.08 s 出来。歌词画在她后面：字从她尾巴的左边（LYR_X）出来，
// 刚弹出来那一下右边一点被尾巴挡住，像从她身后流出来；之后照旧跟着波形往左流（第十七、十八轮的开关第二十轮并进代码）
const GAP = 104, LEAD18 = 0.08, LYR_X = 1205;
// 第 i 个字在波形上的时刻（钉在哪）和出现的时刻
const chT = (ch, i) => onset('L03', i);
const chShow = (ch, i) => chT(ch, i) - LEAD18;
function lyricXs(t) {
  const ch = lyric('L03').chars;
  // 第十三轮（用户：「♪」被后面的「♪」推着挪）：不再推前面的字。每个字出生时看前一个字已经走到哪，
  // 不够 GAP 就往右一点出生（最多比嘴边靠右一百多 px），之后所有字都按同一个速度往左流，谁也不碰谁
  // 第十八轮：从出现那一刻、在 LYR_X 出生（以前在嘴边 NOW_X、比出现早 0.2 s 出生，出现时已经叠在她身上）
  const v = NOW_X / SPAN, xs = [], born = [], tb = i => chShow(ch, i);
  for (let i = 0; i < ch.length; i++) {
    const ti = tb(i), prev = i ? born[i - 1] - v * (ti - tb(i - 1)) : -1e9;
    born.push(Math.max(LYR_X, prev + 96));
    xs.push(born[i] - v * (t - ti));
  }
  return xs;
}

// 人声响度：人声频谱中段的平均
function voice(t) {
  const s = vspec(t);
  let v = 0;
  for (let i = 4; i < 22; i++) v += s[i];
  return Math.pow(v / 18, 1.15);
}

export function l03(ctx, S) {
  const cam = camOf(S.t), c = cam; // 第十一轮：不加拍头推镜，转场圆心要准
  paper(ctx, S, c);
  backDeco(ctx, S, c, 30, { alpha: 0.45, boxes: [[40, 640, 600, 200], [700, 40, 560, 160], [80, 60, 500, 120]] });
  withCam(ctx, c, 1, g => content(g, S));
  frontDeco(ctx, S, c, 31, { alpha: 0.55, items: [['ecg', -80, 30, 520], ['ring', 1960, 1040, 260]] });
  hud(ctx, S, { spectrum: false, lyric: false });
}

function content(ctx, S) {
  const pal = S.pal, t = S.t;

  figure(ctx, S, false, 'bg');

  // 波形：最近 SPAN 秒的人声，上下对称，右端是现在
  // 第十五轮（用户：中间的声波图形放到立绘后面，并延长到立绘脖子的位置）。rev l03w
  // 先画波形再画她；NOW_X 往右再接一段到她的脖子（NECK_X），这一段是此刻的音量、往脖子收窄一点——声音从她的喉咙里出来；
  // 时间轴（每秒走多少 px）不变，所以字还是钉在被唱出那一刻的波形上
  const n = 180, amp = 230, NECK_X = 1612, x1 = NECK_X;
  const X = k => NOW_X - (k / n) * NOW_X;
  ctx.save();
  ctx.beginPath();
  { const v = voice(t); ctx.moveTo(x1, MID_Y + 30 - 6 - v * amp * 0.55); ctx.lineTo(NOW_X, MID_Y - 6 - v * amp); }
  for (let k = 0; k <= n; k++) { const v = voice(t - (k / n) * SPAN); ctx.lineTo(X(k), MID_Y - 6 - v * amp); }
  for (let k = n; k >= 0; k--) { const v = voice(t - (k / n) * SPAN); ctx.lineTo(X(k), MID_Y + 6 + v * amp * 0.75); }
  { const v = voice(t); ctx.lineTo(x1, MID_Y + 30 + 6 + v * amp * 0.4); }
  ctx.closePath();
  const gr = ctx.createLinearGradient(0, 0, x1, 0);
  gr.addColorStop(0, 'rgba(77,107,254,0.08)'); gr.addColorStop(0.7, 'rgba(77,107,254,0.55)'); gr.addColorStop(1, 'rgba(77,107,254,0.9)');
  ctx.fillStyle = gr; ctx.fill();
  ctx.strokeStyle = BRAND; ctx.lineWidth = 3; ctx.stroke();
  // 节拍刻度：每拍一根竖线，跟着波形流走
  ctx.strokeStyle = 'rgba(77,107,254,0.35)'; ctx.lineWidth = 2;
  for (let b = Math.floor(S.n); b > S.n - SPAN / BEAT; b--) {
    const tb = 0.0665 + b * BEAT, x = NOW_X - ((t - tb) / SPAN) * NOW_X;
    ctx.beginPath(); ctx.moveTo(x, MID_Y - 270); ctx.lineTo(x, MID_Y + 220); ctx.stroke();
  }
  ctx.restore();
  // 嘴边的发声点（第十五轮：在她身后的喉咙处，锁定框跟过去）
  const vx = NECK_X, vy = MID_Y + 30;
  ctx.fillStyle = pal.acc[0];
  ctx.beginPath(); ctx.arc(vx, vy, 10 + 10 * voice(t), 0, Math.PI * 2); ctx.fill();
  // 歌词：每个字钉在被唱出那一刻的波形上，跟着流走
  // 第十一轮（用户：歌词放到中间蓝色频谱上，白字蓝边）：钉在波形带的正中，跟着波形流走
  // 第十二轮（用户：「♪」唱得快、字跟着波形走得也快，叠在她身上；「♪」出来得比歌声晚一点）：
  // 每个字提前 0.1 s 出来；相邻两个字至少隔 GAP，挤的时候把前面的字往左推（从最新的字往回排）。rev l03
  // 第十八轮：画在她后面
  const lyrics = () => {
    const xs = lyricXs(S.t), chs = lyric('L03').chars;
    lyricKinetic(ctx, S, 'L03', (i, age, ch) => {
      age += chs[i].t0 - chShow(chs, i); // age 是从对时数据的 t0 算的，换成从出现时刻算
      if (age < 0) return null;
      const x = xs[i];
      if (x < -80) return null;
      const e = easeOutBack(clamp(age / 0.16), 2.4);
      const y = MID_Y + 8 - 50 * (1 - e) + 6 * Math.sin(age * 5 + i);
      return { x, y, s: 0.3 + 0.7 * e, r: (rnd(i, 3) - 0.5) * 0.16, a: clamp(age / 0.04) * clamp((x + 80) / 300), color: '#FFFFFF' };
    }, { size: 96, stroke: 14, strokeColor: BRAND });
  };
  lyrics();
  figure(ctx, S, false, 'her');
  targetLock(ctx, S, vx, vy, 70, S.lt, { label: 'VOICE', color: pal.acc[0] });

  // 左上：真实人声频谱卡
  card(ctx, S, 100, 100, 540, 290, { title: 'vocal spectrum', age: S.lt - 0.1 }, c => {
    const sp = vspec(t), bw = c.w / 32;
    let peak = 0;
    for (let i = 1; i < 32; i++) if (sp[i] > sp[peak]) peak = i;
    for (let i = 0; i < 32; i++) {
      const h = 6 + sp[i] * (c.h - 70);
      ctx.fillStyle = i === peak ? pal.acc[0] : BRAND;
      rrect(ctx, c.x + i * bw + 2, c.y + c.h - 40 - h, bw - 4, h, 3); ctx.fill();
    }
    ctx.font = fonts(16, 'ZENB', 'SCB'); ctx.fillStyle = pal.gray;
    ctx.fillText('100 Hz', c.x, c.y + c.h - 12); ctx.textAlign = 'right'; ctx.fillText('8 kHz', c.x + c.w, c.y + c.h - 12); ctx.textAlign = 'left';
    drawFormula(ctx, 'dft', c.x + c.w, c.y - 6, { size: 22, align: 'r', color: pal.gray, alpha: 0.8 });
  });

  // 左下：消息操作栏。15.1 点赞：👍 弹大变亮，迸出六颗心
  const taps = likesUpTo(t), lit = taps.length > 0, la = lit ? t - taps[0] : -1, lp = lit ? t - taps[taps.length - 1] : -1;
  card(ctx, S, 100, 850, 560, 110, { age: S.lt - 0.2, r: 22 }, c => {
    ctx.font = fonts(26, 'SC'); ctx.fillStyle = pal.gray; ctx.textBaseline = 'middle';
    ctx.fillText('复制 · 重新生成 ·', c.x + 8, c.y + c.h / 2);
    ctx.textBaseline = 'alphabetic';
    if (lit) { ctx.fillStyle = pal.tint[0]; rrect(ctx, THUMB[0] - 40, THUMB[1] - 36, 80, 72, 22); ctx.fill(); }
    // 每按一下：先压一下（0.04 s）再弹大、慢慢回落
    const sc = !lit ? 1 : 1.15 + 0.45 * easeOutBack(clamp((lp - 0.03) / 0.1), 2.4) * decay(lp, 3.5) - 0.2 * Math.sin(Math.PI * clamp(lp / 0.05)) * (lp < 0.05 ? 1 : 0);
    drawSprite(ctx, 'thumb', 5, pal, THUMB[0], THUMB[1], sc, lit ? 1 : 0.5);
    drawSprite(ctx, 'thumbDown', 5, pal, THUMB[0] + 100, THUMB[1], 1, 0.45);
  });
  // 心：每按一下迸出一簇（第十二轮每簇少几颗、角度错开）
  taps.forEach((tk, k) => {
    const a = t - tk;
    if (a >= 1.2) return;
    const n = 5;
    for (let i = 0; i < n; i++) {
      const ang = Math.PI * (1.05 + (i + rnd(k, 61) * 0.8) * 0.19), d = 20 + easeOut(clamp(a / 0.6)) * (140 + rnd(i + k * 8, 4) * 80);
      drawSprite(ctx, 'heart', 4 + ((i + k) % 2), pal, THUMB[0] + Math.cos(ang) * d, THUMB[1] + Math.sin(ang) * d + 90 * a * a, easeOutBack(clamp(a / 0.09), 2), 1 - clamp((a - 0.7) / 0.5));
    }
  });
  if (t > T_LIKE - 0.35 && t < cutAt(16) + 0.3) tapPointer(ctx, t, lit ? lp : 1);
  if (lit) {
    ctx.save(); ctx.globalAlpha = clamp(la / 0.1);
    ctx.font = fonts(30, 'ZENB', 'SCB'); ctx.fillStyle = BRAND;
    ctx.fillText('她收到了你的赞', 690, 915);
    if (taps.length > 1) { // 连点的次数，每多一下弹一下
      const k = easeOutBack(clamp(lp / 0.12), 3);
      ctx.save(); ctx.translate(912, 905); ctx.scale(k, k); ctx.fillStyle = pal.acc[0]; ctx.font = fonts(30, 'ZENB'); ctx.fillText(`×${taps.length}`, 0, 10); ctx.restore();
    }
    ctx.restore();
    segBar(ctx, S, 690, 935, 300, 16, taps.length / LIKES_().length);
  }
}

// 点赞的指针：点赞前从右下滑到按钮上，每按一下往下压一点（第十二轮）
function tapPointer(ctx, t, lp) {
  const press = lp < 0.08 ? Math.sin(Math.PI * (lp / 0.08)) : 0, arr = 1 - easeOut(clamp((t - T_LIKE + 0.35) / 0.3)); // 先从右下滑过来
  const x = THUMB[0] + 14 + 180 * arr, y = THUMB[1] + 10 + 5 * press + 80 * arr;
  ctx.save(); ctx.translate(x, y); ctx.scale(1.5 * (1 - 0.1 * press), 1.5 * (1 - 0.1 * press));
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 22); ctx.lineTo(6, 17); ctx.lineTo(10, 26); ctx.lineTo(14, 24); ctx.lineTo(10, 15); ctx.lineTo(17, 15); ctx.closePath();
  ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#1D2541'; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.restore();
}
