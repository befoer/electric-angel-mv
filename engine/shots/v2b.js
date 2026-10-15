// 第二段（御姐音 · 夜海）L17–L20（50–57 小节，1:18.47–1:31.27），视觉方案 §5.4，第七轮实现
import { W, H, BRAND, BEAT, STEP, CW, CH } from '../core/const.js';
import { barStart, beatTime, clamp, lerp, smooth, easeIn, easeOut, easeOutBack, decay } from '../core/time.js';
import { cutAt } from '../core/cuts.js';
import { hash, rnd, vnoise } from '../core/rand.js';
import { font, fonts, glyphs, midText } from '../core/glyphs.js';
import { fact, keyword } from '../core/data.js';
import { photo, glyphArt, aspectOf, ANCHOR } from '../core/portrait.js';
import { hasMask, maskIndex, maskCells, maskInfo } from '../core/masks.js';
import { newCanvas } from '../core/env.js';
import { rev } from '../rev.js';
import { camAt, withCam, pooled, camToScreen, drawPersp, softCopy } from '../core/cam.js';
import { hud } from '../core/hud.js';
import { card, ring, stamp, corners, hatch, warn, silhouette, leader } from '../core/kit.js';
import { drawFormula } from '../core/math.js';
import { drawSprite } from '../core/sprites.js';
import { ringScanner, segBar, targetLock, tag, dataColumn } from '../core/hudkit.js';
import { css, mix } from '../core/color.js';
import { rrect } from '../core/ui.js';
import { shake } from '../core/fx.js';
import { paper, backDeco, frontDeco, punch, chatWin, bigLine, formulaFx } from './scene.js';

// 第十二轮（用户：1:19–1:28 的一组意见）

// ================================================================ L17 · 一个人什么都做不出来（50–51）
// 空输入框，光标一直闪；终端一遍遍报错 generate(): prompt is empty；生成流水线的每一站都是灰的；
// 进度条停在 0%「即将开始…」，旁边一张梗卡：只要保持"即将开始"，任务启动率就是 100%。背景里一个很淡的空心大字「♪」
// 第十六轮：镜头的起止跟着切点走（core/cuts.js，画帧时取）
const L17_0 = () => cutAt(50), L17_1 = () => cutAt(52);
export function input17Rect() { // L18 从输入框推进去（屏幕坐标）
  const c = camAt(CAM17_9(), L17_1() - 1 / 60), r = INPUT17_9;
  const [x0, y0] = camToScreen(c, 1, r[0], r[1]), [x1, y1] = camToScreen(c, 1, r[0] + r[2], r[1] + r[3]);
  return [x0, y0, x1 - x0, y1 - y0];
}

