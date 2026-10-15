// 加载分析数据、歌词、资料表（项目方案 §3.1）
import { ENV } from './env.js';
import { FPS, STEP } from './const.js';
import { clamp } from './time.js';

export const D = { ready: false };
const LYRICS_TXT = '资料/电子天使-歌词.txt';

export async function loadData() {
  const P = ENV.P;
  const [beats, bars, intro, fx, facts, timing, text, vs, onsets] = await Promise.all([
    P.loadJSON('build/beats.json'),
    P.loadJSON('build/bars.json'),
    P.loadJSON('build/intro_hits.json'),
    P.loadJSON('data/vocal_fx_onsets.json'),
    P.loadJSON('data/facts.json'),
    P.loadJSON('data/lyrics_timing.json'),
    // 歌词文本有版权，公开仓库里不带（第二十八轮）：没有这个文件时每个字用 ♪ 顶替（字数照对时数据），画面照常能出
    P.exists(LYRICS_TXT).then(ok => (ok ? P.loadText(LYRICS_TXT) : null)),
    P.loadJSON('build/vocal_spec.json'),
    P.loadJSON('data/vocal_onsets.json'),
  ]);
  const raw = atob(vs.data);
  D.vspec = { n: vs.n, bands: vs.bands, edges: vs.edges, data: Uint8Array.from(raw, c => c.charCodeAt(0)) };
  const n = beats.frames.length;
  const A = {};
  for (const k of ['rms', 'low', 'mid', 'high', 'onset']) A[k] = new Float32Array(n);
  beats.frames.forEach((f, i) => { for (const k in A) A[k][i] = f[k]; });
  D.audio = A; D.nAudio = n;
  D.bars = bars;
  D.introHits = intro.beats;
  D.fxOnsets = fx.onsets;
  D.facts = facts;
  D.lyrics = buildLyrics(text, timing); // 对时数据（stable-ts）那一版
  D.onsets = {};
  for (const [id, a] of Object.entries(onsets)) {
    if (id.startsWith('_')) continue;
    const L = D.lyrics.byId[id];
    if (!L || L.chars.length !== a.length) throw new Error(`vocal_onsets.json：${id} 有 ${a.length} 个数，歌词是 ${L ? L.chars.length : 0} 个字`);
    D.onsets[id] = a;
  }
  D.estimated = onsets._估计 ?? {};
  // 改起音时要能回滚的话：把旧数存成 vocal_onsets.json 的 _旧NN，这里按开关换一套（写法见第二十四轮的 on24，第二十六轮并开关时删了）
  D.lyricsMeas = measuredLyrics(D.lyrics, D.onsets);
  // 第二十二轮：尾奏制作信息里滚动的修改意见（scripts/credits_prompt.mjs 生成）
  D.creditsPrompt = (await P.exists('data/credits_prompt.json')) ? (await P.loadJSON('data/credits_prompt.json')).lines : [];
  D.ready = true;
}

// 逐帧音频特征（beats.json，60 fps）：rms / low / mid / high / onset
export function feat(t) {
  const i = clamp(Math.round(t * FPS), 0, D.nAudio - 1), A = D.audio;
  return { rms: A.rms[i], low: A.low[i], mid: A.mid[i], high: A.high[i], onset: A.onset[i] };
}

// 人声频谱（build/vocal_spec.json，60 fps × 32 频段，低 → 高）：返回 Float32Array(32)，各值 0..1
export function vspec(t, out = new Float32Array(32)) {
  const V = D.vspec, i = clamp(Math.round(t * FPS), 0, V.n - 1);
  for (let b = 0; b < V.bands; b++) out[b] = V.data[i * V.bands + b] / 255;
  return out;
}

// 小节能量系数 ×0.4–×1.4（视觉方案 §4.6），由鼓 / 贝斯 / 合成器的 dB 求平均振幅
export function energy(bar) {
  const b = D.bars[bar - 1];
  if (!b) return 0.4;
  const amp = db => Math.pow(10, Math.min(0, db) / 20);
  const e = (amp(b.drums) + amp(b.bass) + amp(b.other)) / 3;
  return 0.4 + clamp(e);
}

// 前奏逐拍实测强度（build/intro_hits.json）
export function introStrength(bar, beat) {
  const h = D.introHits.find(x => x.bar === bar && x.beat === beat);
  return h ? h.strength : 0;
}

// facts.json：fact('n_routed_experts') 取当前模型，fact('context_length', 'v3') 取 V3
export function fact(key, which = 'current') {
  const v = D.facts[key];
  return v && v[which] ? v[which].value : null;
}

// ---------------------------------------------------------------- 歌词

