// 间奏二的颜色分区图（第十五轮）：scripts/video_maps.mjs 出的 build/maps/<编号>.seg，按帧解出 640×360 的类图
// （0 背景 1 蓝（头发 / 尾巴）2 深蓝（裙子）3 白 4 皮肤 5 黑），再派生出 ControlNet 那几种"预处理图"：
// 边缘、线稿、深度、法线、分区上色、距离场。全部只由帧号决定；解出来的帧和派生图都只缓存最近几帧
import { ENV, newCanvas } from './env.js';
import { clamp } from './time.js';

const SEG = new Map();
export async function loadSegs() {
  for (const id of ['V9', 'V10']) {
    const f = `build/maps/${id}.seg`;
    if (ENV.P.loadBin && (await ENV.P.exists(f))) SEG.set(id, parse(await ENV.P.loadBin(f)));
  }
}
function parse(buf) {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  if (String.fromCharCode(u8[0], u8[1], u8[2], u8[3]) !== 'SEG1') throw new Error('不是 SEG1 文件');
  const w = dv.getUint16(4, true), h = dv.getUint16(6, true), n = dv.getUint16(8, true), fps = dv.getUint16(10, true) / 100, offs = [];
  let o = 12;
  for (let k = 0; k < n; k++) { const len = dv.getUint32(o, true); offs.push([o + 4, len]); o += 4 + len; }
  return { w, h, n, fps, u8, offs };
}
export const hasSeg = id => SEG.has(id);
export const segInfo = id => SEG.get(id);
// 时刻 → 帧号（从 t0 起按 speed 倍速放，放完停在最后一帧）
export function segIndex(id, t, t0, speed = 1) {
  const s = SEG.get(id); if (!s) return 0;
  return clamp(Math.floor(Math.max(0, (t - t0) * speed * s.fps)), 0, s.n - 1);
}

// 小缓存：key → 值，最多 n 个
function lru(n) {
  const m = new Map();
  return (key, make) => { if (m.has(key)) return m.get(key); const v = make(); m.set(key, v); if (m.size > n) m.delete(m.keys().next().value); return v; };
}
const LABELS = lru(6), DERIVED = lru(48); // 第十六轮：一帧要的派生图多了（矢量线、本色、单个部位蒙版），双人时两帧同时用

// 第 k 帧的类图：Uint8Array(w × h)
export function segLabels(id, k) {
  const s = SEG.get(id); if (!s) return null;
  k = clamp(k | 0, 0, s.n - 1);
  return LABELS(`${id}|${k}`, () => {
    const out = new Uint8Array(s.w * s.h), [o, len] = s.offs[k];
    let p = 0;
    for (let i = o; i < o + len; i += 2) { out.fill(s.u8[i], p, p + s.u8[i + 1]); p += s.u8[i + 1]; }
    return out;
  });
}

// 按格子取类（取格子中心那个像素）：cols × rows
export function segGrid(id, k, cols, rows) {
  return DERIVED(`g|${id}|${k}|${cols}|${rows}`, () => {
    const s = SEG.get(id), L = segLabels(id, k), a = new Uint8Array(cols * rows);
    for (let r = 0; r < rows; r++) { const y = Math.min(s.h - 1, Math.floor(((r + 0.5) / rows) * s.h)); for (let c = 0; c < cols; c++) a[r * cols + c] = L[y * s.w + Math.min(s.w - 1, Math.floor(((c + 0.5) / cols) * s.w))]; }
    return a;
  });
}

