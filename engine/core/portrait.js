// 立绘：素材登记与占位、抠白底、字符画、半块像素头像（视觉方案 §4.3、§4.4）
import { ENV, newCanvas } from './env.js';
import { CW, CH, COLS } from './const.js';
import { glyphs } from './glyphs.js';
import { mix } from './color.js';
import { hash, rnd } from './rand.js';
import { SCR_N } from './text.js';

// 素材到位前，各编号先用人设图的对应部位占位。素材到位后在 assets/illust/manifest.json 登记：{ "I01": "I01_全身.png" }
const PLACEHOLDER = '资料/鲸鱼娘人设图.png'; // 3072×5120，全身正面，白底
const CROPS = {
  full: [0, 0, 3072, 5120], bust: [700, 560, 1760, 2400], face: [1050, 900, 1100, 900],
  eyes: [1150, 1220, 900, 260], mouth: [1350, 1420, 400, 220], hands: [700, 2700, 1700, 900],
};
const PH = {
  I01: 'full', I02: 'bust', I03: 'bust', I04a: 'eyes', I04b: 'eyes', I04c: 'eyes', I05: 'full',
  I06: 'full', I07: 'full', I08: 'full', I09: 'face', I10: 'full', I11: 'hands',
  // B01–B16（ComfyUI 批量图）、S00–S10（表情包）没登记时，镜头里各自用 I 系列拼后备，不走这里
};

let manifest = {};
// 登记的文件名相对 assets/illust/；第二十三轮起也可以是 build/ 开头的生成文件（Q01… 是 scripts/qn_resize.mjs 缩小过的副本）
const pathOf = f => (f.startsWith('build/') ? f : 'assets/illust/' + f);
const IMG = new Map();

// 第二十八轮：人设图不是本项目画的，公开仓库里不带。没有它时现场画一张 1/4 大小的灰色人形占位（裁切框跟着缩），只有没登记的编号才用得到
let PH_SCALE = 1;
function drawPlaceholder() {
  const cv = newCanvas(768, 1280), c = cv.getContext('2d');
  c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, 768, 1280);
  c.fillStyle = '#C9D2EA'; c.beginPath(); c.ellipse(384, 330, 150, 170, 0, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.moveTo(250, 520); c.lineTo(518, 520); c.lineTo(600, 1000); c.lineTo(168, 1000); c.closePath(); c.fill();
  c.fillRect(280, 1000, 70, 260); c.fillRect(418, 1000, 70, 260);
  return cv;
}
export async function loadIllust() {
  const P = ENV.P;
  if (await P.exists('assets/illust/manifest.json')) manifest = await P.loadJSON('assets/illust/manifest.json');
  const files = Object.entries(manifest).filter(([k]) => !k.startsWith('_')).map(([, f]) => pathOf(f));
  if (await P.exists(PLACEHOLDER)) files.push(PLACEHOLDER); else { IMG.set(PLACEHOLDER, drawPlaceholder()); PH_SCALE = 0.25; }
  await Promise.all(files.map(async f => IMG.set(f, await P.loadImage(f))));
}

// 这个编号有没有登记真图（没有时镜头可以自己选后备画法）
export const hasIllust = id => !!manifest[id];

// 第十八轮（用户：I05、I08 升级到最终精度，加大了尺寸、补了边上缺的头发和尾巴，注意调整视频中图片的位置和比例）：
// 新图贴着人物裁（头发、手、尾巴、脚都碰到图边），宽高比也变了（I05 1080×1920 → 2254×3780，I08 1344×1664 → 3111×3891）。
// 镜头里不再写死旧图的宽高比，用 aspectOf 取真图的；要对准某个部位（手、背、头）的用 ANCHOR（归一化到整张图，在新图上量的）
export const aspectOf = id => { const s = illust(id); return s.sw / s.sh; };
export const sizeOf = id => { const s = illust(id); return [s.sw, s.sh]; };
export const ANCHOR = {
  I05: { palm: [0.235, 0.43], tip: [0.085, 0.46], head: [0.46, 0.1] }, // 伸出来的手：掌心、食指指尖；头顶
  I08: { back: [0.34, 0.28], head: [0.33, 0.14] },                       // 两肩中间（翅膀长出来的地方）；脸的中心
};

// 取素材区域。sub：在该区域内再裁一块，归一化 [x, y, w, h]
export function illust(id, sub = null) {
  let img, r;
  const f = manifest[id];
  if (f) { img = IMG.get(pathOf(f)); r = [0, 0, img.width, img.height]; }
  else { img = IMG.get(PLACEHOLDER); r = CROPS[PH[id] || (id.startsWith('S') ? 'face' : 'full')].map(v => v * PH_SCALE); }
  if (sub) r = [r[0] + sub[0] * r[2], r[1] + sub[1] * r[3], sub[2] * r[2], sub[3] * r[3]];
  return { img, sx: r[0], sy: r[1], sw: r[2], sh: r[3], placeholder: !f };
}

