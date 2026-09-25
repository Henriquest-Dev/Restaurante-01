"""Build the images for the SALA website (home and menu pages).

- Dish cut-outs: Unsplash photos (Unsplash License, free for commercial use),
  background removed with rembg (isnet-general-use), trimmed, WebP with alpha.
- Dish photos for the "popular dishes" cards.
- Stills of the restaurant taken from the client's film (media/sala.webm),
  upscaled with Real-ESRGAN (half size -> x4, like upscale_film.py).
- A flour/spice splash texture, generated procedurally.

Usage: ESRGAN_GENERAL=<realesr-general-x4v3.pth> FFMPEG=ffmpeg \
  python3 scripts/pipeline/site_assets.py public/assets/site
"""
import io, os, subprocess, sys, urllib.request
import numpy as np
from PIL import Image, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

FFMPEG = os.environ.get('FFMPEG', 'ffmpeg')
UNSPLASH = 'https://images.unsplash.com/photo-{}?w=1400&q=85'

CUTOUTS = {
    'camarao': '1563379926898-05f4575a45d8',
    'caril': '1574484284002-952d92456975',
    'poke': '1546069901-ba9599a7e63c',
    'horta': '1512621776951-a57141f2eefd',
    'taca': '1623428187969-5da2dcea5ebf',
    'arroz': '1512058564366-18510be2db19',
    'grelha': '1594041680534-e8c8cdebd659',
}
PHOTOS = {
    'bolonhesa': '1621996346565-e3dbc646d9a9',
    'carbonara': '1551183053-bf91a1d81141',
    'bife': '1529692236671-f1f6cf9683ba',
}
# Film stills: name -> seconds into media/sala.webm
STILLS = {'historia': 25, 'eventos': 31, 'rececao': 9.5, 'mesa': 37}


def fetch(pid):
    with urllib.request.urlopen(UNSPLASH.format(pid), timeout=60) as r:
        return Image.open(io.BytesIO(r.read())).convert('RGB')


def main(out):
    os.makedirs(os.path.join(out, 'plates'), exist_ok=True)
    os.makedirs(os.path.join(out, 'photos'), exist_ok=True)
    from rembg import new_session, remove
    session = new_session('isnet-general-use')
    for name, pid in CUTOUTS.items():
        cut = remove(fetch(pid), session=session)
        a = np.asarray(cut)[:, :, 3]
        a = np.where(a > 24, a, 0).astype(np.uint8)
        cut.putalpha(Image.fromarray(a))
        cut = cut.crop(cut.getbbox())
        cut.thumbnail((1000, 1000), Image.LANCZOS)
        cut.save(os.path.join(out, 'plates', f'{name}.webp'), quality=82, method=6)
        print('plate', name, cut.size, flush=True)
    for name, pid in PHOTOS.items():
        im = fetch(pid)
        im.thumbnail((900, 900), Image.LANCZOS)
        im.save(os.path.join(out, 'photos', f'{name}.webp'), quality=80, method=6)
        print('photo', name, im.size, flush=True)

    import torch
    import esrgan
    net = esrgan.load('general', os.environ['ESRGAN_GENERAL'])
    for name, t in STILLS.items():
        raw = subprocess.run([FFMPEG, '-loglevel', 'error', '-ss', str(t), '-i', 'media/sala.webm', '-frames:v', '1',
                              '-f', 'image2pipe', '-vcodec', 'png', '-'], check=True, capture_output=True).stdout
        im = Image.open(io.BytesIO(raw)).convert('RGB').resize((960, 540), Image.LANCZOS)
        x = torch.from_numpy(np.asarray(im).copy()).permute(2, 0, 1)[None].float() / 255
        up = esrgan.upscale(net, x, tile=320)
        big = Image.fromarray((up[0].permute(1, 2, 0).numpy() * 255).round().astype(np.uint8)).resize((1920, 1080), Image.LANCZOS)
        big.save(os.path.join(out, 'photos', f'{name}.webp'), quality=80, method=6)
        print('still', name, flush=True)

    # Flour / spice splash: dense specks near the centre thinning outwards.
    rng = np.random.default_rng(7)
    S = 1200
    img = np.zeros((S, S, 4), np.float32)
    for _ in range(26000):
        # A spray thrown to the upper right, with loose specks all round.
        spray = rng.random() < 0.7
        r = abs(rng.normal(0, 0.42 if spray else 0.3)) * S / 2
        a = rng.normal(-0.6, 0.55) if spray else rng.uniform(0, 2 * np.pi)
        x, y = int(S / 2 + r * np.cos(a)), int(S / 2 + r * np.sin(a) * 0.85)
        size = max(1, int(abs(rng.normal(0, 2.2 if r < S * 0.12 else 1.4))))
        if 0 <= x < S - size and 0 <= y < S - size:
            img[y:y + size, x:x + size, :3] = 1
            img[y:y + size, x:x + size, 3] = max(img[y, x, 3], rng.uniform(0.35, 1))
    splash = Image.fromarray((img * 255).astype(np.uint8), 'RGBA').filter(ImageFilter.GaussianBlur(0.6))
    splash.save(os.path.join(out, 'splash.webp'), quality=80, method=6)
    print('splash done')


if __name__ == '__main__':
    main(sys.argv[1])

# The entrance photos (entrada.webp, entrada-m.webp) are frame 0 of the
# upscaled film (upscale_film.py, variant xl), the phone version cropped to
# x 660–1740.
