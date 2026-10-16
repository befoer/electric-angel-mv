// 第三段的大字（第二十一轮，用户：「后半部分那些圆体的大文字都比较违和，可能是缺少细节，可能是配色，也可能缺少动画，得整体重新设计」）rev type21
// 和片名字标（core/logo.js）同一套语言——字是代码格子拼出来的。每个字：
//   · 厚度：往右下挤出一截深色（几层错位叠出来），字立起来、压得住背景
//   · 白边：一圈白描边
//   · 填充：格子底色（整行从左到右渐变）+ 浅色代码字；刚打出来的格子先亮一下
//   · 高光：一道斜的亮带隔一会儿从字上扫过去
//   · 出现：格子一行行打出来，同时整字弹一下；离开：碎回格子、被风吹走（o.charT 给每个字的进度）
//   · 注记（o.notes）：字上方的小读音、下方带刻度的细线和说明——让大字有"界面里的东西"的细节
// 字体：中文用得意黑（SMILEY，和片名一样），日文用 Dela Gothic（得意黑没有 風揺電広 这些日文汉字）
// bigType(ctx, S, o)：o.text（字符串或字数组）、o.x / o.y（整行中心 x、基线 y；o.align 'l' 时 x 是左边）、o.px 字号、o.keys 字体、
//   o.tiles [左, 右] 底色、o.charT(k) → { a 打字进度 0..1, out 碎掉进度 0..1, dx, dy, s, r, alpha }、o.wind [dx, dy] 碎掉时往哪吹、
//   o.notes { above: [每个字上方的小字], caption: 下方说明 }。返回每个字的中心 [[x, y], …]
import { CW, CH, BRAND } from './const.js';
import { newCanvas } from './env.js';
import { fonts, glyphs } from './glyphs.js';
import { pooled } from './cam.js';
import { mix, css } from './color.js';
import { hash, rnd } from './rand.js';
import { clamp, lerp, smooth, easeIn, easeOutBack } from './time.js';

const CODE = 'if(you){sing();heart.beat(150);}while(listening)love++;const sea=code.grow();return world.open(wings);';
export const JP_KEYS = ['DELA', 'JB'], ZH_KEYS = ['SMILEY', 'SCB'];

// 一个字的蒙版和格子（只算一次）
const MASKS = new Map();
function charMask(chr, px, keys, edgeW) {
  const key = `${chr}|${px}|${keys}|${edgeW}`;
  let M = MASKS.get(key);
  if (M) return M;
  const cw = Math.max(5, Math.round(px / 16)), ch = Math.round((cw * CH) / CW), pad = Math.ceil(edgeW + px * 0.1);
  const w = Math.ceil((px * 1.25 + 2 * pad) / cw) * cw, h = Math.ceil((px * 1.3 + 2 * pad) / ch) * ch, base = Math.round(pad + px * 0.95), cx = w / 2;
  const font = fonts(px, ...keys);
  const draw = stroke => {
    const cv = newCanvas(w, h), c = cv.getContext('2d');
    c.font = font; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.fillStyle = c.strokeStyle = '#000'; c.lineJoin = 'round';
    if (stroke) { c.lineWidth = stroke; c.strokeText(chr, cx, base); }
    c.fillText(chr, cx, base);
    return cv;
  };
  const inner = draw(0), outer = draw(edgeW * 2);
  const di = inner.getContext('2d').getImageData(0, 0, w, h).data, dO = outer.getContext('2d').getImageData(0, 0, w, h).data;
  const cells = [];
  let top = h, bot = 0;
  for (let r = 0; r * ch < h; r++) for (let c = 0; c * cw < w; c++) {
    let si = 0, so = 0, nn = 0;
    for (let y = r * ch; y < Math.min(h, (r + 1) * ch); y++) for (let x = c * cw; x < (c + 1) * cw; x++) { const o = (y * w + x) * 4 + 3; si += di[o] > 127; so += dO[o] > 127; nn++; }
    if (!so) continue;
    if (si) { top = Math.min(top, r * ch); bot = Math.max(bot, (r + 1) * ch); }
    cells.push({ x: c * cw, y: r * ch, r, c, ci: si / nn, co: so / nn });
  }
  const ins = cells.filter(e => e.ci > 0), r0 = Math.min(...ins.map(e => e.r)), r1 = Math.max(...ins.map(e => e.r));
  const c0 = Math.min(...ins.map(e => e.c)), c1 = Math.max(...ins.map(e => e.c));
  for (const e of cells) e.f = clamp((e.r - r0 + clamp((e.c - c0) / (c1 - c0 + 1))) / (r1 - r0 + 1), 0, 0.999);
  const m = newCanvas(8, 8).getContext('2d'); m.font = font;
  M = { w, h, cx, base, inner, outer, cells, cw, ch, adv: m.measureText(chr).width, top, bot };
  MASKS.set(key, M);
  return M;
}

