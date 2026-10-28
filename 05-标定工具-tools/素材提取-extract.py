"""
TRAE宝 素材提取(v2)：从白底截图中抠出透明底 PNG

v2 相比 v1：
- 不再「先 1px 硬边内缩再放大」，改在原尺寸计算连续 alpha（按亮度解算边缘覆盖率），
  再 LANCZOS 放大到 3x，轮廓明显更顺滑
- 增加颜色外扩(color bleed)，避免放大时半透明边缘把白色背景渗进主体
"""
import os
from collections import deque
import numpy as np
from PIL import Image, ImageFilter

SRC_DIR = r"C:\Users\ZXYQQ\.workbuddy\clipboard-images"
OUT_DIR = r"G:\open\Trae社区活动\2026年10月26日—11月8日【有奖活动】TRAE宝表情包小赛｜下一套官方表情包，由你来画\03-姿势素材-poses"

JOBS = [
    ("clipboard-2026-10-27T14-33-08-752Z-466bdf60.png", "trae-01-jump",   "跳跃出场"),
    ("clipboard-2026-10-27T14-33-08-756Z-41ace233.png", "trae-02-laptop", "敲代码"),
    ("clipboard-2026-10-27T14-33-08-762Z-0cc50abd.png", "trae-03-love",   "心跳"),
    ("clipboard-2026-10-27T14-33-08-765Z-ab7a4d28.png", "trae-04-ride",   "骑石头怪"),
    ("clipboard-2026-10-27T14-33-08-769Z-7540a1dd.png", "trae-05-stand",  "正面站立"),
]

THRESH = 232
BG_LUM = 252.0
DARK_LUM = 214.0
SCALE = 3
PAD = 8


def flood_background(lum, thresh):
    h, w = lum.shape
    bg = np.zeros((h, w), dtype=bool)
    light = lum >= thresh
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if light[y, x] and not bg[y, x]:
                bg[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if light[y, x] and not bg[y, x]:
                bg[y, x] = True
                q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and light[ny, nx] and not bg[ny, nx]:
                bg[ny, nx] = True
                q.append((ny, nx))
    return bg


def erode(mask, r):
    """二值掩膜方形腐蚀 r 像素"""
    return ~dilate(~mask, r)


def dilate(mask, r):
    """二值掩膜方形膨胀 r 像素"""
    out = mask.copy()
    for _ in range(r):
        m = out.copy()
        out[1:, :] |= m[:-1, :]
        out[:-1, :] |= m[1:, :]
        out[:, 1:] |= m[:, :-1]
        out[:, :-1] |= m[:, 1:]
    return out


def color_bleed(rgb, known, iters=30):
    """把已知像素的颜色向外扩（最近邻取色，不做平均，避免棱角两侧深浅混出灰边）"""
    out = rgb.copy()
    known = known.copy()
    h, w = known.shape
    for _ in range(iters):
        if known.all():
            break
        progressed = False
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ys = slice(max(0, dy), h + min(0, dy))
            xs = slice(max(0, dx), w + min(0, dx))
            yd = slice(max(0, -dy), h + min(0, -dy))
            xd = slice(max(0, -dx), w + min(0, -dx))
            src_known = known[yd, xd]
            fill = (~known[ys, xs]) & src_known
            if fill.any():
                out[ys, xs][fill] = out[yd, xd][fill]
                known[ys, xs][fill] = True
                progressed = True
        if not progressed:
            break
    return out


def extract(src, out_base):
    img = Image.open(src).convert("RGB")
    arr = np.asarray(img).astype(np.float32)
    lum = 0.299 * arr[:, :, 0] + 0.587 * arr[:, :, 1] + 0.114 * arr[:, :, 2]

    bg = flood_background(lum, THRESH)

    # 边缘覆盖率：亮度越接近背景越透明
    soft = np.clip((BG_LUM - lum) / (BG_LUM - DARK_LUM), 0.0, 1.0)
    alpha = np.where(bg, 0.0, 1.0).astype(np.float32)
    # 只在与背景相邻的 1px 过渡带上解算覆盖率，避免主体内部浅色部件被削透明
    near = dilate(bg, 1) & (~bg)
    alpha[near] = np.clip(soft[near], 0.18, 1.0)

    # 去白边：轮廓 2px 内一律改用主体内部颜色（种子只取腐蚀后的实心区），
    # 边缘柔和度全部交给 alpha，深色/彩色底上都不会出现浅色描边
    core = erode(alpha > 0.5, 2)
    rgb = color_bleed(arr, core)

    # 放大后再柔化一次 alpha，抹掉原图 1px 抗锯齿带来的台阶
    a_img = Image.fromarray((alpha * 255).astype(np.uint8), "L")
    a_big = a_img.resize((img.width * SCALE, img.height * SCALE), Image.LANCZOS)
    a_big = a_big.filter(ImageFilter.GaussianBlur(1.0))
    rgb_img = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), "RGB")
    rgb_big = rgb_img.resize((img.width * SCALE, img.height * SCALE), Image.LANCZOS)

    # 放大后对透明通道做一次对比拉伸，收紧虚边并重建清晰的抗锯齿轮廓
    a_np = np.asarray(a_big).astype(np.float32) / 255.0
    a_np = np.clip((a_np - 0.16) / 0.80, 0.0, 1.0)
    a_np = a_np ** 0.92

    rgba = np.dstack([np.asarray(rgb_big).astype(np.float32), a_np * 255.0]).astype(np.uint8)
    out_img = Image.fromarray(rgba, "RGBA")

    bbox = out_img.getchannel("A").point(lambda v: 255 if v > 10 else 0).getbbox()
    if bbox:
        l, t, r, b = bbox
        l, t, r, b = max(0, l - PAD * SCALE), max(0, t - PAD * SCALE), min(out_img.width, r + PAD * SCALE), min(out_img.height, b + PAD * SCALE)
        out_img = out_img.crop((l, t, r, b))

    out_img.save(os.path.join(OUT_DIR, f"{out_base}@3x.png"), optimize=True)
    small = out_img.resize((out_img.width // 3, out_img.height // 3), Image.LANCZOS)
    small.save(os.path.join(OUT_DIR, f"{out_base}.png"), optimize=True)

    prev = Image.new("RGB", out_img.size, (18, 20, 22))
    prev.paste(out_img, (0, 0), out_img)
    prev.save(os.path.join(OUT_DIR, f"_preview-{out_base}.jpg"), quality=92)
    print(f"{out_base:18s} {out_img.size[0]}x{out_img.size[1]}")


if __name__ == "__main__":
    os.makedirs(OUT_DIR, exist_ok=True)
    for fn, base, label in JOBS:
        extract(os.path.join(SRC_DIR, fn), base)
    print("done")
