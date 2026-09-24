"""Measure a render against the reference silhouette.

Eyeballing "too thin" is how you end up chasing your own tail. This reads both figures as a width
profile down the body and prints them together, so the fix is a number rather than an impression.
"""
import sys
from PIL import Image
import numpy as np


def profile(mask):
    ys, xs = np.where(mask)
    if not len(ys):
        raise SystemExit('nothing found in the image')
    mask = mask[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    h, w = mask.shape
    out = []
    for pct in range(0, 101, 5):
        row = mask[min(h - 1, int(h * pct / 100))]
        hit = np.where(row)[0]
        out.append((hit.max() - hit.min() + 1) / h * 100 if len(hit) else 0.0)
    return out, h, w


def load(path, threshold):
    image = Image.open(path)
    if 'A' in image.getbands():
        data = np.array(image.getchannel('A'))
    else:
        data = np.array(image.convert('L'))
    return data > threshold


ref, ref_h, ref_w = profile(load('mascot3d/ref/silhouette.png', 80))
got, got_h, got_w = profile(load(sys.argv[1], 26))

print(f'reference {ref_w}x{ref_h}   render {got_w}x{got_h}')
print(f'aspect   ref {ref_h / ref_w:.2f}   render {got_h / got_w:.2f}\n')
print(' down   ref%   render%   diff')
for i, pct in enumerate(range(0, 101, 5)):
    delta = got[i] - ref[i]
    flag = '' if abs(delta) < 3 else ('  <-- thin' if delta < 0 else '  <-- wide')
    print(f'{pct:4d}%  {ref[i]:5.1f}  {got[i]:7.1f}  {delta:+6.1f}{flag}')
