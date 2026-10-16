// 镜头之间的转场（视觉方案 §4.7，第六轮）。renderFrame 在转场窗口里把前后两个镜头分别画进缓冲 A、B，再用这里的函数合成
// 每个函数 (ctx, A, B, u, S, p)：A、B 是 1920×1080 画布，u 0→1 是转场进度，p 是 timeline 里写的参数
import { W, H, BRAND } from './const.js';
import { clamp, lerp, smooth, easeIn, easeOut, easeOutBack } from './time.js';
import { rnd, hash } from './rand.js';
import { badTV, flash } from './fx.js';
import { pooled, softCopy } from './cam.js';
import { css, mix } from './color.js';
import { rrect } from './ui.js';
import { fonts } from './glyphs.js';

// 推进穿过一个矩形：B 一开始就在 A 的 rect 里（像显示器屏幕），镜头推进直到 rect 撑满画面
// p.rect [x, y, w, h]（A 的坐标）；p.ease 'smooth'|'in'；p.fade A 的外部是否淡出；p.frame 画在 rect 外沿的框（函数）
function portal(ctx, A, B, u, S, p) {
  const [rx, ry, rw, rh] = p.rect || [W / 2 - 80, H / 2 - 45, 160, 90];
  const e = (p.ease === 'in' ? easeIn : p.ease === 'out' ? easeOut : smooth)(u);
  const sEnd = Math.max(W / rw, H / rh), s = Math.pow(sEnd, e);
  // 目标中心在屏幕上从原位直线移到画面中央，同时放大（目标始终留在画面里）
  const tx = rx + rw / 2, ty = ry + rh / 2, m = easeOut(clamp(e * 1.25));
  ctx.save();
  ctx.translate(lerp(tx, W / 2, m), lerp(ty, H / 2, m)); ctx.scale(s, s); ctx.translate(-tx, -ty);
  ctx.drawImage(A, 0, 0);
  ctx.save(); ctx.beginPath();
  if (p.shape === 'circle') ctx.arc(rx + rw / 2, ry + rh / 2, lerp(Math.min(rw, rh) / 2, (Math.hypot(rw, rh) / 2) * 1.03, easeIn(e)), 0, Math.PI * 2);
  else ctx.rect(rx, ry, rw, rh);
  ctx.clip();
  ctx.drawImage(B, rx + rw / 2 - (W * Math.max(rw / W, rh / H)) / 2, ry + rh / 2 - (H * Math.max(rw / W, rh / H)) / 2, W * Math.max(rw / W, rh / H), H * Math.max(rw / W, rh / H));
  ctx.restore();
  if (p.frame) p.frame(ctx, [rx, ry, rw, rh], u);
  ctx.restore();
  if (p.flash) flash(ctx, p.flash * Math.max(0, 1 - Math.abs(u - 0.85) / 0.15));
}

// 甩镜头：A 向 dir 方向甩出，B 从反方向甩进来，带动态模糊和速度线。p.dir 'left'|'right'|'up'|'down'
function whip(ctx, A, B, u, S, p) {
  const d = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[p.dir || 'left'];
  const e = smooth(u), span = d[0] ? W : H;
  const v = Math.sin(Math.PI * u); // 速度包络，中间最快
  const draw = (img, o) => {
    for (let k = 0; k < 4; k++) {
      const trail = k * 38 * v;
      ctx.globalAlpha = k === 0 ? 1 : 0.22;
      ctx.drawImage(img, d[0] * (o - trail), d[1] * (o - trail));
    }
    ctx.globalAlpha = 1;
  };
  ctx.save();
  draw(A, e * span);
  draw(B, (e - 1) * span);
  // 速度线
  ctx.fillStyle = css('#FFFFFF', 0.7 * v);
  for (let i = 0; i < 26; i++) {
    const pos = rnd(i, 3) * (d[0] ? H : W), len = 200 + rnd(i, 4) * 600, at = ((rnd(i, 5) + u * 3) % 1) * (span + len) - len;
    if (d[0]) ctx.fillRect(at, pos, len, 2 + (i % 3)); else ctx.fillRect(pos, at, 2 + (i % 3), len);
  }
  ctx.restore();
}

// 形状展开：B 从 (x, y) 处的圆 / 心形里长出来，边缘一圈白线 + 线色。p.shape 'circle'|'heart'
// p.at(t) → { x, y }：中心跟着画面里的元素走（第十一轮）；p.ease 'burst'：先快速弹开一小圈（跟按键同步），再慢慢长、最后加速撑满
function iris(ctx, A, B, u, S, p) {
  const c = p.at ? p.at(S.t) : p;
  const x = c.x ?? W / 2, y = c.y ?? H / 2;
  const e = p.ease === 'burst' ? 0.09 * easeOutBack(clamp(u / 0.1), 2) + 0.91 * Math.pow(clamp((u - 0.08) / 0.92), 2.4) : easeIn(u) * 0.35 + smooth(u) * 0.65;
  const R = e * Math.hypot(Math.max(x, W - x), Math.max(y, H - y)) * (p.shape === 'heart' ? 1.9 : 1.05);
  ctx.drawImage(A, 0, 0);
  ctx.save();
  if (p.shape === 'heart') {
    ctx.translate(x - R, y - R * 0.95);
    ctx.beginPath(); heartOutline(ctx, 2 * R, 2 * R);
  } else { ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); }
  ctx.restore();
  ctx.save(); ctx.clip();
  ctx.drawImage(B, 0, 0);
  ctx.restore();
  ctx.save();
  if (p.glow) for (const [lw, a] of [[46, 0.1], [28, 0.22]]) { ctx.lineWidth = lw; ctx.strokeStyle = css(p.color, a); ctx.stroke(); } // 第十二轮：辉光（示波器的心撑开时）
  ctx.lineWidth = 14; ctx.strokeStyle = '#FFFFFF'; ctx.stroke();
  ctx.lineWidth = 5; ctx.strokeStyle = p.color || S.pal.line; ctx.stroke();
  ctx.restore();
}
// 心形路径（不 fill，给 clip / stroke 用）
function heartOutline(c, w, h) {
  c.moveTo(w / 2, h * 0.28);
  c.bezierCurveTo(w * 0.5, h * 0.05, w * 0.02, h * 0.02, w * 0.02, h * 0.35);
  c.bezierCurveTo(w * 0.02, h * 0.62, w * 0.35, h * 0.78, w / 2, h * 0.98);
  c.bezierCurveTo(w * 0.65, h * 0.78, w * 0.98, h * 0.62, w * 0.98, h * 0.35);
  c.bezierCurveTo(w * 0.98, h * 0.02, w * 0.5, h * 0.05, w / 2, h * 0.28);
  c.closePath();
}

