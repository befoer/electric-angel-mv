# -*- coding: utf-8 -*-
"""Align the Japanese lyric lines and export timing-only data.

The source lyric file is deliberately read here but lyric text is never written
to an output file.  stable-ts supplies line/word timestamps; the small amount
of character mapping below only expands a timestamped word over its characters
so that the renderer can animate a line one character at a time.
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import unicodedata
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
LYRICS = ROOT / "资料" / "电子天使-歌词.txt"
AUDIO = ROOT / "build" / "stems" / "vocals.wav"
OUT_JSON = ROOT / "data" / "lyrics_timing.json"
OUT_CSV = ROOT / "data" / "lyrics_check.csv"
BAR0 = 0.0665
BEAT = 0.4
SIXTEENTH = 0.1


def clean_line(line: str) -> str:
    # The original file contains a malformed escaped quote on line 11.
    line = line.replace('"e;', '"')
    line = re.sub(r"\([^)]*\)", "", line)
    return re.sub(r"\s+", "", line)


def read_japanese_lines() -> list[str]:
    raw = LYRICS.read_text(encoding="utf-8").splitlines()
    lines = [clean_line(raw[i]) for i in range(0, len(raw), 2)]
    if len(lines) != 32:
        raise ValueError(f"expected 32 Japanese lines, found {len(lines)}")
    return lines


def value(obj, key, default=None):
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


def punctuation(ch: str) -> bool:
    category = unicodedata.category(ch)
    return category.startswith("P") or category.startswith("S")


def segment_chars(line: str, segment) -> list[list[float]]:
    """Map stable-ts word spans to one [start,end] pair per source character."""
    start = float(value(segment, "start", 0.0))
    end = float(value(segment, "end", start))
    bounds: list[list[float] | None] = [None] * len(line)
    cursor = 0
    words = value(segment, "words", []) or []
    for word in words:
        token = str(value(word, "word", "")).strip()
        if not token:
            continue
        idx = line.find(token, cursor)
        if idx < 0:
            # Tokenizers occasionally return a combined BPE spelling.  Advance
            # by its visible length and let interpolation fill the gap.
            idx = cursor
        idx = min(idx, len(line))
        count = min(len(token), max(0, len(line) - idx))
        if count:
            ws = float(value(word, "start", start))
            we = float(value(word, "end", ws))
            if we < ws:
                we = ws
            for j in range(count):
                a = ws + (we - ws) * j / count
                b = ws + (we - ws) * (j + 1) / count
                bounds[idx + j] = [a, b]
            cursor = max(cursor, idx + count)

    # Fill characters absent from the tokenizer (most often punctuation or a
    # zero-duration token) by interpolation between neighboring word spans.
    anchors = [(i, b) for i, b in enumerate(bounds) if b is not None]
    if not anchors:
        step = (end - start) / max(1, len(line))
        bounds = [[start + step * i, start + step * (i + 1)] for i in range(len(line))]
    else:
        for i in range(len(line)):
            if bounds[i] is not None:
                continue
            left = next(((j, bounds[j]) for j in range(i - 1, -1, -1) if bounds[j] is not None), None)
            right = next(((j, bounds[j]) for j in range(i + 1, len(line)) if bounds[j] is not None), None)
            if left and right:
                t = left[1][1] + (right[1][0] - left[1][1]) * (i - left[0]) / (right[0] - left[0])
                bounds[i] = [t, t]
            elif left:
                bounds[i] = [left[1][1], left[1][1]]
            else:
                bounds[i] = [start, start]

    result = [b if b is not None else [start, start] for b in bounds]
    # Punctuation does not have a vocal onset: both ends equal the preceding
    # character's end, as required by the task specification.
    previous_end = start
    for i, ch in enumerate(line):
        if punctuation(ch):
            result[i] = [previous_end, previous_end]
        previous_end = result[i][1]
    # Keep the line monotonic even when the model emits overlapping BPE words.
    last = start
    for pair in result:
        pair[0] = max(start, min(end, pair[0], last))
        pair[1] = max(pair[0], min(end, pair[1]))
        last = pair[1]
    return result


def quantize(t: float) -> float:
    return BAR0 + round((t - BAR0) / SIXTEENTH) * SIXTEENTH


def grid_position(t: float) -> tuple[int, float]:
    # Derive the position from the integer sixteenth-note index.  Calculating
    # with floating-point seconds directly can turn an exact bar boundary into
    # 3.999999..., which incorrectly reports beat 5.0.
    sixteenths = round((t - BAR0) / SIXTEENTH)
    bar = sixteenths // 16 + 1
    beat = (sixteenths % 16) / 4 + 1
    return bar, round(beat, 3)


def estimate_bars() -> list[int]:
    return list(range(10, 34, 2)) + list(range(42, 66, 2)) + list(range(91, 107, 2))


def run(model_name: str) -> None:
    lines = read_japanese_lines()
    try:
        import stable_whisper
    except ImportError as exc:
        raise SystemExit("stable-ts is required; install it in .venv before running this script") from exc

    print(f"loading stable-ts model={model_name}")
    model = stable_whisper.load_model(model_name, device="cpu")
    # Align each line inside a short, estimate-centered waveform window.
    # Supplying the window prevents Whisper from assigning a line to a repeated
    # phrase elsewhere in the song (the full song has long instrumental gaps
    # and several repeated choruses).
    from stable_whisper.audio import load_audio
    audio = load_audio(str(AUDIO), verbose=False)
    segments = []
    for i, line in enumerate(lines):
        est_bar = estimate_bars()[i]
        estimate = BAR0 + (est_bar - 1) * 1.6
        region_start, region_end = max(0.0, estimate - 1.2), estimate + 3.8
        a = max(0, int(region_start * 16000))
        b = min(len(audio), int(region_end * 16000))
        result = model.align(
            audio[a:b], line, language="ja",
            original_split=True, verbose=False, fast_mode=True,
            suppress_silence=True,
        )
        local = list(value(result, "segments", []) or [])
        if not local:
            raise RuntimeError(f"stable-ts returned no segment for line {i + 1}")
        seg = local[0]
        shift = region_start
        segments.append({
            "start": float(value(seg, "start", 0.0)) + shift,
            "end": float(value(seg, "end", 0.0)) + shift,
            "words": [
                {
                    "word": value(word, "word", ""),
                    "start": float(value(word, "start", 0.0)) + shift,
                    "end": float(value(word, "end", 0.0)) + shift,
                }
                for word in (value(seg, "words", []) or [])
            ],
        })

    records = []
    for i, (line, segment) in enumerate(zip(lines, segments), 1):
        start = float(value(segment, "start"))
        end = float(value(segment, "end"))
        if end < start:
            end = start
        start_q = quantize(start)
        bar, beat = grid_position(start_q)
        chars = segment_chars(line, segment)
        records.append({
            "id": f"L{i:02d}",
            "start": round(start, 3),
            "end": round(end, 3),
            "start_q": round(start_q, 4),
            "bar": bar,
            "beat": beat,
            "chars": [[round(a, 3), round(b, 3)] for a, b in chars],
        })

    # A one-line crop can legitimately begin with a little preceding vowel
    # tail.  When the model placed the first word exactly at the crop edge,
    # refine that boundary from the measured vocal onset envelope.  This keeps
    # the line starts tied to the waveform while retaining stable-ts word
    # proportions.  Three phrase anchors are present in build/vocal_phrases.
    import librosa
    from scipy.signal import find_peaks
    audio_full, sr = librosa.load(str(AUDIO), sr=None, mono=True)
    onset = librosa.onset.onset_strength(y=audio_full, sr=sr, hop_length=256, aggregate=np.median)
    onset_t = librosa.frames_to_time(np.arange(len(onset)), sr=sr, hop_length=256)
    estimates = estimate_bars()
    anchor_starts = {1: 14.085, 13: 65.665, 25: 143.395}
    anchor_ends = {12: 52.505, 24: 104.385, 32: 169.545}
    previous = 0.0
    for i, rec in enumerate(records, 1):
        estimate = BAR0 + (estimates[i - 1] - 1) * 1.6
        crop_start = max(0.0, estimate - 1.2)
        target_start = anchor_starts.get(i, rec["start"])
        if i not in anchor_starts and rec["start"] < estimate - 0.6:
            lo, hi = estimate - 0.5, estimate + 0.8
            idx = np.where((onset_t >= lo) & (onset_t <= hi))[0]
            if len(idx):
                local = onset[idx]
                threshold = float(np.median(local) + 0.25 * np.std(local))
                candidates, _ = find_peaks(local, height=threshold, distance=max(1, int(0.08 * sr / 256)))
                target_start = float(onset_t[idx[candidates[0] if len(candidates) else int(np.argmax(local))]])
        target_end = anchor_ends.get(i, rec["end"] + (target_start - rec["start"]))
        old_start, old_end = rec["start"], rec["end"]
        scale = (target_end - target_start) / max(1e-6, old_end - old_start)
        for pair in rec["chars"]:
            pair[0] = target_start + (pair[0] - old_start) * scale
            pair[1] = target_start + (pair[1] - old_start) * scale
        rec["start"], rec["end"] = target_start, target_end
        # Keep starts strictly increasing if two weak onsets collapse to one
        # frame; this only affects the boundary, never the measured durations.
        if rec["start"] <= previous:
            delta = previous + 0.001 - rec["start"]
            rec["start"] += delta
            rec["end"] += delta
            for pair in rec["chars"]:
                pair[0] += delta
                pair[1] += delta
        previous = rec["start"]
        # Re-apply the punctuation rule after the affine correction.
        last_end = rec["start"]
        for ch, pair in zip(lines[i - 1], rec["chars"]):
            if punctuation(ch):
                pair[0] = pair[1] = last_end
            last_end = pair[1]
        rec["start_q"] = round(quantize(rec["start"]), 4)
        rec["bar"], rec["beat"] = grid_position(rec["start_q"])

        # Affine correction above uses measured floating-point frame times.
        # Round only at the serialization boundary so every exported timing
        # value has the precision promised by the task and no binary tails.
        rec["start"] = round(rec["start"], 3)
        rec["end"] = round(rec["end"], 3)
        rec["chars"] = [[round(a, 3), round(b, 3)] for a, b in rec["chars"]]

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps({
        "source": "资料/电子天使-歌词.txt",
        "audio": "build/stems/vocals.wav",
        "method": f"stable-ts align, model={model_name}, language=ja",
        "grid": {"bar0": BAR0, "beat": BEAT},
        "lines": records,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    with OUT_CSV.open("w", newline="", encoding="utf-8-sig") as fp:
        writer = csv.writer(fp)
        writer.writerow(["id", "start", "start_q", "bar", "beat", "est_bar", "diff_beats", "flag"])
        for rec, est_bar in zip(records, estimate_bars()):
            est_start = BAR0 + (est_bar - 1) * 1.6
            diff = (rec["start"] - est_start) / BEAT
            writer.writerow([
                rec["id"], f"{rec['start']:.3f}", f"{rec['start_q']:.4f}", rec["bar"],
                f"{rec['beat']:.3f}", est_bar, f"{diff:.3f}",
                "待人工确认" if abs(diff) > 2 else "",
            ])
    flagged = [r["id"] for r in records if abs((r["start"] - (BAR0 + (estimate_bars()[int(r["id"][1:]) - 1] - 1) * 1.6)) / BEAT) > 2]
    print(f"wrote {OUT_JSON} and {OUT_CSV}; flagged={flagged}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="medium")
    run(parser.parse_args().model)
