// 尾奏制作信息里「CLIP Text Encode」节点滚动显示的文字：用户历轮的修改意见（第二十二轮，用户：文本提示词就是我给你的这些修改方案，尽可能多的放上去滚动显示）。
// 来源：文档/打磨意见记录.md（第八到第二十一轮，意见的摘要；第二十六轮以前在 skill 的 references/feedback-log.md）+ 归档/修改方案/ 里用户的原话（第二十二轮起，NN轮修改方案.md）。
// 去掉记录里的原则标签〔…〕和 Claude 加的答复 / 说明；歌词原文不进数据：假名连同前面的一个汉字换成 ♪，引号里出现在歌词里的词也换成 ♪（项目方案 §六）。
// 新一轮开工时把根目录的意见文件复制一份到 归档/修改方案/，把文件名加进下面的 ROUNDS 再跑一次：node scripts/credits_prompt.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const LOG = '文档/打磨意见记录.md';
const ROUNDS = [['第二十二轮', '归档/修改方案/21轮修改方案.md'], ['第二十三轮', '归档/修改方案/22轮修改方案.md'], ['第二十四轮', '归档/修改方案/23轮修改方案.md'], ['第二十五轮', '归档/修改方案/24轮修改方案.md'], ['第二十六轮', '归档/修改方案/25轮修改方案.md'], ['第二十七轮', '归档/修改方案/26轮修改方案.md'], ['第二十八轮', '归档/修改方案/27轮修改方案.md']];
const lyricText = readFileSync('资料/电子天使-歌词.txt', 'utf8');

const KANA = /[一-鿿]?[぀-ヿー]+/g;
function mask(s) {
  s = s.replace(KANA, '♪');
  // 引号里的词在歌词里出现过（中文译词）→ ♪
  s = s.replace(/([「“"])([^」”"]{2,})([」”"])/g, (m, a, w, b) => (lyricText.includes(w) ? `${a}♪${b}` : m));
  return s.replace(/♪(\s*♪)+/g, '♪');
}
function clean(s) {
  return s
    .replace(/〔[^〕]*〕/g, '')
    .replace(/\*\*/g, '')
    .replace(/（(→|是：|是，|能|答|不是|其实|一部分|上一轮|查下来|自查|用户是|R4|实测|这句|第[一二三四五六七八九十]+轮)[^）]*）/g, '')
    .replace(/——(查下来|顺带)[^。]*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const lines = [], own = new Set(ROUNDS.map(r => r[0]));
let skip = false; // 有原话文件的那一轮，log 里的摘要跳过（下面用原话）
for (const raw of readFileSync(LOG, 'utf8').split(/\r?\n/)) {
  const h = raw.match(/^## (第[^（\s]+轮)/);
  if (h) { skip = own.has(h[1]); if (!skip) lines.push(`# ${h[1]}`); continue; }
  if (!skip && raw.startsWith('- ')) { const s = mask(clean(raw.slice(2))); if (s) lines.push(s); }
}
for (const [title, file] of ROUNDS) {
  if (!existsSync(file)) { console.warn(`没有 ${file}，跳过`); continue; }
  lines.push(`# ${title}`);
  // 段落为单位（空行分隔）；段落里的几行用空格连起来（开头那段人设代码一行一个词）
  for (const para of readFileSync(file, 'utf8').split(/\r?\n\s*\r?\n/)) {
    const s = mask(clean(para.split(/\r?\n/).map(x => x.trim()).filter(Boolean).join(' ')));
    if (s) lines.push(s);
  }
}
writeFileSync('data/credits_prompt.json', JSON.stringify({ _说明: '由 scripts/credits_prompt.mjs 生成，别手改。尾奏 CLIP Text Encode 节点滚动显示的修改意见（歌词已换成 ♪）', lines }, null, 1) + '\n');
console.log(`${lines.length} 行，${lines.join('').length} 字 → data/credits_prompt.json`);
