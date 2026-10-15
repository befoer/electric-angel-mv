// L08（24–25 小节，0:36.87–0:40.07）· "满满的都是你"（视觉方案 §5.2a 第六轮）
// 她的全身剪影由"你"字组成，跟着上下文进度条从脚往上一行行装满；鲸尾那一片随拍左右摆（V8 视频到位后换成真的逐帧蒙版）。
// 右：MLA 卡（KV 压成潜向量，格子里也全是"你"）+ KV cache −93.3% 仪表；底：上下文条装满 1,048,576。
// 25.3：CUDA out of memory. Tried to allocate 你 —— 报错卡砸下来，画面抖、信号花，接着 tv 转场进 L09
import { W, H, CW, CH, BRAND, BEAT } from '../core/const.js';
import { barStart, beatTime, clamp, lerp, easeOut, easeOutBack, decay } from '../core/time.js';
import { cutAt } from '../core/cuts.js';
import { rnd } from '../core/rand.js';
import { font, fonts, glyphs } from '../core/glyphs.js';
import { fact } from '../core/data.js';
import { glyphArt } from '../core/portrait.js';
import { hasMask, maskIndex, maskCells } from '../core/masks.js';
import { shake, flash } from '../core/fx.js';
import { camAt, withCam, camToScreen } from '../core/cam.js';
import { heartPath } from '../core/trans.js';
import { css } from '../core/color.js';
import { hud } from '../core/hud.js';
import { card, ring, stamp } from '../core/kit.js';
import { drawFormula } from '../core/math.js';
import { targetLock } from '../core/hudkit.js';
import { rrect } from '../core/ui.js';
import { paper, backDeco, frontDeco, punch, camBeat, formulaFx } from './scene.js';

// 第十六轮：镜头的起止跟着切点走（cutAt，画帧时取）
const T0 = () => cutAt(24), T1 = () => cutAt(26), T_OOM = beatTime(25, 3);
const COL0 = 30, ROW0 = 0; // 剪影左上角（格）

// 相机：往她胸口（心的位置）慢慢推，右边的卡片始终留在画面里
const CAM = () => [
  { t: T0(), x: 40, y: 40, zoom: 1.0, rot: 0.008 },
  { t: T_OOM, x: 20, y: -10, zoom: 1.06, rot: -0.004 },
  { t: T1(), x: 20, y: 0, zoom: 1.03, rot: 0 },
];

// 粉心（锁定框中心，原位坐标）与它在屏幕上的位置（转场用）
const HEART_W = [(COL0 + 24) * CW, (ROW0 + 54 * 0.32) * CH], HEART_SIZE = 120;
const camOf = t => { const cam = camAt(CAM(), t); return { ...cam, x: cam.x + 40, zoom: cam.zoom * 0.92 }; };
export function heartAt(t) { const c = camOf(t), [x, y] = camToScreen(c, 1, HEART_W[0], HEART_W[1]); return { x, y, size: HEART_SIZE * c.zoom }; }

const fill = t => 0.18 + 0.82 * clamp((t - T0()) / (T_OOM - T0())); // 上下文装满的进度（推进来时已经装了一点）

