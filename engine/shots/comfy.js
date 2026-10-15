// 特效音间奏 · ComfyUI 工作流（66–73 小节，1:44.07–1:56.87）· 第九轮改成平面版（视觉方案 §5.10）
// 用户（第九轮）：去掉 3D 透视（构图乱、难调）；不要多层 KSampler（那是用户上一个视频的主题，参考图跟得太紧）；
// 开头加 ComfyUI 的启动、加节点、输入提示词；出图那段要接近全屏（上一轮的大网格是好的）；最后的 NaN 改成显存不足。
// 一个小节一件事：
//   66 启动：终端里 python main.py 一行行刷出来，最后一行是地址；点开地址，浅色画布从那一行展开成整个窗口（打开应用）
//   67 加节点：搜索框里打 ksampler；八个节点按工作流顺序一个个弹出来，连线等两头都到位后从输出口长到输入口
//   68 输入提示词：镜头推进 CLIP Text Encode，LoRA 触发词粘进来、动作逐字打进去；68.4 指针点 Run
//   69 采样：执行中的节点亮绿边，一站站往后传；KSampler 进度条走到 28/28，预览从噪声里出来
//   70 出图：Preview Image 展开到接近全屏，4×4 = 16 张随特效音的起音点一张张亮起
//   71 Run 被连点：每拍整批翻面换一批（seed 递增），心声（别再点重新生成了！）
//   72 cfg 一路拧到 30、steps 降到 4：16 张越来越"糊锅"，显存条变红
//   73 CUDA out of memory：报错框弹出，16 张碎成马赛克再散成噪点；最后一拍颜色抽干，显示器关机转进间奏二
// 整画面不闪不震（R4），冲击都在元素上
import { W, H, BRAND, BEAT, STEP } from '../core/const.js';
import { barStart, beatTime, clamp, lerp, smooth, easeIn, easeOut, easeOutBack, decay } from '../core/time.js';
import { hash, rnd, vnoise } from '../core/rand.js';
import { fonts } from '../core/glyphs.js';
import { camAt, withCam, camToScreen, pooled } from '../core/cam.js';
import { hud } from '../core/hud.js';
import { stamp } from '../core/kit.js';
import { css, mix } from '../core/color.js';
import { rrect } from '../core/ui.js';
import { tinted, shake } from '../core/fx.js';
import { UI, WIRE, STEPS, batchImage, imgOf, stepImage, lit } from './comfy_lib.js';

const T0 = barStart(66), T_APP = T0 + 0.9, T_ADD = barStart(67), T_PROMPT = barStart(68), T_CLICK = beatTime(68, 4);
const T_RUN = barStart(69), T_GRID = barStart(70), T_SPAM = barStart(71), T_HOT = barStart(72), T_OOM = barStart(73), T_DRAIN = beatTime(73, 4);
// 第十轮（用户）：提示词开头加 masterpiece, best quality, 1girl, slol,
const TRIGGER10 = 'masterpiece, best quality, 1girl, slol, deepseek_maid_outfit, navy blue maid dress, white frilled apron, blue whale emblem, dark blue neck bow, fins, ahoge, white bow, ';
const ACTION = 'upper body, singing joyfully, one hand raised, looking at viewer, pastel blue background';
const GREEN = '#3DDC84';

const sockY = i => 64 + i * 34;

// 第十轮（用户给的工作流）：UNET Loader → ModelSamplingAuraFlow（shift 3.00、sampling flow）→ Load LoRA → KSampler；
// CLIP Loader → LoRA 的 clip → 两个 CLIP Text Encode；VAE Loader → VAE Decode。不再用 Load Checkpoint。rev comfy=10
const N10 = [ // 模型链从左到右一条线：UNET → AuraFlow → LoRA → 两个 Encode → KSampler → Decode；加载器都在最左一列
  { id: 'unet', title: 'UNET Loader', x: 60, y: 100, w: 400, h: 180, out: [['MODEL', 'MODEL']], rows: [['unet_name', 'anima-aesthetic-v1.1.safetensors'], ['weight_dtype', 'default']] },
  { id: 'clipL', title: 'CLIP Loader', x: 60, y: 330, w: 400, h: 150, out: [['CLIP', 'CLIP']], rows: [['clip_name', 'qwen_3_06b_base.safetensors']] },
  { id: 'vaeL', title: 'VAE Loader', x: 60, y: 760, w: 400, h: 150, out: [['VAE', 'VAE']], rows: [['vae_name', 'qwen_image_vae.safetensors']] },
  { id: 'aura', title: 'ModelSamplingAuraFlow', x: 520, y: 100, w: 360, h: 200, in: [['model', 'MODEL']], out: [['MODEL', 'MODEL']], rows: [['shift', '3.00'], ['sampling', 'flow']] },
  { id: 'latent', title: 'Empty Latent Image', x: 520, y: 730, w: 360, h: 210, out: [['LATENT', 'LATENT']], rows: [['width', '1024'], ['height', '1024'], ['batch_size', '16']] },
  { id: 'lora', title: 'Load LoRA', x: 940, y: 100, w: 420, h: 260, in: [['model', 'MODEL'], ['clip', 'CLIP']], out: [['MODEL', 'MODEL'], ['CLIP', 'CLIP']], rows: [['lora_name', 'deepseek_maid_outfit.safetensors'], ['strength_model', '0.80'], ['strength_clip', '1.00']] },
  { id: 'pos', title: 'CLIP Text Encode (Prompt)', x: 1420, y: 100, w: 520, h: 350, in: [['clip', 'CLIP']], out: [['CONDITIONING', 'CONDITIONING']], text: true },
  { id: 'neg', title: 'CLIP Text Encode (Negative)', x: 1420, y: 490, w: 520, h: 190, in: [['clip', 'CLIP']], out: [['CONDITIONING', 'CONDITIONING']], neg: true },
  { id: 'ks', title: 'KSampler', x: 2000, y: 100, w: 460, h: 840, in: [['model', 'MODEL'], ['positive', 'CONDITIONING'], ['negative', 'CONDITIONING'], ['latent_image', 'LATENT']], out: [['LATENT', 'LATENT']], ks: true },
  { id: 'vae', title: 'VAE Decode', x: 2520, y: 100, w: 320, h: 140, in: [['samples', 'LATENT'], ['vae', 'VAE']], out: [['IMAGE', 'IMAGE']] },
  { id: 'grid', title: 'Preview Image', x: 2520, y: 290, w: 520, h: 650, in: [['images', 'IMAGE']], grid: true },
];const LINKS10 = [['unet', 0, 'aura', 0], ['aura', 0, 'lora', 0], ['clipL', 0, 'lora', 1], ['lora', 0, 'ks', 0], ['lora', 1, 'pos', 0], ['lora', 1, 'neg', 0],
  ['pos', 0, 'ks', 1], ['neg', 0, 'ks', 2], ['latent', 0, 'ks', 3], ['ks', 0, 'vae', 0], ['vaeL', 0, 'vae', 1], ['vae', 0, 'grid', 0]];
