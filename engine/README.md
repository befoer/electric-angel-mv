# 引擎说明（写镜头的人看这里）

设计依据：[视觉方案.md](../文档/视觉方案.md)。技术总览：[项目方案.md](../文档/项目方案.md) §三。
范例镜头：
- [shots/intro.js](shots/intro.js)：前奏，界面 + 字符场 + 精灵 + HUD；第五轮加了两侧贴纸卡（公式推导、仪表、印章）
- [shots/l01.js](shots/l01.js)：落点，公式坍缩成歌词关键词 + 候选 token 数据行 + 立绘拼贴 + 窗口碎片
- [shots/l02.js](shots/l02.js)：剪影 + 引线标注、公式板书后被红笔划掉、剪影露出彩色立绘
- [shots/l04.js](shots/l04.js)：公式代入实时数值、环形仪表组、圈注引线、数据曲线
- [shots/l10.js](shots/l10.js)：按真实方程出图（心形线、心电图）、公式推导、关键词拼成的心

第五轮（公式层 + 贴纸组件）的镜头写法以 l01 / l02 / l04 / l10 为准。

**第六轮起的写法**（相机、景深、HUD 拼贴、转场）以 `shots/` 下的 opening、intro、l01–l12 为准，公用的东西在 `shots/scene.js`。一个镜头的骨架：

```js
const CAM = [{ t: T0, x: 0, y: 0, zoom: 1.08, rot: 0 }, { t: T1, x: -40, y: 0, zoom: 1.0 }];
export function lxx(ctx, S) {
  const cam = camAt(CAM, S.t), c = { ...cam, zoom: cam.zoom * punch(S) };
  paper(ctx, S, c);                         // 纸面 + 随相机走的网格
  backDeco(ctx, S, c, seed);                // 远景虚焦 HUD 拼贴
  withCam(ctx, c, 1, g => content(g, S));   // 主平面（镜头的内容）
  frontDeco(ctx, S, c, seed + 1);           // 近景虚焦部件
  hud(ctx, S);                              // HUD（心电图、小字歌词）
}
```

转场在 `timeline.js` 的 `TRANS_TABLE` 里登记（类型见 `core/trans.js`）。一个镜头在转场窗口里会被画在它自己的时间范围之外（前一个停在最后一帧、后一个停在第一帧），所以镜头函数要能处理 `S.lt` 略小于 0 或略大于镜头长度的情况。

## 运行

```
node render/serve.mjs                       预览：http://127.0.0.1:8099/engine/index.html
node render/render.mjs --png 14.6 16.2      导出单帧（出片尺寸，现在是 3840×2160）→ out/单帧/frame_14.600.png（并打印绘制耗时）；--ss 1 不超采样
node render/sheet.mjs --every 1 --from 0 --to 53 --out out/单帧/s.png   总览图（直接用引擎画）；--trans 每个转场 6 张；--at 指定时刻
node render/render.mjs --bars 1-12          出片第 1–12 小节 → out/bars_1-12.mp4（--out 指定位置，每轮放 out/第N轮/）
node render/render.mjs --preset veryfast    粗剪用快速编码；终渲用默认 medium
node scripts/build_formulas.mjs             改了 data/formulas.json 之后重建 build/formulas.json
```

`--png` 打印的是单帧耗时；一个镜头的第一帧会建缓存（立绘裁切、公式墙纸等），会慢很多，看第二帧以后的数。

预览页按键：空格 播放 · ←/→ 一帧 · Shift+←/→ 一拍 · [ ] 一小节 · D 调试叠层 · L 循环当前镜头。控制台：`mv.seek(秒)`。

## 镜头函数

```js
export function myShot(ctx, S) { ... }   // 在 timeline.js 的 TABLE 里登记
```

| S 的字段 | 含义 |
|---|---|
| `t` `frame` | 绝对时间（秒）、帧号 |
| `bar` `beat` `sub` `ni` | 小节、小节内拍号 1–4、拍内进度 0..1、全局整拍序号 |
| `pal` | 当前调色板：`bg grid ink[5] text gray acc[3] win winEdge shadow shadowA name key` |
| `f` | 逐帧音频特征：`rms low mid high onset`（0..1） |
| `shot` `lt` `u` | 当前镜头、镜头内时间、镜头进度 0..1 |

**硬规则**

- 画面只由 `S.t` 决定：不用 `Math.random`、`Date`、不读上一帧。随机用 `hash / rnd / vnoise`（种子用格子、小节、拍、序号）。
- 不在代码里写歌词原文：用 `keyword('L05', 起, 止)` 按字序号取字（序号 = 去掉括号读音后的第几个字，从 0 起）。
- 不用 emoji 字形：👍 🍚 之类一律用像素精灵画（`core/sprites.js` 的 `SPR` 里加）。
- 不在每帧里新建画布或做全屏 `getImageData`；需要的中间画布在模块里缓存。
- 屏幕上的技术数字用 `fact(key, 'current' | 'v3' | …)` 取 `data/facts.json`。
- 单帧耗时目标 ≤ 30 ms（Node 端，预热后）。`render.mjs --png` 会打印耗时。

## 常用接口

**时间**（`core/time.js`）：`pos(t)` · `barStart(k)` · `beatTime(bar, beat)` · `q16(t)` · `clamp lerp smooth easeIn easeOut easeOutBack decay(dt, k)`

**随机**（`core/rand.js`）：`hash(a,b,c,d)` 32 位整数 · `rnd(a,b,c,d)` 0..1 · `vnoise(x,y,z,seed)` 平滑噪声 · `pick(arr, …)` · `weighted([[值, 权重]…], u)`

**网格**（`core/grid.js`，格子 12×20 px，160×54）
- `background(ctx, pal)`：底色 + 每 4 格一条网格线
- `new Occ().rect(c0, r0, c1, r1)` / `.px(x0, y0, x1, y1)`：标记被占用的格子，字符场不画
- `charField(ctx, S, { occ, density(c, r, t, S) → 0..1, freeze, inkCap, reshuffle })`：字符场；`bgDensity(amount)` 是默认背景
- `putText(ctx, gs, col, row, str, { maxCol, bg })`：写一行字（全角占 2 格），返回格数；`textCells(gs, str)`
- `drawBox(ctx, gs, c0, r0, c1, r1, { progress, gaps })`：圆角制表符框；`progress` 从左上角沿两条路画出
- `charField(…, { tiers: ['01', '01', '01'] })`：换字符集（疏 / 中 / 密三层）
- `rasterCells(key, cols, rows, (c, w, h) => { … })`：把任意路径光栅化成格子掩码（缓存）；`heartPath` 是现成的心形

