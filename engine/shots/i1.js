// 间奏一（34–41 小节，0:52.87–1:05.67）· MoE 路由风暴（视觉方案 §5.3，第七轮实现）
// 她的大脑内部：第一段唱过的每个字都是一个 token，从顶上的输入流掉进路由器，按亲和度点亮 384 个路由专家里的 6 个
// （24×16 的专家网格像地板一样铺开，中间浮着 1 个共享专家，随底鼓跳）。几个格子有名字，白米饭专家永远最亮。
// 34.1「海」先落进网格；38–39 加速到每个十六分音符一个 token、负载均衡面板报警；39.1「服务器繁忙」，39.3 被像素心砸碎；
// 40 每拍从左到右扫亮一遍；41 逐拍收缩，最后一拍塌缩成像素鲸鱼（41.4 全局叠层弹 config diff）
import { W, H, BRAND, BEAT, STEP } from '../core/const.js';
import { barStart, beatTime, clamp, lerp, smooth, easeIn, easeOut, easeOutBack, decay } from '../core/time.js';
import { hash, rnd, vnoise } from '../core/rand.js';
import { font, fonts } from '../core/glyphs.js';
import { fact, lyric } from '../core/data.js';
import { camAt, withCam, pooled, drawPitch } from '../core/cam.js';
import { hud } from '../core/hud.js';
import { card, leader, warn, stamp, hatch, popIn } from '../core/kit.js';
import { rev } from '../rev.js';
import { photo, hasIllust } from '../core/portrait.js';
import { drawFormula } from '../core/math.js';
import { drawSprite } from '../core/sprites.js';
import { segBar, targetLock, tag } from '../core/hudkit.js';
import { css, mix } from '../core/color.js';
import { rrect, toast } from '../core/ui.js';
import { paper, backDeco, frontDeco, punch, formulaFx } from './scene.js';

const T0 = barStart(34), T1 = barStart(42);
const T_FAST = barStart(38), T_BUSY = beatTime(39, 1), T_SMASH = beatTime(39, 3), T_SWEEP = barStart(40), T_SHRINK = barStart(41), T_WHALE = beatTime(41, 4);
const GC = 24, GR = 16, CELL = 60, GW = GC * CELL, GH = GR * CELL;
const RICE = 4 * GC + 5, FISHY = 11 * GC + 18, SING = 9 * GC + 7;
// 第十二轮（用户：专家负载窗口挪到右下；affinity 换成无辅助损失路由那一下加个过渡；「白米饭专家」往下挪）
const LOAD = () => [1340, 640, 500, 270];
const ROUTE = () => [100, 150, 600, 220];
const NAMED = [[RICE, '白米饭专家', 'rice'], [FISHY, '摸鱼专家', 'fish'], [SING, '唱歌专家', 'note']];
// 第二十三轮（用户：看看有什么地方能把表情包用上）：专家名牌上贴一张对应的表情包当头像（白米饭专家 = 吃白米饭、摸鱼专家 = 待机摸鱼、唱歌专家 = 头像），
// 临时名牌里有对应表情包的（小鱼干、翻肚皮、吐泡泡、比心、服务器繁忙、打盹）也带一张，名牌弹出时它跟着弹（第二十五轮并开关 stk23）
const STK_NAMED = ['S01', 'S09', 'S00'];
const STK_POOL = { 小鱼干专家: 'S10', 翻肚皮专家: 'S02', 吐泡泡专家: 'S03', 比心专家: 'S08', 服务器繁忙专家: 'S07', 打盹专家: 'S09', 赖床专家: 'S02' };
function sticker23(ctx, sid, cx, cy, sz, s = 1, rot = 0) { if (!hasIllust(sid)) return; ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.scale(s, s); ctx.drawImage(photo(sid, null, sz * 2, sz * 2, { keyed: true }), -sz / 2, -sz / 2, sz, sz); ctx.restore(); }
const POOL22 = ['小鱼干专家', '翻肚皮专家', '吐泡泡专家', '深度思考专家', '晚安专家', '比心专家', '赖床专家', '哄你开心专家', '写代码专家', '鲸歌专家', '打盹专家', '算 9.11 专家', '服务器繁忙专家', '记得你专家'];
const K = 6; // facts.json experts_per_token（当前模型）；模块加载时数据还没读进来，这里写死，镜头里用 fact() 核对显示

