# YANU — 8-second logo ident

A sensual, beat-driven reveal of the YANU logo, scored with an original half-time R&B groove. It uses only the three brand colours.

| File | Format |
| --- | --- |
| `out/yanu-logo-ident-1920x1080.mp4` | 16:9 · H.264 + AAC 320 kbps · 30 fps · 240 frames · 8.000 s |
| `out/yanu-logo-ident-1080x1350.mp4` | 4:5 (Instagram feed) · same spec |
| `out/*-final-frame.png` | End-frame stills |
| `out/yanu-ident-score.wav` | The score on its own (48 kHz / 24-bit stereo) |
| `src/index.html` | Live preview with sound, a 16:9 / 4:5 toggle and a scrubber |

## Brand colours

| Colour | Hex | Role in the film |
| --- | --- | --- |
| Chocolate Melange | `#2F0F03` | The ground: depth and intimacy. Opens and closes the film. |
| Peach Glow | `#FFDDAC` | The logo, the silk highlights and the second wipe. |
| Romantic Orange | `#FAAA48` | The silk ribbon, the letter echoes, the glow and the first wipe. |

## Picture and sound, beat by beat (120 BPM, half-time feel)

| Time | Picture | Sound |
| --- | --- | --- |
| 0.0–2.0 s | A silk ribbon of 16 orange and peach strands sweeps through the frame in an S-curve, twisting as it flows. Soft bokeh drifts up through a warm glow. The ribbon pinches closed as it leaves. | A breathy "ooh" choir on B♭maj9 opens up from a dark low-pass filter, with glass bells and finger snaps. A silk swell rises into the drop. |
| 2.0 s | **The drop.** A peach bloom flashes. | Kick, sub bass and the groove come in. |
| 2.00 / 2.25 / 2.50 / 2.75 s | **y · a · n · u** pop in, one per eighth note. Each springs up from the baseline with a soft overshoot and a slight sway. An orange echo leads it in and an orange ripple spreads out behind it. | One bell per letter: C5 · E5 · G5 · A5 (Am7). |
| 2.95–3.4 s | The **® ring** draws itself, from 12 o'clock clockwise. | Clap on the backbeat. |
| 3.5 s | The **R** pops into the ring with a burst of four-point sparkles. | A sparkle chime. |
| 4.0 · 5.0 · 6.0 s | **Colour wipes** on the beat. The frame blooms from the logo outward: orange (chocolate logo), then peach (chocolate logo), then back to chocolate (peach logo). The logo changes colour exactly at the wipe's edge, and a fine ring rides each edge. The logo breathes on every kick. | A silk whoosh lands on each wipe, over electric-piano stabs (Gm9). |
| 6.15–7.25 s | A **silk flourish** draws itself under the logo, like a signature, and stays. A **sheen** of light crosses the logo. | **Sonic logo** "ya-nu": C6 → A5 on 6.0 and 6.5 s, over Fmaj9. |
| 7.0 s | Sparkles land across the wordmark. A slow push-in settles before the end. | A last sparkle, then the music blooms and fades out by 8.0 s. |

## Rules the motion keeps

- The logo is drawn only from the supplied artwork's path data (`../yanu-brand-animation/src/logo.js`). It is never redrawn, re-typed or distorted, and it lands exactly on its original shapes.
- The spring is gentle, with a single overshoot of about 9%. Nothing bounces twice.
- Every hit lands on the music's 16th-note grid (`tools/score.py` and `src/ident.js` share the same timings).
- Real motion blur: each frame averages 6 sub-frames across a 180° shutter, rising to 24 in the fastest moments (letter pops, ring, wipes), so the motion stays smooth and never strobes.

## Preview

Open `src/index.html` in a browser. It works straight from disk, with no server. Press **Play with sound** or **Space**. Use **16:9 / 4:5** to switch formats, and drag the slider to scrub. Some browsers block audio from local files; if yours does, run `npx serve ..` from this folder and open `/yanu-logo-ident/src/index.html`.

## Export

Requires Node with Playwright (Chromium), Python 3 with numpy, scipy and Pillow, and ffmpeg.

```bash
cd yanu-logo-ident
python3 tools/score.py                                        # music -> out/yanu-ident-score.wav
NODE_PATH=$(npm root -g) node tools/render.js --size 1920x1080 # motion-blur sub-frames
python3 tools/encode.py --size 1920x1080                      # average, add music, encode MP4
# Repeat the last two lines with --size 1080x1350 (or any other size).
```

To retime or restyle, edit `TIMELINE` and the colours at the top of `src/ident.js`. To change the music, edit `tools/score.py` (chords, notes and hit times are listed at the top), and keep the two in step.