// 马赛克：A 的块越来越大，过半换成 B，块再变小
function pixel(ctx, A, B, u, S, p) {
  const img = u < 0.5 ? A : B, m = u < 0.5 ? u * 2 : (1 - u) * 2;
  const block = Math.max(1, Math.round(1 + Math.pow(m, 1.6) * (p.max || 64)));
  if (block <= 1) ctx.drawImage(img, 0, 0);
  else {
    const w = Math.ceil(W / block), h = Math.ceil(H / block), cv = pooled('pix', Math.ceil(W / 2), Math.ceil(H / 2)), c = cv.getContext('2d');
    c.imageSmoothingEnabled = true;
    c.clearRect(0, 0, w + 1, h + 1);
    c.drawImage(img, 0, 0, w, h);
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.drawImage(cv, 0, 0, w, h, 0, 0, w * block, h * block);
    ctx.restore();
  }
  if (p.overlay) { ctx.save(); p.overlay(ctx, S, u); ctx.restore(); } // 第二十二轮：马赛克上面可以叠一个跨镜头的元素（L04 的心 → L05 的 0）
}

// 斜条（///）擦除：B 从一组斜条里长出来，条边是柠黄（Kira 式的斜线装饰）
function blinds(ctx, A, B, u, S, p) {
  const period = p.period || 140, slant = 0.55, e = smooth(u), wd = period * e;
  ctx.drawImage(A, 0, 0);
  const n = Math.ceil((W + H * slant) / period) + 2;
  ctx.save();
  ctx.beginPath();
  for (let i = -1; i < n; i++) {
    const x0 = i * period - H * slant + (i % 2 ? 0 : 0);
    const lag = clamp(e * 1.4 - (i / n) * 0.4);
    const w = period * lag;
    ctx.moveTo(x0, H); ctx.lineTo(x0 + H * slant, 0); ctx.lineTo(x0 + H * slant + w, 0); ctx.lineTo(x0 + w, H); ctx.closePath();
  }
  ctx.save(); ctx.clip(); ctx.drawImage(B, 0, 0); ctx.restore();
  ctx.lineWidth = 6; ctx.strokeStyle = S.pal.acc[1]; ctx.globalAlpha = 1 - e * 0.7; ctx.stroke();
  ctx.restore();
}

// 信号崩坏：A 越来越花，中间一下白噪，B 再慢慢调准
function tv(ctx, A, B, u, S, p) {
  const img = u < 0.5 ? A : B, amt = u < 0.5 ? u * 2 : (1 - u) * 2;
  ctx.fillStyle = S.pal.bg; ctx.fillRect(0, 0, W, H);
  badTV(ctx, img, 0, 0, W, H, amt, S.t, { rows: 3, seed: 5, snow: 2 });
  flash(ctx, (p.flash ?? 0.25) * Math.max(0, 1 - Math.abs(u - 0.5) / 0.08)); // 第九轮 R4：p.flash 0 = 不闪
}

// 旋转甩出：A 旋转放大淡出，B 从反方向转进来（摇晃的段落用）
function spin(ctx, A, B, u, S, p) {
  const e = smooth(u), ang = (p.angle || 0.5) * (p.dir || 1);
  const put = (img, a, s, alpha) => {
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.translate(W / 2, H / 2); ctx.rotate(a); ctx.scale(s, s); ctx.translate(-W / 2, -H / 2);
    ctx.drawImage(img, 0, 0); ctx.restore();
  };
  ctx.fillStyle = S.pal.bg; ctx.fillRect(0, 0, W, H);
  put(B, -ang * (1 - e), 1 + 0.4 * (1 - e), clamp(e * 1.6));
  put(A, ang * e, 1 + 0.6 * e, 1 - clamp((e - 0.3) * 1.8));
}

// 碎开：A 碎成方块向外飞散，露出后面的 B
function shards(ctx, A, B, u, S, p) {
  ctx.drawImage(B, 0, 0);
  const nx = p.nx || 8, ny = p.ny || 5, sw = W / nx, sh = H / ny, cx = p.x ?? W / 2, cy = p.y ?? H / 2;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const delay = rnd(i, j, 1) * 0.3, a = clamp((u - delay) / (1 - delay));
    if (a >= 1) continue;
    const x = (i + 0.5) * sw, y = (j + 0.5) * sh, dx = x - cx, dy = y - cy, dl = Math.hypot(dx, dy) || 1;
    const v = easeIn(a) * (900 + rnd(i, j, 2) * 700);
    ctx.save();
    ctx.globalAlpha = 1 - easeIn(a);
    ctx.translate(x + (dx / dl) * v, y + (dy / dl) * v + 300 * a * a);
    ctx.rotate((rnd(i, j, 3) - 0.5) * 4 * a);
    ctx.scale(1 - 0.4 * a, 1 - 0.4 * a);
    ctx.drawImage(A, i * sw, j * sh, sw, sh, -sw / 2, -sh / 2, sw, sh);
    ctx.restore();
  }
}

