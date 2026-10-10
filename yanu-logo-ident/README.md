# YANU — 8-second logo ident

A simple reveal of the YANU logo, in Chocolate Melange on Peach Glow only. It is one continuous camera move over the logo itself: macro curves, then the full wordmark on the drop. An original half-time R&B groove sets the pace.

| File | Format |
| --- | --- |
| `out/yanu-logo-ident-1920x1080.mp4` | 16:9 · H.264 + AAC 320 kbps · 30 fps · 240 frames · 8.000 s |
| `out/yanu-logo-ident-1080x1350.mp4` | 4:5 (Instagram feed) · same spec |
| `out/*-final-frame.png` | End-frame stills |
| `out/yanu-ident-score.wav` | The score on its own (48 kHz / 24-bit stereo) |
| `src/index.html` | Live preview with sound, a 16:9 / 4:5 toggle and a scrubber |

Colours: Peach Glow `#FFDDAC` (ground) and Chocolate Melange `#2F0F03` (logo).

## Picture and sound (120 BPM, half-time feel)

| Time | Picture | Sound |
| --- | --- | --- |
| 0–2 s | **Macro.** We open extremely close, so the logo's curves fill the frame as abstract chocolate shapes. The camera drifts slowly from the curve of the "y" into the round bowl of the "a". | A breathy "ooh" choir opens up from a dark filter, with glass bells and finger snaps. A silk swell rises into the drop. |
| 2.0–3.3 s | **The reveal.** On the drop, one smooth pull-back reveals the whole wordmark and lands softly. | Kick, sub bass and groove come in, with a rising bell arpeggio (C5 · E5 · G5 · A5) over the move. |
| 3.05–3.5 s | The **® ring** draws itself from 12 o'clock, and the R settles in. | A clap on the backbeat, then a soft chime. |
| 3.3–8.0 s | Hold, with a slow 3% push-in. | Full groove with electric-piano stabs. |
| 6.0–6.9 s | One soft peach sheen crosses the logo. | Sonic logo "ya-nu": C6 → A5, then the music blooms and fades out by 8.0 s. |

The camera's zoom is interpolated in log space, so the move feels even from macro to full frame. The logo is drawn only from the supplied artwork's path data (`../yanu-brand-animation/src/logo.js`), as vectors, so it stays razor-sharp even at 15× zoom. It is never redrawn or distorted.

The film has real motion blur. Each frame averages 6 sub-frames across a 180° shutter, and 24 during the pull-back.

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

The camera keyframes and timings are in `TIMELINE` at the top of `src/ident.js`, and the music's hit times are listed at the top of `tools/score.py`. Keep the two in step.