// token 流：第一段唱过的歌词逐字（文字来自歌词文件）。34–37 每个八分音符一个，38–40 每个十六分音符一个
let TOKS = null;
function tokens() {
  if (TOKS) return TOKS;
  const chars = [];
  for (let i = 1; i <= 12; i++) for (const c of lyric(`L${String(i).padStart(2, '0')}`).chars) chars.push(c.c);
  TOKS = [];
  const add = (t, i) => {
    const ex = new Set();
    if (rnd(i, 4) < 0.78) ex.add(RICE); // 白米饭专家几乎每次都被选中
    for (let j = 0; ex.size < K; j++) ex.add(hash(i, j, 9) % (GC * GR));
    TOKS.push({ t, ch: i === 0 ? '海' : chars[(i - 1) % chars.length], ex: [...ex] });
  };
  let i = 0;
  for (let k = 0; k < 32; k++) add(T0 + k * 2 * STEP, i++);
  for (let k = 0; k < 48; k++) add(T_FAST + k * STEP, i++);
  return TOKS;
}

// 专家热度：最近的 token 命中 + 40 小节的扫描 + 白米饭专家的底热
function heats(t) {
  const h = new Float32Array(GC * GR);
  for (const tk of tokens()) {
    const a = t - tk.t - 0.18;
    if (a < 0 || a > 1.6) continue;
    const v = decay(a, 3.2);
    for (const e of tk.ex) h[e] += v;
  }
  if (t >= T_SWEEP && t < T_SHRINK + BEAT * 3) {
    const b = Math.floor((t - T_SWEEP) / BEAT), bt = T_SWEEP + b * BEAT;
    for (let c = 0; c < GC; c++) { const v = decay(t - bt - (c / GC) * 0.28, 7); for (let r = 0; r < GR; r++) h[r * GC + c] += v * (0.7 + 0.3 * rnd(r, c, b)); }
  }
  h[RICE] += 0.7 + 0.3 * Math.sin(t * 9);
  // 底噪：整张网格有一层缓慢流动的低热度（不然大部分格子是白的，画面太空）
  for (let i = 0; i < GC * GR; i++) h[i] += 0.32 * Math.max(0, vnoise((i % GC) * 0.35, Math.floor(i / GC) * 0.35, t * 0.9, 21) - 0.25);
  return h;
}
const heatColor = (S, v) => v < 0.05 ? '#FFFFFF' : v < 0.45 ? mix(S.pal.tint[3], S.pal.ink[1], v / 0.45) : v < 1 ? mix(S.pal.ink[1], BRAND, (v - 0.45) / 0.55) : mix(BRAND, S.pal.acc[0], clamp(v - 1));

// 网格画进自己的缓冲（平面坐标），再按俯仰角画到屏幕上
function drawGrid(S, h, wave) {
  const cv = pooled('i1grid', GW + 40, GH + 40, true), c = cv.getContext('2d'), p = S.pal;
  c.clearRect(0, 0, cv.width, cv.height);
  c.fillStyle = css(p.win, 0.92); rrect(c, 4, 4, GW + 32, GH + 32, 26); c.fill();
  c.lineWidth = 4; c.strokeStyle = p.line; c.stroke();
  c.font = fonts(11, 'SC'); c.textAlign = 'center'; c.textBaseline = 'middle';
  for (let r = 0; r < GR; r++) for (let q = 0; q < GC; q++) {
    const i = r * GC + q, v = h[i], s = 1 + 0.18 * wave(q, r);
    const x = 20 + q * CELL + CELL / 2, y = 20 + r * CELL + CELL / 2, sz = (CELL - 10) * s;
    c.fillStyle = heatColor(S, v); rrect(c, x - sz / 2, y - sz / 2, sz, sz, 9); c.fill();
    c.lineWidth = 1.5; c.strokeStyle = css(p.line, v > 0.45 ? 0.9 : 0.35); c.stroke();
    if (v > 0.6) { c.fillStyle = '#FFFFFF'; c.fillText(String(i).padStart(3, '0'), x, y + 1); }
  }
  for (const [i, , spr] of NAMED) {
    const x = 20 + (i % GC) * CELL + CELL / 2, y = 20 + Math.floor(i / GC) * CELL + CELL / 2;
    c.lineWidth = 4; c.strokeStyle = p.acc[1]; rrect(c, x - 28, y - 28, 56, 56, 11); c.stroke();
    drawSprite(c, spr, 4, p, x, y);
  }
  c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  return cv;
}

