// L01 外壳（10–11 小节，0:14.47–0:17.67）· 落点在显示器里（第八轮，用户：显示器别撑满，留到 17 秒切镜头）
// 前奏缩进的那台显示器一直留在画面里，L01 在屏幕里播（l01.js 不变，画进屏幕）；落点时显示器踢一下、精灵从屏幕里迸出；
// 唱到「歌」时这个字从屏幕里冲出来、越过边框，再收回去；屏幕上方是 stdin 词元条（这句歌词逐字进框）。17.67 甩镜头进 L02
import { W, H, BRAND, STEP } from '../core/const.js';
import { clamp, lerp, smooth, easeOut, easeIn, easeOutBack, decay } from '../core/time.js';
import { fonts, font } from '../core/glyphs.js';
import { keyword, lyric } from '../core/data.js';
import { dropBurst } from '../core/sprites.js';
import { flash, shake } from '../core/fx.js';
import { css } from '../core/color.js';
import { monitorStage, crtAt, CRT_C, T_DROP } from './intro.js';
import { l01, mouth24, candidates } from './l01.js';
import { tokenStrip } from './scene.js';
import { pooled } from '../core/cam.js';
import { rnd } from '../core/rand.js';
import { rev } from '../rev.js';

// ---------------------------------------------------------------- 第十四轮「歌」（用户：「歌」换一种表现形式——现在的字太抢眼，动画细节却不如背景）
// 不再是一整块实心的蓝色大字，换成和开场点阵、前奏字符场同一种语言的点阵字：字形按 52×52 取样成约九百个小方点（圆体粗体），
//   0–0.42 s 点从屏幕中心一颗颗飞出来（按到字中心的远近错开，各自走一条弯的路径，到位时过冲一下），拼成字；
//   0.42–1.0 停留：一道解码扫描线从上往下扫过，扫到的点先亮成白再落回蓝；四角取景框 + 一行小标签「token · 歌」；
//            每拍从字中心往外荡一圈点的放大（只作用在这个字上，R4）；
//   1.0–1.45 收回：点按相反的顺序加速被吸回屏幕中心。点有深浅两层（后面一层浅色点错开 3 px 当厚度），整体比实心字轻得多
const GE14 = { N: 52, PITCH: 9.5, DOT: 7.2 };
let GE14_CELLS = null;
function geCells(ch) {
  if (GE14_CELLS && GE14_CELLS.ch === ch) return GE14_CELLS.list;
  const N = GE14.N, cv = pooled('ge14raster', N, N), c = cv.getContext('2d');
  c.clearRect(0, 0, N, N); c.font = fonts(Math.round(N * 0.9), 'ZENB', 'SCB'); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#000'; c.fillText(ch, N / 2, N / 2 + 1);
  const d = c.getImageData(0, 0, N, N).data, list = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (d[(j * N + i) * 4 + 3] > 110) list.push({ i, j, r: Math.hypot(i - N / 2, j - N / 2) / (N / 2), k: list.length });
  GE14_CELLS = { ch, list };
  return list;
}
// 第二十五轮（用户：0:15 人物左边「歌」字还没出来的时候的空白增加些东西；「歌」字最后不要收回去）。开关 l01s26 第二十八轮并进代码
// · 落点后 0.25 s 起，「歌」将要拼出来的那块地方先出现一张淡淡的 52×52 点阵格 + 灰色取景框，格子里每个十六分音符按候选概率闪一个候选字的点阵
//   （歌 / 饭 / 鲸 / 不，和屏幕右上「next token」卡同一组，歌的概率从 0.34 涨到 0.92，越往后越常是它），下面标签写 p(歌)；
//   唱到「歌」时真正的点从她嘴里飞进来盖住它，候选格淡掉——"采样"落定成这个字
// · 拼好的「歌」一直留到这个镜头结束（跟着甩镜进 L02），不再被吸回她嘴里；取景框和标签也一直在

