// 间奏二 · 第十七张（74–89 小节，1:56.87–2:22.47）。第十五轮实现（那一版 interlude2_r15.js 第二十一轮删了，快照里有），第十六轮按用户意见改（interlude2_r16.js），
// 第十七轮再改（第十六轮版 interlude2_r16.js 第二十轮删了，快照里有）：
//   界面全部深色（节点外面的画布也是深色），四周窗口缩小、变淡；画面整体放大、不再被标题栏压住头；结构线去掉；
//   78–80 提示词到画面的连线变成几十根直线（像 1:00 的路由），「提示词 → 画面」卡里的日志像电影里的黑客终端一样狂滚；
//   81 九宫格推进中间那格时 KSampler 的外框、四周窗口一起退出去，82 起全屏（只留顶部的进度条）；
//   83–88 换图换回第十五轮的扫描线；85「才不是大肥鱼！」换回第十五轮字符画里的蒙版样式（停 0.8 s）；88 第 15 步所有效果一起合回她身上
// 第十八轮（rev ia18）：88 九种效果合在一起那一下直接是彩色原画（不再经过本色那一版），89 接着放原画
// 一句话：ComfyUI 那段批量出的 16 张图显存炸了；这一段她不靠显卡、用自己把第 17 张画完——整段是一次去噪采样，16 个小节 = 16 步。
// 第十六轮（用户：视觉形式很好，但不读方案看不出"她自己在画"；左上角的 K 采样器去掉，整个窗口就是一个完整的 K 采样器；四周加窗口和动画说明含义）：
//   整个画面 = 一个正在执行的 KSampler 节点：绿色执行边框、标题栏（步数、σ、进度条）、左边四个输入口、右边 LATENT 输出口、底下一排参数；
//   中间是这个节点正在画的画（她的舞）。四周的小窗口讲清楚在干什么：
//     左上 提示词（正向 / 负向，画到哪个词就点亮哪个词、拉一根线到画面里对应的地方）
//     左中 队列：前 16 张全是 CUDA out of memory，第 17 张在跑，device 是「她自己」
//     左下 每个乐章的说明卡（前向加噪、Euler 一步、ControlNet 条件图……）
//     右上 控制台（tqdm 进度行）  右中 σ 日程（normal，不加 shift，线性从 1 降到 0）  右下 方形的潜空间预览（x_σ = (1−σ)x₀ + σε，越往后越清楚）
//   最后一小节：第 16 步在第 1 拍走完 → VAE Decode → 整个节点变成 Save Image，中间就是解码出来的她（视频原画，不再跳成静态图），四周是这张图的信息
// 舞是两段视频（V9 74–80、V10 81–89，首尾帧接成一支舞）：scripts/video_maps.mjs 出剪影和颜色分区图，core/segmaps.js 由它算预处理图和矢量线稿；
// 88 撞上以后和最后一小节的原画是 scripts/video_frames.mjs 抽的 V10 11.9–14.45 s（core/frames.js；第十八轮以前是 13.1 起）
//   Ⅰ 噪声 74–77：噪点里她是一块纯色（边缘被噪点啃着，越往后越干净）→ 速度场的小箭头 → 等高线和身体里的结构线 → Euler 一步
//   Ⅱ 长出海 78–80：代码从她心口长满 → 漫成海（倒影、像素鲸鱼）→ 代码翅膀
//   Ⅲ 对舞 81–87：九宫格 → 深度 / 边缘 / 半调网点 / 字符画 / 分区 / 线稿和代码组成的她对舞；每次换图各用一种过渡（第十六轮：不再都是从上往下的扫描线）
//   Ⅳ 88–89：九种效果合成彩色原画（第十八轮以前先是本色上色、89 再解码成原画）→ Save Image「ComfyUI_00017_.png」
import { W, H, CW, CH, COLS, ROWS, BRAND, BEAT, BAR, STEP } from '../core/const.js';
import { barStart, beatTime, clamp, lerp, smooth, easeIn, easeOut, easeOutBack, decay } from '../core/time.js';
import { hash, rnd, vnoise } from '../core/rand.js';
import { fonts, glyphs, midText } from '../core/glyphs.js';
import { pooled } from '../core/cam.js';
import { drawFormula } from '../core/math.js';
import { drawSprite } from '../core/sprites.js';
import { css, mix } from '../core/color.js';
import { rrect } from '../core/ui.js';
import { hud } from '../core/hud.js';
import { decode } from '../core/text.js';
import { maskFrame } from '../core/masks.js';
import { hasSeg, segIndex, segLabels, segDist, sdAt, segCanvas, segBox, segContours, segShade, CEL_PAL } from '../core/segmaps.js';
import { vidFrame, framesInfo } from '../core/frames.js';
import { UI, WIRE, batchImage } from './comfy_lib.js';
import { ditheredRadial } from '../core/dither.js';

const T74 = barStart(74), T81 = barStart(81), T88 = barStart(88), T89 = barStart(89), T90 = barStart(90);
const T_DONE = T89 + BEAT, T_VAE = beatTime(89, 2), T_SAVE = beatTime(89, 3);
const INK = '#141A3A', PAPER = '#F5F8FF', LB = '#9DB4FF', CYAN = '#7FF3FF', DEEP = '#0B0F24', NAVY = '#101850', PINK = '#FF6FAE', GREEN = '#3DDC84', RED = '#E5484D';
// 第十七轮（用户：深色背景和浅色 UI 太割裂，UI 也改深色）：节点、窗口、标签全部用这一套深色半透明
const DK = {
  canvas: '#070A1C', bg: 'rgba(12,16,42,0.74)', head: 'rgba(30,38,86,0.55)', title: 'rgba(16,21,52,0.9)', pill: 'rgba(16,21,52,0.86)',
  edge: 'rgba(110,128,216,0.32)', text: '#BFC8EC', dim: '#7480B0', bright: '#E4E9FF', title2: '#AEBBF0',
};
// 画面本身是浅色的时候（84 半调、85 字符、87 对舞、88 本色、89 成品图）界面跟着变浅——深色界面压在浅色画面上同样割裂
const LT = {
  bg: 'rgba(255,255,255,0.86)', head: 'rgba(232,236,246,0.92)', pill: 'rgba(255,255,255,0.9)',
  edge: 'rgba(140,150,180,0.55)', text: '#2A2E3A', dim: '#7C829C', bright: '#1D2541', title2: '#2A2E3A',
};
const SP9 = 361 / 24 / (T81 - T74); // V9 15.04 s 放进 74–80 七个小节（约 ×1.34）
// σ（第十六轮，用户：K 采样器里不加 shift）：normal 日程，σ 从 1 线性降到 0。第 1–15 步每小节一步；第 16 步压在 89 小节第 1 拍里（之后是解码和保存）
const sigAt = t => (t < T89 ? 1 - clamp((t - T74) / (16 * BAR)) : Math.max(0, (1 - (t - T89) / BEAT) / 16));
const stepAt = t => clamp(Math.floor((t - T74) / BAR) + 1, 1, 16);
const doneAt = t => (t < T89 ? clamp((t - T74) / BAR, 0, 15) : 15 + clamp((t - T89) / BEAT)); // 已走完的步数（连续）
// V10 一直放到 90 小节：89 小节正好是视频 12.8–14.4 s，她转完圈、双手放下，站定成 I01 的姿势（V10 的尾帧就是 I01）
const frameAt = t => (t < T81 ? { id: 'V9', k: segIndex('V9', t, T74, SP9) } : { id: 'V10', k: segIndex('V10', Math.min(t, T90 - 0.01), T81, 1) });

// ---------------------------------------------------------------- 视频画面 ↔ 屏幕
// V = { z, cx, cy }：视频的 (cx, cy)（0..1）放在屏幕正中，整幅视频宽 = 1920·z。
// 第十六轮：她要放在标题栏（到 y 120）和底下参数行（从 y 990）之间——她在视频里占 0.06–0.95 的高，所以 0.9 倍、往上挪一点
// 第十七轮（用户：剪影的上下像被裁掉了一点 / 被标题栏挡住，没有之前舒服）：是被标题栏压住了头。外框贴到画面边上（HUD 在这一段淡出），
// 标题栏 34 px、参数行 26 px，中间留出 48–1024；她放大到 0.92、正中，上下各留约 45 px
const VM = { z: 0.92, cx: 0.5, cy: 0.505 };
// 82 起全屏（V10 里她占 0.08–0.96 的高）：1 倍、往下一点，顶上的进度条不压她的头；81 九宫格每格也按它画（推进去正好接上）
const VF = { z: 1.0, cx: 0.5, cy: 0.52 };
const vx = (V, u) => 960 + (u - V.cx) * W * V.z, vy = (V, v) => 540 + (v - V.cy) * H * V.z;
const uOf = (V, X) => V.cx + (X - 960) / (W * V.z), vOf = (V, Y) => V.cy + (Y - 540) / (H * V.z);
function drawVid(ctx, cv, V, { alpha = 1, smooth: sm = true, dx = 0, flip = false } = {}) {
  ctx.save(); ctx.globalAlpha *= alpha; ctx.imageSmoothingEnabled = sm;
  if (flip) { ctx.translate(2 * (960 + dx), 0); ctx.scale(-1, 1); }
  ctx.drawImage(cv, vx(V, 0) + dx, vy(V, 0), W * V.z, H * V.z);
  ctx.restore();
}
function solid(cv, color, key) { // 剪影染成一种颜色
  const o = pooled(key, cv.width, cv.height), c = o.getContext('2d');
  c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, o.width, o.height); c.drawImage(cv, 0, 0);
  c.globalCompositeOperation = 'source-in'; c.fillStyle = color; c.fillRect(0, 0, o.width, o.height); c.globalCompositeOperation = 'source-over';
  return o;
}
const labelAt = (F, V, X, Y, dx = 0) => {
  const u = uOf(V, X - dx), v = vOf(V, Y);
  if (u < 0 || v < 0 || u >= 1 || v >= 1) return 0;
  return segLabels(F.id, F.k)[Math.floor(v * 360) * 640 + Math.floor(u * 640)];
};
const hexRGB = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const strokeSegs = (ctx, a) => { ctx.beginPath(); for (let i = 0; i < a.length; i += 4) { ctx.moveTo(a[i], a[i + 1]); ctx.lineTo(a[i + 2], a[i + 3]); } ctx.stroke(); };
// 矢量线稿（第十六轮，用户：线条有点糊）：outer 外轮廓、inner 部位分界线；keep(x, y) 决定某一段画不画（用来做逐渐出现）
function drawLines(ctx, F, V, { dx = 0, flip = false, outer = 3, inner = 1.6, color = BRAND, colorIn = color, alpha = 1, keep = null } = {}) {
  const C = segContours(F.id, F.k), kx = W * V.z, ky = H * V.z, ox = vx(V, 0) + dx, oy = vy(V, 0);
  ctx.save(); ctx.globalAlpha *= alpha; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (flip) { ctx.translate(2 * (960 + dx), 0); ctx.scale(-1, 1); }
  const path = (A, lw, col) => {
    if (lw <= 0) return;
    ctx.beginPath();
    for (let i = 0; i < A.length; i += 4) {
      const x0 = ox + A[i] * kx, y0 = oy + A[i + 1] * ky, x1 = ox + A[i + 2] * kx, y1 = oy + A[i + 3] * ky;
      if (keep && !keep((x0 + x1) / 2, (y0 + y1) / 2, i)) continue;
      ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
    }
    ctx.lineWidth = lw; ctx.strokeStyle = col; ctx.stroke();
  };
  path(C.inner, inner, colorIn); path(C.outer, outer, color);
  ctx.restore();
}
const bodyCenter = (F, V) => { const b = segBox(F.id, F.k); return [vx(V, (b.x0 + b.x1) / 2), vy(V, b.y0 + 0.36 * (b.y1 - b.y0))]; };

// ---------------------------------------------------------------- 噪点
// 240×135 的小图放大 8 倍，每个十六分音符重新掷一次。F 给了的话：她身体里不画噪点，只在贴着轮廓的一圈（band px）里由外往里越来越稀地啃进去
function noiseCells(ctx, S, F, V, { dens = 0.55, cols = [BRAND, LB, '#2A3770'], band = 0, alpha = 1 } = {}) {
  const w = 240, h = 135, cv = pooled('j2noise', w, h), c = cv.getContext('2d'), im = c.createImageData(w, h), d = im.data;
  const kq = Math.floor(S.t / STEP), rgb = cols.map(hexRGB), D = F ? segDist(F.id, F.k) : null, kpx = (W * V.z) / 320;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let p = dens;
    if (D) {
      const u = uOf(V, x * 8 + 4), v = vOf(V, y * 8 + 4), sd = u < 0 || u >= 1 || v < 0 || v >= 1 ? -99 : sdAt(D, u, v) * kpx;
      if (sd > 0) { if (sd >= band) continue; p = dens * (1 - sd / band) ** 1.5; }
    }
    const hv = hash(x, y, kq, 5);
    if (hv % 1000 < p * 1000) { const o = (y * w + x) * 4, q = rgb[hv % rgb.length]; d[o] = q[0]; d[o + 1] = q[1]; d[o + 2] = q[2]; d[o + 3] = 255; }
  }
  c.putImageData(im, 0, 0);
  ctx.save(); ctx.globalAlpha *= alpha; ctx.imageSmoothingEnabled = false; ctx.drawImage(cv, 0, 0, W, H); ctx.restore();
}
// 第十六轮（用户：背景和人物不要同时都是马赛克，把身体改成纯色）：她是一块平滑的纯色剪影，噪点只在轮廓边上啃——啃进去多深跟着 σ 走（σ² × 70 px）
function bodyFill(ctx, F, V, color, alpha = 1) { drawVid(ctx, solid(maskFrame(F.id, F.k, { fade: 0 }), color, 'j2body'), V, { alpha }); }
// 叠在最上面的颗粒（78 起，越往后越淡）
function grain(ctx, S, onPaper) {
  const a = Math.pow(sigAt(S.t), 4) * 0.16;
  if (a > 0.01) noiseCells(ctx, S, null, VM, { dens: 0.22, cols: onPaper ? [INK, '#4A5170', BRAND] : [LB, '#FFFFFF', BRAND], alpha: a });
}

