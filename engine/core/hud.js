// HUD：小节计数、♥ 150 BPM + 心电图、频谱条、时间码、小字歌词、刻度尺（视觉方案 §4.9，第六轮加心电图与歌词）
import { W, H, CW, CH, BRAND } from './const.js';
import { capsule, rrect } from './ui.js';
import { drawSprite, voiceAt, beatSprites, drawBeatSprites, offbeatFlashes } from './sprites.js';
import { feat } from './data.js';
import { font } from './glyphs.js';
import { css } from './color.js';
import { decay, fmtTime, pos, barStart } from './time.js';
import { vnoise } from './rand.js';
import { ecgStrip, ruler } from './hudkit.js';
import { lyricHud } from './lyric.js';

// o.spectrum 底部频谱 · o.ecg 心率旁的心电图 · o.lyric 左下小字歌词 · o.ruler 右侧刻度尺
// o.beats 节拍像素精灵（视觉方案 §4.6；第七轮起落点之后的镜头默认都有，放在画面四周、避开中间主体；安静或单色的段落关掉）
// 第十二轮（用户：底部的频谱在用不上、尤其压住内容的镜头里藏掉）：前两分钟 spectrum 默认关（'auto'），要留的镜头显式传 true（前奏开头、L19、L24）。rev spec
export function hud(ctx, S, { alpha = 1, spectrum = 'auto', ecg = true, lyric = true, ruler: rl = true, beats = S.t >= 14.4 && alpha >= 0.9 } = {}) {
  if (alpha <= 0) return;
  if (spectrum === 'auto') spectrum = !(S.t < barStart(74));
  const pal = S.pal;
  if (beats) {
    const avoid = [[28, 7, 132, 47]];
    drawBeatSprites(ctx, S, beatSprites(S, { mult: 0.28, avoid }));
    offbeatFlashes(ctx, S, { avoid });
  }
  ctx.save();
  ctx.globalAlpha = alpha;
  // 左上：小节计数，每拍像里程表一样滚一格；旁边一个随拍闪的 REC 点
  const x = 2 * CW, y = CH, h = 2 * CH;
  ctx.save();
  const wBox = capsule(ctx, x, y, h, '000 · 0', { fill: '#FFFFFF', stroke: pal.winEdge, color: 'rgba(0,0,0,0)', fontKey: 'SC', size: 20 });
  rrect(ctx, x, y, wBox, h, h / 2); ctx.clip();
  const roll = Math.min(1, S.sub / 0.12), cur = `${String(Math.max(0, S.bar)).padStart(3, '0')} · ${S.beat}`;
  const prev = pos(S.t - 0.4), prevS = `${String(Math.max(0, prev.bar)).padStart(3, '0')} · ${prev.beat}`;
  ctx.font = font('SC', 20); ctx.fillStyle = pal.text; ctx.textBaseline = 'middle';
  ctx.fillText(cur, x + 14, y + h / 2 + 1 + (1 - roll) * h);
  if (roll < 1) ctx.fillText(prevS, x + 14, y + h / 2 + 1 - roll * h);
  ctx.restore();
  ctx.fillStyle = S.sub < 0.5 ? pal.acc[0] : css(pal.acc[0], 0.25);
  ctx.beginPath(); ctx.arc(x + wBox + 18, y + h / 2, 6, 0, Math.PI * 2); ctx.fill();
  ctx.font = font('ZENB', 15); ctx.fillStyle = pal.gray; ctx.textBaseline = 'middle';
  ctx.fillText('REC', x + wBox + 30, y + h / 2 + 1); ctx.textBaseline = 'alphabetic';
  // 右上：♥ 150 BPM，心每拍跳一下；左边一条心电图胶囊
  const bx = W - 22 * CW;
  capsule(ctx, bx, y, h, '     150 BPM', { fill: '#FFFFFF', stroke: pal.winEdge, color: pal.text, size: 20 });
  drawSprite(ctx, 'heart', 3, pal, bx + 24, y + h / 2, 1 + 0.25 * decay(S.sub * 0.4, 12));
  if (ecg) {
    const ew = 230, ex = bx - ew - 12;
    ctx.fillStyle = '#FFFFFF'; rrect(ctx, ex, y, ew, h, h / 2); ctx.fill();
    ctx.strokeStyle = pal.winEdge; ctx.lineWidth = 2; ctx.stroke();
    ecgStrip(ctx, S, ex + 16, y + 4, ew - 32, h - 8, { grid: false, lw: 2, sweep: true, span: 2.4 });
  }
  // 右侧：竖刻度尺
  if (rl) ruler(ctx, S, W - 3 * CW, 6 * CH, 40 * CH, { vertical: true, alpha: 0.55, label: false });
  // 底部：频谱条
  const f = feat(S.t), n = 48, bw = 14, gap = 6, total = n * (bw + gap) - gap, x0 = (W - total) / 2, base = H - 2 * CH;
  ctx.fillStyle = css(BRAND, 0.85);
  for (let i = 0; spectrum && i < n; i++) {
    const u = i / (n - 1), band = u < 0.33 ? f.low : u < 0.66 ? f.mid : f.high;
    const v = Math.min(1, band * (0.55 + 0.9 * vnoise(i * 0.7, S.t * 6, 0, 3)) + f.onset * 0.25);
    const bh = 4 + v * 46;
    rrect(ctx, x0 + i * (bw + gap), base - bh, bw, bh, 4); ctx.fill();
  }
  // 左下：小字歌词
  if (lyric) lyricHud(ctx, S, 2 * CW, H - 3 * CH, { size: 22, alpha: 0.9, fontKeys: voiceAt(S.bar) === 'onee' ? ['MIN', 'J'] : ['ZEN', 'J'] });
  // 右下：时间码
  ctx.font = font('SC', 16); ctx.fillStyle = pal.gray; ctx.textBaseline = 'alphabetic';
  ctx.fillText(fmtTime(S.t), W - 12 * CW, H - CH / 2);
  ctx.restore();
}
