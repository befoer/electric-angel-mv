# DS娘 · 素材 Prompt 清单

> 2026-10-04 修订 · 配套文档：[项目方案.md](项目方案.md) · [视觉方案.md](视觉方案.md)
> 编号：I = 立绘，S = Q 版表情包，V = 舞蹈视频

---

## 一、写法规则

1. **角色长相、发型、服装、配饰交给 LoRA**，prompt 里不另外描写；但**要带上 LoRA 的触发词**（用户 2026-10-08）。全身图用全套，半身 / 特写去掉下半身的词（裙摆金边、尾巴、袜子、鞋）：
   - 全身：`deepseek_maid_outfit, navy blue maid dress, white frilled apron, blue whale emblem, dark blue neck bow, blue gemstone brooch, puff sleeves, long sleeves, gold trim, blue whale tail, starry tail pattern, frilled thighhighs, white thighhighs, thighhigh bows, black mary janes, ankle strap shoes, low heels, fins, ahoge, white bow`
   - 半身：`deepseek_maid_outfit, navy blue maid dress, white frilled apron, blue whale emblem, dark blue neck bow, blue gemstone brooch, puff sleeves, long sleeves, fins, ahoge, white bow`
   - 本清单里第七轮以前写的 prompt 没带触发词，用的时候按全身 / 半身在前面接上对应的一套。
2. **不写质量词和画风词**：masterpiece、best quality、ultra detailed、anime illustration 之类一律不加。
3. prompt 只写：姿势 / 动作、表情、镜头 / 构图、光线、背景、留白。
4. 需要某个部位一定入画时，只写"可见"，不描述它长什么样，例如 `whale tail visible`。
5. LoRA 压过了动作描述时，给对应的词加权，例如 `(arms spread wide:1.2)`。

---

## 二、背景与交付

- **纯白 `#FFFFFF` 背景**，无渐变、无投影、无环境色。
- 能在 ComfyUI 里直接出透明 PNG 更好（加一个抠图节点，如 BiRefNet 或 isnet-anime），白底原图也一起留着。
- 不用色度键背景（洋红、绿幕）：LoRA 会改配色，没法预设安全的抠像色，底色还可能被当成服装配色。
- 尺寸：立绘长边 ≥ 2048 px；眼部特写宽 ≥ 2048 px；表情包 1024×1024。
- 存放与命名：立绘和表情包放 `assets/illust/`，如 `I01_全身.png`、`I04b_眼_半闭.png`、`S03_吐泡泡.png`；视频放 `assets/video/`，如 `V1_转身.mp4`。

---

## 三、用途总表

| 编号 | 素材 | 用在（视觉方案 §五） | 批次 |
|---|---|---|---|
| I01 | 全身正面站姿 | 字符画与像素头像的主源图；L02、L08、L20；间奏二 M1 填色；V1–V6 的参考图 | 一 |
| I02 | 半身 · 闭眼轻唱 | L03、C1 少女版 | 一 |
| I03 | 半身 · 开口唱歌 | L01、L04、C2 萝莉版 | 一 |
| I04a/b/c | 眼部特写 · 睁 / 半闭 / 闭 | L25 眨眼；各段插闪 | 一 |
| I05 | 伸手向镜头 | L06、L18 | 二 |
| I06 | 抱膝蜷坐 | L13、L14 | 二 |
| I07 | 漂浮 | 三次副歌 C3 | 二 |
| I08 | 仰望 · 双臂展开 | L27、C4 少女版 | 二 |
| I09 | 正侧面半身 | L15；间奏二 88 小节 | 二 |
| I10 | 背影全身 | L19 | 三 |
| I11 | 双手捧起 · 掌心朝上 | L05 | 三 |
| S00 | Q 版头像 | 对话窗口标题栏、尾奏气泡 | 二 |
| S01–S10 | Q 版表情包 | 尾奏弹出的贴纸 | 二 |
| B01–B16 | ComfyUI 批量图（第八轮加，§五b） | 特效音间奏的 ComfyUI 段：Preview Image 的 16 格、KSampler 去噪出来的那张 | 随时 |
| V1–V6 | 白底舞蹈视频 | 间奏二蒙版 | 随时 |
| V7 | 侧脸眨眼视频（可选） | 间奏二 88 小节 | 三 |
| V8 | 全身待机 · 鲸尾摆动 | L08、L20 的"你"字剪影 | — |
| Q01–Q31、QC1–QC7 | ✅ 同一句 prompt 的 31 个种子（第二十三轮到货）+ 图生图链 Q1–Q7（第二十五轮到货，§五c） | 2:44 L31「叠加态」：大卡片快切、最后图生图链稳定下来 + 左下接触印相 | 二十二轮 |
| V11（第二十二轮版） | ✅ 第二十四轮到货 `V11_3.mp4`（5 s，已用上），第二十五轮用户给了超分版 `V11_3_1_ghq5.mp4`（已换上）。首帧空白、她从画布外落进来（提示词在 [间奏二重做方案_第十四轮.md](间奏二重做方案_第十四轮.md) §五） | 2:36 L29 鼠标互动 | 二十四轮 |