const EXEC10 = { unet: 0, clipL: 0.04, vaeL: 0.08, aura: 0.12, lora: 0.16, pos: 0.22, neg: 0.26, latent: 0.3, ks: 0.34, vae: 1.45, grid: 1.52 };

// 两版图：用哪一版在画帧时按开关选
const mk = (N, LINKS, EXEC, CAM, TRIGGER, gap) => ({ N, BY: Object.fromEntries(N.map(n => [n.id, n])), LINKS, EXEC, CAM, TRIGGER, gap });
let G12 = null;
const G = () => (G12 ??= mk(N12(), LINKS10, EXEC10, CAM10, TRIGGER10, 0.085));
// 第十二轮（用户：LoRA 改名 deepseek_whale_girl.safetensors；Latent 放到 VAE 上面）：Empty Latent 挪到左列、VAE Loader 正上方，VAE Loader 往下让一点。rev comfy12
const N12 = () => N10.map(n => n.id === 'lora' ? { ...n, rows: [['lora_name', 'deepseek_whale_girl.safetensors'], ...n.rows.slice(1)] }
  : n.id === 'latent' ? { ...n, x: 60, y: 520, w: 400 } : n.id === 'vaeL' ? { ...n, y: 790 } : n);
const appearT = n => T_ADD + 0.45 + G().N.indexOf(n) * G().gap;
const execOn = (id, t) => { const a = t - T_RUN - G().EXEC[id]; return a >= 0 && a < (id === 'ks' ? 1.13 : id === 'grid' ? 0.1 : 0.12); };

// ---------------------------------------------------------------- 状态
const runs = t => t < T_CLICK ? 0 : t < T_SPAM ? 1 : t < T_HOT ? 2 + Math.floor((t - T_SPAM) / BEAT) : 6 + Math.floor((t - T_HOT) / (2 * BEAT));
const seedOf = t => 114514 + Math.max(0, runs(t) - 1);
const burnOf = t => clamp((t - T_HOT) / (T_OOM - T_HOT));
const cfgOf = t => lerp(6, 30, smooth(burnOf(t)));
const stepsOf = t => Math.round(lerp(STEPS, 4, smooth(burnOf(t))));
const stepAt = t => t < T_RUN + 0.35 ? 0 : Math.min(STEPS, Math.floor(STEPS * smooth((t - T_RUN - 0.35) / 1.05)));

// 平面相机：画布中心 (wx, wy) 对准屏幕中心
const at = (wx, wy, zoom, e) => ({ x: wx - W / 2, y: wy - H / 2, zoom, rot: 0, ...(e ? { e } : {}) });
// 第十轮的图更宽（11 个节点），总览退到 0.66
const CAM10 = [
  { t: T_APP, ...at(1550, 520, 0.56) },
  { t: T_ADD + 0.3, ...at(1550, 520, 0.61, 'smooth') },
  { t: T_PROMPT, ...at(1550, 520, 0.61) },
  { t: T_PROMPT + 0.35, ...at(1690, 290, 1.7, 'out') },
  { t: T_CLICK - 0.05, ...at(1710, 290, 1.75) },
  { t: T_RUN, ...at(1550, 520, 0.64, 'smooth') },
  { t: T_RUN + 0.35, ...at(2230, 520, 1.2, 'out') },
  { t: T_GRID, ...at(2230, 520, 1.25) },
  { t: T_GRID + 0.3, ...at(2780, 615, 1.3, 'smooth') },
];

