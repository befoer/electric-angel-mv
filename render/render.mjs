// 出片：逐帧调用 renderFrame，原始 RGBA 直接 pipe 给 ffmpeg；按时间段分多个进程并行，最后拼接并混入原音频
// 用法：
//   node render/render.mjs                       全片 → out/film.mp4（从成片起点 0.6 s 开始，见 engine/core/const.js filmStart）
//   node render/render.mjs --bars 1-12           第 1–12 小节 → out/bars_1-12.mp4
//   node render/render.mjs --from 10 --to 20     10–20 秒 → out/t_10-20.mp4
//   node render/render.mjs --png 3.5 12 14.6     单帧 → out/单帧/frame_3.500.png …（加 --dir <目录> 换存放位置）
//   其他参数：--jobs N（默认 CPU 核数 − 1，最多 8）--crf 16 --preset medium --out <路径>
//   --rev opening=8,comfy=8   临时用上一版画（版本开关见 engine/rev.js）
import { spawn } from 'node:child_process';
import { mkdir, writeFile, rm, access } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nodePlatform, ROOT } from './platform-node.js';
import { initEngine, renderFrame, prepareFrame, W, H, FPS, DURATION } from '../engine/main.js';
import { filmStart } from '../engine/core/const.js';
import { barStart } from '../engine/core/time.js';
import { setRev } from '../engine/rev.js';

const SELF = fileURLToPath(import.meta.url);
const AUDIO = path.join(ROOT, 'assets', 'audio', '电子天使.mp3');
const OUT = path.join(ROOT, 'out');

function args() {
  const a = process.argv.slice(2), o = { png: [] };
  for (let i = 0; i < a.length; i++) {
    const k = a[i];
    if (k === '--png') { while (a[i + 1] && !a[i + 1].startsWith('--')) o.png.push(+a[++i]); }
    else if (k === '--worker') { o.worker = { f0: +a[++i], f1: +a[++i], seg: a[++i], crf: a[++i], preset: a[++i] }; }
    else if (k.startsWith('--')) o[k.slice(2)] = a[++i];
  }
  return o;
}

function ffmpeg(argv, { input = false } = {}) {
  const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...argv], { stdio: [input ? 'pipe' : 'ignore', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => p.on('close', c => (c === 0 ? res() : rej(new Error(`ffmpeg 退出码 ${c}`)))));
  return { p, done };
}

// 画布像素的通道顺序（Skia 可能是 RGBA 或 BGRA）
function pixFmt(canvas) {
  const c = canvas.getContext('2d');
  c.fillStyle = '#FF0000'; c.fillRect(0, 0, 1, 1);
  const d = canvas.data();
  return d[0] === 255 ? 'rgba' : 'bgra';
}

async function worker({ f0, f1, seg, crf, preset }) {
  await initEngine(nodePlatform);
  const { createCanvas } = await import('@napi-rs/canvas');
  const canvas = createCanvas(W, H), ctx = canvas.getContext('2d');
  const fmt = pixFmt(canvas);
  const ff = ffmpeg(['-y', '-f', 'rawvideo', '-pix_fmt', fmt, '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', preset, '-crf', crf, '-pix_fmt', 'yuv420p', '-g', '120', seg], { input: true });
  const stdin = ff.p.stdin;
  for (let f = f0; f < f1; f++) {
    await prepareFrame(f / FPS);
    renderFrame(ctx, f / FPS);
    if (!stdin.write(canvas.data())) await new Promise(r => stdin.once('drain', r));
    if ((f - f0) % 30 === 29) process.stdout.write(`P ${f - f0 + 1}\n`);
  }
  stdin.end();
  await ff.done;
  process.stdout.write(`P ${f1 - f0}\n`);
}

