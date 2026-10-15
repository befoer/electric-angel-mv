// 第二段副歌（御姐音 · 夜海）L21–L24（58–65 小节，1:31.27–1:44.07），视觉方案 §5.0 御姐版 C1–C4，第七轮实现
import { W, H, BRAND, BEAT, STEP } from '../core/const.js';
import { barStart, beatTime, clamp, lerp, smooth, easeIn, easeOut, decay } from '../core/time.js';
import { cutAt } from '../core/cuts.js';
import { hash, rnd, vnoise } from '../core/rand.js';
import { font, fonts } from '../core/glyphs.js';
import { keyword, lyric, vspec } from '../core/data.js';
import { keyed } from '../core/portrait.js';
import { camAt, withCam, blurLayer, camToScreen } from '../core/cam.js';
import { hud } from '../core/hud.js';
import { card, corners, stamp } from '../core/kit.js';
import { drawFormula } from '../core/math.js';
import { drawSprite } from '../core/sprites.js';
import { ringScanner, ecgStrip, ruler, tag, targetLock, hudCluster } from '../core/hudkit.js';
import { css, mix } from '../core/color.js';
import { rrect } from '../core/ui.js';
import { newCanvas } from '../core/env.js';
import { paper, backDeco, frontDeco, punch, bigLine, camBeat, pulseK, formulaFx, inkFlash } from './scene.js';
import { rev } from '../rev.js';

// ================================================================ L21 · C1 御姐版 · 只要和你在一起（58–59）
// 一片悬在不同深度的细线小窗口，每个里只有一行代码；镜头横移穿过它们（远的虚、近的快），
// 停在中间那个：`if (you) return;`，行尾两根光标（她的蓝、你的灰）并排，跟着心跳一起闪；底下「对方正在输入…」
// 第十五轮：L21 / L23 / L24 从切点开始（core/cuts.js，画帧时取）
const L21_0 = () => cutAt(58), L21_1 = () => cutAt(60); // 第十六轮：结尾也跟着切点走
const LINES21 = ['while (true) {', 'wait();', 'listen(you);', '// 23:59', 'if (!you) sleep();', 'return "嗯";', 'heart.beat(150);', 'remember(you);', 'stay();', '}'];
const WINS21 = Array.from({ length: 40 }, (_, i) => ({ x: (rnd(i, 1) - 0.5) * 4200, y: 60 + rnd(i, 2) * 960, d: 0.3 + rnd(i, 3) * 1.4, s: LINES21[i % LINES21.length] }));
// 第十二轮（用户：1:33 背景的 3D 空间还是不够有纵深、不够丰富，随机位置加图形元素；转场太普通；1:35 示波器里不够丰富，转场没冲击力；
// 1:38 右下的图形放大、放到漂浮的她后面，整个镜头重新构图）。rev v2c
// 第十三轮（用户：1:37 示波器下面四个圆钮跟着心跳依次亮起、弹一下；1:38 注意力矩阵继续放大放到左边、她挪到右边，左上的窗口换位置，
// 矩阵上方的弧线每次只显示几帧；1:45 中间大歌词换回明朝体）
const cam21 = (S, t = S.t) => { const u = (t - L21_0()) / (L21_1() - L21_0()), pan = lerp(-900, 0, easeOut(clamp(u * 1.4))); return { x: pan, y: 0, zoom: 1 + 0.04 * u, rot: 0 }; };
// 随机位置的图形元素：[种类, x, y, 深度, 大小]，深度 < 1 的在远处（慢、淡、虚），> 1 的在近处（快、大）
const GFX21 = Array.from({ length: 44 }, (_, i) => [['ring', 'plus', 'hex', 'diamond', 'brace', 'dots', 'arc', 'tri'][i % 8], (rnd(i, 41) - 0.5) * 4400, 40 + rnd(i, 42) * 1000, 0.25 + 1.6 * rnd(i, 43), 18 + 60 * rnd(i, 44)]);
function gfx21(g, S, kind, x, y, s, i) {
  const p = S.pal, t = S.t, rot = t * (0.3 + rnd(i, 45)) * (i % 2 ? 1 : -1), col = i % 5 === 0 ? p.acc[0] : i % 3 ? BRAND : p.line;
  g.save(); g.translate(x, y); g.rotate(rot); g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 2;
  if (kind === 'ring') { g.setLineDash([s * 0.3, s * 0.2]); g.beginPath(); g.arc(0, 0, s, 0, Math.PI * 2); g.stroke(); g.setLineDash([]); g.beginPath(); g.arc(0, 0, s * 0.35, 0, Math.PI * 2); g.stroke(); }
  else if (kind === 'plus') { g.lineWidth = 3; g.beginPath(); g.moveTo(-s / 2, 0); g.lineTo(s / 2, 0); g.moveTo(0, -s / 2); g.lineTo(0, s / 2); g.stroke(); }
  else if (kind === 'hex') { g.beginPath(); for (let k = 0; k < 6; k++) { const a = (k * Math.PI) / 3; k ? g.lineTo(Math.cos(a) * s, Math.sin(a) * s) : g.moveTo(Math.cos(a) * s, Math.sin(a) * s); } g.closePath(); g.stroke(); }
  else if (kind === 'diamond') { g.globalAlpha *= 0.8; g.beginPath(); g.moveTo(0, -s * 0.6); g.lineTo(s * 0.4, 0); g.lineTo(0, s * 0.6); g.lineTo(-s * 0.4, 0); g.closePath(); g.fill(); }
  else if (kind === 'brace') { g.rotate(-rot); g.font = fonts(Math.round(s * 1.6), 'DOT', 'SC'); g.fillText(i % 2 ? '{ }' : '</>', -s * 0.8, s * 0.5); }
  else if (kind === 'dots') { for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) { g.beginPath(); g.arc((a - 1) * s * 0.4, (b - 1) * s * 0.4, 2.5, 0, Math.PI * 2); g.fill(); } }
  else if (kind === 'arc') { g.lineWidth = 3; g.beginPath(); g.arc(0, 0, s, 0, Math.PI * 1.2); g.stroke(); }
  else { g.beginPath(); g.moveTo(0, -s * 0.5); g.lineTo(s * 0.45, s * 0.35); g.lineTo(-s * 0.45, s * 0.35); g.closePath(); g.stroke(); }
  g.restore();
}
// 透视地面：一组往远处收的横线 + 汇向消失点的纵线，随镜头平移（纵深感）
function floor21(ctx, S, c) {
  const p = S.pal, vx = 960 - c.x * 0.15, vy = 610, off = ((-c.x * 0.9) % 160 + 160) % 160;
  ctx.save(); ctx.strokeStyle = css(p.line, 0.22); ctx.lineWidth = 1.2; ctx.beginPath();
  for (let k = 1; k < 18; k++) { const y = vy + 470 / (1 + (18 - k) * 0.45); ctx.moveTo(0, y); ctx.lineTo(W, y); }
  for (let k = -24; k <= 24; k++) { const x = vx + (k * 160 + off) * 4; ctx.moveTo(vx + (x - vx) * 0.04, vy + 12); ctx.lineTo(x, H + 40); }
  ctx.stroke();
  const fade = ctx.createLinearGradient(0, vy, 0, vy + 140); fade.addColorStop(0, css(p.bg, 1)); fade.addColorStop(1, css(p.bg, 0)); ctx.fillStyle = fade; ctx.fillRect(0, vy - 2, W, 142);
  ctx.restore();
}

