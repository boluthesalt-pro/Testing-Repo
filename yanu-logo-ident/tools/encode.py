"""Average the motion-blur sub-frames, add the score and encode the ident.

    python3 tools/score.py                       # out/yanu-ident-score.wav
    python3 tools/encode.py --size 1920x1080     # after tools/render.js
"""
import argparse
import json
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ap = argparse.ArgumentParser()
ap.add_argument("--size", default="1920x1080")
ap.add_argument("--crf", type=int, default=14)
args = ap.parse_args()

frames_dir = ROOT / "out" / f".frames-{args.size}"
meta = json.loads((frames_dir / "meta.json").read_text())
W, H, FPS, FRAMES, SUBS = meta["W"], meta["H"], meta["FPS"], meta["frames"], meta["subs"]
score = ROOT / "out" / "yanu-ident-score.wav"
mp4 = ROOT / "out" / f"yanu-logo-ident-{W}x{H}.mp4"

ff = subprocess.Popen([
    "ffmpeg", "-y", "-loglevel", "error",
    "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
    "-i", str(score),
    "-vf", "scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int,format=yuv420p",
    "-c:v", "libx264", "-preset", "slow", "-crf", str(args.crf), "-tune", "animation",
    "-profile:v", "high", "-colorspace", "bt709", "-color_primaries", "bt709",
    "-color_trc", "bt709", "-color_range", "tv",
    "-c:a", "aac", "-b:a", "320k", "-ar", "48000",
    "-frames:v", str(FRAMES), "-t", str(FRAMES / FPS), "-movflags", "+faststart", str(mp4),
], stdin=subprocess.PIPE)

rng = np.random.default_rng(0)
for f in range(FRAMES):
    acc = np.zeros((H, W, 3), np.float64)
    for s in range(SUBS[f]):
        acc += np.asarray(Image.open(frames_dir / f"{f:04d}-{s}.png").convert("RGB"), np.float64)
    acc /= SUBS[f]
    # Light random dither before quantising, so the soft glows don't band.
    acc += rng.uniform(-0.5, 0.5, acc.shape)
    frame = np.clip(np.rint(acc), 0, 255).astype(np.uint8)
    if f == FRAMES - 1:
        Image.fromarray(frame).save(ROOT / "out" / f"yanu-logo-ident-{W}x{H}-final-frame.png")
    ff.stdin.write(frame.tobytes())
ff.stdin.close()
assert ff.wait() == 0, "ffmpeg failed"

probe = json.loads(subprocess.check_output([
    "ffprobe", "-v", "error", "-count_frames", "-show_entries",
    "stream=codec_type,codec_name,width,height,r_frame_rate,nb_read_frames,sample_rate,channels",
    "-show_entries", "format=duration", "-of", "json", str(mp4)]))
print(json.dumps(probe, indent=1))