// 叠化：A 淡出、B 淡入（第三段的低谷用；p.color 时先淡到这个颜色再淡出来）
function fade(ctx, A, B, u, S, p) {
  const e = smooth(u);
  if (p.color) {
    ctx.drawImage(u < 0.5 ? A : B, 0, 0);
    ctx.globalAlpha = 1 - Math.abs(u - 0.5) * 2; ctx.fillStyle = p.color; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    return;
  }
  ctx.drawImage(A, 0, 0); ctx.globalAlpha = e; ctx.drawImage(B, 0, 0); ctx.globalAlpha = 1;
}

// 打开应用（第九轮，video-shotcraft shot-transitions F 式「穿窗」）：A 里的图标（p.rect，圆角 p.radius）长成全屏，
// 位置、大小、圆角一起插值；框里是 B（按框 cover 缩放，所以框撑满时 B 正好 1:1）；图标原来的脸前半段淡掉；A 在后面放大变暗
function appOpen(ctx, A, B, u, S, p) {
  const [rx, ry, rw, rh] = p.rect, e = smooth(u), r0 = p.radius ?? 0;
  const x = lerp(rx, 0, e), y = lerp(ry, 0, e), w = lerp(rw, W, e), h = lerp(rh, H, e), r = lerp(r0, 0, e);
  const cx = rx + rw / 2, cy = ry + rh / 2, s = 1 + 0.18 * e;
  ctx.save();
  ctx.translate(cx, cy); ctx.scale(s, s); ctx.translate(-cx, -cy);
  ctx.drawImage(A, 0, 0);
  ctx.restore();
  ctx.fillStyle = css(p.dimColor ?? '#04060D', (p.dim ?? 0.45) * e); ctx.fillRect(0, 0, W, H); // 亮场里用浅色压（第十一轮）
  ctx.save();
  rrect(ctx, x, y, w, h, r); ctx.clip();
  const k = Math.max(w / W, h / H), bw = W * k, bh = H * k;
  ctx.drawImage(B, x + w / 2 - bw / 2, y + h / 2 - bh / 2, bw, bh);
  const fa = clamp(1 - u * 3);
  if (fa > 0) { ctx.globalAlpha = fa; ctx.drawImage(A, rx, ry, rw, rh, x, y, w, h); ctx.globalAlpha = 1; }
  ctx.restore();
}

// 虚焦接力（第九轮，shot-transitions C 式）：A 慢慢失焦、轻微放大淡出，B 从失焦收回清楚；两边错开一点起跑，焦点当剪辑点
function focus(ctx, A, B, u, S, p) {
  const ea = smooth(clamp(u / 0.75)), eb = smooth(clamp((u - 0.2) / 0.8)), k = p.blur ?? 10;
  const soft = (img, amt, slot) => (amt < 0.05 ? img : softCopy(img, 1 + amt * k, slot));
  ctx.save();
  const sa = 1 + 0.05 * ea;
  ctx.translate(W / 2, H / 2); ctx.scale(sa, sa); ctx.translate(-W / 2, -H / 2);
  ctx.drawImage(soft(A, ea, 'fa'), 0, 0, W, H);
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = eb;
  const sb = 1.05 - 0.05 * eb;
  ctx.translate(W / 2, H / 2); ctx.scale(sb, sb); ctx.translate(-W / 2, -H / 2);
  ctx.drawImage(soft(B, 1 - eb, 'fb'), 0, 0, W, H);
  ctx.restore();
}

// 前景遮挡隐形切（第九轮，transition-hidden-cut A 式）：一块超画幅的半透明面板（p.color）带残影横扫过画面，
// 在它盖满的那几帧里 A 换成 B；背景被"风"带一下（A 往扫掠方向拖，B 从反侧回稳）。p.dir 1 往右 / -1 往左
function sweep(ctx, A, B, u, S, p) {
  const dir = p.dir ?? 1, cut = 0.5, push = 40;
  const img = u < cut ? A : B, off = u < cut ? push * easeIn(u / cut) : -push * (1 - easeOut((u - cut) / (1 - cut)));
  ctx.drawImage(img, dir * off, 0);
  // 面板：宽 2.2 屏，从画外扫到画外；中点盖满画面
  const pw = W * 2.2, px = lerp(-pw, W, u), x = dir > 0 ? px : W - px - pw;
  for (let k = 3; k >= 0; k--) {
    const lag = k * 0.035 * dir * W;
    ctx.globalAlpha = k ? 0.12 : 1;
    const g = ctx.createLinearGradient(x - lag, 0, x - lag + pw, 0);
    const c = p.color || '#EEF2FF';
    g.addColorStop(0, css(c, 0)); g.addColorStop(0.18, css(c, 1)); g.addColorStop(0.82, css(c, 1)); g.addColorStop(1, css(c, 0));
    ctx.fillStyle = g; ctx.fillRect(x - lag, 0, pw, H);
  }
  ctx.globalAlpha = 1;
  // 面板上的细节：几条横线和一个小标签，读起来是一块"界面"而不是一片白
  const lx = x + pw * 0.5 - W / 2;
  ctx.fillStyle = css(S.pal.line, 0.35);
  for (let i = 0; i < 6; i++) ctx.fillRect(lx + 200 + i * 40, 300 + i * 90, 900 - i * 60, 3);
  ctx.fillStyle = css(BRAND, 0.8); ctx.fillRect(lx + 200, 240, 160, 8);
}