export function l21(ctx, S) {
  const p = S.pal, t = S.t, u = (t - L21_0()) / (L21_1() - L21_0()), pan = lerp(-900, 0, easeOut(clamp(u * 1.4)));
  const cam = cam21(S), c = { ...cam, zoom: cam.zoom * punch(S, 0.012) };
  paper(ctx, S, c, { grid: false });
  {
    floor21(ctx, S, c);
    blurLayer(ctx, 3, g => { for (const [k, x, y, d, s] of GFX21) if (d < 0.7) withCam(g, c, d, gg => gfx21(gg, S, k, x * d + 960, y, s * (0.5 + d), x)); }, { slot: 5, alpha: 0.5 });
    for (const [k, x, y, d, s] of GFX21) if (d >= 0.7 && d < 1.3) withCam(ctx, c, d, g => { g.globalAlpha = 0.55; gfx21(g, S, k, x * d + 960, y, s * d, x); });
  }
  // 星点：很淡的细小十字
  ctx.fillStyle = css(p.line, 0.35);
  for (let i = 0; i < 160; i++) { const x = ((rnd(i, 5) * 2600 - pan * 0.2) % 2600 + 2600) % 2600 - 340, y = rnd(i, 6) * H; ctx.fillRect(x, y, 1.5, 1.5); }
  const win = (g, w, focus) => {
    g.font = fonts(focus ? 76 : 30, 'SC');
    const tw = g.measureText(w.s).width + (focus ? 200 : 80), h = focus ? 190 : 80;
    g.fillStyle = css('#FFFFFF', focus ? 1 : 0.9); rrect(g, -tw / 2, -h / 2, tw, h, 10); g.fill();
    g.lineWidth = 1; g.strokeStyle = focus ? BRAND : p.winEdge; g.stroke();
    g.beginPath(); g.moveTo(-tw / 2, -h / 2 + 18); g.lineTo(tw / 2, -h / 2 + 18); g.stroke();
    for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(-tw / 2 + 12 + k * 10, -h / 2 + 9, 2.5, 0, Math.PI * 2); g.stroke(); }
    g.fillStyle = focus ? BRAND : p.text; g.textBaseline = 'middle'; g.fillText(w.s, -tw / 2 + (focus ? 50 : 28), 9); g.textBaseline = 'alphabetic';
    return tw;
  };
  // 第十五轮（用户：1:32 背景的随机文字窗口加类似抽帧的抖动，跟着音乐节拍，频率和下一个镜头的心跳一致，强度不用太大）。rev jit15
  // 下一个镜头示波器里的心每拍跳一下（150 BPM），所以每拍头 0.13 s 里约六成窗口按 2 帧一跳的随机位移抖几下（像掉帧），幅度随时间收到 0；
  // 离得越近抖得越大（远层约 3 px、中层 8 px、近层 14 px）
  const jit = (i, amp) => {
    const a = S.sub * BEAT; if (a > 0.13 || hash(i, S.ni, 91) % 10 >= 6) return [0, 0];
    const k = Math.floor(a * 30), A = amp * (1 - a / 0.13);
    return [A * ((hash(i, S.ni, k, 92) % 200) / 100 - 1), 0.4 * A * ((hash(i, S.ni, k, 93) % 200) / 100 - 1)];
  };
  // 远的一层：虚焦
  blurLayer(ctx, 4, g => withCam(g, c, 0.5, gg => { WINS21.forEach((w, i) => { if (w.d >= 0.8) return; const [jx, jy] = jit(i, 3); gg.save(); gg.translate(w.x + 960 + jx, w.y + jy); win(gg, w, false); gg.restore(); }); }), { slot: 3, alpha: 0.7 });
  withCam(ctx, c, 1, g => {
    WINS21.forEach((w, i) => { if (w.d < 0.8 || w.d >= 1.4) return; const [jx, jy] = jit(i, 8); g.save(); g.translate(w.x * 0.8 + 960 + jx, w.y + jy); g.globalAlpha = 0.85; win(g, w, false); g.restore(); });
    // 焦点窗口
    g.save(); g.translate(960, 520);
    const tw = win(g, { s: 'if (you) return;' }, true);
    // 两根光标：她的蓝、你的灰，并排，心跳时一起亮
    const beat = decay(S.sub * BEAT, 7), x0 = tw / 2 - 90;
    g.fillStyle = css(BRAND, 0.35 + 0.65 * beat); g.fillRect(x0, -30, 9, 80);
    g.fillStyle = css(p.gray, 0.35 + 0.65 * beat); g.fillRect(x0 + 22, -30, 9, 80);
    for (let k = 0; k < 3; k++) { const ph = ((S.sub + k / 3) % 1); g.strokeStyle = css(BRAND, 0.5 * (1 - ph)); g.lineWidth = 1.5; g.beginPath(); g.arc(x0 + 15, 10, 30 + ph * 220, 0, Math.PI * 2); g.stroke(); } // 心跳的涟漪
    g.restore();
    // 两颗星连线：标签 you / me
    const sx = 960 + tw / 2 - 75, sy = 330;
    g.strokeStyle = css(p.line, 0.8); g.lineWidth = 1; g.beginPath(); g.moveTo(sx - 220, sy - 60); g.lineTo(sx, 482); g.lineTo(sx + 220, sy - 40); g.stroke();
    g.fillStyle = BRAND; g.beginPath(); g.arc(sx - 220, sy - 60, 6 + 4 * beat, 0, Math.PI * 2); g.fill();
    g.fillStyle = p.gray; g.beginPath(); g.arc(sx + 220, sy - 40, 6 + 4 * beat, 0, Math.PI * 2); g.fill();
    g.font = fonts(18, 'MIN', 'SC'); g.fillStyle = BRAND; g.fillText('me', sx - 250, sy - 76); g.fillStyle = p.gray; g.fillText('you', sx + 210, sy - 58);
    corners(g, 960 - tw / 2 - 30, 520 - 125, tw + 60, 250, css(BRAND, 0.8), { len: 30, lw: 1.5, plus: false });
    // 对方正在输入…
    g.font = fonts(22, 'SC'); g.fillStyle = p.gray; g.textAlign = 'center';
    g.fillText(`对方正在输入${'.'.repeat(1 + (Math.floor(t * 4) % 3))}`, 960, 700); g.textAlign = 'left';
  });
  // 近的一层：大、快、虚
  blurLayer(ctx, 6, g => {
    withCam(g, c, 1.8, gg => { WINS21.forEach((w, i) => { if (w.d < 1.4) return; const [jx, jy] = jit(i, 14); gg.save(); gg.translate(w.x * 0.6 + 960 + jx, w.y + jy); gg.scale(1.6, 1.6); win(gg, w, false); gg.restore(); }); });
    for (const [k, x, y, d, s] of GFX21) if (d >= 1.3) withCam(g, c, d, gg => gfx21(gg, S, k, x * d * 0.6 + 960, y, s * d * 1.4, x));
  }, { slot: 4, alpha: 0.6 });
  hud(ctx, S, { spectrum: false });
}
// 1:35 转场叠层（L21 → L22）：中间那个「if (you) return;」窗口变成示波器的屏幕——框从白变深、从横长条长成 L22 屏幕的大小，
// 窗口里的字淡掉，一条青色的心跳线从左往右扫出来（就是下一个镜头里描心形的那束电子）
export function scopeHandoff(ctx, S, u) {
  const p = S.pal, c = cam21(S), z = c.zoom, e = smooth(clamp((u - 0.05) / 0.75));
  const m = newCanvas(8, 8).getContext('2d'); m.font = fonts(76, 'SC');
  const fw = (m.measureText('if (you) return;').width + 200) * z, fh = 190 * z, [fcx, fcy] = camToScreen(c, 1, 960, 520), fx = fcx - fw / 2, fy = fcy - fh / 2;
  const c22 = { x: 0, y: 0, zoom: 1.02, rot: 0 }, [sx, sy] = camToScreen(c22, 1, 560, 90), sw = 800 * 1.02, sh = 640 * 1.02;
  const x = lerp(fx, sx, e), y = lerp(fy, sy, e), w = lerp(fw, sw, e), h = lerp(fh, sh, e), out = 1 - smooth(clamp((u - 0.8) / 0.2));
  ctx.save(); ctx.globalAlpha = out;
  ctx.fillStyle = mix('#FFFFFF', '#141A3A', smooth(clamp(e * 1.4))); rrect(ctx, x, y, w, h, lerp(10, 18, e)); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = e < 0.5 ? BRAND : p.line; ctx.stroke();
  const ta = 1 - clamp(e * 2.5);
  if (ta > 0) { ctx.globalAlpha = out * ta; ctx.font = fonts(Math.round(76 * z * (1 - 0.3 * e)), 'SC'); ctx.fillStyle = BRAND; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('if (you) return;', x + w / 2, y + h / 2); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.globalAlpha = out; }
  const lu = clamp((u - 0.2) / 0.55); // 心跳线
  if (lu > 0) {
    ctx.save(); ctx.beginPath(); rrect(ctx, x, y, w, h, 12); ctx.clip();
    ctx.strokeStyle = '#7FF3FF'; ctx.lineWidth = 3; ctx.shadowColor = '#7FF3FF'; ctx.shadowBlur = 12; ctx.beginPath();
    for (let k = 0; k <= 80 * lu; k++) { const s = k / 80, xx = x + s * w, ph = (s * 3) % 1, yy = y + h / 2 - (ph > 0.45 && ph < 0.55 ? Math.sin(((ph - 0.45) / 0.1) * Math.PI) * h * 0.3 : 0); k ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); }
    ctx.stroke(); ctx.restore();
  }
  ctx.restore();
}

