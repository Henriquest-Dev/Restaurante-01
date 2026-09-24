"""Build the SALA media from the storyboard sheets.

1. crop every cell from the original PNG sheets (scripts/crop_frames.py boxes)
2. upscale x4 with Real-ESRGAN (x4plus)
3. per chapter: bring frames to one size, generate in-between frames with
   RIFE v4.26 and export them as a WebP image sequence for canvas scrubbing
4. export the upscaled stills as WebP (posters / fallback)

Usage:
  RIFE_DIR=<Practical-RIFE with train_log> ESRGAN=<RealESRGAN_x4plus.pth> \
  python3 scripts/pipeline/build_media.py <sheets-dir> <work-dir> <public-dir>
"""
import json, os, sys, time
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
sys.path.insert(0, HERE)
from crop_frames import SHEETS, trim_dark  # noqa: E402


INBETWEEN = int(os.environ.get('INBETWEEN', '7'))  # frames generated between two source frames
QUALITY = int(os.environ.get('QUALITY', '80'))

# Source frames played by each video, in order (see src/journey/data.ts).
VIDEOS = {
    '01': [1, 2, 3, 4],
    '02': [1, 2, 3, 4],
    '03': [1, 2, 3, 4, 5, 6, 7, 8],
    '04': list(range(1, 11)),
    '05': [4, 5, 6, 7, 8],
    '06': [2, 3, 4, 5, 6],
    '07': list(range(1, 11)),
    '08': list(range(1, 11)),
    '09': list(range(1, 17)) + [1],  # look-around loop: 16 -> 1 closes the circle
    '10': [1, 2, 3, 4, 5, 6, 7],
    '11': [1, 2, 3, 4, 5],
}


# Pairs (0-based, per chapter) whose photographs differ too much for RIFE:
# its in-betweens melt (hands appearing, doors swinging, large turns). These
# get a short film dissolve instead: hold, quick crossfade, hold.
DISSOLVE_PAIRS = {
    '03': [0, 4, 5],
    '05': [2],
    '06': [0, 1],
    '07': [0],
    '09': [1, 8, 9, 10, 11, 12],
    '10': [4],
    '11': [1, 3],
}


def dissolve(a, b, times):
    out = []
    for t in times:
        # Most of the pair holds on a photograph; the blend is brief.
        u = min(1.0, max(0.0, (t - 0.3) / 0.4))
        u = u * u * (3 - 2 * u)
        out.append((a.astype(np.float32) * (1 - u) + b.astype(np.float32) * u).round().astype(np.uint8))
    return out


def log(*a):
    print(time.strftime('%H:%M:%S'), *a, flush=True)


def stage_crop(src, work):
    for sec, (fname, rows) in SHEETS.items():
        d = os.path.join(work, 'crop', sec)
        os.makedirs(d, exist_ok=True)
        sheet = Image.open(os.path.join(src, fname)).convert('RGB')
        n = 0
        for y0, y1, cells in rows:
            for x0, x1 in cells:
                n += 1
                p = os.path.join(d, f'{n:02d}.png')
                if not os.path.exists(p):
                    trim_dark(sheet.crop((x0, y0, x1 + 1, y1 + 1))).save(p)


def stage_upscale(work, weights):
    import torch
    import esrgan
    torch.set_num_threads(os.cpu_count())
    net = esrgan.load('x4plus', weights)
    todo = []
    for sec in SHEETS:
        for f in sorted(os.listdir(os.path.join(work, 'crop', sec))):
            out = os.path.join(work, 'up', sec, f)
            if not os.path.exists(out):
                todo.append((sec, f, out))
    for i, (sec, f, out) in enumerate(todo):
        os.makedirs(os.path.dirname(out), exist_ok=True)
        a = np.asarray(Image.open(os.path.join(work, 'crop', sec, f)).convert('RGB')).copy()
        t = torch.from_numpy(a).permute(2, 0, 1)[None].float() / 255
        o = esrgan.upscale(net, t)
        Image.fromarray((o[0].permute(1, 2, 0).numpy() * 255).round().astype(np.uint8)).save(out + '.tmp.png')
        os.replace(out + '.tmp.png', out)
        log(f'upscaled {sec}/{f} ({i + 1}/{len(todo)})')


def even(n):
    return int(n) // 2 * 2


