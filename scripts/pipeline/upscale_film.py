"""Upscale the SALA film frames with Real-ESRGAN (realesr-general-x4v3).

The 2.5 Mbit/s source is soft and blocky at full size. Each frame is
downscaled to half size (removing compression noise), upscaled x4 by the
model (restoring clean detail), then exported as:
  wide  1920x1080  landscape screens
  xl    2560x1440  large / 4K screens and TVs
  tall   960x1440  centre crop for phones in portrait
Resumable: frames already exported are skipped.

Usage: ESRGAN_GENERAL=<realesr-general-x4v3.pth> FFMPEG=ffmpeg \
  python3 scripts/pipeline/upscale_film.py media/sala.webm public/assets/sala/film
"""
import json, os, subprocess, sys, tempfile, time
import numpy as np
import torch
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import esrgan  # noqa: E402

FFMPEG = os.environ.get('FFMPEG', 'ffmpeg')
FPS = int(os.environ.get('FPS', '20'))
VARIANTS = {'wide': (1920, 1080, 80), 'xl': (2560, 1440, 78), 'tall': (960, 1440, 80)}


def main(video, out):
    torch.set_num_threads(os.cpu_count())
    net = esrgan.load('general', os.environ['ESRGAN_GENERAL'])
    src = os.path.join(tempfile.gettempdir(), 'sala-film-src')
    os.makedirs(src, exist_ok=True)
    if not os.listdir(src):
        subprocess.run([FFMPEG, '-loglevel', 'error', '-i', video, '-an', '-vf', f'fps={FPS}',
                        os.path.join(src, '%04d.png')], check=True)
    files = sorted(os.listdir(src))
    for v in VARIANTS:
        os.makedirs(os.path.join(out, v), exist_ok=True)
    t0 = time.time()
    for n, f in enumerate(files):
        idx = int(f[:4]) - 1
        name = f'{idx:04d}.webp'
        if all(os.path.exists(os.path.join(out, v, name)) for v in VARIANTS):
            continue
        im = Image.open(os.path.join(src, f)).convert('RGB').resize((960, 540), Image.LANCZOS)
        t = torch.from_numpy(np.asarray(im).copy()).permute(2, 0, 1)[None].float() / 255
        up = esrgan.upscale(net, t, tile=320)
        big = Image.fromarray((up[0].permute(1, 2, 0).numpy() * 255).round().astype(np.uint8))  # 3840x2160
        xl = big.resize((2560, 1440), Image.LANCZOS)
        xl.save(os.path.join(out, 'xl', name), quality=VARIANTS['xl'][2], method=4)
        xl.resize((1920, 1080), Image.LANCZOS).save(os.path.join(out, 'wide', name), quality=VARIANTS['wide'][2], method=4)
        xl.crop((800, 0, 1760, 1440)).save(os.path.join(out, 'tall', name), quality=VARIANTS['tall'][2], method=4)
        if n % 10 == 0:
            print(time.strftime('%H:%M:%S'), f'{n + 1}/{len(files)}', f'{(time.time() - t0) / 60:.1f} min', flush=True)
    manifest = {'fps': FPS, 'variants': {}}
    for v, (w, h, _) in VARIANTS.items():
        d = os.path.join(out, v)
        fs = [x for x in sorted(os.listdir(d)) if x.endswith('.webp')]
        manifest['variants'][v] = {'frames': len(fs), 'width': w, 'height': h,
                                   'bytes': sum(os.path.getsize(os.path.join(d, x)) for x in fs)}
    manifest['frames'] = min(x['frames'] for x in manifest['variants'].values())
    json.dump(manifest, open(os.path.join(out, 'manifest.json'), 'w'), indent=1)
    print('done', json.dumps(manifest), flush=True)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