export function l08(ctx, S) {
  const cam = camAt(CAM(), S.t), oom = S.t >= T_OOM ? S.t - T_OOM : -1;
  const sh = oom >= 0 ? shake(S.t, 22 * decay(oom, 4)) : [0, 0];
  // 第九轮（R4）：显存炸了只震内容层，背景和相机不震、不整屏闪
  // 第十轮（rev polish1）：右边两张卡贴边，相机退一点、往右挪一点
  const p10 = true, whole = camBeat(S);
  const c = { ...cam, x: cam.x + sh[0] * whole + (p10 ? 40 : 0), y: cam.y + sh[1] * whole, zoom: cam.zoom * punch(S, 0.02) * (p10 ? 0.92 : 1) };
  paper(ctx, S, c);
  backDeco(ctx, S, c, 80, { alpha: 0.45, boxes: [[1300, 700, 560, 300], [40, 40, 420, 200]] });
  withCam(ctx, { ...c, x: c.x + sh[0] * (1 - whole), y: c.y + sh[1] * (1 - whole) }, 1, g => content(g, S, oom));
  frontDeco(ctx, S, c, 81, { alpha: 0.55, items: [['ring', -80, 120, 260], ['ecg', 1500, 1020, 560]] });
  if (oom >= 0) oomCard(ctx, S, oom);
  hud(ctx, S, { spectrum: false });
  flash(ctx, oom >= 0 ? whole * 0.25 * decay(oom, 14) : 0, '#FFFFFF');
}

