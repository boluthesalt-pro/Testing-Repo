#!/usr/bin/env python3
"""Synthesises the 10 s Cleaniche score → out/sound.wav (48 kHz, 24-bit stereo).

A calm, airy, musical bed in D major (Lydian colour) where every visual beat is a soft note,
not an effect. No hard transients: every attack is ≥ 6 ms, everything is low-passed and
sits in a long, soft reverb.

  0.00  opening from the first cut, verbatim (assets/intro-sound-v1.wav): low atmospheric hum,
        one clean tick at 0.5, airy whoosh circling the stereo field 1.0 → 2.4
  1.60  the score's pad and air rise underneath and take over by 2.8
  2.20  pad swells and opens as the trails condense
  2.90  warm bloom on D (low D + soft bell D5/A5) — the symbol lands
  3.22  singing-bowl tone — the clean pulse
  4.25  harp-like pentatonic run, panned left→right with the wordmark stream
  5.45  two soft high notes, panned with the orange spark
  6.50  pad moves to Gmaj9 — the logo breathes
  7.50  soft low dyad under the tagline
  8.80  gentle chime — final glint
  9.25  resolve to D(add9) → silence from ~9.8
Requires numpy + scipy.
"""
import os, wave
import numpy as np
from scipy import signal

SR, DUR = 48000, 10.0
N = int(SR * DUR)
t = np.arange(N) / SR
rng = np.random.default_rng(11)
dry = np.zeros((2, N))    # pad / air bus
pl = np.zeros((2, N))     # plucked-note bus (gets echo)


def hz(note):
    names = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11}
    return 440 * 2 ** ((names[note[:-1]] + 12 * (int(note[-1]) + 1) - 69) / 12)


def lp(x, fc, order=2): return signal.sosfilt(signal.butter(order, fc, 'low', fs=SR, output='sos'), x)
def hp(x, fc, order=2): return signal.sosfilt(signal.butter(order, fc, 'high', fs=SR, output='sos'), x)


def place(bus, sig, at, gain=1.0, pan=0.0):
    i = int(at * SR); n = min(len(sig), N - i)
    if n <= 0: return
    pan = np.broadcast_to(np.asarray(pan, float), (len(sig),))[:n]
    th = (pan + 1) * np.pi / 4
    bus[0, i:i + n] += sig[:n] * gain * np.cos(th)
    bus[1, i:i + n] += sig[:n] * gain * np.sin(th)


def pluck(freq, dur=2.2, attack=0.008, tau=0.55, bright=0.35):
    """Soft kalimba / felt-bell: sine body, a quickly fading inharmonic tine partial, slow vibrato."""
    n = int(dur * SR); x = np.arange(n) / SR
    a = np.clip(x / attack, 0, 1); a = np.sin(a * np.pi / 2) ** 2
    vib = 1 + 0.0012 * np.sin(2 * np.pi * 4.5 * x)
    body = np.sin(2 * np.pi * freq * x * vib) * np.exp(-x / tau)
    body += 0.18 * np.sin(2 * np.pi * 2 * freq * x) * np.exp(-x / (tau * 0.45))
    tine = bright * np.sin(2 * np.pi * freq * 3.01 * x) * np.exp(-x / 0.07)
    return lp((body + tine) * a, min(5200, freq * 4))


def bowl(freq, dur=3.2):
    """Singing bowl: inharmonic partials with slow beating pairs, soft 40 ms onset."""
    n = int(dur * SR); x = np.arange(n) / SR
    out = np.zeros(n)
    for ratio, g, tau in [(1.0, 1.0, 1.6), (2.71, 0.45, 1.0), (5.15, 0.16, 0.55)]:
        for det in (-0.6, 0.6):
            out += g * 0.5 * np.sin(2 * np.pi * (freq * ratio + det) * x + rng.uniform(0, 6.28)) * np.exp(-x / tau)
    a = np.clip(x / 0.04, 0, 1)
    return out * a


