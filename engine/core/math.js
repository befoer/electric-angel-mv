// 公式层：画 build/formulas.json 里排好的公式，每个字形可单独动画（视觉方案 §4.12）
// 六种动作：板书 write · 代入 slots + fnum · 圈注 marks + box() · 推导 morphFormula · 出图（镜头自己画）· 坍缩 collapse
import { ENV, newCanvas, hiCanvas } from './env.js';
import { clamp, lerp, smooth, easeIn, easeOutBack } from './time.js';
import { font } from './glyphs.js';
import { rrect } from './ui.js';
import { hash } from './rand.js';
import { mix } from './color.js';

let F = null;
const PATHS = [];

export async function loadFormulas() {
  F = await ENV.P.loadJSON('build/formulas.json');
  PATHS.length = 0;
}

const path = i => PATHS[i] || (PATHS[i] = ENV.P.path2d(F.paths[i]));
export function formula(id) {
  const f = F.formulas[id];
  if (!f) throw new Error(`没有这条公式：${id}（data/formulas.json 里加上，再跑 node scripts/build_formulas.mjs）`);
  return f;
}

// 公式外框尺寸（像素）：size = 每 em 的像素
export function formulaSize(id, size = 64) {
  const f = formula(id), s = size / 1000;
  return { w: f.w * s, h: f.h * s, base: f.base * s };
}

const union = (a, b) => (a ? [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])] : b.slice());

// 排版结果：屏幕坐标。box(标签) 是带这个标签的字形的包围盒，slot(槽名) 是槽位
function layout(f, ox, oy, s) {
  const map = b => [ox + b[0] * s, oy + b[1] * s, ox + b[2] * s, oy + b[3] * s];
  return {
    x0: ox, y0: oy, x1: ox + f.w * s, y1: oy + f.h * s, base: oy + f.base * s, s,
    box(tag) {
      let u = null;
      for (const it of f.items) if (it.tags?.includes(tag)) u = union(u, it.b || it.r);
      return u && map(u);
    },
    slot: name => (f.slots[name] ? map(f.slots[name]) : null),
  };
}

function originOf(f, x, y, s, align = 'l', valign = 'top') {
  const w = f.w * s, h = f.h * s;
  const ox = align === 'c' ? x - w / 2 : align === 'r' ? x - w : x;
  const oy = valign === 'base' ? y - f.base * s : valign === 'mid' ? y - h / 2 : valign === 'bottom' ? y - h : y;
  return [ox, oy];
}

const itemBox = it => it.b || it.r;
const colorOf = (it, o) => {
  if (o.colors && it.tags) for (const t of it.tags) if (o.colors[t]) return o.colors[t];
  return o.color;
};

// 画一个字形或横线：以字形中心为原点缩放 sc，再平移 (dx, dy)
function drawItem(ctx, it, ox, oy, s, sc, dx, dy, color, alpha) {
  if (alpha <= 0.003 || sc <= 0.003) return;
  const b = itemBox(it), cx = ox + ((b[0] + b[2]) / 2) * s, cy = oy + ((b[1] + b[3]) / 2) * s;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = color;
  ctx.translate(cx + dx, cy + dy);
  if (sc !== 1) ctx.scale(sc, sc);
  ctx.translate(-cx, -cy);
  ctx.translate(ox, oy);
  ctx.scale(s, s);
  if (it.r) ctx.fillRect(it.r[0], it.r[1], it.r[2] - it.r[0], it.r[3] - it.r[1]);
  else { ctx.transform(...it.m); ctx.fill(path(it.p)); }
  ctx.restore();
}