export function comfy(ctx, S) {
  const t = S.t;
  if (t < T_APP + 0.4) terminal(ctx, S, t);
  if (t >= T_APP) {
    const e = easeOut(clamp((t - T_APP) / 0.35));
    if (e < 1) { // 画布从终端里那行地址展开成整个窗口
      const [ux, uy, uw, uh] = URL_RECT, x = lerp(ux, 0, e), y = lerp(uy, 0, e), w = lerp(uw, W, e), h = lerp(uh, H, e);
      ctx.save(); rrect(ctx, x, y, w, h, lerp(10, 0, e)); ctx.clip();
      ctx.translate(x, y); ctx.scale(w / W, h / H); app(ctx, S, t); ctx.restore();
    } else app(ctx, S, t);
  }
  hud(ctx, S, { lyric: false, beats: false, spectrum: false, ruler: false });
  const dr = clamp((t - T_DRAIN) / 0.25); // 73 最后一拍：颜色抽干
  if (dr > 0) { ctx.save(); ctx.globalCompositeOperation = 'saturation'; ctx.globalAlpha = dr; ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
}

// ---------------------------------------------------------------- 66 启动：终端
const BOOT = ['$ python main.py --listen', 'Total VRAM 24576 MB, total RAM 65536 MB', 'Set vram state to: NORMAL_VRAM', 'Device: cuda:0', 'Using pytorch attention',
  'Import times for custom nodes: 0.4 seconds', 'Starting server', 'To see the GUI go to: http://127.0.0.1:8188'];
const TX = 260, TY = 190, TW = 1400, TH = 700, LINE_Y = k => TY + 110 + k * 54;
const URL_RECT = [TX + 40, LINE_Y(7) - 34, 760, 48];
// 第十五轮：L24 的 DeepSeek 窗口变成这扇终端窗口（core/trans.js winMorph）
export const termWin = () => ({ cx: TX + TW / 2, cy: TY + TH / 2, w: TW, h: TH, rot: 0, r: 16, edge: '#C9D3F5' });
// 第十二轮（用户：启动命令窗换成和整体配色一致的浅色）：纸白底 + 白窗口 + 浅蓝标题栏，字用深蓝灰，命令和地址用品牌蓝。rev comfy12
const TERM = () => ({ bg: '#EEF2FF', win: '#FFFFFF', edge: '#C9D3F5', head: '#E3E9FF', title: '#7D8496', cmd: BRAND, last: BRAND, text: '#4A5168', url: BRAND, caret: BRAND });
function terminal(ctx, S, t) {
  const C = TERM();
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.fillStyle = 'rgba(77,107,254,0.10)'; rrect(ctx, TX + 10, TY + 14, TW, TH, 16); ctx.fill();
  ctx.fillStyle = C.win; rrect(ctx, TX, TY, TW, TH, 16); ctx.fill();
  ctx.strokeStyle = C.edge; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = C.head; ctx.save(); rrect(ctx, TX, TY, TW, TH, 16); ctx.clip(); ctx.fillRect(TX, TY, TW, 46); ctx.restore();
  [['#FF5F57', 0], ['#FEBC2E', 1], ['#28C840', 2]].forEach(([c, i]) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(TX + 30 + i * 26, TY + 23, 8, 0, Math.PI * 2); ctx.fill(); });
  ctx.font = fonts(17, 'ZENB', 'SCB'); ctx.fillStyle = C.title; ctx.textAlign = 'center'; ctx.fillText('Terminal — ComfyUI', TX + TW / 2, TY + 29); ctx.textAlign = 'left';
  BOOT.forEach((s, k) => {
    const a = t - (T0 + 0.05 + k * STEP);
    if (a < 0) return;
    ctx.font = fonts(28, 'SC'); ctx.fillStyle = k === 0 ? C.cmd : k === 7 ? C.last : C.text;
    ctx.fillText(s, TX + 50, LINE_Y(k));
  });
  const ua = t - (T0 + 0.05 + 7 * STEP);
  if (ua >= 0) { // 地址：下划线 + 指针点一下
    ctx.font = fonts(28, 'SC'); const pre = ctx.measureText('To see the GUI go to: ').width, uw = ctx.measureText('http://127.0.0.1:8188').width;
    ctx.fillStyle = C.url; ctx.fillRect(TX + 50 + pre, LINE_Y(7) + 8, uw * easeOut(clamp(ua / 0.1)), 2);
    if (t > T_APP - 0.12) cursor(ctx, TX + 50 + pre + uw * 0.5, LINE_Y(7) - 4, t >= T_APP ? decay(t - T_APP, 10) : 0);
  } else if (Math.floor(t * 6) % 2 === 0) { ctx.fillStyle = C.caret; ctx.fillRect(TX + 50, LINE_Y(Math.max(0, Math.floor((t - T0) / STEP))) - 22, 14, 28); }
  ctx.restore();
}

// ---------------------------------------------------------------- 画布
function app(ctx, S, t) {
  const p = S.pal, cam = camAt(G().CAM, t), burn = burnOf(t);
  ctx.fillStyle = mix(UI.bg, '#E9D9E2', 0.4 * burn); ctx.fillRect(0, 0, W, H);
  // 点阵底（随相机走）
  ctx.fillStyle = UI.dot;
  const g0 = 40 * cam.zoom, ox = ((W / 2 - (cam.x + W / 2) * cam.zoom) % g0 + g0) % g0, oy = ((H / 2 - (cam.y + H / 2) * cam.zoom) % g0 + g0) % g0;
  for (let y = oy; y < H; y += g0) for (let x = ox; x < W; x += g0) ctx.fillRect(x, y, 2, 2);
  withCam(ctx, cam, 1, g => {
    wires(g, S, t);
    for (const n of G().N) node9(g, S, n, t);
  });
  // 启动画面：画布中间 ComfyUI 字标 + 一圈加载环（67 之前）
  const sa = clamp((t - T_APP - 0.2) / 0.15) * (1 - clamp((t - T_ADD + 0.1) / 0.15));
  if (sa > 0) {
    ctx.save(); ctx.globalAlpha = sa;
    ctx.font = fonts(76, 'ZENB', 'SCB'); ctx.fillStyle = UI.text; ctx.textAlign = 'center'; ctx.fillText('ComfyUI', W / 2, H / 2 + 26); ctx.textAlign = 'left';
    const lp = clamp((t - T_APP - 0.2) / (T_ADD - T_APP - 0.35));
    ctx.strokeStyle = '#D5D9E2'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(W / 2, H / 2 + 120, 26, 0, Math.PI * 2); ctx.stroke();
    // 第二十二轮（同类：进度环满了反而消失，见 kit.js ring）：满了画整圆（第二十四轮并开关）
    ctx.strokeStyle = BRAND; ctx.beginPath(); if (lp >= 0.9995) ctx.arc(W / 2, H / 2 + 120, 26, 0, Math.PI * 2); else ctx.arc(W / 2, H / 2 + 120, 26, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * lp); ctx.stroke();
    ctx.restore();
  }
  searchBox(ctx, S, t);
  const ge = gridOverlay(ctx, S, t, cam);
  if (ge < 1) topBar(ctx, S, t, 1 - ge);
  overlays(ctx, S, t);
  pointer(ctx, S, t, ge);
}

