// L01（10–11 小节，0:14.47–0:17.67）· 落点（视觉方案 §5.2、§5.2a）
// 范例：公式坍缩成歌词关键词、候选 token 数据行、立绘碎片拼贴、窗口碎片、两侧卡片退场
// 主公式：ŷ = argmax_w p_θ(w ∣ 唱首歌吧)。唱到"歌"之前候选概率一直在抖（采样中）；唱到的那一刻公式坍缩进 ŷ，巨字"歌"从那里飞出
import { W, H, CW, CH, BRAND, STEP, BEAT } from '../core/const.js';
import { clamp, lerp, smooth, easeIn, easeOut, easeOutBack, decay } from '../core/time.js';
import { rnd } from '../core/rand.js';
import { font, fonts } from '../core/glyphs.js';
import { Occ, background, charField, bgDensity } from '../core/grid.js';
import { beatSprites, drawBeatSprites, spriteCells, offbeatFlashes, dropBurst, drawSprite } from '../core/sprites.js';
import { keyword, lyric, vspec } from '../core/data.js';
import { photo, aspectOf } from '../core/portrait.js';
import { rev } from '../rev.js';
import { css } from '../core/color.js';
import { rrect } from '../core/ui.js';
import { satellite, tickRing } from '../core/struct22.js';
import { flash, framed } from '../core/fx.js';
import { makeState } from '../core/state.js';
import { hiCanvas } from '../core/env.js';
import { card, leader, rows, dots, corners } from '../core/kit.js';
import { drawFormula, slotText } from '../core/math.js';
import { drawWindow, sideCards, WIN, T_DROP } from './intro.js';
import { camAt, withCam, camToScreen } from '../core/cam.js';
import { hud } from '../core/hud.js';
import { paper, backDeco, frontDeco, punch } from './scene.js';

// 第八轮到第二十三轮的立绘碎片拼贴（眼睛条、脸、嘴三张方框照片）第二十六轮并开关 l01d24 时删了
const FCARD = [40, 40, 860, 150];   // 公式卡 [x, y, w, h]
const RCARD8 = [1250, 40, 630, 290]; // 候选 token 卡
// 第十轮（第一分钟精修，rev polish1）：候选卡矮一点
const RCARD10 = [1250, 40, 630, 260];
const p10 = () => true;
const ASK = '唱首歌吧';