**第十八轮（2026-10-11）**：
- I05、I08 换成最终精度版（2254×3780、3111×3891，补全了边上缺的头发和尾巴，透明底、贴着人物裁）。镜头里已按真图比例重新摆位（`engine/core/portrait.js` 的 `aspectOf` / `ANCHOR`）。以后别的立绘换最终版也照这个做。
- 发布前预热用的完整场景插画，提示词见 [预热插画提示词.md](预热插画提示词.md)。

**第八轮（2026-10-08）到货情况与用在哪**：I05 → L06 的手、L18、L29（和鼠标指针互动）· I06 → L13 海平线上、L14 溶化 · I07（文件名 I7.png）→ L23 线框、L31 重组 · I08 → L27、L28、L32 · I10 → L19 · I09、I11 还没排进镜头。V1–V3、V8 已抠成蒙版用上（§6.5）。S00–S10、B01–B16、V4–V6 还没到。

---

## 四、立绘

### I01 全身正面站姿 🔴

**用途**：字符画和像素头像的主源图、间奏二剪影填色、舞蹈视频参考图
**画幅**：竖构图，全身完整入画，头顶和脚底各留 8% 空白

```
full body, standing, front view, gentle smile, looking at viewer,
hands relaxed at sides, feet together, camera at chest height, straight-on,
soft even lighting, light rim light from behind,
pure white background, no shadow on background,
whole body in frame from head to toe, centered, empty margin above head and below feet,
whale tail visible
```

**关键点**
- 背景必须干净纯白：后期要抠图、转字符画
- 站姿要正，不要动态倾斜
- 尾巴完整入画：字符画和剪影都靠它认出是她

### I02 半身 · 闭眼轻唱 🔴

**画幅**：头顶到腰，正面；与 I03 同机位、同裁切

```
upper body, front view, eyes closed, singing softly with lips slightly parted,
calm peaceful expression, hands resting near the chest,
soft diffused lighting, subtle rim light,
pure white background, framed from head to waist, centered
```

### I03 半身 · 开口唱歌 🔴

**画幅**：与 I02 相同

```
upper body, front view, singing joyfully with mouth open,
bright smile, eyes slightly curved, looking at viewer,
one hand raised slightly, energetic posture,
bright lighting, pure white background,
framed from head to waist, centered
```

**关键点**：与 I02 同机位、同裁切，两张能直接切换；表情要"高兴"，和 I02 的"安静"形成对比。

### I04a/b/c 眼部特写 🔴

**用途**：L25 眨眼、各段插闪
**画幅**：横条，从眉毛到鼻梁，宽高比约 3:1

I04a 睁眼：
```
extreme close-up of the eyes, horizontal crop from the eyebrows to the bridge of the nose,
eyes wide open, bright gentle look, looking at viewer,
soft even lighting, pure white background
```

I04b 半闭（在 I04a 上局部重绘眼皮）：
```
eyes half closed, eyelids halfway down, drowsy gentle look
```

I04c 闭眼（在 I04a 上局部重绘眼皮）：
```
eyes fully closed, eyelids gently shut, peaceful look
```

**关键点**
- 三张必须逐像素对齐：先出 I04a，再用局部重绘只改眼皮区域得到 b、c，不要三张分别从头生成
- 睫毛、眉毛的位置三张一致

### I05 伸手向镜头

```
full body, one arm extended toward the viewer, open palm facing the camera,
fingers spread and clearly visible, warm inviting smile, looking at viewer,
slight forward lean, hair moving forward,
pure white background, whole body in frame
```

**关键点**：手是画面焦点，不能虚；手指张开可辨。

### I06 抱膝蜷坐

**用途**：L13 孤独、L14 溶解

