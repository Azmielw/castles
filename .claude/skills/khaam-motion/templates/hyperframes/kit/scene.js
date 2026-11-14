/*
  «موشن خام» scene kit, the pieces (scene.js). Needs kit.js first.
  Call a piece by name on a stage: S.sky(), S.stars({count: 90}), S.dunes({layer: "mid", y: 1260}) …
  Every colour is a palette role, so a style recolours the whole world; every number has a default.
  Pieces draw in stage coordinates (1080×1920), inside the layer they name.
*/
(function (K) {
  "use strict";
  var el = K.el, f1 = K.f1, PI = Math.PI;
  function rnd(r, a, b) { return a + (b - a) * r(); }
  function pick(r, arr) { return arr[Math.floor(r() * arr.length) % arr.length]; }
  function blend(e, mode) { e.style.mixBlendMode = mode; return e; }
  function wrap(S, layer, parent) { return el("g", null, parent || S.L(layer)); }

  // ======================= SKY =======================
  /** the sky gradient and the glow on the horizon. {horizon, glowX} */
  K.piece("sky", function (S, o) {
    var g = wrap(S, o.layer || "sky"), h = o.horizon || S.horizon;
    var fill = S.vgrad([[0, "sky0"], [0.42, "sky1"], [0.8, "sky2"], [1, "sky3"]], 0, 0, 0, h, "userSpaceOnUse");
    el("rect", { x: S.span[0] - 400, y: -900, width: S.span[1] - S.span[0] + 800, height: h + 1900, fill: fill }, g);
    var gx = o.glowX === undefined ? S.light.x : o.glowX;
    var glow = el("ellipse", { cx: gx, cy: h, rx: o.glowW || 980, ry: o.glowH || 420,
      fill: S.rgrad([[0, "glow", 0.85], [0.45, "glow", 0.32], [1, "glow", 0]]) }, g);
    S.level(glow, "glowLevel");
    return { g: g, glow: glow };
  });

  /** stars, seeded; a few twinkle. {count, top, bottom, seed, twinkle,
      out: {from, to, share: 1, dur: 0.45}} = the stars go out one by one, in a seeded order, between from and to
      (dawn coming); share < 1 lets only that share go out (the rest still follow the palette's stars level). */
  K.piece("stars", function (S, o) {
    var g = wrap(S, o.layer || "sky"), r = S.rng(o.seed || 11), n = o.count || 90, each = [], note = [];
    var top = o.top === undefined ? -200 : o.top, bot = o.bottom || S.horizon - 260;
    for (var i = 0; i < n; i++) {
      var x = rnd(r, S.span[0], S.span[1]), y = rnd(r, top, bot), k = r();
      var rad = k < 0.72 ? rnd(r, 0.9, 1.5) : k < 0.95 ? rnd(r, 1.6, 2.3) : rnd(r, 2.6, 3.3);
      var fade = Math.max(0.15, 1 - Math.max(0, (y - (bot - 380)) / 420));
      var sg = o.out ? el("g", null, g) : g;   // with out: each star in its own group, so going out never fights its twinkle
      var c = el("circle", { cx: f1(x), cy: f1(y), r: f1(rad) }, sg);
      S.paint(c, "fill", "star");
      c.style.opacity = (rnd(r, 0.35, 0.95) * fade).toFixed(2);
      note.push({ x: x, y: y, els: [o.out ? sg : c] });
      if (rad > 2.5) {
        var h = el("circle", { cx: f1(x), cy: f1(y), r: f1(rad * 3.2), filter: S.blur(3) }, sg);
        S.paint(h, "fill", "star"); h.style.opacity = 0.35 * fade;
        if (!o.out) note[note.length - 1].els.push(h);
      }
      if (r() < (o.twinkle === undefined ? 0.22 : o.twinkle))
        S.wave(c, "opacity", +c.style.opacity * 0.6, +c.style.opacity * 0.4, rnd(r, 1.4, 3.4), r());
      if (o.out) each.push(sg);
    }
    S.level(g, "stars");
    if (o.out) {
      var ro = S.rng((o.seed || 11) + 501), order = each.map(function (e) { return { e: e, k: ro() }; });
      order.sort(function (a, b) { return a.k - b.k; });
      var m = Math.round(order.length * (o.out.share === undefined ? 1 : o.out.share)), from = o.out.from || 0;
      var to = o.out.to === undefined ? S.duration - 1 : o.out.to, od = o.out.dur || 0.45;
      for (var j = 0; j < m; j++) {
        var t = from + (to - from) * (m > 1 ? j / (m - 1) : 0);
        S.tl.fromTo(order[j].e, { opacity: 1 }, { opacity: 0, duration: od, ease: "power1.in", immediateRender: false }, t);
      }
    }
    if (K.noteStars) K.noteStars(S, o.layer || "sky", note);   // none near a verified card's text while it is up (kit.js)
    return { g: g, stars: each };
  });

  /** the moon. {x, y, r, phase: "crescent" | "full" | "half", tilt} */
  K.piece("moon", function (S, o) {
    var g = wrap(S, o.layer || "sky"), x = o.x || 790, y = o.y || 430, R = o.r || 40;
    var glow = el("circle", { cx: x, cy: y, r: R * 7, fill: S.rgrad([[0, "moonGlow", 0.4], [0.35, "moonGlow", 0.12], [1, "moonGlow", 0]]) }, g);
    blend(glow, "screen");
    var disc;
    if ((o.phase || "crescent") === "full") {
      disc = el("circle", { cx: x, cy: y, r: R }, g); S.paint(disc, "fill", "moon");
      [[-0.3, -0.2, 0.28], [0.25, 0.15, 0.2], [-0.05, 0.4, 0.16]].forEach(function (m) {
        var c = el("circle", { cx: f1(x + m[0] * R), cy: f1(y + m[1] * R), r: f1(m[2] * R) }, g);
        S.paint(c, "fill", { role: "moon", shade: -0.12 }); c.style.opacity = 0.5;
      });
    } else {
      var id = S.id("m"), mk = el("mask", { id: id }, S.defs);
      el("circle", { cx: x, cy: y, r: R, fill: "#fff" }, mk);
      var t = (o.tilt === undefined ? -25 : o.tilt) * PI / 180, off = o.phase === "half" ? R : R * 0.62;
      el("circle", { cx: f1(x + off * Math.cos(t)), cy: f1(y + off * Math.sin(t)), r: f1(R * 1.02), fill: "#000" }, mk);
      disc = el("circle", { cx: x, cy: y, r: R, mask: "url(#" + id + ")" }, g); S.paint(disc, "fill", "moon");
    }
    S.level(g, "moonLevel");
    return { g: g, disc: disc };
  });

  /** the sun with its glow; can rise. {x, y, r, rise: {from: dy, at, dur}} */
  K.piece("sun", function (S, o) {
    var w = wrap(S, o.layer || "sky"), x = o.x === undefined ? S.light.x : o.x, y = o.y || S.horizon - 40, R = o.r || 64;
    var big = el("circle", { cx: x, cy: y, r: R * 10, fill: S.rgrad([[0, "sunGlow", 0.55], [0.3, "sunGlow", 0.2], [1, "sunGlow", 0]]) }, w);
    blend(big, "screen");
    var mid = el("circle", { cx: x, cy: y, r: R * 2.6, fill: S.rgrad([[0, "sun", 0.9], [0.5, "sun", 0.35], [1, "sun", 0]]) }, w);
    blend(mid, "screen");
    var disc = el("circle", { cx: x, cy: y, r: R }, w); S.paint(disc, "fill", "sun");
    S.level(w, "sunLevel");
    if (o.rise) S.tl.fromTo(w, { y: o.rise.from || 160 }, { y: 0, duration: o.rise.dur || 3, ease: o.rise.ease || "power2.out" }, o.rise.at || 0);
    return { g: w, disc: disc };
  });

  /** flat clouds with a lit rim and a shaded base. {y, count, seed, minW, maxW, drift, driftSpeed, part: {at, dur, dx}, alpha}
      drift = pixels over the whole stage duration (each cloud 0.6–1.2 × that; −2300 over 19.5 s ≈ 118 px/s), not px/s;
      or driftSpeed = px/s (negative = to the left). "Time runs fast": a few hundred px/s. */
  K.piece("clouds", function (S, o) {
    var layer = S.L(o.layer || "sky"), r = S.rng(o.seed || 21), n = o.count || 5;
    var y0 = o.y === undefined ? S.horizon - 520 : o.y, spread = o.spread || 260, list = [];
    S._cloudRims = S._cloudRims || [];
    for (var i = 0; i < n; i++) {
      var w = rnd(r, o.minW || 380, o.maxW || 720), h = w * rnd(r, 0.16, 0.24);
      var cx = S.span[0] + (S.span[1] - S.span[0]) * ((i + rnd(r, 0.1, 0.9)) / n), cy = y0 + rnd(r, -spread / 2, spread / 2);
      var outer = el("g", null, layer), g = el("g", null, outer);
      var bumps = 4 + Math.floor(r() * 4), blobs = [];
      for (var b = 0; b < bumps; b++) {
        var t = (b + 0.5) / bumps, bx = cx - w / 2 + w * t, bell = Math.sin(PI * t);
        var br = h * (0.45 + 0.65 * bell) * rnd(r, 0.8, 1.1);
        blobs.push([bx, cy - br * 0.35, br * 1.25, br]);
      }
      var id = S.id("c"), cp = el("clipPath", { id: id }, S.defs);
      el("rect", { x: f1(cx - w), y: f1(cy - h * 4), width: f1(w * 2), height: f1(h * 4 + h * 0.18) }, cp);
      function blobSet(parent, dy, spec, sc) {
        var gg = el("g", { "clip-path": "url(#" + id + ")" }, parent);
        blobs.forEach(function (B) { var e = el("ellipse", { cx: f1(B[0]), cy: f1(B[1] + dy), rx: f1(B[2] * (sc || 1)), ry: f1(B[3] * (sc || 1)) }, gg); S.paint(e, "fill", spec); });
        el("rect", { x: f1(cx - w / 2), y: f1(cy - h * 0.2 + dy), width: f1(w), height: f1(h * 0.38), rx: f1(h * 0.19) }, gg);
        S.paint(gg.lastChild, "fill", spec);
        return gg;
      }
      var rim = blobSet(g, -4, "cloudLit"); S.level(rim, "rimLevel", o.rim === undefined ? 1 : o.rim); S._cloudRims.push(rim);
      blobSet(g, 0, "cloud");
      var shade = blobSet(g, h * 0.32, "cloudShade", 0.92); shade.style.opacity = 0.8;
      outer.style.opacity = o.alpha === undefined ? 1 : o.alpha;
      var drift = o.drift || (o.driftSpeed ? o.driftSpeed * S.duration : 0);
      if (drift) S.tl.fromTo(outer, { x: 0 }, { x: drift * rnd(r, 0.6, 1.2), duration: S.duration, ease: "none" }, 0);
      if (o.part) {
        var side = cx < (o.part.x === undefined ? S.light.x : o.part.x) ? -1 : 1;
        S.tl.to(g, { x: side * (o.part.dx || 420) * rnd(r, 0.7, 1.15), duration: o.part.dur || 2.4, ease: "power2.inOut" }, o.part.at || 0);
      }
      list.push(outer);
    }
    return { list: list };
  });

  // ======================= LAND =======================
  function ridge(S, r, y, height, step, freq) {
    var ph = [r() * 9, r() * 9, r() * 9], fr = freq || 1, pts = [];
    for (var x = S.span[0] - 60; x <= S.span[1] + 60; x += step) {
      var v = 0.55 * Math.sin(x * 0.0021 * fr + ph[0]) + 0.3 * Math.sin(x * 0.0047 * fr + ph[1]) + 0.15 * Math.sin(x * 0.011 * fr + ph[2]);
      pts.push([x, y - height * (0.5 + 0.5 * v)]);
    }
    return pts;
  }
  function closeDown(S, pts, bottom) {
    var d = K.smooth(pts, false);
    return d + "L" + f1(pts[pts.length - 1][0]) + " " + f1(bottom) + "L" + f1(pts[0][0]) + " " + f1(bottom) + "Z";
  }
  /** rolling hills or mountains. {layer, y, height, role, seed, freq, haze, rim} */
  K.piece("hills", function (S, o) {
    var g = wrap(S, o.layer || "far"), r = S.rng(o.seed || 31), y = o.y || S.horizon, H = o.height || 140;
    var pts = ridge(S, r, y, H, 24, o.freq), d = closeDown(S, pts, y + 1600);
    var body = el("path", { d: d }, g); S.paint(body, "fill", o.role ? o.role : { role: "far" });
    if (o.haze !== 0) {
      var hz = el("path", { d: d, fill: S.vgrad([[0, "haze", 0], [1, "haze", o.haze || 0.55]], 0, y - H * 0.4, 0, y + 40, "userSpaceOnUse") }, g);
      hz.style.pointerEvents = "none";
    }
    if (o.rim) {
      var rim = el("path", { d: K.smooth(pts, false), fill: "none", "stroke-width": o.rim === true ? 2.5 : o.rim, "stroke-linecap": "round" }, g);
      S.paint(rim, "stroke", "rim"); S.level(rim, "rimLevel", 0.8);
    }
    return { g: g, top: pts };
  });

  /** desert dunes with sharp ridges, a lit face and a shadow face. {layer, y, height, count, seed, tone} */
  K.piece("dunes", function (S, o) {
    var g = wrap(S, o.layer || "mid"), r = S.rng(o.seed || 41), y = o.y || S.horizon + 40, H = o.height || 180;
    var n = o.count || 3, tone = o.tone || 0, lightLeft = (o.light ? o.light === "left" : S.light.x < S.W / 2);
    var lit = { role: "duneLit", mix: "haze", k: tone }, shade = { role: "duneShade", mix: "haze", k: tone * 0.8 };
    var x0 = S.span[0] - 120, x1 = S.span[1] + 120, step = (x1 - x0) / n, dunes = [], i;
    var vy = [];
    for (i = 0; i <= n; i++) vy.push(y - rnd(r, 0, H * 0.18));
    for (i = 0; i < n; i++) {
      var xl = x0 + i * step, xr = xl + step, xp = xl + step * rnd(r, 0.35, 0.65), yp = y - H * rnd(r, 0.65, 1);
      dunes.push({ xl: xl, xr: xr, xp: xp, yp: yp, yl: vy[i], yr: vy[i + 1] });
    }
    var d = "M" + f1(x0) + " " + f1(vy[0]);
    dunes.forEach(function (D) {
      // up the windward slope (convex), sharp crest, down the slip face (concave)
      d += "Q" + f1(D.xl + (D.xp - D.xl) * 0.55) + " " + f1(D.yp + (D.yl - D.yp) * 0.05) + " " + f1(D.xp) + " " + f1(D.yp);
      d += "Q" + f1(D.xp + (D.xr - D.xp) * 0.3) + " " + f1(D.yp + (D.yr - D.yp) * 0.75) + " " + f1(D.xr) + " " + f1(D.yr);
    });
    d += "L" + f1(x1) + " " + f1(y + 1600) + "L" + f1(x0) + " " + f1(y + 1600) + "Z";
    var body = el("path", { d: d }, g); S.paint(body, "fill", lit);
    dunes.forEach(function (D) {
      var sd, inner;
      if (lightLeft) {   // shadow on the right (slip) face
        inner = [D.xp + (D.xr - D.xp) * 0.12, D.yp + (D.yr - D.yp) * 0.55];
        sd = "M" + f1(D.xp) + " " + f1(D.yp) + "Q" + f1(D.xp + (D.xr - D.xp) * 0.3) + " " + f1(D.yp + (D.yr - D.yp) * 0.75) + " " + f1(D.xr) + " " + f1(D.yr) +
          "Q" + f1(inner[0]) + " " + f1(D.yr) + " " + f1(inner[0]) + " " + f1(inner[1]) + "Q" + f1(D.xp + 4) + " " + f1(D.yp + 30) + " " + f1(D.xp) + " " + f1(D.yp) + "Z";
      } else {           // shadow on the left (windward) face, a soft wedge
        inner = [D.xp - (D.xp - D.xl) * 0.2, D.yp + (D.yl - D.yp) * 0.5];
        sd = "M" + f1(D.xp) + " " + f1(D.yp) + "Q" + f1(D.xl + (D.xp - D.xl) * 0.55) + " " + f1(D.yp + (D.yl - D.yp) * 0.05) + " " + f1(D.xl) + " " + f1(D.yl) +
          "Q" + f1(inner[0]) + " " + f1(D.yl) + " " + f1(inner[0]) + " " + f1(inner[1]) + "Q" + f1(D.xp - 4) + " " + f1(D.yp + 30) + " " + f1(D.xp) + " " + f1(D.yp) + "Z";
      }
      var s = el("path", { d: sd }, g); S.paint(s, "fill", shade);
      if (o.rim !== false) {
        var rr = el("path", { d: "M" + f1(D.xp - (D.xp - D.xl) * 0.5) + " " + f1(D.yp + (D.yl - D.yp) * 0.2) + "Q" + f1(D.xp - (D.xp - D.xl) * 0.2) + " " + f1(D.yp + 2) + " " + f1(D.xp) + " " + f1(D.yp),
          fill: "none", "stroke-width": 2, "stroke-linecap": "round" }, g);
        S.paint(rr, "stroke", "rim"); S.level(rr, "rimLevel", 0.6);
      }
    });
    var base = el("path", { d: d, fill: S.vgrad([[0, "haze", 0], [1, "haze", o.haze === undefined ? 0.35 : o.haze]], 0, y - H, 0, y + 60, "userSpaceOnUse") }, g);
    base.style.opacity = 1;
    return { g: g, dunes: dunes };
  });

  /** the ground plane: lighter far, darker near, a little texture. {y, texture: sand|soil|grass|stone|none, seed} */
  K.piece("ground", function (S, o) {
    var g = wrap(S, o.layer || "ground"), r = S.rng(o.seed || 51), y = o.y || S.horizon + 120;
    var top = o.top || "groundTop", base = o.role || "ground";
    var fill = S.vgrad([[0, top], [0.35, base], [1, { role: base, shade: -0.35 }]], 0, y, 0, S.H + 200, "userSpaceOnUse");
    var edge = o.edge ? K.smooth(ridge(S, r, y + 6, o.edge, 40), false) : null;
    if (edge) el("path", { d: edge + "L" + f1(S.span[1] + 60) + " " + f1(S.H + 900) + "L" + f1(S.span[0] - 60) + " " + f1(S.H + 900) + "Z", fill: fill }, g);
    else el("rect", { x: S.span[0] - 300, y: y, width: S.span[1] - S.span[0] + 600, height: S.H - y + 900, fill: fill }, g);
    var tex = o.texture || "sand", n = o.marks || 70;
    if (tex !== "none") {
      var tg = el("g", null, g); tg.style.opacity = o.markAlpha || 0.35;
      for (var i = 0; i < n; i++) {
        var py = y + Math.pow(r(), 1.6) * (S.H - y + 120), k = (py - y) / (S.H - y), px = rnd(r, S.span[0], S.span[1]), m;
        if (tex === "sand") { m = el("path", { d: "M" + f1(px) + " " + f1(py) + "q" + f1(14 + 40 * k) + " " + f1(-3 - 3 * k) + " " + f1(28 + 80 * k) + " 0", fill: "none", "stroke-width": f1(1.2 + 2 * k), "stroke-linecap": "round" }, tg); S.paint(m, "stroke", { role: base, shade: -0.35 }); }
        else if (tex === "stone") { m = el("ellipse", { cx: f1(px), cy: f1(py), rx: f1(3 + 9 * k), ry: f1(1.5 + 4 * k) }, tg); S.paint(m, "fill", { role: base, shade: -0.4 }); }
        else if (tex === "grass") { m = el("path", { d: "M" + f1(px) + " " + f1(py) + "l" + f1(-3 - 4 * k) + " " + f1(-8 - 14 * k) + "M" + f1(px) + " " + f1(py) + "l" + f1(2 + 3 * k) + " " + f1(-10 - 16 * k), fill: "none", "stroke-width": f1(1.4 + 1.6 * k), "stroke-linecap": "round" }, tg); S.paint(m, "stroke", "foliage"); }
        else { m = el("path", { d: "M" + f1(px - 30 - 60 * k) + " " + f1(py) + "h" + f1(60 + 120 * k), "stroke-width": f1(1 + 2 * k), "stroke-linecap": "round" }, tg); S.paint(m, "stroke", { role: base, shade: -0.3 }); }
      }
    }
    return { g: g, y: y };
  });

  /** a band of haze between depth layers (aerial depth). {y, h, alpha, layer} */
  K.piece("haze", function (S, o) {
    var g = wrap(S, o.layer || "mid"), y = o.y || S.horizon, h = o.h || 160;
    el("rect", { x: S.span[0] - 300, y: f1(y - h / 2), width: S.span[1] - S.span[0] + 600, height: h,
      fill: S.vgrad([[0, "haze", 0], [0.5, "haze", o.alpha === undefined ? 0.5 : o.alpha], [1, "haze", 0]]) }, g);
    return { g: g };
  });

  /** rocks: flat polygons with a lit facet. {y, count, x0, x1, size, seed, layer} */
  K.piece("rocks", function (S, o) {
    var g = wrap(S, o.layer || "ground"), r = S.rng(o.seed || 61), n = o.count || 4, list = [];
    for (var i = 0; i < n; i++) {
      var x = o.at ? o.at[i] : rnd(r, o.x0 === undefined ? S.span[0] : o.x0, o.x1 === undefined ? S.span[1] : o.x1);
      var y = (o.y || S.horizon + 200) + (o.at ? 0 : rnd(r, -10, 30)), s = (o.size || 60) * rnd(r, 0.6, 1.3);
      var pts = [[-1, 0], [-0.85, -0.45], [-0.4, -0.8], [0.15, -0.7], [0.6, -0.5], [0.95, -0.15], [1, 0]].map(function (p) { return [x + p[0] * s * rnd(r, 0.9, 1.1), y + p[1] * s * 0.7 * rnd(r, 0.8, 1.2)]; });
      var body = el("path", { d: K.poly(pts, true) }, g); S.paint(body, "fill", o.role || { role: "near", shade: -0.1 });
      var litLeft = S.light.x < x, facet = litLeft ? [pts[0], pts[1], pts[2], pts[3], [x - s * 0.1, y - s * 0.25]] : [pts[3], pts[4], pts[5], pts[6], [x + s * 0.1, y - s * 0.25]];
      var f = el("path", { d: K.poly(facet, true) }, g); S.paint(f, "fill", { role: o.role || "near", mix: "rim", k: 0.22 });
      list.push(body);
    }
    return { g: g, list: list };
  });

  // ======================= WATER =======================
  /** the sea (or a pool with clip): gradient water, ripples in perspective, a path of light under the moon or sun.
      {y: horizon line, lightX, rows, path: true, shimmer: true, layer, clip: {cx, cy, rx, ry}} */
  K.piece("sea", function (S, o) {
    var layer = S.L(o.layer || "mid"), r = S.rng(o.seed || 71), y = o.y || S.horizon, lx = o.lightX === undefined ? S.light.x : o.lightX;
    var g = el("g", null, layer), bottom = o.bottom || S.H + 300;
    if (o.clip) {
      var id = S.id("w"), cp = el("clipPath", { id: id }, S.defs);
      el("ellipse", { cx: o.clip.cx, cy: o.clip.cy, rx: o.clip.rx, ry: o.clip.ry }, cp);
      g.setAttribute("clip-path", "url(#" + id + ")");
      y = o.clip.cy - o.clip.ry; bottom = o.clip.cy + o.clip.ry;
    }
    var depth = bottom - y;
    el("rect", { x: S.span[0] - 300, y: f1(y), width: S.span[1] - S.span[0] + 600, height: f1(depth + 400),
      fill: S.vgrad([[0, { role: "water", mix: "sky3", k: 0.45 }], [0.18, "water"], [1, "waterDeep"]], 0, y, 0, y + Math.max(400, depth), "userSpaceOnUse") }, g);
    var line = el("rect", { x: S.span[0] - 300, y: f1(y - 1), width: S.span[1] - S.span[0] + 600, height: 2.5 }, g);
    S.paint(line, "fill", { role: "glow", mix: "water", k: 0.35 }); line.style.opacity = 0.7;
    var rows = o.rows || 34, rip = el("g", null, g), pathG = el("g", null, g);
    for (var k = 1; k <= rows; k++) {
      var t = k / rows, ry = y + 4 + Math.pow(t, 1.75) * (depth - 10), persp = 0.25 + t * 1.6;
      var nd = 2 + Math.floor(r() * 4);
      for (var j = 0; j < nd; j++) {
        var len = rnd(r, 40, 240) * persp, x = rnd(r, S.span[0], S.span[1]);
        if (Math.abs(x - lx) < 60 * persp && o.path !== false) continue;
        var ln = el("path", { d: "M" + f1(x) + " " + f1(ry) + "h" + f1(len), "stroke-width": f1(1 + persp * 1.1), "stroke-linecap": "round" }, rip);
        S.paint(ln, "stroke", "ripple"); ln.style.opacity = rnd(r, 0.25, 0.6).toFixed(2);
      }
      if (o.path !== false) {
        var pw = (24 + (ry - y) * (o.pathWidth || 0.34)) * rnd(r, 0.55, 1.15), off = rnd(r, -0.12, 0.12) * pw;
        var dash = el("path", { d: "M" + f1(lx - pw / 2 + off) + " " + f1(ry) + "h" + f1(pw), "stroke-width": f1(1.6 + persp * 1.8), "stroke-linecap": "round" }, pathG);
        S.paint(dash, "stroke", "path");
        var a0 = rnd(r, 0.55, 1);
        dash.style.opacity = a0;
        if (o.shimmer !== false) S.wave(dash, "opacity", a0 * 0.62, a0 * 0.38, rnd(r, 0.7, 1.6), r());
        if (r() < 0.6) {
          var sw = pw * rnd(r, 0.15, 0.35), sx = lx + (r() < 0.5 ? -1 : 1) * pw * rnd(r, 0.55, 0.95);
          var side = el("path", { d: "M" + f1(sx - sw / 2) + " " + f1(ry) + "h" + f1(sw), "stroke-width": f1(1.2 + persp), "stroke-linecap": "round" }, pathG);
          S.paint(side, "stroke", "path"); side.style.opacity = 0.45;
        }
      }
    }
    S.level(pathG, "pathLevel");
    if (o.drift !== false) S.wave(rip, "x", 0, 7, 3.6, 0);
    return { g: g, y: y };
  });
  /** a pool or an oasis spring: the sea clipped to an ellipse, with a bank. {x, y, rx, ry, layer} */
  K.piece("pool", function (S, o) {
    var x = o.x || 540, y = o.y || S.horizon + 200, rx = o.rx || 260, ry = o.ry || 46, layer = o.layer || "ground";
    var g = wrap(S, layer);
    var bank = el("ellipse", { cx: x, cy: f1(y + 4), rx: f1(rx + 8), ry: f1(ry + 5) }, g); S.paint(bank, "fill", { role: "groundTop", shade: -0.12 });
    S.sea({ layer: layer, clip: { cx: x, cy: y, rx: rx, ry: ry }, lightX: o.lightX === undefined ? Math.max(x - rx * 0.6, Math.min(x + rx * 0.6, S.light.x)) : o.lightX, rows: o.rows || 9, pathWidth: 0.9, seed: o.seed });
    var lip = el("path", { d: "M" + f1(x - rx) + " " + f1(y) + "A" + rx + " " + ry + " 0 0 1 " + f1(x + rx) + " " + f1(y), fill: "none", "stroke-width": 3 }, S.L(layer));
    S.paint(lip, "stroke", { role: "groundTop", mix: "rim", k: 0.3 }); lip.style.opacity = 0.7;
    return { g: g };
  });

  /** under the sea: depth gradient, light shafts from the surface, drifting motes. {y: surface line, layer} */
  K.piece("underwater", function (S, o) {
    var g = wrap(S, o.layer || "under"), y = o.y || S.H + 60, r = S.rng(o.seed || 81);   // the depths wait one screen below; dive() brings them up
    S._underTop = y;
    el("rect", { x: S.span[0] - 300, y: y, width: S.span[1] - S.span[0] + 600, height: S.H * 2.2,
      fill: S.vgrad([[0, { role: "water", mix: "sky3", k: 0.25 }], [0.25, "water"], [1, { role: "waterDeep", shade: -0.45 }]], 0, y, 0, y + S.H * 1.8, "userSpaceOnUse") }, g);
    var surf = el("path", { d: K.smooth(ridge(S, r, y + 10, 10, 40, 3), false), fill: "none", "stroke-width": 3 }, g);
    S.paint(surf, "stroke", "path"); surf.style.opacity = 0.5;
    S.rays({ layer: o.layer || "under", x: o.lightX || S.light.x, y: y + 10, angle: 90, spread: 50, count: 7, length: S.H * 1.4, width: 140, color: "path", alpha: 0.13 });
    for (var i = 0; i < (o.motes || 40); i++) {
      var m = el("circle", { cx: f1(rnd(r, S.span[0], S.span[1])), cy: f1(y + rnd(r, 60, S.H * 1.6)), r: f1(rnd(r, 1, 3)) }, g);
      S.paint(m, "fill", "path"); m.style.opacity = rnd(r, 0.15, 0.45);
      S.wave(m, "y", 0, rnd(r, 6, 18), rnd(r, 3, 6), r());
    }
    return { g: g };
  });

  // ======================= BUILT =======================
  function crenels(x, y, w, size) {   // Najdi saw-tooth parapet
    var n = Math.max(2, Math.round(w / (size * 1.6))), step = w / n, d = "";
    for (var i = 0; i < n; i++) {
      var a = x + i * step + step * 0.18, b = x + (i + 1) * step - step * 0.18;
      d += "M" + f1(a) + " " + f1(y) + "L" + f1((a + b) / 2) + " " + f1(y - size) + "L" + f1(b) + " " + f1(y) + "Z";
    }
    return d;
  }
  function archPath(x, y, w, h, pointed) {   // a door or window arch, bottom at y
    var r = w / 2;
    if (pointed) return "M" + f1(x - r) + " " + f1(y) + "V" + f1(y - h + r * 1.2) + "Q" + f1(x - r) + " " + f1(y - h + r * 0.2) + " " + f1(x) + " " + f1(y - h) +
      "Q" + f1(x + r) + " " + f1(y - h + r * 0.2) + " " + f1(x + r) + " " + f1(y - h + r * 1.2) + "V" + f1(y) + "Z";
    return "M" + f1(x - r) + " " + f1(y) + "V" + f1(y - h + r) + "A" + f1(r) + " " + f1(r) + " 0 0 1 " + f1(x + r) + " " + f1(y - h + r) + "V" + f1(y) + "Z";
  }
  K.archPath = archPath;

  // windows that wake one by one: a lit copy over a dark window, dark until its time, then it lights with a little
  // catch (the lamp takes), out of relight's hands until a relight that starts after it woke (that one retints it)
  function wakeWindow(S, w, t, level) {
    if (!w.lit) {   // drawn right over the dark window (so later pieces still stand in front of it)
      w.lit = el("path", { d: w.d }); S.paint(w.lit, "fill", "windowLit");
      w.glow = el("circle", { cx: f1(w.x), cy: f1(w.y), r: 34, fill: S.rgrad([[0, "windowLit", 0.35], [1, "windowLit", 0]]) });
      blend(w.glow, "screen");
      w.el.parentNode.insertBefore(w.glow, w.el.nextSibling); w.el.parentNode.insertBefore(w.lit, w.el.nextSibling);
    } else {   // a window that was lit by the palette: take it out of the level list, it wakes on its own now
      S.levels = S.levels.filter(function (L) { return L.el !== w.lit && L.el !== w.glow; });
    }
    var a = level === undefined ? 0.95 : level, tl = S.tl;
    w.lit.style.opacity = 0; if (w.glow) w.glow.style.opacity = 0;
    tl.fromTo(w.lit, { opacity: 0 }, { opacity: a, duration: 0.16, ease: "power1.out", immediateRender: false }, t);
    tl.fromTo(w.lit, { opacity: a }, { opacity: a * 0.65, duration: 0.07, ease: "none", immediateRender: false }, t + 0.2);
    tl.fromTo(w.lit, { opacity: a * 0.65 }, { opacity: a, duration: 0.14, ease: "power1.out", immediateRender: false }, t + 0.3);
    if (w.glow) tl.fromTo(w.glow, { opacity: 0 }, { opacity: 1, duration: 0.6, ease: "power1.out", immediateRender: false }, t + 0.05);
    w.woke = t;
    if (!S._wakeHook) {   // a relight that starts after a window woke sets it to the new palette's windows level
      S._wakeHook = []; S.onRelight(function (from, next, at, dur, ease) {
        var v = next.windows === undefined ? 1 : next.windows;
        S._wakeHook.forEach(function (W) { if (W.woke + 0.45 <= at) S.tl.to([W.lit].concat(W.glow ? [W.glow] : []), { opacity: W.level * v, duration: dur, ease: ease }, at); });
      });
    }
    w.level = a; S._wakeHook.push(w);
  }
  /** wake windows on cue. list: windows (from house() or town()); times: [t…]; opts: {order: "random"|"left"|"right",
      seed, filter(w, t) → true to allow, inView: true (on screen at t and 2 s later, from the camera moves called so far),
      layer (for inView), level} */
  function wakeList(S, list, times, opts) {
    opts = opts || {};
    var r = S.rng(opts.seed || 707), pool = list.slice();
    if (opts.order === "left") pool.sort(function (a, b) { return a.x - b.x; });
    else if (opts.order === "right") pool.sort(function (a, b) { return b.x - a.x; });
    var lyr = opts.layer || "near", used = {};
    times.forEach(function (t) {
      var c = pool.filter(function (w) {
        if (w.woke !== undefined || used[w.i]) return false;
        if (opts.filter && !opts.filter(w, t)) return false;
        if (opts.inView) { var p = S.toScreen(lyr, w.x, w.y, t), q = S.toScreen(lyr, w.x, w.y, t + 2); if (p.x < 120 || p.x > S.W - 120 || q.x < 60 || q.x > S.W - 60 || p.y < 0 || p.y > S.H) return false; }
        return true;
      });
      if (!c.length) return;
      var w = opts.order === "left" || opts.order === "right" ? c[0] : c[Math.floor(r() * c.length)];
      used[w.i] = true;
      wakeWindow(S, w, t, opts.level);
    });
  }
  K.wakeWindows = function (S, list, times, opts) { list.forEach(function (w, i) { if (w.i === undefined) w.i = i; }); wakeList(S, list, times, opts); };

  /** one building in the Najdi or plain manner. Used by town(); callable alone: {x, y, w, h, style, door, lit,
      wake: [t…] | {at: [t…], order, inView, level}} → {g, windows: [{x, y, el, lit, glow, d}]}
      (lit/glow are null for a dark window until it wakes). No window is drawn where the door stands. */
  K.piece("house", function (S, o) {
    var g = o.parent || wrap(S, o.layer || "near"), r = S.rng(o.seed || 91), x = o.x, y = o.y, w = o.w || 160, h = o.h || 180;
    var tone = o.tone || 0, lightLeft = S.light.x < x + w / 2, side = o.side === undefined ? Math.max(10, w * 0.1) : o.side;
    function C(role, sh) { return { role: role, mix: "haze", k: tone, shade: sh }; }
    var front = el("rect", { x: f1(x), y: f1(y - h), width: f1(w), height: f1(h) }, g); S.paint(front, "fill", C("wall"));
    var sx = lightLeft ? x + w : x - side;
    var sd = el("path", { d: K.poly([[sx, y - h + 6], [sx + side, y - h - 4], [sx + side, y], [sx, y]].map(function (p) { return lightLeft ? p : [p[0], p[1]]; }), true) }, g);
    if (!lightLeft) sd.setAttribute("d", K.poly([[x, y - h + 6], [x - side, y - h - 4], [x - side, y], [x, y]], true));
    S.paint(sd, "fill", C("wallShade"));
    var style = o.style || "najdi";
    if (style === "najdi") {
      var cr = el("path", { d: crenels(x, y - h + 1, w, Math.min(16, w * 0.09)) }, g); S.paint(cr, "fill", C("wall"));
      var band = el("rect", { x: f1(x), y: f1(y - h + 14), width: f1(w), height: 5 }, g); S.paint(band, "fill", C("wallShade"));
      var nb = Math.max(2, Math.floor(w / 46));
      for (var b = 0; b < nb; b++) { var bx = x + (b + 0.5) * w / nb; var bm = el("rect", { x: f1(bx - 2), y: f1(y - h + 24), width: 4, height: 9 }, g); S.paint(bm, "fill", C("wood")); }
      var nv = Math.max(1, Math.floor(w / 60));
      for (var v = 0; v < nv; v++) { var vx = x + (v + 0.5) * w / nv, tri = el("path", { d: "M" + f1(vx - 6) + " " + f1(y - h + 46) + "l6 -10l6 10Z" }, g); S.paint(tri, "fill", C("window")); }
    } else {
      var cap = el("rect", { x: f1(x - 4), y: f1(y - h - 6), width: f1(w + 8), height: 8 }, g); S.paint(cap, "fill", C("wallShade"));
    }
    var rows = Math.max(0, Math.floor((h - 90) / 70)), cols = Math.max(1, Math.floor(w / 56)), windows = [];
    var ddx = x + w * (o.doorAt === undefined ? 0.5 : o.doorAt), ddw = Math.min(54, w * 0.34);   // the door's box: no window there
    for (var i = 0; i < rows; i++) for (var j = 0; j < cols; j++) {
      if (r() < 0.25) continue;
      var wx = x + (j + 0.5) * w / cols, wy = y - h + 70 + i * 70, lit = r() < (o.lit === undefined ? 0.35 : o.lit);
      var lv = lit ? rnd(r, 0.7, 1) : 0;   // drawn or not, the same random numbers are used (the rest of the house stays)
      if (o.door && Math.abs(wx - ddx) < (ddw + 10) / 2 + 9 + 6 && wy + 26 > y - (ddw * 1.9 + 6) - 6) { if (lit) S.id("r"); continue; }   // (the id its glow would take: later pieces keep their seeds)
      var wd = archPath(wx, wy + 26, 18, 30, style === "najdi"), wr = { x: wx, y: wy + 12, d: wd, parent: g, lit: null, glow: null };
      var win = el("path", { d: wd }, g);
      S.paint(win, "fill", C("window")); wr.el = win;
      if (lit) {
        var wl = el("path", { d: wd }, g); S.paint(wl, "fill", "windowLit"); S.level(wl, "windows", lv);
        var gl = el("circle", { cx: f1(wx), cy: f1(wy + 12), r: 34, fill: S.rgrad([[0, "windowLit", 0.35], [1, "windowLit", 0]]) }, g); S.level(gl, "windows"); blend(gl, "screen");
        wr.lit = wl; wr.glow = gl;
      }
      windows.push(wr);
    }
    if (o.door) {
      var dx = ddx, dw = ddw;
      var frame = el("path", { d: archPath(dx, y, dw + 10, dw * 1.9 + 6, style === "najdi") }, g); S.paint(frame, "fill", C("wallShade"));
      var door = el("path", { d: archPath(dx, y, dw, dw * 1.9, style === "najdi") }, g); S.paint(door, "fill", C("wood"));
      var line = el("path", { d: "M" + f1(dx) + " " + f1(y - dw * 1.5) + "V" + f1(y), "stroke-width": 2 }, g); S.paint(line, "stroke", C("wood", -0.35));
      [0.35, 0.7].forEach(function (k) { var st = el("path", { d: "M" + f1(dx - dw / 2) + " " + f1(y - dw * 1.9 * k) + "h" + f1(dw), "stroke-width": 1.5 }, g); S.paint(st, "stroke", C("wood", -0.25)); });
    }
    windows.forEach(function (wv, k) { wv.i = k; });
    if (o.wake) {
      var wk = Array.isArray(o.wake) ? { at: o.wake } : o.wake;
      wakeList(S, windows.filter(function (wv) { return !wv.lit; }), wk.at || [], wk);
    }
    return { g: g, windows: windows };
  });

  /** a lane or a skyline of houses. {layer, y, from, to, hmin, hmax, style, lit, detail: "full" | "silhouette", seed,
      minarets:[x], tone, wake: {from, to, every, order, inView, level} | {at: [t…]}} → {g, list, windows}
      wake lights dark windows one by one (every `every` s from `from` to `to`, or at the listed times); in a silhouette
      the tiny windows wake. inView: true picks windows the camera shows at that time (call the camera moves first). */
  K.piece("town", function (S, o) {
    var g = wrap(S, o.layer || "near"), r = S.rng(o.seed || 101), y = o.y || S.horizon + 60;
    var x = o.from === undefined ? S.span[0] - 60 : o.from, end = o.to === undefined ? S.span[1] + 60 : o.to, list = [];
    var detail = o.detail || "full", wk = o.wake && (Array.isArray(o.wake) ? { at: o.wake } : o.wake), times = [];
    if (wk) {
      if (wk.at) times = wk.at.slice();
      else for (var tw = wk.from || 0; tw <= (wk.to === undefined ? S.duration - 1 : wk.to) + 1e-6; tw += wk.every || 0.6) times.push(Math.round(tw * 1000) / 1000);
      wk.layer = wk.layer || o.layer || "near";
    }
    if (detail === "silhouette") {
      var d = "", wins = [], rl = S.rng((o.seed || 101) + 313);
      while (x < end) {
        var w = rnd(r, 70, 170), h = rnd(r, o.hmin || 60, o.hmax || 170);
        d += "M" + f1(x) + " " + f1(y) + "V" + f1(y - h) + "H" + f1(x + w) + "V" + f1(y) + "Z" + crenels(x, y - h + 1, w, 9);
        // a window in ~70% of the buildings; with lit set, in that share (the skyline itself stays the same)
        var cand = r() < 0.7 ? [x + rnd(r, 12, w - 12), y - h + rnd(r, 20, h - 20)] : null;
        if (o.lit === undefined) { if (cand) wins.push(cand); }
        else if (rl() < o.lit) wins.push(cand || [x + rnd(rl, 12, w - 12), y - h + rnd(rl, 20, h - 20)]);
        else if (wk && cand) wins.push(cand.concat([true]));   // dark, can wake
        if (r() < 0.12) { var dx = x + w / 2, dr = rnd(r, 30, 52); d += "M" + f1(dx - dr) + " " + f1(y - h) + "A" + f1(dr) + " " + f1(dr * 1.05) + " 0 0 1 " + f1(dx + dr) + " " + f1(y - h) + "Z"; }
        x += w + rnd(r, -10, 6);
      }
      (o.minarets || []).forEach(function (mx) { var mh = o.minaretH || 230; d += "M" + f1(mx - 22) + " " + f1(y) + "L" + f1(mx - 14) + " " + f1(y - mh) + "L" + f1(mx + 14) + " " + f1(y - mh) + "L" + f1(mx + 22) + " " + f1(y) + "Z" + crenels(mx - 16, y - mh + 1, 32, 8); });
      var p = el("path", { d: d }, g); S.paint(p, "fill", o.role || { role: "far", mix: "haze", k: o.tone || 0 });
      var tiny = [];
      wins.forEach(function (wv, k) {
        var wn = el("rect", { x: f1(wv[0] - 3), y: f1(wv[1] - 4), width: 6, height: 8 }, g); S.paint(wn, "fill", "windowLit");
        var base = rnd(r, 0.4, 0.9);
        if (wv[2] || (wk && o.lit === undefined)) wn.style.opacity = 0;   // with wake, the tiny windows start dark
        else S.level(wn, "windows", base);
        tiny.push({ x: wv[0], y: wv[1], el: wn, lit: wn, glow: null, i: k, d: null, dark: !!wv[2] || (wk && o.lit === undefined) });
      });
      if (wk) wakeList(S, tiny.filter(function (t) { return t.dark; }), times,
        { order: wk.order, seed: wk.seed, filter: wk.filter, inView: wk.inView, layer: wk.layer, level: wk.level === undefined ? 0.85 : wk.level });
      return { g: g, windows: tiny };
    }
    while (x < end) {
      var bw = rnd(r, o.wmin || 110, o.wmax || 230), bh = rnd(r, o.hmin || 140, o.hmax || 300);
      list.push(S.house({ parent: g, x: x, y: y, w: bw, h: bh, style: o.style, lit: o.lit, door: r() < (o.doors === undefined ? 0.5 : o.doors), doorAt: rnd(r, 0.3, 0.7), seed: Math.floor(r() * 1e6), tone: o.tone }));
      x += bw + rnd(r, o.gap === undefined ? 4 : o.gap, (o.gap === undefined ? 4 : o.gap) + 26);
    }
    (o.minarets || []).forEach(function (mx) { S.minaret({ parent: g, x: mx, y: y, h: o.minaretH || 380, tone: o.tone }); });
    var all = [];
    list.forEach(function (H) { (H.windows || []).forEach(function (wv) { wv.i = all.length; all.push(wv); }); });
    if (wk) wakeList(S, all.filter(function (wv) { return !wv.lit; }), times, wk);
    return { g: g, list: list, windows: all };
  });

  /** a tapered Najdi minaret (square, mud-built, saw-tooth top). {x, y, h, w, tone, lit} */
  K.piece("minaret", function (S, o) {
    var g = o.parent || wrap(S, o.layer || "near"), x = o.x, y = o.y, h = o.h || 380, w = o.w || 70, tone = o.tone || 0;
    function C(role, sh) { return { role: role, mix: "haze", k: tone, shade: sh }; }
    var top = w * 0.62, lightLeft = S.light.x < x;
    var body = el("path", { d: K.poly([[x - w / 2, y], [x - top / 2, y - h], [x + top / 2, y - h], [x + w / 2, y]], true) }, g); S.paint(body, "fill", C("wall"));
    var sh = lightLeft ? [[x + w * 0.18, y], [x + top * 0.14, y - h], [x + top / 2, y - h], [x + w / 2, y]] : [[x - w / 2, y], [x - top / 2, y - h], [x - top * 0.14, y - h], [x - w * 0.18, y]];
    var s = el("path", { d: K.poly(sh, true) }, g); S.paint(s, "fill", C("wallShade"));
    var cr = el("path", { d: crenels(x - top / 2 - 4, y - h + 1, top + 8, 11) }, g); S.paint(cr, "fill", C("wall"));
    var band = el("rect", { x: f1(x - top / 2 - 5), y: f1(y - h + 2), width: f1(top + 10), height: 7 }, g); S.paint(band, "fill", C("wallShade"));
    for (var i = 0; i < 4; i++) {
      var wy = y - h + 60 + i * (h - 120) / 4, wi = el("path", { d: "M" + f1(x - 6) + " " + f1(wy + 12) + "l6 -12l6 12Z" }, g);
      S.paint(wi, "fill", i === 0 && o.lit !== false ? "windowLit" : C("window"));
      if (i === 0 && o.lit !== false) S.level(wi, "windows");
    }
    return { g: g };
  });

  /** a small Najdi mosque: a low hall with arches, a tapered minaret, beams. Our own drawing. {x, y, w, side: "left"|"right"} */
  K.piece("mosque", function (S, o) {
    var g = wrap(S, o.layer || "near"), x = o.x === undefined ? 540 : o.x, y = o.y || S.horizon + 80, w = o.w || 520, h = o.h || 170, tone = o.tone || 0;
    function C(role, sh) { return { role: role, mix: "haze", k: tone, shade: sh }; }
    var x0 = x - w / 2, mx = o.side === "left" ? x0 + 40 : x0 + w - 40;
    S.minaret({ parent: g, x: mx, y: y - h + 40, h: o.minaretH || 300, w: 76, tone: tone });
    S.house({ parent: g, x: x0, y: y, w: w, h: h, style: "najdi", lit: 0, tone: tone, seed: 7 });
    var n = o.arches || 5, aw = w / (n + 1) * 0.62;
    for (var i = 0; i < n; i++) {
      var ax = x0 + w * (i + 1) / (n + 1), mid = i === Math.floor(n / 2);
      var a = el("path", { d: archPath(ax, y, mid ? aw * 1.25 : aw, (mid ? aw * 1.25 : aw) * 1.9, true) }, g); S.paint(a, "fill", C("window", -0.2));
      if (o.lit !== false) {
        var al = el("path", { d: archPath(ax, y, (mid ? aw * 1.25 : aw) - 8, (mid ? aw * 1.25 : aw) * 1.9 - 8, true) }, g);
        S.paint(al, "fill", "windowLit"); S.level(al, "windows", mid ? 0.95 : 0.6);
      }
    }
    if (o.lit !== false) { var gl = el("ellipse", { cx: x, cy: y - 20, rx: w * 0.7, ry: 120, fill: S.rgrad([[0, "windowLit", 0.3], [1, "windowLit", 0]]) }, g); blend(gl, "screen"); S.level(gl, "windows"); }
    return { g: g };
  });

  /** an inside: back wall, a carved band, an arched window with a lattice, floor, rug, low cushions, a niche.
      {floorY, window: {x, y, w, h, moon, patch, patchX, patchAlpha, sun: {from: [x, y], to: [x, y], at, dur, sweep}} | false,
       niche: {x, y} | false, rug: {x, w} | false, cushions: true} → {g, floorY, window: {inside, sun}, patch}
      window.sun: a sun that crosses the window (a time-lapse) while its light on the floor sweeps the other way. */
  K.piece("room", function (S, o) {
    var g = wrap(S, o.layer || "near"), fy = o.floorY || 1430, r = S.rng(o.seed || 111), X0 = S.span[0] - 200, Wd = S.span[1] - S.span[0] + 400;
    var out = { g: g, floorY: fy, window: null, patch: null };
    el("rect", { x: X0, y: -400, width: Wd, height: fy + 400, fill: S.vgrad([[0, { role: "wall", shade: -0.45 }], [0.55, "wall"], [1, { role: "wall", shade: -0.15 }]], 0, 0, 0, fy, "userSpaceOnUse") }, g);
    // ceiling beams of palm trunk
    var ceil = el("rect", { x: X0, y: -400, width: Wd, height: 470 }, g); S.paint(ceil, "fill", { role: "wood", shade: -0.35 });
    for (var bx = X0; bx < X0 + Wd; bx += 64) { var be = el("ellipse", { cx: f1(bx), cy: 70, rx: 14, ry: 9 }, g); S.paint(be, "fill", { role: "wood", shade: -0.1 }); }
    // the carved band (a row of small triangles), then the low wall band
    var band = fy - 150;
    var bnd = el("rect", { x: X0, y: f1(band), width: Wd, height: 150 }, g); S.paint(bnd, "fill", { role: "wall", shade: -0.12 });
    var tri = el("path", { d: crenels(X0, band, Wd, 12) }, g); S.paint(tri, "fill", { role: "wallLit", mix: "wall", k: 0.4 }); tri.style.opacity = 0.8;
    var line = el("rect", { x: X0, y: f1(band + 8), width: Wd, height: 3 }, g); S.paint(line, "fill", "wallShade");
    if (o.window !== false) {
      var wn = o.window || {}, wx = wn.x || 300, wy = wn.y || 980, ww = wn.w || 220, wh = wn.h || 380;
      var frame = el("path", { d: archPath(wx, wy, ww + 34, wh + 30, true) }, g); S.paint(frame, "fill", "wallShade");
      var id = S.id("win"), cp = el("clipPath", { id: id }, S.defs); el("path", { d: archPath(wx, wy, ww, wh, true) }, cp);
      var inside = el("g", { "clip-path": "url(#" + id + ")" }, g);
      el("rect", { x: wx - ww, y: wy - wh, width: ww * 2, height: wh, fill: S.vgrad([[0, "sky1"], [0.7, "sky2"], [1, "sky3"]], 0, wy - wh, 0, wy, "userSpaceOnUse") }, inside);
      if (wn.moon !== false) { var mo = el("circle", { cx: wx + ww * 0.18, cy: wy - wh * 0.62, r: 16 }, inside); S.paint(mo, "fill", "moon"); S.level(mo, "moonLevel"); }
      var rr = S.rng(5); for (var s = 0; s < 14; s++) { var st = el("circle", { cx: f1(wx + rnd(rr, -ww / 2, ww / 2)), cy: f1(wy - rnd(rr, wh * 0.3, wh)), r: f1(rnd(rr, 0.8, 1.8)) }, inside); S.paint(st, "fill", "star"); S.level(st, "stars", 0.8); }
      out.window = { inside: inside, x: wx, y: wy, w: ww, h: wh, sun: null };
      if (wn.sun) {   // the sun crossing the window: a group with no transform attribute, moved with absolute values
        var su = wn.sun, sf = su.from || [wx - ww * 0.4, wy - wh * 0.85], stt = su.to || [wx + ww * 0.6, wy + 30];
        var sunW = el("g", null, inside), sunG = el("g", null, sunW);
        var sgl = el("circle", { cx: f1(sf[0]), cy: f1(sf[1]), r: su.glow || 120, fill: S.rgrad([[0, "sunGlow", 0.8], [0.3, "sunGlow", 0.3], [1, "sunGlow", 0]]) }, sunG); blend(sgl, "screen");
        var sdc = el("circle", { cx: f1(sf[0]), cy: f1(sf[1]), r: su.r || 30 }, sunG); S.paint(sdc, "fill", "sun");
        S.level(sunW, "sunLevel", su.level === undefined ? 1 : su.level);
        if (su.at !== undefined) S.tl.fromTo(sunG, { x: 0, y: 0 }, { x: stt[0] - sf[0], y: stt[1] - sf[1], duration: su.dur || 1.7, ease: su.ease || "power1.in", immediateRender: false }, su.at);
        out.window.sun = sunW;
      }
      var hills = el("path", { d: "M" + f1(wx - ww) + " " + f1(wy - 40) + "Q" + f1(wx - ww * 0.2) + " " + f1(wy - 90) + " " + f1(wx + ww * 0.2) + " " + f1(wy - 55) + "T" + f1(wx + ww) + " " + f1(wy - 60) + "V" + wy + "H" + f1(wx - ww) + "Z" }, inside);
      S.paint(hills, "fill", "far");
      // lattice (mashrabiya): diamonds in wood
      var lat = el("g", null, inside); lat.style.opacity = 0.85;
      for (var ly = wy - wh * 0.42; ly < wy; ly += 26) for (var lx = wx - ww / 2; lx < wx + ww / 2 + 26; lx += 26) {
        var dm = el("path", { d: "M" + f1(lx) + " " + f1(ly - 13) + "l13 13l-13 13l-13 -13Z", fill: "none", "stroke-width": 4 }, lat); S.paint(dm, "stroke", "wood");
      }
      var sill = el("rect", { x: wx - ww / 2 - 26, y: wy, width: ww + 52, height: 14 }, g); S.paint(sill, "fill", { role: "wallShade", shade: -0.15 });
      var bar = el("path", { d: "M" + f1(wx) + " " + f1(wy - wh) + "V" + wy + "M" + f1(wx - ww / 2) + " " + f1(wy - wh * 0.42) + "H" + f1(wx + ww / 2), "stroke-width": 7 }, inside); S.paint(bar, "stroke", "wood");
      if (wn.patch !== false) {   // the window's light on the floor
        var px = wn.patchX === undefined ? wx + 120 : wn.patchX;
        var patch = el("path", { d: K.poly([[px - ww * 0.45, fy + 40], [px + ww * 0.45, fy + 40], [px + ww * 0.85, fy + 300], [px - ww * 0.15, fy + 300]], true), filter: S.blur(10) }, S.L("ground"));
        S.paint(patch, "fill", "light"); patch.style.opacity = wn.patchAlpha || 0.12; blend(patch, "screen");
        out.patch = patch;
        if (wn.sun && wn.sun.at !== undefined) {   // the light on the floor sweeps the other way as the sun crosses
          var sw = wn.sun.sweep === undefined ? -1.6 * ((wn.sun.to || [wx + ww * 0.6])[0] - (wn.sun.from || [wx - ww * 0.4])[0]) : wn.sun.sweep;
          S.tl.fromTo(patch, { x: 0 }, { x: sw, duration: wn.sun.dur || 1.7, ease: wn.sun.ease || "power1.in", immediateRender: false }, wn.sun.at);
        }
      }
    }
    if (o.niche !== false) {
      var nc = o.niche || {}, nx = nc.x || 800, ny = nc.y || 1080;
      var ni = el("path", { d: archPath(nx, ny, 120, 190, true) }, g); S.paint(ni, "fill", { role: "wallShade", shade: -0.2 });
      var nl = el("rect", { x: nx - 72, y: ny, width: 144, height: 12 }, g); S.paint(nl, "fill", "wallShade");
    }
    // floor
    var fl = el("rect", { x: X0, y: fy, width: Wd, height: S.H - fy + 600, fill: S.vgrad([[0, { role: "floor", shade: -0.25 }], [0.25, "floor"], [1, "floorShade"]], 0, fy, 0, S.H, "userSpaceOnUse") }, S.L("ground"));
    var skirt = el("rect", { x: X0, y: fy - 4, width: Wd, height: 8 }, S.L("ground")); S.paint(skirt, "fill", { role: "wallShade", shade: -0.3 });
    if (o.cushions !== false) {
      var cg = el("g", null, g), cx0 = (o.cushions && o.cushions.from) || S.span[0], cx1 = (o.cushions && o.cushions.to) || S.span[1];
      var seat = el("rect", { x: cx0, y: fy - 74, width: cx1 - cx0, height: 74, rx: 16 }, cg); S.paint(seat, "fill", "fabric");
      var top = el("rect", { x: cx0, y: fy - 74, width: cx1 - cx0, height: 14, rx: 7 }, cg); S.paint(top, "fill", { role: "fabric", mix: "light", k: 0.12 });
      for (var bk = cx0 + 20; bk < cx1 - 60; bk += 150) {
        var back = el("rect", { x: f1(bk), y: fy - 170, width: 128, height: 110, rx: 22 }, cg); S.paint(back, "fill", { role: "fabric", shade: -0.08 });
        var stripe = el("rect", { x: f1(bk + 10), y: fy - 120, width: 108, height: 8, rx: 4 }, cg); S.paint(stripe, "fill", "rug2"); stripe.style.opacity = 0.65;
      }
      var piping = el("rect", { x: cx0, y: fy - 36, width: cx1 - cx0, height: 6 }, cg); S.paint(piping, "fill", "rug2"); piping.style.opacity = 0.6;
    }
    if (o.rug !== false) {
      var rg = o.rug || {}, rx = rg.x || 540, rw = rg.w || 760, ry0 = fy + 60, ry1 = rg.bottom || fy + 360, gg = S.L("ground");
      var rq = [[rx - rw * 0.42, ry0], [rx + rw * 0.42, ry0], [rx + rw / 2, ry1], [rx - rw / 2, ry1]];
      var rug = el("path", { d: K.poly(rq, true) }, gg); S.paint(rug, "fill", "rug");
      var inset = function (k) { return [[rx - rw * 0.42 * k, ry0 + 14], [rx + rw * 0.42 * k, ry0 + 14], [rx + rw / 2 * k, ry1 - 16], [rx - rw / 2 * k, ry1 - 16]]; };
      var b1 = el("path", { d: K.poly(inset(0.93), true), fill: "none", "stroke-width": 5 }, gg); S.paint(b1, "stroke", "rug2");
      var b2 = el("path", { d: K.poly(inset(0.86), true), fill: "none", "stroke-width": 2 }, gg); S.paint(b2, "stroke", "rug2"); b2.style.opacity = 0.7;
      var my = (ry0 + ry1) / 2, nd = 5;
      for (var i = 0; i < nd; i++) {
        var mxx = rx + (i - (nd - 1) / 2) * rw * 0.14, sz = 26 + (i % 2) * 8;
        var dmd = el("path", { d: "M" + f1(mxx) + " " + f1(my - sz) + "l" + f1(sz * 0.8) + " " + sz + "l" + f1(-sz * 0.8) + " " + sz + "l" + f1(-sz * 0.8) + " " + (-sz) + "Z" }, gg);
        S.paint(dmd, "fill", "rug2"); dmd.style.opacity = 0.85;
      }
    }
    return out;
  });

  // ======================= THINGS IN A ROOM, A CAR, A DOOR =======================
  // Side or front views, drawn at the floor line y, coloured by role (wood, fabric, ink, wall…) so relight works.
  function R(S, g, x, y, w, h, spec, rx) { var e = el("rect", { x: f1(x), y: f1(y), width: f1(w), height: f1(h), rx: rx ? f1(rx) : undefined }, g); S.paint(e, "fill", spec); return e; }
  function P(S, g, d, spec) { var e = el("path", { d: d }, g); if (spec) S.paint(e, "fill", spec); return e; }
  function T(x, y, s, flip) { return "translate(" + f1(x) + " " + f1(y) + ") scale(" + (flip ? -s : s) + " " + s + ")"; }   // for static inner groups only

  /** a bed on a low frame: frame, mattress, pillow, a quilt over the foot that can fold back.
      {x (left end), y (floor), w: 700, head: "left"|"right", quilt: true, fold: {at, dur, to: 0.3}, layer: "ground", tone}
      → {g, top (the mattress's top y: lie a figure there), quilt}. A figure lying on it: y = top + 2, pose of your own. */
  K.piece("bed", function (S, o) {
    var g = wrap(S, o.layer || "ground"), x = o.x === undefined ? 140 : o.x, y = o.y || 1696, w = o.w || 700, left = (o.head || "left") === "left", tone = o.tone || 0;
    function X(u) { return left ? x + u : x + w - u; }
    function C(role, sh, mix, k) { return { role: role, shade: sh, mix: mix || "haze", k: mix ? k : tone }; }
    R(S, g, x, y - 50, w, 50, C("wood", -0.25), 8);
    R(S, g, x + 10, y - 100, w - 20, 54, C("fabric", 0, "#f1ece4", 0.45), 18);
    R(S, g, x + 10, y - 100, w - 20, 10, C("fabric", 0, "#ffffff", 0.6), 5);
    var pil = el("ellipse", { cx: f1(X(88)), cy: f1(y - 108), rx: 74, ry: 24 }, g); S.paint(pil, "fill", C("fabric", 0, "#ffffff", 0.65));
    var out = { g: g, top: y - 100, quilt: null };
    if (o.quilt !== false) {
      var qw = el("g", null, g), u0 = w * 0.497, foot = w + 6;
      var d = "M" + f1(X(u0)) + " " + f1(y - 48) + "C" + f1(X(u0 - 2)) + " " + f1(y - 96) + " " + f1(X(u0 + 24)) + " " + f1(y - 124) + " " + f1(X(u0 + 72)) + " " + f1(y - 126) +
        "C" + f1(X(u0 + 152)) + " " + f1(y - 130) + " " + f1(X(u0 + 232)) + " " + f1(y - 124) + " " + f1(X(u0 + 282)) + " " + f1(y - 136) +
        "C" + f1(X(u0 + 318)) + " " + f1(y - 144) + " " + f1(X(foot - 8)) + " " + f1(y - 130) + " " + f1(X(foot - 4)) + " " + f1(y - 96) + "L" + f1(X(foot)) + " " + f1(y - 48) + "Z";
      P(S, qw, d, C("rug", 0, "#f1ece4", 0.18));
      var st = el("path", { d: "M" + f1(X(u0 + 8)) + " " + f1(y - 90) + "C" + f1(X(u0 + 112)) + " " + f1(y - 96) + " " + f1(X(u0 + 212)) + " " + f1(y - 92) + " " + f1(X(foot - 6)) + " " + f1(y - 98), fill: "none", "stroke-width": 5 }, qw);
      S.paint(st, "stroke", "rug2"); st.style.opacity = 0.5;
      out.quilt = qw;
      if (o.fold) S.svgMove(qw, o.fold.at || 0, o.fold.dur || 0.45, { sx: 1, sy: 1 }, { sx: o.fold.to === undefined ? 0.3 : o.fold.to, sy: 1 }, o.fold.ease || "power2.in", [X(foot), y - 48]);
    }
    return out;
  });

  /** a desk (side view) with a screen turned toward whoever sits at it, its light, papers and a cup.
      {x (left end), y (floor), w: 440, h: 216, sitter: "left"|"right" (where the chair is), screen: true, papers: true, layer: "ground"}
      → {g, top, screen, glow}. Pair it with chair({…}) and a figure in a seated pose. */
  K.piece("desk", function (S, o) {
    var g = wrap(S, o.layer || "ground"), x = o.x === undefined ? 600 : o.x, y = o.y || 1756, w = o.w || 440, h = o.h || 216, left = (o.sitter || "left") === "left";
    function X(u) { return left ? x + u : x + w - u; }
    var top = y - h, out = { g: g, top: top, screen: null, glow: null };
    R(S, g, x, top, w, 22, { role: "wood", shade: 0.05 }, 4);
    R(S, g, X(16) - (left ? 0 : 14), top + 20, 14, h - 20, { role: "wood", shade: -0.3 });
    R(S, g, X(w - 30) - (left ? 0 : 14), top + 20, 14, h - 20, { role: "wood", shade: -0.3 });
    R(S, g, Math.min(X(260), X(410)), top + 22, 150, 120, { role: "wood", shade: -0.18 }, 4);
    if (o.screen !== false) {
      var sx = function (u) { return X(u); };
      P(S, g, "M" + f1(sx(190)) + " " + f1(top - 10) + "L" + f1(sx(200)) + " " + f1(top - 16) + "L" + f1(sx(200)) + " " + f1(top - 32) + "L" + f1(sx(190)) + " " + f1(top - 32) + "Z", { role: "ink", mix: "#555555", k: 0.4 });
      P(S, g, "M" + f1(sx(120)) + " " + f1(top - 202) + "L" + f1(sx(260)) + " " + f1(top - 228) + "L" + f1(sx(260)) + " " + f1(top - 34) + "L" + f1(sx(120)) + " " + f1(top - 40) + "Z", { role: "ink", mix: "#3a3f4a", k: 0.3 });
      var scr = P(S, g, "M" + f1(sx(130)) + " " + f1(top - 190) + "L" + f1(sx(250)) + " " + f1(top - 212) + "L" + f1(sx(250)) + " " + f1(top - 46) + "L" + f1(sx(130)) + " " + f1(top - 50) + "Z", { role: "light", mix: "#cfe0f5", k: 0.7 });
      for (var i = 0; i < 6; i++) {
        var ln = el("path", { d: "M" + f1(sx(144)) + " " + f1(top - 168 + i * 18) + "L" + f1(sx(190 + (i * 37) % 50)) + " " + f1(top - 172 + i * 18), "stroke-width": 5, "stroke-linecap": "round", fill: "none" }, g);
        S.paint(ln, "stroke", i % 3 === 1 ? "warm" : { role: "ink", mix: "light", k: 0.35 }); ln.style.opacity = 0.8;
      }
      var sg = el("ellipse", { cx: f1(sx(120)), cy: f1(top - 120), rx: 240, ry: 200, fill: S.rgrad([[0, { role: "light", mix: "#d6e6ff", k: 0.7 }, 0.32], [1, { role: "light", mix: "#d6e6ff", k: 0.7 }, 0]]) }, S.L(o.glowLayer || "light"));
      blend(sg, "screen");
      if (o.flicker !== false) S.wave(sg, "opacity", 0.85, 0.15, 0.9, 0.2);
      out.screen = scr; out.glow = sg;
    }
    if (o.papers !== false) {
      P(S, g, "M" + f1(X(300)) + " " + f1(top - 8) + "L" + f1(X(380)) + " " + f1(top - 14) + "L" + f1(X(384)) + " " + f1(top - 2) + "L" + f1(X(304)) + " " + f1(top + 2) + "Z", { role: "wall", mix: "#ffffff", k: 0.7 });
      P(S, g, "M" + f1(X(310)) + " " + f1(top - 14) + "L" + f1(X(386)) + " " + f1(top - 22) + "L" + f1(X(390)) + " " + f1(top - 10) + "L" + f1(X(312)) + " " + f1(top - 4) + "Z", { role: "wall", mix: "#ffffff", k: 0.8 });
      R(S, g, X(40) - (left ? 0 : 30), top - 32, 30, 34, { role: "rug", mix: "#ffffff", k: 0.3 }, 5);
    }
    return out;
  });

  /** a chair, side view: the back behind the sitter. {x (the seat's middle), y (floor), facing: "right"|"left" (the
      way the sitter looks), size: 1, layer: "ground"} → {g, seat (the seat's top y)} */
  K.piece("chair", function (S, o) {
    var g = wrap(S, o.layer || "ground"), x = o.x === undefined ? 435 : o.x, y = o.y || 1752, s = o.size || 1, f = (o.facing || "right") === "right" ? 1 : -1;
    var seat = y - 124 * s, half = 75 * s;
    R(S, g, x - f * (half + 8 * s) - (f > 0 ? 0 : 20 * s), y - 300 * s, 20 * s, 200 * s, { role: "wood", shade: -0.15 }, 8 * s);
    R(S, g, x - half, seat, 150 * s, 18 * s, { role: "wood", shade: -0.05 }, 6 * s);
    R(S, g, x - half + 12 * s, seat + 12 * s, 10 * s, 112 * s, { role: "wood", shade: -0.3 });
    R(S, g, x + half - 22 * s, seat + 12 * s, 10 * s, 112 * s, { role: "wood", shade: -0.3 });
    return { g: g, seat: seat };
  });

  /** a sofa, side view: back, seat, arm, a cushion, legs, a soft shadow. {x (left end), y (floor), w: 494, facing:
      "right"|"left" (the way the sitter looks; the back is behind), layer: "ground"} → {g, seat, shadow} */
  K.piece("sofa", function (S, o) {
    var g = wrap(S, o.layer || "ground"), x = o.x === undefined ? 196 : o.x, y = o.y || 1738, w = o.w || 494, f = (o.facing || "right") === "right";
    function X(u, wd) { return f ? x + u : x + w - u - (wd || 0); }
    var sh = el("path", { d: "M" + f1(X(-6)) + " " + f1(y - 26) + "L" + f1(X(504)) + " " + f1(y - 26) + "L" + f1(X(624)) + " " + f1(y + 32) + "L" + f1(X(54)) + " " + f1(y + 32) + "Z", filter: S.blur(10) }, g);
    S.paint(sh, "fill", "ink"); sh.style.opacity = 0.32;
    R(S, g, X(0, 64), y - 308, 64, 290, { role: "fabric", shade: -0.08 }, 26);
    R(S, g, X(34, w - 54), y - 138, w - 54, 112, { role: "fabric", shade: 0 }, 18);
    R(S, g, X(44, w - 74), y - 148, w - 74, 26, { role: "fabric", mix: "#ffffff", k: 0.12 }, 12);
    R(S, g, X(w - 70, 70), y - 192, 70, 166, { role: "fabric", shade: -0.05 }, 24);
    R(S, g, X(66, 70), y - 260, 70, 120, { role: "rug2", mix: "fabric", k: 0.5 }, 20);
    R(S, g, X(14, 16), y - 26, 16, 26, { role: "wood", shade: -0.3 }); R(S, g, X(w - 40, 16), y - 26, 16, 26, { role: "wood", shade: -0.3 });
    return { g: g, seat: y - 148, shadow: sh };
  });

  /** a small side table. {x (middle), y (floor), w: 120, h: 132, layer: "ground"} → {g, top}. A lamp on it:
      S.lamp({x, y: top - 50, size: 0.8, …}). */
  K.piece("sideTable", function (S, o) {
    var g = wrap(S, o.layer || "ground"), x = o.x === undefined ? 820 : o.x, y = o.y || 1742, w = o.w || 120, h = o.h || 132;
    R(S, g, x - w / 2, y - h, w, 14, { role: "wood" }, 4);
    R(S, g, x - 7, y - h + 12, 14, h - 12, { role: "wood", shade: -0.25 });
    R(S, g, x - w * 0.3, y - 6, w * 0.6, 6, { role: "wood", shade: -0.35 }, 3);
    return { g: g, top: y - h };
  });

  /** a car, side view (ours): body, cabin windows, wheels with spokes, a headlight and its beam.
      {x (middle), y (the road), facing: "right"|"left", size: 1 (≈ 830 px long), color: role or #hex, drive: {at, dur,
       spin: 900 (deg/s)}, move: {to: x, at, dur, ease}, lights: true, layer: "ground", backLayer, frontLayer}
      drive turns the wheels and bobs the body (the world tracks past: S.track({…, hold: [the car's layers]}));
      move drives it across. For a driver: backLayer (the cabin's inside) behind the figure's layer, frontLayer in front
      (a layer made after the figure: S.layer("carFront", 0.78)). → {g, back, front, wheels} */
  K.piece("car", function (S, o) {
    var s = o.size || 1, x = o.x === undefined ? 540 : o.x, y = o.y || 1782, flip = (o.facing || "right") === "left";
    var fw = el("g", null, S.L(o.frontLayer || o.layer || "ground")), fi = el("g", { transform: T(x, y, s, flip) }, fw);
    var bw = o.backLayer ? el("g", null, S.L(o.backLayer)) : null, bi = bw ? el("g", { transform: T(x, y, s, flip) }, bw) : null;
    var bodyC = o.color || { role: "ink", mix: "#3f6f7e", k: 0.62 }, dark = { role: "ink", mix: "#24414b", k: 0.5 };
    // local coordinates: the car's middle at 0, the road at 0 (the sample's drawing moved by −601, −1782)
    function L(d) { return d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, function (m, a, b) { return f1(+a - 601) + " " + f1(+b - 1782); }); }
    if (bi) P(S, bi, L("M290 1590 L380 1386 Q392 1362 420 1362 L742 1362 Q770 1362 788 1386 L872 1590 Z"), { role: "ink", mix: "#1b2433", k: 0.35 });
    var body = el("g", null, fi);
    if (!bi) {   // no driver: the cabin's glass, dark with the sky in it
      var glass = P(S, body, L("M290 1590 L380 1386 Q392 1362 420 1362 L742 1362 Q770 1362 788 1386 L872 1590 Z"), { role: "sky2", mix: "ink", k: 0.55 });
      glass.style.opacity = 0.92;
    }
    P(S, body, L("M276 1600 L366 1380 Q382 1346 418 1346 L744 1346 Q782 1346 800 1380 L890 1600 L864 1600 L784 1396 Q772 1374 744 1374 L708 1374 L708 1600 L684 1600 L684 1374 L420 1374 Q398 1374 386 1396 L304 1600 Z"), bodyC);
    P(S, body, L("M196 1600 Q200 1572 236 1566 L880 1566 Q990 1574 1010 1610 L1018 1690 Q1016 1716 990 1718 L210 1718 Q186 1716 184 1690 Z"), bodyC);
    R(S, body, 196 - 601, 1640 - 1782, 820, 6, dark).style.opacity = 0.6;
    R(S, body, 600 - 601, 1612 - 1782, 46, 8, dark, 4);
    if (o.lights !== false) {
      var hl = P(S, body, L("M994 1612 L1010 1616 L1012 1636 L990 1634 Z")); hl.style.fill = "#fff2c8";
      var beam = el("path", { d: L("M1010 1620 L1600 1560 L1600 1740 Z"), filter: S.blur(14) }, body); S.paint(beam, "fill", "light"); beam.style.opacity = 0.22; blend(beam, "screen");
      S.level(beam, "lamp", 0.22);
    }
    var wheels = [];
    [330, 860].forEach(function (wx) {
      var cx = wx - 601, cy = 1718 - 1782;
      var tyre = el("circle", { cx: cx, cy: cy, r: 64 }, fi); S.paint(tyre, "fill", { role: "ink", shade: 0 });
      var hub = el("circle", { cx: cx, cy: cy, r: 30 }, fi); S.paint(hub, "fill", { role: "wallShade", mix: "#9aa4ad", k: 0.5 });
      var sp = el("g", null, fi);
      for (var k = 0; k < 5; k++) { var a = k * 72 * PI / 180, ln = el("path", { d: "M" + cx + " " + cy + "L" + f1(cx + 28 * Math.cos(a)) + " " + f1(cy + 28 * Math.sin(a)), "stroke-width": 5 }, sp); S.paint(ln, "stroke", { role: "ink", mix: "#3b4148", k: 0.6 }); }
      wheels.push({ g: sp, c: [cx, cy] });
    });
    if (o.drive) {
      var at = o.drive.at || 0, dur = o.drive.dur === undefined ? S.duration - at : o.drive.dur, turn = (o.drive.spin || 900) * dur;
      wheels.forEach(function (W) { S.svgMove(W.g, at, dur, { r: 0 }, { r: turn }, "none", W.c); });
      S.wave(body, "y", 0, 2.2, 0.32, 0, at, at + dur);
    }
    if (o.move) {
      var mv = o.move, ws = [fw].concat(bw ? [bw] : []);
      S.tl.fromTo(ws, { x: 0 }, { x: (mv.to === undefined ? x + 600 : mv.to) - x, duration: mv.dur || 2, ease: mv.ease || "power1.inOut", immediateRender: false }, mv.at || 0);
    }
    return { g: fw, back: bw, front: fw, wheels: wheels };
  });

  /** a door that opens (Najdi arch or plain), the light behind it spilling out on the ground.
      {x (middle), y (floor), w: 290, h: 520, style: "najdi"|"plain", hinge: "right"|"left", open: {at, dur: 0.8, to: 0.12},
       light: true (warm inside; false = dark), wall: false (a wall around it), layer: "near"} → {g, leaf, inside, spill, glow} */
  K.piece("door", function (S, o) {
    var g = wrap(S, o.layer || "near"), dx = o.x === undefined ? 640 : o.x, base = o.y || 1666, dw = o.w || 290, dh = o.h || 520;
    var pointed = (o.style || "najdi") === "najdi", hr = (o.hinge || "right") === "right";
    if (o.wall) {
      var top = base - dh - 140;
      R(S, g, S.span[0] - 300, top, S.span[1] - S.span[0] + 600, base - top + 10, "wall");
      P(S, g, crenels(S.span[0] - 300, top + 1, S.span[1] - S.span[0] + 600, 22), "wall");
      R(S, g, S.span[0] - 300, top + 26, S.span[1] - S.span[0] + 600, 8, "wallShade");
    }
    P(S, g, archPath(dx, base, dw + 50, dh + 40, pointed), { role: "wallShade", shade: -0.15 });
    var inside = P(S, g, archPath(dx, base, dw, dh, pointed), o.light === false ? { role: "window", shade: -0.3 } : "windowLit");
    if (o.light !== false) {
      var core = el("ellipse", { cx: dx, cy: base - dh * 0.38, rx: dw * 0.52, ry: dh * 0.5, fill: S.rgrad([[0, { role: "windowLit", mix: "#ffffff", k: 0.6 }, 0.9], [1, "windowLit", 0]]) }, g);
      blend(core, "screen");
    }
    var id = S.id("door"), cp = el("clipPath", { id: id }, S.defs); el("path", { d: archPath(dx, base, dw, dh, pointed) }, cp);
    var lw = el("g", { "clip-path": "url(#" + id + ")" }, g), leaf = el("g", null, lw);
    R(S, leaf, dx - dw / 2, base - dh, dw, dh, "wood");
    R(S, leaf, dx - 3, base - dh, 6, dh, { role: "wood", shade: -0.35 });
    var cols = Math.max(2, Math.round(dw / 76)), rows = Math.max(3, Math.round((dh - 200) / 52));
    for (var row = 0; row < rows; row++) for (var col = 0; col < cols; col++) {
      var sx = dx - dw / 2 + (col + 0.5) * dw / cols - 14, sy = base - dh + 150 + row * 52;
      var stud = P(S, leaf, "M" + f1(sx) + " " + f1(sy) + "l14 -20l14 20Z", { role: "wood", mix: "warm", k: 0.25 }); stud.style.opacity = 0.7;
    }
    [base - dh + 170, base - 120].forEach(function (yy) { R(S, leaf, dx - dw / 2, yy, dw, 10, { role: "wood", shade: -0.3 }); });
    var ring = el("circle", { cx: f1(hr ? dx - dw * 0.14 : dx + dw * 0.14), cy: f1(base - dh * 0.48), r: 12, fill: "none", "stroke-width": 4 }, leaf);
    S.paint(ring, "stroke", { role: "wood", mix: "warm", k: 0.5 });
    var out = { g: g, leaf: leaf, inside: inside, spill: null, glow: null };
    if (o.light !== false) {
      var spill = el("path", { d: "M" + f1(dx - dw / 2) + " " + f1(base) + "L" + f1(dx + dw / 2) + " " + f1(base) + "L" + f1(dx + dw * 0.9) + " " + f1(base + 300) + "L" + f1(dx - dw * 2.1) + " " + f1(base + 300) + "Z", filter: S.blur(14) }, S.L(o.spillLayer || "ground"));
      S.paint(spill, "fill", "windowLit"); blend(spill, "screen"); spill.style.opacity = 0;
      var glow = el("circle", { cx: dx, cy: base - dh / 2, r: dh, fill: S.rgrad([[0, "windowLit", 0.5], [0.4, "warmGlow", 0.16], [1, "warmGlow", 0]]) }, S.L(o.glowLayer || "light"));
      blend(glow, "screen"); glow.style.opacity = 0;
      out.spill = spill; out.glow = glow;
    }
    if (o.open) {
      var at = o.open.at || 0, dur = o.open.dur || 0.8;
      S.svgMove(leaf, at, dur, { sx: 1, sy: 1 }, { sx: o.open.to === undefined ? 0.12 : o.open.to, sy: 1 }, o.open.ease || "power2.inOut", [hr ? dx + dw / 2 : dx - dw / 2, base]);
      if (out.spill) {
        S.tl.fromTo(out.spill, { opacity: 0 }, { opacity: 0.5, duration: dur, ease: "power1.out", immediateRender: false }, at + 0.1);
        S.tl.fromTo(out.glow, { opacity: 0 }, { opacity: 1, duration: dur, ease: "power1.out", immediateRender: false }, at + 0.1);
      }
    }
    return out;
  });

  // ======================= PLANTS =======================
  function frondPath(cx, cy, ang, len, droop, wid, teeth) {
    var a = ang * PI / 180, ux = Math.cos(a), uy = Math.sin(a), px = -uy, py = ux;   // spine dir and its normal
    var up = [], dn = [], N = teeth || 26;
    for (var i = 0; i <= N; i++) {
      var t = i / N, sx = cx + ux * len * t, sy = cy + uy * len * t + droop * len * t * t;
      var w = wid * Math.pow(Math.sin(PI * Math.min(1, 0.06 + t * 0.98)), 0.6) * (1 - 0.25 * t);
      var j = (i % 2) ? 0.62 : 1;   // the leaflets: a fine comb on both sides, leaning toward the tip
      var lean = (i % 2) ? 0 : len * 0.018;
      up.push([sx + px * w * j * 0.8 + ux * lean, sy + py * w * j * 0.8 + uy * lean + (i % 2 ? 0 : w * 0.12)]);
      dn.push([sx - px * w * j * 1.1 + ux * lean, sy - py * w * j * 1.1 + uy * lean + (i % 2 ? 0 : w * 0.22)]);
    }
    var pts = up.concat(dn.reverse());
    return K.poly(pts, true);
  }
  /** a date palm: curved trunk with its pattern, a crown of fronds that sway with the wind, dates. {x, y, h, lean, fronds, layer, tone, dates} */
  K.piece("palm", function (S, o) {
    var g = wrap(S, o.layer || "near"), r = S.rng(o.seed || 121), x = o.x || 200, y = o.y || S.horizon + 120, h = o.h || 520;
    var lean = (o.lean === undefined ? 6 : o.lean) * PI / 180, tone = o.tone || 0, s = h / 520;
    function C(role, sh) { return { role: role, mix: "haze", k: tone, shade: sh }; }
    var tx = x + Math.sin(lean) * h, ty = y - Math.cos(lean) * h, bend = (o.bend === undefined ? 0.08 : o.bend) * h;
    var L = [], R = [], N = 16;
    for (var i = 0; i <= N; i++) {
      var t = i / N, bx = x + (tx - x) * t + Math.sin(PI * t) * bend * (lean >= 0 ? -1 : 1), by = y + (ty - y) * t;
      var w = (34 - 12 * t) * s / 2; L.push([bx - w, by]); R.push([bx + w, by]);
    }
    var trunk = el("path", { d: K.poly(L.concat(R.reverse()), true) }, g); S.paint(trunk, "fill", C("trunk"));
    var marks = el("g", null, g); marks.style.opacity = 0.55;
    for (var k = 1; k < N; k++) {
      var lp = L[k], rp = R[N - k], mx = (lp[0] + rp[0]) / 2, my = (lp[1] + rp[1]) / 2, hw = (rp[0] - lp[0]) / 2;
      var m = el("path", { d: "M" + f1(mx - hw) + " " + f1(my - 4 * s) + "L" + f1(mx) + " " + f1(my + 6 * s) + "L" + f1(mx + hw) + " " + f1(my - 4 * s), fill: "none", "stroke-width": f1(2.4 * s) }, marks);
      S.paint(m, "stroke", C("trunk", -0.35));
    }
    var lightSide = S.light.x < tx ? -1 : 1;
    var hl = el("path", { d: K.poly(lightSide < 0 ? L : R, false), fill: "none", "stroke-width": f1(3 * s) }, g); S.paint(hl, "stroke", C("foliageLit")); hl.style.opacity = 0.5;
    var nf = o.fronds || 12, crown = el("g", null, g), fr = [];
    var angles = [];
    for (var a = 0; a < nf; a++) angles.push(-178 + (a + rnd(r, -0.3, 0.3)) * 196 / (nf - 1) + (a % 2 ? 6 : -6));
    angles.sort(function (p, q) { return Math.abs(q + 90) - Math.abs(p + 90); });
    angles.forEach(function (ang, idx) {
      var len = h * rnd(r, 0.42, 0.56), droop = rnd(r, 0.55, 0.9) * (Math.abs(ang + 90) / 90 + 0.15);
      var wrapG = el("g", null, crown), back = idx < nf * 0.4;
      var fp = el("path", { d: frondPath(tx, ty, ang, len, droop, len * 0.15, 28) }, wrapG);
      var litF = (Math.cos(ang * PI / 180) * lightSide) > 0.2 && !back;
      S.paint(fp, "fill", C(litF ? "foliageLit" : "foliage", back ? -0.25 : 0));
      var spine = el("path", { d: "M" + f1(tx) + " " + f1(ty) + "Q" + f1(tx + Math.cos(ang * PI / 180) * len * 0.5) + " " + f1(ty + Math.sin(ang * PI / 180) * len * 0.5 + droop * len * 0.12) + " " + f1(tx + Math.cos(ang * PI / 180) * len) + " " + f1(ty + Math.sin(ang * PI / 180) * len + droop * len), fill: "none", "stroke-width": f1(2.2 * s) }, wrapG);
      S.paint(spine, "stroke", C("foliage", -0.3)); spine.style.opacity = 0.6;
      var amp = (1.5 + 4.5 * S.windStrength) * rnd(r, 0.7, 1.3);
      if (o.sway !== false && S.windStrength > 0) S.wave(wrapG, "rotation", 0, amp, rnd(r, 1.8, 3.2) / (0.6 + S.windStrength), r(), 0, undefined, { svgOrigin: f1(tx) + " " + f1(ty) });
      fr.push(wrapG);
    });
    if (o.dates !== false) {
      for (var dI = 0; dI < 2; dI++) {
        var dx = tx + (dI ? 18 : -22) * s, dy = ty + 26 * s, cl = el("g", null, g);
        for (var q = 0; q < 9; q++) { var dd = el("ellipse", { cx: f1(dx + rnd(r, -12, 12) * s), cy: f1(dy + rnd(r, -6, 22) * s), rx: f1(4.5 * s), ry: f1(6 * s) }, cl); S.paint(dd, "fill", C("rug2", -0.35)); }
      }
    }
    var cap = el("circle", { cx: f1(tx), cy: f1(ty), r: f1(13 * s) }, g); S.paint(cap, "fill", C("trunk", -0.1));
    return { g: g, crown: [tx, ty], fronds: fr };
  });

  /** a tree: "round" (a garden tree) or "acacia" (the flat-topped desert tree). {x, y, size, kind, tone} */
  K.piece("tree", function (S, o) {
    var g = wrap(S, o.layer || "near"), r = S.rng(o.seed || 131), x = o.x || 800, y = o.y || S.horizon + 120, s = (o.size || 1), tone = o.tone || 0;
    function C(role, sh) { return { role: role, mix: "haze", k: tone, shade: sh }; }
    var lightSide = S.light.x < x ? -1 : 1, kind = o.kind || "round", canopy = el("g", null, g);
    if (kind === "acacia") {
      var tr = el("path", { d: "M" + f1(x - 10 * s) + " " + f1(y) + "C" + f1(x - 8 * s) + " " + f1(y - 90 * s) + " " + f1(x - 30 * s) + " " + f1(y - 140 * s) + " " + f1(x - 90 * s) + " " + f1(y - 200 * s) +
        "L" + f1(x - 82 * s) + " " + f1(y - 206 * s) + "C" + f1(x - 20 * s) + " " + f1(y - 160 * s) + " " + f1(x) + " " + f1(y - 150 * s) + " " + f1(x + 4 * s) + " " + f1(y - 130 * s) +
        "C" + f1(x + 20 * s) + " " + f1(y - 170 * s) + " " + f1(x + 60 * s) + " " + f1(y - 190 * s) + " " + f1(x + 100 * s) + " " + f1(y - 206 * s) +
        "L" + f1(x + 104 * s) + " " + f1(y - 198 * s) + "C" + f1(x + 50 * s) + " " + f1(y - 160 * s) + " " + f1(x + 12 * s) + " " + f1(y - 110 * s) + " " + f1(x + 10 * s) + " " + f1(y) + "Z" }, g);
      S.paint(tr, "fill", C("trunk"));
      [[0, -214, 210, 30], [-60, -226, 120, 22], [70, -228, 130, 22], [-10, -240, 140, 18]].forEach(function (c, i) {
        var e = el("ellipse", { cx: f1(x + c[0] * s), cy: f1(y + c[1] * s), rx: f1(c[2] * s), ry: f1(c[3] * s) }, canopy); S.paint(e, "fill", C("foliage", i === 0 ? -0.15 : 0));
      });
      var lit = el("ellipse", { cx: f1(x + lightSide * 40 * s), cy: f1(y - 238 * s), rx: f1(110 * s), ry: f1(12 * s) }, canopy); S.paint(lit, "fill", C("foliageLit")); lit.style.opacity = 0.8;
    } else {
      var tk = el("path", { d: "M" + f1(x - 12 * s) + " " + f1(y) + "L" + f1(x - 7 * s) + " " + f1(y - 150 * s) + "L" + f1(x + 7 * s) + " " + f1(y - 150 * s) + "L" + f1(x + 12 * s) + " " + f1(y) + "Z" }, g);
      S.paint(tk, "fill", C("trunk"));
      var blobs = [[0, -220, 92], [-62, -176, 70], [60, -170, 74], [-30, -270, 66], [36, -258, 62], [0, -150, 60]];
      blobs.forEach(function (b) { var c = el("circle", { cx: f1(x + b[0] * s), cy: f1(y + b[1] * s), r: f1(b[2] * s) }, canopy); S.paint(c, "fill", C("foliage")); });
      blobs.slice(0, 4).forEach(function (b) { var c = el("circle", { cx: f1(x + b[0] * s + lightSide * 18 * s), cy: f1(y + b[1] * s - 14 * s), r: f1(b[2] * s * 0.62) }, canopy); S.paint(c, "fill", C("foliageLit")); c.style.opacity = 0.75; });
    }
    if (S.windStrength > 0 && o.sway !== false) S.wave(canopy, "rotation", 0, 0.6 + 1.6 * S.windStrength, 3.2, r(), 0, undefined, { svgOrigin: f1(x) + " " + f1(y - 120 * s) });
    return { g: g };
  });

  /** grass tufts that sway in the wind. {y, x0, x1, count, h, seed, layer, role} */
  K.piece("grass", function (S, o) {
    var g = wrap(S, o.layer || "front"), r = S.rng(o.seed || 141), n = o.count || 26, y = o.y || S.H - 260, H = o.h || 60;
    for (var i = 0; i < n; i++) {
      var bx = rnd(r, o.x0 === undefined ? S.span[0] : o.x0, o.x1 === undefined ? S.span[1] : o.x1), by = y + rnd(r, -(o.jitter || 30), o.jitter || 30);
      var tuft = el("g", null, g), nb = 4 + Math.floor(r() * 5), sc = rnd(r, 0.6, 1.2);
      for (var b = 0; b < nb; b++) {
        var hh = H * sc * rnd(r, 0.45, 1), lean = (b - nb / 2) / nb * hh * 0.9 + rnd(r, -0.15, 0.15) * hh, w = rnd(r, 1.6, 3.2) * (H / 60);
        var bd = "M" + f1(bx - w + b * 3) + " " + f1(by) + "Q" + f1(bx + lean * 0.3 + b * 3) + " " + f1(by - hh * 0.6) + " " + f1(bx + lean + b * 3) + " " + f1(by - hh) + "Q" + f1(bx + lean * 0.2 + b * 3 + w * 0.4) + " " + f1(by - hh * 0.5) + " " + f1(bx + w + b * 3) + " " + f1(by) + "Z";
        var bl = el("path", { d: bd }, tuft); S.paint(bl, "fill", o.role || { role: b % 3 === 0 ? "foliageLit" : "foliage", mix: "haze", k: o.tone === undefined ? 0.15 : o.tone });
      }
      if (S.windStrength > 0) S.wave(tuft, "skewX", 0, (4 + 14 * S.windStrength) * rnd(r, 0.7, 1.2), rnd(r, 1.3, 2.4) / (0.6 + S.windStrength), (bx / 900) % 1, 0, undefined, { svgOrigin: f1(bx) + " " + f1(by) });
    }
    return { g: g };
  });

  // ======================= LIGHT =======================
  /** a soft round light. {x, y, r, color: role, alpha, layer, level, blend} */
  K.piece("glow", function (S, o) {
    var c = el("circle", { cx: o.x || 540, cy: o.y || 900, r: o.r || 300,
      fill: S.rgrad([[0, o.color || "warmGlow", o.alpha === undefined ? 0.45 : o.alpha], [0.4, o.color || "warmGlow", (o.alpha === undefined ? 0.45 : o.alpha) * 0.35], [1, o.color || "warmGlow", 0]]) }, S.L(o.layer || "light"));
    blend(c, o.blend || "screen");
    if (o.level) S.level(c, o.level);
    if (o.flicker) S.wave(c, "opacity", 0.9, 0.1, 0.31, 0.2);
    return { el: c };
  });

  /** light rays (sun through cloud, a window, the surface from below). {x, y, angle: 90 = down, spread, count, length, width, color, alpha, layer, breathe} */
  K.piece("rays", function (S, o) {
    var g = wrap(S, o.layer || "sky"), r = S.rng(o.seed || 151), n = o.count || 6, x = o.x === undefined ? S.light.x : o.x, y = o.y || 0;
    var spread = o.spread === undefined ? 40 : o.spread, base = o.angle === undefined ? 90 : o.angle, len = o.length || 1500, wid = o.width || 90;
    var flt = S.blur(o.soft || 10);
    for (var i = 0; i < n; i++) {
      var a = (base + (n === 1 ? 0 : (i / (n - 1) - 0.5) * spread) + rnd(r, -3, 3)) * PI / 180, L = len * rnd(r, 0.7, 1.05), w = wid * rnd(r, 0.5, 1.2);
      var ex = x + Math.cos(a) * L, ey = y + Math.sin(a) * L, px = -Math.sin(a), py = Math.cos(a);
      var grad = S.vgrad([[0, o.color || "light", o.alpha === undefined ? 0.16 : o.alpha], [1, o.color || "light", 0]], x, y, ex, ey, "userSpaceOnUse");
      var ray = el("path", { d: K.poly([[x + px * 4, y + py * 4], [x - px * 4, y - py * 4], [ex - px * w / 2, ey - py * w / 2], [ex + px * w / 2, ey + py * w / 2]], true), fill: grad, filter: flt }, g);
      blend(ray, "screen");
      if (o.breathe !== false) S.wave(ray, "opacity", 0.75, 0.25, rnd(r, 2.4, 4.4), r());
    }
    if (o.level) S.level(g, o.level);
    if (o.on) S.tl.fromTo(g, { opacity: 0 }, { opacity: 1, duration: o.on.dur || 1.5, ease: "power1.inOut" }, o.on.at || 0);
    return { g: g };
  });

  /** a spotlight from above: a cone, a pool on the floor, the rest dimmed. {x, y: floor, top, w, dim, color, on: {at, dur}} */
  K.piece("spotlight", function (S, o) {
    var g = wrap(S, o.layer || "light"), x = o.x || 540, y = o.y || 1500, top = o.top === undefined ? -40 : o.top, w = o.w || 460;
    var veil = el("rect", { x: 0, y: 0, width: S.W, height: S.H, fill: S.rgrad([[0, "ink", 0], [0.35, "ink", 0], [1, "ink", o.dim === undefined ? 0.6 : o.dim]], x / S.W, (y - 260) / S.H, 0.7) }, g);
    var cone = el("path", { d: K.poly([[x - 36, top], [x + 36, top], [x + w / 2, y], [x - w / 2, y]], true), filter: S.blur(9),
      fill: S.vgrad([[0, o.color || "light", 0.34], [1, o.color || "light", 0.08]], 0, top, 0, y, "userSpaceOnUse") }, g);
    blend(cone, "screen");
    var pool = el("ellipse", { cx: x, cy: y, rx: w * 0.55, ry: w * 0.11, fill: S.rgrad([[0, o.color || "light", 0.45], [1, o.color || "light", 0]]) }, g);
    blend(pool, "screen");
    if (o.on) S.tl.fromTo(g, { opacity: 0 }, { opacity: 1, duration: o.on.dur || 0.6, ease: "power2.out" }, o.on.at || 0);
    return { g: g, veil: veil, cone: cone };
  });

  /** a campfire: stones, logs, three flames that flicker, embers, a glow and a pool of light. {x, y, size, layer} */
  K.piece("fire", function (S, o) {
    var x = o.x || 540, y = o.y || 1500, s = o.size || 1, r = S.rng(o.seed || 161);
    var pool = el("ellipse", { cx: x, cy: y, rx: 330 * s, ry: 80 * s, fill: S.rgrad([[0, "warm", 0.5], [0.5, "warm", 0.16], [1, "warm", 0]]) }, S.L(o.groundLayer || "ground"));
    blend(pool, "screen");
    var g = wrap(S, o.layer || "actors");
    for (var i = 0; i < 7; i++) {
      var a = PI + (i / 6) * PI, sx = x + Math.cos(a) * 52 * s, sy = y + 6 * s + Math.sin(a) * -8 * s;
      var st = el("ellipse", { cx: f1(sx), cy: f1(sy), rx: f1(14 * s), ry: f1(9 * s) }, g); S.paint(st, "fill", { role: "near", shade: -0.2 });
      var lt = el("ellipse", { cx: f1(sx), cy: f1(sy - 4 * s), rx: f1(9 * s), ry: f1(4 * s) }, g); S.paint(lt, "fill", "warm"); lt.style.opacity = 0.45;
    }
    [[-1, 1], [1, -1]].forEach(function (d) {
      var lg = el("path", { d: "M" + f1(x - 46 * s * d[0]) + " " + f1(y + 4 * s) + "L" + f1(x + 40 * s * d[0]) + " " + f1(y - 16 * s), "stroke-width": f1(13 * s), "stroke-linecap": "round" }, g);
      S.paint(lg, "stroke", "wood");
    });
    var flames = [["warmGlow", 46, 104, 0.95], ["warm", 32, 78, 1], ["#fff1c8", 16, 44, 1]];
    flames.forEach(function (F, i) {
      var w = F[1] * s, h = F[2] * s, fw = el("g", null, g);
      var fp = el("path", { d: "M" + f1(x - w / 2) + " " + f1(y) + "C" + f1(x - w * 0.62) + " " + f1(y - h * 0.45) + " " + f1(x - w * 0.12) + " " + f1(y - h * 0.62) + " " + f1(x + w * 0.04) + " " + f1(y - h) +
        "C" + f1(x + w * 0.2) + " " + f1(y - h * 0.62) + " " + f1(x + w * 0.66) + " " + f1(y - h * 0.4) + " " + f1(x + w / 2) + " " + f1(y) + "Z" }, fw);
      if (F[0].charAt(0) === "#") fp.style.fill = F[0]; else S.paint(fp, "fill", F[0]);
      fp.style.opacity = F[3];
      var so = f1(x) + " " + f1(y);
      S.wave(fw, "scaleY", 1, 0.12 + 0.04 * i, 0.26 + 0.07 * i, r(), 0, undefined, { svgOrigin: so });
      S.wave(fw, "skewX", 0, 6 - i, 0.43 + 0.11 * i, r(), 0, undefined, { svgOrigin: so });
    });
    var glow = el("circle", { cx: x, cy: y - 40 * s, r: 380 * s, fill: S.rgrad([[0, "warmGlow", 0.42], [0.3, "warmGlow", 0.16], [1, "warmGlow", 0]]) }, S.L(o.glowLayer || o.layer || "actors"));
    blend(glow, "screen");
    S.wave(glow, "opacity", 0.9, 0.1, 0.29, 0.1);
    var eg = el("g", null, g);
    for (var e = 0; e < (o.embers || 10); e++) {
      var em = el("circle", { cx: f1(x + rnd(r, -16, 16) * s), cy: f1(y - 40 * s), r: f1(rnd(r, 1.4, 2.8) * s) }, eg); S.paint(em, "fill", "warm");
      var period = rnd(r, 1.2, 2.2), t = rnd(r, 0, period);
      em.style.opacity = 0;
      for (; t < S.duration; t += period) {
        S.tl.fromTo(em, { y: 0, x: 0, opacity: 0.95 }, { y: -rnd(r, 140, 260) * s, x: rnd(r, -40, 40) * s, opacity: 0, duration: Math.min(period, S.duration - t), ease: "power1.out" }, t);
      }
    }
    return { g: g, glow: glow, pool: pool };
  });

  /** a lantern (our own design: a dome cap with a ring, a glass body, a flame), lit or lighting up. {x, y, size, hang, on: {at, dur}, layer} */
  K.piece("lamp", function (S, o) {
    var x = o.x || 540, y = o.y || 1000, s = o.size || 1, g = wrap(S, o.layer || "actors");
    if (o.hang) { var rope = el("path", { d: "M" + f1(x) + " " + f1(y - 70 * s - o.hang) + "V" + f1(y - 62 * s), "stroke-width": 2 }, g); S.paint(rope, "stroke", "ink"); }
    var metal = { role: "wood", mix: "warm", k: 0.25 };
    var ring = el("circle", { cx: x, cy: f1(y - 66 * s), r: f1(7 * s), fill: "none", "stroke-width": f1(3 * s) }, g); S.paint(ring, "stroke", metal);
    var cap = el("path", { d: "M" + f1(x - 30 * s) + " " + f1(y - 36 * s) + "Q" + f1(x - 26 * s) + " " + f1(y - 58 * s) + " " + f1(x) + " " + f1(y - 60 * s) + "Q" + f1(x + 26 * s) + " " + f1(y - 58 * s) + " " + f1(x + 30 * s) + " " + f1(y - 36 * s) + "Z" }, g); S.paint(cap, "fill", metal);
    var glass = el("path", { d: "M" + f1(x - 26 * s) + " " + f1(y - 36 * s) + "L" + f1(x - 22 * s) + " " + f1(y + 20 * s) + "L" + f1(x + 22 * s) + " " + f1(y + 20 * s) + "L" + f1(x + 26 * s) + " " + f1(y - 36 * s) + "Z" }, g);
    S.paint(glass, "fill", { role: "warm", mix: "#ffffff", k: 0.2 });
    var lit = el("g", null, g);
    var flame = el("path", { d: "M" + f1(x - 6 * s) + " " + f1(y + 8 * s) + "Q" + f1(x - 7 * s) + " " + f1(y - 6 * s) + " " + f1(x) + " " + f1(y - 18 * s) + "Q" + f1(x + 7 * s) + " " + f1(y - 6 * s) + " " + f1(x + 6 * s) + " " + f1(y + 8 * s) + "Z" }, lit);
    flame.style.fill = "#fff6dc";
    var bars = el("path", { d: "M" + f1(x - 9 * s) + " " + f1(y - 36 * s) + "L" + f1(x - 8 * s) + " " + f1(y + 20 * s) + "M" + f1(x + 9 * s) + " " + f1(y - 36 * s) + "L" + f1(x + 8 * s) + " " + f1(y + 20 * s), "stroke-width": f1(3 * s) }, g); S.paint(bars, "stroke", metal);
    var base = el("path", { d: "M" + f1(x - 28 * s) + " " + f1(y + 20 * s) + "L" + f1(x + 28 * s) + " " + f1(y + 20 * s) + "L" + f1(x + 20 * s) + " " + f1(y + 32 * s) + "L" + f1(x - 20 * s) + " " + f1(y + 32 * s) + "Z" }, g); S.paint(base, "fill", metal);
    // the level (relight) is on the inner groups, the `on` fade on their wrappers: a relight and `on` never fight
    var glowW = el("g", null, S.L(o.glowLayer || o.layer || "actors"));
    var glow = el("circle", { cx: x, cy: y - 8 * s, r: f1((o.reach || 300) * s), fill: S.rgrad([[0, "warmGlow", 0.5], [0.25, "warmGlow", 0.18], [1, "warmGlow", 0]]) }, glowW);
    blend(glow, "screen");
    var core = el("circle", { cx: x, cy: y - 6 * s, r: f1(40 * s), fill: S.rgrad([[0, "#fff4d6", 0.85], [1, "warm", 0]]) }, g); blend(core, "screen");
    var onW = el("g", null, g), on = el("g", null, onW); on.appendChild(lit); on.appendChild(core);
    S.level(glow, "lamp"); S.level(on, "lamp");
    S.wave(glow, "scale", 1, 0.025, 0.37, 0.3, 0, undefined, { svgOrigin: f1(x) + " " + f1(y) });
    if (o.on) { S.tl.fromTo([glowW, onW], { opacity: 0 }, { opacity: 1, duration: o.on.dur || 0.5, ease: "power2.out" }, o.on.at || 0); S.tl.set(glass, { opacity: 0.55 }, 0); S.tl.to(glass, { opacity: 1, duration: o.on.dur || 0.5 }, o.on.at || 0); }
    return { g: g, glow: glow, glowWrap: glowW, light: onW };
  });

  // ======================= WEATHER =======================
  /** rain in two depths. {density, angle, speed, stop: {at, dur}, start: {at, dur}, layer} */
  K.piece("rain", function (S, o) {
    var g = wrap(S, o.layer || "weather"), ang = o.angle === undefined ? 8 : o.angle, sp = o.speed || 1, dens = o.density || 1;
    var travelNear = 440 * sp * S.duration, travelFar = 200 * sp * S.duration, tall = travelNear + 2600;
    var rot = el("g", { transform: "rotate(" + ang + " 540 960)" }, g);
    function pat(w, h, lines) {
      var id = S.id("rain"), p = el("pattern", { id: id, width: w, height: h, patternUnits: "userSpaceOnUse" }, S.defs);
      lines.forEach(function (L) { var l = el("line", { x1: L[0], y1: L[1], x2: L[0], y2: L[1] + L[2], "stroke-width": L[3], "stroke-linecap": "round", opacity: L[4] }, p); S.paint(l, "stroke", "rain"); });
      return "url(#" + id + ")";
    }
    var far = el("g", null, rot), near = el("g", null, rot);
    el("rect", { x: -500, y: -tall, width: 2100, height: tall + 2400, fill: pat(Math.round(64 / dens), 130, [[10, 0, 30, 1.8, 0.5], [44, 70, 26, 1.6, 0.38]]) }, far);
    el("rect", { x: -500, y: -tall, width: 2100, height: tall + 2400, fill: pat(Math.round(140 / dens), 270, [[20, 10, 74, 3.2, 0.62], [92, 150, 58, 2.8, 0.5]]) }, near);
    far.style.opacity = 0.55; near.style.opacity = 0.8;
    S.tl.fromTo(near, { y: 0 }, { y: travelNear, duration: S.duration, ease: "none" }, 0);
    S.tl.fromTo(far, { y: 0 }, { y: travelFar, duration: S.duration, ease: "none" }, 0);
    if (o.start) S.tl.fromTo(g, { opacity: 0 }, { opacity: 1, duration: o.start.dur || 1, ease: "power1.inOut" }, o.start.at || 0);
    if (o.stop) S.tl.to(g, { opacity: o.stop.to || 0, duration: o.stop.dur || 1.6, ease: "power1.inOut" }, o.stop.at || 0);
    return { g: g };
  });

  /** lightning: a branched bolt, a full-frame flash, the clouds lit from inside. {at: [t, …], x, top, bottom, seed, flash} */
  K.piece("lightning", function (S, o) {
    var r = S.rng(o.seed || 171), times = o.at || [1], top = o.top === undefined ? S.horizon - 560 : o.top, bot = o.bottom || S.horizon - 60;
    var x = o.x === undefined ? 560 : o.x, bg = wrap(S, o.layer || "sky");
    function bolt(x0, y0, x1, y1, rough, depth, out) {
      var pts = [[x0, y0], [x1, y1]];
      for (var it = 0; it < 5; it++) {
        var np = [pts[0]];
        for (var i = 1; i < pts.length; i++) { var a = pts[i - 1], b = pts[i]; np.push([(a[0] + b[0]) / 2 + rnd(r, -1, 1) * rough, (a[1] + b[1]) / 2]); np.push(b); }
        pts = np; rough *= 0.55;
      }
      out.push(pts);
      if (depth > 0) { var k = Math.floor(pts.length * rnd(r, 0.3, 0.6)), p = pts[k]; bolt(p[0], p[1], p[0] + rnd(r, -140, 140), p[1] + (y1 - y0) * rnd(r, 0.25, 0.45), rough * 1.4, depth - 1, out); }
    }
    var paths = []; bolt(x, top, x + rnd(r, -80, 80), bot, 70, 2, paths);
    var gb = el("g", null, bg); gb.style.opacity = 0;
    paths.forEach(function (pp, i) {
      var d = K.poly(pp, false);
      var halo = el("path", { d: d, fill: "none", "stroke-width": i ? 10 : 20, filter: S.blur(6) }, gb); S.paint(halo, "stroke", "light"); halo.style.opacity = 0.8;
      var core = el("path", { d: d, fill: "none", "stroke-width": i ? 2.5 : 5, "stroke-linejoin": "round" }, gb); core.style.stroke = "#f6f8ff";
    });
    var flash = el("rect", { x: 0, y: 0, width: S.W, height: S.H }, S.L(o.flashLayer || "light")); S.paint(flash, "fill", "light"); flash.style.opacity = 0; blend(flash, "screen");
    var A = o.flash === undefined ? 0.5 : o.flash, rims = S._cloudRims || [];
    times.forEach(function (t) {
      S.tl.to(flash, { opacity: A, duration: 0.05 }, t).to(flash, { opacity: A * 0.15, duration: 0.1 }, t + 0.05)
        .to(flash, { opacity: A * 0.65, duration: 0.05 }, t + 0.18).to(flash, { opacity: 0, duration: 0.5, ease: "power2.out" }, t + 0.23);
      S.tl.set(gb, { opacity: 1 }, t).set(gb, { opacity: 0.25 }, t + 0.08).set(gb, { opacity: 1 }, t + 0.18).to(gb, { opacity: 0, duration: 0.22 }, t + 0.26);
      rims.forEach(function (rm) { var base = +rm.style.opacity || 0.35; S.tl.to(rm, { opacity: 1, duration: 0.05 }, t).to(rm, { opacity: base, duration: 0.6, ease: "power2.out" }, t + 0.25); });
    });
    return { bolt: gb, flash: flash };
  });

  /** wind: dust drifting across, a few streaks. (Palms and grass sway by stage.wind.) {dust, streaks, y0, y1, dir} */
  K.piece("wind", function (S, o) {
    var g = wrap(S, o.layer || "weather"), r = S.rng(o.seed || 181), dir = o.dir === "right" ? 1 : -1;
    var y0 = o.y0 || S.horizon - 100, y1 = o.y1 || S.H - 200;
    for (var i = 0; i < (o.dust === undefined ? 36 : o.dust); i++) {
      var m = el("circle", { cx: f1(rnd(r, -100, S.W + 100)), cy: f1(rnd(r, y0, y1)), r: f1(rnd(r, 1, 2.6)) }, g);
      S.paint(m, "fill", o.color || { role: "groundTop", mix: "light", k: 0.4 }); m.style.opacity = rnd(r, 0.2, 0.55);
      var dist = rnd(r, 300, 700) * (o.strength || 1);
      S.tl.fromTo(m, { x: -dir * dist / 2 }, { x: dir * dist / 2, duration: S.duration, ease: "none" }, 0);
      S.wave(m, "y", 0, rnd(r, 4, 14), rnd(r, 1.2, 2.4), r());
    }
    for (var k = 0; k < (o.streaks === undefined ? 5 : o.streaks); k++) {
      var sy = rnd(r, y0, y1), sl = el("path", { d: "M0 " + f1(sy) + "h" + f1(rnd(r, 120, 260)), "stroke-width": 1.6, "stroke-linecap": "round" }, g);
      S.paint(sl, "stroke", o.color || { role: "groundTop", mix: "light", k: 0.5 }); sl.style.opacity = 0;
      var t0 = rnd(r, 0, Math.max(0.1, S.duration - 1.2));
      // (x and opacity in separate tweens: the old shared tween held opacity at 0 under the fade and tripped check's tween-tail warning)
      S.tl.fromTo(sl, { x: dir < 0 ? S.W + 50 : -300 }, { x: dir < 0 ? -300 : S.W + 50, duration: 1.1, ease: "none" }, t0);
      S.tl.fromTo(sl, { opacity: 0 }, { opacity: 0.4, duration: 0.3, immediateRender: false }, t0);
      S.tl.fromTo(sl, { opacity: 0.4 }, { opacity: 0, duration: 0.4, immediateRender: false }, t0 + 0.7);
    }
    return { g: g };
  });

  /** smoke rising from a roof, a fire or a cup: soft puffs that grow, drift and fade, one every `every` seconds.
      {x, y, at: 0, until: the stage's end, every: 0.4, life: 3.6, rise: 280, drift: 60 (px over a puff's life;
       negative = left), size: 40 (a puff's last radius), alpha: 0.85, color: role spec, layer: "mid", seed} */
  K.piece("smoke", function (S, o) {
    var g = wrap(S, o.layer || "mid"), r = S.rng(o.seed || 3), spec = o.color || { role: "cloudLit", mix: "light", k: 0.3 };
    var fill = S.rgrad([[0, spec, 0.5], [0.55, spec, 0.2], [1, spec, 0]]), x = o.x === undefined ? 540 : o.x, y = o.y === undefined ? 1200 : o.y;
    var until = o.until === undefined ? S.duration - 0.3 : o.until, a = o.alpha === undefined ? 0.85 : o.alpha, R0 = 9, R1 = R0 + (o.size || 40);
    for (var t = o.at || 0; t < until; t += o.every || 0.4) {
      var life = (o.life || 3.6) * (0.85 + 0.3 * r()), x0 = x + (r() - 0.5) * 10, end = Math.min(S.duration, t + life), k = (end - t) / life;
      var c = el("circle", { cx: f1(x0), cy: f1(y), r: R0, fill: fill }, g); c.style.opacity = 0;
      S.tl.fromTo(c, { attr: { cx: x0, cy: y, r: R0 } }, { attr: { cx: x0 + (o.drift === undefined ? 60 : o.drift) * k + (r() - 0.5) * 24, cy: y - (o.rise || 280) * k, r: R0 + (R1 - R0) * k },
        duration: end - t, ease: "sine.out", immediateRender: false }, t);
      S.tl.fromTo(c, { opacity: 0 }, { opacity: a, duration: 0.5, ease: "power1.out", immediateRender: false }, t);
      S.tl.fromTo(c, { opacity: a }, { opacity: 0, duration: Math.max(0.2, end - t - 0.5), ease: "power1.in", immediateRender: false }, t + 0.5);
    }
    return { g: g };
  });

  /** birds crossing the sky, wings flapping. {count, x, y, dx, dy, at, dur, size, layer} */
  K.piece("birds", function (S, o) {
    var g = wrap(S, o.layer || "sky"), r = S.rng(o.seed || 191), n = o.count || 4, s = o.size || 1;
    var at = o.at || 0, dur = o.dur || S.duration - at;
    for (var i = 0; i < n; i++) {
      var b = el("g", null, g), bx = (o.x || 760) + rnd(r, -60, 60) * i * 0.7, by = (o.y || 760) + rnd(r, -30, 30) * i * 0.6, bs = s * rnd(r, 0.75, 1.1);
      var up = "M" + f1(bx - 12 * bs) + " " + f1(by - 5 * bs) + "Q" + f1(bx - 6 * bs) + " " + f1(by - 9 * bs) + " " + f1(bx) + " " + f1(by) + "Q" + f1(bx + 6 * bs) + " " + f1(by - 9 * bs) + " " + f1(bx + 12 * bs) + " " + f1(by - 5 * bs);
      var dn = "M" + f1(bx - 12 * bs) + " " + f1(by + 5 * bs) + "Q" + f1(bx - 6 * bs) + " " + f1(by - 1 * bs) + " " + f1(bx) + " " + f1(by) + "Q" + f1(bx + 6 * bs) + " " + f1(by - 1 * bs) + " " + f1(bx + 12 * bs) + " " + f1(by + 5 * bs);
      var p = el("path", { d: up, fill: "none", "stroke-width": f1(2.6 * bs), "stroke-linecap": "round", "stroke-linejoin": "round" }, b);
      S.paint(p, "stroke", o.color || { role: "ink", mix: "sky2", k: 0.25 });
      var fl = rnd(r, 0.16, 0.22), t = at + rnd(r, 0, fl), k = 0;
      for (; t < at + dur; t += fl, k++) S.tl.to(p, { attr: { d: k % 2 ? up : dn }, duration: fl, ease: "sine.inOut" }, t);
      b.style.opacity = 0;
      S.tl.set(b, { opacity: 1 }, at);
      S.tl.fromTo(b, { x: 0, y: 0 }, { x: (o.dx || -520) * rnd(r, 0.85, 1.1), y: (o.dy || -120) * rnd(r, 0.6, 1.2), duration: dur, ease: "none" }, at);
    }
    return { g: g };
  });

  // ======================= FILM =======================
  /** the film on top: a vignette and a still grain. {grain: 0.12, vignette: 0.55, seed} */
  K.piece("film", function (S, o) {
    var g = wrap(S, o.layer || "film");
    var vig = o.vignette === undefined ? 0.55 : o.vignette;
    if (vig > 0) el("rect", { x: 0, y: 0, width: S.W, height: S.H, fill: S.rgrad([[0.45, "ink", 0], [1, "ink", vig]], 0.5, o.center || 0.55, 0.78) }, g);
    var gr = o.grain === undefined ? 0.12 : o.grain;
    if (gr > 0) {
      var id = S.id("grain"), f = el("filter", { id: id, x: 0, y: 0, width: "100%", height: "100%" }, S.defs);
      el("feTurbulence", { type: "fractalNoise", baseFrequency: o.grainSize || 0.85, numOctaves: 2, seed: o.seed || 7, stitchTiles: "stitch" }, f);
      el("feColorMatrix", { type: "saturate", values: 0 }, f);
      var n = el("rect", { x: 0, y: 0, width: S.W, height: S.H, filter: "url(#" + id + ")" }, g);
      n.style.opacity = gr; blend(n, "overlay");
    }
    return { g: g };
  });
})(window.Khaam);
