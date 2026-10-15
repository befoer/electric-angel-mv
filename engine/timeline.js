// 镜头表：小节区间 → 镜头函数（视觉方案 §五）。镜头在小节第 1 拍切换；歌词文字按演唱时间出现
import { barStart, beatTime, clamp, smooth, easeOut } from './core/time.js';
import { onset } from './core/data.js';
import { W, H } from './core/const.js';
import { configDiff } from './core/ui.js';
import { placeholder } from './shots/common.js';
import { intro } from './shots/intro.js';
import { l01m } from './shots/drop.js';
import { opening, ICON_RECT, ICON_RADIUS } from './shots/opening.js';
import { rev } from './rev.js';
import { cutAt } from './core/cuts.js';
import { l01 } from './shots/l01.js';
import { l02, WISH_RECT, CHAR_RECT, PCARD_IN } from './shots/l02.js';
import { l03, THUMB_END, thumbAt, T_IRIS03, l03Figure } from './shots/l03.js';
import { l04, heartTo0 } from './shots/l04.js';
import { l05 } from './shots/l05.js';
import { morphShape, cornerFrame } from './core/trans.js';
import { l06, embRect, binHandoff } from './shots/l06.js';
import { l07, youRect, focusRect } from './shots/l07.js';
import { l08, heartAt } from './shots/l08.js';
import { l09 } from './shots/l09.js';
import { l10 } from './shots/l10.js';
import { l11 } from './shots/l11.js';
import { l12 } from './shots/l12.js';
import { i1 } from './shots/i1.js';
import { l13, l14, l15, l16, photo13Rect, warmHandoff, her1314, HAND13 } from './shots/v2a.js';
import { l17, l18, l19, l20, input17Rect, handoff1819, handoff1920, you20, box1718 } from './shots/v2b.js';
import { l21, l22, l23, l24, scopeHandoff, scopeCenter, win24 } from './shots/v2c.js';
import { comfy, termWin } from './shots/comfy.js';
import { interlude2 } from './shots/interlude2.js';
import { entry, l25, l26, l27, l28, chipToWin21, her2728, i08At28 } from './shots/v3a.js';
import { l29, l30, l31, l32, her2829, heart30At } from './shots/v3b.js';
import { outro1, outro2, outro3, outro4 } from './shots/outro.js';

// [起始小节, 结束小节（不含）, 镜头号, 布局, 实现 | 占位说明, 歌词装饰]
const TABLE = [
  [1, 2, '开场', '满', opening],
  [2, 10, '前奏', '窗', intro],
  // 第一段 · 萝莉音
  [10, 12, 'L01', '满', l01m],
  [12, 14, 'L02', '分', l02],
  [14, 16, 'L03', '窗', l03],
  [16, 18, 'L04', '层', l04],
  [18, 20, 'L05', '字', l05, '关键词"0 和 1"，网格字'],
  [20, 22, 'L06', '满', l06, '关键词"I"，巨字'],
  [22, 24, 'L07', '格', l07],
  [24, 26, 'L08', '字', l08],
  [26, 28, 'L09', '窗', l09],
  [28, 30, 'L10', '层', l10, '"电子的心"拼成心形'],
  [30, 32, 'L11', '字', l11],
  [32, 34, 'L12', '满', l12],
  // 间奏一
  [34, 42, '间奏一', '格', i1],
  // 第二段 · 御姐音
  [42, 44, 'L13', '窗', l13],
  [44, 46, 'L14', '满', l14],
  [46, 48, 'L15', '分', l15],
  [48, 50, 'L16', '层', l16],
  [50, 52, 'L17', '窗', l17],
  [52, 54, 'L18', '满', l18],
  [54, 56, 'L19', '格', l19],
  [56, 58, 'L20', '字', l20],
  [58, 60, 'L21', '窗', l21],
  [60, 62, 'L22', '层', l22],
  [62, 64, 'L23', '字', l23],
  [64, 66, 'L24', '满', l24],
  // 特效音间奏
  [66, 74, 'ComfyUI', '格', comfy],
  // 间奏二
  // 第十五轮：整段重做成「第十七张」（以前的 Bad Apple 剪影版 badapple.js 在第十七轮删了，快照里有）
  // 第十六轮：按用户意见改（interlude2_r16.js）
  // 第十七轮：再按用户意见改。第十五轮版 interlude2_r15.js 原来按用户要求一直留着，第二十一轮用户说"不用专门保留了"，删了（快照里有）
  [74, 90, '间奏二', '罩', interlude2],
  // 第三段 · 少女音
  [90, 91, '进场', '闪', entry],
  [91, 93, 'L25', '满', l25],
  [93, 95, 'L26', '窗', l26],
  [95, 97, 'L27', '层', l27],
  [97, 99, 'L28', '分', l28],
  [99, 101, 'L29', '窗', l29],
  [101, 103, 'L30', '层', l30],
  [103, 105, 'L31', '字', l31],
  [105, 107, 'L32', '满', l32],
  // 尾奏
  [107, 111, '尾奏 1', '层', outro1],
  [111, 115, '尾奏 2', '格', outro2],
  [115, 119, '尾奏 3', '窗', outro3],
  [119, 121, '尾奏 4', '满', outro4],
];