// 文字只来自 资料/电子天使-歌词.txt，时间来自 data/lyrics_timing.json（视觉方案 §八）
function buildLyrics(text, timing) {
  if (text == null) console.warn(`没有 ${LYRICS_TXT}：歌词的字都用 ♪ 顶替（格式见 资料/README.md）`);
  const rows = text == null ? [] : text.split(/\r?\n/).filter(s => s.trim() !== '');
  const jp = text == null ? timing.lines.map(L => '♪'.repeat(L.chars.length)) : rows.filter((_, i) => i % 2 === 0)
    .map(s => s.replace(/"e;/g, '"').replace(/\([^)]*\)/g, '').replace(/[ 　]/g, ''));
  const lines = timing.lines.map((L, i) => {
    const chars = [...jp[i]];
    if (chars.length !== L.chars.length) throw new Error(`${L.id}: 歌词字数 ${chars.length} 与对时数据 ${L.chars.length} 不一致`);
    // 句尾的逐字时间可能越过下一句开头：整句按比例压缩进 [start, 下一句 start_q − 一个十六分音符的 1/5)
    const next = timing.lines[i + 1];
    const lim = next ? next.start_q - STEP * 0.2 : L.end;
    const s0 = L.chars[0][0], e0 = L.chars[L.chars.length - 1][1];
    const k = e0 > lim && e0 > s0 ? (lim - s0) / (e0 - s0) : 1;
    const map = x => s0 + (x - s0) * k;
    return {
      id: L.id, idx: i, text: jp[i], start: L.start, startQ: L.start_q,
      end: Math.min(L.end, lim),
      chars: chars.map((c, j) => ({ c, t0: map(L.chars[j][0]), t1: map(L.chars[j][1]) })),
    };
  });
  const byId = Object.fromEntries(lines.map(l => [l.id, l]));
  return { lines, byId };
}

// 第十九轮（用户：任务单 10 做完了，全片换成实测的时间）：开关 on19 = 19 时，整片的歌词时刻都用实测起音（measuredLyrics），
// 18 = 对时数据。lyric / keyword / lyricAt 都按开关取，所以小字幕、每个镜头里卡字的动作一起换；开关要在画帧时读
// 第二十一轮：on19 并进来了（全片用实测起音）；之后 on20 / on21 / on22 / on24（第二十六轮）也都并了
const LY = () => D.lyricsMeas;
const ON = () => D.onsets;
export const lyric = id => LY().byId[id];
export const rawLyric = id => D.lyrics.byId[id]; // 不管开关，永远是对时数据（调试面板对比用）

// 时刻 t 正在唱的那句（在 [startQ, 下一句 startQ) 内且未过本句 end + 1 拍）
export function lyricAt(t) {
  const L = LY().lines;
  for (let i = L.length - 1; i >= 0; i--) {
    if (t >= L[i].startQ) return t <= L[i].end + 0.4 ? L[i] : null;
  }
  return null;
}

// 一句里 [from, to) 这几个字；每个字带唱到的时刻
export const keyword = (id, from, to) => lyric(id).chars.slice(from, to);

// 第十八轮：第 i 个字真正唱出来的时刻——data/vocal_onsets.json 里人声分轨实测的起音，没测的字退回对时数据的 t0。
// 对时数据（stable-ts）有好几句晚 0.1–0.9 s（一个汉字唱好几拍、整句错一个音），字或动作要卡在某个音上时用它
export const onset = (id, i) => ON()[id]?.[i] ?? D.lyrics.byId[id].chars[i].t0;

// 第十九轮：实测版的歌词表。每个字的 t0 换成实测起音；没测的字（标点、引号、整句没测的 L01）：
// 标点跟着后一个实测的字出来（和对时数据里一样），别的字在前后两个实测的字之间按字序插值，整句都没测就照旧用对时数据。
// t1 = 同一句下一个字的 t0（最后一个字照对时数据的字长）；句子的 start / startQ / end 跟着第一个 / 最后一个字挪
const PUNCT = /[、。，,！!？?"“”「」『』…・\s]/;
function measuredLyrics(rawTable, onsets) {
  const lines = rawTable.lines.map(L => {
    const m = onsets[L.id];
    if (!m || m.every(v => v == null)) return { ...L, kinds: L.chars.map(() => 'data') };
    const n = L.chars.length, t = m.slice(), kinds = m.map(v => (v == null ? null : 'meas'));
    for (let j = 0; j < n; j++) {
      if (t[j] != null) continue;
      let a = j - 1, b = j + 1;
      while (a >= 0 && m[a] == null) a--;
      while (b < n && m[b] == null) b++;
      if (PUNCT.test(L.chars[j].c)) { t[j] = b < n ? m[b] : a >= 0 ? m[a] : L.chars[j].t0; kinds[j] = 'punct'; continue; }
      t[j] = a >= 0 && b < n ? m[a] + ((m[b] - m[a]) * (j - a)) / (b - a) : b < n ? m[b] : a >= 0 ? m[a] + 0.1 * (j - a) : L.chars[j].t0;
      kinds[j] = 'interp';
    }
    const chars = L.chars.map((c, j) => ({ c: c.c, t0: t[j], t1: j < n - 1 ? Math.max(t[j], t[j + 1]) : t[j] + Math.max(0.1, c.t1 - c.t0) }));
    const d0 = t[0] - L.chars[0].t0, dn = t[n - 1] - L.chars[n - 1].t0;
    return { ...L, start: t[0], startQ: L.startQ + d0, end: Math.max(L.end + dn, chars[n - 1].t1), chars, kinds };
  });
  return { lines, byId: Object.fromEntries(lines.map(l => [l.id, l])) };
}

// 调试面板用：第 i 个字的对时数据 / 实测 / 现在用的时刻，和它是怎么来的（meas 实测 · est 估计 · interp 插值 · punct 标点跟后字 · data 没测）
export function onsetInfo(id, i) {
  const raw = D.lyrics.byId[id].chars[i].t0, M = D.lyricsMeas.byId[id], est = (D.estimated[id] ?? []).includes(i);
  const kind = est ? 'est' : M.kinds[i];
  return { raw, meas: M.chars[i].t0, used: lyric(id).chars[i].t0, kind };
}
