// 2.5D 镜头：相机关键帧、图层视差、景深模糊、透视面板（视觉方案 §4.14，第六轮）
// 相机 { x, y, zoom, rot }：x/y 是主平面上的平移（像素），zoom 缩放，rot 旋转（弧度）
// 图层深度 depth：1 = 主平面；0 = 不随相机动的远景（或屏幕层）；>1 = 近景，比主平面动得多
import { W, H } from './const.js';
import { newCanvas } from './env.js';
import { clamp, lerp, smooth, easeIn, easeOut, easeOutBack } from './time.js';

// inout4：四次缓入缓出（animation-principles 的运镜曲线，起步落定柔、中段快）；expo：指数缓出（急起慢停）
const inout4 = u => { u = clamp(u); return u < 0.5 ? 8 * u ** 4 : 1 - (-2 * u + 2) ** 4 / 2; };
const expo = u => { u = clamp(u); return u >= 1 ? 1 : 1 - Math.pow(2, -10 * u); };
const EASE = { smooth, in: easeIn, out: easeOut, linear: u => clamp(u), back: u => easeOutBack(u, 1.6), inout4, expo };

// 关键帧 [{ t, x, y, zoom, rot, e }]（e 是到达这一帧用的缓动，默认 smooth）。没写的字段沿用上一帧
export function camAt(keys, t) {
  const full = [];
  let prev = { x: 0, y: 0, zoom: 1, rot: 0 };
  for (const k of keys) { prev = { ...prev, ...k }; full.push(prev); }
  if (t <= full[0].t) return full[0];
  for (let i = 1; i < full.length; i++) {
    const a = full[i - 1], b = full[i];
    if (t < b.t) {
      const u = (EASE[b.e || 'smooth'])((t - a.t) / (b.t - a.t));
      return { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), zoom: a.zoom * Math.pow(b.zoom / a.zoom, u), rot: lerp(a.rot, b.rot, u) };
    }
  }
  return full[full.length - 1];
}

// 在相机下画某个深度的图层
export function withCam(ctx, cam, depth, draw) {
  ctx.save();
  const z = 1 + (cam.zoom - 1) * depth;
  ctx.translate(W / 2, H / 2);
  if (cam.rot) ctx.rotate(cam.rot * Math.min(1, depth));
  ctx.scale(z, z);
  ctx.translate(-W / 2 - cam.x * depth, -H / 2 - cam.y * depth);
  draw(ctx);
  ctx.restore();
}

// 主平面坐标 → 屏幕坐标（给引线、HUD 跟随用）
export function camToScreen(cam, depth, x, y) {
  const z = 1 + (cam.zoom - 1) * depth, r = (cam.rot || 0) * Math.min(1, depth);
  const dx = (x - W / 2 - cam.x * depth) * z, dy = (y - H / 2 - cam.y * depth) * z;
  return [W / 2 + dx * Math.cos(r) - dy * Math.sin(r), H / 2 + dx * Math.sin(r) + dy * Math.cos(r)];
}

// ---------------------------------------------------------------- 缓冲池（只建一次，不在每帧新建画布）

const POOL = new Map();
export function pooled(key, w, h) {
  let c = POOL.get(key);
  if (!c || c.width !== w || c.height !== h) { c = newCanvas(w, h); POOL.set(key, c); }
  return c;
}

