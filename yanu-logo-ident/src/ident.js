// YANU logo ident: 8 s, 120 BPM, four bars of 2 s (see tools/score.py).
//
// Two colours only: Peach Glow on Chocolate Melange. The music carries the
// energy; the picture stays calm.
//
//   0.3-1.9 s  A single peach hairline draws out from the centre along the
//              logo's baseline.
//   2.0 s      The drop. y · a · n · u rise softly into place on the eighth
//              notes (2.00 / 2.25 / 2.50 / 2.75 s), sharpening as they land.
//              The hairline fades away beneath them.
//   2.95 s     The ® ring draws itself; the R settles in on 3.5 s.
//   3.5-8 s    Hold, with a slow push-in. One soft sheen crosses the logo on
//              the sonic logo (6.0-6.9 s).
//
// render(t) is a pure function of time; the exporter calls it per sub-frame.
// The logo is drawn only from the supplied artwork's path data
// (../../yanu-brand-animation/src/logo.js) and lands exactly on it.

(function () {
const DURATION = 8, FPS = 30, BPM = 120;
const C = { choc: "#2F0F03", peach: "#FFDDAC" };

// Logo geometry, in the logo's SVG units (viewBox 438.72 × 139.01).
const LOGO_W = 438.72;
const ORIGIN = { x: 200.1, y: 64 };   // optical centre: wordmark without ®
const BASELINE = 94;

const T = {
  line: { draw: [0.30, 1.90], fade: [2.55, 3.30] },
  letters: { at: [2.0, 2.25, 2.5, 2.75], dur: 0.95, rise: 34, blur: 3 },
  ring: [2.95, 3.45],
  mark: { at: 3.45, dur: 0.6 },
  push: [3.0, 8.0],
  sheen: [6.0, 6.9],
};

// --- Easing --------------------------------------------------------------------
function cubicBezier(x1, y1, x2, y2) {
  const ax = 3 * x1 - 3 * x2 + 1, bx = 3 * x2 - 6 * x1, cx = 3 * x1;
  const ay = 3 * y1 - 3 * y2 + 1, by = 3 * y2 - 6 * y1, cy = 3 * y1;
  const sx = (u) => ((ax * u + bx) * u + cx) * u, sy = (u) => ((ay * u + by) * u + cy) * u;
  return (x) => {
    if (x <= 0) return 0; if (x >= 1) return 1;
    let lo = 0, hi = 1, u = x;
    for (let i = 0; i < 30; i++) { if (sx(u) < x) lo = u; else hi = u; u = (lo + hi) / 2; }
    return sy(u);
  };
}
const easeOut = cubicBezier(0.16, 1, 0.3, 1);      // long, quiet settle
const easeFade = cubicBezier(0.33, 1, 0.68, 1);
const easeInOut = cubicBezier(0.65, 0, 0.35, 1);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const prog = (t, [a, b]) => clamp01((t - a) / (b - a));

// --- SVG helpers -----------------------------------------------------------------
const NS = "http://www.w3.org/2000/svg";
function el(tag, attrs = {}, parent) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (parent) parent.append(n);
  return n;
}
const set = (n, attrs) => { for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); };

function logoParts(markup) {
  const doc = new DOMParser().parseFromString(markup, "image/svg+xml");
  const letters = [...doc.querySelectorAll("g > g > g > path")].map((p) => p.getAttribute("d"));
  const mark = doc.querySelector("#Layer_1-2 > g > path").getAttribute("d");
  const c = doc.querySelector("circle");
  return { letters, mark, ring: { cx: +c.getAttribute("cx"), cy: +c.getAttribute("cy"), r: +c.getAttribute("r"), w: 3.32 } };
}

