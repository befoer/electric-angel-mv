// 全片常量。数值来源：项目方案 §二、§3.3、视觉方案 §4.1
export const W = 1920, H = 1080, FPS = 60;
export const DURATION = 191.6876;
export const NFRAMES = Math.ceil(DURATION * FPS);
// 成片的起点（第十三轮，用户：片头没有音乐的那段太长）：音频 0–1.2 s 是静音，成片从 0.6 s 开始（出片时视频和音频一起从这里切），
// 时间轴上其他所有时刻不变
export const filmStart = () => 0.6;

// 节拍网格：第 k 小节起点 = BAR0 + BAR × (k − 1)
export const BAR0 = 0.0665, BEAT = 0.4, BAR = 1.6, STEP = 0.1; // STEP = 十六分音符

// 字符网格：12×20 px，160 列 × 54 行
export const CW = 12, CH = 20, COLS = 160, ROWS = 54;

export const BRAND = '#4D6BFE';