// 景深：在 1/k 分辨率的缓冲上画 draw，在小图上再轻轻模糊一次，然后用高质量插值放大画回来（k 越大越糊；k 取 2–10）。
// 第七轮：只缩小再放大会出现马赛克一样的方格，所以加了小图上的模糊和高质量放大。
// slot 区分同一帧里的多个模糊层（同一 slot 一帧只能用一次）
export function blurLayer(ctx, k, draw, { slot = 0, alpha = 1 } = {}) {
  if (alpha <= 0) return;
  if (k <= 1.01) { ctx.save(); ctx.globalAlpha *= alpha; draw(ctx); ctx.restore(); return; }
  const w = Math.ceil(W / k), h = Math.ceil(H / k), cv = pooled(`blur${slot}`, W, H), c = cv.getContext('2d');
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, w + 2, h + 2);
  c.setTransform(1 / k, 0, 0, 1 / k, 0, 0);
  draw(c);
  c.setTransform(1, 0, 0, 1, 0, 0);
  const sm = pooled(`blurS${slot}`, w, h), s = sm.getContext('2d');
  s.clearRect(0, 0, w, h);
  s.filter = 'blur(0.9px)'; s.drawImage(cv, 0, 0, w, h, 0, 0, w, h); s.filter = 'none';
  ctx.save();
  ctx.globalAlpha *= alpha; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sm, 0, 0, w, h, 0, 0, w * k, h * k);
  ctx.restore();
}

// 一张画布的模糊版（缓存在 slot 里，每帧可刷新）：逐级减半缩小到 1/k，再在小图上轻轻模糊。
// 返回的小画布带 __soft 标记，drawPersp 画它时用高质量插值放大
export function softCopy(src, k, slot) {
  const w = Math.max(1, Math.round(src.width / k)), h = Math.max(1, Math.round(src.height / k));
  let cur = src, cw = src.width, ch = src.height, i = 0;
  while (cw / 2 >= w * 1.15) {
    const nw = Math.ceil(cw / 2), nh = Math.ceil(ch / 2), cv = pooled(`soft${slot}_${i++}`, nw, nh), c = cv.getContext('2d');
    c.clearRect(0, 0, nw, nh); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'medium';
    c.drawImage(cur, 0, 0, cw, ch, 0, 0, nw, nh);
    cur = cv; cw = nw; ch = nh;
  }
  const cv = pooled(`soft${slot}`, w, h), c = cv.getContext('2d');
  c.clearRect(0, 0, w, h); c.imageSmoothingEnabled = true;
  c.filter = `blur(${Math.min(2, 0.4 + k * 0.12).toFixed(2)}px)`;
  c.drawImage(cur, 0, 0, cw, ch, 0, 0, w, h);
  c.filter = 'none';
  cv.__soft = true;
  return cv;
}

// ---------------------------------------------------------------- 透视面板

// 鱼眼（柱面）畸变：屏幕上离中心横向越远，横向越挤、竖向越矮（fish = 畸变半径，像素；越小越强；0 不畸变）
// 横线因此弯向画面两侧的消失点（第七轮 L07）。返回 [x', y缩放]
export function fishX(dx, fish) {
  if (!fish) return [dx, 1];
  const th = Math.atan(dx / fish);
  return [fish * th, Math.cos(th)];
}