// 第十五轮：切点不一定在小节线上（core/cuts.js，画帧时按开关取），所以 t0 / t1 是 getter
export const SHOTS = TABLE.map(([b0, b1, id, layout, impl, lyric = '']) => ({
  id, layout, bars: [b0, b1], get t0() { return b0 === 1 ? 0 : cutAt(b0); }, get t1() { return cutAt(b1); }, lyric,
  fn: typeof impl === 'function' ? impl : placeholder({ id, layout, bars: [b0, b1], desc: impl, lyric }),
  done: typeof impl === 'function',
}));

export function shotAt(t) {
  for (let i = SHOTS.length - 1; i >= 0; i--) if (t >= SHOTS[i].t0) return SHOTS[i];
  return SHOTS[0];
}

// 转场（视觉方案 §4.7，第六轮）：[进入的镜头, 类型（core/trans.js）, 边界前秒数, 边界后秒数, 参数, { liveA, liveB, bAt }]
// 窗口内前后两个镜头都画，再按类型合成；没登记的边界是硬切。
// 前一个镜头在边界前照常播放、边界后停在最后一帧；后一个镜头停在第一帧（liveB：照常播放；bAt：固定画它某一时刻的样子）。
// 注意 portal 推进的目标位置是按前一个镜头的最后一帧算的，前一个镜头在窗口内不要再移动那个目标
// 第二十二轮修：这张表以前是模块加载时就算好的数组，里面的 rev() 读的是默认值，--rev 改不到（第二十一轮挂在这里的转场开关其实切不回去）。
// 改成函数，和 TRANS_R9 一样在第一次用到时（setRev 之后）才算
const TRANS_TABLE = () => [
  ['前奏', 'portal', 0.15, 0.12, { rect: [W / 2 - 196, H / 2 - 110, 391, 220], shape: 'circle', ease: 'in' }, { liveB: true }], // 钻进瞳孔
  ['L02', 'whip', 0.14, 0.14, { dir: 'left' }],                                                                   // 镜头甩到规格书
  ['L03', 'portal', 0.3, 0, { rect: WISH_RECT, ease: 'in' }],                                                     // 推进「我想唱歌」→ 她的声音
  ['L04', 'iris', 0, 0.45, () => ({ x: THUMB_END[0], y: THUMB_END[1] }), { liveB: true }],                       // 从点赞按钮展开
  // 第二十二轮：马赛克照旧，上面叠 L04 的心飞成 L05 的「0」（l04.js heartTo0；第二十四轮并开关）
  ['L05', 'pixel', 0.22, 0.3, { max: 48, overlay: heartTo0 }, { liveA: true, liveB: true }], // 马赛克 → 0 和 1
  ['L07', 'whip', 0.14, 0.14, { dir: 'left' }],                                                                   // 甩进转盘（同方向继续转）
  ['L08', 'portal', 0.32, 0, () => ({ rect: youRect(), ease: 'in' })],                                            // 推进最新提交里的"你"字
  ['L09', 'tv', 0.2, 0.2],                                                                                        // 显存炸了 → 信号崩坏
  // 第二十二轮（用户：0:42 爱心转场提前 1 帧）：整个心形展开往前挪一帧（第二十四轮并开关）
  // 第二十四轮（用户又说一次「42：爱心转场提前 1 帧」）：再往前挪一帧，共 2 帧
  ['L10', 'iris', 2 / 60, 0.45 - 2 / 60, { shape: 'heart' }, { liveB: true }], // 心形展开（共提前 2 帧，第二十六轮并开关 t10x24）
  ['L11', 'whip', 0.14, 0.14, { dir: 'right' }],                                                                  // 顺着风甩
  ['L12', 'spin', 0.18, 0.18, { angle: 0.5 }],                                                                    // 转进摇晃
  // 第二段（第七轮）
  ['L13', 'iris', 0, 0.45, { x: 960, y: 774 }, { liveB: true }],                                                  // 从塌缩成的像素鲸鱼里展开
  ['L14', 'portal', 0.3, 0, () => ({ rect: photo13Rect(), ease: 'in' })],                                         // 推进角落里那张小照片
  ['L15', 'blinds', 0.2, 0.25, {}, { liveB: true }],                                                              // 斜条擦除，满编制回来
  ['L16', 'iris', 0, 0.4, { x: 890, y: 570 }, { liveB: true }],                                                   // 从钟表中心展开
  ['L17', 'whip', 0.14, 0.14, { dir: 'left' }],
  ['L18', 'portal', 0.3, 0, () => ({ rect: input17Rect(), ease: 'in' })],                                        // 推进空输入框：这次里面有字了
  ['L19', 'whip', 0.14, 0.14, { dir: 'right' }],
  ['L20', 'pixel', 0.2, 0.2, { max: 40 }, { liveB: true }],
  ['L21', 'iris', 0, 0.45, {}, { liveB: true }],
  ['L22', 'whip', 0.14, 0.14, { dir: 'down' }],
  ['L23', 'whip', 0.14, 0.14, { dir: 'right' }],                                                                  // 顺着风
  ['L24', 'tv', 0.18, 0.18],
  ['ComfyUI', 'shards', 0, 0.5, { nx: 10, ny: 6 }, { liveB: true }],
  // 第三段（第七轮）
  // 第二十二轮：叠化照旧（两张立绘眼睛对眼睛）；太阳飞到她胸口由两个镜头各在她后面画（v3a.js sunFly24，第二十六轮并开关 vs24）
  ['L25', 'overlayCut', 0.3, 0.35, { f0: 0, f1: 1, zoomA: 0, zoomB: 0 }, { liveA: true, liveB: true }], // 从她的脸叠化
  // 第二十一轮：词元背景两边是同一张、原地不动，L25 的她淡掉，最后那个「你」长成 L26 的窗口（第二十三轮并开关）
  ['L26', 'overlayCut', 0.2, 0.4, { f0: 0.25, f1: 0.7, zoomA: 0, zoomB: 0, overlay: chipToWin21 }, { liveA: true, liveB: true }],
  // 第二十五轮（用户：02:29 让背景的气泡文字向中间聚拢，再接下一个镜头的翅膀展开）：叠化，气泡词由两个镜头各自画（v3a.js gather27；第二十七轮并开关 t27g25）
  ['L27', 'overlayCut', 0.55, 0.35, { f0: 0.35, f1: 0.75, zoomA: 0.03, zoomB: 0 }, { liveA: true, liveB: true }],
  // 第二十一轮（用户：转场像 PPT，百叶窗和圆形蒙版都和前后画面元素没有关联）：两处都换成她本人走过剪辑点（第二十三轮并开关）
  // L27 → L28：她连同字翅膀从正中走到 L28 右边（v3a.js her2728）；L28 → L29：她走到视频里她的位置、叠化成视频里的她（v3b.js her2829）
  ['L28', 'overlayCut', 0.3, 0.4, { f0: 0.2, f1: 0.75, zoomA: 0.02, zoomB: 0.02, overlay: her2728 }, { liveA: true, liveB: true }],
  // 第二十四轮（V11_3，第二十六轮并开关 l29v24）：L28 的她往上飞出画面（her2829 → v3b.js herUp24），L29 的空画布更早叠上来，视频里的她接着从上面落下来
  ['L29', 'overlayCut', 0.3, 0.45, { f0: 0.15, f1: 0.45, zoomA: 0.02, zoomB: 0, overlay: (ctx, S, u) => her2829(ctx, S, u, i08At28) }, { liveA: true, liveB: true }],
  // 第二十五轮（用户：02:38 爱心转场从手部开始，下一个镜头的像素大心先对齐这个位置，再摄像机位移回到画面中心）：圆心跟着 L30 的像素心走（v3b.js heart30At；第二十七轮并开关 t30h25）
  ['L30', 'iris', 0, 0.45, { shape: 'heart', at: heart30At }, { liveB: true }],
  ['L31', 'whip', 0.14, 0.14, { dir: 'right' }],                                                                  // 顺着风
  // 第二十一轮：L31 塌缩出来的她就在 L32 开头她的位置，直接叠化接过去（第二十三轮并开关）
  ['L32', 'fade', 0.1, 0.12, {}, { liveB: true }],
  // 尾奏（第七轮）
  ['尾奏 1', 'fade', 0.15, 0.3, { color: '#FFFFFF' }, { liveB: true }],                                           // L32 白闪接小票
  ['尾奏 2', 'whip', 0.14, 0.14, { dir: 'left' }],
  ['尾奏 3', 'fade', 0.4, 0.4, {}, { liveB: true }],                                                              // 编制撤出，安静地叠化                                              // 撕碎的画面碎成方块，露出 16 格
];
// 第二十轮 L07 → L08（rev l08t20）：粉色焦点框四角连成整框 → 停一下、往回歪 8°（蓄力）→ 唱到「♪」的「♪」开始越转越快的一整圈，
// 转的时候变成 L08 锁定框里的粉心、背景从右往左甩进 L08，落定时冲过一点再回来（窗口 = 切点前 0.4 s 到切点后 0.5 s）
function focusSpin20(ctx, S, u) {
  const ws = cutAt(24) - 0.4, t = S.t, ts = onset('L08', 0) - 0.02, fr = focusRect(), h = heartAt(t), col = S.pal.acc[0];
  const c = (t - ws) / 0.24;
  if (c < 1) { cornerFrame(ctx, fr[0], fr[1], fr[2], fr[3], smooth(c), { color: col, lw: 5 }); return; }
  const v = clamp((t - ts) / 0.46), wv = smooth(clamp((t - ts) / 0.4)), ob = (1 - wv) * W, a = 1 - clamp((u - 0.95) / 0.05);
  const pre = -0.14 * easeOut(clamp((t - ws - 0.24) / Math.max(0.05, ts - ws - 0.24))) * (1 - v); // 蓄力：往回歪
  const P = v < 0.8 ? 1.06 * (v / 0.8) ** 2.2 : 1 + 0.06 * Math.cos(((v - 0.8) / 0.2) * Math.PI * 1.5) * (1 - (v - 0.8) / 0.2); // 越转越快，冲过一点再回来
  const e = smooth(clamp((v - 0.15) / 0.7));
  morphShape(ctx, { kind: 'rect', x: fr[0], y: fr[1], w: fr[2], h: fr[3] }, { kind: 'heart', x: h.x - h.size / 2 + ob, y: h.y - h.size / 2, w: h.size, h: h.size }, e,
    { fill: [0, 0.92], fillCurve: x => clamp((x - 0.55) / 0.45) ** 2, lw: [5, 6], alpha: a, halo: true, rot: pre + 2 * Math.PI * P, color: col });
}

