# -*- coding: utf-8 -*-
"""
全曲节拍网格（基于 Demucs 分离轨）。

为什么要用分离轨：
  这首歌每个八分音符位置都有打击，混音里"正拍"和"反拍八分"的强度接近，
  按四分音符折叠会在两者之间来回跳（表现为 ±200ms 的伪漂移）。
  分离后：
    - 底鼓（鼓轨 30-130Hz）只在正拍 → 决定"拍"在哪
    - 贝斯根音 + 和弦变化（other 轨）集中在小节开头 → 决定"小节第一拍"在哪

速度：全曲长滞后自相关（128 拍滞后处的峰 / 128）
  注意：不要用"粗时间分辨率 + 相位折叠"来扫 BPM —— 当周期恰好是分析帧长的
  有理数倍（如 149.796 BPM 时八分音符 = 17.25 帧 = 69/4）时，相位直方图只有
  少数格子有数据，得分会虚高。这个坑踩过一次。

相位：高分辨率（1.45ms）折叠，忽略空格子。

输出 build/grid.json
"""
import json
import os
import wave

import numpy as np
from scipy import signal

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STEMS = os.path.join(ROOT, "build", "stems")
SR = 22050
FINE_HOP = 32           # 1.45ms
COARSE_HOP = 256        # 11.6ms（只用于和弦变化）


def load_mono(path):
    with wave.open(path, "rb") as w:
        sr = w.getframerate()
        ch = w.getnchannels()
        x = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(np.float64) / 32768.0
    if ch == 2:
        x = x.reshape(-1, 2).mean(axis=1)
    if sr == 44100:
        x = signal.resample_poly(x, 1, 2)
    return x


def onset(x, lo, hi, hop=FINE_HOP, n=1024):
    f, t, Z = signal.stft(x, fs=SR, nperseg=n, noverlap=n - hop,
                          window="hann", padded=False, boundary=None)
    t = t - (n / 4) / SR                      # 窗中心 → 起音前沿
    m = (f >= lo) & (f < hi)
    lm = np.log1p(np.abs(Z[m]) * 60)
    v = np.concatenate([[0.0], np.maximum(0, np.diff(lm, axis=1)).sum(0)])
    v = np.maximum(v - signal.medfilt(v, 63), 0)
    return t, v / (np.percentile(v, 99.5) + 1e-9)


def fold(t, env, period, nbins=400):
    """相位折叠；空格子不参与统计"""
    ph = np.mod(t, period)
    idx = np.minimum((ph / period * nbins).astype(int), nbins - 1)
    cnt = np.bincount(idx, minlength=nbins)
    h = np.bincount(idx, weights=env, minlength=nbins)
    ok = cnt > 0
    h[ok] /= cnt[ok]
    h[~ok] = np.nan
    hs = np.nan_to_num((np.roll(h, 1) + 2 * h + np.roll(h, -1)) / 4, nan=0.0)
    k = int(np.nanargmax(hs))
    v = hs[ok]
    return (hs[k] - v.mean()) / (v.std() + 1e-9), (k + 0.5) / nbins * period


def peak_near(ac, lag, dt, tol):
    a = max(int((lag - tol) / dt), 1)
    b = min(int((lag + tol) / dt) + 1, len(ac) - 2)
    k = a + int(np.argmax(ac[a:b]))
    y0, y1, y2 = ac[k - 1], ac[k], ac[k + 1]
    return (k + 0.5 * (y0 - y2) / (y0 - 2 * y1 + y2 + 1e-12)) * dt


def chroma_novelty(x):
    f, t, Z = signal.stft(x, fs=SR, nperseg=4096, noverlap=4096 - COARSE_HOP,
                          window="hann", padded=False, boundary=None)
    mag = np.abs(Z)
    m = (f >= 80) & (f < 2000)
    pc = np.round(12 * np.log2(f[m] / 440.0)).astype(int) % 12
    C = np.stack([mag[m][pc == p].sum(0) for p in range(12)])
    C /= np.linalg.norm(C, axis=0, keepdims=True) + 1e-9
    w = int(0.4 / (t[1] - t[0]))
    cs = np.cumsum(np.pad(C, ((0, 0), (1, 0))), axis=1)
    nov = np.zeros(C.shape[1])
    for i in range(w, C.shape[1] - w):
        a = (cs[:, i] - cs[:, i - w]) / w
        b = (cs[:, i + w] - cs[:, i]) / w
        nov[i] = 1 - a @ b / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-9)
    nov = np.maximum(nov - signal.medfilt(nov, 61), 0)
    return t, nov / (np.percentile(nov, 99.5) + 1e-9)


