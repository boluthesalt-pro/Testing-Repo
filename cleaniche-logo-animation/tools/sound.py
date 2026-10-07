#!/usr/bin/env python3
"""Synthesises the 10 s Cleaniche sound design → out/sound.wav (48 kHz, 24-bit stereo).

Cue sheet (seconds) — matches the animation timeline:
  0.00  low atmospheric hum (bed, fades by 9.7)
  0.50  delicate clean tick              (point of light starts moving)
  1.00  soft airy whoosh, panned with the circular flow → 2.4
  2.90  subtle, deep, clean impact       (symbol lands)
  3.22  soft glass-like tonal resonance  (clean pulse)
  4.20  near-imperceptible tonal swell   (wordmark)
  5.45  clean bright tick                (orange spark)
  8.80  delicate high "ting"             (final glint)
  9.30  clean resolve → silence from ~9.8
Requires numpy + scipy.
"""
import os, wave
import numpy as np
from scipy import signal

SR, DUR = 48000, 10.0
N = int(SR * DUR)
t = np.arange(N) / SR
rng = np.random.default_rng(7)
L = np.zeros(N); R = np.zeros(N)


def env_adsr(n, a, d_tau, start_level=0.0):
    """attack (s) then exponential decay with time-constant d_tau (s)."""
    x = np.arange(n) / SR
    att = np.clip(x / max(a, 1e-4), 0, 1)
    att = np.sin(att * np.pi / 2) ** 2
    return att * np.exp(-np.maximum(x - a, 0) / d_tau)


def place(sig, at, gain=1.0, pan=0.0):
    """mix mono `sig` at time `at` with constant-power pan (-1..1)."""
    i = int(at * SR); n = min(len(sig), N - i)
    if n <= 0: return
    th = (pan + 1) * np.pi / 4
    L[i:i + n] += sig[:n] * gain * np.cos(th)
    R[i:i + n] += sig[:n] * gain * np.sin(th)


def tone(freqs, dur, a, tau, amps=None, detune=0.0):
    n = int(dur * SR); x = np.arange(n) / SR
    amps = amps or [1.0] * len(freqs)
    out = np.zeros(n)
    for f, g in zip(freqs, amps):
        out += g * np.sin(2 * np.pi * f * (1 + detune * rng.uniform(-1, 1)) * x + rng.uniform(0, 6.28))
    return out * env_adsr(n, a, tau)


def lp(x, fc, order=2): return signal.sosfilt(signal.butter(order, fc, 'low', fs=SR, output='sos'), x)
def hp(x, fc, order=2): return signal.sosfilt(signal.butter(order, fc, 'high', fs=SR, output='sos'), x)
def bp(x, lo, hi, order=2): return signal.sosfilt(signal.butter(order, [lo, hi], 'band', fs=SR, output='sos'), x)


# --- atmospheric hum bed -----------------------------------------------------------
bed_env = np.clip(t / 0.9, 0, 1) ** 2 * (1 - np.clip((t - 9.15) / 0.55, 0, 1)) ** 2
bed_env *= 1 - 0.45 * np.clip((t - 3.0) / 2.0, 0, 1)          # settles under the logo
lfo = 1 + 0.12 * np.sin(2 * np.pi * 0.23 * t)
hum = (np.sin(2 * np.pi * 49 * t) + 0.5 * np.sin(2 * np.pi * 73.5 * t + 1) + 0.25 * np.sin(2 * np.pi * 98.2 * t + 2)) * lfo
air = lp(rng.standard_normal(N), 380, 4) * 1.4
place(hum * bed_env * 0.065 + air * bed_env * 0.045, 0, pan=-0.05)
place(lp(rng.standard_normal(N), 360, 4) * bed_env * 0.07, 0, pan=0.25)  # decorrelated air on the right

# --- delicate clean tick -------------------------------------------------------------
def tick(freq, bright=1.0):
    n = int(0.25 * SR)
    click = hp(rng.standard_normal(n), 3500) * env_adsr(n, 0.0004, 0.004 / bright)
    ping = tone([freq, freq * 2.76], 0.25, 0.0008, 0.035, [1, 0.3])
    return click * 0.5 + ping
place(tick(2600), 0.50, 0.16, pan=0.0)

