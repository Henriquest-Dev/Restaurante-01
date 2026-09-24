"""Crop the SALA storyboard contact sheets into individual frames.

Cell boxes were measured from each sheet (dark gutter runs, plus a seam
search where a gutter is not visibly dark). Each crop is then trimmed of any
residual gutter pixels. Usage:
    python3 scripts/crop_frames.py <dir-with-sheets> [out-dir]
"""
import os, sys
import numpy as np
from PIL import Image

C4 = [(0, 438), (445, 883), (890, 1328), (1335, 1773)]

SHEETS = {
    # section: (sheet file, [(y0, y1, [(x0, x1), ...]), ...])
    "01": ("4adc0e9c-image.png", [(0, 439, C4), (447, 886, C4)]),
    "02": ("ed77ea65-image.png", [(0, 440, C4), (447, 886, C4)]),
    "03": ("8bb60506-image.png", [(0, 440, [(0, 440), (450, 884), (890, 1327), (1337, 1773)]),
                                  (446, 886, [(0, 440), (450, 884), (890, 1327), (1337, 1773)])]),
    "04": ("7e1c5c4b-image.png", [(0, 394, [(0, 402), (407, 788), (798, 1185), (1191, 1591), (1596, 1982)]),
                                  (399, 792, [(0, 402), (407, 794), (798, 1185), (1191, 1591), (1596, 1982)])]),
    "05": ("41cb5ba6-image.png", [(0, 392, [(0, 454), (461, 984), (990, 1480), (1487, 1982)]),
                                  (398, 792, [(0, 455), (461, 984), (990, 1481), (1487, 1982)])]),
    # Row 1, cell 1 of the bell sheet holds a wide view plus a narrow sliver
    # (x 462-657) cropped from the same shot; only the wide view is kept.
    "06": ("fcfb3b7a-image.png", [(0, 393, [(0, 455), (664, 1317), (1323, 1982)]),
                                  (398, 792, [(0, 658), (664, 1317), (1323, 1982)])]),
    "07": ("137b5c4e-image.png", [(0, 391, [(0, 390), (400, 788), (798, 1185), (1194, 1582), (1592, 1982)]),
                                  (398, 792, [(0, 390), (400, 788), (798, 1185), (1194, 1582), (1592, 1982)])]),
    "08": ("6a0e7a4c-image.png", [(0, 388, [(0, 401), (414, 792), (804, 1180), (1193, 1577), (1589, 1982)]),
                                  (398, 792, [(0, 401), (413, 791), (804, 1180), (1193, 1577), (1589, 1982)])]),
    "09": ("f8af60e7-image.png", [(y0, y1, [(0, 344), (354, 695), (706, 1046), (1057, 1399)])
                                  for y0, y1 in [(0, 272), (281, 556), (565, 832), (841, 1121)]]),
    "10": ("46fd7a01-image.png", [(0, 712, [(0, 331), (343, 625), (637, 926), (939, 1223),
                                            (1235, 1519), (1531, 1870), (1883, 2205)])]),
    "11": ("3385de9f-image.png", [(7, 716, [(6, 433), (447, 859), (872, 1277), (1291, 1722), (1734, 2166)])]),
}


def trim_dark(img, max_px=3, thresh=30, frac=0.8):
    a = np.asarray(img.convert("L"))
    t, b, l, r = 0, a.shape[0], 0, a.shape[1]
    while t < max_px and (a[t, l:r] < thresh).mean() > frac: t += 1
    while a.shape[0] - b < max_px and (a[b - 1, l:r] < thresh).mean() > frac: b -= 1
    while l < max_px and (a[t:b, l] < thresh).mean() > frac: l += 1
    while a.shape[1] - r < max_px and (a[t:b, r - 1] < thresh).mean() > frac: r -= 1
    # one extra pixel to drop anti-aliased gutter edges
    return img.crop((l + 1, t + 1, r - 1, b - 1))


def main(src, out):
    manifest = {}
    for sec, (fname, rows) in SHEETS.items():
        sheet = Image.open(os.path.join(src, fname)).convert("RGB")
        d = os.path.join(out, f"section-{sec}")
        os.makedirs(d, exist_ok=True)
        n = 0
        frames = []
        for y0, y1, cells in rows:
            for x0, x1 in cells:
                n += 1
                img = trim_dark(sheet.crop((x0, y0, x1 + 1, y1 + 1)))
                img.save(os.path.join(d, f"frame-{n:02d}.webp"), quality=84, method=6)
                frames.append([img.width, img.height])
        manifest[sec] = frames
        print(sec, fname, n, "frames")
    print("total", sum(len(v) for v in manifest.values()))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "public/assets/sala")