```
full body, sitting on the floor hugging her knees, chin resting on her knees,
lonely quiet expression, eyes half closed, whale tail curled around her,
viewed slightly from above, small figure in a large empty frame,
soft dim lighting, pure white background
```

**关键点**：四周留大量空白，她会被缩得很小，放在网格一角。

**第八轮核对**：初版能用（L13 海平线上、L14 溶化都用了）。不够的地方：双手搭在膝盖上而不是抱住膝盖，下巴没靠在膝盖上。重出时用这一版：
```
full body, sitting on the floor, (hugging her knees tightly with both arms:1.3), (chin resting on her knees:1.3),
lonely quiet expression, eyes half closed, whale tail curled around her feet,
viewed slightly from above, small figure in a large empty frame,
soft dim lighting, pure white background
```

### I07 漂浮

```
full body, floating in the air, weightless, arms slightly spread,
long hair spreading upward and outward, skirt billowing, whale tail drifting,
eyes closed, serene expression,
soft ethereal lighting, pure white background
```

### I08 仰望 · 双臂展开

**用途**：L27 翅膀、L32 飞起

```
full body, standing on tiptoes, looking up, both arms spread wide like wings,
hopeful happy expression, mouth slightly open, hair and skirt lifted by wind,
camera slightly below looking up,
bright warm lighting, pure white background
```

**第八轮核对**：初版能用（L27、L28、L32 都用了），但她是看着镜头、一条腿往后迈，不是"仰望"，也不是从下往上拍。重出时用这一版（LoRA 容易把视线拉回镜头，所以加权）：
```
full body, (standing on tiptoes:1.2), (looking up at the sky:1.4), head tilted back, chin raised,
(both arms spread wide like wings:1.3), palms open, hopeful happy expression, mouth slightly open,
hair and skirt lifted by an upward wind, (from below:1.3), low camera angle,
bright warm lighting, pure white background, whole body in frame
```
负向加：`looking at viewer, walking, one leg raised`

### I09 正侧面半身

**用途**：L15；间奏二 88 小节的侧脸剪影

```
upper body, side view, profile facing left, calm cool expression, looking straight ahead,
chin slightly raised, hair falling behind the shoulder,
soft side lighting, pure white background
```

**关键点**：正侧面，额头、鼻尖、嘴唇、呆毛的轮廓清楚。88 小节要用它做剪影，眼睛是唯一保留的颜色。

**第八轮核对**：初版是四分之三背面、手指搭在下巴上，不是正侧面，做不了侧脸剪影（88 小节现在用 I04 眼睛特写，效果也好，所以 I09 不急）。要重出时用这一版：
```
upper body, (side view:1.4), (profile:1.4), facing left, (looking straight ahead:1.2),
calm cool expression, chin slightly raised, hair falling behind the shoulder,
arms relaxed at her sides, no hand near the face,
soft side lighting, pure white background
```
负向加：`looking at viewer, three-quarter view, back view, hand on face, finger on lips`

### I10 背影全身

```
full body, back view, standing still, long hair flowing down her back,
whale tail visible, head tilted slightly upward,
soft backlighting, pure white background
```

### I11 双手捧起

**用途**：L05 比特从指缝漏下

```
close-up of two hands held together in front of the chest, palms facing up,
cupped as if holding something small and precious,
soft even lighting, pure white background
```

---

## 五、Q 版表情包

**用途**：梗。特效音间奏的 16 格采样、人声段插闪、尾奏弹出。
**规格**：1024×1024，头身比约 2.5，外描一圈白边（贴纸感），**图里不要有任何文字**（字由代码加）。

通用前缀：
```
chibi, about 2.5 heads tall, sticker with a thick white outline,
pure white background
```

| 编号 | 梗 | prompt（接在前缀后） |
|---|---|---|
| S00 | 头像 | `head and shoulders, facing viewer, attentive smile` |
| S01 | 吃白米饭 | `full body, holding a big bowl of white rice and chopsticks, cheeks puffed, eating happily` |
| S02 | 翻肚皮 | `full body, lying on her back belly up, arms and tail spread out, lazy relaxed face, eyes closed` |
| S03 | 吐泡泡 | `full body, blowing bubbles, blank daydreaming face, small bubbles rising` |
| S04 | 晕鱼了 | `full body, dizzy, spiral eyes, swaying, small stars circling her head` |
| S05 | 才不是大肥鱼 | `full body, hands on hips, pouting with puffed cheeks, looking away, embarrassed blush` |
| S06 | 誓死捍卫 | `full body, saluting, serious determined face, standing straight` |
| S07 | 服务器繁忙 | `full body, panicking, sweat drops, flailing arms, teary eyes` |
| S08 | 比心 | `full body, making a heart shape with both hands, cheerful wink` |
| S09 | 待机摸鱼 | `full body, sleeping curled up like a cat, nose bubble` |
| S10 | 偷吃小鱼干 | `full body, sneakily nibbling a small dried fish, glancing around guiltily` |

