// 尾奏（107–120 小节，2:49.67–3:11.69），视觉方案 §5.8，第七轮实现
// 1：制作信息做成一张 API 小票逐行解码，表情包贴纸每拍从四周弹出（S01–S10 到位前用立绘裁切 + 代码写的字）
//    第二十轮（rev out20）：小票换成一张 ComfyUI 工作流——每组制作信息是一个节点，一个个跑完、连线流向 Save Video
// 2：用量面板；112 一声短促人声 → 她的头像冒出「嘿嘿」
// 3：编制撤出，对话窗口回到中央，她的最后一条消息逐 token 输出；页脚「内容由 AI 生成，请仔细甄别」
// 4：窗口缩进前奏那台显示器（同一个科技风机身，首尾呼应）；屏幕里像素鲸鱼游过、翻肚皮躺下；标题解码 → 散成像素 → 白场
//    第二十轮（rev title20）：标题换成字标（core/logo.js，和前奏同一个），显示器缩的时候就开始打字
import { W, H, CW, CH, BRAND, BEAT, STEP, DURATION } from '../core/const.js';
import { barStart, beatTime, clamp, lerp, smooth, easeIn, easeOut, easeOutBack, decay } from '../core/time.js';
import { rev } from '../rev.js';
import { hash, rnd, vnoise } from '../core/rand.js';
import { font, fonts } from '../core/glyphs.js';
import { fact, D } from '../core/data.js';
import { photo, hasIllust } from '../core/portrait.js';
import { pooled } from '../core/cam.js';
import { hud } from '../core/hud.js';
import { card, ring, barcode, stamp, popIn } from '../core/kit.js';
import { drawSprite } from '../core/sprites.js';
import { ringScanner, hudCluster, segBar } from '../core/hudkit.js';
import { sampleText, drawPoints } from '../core/particles.js';
import { css, mix } from '../core/color.js';
import { rrect, speechBubble } from '../core/ui.js';
import { memoryFrame } from '../core/memory.js';
import { newCanvas } from '../core/env.js';
import { flash } from '../core/fx.js';
import { decode } from '../core/text.js';
import { drawLogo } from '../core/logo.js';
import { paper, backDeco, frontDeco, punch, chatWin, drawCRT, crtGeometry } from './scene.js';

const O1 = barStart(107), O2 = barStart(111), O3 = barStart(115), O4 = barStart(119);
const TITLE = '如果代码能长出海';

// ================================================================ 尾奏 1：制作信息
// 第二十轮：制作信息改成一张工作流（她在 ComfyUI 里画完的第 17 张）；第七轮的小票第二十二轮、第二十轮那一版工作流第二十四轮并开关时删了（快照里有）。
// 用户（第二十轮）：「收据这个形式与题材不太搭，换成别的；『DeepSeek × 小缘 · 电子天使 · 非商业二创』看起来像官方联动，换掉；翻唱写成『小缘 - 电子天使（BV1xs41167Ee）』；
// 人设相关的放到一起，再加 LoRA DeepSeek Whale Girl；形式致敬改成灵感参考；去掉特别感谢、下一首和字体；加上用到的模型」
const ROWS20 = {
  audio: [['原曲', 'ヤスオP「えれくとりっく・えんじぇぅ」'], ['翻唱', '小缘 - 电子天使（BV1xs41167Ee）']],
  chara: [['角色', '鲸鱼娘 · 原设 上善无形'], ['女仆版设计', 'ZipZipPipe（CC BY-NC-SA 4.0）'], ['人设与梗', 'deepseek-whalechan · dafeiyu-persona'], ['LoRA', 'DeepSeek Whale Girl · civitai.com/models/2697171']],
  ref: [['', '《大肥鱼眼中的 world.execute(me);》']],
};
const GREEN20 = '#3DDC84';

