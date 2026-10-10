#!/usr/bin/env python3
"""YANU logo ident: original score -> out/yanu-ident-score.wav (48 kHz, 24-bit stereo).

A sweet, sensual half-time R&B groove at 120 BPM: four bars of 2 s, 8 s in
all, in F major. Each hit lands on a beat in the picture (src/ident.js uses
the same grid).

  bar 1  0-2 s  Bbmaj9   Intro. Breathy "ooh" choir under a low-pass filter
                         that slowly opens, a few glass-bell notes and finger
                         snaps, under the hairline. A silk swell rises
                         into the drop.
  bar 2  2-4 s  Am7      The drop. Soft kick, sub bass and a clap on 3.0.
                         One bell per letter (C5 E5 G5 A5 at 2.00 / 2.25 /
                         2.50 / 2.75 s), then a sparkle chime as the ® lands
                         at 3.5 s.
  bar 3  4-6 s  Gm9      Full groove with electric-piano stabs while the
                         logo holds.
  bar 4  6-8 s  Fmaj9    Resolve. Sonic logo "ya-nu" (C6 -> A5) on 6.0 and
                         6.5 s, under the sheen, then the music blooms and
                         fades out by 8.0 s.

Everything is synthesised here (numpy + scipy). No samples are used.
"""
import wave
from pathlib import Path

import numpy as np
from scipy import signal

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "out" / "yanu-ident-score.wav"

SR, DUR, BPM = 48000, 8.0, 120
BEAT = 60 / BPM            # 0.5 s
BAR = 4 * BEAT             # 2.0 s
STEP = BEAT / 4            # 16th note, 0.125 s
N = int(SR * DUR)
T = np.arange(N) / SR
rng = np.random.default_rng(1505)

buses = {k: np.zeros((2, N)) for k in ("drums", "bass", "pad", "keys", "bells", "fx")}


def hz(name):
    k = {"C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5, "F#": 6,
         "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11}
    return 440 * 2 ** ((k[name[:-1]] + 12 * (int(name[-1]) + 1) - 69) / 12)


def sos(kind, f, order=2):
    return signal.butter(order, f, kind, fs=SR, output="sos")


def lp(x, f, o=2): return signal.sosfilt(sos("low", f, o), x)
def hp(x, f, o=2): return signal.sosfilt(sos("high", f, o), x)
def bp(x, lo, hi, o=2): return signal.sosfilt(sos("band", [lo, hi], o), x)


def put(bus, sig, at, gain=1.0, pan=0.0):
    """Mix a mono or stereo signal into a bus at time `at` (s), equal-power pan."""
    i = int(round(at * SR))
    if i >= N:
        return
    if i < 0:
        sig = sig[..., -i:]
        i = 0
    n = min(sig.shape[-1], N - i)
    if sig.ndim == 1:
        th = (np.clip(pan, -1, 1) + 1) * np.pi / 4
        buses[bus][0, i:i + n] += sig[:n] * gain * np.cos(th)
        buses[bus][1, i:i + n] += sig[:n] * gain * np.sin(th)
    else:
        buses[bus][:, i:i + n] += sig[:, :n] * gain


def env(n, a, d_tau, release_at=None, r=0.05):
    x = np.arange(n) / SR
    e = np.minimum(1, x / max(a, 1e-4)) * np.exp(-np.maximum(0, x - a) / d_tau)
    if release_at is not None:
        e *= np.clip(1 - (x - release_at) / r, 0, 1)
    return e


# --- Instruments ------------------------------------------------------------

def kick(dur=0.55):
    n = int(dur * SR); x = np.arange(n) / SR
    f = 46 + 95 * np.exp(-x / 0.035)                       # soft 808-style drop
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / 0.22)
    click = hp(rng.standard_normal(n), 2500) * np.exp(-x / 0.004) * 0.12
    return np.tanh(1.6 * (body + click)) * 0.9


def clap(dur=0.6):
    n = int(dur * SR); x = np.arange(n) / SR
    noise = bp(rng.standard_normal(n), 900, 5200)
    e = np.zeros(n)
    for k, d in enumerate((0, 0.011, 0.022, 0.034)):       # a few hands, slightly spread
        e += np.where(x >= d, np.exp(-(x - d) / (0.012 if k < 3 else 0.16)), 0)
    return noise * e * 0.5