// 显示器关机（第九轮，ComfyUI 显存炸了 → 间奏二）：A 压成一条亮横线（变亮），横线再缩成一个点、熄灭；
// 背景是 B 的第一帧压到很暗，后半段 B 慢慢亮起来。藏切点在亮线最细的那几帧（transition-hidden-cut 的同族）
function crtOff(ctx, A, B, u, S, p) {
  const sq = easeIn(clamp(u / 0.45)), shrink = easeIn(clamp((u - 0.42) / 0.2)), bIn = smooth(clamp((u - 0.55) / 0.45));
  ctx.fillStyle = '#05060A'; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = bIn; ctx.drawImage(B, 0, 0); ctx.globalAlpha = 1;
  if (shrink >= 1) return;
  const h = Math.max(2, H * (1 - sq)), w = W * (1 - shrink * 0.995);
  ctx.save();
  ctx.translate(W / 2, H / 2);
  if (sq < 1) { ctx.globalAlpha = 1 - 0.3 * sq; ctx.drawImage(A, -w / 2, -h / 2, w, h); ctx.globalAlpha = 1; }
  ctx.fillStyle = css('#FFFFFF', 0.85 * sq); ctx.fillRect(-w / 2, -h / 2, w, h);   // 越压越亮
  const ga = sq * (1 - shrink), band = ctx.createLinearGradient(0, -30, 0, 30); // 亮线上下一层很窄的光晕
  band.addColorStop(0, 'rgba(221,232,255,0)'); band.addColorStop(0.5, css('#DDE8FF', 0.55 * ga)); band.addColorStop(1, 'rgba(221,232,255,0)');
  ctx.fillStyle = band; ctx.fillRect(-w / 2 - 20, -30, w + 40, 60);
  ctx.fillStyle = css('#FFFFFF', ga); ctx.fillRect(-w / 2, -1.5, w, 3);
  ctx.restore();
}

// 人物先行的推进（第十一轮，L02 → L03）：B 缩小放进 A 的 p.rect 里（像 portal），但一开始只露出 B 的 p.keep 区域（下一个镜头的人物），
// 从右边弹进来；u > p.split 后镜头往 rect 推进，B 的其余部分透明度跟着推进慢慢升到 1。rect 撑满画面时正好就是 B
function charPortal(ctx, A, B, u, S, p) {
  const [rx, ry, rw, rh] = p.rect, [kx, ky, kw, kh] = p.keep, split = p.split ?? 0.3;
  const k = rw / W, ui = clamp(u / split), uz = clamp((u - split) / (1 - split));
  const e = uz < 0.5 ? 16 * uz ** 5 : 1 - (-2 * uz + 2) ** 5 / 2; // 五次缓入缓出：起步慢、中段快、落定软
  const sEnd = W / rw, s = Math.pow(sEnd, e), tx = rx + rw / 2, ty = ry + rh / 2, m = e;
  ctx.save();
  ctx.translate(lerp(tx, W / 2, m), lerp(ty, H / 2, m)); ctx.scale(s, s); ctx.translate(-tx, -ty);
  ctx.drawImage(A, 0, 0);
  const rest = smooth(clamp((uz - 0.1) / 0.7));
  // 第十四轮（用户：0:20 转场完成后上一个镜头的内容停在那里，然后一下子消失）：B 以前只画在 A 的卡片里（p.clip），卡片外面的 A
  // 一直留到转场最后一帧才突然换掉。推进的后半段让 B 也在卡片外面慢慢盖上来（推进到头时已经完全盖住），A 是被淡掉的
  const outside = p.only && p.clip ? smooth(clamp((uz - 0.35) / 0.6)) : 0;
  if (outside > 0) { ctx.save(); ctx.beginPath(); ctx.rect(rx, ry, rw, rh); ctx.clip(); ctx.globalAlpha = outside; ctx.drawImage(B, rx, ry, rw, rh); ctx.restore(); }
  if (rest > 0) {
    ctx.save();
    if (p.only && p.clip) { const [cx, cy, cw, ch, cr] = p.clip; rrect(ctx, cx, cy, cw, ch, cr ?? 10); ctx.clip(); }
    ctx.beginPath(); ctx.rect(rx, ry, rw, rh); ctx.clip();
    ctx.globalAlpha = rest; ctx.drawImage(B, rx, ry, rw, rh); ctx.globalAlpha = 1;
    ctx.restore();
  }
  // 人物：弹进来（从右 40 px、0.85 倍、透明），之后跟着推进
  const x0 = rx + kx * k, y0 = ry + ky * k, w0 = kw * k, h0 = kh * k;
  if (p.only) {
    // 第十二轮（用户：只露图、其余元素都藏起来，图要留在窗口里）：p.only(ctx, S) 只画 B 的人物（不带底色块和其他元素），
    // 从窗口右边滑进来，裁在 A 的窗口 p.clip 里（推进时窗口跟着变大，最后撑出画面，裁切自然消失）
    const img = pooled('cpOnly', W, H, true), c = img.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W, H); p.only(c, S);
    const se = 1 - Math.pow(1 - clamp(ui / 0.85), 4), dx = (1 - se) * 260; // 四次缓出：快进慢停
    ctx.save();
    if (p.clip) { const [cx, cy, cw, ch, cr] = p.clip; rrect(ctx, cx, cy, cw, ch, cr ?? 10); ctx.clip(); }
    ctx.globalAlpha = clamp(ui / 0.25);
    ctx.drawImage(img, kx, ky, kw, kh, x0 + dx, y0, w0, h0);
    ctx.restore();
  } else {
    const pe = easeOutBack(clamp(ui / 0.9), 1.6), pa = clamp(ui / 0.4);
    const dx = (1 - clamp(ui / 0.9)) * 40, sc = 0.85 + 0.15 * pe;
    ctx.save(); ctx.globalAlpha = pa;
    ctx.translate(x0 + w0 / 2 + dx, y0 + h0 / 2); ctx.scale(sc, sc);
    ctx.drawImage(B, kx, ky, kw, kh, -w0 / 2, -h0 / 2, w0, h0);
    ctx.restore();
  }
  ctx.restore();
}

