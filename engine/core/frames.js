// 视频原始画面（第十六轮，间奏二最后一小节"解码出来的成品图"）：scripts/video_frames.mjs 抽的一小段 JPG（只裁她所在的竖条）。
// vidFrame(id, vt)：视频时刻 vt（秒）最近的那一帧；没有抽帧文件时返回 null（镜头里要有后备画法）
// 第二十轮：加了 V11（L29 鼠标互动，整帧 1080p、175 张）。全部解码要一个多 GB，所以帧多（> 100 张）的视频：
//   出片（Node）时只把 JPG 原始字节留在内存里，镜头用 registerPrefetch 登记"某一时刻要哪一帧"，render.mjs / sheet.mjs 每画一帧之前
//   先 await prepareFrame(t)（main.js）把要用的帧解码进缓存（@napi-rs/canvas 只能异步解码），画面仍然逐帧确定；
//   浏览器预览先只记路径，用到时在后台加载、先画已经加载好的最近一帧（只影响预览）。帧少的（V10）照旧一次全部解码
import { ENV } from './env.js';
import { clamp } from './time.js';

const FR = new Map(), TR = new Map(), PREF = [];
let NOTIFY = null;
export const onFrameLoaded = fn => { NOTIFY = fn; }; // 预览页：后台加载完一帧就重画（暂停时也能看到）
export async function loadFrames() {
  for (const id of ['V10', 'V11_3']) { // 第二十四轮：V11_3（L29 新版，124 张 1890×1080）；旧的 V11 第二十六轮并开关 l29v24 以后不再用（build/frames/V11/ 留着没删）
    const f = `build/frames/${id}.json`;
    if (!(await ENV.P.exists(f))) continue;
    const meta = await ENV.P.loadJSON(f), big = meta.n > 100, lazy = big && !!ENV.P.decodeImage, async = big && !lazy, items = [];
    for (let i = 1; i <= meta.n; i++) {
      const p = `build/frames/${id}/${String(i).padStart(3, '0')}.jpg`;
      items.push(lazy ? await ENV.P.loadBin(p) : async ? p : await ENV.P.loadImage(p));
    }
    FR.set(id, { ...meta, items, lazy, async, cache: new Map(), pending: new Set() });
    const tf = `build/frames/${id}_track.json`; // 第二十轮：scripts/video_track.py 算的每帧人物包围盒
    if (await ENV.P.exists(tf)) TR.set(id, await ENV.P.loadJSON(tf));
  }
}
export const trackOf = id => TR.get(id) ?? null;
export const hasFrames = id => FR.has(id);
export const framesInfo = id => FR.get(id);
const indexOf = (m, vt) => (vt < m.t0 - 0.5 / m.fps ? null : clamp(Math.round((vt - m.t0) * m.fps), 0, m.n - 1));

// 镜头登记：fn(t) → [[视频编号, 视频时刻], …]（这一刻要用到的帧）
export const registerPrefetch = fn => PREF.push(fn);
export async function prefetchFrames(t) {
  for (const fn of PREF) for (const [id, vt] of fn(t)) {
    const m = FR.get(id), i = m && m.lazy ? indexOf(m, vt) : null;
    if (i == null || m.cache.has(i)) continue;
    m.cache.set(i, await ENV.P.decodeImage(m.items[i]));
    if (m.cache.size > 8) m.cache.delete(m.cache.keys().next().value); // 只留最近 8 帧（缓存不影响画面，只影响速度）
  }
}

function frameAt(m, i) {
  if (m.lazy) return m.cache.get(i) ?? null; // 出片：prepareFrame 已经解码好了
  if (m.async) { // 浏览器预览
    if (!m.cache.has(i) && !m.pending.has(i)) {
      m.pending.add(i);
      ENV.P.loadImage(m.items[i]).then(img => { m.cache.set(i, img); m.pending.delete(i); if (m.cache.size > 40) m.cache.delete(m.cache.keys().next().value); NOTIFY?.(); });
    }
    if (m.cache.has(i)) return m.cache.get(i);
    let best = null, bd = 1e9;
    for (const [k, img] of m.cache) if (Math.abs(k - i) < bd) { bd = Math.abs(k - i); best = img; }
    return best;
  }
  return m.items[i];
}
export function vidFrame(id, vt) {
  const m = FR.get(id);
  if (!m) return null;
  // 第十八轮：抽帧从 V10 13.1 s 提前到 11.9 s。另一台机器还没同步到新帧时，早于抽帧起点的时刻返回 null（镜头退回本色那一版），
  // 不再夹到第一帧——夹的话 88 撞上以后会定在 13.1 s 那一帧上约 1 s。晚于终点的仍然夹到最后一帧（转场里多画几帧不会跳）
  const i = indexOf(m, vt);
  return i == null ? null : frameAt(m, i);
}