// 第二十四轮（用户：0:15 三张图片素材的表现力不足，换个形式；第二十六轮并开关 l01d24）
// 三张裁出来的方框照片（眼睛条、脸、嘴）换成一个完整的她：I03 本来就是张着嘴在唱——
// · 落点那一下切成 18 条横条，从上到下错开、左右交替滑进来，锁定时过冲一点（和上面碎掉的窗口同一种"条"）
// · 头后面一圈人声频谱：build/vocal_spec.json 实测的人声 32 段，左右镜像成 64 根从圆圈往外长；外面一圈 64 格刻度，扫描头随拍走
// · 每唱一个字，这个字的小词元从嘴里飞出来、往上飘、淡掉（「歌」不出小词元——屏幕外的点阵「歌」就从她嘴里飞出去，drop.js geDots 的起点是嘴）
// 第二十五轮（用户：0:15 立绘移动到右边并重新构图，左边的手不要裁切掉，去除嘴边的声波效果；第二十七轮并开关 l01r25）：
// 半身像在屏幕右半边（右沿 1900），头顶在 300（右上「next token」卡下面）；左半边空出来给点阵「歌」，「歌」正好落在她摊开的手掌左上方。
// 嘴边没有声波弧；卫星面板只有心电（右上、连到尾巴尖），头后的频谱环就是人声。
// 第二十六轮（用户：0:15 立绘手指还有点被裁切；开关 l01h26 第二十八轮并进代码）
// 第二十五轮量手的位置用的是换最终版之前的 I03 网格图——最终版（3773×3896）里她伸出的手更靠左，指尖离原图左边缘只有几 px，
// 3% 的裁切线正好切过手指。裁切框改成从 0% 起（到 99%，尾巴尖也在），嘴 / 头 / 手 / 尾巴的锚点在最终版上重量
const BUST26 = { sub: [0, 0, 0.99, 0.62], right: 1900, top: 300, h: 780, mouth: [0.444, 0.566], head: [0.4545, 0.355], hand: [0.101, 0.781], tail: [0.929, 0.532] };
export function bust24() { // 屏幕里（1920×1080 坐标）她的框、嘴、头、手、尾巴
  const B = BUST26, w = B.h * (B.sub[2] / B.sub[3]) * aspectOf('I03'), x = B.right - w, P = q => [x + q[0] * w, B.top + q[1] * B.h];
  return { x, y: B.top, w, h: B.h, sub: B.sub, mouth: P(B.mouth), head: P(B.head), hand: P(B.hand), tail: P(B.tail) };
}
export function mouth24(t) { const c = camAt(CAM, t); return camToScreen(c, 1, ...bust24().mouth); } // 嘴在屏幕画面里的位置（跟着 L01 的相机）
function singer24(ctx, S, age, under) {
  const p = S.pal, t = S.t, b = bust24(), [hx, hy] = b.head, [mx, my] = b.mouth;
  if (under) { // 她后面：人声频谱环 + 刻度环
    const grow = easeOut(clamp((age - 0.05) / 0.35)), R = 300 * (0.7 + 0.3 * grow), v = vspec(t);
    if (grow <= 0) return;
    ctx.save(); ctx.lineCap = 'round';
    for (let i = 0; i < 64; i++) {
      const band = i < 32 ? i : 63 - i, val = v[band] ** 0.8, ang = -Math.PI / 2 + (i / 64) * Math.PI * 2 + 0.05 * t, L = (6 + 130 * val) * grow;
      ctx.strokeStyle = band > 24 ? css(p.acc[0], 0.75) : css(BRAND, 0.35 + 0.55 * val); ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(hx + Math.cos(ang) * R, hy + Math.sin(ang) * R); ctx.lineTo(hx + Math.cos(ang) * (R + L), hy + Math.sin(ang) * (R + L)); ctx.stroke();
    }
    ctx.strokeStyle = css(BRAND, 0.5 * grow); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(hx, hy, R - 8, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    tickRing(ctx, S, hx, hy, R + 168, { n: 64, age: age - 0.1, t0: T_DROP, color: css(p.line, 0.8), accent: p.acc[0], speed: -0.04, alpha: 0.8 });
    return;
  }
  // 她：18 条横条从上到下错开滑进来，左右交替，锁定时过冲
  const img = photo('I03', b.sub, b.w, b.h, { keyed: true }), N = 18, sh = b.h / N, kick = decay(S.sub * BEAT, 10);
  ctx.save(); ctx.translate(b.x + b.w / 2, b.y + b.h); ctx.scale(1 + 0.012 * kick, 1 + 0.012 * kick); ctx.translate(-b.x - b.w / 2, -b.y - b.h);
  for (let j = 0; j < N; j++) {
    const a = age - j * 0.016, e = easeOutBack(clamp(a / 0.16), 1.5), off = (j % 2 ? 1 : -1) * (260 + 200 * rnd(j, 241)) * (1 - e);
    if (a <= 0) continue;
    ctx.globalAlpha = clamp(a / 0.05);
    ctx.drawImage(img, 0, j * sh * (img.height / b.h), img.width, sh * (img.height / b.h), b.x + off, b.y + j * sh, b.w, sh + 0.5);
  }
  ctx.restore();
  // 每个字的小词元
  const cs = lyric('L01').chars, kw = keyword('L01', 5, 6)[0];
  cs.forEach((c, i) => {
    const ca = t - c.t0;
    if (ca < 0 || ca > 1.3 || /[、，。 ]/.test(c.c)) return;
    if (c === kw || c.c === kw.c) return;
    const d = 60 + 420 * easeOut(clamp(ca / 0.9)), an = -0.3 + ((i % 3) - 1) * 0.22, x = mx + Math.cos(an) * d, y = my + Math.sin(an) * d - 60 * ca, s = easeOutBack(clamp(ca / 0.14), 1.8), fa = 1 - smooth(clamp((ca - 0.75) / 0.35));
    if (fa <= 0) return;
    ctx.save(); ctx.globalAlpha = fa; ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(0.12 * Math.sin(i * 2.1 + ca * 3));
    ctx.font = fonts(34, 'ZEN', 'J'); const tw = ctx.measureText(c.c).width + 26;
    ctx.fillStyle = '#FFFFFF'; rrect(ctx, -tw / 2, -25, tw, 50, 25); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = BRAND; ctx.stroke();
    ctx.fillStyle = BRAND; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(c.c, 0, 2); ctx.restore();
    drawSprite(ctx, 'note', 3, p, x + tw * 0.6, y - 30, 1, fa * 0.9);
  });
  // 卫星面板
  SAT25.map(q => ({ ...q, anchor: q.kind === 'ecg' ? b.tail : b.hand }))
    .forEach((q, i) => satellite(ctx, S, { ...q, age: age - 0.45 - i * 0.14, seed: 241 + i, accent: i ? p.acc[0] : BRAND }));
}
const SAT25 = [{ x: 1600, y: 345, w: 280, h: 150, title: 'ch.01 · 150 BPM', kind: 'ecg', text: 'LIVE' }]; // 没有人声频谱面板（头后那圈频谱环就是人声；左下是「歌」的标签和歌词条）
// 候选 token 的最终概率（演出值）。第一个是关键词本身，从 keyword() 取，不写在代码里
const OTHERS = [['饭', 0.03], ['鲸', 0.02], ['不', 0.01]];

// 落点前一刻的窗口画面，碎成 6×4 块飞散
let WIN_IMG = null;
function windowImage() {
  if (WIN_IMG) return WIN_IMG;
  WIN_IMG = hiCanvas(W, H);
  const t = T_DROP - 0.001;
  drawWindow(WIN_IMG.getContext('2d'), makeState(t), { t, done: true });
  return WIN_IMG;
}

function shards(ctx, age) {
  if (age > 1.6) return;
  const img = windowImage(), x0 = WIN.c0 * CW, y0 = WIN.r0 * CH, w = (WIN.c1 - WIN.c0) * CW, h = (WIN.r1 - WIN.r0) * CH;
  const nx = 6, ny = 4, sw = w / nx, sh = h / ny;
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const head = j === 0 && i === 0; // 带着"已深度思考（用时 14 秒）"的那块，飞得慢、留得久
      const life = head ? 1.6 : 0.9, a = 1 - clamp(age / life);
      if (a <= 0) continue;
      const cx = x0 + (i + 0.5) * sw, cy = y0 + (j + 0.5) * sh;
      const dx = cx - (x0 + w / 2), dy = cy - (y0 + h / 2), dl = Math.hypot(dx, dy) || 1;
      const v = (head ? 160 : 600 + rnd(i, j, 1) * 500) * easeOut(clamp(age / 0.8));
      const px = cx + (dx / dl) * v, py = cy + (dy / dl) * v * 0.7 + 420 * age * age;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(px, py); ctx.rotate((rnd(i, j, 2) - 0.5) * 3 * age);
      ctx.drawImage(img, x0 + i * sw, y0 + j * sh, sw, sh, -sw / 2, -sh / 2, sw, sh);
      ctx.restore();
    }
  }
}

