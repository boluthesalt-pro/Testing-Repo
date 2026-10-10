// Renders the ident frame by frame with true motion blur.
//
// Each output frame is the average of several sub-frames spread across a 180°
// shutter (half a frame), centred on the frame time: 6 normally, 24 in the
// FAST windows from ident.js (letter pops, ring, wipes), where a few samples
// would show as steps. Sub-frames are written as PNGs; tools/encode.py
// averages them, adds the score and encodes the MP4.
//
//   NODE_PATH=$(npm root -g) node tools/render.js --size 1920x1080 [--sub 6 --fast-sub 24]

const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const size = arg("--size", "1920x1080");
const SUB = Number(arg("--sub", 6));
const FAST_SUB = Number(arg("--fast-sub", 24));
const SHUTTER = 0.5;
const [W, H] = size.split("x").map(Number);
const outDir = path.join(ROOT, "out", `.frames-${size}`);

(async () => {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => { console.error(e); process.exit(1); });
  await page.goto(pathToFileURL(path.join(ROOT, "src", "index.html")).href + `?export&size=${size}`);
  const { DURATION, FPS, FAST } = await page.evaluate(() => window.YANU_IDENT);
  const frames = Math.round(DURATION * FPS);
  const subs = [];
  for (let f = 0; f < frames; f++) {
    const t0 = f / FPS;
    const n = FAST.some(([a, b]) => t0 >= a - 1 / FPS && t0 <= b) ? FAST_SUB : SUB;
    subs.push(n);
    for (let s = 0; s < n; s++) {
      // Sub-frame times within the shutter, clamped to the film.
      const dt = n === 1 ? 0 : ((s + 0.5) / n - 0.5) * SHUTTER / FPS;
      const t = Math.min(Math.max(f / FPS + dt, 0), DURATION);
      await page.evaluate((t) => window.setTime(t), t);
      await page.screenshot({ path: path.join(outDir, `${String(f).padStart(4, "0")}-${s}.png`) });
    }
    if (f % 30 === 0) process.stdout.write(`${size}: frame ${f}/${frames}\n`);
  }
  await browser.close();
  fs.writeFileSync(path.join(outDir, "meta.json"), JSON.stringify({ W, H, FPS, frames, subs }));
})();
