// 标题字标「如果代码能长出海」（第二十轮，用户：「你自行决定对标题做什么形式设计」）rev title20
// 设计：字是代码"打"出来的，打完以后字的下沿长成海。
//   · 每个字按格子一行行出现（品牌蓝底格 + 浅色代码字，外面一圈白边；和前奏鲸尾同一种画法），刚出现的格子先亮一下
//   · 打完的字从底往上涨水：水面以下的格子换成浪字、越深越浅、越晃，往下流进一条字符海（o.strip）
//   · 字形是得意黑（SMILEY）画在离屏画布上的蒙版，格子只管纹理和出现顺序，所以水面以上的字边是干净的矢量边
// drawLogo(ctx, S, o)：o.cx 中心 x、o.base 基线 y、o.px 字号、o.slot 字距、o.charT(k) → { type 0..1 打字进度, sea 0..1 化海进度, dy 竖直偏移 }、
//   o.edge 白边颜色、o.edgeW 白边宽、o.strip 底下画不画一条字符海（前奏底下本来就是海，不画）、o.alpha
import { CW, CH, BRAND } from './const.js';
import { newCanvas } from './env.js';
import { fonts, glyphs } from './glyphs.js';
import { pooled } from './cam.js';
import { mix } from './color.js';
import { hash, vnoise } from './rand.js';
import { clamp, lerp, smooth } from './time.js';
import { rev } from '../rev.js';

export const TITLE = '如果代码能长出海';
const CODE = 'while(alive){code.grow();if(code.deep)sea.rise(1);}for(let f=0;f<11501;f++)render(f/60);heart.beat(150);const sea=new Sea(code);';
const WAVE = '~≈~∽~≈';
// 字里的代码只当纹理（和品牌蓝差得不多，远看还是一个完整的字）；海越深越蓝
const INK = mix(BRAND, '#FFFFFF', 0.36), SEA = [mix(BRAND, '#FFFFFF', 0.45), mix(BRAND, '#FFFFFF', 0.3), mix(BRAND, '#FFFFFF', 0.12)];

// 每个字一张蒙版（字本身 + 带白边的外形）和它覆盖到的格子；格子网格全片对齐，字之间可以重叠
const MASKS = new Map();
function logoMask(px, slot, edgeW, div = 15) {
  const key = `${px}|${slot}|${edgeW}|${div}`;
  let M = MASKS.get(key);
  if (M) return M;
  const n = TITLE.length, cw = Math.max(4, Math.round(px / div)), ch = Math.round((cw * CH) / CW); // o.cellDiv：格子 = 字号 / div
  const padX = Math.ceil(px * 0.4), w = Math.ceil(padX * 2 + px + slot * (n - 1)), h = Math.ceil(px * 1.45), base = Math.round(px * 1.08);
  const xs = [...TITLE].map((_, k) => padX + px / 2 + k * slot);
  let inkTop = h, inkBot = 0;
  const chars = [...TITLE].map((chr, k) => {
    const sx = Math.floor((xs[k] - px) / cw) * cw, sw = Math.ceil((2 * px) / cw) * cw;
    const draw = stroke => {
      const cv = newCanvas(sw, h), c = cv.getContext('2d');
      c.font = fonts(px, 'SMILEY', 'SCB'); c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.fillStyle = c.strokeStyle = '#000'; c.lineJoin = 'round';
      if (stroke) { c.lineWidth = stroke; c.strokeText(chr, xs[k] - sx, base); }
      c.fillText(chr, xs[k] - sx, base);
      return cv;
    };
    const inner = draw(0), outer = draw(edgeW * 2);
    const di = inner.getContext('2d').getImageData(0, 0, sw, h).data, dO = outer.getContext('2d').getImageData(0, 0, sw, h).data;
    const cells = [];
    for (let r = 0; r * ch < h; r++) for (let c = 0; c * cw < sw; c++) {
      let si = 0, so = 0, nn = 0;
      for (let y = r * ch; y < Math.min(h, (r + 1) * ch); y++) for (let x = c * cw; x < (c + 1) * cw; x++) {
        const o = (y * sw + x) * 4 + 3; si += di[o] > 127; so += dO[o] > 127; nn++;
        if (di[o] > 127) { inkTop = Math.min(inkTop, y); inkBot = Math.max(inkBot, y); }
      }
      if (so) cells.push({ x: sx + c * cw, y: r * ch, r, c, ci: si / nn, co: so / nn });
    }
    // 打字顺序：从这个字的第一行开始一行行往下，每行从左往右
    const ins = cells.filter(e => e.ci > 0), r0 = Math.min(...ins.map(e => e.r)), r1 = Math.max(...ins.map(e => e.r));
    const c0 = Math.min(...ins.map(e => e.c)), c1 = Math.max(...ins.map(e => e.c));
    for (const e of cells) e.f = clamp((e.r - r0 + clamp((e.c - c0) / (c1 - c0 + 1))) / (r1 - r0 + 1), 0, 0.999);
    return { sx, inner, outer, cells };
  });
  M = { w, h, base, xs, cw, ch, chars, inkTop, inkBot, n, slot };
  MASKS.set(key, M);
  return M;
}