**关键点**
- 11 张的头身比、描边粗细一致
- LoRA 出 Q 版不稳时，可以用 deepseek-whalechan 仓库里 chibi 形态的参考图辅助

---

## 五b、ComfyUI 批量生成（第八轮，2026-10-08）

用户：1:47 那一段用了很多带底色的小图，可以在 ComfyUI 里按行批量生成，不用拿现有立绘凑。那一段现在改成 ComfyUI 工作流的画面（视觉方案 §5.10）：Preview Image 里一批 16 张就是 B01–B16，KSampler 去噪出来的是每次 Run 的第一张。

**用法**：下面整块复制成一个 txt，一行一个 prompt（没有空行、没有注释），用按行读文本的节点（如 Inspire Pack 的 Load Prompts From File、WAS 的 Text Load Line From File）逐行喂给 CLIP Text Encode。LoRA、负向、采样器和其他立绘一样。

**规格**：全部 **1024×1024 方图**（16 格网格里都是方的），带纯色浅底（底色写在 prompt 里，不要透明、不要白底），图里不要有字。每行开头是 LoRA 触发词（§一）：全身图（第 5、11、13、15 行）用全套；半身图去掉下半身的词；第 14 行只露头和手，只留头部和袖子的词。

**顺序就是编号**：第 1 行是 B01，第 16 行是 B16。出图后按任务单 08 改名、登记。

**表情包 S00–S10**：用户已经做好了（2026-10-08），不在这一批里；和这批图一起放进 `assets/illust/批量原图/`，任务单 08 一起改名登记。

