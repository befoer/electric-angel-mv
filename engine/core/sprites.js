// 像素精灵与节拍元素（视觉方案 §4.6、§七）
import { CW, CH, COLS, ROWS, BAR0, BEAT, BRAND } from './const.js';
import { rnd, weighted } from './rand.js';
import { resolveColor, css } from './color.js';
import { newCanvas } from './env.js';
import { energy, introStrength } from './data.js';
import { clamp, easeOut, easeOutBack, pos } from './time.js';

// 字符串定义：每个字符是一个像素，col 把字符映射到色值键（color.js resolveColor）
export const SPR = {
  heart: { rows: ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'], col: { '#': 'acc0' } },
  heartO: { rows: ['.##.##.', '#..#..#', '#.....#', '.#...#.', '..#.#..', '...#...'], col: { '#': 'acc0' } },
  star: { rows: ['...#...', '..###..', '#######', '.#####.', '.##.##.', '##...##'], col: { '#': 'acc1' } },
  sparkle: { rows: ['...#...', '...#...', '..###..', '#######', '..###..', '...#...', '...#...'], col: { '#': 'acc1' } },
  cross: { rows: ['..#..', '..#..', '#####', '..#..', '..#..'], col: { '#': 'brand' } },
  diamond: { rows: ['...#...', '..###..', '.#####.', '#######', '.#####.', '..###..', '...#...'], col: { '#': 'acc1' } },
  note: { rows: ['...##.', '...#.#', '...#..', '...#..', '.###..', '####..', '.##...'], col: { '#': 'ink4' } },
  tail: { rows: ['#.......#', '##.....##', '.##...##.', '..#####..', '...###...', '....#....', '....#....'], col: { '#': 'brand' } },
  bubble: { rows: ['.###.', '#...#', '#...#', '#...#', '.###.'], col: { '#': 'ink2' } },
  feather: { rows: ['....##', '...###', '..###.', '.###..', '##....', '#.....'], col: { '#': 'acc0' } },
  rice: { rows: ['..o.o.o..', '.ooooooo.', 'ooooooooo', '#########', '.#######.', '..#####..'], col: { o: 'ink1', '#': 'brand' } },
  fish: { rows: ['..###..#', '.#####.#', '#o######', '.#####.#', '..###..#'], col: { '#': 'brand', o: 'win' } },
  thumb: { rows: ['...##...', '..###...', '..##....', '######..', '#######.', '#######.', '######..', '.#####..'], col: { '#': 'brand' } },
  // 第二十四轮：0:24 养成游戏式小图标用（礼物、话筒）
  gift: { rows: ['.#.#.#.', '..###..', '#######', '#oo#oo#', '#oo#oo#', '#######'], col: { '#': 'acc0', o: 'win' } },
  mic: { rows: ['.###.', '#ooo#', '#ooo#', '.###.', '..#..', '..#..', '.###.'], col: { '#': 'brand', o: 'win' } },
  thumbDown: { rows: ['.#####..', '######..', '#######.', '#######.', '######..', '..##....', '..###...', '...##...'], col: { '#': 'gray' } },
  whale: {
    rows: [
      '..........#...#.',
      '...........###..',
      '....#####...#...',
      '..#########.#...',
      '.############...',
      '#o###########...',
      '##############..',
      '.#############..',
      '..##########....',
      '....######......',
    ],
    col: { '#': 'brand', o: 'win' },
  },
};
SPR.whaleW = { rows: SPR.whale.rows, col: { '#': 'win', o: 'brand' } }; // 白色鲸鱼（头像、深色底上用）

const CACHE = new Map();
export function spriteCanvas(name, px, pal) {
  const k = `${name}|${px}|${pal.key}`;
  let cv = CACHE.get(k);
  if (cv) return cv;
  const d = SPR[name], h = d.rows.length, w = d.rows[0].length;
  cv = newCanvas(w * px, h * px);
  const c = cv.getContext('2d');
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const key = d.col[d.rows[y][x]];
      if (!key) continue;
      c.fillStyle = resolveColor(pal, key);
      c.fillRect(x * px, y * px, px, px);
    }
  }
  CACHE.set(k, cv);
  return cv;
}

