# -*- coding: utf-8 -*-
"""
逐帧音频特征（60fps），供渲染时按帧查表。

只负责"每一帧有多响、哪个频段在响"，不做节拍检测 ——
节拍网格一律以 build/grid.json（scripts/beat_grid.py 产出）为准。

产出 build/beats.json：
  fps, duration, grid（拷自 grid.json）
  frames: [ { t, rms, low, mid, high, onset } ]   各值 0..1（全曲 2–98 分位归一化）

用法:
  python scripts/analyze_audio.py
"""
import json
import os
import subprocess
import wave

import numpy as np
from scipy import signal

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUDIO = os.path.join(ROOT, "assets", "audio", "电子天使.mp3")
OUT_DIR = os.path.join(ROOT, "build")
OUT_JSON = os.path.join(OUT_DIR, "beats.json")
GRID_JSON = os.path.join(OUT_DIR, "grid.json")

FPS = 60
SR = 22050
NPERSEG, HOP = 2048, 512


def decode():
    tmp = os.path.join(OUT_DIR, "_tmp_audio.wav")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", AUDIO,
                    "-ac", "1", "-ar", str(SR), "-acodec", "pcm_s16le", tmp], check=True)
    with wave.open(tmp, "rb") as w:
        x = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(np.float64) / 32768.0
    os.remove(tmp)
    return x


def smooth(v, k=3):
    return np.convolve(v, np.ones(k) / k, mode="same")


def normalize(v):
    lo, hi = np.percentile(v, 2), np.percentile(v, 98)
    return np.zeros_like(v) if hi - lo < 1e-12 else np.clip((v - lo) / (hi - lo), 0, 1)


def main():
    if not os.path.exists(GRID_JSON):
        raise SystemExit("缺少 build/grid.json，先运行 scripts/beat_grid.py")
    grid = json.load(open(GRID_JSON, encoding="utf-8"))

    x = decode()
    dur = len(x) / SR
    f, t, Z = signal.stft(x, fs=SR, nperseg=NPERSEG, noverlap=NPERSEG - HOP,
                          window="hann", padded=False, boundary=None)
    mag = np.abs(Z)
    band = lambda lo, hi: mag[(f >= lo) & (f < hi)].mean(axis=0)
    low, mid, high = band(20, 160), band(160, 2000), band(2000, 8000)
    onset = np.concatenate([[0.0], np.maximum(0, np.diff(mag, axis=1)).sum(axis=0)])

    n = (len(x) - NPERSEG) // HOP
    rms = np.array([np.sqrt(np.mean(x[i * HOP: i * HOP + NPERSEG] ** 2)) for i in range(n)])
    rms_t = np.arange(n) * HOP / SR + NPERSEG / 2 / SR

    tt = np.arange(int(np.ceil(dur * FPS))) / FPS
    rs = lambda tx, v: np.interp(tt, tx, v)
    cols = {
        "rms": rs(rms_t, normalize(smooth(rms))),
        "low": rs(t, normalize(smooth(low))),
        "mid": rs(t, normalize(smooth(mid))),
        "high": rs(t, normalize(smooth(high))),
        "onset": rs(t, normalize(onset)),
    }
    frames = [{"t": round(float(tt[i]), 4), **{k: round(float(v[i]), 4) for k, v in cols.items()}}
              for i in range(len(tt))]
    data = {"fps": FPS, "duration": round(float(dur), 4), "grid": grid, "frames": frames}
    with open(OUT_JSON, "w", encoding="utf-8") as fp:
        json.dump(data, fp, ensure_ascii=False)
    print(f"-> {os.path.relpath(OUT_JSON, ROOT)}  {len(frames)} 帧  "
          f"({os.path.getsize(OUT_JSON)/1024/1024:.2f} MB)   网格 {grid['bpm']} BPM")


if __name__ == "__main__":
    main()
