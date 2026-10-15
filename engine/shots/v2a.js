// 第二段（御姐音 · 夜海）L13–L16（42–49 小节，1:05.67–1:18.47），视觉方案 §5.4，第七轮实现
// 御姐音的手感：干脆、无回弹，1 px 细线，菱形；日文用 Shippori Mincho
import { W, H, BRAND, BEAT, STEP, CW, CH } from '../core/const.js';
import { barStart, beatTime, clamp, lerp, smooth, easeIn, easeOut, easeOutBack, decay } from '../core/time.js';
import { cutAt } from '../core/cuts.js';
import { hash, rnd, vnoise } from '../core/rand.js';
import { font, fonts, glyphs, midText } from '../core/glyphs.js';
import { fact, keyword, onset } from '../core/data.js';
import { photo, keyed } from '../core/portrait.js';
import { camAt, withCam, pooled, camToScreen, drawPersp, softCopy } from '../core/cam.js';
import { charField } from '../core/grid.js';
import { hud } from '../core/hud.js';
import { card, ring, corners, hatch, dots } from '../core/kit.js';
import { drawFormula } from '../core/math.js';
import { drawSprite } from '../core/sprites.js';
import { ringScanner, ruler, ecgStrip, segBar, tag, dataColumn, targetLock } from '../core/hudkit.js';
import { css, mix } from '../core/color.js';
import { rrect, toast } from '../core/ui.js';
import { framed } from '../core/fx.js';
import { paper, backDeco, frontDeco, punch, bigLine, formulaFx, sendArrow } from './scene.js';
import { newCanvas } from '../core/env.js';
import { avatar17 } from './v2b.js';

// 夜海字符场：上面是稀疏的星，下面是慢慢起伏的海（surface 行号）
function nightSea(ctx, S, surface = 38, { amount = 1 } = {}) {
  charField(ctx, S, {
    inkCap: 3, reshuffle: 0.5,
    density: (c, r, t) => {
      const s = surface + 1.4 * Math.sin(c * 0.06 + t * 0.7) + 0.7 * Math.sin(c * 0.17 - t * 1.2);
      if (r < s) return rnd(c, r, 7) < 0.01 * amount ? 0.25 + 0.2 * Math.sin(t * 3 + c) : 0;
      const n = vnoise(c * 0.11, r * 0.32, t * 0.45, 4);
      return n < 0.33 ? 0 : Math.min(0.72, (0.14 + 0.42 * n + (r - s) * 0.018) * amount);
    },
  });
}

// ================================================================ L13 · 一个人（42–43）
// 合成器很稀：巨大的夜海字符场，中间一个 DeepSeek 窗口，侧栏「暂无对话」，消息区里只有她的光标在闪；
// 右下角一张很小的她（I02）像被遗忘的照片；左上角极小的「♪」；一条像素小鲸鱼独自游过海面
// 第十六轮：镜头的起止跟着切点走（core/cuts.js，画帧时取）
const L13_0 = () => cutAt(42), L13_1 = () => cutAt(44);
// 第八轮（用户：只有一个空窗口太单调，背景加点东西但保持歌词的情绪）：远处一轮淡月慢慢升起；几个聊天气泡在背后漂着、
// 其中一个一直是「…」却发不出来；她（I06 抱膝）小小地坐在字符海的海平线上，海里有她晃动的倒影。L14 从她身上推进去
export function photo13Rect() {
  const P = PHOTO13_12, c = camAt(CAM13_12(), L13_1() - 1 / 60);
  const [x0, y0] = camToScreen(c, 1, P[0], P[1]), [x1, y1] = camToScreen(c, 1, P[0] + P[2], P[1] + P[3]);
  return [x0, y0, x1 - x0, y1 - y0];
}

