// Node 运行环境（出片用）：@napi-rs/canvas（Skia）。路径相对项目根目录
import { createCanvas, loadImage, GlobalFonts, Path2D } from '@napi-rs/canvas';
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const abs = p => path.join(ROOT, p);

export const nodePlatform = {
  kind: 'node',
  createCanvas: (w, h) => createCanvas(w, h),
  path2d: d => new Path2D(d),
  loadImage: async p => loadImage(await readFile(abs(p))),
  loadJSON: async p => JSON.parse(await readFile(abs(p), 'utf8')),
  loadText: async p => (await readFile(abs(p), 'utf8')).replace(/^﻿/, ''),
  loadBin: async p => new Uint8Array(await readFile(abs(p))), // 第十五轮：间奏二的分区图
  // 第二十轮：解码一张图（core/frames.js 用到哪一帧才解码，省内存；@napi-rs/canvas 只能异步解码）
  decodeImage: bytes => loadImage(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)),
  async exists(p) { try { await access(abs(p)); return true; } catch { return false; } },
  async registerFont(alias, p) {
    if (!GlobalFonts.registerFromPath(abs(p), alias)) throw new Error('字体注册失败：' + p);
  },
};
