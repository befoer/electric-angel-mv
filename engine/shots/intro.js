// 前奏（1–9 小节，0:00–0:14.47）· 她决定唱歌（视觉方案 §5.1）
// 你发来"唱首歌吧"，她深度思考要不要唱。思考文字溢出窗口，落成字符海；鲸尾从海里甩起；标题浮现
import { W, H, CW, CH, COLS, ROWS, BRAND, BEAT, BAR, STEP } from '../core/const.js';
import { camAt, withCam } from '../core/cam.js';
import { ruler, segBar, ringScanner, dataColumn, hudCluster } from '../core/hudkit.js';
import { paper, backDeco, frontDeco, punch, drawCRT, crtGeometry, sendArrow, inputChips, tokenStrip } from './scene.js';
import { beatTime, barStart, clamp, lerp, smooth, easeIn, easeOut, easeOutBack, decay } from '../core/time.js';
import { hash, rnd, vnoise } from '../core/rand.js';
import { glyphs, font, fonts, midText } from '../core/glyphs.js';
import { Occ, putText, textCells, background, drawBox, charField, bgDensity, TIERS } from '../core/grid.js';
import { decode } from '../core/text.js';
import { beatSprites, drawBeatSprites, drawSprite, spriteCells } from '../core/sprites.js';
import { windowBase, rrect } from '../core/ui.js';
import { hud } from '../core/hud.js';
import { mix, css } from '../core/color.js';
import { newCanvas } from '../core/env.js';
import { card, leader, ring, stamp, dots, hatch } from '../core/kit.js';
import { morphFormula, slotText, slotNum } from '../core/math.js';
import { fact, lyric } from '../core/data.js';
import { rev } from '../rev.js';
import { drawLogo } from '../core/logo.js';

export const WIN = { c0: 44, r0: 6, c1: 116, r1: 32 }; // 72×26 格
const INPUT = { c0: WIN.c0 + 2, r0: WIN.r1 - 7, c1: WIN.c1 - 2, r1: WIN.r1 - 1 };
const ROW_USER = WIN.r0 + 2, ROW_GREET = WIN.r0 + 3, ROW_HEAD = WIN.r0 + 4, ROW_T0 = WIN.r0 + 5;
const COL_T = WIN.c0 + 5;

const T_CUE = beatTime(1, 4);    // 1.267 第一个声音
const T_OPEN = beatTime(2, 1);   // 1.667 窗口画出
const T_TYPE = beatTime(2, 2);   // 2.067 开始打字（第七轮：拼音输入法，逐个字母 + 候选框，三次选词上屏）
const T_SEND = beatTime(3, 4);   // 4.467 整句上屏后停 0.4 秒，点发送
const T_THINK = beatTime(4, 1);  // 4.867 思考块展开
const T_DRIP = beatTime(5, 1);   // 6.467 开始溢出
const T_DRUM = beatTime(6, 1);   // 8.067 鼓进
const T_BASS = beatTime(8, 1);   // 11.267 贝斯进，甩尾
const T_TITLE = beatTime(8, 3);  // 12.067 标题（第八轮提前：每个八分音符一个字，13.47 写完，缩进显示器前就看得全）
const T_FREEZE = beatTime(9, 4); // 14.067 吸气（第二十七轮起不再定格，见 scene）
export const T_DROP = beatTime(10, 1); // 14.467 落点

// 思考文字：t 为开始解码的时刻（第七轮：发送推迟到 3.4，前两句挤进第 4 小节）
export const THOUGHTS = [
  { t: beatTime(4, 1), text: '嗯，用户想听我唱歌。' },
  { t: beatTime(4, 3), text: '是《电子天使》，150 BPM。' },
  { t: beatTime(5, 1), text: '（唱完能换几碗白米饭？）', inner: true },
  { t: beatTime(6, 1), text: '等等，我是语言模型，不会唱歌——' },
  { t: beatTime(7, 1), text: 'Wait. 先别急着下结论。' },
  { t: beatTime(8, 1), text: '才不紧张！鲸鱼才不会紧张！' },
  { t: beatTime(9, 1), text: '深呼吸——Link Start！' },
];

// 拼音输入法（第八轮，用户：「唱首歌吧」整句一次输入）：候选框随前缀刷新，打完后第一个候选就是整句，上屏一次，再点发送。
// 第十轮（用户：拼音打快一点，打完多停一会儿再回车上屏，上屏后再停一下才发送）：
// 每个字母 0.056 s（13 个字母 0.73 s 打完，2.80）→ 停 0.87 s → 3.67（第 3 小节第 2 拍）上屏 → 在输入框里停 0.8 s → 4.47 发送
// 第十七轮（用户：拼写完成后延迟回车的时间缩短一点）：最后一个字母 2.74 → 回车上屏 3.27（第 3 小节第 1 拍，以前 3.67），停顿 0.93 → 0.53 s；
// 指针挪去发送键的时刻不变（还是钉在发送 T_SEND 前 0.55 s），上屏的字在框里多停一会儿。rev ime17
const IME_PY = 'changshougeba', IME_AT = beatTime(2, 2);
const imeKey = () => 0.056, imeCommit = () => beatTime(3, 1); // 第十七轮：拼完到回车的停顿缩短（以前 beatTime(3, 2)）
const T_PTR = () => T_SEND - 0.55; // 指针开始往发送键挪

// 第十二轮（用户：一开始四个窗口在画面里居中，下面的字符海出来以后再一起往上浮）：窗口、三张小卡、溢出的字整体往下挪 LIFT，
// 相机的推近目标跟着加同样的偏移
const LIFT = 160;
// 第十三轮（用户：四个窗口浮得太早，要等字符海真的涌上来——实际看到海动起来是 11 秒贝斯进、鲸尾甩起的那一下；
// 也不要是平移，要像浮在水上）：每个窗口自己一条浮力曲线——海涌上来时被托起（带一点过冲再落回，零初速、欠阻尼），
// 彼此错开 0.08 s；浮起来以后随水波一直上下晃、轻轻左右摆，相位各不相同
const T_RISE = T_BASS - 0.25, FLOAT_K = { M: 0, L: 1, T: 2, R: 3 };
export function floatOf(t, k) {
  const i = FLOAT_K[k], s = t - T_RISE - i * 0.08;
  if (s <= 0) return { dy: LIFT, rot: 0 };
  // 第十四轮（用户：被代码海顶起后的漂浮效果再强一点）：上浮时阻尼小一点（冲过头更多、多弹一下）；
  // 浮起来以后上下晃 7 → 18 px、两个频率叠起来（不再是一条规整的正弦），轻摆 0.009 → 0.022 rad，再加一点左右漂
  const a = 2.1, w = 4.3, rise = 1 - Math.exp(-a * s) * (Math.cos(w * s) + (a / w) * Math.sin(w * s)), on = clamp(s / 0.7);
  return {
    dy: LIFT * (1 - rise) + on * (14 * Math.sin(2 * Math.PI * 0.55 * t + i * 1.7) + 5 * Math.sin(2 * Math.PI * 1.3 * t + i * 2.9)),
    dx: on * 6 * Math.sin(2 * Math.PI * 0.35 * t + i * 1.1),
    rot: 0.04 * (1 - clamp(rise)) * (i % 2 ? -1 : 1) + on * (0.016 * Math.sin(2 * Math.PI * 0.45 * t + i * 2.3) + 0.006 * Math.sin(2 * Math.PI * 1.1 * t + i)),
  };
}
export const liftAt = t => floatOf(t, 'M').dy;
const IME_CANDS = [ // 每个前缀长度对应的候选（第一个是当前最可能的）
  ['才', '从', '此', '次', '出'], ['出', '吃', '成', '车', '处'], ['查', '差', '茶', '插', '察'], ['产', '缠', '馋', '蝉', '铲'], ['唱', '长', '常', '场', '厂'],
  ['尝试', '常数', '唱', '长', '常'], ['尝试', '常识', '长时', '唱', '常'], ['唱首', '长寿', '常熟', '唱', '长'], ['唱首', '长寿', '常熟', '唱', '长'],
  ['唱首', '长寿', '唱首个', '唱', '长'], ['唱首歌', '唱首', '长寿', '唱', '长'], ['唱首歌', '唱首歌吧', '唱首', '唱', '长'], ['唱首歌吧', '唱首歌', '唱首', '唱', '长'],
];
// 拼音按音节加分隔符显示：chang'shou'ge'ba
const sylls = py => py.replace(/^(chang)(shou)?(ge)?(ba)?(.*)$/, (m, a, b, c, d, e) => [a, b, c, d, e].filter(Boolean).join("'"));
// 时刻 t 输入框里的状态：{ done 已上屏的字, py 正在拼的拼音, cands 候选, sel 选词前一刻（高亮变色）}
function imeAt(t) {
  if (t >= imeCommit()) return { done: USER_MSG, py: '', cands: null };
  if (t < IME_AT) return { done: '', py: '', cands: null };
  const n = Math.min(IME_PY.length, 1 + Math.floor((t - IME_AT) / imeKey())), py = IME_PY.slice(0, n);
  return { done: '', py: n >= 5 ? sylls(py) : py, cands: IME_CANDS[n - 1], sel: t > imeCommit() - 0.12 };
}
const GREETING = '我是 DeepSeek，很高兴见到你！';
const GREET_SUB = '我可以帮你写代码、读文件、写作各种创意内容，请把你的任务交给我吧~';
const ROW_GREET12 = WIN.r0 + 10, GW = 66; // 第十二轮：开场白在消息区正中那一行（正常字距的 30 px 粗体）；左边留 66 px 给鲸鱼
// 开场白的左端 x（鲸鱼 + 字整体居中）
const greetX = ctx => { ctx.save(); ctx.font = fonts(30, 'SCB'); const w = ctx.measureText(GREETING).width; ctx.restore(); return 960 - (w + GW) / 2 + GW; };
const USER_MSG = '唱首歌吧';
const TITLE = '如果代码能长出海';