// 扫描擦除（第十二轮，L14 → L15，替换百叶窗）：接着 L14「删除上下文」那道从上往下扫的蓝色删除线——
// 一道亮线从上往下扫过，线上方已经是 B，线下方还是 A；线的前沿一排方格（像删除时缩成点的格子）闪一下、缩掉；
// 线带一点点辉光和「loading context」标签，速度先快后慢（缓出，落在下一个镜头上）
function scanWipe(ctx, A, B, u, S, p) {
  if (p.squares) return squareWipe(ctx, A, B, u, S);
  const e = 1 - Math.pow(1 - u, 2.4), y = lerp(-20, H + 40, e), T = 24;
  ctx.drawImage(A, 0, 0);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, Math.max(0, y)); ctx.clip(); ctx.drawImage(B, 0, 0); ctx.restore();
  // 前沿：线下面一排格子先被选中变蓝、再缩成点（和 L14 的删除一个手法）
  for (let i = 0; i * T < W; i++) {
    const k = rnd(i, 71), yy = y + T * (0.2 + 1.6 * k), a = clamp((y + T * 2 - yy) / (T * 2));
    if (yy > H || a <= 0) continue;
    const s = T * (1 - 0.7 * a);
    ctx.fillStyle = css(BRAND, 0.55 * (1 - a) + 0.15); ctx.fillRect(i * T + (T - s) / 2, yy - s / 2, s, s);
  }
  const glow = ctx.createLinearGradient(0, y - 70, 0, y);
  glow.addColorStop(0, css('#FFFFFF', 0)); glow.addColorStop(1, css('#FFFFFF', 0.6));
  ctx.fillStyle = glow; ctx.fillRect(0, y - 70, W, 70);
  ctx.fillStyle = BRAND; ctx.fillRect(0, y - 1.5, W, 3);
  ctx.font = fonts(18, 'ZENB', 'SCB'); ctx.fillStyle = BRAND; ctx.fillText(`loading context · ${Math.round(100 * e)}%`, W - 300, y - 12);
}

// 方块边的擦除（第十三轮，用户：转场去掉线条，换成随机大小的方块边，和人物的效果一样）：没有亮线、辉光和标签，
// 前沿是一排宽窄不一（16–56 px）、高低错落的方块阶梯，阶梯上方已经是 B；前沿下面零星几块 B 先"亮"出来，
// 前沿上面零星几块 A 还没删掉（缩成点再消失），像 L14 删除她时的格子
// 第十四轮（用户：转场的边缘加 1 px 浅蓝描边）：B 区域（阶梯 + 先亮出来的方块）先画成一张蒙版，蒙版往四个方向各挪 1 px 叠起来
// 再挖掉蒙版本身，剩下的就是并集外轮廓上的一圈 1 px 线——相邻 / 相叠的方块之间不会出现内部的线（不是逐个方块描边）。
// 前沿上方还没删完的 A 方块是一块块独立的碎片，各自描 1 px。阶梯的位置取整到像素，线不发虚
const EDGE14 = '#8FB2FF';
function squareWipe(ctx, A, B, u, S) {
  const e = 1 - Math.pow(1 - u, 2.2), y0 = Math.round(lerp(-120, H + 120, e));
  const region = c => {
    c.beginPath();
    for (let x = 0, i = 0; x < W; i++) {
      const w = 16 + 8 * Math.floor(rnd(i, 81) * 6), yy = y0 + Math.round((rnd(i, 82) - 0.5) * 7) * 16;
      c.rect(x, -10, w, Math.max(0, yy + 10)); x += w;
    }
    for (let k = 0; k < 70; k++) { // 前沿下方先亮出来的 B 方块
      const s = 12 + 8 * Math.floor(rnd(k, 83) * 5), x = rnd(k, 84) * W, yy = y0 + 40 + rnd(k, 85) * 160;
      if (rnd(k, 86) < 0.6) c.rect(Math.floor(x / 8) * 8, Math.floor(yy / 8) * 8, s, s);
    }
  };
  ctx.drawImage(A, 0, 0);
  ctx.save(); region(ctx); ctx.clip(); ctx.drawImage(B, 0, 0); ctx.restore();
  {
    const m = pooled('sqwipeMask', W, H, true), mc = m.getContext('2d'), o = pooled('sqwipeEdge', W, H, true), oc = o.getContext('2d');
    mc.clearRect(0, 0, W, H); mc.fillStyle = EDGE14; region(mc); mc.fill();
    oc.globalCompositeOperation = 'source-over'; oc.clearRect(0, 0, W, H);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) oc.drawImage(m, dx, dy);
    oc.globalCompositeOperation = 'destination-out'; oc.drawImage(m, 0, 0); oc.globalCompositeOperation = 'source-over';
    ctx.drawImage(o, 0, 0);
  }
  for (let k = 0; k < 60; k++) { // 前沿上方还没删完的 A 方块：缩成点
    const s0 = 12 + 8 * Math.floor(rnd(k, 87) * 5), x = Math.floor((rnd(k, 88) * W) / 8) * 8, yy = Math.floor((y0 - 30 - rnd(k, 89) * 150) / 8) * 8, a = clamp((y0 - yy) / 180);
    const s = s0 * (1 - a);
    if (s < 2 || yy < -40 || yy > H) continue;
    ctx.drawImage(A, x, yy, s0, s0, x + (s0 - s) / 2, yy + (s0 - s) / 2, s, s);
    ctx.fillStyle = css('#DCE6FF', 0.5 * (1 - a)); ctx.fillRect(x + (s0 - s) / 2, yy + (s0 - s) / 2, s, s);
    { const q = Math.round(s); ctx.strokeStyle = EDGE14; ctx.lineWidth = 1; ctx.strokeRect(Math.round(x + (s0 - q) / 2) - 0.5, Math.round(yy + (s0 - q) / 2) - 0.5, q + 1, q + 1); }
  }
}

