// 占位镜头：未实现的镜头先显示镜头号、布局、设计说明，保证全片能从头跑到尾（项目方案 P5 粗剪）
import { COLS } from '../core/const.js';
import { glyphs } from '../core/glyphs.js';
import { Occ, putText, background, charField, bgDensity } from '../core/grid.js';
import { panel } from '../core/ui.js';
import { beatSprites, drawBeatSprites, offbeatFlashes } from '../core/sprites.js';
import { hud } from '../core/hud.js';
import { lyricAt } from '../core/data.js';

// 按格数折行
export function wrapCells(gs, str, max) {
  const out = [];
  let line = '', n = 0;
  for (const ch of str) {
    const w = gs.cells(ch);
    if (n + w > max) { out.push(line); line = ''; n = 0; }
    line += ch; n += w;
  }
  if (line) out.push(line);
  return out;
}

export function placeholder(spec) {
  return (ctx, S) => {
    const pal = S.pal, c0 = 36, r0 = 15, c1 = 124, r1 = 39;
    background(ctx, pal);
    const occ = new Occ().rect(c0, r0, c1, r1);
    const sp = beatSprites(S, { mult: 0.6, avoid: [[c0, r0, c1, r1]] });
    charField(ctx, S, { occ, density: bgDensity(1.3) });
    panel(ctx, S, c0, r0, c1, r1, { title: `占位 · ${spec.id} · ${spec.layout} · 小节 ${spec.bars[0]}–${spec.bars[1] - 1}`, spinner: true });
    const gs = glyphs('SC', pal.text), gray = glyphs('SC', pal.gray);
    let row = r0 + 2;
    for (const ln of wrapCells(gs, spec.desc, c1 - c0 - 6)) putText(ctx, gs, c0 + 3, row++, ln);
    if (spec.lyric) { row++; putText(ctx, gray, c0 + 3, row++, `歌词：${spec.lyric}`); }
    const L = lyricAt(S.t);
    if (L) {
      const n = L.chars.filter(c => c.t0 <= S.t).length;
      putText(ctx, gray, c0 + 3, r1 - 3, `${L.id}  ${'■'.repeat(n)}${'□'.repeat(L.chars.length - n)}`, { maxCol: c1 - 2 });
    }
    drawBeatSprites(ctx, S, sp);
    offbeatFlashes(ctx, S, { avoid: [[c0, r0, c1, r1]] });
    hud(ctx, S);
  };
}

export const FULL = [0, 0, COLS, 54];
