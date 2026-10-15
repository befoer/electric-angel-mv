// 界面元素：窗口底板、面板、胶囊、toast、config diff（视觉方案 §4.5、§4.8）
import { W, H, CW, CH, COLS } from './const.js';
import { glyphs, font, fonts, midText } from './glyphs.js';
import { drawBox, putText, textCells } from './grid.js';
import { css } from './color.js';
import { clamp, easeOutBack, lerp } from './time.js';
import { decode } from './text.js';

export function rrect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// 对话气泡（第二十二轮，用户：气泡的小三角缺少描边；矩形与三角形没有做布尔运算）：圆角矩形和小尾巴是同一条路径，
// 填色、描边都是一个整体（描边会沿着尾巴走，尾巴和矩形之间没有接缝）。尾巴在下边（tipY > y + h）或左边（tipX < x）
// r 不限时取 h / 2（最大圆角，胶囊形）；尾巴根部宽 2 × bw，根部的中心 bx 自动夹在直边上
export function speechBubble(ctx, x, y, w, h, r, tipX, tipY, bw = 13) {
  r = Math.min(r ?? h / 2, w / 2, h / 2);
  ctx.beginPath();
  if (tipX < x) { // 尾巴在左边
    const by = Math.min(Math.max(tipY, y + r + bw), y + h - r - bw);
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
    ctx.lineTo(x, by + bw); ctx.lineTo(tipX, tipY); ctx.lineTo(x, by - bw); ctx.arcTo(x, y, x + w, y, r);
  } else { // 尾巴在下边
    const bx = Math.min(Math.max(tipX, x + r + bw), x + w - r - bw);
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.lineTo(bx + bw, y + h); ctx.lineTo(tipX, tipY); ctx.lineTo(bx - bw, y + h);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  }
  ctx.closePath();
}

// 窗口白底 + 2 px 蓝色投影。底板铺到边框线的中心
export function windowBase(ctx, pal, c0, r0, c1, r1, { alpha = 1 } = {}) {
  const x = c0 * CW + CW / 2, y = r0 * CH + CH / 2, w = (c1 - c0 - 1) * CW, h = (r1 - r0 - 1) * CH;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = css(pal.shadow, pal.shadowA);
  rrect(ctx, x + 2, y + 2, w, h, 6); ctx.fill();
  ctx.fillStyle = pal.win;
  rrect(ctx, x, y, w, h, 6); ctx.fill();
  ctx.globalAlpha = 1;
}

// TUI 面板：底板 + 圆角制表符框 + 压在上边框上的标题
export function panel(ctx, S, c0, r0, c1, r1, { title = '', progress = 1, edge = null, gaps = null, spinner = false } = {}) {
  const pal = S.pal;
  if (progress >= 1) windowBase(ctx, pal, c0, r0, c1, r1);
  drawBox(ctx, glyphs('SC', edge || pal.winEdge), c0, r0, c1, r1, { progress, gaps });
  if (title && progress >= 1) {
    let s = ` ${title} `;
    if (spinner) s = ` ${'|/-\\'[Math.floor(S.t * 8) % 4]}${s}`;
    const gs = glyphs('SC', pal.text);
    const n = textCells(gs, s);
    ctx.fillStyle = pal.win;
    ctx.fillRect((c0 + 2) * CW, r0 * CH, n * CW, CH);
    putText(ctx, gs, c0 + 2, r0, s);
  }
}

