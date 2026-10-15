# NOTICE

这是一个非官方、非商业的二创作品，与 DeepSeek、原曲作者、翻唱作者都没有关联。画面里出现的 DeepSeek 风格界面是仿制的演出，不是官方素材。

| 内容 | 位置 | 授权 |
|---|---|---|
| 源代码、文档 | `engine/` `render/` `scripts/` `docs/` | MIT（[LICENSE](LICENSE)） |
| 角色立绘、表情包、封面主图（作者用 AI 绘图工具生成的二创图像；仓库里的大图缩到了长边 2048 px） | `assets/illust/` | CC BY-NC-SA 4.0：可以在注明出处、非商业、以同样方式共享的前提下使用和改编 |
| 从立绘和视频素材算出来的剪影、分区图、抽帧、缩图 | `build/frames/` `build/masks/` `build/maps/` `build/illust_q/` | 同上，CC BY-NC-SA 4.0 |
| 从歌曲分析出来的节拍、起音、频谱、逐字时间 | `build/*.json` `data/` | 只是分析数据，不含音频和歌词文本；随代码以 MIT 提供 |
| 字体 | 不在仓库里（自己下载放进 `assets/fonts/`） | 都是 SIL Open Font License 1.1，来源见 [docs/FONTS.md](docs/FONTS.md) |
| 打磨准则 skill | `.claude/skills/mv-polish/` | MIT |

**不在本仓库里的**：歌曲音频、人声分轨、歌词文本、原始视频素材、字体。歌曲版权归原作者——原曲 ヤスオP「えれくとりっく・えんじぇぅ」，翻唱 小缘（BV1xs41167Ee）。

屏幕上出现的技术数字和公式的出处见 `data/FACTS_SOURCES.md`；编出来的演出用数字在那里标为"演出值"。