// 第十二轮（用户：1:08 构图重做——孤独的她放在正中，四周随机位置几个聊天窗口，带 3D 透视）。rev v2a
// 她（I06 抱膝）坐在画面正中的海平线上，海里有倒影；四周七个聊天窗口浮在不同深度、各自朝她斜着（绕竖轴转），
// 远的虚、近的实，慢慢漂；窗口里是没人回的对话（暂无对话 / 在吗 / … / 已读 / 对方已离开 / 服务器繁忙）。相机很慢地推向她
const PHOTO13_12 = [960 - 195, 800 - 465, 390, 480];
const CAM13_12 = () => [{ t: L13_0(), x: 0, y: 40, zoom: 1.0, rot: 0 }, { t: L13_1(), x: 0, y: 30, zoom: 1.1, rot: -0.004 }];
const MSG13 = [null, [['you', '在吗']], [['you', '在吗'], ['her', '…']], [['you', '晚安'], ['sys', '已读']], [], [['sys', '对方已离开对话']], [['sys', '服务器繁忙，请稍后再试。']]];
// 第十三轮（用户：四周的对话框再多一些、大小反差再大；现在有的 UI 叠在一起、有的字比它的框还大；右上那个圆是太阳吗、是 bug 吗；
// 转到下一个镜头时人物被切掉一半、只有一帧的跳位，是 bug 吗）
// 窗口改成 14 个，倍数 0.45–1.5；小窗口不再套完整的 chatWin（侧栏按钮、两个胶囊挤在 500 px 里会互相压、字出框），
// 改成简化的对话窗：标题栏、气泡、一条输入框 + 发送钮，所有字都按框宽量过；圆改成一弯新月 + 几颗星；转场改成她本人从 L13 的位置走到 L14 的位置
const WIN13B = [ // [X, Y, Z, 转角, 内容, 倍数]
  [-820, -300, 1300, 0.5, 0, 1.25], [-560, 180, 1150, 0.42, 1, 0.95], [-1100, 60, 1900, 0.55, 2, 1.5], [560, -310, 1500, -0.42, 3, 1.1],
  [840, 120, 1250, -0.5, 4, 1.3], [480, 330, 1900, -0.3, 5, 0.6], [-160, -430, 2300, 0.08, 6, 0.7], [260, -470, 2600, -0.1, 1, 0.5],
  [-430, -180, 2400, 0.3, 3, 0.55], [1150, -130, 2200, -0.55, 2, 0.8], [-1350, 380, 2300, 0.6, 4, 0.9], [1300, 420, 2100, -0.6, 5, 0.7],
  [-700, 430, 1000, 0.45, 6, 0.6], [720, -60, 2700, -0.35, 0, 0.45],
];
function miniChat(S, k) {
  const cv = pooled(`l13mini${k}`, 520, 360);
  if (cv.__done) return cv;
  const c = cv.getContext('2d'), p = S.pal, x = 6, y = 6, w = 500, h = 340, bar = 46;
  c.clearRect(0, 0, 520, 360);
  c.fillStyle = '#FFFFFF'; rrect(c, x, y, w, h, 16); c.fill(); c.lineWidth = 1.5; c.strokeStyle = p.winEdge; c.stroke();
  c.beginPath(); c.moveTo(x, y + bar); c.lineTo(x + w, y + bar); c.stroke();
  drawSprite(c, 'whale', 2, p, x + 26, y + bar / 2);
  c.font = fonts(20, 'SCB'); c.fillStyle = p.text; midText(c, 'DeepSeek', x + 48, y + bar / 2);
  c.fillStyle = p.gray; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(x + w - 46 + i * 12, y + bar / 2, 2.5, 0, Math.PI * 2); c.fill(); }
  const mx = x + 22, mw = w - 44, my = y + bar + 18;
  (MSG13[k] || []).forEach(([who, s0], i) => {
    const yy = my + i * 60;
    if (who === 'sys') { c.font = fonts(17, 'SC'); c.fillStyle = p.gray; c.textAlign = 'center'; midText(c, `— ${s0} —`, mx + mw / 2, yy + 22); c.textAlign = 'left'; return; }
    c.font = fonts(20, 'SC'); const tw = Math.min(mw - 20, c.measureText(s0).width + 40), bx = who === 'you' ? mx + mw - tw : mx;
    c.fillStyle = who === 'you' ? mix(BRAND, '#FFFFFF', 0.86) : p.tint[3]; rrect(c, bx, yy, tw, 44, 18); c.fill();
    c.fillStyle = p.text; midText(c, s0, bx + 20, yy + 22);
  });
  if (k === 0) { c.font = fonts(18, 'SC'); c.fillStyle = p.gray; c.textAlign = 'center'; midText(c, '暂无对话', x + w / 2, my + 70); c.textAlign = 'left'; }
  const iy = y + h - 70; // 输入框：一条，占位字 + 发送钮
  c.fillStyle = '#FFFFFF'; rrect(c, x + 20, iy, w - 40, 50, 25); c.fill(); c.lineWidth = 1.5; c.strokeStyle = p.winEdge; c.stroke();
  c.font = fonts(17, 'SC'); c.fillStyle = p.gray; midText(c, '给 DeepSeek 发送消息', x + 44, iy + 25);
  c.fillStyle = p.winEdge; c.beginPath(); c.arc(x + w - 48, iy + 25, 16, 0, Math.PI * 2); c.fill(); sendArrow(c, x + w - 48, iy + 25, 1);
  cv.__done = true;
  return cv;
}
function l13r12(ctx, S) {
  const cam = camAt(CAM13_12(), S.t), p = S.pal, t = S.t, u13 = (t - L13_0()) / (L13_1() - L13_0());
  paper(ctx, S, cam, { grid: false });
  nightSea(ctx, S, 40, { amount: 1.0 });
  withCam(ctx, cam, 0.45, g => { // 远处很大的空心「♪」
    g.font = fonts(400, 'MIN', 'J'); g.lineWidth = 1.5; g.strokeStyle = css(p.line, 0.22); g.textBaseline = 'middle';
    keyword('L13', 5, 8).forEach((k, i) => { if (t >= k.t0 - 0.2) g.strokeText(k.c, 260 + i * 470, 520); });
    g.textBaseline = 'alphabetic';
  });
  withCam(ctx, cam, 0.3, g => { // 月亮（第十三轮：一弯新月 + 几颗四角星，读得出是夜里的月亮）
    const mx = 1640, my = lerp(260, 170, u13), halo = g.createRadialGradient(mx, my, 50, mx, my, 300);
    halo.addColorStop(0, css('#FFFFFF', 0.9)); halo.addColorStop(0.35, css(p.ink[0], 0.3)); halo.addColorStop(1, css(p.ink[0], 0));
    g.fillStyle = halo; g.beginPath(); g.arc(mx, my, 300, 0, Math.PI * 2); g.fill();
    // 第十四轮（用户：月亮像两个叠着的圆，布尔运算失败了吗）：是——以前用 evenodd 填两个圆，小圆伸出大圆的那一块反而被填上了，
    // 描边又描的是整个大圆。现在按两圆交点拼出真正的月牙路径（大圆外弧 + 小圆内弧），填充和描边都只沿月牙走
    crescent(g, mx, my, 80, 36, -22, 70); g.fillStyle = '#FFFFFF'; g.fill(); g.lineWidth = 2; g.lineJoin = 'round'; g.strokeStyle = css(p.line, 0.45); g.stroke();
    for (let i = 0; i < 6; i++) { const sx = mx - 260 + rnd(i, 3) * 420, sy = my - 140 + rnd(i, 4) * 260, r = (5 + 7 * rnd(i, 5)) * (0.7 + 0.3 * Math.sin(t * 3 + i)); g.fillStyle = css('#FFFFFF', 0.85); g.beginPath(); g.moveTo(sx, sy - r); g.lineTo(sx + r * 0.25, sy - r * 0.25); g.lineTo(sx + r, sy); g.lineTo(sx + r * 0.25, sy + r * 0.25); g.lineTo(sx, sy + r); g.lineTo(sx - r * 0.25, sy + r * 0.25); g.lineTo(sx - r, sy); g.lineTo(sx - r * 0.25, sy - r * 0.25); g.closePath(); g.fill(); }
  });
  // 四周的聊天窗口：从远到近画；各自上下漂、转角轻轻摆；远的虚化变淡
  const zoom = cam.zoom, list = WIN13B.map(([X, Y, Z, ang, k, sc = 1], i) => ({ X, Y, Z, ang, k, sc, i })).sort((a, b) => b.Z - a.Z);
  for (const w of list) {
    const a = clamp((t - L13_0() - 0.1 - w.i * 0.05) / 0.5), fl = 18 * Math.sin(t * 0.9 + w.i * 1.7), sway = 0.05 * Math.sin(t * 0.6 + w.i);
    if (a <= 0) continue;
    const src = miniChat(S, w.k), far = clamp((w.Z - 1100) / 1500), img = far > 0.15 ? softCopy(src, 1 + 3 * far, `l13w${w.i}`) : src;
    drawPersp(ctx, img, w.X * zoom, (w.Y + fl - 20 * (1 - easeOut(a))) * zoom - cam.y * zoom, w.Z / zoom, 460 * w.sc, 318 * w.sc, w.ang + sway, { f: 1000, strips: 48, shear: true, alpha: a * (1 - 0.45 * far) });
  }
  withCam(ctx, cam, 1, g => {
    const wx = lerp(-80, 2000, u13), wy = 860 + 8 * Math.sin(t * 2.4); // 小鲸鱼独自游过
    drawSprite(g, 'whale', 3, p, wx, wy);
    // 正中：海平线上抱膝坐着的她 + 倒影 + 慢转的扫描环
    const [px, py, pw, ph] = PHOTO13_12, pa = clamp((t - L13_0() - 0.2) / 0.5);
    ringScanner(g, S, px + pw / 2, py + ph * 0.55, 300, { alpha: 0.35 * pa, seed: 13 });
    if (pa > 0 && t < L13_1() - HAND13) { // 第十三轮：转场里她由 her1314 接着画
      const her = photo('I06', null, pw, ph, { keyed: true });
      // 第十四轮（用户：人物加一个非常缓慢的旋转）：整个镜头里她绕自己的中心慢慢转过去再转回来（最大约 2.6°），
      // 到镜头最后正好回正——接 her1314 的转场不跳。倒影按水面对称反着转
      const ang = Math.sin(Math.PI * clamp(u13)) * (0.045 + 0.008 * Math.sin(t * 1.3)), hx = px + pw / 2, hy = py + ph * 0.55;
      g.save(); g.globalAlpha = pa; g.translate(hx, hy); g.rotate(ang); g.translate(-hx, -hy); g.drawImage(her, px, py); g.restore();
      g.save(); g.globalAlpha = 0.2 * pa; g.translate(hx, py + ph); g.rotate(-ang); g.translate(-hx, -(py + ph));
      for (let yy = 0; yy < ph * 0.6; yy += 6) g.drawImage(her, 0, ph - yy - 6, pw, 6, px + 5 * Math.sin(yy * 0.08 + t * 2.2), py + ph + yy, pw, 6);
      g.restore();
      onlinePill(g, S, pa); // 第十四轮：放进她右上方的胶囊里
    }
    bigLine(g, S, keyword('L13', 5, 8), 250, 150, { size: 34, keys: ['MIN', 'J'], color: p.text, stroke: 0, align: 'l' });
    g.strokeStyle = css(p.line, 0.6); g.lineWidth = 1; g.beginPath(); g.moveTo(250, 176); g.lineTo(380, 176); g.stroke();
  });
  hud(ctx, S, { alpha: 0.75, spectrum: false });
}

