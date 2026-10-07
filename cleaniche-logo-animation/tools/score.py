#!/usr/bin/env python3
"""Cleaniche "One Clean Sweep" — sound design & sonic logo → out/sound.wav (48 kHz / 24-bit stereo).

Built to picture (src/ident.js):
  0.55–0.95  the sweep: a close, soft, textured swoosh as the ribbon's edge floods the frame
  0.95–4.08  the pull-back: a breath of air that opens up and travels with the ribbon around the ring,
             over a quiet D-major shimmer that slowly rises toward the landing
  4.10       the mark lands: a warm bloom (felt sub + soft glass chord), tail of the riser cut clean
  4.60–5.80  the slide: a short silk-like air pass, left → right, as the wordmark emerges
  5.62  6.10  7.02   SONIC LOGO — three glass-mallet notes, A5 · E6 · D6 ("clean · spa-ces · ●"),
             the last one landing with the orange full stop, under a soft D(add9) resolve
  ~9.8 →     true silence
Requires numpy + scipy.
"""
import os, wave
import numpy as np
from scipy import signal

SR, DUR = 48000, 10.0
N = int(SR * DUR)
t = np.arange(N) / SR
rng = np.random.default_rng(2026)
bus = {k: np.zeros((2, N)) for k in ('air', 'tone', 'mallet', 'low')}


def hz(n):
    k = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11}
    return 440 * 2 ** ((k[n[:-1]] + 12 * (int(n[-1]) + 1) - 69) / 12)


def sos(kind, f, order=2): return signal.butter(order, f, kind, fs=SR, output='sos')
def lp(x, f, o=2): return signal.sosfilt(sos('low', f, o), x)
def hp(x, f, o=2): return signal.sosfilt(sos('high', f, o), x)
def ramp(a, b): u = np.clip((t - a) / (b - a), 0, 1); return u * u * (3 - 2 * u)


def put(name, sig, at, gain=1.0, pan=0.0):
    i = int(round(at * SR)); n = min(sig.shape[-1], N - i)
    if n <= 0: return
    pan = np.broadcast_to(np.asarray(pan, float), (sig.shape[-1],))[:n]
    th = (np.clip(pan, -1, 1) + 1) * np.pi / 4
    mono = sig if sig.ndim == 1 else sig.mean(0)
    bus[name][0, i:i + n] += mono[:n] * gain * np.cos(th)
    bus[name][1, i:i + n] += mono[:n] * gain * np.sin(th)


def shaped_noise(n, centres, q=0.5, seed=0):
    """noise whose spectral centre follows `centres` (Hz, per sample), via STFT masking."""
    r = np.random.default_rng(seed); x = r.standard_normal(n)
    f, tt, Z = signal.stft(x, SR, nperseg=1024)
    c = np.interp(tt * SR, np.arange(n), centres)
    m = np.exp(-0.5 * (np.log(f[:, None] + 1) - np.log(c[None, :])) ** 2 / q ** 2)
    _, y = signal.istft(Z * m, SR, nperseg=1024)
    y = y[:n]; return y / (np.abs(y).max() + 1e-9)


def mallet(f, dur=3.0, tau=1.1, bright=1.0):
    """Glass mallet: FM tine with a fast-decaying modulation index, a soft 2nd partial and a sub-octave body."""
    n = int(dur * SR); x = np.arange(n) / SR
    idx = bright * 2.2 * np.exp(-x / 0.045) + 0.25 * np.exp(-x / 0.6)
    tine = np.sin(2 * np.pi * f * x + idx * np.sin(2 * np.pi * f * 3.5 * x))
    body = 0.22 * np.sin(2 * np.pi * 2 * f * x) * np.exp(-x / (tau * 0.4)) + 0.28 * np.sin(2 * np.pi * f / 2 * x) * np.exp(-x / (tau * 1.3))
    att = np.clip(x / 0.003, 0, 1)
    return lp((tine * np.exp(-x / tau) + body) * att, 7500)


