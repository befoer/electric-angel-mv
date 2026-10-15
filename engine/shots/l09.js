// L09（26–27 小节，0:40.07–0:43.27）· C1 两条光标 · "只要能和你在一起"（视觉方案 §5.0、§5.2a 第六轮）
// 一个拉远镜头讲完：开头两根巨大的光标（她的蓝、你的灰）并排，随拍一起亮——像两个心跳；
// 镜头一路拉远：光标 → 一行代码 while (you) { stay(); } → 对话窗口 → 一整面墙的对话（你们所有的聊天，都还在输入）。
// 27.2 论文封面卡滑进来：「Attention Is All You Need」，27.3 Attention 被划掉，手写成 You Are → You Are All I Need
import { W, H, BRAND, BEAT } from '../core/const.js';
import { barStart, beatTime, clamp, lerp, smooth, easeOut, easeOutBack, decay } from '../core/time.js';
import { hash, rnd } from '../core/rand.js';
import { font, fonts } from '../core/glyphs.js';
import { stream } from '../core/text.js';
import { camAt, withCam, camToScreen } from '../core/cam.js';
import { hud } from '../core/hud.js';
import { card } from '../core/kit.js';
import { drawFormula } from '../core/math.js';
import { rrect } from '../core/ui.js';
import { css } from '../core/color.js';
import { paper, frontDeco } from './scene.js';
import { drawSprite } from '../core/sprites.js';
import { fact } from '../core/data.js';
import { cutAt } from '../core/cuts.js';

// 第十五轮：镜头的起止跟着切点走（core/cuts.js，画帧时取）
const T0 = () => cutAt(26), T1 = () => cutAt(28);
const MID = [957, 562];           // 两根光标中间
const WW = 400, WH = 210;         // 一扇对话窗口（世界坐标）