function content(ctx, S, oom) {
  const pal = S.pal, t = S.t, u = fill(t);
  const art = glyphArt('I01', null, 48, 54);
  const sets = pal.ink.map(c => glyphs('SCB', c).warm('你'));
  // 第八轮：有 V8（全身待机 · 鲸尾摆动）时，剪影每帧取自视频蒙版，尾巴真的在摆；墨色深浅仍借 I01 字符画的同一格
  const vm = hasMask('V8') ? maskCells('V8', maskIndex('V8', t, { t0: T0(), speed: 1.5, mode: 'pingpong' }), art.cols, art.rows) : null;
  // 剪影：从脚往上装满；没有视频时鲸尾（右下）用代码假摆；整体随拍呼吸
  for (let y = 0; y < art.rows; y++) {
    const fromBottom = (art.rows - y) / art.rows;
    const vis = clamp((u * 1.08 - fromBottom) * 12 + 1);
    if (vis <= 0) continue;
    for (let x = 0; x < art.cols; x += 2) {
      const i = y * art.cols + x;
      if (vm ? !vm[i] : art.ch[i] === ' ') continue;
      const tail = vm ? 0 : clamp((x / art.cols - 0.6) * 4) * clamp((y / art.rows - 0.55) * 4);
      const sway = tail * 4 * Math.sin((S.n * Math.PI) / 2 - y * 0.18);
      const breath = vm ? 0 : Math.round(0.6 * S.f.low * Math.sin(y * 0.35 + t * 3));
      const base = art.ch[i] === ' ' ? 3 : art.lv[i];
      const lv = Math.max(1, base + (fromBottom > u - 0.05 && fromBottom <= u ? 1 : 0));
      ctx.globalAlpha = vis;
      sets[Math.min(4, lv)].draw(ctx, '你', (COL0 + x + sway + breath) * CW, (ROW0 + y) * CH);
    }
  }
  ctx.globalAlpha = 1;
  // 正在装的那一行：一条扫描线
  const scanY = (ROW0 + art.rows * (1 - u)) * CH;
  if (u < 1) { ctx.fillStyle = 'rgba(255,111,168,0.6)'; ctx.fillRect(COL0 * CW - 40, scanY, art.cols * CW + 80, 3); }
  // 第十二轮（用户：L07 的粉色焦点框转场时别消失，直接变成下一个镜头的粉心）：锁定框中间放一颗粉心，随拍跳；L07 的焦点框在转场里变成它。rev l07
  {
    const k = 1 + 0.1 * decay(S.sub * BEAT, 7);
    ctx.save(); ctx.translate(HEART_W[0], HEART_W[1]); ctx.scale(k, k);
    heartPath(ctx, 0, 0, HEART_SIZE); ctx.fillStyle = css(pal.acc[0], 0.92); ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = '#FFFFFF'; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.restore();
  }
  targetLock(ctx, S, (COL0 + art.cols * 0.5) * CW, (ROW0 + art.rows * 0.32) * CH, 220, S.lt - 0.2, { label: 'HEART', color: pal.acc[0] });

  // 右：MLA 卡
  card(ctx, S, 1180, 80, 700, 560, { title: 'MLA · KV 压缩', age: S.lt - 0.1 }, c => {
    drawFormula(ctx, 'mla', c.x, c.y + 8, { size: 48, color: pal.text, ...formulaFx(S, S.lt - 0.2) });
    drawFormula(ctx, 'mla_k', c.x, c.y + 96, { size: 38, color: pal.gray, ...formulaFx(S, S.lt - 0.45) });
    // 潜向量：16 格，跟着进度一格格装上"你"
    const cell = 36, y0 = c.y + 190, filled = Math.floor(u * 16 + 0.0001);
    ctx.font = fonts(14, 'ZENB', 'SCB'); ctx.fillStyle = pal.gray; ctx.fillText('c_t^KV（潜向量）', c.x, y0 - 10);
    for (let k = 0; k < 16; k++) {
      const x = c.x + k * (cell + 4);
      ctx.fillStyle = k < filled ? pal.tint[0] : '#FFFFFF'; rrect(ctx, x, y0, cell, cell, 6); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = pal.line; ctx.stroke();
      if (k < filled) { ctx.font = fonts(24, 'SCB'); ctx.fillStyle = pal.acc[0]; ctx.fillText('你', x + 6, y0 + 27); }
    }
    const red = fact('mla_kv_reduction', 'v2') || '93.3%';
    ring(ctx, S, c.x + 110, c.y + 380, 80, 0.933 * easeOut(clamp(S.lt / 0.8)), { text: '−' + red, label: 'KV cache', fs: 30, color: BRAND });
    ctx.font = font('ZENB', 26); ctx.fillStyle = pal.text;
    ctx.fillText('压缩了 93.3%', c.x + 240, c.y + 360);
    ctx.fillStyle = pal.acc[0]; ctx.fillText('还是装满了你', c.x + 240, c.y + 402);
  });

  // 底：上下文条
  const max = fact('context_length') || 1048576, val = Math.round(max * u), fmt = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  card(ctx, S, 1180, 690, 700, 170, { title: 'context', age: S.lt - 0.2 }, c => {
    ctx.fillStyle = pal.tint[3]; rrect(ctx, c.x, c.y + 10, c.w, 34, 17); ctx.fill();
    ctx.fillStyle = u >= 1 ? pal.acc[0] : BRAND; rrect(ctx, c.x, c.y + 10, c.w * u, 34, 17); ctx.fill();
    ctx.font = font('ZENB', 34); ctx.fillStyle = pal.text; ctx.fillText(`${fmt(val)} / ${fmt(max)}`, c.x, c.y + 96);
    ctx.font = font('ZENB', 20); ctx.fillStyle = pal.gray; ctx.textAlign = 'right'; ctx.fillText('缓存命中 100%', c.x + c.w, c.y + 96); ctx.textAlign = 'left';
  });
}

// 25.3 的报错卡：从上方砸下来，带红色印章
function oomCard(ctx, S, a) {
  const pal = S.pal, y = lerp(-300, 360, easeOutBack(clamp(a / 0.18), 1.6));
  card(ctx, S, 260, y, 1400, 260, { title: 'RuntimeError', line: pal.acc[0], titleFill: pal.acc[0], fill: '#FFFFFF' }, c => {
    ctx.font = fonts(40, 'SCB'); ctx.fillStyle = pal.text;
    ctx.fillText('torch.OutOfMemoryError: CUDA out of memory.', c.x + 10, c.y + 60);
    ctx.fillText('Tried to allocate', c.x + 10, c.y + 130);
    const w = ctx.measureText('Tried to allocate ').width;
    ctx.font = fonts(64, 'SCB'); ctx.fillStyle = pal.acc[0]; ctx.fillText('你', c.x + 10 + w, c.y + 138);
  });
  stamp(ctx, S, 'OOM', 1540, y + 60, 56, a - 0.12);
}