const blit = (g, set, chr, x, y, cw, ch) => { const q = set.get(chr); g.drawImage(q.cv, q.sx, q.sy, CW, CH, x, y, cw, ch); };

export function drawLogo(ctx, S, o) {
  const px = o.px, slot = o.slot ?? Math.round(px * 1.07), edgeW = o.edgeW ?? Math.round(px * 0.06);
  const M = logoMask(px, slot, edgeW, o.cellDiv ?? 15), t = S.t, n = M.n, { cw, ch } = M;
  const st = Array.from({ length: n }, (_, k) => ({ type: 0, sea: 0, dy: 0, ...o.charT(k) }));
  // 第二十一轮修：打字进度到 1 时最后两成的格子还停在"刚打出来、亮一下"的颜色上——进度放大 1.22 倍，打到 0.82 就全出来、亮光也退完（第二十三轮并开关）
  for (const s of st) s.type *= 1.22;
  if (!st.some(s => s.type > 0)) return;
  const x0 = Math.round(o.cx - M.w / 2), y0 = Math.round(o.base - M.base);
  // 字和字之间平滑插值（水面、竖直偏移）
  const at = (x, key) => {
    const f = clamp((x - M.xs[0]) / slot, 0, n - 1), k0 = Math.floor(f), k1 = Math.min(n - 1, k0 + 1);
    return lerp(st[k0][key], st[k1][key], smooth(f - k0));
  };
  const seaH = (M.inkBot - M.inkTop) * 0.26, amp = px * 0.045;
  // 水面（蒙版坐标）：化海进度 0 时在字底下，1 时涨到字高的四分之一；两层正弦起伏
  const wl = x => { const s = at(x, 'sea'); return M.inkBot + 3 - s * seaH + s * amp * (0.6 * Math.sin(x * 0.017 - t * 2.4) + 0.4 * Math.sin(x * 0.043 + t * 1.7)) + at(x, 'dy'); };

  ctx.save(); ctx.globalAlpha *= o.alpha ?? 1;
  ctx.translate(x0, y0);

  // 1. 底下的字符海：水面跟字的水面接上，往两边伸出去一点再收掉；越深越蓝、越淡，噪声留出空隙
  if (o.strip) {
    const sets = SEA.map(c => glyphs('SCB', c)), rowsMax = Math.round((px * 0.5) / ch);
    const xL = M.xs[0] - px * 0.6, xR = M.xs[n - 1] + px * 0.6;
    for (let c = Math.floor((xL - px * 1.3) / cw); c * cw < xR + px * 1.3; c++) {
      const x = c * cw, out = Math.max(0, xL - x, x - xR), e = at(clamp(x, xL, xR), 'sea') * smooth(clamp(1 - out / (px * 1.2)));
      if (e <= 0.02) continue;
      const rs = Math.floor(wl(clamp(x, xL, xR)) / ch), thick = Math.round(e * rowsMax * (0.65 + 0.35 * vnoise(c * 0.21, t * 0.6, 0, 41)));
      for (let d = 0; d <= thick; d++) {
        if (d > 0 && vnoise(c * 0.23, (rs + d) * 0.5, t * 0.9, 43) < 0.38) continue;
        // 浪字为主，一行往左流一行往右流；深处偶尔夹一个代码字（海是代码长出来的）
        const flow = c + (d % 2 ? 1 : -1) * Math.floor(t * 6), deep = d >= 2 && hash(flow, rs + d, 7) % 5 === 0;
        const chr = deep ? CODE[(((flow * 3 + d * 7) % CODE.length) + CODE.length) % CODE.length] : WAVE[hash(flow, d, 3) % WAVE.length];
        ctx.globalAlpha = (o.alpha ?? 1) * e * (1 - (0.8 * d) / (rowsMax + 1));
        blit(ctx, sets[Math.min(2, d)], chr, x, (rs + d) * ch, cw, ch);
      }
    }
    ctx.globalAlpha = o.alpha ?? 1;
  }

  // 2. 水面以上的字：格子画进缓冲，再用字形蒙版裁出干净的边
  const bo = pooled('logoO', M.w, M.h, true), bi = pooled('logoI', M.w, M.h, true), mo = pooled('logoMO', M.w, M.h, true), mi = pooled('logoMI', M.w, M.h, true);
  const [go, gi, gmo, gmi] = [bo, bi, mo, mi].map(b => { const g = b.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.clearRect(0, 0, M.w, M.h); return g; });
  const code = glyphs('SCB', INK), wav = glyphs('SCB', '#FFFFFF'), tick = Math.floor(t * 3);
  go.fillStyle = o.edge ?? '#FFFFFF';
  M.chars.forEach((C, k) => {
    const s = st[k];
    if (s.type <= 0) return;
    gmo.drawImage(C.outer, C.sx, s.dy); gmi.drawImage(C.inner, C.sx, s.dy);
    for (const e of C.cells) {
      if (s.type <= e.f) continue;
      const y = e.y + s.dy;
      go.fillRect(e.x - 1, y - 1, cw + 2, ch + 2);
      if (e.ci <= 0) continue;
      const fl = clamp(1 - (s.type - e.f) / 0.18); // 刚打出来的格子先亮一下再回到品牌蓝
      gi.fillStyle = fl > 0 ? mix(BRAND, '#FFFFFF', 0.8 * fl) : BRAND; gi.fillRect(e.x, y, cw, ch);
      const live = hash(e.x, e.y, tick) % 29 === 0 ? 1 : 0; // 偶尔换一个字：代码是活的
      blit(gi, code, CODE[(e.r * 37 + e.c * 3 + k * 11 + live) % CODE.length], e.x, y, cw, ch);
    }
  });
  for (const [g, m] of [[go, mo], [gi, mi]]) {
    g.globalCompositeOperation = 'destination-in'; g.drawImage(m, 0, 0);
    // 水面以下挖掉（那一截由下面的浪格子接手）
    g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.moveTo(0, M.h + 400);
    for (let x = 0; x <= M.w; x += 6) g.lineTo(x, wl(x));
    g.lineTo(M.w, M.h + 400); g.closePath(); g.fill();
    g.globalCompositeOperation = 'source-over';
  }
  ctx.drawImage(bo, 0, 0); ctx.drawImage(bi, 0, 0);

  // 3. 水面以下：字的下半截变成浪格子，越深越浅、左右晃得越厉害（先铺白底再画格子，格子之间不留白线）
  const melt = [];
  M.chars.forEach((C, k) => {
    const s = st[k];
    if (s.sea <= 0) return;
    for (const e of C.cells) {
      if (e.ci < 0.25 || s.type <= e.f) continue;
      const y = e.y + s.dy, w = wl(e.x + cw / 2);
      if (y + ch * 0.5 < w) continue;
      const dep = clamp((y + ch * 0.5 - w) / seaH), sway = Math.sin(t * 2.6 + e.r * 0.8 + e.c * 0.31) * cw * (0.3 + 1.5 * dep) * s.sea;
      melt.push({ e, dep, x: e.x + sway, y: y + dep * dep * ch * 0.6 * s.sea + 2 * Math.sin(t * 3.1 + e.c * 0.5) });
    }
  });
  ctx.fillStyle = o.edge ?? '#FFFFFF';
  for (const m of melt) { ctx.globalAlpha = (o.alpha ?? 1) * (1 - 0.4 * m.dep); ctx.fillRect(m.x - 1, m.y - 1, cw + 2, ch + 2); }
  for (const m of melt) {
    ctx.globalAlpha = (o.alpha ?? 1) * (1 - 0.4 * m.dep);
    ctx.fillStyle = mix(BRAND, '#FFFFFF', 0.12 + 0.5 * m.dep); ctx.fillRect(m.x, m.y, cw, ch);
    blit(ctx, wav, WAVE[(m.e.c + m.e.r + Math.floor(t * 4)) % WAVE.length], m.x, m.y, cw, ch);
  }
  ctx.restore();
}
