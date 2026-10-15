// ComfyUI 段的公用部件（第十二轮从 comfy_r8.js 拆出来；第八轮的 3D 版已删，旧版在 归档/快照/）：界面配色、连线颜色、批量图、去噪中间步、特效音点亮
import { hash } from '../core/rand.js';
import { photo, hasIllust } from '../core/portrait.js';
import { softCopy } from '../core/cam.js';
import { D } from '../core/data.js';
import { newCanvas } from '../core/env.js';

export const STEPS = 28;
// ComfyUI 的浅灰界面（不跟段落配色走，只有点缀色用当前调色板）
export const UI = { bg: '#ECEEF2', dot: '#D5D9E2', panel: 'rgba(255,255,255,0.84)', head: 'rgba(228,231,238,0.96)', edge: 'rgba(150,156,172,0.85)', text: '#2A2E3A', gray: '#7D8496', widget: 'rgba(241,243,247,0.95)' };
export const WIRE = { MODEL: '#B39DDB', CLIP: '#F2C94C', CONDITIONING: '#F2994A', LATENT: '#F48FB1', VAE: '#EB5757', IMAGE: '#64B5F6' };

// ---------------------------------------------------------------- 批量图（B01–B16；没登记时用 I 系列拼后备）
const FALLBACK = [
  ['I03', [0.15, 0.03, 0.7, 0.55], '#DCE8FF'], ['I02', [0.15, 0.03, 0.7, 0.55], '#FFE1EC'], ['I05', null, '#FFF2C2'], ['I06', null, '#D2F4EF'],
  ['I07', null, '#E6DFFF'], ['I08', null, '#FFE6D6'], ['I09', [0.0, 0.0, 0.8, 0.75], '#E1E8FF'], ['I10', null, '#FFF0C9'],
  ['I11', [0.15, 0.05, 0.7, 0.85], '#D3F0F9'], ['I01', [0.15, 0.0, 0.7, 0.42], '#FFDDEB'], ['I04a', [0.2, 0.1, 0.6, 0.7], '#E2E5FF'], ['I03', [0.25, 0.08, 0.5, 0.4], '#FFE3EC'],
  ['I02', [0.25, 0.08, 0.5, 0.4], '#DCE8FF'], ['I05', [0.0, 0.0, 1, 0.5], '#FFF2C2'], ['I08', [0.1, 0.0, 0.8, 0.55], '#D2F4EF'], ['I07', [0.2, 0.0, 0.7, 0.7], '#E6DFFF'],
];
const BIMG = new Map();
export function batchImage(i, size = 256) {
  const id = `B${String(i + 1).padStart(2, '0')}`, key = `${id}|${size}`;
  let cv = BIMG.get(key);
  if (cv) return cv;
  if (hasIllust(id)) cv = photo(id, null, size, size);
  else {
    const [src, sub, bg] = FALLBACK[i % 16];
    cv = newCanvas(size, size); const c = cv.getContext('2d');
    c.fillStyle = bg; c.fillRect(0, 0, size, size);
    const im = photo(src, sub, size, size, { keyed: !sub || src !== 'I04a' });
    c.drawImage(im, 0, 0);
  }
  BIMG.set(key, cv);
  return cv;
}
// 每次 Run 出的那一批：第 r 次 Run 的第 i 格是哪张图
export const imgOf = (r, i) => (i * 5 + r * 7 + (r ? 3 : 0)) % 16;

// 去噪中间步：目标图（这一次 Run 的第一张）从模糊 + 彩色噪声里出来。按 (目标, 步) 缓存
const NOISE = [];
function noiseCanvas(k) {
  if (NOISE[k]) return NOISE[k];
  const cv = newCanvas(48, 48), c = cv.getContext('2d'), im = c.createImageData(48, 48);
  for (let i = 0; i < 48 * 48; i++) { const h = hash(i, k, 77); im.data[i * 4] = 90 + (h & 127); im.data[i * 4 + 1] = 90 + ((h >> 8) & 127); im.data[i * 4 + 2] = 120 + ((h >> 16) & 127); im.data[i * 4 + 3] = 255; }
  c.putImageData(im, 0, 0);
  return (NOISE[k] = cv);
}
const STEPC = new Map();
export function stepImage(target, s, size = 560) {
  const key = `${target}|${s}`;
  let cv = STEPC.get(key);
  if (cv) return cv;
  if (STEPC.size > 40) STEPC.clear();
  cv = newCanvas(size, size); const c = cv.getContext('2d'), sig = Math.pow(1 - s / STEPS, 1.4), img = batchImage(target, 512);
  c.drawImage(sig > 0.05 ? softCopy(img, 1 + 22 * sig, `cf${s % 6}`) : img, 0, 0, size, size);
  if (sig > 0.01) { c.globalAlpha = Math.min(1, 1.05 * sig); c.imageSmoothingEnabled = true; c.drawImage(noiseCanvas(s % 7), 0, 0, size, size); c.globalAlpha = 1; }
  STEPC.set(key, cv);
  return cv;
}

// Preview Image：4×4，一张张随特效音亮起；温度高时"糊锅"
export function lit(i, t) {
  let best = [99, 0];
  for (const [ot, s] of D.fxOnsets) { if (ot > t) break; if (hash(Math.round(ot * 1000), 7) % 16 === i) best = [t - ot, s]; }
  return best;
}