export function l13(ctx, S) { return l13r12(ctx, S); }
// 月牙：圆心 (x, y)、半径 R 的圆，挖掉圆心偏 (dx, dy)、半径 r 的圆。按两圆交点 P1、P2 拼路径：
// 大圆上不靠近小圆的那段弧（P1 → P2 绕远的一边）+ 小圆落在大圆里面的那段弧（P2 → P1），只剩月牙本身
function crescent(g, x, y, R, dx, dy, r) {
  const d = Math.hypot(dx, dy), phi = Math.atan2(dy, dx), a = (R * R - r * r + d * d) / (2 * d), al = Math.acos(clamp(a / R, -1, 1));
  const P1 = [x + R * Math.cos(phi + al), y + R * Math.sin(phi + al)], P2 = [x + R * Math.cos(phi - al), y + R * Math.sin(phi - al)];
  const b1 = Math.atan2(P1[1] - y - dy, P1[0] - x - dx), b2 = Math.atan2(P2[1] - y - dy, P2[0] - x - dx);
  g.beginPath(); g.arc(x, y, R, phi + al, phi - al + Math.PI * 2);
  // 小圆从 P2 回到 P1，要经过背对大圆圆心的反方向（phi + π）那一侧：看顺时针那段是否包含它
  const norm = v => ((v % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2), inCW = norm(phi + Math.PI - b2) <= norm(b1 - b2);
  g.arc(x + dx, y + dy, r, b2, b1, !inCW); g.closePath();
}
// 「她 · 在线 · 1」胶囊（第十四轮）：她头顶右上方，白底品牌蓝细边，前面一颗随呼吸亮暗的绿点（在线）
function onlinePill(g, S, a) {
  const s = '她 · 在线 · 1', h = 38, x = 958, cy = 284;
  g.save(); g.globalAlpha *= a;
  g.font = fonts(20, 'ZENB', 'SCB'); const w = g.measureText(s).width + 56;
  g.fillStyle = css(S.pal.shadow ?? '#1D2541', 0.14); rrect(g, x + 4, cy - h / 2 + 5, w, h, h / 2); g.fill();
  g.fillStyle = '#FFFFFF'; rrect(g, x, cy - h / 2, w, h, h / 2); g.fill(); g.lineWidth = 2; g.strokeStyle = BRAND; g.stroke();
  const br = 0.55 + 0.45 * Math.sin(S.t * 4);
  g.fillStyle = css('#2FC48D', 0.25 * br); g.beginPath(); g.arc(x + 21, cy, 10, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#2FC48D'; g.beginPath(); g.arc(x + 21, cy, 5.5, 0, Math.PI * 2); g.fill();
  g.fillStyle = BRAND; midText(g, s, x + 38, cy);
  g.restore();
}
// L13 → L14 转场叠层（第十三轮）：她（同一个抱膝的 I06）从 L13 正中的位置放大、走到 L14 里她的位置，一路染成 L14 的冷色；
// 两个镜头在这段时间都不画她，只有这一个她在动（以前是 portal 推进一个非 16:9 的框，人物被裁一半、最后一帧跳位）
export const HAND13 = 0.35;
export function her1314(ctx, S, u) {
  const t = S.t, A = camAt(CAM13_12(), t), B = camAt(CAM14(), t), cool = coolHer(S.pal);
  const ra = rectAt(A, PHOTO13_12), rb = rectAt(B, [980, 50, cool.width, cool.height]), e = u < 0.5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2;
  const x = lerp(ra[0], rb[0], e), y = lerp(ra[1], rb[1], e) - 40 * Math.sin(Math.PI * e), w = lerp(ra[2], rb[2], e), h = lerp(ra[3], rb[3], e);
  ctx.save();
  ctx.drawImage(photo('I06', null, PHOTO13_12[2], PHOTO13_12[3], { keyed: true }), x, y, w, h);
  ctx.globalAlpha = smooth(clamp((u - 0.2) / 0.6)); ctx.drawImage(cool, x, y, w, h);
  ctx.restore();
}
const rectAt = (c, r) => { const [x0, y0] = camToScreen(c, 1, r[0], r[1]), [x1, y1] = camToScreen(c, 1, r[0] + r[2], r[1] + r[3]); return [x0, y0, x1 - x0, y1 - y0]; };

// ================================================================ L14 · 溶进孤独的世界（44–45）
// 她（I02，冷色）和「孤♪世界」几个大字一起向下溶化：每 4 px 一条竖条各自下坠、拉长，底部拖出拖影、滴成字符雨；
// 左下终端打出 context.clear()，上下文里的 token 一个个蒸发，最后一拍 toast「上下文已清空」
const L14_0 = () => cutAt(44), L14_1 = () => cutAt(46);
const CAM14 = () => [{ t: L14_0(), x: 0, y: -30, zoom: 1.04, rot: 0 }, { t: L14_1(), x: 20, y: 70, zoom: 1.1, rot: 0.01 }];
let COOL = null;
function coolHer(p) { // I02 半身抠图，压冷一档（缓存）
  if (COOL) return COOL;
  const src = photo('I06', null, 808, 1000, { keyed: true }); // 第八轮：换成 I06 抱膝（和 L13 海平线上的她是同一个姿势）
  COOL = pooled('l14cool', src.width, src.height);
  const c = COOL.getContext('2d');
  c.drawImage(src, 0, 0); c.globalCompositeOperation = 'source-atop'; c.fillStyle = css('#6E6AF0', 0.22); c.fillRect(0, 0, src.width, src.height);
  return COOL;
}
// 第九轮（用户：1:11 的溶解效果不好看，换别的处理）。rev l14
// 不再按竖条往下溶，改成"清空上下文"的删除：一道品牌蓝的选区从上往下扫过她，被选中的格子变蓝、缩成一个点，
// 删掉的地方留下一个淡淡的点——最后只剩点阵画出的她的轮廓（空出来的上下文槽位）。
// 「孤♪世界」唱完后被整句选中（蓝底），再从右往左一个字一个字退格删掉，最后只剩一个在闪的光标
const ER0 = 70.3, ER_DUR = 1.5, TILE14 = 12;
const T_SEL14 = 70.52, T_DEL14 = 70.9, DEL_STEP = 0.13;
let ER = null;
function eraseGrid(src) {
  if (ER) return ER;
  const cols = Math.ceil(src.width / TILE14), rows = Math.ceil(src.height / TILE14);
  const sm = newCanvas(cols, rows), c = sm.getContext('2d');
  c.drawImage(src, 0, 0, cols, rows);
  const d = c.getImageData(0, 0, cols, rows).data, tiles = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const al = d[(y * cols + x) * 4 + 3];
    if (al <= 8) continue; // 第十二轮：半透明的边缘格也算进来（以前只算 alpha ≥ 100 的）
    tiles.push({ x, y, solid: al >= 100, te: ER0 + (y / rows) * ER_DUR + 0.12 * vnoise(x * 0.15, y * 0.15, 0, 17) });
  }
  const mask = newCanvas(cols, rows), mctx = mask.getContext('2d'), teAll = new Float32Array(cols * rows);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) teAll[y * cols + x] = ER0 + (y / rows) * ER_DUR + 0.12 * vnoise(x * 0.15, y * 0.15, 0, 17);
  ER = { cols, rows, tiles, mask, mctx, md: mctx.createImageData(cols, rows), teAll };
  return ER;
}
// 第十二轮（用户：1:10 她周围一圈方块锯齿，像特效 bug；变成方块粒子消失时再加一层浅色粒子）。rev v2a
// 锯齿的来源：蒙版只保留「不透明的格子」，人物的软边被 12 px 的方格裁掉了。现在蒙版反过来——只挖掉已经删掉的格子，没删的地方原图原样
function erase14(g, S, src, x, y) {
  const E = eraseGrid(src), t = S.t, md = E.md.data, T = TILE14;
  md.fill(255);
  // 第十三轮（用户：变成粒子以后边上还留着一圈锯齿、一直不消失）：那是透明度很低、没算进格子的软边像素——扫过去时所有格子一起挖掉，不只是有内容的格子
  for (let i = 0; i < E.teAll.length; i++) if (t >= E.teAll[i]) md[i * 4 + 3] = 0;
  E.mctx.putImageData(E.md, 0, 0);
  const body = pooled('l14body', src.width, src.height), bc = body.getContext('2d');
  bc.globalCompositeOperation = 'source-over'; bc.clearRect(0, 0, body.width, body.height); bc.drawImage(src, 0, 0);
  bc.globalCompositeOperation = 'destination-in'; bc.imageSmoothingEnabled = false;
  bc.drawImage(E.mask, 0, 0, E.cols * T, E.rows * T);
  bc.globalCompositeOperation = 'source-over';
  g.drawImage(body, x, y);
  for (const tl of E.tiles) {
    const a = t - tl.te, px = x + tl.x * T, py = y + tl.y * T;
    if (a < -0.16) continue;
    if (a > 0 && a < 0.9 && (tl.x + tl.y) % 2 === 0) { // 浅色粒子：删掉的格子各放出一颗，往右上飘、变小变淡
      const e = a / 0.9, s = T * 0.7 * (1 - 0.6 * e), dx = (18 + 70 * rnd(tl.x, tl.y, 3)) * e + 30 * e * e, dy = -(40 + 120 * rnd(tl.x, tl.y, 4)) * e;
      g.fillStyle = css(rnd(tl.x, tl.y, 5) < 0.5 ? '#DCE6FF' : '#FFFFFF', 0.85 * (1 - e)); g.fillRect(px + T / 2 + dx - s / 2, py + T / 2 + dy - s / 2, s, s);
    }
    if (a < 0) { g.fillStyle = css(BRAND, 0.32 * (1 + a / 0.16)); g.fillRect(px, py, T, T); continue; }  // 选中
    if (a < 0.2) { const s = T * lerp(1, 0.2, easeIn(a / 0.2)); g.fillStyle = BRAND; g.fillRect(px + (T - s) / 2, py + (T - s) / 2, s, s); continue; } // 删掉：缩成点
    g.fillStyle = css(S.pal.line, 0.5); g.fillRect(px + T / 2 - 1.4, py + T / 2 - 1.4, 2.8, 2.8);           // 留下的空槽位
  }
  // 删除的前沿：一条细线 + 进度
  const u = (t - ER0) / ER_DUR;
  if (u > 0 && u < 1.1) {
    const fy = y + clamp(u) * E.rows * T, a = 1 - clamp((u - 1) / 0.1);
    g.fillStyle = css(BRAND, 0.85 * a); g.fillRect(x - 30, fy, E.cols * T + 60, 2);
    g.font = fonts(18, 'ZENB', 'SCB'); g.fillStyle = css(BRAND, a);
    g.fillText(`deleting · ${Math.round(100 * clamp(u))}%`, x + E.cols * T - 150, fy - 10);
  }
}
// 「孤♪世界」：唱到的字出现；整句选中；从右往左退格；光标留在原地闪
// 第十七轮（用户：1:10 歌词文字出现时间太晚了，完全没和声音对上）：对时数据在这一句前半错得厉害——人声分轨里
// 「♪」68.44、「♪（独）」68.64、「♪」68.84（每个都是辅音前的空隙之后的起音）、「♪」69.26、「♪（世）」69.66，对时数据却把「独」放在 69.24、
// 「♪」69.59、「世」69.78（「独」晚了 0.6 s）。五个大字改按实测起音、提前 0.08 s 出来（「孤」不早于切点）。rev l14t17
// 第十八轮（用户：1:09 中间歌词「世界」出现的时间晚了一点）：上一轮的 69.66 其实是「♪（界）」——连音高一起看，「♪」69.26（F#4）之后
// 69.38–69.46 是一段没有音高的气声（♪ 的 s），69.48 换到 G#4 是「♪」的元音；69.58–69.68 空隙（k）之后 69.66 起「♪」（C#4，拖到 70.24）。
// 「世」改到 69.40、「界」69.66（data/vocal_onsets.json），同样提前 0.08 s。rev l14t18
const show14 = (k, i) => Math.max(L14_0(), onset('L14', i) - 0.08);
function words14(g, S, x, y) {
  const p = S.pal, t = S.t, ks = keyword('L14', 0, 5).map((k, i) => ({ ...k, t0: show14(k, i) }));
  g.save();
  g.font = fonts(150, 'MIN', 'J'); g.textBaseline = 'middle';
  const ws = ks.map(k => g.measureText(k.c).width + 6), xs = ws.map((_, i) => x + ws.slice(0, i).reduce((s, v) => s + v, 0));
  const deleted = t < T_DEL14 ? 0 : Math.min(ks.length, Math.floor((t - T_DEL14) / DEL_STEP) + 1);
  const shown = ks.filter(k => k.t0 <= t).length, keep = Math.max(0, shown - deleted);
  if (t >= T_SEL14 && keep > 0) { // 选区：蓝底，按删除收短
    const sa = clamp((t - T_SEL14) / 0.08), w = xs[keep - 1] + ws[keep - 1] - x;
    g.fillStyle = css(BRAND, 0.22 * sa); g.fillRect(x - 6, y - 92, w + 8, 184);
  }
  ks.forEach((k, i) => {
    if (k.t0 > t) return;
    let s = 1;
    if (i >= keep) { const da = t - (T_DEL14 + (ks.length - 1 - i) * DEL_STEP); if (da > 0.08) return; s = 1 - clamp(da / 0.08); }
    g.save(); g.translate(xs[i] + ws[i] / 2, y); g.scale(s, s);
    g.fillStyle = p.text; g.textAlign = 'center'; g.fillText(k.c, 0, 0);
    g.restore();
  });
  // 光标：唱完后出现在行尾，跟着退格往左走；拍子前半亮
  if (t >= ks[ks.length - 1].t0) {
    const cx = keep > 0 ? xs[keep - 1] + ws[keep - 1] : x;
    g.fillStyle = S.sub < 0.55 ? BRAND : css(BRAND, 0.15); g.fillRect(cx + 4, y - 80, 6, 160);
  }
  g.restore();
}