// 候选概率：唱到关键词之前每个十六分音符抖一次、整体往最终值靠；唱到之后定住，关键词那一行高亮
export function candidates(S, kw, t0) {
  const step = Math.floor((S.t - t0) / STEP), done = S.t >= kw.t0;
  const u = clamp((S.t - t0) / (kw.t0 - t0));
  const all = [[kw.c, 0.92], ...OTHERS];
  return all.map(([k, p], i) => {
    const base = i === 0 ? lerp(0.34, p, u) : lerp(0.22 - i * 0.04, p, u);
    const v = done ? p : clamp(base * (0.75 + 0.5 * rnd(step, i, 61)), 0.005, 0.99);
    return { k, v: v.toFixed(2), u: v, hi: done && i === 0 };
  });
}

// 相机：落点推近 → 0.5 s 内拉回，之后两小节缓慢左移、轻转；拍头推镜
const CAM = [
  { t: T_DROP, x: 0, y: 0, zoom: 1.14, rot: 0 },
  { t: T_DROP + 0.5, x: 0, y: 0, zoom: 1.0, rot: -0.008, e: 'out' },
  { t: T_DROP + 3.2, x: -60, y: 10, zoom: 1.04, rot: 0.01 },
];

export function l01(ctx, S) {
  const cam = camAt(CAM, S.t), c = { ...cam, zoom: cam.zoom * punch(S, 0.025) };
  paper(ctx, S, c);
  backDeco(ctx, S, c, 10, { alpha: 0.5 });
  withCam(ctx, c, 1, g => content(g, S));
  frontDeco(ctx, S, c, 11, { alpha: 0.6, items: [['ring', 1840, 1000, 300], ['data', -40, 380, 0]] });
  hud(ctx, S, { spectrum: false });
}

