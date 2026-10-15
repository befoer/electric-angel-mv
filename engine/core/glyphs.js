// 字形缓存：每种（字体, 颜色, 字号）一套，按需把字画进图集页，之后每帧只做 drawImage（视觉方案 §八）
import { CW, CH } from './const.js';
import { ENV, newCanvas } from './env.js';

export const FONTS = {
  SC: ['SarasaSC', 'assets/fonts/SarasaMonoSC-Regular.ttf'],
  SCB: ['SarasaSC-B', 'assets/fonts/SarasaMonoSC-Bold.ttf'],
  J: ['SarasaJ', 'assets/fonts/SarasaMonoJ-Regular.ttf'],
  JB: ['SarasaJ-B', 'assets/fonts/SarasaMonoJ-Bold.ttf'],
  DELA: ['Dela', 'assets/fonts/DelaGothicOne-Regular.ttf'],
  ZEN: ['ZenMaru', 'assets/fonts/ZenMaruGothic-Medium.ttf'],
  ZENB: ['ZenMaru-Black', 'assets/fonts/ZenMaruGothic-Black.ttf'],
  MIN: ['Shippori', 'assets/fonts/ShipporiMinchoB1-ExtraBold.ttf'],
  DOT: ['DotGothic', 'assets/fonts/DotGothic16-Regular.ttf'],
  SMILEY: ['Smiley', 'assets/fonts/SmileySans-Oblique.ttf'],
  KAI: ['WenKai', 'assets/fonts/LXGWWenKai-Regular.ttf'],
  // 第十三轮（用户：1:45 中间的大歌词还是原来的明朝体好）：MIN0 = 不被 pixfont 换掉的明朝体（同一个字体文件，注册时去重）
  MIN0: ['Shippori', 'assets/fonts/ShipporiMinchoB1-ExtraBold.ttf'],
  // 第十四轮（用户：圆体很多字不支持、退回成黑体，换成资源圆体）：ZEN / ZENB 的位置换成资源圆体 Medium / Heavy
  RES: ['ResourceRounded', 'assets/fonts/资源圆体 Medium.ttf'],
  RESB: ['ResourceRounded-H', 'assets/fonts/资源圆体 Heavy.ttf'],
};
// 第十二轮（用户：所有宋体 / 衬线字换成像素字体）：明朝体 MIN 一律换成 DotGothic16（缺的简体字由后备字体补）
// 第十四轮：圆体 Zen Maru（日文字体，没有大部分简体字）换成资源圆体（简繁日都有）
const RES_OF = { ZEN: 'RES', ZENB: 'RESB' };
const sub = k => (k === 'MIN' ? 'DOT' : RES_OF[k] ?? k);
// 第十二轮（用户：37 秒 KV 压缩窗口里「是装 了」是什么，bug 吗）：是 bug——Zen Maru / Dela / DotGothic 是日文字体，没有简体字
// （压、缩、还、满、缓……），以前单独用 font('ZENB', …) 写中文时缺的字被系统随便换成别的字形。现在每个字体串最后都垫一个更纱，
// 缺字一律由更纱补（粗体垫粗体）。rev l08
const BOLD = new Set(['ZENB', 'DELA', 'SCB', 'JB']);
const tail = keys => (!keys.some(k => k === 'SC' || k === 'SCB') ? [keys.some(k => BOLD.has(k)) ? 'SCB' : 'SC'] : []);
export const font = (key, px) => `${px}px ${[key, ...tail([key])].map(k => `"${FONTS[sub(k)][0]}"`).join(', ')}`;
// 带后备字体的字体串：前一个字体缺字时用后一个（如 Zen Maru 没有简体中文 → 更纱粗体）
export const fonts = (px, ...keys) => `${px}px ${[...keys, ...tail(keys)].map(k => `"${FONTS[sub(k)][0]}"`).join(', ')}`;

