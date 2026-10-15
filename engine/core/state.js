// 每帧的状态：只由时刻 t 决定
import { FPS } from './const.js';
import { pos } from './time.js';
import { paletteAt } from './color.js';
import { feat } from './data.js';

// 返回 { t, frame, n, ni, bar, beat, sub, pal, f }；镜头函数另外得到 shot / lt（镜头内时间）/ u（镜头进度 0..1）
export function makeState(t) {
  return { t, frame: Math.round(t * FPS), ...pos(t), pal: paletteAt(t), f: feat(t) };
}
