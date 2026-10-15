# -*- coding: utf-8 -*-
"""
从 build/beats.json 抽取前 N 秒，压成 base64 Float32 数组，
写成浏览器可直接 <script> 引入的 JS（绕开 file:// 下 fetch 被 CORS 拦截）。

节拍网格读自 build/grid.json（scripts/beat_grid.py 产出），不在此硬编码。

布局: 每帧 5 个 float32 —— [rms, low, mid, high, onset]
"""
import base64
import json
import os
import struct

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "build", "beats.json")
GRID = os.path.join(ROOT, "build", "grid.json")
DST = os.path.join(ROOT, "scenes", "00_intro", "beats.js")

LIMIT = 20.0

with open(SRC, encoding="utf-8") as f:
    d = json.load(f)
with open(GRID, encoding="utf-8") as f:
    g = json.load(f)
TEMPO = g["bpm"]               # 150.00（四分音符）
PHASE = g["first_downbeat"]    # 第 1 小节起点
EIGHTH = TEMPO * 2

frames = [fr for fr in d["frames"] if fr["t"] <= LIMIT]
n = len(frames)

buf = bytearray()
for fr in frames:
    buf += struct.pack("<5f", fr["rms"], fr["low"], fr["mid"], fr["high"], fr["onset"])

b64 = base64.b64encode(bytes(buf)).decode("ascii")

js = f"""// 自动生成，勿手改。来源: build/beats.json（前 {LIMIT}s）
// 每帧 5 个 float32: [rms, low, mid, high, onset]
// 节拍参数为实测值，勿改
window.BEATS = {{
  fps: {d['fps']},
  tempo: {TEMPO},
  eighth: {EIGHTH},
  beatPeriod: {60.0/TEMPO:.6f},
  eighthPeriod: {60.0/EIGHTH:.6f},
  phase: {PHASE},
  duration: {d['duration']},
  limit: {LIMIT},
  nFrames: {n},
  data: "{b64}"
}};
"""

with open(DST, "w", encoding="utf-8") as f:
    f.write(js)

print(f"-> {DST}")
print(f"   {n} 帧 x 5 = {len(buf)} 字节 -> {len(js)/1024:.1f} KB")
print(f"   主拍 {TEMPO} BPM (周期 {60.0/TEMPO:.4f}s)  相位 {PHASE}s")
print(f"   八分 {EIGHTH:.2f} BPM (周期 {60.0/EIGHTH:.4f}s)")
