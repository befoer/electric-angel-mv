// 歌词装饰（视觉方案 §4.2，第六轮）：小字歌词 HUD + 动态排版。文字只来自歌词文件（lyric / lyricAt），代码里不写原文
import { BRAND, BEAT } from './const.js';
import { clamp, easeOut, easeOutBack, decay } from './time.js';
import { hash } from './rand.js';
import { fonts } from './glyphs.js';
import { lyric, lyricAt } from './data.js';
import { SCR_W } from './text.js';

// 唱到的字逐个出现（出现时先乱跳 0.08 s）；没在唱的时候显示上一句并淡出
function current(S) {
  const L = lyricAt(S.t);
  if (L) return { L, fade: 1 };
  return null;
}

// 小字歌词 HUD：(x, y) 起一行（vertical 时竖排）。o.size 字号 · o.color · o.label 显示句号标签 · o.fontKeys
export function lyricHud(ctx, S, x, y, { size = 22, color = null, vertical = false, label = true, alpha = 1, fontKeys = ['ZEN', 'J'], id = null } = {}) {
  const L = id ? lyric(id) : current(S)?.L;
  if (!L) return;
  const p = S.pal, c = color || p.text;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.font = fonts(size, ...fontKeys); ctx.textBaseline = 'middle';
  let cx = x, cy = y;
  if (label) {
    ctx.font = fonts(Math.round(size * 0.6), 'ZENB', 'SCB'); ctx.fillStyle = BRAND;
    ctx.fillText(`LYRIC · ${L.id}`, x, vertical ? y - size : y - size * 0.95);
    ctx.font = fonts(size, ...fontKeys);
  }
  L.chars.forEach((ch, i) => {
    const age = S.t - ch.t0;
    if (age < 0) return;
    const g = age < 0.08 ? SCR_W[hash(i, Math.floor(age * 50)) % SCR_W.length] : ch.c;
    const sc = easeOutBack(clamp(age / 0.1), 2);
    ctx.fillStyle = age < 0.12 ? BRAND : c;
    ctx.save(); ctx.translate(cx + size / 2, cy); ctx.scale(sc, sc); ctx.textAlign = 'center'; ctx.fillText(g, 0, 0); ctx.restore();
    if (vertical) cy += size * 1.12; else cx += ctx.measureText(ch.c).width + size * 0.08;
  });
  ctx.restore();
}

// 动态排版：一句歌词的每个字按 place(i, age, ch) → { x, y, s, r, a, color } 摆放（age = 唱到后的秒数，未唱到为负）
export function lyricKinetic(ctx, S, id, place, { size = 64, fontKeys = ['ZENB', 'J'], stroke = 10, color = null, strokeColor = '#FFFFFF' } = {}) {
  const L = lyric(id), p = S.pal;
  ctx.save();
  ctx.font = fonts(size, ...fontKeys); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  L.chars.forEach((ch, i) => {
    const age = S.t - ch.t0, q = place(i, age, ch);
    if (!q || (q.a ?? 1) <= 0) return;
    ctx.save();
    ctx.globalAlpha *= q.a ?? 1;
    ctx.translate(q.x, q.y); if (q.r) ctx.rotate(q.r); if (q.s !== undefined) ctx.scale(q.s, q.s);
    if (stroke) { ctx.lineWidth = stroke; ctx.strokeStyle = strokeColor; ctx.strokeText(ch.c, 0, 0); }
    ctx.fillStyle = q.color || color || BRAND; ctx.fillText(ch.c, 0, 0);
    ctx.restore();
  });
  ctx.restore();
}

// 常用的出现动画：唱到时从下方弹起（回弹），之后随拍轻跳
export const popUp = (age, S, { h = 40 } = {}) => {
  if (age < 0) return null;
  const e = easeOutBack(clamp(age / 0.14), 2.2);
  return { dy: (1 - e) * h - 6 * decay(S.sub * BEAT, 10), s: 0.4 + 0.6 * e, a: clamp(age / 0.05) };
};
