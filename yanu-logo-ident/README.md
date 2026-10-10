# YANU — 8-second logo ident

A simple, calm reveal of the YANU logo: Peach Glow on Chocolate Melange, nothing else. An original half-time R&B groove carries the energy, and the picture stays quiet.

| File | Format |
| --- | --- |
| `out/yanu-logo-ident-1920x1080.mp4` | 16:9 · H.264 + AAC 320 kbps · 30 fps · 240 frames · 8.000 s |
| `out/yanu-logo-ident-1080x1350.mp4` | 4:5 (Instagram feed) · same spec |
| `out/*-final-frame.png` | End-frame stills |
| `out/yanu-ident-score.wav` | The score on its own (48 kHz / 24-bit stereo) |
| `src/index.html` | Live preview with sound, a 16:9 / 4:5 toggle and a scrubber |

Colours: Chocolate Melange `#2F0F03` (ground) and Peach Glow `#FFDDAC` (logo and hairline).

## Picture and sound (120 BPM, half-time feel)

| Time | Picture | Sound |
| --- | --- | --- |
| 0.3–1.9 s | A single peach hairline draws out from the centre along the logo's baseline. | A breathy "ooh" choir opens up from a dark filter, with glass bells and finger snaps. A silk swell rises into the drop. |
| 2.00 / 2.25 / 2.50 / 2.75 s | **y · a · n · u** rise softly into place, one per eighth note, going from a light blur to sharp. The hairline fades beneath them. | The drop: kick, sub bass and groove come in, with one bell per letter (C5 · E5 · G5 · A5). |
| 2.95–3.5 s | The **® ring** draws itself from 12 o'clock, and the R settles in. | Clap on the backbeat, then a soft chime. |
| 3.5–8.0 s | Hold, with a slow 4% push-in. | Full groove with electric-piano stabs. |
| 6.0–6.9 s | One soft sheen of light crosses the logo. | Sonic logo "ya-nu": C6 → A5 on 6.0 and 6.5 s, then the music blooms and fades out by 8.0 s. |

The logo is drawn only from the supplied artwork's path data (`../yanu-brand-animation/src/logo.js`). It is never redrawn or distorted, and it lands exactly on its original shapes.

The film has real motion blur. Each frame averages 6 sub-frames across a 180° shutter, and 24 while the letters arrive.

## Preview

Open `src/index.html` in a browser. It works straight from disk, with no server. Press **Play with sound** or **Space**. Use **16:9 / 4:5** to switch formats, and drag the slider to scrub. Some browsers block audio from local files; if yours does, run `npx serve ..` from this folder and open `/yanu-logo-ident/src/index.html`.

## Export

Requires Node with Playwright (Chromium), Python 3 with numpy, scipy and Pillow, and ffmpeg.

```bash
cd yanu-logo-ident
python3 tools/score.py                                         # music -> out/yanu-ident-score.wav
NODE_PATH=$(npm root -g) node tools/render.js --size 1920x1080 # motion-blur sub-frames
python3 tools/encode.py --size 1920x1080                       # average, add music, encode MP4
# Repeat the last two lines with --size 1080x1350 (or any other size).
```

The timings are in `TIMELINE` at the top of `src/ident.js`, and the music's hit times are listed at the top of `tools/score.py`. Keep the two in step.
