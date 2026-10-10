// YANU brand film: a deterministic 5-second timeline.
//
// The photograph is a static <img> and is never touched here. Only the two
// type layers change, and only their opacity and a small vertical offset.
// `render(t)` is a pure function of time, so the live preview and the
// frame-by-frame export produce the same frames.
//
// Plain script (no modules) so index.html also works straight from disk.

(function () {

const DURATION = 5;
const FPS = 30;

// Source photograph, in pixels. All layout is expressed as fractions of it,
// so the layers stay registered to the picture at any display size.
const PHOTO = { width: 7772, height: 4412 };

// Final (resting) placement of each layer as a fraction of the photo:
// x = horizontal centre, y = top edge, w = width. Heights follow from each
// SVG's own aspect ratio, so the artwork is never stretched. Matches the
// approved reference frame: the lockup centred on the face, logo over the
// lips and cheek, paragraph beneath. The logo box sits slightly right of the
// paragraph's centre so the wordmark itself (not wordmark plus ®) is
// optically centred over the text.
const LAYOUT = {
  logo:      { x: 0.5105, y: 0.384, w: 0.229 },
  paragraph: { x: 0.4990, y: 0.5435, w: 0.3515 },
};

// Motion. Rise distances are in pixels of a 1080-line frame and scale with
// the frame, so the motion looks the same at every output size.
const TIMELINE = {
  logo:      { start: 0.40, end: 1.50, rise: 12 },
  paragraph: { start: 1.25, end: 2.50, rise: 7 },
};

// CSS-style cubic-bezier, solved with Newton steps and a bisection fallback.
function cubicBezier(x1, y1, x2, y2) {
  const ax = 3 * x1 - 3 * x2 + 1, bx = 3 * x2 - 6 * x1, cx = 3 * x1;
  const ay = 3 * y1 - 3 * y2 + 1, by = 3 * y2 - 6 * y1, cy = 3 * y1;
  const sx = (u) => ((ax * u + bx) * u + cx) * u;
  const sy = (u) => ((ay * u + by) * u + cy) * u;
  const dx = (u) => (3 * ax * u + 2 * bx) * u + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let u = x;
    for (let i = 0; i < 8; i++) {
      const err = sx(u) - x, d = dx(u);
      if (Math.abs(err) < 1e-7) return sy(u);
      if (Math.abs(d) < 1e-6) break;
      u -= err / d;
    }
    let lo = 0, hi = 1;
    u = x;
    for (let i = 0; i < 40; i++) {
      if (sx(u) < x) lo = u; else hi = u;
      u = (lo + hi) / 2;
    }
    return sy(u);
  };
}

// Long, quiet settle for position; slightly softer curve for opacity so the
// type never "pops" in.
const easeMove = cubicBezier(0.22, 1, 0.36, 1);
const easeFade = cubicBezier(0.33, 1, 0.68, 1);

const progress = (t, { start, end }) =>
  t <= start ? 0 : t >= end ? 1 : (t - start) / (end - start);

// State of one layer at time t. At and after `end` this is exactly
// { opacity: 1, offset: 0 }: the resting position, with no rounding drift.
function layerState(name, t) {
  const p = progress(t, TIMELINE[name]);
  if (p >= 1) return { opacity: 1, offset: 0 };
  return {
    opacity: easeFade(p),
    offset: TIMELINE[name].rise * (1 - easeMove(p)), // px @1080, downward
  };
}

// Apply the state at time t to the DOM layers.
function render(t, layers, stageHeight) {
  const scale = stageHeight / 1080;
  for (const name of Object.keys(layers)) {
    const { opacity, offset } = layerState(name, t);
    const el = layers[name];
    el.style.opacity = String(opacity);
    el.style.transform = offset === 0 ? "none" : `translate(0, ${offset * scale}px)`;
  }
}

window.YANU = { DURATION, FPS, PHOTO, LAYOUT, TIMELINE, layerState, render };
})();