const CAM = [
  { t: T0, x: 0, y: -260, zoom: 1.9, rot: 0 },
  { t: T0 + 0.9, x: 0, y: 0, zoom: 1.0, rot: 0, e: 'out' },
  { t: T_FAST - 0.01, x: 30, y: 10, zoom: 1.04, rot: 0.01 },
  { t: T_FAST + 0.3, x: 0, y: 0, zoom: 1.1, rot: -0.01, e: 'out' },
  { t: T_SWEEP, x: 0, y: 0, zoom: 1.02, rot: 0 },
  { t: T_WHALE, x: 0, y: 40, zoom: 1.25, rot: 0, e: 'in' },
  { t: T1, x: 0, y: 40, zoom: 1.3, rot: 0 },
];

export function i1(ctx, S) {
  const cam = camAt(CAM, S.t), c = { ...cam, zoom: cam.zoom * punch(S, S.t >= T_FAST ? 0.03 : 0.015) };
  paper(ctx, S, c);
  backDeco(ctx, S, c, 140, { alpha: 0.4, boxes: [[40, 40, 560, 220], [1320, 40, 560, 220], [60, 780, 520, 260], [1340, 780, 520, 260]] });
  withCam(ctx, c, 1, g => content(g, S));
  withCam(ctx, c, 0.25, g => ui(g, S));
  frontDeco(ctx, S, c, 141, { alpha: 0.5, items: [['ring', -80, 980, 300], ['hex', 1720, 60, 30], ['data', 1760, 620, 0]] });
  hud(ctx, S, { spectrum: false, lyric: false }); // 第十二轮：频谱压在专家网格上，关掉
}