// ---------------------------------------------------------------- 第二十二轮：工作流加细节（用户第二十二轮 2:52）。第二十四轮并开关 out22
// 用户：「Preview Image 节点内内容改成这个视频前面内容的超快速播放，表情包换到其他位置使用，如果用不上就不用；在节点左上角增加读秒时间计数；
// 生图模型的 gpt-image-2.5 后面增加『（表情包）』；丰富 ComfyUI 周围细节；加上作者『烧猫定食』，放到 CLIP 加载器里；文本提示词就是这些修改方案，
// 尽可能多的放上去滚动显示，只要暂停了能看清就行」。
// 做法：节点按 ComfyUI 真实的样子补齐——两个分组框（制作信息 / 采样与输出）、Load CLIP（作者）→ CLIP Text Encode（历轮修改意见，滚动）→ KSampler（步数进度）
// → 折叠的 VAE Decode → Preview Image（片子前面内容约 57 倍速回放，左上角计时）/ Save Video；顶上一条工作流菜单栏、右下角小地图、一个转接点。
// 表情包这里用不上，去掉了（其他地方也没有合适的位置，就不用了）
const MODEL_ROWS22 = [['主力模型', 'Claude Opus 5.5'], ['打杂担当', 'DeepSeek-V4.1-Flash · GPT6.1 Sol（核对出处、跑渲染、抠蒙版）'], ['生图模型', 'Anima-aesthetic-v1.1 · gpt-image-2.5（表情包）'], ['视频模型', 'MiniMax H3']];
const RH22 = 46;
const NODES22 = [
  { id: 'audio', title: 'Load Audio', x: 60, y: 110, w: 680, out: [['AUDIO', '#7FC8A9']], rows: ROWS20.audio },
  { id: 'chara', title: 'Load LoRA · 人设', x: 60, y: 300, w: 680, out: [['MODEL', '#B39DDB']], rows: ROWS20.chara },
  { id: 'models', title: 'Models · 模型', x: 60, y: 582, w: 680, out: [['MODEL', '#B39DDB']], rows: MODEL_ROWS22 },
  { id: 'clip', title: 'Load CLIP · 作者', x: 60, y: 864, w: 680, out: [['CLIP', '#E8C33A']], rows: [['作者', '烧猫定食']], author: true },
  { id: 'prompt', title: 'CLIP Text Encode · 修改意见', x: 800, y: 110, w: 460, h: 360, in: [['clip', '#E8C33A']], out: [['CONDITIONING', '#F2994A']], prompt: true },
  { id: 'ref', title: 'Reference · 灵感参考', x: 800, y: 878, w: 460, out: [['CONDITIONING', '#F2994A']], rows: ROWS20.ref },
  { id: 'ks', title: 'KSampler', x: 1310, y: 110, w: 550, h: 340, in: [['model', '#B39DDB'], ['positive', '#F2994A']], out: [['LATENT', '#F28BD9']], ks: true },
  { id: 'vae', title: 'VAE Decode', x: 1310, y: 466, w: 230, h: 34, in: [['samples', '#F28BD9']], out: [['IMAGE', '#64B5F6']], collapsed: true },
  { id: 'preview', title: 'Preview Image', x: 800, y: 496, w: 460, h: 352, in: [['images', '#64B5F6']], preview: true },
  { id: 'save', title: 'Save Video', x: 1310, y: 520, w: 550, h: 362, in: [['audio', '#7FC8A9'], ['images', '#64B5F6'], ['model', '#B39DDB'], ['conditioning', '#F2994A']], save: true },
];
const BY22 = Object.fromEntries(NODES22.map((n, i) => [n.id, { n, i }]));
const H22 = n => n.h ?? 72 + n.rows.length * RH22;
// 执行顺序和开始时刻（相对 O1 + 0.25）；KSampler 跑得最久
// 第二十三轮（用户：Preview Image 的视频从最开始就在播，但 K 采样器还在渲染，改成潜空间应该合适点）：前面几个加载节点跑快一点（0.15 s 一个），
// KSampler 早点开始、跑 4 s；它采样的这 4 s 里 Preview Image 窗口放的是回放的"潜空间预览"（糊、带噪点和偏色，随步数越来越清楚），
// 采样完、VAE Decode 以后才是干净的成品（片子最后一帧）（第二十五轮并开关 out23）
const RUN23 = { audio: [0, 0.5], chara: [0.15, 0.5], clip: [0.3, 0.5], models: [0.45, 0.5], prompt: [0.6, 0.5], ref: [0.75, 0.45], ks: [0.9, 4.0], vae: [4.95, 0.2], preview: [5.1, 99], save: [5.25, 99] };
const RUN_ = () => RUN23;
const at22 = id => O1 + 0.25 + RUN_()[id][0];
const SAVE_END = () => O2 - 0.45; // Save Video 存完的时刻
const ghost22 = i => O1 + 0.05 * i;
const WIRES22 = [['audio', 'save', 0, [1285, 496]], ['chara', 'ks', 0], ['clip', 'prompt', 0], ['prompt', 'ks', 1], ['ks', 'vae', 0], ['vae', 'preview', 0], ['vae', 'save', 1], ['models', 'save', 2], ['ref', 'save', 3]];
const outPort22 = n => [n.x + n.w, n.y + (n.collapsed ? 17 : n.rows ? 23 : 62)]; // 加载器的输出在标题栏上（和第二十轮一样），其余按 ComfyUI 放在第一行插槽
const inPort22 = (n, k) => [n.x, n.collapsed ? n.y + 17 : n.y + 62 + k * 28];
const GROUPS22 = [{ x: 40, y: 66, w: 720, h: 940, title: '制作信息 · credits', col: '#3F789E' }, { x: 780, y: 66, w: 1090, h: 940, title: '采样 · 输出', col: '#9C4F96' }];
// Preview Image：片子前面内容的快速回放（core/memory.js）。避开 L29（V11 的帧要预先解码，见 memory.js）
const PV0 = () => at22('ks') + 0.1, PV1 = () => at22('ks') + RUN23.ks[1], PV_FPS = 30, PV_A = 0.7;
const PV_B_ = () => 169.2; // 第二十三轮：回放停在 L32 结尾白闪之前一点，成品不发白
function previewTime22(t) {
  const N = Math.floor((PV1() - PV0()) * PV_FPS), k = clamp(Math.floor((t - PV0()) * PV_FPS), 0, N);
  let ft = Math.round((PV_A + ((PV_B_() - PV_A) * k) / N) * 10) / 10;
  if (ft > 156.2 && ft < 159.6) ft = 159.7;
  return { k, N, ft };
}
const mmss = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${(s % 60).toFixed(1).padStart(4, '0')}`;
// 修改意见按节点里的宽度折行（只算一次）
let WRAP22 = null;
function wrap22(ctx, w) {
  if (WRAP22) return WRAP22;
  const out = [];
  D.creditsPrompt.forEach((ln, li) => {
    const head = ln.startsWith('# ');
    ctx.font = head ? fonts(15, 'SCB', 'J') : fonts(15, 'SC', 'J');
    let cur = '', first = true;
    for (const ch of [...(head ? ln.slice(2) : ln)]) {
      if (ctx.measureText(cur + ch).width > w && cur && !'，。、；：！？）」』”…,.;:!?)'.includes(ch)) { out.push({ s: cur, head, no: first ? li + 1 : null }); cur = ''; first = false; } // 标点不放行首
      cur += ch;
    }
    out.push({ s: cur, head, no: first ? li + 1 : null });
  });
  return (WRAP22 = out);
}
function widget22(ctx, x, y, w, k, v, { arrows = true, hi = false } = {}) {
  ctx.fillStyle = hi ? '#EAF0FF' : '#F6F2EC'; rrect(ctx, x, y - 14, w, 28, 14); ctx.fill();
  ctx.font = fonts(14, 'SC'); ctx.fillStyle = '#8A8478'; ctx.fillText(k, x + (arrows ? 28 : 14), y);
  ctx.font = fonts(15, 'SCB', 'J'); ctx.fillStyle = '#2A2A33'; ctx.textAlign = 'right'; ctx.fillText(v, x + w - (arrows ? 28 : 14), y); ctx.textAlign = 'left';
  if (arrows) { ctx.fillStyle = '#B3ACA0'; for (const [sx, d] of [[x + 12, -1], [x + w - 12, 1]]) { ctx.beginPath(); ctx.moveTo(sx + 4 * d, y); ctx.lineTo(sx - 3 * d, y - 5); ctx.lineTo(sx - 3 * d, y + 5); ctx.closePath(); ctx.fill(); } }
}
function node22(ctx, S, n, i) {
  const t = S.t, [r0, dur] = RUN_()[n.id], a = t - at22(n.id), h = H22(n), ga = smooth(clamp((t - ghost22(i)) / 0.3));
  if (ga <= 0) return;
  const act = a >= 0, done = act && a >= dur, run = act && !done, s = act ? 1 + 0.035 * Math.sin(Math.PI * clamp(a / 0.28)) : lerp(0.96, 1, ga);
  // 第二十六轮（用户：2:50 Preview Image 上那层让画面发暗的蓝紫色块还在，要去掉）：真正发暗的是这里——还没轮到执行的节点整个按 62% 不透明画，
  // Preview Image 在 KSampler 采样时就已经在放潜空间预览了，预览图（底下垫着深蓝 #1D2541）跟着变成一块发灰发紫的色块。
  // 改成：预览开始放的那一刻，这个节点用 0.15 s 亮到完全不透明（它已经在工作了）。rev out26
  const live26 = n.preview && rev('out26') >= 26 ? smooth(clamp((t - PV0()) / 0.15)) : 0;
  ctx.save(); ctx.globalAlpha = act ? 1 : lerp(0.62 * ga, 1, live26);
  ctx.translate(n.x + n.w / 2, n.y + h / 2); ctx.scale(s, s); ctx.translate(-n.x - n.w / 2, -n.y - h / 2);
  const R = n.collapsed ? h / 2 : 14;
  ctx.fillStyle = 'rgba(80,60,40,0.10)'; rrect(ctx, n.x + 6, n.y + 8, n.w, h, R); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.96)'; rrect(ctx, n.x, n.y, n.w, h, R); ctx.fill();
  ctx.lineWidth = run ? 4 : 2; ctx.strokeStyle = run ? GREEN20 : 'rgba(150,140,130,0.6)'; ctx.stroke();
  ctx.textBaseline = 'middle';
  if (n.collapsed) { // 折叠的节点：一颗胶囊
    ctx.fillStyle = '#8A8478'; ctx.beginPath(); ctx.arc(n.x + 20, n.y + h / 2, 5, 0, Math.PI * 2); ctx.fill();
    ctx.font = fonts(18, 'SCB'); ctx.fillStyle = '#2A2A33'; ctx.fillText(n.title, n.x + 34, n.y + h / 2 + 1);
  } else {
    ctx.save(); rrect(ctx, n.x, n.y, n.w, h, 14); ctx.clip(); ctx.fillStyle = '#F3EEE7'; ctx.fillRect(n.x, n.y, n.w, 44);
    if (run && n.ks) { ctx.fillStyle = GREEN20; ctx.fillRect(n.x, n.y, n.w * clamp(a / dur), 4); } // 执行中：顶边进度
    ctx.restore();
    ctx.font = fonts(21, 'SCB'); ctx.fillStyle = '#2A2A33'; ctx.fillText(n.title, n.x + 20, n.y + 23);
    ctx.font = fonts(14, 'SC'); ctx.fillStyle = '#8A8478'; ctx.textAlign = 'right'; ctx.fillText(`#${17 + i}`, n.x + n.w - 16, n.y + 23);
    if (done && dur < 50) { ctx.fillStyle = '#1FA86A'; ctx.fillText(`✓ ${(dur * 0.83 + rnd(i, 22) * 0.2).toFixed(2)}s`, n.x + n.w - 56, n.y + 23); }
    ctx.textAlign = 'left';
  }
  (n.out || []).forEach(([nm, col]) => { const [x, y] = outPort22(n); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill(); });
  (n.in || []).forEach(([nm, col], k) => {
    const [x, y] = inPort22(n, k); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill();
    if (!n.collapsed) { ctx.font = fonts(15, 'SC'); ctx.fillStyle = '#55524C'; ctx.fillText(nm, x + 16, y); }
  });
  if (!n.rows && !n.collapsed) (n.out || []).forEach(([nm]) => { const [x, y] = outPort22(n); ctx.font = fonts(15, 'SC'); ctx.fillStyle = '#55524C'; ctx.textAlign = 'right'; ctx.fillText(nm, x - 16, y); ctx.textAlign = 'left'; });
  if (n.rows) n.rows.forEach(([k, v], r) => {
    const ra = a - 0.15 - r * 0.12, y = n.y + 70 + r * RH22;
    ctx.fillStyle = n.author && ra >= 0 ? '#EAF0FF' : '#F6F2EC'; rrect(ctx, n.x + 16, y - 18, n.w - 32, 36, 18); ctx.fill();
    if (ra < 0) return;
    if (k) { ctx.font = fonts(15, 'SC'); ctx.fillStyle = '#8A8478'; ctx.fillText(k, n.x + 32, y); }
    ctx.font = n.author ? fonts(22, 'SCB') : fonts(17, k ? 'SC' : 'SCB', 'J'); ctx.fillStyle = n.author ? BRAND : '#2A2A33';
    ctx.fillText(decode(v, ra, { seed: i * 9 + r, step: 0.022, settle: 0.1 }), n.x + (k ? 140 : 32), y);
  });
  if (n.prompt) { // 修改意见：一直往上滚，暂停时每一帧都是清楚的字
    const bx = n.x + 16, by = n.y + 86, bw = n.w - 32, bh = h - 100, L = wrap22(ctx, bw - 58), LH = 21;
    ctx.fillStyle = '#F6F2EC'; rrect(ctx, bx, by, bw, bh, 10); ctx.fill();
    const total = L.length * LH, off = clamp((t - O1 - 0.3) / (O2 - O1 - 0.3)) * Math.max(0, total - bh + 16);
    ctx.save(); rrect(ctx, bx, by, bw, bh, 10); ctx.clip();
    const i0 = Math.max(0, Math.floor((off - 8) / LH));
    for (let j = i0; j < L.length; j++) {
      const y = by + 8 + j * LH - off + LH / 2; if (y > by + bh + LH) break;
      const ln = L[j];
      if (ln.no != null) { ctx.font = fonts(11, 'JB'); ctx.fillStyle = '#B3ACA0'; ctx.textAlign = 'right'; ctx.fillText(String(ln.no), bx + 36, y); ctx.textAlign = 'left'; }
      ctx.font = ln.head ? fonts(15, 'SCB', 'J') : fonts(15, 'SC', 'J'); ctx.fillStyle = ln.head ? BRAND : '#3A3A44';
      ctx.fillText(ln.s, bx + 46, y);
    }
    ctx.restore();
    const th = Math.max(24, (bh * bh) / total); ctx.fillStyle = 'rgba(120,110,100,0.35)'; rrect(ctx, bx + bw - 7, by + 4 + (bh - 8 - th) * (off / Math.max(1, total - bh + 16)), 4, th, 2); ctx.fill();
  }
  if (n.ks) { // 采样器的参数 + 步数
    const W2 = n.w - 32, x = n.x + 16, ys = n.y + 130;
    [['seed', '114514'], ['steps', '30'], ['cfg', '5.5'], ['sampler_name', 'euler_ancestral'], ['scheduler', 'karras'], ['denoise', '1.00']].forEach(([k, v], r) => widget22(ctx, x, ys + r * 32, W2, k, v, { hi: run && r === 1 }));
    const st = act ? Math.min(30, Math.floor(clamp(a / dur) * 30)) : 0, yb = n.y + h - 18;
    ctx.fillStyle = '#E4E1EA'; rrect(ctx, x, yb - 4, W2 - 120, 8, 4); ctx.fill();
    ctx.fillStyle = done ? GREEN20 : BRAND; rrect(ctx, x, yb - 4, (W2 - 120) * (st / 30), 8, 4); ctx.fill();
    ctx.font = fonts(14, 'JB'); ctx.fillStyle = '#55524C'; ctx.textAlign = 'right'; ctx.fillText(`step ${st}/30`, x + W2, yb); ctx.textAlign = 'left';
  }
  if (n.preview) { // 第二十三轮：采样时是潜空间预览，Decode 以后是成品；计时和倍速缩小、变淡
    const x = n.x + 20, y = n.y + 86, w = n.w - 40, hh = Math.round((w * 9) / 16), ksA = t - at22('ks'), ksD = RUN23.ks[1];
    if (t < PV0()) { ctx.fillStyle = '#F6F2EC'; ctx.fillRect(x, y, w, hh); }
    else {
      const decoded = act, { k, N, ft } = previewTime22(decoded ? PV1() + 1 : t), img = memoryFrame(ft, 480), q = decoded ? 1 : clamp(ksA / ksD), step = Math.min(30, Math.floor(q * 30));
      ctx.fillStyle = '#1D2541'; ctx.fillRect(x, y, w, hh);
      if (img) { ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, hh); ctx.clip(); if (decoded) ctx.drawImage(img, x, y, w, hh); else latent23(ctx, img, x, y, w, hh, q, k); ctx.restore(); }
      const pill = (px, txt, wd) => { ctx.fillStyle = 'rgba(255,255,255,0.55)'; rrect(ctx, px, y + 6, wd, 18, 9); ctx.fill(); ctx.font = fonts(11, 'JB'); ctx.fillStyle = 'rgba(40,40,52,0.7)'; ctx.fillText(txt, px + 7, y + 15.5); };
      ctx.fillStyle = decoded ? 'rgba(31,168,106,0.8)' : 'rgba(255,92,122,0.75)'; ctx.beginPath(); ctx.arc(x + 15, y + 15, 3, 0, Math.PI * 2); ctx.fill();
      pill(x + 22, mmss(Math.max(0, ft - 0.6)), 62);
      if (!decoded) pill(x + w - 46, `×${Math.round((PV_B_() - PV_A) / (PV1() - PV0()))}`, 40);
      ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(x, y + hh - 3, w, 3); ctx.fillStyle = css(BRAND, 0.8); ctx.fillRect(x, y + hh - 3, (w * k) / N, 3);
      ctx.font = fonts(14, 'SC'); ctx.fillStyle = '#8A8478';
      ctx.fillText(decoded ? `VAE Decode · ComfyUI_temp_00017_.png · ${mmss(PV_B_() - 0.6)}` : `latent preview · step ${step}/30 · 回放 ${String(k + 1).padStart(3, '0')}/${N + 1}`, x, y + hh + 16);
    }
    ctx.strokeStyle = 'rgba(150,140,130,0.5)'; ctx.lineWidth = 1; ctx.strokeRect(x, y, w, hh);
  }
  if (n.save) { // 这支片子
    const y0 = n.y + 62 + 4 * 28 + 4, x0 = n.x + 20, w0 = n.w - 40, s0 = 0.05, prog = clamp((t - at22('save') - s0) / (SAVE_END() - at22('save') - s0)), fin = act && prog >= 1;
    if (!act) { ctx.fillStyle = '#E4E1EA'; rrect(ctx, x0, y0, w0, 140, 10); ctx.fill(); }
    else {
      ctx.fillStyle = '#1D2541'; rrect(ctx, x0, y0, w0, 140, 10); ctx.fill();
      ctx.font = fonts(30, 'SCB', 'J'); ctx.fillStyle = '#FFFFFF'; ctx.fillText(TITLE, x0 + 22, y0 + 40);
      ctx.font = fonts(16, 'SC'); ctx.fillStyle = '#AEB6D8'; ctx.fillText(`${(DURATION - 0.6).toFixed(2)} s · 1920×1080 · 60 fps · ♥ 150 BPM`, x0 + 22, y0 + 82);
      ctx.fillStyle = 'rgba(255,255,255,0.15)'; rrect(ctx, x0 + 22, y0 + 108, w0 - 44, 10, 5); ctx.fill();
      ctx.fillStyle = fin ? GREEN20 : BRAND; rrect(ctx, x0 + 22, y0 + 108, (w0 - 44) * prog, 10, 5); ctx.fill();
      ctx.font = fonts(17, 'SCB'); ctx.fillStyle = fin ? '#1FA86A' : '#55524C';
      ctx.fillText(fin ? '✓ 已保存 · output/如果代码能长出海.mp4' : `rendering… ${Math.round(prog * 100)}%`, x0, y0 + 170);
    }
  }
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}
// 潜空间预览的样子：缩到很小再放大（糊，像 TAESD 的预览）；q = 采样进度 0..1，越往后越清楚。k = 回放第几帧
// 第二十四轮去掉了噪点层（第二十六轮并开关 out24）
function latent23(ctx, img, x, y, w, h, q, k) {
  const r = lerp(1 / 22, 1, q ** 1.6), sw = Math.max(4, Math.round(img.width * r)), sh = Math.max(3, Math.round(img.height * r));
  const sm = pooled('lat23', sw, sh), c = sm.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.imageSmoothingEnabled = true; c.clearRect(0, 0, sw, sh); c.drawImage(img, 0, 0, sw, sh);
  ctx.imageSmoothingEnabled = true; ctx.drawImage(sm, x, y, w, h);
  // 第二十五轮（用户：Preview Image 中视频不做压暗处理）：不往图上盖色，只有缩小再放大的糊，照样随步数变清楚（第二十七轮并开关 out25）
  ctx.globalAlpha = 1;
}
function wirePath22(A, B, k, via) {
  // 往回连的线（终点在起点左边）弯得小一点，不绕到画面外（大半藏在节点后面）
  const seg = (x0, y0, x1, y1) => { const dx = x1 < x0 ? 60 : Math.max(80, Math.abs(x1 - x0) * 0.5), pts = []; for (let j = 0; j <= 40; j++) { const s = j / 40, v = 1 - s; pts.push([v * v * v * x0 + 3 * v * v * s * (x0 + dx) + 3 * v * s * s * (x1 - dx) + s * s * s * x1, v * v * v * y0 + 3 * v * v * s * y0 + 3 * v * s * s * y1 + s * s * s * y1]); } return pts; };
  const [x0, y0] = outPort22(A), [x1, y1] = inPort22(B, k);
  return via ? [...seg(x0, y0, via[0], via[1]), ...seg(via[0], via[1], x1, y1).slice(1)] : seg(x0, y0, x1, y1);
}
function wires22(ctx, S) {
  const t = S.t;
  for (const [a, b, k, via] of WIRES22) {
    const A = BY22[a], B = BY22[b], t0 = Math.max(at22(a), at22(b)) + 0.15, u = easeOut(clamp((t - t0) / 0.35)), pts = wirePath22(A.n, B.n, k, via), col = A.n.out[0][1];
    const ga = smooth(clamp((t - Math.max(ghost22(A.i), ghost22(B.i)) - 0.15) / 0.3)), n = pts.length - 1;
    const line = (m, style, lw, alpha) => { ctx.save(); ctx.globalAlpha = alpha; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.strokeStyle = style; ctx.beginPath(); for (let j = 0; j <= m; j++) j ? ctx.lineTo(...pts[j]) : ctx.moveTo(...pts[j]); ctx.stroke(); ctx.restore(); };
    if (ga > 0 && u < 1) line(n, 'rgba(150,140,130,0.8)', 3, 0.45 * ga);
    if (via && ga > 0) { ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(via[0], via[1], 8, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = u > 0.5 ? col : 'rgba(150,140,130,0.8)'; ctx.stroke(); } // 转接点
    if (u <= 0) continue;
    line(Math.round(n * u), col, 4, 1);
    if (u >= 1) for (let d = 0; d < 2; d++) { const q = pts[Math.floor((((t - t0) * 0.7 + d * 0.5 + hash(A.i, B.i, 4) / 4294967296) % 1) * n)]; ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(q[0], q[1], 5, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke(); }
  }
}
function groups22(ctx, S) {
  const ga = smooth(clamp((S.t - O1) / 0.4));
  for (const g of GROUPS22) {
    ctx.save(); ctx.globalAlpha = ga;
    ctx.fillStyle = css(g.col, 0.07); rrect(ctx, g.x, g.y, g.w, g.h, 10); ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = css(g.col, 0.35); ctx.stroke();
    ctx.save(); rrect(ctx, g.x, g.y, g.w, g.h, 10); ctx.clip(); ctx.fillStyle = css(g.col, 0.2); ctx.fillRect(g.x, g.y, g.w, 34); ctx.restore();
    ctx.font = fonts(18, 'SCB'); ctx.fillStyle = mix(g.col, '#1D2541', 0.4); ctx.textBaseline = 'middle'; ctx.fillText(g.title, g.x + 14, g.y + 18); ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }
}
function menu22(ctx, S) { // 顶上的工作流菜单栏：标签页、运行按钮、队列、总进度
  const t = S.t, ga = smooth(clamp((t - O1) / 0.4)), x = 600, y = 14, w = 720, h = 44;
  const doneN = NODES22.filter(n => t >= at22(n.id) + Math.min(RUN_()[n.id][1], 1)).length + (t >= SAVE_END() ? 1 : 0), prog = Math.min(1, doneN / NODES22.length);
  ctx.save(); ctx.globalAlpha = ga; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,0.92)'; rrect(ctx, x, y, w, h, 12); ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(150,140,130,0.5)'; ctx.stroke();
  ctx.font = fonts(16, 'SCB'); ctx.fillStyle = '#55524C'; ctx.fillText('≡  Workflow', x + 16, y + h / 2);
  ctx.fillStyle = '#F3EEE7'; rrect(ctx, x + 140, y + 7, 300, h - 14, 8); ctx.fill();
  ctx.font = fonts(15, 'SC', 'J'); ctx.fillStyle = '#2A2A33'; ctx.fillText('如果代码能长出海.json', x + 156, y + h / 2);
  ctx.fillStyle = prog < 1 ? BRAND : '#1FA86A'; ctx.beginPath(); ctx.arc(x + 420, y + h / 2, 4, 0, Math.PI * 2); ctx.fill();
  const running = t >= O1 + 0.25 && prog < 1;
  ctx.fillStyle = running ? '#8FA2F7' : BRAND; rrect(ctx, x + 470, y + 7, 130, h - 14, 15); ctx.fill();
  ctx.font = fonts(15, 'SCB'); ctx.fillStyle = '#FFFFFF'; ctx.fillText(running ? '■  执行中' : '▶  Run', x + 492, y + h / 2);
  ctx.font = fonts(14, 'SC'); ctx.fillStyle = '#55524C'; ctx.fillText(`队列 ${running ? 1 : 0}`, x + 620, y + h / 2);
  ctx.fillStyle = 'rgba(150,140,130,0.25)'; ctx.fillRect(x + 12, y + h - 3, w - 24, 2); ctx.fillStyle = GREEN20; ctx.fillRect(x + 12, y + h - 3, (w - 24) * prog, 2);
  ctx.restore();
}
function minimap22(ctx, S, cam) { // 右下角小地图（第二十三轮往下挪 34 px）
  const ga = smooth(clamp((S.t - O1 - 0.3) / 0.4)), x = 1660, y = 934, w = 200, k = w / W, h = H * k;
  ctx.save(); ctx.globalAlpha = ga;
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; rrect(ctx, x, y, w, h, 8); ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(150,140,130,0.5)'; ctx.stroke();
  for (const g of GROUPS22) { ctx.fillStyle = css(g.col, 0.15); ctx.fillRect(x + g.x * k, y + g.y * k, g.w * k, g.h * k); }
  NODES22.forEach((n, i) => { const a = S.t - at22(n.id); ctx.fillStyle = a >= 0 ? (a < RUN_()[n.id][1] ? GREEN20 : '#B9B2A8') : '#DDD7CE'; ctx.fillRect(x + n.x * k, y + n.y * k, n.w * k, H22(n) * k); });
  const vz = 1 / cam.zoom; ctx.strokeStyle = BRAND; ctx.lineWidth = 2; ctx.strokeRect(x + (W / 2 - (W / 2 + cam.x) * vz) * k, y + (H / 2 - (H / 2) * vz) * k, W * vz * k, H * vz * k);
  ctx.restore();
}
function outro1v22(ctx, S) {
  // 第二十三轮（用户：入场时的整体镜头再往后推一点，让制作信息和采样 · 输出两个分组都进入画面，两个分组和鸟瞰图再往下移一点；
  // 「非商业二次创作 · 用爱发电 · 谢谢你听到最后」放到页面左下角，和右边的小数字对齐）（第二十五轮并开关 out23）
  const p = S.pal, t = S.t, u = (t - O1) / (O2 - O1);
  const cam = { x: lerp(-12, 12, smooth(u)), y: 0, zoom: lerp(0.955, 0.97, smooth(u)), rot: 0 };
  if (t >= PV0()) memoryFrame(previewTime22(t >= at22('preview') ? PV1() + 1 : t).ft, 480); // 先把这一帧要回放的画面画好（见 core/memory.js）
  paper(ctx, S, cam);
  ctx.save(); ctx.translate(W / 2 + cam.x, H / 2); ctx.scale(cam.zoom, cam.zoom); ctx.translate(-W / 2, -H / 2);
  ctx.fillStyle = 'rgba(150,135,115,0.22)'; for (let y = 20; y < H; y += 32) for (let x = 20; x < W; x += 32) ctx.fillRect(x, y, 2, 2); // ComfyUI 画布的点阵
  ctx.translate(0, 26);
  groups22(ctx, S);
  wires22(ctx, S);
  NODES22.forEach((n, i) => node22(ctx, S, n, i));
  const fa = clamp((t - at22('save') - 0.1) / 0.5);
  ctx.restore();
  { // 左下角，和右下角的时间码同一行、同一种字（hud.js：SC 16、灰、基线 H − CH / 2）
    ctx.save(); ctx.globalAlpha = Math.max(fa, smooth(clamp((t - O1 - 0.6) / 0.4))); ctx.font = fonts(16, 'SC'); ctx.fillStyle = p.gray; ctx.textBaseline = 'alphabetic';
    ctx.fillText('非商业二次创作 · 用爱发电 · 谢谢你听到最后', 2 * CW, H - CH / 2); ctx.restore();
  }
  menu22(ctx, S);
  minimap22(ctx, S, cam);
  hud(ctx, S, { lyric: false, beats: false, spectrum: false });
}

export const outro1 = outro1v22; // 第二十四轮并开关 out22

// ================================================================ 尾奏 2：用量面板 + 「嘿嘿」
export function outro2(ctx, S) {
  const p = S.pal, t = S.t, a = t - O2, cam = { x: 0, y: 0, zoom: 1.02 * punch(S, 0.02), rot: 0 };
  paper(ctx, S, cam);
  backDeco(ctx, S, cam, 410, { alpha: 0.35 });
  card(ctx, S, 220, 120, 1000, 840, { title: 'usage · 本次对话', age: a }, cc => {
    const rowsData = [
      ['prompt', '"唱首歌吧"', '4 tokens（演出值）'], ['生成', `${D.lyrics.lines.length} 句`, '全部唱完'], ['思考用时', '14 秒', '才不紧张'],
      ['时长', `${DURATION.toFixed(2)} 秒`, '150 BPM'], ['缓存命中', '100%', '记得你'], ['白米饭', '∞ 碗', '正在去吃的路上'],
    ];
    rowsData.forEach(([k, v, note], i) => {
      const ra = a - 0.3 - i * 0.35; if (ra < 0) return;
      const yy = cc.y + 40 + i * 120;
      ctx.font = fonts(28, 'SC'); ctx.fillStyle = p.gray; ctx.fillText(k, cc.x + 10, yy + 20);
      ctx.font = fonts(52, 'ZENB', 'SCB'); ctx.fillStyle = i === 5 ? p.acc[0] : BRAND; ctx.fillText(decode(v, ra, { seed: i + 30, step: 0.04 }), cc.x + 200, yy + 30);
      ctx.font = fonts(22, 'SC'); ctx.fillStyle = p.gray; ctx.fillText(note, cc.x + 640, yy + 24);
      segBar(ctx, S, cc.x + 200, yy + 52, 420, 20, clamp(ra / 0.4), { h: 6 });
    });
  });
  ring(ctx, S, 1460, 360, 150, clamp(a / 1.5), { text: '100%', label: '缓存命中', fs: 56, color: BRAND });
  // 头像 + 「嘿嘿」
  const ha = t - beatTime(112, 1), r = 110, ax = 1460, ay = 760;
  ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(ax, ay, r + 10, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(ax, ay, r, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(photo('I03', [0.22, 0.08, 0.56, 0.42], r * 2, r * 2), ax - r, ay - r); ctx.restore();
  ctx.lineWidth = 4; ctx.strokeStyle = BRAND; ctx.beginPath(); ctx.arc(ax, ay, r + 10, 0, Math.PI * 2); ctx.stroke();
  if (ha >= 0) {
    // 第二十二轮（用户：「嘿嘿」的气泡矩形与三角形没有做布尔运算，矩形改成最大圆角，文字后面加个颜文字）。第二十四轮并开关
    // 气泡和尾巴一条路径（core/ui.js speechBubble）；颜文字晚半拍冒出来、轻轻晃
    const s = popIn(S, ha, 0.2), bx = 1572, by = 548, bw = 294, bh = 90; // 在「缓存命中」字的右边，尾巴指着头像右上
    ctx.save(); ctx.translate(1580, 670); ctx.scale(s, s); ctx.translate(-1580, -670);
    speechBubble(ctx, bx, by, bw, bh, null, 1580, 670, 14); ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = BRAND; ctx.stroke();
    ctx.textBaseline = 'middle'; ctx.font = fonts(52, 'SMILEY', 'SCB'); ctx.fillStyle = BRAND; ctx.fillText('嘿嘿', bx + 32, by + bh / 2 + 2);
    const ka = popIn(S, ha - BEAT / 2, 0.16), wob = 0.06 * Math.sin((t - beatTime(112, 1)) * 7) * decay(Math.max(0, ha - BEAT / 2), 1.2);
    if (ka > 0) { ctx.save(); ctx.translate(bx + 212, by + bh / 2 + 2); ctx.rotate(wob); ctx.scale(ka, ka); ctx.font = fonts(34, 'SCB'); ctx.fillStyle = p.acc[0]; ctx.textAlign = 'center'; ctx.fillText('(≧▽≦)', 0, 0); ctx.restore(); }
    ctx.textBaseline = 'alphabetic'; ctx.restore();
    // 第二十三轮（用户：看看有什么地方能把表情包用上）：「嘿嘿」之后半小节，她再甩一张表情包过来（比心），像聊天里接着发的一条（第二十五轮并开关 stk23）
    const sa = t - beatTime(112, 3);
    if (sa >= 0 && hasIllust('S08')) { const s = popIn(S, sa, 0.22), wob = 0.07 * Math.sin(sa * 5) * decay(sa, 1.5); ctx.save(); ctx.translate(1745, 805); ctx.rotate(-0.06 + wob); ctx.scale(s, s); ctx.fillStyle = 'rgba(80,60,40,0.10)'; ctx.beginPath(); ctx.ellipse(6, 104, 80, 14, 0, 0, Math.PI * 2); ctx.fill(); ctx.drawImage(photo('S08', null, 400, 400, { keyed: true }), -100, -100, 200, 200); ctx.restore(); }
  }
  hud(ctx, S, { lyric: false, beats: false });
}

// ================================================================ 尾奏 3：最后一条消息
const LAST_MSG = ['唱', '完', '啦', '！', '……', '我', '先', '去', '吃饭', '了', '，', '这', '首', '你', '再', '听', '一', '遍', '~'];
export function lastWindow(ctx, S, t, { alpha = 1 } = {}) {
  const p = S.pal, r = chatWin(ctx, S, 420, 150, 1080, 700, { alpha, placeholder: '给 DeepSeek 发送消息' });
  const [mx, my, mw] = r.msg;
  ctx.save(); ctx.globalAlpha *= alpha;
  ctx.fillStyle = BRAND; ctx.beginPath(); ctx.arc(mx + 24, my + 40, 22, 0, Math.PI * 2); ctx.fill(); drawSprite(ctx, 'whaleW', 1, p, mx + 24, my + 41, 1.6);
  ctx.font = fonts(20, 'SC'); ctx.fillStyle = p.gray; ctx.fillText('已深度思考（用时 14 秒）', mx + 62, my + 46);
  const n = Math.max(0, Math.floor((t - O3 - 0.2) / (STEP * 2)) + 1), shown = LAST_MSG.slice(0, Math.min(LAST_MSG.length, n)).join('');
  ctx.font = fonts(46, 'SC'); ctx.fillStyle = p.text;
  const line1 = shown.slice(0, 11), line2 = shown.slice(11);
  ctx.fillText(line1, mx + 62, my + 140); ctx.fillText(line2, mx + 62, my + 210);
  if (n <= LAST_MSG.length && Math.floor(t / 0.2) % 2 === 0) { const w = ctx.measureText(line2 || line1).width; ctx.fillStyle = BRAND; ctx.fillRect(mx + 62 + w + 6, my + (line2 ? 170 : 100), 6, 50); }
  // 第二十三轮：消息打完以后，右边接着发一张「吃白米饭」的表情包（「我先去吃饭了」）
  if (n > LAST_MSG.length && hasIllust('S01')) { const sa = t - (O3 + 0.2 + LAST_MSG.length * STEP * 2) - 0.25, s = popIn(S, sa, 0.22); if (s > 0) { ctx.save(); ctx.translate(mx + mw - 130, my + 150); ctx.rotate(0.05 + 0.06 * Math.sin(sa * 4) * decay(Math.max(0, sa), 1.5)); ctx.scale(s, s); ctx.drawImage(photo('S01', null, 400, 400, { keyed: true }), -105, -105, 210, 210); ctx.restore(); } }
  if (n > LAST_MSG.length) { drawSprite(ctx, 'rice', 6, p, mx + 62 + ctx.measureText(line2).width + 60, my + 192); ctx.font = fonts(20, 'SC'); ctx.fillStyle = p.gray; ctx.fillText('复制 · 重新生成', mx + 62, my + 270); drawSprite(ctx, 'thumb', 3, p, mx + 260, my + 263); }
  ctx.restore();
  return r;
}
export function outro3(ctx, S) {
  const p = S.pal, t = S.t, u = (t - O3) / (O4 - O3), cam = { x: 0, y: 0, zoom: lerp(1.08, 1.0, smooth(u)), rot: 0 };
  paper(ctx, S, cam);
  backDeco(ctx, S, cam, 415, { alpha: 0.3 * (1 - u), boxes: [[40, 60, 380, 300], [1500, 640, 380, 300]] });
  for (let i = 0; i < 12; i++) { // 慢慢飘上去的小星光（编制撤出后还剩一点点）
    const ph = ((t * 0.12 + rnd(i, 1)) % 1);
    drawSprite(ctx, i % 3 ? 'sparkle' : 'note', 3, p, 100 + rnd(i, 2) * 1720, 1080 - ph * 1180, 1, 0.6 * Math.sin(Math.PI * ph) * (1 - u * 0.5));
  }
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(cam.zoom, cam.zoom); ctx.translate(-W / 2, -H / 2);
  lastWindow(ctx, S, t);
  const fa = clamp((t - beatTime(117, 1)) / 0.8);
  ctx.font = fonts(22, 'SC'); ctx.fillStyle = css(p.gray, fa); ctx.textAlign = 'center';
  ctx.fillText('内容由 AI 生成，请仔细甄别', 960, 900); ctx.textAlign = 'left';
  ctx.restore();
  hud(ctx, S, { alpha: 1 - 0.6 * u, spectrum: false, lyric: false, beats: false });
}

// ================================================================ 尾奏 4：缩进显示器，鲸鱼翻肚皮，标题散成像素，白场
const CRT_C = [960, 440];
export function outro4(ctx, S) {
  const p = S.pal, t = S.t, a = t - O4, sh = easeOut(clamp(a / 0.6)), sw = lerp(W, 900, sh);
  paper(ctx, S, null);
  ringScanner(ctx, S, CRT_C[0], CRT_C[1], sw * 0.62, { alpha: 0.35 * sh, seed: 9 });
  const g = crtGeometry(CRT_C[0], CRT_C[1], sw), [x, y, w, h] = g.screen;
  // 屏幕里：最后的窗口 + 像素鲸鱼游过、翻肚皮躺下
  const buf = pooled('o4screen', W, H), b = buf.getContext('2d');
  b.setTransform(1, 0, 0, 1, 0, 0); b.fillStyle = p.bg; b.fillRect(0, 0, W, H);
  lastWindow(b, S, O4 - 0.01, { alpha: 1 - clamp((a - 0.6) / 0.4) });
  const swim = clamp((a - 0.7) / 1.0), wx = lerp(1700, 960, easeOut(swim)), flip = clamp((a - 1.7) / 0.3), wy = 560 + 20 * Math.sin(t * 3) * (1 - flip);
  if (a > 0.7) { b.save(); b.translate(wx, wy); b.scale(1, Math.cos(Math.PI * flip)); drawSprite(b, 'whale', 14, p, 0, 0); b.restore(); }
  if (flip >= 1) { b.font = fonts(36, 'SC'); b.fillStyle = p.gray; b.fillText('z z z', wx + 150, wy - 80 - 10 * Math.sin(t * 2)); }
  ctx.drawImage(buf, x, y, w, h);
  drawCRT(ctx, S, CRT_C[0], CRT_C[1], sw, { alpha: sh, label: 'DS-LINK · END' });
  // 标题：解码浮现 → 散成像素 → 白场
  // 第二十轮（字标，core/logo.js）：显示器一边缩、标题一边从下面一个字一个字打出来（比原来早 1.2 s、字也大），打完长出海，底下一条字符海接住，再进白场
  const T0 = O4 + 0.25;
  drawLogo(ctx, S, {
    cx: 960, base: 998, px: 104, edge: '#FFFFFF', strip: true, // 字顶在显示器底座光环下面
    charT: k => { const a0 = t - T0 - k * 0.07; return { type: clamp(a0 / 0.36), sea: smooth(clamp((a0 - 0.3) / 0.45)) }; },
  });
  flash(ctx, clamp((t - (DURATION - 0.9)) / 0.8));
}