def snap(dur=0.25):
    n = int(dur * SR); x = np.arange(n) / SR
    tone = np.sin(2 * np.pi * 1850 * x) * np.exp(-x / 0.006)
    noise = bp(rng.standard_normal(n), 1800, 7000) * np.exp(-x / 0.018)
    return (0.5 * tone + noise) * 0.55


def hat(dur=0.09, open_=False):
    n = int((0.35 if open_ else dur) * SR); x = np.arange(n) / SR
    return hp(rng.standard_normal(n), 7500, 4) * np.exp(-x / (0.09 if open_ else 0.018)) * 0.35


def sub(freq, dur, glide_from=None):
    n = int(dur * SR); x = np.arange(n) / SR
    f = np.full(n, freq)
    if glide_from:
        f = freq + (glide_from - freq) * np.exp(-x / 0.05)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR)
    s = np.tanh(1.4 * s) * 0.8 + 0.2 * np.sin(4 * np.pi * np.cumsum(f) / SR)
    return s * env(n, 0.006, 0.9, release_at=dur - 0.05, r=0.05)


def bell(freq, dur=2.5, bright=1.0):
    """Glass bell: FM tine whose brightness fades fast, with a soft octave."""
    n = int(dur * SR); x = np.arange(n) / SR
    idx = bright * 2.0 * np.exp(-x / 0.05) + 0.2 * np.exp(-x / 0.7)
    tone = np.sin(2 * np.pi * freq * x + idx * np.sin(2 * np.pi * 3.5 * freq * x))
    tone += 0.25 * np.sin(2 * np.pi * 2 * freq * x) * np.exp(-x / 0.35)
    return tone * env(n, 0.002, 0.75) * 0.5


def epiano(freqs, dur=0.9):
    """Electric-piano chord: FM tines with a gentle tremolo."""
    n = int(dur * SR); x = np.arange(n) / SR
    out = np.zeros(n)
    for f in freqs:
        idx = 1.1 * np.exp(-x / 0.12)
        out += np.sin(2 * np.pi * f * x + idx * np.sin(2 * np.pi * f * x)) / len(freqs)
    out *= 1 + 0.15 * np.sin(2 * np.pi * 5.2 * x)
    return out * env(n, 0.004, 0.45, release_at=dur - 0.06, r=0.06) * 0.6


FORMANTS = {  # (centre Hz, bandwidth Hz, gain)
    "oo": [(320, 90, 1.0), (800, 110, 0.45), (2300, 160, 0.12)],
    "ah": [(700, 110, 1.0), (1150, 130, 0.6), (2500, 180, 0.18)],
}


def choir(freqs, dur, vowel_mix):
    """Breathy "ooh/aah" pad: detuned saws through vowel formants, with vibrato.
    vowel_mix: array (per sample) from 0 = "oo" to 1 = "ah"."""
    n = int(dur * SR); x = np.arange(n) / SR
    voices = np.zeros(n)
    for f in freqs:
        for det in (-7, 0, 6):
            vib = 1 + 0.0035 * np.sin(2 * np.pi * (5.1 + det * 0.03) * x + rng.uniform(0, 6))
            ph = np.cumsum(f * 2 ** (det / 1200) * vib) / SR
            voices += 2 * (ph % 1) - 1
    voices /= len(freqs) * 3
    breath = hp(rng.standard_normal(n), 3000) * 0.04
    out = np.zeros(n)
    for name, w in (("oo", 1 - vowel_mix[:n]), ("ah", vowel_mix[:n])):
        for fc, bw, g in FORMANTS[name]:
            out += bp(voices + breath, fc - bw / 2, fc + bw / 2) * g * w
    return out * 3.2


def shaped_noise(n, centres, q=0.45, seed=0):
    """Noise whose spectral centre follows `centres` (Hz per sample)."""
    r = np.random.default_rng(seed)
    f, tt, Z = signal.stft(r.standard_normal(n), SR, nperseg=1024)
    c = np.interp(tt * SR, np.arange(n), centres)
    m = np.exp(-0.5 * (np.log(f[:, None] + 1) - np.log(c[None, :])) ** 2 / q ** 2)
    _, y = signal.istft(Z * m, SR, nperseg=1024)
    y = y[:n]
    return y / (np.abs(y).max() + 1e-9)