// ---------------------------------------------------------------- Ⅰ 噪声 74–77
const BODY = '#C9D4FF';
// 第二十四轮（用户：1:56 最开始的画面给人物平滑的边缘增加动态马赛克，直到下一个效果很多箭头朝向人物的时候再逐渐将马赛克改细，
// 直到出现当前状态的平滑边缘）（第二十六轮并开关 i2m24）
// 剪影按屏幕上 c px 一格取样（格子里她占多少），边上那圈半格半空的格子每个十六分音符重新掷一次亮不亮（动态），身体里的格子一直亮。
// 74 小节 20 px 一格；75 小节箭头出来以后每个八分音符缩一档（20 → 16 → 13 → 10 → 8 → 6 → 4 → 3），闪得也越来越少；76 小节回到平滑的边
const MOS24 = [20, 16, 13, 10, 8, 6, 4, 3];
function mosaicCell24(t) {
  if (t < barStart(75)) return 20;
  const k = Math.floor((t - barStart(75)) / (BEAT / 2));
  return k < MOS24.length ? MOS24[k] : 0;
}
function bodyMosaic24(ctx, S, F, V, color, alpha, c) {
  const gw = Math.ceil(W / c), gh = Math.ceil(H / c), cv = pooled(`j2mos${c}`, gw, gh), g = cv.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, gw, gh); g.imageSmoothingEnabled = true;
  g.drawImage(maskFrame(F.id, F.k, { fade: 0 }), vx(V, 0) / c, vy(V, 0) / c, (W * V.z) / c, (H * V.z) / c);
  const im = g.getImageData(0, 0, gw, gh), d = im.data, kq = Math.floor(S.t / STEP), [r, gg, b] = hexRGB(color), flick = 0.3 + 0.6 * clamp((c - 3) / 17);
  for (let i = 0; i < gw * gh; i++) {
    const a = d[i * 4 + 3] / 255;
    d[i * 4] = r; d[i * 4 + 1] = gg; d[i * 4 + 2] = b;
    d[i * 4 + 3] = a > 0.02 && a > 0.5 + flick * (rnd(i, kq, 2401) - 0.5) ? 255 : 0;
  }
  g.putImageData(im, 0, 0);
  ctx.save(); ctx.globalAlpha *= alpha; ctx.imageSmoothingEnabled = false; ctx.drawImage(cv, 0, 0, gw * c, gh * c); ctx.restore();
}
function bodyEdge24(ctx, S, F, V, color, alpha = 1) { const c = mosaicCell24(S.t); if (c) bodyMosaic24(ctx, S, F, V, color, alpha, c); else bodyFill(ctx, F, V, color, alpha); }
function art74(ctx, S, F) {
  const u = clamp((S.t - T74) / BAR);
  ctx.fillStyle = INK; ctx.fillRect(0, 0, W, H);
  bodyEdge24(ctx, S, F, VM, BODY, smooth(clamp((S.t - T74 + 0.25) / 0.5)));
  noiseCells(ctx, S, F, VM, { dens: lerp(0.62, 0.5, u), band: 70 * sigAt(S.t) ** 2 + 8 });
}
// 速度场：96×54 个小箭头，每个指向"去噪的方向"——距离场的梯度，从四面八方指向她的轮廓；每拍从她身上荡出一圈亮
function arrows(ctx, S, F, V, { alpha = 1, len = 15, gather = 0 } = {}) {
  if (alpha <= 0.01) return;
  const D = segDist(F.id, F.k), k = (W * V.z) / 320, [ccx, ccy] = bodyCenter(F, V), ring = S.sub * BEAT * 2400, e = 1 / 320;
  const paths = [[], [], []];
  for (let r = 0; r < 54; r++) for (let q = 0; q < 96; q++) {
    const X = q * 20 + 10, Y = r * 20 + 10, u = uOf(V, X), v = vOf(V, Y), sd = sdAt(D, u, v) * k;
    if (sd > -6) continue;
    const gx = sdAt(D, u + e, v) - sdAt(D, u - e, v), gy = sdAt(D, u, v + e) - sdAt(D, u, v - e), gl = Math.hypot(gx, gy) || 1;
    const dx = gx / gl, dy = gy / gl, near = clamp(1 + sd / 900), L = len * (0.45 + 0.55 * near) * (1 - 0.6 * gather);
    const x0 = X + dx * gather * Math.min(-sd, 60), y0 = Y + dy * gather * Math.min(-sd, 60);
    const hot = Math.abs(Math.hypot(X - ccx, Y - ccy) - ring) < 70 ? 2 : near > 0.75 ? 1 : 0, x1 = x0 + dx * L, y1 = y0 + dy * L;
    paths[hot].push(x0 - dx * L * 0.5, y0 - dy * L * 0.5, x1, y1, x1 - dx * 5 - dy * 3.5, y1 - dy * 5 + dx * 3.5, x1, y1, x1 - dx * 5 + dy * 3.5, y1 - dy * 5 - dx * 3.5, x1, y1);
  }
  ctx.save(); ctx.lineCap = 'round'; ctx.lineWidth = 1.6;
  [css('#5C6FB8', 0.75 * alpha), css(LB, 0.95 * alpha), css('#FFFFFF', alpha)].forEach((c, i) => { ctx.strokeStyle = c; strokeSegs(ctx, paths[i]); });
  ctx.restore();
}
// 等高线：距离场在她外面画几圈等值线（marching squares，12 px 一格）
function contours(ctx, S, F, V, levels, { color = LB, alpha = 1, lw = 1.6 } = {}) {
  const D = segDist(F.id, F.k), k = (W * V.z) / 320, cs = 12, nx = W / cs + 1, ny = H / cs + 1, g = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) g[j * nx + i] = sdAt(D, uOf(V, i * cs), vOf(V, j * cs)) * k;
  levels.forEach((lv, li) => {
    const P = [];
    for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const a = g[j * nx + i] - lv, b = g[j * nx + i + 1] - lv, c = g[(j + 1) * nx + i + 1] - lv, d = g[(j + 1) * nx + i] - lv, pts = [], x = i * cs, y = j * cs;
      if ((a > 0) !== (b > 0)) pts.push([x + cs * (a / (a - b)), y]);
      if ((b > 0) !== (c > 0)) pts.push([x + cs, y + cs * (b / (b - c))]);
      if ((d > 0) !== (c > 0)) pts.push([x + cs * (d / (d - c)), y + cs]);
      if ((a > 0) !== (d > 0)) pts.push([x, y + cs * (a / (a - d))]);
      for (let p = 0; p + 1 < pts.length; p += 2) P.push(pts[p][0], pts[p][1], pts[p + 1][0], pts[p + 1][1]);
    }
    ctx.save(); ctx.strokeStyle = css(color, alpha * (1 - li * 0.11)); ctx.lineWidth = lw; strokeSegs(ctx, P); ctx.restore();
  });
}
function art75(ctx, S, F) {
  ctx.fillStyle = INK; ctx.fillRect(0, 0, W, H);
  bodyEdge24(ctx, S, F, VM, BODY);
  noiseCells(ctx, S, F, VM, { dens: 0.3, cols: ['#2A3770', '#3A4A8C', BRAND], band: 70 * sigAt(S.t) ** 2 + 6 });
  arrows(ctx, S, F, VM, { len: 10 + 8 * sigAt(S.t) });
}
// 第十七轮（用户：step3 等步数人物内部的线去掉，之前指的是像 bug）：第十六轮加的结构线（身体里的部位分界）删掉，身体还是一块纯色
function art76(ctx, S, F) {
  const u = (S.t - barStart(76)) / BAR, br = 8 * Math.sin(2 * Math.PI * ((S.t - T74) / (2 * BEAT)));
  ctx.fillStyle = INK; ctx.fillRect(0, 0, W, H);
  bodyFill(ctx, F, VM, BODY);
  noiseCells(ctx, S, F, VM, { dens: 0.18, cols: ['#2A3770', '#3A4A8C'], band: 70 * sigAt(S.t) ** 2 + 4 });
  arrows(ctx, S, F, VM, { len: 14, alpha: 1 - smooth(clamp(u / 0.5)) });
  contours(ctx, S, F, VM, [-16, -40, -70, -108, -152, -204].map(l => l + br), { alpha: smooth(clamp(u / 0.3)) });
}
function art77(ctx, S, F) {
  const u = (S.t - barStart(77)) / BAR, inv = S.beat >= 3; // 第 3 拍里外反相一次
  ctx.fillStyle = inv ? PAPER : INK; ctx.fillRect(0, 0, W, H);
  bodyFill(ctx, F, VM, inv ? '#2A3770' : BODY);
  noiseCells(ctx, S, F, VM, { dens: 0.12, cols: inv ? ['#C9D4FF', '#AEB8DC'] : ['#2A3770', '#3A4A8C'], band: 70 * sigAt(S.t) ** 2 + 3 });
  const shrink = 1 - 0.85 * easeIn(clamp(u / 0.9));
  contours(ctx, S, F, VM, [-16, -40, -70, -108, -152, -204].map(l => l * shrink - 2), { color: inv ? BRAND : LB });
  arrows(ctx, S, F, VM, { len: 12, gather: easeIn(clamp((u - 0.4) / 0.6)), alpha: smooth(clamp((u - 0.35) / 0.2)) });
}

