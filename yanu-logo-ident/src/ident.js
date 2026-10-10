// YANU logo ident: 8 s, 120 BPM, four bars of 2 s (see tools/score.py).
//
//   bar 1  0-2 s  A silk ribbon of orange-to-peach strands sweeps through the
//                 frame in an S-curve over a warm chocolate ground. Soft
//                 bokeh drifts up.
//   bar 2  2-4 s  The drop: y · a · n · u pop in on the eighth notes (2.00 /
//                 2.25 / 2.50 / 2.75 s). Each letter springs up from the
//                 baseline with an orange echo and a ripple. The ® ring
//                 draws on, and the R pops with a sparkle on 3.5 s.
//   bar 3  4-6 s  Colour wipes on the beat (4.0 orange, 5.0 peach, 6.0
//                 chocolate). The logo changes colour exactly at each wipe's
//                 edge and breathes on every kick.
//   bar 4  6-8 s  A silk flourish draws under the logo. A sheen crosses it on
//                 the sonic logo, sparkles land on 7.0 s, and a slow push-in
//                 settles before the end.
//
// render(t) is a pure function of time; the exporter calls it per sub-frame.
// The logo is drawn only from the supplied artwork's path data
// (../../yanu-brand-animation/src/logo.js).

(function () {
const DURATION = 8, FPS = 30, BPM = 120;
const C = { choc: "#2F0F03", peach: "#FFDDAC", orange: "#FAAA48", glint: "#FFF3E2" };

// Logo geometry, in the logo's SVG units (viewBox 438.72 × 139.01).
const LOGO_W = 438.72;
const ORIGIN = { x: 200.1, y: 64 };   // optical centre: wordmark without ®, x-height band
const BASELINE = 94;                  // letters spring from here

const T = {
  ribbon: { head: [0.10, 1.65], tail: [0.85, 2.05], close: [1.55, 2.05] },
  letters: { at: [2.0, 2.25, 2.5, 2.75], dur: 0.75, echoLead: 0.12 },
  ring: [2.95, 3.40],
  mark: { at: 3.5, dur: 0.55 },
  wipes: [
    { at: 4.0, bg: C.orange, logo: C.choc, edge: C.peach },
    { at: 5.0, bg: C.peach,  logo: C.choc, edge: C.orange },
    { at: 6.0, bg: C.choc,   logo: C.peach, edge: C.orange },
  ],
  wipeDur: 0.62,
  kicks: [2.875, 3.25, 4.0, 4.875, 5.25, 6.0, 6.875],
  flourish: [6.15, 7.25],
  sheen: [6.45, 7.15],
  sparkle: [3.5, 7.0],
  push: [5.6, 8.0],
};

// --- Easing ------------------------------------------------------------------
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
const easeInOut = cubicBezier(0.65, 0, 0.35, 1);
const easeOut = cubicBezier(0.16, 1, 0.3, 1);
const easeIn = cubicBezier(0.55, 0, 0.9, 0.4);
const silk = cubicBezier(0.45, 0.05, 0.25, 1);
const easeWipe = cubicBezier(0.3, 0.7, 0.2, 1);    // fast bloom, still readable
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const prog = (t, [a, b]) => clamp01((t - a) / (b - a));
const smooth = (a, b, x) => { const u = clamp01((x - a) / (b - a)); return u * u * (3 - 2 * u); };
// Damped spring, 0 -> 1 with one soft overshoot (~9%), exactly 1 at p >= 1.
const spring = (p) => (p <= 0 ? 0 : p >= 1 ? 1 : 1 - Math.exp(-6 * p) * Math.cos(2 * Math.PI * 1.25 * p));
const mix = (a, b, k) => a + (b - a) * k;

// Deterministic PRNG for bokeh and sparkle layout.
function prng(seed) { return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296); }

// --- SVG helpers -------------------------------------------------------------
const NS = "http://www.w3.org/2000/svg";
function el(tag, attrs = {}, parent) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (parent) parent.append(n);
  return n;
}
const set = (n, attrs) => { for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); };
const STAR = "M0,-1 C0.12,-0.12 0.12,-0.12 1,0 C0.12,0.12 0.12,0.12 0,1 C-0.12,0.12 -0.12,0.12 -1,0 C-0.12,-0.12 -0.12,-0.12 0,-1Z";