def chapter_size(frames):
    """Common crop (smallest w/h) and output size: short side up to 1152, long side up to 1920."""
    cw = min(im.width for im in frames)
    ch = min(im.height for im in frames)
    s = min(1152 / min(cw, ch), 1920 / max(cw, ch), 1.0)
    return (cw, ch), (even(cw * s), even(ch * s))


def center_crop(im, w, h):
    x = (im.width - w) // 2
    y = (im.height - h) // 2
    return im.crop((x, y, x + w, y + h))


def stage_sequences(work, public, only=None):
    """Per chapter: common size, RIFE in-betweens, WebP image sequence.

    Image sequences drawn on a canvas scrub far more smoothly than seeking a
    compressed video, especially on phones, and keep full photographic quality.
    """
    import rife
    import torch
    torch.set_num_threads(os.cpu_count())
    times = [(k + 1) / (INBETWEEN + 1) for k in range(INBETWEEN)]
    mpath = os.path.join(public, 'seq', 'manifest.json')
    for sec, seq in VIDEOS.items():
        if only and sec not in only:
            continue
        srcs = [Image.open(os.path.join(work, 'up', sec, f'{n:02d}.png')).convert('RGB') for n in seq]
        (cw, ch), (ow, oh) = chapter_size(srcs)
        frames = [np.asarray(center_crop(im, cw, ch).resize((ow, oh), Image.LANCZOS)) for im in srcs]
        d = os.path.join(public, 'seq', f'section-{sec}')
        os.makedirs(d, exist_ok=True)
        for f in os.listdir(d):
            os.remove(os.path.join(d, f))
        idx = 0

        def put(a):
            nonlocal idx
            Image.fromarray(a).save(os.path.join(d, f'{idx:04d}.webp'), quality=QUALITY, method=6)
            idx += 1

        for i in range(len(frames) - 1):
            cache = os.path.join(work, 'rife', f'{sec}-{INBETWEEN}-{ow}', f'{i:02d}.npz')
            if i in DISSOLVE_PAIRS.get(sec, []):
                mids = dissolve(frames[i], frames[i + 1], times)
            elif os.path.exists(cache):
                mids = list(np.load(cache)['f'])
            else:
                mids = rife.between(frames[i], frames[i + 1], times)
                os.makedirs(os.path.dirname(cache), exist_ok=True)
                np.savez(cache, f=np.stack(mids))
            put(frames[i])
            for m in mids:
                put(m)
            log(f'interpolated {sec} pair {i + 1}/{len(frames) - 1}')
        loop = sec == '09'
        if not loop:
            put(frames[-1])
        size = sum(os.path.getsize(os.path.join(d, f)) for f in os.listdir(d))
        old = json.load(open(mpath)) if os.path.exists(mpath) else {}
        old[sec] = {
            'frames': idx, 'width': ow, 'height': oh,
            'sources': seq[:-1] if loop else seq, 'step': INBETWEEN + 1, 'bytes': size,
        }
        json.dump(old, open(mpath, 'w'), indent=1, sort_keys=True)
        log(f'sequence {sec}: {ow}x{oh}, {idx} frames, {size // 1024} KB')


def stage_stills(work, public):
    """Upscaled stills, long side 1600, for posters and the image fallback."""
    for sec in SHEETS:
        d = os.path.join(public, f'section-{sec}')
        os.makedirs(d, exist_ok=True)
        for f in sorted(os.listdir(os.path.join(work, 'up', sec))):
            im = Image.open(os.path.join(work, 'up', sec, f)).convert('RGB')
            s = min(1.0, 1600 / max(im.size))
            im = im.resize((even(im.width * s), even(im.height * s)), Image.LANCZOS)
            im.save(os.path.join(d, f'frame-{f[:2]}.webp'), quality=82, method=6)
    log('stills exported')


if __name__ == '__main__':
    src, work, public = sys.argv[1:4]
    stages = os.environ.get('STAGES', 'crop,upscale,videos,stills').split(',')
    only = os.environ.get('ONLY', '').split(',') if os.environ.get('ONLY') else None
    if 'crop' in stages:
        stage_crop(src, work)
    if 'upscale' in stages:
        stage_upscale(work, os.environ['ESRGAN'])
    if 'sequences' in stages:
        stage_sequences(work, public, only)
    if 'stills' in stages:
        stage_stills(work, public)
    log('done')
