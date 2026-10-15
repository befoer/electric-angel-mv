# 人声分轨在 [t0, t1] 里每 10 ms 的响度（dB）和谱通量——找某个音真正唱出来的时刻（第十七轮）
# 用法（项目根目录）：.venv\Scripts\python.exe -I scripts\vocal_onsets.py 21.0 22.0
#   加 --strong 只列谱通量 > 250 或响度 < −30 dB 的行（起音和辅音前的空隙）
#   加 --notes（第十八轮）：按音高切成一个个音，一行一个事件——这是对字最好用的视图：
#       音  = 一段稳定的音高（每个假名一般就是一个音；同一个音高上换字时中间常有一个小凹）
#       空  = −30 dB 以下的空隙（k / t / d / ch 的闭塞，或者换气）
#       气  = 有响度、没有音高（s / sh / h、送气、换气声；「♪」「♪」的元音常被吞掉，只剩这一段气声）
#     每行带小节.拍.十六分（这首歌 150 BPM，第 1 小节从 0.0665 s 起），重音一般落在拍上，可以用来核对
#   --line L03（第十八轮）：列出这一句的字（对时数据的时刻、已经量好的实测值），接着出这句前后的 --notes——对一整句时用这个
# 读法：k / t / d / ch 这类辅音前会有一段 −30 dB 以下的空隙，空隙之后谱通量猛涨的那一行就是这个音的起点；
#       data/lyrics_timing.json（stable-ts）有好几处比这个晚 0.1–0.9 s，多拍的字（声 = ♪、独 = ♪）常错位。
#       第十七轮只看响度和谱通量，把两个字认错了（L02 句尾的「♪」当成 L03 的「♪」、L14 的「♪」当成「♪」）——
#       对一整句时先用 --notes 把音一个个数出来，和这句的假名一一对上（数目要对得上），再取起音
# 量好的结果写进 data/vocal_onsets.json（引擎里 onset(id, i) 取）
import sys, wave
import numpy as np

sys.stdout.reconfigure(encoding='utf-8')
path = 'build/stems/vocals.wav'
argv = sys.argv[1:]
args = [a for i, a in enumerate(argv) if not a.startswith('--') and not (i > 0 and argv[i - 1] == '--line')]
strong, notes = '--strong' in argv, '--notes' in argv
if '--line' in argv:
    # --line L03（第十八轮）：先列这句的字、对时数据的时刻、data/vocal_onsets.json 里已经量好的（没有就是 —），
    # 再出这句前后的 --notes（从对时数据的开头前 0.8 s 到结尾后 0.4 s）
    import json, re
    lid = argv[argv.index('--line') + 1]
    timing = json.load(open('data/lyrics_timing.json', encoding='utf8'))['lines']
    rows_txt = [s for s in open('资料/电子天使-歌词.txt', encoding='utf8').read().splitlines() if s.strip()]
    jp = [re.sub(r'[ 　]', '', re.sub(r'\([^)]*\)', '', s.replace('"e;', '"'))) for i, s in enumerate(rows_txt) if i % 2 == 0]
    meas = json.load(open('data/vocal_onsets.json', encoding='utf8')).get(lid)
    i = next(k for k, L in enumerate(timing) if L['id'] == lid)
    L = timing[i]
    print(f'{lid}  对时数据 {L["start"]:.2f}–{L["end"]:.2f} s')
    for j, (c, (a, b)) in enumerate(zip(jp[i], L['chars'])):
        m = meas[j] if meas and meas[j] is not None else None
        print(f'  {j:2d} {c}  数据 {a:6.2f}   实测 {"—" if m is None else f"{m:6.2f}"}')
    print()
    t0, t1, notes = L['start'] - 0.8, L['end'] + 0.4, True
else:
    t0, t1 = float(args[0]), float(args[1])
with wave.open(path) as w:
    sr, ch, sw = w.getframerate(), w.getnchannels(), w.getsampwidth()
    start = max(0.0, t0 - 0.1)
    w.setpos(int(start * sr))
    raw = w.readframes(int((t1 - start + 0.1) * sr))
x = np.frombuffer(raw, dtype={2: np.int16, 4: np.int32}[sw]).astype(np.float32).reshape(-1, ch).mean(1) / (2 ** (8 * sw - 1))
hop, win = int(sr * 0.01), int(sr * 0.04)
NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
BAR0, BEAT = 0.0665, 0.4


def pos(t):  # 小节.拍.十六分
    q = round((t - BAR0) / (BEAT / 4))
    return f'{q // 16 + 1}.{q % 16 // 4 + 1}.{q % 4 + 1}'


def pitch(seg):  # 自相关取基频（150–1200 Hz），返回 (midi, 置信度)
    s = seg * np.hanning(len(seg))
    ac = np.correlate(s, s, 'full')[len(s) - 1:]
    lo, hi = int(sr / 1200), int(sr / 150)
    if ac[0] <= 0:
        return None, 0
    r = ac[lo:hi] / ac[0]
    i = int(np.argmax(r))
    return 69 + 12 * np.log2(sr / (lo + i) / 440), float(r[i])


rows, prev = [], None
for k in range(0, len(x) - win, hop):
    t = start + k / sr + 0.02
    seg = x[k:k + win]
    sp = np.abs(np.fft.rfft(seg * np.hanning(win)))
    flux = 0.0 if prev is None else float(np.maximum(sp - prev, 0).sum())
    prev = sp
    if t < t0 or t > t1:
        continue
    db = 20 * np.log10(np.sqrt((seg ** 2).mean()) + 1e-9)
    if not notes:
        if strong and not (flux > 250 or db < -30):
            continue
        print(f'{t:7.2f} {db:6.1f} dB {"#" * max(0, int((db + 50) / 1.2)):<42} flux {flux:6.1f}')
        continue
    m, conf = pitch(seg) if db > -30 else (None, 0)
    rows.append((t, db, round(m) if m is not None and conf > 0.5 else None))

if notes:
    # 每 10 ms 一个标签：空 / 气 / 音高（八度跳错的并回前一个音），再把相同标签连成段；短于 30 ms 的段并进前一段
    lab, last = [], None
    for t, db, m in rows:
        if db < -30:
            lab.append('空')
        elif m is None:
            lab.append('气')
        else:
            if isinstance(last, int) and abs(m - last) == 12:
                m = last
            lab.append(m)
            last = m
    segs = []
    for (t, db, _), l in zip(rows, lab):
        if segs and segs[-1][2] == l:
            segs[-1][1] = t; segs[-1][3] = min(segs[-1][3], db); segs[-1][4] = max(segs[-1][4], db)
        else:
            segs.append([t, t, l, db, db])
    out = []
    for s in segs:
        if out and s[1] - s[0] < 0.025 and s[2] != '空':
            out[-1][1] = s[1]
            continue
        if out and out[-1][2] == s[2]:
            out[-1][1] = s[1]; out[-1][3] = min(out[-1][3], s[3]); out[-1][4] = max(out[-1][4], s[4])
            continue
        out.append(s)
    for a, b, l, lo, hi in out:
        kind = f'音 {NAMES[l % 12]}{l // 12 - 1:<2}' if isinstance(l, int) else l + '    '
        print(f'{a:7.2f}–{b:5.2f}  {b - a + 0.01:4.2f}s  {kind}  {lo:6.1f}…{hi:6.1f} dB   @{pos(a)}')