export function drawSprite(ctx, name, px, pal, cx, cy, scale = 1, alpha = 1) {
  if (scale <= 0.01 || alpha <= 0.01) return;
  const cv = spriteCanvas(name, px, pal);
  const w = Math.round(cv.width * scale), h = Math.round(cv.height * scale), a0 = ctx.globalAlpha;
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = a0 * alpha;
  ctx.drawImage(cv, Math.round(cx - w / 2), Math.round(cy - h / 2), w, h);
  ctx.globalAlpha = a0;
  ctx.imageSmoothingEnabled = true;
}

// 精灵占用的格子（给 Occ 用）
export function spriteCells(s) {
  const d = SPR[s.name], hw = (d.rows[0].length * s.px) / 2, hh = (d.rows.length * s.px) / 2;
  return [(s.x - hw) / CW, (s.y - hh) / CH, (s.x + hw) / CW, (s.y + hh) / CH];
}

// ---------------------------------------------------------------- 节拍元素

const SETS = {
  loli: [['heart', 0.35], ['star', 0.22], ['cross', 0.13], ['note', 0.1], ['tail', 0.1], ['rice', 0.1]],
  onee: [['diamond', 0.3], ['cross', 0.25], ['heartO', 0.25], ['bubble', 0.2]],
  shoujo: [['sparkle', 0.35], ['note', 0.3], ['feather', 0.2], ['heart', 0.15]],
};
export const voiceAt = bar => (bar >= 42 && bar <= 65 ? 'onee' : bar >= 90 && bar <= 106 ? 'shoujo' : 'loli');
const COUNT = [0, 4, 1.5, 3, 1.5]; // 强拍 4、次强拍 3、弱拍 1–2
const LIFE = [0, 2, 1, 1, 1];       // 强拍生成的活 2 拍，其他活 1 拍

// 计算此刻存活的节拍元素。只依赖 S.t，任意时刻跳转结果一致
// avoid：要避开的格子矩形 [c0, r0, c1, r1]；skip(bar, beat) 为 true 的拍不生成
// intro：按前奏实测强度缩放（×0.6–×1.4，2–5 小节再 ×0.6），否则按小节能量
export function beatSprites(S, { mult = 1, set = null, avoid = [], from = 1.266, skip = null, intro = false } = {}) {
  const out = [];
  if (mult <= 0) return out;
  for (let ni = S.ni - 2; ni <= S.ni; ni++) {
    const tb = BAR0 + ni * BEAT;
    if (tb < from - 0.002) continue;
    const { bar, beat } = pos(tb + 0.001);
    if (skip && skip(bar, beat)) continue;
    const life = LIFE[beat] * BEAT, age = S.t - tb;
    if (age < 0 || age > life + 0.1) continue;
    const k = intro ? clamp(0.6 + 0.8 * introStrength(bar, beat), 0.6, 1.4) * (bar <= 5 ? 0.6 : 1) : energy(bar);
    const n = Math.floor(COUNT[beat] * k * mult + rnd(ni, 77));
    const voice = set || voiceAt(bar), kinds = SETS[voice];
    const placed = [];
    for (let i = 0; i < n; i++) {
      let col = 0, row = 0, ok = false;
      for (let tries = 0; tries < 8 && !ok; tries++) {
        col = 3 + Math.floor(rnd(ni, i, tries, 1) * (COLS - 6));
        row = 2 + Math.floor(rnd(ni, i, tries, 2) * (ROWS - 4));
        ok = placed.every(p => Math.abs(p[0] - col) >= 8 || Math.abs(p[1] - row) >= 4)
          && !avoid.some(a => col >= a[0] - 2 && col < a[2] + 2 && row >= a[1] - 1 && row < a[3] + 1);
      }
      if (!ok) continue;
      placed.push([col, row]);
      let name = weighted(kinds, rnd(ni, i, 5));
      if (beat === 1 && i === 0 && voice === 'loli') name = rnd(ni, 6) < 0.6 ? 'heart' : 'tail'; // 强拍必含一个心或鲸尾
      const px = beat === 1 ? [6, 5, 4][i % 3] : beat === 3 ? 5 : 4;
      let scale;
      if (age < 0.1) scale = easeOutBack(age / 0.1, 2.5);           // 一个十六分音符内弹出 0 → 125% → 100%
      else if (age > life) scale = Math.max(0, 1 - (age - life) / 0.1); // 0.1 s 内缩小
      else { const e = (S.t - BAR0) / (BEAT / 2); scale = 1 + 0.08 * (1 - (e - Math.floor(e))) ** 2; } // 每个八分音符呼吸一次
      out.push({ name, px, x: col * CW + CW / 2, y: row * CH + CH / 2, scale, die: age > life ? (age - life) / 0.1 : 0, ring: beat === 1 && i === 0 ? age : -1, seed: ni * 31 + i });
    }
  }
  return out;
}