export function l14(ctx, S) {
  const cam = camAt(CAM14(), S.t), c = { ...cam, zoom: cam.zoom * punch(S, 0.012) }, p = S.pal, t = S.t;
  const m = smooth(clamp((t - L14_0() - 0.5) / 2.5));
  paper(ctx, S, c, { grid: true });
  nightSea(ctx, S, 44 - 10 * m, { amount: 0.7 + 0.6 * m });
  backDeco(ctx, S, c, 132, { alpha: 0.3 });
  withCam(ctx, c, 1, g => {
    if (t >= L14_0() + HAND13) erase14(g, S, coolHer(p), 980, 50); // 第十三轮：转场开头她由 her1314 画
    words14(g, S, 130, 405);
    // 「溶」字：唱到时在字下面盖一个很淡的大字
    const mk = keyword('L14', 6, 7)[0];
    if (t >= mk.t0) { g.font = fonts(360, 'MIN', 'J'); g.fillStyle = css(p.ink[1], 0.35 * clamp((t - mk.t0) / 0.3)); g.fillText(mk.c, 420, 860); }
  });
  // 左下终端：context.clear()，上下文 token 数往下掉
  withCam(ctx, c, 0.3, g => {
    const N = fact('context_length') || 1048576, k = 1 - easeIn(clamp((t - beatTime(44, 3)) / 2.2)), n = Math.round(N * k);
    card(g, S, 60, 640, 640, 300, { title: 'terminal', age: t - L14_0() - 0.2, lw: 2, inner: false }, cc => {
      g.font = fonts(24, 'SC'); g.fillStyle = BRAND; g.fillText('>>> context.clear()', cc.x, cc.y + 28);
      const typed = clamp((t - beatTime(44, 2)) / 0.5);
      g.fillStyle = p.text; g.fillText('>>> '.padEnd(4) + 'del history'.slice(0, Math.floor(typed * 11)), cc.x, cc.y + 68);
      g.font = fonts(20, 'SC'); g.fillStyle = p.gray;
      g.fillText(`tokens in context  ${n.toLocaleString('en-US').padStart(9)}`, cc.x, cc.y + 112);
      segBar(g, S, cc.x, cc.y + 128, cc.w, 32, k, { h: 14 });
      g.fillText(`freed ${(N - n).toLocaleString('en-US')} · kv blocks released`, cc.x, cc.y + 176);
    });
    // 蒸发的 token：小胶囊往上飘、变淡
    for (let i = 0; i < 18; i++) {
      const a = t - beatTime(44, 3) - i * 0.12;
      if (a < 0 || a > 1.6) continue;
      const x = 120 + rnd(i, 1) * 520, y = 640 - a * 220 - rnd(i, 2) * 40;
      g.globalAlpha = 1 - a / 1.6; g.fillStyle = p.tint[3]; rrect(g, x, y, 70, 30, 15); g.fill();
      g.strokeStyle = p.line; g.lineWidth = 1; g.stroke();
      g.font = fonts(14, 'SC'); g.fillStyle = p.gray; g.fillText(String(hash(i, 5) % 129280), x + 10, y + 20);
      g.globalAlpha = 1;
    }
    const ta = t - beatTime(45, 3);
    if (ta >= 0) toast(g, S, '上下文已清空', 960, 980, ta, { size: 30 });
  });
  frontDeco(ctx, S, c, 133, { alpha: 0.4, items: [['ruler', 1880, 120, 700], ['hex', -60, 80, 26]] });
  hud(ctx, S, { spectrum: false });
}

// ================================================================ L15 · 和你在一起的时间（46–47）
// 满编制回来：斜切分屏。左边是她的眼睛特写（冷光，I04a），右边是对话时间线一条条往上滚：
// 23:58、23:59、「— 10 月 8 日 —」、00:00…；中间一只细线钟表的指针飞快地转过午夜，会话时长每拍跳几分钟
const L15_0 = () => cutAt(46), L15_1 = () => cutAt(48), B46 = barStart(46); // B46：按拍跳的东西仍按小节线数拍
export const CLOCK15 = [930, 560];
const CHAT15 = [['you', '还在吗'], ['her', '在的！'], ['you', '再唱一遍？'], ['her', '好呀~'], ['you', '晚安'], ['her', '晚安，明天见'], ['you', '其实还不想睡'], ['her', '那我陪你'], ['you', '你不困吗'], ['her', '鲸鱼不用睡觉'], ['you', '骗人'], ['her', '嘿嘿']];