// 连线：两头的节点都出现后，从输出口长到输入口；采样时上面跑白色数据点
function wires(g, S, t) {
  const p = S.pal, burn = burnOf(t), brk = clamp((t - T_OOM - 0.2) / 0.6);
  const { LINKS, BY } = G();
  for (const [a, ai, b, bi] of LINKS) {
    const A = BY[a], B = BY[b], type = A.out[ai][1], t0 = Math.max(appearT(A), appearT(B)) + 0.06, u = easeOut(clamp((t - t0) / 0.22));
    if (u <= 0) continue;
    const x0 = A.x + A.w, y0 = A.y + sockY(ai), x1 = B.x, y1 = B.y + sockY(bi), dx = Math.max(80, Math.abs(x1 - x0) * 0.5);
    const P = s => { const v = 1 - s; return [v * v * v * x0 + 3 * v * v * s * (x0 + dx) + 3 * v * s * s * (x1 - dx) + s * s * s * x1, v * v * v * y0 + 3 * v * v * s * y0 + 3 * v * s * s * y1 + s * s * s * y1]; };
    g.save(); g.globalAlpha = 1 - brk;
    g.lineWidth = 4; g.lineCap = 'round'; g.strokeStyle = burn > 0.3 ? mix(WIRE[type], p.acc[0], burn) : WIRE[type];
    g.beginPath(); for (let k = 0; k <= 40; k++) { const [x, y] = P((k / 40) * u); k ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
    if (t >= T_RUN && t < T_OOM) { const [x, y] = P((t * 0.9 + hash(ai, bi, 3) / 4294967296) % 1); g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill(); g.strokeStyle = WIRE[type]; g.lineWidth = 2; g.stroke(); }
    g.restore();
  }
}

// 一个节点：弹出（outBack），执行中亮绿边，糊锅时 KSampler / Preview 边框变粉
function node9(g, S, n, t) {
  const a = t - appearT(n);
  if (a < 0) return;
  const p = S.pal, s = easeOutBack(clamp(a / 0.18), 1.8), hot = burnOf(t), ex = execOn(n.id, t), oom = t >= T_OOM && (n.ks || n.grid);
  g.save();
  g.translate(n.x + n.w / 2, n.y + n.h / 2); g.scale(s, s); g.translate(-n.x - n.w / 2, -n.y - n.h / 2);
  if (oom) { const [sx, sy] = shake(t, 8 * decay(t - T_OOM, 5)); g.translate(sx, sy); }
  g.fillStyle = 'rgba(40,45,60,0.10)'; rrect(g, n.x + 6, n.y + 8, n.w, n.h, 14); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.92)'; rrect(g, n.x, n.y, n.w, n.h, 14); g.fill();
  g.lineWidth = ex ? 5 : 2; g.strokeStyle = oom ? '#E5484D' : ex ? GREEN : hot > 0.5 && (n.ks || n.grid) ? mix('#969CAC', p.acc[0], hot) : UI.edge; g.stroke();
  g.save(); rrect(g, n.x, n.y, n.w, n.h, 14); g.clip(); g.fillStyle = UI.head; g.fillRect(n.x, n.y, n.w, 42); g.restore();
  g.font = fonts(21, 'SCB'); g.fillStyle = UI.text; g.textBaseline = 'middle'; g.fillText(n.title, n.x + 20, n.y + 22);
  g.font = fonts(14, 'SC'); g.fillStyle = UI.gray; g.textAlign = 'right'; g.fillText(`#${10 + G().N.indexOf(n)}`, n.x + n.w - 16, n.y + 22); g.textAlign = 'left';
  (n.in || []).forEach(([name, type], i) => { const y = n.y + sockY(i); g.fillStyle = WIRE[type]; g.beginPath(); g.arc(n.x, y, 7, 0, Math.PI * 2); g.fill(); g.fillStyle = UI.text; g.font = fonts(16, 'SC'); g.fillText(name, n.x + 18, y); });
  (n.out || []).forEach(([name, type], i) => { const y = n.y + sockY(i); g.fillStyle = WIRE[type]; g.beginPath(); g.arc(n.x + n.w, y, 7, 0, Math.PI * 2); g.fill(); g.fillStyle = UI.text; g.font = fonts(16, 'SCB'); g.textAlign = 'right'; g.fillText(name, n.x + n.w - 18, y); g.textAlign = 'left'; });
  const y0 = n.y + 64 + Math.max((n.in || []).length, (n.out || []).length) * 34 + 6;
  const widget = (k, v, y, hi = false) => {
    g.fillStyle = hi ? mix('#F1F3F7', p.acc[0], 0.25) : UI.widget; rrect(g, n.x + 16, y, n.w - 32, 30, 15); g.fill();
    g.font = fonts(15, 'SC'); g.fillStyle = UI.gray; g.fillText(k, n.x + 30, y + 16);
    g.textAlign = 'right'; g.fillStyle = hi ? p.acc[0] : UI.text; g.font = fonts(15, hi ? 'SCB' : 'SC'); g.fillText(v, n.x + n.w - 30, y + 16); g.textAlign = 'left';
  };
  (n.rows || []).forEach(([k, v], i) => widget(k, v, y0 + i * 38));
  if (n.text) promptBox(g, S, n, t, y0);
  if (n.neg) { g.fillStyle = UI.widget; rrect(g, n.x + 16, y0, n.w - 32, n.h - (y0 - n.y) - 16, 10); g.fill(); g.font = fonts(17, 'SC'); g.fillStyle = UI.gray; g.fillText('lowres, bad hands, extra fingers, text, watermark', n.x + 30, y0 + 24); }
  if (n.ks) {
    const rows = [['seed', String(seedOf(t))], ['control_after_generate', 'increment'], ['steps', String(stepsOf(t))], ['cfg', cfgOf(t).toFixed(1)], ['sampler_name', 'euler_ancestral'], ['scheduler', 'normal'], ['denoise', '1.00']];
    rows.forEach(([k, v], i) => widget(k, v, y0 + i * 38, (k === 'cfg' || k === 'steps') && t >= T_HOT));
    const py = y0 + rows.length * 38 + 10, ps = n.w - 40, ph = Math.min(ps, n.y + n.h - py - 34), st = stepAt(t), r = Math.max(0, runs(t) - 1);
    if (t >= T_RUN + 0.3) {
      // 第十轮（用户：预览本来是方的，被压扁了）：按框的宽高比裁切，不再拉伸；竖向偏上取，脸在上半
      const img = stepImage(imgOf(r, 0), st, 560), sh = Math.min(560, (560 * ph) / ps), sy = (560 - sh) * 0.3;
      g.drawImage(img, 0, sy, 560, sh, n.x + 20, py, ps, ph);
    }
    else { g.fillStyle = UI.widget; g.fillRect(n.x + 20, py, ps, ph); }
    g.fillStyle = '#E0E3EA'; rrect(g, n.x + 20, py + ph + 12, ps, 12, 6); g.fill();
    g.fillStyle = GREEN; rrect(g, n.x + 20, py + ph + 12, ps * (st / STEPS), 12, 6); g.fill();
    g.font = fonts(16, 'SCB'); g.fillStyle = UI.text; g.fillText(`${st}/${STEPS}`, n.x + 24, py + 18);
  }
  if (n.grid) { g.fillStyle = UI.widget; rrect(g, n.x + 16, y0, n.w - 32, n.h - (y0 - n.y) - 16, 10); g.fill(); }
  g.textBaseline = 'alphabetic';
  g.restore();
}

