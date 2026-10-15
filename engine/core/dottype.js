// 点阵大字（第二十二轮，用户：「中间"世界"文字样式效果非常不好，修改设计方向，"天使"、"那就飞吧"也一样」
// 「歌词字体不要浮雕深色投影，其他位置的这类效果也都换掉」）rev type22
// 换成和 0:16「歌」同一种语言（用户认可过的那一版，drop.js geDots）：字形按网格取样成小方点——
//   出现：每颗点从起点（o.from，默认字底下）沿各自弯的路径飞到位、到位时过冲一下，字中心的点先走；
//   停留：一道扫描线从上往下扫一遍（扫到的点先亮成白）；每拍从字中心往外荡一圈点的放大（只作用在字上）；
//         少数点是粉色 / 金色点缀，亮度各不相同；后面一层浅色点错开当厚度（浅色，不是深色投影）；
//         整个词外面一副四角取景框 + 一行小标签；
//   离开：点按反过来的顺序（外圈先走）被吸到 o.to，或者被风（o.wind）吹走
// dotType(ctx, S, o)：o.text、o.x（中心 x；o.align 'l' 时是左边）、o.y（字的竖直中心）、o.px 字高、o.keys 字体、o.color 主色、o.accent 点缀色、
//   o.charT(k) → { age 出现后的秒数（< 0 不画）, out 开始离开后的秒数（< 0 不离开）, dx, dy, s, r, alpha }、
//   o.from(k, cx, cy) → [x, y] 起点、o.to → [x, y] 收回点、o.wind [dx, dy]、o.frame（默认 true）、o.label 标签文字
// 返回 { box: [x0, y0, x1, y1], centers }
import { BRAND } from './const.js';
import { pooled } from './cam.js';
import { fonts } from './glyphs.js';
import { css } from './color.js';
import { rnd } from './rand.js';
import { clamp, lerp, easeIn, easeOut, easeOutBack } from './time.js';

const CELLS = new Map();
function dotCells(ch, N, keys) {
  const key = `${ch}|${N}|${keys}`;
  let L = CELLS.get(key);
  if (L) return L;
  const cv = pooled('dot22raster', N, N), c = cv.getContext('2d');
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, N, N);
  c.font = fonts(Math.round(N * 0.92), ...keys); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#000'; c.fillText(ch, N / 2, N / 2 + 1);
  const d = c.getImageData(0, 0, N, N).data;
  L = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (d[(j * N + i) * 4 + 3] > 110) L.push({ i, j, r: Math.hypot(i - N / 2, j - N / 2) / (N / 2), k: L.length });
  const m = pooled('dot22m', 8, 8).getContext('2d'); m.font = fonts(Math.round(N * 0.92), ...keys);
  L.adv = m.measureText(ch).width / N; // 字宽（按字高的比例）
  CELLS.set(key, L);
  return L;
}