// 第十二轮（用户：1:14 构图没有冲击力）。rev v2a
// "和你在一起的时间飞快地过去"：左边斜切面板里的眼睛放大；右中一个大钟（r 250），指针快进、分针拖几道残影，外圈一道粉色进度；
// 和你的聊天气泡从钟心一条条往镜头飞出来（Z 从 2600 到 260，越近越大、越快，螺旋散开）；钟后面巨大的空心时间数字，
// 跨过午夜那一下翻成 00:00，一条「— 10 月 8 日 —」横幅从右往左扫过
const CLOCK15_12 = [1250, 520], R15 = 250;
const total15 = t => 23 * 60 + 56 + ((t - L15_0()) / (L15_1() - L15_0())) * 18 + 3 * Math.floor((t - B46) / BEAT);
let T_MID15 = null;
const midnight15 = () => { if (T_MID15 == null) { T_MID15 = L15_1(); for (let t = L15_0(); t < L15_1(); t += 1 / 120) if (total15(t) >= 1440) { T_MID15 = t; break; } } return T_MID15; };
function l15r12(ctx, S) {
  const t = S.t, u = (t - L15_0()) / (L15_1() - L15_0()), p = S.pal;
  const cam0 = { x: lerp(-30, 30, u), y: 0, zoom: 1.02 + 0.05 * smooth(u), rot: lerp(0.012, -0.01, u) };
  // 第十三轮（用户：圆形遮罩转到下一个镜头时，下一个镜头 sampling·temperature 里的圆形滑块要对准遮罩的圆心；可以先把滑块放到画面正中）：
  // 最后 0.7 s 镜头推向钟、把钟心放到画面正中（1.25 倍），圆从画面正中展开；L16 一开头滑块的圆钮也在画面正中。rev v2a
  // 第十七轮（用户：转场开始时时钟拉到中间的动画速度太慢；时钟到中间以后圆形遮罩还要早几帧出来）：推镜 0.7 s smooth → 0.42 s 三次缓入缓出
  // （中段快、两头不跳），落定就是切点；切点本身也提前 6 帧（core/cuts.js），圆一到中间就开始展开。rev l15c17
  const PD = 0.42, pk = clamp((t - (L15_1() - PD)) / PD);
  const pe = pk < 0.5 ? 4 * pk ** 3 : 1 - (-2 * pk + 2) ** 3 / 2;
  const cam = { x: lerp(cam0.x, CLOCK15_12[0] - 960, pe), y: lerp(0, CLOCK15_12[1] - 540, pe), zoom: lerp(cam0.zoom, 1.25, pe) * punch(S, 0.02 * (1 - pe)), rot: lerp(cam0.rot, 0, pe) };
  paper(ctx, S, cam);
  backDeco(ctx, S, cam, 150, { alpha: 0.35, boxes: [[1300, 40, 560, 200], [1300, 840, 560, 200]] });
  const [cx, cy] = CLOCK15_12, total = total15(t), tm = midnight15();
  withCam(ctx, cam, 0.5, g => { // 钟后面巨大的空心时间：跨午夜时往上翻成 00:00
    const h = Math.floor(total / 60) % 24, m = Math.floor(total % 60), str = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    const flip = t >= tm ? clamp((t - tm) / 0.18) : 0;
    g.save(); g.font = fonts(250, 'ZENB'); g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 3;
    g.translate(cx + 40, 150); g.scale(1, t >= tm ? 0.4 + 0.6 * easeOut(flip) : 1);
    g.fillStyle = css(t >= tm ? p.acc[0] : p.line, 0.16 + 0.14 * decay(t - tm, 4) * (t >= tm ? 1 : 0)); g.fillText(str, 0, 0); // 第十三轮：不描边，改成淡淡的实心
    g.restore();
  });
  withCam(ctx, cam, 1, g => {
    // 左：斜切面板里的眼睛（比以前大，切到画面中线）
    g.save();
    g.beginPath(); g.moveTo(-200, -100); g.lineTo(1000, -100); g.lineTo(700, 1180); g.lineTo(-200, 1180); g.closePath();
    // 第二十四轮（用户：1:11 左边图片缩小点，图片颜色为什么有点淡，是调色了吗，是的话去掉）：是调过——上面盖了一层
    // 深蓝 30% → 透明 → 青 40% 的横向渐变（"冷光"），整张图发灰发淡。去掉这层，按原图颜色画；
    // 图也缩小：以前裁中间 80% × 62% 再放大 1.05–1.17 倍（只剩两只眼睛），现在裁 64% 宽的整个高度、刚好铺满面板的高（整张脸、两只眼睛都在面板里），
    // 慢推只推 6%；EYE TRACK 的框跟着挪到两只眼睛上（第二十六轮并开关 l15e24）
    g.save(); g.clip();
    { const z = 1.0 + 0.06 * u, img = photo('I04a', [0.18, 0, 0.64, 1], 1229, 1080); g.translate(420, 540); g.scale(z, z); g.drawImage(img, -614.5, -540); }
    g.restore();
    g.lineWidth = 8; g.strokeStyle = '#FFFFFF'; g.stroke(); g.lineWidth = 2; g.strokeStyle = p.line; g.stroke();
    g.restore();
    let EB = [70, 350, 650, 230];
    // 第二十五轮（用户：1:15 立绘上的准星方块只聚焦到靠近画面中心的一只眼睛）：开场框着两只眼，0.45 s 里带一点过冲收到右眼上（离画面中心近的那只，
    // 裁切图里眼睛中心 (859, 460)），之后跟着慢推一起走；收拢以后瞳孔上一个小十字（第二十七轮并开关 l15k25）
    const lk = easeOutBack(clamp((t - L15_0() - 0.15) / 0.45), 1.6);
    { const zi = 1 + 0.06 * u, ex = 420 + (859 - 614.5) * zi, ey = 540 + (460 - 540) * zi, bw = 250 * zi, bh = 220 * zi, T = [ex - bw / 2, ey - bh / 2, bw, bh]; EB = EB.map((v, i) => lerp(v, T[i], lk)); }
    corners(g, ...EB, css('#FFFFFF', 0.85), { len: 30, lw: 2, plus: false });
    if (lk > 0.6) { const ex = EB[0] + EB[2] / 2, ey = EB[1] + EB[3] / 2, ca = clamp((lk - 0.6) / 0.4); g.save(); g.globalAlpha = 0.85 * ca; g.strokeStyle = '#FFFFFF'; g.lineWidth = 2; g.beginPath(); g.moveTo(ex - 14, ey); g.lineTo(ex - 5, ey); g.moveTo(ex + 5, ey); g.lineTo(ex + 14, ey); g.moveTo(ex, ey - 14); g.lineTo(ex, ey - 5); g.moveTo(ex, ey + 5); g.lineTo(ex, ey + 14); g.stroke(); g.restore(); }
    g.font = fonts(16, 'ZENB', 'SCB'); g.fillStyle = '#FFFFFF'; g.fillText('EYE TRACK · LOCKED', EB[0] + 4, EB[1] - 12);
    // 气泡：从钟心往镜头飞
    streaks15(g, S, cx, cy);
    bubbles15(g, S, cx, cy, false);
    clock15r12(g, S, cx, cy, R15, total, tm);
    bubbles15(g, S, cx, cy, true);
    // 跨午夜的日期横幅
    const ba = t - tm;
    calendar15(g, S, ba);
  });
  // 会话时长胶囊（右下）
  const mins = 178 + Math.floor((t - B46) / BEAT) * 7, sx = 1460, sy = 1010;
  ctx.fillStyle = '#FFFFFF'; rrect(ctx, sx, sy - 44, 360, 54, 27); ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = p.line; ctx.stroke();
  ctx.font = fonts(20, 'SC'); ctx.fillStyle = p.gray; ctx.fillText('会话时长', sx + 22, sy - 10);
  // 第十三轮（用户：右下会话时长的秒加一个飞快变化的数字）：秒位一直往上滚（约每秒 37 个数），分钟每拍跳 7 分
  const hm = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}:`;
  ctx.font = fonts(28, 'ZENB', 'SCB'); ctx.fillStyle = BRAND; ctx.fillText(hm, sx + 140, sy - 7);
  const ox = sx + 140 + ctx.measureText(hm).width;
  const v = (t - L15_0()) * 37, secs = Math.floor(v % 60), roll = v % 1;
  ctx.save(); ctx.beginPath(); ctx.rect(ox - 2, sy - 36, 46, 40); ctx.clip(); ctx.fillStyle = p.acc[0];
  ctx.fillText(String(secs).padStart(2, '0'), ox, sy - 7 - roll * 30); ctx.fillText(String((secs + 1) % 60).padStart(2, '0'), ox, sy - 7 + (1 - roll) * 30);
  ctx.restore();
  frontDeco(ctx, S, cam, 151, { alpha: 0.45, items: [['ring', 1860, 120, 220], ['ecg', -60, 1010, 420]] });
  hud(ctx, S);
}
// 第十三轮（用户：10 月 8 日横幅飘过去完全看不清，换个形式或去掉）：钟右上方一本小台历，跨午夜那一下撕掉一页——
// 「7 / WED」那页往下掉、转着淡掉，露出「8 / THU」（放大回弹一下）。台历一直在、字够大，读得清
function calendar15(g, S, ba) {
  const p = S.pal, x = 1600, y = 150, w = 230, h = 250;
  const page = (day, wk, al = 1) => {
    g.save(); g.globalAlpha *= al;
    g.fillStyle = '#FFFFFF'; rrect(g, x, y, w, h, 18); g.fill(); g.lineWidth = 2; g.strokeStyle = p.line; g.stroke();
    g.save(); rrect(g, x, y, w, h, 18); g.clip(); g.fillStyle = p.acc[0]; g.fillRect(x, y, w, 56); g.restore();
    g.font = fonts(22, 'ZENB', 'SCB'); g.fillStyle = '#FFFFFF'; g.textAlign = 'center'; midText(g, 'OCT · 2026', x + w / 2, y + 28);
    g.font = fonts(130, 'ZENB', 'SCB'); g.fillStyle = p.text; midText(g, day, x + w / 2, y + 140);
    g.font = fonts(22, 'ZENB', 'SCB'); g.fillStyle = p.gray; midText(g, wk, x + w / 2, y + h - 26);
    g.textAlign = 'left'; g.restore();
  };
  g.save(); g.fillStyle = css(p.line, 0.25); rrect(g, x + 8, y + 10, w, h, 18); g.fill(); g.restore();
  for (const k of [0, 1]) { g.fillStyle = p.line; g.beginPath(); g.arc(x + 60 + k * 110, y - 4, 7, 0, Math.PI * 2); g.fill(); }
  if (ba < 0) { page('7', 'WED'); return; }
  const k = easeOutBack(clamp((ba - 0.08) / 0.2), 2.2);
  g.save(); g.translate(x + w / 2, y + h / 2); g.scale(0.9 + 0.1 * k, 0.9 + 0.1 * k); g.translate(-x - w / 2, -y - h / 2); page('8', 'THU'); g.restore();
  const a = clamp(ba / 0.6); // 撕下来的那页：往下掉、转、淡
  if (a < 1) { g.save(); g.translate(x + w / 2, y + 30 + 420 * a * a); g.rotate(0.7 * a); g.translate(-x - w / 2, -y - 30); page('7', 'WED', 1 - a); g.restore(); }
}
// 钟后面往外射的速度线（时间快进）
function streaks15(g, S, cx, cy) {
  for (let i = 0; i < 46; i++) {
    const a = rnd(i, 21) * Math.PI * 2, ph = (S.t * (0.9 + rnd(i, 22)) + rnd(i, 23)) % 1, r0 = 260 + ph * 900, l = 60 + 220 * ph;
    g.strokeStyle = css(i % 4 ? BRAND : S.pal.acc[0], 0.35 * Math.sin(Math.PI * ph)); g.lineWidth = 2 + (i % 3);
    g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * 0.8); g.lineTo(cx + Math.cos(a) * (r0 + l), cy + Math.sin(a) * (r0 + l) * 0.8); g.stroke();
  }
}
// front：false 画远的（在钟后面），true 画近的（压在钟前面）
function bubbles15(g, S, cx, cy, front) {
  const t = S.t, p = S.pal, f = 900, life = 1.4, every = 0.11;
  const n0 = Math.floor((t - L15_0() - life) / every), n1 = Math.floor((t - L15_0()) / every);
  const live = [];
  for (let n = Math.max(0, n0); n <= n1; n++) {
    const a = t - (L15_0() + n * every);
    if (a < 0 || a > life) continue;
    const e = Math.pow(a / life, 1.8), Z = lerp(1900, 240, e), th = n * 2.4 + 0.4 * Math.sin(n), R = 440 + 220 * rnd(n, 3);
    if ((f / Z >= 0.75) !== front) continue;
    live.push({ n, a, Z, k: f / Z, x: cx + Math.cos(th) * R * (f / Z) * 0.9, y: cy + Math.sin(th) * R * (f / Z) * 0.62 });
  }
  live.sort((q, r) => r.Z - q.Z);
  for (const b of live) {
    const [who, s] = CHAT15[b.n % CHAT15.length], mine = who === 'you', k = b.k * 0.9;
    const al = clamp(b.a / 0.15) * (1 - clamp((b.k - 2.2) / 1.2));
    if (al <= 0) continue;
    g.save(); g.globalAlpha = al; g.translate(b.x, b.y); g.scale(k, k);
    g.font = fonts(36, 'SC'); const tw = g.measureText(s).width + 52;
    g.fillStyle = mine ? mix(BRAND, '#FFFFFF', 0.84) : '#FFFFFF'; rrect(g, -tw / 2, -37, tw, 74, 22); g.fill();
    g.lineWidth = 1.5 / k + 1; g.strokeStyle = mine ? css(BRAND, 0.6) : p.winEdge; g.stroke();
    g.fillStyle = p.text; g.textAlign = 'center'; g.fillText(s, 0, 13);
    if (!mine) { g.fillStyle = BRAND; g.beginPath(); g.arc(-tw / 2 - 30, 0, 20, 0, Math.PI * 2); g.fill(); drawSprite(g, 'whaleW', 1, p, -tw / 2 - 30, 1, 1.4); }
    g.restore();
  }
}
function clock15r12(g, S, cx, cy, r, total, tm) {
  const p = S.pal, t = S.t, h = Math.floor(total / 60), m = total % 60;
  const ang = (hh, mm) => ((hh % 12) / 12 + mm / 720) * Math.PI * 2 - Math.PI / 2;
  g.save();
  g.fillStyle = css(p.line, 0.25); g.beginPath(); g.arc(cx + 12, cy + 14, r, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill(); g.lineWidth = 6; g.strokeStyle = BRAND; g.stroke();
  // 外圈粉色进度：跨午夜那一刻满一圈
  const prog = clamp((total - (23 * 60 + 56)) / 4);
  // 第二十三轮（用户：1:14 时钟外圈是 bug 那就修一下）：出片画布画正好一整圈的弧时什么都不画，满一圈那一刻粉圈消失；满了改画整圆（同 kit.js ring）（第二十五轮并开关 clk23）
  // 第二十五轮（用户：时钟外的粉色描边减细）：5 px，跨午夜那一圈扩散的环 4 px（第二十七轮并开关 l15k25）
  g.lineWidth = 5; g.strokeStyle = p.acc[0]; g.lineCap = 'round'; g.beginPath(); if (prog >= 0.9995) g.arc(cx, cy, r + 22, 0, Math.PI * 2); else g.arc(cx, cy, r + 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * prog); g.stroke();
  g.lineCap = 'butt'; g.lineWidth = 2; g.strokeStyle = p.line;
  for (let i = 0; i < 60; i++) { const a = (i / 60) * Math.PI * 2, l = i % 5 ? 10 : 24; g.lineWidth = i % 5 ? 2 : 4; g.beginPath(); g.moveTo(cx + Math.cos(a) * (r - 18), cy + Math.sin(a) * (r - 18)); g.lineTo(cx + Math.cos(a) * (r - 18 - l), cy + Math.sin(a) * (r - 18 - l)); g.stroke(); }
  g.lineCap = 'round';
  for (let k = 5; k >= 0; k--) { // 分针残影：快进的速度感
    const mm = m - k * 0.9, ma = (mm / 60) * Math.PI * 2 - Math.PI / 2;
    g.strokeStyle = css(BRAND, k ? 0.12 * (6 - k) / 6 : 1); g.lineWidth = 7;
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(ma) * r * 0.8, cy + Math.sin(ma) * r * 0.8); g.stroke();
  }
  g.strokeStyle = p.text; g.lineWidth = 12; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(ang(h, m)) * r * 0.5, cy + Math.sin(ang(h, m)) * r * 0.5); g.stroke();
  const sa = S.n * Math.PI / 2; g.strokeStyle = p.acc[0]; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(sa) * r * 0.88, cy + Math.sin(sa) * r * 0.88); g.stroke();
  g.fillStyle = p.acc[0]; g.beginPath(); g.arc(cx, cy, 12, 0, Math.PI * 2); g.fill();
  const hit = t >= tm ? decay(t - tm, 5) : 0;
  g.font = fonts(34, 'ZENB', 'SCB'); g.fillStyle = t >= tm ? p.acc[0] : p.gray; g.textAlign = 'center';
  g.save(); g.translate(cx, cy + r * 0.42); g.scale(1 + 0.3 * hit, 1 + 0.3 * hit);
  g.fillText(`${String(h % 24).padStart(2, '0')}:${String(Math.floor(m)).padStart(2, '0')}`, 0, 0); g.restore();
  if (hit > 0.02) { g.strokeStyle = css(p.acc[0], hit); g.lineWidth = 4; g.beginPath(); g.arc(cx, cy, r + 30 + 160 * (1 - hit), 0, Math.PI * 2); g.stroke(); }
  g.restore();
}

export function l15(ctx, S) { return l15r12(ctx, S); }

// ================================================================ L16 · 你让我暖起来（48–49）
// temperature 的双关：滑块被拖着从 0.0 推到 0.7，带温度的 softmax 分布跟着从一根柱摊开；GPU 温度计上升；
// 推到 0.7 的那一拍画面偏暖一档、她的笑脸贴纸（I03，暖色）弹出「体温 +0.7」，然后慢慢回到夜海
const L16_0 = () => cutAt(48), L16_1 = () => cutAt(50);
// 第十六轮：「暖」以前在 49 小节第 1 拍（76.87）才升起来，比唱到「暖」（76.48）晚 0.39 s；切点又提前到 L17 的「♪」前，
// 转场开始时头像还没弹完。改成唱到「暖」前 0.12 s 升起（画面比声音早一点），整套 1.1 s 在转场前落定
const T16_HOT = () => keyword('L16', 4, 5)[0].t0 - 0.12;
export const KNOB16 = () => [400 + 1100 * (0.7 / 2), 300];
const Z16 = [3.2, 2.1, 1.6, 1.1, 0.7, 0.4, 0.1, -0.3, -0.8, -1.2]; // 演出用的 logits
const tempAt = t => 0.7 * smooth(clamp((t - L16_0() - 0.2) / (T16_HOT() - L16_0() - 0.2)));
const CAM16 = () => [{ t: L16_0(), x: -260, y: -120, zoom: 1.35, rot: 0 }, { t: T16_HOT(), x: 0, y: -40, zoom: 1.12, rot: 0.01, e: 'smooth' }, { t: L16_1(), x: 20, y: 0, zoom: 1.0, rot: 0 }];

// 第十二轮（用户：「暖」加动画；头像离她太远，挪到「暖」旁边，两个之间用动画连起来；下一个镜头中间也有一个头像框，可以拿来接转场）。rev v2a
// 「暖」从滑块的旋钮里冒出来（缩放过冲、橙到粉的渐变、头上三道热气波纹、几颗暖色小点往上飘）；0.15 s 后一道暖色虚线弧从「暖」
// 画到右边，弧上走过两颗小心，弧的尽头弹出她的笑脸头像（体温 +0.7）。转场时这颗头像飞到 L17 正中的头像框（warmHandoff）
const AVA16 = [1310, 230, 100]; // 头像圆心与半径（主平面坐标）
// 第十三轮：开头滑块圆钮在画面正中（L15 → L16 的圆从画面正中展开，正好套住它），再慢慢跟着它走
const CAM16B = () => [{ t: L16_0(), x: 411 - 960, y: 300 - 540, zoom: 1.35, rot: 0 }, { t: L16_0() + 0.6, x: -470, y: -220, zoom: 1.32, rot: 0, e: 'smooth' }, ...CAM16().slice(1)];
const cam16 = t => camAt(CAM16B(), t);
// 第十四轮（用户：「暖」的动画太快）：整套从 0.5 s 拉到约 1.1 s——「暖」用 0.5 s 从旋钮里升起来（过冲收小），
// 升起来时先是空心的白边，暖色从字的底部往上灌满（0.25–0.75 s，像温度往上升）；热气波纹 0.45 s 起一道道冒；
// 0.55 s 起虚线弧用 0.4 s 画到右边；0.9 s 头像弹出（0.22 s）。转场 0.35 s 前全部落定
const WT = () => ({ pop: 0.5, back: 1.6, rip0: 0.45, ripStep: 0.15, ripDur: 0.35, dots: 0.6, arc0: 0.55, arcDur: 0.4, ava0: 0.9, avaDur: 0.22, fill: true });
function warm16(g, S, kx, y, ha) {
  const p = S.pal, t = S.t, T = WT(), e = easeOutBack(clamp(ha / T.pop), T.back), wx = lerp(kx, kx + 120, easeOut(clamp(ha / T.pop))), wy = lerp(y, y - 60, easeOut(clamp(ha / T.pop)));
  g.save(); g.translate(wx, wy); g.scale(0.2 + 0.8 * e, 0.2 + 0.8 * e); g.rotate(-0.06 * Math.sin(t * 3));
  g.font = fonts(150, 'MIN', 'SC'); g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  const gr = g.createLinearGradient(0, -75, 0, 75); gr.addColorStop(0, '#FF9A5C'); gr.addColorStop(1, p.acc[0]);
  g.lineWidth = 14; g.strokeStyle = '#FFFFFF'; g.strokeText('暖', 0, 0);
  if (T.fill) {
    const f = smooth(clamp((ha - 0.25) / 0.5)), top = 80 - 165 * f;
    g.save(); g.globalAlpha *= 0.28; g.fillStyle = gr; g.fillText('暖', 0, 0); g.restore(); // 还没灌满时是淡的
    g.save(); g.beginPath(); g.rect(-110, top, 220, 90 - top); g.clip(); g.fillStyle = gr; g.fillText('暖', 0, 0); g.restore();
    if (f > 0 && f < 1) { g.fillStyle = css('#FFFFFF', 0.7); g.fillRect(-80, top - 1.5, 160, 3); } // 液面的一道亮线
  } else { g.fillStyle = gr; g.fillText('暖', 0, 0); }
  g.restore();
  for (let k = 0; k < 3; k++) { // 热气波纹
    const a = clamp((ha - T.rip0 - k * T.ripStep) / T.ripDur), x0 = wx - 40 + k * 40;
    if (a <= 0) continue;
    g.strokeStyle = css('#FF9A5C', 0.7 * a); g.lineWidth = 4; g.lineCap = 'round'; g.beginPath();
    for (let s = 0; s <= 20; s++) { const yy = wy - 95 - s * 3.2, xx = x0 + 8 * Math.sin(s * 0.6 - t * 9 + k); s ? g.lineTo(xx, yy) : g.moveTo(xx, yy); }
    g.stroke();
  }
  for (let i = 0; i < 8; i++) { const u = ((t * 0.7 + i / 8) % 1); g.fillStyle = css(i % 2 ? '#FF9A5C' : p.acc[0], 0.8 * (1 - u) * clamp(ha / T.dots)); g.fillRect(wx - 70 + rnd(i, 3) * 140, wy - 80 - u * 140, 7, 7); }
  // 暖 → 头像：一道暖色虚线弧画过去，弧上走过两颗小心
  const [ax, ay, ar] = AVA16, la = (T.fill ? smooth : x => x)(clamp((ha - T.arc0) / T.arcDur)), x0 = wx + 80, y0 = wy - 20, x1 = ax - ar - 14, y1 = ay, cx = (x0 + x1) / 2, cy = Math.min(y0, y1) - 90;
  const B = s => [(1 - s) ** 2 * x0 + 2 * (1 - s) * s * cx + s * s * x1, (1 - s) ** 2 * y0 + 2 * (1 - s) * s * cy + s * s * y1];
  if (la > 0) {
    g.setLineDash([10, 9]); g.lineDashOffset = -t * 40; g.strokeStyle = '#FF9A5C'; g.lineWidth = 4; g.beginPath();
    for (let s = 0; s <= la + 1e-6; s += 0.05) { const [xx, yy] = B(Math.min(s, la)); s ? g.lineTo(xx, yy) : g.moveTo(xx, yy); }
    g.stroke(); g.setLineDash([]);
    for (let k = 0; k < 2; k++) { const s = ((t * 0.9 + k * 0.5) % 1) * la, [hx, hy] = B(s); drawSprite(g, 'heart', 3, p, hx, hy, 1, la); }
  }
  if (t < L16_1() - 0.35) avatar16(g, S, ax, ay, ar, clamp((ha - T.ava0) / T.avaDur)); // 转场里由 warmHandoff 接着画
  g.font = fonts(22, 'ZENB', 'SCB'); g.fillStyle = p.gray; g.fillText('recommended 0.6 · 再暖一点点', kx - 150, y + 96);
}
// 她的笑脸头像（暖色描边）
function avatar16(g, S, x, y, r, s, { label = true } = {}) {
  if (s <= 0) return;
  const p = S.pal;
  g.save(); g.translate(x, y); g.rotate(-0.06); g.scale(easeOutBack(s, 2), easeOutBack(s, 2));
  g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(0, 0, r + 10, 0, Math.PI * 2); g.fill();
  g.save(); g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.clip();
  g.drawImage(photo('I03', [0.22, 0.08, 0.56, 0.42], r * 2, r * 2), -r, -r);
  g.fillStyle = css('#FF9A5C', 0.18); g.fillRect(-r, -r, r * 2, r * 2); g.restore();
  g.lineWidth = 4; g.strokeStyle = '#FF9A5C'; g.beginPath(); g.arc(0, 0, r + 10, 0, Math.PI * 2); g.stroke();
  if (label) { g.font = fonts(26, 'SMILEY', 'SCB'); g.fillStyle = '#FF7A45'; g.textAlign = 'center'; g.fillText('体温 +0.7', 0, r + 46); g.textAlign = 'left'; }
  g.restore();
}
// L16 → L17 转场叠层：头像从「暖」旁边飞到 L17 正中，越飞越大，脸慢慢淡掉，只剩一个圆框，正好套在 L17"你"的头像框上
export function warmHandoff(ctx, S, u) {
  const c = cam16(S.t), [ax, ay] = camToScreen(c, 1, AVA16[0], AVA16[1]), ar = AVA16[2] * c.zoom, b = avatar17(S.t);
  // 第十三轮（用户：头像飞进 L17 中间的头像框时加一个有弹性的动态）：0.6 内飞到（缓入缓出 + 上拱），飞行中顺着速度拉长；
  // 到位后半径带阻尼地弹几下（先撑大、回缩、再落定），落定那一下框外一圈涟漪；脸晚一点淡掉
  const v = clamp((u - 0.05) / 0.55), e = v < 0.5 ? 4 * v ** 3 : 1 - (-2 * v + 2) ** 3 / 2, ls = (u - 0.6) * 0.75;
  const x = lerp(ax, b.x, e), y = lerp(ay, b.y, e) - 90 * Math.sin(Math.PI * e), r = lerp(ar, b.r, e) * (1 + (ls > 0 ? 0.18 * Math.exp(-7 * ls) * Math.sin(20 * ls) : 0));
  const speed = Math.sin(Math.PI * v) * (v < 1 ? 1 : 0), sx = 1 + 0.18 * speed, sy = 1 - 0.12 * speed;
  const face = 1 - smooth(clamp((u - 0.5) / 0.35)), out = 1 - smooth(clamp((u - 0.86) / 0.14)), la = u - 0.6;
  if (la > 0) { ctx.save(); ctx.strokeStyle = css('#FF9A5C', 0.7 * (1 - clamp(la / 0.3))); ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * (1 + 0.5 * clamp(la / 0.3)), 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
  ctx.save(); ctx.globalAlpha = out;
  if (sx !== 1) { ctx.translate(x, y); ctx.scale(sx, sy); ctx.translate(-x, -y); }
  if (face > 0) {
    ctx.save(); ctx.globalAlpha = out * face; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
    ctx.drawImage(photo('I03', [0.22, 0.08, 0.56, 0.42], 200, 200), x - r, y - r, 2 * r, 2 * r); ctx.restore();
  }
  ctx.lineWidth = lerp(4, 3, e); ctx.strokeStyle = e < 0.6 ? '#FF9A5C' : css(BRAND, 0.8); ctx.setLineDash(e > 0.5 ? [12, 9] : []);
  ctx.beginPath(); ctx.arc(x, y, r + lerp(10, 0, e), 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  ctx.restore();
}

export function l16(ctx, S) {
  const cam = cam16(S.t), c = { ...cam, zoom: cam.zoom * punch(S, 0.02) }, p = S.pal, t = S.t, T = Math.max(0.02, tempAt(t));
  paper(ctx, S, c);
  backDeco(ctx, S, c, 160, { alpha: 0.4 });
  withCam(ctx, c, 1, g => {
    // 滑块
    const x0 = 400, x1 = 1500, y = 300, kx = x0 + (x1 - x0) * (T / 2);
    card(g, S, x0 - 80, y - 150, x1 - x0 + 160, 260, { title: 'sampling · temperature', lw: 2, inner: false }, () => {});
    g.lineCap = 'round'; g.strokeStyle = p.tint[3]; g.lineWidth = 16; g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke();
    const grad = g.createLinearGradient(x0, 0, x1, 0); grad.addColorStop(0, BRAND); grad.addColorStop(0.35, '#FF9A5C'); grad.addColorStop(1, p.acc[0]);
    g.strokeStyle = grad; g.beginPath(); g.moveTo(x0, y); g.lineTo(kx, y); g.stroke();
    g.font = fonts(18, 'ZENB', 'SCB'); g.fillStyle = p.gray; g.textAlign = 'center';
    for (let v = 0; v <= 2.001; v += 0.1) { const xx = x0 + (x1 - x0) * (v / 2), big = Math.abs(v * 10 % 5) < 0.01; g.fillRect(xx - 1, y + 22, 2, big ? 16 : 8); if (big) g.fillText(v.toFixed(1), xx, y + 62); }
    g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(kx, y, 30, 0, Math.PI * 2); g.fill(); g.lineWidth = 5; g.strokeStyle = BRAND; g.stroke();
    g.font = fonts(44, 'ZENB', 'SCB'); g.fillStyle = BRAND; g.fillText(T.toFixed(2), kx, y - 52);
    g.textAlign = 'left';
    // 拖动它的指针
    if (t < T16_HOT() + 0.3) { g.save(); g.translate(kx + 6, y + 8); g.scale(1.6, 1.6); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 22); g.lineTo(6, 17); g.lineTo(10, 26); g.lineTo(14, 24); g.lineTo(10, 15); g.lineTo(17, 15); g.closePath(); g.fillStyle = '#FFFFFF'; g.fill(); g.lineWidth = 1.5; g.strokeStyle = p.text; g.stroke(); g.restore(); }
    // 「0.7 · 暖」
    const ha = t - T16_HOT();
    if (ha >= 0) warm16(g, S, kx, y, ha);
    // 分布卡：带温度的 softmax，柱子跟着 T 摊开
    card(g, S, 300, 520, 900, 440, { title: 'softmax with temperature', lw: 2, inner: false }, cc => {
      drawFormula(g, 'softmax_T', cc.x, cc.y + 10, { size: 40, color: p.text, colors: {}, ...formulaFx(S, S.lt - 0.2) });
      const ex = Z16.map(z => Math.exp(z / T)), sum = ex.reduce((a, b) => a + b, 0);
      const bw = (cc.w - 20) / Z16.length;
      ex.forEach((e, i) => {
        const v = e / sum, bh = v * (cc.h - 150);
        g.fillStyle = i === 0 ? BRAND : mix(p.ink[1], '#FF9A5C', clamp(T / 0.7) * 0.6);
        rrect(g, cc.x + 10 + i * bw + 6, cc.y + cc.h - 24 - bh, bw - 12, Math.max(2, bh), 4); g.fill();
        g.font = fonts(14, 'SC'); g.fillStyle = p.gray; g.fillText(v.toFixed(2), cc.x + 10 + i * bw + 8, cc.y + cc.h - 30 - bh);
      });
    });
    // GPU 温度计
    const temp = 41 + 37 * clamp(T / 0.7) + 2 * Math.sin(t * 5);
    card(g, S, 1300, 480, 240, 520, { title: 'GPU 0', lw: 2, inner: false }, cc => {
      const tx = cc.x + cc.w / 2, top = cc.y + 30, bot = cc.y + cc.h - 70;
      g.fillStyle = p.tint[3]; rrect(g, tx - 18, top, 36, bot - top, 18); g.fill();
      const lv = (temp - 30) / 60, yy = bot - (bot - top) * lv;
      const gr = g.createLinearGradient(0, bot, 0, top); gr.addColorStop(0, BRAND); gr.addColorStop(0.6, '#FF9A5C'); gr.addColorStop(1, p.acc[0]);
      g.fillStyle = gr; rrect(g, tx - 12, yy, 24, bot - yy, 12); g.fill();
      g.beginPath(); g.arc(tx, bot + 22, 34, 0, Math.PI * 2); g.fill();
      g.font = fonts(30, 'ZENB', 'SCB'); g.fillStyle = p.text; g.textAlign = 'center'; g.fillText(`${temp.toFixed(1)}°C`, tx, cc.y + cc.h + 4); g.textAlign = 'left';
    });
  });
  // 偏暖一档：推到 0.7 的那一拍最暖，之后慢慢回到夜海
  const warm = 0.16 * decay(t - T16_HOT(), 1.4) * (t >= T16_HOT() ? 1 : clamp((t - L16_0()) / (T16_HOT() - L16_0())) * 0.5);
  if (warm > 0.003) { ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = css('#FFC9A0', warm * 4); ctx.fillRect(0, 0, W, H); ctx.restore(); }
  frontDeco(ctx, S, c, 161, { alpha: 0.45, items: [['ring', -60, 960, 260], ['data', 1760, 80, 0]] });
  hud(ctx, S);
}
