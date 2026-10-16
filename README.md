# 如果代码能长出海

![封面](docs/cover.jpg)

以 DeepSeek 鲸鱼娘为主角的非商业二创 MV（音乐用的是小缘翻唱版《电子天使》的音频），**每一帧都由代码画出来**：没有 AE、没有剪辑软件，一个用纯 JavaScript + Canvas 写的小引擎，给定时刻 t 就画出那一帧（191.69 s、60 fps；公开版默认出 1920×1080，成片是把 `engine/core/const.js` 里的出片尺寸改成按 2 倍画、出 3840×2160）。

> An unofficial, non-commercial fan MV for "電子天使 / Electric Angel" (the soundtrack is 小缘's cover version), featuring the DeepSeek whale-girl fan character (DeepSeek 鲸鱼娘). Every frame is a pure function of time `t`, drawn by a small JavaScript Canvas engine (Node + `@napi-rs/canvas` for rendering, the same code runs in the browser for preview). Song audio and lyrics are **not** included.

非官方作品，与 DeepSeek、原曲作者和翻唱者都没有关联，只是使用了小缘翻唱版的音频。

## 仓库里有什么、没有什么

| 有 | 没有（有版权，或者太大） |
|---|---|
| 引擎和全部镜头代码（`engine/`）、出片脚本（`render/`）、数据处理脚本（`scripts/`） | 歌的音频、从歌里分离的人声分轨 |
| 从歌里分析出来的节拍、起音、频谱等数据（`build/*.json`、`data/`），歌词的**逐字时间**（不带字） | 歌词文本 |
| 片中用到的角色立绘、表情包（`assets/illust/`，大图缩到长边 2048 px），从视频素材算出来的剪影、分区图、抽帧（`build/`） | 原始视频素材（`assets/video/`） |
| 打磨准则 skill（`.claude/skills/mv-polish/`） | 字体（约 180 MB，都是免费字体，自己下载，见 [docs/FONTS.md](docs/FONTS.md)） |
| | 制作过程中的内部文档、出片成品 |

没有音频、歌词、字体也能跑：出片是无声的，画面里歌词的位置每个字显示成 ♪，缺的字体由系统字体顶替。想要和成片一样，按 [docs/FONTS.md](docs/FONTS.md)、[assets/audio/README.md](assets/audio/README.md)、[资料/README.md](资料/README.md) 自己放进去。

## 快速开始

需要 [Node.js](https://nodejs.org/) 24 以上；出视频还要 [ffmpeg](https://ffmpeg.org/)（在 PATH 里）。

```bash
npm install
node render/serve.mjs                                        # 浏览器预览：http://127.0.0.1:8099/engine/index.html（?bar=12 从第 12 小节开始）
node render/render.mjs --png 14.6 16.2                       # 画两帧 → out/单帧/
node render/sheet.mjs --every 1 --from 0 --to 60 --out out/sheet.png   # 每秒一张的总览图（不用出片）
node render/render.mjs --bars 1-33 --preset veryfast         # 出一段片子 → out/bars_1-33.mp4
node render/render.mjs                                       # 出全片（2 核约 30 分钟，会按 CPU 核数分段并行）
node render/cover.mjs                                        # 视频封面 → out/封面/封面.png
```

仓库约 120 MB（大部分是立绘和从视频算好的数据），`npm install` 只装一个画布库。先把字体放进 `assets/fonts/`（[docs/FONTS.md](docs/FONTS.md)），不然字形和成片不一样。

## 想学什么，看哪里

- **[docs/HOW_IT_WORKS.md](docs/HOW_IT_WORKS.md)**：引擎怎么组织的——时间轴、镜头、转场、版本开关、为什么每帧只由 t 决定、出片怎么并行。
- **[engine/README.md](engine/README.md)**：写镜头的接口和硬规则（相机、纸面、HUD、点阵字、字体、视频蒙版……），按轮次记的补充说明。
- **[engine/RECIPES.md](engine/RECIPES.md)**：按问题查的现成写法——连续变速曲线、由内到外弹出、跨剪辑点的元素、碰撞积分、并集描边、抖动渐变、剪影里让一段尾巴弯起来……都标了在哪个文件、哪个函数。
- **[.claude/skills/mv-polish/](.claude/skills/mv-polish/SKILL.md)**：从二十多轮审片意见总结出来的通用打磨准则和交付前自查清单（动效要有过程、画面比声音早一点、转场带一个元素跨过剪辑点……）。用 Claude Code 打开这个仓库时会自动作为 skill 加载。
- **[docs/REPLACE_CHARACTER.md](docs/REPLACE_CHARACTER.md)**：换成别的角色要换哪些图、重算哪些数据、改哪些坐标。
- **[docs/素材Prompt清单.md](docs/素材Prompt清单.md)**：片中每张立绘、每段视频素材的用途和生成提示词。

## 目录

```
engine/         引擎：core/（时间、数据、字形、相机、转场、蒙版、抖动渐变……）、shots/（每个镜头）、timeline.js（镜头表、转场表）、rev.js（版本开关）
render/         出片（render.mjs）、总览图（sheet.mjs）、封面（cover.mjs）、预览服务器（serve.mjs）
scripts/        数据处理：音频分析、歌词起音实测、视频蒙版 / 分区图 / 抽帧 / 跟踪、素材缩图……（Python 的依赖见 scripts/requirements.txt）
data/           歌词逐字时间（不带字）、实测起音、屏幕上技术数字和公式的出处表（facts.json + FACTS_SOURCES.md）
build/          从音频、视频素材算好的中间数据（节拍、频谱、剪影、分区图、抽帧）
assets/         立绘（illust/，manifest.json 登记编号 → 文件）；字体放 fonts/、音频放 audio/（都要自己放）
资料/            放你自己的歌词文件
```

## 许可

- 代码（`engine/` `render/` `scripts/`）：MIT，见 [LICENSE](LICENSE)。
- 角色立绘、表情包、封面主图和从它们算出来的数据：见 [NOTICE.md](NOTICE.md)。
- 字体不在仓库里，都是 SIL Open Font License 1.1 的免费字体，来源见 [docs/FONTS.md](docs/FONTS.md)。
- 歌曲和歌词不在本仓库里，版权归原作者：原曲 ヤスオP「えれくとりっく・えんじぇぅ」；成片使用的是小缘翻唱版（BV1xs41167Ee）的音频。

作者：烧猫定食