const thoughtGs = (pal, th) => glyphs(th.inner ? 'KAI' : 'SC', pal.gray);

// ---------------------------------------------------------------- 字符海与鲸尾

function seaTop(t) {
  if (t < T_DRIP + 0.8) return ROWS + 2;
  if (t < T_DRUM) return lerp(ROWS + 1, ROWS - 3, smooth((t - T_DRIP - 0.8) / (T_DRUM - T_DRIP - 0.8)));
  if (t < T_BASS) return lerp(ROWS - 3, ROWS - 8, (t - T_DRUM) / (T_BASS - T_DRUM));
  return lerp(ROWS - 8, ROWS - 16, easeOut((t - T_BASS) / 0.5)); // 甩尾：字溅满下半屏
}
function surface(c, t, sub) {
  const pulse = t >= T_DRUM ? decay(sub * BEAT, 6) : 0; // 鼓进后海面随拍起伏
  const amp = 0.6 + 1.6 * pulse + (t >= T_BASS ? 0.8 : 0);
  return seaTop(t) + amp * Math.sin(c * 0.18 - t * 2.4) + 0.8 * Math.sin(c * 0.07 + t * 1.3);
}

const TW = 30, TH = 16;
let TAIL = null;
function tailMask() {
  if (TAIL) return TAIL;
  const cv = newCanvas(TW, TH), c = cv.getContext('2d');
  const X = u => ((u + 1) / 2) * TW, Y = v => (1 - v) * TH; // u ∈ [-1,1]，v ∈ [0,1]（0 = 底）
  c.fillStyle = '#000';
  c.beginPath();
  c.moveTo(X(-0.12), Y(0)); c.lineTo(X(0.12), Y(0));
  c.quadraticCurveTo(X(0.16), Y(0.35), X(0.22), Y(0.48));
  c.quadraticCurveTo(X(0.75), Y(0.6), X(1.0), Y(0.98));
  c.quadraticCurveTo(X(0.55), Y(0.8), X(0.0), Y(0.72));
  c.quadraticCurveTo(X(-0.55), Y(0.8), X(-1.0), Y(0.98));
  c.quadraticCurveTo(X(-0.75), Y(0.6), X(-0.22), Y(0.48));
  c.quadraticCurveTo(X(-0.16), Y(0.35), X(-0.12), Y(0));
  c.fill();
  const d = c.getImageData(0, 0, TW, TH).data;
  TAIL = new Uint8Array(TW * TH);
  for (let i = 0; i < TW * TH; i++) TAIL[i] = d[i * 4 + 3] > 110 ? 1 : 0;
  return TAIL;
}

// 鲸尾此刻占用的格子：[[col, row], ...]
function tailCells(t) {
  if (t < T_BASS - 0.15) return [];
  let off = TH * (1 - easeOutBack(clamp((t - (T_BASS - 0.15)) / 0.55), 1.4));
  if (t > T_TITLE) off += (TH + 6) * easeIn((t - T_TITLE) / 0.8);
  const base = seaTop(t) + 5 + off, m = tailMask(), out = [];
  const swing = 3.5 * Math.sin((2 * Math.PI * (t - T_BASS)) / 0.8) * decay(t - T_BASS, 0.6); // 尾鳍在第 1、3 拍摆
  for (let y = 0; y < TH; y++) {
    const shift = Math.round(swing * ((TH - y) / TH) ** 2), row = Math.round(base - TH + y);
    if (row < 0 || row >= ROWS) continue;
    for (let x = 0; x < TW; x++) if (m[y * TW + x]) out.push([80 - TW / 2 + x + shift, row]);
  }
  return out;
}

// ---------------------------------------------------------------- 溢出的思考文字

let DRIPS = null;
function drips(pal) {
  if (DRIPS) return DRIPS;
  DRIPS = [];
  THOUGHTS.forEach((th, k) => {
    const gs = thoughtGs(pal, th), t0 = th.t;
    let col = COL_T;
    [...th.text].forEach((ch, i) => {
      const w = gs.cells(ch);
      if (ch !== ' ' && k < 6) { // 每个字漏出一个；最后一句留在窗口里
        const ts = Math.max(t0 + i * STEP + 0.3, T_DRIP) + 0.1 + rnd(k, i, 7) * 1.8;
        if (ts < T_FREEZE) DRIPS.push({ ch, col, row: ROW_T0 + k, ts, seed: k * 100 + i, inner: th.inner });
      }
      col += w;
    });
  });
  return DRIPS;
}

// 返回此刻可见的溢出字：{ ch, col, row, lv, inner }（row 是窗口坐标；画的时候整体再往下挪 liftAt(t)）
function dripState(t, sub, pal) {
  const out = [], off = liftAt(t) / CH;
  for (const d of drips(pal)) {
    if (t < d.ts) continue;
    const steps = Math.floor((t - d.ts) / STEP); // 每个十六分音符下落 1 格
    const row = d.row + steps;
    const below = row - (WIN.r1 - 1);
    const col = d.col + (below > 0 ? Math.round(Math.sin(d.seed) * Math.min(4, below / 4)) : 0); // 出窗后字间距散开
    if (row + off >= ROWS || row + off >= surface(col, t, sub) - 0.5) continue; // 落进海里
    out.push({ ch: d.ch, col, row, lv: below > 0 ? Math.max(0, 3 - Math.floor(below / 2)) : -1, inner: d.inner });
  }
  return out;
}

// ---------------------------------------------------------------- 对话窗口