function content(ctx, S) {
  const p = S.pal, t = S.t, h = heats(t);
  // 第十三轮（用户：主体往下挪一点，现在顶上的歌词条压到右上角的心率波形）：网格、路由器、输入条整体下移 80 px
  ctx.translate(0, 80);
  // 俯仰：先像地板，慢慢立起来，40 小节正对镜头；41 小节逐拍收缩
  const pitch = t < T_SWEEP ? lerp(1.0, 0.62, smooth((t - T0) / (T_SWEEP - T0))) : lerp(0.62, 0, easeOut((t - T_SWEEP) / (BEAT * 2)));
  const shrinkN = t >= T_SHRINK ? Math.floor((t - T_SHRINK) / BEAT) : -1;
  const shrink = shrinkN < 0 ? 1 : lerp(1 - shrinkN * 0.24, 1 - (shrinkN + 1) * 0.24, easeOutBack(clamp(((t - T_SHRINK) % BEAT) / 0.15), 1.6));
  const strong = S.beat === 1 || S.beat === 3, wave = (q, r) => (t >= T_FAST && t < T_SWEEP && strong ? Math.max(0, Math.sin(Math.hypot(q - GC / 2, r - GR / 2) * 0.8 - S.sub * 14)) * decay(S.sub * BEAT, 5) : 0);
  const grid = drawGrid(S, h, wave);
  const sc = Math.max(0, shrink), gcx = 960, gcy = 640 - 60 * (1 - pitch);
  let map = null;
  if (sc > 0.01) {
    ctx.save(); ctx.translate(gcx, gcy); ctx.scale(sc, sc); ctx.translate(-gcx, -gcy);
    map = drawPitch(ctx, grid, gcx, gcy, GW + 40, GH + 40, pitch, { Z: 1000, f: 820 });
    ctx.restore();
  }
  const at = (i, lift = 0) => { // 专家 i 在屏幕上的位置（考虑收缩）
    const [x, y] = map((20 + (i % GC) * CELL + CELL / 2) / (GW + 40), (20 + Math.floor(i / GC) * CELL + CELL / 2) / (GH + 40));
    return [gcx + (x - gcx) * sc, gcy + (y - gcy) * sc - lift];
  };

  // 输入流（顶上）+ 路由器
  const RX = 960, RY = 250;
  const toks = tokens(), cur = toks.filter(k => k.t <= t).length - 1;
  if (t < T_SHRINK) {
    ctx.save();
    ctx.fillStyle = '#FFFFFF'; rrect(ctx, 360, 64, 1200, 64, 32); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = p.line; ctx.stroke();
    ctx.font = fonts(17, 'ZENB', 'SCB'); ctx.fillStyle = p.gray; ctx.fillText('input_ids', 384, 102);
    ctx.save(); rrect(ctx, 480, 64, 1060, 64, 32); ctx.clip();
    const rate = t < T_FAST ? 2 * STEP : STEP, slide = cur >= 0 ? (t - toks[cur].t) / rate : 0;
    for (let j = -2; j < 14; j++) {
      const k = cur + 1 + j; // 右边是还没进去的
      if (k < 0 || k >= toks.length) continue;
      const x = 900 + (j + 1 - slide) * 62 - 62;
      ctx.font = fonts(32, 'J', 'SC'); ctx.fillStyle = j < 0 ? css(p.text, 0.25) : p.text; ctx.textAlign = 'center';
      ctx.fillText(toks[k].ch, x + 31, 108);
    }
    ctx.restore();
    ctx.restore();
    // 落下的 token：从流里掉进路由器，再沿 6 条线飞向专家
    for (let k = Math.max(0, cur - 8); k <= cur; k++) {
      const tk = toks[k], a = t - tk.t;
      if (a < 0 || a > 0.9) continue;
      if (a < 0.18) { // 掉进路由器
        const u = easeIn(a / 0.18), big = k === 0 ? 2.6 : 1;
        ctx.font = fonts(Math.round(40 * big), 'J', 'SC'); ctx.fillStyle = BRAND; ctx.textAlign = 'center';
        ctx.fillText(tk.ch, lerp(900, RX, u), lerp(110, RY + 10, u));
      } else if (map) {
        const u = clamp((a - 0.18) / 0.22), fade = 1 - clamp((a - 0.4) / 0.5);
        for (const e of tk.ex) {
          const [ex, ey] = at(e);
          ctx.strokeStyle = css(e === RICE ? p.acc[1] : BRAND, 0.55 * fade); ctx.lineWidth = e === RICE ? 4 : 2;
          ctx.beginPath(); ctx.moveTo(RX, RY + 40); ctx.lineTo(lerp(RX, ex, u), lerp(RY + 40, ey, u)); ctx.stroke();
          if (u < 1) { ctx.fillStyle = BRAND; ctx.beginPath(); ctx.arc(lerp(RX, ex, u), lerp(RY + 40, ey, u), 6, 0, Math.PI * 2); ctx.fill(); }
        }
      }
    }
    ctx.textAlign = 'left';
    // 路由器：六边形 + 「Router · top-6」
    const kick = decay(S.sub * BEAT, 9);
    ctx.save(); ctx.translate(RX, RY);
    ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = BRAND; ctx.lineWidth = 5;
    ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + (k * Math.PI) / 3, r = 54 + 6 * kick; k ? ctx.lineTo(r * Math.cos(a), r * Math.sin(a)) : ctx.moveTo(r * Math.cos(a), r * Math.sin(a)); } ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.font = fonts(20, 'ZENB', 'SCB'); ctx.fillStyle = BRAND; ctx.textAlign = 'center'; ctx.fillText('Router', 0, -2);
    ctx.font = fonts(15, 'ZENB', 'SCB'); ctx.fillStyle = p.gray; ctx.fillText(`top-${K}`, 0, 20); ctx.textAlign = 'left';
    ctx.restore();
  }

  // 共享专家：浮在网格中央，随底鼓跳
  if (map && t < T_WHALE) {
    const [sx, sy] = at(8 * GC + 12, 90 * sc), kick = decay(S.sub * BEAT, 8) * (S.beat % 2 ? 1 : 0.6), r = (46 + 18 * kick) * Math.max(0.3, sc);
    ctx.strokeStyle = css(p.acc[0], 0.5); ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, sy + 90 * sc); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = p.acc[0]; ctx.beginPath();
    for (let k = 0; k < 6; k++) { const a = (k * Math.PI) / 3 + t * 0.8; k ? ctx.lineTo(sx + r * Math.cos(a), sy + r * Math.sin(a)) : ctx.moveTo(sx + r * Math.cos(a), sy + r * Math.sin(a)); }
    ctx.closePath(); ctx.fill();
    ctx.font = fonts(Math.round(18 * Math.max(0.5, sc)), 'ZENB', 'SCB'); ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center'; ctx.fillText('shared', sx, sy + 6); ctx.textAlign = 'left';
  }

  // 有名字的专家：引线 + 标签
  // 第二十二轮（用户：一直存在的白米饭专家、唱歌专家、摸鱼专家可以做动画，让其他随机位置也出现这类，而不是只有这几个一直存在）：
  // 三个固定的名牌轻轻浮动，自己的专家被 token 选中时弹一下；另外每个 token 有约三成的机会让它选中的某个专家冒出一块临时名牌（0.9 s），
  // 名字从一串"专家"里挑，位置就在那个专家格子上方。（第二十四轮并开关）
  const hitOf = e => { let v = 0; for (let k = Math.max(0, cur - 6); k <= cur; k++) { const tk = toks[k], a = t - tk.t - 0.36; if (a >= 0 && tk.ex.includes(e)) v = Math.max(v, decay(a, 8)); } return v; };
  if (map && t < T_SHRINK) {
    NAMED.forEach(([i, name], k) => {
      // 第十二轮（用户：左上的「白米饭专家」被上面的窗口挡住）：名牌往下挪到 540
      const [ex, ey] = at(i), lx0 = k === 1 ? 1500 : k === 0 ? 420 : 380, ly0 = k === 1 ? 470 : k === 0 ? 540 : 940;
      const a = t - (T0 + 0.6 + k * 0.4);
      if (a < 0) return;
      const lx = lx0 + 8 * Math.sin(t * 1.3 + k * 2), ly = ly0 + 6 * Math.sin(t * 1.7 + k), pop = 1 + 0.12 * hitOf(i);
      leader(ctx, S, ex, ey, lx, ly, clamp(a / 0.2), { color: k === 0 ? p.acc[0] : p.line });
      ctx.font = fonts(28, 'SMILEY', 'SCB');
      const tw = ctx.measureText(name).width + 28, x = lx > ex ? lx : lx - tw;
      ctx.save(); ctx.translate(x + tw / 2, ly); ctx.scale(pop, pop); ctx.translate(-x - tw / 2, -ly);
      ctx.fillStyle = k === 0 ? p.acc[0] : '#FFFFFF'; rrect(ctx, x, ly - 22, tw, 44, 22); ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = k === 0 ? p.acc[0] : p.line; ctx.stroke();
      ctx.fillStyle = k === 0 ? '#FFFFFF' : p.text; ctx.fillText(name, x + 14, ly + 10);
      ctx.restore();
      sticker23(ctx, STK_NAMED[k], lx > ex ? x + tw + 30 : x - 30, ly - 6, 76, popIn(S, a - 0.15, 0.18) * pop, 0.08 * Math.sin(t * 2 + k * 2));
      if (k === 0) { ctx.font = fonts(18, 'ZENB', 'SCB'); ctx.fillStyle = p.acc[0]; ctx.fillText(`load ${Math.round(100 + 60 * clamp((t - T0) / 6))}%`, x + 14, ly + 44); }
    });
    for (let k = Math.max(0, cur - 12); k <= cur; k++) { // 临时名牌
      const tk = toks[k], a = t - tk.t - 0.4;
      if (a < 0 || a > 0.9 || rnd(k, 2201) > 0.32) continue;
      const e = tk.ex[1 + (hash(k, 2202) % (tk.ex.length - 1))];
      if (NAMED.some(n => n[0] === e)) continue;
      const [ex, ey] = at(e), name = POOL22[hash(k, 2203) % POOL22.length], s = popIn(S, a, 0.14) * (1 - smooth(clamp((a - 0.7) / 0.2))), ly = ey - 70;
      if (s <= 0.01) continue;
      ctx.save(); ctx.globalAlpha = clamp(s);
      ctx.strokeStyle = css(BRAND, 0.7); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex, ly + 16); ctx.stroke();
      ctx.fillStyle = BRAND; ctx.beginPath(); ctx.arc(ex, ey, 5, 0, Math.PI * 2); ctx.fill();
      ctx.translate(ex, ly); ctx.scale(s, s);
      ctx.font = fonts(20, 'SMILEY', 'SCB'); const tw = ctx.measureText(name).width + 22;
      ctx.fillStyle = '#FFFFFF'; rrect(ctx, -tw / 2, -16, tw, 32, 16); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = BRAND; ctx.stroke();
      ctx.fillStyle = BRAND; ctx.textAlign = 'center'; ctx.fillText(name, 0, 7); ctx.textAlign = 'left';
      if (STK_POOL[name]) sticker23(ctx, STK_POOL[name], 0, -54, 60, popIn(S, a - 0.06, 0.16), 0.1 * Math.sin(a * 6));
      ctx.restore();
    }
  }

  if (t >= T_SWEEP && t < T_WHALE) targetLock(ctx, S, 960, gcy, 420 * Math.max(0.3, sc), t - T_SWEEP, { label: 'ALL EXPERTS', color: BRAND, labelAt: 'in' }); // 第十三轮：标签放进方框里右上角
}