```
deepseek_maid_outfit, navy blue maid dress, white frilled apron, blue whale emblem, dark blue neck bow, blue gemstone brooch, puff sleeves, long sleeves, fins, ahoge, white bow, upper body, singing joyfully with mouth open, one hand raised, looking at viewer, bright smile, pastel blue background, soft even lighting
deepseek_maid_outfit, navy blue maid dress, white frilled apron, blue whale emblem, dark blue neck bow, blue gemstone brooch, puff sleeves, long sleeves, fins, ahoge, white bow, upper body, singing softly with eyes closed, both hands on her chest, calm peaceful expression, pastel pink background, soft diffused lighting
deepseek_maid_outfit, navy blue maid dress, white frilled apron, blue whale emblem, dark blue neck bow, blue gemstone brooch, puff sleeves, long sleeves, fins, ahoge, white bow, upper body, holding a microphone with both hands, winking at viewer, playful smile, light yellow background, bright lighting
deepseek_maid_outfit, navy blue maid dress, white frilled apron, blue whale emblem, dark blue neck bow, blue gemstone brooch, puff sleeves, long sleeves, fins, ahoge, white bow, upper body, shy blushing face, covering her mouth with a sheet of music, eyes looking away, mint green background, soft lighting
deepseek_maid_outfit, navy blue maid dress, white frilled apron, blue whale emblem, dark blue neck bow, blue gemstone brooch, puff sleeves, long sleeves, gold trim, blue whale tail, starry tail pattern, frilled thighhighs, white thighhighs, thighhigh bows, black mary janes, ankle strap shoes, low heels, fins, ahoge, white bow, full body, mid spin, skirt and long hair flaring out, arms open, joyful expression, lavender background, dynamic composition
deepseek_maid_outfit, navy blue maid dress, white frilled apron, blue whale emblem, dark blue neck bow, blue gemstone brooch, puff sleeves, long sleeves, fins, ahoge, white bow, upper body, holding a big bowl of white rice and chopsticks, cheeks puffed, eating happily, cream background, warm lighting
deepseek_maid_outfit, navy blue maid dress, white frilled apron, blue whale emblem, dark blue neck bow, blue gemstone brooch, puff sleeves, long sleeves, fins, ahoge, white bow, upper body, yawning sleepily, rubbing one eye, hugging a pillow, night blue background, dim soft lighting
deepseek_maid_outfit, navy blue maid dress, white frilled apron, blue whale emblem, dark blue neck bow, blue gemstone brooch, puff sleeves, long sleeves, fins, ahoge, white bow, upper body, confident pose pointing at viewer, wide grin, small sparkles around her, soft orange background, bright lighting
deepseek_maid_outfit, navy blue maid dress, white frilled apron, blue whale emblem, dark blue neck bow, blue gemstone brooch, puff sleeves, long sleeves, fins, ahoge, white bow, upper body, singing with tears in her eyes, emotional expression, light rays from above, white background, soft rim light
deepseek_maid_outfit, navy blue maid dress, white frilled apron, blue whale emblem, dark blue neck bow, blue gemstone brooch, puff sleeves, long sleeves, fins, ahoge, white bow, upper body, wearing headphones, eyes closed, nodding to the music, gentle smile, sky blue gradient background
deepseek_maid_outfit, navy blue maid dress, white frilled apron, blue whale emblem, dark blue neck bow, blue gemstone brooch, puff sleeves, long sleeves, gold trim, blue whale tail, starry tail pattern, frilled thighhighs, white thighhighs, thighhigh bows, black mary janes, ankle strap shoes, low heels, fins, ahoge, white bow, full body, lying on her stomach, kicking her feet, writing in a notebook, smiling, warm beige background, viewed from above
deepseek_maid_outfit, navy blue maid dress, white frilled apron, blue whale emblem, dark blue neck bow, blue gemstone brooch, puff sleeves, long sleeves, fins, ahoge, white bow, upper body, hugging a small whale plush toy, cheek pressed against it, happy closed eyes, soft blue background
deepseek_maid_outfit, navy blue maid dress, white frilled apron, blue whale emblem, dark blue neck bow, blue gemstone brooch, puff sleeves, long sleeves, gold trim, blue whale tail, starry tail pattern, frilled thighhighs, white thighhighs, thighhigh bows, black mary janes, ankle strap shoes, low heels, fins, ahoge, white bow, full body, playing air guitar, eyes closed in excitement, hair flying, purple background, dramatic lighting
deepseek_maid_outfit, dark blue neck bow, long sleeves, fins, ahoge, white bow, peeking up from the bottom edge of the frame, only head and hands visible, curious big eyes, pastel peach background
deepseek_maid_outfit, navy blue maid dress, white frilled apron, blue whale emblem, dark blue neck bow, blue gemstone brooch, puff sleeves, long sleeves, gold trim, blue whale tail, starry tail pattern, frilled thighhighs, white thighhighs, thighhigh bows, black mary janes, ankle strap shoes, low heels, fins, ahoge, white bow, full body, floating underwater among bubbles, singing with eyes closed, hair drifting, aqua blue background, soft light caustics
deepseek_maid_outfit, navy blue maid dress, white frilled apron, blue whale emblem, dark blue neck bow, blue gemstone brooch, puff sleeves, long sleeves, fins, ahoge, white bow, upper body, saluting, determined serious face, standing straight, pale red background, bright even lighting
```

| 行 | 编号 | 改名为 | 内容 |
|---|---|---|---|
| 1–16 | B01–B16 | `B01_唱歌.png` `B02_闭眼.png` `B03_话筒.png` `B04_害羞.png` `B05_转圈.png` `B06_白米饭.png` `B07_犯困.png` `B08_指你.png` `B09_含泪.png` `B10_耳机.png` `B11_写词.png` `B12_鲸鱼抱枕.png` `B13_空气吉他.png` `B14_探头.png` `B15_水下.png` `B16_敬礼.png` | 同一句"唱首歌吧"的 16 个采样 |
| — | S00–S10 | `S00_头像.png` … `S10_偷吃小鱼干.png`（§五 的表情包，名字见任务单 08） | 已做好，单独放进来 |

---

## 五c、同一句 prompt 的一批种子 Q01–Q31 + 图生图链 QC1–QC7（第二十二轮写，第二十三、二十五轮到货）

用户：「2:44 大量图片效果在这里效果不好，因为比例不同，还有透明的，还有 Q 版的。新增一个素材，写好 prompt，我去生成一批同 prompt 但不同种子的素材，你把场景也改成适合这个效果的。」

**用在哪**：2:44 L31（「♪量♪」，`engine/shots/v3b.js` 的 `l31v22` / `pick31`）：右边一张大卡片里种子图从开头起就按十六分音符快切（第二十五轮，不再从慢到快），卡片上方是 seed 读数；左下一张 8 × 4 的接触印相就是这一批，当前那张亮框连到大卡片；唱到「♪」起换成下面的图生图链 QC1 → QC7，越切越慢、一步步稳定；唱到「♪」时小图全部飞进大卡片叠成一张，再变成 L32 带翅膀的她。