// 同一张画布往下走（第十二轮，L17 → L18）：B 就接在 A 的下面，镜头接着 A 结尾那种慢慢加速的下移一直往下走，到 B 时缓下来停住。
// 中间一条很淡的接缝线（两张画布是连着的）
function slideDown(ctx, A, B, u, S, p) {
  const e = (1 - Math.cos(Math.PI * Math.pow(u, 1.25))) / 2, y = -e * H;
  ctx.drawImage(A, 0, y); ctx.drawImage(B, 0, y + H);
  ctx.fillStyle = css(S.pal.line, 0.25); ctx.fillRect(0, y + H - 1, W, 2);
  if (p.overlay) { ctx.save(); p.overlay(ctx, S, u, e); ctx.restore(); } // 第十三轮：一个不跟着画布走的元素（L17 的输入框 → L18 的消息）
}

// 被风吹走（第十三轮，L11 → L12）：A 切成 12×7 的块，从右往左依次被风刮走——往右加速、往上飘、转、缩、淡；
// 一层白色风线往右扫。B 在后面从左边摆进来：绕底部中点（L12 节拍器的支点）带阻尼地摆到正，接上 L12 自己的摇晃。p.pivot [x, y]
function windBlow(ctx, A, B, u, S, p) {
  const [px, py] = p.pivot ?? [960, 1040], e = easeOut(clamp(u / 0.95)), th = -0.2 * Math.exp(-3.5 * e) * Math.cos(6 * e) * (1 - e);
  ctx.fillStyle = S.pal.bg; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.translate(px - 260 * (1 - e) * (1 - e), py); ctx.rotate(th); ctx.translate(-px, -py); ctx.drawImage(B, 0, 0); ctx.restore();
  const nx = 12, ny = 7, bw = W / nx, bh = H / ny;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const d = (1 - i / nx) * 0.42 + rnd(i, j, 61) * 0.16, q = clamp((u - d) / 0.42);
    if (q >= 1) continue;
    const k = easeIn(q), x = i * bw + k * (900 + 700 * rnd(i, j, 62)), y = j * bh - k * (120 + 200 * rnd(i, j, 63)) + Math.sin(q * 9 + i) * 18 * q;
    ctx.save(); ctx.globalAlpha = 1 - q * q;
    ctx.translate(x + bw / 2, y + bh / 2); ctx.rotate((rnd(i, j, 64) - 0.3) * 1.6 * k); ctx.scale(1 - 0.45 * k, 1 - 0.45 * k);
    ctx.drawImage(A, i * bw, j * bh, bw, bh, -bw / 2, -bh / 2, bw + 1, bh + 1);
    ctx.restore();
  }
  ctx.fillStyle = css('#FFFFFF', 0.75 * Math.sin(Math.PI * u));
  for (let i = 0; i < 30; i++) { const y = rnd(i, 71) * H, len = 180 + rnd(i, 72) * 520, x = ((rnd(i, 73) + u * 2.4) % 1) * (W + len) - len; ctx.fillRect(x, y, len, 2 + (i % 3)); }
}

// ---------------------------------------------------------------- 第十二轮：带"跨镜头元素"的转场
// 背景按 p.bg 合成（'fade' 叠化 + 一点推拉；'whip' 甩镜，可用 p.w0 / p.w1 只在一段里甩），最上面画 p.overlay(ctx, S, u)——
// 一个从前一个镜头带到后一个镜头的元素（0/1 粒子、粉色的 I → 焦点框 → 心）。video-shotcraft 的 match cut / morph cut
function overlayCut(ctx, A, B, u, S, p) {
  if (p.bg === 'whip') {
    const w0 = p.w0 ?? 0, w1 = p.w1 ?? 1, v = clamp((u - w0) / (w1 - w0));
    if (v <= 0) ctx.drawImage(A, 0, 0); else if (v >= 1) ctx.drawImage(B, 0, 0); else whip(ctx, A, B, v, S, { dir: p.dir });
  } else {
    const f0 = p.f0 ?? 0.3, f1 = p.f1 ?? 0.7, e = smooth(clamp((u - f0) / (f1 - f0))), za = p.zoomA ?? 0.05, zb = p.zoomB ?? 0.05;
    const put = (img, s, a) => { if (a <= 0) return; ctx.save(); ctx.globalAlpha = a; ctx.translate(W / 2, H / 2); ctx.scale(s, s); ctx.translate(-W / 2, -H / 2); ctx.drawImage(img, 0, 0); ctx.restore(); };
    ctx.fillStyle = S.pal.bg; ctx.fillRect(0, 0, W, H);
    put(A, 1 + za * smooth(u), 1);
    put(B, 1 + zb * (1 - e), e);
  }
  if (p.overlay) { ctx.save(); p.overlay(ctx, S, u); ctx.restore(); }
}