// 画公式。返回排版结果（屏幕坐标），给引线、槽位、出图用
// o.size 每 em 像素（默认 64）· o.color · o.colors {标签: 颜色} · o.align 'l'|'c'|'r' · o.valign 'top'|'mid'|'base'|'bottom'
// o.write 板书：从开始写起的秒数（不给 = 已写完）· o.dur 写完整条用的秒数（默认 0.5）
// o.marks {标签: 底色} 圈注胶囊 · o.hide [标签] 不画 · o.alpha
// o.collapse { u, x, y } 坍缩：u 0→1 时所有字形飞向 (x, y) 并缩没
// o.slots {槽名: (ctx, box, L) => {}} 在槽位里画数字或中文（box 为屏幕坐标 [x0,y0,x1,y1]，y1 是基线）
// o.sweep { u, color } 扫光（第九轮，用户：公式框都要动起来）：u 从 0 到 1 时一道高亮从左到右扫过字形——颜色偏向 color、轻轻抬起放大
export function drawFormula(ctx, id, x, y, o = {}) {
  const f = formula(id), s = (o.size ?? 64) / 1000;
  const [ox, oy] = originOf(f, x, y, s, o.align, o.valign);
  const L = layout(f, ox, oy, s);
  const n = f.items.length, dur = o.dur ?? 0.5, alpha = o.alpha ?? 1;
  if (alpha <= 0) return L;
  L.written = o.write == null || o.write >= dur + 0.12;

  if (o.marks) {
    for (const [tag, fill] of Object.entries(o.marks)) {
      const b = L.box(tag);
      if (!b) continue;
      const p = 0.12 * (o.size ?? 64);
      ctx.save(); ctx.globalAlpha *= alpha; ctx.fillStyle = fill;
      rrect(ctx, b[0] - p, b[1] - p * 0.6, b[2] - b[0] + 2 * p, b[3] - b[1] + 1.2 * p, (b[3] - b[1]) / 2 + p); ctx.fill();
      ctx.restore();
    }
  }

  const col = o.collapse, ce = col ? easeIn(clamp(col.u)) : 0;
  for (let i = 0; i < n; i++) {
    const it = f.items[i];
    if (o.hide && it.tags?.some(t => o.hide.includes(t))) continue;
    let sc = 1, dx = 0, dy = 0;
    if (o.write != null) {
      const a = o.write - (i / Math.max(1, n - 1)) * dur;
      if (a < 0) continue;
      sc = easeOutBack(clamp(a / 0.12), 2.2);
    }
    if (col) {
      const b = itemBox(it), cx = ox + ((b[0] + b[2]) / 2) * s, cy = oy + ((b[1] + b[3]) / 2) * s;
      const k = clamp(ce * 1.15 - (hash(i, 7) % 100) / 100 * 0.15);
      dx = (col.x - cx) * k; dy = (col.y - cy) * k; sc *= 1 - k;
    }
    let c = colorOf(it, o);
    if (o.sweep) {
      const bump = Math.max(0, 1 - Math.abs(i / Math.max(1, n - 1) - o.sweep.u) / 0.14);
      if (bump > 0) { sc *= 1 + 0.1 * bump; dy -= 0.08 * (o.size ?? 64) * bump; c = typeof c === 'string' && c[0] === '#' ? mix(c, o.sweep.color, bump) : bump > 0.5 ? o.sweep.color : c; }
    }
    drawItem(ctx, it, ox, oy, s, sc, dx, dy, c, alpha);
  }
  if (o.slots && !col) {
    for (const [name, fn] of Object.entries(o.slots)) {
      const b = L.slot(name);
      if (b) { ctx.save(); ctx.globalAlpha *= alpha; fn(ctx, b, L); ctx.restore(); }
    }
  }
  return L;
}

// ---------------------------------------------------------------- 推导：A → B

// 两条公式里相同的字形按顺序配对（最长公共子序列）
const MATCH = new Map();
function matchOf(idA, idB) {
  const k = `${idA}>${idB}`;
  let m = MATCH.get(k);
  if (m) return m;
  const A = formula(idA).items, B = formula(idB).items;
  const a = A.map((it, i) => [it.c, i]).filter(x => x[0]), b = B.map((it, i) => [it.c, i]).filter(x => x[0]);
  const T = Array.from({ length: a.length + 1 }, () => new Int16Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) {
    T[i][j] = a[i][0] === b[j][0] ? T[i + 1][j + 1] + 1 : Math.max(T[i + 1][j], T[i][j + 1]);
  }
  m = { ab: new Map(), ba: new Map() };
  for (let i = 0, j = 0; i < a.length && j < b.length;) {
    if (a[i][0] === b[j][0]) { m.ab.set(a[i][1], b[j][1]); m.ba.set(b[j][1], a[i][1]); i++; j++; }
    else if (T[i + 1][j] >= T[i][j + 1]) i++;
    else j++;
  }
  MATCH.set(k, m);
  return m;
}

const scaleOf = m => Math.hypot(m[0], m[1]);