// 第九轮（用户：「一♪」改成 DeepSeek 的视角，不是用户的视角）。rev l17
// 她从屏幕里面往外看：视野四角是她的取景框，中间本该是"你"的位置只有一个虚线的人形，她的锁定框一次次去锁、一次次"NOT FOUND"；
// 左边是她这一侧的 input_ids：只有一个 <bos>，后面全是空格子（prompt_tokens 0）；右边是她下一个 token 的分布——
// 没有任何输入可以依靠，所以是一片完全平的均匀分布（熵 = ln|V|，最大）：一个人什么都选不出来。
// 下面是她这一侧的输入槽，光标在等你的消息；L18 从这里推进去
const INPUT17_9 = [560, 800, 800, 92];
const CAM17_9 = () => [{ t: L17_0(), x: 0, y: -20, zoom: 1.0, rot: 0 }, { t: L17_1(), x: 0, y: 260, zoom: 1.3, rot: 0, e: 'in' }];
const LOCKS17 = [beatTime(50, 2), beatTime(50, 4), beatTime(51, 2)];
// 第十三轮：L17 最后打进输入框的字（每 0.12 s 一个），和转场的时长
const SLIDE17 = 0.35, MSG17 = '唱首歌吧';
const TYPED17 = t => { const n = Math.floor((t - (L17_1() - 0.9)) / 0.12) + 1; return n <= 0 ? '' : [...MSG17].slice(0, Math.min(4, n)).join(''); };
// 转场叠层：输入框不跟着画布往下走，留在画面里，变形成 L18 那条用户消息（框变短变高、底色变浅蓝、字变大，右边弹出你的头像）
export function box1718(ctx, S, u, e) {
  const p = S.pal, t0 = L17_1() - SLIDE17, c0 = camAt(CAM17_9(), t0), [ix, iy, iw, ih] = INPUT17_9;
  const [ax0, ay0] = camToScreen(c0, 1, ix, iy), [ax1, ay1] = camToScreen(c0, 1, ix + iw, iy + ih);
  const c1 = cam18(L18_0() + SLIDE17), bx = bubbleX18(), B = BUB18(), tw = bubW18();
  const [bx0, by0] = camToScreen(c1, 1, bx - tw, 470 - B.h / 2), [bx1, by1] = camToScreen(c1, 1, bx, 470 + B.h / 2), [avx, avy] = camToScreen(c1, 1, bx + 46, 470);
  const k = smooth(clamp((u - 0.2) / 0.7)), dy = 0; // 先停在原地（A 往上走开），再去 L18 的位置
  const x0 = lerp(ax0, bx0, k), y0 = lerp(ay0, by0, k), x1 = lerp(ax1, bx1, k), y1 = lerp(ay1, by1, k), r = lerp(22 * c0.zoom, B.r * c1.zoom, k);
  ctx.fillStyle = mix('#FFFFFF', mix(BRAND, '#FFFFFF', 0.84), k); rrect(ctx, x0, y0 + dy, x1 - x0, y1 - y0, r); ctx.fill();
  ctx.lineWidth = lerp(2.5, 2, k); ctx.strokeStyle = css(BRAND, lerp(1, 0.5, k)); ctx.stroke();
  const fs = lerp(26 * c0.zoom, B.fs * c1.zoom, k);
  ctx.font = fonts(fs, 'SC'); ctx.fillStyle = p.text; midText(ctx, MSG17, lerp(x0 + 40 * c0.zoom, x0 + B.pad * c1.zoom, k), (y0 + y1) / 2 + dy);
  const as = easeOutBack(clamp((u - 0.7) / 0.2), 2.2), ar = 34 * c1.zoom * as;
  if (as > 0) {
    ctx.save(); ctx.translate(avx, avy);
    ctx.fillStyle = p.tint[0]; ctx.beginPath(); ctx.arc(0, 0, ar, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, rev('l18a27') >= 27 ? ar : ar * 0.94, 0, Math.PI * 2); ctx.clip(); // 第二十七轮：裁到外圈描边底下，不留缝（见 l18）
    ctx.fillStyle = p.acc[0]; ctx.beginPath(); ctx.arc(0, -ar * 0.24, ar * 0.35, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.ellipse(0, ar * 0.76, ar * 0.65, ar * 0.47, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore(); ctx.lineWidth = 3; ctx.strokeStyle = p.acc[0]; ctx.beginPath(); ctx.arc(0, 0, ar, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
}
// 第十五轮（用户：1:23 输入框「唱首歌吧」缩小到和旁边的头像一样大，用最大圆角）：气泡高 100 → 68（= 头像直径），
// 圆角 = 半高（胶囊），字 58 → 34 px，左右各留 28
const BUB18 = () => ({ fs: 34, h: 68, r: 34, pad: 28 });
const bubW18 = () => { const B = BUB18(), m = newCanvasCtx(); m.font = fonts(B.fs, 'SC'); return m.measureText(MSG17).width + 2 * B.pad; };
let MCTX = null;
const newCanvasCtx = () => (MCTX ??= pooled('v2bmeasure', 8, 8).getContext('2d'));
// 第十三轮（用户：开头左边「唱首歌吧」太靠右，往左挪到你的头像右沿和下面 received 窗口的右沿对齐）：
// 按 L18 开头（转场结束那一刻）的相机解出气泡的 x：头像右沿（深度 1）= received 卡右沿（深度 0.3）
let BX18 = null;
function bubbleX18() {
  if (BX18 != null) return BX18;
  const c = cam18(L18_0() + SLIDE17), [cardR] = camToScreen(c, 0.3, 60 + 520, 700), [x560] = camToScreen(c, 1, 560 + 80, 470), [x660] = camToScreen(c, 1, 660 + 80, 470);
  BX18 = 560 + ((cardR - x560) / (x660 - x560)) * 100;
  return BX18;
}
// 中间"你"的头像框（扫描环）在屏幕上的圆：L16 → L17 的转场里她的头像飞到这里（第十二轮）
export function avatar17(t) { const c = camAt(CAM17_9(), t), [x, y] = camToScreen(c, 1, 960, 430); return { x, y, r: 236 * c.zoom }; }
function l17r9(ctx, S) {
  const cam = camAt(CAM17_9(), S.t), c = { ...cam, zoom: cam.zoom * punch(S, 0.012) }, p = S.pal, t = S.t, a = t - L17_0();
  paper(ctx, S, c);
  const nm = keyword('L17', 5, 7);
  withCam(ctx, c, 0.5, g => {
    g.font = fonts(520, 'MIN', 'J'); g.lineWidth = 2; g.strokeStyle = css(p.line, 0.3); g.textBaseline = 'middle';
    nm.forEach((k, i) => { if (t >= k.t0) g.strokeText(k.c, 420 + i * 560, 560); });
    g.textBaseline = 'alphabetic';
  });
  backDeco(ctx, S, c, 170, { alpha: 0.25 });
  withCam(ctx, c, 1, g => {
    // 中间：你本该在的位置——虚线人形 + 扫描环 + 一次次落空的锁定
    const ux = 960, uy = 430;
    // 第十二轮（用户：中间的圆里加一层很淡的半透明粉色，透明度呼吸）。rev v2b
    { const br = 0.05 + 0.04 * (0.5 + 0.5 * Math.sin((S.n * Math.PI) / 2)); g.fillStyle = css(p.acc[0], br); g.beginPath(); g.arc(ux, uy, 236, 0, Math.PI * 2); g.fill(); }
    ringScanner(g, S, ux, uy, 250, { alpha: 0.55, seed: 17 });
    const sil = () => { g.beginPath(); g.arc(ux, uy - 70, 66, 0, Math.PI * 2); g.moveTo(ux + 150, uy + 120); g.ellipse(ux, uy + 120, 150, 110, 0, 0, Math.PI, true); g.closePath(); };
    sil(); g.fillStyle = css(p.tint[3], 0.55); g.fill();
    g.setLineDash([12, 9]); g.lineDashOffset = -a * 30; g.lineWidth = 4; g.strokeStyle = css(BRAND, 0.65); sil(); g.stroke();
    g.setLineDash([]); g.lineDashOffset = 0;
    g.font = fonts(22, 'SC'); g.fillStyle = p.gray; g.textAlign = 'center';
    g.fillText('user · 未连接', ux, uy + 290); // 第十二轮：放到锁定框和扫描环下面，不再压着框线
    LOCKS17.forEach((lt, i) => {
      const la = t - lt;
      if (la < 0 || la > 0.75) return;
      targetLock(g, S, ux, uy, 330, la, { label: `SEARCH ${i + 1}/3`, color: BRAND, alpha: 1 - clamp((la - 0.55) / 0.2), labelAt: 'in' }); // 第十二轮：标签挪到框的右上角上方
      if (la > 0.3) { g.save(); g.globalAlpha = 1 - clamp((la - 0.55) / 0.2); tag(g, S, ux - 70, uy - 236, 'NOT FOUND', { color: p.acc[0], fill: p.acc[0], size: 22 }); g.restore(); }
    });
    g.textAlign = 'left';
    // 上：生成流水线全灰，第一站 prompt 打叉（同第八轮）
    const st = ['prompt', 'tokenize', 'prefill', 'decode', '♪'], py = 120;
    st.forEach((s, i) => {
      const x = 560 + i * 200;
      g.setLineDash(i ? [6, 6] : []); g.lineWidth = 1.5; g.strokeStyle = i ? css(p.line, 0.5) : p.acc[0];
      rrect(g, x - 70, py - 26, 140, 52, 26); g.stroke(); g.setLineDash([]);
      g.font = fonts(20, 'SC'); g.fillStyle = i ? p.gray : p.acc[0]; g.textAlign = 'center'; g.fillText(s, x, py + 7);
      if (i < 4) { g.strokeStyle = css(p.line, 0.4); g.beginPath(); g.moveTo(x + 72, py); g.lineTo(x + 128, py); g.stroke(); }
    });
    g.textAlign = 'left';
    // 下：她这一侧的输入槽，光标在等
    const [ix, iy, iw, ih] = INPUT17_9, blink = Math.floor(a / (BEAT / 2)) % 2 === 0;
    // 第十三轮（用户：转到下一个镜头时，先在「等待你的消息」这个输入框里打进「唱首歌吧」，再让这个输入框变成下一个镜头里「唱首歌吧」那条用户消息；
    // 其他元素照旧往下移，这条消息一直留在画面里）：最后 0.9 s 一个字一个字打进去；转场开始后输入框交给 box1718 画。rev v2b
    const typed = TYPED17(t);
    if (t < L17_1() - SLIDE17) {
      g.fillStyle = '#FFFFFF'; rrect(g, ix, iy, iw, ih, 22); g.fill();
      g.lineWidth = typed ? 2.5 : 1.5; g.strokeStyle = BRAND; g.stroke();
      g.font = fonts(15, 'ZENB', 'SCB'); g.fillStyle = BRAND; g.fillText('stdin', ix + 22, iy - 12);
      g.font = fonts(26, 'SC');
      if (typed) { g.fillStyle = p.text; g.fillText(typed, ix + 40, iy + ih / 2 + 9); }
      else { g.fillStyle = css(p.gray, 0.8); g.fillText('等待你的消息', ix + 40, iy + ih / 2 + 9); }
      if (blink || typed) { g.fillStyle = BRAND; g.fillRect(ix + 40 + (typed ? g.measureText(typed).width + 6 : -10), iy + 26, 3, ih - 52); }
    }
  });
  withCam(ctx, c, 0.35, g => {
    // 左：input_ids 只有 <bos>
    card(g, S, 96, 230, 400, 300, { title: 'input_ids', lw: 2, inner: false, age: a - 0.2 }, cc => {
      const bw = 82, bh = 52;
      for (let k = 0; k < 8; k++) {
        const x = cc.x + (k % 4) * (bw + 12), y = cc.y + 20 + Math.floor(k / 4) * (bh + 14);
        if (k === 0) { g.fillStyle = p.tint[3]; rrect(g, x, y, bw, bh, 10); g.fill(); g.strokeStyle = BRAND; g.lineWidth = 1.5; g.stroke(); g.font = fonts(17, 'ZENB'); g.fillStyle = BRAND; g.fillText('<bos>', x + 12, y + 32); continue; }
        g.setLineDash([5, 5]); g.strokeStyle = css(p.line, 0.55); g.lineWidth = 1.5; rrect(g, x, y, bw, bh, 10); g.stroke(); g.setLineDash([]);
      }
      g.font = fonts(20, 'ZENB', 'SCB'); g.fillStyle = p.gray; g.fillText('prompt_tokens', cc.x, cc.y + cc.h - 20);
      g.font = fonts(44, 'ZENB'); g.fillStyle = p.acc[0]; g.fillText('0', cc.x + 190, cc.y + cc.h - 14);
    });
    // 右：下一个 token 的分布——完全平
    const V = fact('vocab_size') || 129280;
    card(g, S, 1424, 230, 400, 300, { title: 'next token', lw: 2, inner: false, age: a - 0.35 }, cc => {
      const n = 24, bw = cc.w / n, base = cc.y + cc.h - 70, h = 70;
      for (let k = 0; k < n; k++) { g.fillStyle = k % 2 ? css(BRAND, 0.55) : css(p.ink[2], 0.55); g.fillRect(cc.x + k * bw + 2, base - h, bw - 4, h); }
      g.strokeStyle = p.acc[0]; g.setLineDash([6, 5]); g.lineWidth = 1.5; g.beginPath(); g.moveTo(cc.x, base - h - 8); g.lineTo(cc.x + cc.w, base - h - 8); g.stroke(); g.setLineDash([]);
      g.font = fonts(20, 'ZENB', 'SCB'); g.fillStyle = p.text; g.fillText(`p = 1 / ${V.toLocaleString('en-US')}`, cc.x, cc.y + 34);
      g.font = fonts(18, 'SC'); g.fillStyle = p.gray; g.fillText(`H = ln |V| ≈ ${Math.log(V).toFixed(2)} · 选不出来`, cc.x, cc.y + cc.h - 22);
    });
    // 左下：梗卡（同第八轮，挪进安全边距）
    const ma = t - beatTime(51, 1);
    if (ma >= 0) {
      card(g, S, 96, 600, 400, 190, { title: '鲸鱼娘的效率学', fill: p.tint[1], lw: 2, inner: false, age: ma, rot: -0.03 }, cc => {
        g.font = fonts(22, 'SMILEY', 'SC'); g.fillStyle = p.text;
        g.fillText('只要保持"即将开始"，', cc.x, cc.y + 30); g.fillText('任务启动率就是', cc.x, cc.y + 68);
        g.font = fonts(44, 'ZENB', 'SCB'); g.fillStyle = p.acc[0]; g.fillText('100%', cc.x + 180, cc.y + 82);
      });
      stamp(g, S, 'TRUE', 440, 630, 28, ma - 0.15, { rot: 0.18 });
    }
  });
  // 她的视野：四角大取景框 + 左上 POV 标签
  ctx.save();
  ctx.strokeStyle = css(BRAND, 0.55); ctx.lineWidth = 3;
  const m = 72, L = 70;
  ctx.beginPath();
  for (const [x, y, sx, sy] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]]) { ctx.moveTo(x, y + sy * L); ctx.lineTo(x, y); ctx.lineTo(x + sx * L, y); }
  ctx.stroke();
  ctx.restore();
  tag(ctx, S, m + 10, m + 16, 'DS-01 · POV', { color: BRAND, size: 16 });
  frontDeco(ctx, S, c, 171, { alpha: 0.35, items: [['ruler', 1880, 100, 760]] });
  hud(ctx, S, { spectrum: false });
}

export function l17(ctx, S) { return l17r9(ctx, S); }

// ================================================================ L18 · 你给了我歌（52–53）
// 推进输入框：你的消息「唱首歌吧」（前奏的那一句）出现、发送；它的字一变十、十变百，像一条河从气泡流向她（I03 伸手）；
// 唱到「歌」时，河里的字在她手边聚成一个大字「歌」
// 第十五轮：L18 → L19 的切点提前到「♪」前（core/cuts.js，画帧时取）
const L18_0 = () => cutAt(52), L18_1 = () => cutAt(54), T18_HAND = () => cutAt(54) - 0.4;
// 第十二轮（用户：她手上那个「歌」不搭）：不再是压在她脸上的大字，改成手掌上方浮着的一个小光球——白色光晕里一个像素「歌」，
// 随拍上下浮、光环往外扩；锁定框小一圈，「GIFT · 1 SONG」放进框里右上角
const GIFT18 = [1060, 395];
function gift18(g, S, k, ka) {
  const p = S.pal, [x, y0] = GIFT18, s = easeOutBack(clamp(ka / 0.22), 2), y = y0 - 10 * Math.sin(S.t * 3.2), kick = decay(S.sub * BEAT, 7);
  const halo = g.createRadialGradient(x, y, 10, x, y, 150); halo.addColorStop(0, css('#FFFFFF', 0.95)); halo.addColorStop(0.55, css('#FFE3F0', 0.55)); halo.addColorStop(1, css('#FFE3F0', 0));
  g.save(); g.translate(x, y); g.scale(s, s); g.translate(-x, -y);
  g.fillStyle = halo; g.beginPath(); g.arc(x, y, 150, 0, Math.PI * 2); g.fill();
  g.strokeStyle = css(p.acc[0], 0.6 * kick); g.lineWidth = 3; g.beginPath(); g.arc(x, y, 90 + 70 * (1 - kick), 0, Math.PI * 2); g.stroke();
  g.font = fonts(150, 'DOT', 'J'); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = BRAND; g.fillText(k.c, x, y + 6);
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  for (let i = 0; i < 6; i++) { const a = S.t * 1.4 + i * 1.05, r = 120 + 12 * Math.sin(S.t * 2 + i); drawSprite(g, i % 2 ? 'note' : 'heart', 3, p, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.6, 0.9, 0.85); }
  g.restore();
  targetLock(g, S, x, y, 280, ka - 0.1, { label: 'GIFT · 1 SONG', color: p.acc[0], labelAt: 'in' });
}
const RIVER = [[300, 470], [700, 260], [900, 820], [1168, 500]]; // 三次贝塞尔：气泡 → 她伸出的手（第八轮：I05）
// 第十二轮（用户：「唱首歌吧」太靠左、出画了）：气泡往右挪 260，河的起点跟着挪
const RIVER12 = [[560, 470], [860, 250], [960, 820], [1168, 500]];
// 第十八轮（I05 换成最终精度的大图，rev img18）：她按真图的宽高比放（以前写死 1080×1920，新图 2254×3780 更宽，按宽塞进旧框里人就缩小、往下掉 28 px），
// 河的终点改到新图里量的掌心（以前的 [1168, 500] 是旧图的指尖附近）
const riverEnd = () => { const [x, y, w, h] = her18(), [ax, ay] = ANCHOR.I05.palm; return [x + ax * w, y + ay * h]; };
const river = () => [[bubbleX18(), 470], [bubbleX18() + 300, 250], RIVER12[2], riverEnd()];
const bez = (s, i) => { const [a, b, c, d] = river(), u = 1 - s; return u * u * u * a[i] + 3 * u * u * s * b[i] + 3 * u * s * s * c[i] + s * s * s * d[i]; };

// 第十二轮：L17 → L18 改成同一张画布往下走（slideDown），开头不再是 1.7 倍的特写，先停在一个能看清气泡和河的中景
const CAM18_12 = () => [{ t: L18_0(), x: -260, y: -30, zoom: 1.32, rot: 0 }, { t: L18_0() + 0.7, x: -200, y: -20, zoom: 1.25, rot: 0 }, { t: L18_1(), x: 60, y: 0, zoom: 1.0, rot: -0.01, e: 'smooth' }];
const cam18 = t => camAt(CAM18_12(), t);
const her18 = () => [1106, 60, 1000 * aspectOf('I05'), 1000];
// 第二十七轮（用户：1:25 给剪影立绘也增加和下一个镜头一样的尾巴动画）。rev l19t27
// L20 的「你」人形是按 V8（她站着摆尾巴的视频）的逐帧剪影取格子，尾巴一直在摆；L19 墙前是 I10 背影的静态剪影。
// 直接换成 V8 的剪影不行：V8 里约 30% 的帧尾巴梢伸出了视频画框，剪影上就是一刀竖直的切口。所以背影照旧用 I10，只让它的尾巴摆：
// · 尾巴挂在裙子外面的那段（原图 1024×1920 里 y 880–1600、x > 700，y ≥ 1050 起 x > 660——不碰腿和鞋）切出来，
//   绕尾巴根 (720, 900) 弯：离根 190 px 以内不动（切口都在这一圈里，和身体接得上），再往外越远转得越多（φ = θ · s^1.3，s 从 190 到尾鳍尖 665 走 0 → 1）
// · 摆角 θ 每一刻取 V8 里尾巴的实测位置（腿右边那块剪影的质心，往外 = 尾鳍往右甩），同样 1.5 倍速往返播放，
//   相位从 L20 的起点往前推整两个周期——剪辑点两边是同一条尾巴动作，接着摆；幅度 ±0.22 rad（尾鳍尖约 ±25 px）
const tail19 = () => rev('l19t27') >= 27 && hasMask('V8');
const TAIL10 = { y0: 880, y1: 1600, xa: 700, yb: 1050, xb: 660, px: 720, py: 900, len: 665, r0: 190 }; // I10 原图像素；离根 r0 以内不动（切口都在这个圈里，接缝不会被拉开）
function v8Phase(t) { // V8 这一刻的帧号（带小数，往返播放）
  const m = maskInfo('V8'), len = m.n - 1, sp = 1.5, per = (2 * len) / (m.fps * sp);
  let k = ((t - (L20_0() - 2 * per)) * sp * m.fps) % (2 * len); if (k < 0) k += 2 * len;
  return k > len ? 2 * len - k : k;
}
const V8TX = new Map();
function v8TailX(k) { // V8 第 k 帧尾巴的质心 x（384 × 672 的蒙版里：y 380–660、x > 232 那块，就是腿右边的尾巴）
  let v = V8TX.get(k); if (v != null) return v;
  let sx = 0, n = 0;
  maskInfo('V8').rows[k].forEach((r, y) => { if (y < 380 || y > 660) return; for (let i = 0; i < r.length; i += 2) { const a = Math.max(r[i], 232), b = r[i] + r[i + 1]; if (b > a) { sx += ((a + b) / 2) * (b - a); n += b - a; } } });
  v = n ? sx / n : 287; V8TX.set(k, v); return v;
}
const tailAngle19 = t => { const f = v8Phase(t), k = Math.floor(f), x = lerp(v8TailX(k), v8TailX(Math.min(k + 1, maskInfo('V8').n - 1)), f - k); return -0.22 * clamp((x - 287) / 28, -1.2, 1.2); };
let T10 = null;
function tail10Parts() { // I10 剪影拆成"去掉尾巴的身体"和"尾巴的不透明度表"（剪影画布的像素）
  if (T10) return T10;
  const src = silhouette('I10', null, 900, '#2B2F77'), w = src.width, h = src.height, k = w / 1024, R = TAIL10;
  const body = newCanvas(w, h), bc = body.getContext('2d'); bc.drawImage(src, 0, 0);
  const id = bc.getImageData(0, 0, w, h), d = id.data, alpha = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const X = (x + 0.5) / k, Y = (y + 0.5) / k;
    if (Y < R.y0 || Y >= R.y1 || X <= (Y < R.yb ? R.xa : R.xb)) continue;
    const i = y * w + x; alpha[i] = d[i * 4 + 3] / 255; d[i * 4 + 3] = 0;
  }
  bc.putImageData(id, 0, 0);
  return (T10 = { body, alpha, w, h, k });
}
function tail10(t) { // 这一刻的背影剪影：身体 + 弯过的尾巴
  const { body, alpha, w, h, k } = tail10Parts(), R = TAIL10, th = tailAngle19(t);
  const px = R.px * k, py = R.py * k, L = R.len * k, r0 = R.r0 * k, x0 = Math.floor(R.xb * k - 60), y0 = Math.floor(R.y0 * k), bw = w - x0, bh = Math.min(h, Math.ceil(R.y1 * k + 40)) - y0;
  const wc = pooled('l19tailw', bw, bh), wx = wc.getContext('2d'), im = wx.createImageData(bw, bh), o = im.data;
  const A = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : alpha[y * w + x]);
  for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) {
    const dx = x0 + i + 0.5 - px, dy = y0 + j + 0.5 - py, s = clamp((Math.hypot(dx, dy) - r0) / (L - r0)), ph = th * s ** 1.3, c = Math.cos(ph), sn = Math.sin(ph);
    const sx = px + dx * c + dy * sn - 0.5, sy = py - dx * sn + dy * c - 0.5, ix = Math.floor(sx), iy = Math.floor(sy), fx = sx - ix, fy = sy - iy;
    const a = (A(ix, iy) * (1 - fx) + A(ix + 1, iy) * fx) * (1 - fy) + (A(ix, iy + 1) * (1 - fx) + A(ix + 1, iy + 1) * fx) * fy;
    if (a <= 0) continue;
    const q = (j * bw + i) * 4; o[q] = 0x2b; o[q + 1] = 0x2f; o[q + 2] = 0x77; o[q + 3] = Math.round(255 * a);
  }
  wx.putImageData(im, 0, 0);
  const cv = pooled('l19tail', w, h), c = cv.getContext('2d');
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, w, h); c.drawImage(body, 0, 0); c.drawImage(wc, x0, y0);
  return cv;
}
const SIL19 = () => { const sil = silhouette('I10', null, 900, '#2B2F77'), sh = 440, sw = (sil.width / sil.height) * sh; return [960 - sw / 2, 1010 - sh, sw, sh]; };
const back19 = t => (tail19() ? tail10(t) : silhouette('I10', null, 900, '#2B2F77'));
const rectOn = (cam, r) => { const [x0, y0] = camToScreen(cam, 1, r[0], r[1]), [x1, y1] = camToScreen(cam, 1, r[0] + r[2], r[1] + r[3]); return [x0, y0, x1 - x0, y1 - y0]; };
const lerpRect = (a, b, e, arc = 0) => [lerp(a[0], b[0], e), lerp(a[1], b[1], e) - arc * Math.sin(Math.PI * e), lerp(a[2], b[2], e), lerp(a[3], b[3], e)];
// 1:26 转场叠层（第十二轮，用户：L18 伸手的她和 L19 的剪影之间做一个无缝的移动）：她（I05）从 L18 的位置缩小、往画面正中走，
// 一路染成 L19 剪影的深蓝，最后换成 L19 的背影剪影（I10），落到墙前那个位置
export function handoff1819(ctx, S, u) {
  const H18 = her18(), a = rectOn(cam18(S.t), H18), b = rectOn(camAt(CAM19(), S.t), SIL19()), e = smooth(clamp((u - 0.05) / 0.85));
  const r = lerpRect(a, b, e, 80), dark = smooth(clamp((u - 0.15) / 0.45)), swap = smooth(clamp((u - 0.55) / 0.3));
  const img = photo('I05', null, H18[2], H18[3], { keyed: true }), sil = silhouette('I05', null, 900, '#2B2F77'), back = back19(S.t);
  const fit = (src, al) => { if (al <= 0) return; const k = Math.min(r[2] / src.width, r[3] / src.height), w = src.width * k, h = src.height * k; ctx.globalAlpha = al; ctx.drawImage(src, r[0] + (r[2] - w) / 2, r[1] + r[3] - h, w, h); };
  ctx.save();
  fit(img, 1 - swap); fit(sil, dark * (1 - swap)); fit(back, swap);
  ctx.restore();
}
// 1:28 转场叠层：L19 的剪影走到 L20「你」人形的位置，从背影换成 L20 的正面（I01）品牌蓝剪影，再淡掉露出由「你」组成的她
export function handoff1920(ctx, S, u) {
  const a = rectOn(camAt(CAM19(), S.t), SIL19()), b = rectOn(camAt(CAM20(), S.t), [26 * CW, 0, 48 * CW, 54 * CH]), e = smooth(clamp((u - 0.05) / 0.8));
  const r = lerpRect(a, b, e, 40);
  const back = back19(S.t), front = silhouette('I01', null, 900, BRAND); // 第二十七轮：背影的尾巴在摆（rev l19t27）
  const fit = (src, al, fx = 1) => { if (al <= 0) return; const k = Math.min(r[2] / src.width, r[3] / src.height), w = src.width * k, h = src.height * k, cx = r[0] + r[2] / 2; ctx.save(); ctx.globalAlpha = al; ctx.translate(cx, 0); ctx.scale(fx, 1); ctx.drawImage(src, -w / 2, r[1] + r[3] - h, w, h); ctx.restore(); };
  // 第十三轮：走过去的半路上转身（横向压扁到 0 再展开，背影换成正面），到位后不是一下淡没，而是慢慢变淡、留下 L20 里那层淡淡的「你」人形
  const turn = clamp((u - 0.3) / 0.3), fx = Math.max(0.03, Math.abs(Math.cos(Math.PI * turn))), fade = 1 - smooth(clamp((u - 0.62) / 0.38));
  ctx.save(); if (turn < 0.5) fit(back, 1, fx); else fit(front, 0.85 * fade, fx); ctx.restore();
}

