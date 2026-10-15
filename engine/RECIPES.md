# 引擎里的现成写法（按问题查）

都在本项目的 Canvas 引擎里实现过、用户认可过。第二十六轮以前在 skill（当时叫 ds-mv-polish，第二十八轮改名 mv-polish）的 `references/engine-recipes.md`，第二十七轮 skill 改成通用版时挪到这里（skill 里只留不带文件名的通用公式：`references/recipes.md`）。引用的是"文件 · 函数"，改之前先读原实现；新写的时候照同样的思路，保持只由 t 决定（不用 Math.random / Date、不读上一帧）。

## 运动曲线

| 要解决的 | 写法 | 在哪 |
|---|---|---|
| 一次推拉中途不能停（两段 smooth 关键帧在中间速度归零） | 写**速度**曲线（慢起 → 平滑加速 → 巡航 → 刹停），按小步长积分成一张表，二分解出巡航速度让总量刚好；倍数用对数空间 | `shots/l09.js` · `zoomTable` `cam14` |
| 卡片和背景同节奏进场、刹在同一刻 | 分段二次曲线（先加速后减速，两段在切点速度相等：u < k 时 u²/k，之后 k + (1−k)(1 − ((1−u)/(1−k))²)），落定后用 e^(−kt)·sin(ωt) 甩一下（从 0 起，不跳） | `shots/l09.js` · `entry` `paperCard` |
| 浮在水上 | 欠阻尼上浮 1 − e^(−at)(cos ωt + a/ω·sin ωt) + 两个频率叠加的上下晃 + 慢摆 + 一点左右漂；每个元素相位错开 | `shots/intro.js` · `floatOf` |
| 碰撞 | 碰撞那一刻给冲量和角速度，从那一刻起按 1/240 s 定步长积分重力和一次落地反弹（只依赖 t − t_hit） | `shots/l06.js` · `aBody` `knock13` |
| 带弹性的旋转 / 落位 | `core/trans.js` 的 `elasticOut`；落位后半径 1 + A·e^(−7s)·sin(20s) | `core/trans.js`；`shots/v2a.js` · `warmHandoff` |
| 人物慢慢随机摇摆 | 两层：慢噪声 `vnoise(t·0.3)` 映射到 ±0.045 rad + 一个很慢的正弦；要在镜头末尾回正就乘 sin(π·u) | `shots/v2c.js` l23；`shots/v2a.js` l13 |
| 镜头切点比唱出来早一点 | 量这句第一个字的 `t0`，切点放在它前面约 3 帧，写进 `CUT15`；镜头里起止常量全改成 `cutAt(n)`（画帧时取），跟拍子的东西仍用 `beatTime` | `core/cuts.js`；例子 `shots/l09.js` `l10.js` `l11.js` `v2b.js` `v2c.js` |
| 字出现时先蓝再回深色 | `inkFlash(age, base)`：前 0.1 s 品牌蓝、0.3 s smooth 回到 base；`bigLine` 的 `place` 返回 `color` | `shots/scene.js`；`shots/v2c.js` L24 |
| 一个开关从一边滑到另一边 | 字和圆钮钉在同一根"滑条"上一起走、滑轨做裁切；走过的部分填色；缓入缓出 + 末段轻冲过；速度大时字带横向拖影 | `core/ui.js` · `voiceSwitch14` |

## 错峰与出现

| 要解决的 | 写法 | 在哪 |
|---|---|---|
| 一批窗口由内到外一圈圈弹出 | 按切比雪夫距离分圈；每圈的起点 = 相机倍数降到"这一圈刚进画面"的那一刻（扫描时间表求出），外圈至少晚 4 帧；每个窗口绕自己中心 easeOutBack 0 → 1 | `shots/l09.js` · `ringStarts` |
| 字 / 图形先在小处出现，再飞到大处 | 每个点有起点（小图里的位置）和终点（大图里的位置），二次贝塞尔飞过去，按到中心的距离错开；收回时外圈先走 | `shots/drop.js` · `geDots` |
| 连锁动作放慢 | 把时间常数集中成一张表（pop / 波纹 / 连线 / 头像），新旧两版各一张，按开关取 | `shots/v2a.js` · `WT` `warm16` |
| 旧的东西留下来慢慢淡（不一闪就没） | 当前项 0.15 s 长完；换成下一项后旧的按 e^(−2·Δt) 淡掉，同时最多画最近 5 个 | `shots/v2c.js` · `attn23` 弧线 |

## 转场

