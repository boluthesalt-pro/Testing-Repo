"""Composite the rendered type layers over the photograph and encode the film.

The photograph is loaded once, flattened and resampled once (Lanczos) to the
output size, and that same array is the background of every frame. Each layer
frame is alpha-composited on top of it; nothing else touches the photo. Before
encoding, every frame is checked:

  * wherever both type layers are fully transparent, the frame is
    byte-identical to the resampled photograph;
  * all type pixels fall inside the two layers' resting boxes (plus their
    rise distance), so nothing leaks onto the photo elsewhere;
  * frames 0-12 (before 0.4 s) are the bare photograph;
  * every frame from 2.5 s to the end is byte-identical to the last one.

    python3 tools/composite.py --size 1920x1090
"""
import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PHOTO = ROOT.parent / "Yanu" / "Asset 54x_1.png"

ap = argparse.ArgumentParser()
ap.add_argument("--size", default="1920x1090")
ap.add_argument("--crf", type=int, default=12)
args = ap.parse_args()
W, H = map(int, args.size.split("x"))
layers_dir = ROOT / "out" / f".layers-{W}x{H}"
name = f"yanu-brand-film-{W}x{H}"

# Timeline and layout come from the same file the browser uses.
js = (ROOT / "src" / "animation.js").read_text()
FPS = int(re.search(r"const FPS = (\d+)", js).group(1))
DURATION = float(re.search(r"const DURATION = ([\d.]+)", js).group(1))
FRAMES = round(FPS * DURATION)
PHOTO_W, PHOTO_H = map(int, re.search(r"PHOTO = \{ width: (\d+), height: (\d+)", js).groups())
layout = {k: dict(x=float(x), y=float(y), w=float(w)) for k, x, y, w in re.findall(
    r"(\w+):\s*\{ x: ([\d.]+), y: ([\d.]+), w: ([\d.]+) \}", js)}
timeline = {k: dict(start=float(a), end=float(b), rise=float(r)) for k, a, b, r in re.findall(
    r"(\w+):\s*\{ start: ([\d.]+), end: ([\d.]+), rise: (\d+) \}", js)}

# The output must keep the photograph's aspect ratio (no crop, no stretch).
if abs(W / H - PHOTO_W / PHOTO_H) > 1 / H:
    sys.exit(f"{W}x{H} does not match the photo's aspect ratio {PHOTO_W}x{PHOTO_H}")

# --- Background: the photograph, flattened and resampled once. ------------
src = Image.open(PHOTO)
assert src.size == (PHOTO_W, PHOTO_H), src.size
# The PNG's outer 1px border is 75% opaque; flatten onto white (the same
# result a browser shows on a white page). Every other pixel is opaque.
flat = Image.new("RGB", src.size, (255, 255, 255))
flat.paste(src, mask=src.getchannel("A"))
if (W, H) == src.size:
    bg = np.asarray(flat)
else:
    bg = np.asarray(flat.resize((W, H), Image.LANCZOS))
bg = bg.copy()
bg.setflags(write=False)

# --- Allowed regions for type pixels. -------------------------------------
svg_aspect = {"logo": 139.01 / 438.72, "paragraph": 70.77 / 672.26}
allowed = np.zeros((H, W), bool)
for k, L in layout.items():
    x0 = (L["x"] - L["w"] / 2) * W
    y0 = L["y"] * H
    bw = L["w"] * W
    bh = bw * svg_aspect[k]
    rise = timeline[k]["rise"] * H / 1080
    allowed[max(0, int(y0) - 1): int(np.ceil(y0 + bh + rise)) + 2,
            max(0, int(x0) - 1): int(np.ceil(x0 + bw)) + 2] = True

# --- Encode. -------------------------------------------------------------
mp4 = ROOT / "out" / f"{name}.mp4"
ff = subprocess.Popen([
    "ffmpeg", "-y", "-loglevel", "error",
    "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
    "-vf", "scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int,format=yuv420p",
    "-c:v", "libx264", "-preset", "slow", "-crf", str(args.crf), "-tune", "film",
    "-profile:v", "high", "-g", str(FPS), "-bf", "2",
    "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
    "-movflags", "+faststart", "-r", str(FPS), "-frames:v", str(FRAMES),
    str(mp4),
], stdin=subprocess.PIPE)

report = {"size": f"{W}x{H}", "fps": FPS, "frames": FRAMES, "checks": {}}
last = None
hold_from = round(max(t["end"] for t in timeline.values()) * FPS)
first_reveal = round(min(t["start"] for t in timeline.values()) * FPS)
photo_untouched_px = []
for i in range(FRAMES):
    layer = np.asarray(Image.open(layers_dir / f"{i:04d}.png").convert("RGBA"))
    assert layer.shape == (H, W, 4), layer.shape
    a = layer[..., 3:4].astype(np.float32) / 255
    frame = np.rint(layer[..., :3] * a + bg * (1 - a)).astype(np.uint8)

    covered = layer[..., 3] > 0
    assert not (covered & ~allowed).any(), f"frame {i}: type pixels outside their boxes"
    assert np.array_equal(frame[~covered], bg[~covered]), f"frame {i}: photo changed"
    photo_untouched_px.append(int((~covered).sum()))
    if i <= first_reveal:
        assert np.array_equal(frame, bg), f"frame {i}: should be the bare photograph"
    if i == FRAMES - 1:
        Image.fromarray(frame).save(ROOT / "out" / f"{name}-final-frame.png")
    if i >= hold_from:
        if last is not None:
            assert np.array_equal(frame, last), f"frame {i}: hold is not static"
        last = frame
    ff.stdin.write(frame.tobytes())
ff.stdin.close()
if ff.wait():
    sys.exit("ffmpeg failed")

report["checks"] = {
    "photo_identical_outside_type_every_frame": True,
    "type_confined_to_layer_boxes": True,
    f"frames_0_to_{first_reveal}_are_bare_photo": True,
    f"frames_{hold_from}_to_{FRAMES - 1}_byte_identical": True,
    "min_untouched_photo_pixels_per_frame": min(photo_untouched_px),
    "type_box_area_fraction": round(float(allowed.mean()), 4),
}
probe = json.loads(subprocess.check_output([
    "ffprobe", "-v", "error", "-select_streams", "v:0", "-count_frames",
    "-show_entries", "stream=codec_name,profile,width,height,r_frame_rate,nb_read_frames,pix_fmt",
    "-show_entries", "format=duration", "-of", "json", str(mp4)]))
report["mp4"] = {**probe["streams"][0], "duration": probe["format"]["duration"],
                 "file": mp4.name, "bytes": mp4.stat().st_size}
assert int(probe["streams"][0]["nb_read_frames"]) == FRAMES
print(json.dumps(report, indent=2))
(ROOT / "out" / f"{name}-qc.json").write_text(json.dumps(report, indent=2) + "\n")
