// 预览页：边听边看、拖动、按小节跳转、调试叠层。只在浏览器里运行
import { initEngine, renderFrame, SHOTS, DURATION, FPS } from './main.js';
import { browserPlatform } from './platform-browser.js';
import { barStart, pos, fmtTime } from './core/time.js';
import { BEAT, BAR } from './core/const.js';
import { lyricAt } from './core/data.js';
import { setRev } from './rev.js';
import { onFrameLoaded } from './core/frames.js';

const $ = id => document.getElementById(id);
const cv = $('c'), ctx = cv.getContext('2d'), ov = $('ov'), octx = ov.getContext('2d'), audio = $('audio');
audio.src = browserPlatform.url('assets/audio/电子天使.mp3');

// 验收链接可直接打开某一小节；?rev=opening=8 临时用上一版画（engine/rev.js）
const startBar = Number(new URLSearchParams(location.search).get('bar'));
setRev(new URLSearchParams(location.search).get('rev'));
let t = Number.isInteger(startBar) && startBar >= 1 && startBar <= 120 ? barStart(startBar) : 0;
let playing = false, debug = true, loop = null, dirty = true, ms = 0;
if (t > 0) $('bar-number').value = startBar;

await initEngine(browserPlatform);
$('loading').remove();
onFrameLoaded(() => { dirty = true; }); // V11 这类后台加载的视频帧到了就重画

const JUMPS = [['前奏', 1], ['L01', 10], ['间奏一', 34], ['L13', 42], ['ComfyUI', 66], ['间奏二', 74], ['L25', 91], ['尾奏', 107]];
for (const [name, bar] of JUMPS) {
  const b = document.createElement('button');
  b.textContent = name;
  b.onclick = () => seek(barStart(bar));
  $('jumps').append(b, ' ');
}

function seek(x) {
  t = Math.min(DURATION - 1 / FPS, Math.max(0, x));
  if (playing) audio.currentTime = t;
  dirty = true;
}
function toggle() {
  playing = !playing;
  if (playing) { audio.currentTime = t; audio.play(); } else audio.pause();
  $('play').textContent = playing ? '⏸ 暂停' : '▶ 播放';
}
$('play').onclick = toggle;
$('scrub').oninput = e => seek(+e.target.value);
$('go').onclick = () => seek(barStart(+$('bar-number').value));
audio.onended = () => { if (playing) toggle(); };

addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' && e.target.type === 'number') return;
  const step = e.shiftKey ? BEAT : 1 / FPS;
  if (e.code === 'Space') { e.preventDefault(); toggle(); }
  else if (e.key === 'ArrowRight') seek(t + step);
  else if (e.key === 'ArrowLeft') seek(t - step);
  else if (e.key === ']') seek(t + BAR);
  else if (e.key === '[') seek(t - BAR);
  else if (e.key === 'd' || e.key === 'D') { debug = !debug; dirty = true; }
  else if (e.key === 'l' || e.key === 'L') {
    const s = SHOTS.find(x => t >= x.t0 && t < x.t1);
    loop = loop ? null : [s.t0, s.t1];
    dirty = true;
  }
});

function drawOverlay(S) {
  octx.clearRect(0, 0, 1920, 1080);
  if (!debug) return;
  const L = lyricAt(S.t), sh = S.shot;
  const lines = [
    `${fmtTime(S.t)}   帧 ${S.frame}   ${S.bar}.${S.beat} +${S.sub.toFixed(2)}`,
    `镜头 ${sh.id} · ${sh.layout} · 小节 ${sh.bars[0]}–${sh.bars[1] - 1}${sh.done ? '' : '（占位）'}${loop ? ' · 循环中' : ''}`,
    `色调 ${S.pal.name}   歌词 ${L ? L.id + ' ' + L.chars.filter(c => c.t0 <= S.t).length + '/' + L.chars.length : '—'}   绘制 ${ms.toFixed(1)} ms`,
  ];
  octx.font = '22px Consolas, "Microsoft YaHei", monospace';
  octx.fillStyle = 'rgba(17,19,26,0.72)';
  octx.fillRect(12, 1080 - 12 - lines.length * 30 - 12, 820, lines.length * 30 + 12);
  octx.fillStyle = '#E6EAFF';
  lines.forEach((s, i) => octx.fillText(s, 24, 1080 - 12 - (lines.length - i - 1) * 30 - 18));
}

function tick() {
  if (playing) {
    t = audio.currentTime;
    if (loop && t >= loop[1]) { t = loop[0]; audio.currentTime = t; }
    dirty = true;
  }
  if (dirty) {
    try {
      const a = performance.now();
      const S = renderFrame(ctx, t);
      ms = performance.now() - a;
      drawOverlay(S);
      $('time').textContent = `${fmtTime(t)}  ·  ${S.bar}.${S.beat}`;
      $('scrub').value = t;
      $('shot').textContent = `${S.shot.id}${S.shot.done ? '' : '（占位）'}`;
    } catch (e) {
      // 单帧报错后仍允许拖动、跳转，避免整个预览失去响应。
      if (playing) toggle();
      console.error(e);
      $('time').textContent = fmtTime(t);
      $('shot').textContent = '绘制失败，可跳转到其他镜头';
    } finally {
      dirty = false;
    }
  }
  requestAnimationFrame(tick);
}
tick();

// 调试入口（控制台）：mv.seek(14.467)、mv.t
window.mv = { seek, toggle, get t() { return t; }, render: x => { seek(x); } };