# ---------------- the sweep: edge floods the frame (0.55–0.95) ----------------
n = int(0.9 * SR); x = np.arange(n) / SR
sw = shaped_noise(n, 260 * (1 + 5 * np.clip(x / 0.42, 0, 1) ** 1.5) * np.exp(-np.clip(x - 0.42, 0, 9) * 1.2), q=0.55, seed=1)
sw *= np.sin(np.pi * np.clip(x / 0.9, 0, 1)) ** 1.2 * (0.4 + 0.6 * np.exp(-((x - 0.36) / 0.16) ** 2))
put('air', sw, 0.42, 0.55, pan=np.linspace(0.25, -0.15, n))
fw = np.sin(2 * np.pi * np.cumsum(70 + 40 * np.exp(-x / 0.08)) / SR) * np.clip(x / 0.02, 0, 1) * np.exp(-x / 0.28)
put('low', lp(fw, 300), 0.70, 0.30)                                          # soft body as teal fills the frame

# ---------------- the pull-back (0.95–4.08): air that opens + rising shimmer ----------------
a0, a1 = 0.85, 4.1
n = int((a1 - a0) * SR); x = np.arange(n) / SR; u = x / (a1 - a0)
cen = 380 * (7000 / 380) ** (u ** 1.6)
air = shaped_noise(n, cen, q=0.6, seed=2)
air *= (0.36 + 0.64 * u ** 2.2) * np.clip((a1 - a0 - x) / 0.03, 0, 1)        # cut clean into the landing
pan = 0.55 * np.sin(2 * np.pi * (0.25 + 0.9 * u ** 1.8))                     # travels round with the ribbon
put('air', air, a0, 0.42, pan=pan)
shim = np.zeros(n)
for nt, g in [('D5', 1), ('A5', 0.8), ('E6', 0.55), ('F#6', 0.35), ('A6', 0.25)]:
    f = hz(nt); shim += g * np.sin(2 * np.pi * f * x + rng.uniform(0, 6)) * (1 + 0.5 * np.sin(2 * np.pi * (5 + 7 * u) * x + rng.uniform(0, 6)))
shim *= u ** 2.6 * np.clip((a1 - a0 - x) / 0.025, 0, 1)
put('tone', lp(shim, 6000), a0, 0.035, pan=-0.2)
put('tone', lp(np.roll(shim, 900), 6000), a0, 0.035, pan=0.25)

drone = sum(g * np.sin(2 * np.pi * hz(nt) * x + rng.uniform(0, 6)) for nt, g in [('D2', 1), ('A2', 0.7), ('D3', 0.45)])
drone *= (0.45 + 0.55 * u ** 1.5) * np.clip(x / 0.35, 0, 1) * np.clip((a1 - a0 - x) / 0.03, 0, 1)
put('tone', lp(drone, 500), a0, 0.07)                                        # low body under the pull-back

# ---------------- landing (4.10): warm bloom ----------------
n = int(3.4 * SR); x = np.arange(n) / SR
sub = np.sin(2 * np.pi * np.cumsum(hz('D2') * (1 + 0.6 * np.exp(-x / 0.05))) / SR) * np.clip(x / 0.008, 0, 1) * np.exp(-x / 0.55)
put('low', sub, 4.10, 0.55)
bloom = sum(g * np.sin(2 * np.pi * hz(nt) * x + rng.uniform(0, 6)) for nt, g in [('D3', 1), ('A3', 0.75), ('F#4', 0.5), ('C#5', 0.28), ('E5', 0.3)])
bloom *= np.clip(x / 0.03, 0, 1) * np.exp(-x / 1.1)
put('tone', lp(bloom, 2600), 4.10, 0.11)
put('mallet', mallet(hz('D5'), tau=0.9, bright=0.5), 4.11, 0.06, pan=-0.15)