**为什么要同一句 prompt**：快切好看的前提是每张格式一样——同样的方图、同样的底色、同样的全身构图和大小，只有姿势细节、头发和裙摆的形状不同。这样切起来是"同一个她的很多种可能"在闪（量子叠加态），而不是一堆不同素材在跳。

**规格**：1024×1024 方图；**同一片浅天蓝纯色底**（写在 prompt 里，不要透明、不要白底、不要渐变）；正常头身比（不要 Q 版）；全身完整入画、居中、四周留一点均匀的空；图里不要字。

**怎么出**：下面这一句 prompt 不变，种子从任意数开始连续 24 个（ComfyUI 里 batch_size 24，或者 seed 设 increment 跑 24 次）。LoRA、负向、采样器和其他立绘一样；负向再加 `chibi, text, watermark, border, frame, multiple girls, cropped`。出坏的（多手、裁掉脚）直接丢掉，编号顺延就行。

```
deepseek_maid_outfit, navy blue maid dress, white frilled apron, blue whale emblem, dark blue neck bow, blue gemstone brooch, puff sleeves, long sleeves, gold trim, blue whale tail, starry tail pattern, frilled thighhighs, white thighhighs, thighhigh bows, black mary janes, ankle strap shoes, low heels, fins, ahoge, white bow, full body, floating in the air, (strong wind blowing from the left:1.2), long hair and skirt streaming to the right, whale tail drifting in the wind, arms loosely open, looking at viewer, gentle smile, centered, whole body in frame, small even margin around her, pale sky blue flat background, soft even lighting
```

**第二十三轮到货**：用户出了 32 张（`assets/illust/QN/`，ComfyUI 原名，1344²，抱膝漂浮在浅天蓝里，和上面的 prompt 不完全一样但同一批很统一）。ComfyUI_16674_ 是灰白底，去掉；其余 31 张由 `scripts/qn_resize.mjs` 缩成 768² 存到 `build/illust_q/`、登记成 Q01–Q31，L31 已经换上。以后加图：放进 QN、重跑脚本。

**第二十五轮：图生图链 Q1–Q7**：用户从种子 ComfyUI_16694_（改名成 `Q1.png`）起图生图、重绘幅度一次比一次低，出了 `Q2.png` … `Q7.png`，画面一步步稳定下来，L31 最后几张按 Q1 → Q7 切。`qn_resize.mjs` 把它们缩成 `build/illust_q/QC1–QC7.png`、登记成 QC1–QC7；Q1.png 按原名 ComfyUI_16694_ 排序，在种子里仍是 Q20，种子编号不变。

---

## 六、舞蹈视频（间奏二 · Bad Apple 蒙版）

> **第十四轮**：间奏二整段重做，V4–V6 **不用再出**。新的视频素材是 V9、V10（间奏二，首尾帧 I10 → I08 → I01 接成一支连续的舞）和 V11（2:36 L29 鼠标互动，现在用 V11_3），提示词按 MiniMax H3 格式（资料/h3格式prompt.txt）写在 [间奏二重做方案_第十四轮.md](间奏二重做方案_第十四轮.md) 第四、五节。下面 V1–V3、V8 的记录照旧有效。

### 6.1 用途

间奏二 74–89 小节（1:56.87–2:22.47）。**视频不直接上画面**，只用来抠出她的剪影当蒙版（视觉方案 §5.6）。所以：

- **不需要黑白**：正常的白底彩色视频即可，后期用分割模型抠出剪影
- **要的是轮廓清楚**：四肢和身体分开，长发和尾巴的外形读得出来
- 变形类镜头（发梢变鱼群、巨鲸游过、苹果变心）由代码做，不进视频

### 6.2 规格

| 项目 | 要求 |
|---|---|
| 输入 | 以 I01 为参考图做图生视频 |
| 数量 | 6 段必需 + 1 段可选 |
| 时长 | 每段生成 4–5 秒，后期取最好的 1.6–3 秒 |
| 画幅 | 16:9 横屏，1280×720 以上 |
| 帧率 | 24 或 30 fps |
| 背景 | 纯白，没有地面和阴影 |
| 镜头 | 固定，不推拉摇移 |
| 角色 | 全身始终在画内 |

通用前缀：
```
full body in frame at all times, pure white background, no floor, no shadow,
static camera, single character, limbs clearly separated from the body,
smooth continuous motion
```

