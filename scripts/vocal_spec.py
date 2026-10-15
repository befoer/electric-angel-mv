# -*- coding: utf-8 -*-
"""
人声频谱（60fps × 32 频段），给"声音"相关的镜头画真实频谱（视觉方案 §5.2a L03）。

输入 build/stems/vocals.wav（Demucs 分离的人声轨）
产出 build/vocal_spec.json：
  fps, bands, fmin, fmax, n（帧数）, edges（各频段边界 Hz）
  data：base64，n × bands 个字节，按帧排列；每个值 0..255（各频段按自身 5–99 分位归一化）

用法:
  python scripts/vocal_spec.py
"""
import base64
import json
import os

import numpy as np
import soundfile as sf
from scipy import signal

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "build", "stems", "vocals.wav")
OUT = os.path.join(ROOT, "build", "vocal_spec.json")

FPS, BANDS, FMIN, FMAX, NFFT = 60, 32, 100.0, 8000.0, 2048


def main():
    x, sr = sf.read(SRC, dtype="float32", always_2d=True)
    x = x.mean(axis=1)
    hop = sr / FPS
    n = int(len(x) / hop)
    win = signal.get_window("hann", NFFT)
    pad = np.concatenate([np.zeros(NFFT // 2, np.float32), x, np.zeros(NFFT, np.float32)])
    freqs = np.fft.rfftfreq(NFFT, 1.0 / sr)
    edges = np.geomspace(FMIN, FMAX, BANDS + 1)
    idx = [np.where((freqs >= edges[b]) & (freqs < edges[b + 1]))[0] for b in range(BANDS)]
    for b in range(BANDS):  # 低频段太窄时至少取一个频点
        if len(idx[b]) == 0:
            idx[b] = np.array([np.argmin(np.abs(freqs - (edges[b] + edges[b + 1]) / 2))])

    spec = np.zeros((n, BANDS), np.float32)
    for i in range(n):
        s = int(round(i * hop))
        p = np.abs(np.fft.rfft(pad[s:s + NFFT] * win)) ** 2
        spec[i] = [p[j].mean() for j in idx]
    db = 10 * np.log10(spec + 1e-12)

    lo = np.percentile(db, 5, axis=0)
    hi = np.percentile(db, 99, axis=0)
    v = np.clip((db - lo) / np.maximum(hi - lo, 1e-6), 0, 1)
    q = np.round(v * 255).astype(np.uint8)

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump({
            "fps": FPS, "bands": BANDS, "fmin": FMIN, "fmax": FMAX, "n": n,
            "edges": [round(float(e), 1) for e in edges],
            "data": base64.b64encode(q.tobytes()).decode("ascii"),
        }, f)
    print(f"build/vocal_spec.json：{n} 帧 × {BANDS} 频段，{os.path.getsize(OUT) / 1024:.0f} KB")


if __name__ == "__main__":
    main()
