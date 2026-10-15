// 间奏二的舞蹈视频（V9 / V10，第十五轮）→ 剪影蒙版 + 颜色分区图。不用新依赖：ffmpeg 解码成原始像素，边解码边处理（2560×1440 的视频整段放进内存要 1 GB）。
//   build/masks/<编号>.json   剪影（和 video_masks.mjs 同一个格式，core/masks.js 直接能用），1280×720
//   build/maps/<编号>.seg     颜色分区（每个像素一个类：0 背景 1 蓝（头发 / 尾巴）2 深蓝（裙子）3 白（围裙、袜子、头饰）4 皮肤 5 黑（鞋）），640×360，
//                             二进制按行游程编码：文件头 'SEG1' + uint16 w, h, n, fps×100；每帧 uint32 字节数 + [类, 长度] 字节对（长度 > 255 拆开）
//   build/maps/<编号>_check.png 检查图（每 12 帧一张：左原图、右分区上色）
// 背景：每帧取四角中位数当背景色，从四边洪水填充"和背景色接近"的像素。V10 中途背景变成黑的（模型的问题，用户：先试试能不能用）——
// 背景暗的时候把阈值放宽（地上那圈暗光也算背景；黑鞋会被一起抠掉，只是一小块）
// 用法：node scripts/video_maps.mjs V9 V10
import { spawn } from 'node:child_process';
import { mkdir, writeFile, open } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { createCanvas } = require('@napi-rs/canvas');
const ids = process.argv.slice(2).filter(a => !a.startsWith('--'));
const MW = 1280, MH = 720, SW = 640, SH = 360;

