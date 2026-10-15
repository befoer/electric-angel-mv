// 间奏二最后一小节（第十六轮）：把视频某一段的原始画面抽成 JPG，引擎里当"解码出来的成品图"直接画（core/frames.js）。不用新依赖：ffmpeg 抽帧。
// 只抽用得到的那一段、只裁她所在的竖条（视频四周都是留白），一帧解码后约 2 MB，整段约 70 MB 内存。
//   build/frames/<编号>/001.jpg …   build/frames/<编号>.json  { id, t0, fps, n, crop: [x, y, w, h]（0..1，原视频里的范围）, w, h, bg }
// 用法：node scripts/video_frames.mjs V10 13.1 14.45 [--crop 0.34,0,0.32,1] [--height 1000]
import { spawn } from 'node:child_process';
import { mkdir, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const [id, a, b] = argv.filter((x, i) => !x.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')));
const crop = (opt('--crop') || '0.34,0,0.32,1').split(',').map(Number), height = +(opt('--height') || 1000);
if (!id || !(+b > +a)) { console.error('用法：node scripts/video_frames.mjs V10 13.1 14.45'); process.exit(1); }

const run = (cmd, args) => new Promise((res, rej) => {
  const p = spawn(cmd, args); let out = '', err = '';
  p.stdout.on('data', d => (out += d)); p.stderr.on('data', d => (err += d));
  p.on('close', c => (c ? rej(new Error(`${cmd} 失败：${err}`)) : res(out)));
});
const file = path.join(ROOT, 'assets', 'video', `${id}.mp4`), dir = path.join(ROOT, 'build', 'frames', id);
const [fa, fb] = (await run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=r_frame_rate', '-of', 'csv=p=0', file])).trim().split('/').map(Number), fps = fa / fb;
await mkdir(dir, { recursive: true });
for (const f of await readdir(dir)) if (/^\d{3}\.jpg$/.test(f)) throw new Error(`${dir} 里已经有帧了，先手动清掉再重抽`);
const [cx, cy, cw, ch] = crop;
await run('ffmpeg', ['-v', 'error', '-y', '-ss', String(a), '-i', file, '-t', String(+b - +a),
  '-vf', `crop=iw*${cw}:ih*${ch}:iw*${cx}:ih*${cy},scale=-2:${height}:flags=lanczos`, '-q:v', '3', path.join(dir, '%03d.jpg')]);
const n = (await readdir(dir)).filter(f => /^\d{3}\.jpg$/.test(f)).length;
// 背景色：取第一帧左上角一小块的平均（画进图像框时外面补这个色）
const px = Buffer.from(await new Promise((res, rej) => {
  const p = spawn('ffmpeg', ['-v', 'error', '-i', path.join(dir, '001.jpg'), '-vf', 'crop=8:8:2:2,scale=1:1:flags=area', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']);
  const bufs = []; p.stdout.on('data', d => bufs.push(d)); p.on('close', c => (c ? rej(new Error('取背景色失败')) : res(Buffer.concat(bufs))));
}));
const bg = '#' + [...px.subarray(0, 3)].map(v => v.toString(16).padStart(2, '0')).join('');
const meta = { id, t0: +a, fps, n, crop, h: height, bg };
await writeFile(path.join(ROOT, 'build', 'frames', `${id}.json`), JSON.stringify(meta, null, 1));
console.log(`${id}：${n} 帧（${a}–${b} s，${fps} fps）→ build/frames/${id}/，背景 ${bg}`);