// 抠掉与边缘连通的白底（洪水填充），返回带透明通道的画布，最长边缩到 maxDim。已带透明通道的图原样返回
const KEYED = new Map();
export function keyed(id, sub = null, maxDim = 1024) {
  const k = `${id}|${sub}|${maxDim}`;
  let cv = KEYED.get(k);
  if (cv) return cv;
  const s = illust(id, sub), sc = Math.min(1, maxDim / Math.max(s.sw, s.sh));
  const w = Math.max(1, Math.round(s.sw * sc)), h = Math.max(1, Math.round(s.sh * sc));
  cv = newCanvas(w, h);
  const c = cv.getContext('2d');
  c.drawImage(s.img, s.sx, s.sy, s.sw, s.sh, 0, 0, w, h);
  const im = c.getImageData(0, 0, w, h), d = im.data;
  const hasAlpha = d[3] < 250 || d[(w - 1) * 4 + 3] < 250 || d[(h - 1) * w * 4 + 3] < 250;
  if (!hasAlpha) {
    const bg = new Uint8Array(w * h), q = new Int32Array(w * h);
    let qh = 0, qt = 0;
    const white = i => d[i * 4] > 236 && d[i * 4 + 1] > 236 && d[i * 4 + 2] > 236;
    const push = i => { if (!bg[i] && white(i)) { bg[i] = 1; q[qt++] = i; } };
    for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
    for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
    while (qh < qt) {
      const i = q[qh++], x = i % w;
      if (x > 0) push(i - 1);
      if (x < w - 1) push(i + 1);
      if (i >= w) push(i - w);
      if (i < (h - 1) * w) push(i + w);
    }
    for (let i = 0; i < w * h; i++) if (bg[i]) d[i * 4 + 3] = 0;
    c.putImageData(im, 0, 0);
  }
  KEYED.set(k, cv);
  return cv;
}

// 按目标尺寸缓存的裁切图（cover 方式填满 w×h）。素材原图很大（I01 3577×7424），镜头里一律用它或 keyed()，
// 不要每帧从原图缩放。o.keyed：先抠白底 / 用透明通道（全身、半身立绘用），否则保留原底色（特写、拼贴用）
const PHOTO = new Map();
export function photo(id, sub, w, h, { keyed: useKey = false } = {}) {
  const k = `${id}|${sub}|${w}|${h}|${useKey}`;
  let cv = PHOTO.get(k);
  if (cv) return cv;
  w = Math.round(w); h = Math.round(h);
  cv = newCanvas(w, h);
  const c = cv.getContext('2d');
  if (useKey) {
    const src = keyed(id, sub, Math.max(w, h) * 2), sc = Math.min(w / src.width, h / src.height);
    c.drawImage(src, (w - src.width * sc) / 2, (h - src.height * sc) / 2, src.width * sc, src.height * sc);
  } else {
    const s = illust(id, sub), ta = w / h, sa = s.sw / s.sh;
    let sx = s.sx, sy = s.sy, sw = s.sw, sh = s.sh;
    if (sa > ta) { sw = sh * ta; sx += (s.sw - sw) / 2; } else { sh = sw / ta; sy += (s.sh - sh) / 2; }
    c.drawImage(s.img, sx, sy, sw, sh, 0, 0, w, h);
  }
  PHOTO.set(k, cv);
  return cv;
}

// 区域按格子比例（12×20）换算：给定列数，返回行数
export function artRows(id, sub, cols) {
  const s = illust(id, sub);
  return Math.max(1, Math.round((cols * CW * s.sh) / s.sw / CH));
}

// ---------------------------------------------------------------- 字符画

