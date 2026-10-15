# -*- coding: utf-8 -*-
"""
Demucs 四轨分离：drums / bass / other / vocals → build/stems/

需用项目虚拟环境运行（含 torch + demucs）：
  .venv\\Scripts\\python.exe scripts\\separate.py

只做分离，不生成任何声音。分离结果仅用于分析（人声区间、鼓点、和弦变化）。
"""
import os
import subprocess
import sys
import wave

import numpy as np
import torch
from demucs.apply import apply_model
from demucs.pretrained import get_model

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "audio", "电子天使.mp3")
OUT = os.path.join(ROOT, "build", "stems")
SR = 44100


def load_stereo(path):
    tmp = os.path.join(ROOT, "build", "_tmp_sep.wav")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", path,
                    "-ac", "2", "-ar", str(SR), "-acodec", "pcm_s16le", tmp], check=True)
    with wave.open(tmp, "rb") as w:
        x = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(np.float32) / 32768.0
    os.remove(tmp)
    return x.reshape(-1, 2).T.copy()          # (2, N)


def save(path, y):
    y = np.clip(y.T, -1, 1)
    pcm = (y * 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def main():
    os.makedirs(OUT, exist_ok=True)
    print("加载模型 htdemucs ...")
    model = get_model("htdemucs")
    model.eval()
    print(f"  音轨: {model.sources}   采样率 {model.samplerate}")

    print("读取音频 ...")
    wav = load_stereo(SRC)
    ref = wav.mean(0)
    mean, std = ref.mean(), ref.std()
    x = torch.from_numpy((wav - mean) / (std + 1e-8))[None]

    print(f"分离中（CPU，{wav.shape[1]/SR:.1f}s 音频）...")
    torch.set_num_threads(max(1, os.cpu_count() - 1))
    with torch.no_grad():
        out = apply_model(model, x, shifts=1, split=True, overlap=0.25, progress=True)[0]
    out = out.numpy() * std + mean

    for name, y in zip(model.sources, out):
        p = os.path.join(OUT, f"{name}.wav")
        save(p, y)
        print(f"  -> {os.path.relpath(p, ROOT)}")


if __name__ == "__main__":
    main()