| 要解决的 | 写法 | 在哪 |
|---|---|---|
| 一个元素跨过剪辑点 | `overlayCut`：背景按 `bg`（fade / whip）合成，最上面 `overlay(ctx, S, u)` 画那个跨镜头的元素；两个镜头在这段时间都不画它自己的那份 | `core/trans.js`；例子见 timeline.js 的 L06 / L08 / L14 / L17 / L19 / L20 |
| 形状之间变形（I → 框 → 心）+ 旋转 | `morphShape(from, to, e, { fill, lw, halo, rot })`；四角框连成整框 `cornerFrame` | `core/trans.js` |
| 同一张画布往下走，同时一个元素不跟着走 | `slideDown` + `overlay(ctx, S, u, e)` | `core/trans.js`；`shots/v2b.js` · `box1718` |
| 被风吹走、下一个镜头摆进来 | `windBlow`：A 切块从右往左依次被刮走，B 绕支点带阻尼摆到正 | `core/trans.js` |
| 方块边擦除 + 1 px 轮廓 | `squareWipe`：B 区域（阶梯 + 方块）先画成蒙版；蒙版四个方向各挪 1 px 叠起来、再挖掉蒙版本身 = 并集的外轮廓（没有内部线） | `core/trans.js` |
| 人物先行、推进时上一个镜头被盖住淡掉 | `charPortal` 的 `only` / `clip`，推进后半段 B 在卡片外面也盖上来 | `core/trans.js` |
| 两个镜头里长得像的窗口接起来 | `winMorph`：两边各给一个函数返回窗口此刻的 `{ cx, cy, w, h, rot, r }`；同一扇窗口变形，里面按各自的窗口裁下来淡入淡出；A 只画窗口以外的部分（A 的窗口大时不会从变形的窗口边上露出旧字） | `core/trans.js`；`shots/v2c.js` `win24`、`shots/comfy.js` `termWin` |
| 画面碎成噪点再变成下一个镜头 | `noiseIn`：A 切 24 px 方块，每块在随机（略从中间往外）的时刻换成 B，换之前 0.3 那段被彩色颗粒吃掉、横向抖 | `core/trans.js`（73 → 74） |
| 每小节换一种画法 | 前 0.2 s 一道扫描线从上往下：上面画新的、下面画旧的，扫描线 2 px 青色 + 一段亮带 | `shots/interlude2.js` `bar8x` |
| 圆形遮罩对准下一个镜头的圆 | 下一个镜头的相机开头让那个圆在画面正中，iris 的中心写 (960, 540) | `shots/v2a.js` · `CAM16B`；timeline.js L16 |

## 图形与"像 bug"的问题

| 要解决的 | 写法 | 在哪 |
|---|---|---|
| 裁切过的图边缘软到看不出线 | 先按内容做椭圆渐隐，再乘一层贴着四条裁切边的羽化：每条边上不透明度正好 0，往里按 smootherstep 升到 1（用多个 color stop 近似） | `shots/l06.js` `hand11` |
| 印章 / 框里的中文上下居中 | 量这串字墨迹的 `actualBoundingBoxAscent / Descent`，alphabetic 基线放在 (asc − desc) / 2 | `core/kit.js` `stamp` |
| 视频做成各种"预处理图" | `scripts/video_maps.mjs` 出剪影 + 颜色分区图；`core/segmaps.js` 由分区图算边缘、线稿、深度（距离场 + 按部位前后错开）、法线（深度梯度）、分区上色、距离场；箭头场 = 距离场梯度，等高线 = 距离场 marching squares | `core/segmaps.js`、`shots/interlude2.js` |
| 真正的挖空（月牙） | 求两圆交点，路径 = 大圆上远离小圆的那段弧 + 小圆落在大圆里的那段弧；填充和描边都用这条路径 | `shots/v2a.js` · `crescent` |
| 很窄的尖峰波形不抽搐 | 扫描式显示：每一列只在写入头经过时按那一刻的时间取一次样，前面留空隙；尖峰宽度放大到采样跟得上 | `core/hudkit.js` · `ecgSweep` |
| 字在框 / 胶囊里垂直居中 | `midText(ctx, s, x, cy)`（按大写字母高度居中） | `core/glyphs.js` |
| 缺字 | 字体串自动垫更纱；日文字体写中文前用"有后备 / 无后备"两次渲染对比查覆盖率 | `core/glyphs.js` · `fonts` |
| 3D 阵列看得出结构 | 独立的块 + 块间留缝 + 层沿墙面法线往后排（间距 ≈ 块宽）+ 同位置前后层的角连线 + 远层更淡更虚 | `shots/v2b.js` · `lattice19` |
| 随机闪（频率高但不乱） | 每个十六分音符里错开几次事件，`hash(步, 次)` 挑目标，包络 0.04 s 满 + 0.08 s 落，正拍那次更重；只压在元素上，≤ 0.3 | `shots/v2b.js` · `lattice19` |

## 第十六轮

