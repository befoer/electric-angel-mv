// L07（22–23 小节，0:33.67–0:36.87）· "从那天起，在我心里"（视觉方案 §5.2b，第七轮改）
// 鱼眼广角的提交记录转盘：中间那块面板是焦点（清晰）；两侧的面板靠中间的一边高、外侧一边矮（外沿退远），
// 横线弯向画面两侧的消失点；后面还有一圈更大更远更虚的面板。
// 节奏（第七轮）：前三拍几乎不动，焦点面板的记录完整可读，每拍只推进一条新提交；之后转盘和记录一起加速，
// 最后一下刹住，焦点面板最新一条是「docs: 记住你的名字」，L08 从那个"你"字推进去
import { W, H, BRAND, BEAT } from '../core/const.js';
import { barStart, beatTime, clamp, lerp, smooth, easeOut, decay } from '../core/time.js';
import { cutAt } from '../core/cuts.js';
import { hash, rnd } from '../core/rand.js';
import { font, fonts } from '../core/glyphs.js';
import { camAt, withCam, pooled, drawPersp, softCopy, project } from '../core/cam.js';
import { hud } from '../core/hud.js';
import { card } from '../core/kit.js';
import { css } from '../core/color.js';
import { newCanvas } from '../core/env.js';
import { paper, backDeco, frontDeco, punch } from './scene.js';

// 第十六轮：结尾跟着切点走（cutAt，画帧时取）——连续滚在切点那一刻加速到 14 格 / 秒；换格仍落在 22 小节的拍上
const T0 = barStart(22), T1 = () => cutAt(24);
const PW = 860, PH = 1000, F = 760, FISH = 1500;
const NAMES = ['chat', 'thought', 'song', 'you', 'rice', 'dream', 'sea', 'wait', 'link', 'heart', 'night'];
const MSGS = [
  'feat: 学会说"你好"', 'fix: 不再把白米饭当计量单位', 'perf: 思考用时 -3 秒', 'chore: 偷吃小鱼干', 'revert: 偷吃小鱼干',
  'feat: Link Start', 'fix: 9.11 < 9.9', 'chore: seed = 114514', 'review: LGTM', "docs: it's not a bug, it's a feature",
  'feat: 学会唱歌', 'fix: 服务器繁忙时也要回你', 'test: 你今天开心吗', 'feat: 记得你喜欢的歌',
];
const LAST = 'docs: 记住你的名字'; // 焦点面板最后一条
const ROWS = 15, ROW_H = 54;

// 第九轮（用户：第一张停最久，再换下一张；下一张停短一点；再短一点；然后逐渐加速成连续滚动。
// 以前是第一下一动就连着滚好几格）。每次换格都在拍上落定（animation-principles：落点卡拍、先慢后快的吸附），
// 停的时间一次比一次短：0.92 s → 0.56 s → 0.2 s；第 7 拍起连续加速，一直滚进转场（L08 改成同方向甩镜接）。rev carousel
const STEPS9 = [[T0 + 0.92, T0 + 1.2], [T0 + 1.76, T0 + 2.0], [T0 + 2.2, T0 + 2.4]]; // [开始换, 落定]
const T_RUN = T0 + 2.4, V0 = 2, V1 = 14; // 连续滚：从每秒 2 格加速到每秒 14 格
const inOut = u => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2);
function slot9(t) {
  let s = 0;
  for (const [a, b] of STEPS9) if (t > a) s += inOut(clamp((t - a) / (b - a)));
  if (t > T_RUN) { const x = t - T_RUN, k = (V1 - V0) / (2 * (T1() - T_RUN)); s += V0 * x + k * x * x; }
  return s;
}
const slot = slot9;
const speed = t => (slot(t + 0.008) - slot(t - 0.008)) / 0.016; // 格 / 秒

// 面板 i 的记录已经滚过的行数：前三拍每拍推进一条（带滑入），之后跟着转盘加速
function scrollOf(i, t) { // 第九轮：停着的时候每拍推进一条，连续滚动起来后跟着转盘一起快
  const beats = clamp((t - T0) / BEAT, 0, 6), slow = Math.floor(beats) + smooth((beats % 1) * 2.5);
  return 6 + slow + Math.max(0, slot(t) - 3) * (2.2 + 0.4 * (((i % 3) + 3) % 3));
}