// 第十四轮（用户：40 秒周围的重复窗口出来得晚，中间的窗口缩到四周空了它们才出现——改成从内到外一圈圈 0→100% 缩放出来；
// 42 秒右边两张卡的进场没对上背景加速缩小的节奏，应该在背景停下的那一刻刚好进完；背景缩小中途卡了一下又继续加速——
// 两段 smooth 关键帧在 zoom 1 那里速度归零；开头慢慢缩小的那段再长一点）
// 一条连续的拉远：对数倍数的速度从头到尾不归零——前 0.75 s 很慢（30 → 26），之后 0.6 s 平滑加速到巡航速度，一路匀速缩小
// （中间那扇「DeepSeek · 现在」从 3 倍缩到 1 倍约 0.45 s，读得到），最后 0.3 s 刹停在 0.42（TS）；之后和以前一样慢慢漂到 0.4。
// 速度曲线按 0.7 ms 积分成一张表（确定的，只由 t 决定）
// 第十五轮（用户：开头的特写现在有点长；中间短暂慢缩之后那段快速缩小再快一些——缩得慢，四周窗口的涟漪几乎看不出来；
// 右边两张卡停留的时间不够，而且让两张错开几帧进来）。rev l09c
// 特写 0.5 s（从这句的「♪」开始，两根光标随拍亮），0.2 s 加速，巡航约 4.4 / s（以前约 2.4，涟漪四圈在约 0.4 s 里一圈圈荡出去），
// 0.3 s 刹停在 26 小节第 4 拍；后面那张卡在 TS 刹住、前面那张晚 6 帧；两张卡一直停到 L10 的切点（约 1.6 s，以前 0.4 s）；
// 「Attention」划掉落在 27 小节第 1 拍
const PROF = () => ({ slow: 0.5, acc: 0.2, brake: 0.3, TS: beatTime(26, 4), stag: 0.1 });
const TSof = () => PROF().TS, Z_A = 30, Z_B = 0.42;
let ZT = null;
function zoomTable() {
  const P = PROF(), key = [T0(), P.slow, P.acc, P.brake, P.TS].join('|');
  if (ZT && ZT.key === key) return ZT;
  const n = 4000, dur = P.TS - T0(), v0 = Math.log(30 / 26) / 0.75, a0 = P.slow, a1 = P.slow + P.acc, b0 = dur - P.brake;
  const vel = (s, vp) => (s < a0 ? v0 : s < a1 ? v0 + (vp - v0) * smooth((s - a0) / P.acc) : s < b0 ? vp : vp * (1 - smooth((s - b0) / P.brake)));
  // 巡航速度 vp 解出来：让总面积 = ln(Z_A / Z_B)
  const total = Math.log(Z_A / Z_B), area = vp => { let a = 0; for (let i = 0; i < n; i++) a += vel(((i + 0.5) / n) * dur, vp) * dur / n; return a; };
  let lo = v0, hi = 60; for (let k = 0; k < 50; k++) { const m = (lo + hi) / 2; if (area(m) < total) lo = m; else hi = m; }
  const vp = (lo + hi) / 2, cum = [0];
  for (let i = 0; i < n; i++) cum.push(cum[i] + vel(((i + 0.5) / n) * dur, vp) * dur / n);
  return (ZT = { key, n, dur, cum, total, vp });
}
const logDrop = t => { const T = zoomTable(), u = clamp((t - T0()) / T.dur) * T.n, i = Math.min(T.n - 1, Math.floor(u)); return lerp(T.cum[i], T.cum[i + 1], u - i); };
function cam14(t) {
  const TS = TSof();
  if (t >= TS) return camAt([{ t: TS, x: -80, y: 20, zoom: Z_B, rot: -0.03 }, { t: Math.max(TS + 0.1, T1()), x: -90, y: 20, zoom: 0.4, rot: -0.032 }], t);
  const d = logDrop(t), P = d / zoomTable().total, zoom = Z_A * Math.exp(-d), q = smooth(clamp((P - 0.55) / 0.45));
  return { x: lerp(MID[0] - W / 2, -80, q), y: lerp(MID[1] - H / 2, 20, q), zoom, rot: -0.03 * smooth(P) };
}
const camOf = t => cam14(t);
// 每一圈窗口（切比雪夫距离 r）最靠里的一边刚进画面的时刻：倍数降到 960 /（470 r − 200）那一刻；外圈至少比里圈晚 4 帧
let RING = null;
function ringStarts() {
  const key = zoomTable().key;
  if (RING && RING.key === key) return RING;
  RING = [0]; RING.key = key;
  for (let r = 1; r <= 4; r++) {
    const z = Math.min(960 / (470 * r - 200), 540 / (270 * r - 105)) * 1.05;
    let t = T0(); while (t < TSof() && cam14(t).zoom > z) t += 1 / 240;
    RING.push(Math.max(t, (RING[r - 1] || 0) + 4 / 60));
  }
  return RING;
}