// 提示词：68.3 触发词一下粘进来（选中色淡去），然后动作逐字打进去
function promptBox(g, S, n, t, y0) {
  const p = S.pal, x = n.x + 16, w = n.w - 32, h = n.h - (y0 - n.y) - 16, paste = t - (T_PROMPT + 0.3);
  g.fillStyle = UI.widget; rrect(g, x, y0, w, h, 10); g.fill();
  if (t >= T_PROMPT + 0.25 && t < T_RUN) { g.lineWidth = 2; g.strokeStyle = BRAND; g.stroke(); }
  let text = '';
  const TRIGGER = G().TRIGGER;
  if (paste >= 0) text = TRIGGER + ACTION.slice(0, Math.floor(clamp((paste - 0.15) / 0.65) * ACTION.length));
  g.font = fonts(19, 'SC'); g.fillStyle = UI.text;
  const lines = []; let line = '';
  for (const word of text.split(/(?<=, )/)) { if (g.measureText(line + word).width > w - 30) { lines.push(line); line = ''; } line += word; }
  lines.push(line);
  const sel = paste >= 0 ? 1 - clamp((paste - 0.05) / 0.25) : 0, nTrig = TRIGGER.length;
  let used = 0;
  lines.forEach((s, i) => {
    const yy = y0 + 28 + i * 28;
    if (sel > 0 && used < nTrig) { const k = Math.min(s.length, nTrig - used); g.fillStyle = css(BRAND, 0.25 * sel); g.fillRect(x + 12, yy - 13, g.measureText(s.slice(0, k)).width, 26); }
    g.fillStyle = used + s.length <= nTrig ? mix(UI.text, BRAND, 0.55) : UI.text; g.fillText(s, x + 14, yy);
    used += s.length;
  });
  if (paste >= 0 && t < T_CLICK && Math.floor(t * 5) % 2 === 0) { const last = lines[lines.length - 1]; g.fillStyle = BRAND; g.fillRect(x + 16 + g.measureText(last).width, y0 + 28 + (lines.length - 1) * 28 - 12, 2, 24); }
}

// 67 开头：节点搜索框（双击画布），打 ksampler
function searchBox(ctx, S, t) {
  const a = t - T_ADD;
  if (a < 0 || a > 0.5) return;
  const e = easeOutBack(clamp(a / 0.1), 1.6) * (1 - clamp((a - 0.42) / 0.08)), x = 660, y = 330;
  ctx.save(); ctx.globalAlpha = clamp(e);
  ctx.translate(x + 300, y); ctx.scale(e, e); ctx.translate(-x - 300, -y);
  ctx.fillStyle = 'rgba(40,45,60,0.12)'; rrect(ctx, x + 6, y + 8, 600, 260, 14); ctx.fill();
  ctx.fillStyle = '#FFFFFF'; rrect(ctx, x, y, 600, 260, 14); ctx.fill(); ctx.strokeStyle = UI.edge; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = UI.widget; rrect(ctx, x + 16, y + 16, 568, 46, 10); ctx.fill();
  const q = 'ksampler'.slice(0, Math.floor(clamp((a - 0.08) / 0.24) * 8));
  ctx.font = fonts(22, 'SC'); ctx.fillStyle = UI.text; ctx.fillText(q, x + 34, y + 46);
  ctx.fillStyle = BRAND; ctx.fillRect(x + 36 + ctx.measureText(q).width, y + 28, 2, 24);
  ['KSampler', 'KSampler (Advanced)', 'SamplerCustom'].forEach((s, i) => {
    const yy = y + 86 + i * 52;
    if (i === 0 && q.length > 3) { ctx.fillStyle = mix('#FFFFFF', BRAND, 0.12); rrect(ctx, x + 12, yy - 6, 576, 46, 8); ctx.fill(); }
    ctx.font = fonts(20, i === 0 ? 'SCB' : 'SC'); ctx.fillStyle = q.length > 3 || i ? UI.text : UI.gray; ctx.fillText(s, x + 34, yy + 24);
    ctx.font = fonts(15, 'SC'); ctx.fillStyle = UI.gray; ctx.textAlign = 'right'; ctx.fillText('sampling', x + 570, yy + 24); ctx.textAlign = 'left';
  });
  ctx.restore();
}