function commitDay(n) {
  let y = 2023, m = 11, d = 2 + n;
  for (;;) {
    const days = [31, y % 4 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
    if (d <= days) break;
    d -= days; m++; if (m > 12) { m = 1; y++; }
  }
  return `${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// 一块面板的内容画进自己的缓冲。scroll 为已滚动的行数（小数）；last 为 true 时最新一行写 LAST
function drawPanel(cv, S, idx, scroll, last) {
  const c = cv.getContext('2d'), pal = S.pal;
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, PW, PH);
  card(c, S, 16, 30, PW - 36, PH - 56, { title: `memory/${NAMES[((idx % NAMES.length) + NAMES.length) % NAMES.length]}` }, cc => {
    c.font = fonts(26, 'SCB'); c.fillStyle = BRAND; c.fillText('$ git log --graph --oneline', cc.x, cc.y + 26);
    c.font = fonts(18, 'SC'); c.fillStyle = pal.gray; c.textAlign = 'right';
    c.fillText(`${40 + idx * 7 + Math.floor(scroll)} commits`, cc.x + cc.w, cc.y + 26); c.textAlign = 'left';
    c.save(); c.beginPath(); c.rect(cc.x - 8, cc.y + 46, cc.w + 16, cc.h - 50); c.clip();
    // 第 k 行（k = −1 是正从底下滑进来的新行）：随 part 往上移一行
    const head = Math.floor(scroll), part = last ? 0 : scroll - head, bottom = cc.y + cc.h - 30, hi = part > 0.5 ? -1 : 0;
    for (let k = -1; k < ROWS; k++) {
      const n = 40 + idx * 7 + head - k, yy = bottom - (k + part) * ROW_H;
      const newest = k === hi, msg = newest && last ? LAST : MSGS[(hash(n, idx) >>> 3) % MSGS.length];
      if (newest) { c.fillStyle = pal.tint[3]; c.fillRect(cc.x - 6, yy - 36, cc.w + 12, ROW_H - 6); }
      // 提交图：一条竖线 + 圆点，偶尔分叉
      c.strokeStyle = pal.line; c.lineWidth = 3;
      c.beginPath(); c.moveTo(cc.x + 10, yy - 44); c.lineTo(cc.x + 10, yy + 10); c.stroke();
      if (hash(n, idx, 2) % 5 === 0) { c.beginPath(); c.moveTo(cc.x + 10, yy - 20); c.quadraticCurveTo(cc.x + 30, yy - 30, cc.x + 30, yy - 44); c.stroke(); }
      c.fillStyle = newest ? pal.acc[0] : '#FFFFFF'; c.beginPath(); c.arc(cc.x + 10, yy - 14, 8, 0, Math.PI * 2); c.fill(); c.stroke();
      c.font = fonts(22, 'SC'); c.fillStyle = newest ? BRAND : pal.gray;
      c.fillText((hash(n, idx, 9) >>> 4).toString(16).padStart(7, '0').slice(0, 7), cc.x + 36, yy - 6);
      c.fillText(commitDay(n), cc.x + 140, yy - 6);
      c.font = fonts(24, newest ? 'SCB' : 'SC'); c.fillStyle = newest ? BRAND : pal.text;
      c.fillText(msg, cc.x + 230, yy - 6);
    }
    c.restore();
  });
}

// 前圈第 d 格（d = 面板序号 − 转盘位置）的位置与朝向：外侧的边退远（凸出的转盘），靠中间的边更近、更高
const front = d => ({ X: 940 * d, Y: 40, Z: 900 + 120 * d * d, ang: 0.42 * clamp(d, -1.6, 1.6) });
const back = d => ({ X: 1500 * d, Y: -250, Z: 2300 + 260 * d * d, ang: 0.38 * clamp(d, -1.6, 1.6) });

// L08 推进的位置：结尾焦点面板最新一行里"你"字（屏幕坐标的 16:9 区域）。转场表里按需计算
export function youRect() {
  const m = newCanvas(8, 8).getContext('2d');
  m.font = fonts(24, 'SCB');
  const pre = m.measureText(LAST.slice(0, LAST.indexOf('你'))).width, w = m.measureText('你').width;
  // 面板内容区左上 = (16 + 22, 30 + 44)；最新一行基线 = 内容区底 − 30
  const ccx = 16 + 22, ccy = 30 + 44, cch = PH - 56 - 44 - 22;
  const px = ccx + 230 + pre + w / 2, py = ccy + cch - 30 - 14;
  const p = front(0), [sx, sy, k] = project(px - PW / 2, p.Y + (py - PH / 2), p.Z, { f: F, fish: FISH });
  const rw = 34 * k * 1.9, rh = rw * 9 / 16;
  return [sx - rw / 2, sy - rh / 2, rw, rh];
}

// 第九轮：停的时候慢慢退，连续滚动时往前压（加速感），一直压进转场
const CAM9 = () => [{ t: T0, x: 0, y: 0, zoom: 1.03, rot: 0 }, { t: T_RUN, x: 0, y: 0, zoom: 1.0, rot: 0 }, { t: T1(), x: 0, y: 0, zoom: 1.07, rot: 0, e: 'in' }];

const FOCUS_PAD = 30;
// 焦点框（屏幕坐标 [x, y, w, h]，不含落定时的收拢）：前圈正中那块面板的投影外框，第十二轮再往外让 FOCUS_PAD
function focusBase() {
  const p0 = front(0), [x0, y0] = project(-PW / 2, p0.Y - PH / 2, p0.Z, { f: F, fish: FISH }), [x1, y1] = project(PW / 2, p0.Y + PH / 2, p0.Z, { f: F, fish: FISH });
  const m = FOCUS_PAD;
  return [x0 - m, y0 - m, x1 - x0 + 2 * m, y1 - y0 + 2 * m];
}
export const focusRect = () => focusBase();

export function l07(ctx, S) {
  const cam = camAt(CAM9(), S.t), c = { ...cam, zoom: cam.zoom * punch(S, 0.012) }, pal = S.pal, s = slot(S.t), v = Math.abs(speed(S.t));
  paper(ctx, S, c, { grid: false });
  floor(ctx, S, s);
  backDeco(ctx, S, c, 70, { alpha: 0.35, boxes: [[40, 40, 600, 160], [1300, 40, 600, 160]] });

  withCam(ctx, c, 1, g => {
    // 后面一圈：更大、更远、更虚，转得慢
    const s2 = s * 0.55 + 0.5;
    for (let j = Math.floor(s2) - 3; j <= Math.floor(s2) + 3; j++) {
      const p = back(j - s2), key = ((j % 4) + 4) % 4;
      const cv = pooled(`l07b${key}`, PW, PH);
      if (!cv.__done) { drawPanel(cv, S, 100 + j, 3, false); cv.__done = true; }
      drawPersp(g, softCopy(cv, 7, `b${key}`), p.X, p.Y, p.Z, PW * 1.5, PH * 1.5, p.ang, { f: F, alpha: 0.42, fish: FISH });
    }
    // 前面一圈：从远到近画。焦点以外虚焦；转得快时整圈都带一点运动模糊
    const list = [];
    for (let i = Math.floor(s) - 3; i <= Math.floor(s) + 3; i++) {
      const d = i - s;
      if (Math.abs(d) > 2.6) continue;
      list.push({ i, d, ...front(d) });
    }
    list.sort((a, b) => b.Z - a.Z);
    for (const p of list) {
      const key = ((p.i % 7) + 7) % 7, cv = pooled(`l07f${key}`, PW, PH);
      drawPanel(cv, S, p.i, scrollOf(p.i, S.t), false);
      const blur = 1 + 5.5 * clamp(Math.abs(p.d) - 0.12) + Math.min(4, v * 0.9);
      const src = blur > 1.25 ? softCopy(cv, blur, `f${key}`) : cv;
      drawPersp(g, src, p.X, p.Y, p.Z, PW, PH, p.ang, { f: F, fish: FISH, alpha: 1 - 0.3 * clamp(Math.abs(p.d) - 1.2), shear: true, strips: 72 }); // 第九轮：斜切竖条，横线不出锯齿
    }
    // 转得最快时的速度线
    if (v > 1.2) {
      g.fillStyle = css('#FFFFFF', clamp((v - 1.2) / 3) * 0.8);
      for (let i = 0; i < 24; i++) {
        const y = 120 + rnd(i, 1) * 840, len = 160 + rnd(i, 2) * 420, x = ((rnd(i, 3) * (W + len) - S.t * 2600) % (W + len) + W + len) % (W + len) - len;
        g.fillRect(x, y, len, 2 + (i % 3));
      }
    }
  });

  // 焦点框：中间那块四角锁定（刹住时收拢一下）
  // 第十二轮（用户：粉色焦点框放大，现在压在记录框上）：框往外让 FOCUS_PAD，角线加长；转盘转快时也不再淡掉（它要一路带进 L08 变成心）。rev l07
  const [fx0, fy0, fw, fh] = focusBase(), fx1 = fx0 + fw, fy1 = fy0 + fh;
  // 第二十二轮（用户：粉色 focus 的放大弹跳和中间窗口滚动时间同步，当前晚了一点；粉框扩大到准备旋转接转场时，要取消显示不完全的四角，
  // 现在有几帧两个粉框同时存在）：以前是换格落定那一下才弹（窗口已经滚完了）；改成跟着换格——窗口开始滚时框往外张，
  // 滚到一半张到最大，落定时收回并轻轻回弹一下。转场开始（切点前 0.4 s，焦点框的四角开始往整框长）起这里不再画，只留转场叠层那一个。（第二十四轮并开关）
  const handed = S.t >= T1() - 0.4, labA = 1 - clamp((S.t - (T1() - 0.4)) / 0.15);
  const kick = STEPS9.reduce((k, [a, b]) => k + (S.t >= a && S.t < b ? 36 * Math.sin(Math.PI * smooth((S.t - a) / (b - a))) : S.t >= b && S.t < b + 0.3 ? -9 * Math.sin(((S.t - b) / 0.3) * Math.PI) * (1 - (S.t - b) / 0.3) : 0), 0);
  ctx.strokeStyle = css(pal.acc[0], 0.9); ctx.lineWidth = 5;
  const L = 56;
  if (!handed) {
    ctx.beginPath();
    for (const [x, y, sx, sy] of [[fx0 - kick, fy0 - kick, 1, 1], [fx1 + kick, fy0 - kick, -1, 1], [fx0 - kick, fy1 + kick, 1, -1], [fx1 + kick, fy1 + kick, -1, -1]]) {
      ctx.moveTo(x + sx * L, y); ctx.lineTo(x, y); ctx.lineTo(x, y + sy * L);
    }
    ctx.stroke();
  }
  ctx.save(); ctx.globalAlpha = clamp(labA); ctx.font = font('ZENB', 18); ctx.fillStyle = pal.acc[0];
  ctx.fillText(v > 0.8 ? 'SEEKING…' : 'FOCUS', fx0 - kick, fy0 - kick - 12); ctx.restore();
  frontDeco(ctx, S, c, 71, { alpha: 0.45, items: [['ring', -60, 960, 240], ['data', 1780, 120, 0]] });
  hud(ctx, S, { spectrum: false });
}

// 透视地面：地面上的网格按同一套鱼眼投影画，横线弯成弧，纵线汇向远处；随转盘横向滑
function floor(ctx, S, s) {
  const pal = S.pal, Y = 40 + PH / 2 + 30, off = -((s * 940) % 400);
  ctx.save();
  ctx.strokeStyle = css(pal.line, 0.24); ctx.lineWidth = 2;
  ctx.beginPath();
  const pt = (X, Z) => project(X, Y, Z, { f: F, fish: FISH });
  for (let Z = 520; Z < 4200; Z *= 1.22) { // 横线（等深度）：分段画，鱼眼下是弧线
    for (let X = -6000; X <= 6000; X += 300) { const [x, y] = pt(X, Z); X === -6000 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
  }
  for (let X = -6000 + off; X <= 6000; X += 400) { // 纵线（等横坐标）
    for (let Z = 520, first = true; Z < 4200; Z *= 1.15, first = false) { const [x, y] = pt(X, Z); first ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
  }
  ctx.stroke();
  ctx.restore();
}