def whoosh(dur, seed):
    """Silk whoosh that peaks at its end (it is placed to land on a hit)."""
    n = int(dur * SR); x = np.arange(n) / SR
    s = shaped_noise(n, 500 + 5500 * (x / dur) ** 2, seed=seed)
    e = (x / dur) ** 2.2 * np.clip((dur - x) / 0.02, 0, 1)
    return s * e


def sparkle(seed, count=9, spread=0.35):
    """A cluster of tiny high glass glints."""
    r = np.random.default_rng(seed)
    n = int((spread + 1.2) * SR)
    out = np.zeros((2, n))
    notes = [hz(k) for k in ("C7", "E7", "G7", "A7", "C8", "F7")]
    for k in range(count):
        at = int(r.uniform(0, spread) * SR)
        g = bell(r.choice(notes), 1.0, bright=0.6) * (0.5 + 0.5 * r.random()) * (1 - k / count * 0.5)
        th = (r.uniform(-0.8, 0.8) + 1) * np.pi / 4
        m = min(len(g), n - at)
        out[0, at:at + m] += g[:m] * np.cos(th)
        out[1, at:at + m] += g[:m] * np.sin(th)
    return out * 0.45


# --- Arrangement -------------------------------------------------------------

CHORDS = [  # (bass, voicing)
    ("Bb1", ["D4", "F4", "A4", "C5"]),     # Bbmaj9
    ("A1",  ["G3", "C4", "E4", "G4"]),     # Am7
    ("G1",  ["F3", "Bb3", "D4", "A4"]),    # Gm9
    ("F1",  ["E4", "A4", "C5", "G5"]),     # Fmaj9
]

# Choir pad, one chord per bar, crossfaded; vowel opens from "oo" to "ah".
vowel = np.clip(T / 6.5, 0, 1) ** 1.2
for b, (_, voicing) in enumerate(CHORDS):
    at = b * BAR - 0.08
    d = BAR + 0.6 if b < 3 else DUR - at
    c = choir([hz(v) for v in voicing], d, vowel[int(max(at, 0) * SR):])
    n = len(c); x = np.arange(n) / SR
    fade = np.minimum(1, x / 0.12) * np.clip((d - x) / 0.5, 0, 1)
    put("pad", c * fade, at, 0.50)

# Intro filter: the pad starts dark and opens up into the drop.
cut = 400 + 7600 * np.clip(T / 2.0, 0, 1) ** 2.5
for ch in range(2):  # time-varying one-pole low-pass
    y = np.zeros(N); acc = 0.0
    a = 1 - np.exp(-2 * np.pi * cut / SR)
    xin = buses["pad"][ch]
    for i in range(N):
        acc += a[i] * (xin[i] - acc); y[i] = acc
    buses["pad"][ch] = y

# Intro: sparse bells and snaps.
for at, note, pan in ((0.10, "F5", -0.3), (0.60, "A5", 0.3), (1.10, "C6", -0.2), (1.35, "D6", 0.25)):
    put("bells", bell(hz(note), 2.0), at, 0.30, pan)
for at in (0.5, 1.5):
    put("drums", snap(), at, 0.55, 0.15)

# Silk swell rising into the drop.
put("fx", whoosh(1.6, seed=3), 2.0 - 1.6, 0.30)

# Groove, bars 2-4.
KICKS = [0, 7, 10]          # 16th steps within a bar: R&B bounce
for b in (1, 2, 3):
    bar0 = b * BAR
    root = hz(CHORDS[b][0])
    kicks = KICKS if b < 3 else [0, 7]
    for s in kicks:
        put("drums", kick(), bar0 + s * STEP, 0.55)
    # Sub bass follows the kick, with a slide into each bar.
    for k, s in enumerate(kicks):
        nxt = kicks[k + 1] * STEP if k + 1 < len(kicks) else BAR
        dur = (nxt - s * STEP) * (0.95 if b < 3 else 1.6)
        put("bass", sub(root * (2 if s == 10 else 1), dur, glide_from=root * 1.5 if s == 0 else None),
            bar0 + s * STEP, 0.26)
    put("drums", clap(), bar0 + 8 * STEP, 0.55, 0.05)                 # half-time backbeat
    put("drums", snap(), bar0 + 8 * STEP + 0.004, 0.45, -0.2)
    for s in range(16):                                                # swung hats
        if b == 3 and s >= 8:
            break
        swing = 0.018 if s % 2 else 0.0
        g = 0.26 if s % 4 == 2 else 0.14
        put("drums", hat(), bar0 + s * STEP + swing, g, 0.35)
    put("drums", hat(open_=True), bar0 + 14 * STEP, 0.16, 0.4)
    # Electric-piano stabs on the and-of-1 and the 3.
    voicing = [hz(v) for v in CHORDS[b][1]]
    for s in (2, 9):
        put("keys", epiano(voicing, 0.7), bar0 + s * STEP, 0.42, -0.15)