// 第九轮（用户：54 秒左上的公式是静止的，加图形动画）
// 公式先大字居中站一拍，再缩到卡片左上当标签；下面左边是"亲和度"的图：一圈 12 根专家向量 e_i、当前 token 的向量 u_t
// （每来一个 token 转到新方向，箭头尖上写着这个字），每根 e_i 按 u_tᵀe_i 的大小变长变亮；右边是 Sigmoid 曲线，
// 12 个点按各自的 u_tᵀe_i 落在曲线上，最高的 K 个点亮（示意，演出值）
const N_E = 12, angOf = i => ((hash(i, 31) % 360) * Math.PI) / 180;
function affinityCard9(ctx, S, cur) {
  const p = S.pal, t = S.t, a = t - T0, toks = tokens();
  card(ctx, S, 100, 136, 600, 270, { title: 'affinity', age: a - 0.3 }, cc => {
    const dm = smooth(clamp((a - 0.9) / 0.35)), sz = lerp(42, 26, dm);
    drawFormula(ctx, 'moe_s', lerp(cc.x + cc.w / 2, cc.x + 150, dm), lerp(cc.y + cc.h / 2, cc.y + 20, dm), { size: sz, align: 'c', valign: 'mid', color: p.text, ...formulaFx(S, a - 0.3) });
    const g = clamp((a - 1.15) / 0.3);
    if (g <= 0 || cur < 0) return;
    const tok = toks[cur], e = easeOut(clamp((t - tok.t) / 0.14));
    let a0 = angOf(cur - 1), a1 = angOf(cur);
    if (a1 - a0 > Math.PI) a0 += 2 * Math.PI; else if (a0 - a1 > Math.PI) a1 += 2 * Math.PI;
    const ua = lerp(a0, a1, e), dots = Array.from({ length: N_E }, (_, j) => Math.cos(ua - (j * 2 * Math.PI) / N_E));
    const order = dots.map((d, j) => [d, j]).sort((x, y) => y[0] - x[0]), top = new Set(order.slice(0, 3).map(x => x[1]));
    // 左：专家向量圈 + u_t
    const top0 = cc.y + 50, gh = cc.h - 56, ox = cc.x + 110, oy = top0 + gh / 2, R = gh / 2 - 22;
    ctx.save(); ctx.globalAlpha = g;
    ctx.strokeStyle = css(p.line, 0.3); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(ox, oy, R, 0, Math.PI * 2); ctx.stroke();
    dots.forEach((d, j) => {
      const aj = (j * 2 * Math.PI) / N_E, L = R * (0.55 + 0.45 * Math.max(0, d)), on = top.has(j);
      ctx.strokeStyle = on ? p.acc[0] : css(BRAND, 0.25 + 0.4 * Math.max(0, d)); ctx.lineWidth = on ? 3 : 1.5;
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + Math.cos(aj) * L, oy + Math.sin(aj) * L); ctx.stroke();
      ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.arc(ox + Math.cos(aj) * L, oy + Math.sin(aj) * L, on ? 4.5 : 3, 0, Math.PI * 2); ctx.fill();
    });
    const ux = ox + Math.cos(ua) * (R + 14), uy = oy + Math.sin(ua) * (R + 14);
    ctx.strokeStyle = BRAND; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ux, uy); ctx.stroke();
    ctx.fillStyle = BRAND; ctx.beginPath(); ctx.arc(ux, uy, 13, 0, Math.PI * 2); ctx.fill();
    ctx.font = fonts(15, 'ZEN', 'J', 'SC'); ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(tok.ch, ux, uy + 1); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    // 右：Sigmoid 曲线，12 个点落在曲线上
    const px = cc.x + 250, py = top0 + 4, pw = cc.w - 280, ph = gh - 26, X = d => px + ((d + 1) / 2) * pw, Y = v => py + ph - v * ph, sig = d => 1 / (1 + Math.exp(-5 * d));
    ctx.strokeStyle = css(p.line, 0.35); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(px, py + ph); ctx.lineTo(px + pw, py + ph); ctx.moveTo(X(0), py); ctx.lineTo(X(0), py + ph); ctx.stroke();
    ctx.strokeStyle = css(BRAND, 0.6); ctx.lineWidth = 2.5; ctx.beginPath();
    for (let k = 0; k <= 40; k++) { const d = -1 + (2 * k) / 40; k ? ctx.lineTo(X(d), Y(sig(d))) : ctx.moveTo(X(d), Y(sig(d))); }
    ctx.stroke();
    dots.forEach((d, j) => {
      const on = top.has(j);
      ctx.fillStyle = on ? p.acc[0] : css(p.ink[2], 0.7);
      ctx.beginPath(); ctx.arc(X(d), Y(sig(d)), on ? 7 : 4.5, 0, Math.PI * 2); ctx.fill();
    });
    ctx.font = fonts(13, 'ZENB'); ctx.fillStyle = p.gray;
    ctx.fillText('u·e', px + pw - 26, py + ph + 18); ctx.fillText('s', px - 14, py + 8);
    ctx.restore();
  });
}