// 第十五轮（用户：1:42 DeepSeek 窗口和下一个镜头 ComfyUI 的启动窗口很像，可以做无缝过渡）：同一扇窗口从 A 的位置 / 大小 / 倾角
// 变到 B 的（smooth），窗口里 A 的内容（按 A 的窗口从 A 画面里裁下来、摆正）淡出、B 的内容（按 B 的窗口从 B 画面裁）淡入，
// 中途一道浅蓝亮带从上往下扫过窗口（像换了一个程序）；窗口外面 A、B 叠化。p.a(S) / p.b(S)：{ cx, cy, w, h, rot, r, edge }（屏幕坐标）
function winMorph(ctx, A, B, u, S, p) {
  const a = p.a(S), b = p.b(S), e = smooth(clamp((u - 0.05) / 0.8)), bgE = smooth(clamp((u - 0.15) / 0.6));
  // 先铺 B，再把 A 叠上去淡出——A 只画窗口外面（A 的窗口比 B 大，缩的时候不能从变形的窗口边上露出 A 窗口里的字）
  ctx.drawImage(B, 0, 0);
  if (bgE < 1) {
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H);
    ctx.translate(a.cx, a.cy); ctx.rotate(a.rot); ctx.rect(-a.w / 2 - 2, -a.h / 2 - 2, a.w + 4, a.h + 4); ctx.rotate(-a.rot); ctx.translate(-a.cx, -a.cy);
    ctx.clip('evenodd'); ctx.globalAlpha = 1 - bgE; ctx.drawImage(A, 0, 0); ctx.restore();
  }
  const cx = lerp(a.cx, b.cx, e), cy = lerp(a.cy, b.cy, e), w = lerp(a.w, b.w, e), h = lerp(a.h, b.h, e), rot = lerp(a.rot, b.rot, e), r = lerp(a.r, b.r, e);
  const fa = 1 - smooth(clamp((u - 0.15) / 0.45)), fb = smooth(clamp((u - 0.4) / 0.45));
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
  ctx.fillStyle = 'rgba(77,107,254,0.10)'; rrect(ctx, -w / 2 + 10, -h / 2 + 14, w, h, r); ctx.fill();
  ctx.save(); rrect(ctx, -w / 2, -h / 2, w, h, r); ctx.clip();
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(-w / 2, -h / 2, w, h);
  for (const [img, q, al] of [[A, a, fa], [B, b, fb]]) {
    if (al <= 0) continue;
    ctx.save(); ctx.globalAlpha = al; ctx.scale(w / q.w, h / q.h); ctx.rotate(-q.rot); ctx.translate(-q.cx, -q.cy); ctx.drawImage(img, 0, 0); ctx.restore();
  }
  const sv = clamp((u - 0.25) / 0.45);
  if (sv > 0 && sv < 1) {
    const sy = -h / 2 + (h + 80) * smooth(sv) - 40, g = ctx.createLinearGradient(0, sy - 70, 0, sy);
    g.addColorStop(0, css('#DCE6FF', 0)); g.addColorStop(1, css('#DCE6FF', 0.85)); ctx.fillStyle = g; ctx.fillRect(-w / 2, sy - 70, w, 70);
    ctx.fillStyle = css('#4D6BFE', 0.6); ctx.fillRect(-w / 2, sy, w, 2);
  }
  ctx.restore();
  ctx.lineWidth = 2; ctx.strokeStyle = mix(a.edge ?? '#C9D3F5', b.edge ?? '#C9D3F5', e); rrect(ctx, -w / 2, -h / 2, w, h, r); ctx.stroke();
  ctx.restore();
}

// 第十五轮（间奏二 · 第十七张）：上一段批量出的 16 张图碎成噪点，噪点不散、铺满全屏就是间奏二第 1 步的噪声场（带着元素过剪辑点）。
// A 切成 24 px 的方块，每块在自己的时刻（随机、略从中间往外）换成 B；换掉之前的 0.3 那一段先被彩色颗粒一点点吃掉、横向抖几下
function noiseIn(ctx, A, B, u, S) {
  ctx.drawImage(B, 0, 0);
  const bs = 24, nx = W / bs, ny = Math.ceil(H / bs), kq = Math.floor(u * 30), cols = ['#4D6BFE', '#9DB4FF', '#2A3770', '#FFFFFF'];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const d = Math.hypot(i - nx / 2, (j - ny / 2) * 1.6) / Math.hypot(nx / 2, (ny / 2) * 1.6), th = 0.2 + 0.75 * (0.65 * rnd(i, j, 81) + 0.35 * d);
    if (u >= th) continue;
    const q = clamp((u - th + 0.3) / 0.3), jx = q > 0 ? ((hash(i, j, kq) % 7) - 3) * q * 3 : 0;
    ctx.drawImage(A, i * bs, j * bs, bs, bs, i * bs + jx, j * bs, bs, bs);
    if (q > 0) for (let g = 0; g < Math.floor(q * 14); g++) { const h = hash(i, j, g, kq); ctx.fillStyle = cols[h % 4]; ctx.fillRect(i * bs + (h >> 3) % 6 * 4, j * bs + (h >> 6) % 6 * 4, 4, 4); }
  }
}