// 距离场（320×180）：sd > 0 在她身体里（离轮廓多远），< 0 在外面；单位 = 这张小图的像素（全屏时 1 = 6 px）
export function segDist(id, k) {
  return DERIVED(`d|${id}|${k}`, () => {
    const s = SEG.get(id), L = segLabels(id, k), w = 320, h = 180, inside = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) inside[y * w + x] = L[(y * 2) * s.w + x * 2] > 0 ? 1 : 0;
    const cham = want => { // 到最近的"不是 want"的像素的距离（两遍 3-4 倒角）
      const d = new Float32Array(w * h), BIG = 1e6, A = 1, B = Math.SQRT2;
      for (let i = 0; i < w * h; i++) d[i] = inside[i] === want ? BIG : 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x; if (!d[i]) continue;
        let v = d[i];
        if (x > 0) v = Math.min(v, d[i - 1] + A);
        if (y > 0) { v = Math.min(v, d[i - w] + A); if (x > 0) v = Math.min(v, d[i - w - 1] + B); if (x < w - 1) v = Math.min(v, d[i - w + 1] + B); }
        d[i] = v;
      }
      for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
        const i = y * w + x; if (!d[i]) continue;
        let v = d[i];
        if (x < w - 1) v = Math.min(v, d[i + 1] + A);
        if (y < h - 1) { v = Math.min(v, d[i + w] + A); if (x < w - 1) v = Math.min(v, d[i + w + 1] + B); if (x > 0) v = Math.min(v, d[i + w - 1] + B); }
        d[i] = v;
      }
      return d;
    };
    const dIn = cham(1), dOut = cham(0), sd = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) sd[i] = inside[i] ? Math.min(dIn[i], 200) : -Math.min(dOut[i], 200);
    return { w, h, sd };
  });
}
// 距离场上某一点（0..1 归一化坐标）双线性取值
export function sdAt(D, u, v) {
  const x = clamp(u * D.w - 0.5, 0, D.w - 1.001), y = clamp(v * D.h - 0.5, 0, D.h - 1.001), x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0, i = y0 * D.w + x0;
  return (D.sd[i] * (1 - fx) + D.sd[i + 1] * fx) * (1 - fy) + (D.sd[i + D.w] * (1 - fx) + D.sd[i + D.w + 1] * fx) * fy;
}

