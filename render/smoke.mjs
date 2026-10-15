import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fontDir = join(root, 'assets', 'fonts');
const outDir = join(root, 'out');
mkdirSync(outDir, { recursive: true });

for (const f of readdirSync(fontDir)) {
  if (/\.(ttf|otf)$/i.test(f)) GlobalFonts.registerFromPath(join(fontDir, f));
}

const W = 1920;
const H = 1080;
const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');
ctx.fillStyle = '#F5F8FF';
ctx.fillRect(0, 0, W, H);
ctx.fillStyle = '#4D6BFE';
ctx.textBaseline = 'middle';

const lines = [
  ['Sarasa Mono SC', '如果代码能长出海 DeepSeek 150 BPM'],
  ['Sarasa Mono J', '日本語のテスト'],
  ['Dela Gothic One', '電子'],
  ['Zen Maru Gothic', 'まるいテスト'],
  ['Shippori Mincho B1', '明朝のテスト'],
  ['DotGothic16', 'ドット 16'],
  ['Smiley Sans', '得意黑测试'],
  ['LXGW WenKai', '（这是一句心声）'],
];
const rowH = H / lines.length;
lines.forEach(([family, text], i) => {
  ctx.font = `64px "${family}"`;
  ctx.fillText(text, 80, rowH * i + rowH / 2);
});

writeFileSync(join(outDir, 'smoke.png'), canvas.toBuffer('image/png'));

const ff = spawn('ffmpeg', [
  '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', '60', '-i', '-',
  '-ss', '14', '-t', '2', '-i', join(root, 'assets', 'audio', '电子天使.mp3'),
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-c:a', 'aac', '-shortest',
  join(outDir, 'smoke.mp4'),
], { stdio: ['pipe', 'inherit', 'inherit'] });

const exited = once(ff, 'close');
const frame = Buffer.from(ctx.getImageData(0, 0, W, H).data.buffer);
for (let i = 0; i < 120; i++) {
  if (!ff.stdin.write(frame)) await once(ff.stdin, 'drain');
}
ff.stdin.end();
const [code] = await exited;
if (code !== 0) throw new Error(`ffmpeg exited with code ${code}`);
console.log('smoke ok');