export function dotType(ctx, S, o) {
  const chars = Array.isArray(o.text) ? o.text : [...o.text], px = o.px, keys = o.keys ?? ['SMILEY', 'SCB'];
  const N = Math.max(14, Math.round(o.grid ?? px / 7)), pitch = px / N, dot = pitch * 0.78, color = o.color ?? BRAND, accent = o.accent ?? S.pal.acc[0];
  const cellsOf = chars.map(ch => dotCells(ch, N, keys)), track = px * 0.06, widths = cellsOf.map(L => Math.max(0.35, L.adv) * px + track);
  const total = widths.reduce((s, v) => s + v, 0) - track;
  let x = o.align === 'l' ? o.x : o.x - total / 2;
  const centers = [], box = [Infinity, Infinity, -Infinity, -Infinity];
  ctx.save();
  cellsOf.forEach((cells, k) => {
    const st = o.charT ? o.charT(k) : { age: 9 }, cx = x + widths[k] / 2 - track / 2 + (st.dx ?? 0), cy = o.y + (st.dy ?? 0);
    x += widths[k];
    centers.push([cx, cy]);
    if (st.age == null || st.age < 0) return;
    box[0] = Math.min(box[0], cx - px * 0.5); box[1] = Math.min(box[1], cy - px * 0.5); box[2] = Math.max(box[2], cx + px * 0.5); box[3] = Math.max(box[3], cy + px * 0.5);
    const [fx0, fy0] = o.from ? o.from(k, cx, cy) : [cx, cy + px * 0.9], sc = st.s ?? 1, rot = st.r ?? 0, cr = Math.cos(rot), sr = Math.sin(rot), age = st.age, out = st.out ?? -1;
    const scan = clamp((age - 0.45) / 0.4), alpha = st.alpha ?? 1;
    ctx.globalAlpha = alpha;
    for (const layer of [1, 0]) for (const c of cells) {
      const d0 = 0.04 + 0.22 * c.r + rnd(c.k, k, 31) * 0.05, fa = (age - d0) / 0.2;
      if (fa <= 0) continue;
      const lx = (c.i - N / 2 + 0.5) * pitch * sc, ly = (c.j - N / 2 + 0.5) * pitch * sc, tx = cx + lx * cr - ly * sr, ty = cy + lx * sr + ly * cr;
      const fe = clamp(fa), q = 1 - fe, e = easeOutBack(fe, 1.5), bend = (rnd(c.k, k, 33) - 0.5) * px * 0.9, mx = (fx0 + tx) / 2 + bend, my = (fy0 + ty) / 2 - px * 0.35 * rnd(c.k, k, 34);
      let pxx = q * q * fx0 + 2 * q * fe * mx + fe * fe * tx, pyy = q * q * fy0 + 2 * q * fe * my + fe * fe * ty;
      if (fa >= 1) { pxx = tx + (tx - cx) * (e - 1) * 0.15; pyy = ty + (ty - cy) * (e - 1) * 0.15; }
      let shrink = 1;
      if (out >= 0) {
        const d1 = 0.3 * (1 - c.r) + rnd(c.k, k, 32) * 0.08, ba = clamp((out - d1) / 0.22);
        if (ba >= 1) continue;
        const be = easeIn(ba);
        if (o.to) { pxx = lerp(pxx, o.to[0], be); pyy = lerp(pyy, o.to[1], be); }
        else { const [wx, wy] = o.wind ?? [1, -0.3]; pxx += wx * px * 3 * be * (0.6 + 0.8 * rnd(c.k, k, 35)); pyy += wy * px * 3 * be * (0.6 + 0.8 * rnd(c.k, k, 36)) + Math.sin(ba * 7 + c.j) * 10 * ba; }
        shrink = 1 - 0.6 * be;
      }
      const ripple = age > 0.45 && out < 0 ? Math.max(0, 1 - Math.abs(S.sub * 2.2 - c.r) * 4) : 0;
      const s = dot * sc * (fa < 1 ? lerp(0.35, 1, e) : 1) * (1 + 0.35 * ripple) * shrink;
      if (layer) { ctx.fillStyle = css('#9DB0F5', 0.42); const off = dot * 0.4; ctx.fillRect(pxx - s / 2 + off, pyy - s / 2 + off, s, s); continue; }
      const lit = scan > 0 && scan < 1 && Math.abs(c.j / N - scan) < 0.07;
      ctx.fillStyle = lit ? '#FFFFFF' : c.k % 23 === 0 ? accent : c.k % 31 === 0 ? '#FFC23D' : css(color, 0.72 + 0.28 * rnd(c.k, k, 37));
      ctx.fillRect(pxx - s / 2, pyy - s / 2, s, s);
    }
    if (scan > 0 && scan < 1 && out < 0) { ctx.fillStyle = css('#FFFFFF', 0.75 * alpha); ctx.fillRect(cx - px * 0.55, cy - px / 2 + scan * px, px * 1.1, 2); }
  });
  // 取景框 + 标签：最后一个字落定以后出现，开始离开时淡掉
  if (o.frame !== false && box[0] < Infinity) {
    const lastAge = Math.min(...chars.map((_, k) => (o.charT ? o.charT(k).age ?? 9 : 9))), outs = chars.map((_, k) => (o.charT ? o.charT(k).out ?? -1 : -1)).filter(v => v >= 0);
    const fr = clamp((lastAge - 0.35) / 0.14) * (outs.length ? 1 - clamp(Math.max(...outs) / 0.12) : 1);
    if (fr > 0) {
      const pad = px * 0.18, L = px * 0.16, gap = px * 0.1 * (1 - easeOut(clamp((lastAge - 0.35) / 0.25)));
      const [x0, y0, x1, y1] = [box[0] - pad - gap, box[1] - pad - gap, box[2] + pad + gap, box[3] + pad + gap];
      ctx.globalAlpha = fr * (o.charT ? o.charT(0).alpha ?? 1 : 1); ctx.strokeStyle = color; ctx.lineWidth = Math.max(2, px / 70); ctx.beginPath();
      for (const [sx, sy, X, Y] of [[1, 1, x0, y0], [-1, 1, x1, y0], [-1, -1, x1, y1], [1, -1, x0, y1]]) { ctx.moveTo(X, Y + sy * L); ctx.lineTo(X, Y); ctx.lineTo(X + sx * L, Y); }
      ctx.stroke();
      if (o.label) { ctx.font = fonts(Math.max(14, Math.round(px * 0.075)), 'ZENB', 'SCB'); ctx.fillStyle = color; ctx.textBaseline = 'bottom'; ctx.fillText(o.label, x0, y0 - 8); ctx.textBaseline = 'alphabetic'; }
    }
  }
  ctx.restore();
  return { box, centers };
}
