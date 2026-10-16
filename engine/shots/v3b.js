// 第三段副歌（少女音 · 晨光）L29–L32（99–106 小节，2:36.87–2:49.67），视觉方案 §5.0 少女版 C1–C4，第七轮实现
import { W, H, BRAND, BEAT, STEP } from '../core/const.js';
import { barStart, beatTime, clamp, lerp, smooth, easeIn, easeOut, easeOutBack, decay } from '../core/time.js';
import { cutAt } from '../core/cuts.js';
import { hash, rnd } from '../core/rand.js';
import { font, fonts } from '../core/glyphs.js';
import { fact, keyword, lyric, onset } from '../core/data.js';
import { rev } from '../rev.js';
import { vidFrame, framesInfo, hasFrames, trackOf, registerPrefetch } from '../core/frames.js';
import { newCanvas } from '../core/env.js';
import { photo, keyed, aspectOf, sizeOf, ANCHOR, hasIllust } from '../core/portrait.js';
import { camAt, withCam, pooled, camToScreen } from '../core/cam.js';
import { hud } from '../core/hud.js';
import { card, corners, ring } from '../core/kit.js';
import { drawFormula } from '../core/math.js';
import { drawSprite } from '../core/sprites.js';
import { hudCluster, ecgStrip, targetLock } from '../core/hudkit.js';
import { css, mix } from '../core/color.js';
import { rrect } from '../core/ui.js';
import { flash, shake } from '../core/fx.js';
import { paper, backDeco, frontDeco, punch, chatWin, bigLine } from './scene.js';
import { JP_KEYS } from '../core/bigtype.js';
import { dotType } from '../core/dottype.js';
import { charWings, fallPlates28 } from './v3a.js';
import { memoryFrame } from '../core/memory.js';
import { tickRing, satellite } from '../core/struct22.js';

const GOLD = '#FFC23D';

