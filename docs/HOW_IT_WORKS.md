# 引擎是怎么组织的

## 一句话

`renderFrame(ctx, t)` 画出时刻 t 的那一帧，**只依赖 t**：不用 `Math.random`、不用 `Date`、不读上一帧。伪随机用按编号的哈希（`core/rand.js` 的 `rnd` / `hash` / `vnoise`），物理效果（碰撞、弹簧、漂浮）写成 t 的解析式或"从事件那一刻起按固定步长积分"。所以任意一帧都能单独重算——出片可以按 CPU 核数切段并行，浏览器预览可以随便拖时间，总览图可以只画几帧。

同一套代码跑在两个环境里：浏览器（`engine/platform-browser.js`，预览）和 Node（`render/platform-node.js`，用 `@napi-rs/canvas` 出片）。环境只提供画布、读文件、注册字体几个接口（`core/env.js`）。

## 一帧是怎么画出来的（`engine/main.js`）

1. `shotAt(t)` 查镜头表（`engine/timeline.js` 的 `TABLE`）：按小节划分的 40 来个镜头，每个是一个函数 `fn(ctx, S)`。`S` 是这一刻的状态（`core/state.js` 的 `makeState`）：歌曲时间、第几小节第几拍、拍内相位、这一刻的调色板、音频的能量包络……
2. `transitionAt(t)` 查转场表（`TRANS_TABLE` / `TRANS_R9`）：剪辑点前后一小段时间里，前后两个镜头各画进一块缓冲，再按转场类型（`core/trans.js`：叠化、甩镜、遮罩展开、跨镜头元素叠层 `overlayCut`……）合成。前一个镜头在转场里继续走，不定格。
3. `overlays` 画跨镜头的全局叠层。

切点不一定在小节线上：每句歌词的镜头切在这一句第一个字唱出来前约 1 帧（`core/cuts.js` 的 `cutAt`），画面比声音早一点。镜头里"从哪一刻开始"一律在画帧时用 `cutAt(小节)` 取。

## 镜头怎么写

每个镜头文件（`engine/shots/*.js`）用同一套骨架：`camAt` 按关键帧算相机 → `paper` 画纸面网格 → `backDeco` 远景虚化 HUD → `withCam(ctx, cam, 深度, g => …)` 在相机下画主体（深度决定视差）→ `frontDeco` 近景 → `hud` 角落的读数。常用部件在 `core/`：

| 模块 | 管什么 |
|---|---|
| `core/time.js` | 节拍网格（`barStart` `beatTime`）、缓动（`smooth` `easeOut` `easeOutBack`…）、`decay` |
| `core/data.js` | 加载分析数据；`lyric(id)` / `keyword(id, a, b)` 按句号和字序号取歌词（代码里不写歌词原文） |
| `core/glyphs.js` | 字体表、带后备字体的字体串 `fonts()`、按大写字母高度居中的 `midText` |
| `core/cam.js` | 相机、`withCam`、缓冲池 `pooled`、透视贴图 |
| `core/dottype.js` | 点阵大字：点从画面里的东西飞出来拼成字、扫描线、随拍涟漪 |
| `core/struct22.js` | 连在主体上的卫星面板 `satellite`、刻度环 `tickRing` |
| `core/masks.js` `core/segmaps.js` `core/frames.js` | 视频素材的剪影、分区图（边缘 / 线稿 / 深度 / 法线）、抽帧 |
| `core/dither.js` | 逐像素算 + 抖动量化的渐变（大面积深色渐变不出色带） |
| `core/memory.js` | 片子里前面某一刻的缩略图（画面里的画面） |

更多见 [engine/README.md](../engine/README.md)（接口和硬规则）和 [engine/RECIPES.md](../engine/RECIPES.md)（按问题查的写法）。

## 版本开关（`engine/rev.js`）

每条修改意见的改动挂一个键，值是轮次；旧版本的分支在代码里留一轮。`--rev 键=旧轮次`（总览图、出片都支持，预览页用 `?rev=键=旧轮次`）就能临时看上一版，方便逐条对比、单独回滚。开关只在画帧时读，不在模块加载时读。

## 数据从哪来

| 数据 | 文件 | 怎么来的 |
|---|---|---|
| 节拍、小节、能量包络 | `build/beats.json` `build/bars.json` `build/grid.json` | `scripts/analyze_audio.py` `beat_grid.py` `bar_map.py`（需要音频） |
| 人声频谱、起音 | `build/vocal_spec.json` `data/vocal_onsets.json` | 先 `scripts/separate.py` 分离人声，再 `vocal_spec.py`；起音用 `vocal_onsets.py --line Lnn` 按音高数音、一个字对一个音 |
| 歌词逐字时间 | `data/lyrics_timing.json` | `scripts/align_lyrics.py`（只存时间，不存字） |
| 公式 | `build/formulas.json` | `data/formulas.json` 里的 TeX 用 `scripts/build_formulas.mjs`（MathJax）排成矢量路径 |
| 视频剪影 / 分区图 / 抽帧 | `build/masks/` `build/maps/` `build/frames/` | `scripts/video_masks.mjs` `video_maps.mjs` `video_frames.mjs` `video_track.py`（需要原始视频） |
| 屏幕上的技术数字 | `data/facts.json` | 每个数字的出处在 `data/FACTS_SOURCES.md`，编的标"演出值" |

仓库里这些数据都已经算好，直接能用；只有换歌、换视频素材时才需要重跑脚本（Python 依赖见 `scripts/requirements.txt`，音频分离另外要 demucs）。

## 出片（`render/render.mjs`）

按 CPU 核数把帧区间切成几段，每段一个子进程：画一帧 → 原始像素写进 ffmpeg 的标准输入（libx264）。全部画完以后 concat 成一个文件，再把音频按同一个起点切好混进去（没有音频就出无声的）。成片从 0.6 s 开始（片头没有音乐的那段裁掉，`core/const.js` 的 `filmStart`）。

`render/sheet.mjs` 不出视频，直接把若干时刻画成缩略图拼成一张大图（每秒一张、或者每个转场 6 张），审片和回归比对都用它。