// 把 src 画成三维空间里绕竖直轴转 ang 的平面：中心 (X, Y, Z)，宽高 w×h（世界单位），焦距 f（越小越广角）
// 屏幕中心对应世界原点。按竖条近似透视（strips 条）。o.fish 鱼眼畸变半径（见 fishX）
// shear: true（第九轮）时每条竖条按两侧的上下沿做斜切（仿射），横线是连续的斜线而不是台阶——
// 以前每条竖条上下沿是平的，斜看的墙上横线会出锯齿（用户：1:26 背景透视横线锯齿明显）
export function drawPersp(ctx, src, X, Y, Z, w, h, ang, { f = 900, strips = 36, alpha = 1, cx = W / 2, cy = H / 2, fish = 0, shear = false } = {}) {
  if (alpha <= 0) return;
  const ca = Math.cos(ang), sa = Math.sin(ang), sw = src.width, sh = src.height;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.imageSmoothingEnabled = true;
  if (src.__soft || shear) ctx.imageSmoothingQuality = 'high';
  if (shear) {
    const edge = l => { const z = Z + l * sa, [fx, ky] = fishX(((X + l * ca) * f) / z, fish); return { z, x: cx + fx, top: cy + (((Y - h / 2) * f) / z) * ky, bot: cy + (((Y + h / 2) * f) / z) * ky }; };
    const base = ctx.getTransform();
    let A = edge(-0.5 * w);
    for (let i = 0; i < strips; i++) {
      const B = edge(((i + 1) / strips - 0.5) * w), u0 = i / strips, ssw = sw / strips;
      if (A.z >= 60 && B.z >= 60 && Math.max(A.x, B.x) >= 0 && Math.min(A.x, B.x) <= W) {
        const dx = B.x - A.x, hm = (B.bot - B.top + (A.bot - A.top)) / 2, slope = (B.top - A.top + (B.bot - A.bot)) / 2;
        ctx.setTransform(base);
        ctx.transform((dx + Math.sign(dx) * 0.9) / ssw, slope / ssw, 0, hm / sh, A.x, A.top + (A.bot - A.top - hm) / 2);
        ctx.drawImage(src, u0 * sw, 0, ssw, sh, 0, 0, ssw, sh);
      }
      A = B;
    }
    ctx.restore();
    return;
  }
  for (let i = 0; i < strips; i++) {
    const u0 = i / strips, u1 = (i + 1) / strips;
    const l0 = (u0 - 0.5) * w, l1 = (u1 - 0.5) * w;
    const z0 = Z + l0 * sa, z1 = Z + l1 * sa;
    if (z0 < 60 || z1 < 60) continue;
    const [fx0] = fishX(((X + l0 * ca) * f) / z0, fish), [fx1] = fishX(((X + l1 * ca) * f) / z1, fish);
    const x0 = cx + fx0, x1 = cx + fx1;
    const zm = (z0 + z1) / 2, [, ky] = fishX(((X + ((l0 + l1) / 2) * ca) * f) / zm, fish);
    const top = cy + (((Y - h / 2) * f) / zm) * ky, bot = cy + (((Y + h / 2) * f) / zm) * ky;
    const dx = Math.min(x0, x1), dw = Math.abs(x1 - x0) + 0.8;
    if (dx > W || dx + dw < 0) continue;
    ctx.drawImage(src, u0 * sw, 0, Math.max(1, (u1 - u0) * sw), sh, dx, top, dw, bot - top);
  }
  ctx.restore();
}

// 绕水平轴俯仰：把 src 画成往远处倒下去的平面（像地板）。中心 (cx, cy) 在屏幕上，平面中心距相机 Z，
// pitch 0 = 正对相机，越大越像地面（上沿退远）。按横条近似（strips 条）。返回 map(u, v) → [x, y, 缩放]（平面上归一化坐标 → 屏幕）
export function drawPitch(ctx, src, cx, cy, w, h, pitch, { Z = 1000, f = 1000, strips = 48, alpha = 1 } = {}) {
  const cp = Math.cos(pitch), sp = Math.sin(pitch), sw = src.width, sh = src.height;
  const map = (u, v) => { const yw = (v - 0.5) * h, z = Z + yw * sp, k = f / z; return [cx + (u - 0.5) * w * k, cy + yw * cp * k, k]; };
  if (alpha > 0) {
    ctx.save(); ctx.globalAlpha *= alpha; ctx.imageSmoothingEnabled = true;
    for (let i = 0; i < strips; i++) {
      const v0 = i / strips, v1 = (i + 1) / strips, [, y0, k0] = map(0.5, v0), [, y1, k1] = map(0.5, v1);
      if (Z + (v0 - 0.5) * h * sp < 40) continue;
      const k = (k0 + k1) / 2;
      ctx.drawImage(src, 0, v0 * sh, sw, Math.max(1, (v1 - v0) * sh), cx - (w * k) / 2, y0, w * k, Math.max(0.5, y1 - y0) + 0.6);
    }
    ctx.restore();
  }
  return map;
}

// 世界点投影到屏幕（与 drawPersp 同一套参数）。返回 [x, y, 缩放]
export function project(X, Y, Z, { f = 900, cx = W / 2, cy = H / 2, fish = 0 } = {}) {
  const [fx, ky] = fishX((X * f) / Z, fish);
  return [cx + fx, cy + ((Y * f) / Z) * ky, (f / Z) * ky];
}