# --- pad: detuned sines, chord changes cross-faded, brightness follows the picture ------
CHORDS = [  # (start, end, notes)
    (0.0, 3.3, ['D2', 'A2', 'E3', 'A3', 'D4']),               # Dsus2 — stillness / flow
    (2.6, 6.9, ['D2', 'A2', 'F#3', 'C#4', 'E4']),             # Dmaj9 — the symbol lands
    (6.3, 9.45, ['G2', 'D3', 'F#3', 'A3', 'B3', 'E4']),       # Gmaj9(13) — the logo breathes
    (9.05, 10.0, ['D2', 'A2', 'D3', 'F#3', 'E4']),            # D(add9) — resolve
]
bright = np.interp(t, [0, 1.0, 2.2, 2.9, 3.6, 6.5, 7.5, 9.2, 10], [0.05, 0.12, 0.45, 0.75, 0.35, 0.3, 0.45, 0.35, 0.2])
pad = np.zeros((2, N))
for k, (a, b, notes) in enumerate(CHORDS):
    e = np.clip((t - a) / 0.9, 0, 1) * np.clip((b - t) / 0.9, 0, 1)
    e = np.sin(e * np.pi / 2) ** 2
    for j, nt in enumerate(notes):
        f = hz(nt)
        for c, det in enumerate((-0.0022, 0.0, 0.0024)):
            ph = rng.uniform(0, 6.28)
            v = np.sin(2 * np.pi * f * (1 + det) * t + ph) + bright * 0.35 * np.sin(2 * np.pi * 2 * f * (1 + det) * t + ph)
            side = (j % 2 * 2 - 1) * 0.35 + (c - 1) * 0.25
            pad[0] += v * e * np.cos((side + 1) * np.pi / 4) / (len(notes) ** 0.5)
            pad[1] += v * e * np.sin((side + 1) * np.pi / 4) / (len(notes) ** 0.5)
pad_env = np.clip(t / 1.6, 0, 1) ** 2 * (1 - 0.25 * np.clip((t - 3.4) / 1.5, 0, 1))
pad_env *= 1 + 0.35 * np.exp(-((t - 2.85) / 0.45) ** 2)       # swell into the landing
pad *= pad_env * 0.075
dry += np.stack([lp(pad[0], 1400), lp(pad[1], 1400)])

# --- air: slow breathing noise, opens with the flow -----------------------------------
air = np.stack([rng.standard_normal(N), rng.standard_normal(N)])
f, tt, Z = signal.stft(air, SR, nperseg=2048)
cen = np.interp(tt, [0, 1.0, 2.2, 2.9, 4.0, 10], [500, 700, 2400, 1500, 800, 700])
mask = np.exp(-0.5 * (np.log(f[:, None] + 1) - np.log(cen[None, :])) ** 2 / 0.6 ** 2)
_, air = signal.istft(Z * mask[None], SR, nperseg=2048); air = air[:, :N]
air_env = 0.25 + 0.75 * np.exp(-((t - 1.9) / 0.75) ** 2)
air_env *= np.clip(t / 0.8, 0, 1) * (1 - np.clip((t - 8.8) / 0.8, 0, 1))
air_env *= 1 + 0.5 * np.exp(-((t - 4.75) / 0.35) ** 2)        # a breath under the wordmark stream
dry += air / np.abs(air).max() * air_env * 0.045

# --- notes on picture -----------------------------------------------------------------
n = int(2.4 * SR); x = np.arange(n) / SR                                       # warm landing bloom on D
low = np.sin(2 * np.pi * hz('D2') * x) + 0.4 * np.sin(2 * np.pi * hz('D3') * x)
low *= np.clip(x / 0.06, 0, 1) * np.exp(-x / 0.75)
place(dry, lp(low, 500), 2.88, 0.20)
place(pl, pluck(hz('D5'), tau=1.0, bright=0.12, attack=0.012), 2.90, 0.11, -0.2)
place(pl, pluck(hz('A5'), tau=0.9, bright=0.1, attack=0.012), 2.93, 0.08, 0.25)

place(dry, bowl(hz('D5')), 3.22, 0.085, 0.0)                                   # clean pulse

run = ['A4', 'B4', 'D5', 'E5', 'F#5', 'A5', 'B5', 'D6']                         # wordmark stream
for i, nt in enumerate(run):
    at = 4.28 + 0.88 * (1 - (1 - i / (len(run) - 1)) ** 1.6) * 0.92            # eases like the stream
    place(pl, pluck(hz(nt), tau=0.45, bright=0.2, attack=0.006), at, 0.065, -0.7 + 1.4 * i / (len(run) - 1))

place(pl, pluck(hz('F#6'), tau=0.5, bright=0.25), 5.46, 0.07, -0.35)           # orange spark
place(pl, pluck(hz('A6'), tau=0.6, bright=0.2), 6.15, 0.05, 0.35)

