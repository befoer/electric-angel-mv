// 视频封面（第二十八轮重做：用户的主图 assets/illust/封面主图.png，编辑排版的拼贴感，第一段晴空蓝；engine/shots/cover.js）：用引擎画一帧，出 PNG
// 用法：node render/cover.mjs        1920×1080 → out/封面/封面.png，外加一张缩略图核对图 → out/单帧/（用户第二十八轮：先只做一个尺寸看效果）
import { mkdir, writeFile } from 'node:fs/promises';
import { nodePlatform } from './platform-node.js';
import { initEngine, W, H } from '../engine/main.js';
import { makeState } from '../engine/core/state.js';
import { cover, COVER_T } from '../engine/shots/cover.js';

await initEngine(nodePlatform);
const { createCanvas, loadImage } = await import('@napi-rs/canvas');
const img = await loadImage('assets/illust/封面主图.png');
await mkdir('out/封面', { recursive: true });
await mkdir('out/单帧', { recursive: true });
const cv = createCanvas(W, H), ctx = cv.getContext('2d');
cover(ctx, makeState(COVER_T), { img });
await writeFile('out/封面/封面.png', cv.encodeSync('png'));
console.log('out/封面/封面.png');
// 缩略图核对：首页信息流里的大小（240×135）和 480×270 并排
const sh = createCanvas(760, 300), sc = sh.getContext('2d');
sc.fillStyle = '#FFFFFF'; sc.fillRect(0, 0, sh.width, sh.height);
sc.drawImage(cv, 10, 10, 240, 135); sc.drawImage(cv, 270, 10, 480, 270);
await writeFile('out/单帧/封面_缩略图核对.png', sh.encodeSync('png'));
console.log('out/单帧/封面_缩略图核对.png');