// 圆角胶囊（像素坐标）。返回宽度
export function capsule(ctx, x, y, h, text, { fontKey = 'SC', size = 18, fill = '#FFFFFF', stroke = null, color = '#1D2541', padX = 14 } = {}) {
  ctx.font = font(fontKey, size);
  const w = Math.ceil(ctx.measureText(text).width) + padX * 2;
  rrect(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
  ctx.fillStyle = color;
  midText(ctx, text, x + padX, y + h / 2); // 第十二轮：按大写字母高度居中
  ctx.textBaseline = 'alphabetic';
  return w;
}

// toast：弹出一拍内回弹放大，u 为出现后的秒数
export function toast(ctx, S, text, cx, cy, age, { size = 30 } = {}) {
  if (age < 0) return null;
  const sc = easeOutBack(clamp(age / 0.12), 2);
  ctx.save();
  ctx.translate(cx, cy); ctx.scale(sc, sc);
  ctx.font = font('SC', size);
  const w = ctx.measureText(text).width + 64, h = size + 34;
  ctx.fillStyle = css(S.pal.shadow, 0.25); rrect(ctx, -w / 2 + 4, -h / 2 + 5, w, h, 12); ctx.fill();
  ctx.fillStyle = '#FFFFFF'; rrect(ctx, -w / 2, -h / 2, w, h, 12); ctx.fill();
  ctx.strokeStyle = S.pal.winEdge; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = S.pal.text; ctx.textAlign = 'center';
  midText(ctx, text, 0, 0);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.restore();
  return [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2];
}

// 段落切换的 config diff：age 为弹出后的秒数，持续一拍
export function configDiff(ctx, S, from, to, age) {
  return voiceSwitch14(ctx, S, from, to, age);
}

// 第十四轮（用户：萝莉音 → 御姐音的字换成滑动切换，现在变得太快几乎看不出过程）
// 像真的拨动开关：两个词和圆钮固定在同一根"滑条"上一起走，滑轨是窗口（裁切）——圆钮往右走，「萝莉音」被推着从右边滑出去，
// 「御姐音」跟在圆钮后面从左边滑进来；圆钮走过的地方填成夜海蓝，没走到的还是浅粉。滑动放慢到 0.7 s（缓入缓出，到头轻轻冲过一点再回来），
// 字带一点横向拖影；整个面板停留 1.4 s
// 第十七轮（用户：1:05 切换按钮小一点，御姐音的颜色太深）：整个面板缩到 0.7 倍（开关 1000×170 → 700×119）；
// 滑过去以后的颜色从深夜海 #2B2F77 换成夜海调色板的主色 #6E6AF0（白字还读得清）。2:22 少女音那次用的是同一个面板，一起改。rev vs17
// 第十八轮（用户：1:05 声线切换窗口时间缩短一点）：整个面板 1.4 → 1.1 s。砍的是滑到头以后的停留（以前滑完还要停 0.5 s），
// 滑动本身只从 0.7 收到 0.62 s（第十四轮用户嫌快到看不出过程才放慢的，不再压）；划掉、落定、解码那一行都跟着往前挪。rev vs18
const VS_T = {
  17: { end: 1.4, strike: 0.1, slide: 0.22, dur: 0.7, sweep: 0.3, land: 0.9, landD: 0.25, dec: 0.75, step: 0.012, out: 1.25 },
  18: { end: 1.1, strike: 0.08, slide: 0.18, dur: 0.62, sweep: 0.24, land: 0.76, landD: 0.2, dec: 0.55, step: 0.008, out: 0.96 },
};
function voiceSwitch14(ctx, S, from, to, age) {
  const T = VS_T[18];
  if (age < 0 || age > T.end) return;
  const K = 0.7, OD = T.end - T.out;
  const pal = S.pal, NAVY = '#6E6AF0', PINK = '#FF6FA8', LPINK = '#FFE3EF', cx = 960, cy = 540, TW = 1000, TH = 170;
  const pop = K * easeOutBack(clamp(age / 0.14), 2) * (1 - 0.25 * clamp((age - T.out) / OD)), out = 1 - clamp((age - T.out) / OD);
  const k = clamp((age - T.slide) / T.dur), io = k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2;
  const e = io + 0.045 * Math.sin(Math.PI * clamp((k - 0.72) / 0.28)), vel = k > 0 && k < 1 ? 6 * k * (1 - k) : 0; // vel：0–1.5 的相对速度
  const sw = clamp((age - T.sweep) / T.dur);
  if (sw > 0 && sw < 1) { // 背后换调色板的一道淡扫，和圆钮同向
    const x = -400 + (W + 800) * sw, g = ctx.createLinearGradient(x - 400, 0, x, 0);
    g.addColorStop(0, css(NAVY, 0)); g.addColorStop(0.8, css(NAVY, 0.16)); g.addColorStop(1, css(NAVY, 0));
    ctx.fillStyle = g; ctx.fillRect(x - 400, 0, 400, H);
  }
  ctx.save(); ctx.globalAlpha *= out;
  ctx.translate(cx, cy); ctx.scale(pop, pop);
  // 底板
  ctx.fillStyle = css(pal.shadow ?? '#1D2541', 0.18); rrect(ctx, -TW / 2 - 70 + 10, -TH / 2 - 120 + 12, TW + 140, TH + 260, 36); ctx.fill();
  ctx.fillStyle = '#FFFFFF'; rrect(ctx, -TW / 2 - 70, -TH / 2 - 120, TW + 140, TH + 260, 36); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = BRAND_; ctx.stroke();
  ctx.font = font('ZENB', 22); const tw = ctx.measureText('diff config.yaml').width + 32;
  ctx.fillStyle = BRAND_; rrect(ctx, -TW / 2 - 50, -TH / 2 - 138, tw, 36, 18); ctx.fill(); ctx.fillStyle = '#FFFFFF'; midText(ctx, 'diff config.yaml', -TW / 2 - 34, -TH / 2 - 120);
  // 上：- voice 被划掉
  ctx.font = fonts(30, 'SC'); ctx.fillStyle = PINK; const ln = `- voice: "${from[0]}"`; ctx.fillText(ln, -TW / 2, -TH / 2 - 50);
  const st = clamp((age - T.strike) / 0.14); if (st > 0) { ctx.fillRect(-TW / 2 - 6, -TH / 2 - 61, (ctx.measureText(ln).width + 12) * st, 4); }
  // 滑轨：浅粉底，圆钮走过的部分填夜海蓝
  const kx0 = -TW / 2 + TH / 2, kx1 = TW / 2 - TH / 2, kx = lerp(kx0, kx1, e);
  ctx.save(); rrect(ctx, -TW / 2, -TH / 2, TW, TH, TH / 2); ctx.clip();
  ctx.fillStyle = LPINK; ctx.fillRect(-TW / 2, -TH / 2, TW, TH);
  ctx.fillStyle = mixHex2(LPINK, NAVY, clamp(e * 6)); ctx.fillRect(-TW / 2, -TH / 2, kx + TW / 2, TH); // 起步时才变蓝（静止时圆钮左边不露蓝边）
  // 两个词钉在圆钮两侧 d 处，跟着圆钮一起滑；被滑轨的圆角边裁掉
  const d = (3 * TW) / 4 - TH / 2;
  ctx.font = fonts(84, 'ZENB', 'SCB'); ctx.textAlign = 'center';
  const word = (s, x, col) => {
    for (let j = 2; j >= 1; j--) if (vel > 0.2) { ctx.save(); ctx.globalAlpha *= 0.18 * vel / j; ctx.fillStyle = col; midText(ctx, s, x - j * 26 * vel, 0); ctx.restore(); }
    ctx.fillStyle = col; midText(ctx, s, x, 0);
  };
  word(from[0], kx + d, PINK);
  const land = clamp((age - T.land) / T.landD), big = 1 + 0.1 * Math.sin(Math.PI * land);
  ctx.save(); ctx.translate(kx - d, 0); ctx.scale(big, big); word(to[0], 0, '#FFFFFF'); ctx.restore();
  ctx.restore();
  ctx.textAlign = 'left';
  ctx.lineWidth = 5; ctx.strokeStyle = mixHex2(PINK, NAVY, e); rrect(ctx, -TW / 2, -TH / 2, TW, TH, TH / 2); ctx.stroke();
  // 圆钮：跑动时横向拉长一点
  ctx.save(); ctx.translate(kx, 0); ctx.scale(1 + 0.16 * vel, 1 - 0.08 * vel);
  ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(0, 0, TH / 2 - 12, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = mixHex2(PINK, NAVY, e); ctx.stroke();
  ctx.restore();
  // 下：palette 晴空 → 夜海（滑到头以后才解码出来）
  ctx.font = fonts(30, 'SC'); ctx.fillStyle = '#1FA88F';
  ctx.fillText(decode(`+ voice: "${to[0]}"   palette: "${to[1]}"`, age - T.dec, { step: T.step, settle: 0.12, seed: 9 }), -TW / 2, TH / 2 + 66);
  ctx.restore();
}

const BRAND_ = '#4D6BFE';
const mixHex2 = (a, b, u) => { const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), A = p(a), B = p(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * clamp(u))).join(',')})`; };
export const centerCol = cells => Math.floor((COLS - cells) / 2);
