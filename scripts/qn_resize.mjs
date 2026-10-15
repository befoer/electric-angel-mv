// 第二十三轮：2:44 L31 用的"同一句 prompt 的一批种子"（用户放在 assets/illust/QN/，ComfyUI 原名 1344² PNG）。
// 缩成 768² 存到 build/illust_q/Q01.png …（引擎一次全部解码，原图 31 张要 220 MB 内存，缩小后约 70 MB），按文件名排序编号，
// 再在 assets/illust/manifest.json 里登记 Q01 … → build/illust_q/Qnn.png（core/portrait.js 认 build/ 开头的路径）。
// SKIP 里的是底色不一样的（ComfyUI_16674_ 是灰白底，其余都是浅天蓝底，快切时会跳一下）。素材换了就重跑：node scripts/qn_resize.mjs
// 第二十五轮：用户另出了一条图生图链 Q2.png … Q7.png（从 Q01 起依次降低重绘幅度，画面一步步稳定下来，L31 最后几张用）。
// Q1.png 就是用户把那批种子里的 ComfyUI_16694_ 改了名（链的起点），它仍按原来的位置留在种子里（还是 Q20，编号不变）；
// 链上的 7 张另外缩成 build/illust_q/QC1.png … QC7.png、登记成 QC1 … QC7（QC1 和 Q20 是同一张）
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const { createCanvas, loadImage } = await import('@napi-rs/canvas');

const SRC = 'assets/illust/QN', OUT = 'build/illust_q', SIZE = 768, SKIP = new Set(['ComfyUI_16674_.png']), CHAIN = /^Q(\d+)\.png$/i, RENAMED = { 'Q1.png': 'ComfyUI_16694_.png' };
mkdirSync(OUT, { recursive: true });
const all = readdirSync(SRC).filter(f => f.toLowerCase().endsWith('.png') && !SKIP.has(f)).sort();
const key = f => RENAMED[f] ?? f, files = all.filter(f => !CHAIN.test(f) || RENAMED[f]).sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0)), chain = all.filter(f => CHAIN.test(f));
const man = JSON.parse(readFileSync('assets/illust/manifest.json', 'utf8'));
for (const k of Object.keys(man)) if (/^QC?\d\d?$/.test(k)) delete man[k];
async function put(id, f) {
  const img = await loadImage(readFileSync(`${SRC}/${f}`)), c = createCanvas(SIZE, SIZE), g = c.getContext('2d');
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, SIZE, SIZE);
  writeFileSync(`${OUT}/${id}.png`, c.toBuffer('image/png'));
  man[id] = `build/illust_q/${id}.png`;
  console.log(`${id} ← ${f}`);
}
let i = 0;
for (const f of files) await put(`Q${String(++i).padStart(2, '0')}`, f);
for (const f of chain) await put(`QC${f.match(CHAIN)[1]}`, f);
man._说明 = String(man._说明).replace(/。?第二十三轮：Q01.*$/, '') + `。第二十三轮：Q01–Q${String(i).padStart(2, '0')} 由 scripts/qn_resize.mjs 从 assets/illust/QN 缩成 768² 存到 build/illust_q（跳过灰底的 ComfyUI_16674_）` +
  (chain.length ? `；第二十五轮：图生图链 Q1–Q7.png 登记成 QC1–QC7（Q1.png 是改了名的 ComfyUI_16694_，在种子里仍是 Q20）` : '');
writeFileSync('assets/illust/manifest.json', JSON.stringify(man, null, 2) + '\n');
console.log(`${i} 张种子 + ${chain.length} 张图生图链 → ${OUT}，已登记 manifest`);