function content(ctx, S) {
  const pal = S.pal, age = S.t - T_DROP;
  const occ = new Occ(), avoid = [];
  const block = (x, y, w, h) => { occ.px(x - 12, y - 20, x + w + 14, y + h + 14); avoid.push([(x - 12) / CW, (y - 20) / CH, (x + w + 14) / CW, (y + h + 14) / CH]); };

  const RCARD = p10() ? RCARD10 : RCARD8;
  { const b = bust24(); block(b.x + b.w * 0.05, b.y, b.w * 0.92, b.h); block(1600, 325, 280, 170); }

  const kw = keyword('L01', 5, 6)[0], ka = S.t - kw.t0;
  const fa = age - 3 * STEP, ra = age - 4 * STEP; // 公式卡、候选卡在第 3、4 个十六分音符弹出
  if (fa >= 0) block(...FCARD);
  if (ra >= 0) block(...RCARD);
  if (ka >= 0) occ.px(600, 230, 1320, 900);

  const sprites = beatSprites(S, { mult: 0.8, avoid });
  for (const s of sprites) occ.rect(...spriteCells(s));
  charField(ctx, S, { occ, density: bgDensity(1 + 2.2 * decay(age, 2.5)), reshuffle: age < 0.1 ? 3 : 1 }); // 落点 100% 重排

  shards(ctx, age);
  // 前奏两侧的卡片向两边飞出
  const ex = clamp(age / 0.35);
  if (ex < 1) sideCards(ctx, makeState(T_DROP - 0.001), T_DROP - 0.001, { dxL: -700 * easeIn(ex), dxR: 700 * easeIn(ex), alpha: 1 - ex });

  if (age >= 0) { singer24(ctx, S, age, true); singer24(ctx, S, age, false); }

  // 候选 token 卡
  if (ra >= 0) {
    card(ctx, S, ...RCARD, { title: 'next token', age: ra }, c => {
      rows(ctx, S, c.x + 10, c.y + 4, candidates(S, kw, T_DROP + 4 * STEP), { fs: 34, rh: 54, kw: 60, vw: 110, bw: 360 });
    });
    dots(ctx, RCARD[0] + RCARD[2] - 70, RCARD[1] + RCARD[3] + 34, 3, 3, 22, 5, pal.line);
  }

  // 公式卡：板书 → 唱到"歌"前 0.16 s 坍缩进 ŷ → 之后重写一遍，ŷ 标粉，引线指向巨字
  let yhat = null;
  if (fa >= 0) {
    card(ctx, S, ...FCARD, { title: 'decode', age: fa }, c => {
      const cu = clamp((S.t - (kw.t0 - 0.16)) / 0.16), rewrite = S.t - (kw.t0 + 0.3);
      const o = { size: 54, valign: 'mid', color: pal.text, colors: { yhat: pal.acc[0] }, slots: { s_ctx: (cx, b) => slotText(cx, b, ASK, { color: BRAND, fontKey: 'SMILEY' }) } };
      const x = c.x + 10, y = c.y + c.h / 2 + 2;
      if (S.t < kw.t0) {
        const L0 = drawFormula(ctx, 'argmax', x, y, { ...o, write: fa - 0.05, dur: 0.35, alpha: 0 }); // 只取 ŷ 的位置
        const b = L0.box('yhat');
        drawFormula(ctx, 'argmax', x, y, { ...o, write: fa - 0.05, dur: 0.35, collapse: cu > 0 ? { u: cu, x: (b[0] + b[2]) / 2, y: (b[1] + b[3]) / 2 } : null });
        yhat = b;
      } else if (rewrite >= 0) {
        const L = drawFormula(ctx, 'argmax', x, y, { ...o, write: rewrite, dur: 0.3, marks: { yhat: pal.tint[0] } });
        yhat = L.box('yhat');
      } else {
        yhat = drawFormula(ctx, 'argmax', x, y, { ...o, alpha: 0 }).box('yhat');
      }
    });
    corners(ctx, FCARD[0] - 14, FCARD[1] - 14, FCARD[2] + 28, FCARD[3] + 28, pal.line, { len: 22, plus: false });
  }

  // 第十四轮：屏幕里不再画实心的巨字「歌」，屏幕外的点阵字（drop.js geDots）从这里飞出去

  drawBeatSprites(ctx, S, sprites);
  dropBurst(ctx, S, T_DROP);
  flash(ctx, 0.3 * decay(age, 14) + (ka >= 0 ? 0.2 * decay(ka, 16) : 0)); // 第八轮：闪光减弱、去掉反拍闪点
}