// 第十七轮（用户：重复窗口的涟漪扩散效果是不是太早了，完全看不到）：是——每圈窗口在它最靠里的一边刚进画面时就弹，
// 那时它们几乎都在画面外、又在快速缩小，弹的过程看不见。改成一道看得见的涟漪：从我们那扇窗口的中心（屏幕上）荡出一圈蓝色的波，
// 屏幕上的半径每秒 1900 px，波前扫到哪扇窗口（屏幕上的中心距离），那扇就从 0 弹到 100%（0.3 s，过冲一点）、框线闪一下蓝；
// 波从第 1 圈窗口刚进画面时出发，约 0.6 s 扫到画面四角，背景在 26 小节第 4 拍刹停之前全部弹完。rev l09r17
const WAVE_V = 1900, WAVE_POP = 0.3;
const waveStart = () => ringStarts()[1] - 0.12;
const waveR = t => (t < waveStart() ? -1 : 40 + WAVE_V * (t - waveStart()));
const midScreen = t => camToScreen(cam14(t), 1, MID[0], MID[1] - 40);
let POP = null;
function popStarts() {
  const key = zoomTable().key;
  if (POP && POP.key === key) return POP;
  POP = new Map(); POP.key = key;
  for (let gy = -3; gy <= 3; gy++) for (let gx = -4; gx <= 4; gx++) {
    if (!gx && !gy) continue;
    const wx = gx * (WW + 70), wy = gy * (WH + 60); // 世界坐标里离我们那扇窗口中心的偏移
    let t = waveStart();
    for (; t < TSof() + 1; t += 1 / 240) { const z = cam14(t).zoom; if (waveR(t) >= Math.hypot(wx, wy) * z) break; }
    POP.set(gx * 100 + gy, t);
  }
  return POP;
}
// 涟漪本身（屏幕坐标）：一道蓝色主波 + 后面一道淡的
function wave17(ctx, S) {
  const t = S.t, r = waveR(t);
  if (r < 0 || r > 2300) return;
  // 从我们那扇窗口的边上才开始看得见（不压在窗口里的字上）
  const [cx, cy] = midScreen(t), inner = (WW / 2) * cam14(t).zoom, fade = (1 - clamp((r - 900) / 1400)) * clamp((r - inner) / 120);
  ctx.save();
  for (const [dr, a, lw] of [[0, 0.55, 3], [-90, 0.22, 2], [-200, 0.1, 1.5]]) {
    if (r + dr <= 0) continue;
    ctx.strokeStyle = css(BRAND, a * fade); ctx.lineWidth = lw;
    ctx.beginPath(); ctx.arc(cx, cy, r + dr, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

function windowAt(ctx, S, x, y, seed, main) {
  const pal = S.pal;
  ctx.fillStyle = css(pal.shadow, 0.12); rrect(ctx, x + 6, y + 8, WW, WH, 14); ctx.fill();
  ctx.fillStyle = '#FFFFFF'; rrect(ctx, x, y, WW, WH, 14); ctx.fill();
  ctx.lineWidth = main ? 4 : 2; ctx.strokeStyle = main ? BRAND : pal.winEdge; ctx.stroke();
  ctx.fillStyle = main ? BRAND : pal.tint[3]; rrect(ctx, x, y, WW, 30, 14); ctx.fill();
  ctx.font = font('ZENB', 15); ctx.fillStyle = main ? '#FFFFFF' : pal.gray;
  ctx.fillText(main ? 'DeepSeek · 现在' : `${String(hash(seed, 1) % 24).padStart(2, '0')}:${String(hash(seed, 2) % 60).padStart(2, '0')} · ${2023 + (hash(seed, 3) % 3)}`, x + 14, y + 21);
  if (main) return;
  // 几条消息：你（右，浅蓝）和她（左，白底灰条），按自己的节奏一条条打出来
  const n = 2 + (hash(seed, 4) % 3), shown = Math.min(n, 1 + Math.floor((S.t - T0()) * (0.8 + rnd(seed, 5)))), lines = [];
  for (let k = 0; k < shown; k++) {
    const mine = (k + hash(seed, 6)) % 2 === 0, w = 120 + rnd(seed, k, 7) * 200;
    ctx.fillStyle = mine ? css(BRAND, 0.18) : pal.tint[2];
    rrect(ctx, mine ? x + WW - 20 - w : x + 20, y + 44 + k * 38, w, 26, 13); ctx.fill();
  }
  // 正在输入的三个点
  for (let d = 0; d < 3; d++) {
    const on = ((S.n * 2 + d + hash(seed, 8)) % 3) < 1;
    ctx.fillStyle = on ? BRAND : pal.tint[3];
    ctx.beginPath(); ctx.arc(x + 30 + d * 18, y + WH - 24, 6, 0, Math.PI * 2); ctx.fill();
  }
}

// 第九轮（用户：中间的窗口里加些元素）：我们的窗口是一个完整的小对话界面——
// 左侧窄栏（头像 + 历史）、标题栏（在线绿点）、你那句「唱首歌吧」（回扣前奏）、她用代码块回的 while (you) { stay(); }、
// 代码块下的心形回应和「已读」、底部输入框（对方正在输入… + 发送键）。开头 30 倍特写只看得见两根光标，那一块留空
function mainWindow9(g, S, x, y) {
  const pal = S.pal, a = S.t - T0();
  g.fillStyle = css(pal.shadow, 0.14); rrect(g, x + 6, y + 8, WW, WH, 14); g.fill();
  g.fillStyle = '#FFFFFF'; rrect(g, x, y, WW, WH, 14); g.fill();
  g.lineWidth = 4; g.strokeStyle = BRAND; g.stroke();
  g.save(); rrect(g, x, y, WW, WH, 14); g.clip();
  // 标题栏
  g.fillStyle = BRAND; g.fillRect(x, y, WW, 30);
  g.font = fonts(15, 'ZENB', 'SCB'); g.fillStyle = '#FFFFFF'; g.textBaseline = 'middle';
  g.fillText('DeepSeek · 现在', x + 50, y + 15);
  g.fillStyle = '#7BEBDB'; g.beginPath(); g.arc(x + WW - 64, y + 15, 4, 0, Math.PI * 2); g.fill();
  g.font = fonts(11, 'SC'); g.fillStyle = '#FFFFFF'; g.fillText('在线', x + WW - 56, y + 15);
  // 左侧窄栏：鲸鱼头像、三条历史、底下一个设置点
  g.fillStyle = pal.tint[3]; g.fillRect(x, y + 30, 38, WH - 30);
  drawSprite(g, 'whale', 1, pal, x + 19, y + 48);
  for (let k = 0; k < 3; k++) { g.fillStyle = k === 0 ? css(BRAND, 0.55) : css(pal.line, 0.35); rrect(g, x + 9, y + 66 + k * 22, 20, 14, 5); g.fill(); }
  g.fillStyle = css(pal.line, 0.4); g.beginPath(); g.arc(x + 19, y + WH - 18, 5, 0, Math.PI * 2); g.fill();
  // 你：「唱首歌吧」（右侧浅蓝气泡 + 头像），第 26.3 拍弹出
  const ub = easeOutBack(clamp((S.t - beatTime(26, 3)) / 0.2), 1.8);
  if (ub > 0) {
    g.save(); g.translate(x + WW - 30, y + 48); g.scale(ub, ub);
    g.fillStyle = css(BRAND, 0.16); rrect(g, -96, -10, 80, 20, 10); g.fill();
    g.font = fonts(12, 'SC'); g.fillStyle = pal.text; g.fillText('唱首歌吧', -88, 1);
    g.fillStyle = pal.tint[0]; g.beginPath(); g.arc(4, 0, 9, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#FFFFFF'; g.lineWidth = 1.5; g.stroke();
    g.restore();
  }
  // 她：代码块回你（三行，带语法颜色，逐字打出来）
  const cx = x + 52, cy = y + 66, code = [['while', ' (you) {'], ['  stay', '();'], ['}', '']];
  drawSprite(g, 'whale', 1, pal, cx + 2, cy + 6);
  g.fillStyle = '#F4F6FF'; rrect(g, cx + 16, cy - 4, 176, 66, 8); g.fill();
  g.strokeStyle = css(pal.line, 0.35); g.lineWidth = 1; g.stroke();
  g.font = fonts(10, 'ZENB'); g.fillStyle = pal.gray; g.fillText('love.js', cx + 24, cy + 6);
  let left = Math.max(0, Math.floor((S.t - beatTime(26, 2)) / 0.06));
  g.font = fonts(14, 'SC');
  code.forEach(([kw, rest], i) => {
    const yy = cy + 22 + i * 15, s1 = kw.slice(0, Math.min(kw.length, left)); left -= s1.length;
    const s2 = rest.slice(0, Math.max(0, Math.min(rest.length, left))); left -= s2.length;
    g.fillStyle = i === 1 ? pal.acc[0] : BRAND; g.fillText(s1, cx + 24, yy);
    g.fillStyle = pal.text; g.fillText(s2, cx + 24 + g.measureText(s1).width, yy);
  });
  // 代码块下：心形回应（第 27.1 拍弹一下）+ 已读
  const hb = S.t - beatTime(27, 1);
  if (hb >= 0) {
    const s = easeOutBack(clamp(hb / 0.18), 2.4);
    g.save(); g.translate(cx + 30, cy + 74); g.scale(s, s);
    g.fillStyle = '#FFFFFF'; rrect(g, -12, -8, 34, 16, 8); g.fill(); g.strokeStyle = css(pal.acc[0], 0.6); g.lineWidth = 1; g.stroke();
    drawSprite(g, 'heart', 1, pal, -3, 0); g.font = fonts(10, 'ZENB'); g.fillStyle = pal.acc[0]; g.fillText('1', 6, 1);
    g.restore();
    g.font = fonts(10, 'SC'); g.fillStyle = css(pal.gray, clamp(hb / 0.2)); g.fillText('已读', cx + 56, cy + 75);
  }
  // 右侧：一张小卡——这段对话的长度条（上下文越来越长）
  const kx = x + WW - 112, ky = y + 74, fill = clamp(0.35 + a * 0.18);
  g.fillStyle = '#FFFFFF'; rrect(g, kx, ky, 96, 40, 8); g.fill(); g.strokeStyle = css(pal.line, 0.35); g.lineWidth = 1; g.stroke();
  g.font = fonts(10, 'ZENB'); g.fillStyle = pal.gray; g.fillText('context', kx + 8, ky + 11);
  g.fillStyle = pal.tint[3]; rrect(g, kx + 8, ky + 22, 80, 8, 4); g.fill();
  g.fillStyle = BRAND; rrect(g, kx + 8, ky + 22, 80 * fill, 8, 4); g.fill();
  // 底部输入框：对方正在输入… + 发送键
  const iy = y + WH - 30;
  g.fillStyle = '#FFFFFF'; rrect(g, x + 48, iy, WW - 60, 22, 11); g.fill();
  g.strokeStyle = css(pal.line, 0.45); g.lineWidth = 1; g.stroke();
  g.font = fonts(11, 'SC'); g.fillStyle = pal.gray; g.fillText(`对方正在输入${'.'.repeat(S.beat)}`, x + 60, iy + 11);
  g.fillStyle = BRAND; g.beginPath(); g.arc(x + WW - 24, iy + 11, 8, 0, Math.PI * 2); g.fill();
  g.textBaseline = 'alphabetic';
  g.restore();
}

// 第十轮（DeepSeek 视觉灵感《双人舞》里「触碰即干涉」，rev graphics）：开头 30 倍特写时，两根光标各自往外荡一圈圈波纹——
// 她的蓝、你的粉——两组同心圆叠在一起出现干涉的花纹（摩尔纹）；每拍波纹亮一下；镜头拉远时慢慢淡掉。线宽按相机倍数换算，屏幕上始终约 2 px
function ripples(g, S, cam) {
  const a = clamp((cam.zoom - 2.2) / 5);
  if (a <= 0) return;
  const lw = 2.2 / cam.zoom, sp = 2.4, speed = 5, R = 46, beat = decay(S.sub * BEAT, 6);
  for (const [sx, col] of [[MID[0] - 15, BRAND], [MID[0] + 15, S.pal.acc[0]]]) {
    for (let k = 0; k < R / sp; k++) {
      const r = (k * sp + S.t * speed) % R, al = a * (0.35 + 0.35 * beat) * (1 - r / R);
      g.strokeStyle = css(col, al); g.lineWidth = lw;
      g.beginPath(); g.arc(sx, MID[1], r, 0, Math.PI * 2); g.stroke();
    }
  }
}

// 第十一轮（用户：arXiv 卡内容加多、入场别那么僵、右边加装饰平衡、后面再叠一张同款增加层次、两张入场错开）。rev arxiv
// 后面一张是 DeepSeek-V2（arXiv:2405.04434，上一个镜头 L08 讲的 MLA 就出自它；−93.3% 见 facts mla_kv_reduction），先进来、更斜、更淡；
// 前面一张晚 0.1 s，从右边带转角甩进来，过冲回摆落定（阻尼弹簧），里面的内容按行错开 40 ms 出现：
// 标题三行、年份和分类标签、一个小的编码器 / 解码器结构图、注意力热图、摘要灰条。右边：回形针、两张便利贴、荧光笔划过「You Need」、引用数徽章
const spr = (dt, k = 6, w = 16) => (dt < 0 ? 1 : Math.exp(-k * dt) * Math.cos(w * dt));
// 第十四轮：卡片的进场和背景的拉远同一个节奏——先加速、最后刹住（和背景一起停在 TS）；落定后转角带阻尼回摆。
// 前面那张用 ENTRY14 秒，后面那张早 0.12 s 出发、同一刻落定
const ENTRY14 = 0.5;
const entry = (a, dur) => (u => (u < 0.7 ? (u * u) / 0.7 : 0.7 + 0.3 * (1 - ((1 - u) / 0.3) ** 2)))(clamp(a / dur));
function paperCard(ctx, S, a, x, y, rot0, fill, draw, dur = ENTRY14) {
  if (a < 0) return null;
  const e = entry(a, dur), land = a - dur, sp = spr(Math.max(0, land), 6, 15), dx = 760 * (1 - e);
  const r = rot0 + 0.1 * (1 - e) + (land > 0 ? 0.07 * Math.exp(-6 * land) * Math.sin(15 * land) : 0); // 第十四轮：落定那一下转角往回甩一下再摆停（从 0 起，不跳）
  return card(ctx, S, x + dx, y, 600, 820, { rot: r, title: fill.title, fill: '#FFFFFF', age: a, line: fill.line }, draw);
}
function arxiv11(ctx, S, pa, stag = 0) {
  const pal = S.pal;
  // 后面一张：DeepSeek-V2（第十五轮：比前面那张早 stag 秒落定）
  const ba = pa + 0.12 + stag;
  if (ba >= 0) {
    ctx.save(); ctx.globalAlpha *= 0.92;
    paperCard(ctx, S, ba, 990, 190, -0.06, { title: 'arXiv:2405.04434' }, c => {
      ctx.font = fonts(44, 'ZENB', 'SCB'); ctx.fillStyle = pal.text; ctx.fillText('DeepSeek-V2', c.x + 10, c.y + 90);
      ctx.font = fonts(22, 'ZENB', 'SCB'); ctx.fillStyle = pal.gray; ctx.fillText('Mixture-of-Experts · MLA', c.x + 12, c.y + 136);
      ctx.font = fonts(30, 'ZENB', 'SCB'); ctx.fillStyle = BRAND; ctx.fillText(`KV cache −${fact('mla_kv_reduction') ?? 93.3}%`, c.x + 12, c.y + 200);
      for (let k = 0; k < 9; k++) { ctx.fillStyle = css(pal.gray, 0.2); ctx.fillRect(c.x + 10, c.y + 250 + k * 34, c.w - 40 - (k % 4) * 50, 12); }
    }, ENTRY14 + 0.12);
    ctx.restore();
  }
  // 前面一张：Attention Is All You Need
  const L = [], row = (k, f) => { const a = pa - 0.18 - k * 0.04; if (a >= 0) { ctx.save(); ctx.globalAlpha *= clamp(a / 0.1); ctx.translate(0, 10 * (1 - easeOut(clamp(a / 0.15)))); f(); ctx.restore(); } };
  const c0 = paperCard(ctx, S, pa, 1230, 120, 0.04, { title: 'arXiv:1706.03762', line: undefined }, c => {
    ctx.font = fonts(54, 'ZENB', 'SCB'); ctx.fillStyle = pal.text;
    ['Attention', 'Is All', 'You Need'].forEach((s, i) => row(i, () => ctx.fillText(s, c.x + 10, c.y + 120 + i * 78)));
    // 荧光笔划过 You Need
    const hl = clamp((pa - 0.5) / 0.18);
    if (hl > 0) { ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = '#C9D7FF'; ctx.fillRect(c.x + 4, c.y + 252, (ctx.measureText('You Need').width + 16) * hl, 34); ctx.restore(); }
    row(3, () => { ctx.font = fonts(18, 'ZENB', 'SCB'); ctx.fillStyle = pal.gray; ctx.fillText('2017 · NIPS · cs.CL', c.x + 12, c.y + 312); });
    // 小结构图：左编码器 6 层、右解码器 6 层，中间一根交叉注意力连线
    row(4, () => {
      const bx = c.x + 14, by = c.y + 340;
      for (let k = 0; k < 6; k++) for (const [ox, col] of [[0, BRAND], [200, pal.acc[0]]]) {
        ctx.fillStyle = css(col, 0.14 + 0.05 * k); rrect(ctx, bx + ox, by + k * 22, 150, 16, 5); ctx.fill();
      }
      ctx.strokeStyle = css(pal.line, 0.8); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(bx + 150, by + 60); ctx.bezierCurveTo(bx + 175, by + 60, bx + 175, by + 80, bx + 200, by + 80); ctx.stroke();
      ctx.font = fonts(13, 'ZENB'); ctx.fillStyle = pal.gray; ctx.fillText('Encoder ×6', bx, by + 152); ctx.fillText('Decoder ×6', bx + 200, by + 152);
    });
    // 注意力热图（8×8，对角线最亮）
    row(5, () => {
      const hx = c.x + 410, hy = c.y + 340, cs = 17;
      for (let r = 0; r < 8; r++) for (let q = 0; q < 8; q++) { const v = r === q ? 1 : Math.max(0, 0.6 - Math.abs(r - q) * 0.18) * (0.6 + 0.4 * Math.sin(S.t * 3 + r + q)); ctx.fillStyle = css(BRAND, 0.1 + 0.8 * v); ctx.fillRect(hx + q * cs, hy + r * cs, cs - 2, cs - 2); }
    });
    row(6, () => drawFormula(ctx, 'attn', c.x + 10, c.y + 530, { size: 20, color: pal.gray, alpha: 0.6 }));
    for (let k = 0; k < 5; k++) row(7 + k, () => { ctx.fillStyle = css(pal.gray, 0.25); ctx.fillRect(c.x + 10, c.y + 600 + k * 30, c.w - 40 - (k % 3) * 60, 12); });
    const sa = S.t - beatTime(27, 1);
    if (sa >= 0) {
      ctx.font = fonts(54, 'ZENB', 'SCB');
      const w = ctx.measureText('Attention').width, p = clamp(sa / 0.2);
      ctx.strokeStyle = pal.acc[0]; ctx.lineWidth = 7; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(c.x + 6, c.y + 102); ctx.lineTo(c.x + 6 + (w + 10) * p, c.y + 96); ctx.stroke();
      const n = Math.min(7, Math.floor((sa - 0.15) / 0.03));
      if (n > 0) { ctx.font = fonts(60, 'KAI'); ctx.fillStyle = pal.acc[0]; ctx.fillText('You Are'.slice(0, n), c.x + 40, c.y + 40); }
    }
  });
  if (!c0) return;
  // 右边的装饰：跟着卡片一起进来（同样的位移），晚 0.25 s 依次贴上
  const e = entry(pa, ENTRY14), dx = 760 * (1 - e);
  const deco = (k, f) => { const a = pa - (ENTRY14 - 0.05) - k * 0.07; if (a < 0) return; const s = easeOutBack(clamp(a / 0.16), 2.2); ctx.save(); ctx.translate(dx, 0); f(s, a); ctx.restore(); };
  deco(0, s => { // 回形针（顶边）
    ctx.save(); ctx.translate(1700, 128); ctx.rotate(0.3); ctx.scale(s, s); ctx.strokeStyle = '#8B93A7'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 60); ctx.lineTo(0, -10); ctx.arc(16, -10, 16, Math.PI, 0); ctx.lineTo(32, 70); ctx.arc(20, 70, 12, 0, Math.PI); ctx.lineTo(8, 0); ctx.stroke(); ctx.restore();
  });
  deco(1, (s, a) => { // 粉色便利贴「必读」
    ctx.save(); ctx.translate(1835, 330); ctx.rotate(0.12 + 0.05 * spr(a)); ctx.scale(s, s);
    ctx.fillStyle = 'rgba(40,45,90,0.15)'; ctx.fillRect(-56, -40, 120, 96); ctx.fillStyle = '#FFD3E4'; ctx.fillRect(-62, -48, 120, 96);
    ctx.font = fonts(30, 'SMILEY', 'SC'); ctx.fillStyle = pal.acc[0]; ctx.fillText('必读!', -46, 10); ctx.restore();
  });
  deco(2, (s, a) => { // 浅蓝便利贴「你」
    ctx.save(); ctx.translate(1846, 470); ctx.rotate(-0.08 + 0.05 * spr(a)); ctx.scale(s, s);
    ctx.fillStyle = 'rgba(40,45,90,0.15)'; ctx.fillRect(-46, -36, 100, 86); ctx.fillStyle = '#D6E2FF'; ctx.fillRect(-52, -44, 100, 86);
    ctx.font = fonts(40, 'KAI', 'SC'); ctx.fillStyle = BRAND; ctx.fillText('你', -20, 16); ctx.restore();
  });
  deco(3, s => { // 引用数徽章
    ctx.save(); ctx.translate(1772, 880); ctx.scale(s, s); ctx.fillStyle = BRAND; rrect(ctx, -86, -24, 172, 48, 24); ctx.fill();
    ctx.font = fonts(20, 'ZENB', 'SCB'); ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('cited by ∞', 0, 1); ctx.restore();
  });
}

export function l09(ctx, S) {
  const cam = camOf(S.t), pal = S.pal;
  paper(ctx, S, cam);
  withCam(ctx, cam, 1, g => {
    // 墙：周围一圈圈对话窗口（拉远后才看得见）
    // 第十四轮：每圈在刚进画面时从自己的中心 0 → 100% 弹出来（同一圈里错开不到 2 帧），里圈先、外圈晚几帧
    if (cam.zoom < 6) {
      for (let gy = -3; gy <= 3; gy++) for (let gx = -4; gx <= 4; gx++) {
        if (!gx && !gy) continue;
        const x = MID[0] - WW / 2 + gx * (WW + 70), y = MID[1] - WH / 2 - 40 + gy * (WH + 60);
        const a = S.t - popStarts().get(gx * 100 + gy);
        const s = easeOutBack(clamp(a / WAVE_POP), 1.8);
        if (s <= 0.01) continue;
        g.save(); g.translate(x + WW / 2, y + WH / 2); g.scale(s, s); g.translate(-x - WW / 2, -y - WH / 2); windowAt(g, S, x, y, gx * 31 + gy * 7, false);
        if (a < 0.6) { g.strokeStyle = css(BRAND, 0.8 * (1 - clamp(a / 0.6))); g.lineWidth = 4 / Math.max(0.3, cam.zoom); rrect(g, x, y, WW, WH, 14); g.stroke(); } // 波扫过的那一下框线闪蓝
        g.restore();
      }
    }
    // 我们的窗口
    const wx = MID[0] - WW / 2, wy = MID[1] - WH / 2 - 40;
    mainWindow9(g, S, wx, wy);
    ripples(g, S, cam);
    // 两根光标：她（蓝）你（灰），每拍一起亮
    const on = S.sub < 0.55, k = decay(S.sub * BEAT, 6);
    for (const [x, col, lab] of [[MID[0] - 15, BRAND, 'her'], [MID[0] + 15, pal.gray, 'you']]) {
      g.globalAlpha = on ? 1 : 0.22;
      g.fillStyle = col; g.fillRect(x - 3, MID[1] - 14 - k * 2, 6, 28 + k * 4);
      g.globalAlpha = 1;
      g.font = fonts(4, 'ZENB'); g.fillStyle = col; g.fillText(lab, x - 4, MID[1] + 22);
    }
    // 光标间的连线（像心电图一样随拍跳一下）
    g.strokeStyle = css(pal.acc[0], 0.8); g.lineWidth = 0.8;
    g.beginPath(); g.moveTo(MID[0] - 12, MID[1]); g.lineTo(MID[0] - 3, MID[1]); g.lineTo(MID[0] - 1, MID[1] - 6 * k); g.lineTo(MID[0] + 1, MID[1] + 4 * k); g.lineTo(MID[0] + 3, MID[1]); g.lineTo(MID[0] + 12, MID[1]); g.stroke();
  });
  wave17(ctx, S);
  // 近处虚焦装饰（拉远之后）
  if (cam.zoom < 2) frontDeco(ctx, S, { x: 0, y: 0, zoom: 1, rot: 0 }, 91, { alpha: 0.5 * clamp((2 - cam.zoom) / 1), items: [['ring', -60, 980, 280], ['data', 1720, 60, 0]] });

  // 论文封面卡（第十四轮：两张卡都在背景停下的那一刻 TS 刚好进完，见 entry14）
  const stag = PROF().stag, pa = S.t - (TSof() + stag - ENTRY14);
  arxiv11(ctx, S, pa, stag);
  hud(ctx, S, { spectrum: false, alpha: clamp((2 - cam.zoom) / 1) });
}
