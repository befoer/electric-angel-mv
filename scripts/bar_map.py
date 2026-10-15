# -*- coding: utf-8 -*-
"""
逐小节结构图：每小节一行，列出 鼓 / 贝斯 / 合成器 / 人声 的能量，
用于划分段落（前奏、A、B、副歌、间奏、尾奏）和规划器乐段动画。
导出 build/bars.json
"""
import json
import os
import wave

import numpy as np
from scipy import signal

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STEMS = os.path.join(ROOT, "build", "stems")


def load(name):
    with wave.open(os.path.join(STEMS, f"{name}.wav"), "rb") as w:
        sr = w.getframerate()
        x = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(np.float64) / 32768.0
    return x.reshape(-1, 2).mean(axis=1), sr


def main():
    g = json.load(open(os.path.join(ROOT, "build", "grid.json"), encoding="utf-8"))
    bar, d0 = g["bar"], g["first_downbeat"]
    data = {}
    for name in ["drums", "bass", "other", "vocals"]:
        x, sr = load(name)
        n = int((len(x) / sr - d0) / bar) + 1
        vals = []
        for k in range(n):
            a, b = int((d0 + k * bar) * sr), int((d0 + (k + 1) * bar) * sr)
            seg = x[max(a, 0):min(b, len(x))]
            vals.append(np.sqrt(np.mean(seg ** 2)) if len(seg) else 0.0)
        v = 20 * np.log10(np.array(vals) + 1e-9)
        data[name] = v - np.percentile(v, 95)

    nb = len(data["drums"])
    bars_out = []
    sym = lambda r: " " if r < -30 else "▁" if r < -22 else "▃" if r < -14 else "▅" if r < -8 else "▇" if r < -3 else "█"
    print(f"{'小节':>4} {'时间':>8}  鼓 贝 合 人")
    for k in range(nb):
        t = d0 + k * bar
        row = [data[n][k] for n in ["drums", "bass", "other", "vocals"]]
        line = "  ".join(sym(r) for r in row)
        mark = ""
        if k > 0:
            dv = row[3] - data["vocals"][k - 1]
            dd = row[0] - data["drums"][k - 1]
            if abs(dd) > 8 or abs(dv) > 12:
                mark = "  ◀ 变化"
        print(f"{k+1:>4} {int(t//60)}:{t%60:05.2f}  {line}{mark}")
        bars_out.append({"bar": k + 1, "t": round(t, 3),
                         "drums": round(row[0], 1), "bass": round(row[1], 1),
                         "other": round(row[2], 1), "vocals": round(row[3], 1)})
    with open(os.path.join(ROOT, "build", "bars.json"), "w", encoding="utf-8") as fp:
        json.dump(bars_out, fp, ensure_ascii=False, indent=0)
    print("\n-> build/bars.json")


if __name__ == "__main__":
    main()