n = int(2.5 * SR); x = np.arange(n) / SR                                       # tagline: soft low dyad
dy = (np.sin(2 * np.pi * hz('B2') * x) + 0.6 * np.sin(2 * np.pi * hz('F#3') * x))
place(dry, lp(dy * np.sin(np.pi * np.clip(x / 2.5, 0, 1)) ** 2, 700), 7.45, 0.05)

chime = pluck(hz('D7'), dur=1.6, tau=0.45, bright=0.1, attack=0.006)           # final glint
chime += 0.4 * pluck(hz('A6'), dur=1.6, tau=0.5, bright=0.05, attack=0.01)
place(pl, chime, 8.80, 0.06, 0.3)

n = int(0.7 * SR); x = np.arange(n) / SR                                       # resolve
res = sum(g * np.sin(2 * np.pi * hz(nt) * x) for nt, g in [('D3', 1), ('A3', 0.6), ('F#4', 0.35), ('E5', 0.2)])
res *= np.clip(x / 0.05, 0, 1) * np.cos(np.pi / 2 * np.clip(x / 0.7, 0, 1)) ** 2
place(dry, lp(res, 1800), 9.25, 0.09)

# --- space: soft stereo echo on the notes, long gentle reverb on everything -----------------
def echo(bus, d=0.36, fb=0.32, mix=0.35):
    out = bus.copy(); k = int(d * SR); tap = bus.copy()
    for _ in range(5):
        tap = np.roll(lp(tap, 2600), k, axis=1); tap[:, :k] = 0; tap = tap[::-1] * fb   # ping-pong
        out += tap * mix / fb
    return out

def reverb(x, seed, decay=0.85, length=3.2, pre=0.025):
    r = np.random.default_rng(seed); n = int(length * SR); k = np.arange(n) / SR
    ir = lp(r.standard_normal(n), 4500) * np.exp(-k / decay) * np.clip(k / 0.03, 0, 1)
    ir = np.r_[np.zeros(int(pre * SR)), ir]
    return signal.fftconvolve(x, ir / np.sqrt((ir ** 2).sum()))[:len(x)]

mixb = dry + echo(pl)
wet = np.stack([reverb(mixb[0], 3), reverb(mixb[1], 4)])
out = mixb * 0.8 + wet * 0.55

fade = np.ones(N); a, b = int(9.45 * SR), int(9.8 * SR)       # gentle tail-out, then true silence
fade[a:b] = np.cos(np.linspace(0, np.pi / 2, b - a)) ** 2; fade[b:] = 0
out *= fade
out = hp(out, 30)
out = lp(out, 11000)
out *= 10 ** (-1.5 / 20) / np.abs(out).max()

# --- opening: the original hum / clean tick / airy whoosh (assets/intro-sound-v1.wav, verbatim),
#     handing over to the score just before the symbol lands --------------------------------
def read_wav24(path):
    with wave.open(path) as w:
        raw = np.frombuffer(w.readframes(w.getnframes()), np.uint8).reshape(-1, 3)
        ch = w.getnchannels()
    v = raw[:, 0].astype(np.int32) | (raw[:, 1].astype(np.int32) << 8) | (raw[:, 2].astype(np.int32) << 16)
    return (np.where(v >= 2 ** 23, v - 2 ** 24, v) / 2 ** 23).reshape(-1, ch).T

def ramp(a, b): u = np.clip((t - a) / (b - a), 0, 1); return u * u * (3 - 2 * u)

intro = np.zeros((2, N))
iv = read_wav24(os.path.join(os.path.dirname(__file__), '..', 'assets', 'intro-sound-v1.wav'))
intro[:, :iv.shape[1]] = iv[:, :N]
out = intro * (1 - ramp(2.35, 2.8)) + 0.7 * out * ramp(1.6, 2.6)   # score level-matched to the opening
out *= min(1.0, 10 ** (-1.0 / 20) / np.abs(out).max())

os.makedirs(os.path.join(os.path.dirname(__file__), '..', 'out'), exist_ok=True)
path = os.path.join(os.path.dirname(__file__), '..', 'out', 'sound.wav')
pcm = (np.clip(out.T, -1, 1) * (2 ** 23 - 1)).astype(np.int32)
b = pcm.reshape(-1, 1).view(np.uint8).reshape(-1, 4)[:, :3].tobytes()   # 24-bit little-endian
with wave.open(path, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(3); w.setframerate(SR); w.writeframes(b)
print('wrote', os.path.normpath(path))
