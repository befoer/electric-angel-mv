// 确定性随机：一切"随机"都是输入的纯函数，任意时刻跳转画面一致（视觉方案 §八）

function fmix(h) {
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

export function hash(a = 0, b = 0, c = 0, d = 0) {
  let h = fmix((a | 0) + 0x9e3779b9);
  h = fmix(h ^ ((b | 0) + 0x7f4a7c15));
  h = fmix(h ^ ((c | 0) + 0x94d049bb));
  return fmix(h ^ ((d | 0) + 0x2545f491));
}

export const rnd = (a, b, c, d) => hash(a, b, c, d) / 4294967296;

export function strHash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export const pick = (arr, a, b, c, d) => arr[hash(a, b, c, d) % arr.length];

// entries: [[值, 权重], ...]，u ∈ [0,1)
export function weighted(entries, u) {
  let total = 0;
  for (const e of entries) total += e[1];
  let x = u * total;
  for (const e of entries) { x -= e[1]; if (x < 0) return e[0]; }
  return entries[entries.length - 1][0];
}

// 三维值噪声，输出 0..1
export function vnoise(x, y, z = 0, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const n = (i, j, k) => rnd(xi + i, yi + j, zi + k, seed);
  const a = n(0, 0, 0) + (n(1, 0, 0) - n(0, 0, 0)) * u;
  const b = n(0, 1, 0) + (n(1, 1, 0) - n(0, 1, 0)) * u;
  const c = n(0, 0, 1) + (n(1, 0, 1) - n(0, 0, 1)) * u;
  const d = n(0, 1, 1) + (n(1, 1, 1) - n(0, 1, 1)) * u;
  const e = a + (b - a) * v, f = c + (d - c) * v;
  return e + (f - e) * w;
}
