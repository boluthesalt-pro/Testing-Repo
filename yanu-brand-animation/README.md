# YANU — 5-second brand film

The campaign photograph stays completely still. The YANU logo rises softly into place, then the paragraph follows, and the composition holds.

| File | What it is |
| --- | --- |
| `out/yanu-brand-film-1920x1090.mp4` | Main delivery · H.264 High · 30 fps · 150 frames · 5.000 s |
| `out/yanu-brand-film-3840x2180.mp4` | Same film at twice the resolution |
| `out/yanu-brand-film-1920x1090-final-frame.png` | End-frame still |
| `out/*-qc.json` | Automated quality-control report for each export |
| `src/index.html` | Live preview, with replay and a scrubber |

### Why 1920 × 1090 and not 1920 × 1080

The photograph is 7772 × 4412, a 1.7615:1 ratio. True 16:9 is 1.7778:1, so a 1920 × 1080 frame would need a crop of about 10 px or a slight stretch. Both are ruled out by the brief. At 1920 px wide, the photo's exact ratio gives 1090 px of height. If a platform strictly needs 1080, letterbox the 1090 file. Don't scale it.

## Timeline (30 fps)

| Time | Frames | Picture |
| --- | --- | --- |
| 0.00–0.40 s | 0–12 | Photograph only, at full opacity |
| 0.40–1.50 s | 12–45 | Logo fades 0 → 100% and rises 12 px (at 1080-line scale) into place |
| 1.25–2.50 s | 38–75 | Paragraph fades 0 → 100% and rises 7 px into place |
| 2.50–5.00 s | 75–149 | Hold. Every frame is byte-identical to the last. |

Easing: position uses `cubic-bezier(0.22, 1, 0.36, 1)`, a long, quiet settle. Opacity uses `cubic-bezier(0.33, 1, 0.68, 1)`. Rise distances scale with the frame, so they are 24 px and 14 px in the 3840 × 2180 file. The timeline and layout are defined in one place, `src/animation.js`.

## How the source is preserved

- **Photograph.** `../Yanu/Asset 54x_1.png` is used as-is and never edited. For each export, it is resampled once (Lanczos) to the output size. That single array is the background of all 150 frames. The PNG's outermost 1 px border is 75% opaque and is flattened onto white. No filter, grade, crop, zoom or pan is applied.
- **Paragraph.** `assets/paragraph.svg` is a byte-for-byte copy of `Yanu/text.svg`.
- **Logo.** `assets/yanu-logo.svg` is `Yanu/yanu logo.svg` with one change. In the original file, the "R" inside the ® circle is live text that needs the Source Sans 3 Bold font, so without that font it falls back to a serif. `tools/outline_logo.py` converts that glyph to a path using the exact font, size and position from the original file. Every other path is unchanged. The font is in `assets/` (SIL OFL).
- Both type layers are vectors. They are only faded and moved vertically, never scaled, rotated or redrawn. The placement follows the approved reference frame: the lockup is centred on the face, and the wordmark is centred over the paragraph.

## Quality control

`tools/composite.py` checks every frame before encoding and stops if any check fails:

- Wherever both type layers are transparent, the frame is byte-identical to the photograph.
- Type pixels appear only inside the two layers' boxes.
- Frames 0–12 are the bare photograph.
- Frames 75–149 are byte-identical to each other.
- The encoded file has exactly 150 frames and runs 5.000 s.

The results are in `out/*-qc.json`. H.264 is a lossy codec, so the encoded MP4 can't be pixel-exact. It is encoded at CRF 12 in BT.709 to keep it visually transparent.

## Preview

Open `src/index.html` in a browser. It works straight from disk, with no server. The film plays once the photo has loaded. Press **Space** or **Replay** to play it again, and drag the slider to scrub. Add `?t=1.2` to the URL to freeze on any moment. The stage keeps the photograph's aspect ratio at every window size, and the type is positioned in % of the photo, so it always stays registered.

## Export

Requires Node with Playwright (Chromium), Python 3 with numpy and Pillow, and ffmpeg.

```bash
cd yanu-brand-animation
NODE_PATH=$(npm root -g) node tools/render.js --size 1920x1090   # transparent type-layer frames
python3 tools/composite.py --size 1920x1090                      # composite, QC, encode MP4
# Any size with the photo's aspect ratio works, e.g. 3840x2180 or 7772x4412 (full resolution).

python3 tools/outline_logo.py   # only if Yanu/yanu logo.svg changes (needs fonttools + brotli)
```

To change the placement or timing, edit `LAYOUT` or `TIMELINE` in `src/animation.js`, then re-run both export steps. The preview picks up changes on reload.
