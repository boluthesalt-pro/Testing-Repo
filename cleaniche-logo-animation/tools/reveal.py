#!/usr/bin/env python3
"""Builds src/reveal.png — the symbol's "reveal order" field.

Every pixel around the symbol stores the arc-length position (along the sweep) of its nearest
centreline point, so the renderer can reveal the exact supplied shape in sweep order with a
single threshold — clean at every junction where the ribbon merges with itself.

Sweep order (must match src/ident.js): tail → top → left → bottom → C → lower wave → B → link → A,
with the upper wave (C → B) running in parallel with the lower wave.

Encoding: 16-bit order in R (high byte) + G (low byte), normalised to MAX_ORDER below; 6 px per unit.
"""
import json, os
import numpy as np
from PIL import Image
from scipy.spatial import cKDTree

ROOT = os.path.join(os.path.dirname(__file__), '..')
R = json.load(open(os.path.join(ROOT, 'src/routes.json')))
PPU, X0, Y0, X1, Y1 = 6, 92, 28, 628, 378


def cum(pts):
    p = np.array(pts, float)
    return p, np.r_[0, np.cumsum(np.linalg.norm(np.diff(p, axis=0), axis=1))]


def concat(*rs):
    out = []
    for r in rs: out += (r if not out else r[1:])
    return out


main, s_main = cum(concat(R['outB'][::-1], R['outA'], R['lower'], R['link']))
main_f, s_main_f = main, s_main
L_ring = cum(R['outB'])[1][-1] + cum(R['outA'])[1][-1]
L_low = cum(R['lower'])[1][-1]
upper, s_up = cum(R['upper'])
o_up = L_ring + s_up / s_up[-1] * L_low            # the upper wave keeps pace with the lower one

def tangents(p):
    d = np.gradient(p, axis=0)
    return d / np.linalg.norm(d, axis=1, keepdims=True)

pts = np.vstack([main_f, upper]); order = np.r_[s_main_f, o_up]
tan = np.vstack([tangents(main_f), tangents(upper) * (L_low / s_up[-1])])   # branch order runs faster
MAX_ORDER = float(np.ceil(s_main[-1] + 50))
xs = X0 + (np.arange((X1 - X0) * PPU) + 0.5) / PPU
ys = Y0 + (np.arange((Y1 - Y0) * PPU) + 0.5) / PPU
gx, gy = np.meshgrid(xs, ys)
P = np.c_[gx.ravel(), gy.ravel()]
_, idx = cKDTree(pts).query(P)
# The curl (link) merges into the ring at A and its last stretch runs inside the ring band.
# Pixels within the ring band belong to the ring (revealed when the ring passes), so the ring
# draws as one clean band and the curl's root grows out of it later.
ring_n = int(np.searchsorted(s_main, L_ring))
d_ring, i_ring = cKDTree(main[:ring_n + 1]).query(P)
late = order[idx] > L_ring + L_low
claim = late & (d_ring <= 15.3)   # just inside the ring edge (half-width ≈ 15.5–15.8 here)
idx = np.where(claim, i_ring, idx)
# continuous order: project onto the local direction so the sweep front is smooth, not stepped
proj = np.clip(((P - pts[idx]) * tan[idx]).sum(1), -1.0, 1.0)
o = np.clip((order[idx] + proj) / MAX_ORDER, 0, 1).reshape(gy.shape)
q = np.round(o * 65535).astype(np.uint32)
img = np.zeros(gy.shape + (4,), np.uint8)
img[..., 0] = q >> 8; img[..., 1] = q & 255; img[..., 3] = 255
Image.fromarray(img, 'RGBA').save(os.path.join(ROOT, 'src/reveal.png'), optimize=True)
meta = {'x0': X0, 'y0': Y0, 'ppu': PPU, 'w': img.shape[1], 'h': img.shape[0], 'maxOrder': MAX_ORDER}
json.dump(meta, open(os.path.join(ROOT, 'src/reveal.json'), 'w'))
print('wrote src/reveal.png', meta, 'main length', round(s_main[-1], 1))
