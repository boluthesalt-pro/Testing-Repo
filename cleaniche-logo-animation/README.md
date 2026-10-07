# Cleaniche — "One Clean Sweep"

A 10-second logo ident with an original sound design and a 3-note sonic logo.

| File | Format |
| --- | --- |
| `out/cleaniche-logo-animation-3840x2160.mp4` | 16:9 · 4K master |
| `out/cleaniche-logo-animation-2160x2700.mp4` | 4:5 · 4K master |
| `out/cleaniche-logo-animation-1920x1080.mp4` | 16:9 · 1080p |
| `out/cleaniche-logo-animation-1080x1350.mp4` | 4:5 · 1080 wide (Instagram feed) |
| `out/*-final-frame.png` | End-frame stills |
| `out/sound.wav` | Sound design on its own (48 kHz / 24-bit) |

All videos are 30 fps, H.264 with AAC stereo audio, and have true motion blur (6 sub-frames per frame, 180° shutter).

## The idea

The Cleaniche symbol is a single ribbon that spirals inward. The ident turns that into one gesture: **a single clean sweep**.

We open on a pure white frame, an empty clean space. The ribbon's edge sweeps through the frame in extreme macro, and teal floods the screen. One continuous pull-back then shows that the sweep was drawing the mark all along. The ribbon goes around the ring and splits into the two inner waves, which rejoin to close the symbol. The mark lands with a soft spring, slides aside, and the wordmark emerges from behind it. The tagline rises word by word. Its final full stop is the only orange in the piece, and it lands on the last note of the sonic logo.

The ident is built on principles that separate strong idents from template reveals:

- The motion comes from the logo's own geometry, not from added effects. There are no particles, flares or splashes.
- The timing has contrast: stillness, a decisive sweep, a long silky settle, then a real hold.
- It reads with the sound off, and the end frame stands alone.
- The sonic logo is short and simple (three notes) and lands on the key visual beat.

## Timeline

| Time | Picture | Sound |
| --- | --- | --- |
| 0.0–0.6 | White. A clean space. | Silence |
| 0.6–1.0 | The ribbon's edge sweeps through in extreme macro, and teal floods the frame. | A close, soft swoosh with a gentle low body |
| 1.0–4.1 | One continuous pull-back, from about 118× down to 1×. The ribbon draws the ring, splits at the inner arc into the two waves, and they rejoin to close the mark. The leading edge glows slightly brighter. | Air that opens up and travels around the stereo field with the ribbon, over a low drone and a rising D-major shimmer |
| 4.1 | The mark lands with a ~3% spring past rest, then settles. | A warm bloom: felt sub, soft glass chord, riser cut clean |
| 4.55–5.85 | The symbol slides into the lockup, and the wordmark emerges from behind it. | A short, silky air pass, left to right |
| 5.6 · 6.1 · 7.0 | The wordmark settles. "Clean spaces." rises. "Clear mindset" rises, and the orange full stop drops in. | **Sonic logo**: glass-mallet A5 · E6 · D6, resolving on D |
| 7.0–10.0 | Hold, with a slow 2% push that settles before the end. | A soft D(add9) resolve, then true silence from about 9.8 s |

## Brand

- **Logo:** drawn only from the supplied path data (`assets/cleaniche-logo-outlined.svg`). It is never redrawn or distorted, and is shown complete and exact from 4.1 s on.
- **Colours:** brand teal **#067593** for the mark, on white. Dark Navy **#0D2B2F** for the tagline. One orange **#FF621D** full stop.
- **Type:** the tagline is Figtree Medium (`assets/figtree-latin-wght-normal.woff2`, SIL OFL), set in sentence case: *Clean spaces. Clear mindset.*

## How it's built

- `src/ident.js` is a deterministic renderer: `draw(t)` paints the frame at time *t*. The camera, sweep and type use monotone splines and CSS-style cubic-bezier curves.
- **The sweep reveal** uses `src/reveal.png`, a precomputed "sweep-order" field built by `tools/reveal.py` from the symbol's centreline (`src/routes.json`). A WebGL shader thresholds it each frame, so the exact supplied shape is revealed in sweep order. Junctions where the ribbon merges stay clean, and the front stays straight even at 118× zoom.
- **The centreline** was extracted from the supplied artwork by `tools/skel.py` → `tools/branches.py` → `tools/routes.py`.
- `tools/score.py` synthesises the sound: FM glass mallets, shaped noise, drones and a plate-style reverb (numpy + scipy).
- `tools/render.js` drives headless Chromium through Playwright, averages sub-frames for motion blur, and pipes PNG frames into ffmpeg.

```bash
python3 tools/reveal.py          # only if routes.json changes
python3 tools/score.py           # sound
NODE_PATH=$(npm root -g) node tools/render.js                       # all four sizes
NODE_PATH=$(npm root -g) node tools/render.js --size 7680x4320      # 8K, if ever needed
NODE_PATH=$(npm root -g) node tools/render.js --stills 1,4.2,9.9 --blur 1   # quick review stills
npx serve .   # then open /src/index.html for a live preview with sound
```