// ================================================================ L29 · C1 少女版 · 只要能和你在一起（99–100）
// 第八轮（用户：原版 PV 里双子和鼠标指针 = 用户互动，很有意思）：你的鼠标指针来找她——
// 先像选中一个图层一样把她框起来（虚线框 + 控制点 +「她.png」）→ 指针变成小手摸头（爱心冒出来）→ 指针逗她，她跟着歪身子 →
// 她伸手（I05），指针过去，指尖碰到指尖的那一下亮起来「已连接」→ 双击：一捧爱心；最后她的蓝色光标出现在你的箭头旁边，挨在一起
// 第十六轮：镜头的起止跟着切点走（core/cuts.js，画帧时取）；指针路径按拍走，仍从小节线 B99 数拍
const B99 = barStart(99), L29_0 = () => cutAt(99), L29_1 = () => cutAt(101);
const HER17 = { x: 600, y: 60, h: 1000 };               // I05 立绘放的位置（左上角）与高度
const HEAD17 = [0.5, 0.13], HAND17 = [0.11, 0.44];      // I05 里头顶、伸出的手的位置（归一化）
// 第十八轮（I05 换成最终精度的大图，rev img18）：按真图宽高比放（宽 = 高 × 2254/3780）；指尖、头顶用新图里量的位置（portrait.js ANCHOR）；
// 人缩到 940 高、往下挪 10，脚离画面底边留 70 px（以前脚压在底下的频谱上）；选中框的标签写真图的尺寸
const i18 = () => true; // 第十八轮的 I05 / I08 大图摆位（开关第二十轮并进代码）
const her29 = () => (i18() ? { x: 600, y: 70, h: 940 } : HER17);
const herW = H => (i18() ? H.h * aspectOf('I05') : (H.h * 1080) / 1920);
const hand29 = () => (i18() ? ANCHOR.I05.tip : HAND17), head29 = () => (i18() ? ANCHOR.I05.head : HEAD17);
// 指针路径：[拍, x, y]（拍 = 从小节线 B99 起的拍数）
const PATH = [[0, 2050, 760], [1.0, 1260, 470], [1.5, 1210, 380], [2.0, 900, 170], [3.4, 900, 170], [4.0, 1330, 560], [4.6, 1150, 300], [5.2, 1300, 420], [6.0, 0, 0], [8.2, 0, 0]];
function cursorAt(t, hand) {
  const b = (t - B99) / BEAT;
  for (let i = 1; i < PATH.length; i++) if (b < PATH[i][0]) {
    const [b0, x0, y0] = PATH[i - 1], [b1, x1, y1] = PATH[i], u = smooth((b - b0) / (b1 - b0));
    const A = x0 || y0 ? [x0, y0] : hand, B = x1 || y1 ? [x1, y1] : hand;
    return [lerp(A[0], B[0], u), lerp(A[1], B[1], u)];
  }
  return hand;
}
function arrow(g, x, y, s, a = 1) { // 经典箭头
  g.save(); g.globalAlpha *= a; g.translate(x, y); g.scale(s, s);
  g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 22); g.lineTo(6, 17); g.lineTo(10, 26); g.lineTo(14, 24); g.lineTo(10, 15); g.lineTo(17, 15); g.closePath();
  g.fillStyle = '#FFFFFF'; g.fill(); g.lineWidth = 1.6; g.strokeStyle = '#1D2541'; g.lineJoin = 'round'; g.stroke(); g.restore();
}
function handCursor(g, x, y, s) { // 小手（链接指针）：竖起食指
  g.save(); g.translate(x, y); g.scale(s, s); g.fillStyle = '#FFFFFF'; g.strokeStyle = '#1D2541'; g.lineWidth = 1.6; g.lineJoin = 'round';
  rrect(g, -4, 0, 8, 16, 4); g.fill(); g.stroke();
  rrect(g, -8, 11, 20, 16, 6); g.fill(); g.stroke();
  for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(-1 + k * 4, 12); g.lineTo(-1 + k * 4, 17); g.stroke(); }
  g.restore();
}
// 第二十轮、第二十一轮的 L29（V11 视频：分段变速 + 跳剪播放器 + 她从 L28 走进视频）第二十六轮并开关 l29v24 时删了，旧 V11 的抽帧不再用。
// L28 → L29 叠层：视频里她是从画面上沿外落进来的，L28 结尾她往上飞出画面（herUp24，在下面）
export function her2829(ctx, S, u, a28) { return herUp24(ctx, S, u, a28); }// ---------------------------------------------------------------- 第二十四轮：L29 换成 V11_3（第二十六轮并开关 l29v24）
// 用户：「V11 是我使用了旧 prompt……视频模型最低时间是 5 秒，我生成了 5 秒的 V11_3，先看看能不能用」——能用：内容就是第二十二轮写的分镜
// （首帧空白 → 她从上沿外落下来 → 落地扬起一团云 → 指针过来点她腰 → 变成小手摸头 → 箭头飘开 → 她伸手、小手碰到掌心 → 停住）。
// 视频 5.17 s，这句（到 L30 心形转场盖住为止）约 3.8 s。不裁、不跳剪；按动作分段对字，平滑地变速（单调三次插值，速度不跳）：
//   落下 ×1.9（落得快一点像重力）→ 落地「♪」→ 缓冲站稳 ×1.4 → 站着不动的 0.75 s 压到 0.18 s（没有动作，看不出快）→ 指针过来、点她 ×1.45
//   → 点到她在「♪」→ 摸头到伸手 ×1.27（第二下摸头正好在「♪」）→ 指尖碰到掌心在「♪」→ 之后放慢到 ×0.65，停在伸手的姿势盖进 L30 的心形转场
// 视频 1344×768（7:4；第二十五轮起抽帧用用户超分的 V11_3_1_ghq5.mp4，1920×1080 是从 7:4 拉成 16:9 的，抽帧时缩回 1890×1080 = 7:4，几何不变），白底按四边洪水填充抠掉，按 0.9 倍画面高放、居中偏上（脚离底边约 100 px，不压频谱）
// 抽帧是 build/frames/V11_3/（scripts/video_frames.mjs V11_3 0 5.2 --crop 0,0,1,1 --height 1080），包围盒 build/frames/V11_3_track.json
const V113_ON = () => hasFrames('V11_3'); // 第二十六轮并开关 l29v24；没有 V11_3 的抽帧时退回最下面立绘 + 代码指针那一版
const A24 = [[156.20, 0.08], [156.46, 0.60], [156.90, 1.20], [157.08, 1.95], [157.46, 2.50], [159.04, 4.50], [159.99, 5.12]];
let PCHIP24 = null;
function vt24(t) { // 单调三次插值（Fritsch–Carlson）：过每个锚点、速度连续、不往回走
  const A = A24, n = A.length;
  if (t <= A[0][0]) return A[0][1];
  if (t >= A[n - 1][0]) return A[n - 1][1];
  if (!PCHIP24) {
    const h = [], d = [];
    for (let i = 0; i < n - 1; i++) { h.push(A[i + 1][0] - A[i][0]); d.push((A[i + 1][1] - A[i][1]) / h[i]); }
    const m = [d[0]];
    for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (3 * (h[i - 1] + h[i])) / ((2 * h[i] + h[i - 1]) / d[i - 1] + (h[i] + 2 * h[i - 1]) / d[i]));
    m.push(d[n - 2]);
    PCHIP24 = { h, m };
  }
  let i = 0; while (t > A[i + 1][0]) i++;
  const { h, m } = PCHIP24, s = (t - A[i][0]) / h[i], s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * A[i][1] + (s3 - 2 * s2 + s) * h[i] * m[i] + (-2 * s3 + 3 * s2) * A[i + 1][1] + (s3 - s2) * h[i] * m[i + 1];
}
registerPrefetch(t => (V113_ON() && t > L29_0() - 0.5 && t < L29_1() + 0.6 ? [['V11_3', vt24(t)]] : []));
const VS24 = 0.9, VDH24 = H * VS24, VDW24 = (VDH24 * 1890) / 1080, VOX24 = (W - VDW24) / 2, VOY24 = 30; // 视频在画面里的位置
const vX24 = u => VOX24 + u * VDW24, vY24 = v => VOY24 + v * VDH24;
const V113CUT = new Map();
function v113Cut(vt) {
  const m = framesInfo('V11_3'), i = clamp(Math.round((vt - m.t0) * m.fps), 0, m.n - 1);
  let out = V113CUT.get(i);
  if (out) return out;
  const img = vidFrame('V11_3', vt);
  if (!img) return null;
  const mw = 480, mh = Math.round((mw * img.height) / img.width), small = pooled('v113small', mw, mh), sc = small.getContext('2d');
  sc.setTransform(1, 0, 0, 1, 0, 0); sc.clearRect(0, 0, mw, mh); sc.drawImage(img, 0, 0, mw, mh);
  // 第二十七轮（用户：02:36 画面两侧有黑色线条是 bug 吗？）：是。超分版（V11_3_1_ghq5）每帧左右自带 14 / 16 px 的黑边，
  // 下面的洪水填充从四条边起步，左右两条边整列是黑的、起不了步，黑边就当成"她"留了下来——画面里两条 972 px 高的黑竖线。
  // 抠图前把左右黑边（各多留 2 px）涂成底色，画原图时也跳过这两条。rev l29e27
  const e27 = rev('l29e27') >= 27, EL = 16 / 1890, ER = 18 / 1890;
  if (e27) { sc.fillStyle = '#FEFFFD'; sc.fillRect(0, 0, Math.ceil(EL * mw) + 1, mh); sc.fillRect(mw - Math.ceil(ER * mw) - 1, 0, Math.ceil(ER * mw) + 1, mh); }
  const im = sc.getImageData(0, 0, mw, mh), d = im.data, bg = new Uint8Array(mw * mh), q = new Int32Array(mw * mh);
  let qh = 0, qt = 0;
  const isBg = j => { const r = d[j * 4], g = d[j * 4 + 1], b = d[j * 4 + 2], lo = Math.min(r, g, b); return lo > 232 && Math.max(r, g, b) - lo < 14; };
  const push = j => { if (!bg[j] && isBg(j)) { bg[j] = 1; q[qt++] = j; } };
  for (let x = 0; x < mw; x++) { push(x); push((mh - 1) * mw + x); }
  for (let y = 0; y < mh; y++) { push(y * mw); push(y * mw + mw - 1); }
  while (qh < qt) { const j = q[qh++], x = j % mw; if (x > 0) push(j - 1); if (x < mw - 1) push(j + 1); if (j >= mw) push(j - mw); if (j < (mh - 1) * mw) push(j + mw); }
  for (let j = 0; j < mw * mh; j++) { d[j * 4] = d[j * 4 + 1] = d[j * 4 + 2] = 0; d[j * 4 + 3] = bg[j] ? 0 : 255; }
  sc.putImageData(im, 0, 0);
  out = newCanvas(W, H);
  const c = out.getContext('2d');
  if (e27) c.drawImage(img, EL * img.width, 0, (1 - EL - ER) * img.width, img.height, VOX24 + EL * VDW24, VOY24, (1 - EL - ER) * VDW24, VDH24);
  else c.drawImage(img, VOX24, VOY24, VDW24, VDH24);
  c.globalCompositeOperation = 'destination-in'; c.imageSmoothingEnabled = true; c.drawImage(small, 0, 0, mw, mh, VOX24, VOY24, VDW24, VDH24); c.globalCompositeOperation = 'source-over';
  V113CUT.set(i, out);
  if (V113CUT.size > 4) V113CUT.delete(V113CUT.keys().next().value);
  return out;
}
let TRACK24 = null;
function herBox24(vt) {
  if (!TRACK24) TRACK24 = trackOf('V11_3');
  if (!TRACK24) return null;
  const f = clamp((vt - TRACK24.t0) * TRACK24.fps, 0, TRACK24.n - 1), i = Math.floor(f), k = f - i, A = TRACK24.frames[i].her, B = TRACK24.frames[Math.min(TRACK24.n - 1, i + 1)].her;
  if (!A || !B) return null;
  return [vX24(lerp(A[0], B[0], k)), vY24(lerp(A[1], B[1], k)), vX24(lerp(A[2], B[2], k)), vY24(lerp(A[3], B[3], k))];
}
const CLICK24 = 2.48, PAT24 = [2.85, 3.2, 3.5], AWAY24 = 3.75, CONNECT24 = 4.5, DBL24 = 4.66, TOUCH24 = [0.445, 0.42]; // 视频秒：点她、摸头、箭头飘开、碰到掌心；碰到的位置（视频里的归一化坐标，4.6 s 量的）
function scrub24(ctx, S, vt, a) { // 左上播放器：她.mp4，播放头跟着视频走（不再有跳剪）
  const dur = 5.17;
  ctx.save(); ctx.globalAlpha = a;
  const x = 60, y = 64, w = 470, h = 44;
  ctx.fillStyle = css('#FFFFFF', 0.92); rrect(ctx, x, y, w, h, 22); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = css(BRAND, 0.6); ctx.stroke();
  ctx.fillStyle = BRAND; ctx.beginPath(); ctx.moveTo(x + 20, y + 13); ctx.lineTo(x + 34, y + 22); ctx.lineTo(x + 20, y + 31); ctx.closePath(); ctx.fill();
  ctx.font = fonts(16, 'ZENB', 'SCB'); ctx.textBaseline = 'middle'; ctx.fillText('她.mp4', x + 44, y + 23);
  const bx = x + 118, bw = 230;
  ctx.fillStyle = css(BRAND, 0.18); rrect(ctx, bx, y + 19, bw, 8, 4); ctx.fill();
  for (const [v, c] of [[CLICK24, BRAND], [PAT24[0], S.pal.acc[0]], [CONNECT24, GOLD]]) { ctx.fillStyle = c; ctx.fillRect(bx + (v / dur) * bw - 1, y + 14, 2, 18); } // 事件标记
  ctx.fillStyle = BRAND; rrect(ctx, bx, y + 19, (vt / dur) * bw, 8, 4); ctx.fill();
  ctx.beginPath(); ctx.arc(bx + (vt / dur) * bw, y + 23, 8, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2; ctx.stroke();
  ctx.font = fonts(15, 'SC'); ctx.fillStyle = S.pal.gray; ctx.fillText(`${vt.toFixed(2)} / ${dur.toFixed(2)} s`, bx + bw + 14, y + 23);
  ctx.restore();
}
function l29v24(ctx, S) {
  const p = S.pal, t = S.t, u = (t - L29_0()) / (L29_1() - L29_0()), vt = vt24(t);
  const cam = { x: lerp(-10, 10, u), y: 0, zoom: lerp(1.0, 1.03, smooth(u)), rot: 0 };
  paper(ctx, S, cam);
  backDeco(ctx, S, cam, 290, { alpha: 0.22 });
  withCam(ctx, cam, 0.45, g => { for (let k = 0; k < 30; k++) drawSprite(g, k % 4 ? 'sparkle' : 'star', 2, p, rnd(k, 1) * W, rnd(k, 2) * H, 0.7 + 0.3 * Math.sin(t * 2 + k), 0.45); });
  fallPlates28(ctx, S); // 第二十五轮：L28 的 logit lens 窗口跟着她起跳被震起来、往下掉，切过来以后在她后面接着掉完
  withCam(ctx, cam, 1, g => {
    const v = v113Cut(vt);
    if (v) g.drawImage(v, 0, 0);
    const box = herBox24(vt);
    // 选中框：指针点到她以后弹出来，箭头飘开时收掉
    const sa = smooth(clamp((vt - (CLICK24 - 0.04)) / 0.2)) * (1 - smooth(clamp((vt - AWAY24) / 0.25)));
    if (box && sa > 0) {
      const [x0, y0, x1, y1] = box, bx = x0 - 22, by = y0 - 14, bw = x1 - x0 + 44, bh = y1 - y0 + 28, pop = 1 + 0.05 * Math.exp(-12 * Math.max(0, vt - CLICK24)) * Math.cos(30 * Math.max(0, vt - CLICK24));
      g.save(); g.globalAlpha = sa; g.translate(bx + bw / 2, by + bh / 2); g.scale(pop, pop); g.translate(-bx - bw / 2, -by - bh / 2);
      g.strokeStyle = BRAND; g.lineWidth = 2; g.setLineDash([10, 7]); g.lineDashOffset = -t * 40;
      g.strokeRect(bx, by, bw, bh); g.setLineDash([]); g.fillStyle = '#FFFFFF';
      for (const [hx, hy] of [[0, 0], [0.5, 0], [1, 0], [0, 0.5], [1, 0.5], [0, 1], [0.5, 1], [1, 1]]) { const x = bx + hx * bw, y = by + hy * bh; g.fillRect(x - 6, y - 6, 12, 12); g.strokeRect(x - 6, y - 6, 12, 12); }
      g.font = fonts(18, 'ZENB', 'SCB'); g.fillStyle = BRAND; g.fillText('她.mp4 · 1920×1080 · 在线', bx, by - 14); // 第二十五轮：用户超分过的 V11_3_1_ghq5.mp4
      g.restore();
      const age = t - L29_0() - 0.35 - 0.5, mx = Math.round((box[0] + box[2]) / 2), my = Math.round((box[1] + box[3]) / 2);
      [
        { x: 70, y: 330, w: 320, h: 170, title: 'pointer · events', kind: 'data', anchor: [bx, by + bh * 0.3] },
        { x: 70, y: 580, w: 320, h: 180, title: 'hit-test', kind: 'hex', anchor: [bx, by + bh * 0.62] },
        { x: 1500, y: 360, w: 340, h: 190, title: 'layer · 她', kind: 'bars', rows: ['opacity', 'scale', 'x', 'y'], value: 0.75, text: `${mx}, ${my}`, anchor: [bx + bw, by + bh * 0.4] },
      ].forEach((q, i) => satellite(g, S, { ...q, age: age - i * 0.12, seed: 29 + i, alpha: sa }));
    }
    // 摸头：每一下从头顶冒一颗小心 +「摸头 +1」
    if (box) {
      const hx = (box[0] + box[2]) / 2 - 20, hy = box[1] + 20;
      PAT24.forEach((pv, j) => { const a = (vt - pv) / 0.9; if (a < 0 || a > 1) return; for (let k = 0; k < 3; k++) drawSprite(g, 'heart', 6, p, hx + (rnd(j, k, 1) - 0.5) * 200, hy - 30 - a * 220 - k * 30, 1, 1 - a); });
      const ta = smooth(clamp((vt - PAT24[0]) / 0.15)) * (1 - smooth(clamp((vt - AWAY24) / 0.25)));
      if (ta > 0) { g.save(); g.globalAlpha = ta; g.font = fonts(34, 'SMILEY', 'SCB'); g.fillStyle = p.acc[0]; g.lineJoin = 'round'; g.lineWidth = 8; g.strokeStyle = '#FFFFFF'; const yy = hy - 10 - 30 * clamp((vt - PAT24[0]) / 0.9); g.strokeText('摸头 +1', hx + 150, yy); g.fillText('摸头 +1', hx + 150, yy); g.restore(); }
    }
    // 碰到掌心：金色光环 + 星光 +「已连接」；再点两下：一捧爱心
    const tx = vX24(TOUCH24[0]), ty = vY24(TOUCH24[1]), ca = vt - CONNECT24;
    if (ca >= 0) {
      const r = 30 + 170 * easeOut(clamp(ca / 0.4));
      g.strokeStyle = css(GOLD, 1 - clamp(ca / 0.55)); g.lineWidth = 5; g.beginPath(); g.arc(tx, ty, r, 0, Math.PI * 2); g.stroke();
      for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + ca * 2; drawSprite(g, 'sparkle', 3, p, tx + Math.cos(a) * (60 + 90 * ca), ty + Math.sin(a) * (60 + 90 * ca), 1, 1 - clamp((ca - 0.4) / 0.3)); }
      const la = smooth(clamp(ca / 0.12));
      g.save(); g.globalAlpha = la; g.font = fonts(32, 'ZENB', 'SCB'); g.lineJoin = 'round'; g.lineWidth = 8; g.strokeStyle = '#FFFFFF'; g.strokeText('已连接', tx - 230, ty + 20); g.fillStyle = BRAND; g.fillText('已连接', tx - 230, ty + 20); g.restore();
    }
    const da = vt - DBL24;
    if (da >= 0) for (let k = 0; k < 14; k++) {
      const a = -Math.PI / 2 + (rnd(k, 3) - 0.5) * 2.4, dd = 40 + 380 * easeOut(clamp(da / 0.45)) * (0.6 + 0.4 * rnd(k, 4));
      drawSprite(g, k % 3 ? 'heart' : 'sparkle', 7, p, tx + Math.cos(a) * dd, ty + Math.sin(a) * dd + 220 * da * da, 1, 1 - clamp((da - 0.4) / 0.3));
    }
  });
  withCam(ctx, cam, 0.3, g => card(g, S, 1420, 90, 420, 170, { title: 'heart.js', age: t - L29_0() - 0.3 }, cc => {
    g.font = fonts(24, 'SC'); g.fillStyle = BRAND; g.fillText('while (you) {', cc.x, cc.y + 28); g.fillText('}', cc.x, cc.y + 92);
    g.fillStyle = p.text; g.fillText(vt < CONNECT24 ? '  wait();' : '  sing();', cc.x, cc.y + 60);
  }));
  frontDeco(ctx, S, cam, 291, { alpha: 0.25, items: [['ring', 1840, 980, 200]] });
  scrub24(ctx, S, vt, smooth(clamp((t - L29_0() - 0.15) / 0.3)));
  hud(ctx, S);
}
// L28 → L29（第二十四轮）：视频里她是从画面上沿外落进来的，所以 L28 结尾她不再走进视频，而是往上飞出画面——先往下一蹲（预备），
// 再越来越快地往上冲、拉长一点，后面拖几道速度线；切点前 0.08 s 已经出了画面，视频里的她随后从上面落下来
function herUp24(ctx, S, u, a28) {
  const t = S.t, A = a28(Math.min(t, L29_0())), e = clamp(u / 0.3);
  if (e >= 1) return;
  const dip = e < 0.3 ? 26 * Math.sin(Math.PI * (e / 0.3)) : 0, rise = 1500 * easeIn(clamp((e - 0.22) / 0.78)) ** 1.2, st = 1 + 0.14 * clamp((e - 0.3) / 0.4);
  const x = A.x, y = A.y + dip - rise;
  ctx.save();
  if (e > 0.25) for (let k = 0; k < 9; k++) { const sx = x + A.w * (0.2 + 0.6 * rnd(k, 2401)), L = 120 + 260 * clamp((e - 0.25) / 0.4); ctx.fillStyle = css(k % 3 ? '#FFFFFF' : BRAND, 0.6 * (1 - e)); ctx.fillRect(sx, y + A.h * 0.6, 3, L); }
  ctx.translate(x + A.w / 2, y + A.h); ctx.scale(1 / Math.sqrt(st), st); ctx.translate(-x - A.w / 2, -y - A.h);
  ctx.drawImage(photo('I08', null, 730 * aspectOf('I08'), 730, { keyed: true }), x, y, A.w, A.h);
  ctx.restore();
}
export function l29(ctx, S) {
  if (V113_ON()) return l29v24(ctx, S);
  const p = S.pal, t = S.t, u = (t - L29_0()) / (L29_1() - L29_0()), b = (t - B99) / BEAT;
  const cam = { x: lerp(-20, 30, u), y: 0, zoom: lerp(1.0, 1.06, smooth(u)) * punch(S, 0.01), rot: 0 };
  paper(ctx, S, cam);
  backDeco(ctx, S, cam, 290, { alpha: 0.28 });
  const HER = her29(), HAND = hand29(), HEAD = head29();
  const img = photo('I05', null, herW(HER), HER.h, { keyed: true }), w = img.width;
  const hand = [HER.x + HAND[0] * w, HER.y + HAND[1] * HER.h], head = [HER.x + HEAD[0] * w, HER.y + HEAD[1] * HER.h];
  const [cx, cy] = cursorAt(t, [hand[0] - 26, hand[1] - 18]);
  withCam(ctx, cam, 0.45, g => { // 远处淡淡的星光
    for (let k = 0; k < 30; k++) drawSprite(g, k % 4 ? 'sparkle' : 'star', 2, p, rnd(k, 1) * W, rnd(k, 2) * H, 0.7 + 0.3 * Math.sin(t * 2 + k), 0.45);
  });
  withCam(ctx, cam, 1, g => {
    // 她：被逗的时候跟着指针歪身子；摸头时缩一下
    const tease = b >= 3.4 && b < 5.6 ? clamp((cx - (HER.x + w / 2)) / 600, -1, 1) * 0.05 : 0;
    const pat = b >= 2 && b < 3.4 ? 0.012 * Math.abs(Math.sin((b - 2) * Math.PI * 2)) : 0;
    g.save(); g.translate(HER.x + w / 2, HER.y + HER.h); g.rotate(tease); g.scale(1 + pat, 1 - pat); g.translate(-(HER.x + w / 2), -(HER.y + HER.h));
    g.drawImage(img, HER.x, HER.y);
    g.restore();
    // 选中框：像在编辑器里选中一个图层
    const sa = clamp((b - 0.8) / 0.2) * (1 - clamp((b - 5.2) / 0.4));
    if (sa > 0) {
      g.save(); g.globalAlpha = sa; g.strokeStyle = BRAND; g.lineWidth = 2; g.setLineDash([10, 7]); g.lineDashOffset = -t * 40;
      g.strokeRect(HER.x - 20, HER.y - 10, w + 40, HER.h + 20); g.setLineDash([]);
      g.fillStyle = '#FFFFFF';
      for (const [hx, hy] of [[0, 0], [0.5, 0], [1, 0], [0, 0.5], [1, 0.5], [0, 1], [0.5, 1], [1, 1]]) { const x = HER.x - 20 + hx * (w + 40), y = HER.y - 10 + hy * (HER.h + 20); g.fillRect(x - 6, y - 6, 12, 12); g.strokeRect(x - 6, y - 6, 12, 12); }
      g.font = fonts(18, 'ZENB', 'SCB'); g.fillStyle = BRAND; g.fillText(`她.png · ${i18() ? sizeOf('I05').join('×') : '1080×1920'} · 在线`, HER.x - 20, HER.y - 22);
      g.restore();
    }
    // 摸头：小爱心冒出来 +「摸头 +1」
    if (b >= 2 && b < 4.2) for (let k = 0; k < 6; k++) {
      const a = b - 2 - k * 0.22; if (a < 0 || a > 1.2) continue;
      drawSprite(g, 'heart', 6, p, head[0] + (rnd(k, 1) - 0.5) * 160, head[1] - 40 - a * 140, 1, 1 - a / 1.2);
    }
    if (b >= 2.2 && b < 3.8) { g.font = fonts(30, 'SMILEY', 'SCB'); g.fillStyle = p.acc[0]; g.fillText('摸头 +1', head[0] + 90, head[1] - 60 - 20 * (b - 2.2)); }
    // 指尖碰到指尖：光环 + 星光 +「已连接」
    const ta = b - 6;
    if (ta >= 0) {
      const r = 30 + 160 * easeOut(clamp(ta / 0.6));
      g.strokeStyle = css(GOLD, 1 - clamp(ta / 0.8)); g.lineWidth = 4; g.beginPath(); g.arc(hand[0], hand[1], r, 0, Math.PI * 2); g.stroke();
      for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + ta; drawSprite(g, 'sparkle', 3, p, hand[0] + Math.cos(a) * (60 + 40 * ta), hand[1] + Math.sin(a) * (60 + 40 * ta), 1, 1 - clamp((ta - 1) / 1)); }
      g.font = fonts(28, 'ZENB', 'SCB'); g.fillStyle = BRAND; g.fillText('已连接', hand[0] - 150, hand[1] + 110);
    }
    // 双击：一捧爱心
    const da = b - 6.6;
    if (da >= 0) for (let k = 0; k < 14; k++) {
      const a = -Math.PI / 2 + (rnd(k, 3) - 0.5) * 2.4, d = 40 + 360 * easeOut(clamp(da / 0.9)) * (0.6 + 0.4 * rnd(k, 4));
      drawSprite(g, k % 3 ? 'heart' : 'sparkle', 7, p, hand[0] + Math.cos(a) * d, hand[1] + Math.sin(a) * d + 120 * da * da, 1, 1 - clamp((da - 0.9) / 0.5));
    }
    // 你的指针（摸头时是小手），最后她的蓝色光标出现在旁边
    const click = Math.max(b >= 6.6 ? decay((b - 6.6) * BEAT, 20) : 0, b >= 6.85 ? decay((b - 6.85) * BEAT, 20) : 0);
    if (b >= 2 && b < 3.4) handCursor(g, cx, cy + 16 * Math.abs(Math.sin((b - 2) * Math.PI * 2)), 4);
    else arrow(g, cx, cy, 3.4 * (1 - 0.15 * click));
    if (b >= 6.9) { const blink = Math.floor((t - B99) / (BEAT / 2)) % 2 === 0; g.fillStyle = css(BRAND, blink ? 1 : 0.35); g.fillRect(cx - 34, cy - 8, 9, 64); }
    for (let k = 0; k < 2; k++) { const ra = b - (6.6 + k * 0.25); if (ra >= 0 && ra < 0.6) { g.strokeStyle = css(BRAND, 1 - ra / 0.6); g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, 10 + 70 * ra, 0, Math.PI * 2); g.stroke(); } }
  });
  withCam(ctx, cam, 0.3, g => card(g, S, 1340, 700, 500, 200, { title: 'heart.js', age: t - L29_0() - 0.3 }, cc => {
    g.font = fonts(26, 'SC'); g.fillStyle = BRAND; g.fillText('while (you) {', cc.x, cc.y + 30); g.fillText('}', cc.x, cc.y + 100);
    g.fillStyle = p.text; g.fillText(b < 6 ? '  wait();' : '  sing();', cc.x, cc.y + 65);
  }));
  frontDeco(ctx, S, cam, 291, { alpha: 0.3, items: [['ring', 1840, 160, 200]] });
  hud(ctx, S);
}