**字形**（`core/glyphs.js`）：`glyphs(字体键, 颜色, 字号 = 20)` 返回字形集，`.draw(ctx, ch, x, y)`、`.cells(ch)`、`.warm(一批字)`。字体键：`SC SCB J JB DELA ZEN ZENB MIN DOT SMILEY KAI`（见项目方案 §3.5）。大字直接 `ctx.font = font('DELA', 560)` + `fillText`。制表符 `─│╭╮╰╯┊┄├┤┬┴┼` 和方块 `█▀▄▌▐░▒▓▁…▇▍` 是程序画的，严丝合缝。

**文字效果**（`core/text.js`）：`decode(str, age, { step, settle, seed })` 解码显现 · `stream(str, age, per)` 逐 token 输出 · `SCR_N` `SCR_W` 乱码字符集

**精灵**（`core/sprites.js`，现有：`heart heartO star sparkle cross diamond note tail bubble feather rice fish thumb thumbDown whale`）：`drawSprite(ctx, 名, px, pal, cx, cy, scale, alpha)` · `beatSprites(S, { mult, set, avoid, skip })` + `drawBeatSprites(ctx, S, list)`（节拍元素，按视觉方案 §4.6）· `spriteCells(s)` · `offbeatFlashes(ctx, S)` · `dropBurst(ctx, S, t0)` · `voiceAt(bar)`

**界面**（`core/ui.js`）：`windowBase` · `panel(ctx, S, c0, r0, c1, r1, { title, spinner })` · `capsule` · `toast(ctx, S, 文字, cx, cy, age)` · `configDiff` · `rrect`

**HUD**（`core/hud.js`）：`hud(ctx, S, { alpha, spectrum })`。只在代码世界的镜头里用（视觉方案 §4.9）

**公式**（`core/math.js`，视觉方案 §4.12）。公式写在 `data/formulas.json`（TeX），跑 `node scripts/build_formulas.mjs` 生成字形数据
- `drawFormula(ctx, id, x, y, o)` → 排版结果 `L`（屏幕坐标：`x0 y0 x1 y1 base`，`L.box(标签)`、`L.slot(槽名)` 返回 `[x0, y0, x1, y1]`）
  - `o.size` 每 em 像素（默认 64）· `o.color` · `o.colors {标签: 色}` · `o.align 'l'|'c'|'r'` · `o.valign 'top'|'mid'|'base'|'bottom'`
  - 板书：`o.write` = 开始写后的秒数，`o.dur` 写完用时 · 圈注：`o.marks {标签: 底色}` · `o.hide [标签]` · `o.alpha`
  - 坍缩：`o.collapse { u, x, y }` · 代入：`o.slots {槽名: (ctx, box, L) => …}`，里面用 `slotNum(ctx, box, '0.92')` 或 `slotText(ctx, box, '唱首歌吧')`
- `morphFormula(ctx, idA, idB, u, x, y, o)`：推导，相同字形飞到新位置；u 0→1
- `fnum(ctx, '0.98', x, 基线y, 字号, { color, align })`：用公式字体画数字 · `formulaSize(id, size)` · `formulaWall(w, h, 色, { size, seed })` 公式墙纸（缓存画布）
- 中文和会变的数字不进 TeX，用 `\cssId{s_名}{\rule{宽em}{高em}}` 留槽

**贴纸组件**（`core/kit.js`，视觉方案 §4.13）
- `card(ctx, S, x, y, w, h, o, c => {…})`：贴纸卡，回调里画内容（`c` 是内容区 `{x, y, w, h}`）。`o.title` `o.fill` `o.age`（弹出动画）`o.rot` `o.alpha` `o.inner`
- `leader(ctx, S, 锚x, 锚y, 终x, 终y, u, { color })`：引线 · `ring(ctx, S, cx, cy, r, v, { text, label, color })`：环形仪表 · `rows(ctx, S, x, y, [{ k, v, unit, u, hi }], o)`：数据行
- 装饰：`dots` `hatch` `warn` `corners` `plusMinus` `checker` `swatches` · `stamp(ctx, S, 'Wait.', cx, cy, 字号, age)` 印章 · `barcode(ctx, x, y, w, h, '114514', 色)`
- `silhouette(编号, sub, maxDim, 色)` 剪影 · `silhouetteFill(…, 纹理, 透明度)` 剪影里铺纹理 · `popIn(S, age)` 按音色段的弹出缩放
- 线色、浅底色：`S.pal.line`、`S.pal.tint[0..3]`（樱 / 柠 / 薄荷 / 天蓝）
- 卡片和数字的字体用 `fonts(px, 'ZENB', 'SCB')`（Zen Maru 没有简体中文，缺字退到更纱）

**立绘**（`core/portrait.js`）
- `photo(编号, sub, w, h, { keyed })`：**镜头里取立绘一律用它**，按目标尺寸缓存的裁切图；`keyed: true` 保留透明背景（全身、半身），否则 cover 裁满（特写、拼贴）。不要每帧从 `illust()` 的原图缩放（I01 原图 3577×7424）
- `illust(编号, sub)`：取素材区域；`sub` 是归一化的再裁切 `[x, y, w, h]`。素材到位前用人设图占位
- `keyed(编号, sub)`：抠掉白底的画布 · `glyphArt(编号, sub, cols)` + `drawGlyphArt(ctx, art, col, row, pal, { reveal, scramble })`：字符画 · `halfBlock(编号, sub, 宽 px, pal)`：半块像素头像 · `halftone(编号, sub, w, h, 颜色)`：半色调网点层
- 素材到位后在 `assets/illust/manifest.json` 登记：`{ "I01": "I01_全身.png" }`，占位自动换成真图

**效果**（`core/fx.js`）：`flash(ctx, a)` · `invert(ctx)` · `shake(t, amp)` · `scanlines(ctx)` · `drawCover` · `framed(ctx, src, cx, cy, w, h, { rot, scale })`（漫画分格白框）· `glitchSlices`

**相机与景深**（`core/cam.js`）：`camAt(关键帧, t)` · `withCam(ctx, cam, 深度, g => …)` · `camToScreen(cam, 深度, x, y)` · `blurLayer(ctx, k, g => …, { slot, alpha })` 虚焦层 · `softCopy(画布, k, slot)` 模糊副本 · `drawPersp(ctx, 画布, X, Y, Z, w, h, 角度, { f })` 透视面板 · `project(X, Y, Z)` · `pooled(key, w, h)` 缓冲池（需要中间画布时用它，不要每帧新建）