# --- airy whoosh following the circular flow ------------------------------------------
w0, w1 = 0.95, 2.45
n = int((w1 - w0) * SR); x = np.arange(n) / SR; u = x / (w1 - w0)
noise = rng.standard_normal(n)
f, tt, Z = signal.stft(noise, SR, nperseg=1024)
uu = tt / (w1 - w0)
centre = 350 + 2600 * np.clip(uu / 0.85, 0, 1) ** 1.6                 # opens up as the light accelerates
mask = np.exp(-0.5 * (np.log(f[:, None] + 1) - np.log(centre[None, :])) ** 2 / 0.45 ** 2)
_, wh = signal.istft(Z * mask, SR, nperseg=1024); wh = wh[:n]
wenv = np.sin(np.pi * np.clip(u, 0, 1)) ** 1.5 * (0.35 + 0.65 * np.clip(u / 0.8, 0, 1))
wh = wh * wenv / (np.abs(wh).max() + 1e-9)
pan = 0.55 * np.sin(2 * np.pi * (1.4 * u ** 1.3) + np.pi)            # travels around the stereo field
i = int(w0 * SR)
L[i:i + n] += wh * 0.30 * np.cos((pan + 1) * np.pi / 4)
R[i:i + n] += wh * 0.30 * np.sin((pan + 1) * np.pi / 4)

# --- deep clean impact (symbol lands at 2.9) -------------------------------------------
n = int(1.6 * SR); x = np.arange(n) / SR
fsw = 42 + 30 * np.exp(-x / 0.06)
body = np.sin(2 * np.pi * np.cumsum(fsw) / SR) * env_adsr(n, 0.004, 0.42)
thump = lp(rng.standard_normal(n), 220, 4) * env_adsr(n, 0.002, 0.07) * 2.5
place(body * 0.42 + thump * 0.18, 2.89)

# --- glass-like tonal resonance (clean pulse at 3.22) ---------------------------------
glass = tone([1046.5, 1568.0, 2093.0, 2637.0, 3151.0], 2.6, 0.012, 0.75, [1, 0.6, 0.38, 0.22, 0.12], detune=0.0015)
place(glass, 3.22, 0.085, pan=-0.15)
place(tone([1047.6, 1569.7], 2.6, 0.02, 0.9, [1, 0.5]), 3.235, 0.05, pan=0.3)   # gentle beating shimmer

# --- tonal swell under the wordmark (almost imperceptible) ----------------------------
n = int(2.4 * SR); x = np.arange(n) / SR
pad = sum(g * np.sin(2 * np.pi * fr * x) for fr, g in [(261.6, 1), (329.6, 0.7), (392.0, 0.6), (493.9, 0.35)])
pad = lp(pad, 1800) * np.sin(np.pi * np.clip(x / 2.4, 0, 1)) ** 2
place(pad, 4.15, 0.035, pan=0.1)

# --- orange spark tick ----------------------------------------------------------------
place(tick(4200, bright=1.4), 5.45, 0.13, pan=-0.2)

# --- final glint "ting" ---------------------------------------------------------------
ting = tone([3136.0, 4698.6, 6272.0], 1.2, 0.002, 0.28, [1, 0.35, 0.15])
place(ting, 8.80, 0.10, pan=0.25)

# --- clean resolve then silence -------------------------------------------------------
n = int(0.62 * SR); x = np.arange(n) / SR
chord = sum(g * np.sin(2 * np.pi * fr * x) for fr, g in [(130.8, 1), (196.0, 0.7), (261.6, 0.55), (329.6, 0.35), (523.3, 0.12)])
cenv = np.clip(x / 0.04, 0, 1) * np.cos(np.pi / 2 * np.clip(x / 0.62, 0, 1)) ** 2
place(lp(chord, 2200) * cenv, 9.22, 0.12)

# --- space: short airy reverb ---------------------------------------------------------
def reverb(x, seed):
    r = np.random.default_rng(seed); n = int(1.9 * SR); k = np.arange(n) / SR
    ir = lp(r.standard_normal(n), 6000) * np.exp(-k / 0.42); ir[0] = 0
    return signal.fftconvolve(x, ir / np.sqrt((ir ** 2).sum()))[:len(x)]
L2 = L + 0.32 * reverb(L, 1); R2 = R + 0.32 * reverb(R, 2)
out = np.stack([L2, R2], 1)
fade = np.ones(N); fade[int(9.78 * SR):] = 0                     # brief moment of true silence
ramp = slice(int(9.70 * SR), int(9.78 * SR)); fade[ramp] = np.cos(np.linspace(0, np.pi / 2, ramp.stop - ramp.start)) ** 2
out *= fade[:, None]
out = hp(out.T, 25).T                                           # remove sub-sonic rumble
out *= 10 ** (-1.0 / 20) / np.abs(out).max()                     # peak -1 dBFS

os.makedirs(os.path.join(os.path.dirname(__file__), '..', 'out'), exist_ok=True)
path = os.path.join(os.path.dirname(__file__), '..', 'out', 'sound.wav')
pcm = (np.clip(out, -1, 1) * (2 ** 23 - 1)).astype(np.int32)
b = (pcm.reshape(-1, 1).view(np.uint8).reshape(-1, 4)[:, :3]).tobytes()   # 24-bit little-endian
with wave.open(path, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(3); w.setframerate(SR); w.writeframes(b)
print('wrote', os.path.normpath(path))