const blit = (g, set, chr, x, y, cw, ch) => { const q = set.get(chr); g.drawImage(q.cv, q.sx, q.sy, CW, CH, x, y, cw, ch); };

// 一个字：三张缓冲（白边、填充、厚度），按字的变换画到 ctx 上
function drawChar(ctx, S, M, st, k, o, tile, ink, shade) {
  const t = S.t, { w, h, cw, ch } = M, out = st.out ?? 0;
  if ((st.a ?? 1) <= 0) return;
  const a = (st.a ?? 1) * 1.25; // 打到 0.8 就全出来，剩下的 0.2 让最后几行的"亮一下"退掉
  const crisp = 1 - smooth(clamp(out / 0.35));
  ctx.save();
  ctx.globalAlpha *= st.alpha ?? 1;
  ctx.translate(st.x, st.y); if (st.r) ctx.rotate(st.r); if (st.s != null && st.s !== 1) ctx.scale(st.s, st.s); ctx.translate(-M.cx, -M.base);
  if (crisp > 0) {
    const be = pooled('btE', w, h, true), bf = pooled('btF', w, h, true), bs = pooled('btS', w, h, true);
    const [ge, gf, gs] = [be, bf, bs].map(b => { const g = b.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.clearRect(0, 0, w, h); return g; });
    const code = glyphs('SCB', ink), tick = Math.floor(t * 3);
    ge.fillStyle = o.edge ?? '#FFFFFF';
    for (const e of M.cells) {
      if (a <= e.f) continue;
      ge.fillRect(e.x - 1, e.y - 1, cw + 2, ch + 2);
      if (e.ci <= 0) continue;
      const fl = clamp(1 - (a - e.f) / 0.25); // 刚打出来的格子先亮一下
      gf.fillStyle = fl > 0 ? mix(tile, '#FFFFFF', 0.75 * fl) : tile; gf.fillRect(e.x, e.y, cw, ch);
      const live = hash(e.x, e.y, tick) % 31 === 0 ? 1 : 0;
      blit(gf, code, CODE[(e.r * 29 + e.c * 3 + k * 7 + live) % CODE.length], e.x, e.y, cw, ch);
    }
    ge.globalCompositeOperation = 'destination-in'; ge.drawImage(M.outer, 0, 0);
    gf.globalCompositeOperation = 'destination-in'; gf.drawImage(M.inner, 0, 0);
    // 高光：一道斜的亮带，每 2.4 s 扫过一次（各字错开一点）
    const ph = ((t + (o.sweepPhase ?? 0) - k * 0.07) % 2.4) / 0.6;
    if (ph < 1) {
      const bx = lerp(-w * 0.4, w * 1.4, ph), gr = gf.createLinearGradient(bx - 60, h, bx + 60, 0);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      gf.globalCompositeOperation = 'source-atop'; gf.fillStyle = gr; gf.fillRect(0, 0, w, h);
    }
    gs.drawImage(be, 0, 0); gs.globalCompositeOperation = 'source-in'; gs.fillStyle = shade; gs.fillRect(0, 0, w, h);
    ctx.save(); ctx.globalAlpha *= crisp;
    const depth = o.depth ?? Math.max(4, Math.round(M.cw * 1.6)), n = Math.max(3, Math.round(depth / 2));
    for (let i = n; i >= 1; i--) ctx.drawImage(bs, (i / n) * depth * 0.75, (i / n) * depth);
    ctx.drawImage(be, 0, 0); ctx.drawImage(bf, 0, 0);
    ctx.restore();
  }
  // 碎掉：格子按从左到右（带一点随机）先后被吹走
  if (out > 0) {
    const [wx, wy] = o.wind ?? [1, -0.25], code = glyphs('SCB', ink), D = (o.windDist ?? 1.6) * w;
    for (const e of M.cells) {
      if (e.ci < 0.3) continue;
      const d0 = (e.x / w) * 0.35 + rnd(e.x, e.y, k, 7) * 0.3, q = clamp((out - d0) / 0.45);
      if (q <= 0 || q >= 1) { if (q <= 0 && crisp <= 0) { ctx.fillStyle = tile; ctx.fillRect(e.x, e.y, cw, ch); blit(ctx, code, CODE[(e.r * 29 + e.c * 3) % CODE.length], e.x, e.y, cw, ch); } continue; }
      const kq = easeIn(q), tw = Math.sin(q * 8 + e.r) * 18 * q;
      const x = e.x + wx * D * kq * (0.6 + 0.6 * rnd(e.x, e.y, 8)), y = e.y + wy * D * kq * (0.6 + 0.6 * rnd(e.x, e.y, 9)) + tw;
      ctx.globalAlpha = (st.alpha ?? 1) * (1 - q);
      ctx.fillStyle = tile; ctx.fillRect(x, y, cw * (1 - 0.4 * q), ch * (1 - 0.4 * q));
      if (q < 0.5) blit(ctx, code, CODE[(e.r * 29 + e.c * 3) % CODE.length], x, y, cw, ch);
    }
  }
  ctx.restore();
}