// u 0→1：配对的字形从 A 的位置飞到 B 的位置，A 独有的淡出，B 独有的弹出。两条公式按同一个锚点对齐
// o 同 drawFormula（size color colors align valign alpha）；o.slots 在 u ≥ 0.7 后画 B 的槽位。返回 B 的排版结果
export function morphFormula(ctx, idA, idB, u, x, y, o = {}) {
  if (u <= 0) return drawFormula(ctx, idA, x, y, { ...o, slots: o.slotsA });
  if (u >= 1) return drawFormula(ctx, idB, x, y, o);
  const A = formula(idA), B = formula(idB), s = (o.size ?? 64) / 1000;
  const [ax, ay] = originOf(A, x, y, s, o.align, o.valign), [bx, by] = originOf(B, x, y, s, o.align, o.valign);
  const m = matchOf(idA, idB), e = smooth(u), alpha = o.alpha ?? 1;
  A.items.forEach((it, i) => {
    const j = m.ab.get(i);
    if (j === undefined) { drawItem(ctx, it, ax, ay, s, 1 - 0.4 * e, 0, 0, colorOf(it, o), alpha * (1 - clamp(e * 2))); return; }
    const jt = B.items[j], ba = itemBox(it), bb = itemBox(jt);
    const dx = (bx + ((bb[0] + bb[2]) / 2) * s - (ax + ((ba[0] + ba[2]) / 2) * s)) * e;
    const dy = (by + ((bb[1] + bb[3]) / 2) * s - (ay + ((ba[1] + ba[3]) / 2) * s)) * e;
    drawItem(ctx, it, ax, ay, s, lerp(1, scaleOf(jt.m) / scaleOf(it.m), e), dx, dy, colorOf(e < 0.5 ? it : jt, o), alpha);
  });
  B.items.forEach((it, j) => {
    if (m.ba.has(j)) return;
    const a = clamp(e * 2 - 1);
    drawItem(ctx, it, bx, by, s, easeOutBack(a, 2), 0, 0, colorOf(it, o), alpha * a);
  });
  const L = layout(B, bx, by, s);
  if (o.slots && u >= 0.7) for (const [name, fn] of Object.entries(o.slots)) { const b = L.slot(name); if (b) fn(ctx, b, L); }
  return L;
}

// ---------------------------------------------------------------- 代入：数字与中文

// 用公式字体画数字串，基线在 y。返回宽度（像素）。支持 0-9 . , + − × % 和空格；'-' 当作 '−'
export function fnum(ctx, str, x, y, size, { color = '#1D2541', align = 'l', alpha = 1 } = {}) {
  const s = size / 1000, chars = [...String(str)].map(c => (c === '-' ? '−' : c));
  const w = chars.reduce((a, c) => a + (c === ' ' ? 250 : F.digits[c]?.w ?? 500), 0) * s;
  let cx = align === 'c' ? x - w / 2 : align === 'r' ? x - w : x;
  ctx.save();
  ctx.globalAlpha *= alpha; ctx.fillStyle = color;
  for (const c of chars) {
    const d = F.digits[c];
    if (d?.p !== undefined) {
      ctx.save(); ctx.translate(cx, y - d.base * s); ctx.scale(s, s); ctx.transform(...d.m); ctx.fill(path(d.p)); ctx.restore();
    }
    cx += (c === ' ' ? 250 : d?.w ?? 500) * s;
  }
  ctx.restore();
  return w;
}

// 槽位里居中画数字：字号按槽高推算（槽高 0.72 em）
export function slotNum(ctx, box, str, { color = '#1D2541', em = 0.72, align = 'c' } = {}) {
  const size = (box[3] - box[1]) / em;
  const x = align === 'c' ? (box[0] + box[2]) / 2 : align === 'r' ? box[2] : box[0];
  return fnum(ctx, str, x, box[3], size, { color, align });
}

// 槽位里居中画中文（MathJax 没有中文字形）：字号按槽高推算（槽高 0.8 em）
export function slotText(ctx, box, str, { fontKey = 'SC', color = '#1D2541', em = 0.8, scale = 0.94 } = {}) {
  const size = ((box[3] - box[1]) / em) * scale;
  ctx.save();
  ctx.font = font(fontKey, Math.round(size)); ctx.fillStyle = color;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(str, (box[0] + box[2]) / 2, box[3] - size * 0.02);
  ctx.restore();
}

// ---------------------------------------------------------------- 公式墙纸

// 公式片段平铺在 w×h 的透明画布上（缓存），当背景纹理或剪影内部的水印用
const WALL = new Map();
export function formulaWall(w, h, color, { ids = null, size = 26, seed = 0, gapX = 1.2, gapY = 0.9 } = {}) {
  const key = `${w}|${h}|${color}|${size}|${seed}|${ids}`;
  let cv = WALL.get(key);
  if (cv) return cv;
  cv = hiCanvas(w, h);
  const c = cv.getContext('2d'), list = ids || Object.keys(F.formulas).filter(k => !k.startsWith('bpm') && k !== 'nan');
  let y = -size * 0.5, row = 0;
  while (y < h) {
    let x = -((hash(row, seed, 1) % 1000) / 1000) * size * 8, k = hash(row, seed, 2), tallest = 0;
    while (x < w) {
      const id = list[k++ % list.length], sz = formulaSize(id, size);
      drawFormula(c, id, x, y, { size, color });
      x += sz.w + gapX * size;
      tallest = Math.max(tallest, sz.h);
    }
    y += Math.max(tallest, size * 1.4) + gapY * size;
    row++;
  }
  WALL.set(key, cv);
  return cv;
}
