"""Export the SALA film (a 1920x1080 video) as scroll-scrubbable WebP frames.

Two variants: 'wide' (full 16:9 frame, for landscape screens) and 'tall'
(centre 2:3 crop at full height, for phones in portrait).

Usage: python3 scripts/pipeline/film_frames.py <video> <public/assets/sala/film>
"""
import json, os, subprocess, sys

FFMPEG = os.environ.get('FFMPEG', 'ffmpeg')
FPS = int(os.environ.get('FPS', '20'))
VARIANTS = {
    'wide': ('scale=1600:900:flags=lanczos', 1600, 900, 74),
    'tall': ('crop=720:1080:(iw-720)/2:0', 720, 1080, 76),
}


def main(video, out):
    manifest = {'fps': FPS, 'variants': {}}
    for name, (vf, w, h, q) in VARIANTS.items():
        d = os.path.join(out, name)
        os.makedirs(d, exist_ok=True)
        for f in os.listdir(d):
            os.remove(os.path.join(d, f))
        subprocess.run([FFMPEG, '-loglevel', 'error', '-i', video, '-an', '-vf', f'fps={FPS},{vf}',
                        '-c:v', 'libwebp', '-quality', str(q), '-compression_level', '6',
                        '-start_number', '0', os.path.join(d, '%04d.webp')], check=True)
        files = sorted(os.listdir(d))
        size = sum(os.path.getsize(os.path.join(d, f)) for f in files)
        manifest['variants'][name] = {'frames': len(files), 'width': w, 'height': h, 'bytes': size}
        print(name, len(files), 'frames', size // 1024 // 1024, 'MB', flush=True)
    manifest['frames'] = min(v['frames'] for v in manifest['variants'].values())
    json.dump(manifest, open(os.path.join(out, 'manifest.json'), 'w'), indent=1)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
# The reservation sheet's photo (public/assets/sala/film/table.webp) is:
#   ffmpeg -ss 38.5 -i media/sala.webm -frames:v 1 -vf scale=1280:-2 -c:v libwebp -quality 80 table.webp