**转场**（`core/trans.js`）：`portal`（推进一个区域，`rect`、`shape: 'circle'`）· `whip`（`dir`）· `iris`（`x, y, shape: 'heart'`）· `pixel` · `blinds` · `tv` · `spin` · `shards`。在 `timeline.js` 的 `TRANS_TABLE` 登记：`[进入的镜头, 类型, 边界前秒, 边界后秒, 参数 | () => 参数, { liveA, liveB }]`

**HUD 小部件**（`core/hudkit.js`）：`ringScanner` `ruler` `ecgStrip` `targetLock` `dataColumn` `segBar` `hexPatch` `miniSpectrum` `orbit` `tag` `plusGrid` `arcText` · `hudCluster(ctx, S, seed, x, y, w, h)` 不规则拼贴 · `ecg(t)` 心电波形

**歌词装饰**（`core/lyric.js`）：`lyricHud(ctx, S, x, y)` 小字歌词（HUD 已自带）· `lyricKinetic(ctx, S, 句号, (i, age, ch) => ({ x, y, s, r, a }))` 动态排版

**点云**（`core/particles.js`）：`sampleCanvas(key, 画布, n)` · `sampleText(字, n, { keys, px })` · `drawPoints(ctx, P, cx, cy, scale, size, { offset, morph: { to, u }, color })` · `windOffset(i, x, y, t, 风力)`

**镜头公用**（`shots/scene.js`）：`paper` · `backDeco` · `frontDeco` · `punch(S)` 拍头推镜 · `drawCRT` / `crtGeometry` 科技风显示器（第七轮）· `homageFlash(ctx, S, kind, a, rect)` 原版 MV 黑帧的致敬（区域内浅蓝闪）· `chatWin(ctx, S, x, y, w, h, o)` 像素坐标的 DeepSeek 对话窗口（侧栏、输入框，返回消息区 / 输入框位置）· `bigLine(ctx, S, chars, x, y, o)` 歌词大字（按唱到的时刻逐字出现，`place` 可加动画）

**视频蒙版**（第八轮，`core/masks.js`）：舞蹈视频先跑 `node scripts/video_masks.mjs V1 V2 …` 抠成 `build/masks/Vn.json`（按行游程编码），引擎启动时读进来。`hasMask(id)` · `maskIndex(id, t, { t0, speed, mode: 'clamp'|'loop'|'pingpong', from, to })` 时刻 → 帧号（视频偏慢，用 speed 加速）· `maskFrame(id, k)` 剪影画布（左右边缘渐隐，尾巴出画的切口看不出）· `drawMask(ctx, id, k, cx, footY, h, pose, alpha)` · `maskCells(id, k, cols, rows)` 按格子取样（字符画用）

**第八轮新增**：`shots/drop.js`（L01 在显示器里播）· `shots/comfy.js`（ComfyUI 工作流，取代 storm.js）· `scene.js` 的 `tokenStrip(ctx, S, chars, x, y)` stdin 词元条 · `intro.js` 的 `monitorStage(ctx, S, drawScreen)` 显示器舞台 · `portrait.js` 的 `hasIllust(id)`（没登记时镜头自己选后备）

**镜头文件**（第七轮）：`opening` `intro` `l01`–`l12`（第一段）· `i1`（间奏一）· `v2a` L13–16 · `v2b` L17–20 · `v2c` L21–24 · `storm`（采样风暴）· `interlude2`（间奏二）· `v3a` 进场、L25–28 · `v3b` L29–32 · `outro`（尾奏 1–4）。全片镜头表见视觉方案 §5.9

**相机补充**（第七轮，`core/cam.js`）：`fishX(dx, fish)` 柱面鱼眼；`drawPersp` / `project` 的 `fish` 参数 · `drawPitch(ctx, 画布, cx, cy, w, h, 俯仰角, { Z, f })` 往远处倒下去的平面，返回 `map(u, v)` 平面坐标 → 屏幕 · `softCopy` 返回的小画布带 `__soft`，`drawPersp` 画它时自动用高质量放大

**转场补充**：`fade`（叠化，`color` 时经过这个颜色）

**效果补充**（`core/fx.js`）：`badTV(ctx, 画布, x, y, w, h, 强度, t)` 老电视信号 · `tinted(画布, 色)` 纯色剪影副本

**数据**（`core/data.js`）：`feat(t)` · `vspec(t)` 人声频谱 32 段（0..1，低 → 高，`build/vocal_spec.json`）· `energy(bar)` ×0.4–1.4 · `fact(key, which)` · `lyric(id)` · `lyricAt(t)` · `keyword(id, from, to)` → `[{ c, t0, t1 }]`

**色彩**（`core/color.js`）：`mix(a, b, u)` · `css(c, alpha)` · `BRAND`（`#4D6BFE`，在 `core/const.js`）

## 第九轮补充

**版本开关**（`engine/rev.js`，方便回滚）：每条用户意见的改动挂一个键，值是轮次。改动处写成 `if (rev('键') >= 12) 新 else 旧`，大改的镜头可以把上一版整个留在 `xxx_rN.js`。开关只能在画帧时读，不能在模块加载时读（命令行参数在模块加载之后才设）。键的清单见 `rev.js` 的注释和进度.md 的回滚表。
- 临时看上一版：`node render/sheet.mjs --at 35 --rev l07=11`、`node render/render.mjs --png 105 --rev comfy12=11`、出片同样加 `--rev`；预览页 `?rev=l07=11`。
- 彻底回滚：把 `rev.js` 里的值改成上一轮。
- **只留两轮**（第十二轮起）：每轮开工时删掉再早一轮的键、它们的旧分支和 `*_rN.js`（快照里还有）；`rev()` 碰到不存在的键会直接报错。

**节拍冲击**（video-shotcraft 审美准则 R4）：作用于整画面 / 相机的冲击全片 ≤ 3 处。`scene.js` 的 `camBeat(S)` 在不允许的地方返回 0，`punch` 已经乘上它；镜头里自己写的拍头推镜 / 震屏 / 整屏闪也要乘 `camBeat(S)`，拍点的反馈只做在元素上。

