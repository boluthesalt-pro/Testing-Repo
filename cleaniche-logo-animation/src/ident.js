// Cleaniche — "One Clean Sweep" (10 s logo ident)
//
// Idea: the symbol is a single ribbon that spirals inward. We open on white (a clean space),
// the ribbon's edge sweeps through the frame in extreme macro, and one continuous pull-back
// reveals that sweep drawing the whole mark. The mark settles, slides aside and the wordmark
// emerges from behind it; the tagline rises word by word and its final full stop — the only
// orange in the piece — lands on the last note of the sonic logo.
//
// draw(t) is deterministic. The logo is drawn only from the supplied SVG path data.

(function (global) {
  'use strict';

  const C = { teal: '#067593', tealFresh: '#0C89AB', orange: '#FF621D', navy: '#0D2B2F', white: '#FFFFFF' };
  const TAGLINE = [['Clean', 'spaces.'], ['Clear', 'mindset']];   // the last full stop is drawn as the orange dot
  const DURATION = 10;
  const LOGO_BOX = { x0: 102, y0: 38.5, x1: 2127.1, y1: 367.9 };
  const SYM_C = { x: 359.9, y: 203.2 };
  const SYM_RIGHT = 617.8, WORD_X0 = 671;

  // ---------- maths ----------
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, u) => a + (b - a) * u;
  const prog = (t, a, b) => clamp((t - a) / (b - a));
  const smooth = u => u * u * (3 - 2 * u);
  // CSS-style cubic-bezier easing (designer curves).
  function bezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const X = s => ((ax * s + bx) * s + cx) * s, Y = s => ((ay * s + by) * s + cy) * s;
    const dX = s => (3 * ax * s + 2 * bx) * s + cx;
    return u => {
      if (u <= 0) return 0; if (u >= 1) return 1;
      let s = u;
      for (let i = 0; i < 8; i++) { const e = X(s) - u, d = dX(s); if (Math.abs(e) < 1e-6 || !d) break; s -= e / d; }
      return Y(clamp(s));
    };
  }
  const glide = bezier(0.7, 0, 0.12, 1);         // decisive start, long silky settle
  const rise = bezier(0.2, 0.75, 0.15, 1);       // typographic rise
  const easeOutSine = u => Math.sin(u * Math.PI / 2);
  const rgba = (h, a) => `rgba(${[1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)).join(',')},${a})`;

  function pchip(keys) {
    const n = keys.length, x = keys.map(k => k[0]), y = keys.map(k => k[1]);
    const d = [], m = new Array(n).fill(0);
    for (let i = 0; i < n - 1; i++) d.push((y[i + 1] - y[i]) / (x[i + 1] - x[i]));
    for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : 3 * (d[i - 1] + d[i]) / ((2 * d[i] + d[i - 1]) / d[i - 1] + (d[i] + 2 * d[i - 1]) / d[i]);
    return t => {
      if (t <= x[0]) return y[0];
      if (t >= x[n - 1]) return y[n - 1];
      let i = 0; while (t > x[i + 1]) i++;
      const h = x[i + 1] - x[i], s = (t - x[i]) / h;
      return (2 * s ** 3 - 3 * s ** 2 + 1) * y[i] + (s ** 3 - 2 * s ** 2 + s) * h * m[i] + (-2 * s ** 3 + 3 * s ** 2) * y[i + 1] + (s ** 3 - s ** 2) * h * m[i + 1];
    };
  }

  class Route {
    constructor(pts) {
      this.p = pts; this.s = [0];
      for (let i = 1; i < pts.length; i++) this.s.push(this.s[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      this.len = this.s[this.s.length - 1];
    }
    at(v) {
      v = clamp(v, 0, this.len);
      let lo = 0, hi = this.s.length - 1;
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (this.s[mid] <= v) lo = mid; else hi = mid; }
      const u = (v - this.s[lo]) / ((this.s[hi] - this.s[lo]) || 1);
      return [lerp(this.p[lo][0], this.p[hi][0], u), lerp(this.p[lo][1], this.p[hi][1], u)];
    }
    slice(a, b, step) {
      a = clamp(a, 0, this.len); b = clamp(b, 0, this.len);
      if (b <= a) return [];
      const n = Math.max(1, Math.ceil((b - a) / step)), out = [];
      for (let i = 0; i <= n; i++) out.push(this.at(a + (b - a) * i / n));
      return out;
    }
  }
  const concat = (...rs) => rs.reduce((acc, r) => acc.concat(acc.length ? r.slice(1) : r), []);

  function create(canvas, data) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const px = Math.min(W, H) / 1080;
    const portrait = H > W;

    const symPath = new Path2D(data.logo.symbol);
    const wordPath = new Path2D();
    for (const d of data.logo.wordmark) wordPath.addPath(new Path2D(d));

    // ---- layout: final lockup (logo + tagline) centred as a group ----
    const logoWpx = portrait ? 0.78 * W : 0.52 * W;
    const s = logoWpx / (LOGO_BOX.x1 - LOGO_BOX.x0);
    const logoHpx = (LOGO_BOX.y1 - LOGO_BOX.y0) * s;
    const tagSize = Math.round((portrait ? 44 : 41) * px);
    const gap = (portrait ? 78 : 70) * px;
    const groupH = logoHpx + gap + tagSize * 0.74;
    const logoLeft = (W - logoWpx) / 2, logoTop = (H - groupH) / 2;
    const symFinal = [logoLeft + (SYM_C.x - LOGO_BOX.x0) * s, logoTop + (SYM_C.y - LOGO_BOX.y0) * s];
    const tagBaseline = logoTop + logoHpx + gap + tagSize * 0.74;
    const symStart = [W / 2, H / 2];

    // ---- the sweep: one ribbon from the open tail, round the ring, splitting into the two waves ----
    const R = data.routes;
    const rev = a => a.slice().reverse();
    const main = new Route(concat(rev(R.outB), R.outA, R.lower, R.link));   // tail → top → left → bottom → C → lower wave → B → A
    const branch = new Route(R.upper);                                          // C → upper wave → B (splits off at C)
    const L_ring = new Route(R.outB).len + new Route(R.outA).len, L_low = new Route(R.lower).len;

    const CAM_S = 34;                                   // the camera starts parked on the ribbon, just above the tail
    const head = pchip([[0.30, 0], [0.62, 26], [0.98, 52], [1.6, 118], [2.35, 400], [2.95, 880], [3.45, L_ring],
                        [3.92, L_ring + L_low], [4.08, main.len]]);
    const branchAt = t => clamp((head(t) - L_ring) / L_low) * branch.len;
    const logZ = pchip([[0, Math.log(118)], [0.95, Math.log(108)], [1.6, Math.log(44)], [2.35, Math.log(9.5)],
                        [3.2, Math.log(2.15)], [4.1, 0]]);
    // a soft spring as the camera lands: pulls back ~3 % past rest, then settles
    const landing = t => { const u = t - 4.1; return u <= 0 ? 0 : -0.032 * Math.sin(2 * Math.PI * 1.45 * u) * Math.exp(-u / 0.22); };
    const zoom = t => Math.exp(logZ(t)) * (1 + landing(t));
    const camStart = main.at(CAM_S);

    function camera(t) {
      const z = zoom(t);
      const w = smooth(clamp((Math.log(60) - Math.log(Math.max(z, 1))) / (Math.log(60) - Math.log(1.25))));
      const tx = lerp(camStart[0], SYM_C.x, w), ty = lerp(camStart[1], SYM_C.y, w);
      // symbol slides into the lockup after it has formed
      const g = glide(prog(t, 4.55, 5.75));
      const ox = lerp(symStart[0], symFinal[0], g), oy = lerp(symStart[1], symFinal[1], g);
      return { z, tx, ty, ox, oy, g };
    }
    // final gentle push on the whole lockup, settled before the end
    const push = t => 1 + 0.022 * easeOutSine(prog(t, 5.4, 9.75));

    // ---- layers ----
    const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return [c, c.getContext('2d')]; };
    const [ribC, rib] = mk();

    function applyCam(c, cam, P) {
      const k = push(P);
      c.translate(W / 2, H / 2); c.scale(k, k); c.translate(-W / 2, -H / 2);
      c.translate(cam.ox, cam.oy); c.scale(s * cam.z, s * cam.z); c.translate(-cam.tx, -cam.ty);
    }

    // ---- reveal mask: thresholds the precomputed sweep-order field (src/reveal.png) on the GPU ----
    const revealMask = (() => {
      const glC = document.createElement('canvas'); glC.width = W; glC.height = H;
      const gl = glC.getContext('webgl', { premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: false });
      const meta = data.reveal.meta;
      const sh = (type, src) => { const o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o);
        if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
      const prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }'));
      gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, `precision highp float;
        uniform sampler2D tex; uniform vec2 texSize; uniform vec3 m0, m1, meta; uniform float H, head, soft, maxOrder;
        float dec(vec2 ij) { vec4 c = texture2D(tex, (ij + 0.5) / texSize); return (c.r * 65280.0 + c.g * 255.0) / 65535.0 * maxOrder; }
        void main() {
          vec3 sp = vec3(gl_FragCoord.x, H - gl_FragCoord.y, 1.0);
          vec2 u = vec2(dot(m0, sp), dot(m1, sp));
          vec2 tp = (u - meta.xy) * meta.z - 0.5;
          if (tp.x < 0.0 || tp.y < 0.0 || tp.x > texSize.x - 2.0 || tp.y > texSize.y - 2.0) { gl_FragColor = vec4(0.0); return; }
          vec2 i0 = floor(tp), f = tp - i0;
          // threshold each texel, then blend the results: clean edges where sweep order jumps (junctions)
          float a00 = clamp((head - dec(i0)) / soft + 0.5, 0.0, 1.0), a10 = clamp((head - dec(i0 + vec2(1.0, 0.0))) / soft + 0.5, 0.0, 1.0);
          float a01 = clamp((head - dec(i0 + vec2(0.0, 1.0))) / soft + 0.5, 0.0, 1.0), a11 = clamp((head - dec(i0 + vec2(1.0, 1.0))) / soft + 0.5, 0.0, 1.0);
          gl_FragColor = vec4(mix(mix(a00, a10, f.x), mix(a01, a11, f.x), f.y));
        }`));
      gl.linkProgram(prog); gl.useProgram(prog);
      const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, data.revealImage);
      for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]])
        gl.texParameteri(gl.TEXTURE_2D, k, v);
      const U = n => gl.getUniformLocation(prog, n);
      gl.uniform2f(U('texSize'), meta.w, meta.h); gl.uniform3f(U('meta'), meta.x0, meta.y0, meta.ppu);
      gl.uniform1f(U('H'), H); gl.uniform1f(U('maxOrder'), meta.maxOrder);
      gl.viewport(0, 0, W, H);
      return (M, headPos) => {
        const inv = M.inverse(), unitPx = Math.hypot(M.a, M.b);
        gl.uniform3f(U('m0'), inv.a, inv.c, inv.e); gl.uniform3f(U('m1'), inv.b, inv.d, inv.f);
        gl.uniform1f(U('head'), headPos); gl.uniform1f(U('soft'), clamp(1.6 / unitPx, 0.17, 4));   // ≥ one texel
        gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        return glC;
      };
    })();

    function drawSymbol(t, cam) {
      if (t >= 4.1) {                                   // complete: the supplied path, untouched
        ctx.save(); applyCam(ctx, cam, t); ctx.fillStyle = C.teal; ctx.fill(symPath); ctx.restore();
        return;
      }
      const h = head(t), b = branchAt(t);
      rib.setTransform(1, 0, 0, 1, 0, 0); rib.clearRect(0, 0, W, H);
      rib.save(); applyCam(rib, cam, t);
      rib.fillStyle = C.teal; rib.fill(symPath);
      const M = rib.getTransform();
      rib.setTransform(1, 0, 0, 1, 0, 0);
      rib.globalCompositeOperation = 'destination-in';
      rib.drawImage(revealMask(M, h), 0, 0);
      rib.setTransform(M);
      // the fresh end of the ribbon is a touch brighter, cooling to brand teal behind it
      rib.globalCompositeOperation = 'source-atop';
      const fresh = (route, sv) => {
        const [hx, hy] = route.at(sv), r = 130;
        const g = rib.createRadialGradient(hx, hy, 0, hx, hy, r);
        g.addColorStop(0, rgba(C.tealFresh, 0.85)); g.addColorStop(0.5, rgba(C.tealFresh, 0.35)); g.addColorStop(1, rgba(C.tealFresh, 0));
        rib.fillStyle = g; rib.fillRect(hx - r, hy - r, 2 * r, 2 * r);
      };
      fresh(main, h); if (b > 0 && b < branch.len) fresh(branch, b);
      rib.restore(); rib.globalCompositeOperation = 'source-over';
      ctx.drawImage(ribC, 0, 0);
    }

    const [wmC, wm] = mk();
    function drawWordmark(t, cam) {
      const u = glide(prog(t, 4.68, 5.85));
      if (u <= 0) return;
      const off = lerp(-420, 0, u);                     // slides out from behind the symbol
      wm.setTransform(1, 0, 0, 1, 0, 0); wm.clearRect(0, 0, W, H);
      wm.save();
      const k = push(t);
      wm.translate(W / 2, H / 2); wm.scale(k, k); wm.translate(-W / 2, -H / 2);
      // logo-space transform for the lockup, riding with the symbol's current position
      wm.translate(cam.ox - symFinal[0], cam.oy - symFinal[1]);
      wm.translate(logoLeft - LOGO_BOX.x0 * s, logoTop - LOGO_BOX.y0 * s); wm.scale(s, s);
      wm.save(); wm.translate(off, 0); wm.fillStyle = C.teal; wm.fill(wordPath); wm.restore();
      // emerges through a soft edge just right of the symbol
      // (the edge lives in the gap before the C, and is released as the word arrives)
      const e0 = SYM_RIGHT + 4, e1 = WORD_X0 - 2, rel = smooth(prog(t, 5.35, 5.8));
      const g = wm.createLinearGradient(e0, 0, e1, 0);
      g.addColorStop(0, `rgba(0,0,0,${rel})`); g.addColorStop(1, 'rgba(0,0,0,1)');
      wm.globalCompositeOperation = 'destination-in';
      wm.fillStyle = g; wm.fillRect(e0 - 600, -200, 4000, 900);
      wm.restore(); wm.globalCompositeOperation = 'source-over';
      ctx.drawImage(wmC, 0, 0);
    }

    // tagline: words rise out of a mask line, staggered; the final full stop is an orange dot
    let tagLayout = null;
    function layoutTag() {
      ctx.save();
      ctx.font = `500 ${tagSize}px Figtree`;
      ctx.letterSpacing = `${0.01 * tagSize}px`;
      const space = ctx.measureText(' ').width, phraseGap = tagSize * 0.42;
      const words = [];
      let x = 0;
      TAGLINE.forEach((phrase, pi) => {
        if (pi) x += phraseGap;
        phrase.forEach((w, wi) => { if (wi) x += space; const wd = ctx.measureText(w).width; words.push({ w, x, wd }); x += wd; });
      });
      const dotR = tagSize * 0.085, dotGap = tagSize * 0.07;
      const total = x + dotGap + dotR * 2;
      ctx.restore();
      const x0 = (W - total) / 2;
      words.forEach(o => (o.x += x0));
      return { words, dot: { x: x0 + x + dotGap + dotR, r: dotR } };
    }

    function drawTagline(t) {
      if (t < 6.0) return;
      if (!tagLayout) tagLayout = layoutTag();
      const k = push(t);
      ctx.save();
      ctx.translate(W / 2, H / 2); ctx.scale(k, k); ctx.translate(-W / 2, -H / 2);
      ctx.font = `500 ${tagSize}px Figtree`;
      ctx.letterSpacing = `${0.01 * tagSize}px`;
      ctx.fillStyle = C.navy; ctx.textBaseline = 'alphabetic';
      const starts = [6.02, 6.12, 6.42, 6.52];
      tagLayout.words.forEach((o, i) => {
        const u = rise(prog(t, starts[i], starts[i] + 0.75));
        if (u <= 0) return;
        ctx.save();
        ctx.beginPath(); ctx.rect(o.x - tagSize, tagBaseline - tagSize * 1.05, o.wd + 2 * tagSize, tagSize * 1.4); ctx.clip();
        ctx.fillText(o.w, o.x, tagBaseline + tagSize * 1.15 * (1 - u));
        ctx.restore();
      });
      // the orange full stop: drops into place with a tiny overshoot, on the last note
      const du = prog(t, 7.0, 7.42);
      if (du > 0) {
        const sc = du < 0.45 ? smooth(du / 0.45) * 1.32 : 1 + 0.32 * Math.exp(-(du - 0.45) / 0.12) * Math.cos((du - 0.45) * 14);
        ctx.fillStyle = C.orange;
        ctx.beginPath(); ctx.arc(tagLayout.dot.x, tagBaseline - tagLayout.dot.r * 1.02, tagLayout.dot.r * Math.max(0, sc), 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    function draw(t) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1; ctx.filter = 'none'; ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = C.white; ctx.fillRect(0, 0, W, H);
      const cam = camera(t);
      drawSymbol(t, cam);
      drawWordmark(t, cam);
      drawTagline(t);
    }

    return { draw, duration: DURATION };
  }

  global.CleanicheIdent = { create, DURATION };
})(typeof window !== 'undefined' ? window : globalThis);
