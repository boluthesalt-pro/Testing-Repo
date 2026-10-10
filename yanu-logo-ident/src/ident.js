// YANU logo ident: 8 s, 120 BPM, four bars of 2 s (see tools/score.py).
//
// Two colours only: Peach Glow on Chocolate Melange. One continuous camera
// move over the logo itself.
//
//   0-2 s    Macro. We open extremely close, so the logo's curves fill the
//            frame as abstract peach shapes. The camera drifts slowly from
//            the curve of the "y" into the round bowl of the "a".
//   2.0 s    The drop. One smooth pull-back reveals the whole wordmark,
//            landing softly at 3.3 s.
//   3.05 s   The ® ring draws itself; the R settles in on the chime (3.5 s).
//   3.3-8 s  Hold, with a slow push-in. One soft sheen crosses the logo on
//            the sonic logo (6.0-6.9 s).
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

// Camera keyframes: `focus` is the logo point at the centre of the frame,
// `zoom` is relative to the final framing.
const T = {
  macro:  { from: { focus: { x: 40, y: 118 }, zoom: 15 },   // the curve of the y
            to:   { focus: { x: 152, y: 50 }, zoom: 9.5 },  // the bowl of the a
            span: [0, 2.0] },
  reveal: { span: [2.0, 3.3] },
  fadeIn: [0.0, 0.6],
  ring: [3.05, 3.5],
  mark: { at: 3.4, dur: 0.6 },
  push: [3.3, 8.0],
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
const drift = cubicBezier(0.35, 0.1, 0.55, 0.9);      // slow, even glide
const glide = cubicBezier(0.5, 0, 0.1, 1);            // gathers, then a long soft landing
const easeFade = cubicBezier(0.33, 1, 0.68, 1);
const easeInOut = cubicBezier(0.65, 0, 0.35, 1);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const prog = (t, [a, b]) => clamp01((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;

// Camera at time t: zoom interpolates in log space so the move feels even.
function camera(t) {
  const { from, to, span } = T.macro;
  if (t < T.reveal.span[0]) {
    const u = drift(prog(t, span));
    return { x: lerp(from.focus.x, to.focus.x, u), y: lerp(from.focus.y, to.focus.y, u),
             zoom: Math.exp(lerp(Math.log(from.zoom), Math.log(to.zoom), u)) };
  }
  const u = glide(prog(t, T.reveal.span));
  const push = 1 + 0.03 * easeInOut(prog(t, T.push));
  return { x: lerp(to.focus.x, ORIGIN.x, u), y: lerp(to.focus.y, ORIGIN.y, u),
           zoom: Math.exp(lerp(Math.log(to.zoom), 0, u)) * push };
}

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
  for (const d of parts.letters) el("path", { d }, logo);
  const ring = el("circle", { cx: parts.ring.cx, cy: parts.ring.cy, r: parts.ring.r, fill: "none",
    stroke: C.peach, "stroke-width": parts.ring.w }, logo);
  const mark = el("path", { d: parts.mark }, logo);
  const markBlur = el("feGaussianBlur", { stdDeviation: 0 });
  el("filter", { id: "bm", x: "-50%", y: "-50%", width: "200%", height: "200%" }, defs).append(markBlur);

  const sheen = el("g", { fill: "url(#sheen)" }, logo);
  for (const d of [...parts.letters, parts.mark]) el("path", { d }, sheen);
  el("circle", { cx: parts.ring.cx, cy: parts.ring.cy, r: parts.ring.r, fill: "none",
    stroke: "url(#sheen)", "stroke-width": parts.ring.w }, sheen);

  return { W, H, k: logoPx / LOGO_W, logo, ring, ringLen: 2 * Math.PI * parts.ring.r,
           mark, markBlur, sheen, sheenG, parts };
}

// --- Render ----------------------------------------------------------------------
function render(R, t) {
  const cam = camera(t);
  R.logo.setAttribute("transform",
    `translate(${R.W / 2} ${R.H / 2}) scale(${R.k * cam.zoom}) translate(${-cam.x} ${-cam.y})`);
  const fade = easeFade(prog(t, T.fadeIn));
  R.logo.style.opacity = fade >= 1 ? "" : fade;

  // ® ring draws on from 12 o'clock once the logo has landed; the R settles in.
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

// Windows of fast motion; the exporter takes more motion-blur samples here.
const FAST = [[2.0, 3.3]];

window.YANU_IDENT = { DURATION, FPS, BPM, COLORS: C, TIMELINE: T, FAST, build, render };
})();