// 派生图（画布）。kind：
//   'seg'    分区上色（SAM / ADE 那种鲜艳的平涂，区域交界一条白线）
//   'edge'   Canny 式边缘（白色像素线、透明底）
//   'line'   线稿（深色线、透明底）
//   'depth'  深度（越靠身体中轴越亮，外面黑）
//   'normal' 法线贴图（由深度的梯度算，平的地方是淡紫 128,128,255）
//   'mask'   剪影（不透明黑、透明底）
export const SEG_PAL = { 1: [79, 124, 255], 2: [155, 92, 255], 3: [63, 214, 198], 4: [255, 143, 177], 5: [255, 201, 60] };
// 第十六轮：'cel' 用的"本色"（头发 / 尾巴浅蓝、裙子深蓝、围裙白、皮肤、鞋）
export const CEL_PAL = { 1: [104, 146, 246], 2: [44, 52, 118], 3: [246, 248, 255], 4: [255, 228, 214], 5: [34, 36, 52] };
// 深度（320×180，0..1，外面 0）：离轮廓越远越近（亮），再按部位前后错一点——围裙 / 皮肤在前，裙子居中，头发、尾巴在后
function depthOf(id, k) {
  return DERIVED(`dp|${id}|${k}`, () => {
    const s = SEG.get(id), L = segLabels(id, k), D = segDist(id, k), sd = D.sd, w = 320, h = 180, OFF = [0, -0.2, 0.02, 0.14, 0.08, 0.05], out = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) out[i] = sd[i] > 0 ? clamp(0.18 + 0.62 * Math.min(1, sd[i] / 14) ** 0.9 + OFF[L[((i / w) | 0) * 2 * s.w + (i % w) * 2]], 0.05, 1) : 0;
    return out;
  });
}
// 法线（320×180，三个分量）：由深度的梯度算
function normalsOf(id, k) {
  return DERIVED(`nm|${id}|${k}`, () => {
    const dep = depthOf(id, k), sd = segDist(id, k).sd, w = 320, h = 180, n = new Float32Array(w * h * 3);
    for (let i = 0; i < w * h; i++) {
      if (sd[i] <= 0) { n[i * 3 + 2] = 1; continue; }
      const gx = dep[Math.min(i + 1, w * h - 1)] - dep[Math.max(i - 1, 0)], gy = dep[Math.min(i + w, w * h - 1)] - dep[Math.max(i - w, 0)];
      let nx = -gx * 6, ny = -gy * 6, nz = 1; const nl = Math.hypot(nx, ny, nz); n[i * 3] = nx / nl; n[i * 3 + 1] = ny / nl; n[i * 3 + 2] = nz / nl;
    }
    return n;
  });
}
// 第十六轮：某一点（0..1）的明暗——法线点乘一个左上方的光（0..1），给半调网点和本色的两档明暗用
export function segShade(id, k, u, v) {
  const n = normalsOf(id, k), x = clamp(Math.floor(u * 320), 0, 319), y = clamp(Math.floor(v * 180), 0, 179), i = (y * 320 + x) * 3;
  return clamp(-0.42 * n[i] - 0.5 * n[i + 1] + 0.76 * n[i + 2]);
}
// 第十六轮（用户：线稿有点糊）：线稿不再是 640×360 的像素线放大 3 倍，而是矢量线——每个类的区域先做一次 [1 2 1]² 模糊，
// 再用 marching squares 取 0.5 等值线（亚像素位置，线是顺的）。outer = 剪影外轮廓，inner = 部位之间的分界线（贴着背景的那段不算）。
// 坐标是视频归一化坐标（0..1），一串线段 [x0, y0, x1, y1, …]
export function segContours(id, k) {
  return DERIVED(`ct|${id}|${k}`, () => {
    const s = SEG.get(id), L = segLabels(id, k), bx = segBox(id, k);
    // 只在她的包围盒（外扩 6 px）里算：整幅 640×360 要 90 ms，包围盒里约 1/3
    const X0 = Math.max(0, Math.floor(bx.x0 * s.w) - 6), Y0 = Math.max(0, Math.floor(bx.y0 * s.h) - 6), X1 = Math.min(s.w, Math.ceil(bx.x1 * s.w) + 7), Y1 = Math.min(s.h, Math.ceil(bx.y1 * s.h) + 7);
    const w = X1 - X0, h = Y1 - Y0, f = new Float32Array(w * h), tmp = new Float32Array(w * h), lab = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) lab.set(L.subarray((Y0 + y) * s.w + X0, (Y0 + y) * s.w + X1), y * w);
    const blur = () => {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; tmp[i] = (f[i] * 2 + f[x > 0 ? i - 1 : i] + f[x < w - 1 ? i + 1 : i]) * 0.25; }
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; f[i] = (tmp[i] * 2 + tmp[y > 0 ? i - w : i] + tmp[y < h - 1 ? i + w : i]) * 0.25; }
    };
    const present = new Set(lab);
    const field = test => { for (let i = 0; i < w * h; i++) f[i] = test(lab[i]) ? 1 : 0; blur(); blur(); };
    const march = (out, keep) => {
      for (let y = 0; y < h - 1; y++) for (let x = 0; x < w - 1; x++) {
        const i = y * w + x, a = f[i] - 0.5, b = f[i + 1] - 0.5, c = f[i + w + 1] - 0.5, d = f[i + w] - 0.5;
        if ((a > 0) === (b > 0) && (b > 0) === (c > 0) && (c > 0) === (d > 0)) continue;
        const p = [];
        if ((a > 0) !== (b > 0)) p.push(x + a / (a - b), y);
        if ((b > 0) !== (c > 0)) p.push(x + 1, y + b / (b - c));
        if ((d > 0) !== (c > 0)) p.push(x + d / (d - c), y + 1);
        if ((a > 0) !== (d > 0)) p.push(x, y + a / (a - d));
        for (let q = 0; q + 3 < p.length; q += 4) if (!keep || keep(p[q], p[q + 1], p[q + 2], p[q + 3])) out.push((X0 + p[q] + 0.5) / s.w, (Y0 + p[q + 1] + 0.5) / s.h, (X0 + p[q + 2] + 0.5) / s.w, (Y0 + p[q + 3] + 0.5) / s.h);
      }
    };
    const outer = []; field(l => l > 0); march(outer);
    const sil = Float32Array.from(f), inner = [];
    const inside = (x0, y0, x1, y1) => { const x = Math.round((x0 + x1) / 2), y = Math.round((y0 + y1) / 2); return sil[clamp(y, 0, h - 1) * w + clamp(x, 0, w - 1)] > 0.97; };
    for (const l of [1, 2, 3, 4, 5]) if (present.has(l)) { field(v => v === l); march(inner, inside); }
    return { outer: Float32Array.from(outer), inner: Float32Array.from(inner) };
  });
}
export function segCanvas(id, k, kind) {
  return DERIVED(`c|${id}|${k}|${kind}`, () => {
    const s = SEG.get(id), L = segLabels(id, k);
    const lowres = kind === 'depth' || kind === 'normal', w = lowres ? 320 : s.w, h = lowres ? 180 : s.h;
    const cv = newCanvas(w, h), c = cv.getContext('2d'), im = c.createImageData(w, h), d = im.data;
    if (kind === 'cel') { // 第十六轮：本色平涂 + 两档明暗（像赛璐璐上色），线稿另外用矢量线叠；只在包围盒里算
      const n = normalsOf(id, k), bx = segBox(id, k), X0 = Math.max(0, Math.floor(bx.x0 * w) - 2), X1 = Math.min(w, Math.ceil(bx.x1 * w) + 3), Y0 = Math.max(0, Math.floor(bx.y0 * h) - 2), Y1 = Math.min(h, Math.ceil(bx.y1 * h) + 3);
      for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) {
        const i = y * w + x, l = L[i], o = i * 4;
        if (!l) continue;
        const j = ((y >> 1) * 320 + (x >> 1)) * 3, sh = -0.42 * n[j] - 0.5 * n[j + 1] + 0.76 * n[j + 2];
        const p = CEL_PAL[l], m = sh > 0.5 ? 1 : l === 3 ? 0.88 : 0.8;
        d[o] = p[0] * m; d[o + 1] = p[1] * m; d[o + 2] = Math.min(255, p[2] * m + (m < 1 ? 14 : 0)); d[o + 3] = 255;
      }
      c.putImageData(im, 0, 0);
      return cv;
    }
    if (/^lab[1-5]$/.test(kind)) { // 第十六轮：单个部位的蒙版（SAM 式一块块填色用）
      const want = +kind[3];
      for (let i = 0; i < w * h; i++) if (L[i] === want) d[i * 4 + 3] = 255;
      c.putImageData(im, 0, 0);
      return cv;
    }
    if (kind === 'seg' || kind === 'edge' || kind === 'line' || kind === 'mask') {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x, l = L[i], o = i * 4, r = x < w - 1 ? L[i + 1] : l, b = y < h - 1 ? L[i + w] : l, edge = (l !== r || l !== b) && (l || r || b);
        if (kind === 'mask') { if (l) { d[o + 3] = 255; } continue; }
        if (kind === 'seg') { if (edge && l) { d[o] = d[o + 1] = d[o + 2] = 255; d[o + 3] = 255; } else if (l) { const p = SEG_PAL[l]; d[o] = p[0]; d[o + 1] = p[1]; d[o + 2] = p[2]; d[o + 3] = 255; } continue; }
        if (!edge) continue;
        if (kind === 'edge') { d[o] = d[o + 1] = d[o + 2] = 255; d[o + 3] = 255; } else { d[o] = 20; d[o + 1] = 26; d[o + 2] = 58; d[o + 3] = 255; }
      }
    } else {
      // 深度：离轮廓越远越近（亮），再按部位前后错一点——围裙 / 皮肤在前，裙子居中，头发、尾巴在后——读得出起伏，不是一块平的白
      const D = segDist(id, k), sd = D.sd, OFF = [0, -0.2, 0.02, 0.14, 0.08, 0.05];
      const lab = i => L[((i / w) | 0) * 2 * s.w + (i % w) * 2];
      const dep = i => (sd[i] > 0 ? clamp(0.18 + 0.62 * Math.min(1, sd[i] / 14) ** 0.9 + OFF[lab(i)], 0.05, 1) : 0);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x, o = i * 4, v = dep(i);
        if (kind === 'depth') { const g = sd[i] > 0 ? 40 + 215 * v : 0; d[o] = g * 0.92; d[o + 1] = g * 0.95; d[o + 2] = g; d[o + 3] = 255; continue; }
        const gx = dep(Math.min(i + 1, w * h - 1)) - dep(Math.max(i - 1, 0)), gy = dep(Math.min(i + w, w * h - 1)) - dep(Math.max(i - w, 0));
        let nx = -gx * 6, ny = -gy * 6, nz = 1; const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
        if (sd[i] <= 0) { nx = 0; ny = 0; nz = 1; }
        d[o] = 128 + 127 * nx; d[o + 1] = 128 - 127 * ny; d[o + 2] = 128 + 127 * nz; d[o + 3] = 255;
      }
    }
    c.putImageData(im, 0, 0);
    return cv;
  });
}
// 一帧的包围盒（0..1）：她在画面里的范围
export function segBox(id, k) {
  return DERIVED(`b|${id}|${k}`, () => {
    const s = SEG.get(id), L = segLabels(id, k);
    let x0 = s.w, y0 = s.h, x1 = 0, y1 = 0;
    for (let y = 0; y < s.h; y += 2) for (let x = 0; x < s.w; x += 2) if (L[y * s.w + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return x1 < x0 ? { x0: 0.4, y0: 0.1, x1: 0.6, y1: 0.95 } : { x0: x0 / s.w, y0: y0 / s.h, x1: x1 / s.w, y1: y1 / s.h };
  });
}