export function drawBeatSprites(ctx, S, list) {
  for (const s of list) {
    if (s.ring >= 0 && s.ring < 0.4) { // 强拍的扩散环
      ctx.strokeStyle = css(BRAND, 0.5 * (1 - s.ring / 0.4));
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(s.x, s.y, 12 + easeOut(s.ring / 0.4) * 90, 0, Math.PI * 2); ctx.stroke();
    }
    drawSprite(ctx, s.name, s.px, S.pal, s.x, s.y, s.scale);
    if (s.die > 0) { // 迸出 4 个像素碎屑
      ctx.fillStyle = S.pal.acc[s.seed % 3];
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + rnd(s.seed, k) * 0.8, d = 8 + s.die * 26;
        ctx.globalAlpha = 1 - s.die;
        ctx.fillRect(Math.round(s.x + Math.cos(a) * d), Math.round(s.y + Math.sin(a) * d), s.px, s.px);
      }
      ctx.globalAlpha = 1;
    }
  }
}

// 第 10 小节起，每拍的反拍八分上 2 个 1 格闪点
export function offbeatFlashes(ctx, S, { avoid = [] } = {}) {
  return; // 第八轮：去掉（用户：闪的东西太多）
  if (S.bar < 10 || S.sub < 0.5 || S.sub >= 0.75) return;
  const a = 1 - (S.sub - 0.5) / 0.25;
  for (let i = 0; i < 2; i++) {
    const col = 2 + Math.floor(rnd(S.ni, i, 41) * (COLS - 4)), row = 1 + Math.floor(rnd(S.ni, i, 42) * (ROWS - 2));
    if (avoid.some(r => col >= r[0] && col < r[2] && row >= r[1] && row < r[3])) continue;
    ctx.globalAlpha = a;
    ctx.fillStyle = S.pal.acc[i % 3];
    ctx.fillRect(col * CW + 2, row * CH + 5, CW - 4, CW - 4);
    ctx.globalAlpha = 1;
  }
}

// 落点：12 个全尺寸精灵从中心迸散
export function dropBurst(ctx, S, t0, { cx = 960, cy = 540 } = {}) {
  const age = S.t - t0;
  if (age < 0 || age > 1.2) return;
  const names = ['heart', 'star', 'tail', 'heart', 'note', 'cross'];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + rnd(i, 91) * 0.4, d = 120 + easeOut(age / 0.7) * (380 + rnd(i, 92) * 260);
    const sc = age < 0.1 ? easeOutBack(age / 0.1, 2.5) : 1;
    drawSprite(ctx, names[i % names.length], 6, S.pal, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.62, sc, 1 - clamp((age - 0.7) / 0.5));
  }
}