// ---------------------------------------------------------------- Ⅱ 长出海 78–80
const CODE = 'while (you) { stay(); } heart.beat(150); listen(you); return "嗯"; remember(you); if (you) return; wait(); sing(); ';
const CODE_N = [...CODE].length;
function bodyCells(F, V) { // 字格（160×54）上她占的格子 + 从心口出发的测地距离（只在身体里走的 BFS）
  const n = COLS * ROWS, inside = new Uint8Array(n), dist = new Int16Array(n).fill(-1);
  let sx = 0, cnt = 0, top = ROWS, bot = 0;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (labelAt(F, V, c * CW + CW / 2, r * CH + CH / 2) > 0) { inside[r * COLS + c] = 1; sx += c; cnt++; top = Math.min(top, r); bot = Math.max(bot, r); }
  if (!cnt) return { inside, dist, max: 1, foot: [80, 50], top: 10, bot: 50, cx: 80 };
  const cx = sx / cnt, cy = top + 0.3 * (bot - top);
  let seed = -1, best = 1e9;
  for (let i = 0; i < n; i++) if (inside[i]) { const d = Math.hypot((i % COLS) - cx, (Math.floor(i / COLS) - cy) * 1.6); if (d < best) { best = d; seed = i; } }
  const q = new Int32Array(n); let qh = 0, qt = 0, max = 1;
  dist[seed] = 0; q[qt++] = seed;
  while (qh < qt) {
    const i = q[qh++], c = i % COLS;
    for (const j of [c > 0 ? i - 1 : -1, c < COLS - 1 ? i + 1 : -1, i - COLS, i + COLS]) if (j >= 0 && j < n && inside[j] && dist[j] < 0) { dist[j] = dist[i] + 1; max = Math.max(max, dist[j]); q[qt++] = j; }
  }
  let fx = 0, fn = 0; for (let c = 0; c < COLS; c++) if (inside[bot * COLS + c]) { fx += c; fn++; }
  return { inside, dist, max, foot: [fn ? fx / fn : cx, bot], top, bot, cx, chest: [cx, cy] };
}
function codeBody(ctx, S, B, R) {
  const kq = Math.floor(S.t / STEP), dim = glyphs('SC', '#3A4A8C'), a = glyphs('SC', BRAND), b = glyphs('SC', LB), hot = glyphs('SCB', '#FFFFFF'), chars = [...CODE];
  for (let i = 0; i < B.inside.length; i++) {
    if (!B.inside[i]) continue;
    const c = i % COLS, r = (i / COLS) | 0, x = c * CW, y = r * CH, dd = B.dist[i] < 0 ? 1e9 : B.dist[i] + 6 * vnoise(c * 0.25, r * 0.4, 0, 31);
    if (dd > R) { dim.draw(ctx, '·', x, y); continue; }
    const ch = chars[(r * 37 + c + (hash(c, r, kq >> 2) % 7 === 0 ? kq : 0)) % CODE_N];
    (R - dd < 2.2 ? hot : (r + (c >> 3)) % 3 ? a : b).draw(ctx, ch, x, y);
  }
}
function codeSea(ctx, S, B, surf, spread) { // 海面以下（surf 行起），从脚下往两边漫开（spread 格），随底鼓起伏；倒影是她那一格翻下来
  const kq = Math.floor(S.t / STEP), kick = decay(S.sub * BEAT, 8) * (S.beat % 2 ? 0.6 : 1);
  const sets = [glyphs('SC', '#3A4570'), glyphs('SC', '#6E7AA8'), glyphs('SC', BRAND), glyphs('SCB', LB)], rf = glyphs('SC', '#7F92E0'), [fc] = B.foot;
  for (let c = 0; c < COLS; c++) {
    if (Math.abs(c - fc) > spread) continue;
    const s = surf + 0.9 * Math.sin(c * 0.13 + S.t * 2.1) + 0.5 * Math.sin(c * 0.31 - S.t * 3.3) - 0.8 * kick * Math.exp(-Math.abs(c - fc) / 30);
    for (let r = Math.max(0, Math.ceil(s)); r < ROWS; r++) {
      const x = c * CW, y = r * CH;
      ctx.fillStyle = INK; ctx.fillRect(x, y, CW, CH);
      const mr = Math.round(2 * s - r), mi = mr * COLS + c + Math.round(Math.sin(r * 0.9 + S.t * 3));
      if (mr >= 0 && mr < ROWS && B.inside[mi] && hash(c, r, kq) % 3) { rf.draw(ctx, [...CODE][(mr * 37 + c) % CODE_N], x, y); continue; }
      const n = vnoise(c * 0.09, r * 0.25 - S.t * 0.6, S.t * 0.3, 7);
      if (n < 0.38) continue;
      sets[Math.min(3, Math.floor((n - 0.38) * 7))].draw(ctx, 'ｱｲｳｴｵ01.:~'[hash(c, r, kq >> 1) % 10], x, y);
      if (r - s < 1.2) sets[3].draw(ctx, '~', x, y);
    }
  }
}
function wings(ctx, S, B, g, pts = null) { // 代码翅膀：从肩膀两边沿扇形的射线长出代码行（预告第三段 L27 的翅膀）；pts 收集每个字的位置（提示词连线用）
  if (g <= 0) return;
  const kq = Math.floor(S.t / STEP), set = glyphs('SC', LB), hot = glyphs('SCB', '#FFFFFF'), chars = [...CODE];
  const sy = (B.top + 0.24 * (B.bot - B.top)) * CH, sx = B.cx * CW, half = 0.1 * (B.bot - B.top) * CW;
  for (const side of [-1, 1]) for (let i = 0; i < 12; i++) {
    const a = -0.95 + i * 0.13, len = Math.floor((14 - Math.abs(i - 5) * 1.1) * g), x0 = sx + side * half, y0 = sy;
    for (let k = 0; k < len; k++) {
      const d = 26 + k * 22, x = x0 + side * d * Math.cos(a), y = y0 + d * Math.sin(a) - i * 4 + 6 * Math.sin(S.t * 3 + k * 0.4 + i);
      (k === len - 1 ? hot : set).draw(ctx, chars[(i * 11 + k + kq) % CODE_N], x - 6, y - 10);
      if (pts) pts.push([x, y]);
    }
  }
}
// 提示词连线（第十七轮）：这一小节画的那个词 → 画面里它管的那一片，几十个点；别的词也各连几根到它管的部位（cross-attention 的样子）
// ATT = { hot: [[x, y], ...], B, F }
let ATT = null;
const bodyPts = B => { const a = []; for (let i = 0; i < B.inside.length; i++) if (B.inside[i] && B.dist[i] >= 0) a.push([(i % COLS) * CW + CW / 2, ((i / COLS) | 0) * CH + CH / 2]); return a; };
function art78(ctx, S, F) {
  ctx.fillStyle = INK; ctx.fillRect(0, 0, W, H);
  noiseCells(ctx, S, null, VM, { dens: 0.08, cols: ['#2A3770', '#3A4A8C'] });
  const B = bodyCells(F, VM), u = (S.t - barStart(78)) / BAR, R = B.max * 1.08 * easeOut(clamp(u / 0.85));
  codeBody(ctx, S, B, R);
  // 连到已经长出代码的格子
  const hot = []; for (let i = 0; i < B.inside.length; i++) if (B.inside[i] && B.dist[i] >= 0 && B.dist[i] <= R) hot.push([(i % COLS) * CW + CW / 2, ((i / COLS) | 0) * CH + CH / 2]);
  ATT = { hot, B, F };
}
function art79(ctx, S, F) {
  ctx.fillStyle = INK; ctx.fillRect(0, 0, W, H);
  noiseCells(ctx, S, null, VM, { dens: 0.06, cols: ['#2A3770', '#3A4A8C'] });
  const B = bodyCells(F, VM), u = (S.t - barStart(79)) / BAR;
  codeBody(ctx, S, B, Infinity);
  const surf = lerp(B.bot + 1, 44, easeOut(clamp(u / 0.5))), spread = 6 + 100 * easeOut(clamp(u / 0.7));
  codeSea(ctx, S, B, surf, spread);
  const wx = lerp(2200, -400, u), wy = 960 + 16 * Math.sin(S.t * 2.4); // 像素鲸鱼从海里游过
  drawSprite(ctx, 'whale', 9, S.pal, wx, wy, 1, clamp(u / 0.15));
  // 连到海面以下的格子（漫开的范围里）+ 鲸鱼
  const hot = [], [fc] = B.foot;
  for (let k = 0; k < 160; k++) { const c = Math.round(fc + (rnd(k, 79) * 2 - 1) * spread), r = Math.ceil(surf) + 1 + Math.floor(rnd(k, 80) * (ROWS - surf - 1)); if (c >= 0 && c < COLS && r < ROWS) hot.push([c * CW + CW / 2, r * CH + CH / 2]); }
  if (wx > 40 && wx < W - 40) for (let k = 0; k < 6; k++) hot.push([wx - 60 + k * 24, wy + ((k % 3) - 1) * 14]);
  ATT = { hot, B, F };
}
function art80(ctx, S, F) {
  ctx.fillStyle = INK; ctx.fillRect(0, 0, W, H);
  noiseCells(ctx, S, null, VM, { dens: 0.05, cols: ['#2A3770', '#3A4A8C'] });
  const B = bodyCells(F, VM), u = (S.t - barStart(80)) / BAR, hot = [];
  wings(ctx, S, B, easeOut(clamp(u / 0.8)), hot);
  codeBody(ctx, S, B, Infinity);
  codeSea(ctx, S, B, lerp(44, 30, smooth(u)), 200);
  ATT = { hot, B, F };
}

