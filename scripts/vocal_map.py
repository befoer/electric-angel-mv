# -*- coding: utf-8 -*-
"""
全曲人声电平图（按小节对齐），用于肉眼核对段落结构。

每行 = 4 小节（6.4s），每字符 = 1 拍（0.4s）。
字符 = 该拍内人声轨的峰值电平：
  ' ' 无  '.' 极弱/串音  ':' 弱  '+' 中  '#' 强  '@' 很强
同时导出更细的乐句切分（门限更严、只合并 <0.15s 的间隙）。
"""
import json
import os
import wave

import numpy as np
from scipy import signal

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main():
    with wave.open(os.path.join(ROOT, "build", "stems", "vocals.wav"), "rb") as w:
        sr = w.getframerate()
        x = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(np.float64) / 32768.0
        x = x.reshape(-1, 2).mean(axis=1)
    b, a = signal.butter(4, [150 / (sr / 2), 6000 / (sr / 2)], btype="band")
    x = signal.filtfilt(b, a, x)
    g = json.load(open(os.path.join(ROOT, "build", "grid.json"), encoding="utf-8"))
    beat, d0 = g["beat"], g["first_downbeat"]

    hop = int(0.01 * sr)
    n = len(x) // hop
    rms = np.sqrt(np.array([np.mean(x[i * hop:(i + 1) * hop] ** 2) for i in range(n)]))
    db = 20 * np.log10(rms + 1e-9)
    ref = np.percentile(db, 98)
    t = (np.arange(n) + 0.5) * hop / sr

    def ch(v):
        r = v - ref
        return " " if r < -40 else "." if r < -30 else ":" if r < -22 else "+" if r < -14 else "#" if r < -7 else "@"

    print(f"人声轨参考电平 {ref:.1f} dB（98 分位）")
    print("每行 4 小节，每字符 1 拍；| 为小节线\n")
    nbeats = int((len(x) / sr - d0) / beat) + 1
    for row in range(0, nbeats, 16):
        s = ""
        for k in range(row, min(row + 16, nbeats)):
            if k % 4 == 0:
                s += "|"
            t0 = d0 + k * beat
            m = (t >= t0) & (t < t0 + beat)
            s += ch(db[m].max()) if m.any() else " "
        tt = d0 + row * beat
        print(f"  小节{row//4+1:>4}  {int(tt//60)}:{tt%60:05.2f}  {s}|")

    # 细分乐句
    on = db > ref - 22
    ph = []
    i = 0
    while i < n:
        if on[i]:
            j = i
            while j < n and on[j]:
                j += 1
            ph.append([t[i], t[j - 1]])
            i = j
        else:
            i += 1
    merged = []
    for p in ph:
        if merged and p[0] - merged[-1][1] < 0.15:
            merged[-1][1] = p[1]
        else:
            merged.append(p)
    merged = [p for p in merged if p[1] - p[0] > 0.12]
    print(f"\n细分乐句 {len(merged)} 个；列出每段的首末句与 >1.2s 的停顿：")
    prev = None
    for p in merged:
        if prev is None or p[0] - prev[1] > 1.2:
            gap = "" if prev is None else f"   ← 停顿 {p[0]-prev[1]:.2f}s"
            bar = (p[0] - d0) / (beat * 4)
            print(f"  {int(p[0]//60)}:{p[0]%60:05.2f}  起  (小节 {int(bar)+1}.{(bar%1)*4+1:.2f}){gap}")
        prev = p

    with open(os.path.join(ROOT, "build", "vocal_phrases.json"), "w", encoding="utf-8") as fp:
        json.dump([[round(a, 3), round(b, 3)] for a, b in merged], fp)


if __name__ == "__main__":
    main()