# Bell per letter (2.00 / 2.25 / 2.50 / 2.75) and the ® sparkle (3.5).
for k, note in enumerate(("C5", "E5", "G5", "A5")):
    put("bells", bell(hz(note), 2.2, bright=1.1), 2.0 + k * 0.25, 0.42, (-0.45, -0.15, 0.15, 0.45)[k])
put("bells", bell(hz("E6"), 2.0, bright=0.8), 3.5, 0.28, 0.4)
put("fx", sparkle(11), 3.48, 0.8)

put("bells", bell(hz("D6"), 1.5, bright=0.7), 4.0, 0.2, -0.3)
put("bells", bell(hz("A5"), 1.5, bright=0.7), 5.0, 0.2, 0.3)

# Sonic logo: "ya-nu", C6 -> A5, doubled an octave down.
for at, note in ((6.0, "C6"), (6.5, "A5")):
    put("bells", bell(hz(note), 2.0, bright=1.2), at, 0.45)
    put("bells", bell(hz(note) / 2, 2.0, bright=0.8), at, 0.22)
put("keys", epiano([hz(v) for v in ("F3", "A3", "C4", "E4", "G4")], 1.9), 6.0, 0.28)

# --- Mix -----------------------------------------------------------------------

def reverb(x, seconds=2.2, wet=0.25, seed=7):
    r = np.random.default_rng(seed)
    n = int(seconds * SR); tt = np.arange(n) / SR
    ir = r.standard_normal((2, n)) * np.exp(-tt / (seconds / 6.9))
    ir = np.stack([lp(ir[0], 7000), lp(ir[1], 6500)])
    ir[:, : int(0.012 * SR)] = 0                               # short pre-delay
    ir /= np.sqrt((ir ** 2).sum(axis=1, keepdims=True))
    y = np.stack([signal.fftconvolve(x[c], ir[c])[: x.shape[1]] for c in range(2)])
    return x + wet * y


# Sidechain: pad and keys duck gently under each kick (the "breathing" pump).
duck = np.ones(N)
for b in (1, 2, 3):
    for s in (KICKS if b < 3 else [0, 7]):
        i = int((b * BAR + s * STEP) * SR)
        x = np.arange(N - i) / SR
        duck[i:] *= 1 - 0.45 * np.exp(-x / 0.12)

mix = (
    buses["drums"] * 0.9
    + buses["bass"] * 0.85
    + reverb(buses["pad"] * duck, 2.6, 0.35, 1) * 0.9
    + reverb(buses["keys"] * duck, 1.8, 0.3, 2)
    + reverb(buses["bells"], 2.4, 0.45, 3)
    + reverb(buses["fx"], 1.6, 0.3, 4)
)
mix = hp(mix, 28)
fade = np.clip((DUR - T) / 0.75, 0, 1) ** 1.5                  # bloom, then out by 8.0 s
fade *= np.clip(T / 0.01, 0, 1)
mix *= fade
mix = np.tanh(1.15 * mix / (np.abs(mix).max() + 1e-9)) / np.tanh(1.15)
mix *= 10 ** (-1.0 / 20)                                       # -1 dBFS peak

OUT.parent.mkdir(parents=True, exist_ok=True)
pcm = np.clip(mix.T, -1, 1)
ints = (pcm * (2 ** 23 - 1)).astype("<i4")
raw = np.stack([(ints >> s) & 0xFF for s in (0, 8, 16)], axis=-1).astype(np.uint8).tobytes()
with wave.open(str(OUT), "wb") as w:
    w.setnchannels(2); w.setsampwidth(3); w.setframerate(SR); w.writeframes(raw)
print(f"wrote {OUT.relative_to(ROOT)}  {DUR:.1f} s, peak {np.abs(mix).max():.3f}")
