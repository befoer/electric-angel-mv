// 舞蹈视频 → 剪影蒙版（第八轮，素材清单 §6.4）。不用新依赖：ffmpeg 解码成原始像素，从画面四边往里"洪水填充"浅色背景，
// 填到的是背景，剩下的（包括被身体围住的白围裙、白袜）就是她。结果按行做游程编码存成 build/masks/<编号>.json，引擎在 core/masks.js 里画。
// 用法：node scripts/video_masks.mjs V1 [V2 …]       另存检查图 build/masks/<编号>_check.png（每 12 帧一张，绿 = 蒙版）
// 参数：--tol 28（与背景色的距离阈值）--scale 0.5（存的分辨率，相对原视频）
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { createCanvas } = require('@napi-rs/canvas');

const argv = process.argv.slice(2), ids = argv.filter(a => !a.startsWith('--') && !/^\d/.test(a));
const opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? +argv[i + 1] : null; };
const TOL = opt('tol') ?? 28, SCALE = opt('scale') ?? 0.5;

function probe(file) {
  return new Promise((res, rej) => {
    const p = spawn('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate', '-of', 'csv=p=0', file]);
    let s = ''; p.stdout.on('data', d => (s += d)); p.on('close', c => {
      if (c) return rej(new Error('ffprobe 失败')); const [w, h, r] = s.trim().split(','); const [a, b] = r.split('/').map(Number); res({ w: +w, h: +h, fps: a / b });
    });
  });
}
function frames(file, w, h) { // 解码成 RGB 原始帧
  return new Promise((res, rej) => {
    const p = spawn('ffmpeg', ['-v', 'error', '-i', file, '-vf', `scale=${w}:${h}`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']);
    const bufs = []; p.stdout.on('data', d => bufs.push(d)); p.on('close', c => {
      if (c) return rej(new Error('ffmpeg 失败')); const all = Buffer.concat(bufs), n = w * h * 3, out = [];
      for (let o = 0; o + n <= all.length; o += n) out.push(all.subarray(o, o + n)); res(out);
    });
  });
}

// 一帧：背景色取四角的中位数；从四边洪水填充"和背景色接近"的像素；剩下的是蒙版。再补掉很小的孔、去掉很小的岛
function keyFrame(px, w, h) {
  const at = (x, y) => (y * w + x) * 3, corners = [[2, 2], [w - 3, 2], [2, h - 3], [w - 3, h - 3]].map(([x, y]) => [px[at(x, y)], px[at(x, y) + 1], px[at(x, y) + 2]]);
  const bg = [0, 1, 2].map(k => corners.map(c => c[k]).sort((a, b) => a - b)[1]);
  const near = i => { const o = i * 3, d = Math.abs(px[o] - bg[0]) + Math.abs(px[o + 1] - bg[1]) + Math.abs(px[o + 2] - bg[2]); return d < TOL; };
  const out = new Uint8Array(w * h).fill(1), q = new Int32Array(w * h);
  let qh = 0, qt = 0;
  const push = i => { if (out[i] && near(i)) { out[i] = 0; q[qt++] = i; } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (qh < qt) { const i = q[qh++], x = i % w; if (x > 0) push(i - 1); if (x < w - 1) push(i + 1); if (i >= w) push(i - w); if (i < (h - 1) * w) push(i + w); }
  return out;
}
// 按行游程编码：每行 [起, 长, 起, 长 …]
function rle(m, w, h) {
  const rows = [];
  for (let y = 0; y < h; y++) {
    const r = []; let x = 0;
    while (x < w) { if (m[y * w + x]) { const s = x; while (x < w && m[y * w + x]) x++; r.push(s, x - s); } else x++; }
    rows.push(r);
  }
  return rows;
}

await mkdir(path.join(ROOT, 'build', 'masks'), { recursive: true });
for (const id of ids) {
  const file = path.join(ROOT, 'assets', 'video', `${id}.mp4`), info = await probe(file);
  const w = Math.round((info.w * SCALE) / 2) * 2, h = Math.round((info.h * SCALE) / 2) * 2;
  const fr = await frames(file, w, h), masks = fr.map(f => keyFrame(f, w, h));
  // 检查图：每 12 帧一张，蒙版绿色叠在原图上
  const step = 12, n = Math.ceil(masks.length / step), cv = createCanvas(w * n, h), c = cv.getContext('2d'), im = c.createImageData(w * n, h);
  for (let k = 0; k < n; k++) {
    const f = fr[k * step], m = masks[k * step];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, o = (y * w * n + k * w + x) * 4;
      im.data[o] = m[i] ? f[i * 3] * 0.4 : f[i * 3]; im.data[o + 1] = m[i] ? 140 + f[i * 3 + 1] * 0.45 : f[i * 3 + 1]; im.data[o + 2] = m[i] ? f[i * 3 + 2] * 0.4 : f[i * 3 + 2]; im.data[o + 3] = 255;
    }
  }
  c.putImageData(im, 0, 0);
  await writeFile(path.join(ROOT, 'build', 'masks', `${id}_check.png`), cv.encodeSync('png'));
  const json = { id, w, h, fps: info.fps, n: masks.length, rows: masks.map(m => rle(m, w, h)) };
  await writeFile(path.join(ROOT, 'build', 'masks', `${id}.json`), JSON.stringify(json));
  console.log(`${id}：${masks.length} 帧 ${w}×${h} @ ${info.fps} fps → build/masks/${id}.json`);
}