// ---------------------------------------------------------------- Ⅲ 对舞：预处理图
// 一种图画满全屏（V 决定她在哪、多大）。第十六轮：边缘图换成深蓝底 + 青线（用户：黑白线稿换个配色）；法线图（像 UV 烘焙）换成半调网点；
// 线稿是矢量线、换成浅蓝纸 + 品牌蓝线；新增 cel（本色平涂）和 real（视频原画）
const BG = { depth: DEEP, canny: NAVY, halftone: '#F3F6FF', ascii: PAPER, seg: '#1C2350', lineart: '#EAF0FF', cel: '#F4F7FF', mask: '#000000', normal: '#8080FF', pixel: '#E8ECFA' };
const TITLE = { depth: 'depth', canny: 'canny', halftone: 'halftone', ascii: 'ascii', seg: 'seg · SAM', lineart: 'lineart', mask: 'mask', normal: 'normal', pixel: 'pixel · 64×36', cel: 'color', duet: 'lineart × code' };
function floorShadow(ctx, F, V, col, a, dx = 0) {
  const b = segBox(F.id, F.k), fy = vy(V, b.y1), fx = vx(V, (b.x0 + b.x1) / 2) + dx, g = ctx.createRadialGradient(fx, fy, 10, fx, fy, 360 * V.z);
  g.addColorStop(0, css(col, a)); g.addColorStop(1, css(col, 0));
  ctx.save(); ctx.translate(fx, fy); ctx.scale(1, 0.16); ctx.translate(-fx, -fy); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(fx, fy, 360 * V.z, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}
// 半调网点（第十六轮，用户：法线图像 UV 烘焙的深度贴图，不好看，换成 halftone）：像双色孔版印刷——品牌蓝一层（15°）、粉一层（75°），
// 网点大小 = 这一点的"墨量"：部位决定底色深浅，再按法线的明暗加深暗面；两层用正片叠底，交叠的地方发紫。grow(x, y, i) 让网点逐个长出来
const TONE_B = [0, 0.46, 0.92, 0.07, 0.04, 1], TONE_P = [0, 0.2, 0.12, 0.05, 0.36, 0.18];
function halftone(ctx, S, F, V, { dx = 0, grow = null, alpha = 1, pitch = 11 } = {}) {
  const L = segLabels(F.id, F.k), b = segBox(F.id, F.k), X0 = vx(V, b.x0) + dx - 20, X1 = vx(V, b.x1) + dx + 20, Y0 = vy(V, b.y0) - 20, Y1 = vy(V, b.y1) + 20;
  const cx = (X0 + X1) / 2, cy = (Y0 + Y1) / 2, R = Math.hypot(X1 - X0, Y1 - Y0) / 2;
  ctx.save(); ctx.globalAlpha *= alpha;
  [[BRAND, 0.26, TONE_B, 0.42], [PINK, 1.31, TONE_P, 0]].forEach(([col, ang, T, dark], s) => {
    const ca = Math.cos(ang), sa = Math.sin(ang), n = Math.ceil(R / pitch);
    // 每颗点单独 fill：@napi-rs/canvas 里几千个 arc 拼成一条路径再 fill 要几十秒（实测 1.2 万个 30 s），单独填只要几十毫秒
    ctx.globalCompositeOperation = s ? 'multiply' : 'source-over'; ctx.fillStyle = col;
    for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) {
      const X = cx + (i * ca - j * sa) * pitch, Y = cy + (i * sa + j * ca) * pitch;
      if (X < X0 || X > X1 || Y < Y0 || Y > Y1) continue;
      const u = uOf(V, X - dx), v = vOf(V, Y);
      if (u < 0 || v < 0 || u >= 1 || v >= 1) continue;
      const l = L[Math.floor(v * 360) * 640 + Math.floor(u * 640)];
      if (!l) continue;
      const sh = segShade(F.id, F.k, u, v), tone = clamp(T[l] + dark * (0.55 - sh)), g = grow ? grow(X, Y, i * 131 + j * 7 + s) : 1;
      const r = pitch * 0.62 * Math.sqrt(tone) * g;
      if (r < 0.6) continue;
      ctx.beginPath(); ctx.arc(X, Y, r, 0, Math.PI * 2); ctx.fill();
    }
  });
  ctx.restore();
}
// 字符画（第十六轮，用户：代码组成的剪影非常好看，别处稍微换个效果继续用）：kind 'ramp' 按部位给字（85），'bin' 是 0 / 1 和代码（87 对舞的另一个她）
function ascii(ctx, S, F, V, { dx = 0, flip = false, mode = 'ramp', alpha = 1, show = null } = {}) {
  const L = segLabels(F.id, F.k), D = segDist(F.id, F.k), chars = [...CODE], kq = Math.floor(S.t / STEP);
  const setsR = [glyphs('SCB', '#6F7AA8'), glyphs('SCB', BRAND), glyphs('SCB', INK)], setsB = [glyphs('SCB', LB), glyphs('SCB', BRAND), glyphs('SCB', PINK)], hot = glyphs('SCB', '#FFFFFF');
  const meme = mode === 'ramp' && !flip ? memeMask(S) : null, pinkM = glyphs('SCB', '#FF4D9D');
  ctx.save(); ctx.globalAlpha *= alpha;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (meme && meme(c, r)) { pinkM.draw(ctx, '@#%'[hash(c, r, kq >> 1) % 3], c * CW, r * CH); continue; }
    let X = c * CW + CW / 2; const Y = r * CH + CH / 2;
    if (flip) X = 2 * (960 + dx) - X;
    const u = uOf(V, X - dx), v = vOf(V, Y);
    if (u < 0 || v < 0 || u >= 1 || v >= 1) continue;
    const l = L[Math.floor(v * 360) * 640 + Math.floor(u * 640)];
    if (!l) continue;
    const s = show ? show(c, r) : 1;
    if (s <= 0) continue;
    const edge = sdAt(D, u, v) < 1.2;
    if (s < 1) { hot.draw(ctx, chars[(c * 7 + r * 3 + kq) % CODE_N], c * CW, r * CH); continue; } // 刚换上来的那一下：白字乱跳
    if (mode === 'ramp') {
      const ch = edge ? '*' : ['', '%', '@', '+', '=', '#'][l], set = l === 2 || l === 5 ? setsR[2] : l === 1 ? setsR[1] : setsR[0];
      set.draw(ctx, ch, c * CW, r * CH);
    } else {
      const ch = edge ? ':' : l === 2 || l === 5 ? '01'[hash(c, r, kq >> 2) % 2] : chars[(r * 37 + c) % CODE_N];
      (l === 2 || l === 5 ? setsB[2] : l === 1 ? setsB[1] : setsB[0]).draw(ctx, ch, c * CW, r * CH);
    }
  }
  ctx.restore();
}
// 85 第 3 拍起：「才不是大肥鱼！」（第十六轮，用户：出现时间太短了——0.25 s → 0.8 s）
// 第十七轮（用户：文字效果恢复到之前的样式）：换回第十五轮字符画里的蒙版——整句铺满全宽，蒙版里的格子换成粉色的 @ # %；
// 82 起全屏、没有窗口挡着了。停 0.8 s：前 0.08 s 一行行从上往下亮出来，每个十六分音符整句左右错一格，最后 0.08 s 从上往下收掉
const MEME_T = () => beatTime(85, 3) + 0.04, MEME_D = 0.8;
let MEME_M = null;
function memeMask(S) {
  const a = S.t - MEME_T();
  if (a < 0 || a > MEME_D) return null;
  if (!MEME_M) {
    const cv = pooled('j2meme', COLS, ROWS), c = cv.getContext('2d');
    c.clearRect(0, 0, COLS, ROWS); c.font = fonts(20, 'SMILEY', 'SCB'); c.fillStyle = '#000'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.save(); c.translate(COLS / 2, ROWS / 2); c.scale(1, 0.62); c.fillText('才不是大肥鱼！', 0, 0); c.restore();
    const d = c.getImageData(0, 0, COLS, ROWS).data;
    MEME_M = new Uint8Array(COLS * ROWS); for (let i = 0; i < MEME_M.length; i++) MEME_M[i] = d[i * 4 + 3] > 100 ? 1 : 0;
  }
  const rin = (a / 0.08) * ROWS, rout = ((a - (MEME_D - 0.08)) / 0.08) * ROWS, jig = (hash(Math.floor(S.t / STEP), 3) % 3) - 1;
  return (c, r) => r < rin && r >= rout && c - jig >= 0 && c - jig < COLS && MEME_M[r * COLS + c - jig] === 1;
}
function realFrame(ctx, S, V, alpha = 1) { // 视频原画（只抽了她所在的竖条，外面补视频的底色）
  const img = vidFrame('V10', S.t - T81), m = framesInfo('V10');
  if (!img) return false;
  const [cx, cy, cw, ch] = m.crop;
  ctx.save(); ctx.globalAlpha *= alpha;
  ctx.fillStyle = m.bg; ctx.fillRect(0, 0, W, H);
  ctx.drawImage(img, vx(V, cx), vy(V, cy), W * V.z * cw, H * V.z * ch);
  ctx.restore();
  return true;
}
function mapFull(ctx, S, kind, F, V, o = {}) {
  const { dx = 0, flip = false, bg = true } = o;
  if (bg) { ctx.fillStyle = BG[kind] ?? PAPER; ctx.fillRect(0, 0, W, H); }
  const id = F.id, k = F.k;
  if (kind === 'mask') drawVid(ctx, solid(maskFrame(id, k, { fade: 0 }), '#FFFFFF', 'j2mask'), V, { dx, flip });
  else if (kind === 'depth') { floorShadow(ctx, F, V, '#3A4170', 0.9, dx); drawVid(ctx, segCanvas(id, k, 'depth'), V, { dx, flip }); }
  else if (kind === 'normal') drawVid(ctx, segCanvas(id, k, 'normal'), V, { dx, flip });
  else if (kind === 'seg') drawVid(ctx, segCanvas(id, k, 'seg'), V, { smooth: false, dx, flip });
  else if (kind === 'pixel') {
    const p = pooled('j2pix', 64, 36), c = p.getContext('2d'); c.imageSmoothingEnabled = true; c.clearRect(0, 0, 64, 36); c.drawImage(segCanvas(id, k, 'seg'), 0, 0, 64, 36);
    drawVid(ctx, p, V, { smooth: false, dx, flip });
  } else if (kind === 'canny') { // 深蓝底 + 青色边缘（外轮廓粗、里面细），一层淡淡的宽光晕；每拍从她身上往外荡一圈粉色的"重描"
    // 第二十五轮（用户：2:11 蓝色渐变背景有明显的色带）：渐变逐像素算 + 抖动量化的静态图（core/dither.js；第二十七轮并开关 i2d25）
    if (bg) ctx.drawImage(ditheredRadial(W, H, [960, 520, 100], [960, 540, 1200], '#1C2A78', NAVY), 0, 0, W, H);
    drawLines(ctx, F, V, { dx, flip, outer: 7, inner: 5, color: css(CYAN, 0.12), colorIn: css(CYAN, 0.08), keep: o.keep });
    drawLines(ctx, F, V, { dx, flip, outer: 2.4, inner: 1.5, color: CYAN, colorIn: '#BFF8FF', keep: o.keep });
    if (o.retrace != null && o.retrace < 1) {
      const [cx, cy] = bodyCenter(F, V), R = 60 + 1300 * easeOut(o.retrace);
      drawLines(ctx, F, V, { dx, flip, outer: 3, inner: 2, color: PINK, alpha: 1 - o.retrace, keep: (x, y) => Math.abs(Math.hypot(x - cx - dx, y - cy) - R) < 60 });
    }
  } else if (kind === 'halftone') { halftone(ctx, S, F, V, { dx, grow: o.grow }); drawLines(ctx, F, V, { dx, flip, outer: 1.4, inner: 0, color: css(BRAND, 0.55) }); }
  else if (kind === 'ascii') ascii(ctx, S, F, V, { dx, flip, show: o.show });
  else if (kind === 'lineart') { floorShadow(ctx, F, V, '#9DB4FF', 0.45, dx); drawLines(ctx, F, V, { dx, flip, outer: 3, inner: 1.7, color: BRAND, colorIn: '#5A78F0' }); }
  else if (kind === 'cel') {
    floorShadow(ctx, F, V, '#8A9AD8', 0.5, dx);
    drawVid(ctx, segCanvas(id, k, 'cel'), V, { dx, flip, alpha: o.fill ?? 1 });
    drawLines(ctx, F, V, { dx, flip, outer: 2.6, inner: 1.3, color: '#1E2350', colorIn: css('#1E2350', 0.7) });
  }
}
// 九宫格 / 小窗里画一种图：rect 代表整个屏幕缩进去
function mapRect(ctx, S, kind, F, rect, V, o = {}) {
  const [x, y, w, h] = rect;
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.translate(x, y); ctx.scale(w / W, h / H);
  mapFull(ctx, S, kind, F, V, o);
  ctx.restore();
}
// 81：九宫格——同一帧舞的九种预处理图，每格像预览节点；由内到外一圈圈弹出来；最后一拍推进中间那格（深度），接 82 的全屏深度
const GRID81 = [['mask', 'canny', 'lineart'], ['halftone', 'depth', 'seg'], ['pixel', 'normal', 'ascii']];
// 第十七轮：九宫格放进新的外框里（48–1024）；底色深色；每格按全屏的 VF 画（推进中间那格以后正好就是 82 的全屏）
const CELL = (() => { const gap = 18, y0 = 62, h = (1018 - y0 - 2 * gap) / 3, w = (h * 16) / 9, x0 = (W - (3 * w + 2 * gap)) / 2; return { gap, w, h, x0, y0 }; })();
const push81 = t => smooth(clamp((t - beatTime(81, 4)) / BEAT)); // 推进中间那格（KSampler 的外框跟着退出去）
function art81(ctx, S, F) {
  const t = S.t, a = t - barStart(81), push = push81(t);
  const cx = CELL.x0 + CELL.w * 1.5 + CELL.gap, cy = CELL.y0 + CELL.h * 1.5 + CELL.gap, z = lerp(1, W / CELL.w, push);
  ctx.fillStyle = DEEP; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.translate(lerp(cx, 960, push), lerp(cy, 540, push)); ctx.scale(z, z); ctx.translate(-cx, -cy);
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
    const kind = GRID81[j][i], ring = Math.max(Math.abs(i - 1), Math.abs(j - 1)), at = ring * 0.12 + (i + j) * 0.02, s = easeOutBack(clamp((a - at) / 0.22), 1.6);
    if (s <= 0.01) continue;
    const x = CELL.x0 + i * (CELL.w + CELL.gap), y = CELL.y0 + j * (CELL.h + CELL.gap);
    ctx.save(); ctx.translate(x + CELL.w / 2, y + CELL.h / 2); ctx.scale(s, s); ctx.translate(-x - CELL.w / 2, -y - CELL.h / 2);
    ctx.save(); rrect(ctx, x, y, CELL.w, CELL.h, 10); ctx.clip();
    mapRect(ctx, S, kind, F, [x, y, CELL.w, CELL.h], VF, { retrace: kind === 'canny' ? clamp((S.sub * BEAT) / 0.5) : null });
    ctx.restore();
    ctx.lineWidth = 1.5; ctx.strokeStyle = css('#6E80D8', 0.55 * (i === 1 && j === 1 ? 1 - push : 1)); rrect(ctx, x, y, CELL.w, CELL.h, 10); ctx.stroke();
    if (!(i === 1 && j === 1) || push < 0.3) {
      ctx.save(); ctx.globalAlpha *= i === 1 && j === 1 ? 1 - push / 0.3 : 1;
      ctx.font = fonts(13, 'ZENB', 'SCB'); const tw = ctx.measureText(TITLE[kind]).width + 18;
      ctx.fillStyle = DK.pill; rrect(ctx, x + 10, y + 10, tw, 22, 11); ctx.fill(); ctx.fillStyle = DK.text; midText(ctx, TITLE[kind], x + 19, y + 21);
      ctx.restore();
    }
    ctx.restore();
  }
  ctx.restore();
}
// 82–88：全屏，每小节一种图（第十七轮：82 起去掉 KSampler 外框，和第十五轮一样全屏，只留顶部进度条）。
// 换图（第十七轮，用户：第十六轮那几种换法不如上一版舒服，改回之前的）：第十五轮的扫描线——比小节线早 LEAD 开始，0.2 s 从上往下把上一种图换掉，
// 扫描线前沿一道白色渐亮 + 一根青线。88（第 15 步）：所有效果合回一个她（mergeAll）
const KIND = { 82: 'depth', 83: 'canny', 84: 'halftone', 85: 'ascii', 86: 'seg', 87: 'duet', 88: 'merge' };
const LEAD = 0.08, WIPE = 0.2;
const DUET = { z: 0.92, dx: 420 };
const twinF = (F, t) => ({ id: F.id, k: segIndex('V10', t - 0.15, T81, 1) }); // 对舞的另一个她晚 0.15 s
// 87：左边线稿的她、右边（镜像、晚 0.15 s）代码组成的她
function duetDraw(ctx, S, F, { bg = true } = {}) {
  const V = { z: DUET.z, cx: 0.5, cy: VF.cy }, d = DUET.dx;
  if (bg) { ctx.fillStyle = BG.lineart; ctx.fillRect(0, 0, W, H); }
  ascii(ctx, S, twinF(F, S.t), V, { dx: d, flip: true, mode: 'bin' });
  mapFull(ctx, S, 'lineart', F, V, { dx: -d, bg: false });
  ctx.save(); ctx.globalAlpha = 0.35; ctx.strokeStyle = BRAND; ctx.setLineDash([8, 10]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(960, 110); ctx.lineTo(960, 1000); ctx.stroke(); ctx.restore();
}
function kindDraw(ctx, S, F, kind) {
  if (kind === 'duet') return duetDraw(ctx, S, F);
  if (kind === 'merge') return mergeAll(ctx, S, F);
  mapFull(ctx, S, kind, F, VF, { retrace: kind === 'canny' ? clamp((S.sub * BEAT) / 0.5) : null });
}
// 88 · 第 15 步（第十七轮，用户：两个效果合并试试改成所有效果合并，应该更有冲击力）：81 九宫格的九种图又出现在九个格子里（和 81 首尾呼应），
// 跟着她跳一会儿，然后一起往中间飞、越飞越快、一边放大到全屏一边把底色褪掉——九层叠在同一个姿势上——撞在一起那一下变成本色的她（一圈白环荡开）
const T_MERGE0 = () => T88 - LEAD + WIPE + 0.3, T_HIT = () => T_MERGE0() + 0.52;
function mergeAll(ctx, S, F) {
  const t = S.t, m = easeIn(clamp((t - T_MERGE0()) / (T_HIT() - T_MERGE0())));
  if (t >= T_HIT()) { // 撞上以后：本色，带一点回弹；白环荡开
    // 第十八轮（用户：2:18 全部九种效果合并后不再显示风格化效果，而是直接到彩色图）：撞上那一下直接是视频原画（V10 同一帧、同一个位置），
    // 不再经过本色（平涂 + 两档明暗 + 线）那一版；89 也就不用再从本色一圈圈换成原画（见 art89）。原画抽帧从 V10 11.9 s 起（以前 13.1 s）。rev ia18
    const h = t - T_HIT(), s = 1 + 0.035 * Math.exp(-7 * h) * Math.cos(14 * h);
    ctx.save(); ctx.translate(960, 540); ctx.scale(s, s); ctx.translate(-960, -540);
    if (!realFrame(ctx, S, VF)) mapFull(ctx, S, 'cel', F, VF); // 没有抽帧文件时退回本色
    ctx.restore();
    const [cx, cy] = bodyCenter(F, VF), r = 80 + 1500 * easeOut(clamp(h / 0.6));
    if (h < 0.6) { ctx.save(); ctx.strokeStyle = css('#FFFFFF', 0.85 * (1 - h / 0.6)); ctx.lineWidth = 14 * (1 - h / 0.6) + 2; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
    if (h < 0.12) { ctx.save(); ctx.globalAlpha = 0.28 * (1 - h / 0.12); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, H); ctx.restore(); } // 只闪 0.12 s、≤ 0.3
    return;
  }
  ctx.fillStyle = DEEP; ctx.fillRect(0, 0, W, H);
  const order = [];
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) order.push([i, j]);
  order.sort((p, q) => Math.max(Math.abs(q[0] - 1), Math.abs(q[1] - 1)) - Math.max(Math.abs(p[0] - 1), Math.abs(p[1] - 1))); // 外圈先画、中间最后
  for (const [i, j] of order) {
    const kind = GRID81[j][i], ring = Math.max(Math.abs(i - 1), Math.abs(j - 1));
    const mi = clamp((t - T_MERGE0() - (2 - ring) * 0.04) / (T_HIT() - T_MERGE0() - 0.08)) ** 1.7; // 越飞越快；外圈晚一点出发、同一刻撞上
    const x0 = CELL.x0 + i * (CELL.w + CELL.gap), y0 = CELL.y0 + j * (CELL.h + CELL.gap);
    const x = lerp(x0, 0, mi), y = lerp(y0, 0, mi), w = lerp(CELL.w, W, mi), h = lerp(CELL.h, H, mi), rr = 10 * (1 - mi);
    const bob = (1 - mi) * 6 * Math.sin(S.t * 5 + i + j * 2);
    ctx.save(); ctx.translate(0, bob);
    ctx.save(); rrect(ctx, x, y, w, h, rr); ctx.clip();
    const bgA = 1 - smooth(clamp((t - T_MERGE0() + 0.04) / 0.16)); // 一出发底色就褪掉，飞的是九个"她"
    if (bgA > 0) { ctx.globalAlpha = bgA; ctx.fillStyle = BG[kind] ?? PAPER; ctx.fillRect(x, y, w, h); ctx.globalAlpha = 1; }
    ctx.globalAlpha = 1 - 0.55 * mi;
    if ((kind === 'depth' || kind === 'normal') && bgA < 1) { // 这两种图自带不透明的底，飞的时候用她的剪影裁出来
      const buf = pooled('j2mergeL', W, H), c = buf.getContext('2d');
      c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, W, H);
      mapRect(c, S, kind, F, [x, y, w, h], VF, { bg: false });
      c.globalCompositeOperation = 'destination-in'; c.save(); c.translate(x, y); c.scale(w / W, h / H); drawVid(c, solid(maskFrame(F.id, F.k, { fade: 0 }), '#FFFFFF', 'j2mergem'), VF); c.restore();
      c.globalCompositeOperation = 'source-over';
      if (bgA > 0) { ctx.save(); ctx.globalAlpha *= bgA; mapRect(ctx, S, kind, F, [x, y, w, h], VF, { bg: false }); ctx.restore(); }
      ctx.save(); ctx.globalAlpha *= 1 - bgA; ctx.drawImage(buf, 0, 0); ctx.restore();
    } else mapRect(ctx, S, kind, F, [x, y, w, h], VF, { bg: false, retrace: kind === 'canny' ? clamp((S.sub * BEAT) / 0.5) : null });
    ctx.restore();
    if (bgA > 0) {
      ctx.save(); ctx.globalAlpha = bgA;
      ctx.lineWidth = 1.5; ctx.strokeStyle = css('#6E80D8', 0.55); rrect(ctx, x, y, w, h, rr); ctx.stroke();
      ctx.font = fonts(13, 'ZENB', 'SCB'); const tw = ctx.measureText(TITLE[kind]).width + 18;
      ctx.fillStyle = DK.pill; rrect(ctx, x + 10, y + 10, tw, 22, 11); ctx.fill(); ctx.fillStyle = DK.text; midText(ctx, TITLE[kind], x + 19, y + 21);
      ctx.restore();
    }
    ctx.restore();
  }
  // 快撞上时九层叠成的她发白亮一下，提示要合成了
  if (m > 0.7) { ctx.save(); ctx.globalAlpha = 0.5 * (m - 0.7) / 0.3; drawVid(ctx, solid(maskFrame(F.id, F.k, { fade: 0 }), '#FFFFFF', 'j2mergew'), VF); ctx.restore(); }
}
function art8x(ctx, S, F) {
  const t = S.t;
  let b = 82;
  for (let q = 83; q <= 88; q++) if (t >= barStart(q) - LEAD) b = q;
  const a = t - (barStart(b) - LEAD);
  if (b > 82 && a < WIPE) {
    const sy = H * easeOut(a / WIPE);
    kindDraw(ctx, S, F, KIND[b - 1]);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, sy); ctx.clip(); kindDraw(ctx, S, F, KIND[b]); ctx.restore();
    const g = ctx.createLinearGradient(0, sy - 60, 0, sy); g.addColorStop(0, css('#FFFFFF', 0)); g.addColorStop(1, css('#FFFFFF', 0.6));
    ctx.fillStyle = g; ctx.fillRect(0, sy - 60, W, 60); ctx.fillStyle = CYAN; ctx.fillRect(0, sy - 1, W, 2);
  } else kindDraw(ctx, S, F, KIND[b]);
}

