// 总览图：直接用引擎画若干时刻的缩略图拼成一张大图（审片、验收用，不用先出片）
// 用法：
//   node render/sheet.mjs --every 1 --from 0 --to 53 --out out/第07轮/总览.png        每 1 秒一张
//   node render/sheet.mjs --at 14.2 14.4 34.5 --out x.png                            指定时刻
//   node render/sheet.mjs --trans --out out/第07轮/转场.png                          每个转场窗口 6 张（timeline 的 TRANS_TABLE）
//   其他参数：--cols 6（列数）--w 480（每张宽度）--from/--to 也可以配合 --trans 只看一段
//   --rev opening=8   临时用上一版画（版本开关见 engine/rev.js），新旧对比各出一张
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { nodePlatform } from './platform-node.js';
import { initEngine, renderFrame, prepareFrame, W, H, FPS, DURATION } from '../engine/main.js';
import { transitionList } from '../engine/timeline.js';
import { setRev } from '../engine/rev.js';

function args() {
  const a = process.argv.slice(2), o = { at: [] };
  for (let i = 0; i < a.length; i++) {
    const k = a[i];
    if (k === '--at') { while (a[i + 1] && !a[i + 1].startsWith('--')) o.at.push(+a[++i]); }
    else if (k === '--trans') o.trans = true;
    else if (k.startsWith('--')) o[k.slice(2)] = a[++i];
  }
  return o;
}

await initEngine(nodePlatform);
const o = args();
setRev(o.rev);
const from = o.from ? +o.from : 0, to = o.to ? Math.min(DURATION, +o.to) : DURATION;
let times = o.at, cols = +(o.cols || 6);
if (o.trans) {
  times = [];
  for (const r of transitionList()) {
    if (r.w1 < from || r.w0 > to) continue;
    for (let k = 0; k < 6; k++) times.push(r.w0 + ((r.w1 - r.w0) * k) / 5);
  }
  cols = 6;
} else if (o.every) {
  times = [];
  for (let t = from; t < to; t += +o.every) times.push(Math.round(t * FPS) / FPS);
}
if (!times.length) { console.error('没有要画的时刻（--every / --at / --trans）'); process.exit(1); }
const { createCanvas } = await import('@napi-rs/canvas');
const canvas = createCanvas(W, H), ctx = canvas.getContext('2d');
const tw = +(o.w || 480), th = Math.round((tw * H) / W), rows = Math.ceil(times.length / cols);
const sheet = createCanvas(tw * cols, th * rows), sc = sheet.getContext('2d');
sc.fillStyle = '#000'; sc.fillRect(0, 0, sheet.width, sheet.height);
const a0 = performance.now();
for (const [i, t] of times.entries()) {
  // 帧号对齐，和出片取到的是同一帧
  const f = Math.min(Math.round(t * FPS), Math.round(DURATION * FPS) - 1);
  await prepareFrame(f / FPS);
  renderFrame(ctx, f / FPS);
  const x = (i % cols) * tw, y = Math.floor(i / cols) * th;
  sc.drawImage(canvas, x, y, tw, th);
  sc.fillStyle = 'rgba(0,0,0,0.7)'; sc.fillRect(x, y, 74, 22);
  sc.fillStyle = '#FFE14D'; sc.font = '16px sans-serif'; sc.fillText((f / FPS).toFixed(2), x + 5, y + 16);
  if (i % 20 === 19) process.stderr.write(`\r  ${i + 1}/${times.length}`);
}
const out = path.resolve(o.out || 'out/单帧/sheet.png');
await mkdir(path.dirname(out), { recursive: true });
await writeFile(out, sheet.encodeSync('png'));
console.log(`\n${times.length} 张 → ${out}（${((performance.now() - a0) / 1000).toFixed(1)} s）`);
