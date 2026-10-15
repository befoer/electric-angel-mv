# 字体

为了让仓库小一点，**字体不放在仓库里**，要自己下载放进 `assets/fonts/`。全部是免费的 SIL Open Font License 1.1 字体。

缺字体时引擎照样能跑，缺的那几个由系统字体顶替，控制台会列出缺了哪些；不过字宽会变，窗口里排得很满的字可能出框。想和成片一样，就把下面这些文件都放齐。

字体表在 `engine/core/glyphs.js` 的 `FONTS`：每个字体串最后都垫更纱黑体，前面的字体缺字时由它补。**文件名要和下表一致**，下载下来的名字不一样就改名，或者改 `FONTS` 里的路径。

| 键 | 字体 | 放到 `assets/fonts/` 的文件名 | 用在哪 | 下载 |
|---|---|---|---|---|
| SC / SCB | 更纱等宽黑体 SC | `SarasaMonoSC-Regular.ttf`、`SarasaMonoSC-Bold.ttf` | 正文、界面、所有字体串的后备 | [be5invis/Sarasa-Gothic](https://github.com/be5invis/Sarasa-Gothic/releases)（下 Sarasa Mono SC 的 TTF） |
| J / JB | 更纱等宽黑体 J | `SarasaMonoJ-Regular.ttf`、`SarasaMonoJ-Bold.ttf` | 日文、等宽数字 | 同上（Sarasa Mono J） |
| RES / RESB | 资源圆体 Medium / Heavy | `资源圆体 Medium.ttf`、`资源圆体 Heavy.ttf` | 圆体标签、胶囊 | [CyanoHao/Resource-Han-Rounded](https://github.com/CyanoHao/Resource-Han-Rounded/releases)（下简体中文的 Medium、Heavy，改成左边的名字） |
| ZEN / ZENB | Zen Maru Gothic | `ZenMaruGothic-Medium.ttf`、`ZenMaruGothic-Black.ttf` | 会注册，实际被资源圆体替代 | [Google Fonts](https://fonts.google.com/specimen/Zen+Maru+Gothic) |
| SMILEY | 得意黑 | `SmileySans-Oblique.ttf` | 点阵大字的字形、标题 | [atelier-anchor/smiley-sans](https://github.com/atelier-anchor/smiley-sans/releases) |
| DELA | Dela Gothic One | `DelaGothicOne-Regular.ttf` | 日文大字 | [Google Fonts](https://fonts.google.com/specimen/Dela+Gothic+One) |
| DOT | DotGothic16 | `DotGothic16-Regular.ttf` | 像素字（明朝体 MIN 的位置都换成了它） | [Google Fonts](https://fonts.google.com/specimen/DotGothic16) |
| MIN0 | Shippori Mincho B1 ExtraBold | `ShipporiMinchoB1-ExtraBold.ttf` | 1:45 的明朝体大歌词、封面的衬线标签 | [Google Fonts](https://fonts.google.com/specimen/Shippori+Mincho+B1) |
| KAI | 霞鹜文楷 | `LXGWWenKai-Regular.ttf` | 心声、思考文字 | [lxgw/LxgwWenKai](https://github.com/lxgw/LxgwWenKai/releases) |

一共 13 个文件、约 180 MB。换别的字体也一样：文件放进 `assets/fonts/`、改 `FONTS` 里对应键的路径。