// ---------------------------------------------------------------- Ⅳ 89：解码 → Save Image
// 第 16 步在第 1 拍走完；第 2 拍起 VAE 解码——本色的她从脸开始一圈圈换成视频原画（不再是满屏马赛克一下子跳成成品图）；
// 镜头稍微拉开（0.9 → 0.84），她在原画里转完、站定，最后就是 I01 的姿势（接 90 小节的进场）
// 第十七轮：从全屏的 VF 拉开到 0.84（和第十六轮的终点一样，接 90 小节进场里 I01 的位置）
const V89 = t => { const k = smooth(clamp((t - T_VAE) / (T90 - T_VAE))); return { z: lerp(VF.z, 0.84, k), cx: 0.5, cy: lerp(VF.cy, 0.49, k) }; };
function art89(ctx, S, F) {
  const t = S.t, V = V89(t), d = clamp((t - (T_VAE - 0.05)) / 0.75);
  if (realFrame(ctx, S, V)) return; // 第十八轮：88 撞上以后已经是原画，这里接着放原画（镜头照旧拉开到 0.84）
  mapFull(ctx, S, 'cel', F, V);
  if (d <= 0) return;
  const b = segBox(F.id, F.k), fx = vx(V, (b.x0 + b.x1) / 2), fy = vy(V, b.y0 + 0.1 * (b.y1 - b.y0)), R = 1500 * smooth(d) ** 1.2;
  const buf = pooled('j2real', W, H), c = buf.getContext('2d');
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, W, H);
  if (!realFrame(c, S, V)) return;
  c.globalCompositeOperation = 'destination-in';
  const g = c.createRadialGradient(fx, fy, Math.max(0, R - 160), fx, fy, R + 1); g.addColorStop(0, '#000'); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.fillRect(0, 0, W, H); c.globalCompositeOperation = 'source-over';
  ctx.drawImage(buf, 0, 0);
  if (d < 1) { ctx.save(); ctx.strokeStyle = css('#FFFFFF', 0.7 * (1 - d)); ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(fx, fy, Math.max(1, R - 70), 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
}

// ---------------------------------------------------------------- 节点外框（74–81）：整个画面就是这个 KSampler
// 第十七轮（用户：深色背景和浅色 UI 太割裂，UI 也改成深色，包括 K 采样器后面的浅色背景；四周的 UI 占比太大，缩小、弱化）：
// 外框贴到画面边上（HUD 这一段淡出），标题栏、参数行、输入口都是深色半透明、细线、小字；81 第 4 拍推进中间那格时外框往外退、淡掉，
// 标题栏变成 82 起的顶部进度条
const FR = [14, 14, 1892, 1052], FR_R = 14, TITLE_H = 34;
const chromeIn = t => easeOut(clamp((t - (T74 - 0.05)) / 0.45));
const chromeVis = t => (t >= barStart(82) ? 0 : chromeIn(t) * (1 - push81(t)));
const isSave = t => t >= T_SAVE - 0.05;
const INPUTS = [['model', 'MODEL'], ['positive', 'CONDITIONING'], ['negative', 'CONDITIONING'], ['latent_image', 'LATENT']];
const sockY = i => FR[1] + TITLE_H + 20 + i * 26;
function canvasBg(ctx, e) { // 节点外面一圈 ComfyUI 画布（深色点阵）
  if (e <= 0) return;
  ctx.save(); ctx.globalAlpha = e;
  rrect(ctx, FR[0], FR[1], FR[2], FR[3], FR_R); ctx.rect(0, 0, W, H); ctx.fillStyle = DK.canvas; ctx.fill('evenodd'); // rrect 会 beginPath，所以它先画
  ctx.restore();
}
function chrome(ctx, S) {
  const t = S.t, e = chromeVis(t), co = push81(t);
  if (e <= 0.005) return;
  const g = 1 + 0.06 * co, [x, y, w, h] = FR, done = doneAt(t), prog = done / 16;
  ctx.save(); ctx.globalAlpha = e; ctx.translate(960, 540); ctx.scale(g, g); ctx.translate(-960, -540); ctx.translate(0, -12 * (1 - chromeIn(t)));
  // 标题栏
  ctx.save(); rrect(ctx, x, y, w, h, FR_R); ctx.clip(); ctx.fillStyle = DK.title; ctx.fillRect(x, y, w, TITLE_H);
  ctx.fillStyle = 'rgba(80,96,170,0.25)'; ctx.fillRect(x, y + TITLE_H - 3, w, 3); ctx.fillStyle = css(GREEN, 0.85); ctx.fillRect(x, y + TITLE_H - 3, w * prog, 3); ctx.restore();
  ctx.font = fonts(17, 'SCB'); ctx.fillStyle = DK.bright; midText(ctx, 'KSampler', x + 18, y + TITLE_H / 2 - 1);
  const nw = ctx.measureText('KSampler').width;
  ctx.font = fonts(12, 'SC'); ctx.fillStyle = DK.dim; midText(ctx, '#17 · 第 17 张', x + 28 + nw, y + TITLE_H / 2);
  stepLabel(ctx, S, x + w - 18, y + TITLE_H / 2);
  // 外框：执行中的绿色细边，开场沿着框画一圈出来
  const per = 2 * (w + h);
  ctx.lineWidth = 2; ctx.strokeStyle = css(GREEN, 0.75); ctx.setLineDash([per * chromeIn(t), per]); rrect(ctx, x, y, w, h, FR_R); ctx.stroke(); ctx.setLineDash([]);
  // 输入口（左边框上）：开场一个个弹出来
  INPUTS.forEach(([nm, type], i) => {
    const a = t - (T74 + 0.15 + i * 0.05), s = easeOutBack(clamp(a / 0.2), 2);
    if (s <= 0.01) return;
    const yy = sockY(i), col = WIRE[type];
    ctx.save(); ctx.globalAlpha *= clamp(s);
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, yy, 5 * s, 0, Math.PI * 2); ctx.fill();
    ctx.font = fonts(12, 'SC'); const lw = ctx.measureText(nm).width + 14;
    ctx.fillStyle = DK.pill; rrect(ctx, x + 10, yy - 10, lw, 20, 10); ctx.fill(); ctx.fillStyle = DK.text; midText(ctx, nm, x + 17, yy);
    ctx.restore();
  });
  // 输出口（右边框上）：LATENT
  { const a = t - (T74 + 0.4), s = easeOutBack(clamp(a / 0.2), 2), yy = sockY(0);
    if (s > 0.01) {
      ctx.save(); ctx.globalAlpha *= clamp(s); ctx.fillStyle = WIRE.LATENT; ctx.beginPath(); ctx.arc(x + w, yy, 5 * s, 0, Math.PI * 2); ctx.fill();
      ctx.font = fonts(12, 'SCB'); const lw = ctx.measureText('LATENT').width + 14;
      ctx.fillStyle = DK.pill; rrect(ctx, x + w - 10 - lw, yy - 10, lw, 20, 10); ctx.fill(); ctx.fillStyle = DK.text; ctx.textAlign = 'right'; midText(ctx, 'LATENT', x + w - 17, yy); ctx.textAlign = 'left';
      ctx.restore();
    } }
  widgetRow(ctx, S);
  ctx.restore();
}
// 标题栏 / 顶部进度条右边：running · step k/16 · σ（存图后 saved ✓）
function stepLabel(ctx, S, xr, ym, th = DK) {
  const t = S.t, save = isSave(t);
  const st = t < T_DONE ? `step ${stepAt(t)} / 16` : t < T_SAVE - 0.05 ? 'decoding…' : 'saved ✓', sig = t < T_DONE ? `σ ${sigAt(t).toFixed(3)}` : '';
  ctx.save(); ctx.textAlign = 'right'; ctx.font = fonts(14, 'ZENB', 'SCB'); ctx.fillStyle = th.bright; midText(ctx, sig, xr, ym);
  const sw = sig ? ctx.measureText(sig).width + 18 : 0; ctx.fillStyle = save ? BRAND : th.text; midText(ctx, st, xr - sw, ym);
  const stw = ctx.measureText(st).width, pulse = 0.55 + 0.45 * Math.cos(Math.PI * 2 * S.sub);
  ctx.fillStyle = save ? BRAND : css(GREEN, pulse); ctx.beginPath(); ctx.arc(xr - sw - stw - 14, ym, 4.5, 0, Math.PI * 2); ctx.fill();
  if (!save) { ctx.font = fonts(12, 'SC'); ctx.fillStyle = th.dim; midText(ctx, 'running', xr - sw - stw - 26, ym); }
  ctx.restore();
}
// 此刻画面是浅色（1）还是深色（0）：跟着换图的扫描线一起变；88 撞成本色那一下变浅
const LIGHT = { depth: 0, canny: 0, halftone: 1, ascii: 1, seg: 0, duet: 1, merge: 0 };
function lightAt(t) {
  if (t >= T89) return 1;
  if (t < barStart(82) - LEAD) return 0;
  let b = 82; for (let q = 83; q <= 88; q++) if (t >= barStart(q) - LEAD) b = q;
  const a = t - (barStart(b) - LEAD), cur = b === 88 ? clamp((t - T_HIT()) / 0.15) : LIGHT[KIND[b]];
  if (b === 82) return cur;
  return a < WIPE ? lerp(LIGHT[KIND[b - 1]], b === 88 ? 0 : cur, easeOut(a / WIPE)) : cur;
}
const themeAt = L => ({ bright: mix(DK.bright, LT.bright, L), text: mix(DK.text, LT.text, L), dim: mix(DK.dim, LT.dim, L) });
// 底下一排参数（KSampler 的 widget）：开场从左到右一个个弹出来；steps 那一格每走一步亮一下，底色按进度填满
const WIDGETS = [['seed', '114514'], ['control_after_generate', 'fixed'], ['steps', '16'], ['cfg', '4.5'], ['sampler_name', 'euler'], ['scheduler', 'normal'], ['denoise', '1.00']];
function widgetRow(ctx, S) {
  const t = S.t, hh = 26, y = FR[1] + FR[3] - 8 - hh;
  ctx.save(); ctx.font = fonts(12, 'SC');
  const ws = WIDGETS.map(([k, v]) => ctx.measureText(k).width + ctx.measureText(v).width + 52), tot = ws.reduce((a, b) => a + b, 0), gap = Math.min(24, (FR[2] - 36 - tot) / (WIDGETS.length - 1));
  let x = 960 - (tot + gap * (WIDGETS.length - 1)) / 2;
  WIDGETS.forEach(([k, v], i) => {
    const a = t - (T74 + 0.25 + i * 0.04), s = easeOutBack(clamp(a / 0.22), 1.8), w = ws[i];
    if (s > 0.01) {
      ctx.save(); ctx.translate(x + w / 2, y + hh / 2); ctx.scale(s, s); ctx.translate(-x - w / 2, -y - hh / 2); ctx.globalAlpha *= clamp(s);
      ctx.fillStyle = DK.pill; rrect(ctx, x, y, w, hh, hh / 2); ctx.fill(); ctx.strokeStyle = DK.edge; ctx.lineWidth = 1; ctx.stroke();
      if (k === 'steps') { ctx.save(); rrect(ctx, x, y, w, hh, hh / 2); ctx.clip(); ctx.fillStyle = css(BRAND, 0.3); ctx.fillRect(x, y, w * (doneAt(t) / 16), hh); ctx.restore(); }
      ctx.font = fonts(12, 'SC'); ctx.fillStyle = DK.dim; midText(ctx, k, x + 14, y + hh / 2);
      const kick = k === 'steps' && t >= T74 + 0.3 ? decay((t - T74) % BAR, 6) : 0;
      ctx.textAlign = 'right'; ctx.font = fonts(13, 'SCB'); ctx.fillStyle = kick > 0.15 ? LB : DK.text;
      ctx.save(); ctx.translate(x + w - 14, y + hh / 2); ctx.scale(1 + 0.25 * kick, 1 + 0.25 * kick); midText(ctx, v, 0, 0); ctx.restore(); ctx.textAlign = 'left';
      ctx.restore();
    }
    x += w + gap;
  });
  ctx.restore();
}
// 82 起（第十七轮，用户：02:08 开始可以把 K 采样器的边框也去掉，和上一版一样全屏，但保留顶部进度条）：顶部一条深色半透明的进度条——
// 左边是节点名和这一步用的 ControlNet 条件图，右边 running · step · σ，底边一根绿线按步数走；89 小节变成 VAE Decode → Save Image
function topBar(ctx, S) {
  const t = S.t, e = t >= barStart(82) ? 1 : push81(t);
  if (e <= 0.005 || t >= T90) return;
  const hh = 32, save = isSave(t), sv = clamp((t - (T_SAVE - 0.05)) / 0.3), L = lightAt(t), th = themeAt(L);
  ctx.save(); ctx.globalAlpha = e; ctx.translate(0, -hh * (1 - e));
  ctx.fillStyle = css(mix('#080B1E', '#FFFFFF', L), 0.62 + 0.1 * L); ctx.fillRect(0, 0, W, hh);
  ctx.fillStyle = css(mix('#5060AA', '#B4BCD8', L), 0.3); ctx.fillRect(0, hh - 3, W, 3); ctx.fillStyle = save ? mix(GREEN, BRAND, sv) : css(GREEN, 0.85); ctx.fillRect(0, hh - 3, W * (save ? 1 : doneAt(t) / 16), 3);
  const name = t < T_VAE ? 'KSampler' : t < T_SAVE - 0.05 ? decode('VAE Decode', t - T_VAE, { step: 0.02, settle: 0.12, seed: 3 }) : decode('Save Image', t - T_SAVE + 0.05, { step: 0.02, settle: 0.12, seed: 4 });
  ctx.font = fonts(15, 'SCB'); ctx.fillStyle = th.bright; midText(ctx, name, 18, hh / 2 - 1);
  let b = 82; for (let q = 83; q <= 88; q++) if (t >= barStart(q) - LEAD) b = q;
  const sub = t < T_VAE ? `#17 · 第 17 张 · ControlNet ${t < T88 - LEAD ? CN_NAME[b] : 'off · 上色'}` : t < T_SAVE - 0.05 ? '#18 · latent → image' : '#19 · output/ComfyUI_00017_.png';
  const nw = ctx.measureText(name).width; ctx.font = fonts(12, 'SC'); ctx.fillStyle = th.dim; midText(ctx, sub, 30 + nw, hh / 2);
  stepLabel(ctx, S, W - 18, hh / 2, th);
  if (t >= beatTime(89, 4)) { ctx.font = fonts(12, 'SC'); ctx.fillStyle = css(mix('#7BE3A6', '#1E9E5A', L), clamp((t - beatTime(89, 4)) / 0.2)); ctx.textAlign = 'center'; midText(ctx, decode('Prompt executed in 25.60 seconds', t - beatTime(89, 4), { step: 0.006, settle: 0.06, seed: 5 }), 960, hh / 2); ctx.textAlign = 'left'; }
  ctx.restore();
}