// Pull the supplied artwork's path data out of the logo markup.
function logoParts(markup) {
  const doc = new DOMParser().parseFromString(markup, "image/svg+xml");
  const letters = [...doc.querySelectorAll("g > g > g > path")].map((p) => p.getAttribute("d"));
  const mark = doc.querySelector("#Layer_1-2 > g > path").getAttribute("d");
  const c = doc.querySelector("circle");
  const ring = { cx: +c.getAttribute("cx"), cy: +c.getAttribute("cy"), r: +c.getAttribute("r"), w: 3.32 };
  return { letters, mark, ring };
}

// --- Silk: a ribbon of strands around a centreline, twisting as it flows. ---
function silkPaths(curve, a, b, t, opts) {
  const { strands, width, twist, flow, wave, samples = 140 } = opts;
  const out = Array.from({ length: strands }, () => []);
  if (b - a < 1e-4) return out.map(() => "");
  for (let k = 0; k <= samples; k++) {
    const s = a + (b - a) * (k / samples);
    const [x, y, dx, dy] = curve(s);
    const len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
    const taper = Math.min(1, smooth(0, 0.09, s - a) * 1.0001) * smooth(0, 0.12, b - s + 1e-6);
    const tw = Math.cos(Math.PI * (twist * s - flow * t));
    const w = width * taper * (0.25 + 0.75 * Math.abs(tw)) * Math.sign(tw || 1);
    const off = wave * Math.sin(2 * Math.PI * (2 * s - 0.6 * t));
    for (let i = 0; i < strands; i++) {
      const f = strands === 1 ? 0 : i / (strands - 1) - 0.5;
      const ripple = 0.08 * width * Math.sin(2 * Math.PI * (3 * s + i * 0.17 - 0.8 * t));
      const d = off + f * w + ripple * taper;
      out[i].push(`${(x + nx * d).toFixed(2)},${(y + ny * d).toFixed(2)}`);
    }
  }
  return out.map((pts) => "M" + pts.join("L"));
}

function bezier(p0, p1, p2, p3) {
  return (s) => {
    const u = 1 - s;
    const x = u * u * u * p0[0] + 3 * u * u * s * p1[0] + 3 * u * s * s * p2[0] + s * s * s * p3[0];
    const y = u * u * u * p0[1] + 3 * u * u * s * p1[1] + 3 * u * s * s * p2[1] + s * s * s * p3[1];
    const dx = 3 * u * u * (p1[0] - p0[0]) + 6 * u * s * (p2[0] - p1[0]) + 3 * s * s * (p3[0] - p2[0]);
    const dy = 3 * u * u * (p1[1] - p0[1]) + 6 * u * s * (p2[1] - p1[1]) + 3 * s * s * (p3[1] - p2[1]);
    return [x, y, dx, dy];
  };
}

