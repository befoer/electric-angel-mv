// 片子里前面某一刻的缩略图（第二十二轮）：2:47 背景里的窗口放前两分钟的随机画面、尾奏 Preview Image 节点里快速回放前面的内容（用户第二十二轮）。
// 第一次用到某个时刻时用引擎把那一帧完整画一遍、缩小、缓存，之后直接用——缩略图只由时刻决定，画面仍然是确定的。
// 画法由 main.js 注册（setMemoryRenderer），这里不直接 import main.js（避免循环引用）；
// 注册的函数会避开转场窗口（转场共用两块缓冲，外面这一帧可能正在用）。
// 会嵌套：尾奏回放到 L32 时，L32 自己又要前两分钟的缩略图——所以大画布按嵌套层数各用一块。
// 用的镜头要在画任何东西之前先调用（预热），不要画到一半再调用（池里的缓冲可能正被外面这一帧占着）。
// 时刻别落在 V11（L29）上：那段视频帧要 prepareFrame 预先解码，这里画不到
import { W, H } from './const.js';
import { newCanvas } from './env.js';

let RENDER = null, DEPTH = 0;
const CACHE = new Map(), BIG = [];
export const setMemoryRenderer = fn => { RENDER = fn; };
export function memoryFrame(t, w = 640) {
  const key = `${t}|${w}`;
  let cv = CACHE.get(key);
  if (cv) return cv;
  if (!RENDER || DEPTH > 2) return null;
  const big = BIG[DEPTH] ??= newCanvas(W, H), c = big.getContext('2d');
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  DEPTH++;
  try { RENDER(c, t); } finally { DEPTH--; }
  cv = newCanvas(w, Math.round((w * H) / W));
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(big, 0, 0, cv.width, cv.height);
  CACHE.set(key, cv);
  return cv;
}