// done：思考块标题翻成"已深度思考（用时 14 秒）"（落点用）
export function drawWindow(ctx, S, { t = S.t, gaps = null, done = false } = {}) {
  const pal = S.pal, open = clamp((t - T_OPEN) / BEAT);
  if (open <= 0) return;
  const edge = glyphs('SC', pal.winEdge), text = glyphs('SC', pal.text), gray = glyphs('SC', pal.gray);
  // 第十二轮（用户：标题栏「DeepSeek」「· · ·」下面的白色矩形去掉，换成断开的线）：不再用白块盖住边框，标题处的框线直接断开
  gaps = new Set(gaps ?? []);
  for (let c = WIN.c0 + 2; c < WIN.c0 + 16; c++) gaps.add(c + WIN.r0 * COLS);
  for (let c = WIN.c1 - 9; c < WIN.c1 - 2; c++) gaps.add(c + WIN.r0 * COLS);
  if (open >= 1) windowBase(ctx, pal, WIN.c0, WIN.r0, WIN.c1, WIN.r1);
  drawBox(ctx, edge, WIN.c0, WIN.r0, WIN.c1, WIN.r1, { progress: open, gaps });
  if (open < 1) return;

  // 标题栏：像素鲸鱼 + DeepSeek
  drawSprite(ctx, 'whale', 2, pal, (WIN.c0 + 4) * CW, WIN.r0 * CH + CH / 2);
  putText(ctx, glyphs('SCB', pal.text), WIN.c0 + 6, WIN.r0, 'DeepSeek');
  putText(ctx, gray, WIN.c1 - 8, WIN.r0, '· · ·');

  // 开场白：窗口画出时快速解码，发送后 1 拍内淡出
  // 第十二轮（用户：推近后开场白太靠上，放到对话窗口中间）：像 DeepSeek 的空对话页，鲸鱼 + 开场白 + 一行灰字放在消息区正中（鲸鱼在 scene 里画）
  const gAlpha = 1 - clamp((t - T_SEND) / BEAT);
  if (gAlpha > 0) {
    const str = decode(GREETING, t - T_OPEN - 0.1, { seed: 3, step: 0.02, settle: 0.12 });
    ctx.globalAlpha = gAlpha;
    const gx = greetX(ctx);
    ctx.font = fonts(30, 'SCB'); ctx.fillStyle = pal.text; midText(ctx, str, gx, ROW_GREET12 * CH + CH / 2);
    const sa = clamp((t - T_OPEN - 0.35) / 0.25);
    if (sa > 0) {
      ctx.globalAlpha = gAlpha * sa; ctx.font = fonts(17, 'SC'); ctx.fillStyle = pal.gray; ctx.textAlign = 'center';
      ctx.fillText(GREET_SUB, 960, ROW_GREET12 * CH + CH / 2 + 50 + 6 * (1 - sa)); ctx.textAlign = 'left';
    }
    ctx.globalAlpha = 1;
  }
  if (t >= T_SEND) { // 你的消息气泡：从输入框飞上来，右边是你的头像（第七轮）
    const fly = easeOut(clamp((t - T_SEND) / 0.22));
    // 第十五轮（用户：用户发出的「唱首歌吧」字距太大，底下的矩形改成最大圆角）：以前按字符网格一格一格摆（一个汉字占两格，字比格子小，
    // 看起来字距很空），改成正常排版的字；底框改成胶囊（圆角 = 半高），右边还对齐原来的位置
    ctx.font = fonts(21, 'SC'); const tw = ctx.measureText(USER_MSG).width, bh = CH + 14, right = (WIN.c1 - 8 + 1.5) * CW, bx = right - tw - 40;
    const dx = lerp((INPUT.c0 + 2) * CW - (bx + 20), 0, fly), dy = lerp(INPUT.r0 + 1 - ROW_USER, 0, fly) * CH;
    ctx.save(); ctx.translate(dx, dy);
    ctx.fillStyle = mix(BRAND, '#FFFFFF', 0.88); rrect(ctx, bx, ROW_USER * CH + CH / 2 - bh / 2, tw + 40, bh, bh / 2); ctx.fill();
    ctx.fillStyle = pal.text; midText(ctx, USER_MSG, bx + 20, ROW_USER * CH + CH / 2);
    ctx.restore();
    userAvatar(ctx, S, (WIN.c1 - 4) * CW, ROW_USER * CH + CH / 2, 17, easeOutBack(clamp((t - T_SEND - 0.15) / 0.15), 2));
  }

  // 思考块（左边是她的头像）
  if (t >= T_THINK) {
    const head = done ? '已深度思考（用时 14 秒）' : '思考中…';
    const spin = done ? '◉' : '|/-\\'[Math.floor(t * 8) % 4];
    dsAvatar(ctx, S, (WIN.c0 + 3) * CW + 2, ROW_HEAD * CH + CH / 2 - 2, 15, easeOutBack(clamp((t - T_THINK) / 0.15), 2));
    putText(ctx, glyphs('SC', BRAND), WIN.c0 + 6, ROW_HEAD, spin);
    putText(ctx, gray, WIN.c0 + 8, ROW_HEAD, decode(head, t - T_THINK, { seed: 9, step: 0.05 }));
    THOUGHTS.forEach((th, k) => {
      const age = t - th.t;
      if (age < 0) return;
      putText(ctx, gray, WIN.c0 + 3, ROW_T0 + k, '┊');
      putText(ctx, thoughtGs(pal, th), COL_T, ROW_T0 + k, decode(th.text, age, { seed: 20 + k }));
    });
  }

  // 输入框：已上屏的字 + 正在拼的拼音（蓝色、下划线）+ 光标；上方是候选框
  drawBox(ctx, edge, INPUT.c0, INPUT.r0, INPUT.c1, INPUT.r1, { gaps });
  const typing = t >= T_TYPE && t < T_SEND, ime = typing ? imeAt(t) : null;
  if (typing) {
    let n = 0;
    if (ime.done) { // 第十五轮：上屏的字也正常排版（和飞上去的气泡里一样）
      ctx.font = fonts(21, 'SC'); ctx.fillStyle = pal.text; midText(ctx, ime.done, (INPUT.c0 + 2) * CW, (INPUT.r0 + 1) * CH + CH / 2);
      n = Math.ceil(ctx.measureText(ime.done).width / CW) + (ime.py ? 0 : 0.5);
    }
    let caret = INPUT.c0 + 2 + n;
    if (ime.py) {
      const m = putText(ctx, glyphs('SC', BRAND), caret, INPUT.r0 + 1, ime.py);
      ctx.fillStyle = BRAND;
      for (let x = caret * CW; x < (caret + m) * CW; x += 6) ctx.fillRect(x, (INPUT.r0 + 2) * CH - 2, 3, 2);
      caret += m;
    }
    if (ime.py || Math.floor((t - T_TYPE) / 0.2) % 2 === 0) putText(ctx, glyphs('SC', BRAND), caret, INPUT.r0 + 1, '▍');
    if (ime.cands) candidates(ctx, S, (INPUT.c0 + 2 + n) * CW - 8, INPUT.r0 * CH - 14, ime); // 第十二轮（用户）：候选框旁边的回车键去掉
  } else putText(ctx, gray, INPUT.c0 + 2, INPUT.r0 + 1, '给 DeepSeek 发送消息');
  const lit = t >= T_TYPE, by = INPUT.r0 + 3;
  inputChips(ctx, S, (INPUT.c0 + 2) * CW, by * CH - 3, CH + 6, lit);
  // 发送按钮：打完字后亮起、呼吸；指针滑过去按下
  const ready = t >= imeCommit() && t < T_SEND + 0.2, sx = (INPUT.c1 - 4) * CW, sy = by * CH + CH / 2;
  const press = decay(t - T_SEND, 14), breathe = ready && t < T_SEND ? 0.08 * Math.sin((t - T_TYPE) * 18) : 0;
  if (ready) { ctx.fillStyle = css(BRAND, 0.18); ctx.beginPath(); ctx.arc(sx, sy, 24 + 16 * press, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = ready ? BRAND : pal.winEdge;
  const sr = 15 * (1 + breathe - 0.15 * press);
  ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
  sendArrow(ctx, sx, sy, sr / 15); // 第十二轮（用户：箭头太细太长、没在圆里居中）：画出来的粗短箭头，按圆心对齐
  const pa = t - T_PTR(); // 第十轮：上屏后先停一下，指针再挪过去
  if (pa >= 0 && t < T_SEND + 0.35) {
    const u = easeOut(clamp(pa / 0.4)), px = lerp((INPUT.c0 + 30) * CW, sx + 4, u), py = lerp((INPUT.r0 + 2) * CH + 30, sy + 4, u);
    pointer(ctx, px, py, 1 - 0.18 * press, clamp(1 - (t - T_SEND - 0.2) / 0.15));
  }
}

// 第十二轮（用户：鲸鱼往上飞向对话窗口，窗口推近了，鲸鱼就飞出窗口了，换个版本）：
// 图标里的鲸鱼不再飞去标题栏，而是落到消息区正中、开场白左边当它的 logo（DeepSeek 空对话页的样子），一直待在窗口里；
// 发送后它缩小、飞到思考块左边，变成她的头像（dsAvatar 在 T_THINK 弹出来接手）。lift：窗口此刻往下挪的量
function greetWhale(ctx, S, lift) {
  const t = S.t;
  if (t >= T_THINK) return;
  const slot = [greetX(ctx) - GW / 2 - 4, ROW_GREET12 * CH + CH / 2 + lift], ava = [(WIN.c0 + 3) * CW + 2, ROW_HEAD * CH + CH / 2 - 2 + lift];
  const a = t - T_CUE, hop = a > 0 && a < 0.3 ? Math.abs(Math.sin(Math.PI * ((a / STEP) % 1))) * 22 * (1 - a / 0.4) : 0;
  const u = clamp((t - T_OPEN + 0.05) / 0.5), e = u < 0.5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2; // 三次缓入缓出
  let x = lerp(80 * CW, slot[0], e), y = lerp(26 * CH + CH / 2 - hop, slot[1], e) - 26 * Math.sin(Math.PI * e); // 走一道小弧线
  let px = lerp(5, 3, e), s = a < STEP ? easeOutBack(clamp(a / STEP), 2.5) : 1;
  if (u >= 1) y += 3 * Math.sin((t - T_OPEN) * Math.PI * 2.5); // 待着时轻轻上下浮
  const f = clamp((t - T_SEND - 0.05) / 0.32);
  if (f > 0) {
    const g = easeIn(f) * 0.4 + smooth(f) * 0.6;
    x = lerp(x, ava[0], g); y = lerp(y, ava[1], g) - 30 * Math.sin(Math.PI * g); px = lerp(3, 2, g); s *= 1 - 0.2 * g;
  }
  drawSprite(ctx, 'whale', 5, S.pal, x, y, (s * px) / 5); // 格子大小连续变化，不一档一档跳
}

// 你的头像：圆形浅底 + 简笔头肩（不画具体的人）
function userAvatar(ctx, S, cx, cy, r, s = 1) {
  if (s <= 0) return;
  const p = S.pal;
  ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
  ctx.fillStyle = p.tint[0]; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = p.acc[0];
  ctx.beginPath(); ctx.arc(0, -r * 0.18, r * 0.36, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, r * 0.78, r * 0.68, r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.lineWidth = 2.5; ctx.strokeStyle = p.acc[0]; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}
// 她的头像：品牌蓝圆 + 白色像素鲸鱼
function dsAvatar(ctx, S, cx, cy, r, s = 1) {
  if (s <= 0) return;
  ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
  ctx.fillStyle = BRAND; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  drawSprite(ctx, 'whaleW', 2, S.pal, 0, 1, 0.8);
  ctx.restore();
}
// 输入法候选框：拼音一行 + 五个候选（第一个高亮），选词前一刻高亮闪一下。返回框的右边 x
function candidates(ctx, S, x, yBottom, ime) {
  const p = S.pal;
  ctx.save();
  ctx.font = fonts(26, 'SC');
  const items = ime.cands.map((c, i) => `${i + 1}.${c}`), ws = items.map(s => ctx.measureText(s).width + 22);
  const w = ws.reduce((a, b) => a + b, 0) + 70, h = 84, y = yBottom - h;
  ctx.fillStyle = css(p.shadow, 0.22); rrect(ctx, x + 4, y + 6, w, h, 10); ctx.fill();
  ctx.fillStyle = '#FFFFFF'; rrect(ctx, x, y, w, h, 10); ctx.fill();
  ctx.strokeStyle = p.winEdge; ctx.lineWidth = 2; ctx.stroke();
  ctx.font = fonts(18, 'SC'); ctx.fillStyle = p.gray; ctx.textBaseline = 'middle';
  ctx.fillText(ime.py, x + 14, y + 20);
  ctx.strokeStyle = p.winEdge; ctx.beginPath(); ctx.moveTo(x + 10, y + 36); ctx.lineTo(x + w - 10, y + 36); ctx.stroke();
  let cx = x + 10;
  items.forEach((s, i) => {
    if (i === 0) { ctx.fillStyle = ime.sel ? p.acc[0] : BRAND; rrect(ctx, cx, y + 42, ws[0], 36, 8); ctx.fill(); }
    ctx.font = fonts(26, 'SC'); ctx.fillStyle = i === 0 ? '#FFFFFF' : p.text;
    ctx.fillText(s, cx + 11, y + 61);
    cx += ws[i];
  });
  ctx.fillStyle = p.gray; ctx.font = fonts(22, 'SC'); ctx.fillText('‹ ›', x + w - 46, y + 61);
  ctx.restore();
  return x + w;
}
// 鼠标指针（经典箭头）
function pointer(ctx, x, y, s, a) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha *= a; ctx.translate(x, y); ctx.scale(s * 1.4, s * 1.4);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 22); ctx.lineTo(6, 17); ctx.lineTo(10, 26); ctx.lineTo(14, 24); ctx.lineTo(10, 15); ctx.lineTo(17, 15); ctx.closePath();
  ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#1D2541'; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- 两侧卡片（视觉方案 §5.1 第五轮）
// 右：sampler 卡（3.1 起），seed 114514，9.1 起状态闪 LINK START
// 左：语言模型公式卡（6.1 起），x 圈注到「x = 唱首歌吧」；7.1 盖 Wait. 印章并推导成 P(唱歌∣唱首歌吧) = ?；8.1 起 ? 滚到 0.98（演出值）

const T_WAIT = beatTime(7, 1), T_LINK = beatTime(9, 1);
const ASK = '唱首歌吧', WANT = '唱歌';

// 第十轮（用户：构图不好看、窗口大小没有层级；三个小窗口边线细一点、中间主窗口边线粗一点；分词卡颜色太多；
// 左上的窗口早点进来，前两个几乎同时出现，错开三个窗口的进场）
// 三个小窗口一样宽（380），左列两张的上下沿对齐主窗口的上下沿，右列一张和主窗口一样高；列间距左右都是 54 px，离画面边 100 px。
// 进场按"发生的顺序"错开约一拍：发送后先切词（tokenizer）→ 第 4 小节第 3 拍语言模型（左上）→ 第 5 小节头采样器（右）
// 第十二轮（用户：「X = 唱首歌吧」的小框放进语言模型窗口里）：X12 在语言模型卡的左下角，公式先往上让一点，小框收掉后再回到中间。rev intro12
const W10 = { L: [100, 130, 380, 214], X: [150, 354, 250, 40], T: [100, 416, 380, 214], R: [1440, 130, 380, 500] };
const X12 = [124, 270, 214, 40];
export const sideRect = k => (k === 'X' ? X12 : W10[k]);
export const sideIn = k => ({ T: T_SEND + 0.25, L: beatTime(4, 3), R: beatTime(5, 1) })[k];
const thin = () => ({ lw: 1.5, inner: false, shadow: 'rgba(77,107,254,0.12)' });

// dxL / dxR / alpha：落点时两张卡飞出画面用（L01）
// float(k) → { dy, rot }（第十三轮）：每张卡各自浮在水上，dy 是相对整组的偏移，绕卡片中心转
const bob = (ctx, r, f) => { if (!f) return; const cx = r[0] + r[2] / 2, cy = r[1] + r[3] / 2; ctx.translate(cx + (f.dx ?? 0), cy + f.dy); ctx.rotate(f.rot); ctx.translate(-cx, -cy); };
export function sideCards(ctx, S, t, { dxL = 0, dxR = 0, alpha = 1, float = null } = {}) {
  const pal = S.pal, r10 = true;
  ctx.save();
  ctx.globalAlpha *= alpha;

  // 左下：分词卡。发送后把「唱首歌吧」切成 token，每个八分音符弹出一个（token id 是演出值）
  const ta = t - sideIn('T');
  if (ta >= 0) {
    ctx.save(); ctx.translate(dxL, 0); bob(ctx, sideRect('T'), float?.('T'));
    card(ctx, S, ...sideRect('T'), { title: 'tokenizer', age: ta, ...thin() }, c => {
      const toks = [...ASK], tw = r10 ? 70 : 92, th = r10 ? 60 : 68, step = r10 ? 82 : 104;
      toks.forEach((ch, i) => {
        const a = ta - 0.15 - i * 0.2;
        if (a < 0) return;
        const s = easeOutBack(clamp(a / 0.12), 2.2), x = c.x + 8 + i * step, y = c.y + 14;
        ctx.save(); ctx.translate(x + tw / 2, y + th / 2); ctx.scale(s, s);
        // 第十轮：四个 token 同一种颜色（白底细线），刚切出来的那个描品牌蓝
        ctx.fillStyle = r10 ? '#FFFFFF' : [pal.tint[0], pal.tint[1], pal.tint[2], pal.tint[3]][i % 4]; rrect(ctx, -tw / 2, -th / 2, tw, th, 12); ctx.fill();
        ctx.lineWidth = r10 ? (a < 0.3 ? 2.5 : 1.5) : 3; ctx.strokeStyle = r10 && a < 0.3 ? BRAND : pal.line; ctx.stroke();
        ctx.font = font('SMILEY', r10 ? 34 : 40); ctx.fillStyle = pal.text; ctx.textAlign = 'center'; ctx.fillText(ch, 0, r10 ? 12 : 14);
        ctx.restore();
        ctx.font = font('ZENB', r10 ? 14 : 16); ctx.fillStyle = pal.gray; ctx.textAlign = 'center';
        ctx.fillText(String(10000 + (hash(i, 77) % 90000)), x + tw / 2, y + th + (r10 ? 22 : 28)); ctx.textAlign = 'left';
      });
      const n = Math.min(toks.length, Math.max(0, Math.floor((ta - 0.15) / 0.2) + 1));
      ctx.font = font('ZENB', r10 ? 18 : 20); ctx.fillStyle = BRAND; ctx.fillText(`${n} tokens · prefill`, c.x + 8, c.y + c.h - 8);
      segBar(ctx, S, c.x + (r10 ? 190 : 220), c.y + c.h - 22, c.w - (r10 ? 196 : 230), 10, n / toks.length);
    });
    ctx.restore();
  }

  const ra = t - sideIn('R');
  if (ra >= 0) {
    ctx.save(); ctx.translate(dxR, 0); bob(ctx, sideRect('R'), float?.('R'));
    const Y = r10 ? [22, 160, 318, 360, 404] : [22, 128, 262, 300, 336]; // 第十轮卡片更高，内容竖向铺开
    card(ctx, S, ...sideRect('R'), { title: 'sampler', age: ra, ...thin() }, c => {
      const label = (s, y) => { ctx.font = font('SC', 20); ctx.fillStyle = pal.gray; ctx.fillText(s, c.x, y); };
      const value = (s, y, color = pal.text) => { ctx.font = font('SCB', 22); ctx.fillStyle = color; ctx.textAlign = 'right'; ctx.fillText(s, c.x + c.w, y); ctx.textAlign = 'left'; };
      label('model', c.y + Y[0]); value('deepseek-flash', c.y + Y[0]);
      const T = fact('recommended_temperature', 'r1'), P = fact('recommended_top_p', 'r1');
      const grow = easeOut(clamp((ra - 0.2) / 0.6));
      ring(ctx, S, c.x + 84, c.y + Y[1], 58, T * grow, { text: String(T), label: 'temperature' });
      ring(ctx, S, c.x + c.w - 84, c.y + Y[1], 58, P * grow, { text: String(P), label: 'top_p', color: '#9A7BFF' });
      label('seed', c.y + Y[2]); value('114514', c.y + Y[2], BRAND);
      label('status', c.y + Y[3]);
      if (t >= T_LINK) { if (Math.floor((t - T_LINK) / 0.2) % 2 === 0) value('LINK START', c.y + Y[3], pal.acc[0]); }
      else value(`thinking ${'|/-\\'[Math.floor(t * 8) % 4]}`, c.y + Y[3], pal.gray);
      dots(ctx, c.x + 4, c.y + Y[4], 6, 1, 26, 5, pal.tint[3]);
    });
    ctx.restore();
  }

  const la = t - sideIn('L');
  if (la >= 0) {
    ctx.save(); ctx.translate(dxL, 0); bob(ctx, sideRect('L'), float?.('L'));
    const [x, y, w, h] = sideRect('L'), RX = sideRect('X');
    const u = clamp((t - T_WAIT - 0.1) / BEAT);
    const step = Math.floor((t - T_BASS) / STEP), p = t < T_BASS ? null : 0.12 + 0.86 * clamp(step / 15);
    let L = null;
    const lift = -30 * (1 - smooth(clamp(u * 2))); // 第十二轮：X 小框在卡里时公式往上让 30 px
    card(ctx, S, x, y, w, h, { title: 'language model', age: la, ...thin() }, c => {
      L = morphFormula(ctx, 'lm', 'lm_sub', u, c.x + c.w / 2, c.y + c.h / 2 - 6 + lift, {
        size: r10 ? 27 : 35, align: 'c', valign: 'mid', color: pal.text, colors: { x: BRAND, y: pal.acc[0] },
        write: la - 0.1, dur: 0.45,
        slots: {
          s_y: (cx, b) => slotText(cx, b, WANT, { color: pal.acc[0], fontKey: 'SMILEY' }),
          s_x: (cx, b) => slotText(cx, b, ASK, { color: BRAND, fontKey: 'SMILEY' }),
          s_p: (cx, b) => (p == null ? slotText(cx, b, '?', { color: pal.gray, fontKey: 'SCB', em: 0.72 }) : slotNum(cx, b, p.toFixed(2), { color: BRAND })),
        },
      });
      hatch(ctx, c.x + c.w - 54, c.y + c.h - 30, 3, 22, pal.acc[1], { w: 7, gap: 12 });
    });
    // x 的圈注：推导前，引线从公式里的 x 拉到下面的小卡
    const xa = la - 0.55;
    if (xa >= 0 && u < 1 && L?.box) {
      const b = L.box('x'), fade = 1 - clamp(u * 2);
      if (b) {
        ctx.save(); ctx.globalAlpha *= fade;
        leader(ctx, S, (b[0] + b[2]) / 2, b[3] + 8, RX[0] + RX[2] - 20, RX[1] + RX[3] / 2, clamp(xa / 0.2));
        card(ctx, S, ...RX, { age: xa - 0.15, fill: pal.tint[3], r: 14, pad: 14, inner: false, ...(r10 ? { lw: 1.5 } : {}) }, c => {
          ctx.font = font('SMILEY', r10 ? 26 : 30); ctx.fillStyle = pal.text; ctx.textBaseline = 'middle';
          ctx.fillText(`x = ${ASK}`, c.x + 6, c.y + c.h / 2 + 2); ctx.textBaseline = 'alphabetic';
        });
        ctx.restore();
      }
    }
    stamp(ctx, S, 'Wait.', x + w - 120, y + 64, r10 ? 30 : 34, t - T_WAIT);
    ctx.restore();
  }
  ctx.restore();
}

// 第十轮：主窗口的粗边（字符画的细框上再描一圈 4 px），被溢出的字穿过的底边格子照样断开
function mainEdge(ctx, S, gaps, a) {
  if (a <= 0) return;
  const x = WIN.c0 * CW + CW / 2, y = WIN.r0 * CH + CH / 2, w = (WIN.c1 - WIN.c0 - 1) * CW, h = (WIN.r1 - WIN.r0 - 1) * CH, r = 8;
  ctx.save(); ctx.globalAlpha *= a; ctx.lineWidth = 4; ctx.strokeStyle = S.pal.line; ctx.lineCap = 'round';
  // 左右边 + 上面两个圆角；上边在标题（左：鲸鱼 + DeepSeek，右：· · ·）处断开，和细框一样
  ctx.beginPath(); ctx.moveTo(x, y + h - r); ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.lineTo((WIN.c0 + 2) * CW - 4, y);
  ctx.moveTo((WIN.c0 + 16) * CW + 4, y); ctx.lineTo((WIN.c1 - 9) * CW - 4, y);
  ctx.moveTo((WIN.c1 - 2) * CW + 4, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r); ctx.stroke();
  // 底边：一格一格画，跳过断开的格子
  const row = WIN.r1 - 1;
  ctx.beginPath();
  let open = false;
  for (let c = WIN.c0; c < WIN.c1; c++) {
    const cut = gaps && gaps.has(c + row * COLS), cx0 = c === WIN.c0 ? x + r : c * CW, cx1 = c === WIN.c1 - 1 ? x + w - r : (c + 1) * CW;
    if (cut) { open = false; continue; }
    if (!open) { ctx.moveTo(cx0, y + h); open = true; }
    ctx.lineTo(cx1, y + h);
  }
  ctx.stroke();
  ctx.beginPath(); ctx.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI); ctx.moveTo(x + w, y + h - r); ctx.arc(x + w - r, y + h - r, r, 0, Math.PI / 2); ctx.stroke();
  ctx.restore();
}

// 第十轮：原版 MV 黑帧的致敬改成"四个窗口随机闪"——每个拍点随机挑一个窗口（重拍有时两个）整块压成深色一下，
// 不再是半透明的浅蓝罩子。只在窗口自己身上闪（元素层，R4）
function windowFlashes(ctx, S, list, float = null) {
  HOMAGE.forEach(([tb, kind], k) => {
    const a = S.t - tb;
    if (a < 0 || a >= 0.1) return;
    const vis = list.filter(w => tb >= w.t0 + 0.3);
    if (!vis.length) return;
    const pick = [vis[hash(k, 41) % vis.length]];
    if (kind === 'black' && hash(k, 43) % 3 === 0 && vis.length > 1) pick.push(vis[(hash(k, 41) + 1 + (hash(k, 44) % (vis.length - 1))) % vis.length]);
    const env = (a < 0.05 ? 1 : 1 - (a - 0.05) / 0.05) * (kind === 'black' ? 0.92 : 0.6) * 0.25; // 第十一轮：透明度减半；第十二轮再减半
    for (const w of pick) {
      const [x, y, ww, hh] = w.rect;
      ctx.save(); ctx.globalAlpha *= env; if (float) bob(ctx, w.rect, float(w.k)); // 第十三轮：闪的块跟着窗口一起浮
      ctx.fillStyle = '#141A3A'; rrect(ctx, x, y, ww, hh, w.r); ctx.fill();
      ctx.globalAlpha *= 0.8; ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x + 12, y + ((hash(k, 45) % 100) / 100) * hh, ww - 24, 2); // 扫过的一道亮线
      ctx.restore();
    }
  });
}
// ---------------------------------------------------------------- 镜头（第六轮：相机、远近景、黑帧致敬、CRT）