| 要解决的 | 写法 | 在哪 |
|---|---|---|
| 切点要在这句第一个字前、但镜头里按拍走的东西还要在拍上 | 起止常量写成 `() => cutAt(n)`（画帧时取），数拍用小节线常量（`B18 = barStart(18)`）；相机关键帧表里用到起止的整张表写成函数 | `core/cuts.js`、`shots/l05.js` `v2a.js`（`B46`）`v3b.js`（`B99`） |
| 一段抽象画面要让人看懂"在干什么" | 把整个画面做成那个"东西"本身（一个正在执行的 KSampler 节点：执行边框、标题栏进度、输入输出口、参数行），四周放会动的说明窗口（队列、日志、进度、提示词点亮 + 连线到画面里对应的地方）；窗口统一进场、在主体需要地方时滑到两边让位 | `shots/interlude2.js` · `chrome` `withPanel` `condPanel` `leader` |
| 线稿放大发糊 | 不放大像素线：每个部位模糊一次后用 marching squares 取 0.5 等值线（亚像素），存成线段串，按需要的粗细矢量描；只在包围盒里算 | `core/segmaps.js` · `segContours`，`shots/interlude2.js` · `drawLines` |
| 去噪 / 进度要看得见 | 预览画"预测的成品"：本色图由粗到细（σ 大时缩到很小再平滑放大）+ 平滑放大的噪点按 σ² 盖上去，最后一步干干净净；不要格子放大 | `shots/interlude2.js` · `latentThumb` |
| 换图过渡不要每次都是扫描线 | 每次换法都用图里的东西：线从心口长出来、网点一颗颗弹出、网点换成字（换上那一下乱跳）、按部位一块块填色（每块闪白）、一个人分成两个 / 两个合回一个。**第十七轮用户觉得不如原来的扫描线舒服，间奏二改回去了**（这套写法留在 `interlude2_r16.js`） | `shots/interlude2_r16.js` · `blend` |
| 成品图不要从动态突然变静态 | 让视频自己停在成品图的姿势上（尾帧控制），解码用从脸开始的径向软边换成原画，不用满屏马赛克 | `shots/interlude2.js` · `art89`，`core/frames.js` |
| 几千个小圆点 | @napi-rs/canvas 里拼成一条路径再 fill 极慢（1.2 万个 30 s）；每颗单独 `beginPath / arc / fill` | `shots/interlude2.js` · `halftone` |

## 第十七轮

| 要解决的 | 写法 | 在哪 |
|---|---|---|
| 字 / 动作要卡在某个音上，但对时数据不准 | 查人声分轨的起音：`.venv\Scripts\python.exe -I scripts\vocal_onsets.py 起 止 --strong`，辅音前 −30 dB 以下的空隙之后谱通量猛涨那一行就是这个音；实测时刻写成常量、注明出处，只改那几个字（第十八轮起改用下面的 `--line` + `onset()`：只看响度会认错字） | `scripts/vocal_onsets.py`，`shots/l03.js` `ONSET17`、`l05.js` `KW17`、`l06.js` `T_A17`、`v2a.js` `ON14` |
| 单独挪某一个切点 | `CUT17 = { 小节: [时刻, 开关] }`，每个切点挂自己的开关，优先于整批的表 | `core/cuts.js` |
| 一圈圈弹出来的东西要"看得见是一道涟漪" | 别按"刚进画面"触发（那时在画面外、又在快速移动）；画一道屏幕空间里匀速扩散的波，波前扫到谁谁就弹（按屏幕上的距离算触发时刻、缓存），弹的那一下框线闪一下 | `shots/l09.js` · `wave17` `popStarts` |
| 界面和画面明暗割裂 | 两套界面色（深 `DK` / 浅 `LT`），`lightAt(t)` 按此刻画面的明暗在两者之间过渡（跟着换图一起变） | `shots/interlude2.js` · `lightAt` `themeAt` `topBar` |
| 很多根连线（像 1:00 的路由） | 一个出口射出 n 根直线，每根半拍换一次落点、彼此错开，换的时候从出口重新长过去；前几根最亮、落点一个随拍的小环；线画在窗口下面，出口亮点画在窗口上面；词的位置每帧先量（不能用上一帧的） | `shots/interlude2.js` · `fan` `attnLines` `condLayout` |
| 电影里黑客终端那种狂滚 | 滚动量按 t 积分（匀速 + 每拍头猛推一截），行号哈希出每一行的内容，任何一帧都能单独算出来；当前关键词的行高亮 | `shots/interlude2.js` · `hackBody` |
| "所有效果合成一个" | 九宫格的九种图各在自己的格子里，一起飞向中间、放大到全屏（越飞越快），底色先褪掉（自带不透明底的图用剪影裁），九层叠在同一个姿势上，撞上那一下换成成品 + 一圈白环 | `shots/interlude2.js` · `mergeAll` |

## 第十八轮