**镜头公用**（`shots/scene.js`）：`safeZoom()` 主体留白（相机退 12%）· `formulaFx(S, 卡片出现后的秒数)` 公式写出来 + 每四拍一道扫光，展开进 `drawFormula` 的参数 · `camBeat(S)`

**公式**（`core/math.js`）：`drawFormula` 多了 `sweep: { u, color }`（扫光：u 0→1 一道高亮从左到右扫过字形）

**相机**（`core/cam.js`）：`drawPersp(…, { shear: true, strips })` 每条竖条按两侧上下沿做斜切，斜看的面板横线不出锯齿（L07、L19 在用；条数 70–160）

**转场**（`core/trans.js`）：`appOpen`（`rect`、`radius`：A 里的图标长成全屏，框里是 B）· `focus`（`blur`：虚焦接力）· `sweep`（`dir`：前景面板扫过，藏切点）· `crtOff`（显示器关机：压成亮线 → 缩成点）· `tv` 的 `flash: 0` 不整屏闪。第九轮的转场登记在 `timeline.js` 的 `TRANS_R9`（同镜头号覆盖 `TRANS_TABLE` 的，新镜头号追加）

**已装的 skill**：设计镜头和转场时用（见 AGENTS.md「已装的 skill」）。镜头卡的代码是 Remotion / CSS，在这里一律翻译成上面这些 Canvas 写法

## 第十二轮补充

**字**（`core/glyphs.js`）：`midText(ctx, s, x, cy)` 把字按大写字母高度垂直居中在 cy 上（`textBaseline 'middle'` 按 em 框居中，拉丁字母和数字会偏下 2–4 px），`capMid(ctx)` 返回这段偏移；`font` / `fonts` 的字体串最后自动垫更纱（日文字体缺简体字时不再被系统乱换）；明朝体 MIN 自动换成像素字 DotGothic16（rev `pixfont`）

**转场**（`core/trans.js`）：`overlayCut`（`bg: 'fade' | 'whip'`，`f0 / f1` 叠化区间，`zoomA / zoomB`，`overlay(ctx, S, u)` 画在最上面的跨镜头元素）· `morphShape(ctx, from, to, e, { fill, fillCurve, lw, color, halo, arc })` 形状变形（`kind: 'I' | 'rect' | 'heart'`）· `heartPath(ctx, cx, cy, size)` · `scanWipe`（扫描线往下扫，上面已经是 B）· `slideDown`（B 接在 A 下面，同一张画布往下走）· `iris` 的 `glow` · `charPortal` 的 `only(ctx, S)` / `clip` · 转场里前一个镜头默认继续走（`main.js`，登记 `liveA: false` 才停）

**HUD / 组件**：`targetLock` 的 `labelAt: 'side' | 'top' | 'in'` · `stamp` 的 `fill` · `hud` 的 `spectrum` 默认 'auto'（前两分钟关，要的镜头显式传 true）· `scene.js` 的 `inputChips` `sendArrow`（对话框输入区的两个胶囊和发送箭头）

**镜头文件**：`comfy_lib.js`（ComfyUI 的公用部件，原来在 `comfy_r8.js`，第十二轮随旧版一起删了）

## 第十三轮补充

**成片起点**（`core/const.js`）：`filmStart()`——成片从这个时刻开始（rev `lead` ≥ 13 时 0.6 s，片头没有音乐的那段缩短）。`render.mjs` 出全片和 `--bars 1-…` 从这里起画、音频用同一个 `-ss` 切；镜头和时间轴里的时刻仍是歌曲时间，不用换算

**字**（`core/glyphs.js`）：字体键 `MIN0`——和 `MIN` 同一个明朝体文件，但不被 `pixfont` 换成像素字（要保留明朝体的地方用它，例如 L24 的大歌词）；`registerFonts` 按别名去重

**转场**（`core/trans.js`）：`windBlow`（`pivot: [x, y]`：A 切块被风往右刮走，B 绕支点带阻尼摆进来）· `scanWipe` 的 `squares`（前沿换成随机大小的方块边，`squareWipe`）· `slideDown` 的 `overlay(ctx, S, u, e)`（不跟着画布走的元素，e 是画布的位移进度）· `morphShape` 的 `rot`（整体绕自己的中心转，弧度）· `cornerFrame(ctx, x, y, w, h, k, { len, lw, color, alpha })`（四角取景框，k 0 → 1 角线长成整框）· `elasticOut(x)`（弹性缓出，过冲几下落定）

**组件**（`core/ui.js`）：`configDiff` 在 rev `i1b` ≥ 13 时画 `voiceSwitch13`（画面正中的大音色开关）

## 第十四轮补充

**字**：字体键 `RES` / `RESB`（资源圆体 Medium / Heavy）。写 `ZEN` / `ZENB` 时按开关 `yuanti` 自动换成它们（Zen Maru 缺大部分简体字）；不要在字体串里手写字体名，一律用 `font` / `fonts`

**HUD**：`ecgStrip(…, { sweep: true, span })` 监护仪式扫描心电图（波形不动、写入头扫过；按开关 `ecg14`），`ecg(t, k)` 的 `k` 是波形宽度倍数

**转场**：`squareWipe` 方块边带 1 px 并集外轮廓（`sqedge`）；`charPortal` 的 `only` / `clip` 推进后半段在卡片外也淡入 B（`l02fix`）

**组件**：`configDiff` 在 `vslide` ≥ 14 时画 `voiceSwitch14`（字和圆钮钉在同一根滑条上滑动）

**打磨准则**：写或改任何镜头 / 转场之前先读 `.claude/skills/mv-polish/SKILL.md`（通用版，别的项目也用）；本引擎里现成的写法按问题列在 `engine/RECIPES.md`（连续变速曲线、由内到外弹出、并集描边、真实月牙路径、欠阻尼漂浮、碰撞积分……），逐轮意见记录在 `文档/打磨意见记录.md`
## 第十五轮补充

**切点**：`core/cuts.js` 的 `cutAt(小节)` = 这个小节开始的镜头真正切进来的时刻（第十五轮的 7 个已并进代码；表里没有的就是小节线）。镜头表 `SHOTS[i].t0 / t1` 是 getter，转场窗口跟着走。镜头里凡是"这个镜头从哪一刻开始 / 到哪一刻结束"（相机关键帧的首尾、入场动画的起点、交给转场叠层的时刻）都写 `cutAt(n)`，并且**在画帧时调用**——模块加载时 `--rev` 还没设置。跟着拍子走的东西（`beatTime`、`S.beat`）照旧用小节线