// 卡片、toast、像素心、鲸鱼：画在离相机较远的一层（深度 0.25），推拉镜头时不会被裁出画面
function ui(ctx, S) {
  const p = S.pal, t = S.t, h = heats(t), cur = tokens().filter(k => k.t <= t).length - 1;
  // 左：路由公式卡（亲和度 → Top-K；38 起偏置 b_i 圈出来）
  if (t < T_SHRINK) {
    const gate = t >= barStart(36), over = t >= T_FAST, fa = t - barStart(36);
    // 第十二轮：affinity 卡往下翻过去（绕水平轴压扁），翻过来就是 aux-loss-free routing 卡（回弹一下），公式在翻好后写出来
    const flip = fa > -0.2 && fa < 0.26 ? clamp((fa + 0.2) / 0.46) : -1;
    const routeCard = () => card(ctx, S, ...ROUTE(), { title: 'aux-loss-free routing', age: 1 }, cc => {
      drawFormula(ctx, 'moe_gate', cc.x + cc.w / 2, cc.y + cc.h / 2, { size: 21, align: 'c', valign: 'mid', color: p.text, marks: over ? { b: p.tint[0] } : undefined, colors: over ? { b: p.acc[0] } : undefined, write: S.t - barStart(36) - 0.06, dur: 0.5, sweep: formulaFx(S, 0).sweep });
    });
    if (flip >= 0) {
      const first = flip < 0.5, k = first ? Math.cos(Math.PI * flip) : -Math.cos(Math.PI * flip) * (1 + 0.12 * Math.sin(Math.PI * clamp((flip - 0.5) / 0.5)));
      const R = first ? [100, 136, 600, 270] : ROUTE(), cy = R[1] + R[3] / 2;
      ctx.save(); ctx.translate(0, cy); ctx.scale(1, Math.max(0.02, k)); ctx.translate(0, -cy);
      if (first) affinityCard9(ctx, S, cur); else routeCard();
      ctx.restore();
      ctx.fillStyle = css('#FFFFFF', 0.8 * Math.sin(Math.PI * flip)); ctx.fillRect(R[0] + 10, cy - 2, R[2] - 20, 4); // 翻到侧面时一道亮线
    } else if (!gate) affinityCard9(ctx, S, cur);
    else routeCard();
    ctx.font = fonts(18, 'ZENB', 'SCB'); ctx.fillStyle = p.gray;
    const ly = lerp(444, 412, smooth(clamp(fa / 0.3))), lx = 104;
    { // 第十轮：两行说明垫一块白底，网格上的专家名牌不再压在字上
      ctx.save(); ctx.fillStyle = 'rgba(255,255,255,0.92)'; rrect(ctx, lx - 12, ly - 22, 600, 58, 10); ctx.fill();
      ctx.strokeStyle = css(p.line, 0.35); ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
      ctx.font = fonts(18, 'ZENB', 'SCB'); ctx.fillStyle = p.gray;
    }
    ctx.fillText(`${fact('model_current').split('（')[0]} · ${fact('n_routed_experts')} routed + ${fact('n_shared_experts')} shared · top-${K}`, lx, ly);
    ctx.fillText(`tokens routed ${String(Math.max(0, cur + 1)).padStart(4, '0')}`, lx, ly + 26);
  }

  // 右：负载面板（36 起），38 报警「白米饭专家 过载」
  if (t >= barStart(36) && t < T_SHRINK) {
    card(ctx, S, ...LOAD(), { title: 'expert load', age: S.t - barStart(36) }, cc => {
      const top = [RICE, SING, FISHY, 33, 160, 271, 302, 350];
      top.forEach((e, k) => {
        const v = e === RICE ? 0.9 + 0.1 * Math.sin(t * 7) : clamp(0.2 + 0.5 * h[e] + 0.15 * vnoise(k, t * 2, 4));
        const bw = cc.w / top.length, bh = v * (cc.h - 60);
        ctx.fillStyle = e === RICE ? p.acc[0] : k < 3 ? BRAND : p.ink[2];
        rrect(ctx, cc.x + k * bw + 6, cc.y + cc.h - 30 - bh, bw - 12, bh, 4); ctx.fill();
        ctx.font = fonts(13, 'SC'); ctx.fillStyle = p.gray; ctx.fillText(`E${String(e).padStart(3, '0')}`, cc.x + k * bw + 4, cc.y + cc.h - 8);
      });
      ctx.strokeStyle = p.acc[0]; ctx.setLineDash([8, 6]); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cc.x, cc.y + 30); ctx.lineTo(cc.x + cc.w, cc.y + 30); ctx.stroke(); ctx.setLineDash([]);
    });
    if (t >= T_FAST) {
      const a = t - T_FAST, blink = Math.floor(a / 0.2) % 2 === 0;
      const [wx, wy] = [1380, 958]; // 第十二轮：警示跟着负载卡到右下，放在卡下面
      warn(ctx, S, wx, wy, 52, { fill: blink ? p.tint[1] : '#FFFFFF' });
      ctx.font = fonts(26, 'SMILEY', 'SCB'); ctx.fillStyle = p.acc[0]; ctx.fillText('白米饭专家 过载', wx + 46, wy + 10);
      ctx.font = fonts(18, 'ZENB', 'SCB'); ctx.fillStyle = p.gray; ctx.fillText(`b_${RICE} ← b_${RICE} − γ`, wx + 250, wy + 10);
    }
  }

  // 39.1「服务器繁忙，请稍后再试。」→ 39.3 被一颗大像素心砸碎
  const busy = t - T_BUSY, smash = t - T_SMASH;
  if (busy >= 0 && smash < 0.9) {
    const msg = fact('ui_texts', 'server_busy') || '服务器繁忙，请稍后再试。';
    if (smash < 0) { toast(ctx, S, msg, 960, 560, busy, { size: 52 }); }
    else { // 碎片：toast 画进缓冲，切成小块飞散
      const cv = pooled('i1toast', 1000, 160, true), tc = cv.getContext('2d');
      tc.clearRect(0, 0, 1000, 160); toast(tc, S, msg, 500, 80, 1, { size: 52 });
      const nx = 10, ny = 2, pw = 1000 / nx, ph = 160 / ny;
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const dx = i - nx / 2 + 0.5, v = 600 + rnd(i, j, 1) * 600, u = easeOut(clamp(smash / 0.8));
        ctx.save(); ctx.globalAlpha = 1 - u;
        ctx.translate(460 + i * pw + pw / 2 + dx * v * u * 0.25, 480 + j * ph + ph / 2 + (j ? 1 : -1) * v * u * 0.3 + 300 * u * u);
        ctx.rotate((rnd(i, j, 2) - 0.5) * 3 * u);
        ctx.drawImage(cv, i * pw, j * ph, pw, ph, -pw / 2, -ph / 2, pw, ph);
        ctx.restore();
      }
    }
    if (smash > -0.15 && smash < 0.9) { // 像素心从上方砸下来
      const fall = clamp((smash + 0.15) / 0.15), y = lerp(-200, 560, easeIn(fall)), squash = smash > 0 ? 1 + 0.35 * decay(smash, 9) : 1;
      ctx.save(); ctx.translate(960, y); ctx.scale(squash, 1 / squash);
      drawSprite(ctx, 'heart', 30, p, 0, 0, 1, 1 - clamp((smash - 0.5) / 0.4));
      ctx.restore();
      if (smash > 0) { ctx.strokeStyle = css(p.acc[0], decay(smash, 4)); ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(960, 560, 120 + 700 * smash, 0, Math.PI * 2); ctx.stroke(); }
    }
  }

  // 41.4：塌缩成像素鲸鱼
  const wa = t - T_WHALE;
  if (wa >= -0.1) {
    const s = easeOutBack(clamp((wa + 0.1) / 0.2), 2);
    drawSprite(ctx, 'whale', 12, p, 960, 760, s);
    if (wa > 0) { ctx.strokeStyle = css(BRAND, decay(wa, 5)); ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(960, 760, 120 + 600 * wa, 0, Math.PI * 2); ctx.stroke(); }
  }
}