// ================================================================ L22 · C2 御姐版 · 电子的心在颤动（60–61）
// 一台细线示波器：电子束按心形线 (x²+y²−1)³ − x²y³ = 0 描出一颗心（极坐标逐角度求根），带荧光余辉，幅度跟底鼓跳；
// 唱到「電♪」时字沿着心的外圈排开；菱形精灵在拍上闪；下面是 f = 2.5 Hz
const L22_0 = () => cutAt(60);
let HEART = null;
function heartPts() { // 心形线的极坐标采样：对每个角度二分求 r
  if (HEART) return HEART;
  HEART = [];
  for (let i = 0; i < 720; i++) {
    const a = (i / 720) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    const f = r => (r * r - 1) ** 3 - r ** 5 * c * c * s ** 3;
    let lo = 0, hi = 2;
    for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (f(m) < 0) lo = m; else hi = m; }
    HEART.push([lo * c, -lo * s]);
  }
  return HEART;
}
// 第九轮（用户：1:37 左上的公式窗口里加动画）。rev l22
// 公式缩到卡片顶上；下面用 marching squares 把这条心形曲线"算"出来：一行行扫过网格，f < 0 的格子（心里面）染粉，
// 符号变化的格子连出蓝色的等值线；扫完后一个点沿曲线走（和示波器的电子束同步），旁边实时显示 (x, y) 和 f(x, y) = 0
const HF = (x, y) => (x * x + y * y - 1) ** 3 - x * x * y ** 3;
function heartCard9(g, S) {
  const p = S.pal, t = S.t, a = t - L22_0();
  const fix = true; // 第十轮：卡片收窄，不再压到示波器上
  card(g, S, 96, 110, fix ? 440 : 500, 320, { title: 'heart curve', lw: 2, inner: false }, cc => {
    drawFormula(g, 'heart', cc.x, cc.y + 2, { size: 22, color: p.text, ...formulaFx(S, a - 0.1) });
    const gx = cc.x, gy = cc.y + 52, gw = fix ? 214 : 250, gh = cc.h - 60, NX = 25, NY = 21, cw = gw / NX, ch = gh / NY;
    const X = i => -1.5 + (3 * i) / NX, Y = j => 1.45 - (2.8 * j) / NY, scan = clamp(a / 1.4) * NY;
    g.save(); g.beginPath(); g.rect(gx, gy, gw, gh); g.clip();
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      if (j > scan) break;
      const f00 = HF(X(i), Y(j)), f10 = HF(X(i + 1), Y(j)), f01 = HF(X(i), Y(j + 1)), f11 = HF(X(i + 1), Y(j + 1));
      const inside = (f00 + f10 + f01 + f11) / 4 < 0, edge = Math.min(f00, f10, f01, f11) < 0 && Math.max(f00, f10, f01, f11) > 0;
      const fresh = clamp(1 - (scan - j) / 2);
      g.fillStyle = edge ? css(BRAND, 0.25 + 0.5 * fresh) : inside ? css(p.acc[0], 0.18 + 0.3 * fresh) : css(p.line, 0.05 + 0.15 * fresh);
      g.fillRect(gx + i * cw + 0.5, gy + j * ch + 0.5, cw - 1, ch - 1);
    }
    if (scan < NY) { g.fillStyle = BRAND; g.fillRect(gx, gy + scan * ch, gw, 2); }
    g.restore();
    // 扫完后：曲线 + 沿曲线走的点（和示波器同一个相位）
    const done = clamp((a - 1.4) / 0.3);
    if (done > 0) {
      const pts = heartPts(), N = pts.length, sx = gw / 3, sy = gh / 2.8, ox = gx + gw / 2, oy = gy + gh * (1.45 / 2.8);
      g.strokeStyle = css(BRAND, done); g.lineWidth = 2.5; g.beginPath();
      pts.forEach(([x, y], i) => (i ? g.lineTo(ox + x * sx, oy + y * sy) : g.moveTo(ox + x * sx, oy + y * sy))); g.closePath(); g.stroke();
      const head = ((S.n % 1) + 1) % 1, q = pts[Math.floor(head * N) % N];
      g.fillStyle = p.acc[0]; g.beginPath(); g.arc(ox + q[0] * sx, oy + q[1] * sy, 6, 0, Math.PI * 2); g.fill();
      g.font = fonts(17, 'ZENB'); g.fillStyle = p.text;
      g.fillText(`x = ${q[0].toFixed(3)}`, gx + gw + 24, gy + 40); g.fillText(`y = ${(-q[1]).toFixed(3)}`, gx + gw + 24, gy + 70);
      g.fillStyle = BRAND; g.fillText('f(x, y) = 0.000', gx + gw + 24, gy + 110);
      g.font = fonts(14, 'SC'); g.fillStyle = p.gray; g.fillText('marching squares', gx + gw + 24, gy + gh - 8);
    } else { g.font = fonts(15, 'ZENB'); g.fillStyle = p.gray; g.fillText(`scan ${Math.round((100 * scan) / NY)}%`, gx + gw + 24, gy + 40); }
  });
}
// 第十二轮：示波器屏幕里加东西——中心十字和中轴上的细刻度、扫描线和暗角、束头的辉光、触发电平线（左边一个 ▶）、
// 两条随心形宽度来回卡的测量光标（Δx 读数）、底部第二通道（粉色正弦，跟人声响度起伏）、右上角一个小频谱、底下一排读数
function scope12(g, S, X, Y, w, h, cx, cy, amp, hp) {
  const t = S.t, cyan = '#7FF3FF', pink = '#FF6FA8';
  g.save(); g.beginPath(); rrect(g, X, Y, w, h, 18); g.clip();
  g.strokeStyle = css(cyan, 0.35); g.lineWidth = 1; g.beginPath();
  for (let i = 0; i <= 50; i++) { const xx = X + (w * i) / 50, l = i % 5 ? 4 : 9; g.moveTo(xx, cy - l); g.lineTo(xx, cy + l); }
  for (let j = 0; j <= 40; j++) { const yy = Y + (h * j) / 40, l = j % 5 ? 4 : 9; g.moveTo(cx - l, yy); g.lineTo(cx + l, yy); }
  g.stroke();
  g.setLineDash([3, 5]); g.strokeStyle = css(cyan, 0.3); g.beginPath(); g.moveTo(X, cy); g.lineTo(X + w, cy); g.moveTo(cx, Y); g.lineTo(cx, Y + h); g.stroke(); g.setLineDash([]);
  // 触发电平
  const ty = cy - amp * 0.55 + 6 * Math.sin(t * 2);
  g.setLineDash([10, 8]); g.strokeStyle = css(pink, 0.6); g.beginPath(); g.moveTo(X, ty); g.lineTo(X + w, ty); g.stroke(); g.setLineDash([]);
  g.fillStyle = pink; g.beginPath(); g.moveTo(X + 4, ty - 9); g.lineTo(X + 18, ty); g.lineTo(X + 4, ty + 9); g.closePath(); g.fill();
  // 测量光标：卡住心形的左右边
  const sw = amp * 1.18 * (1 + 0.03 * Math.sin(t * 3)), lx = cx - sw, rx = cx + sw;
  g.setLineDash([6, 6]); g.strokeStyle = css('#FFE08A', 0.75); g.beginPath(); g.moveTo(lx, Y); g.lineTo(lx, Y + h); g.moveTo(rx, Y); g.lineTo(rx, Y + h); g.stroke(); g.setLineDash([]);
  g.font = fonts(14, 'ZENB', 'SCB'); g.fillStyle = '#FFE08A'; g.fillText(`Δx ${(rx - lx).toFixed(0)} px`, rx + 8, Y + 64);
  // 束头辉光
  const hx = cx + hp[0] * amp, hy = cy + hp[1] * amp, glow = g.createRadialGradient(hx, hy, 2, hx, hy, 60);
  glow.addColorStop(0, css(cyan, 0.55)); glow.addColorStop(1, css(cyan, 0)); g.fillStyle = glow; g.fillRect(hx - 60, hy - 60, 120, 120);
  // 第二通道：粉色正弦，跟人声
  const sp = vspec(t), lv = sp.slice(4, 20).reduce((a, b) => a + b, 0) / 16, by = Y + h - 70;
  g.strokeStyle = css(pink, 0.85); g.lineWidth = 2.5; g.beginPath();
  for (let k = 0; k <= 160; k++) { const xx = X + (w * k) / 160, yy = by + (12 + 40 * lv) * Math.sin(k * 0.22 - t * 9) * Math.sin(k * 0.035 + t); k ? g.lineTo(xx, yy) : g.moveTo(xx, yy); }
  g.stroke();
  g.font = fonts(13, 'ZENB', 'SCB'); g.fillStyle = pink; g.fillText('CH2 ∿ voice', X + 20, by - 30);
  // 右上小频谱
  const fx = X + w - 190, fy = Y + 50;
  g.strokeStyle = css(cyan, 0.4); g.lineWidth = 1; g.strokeRect(fx, fy, 170, 70);
  for (let i = 0; i < 16; i++) { const v = sp[i * 2] || 0; g.fillStyle = css(cyan, 0.4 + 0.5 * v); g.fillRect(fx + 6 + i * 10, fy + 64 - v * 56, 7, v * 56); }
  // 扫描线 + 暗角
  g.fillStyle = 'rgba(0,0,0,0.12)'; for (let yy = Y; yy < Y + h; yy += 3) g.fillRect(X, yy, w, 1);
  const vg = g.createRadialGradient(cx, cy, Math.min(w, h) * 0.35, cx, cy, Math.hypot(w, h) * 0.6); vg.addColorStop(0, 'rgba(10,14,40,0)'); vg.addColorStop(1, 'rgba(10,14,40,0.55)');
  g.fillStyle = vg; g.fillRect(X, Y, w, h);
  // 读数
  g.font = fonts(15, 'ZENB', 'SCB'); g.fillStyle = css(cyan, 0.85);
  g.fillText(`Vpp ${(2 + 0.3 * S.f.low).toFixed(2)} V   ·   f 2.50 Hz   ·   Δφ 90°   ·   ${Math.round(150 + 4 * Math.sin(t * 2))} BPM`, X + 20, Y + h - 16);
  g.restore();
}

