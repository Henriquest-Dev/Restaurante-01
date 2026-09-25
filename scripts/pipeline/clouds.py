"""Generate soft white cloud cut-outs (WebP with alpha) for the home page
"cloud reveal" transition. Procedural: blob shapes modulated by fractal noise.

Usage: python3 scripts/pipeline/clouds.py public/assets/site/clouds
"""
import os, sys
import cv2
import numpy as np
from PIL import Image, ImageFilter


def noise(h, w, rng, octaves=6):
    out = np.zeros((h, w), np.float32)
    amp, total = 1.0, 0.0
    for o in range(octaves):
        s = 2 ** (o + 2)
        g = rng.random((s, s)).astype(np.float32)
        layer = np.asarray(Image.fromarray((g * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC), np.float32) / 255
        out += layer * amp
        total += amp
        amp *= 0.55
    return out / total


def cloud(seed, W=1400, H=820):
    """Cumulus: many spherical puffs form a height map, lit from above-left."""
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    height = np.zeros((H, W), np.float32)
    base = H * 0.72
    for _ in range(46):
        cx = rng.normal(0.5, 0.17) * W
        r = rng.uniform(0.045, 0.13) * W
        # Bigger puffs sit higher in the middle; the base stays flat-ish.
        top = base - r * rng.uniform(0.4, 1.5) * (1.3 - abs(cx / W - 0.5) * 1.6)
        cy = min(base - r * 0.35, top)
        d2 = ((xx - cx) ** 2 + (yy - cy) ** 2) / r ** 2
        height = np.maximum(height, np.sqrt(np.clip(1 - d2, 0, 1)) * r)
    height[yy > base] *= np.clip(1 - (yy[yy > base] - base) / (H * 0.05), 0, 1)
    # Soft unions between puffs, then billowy detail.
    height = cv2.GaussianBlur(height, (0, 0), 22)
    n = noise(H, W, rng, octaves=4)
    n2 = noise(H, W, np.random.default_rng(seed + 100), octaves=5)
    hmap = height * (0.8 + 0.4 * n) + (n2 - 0.5) * 8 * (height > 6)
    hmap = cv2.GaussianBlur(hmap.astype(np.float32), (0, 0), 2.5)
    gy, gx = np.gradient(hmap)
    nz = np.ones_like(hmap) * 0.9
    norm = np.sqrt(gx ** 2 + gy ** 2 + nz ** 2)
    light = np.array([-0.35, -0.7, 0.62])
    lam = (-gx * light[0] - gy * light[1] + nz * light[2]) / norm
    shade = np.clip(0.72 + 0.34 * lam, 0.66, 1.0)
    shade = shade * (0.9 + 0.1 * (1 - yy / H))
    alpha = np.clip((hmap - 10) / 45, 0, 1) ** 1.3
    rgb = np.stack([shade * 255, shade * 253, shade * 250], -1)
    im = Image.fromarray(np.dstack([np.clip(rgb, 0, 255), alpha * 255]).astype(np.uint8), 'RGBA')
    return im.filter(ImageFilter.GaussianBlur(1.0))


if __name__ == '__main__':
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    for i, seed in enumerate([3, 11, 29, 41]):
        c = cloud(seed)
        c = c.crop(c.getbbox())
        c.save(os.path.join(out, f'cloud-{i + 1}.webp'), quality=78, method=6)
        print('cloud', i + 1, c.size)
