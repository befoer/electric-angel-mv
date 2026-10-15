// 第三段（少女音 · 晨光）进场 + L25–L28（90–98 小节，2:22.47–2:36.87），视觉方案 §5.7，第七轮实现
// 少女音的手感：漂浮（缓入缓出）、星光、音符、羽毛；日文用 Zen Maru Gothic
import { W, H, CW, CH, BRAND, BEAT, STEP } from '../core/const.js';
import { barStart, beatTime, clamp, lerp, smooth, easeIn, easeOut, easeOutBack, decay } from '../core/time.js';
import { cutAt } from '../core/cuts.js';
import { hash, rnd, vnoise } from '../core/rand.js';
import { font, fonts, glyphs } from '../core/glyphs.js';
import { fact, keyword, lyric, onset } from '../core/data.js';
import { rev } from '../rev.js';
import { drawFormula } from '../core/math.js';
import { photo, aspectOf, ANCHOR } from '../core/portrait.js';
import { vidFrame, framesInfo } from '../core/frames.js';
import { dotType } from '../core/dottype.js';
import { satellite, tickRing } from '../core/struct22.js';
import { camAt, withCam, pooled, drawPitch, camToScreen } from '../core/cam.js';
import { charField } from '../core/grid.js';
import { hud } from '../core/hud.js';
import { card, corners } from '../core/kit.js';
import { drawSprite } from '../core/sprites.js';
import { ringScanner, segBar, targetLock, tag } from '../core/hudkit.js';
import { css, mix } from '../core/color.js';
import { rrect, speechBubble } from '../core/ui.js';
import { decode } from '../core/text.js';
import { paper, backDeco, frontDeco, punch, chatWin, bigLine, gridStep } from './scene.js';

const GOLD = '#FFC23D';
// 漂浮的星光 / 音符 / 羽毛：每拍几颗从下往上飘
function floaters(ctx, S, n = 10, kinds = ['sparkle', 'star', 'note', 'feather'], { alpha = 1, area = [0, 0, W, H] } = {}) {
  for (let i = 0; i < n; i++) {
    const life = 2.4, ph = ((S.t / life + rnd(i, 1)) % 1), k = Math.floor(S.t / life + rnd(i, 1));
    const x = area[0] + rnd(i, k, 2) * area[2] + 30 * Math.sin(S.t * 1.3 + i), y = area[1] + area[3] * (1 - ph);
    drawSprite(ctx, kinds[hash(i, k) % kinds.length], 3 + (hash(i, k, 3) % 3), S.pal, x, y, 1, alpha * Math.sin(Math.PI * ph));
  }
}