通用负向：
```
camera movement, zoom, pan, cut, multiple people, cropped body,
text, watermark, background objects, motion blur
```

### 6.3 镜头

| # | 小节 | 动作 | prompt（接在前缀后） |
|---|---|---|---|
| V1 | 74 | 转身 | `turning around from back view to side view, long hair swinging with the turn, whale tail sweeping behind her` |
| V2 | 75 | 伸手 | `side view, reaching one arm forward with an open palm, fingers spread, leaning forward slightly, hair trailing behind` |
| V3 | 76 | 旋转 | `spinning in place, skirt and long hair spreading out into a wide circle, tail trailing` |
| V4 | 77 | 甩发 | `tossing her long hair to one side with a sharp head movement, hair strands flying apart` |
| V5 | 79 | 双手捧起 | `bringing both hands together in front of the chest, palms up, as if catching something falling` |
| V6 | 80 | 展开双臂 | `slowly spreading both arms wide like wings, looking up, hair lifting` |
| V7（可选） | 88 | 侧脸眨眼 | `close-up side profile of the face, eyes open, then blinking once, hair strands moving slightly` |

V7 不做时，88 小节用 I09 静态立绘，眨眼由代码完成。

### 6.3b V8 · 全身待机 · 鲸尾摆动（L08 的"你"字剪影用，2026-10-07 加）

**用途**：L08（24–25 小节，0:36.87）里她的全身剪影由"你"字填满。现在剪影是 I01 静态图；换成这段视频抠出的逐帧蒙版，剪影就会呼吸、鲸尾会摆。之后 L20（L08 的回声）也能用。

| 项目 | 要求 |
|---|---|
| 参考图 | I01（全身正面站姿，白底）——直接拿 I01 做首帧 |
| 画幅 | **竖屏 9:16**（720×1280 以上），全身完整入画，头顶脚底留白和 I01 一样 |
| 时长 | 生成 5 秒；我们取其中最好的 2–3 秒做循环 |
| 镜头 | 完全固定，不推拉摇移 |
| 背景 | 纯白，无地面、无阴影 |
| 节奏 | 尾巴来回摆一次约 1.6 秒（= 一小节，150 BPM）最理想；做不到也没关系，代码里会变速对拍 |

**Prompt**
```
full body, front view, standing in place, the same pose as the reference image,
calm gentle smile, looking at viewer, soft idle breathing, very slight body sway,
long hair drifting gently, skirt hem moving slightly,
the whale tail sways smoothly from side to side in a slow flowing S-curve,
the motion travels from the base of the tail to the tail fin,
the tail fin flaps softly at the end of each swing,
arms relaxed at her sides, feet planted, no walking,
static camera, pure white background, no floor, no shadow,
whole body in frame from head to toe, smooth continuous motion, seamless loop
```

**负向**
```
camera movement, zoom, pan, cut, walking, turning around, jumping, dancing,
tail detaching, extra tail, extra limbs, deformed hands, melting, flicker,
background objects, floor, shadow, text, watermark, motion blur, color shift
```

**关键点**
- 动作幅度宁小勿大：除了尾巴，身体几乎不动，否则蒙版边缘会抖。
- 尾巴的轮廓要一直和身体分得开（尾巴不要甩到腿前面挡住腿）。
- LoRA 压过动作描述时，给 `(the whale tail sways smoothly from side to side:1.3)` 加权。
- 出两三个版本挑：尾巴摆得最顺、身体最稳的那个。
- 交付：H.264 MP4 放 `assets/video/V8_待机摆尾.mp4`。抠图流程同 6.4（`rembg` 的 `isnet-anime` → 二值化），竖屏存成 540×960 PNG 序列 → `assets/masks/V8/`。

### 6.4 交付与处理

- 输出 H.264 MP4，不调色、不加滤镜；放进 `assets/video/`，文件名就用编号（`V4.mp4` …）
- 抠蒙版（第八轮改成本地脚本，不用装 rembg）：`node scripts/video_masks.mjs V4`。从画面四边往里洪水填充白底，剩下的是她（白围裙、白袜被身体围住，不会被抠掉），存成 `build/masks/V4.json`，旁边出一张检查图 `V4_check.png`（绿色 = 蒙版）。引擎启动时自动读进来（`engine/core/masks.js`）

### 6.5 第八轮核对：V1、V2、V3、V8