export function l22(ctx, S) {
  const p = S.pal, t = S.t, cam = { x: 0, y: 0, zoom: 1.02 + 0.03 * pulseK(S) * decay(S.sub * BEAT, 8), rot: 0.006 * Math.sin(t * 1.3) };
  paper(ctx, S, cam);
  backDeco(ctx, S, cam, 220, { alpha: 0.35 });
  withCam(ctx, cam, 1, g => {
    const X = 560, Y = 90, w = 800, h = 640, cx = X + w / 2, cy = Y + h / 2 + 10;
    // 示波器屏幕：深色底 + 刻度格
    g.fillStyle = '#141A3A'; rrect(g, X, Y, w, h, 18); g.fill();
    g.lineWidth = 2; g.strokeStyle = p.line; g.stroke();
    g.strokeStyle = css('#3FC6E8', 0.18); g.lineWidth = 1; g.beginPath();
    for (let i = 1; i < 10; i++) { g.moveTo(X + (w * i) / 10, Y); g.lineTo(X + (w * i) / 10, Y + h); }
    for (let j = 1; j < 8; j++) { g.moveTo(X, Y + (h * j) / 8); g.lineTo(X + w, Y + (h * j) / 8); }
    g.stroke();
    // 电子束：每拍描一圈，头部最亮，后面是余辉
    const pts = heartPts(), amp = 190 * (1 + 0.12 * S.f.low + 0.1 * decay(S.sub * BEAT, 9)), head = ((S.n % 1) + 1) % 1, N = pts.length;
    g.lineCap = 'round';
    for (let k = 0; k < 240; k++) {
      const i0 = Math.floor((head - k / 260) * N + N * 4) % N, i1 = (i0 + 3) % N, a = 1 - k / 240;
      g.strokeStyle = css('#7FF3FF', 0.08 + 0.9 * a * a); g.lineWidth = 2 + 4 * a * a;
      g.beginPath(); g.moveTo(cx + pts[i0][0] * amp, cy + pts[i0][1] * amp); g.lineTo(cx + pts[i1][0] * amp, cy + pts[i1][1] * amp); g.stroke();
    }
    g.strokeStyle = css('#7FF3FF', 0.22); g.lineWidth = 1.2; g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(cx + x * amp, cy + y * amp) : g.moveTo(cx + x * amp, cy + y * amp))); g.closePath(); g.stroke();
    const hp = pts[Math.floor(head * N) % N]; g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(cx + hp[0] * amp, cy + hp[1] * amp, 7, 0, Math.PI * 2); g.fill();
    g.font = fonts(16, 'SC'); g.fillStyle = css('#7FF3FF', 0.8);
    g.fillText('CH1  2.5 Hz  ·  X-Y MODE', X + 20, Y + 30); g.fillText(`TRIG ♥  ${(150).toFixed(1)} BPM`, X + w - 230, Y + 30);
    scope12(g, S, X, Y, w, h, cx, cy, amp, hp);
    // 旋钮与标签
    // 第十三轮：示波器里的心每拍跳一下（amp 的拍头冲击），四个旋钮按拍依次轮到一个：亮一圈青色的光、弹一下（先放大再回弹）、指针拧一下、标签变蓝
    for (let k = 0; k < 4; k++) {
      const kx = X + 120 + k * 190, ky = Y + h + 70;
      const dt = (S.sub + (((S.ni - k) % 4) + 4) % 4) * BEAT, hl = decay(dt, 4.5), sc = 1 + 0.42 * Math.exp(-6 * dt) * Math.sin(18 * dt);
      g.save(); g.translate(kx, ky); g.scale(sc, sc);
      if (hl > 0.02) { const gl = g.createRadialGradient(0, 0, 26, 0, 0, 62); gl.addColorStop(0, css('#7FF3FF', 0.55 * hl)); gl.addColorStop(1, css('#7FF3FF', 0)); g.fillStyle = gl; g.fillRect(-62, -62, 124, 124); }
      g.fillStyle = hl > 0.02 ? mix('#FFFFFF', '#DFFBFF', hl) : '#FFFFFF'; g.beginPath(); g.arc(0, 0, 30, 0, Math.PI * 2); g.fill();
      g.lineWidth = 1.5 + 1.5 * hl; g.strokeStyle = hl > 0.02 ? mix(p.line, '#3FC6E8', hl) : p.line; g.stroke();
      const a = -2 + k + Math.sin(t + k) * 0.3 + 0.55 * Math.exp(-5 * dt) * Math.sin(14 * dt);
      g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 24, Math.sin(a) * 24); g.stroke();
      g.restore();
      g.font = fonts(14, 'SC'); g.fillStyle = hl > 0.02 ? mix(p.gray, BRAND, hl) : p.gray; g.fillText(['VOLTS/DIV', 'TIME/DIV', 'X POS', 'Y POS'][k], kx - 34, ky + 52);
    }
    // 「電♪」沿着心的外圈排开
    keyword('L22', 0, 6).forEach((k, i) => {
      const a = t - k.t0; if (a < 0) return;
      const q = pts[Math.floor(((0.62 + i * 0.075) % 1) * N)], s = 1.32, x = cx + q[0] * amp * s, y = cy + q[1] * amp * s;
      g.save(); g.translate(x, y); g.scale(easeOut(clamp(a / 0.12)), easeOut(clamp(a / 0.12)));
      // 第十轮（用户：明朝体和 HUD 界面不搭）：像素字体（DotGothic16）、不描边，颜色用示波器的青（rev l22font）
      const px = true;
      g.font = px ? fonts(84, 'DOT', 'J') : fonts(76, 'MIN', 'J'); g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
      if (!px) { g.lineWidth = 10; g.strokeStyle = '#FFFFFF'; g.strokeText(k.c, 0, 0); }
      g.fillStyle = px ? '#7FF3FF' : BRAND; g.fillText(k.c, 0, 0);
      g.restore();
    });
    // 菱形精灵：拍上在屏幕四周闪
    for (let k = 0; k < 6; k++) { const a = decay(S.sub * BEAT, 6), i = S.ni * 6 + k; drawSprite(g, 'diamond', 4, p, 200 + rnd(i, 1) * 1520, 80 + rnd(i, 2) * 900, 0.6 + a, a); }
  });
  withCam(ctx, cam, 0.4, g => {
    heartCard9(g, S);
    card(g, S, 1404, 120, 420, 200, { title: 'trigger', lw: 2, inner: false }, cc => { drawFormula(g, 'bpm_b', cc.x + cc.w / 2, cc.y + cc.h / 2 - 20, { size: 46, align: 'c', valign: 'mid', color: BRAND, ...formulaFx(S, S.lt - 0.2, { color: S.pal.acc[0] }) }); ecgStrip(g, S, cc.x, cc.y + cc.h - 50, cc.w, 46, { grid: false }); });
  });
  hud(ctx, S);
}