// 相机。第十轮（用户：去掉这个镜头开头的推近）：打字到发送一直不动；发送后只退一点点，让两边的小窗口进来、四周留白；
// 鼓进 / 贝斯进的推拉幅度收小（大推会把小窗口推出画面）。
// 打字时是一个固定的近景（窗口居中、1.3 倍，不动），发送后拉开露出两边
const CAM10 = [
  { t: T_OPEN, x: 0, y: -150, zoom: 1.3, rot: 0 },
  { t: T_SEND + 0.05, x: 0, y: -150, zoom: 1.3, rot: 0 },
  { t: T_THINK + 0.35, x: 0, y: 10, zoom: 0.97, rot: 0, e: 'smooth' },
  { t: T_DRUM - 0.01, x: -10, y: 4, zoom: 0.96, rot: 0.003 },
  { t: T_DRUM + 0.3, x: 0, y: 0, zoom: 0.99, rot: 0, e: 'out' },
  { t: T_BASS - 0.01, x: 10, y: 0, zoom: 0.98, rot: -0.003 },
  { t: T_BASS + 0.4, x: 0, y: 30, zoom: 0.97, rot: 0, e: 'out' },
  { t: T_TITLE + 0.8, x: 0, y: 70, zoom: 1.02, e: 'smooth' },
];

