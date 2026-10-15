// 引擎入口：浏览器预览与 Node 出片共用（项目方案 §3.2）
import { ENV, newCanvas } from './core/env.js';
import { W, H, FPS } from './core/const.js';
import { registerFonts } from './core/glyphs.js';
import { loadData } from './core/data.js';
import { loadIllust } from './core/portrait.js';
import { loadFormulas } from './core/math.js';
import { loadMasks } from './core/masks.js';
import { loadSegs } from './core/segmaps.js';
import { loadFrames, prefetchFrames } from './core/frames.js';
import { makeState } from './core/state.js';
import { TRANS } from './core/trans.js';
import { shotAt, overlays, transitionAt } from './timeline.js';
import { setMemoryRenderer } from './core/memory.js';

export { W, H, FPS, DURATION, NFRAMES } from './core/const.js';
export { SHOTS, shotAt } from './timeline.js';

export async function initEngine(platform) {
  ENV.P = platform;
  await registerFonts();
  await loadData();
  await loadFormulas();
  await loadIllust();
  await loadMasks();
  await loadSegs();
  await loadFrames();
}

function drawShot(ctx, shot, t) {
  const S = makeState(t);
  S.shot = shot;
  S.lt = t - shot.t0;
  S.u = S.lt / (shot.t1 - shot.t0);
  ctx.save();
  shot.fn(ctx, S);
  ctx.restore();
  return S;
}

// 转场用的两块缓冲（只建一次）
let BUF = null;
const bufs = () => BUF || (BUF = [newCanvas(W, H), newCanvas(W, H)]);

// 第二十轮：画时刻 t 之前先调用（await），把这一刻要用的视频帧解码好（core/frames.js）。出片 / 总览图每帧都要先调它
export const prepareFrame = t => prefetchFrames(t);

// 第二十二轮：片子里前面时刻的缩略图（core/memory.js）——避开转场窗口（转场共用 BUF，外面这一帧可能正在用），往后挪到不在转场里的时刻
setMemoryRenderer((ctx, t) => { let tt = t; for (let i = 0; i < 12 && transitionAt(tt); i++) tt += 0.15; renderFrame(ctx, tt); });

// 画出时刻 t 的一帧。只依赖 t
export function renderFrame(ctx, t) {
  const tr = transitionAt(t);
  let S;
  if (!tr) S = drawShot(ctx, shotAt(t), t);
  else {
    // 转场窗口：前一个镜头停在它的最后一帧（liveA 时继续走），后一个镜头停在它的第一帧（liveB 时继续走）
    // 第十二轮（用户：转场时前一个镜头的动画不要在最后几帧突然全停）：前一个镜头默认一直走到转场结束（登记 liveA: false 的才停）。rev liveA
    const [A, B] = bufs(), liveA = tr.liveA !== false;
    drawShot(A.getContext('2d'), tr.from, liveA ? t : Math.min(t, tr.from.t1 - 1 / FPS));
    drawShot(B.getContext('2d'), tr.to, tr.bAt ?? (tr.liveB ? t : Math.max(t, tr.to.t0)));
    S = makeState(t);
    S.shot = shotAt(t);
    S.lt = t - S.shot.t0;
    ctx.save();
    TRANS[tr.type](ctx, A, B, tr.u, S, tr.p);
    ctx.restore();
  }
  ctx.save();
  overlays(ctx, S);
  ctx.restore();
  return S;
}