// ================================================================ L30 · C2 少女版 · 电子的心在颤动（101–102）
// 一颗大像素心（金粉绕着它转、往下落），心 / 菱形 / 星光三段的精灵一起绕；「電♪」金色沿弧排开；
// 底下三张回顾卡：L10 萝莉音的胖心、L22 御姐音的示波器心、L30 少女音的金心
const L30_0 = () => cutAt(101), L30_1 = () => cutAt(103);
// 第二十五轮（用户：02:38 这个镜头最后的动画是鼠标与鲸鱼娘手的互动，让下一个镜头的爱心转场位置从手部开始而不是画面中心，
// 下一个镜头的像素大爱心的中心也在最开始对齐这个位置，然后再摄像机位移让像素大爱心回到画面中心；第二十七轮并开关 t30h25）
// L29 最后指针碰到她掌心的那一点（TOUCH24，按 L29 结尾的相机换成屏幕坐标）就是心形遮罩的圆心；L30 开头相机偏过去，让像素心正好在那一点，
// 切点后 0.15 s 起用 0.7 s（缓入缓出）把相机推回原位，心回到画面中间——心形遮罩的圆心一路跟着像素心走（timeline 的 iris 用 heart30At）
const t30h = () => V113_ON(); // 没有 V11_3 的抽帧时（后备的立绘版）心在正中
function touch29() { const cam = { x: 10, y: 0, zoom: 1.03, rot: 0 }; return camToScreen(cam, 1, vX24(TOUCH24[0] - 0.024), vY24(TOUCH24[1] + 0.005)); } // 掌心和指针尖（「已连接」圈心往左约 40 px），L29 结尾（u = 1）的相机
function off30(t) { // 相机偏移 [x, y] 和推回去的进度 e
  if (!t30h()) return [0, 0, 1];
  const [hx, hy] = touch29(), z = 1.02, v = clamp((t - L30_0() - 0.15) / 0.7), e = v < 0.5 ? 4 * v ** 3 : 1 - (-2 * v + 2) ** 3 / 2, k = 1 - e;
  return [((960 - hx) / z) * k, (-120 - (hy - 540) / z) * k, e];
}
function cam30(S) { const t = S.t, [x, y, e] = off30(t); return { x, y, zoom: 1.02 * punch(S, 0.035), rot: 0.01 * Math.sin(t * 1.2) * e }; }
export function heart30At(t) { const [x0, y0] = off30(t); const [x, y] = camToScreen({ x: x0, y: y0, zoom: 1.02, rot: 0 }, 1, 960, 420); return { x, y }; } // 像素心（世界 (960, 420)）在屏幕上的位置
export function l30(ctx, S) {
  const p = S.pal, t = S.t, kick = decay(S.sub * BEAT, 7), cam = cam30(S);
  paper(ctx, S, cam);
  backDeco(ctx, S, cam, 300, { alpha: 0.35 });
  withCam(ctx, cam, 1, g => {
    const cx = 960, cy = 420;
    // 金粉
    for (let i = 0; i < 160; i++) {
      const a = t * (0.4 + rnd(i, 1)) + rnd(i, 2) * 6.28, r = 260 + rnd(i, 3) * 260 + 30 * Math.sin(t * 2 + i), fall = ((t * 0.3 + rnd(i, 4)) % 1);
      g.fillStyle = css(i % 4 ? GOLD : '#FFE9A8', 0.8 * (1 - fall * 0.5)); const s = 2 + (i % 3) * 2;
      g.fillRect(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.7 + fall * 160, s, s);
    }
    // 绕着的三段精灵
    ['heart', 'diamond', 'sparkle'].forEach((k, j) => { for (let i = 0; i < 6; i++) { const a = t * (0.7 - j * 0.15) + (i / 6) * Math.PI * 2 + j; drawSprite(g, k, 4, p, cx + Math.cos(a) * (380 + j * 70), cy + Math.sin(a) * (200 + j * 40), 1); } });
    // 第二十二轮（用户：少女音段缺少密集型结构化的图形元素动画）。第二十四轮并开关 dense22
    // 心外一圈 150 格刻度（150 BPM，一拍走一格，扫描头后面拖亮尾），三块面板从心的两侧连出去：R-R 间期（60 / 150 = 0.4 s）、声线频谱、心跳计数
    {
      const age = t - L30_0() - 0.1, gc = mix(GOLD, '#E8835A', 0.35);
      tickRing(g, S, cx, cy, 262, { n: 150, age, t0: L30_0(), color: css(p.line, 0.9), accent: gc, speed: 0.04, labels: [[0, '0'], [0.2, '30'], [0.4, '60'], [0.6, '90'], [0.8, '120']] });
      const beatsN = Math.max(0, Math.floor((t - L30_0()) / BEAT));
      [
        { x: 80, y: 120, w: 340, h: 170, title: 'R-R 间期', kind: 'ecg', text: '0.400 s', anchor: [cx - 262, cy - 40] },
        { x: 80, y: 430, w: 340, h: 200, title: 'voice · 少女音', kind: 'spec', anchor: [cx - 250, cy + 90] },
        { x: 1500, y: 360, w: 340, h: 200, title: 'beat · count', kind: 'bars', rows: ['P', 'QRS', 'T', 'R-R'], value: 0.7, text: `#${String(beatsN).padStart(3, '0')}`, anchor: [cx + 262, cy + 20] },
      ].forEach((q, i) => satellite(g, S, { ...q, age: age - 0.2 - i * 0.12, seed: 30 + i, accent: gc }));
    }
    // 像素心
    g.save(); g.translate(cx, cy); const s = 1 + 0.07 * kick + 0.04 * S.f.low; g.scale(s, s);
    drawSprite(g, 'heart', 52, p, 0, 0); g.restore();
    g.font = fonts(54, 'ZENB', 'SCB'); g.fillStyle = '#FFFFFF'; g.textAlign = 'center'; g.fillText('150', cx, cy + 10); g.textAlign = 'left';
    // 「電♪」金色沿上弧
    const kw30 = keyword('L30', 0, 6), spin30 = 0.08 * Math.max(0, t - kw30[0].t0); // 第二十二轮：字进场以后整段弧慢慢顺时针转（第二十四轮并开关 l30r22）
    // 第二十三轮（用户：「電♪」圆形文字路径弧度太大了，没和下方圆形 HUD 的弧度对齐）：以前排在 470 × 330 的椭圆上，
    // 和心外那圈 150 格刻度环（半径 262）不是一个圆心、一个弧度；改成同一个圆心、半径 350 的正圆，字间距按字宽算，整段以正上方为中心（第二十五轮并开关 l30a23）
    const R23 = 350, step23 = 100 / R23;
    kw30.forEach((k, i) => {
      const a = t - k.t0; if (a < 0) return;
      const ang = -Math.PI / 2 + (i - (kw30.length - 1) / 2) * step23 + spin30;
      const x = cx + Math.cos(ang) * R23, y = cy + Math.sin(ang) * R23;
      // 第二十二轮：点阵字（不再有深色厚度），点从像素心里飞出来（第二十四轮并开关 type22，第二十一轮的立体字删了）
      dotType(g, S, { text: k.c, x, y, px: 96, grid: 20, keys: JP_KEYS, color: mix(GOLD, '#E8835A', 0.3), accent: p.acc[0], frame: false, charT: () => ({ age: a + 0.03, r: ang + Math.PI / 2 }), from: () => [cx, cy] });
    });
  });
  heartStrip21(ctx, S, cam); // 第二十轮那一版（底下三张回顾卡）第二十三轮并开关时删了
  hud(ctx, S);
}