// 第十一轮（用户：把打字时的推近放回来）：从窗口推到输入框、跟着指针挪到发送键，发送后拉开到第十轮的构图。
// 第十二轮：窗口整体往下挪了 LIFT（一开始在画面里居中），推近的目标跟着往下；回车键去掉了，选词时不再往右挪。
// 推近只到 1.4 倍，整个对话窗口始终在画面里（开场白在窗口正中、画面上三分之一偏下），候选框和输入框在中间偏下。rev intro12
const CAM12 = [
  { t: T_OPEN, x: 0, y: 0, zoom: 1.12, rot: -0.01 },
  { t: T_TYPE + 0.3, x: -40, y: 55, zoom: 1.38, rot: 0, e: 'out' },
  { t: beatTime(3, 2), x: -10, y: 60, zoom: 1.42, rot: 0.003 },
  { t: T_SEND, x: 90, y: 80, zoom: 1.38, rot: 0.004 },
  ...CAM10.slice(2),
];

// 原版 MV 8–13 秒的黑帧闪（致敬）：[拍时刻, 类型]
const HOMAGE = [
  [beatTime(6, 2), 'dim'], [beatTime(6, 3), 'black'], [beatTime(6, 4), 'black'], [beatTime(7, 1), 'black'], [beatTime(7, 2), 'black'],
  [beatTime(7, 3), 'dim'], [beatTime(7, 4), 'black'], [beatTime(8, 1), 'black'], [beatTime(8, 2), 'dim'], [beatTime(8, 3), 'dim'],
  [beatTime(8, 4), 'dim'], [beatTime(9, 1), 'dim'],
];

