// Renders the two type layers, frame by frame, as transparent PNGs.
//
// The page is loaded in export mode (`index.html?export`): no controls and no
// photograph, just the logo and paragraph on a transparent stage the size of
// the output frame. It also saves `reference.png`, the supplied artwork shown
// statically at rest, which the final animated frame must match.
// tools/composite.py then lays these over the untouched photograph and
// encodes the video.
//
//   NODE_PATH=$(npm root -g) node tools/render.js [--size 1920x1090] [--out DIR]

const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : fallback;
};

const [width, height] = arg("--size", "1920x1090").split("x").map(Number);
const outDir = path.resolve(arg("--out", path.join(ROOT, "out", `.layers-${width}x${height}`)));

(async () => {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const url = pathToFileURL(path.join(ROOT, "src", "index.html")).href + "?export";
  await page.goto(url);
  await page.evaluate(() => window.layersReady);

  const { DURATION, FPS } = await page.evaluate(() => window.YANU);
  const frames = Math.round(DURATION * FPS);
  for (let i = 0; i < frames; i++) {
    await page.evaluate((t) => window.setTime(t), i / FPS);
    await page.screenshot({
      path: path.join(outDir, `${String(i).padStart(4, "0")}.png`),
      omitBackground: true,
    });
  }
  // Reference: the supplied artwork at rest, untouched, for the end-frame QC.
  await page.goto(url + "&static");
  await page.evaluate(() => window.layersReady);
  await page.screenshot({ path: path.join(outDir, "reference.png"), omitBackground: true });

  await browser.close();
  console.log(`${frames} layer frames at ${width}x${height} -> ${path.relative(ROOT, outDir)}`);
})();