// --- Build -------------------------------------------------------------------
function build(root, W, H, markup) {
  const parts = logoParts(markup);
  const S = Math.min(W, H), cx = W / 2, cy = H / 2;
  const logoPx = Math.min(0.66 * W, 0.68 * H);           // logo width in px
  const k = logoPx / LOGO_W;

  const svg = el("svg", { xmlns: NS, viewBox: `0 0 ${W} ${H}`, width: W, height: H }, root);
  const defs = el("defs", {}, svg);

  // Gradients.
  const glowG = el("radialGradient", { id: "glow" }, defs);
  el("stop", { offset: 0, "stop-color": C.orange, "stop-opacity": 0.55 }, glowG);
  el("stop", { offset: 0.45, "stop-color": C.orange, "stop-opacity": 0.16 }, glowG);
  el("stop", { offset: 1, "stop-color": C.orange, "stop-opacity": 0 }, glowG);
  const bloomG = el("radialGradient", { id: "bloom" }, defs);
  el("stop", { offset: 0, "stop-color": C.peach, "stop-opacity": 1 }, bloomG);
  el("stop", { offset: 1, "stop-color": C.peach, "stop-opacity": 0 }, bloomG);
  for (const [id, col] of [["dotOrange", C.orange], ["dotPeach", C.peach]]) {
    const g = el("radialGradient", { id }, defs);
    el("stop", { offset: 0, "stop-color": col, "stop-opacity": 1 }, g);
    el("stop", { offset: 1, "stop-color": col, "stop-opacity": 0 }, g);
  }
  const sheenG = el("linearGradient", { id: "sheen", gradientUnits: "userSpaceOnUse" }, defs);
  el("stop", { offset: 0, "stop-color": C.glint, "stop-opacity": 0 }, sheenG);
  el("stop", { offset: 0.5, "stop-color": C.glint, "stop-opacity": 1 }, sheenG);
  el("stop", { offset: 1, "stop-color": C.glint, "stop-opacity": 0 }, sheenG);

  // Base: chocolate, warm glow, bokeh, ribbon, logo.
  const base = el("g", {}, svg);
  el("rect", { width: W, height: H, fill: C.choc }, base);
  const glow = el("ellipse", { id: "glowShape", cx, cy, fill: "url(#glow)" }, base);
  const bokehG = el("g", {}, base);
  const rnd = prng(7);
  const bokeh = Array.from({ length: 16 }, () => ({
    x: rnd(), y: rnd(), r: (0.012 + 0.03 * rnd()) * S, sp: 0.03 + 0.05 * rnd(),
    ph: rnd() * 6.28,
    node: el("circle", { fill: rnd() < 0.5 ? "url(#dotOrange)" : "url(#dotPeach)" }, bokehG),
  }));
  const ribbonG = el("g", { fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" }, base);
  const soft = el("filter", { id: "soft", x: "-20%", y: "-20%", width: "140%", height: "140%" }, defs);
  el("feGaussianBlur", { stdDeviation: 0.03 * S }, soft);
  const ribbonGlow = [el("path", { stroke: C.orange, "stroke-width": 0.12 * S, "stroke-opacity": 0.22,
    filter: "url(#soft)" }, ribbonG)];
  const STRANDS = 16;
  const strandCol = (i, n) => {
    const f = Math.abs(i / (n - 1) - 0.5) * 2;               // 0 centre .. 1 edge
    return f > 0.55 ? C.orange : C.peach;
  };
  const ribbon = Array.from({ length: STRANDS }, (_, i) =>
    el("path", { stroke: strandCol(i, STRANDS), "stroke-width": S * (i % 3 ? 0.0018 : 0.0032),
      "stroke-opacity": i % 3 ? 0.55 : 0.9 }, ribbonG));
  const bloom = el("circle", { cx, cy, fill: "url(#bloom)" }, base);

  // Logo (drawn once, reused for every wipe layer via <use>).
  // Colour is set on a wrapper (not on #logo itself) so each <use> copy can
  // recolour the logo through `color` inheritance.
  const logoWrap = el("g", {}, base);
  logoWrap.style.color = C.peach;
  const logoT = el("g", { id: "logo" }, logoWrap);
  const letters = parts.letters.map((d) => {
    const g = el("g", {}, logoT);
    const echo = el("path", { d, fill: C.orange }, g);
    const main = el("path", { d, fill: "currentColor" }, g);
    const bb = main.getBBox();
    return { g, echo, main, ox: bb.x + bb.width / 2, w: bb.width };
  });
  const ringN = el("circle", { cx: parts.ring.cx, cy: parts.ring.cy, r: parts.ring.r, fill: "none",
    stroke: "currentColor", "stroke-width": parts.ring.w }, logoT);
  const ringLen = 2 * Math.PI * parts.ring.r;
  const markN = el("path", { d: parts.mark, fill: "currentColor" }, logoT);

  // Colour wipes: an expanding circle per beat, each showing a new ground and
  // the same logo in a new colour, plus a fine ring on the wipe's edge.
  const Rmax = Math.hypot(W / 2, H / 2) * 1.04;
  const wipes = T.wipes.map((w, i) => {
    const clip = el("clipPath", { id: `wipe${i}` }, defs);
    const circ = el("circle", { cx, cy, r: 0 }, clip);
    const g = el("g", { "clip-path": `url(#wipe${i})` }, svg);
    el("rect", { width: W, height: H, fill: w.bg }, g);
    let glowN = null;
    if (w.bg === C.choc) el("use", { href: "#glowShape" }, g);
    else {
      // A soft inner glow in a neighbouring brand colour keeps the flat
      // grounds alive; it breathes with the main glow.
      const tint = w.bg === C.orange ? C.peach : C.orange;
      const gg = el("radialGradient", { id: `wipeGlow${i}` }, defs);
      el("stop", { offset: 0, "stop-color": tint, "stop-opacity": 0.5 }, gg);
      el("stop", { offset: 1, "stop-color": tint, "stop-opacity": 0 }, gg);
      glowN = el("ellipse", { cx, cy, fill: `url(#wipeGlow${i})` }, g);
    }
    const u = el("use", { href: "#logo" }, g);
    u.style.color = w.logo;
    const edge = el("circle", { cx, cy, fill: "none", stroke: w.edge }, svg);
    return { ...w, circ, g, edge, glowN };
  });

  // Top layer: ripples, flourish, sheen, sparkles (all in logo units).
  const top = el("g", {}, svg);
  const topLogo = el("g", {}, top);
  const ripples = letters.map((l) => el("circle", { cx: l.ox, cy: 47, fill: "none", stroke: C.orange }, topLogo));
  const flourishG = el("g", { fill: "none", "stroke-linecap": "round" }, topLogo);
  const flourish = Array.from({ length: 7 }, (_, i) =>
    el("path", { stroke: i % 3 === 1 ? C.peach : C.orange, "stroke-width": i % 3 ? 1.3 : 2.4,
      "stroke-opacity": i % 3 ? 0.7 : 1 }, flourishG));
  const flourishCurve = bezier([-28, 168], [110, 214], [300, 112], [468, 160]);
  const sheenG2 = el("g", { fill: "url(#sheen)" }, topLogo);
  for (const d of [...parts.letters, parts.mark]) el("path", { d }, sheenG2);
  const sheenRing = el("circle", { cx: parts.ring.cx, cy: parts.ring.cy, r: parts.ring.r, fill: "none",
    stroke: "url(#sheen)", "stroke-width": parts.ring.w }, sheenG2);
  const spr = prng(31);
  const sparkleSets = [
    // around the ®
    Array.from({ length: 6 }, (_, i) => {
      const a = (i / 6) * 2 * Math.PI + 0.4;
      const rr = 22 + 16 * spr();
      return { x: parts.ring.cx + Math.cos(a) * rr, y: parts.ring.cy + Math.sin(a) * rr,
               size: 12 + 9 * spr(), delay: 0.05 * i };
    }),
    // across the whole wordmark
    [[18, 6], [150, -8], [260, 30], [372, 4], [440, -6], [96, 128], [330, 100], [210, 150]]
      .map(([x, y], i) => ({ x, y, size: 9 + 9 * spr(), delay: 0.06 * i })),
  ];
  const sparkles = sparkleSets.map((set) => set.map((s) =>
    ({ ...s, node: el("path", { d: STAR, fill: C.glint }, topLogo) })));

  return { svg, W, H, S, cx, cy, k, glow, bokeh, ribbon, ribbonGlow, bloom, logoT, letters,
           ringN, ringLen, markN, wipes, Rmax, topLogo, ripples, flourish, flourishCurve,
           sheenG2, sparkles, parts };
}

// --- Render ------------------------------------------------------------------
function render(R, t) {
  const { W, H, S, cx, cy } = R;

  // Ground glow: rises through the intro, flashes on the drop, breathes on kicks.
  let kickPulse = 0;
  for (const kt of T.kicks) if (t >= kt) kickPulse += Math.exp(-(t - kt) / 0.11);
  const drop = t >= 2 ? Math.exp(-(t - 2) / 0.35) : 0;
  const glowA = 0.15 + 0.55 * smooth(0, 2, t) - 0.2 * smooth(2.3, 3.2, t) + 0.25 * drop + 0.12 * kickPulse;
  set(R.glow, { rx: S * (0.55 + 0.1 * Math.sin(t * 1.3)), ry: S * (0.42 + 0.08 * Math.sin(t * 1.1 + 1)),
    opacity: clamp01(glowA) });

  // Bokeh drifting upward.
  for (const b of R.bokeh) {
    const y = ((b.y - b.sp * t) % 1 + 1) % 1;
    const x = b.x + 0.02 * Math.sin(b.ph + t * 0.9);
    const a = 0.22 * (0.5 + 0.5 * Math.sin(b.ph + t * 1.7)) * smooth(0, 0.8, t);
    set(b.node, { cx: x * W, cy: y * H, r: b.r, opacity: a });
  }

  // Silk ribbon.
  const head = silk(prog(t, T.ribbon.head)), tail = easeIn(prog(t, T.ribbon.tail));
  const close = 1 - smooth(T.ribbon.close[0], T.ribbon.close[1], t);
  const curve = bezier([cx - 1.25 * W / 2, cy + 0.78 * H / 2], [cx - 0.3 * W / 2, cy - 1.3 * H / 2],
                       [cx + 0.3 * W / 2, cy + 1.3 * H / 2], [cx + 1.25 * W / 2, cy - 0.78 * H / 2]);
  const strands = silkPaths(curve, tail, head, t,
    { strands: R.ribbon.length, width: 0.13 * S * close, twist: 2.4, flow: 0.55, wave: 0.03 * S });
  R.ribbon.forEach((p, i) => p.setAttribute("d", strands[i]));
  const spine = silkPaths(curve, tail, head, t, { strands: 1, width: 0, twist: 2.4, flow: 0.55, wave: 0.03 * S })[0];
  R.ribbonGlow.forEach((p) => p.setAttribute("d", spine));

  // Bloom on the drop.
  set(R.bloom, { r: S * (0.1 + 0.4 * (1 - drop)), opacity: t >= 2 ? 0.4 * drop : 0 });

  // Logo transform: centred, slow push-in at the end, breathing on kicks.
  const push = 1 + 0.035 * easeInOut(prog(t, T.push));
  let pulse = 0;
  for (const kt of T.kicks) if (t >= kt) pulse += 0.018 * Math.exp(-(t - kt) / 0.1);
  const sc = R.k * push * (1 + pulse);
  const tf = `translate(${cx} ${cy}) scale(${sc}) translate(${-ORIGIN.x} ${-ORIGIN.y})`;
  R.logoT.setAttribute("transform", tf);
  R.topLogo.setAttribute("transform", tf);

  // Letters: spring up from the baseline, orange echo leading, ripple behind.
  R.letters.forEach((L, i) => {
    const at = T.letters.at[i];
    const p = clamp01((t - at) / T.letters.dur);
    const pe = clamp01((t - at + T.letters.echoLead) / T.letters.dur);
    const place = (node, q, extraY, extraS) => {
      if (q >= 1 && extraY === 0) { node.removeAttribute("transform"); return; }
      const s = spring(q);
      const scale = mix(0.35, 1, s) * (1 + extraS);
      const y = 60 * (1 - s) + extraY;
      const rot = -8 * (1 - s) * (i % 2 ? -1 : 1);
      node.setAttribute("transform",
        `translate(${L.ox} ${BASELINE + y}) rotate(${rot}) scale(${scale}) translate(${-L.ox} ${-BASELINE})`);
    };
    place(L.main, p, 0, 0);
    L.main.style.opacity = t < at ? 0 : clamp01((t - at) / 0.08);
    const echoA = t < at - T.letters.echoLead ? 0 : 0.95 * (1 - smooth(0.15, 0.7, p));
    L.echo.style.opacity = echoA;
    if (echoA > 0) place(L.echo, pe, 5 * (1 - smooth(0, 0.6, p)), 0.04 * (1 - smooth(0, 0.6, p)));
    else L.echo.style.display = "none";
    if (echoA > 0) L.echo.style.display = "";
    const q = clamp01((t - at) / 0.7);
    set(R.ripples[i], { r: 18 + 80 * easeOut(q), "stroke-width": 2.2 * (1 - q) + 0.2,
      opacity: t < at ? 0 : 0.7 * (1 - q) });
  });

  // ® ring draws on from 12 o'clock; the R pops in with a spring.
  const pr = easeInOut(prog(t, T.ring));
  if (pr >= 1) { for (const a of ["stroke-dasharray", "stroke-dashoffset", "transform"]) R.ringN.removeAttribute(a); R.ringN.style.opacity = ""; }
  else {
    set(R.ringN, { "stroke-dasharray": `${R.ringLen} ${R.ringLen}`, "stroke-dashoffset": R.ringLen * (1 - pr),
      transform: `rotate(-90 ${R.parts.ring.cx} ${R.parts.ring.cy})` });
    R.ringN.style.opacity = pr > 0 ? 1 : 0;
  }
  const pm = clamp01((t - T.mark.at) / T.mark.dur);
  if (pm >= 1) { R.markN.removeAttribute("transform"); R.markN.style.opacity = ""; }
  else {
    const s = spring(pm), { cx: rx, cy: ry } = R.parts.ring;
    R.markN.setAttribute("transform", `translate(${rx} ${ry}) scale(${s}) translate(${-rx} ${-ry})`);
    R.markN.style.opacity = t < T.mark.at ? 0 : 1;
  }

  // Wipes.
  R.wipes.forEach((w) => {
    const p = easeWipe(clamp01((t - w.at) / T.wipeDur));
    const r = t < w.at ? 0 : R.Rmax * p;
    w.circ.setAttribute("r", r);
    if (w.glowN) set(w.glowN, { rx: S * (0.62 + 0.06 * Math.sin(t * 1.3)), ry: S * 0.4,
      opacity: clamp01(0.75 + 0.25 * kickPulse) });
    set(w.edge, { r, "stroke-width": S * 0.014 * (1 - p) + 0.5, opacity: t < w.at || p >= 1 ? 0 : 0.9 * (1 - p * p) });
  });

  // Flourish: a silk underline signature, drawn on and then left in place.
  const pf = silk(prog(t, T.flourish));
  const fl = silkPaths(R.flourishCurve, 0, pf, 0.3 + 0.25 * t,
    { strands: R.flourish.length, width: 11, twist: 1.6, flow: 0.4, wave: 2.5, samples: 120 });
  R.flourish.forEach((p, i) => p.setAttribute("d", pf > 0 ? fl[i] : ""));

  // Sheen across the finished logo on the sonic logo.
  const ps = prog(t, T.sheen);
  if (ps <= 0 || ps >= 1) R.sheenG2.style.display = "none";
  else {
    R.sheenG2.style.display = "";
    const c = -100 + 680 * easeInOut(ps), w = 70;
    set(document.getElementById("sheen"), { x1: c - w, y1: 95, x2: c + w, y2: 25 });
    R.sheenG2.style.opacity = 0.7 * Math.sin(Math.PI * ps);
  }

  // Sparkles: four-point glints that bloom, turn and vanish.
  R.sparkles.forEach((set_, k) => set_.forEach((s) => {
    const q = (t - T.sparkle[k] - s.delay) / 0.5;
    if (q <= 0 || q >= 1) { s.node.style.display = "none"; return; }
    s.node.style.display = "";
    const g = Math.sin(Math.PI * q) ** 1.5;
    s.node.setAttribute("transform", `translate(${s.x} ${s.y}) rotate(${45 * q}) scale(${s.size * g})`);
  }));
}

// Windows of very fast motion; the exporter takes more motion-blur samples here.
const FAST = [
  [1.95, 3.15],                                   // drop, letter pops
  [T.ring[0], T.ring[1]], [T.mark.at, T.mark.at + 0.4],
  ...T.wipes.map((w) => [w.at, w.at + 0.4]),
];

window.YANU_IDENT = { DURATION, FPS, BPM, COLORS: C, TIMELINE: T, FAST, build, render };
})();
