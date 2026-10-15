# 第二十轮：给 build/frames/<编号>/ 的每一帧算出人物的包围盒和鼠标指针的位置，存成 build/frames/<编号>_track.json
# 镜头里的代码叠层（选中框、摸头的小心、「已连接」光环）跟着视频里的她和视频里的指针走。
# 用法（项目根目录）：.venv\Scripts\python.exe -I scripts\video_track.py V11_3
# 做法：白底视频——比底色暗一截的像素算前景，连通域里最大的那块是她；另外找一块"黑边白芯、几十像素大小"的小连通域当指针
#       （指针和黑皮鞋分不开，第二十轮只用包围盒；指针的位置在镜头里按几个关键帧手标）。左右两边的黑竖条（视频自带）先裁掉
import sys, json, os
import numpy as np
from PIL import Image
from collections import deque

sys.stdout.reconfigure(encoding='utf-8')
vid = sys.argv[1]
meta = json.load(open(f'build/frames/{vid}.json', encoding='utf8'))
out = []
SCALE = 4  # 缩小 4 倍再算连通域（快）
for i in range(1, meta['n'] + 1):
    a = np.asarray(Image.open(f'build/frames/{vid}/{i:03d}.jpg').convert('RGB')).astype(np.int16)
    h, w = a.shape[:2]
    dark = a.mean(axis=(0, 2)) < 120; a[:, dark] = 249  # 两边黑条（视频自带，宽度随分辨率变）当底色
    small = a[::SCALE, ::SCALE]
    fg = small.min(axis=2) < 228
    for _ in range(3):  # 膨胀 3 次：白袜子、白围裙把身体隔开的几块连起来，包围盒才包得住脚
        g = fg.copy(); g[1:] |= fg[:-1]; g[:-1] |= fg[1:]; g[:, 1:] |= fg[:, :-1]; g[:, :-1] |= fg[:, 1:]; fg = g
    sh, sw = fg.shape
    lab = np.zeros(fg.shape, np.int32); comps = []
    n = 0
    for y in range(sh):
        for x in range(sw):
            if fg[y, x] and not lab[y, x]:
                n += 1; q = deque([(y, x)]); lab[y, x] = n; pts = []
                while q:
                    cy, cx = q.popleft(); pts.append((cy, cx))
                    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        yy, xx = cy + dy, cx + dx
                        if 0 <= yy < sh and 0 <= xx < sw and fg[yy, xx] and not lab[yy, xx]:
                            lab[yy, xx] = n; q.append((yy, xx))
                ys = [p[0] for p in pts]; xs = [p[1] for p in pts]
                comps.append((len(pts), min(xs), min(ys), max(xs), max(ys)))
    comps.sort(reverse=True)
    her = list(comps[0]) if comps else None
    if her:  # 白袜子把鞋和身体隔开：她正下方、横向重叠的连通域（鞋）并进来；指针总在她旁边或上方，不会被并进来
        for c in comps[1:]:
            if c[4] > her[4] and c[2] > her[2] and c[2] - her[4] < 70 and c[3] >= her[1] and c[1] <= her[3]:
                her[1] = min(her[1], c[1]); her[3] = max(her[3], c[3]); her[4] = max(her[4], c[4])
    cur = None
    for c in comps[1:]:
        size, x0, y0, x1, y1 = c
        bw, bh = (x1 - x0 + 1) * SCALE, (y1 - y0 + 1) * SCALE
        if 20 <= bw <= 90 and 25 <= bh <= 100 and size * SCALE * SCALE > 120:
            cur = [round(x0 * SCALE / w, 4), round(y0 * SCALE / h, 4)]  # 指针尖 ≈ 包围盒左上角
            break
    out.append({
        'her': [round(her[1] * SCALE / w, 4), round(her[2] * SCALE / h, 4), round((her[3] + 1) * SCALE / w, 4), round((her[4] + 1) * SCALE / h, 4)] if her else None,
        'cursor': cur,
    })
json.dump({'id': vid, 'n': meta['n'], 'fps': meta['fps'], 't0': meta['t0'], 'frames': out}, open(f'build/frames/{vid}_track.json', 'w', encoding='utf8'), ensure_ascii=False)
print(vid, len(out), '帧；找到指针的帧', sum(1 for f in out if f['cursor']))
