# -*- coding: utf-8 -*-
"""
前 20 秒「节拍元素」触发表。

规则（见 视觉方案.md §4.4）：
  - 从第一个声音（第 1 小节第 4 拍弱起）开始，每一拍都生成元素
  - 拍的角色：第 1 拍=强拍，第 3 拍=次强拍，第 2/4 拍=弱拍
  - 另外列出「切分重音」：不在正拍上、但合成器/鼓局部很强的十六分音符位置
强度用 ±4 小节的局部归一化 —— 前奏合成器比副歌轻很多，全曲统一归一化会测不到。

导出 build/intro_hits.json
"""
import json
import os
import wave

import numpy as np
from scipy import signal

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STEMS = os.path.join(ROOT, "build", "stems")
LIMIT = 20.0
ROLE = {1: "强", 2: "弱", 3: "次强", 4: "弱"}


def load_mono(path):
    with wave.open(path, "rb") as w:
        x = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(np.float64) / 32768.0
    return signal.resample_poly(x.reshape(-1, 2).mean(axis=1), 1, 2), 22050


def onset(x, sr, lo, hi):
    f, t, Z = signal.stft(x, fs=sr, nperseg=1024, noverlap=1024 - 64,
                          window="hann", padded=False, boundary=None)
    t = t - 256 / sr
    m = (f >= lo) & (f < hi)
    lm = np.log1p(np.abs(Z[m]) * 60)
    v = np.concatenate([[0.0], np.maximum(0, np.diff(lm, axis=1)).sum(0)])
    return t, np.maximum(v - signal.medfilt(v, 63), 0)


def main():
    g = json.load(open(os.path.join(ROOT, "build", "grid.json"), encoding="utf-8"))
    beat, bar, d0 = g["beat"], g["bar"], g["first_downbeat"]
    six = beat / 4

    xd, sr = load_mono(os.path.join(STEMS, "drums.wav"))
    xo, _ = load_mono(os.path.join(STEMS, "other.wav"))
    xb, _ = load_mono(os.path.join(STEMS, "bass.wav"))
    td, ed = onset(xd, sr, 30, 11000)
    to, eo = onset(xo, sr, 150, 6000)
    tb, eb = onset(xb, sr, 30, 300)

    def at(t, e, x, w=0.02):
        m = (t >= x - w) & (t <= x + w)
        return float(e[m].max()) if m.any() else 0.0

    # 所有十六分音符位置的原始强度
    pos = d0 + np.arange(int((LIMIT + 2 - d0) / six)) * six
    raw = np.array([at(td, ed, x) + at(to, eo, x) + 0.5 * at(tb, eb, x) for x in pos])
    # ±4 小节局部归一化
    local = np.zeros_like(raw)
    for i in range(len(pos)):
        m = np.abs(pos - pos[i]) <= bar * 4
        ref = np.percentile(raw[m], 95) + 1e-9
        local[i] = min(raw[i] / ref, 1.5)

    first_sound = pos[np.argmax(raw > raw.max() * 0.08)]
    beats, accents = [], []
    for i, x in enumerate(pos):
        if x > LIMIT or x < first_sound - 0.01:
            continue
        k = int(round((x - d0) / six))
        b_i, p = divmod(k, 16)
        if p % 4 == 0:
            n = p // 4 + 1
            beats.append({"t": round(x, 3), "bar": b_i + 1, "beat": n,
                          "role": ROLE[n], "strength": round(float(local[i]), 2)})
        elif local[i] > 0.85:
            accents.append({"t": round(x, 3), "bar": b_i + 1,
                            "pos": f"{p // 4 + 1}+{p % 4}/4", "strength": round(float(local[i]), 2)})

    print(f"网格 {g['bpm']} BPM   第 1 小节起点 {d0:.3f}s   第一个声音 {first_sound:.3f}s\n")
    print("每拍（小节: 第1拍 / 第2拍 / 第3拍 / 第4拍，括号内为局部强度）")
    rows = {}
    for b in beats:
        rows.setdefault(b["bar"], []).append(b)
    for bi in sorted(rows):
        cells = "  ".join(f"{b['t']:6.3f}({b['strength']:.2f})" for b in rows[bi])
        print(f"  小节{bi:>3}  {cells}")
    print("\n切分重音（非正拍、局部强度 > 0.85）")
    for a in accents:
        print(f"  {a['t']:6.3f}s  小节 {a['bar']} 第 {a['pos']} 拍  ({a['strength']:.2f})")

    with open(os.path.join(ROOT, "build", "intro_hits.json"), "w", encoding="utf-8") as fp:
        json.dump({"grid": g, "first_sound": round(float(first_sound), 3),
                   "beats": beats, "accents": accents}, fp, ensure_ascii=False, indent=1)
    print("\n-> build/intro_hits.json")


if __name__ == "__main__":
    main()