// --- Build -----------------------------------------------------------------------
function build(root, W, H, markup) {
  const parts = logoParts(markup);
  const logoPx = Math.min(0.62 * W, 0.62 * H);
  const svg = el("svg", { xmlns: NS, viewBox: `0 0 ${W} ${H}`, width: W, height: H }, root);
  const defs = el("defs", {}, svg);

  el("rect", { width: W, height: H, fill: C.choc }, svg);

  const sheenG = el("linearGradient", { id: "sheen", gradientUnits: "userSpaceOnUse" }, defs);
  for (const [o, a] of [[0, 0], [0.5, 1], [1, 0]])
    el("stop", { offset: o, "stop-color": "#FFF4E4", "stop-opacity": a }, sheenG);

  const logo = el("g", { fill: C.peach }, svg);
  const line = el("line", { y1: BASELINE + 6, y2: BASELINE + 6, stroke: C.peach,
    "stroke-width": 1.1, "stroke-linecap": "round" }, logo);

  const letters = parts.letters.map((d, i) => {
    const path = el("path", { d }, logo);
    const blur = el("feGaussianBlur", { stdDeviation: 0 });
    const f = el("filter", { id: `b${i}`, x: "-30%", y: "-30%", width: "160%", height: "160%" }, defs);
    f.append(blur);
    return { path, blur, id: `b${i}` };
  });
  const ring = el("circle", { cx: parts.ring.cx, cy: parts.ring.cy, r: parts.ring.r, fill: "none",
    stroke: C.peach, "stroke-width": parts.ring.w }, logo);
  const mark = el("path", { d: parts.mark }, logo);
  const markBlur = el("feGaussianBlur", { stdDeviation: 0 });
  el("filter", { id: "bm", x: "-50%", y: "-50%", width: "200%", height: "200%" }, defs).append(markBlur);

  const sheen = el("g", { fill: "url(#sheen)" }, logo);
  for (const d of [...parts.letters, parts.mark]) el("path", { d }, sheen);
  el("circle", { cx: parts.ring.cx, cy: parts.ring.cy, r: parts.ring.r, fill: "none",
    stroke: "url(#sheen)", "stroke-width": parts.ring.w }, sheen);

  return { W, H, k: logoPx / LOGO_W, logo, line, letters, ring, ringLen: 2 * Math.PI * parts.ring.r,
           mark, markBlur, sheen, sheenG, parts };
}

// --- Render ----------------------------------------------------------------------
function render(R, t) {
  const push = 1 + 0.04 * easeInOut(prog(t, T.push));
  R.logo.setAttribute("transform",
    `translate(${R.W / 2} ${R.H / 2}) scale(${R.k * push}) translate(${-ORIGIN.x} ${-ORIGIN.y})`);

  // Hairline: draws out from the centre, then fades as the letters land.
  const pl = easeInOut(prog(t, T.line.draw));
  const half = 220 * pl;
  set(R.line, { x1: ORIGIN.x - half, x2: ORIGIN.x + half,
    opacity: pl > 0 ? 0.85 * (1 - easeInOut(prog(t, T.line.fade))) : 0 });

  // Letters: rise, fade in and sharpen; exactly the original shape once landed.
  R.letters.forEach((L, i) => {
    const p = clamp01((t - T.letters.at[i]) / T.letters.dur);
    if (p >= 1) {
      L.path.removeAttribute("transform"); L.path.removeAttribute("filter"); L.path.style.opacity = "";
      return;
    }
    L.path.setAttribute("transform", `translate(0 ${T.letters.rise * (1 - easeOut(p))})`);
    L.path.style.opacity = easeFade(clamp01(p / 0.6));
    const b = T.letters.blur * (1 - easeFade(clamp01(p / 0.7)));
    if (b > 0.01) { L.blur.setAttribute("stdDeviation", b); L.path.setAttribute("filter", `url(#${L.id})`); }
    else L.path.removeAttribute("filter");
  });

  // ® ring draws on from 12 o'clock; the R settles in.
  const pr = easeInOut(prog(t, T.ring));
  if (pr >= 1) {
    for (const a of ["stroke-dasharray", "stroke-dashoffset", "transform"]) R.ring.removeAttribute(a);
    R.ring.style.opacity = "";
  } else {
    set(R.ring, { "stroke-dasharray": `${R.ringLen} ${R.ringLen}`, "stroke-dashoffset": R.ringLen * (1 - pr),
      transform: `rotate(-90 ${R.parts.ring.cx} ${R.parts.ring.cy})` });
    R.ring.style.opacity = pr > 0 ? 1 : 0;
  }
  const pm = clamp01((t - T.mark.at) / T.mark.dur);
  if (pm >= 1) { R.mark.removeAttribute("filter"); R.mark.style.opacity = ""; }
  else {
    R.mark.style.opacity = easeFade(pm);
    R.markBlur.setAttribute("stdDeviation", 1.5 * (1 - easeFade(pm)));
    R.mark.setAttribute("filter", "url(#bm)");
  }

  // One soft sheen on the sonic logo.
  const ps = prog(t, T.sheen);
  if (ps <= 0 || ps >= 1) R.sheen.style.display = "none";
  else {
    R.sheen.style.display = "";
    const c = -90 + 620 * easeInOut(ps), w = 70;
    set(R.sheenG, { x1: c - w, y1: 95, x2: c + w, y2: 25 });
    R.sheen.style.opacity = 0.5 * Math.sin(Math.PI * ps);
  }
}

// Windows of faster motion; the exporter takes more motion-blur samples here.
const FAST = [[1.95, 3.1]];

window.YANU_IDENT = { DURATION, FPS, BPM, COLORS: C, TIMELINE: T, FAST, build, render };
})();
