"""Compose food cut-outs onto a generated dark stoneware plate, so dishes
whose photos are not top-down plates still match the round menu plates.

Usage: python3 scripts/pipeline/plated.py   (after site_assets.py)
Needs the rembg cut-outs listed in SOURCES (Unsplash photos).
"""
import io, os, sys, urllib.request
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = 'public/assets/site/plates'
SOURCES = {
    # name: (unsplash id, food scale in plate, circular crop (cx, cy, r) in source px or None)
    'bolonhesa': ('1621996346565-e3dbc646d9a9', 0.8, None),
    'carbonara': ('1551183053-bf91a1d81141', 0.78, (690, 400, 330)),
    'bife': ('1529692236671-f1f6cf9683ba', 0.84, None),
}
S = 1000


def plate():
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float32)
    d = np.hypot(xx - S / 2, yy - S / 2) / (S / 2)
    base = np.zeros((S, S, 4), np.float32)
    # Stoneware: dark rim, slightly lighter lip, deep well.
    col = np.where(d < 0.72, 0.16, np.where(d < 0.8, 0.24, 0.2))[..., None] * np.array([1.0, 0.97, 0.92])
    lip = np.exp(-((d - 0.76) / 0.02) ** 2) * 0.12 + np.exp(-((d - 0.97) / 0.012) ** 2) * 0.08
    light = np.clip((-(xx - S / 2) - (yy - S / 2)) / S, -0.5, 0.5) * 0.14
    rgb = np.clip(col + lip[..., None] + light[..., None] * (d > 0.72)[..., None], 0, 1)
    noise = (np.random.default_rng(3).random((S, S)) - 0.5) * 0.02
    rgb = np.clip(rgb + noise[..., None], 0, 1)
    alpha = np.clip((0.985 - d) / 0.01, 0, 1)
    base[..., :3] = rgb
    base[..., 3] = alpha
    return Image.fromarray((base * 255).astype(np.uint8), 'RGBA')


def main():
    from rembg import new_session, remove
    session = new_session('isnet-general-use')
    for name, (pid, scale, circle) in SOURCES.items():
        with urllib.request.urlopen(f'https://images.unsplash.com/photo-{pid}?w=1400&q=85', timeout=60) as r:
            src = Image.open(io.BytesIO(r.read())).convert('RGB')
        food = remove(src, session=session)
        if circle:
            cx, cy, rad = circle
            m = Image.new('L', food.size, 0)
            ImageDraw.Draw(m).ellipse((cx - rad, cy - rad, cx + rad, cy + rad), fill=255)
            m = m.filter(ImageFilter.GaussianBlur(6))
            a = np.minimum(np.asarray(food)[..., 3], np.asarray(m))
            food.putalpha(Image.fromarray(a))
        food = food.crop(food.getbbox())
        k = scale * S / max(food.size)
        food = food.resize((int(food.width * k), int(food.height * k)), Image.LANCZOS)
        p = plate()
        # Soft contact shadow under the food.
        sh = Image.new('RGBA', (S, S), (0, 0, 0, 0))
        fa = food.split()[3].filter(ImageFilter.GaussianBlur(14))
        sh.paste((0, 0, 0, 200), ((S - food.width) // 2 + 8, (S - food.height) // 2 + 14), fa)
        p = Image.alpha_composite(p, sh)
        p.alpha_composite(food, ((S - food.width) // 2, (S - food.height) // 2))
        p.save(os.path.join(OUT, f'{name}.webp'), quality=82, method=6)
        print('plated', name)


if __name__ == '__main__':
    main()