def main():
    for k in ["drums", "bass", "other"]:
        if not os.path.exists(os.path.join(STEMS, f"{k}.wav")):
            raise SystemExit(f"缺少 build/stems/{k}.wav，先运行 scripts/separate.py")
    xd = load_mono(os.path.join(STEMS, "drums.wav"))
    xb = load_mono(os.path.join(STEMS, "bass.wav"))
    xo = load_mono(os.path.join(STEMS, "other.wav"))
    dur = len(xd) / SR

    td, drum_all = onset(xd, 30, 11000)
    _, kick = onset(xd, 30, 130)
    _, snare = onset(xd, 150, 450)
    _, hat = onset(xd, 6000, 11000)
    tb, bass_on = onset(xb, 30, 300)
    to, other_on = onset(xo, 150, 6000)
    tn, nov = chroma_novelty(xo)
    dt = td[1] - td[0]

    # ---------- 1. 速度 ----------
    print("[1] 速度（鼓轨全曲长滞后自相关）")
    m = td > 7.0
    e = drum_all[m] - drum_all[m].mean()
    F = np.fft.rfft(e, 2 * len(e))
    ac = np.fft.irfft(F * np.conj(F))[:len(e)]
    ac /= ac[0]
    lag = peak_near(ac, 128 * 0.4, dt, 0.25)
    beat = lag / 128
    bpm = 60.0 / beat
    bar = beat * 4
    print(f"  {bpm:.4f} BPM   拍 {beat*1000:.3f}ms   小节 {bar:.4f}s")

    # ---------- 2. 漂移（每 8 小节的局部相位，八分音符周期） ----------
    print("\n[2] 漂移检查（每 8 小节，八分音符相位）")
    _, ph8 = fold(td, drum_all, beat / 2)
    devs = []
    for s0 in np.arange(0, dur - bar * 4, bar * 8):
        mm = (td >= s0) & (td < s0 + bar * 8)
        if drum_all[mm].sum() < 2:
            continue
        sc, p = fold(td[mm], drum_all[mm], beat / 2)
        d = (p - ph8 + beat / 4) % (beat / 2) - beat / 4
        devs.append(d)
        print(f"  {s0:6.1f}-{s0+bar*8:6.1f}s  {d*1000:+6.1f}ms   清晰度 {sc:.1f}")
    devs = np.array(devs)
    print(f"  偏差标准差 {devs.std()*1000:.1f}ms   范围 {devs.min()*1000:+.1f}~{devs.max()*1000:+.1f}ms")

    # ---------- 3. 正拍（底鼓相位） ----------
    print("\n[3] 正拍位置")
    sk, phk = fold(td, kick, beat)
    ss, phs = fold(td, snare, beat)
    sh, phh = fold(td, hat, beat)
    print(f"  底鼓 {phk*1000:6.1f}ms (清晰度 {sk:.1f})   军鼓 {phs*1000:6.1f}ms ({ss:.1f})   "
          f"镲片 {phh*1000:6.1f}ms ({sh:.1f})")
    print(f"  镲片相对底鼓 {((phh-phk)%beat)/beat:.2f} 拍   军鼓相对底鼓 {((phs-phk)%beat)/beat:.2f} 拍")
    beat0 = phk % beat

    # ---------- 4. 小节第一拍 ----------
    print("\n[4] 小节第一拍（4 个候选拍位）")
    beats = beat0 + np.arange(int((dur - beat0) / beat)) * beat

    def sample(tt, env, times, w):
        out = np.zeros(len(times))
        for i, x in enumerate(times):
            mm = (tt >= x - w) & (tt <= x + w)
            out[i] = env[mm].max() if mm.any() else 0
        return out

    B = sample(tb, bass_on, beats, 0.03)
    N = sample(tn, nov, beats, 0.08)
    K = sample(td, kick, beats, 0.03)
    S = sample(td, snare, beats, 0.03)
    O = sample(to, other_on, beats, 0.03)
    print(f"  {'拍位':>4} {'贝斯':>7} {'和弦变化':>8} {'合成器':>7} {'底鼓':>7} {'军鼓':>7}")
    ev = []
    for p in range(4):
        print(f"  {p:>4} {B[p::4].mean():>7.3f} {N[p::4].mean():>8.3f} {O[p::4].mean():>7.3f} "
              f"{K[p::4].mean():>7.3f} {S[p::4].mean():>7.3f}")
        ev.append(B[p::4].mean() / B.mean() + N[p::4].mean() / N.mean())
    down = int(np.argmax(ev))
    print(f"  证据（贝斯+和弦变化）{[round(v, 2) for v in ev]}  → 拍位 {down}")
    first_down = (beat0 + down * beat) % bar
    print(f"  第一个正拍 {beat0:.4f}s   小节起点相位 {first_down:.4f}s")

    # ---------- 5. 节奏型 ----------
    print("\n[5] 节奏型（每小节 16 格）")
    six = bar / 16
    g = lambda v: "█" if v > 0.55 else "▓" if v > 0.33 else "▒" if v > 0.16 else "·"
    for k in range(18):
        bs = first_down + k * bar
        pos = bs + np.arange(16) * six
        a = "".join(g(v) for v in sample(td, drum_all, pos, 0.02))
        c = "".join(g(v) for v in sample(td, kick, pos, 0.02))
        b = "".join(g(v) for v in sample(to, other_on, pos, 0.02))
        print(f"  小节{k+1:>3} {bs:7.3f}s  鼓|{a[:4]}|{a[4:8]}|{a[8:12]}|{a[12:]}|  "
              f"底鼓|{c[:4]}|{c[4:8]}|{c[8:12]}|{c[12:]}|  合成器|{b[:4]}|{b[4:8]}|{b[8:12]}|{b[12:]}|")
    print("                      1   2   3   4")

    out = {
        "bpm": round(float(bpm), 4),
        "beat": round(float(beat), 6),
        "bar": round(float(bar), 6),
        "first_beat": round(float(beat0), 4),
        "first_downbeat": round(float(first_down), 4),
        "drift_ms_std": round(float(devs.std() * 1000), 2),
        "method": "demucs stems; tempo=drums long-lag autocorr; beat=kick fold; downbeat=bass+chroma novelty",
    }
    with open(os.path.join(ROOT, "build", "grid.json"), "w", encoding="utf-8") as fp:
        json.dump(out, fp, ensure_ascii=False, indent=2)
    print(f"\n-> build/grid.json  {out}")


if __name__ == "__main__":
    main()