// 第二十一轮（用户：下方的三个爱心窗口排版过于简单，得换个内容；第二十三轮并开关）
// 换成一块全曲的心电监护：上面一行是实时心电图（扫描式，每拍一个 QRS 波，写入头往右走，前面留一段空白），
// 下面一行是整首歌的时间轴：三种声线三段颜色（萝莉音 / 御姐音 / 少女音），三处"心"出现过的地方标着小心形和名字（0:42 胖心、1:34 细线心、2:39 金心），
// 播放头停在现在——心从第一段一直跳到这里，换了三次样子
const SECT21 = [['萝莉音', 10, 34, '#FF6FA8'], ['御姐音', 42, 66, '#3FC6E8'], ['少女音', 91, 107, GOLD]];
const HEARTS21 = [['胖心', 28, '#FF6FA8'], ['细线心', 60, '#3FC6E8'], ['金心', 101, GOLD]];
function ecgV(tau) { // 一拍一个心跳：P 波、QRS、T 波（拍网格和音乐对齐）
  const ph = ((((tau - barStart(1)) / BEAT) % 1) + 1) % 1, bump = (c, w, a) => a * Math.exp(-(((ph - c) / w) ** 2));
  return bump(0.08, 0.035, 0.12) - bump(0.17, 0.012, 0.12) + bump(0.2, 0.014, 1) - bump(0.235, 0.014, 0.28) + bump(0.42, 0.06, 0.2);
}
function heartStrip21(ctx, S, cam) {
  const p = S.pal, t = S.t, x = 160, y = 800, w = 1600, h = 210, age = t - L30_0() - 0.3;
  withCam(ctx, cam, 0.35, g => card(g, S, x, y, w, h, { title: 'heart.monitor · 全曲 191 s', age, lw: 2, inner: false }, cc => {
    const ea = smooth(clamp(age / 0.4));
    // 实时心电图：扫描式（3.2 s 一屏），写入头前面空 6%
    const span = 3.2, ex = cc.x, ew = cc.w, ey = cc.y + 52, amp = 44, head = ((t % span) / span) * ew;
    g.save(); g.beginPath(); g.rect(ex, ey - 60, ew * ea, 110); g.clip();
    g.strokeStyle = css(p.line, 0.35); g.lineWidth = 1; for (let gx = 0; gx <= ew; gx += 40) { g.beginPath(); g.moveTo(ex + gx, ey - 55); g.lineTo(ex + gx, ey + 45); g.stroke(); }
    g.strokeStyle = mix(GOLD, '#E8835A', 0.35); g.lineWidth = 3; g.lineJoin = 'round'; g.beginPath();
    let pen = false;
    for (let px = 0; px <= ew; px += 2) {
      const gap = ((px - head) / ew + 1) % 1; if (gap < 0.06) { pen = false; continue; } // 写入头前面的空白
      const tau = t - (((head - px) / ew + 1) % 1) * span, yy = ey - ecgV(tau) * amp;
      if (pen) g.lineTo(ex + px, yy); else { g.moveTo(ex + px, yy); pen = true; }
    }
    g.stroke();
    g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(ex + head, ey - ecgV(t) * amp, 6, 0, Math.PI * 2); g.fill(); g.strokeStyle = GOLD; g.lineWidth = 3; g.stroke();
    g.restore();
    g.font = fonts(18, 'ZENB', 'SCB'); g.fillStyle = mix(GOLD, '#E8835A', 0.4); g.textAlign = 'right'; g.fillText('♥ 150 BPM', cc.x + cc.w, cc.y + 6); g.textAlign = 'left';
    // 全曲时间轴：三段声线、三处心、播放头
    const ty = cc.y + cc.h - 40, T0 = barStart(1), T1 = barStart(121), X = tau => cc.x + ((tau - T0) / (T1 - T0)) * cc.w;
    g.fillStyle = css(p.line, 0.3); rrect(g, cc.x, ty, cc.w * ea, 10, 5); g.fill();
    SECT21.forEach(([name, b0, b1, col], i) => {
      const a = smooth(clamp((age - 0.15 - i * 0.12) / 0.3)); if (a <= 0) return;
      const x0 = X(barStart(b0)), x1 = X(barStart(b1));
      g.globalAlpha = a; g.fillStyle = col; rrect(g, x0, ty, (x1 - x0) * a, 10, 5); g.fill();
      g.font = fonts(16, 'ZENB', 'SCB'); g.fillStyle = col; g.fillText(name, x0, ty + 32); g.globalAlpha = 1;
    });
    HEARTS21.forEach(([name, b, col], i) => {
      const a = easeOutBack(clamp((age - 0.4 - i * 0.15) / 0.3), 1.8); if (a <= 0.01) return;
      const hx = X(barStart(b)), hy = ty - 16, beat = i === 2 ? 1 + 0.15 * decay(S.sub * BEAT, 7) : 1;
      g.save(); g.translate(hx, hy); g.scale(a * beat, a * beat); drawSprite(g, 'heart', 4, p, 0, 0); g.restore();
      g.font = fonts(14, 'ZENB', 'SCB'); g.fillStyle = col; g.textAlign = 'center'; g.globalAlpha = clamp(a); g.fillText(name, hx, hy - 22); g.globalAlpha = 1; g.textAlign = 'left';
    });
    const nx = X(t); g.fillStyle = BRAND; g.fillRect(nx - 1.5, ty - 10, 3, 30); g.font = fonts(14, 'SC'); g.fillStyle = BRAND; g.fillText('now', nx + 6, ty - 2);
  }));
  withCam(ctx, cam, 0.35, g => card(g, S, 1500, 80, 380, 170, { title: 'f', lw: 2, inner: false }, cc => { drawFormula(g, 'bpm_b', cc.x + cc.w / 2, cc.y + 40, { size: 40, align: 'c', valign: 'mid', color: BRAND }); ecgStrip(g, S, cc.x, cc.y + 80, cc.w, 40, { grid: false }); }));
}

