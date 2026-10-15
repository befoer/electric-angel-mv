# -*- coding: utf-8 -*-
"""
人声区间检测（基于 Demucs 分离出的 vocals 轨）。

输出:
  1. 每个乐句的起止时间
  2. 按长间隙(>3s)合并成段落，对齐到小节网格
  3. 与用户给定的音色分段对照:
       萝莉音 0:00-0:53   御姐音 1:05-1:45   少女音 2:24-2:49
  4. 前 20 秒的乐句明细

（音色本身不做自动识别 —— 以用户给定的分段为准。）

导出 build/structure.json
"""
import json
import os
import wave

import numpy as np
from scipy import signal

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VOC = os.path.join(ROOT, "build", "stems", "vocals.wav")
GRID = os.path.join(ROOT, "build", "grid.json")
HOP_S = 0.010
WIN_S = 0.040

USER_SECTIONS = [
    ("萝莉音", 0.0, 53.0),
    ("御姐音", 65.0, 105.0),
    ("少女音", 144.0, 169.0),
]


def mmss(s):
    return f"{int(s // 60)}:{s % 60:05.2f}"


def load_mono(path):
    with wave.open(path, "rb") as w:
        sr = w.getframerate()
        ch = w.getnchannels()
        x = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(np.float64) / 32768.0
    if ch == 2:
        x = x.reshape(-1, 2).mean(axis=1)
    return x, sr


def main():
    x, sr = load_mono(VOC)
    # 人声频段 100-8000Hz
    b, a = signal.butter(4, [100 / (sr / 2), 8000 / (sr / 2)], btype="band")
    xf = signal.filtfilt(b, a, x)

    hop, win = int(HOP_S * sr), int(WIN_S * sr)
    n = (len(xf) - win) // hop
    rms = np.array([np.sqrt(np.mean(xf[i * hop: i * hop + win] ** 2)) for i in range(n)])
    db = 20 * np.log10(rms + 1e-9)
    t = np.arange(n) * hop / sr + WIN_S / 2

    ref = np.percentile(db, 97)
    on_th, off_th = ref - 24, ref - 30          # 迟滞阈值
    print(f"人声轨电平参考 {ref:.1f} dB   开 {on_th:.1f} / 关 {off_th:.1f} dB")

    # ---- 迟滞门限 → 乐句 ----
    active = np.zeros(n, bool)
    state = False
    for i in range(n):
        if not state and db[i] > on_th:
            state = True
        elif state and db[i] < off_th:
            state = False
        active[i] = state

    phrases = []
    i = 0
    while i < n:
        if active[i]:
            j = i
            while j < n and active[j]:
                j += 1
            phrases.append([t[i], t[j - 1]])
            i = j
        else:
            i += 1
    # 合并 <0.30s 的短间隙，丢弃 <0.15s 的碎片
    merged = []
    for p in phrases:
        if merged and p[0] - merged[-1][1] < 0.30:
            merged[-1][1] = p[1]
        else:
            merged.append(p)
    phrases = [p for p in merged if p[1] - p[0] >= 0.15]

    # ---- 段落：间隙 > 3s 视为器乐段 ----
    sections = []
    for p in phrases:
        if sections and p[0] - sections[-1][1] <= 3.0:
            sections[-1][1] = p[1]
            sections[-1][2] += 1
        else:
            sections.append([p[0], p[1], 1])

    grid = json.load(open(GRID, encoding="utf-8")) if os.path.exists(GRID) else None

    def bar_pos(s):
        if not grid:
            return ""
        bar = (s - grid["first_downbeat"]) / grid["bar"]
        k = int(np.floor(bar))
        beat = (bar - k) * 4
        return f"小节{k + 1:>3}.{beat + 1:4.2f}"

    print(f"\n=== 人声段落（间隙>3s 分段） 共 {len(sections)} 段 ===")
    for s in sections:
        print(f"  {mmss(s[0])} - {mmss(s[1])}   ({s[1]-s[0]:5.1f}s, {s[2]:>3} 句)   "
              f"起 {bar_pos(s[0])}   止 {bar_pos(s[1])}")

    print("\n=== 器乐段（无人声 >3s） ===")
    gaps = []
    prev = 0.0
    for s in sections:
        if s[0] - prev > 3.0:
            gaps.append((prev, s[0]))
        prev = s[1]
    dur = len(x) / sr
    if dur - prev > 3.0:
        gaps.append((prev, dur))
    for g in gaps:
        print(f"  {mmss(g[0])} - {mmss(g[1])}   ({g[1]-g[0]:5.1f}s)")

    print("\n=== 与给定音色分段对照 ===")
    for name, us, ue in USER_SECTIONS:
        inside = [p for p in phrases if p[1] > us - 2 and p[0] < ue + 2]
        if not inside:
            print(f"  {name}: {mmss(us)}-{mmss(ue)}   区间内无人声")
            continue
        vs, ve = inside[0][0], inside[-1][1]
        print(f"  {name}: 给定 {mmss(us)} - {mmss(ue)}   实测人声 {mmss(vs)} - {mmss(ve)}   "
              f"偏差 起 {vs-us:+6.2f}s  止 {ve-ue:+6.2f}s")

    print("\n=== 前 20 秒乐句 ===")
    for p in phrases:
        if p[0] > 20:
            break
        print(f"  {p[0]:7.3f} - {p[1]:7.3f}s   ({p[1]-p[0]:.2f}s)   起 {bar_pos(p[0])}")

    out = {
        "phrases": [[round(a, 3), round(b, 3)] for a, b in phrases],
        "vocal_sections": [[round(s[0], 3), round(s[1], 3)] for s in sections],
        "instrumental": [[round(a, 3), round(b, 3)] for a, b in gaps],
        "user_voice_sections": [{"name": n_, "start": s_, "end": e_} for n_, s_, e_ in USER_SECTIONS],
    }
    dst = os.path.join(ROOT, "build", "structure.json")
    with open(dst, "w", encoding="utf-8") as fp:
        json.dump(out, fp, ensure_ascii=False, indent=2)
    print(f"\n-> {os.path.relpath(dst, ROOT)}")


if __name__ == "__main__":
    main()