// 顶栏（屏幕坐标，HUD 下面一条）：左边 ComfyUI 菜单和资源条，右边队列和 Run
const RUN_BTN = [W - 236, 98];
function topBar(ctx, S, t, alpha) {
  const p = S.pal, vram = t < T_CLICK ? 0.31 : t < T_HOT ? 0.62 : t < T_OOM ? lerp(0.62, 0.99, burnOf(t)) : 1;
  ctx.save(); ctx.globalAlpha = alpha * clamp((t - T_APP - 0.25) / 0.2);
  ctx.fillStyle = 'rgba(255,255,255,0.9)'; rrect(ctx, 24, 72, W - 48, 52, 12); ctx.fill(); ctx.strokeStyle = UI.edge; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.font = fonts(20, 'ZENB', 'SCB'); ctx.fillStyle = UI.text; ctx.textBaseline = 'middle'; ctx.fillText('ComfyUI', 48, 98);
  ctx.font = fonts(16, 'SC'); ctx.fillStyle = UI.gray; ctx.fillText('Workflow     Edit     Help', 170, 98);
  ctx.fillStyle = UI.widget; rrect(ctx, 760, 82, 300, 32, 8); ctx.fill(); ctx.fillStyle = UI.text; ctx.fillText('whale_chan.json', 780, 98);
  vramBar(ctx, S, 1120, 98, vram, t);
  runButton(ctx, S, t, ...RUN_BTN);
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}
function vramBar(ctx, S, x, y, v, t) {
  const p = S.pal;
  ctx.font = fonts(14, 'ZENB', 'SCB'); ctx.fillStyle = UI.gray; ctx.textBaseline = 'middle'; ctx.fillText('VRAM', x, y);
  ctx.fillStyle = '#E0E3EA'; rrect(ctx, x + 52, y - 6, 180, 12, 6); ctx.fill();
  ctx.fillStyle = v > 0.9 ? '#E5484D' : BRAND; rrect(ctx, x + 52, y - 6, 180 * clamp(v), 12, 6); ctx.fill();
  ctx.fillStyle = v > 0.9 ? '#E5484D' : UI.text; ctx.fillText(`${(24 * v).toFixed(1)} / 24.0 GB`, x + 244, y);
}
// Run 按钮（中心 cx, cy）：点击时缩一下（元素层）；左边是队列数
function pressAt(t) {
  if (t >= T_CLICK && t < T_CLICK + 0.3) return decay(t - T_CLICK, 12);
  if (t >= T_SPAM && t < T_HOT) return decay((t - T_SPAM) % BEAT, 14);
  return 0;
}
function runButton(ctx, S, t, cx, cy) {
  const pr = pressAt(t);
  ctx.save();
  ctx.font = fonts(16, 'SCB'); ctx.fillStyle = UI.text; ctx.textBaseline = 'middle'; ctx.textAlign = 'right'; ctx.fillText(`queue ${Math.max(0, runs(t))}`, cx - 84, cy); ctx.textAlign = 'left';
  ctx.translate(cx, cy); ctx.scale(1 - 0.1 * pr, 1 - 0.1 * pr);
  ctx.fillStyle = mix('#6E9CFF', BRAND, 0.5); rrect(ctx, -70, -19, 140, 38, 10); ctx.fill();
  ctx.fillStyle = '#FFFFFF'; ctx.font = fonts(19, 'SCB'); ctx.textAlign = 'center'; ctx.fillText('▷ Run', 0, 1);
  ctx.restore();
}