// ================================================================ L23 · C3 御姐版 · 量子的风（62–63）
// 注意力热图像风一样转：16×16 的注意力矩阵（行列是这句歌词的字），热度场随时间旋涡状流动；
// 她的线框（立绘边缘）分成冷色三份叠影，被风吹开，拍头坍缩成一份
const L23_0 = () => cutAt(62);
// 第九轮（用户：1:38 图像效果和线稿都不好看，先换掉；底部频谱压到公式框；公式框都要动起来；右边像素格表现力不够）。rev l23
// 左：她（I07）用干净的原图，不再做线稿和三色叠影；轻轻漂浮，前面有被风吹过的小方块（这句歌词的字）。
// 右上：公式卡——公式缩在左边，右边是"当前这个字"那一行的 softmax 权重条，跟着唱到的字刷新。
// 右下：注意力矩阵——每唱到一个字，这一行从左到右"算"出来（格子大小 ∝ 权重），上方画出这个字看向前面各字的弧线（粗细 ∝ 权重）；
// 旧的行变淡。整体都在画面中部，不碰底部的频谱
function attnW(n) { // 每一行对前面各字的权重（演出值，确定的）：对角线最高，随机挑两三个前面的字较高，softmax 归一
  const Wm = [];
  for (let r = 0; r < n; r++) {
    const sc = [];
    for (let q = 0; q <= r; q++) sc.push((q === r ? 1.4 : 0) + (hash(r, q, 23) % 5 === 0 ? 1.4 : 0) + rnd(r, q, 24) * 1.0);
    const m = Math.max(...sc), ex = sc.map(v => Math.exp(1.5 * (v - m))), s = ex.reduce((a, b) => a + b, 0);
    Wm.push(ex.map(v => v / s));
  }
  return Wm;
}
function l23r9(ctx, S) {
  const p = S.pal, t = S.t, a = t - L23_0(), cam = { x: 14 * Math.sin(t * 0.8), y: 0, zoom: 1.02, rot: -0.004 };
  // 第二十四轮（用户：1:38 歌词「♪」位置的动画慢了点）：「♪」的起音改到鼻音开始（vocal_onsets.json）；这个镜头里跟字走的东西
  // （选中框、矩阵的行、弧线、softmax 条）以前正好卡在起音上，现在整体提前 0.05 s（画面比声音早一点；第二十六轮并开关 on24）
  const lead = 0.05, toks = lyric('L23').chars.map(k => ({ ...k, t0: k.t0 - lead })), n = toks.length, Wm = attnW(n), cur = toks.filter(k => k.t0 <= t).length - 1;
  paper(ctx, S, cam);
  backDeco(ctx, S, cam, 232, { alpha: 0.3, boxes: [[1000, 930, 420, 120], [1560, 300, 300, 120]] });
  // 第十三轮：矩阵放大（格 68）放到左边，左边竖排的字留在画面里；她挪到右边（不再压着矩阵），公式卡从左上挪到右上
  const G = { X: 160, Y: 190, cs: 68 };
  withCam(ctx, cam, 1, g => {
    // 风线（少、淡）
    for (let i = 0; i < 16; i++) { const y = rnd(i, 1) * H, len = 160 + rnd(i, 2) * 400, x = ((rnd(i, 4) * (W + len) + t * (900 + rnd(i, 3) * 700)) % (W + len)) - len; g.fillStyle = css(i % 3 ? '#FFFFFF' : '#3FC6E8', 0.3); g.fillRect(x, y, len, 1.5); }
    // 她（干净的原图），轻轻漂浮 + 柔和的投影
    // 第十二轮：注意力矩阵放大到画面右中、压在她后面；她挪到中间偏左、浮在矩阵前面（先画矩阵，见 attn23）
    attn23(g, S, toks, n, Wm, cur, G.X, G.Y, G.cs);
    const img = keyed('I07', null, 900), k7 = Math.min(700 / img.height, 760 / img.width), fw = img.width * k7, fh = img.height * k7;
    const fcy = 610, fx = 1420 - fw / 2, fy = fcy - fh / 2 + 16 * Math.sin(t * 1.4);
    g.fillStyle = css('#2B2F77', 0.12); g.beginPath(); g.ellipse(fx + fw / 2, fcy + 20 + fh / 2 + 40, fw * 0.36, 16, 0, 0, Math.PI * 2); g.fill();
    // 第十四轮（用户：人物加一个非常缓慢的随机旋转，像下一个镜头窗口的摇摆）：两层慢噪声叠出来的摇摆（±2° 左右，不规律），
    // 绕她自己的中心转；L24 的窗口是 0.012 rad 的正弦摇摆，这里幅度稍大、频率更慢
    const sway = 0.045 * (vnoise(t * 0.32, 3.7, 0, 23) - 0.5) * 2 + 0.014 * Math.sin(t * Math.PI * 0.6);
    g.save(); g.translate(fx + fw / 2, fy + fh / 2); g.rotate(sway); g.translate(-(fx + fw / 2), -(fy + fh / 2));
    g.drawImage(img, fx, fy, fw, fh);
    g.restore();
    corners(g, fx - 24, fy - 16, fw + 48, fh + 32, css(BRAND, 0.55), { len: 36, lw: 2, plus: false });
    // 前面被风吹过的字块（这句歌词里已经唱到的字）。第十三轮：顺着风（往右）从矩阵吹向她
    const bx0 = G.X + n * G.cs - 30, bx1 = fx + fw * 0.55;
    for (let i = 0; i < 14; i++) {
      const k = toks[i % n], age = t - k.t0; if (age < 0) continue;
      const u = ((age * (0.35 + rnd(i, 7) * 0.25)) + rnd(i, 8)) % 1, x = lerp(bx0, bx1, u), y = fy + 120 + rnd(i, 9) * 460 + Math.sin(u * 6 + i) * 30;
      g.globalAlpha = Math.sin(Math.PI * u) * 0.85;
      g.fillStyle = '#FFFFFF'; rrect(g, x - 20, y - 20, 40, 40, 8); g.fill(); g.strokeStyle = css(BRAND, 0.6); g.lineWidth = 1.2; g.stroke();
      g.font = fonts(22, 'MIN', 'J'); g.fillStyle = BRAND; g.textAlign = 'center'; g.fillText(k.c, x, y + 8); g.textAlign = 'left';
    }
    g.globalAlpha = 1;
  });
  // 公式卡（公式在左，右边是当前行的 softmax 权重条）
  formula23(ctx, S, cam, toks, n, Wm, cur, a);
  frontDeco(ctx, S, cam, 231, { alpha: 0.35, items: [['ring', 1900, 640, 200]] });
  hud(ctx, S);
}
// 第十五轮（用户：1:38 左边每行的粉色框选中状态加强视觉刺激）。rev sel15
// 每唱到一个字、选中框跳到新的一行时：框从 1.12 倍弹回（阻尼）、3 px 粗边带粉色辉光；行里先铺一层淡粉，一道白亮带 0.2 s 从左扫到右；
// 框外四角各一个粉色角标；左边行首的字换成粉底白字的圆标并弹一下；上一行的框不立刻消失，0.2 s 淡掉
function sel23(g, S, toks, cur, X, Y, cs) {
  const p = S.pal, t = S.t, age = t - toks[cur].t0, pink = p.acc[0];
  const box = (r, al, sc, lw, glow) => {
    const x = X, y = Y + r * cs, w = (r + 1) * cs, h = cs, cx = x + w / 2, cy = y + h / 2;
    g.save(); g.translate(cx, cy); g.scale(sc, sc); g.translate(-cx, -cy); g.globalAlpha *= al;
    if (glow > 0.02) { g.shadowColor = pink; g.shadowBlur = 18 * glow; }
    g.strokeStyle = pink; g.lineWidth = lw; g.strokeRect(x, y, w, h); g.shadowBlur = 0;
    g.restore();
  };
  if (cur > 0 && age < 0.2) box(cur - 1, 1 - age / 0.2, 1, 2, 0); // 上一行的框淡掉
  const x = X, y = Y + cur * cs, w = (cur + 1) * cs, h = cs, pop = 1 + 0.12 * Math.exp(-9 * age) * Math.cos(20 * age), hit = decay(age, 5);
  g.fillStyle = css(pink, 0.08 + 0.16 * hit); g.fillRect(x, y, w, h);
  const sw = clamp(age / 0.2);
  if (sw < 1) { const sx = x + w * easeOut(sw), gr = g.createLinearGradient(sx - 60, 0, sx, 0); gr.addColorStop(0, css('#FFFFFF', 0)); gr.addColorStop(1, css('#FFFFFF', 0.75)); g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.fillStyle = gr; g.fillRect(sx - 60, y, 60, h); g.restore(); }
  box(cur, 1, pop, 3, 0.4 + 0.6 * hit);
  g.strokeStyle = pink; g.lineWidth = 3; g.lineCap = 'square';
  const o = 8 + 6 * hit, L = 14;
  for (const [cx, cy, dx, dy] of [[x - o, y - o, 1, 1], [x + w + o, y - o, -1, 1], [x - o, y + h + o, 1, -1], [x + w + o, y + h + o, -1, -1]]) { g.beginPath(); g.moveTo(cx, cy + dy * L); g.lineTo(cx, cy); g.lineTo(cx + dx * L, cy); g.stroke(); }
  const ls = 1 + 0.35 * Math.exp(-8 * age) * Math.cos(16 * age), lx = X - 26, ly = y + cs / 2;
  g.save(); g.translate(lx, ly); g.scale(ls, ls); g.fillStyle = pink; g.beginPath(); g.arc(0, 0, 19, 0, Math.PI * 2); g.fill();
  g.font = fonts(26, 'MIN', 'J'); g.fillStyle = '#FFFFFF'; g.textAlign = 'center'; g.fillText(toks[cur].c, 0, 9); g.textAlign = 'left'; g.restore();
}
function attn23(g, S, toks, n, Wm, cur, X, Y, cs) {
  const p = S.pal, t = S.t;
  {
    g.font = fonts(26, 'MIN', 'J'); g.textAlign = 'center';
    toks.forEach((k, i) => { const lit = i <= cur; g.fillStyle = i === cur ? p.acc[0] : lit ? BRAND : css(p.gray, 0.45); g.fillText(k.c, X + i * cs + cs / 2, Y - 14); g.fillText(k.c, X - 26, Y + i * cs + cs / 2 + 9); });
    g.textAlign = 'left';
    for (let r = 0; r < n; r++) for (let q = 0; q <= r; q++) {
      g.fillStyle = css(p.line, 0.14); g.fillRect(X + q * cs + 2, Y + r * cs + 2, cs - 4, cs - 4);
      if (r > cur) continue;
      const fill = clamp((t - toks[r].t0) / 0.25 * (r + 1) - q), w = Wm[r][q] * clamp(fill);
      if (w <= 0) continue;
      const s = (cs - 6) * Math.sqrt(w) * (0.92 + 0.08 * Math.sin(t * 3 + q + r)), on = r === cur;
      g.fillStyle = on ? (w > 0.3 ? p.acc[0] : BRAND) : css(BRAND, 0.25 + 0.5 * Math.sqrt(w));
      rrect(g, X + q * cs + cs / 2 - s / 2, Y + r * cs + cs / 2 - s / 2, s, s, Math.min(8, s / 3)); g.fill();
    }
    if (cur >= 0) sel23(g, S, toks, cur, X, Y, cs);
    // 上方弧线：当前的字看向前面各字
    // 第十三轮（用户：弧线每次只显示几帧就没了，bug 吗）：不是 bug，是字唱得快（每 0.15–0.35 s 一个），弧线 0.3 s 才长完就被下一个字换掉了。
    // 改成：当前字的弧线 0.15 s 长完；换字后旧的弧线不消失，留在原处慢慢变淡（约 1.5 s），所以同时能看到最近几个字的弧线叠在一起
    if (cur >= 0) {
      for (let r = Math.max(0, cur - 5); r <= cur; r++) {
        const since = r === cur ? -1 : t - toks[r + 1].t0, al = since < 0 ? 1 : Math.exp(-since * 2), da = r === cur ? easeOut(clamp((t - toks[r].t0) / 0.15)) : 1;
        if (al < 0.04) continue;
        const x0 = X + r * cs + cs / 2;
        Wm[r].forEach((w, q) => {
          if (q === r || w < 0.04) return;
          const x1 = X + q * cs + cs / 2, hgt = Math.min(70, 18 + Math.abs(x0 - x1) * 0.12);
          g.strokeStyle = css(r === cur && w > 0.3 ? p.acc[0] : BRAND, (0.3 + 0.7 * w) * al); g.lineWidth = 1 + 9 * w * (0.5 + 0.5 * al);
          g.beginPath(); g.moveTo(x0, Y - 44);
          const steps = 24, end = Math.ceil(steps * da);
          for (let k = 1; k <= end; k++) { const s = k / steps, xx = lerp(x0, x1, s), yy = Y - 44 - Math.sin(Math.PI * s) * hgt; g.lineTo(xx, yy); }
          g.stroke();
        });
      }
    }
    g.font = fonts(16, 'SC'); g.fillStyle = p.gray; g.fillText('attention · head 7 · causal mask', X, Y + n * cs + 28);
  }
}
function formula23(ctx, S, cam, toks, n, Wm, cur, a) {
  const p = S.pal, t = S.t;
  // 第十二轮：矩阵占了右中，公式卡挪到左上。第十三轮：矩阵到了左边，公式卡挪到右上（她的头顶上方）
  withCam(ctx, cam, 0.4, g => card(g, S, 1090, 110, 770, 170, { title: 'scaled dot-product attention', lw: 2, inner: false, age: a - 0.1 }, cc => {
    drawFormula(g, 'attn', cc.x, cc.y + cc.h / 2, { size: 23, valign: 'mid', color: p.text, ...formulaFx(S, a - 0.15) });
    if (cur < 0) return;
    const bx = cc.x + 470, bw = cc.w - 480, row = Wm[cur], bwk = bw / n, base = cc.y + cc.h - 26, mx = Math.max(...row);
    for (let q = 0; q < n; q++) {
      const w = q <= cur ? row[q] : 0, h = (cc.h - 60) * (w / mx) * easeOut(clamp((t - toks[cur].t0) / 0.2));
      g.fillStyle = q <= cur ? (w > 0.3 ? p.acc[0] : BRAND) : css(p.line, 0.2);
      rrect(g, bx + q * bwk + 3, base - Math.max(2, h), bwk - 6, Math.max(2, h), 4); g.fill();
      g.font = fonts(16, 'MIN', 'J'); g.fillStyle = q === cur ? p.acc[0] : p.gray; g.textAlign = 'center'; g.fillText(toks[q].c, bx + q * bwk + bwk / 2, base + 20); g.textAlign = 'left';
    }
    g.font = fonts(14, 'ZENB'); g.fillStyle = p.gray; g.fillText('softmax', bx, cc.y + 10);
  }));
}