// ---------------------------------------------------------------- 四周的说明窗口（74–81）
// 第十七轮：每列 330 宽（以前 400–520），深色半透明、1 px 细边、小字；81 九宫格时滑出去，82 起全屏就不再回来
const COND = [28, 168, 330, 204], QUEUE = [28, 384, 330, 196], SLOT = [28, 592, 330, 426];
const CONS = [1562, 94, 330, 146], SIGP = [1562, 252, 330, 122], PREV = [1562, 386, 330, 368];
const enterAt = (t, i) => { const a = t - (T74 + 0.2 + i * 0.07); return { e: easeOutBack(clamp(a / 0.38), 1.3), a }; };
const dockAt = t => smooth(clamp((t - (T81 - 0.15)) / 0.3));
function panelBox(ctx, x, y, w, h, title, { sub = '', hot = 0, th = DK } = {}) {
  ctx.fillStyle = th.bg; rrect(ctx, x, y, w, h, 10); ctx.fill(); ctx.lineWidth = 1 + 1.5 * hot; ctx.strokeStyle = hot > 0.05 ? css(LB, 0.3 + 0.5 * hot) : th.edge; ctx.stroke();
  ctx.save(); rrect(ctx, x, y, w, h, 10); ctx.clip(); ctx.fillStyle = th.head; ctx.fillRect(x, y, w, 28); ctx.restore();
  ctx.font = fonts(13, 'SCB'); ctx.fillStyle = th.title2; midText(ctx, title, x + 12, y + 14);
  if (sub) { ctx.font = fonts(11, 'SC'); ctx.fillStyle = th.dim; ctx.textAlign = 'right'; midText(ctx, sub, x + w - 12, y + 14); ctx.textAlign = 'left'; }
}
function withPanel(ctx, S, i, side, fn) { // 进场（从 side 那边滑进来、过冲一点）+ 81 让位；fn(age, dx) 在平移后的坐标里画
  const t = S.t, { e, a } = enterAt(t, i), dk = dockAt(t), dx = side * (420 * (1 - e) + 420 * dk);
  if (e <= 0.001 || a < 0 || dk >= 1) return;
  ctx.save(); ctx.translate(dx, 0); ctx.globalAlpha *= 0.92 * clamp(a / 0.15) * (1 - dk);
  fn(a, dx); ctx.restore();
}
// 提示词：正向（这一小节画的那个词点亮）、负向（低质量等常见负面词）
const POS = ['masterpiece', 'best quality', '1girl', 'slol', 'deepseek_maid_outfit', 'whale tail', 'dancing', 'made of code', 'ocean of code', 'wings', 'looking at viewer'];
const NEG = ['lowres', 'worst quality', 'low quality', 'bad anatomy', 'bad hands', 'extra fingers', 'jpeg artifacts', 'blurry', 'watermark', '大肥鱼'];
const HOT_TOKEN = bar => ({ 78: 'made of code', 79: 'ocean of code', 80: 'wings' })[bar] ?? (bar >= 81 && bar <= 88 ? 'dancing' : null);
function tokens(ctx, list, x, y, w, lh, hotTok, hotA, col, live = null) { // 一串词按宽度换行；返回每个词的框；live：此刻有连线的词（淡淡地点亮）
  const boxes = {}; let cx = x, cy = y;
  ctx.font = fonts(12, 'SC');
  list.forEach((tk, i) => {
    const s = tk + (i < list.length - 1 ? ', ' : ''), tw = ctx.measureText(s).width;
    if (cx + tw > x + w) { cx = x; cy += lh; }
    const ww = ctx.measureText(tk).width, lv = live && live.has(tk) ? live.get(tk) : 0;
    if (tk === hotTok && hotA > 0) { ctx.fillStyle = css(col, 0.3 * hotA); rrect(ctx, cx - 3, cy - 9, ww + 6, 18, 5); ctx.fill(); ctx.strokeStyle = css(LB, hotA); ctx.lineWidth = 1; ctx.stroke(); }
    else if (lv > 0) { ctx.fillStyle = css(BRAND, 0.16 * lv); rrect(ctx, cx - 3, cy - 9, ww + 6, 18, 5); ctx.fill(); }
    ctx.fillStyle = tk === hotTok && hotA > 0 ? mix(DK.text, '#FFFFFF', hotA) : DK.text; midText(ctx, s, cx, cy);
    boxes[tk] = [cx - 3, cy - 9, ww + 6, 18];
    cx += tw;
  });
  return { boxes, bottom: cy + lh / 2 };
}
let TOKBOX = {};
// 只量不画：先算出每个词的框（连线要先画在窗口下面，不能用上一帧留下的位置——画面只由 t 决定）
const panelDx = (t, i, side) => { const { e } = enterAt(t, i); return side * (420 * (1 - e) + 420 * dockAt(t)); };
function condLayout(ctx, S) {
  const [x, y, w] = COND, dx = panelDx(S.t, 0, -1), boxes = {};
  ctx.save(); ctx.font = fonts(12, 'SC');
  [[POS, y + 50], [NEG, y + 148]].forEach(([list, y0]) => {
    let cx = x + 34, cy = y0;
    list.forEach((tk, i) => {
      const tw = ctx.measureText(tk + (i < list.length - 1 ? ', ' : '')).width;
      if (cx + tw > x + 34 + w - 52) { cx = x + 34; cy += 18; }
      boxes[tk] = [cx - 3 + dx, cy - 9, ctx.measureText(tk).width + 6, 18];
      cx += tw;
    });
  });
  ctx.restore();
  TOKBOX = boxes; TOKBOX.__dx = dx;
}
function condPanel(ctx, S) {
  const t = S.t, bar = S.bar, hot = HOT_TOKEN(bar), ha = hot ? smooth(clamp((t - barStart(bar) + LEAD) / 0.2)) : 0;
  const live = bar >= 78 && bar <= 80 ? new Map(SECOND.map(([tk]) => [tk, attnEnv(S, bar)])) : null;
  withPanel(ctx, S, 0, -1, (a, dx) => {
    const [x, y, w, h] = COND;
    panelBox(ctx, x, y, w, h, 'CLIP Text Encode × 2', { sub: 'positive / negative' });
    ctx.save();
    ctx.fillStyle = 'rgba(61,220,132,0.07)'; rrect(ctx, x + 10, y + 36, w - 20, 92, 7); ctx.fill();
    ctx.fillStyle = css(GREEN, 0.8); ctx.font = fonts(15, 'ZENB', 'SCB'); midText(ctx, '+', x + 18, y + 50);
    tokens(ctx, POS, x + 34, y + 50, w - 52, 18, hot, ha, BRAND, live);
    ctx.fillStyle = 'rgba(229,72,77,0.07)'; rrect(ctx, x + 10, y + 134, w - 20, 62, 7); ctx.fill();
    ctx.fillStyle = css(RED, 0.8); ctx.font = fonts(15, 'ZENB', 'SCB'); midText(ctx, '−', x + 18, y + 148);
    tokens(ctx, NEG, x + 34, y + 148, w - 52, 18, null, 0, RED);
    ctx.restore();
  });
}
// ---- 提示词 → 画面的连线（第十七轮，用户：tag 与画面连接的线很有意思，但太少了，极大幅度增加，换成直线，像 01:00 的镜头）
// 像 1:00 的路由：这一小节画的那个词（made of code / ocean of code / wings）拉出 64 根直线，连到画面里它管的那一片（长出代码的身体、海、翅膀）；
// 别的词也各拉几根到它管的部位（1girl → 脸和手、whale tail → 头发和尾巴、maid outfit → 裙子和围裙……），更淡。
// 每根线半拍换一次落点（错开），换的时候从词那头重新长过去；最亮的 6 根是白的，落点一个小环
const SECOND = [['1girl', [4], 10], ['whale tail', [1], 12], ['deepseek_maid_outfit', [2, 3], 12], ['dancing', [1, 2, 3, 4, 5], 8], ['looking at viewer', [4], 5], ['masterpiece', [1, 2, 3, 4, 5], 4], ['best quality', [1, 2, 3, 4, 5], 4]];
const attnEnv = (S, bar) => { const a = S.t - barStart(bar) + LEAD; return clamp(a / 0.25) * (1 - smooth(clamp((S.t - (barStart(bar + 1) - LEAD - 0.15)) / 0.15))); };
function labelPts(F, labs) { // 她身上属于这几个部位的屏幕点（18 px 一格）
  const b = segBox(F.id, F.k), out = [], X0 = vx(VM, b.x0), X1 = vx(VM, b.x1), Y0 = vy(VM, b.y0), Y1 = vy(VM, b.y1);
  for (let Y = Y0; Y < Y1; Y += 18) for (let X = X0; X < X1; X += 18) if (labs.includes(labelAt(F, VM, X, Y))) out.push([X, Y]);
  return out;
}
function fan(ctx, S, src, pts, n, seed, col, a0, { top = 0, lw = 1, alpha = 0.5 } = {}) {
  if (!pts.length) return;
  const HB = BEAT / 2;
  for (let k = 0; k < n; k++) {
    const ak = a0 - k * 0.004 + (k % 5) * 0.07;
    if (ak < 0) continue;
    const ep = Math.floor(ak / HB), tin = ak - ep * HB, p = pts[hash(k, ep, seed) % pts.length];
    const g = easeOut(clamp(tin / 0.1)), out = 1 - clamp((tin - (HB - 0.05)) / 0.05), hi = k < top;
    const x1 = lerp(src[0], p[0], g), y1 = lerp(src[1], p[1], g);
    ctx.strokeStyle = hi ? css('#FFFFFF', 0.85 * out) : css(col, alpha * out); ctx.lineWidth = hi ? lw + 0.6 : lw;
    ctx.beginPath(); ctx.moveTo(src[0], src[1]); ctx.lineTo(x1, y1); ctx.stroke();
    if (g >= 1) {
      if (hi) { const kk = decay(S.sub * BEAT, 6); ctx.beginPath(); ctx.arc(p[0], p[1], 6 + 4 * kk, 0, Math.PI * 2); ctx.stroke(); }
      else { ctx.fillStyle = css(col, Math.min(1, alpha * 1.6) * out); ctx.fillRect(p[0] - 2, p[1] - 2, 4, 4); }
    }
  }
}
// 线画在提示词窗口下面：从窗口右边框上、和那个词同一高度的"出口"射出去（不压住窗口里的字）；出口一个小亮点
const portOf = (b, dx) => [COND[0] + COND[2] + dx, b[1] + b[3] / 2];
function attnLines(ctx, S) {
  const bar = S.bar;
  if (!ATT || bar < 78 || bar > 80) return;
  const e = attnEnv(S, bar), tok = HOT_TOKEN(bar), box = TOKBOX[tok], dx = TOKBOX.__dx ?? 0;
  if (e <= 0 || !box) return;
  const a0 = S.t - barStart(bar) + LEAD;
  ctx.save(); ctx.globalAlpha *= e * (1 - dockAt(S.t)); ctx.lineCap = 'round';
  for (const [tk, labs, n] of SECOND) {
    const b = TOKBOX[tk]; if (!b) continue;
    fan(ctx, S, portOf(b, dx), labelPts(ATT.F, labs), n, hash(tk.length, 7), '#7F92E0', a0 - 0.15, { alpha: 0.32 });
  }
  const src = portOf(box, dx);
  fan(ctx, S, src, ATT.hot, 64, bar, LB, a0, { top: 6, alpha: 0.5 });
  ctx.restore();
}
// 出口的亮点（画在窗口上面）
function attnPorts(ctx, S) {
  const bar = S.bar;
  if (!ATT || bar < 78 || bar > 80) return;
  const e = attnEnv(S, bar) * (1 - dockAt(S.t)), box = TOKBOX[HOT_TOKEN(bar)], dx = TOKBOX.__dx ?? 0;
  if (e <= 0 || !box) return;
  const [px, py] = portOf(box, dx), k = decay(S.sub * BEAT, 6);
  ctx.save(); ctx.globalAlpha *= e; ctx.lineWidth = 1;
  ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(px, py, 3.5 + 2 * k, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = css(LB, 0.5 * (1 - k)); ctx.beginPath(); ctx.arc(px, py, 6 + 10 * k, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}
// 队列：前 16 张都是 CUDA out of memory（上一段炸掉的那一批），第 17 张在跑——device 从 cuda:0 划掉改成「她自己」
function queuePanel(ctx, S) {
  const t = S.t;
  withPanel(ctx, S, 1, -1, () => {
    const [x, y, w, h] = QUEUE;
    panelBox(ctx, x, y, w, h, 'Queue', { sub: '#17 running' });
    const ts = 34, g = 4;
    for (let i = 0; i < 16; i++) {
      const cx = x + 12 + (i % 8) * (ts + g), cy = y + 38 + Math.floor(i / 8) * (ts + g);
      ctx.save(); ctx.globalAlpha *= 0.4; ctx.filter = 'grayscale(1)'; ctx.drawImage(batchImage(i, 128), cx, cy, ts, ts); ctx.filter = 'none'; ctx.restore();
      ctx.strokeStyle = css(RED, 0.6); ctx.lineWidth = 1; ctx.strokeRect(cx + 0.5, cy + 0.5, ts - 1, ts - 1);
      ctx.strokeStyle = css(RED, 0.85); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx + ts - 11, cy + 3); ctx.lineTo(cx + ts - 3, cy + 11); ctx.moveTo(cx + ts - 3, cy + 3); ctx.lineTo(cx + ts - 11, cy + 11); ctx.stroke();
    }
    ctx.font = fonts(11, 'SC'); ctx.fillStyle = css('#FF8A8E', 0.85); midText(ctx, '#1–#16 · torch.OutOfMemoryError: CUDA out of memory', x + 12, y + 124);
    // #17 这一行
    const ry = y + 136;
    ctx.fillStyle = css(BRAND, 0.12); rrect(ctx, x + 8, ry, w - 16, 52, 8); ctx.fill(); ctx.strokeStyle = css(LB, 0.5); ctx.lineWidth = 1; ctx.stroke();
    ctx.font = fonts(15, 'ZENB', 'SCB'); ctx.fillStyle = LB; midText(ctx, '#17', x + 18, ry + 15);
    ctx.font = fonts(12, 'SC'); ctx.fillStyle = DK.dim; midText(ctx, 'device', x + 62, ry + 15);
    const st = clamp((t - beatTime(74, 2)) / 0.2), nw = clamp((t - beatTime(74, 3)) / 0.25);
    ctx.font = fonts(13, 'ZENB', 'SCB'); ctx.fillStyle = css('#8A93BC', 1 - 0.5 * nw); const cw = ctx.measureText('cuda:0').width; midText(ctx, 'cuda:0', x + 110, ry + 15);
    if (st > 0) { ctx.fillStyle = RED; ctx.fillRect(x + 106, ry + 14, (cw + 8) * st, 2); }
    if (nw > 0) { ctx.font = fonts(16, 'SMILEY', 'SCB'); ctx.fillStyle = '#FFFFFF'; midText(ctx, '她自己'.slice(0, Math.ceil(nw * 3)), x + 120 + cw, ry + 15); }
    const hb = decay(S.sub * BEAT, 7); drawSprite(ctx, 'heart', 2, S.pal, x + w - 28, ry + 15, 0.8 + 0.25 * hb);
    // 进度 16 格
    const done = doneAt(t);
    for (let i = 0; i < 16; i++) { const on = i < Math.floor(done), cur = i === Math.floor(done); ctx.fillStyle = on ? BRAND : cur ? css(BRAND, 0.3 + 0.5 * (done % 1)) : 'rgba(90,104,170,0.35)'; rrect(ctx, x + 18 + i * 18.5, ry + 34, 15, 8, 2.5); ctx.fill(); }
  });
}
// 左下：每个乐章的说明卡——标题条先从左边甩进来，卡身再像弹簧一样往下展开；换卡时旧卡往左滑出去
const CARDS = [
  { from: barStart(75) - 0.1, to: barStart(77) - 0.1, title: '前向加噪 · rectified flow', sub: 'step 2', formula: 'rf_fwd', size: 25, demo: 'mix', h: 236 },
  { from: barStart(77) - 0.1, to: barStart(78) - 0.1, title: 'Euler · 一步', sub: 'step 4', formula: 'flow_euler', size: 19, demo: 'step', h: 210 },
  { from: barStart(78) - 0.1, to: T81 - 0.15, title: '提示词 → 画面', sub: 'cross-attention', hack: true, h: 426 },
];
const CN_NAME = { 82: 'depth_anything', 83: 'canny · 100 / 200', 84: 'halftone', 85: 'ascii', 86: 'SAM · segment', 87: 'lineart × 2', 88: 'lineart' };
function slotPanel(ctx, S, F) {
  const t = S.t;
  CARDS.forEach(cd => {
    const a = t - cd.from, out = clamp((t - cd.to) / 0.25);
    if (a < 0 || out >= 1) return;
    withPanel(ctx, S, 2, -1, () => {
      const [x, y, w] = SLOT, H0 = cd.h, head = easeOutBack(clamp(a / 0.28), 1.6), open = clamp(a - 0.1) > 0 ? 1 - Math.exp(-7 * (a - 0.1)) * Math.cos(11 * (a - 0.1)) : 0, h = 28 + (H0 - 28) * clamp(open, 0, 1.06);
      ctx.save(); ctx.translate(-420 * easeIn(out) - 300 * (1 - head), 0); ctx.globalAlpha *= clamp(a / 0.1) * (1 - out);
      panelBox(ctx, x, y, w, h, cd.title, { sub: cd.sub });
      ctx.save(); rrect(ctx, x, y + 28, w, h - 28, 10); ctx.clip();
      const ca = a - 0.3;
      if (cd.formula) {
        drawFormula(ctx, cd.formula, x + 14, y + 72, { size: cd.size, valign: 'mid', color: DK.bright, write: ca, dur: 0.45 });
        if (ca > 0.45) demo(ctx, S, F, cd.demo, x + 14, y + 112, w - 28, clamp((ca - 0.45) / 0.3));
      } else if (cd.hack) hackBody(ctx, S, x, y + 28, w, h - 28, a);
      ctx.restore(); ctx.restore();
    });
  });
}
// 式子下面的小演示：mix = x₀ ·(1−σ) + ε ·σ = x_σ（三张小图，σ 是此刻的值）；step = σᵢ → σᵢ₊₁ 一格格往下走
function demo(ctx, S, F, kind, x, y, w, k) {
  ctx.save(); ctx.globalAlpha *= k;
  const sig = sigAt(S.t), sz = 60;
  if (kind === 'mix') {
    const thumbs = [['x₀', 0], ['ε', 1], [`x_σ · σ ${sig.toFixed(2)}`, sig]], ops = ['·(1−σ)+', '·σ ='];
    thumbs.forEach(([lab, s], i) => {
      const tx = x + i * (sz + 56);
      latentThumb(ctx, S, F, tx, y, sz, s, `j2demo${i}`, { coarse: 0 });
      ctx.strokeStyle = DK.edge; ctx.lineWidth = 1; ctx.strokeRect(tx, y, sz, sz);
      ctx.font = fonts(13, 'ZENB', 'SCB'); ctx.fillStyle = DK.text; midText(ctx, lab, tx + 2, y + sz + 13);
      if (ops[i]) { ctx.font = fonts(11, 'SC'); ctx.fillStyle = DK.dim; ctx.textAlign = 'center'; midText(ctx, ops[i], tx + sz + 28, y + sz / 2); ctx.textAlign = 'left'; }
    });
  } else {
    const i0 = Math.floor(doneAt(S.t)), s0 = 1 - i0 / 16, s1 = 1 - (i0 + 1) / 16;
    ctx.font = fonts(14, 'ZENB', 'SCB'); ctx.fillStyle = DK.bright; midText(ctx, `σ ${s0.toFixed(4)} → ${s1.toFixed(4)}`, x, y + 14);
    ctx.font = fonts(12, 'SC'); ctx.fillStyle = DK.dim; midText(ctx, 'Δσ = −0.0625（normal、不加 shift，每步一样长）', x, y + 40);
    for (let i = 0; i <= 16; i++) { ctx.fillStyle = i <= i0 ? BRAND : 'rgba(90,104,170,0.45)'; ctx.beginPath(); ctx.arc(x + 5 + i * ((w - 10) / 16), y + 70, i === i0 + 1 ? 5 : 3.5, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.restore();
}
// 「提示词 → 画面」卡（第十七轮，用户：信息滚动可以像电影里黑客的代码框一样疯狂滚动）：注意力日志一行行往上狂滚（每秒约 45 行，每拍头再猛推一截），
// 行号、十六进制、q·kᵀ 权重、落点坐标……这一小节那个词的行是白的
const HACK_TOK = ['made of code', 'ocean of code', 'wings', '1girl', 'whale tail', 'dancing', 'deepseek_maid_outfit', 'looking at viewer', 'slol'];
const hex8 = (...k) => (hash(...k) >>> 0).toString(16).padStart(8, '0').toUpperCase().slice(0, 8);
function hackLine(i, sig) {
  const tok = HACK_TOK[hash(i, 3) % HACK_TOK.length], f = s => ((hash(i, s) % 1000) / 1000).toFixed(3), kind = hash(i, 17) % 10;
  if (kind < 4) return [`attn.blk${String(hash(i, 5) % 24).padStart(2, '0')}.h${String(hash(i, 6) % 16).padStart(2, '0')}  q·k^T  "${tok}" -> (${f(7)}, ${f(8)})  w=${f(9)}`, tok];
  if (kind === 4) return [`>> cross_attn(x_t, ctx=clip_l[${hash(i, 10) % 77}])  ok  ${(1 + (hash(i, 11) % 30) / 10).toFixed(1)}ms`, null];
  if (kind === 5) return [`0x${hex8(i, 12)} 0x${hex8(i, 13)} 0x${hex8(i, 14)} 0x${hex8(i, 15)}`, '#hex'];
  if (kind === 6) return [`softmax(QK^T/8)·V  [4096x77]  max=${f(16)}  tok#${hash(i, 18) % 49406}`, null];
  if (kind === 7) return [`euler: x += (σ_next − σ)·v   σ=${sig.toFixed(4)}`, null];
  if (kind === 8) return [`map "${tok}"  ${'#'.repeat(1 + (hash(i, 19) % 14))}${'.'.repeat(hash(i, 20) % 9)}  ${hash(i, 21) % 4096} px`, tok];
  return [`[${String(hash(i, 22) % 100000).padStart(5, '0')}] latent[0,${hash(i, 23) % 16},${hash(i, 24) % 128},${hash(i, 25) % 128}] = ${((hash(i, 26) % 2000) / 1000 - 1).toFixed(4)}`, '#hex'];
}
function hackBody(ctx, S, x, y, w, h, a) {
  const lh = 15, nb = a / BEAT, off = 680 * a + 150 * (Math.floor(nb) + easeOut(nb % 1)), i0 = Math.floor(off / lh), sub = off % lh;
  const hot = HOT_TOKEN(S.bar), sig = sigAt(S.t), rows = Math.ceil(h / lh) + 1;
  ctx.save(); ctx.font = fonts(11, 'SC');
  for (let r = 0; r < rows; r++) {
    const i = i0 + r, yy = y + 8 + r * lh - sub;
    if (yy < y - lh || yy > y + h) continue;
    const [s, tag] = hackLine(i, sig), on = tag && tag === hot;
    ctx.fillStyle = 'rgba(110,128,216,0.45)'; midText(ctx, String(i % 10000).padStart(4, '0'), x + 8, yy + 6);
    ctx.fillStyle = on ? '#FFFFFF' : tag === '#hex' ? 'rgba(127,146,224,0.55)' : css(DK.text, 0.75);
    midText(ctx, s, x + 44, yy + 6);
    if (on) { ctx.fillStyle = css(LB, 0.12); ctx.fillRect(x + 40, yy - 2, w - 48, lh - 1); }
  }
  // 底下的光标行
  const by = y + h - 18; ctx.fillStyle = 'rgba(8,11,30,0.85)'; ctx.fillRect(x, by - 6, w, 24);
  ctx.fillStyle = LB; midText(ctx, `$ attn --token "${hot ?? '…'}"`, x + 10, by + 6);
  if (Math.floor(S.t / 0.2) % 2 === 0) { const cw = ctx.measureText(`$ attn --token "${hot ?? '…'}"`).width; ctx.fillRect(x + 14 + cw, by - 1, 8, 14); }
  ctx.restore();
}
// 控制台（tqdm 那一行就地刷新）
const mmss = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
function consolePanel(ctx, S) {
  const t = S.t;
  withPanel(ctx, S, 3, 1, () => {
    const [x, y, w, h] = CONS, a = t - T74;
    panelBox(ctx, x, y, w, h, 'console', { sub: 'ComfyUI · log' });
    const lines = [['got prompt', DK.dim, 0], ['OutOfMemoryError: CUDA out of memory', '#FF8A8E', 0.08], ['retry #17 · device = 她自己', LB, 0.16], ['model_type FLOW · normal · 16 steps', DK.dim, 0.24]];
    ctx.font = fonts(11, 'SC');
    lines.filter(l => a >= l[2]).slice(-4).forEach(([s, col, at], i) => { ctx.fillStyle = col; midText(ctx, decode(s, a - at, { step: 0.006, settle: 0.06, seed: i }), x + 12, y + 42 + i * 18); });
    // tqdm：百分比 | 条 | 步数 [用时<剩余, s/it]
    const k = Math.min(16, Math.floor(doneAt(t) + 1e-6)), pct = Math.round((k / 16) * 100), ty = y + h - 18;
    ctx.fillStyle = 'rgba(8,11,30,0.6)'; rrect(ctx, x + 6, ty - 12, w - 12, 24, 6); ctx.fill();
    ctx.font = fonts(11, 'SCB'); ctx.fillStyle = DK.bright; ctx.textAlign = 'right'; midText(ctx, `${pct}%`, x + 46, ty); ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(90,104,170,0.35)'; ctx.fillRect(x + 52, ty - 5, 90, 10); ctx.fillStyle = BRAND; ctx.fillRect(x + 52, ty - 5, 90 * (k / 16), 10);
    ctx.font = fonts(11, 'SC'); ctx.fillStyle = DK.text; midText(ctx, `${k}/16 [${mmss(k * 1.6)}<${mmss((16 - k) * 1.6)}, 1.60s/it]`, x + 150, ty);
  });
}
// σ 日程：normal（不加 shift）——17 个点在一条直线上，一个粉点沿着走
function sigmaPanel(ctx, S) {
  const t = S.t;
  withPanel(ctx, S, 4, 1, () => {
    const [x, y, w, h] = SIGP, sig = sigAt(t), done = doneAt(t);
    panelBox(ctx, x, y, w, h, 'sigmas', { sub: 'normal · 16 steps' });
    const gx = x + 30, gy = y + 42, gw = w - 50, gh = h - 62;
    ctx.strokeStyle = DK.edge; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx, gy + gh); ctx.lineTo(gx + gw, gy + gh); ctx.stroke();
    ctx.font = fonts(11, 'SC'); ctx.fillStyle = DK.dim; ctx.textAlign = 'right'; midText(ctx, '1', gx - 6, gy); midText(ctx, '0', gx - 6, gy + gh); ctx.textAlign = 'left';
    ctx.strokeStyle = css(BRAND, 0.8); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + gw, gy + gh); ctx.stroke();
    for (let i = 0; i <= 16; i++) { ctx.fillStyle = i <= done ? BRAND : 'rgba(90,104,170,0.5)'; ctx.beginPath(); ctx.arc(gx + (gw * i) / 16, gy + (gh * i) / 16, 2.5, 0, Math.PI * 2); ctx.fill(); }
    const px = gx + gw * (1 - sig), py = gy + gh * (1 - sig), k = decay(((t - T74) % BAR + BAR) % BAR, 6);
    ctx.fillStyle = PINK; ctx.beginPath(); ctx.arc(px, py, 5 + 3 * k, 0, Math.PI * 2); ctx.fill();
    ctx.font = fonts(13, 'ZENB', 'SCB'); ctx.fillStyle = DK.bright; ctx.textAlign = 'right'; midText(ctx, `σ = ${sig.toFixed(3)}`, x + w - 12, y + 44); ctx.textAlign = 'left';
  });
}
// 潜空间预览：只取视频正中的方块；画"这一步预测的成品"——本色图由粗到细（σ 大时只剩糊影）、平滑放大，噪声份量按 σ² 盖上去；最后一步干干净净
const SQ = [0.21875, 0, 0.5625, 1]; // 视频正中的方块（u, v, w, h）
function latentThumb(ctx, S, F, x, y, size, noise, key, { coarse = noise } = {}) {
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, size, size); ctx.clip();
  ctx.fillStyle = '#EAEFFC'; ctx.fillRect(x, y, size, size);
  if (F) {
    const cel = segCanvas(F.id, F.k, 'cel'), sx = SQ[0] * cel.width, sw = SQ[2] * cel.width, r = Math.round(lerp(size, 10, Math.sqrt(clamp(coarse))));
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    if (r >= size - 2) ctx.drawImage(cel, sx, 0, sw, cel.height, x, y, size, size);
    else { const sm = pooled(`${key}s`, size, size), c = sm.getContext('2d'); c.clearRect(0, 0, size, size); c.imageSmoothingQuality = 'high'; c.drawImage(cel, sx, 0, sw, cel.height, 0, 0, r, r); ctx.drawImage(sm, 0, 0, r, r, x, y, size, size); }
  }
  if (noise > 0.004) {
    const nv = pooled(`${key}n`, 48, 48), c = nv.getContext('2d'), im = c.createImageData(48, 48), d = im.data, kq = Math.floor(S.t / STEP);
    for (let i = 0; i < 48 * 48; i++) { const h = hash(i, kq, 19), v = (h % 256) / 255, j = ((h >> 8) % 41) - 20; d[i * 4] = lerp(26, 214, v) + j; d[i * 4 + 1] = lerp(32, 222, v); d[i * 4 + 2] = lerp(78, 255, v) - j; d[i * 4 + 3] = 255; }
    c.putImageData(im, 0, 0);
    ctx.globalAlpha = clamp(noise); ctx.imageSmoothingEnabled = true; ctx.drawImage(nv, x, y, size, size);
  }
  ctx.restore();
}
// 第十七轮（用户：右下角 latent preview 窗口里视频的底部一部分到窗口外面了）：以前窗口高 418、图在 44 + 400 = 444，底下伸出去 26 px。
// 现在窗口 368 高、图 306 见方放在 40–346，四周都在窗口里
function previewPanel(ctx, S, F) {
  const t = S.t;
  withPanel(ctx, S, 5, 1, () => {
    const [x, y, w, h] = PREV, sig = sigAt(t), sz = w - 24;
    panelBox(ctx, x, y, w, h, 'latent preview', { sub: `step ${stepAt(t)} · σ ${sig.toFixed(2)}` });
    latentThumb(ctx, S, F, x + 12, y + 40, sz, sig * sig, 'j2latp', { coarse: sig });
    ctx.strokeStyle = DK.edge; ctx.lineWidth = 1; ctx.strokeRect(x + 12.5, y + 40.5, sz - 1, sz - 1);
  });
}
// 89 存图：左下 PNG info（这张图的信息）、底下一排画廊（16 张灰掉的失败图 + 第 17 张）、顶上一条「已保存」
// 第二十一轮（用户：从 ComfyUI 背景到声线切换的网格背景是硬切，要有过渡动画）：最后 0.42 s 这些界面先退场——PNG info 往左滑走、
// 画廊一张张往下掉、「已保存」往上收；画面只剩白底上的她，进场镜头再把白底连成网格（v3a.js entry）。第二十三轮并开关
const exit21 = t => smooth(clamp((t - (T90 - 0.42)) / 0.42));
// 第二十二轮（用户：02:21 周围的 UI 出现时间太晚了，一出现马上又退出，要在完整立绘出现后晚几帧就开始出现）：
// 以前等到存图那一拍（141.67）才出来、0.38 s 后就开始退场；改成九种效果撞成彩色原画（T_HIT ≈ 140.21）后 0.1 s 就出来，停约 1.75 s。（第二十四轮并开关）
const uiT = () => T_HIT() + 0.1;
function pngInfo(ctx, S) {
  const t = S.t, a = t - (uiT() - 0.05), ex = exit21(t);
  if (a < 0 || ex >= 1) return;
  const e = easeOutBack(clamp(a / 0.35), 1.3), x = 28 - 460 * (1 - e) - 480 * easeIn(ex), y = 704, w = 420, h = 236;
  ctx.save(); ctx.globalAlpha *= 0.94 * clamp(a / 0.12) * (1 - ex);
  panelBox(ctx, x, y, w, h, 'PNG info', { sub: 'ComfyUI_00017_.png', th: LT });
  const rows = [['filename', 'output/ComfyUI_00017_.png'], ['size', '2560 × 1440'], ['seed · steps · cfg', '114514 · 16 · 4.5'], ['sampler', 'euler · normal · denoise 1.00'], ['device', '她自己（前 16 张：CUDA OOM）'], ['time', 'Prompt executed in 25.60 seconds']];
  rows.forEach(([k, v], i) => {
    const ry = y + 50 + i * 30, q = easeOut(clamp((a - 0.1 - i * 0.04) / 0.18));
    if (q <= 0) return;
    ctx.save(); ctx.globalAlpha *= q; ctx.translate(-16 * (1 - q), 0);
    ctx.font = fonts(11, 'SC'); ctx.fillStyle = LT.dim; midText(ctx, k, x + 14, ry);
    ctx.font = fonts(13, i === 0 ? 'SCB' : 'SC'); ctx.fillStyle = i === 0 ? BRAND : LT.text; midText(ctx, decode(v, a - 0.1 - i * 0.04, { step: 0.004, settle: 0.06, seed: i }), x + 136, ry);
    ctx.restore();
  });
  ctx.restore();
}
function gallery(ctx, S) {
  const t = S.t, a = t - uiT(), ex = exit21(t);
  if (a < 0 || ex >= 1) return;
  const ts = 52, g = 8, n = 17, tot = n * ts + (n - 1) * g, x0 = (W - tot) / 2, y = H - ts - 28;
  ctx.save(); ctx.globalAlpha = clamp(a / 0.2) * (1 - smooth(clamp(ex * 1.4))); ctx.fillStyle = 'rgba(255,255,255,0.72)'; rrect(ctx, x0 - 16, y - 12, tot + 32, ts + 24, 12); ctx.fill(); ctx.strokeStyle = LT.edge; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
  for (let i = 0; i < n; i++) {
    const e = easeOutBack(clamp((a - i * 0.018) / 0.2), 1.8), x = x0 + i * (ts + g), last = i === 16;
    const drop = easeIn(clamp(ex * 1.6 - Math.abs(i - 8) * 0.04)); // 第二十一轮：从中间往两边一张张掉下去
    if (e <= 0.01 || drop >= 1) continue;
    ctx.save(); ctx.globalAlpha = 1 - drop; ctx.translate(x + ts / 2, y + ts / 2 + 160 * drop); ctx.rotate((rnd(i, 77) - 0.5) * 0.8 * drop); ctx.scale(e * (last ? 1.15 : 1), e * (last ? 1.15 : 1)); ctx.translate(-x - ts / 2, -y - ts / 2);
    if (last) {
      const img = vidFrame('V10', t - T81), m = framesInfo('V10');
      if (img) { ctx.fillStyle = m.bg; ctx.fillRect(x, y, ts, ts); const sw = img.width, sh = sw; ctx.drawImage(img, 0, img.height * 0.04, sw, sh, x, y, ts, ts); }
      ctx.strokeStyle = PINK; ctx.lineWidth = 3; ctx.strokeRect(x - 1, y - 1, ts + 2, ts + 2);
    } else {
      ctx.save(); ctx.globalAlpha *= 0.45; ctx.filter = 'grayscale(1)'; ctx.drawImage(batchImage(i, 128), x, y, ts, ts); ctx.filter = 'none'; ctx.restore();
      ctx.strokeStyle = css(RED, 0.7); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 6, y + 6); ctx.lineTo(x + ts - 6, y + ts - 6); ctx.moveTo(x + ts - 6, y + 6); ctx.lineTo(x + 6, y + ts - 6); ctx.stroke();
    }
    ctx.restore();
  }
  const la = clamp((a - 0.35) / 0.2);
  if (la > 0) { ctx.save(); ctx.globalAlpha = la * (1 - ex); ctx.font = fonts(13, 'ZENB', 'SCB'); ctx.fillStyle = PINK; ctx.textAlign = 'right'; midText(ctx, '第 17 张', x0 + tot, y - 24); ctx.restore(); }
  const ta = easeOutBack(clamp((a - 0.1) / 0.22), 2);
  if (ta > 0.01) {
    const s = '✓ 已保存 · output/ComfyUI_00017_.png';
    ctx.save(); ctx.font = fonts(17, 'SCB'); const tw = ctx.measureText(s).width + 40, cx = 960, cy = 66 - 110 * easeIn(ex);
    ctx.globalAlpha = 1 - ex; ctx.translate(cx, cy); ctx.scale(ta, ta); ctx.fillStyle = css(BRAND, 0.92); rrect(ctx, -tw / 2, -18, tw, 36, 18); ctx.fill(); ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center'; midText(ctx, s, 0, 0); ctx.restore();
  }
}