**视频分区图**：`scripts/video_maps.mjs V9 V10` 出剪影（`build/masks/<编号>.json`，和 `video_masks.mjs` 同格式）和颜色分区图（`build/maps/<编号>.seg`）。引擎 `core/segmaps.js`：`segIndex(id, t, t0, speed)` 取帧号，`segLabels` 类图（640×360），`segGrid` 按格取类，`segDist` / `sdAt` 距离场（320×180，身体里为正），`segCanvas(id, k, 'seg' | 'edge' | 'line' | 'depth' | 'normal' | 'mask')` 预处理图，`segBox` 包围盒。全部只由帧号决定、有小缓存。平台多了 `loadBin(p)`（Node / 浏览器）

**转场**：`winMorph`（`{ a: S => 窗口, b: S => 窗口 }`，窗口 = `{ cx, cy, w, h, rot, r, edge }` 屏幕坐标；同一扇窗口变形、里面的内容换掉）、`noiseIn`（A 碎成方块被噪点吃掉、露出 B）

**字**：`shots/scene.js` 的 `inkFlash(age, base)`——字出现后先是品牌蓝 0.1 s、0.3 s 回到 base（`bigLine` 的 `place` 返回 `color` 就能用）。`kit.stamp` 的字按墨迹上下居中

**间奏二**：`shots/interlude2.js`（第十五轮版留成 `interlude2_r15.js`，第十七轮起不删；以前的 Bad Apple 版 `badapple.js` 第十七轮删了）。结构和每小节做什么见文件开头的注释和 `文档/间奏二重做方案_第十四轮.md` 第八节
## 第十六轮补充

**切点**：`core/cuts.js` 多了 `CUT16`（第十八轮起无条件生效）——除 L01 外每一句都切在第一个字前约 3 帧；只在切点之后展开的圆 / 心形再早 0.2 s。写法同第十五轮：起止常量写成 `() => cutAt(n)`、画帧时调用；按拍数的东西从小节线数（`B18`、`B46`、`B99` 这类常量）。相机关键帧表里用到起止的，整张表也要写成函数

**视频分区图（新增）**：`segContours(id, k)` 矢量线稿（`{ outer, inner }`，视频归一化坐标的线段串 `[x0, y0, x1, y1, …]`；每个部位模糊后取 0.5 等值线，只在包围盒里算）· `segShade(id, k, u, v)` 某一点的明暗（法线点乘左上方的光，0..1）· `segCanvas(…, 'cel')` 本色平涂 + 两档明暗（颜色 `CEL_PAL`）· `segCanvas(…, 'lab1'…'lab5')` 单个部位的蒙版。派生图缓存 48 个

**视频原画**：`scripts/video_frames.mjs V10 13.1 14.45 [--crop x,y,w,h] [--height 1000]` 把一段视频抽成 JPG（只裁她所在的竖条），`core/frames.js` 加载（`main.js` 的 `loadFrames`）：`vidFrame(id, 视频时刻)` 取最近的一帧、`framesInfo(id)` 拿裁切范围和底色；没有文件时返回 null，镜头里要有后备画法

**间奏二**：`shots/interlude2.js` 第十六轮重写（这一版现在是 `interlude2_r16.js`，`ia17=16`）。整个画面是一个 KSampler 节点（`chrome` 外框 / 标题栏 / 输入输出口 / `widgetRow`），四周的说明窗口（`condPanel` `queuePanel` `slotPanel` `consolePanel` `sigmaPanel` `previewPanel`，`withPanel` 管进场和让位），中间是每一步的画（`art74`…`art89`，82–88 的换图过渡在 `blend`）。σ 不加 shift（normal，线性）

**性能坑**：@napi-rs/canvas 里把几千个 `arc` 拼成一条路径再 `fill` 极慢（1.2 万个约 30 s）；画很多小圆点时每颗单独 `beginPath / arc / fill`

## 第十七轮补充

**切点**：`core/cuts.js` 多了 `CUT17 = { 小节: [时刻, 开关] }`——单独挪的切点各挂自己的开关（L10 42.80 `l09r17`、L16 74.61 `l15c17`），优先于 `CUT16`

**对时**：`data/lyrics_timing.json`（stable-ts）有几处比真实起音晚 0.1–0.6 s，多拍的字（声 = ♪）和弱起常错位。镜头里字或动作要卡在某个音上时，先查人声分轨 `build/stems/vocals.wav`（`.venv\Scripts\python.exe -I scripts\vocal_onsets.py 起 止 [--strong]`）：每 10 ms 的 RMS 和谱通量，辅音（k / t / d / ch）前会有一段 −30 dB 以下的空隙，空隙之后的起音就是这个音。改的时候把实测的时刻写成常量、注明出处（见 `l03.js` `ONSET17`、`l05.js` `KW17`、`l06.js` `T_A17`、`v2a.js` `ON14`）

**间奏二**：`shots/interlude2.js` 第十七轮再改（开关 `ia17`；16 = `interlude2_r16.js`，15 = `interlude2_r15.js`——第十八轮并掉 `ia16` 以后改成这样）。
- 两套界面色：`DK`（深色，74–81 和深色的步）、`LT`（浅色，画面本身浅的时候）；`lightAt(t)` 跟着换图的扫描线在两者之间过渡，`themeAt(L)` 给字色
- 74–81：外框 `FR` 贴边、`chromeVis` = 出现 ×（1 − 81 第 4 拍的推进 `push81`）；四周窗口 `withPanel`（81 滑出去以后不再回来）
- 提示词连线：`condLayout` 先量出每个词的框（不能用上一帧的），`attnLines` 画在窗口下面（`fan`：n 根直线、半拍换一次落点、错开），`attnPorts` 画窗口右边框上的出口亮点；目标点由 `art78`–`art80` 写进 `ATT.hot`，别的词按部位取（`labelPts`）
- `hackBody`：按 t 积分出的滚动量 + 行号哈希出每一行，所以随便取哪一帧都一样
- 82–88：全屏（`VF`），`topBar` 顶部进度条；换图 `art8x` 是第十五轮的扫描线；`memeMask` 字符画蒙版；`mergeAll` 九宫格九层合回一个（深度 / 法线自带底色，用剪影裁）

## 第十八轮补充