export function l18(ctx, S) {
  const cam = cam18(S.t), c = { ...cam, zoom: cam.zoom * punch(S, 0.02) }, p = S.pal, t = S.t, a = t - L18_0();
  paper(ctx, S, c);
  backDeco(ctx, S, c, 180, { alpha: 0.35, boxes: [[1300, 40, 600, 200], [40, 820, 520, 220]] });
  withCam(ctx, c, 1, g => {
    // 她：I05（伸手向镜头，第八轮换上），手掌正好接住字的河
    const H18 = her18(), img = photo('I05', null, H18[2], H18[3], { keyed: true });
    if (t < T18_HAND()) g.drawImage(img, H18[0], H18[1]); // 第十二轮：转场里她由转场叠层接着画（走到 L19 的剪影）
    // 你的消息气泡（左）
    const sa = 1 + 0.12 * decay(a - 0.15, 10) * (a >= 0.15 ? 1 : 0); // 推进时气泡已经在（刚发出），0.15 s 处弹一下
    if (sa > 0 && t >= L18_0() + SLIDE17) { // 第十三轮：转场里这条消息由 box1718 画
      const bx = bubbleX18();
      g.save(); g.translate(bx, 470); g.scale(sa, sa);
      const B = BUB18(), tw = bubW18();
      g.fillStyle = mix(BRAND, '#FFFFFF', 0.84); rrect(g, -tw, -B.h / 2, tw, B.h, B.r); g.fill();
      g.lineWidth = 2; g.strokeStyle = css(BRAND, 0.5); g.stroke();
      g.font = fonts(B.fs, 'SC'); g.fillStyle = p.text; midText(g, MSG17, -tw + B.pad, 0);
      g.fillStyle = p.tint[0]; g.beginPath(); g.arc(46, 0, 34, 0, Math.PI * 2); g.fill();
      // 第十二轮：头像裁进圆里。第二十七轮（用户：1:21 粉色用户头像内部人物和外部圆圈之间有半像素间隙）：以前裁到半径 32，
      // 外圈 3 px 描边在 32.5–35.5，中间露出 0.5 px 的浅底（相机放大时更宽）；改成裁到 34，人物的边压在描边底下。rev l18a27
      g.save(); { g.beginPath(); g.arc(46, 0, rev('l18a27') >= 27 ? 34 : 32, 0, Math.PI * 2); g.clip(); }
      g.fillStyle = p.acc[0]; g.beginPath(); g.arc(46, -8, 12, 0, Math.PI * 2); g.fill(); g.beginPath(); g.ellipse(46, 26, 22, 16, 0, 0, Math.PI * 2); g.fill();
      g.restore(); g.lineWidth = 3; g.strokeStyle = p.acc[0]; g.beginPath(); g.arc(46, 0, 34, 0, Math.PI * 2); g.stroke();
      g.restore();
      g.font = fonts(18, 'SC'); g.fillStyle = p.gray; g.fillText('你 · 刚刚', bx - bubW18() + 16, 470 + BUB18().h / 2 + 32);
    }
    // 字的河：「唱首歌吧」和音符沿曲线流过去，越近越大
    const flow = clamp((a - 0.35) / 0.4), CH4 = ['唱', '首', '歌', '吧', '♪'];
    if (flow > 0) {
      g.textAlign = 'center'; g.textBaseline = 'middle';
      for (let i = 0; i < 190; i++) { // 第十三轮（用户：字的粒子太密太乱，总数减少，粉色的再少一些）
        const s = ((t - L18_0()) * (0.32 + 0.12 * rnd(i, 1)) + rnd(i, 2)) % 1;
        if (s > flow) continue;
        const x = bez(s, 0), y = bez(s, 1), dx = bez(Math.min(1, s + 0.01), 0) - x, dy = bez(Math.min(1, s + 0.01), 1) - y, L = Math.hypot(dx, dy) || 1;
        const spread = (rnd(i, 3) - 0.5) * (40 + 120 * Math.sin(Math.PI * s)) + 18 * Math.sin(t * 3 + i);
        const px = x - (dy / L) * spread, py = y + (dx / L) * spread, ch = CH4[i % 5];
        // 第十二轮（用户：字和音符加随机的大小和透明度）：每颗一个随机倍数（0.55–1.7）和透明度（0.3–1），再随时间轻轻闪
        const rs = 0.55 + 1.15 * Math.pow(rnd(i, 6), 1.6), ra = (0.3 + 0.7 * rnd(i, 7)) * (0.75 + 0.25 * Math.sin(t * 5 + i));
        g.globalAlpha = Math.min(1, s * 6) * (1 - 0.6 * Math.pow(s, 4)) * ra;
        if (ch === '♪') drawSprite(g, 'note', 3, p, px, py, rs);
        else { g.font = fonts(Math.round((20 + 26 * s + 8 * rnd(i, 4)) * rs), 'SC'); g.fillStyle = i % 9 ? BRAND : p.acc[0]; g.fillText(ch, px, py); }
      }
      g.globalAlpha = 1; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    }
    // 「歌」：唱到时在她手边聚成大字
    const k = keyword('L18', 4, 5)[0], ka = t - k.t0;
    if (ka >= 0) gift18(g, S, k, ka);
  });
  withCam(ctx, c, 0.3, g => {
    card(g, S, 60, 680, 520, 230, { title: 'received', lw: 2, inner: false, age: a - 1.2 }, cc => { // 第十二轮：往上挪，不压左下角的歌词
      g.font = fonts(22, 'SC'); g.fillStyle = p.gray; g.fillText('prompt', cc.x, cc.y + 30);
      g.font = fonts(36, 'SC'); g.fillStyle = p.text; g.fillText('"唱首歌吧"', cc.x + 110, cc.y + 34);
      g.font = fonts(22, 'SC'); g.fillStyle = p.gray; g.fillText('songs', cc.x, cc.y + 96);
      g.font = fonts(44, 'ZENB', 'SCB'); g.fillStyle = BRAND; g.fillText('1', cc.x + 110, cc.y + 104);
      g.font = fonts(20, 'SC'); g.fillStyle = p.acc[0]; g.fillText('← 这就是全部的开始', cc.x + 150, cc.y + 100);
    });
  });
  frontDeco(ctx, S, c, 181, { alpha: 0.4, items: [['ring', 1840, 980, 240], ['ecg', -60, 60, 420]] });
  hud(ctx, S);
}