// 9.3 起：整个画面缩进一台显示器（原版 MV 13.7 秒的显示器的致敬，第七轮改成科技风）。
// 第八轮（用户）：落点不再推进屏幕撑满——显示器一直留在画面里，L01 在屏幕里播，到 17.67 甩镜头切 L02（shots/drop.js）
export const T_CRT = beatTime(9, 3);
export const CRT_C = [960, 500];
// 第二十四轮（用户：0:15 主体的显示器再大点，下面还有很多空间）：落点以后 0.9 s 里显示器放大约 22%（最后约 1.27 倍，屏幕宽 988 → 1255），
// 中心同时从 500 往下挪到 570，占满下面那块空地；之后照旧慢慢再大一点（第二十六轮并开关 l01d24）
export function crtAt(t) {
  if (t < T_CRT) return null;
  const u = easeOut(clamp((t - T_CRT) / 0.38));
  let sw = lerp(W, 1040, u), cy = CRT_C[1];
  if (t >= T_FREEZE) sw *= 1 - 0.05 * easeOut(clamp((t - T_FREEZE) / 0.4));
  if (t >= T_DROP) { const k = easeOut(clamp((t - T_DROP) / 0.9)); sw *= 1 + 0.06 * decay(t - T_DROP, 6) + 0.22 * k + 0.05 * smooth((t - T_DROP) / 3); cy = lerp(CRT_C[1], 570, k); }
  return { sw, cx: CRT_C[0], cy, ...crtGeometry(CRT_C[0], cy, sw) };
}