// 第九轮起的转场：同一个镜头号的条目替换上面的，新镜头号的条目追加（用户：尽量减少生硬的硬切）
const TRANS_R9 = () => [
  ['前奏', 'appOpen', 0.15, 0.22, { rect: ICON_RECT, radius: ICON_RADIUS }, { liveB: true }], // 点开应用图标
  ['L08', 'whip', 0.14, 0.16, { dir: 'left' }],                            // 转盘一直加速，顺着同一方向甩进 L08
  // 以前的硬切：L06、间奏一（Bad Apple 那一刀在 ComfyUI 段里一起处理）
  ['L06', 'focus', 0.25, 0.25, { blur: 9 }, { liveB: true }],              // 0 和 1 失焦，「I」从虚焦里收清楚（shot-transitions C 式）
  ['间奏一', 'sweep', 0.2, 0.25, { dir: 1 }, { liveB: true }],              // 一块白面板扫过去，扫完就是间奏一（transition-hidden-cut A 式）
  // 甩镜太多（前两分钟 7 次），换掉两次：同一种手法别老当主角（审美准则 P4）
  ['L07', 'sweep', 0.18, 0.22, { dir: -1 }, { liveB: true }],              // 记录面板从右往左扫过，后面就是转盘（和转盘同方向）
  ['L17', 'focus', 0.3, 0.3, { blur: 10 }, { liveB: true }],               // 她的视角：焦点从上一个镜头收到"空着的你"
  ['L09', 'tv', 0.2, 0.2, { flash: 0 }],                                   // 显存炸了 → 信号崩坏，但不整屏闪（R4）
  ['L24', 'spin', 0.16, 0.2, { angle: 0.22 }, { liveB: true }],            // 1:41 不再用信号崩坏进来：轻轻一转（心在摇晃）
  ['ComfyUI', 'fade', 0.22, 0.12, { color: '#EEF2FF' }, { liveB: true }], // 淡到底色 → 终端里启动 ComfyUI（第十二轮：终端是浅色的，淡到浅蓝白）
  ['间奏二', 'crtOff', 0.3, 0.32, {}, { liveB: true }],                 // 显存炸了：显示器关机，黑里亮起间奏二（以前是硬切）
  // ---- 第十一轮（后写的同镜头号条目覆盖前面的）
  // 她先出现在「我想唱歌」旁边，再推进（第十二轮：只露她的图、裁在提示词卡里，其余元素推进时再显出来）
  ['L03', 'charPortal', 1.0, 0.15, { rect: CHAR_RECT, keep: [1140, 70, 780, 960], split: 0.3, only: l03Figure, clip: PCARD_IN }, { liveA: true, liveB: true }],
  // 第二十轮（用户：0:32 转场效果改到从唱到「♪日」的「♪」开始，往后一点）：以前切点前 0.4 s 就开始开窗，现在从切点（= 唱到「♪」）才开始，0.6 s 开完
  ['L07', 'appOpen', 0.02, 0.6, () => ({ rect: embRect(), radius: 16, dim: 0.35, dimColor: '#EEF2FF' }), { liveA: true, liveB: true }], // 左上的 embedding 卡打开成 L07（穿窗）
  // ---- 第十二轮：一个元素跨过剪辑点（overlayCut）
  // 29–31 秒：L05 她身上的 0/1 一格格起飞，带着颜色飞进 L06 的「AI」（rev l05to06）
  ['L06', 'overlayCut', 0.55, 0.35, { f0: 0.35, f1: 0.75, zoomA: 0.04, zoomB: 0.04, overlay: binHandoff }, { liveA: true, liveB: true }],
  // 1:10–1:30
    ['L15', 'scanWipe', 0.15, 0.4, { squares: true }, { liveA: true, liveB: true }],
    ['L14', 'overlayCut', HAND13, HAND13, { f0: 0.25, f1: 0.7, zoomA: 0.04, zoomB: 0.03, overlay: her1314 }, { liveA: true, liveB: true }], // 第十三轮：她本人从 L13 走进 L14
    ['L16', 'iris', 0, 0.4, { x: 960, y: 540 }, { liveB: true }], // 第十三轮：L15 最后把钟心推到画面正中，L16 的滑块圆钮也在正中
    ['L17', 'overlayCut', 0.35, 0.4, { f0: 0.25, f1: 0.7, overlay: warmHandoff }, { liveA: true, liveB: true }], // 「暖」旁边她的头像飞到 L17 正中，变成"你"的头像框
    ['L18', 'slideDown', 0.35, 0.35, { overlay: box1718 }, { liveA: true, liveB: true }], // 同一张画布往下走（L18 在 L17 的下面）；第十三轮：输入框留在画面里变成 L18 的消息
    ['L19', 'overlayCut', 0.4, 0.4, { f0: 0.2, f1: 0.6, zoomA: 0.03, zoomB: 0.03, overlay: handoff1819 }, { liveA: true, liveB: true }], // 伸手的她走成 L19 墙前的剪影
    ['L20', 'overlayCut', 0.35, 0.35, { f0: 0.2, f1: 0.6, zoomA: 0.03, zoomB: 0.03, overlay: handoff1920 }, { liveA: true, liveB: true }], // 剪影走成「你」组成的她
    ['L21', 'overlayCut', 0, 0.9, { f0: 0, f1: 0.01, zoomA: 0, zoomB: 0, overlay: (ctx, S) => you20(ctx, S, S.t - cutAt(58)) }, { liveB: true }], // 铺满画面的「你」一格格缩没，露出 L21
    ['L22', 'overlayCut', 0.35, 0.35, { f0: 0.3, f1: 0.75, zoomA: 0.06, zoomB: 0.04, overlay: scopeHandoff }, { liveA: true, liveB: true }], // 「if (you) return;」的窗口变成示波器屏幕
    ['L23', 'iris', 0.05, 0.45, { shape: 'heart', ease: 'burst', color: '#7FF3FF', glow: true, ...scopeCenter() }, { liveA: true, liveB: true }], // 示波器里那颗心撑开整个画面
  // 49.7 秒：画面里所有东西被风（L11 的风，往右）吹走，L12 从左边带着摆动进来
  ['L12', 'windBlow', 0.45, 0.3, { pivot: [960, 1040] }, { liveA: true, liveB: true }],
  // 37 秒：L07 的焦点框跟着甩镜一路带过去，变成 L08 锁定框里的粉心
  // 第十三轮（用户：粉色连接用原来的四角粉框先连成完整的框；变到下一个镜头时加旋转，旋转带弹性）：0–0.3 四个角线长到半边、连成整框（不再跟着甩镜飞走，
  // 留在画面里）；0.3 起整框变形成 L08 的心，同时转一整圈、弹性落定（过冲几下）；心的位置跟着甩进来的 L08 走
  // 第二十轮（用户：唱到「♪」的时候粉色矩形框再加速旋转到下一个镜头）：四角连成整框以后先停一下（往回轻轻歪一点，像蓄力），
  // 唱到「♪」那一刻才开始转——越转越快（一整圈），转的同时变成心、背景甩进 L08，落定时冲过一点再回来
  ['L08', 'overlayCut', 0.4, 0.5, { bg: 'whip', dir: 'left', w0: 0.44, w1: 0.89, overlay: focusSpin20 }, { liveA: true, liveB: true }],
  // 按下赞、心冒出来几帧后，圆从按钮里长出来（第十二轮：连点几下赞，最后一下之后才长出来）
  // 第十六轮：切点提前到「♪」前（cutAt），圆仍从最后一下点赞之后开始；切点之后多展开一点（0.15 → 0.22 s）
  ['L04', 'iris', cutAt(16) - T_IRIS03(), 0.22, { at: thumbAt, ease: 'burst' }, { liveA: true, liveB: true }],
  // ---- 第十五轮
  // 1:44 L24 的 DeepSeek 窗口变成 ComfyUI 的启动终端：同一扇窗口摆正、换内容（以前是淡到底色）
  ['ComfyUI', 'winMorph', 0.35, 0.3, { a: win24, b: termWin }, { liveA: true, liveB: true }],
  // 1:56 间奏二：上一段碎掉的 16 张图碎成噪点，铺满全屏就是第 1 步的噪声场（以前是显示器关机）
  ['间奏二', 'noiseIn', 0.4, 0.05, {}, { liveA: true, liveB: true }],
];
let TR = null;
function transitions() {
  if (TR) return TR;
  const add = [...new Map(TRANS_R9().map(r => [r[0], r])).values()], table = [...TRANS_TABLE().filter(r => !add.some(n => n[0] === r[0])), ...add];
  TR = table.map(([id, type, a, b, p = {}, live = {}]) => {
    const i = SHOTS.findIndex(s => s.id === id);
    return { from: SHOTS[i - 1], to: SHOTS[i], type, w0: SHOTS[i].t0 - a, w1: SHOTS[i].t0 + b, p: typeof p === 'function' ? p() : p, ...live };
  }).sort((x, y) => x.w0 - y.w0);
  return TR;
}
export const transitionList = () => transitions();
export function transitionAt(t) {
  for (const r of transitions()) if (t >= r.w0 && t < r.w1) return { ...r, u: (t - r.w0) / (r.w1 - r.w0) };
  return null;
}

// 跨镜头的全局叠层：段落切换的 config diff（视觉方案 §4.8）
const DIFFS = [
  [beatTime(41, 4), ['萝莉音', '晴空'], ['御姐音', '夜海']],
  [beatTime(90, 1), ['御姐音', '夜海'], ['少女音', '晨光']],
];
export function overlays(ctx, S) {
  // 第二十轮：2:22 那一次换成进场镜头里的日出（v3a.js），开关面板只留 1:05 那一次
  for (const [t0, a, b] of DIFFS) if (b[0] !== '少女音') configDiff(ctx, S, a, b, S.t - t0);
}
