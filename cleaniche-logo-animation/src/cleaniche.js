// Cleaniche — "The Flow of Clean" logo animation (10 s).
// Deterministic: draw(t) renders the frame at time t (seconds) for any canvas size.
// The logo is drawn only from the supplied, unmodified SVG path data (LOGO_PATHS);
// motion is applied with uniform transforms, masks, light and opacity.

(function (global) {
  'use strict';

  const C = {
    teal: '#067593', orange: '#FF621D', light: '#AEEAFF',
    grey: '#B9C7C9', tan: '#C1B995',
  };
  const TAGLINE = 'YOUR SPACE, OUR SPARKLE';
  const DURATION = 10;

  // Logo-space geometry (units of the supplied 2386.11 x 404.74 artboard).
  const LOGO_BOX = { x0: 102, y0: 38.5, x1: 2127.1, y1: 367.9 };   // visible ink bounds
  const SYM_C = { x: 359.9, y: 203.2 };                            // symbol centre
  const SYM_RING = { rx: 258, ry: 165 };                           // outer ring (for ripple)
  const WORD_X0 = 671;                                             // wordmark left edge

  // ---------- easing / maths ----------
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, u) => a + (b - a) * u;
  const prog = (t, a, b) => clamp((t - a) / (b - a));
  const easeInOutCubic = u => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
  const easeOutCubic = u => 1 - Math.pow(1 - u, 3);
  const easeInOutSine = u => -(Math.cos(Math.PI * u) - 1) / 2;
  const smooth = u => u * u * (3 - 2 * u);
  // Rise to 1 at `peak`, then settle back to 0 — soft, organic overshoot shape.
  const swell = (u, peak = 0.35) =>
    u <= 0 || u >= 1 ? 0 : u < peak ? easeOutCubic(u / peak) : 1 - easeInOutSine((u - peak) / (1 - peak));
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, u, alpha = 1) => {
    const A = hex(a), B = hex(b);
    return `rgba(${A.map((v, i) => Math.round(lerp(v, B[i], u))).join(',')},${alpha})`;
  };
  const rgba = (h, a) => `rgba(${hex(h).join(',')},${a})`;

  // Monotone cubic (Fritsch–Carlson) through keys [[t, v], ...]; flat outside.
  function pchip(keys) {
    const n = keys.length, x = keys.map(k => k[0]), y = keys.map(k => k[1]);
    const d = [], m = new Array(n).fill(0);
    for (let i = 0; i < n - 1; i++) d.push((y[i + 1] - y[i]) / (x[i + 1] - x[i]));
    for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : 3 * (d[i - 1] + d[i]) / ((2 * d[i] + d[i - 1]) / d[i - 1] + (d[i] + 2 * d[i - 1]) / d[i]);
    m[0] = 0; m[n - 1] = 0; // ease in from rest, ease out to rest
    return t => {
      if (t <= x[0]) return y[0];
      if (t >= x[n - 1]) return y[n - 1];
      let i = 0; while (t > x[i + 1]) i++;
      const h = x[i + 1] - x[i], s = (t - x[i]) / h;
      const h00 = 2 * s ** 3 - 3 * s ** 2 + 1, h10 = s ** 3 - 2 * s ** 2 + s, h01 = -2 * s ** 3 + 3 * s ** 2, h11 = s ** 3 - s ** 2;
      return h00 * y[i] + h10 * h * m[i] + h01 * y[i + 1] + h11 * h * m[i + 1];
    };
  }

  // ---------- polyline routes ----------
  class Route {
    constructor(pts) {
      this.p = pts; this.s = [0];
      for (let i = 1; i < pts.length; i++) this.s.push(this.s[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      this.len = this.s[this.s.length - 1];
    }
    at(sv) {
      sv = clamp(sv, 0, this.len);
      let lo = 0, hi = this.s.length - 1;
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (this.s[mid] <= sv) lo = mid; else hi = mid; }
      const u = (sv - this.s[lo]) / ((this.s[hi] - this.s[lo]) || 1);
      return [lerp(this.p[lo][0], this.p[hi][0], u), lerp(this.p[lo][1], this.p[hi][1], u)];
    }
    // Points between arc lengths a..b, every `step` units.
    slice(a, b, step) {
      a = clamp(a, 0, this.len); b = clamp(b, 0, this.len);
      const out = [];
      if (b <= a) return out;
      const n = Math.max(1, Math.ceil((b - a) / step));
      for (let i = 0; i <= n; i++) out.push(this.at(a + (b - a) * i / n));
      return out;
    }
  }
  const concat = (...rs) => rs.reduce((acc, r) => acc.concat(acc.length ? r.slice(1) : r), []);

  // Polar envelope of the symbol around its centre → used to build the spiral approach
  // that lands, tangent-continuous, on the outer ring.
  function buildEnvelope(routes) {
    const bins = new Array(360).fill(0);
    for (const k of Object.keys(routes)) for (const [x, y] of routes[k]) {
      const a = Math.atan2(y - SYM_C.y, x - SYM_C.x), r = Math.hypot(x - SYM_C.x, y - SYM_C.y);
      const b = ((Math.round(a * 180 / Math.PI) % 360) + 360) % 360;
      bins[b] = Math.max(bins[b], r);
    }
    for (let i = 0; i < 360; i++) if (!bins[i]) { // fill gaps (tail opening)
      let l = i, r = i; while (!bins[(l + 360) % 360]) l--; while (!bins[r % 360]) r++;
      const L = bins[(l + 360) % 360], R = bins[r % 360];
      bins[i] = lerp(L, R, (i - l) / (r - l));
    }
    const sm = bins.map((_, i) => { let s = 0; for (let k = -22; k <= 22; k++) s += bins[(i + k + 360) % 360]; return s / 45; });
    return a => { const d = ((a * 180 / Math.PI) % 360 + 360) % 360, i = Math.floor(d), f = d - i; return lerp(sm[i], sm[(i + 1) % 360], f); };
  }

  function spiral(env, end, turns, inset, phase) {
    const a0 = Math.atan2(end[1] - SYM_C.y, end[0] - SYM_C.x), r0 = Math.hypot(end[0] - SYM_C.x, end[1] - SYM_C.y);
    const k0 = r0 / env(a0), pts = [], N = 900;
    for (let i = 0; i <= N; i++) {
      const v = i / N, a = a0 + turns * 2 * Math.PI * (1 - v);  // angle decreases → counter-clockwise on screen
      const g = 1 - Math.pow(1 - v, 2.6);                         // grows outwards, flat at landing
      const wob = 1 + 0.09 * Math.sin(3 * a + phase) * Math.pow(1 - v, 1.5);
      const r = env(a) * k0 * g * wob * (1 - inset * Math.pow(1 - v, 1.4));
      pts.push([SYM_C.x + r * Math.cos(a), SYM_C.y + r * Math.sin(a)]);
    }
    pts[N] = end.slice();
    return pts;
  }

  // ---------- renderer ----------
  function create(canvas, data) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const px = Math.min(W, H) / 1080;              // pixel unit relative to 1080p
    const portrait = H > W;

    const symPath = new Path2D(data.logo.symbol);
    const wordPath = new Path2D();
    for (const d of data.logo.wordmark) wordPath.addPath(new Path2D(d));

    // Layout — final lockup centred as a group (logo + tagline).
    const logoWpx = portrait ? 0.80 * W : 0.575 * W;
    const s = logoWpx / (LOGO_BOX.x1 - LOGO_BOX.x0);
    const logoHpx = (LOGO_BOX.y1 - LOGO_BOX.y0) * s;
    const tagSize = Math.round((portrait ? 28 : 30) * px);
    const gap = (portrait ? 74 : 72) * px;
    const groupH = logoHpx + gap + tagSize * 0.72;
    const logoLeft = (W - logoWpx) / 2, logoTop = (H - groupH) / 2;
    const toScreen = (ux, uy) => [logoLeft + (ux - LOGO_BOX.x0) * s, logoTop + (uy - LOGO_BOX.y0) * s];
    const symFinal = toScreen(SYM_C.x, SYM_C.y);
    const symStart = [W / 2, H / 2];               // symbol forms dead centre, then glides into lockup
    const tagBaseline = logoTop + logoHpx + gap + tagSize * 0.72;

    // Routes (symbol units). Head 1 builds the ring, the upper wave and closes the outer arc;
    // head 2 follows and lays the lower wave.
    const R = data.routes;
    const env = buildEnvelope(R);
    const pre1 = spiral(env, R.outA[0], 1.55, 0, 0.0);
    const pre2 = spiral(env, R.outA[0], 1.4, 0.3, 2.4);
    const route1 = new Route(concat(pre1, R.outA, R.upper, R.link, R.outB));
    const route2 = new Route(concat(pre2, R.outA, R.lower));
    const L = r => new Route(r).len;
    const pre1L = L(pre1), pre2L = L(pre2), outAL = L(R.outA), upL = L(R.upper), loL = L(R.lower), linkL = L(R.link);
    const s1 = pchip([[0.45, 0], [1.0, pre1L * 0.035], [1.6, pre1L * 0.36], [2.2, pre1L], [2.52, pre1L + outAL],
      [2.68, pre1L + outAL + upL], [2.73, pre1L + outAL + upL + linkL], [2.92, route1.len]]);
    const s2 = pchip([[1.0, 0], [1.6, pre2L * 0.3], [2.3, pre2L], [2.62, pre2L + outAL], [2.86, route2.len]]);
    const revealFrom1 = pre1L, revealFrom2 = pre2L;
    const sparkRoute = new Route(R.lower.slice().reverse());   // the internal flowing curve
    const sp = pchip([[5.45, 0], [5.72, sparkRoute.len * 0.18], [6.02, sparkRoute.len * 0.72], [6.3, sparkRoute.len * 0.95], [6.45, sparkRoute.len]]);

    // Offscreen layers.
    const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return [c, c.getContext('2d')]; };
    const [fxC, fx] = mk(), [symC, sy] = mk(), [wmC, wm] = mk(), [logoC, lg] = mk();
    // Static dither grain (kills gradient banding in the encode; doesn't flicker).
    const [grainC, gr] = mk();
    {
      const img = gr.createImageData(W, H); let seed = 1234567;
      for (let i = 0; i < img.data.length; i += 4) {
        seed = (seed * 1664525 + 1013904223) >>> 0; const v = seed >>> 24;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
      }
      gr.putImageData(img, 0, 0);
    }

    function background(t) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.filter = 'none';
      ctx.fillStyle = '#030709'; ctx.fillRect(0, 0, W, H);
      // faint teal depth from the start, deepening into a dark-blue atmosphere from 6.5 s
      const atm = 0.35 + 0.65 * easeInOutSine(prog(t, 6.5, 7.6));
      const cx = W / 2, cy = H / 2 - (portrait ? 0.02 * H : 0.03 * H);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.hypot(W, H) * 0.6);
      g.addColorStop(0, `rgba(10,42,51,${0.85 * atm})`);
      g.addColorStop(0.55, `rgba(6,26,33,${0.55 * atm})`);
      g.addColorStop(1, 'rgba(3,7,9,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.62);
      v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    }

    // Symbol placement on screen at time t (centre position, scale multiplier, breathe offset).
    function symbolPlacement(t) {
      const g = easeInOutCubic(prog(t, 4.2, 5.35));
      const x = lerp(symStart[0], symFinal[0], g), y = lerp(symStart[1], symFinal[1], g);
      const k = 1 + 0.025 * swell(prog(t, 2.86, 3.2), 0.4) + 0.03 * swell(prog(t, 3.2, 4.2), 0.42);
      const breathe = -5 * px * Math.sin(Math.PI * easeInOutSine(prog(t, 6.5, 7.5)));
      return { x, y: y + breathe, k, breathe };
    }
    // Map symbol units → screen for a given placement.
    const symXf = (c, P) => { c.translate(P.x, P.y); c.scale(s * P.k, s * P.k); c.translate(-SYM_C.x, -SYM_C.y); };

    function camera(c, t) {
      const k = 0.972 + 0.028 * easeInOutSine(prog(t, 0, 9.3));
      c.translate(W / 2, H / 2); c.scale(k, k); c.translate(-W / 2, -H / 2);
    }

    // ---- light trails ----
    function drawTrail(c, route, sNow, sBack, widthPx, P, tint) {
      const pts = route.slice(sBack, sNow, 2.5);
      if (pts.length < 2) return;
      const n = pts.length - 1;
      c.save(); symXf(c, P); c.lineCap = 'round';
      const inv = 1 / (s * P.k);
      for (let i = 0; i < n; i++) {
        const f = (i + 1) / n;                      // 0 at tail → 1 at head
        c.strokeStyle = mix(C.teal, C.light, tint * Math.pow(f, 3), Math.pow(f, 1.6));
        c.lineWidth = widthPx * (0.15 + 0.85 * Math.pow(f, 1.2)) * inv;
        c.beginPath(); c.moveTo(pts[i][0], pts[i][1]); c.lineTo(pts[i + 1][0], pts[i + 1][1]); c.stroke();
      }
      // fine light-blue filament riding the core
      for (let i = Math.floor(n * 0.45); i < n; i++) {
        const f = (i + 1) / n;
        c.strokeStyle = rgba(C.light, 0.55 * Math.pow((f - 0.45) / 0.55, 2));
        c.lineWidth = widthPx * 0.3 * inv;
        c.beginPath(); c.moveTo(pts[i][0], pts[i][1]); c.lineTo(pts[i + 1][0], pts[i + 1][1]); c.stroke();
      }
      c.restore();
    }

    function drawHead(c, x, y, rPx, alpha, core, halo) {
      if (alpha <= 0) return;
      const g = c.createRadialGradient(x, y, 0, x, y, rPx * 9);
      g.addColorStop(0, rgba(halo, 0.55 * alpha)); g.addColorStop(0.25, rgba(halo, 0.16 * alpha)); g.addColorStop(1, rgba(halo, 0));
      c.fillStyle = g; c.beginPath(); c.arc(x, y, rPx * 9, 0, 7); c.fill();
      const g2 = c.createRadialGradient(x, y, 0, x, y, rPx * 2.2);
      g2.addColorStop(0, `rgba(240,252,255,${alpha})`); g2.addColorStop(0.45, rgba(core, 0.9 * alpha)); g2.addColorStop(1, rgba(core, 0));
      c.fillStyle = g2; c.beginPath(); c.arc(x, y, rPx * 2.2, 0, 7); c.fill();
    }
    const project = (P, pt) => [P.x + (pt[0] - SYM_C.x) * s * P.k, P.y + (pt[1] - SYM_C.y) * s * P.k];

    // ---- symbol formation (2.2 → 2.95 s): fill revealed under the flowing heads ----
    function drawForming(t, P) {
      sy.setTransform(1, 0, 0, 1, 0, 0); sy.clearRect(0, 0, W, H);
      sy.save(); camera(sy, t); symXf(sy, P);
      sy.lineCap = 'round'; sy.lineJoin = 'round'; sy.lineWidth = 40; sy.strokeStyle = '#fff';
      const strokeRange = (route, a, b) => {
        const pts = route.slice(a, b, 3); if (pts.length < 2) return;
        sy.beginPath(); sy.moveTo(pts[0][0], pts[0][1]); for (const q of pts) sy.lineTo(q[0], q[1]); sy.stroke();
      };
      strokeRange(route1, revealFrom1, s1(t));
      strokeRange(route2, revealFrom2, s2(t));
      sy.globalCompositeOperation = 'source-in';
      sy.fillStyle = C.teal; sy.fill(symPath);
      sy.restore(); sy.globalCompositeOperation = 'source-over';

      const u = prog(t, 2.2, 2.98);
      ctx.save();
      ctx.globalAlpha = 0.55 + 0.45 * smooth(u);
      ctx.filter = `blur(${(1 - smooth(u)) * 3.5 * px}px)`;
      ctx.drawImage(symC, 0, 0);
      ctx.filter = `blur(${10 * px}px)`; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35 * (1 - u * 0.6);
      ctx.drawImage(symC, 0, 0);
      ctx.restore();

      // energy glow on the freshly-condensed band (last ~110 units behind each head)
      fx.setTransform(1, 0, 0, 1, 0, 0); fx.clearRect(0, 0, W, H);
      fx.save(); camera(fx, t); symXf(fx, P); fx.lineCap = 'round';
      const glowRange = (route, from, sv) => {
        const a = Math.max(from, sv - 140), pts = route.slice(a, sv, 3), n = pts.length - 1;
        for (let i = 0; i < n; i++) {
          const f = (i + 1) / n;
          fx.strokeStyle = rgba(C.light, 0.5 * f * f); fx.lineWidth = 30;
          fx.beginPath(); fx.moveTo(pts[i][0], pts[i][1]); fx.lineTo(pts[i + 1][0], pts[i + 1][1]); fx.stroke();
        }
      };
      if (t < 2.97) { glowRange(route1, revealFrom1, s1(t)); glowRange(route2, revealFrom2, s2(t)); }
      fx.globalCompositeOperation = 'source-in'; fx.fillStyle = rgba(C.light, 1); fx.fill(symPath);
      fx.restore(); fx.globalCompositeOperation = 'source-over';
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.filter = `blur(${6 * px}px)`; ctx.globalAlpha = 0.65; ctx.drawImage(fxC, 0, 0);
      ctx.filter = 'none'; ctx.globalAlpha = 0.35; ctx.drawImage(fxC, 0, 0);
      ctx.restore();
    }

    function drawTrails(t, P) {
      fx.setTransform(1, 0, 0, 1, 0, 0); fx.clearRect(0, 0, W, H);
      fx.save(); camera(fx, t);
      const heads = [];
      // head 1
      {
        const a = clamp(prog(t, 0.15, 0.6)) * (1 - smooth(prog(t, 2.86, 3.1)));
        const sNow = s1(t), back = Math.min(sNow - s1(t - 1.1), t < 2.2 ? 560 : 300);
        if (a > 0) {
          fx.globalAlpha = a; drawTrail(fx, route1, sNow, sNow - back, 3.2 * px, P, 0.9);
          heads.push([project(P, route1.at(sNow)), 3.0 * px, a]);
        }
      }
      // head 2 — thinner, joins at 1.0 s and follows
      {
        const a = smooth(prog(t, 1.0, 1.35)) * (1 - smooth(prog(t, 2.8, 3.02)));
        const sNow = s2(t), back = Math.min(sNow - s2(t - 0.9), t < 2.25 ? 420 : 230);
        if (a > 0) {
          fx.globalAlpha = a * 0.85; drawTrail(fx, route2, sNow, sNow - back, 1.7 * px, P, 0.8);
          heads.push([project(P, route2.at(sNow)), 2.0 * px, a * 0.8]);
        }
      }
      fx.restore();
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.filter = `blur(${9 * px}px)`; ctx.globalAlpha = 0.9; ctx.drawImage(fxC, 0, 0);
      ctx.filter = 'none'; ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.drawImage(fxC, 0, 0);
      ctx.globalCompositeOperation = 'lighter';
      ctx.setTransform(1, 0, 0, 1, 0, 0); camera(ctx, t);
      for (const [[x, y], r, a] of heads) drawHead(ctx, x, y, r, a, C.teal, C.light);
      ctx.restore();
    }

    // ---- finished logo layer (symbol + wordmark) with glint ----
    function drawLogo(t, P) {
      lg.setTransform(1, 0, 0, 1, 0, 0); lg.clearRect(0, 0, W, H);
      lg.save(); camera(lg, t); symXf(lg, P); lg.fillStyle = C.teal; lg.fill(symPath); lg.restore();

      // wordmark: emerges from the symbol side — width 95→100 %, blur → sharp, opacity, soft wipe
      if (t >= 4.2) {
        const u = prog(t, 4.2, 5.4);
        wm.setTransform(1, 0, 0, 1, 0, 0); wm.clearRect(0, 0, W, H);
        wm.save(); camera(wm, t);
        const [wx0] = toScreen(WORD_X0, 0);
        wm.translate(P.x - symFinal[0], P.y - symFinal[1]);   // rides with the symbol (glide + breathe)
        wm.translate(wx0, 0); wm.scale(lerp(0.95, 1, easeOutCubic(u)), 1); wm.translate(-wx0, 0);
        wm.translate(logoLeft - LOGO_BOX.x0 * s, logoTop - LOGO_BOX.y0 * s); wm.scale(s, s);
        wm.fillStyle = C.teal; wm.fill(wordPath);
        // soft left→right wipe; the feather is wider than the word so it resolves as one piece
        const front = lerp(-0.1, 1.75, easeInOutSine(prog(t, 4.2, 5.25)));
        const x0 = WORD_X0, x1 = LOGO_BOX.x1, w = x1 - x0;
        wm.globalCompositeOperation = 'destination-in';
        const g = wm.createLinearGradient(x0 + (front - 0.7) * w, 0, x0 + front * w, 0);
        g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        wm.fillStyle = g; wm.fillRect(x0 - 50, 0, w + 100, 405);
        // thin fluid highlight travelling just behind the front
        wm.globalCompositeOperation = 'source-atop';
        const hx = x0 + (front - 0.42) * w, hw = 70;
        const hg = wm.createLinearGradient(hx - hw, 0, hx + hw, 0);
        const ha = 0.55 * (1 - smooth(prog(t, 5.0, 5.45)));
        hg.addColorStop(0, rgba(C.light, 0)); hg.addColorStop(0.5, rgba(C.light, ha)); hg.addColorStop(1, rgba(C.light, 0));
        wm.fillStyle = hg; wm.fillRect(x0 - 50, 0, w + 100, 405);
        wm.restore(); wm.globalCompositeOperation = 'source-over';
        lg.save();
        lg.globalAlpha = smooth(prog(t, 4.2, 5.0));
        lg.filter = `blur(${(1 - easeOutCubic(u)) * 9 * px}px)`;
        lg.drawImage(wmC, 0, 0);
        lg.restore();
      }

      // final glint — polished light reflection riding the orange point, clipped to the logo
      const gu = prog(t, 8.55, 9.15);
      if (gu > 0 && gu < 1) {
        const [ax] = toScreen(LOGO_BOX.x0 - 60, 0), [bx] = toScreen(LOGO_BOX.x1 + 60, 0);
        const gx = lerp(ax, bx, easeInOutSine(gu));
        lg.save(); lg.globalCompositeOperation = 'source-atop';
        lg.setTransform(1, 0, 0, 1, 0, 0); camera(lg, t);
        lg.translate(gx, 0); lg.transform(1, 0, -0.32, 1, 0, 0);
        const bw = 46 * px, a = Math.sin(Math.PI * gu);
        const g = lg.createLinearGradient(-bw, 0, bw, 0);
        g.addColorStop(0, 'rgba(230,250,255,0)'); g.addColorStop(0.5, `rgba(236,251,255,${0.5 * a})`); g.addColorStop(1, 'rgba(230,250,255,0)');
        lg.fillStyle = g; lg.fillRect(-bw - H, 0, 2 * bw + 2 * H, H);
        lg.restore();
      }

      ctx.save();
      // very soft light-blue presence behind the symbol (6.5 s →)
      const ga = 0.075 * smooth(prog(t, 6.5, 7.5));
      if (ga > 0) {
        camera(ctx, t);
        const r = SYM_RING.rx * s * 1.9;
        const g = ctx.createRadialGradient(P.x, P.y, 0, P.x, P.y, r);
        g.addColorStop(0, rgba(C.light, ga)); g.addColorStop(1, rgba(C.light, 0));
        ctx.fillStyle = g; ctx.fillRect(P.x - r, P.y - r, 2 * r, 2 * r);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }
      ctx.globalCompositeOperation = 'lighter'; ctx.filter = `blur(${14 * px}px)`; ctx.globalAlpha = 0.22;
      ctx.drawImage(logoC, 0, 0);
      ctx.restore();
      ctx.drawImage(logoC, 0, 0);
    }

    function drawRipple(t, P) {
      const u = prog(t, 3.22, 4.2);
      if (u <= 0 || u >= 1) return;
      const k = 1.3 * easeOutCubic(u), a = 0.33 * Math.pow(1 - u, 1.3);
      ctx.save(); camera(ctx, t);
      ctx.strokeStyle = mix(C.teal, C.light, smooth(u), a);
      ctx.lineWidth = (2.2 - 1.2 * u) * px;
      ctx.beginPath(); ctx.ellipse(P.x, P.y, SYM_RING.rx * s * k, SYM_RING.ry * s * k, 0, 0, 7); ctx.stroke();
      ctx.globalCompositeOperation = 'lighter'; ctx.filter = `blur(${5 * px}px)`; ctx.globalAlpha = 0.6; ctx.stroke();
      ctx.restore();
    }

    function drawSpark(t, P) {
      if (t < 5.4 || t > 6.5) return;
      const a = smooth(prog(t, 5.42, 5.56)) * (1 - smooth(prog(t, 6.22, 6.46)));
      const sv = sp(t), back = Math.min(sv - sp(t - 0.16), 90);
      ctx.save(); camera(ctx, t);
      const pts = sparkRoute.slice(sv - back, sv, 2).map(q => project(P, q));
      ctx.lineCap = 'round'; ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < pts.length - 1; i++) {
        const f = (i + 1) / (pts.length - 1);
        ctx.strokeStyle = rgba(C.orange, 0.75 * a * f * f); ctx.lineWidth = 2.0 * px * (0.25 + 0.75 * f);
        ctx.beginPath(); ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[i + 1][0], pts[i + 1][1]); ctx.stroke();
      }
      const [x, y] = project(P, sparkRoute.at(sv));
      drawHead(ctx, x, y, 2.4 * px, a, C.orange, C.orange);
      ctx.restore();
    }

    function drawGlintLight(t) {
      const gu = prog(t, 8.55, 9.15);
      if (gu <= 0 || gu >= 1) return;
      const [ax, ay] = toScreen(LOGO_BOX.x0 - 60, 236), [bx] = toScreen(LOGO_BOX.x1 + 60, 0);
      const e = easeInOutSine(gu), x = lerp(ax, bx, e), a = Math.sin(Math.PI * gu);
      const prevX = lerp(ax, bx, easeInOutSine(Math.max(0, gu - 0.08)));
      ctx.save(); camera(ctx, t); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(prevX, 0, x, 0);
      g.addColorStop(0, rgba(C.orange, 0)); g.addColorStop(1, rgba(C.orange, 0.5 * a));
      ctx.strokeStyle = g; ctx.lineWidth = 1.4 * px; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(prevX, ay); ctx.lineTo(x, ay); ctx.stroke();
      drawHead(ctx, x, ay, 2.2 * px, a, C.orange, C.orange);
      ctx.restore();
    }

    function drawTagline(t) {
      const u = prog(t, 7.5, 8.5);
      if (u <= 0) return;
      const e = easeOutCubic(u);
      ctx.save(); camera(ctx, t);
      ctx.font = `500 ${tagSize}px Figtree`;
      ctx.letterSpacing = `${0.34 * tagSize}px`;
      const w = ctx.measureText(TAGLINE).width - 0.34 * tagSize;   // drop trailing tracking
      ctx.fillStyle = rgba(C.grey, smooth(u));
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(TAGLINE, (W - w) / 2, tagBaseline + 8 * px * (1 - e));
      ctx.restore();
    }

    function draw(t) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1; ctx.filter = 'none'; ctx.globalCompositeOperation = 'source-over';
      background(t);
      const P = symbolPlacement(t);
      if (t >= 2.2 && t < 2.98) drawForming(t, P);
      if (t >= 2.98) drawLogo(t, P);
      if (t < 3.15) drawTrails(t, P);
      drawRipple(t, P);
      drawSpark(t, P);
      drawGlintLight(t);
      drawTagline(t);
      // dither grain
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.035; ctx.drawImage(grainC, 0, 0);
      ctx.restore();
    }

    return { draw, duration: DURATION };
  }

  global.Cleaniche = { create, DURATION };
})(typeof window !== 'undefined' ? window : globalThis);