**实测起音**：
- `data/vocal_onsets.json` 存每句每个字在人声分轨里真正唱出来的时刻：按字序的数组，没测的是 null，只有数字。
- 引擎里用 `onset(id, i)`（`core/data.js`）取，没测的字退回 `lyric(id).chars[i].t0`。加载时会检查数组长度等于字数。
- 字或动作要卡在某个音上时用它，不要再在镜头里各写一份常量。第十七轮的 `ONSET17` / `KW17` / `T_A17` / `ON14` 只在回滚到 17 时用。
- 量法：`.venv\Scripts\python.exe -I scripts\vocal_onsets.py --line L03`，先数音、一个假名对一个音，再取起音，见任务单 10。

**立绘的宽高比和锚点**：
- `aspectOf(id)`、`sizeOf(id)` 取登记的真图宽高比 / 像素尺寸，`ANCHOR[id]` 是在新图上量的部位位置（归一化到整张图）。目前有 I05 的掌心、指尖、头顶，I08 的两肩中间、脸。
- 镜头里不要再写死 `1080 / 1920` 这类旧图比例：`photo(id, null, w, h, { keyed: true })` 是"装进框里"，比例不对人就缩小、居中掉下去。
- 立绘换新版时：重量锚点、按真图比例放，再出总览图核对。

**视频原画**：
- `vidFrame` 早于抽帧起点返回 null，不再夹到第一帧，镜头里照旧要有后备画法；晚于终点仍夹到最后一帧。
- V10 第十八轮重抽：`node scripts/video_frames.mjs V10 11.9 14.45`（62 张）。重抽前先把旧的 `build/frames/V10/` 挪走，脚本见到旧帧会停。

**声线切换面板**：`core/ui.js` 的 `VS_T` 是两版时间表（17 / 18，开关 `vs18`）。要调快慢改表里的数，不要散改。

## 第十九轮补充

**全片用实测起音**：
- `lyric(id)` / `keyword()` / `lyricAt(t)` 在 `on19` ≥ 19 时返回实测版（`core/data.js` 的 `measuredLyrics`）。每个字的 `t0` 是 `data/vocal_onsets.json` 的实测值。
- 没测的字：标点跟后一个字，其他在前后两个实测字之间插值，整句没测（L01）照旧用对时数据。
- 要对比旧时刻用 `rawLyric(id)`；要知道某个字的来源用 `onsetInfo(id, i)`，返回 `{ raw, meas, used, kind }`。
- 镜头里照旧用 `lyric` / `keyword` 的 `t0`，不用再自己写实测常量。

**切点**：
- `cutAt(b)` = 旧规则的 `cutAtOld(b)` + `cutShift(b)`（`cut19` ≥ 19 时）。实测的第一个字和对时数据差 3 帧以上就挪同样多。
- `BAR_LINE` 是小节 → 句号的表。`CUT17` 里用户点名定的不挪。

**对时调试面板**（`core/timingdebug.js`，开关 `tdbg19`）：第二十轮按用户要求删了（文件和开关都删了，要看去翻第十九轮的快照）。

## 第二十轮补充

**视频帧预取**（帧多的视频，目前是 V11_3，1890×1080 124 张）：
- 全部解码要一个多 GB，所以 Node 里只留 JPG 原始字节。镜头用 `registerPrefetch(t => [[id, vt], …])` 登记这一刻要哪几帧；`render.mjs` / `sheet.mjs` 每画一帧前 `await prepareFrame(t)`（`main.js`）把它们异步解码进缓存，画面仍然只由 t 决定。
- 自己写出片脚本时也要先 `await prepareFrame(t)` 再 `renderFrame`，否则 L29 那段是空的（镜头会退回后备画法）。
- `@napi-rs/canvas` 的 `Image.src = Buffer` 不会同步解码（画出来是空的），解码只能用异步的 `loadImage`（`platform-node.js` 的 `decodeImage`）。
- 浏览器预览：后台加载，先画已经到了的最近一帧，到了用 `onFrameLoaded` 重画（暂停时也能看到）。
- 帧少的（V10，62 张）照旧加载时一次全部解码。
- `trackOf(id)` 取 `build/frames/<id>_track.json`（`scripts/video_track.py` 算的逐帧人物包围盒）。换了视频要重抽帧、重跑这个脚本。

**切点**：`cutAt(b)` 再加 `CUT_LATER20`（2 帧，开关 `cut20`），只加在按字算的切点（`BAR_LINE` 里的小节）上。

**字标**：`core/logo.js` 的 `drawLogo(ctx, S, o)`，前奏（`intro.js`）和结尾（`outro.js` outro4）共用，开关 `title20`。参数见文件头。

**间奏二第十五轮版**：第二十一轮用户说不用专门保留了，`interlude2_r15.js` 和开关 `ia15` 都删了（快照里有）。

## 第二十一轮补充

**大字**：`core/bigtype.js` 的 `bigType(ctx, S, o)`——第三段起的大字一律用它（代码格子拼的立体字，和片名字标同一套）。参数见文件头；中文 `ZH_KEYS`（得意黑），日文 `JP_KEYS`（Dela Gothic）。得意黑没有 風揺電広 这些日文汉字，Dela 没有 飞码长 这些简体字。开关 `type21`。

**歌词起音的上一版**：`vocal_onsets.json` 里 `_旧20`（第二十轮的数，`on21=20` 时用）、`_旧`（第十九轮的数，`on20=19` 时用）。`on19` / `cut19` 第二十一轮并进代码了。

**跨镜头的人**：转场叠层里画一个她、两个镜头在转场时间里都不画她（`her2728`、`her2829`，以前的 `her1314` 同理）。叠层的起点 / 终点用函数按"那一刻"算（`i08At27`、`i08At28`、`herBox`），不要写死。

## 第二十二轮补充

**大字换成点阵字**：`core/dottype.js` 的 `dotType(ctx, S, o)`（和 0:16「歌」同一种）。参数见文件头；`keys` 用 bigtype.js 的 `ZH_KEYS` / `JP_KEYS`。返回每个字的中心。（开关 `type22` 第二十四轮已并进代码，`bigType` 不再用）。

**片子前面某一刻的画面**：`core/memory.js` 的 `memoryFrame(t, w)` 返回一张缩略图画布（第一次用到时用 `renderFrame` 画一遍、缓存）。画法由 `main.js` 的 `setMemoryRenderer` 注册（会跳开转场窗口）。规矩：
- 在镜头函数**开头**先调用（预热），不要画到一半再调——画别的时刻会占用缓冲池（`pooled`）里外面这一帧可能正在用的缓冲；
- 时刻不要落在 L29（V11_3 的帧要 `prepareFrame` 预解码，这里画不到）；
- 可以嵌套（尾奏回放到 L32，L32 又要前两分钟的画面），最多 3 层。