// 形状轮廓上的 n 个点（从顶边中点顺时针）：{ kind: 'rect' | 'I' | 'heart' | 'ellipse', x, y, w, h }
function outline(sh, n) {
  const { x, y, w, h } = sh, pts = [];
  if (sh.kind === 'ellipse') { for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; pts.push([x + w / 2 + (w / 2) * Math.sin(a), y + h / 2 - (h / 2) * Math.cos(a)]); } return pts; }
  if (sh.kind === 'heart') {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, hx = 16 * Math.sin(a) ** 3, hy = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a);
      pts.push([x + w / 2 + (hx / 34) * w, y + h * 0.42 - (hy / 30) * h]);
    }
    return pts;
  }
  const poly = sh.kind === 'I' // 字母 I：上下两条横、中间一根竖
    ? (() => { const bh = h * 0.2, sw = w * 0.21; return [[x + w / 2, y], [x + w, y], [x + w, y + bh], [x + w / 2 + sw, y + bh], [x + w / 2 + sw, y + h - bh], [x + w, y + h - bh], [x + w, y + h], [x, y + h], [x, y + h - bh], [x + w / 2 - sw, y + h - bh], [x + w / 2 - sw, y + bh], [x, y + bh], [x, y], [x + w / 2, y]]; })()
    : [[x + w / 2, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y], [x + w / 2, y]];
  const seg = [];
  let L = 0;
  for (let i = 0; i < poly.length - 1; i++) { const l = Math.hypot(poly[i + 1][0] - poly[i][0], poly[i + 1][1] - poly[i][1]); seg.push(l); L += l; }
  for (let i = 0; i < n; i++) {
    let d = (i / n) * L, k = 0;
    while (k < seg.length - 1 && d > seg[k]) d -= seg[k++];
    const q = seg[k] ? d / seg[k] : 0;
    pts.push([lerp(poly[k][0], poly[k + 1][0], q), lerp(poly[k][1], poly[k + 1][1], q)]);
  }
  return pts;
}
// 两个形状之间变形：e 0→1；o.fill [起, 止] 填充不透明度（o.fillCurve(e) 换插值曲线） · o.lw [起, 止] 描边宽 · o.color · o.alpha · o.arc 中途往上拱的高度
export function morphShape(ctx, from, to, e, o = {}) {
  const n = 120, a = outline(from, n), b = outline(to, n), color = o.color ?? '#FF6FA8';
  if (o.rot) { // 第十三轮：整体绕自己的中心转 o.rot（弧度）
    const pts = a.map((p, i) => [lerp(p[0], b[i][0], e), lerp(p[1], b[i][1], e)]), cx = pts.reduce((s, p) => s + p[0], 0) / n, cy = pts.reduce((s, p) => s + p[1], 0) / n, c = Math.cos(o.rot), s = Math.sin(o.rot);
    for (let i = 0; i < n; i++) { const [x, y] = pts[i]; a[i] = b[i] = [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c]; }
  }
  const fill = lerp(o.fill?.[0] ?? 0, o.fill?.[1] ?? 0, o.fillCurve ? o.fillCurve(e) : e), lw = lerp(o.lw?.[0] ?? 4, o.lw?.[1] ?? 4, e), lift = (o.arc ?? 0) * Math.sin(Math.PI * e);
  ctx.save(); ctx.globalAlpha *= o.alpha ?? 1;
  ctx.beginPath();
  for (let i = 0; i < n; i++) { const x = lerp(a[i][0], b[i][0], e), y = lerp(a[i][1], b[i][1], e) - lift; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  ctx.closePath();
  if (fill > 0.01) { ctx.globalAlpha *= 1; ctx.fillStyle = css(color, fill); ctx.fill(); }
  ctx.lineJoin = 'round';
  if (o.halo) { ctx.lineWidth = lw + 8; ctx.strokeStyle = css('#FFFFFF', 0.9); ctx.stroke(); }
  ctx.lineWidth = lw; ctx.strokeStyle = color; ctx.stroke();
  ctx.restore();
}
// 四角取景框：k 0 → 1 时四个角线从 len 长到半边长，连成一个完整的矩形（第十三轮，L07 焦点框 → 整框）
export function cornerFrame(ctx, x, y, w, h, k, { len = 56, lw = 5, color = '#FF6FA8', alpha = 1 } = {}) {
  const lx = lerp(len, w / 2, k), ly = lerp(len, h / 2, k);
  ctx.save(); ctx.globalAlpha *= alpha; ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.beginPath();
  for (const [px, py, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) { ctx.moveTo(px + sx * lx, py); ctx.lineTo(px, py); ctx.lineTo(px, py + sy * ly); }
  ctx.stroke(); ctx.restore();
}
// 弹性缓出（过冲几下落定）
export const elasticOut = x => (x <= 0 ? 0 : x >= 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1);
// 平滑的心形路径（和 morphShape 的 heart 同一条曲线），给镜头里画心用
export function heartPath(ctx, cx, cy, size) {
  const pts = outline({ kind: 'heart', x: cx - size / 2, y: cy - size / 2, w: size, h: size }, 120);
  ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
}

export const TRANS = { portal, whip, iris, pixel, blinds, tv, spin, shards, fade, appOpen, focus, sweep, crtOff, charPortal, overlayCut, scanWipe, slideDown, windBlow, winMorph, noiseIn };