function probe(file) {
  return new Promise((res, rej) => {
    const p = spawn('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=r_frame_rate', '-of', 'csv=p=0', file]);
    let s = ''; p.stdout.on('data', d => (s += d)); p.on('close', c => { if (c) return rej(new Error('ffprobe 失败')); const [a, b] = s.trim().split('/').map(Number); res(a / b); });
  });
}
// 逐帧回调（RGB24，MW×MH）
function eachFrame(file, cb) {
  return new Promise((res, rej) => {
    const p = spawn('ffmpeg', ['-v', 'error', '-i', file, '-vf', `scale=${MW}:${MH}:flags=area`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']);
    const n = MW * MH * 3; let buf = Buffer.alloc(0), k = 0;
    p.stdout.on('data', d => { buf = Buffer.concat([buf, d]); while (buf.length >= n) { cb(buf.subarray(0, n), k++); buf = buf.subarray(n); } });
    p.on('close', c => (c ? rej(new Error('ffmpeg 失败')) : res(k)));
  });
}
function keyFrame(px) {
  const w = MW, h = MH, at = (x, y) => (y * w + x) * 3, cs = [[2, 2], [w - 3, 2], [2, h - 3], [w - 3, h - 3]].map(([x, y]) => [px[at(x, y)], px[at(x, y) + 1], px[at(x, y) + 2]]);
  const bg = [0, 1, 2].map(k => cs.map(c => c[k]).sort((a, b) => a - b)[1]), dark = bg[0] + bg[1] + bg[2] < 150, TOL = dark ? 95 : 28;
  const near = i => { const o = i * 3; return Math.abs(px[o] - bg[0]) + Math.abs(px[o + 1] - bg[1]) + Math.abs(px[o + 2] - bg[2]) < TOL; };
  const out = new Uint8Array(w * h).fill(1), q = new Int32Array(w * h);
  let qh = 0, qt = 0;
  const push = i => { if (out[i] && near(i)) { out[i] = 0; q[qt++] = i; } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (qh < qt) { const i = q[qh++], x = i % w; if (x > 0) push(i - 1); if (x < w - 1) push(i + 1); if (i >= w) push(i - w); if (i < (h - 1) * w) push(i + w); }
  // 去掉小岛（地上的光斑）：只留最大的连通块和面积 > 0.3% 的块
  const lab = new Int32Array(w * h).fill(-1), sizes = [];
  for (let s = 0; s < w * h; s++) {
    if (!out[s] || lab[s] >= 0) continue;
    const id = sizes.length; let n = 0; qh = qt = 0; q[qt++] = s; lab[s] = id;
    while (qh < qt) { const i = q[qh++], x = i % w; n++; for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) if (j >= 0 && j < w * h && out[j] && lab[j] < 0) { lab[j] = id; q[qt++] = j; } }
    sizes.push(n);
  }
  const big = Math.max(0, ...sizes);
  for (let i = 0; i < w * h; i++) if (out[i] && sizes[lab[i]] < Math.max(0.003 * w * h, big * 0.02)) out[i] = 0;
  return { m: out, dark };
}
// 颜色 → 类
function classify(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), v = mx / 255, s = mx ? (mx - mn) / mx : 0;
  let hue = 0;
  if (mx !== mn) { const d = mx - mn; hue = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; hue = (hue * 60 + 360) % 360; }
  if (v < 0.2) return 5;
  if (v > 0.8 && s < 0.16) return 3;
  if ((hue < 50 || hue > 340) && s > 0.06 && s < 0.5 && v > 0.62) return 4;
  if (hue >= 180 && hue <= 270 && v < 0.48) return 2;
  if (v < 0.3) return 2;
  if (s < 0.2 && v > 0.65) return 3;
  return 1;
}
function rle(m) {
  const rows = [];
  for (let y = 0; y < MH; y++) { const r = []; let x = 0; while (x < MW) { if (m[y * MW + x]) { const s = x; while (x < MW && m[y * MW + x]) x++; r.push(s, x - s); } else x++; } rows.push(r); }
  return rows;
}
const PAL = [[0, 0, 0], [91, 140, 255], [43, 47, 119], [240, 244, 255], [255, 205, 190], [30, 30, 40]];

await mkdir(path.join(ROOT, 'build', 'masks'), { recursive: true });
await mkdir(path.join(ROOT, 'build', 'maps'), { recursive: true });
for (const id of ids) {
  const file = path.join(ROOT, 'assets', 'video', `${id}.mp4`), fps = await probe(file);
  const maskRows = [], segChunks = [], checks = [], darkFrames = [];
  const seg = new Uint8Array(SW * SH);
  const n = await eachFrame(file, (px, k) => {
    const { m, dark } = keyFrame(px);
    if (dark) darkFrames.push(k);
    maskRows.push(rle(m));
    // 分区：2×2 取左上像素所在块的多数（简单起见取四个里出现最多的类）
    for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
      const cnt = [0, 0, 0, 0, 0, 0];
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        const i = (y * 2 + dy) * MW + x * 2 + dx;
        cnt[m[i] ? classify(px[i * 3], px[i * 3 + 1], px[i * 3 + 2]) : 0]++;
      }
      let best = 0; for (let c = 1; c < 6; c++) if (cnt[c] > cnt[best] || (cnt[c] === cnt[best] && c && cnt[c] >= 2)) best = c;
      seg[y * SW + x] = cnt[0] >= 3 ? 0 : best;
    }
    const bytes = [];
    for (let y = 0; y < SH; y++) { let x = 0; while (x < SW) { const c = seg[y * SW + x]; let l = 0; while (x < SW && seg[y * SW + x] === c && l < 255) { x++; l++; } bytes.push(c, l); } }
    segChunks.push(Uint8Array.from(bytes));
    if (k % 12 === 0) checks.push({ px: Buffer.from(px), seg: Uint8Array.from(seg) });
    if (k % 60 === 0) process.stdout.write(`\r${id} ${k}`);
  });
  // 检查图：每 12 帧一列，上原图（1/4）下分区
  const cw = 320, ch = 180, cv = createCanvas(cw * checks.length, ch * 2), c = cv.getContext('2d'), im = c.createImageData(cw * checks.length, ch * 2);
  checks.forEach(({ px, seg }, j) => {
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const i = (y * 4 * MW + x * 4) * 3, o = (y * cw * checks.length + j * cw + x) * 4;
      im.data[o] = px[i]; im.data[o + 1] = px[i + 1]; im.data[o + 2] = px[i + 2]; im.data[o + 3] = 255;
      const sl = seg[y * 2 * SW + x * 2], o2 = ((y + ch) * cw * checks.length + j * cw + x) * 4, pc = sl ? PAL[sl] : [255, 255, 255];
      im.data[o2] = pc[0]; im.data[o2 + 1] = pc[1]; im.data[o2 + 2] = pc[2]; im.data[o2 + 3] = 255;
    }
  });
  c.putImageData(im, 0, 0);
  await writeFile(path.join(ROOT, 'build', 'maps', `${id}_check.png`), cv.encodeSync('png'));
  await writeFile(path.join(ROOT, 'build', 'masks', `${id}.json`), JSON.stringify({ id, w: MW, h: MH, fps, n, rows: maskRows }));
  const head = Buffer.alloc(12); head.write('SEG1', 0); head.writeUInt16LE(SW, 4); head.writeUInt16LE(SH, 6); head.writeUInt16LE(n, 8); head.writeUInt16LE(Math.round(fps * 100), 10);
  const parts = [head]; for (const s of segChunks) { const l = Buffer.alloc(4); l.writeUInt32LE(s.length, 0); parts.push(l, Buffer.from(s)); }
  await writeFile(path.join(ROOT, 'build', 'maps', `${id}.seg`), Buffer.concat(parts));
  console.log(`\r${id}：${n} 帧 @ ${fps} fps；背景暗的帧 ${darkFrames.length} 个（${darkFrames.length ? `${darkFrames[0]}–${darkFrames[darkFrames.length - 1]}` : '无'}）`);
}
