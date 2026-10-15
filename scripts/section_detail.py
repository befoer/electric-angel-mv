# -*- coding: utf-8 -*-
"""
细查指定小节的内部结构：每小节列出 鼓/贝斯/合成器/人声，
以及每小节的"变化量"（与前一小节相比的能量差），
用于把长器乐段切成「每 5 秒左右一个内容块」。

用法: python scripts/section_detail.py 74 89
"""
import json
import os
import sys
import wave

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STEMS = os.path.join(ROOT, "build", "stems")


def load(name):
    with wave.open(os.path.join(STEMS, f"{name}.wav"), "rb") as w:
        sr = w.getframerate()
        x = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(np.float64) / 32768.0
    return x.reshape(-1, 2).mean(axis=1), sr


def main():
    a = int(sys.argv[1]) if len(sys.argv) > 1 else 74
    b = int(sys.argv[2]) if len(sys.argv) > 2 else 89
    g = json.load(open(os.path.join(ROOT, "build", "grid.json"), encoding="utf-8"))
    bar, d0 = g["bar"], g["first_downbeat"]

    env = {}
    for n in ["drums", "bass", "other", "vocals"]:
        x, sr = load(n)
        v = []
        for k in range(a - 1, b):
            s, e = int((d0 + k * bar) * sr), int((d0 + (k + 1) * bar) * sr)
            seg = x[max(s, 0):min(e, len(x))]
            v.append(20 * np.log10(np.sqrt(np.mean(seg ** 2)) + 1e-9))
        env[n] = np.array(v)

    print(f"小节 {a}–{b}   （每小节 {bar:.3f}s，共 {(b-a+1)*bar:.1f}s）")
    print(f"{'小节':>4} {'时间':>8}  {'鼓':>6} {'贝斯':>6} {'合成器':>7} {'人声':>6}  变化量")
    prev = None
    for i, k in enumerate(range(a, b + 1)):
        t = d0 + (k - 1) * bar
        row = [env[n][i] - np.percentile(env[n], 75) for n in ["drums", "bass", "other", "vocals"]]
        chg = ""
        if prev is not None:
            d = abs(row[0] - prev[0]) + abs(row[2] - prev[2])
            chg = f"{d:5.1f} " + ("█" * min(int(d), 30))
        prev = row
        print(f"{k:>4} {int(t//60)}:{t%60:05.2f}  "
              f"{row[0]:6.1f} {row[1]:6.1f} {row[2]:7.1f} {row[3]:6.1f}  {chg}")

    print(f"\n按 5 秒（≈3.1 小节）切块:")
    n_bars = b - a + 1
    for i, k in enumerate(range(a, b + 1, 3)):
        e = min(k + 2, b)
        t0 = d0 + (k - 1) * bar
        t1 = d0 + e * bar
        print(f"  块{i+1}: 小节 {k}–{e}   {int(t0//60)}:{t0%60:05.2f}–{int(t1//60)}:{t1%60:05.2f}   ({t1-t0:.1f}s)")


if __name__ == "__main__":
    main()