// ================================================================ L31 · C3 少女版 · 量子的风（103–104）
// 「量♪風」几个字被风吹散成粒子，粒子在风里重组成她的样子（字符 → 立绘的转换在这里完成）；最后一拍清晰的她浮现
const L31_0 = () => cutAt(103), L31_1 = () => cutAt(105);
// 第二十轮：切点按实测挪了以后，104 小节第 4 拍（166.07）已经在 L32 的切点之后；改成唱到「♪」的「♪」时浮现
// 第二十一轮 L31（全部素材的快切叠加态，l31v21）第二十四轮并开关时删了；下面几个函数第二十二轮版还在用
const snap16 = x => barStart(1) + Math.round((x - barStart(1)) / (BEAT / 4)) * (BEAT / 4);
function stateIdx31(t) { // 第几张：一拍一张 → 八分 → 十六分
  const t0 = L31_0() - 0.1, tA = snap16(onset('L31', 3) - 0.05), tB = snap16(onset('L31', 7) - 0.05);
  return Math.floor((Math.min(t, tA) - t0) / BEAT) + Math.floor(clamp(t - tA, 0, tB - tA) / (BEAT / 2)) + Math.floor(Math.max(0, t - tB) / (BEAT / 4));
}
export function l32Her(t) { // L32 开头她的位置（局部原点 (960, 600)，缩放 0.75）
  const z = 0.75, h = 900, w = h * aspectOf('I08');
  return { x: 960 - z * ANCHOR.I08.back[0] * w, y: 600 + z * (-180 - ANCHOR.I08.back[1] * h), w: z * w, h: z * h, rx: 960, ry: 600 - 180 * z, z };
}
function kStart31(k) { // 第 k 张开始的时刻（stateIdx31 反过来）
  const t0 = L31_0() - 0.1, tA = snap16(onset('L31', 3) - 0.05), tB = snap16(onset('L31', 7) - 0.05), nA = Math.floor((tA - t0) / BEAT), nB = nA + Math.floor((tB - tA) / (BEAT / 2));
  return k < nA ? t0 + k * BEAT : k < nB ? tA + (k - nA) * (BEAT / 2) : tB + (k - nB) * (BEAT / 4);
}
// ---------------------------------------------------------------- 第二十二轮 L31（第二十四轮并开关 l31r22）
// 用户：「大量图片效果在这里效果不好，因为比例不同、有透明的、有 Q 版的；新增一个素材，写好 prompt，我去生成一批同 prompt 不同种子的素材，
// 你把场景也改成适合这个效果的」。新素材 Q01–Q24（文档/素材Prompt清单.md §五c）：同一句 prompt、24 个种子，1024 方图、同一片浅天蓝底——
// 构图一样、只有细节不同，快切起来就是"同一个她的很多个可能"在闪（叠加态）。到货以前先用同样是方图带底色的 B01–B16 顶着。
// · 右边一张大的"态"卡片：种子图在里面越切越快（一拍 → 八分 → 十六分），前一张 / 后一张淡淡叠着；卡片上方是 seed 读数
// · 左下一张种子接触印相（6×4 小图，就是这一批），当前那张亮框、一根线连到大卡片；下面一排概率柱 |c_k|²
// · 左上「♪」「量♪風」「♪」点阵字
// · 唱到「♪」测量：接触印相里的小图全部飞进大卡片、叠成一张，再变成 L32 那个带字翅膀的她（接 L32，和第二十一轮一样）
// 第二十三轮（用户：2:44 大量图放在 QN 文件夹中）：用户出了 32 张同一句 prompt 的种子，去掉一张灰底的，缩小登记成 Q01–Q31（scripts/qn_resize.mjs）。
// 31 张接触印相排成 8 × 4、小图 70 px（6 × 6 会伸出画面）（第二十五轮并开关 l31q23；Q 图没同步完的机器上仍退回 B01–B16）
const Q23 = () => hasIllust('Q01');
const SEEDS22 = () => (Q23() ? Array.from({ length: 40 }, (_, i) => `Q${String(i + 1).padStart(2, '0')}`).filter(hasIllust) : Array.from({ length: 16 }, (_, i) => `B${String(i + 1).padStart(2, '0')}`));
// 第二十五轮（用户：02:44 右边图片一开始不用减速切换，最后几张的切换我改成用图生图依次降低重绘幅度，让画面逐渐稳定，从 Q01.png 开始到 Q7.png；第二十七轮并开关 l31c25）
// · 开头起就是十六分音符的快切，种子按顺序过
// · 唱到「♪」起换成用户出的图生图链 QC1 → QC7（QC1 = 那批种子里的 Q20，用户改名成 Q1.png；之后每张从上一张图生图、重绘幅度一次比一次低）：
//   每张停 1、1、1、2、2、3 个十六分音符，越切越慢，QC7 在「♪」前落定、稳住，唱到「♪」照旧塌缩接 L32。
//   这段时间左下接触印相停在 Q20 那格（链的起点），概率柱一步步收拢到它；大卡片上方、底下参数行和采样器面板写图生图的 denoise（演出值，一张比一张低）
const c31 = () => hasIllust('QC7'); // 链的图没同步完的机器上退回按拍加速的种子快切
const CHAIN31 = ['QC1', 'QC2', 'QC3', 'QC4', 'QC5', 'QC6', 'QC7'], STEPS31 = [1, 1, 1, 2, 2, 3], DEN31 = [1.0, 0.7, 0.55, 0.42, 0.3, 0.2, 0.12], SRC31 = 19;
function chain31() { const st = [snap16(onset('L31', 5) - 0.05)]; STEPS31.forEach(m => st.push(st[st.length - 1] + (m * BEAT) / 4)); return st; }
function pick31(t, ids) { // 这一刻大卡片里是哪张：{ id, k（接触印相里亮的那格）, tk（换上来多久了）, j（链上第几张，−1 = 快切种子） }
  const st = chain31(), q = BEAT / 4, t0 = L31_0() - 0.1;
  if (t < st[0]) { const i = Math.floor((t - t0) / q), k = ((i % ids.length) + ids.length) % ids.length; return { id: ids[k], k, tk: t - (t0 + i * q), j: -1 }; }
  let j = st.length - 1; while (j > 0 && t < st[j]) j--;
  return { id: CHAIN31[j], k: SRC31, tk: t - st[j], j };
}
const CARD22 = { cx: 1230, cy: 510, s: 640 }, GRID22_ = { x: 90, y: 600, c: 6, ts: 92, g: 10 }, GRID23 = { x: 90, y: 600, c: 8, ts: 70, g: 8 };
function l31v22(ctx, S) {
  const p = S.pal, t = S.t, TC = onset('L31', 10), col = t - TC, ce = smooth(clamp(col / 0.38)), cam = { x: 0, y: 0, zoom: punch(S, 0.015), rot: 0 };
  const ids = SEEDS22(), n = ids.length, c25 = c31() ? pick31(Math.min(t, TC), ids) : null, k = c25 ? c25.k : stateIdx31(Math.min(t, TC)) % n, GRID22 = Q23() ? GRID23 : GRID22_, gr = Math.ceil(n / GRID22.c);
  const cj = c25 ? c25.j : -1, damp = cj >= 0 ? 1 - 0.85 * (cj / 6) : 1; // 第二十五轮：图生图链上第几张（−1 = 还在快切种子）；概率柱跟着一步步收拢到起点那张
  paper(ctx, S, cam);
  withCam(ctx, cam, 1, g => {
    for (let i = 0; i < 40; i++) { const y = rnd(i, 1) * H, len = 160 + rnd(i, 2) * 420, x = ((rnd(i, 4) * (W + len) + t * (900 + rnd(i, 3) * 800)) % (W + len)) - len; g.fillStyle = css(i % 3 ? '#FFFFFF' : GOLD, 0.5); g.fillRect(x, y, len, 2); } // 风
    const { cx, cy, s } = CARD22, fa = smooth(clamp((t - L31_0() + 0.05) / 0.2)) * (1 - ce);
    const thumbXY = j => [GRID22.x + (j % GRID22.c) * (GRID22.ts + GRID22.g), GRID22.y + Math.floor(j / GRID22.c) * (GRID22.ts + GRID22.g)];
    // 接触印相：这一批种子，当前那张亮框；测量时全部飞进大卡片
    const ga = smooth(clamp((t - L31_0() - 0.15) / 0.3));
    if (ga > 0) {
      g.save(); g.globalAlpha = ga * (1 - ce); g.font = fonts(16, 'ZENB', 'SCB'); g.fillStyle = BRAND; g.fillText(`batch · ${n} seeds · same prompt`, GRID22.x, GRID22.y - 14); g.restore();
      for (let j = 0; j < n; j++) {
        const [x0, y0] = thumbXY(j), fly = easeIn(clamp((col - 0.02 - (j / n) * 0.12) / 0.3)), ts = GRID22.ts;
        const x = lerp(x0, cx - s / 2 + (s - ts) / 2, fly), y = lerp(y0, cy - s / 2 + (s - ts) / 2, fly), sz = lerp(ts, s * 0.5, fly * fly), a = ga * clamp(1 - fly * 1.1 + (fly > 0 ? 0.1 : 0));
        if (a <= 0.01) continue;
        g.save(); g.globalAlpha = a * (j === k && fly <= 0 ? 1 : 0.62); rrect(g, x, y, sz, sz, 8); g.clip(); g.drawImage(photo(ids[j], null, ts * 2, ts * 2), x, y, sz, sz); g.restore();
        if (j === k && fly <= 0) { g.save(); g.globalAlpha = ga; g.strokeStyle = p.acc[0]; g.lineWidth = 3; rrect(g, x - 3, y - 3, sz + 6, sz + 6, 10); g.stroke(); g.restore(); }
      }
      // 当前那张连到大卡片
      if (col < 0 && fa > 0) { const [x0, y0] = thumbXY(k); g.save(); g.globalAlpha = 0.7 * fa; g.strokeStyle = p.acc[0]; g.lineWidth = 2; g.setLineDash([6, 6]); g.beginPath(); g.moveTo(x0 + GRID22.ts, y0 + GRID22.ts / 2); g.lineTo(cx - s / 2 - 18, cy + s / 2 - 40); g.stroke(); g.setLineDash([]); g.restore(); }
      // 概率柱 |c_k|²：一直在变，当前那个高
      const by = GRID22.y + gr * (GRID22.ts + GRID22.g) + 16, bw = (GRID22.c * (GRID22.ts + GRID22.g) - GRID22.g) / n;
      g.save(); g.globalAlpha = ga * (1 - ce);
      for (let j = 0; j < n; j++) { const h = 6 + 46 * (j === k ? 1 : (0.25 + 0.25 * (0.5 + 0.5 * Math.sin(t * 5 + j * 1.3))) * damp); g.fillStyle = j === k ? p.acc[0] : css(BRAND, 0.45); g.fillRect(GRID22.x + j * bw + 1, by + 52 - h, bw - 2, h); }
      g.font = fonts(15, 'ZENB', 'SCB'); g.fillStyle = p.gray; if (Q23()) g.fillText('|c_k|²', GRID22.x + GRID22.c * (GRID22.ts + GRID22.g) + 6, by + 48); else g.fillText('|c_k|²', GRID22.x, by + 74); g.restore(); // 第二十三轮：8 × 4 时放到柱子右边（下面是 HUD 的歌词标签）
    }
    // 大卡片：种子图越切越快，前一张 / 后一张淡淡叠着
    if (fa > 0) {
      g.save(); g.globalAlpha = fa; g.fillStyle = css('#FFFFFF', 0.85); rrect(g, cx - s / 2 - 18, cy - s / 2 - 18, s + 36, s + 36, 30); g.fill();
      g.lineWidth = 3; g.strokeStyle = css(BRAND, 0.5); g.setLineDash([14, 8]); g.lineDashOffset = -t * 60; g.stroke(); g.setLineDash([]); g.restore();
      g.save(); rrect(g, cx - s / 2, cy - s / 2, s, s, 22); g.clip();
      const tk = c25 ? c25.tk : t - kStart31(stateIdx31(Math.min(t, TC))), pop = 1 + (cj > 0 ? 0.025 * (1 - cj / 7) : 0.04) * decay(tk, 14);
      g.globalAlpha = fa; g.translate(cx, cy); g.scale(pop, pop); g.drawImage(photo(c25 ? c25.id : ids[k], null, s, s), -s / 2, -s / 2); // 第二十四轮：只画当前这张、不透明（第二十六轮并开关 l31d24）
      g.restore();
      g.save(); g.globalAlpha = fa; g.font = fonts(20, 'ZENB', 'SCB'); g.fillStyle = BRAND; g.textAlign = 'center';
      g.fillText(cj < 0 ? `seed ${114514 + k * 17} · |ψ⟩ = Σ c_k |她_k⟩` : cj === 0 ? `seed ${114514 + k * 17} · img2img ← 这一张` : `img2img · denoise ${DEN31[cj].toFixed(2)} · ${cj}/6`, cx, cy - s / 2 - 34); g.restore();
      cardDetail24(g, S, k, n, fa, tk, col, cj);
    }
    // 测量：停在带翅膀的她（接 L32）
    if (col >= 0) {
      const B = l32Her(t), ih = s * 0.96, iw = ih * aspectOf('I08'), A = { x: cx - iw / 2, y: cy - ih / 2, w: iw, h: ih };
      const e = easeOutBack(clamp((col - 0.15) / 0.35), 1.1), x = lerp(A.x, B.x, e), y = lerp(A.y, B.y, e), w = lerp(A.w, B.w, e), h = lerp(A.h, B.h, e), ia = smooth(clamp((col - 0.05) / 0.15));
      charWings(g, S, x + ANCHOR.I08.back[0] * w, y + ANCHOR.I08.back[1] * h, smooth(clamp((col - 0.12) / 0.4)), 0, ia, (w / B.w) * 0.8 * B.z);
      g.save(); g.globalAlpha = ia; g.drawImage(photo('I08', null, 900 * aspectOf('I08'), 900, { keyed: true }), x, y, w, h); g.restore();
      targetLock(g, S, x + w * 0.35, y + h * 0.4, 360, col - 0.1, { label: 'COLLAPSED · 1', color: p.acc[0] });
      g.save(); g.globalAlpha = 0.3 * (1 - clamp(col / 0.25)); g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, W, H); g.restore();
    }
    // 字（点阵字；第二十四轮并开关 type22，第二十一轮的立体字删了）
    const line = (a, b, x, y, px, lab) => { const ks = keyword('L31', a, b); dotType(g, S, { text: ks.map(q => q.c), x, y, px, align: 'l', keys: JP_KEYS, color: BRAND, accent: '#3FC6E8', wind: [1, -0.15], label: lab,
      charT: i => ({ age: t - ks[i].t0 + 0.05, out: col - 0.02 - i * 0.03 }), from: () => [cx - s / 2, cy] }); };
    line(0, 3, 110, 150, 78, null); line(3, 7, 100, 330, 160, 'quantum · wind'); line(7, 11, 112, 485, 66, null);
  });
  hud(ctx, S);
}
export const l31 = l31v22; // 第二十四轮并开关 l31r22
// 第二十四轮（用户：02:44 右边大图片不加透明度；大图片窗口周围细节量增加些）（第二十六轮并开关 l31d24）
// · 大图：不再淡淡叠着前一张 / 后一张（看着像半透明的双重曝光），只画当前这张、不透明；换图时轻轻弹一下，一道白色扫描线 0.12 s 从上扫到下（像解码出来）
// · 左边一条像素刻度（0–1024 px，每 64 一格），四个角各一个取景角标（随拍往外弹）
// · 右边三块卫星面板，引线从大图右边连出去：采样器参数（steps / cfg / denoise / eta）、潜空间 128×128×4、这一批种子的分布
// · 下面一排：种子计数器（换图时数字往上滚）、这一批的进度格（看过的填满、当前的粉色）、生成参数
function cardDetail24(g, S, k, n, fa, tk, col, cj = -1) {
  const p = S.pal, t = S.t, { cx, cy, s } = CARD22, x0 = cx - s / 2, y0 = cy - s / 2, kick = decay(S.sub * BEAT, 8), al = fa;
  if (al <= 0.01) return;
  g.save(); g.globalAlpha *= al;
  // 扫描线
  if (tk < 0.12 && col < 0) { const yy = y0 + s * (tk / 0.12); g.fillStyle = css('#FFFFFF', 0.85); g.fillRect(x0, yy - 1.5, s, 3); g.fillStyle = css(BRAND, 0.35); g.fillRect(x0, yy - 8, s, 6); }
  // 左边刻度
  g.strokeStyle = css(BRAND, 0.6); g.lineWidth = 1.5; g.font = fonts(11, 'JB'); g.fillStyle = p.gray; g.textAlign = 'right'; g.textBaseline = 'middle';
  for (let i = 0; i <= 16; i++) { const yy = y0 + (i / 16) * s, L = i % 4 ? 6 : 14; g.beginPath(); g.moveTo(x0 - 30, yy); g.lineTo(x0 - 30 - L, yy); g.stroke(); if (i % 4 === 0) g.fillText(String(i * 64), x0 - 48, yy); }
  g.beginPath(); g.moveTo(x0 - 30, y0); g.lineTo(x0 - 30, y0 + s); g.stroke();
  const my = y0 + ((t * 0.35) % 1) * s; g.fillStyle = p.acc[0]; g.beginPath(); g.moveTo(x0 - 28, my); g.lineTo(x0 - 20, my - 5); g.lineTo(x0 - 20, my + 5); g.closePath(); g.fill();
  // 四角取景角标
  g.strokeStyle = p.acc[0]; g.lineWidth = 3; const o = 34 + 8 * kick, L = 26;
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const qx = cx + sx * (s / 2 + o), qy = cy + sy * (s / 2 + o); g.beginPath(); g.moveTo(qx, qy - sy * L); g.lineTo(qx, qy); g.lineTo(qx - sx * L, qy); g.stroke(); }
  // 下面一排：种子计数器 + 进度格 + 参数
  const by = y0 + s + 64, seed = 114514 + k * 17, prev = 114514 + Math.max(0, k - 1) * 17, roll = smooth(clamp(tk / 0.09));
  g.textAlign = 'left'; g.font = fonts(13, 'ZENB', 'SCB'); g.fillStyle = p.gray; g.fillText('seed', x0, by);
  g.font = fonts(24, 'JB'); const dw = 15;
  [...String(seed)].forEach((ch, i) => { const pc = String(prev)[i], bx = x0 + 44 + i * dw; g.save(); g.beginPath(); g.rect(bx - 1, by - 15, dw, 30); g.clip(); g.fillStyle = BRAND; if (pc !== ch && roll < 1) { g.fillText(pc, bx, by - 26 * roll); g.fillText(ch, bx, by + 26 * (1 - roll)); } else g.fillText(ch, bx, by); g.restore(); });
  const gx = x0 + 160, gw = s - 160, cw = gw / n;
  for (let j = 0; j < n; j++) { g.fillStyle = j === k ? p.acc[0] : j < k ? css(BRAND, 0.75) : css(BRAND, 0.15); g.fillRect(gx + j * cw + 1, by - (j === k ? 9 : 6), cw - 2, j === k ? 18 : 12); }
  g.font = fonts(12, 'JB'); g.fillStyle = p.gray; g.fillText(cj < 0 ? `euler_a · cfg 5.5 · 30 steps · 1024² · ${k + 1}/${n}` : `img2img · euler_a · cfg 5.5 · denoise ${DEN31[cj].toFixed(2)} · ${cj + 1}/7`, x0, by + 30);
  g.restore();
  // 右边卫星面板
  [
    { x: 1590, y: 200, w: 280, h: 170, title: 'sampler · euler_a', kind: 'bars', rows: ['steps', 'cfg', 'denoise', 'eta'], value: cj < 0 ? 0.8 : DEN31[cj], text: cj < 0 ? '30/30' : `d ${DEN31[cj].toFixed(2)}`, anchor: [x0 + s + 18, y0 + 110] },
    { x: 1590, y: 425, w: 280, h: 170, title: 'latent · 128²×4', kind: 'hex', anchor: [x0 + s + 18, y0 + 320] },
    { x: 1590, y: 650, w: 280, h: 170, title: 'seeds · |c_k|²', kind: 'spec', anchor: [x0 + s + 18, y0 + 530] },
  ].forEach((q, i) => satellite(g, S, { ...q, age: t - L31_0() - 0.3 - i * 0.12, seed: 2431 + i, alpha: al }));
}