const RAMP = '.:-=+*#%@'; // 浅 → 深：明亮底色上，越暗的地方字越密
const ART = new Map();
// 边缘格用方向笔画，内部格用密度字符。返回 { cols, rows, ch[], lv[] }（lv = 墨色级 1..4）
export function glyphArt(id, sub, cols, rows = artRows(id, sub, cols)) {
  const k = `${id}|${sub}|${cols}|${rows}`;
  let a = ART.get(k);
  if (a) return a;
  const cv = newCanvas(cols, rows), c = cv.getContext('2d');
  c.drawImage(keyed(id, sub, 1024), 0, 0, cols, rows);
  const d = c.getImageData(0, 0, cols, rows).data, n = cols * rows;
  const lum = new Float32Array(n), al = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    al[i] = d[i * 4 + 3] / 255;
    lum[i] = al[i] < 0.1 ? 1 : (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) / 255;
  }
  const L = (x, y) => lum[Math.min(rows - 1, Math.max(0, y)) * cols + Math.min(cols - 1, Math.max(0, x))];
  const ch = new Array(n), lv = new Uint8Array(n);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      if (al[i] < 0.45) { ch[i] = ' '; continue; }
      const gx = L(x + 1, y - 1) + 2 * L(x + 1, y) + L(x + 1, y + 1) - L(x - 1, y - 1) - 2 * L(x - 1, y) - L(x - 1, y + 1);
      const gy = L(x - 1, y + 1) + 2 * L(x, y + 1) + L(x + 1, y + 1) - L(x - 1, y - 1) - 2 * L(x, y - 1) - L(x + 1, y - 1);
      const dark = 1 - lum[i];
      if (Math.hypot(gx, gy) > 1.1) {
        const ang = ((Math.atan2(gy, gx) * 180) / Math.PI + 180) % 180;
        ch[i] = ang < 22.5 || ang >= 157.5 ? '|' : ang < 67.5 ? '/' : ang < 112.5 ? '-' : '\\';
        lv[i] = 4;
      } else {
        ch[i] = RAMP[Math.min(RAMP.length - 1, Math.floor(dark * RAMP.length))];
        lv[i] = 1 + Math.min(3, Math.floor(dark * 4));
      }
    }
  }
  a = { cols, rows, ch, lv };
  ART.set(k, a);
  return a;
}

// reveal < 1：随机隐藏一部分格子（成形、碎散）；scramble：这一比例的字换成乱码；k：乱码的变化序号
export function drawGlyphArt(ctx, art, col0, row0, pal, { reveal = 1, scramble = 0, seed = 0, k = 0, inkShift = 0, occ = null } = {}) {
  const sets = pal.ink.map(c => glyphs('SC', c));
  for (let y = 0; y < art.rows; y++) {
    for (let x = 0; x < art.cols; x++) {
      const i = y * art.cols + x;
      let g = art.ch[i];
      if (g === ' ') continue;
      if (reveal < 1 && rnd(x, y, seed) > reveal) continue;
      if (scramble > 0 && rnd(x, y, seed, k) < scramble) g = SCR_N[hash(x, y, k) % SCR_N.length];
      const lv = Math.max(0, Math.min(4, art.lv[i] + inkShift));
      sets[lv].draw(ctx, g, (col0 + x) * CW, (row0 + y) * CH);
      if (occ) occ.a[col0 + x + (row0 + y) * COLS] = 1;
    }
  }
}

// ---------------------------------------------------------------- 半色调网点

// 按亮度画网点（越暗点越大），透明底，叠在立绘上用。cell：网点间距 px
const HT = new Map();
export function halftone(id, sub, w, h, color, { cell = 10 } = {}) {
  const k = `${id}|${sub}|${w}|${h}|${color}|${cell}`;
  let out = HT.get(k);
  if (out) return out;
  const cols = Math.ceil(w / cell), rows = Math.ceil(h / cell);
  const cv = newCanvas(cols, rows), c = cv.getContext('2d');
  c.drawImage(keyed(id, sub, 1024), 0, 0, cols, rows);
  const d = c.getImageData(0, 0, cols, rows).data;
  out = newCanvas(w, h);
  const o = out.getContext('2d');
  o.fillStyle = color;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 4;
      if (d[i + 3] < 100) continue;
      const dark = 1 - (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
      const r = (cell / 2) * Math.sqrt(dark) * 0.95;
      if (r < 0.6) continue;
      o.beginPath(); o.arc(x * cell + cell / 2, y * cell + cell / 2, r, 0, Math.PI * 2); o.fill();
    }
  }
  HT.set(k, out);
  return out;
}

// ---------------------------------------------------------------- 半块像素头像

const HB = new Map();
// px 一格，亮度量化 levels 级，按调色板上色，每格留 1 px 缝（网格线遮罩）
export function halfBlock(id, sub, widthPx, pal, { px = 4, levels = 8 } = {}) {
  const k = `${id}|${sub}|${widthPx}|${pal.key}|${px}`;
  let out = HB.get(k);
  if (out) return out;
  const src = keyed(id, sub, 1024);
  const cols = Math.round(widthPx / px), rows = Math.round((cols * src.height) / src.width);
  const cv = newCanvas(cols, rows), c = cv.getContext('2d');
  c.drawImage(src, 0, 0, cols, rows);
  const d = c.getImageData(0, 0, cols, rows).data;
  const ramp = [pal.ink[4], pal.ink[3], pal.ink[2], pal.ink[1], pal.ink[0], mix(pal.ink[0], pal.win, 0.5), pal.win, pal.win];
  out = newCanvas(cols * px, rows * px);
  const o = out.getContext('2d');
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 4;
      if (d[i + 3] < 100) continue;
      const lum = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
      o.fillStyle = ramp[Math.min(levels - 1, Math.floor((0.16 + 0.84 * lum) * levels))];
      o.fillRect(x * px, y * px, px - 1, px - 1);
    }
  }
  HB.set(k, out);
  return out;
}
