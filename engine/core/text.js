// 文字效果：解码显现、流式输出（视觉方案 §4.1 C、D）
import { hash } from './rand.js';

export const SCR_N = '!<>-_\\/[]{}=+*^?#%$&@01~:;';
export const SCR_W = '零壹贰叁肆伍陆柒捌玖鲸海码思考米饭電子天使';
const isWideCode = ch => ch.codePointAt(0) >= 0x2e80;

// 解码显现：第 i 个字在 i×step 秒出现，先乱跳 settle 秒再锁定成目标字
// 返回当前应显示的字符串（长度 = 已出现的字数）
export function decode(str, age, { step = 0.1, settle = 0.3, flick = 0.05, seed = 0 } = {}) {
  if (age < 0) return '';
  const chars = [...str], out = [];
  const k = Math.floor(age / flick);
  for (let i = 0; i < chars.length; i++) {
    const a = age - i * step;
    if (a < 0) break;
    let ch = chars[i];
    if (ch !== ' ' && a < settle) {
      const set = isWideCode(ch) ? SCR_W : SCR_N;
      ch = set[hash(seed, i, k) % set.length];
    }
    out.push(ch);
  }
  return out.join('');
}

// 解码完成所需的时间
export const decodeDur = (str, { step = 0.1, settle = 0.3 } = {}) => ([...str].length - 1) * step + settle;

// 流式输出：每 per 秒一个 token（默认八分音符 0.2 s）。中文按 1–2 字切 token，英文按词
export function tokens(str) {
  const out = [];
  for (const m of str.matchAll(/[A-Za-z0-9'.]+\s?|[⺀-￿]{1,2}|./gu)) out.push(m[0]);
  return out;
}
export function stream(str, age, per = 0.2) {
  if (age < 0) return '';
  const tk = tokens(str);
  return tk.slice(0, Math.min(tk.length, Math.floor(age / per) + 1)).join('');
}
