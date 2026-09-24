"""RIFE v4.26 frame interpolation (hzwer/Practical-RIFE, MIT) on CPU."""
import os, sys
import numpy as np
import torch
import torch.nn.functional as F

RIFE_DIR = os.environ.get('RIFE_DIR', '')
sys.path.insert(0, RIFE_DIR)
from train_log.RIFE_HDv3 import Model  # noqa: E402

_model = None


def model():
    global _model
    if _model is None:
        m = Model()
        m.load_model(os.path.join(RIFE_DIR, 'train_log'), -1)
        m.eval()
        _model = m
    return _model


def to_t(a):
    return torch.from_numpy(np.ascontiguousarray(a)).permute(2, 0, 1)[None].float() / 255


@torch.no_grad()
def between(a, b, times, scale=1.0):
    """a, b: HxWx3 uint8 arrays of equal size. Returns list of uint8 arrays at each t in times."""
    h, w, _ = a.shape
    ph, pw = ((h - 1) // 64 + 1) * 64, ((w - 1) // 64 + 1) * 64
    pad = (0, pw - w, 0, ph - h)
    i0, i1 = F.pad(to_t(a), pad), F.pad(to_t(b), pad)
    out = []
    for t in times:
        r = model().inference(i0, i1, t, scale)
        out.append((r[0, :, :h, :w].clamp(0, 1).permute(1, 2, 0).numpy() * 255).round().astype(np.uint8))
    return out