// ---------------------------------------------------------------- 入口
export function interlude2(ctx, S) {
  const t = S.t, bar = Math.min(89, Math.max(74, S.bar)), F = hasSeg('V9') ? frameAt(t) : null;
  // 第十七轮：这一段 HUD 淡出（白色胶囊在深色界面上太跳），89 最后一拍淡回来接 90 小节
  const hudA = 0.45 * Math.max(1 - smooth(clamp((t - T74) / 0.4)), smooth(clamp((t - beatTime(89, 4)) / 0.35)));
  ATT = null;
  if (!F) { ctx.fillStyle = INK; ctx.fillRect(0, 0, W, H); hud(ctx, S, { alpha: hudA, spectrum: false, lyric: false, ruler: false }); return; }
  if (bar === 74) art74(ctx, S, F);
  else if (bar === 75) art75(ctx, S, F);
  else if (bar === 76) art76(ctx, S, F);
  else if (bar === 77) art77(ctx, S, F);
  else if (bar === 78) art78(ctx, S, F);
  else if (bar === 79) art79(ctx, S, F);
  else if (bar === 80) art80(ctx, S, F);
  else if (bar === 81) art81(ctx, S, F);
  else if (bar <= 88) art8x(ctx, S, F);
  else art89(ctx, S, F);
  const onPaper = (bar === 77 && S.beat >= 3) || (bar >= 84 && bar <= 85) || bar === 87;
  if (bar >= 78 && bar < 88) grain(ctx, S, onPaper);
  if (t < barStart(82)) {
    canvasBg(ctx, chromeVis(t));
    condLayout(ctx, S);
    attnLines(ctx, S); // 连线在窗口下面
    condPanel(ctx, S);
    queuePanel(ctx, S);
    slotPanel(ctx, S, F);
    consolePanel(ctx, S);
    sigmaPanel(ctx, S);
    previewPanel(ctx, S, F);
    attnPorts(ctx, S);
    chrome(ctx, S);
  }
  topBar(ctx, S);
  pngInfo(ctx, S);
  gallery(ctx, S);
  hud(ctx, S, { alpha: hudA, spectrum: false, lyric: false, ruler: false });
}
