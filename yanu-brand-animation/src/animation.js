// YANU brand film: a deterministic 5-second timeline.
//
// The photograph is a static <img> and is never touched here. Only the two
// type layers change. `render(t)` is a pure function of time, so the live
// preview and the frame-by-frame export produce the same frames.
//
// Logo choreography (all on the supplied artwork, never redrawn or scaled):
//   1. Letter cascade  y·a·n·u rise one by one out of soft-edged masks,
//                      drawing in from slightly wider tracking and
//                      resolving from a light blur to sharp.
//   2. Ring draw       the ® circle draws itself as a single line from 12
//                      o'clock, then the R resolves inside it.
//   3. Sheen           one soft band of light crosses the finished
//                      wordmark and leaves it untouched.
// Every element ends at exactly its original geometry: masks, filters and
// transforms are removed once each part has landed.
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

// Times in seconds. Logo distances are in the logo's own SVG units
// (viewBox 438.72 × 139.01); the paragraph rise is in pixels of a 1080-line
// frame and scales with the frame.
const TIMELINE = {
  logo: {
    start: 0.40, end: 2.45,
    letters: { start: 0.40, stagger: 0.085, duration: 0.90,
               spread: 7, blur: 3.2, feather: 16 },
    ring:    { start: 1.02, duration: 0.72 },
    mark:    { start: 1.42, duration: 0.50, blur: 1.6 },
    sheen:   { start: 1.62, duration: 0.83, width: 60, strength: 0.42 },
  },
  paragraph: { start: 1.55, end: 2.70, rise: 7 },
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

const easeExpo  = cubicBezier(0.16, 1, 0.3, 1);    // decisive start, long settle
const easeMove  = cubicBezier(0.22, 1, 0.36, 1);
const easeFade  = cubicBezier(0.33, 1, 0.68, 1);
const easeDraw  = cubicBezier(0.65, 0, 0.35, 1);   // ring: in-out, like a pen
const easeSweep = cubicBezier(0.45, 0, 0.55, 1);

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const window01 = (t, start, duration) => clamp01((t - start) / duration);

// --- Paragraph: soft fade and rise. ----------------------------------------
function layerState(name, t) {
  const tl = TIMELINE[name];
  const p = window01(t, tl.start, tl.end - tl.start);
  if (p >= 1) return { opacity: 1, offset: 0 };
  return { opacity: easeFade(p), offset: tl.rise * (1 - easeMove(p)) };
}

// --- Logo rig. ---------------------------------------------------------------
const SVG_NS = "http://www.w3.org/2000/svg";
const el = (tag, attrs = {}) => {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
};

// Turns the supplied logo markup into an animatable rig. The paths keep
// their original `d`, classes and document order; they are only wrapped.
function buildLogo(container, markup) {
  container.innerHTML = markup;
  const svg = container.querySelector("svg");
  const L = TIMELINE.logo;
  const defs = svg.querySelector("defs");

  const letterPaths = [...svg.querySelectorAll("g > g > g > path")];  // y a n u
  const markPath = svg.querySelector("#Layer_1-2 > g > path");          // R
  const ring = svg.querySelector("circle");

  // Each letter: <g mask> (fixed window) > <path transform filter>.
  const letters = letterPaths.map((path, i) => {
    const box = path.getBBox();
    const id = `yanu-l${i}`;
    // Mask window: wide enough for the tracking offset, opaque down to the
    // letter's own bottom edge, then a soft feather below it. The letter
    // starts fully below that edge and rises through the feather.
    const top = box.y - 20, bottom = box.y + box.height, h = bottom + L.letters.feather - top;
    const grad = el("linearGradient", { id: `${id}-g`, gradientUnits: "userSpaceOnUse",
      x1: 0, y1: bottom, x2: 0, y2: bottom + L.letters.feather });
    grad.append(el("stop", { offset: 0, "stop-color": "#fff" }),
                el("stop", { offset: 1, "stop-color": "#000" }));
    const mask = el("mask", { id: `${id}-m`, maskUnits: "userSpaceOnUse",
      x: box.x - 40, y: top, width: box.width + 80, height: h });
    mask.append(el("rect", { x: box.x - 40, y: top, width: box.width + 80, height: h,
      fill: `url(#${id}-g)` }));
    const blur = el("feGaussianBlur", { stdDeviation: 0 });
    const filter = el("filter", { id: `${id}-f`, x: "-40%", y: "-40%", width: "180%", height: "180%" });
    filter.append(blur);
    defs.append(grad, mask, filter);

    const wrap = el("g");
    path.replaceWith(wrap);
    wrap.append(path);
    return { path, wrap, blur, id, drop: bottom - top + L.letters.feather,
             spread: (i - (letterPaths.length - 1) / 2) * L.letters.spread };
  });

  // Ring: drawn with a dash, starting at 12 o'clock and running clockwise.
  // Rotating a circle about its own centre leaves its geometry unchanged.
  const r = +ring.getAttribute("r");
  const ringLen = 2 * Math.PI * r;
  const ringCenter = `${ring.getAttribute("cx")} ${ring.getAttribute("cy")}`;

  const markBlur = el("feGaussianBlur", { stdDeviation: 0 });
  const markFilter = el("filter", { id: "yanu-mark-f", x: "-50%", y: "-50%", width: "200%", height: "200%" });
  markFilter.append(markBlur);
  defs.append(markFilter);

  // Sheen: copies of the artwork filled with a moving band of light, laid
  // over the original. Outside the band the fill is fully transparent.
  const sheenGrad = el("linearGradient", { id: "yanu-sheen", gradientUnits: "userSpaceOnUse" });
  sheenGrad.append(
    el("stop", { offset: 0, "stop-color": "#fff", "stop-opacity": 0 }),
    el("stop", { offset: 0.5, "stop-color": "#fff", "stop-opacity": 1 }),
    el("stop", { offset: 1, "stop-color": "#fff", "stop-opacity": 0 }));
  defs.append(sheenGrad);
  const sheen = el("g", { "pointer-events": "none" });
  for (const p of [...letterPaths, markPath]) sheen.append(el("path", { d: p.getAttribute("d"), fill: "url(#yanu-sheen)" }));
  sheen.append(el("circle", { cx: ring.getAttribute("cx"), cy: ring.getAttribute("cy"), r,
    fill: "none", stroke: "url(#yanu-sheen)", "stroke-width": 3.32 }));
  svg.querySelector("#Layer_1-2").append(sheen);

  return { svg, letters, ring, ringLen, ringCenter, markPath, markBlur, sheen, sheenGrad };
}

function renderLogo(rig, t) {
  const L = TIMELINE.logo;

  rig.letters.forEach((letter, i) => {
    const p = window01(t, L.letters.start + i * L.letters.stagger, L.letters.duration);
    const { path, wrap, blur, id } = letter;
    if (p >= 1) {
      // Landed: exactly the original path, no wrappers in effect.
      wrap.removeAttribute("mask");
      path.removeAttribute("transform");
      path.removeAttribute("filter");
      path.style.opacity = "";
      return;
    }
    const m = 1 - easeExpo(p);
    wrap.setAttribute("mask", `url(#${id}-m)`);
    path.setAttribute("transform", `translate(${letter.spread * m} ${letter.drop * m})`);
    const b = L.letters.blur * (1 - easeFade(clamp01(p / 0.7)));
    if (b > 0.01) { blur.setAttribute("stdDeviation", b); path.setAttribute("filter", `url(#${id}-f)`); }
    else path.removeAttribute("filter");
    path.style.opacity = easeFade(clamp01(p / 0.55));
  });

  // Ring draw.
  const pr = window01(t, L.ring.start, L.ring.duration);
  const { ring } = rig;
  if (pr >= 1) {
    ring.removeAttribute("stroke-dasharray");
    ring.removeAttribute("stroke-dashoffset");
    ring.removeAttribute("transform");
    ring.style.opacity = "";
  } else {
    ring.setAttribute("transform", `rotate(-90 ${rig.ringCenter})`);
    ring.setAttribute("stroke-dasharray", `${rig.ringLen} ${rig.ringLen}`);
    ring.setAttribute("stroke-dashoffset", rig.ringLen * (1 - easeDraw(pr)));
    ring.style.opacity = pr > 0 ? easeFade(clamp01(pr / 0.12)) : 0;
  }

  // R inside the ring.
  const pm = window01(t, L.mark.start, L.mark.duration);
  if (pm >= 1) {
    rig.markPath.removeAttribute("filter");
    rig.markPath.style.opacity = "";
  } else {
    rig.markPath.style.opacity = easeFade(pm);
    rig.markBlur.setAttribute("stdDeviation", L.mark.blur * (1 - easeMove(pm)));
    rig.markPath.setAttribute("filter", "url(#yanu-mark-f)");
  }

  // Sheen: a diagonal band travelling left to right across the wordmark.
  const ps = window01(t, L.sheen.start, L.sheen.duration);
  if (ps <= 0 || ps >= 1) {
    rig.sheen.style.display = "none";
  } else {
    rig.sheen.style.display = "";
    const w = L.sheen.width;
    const c = -w - 40 + (438.72 + 2 * w + 80) * easeSweep(ps);
    const g = rig.sheenGrad;
    g.setAttribute("x1", c - w); g.setAttribute("y1", 70 + w * 0.36);
    g.setAttribute("x2", c + w); g.setAttribute("y2", 70 - w * 0.36);
    // The band swells in and out over its pass.
    rig.sheen.style.opacity = L.sheen.strength * Math.sin(Math.PI * ps);
  }
}

// Apply the state at time t to the DOM layers.
function render(t, layers, stageHeight) {
  renderLogo(layers.logo, t);
  const scale = stageHeight / 1080;
  const { opacity, offset } = layerState("paragraph", t);
  const p = layers.paragraph;
  p.style.opacity = String(opacity);
  p.style.transform = offset === 0 ? "none" : `translate(0, ${offset * scale}px)`;
}

window.YANU = { DURATION, FPS, PHOTO, LAYOUT, TIMELINE, layerState, buildLogo, render };
})();