| 要解决的 | 写法 | 在哪 |
|---|---|---|
| 字 / 动作卡在某个音上（第十八轮起的做法） | `scripts/vocal_onsets.py --line Lnn`：按音高切成一个个音（每行带小节.拍），一个假名对一个音、个数对上、重音落在拍上，再取起音；写进 `data/vocal_onsets.json`（按字序、只有数字），镜头里 `onset(id, i)` 取（没测的退回对时数据），提前 0.08–0.1 s 出现 | `scripts/vocal_onsets.py`、`core/data.js` `onset`、`shots/l03.js` `l04.js` `l10.js` `v2a.js` |
| 字从人物身后流出来 | 先画字再画人；字的出生点放在人物轮廓的外边缘上（弹出来时被轮廓挡掉一点），出生时刻 = 出现时刻，不要在人身后出生（藏一阵才露出来，出现就晚了） | `shots/l03.js` · `LYR_X` `lyricXs` |
| 转场开完时中间是空的（内容按唱到的字一个个出现） | 没唱到的部分先用最浅的墨把整体形状排出来，从中心往外一圈圈出来、和转场同时开始；唱到时再变深 | `shots/l10.js` · `keywordHeart` |
| 换了素材图（尺寸 / 裁边变了） | 按真图比例放：`aspectOf(id)`；要对准的部位用在新图上量的 `ANCHOR[id]`（归一化到整张图）；带翅膀、光环这类挂件的，按人物在图里的位置（两肩中间、脸）对，不按图的中心对 | `core/portrait.js`、`shots/v2b.js` `v3a.js` `v3b.js` |
| 一个面板的整套时间要整体缩短 | 时间表写成一张表（每个动作的起点 / 时长），两版并存挂开关；先砍停留，不压用户嫌过快的那段动作 | `core/ui.js` · `VS_T` |
| 视频原画的抽帧范围变了 | 重抽前把旧帧挪走；`vidFrame` 早于起点返回 null（镜头退回后备画法），晚于终点夹到最后一帧——另一台机器没同步到新帧时不会定格 | `scripts/video_frames.mjs`、`core/frames.js` |

## 第十九轮

| 要解决的 | 写法 | 在哪 |
|---|---|---|
| 一大批时刻改了，要用户核对 | 新旧两版都留在内存里（`D.lyrics` 对时数据 / `D.lyricsMeas` 实测），开关在画帧时选；角落画一块调试面板：当前时刻、当前切点新旧、这句每个字按来源上色、前后 1.6 s 的时间轴（灰短刻度 = 旧、彩长刻度 = 新、连线），挪过的事件到点时边框闪 + 弹「调 Δ」牌子、到旧时刻时播放头闪「旧」（第二十轮用户核完让删了，`core/timingdebug.js` 只在第十九轮的快照里） | `core/data.js` `measuredLyrics` `onsetInfo` |
| 切点要跟着新的第一个字走 | 旧规则留成 `cutAtOld`，`cutAt = cutAtOld + cutShift`（差 3 帧以上才挪，用户点名定的不挪）；转场窗口本来就按切点算，跟着走 | `core/cuts.js` |

## 第二十轮

| 要解决的 | 写法 | 在哪 |
|---|---|---|
| 实测表某一句要重量、但上一版也要能对比 | 新值写进 `vocal_onsets.json` 的正表，旧值放进同一文件的 `_旧`；`D.onsetsPrev` / `D.lyricsMeas19` 留着上一版，开关 `on20` 选 | `data/vocal_onsets.json`、`core/data.js` `LY` `ON` |
| 全片切点统一往后挪一点 | `cutAt` 末尾加一个常量（`CUT_LATER20 = 2/60`，只加在按字算的切点上），不去一张张改表 | `core/cuts.js` |
| 一个长转场分几段钉在字上 | 每段用 `onset(id, i)` 算起点：四角连框（0.24 s）→ 停住、预倾斜等下一个字 → 加速旋转（`v^2.2` 加速、末尾欠阻尼）同时变形；转场窗口 `w0 / w1` 跟着拉长 | `timeline.js` · `focusSpin20` |
| 帧很多的视频（1080p、175 张） | 出片时只留 JPG 原始字节；镜头 `registerPrefetch(t => [[id, vt]])` 登记要哪一帧，`render.mjs` / `sheet.mjs` 每帧先 `await prepareFrame(t)` 异步解码（`@napi-rs/canvas` 的 `Image.src = Buffer` **不会同步解码**，画出来是空的，只能用 `loadImage`）；浏览器预览后台加载、到了用 `onFrameLoaded` 重画 | `core/frames.js`、`main.js` `prepareFrame`、`render/platform-node.js` `decodeImage` |
| 白底视频抠人物 | 在 480 宽的缩小图上从四边做洪水填充（近白且和边相连的才算背景），得到软蒙版，放大后 `destination-in`；结果按视频时刻缓存几帧。视频两侧的黑边单独处理 | `shots/v3b.js` · `v11Cut` |
| 界面跟着视频里的人走 | `scripts/video_track.py` 逐帧算人物包围盒（缩小 4 倍、去黑边、阈值 + 膨胀、最大连通块，再并上脚这种分开的小块）→ `build/frames/V11_track.json`；镜头里按视频时刻插值，`trackOf(id)` 取 | `scripts/video_track.py`、`core/frames.js` `trackOf`、`shots/v3b.js` `herBox` |
| 视频动作点对到字上 | 视频时间轴重映射：一张 `[片子时刻, 视频时刻]` 关键帧表（`vmap29`），中间线性插值；关键帧用 `onset()` | `shots/v3b.js` · `vtOf` |
| 注意力（query 连向很多 key，权重慢慢集中） | 词元一次排好（`chips25`）；softmax 带温度 `T`，从 1.2 降到 0.03；线宽 / 透明度 = 权重 / 最大权重，每根线上一颗光点按权重快慢流；最后一个 key 是下一个镜头的推进目标（`chipRect25`） | `shots/v3a.js` · `l25v` |
| 镜头开头大片空白 | 先铺满再"长"：上下文边界框从窗口外往外推，边界以内的词元按到边界的距离淡入；工作流整张先以灰色"排队中"出现（空输入框、灰连线），再一个个执行变绿、解码出内容 | `shots/v3a.js` · `field26`、`shots/outro.js` · `ghost20` |
| 制作信息做成节点图 | 节点表（标题、行、输入输出口颜色）+ 连线表；三次贝塞尔线从输出口长到输入口，线上数据点按时间流；执行中的节点亮绿边 | `shots/outro.js` · `NODES20` `wires20` |
| 打字进度到 1 时最后几行还亮着 | 进度乘 1.22–1.25 再和格子的序号比，打到 0.8 就全出来、"刚出现亮一下"在剩下那段里退完 | `core/logo.js`、`core/bigtype.js` |
| 字标（字由小格子拼、边缘又要干净） | 每个字画一张离屏蒙版（字本身 + 带白边的外形），按格子采样覆盖率；格子（底色 + 代码字）画进缓冲，再 `destination-in` 字形蒙版裁出矢量边；水面以下 `destination-out` 挖掉，换成晃动的浪格子；格子的出现顺序 = 打字顺序 | `core/logo.js` · `drawLogo` |
## 第二十一轮

