# -*- coding: utf-8 -*-
"""Detect vocal onsets in the 66–73 bar effects/interlude window."""
from __future__ import annotations

import json
from pathlib import Path

import librosa
import numpy as np
from scipy.signal import find_peaks

ROOT = Path(__file__).resolve().parents[1]
AUDIO = ROOT / "build" / "stems" / "vocals.wav"
OUT = ROOT / "data" / "vocal_fx_onsets.json"
RANGE = (104.067, 116.867)


def main() -> None:
    y, sr = librosa.load(str(AUDIO), sr=None, mono=True, offset=RANGE[0], duration=RANGE[1] - RANGE[0])
    hop = 256
    envelope = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop, aggregate=np.median)
    times = librosa.frames_to_time(np.arange(len(envelope)), sr=sr, hop_length=hop) + RANGE[0]
    if len(envelope) == 0:
        peaks = np.array([], dtype=int)
    else:
        threshold = max(float(np.median(envelope) + 0.25 * np.std(envelope)), float(np.percentile(envelope, 55)))
        peaks, _ = find_peaks(envelope, height=threshold, distance=max(1, int(0.08 * sr / hop)), prominence=max(1e-6, float(np.std(envelope) * 0.05)))
        # Preserve the strongest candidates when a quiet vocal stem produces
        # fewer than five peaks; these are still measured from the waveform.
        if len(peaks) < 5:
            order = np.argsort(envelope)[::-1]
            chosen = []
            for p in order:
                if all(abs(times[p] - times[q]) >= 0.08 for q in chosen):
                    chosen.append(int(p))
                if len(chosen) >= 8:
                    break
            peaks = np.array(sorted(chosen), dtype=int)

    values = envelope[peaks] if len(peaks) else np.array([], dtype=float)
    if len(values):
        lo, hi = float(values.min()), float(values.max())
        strength = (values - lo) / (hi - lo) if hi > lo else np.ones(len(values))
    else:
        strength = np.array([], dtype=float)
    onsets = [[round(float(times[p]), 3), round(float(np.clip(s, 0, 1)), 3)] for p, s in zip(peaks, strength) if RANGE[0] <= times[p] <= RANGE[1]]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"range": list(RANGE), "onsets": onsets}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {OUT}: {len(onsets)} onsets")


if __name__ == "__main__":
    main()