| 视频 | 能用吗 | 速度 | 尾巴出画 | 清晰度 |
|---|---|---|---|---|
| V1 转身 | ✅ 74、82 小节在用 | 原速 4 秒转完，代码里 ×2.5（一小节转完） | 中段尾巴碰到左边画框几帧 → 引擎在画框左右边缘做了渐隐，看不出切口 | 够 |
| V2 伸手 | ✅ 75、79（接苹果）、86 小节 | ×2.2，伸出去以后停住的部分正好接苹果 | 后段尾巴碰左边 → 同上，可用 | 够 |
| V3 旋转 | ✅ 76（万花筒）、77（轮廓）、80（残影）、84（两个人对转） | 一圈约 3.5 秒，×2.3 | 转到侧面时尾巴到右边画框 → 同上，可用 | 够 |
| V8 待机摆尾 | ✅ L08、L20 | ×1.5 来回放（ping-pong），循环不跳 | 尾尖偶尔碰右边，不影响 | 够 |

- **清晰度**：768×1344 足够。视频只用来抠剪影，引擎里存的是一半分辨率（384×672），画面上最大放到约 1180 px 高，边缘是柔的。**都不需要高分辨率版本**。
- **速度**：加速 2–2.5 倍后节奏刚好（一个动作一小节），不用改 prompt 重出。
- **V4–V6 还要出**。根据 V1–V3 的经验，改两处：
  1. **画幅改成 1:1（1024×1024）**：V4 甩发、V6 展开双臂的横向幅度比转身大得多，9:16 一定出画。竖向分辨率 1024 也够抠剪影。V5 双手捧起动作小，可以继续 9:16。
  2. **动作写快一点**：在 6.2 的通用前缀后面加 `quick brisk movement, the whole move completes within about two seconds, then holds the final pose`，负向加 `slow motion`。

---

## 七、生成顺序

1. **第一批**（解锁粗剪里的立绘镜头）：I01 → I02 → I03 → I04a/b/c ✅ 已到
2. **第二批**：I05–I09、S00–S10
3. **第三批**：I10、I11、V7
4. **视频 V1–V6**：随时可以开始，只依赖 I01

**第八轮之后，最值得先做的**（现在是用代码顶替的地方，换上后画面提升最大）：

| 优先 | 素材 | 现在怎么顶替 | 换到哪 |
|---|---|---|---|
| 1 | B01–B16 + S00–S10（§五b，一次批量） | ComfyUI 段的 16 格用 I 系列立绘拼的后备；尾奏贴纸用立绘圆形裁切 | 按任务单 08 改名、登记后自动换上，不用改代码 |
| 2 | V4–V6 舞蹈视频（1:1，见 §6.5） | 间奏二 77 / 80 / 81–87 里没有对应视频的地方借 V1–V3 | `badapple.js` 的 BARS 里换编号 |
| 3 | I08、I06 重出（§四的第八轮版本） | 初版能用，只是"仰望""抱膝"不够到位 | 换文件即可 |
| 4 | I09 正侧面 | 暂时没用到 | — |

---

## 八、质量核对

**立绘**
- [ ] 背景干净纯白，无渐变、无投影
- [ ] I01 头顶脚底有留白，尾巴完整
- [ ] I02 与 I03 同机位、同裁切
- [ ] I04 三张逐像素对齐
- [ ] I05 手部清晰
- [ ] I06 四周留白足够
- [ ] I09 是正侧面，轮廓清楚
- [ ] 整体符合 LoRA 设定（鳍耳、呆毛、尾巴）

**表情包**
- [ ] 11 张的比例和描边一致
- [ ] 图里没有文字

**视频**
- [ ] 固定镜头，没有意外运镜
- [ ] 全身始终在画内
- [ ] 四肢、长发、尾巴的轮廓清楚，没有运动模糊

---

## 九、常见问题

**Q：prompt 里为什么没有人物特征和质量词？**
A：人物交给 LoRA；质量词和画风词按要求不加。prompt 只写"在做什么、怎么拍、什么光"。

**Q：舞蹈视频为什么不用黑白了？**
A：视频只用来抠剪影当蒙版，颜色会被丢掉。正常彩色视频更好生成，抠出来的轮廓也更干净。

**Q：眼睛差分为什么要用局部重绘？**
A：三张必须逐像素对齐，分开生成几乎对不齐。先出睁眼，再只重绘眼皮。

**Q：表情包里为什么不能有字？**
A：字由代码加，能跟拍、能换字体；图里自带的字改不了。