| 要解决的 | 写法 | 在哪 |
|---|---|---|
| 有细节的大字 | `bigType(ctx, S, { text, x, y, px, keys, tiles, charT, notes })`：每个字一张蒙版（字 + 带白边的外形）和格子；三张缓冲（白边 / 格子填充 / 厚度），厚度是白边缓冲 `source-in` 染深色后错位叠几层；高光是 `source-atop` 的斜渐变带；`charT(k)` 给 a（打字）、out（碎掉）、dx/dy/s/r/alpha；碎掉的格子按 x + 随机先后被 `wind` 吹走。中文 `ZH_KEYS`（得意黑），日文 `JP_KEYS`（Dela Gothic） | `core/bigtype.js` |
| 两张图里同一个姿势对齐 | 两边都缩小 4 倍、取剪影（白底按亮度、透明图按 alpha），粗到细搜高度 / 中心 x / 顶 y 让 IoU 最大（一次性的小脚本，用一张画布反复画，别每次新建画布——会把内存耗光）；结果写成常量 | `shots/v3a.js` `I01_21`（IoU 0.47 → 0.68） |
| 眼睛对眼睛叠化 | 在两张图上量眼睛中点 (fx, fy) 和两眼距离；后一个镜头定好图的位置，前一个镜头推镜终点解 `screen = W/2 + (x − W/2 − cam.x)·zoom`（cam.y 同理），zoom = 后眼距 / 前眼距；推镜进度夹到 1 | `shots/v3a.js` `CAM_END21` `L25_HER` |
| 白底 → 网格 | 白色底片盖在纸面网格上慢慢褪；底片上面按纸面网格同样的相机深度 / 间距画格点，点往上下左右长成线（离主体近的先长），底片褪完它也淡掉 | `shots/v3a.js` `dotsToGrid` |
| 文字环绕一个东西 | 每个字的角宽 = (字宽 + 间距) / 半径，沿圆排、转到切线方向；外加细圆圈 + 刻度、旁边字块用折线连到圆圈 | `shots/v3a.js` `ringText` `bodyLockup` |
| 背景跨镜头不动、只换前景 | 两个镜头用同一张词元表（`chips26`）、同一个位置；前一个镜头收尾时把它们压暗到后一个镜头"不相关"的亮度（`DIM26`）；转场叠层让一个词元长成下一个镜头的窗口 | `shots/v3a.js` `l25v21` `field21` `chipToWin21` |
| 一个人走过剪辑点 | 两个镜头在转场时间里都不画她；叠层按两边"那一刻"各自的位置（函数算，不写死）插值画她，三次缓入缓出 + 一点弧线；姿势不同就最后 40% 叠化，后一个镜头里的她同时淡进来 | `her2728`（v3a）、`her2829`（v3b） |
| 字组成的翅膀 | 每根羽毛 = 3 股沿二次贝塞尔排的字；按弧长每 15 px 一个字，字转到切线方向（超过 90° 翻 180° 保持正着读），根到梢字号 24 → 11、透明度递减；字序号减 floor(t·10) 让字沿羽毛往外流 | `shots/v3a.js` `charWings` |
| 透视板子上的点连线 | `drawPitch` 返回的 `map(u, v)` 把板子上的归一化坐标投到屏幕；各层取同一个词的格子中心连成折线，`lineDashOffset` 走动 + 几颗光点按累计长度跑 | `shots/v3a.js` `l28v21` |
| 视频跳剪 | 分段的视频时间映射（第一段到跳剪点、第二段从新的起点），跳剪点放在下一段运镜的起点；左上播放器进度条在跳剪前 0.1 s 被"拖"过去 | `shots/v3b.js` `vtOf21` `scrub29` |
| 素材快切 | 所有素材洗牌成一张表；第 k 张 = 前段按拍、中段按八分、后段按十六分累计（`stateIdx31`），反函数求这一张开始的时刻做弹入；前后两张淡淡叠在两边 | `shots/v3b.js` `l31v21` |
| 扫描式心电图 | 一屏 3.2 s，写入头 = (t mod 3.2) 的位置，前面留 6% 空白；每个像素反推它对应的时刻取信号（P 波 + QRS + T 波的高斯和，按拍网格） | `shots/v3b.js` `heartStrip21` `ecgV` |

