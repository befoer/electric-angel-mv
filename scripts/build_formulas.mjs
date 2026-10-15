// 公式构建：data/formulas.json（TeX）→ MathJax 排版 → build/formulas.json（每个字形的矢量路径、位置、标签、槽位）
// 只在构建时用 MathJax；引擎运行时只读 build/formulas.json（视觉方案 §4.12）
// 用法：node scripts/build_formulas.mjs
// 坐标：1 em = 1000 单位，原点在公式左上角，y 向下；base 是基线到顶的距离
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mathjax } from 'mathjax-full/js/mathjax.js';
import { TeX } from 'mathjax-full/js/input/tex.js';
import { SVG } from 'mathjax-full/js/output/svg.js';
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor.js';
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js';
import { AllPackages } from 'mathjax-full/js/input/tex/AllPackages.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
const doc = mathjax.document('', { InputJax: new TeX({ packages: AllPackages }), OutputJax: new SVG({ fontCache: 'none' }) });

// ---------------------------------------------------------------- 仿射矩阵 [a b c d e f]

const I = [1, 0, 0, 1, 0, 0];
const mul = (A, B) => [
  A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1],
  A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3],
  A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5],
];
const apply = (M, x, y) => [M[0] * x + M[2] * y + M[4], M[1] * x + M[3] * y + M[5]];
function parseTransform(s) {
  let M = I;
  if (!s) return M;
  for (const m of s.matchAll(/(translate|scale|matrix)\(([^)]*)\)/g)) {
    const v = m[2].split(/[\s,]+/).filter(Boolean).map(Number);
    if (m[1] === 'translate') M = mul(M, [1, 0, 0, 1, v[0] || 0, v[1] || 0]);
    else if (m[1] === 'scale') M = mul(M, [v[0], 0, 0, v[1] ?? v[0], 0, 0]);
    else M = mul(M, v);
  }
  return M;
}

// 路径的包围盒（含控制点，略大于实际，够用）
function pathBox(d) {
  let x = 0, y = 0, x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (px, py) => { x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py); };
  for (const m of d.matchAll(/([MLHVCSQTAZmlhvcsqtaz])([^MLHVCSQTAZmlhvcsqtaz]*)/g)) {
    const cmd = m[1], v = (m[2].match(/-?\d*\.?\d+(?:e-?\d+)?/g) || []).map(Number);
    const rel = cmd === cmd.toLowerCase() && cmd !== 'z';
    const C = cmd.toUpperCase();
    if (C === 'H') for (const n of v) { x = rel ? x + n : n; add(x, y); }
    else if (C === 'V') for (const n of v) { y = rel ? y + n : n; add(x, y); }
    else if (C !== 'Z') {
      for (let i = 0; i + 1 < v.length; i += 2) {
        const px = rel ? x + v[i] : v[i], py = rel ? y + v[i + 1] : v[i + 1];
        add(px, py);
        const last = C === 'C' ? i % 6 === 4 : C === 'S' || C === 'Q' ? i % 4 === 2 : true;
        if (last) { x = px; y = py; }
      }
    }
  }
  return [x0, y0, x1, y1];
}

const r1 = n => Math.round(n * 10) / 10;
const r4 = n => Math.round(n * 1e4) / 1e4;

// ---------------------------------------------------------------- 排版一条公式