# ---------------- the slide (4.60–5.80): silk air pass ----------------
n = int(1.25 * SR); x = np.arange(n) / SR
sl = shaped_noise(n, 900 + 2600 * np.sin(np.pi * np.clip(x / 1.25, 0, 1)), q=0.45, seed=3)
sl *= np.sin(np.pi * np.clip(x / 1.25, 0, 1)) ** 2 * (0.6 + 0.4 * np.exp(-((x - 0.38) / 0.2) ** 2))
put('air', sl, 4.58, 0.20, pan=np.linspace(-0.55, 0.45, n))

# ---------------- SONIC LOGO ----------------
put('mallet', mallet(hz('A5'), tau=1.0), 5.62, 0.30, pan=-0.12)
put('mallet', mallet(hz('E6'), tau=0.95), 6.10, 0.27, pan=0.12)
put('mallet', mallet(hz('D6'), dur=3.0, tau=1.25), 7.02, 0.33, pan=0.0)
put('mallet', mallet(hz('D5'), dur=3.0, tau=1.3, bright=0.6), 7.02, 0.12, pan=0.0)   # octave below, warmth

# resolve: soft D(add9) under the last note, gone by ~9.75
n = int(2.8 * SR); x = np.arange(n) / SR
pad = np.zeros(n)
for nt, g in [('D3', 1), ('A3', 0.8), ('E4', 0.55), ('F#4', 0.5), ('A4', 0.35)]:
    for det in (-0.0018, 0.0021):
        pad += g * np.sin(2 * np.pi * hz(nt) * (1 + det) * x + rng.uniform(0, 6))
pad *= np.clip(x / 0.35, 0, 1) * np.cos(np.pi / 2 * np.clip((x - 1.2) / 1.5, 0, 1)) ** 2
put('tone', lp(pad, 1800), 7.0, 0.045)
put('low', np.sin(2 * np.pi * hz('D2') * x) * np.clip(x / 0.02, 0, 1) * np.exp(-x / 0.7), 7.02, 0.22)

# ---------------- mix: ping-pong on the mallets, plate-style reverb on everything ----------------
def pingpong(x, d=0.27, fb=0.33, wet=0.32):
    out = x.copy(); k = int(d * SR); tap = x.copy()
    for _ in range(6):
        tap = np.roll(lp(tap, 4200), k, axis=1); tap[:, :k] = 0; tap = tap[::-1] * fb
        out += tap * wet / fb
    return out

def plate(x, seed, decay=0.55, length=2.6):
    r = np.random.default_rng(seed); n = int(length * SR); k = np.arange(n) / SR
    ir = hp(lp(r.standard_normal(n), 7000), 250) * np.exp(-k / decay) * np.clip(k / 0.012, 0, 1)
    ir = np.r_[np.zeros(int(0.018 * SR)), ir]
    return signal.fftconvolve(x, ir / np.sqrt((ir ** 2).sum()))[:len(x)]

mix = bus['air'] + bus['tone'] + pingpong(bus['mallet']) + bus['low']
send = bus['air'] * 0.5 + bus['tone'] + pingpong(bus['mallet']) * 1.2
wet = np.stack([plate(send[0], 7), plate(send[1], 8)])
out = mix + 0.32 * wet
out = hp(out, 28)
silence = 1 - ramp(9.55, 9.82)                     # tails out, then true silence to the last frame
out *= silence
out *= 10 ** (-1.0 / 20) / np.abs(out).max()

path = os.path.join(os.path.dirname(__file__), '..', 'out', 'sound.wav')
os.makedirs(os.path.dirname(path), exist_ok=True)
pcm = (np.clip(out.T, -1, 1) * (2 ** 23 - 1)).astype(np.int32)
with wave.open(path, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(3); w.setframerate(SR)
    w.writeframes(pcm.reshape(-1, 1).view(np.uint8).reshape(-1, 4)[:, :3].tobytes())
print('wrote', os.path.normpath(path))