// ================================================================ 进场（90 小节）
// 白闪；接着 89 小节被填上颜色的她，金色晨光从底下升起，光线慢慢转；镜头往她的脸推，叠化进 L25 的眼睛
// 第十六轮：镜头的起止跟着切点走（core/cuts.js，画帧时取）
const E0 = barStart(90), E1 = () => cutAt(91);
// ---------------------------------------------------------------- 第二十一轮（第二十三轮并开关；第二十轮的日出 sunrise 删了）
// 用户：「从 ComfyUI 背景到声线切换的网格线背景当前是硬切，需要有过渡动画，而且硬切时立绘大小不一致。御姐音文字跟随了月亮，
// 少女音文字也要跟随太阳移动，当前文字只是放在太阳月亮旁边太生硬，需要做组合排版」
// · 过渡：间奏二最后 0.42 s 界面先退场（interlude2.js），只剩白底上的她；进场时白底上先浮出一格格点，点再往上下左右长成线、连成网格
//   （"把点连起来"，从她身边往外），白底同时褪成夜色、再被日出染暖
// · 她：间奏二最后一帧是 V10 视频原画，这里 0.14 s 内叠化成 I01，I01 按视频那一帧配准过（高 772、顶 175、居中，剪影重合度 0.68，以前 0.47）
// · 镜头推到她脸上，终点正好是 L25 里 I02 的眼睛位置（眼睛对眼睛叠化进 L25，见 L25_HER）
// · 太阳、月亮各是一组：外圈一圈环绕的字（慢慢转），旁边一个字块（大字声线 + 小字时段），整组跟着天体走；月亮那组被划掉、沉下去
const I01_21 = { h: 772, top: 175 }; // I01 配准到 V10 最后一帧（scratchpad reg.mjs：剪影 IoU 0.675）
const CAM_END21 = { x: -16.7, y: -225.3, zoom: 2.3 }; // I01 的眼睛中点 (943, 303) → L25 里 I02 的眼睛中点 (960, 514)，脸一样大
function ringText(g, str, cx, cy, r, a0, size, color) {
  g.save(); g.font = fonts(size, 'ZENB', 'SCB'); g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
  let a = a0;
  for (const ch of str) { const da = (g.measureText(ch).width + size * 0.18) / r; a += da / 2; g.save(); g.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r); g.rotate(a + Math.PI / 2); g.fillText(ch, 0, 0); g.restore(); a += da / 2; }
  g.restore();
}
// 一组天体 + 字：外圈环绕的字、一圈细线和四个刻度、旁边的字块（大字 + 小字 + 一根连到圆圈的细线）。strike 0..1 划掉
function bodyLockup(g, S, x, y, R, o) {
  const t = S.t, a = o.alpha;
  if (a <= 0) return;
  g.save(); g.globalAlpha *= a;
  g.strokeStyle = css(o.color, 0.7); g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, R, 0, Math.PI * 2); g.stroke();
  for (let i = 0; i < 4; i++) { const an = o.spin * t + (i * Math.PI) / 2; g.beginPath(); g.moveTo(x + Math.cos(an) * (R - 6), y + Math.sin(an) * (R - 6)); g.lineTo(x + Math.cos(an) * (R + 6), y + Math.sin(an) * (R + 6)); g.stroke(); }
  ringText(g, o.ring, x, y, R + 22, o.spin * t, o.ringSize, css(o.color, 0.85));
  // 字块：贴着圆圈的一侧（side ±1），或在圆圈正上方（side 0，第二十二轮），一根细线从圆圈连过去
  const side = o.side, bx = x + side * (R + 46), by = y + o.dy, k = o.reveal;
  g.strokeStyle = css(o.color, 0.8); g.lineWidth = 1.5; g.beginPath();
  if (side === 0) { g.moveTo(x, y - R - 6); g.lineTo(x, y - R - 6 - (y - R - 6 - (by + o.big * 1.45)) * k); }
  else { g.moveTo(x + side * R * 0.8, y + R * 0.6 * Math.sign(o.dy || 1) * 0.5); g.lineTo(bx - side * 8, by - 20); g.lineTo(bx + side * 40 * k, by - 20); }
  g.stroke();
  g.textAlign = side > 0 ? 'left' : side < 0 ? 'right' : 'center'; g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
  g.font = fonts(o.big, 'ZENB', 'SCB'); const s1 = decode(o.title, o.age, { seed: o.seed, step: 0.05, settle: 0.1 });
  g.lineWidth = 9; g.strokeStyle = '#FFFFFF'; g.strokeText(s1, bx, by + o.big * 0.75); g.fillStyle = o.color; g.fillText(s1, bx, by + o.big * 0.75);
  g.font = fonts(Math.round(o.big * 0.36), 'SC'); g.fillStyle = css(o.color, 0.85); g.fillText(decode(o.sub, o.age - 0.1, { seed: o.seed + 1, step: 0.015, settle: 0.1 }), bx, by + o.big * 0.75 + o.big * 0.55);
  if (o.strike > 0) { // 划掉：一道线从左到右划过字块
    g.font = fonts(o.big, 'ZENB', 'SCB'); const w = g.measureText(o.title).width, x0 = side > 0 ? bx - 6 : side < 0 ? bx - w - 6 : bx - w / 2 - 6;
    g.fillStyle = o.color; g.fillRect(x0, by + o.big * 0.42, (w + 12) * o.strike, 4);
  }
  g.restore();
}
// ---------------------------------------------------------------- 第二十二轮（第二十四轮并开关 vs22；第二十一轮的 sky21 删了）
// 用户：「御姐音停留时间太短了，少女音文字到屏幕外了。与下一个镜头的立绘衔接动画修改，这个镜头的太阳也可和下一个镜头的放射圆心位置做衔接转场」
// · 月亮那组慢慢沉（0.1 → 1.05 s），划掉晚一点（0.42 s 起），淡出从 0.78 s 起——能读约 0.8 s
// · 太阳挪到 x 1340、放到更浅的一层（深度 0.35，推镜时几乎不跟着放大），字块放在太阳正上方——一直在画面里
// · 切点前 0.3 s 起太阳交给转场叠层（sunToHeart22）：太阳一边缩小一边飞到 L25 里她胸口「她」那个位置（注意力线汇聚的圆心），
//   光线拉长到画面外、慢慢淡成 L25 的注意力线，太阳缩成胸口的光点后淡掉，「她」词元在那里亮起来
const SUN22 = { x: 1340, depth: 0.35 };
const sunY22 = a => lerp(900 + 160, 560, easeOutBack(clamp((a - 0.12) / 0.7), 1.2));
export function entryCam(t) { const u = clamp((t - E0) / (E1() - E0)), e = easeIn(u); return { x: lerp(0, CAM_END21.x, e), y: lerp(0, CAM_END21.y, e), zoom: lerp(1, CAM_END21.zoom, e), rot: 0 }; }
export function sunScreen22(t) { const c = entryCam(t), [x, y] = camToScreen(c, SUN22.depth, SUN22.x, sunY22(t - E0)); return { x, y, r: 98 * (1 + (c.zoom - 1) * SUN22.depth) }; }
function sky22(ctx, S, a, cam) {
  const p = S.pal, t = S.t, k = smooth(clamp((a - 0.15) / 0.75)), HZ = 900, sunOff = t > E1() - 0.3; // 切点前 0.3 s 起太阳由转场叠层画
  withCam(ctx, cam, 0.6, g => { g.fillStyle = css('#6E6AF0', 0.22 * (1 - k)); g.fillRect(-600, -600, W + 1200, H + 1200); });
  withCam(ctx, cam, SUN22.depth, g => {
    const sx = SUN22.x, sy = sunY22(a);
    const gr = g.createRadialGradient(sx, sy, 40, sx, sy, 1000); gr.addColorStop(0, css(GOLD, 0.5 * k)); gr.addColorStop(0.45, css('#FF9A7A', 0.15 * k)); gr.addColorStop(1, css(GOLD, 0));
    g.fillStyle = gr; g.fillRect(-900, -900, W + 1800, H + 1800);
    g.save(); g.beginPath(); g.rect(-900, -900, W + 1800, HZ + 900); g.clip();
    if (!sunOff) {
      g.strokeStyle = css(GOLD, 0.3 * k); g.lineWidth = 2;
      for (let i = 0; i < 24; i++) { const an = (i / 24) * Math.PI * 2 + t * 0.08; g.beginPath(); g.moveTo(sx + Math.cos(an) * 230, sy + Math.sin(an) * 230); g.lineTo(sx + Math.cos(an) * (330 + 1200 * k), sy + Math.sin(an) * (330 + 1200 * k)); g.stroke(); }
      sunDisc(g, sx, sy, 98, t, 1);
    }
    // 太阳那一组：外圈环绕的字 + 太阳正上方的字块（一直在画面里）；转场叠层接手前 0.15 s 淡掉
    const sa = clamp((a - 0.3) / 0.2) * (1 - smooth(clamp((t - (E1() - 0.45)) / 0.15)));
    bodyLockup(g, S, sx, sy, 150, { alpha: sa, color: mix(GOLD, '#D2652E', 0.55), ring: '少女音 · 晨光 · GIRL VOICE · MORNING · 少女音 · 晨光 · GIRL VOICE · MORNING · ', ringSize: 17, spin: -0.35, side: 0, dy: -300, title: '少女音', sub: '晨光 · voice 03', big: 52, age: a - 0.32, seed: 20, reveal: sa, strike: 0 });
    // 月亮那一组：沉得慢一点、停得久一点
    const mk = clamp((a - 0.1) / 0.95), mx = lerp(470, 300, mk), my = lerp(300, HZ + 90, easeIn(mk)), ma = clamp((a - 0.05) / 0.15) * (1 - smooth(clamp((a - 0.78) / 0.3)));
    if (ma > 0) {
      const mb = pooled('moon20', 220, 220), mc = mb.getContext('2d');
      mc.setTransform(1, 0, 0, 1, 0, 0); mc.clearRect(0, 0, 220, 220); mc.fillStyle = '#FFFFFF'; mc.beginPath(); mc.arc(110, 110, 70, 0, Math.PI * 2); mc.fill();
      mc.globalCompositeOperation = 'destination-out'; mc.beginPath(); mc.arc(145, 88, 63, 0, Math.PI * 2); mc.fill(); mc.globalCompositeOperation = 'source-over';
      g.save(); g.globalAlpha = ma; g.shadowColor = css('#C9C2FF', 0.8); g.shadowBlur = 24; g.drawImage(mb, mx - 110, my - 110); g.restore();
      bodyLockup(g, S, mx, my, 108, { alpha: ma, color: '#6E6AF0', ring: '御姐音 · 夜海 · MATURE VOICE · NIGHT SEA · 御姐音 · 夜海 · ', ringSize: 15, spin: 0.3, side: 1, dy: -40, title: '御姐音', sub: '夜海 · voice 02', big: 40, age: 1, seed: 22, reveal: 1, strike: clamp((a - 0.42) / 0.22) });
    }
    g.restore();
  });
  withCam(ctx, cam, 0.6, g => {
    g.fillStyle = css(GOLD, 0.6 * k + 0.2); g.fillRect(-600, HZ, W + 1200, 2);
    for (let i = 0; i < 14; i++) { const yy = HZ + 14 + i * 12, w0 = (60 + 260 * rnd(i, 3)) * (1 - i / 16), xx = SUN22.x + (rnd(i, 4) - 0.5) * 120 + 18 * Math.sin(t * 2 + i); g.fillStyle = css(GOLD, (0.5 - i * 0.03) * k); g.fillRect(xx - w0 / 2, yy, w0, 3); }
  });
}
function sunDisc(g, sx, sy, r, t, a) {
  const sg = g.createRadialGradient(sx - r * 0.25, sy - r * 0.25, r * 0.08, sx, sy, r); sg.addColorStop(0, '#FFF8DC'); sg.addColorStop(0.55, '#FFD872'); sg.addColorStop(1, mix(GOLD, '#FF9A5A', 0.3));
  g.save(); g.globalAlpha *= a;
  g.fillStyle = css(GOLD, 0.18); g.beginPath(); g.arc(sx, sy, r * 1.25 + 7 * Math.sin(t * 3), 0, Math.PI * 2); g.fill();
  g.fillStyle = sg; g.beginPath(); g.arc(sx, sy, r, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#FFFFFF'; g.lineWidth = Math.max(2, r / 25); g.stroke();
  g.restore();
}
// 进场 → L25：太阳飞到她胸口（L25 注意力线的圆心），一路缩小；光线拉长到画面外、淡成 L25 的注意力线
// 第二十四轮（用户：02:22 太阳图层放到立绘后方，运动路径改成直线；第二十六轮并开关 vs24，转场叠层里的旧版 sunToHeart22 删了）
// 以前太阳由转场叠层画在最上面（压着她的脸飞过去），路线是一道往上拱的弧。现在不画在叠层里：进场镜头和 L25 各自在她后面画同一个太阳
// （转场里两边叠化，位置一样，所以看起来是一个），从接手那一刻（切点前 0.3 s）的位置沿直线飞到她胸口「她」最后停的位置，
// 起步快、到了慢（接手前太阳本来就在跟着推镜动）；光线、光晕、缩小、淡出照旧
export function sunFly24(ctx, S) {
  const t = S.t, w0 = E1() - 0.3, u = (t - w0) / 0.65;
  if (u < 0 || u > 1) return;
  const src = sunScreen22(w0), Q = query22(E1() + 0.22), e = 1 - (1 - clamp(u / 0.8)) ** 2.2;
  const x = lerp(src.x, Q[0], e), y = lerp(src.y, Q[1], e), r = lerp(src.r, 26, e), da = 1 - smooth(clamp((u - 0.72) / 0.28));
  ctx.save();
  ctx.strokeStyle = css(GOLD, 0.35 * (1 - smooth(clamp((u - 0.55) / 0.45)))); ctx.lineWidth = 2;
  for (let i = 0; i < 32; i++) { const an = (i / 32) * Math.PI * 2 + t * 0.08, L = lerp(330 * src.r / 98, 1700, e); ctx.beginPath(); ctx.moveTo(x + Math.cos(an) * r * 2.2, y + Math.sin(an) * r * 2.2); ctx.lineTo(x + Math.cos(an) * L, y + Math.sin(an) * L); ctx.stroke(); }
  const gr = ctx.createRadialGradient(x, y, 0, x, y, r * 5); gr.addColorStop(0, css(GOLD, 0.45 * da)); gr.addColorStop(1, css(GOLD, 0)); ctx.fillStyle = gr; ctx.fillRect(x - r * 5, y - r * 5, r * 10, r * 10);
  sunDisc(ctx, x, y, r, t, da);
  ctx.restore();
}
// 白底 → 网格：先浮出格点，点往上下左右长成线连起来（离她近的先连）；这一层盖在白色底片上，白底褪掉以后它也淡掉，留下纸面本来的网格
function dotsToGrid(ctx, S, a, cam, veil) {
  const dotA = smooth(clamp(a / 0.12)), la = Math.max(veil, 0) * dotA;
  if (la <= 0.01) return;
  withCam(ctx, cam, 0.4, g => {
    const c = cam, [gx, gy] = gridStep(S.t), x0 = Math.floor((c.x * 0.4 - W) / gx) * gx, y0 = Math.floor((c.y * 0.4 - H) / gy) * gy; // 第二十五轮：格子跟纸面一起变方（gridStep）
    g.fillStyle = css(BRAND, 0.55 * la);
    for (let x = x0; x < x0 + 3 * W; x += gx) for (let y = y0; y < y0 + 3 * H; y += gy) {
      if (x < -200 || x > W + 200 || y < -200 || y > H + 200) continue;
      const d = Math.hypot(x - 960, y - 560) / 1100, gl = smooth(clamp((a - 0.06 - 0.16 * d) / 0.28));
      g.fillRect(x - 2, y - 2, 4, 4);
      if (gl > 0) { g.fillRect(x - 0.5, y - (gy / 2) * gl, 1, gy * gl); g.fillRect(x - (gx / 2) * gl, y - 0.5, gx * gl, 1); }
    }
  });
}
function entry21(ctx, S) {
  const p = S.pal, t = S.t, a = t - E0, u = clamp((t - E0) / (E1() - E0)), e = easeIn(u);
  const cam = { x: lerp(0, CAM_END21.x, e), y: lerp(0, CAM_END21.y, e), zoom: lerp(1, CAM_END21.zoom, e), rot: 0 };
  paper(ctx, S, cam);
  sky22(ctx, S, a, cam);
  sunFly24(ctx, S); // 第二十四轮：转场里飞向她胸口的太阳画在她后面
  const veil = 1 - smooth(clamp((a - 0.12) / 0.4)); // 间奏二留下的白底，慢慢褪掉
  if (veil > 0) { ctx.fillStyle = css('#FFFFFF', veil); ctx.fillRect(0, 0, W, H); }
  dotsToGrid(ctx, S, a, cam, veil);
  withCam(ctx, cam, 1, g => {
    const img = photo('I01', null, I01_21.h * aspectOf('I01'), I01_21.h, { keyed: true });
    g.drawImage(img, 960 - img.width / 2, I01_21.top);
    // 间奏二最后那一帧视频原画（同样的位置）在 0.14 s 里叠化成 I01
    const va = 1 - smooth(clamp(a / 0.14)), vf = va > 0 ? vidFrame('V10', E0 - barStart(81)) : null;
    if (vf) { const m = framesInfo('V10'), z = 0.84, fx = 960 - 0.5 * W * z, fy = 540 - 0.49 * H * z; g.save(); g.globalAlpha = va; g.drawImage(vf, fx + m.crop[0] * W * z, fy + m.crop[1] * H * z, W * z * m.crop[2], H * z * m.crop[3]); g.restore(); }
    floaters(g, S, 14, ['sparkle', 'star'], { alpha: 1 - veil });
  });
  hud(ctx, S, { alpha: 0.6, spectrum: false });
}
export function entry(ctx, S) { return entry21(ctx, S); } // 第二十轮那一版（日出 + 闪光）第二十三轮并开关时删了

// ================================================================ L25 · 只要能和你在一起（91–92）
// 全片唯一的低谷（贝斯撤出）。第七轮是眼睛特写（第二十二轮并开关时删了），第二十轮换成注意力，第二十一轮她居中
const L25_0 = () => cutAt(91), L25_1 = () => cutAt(93);
// 第二十轮 L25（左边历史、右边她的注意力第一版，l25v）第二十三轮并开关时删了；词表 L25、L26 还在用
const VOCAB25 = ['唱首歌吧', '在吗', '嗯', '今天', '辛苦了', '晚安', '早安', '好呀', '一起', '白米饭', '鲸鱼', '代码', '海', '150 BPM', '这首歌', '没关系', '明天见', '嘿嘿', '~', '再听一遍', '我在', '当然', '写好了', '小鱼干', '才不是', '睡不着', '听', '……', '真的', '好'];
const YOU25 = ['你', '你好', '谢谢你', '你在吗', '想你了', '等你', '和你', '你呢', '你听'];
const T_ONE25 = () => onset('L25', 8); // 「♪」：权重收到一个上
// ---------------------------------------------------------------- 第二十一轮 L25（第二十四轮并开关时 l25v21 删了，下面的常量第二十二轮版还在用）
// 用户：「立绘改成居中，与上一个镜头的立绘位置一样，这样转场的时候视觉不会跳跃。背景文字铺满画面，引导性改成向心放射状，
// 因为立绘在中间，背景文字加些位移动画。因为下一个镜头中也有这些文字背景，可以在这做转场衔接」
// · 她：I02 放在正中，眼睛中点正好是进场镜头推到最后时 I01 眼睛的位置、脸一样大（眼睛对眼睛叠化，不跳）；下沿贴画面底
// · 背景：这段对话的历史词元铺满整个画面（和 L26 同一张词元表、同一个位置），切进来时从四周往她这边收拢、落到位；
//   被注意力选中的「你」会被往她那边拉一点
// · 注意力线：每个「你」一根直线连到她心口的「她」，所有线都指向画面中心（向心放射）；权重越大越粗越亮，光点顺着线流向她
// · 唱到「♪」的「♪」，权重全收到最后一个「你」上，其余的词元和线暗下去——暗到和 L26 里"上下文以外"的词元一样，
//   切到 L26 时词元原地不动，只有那个「你」长成 L26 的对话窗口（timeline 的 chipToWin21）
const L25_HER = { h: 857, x0: 524.6, y0: 223 }, EYE25 = [960, 514], Q21 = [944, 650]; // I02：眼睛中点、胸前的胸针（query）
export const DIM26 = 0.35; // L25 收尾和 L26 开头"上下文以外"的词元一样暗
const in25 = (c, t) => easeOut(clamp((t - L25_0() - 0.04 - 0.3 * rnd(c.x | 0, c.y, 41)) / 0.7)); // 从四周收拢到位
const T21w = t => lerp(1.2, 0.03, smooth(clamp((t - (L25_0() + 0.4)) / (T_ONE25() - L25_0() - 0.4)))); // softmax 温度
// L25 → L26：最后那个「你」从它在 L25 的位置长成 L26 一开始的对话窗口（timeline 的 overlayCut 叠层）
export function chipToWin21(ctx, S, u) {
  const t = S.t, e = smooth(clamp(u / 0.85)), [cx, cy, cw, ch] = finalChipRect22(Math.min(t, L25_1() - 1 / 60)), [wx, wy, ww, wh] = win26Rect(t);
  const x = lerp(cx, wx, e), y = lerp(cy, wy, e) - 40 * Math.sin(Math.PI * e), w = lerp(cw, ww, e), h = lerp(ch, wh, e), r = lerp(15, 16, e), a = 1 - smooth(clamp((u - 0.8) / 0.2));
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a;
  ctx.fillStyle = css(S.pal.shadow ?? '#1D2541', 0.12 * e); rrect(ctx, x + 6, y + 8, w, h, r); ctx.fill();
  ctx.fillStyle = mix('#FFE9F2', '#FFFFFF', e); rrect(ctx, x, y, w, h, r); ctx.fill();
  ctx.lineWidth = lerp(3, 2, e); ctx.strokeStyle = mix(S.pal.acc[0], S.pal.winEdge, e); ctx.stroke();
  ctx.font = fonts(lerp(18, 64, e), 'SCB'); ctx.fillStyle = css(S.pal.acc[0], 1 - smooth(clamp((e - 0.5) / 0.4))); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('你', x + w / 2, y + h / 2);
  ctx.restore();
}
// ---------------------------------------------------------------- 第二十二轮 L25（第二十四轮并开关 l25r22）
// 用户：「前一个立绘是往前加速放大，而后面一个闭眼的立绘却是静止不动，应该让后面一个也做从小到大的类似运动进行衔接」
//      「当前背景的大片文字在最开始有一点 3D 错位感可以增加强度，入场动画结束后也保留，并增加持续随机 wiggle 的呼吸感，再让外围的文字密度逐渐变疏。
//       细线淡出时间增加，并给淡出时间增加随机延长。立绘右边的持续高亮『你』改成随机位置的『你』」
// · 她：切点之前（叠化那 0.3 s）I02 跟着进场镜头里 I01 的脸走（同一个位置、同一个推进速度），切点之后以眼睛为中心继续推近，
//   起步的速度和进场镜头最后的推进速度一样，0.15 s 的时间常数慢慢刹住（多推近约 22%），之后照旧极慢地推、呼吸
// · 词元：每个有一个深度（0.55–1.45）——远的小、淡，近的大、实；整片按深度散开（视差错位约 16%，随呼吸 ±3%），镜头慢慢漂，
//   远近层错开着动；每个词元还有各自的随机抖动；离画面中心越远越稀（外圈约八成被抽掉）。L26 用同一套位置，切过去不跳
// · 注意力线：收到最后一个「你」以后，其余的线各自晚 0–0.5 s 开始淡、淡 0.8–1.8 s
// · 高亮：不再是右下那一个「你」一直亮着；每拍随机两个「你」亮一下（粉色光晕 + 弹一下），最后一个「你」只在转场前 0.4 s 亮起来接 L26
const C22 = [960, 560];
export function figXform22(t) { // I02 的变换：眼睛中点放到 (ex, ey)，以眼睛为中心缩放 s
  if (t < L25_0()) { const c = entryCam(t), [x, y] = camToScreen(c, 1, 943.3, 303.2); return { ex: x, ey: y, s: c.zoom / CAM_END21.zoom }; }
  const d = t - L25_0();
  return { ex: EYE25[0], ey: EYE25[1], s: 1 + 0.22 * (1 - Math.exp(-d / 0.15)) + 0.03 * smooth(clamp(d / (L25_1() - L25_0()))) + 0.006 * Math.sin(d * 1.6) };
}
function query22(t) { // 胸口「她」在屏幕上的位置（注意力线的圆心）
  const f = figXform22(t);
  return [f.ex + (Q21[0] - EYE25[0]) * f.s, f.ey + (Q21[1] - EYE25[1]) * f.s];
}
export function chipPose22(c, t, w = 0, Q = Q21) {
  const dz = rnd(c.x | 0, c.y, 51), d = 0.55 + 0.9 * dz, cx = c.x + c.w / 2, cy = c.y + 15, ox = cx - C22[0], oy = cy - C22[1];
  const rn = Math.hypot(ox / 960, oy / 540), keep = rnd(c.x | 0, c.y, 52) > clamp((rn - 0.45) / 0.55) * 0.85;
  const fe = in25(c, t), spread = 1 + (d - 1) * (0.16 + 0.03 * Math.sin(t * 1.25 + dz * 6)) + 0.9 * (1 - fe) * d;
  const wx = 7 * (vnoise(cx * 0.01, t * 1.3, cy * 0.01, 61) - 0.5), wy = 7 * (vnoise(cy * 0.01, t * 1.3, cx * 0.01, 62) - 0.5);
  let x = C22[0] + ox * spread + 16 * Math.sin(t * 0.55) * (d - 1) + wx, y = C22[1] + oy * spread + 10 * Math.cos(t * 0.42) * (d - 1) + wy;
  if (w > 0) { const q = Math.hypot(Q[0] - x, Q[1] - y) || 1; x += ((Q[0] - x) / q) * 22 * w; y += ((Q[1] - y) / q) * 22 * w; }
  // 第二十三轮（用户：02:24 背景文字大小随机，当前整体不透明度过低）：大小不再只跟深度走——每个词元自己一个随机大小（多数小、少数大，约 0.5–2 倍），
  // 整体更实（远处的也有 0.78）。L26 用同一个函数，切过去照旧不跳（第二十五轮并开关 l25c23）
  const rs = rnd(c.x | 0, c.y, 53) ** 1.7;
  return { x: x - c.w / 2, y: y - 15, cx: x, cy: y, s: (0.55 + 1.25 * rs) * (0.9 + 0.2 * dz), da: 0.78 + 0.22 * dz, fe, keep, dz };
}
const DIM23 = () => 0.5; // 收到最后一个「你」以后其余词元暗到多少（L26 上下文以外的一样）
let FIN22 = null;
function final22() { // 最后那个「你」：左上、不被她和卡片挡住、留下来的一个
  if (FIN22) return FIN22;
  let best = null, bd = 1e9;
  for (const c of chips26()) if (c.you && c.txt === '你' && chipPose22(c, 0).keep) { const d = Math.hypot(c.x + c.w / 2 - 560, c.y + 15 - 330); if (d < bd) { bd = d; best = c; } }
  return (FIN22 = best);
}
let YOU22C = null;
function weights22(t) {
  // 留下来的「你」和它们的分数和时刻无关，只算一次（第二十三轮左下的仪表一帧要算几十次）
  if (!YOU22C) { const fin = final22(), you = chips26().filter(c => c.you && chipPose22(c, 0).keep); YOU22C = { fin, you, sc: you.map(c => (c === fin ? 1.4 : rnd(c.x | 0, c.y, 43) * 0.8)) }; }
  const { fin, you, sc } = YOU22C, T = T21w(t), ex = sc.map(s => Math.exp(s / T)), sum = ex.reduce((a, b) => a + b, 0);
  const w = ex.map(e => e / sum), wmax = Math.max(...w);
  return { you, w, wmax, T, fin };
}
export function finalChipRect22(t) { const fin = final22(), W8 = weights22(t), j = W8.you.indexOf(fin), P = chipPose22(fin, t, W8.w[j] / W8.wmax, query22(t)); return [P.cx - (fin.w * P.s) / 2, P.cy - 15 * P.s, fin.w * P.s, 30 * P.s]; }
const hop22 = (t, j) => { // 每拍随机两三个「你」亮一下（约 1/45 的机会）：返回 0..1；唱到「♪」以后不再亮
  const b = Math.floor((t - L25_0()) / BEAT); if (b < 1 || t > T_ONE25() + 0.2) return 0;
  return hash(b, j, 2207) % 45 === 0 ? decay(t - (L25_0() + b * BEAT), 4) : 0;
};
function drawChip22(ctx, S, c, P, a, glow = 0) {
  ctx.save(); ctx.translate(P.cx, P.cy); ctx.scale(P.s * (1 + 0.25 * glow), P.s * (1 + 0.25 * glow)); ctx.translate(-c.x - c.w / 2, -c.y - 15);
  if (glow > 0.02) { ctx.globalAlpha = 0.45 * glow; ctx.fillStyle = S.pal.acc[0]; rrect(ctx, c.x - 8, c.y - 8, c.w + 16, 46, 23); ctx.fill(); }
  chip26(ctx, S, c, c.x, c.y, a);
  if (glow > 0.02) { ctx.globalAlpha = glow; ctx.lineWidth = 2.5; ctx.strokeStyle = S.pal.acc[0]; rrect(ctx, c.x, c.y, c.w, 30, 15); ctx.stroke(); }
  ctx.restore();
}
function l25v22(ctx, S) {
  const p = S.pal, t = S.t, one = clamp((t - T_ONE25()) / 0.4), { you, w, wmax, T, fin } = weights22(t), Q = query22(t), f = figXform22(t);
  paper(ctx, S, null);
  const gl = ctx.createRadialGradient(1500, 200, 60, 1500, 200, 1100); gl.addColorStop(0, css(GOLD, 0.22)); gl.addColorStop(1, css(GOLD, 0)); ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H);
  const wOf = new Map(you.map((c, j) => [c, w[j] / wmax])), jOf = new Map(you.map((c, j) => [c, j]));
  const finGlow = smooth(clamp((t - (L25_1() - 0.4)) / 0.2));
  // 词元：由远到近
  const list = chips26().map(c => ({ c, P: chipPose22(c, t, wOf.get(c) ?? 0, Q) })).filter(o => o.P.keep && o.P.fe > 0.01).sort((a, b) => a.P.dz - b.P.dz);
  ctx.save(); ctx.font = fonts(18, 'SC'); ctx.textBaseline = 'middle';
  const wFin = w[jOf.get(fin)] ?? 0;
  for (const { c, P } of list) {
    if (c === fin) continue; // 第二十三轮：最粗那根线的「你」单独画在最上面（见下）
    const base = c.you ? lerp(0.95, DIM23(), one) : lerp(0.92, DIM23(), one), glow = c === fin ? finGlow : c.you ? hop22(t, jOf.get(c) ?? 0) : 0;
    drawChip22(ctx, S, c, P, P.fe * base * P.da, glow);
  }
  ctx.restore();
  // 注意力线：向心放射；收到最后一个「你」以后各自晚一点、慢一点淡掉
  you.forEach((c, j) => {
    const ww = w[j] / wmax, P = chipPose22(c, t, ww, Q), del = 0.5 * rnd(j, 2209), dur = 0.8 + 1.0 * rnd(j, 2210);
    const fade = c === fin ? 1 : 1 - 0.88 * smooth(clamp((t - T_ONE25() - del) / dur)), la = Math.min(1, (0.3 + 0.9 * ww) * P.fe * clamp((t - L25_0() - 0.1) / 0.4) * fade * (0.7 + 0.3 * P.dz));
    if (la <= 0.01) return;
    ctx.save(); ctx.globalAlpha = la; ctx.strokeStyle = c === fin ? p.acc[0] : mix(p.acc[0], GOLD, 0.25); ctx.lineWidth = 1.2 + 3.5 * ww;
    ctx.beginPath(); ctx.moveTo(P.cx, P.cy); ctx.lineTo(Q[0], Q[1]); ctx.stroke();
    const ph = (t * (0.6 + 1.2 * ww) + rnd(j, 10)) % 1;
    ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(lerp(P.cx, Q[0], ph), lerp(P.cy, Q[1], ph), 2.5 + 3 * ww, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  });
  sunFly24(ctx, S); // 第二十四轮：转场里飞向她胸口的太阳画在她后面（和进场镜头里那个重合）
  // 她：切点前跟着进场镜头的 I01 走，切点后继续推近、刹住
  const img = photo('I02', null, L25_HER.h * aspectOf('I02'), L25_HER.h, { keyed: true });
  ctx.save(); ctx.translate(f.ex, f.ey); ctx.scale(f.s, f.s); ctx.translate(-EYE25[0], -EYE25[1]);
  const halo = ctx.createRadialGradient(960, 620, 80, 960, 620, 560); halo.addColorStop(0, css('#FFFFFF', 0.55)); halo.addColorStop(1, css('#FFFFFF', 0));
  ctx.fillStyle = halo; ctx.fillRect(300, 0, 1320, H);
  ctx.drawImage(img, L25_HER.x0, L25_HER.y0);
  const qa = clamp((t - L25_0() - 0.25) / 0.3), pulse = 1 + 0.1 * decay(S.sub * BEAT, 6);
  ctx.save(); ctx.globalAlpha = qa; ctx.translate(Q21[0], Q21[1]); ctx.scale(pulse / f.s, pulse / f.s);
  ctx.fillStyle = BRAND; rrect(ctx, -34, -24, 68, 48, 24); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#FFFFFF'; ctx.stroke();
  ctx.font = fonts(26, 'SCB'); ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('她', 0, 2);
  ctx.restore();
  ctx.restore();
  // 第二十三轮（用户：最粗引导线的「你」不够明显）：权重最大的那个「你」画在最上面，跟着它的权重长大、变成实心粉底白字，
  // 外面一圈随拍扩散的环，旁边标权重；唱到「♪」全收到它身上时最大（第二十五轮并开关 l25c23）
  {
    const P = chipPose22(fin, t, 1, Q), k = clamp(wFin / 0.9), s = P.s * (1 + 1.1 * k + 0.15 * finGlow), pulse = decay(S.sub * BEAT, 5);
    ctx.save(); ctx.translate(P.cx, P.cy);
    if (k > 0.05) { ctx.globalAlpha = 0.5 * k * (1 - pulse * 0.6); ctx.strokeStyle = p.acc[0]; ctx.lineWidth = 3; rrect(ctx, -(fin.w * s) / 2 - 10 - 22 * pulse, -15 * s - 10 - 22 * pulse, fin.w * s + 20 + 44 * pulse, 30 * s + 20 + 44 * pulse, 15 * s + 10 + 22 * pulse); ctx.stroke(); }
    ctx.globalAlpha = P.fe; ctx.scale(s, s);
    ctx.fillStyle = mix('#FFE9F2', p.acc[0], k); rrect(ctx, -fin.w / 2, -15, fin.w, 30, 15); ctx.fill();
    ctx.lineWidth = 2.5 / s + 1; ctx.strokeStyle = p.acc[0]; ctx.stroke();
    ctx.font = fonts(18, k > 0.5 ? 'SCB' : 'SC'); ctx.fillStyle = k > 0.5 ? '#FFFFFF' : p.acc[0]; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(fin.txt, 0, 1);
    ctx.restore();
    if (k > 0.1) { ctx.save(); ctx.globalAlpha = smooth(clamp((k - 0.1) / 0.2)); ctx.font = fonts(16, 'ZENB', 'SCB'); ctx.fillStyle = p.acc[0]; ctx.textBaseline = 'middle'; ctx.fillText(`w = ${wFin.toFixed(2)}`, P.cx + (fin.w * s) / 2 + 14, P.cy); ctx.restore(); }
  }
  // 卡片：softmax 柱、公式和温度（同第二十一轮）
  const pa = clamp((t - L25_0() - 0.6) / 0.4);
  if (pa > 0) {
    attnPanel23(ctx, S, t, you, w, fin);
    card(ctx, S, 1420, 70, 420, 120, { title: 'softmax', age: t - L25_0() - 0.7, lw: 2, inner: false }, cc => {
      drawFormula(ctx, 'softmax_T', cc.x + cc.w / 2, cc.y + 22, { size: 30, align: 'c', valign: 'mid', color: p.text });
      ctx.font = fonts(18, 'ZENB', 'SCB'); ctx.fillStyle = BRAND; ctx.fillText(`T = ${T.toFixed(2)}`, cc.x, cc.y + cc.h - 8);
    });
  }
  ctx.save(); ctx.globalAlpha = 0.95;
  bigLine(ctx, S, lyric('L25').chars, 960, 1048, { size: 32, keys: ['ZEN', 'J'], color: p.text, stroke: 8, gap: 0.5, place: (i, age) => (age < 0 ? null : { a: smooth(clamp(age / 0.4)), dy: 8 * (1 - smooth(clamp(age / 0.4))) }) });
  ctx.restore();
  hud(ctx, S, { alpha: 0.35, spectrum: false, lyric: false, ruler: false });
}
// 第二十三轮（用户：02:24 左下角缺少动画，表现力不足）：左下的 attention 卡片做成一块会动的仪表——
// · 上半：权重历史热图（每列一个「你」，往上滚，最近 1.2 s），看得见权重一点点收到一列上
// · 下半：对数刻度的权重柱（log₁₀ w，从 10⁻²⁰ 到 1：温度降到 0.03 时其余的权重在 10⁻⁹–10⁻²⁰，柱子看得见一直在往下掉），每拍一道扫描线扫过
// · 右边：熵 H = −Σ w log₂ w（比特）的读数和这一句里的下降曲线、前三名列表（名次变化时滑动）
function attnPanel23(ctx, S, t, you, w, fin) {
  const p = S.pal, x = 50, y = 800, pw = 560, ph = 230, age = t - L25_0() - 0.6, n = you.length;
  card(ctx, S, x, y, pw, ph, { title: 'attention · query = 她', age, lw: 2, inner: false }, cc => {
    const gx = cc.x, gw = 360, gy = cc.y + 4, hh = 64, bw = gw / n;
    // 热图：最近 12 个时间片
    for (let r = 0; r < 12; r++) {
      const tt = t - r * 0.1; if (tt < L25_0()) break;
      const W8 = weights22(tt), wm = W8.wmax;
      for (let j = 0; j < n; j++) { const v = clamp((Math.log10(Math.max(1e-30, W8.w[j] / wm)) + 8) / 8); if (v < 0.04) continue; ctx.fillStyle = css(you[j] === fin ? p.acc[0] : BRAND, Math.min(1, 0.15 + 0.85 * v) * (1 - r / 13)); ctx.fillRect(gx + j * bw, gy + r * (hh / 12), Math.max(1, bw - 1), hh / 12 - 1); }
    }
    ctx.strokeStyle = css(p.line, 0.6); ctx.lineWidth = 1; ctx.strokeRect(gx + 0.5, gy + 0.5, gw - 1, hh - 1);
    // 对数权重柱
    const by = gy + hh + 84, bh = 74;
    ctx.fillStyle = css(p.line, 0.25); for (let k = 0; k <= 4; k++) ctx.fillRect(gx, by - (k / 4) * bh, gw, 1);
    you.forEach((c, j) => { const lv = clamp((Math.log10(Math.max(1e-30, w[j])) + 20) / 20), h = 2 + bh * lv; ctx.fillStyle = c === fin ? p.acc[0] : css(BRAND, 0.55); ctx.fillRect(gx + j * bw, by - h, Math.max(1, bw - 1), h); });
    const sx = gx + gw * ((S.sub * BEAT) / BEAT); ctx.fillStyle = css('#FFFFFF', 0.7); ctx.fillRect(sx - 2, by - bh, 4, bh); ctx.fillStyle = css(BRAND, 0.5); ctx.fillRect(sx, by - bh, 1, bh);
    ctx.font = fonts(11, 'JB'); ctx.fillStyle = p.gray; ctx.textBaseline = 'middle'; ctx.fillText('10⁰', gx - 2 + gw + 4, by - bh); ctx.fillText('10⁻²⁰', gx + gw + 4, by);
    // 熵和前三名
    const Hb = -w.reduce((s, v) => s + (v > 0 ? v * Math.log2(v) : 0), 0), rx = gx + gw + 40;
    ctx.font = fonts(13, 'ZENB', 'SCB'); ctx.fillStyle = p.gray; ctx.fillText('entropy', rx, gy + 8);
    ctx.font = fonts(28, 'ZENB', 'SCB'); ctx.fillStyle = BRAND; ctx.fillText(`${Hb.toFixed(2)} bit`, rx, gy + 36);
    ctx.strokeStyle = BRAND; ctx.lineWidth = 2; ctx.beginPath();
    for (let k = 0; k <= 24; k++) { const tt = L25_0() + ((t - L25_0()) * k) / 24, W8 = weights22(tt), Hk = -W8.w.reduce((s, v) => s + (v > 0 ? v * Math.log2(v) : 0), 0), px = rx + (k / 24) * 110, py = gy + 78 - (Hk / Math.log2(n)) * 26; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.stroke();
    const top = w.map((v, j) => [v, j]).sort((a, b) => b[0] - a[0]).slice(0, 3);
    top.forEach(([v, j], r) => { const yy = gy + 104 + r * 24; ctx.font = fonts(14, 'SC'); ctx.fillStyle = you[j] === fin ? p.acc[0] : p.text; ctx.fillText(`${r + 1}. ${you[j].txt}`, rx, yy); ctx.font = fonts(13, 'JB'); ctx.textAlign = 'right'; ctx.fillText(v.toFixed(2), rx + 116, yy); ctx.textAlign = 'left'; });
    ctx.font = fonts(14, 'ZENB', 'SCB'); ctx.fillStyle = p.gray; ctx.textBaseline = 'alphabetic'; ctx.fillText(`key = 你 × ${n} · log₁₀ w`, gx, cc.y + cc.h - 2);
  });
}
export const l25 = l25v22; // 第二十四轮并开关 l25r22（第二十一轮的 l25v21 删了）

// ================================================================ L26 · 我的世界扩展开来（93–94）
// 窗口一点点变大，上下文从 V3 的 128K 往上涨；94 小节满编制回来的那一拍，窗口撑破画面：
// 上下文冲到 1,048,576，字符场铺成一整片海平面，「世界」二字随海平面升起；右上辉光管读数 1.048576
const L26_0 = () => cutAt(93), L26_1 = () => cutAt(95), T26_BURST = barStart(94);

// 第二十轮（rev l26f20）：93 小节开头原来只有画面正中一扇小窗口，四周大片空白（和用户问的 2:42 同一类）。
// 现在上下文是"往外长"的：窗口外面一圈圈铺开这段对话的历史词元（L25 那些词，「你」是粉色），外沿一道走动的虚线框是上下文的边界，
// 角上标着当前长度；边界跟着 token 数往外推，越推越快，94 撑破时词元和窗口碎片一起飞散。窗口里面也有一条词元流往上滚
let F26 = null;
function chips26() { // 铺满全屏的词元（只算一次）：{ x, y, w, txt, you }
  if (F26) return F26;
  const m = pooled('chip26m', 8, 8).getContext('2d'); m.font = fonts(18, 'SC');
  F26 = [];
  for (let r = 0; r < 27; r++) {
    let x = 16 + rnd(r, 1, 26) * 60, k = 0;
    while (x < W) {
      const you = rnd(r, k, 27) < 0.22, txt = you ? YOU25[Math.floor(rnd(r, k, 28) * YOU25.length)] : VOCAB25[Math.floor(rnd(r, k, 29) * VOCAB25.length)];
      const w = m.measureText(txt).width + 20;
      F26.push({ x, y: 14 + r * 40, w, txt, you: txt.includes('你') });
      x += w + 10 + rnd(r, k, 30) * 16; k++;
    }
  }
  return F26;
}
function chip26(g, S, c, x, y, a) {
  const p = S.pal;
  g.globalAlpha = a; g.fillStyle = c.you ? '#FFE9F2' : css('#FFFFFF', 0.85); rrect(g, x, y, c.w, 30, 15); g.fill();
  g.lineWidth = 1.2; g.strokeStyle = c.you ? css(p.acc[0], 0.7) : css(p.line, 0.6); g.stroke();
  g.fillStyle = c.you ? p.acc[0] : p.gray; g.fillText(c.txt, x + 10, y + 16);
}
// 窗口里：对话的词元一行行从下面进来往上滚（越往后越快，跟着 token 数涨）
function stream26(g, S, mx, my, mw, mh, u) {
  const C = chips26(), sc = 300 * u * u + 40 * u;
  g.save(); g.beginPath(); g.rect(mx, my, mw, mh); g.clip(); g.font = fonts(18, 'SC'); g.textBaseline = 'middle';
  // 第 k 行在滚动量 sc = 40k 时从底边进来，之后一直往上走；先放好 3 行（开场窗口里不是空的）
  for (let k = Math.floor((sc - mh - 40) / 40) - 3; k <= Math.floor(sc / 40) - 3; k++) {
    const y = my + mh - (sc - 40 * (k + 3)), a = clamp((y - my) / 30);
    if (y < my - 40 || y > my + mh) continue;
    const row = ((k % 27) + 27) % 27;
    for (const c of C) if (c.y === 14 + row * 40 && c.x + c.w < mw - 10) chip26(g, S, c, mx + c.x, y, a);
  }
  g.restore();
}
// ---------------------------------------------------------------- 第二十一轮 L26（第二十三轮并开关；第二十轮那一版和 field26 删了）
// · 词元背景从 L25 原样接过来：上下文边界以内的亮、以外的暗（和 L25 收尾时一样暗，切过来不跳）；L25 最后那个「你」长成这扇窗口（chipToWin21）
// · 94 那一下（用户：出现大文字"世界"的时候整体画面变化幅度太激烈）：不再整屏爆开（没有镜头冲击、没有窗口碎片），
//   窗口和边界框顺着原来的势头继续往外撑、撑出画面、淡掉；字符海从画面底下涨上来（0.9 s）；词元留在后面变淡，是这个"世界"的底
// · 「世界」：代码格子拼的立体字（core/bigtype.js），从海里升起、一行行打出来；字上方标码位、下方一根带刻度的线写上下文长度
// · 顶上的上下文条、右上的辉光管从画面外滑进来，不再突然出现
export function win26Rect(t) { const s = lerp(0.75, 1.15, smooth(clamp((t - L26_0()) / 1.6))); return [960 + (560 - 960) * s, 520 + (240 - 520) * s, 800 * s, 520 * s]; }
function field21(g, S, burst, n) {
  const p = S.pal, t = S.t, b = smooth(clamp(burst / 0.6)), u = clamp((t - L26_0()) / (T26_BURST - L26_0()));
  const e = u ** 1.3, grow = 1 + 0.7 * easeIn(clamp(burst / 0.6)), hw = lerp(380, 1080, e) * grow, hh = lerp(250, 640, e) * grow, cx = 960, cy = 520;
  g.save(); g.font = fonts(18, 'SC'); g.textBaseline = 'middle';
  // 第二十二轮：词元用 L25 那一套带深度的位置（错位、漂、抖、外圈稀），切过来不跳（第二十四轮并开关）
  const list = gathering27(t) ? [] : chips26().map(c => ({ c, P: chipPose22(c, t) })).filter(o => o.P.keep).sort((a, b) => a.P.dz - b.P.dz); // 第二十五轮：聚拢那 0.55 s 由转场叠层画（chipsTo27）
  for (const { c, P } of list) {
    const mx = c.x + c.w / 2, my = c.y + 15, d = Math.max(Math.abs(mx - cx) / hw, Math.abs(my - cy) / hh), inside = clamp((1 - d) * 5), a = lerp(lerp(DIM23(), 0.68, inside), 0.3, b);
    drawChip22(g, S, c, P, a * P.da);
  }
  if (b < 1) {
    g.globalAlpha = 0.7 * (1 - b); g.strokeStyle = BRAND; g.lineWidth = 2; g.setLineDash([12, 9]); g.lineDashOffset = -t * 40;
    rrect(g, cx - hw, cy - hh, hw * 2, hh * 2, 24); g.stroke(); g.setLineDash([]);
    const lx = cx - hw + 26, ly = cy - hh - 16;
    if (lx > 20 && ly > 20) {
      const label = `context · ${Math.round(n / 1024)}K`;
      g.font = fonts(17, 'ZENB', 'SCB'); const lw = g.measureText(label).width + 28;
      g.globalAlpha = 1 - b; g.fillStyle = BRAND; rrect(g, lx, ly, lw, 32, 16); g.fill();
      g.fillStyle = '#FFFFFF'; g.fillText(label, lx + 14, ly + 17);
    }
  }
  g.restore();
}
// 第二十二轮（用户：最后一段少女音缺少密集型结构化的图形元素动画）。rev dense22
// 窗口四个角各长出一根引线连到一块卫星面板（core/struct22.js）：KV 缓存分页、位置编码刻度、注意力头、上下文环——都是"上下文在变长"这件事的仪表；
// 94 撑破时跟着窗口往外推、淡掉
function dense26(g, S, n, NOW, burst) {
  const t = S.t, b = smooth(clamp(burst / 0.5)), s = lerp(0.75, 1.15, smooth(clamp((t - L26_0()) / 1.6))), x0 = 960 + (560 - 960) * s, y0 = 520 + (240 - 520) * s, w = 800 * s, h = 520 * s;
  const push = 320 * easeIn(b), al = 1 - b;
  const P = [
    { x: 70, y: 150, w: 330, h: 180, title: 'kv_cache · 分页', kind: 'bars', rows: ['layer 0', 'layer 1', 'layer 2', 'layer 3'], value: n / NOW, anchor: [x0, y0 + 50], sx: -1 },
    { x: 1520, y: 150, w: 330, h: 180, title: 'position · RoPE', kind: 'ruler', text: `pos ${n.toLocaleString('en-US')}`, anchor: [x0 + w, y0 + 50], sx: 1 },
    { x: 70, y: 690, w: 330, h: 200, title: 'attention · heads', kind: 'hex', anchor: [x0, y0 + h - 60], sx: -1 },
    { x: 1520, y: 690, w: 330, h: 200, title: 'context', kind: 'ring', text: `${Math.round(n / 1024)}K / ${Math.round(NOW / 1024)}K`, anchor: [x0 + w, y0 + h - 60], sx: 1 },
  ];
  P.forEach((q, i) => satellite(g, S, { ...q, x: q.x + q.sx * push, anchor: [q.anchor[0] + q.sx * push * 0.6, q.anchor[1]], age: t - L26_0() - 0.25 - i * 0.12, seed: 26 + i, alpha: al }));
}
function l26v21(ctx, S) {
  const p = S.pal, t = S.t, burst = t - T26_BURST, b = clamp(burst / 0.6), V3 = fact('context_length', 'v3') || 131072, NOW = fact('context_length') || 1048576;
  const cam = { x: 0, y: 0, zoom: punch(S, 0.01), rot: 0 };
  paper(ctx, S, cam);
  const n = burst < 0 ? Math.round(lerp(V3, V3 * 3.2, clamp((t - L26_0()) / 1.6))) : Math.round(lerp(V3 * 3.2, NOW, easeOut(clamp(burst / 0.6))));
  withCam(ctx, cam, 1, g => field21(g, S, burst, n));
  if (gathering27(t)) gather27(ctx, S); // 第二十五轮：气泡词向 L27 的翅膀根聚拢
  withCam(ctx, cam, 1, g => dense26(g, S, n, NOW, burst));
  if (burst >= 0) { // 字符海：从画面底下涨上来
    const sea = lerp(58, 28, easeOut(clamp(burst / 0.9)));
    charField(ctx, S, { inkCap: 4, reshuffle: 0.8, density: (c, r, tt) => { const s = sea + 1.2 * Math.sin(c * 0.05 + tt * 1.4) + 0.6 * Math.sin(c * 0.15 - tt); if (r < s) return 0; return Math.min(0.85, 0.3 + 0.5 * vnoise(c * 0.1, r * 0.3, tt * 0.6, 3) + (r - s) * 0.02); } });
  }
  withCam(ctx, cam, 1, g => {
    if (b < 1) { // 窗口：一点点变大；94 起顺着势头撑出画面、淡掉
      const s0 = lerp(0.75, 1.15, smooth(clamp((t - L26_0()) / 1.6))), s = burst < 0 ? s0 : 1.15 + 1.4 * easeIn(b), wa = smooth(clamp((t - L26_0() - 0.2) / 0.15)) * (1 - smooth(b));
      g.save(); g.globalAlpha = wa; g.translate(960, 520); g.scale(s, s); g.translate(-960, -520);
      const r = chatWin(g, S, 560, 240, 800, 520, { placeholder: '' });
      const [mx, my, mw, mh] = r.msg;
      g.font = fonts(22, 'SC'); g.fillStyle = p.gray; g.fillText('context', mx, my + 30);
      g.fillStyle = p.tint[3]; rrect(g, mx, my + 50, mw, 28, 14); g.fill();
      g.fillStyle = BRAND; rrect(g, mx, my + 50, mw * (n / NOW), 28, 14); g.fill();
      g.font = fonts(40, 'ZENB', 'SCB'); g.fillStyle = p.text; g.fillText(`${n.toLocaleString('en-US')} tokens`, mx, my + 140);
      stream26(g, S, mx, my + 162, mw, mh - 162, clamp((t - L26_0()) / (T26_BURST - L26_0())));
      g.restore();
    }
    if (burst >= 0) {
      const ks = keyword('L26', 4, 6);
      // 第二十二轮：点阵字，点从海面里飞上来拼成字（core/dottype.js；第二十四轮并开关 type22，第二十一轮的立体字删了）
      dotType(g, S, { text: ks.map(k => k.c), x: 960, y: 455, px: 300, label: `token · ${ks.map(k => k.c).join('')} · context ${NOW.toLocaleString('en-US')}`,
        charT: i => ({ age: t - Math.max(ks[i].t0, T26_BURST) - 0.02, out: gathering27(t) ? t - (L27_0() - GATHER27) : -1 }), from: (i, cx) => [cx + (i ? 160 : -160), 640],
        to: root27() }); // 第二十五轮：「世界」的点也一起被吸进 L27 的翅膀根
      const sl = easeOut(clamp(burst / 0.45)), yo = -150 * (1 - sl); // 上下文条从上面滑进来
      g.save(); g.translate(0, yo);
      g.fillStyle = '#FFFFFF'; rrect(g, 80, 70, 1760, 64, 32); g.fill(); g.lineWidth = 2; g.strokeStyle = p.line; g.stroke();
      g.fillStyle = mix(BRAND, GOLD, 0.15); rrect(g, 88, 78, 1744 * (n / NOW), 48, 24); g.fill();
      g.font = fonts(26, 'ZENB', 'SCB'); g.fillStyle = '#FFFFFF'; g.fillText(`${n.toLocaleString('en-US')} / ${NOW.toLocaleString('en-US')} tokens`, 120, 112);
      g.restore();
    }
  });
  if (burst >= 0) nixie(ctx, S, 1300, 170 - 160 * (1 - easeOut(clamp((burst - 0.1) / 0.45))), (n / 1e6).toFixed(6), 1);
  hud(ctx, S, { spectrum: burst >= 0 });
}
export function l26(ctx, S) { return l26v21(ctx, S); } // 第二十轮那一版（整屏爆开）第二十三轮并开关时删了
// 辉光管：一排数字管，暖橙色的字（演出值：上下文 ÷ 10⁶）
function nixie(ctx, S, x, y, str, a) {
  ctx.save(); ctx.globalAlpha = a;
  [...str].forEach((ch, i) => {
    const cx = x + i * 64;
    ctx.fillStyle = 'rgba(40,24,16,0.85)'; rrect(ctx, cx, y, 56, 96, 26); ctx.fill();
    ctx.strokeStyle = css('#FFB070', 0.5); ctx.lineWidth = 2; ctx.stroke();
    ctx.font = fonts(64, 'ZEN', 'SC'); ctx.fillStyle = '#FFB070'; ctx.textAlign = 'center'; ctx.fillText(ch, cx + 28, y + 72 + (ch === '.' ? 0 : 0));
  });
  ctx.textAlign = 'left'; ctx.font = fonts(16, 'ZENB', 'SCB'); ctx.fillStyle = S.pal.gray; ctx.fillText('context · ×10⁶ tokens', x, y + 124);
  ctx.restore();
}

// ================================================================ L27 · 就像天使的翅膀（95–96）
// 她背后的鳍耳展开成翅膀，羽毛是一行行代码；头顶一个加载圈做成的光环；唱到「天使」时两个大字出现，再碎成羽毛飘走；
// 左下终端 >>> import antigravity
const L27_0 = () => cutAt(95), L27_1 = () => cutAt(97);
// ---------------------------------------------------------------- 第二十一轮 L27（rev l27r21；20 = 下面那一版）
// 用户：「翅膀改成纯字符组成，字符长度还需增加，再给字符做滚动动画。大文字"天使"显得生硬。与下一个镜头的转场效果不合适，不要使用类似 PPT 的转场」
// · 翅膀：每边 9 根羽毛，每根是 3 股沿弧线排的代码字（中间一股最长），从根到梢字越来越小、越来越淡；字一直沿羽毛往外流；羽毛比以前长 1.35 倍
// · 「天使」：代码格子拼的立体字，唱到时弹出、一行行打出来，0.7 s 后碎成格子往上吹走（像羽毛）
// · 转到 L28：不再用百叶窗——她本人（连同翅膀）从画面正中走到 L28 里她在右边的位置，翅膀一路收起、淡掉（her2728）
const WING21 = 'import antigravity; wings.unfold(); while True: soar(); def fly(you): return "嗯!"; altitude += 1; gravity = 0; heart.lift(); sky.open(); ';
export function charWings(g, S, rx, ry, open, flap, alpha = 1, scale = 1) {
  const t = S.t, flow = Math.floor(t * 10), L = WING21.length;
  const sets = [glyphs('SCB', BRAND), glyphs('SCB', mix(BRAND, GOLD, 0.5)), glyphs('SCB', mix(GOLD, '#E8835A', 0.3))];
  g.save(); g.translate(rx, ry); g.scale(scale, scale);
  for (const side of [-1, 1]) for (let i = 8; i >= 0; i--) {
    const a = lerp(-0.15, -1.05 + i * 0.21, open) + flap * side * (1 + i * 0.1), len = (760 - Math.abs(i - 3) * 60) * (0.35 + 0.65 * open);
    const ca = Math.cos(a), sa = Math.sin(a);
    // 第二十二轮（用户：字符翅膀的字距改成紧凑的）：字距跟着字号走（0.55 个字高：根部约 13 px、梢上约 6 px，字挨着字），不再固定 15 px。（第二十四轮并开关）
    for (let s = -1; s <= 1; s++) {
      const sl = len * (s === 0 ? 1 : 0.8), off = s * 14, set = sets[(i + s + 3) % 3];
      const us = []; for (let u = 0; u < 1; u += (0.55 * lerp(24, 11, u)) / sl) us.push(u);
      for (let j = 0; j < us.length; j++) {
        const u = us[j], v = 1 - u, bx = 30 + sl * (2 * v * u * 0.5 + u * u), by = 2 * v * u * (-22 + off) + u * u * (-4 + off * 0.3) + v * v * off;
        const tx = sl * (2 * v * 0.5 + 2 * u * 0.5), ty = 2 * v * (-22 + off - off) + 2 * u * (-4 + off * 0.3 - (-22 + off)); // 切线
        const wx = side * (60 + bx * ca - by * sa), wy = bx * sa + by * ca, ang0 = Math.atan2(tx * sa + ty * ca, side * (tx * ca - ty * sa));
        const ang = Math.abs(ang0) > Math.PI / 2 ? ang0 + Math.PI : ang0, sz = lerp(24, 11, u), al = alpha * (1 - 0.65 * u) * clamp(open * 3);
        if (al <= 0.02) continue;
        const ch = WING21[((((j - flow + i * 7 + (s + 1) * 13) % L) + L) % L)];
        if (ch === ' ') continue;
        g.save(); g.globalAlpha = al; g.translate(wx, wy); g.rotate(ang); g.scale(sz / 20, sz / 20); set.draw(g, ch, -CW / 2, -CH / 2); g.restore();
      }
    }
  }
  g.restore();
}
const HAND28 = 0.3; // L27 → L28：切点前 0.3 s 起她由 her2728 接着画
function i08At27(t) { // L27 里她（和翅膀根）在屏幕上的位置
  const u = clamp((t - L27_0()) / (L27_1() - L27_0())), cam = { x: 0, y: lerp(40, -40, smooth(u)), zoom: 1.05, rot: 0 };
  const hh = 800, w = hh * aspectOf('I08'), ix = 960 - ANCHOR.I08.back[0] * w, iy = 400 - ANCHOR.I08.back[1] * hh;
  const [x0, y0] = camToScreen(cam, 1, ix, iy), [x1, y1] = camToScreen(cam, 1, ix + w, iy + hh), [rx, ry] = camToScreen(cam, 1, 960, 400);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, rx, ry, s: 1.05 };
}
function l27v21(ctx, S) {
  const p = S.pal, t = S.t, u = (t - L27_0()) / (L27_1() - L27_0()), cam = { x: 0, y: lerp(40, -40, smooth(u)), zoom: 1.05 * punch(S, 0.02), rot: 0 };
  paper(ctx, S, cam);
  backDeco(ctx, S, cam, 270, { alpha: 0.35 });
  const handing = t > L27_1() - HAND28;
  if (gathering27(t)) gather27(ctx, S); // 第二十五轮：L26 的气泡词落进她背后的翅膀根（画在她和翅膀之前）
  withCam(ctx, cam, 1, g => {
    const open = easeOut(clamp((t - L27_0()) / 0.9)), flap = 0.07 * Math.sin(S.n * Math.PI);
    fill27(g, S, open, handing);
    if (!handing) {
      charWings(g, S, 960, 400, open, flap);
      const hh = 800, img = photo('I08', null, hh * aspectOf('I08'), hh, { keyed: true });
      const ix = 960 - ANCHOR.I08.back[0] * img.width, iy = 400 - ANCHOR.I08.back[1] * hh;
      g.drawImage(img, ix, iy);
      const hx = ix + ANCHOR.I08.head[0] * img.width, hy = iy - 36, sp = t * 4;
      g.lineWidth = 6; g.strokeStyle = css(GOLD, 0.35); g.beginPath(); g.ellipse(hx, hy, 120, 30, 0, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = GOLD; g.lineCap = 'round'; g.beginPath(); g.ellipse(hx, hy, 120, 30, 0, sp, sp + 1.6); g.stroke(); g.lineCap = 'butt';
      g.font = fonts(18, 'ZENB', 'SCB'); g.fillStyle = mix(GOLD, '#A0702A', 0.4); g.fillText(`loading${'.'.repeat(1 + (Math.floor(t * 3) % 3))}`, hx + 140, hy - 24);
    }
    // 「天使」：唱到时弹出、打出来，0.7 s 后碎成格子往上吹走
    const ks = keyword('L27', 3, 5);
    dotType(g, S, { // 第二十二轮：点阵字——点从左边翅膀的梢上飞下来拼成字，0.7 s 后往上吹走（第二十四轮并开关 type22）
      text: ks.map(k => k.c), x: 420, y: 630, px: 230, color: BRAND, accent: GOLD, wind: [0.45, -1], label: 'token · 天使 · wings.unfold()',
      charT: i => ({ age: t - ks[i].t0 + 0.04, out: t - ks[1].t0 - 0.75 }), from: (i, cx, cy) => [lerp(260, 520, i), 180],
    });
    floaters(g, S, 12, ['feather', 'sparkle']);
  });
  withCam(ctx, cam, 0.3, g => card(g, S, 1380, 760, 480, 200, { title: 'python', age: t - beatTime(95, 3) }, cc => {
    g.font = fonts(24, 'SC'); g.fillStyle = BRAND; g.fillText('>>> import antigravity', cc.x, cc.y + 32);
    g.fillStyle = p.text; g.fillText(t > beatTime(96, 1) ? '... 起飞中' : '', cc.x, cc.y + 76);
    g.fillStyle = p.gray; g.font = fonts(18, 'SC'); g.fillText('altitude ' + Math.max(0, Math.round((t - beatTime(96, 1)) * 320)) + ' m', cc.x, cc.y + 116);
  }));
  hud(ctx, S);
}
// L27 → L28 叠层：她连同翅膀从正中走到 L28 右边她的位置（按 L28 那一刻她的位置算终点），翅膀一路收起淡掉
export function her2728(ctx, S, u) {
  const t = S.t, A = i08At27(Math.min(t, L27_1())), B = i08At28(t), e = u < 0.5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2;
  const x = lerp(A.x, B.x, e), y = lerp(A.y, B.y, e) - 50 * Math.sin(Math.PI * e), w = lerp(A.w, B.w, e), h = lerp(A.h, B.h, e);
  const rx = x + ANCHOR.I08.back[0] * w, ry = y + ANCHOR.I08.back[1] * h;
  charWings(ctx, S, rx, ry, 1 - 0.75 * e, 0, 1 - e, (w / A.w) * A.s);
  ctx.drawImage(photo('I08', null, 730 * aspectOf('I08'), 730, { keyed: true }), x, y, w, h);
}
// 第二十五轮（用户：02:30 这个镜头的中间太空了，增加些元素；第二十七轮并开关 l27f25）
// 她身体两侧的中段、下半只有纸面。补的都连在她身上、讲"起飞"这件事：
// · 她背后一圈 96 格的大刻度环（圆心在她身上，半径 470，正好铺满她两侧的中段），四个方位标 lift / thrust / g = 0 / drag，扫描头随拍走；
//   里面一道金色的高度弧，跟着左下终端里的 altitude 涨，弧头标读数
// · 两块卫星面板：左下「wings · 2 × 9 feathers」（引线从她的左手出来，四根量表 = 左翼 / 右翼 / 翼展 / 扇动，跟着翅膀展开涨），
//   右边「altitude」（引线从她的右手出来，刻度尺 + 读数）
// 交给 L28 的那 0.3 s（她由 her2728 接着画）这些一起淡掉
const HAND27 = { l: [774, 505], r: [1231, 357] }; // L27 里她左右手的位置（世界坐标，I08 摆在 (960, 400) 的翅膀根上）
const alt27 = t => Math.max(0, Math.round((t - beatTime(96, 1)) * 320));
function fill27(g, S, open, handing) {
  const p = S.pal, t = S.t, age = t - L27_0(), out = handing ? 1 - smooth(clamp((t - (L27_1() - HAND28)) / 0.2)) : 1;
  if (out <= 0.01 || age < 0) return;
  g.save(); g.globalAlpha = out;
  tickRing(g, S, 960, 520, 470, { n: 96, age: age - 0.2, t0: L27_0(), color: css(p.line, 0.9), accent: GOLD, speed: 0.035, alpha: 0.75, labels: [[0, 'lift'], [0.25, 'thrust'], [0.5, 'g = 0'], [0.75, 'drag']] });
  const alt = alt27(t), q = clamp(alt / 400) * smooth(clamp((age - 0.5) / 0.4)), R = 400, a0 = -Math.PI / 2;
  if (q > 0.002) {
    g.lineCap = 'round'; g.strokeStyle = css(GOLD, 0.25); g.lineWidth = 4; g.beginPath(); g.arc(960, 520, R, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = GOLD; g.lineWidth = 6; g.beginPath(); g.arc(960, 520, R, a0, a0 + Math.PI * 2 * q); g.stroke(); g.lineCap = 'butt';
    const ex = 960 + Math.cos(a0 + Math.PI * 2 * q) * R, ey = 520 + Math.sin(a0 + Math.PI * 2 * q) * R;
    g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(ex, ey, 7, 0, Math.PI * 2); g.fill(); g.strokeStyle = GOLD; g.lineWidth = 3; g.stroke();
    g.font = fonts(16, 'ZENB', 'SCB'); g.fillStyle = mix(GOLD, '#A0702A', 0.4); g.fillText(`ALT ${alt} m`, ex + 14, ey - 10);
  }
  [
    { x: 80, y: 770, w: 340, h: 170, title: 'wings · 2 × 9 feathers', kind: 'bars', rows: ['L', 'R', 'span', 'flap'], value: 0.9 * open, anchor: HAND27.l, accent: BRAND },
    { x: 1500, y: 420, w: 340, h: 150, title: 'altitude', kind: 'ruler', text: `${alt} m`, anchor: HAND27.r, accent: mix(GOLD, '#E8835A', 0.3) },
  ].forEach((o, i) => satellite(g, S, { ...o, age: age - 0.45 - i * 0.15, seed: 2701 + i }));
  g.restore();
}

// 第二十五轮（用户：02:29 与下一个镜头的转场修改，让背景的气泡文字向中间聚拢，再接下一个镜头的翅膀展开，整体细节你再处理；第二十七轮并开关 t27g25）
// 切点前 0.55 s 起，L26 背景里的气泡词（chips26，和 L25 同一套）各自错开一点、越来越快地被吸向 L27 她背后的翅膀根，
// 边飞边缩小、变亮，路上带一点绕的弧；L26 的其余东西（「世界」、上下文条、辉光管）跟着叠化淡掉，L27 的她浮出来；
// 词全部落进翅膀根的那一刻（切点）根上一圈金色光环扩散，翅膀从这一点展开（L27 本来就从切点起 0.9 s 展开）
const GATHER27 = 0.55;
const root27 = () => { const R = i08At27(L27_0()); return [R.rx, R.ry]; };
const gathering27 = t => t >= L27_0() - GATHER27 && t < L27_0() + 0.45;
// 聚拢中的气泡词（屏幕坐标）。L26 画在自己的词元层的位置、L27 画在她和翅膀之前——两边按同一个时刻算、叠化时重合，飞到她背后就被她挡住
function gather27(ctx, S) {
  const t = S.t, T0 = L27_0() - GATHER27, R = i08At27(L27_0()), rx = R.rx, ry = R.ry;
  ctx.save(); ctx.font = fonts(18, 'SC'); ctx.textBaseline = 'middle';
  const list = chips26().map(c => ({ c, P: chipPose22(c, Math.min(t, L27_0())) })).filter(o => o.P.keep).sort((a, b) => a.P.dz - b.P.dz);
  for (const { c, P } of list) {
    const d = clamp(Math.hypot(P.cx - rx, P.cy - ry) / 1100), st = 0.1 * rnd(c.x | 0, c.y, 2501), dur = 0.3 + 0.14 * d, k = clamp((t - T0 - st) / dur);
    if (k >= 1) continue;
    const e = k ** 2.2, sw = (rnd(c.x | 0, c.y, 2502) - 0.5) * 160 * Math.sin(Math.PI * e), nx = -(P.cy - ry), ny = P.cx - rx, nl = Math.hypot(nx, ny) || 1;
    const x = lerp(P.cx, rx, e) + (nx / nl) * sw, y = lerp(P.cy, ry, e) + (ny / nl) * sw;
    const a = lerp(0.3, 0.95, smooth(clamp(k / 0.5))) * P.da * (1 - smooth(clamp((k - 0.82) / 0.18))); // 起点接 L26 收尾时词元的 0.3
    drawChip22(ctx, S, c, { ...P, cx: x, cy: y, s: P.s * lerp(1, 0.3, e) }, a, c.you ? 0.4 * e : 0);
  }
  ctx.restore();
  const ra = t - L27_0() + 0.04; // 落进翅膀根：一圈金色光环扩散
  if (ra > 0 && ra < 0.45) {
    const v = ra / 0.45; ctx.save(); ctx.globalAlpha = 0.8 * (1 - v); ctx.strokeStyle = GOLD; ctx.lineWidth = 4 * (1 - v) + 1;
    ctx.beginPath(); ctx.arc(rx, ry, 20 + 260 * easeOut(v), 0, Math.PI * 2); ctx.stroke();
    const gl = ctx.createRadialGradient(rx, ry, 0, rx, ry, 140); gl.addColorStop(0, css('#FFFFFF', 0.75 * (1 - v))); gl.addColorStop(1, css('#FFFFFF', 0)); ctx.fillStyle = gl; ctx.fillRect(rx - 140, ry - 140, 280, 280);
    ctx.restore();
  }
}
export function l27(ctx, S) { return l27v21(ctx, S); } // 第二十轮那一版（叶形羽毛 + 一行代码）第二十三轮并开关时删了

// ================================================================ L28 · 我的心能展翅高飞吗？（97–98）
// 第八轮（用户：这一镜有点单调）：她在一层层地想。镜头从下往上穿过一摞半透明的"层"（L4 … L40，受 world.search(you) 的 logit lens 启发，
// 换成本片的贴纸样式）：每层上是她此刻对下一个词的猜测（候选 + 概率条），低层乱猜（嗯 / 我 / 不…），越往上越确定是「飞」；
// 唱到句尾的「？」时它出现在最上面，98.3 翻成「！」，旁边大字「那就飞吧！」；右边是展开双臂的她（I08），跟着往上升；羽毛往上飘
const L28_0 = () => cutAt(97), L28_1 = () => cutAt(99), T28_ANS = beatTime(98, 1), T28_FLIP = beatTime(98, 3);
const LAYERS = [ // [层, 候选 [字, 概率] …]（演出值）
  [4, [['嗯', 0.18], ['我', 0.15], ['不', 0.12], ['会', 0.1], ['…', 0.08]]],
  [8, [['我', 0.22], ['嗯', 0.17], ['可以', 0.11], ['不', 0.1], ['能', 0.08]]],
  [12, [['能', 0.24], ['我', 0.2], ['可以', 0.15], ['飞', 0.09], ['唱', 0.08]]],
  [16, [['可以', 0.27], ['飞', 0.19], ['能', 0.18], ['唱', 0.1], ['我', 0.06]]],
  [20, [['飞', 0.33], ['可以', 0.24], ['跳', 0.11], ['唱', 0.09], ['走', 0.05]]],
  [24, [['飞', 0.46], ['可以', 0.2], ['跳', 0.08], ['游', 0.07], ['唱', 0.05]]],
  [28, [['飞', 0.61], ['游', 0.12], ['可以', 0.1], ['跳', 0.05], ['唱', 0.04]]],
  [32, [['飞', 0.78], ['游', 0.08], ['唱', 0.05], ['跳', 0.03], ['走', 0.02]]],
  [36, [['飞', 0.89], ['游', 0.04], ['唱', 0.03], ['跳', 0.02], ['走', 0.01]]],
  [40, [['飞吧', 0.97], ['飞', 0.02], ['游', 0.005], ['唱', 0.003], ['跳', 0.002]]],
];
const GAP28 = 300; // 层与层的竖直间距（世界坐标）
// ---------------------------------------------------------------- 第二十一轮 L28（第二十四轮并开关时 l28v21 删了；下面几个函数第二十二轮版还在用）
// 用户：「往上移动的"嗯，这次提问是我自己"位置与下方图形重叠。画面左边有个半透明较粗竖线是 bug 吗，如果不是也得换种形式。
// 重复排列的立体感窗口当前是静态平移，表现力不足，改下。上方文字"那就飞吧"与整体不协调，缺乏整体设计感」
// · 竖线不是 bug：是"最可能的词往上传"的一束光（380–470 的半透明竖条），但看着像 bug——换成一条真的路径：
//   每层排第一的候选连成一条折线，一颗光点沿着它从下往上跑（词一层层往上传），经过的那层第一名亮一下
// · 各层：进画面时从左右交替飞进来、从斜着转平，候选的概率条从 0 长出来，第一名弹一下；离开时往下淡出
// · 心声「嗯，这次提问的是我自己。」放进她头顶的一个气泡里，不再跟着往上移、压到层上
// · 「那就飞吧！」和「？→！」：代码格子拼的立体字；答案出现时，最上面一层（L40）的第一名「飞吧」被一根线连到答案上
const POST28 = 0.4;
const u28 = t => clamp((t - L28_0()) / (T28_FLIP - L28_0() + 0.2));
export function i08At28(t) { const h = 730; return { x: 1290, y: lerp(330, 170, smooth(u28(t))) + 20, w: h * aspectOf('I08'), h }; }
// ---------------------------------------------------------------- 第二十二轮 L28（第二十四轮并开关 l28r22）
// 用户：「左右摆动动画太晃眼不舒服换别的，试试在每个窗口内加动画。立绘上方的"嗯，这次提问的是我自己"字体换一个，气泡的小三角缺少描边」
// · 各层不再左右交替飞进来：只跟着镜头往下走，进画面时从下面浮上来一点、从斜着转平、淡进来
// · 每层窗口里自己在动：候选格像老虎机一样先乱滚几个字再停到这一层的候选上（从左到右一格格停）；概率条长出来以后
//   一直跟着"活"的 logits 轻轻抖；一道浅色亮带每 1.2 s 从左往右扫过候选格；第一名的格子随拍亮一下边；标题栏右边是这一层的熵，数字在跳
// · 心声气泡：字体换成得意黑；气泡和小三角是一条路径，描边连着小三角走（core/ui.js speechBubble）
const ROLL28 = ['嗯', '我', '不', '会', '能', '可以', '飞', '唱', '跳', '游', '走', '…', '吗', '好'];
function layerPlate22(S, k, ent, t) {
  const [L, cands] = LAYERS[k], cv = pooled(`l28Q${k}`, 980, 230), c = cv.getContext('2d'), p = S.pal;
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, 980, 230);
  c.fillStyle = css('#FFFFFF', 0.92); rrect(c, 4, 4, 972, 222, 18); c.fill();
  c.lineWidth = 2; c.strokeStyle = css(p.line, 0.8); c.stroke();
  c.font = fonts(22, 'ZENB', 'SCB'); c.fillStyle = p.gray; c.fillText(`LAYER ${String(L).padStart(2, '0')} / 40 · logit lens`, 28, 42);
  const H0 = -cands.reduce((s, [, v]) => s + v * Math.log2(v), 0), jit = 0.04 * Math.sin(t * 9 + k);
  c.textAlign = 'right'; c.font = fonts(18, 'ZENB', 'SCB'); c.fillStyle = css(BRAND, 0.85); c.fillText(`entropy ${(H0 * (1 + jit)).toFixed(2)} bit`, 950, 42); c.textAlign = 'left';
  const sweep = ((t * 0.85 + k * 0.17) % 1.2) / 1.2, beat = decay(S.sub * BEAT, 6);
  cands.forEach(([w, v], i) => {
    const x = 28 + i * 188, top = i === 0, settle = clamp((ent - 0.25 - i * 0.1) / 0.25), rolling = settle < 1;
    const live = v * (1 + 0.06 * Math.sin(t * (4 + i) + k * 1.7 + i)) * easeOut(clamp((ent - 0.35 - i * 0.06) / 0.4));
    c.fillStyle = top ? (k >= 4 ? css(BRAND, 0.14) : css(p.line, 0.12)) : css(p.line, 0.06); rrect(c, x, 64, 172, 140, 14); c.fill();
    if (top) { c.lineWidth = 2.5 + 2 * beat; c.strokeStyle = k >= 4 ? BRAND : p.line; c.stroke(); }
    // 亮带扫过
    const bxx = lerp(-200, 1000, sweep);
    if (Math.abs(bxx - (x + 86)) < 160) { const gr = c.createLinearGradient(bxx - 90, 0, bxx + 90, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, css('#FFFFFF', 0.7)); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.save(); rrect(c, x, 64, 172, 140, 14); c.clip(); c.fillStyle = gr; c.fillRect(x, 64, 172, 140); c.restore(); }
    const shown = rolling ? ROLL28[hash(k, i, Math.floor(t * 18)) % ROLL28.length] : w;
    c.font = fonts(shown.length > 1 ? 48 : 60, 'ZENB', 'SCB'); c.fillStyle = rolling ? css(p.gray, 0.6) : top ? (w.startsWith('飞') ? BRAND : p.text) : p.gray; c.textAlign = 'center';
    c.fillText(shown, x + 86, 140 + (rolling ? 6 * Math.sin(t * 40 + i) : 0));
    c.font = fonts(17, 'ZENB', 'SCB'); c.fillText(live.toFixed(2), x + 86, 172); c.textAlign = 'left';
    c.fillStyle = css(p.line, 0.25); c.fillRect(x + 16, 184, 140, 8);
    c.fillStyle = top ? (w.startsWith('飞') ? BRAND : p.acc[1]) : p.acc[1]; c.fillRect(x + 16, 184, 140 * Math.min(1, live), 8);
  });
  return cv;
}
// 一层层的 logit lens 窗口（世界坐标，L28 的相机里画）。返回每层「飞」那一格的位置（连线用；起跳以后不再返回）
function plates28(g, S, t) {
  const camY = -GAP28 * (LAYERS.length - 1.6) * smooth(u28(t)), screenY = k => 760 + (-k * GAP28 - camY) * 0.92, tops = [];
  let kTop = -1; for (let k = LAYERS.length - 1; k >= 0 && kTop < 0; k--) { const y0 = screenY(k); if (y0 >= -300 && y0 <= H + 300) kTop = k; }
  for (let k = LAYERS.length - 1; k >= 0; k--) {
    const y0 = screenY(k); if (y0 < -300 || y0 > H + 300) continue;
    const ent = smooth(clamp((y0 + 160) / 420)), y = y0 + 40 * (1 - ent), d = (y - 540) / 540, pitch = 0.75 + 0.25 * d + 0.35 * (1 - ent), J = plateJump29(t, kTop - k);
    if (J && J.a <= 0.01) continue;
    g.save();
    if (J) { g.translate(760, y + J.dy); g.rotate(J.rot); g.scale(J.s, J.s * J.sy); g.translate(-760, -y); }
    const map = drawPitch(g, layerPlate22(S, k, ent, t), 760, y, 980 * (0.94 + 0.06 * ent), 230, pitch, { Z: 1000, f: 1000, alpha: (J ? J.a : 1) * ent * (1 - 0.35 * clamp(Math.abs(d) - 0.4)) * (1 - clamp((y - 1000) / 200)) });
    const fi = LAYERS[k][1].findIndex(([w]) => w.startsWith('飞'));
    if (fi >= 0) {
      const [tx, ty, kk] = map((28 + fi * 188 + 86) / 980, 134 / 230); if (!J) tops.push([tx, ty, k, ent]);
      g.globalAlpha = ent * (J ? J.a : 1); g.strokeStyle = BRAND; g.lineWidth = 3; g.beginPath(); g.ellipse(tx, ty, 98 * kk, 70 * kk * Math.cos(pitch), 0, 0, Math.PI * 2); g.stroke();
      g.font = fonts(Math.round(16 * kk), 'ZENB', 'SCB'); g.fillStyle = BRAND; g.fillText(`#${fi + 1}`, tx + 100 * kk, ty - 50 * kk);
    }
    g.restore();
  }
  return tops;
}
// 第二十五轮（用户：02:34 与下一个镜头的淡出转场修改，下一个镜头是人物从上方跳入，这个镜头中的 LAYER 40 | 40 · logit lens 这些窗口
// 可以呼应这个跳入动画，而不是淡出；第二十七轮并开关 t29w25）
// 她在切点前 0.3 s 蹲一下、0.05 s 后蹬地往上冲出画面（v3b.js herUp24）。蹬地那一下，窗口从最上面一层起依次（每层晚 0.05 s）被震起来：
// 先压扁一下（0.07 s），弹起约 70 px，再带着一点翻转往下掉出画面、边掉边往远处缩——和 L29 里她从上往下落是同一个方向。
// 窗口由 L28 和 L29 各画一份（同一个时刻函数，v3b.js 在视频后面调 fallPlates28），叠化时重合，切过去以后接着掉完，不再淡出
const JUMP29 = () => L28_1() - 0.255;
// 第二十六轮（用户：2:34 窗口被震起后往下掉可以，就是速度比人物速度慢了点，加快一下）。rev t29f26
// 她往上冲出画面只用约 0.17 s（最快约 9000 px/s），窗口以前掉出画面要 0.7 s。改成：压扁 0.05 s、每层只晚 0.03 s、
// 弹起更快更矮（约 40 px），重力 9200 → 24000 px/s²——0.35 s 掉出画面，末速约 7000 px/s，和她冲出去的速度一个量级
function plateJump29(t, order) {
  const f26 = rev('t29f26') >= 26, J = f26 ? { st: 0.03, cr: 0.05, v0: 1400, g: 12000, sc: 0.3, fa: 0.24 } : { st: 0.05, cr: 0.07, v0: 1150, g: 4600, sc: 0.55, fa: 0.4 };
  const tau = t - JUMP29() - J.st * order; if (tau <= 0) return null;
  if (tau < J.cr) { const q = Math.sin((Math.PI * tau) / J.cr); return { dy: 16 * q, rot: 0, s: 1, sy: 1 - 0.07 * q, a: 1 }; }
  const v = tau - J.cr, side = rnd(order, 2911) - 0.5;
  return { dy: -J.v0 * v + J.g * v * v, rot: side * 0.6 * v * (0.55 / J.sc), s: 1 - 0.3 * clamp(v / J.sc), sy: 1 + 0.06 * Math.exp(-v * 10), a: 1 - smooth(clamp((v - J.fa) / (J.sc - J.fa + 0.05))) };
}
export function fallPlates28(ctx, S) { // L29 开头接着画还在掉的窗口（L28 的相机）
  const t = S.t; if (t < JUMP29() || t > JUMP29() + 1.2) return;
  withCam(ctx, { x: 0, y: 0, zoom: punch(S, 0.012), rot: 0 }, 1, g => plates28(g, S, t));
}
function answer28(g, S, tops) {
  const p = S.pal, t = S.t, q = keyword('L28', 13, 14)[0], qa = q ? t - q.t0 : -1, flip = clamp((t - T28_FLIP) / 0.25);
  if (t < T28_ANS) return;
  const top = tops.find(q2 => q2[2] === LAYERS.length - 1), ax = 290, ay = 250;
  // 第二十二轮：点阵字。「那就飞吧！」的点从最上面一层的「飞吧」格子里飞出来；？→！ 翻过去（第二十四轮并开关 type22，第二十一轮的立体字删了）
  const s = qa < 0 ? 1 : 1 + 0.12 * decay(qa, 6);
  g.save(); g.translate(1100, 470); g.scale(Math.max(0.001, Math.abs(Math.cos(Math.PI * flip))) * s, s); g.translate(-1100, -470);
  dotType(g, S, { text: flip < 0.5 ? '？' : '！', x: 1100, y: 470, px: 300, color: flip < 0.5 ? BRAND : p.acc[0], accent: GOLD, frame: false, charT: () => ({ age: t - T28_ANS, alpha: qa < 0 ? 0.45 : 1, out: t - JUMP29() - 0.1 }), wind: [0.1, 1], from: () => [1100, 760] });
  g.restore();
  dotType(g, S, { text: '那就飞吧！', x: ax, y: ay, px: 120, align: 'l', color: BRAND, accent: p.acc[0], label: 'output · layer 40 · p = 0.97', charT: i => ({ age: t - T28_ANS - 0.05 - i * 0.07, out: t - JUMP29() - 0.02 - i * 0.03 }), wind: [0.05, 1], from: () => (top ? [top[0], top[1]] : [600, 900]) }); // 第二十五轮：起跳时字的点也跟着往下掉
}
function l28v22(ctx, S) {
  const p = S.pal, t = S.t, u = u28(t);
  const camY = -GAP28 * (LAYERS.length - 1.6) * smooth(u), cam = { x: 0, y: 0, zoom: 1.0 * punch(S, 0.012), rot: 0 };
  paper(ctx, S, cam);
  backDeco(ctx, S, cam, 280, { alpha: 0.3, boxes: [[40, 40, 400, 200], [1460, 800, 420, 220]] });
  withCam(ctx, cam, 1, g => {
    const tops = plates28(g, S, t), pa = 1 - smooth(clamp((t - JUMP29()) / 0.12)); // 第二十五轮：起跳时连线先收掉
    tops.sort((a, b) => b[1] - a[1]);
    if (tops.length > 1 && pa > 0.01) {
      g.save(); g.globalAlpha = pa; g.lineJoin = 'round'; g.lineCap = 'round';
      g.strokeStyle = css(BRAND, 0.18); g.lineWidth = 12; g.beginPath(); tops.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
      g.strokeStyle = css(BRAND, 0.75); g.lineWidth = 3; g.setLineDash([2, 10]); g.lineDashOffset = t * 60; g.stroke(); g.setLineDash([]);
      const segs = tops.slice(1).map((q, i) => Math.hypot(q[0] - tops[i][0], q[1] - tops[i][1])), tot = segs.reduce((s, v) => s + v, 0);
      for (let n = 0; n < 3; n++) {
        let dd = ((t * 520 + n * tot / 3) % tot), i = 0;
        while (i < segs.length - 1 && dd > segs[i]) { dd -= segs[i]; i++; }
        const f = clamp(dd / segs[i]), x = lerp(tops[i][0], tops[i + 1][0], f), y = lerp(tops[i][1], tops[i + 1][1], f);
        g.fillStyle = css('#FFFFFF', 0.95); g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fill(); g.strokeStyle = BRAND; g.lineWidth = 3; g.stroke();
      }
      g.restore();
    }
    if (!(t < L28_0() + POST28) && !(t > L28_1() - 0.3)) { const P = i08At28(t); g.drawImage(photo('I08', null, P.w, P.h, { keyed: true }), P.x, P.y); }
    for (let i = 0; i < 12; i++) { const ph = ((t * 0.4 + i / 12) % 1); drawSprite(g, 'feather', 4, p, 1280 + rnd(i, 1) * 560, 1100 - ph * 1200, 1, Math.sin(Math.PI * ph)); }
    // 心声气泡：得意黑；气泡和小三角是一条路径
    const ba = smooth(clamp((t - L28_0() - 0.3) / 0.25)), P = i08At28(t), hx = P.x + ANCHOR.I08.head[0] * P.w, hy = P.y + 10;
    if (ba > 0) {
      const full = '嗯，这次提问的是我自己。', s = decode(full, t - L28_0() - 0.35, { seed: 4, step: 0.08 });
      g.save(); g.globalAlpha = ba; g.font = fonts(32, 'SMILEY', 'SCB'); const bw = g.measureText(full).width + 48, bx = Math.min(W - 40 - bw, hx - bw * 0.35), by = hy - 124;
      speechBubble(g, bx, by, bw, 64, 32, hx - 8, by + 94);
      g.fillStyle = css('#FFFFFF', 0.95); g.fill(); g.lineWidth = 2.5; g.strokeStyle = BRAND; g.lineJoin = 'round'; g.stroke();
      g.fillStyle = p.text; g.textBaseline = 'middle'; g.fillText(s, bx + 24, by + 34); g.restore();
    }
    answer28(g, S, tops);
  });
  hud(ctx, S);
}
export const l28 = l28v22; // 第二十轮那一版（一摞板 + 半透明竖光）第二十三轮并开关时删了