## 第二十二轮

| 要解决的 | 写法 | 在哪 |
|---|---|---|
| 点阵大字（替代 bigType 的深色厚度） | `dotType(ctx, S, { text, x, y, px, keys, color, accent, grid, charT, from, to, wind, frame, label })`：每个字按 N ≈ px/7 的格子采样覆盖率（`dotCells`，按字 + 格数缓存）；每颗点从 `from(k, cx, cy)` 沿二次贝塞尔 easeOutBack 飞到位，按到字中心的距离错开；扫描线、随拍一圈涟漪、几颗强调色点、一层浅色错位点（不是深色）；四角框 + 小字标签；`charT(k)` 给 age / out / dx / dy / s / r / alpha，out 时被 `to` 吸走或被 `wind` 吹散。返回每个字的中心（给后面的东西接） | `core/dottype.js` |
| 剪辑点两边速度连续 | 前一个镜头的推镜函数单独导出（`entryCam(t)`），叠化时后一个镜头的她按它的眼睛点和缩放走；剪辑点后 `s = 1 + A(1 − e^(−d/τ)) + 慢漂`，`A/τ` = 推镜末尾的缩放速度（数值求导），三样（位置、大小、速度）都连续 | `shots/v3a.js` `figXform22` `entryCam` |
| 一个元素在转场里变成下一个镜头的第一个元素 | 转场类型不变（`pixel` 马赛克），给它挂 `p.overlay(ctx, S, u)`；叠层里算两边那一刻的坐标（上一个镜头的贴纸位置 → 下一个镜头「0」的位置），心沿弧线飞过去，`morphShape` 从心形变成椭圆 | `core/trans.js` pixel；`shots/l04.js` `heartTo0` |
| 太阳 → 下一个镜头的放射圆心 | 太阳在屏幕上的位置单独导出（`sunScreen22`），叠层里太阳飞到 L25 她胸口、光芒拉长成注意力线 | `shots/v3a.js` `sunToHeart22` |
| 背景字带深度、一直呼吸 | 每个词元一个固定的深度 dz（视差 + 大小 + 浓淡）；入场后保留；`vnoise` 慢漂 + 小幅抖；按到中心的距离丢掉一部分（外圈稀）；两个镜头共用同一个函数 | `shots/v3a.js` `chipPose22` `drawChip22` |
| 片子自己前面某一刻的画面 | `memoryFrame(t, w)`：用注册进来的 renderFrame 在一块大画布上画完整一帧（跳开转场窗口），缩小、按 t 缓存；嵌套时按层数各用一块大画布；**用的镜头要在画任何东西之前先调用**（预热），避开 V11 那段（要 prepareFrame 预解码） | `core/memory.js`；`main.js` `setMemoryRenderer`；`v3b.js` `memWindow`；`outro.js` `previewTime22` |
| 超快速回放 + 计时 | 回放帧号 k = floor((t − t0)·30)，片子时刻 = 0.7 + k/N·(169.5 − 0.7)，量化到 0.1 s；左上角深色胶囊里写 mm:ss.s，右上角 ×倍速，底边一根进度 | `shots/outro.js` `outro1v22` |
| 一大段文字滚动、暂停时每帧都清楚 | 文字按框宽逐字折行（标点不放行首）一次算好缓存；滚动量按时间线性、整段在镜头时长里刚好滚完；行号 + 右边滚动条 | `shots/outro.js` `wrap22`；数据 `scripts/credits_prompt.mjs` → `data/credits_prompt.json` |
| 气泡（矩形 + 尾巴）一条路径 | `speechBubble(ctx, x, y, w, h, r, tipX, tipY, bw)`：尾巴在下边或左边，根部中心夹在直边上；r 不给就是 h/2（最大圆角）。尾巴尖要在矩形下面（tipX ≥ x），不然会走左边那一支 | `core/ui.js` |
| 进度环 100% 消失 | `arc(−π/2, −π/2 + 2π)` 在出片画布上画不出来；v ≥ 0.9995 时改画 `arc(0, 2π)` 整圆 | `core/kit.js` `ring` |
| 连在主体上的结构化图形 | `satellite(g, S, { x, y, w, h, anchor, title, kind, age, text, value, rows })`：折线引线从主体的角画出来（0.3 s）→ 四角框从中心张开 → 内容（ring / bars / data / hex / spec / ecg / ruler）亮起；引线上每拍跑一个光点；`tickRing` 一圈 n 格刻度，扫描头每拍走一格、后面拖亮尾 | `core/struct22.js`；用法 `v3a.js` `dense26`、`v3b.js` l30 / l29 |
| Link Start 放射线 | 150 根彩色光条，每根自己的角度和速度，相位 ph = (t·sp + seed) mod 1，半径 40 + 1500·ph²、长度 30 + 520·ph²（越往外越快越长），透明度 sin(π·ph)；中心一团随拍亮的白光 | `shots/v3b.js` `linkStart` |
| 面板不摆、里面动 | 面板飞进来翻正一次就停；候选词老虎机（每格按自己的相位滚到当前词）、概率条抖、亮带扫、第一名随拍亮、熵数字跳 | `shots/v3a.js` `l28v22` `layerPlate22` |
| 回滚开关在表格里 | 转场表写成函数 `TRANS_TABLE = () => [...]`，第一次用到时才求值（模块加载时 `--rev` 还没设好） | `timeline.js` |