let GE26 = null;
function candCells(ch) { // 候选字的格子（和 geCells 同样取样，按字缓存）
  GE26 = GE26 || new Map(); if (GE26.has(ch)) return GE26.get(ch);
  const N = GE14.N, cv = pooled('ge26raster', N, N), c = cv.getContext('2d');
  c.clearRect(0, 0, N, N); c.font = fonts(Math.round(N * 0.9), 'ZENB', 'SCB'); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#000'; c.fillText(ch, N / 2, N / 2 + 1);
  const d = c.getImageData(0, 0, N, N).data, list = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (d[(j * N + i) * 4 + 3] > 110) list.push([i, j]);
  GE26.set(ch, list); return list;
}
function geSampling(ctx, S, pOut, kw, a) {
  const t = S.t, va = smooth(clamp((t - T_DROP - 0.25) / 0.3)) * (1 - smooth(clamp((a + 0.04) / 0.3)));
  if (va <= 0.01) return;
  const { N, PITCH, DOT } = GE14, ox = pOut[0] - (N * PITCH) / 2, oy = pOut[1] - (N * PITCH) / 2, u = clamp((t - T_DROP) / Math.max(0.1, kw.t0 - T_DROP));
  ctx.save(); ctx.globalAlpha = va;
  ctx.fillStyle = css('#9DB0F5', 0.45); // 点阵格
  for (let j = 1; j < N; j += 2) for (let i = 1; i < N; i += 2) ctx.fillRect(ox + i * PITCH - 1, oy + j * PITCH - 1, 2, 2);
  const step = Math.floor((t - T_DROP) / STEP), cs = candidates(S, kw, T_DROP + 4 * STEP), wts = cs.map(c => c.u), sum = wts.reduce((s, v) => s + v, 0); // 和右上「next token」卡同一组数
  let r = rnd(step, 2601) * sum, pick = 0; while (pick < 3 && r > wts[pick]) { r -= wts[pick]; pick++; }
  const ch = cs[pick].k, kick = decay(t - (T_DROP + step * STEP), 14);
  ctx.fillStyle = pick === 0 ? css(BRAND, 0.48 + 0.2 * kick) : css('#8A93B8', 0.4 + 0.2 * kick);
  for (const [i, j] of candCells(ch)) if (rnd(i, j, step, 2602) < 0.8) ctx.fillRect(ox + i * PITCH - DOT * 0.28, oy + j * PITCH - DOT * 0.28, DOT * 0.56, DOT * 0.56);
  const half = (N * PITCH) / 2 + 30, L = 46; // 灰色取景框 + 标签
  ctx.strokeStyle = css('#8A93B8', 0.8); ctx.lineWidth = 2; ctx.setLineDash([10, 8]); ctx.lineDashOffset = -t * 30; ctx.beginPath();
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const cx = pOut[0] + sx * half, cy = pOut[1] + sy * half; ctx.moveTo(cx, cy - sy * L); ctx.lineTo(cx, cy); ctx.lineTo(cx - sx * L, cy); }
  ctx.stroke(); ctx.setLineDash([]);
  ctx.font = fonts(20, 'ZENB', 'SCB'); ctx.fillStyle = css('#6B74A0', 0.95); ctx.textBaseline = 'top';
  ctx.fillText(`sampling · next token · p(${kw.c}) = ${cs[0].v}`, pOut[0] - half, pOut[1] + half + 10); ctx.textBaseline = 'alphabetic';
  ctx.restore();
}
// 第二十六轮：她的手在最终版 I03 里更靠左，「歌」的取景框右下角会压到指尖，整个字往上挪 20 px（开关 l01h26 第二十八轮并进代码）
const geOut = g => [g.cx - 340, g.cy - 60];
function geDots(ctx, S, g, kw, a) {
  if (a < 0) { geSampling(ctx, S, geOut(g), kw, a); return; }
  // 第二十四轮：屏幕里是正在唱的她（l01.js singer24），点从她嘴里飞出来、在她左边拼成字（不挡她的脸）；显示器中心会往下挪，落点跟着走（第二十六轮并开关 l01d24）
  const [x, y, w, h] = g.screen, m = mouth24(S.t);
  const pIn = [x + w * (m[0] / W), y + h * (m[1] / H)], pOut = geOut(g), p = S.pal, { N, PITCH, DOT } = GE14;
  geSampling(ctx, S, pOut, kw, a); // 候选格在真正的点飞进来时淡掉
  const cells = geCells(kw.c), ox = pOut[0] - (N * PITCH) / 2, oy = pOut[1] - (N * PITCH) / 2;
  const scan = clamp((a - 0.45) / 0.4);
  ctx.save();
  // 取景框和标签：落定后出现，一直在（第二十五轮起不收回）
  const fr = clamp((a - 0.36) / 0.14);
  if (fr > 0) {
    const half = (N * PITCH) / 2 + 30, L = 46, o = 18 * (1 - easeOut(clamp((a - 0.36) / 0.2)));
    ctx.globalAlpha = fr; ctx.strokeStyle = BRAND; ctx.lineWidth = 3; ctx.beginPath();
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const cx = pOut[0] + sx * (half + o), cy = pOut[1] + sy * (half + o); ctx.moveTo(cx, cy - sy * L); ctx.lineTo(cx, cy); ctx.lineTo(cx - sx * L, cy); }
    ctx.stroke();
    // 第二十四轮：字挪到左边以后，上方的标签会压到屏幕里公式卡的标签，改放到取景框下面
    ctx.font = fonts(20, 'ZENB', 'SCB'); ctx.fillStyle = BRAND; ctx.textBaseline = 'top'; ctx.fillText(`token · ${kw.c}`, pOut[0] - half - o, pOut[1] + half + o + 10); ctx.textBaseline = 'alphabetic';
    ctx.globalAlpha = 1;
  }
  // 起点：屏幕正中一个缩小的同款点阵字（就是屏幕里唱到的那个字），每颗点从它在小字里的位置飞到大字里的位置
  const sp = ((w / W) * 560) / (N * PITCH), sx0 = pIn[0] - (N * PITCH * sp) / 2, sy0 = pIn[1] - (N * PITCH * sp) / 2;
  for (const layer of [1, 0]) for (const c of cells) {
    const d0 = 0.06 + 0.26 * c.r + rnd(c.k, 31) * 0.05, fa = (a - d0) / 0.22; // 飞出（字中心先走）
    const e = easeOutBack(clamp(fa), 1.5), tx = ox + c.i * PITCH, ty = oy + c.j * PITCH, fx = sx0 + c.i * PITCH * sp, fy = sy0 + c.j * PITCH * sp;
    const bend = (rnd(c.k, 33) - 0.5) * 220, mx = (fx + tx) / 2 + bend, my = (fy + ty) / 2 - 100 * rnd(c.k, 34);
    const fe = clamp(fa), q = 1 - fe; // 二次贝塞尔：小字里的位置 → 控制点 → 大字里的位置
    let px = q * q * fx + 2 * q * fe * mx + fe * fe * tx, py = q * q * fy + 2 * q * fe * my + fe * fe * ty;
    // 每拍从字中心往外荡一圈放大
    const ripple = Math.max(0, 1 - Math.abs(S.sub * 2.2 - c.r) * 4) * (a > 0.45 ? 1 : 0);
    const born = clamp(a / 0.06), small = DOT * sp * 1.1 * born;
    const s = (fa <= 0 ? small : lerp(small, DOT, fa < 1 ? e : 1)) * (1 + 0.35 * ripple);
    const lit = scan > 0 && scan < 1 && Math.abs(c.j / N - scan) < 0.06;
    if (layer) { ctx.fillStyle = css('#9DB0F5', 0.45); ctx.fillRect(px - s / 2 + 3, py - s / 2 + 3, s, s); continue; }
    ctx.fillStyle = lit ? '#FFFFFF' : c.k % 23 === 0 ? p.acc[0] : css(BRAND, 0.72 + 0.28 * rnd(c.k, 35));
    ctx.fillRect(px - s / 2, py - s / 2, s, s);
  }
  // 扫描线
  if (scan > 0 && scan < 1) { ctx.fillStyle = css('#FFFFFF', 0.8); ctx.fillRect(ox - 20, oy + scan * N * PITCH, N * PITCH + 40, 2); }
  ctx.restore();
}