// 70 起：Preview Image 从节点展开到接近全屏。返回展开程度 0..1
const GRID_RECT = [40, 76, W - 80, H - 112];
function gridOverlay(ctx, S, t, cam) {
  if (t < T_GRID + 0.2) return 0;
  const p = S.pal, n = G().BY.grid, e = easeOut(clamp((t - T_GRID - 0.2) / 0.35));
  const [ax, ay] = camToScreen(cam, 1, n.x, n.y), [bx, by] = camToScreen(cam, 1, n.x + n.w, n.y + n.h);
  const [gx, gy, gw, gh] = GRID_RECT, x = lerp(ax, gx, e), y = lerp(ay, gy, e), w = lerp(bx - ax, gw, e), h = lerp(by - ay, gh, e);
  const oom = t - T_OOM, [sx, sy] = oom >= 0 ? shake(t, 12 * decay(oom, 4)) : [0, 0];
  ctx.save(); ctx.translate(sx, sy);
  ctx.fillStyle = css('#2A2E3A', 0.18 * e); ctx.fillRect(-20, -20, W + 40, H + 40); // 后面的画布压暗一点
  ctx.fillStyle = 'rgba(40,45,60,0.14)'; rrect(ctx, x + 8, y + 10, w, h, 16); ctx.fill();
  ctx.fillStyle = '#FFFFFF'; rrect(ctx, x, y, w, h, 16); ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = oom >= 0 ? '#E5484D' : burnOf(t) > 0.5 ? mix('#969CAC', p.acc[0], burnOf(t)) : UI.edge; ctx.stroke();
  // 标题栏：节点名、批次信息、显存条、Run
  ctx.save(); rrect(ctx, x, y, w, h, 16); ctx.clip(); ctx.fillStyle = UI.head; ctx.fillRect(x, y, w, 56 * e + 42 * (1 - e)); ctx.restore();
  ctx.font = fonts(22, 'SCB'); ctx.fillStyle = UI.text; ctx.textBaseline = 'middle';
  ctx.fillText(`Preview Image  ·  batch ${Math.max(1, runs(t))}  ·  seed ${seedOf(t)}`, x + 22, y + 28);
  if (e >= 1) { vramBar(ctx, S, x + w - 760, y + 28, t < T_HOT ? 0.62 : t < T_OOM ? lerp(0.62, 0.99, burnOf(t)) : 1, t); runButton(ctx, S, t, x + w - 100, y + 28); }
  ctx.textBaseline = 'alphabetic';
  // 16 格
  const pad = 16, gap = 12, top = y + 56 * e + 42 * (1 - e) + pad * e, cw = (w - 2 * pad - 3 * gap) / 4, ch = (y + h - pad - top - 3 * gap) / 4;
  if (cw > 4 && ch > 4) for (let i = 0; i < 16; i++) cell(ctx, S, t, i, x + pad + (i % 4) * (cw + gap), top + Math.floor(i / 4) * (ch + gap), cw, ch);
  ctx.restore();
  return e;
}
// 一格：出现（outBack）、特效音点亮、71 每拍翻面、72 糊锅、73 先变马赛克再散成噪点
function cell(ctx, S, t, i, x, y, w, h) {
  const p = S.pal, ap = t - (T_GRID + 0.45 + i * 0.05);
  if (ap < 0) { ctx.fillStyle = UI.widget; ctx.fillRect(x, y, w, h); return; }
  const r = Math.max(0, runs(t) - 1), burn = burnOf(t), [la, ls] = lit(i, t), glow = la < 0.45 ? decay(la, 6) * (0.4 + 0.6 * ls) : 0;
  const flip = t >= T_SPAM && t < T_HOT ? Math.abs(Math.cos(Math.PI * clamp(((t - T_SPAM) % BEAT) / 0.12))) : 1;
  const sc = easeOutBack(clamp(ap / 0.15), 1.6), brk = t - (T_OOM + 0.15 + rnd(i, 61) * 0.55);
  ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.scale(flip * sc, sc);
  const img = batchImage(imgOf(r, i), 512), sw = img.width, shh = sw * (h / w), sy0 = Math.min(sw - shh, sw * 0.08);
  const draw = (c, src) => c.drawImage(src, 0, sy0, sw, shh, -w / 2, -h / 2, w, h);
  if (brk > 0) { // 马赛克 → 噪点
    const k = Math.max(2, Math.round(lerp(14, 3, clamp(brk / 0.4)))), mw = Math.ceil(k * 2), mh = k, mc = pooled('cfmos', 32, 16), m = mc.getContext('2d');
    m.clearRect(0, 0, 32, 16); m.drawImage(img, 0, sy0, sw, shh, 0, 0, mw, mh);
    ctx.globalAlpha = 1 - clamp((brk - 0.35) / 0.4); ctx.imageSmoothingEnabled = false; ctx.drawImage(mc, 0, 0, mw, mh, -w / 2, -h / 2, w, h); ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = 1;
    for (let q = 0; q < 40; q++) { const u = rnd(i, q, S.frame); ctx.fillStyle = [BRAND, p.acc[0], p.acc[1], p.acc[2], UI.text][hash(i, q, S.frame) % 5]; ctx.fillRect(-w / 2 + u * w, -h / 2 + rnd(q, i, S.frame) * h + brk * 200 * rnd(q, 3), 4, 4); }
  } else if (burn > 0.05) {
    ctx.filter = `saturate(${1 + 3 * burn}) contrast(${1 + 0.8 * burn})`; draw(ctx, img); ctx.filter = 'none';
    ctx.globalAlpha = 0.45 * burn; ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(tinted(img, '#FF2BD6'), 0, sy0, sw, shh, -w / 2 + 8 * burn, -h / 2, w, h); ctx.drawImage(tinted(img, '#00E5FF'), 0, sy0, sw, shh, -w / 2 - 8 * burn, -h / 2, w, h);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  } else draw(ctx, img);
  if (glow > 0 && brk < 0) { ctx.fillStyle = css('#FFFFFF', 0.3 * glow); ctx.fillRect(-w / 2, -h / 2, w, h); }
  if (brk < 0.4) {
    ctx.lineWidth = 2 + 3 * glow; ctx.strokeStyle = brk > 0 ? '#E5484D' : glow > 0.1 ? p.acc[0] : 'rgba(150,156,172,0.6)'; ctx.strokeRect(-w / 2, -h / 2, w, h);
    ctx.font = fonts(14, 'SCB'); ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineJoin = 'round';
    const lab = `#${String(i + 1).padStart(2, '0')} · ${seedOf(t) + i}`; ctx.strokeText(lab, -w / 2 + 10, h / 2 - 12); ctx.fillStyle = '#FFFFFF'; ctx.fillText(lab, -w / 2 + 10, h / 2 - 12);
  }
  ctx.restore();
}