## 第二十三轮

| 要解决的 | 写法 | 在哪 |
|---|---|---|
| 一个形状碎成字、再落进另一个字形里 | 两边各取"形状里面的格点"：画进离屏画布、按网格读 alpha（心：14 × 18；字：16 × 24，和 0/1 纹理同一网格），各自按绕中心的角度排序，第 i 个源点飞到第 ⌊i·N目标/N源⌋ 个目标点；外圈先走，二次贝塞尔抬高弧线，飞行中字 0/1 翻转、落地定住换墨色；目标层同时淡入接住，再淡掉粒子 | `shots/l04.js` `heartTo0` `heartPts`；`shots/l05.js` `glyphPts05` `zeroScreenPts05` |
| 粒子只从字里面开始掉 | 起点从字的内部格点里按 (种子, 第几轮) 挑一个；每掉完一轮换一个 | `shots/l05.js` `rain05` |
| 背景元素随机大小 | 每个元素 `s = (0.55 + 1.25·r^1.7)·(0.9 + 0.2·深度)`，r 是它自己的随机数：多数小、少数大 | `shots/v3a.js` `chipPose22` |
| softmax 收拢以后柱子还看得见在动 | 柱高按 log₁₀ w（10⁻²⁰–1）画；历史热图按 log₁₀(w / wmax)（10⁻⁸–1）；同一组权重一帧要算几十次时，把和时刻无关的部分（列表、分数）缓存 | `shots/v3a.js` `attnPanel23` `weights22` |
| 潜空间预览的样子 | 画进 1/22 → 1 大小的小画布再平滑放大（糊）、盖一层偏蓝紫的色、再盖一张按帧号偏移取样的噪点图，三样都随采样进度 q 退掉 | `shots/outro.js` `latent23` |
| 生成的素材不放 assets | 脚本把原图缩小写进 `build/…`，manifest 里登记 `build/` 开头的路径（`core/portrait.js` 的 `pathOf` 认这种路径） | `scripts/qn_resize.mjs` |
| 回滚比对 | 开工前出一组基准总览图（`--at` 列出这一轮要动的时刻 + 每 0.5 s 一张的大段），收工时全部新键填上一轮再出一次，`tilediff` 逐格比；有差别的格子再出差值图（`tdiffimg`）看是哪一块 | scratchpad 的 `tilediff.mjs` `tdiffimg.mjs` `tile2.mjs` |

## 第二十四轮

| 要解决的 | 写法 | 在哪 |
|---|---|---|
| 视频比这句长、又不能裁不能整体快放 | 锚点表 `[[歌曲秒, 视频秒], …]`（动作对字），单调三次插值（Fritsch–Carlson）：过每个锚点、速度连续、不倒放；没有动作的静止段可以压 4 倍，动作段 1.3–1.5 倍，最后停住的姿势放慢盖进转场 | `shots/v3b.js` `A24` `vt24` |
| 剪影边缘的动态马赛克、越来越细 | 剪影画进 W/c × H/c 的小画布（平滑缩小 = 每格覆盖率），覆盖率 > 0.5 + flick·(随机 − 0.5) 的格子亮（随机数按 (格子, 第几个十六分音符) 取，边上那圈就会闪），最近邻放大；c 按八分音符一档档变小，最后一档以后画原来的平滑剪影 | `shots/interlude2.js` `bodyMosaic24` `mosaicCell24` |
| 出场时一圈描边画出来再淡掉 | `setLineDash([L·draw, 4000])` + `strokeText`：Skia 的虚线每条轮廓各自从头起，一个字的几条轮廓同时起笔；draw 0→1 用 0.3 s 缓出，0.42 s 起淡掉，外面再跟一圈放大 7% 的细描边扩散 | `shots/l05.js` `strokeIn05` |
| 叠化转场里一个元素在人物后面飞 | 不画在转场叠层（叠层在最上面）；前后两个镜头各在自己的人物之前画同一个元素、按同一个时刻函数算位置——叠化时两份重合，看起来是一个，而且两边都在人物后面 | `shots/v3a.js` `sunFly24` |
| 封面 / 单帧海报 | 写成一个 `cover(ctx, S, o)` 函数（不进镜头表），`render/cover.mjs` 用 `makeState(t)` 拿调色板、画一帧、`encodeSync('png')`；同时出一张 240 px 的缩略图核对图 | `shots/cover.js`、`render/cover.mjs` |
| 点阵大标题在缩略图里读得出 | 点下面垫一层"贴纸"：字形本身 `fillText` + `strokeText`（线宽 0.13 字高、白色）+ 很淡的品牌蓝 shadowBlur；点用圆、半径 0.46 格距 | `shots/cover.js` `coverTitle` |