async function main() {
  const o = args();
  // 版本开关经环境变量传给并行的子进程
  if (o.rev) process.env.DS_REV = o.rev;
  setRev(process.env.DS_REV);
  if (o.worker) return worker(o.worker);
  await mkdir(OUT, { recursive: true });

  if (o.png.length) {
    await initEngine(nodePlatform);
    const { createCanvas } = await import('@napi-rs/canvas');
    const canvas = createCanvas(W, H), ctx = canvas.getContext('2d');
    const dir = o.dir ? path.resolve(o.dir) : path.join(OUT, '单帧');
    await mkdir(dir, { recursive: true });
    for (const t of o.png) {
      await prepareFrame(t);
      const a = performance.now();
      renderFrame(ctx, t);
      const ms = performance.now() - a;
      const file = path.join(dir, `frame_${t.toFixed(3)}.png`);
      await writeFile(file, canvas.encodeSync('png'));
      console.log(`${file}  ${ms.toFixed(1)} ms`);
    }
    return;
  }

  // 全片 / 从第 1 小节出片时从成片起点 filmStart() 开始（第十三轮：片头静音缩短），音频跟着从同一处切
  let from = filmStart(), to = DURATION, name = 'film';
  if (o.bars) { const [a, b] = o.bars.split('-').map(Number); from = a === 1 ? filmStart() : barStart(a); to = Math.min(DURATION, barStart(b + 1)); name = `bars_${a}-${b}`; }
  if (o.from) { from = +o.from; name = `t_${o.from}-${o.to ?? 'end'}`; }
  if (o.to) to = Math.min(DURATION, +o.to);
  const out = o.out ? path.resolve(o.out) : path.join(OUT, `${name}.mp4`);
  const f0 = Math.round(from * FPS), f1 = Math.round(to * FPS), n = f1 - f0;
  const jobs = Math.max(1, Math.min(+(o.jobs || Math.min(8, os.cpus().length - 1)), Math.ceil(n / 60)));
  const crf = o.crf || '16', preset = o.preset || 'medium';
  console.log(`出片 ${from.toFixed(3)}–${to.toFixed(3)} s，${n} 帧，${jobs} 个进程 → ${out}`);

  const t0 = performance.now(), done = new Array(jobs).fill(0), segs = [];
  await Promise.all(Array.from({ length: jobs }, (_, j) => {
    const a = f0 + Math.floor((n * j) / jobs), b = f0 + Math.floor((n * (j + 1)) / jobs);
    const seg = path.join(OUT, `.seg_${process.pid}_${j}.mp4`);
    segs.push(seg);
    const p = spawn(process.execPath, [SELF, '--worker', a, b, seg, crf, preset], { stdio: ['ignore', 'pipe', 'inherit'] });
    p.stdout.on('data', buf => {
      for (const m of String(buf).matchAll(/P (\d+)/g)) done[j] = +m[1];
      const k = done.reduce((x, y) => x + y, 0), s = (performance.now() - t0) / 1000;
      process.stderr.write(`\r  ${k}/${n} 帧  ${(k / s).toFixed(1)} 帧/秒  `);
    });
    return new Promise((res, rej) => p.on('close', c => (c === 0 ? res() : rej(new Error(`进程 ${j} 退出码 ${c}`)))));
  }));
  process.stderr.write('\n');

  const list = path.join(OUT, `.segs_${process.pid}.txt`);
  await writeFile(list, segs.map(s => `file '${s.replace(/\\/g, '/')}'`).join('\n'));
  // 歌有版权，公开仓库里不带（第二十八轮）：没有 assets/audio/电子天使.mp3 时出无声的片子
  const hasAudio = await access(AUDIO).then(() => true, () => false);
  if (!hasAudio) console.warn(`没有 ${AUDIO}，出无声的片子（放法见 assets/audio/README.md）`);
  await ffmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', list, ...(hasAudio ? ['-ss', from.toFixed(4), '-t', (to - from).toFixed(4), '-i', AUDIO] : []),
    '-map', '0:v', ...(hasAudio ? ['-map', '1:a', '-c:a', 'aac', '-b:a', '320k'] : []), '-c:v', 'copy', '-movflags', '+faststart', out]).done;
  await Promise.all([list, ...segs].map(f => rm(f, { force: true, maxRetries: 8, retryDelay: 500 }).catch(e => console.warn(`临时文件没删掉（${e.code}）：${f}`))));
  console.log(`完成：${out}（${((performance.now() - t0) / 1000).toFixed(1)} s）`);
}

main().catch(e => { console.error(e); process.exit(1); });