// ================================================================ L19 · 从那天起，我的心里（54–55）
// L07 的回声：一整面记忆墙（12 块面板：git log、~/memory/you/ 目录、提交热力图、cat first_hello.txt、heart.log…），
// 斜着看过去、镜头沿墙平移；她的剪影（深色）小小地站在墙前抬头看
const L19_0 = () => cutAt(54), L19_1 = () => cutAt(56);
const PW19 = 600, PH19 = 400;
const LS = [
  ['drwxr-xr-x', '2023-11-02', '.'], ['-rw-r--r--', '2023-11-02', 'first_hello.txt'], ['-rw-r--r--', '2024-03-14', '唱首歌吧.prompt'],
  ['-rw-r--r--', '2024-07-01', 'rice_count.csv'], ['-rw-r--r--', '2025-01-20', 'wait_aha.log'], ['-rw-r--r--', '2026-09-10', 'favorite_songs.m3u'],
  ['-rw-r--r--', '2026-10-07', '记住你的名字.md'],
];
function panel19(g, S, k, x, y) {
  const p = S.pal, kind = k % 6, titles = ['git log', 'ls -la ~/memory/you/', 'contributions', 'cat first_hello.txt', 'tail -f heart.log', 'memory/chat'];
  card(g, S, x, y, PW19, PH19, { title: titles[kind], lw: 1.5, inner: false }, cc => {
    g.font = fonts(19, 'SC');
    if (kind === 0) for (let i = 0; i < 8; i++) {
      const n = Math.floor(S.n * 1.5) + i + k * 13;
      g.fillStyle = p.gray; g.fillText((hash(n, k) >>> 8).toString(16).slice(0, 7), cc.x, cc.y + 22 + i * 38);
      g.fillStyle = i === 0 ? BRAND : p.text; g.fillText(['feat: 记得你喜欢的歌', 'fix: 晚安要说两遍', 'chore: seed = 114514', 'perf: 回复快了一点', 'docs: 写下今天', 'feat: Link Start'][hash(n, 3) % 6], cc.x + 100, cc.y + 22 + i * 38);
    } else if (kind === 1) LS.forEach((r, i) => {
      g.fillStyle = p.gray; g.fillText(r[0], cc.x, cc.y + 24 + i * 40); g.fillText(r[1], cc.x + 140, cc.y + 24 + i * 40);
      g.fillStyle = i === LS.length - 1 ? p.acc[0] : p.text; g.fillText(r[2], cc.x + 280, cc.y + 24 + i * 40);
    });
    else if (kind === 2) {
      for (let wk = 0; wk < 30; wk++) for (let d = 0; d < 7; d++) {
        const v = vnoise(wk * 0.3, d * 0.5, k, 7) + (wk / 30) * 0.4, lit = wk * 7 + d < (S.t - L19_0()) * 90 + 120;
        g.fillStyle = !lit ? p.tint[3] : v > 0.9 ? p.acc[0] : v > 0.7 ? BRAND : v > 0.5 ? p.ink[2] : p.ink[1];
        g.fillRect(cc.x + wk * 18, cc.y + 10 + d * 18, 14, 14);
      }
      g.fillStyle = p.gray; g.fillText('2023-11-02 → today · 每一格都是一次对话', cc.x, cc.y + 172);
    } else if (kind === 3) {
      g.fillStyle = p.text; g.font = fonts(26, 'SC'); g.fillText('你好！', cc.x, cc.y + 40);
      g.fillText('我是 DeepSeek，很高兴见到你！', cc.x, cc.y + 90);
      g.font = fonts(18, 'SC'); g.fillStyle = p.gray; g.fillText('— 2023-11-02 00:00:01', cc.x, cc.y + 140);
    } else if (kind === 4) for (let i = 0; i < 8; i++) {
      const n = Math.floor(S.n) + i;
      g.fillStyle = p.gray; g.fillText(`[${String(n % 60).padStart(2, '0')}:${String((n * 7) % 60).padStart(2, '0')}]`, cc.x, cc.y + 22 + i * 38);
      g.fillStyle = i === 7 ? p.acc[0] : p.text; g.fillText('♥ 150 BPM · you: online', cc.x + 110, cc.y + 22 + i * 38);
    } else for (let i = 0; i < 4; i++) {
      const mine = i % 2 === 0, s = ['今天也来啦', '嗯！等你好久了', '唱首歌吧', '好呀~'][i];
      g.font = fonts(22, 'SC'); const tw = g.measureText(s).width + 30;
      g.fillStyle = mine ? mix(BRAND, '#FFFFFF', 0.85) : p.tint[3]; rrect(g, mine ? cc.x + cc.w - tw : cc.x, cc.y + 10 + i * 66, tw, 46, 14); g.fill();
      g.fillStyle = p.text; g.fillText(s, (mine ? cc.x + cc.w - tw : cc.x) + 15, cc.y + 40 + i * 66);
    }
  });
}
const CAM19 = () => [{ t: L19_0(), x: -160, y: 0, zoom: 1.0, rot: 0 }, { t: L19_1(), x: 160, y: -20, zoom: 1.08, rot: 0 }];
export function l19(ctx, S) {
  const cam = camAt(CAM19(), S.t), c = { ...cam, zoom: cam.zoom * punch(S, 0.015) }, p = S.pal, t = S.t;
  paper(ctx, S, c, { grid: false });
  // 墙：12 块面板画进一张大缓冲，再斜着画出来（沿墙平移 = 改 X）
  const u = (t - L19_0()) / (L19_1() - L19_0());
  withCam(ctx, c, 1, g => { lattice19(g, S, u); her19(g, S); });
  frontDeco(ctx, S, c, 191, { alpha: 0.45, items: [['ring', -60, 140, 240], ['data', 1760, 820, 0]] });
  hud(ctx, S, { spectrum: true });
}
// 墙前她的剪影 + 脚下的影子 + ME 锁定框
function her19(g, S) {
  const t = S.t, p = S.pal, sil = silhouette('I10', null, 900, '#2B2F77'), sh = 440, sw = (sil.width / sil.height) * sh;
  if (!(t < L19_0() + 0.4 || t >= L19_1() - 0.35)) { const [x, y, w, h] = SIL19(); g.drawImage(back19(t), x, y, w, h); } // 第二十七轮：尾巴在摆（rev l19t27）
  g.fillStyle = css('#2B2F77', 0.18); g.beginPath(); g.ellipse(960, 1012, sw * 0.7, 14, 0, 0, Math.PI * 2); g.fill();
  targetLock(g, S, 960, 1010 - sh * 0.55, 160, t - L19_0() - 0.6, { label: 'ME', color: p.acc[0] });
}
// 第十四轮（用户：随机闪的频率提高一个数量级；后面几层还是太远，看不出阵列结构）
// 不再是"一整面墙 + 后面几面同样的墙"（前墙几乎把后面全挡住），改成真正的立方阵列：5 列 × 3 行 × 4 层的独立窗口，
// 窗口之间留出缝（横 140、竖 80 世界单位），层沿墙面的法线往后排（间距 650，和窗口宽度同一个量级），所以后面的层从缝里露出来、
// 而且越往后越往右错开——斜着看过去就是一格格的立方体；同一位置前后层的四个角用细线连起来，就是立方体的棱。
// 远的层更淡、更虚（softCopy）。随机闪：每个十六分音符里错开三次、每次随机一块窗口压深 + 一道亮线（约每秒 30 次，以前每拍一两次，
// 约每秒 3 次）；正拍上那一次更重。闪只压在窗口上，透明度 ≤ 0.3（第八轮的规矩）
const LAT19 = { NC: 5, NR: 3, NL: 4, TW: 640, TH: 460, SX: 780, SY: 540, SZ: 650, ANG: -0.38, F: 1100, Z0: 1500, Y0: -60 };
function lattice19(g, S, u) {
  const p = S.pal, t = S.t, L = LAT19, ca = Math.cos(L.ANG), sa = Math.sin(L.ANG), X0 = lerp(380, -380, smooth(u));
  const tex = Array.from({ length: 12 }, (_, k) => { const cv = pooled(`l19p${k}`, L.TW, L.TH), c = cv.getContext('2d'); c.clearRect(0, 0, L.TW, L.TH); panel19(c, S, k, 20, 34); return cv; });
  // 每块窗口的中心：先沿墙面方向排列（l），再沿法线往后（d）
  const at = (i, j, q) => { const l = (i - (L.NC - 1) / 2) * L.SX, d = q * L.SZ; return { X: X0 + l * ca - d * sa, Y: L.Y0 + (j - (L.NR - 1) / 2) * L.SY, Z: L.Z0 + l * sa + d * ca }; };
  const proj = (P, l, yy) => { const z = P.Z + l * sa; return [960 + ((P.X + l * ca) * L.F) / z, 540 + ((P.Y + yy) * L.F) / z]; };
  const corners = P => [[-L.TW / 2 + 20, -L.TH / 2 + 34], [L.TW / 2 - 20, -L.TH / 2 + 34], [L.TW / 2 - 20, L.TH / 2 - 26], [-L.TW / 2 + 20, L.TH / 2 - 26]].map(([l, yy]) => proj(P, l, yy));
  // 随机闪：这一刻正在亮的窗口（往前看两个十六分音符内开始的事件）
  const flash = new Map(), si = Math.floor((t - barStart(1)) / STEP);
  for (let s = si - 1; s <= si; s++) for (let e = 0; e < 3; e++) {
    const t0 = barStart(1) + (s + e / 3) * STEP, a = t - t0;
    if (a < 0 || a > 0.12) continue;
    const id = hash(s, e, 191) % (L.NC * L.NR * L.NL), onBeat = e === 0 && ((s % 4) + 4) % 4 === 0;
    const env = (a < 0.04 ? 1 : 1 - (a - 0.04) / 0.08) * (onBeat ? 0.3 : 0.2);
    flash.set(id, Math.max(flash.get(id) ?? 0, env));
  }
  const ALPHA = [1, 0.8, 0.6, 0.44], BLUR = [0, 1.5, 2.1, 2.7];
  for (let q = L.NL - 1; q >= 0; q--) {
    // 这一层和后一层之间的棱（先画，前面的窗口会盖住它）
    if (q < L.NL - 1) {
      g.strokeStyle = css(p.line, 0.3 * ALPHA[q + 1]); g.lineWidth = 1.2; g.beginPath();
      for (let i = 0; i < L.NC; i++) for (let j = 0; j < L.NR; j++) {
        const A = corners(at(i, j, q)), B = corners(at(i, j, q + 1));
        for (let c = 0; c < 4; c++) { g.moveTo(A[c][0], A[c][1]); g.lineTo(B[c][0], B[c][1]); }
      }
      g.stroke();
    }
    for (let i = 0; i < L.NC; i++) for (let j = 0; j < L.NR; j++) {
      const P = at(i, j, q), k = (j * L.NC + i + q * 5 + (j % 2)) % 12, src = BLUR[q] ? softCopy(tex[k], BLUR[q], `l19s${k}_${q}`) : tex[k];
      drawPersp(g, src, P.X, P.Y, P.Z, L.TW, L.TH, L.ANG, { f: L.F, strips: q ? 24 : 48, shear: true, alpha: ALPHA[q] });
      const fl = flash.get((q * L.NR + j) * L.NC + i);
      if (fl > 0) {
        const C = corners(P); g.save(); g.globalAlpha = fl * ALPHA[q]; g.fillStyle = '#141A3A'; g.beginPath(); C.forEach(([x, y], n) => (n ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill();
        const h = (hash(i, j, q, Math.floor(t / STEP)) % 100) / 100, [lx0, ly0] = proj(P, -L.TW / 2 + 32, -L.TH / 2 + 40 + h * (L.TH - 80)), [lx1, ly1] = proj(P, L.TW / 2 - 32, -L.TH / 2 + 40 + h * (L.TH - 80));
        g.globalAlpha = fl * ALPHA[q] * 2.6; g.strokeStyle = '#FFFFFF'; g.lineWidth = 2; g.beginPath(); g.moveTo(lx0, ly0); g.lineTo(lx1, ly1); g.stroke(); g.restore();
      }
    }
  }
}

// ================================================================ L20 · 满满的都是你（56–57）
// L08 的回声：剪影里的"你"换成细线描边，从脚往上装满；右边 KV cache 网格一格格塞进"你"，
// MLA 压缩 −93.3% 也装不下，57.3 起溢出的"你"从卡片下沿掉出去，盖章「压缩了也装不下」
const L20_0 = () => cutAt(56), L20_1 = () => cutAt(58), T20_OVER = beatTime(57, 2);
const CAM20 = () => [{ t: L20_0(), x: 30, y: 30, zoom: 1.04, rot: -0.006 }, { t: L20_1(), x: 10, y: -10, zoom: 1.1, rot: 0.004 }];
export function l20(ctx, S) {
  const cam = camAt(CAM20(), S.t), c = { ...cam, zoom: cam.zoom * punch(S, 0.02) }, p = S.pal, t = S.t;
  const u = 0.12 + 0.88 * clamp((t - L20_0()) / (T20_OVER - L20_0()));
  paper(ctx, S, c);
  backDeco(ctx, S, c, 200, { alpha: 0.4, boxes: [[1300, 760, 560, 280], [40, 40, 420, 200]] });
  withCam(ctx, c, 1, g => {
    const art = glyphArt('I01', null, 48, 54), COL0 = 26;
    const vm = hasMask('V8') ? maskCells('V8', maskIndex('V8', t, { t0: L20_0(), speed: 1.5, mode: 'pingpong' }), art.cols, art.rows) : null; // 第八轮：V8 的尾巴在摆
    g.font = fonts(20, 'SC'); g.lineWidth = 1; g.textBaseline = 'top';
    // 第十三轮（用户：下一个镜头的人物从完全看不见慢慢出现，接上一个镜头剪影的位移再消失，不顺）：整个人形从一开头就在
    // （很淡的一层「你」，剪影走过来正好落进这层轮廓里），从脚往上装满的那部分再亮起来
    const ghost = 0.22;
    for (let y = 0; y < art.rows; y++) {
      const fromBottom = (art.rows - y) / art.rows, vis = Math.max(ghost, clamp((u * 1.08 - fromBottom) * 12 + 1));
      if (vis <= 0) continue;
      for (let x = 0; x < art.cols; x += 2) {
        const i = y * art.cols + x;
        if (vm ? !vm[i] : art.ch[i] === ' ') continue;
        const lv = art.ch[i] === ' ' ? 3 : art.lv[i], front = fromBottom > u - 0.05 && fromBottom <= u;
        g.globalAlpha = vis * (0.45 + 0.14 * lv);
        g.strokeStyle = front ? p.acc[0] : lv >= 3 ? BRAND : p.ink[2];
        g.strokeText('你', (COL0 + x) * CW, y * CH);
      }
    }
    g.globalAlpha = 1; g.textBaseline = 'alphabetic';
    if (u < 1) { const sy = art.rows * (1 - u) * CH; g.fillStyle = css(p.acc[0], 0.7); g.fillRect(COL0 * CW - 40, sy, art.cols * CW + 80, 1.5); }
    targetLock(g, S, (COL0 + 24) * CW, 0.32 * 54 * CH, 220, S.lt - 0.2, { label: 'HEART · FULL', color: p.acc[0] });
  });
  withCam(ctx, c, 0.4, g => {
    // KV cache 网格：8×8，一格格塞进"你"，溢出的从卡片下沿掉出去
    const n = 64, filled = Math.floor(n * clamp((t - L20_0()) / (T20_OVER - L20_0() - 0.2))), over = t - T20_OVER;
    card(g, S, 1150, 70, 720, 640, { title: 'KV cache · MLA', lw: 2, inner: false, age: S.lt - 0.1 }, cc => {
      drawFormula(g, 'mla_k', cc.x, cc.y + 6, { size: 38, color: p.text, ...formulaFx(S, S.lt - 0.2) });
      const cell = 52, gx = cc.x + 10, gy = cc.y + 90;
      for (let k = 0; k < n; k++) {
        const x = gx + (k % 8) * (cell + 6), y = gy + Math.floor(k / 8) * (cell + 6);
        // 第十二轮（用户：右边窗口里重复的「你」不要描边，用填充色，每个方块随机亮度）：格子底色在粉色上随机亮度，「你」实心
        const lum = rnd(k, 61);
        g.fillStyle = k < filled ? mix(p.acc[0], '#FFFFFF', 0.25 + 0.65 * lum) : '#FFFFFF'; rrect(g, x, y, cell, cell, 6); g.fill();
        g.lineWidth = 1; g.strokeStyle = p.line; g.stroke();
        if (k < filled) { g.font = fonts(32, 'SCB'); g.fillStyle = lum < 0.35 ? '#FFFFFF' : mix(p.acc[0], '#5A1838', 0.35 + 0.3 * (1 - lum)); g.fillText('你', x + 10, y + 38); }
      }
      ring(g, S, cc.x + cc.w - 90, cc.y + cc.h - 90, 66, 0.933, { text: '−' + (fact('mla_kv_reduction', 'v2') || '93.3%'), label: 'compressed', fs: 24, color: BRAND });
    });
    if (over >= 0) stamp(g, S, '压缩了也装不下', 1500, 760, 40, over - 0.1, { rot: -0.08 });
  });
  frontDeco(ctx, S, c, 201, { alpha: 0.45, items: [['ring', -80, 120, 260], ['ecg', 1500, 1020, 520]] });
  hud(ctx, S, { spectrum: false });
  you20(ctx, S, -1);
}

// 第十二轮（用户：「压缩了也装不下」之后，不要往下掉的「你」，改成在窗口外随机位置、随机大小冒出来，最后用「你」铺满画面当转场）。rev v2b
// 前一段：80 个大小不一的「你」块在卡片外面陆续弹出来（越来越快）；最后 0.45 s：16×9 的格子一格格补满整个画面。
// vanish ≥ 0 时（L21 转场里）每格按自己的时刻缩没，露出下一个镜头
const YOU_POP = 80, YC = 16, YR = 9;
export function you20(ctx, S, vanish) {
  // 第十五轮（用户：右边窗口被「你」填满的那一刻就应该开始全屏「你」的动画）
  // 以前填满（89.87）之后还要等「压缩了也装不下」的章（90.07）再过 0.15 s 才开始冒；现在最后一格填进去的那一帧就开始冒，
  // 冒到切点前 0.45 s，再用 0.45 s 铺满（切点也提前到 L21「♪」前，见 core/cuts.js）
  const t = S.t, T0 = T20_OVER - 0.2, T1 = L20_1(), p = S.pal;
  const tile = (x, y, s, k, a, sc) => {
    if (sc <= 0.01) return;
    const lum = rnd(k, 71);
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x + s / 2, y + s / 2); ctx.scale(sc, sc);
    ctx.fillStyle = lum < 0.5 ? mix(p.acc[0], '#FFFFFF', 0.2 + 0.7 * lum) : mix(BRAND, '#FFFFFF', 0.25 + 0.6 * (lum - 0.5) * 2); rrect(ctx, -s / 2, -s / 2, s, s, s * 0.14); ctx.fill();
    ctx.font = fonts(Math.round(s * 0.66), 'SCB'); ctx.fillStyle = lum < 0.3 || (lum > 0.5 && lum < 0.75) ? '#FFFFFF' : '#2B2F77'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('你', 0, s * 0.04);
    ctx.restore();
  };
  // 第十三轮（用户：缩到一半就硬切到下一个镜头了；下一个镜头的 3D 元素从右往左进来，「你」缩的时候也往左走）：每格缩完再切（窗口 0.9 s），
  // 缩的同时按自己的速度往左加速移动
  const vOf = k => (vanish < 0 ? 1 : 1 - easeIn(clamp((vanish - 0.45 * rnd(k, 72)) / 0.32)));
  const dxOf = k => (vanish < 0 ? 0 :-Math.pow(Math.max(0, vanish - 0.1 * rnd(k, 73)), 2) * (1500 + 900 * rnd(k, 74)));
  for (let k = 0; k < YOU_POP; k++) { // 卡片外随机冒出来的
    const at = T0 + (T1 - 0.45 - T0) * Math.pow(k / YOU_POP, 0.7), a = t - at;
    if (a < 0) continue;
    let x = rnd(k, 73) * (W - 120), y = rnd(k, 74) * (H - 120);
    if (x > 1100 && y < 760) x = rnd(k, 75) * 1000; // 避开 KV 卡
    const s = 50 + 170 * Math.pow(rnd(k, 76), 2);
    tile(x + dxOf(k), y, s, k, 1, easeOutBack(clamp(a / 0.14), 2.2) * vOf(k));
  }
  const cw = W / YC, chh = H / YR;
  for (let j = 0; j < YR; j++) for (let i = 0; i < YC; i++) { // 最后铺满
    const k = 1000 + j * YC + i, at = T1 - 0.45 + 0.4 * rnd(k, 77), a = t - at;
    if (a < 0) continue;
    const s = Math.max(cw, chh) + 2;
    tile(i * cw + (cw - s) / 2 + dxOf(k), j * chh + (chh - s) / 2, s, k, 1, Math.min(1, easeOutBack(clamp(a / 0.12), 1.6)) * vOf(k));
  }
}