// 显示器舞台：纸面网格、背后的大扫描环和两团 HUD、屏幕（drawScreen 在 1920×1080 的坐标里画，自动缩进屏幕）、机身、外围锁定框与刻度
export function monitorStage(ctx, S, drawScreen, { label = 'DS-LINK · CH.01', lock = 'NOW SINGING' } = {}) {
  const g = crtAt(S.t), a0 = clamp((S.t - T_CRT) / 0.3);
  paper(ctx, S, { x: 0, y: 0, zoom: 1 + 0.25 * (1 - easeOut(a0)), rot: 0 });
  ringScanner(ctx, S, g.cx, g.cy, g.sw * 0.66, { alpha: 0.4 * a0, seed: 5 });
  hudCluster(ctx, S, 91, 60, 120, 420, 760, { density: 0.8, alpha: 0.6 * a0 });
  hudCluster(ctx, S, 92, W - 480, 120, 420, 760, { density: 0.8, alpha: 0.6 * a0 });
  const [x, y, w, h] = g.screen;
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.translate(x, y); ctx.scale(w / W, h / H);
  drawScreen(ctx);
  ctx.restore();
  drawCRT(ctx, S, g.cx, g.cy, g.sw, { label });
  const a = clamp((S.t - T_CRT - 0.2) / 0.2);
  if (a > 0) {
    // 第九轮（用户：两侧细长的框太大、不好看）：锁定框改成贴着机身的四个小角，从外面收进来
    bodyBrackets(ctx, S, g, S.t - T_CRT - 0.2, lock);
    ruler(ctx, S, 120, 200, 680, { vertical: true, alpha: 0.6 * a });
    ruler(ctx, S, W - 140, 200, 680, { vertical: true, alpha: 0.6 * a });
  }
  return g;
}