**结构化图形**：`core/struct22.js` 的 `satellite`（引线 + 四角框 + 内容的卫星面板，anchor 是主体上的点）和 `tickRing`（一圈刻度，扫描头每拍走一格）。（开关 `dense22` 第二十四轮已并进代码）。

**气泡**：`core/ui.js` 的 `speechBubble(ctx, x, y, w, h, r, tipX, tipY, bw)` 只建路径（矩形 + 尾巴一条），自己 `fill()` / `stroke()`。尾巴尖要在矩形下面（`tipX ≥ x`）或左边（`tipX < x` 且在矩形高度范围内）。

**回滚开关在表里**：`timeline.js` 的 `TRANS_TABLE` 改成了函数（以前模块加载时就求值，`--rev` 对转场不起作用）。以后在常量表里用 `rev()` 也要写成函数、画帧时再求值。

**制作信息的修改意见**：`node scripts/credits_prompt.mjs` 重新生成 `data/credits_prompt.json`（读 `文档/打磨意见记录.md` 里第八到第二十一轮的摘要和 `归档/修改方案/` 里的意见原文，歌词换成 ♪）。`core/data.js` 读到 `D.creditsPrompt`，没有这个文件时是空数组。

## 第二十三轮补充

**manifest 里的 `build/` 路径**：`assets/illust/manifest.json` 的文件名默认相对 `assets/illust/`；以 `build/` 开头的按项目根目录算（`core/portrait.js` 的 `pathOf`）。用来登记脚本生成的副本，比如 `scripts/qn_resize.mjs` 把 `assets/illust/QN/` 的种子图缩成 768² 存到 `build/illust_q/Q01.png …`。

**一行里写多条语句时，说明别插在中间**：`// 说明` 后面的代码会一起被注释掉（第二十三轮 L31 的 `g.restore()` 就是这样丢的，save / restore 不配对，后面的 HUD 全变淡，不报错）。说明写在行尾或单独一行。

**每轮开工**：根目录的 `NN轮修改方案.md` 先复制到 `归档/修改方案/`；`scripts/credits_prompt.mjs` 的 `ROUNDS` 加一行再跑。
## 第二十四轮补充

**封面**：现在的画法和用法见下面「第二十八轮补充」。

**V11_3**：`core/frames.js` 的 `loadFrames` 加了 `V11_3`（`build/frames/V11_3/` 124 张 + `V11_3_track.json`）。L29 的视频时间是 `v3b.js` 的 `vt24(t)`：锚点表 `A24` + 单调三次插值。第二十五轮起帧是从用户超分的 `assets/video/V11_3_1_ghq5.mp4` 抽的（1920×1080 是从 7:4 横向拉伸的，抽的时候缩回 1890×1080）：`ffmpeg -i assets/video/V11_3_1_ghq5.mp4 -vf scale=1890:1080:flags=lanczos -q:v 3 build/frames/V11_3/%03d.jpg`（先清掉旧帧；别用 `video_frames.mjs V11_3`，它找的超分前原版第二十七轮删了）。超分版每帧左右自带 14 / 16 px 黑边，`v113Cut` 抠图前把它当底色、画原图时跳过。换成别的视频的话：抽帧、`.venv\Scripts\python.exe -I scripts\video_track.py V11_3`，再按新视频的动作改 `A24` 和 `CLICK24 / PAT24 / CONNECT24 / TOUCH24`。

**`crtAt(t)` 多返回了 `cx` / `cy`**：落点以后显示器中心会往下挪（`l01d24`），画在显示器上的东西用 `g.cx` / `g.cy`，不要再用常量 `CRT_C`。

**每轮开工**：查一遍全项目的冲突副本，比对后直接删（AGENTS.md）。

## 第二十五轮补充

**抖动渐变（`core/dither.js`）**：`ditheredRadial(w, h, [x0, y0, r0], [x1, y1, r1], col0, col1, amp = 1.6)` 和 `createRadialGradient` 同一套参数（两个色标），逐像素算、加 ±amp 级三角分布抖动再量化，按参数缓存成画布，`drawImage` 铺上去。大面积、颜色跨度小的渐变（深色底）用它，免得出片有一圈圈色带。

**纸面网格（`shots/scene.js` 的 `gridStep(t)`）**：返回 `[格宽, 格高]`，第三段进场（90 小节）起是 48 × 48 方格，之前 48 × 80。自己画和纸面对齐的网格 / 格点时用它，别写死 48、80。

**两个镜头各画一份的跨剪辑点元素**：L26 → L27 的气泡词（`v3a.js` `gather27`）、L28 → L29 往下掉的 logit lens 窗口（`plates28` / `fallPlates28`，v3b 的 L29 也调）、第二十四轮的太阳（`sunFly24`）都是这样：同一个只由时刻决定的函数，前后镜头各在自己的人物之前画一次，叠化时重合。

**转场圆心跟着主体走**：iris 的参数可以给 `at(t) → { x, y }`（L30：`v3b.js` `heart30At`，L30 开头相机先偏到 L29 的交互点、再推回中间，圆心跟着像素心）。

**第二十六轮**：并掉第二十四轮的开关时删了 L29 第二十、二十一轮那一版（旧 V11 视频），`core/frames.js` 不再加载 `V11`；`l01.js` 的 `candidates()` 导出给 `drop.js` 的「歌」候选格用（`geSampling`）；尾奏节点 `node22` 里 Preview Image 在预览开始放时就画成完全不透明（`out26`）。

**L31 的图生图链**：`assets/illust/QN/Q1–Q7.png` → `build/illust_q/QC1–QC7.png`（`scripts/qn_resize.mjs`；Q1.png 是改了名的种子 ComfyUI_16694_，种子编号按原名排、不变）。`v3b.js` 的 `pick31(t, ids)` 决定大卡片里此刻是哪一张。

## 第二十七轮补充

**剪影里让一段弯起来**（L19 的尾巴，`v2b.js` `tail10`）：把 I10 剪影里尾巴那段（原图坐标的区域 `TAIL10`）挖出来存成不透明度表，每帧绕尾巴根逐像素反向旋转取样（双线性），角度随离根的距离变大，离根 `r0` 以内不动——切口都落在不动的这一圈里，就没有接缝。摆角 `tailAngle19(t)` 取 V8 蒙版里尾巴的实测质心（`v8Phase` 按 L20 同样的 1.5 倍速往返算帧号，相位和 L20 接上）。同样的办法可以用在别的"一段在摆"的剪影上。