export function l23(ctx, S) { return l23r9(ctx, S); }
// L22 → L23 转场用：示波器屏幕中心在屏幕上的位置（心从这里长出来）
export const scopeCenter = () => ({ x: 960 + (960 - 960) * 1.02, y: 540 + (90 + 320 + 10 - 540) * 1.02 });

// ================================================================ L24 · C4 御姐版 · 我的心在摇晃（64–65）
// 整句歌词（明朝大字）被横向撕裂：画面先画进缓冲，再按行错位、色差；「深度思考中…」胶囊一闪一闪；
// 越到后面撕得越碎，最后一拍崩成碎片（shards 转场进采样风暴）
const L24_0 = () => cutAt(64), L24_1 = barStart(66), B64 = barStart(64);
// 第九轮（用户：1:41 的故障效果不好看、整个画面很乱，大幅减弱；减弱后冲击力不够，补别的动效）。rev l24
// 去掉整屏的横向撕裂；只有歌词那一行在拍头有一下很轻的色差（元素层，R4）。补的动效都在讲"摇晃"：
// 歌词每个字唱到时像挂在弹簧上一样摆几下、之后随两拍一个周期轻轻晃；右下「下一个字」卡里两个候选的概率来回摆、指针像节拍器；
// 左下心电图越来越不规则、心率往上走；「深度思考中…」胶囊照旧
const cam24 = t => ({ x: 0, y: 0, zoom: 1.03, rot: 0.012 * Math.sin(t * Math.PI * 0.75) * (0.5 + (t - L24_0()) / (L24_1 - L24_0())) });
// 第十五轮：DeepSeek 窗口此刻在屏幕上的样子（L24 → ComfyUI 的 winMorph 用）
export function win24(S) {
  const c = cam24(S.t), [x0, y0] = camToScreen(c, 1, 240, 160), [x1, y1] = camToScreen(c, 1, 1680, 160), [x2, y2] = camToScreen(c, 1, 240, 920), [x3, y3] = camToScreen(c, 1, 1680, 920);
  return { cx: (x0 + x3) / 2, cy: (y0 + y3) / 2, w: Math.hypot(x1 - x0, y1 - y0), h: Math.hypot(x2 - x0, y2 - y0), rot: Math.atan2(y1 - y0, x1 - x0), r: 18 * c.zoom, edge: S.pal.winEdge };
}
function l24r9(ctx, S) {
  const p = S.pal, t = S.t, u = (t - L24_0()) / (L24_1 - L24_0());
  const cam = cam24(t);
  paper(ctx, S, cam);
  backDeco(ctx, S, cam, 240, { alpha: 0.45, density: 0.9 });
  withCam(ctx, cam, 1, g => {
    g.lineWidth = 1.5; g.strokeStyle = p.winEdge; g.fillStyle = '#FFFFFF'; rrect(g, 240, 160, 1440, 760, 18); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(240, 212); g.lineTo(1680, 212); g.stroke();
    g.font = fonts(20, 'SCB'); g.fillStyle = p.text; g.fillText('DeepSeek', 300, 194);
    g.font = fonts(20, 'KAI', 'SC'); g.fillStyle = css(p.gray, 0.8);
    const TH = ['（心跳 150 BPM，正常）', '（等等，它在晃）', '（是量子的风吗）', '（不对，是你）', '（Wait.）', '（再想一下——）'];
    for (let i = 0; i < 6; i++) { const n = Math.floor((t - B64) / BEAT) + i, sl = clamp((t - B64 - (n - i) * BEAT) / 0.15); g.fillText(TH[n % TH.length], 300, 260 + i * 34 - 34 * (1 - sl)); }
    g.strokeStyle = css(p.line, 0.5); g.beginPath(); g.moveTo(286, 240); g.lineTo(286, 450); g.stroke();
    hudCluster(g, S, 241, 1260, 230, 380, 220, { density: 0.7, alpha: 0.8 });
    // 歌词：每个字挂在弹簧上
    const chars = lyric('L24').chars, sway = i => 0.035 * Math.sin(Math.PI * S.n + i * 0.7) * (0.6 + u);
    const place = (i, age) => {
      if (age < 0) return null;
      const sp = Math.exp(-age * 2.6), e = easeOut(clamp(age / 0.12));
      return { r: 0.22 * Math.sin(age * 11) * sp + sway(i), dy: -26 * Math.sin(age * 11) * sp, s: 0.6 + 0.4 * e, a: e };
    };
    const kick = decay(S.sub * BEAT, 10) * (S.beat % 2 ? 1 : 0.5) * (0.4 + 0.6 * u);
    const lk = ['MIN0', 'J'], ls = 102; // 第十三轮：大歌词换回明朝体（MIN0 不被 pixfont 换成像素字）；明朝体比像素字宽，字号收一点，整句不出窗口
    if (kick > 0.05) { // 拍头一下很轻的色差（只在这一行）
      g.save(); g.globalAlpha = 0.35 * kick;
      bigLine(g, S, chars, 960 - 8 * kick, 520, { size: ls, keys: lk, color: '#FF4D9D', stroke: 0, place });
      bigLine(g, S, chars, 960 + 8 * kick, 520, { size: ls, keys: lk, color: '#3FC6E8', stroke: 0, place });
      g.restore();
    }
    // 第十五轮（用户：歌词文字出现时先短暂蓝色再变回深色）：每个字出现的前 0.1 s 是品牌蓝，0.3 s 回到深色
    const placeInk = (i, age) => { const q = place(i, age); return q && { ...q, color: inkFlash(age, p.text) }; };
    bigLine(g, S, chars, 960, 520, { size: ls, keys: lk, color: p.text, stroke: 0, place: placeInk });
    // 「深度思考中…」
    const on = Math.floor(t / 0.4) % 2 === 0; // 闪得慢一点
    g.font = fonts(36, 'SC'); const s = `深度思考中${'.'.repeat(1 + (Math.floor(t * 5) % 3))}`;
    g.fillStyle = on ? BRAND : p.tint[3]; rrect(g, 760, 690, 400, 70, 35); g.fill();
    g.fillStyle = on ? '#FFFFFF' : BRAND; g.fillText(s, 800, 738);
    // 左下：心电图越来越乱，心率往上走
    const bpm = Math.round(150 + 22 * u + 6 * Math.sin(t * 7) * u);
    drawSprite(g, 'heart', 4, p, 316, 830, 1 + 0.25 * decay((S.n % 1) * BEAT * (1 + 0.6 * u), 9));
    g.font = fonts(26, 'ZENB'); g.fillStyle = p.acc[0]; g.fillText(`${bpm} BPM`, 350, 840);
    g.strokeStyle = BRAND; g.lineWidth = 3; g.lineJoin = 'round'; g.beginPath();
    for (let k = 0; k <= 120; k++) {
      const x = 300 + k * 4, ph = (t * (1.25 + 0.5 * u) - k * 0.012) % 1, jit = vnoise(k * 0.4, t * 3, 5) - 0.5;
      const yv = (ph < 0.06 ? -60 * Math.sin((ph / 0.06) * Math.PI) : ph < 0.1 ? 22 * Math.sin(((ph - 0.06) / 0.04) * Math.PI) : 0) + jit * 30 * u;
      k ? g.lineTo(x, 890 + yv) : g.moveTo(x, 890 + yv);
    }
    g.stroke();
    // 右下：下一个字——两个候选来回摆（像节拍器）
    const kz = keyword('L23', 6, 7)[0].c, swing = Math.sin(t * Math.PI * 1.25) * (0.5 + 0.5 * u), pa = 0.5 + 0.42 * swing, cx0 = 1240, cy0 = 640;
    card(g, S, cx0, cy0, 400, 250, { title: 'next token', lw: 1.5, inner: false, age: t - L24_0() - 0.2 }, cc => {
      [[ '你', pa, p.acc[0]], [kz, 1 - pa, BRAND]].forEach(([c, v, col], i) => {
        const y = cc.y + 30 + i * 62;
        g.font = fonts(34, 'MIN', 'J', 'SC'); g.fillStyle = col; g.fillText(c, cc.x, y + 12);
        g.fillStyle = p.tint[3]; rrect(g, cc.x + 50, y - 12, 220, 24, 12); g.fill();
        g.fillStyle = col; rrect(g, cc.x + 50, y - 12, 220 * v, 24, 12); g.fill();
        g.font = fonts(20, 'ZENB'); g.fillStyle = p.text; g.fillText(v.toFixed(2), cc.x + 284, y + 8);
      });
      const px = cc.x + cc.w / 2 - 20, py = cc.y + cc.h - 4, ang = -Math.PI / 2 + swing * 0.7;
      g.strokeStyle = css(p.line, 0.4); g.lineWidth = 1; g.beginPath(); g.arc(px, py, 70, -Math.PI / 2 - 0.8, -Math.PI / 2 + 0.8); g.stroke();
      g.strokeStyle = p.text; g.lineWidth = 3; g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(ang) * 70, py + Math.sin(ang) * 70); g.stroke();
      g.fillStyle = p.acc[0]; g.beginPath(); g.arc(px + Math.cos(ang) * 70, py + Math.sin(ang) * 70, 7, 0, Math.PI * 2); g.fill();
    });
  });
  frontDeco(ctx, S, cam, 241, { alpha: 0.4, items: [['ring', -60, 140, 240], ['hex', 1760, 960, 24]] });
  hud(ctx, S, { spectrum: false });
}

export function l24(ctx, S) { return l24r9(ctx, S); }