// 第十二轮（用户：几乎所有窗口左上角胶囊里的字都偏下）：textBaseline 'middle' 是按字体的 em 框居中的，
// Zen Maru / 更纱的字母和数字因此看起来偏下 2–4 px。改成按大写字母高度居中：基线 = 中心 + 大写高 / 2（中文字的视觉中心也正好落在这里）。
// capMid(ctx) 返回当前字体下这段偏移；midText 用 alphabetic 基线把 s 画在竖直中心 cy 上。rev capfix
const CAP = new Map();
export function capMid(ctx) {
  const f = ctx.font;
  let v = CAP.get(f);
  if (v == null) {
    const b = ctx.textBaseline; ctx.textBaseline = 'alphabetic';
    const m = ctx.measureText('H'), z = ctx.measureText('中');
    v = (m.actualBoundingBoxAscent + (z.actualBoundingBoxAscent - z.actualBoundingBoxDescent)) / 4;
    ctx.textBaseline = b; CAP.set(f, v);
  }
  return v;
}
export function midText(ctx, s, x, cy) {
  const b = ctx.textBaseline;
  ctx.textBaseline = 'alphabetic'; ctx.fillText(s, x, cy + capMid(ctx)); ctx.textBaseline = b;
}

export async function registerFonts() {
  const seen = new Map(Object.values(FONTS).map(([alias, path]) => [alias, path]));
  // 第二十八轮：公开仓库里不带字体（太大，用户定的）。缺的字体跳过、由系统字体顶替（字宽会变），提示一次去哪下载
  const missing = [];
  await Promise.all([...seen].map(async ([alias, path]) => ((await ENV.P.exists(path)) ? ENV.P.registerFont(alias, path) : missing.push(path))));
  if (missing.length) console.warn(`缺 ${missing.length} 个字体，用系统字体顶替（下载和放法见 docs/FONTS.md）：\n  ${missing.join('\n  ')}`);
}

// ---------------------------------------------------------------- 程序绘制的字形
// 制表符和方块字符必须严丝合缝地接上相邻格子，所以不用字体里的字形，按 12×20 的格子直接画

const T = 2; // 线宽
function arms(c, x, y, L, R, U, D) {
  const cx = x + CW / 2 - 1, cy = y + CH / 2 - 1;
  if (L) c.fillRect(x, cy, cx - x + T, T);
  if (R) c.fillRect(cx, cy, x + CW - cx, T);
  if (U) c.fillRect(cx, y, T, cy - y + T);
  if (D) c.fillRect(cx, cy, T, y + CH - cy);
}
function corner(c, x, y, right, down) {
  const cx = x + CW / 2, cy = y + CH / 2, ex = right ? x + CW : x, ey = down ? y + CH : y;
  c.lineWidth = T; c.beginPath(); c.moveTo(ex, cy); c.arcTo(cx, cy, cx, ey, 5); c.lineTo(cx, ey); c.stroke();
}
const block = (fx, fy, fw, fh) => (c, x, y) => c.fillRect(x + fx * CW, y + fy * CH, fw * CW, fh * CH);
const shade = a => (c, x, y) => { c.globalAlpha = a; c.fillRect(x, y, CW, CH); c.globalAlpha = 1; };
const PROC = {
  '─': (c, x, y) => arms(c, x, y, 1, 1, 0, 0), '│': (c, x, y) => arms(c, x, y, 0, 0, 1, 1),
  '┌': (c, x, y) => arms(c, x, y, 0, 1, 0, 1), '┐': (c, x, y) => arms(c, x, y, 1, 0, 0, 1),
  '└': (c, x, y) => arms(c, x, y, 0, 1, 1, 0), '┘': (c, x, y) => arms(c, x, y, 1, 0, 1, 0),
  '├': (c, x, y) => arms(c, x, y, 0, 1, 1, 1), '┤': (c, x, y) => arms(c, x, y, 1, 0, 1, 1),
  '┬': (c, x, y) => arms(c, x, y, 1, 1, 0, 1), '┴': (c, x, y) => arms(c, x, y, 1, 1, 1, 0),
  '┼': (c, x, y) => arms(c, x, y, 1, 1, 1, 1),
  '╭': (c, x, y) => corner(c, x, y, 1, 1), '╮': (c, x, y) => corner(c, x, y, 0, 1),
  '╰': (c, x, y) => corner(c, x, y, 1, 0), '╯': (c, x, y) => corner(c, x, y, 0, 0),
  '┊': (c, x, y) => { for (let k = 0; k < 4; k++) c.fillRect(x + CW / 2 - 1, y + 1 + k * 5, T, 3); },
  '┄': (c, x, y) => { for (let k = 0; k < 3; k++) c.fillRect(x + k * 4 + 1, y + CH / 2 - 1, 2, T); },
  '█': block(0, 0, 1, 1), '▀': block(0, 0, 1, 0.5), '▄': block(0, 0.5, 1, 0.5),
  '▌': block(0, 0, 0.5, 1), '▐': block(0.5, 0, 0.5, 1),
  '░': shade(0.25), '▒': shade(0.5), '▓': shade(0.75),
  '▍': (c, x, y) => c.fillRect(x + 1, y + 2, 4, CH - 4), // 光标
};
for (let k = 1; k <= 7; k++) PROC['▁▂▃▄▅▆▇'[k - 1]] = block(0, 1 - k / 8, 1, k / 8);
export const isProc = ch => ch in PROC;

