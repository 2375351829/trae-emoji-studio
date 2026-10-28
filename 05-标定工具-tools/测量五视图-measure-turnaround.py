# -*- coding: utf-8 -*-
"""
测量「02-角色五视图-turnaround」的正面 / 左侧 / 顶视图几何比例，
并与官方「全身-正面 / 全身-左侧 / 全身-顶部」交叉核对。
输出：轮廓包围盒、头/屏/躯干/臂/腿/脚边界、相对头宽的归一化比例、亮度字符图。
用法：python 05-标定工具-tools/测量五视图-measure-turnaround.py
"""
import os
import numpy as np
from PIL import Image

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
IMGS = {
    "五视图-正面": os.path.join(ROOT, "02-角色五视图-turnaround", "正面.png"),
    "五视图-左侧": os.path.join(ROOT, "02-角色五视图-turnaround", "左侧.png"),
    "五视图-背面": os.path.join(ROOT, "02-角色五视图-turnaround", "背面.png"),
    "五视图-顶视": os.path.join(ROOT, "02-角色五视图-turnaround", "顶视.png"),
    "官方-正面": os.path.join(ROOT, "01-活动原图-official-raw", "全身-正面.png"),
    "官方-左侧": os.path.join(ROOT, "01-活动原图-official-raw", "全身-左侧.png"),
    "官方-顶部": os.path.join(ROOT, "01-活动原图-official-raw", "全身-顶部.png"),
}


def load(path):
    a = np.asarray(Image.open(path).convert("RGB"), dtype=np.int16)
    lum = 0.299 * a[:, :, 0] + 0.587 * a[:, :, 1] + 0.114 * a[:, :, 2]
    return a, lum


def dark_bbox(lum, th=140):
    m = lum < th
    ys, xs = np.nonzero(m)
    return m, (int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max()))


def runs(vec):
    out, start = [], None
    for i, v in enumerate(vec):
        if v and start is None:
            start = i
        elif not v and start is not None:
            out.append((start, i - 1)); start = None
    if start is not None:
        out.append((start, len(vec) - 1))
    return out


def analyze(name, path):
    a, lum = load(path)
    m, (x0, x1, y0, y1) = dark_bbox(lum)
    hw = x1 - x0 + 1
    H, W = lum.shape
    print("\n" + "=" * 78)
    print(f"{name}  {W}x{H}  暗区bbox x[{x0},{x1}] y[{y0},{y1}]  w={hw} h={y1-y0+1}")
    print("--- 每 8% 高度的行跨度（w 相对于头宽的倍数）---")
    for k in range(13):
        y = min(y1, y0 + round((y1 - y0) * k / 12))
        rr = runs(m[y])
        if rr:
            print(f"  y={y:4d}({k*100//12:3d}%)  " +
                  " ".join(f"[{s},{e}]w{e-s+1}({(e-s+1)/hw:.3f})" for s, e in rr))
    return m, (x0, x1, y0, y1)


def ascii_map(name, path, cols=58):
    """把暗区按块中位亮度映射成字符图，直观看出 屏幕 / 边框 / 机身 的层次"""
    a, lum = load(path)
    m, (x0, x1, y0, y1) = dark_bbox(lum)
    w, h = x1 - x0 + 1, y1 - y0 + 1
    rows = max(8, int(cols * h / w * 0.5))
    ramp = "@%#*+=-:. "
    print(f"\n--- {name} 亮度字符图（@ 最暗 → 空格最亮）---")
    for r in range(rows):
        line = ""
        for c in range(cols):
            bx0 = x0 + int(c * w / cols); bx1 = max(bx0 + 1, x0 + int((c + 1) * w / cols))
            by0 = y0 + int(r * h / rows); by1 = max(by0 + 1, y0 + int((r + 1) * h / rows))
            v = float(np.median(lum[by0:by1, bx0:bx1]))
            line += " " if v > 240 else ramp[min(len(ramp) - 1, int(v / 256 * len(ramp)))]
        print("  " + line)


if __name__ == "__main__":
    for name in ("五视图-正面", "官方-正面", "五视图-左侧", "官方-左侧",
                 "五视图-背面", "五视图-顶视", "官方-顶部"):
        analyze(name, IMGS[name])
    ascii_map("五视图-正面", IMGS["五视图-正面"])
    ascii_map("五视图-左侧", IMGS["五视图-左侧"])