**视频帧的黑边**：抠白底的洪水填充从四条边起步，边上有素材自带的黑条时起不了步，黑条会留在画面里。`v3b.js` 的 `v113Cut` 抠图前把左右黑边涂成底色、画原图时跳过（`l29e27`）。

**前奏结尾不再定格**：`intro.js` 的 `scene` 里 `frozen` 只在 `i13f27` 填 26 时生效；落点前那一拍只剩"吸气"的轻微缩小。
## 第二十八轮补充

**公开仓库里没有的文件，引擎有退路**（有这些文件时画面和以前一模一样）：
- 歌词文本 `资料/电子天使-歌词.txt` 不在：`core/data.js` 的 `buildLyrics` 每个字用 ♪ 顶替（字数照 `data/lyrics_timing.json`），控制台提示一句。
- 人设图 `资料/鲸鱼娘人设图.png` 不在：`core/portrait.js` 现场画一张 1/4 大小的灰色人形当占位（`CROPS` 跟着乘 `PH_SCALE`），只有没登记的编号用得到。
- 音频 `assets/audio/电子天使.mp3` 不在：`render/render.mjs` 出无声的片子。
- 字体不在：`core/glyphs.js` 的 `registerFonts` 跳过缺的文件、由系统字体顶替（字宽会变），控制台列出缺了哪些。

**导出公开仓库**：`node scripts/export_github.mjs [目标文件夹]` 按白名单复制（不带音频、人声分轨、歌词、原始视频、没用到的素材和字重、内部文档），再叠上项目根目录 `github/` 里给公开仓库写的 README、LICENSE、NOTICE、.gitignore、docs/。目标文件夹里除了 `.git`、`node_modules` 都会先清空。字体不导出；立绘在副本里缩小（长边超过 2048 px 的缩到 2048，B / S 系列缩到 1024——代码里它们最大只画到 512 px）。复制完在副本里把注释和文档里的歌词片段换成 ♪（JS 只改注释，用一个小词法扫描认出字符串、模板字符串、正则；改过的 JS 自动 `node --check`）——项目里的原文件不动（用户：自己的文件夹全部保留）。

**封面**：`engine/shots/cover.js`（`cover(ctx, S, { img })`，只出 1920×1080，不超采样），倾斜的窗口拼贴 + 以脸框为基准的网格、文字组和识别框，见 `文档/视频封面设计方案.md`。`node render/cover.mjs` 增量保存：接着 `out/封面/` 里最大的编号存 `封面_NN.png`（`封面3.png`、`封面_03.png` 两种写法都认）。封面上写的分辨率跟着 `OUT_W`×`OUT_H` 走。背景窗口里的片子画面用 `memoryFrame` 取，要在画别的之前先取。

**出片尺寸和超采样**（用户：视频改成 2560×1440；后来定成直接放大 2 倍、出 3840×2160，不再缩）：
- `core/const.js` 的 `OUT_W, OUT_H, SS`：现在是 3840、2160、2。**镜头里的坐标一律还是 W×H（1920×1080）**，不用改。出片时 `render.mjs` 在 SS 倍的画布上画，正好就是 3840×2160，直接交给 ffmpeg；OUT 和 SS 倍的尺寸不一样时（比如 `--ss 1` 草稿，或以后要别的尺寸）才用高质量插值缩放一次。改回 1920、1080、1 就是原来的 1080p（公开仓库导出时自动改回这个）。
- 只用整数倍（SS = 2），不按 4/3 之类直接画：非整数倍时相邻色块的边落在半个像素上，抗锯齿会在每条接缝留一道浅色细缝（字符格、马赛克到处都是）。2 倍时边都在整像素上，没有缝。
- **高清画布** `hiCanvas(w, h)`（`core/env.js`）、`pooled(key, w, h, true)`：底层 SS 倍大、自带 SS 倍的变换，对外仍按逻辑像素——`width` / `height`、`setTransform` / `getTransform`、`filter` 和 `shadowBlur` / `shadowOffset` 里的像素数（Skia 里这几样不跟变换缩放，这里替它乘 SS）、当源图 `drawImage` 时的源矩形、`getImageData` / `putImageData`（读时缩回逻辑尺寸、写时最近邻放大）。SS = 1 时它就是 `newCanvas`。
- **哪些是高清的**：主画布、转场的两块整屏缓冲、所有整屏 `pooled(…, W, H, true)`、字形图集页、`photo()` 缓存的立绘（传 `{ hi: false }` 不要）、合成立绘 / 面板的缓存（l02、l04、l06 手、l07 前排面板、l11、l13 迷你窗、l14、l19 透视墙窗口、l28 logit lens、i1 网格和 toast、字标和巨字的缓冲、公式墙纸、高清图的染色副本）。
- **哪些故意不是**：拿来逐像素取样的小图（马赛克、粒子、字形蒙版、分区图）、靠低分辨率出效果的（像素化转场、潜空间预览、景深模糊的小缓冲）、视频帧和由它抠出来的缓存（源就是 1080p）、`keyed()` 抠图（`photo` 会按 2 倍取它，够用）。这些画上去时跟着放大，清晰度和以前的 1080p 一样。
- 写新镜头：要画大的缓存、整屏缓冲用 `hiCanvas` / `pooled(…, true)`；要逐像素读写的小图用 `newCanvas`。不要拿高清画布每帧 `getImageData`（要先缩一次，慢）。
- **耗时和内存**：超采样后平均每帧绘制约 0.5 s（1080p 约 0.2 s），加上 4K 编码，这台 2 核机器上约 1 s 一帧；每个进程约 4.5 GB 内存（画帧约 2.7 GB + 它的 ffmpeg 编 4K 约 1.8 GB）。内存不够时 Skia 不一定报错，画面里会悄悄少东西（实测：四个进程同时跑时有几帧窗口内容全空），所以 `render.mjs` 默认的进程数按"总内存 / 4.5 GB"封顶。CRF 16 时码率约 29 Mbps（全片约 700 MB）。
- 核对办法：同一批时刻 `--ss 1` 和超采样各画一遍、都缩到 960×540 比，差别应该只在边缘（每 32 px 块的平均差 ≤ 约 20/255）；整块不一样就是哪里坏了。