export function l01m(ctx, S) {
  const age = S.t - T_DROP, [sx, sy] = shake(S.t, 9 * decay(age, 7));
  // 整个舞台的相机：落点轻抖，之后慢慢推近、微微侧倾
  const z = 1 + 0.03 * smooth(age / 3.2), rot = 0.012 * Math.sin(age * 1.4) * smooth(age / 0.8); // 第二十四轮：显示器本身大了，推近减半
  ctx.save();
  ctx.translate(W / 2 + sx, H / 2 + sy); ctx.rotate(rot); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2);
  const g = monitorStage(ctx, S, c => { l01(c, S); flash(c, 0.3 * decay(age, 12)); }, { lock: 'NOW SINGING · L01' });
  // 落点：精灵从屏幕中心迸出，飞到显示器外面
  dropBurst(ctx, S, T_DROP, { cx: CRT_C[0], cy: CRT_C[1] });
  // 「歌」从屏幕里冲出来再收回去
  const kw = keyword('L01', 5, 6)[0], ka = S.t - kw.t0;
  geDots(ctx, S, g, kw, ka);
  // 屏幕上方：stdin 词元条
  const L = lyric('L01');
  ctx.save(); ctx.font = fonts(34, 'ZEN', 'J');
  const tw = L.chars.reduce((a, c) => a + ctx.measureText(c.c).width + 24, 0); ctx.restore();
  tokenStrip(ctx, S, L.chars, W / 2 - tw / 2, 40, { size: 34, label: 'stdin · L01' });
  ctx.restore();
}