function compile(tex, paths) {
  const node = doc.convert(tex, { display: true });
  const svg = adaptor.firstChild(node);
  const vb = adaptor.getAttribute(svg, 'viewBox').split(/\s+/).map(Number);
  const items = [], slots = {}, warn = [];
  const root = [1, 0, 0, 1, -vb[0], -vb[1]];
  const walk = (n, M, tags) => {
    const kind = adaptor.kind(n);
    if (kind === '#text' || kind === '#comment') return;
    const M2 = mul(M, parseTransform(adaptor.getAttribute(n, 'transform')));
    const id = adaptor.getAttribute(n, 'id'), cls = adaptor.getAttribute(n, 'class');
    const t2 = id || cls ? [...tags, ...(id ? [id] : []), ...(cls ? cls.split(/\s+/) : [])] : tags;
    if (kind === 'path') {
      const d = adaptor.getAttribute(n, 'd');
      if (d) {
        const [a, b, c, e] = pathBox(d), p0 = apply(M2, a, b), p1 = apply(M2, c, e);
        let pi = paths.idx.get(d);
        if (pi === undefined) { pi = paths.list.length; paths.list.push(d); paths.idx.set(d, pi); }
        const it = { p: pi, m: M2.map(r4), b: [Math.min(p0[0], p1[0]), Math.min(p0[1], p1[1]), Math.max(p0[0], p1[0]), Math.max(p0[1], p1[1])].map(r1) };
        const ch = adaptor.getAttribute(n, 'data-c');
        if (ch) it.c = String.fromCodePoint(parseInt(ch, 16));
        if (t2.length) it.tags = t2;
        items.push(it);
      }
    } else if (kind === 'rect') {
      const [x, y, w, h] = ['x', 'y', 'width', 'height'].map(a => +adaptor.getAttribute(n, a) || 0);
      const p0 = apply(M2, x, y), p1 = apply(M2, x + w, y + h);
      const box = [Math.min(p0[0], p1[0]), Math.min(p0[1], p1[1]), Math.max(p0[0], p1[0]), Math.max(p0[1], p1[1])].map(r1);
      const slot = t2.find(s => s.startsWith('s_'));
      if (slot) {
        const o = slots[slot];
        slots[slot] = o ? [Math.min(o[0], box[0]), Math.min(o[1], box[1]), Math.max(o[2], box[2]), Math.max(o[3], box[3])] : box;
      } else {
        const it = { r: box };
        if (t2.length) it.tags = t2;
        items.push(it);
      }
    } else if (kind === 'text') {
      const s = adaptor.textContent(n).trim();
      if (s) warn.push(s);
    }
    for (const ch of adaptor.childNodes(n) || []) walk(ch, M2, t2);
  };
  walk(svg, root, []);
  return { w: r1(vb[2]), h: r1(vb[3]), base: r1(-vb[1]), items, slots, warn };
}

// ---------------------------------------------------------------- 主流程

const src = JSON.parse(await readFile(path.join(ROOT, 'data', 'formulas.json'), 'utf8'));
const paths = { list: [], idx: new Map() };
const out = { _说明: '由 scripts/build_formulas.mjs 从 data/formulas.json 生成，不要手改', paths: paths.list, digits: {}, formulas: {} };

let bad = 0;
for (const [id, f] of Object.entries(src)) {
  if (id.startsWith('_')) continue;
  try {
    const c = compile(f.tex, paths);
    if (c.warn.length) { console.warn(`! ${id}：有 MathJax 画不了的文字 ${JSON.stringify(c.warn)}（中文请用 \\cssId{s_…} 槽位）`); bad++; }
    delete c.warn;
    out.formulas[id] = c;
    console.log(`${id.padEnd(10)} ${String(c.items.length).padStart(3)} 个字形  ${(c.w / 1000).toFixed(2)}×${(c.h / 1000).toFixed(2)} em  槽 ${Object.keys(c.slots).join(' ') || '—'}`);
  } catch (e) {
    console.error(`× ${id}：${e.message}`); bad++;
  }
}

// 代入用的数字字形：每个字单独排版，记下路径与步进宽度
for (const ch of '0123456789.,+−×%') {
  const tex = ch === '%' ? '\\%' : ch === '−' ? '-' : ch === '×' ? '\\times' : ch;
  const c = compile(`\\mathrm{${tex}}`, paths);
  const g = c.items.find(i => i.p !== undefined);
  out.digits[ch] = g ? { p: g.p, m: g.m, w: c.w, base: c.base } : { w: c.w, base: c.base };
}

await writeFile(path.join(ROOT, 'build', 'formulas.json'), JSON.stringify(out));
const kb = Buffer.byteLength(JSON.stringify(out)) / 1024;
console.log(`→ build/formulas.json：${Object.keys(out.formulas).length} 条公式，${paths.list.length} 种字形，${kb.toFixed(0)} KB${bad ? `，${bad} 条有问题` : ''}`);
if (bad) process.exitCode = 1;