// ---------------------------------------------------------------- 字形集

// 图集页不宜大：Skia 在源画布改动后的下一次 drawImage 会整页复制一次（2040² 约 8 ms，480² 约 0.4 ms）
const SLOT_W = 24, SLOT_H = 20, PAGE = 480;
const PER_ROW = Math.floor(PAGE / SLOT_W), PER_PAGE = PER_ROW * Math.floor(PAGE / SLOT_H);

export class GlyphSet {
  constructor(fontKey, color, size) {
    this.font = font(fontKey, size); this.color = color;
    this.pages = []; this.map = new Map(); this.n = 0;
    const m = newCanvas(8, 8).getContext('2d');
    m.font = this.font;
    const mt = m.measureText('中');
    const asc = mt.actualBoundingBoxAscent, desc = mt.actualBoundingBoxDescent;
    this.baseY = Math.round((CH - (asc + desc)) / 2 + asc);
  }
  get(ch) {
    let g = this.map.get(ch);
    if (g) return g;
    const pi = Math.floor(this.n / PER_PAGE), si = this.n % PER_PAGE;
    this.n++;
    if (!this.pages[pi]) this.pages[pi] = newCanvas(PAGE, PAGE);
    const cv = this.pages[pi], c = cv.getContext('2d');
    const sx = (si % PER_ROW) * SLOT_W, sy = Math.floor(si / PER_ROW) * SLOT_H;
    c.fillStyle = this.color; c.strokeStyle = this.color;
    let w = 1;
    if (PROC[ch]) PROC[ch](c, sx, sy);
    else {
      c.font = this.font;
      const adv = c.measureText(ch).width;
      w = adv > CW * 1.25 ? 2 : 1; // 按实际字宽判断占 1 格还是 2 格
      c.save(); c.beginPath(); c.rect(sx, sy, w * CW, CH); c.clip();
      c.textBaseline = 'alphabetic';
      c.fillText(ch, sx + (w * CW - adv) / 2, sy + this.baseY);
      c.restore();
    }
    g = { cv, sx, sy, w };
    this.map.set(ch, g);
    return g;
  }
  // 一次把一批字画进图集，之后整页只复制一次
  warm(str) {
    if (this.warmed?.has(str)) return this;
    for (const ch of str) if (ch !== ' ') this.get(ch);
    (this.warmed ||= new Set()).add(str);
    return this;
  }
  cells(ch) { return ch === ' ' ? 1 : this.get(ch).w; }
  draw(ctx, ch, x, y) {
    const g = this.get(ch);
    ctx.drawImage(g.cv, g.sx, g.sy, g.w * CW, CH, x, y, g.w * CW, CH);
    return g.w;
  }
}

const SETS = new Map();
export function glyphs(fontKey, color, size = 20) {
  const k = `${fontKey}|${color}|${size}`;
  let s = SETS.get(k);
  if (!s) { s = new GlyphSet(fontKey, color, size); SETS.set(k, s); }
  return s;
}