export function bigType(ctx, S, o) {
  const chars = Array.isArray(o.text) ? o.text : [...o.text], n = chars.length, px = o.px, keys = o.keys ?? ZH_KEYS, edgeW = o.edgeW ?? Math.max(4, Math.round(px * 0.045));
  const Ms = chars.map(c => charMask(c, px, keys, edgeW)), track = o.track ?? px * 0.04;
  const widths = Ms.map(M => M.adv + track), total = widths.reduce((s, v) => s + v, 0) - track;
  let x = o.align === 'l' ? o.x : o.x - total / 2;
  const [c0, c1] = o.tiles ?? [BRAND, BRAND], shade = o.shade ?? mix(c0, '#1D2541', 0.55), ink = o.ink ?? mix(c0, '#FFFFFF', 0.42);
  const centers = [];
  Ms.forEach((M, k) => {
    const st = { a: 1, ...(o.charT ? o.charT(k) : {}) }, cx = x + M.adv / 2;
    centers.push([cx + (st.dx ?? 0), o.y + (st.dy ?? 0) - px * 0.36]);
    drawChar(ctx, S, M, { ...st, x: cx + (st.dx ?? 0), y: o.y + (st.dy ?? 0) }, k, o, mix(c0, c1, n > 1 ? k / (n - 1) : 0), ink, shade);
    x += widths[k];
  });
  if (o.notes) notes(ctx, S, o, Ms, centers, chars);
  return centers;
}

// 注记：字上方的读音小字（各自一根短竖线连到字），下方一根带刻度的细线 + 说明
function notes(ctx, S, o, Ms, centers, chars) {
  const N = o.notes, px = o.px, col = N.color ?? css(S.pal.gray, 1), sz = Math.max(14, Math.round(px * 0.11));
  ctx.save(); ctx.font = fonts(sz, 'SC'); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  centers.forEach(([cx], k) => {
    const st = o.charT ? o.charT(k) : { a: 1 }, a = smooth(clamp(((st.a ?? 1) - 0.3) / 0.5)) * (1 - smooth(clamp((st.out ?? 0) / 0.3)));
    if (a <= 0 || !N.above?.[k]) return;
    const y = o.y - px * 0.98 + (st.dy ?? 0);
    ctx.globalAlpha = a; ctx.fillStyle = col; ctx.fillText(N.above[k], cx, y - 8 * (1 - a));
    ctx.fillRect(cx - 0.5, y + 6, 1, px * 0.06);
  });
  if (N.caption) {
    const st0 = o.charT ? o.charT(0) : { a: 1 }, stN = o.charT ? o.charT(chars.length - 1) : { a: 1 };
    const a = smooth(clamp(((stN.a ?? 1) - 0.5) / 0.5)) * (1 - smooth(clamp(((st0.out ?? 0)) / 0.3)));
    if (a > 0) {
      const xL = centers[0][0] - Ms[0].adv / 2, xR = centers[centers.length - 1][0] + Ms[Ms.length - 1].adv / 2, y = o.y + px * 0.2, len = (xR - xL) * smooth(a);
      ctx.globalAlpha = a; ctx.fillStyle = col; ctx.fillRect(xL, y, len, 1.5);
      centers.forEach(([cx]) => { if (cx - xL <= len) ctx.fillRect(cx - 0.75, y - 5, 1.5, 11); });
      ctx.fillRect(xL, y - 9, 1.5, 19); if (len >= xR - xL - 1) ctx.fillRect(xR - 1.5, y - 9, 1.5, 19);
      ctx.textAlign = 'right'; ctx.fillText(N.caption, xR, y + sz + 8);
    }
  }
  ctx.restore();
}