// ================================================================ L32 · C4 少女版 · 我的心在摇晃（105–106）
// 全片最大的晃动和最大的字：她（带代码翅膀）往镜头飞，穿过一层层界面（对话窗口、公式卡、HUD 拼贴）；
// 整句歌词巨大、碎开地砸在最前面；最后白闪接尾奏
const L32_0 = () => cutAt(105), L32_1 = barStart(107);
const PLANES = Array.from({ length: 18 }, (_, i) => ({ x: (rnd(i, 1) - 0.5) * 2600, y: (rnd(i, 2) - 0.5) * 1400, z0: rnd(i, 3), kind: i % 4 }));
// 第二十二轮：前两分钟里挑的一些时刻（避开转场，memory.js 会再往后挪），窗口里放这些画面
const MEM32 = [3.2, 7.5, 13.6, 16.4, 19.6, 22.4, 25.4, 28.6, 32.4, 35.4, 40.2, 45.0, 50.6, 55.8, 61.8, 67.2, 70.8, 76.6, 82.8, 88.6, 95.6, 101.0, 108.4, 113.6];
const fmtFilm = t => { const s = Math.max(0, t - 0.6); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${(s % 60).toFixed(1).padStart(4, '0')}`; };
function memWindow(g, S, tm) {
  const img = memoryFrame(tm, 640), w = 800, h = 450 + 40;
  g.fillStyle = css(S.pal.shadow ?? '#1D2541', 0.15); rrect(g, -w / 2 + 8, -h / 2 + 10, w, h, 16); g.fill();
  g.fillStyle = '#FFFFFF'; rrect(g, -w / 2, -h / 2, w, h, 16); g.fill(); g.lineWidth = 3; g.strokeStyle = S.pal.winEdge; g.stroke();
  g.font = fonts(22, 'ZENB', 'SCB'); g.fillStyle = BRAND; g.textBaseline = 'middle'; g.fillText(`memory · ${fmtFilm(tm)}`, -w / 2 + 20, -h / 2 + 20); g.textBaseline = 'alphabetic';
  if (img) { g.save(); rrect(g, -w / 2 + 8, -h / 2 + 40, w - 16, h - 48, 10); g.clip(); g.drawImage(img, -w / 2 + 8, -h / 2 + 40, w - 16, h - 48); g.restore(); }
}
// 刀剑神域 Link Start 式的放射线：彩色光条从中心往外射，越往外越快越长；中心一团白光随拍亮
const LS_COL = ['#7FE0FF', '#FF8AD8', '#FFFFFF', '#A28BFF', '#7FFFC4', '#FFE27F'];
function linkStart(ctx, S, cam, u) {
  const t = S.t, cx = 960 + cam.x, cy = 560 + cam.y, kick = decay(S.sub * BEAT, 6);
  ctx.save();
  const gl = ctx.createRadialGradient(cx, cy, 0, cx, cy, 520); gl.addColorStop(0, css('#FFFFFF', 0.85)); gl.addColorStop(0.35, css('#DDE8FF', 0.35 + 0.15 * kick)); gl.addColorStop(1, css('#DDE8FF', 0));
  ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H);
  ctx.lineCap = 'round';
  linkStart25(ctx, S, cx, cy);
  ctx.restore();
}
// 第二十五轮（用户：02:47 背景放射线密度和长度都还不够，长度增加随机的长度。背景逐渐加速；第二十七轮并开关 l32l25）
// · 密度：150 → 420 根（外圈再加一层细的）；长度：每根自己一个随机倍数（多数 1–2 倍、少数拉到 4–5 倍，像光速里被拉长的星），越往外越长
// · 逐渐加速：每根的相位按"走过的路程"算——速度从切点时的 1 倍匀加到这一句结束时约 2.6 倍，路程是速度对时间的积分，所以只会越来越快、不会跳
//   （直接把速度乘进相位，速度一变所有光条都会瞬间跳位）；中心白光跟着越来越亮
function linkStart25(ctx, S, cx, cy) {
  const t = S.t, d = t - L32_0(), D = L32_1 - L32_0(), acc = 1.6 / D, dist = d > 0 ? d + 0.5 * acc * d * d : d, sNow = 1 + acc * Math.max(0, d);
  for (let i = 0; i < 420; i++) {
    const fine = i >= 300, an = rnd(i, 3201) * Math.PI * 2, sp = 0.55 + rnd(i, 3202) * 0.9, ph = (((dist * sp + rnd(i, 3203)) % 1) + 1) % 1;
    const lr = rnd(i, 3206), lk = lr < 0.82 ? 1 + lr * 1.2 : 2.6 + (lr - 0.82) * 14; // 随机长度倍数
    const r0 = 30 + 1500 * ph * ph, len = (24 + 420 * ph * ph) * lk * (0.75 + 0.25 * sNow) * (fine ? 0.6 : 1);
    const a = Math.sin(Math.PI * Math.min(1, ph * 1.4)) * (0.3 + 0.45 * rnd(i, 3204)) * (fine ? 0.6 : 1);
    if (a <= 0.01) continue;
    // 第二十六轮（用户：02:48 背景细线太细了，增加随机粗细）：每根一个随机粗细（多数 2–4 px、少数 8–12 px），越往外越粗。开关 l32w26 第二十八轮并进代码
    const wr = rnd(i, 3207), lw26 = (wr < 0.75 ? 2 + 2.7 * wr : 4 + (wr - 0.75) * 32) * (0.55 + 0.75 * ph) * (fine ? 0.6 : 1);
    ctx.strokeStyle = css(LS_COL[i % LS_COL.length], a); ctx.lineWidth = lw26; // 开关 l32w26 第二十八轮并进代码
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(an) * r0, cy + Math.sin(an) * r0); ctx.lineTo(cx + Math.cos(an) * (r0 + len), cy + Math.sin(an) * (r0 + len)); ctx.stroke();
  }
  const core = clamp((sNow - 1) / 1.6), gl = ctx.createRadialGradient(cx, cy, 0, cx, cy, 260 + 140 * core); gl.addColorStop(0, css('#FFFFFF', 0.35 * core)); gl.addColorStop(1, css('#FFFFFF', 0));
  ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H);
}
export function l32(ctx, S) {
  const p = S.pal, t = S.t, u = (t - L32_0()) / (L32_1 - L32_0()), kick = decay(S.sub * BEAT, 6);
  const [sx, sy] = shake(t, 5 + 12 * kick * (0.5 + u));
  const cam = { x: sx, y: sy, zoom: 1.03 + 0.06 * kick, rot: 0.015 * Math.sin(S.n * Math.PI) * (0.5 + u) };
  // 第二十二轮（用户：给背景增加放射线，类似刀剑神域 Link Start；背景窗口元素改成这个视频前两分钟的随机内容，装饰性图形元素可以保留）。第二十四轮并开关
  // 放射线：从画面中心往外射的彩色光条（越往外越长、越快），中心一团白光；窗口换成前两分钟的画面（core/memory.js，第一次用到时画一遍缓存）
  // 一层层界面从远处飞过来（穿过）
  const planes = PLANES.map(q => ({ ...q, z: 0.15 + ((q.z0 - t * 0.45) % 1 + 1) % 1 * 2.4 })).sort((a, b) => b.z - a.z);
  const memOf = q => MEM32[Math.floor(q.z0 * 997 + (q.kind ? 5 : 0)) % MEM32.length];
  for (const q of planes) if (q.kind <= 1 && q.z < 2.5) memoryFrame(memOf(q), 640); // 先把要用的缩略图画好（画到一半再去画别的时刻会占用共用的缓冲）
  paper(ctx, S, cam);
  linkStart(ctx, S, cam, u);
  withCam(ctx, cam, 1, g => {
    for (const q of planes) {
      const s = 1 / q.z, a = clamp((2.5 - q.z) / 0.6) * clamp((q.z - 0.15) / 0.25);
      if (a <= 0) continue;
      g.save(); g.globalAlpha = a; g.translate(960 + q.x * s * 0.6, 540 + q.y * s * 0.6); g.scale(s * 0.5, s * 0.5);
      if (q.kind <= 1) memWindow(g, S, memOf(q));
      else if (q.kind === 2) hudCluster(g, S, Math.floor(q.z0 * 100), -300, -200, 600, 400, { density: 0.8 });
      else { g.fillStyle = '#FFFFFF'; rrect(g, -260, -60, 520, 120, 60); g.fill(); g.lineWidth = 3; g.strokeStyle = GOLD; g.stroke(); g.font = fonts(48, 'ZENB', 'SCB'); g.fillStyle = BRAND; g.textAlign = 'center'; g.fillText(['♥ 150 BPM', '已深度思考', 'Link Start', '114514'][Math.floor(q.z0 * 4)], 0, 18); g.textAlign = 'left'; }
      g.restore();
    }
    // 她：带翅膀，越飞越近
    // 第十八轮（I08 换成最终精度的大图，rev img18）：按真图宽高比；翅膀以前对着图的正中，人在图里偏左（两肩中间在 0.34），翅膀看着长在她右边——
    // 改成两肩中间对准翅膀根（局部坐标 0, −180）
    const img = photo('I08', null, 900 * (i18() ? aspectOf('I08') : 1344 / 1664), 900, { keyed: true }), z = lerp(0.75, 1.35, easeIn(u)) * (1 + 0.015 * kick); // 第八轮：I08
    // 第二十一轮：L31 塌缩出来的就是这个她——开头的旋转从 0 起（接得上 L31 最后一帧）；翅膀和 L27 一样只用字（第二十三轮并开关）
    // 第二十三轮（用户：02:46 立绘的 wiggle 强度降低）：她自己的摆动 ±0.06 → ±0.02 rad，随拍放大 4% → 1.5%；镜头的摇摆减半（第二十五轮并开关 l32w23）
    const rz = 0.02 * Math.sin((t - L32_0()) * 3);
    g.save(); g.translate(960, 600); g.scale(z, z); g.rotate(rz);
    charWings(g, S, 0, -180, 1, 0.07 * Math.sin(S.n * Math.PI), 1, 0.8);
    if (i18()) g.drawImage(img, -ANCHOR.I08.back[0] * img.width, -180 - ANCHOR.I08.back[1] * img.height); else g.drawImage(img, -img.width / 2, -450);
    g.restore();
  });
  // 最前面：整句歌词，全片最大最碎（每个字随拍抖、旋转）
  { // 第二十二轮：点阵字（粉色，点缀品牌蓝），点从她身上飞出来拼成字，随拍抖；没有深色厚度（第二十四轮并开关 type22）
    const cs = lyric('L32').chars;
    dotType(ctx, S, { text: cs.map(c => c.c), x: 960 + sx * 2, y: 900 + sy * 2, px: 112, grid: 22, keys: JP_KEYS, color: p.acc[0], accent: BRAND, label: `stdout · L32 · ${cs.length} tokens`,
      charT: i => ({ age: t - cs[i].t0 + 0.04, s: 1 + 0.12 * kick, r: (rnd(i, S.ni) - 0.5) * 0.35 * kick, dy: -36 * kick * (i % 2 ? 1 : -1) }), from: () => [960, 560] });
  }
  hud(ctx, S, { lyric: false });
  flash(ctx, clamp((t - (L32_1 - 0.25)) / 0.25) * 0.9);
}