// 机身外的四个小角（取景框收拢：从外 70 px 收到外 26 px，带一点过冲）+ 左上角一行小标签
function bodyBrackets(ctx, S, g, age, label) {
  if (age < 0) return;
  const [bx, by, bw, bh] = g.body, k = g.sw / 1040, off = lerp(70, 26, easeOutBack(clamp(age / 0.3), 1.6)) * k, len = 34 * k;
  const x0 = bx - off, y0 = by - off, x1 = bx + bw + off, y1 = by + bh + off;
  ctx.save();
  ctx.globalAlpha = clamp(age / 0.12);
  ctx.strokeStyle = BRAND; ctx.lineWidth = Math.max(2, 3 * k); ctx.lineCap = 'square';
  ctx.beginPath();
  for (const [x, y, sx, sy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) {
    ctx.moveTo(x, y + sy * len); ctx.lineTo(x, y); ctx.lineTo(x + sx * len, y);
  }
  ctx.stroke();
  ctx.font = fonts(Math.max(11, Math.round(14 * k)), 'ZENB', 'SCB'); ctx.fillStyle = BRAND; ctx.textBaseline = 'bottom';
  ctx.fillText(label, x0, y0 - 8 * k);
  ctx.restore();
}

function frame(ctx, S) {
  const cam = camAt(CAM12, Math.min(S.t, T_FREEZE)), p = S.pal;
  const z = cam.zoom * (S.t >= T_DRUM && S.t < T_FREEZE ? punch(S, 0.018) : 1);
  const c = { ...cam, zoom: z };
  paper(ctx, S, c);
  const deco = clamp((S.t - T_THINK) / BAR);
  if (deco > 0) backDeco(ctx, S, c, 1, { alpha: 0.65 * deco, boxes: [[40, 40, 520, 300], [1380, 640, 520, 300], [1400, 40, 480, 120], [40, 700, 480, 320]] });
  withCam(ctx, c, 1, g => scene(g, S));
  // 中景：清晰的扫描环和数据列（第六轮：前几小节两侧太空）
  if (deco > 0) withCam(ctx, c, 1.1, g => {
    ringScanner(g, S, 300, 880, 78, { alpha: 0.85 * deco, seed: 2 });
    // 第十五轮（自查）：窗口在 11 s 浮起来之前整体低 160 px，这列字正好压在 sampler 卡的「status」那一行上——跟着窗口一起浮
    dataColumn(g, S, 1450, 660 + liftAt(S.t), 7, { alpha: 0.8 * deco, seed: 4, size: 15 });
  });
  if (S.t >= T_DRUM) frontDeco(ctx, S, c, 3, { alpha: 0.55 * clamp((S.t - T_DRUM) / BEAT), items: [['ring', -60, 980, 300], ['ecg', 1460, 1010, 560]] });
  hud(ctx, S, { alpha: clamp((S.t - T_OPEN) / BEAT), spectrum: S.t < T_DRUM, lyric: false });
}

export function intro(ctx, S) {
  if (!crtAt(S.t)) { frame(ctx, S); return; }
  monitorStage(ctx, S, c => frame(c, S)); // 显示器：屏幕里是原来的画面
  // 第十六轮（用户：其余切点也提前到这句第一个字前）：L01 的「♪」在落点前 0.38 s 就开唱了，但 L01 的切点留在落点上
  // （全片唯一的整画面落点，窗口要在鼓点上碎），所以显示器上方的 stdin 词元条（和 L01 里同一个位置、同一种画法）在前奏最后先亮出来，
  // 唱到「♪」时已经在了；落点之后由 L01（drop.js）接着画，不跳
  const L1 = lyric('L01'), a1 = S.t - (L1.chars[0].t0 - 0.15);
  if (a1 >= 0) {
    ctx.save(); ctx.font = fonts(34, 'ZEN', 'J');
    const tw = L1.chars.reduce((a, c) => a + ctx.measureText(c.c).width + 24, 0); ctx.restore();
    tokenStrip(ctx, S, L1.chars, W / 2 - tw / 2, 40, { size: 34, label: 'stdin · L01', alpha: smooth(clamp(a1 / 0.15)) });
  }
}

function scene(ctx, S) {
  // 第二十七轮（用户：0:13 转到下一个镜头的最后几帧，前一个镜头内的动画突然停止了）：落点前 0.4 s 以前整个画面定格（时间停在 T_FREEZE），
  // 现在字符海、溢出的字、窗口的漂浮、鲸尾一直动到落点；只留"吸气"那一下的轻微缩小，第 9 小节第 4 拍照旧不生成新精灵。rev i13f27
  const pal = S.pal, frozen = S.t >= T_FREEZE && rev('i13f27') < 27, t = frozen ? T_FREEZE : S.t;
  if (S.t >= T_FREEZE) { // 吸气：所有元素缩小，等落点
    const k = 1 - 0.035 * easeOut((S.t - T_FREEZE) / 0.4);
    ctx.translate(W / 2, H / 2); ctx.scale(k, k); ctx.translate(-W / 2, -H / 2);
  }
  const occ = new Occ();
  const winOn = S.t >= T_OPEN, lift = liftAt(t), lr = lift / CH; // 第十二轮：窗口和小卡整体往下挪 lift（先居中，字符海出来后上浮）
  if (winOn) occ.rect(WIN.c0, WIN.r0 + lr, WIN.c1, WIN.r1 + lr);
  const cardRects = [];
  if (t >= sideIn('T')) cardRects.push(sideRect('T'));
  if (t >= sideIn('R')) cardRects.push(sideRect('R'));
  if (t >= sideIn('L')) cardRects.push(sideRect('L'), sideRect('X'));
  const cardCells = cardRects.map(([x, y, w, h]) => [(x - 12) / CW, (y - 20 + lift) / CH, (x + w + 14) / CW, (y + h + 14 + lift) / CH]);
  for (const r of cardCells) occ.rect(...r);

  // 标题占位（字符海不画在标题底下）
  const titleChars = [...TITLE].map((ch, k) => ({ ch, k, age: S.t - (T_TITLE + k * 0.2) })).filter(x => x.age >= 0);
  for (const x of titleChars) { const cx = 960 + (x.k - 3.5) * 128; occ.px(cx - 70, 640, cx + 70, 800); }

  const tail = tailCells(t);
  for (const [c, r] of tail) occ.rect(c, r, c + 1, r + 1);

  const sprites = beatSprites(S, {
    intro: true, from: T_OPEN, avoid: [...(winOn ? [[WIN.c0, WIN.r0 + lr, WIN.c1, WIN.r1 + lr]] : []), ...cardCells],
    skip: (bar, beat) => bar === 9 && beat === 4, // 第 9 小节第 4 拍不生成，吸气
  });
  for (const s of sprites) occ.rect(...spriteCells(s));

  // 背景字符场 + 字符海
  const amount = S.bar <= 1 ? 0 : S.bar === 2 ? 0.6 : S.bar === 3 ? 0.9 : S.bar < 6 ? 1.0 : 1.25;
  const bg = bgDensity(amount), sub = frozen ? 0.5 : S.sub;
  charField(ctx, S, {
    occ, freeze: frozen ? T_FREEZE : null,
    // 海：水面一层浅字，往下渐密，噪声留出空隙，像水纹而不是一堵墙
    density: (c, r, tt) => {
      const s = surface(c, tt, sub);
      if (r < s) return bg(c, r, tt);
      const depth = r - s, n = vnoise(c * 0.13, r * 0.35, tt * 0.8, 21);
      if (depth < 1) return 0.2 + 0.15 * vnoise(c * 0.4, tt * 2, 0, 31);
      return n < 0.3 ? 0 : Math.min(0.72, 0.18 + 0.5 * n + depth * 0.012);
    },
  });
  // 甩尾溅起的字
  const age = t - T_BASS;
  if (age >= 0 && age < 1.8) {
    const sets = pal.ink.map(c => glyphs('SC', c));
    for (let i = 0; i < 140; i++) {
      const x = 80 + (rnd(i, 1) - 0.5) * TW + (rnd(i, 3) - 0.5) * 60 * age;
      const vy = -(18 + rnd(i, 4) * 30), y = seaTop(T_BASS) - TH * 0.8 + rnd(i, 2) * 4 + vy * age + 23 * age * age;
      if (vy + 46 * age > 0 && y > surface(x, t, sub)) continue;
      const c = Math.round(x), r = Math.round(y);
      if (r < 0 || r >= ROWS) continue;
      sets[Math.max(1, 4 - Math.floor(age * 2))].draw(ctx, TIERS[1 + (i % 2)][hash(i, Math.floor(t * 10)) % 10], c * CW, r * CH);
    }
  }

  // 像素鲸鱼：从开场的应用图标里出来（开场在 opening.js），第十二轮起落在开场白上方（greetWhale）

  ctx.save(); ctx.translate(0, lift);
  // 第十三轮：每个窗口自己浮（整组先按主窗口的 dy 挪，小卡再加和主窗口的差、各自转）
  const fl = k => { const f = floatOf(t, k); return k === 'M' ? { dx: f.dx, dy: 0, rot: f.rot } : { dx: f.dx, dy: f.dy - lift, rot: f.rot }; };
  sideCards(ctx, S, t, { float: fl });
  const wrM = [WIN.c0 * CW, WIN.r0 * CH, (WIN.c1 - WIN.c0) * CW, (WIN.r1 - WIN.r0) * CH];
  ctx.save(); if (fl) bob(ctx, wrM, fl('M'));

  // 窗口；溢出的字穿过的边框格断开
  const ds = dripState(t, sub, pal), gaps = new Set();
  for (const d of ds) if (d.row === WIN.r1 - 1 || d.row === INPUT.r0 || d.row === INPUT.r1 - 1) gaps.add(d.col + d.row * COLS);
  drawWindow(ctx, S, { t, gaps });
  mainEdge(ctx, S, gaps, clamp((t - T_OPEN - BEAT) / 0.15));
  ctx.restore();
  // 原版 MV 黑帧闪的致敬（第七轮：只在对话窗口里闪，浅蓝）
  const wr = [WIN.c0 * CW + CW / 2, WIN.r0 * CH + CH / 2, (WIN.c1 - WIN.c0 - 1) * CW, (WIN.r1 - WIN.r0 - 1) * CH];
  windowFlashes(ctx, S, [{ rect: wr, r: 8, t0: T_OPEN, k: 'M' }, ...['L', 'T', 'R'].map(k => ({ rect: sideRect(k), r: 18, t0: sideIn(k), k }))], fl);

  // 溢出的思考文字：窗口内是思考灰，出窗后每 2 格淡一级
  for (const d of ds) {
    const gs = d.lv < 0 ? glyphs(d.inner ? 'KAI' : 'SC', pal.gray) : glyphs(d.inner ? 'KAI' : 'SC', pal.ink[Math.max(1, d.lv)]);
    gs.draw(ctx, d.ch, d.col * CW, d.row * CH);
  }
  ctx.restore();
  greetWhale(ctx, S, lift);

  // 鲸尾：从海里甩起，压在窗口下沿前面。浅蓝底格 + 粗体密字，读起来是一整块形状
  if (tail.length) {
    const ink = glyphs('SCB', BRAND), edge = glyphs('SCB', pal.ink[4]), k = Math.floor(t * 12);
    ctx.fillStyle = mix(BRAND, '#FFFFFF', 0.82);
    for (const [c, r] of tail) ctx.fillRect(c * CW, r * CH, CW, CH);
    for (const [c, r] of tail) (hash(c, r, 5) % 4 ? ink : edge).draw(ctx, TIERS[2][hash(c, r, k) % TIERS[2].length], c * CW, r * CH);
  }

  // 标题：每个八分音符一个字从海面浮起
  // 第二十轮（字标，core/logo.js）：浮起的同时一行行"打"出来，打完下沿化进海里
  // 第二十二轮（用户：主标题下面的水波效果提前一点，效果的小方块缩小一点）：化海从字出来 0.35 s 后提前到 0.15 s，格子从字号 / 15 缩到 / 22。（第二十四轮并开关）
  drawLogo(ctx, S, {
    cx: 960, base: 775, px: 120, slot: 128, edge: pal.win, edgeW: 6, cellDiv: 22,
    charT: k => { const age = S.t - (T_TITLE + k * 0.2); return { type: clamp(age / 0.3), sea: smooth(clamp((age - 0.15) / 0.5)), dy: 140 * (1 - easeOutBack(clamp(age / 0.2), 1.6)) }; },
  });

  drawBeatSprites(ctx, S, sprites);
}