// 心声、cfg 读数、显存报错
function overlays(ctx, S, t) {
  const p = S.pal, ia = t - (T_SPAM + 0.4);
  if (ia >= 0 && t < T_HOT + 0.3) {
    // 第十二轮（用户：「别再点重新生成了！」换个字体）：楷体换成得意黑（斜体圆润，像心里嘀咕）
    ctx.save(); ctx.font = fonts(64, 'SMILEY', 'SCB'); ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    const y = H - 70 + 8 * Math.sin(ia * 18) * decay(ia, 4);
    ctx.lineWidth = 14; ctx.strokeStyle = '#FFFFFF'; ctx.strokeText('（别再点重新生成了！）', W / 2, y);
    ctx.fillStyle = UI.gray; ctx.fillText('（别再点重新生成了！）', W / 2, y); ctx.restore();
  }
  if (t >= T_HOT && t < T_OOM + 0.3) {
    const b = burnOf(t);
    ctx.save(); ctx.font = fonts(110, 'ZENB', 'SCB'); ctx.textAlign = 'right'; ctx.lineJoin = 'round'; ctx.lineWidth = 16; ctx.strokeStyle = '#FFFFFF';
    const s = `cfg ${cfgOf(t).toFixed(1)}`; ctx.strokeText(s, W - 90, H - 120); ctx.fillStyle = mix(BRAND, p.acc[0], b); ctx.fillText(s, W - 90, H - 120);
    ctx.font = fonts(28, 'SC'); ctx.lineWidth = 8; ctx.strokeText(`steps ${stepsOf(t)} · 糊锅中`, W - 94, H - 74); ctx.fillStyle = UI.gray; ctx.fillText(`steps ${stepsOf(t)} · 糊锅中`, W - 94, H - 74);
    ctx.restore();
  }
  const oa = t - T_OOM;
  if (oa >= 0) { // ComfyUI 的报错框：红色标题条
    const y = lerp(H + 40, 360, easeOutBack(clamp(oa / 0.22), 1.4)), x = 400, w = 1120, h = 300;
    ctx.save();
    ctx.fillStyle = 'rgba(40,45,60,0.18)'; rrect(ctx, x + 8, y + 10, w, h, 16); ctx.fill();
    ctx.fillStyle = '#FFFFFF'; rrect(ctx, x, y, w, h, 16); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#E5484D'; ctx.stroke();
    ctx.save(); rrect(ctx, x, y, w, h, 16); ctx.clip(); ctx.fillStyle = '#E5484D'; ctx.fillRect(x, y, w, 52); ctx.restore();
    ctx.font = fonts(22, 'SCB'); ctx.fillStyle = '#FFFFFF'; ctx.fillText('Prompt execution failed', x + 28, y + 34);
    ctx.font = fonts(22, 'SCB'); ctx.fillStyle = '#E5484D'; ctx.fillText('Error occurred when executing KSampler:', x + 28, y + 98);
    ctx.font = fonts(34, 'SCB'); ctx.fillStyle = UI.text; ctx.fillText('torch.OutOfMemoryError: CUDA out of memory.', x + 28, y + 152);
    ctx.font = fonts(22, 'SC'); ctx.fillStyle = UI.gray;
    ctx.fillText(`Tried to allocate 16.00 GiB · 24.00 GiB total · 0 bytes free · cfg ${cfgOf(t).toFixed(0)} · seed ${seedOf(t)}`, x + 28, y + 200);
    [['Copy Error', 0], ['Close', 1]].forEach(([s, i]) => { const bx = x + w - 330 + i * 170; ctx.fillStyle = i ? '#E5484D' : UI.widget; rrect(ctx, bx, y + h - 66, 150, 42, 10); ctx.fill(); ctx.fillStyle = i ? '#FFFFFF' : UI.text; ctx.font = fonts(18, 'SCB'); ctx.textAlign = 'center'; ctx.fillText(s, bx + 75, y + h - 38); ctx.textAlign = 'left'; });
    ctx.restore();
    // 第十二轮：印章底下垫白。第十五轮（用户：青色改成深蓝色相，出现时间往后一点）：深蓝，落在 73 小节第 3 拍（以前报错框出来 0.35 s 后）。rev oom15
    stamp(ctx, S, '显存不足', x + w - 140, y - 10, 46, oa - (beatTime(73, 3) - T_OOM), { rot: 0.12, fill: '#FFFFFF', color: '#2A3CC4' });
  }
}

// 指针：67 双击画布、68.4 点 Run、71 每拍连点 Run
function pointer(ctx, S, t, ge) {
  let px = null, py = null, pr = 0;
  if (t >= T_ADD - 0.25 && t < T_ADD + 0.12) { const u = easeOut(clamp((t - T_ADD + 0.25) / 0.25)); px = lerp(1200, 960, u); py = lerp(700, 360, u); pr = t >= T_ADD ? decay(t - T_ADD, 14) : 0; }
  else if (t >= T_CLICK - 0.4 && t < T_CLICK + 0.25) { const u = easeOut(clamp((t - T_CLICK + 0.4) / 0.32)); px = lerp(1300, RUN_BTN[0], u); py = lerp(600, RUN_BTN[1], u); pr = pressAt(t); }
  else if (t >= T_SPAM - 0.3 && t < T_HOT + 0.2 && ge >= 1) { const [gx, gy, gw] = GRID_RECT, u = easeOut(clamp((t - T_SPAM + 0.3) / 0.3)); px = lerp(1500, gx + gw - 100, u) + 4 * Math.sin(t * 9); py = lerp(700, gy + 30, u); pr = pressAt(t); }
  if (px !== null) cursor(ctx, px + 6, py + 6 + 6 * pr, pr);
}
function cursor(ctx, x, y, press = 0) {
  ctx.save(); ctx.translate(x, y); ctx.scale(1.7 - 0.15 * press, 1.7 - 0.15 * press);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 22); ctx.lineTo(6, 17); ctx.lineTo(10, 26); ctx.lineTo(14, 24); ctx.lineTo(10, 15); ctx.lineTo(17, 15); ctx.closePath();
  ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = UI.text; ctx.stroke();
  if (press > 0.05) { ctx.strokeStyle = css(BRAND, press); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 10 + 14 * (1 - press), 0, Math.PI * 2); ctx.stroke(); }
  ctx.restore();
}