## 第二十五轮

| 要解决的 | 写法 | 在哪 |
|---|---|---|
| 大片渐变的色带 | `ditheredRadial(w, h, [x0, y0, r0], [x1, y1, r1], col0, col1, amp)`：逐像素解双圆锥渐变的参数（和 `createRadialGradient` 同一套），加 ±amp 级三角分布抖动（每像素整数哈希）再量化，按参数缓存成一张静态画布，镜头里 `drawImage` 铺上去。核对：单帧编一遍 `libx264 -crf 16 -preset veryfast`，`lutrgb` 把通道拉开 5–14 倍看环 | `core/dither.js` |
| 背景里的东西收拢进下一个镜头主体的生长点 | 每个元素按自己当前的位置出发，起步错开 0–0.1 s、时长按离目标的距离 0.3–0.44 s，`e = k^2.2`（越飞越快），路上沿法向加一点 `sin(πe)` 的绕；边飞边缩到 0.3、末尾 18% 淡掉；落点由两个镜头各画一份（下一个镜头画在主体之前）；点阵字用 `dotType` 的 `to` 一起吸进去；落进去那一刻在生长点放一圈光环 | `shots/v3a.js` `gather27` |
| 转场圆心 = 上一个镜头的交互点，主体先对准再回中间 | 下一个镜头的相机偏移解出来让主体（世界坐标 P）正好落在交互点 H：`cam.x = (W/2 − Hx)/z`、`cam.y = P.y − H/2 − (Hy − H/2)/z`；切点后用三次缓入缓出推回 0；遮罩的 `at(t)` 返回主体此刻的屏幕位置，圆心一路跟着它 | `shots/v3b.js` `off30` `heart30At`、`timeline.js` |
| 界面跟着主体的大动作反应 | 每块按顺序（离动作源近的先）晚 0.05 s：0.07 s 压扁（sin 包络）→ 抛体 `dy = −v0·τ + ½gτ²`（v0 1150、g 9200 px/s²）+ 一点随机翻转 + 往远处缩 + 末尾淡掉；连线、标签这类"信息"先收掉；前后镜头各画一份 | `shots/v3a.js` `plates28` `plateJump29`、`fallPlates28` |
| 循环运动逐渐加速、不跳 | 相位 = (路程 × 每根的速度 + 偏移) % 1，路程 `d + ½·a·d²`（速度 1 + a·d 线性加）；直接 `t × 速度(t)` 会在速度变化时整体跳位 | `shots/v3b.js` `linkStart25` |
| 用户改了素材文件名、又要保持原来的编号 | 排序键用改名前的名字（`RENAMED = { 'Q1.png': 'ComfyUI_16694_.png' }`），改名后的文件既留在原位置，又单独登记成新的一组 | `scripts/qn_resize.mjs` |
| 主体出来之前先"采样"它的位置（第二十六轮） | 在它将要出现的地方先画同一套格子（淡点阵）+ 虚线取景框，格子里每个十六分音符按候选概率抽一个候选的点阵（概率和画面里别处的候选卡用同一个函数），标签写这一刻的 p；真正的主体飞进来时候选格淡掉 | `shots/drop.js` `geSampling`（用 `l01.js` 的 `candidates`） |
| 数字快速往上涨、条一直在滚（第二十六轮） | 等级 = 起点 + ⌊路程⌋，路程是速度（4 → 12 级 / 秒匀加）对时间的积分；条的长度 = 路程的小数部分（每升一级涨满一次），离上次升级的时间 = 小数部分 ÷ 当前速度，用它做圆章弹跳、数字上滚和涨满闪白 | `shots/l04.js` `nurture24`（`l04v26`） |
| 超分后宽高比变了的视频 | 先把超分版和原版同一帧缩到同样大小做差值图：内容对得上就是被拉伸了，抽帧时缩回原比例（1890 × 1080 = 7:4），跟踪数据和摆位都不用动 | `ffmpeg -vf scale=1890:1080` → `build/frames/V11_3/` |

## 验证

- 总览图：`node render/sheet.mjs --at t1 t2 … --cols 4 --w 480 --out x.png`；转场：`--trans --from a --to b`；对比旧版：`--rev 键=旧轮次`。
- 连续几帧看抽搐 / 跳变：`--at` 用 1/60 s 的间隔取 6–8 帧。
- 1–2 px 的问题：单帧 `node render/render.mjs --png t`，再放大裁切（最近邻放大 2–4 倍）。
