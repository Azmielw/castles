/*
  «موشن خام» paper world (paper.js). Needs kit.js first (figure.js too if you draw people).
  The cream-paper kind of telling: a page (ruled, blank, grid or dotted, with a margin), ink and pencil lines that
  draw themselves, hatching and a wash of colour, and simple object drawings that build stroke by stroke.
  Use the "paper" palette: Khaam.stage(svg, {palette: "paper", …}). People on paper: S.figure({style: "ink", …}).

  S.paper({kind, margin, fibre})          the page
  S.ink({d, at, dur, color, width, pencil, still, dotted}) one line that draws itself (any SVG path); still: true = on
                                          the page from frame 0; dotted: true (or the gap in px) = drawn dot by dot
  S.sketch({name, x, y, size, at, dur, color, fill, fillAt, fillColor, still})   a drawing from Khaam.drawings, built in order
  S.mark({kind, x, y, w, h, at, dur})     a hand mark: circle, underline, check, cross, arrow
  S.reveal({el, at, dur, dir})            wipe anything in, as if it is being drawn (up, down, right, left)
  S.book({x, y, w, h, shut: {at}, turn: [t…]})   a big open book with lines of text, whose pages turn and that shuts
  S.writing(x1, y0, lines, {gap, at, each, still, pencil})   lines of handwriting, right to left, one after another
  A stroke revealed by dash offset shows its round cap as a dot at length 0: ink() keeps the line hidden until it
  starts; in your own dash reveals, hide by opacity (or use a butt cap) while the length is 0.
*/
(function (K) {
  "use strict";
  var el = K.el, f1 = K.f1, PI = Math.PI;

  /** shaky hand: jitter points a little (seeded), then smooth */
  function hand(S, pts, amt, closed) {
    var r = S.rng(pts.length * 13 + Math.round(pts[0][0] + pts[0][1]));
    var j = pts.map(function (p) { return [p[0] + (r() - 0.5) * amt, p[1] + (r() - 0.5) * amt]; });
    return K.smooth(j, closed, 0.5);
  }
  /** a straight hand line (corners stay corners: boxes, legs, bars), jittered a little, seeded */
  function hp(S, pts, amt, closed) {
    var r = S.rng(pts.length * 17 + Math.round(pts[0][0] * 3 + pts[0][1]));
    return K.poly(pts.map(function (p) { return [p[0] + (r() - 0.5) * (amt || 2.5), p[1] + (r() - 0.5) * (amt || 2.5)]; }), closed);
  }
  K.handLine = function (S, pts, amt, closed) { return hand(S, pts, amt === undefined ? 3 : amt, closed); };
  K.handPoly = hp;
  function circlePts(cx, cy, rx, ry, n, a0, turns) {
    var out = []; turns = turns || 1;
    for (var i = 0; i <= n; i++) { var a = (a0 || -PI / 2) + i / n * 2 * PI * turns; out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
    return out;
  }

  /** the page */
  K.piece("paper", function (S, o) {
    var g = el("g", null, S.L(o.layer || "sky")), W = S.W, H = S.H;
    var base = el("rect", { x: -300, y: -300, width: W + 600, height: H + 600 }, g); S.paint(base, "fill", "paper");
    el("rect", { x: -300, y: -300, width: W + 600, height: H + 600, fill: S.rgrad([[0.55, "paperEdge", 0], [1, "paperEdge", 0.9]], 0.5, 0.5, 0.75) }, g);
    if (o.fibre !== false) {
      var id = S.id("fib"), f = el("filter", { id: id, x: 0, y: 0, width: "100%", height: "100%" }, S.defs);
      el("feTurbulence", { type: "fractalNoise", baseFrequency: "0.55 0.5", numOctaves: 2, seed: o.seed || 4 }, f);
      el("feColorMatrix", { type: "matrix", values: "0 0 0 0 0.45  0 0 0 0 0.38  0 0 0 0 0.25  0 0 0 0.9 -0.35" }, f);
      var fib = el("rect", { x: -300, y: -300, width: W + 600, height: H + 600, filter: "url(#" + id + ")" }, g); fib.style.opacity = o.fibreAlpha || 0.22;
      fib.style.mixBlendMode = "multiply";
    }
    var kind = o.kind || "ruled", step = o.step || 64, top = o.top === undefined ? 300 : o.top;
    if (kind === "ruled") for (var y = top; y < H + 300; y += step) { var l = el("rect", { x: -300, y: y, width: W + 600, height: 2 }, g); S.paint(l, "fill", "rule"); l.style.opacity = 0.42; }
    if (kind === "grid") for (var gy = -300; gy < H + 300; gy += step / 2) { var a = el("rect", { x: -300, y: gy, width: W + 600, height: 1.4 }, g); S.paint(a, "fill", "rule"); a.style.opacity = 0.28; var b = el("rect", { x: gy, y: -300, width: 1.4, height: H + 600 }, g); S.paint(b, "fill", "rule"); b.style.opacity = 0.28; }
    if (kind === "dotted") for (var dy = top; dy < H + 300; dy += step / 2) for (var dx = 20; dx < W; dx += step / 2) { var d = el("circle", { cx: dx, cy: dy, r: 2 }, g); S.paint(d, "fill", "rule"); d.style.opacity = 0.4; }
    if (o.margin !== false && kind !== "blank") { var m = el("rect", { x: o.marginX || 140, y: -300, width: 2.5, height: H + 600 }, g); S.paint(m, "fill", "margin"); m.style.opacity = 0.6; }
    return { g: g };
  });

  /** one line that draws itself. d = any SVG path. {at, dur, color: role, width, pencil, ease, layer, cap,
      still: true (already on the page at frame 0, no draw-on), dotted: true | gap px (a line of dots, drawn dot by dot)} */
  K.piece("ink", function (S, o) {
    var d = o.d, g = o.parent || S.L(o.layer || "near"), wd = o.width || (o.pencil ? 2.6 : 4.2);
    var at = o.at || 0, dur = o.dur === undefined ? 0.6 : o.dur, color = o.color || (o.pencil ? "pencil" : "ink");
    if (o.dotted) {   // dots along the path (a thought bubble, a dotted guide); the path itself stays hidden
      var gap = typeof o.dotted === "number" ? o.dotted : Math.max(10, wd * 3.4), dg = el("g", null, g);
      var guide = el("path", { d: d, fill: "none" }, dg), len = 0;
      try { len = guide.getTotalLength(); } catch (e) { len = 0; }
      var n = Math.max(1, Math.floor(len / gap));
      for (var i = 0; i <= n; i++) {
        var pt = len ? guide.getPointAtLength(Math.min(len, i * gap)) : { x: 0, y: 0 };
        var c = el("circle", { cx: f1(pt.x), cy: f1(pt.y), r: f1(wd * 0.62) }, dg); S.paint(c, "fill", color);
        if (o.pencil) c.style.opacity = 0.85;
        if (!o.still) { c.style.visibility = "hidden"; S.tl.set(c, { visibility: "visible" }, at + dur * i / (n + 1)); }
      }
      dg.removeChild(guide);
      return dg;
    }
    var p = el("path", { d: d, fill: "none", "stroke-width": wd, "stroke-linecap": o.cap || "round", "stroke-linejoin": "round", pathLength: 1 }, g);
    S.paint(p, "stroke", color);
    if (o.pencil) { p.setAttribute("filter", pencilFilter(S)); p.style.opacity = 0.85; }
    if (o.still) return p;   // on the page from frame 0 (a cover frame that must show it)
    p.style.strokeDasharray = "1 1.02"; p.style.strokeDashoffset = 1;
    p.style.visibility = "hidden";   // hidden until it starts: a dash of length 0 would still show its round cap as a dot
    S.tl.set(p, { visibility: "visible" }, at);
    S.tl.fromTo(p, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: dur, ease: o.ease || "power1.inOut" }, at);
    return p;
  });
  K.piece("inkLine", function (S, o) { o.d = hand(S, o.points, o.wobble === undefined ? 4 : o.wobble, o.closed); return S.ink(o); });
  function pencilFilter(S) {
    if (S._pencil) return S._pencil;
    var id = S.id("pen"), f = el("filter", { id: id, x: "-5%", y: "-5%", width: "110%", height: "110%" }, S.defs);
    el("feTurbulence", { type: "fractalNoise", baseFrequency: 0.9, numOctaves: 1, seed: 3, result: "n" }, f);
    el("feDisplacementMap", { in: "SourceGraphic", in2: "n", scale: 2.2, xChannelSelector: "R", yChannelSelector: "G" }, f);
    return (S._pencil = "url(#" + id + ")");
  }

  /** hatching or a wash, appearing over a shape. {d, kind: "hatch"|"wash", at, dur, color, angle, gap, alpha, still} */
  K.piece("fill", function (S, o) {
    var g = o.parent || S.L(o.layer || "near"), e, a;
    if (o.kind === "hatch") {
      var id = S.id("hat"), gap = o.gap || 11, pat = el("pattern", { id: id, width: gap, height: gap, patternUnits: "userSpaceOnUse", patternTransform: "rotate(" + (o.angle === undefined ? 40 : o.angle) + ")" }, S.defs);
      var ln = el("rect", { x: 0, y: 0, width: 2, height: gap }, pat); S.paint(ln, "fill", o.color || "hatch");
      e = el("path", { d: o.d, fill: "url(#" + id + ")" }, g); a = o.alpha || 0.55;
      e.style.opacity = o.still ? a : 0;
      if (!o.still) S.tl.to(e, { opacity: a, duration: o.dur || 0.5, ease: "power1.out" }, o.at || 0);
    } else {
      e = el("path", { d: o.d, transform: "translate(" + (o.offset === undefined ? 6 : o.offset) + " " + (o.offset === undefined ? 4 : o.offset) + ")" }, g);
      S.paint(e, "fill", o.color || "wash"); a = o.alpha || 0.75; e.style.opacity = o.still ? a : 0; e.style.mixBlendMode = "multiply";
      if (!o.still) S.tl.to(e, { opacity: a, duration: o.dur || 0.6, ease: "power1.out" }, o.at || 0);
    }
    return e;
  });

  /** wipe an element in, as if drawn: {at, dur, dir: up|down|right|left, box: [x, y, w, h]} */
  K.piece("reveal", function (S, o) {
    var target = o.el, b = o.box || (function () { try { var bb = target.getBBox(); return [bb.x - 20, bb.y - 20, bb.width + 40, bb.height + 40]; } catch (e) { return [0, 0, S.W, S.H]; } })();
    var id = S.id("rv"), cp = el("clipPath", { id: id, clipPathUnits: "userSpaceOnUse" }, S.defs), dir = o.dir || "up";
    var r = el("rect", { x: b[0], y: b[1], width: b[2], height: b[3] }, cp);
    var wrapG = el("g", { "clip-path": "url(#" + id + ")" }, target.parentNode);
    wrapG.appendChild(target);
    var from = {}, to = {};
    if (dir === "up") { from = { y: b[1] + b[3], height: 0 }; to = { y: b[1], height: b[3] }; }
    if (dir === "down") { from = { height: 0 }; to = { height: b[3] }; }
    if (dir === "right") { from = { width: 0 }; to = { width: b[2] }; }
    if (dir === "left") { from = { x: b[0] + b[2], width: 0 }; to = { x: b[0], width: b[2] }; }
    gsap.set(r, { attr: from });
    S.tl.fromTo(r, { attr: from }, { attr: to, duration: o.dur || 0.8, ease: o.ease || "power1.inOut" }, o.at || 0);
    return wrapG;
  });

  // ---------- the drawings: each returns {strokes: [d…], fills: [{d, kind}]} at (x, y) = the base centre, s = size (1 ≈ 200 px) ----------
  K.drawings = {
    ground: function (S, x, y, s) { var w = 900 * s; return { strokes: [hand(S, [[x - w / 2, y], [x - w / 4, y - 3], [x, y + 2], [x + w / 4, y - 2], [x + w / 2, y + 1]], 3)].concat([[-0.38, 1], [-0.2, -1], [0.12, 1], [0.33, -1]].map(function (k) { var gx = x + k[0] * w; return "M" + f1(gx) + " " + f1(y) + "l" + f1(8 * k[1]) + " -14M" + f1(gx + 10) + " " + f1(y) + "l" + f1(4 * k[1]) + " -10"; })), fills: [] }; },
    seed: function (S, x, y, s) { return { strokes: [hand(S, circlePts(x, y - 16 * s, 12 * s, 17 * s, 10), 1.5, false)], fills: [{ d: K.ellipse(x, y - 16 * s, 12 * s, 17 * s, 10), kind: "wash" }] }; },
    sprout: function (S, x, y, s) { return { strokes: [hand(S, [[x, y], [x + 4 * s, y - 40 * s], [x - 2 * s, y - 80 * s]], 2), hand(S, [[x - 2 * s, y - 70 * s], [x - 34 * s, y - 92 * s], [x - 50 * s, y - 80 * s], [x - 26 * s, y - 66 * s], [x - 2 * s, y - 70 * s]], 2), hand(S, [[x, y - 76 * s], [x + 30 * s, y - 104 * s], [x + 50 * s, y - 96 * s], [x + 28 * s, y - 78 * s], [x, y - 76 * s]], 2)],
      fills: [{ d: "M" + f1(x - 2 * s) + " " + f1(y - 70 * s) + "Q" + f1(x - 40 * s) + " " + f1(y - 100 * s) + " " + f1(x - 50 * s) + " " + f1(y - 80 * s) + "Q" + f1(x - 26 * s) + " " + f1(y - 62 * s) + " " + f1(x - 2 * s) + " " + f1(y - 70 * s) + "ZM" + f1(x) + " " + f1(y - 76 * s) + "Q" + f1(x + 34 * s) + " " + f1(y - 110 * s) + " " + f1(x + 50 * s) + " " + f1(y - 96 * s) + "Q" + f1(x + 28 * s) + " " + f1(y - 74 * s) + " " + f1(x) + " " + f1(y - 76 * s) + "Z", kind: "wash", color: "wash2" }] }; },
    tree: function (S, x, y, s) {
      var trunk = [hand(S, [[x - 14 * s, y], [x - 10 * s, y - 120 * s], [x - 30 * s, y - 190 * s]], 2), hand(S, [[x + 14 * s, y], [x + 10 * s, y - 120 * s], [x + 34 * s, y - 196 * s]], 2), hand(S, [[x - 4 * s, y - 120 * s], [x + 2 * s, y - 175 * s]], 2)];
      var crown = [], n = 13;
      for (var i = 0; i <= n; i++) { var a = PI * 0.62 + i / n * PI * 2.06, rr = (i % 2 ? 106 : 126) * s * (1 + 0.06 * Math.sin(i * 2.3)); crown.push([x + Math.cos(a) * rr * 1.16, y - 250 * s + Math.sin(a) * rr * 0.95]); }
      return { strokes: trunk.concat([hand(S, crown, 6, false)]), fills: [{ d: K.ellipse(x, y - 250 * s, 145 * s, 120 * s, 0), kind: "wash", color: "wash2" }, { d: K.ellipse(x + 30 * s, y - 225 * s, 100 * s, 85 * s, 0), kind: "hatch" }] };
    },
    sun: function (S, x, y, s) {
      var c = y - 60 * s, strokes = [hand(S, circlePts(x, c, 56 * s, 56 * s, 14), 3, false)];
      for (var i = 0; i < 10; i++) { var a = i / 10 * 2 * PI, r1 = 76 * s, r2 = (i % 2 ? 100 : 112) * s; strokes.push("M" + f1(x + Math.cos(a) * r1) + " " + f1(c + Math.sin(a) * r1) + "L" + f1(x + Math.cos(a) * r2) + " " + f1(c + Math.sin(a) * r2)); }
      return { strokes: strokes, fills: [{ d: K.ellipse(x, c, 56 * s, 56 * s, 0), kind: "wash", color: "accent" }] };
    },
    moon: function (S, x, y, s) { var c = y - 60 * s; return { strokes: [hand(S, [[x + 10 * s, c - 60 * s], [x - 40 * s, c - 30 * s], [x - 44 * s, c + 26 * s], [x + 6 * s, c + 60 * s], [x - 12 * s, c + 20 * s], [x - 14 * s, c - 22 * s], [x + 10 * s, c - 60 * s]], 2)], fills: [] }; },
    house: function (S, x, y, s) { var w = 170 * s, h = 130 * s; return { strokes: [hand(S, [[x - w / 2, y], [x - w / 2, y - h], [x + w / 2, y - h], [x + w / 2, y], [x - w / 2, y]], 3), hand(S, [[x - w / 2 - 14 * s, y - h], [x, y - h - 90 * s], [x + w / 2 + 14 * s, y - h]], 3), K.archPath(x, y, 44 * s, 76 * s, true)], fills: [{ d: K.poly([[x - w / 2, y], [x - w / 2, y - h], [x + w / 2, y - h], [x + w / 2, y]], true), kind: "wash" }] }; },
    // a lantern that reads as a light (1.7.0 of 11-12: the 1.7 one, a red-filled body, read as a bottle): a ring, a dome, a glass
    // body with two bars, a flame inside (the only accent), a base, and short rays around it
    lamp: function (S, x, y, s) {
      var t = y - 150 * s, top = t + 34 * s, bot = y - 16 * s, fy = y - 46 * s, strokes = [
        K.ellipse(x, t - 14 * s, 9 * s, 9 * s, 0),
        hand(S, [[x - 34 * s, top], [x - 22 * s, t + 6 * s], [x, t - 4 * s], [x + 22 * s, t + 6 * s], [x + 34 * s, top]], 1.5),
        hp(S, [[x - 34 * s, top], [x + 34 * s, top]], 1.5),
        hp(S, [[x - 30 * s, top], [x - 24 * s, bot], [x + 24 * s, bot], [x + 30 * s, top]], 1.5),
        hp(S, [[x - 10 * s, top], [x - 9 * s, bot]], 1), hp(S, [[x + 10 * s, top], [x + 9 * s, bot]], 1),
        hp(S, [[x - 36 * s, bot], [x + 36 * s, bot], [x + 28 * s, y], [x - 28 * s, y]], 1.5, true),
        hand(S, [[x, fy + 14 * s], [x - 9 * s, fy - 2 * s], [x, fy - 30 * s], [x + 9 * s, fy - 2 * s], [x, fy + 14 * s]], 0.8)];
      [[-1, -0.35], [-1, 0.25], [1, -0.35], [1, 0.25]].forEach(function (k) {
        var a = k[1], r1 = 56 * s, r2 = 80 * s, cx = x, cy = t + 60 * s;
        strokes.push(hp(S, [[cx + k[0] * Math.cos(a) * r1, cy + Math.sin(a) * r1], [cx + k[0] * Math.cos(a) * r2, cy + Math.sin(a) * r2]], 1));
      });
      return { strokes: strokes, fills: [
        { d: K.poly([[x - 30 * s, top], [x - 24 * s, bot], [x + 24 * s, bot], [x + 30 * s, top]], true), kind: "wash" },
        { d: "M" + f1(x) + " " + f1(fy + 14 * s) + "Q" + f1(x - 14 * s) + " " + f1(fy - 4 * s) + " " + f1(x) + " " + f1(fy - 30 * s) + "Q" + f1(x + 14 * s) + " " + f1(fy - 4 * s) + " " + f1(x) + " " + f1(fy + 14 * s) + "Z", kind: "wash", color: "accent" }] };
    },
    book: function (S, x, y, s) { return { strokes: [hand(S, [[x, y - 10 * s], [x - 50 * s, y - 30 * s], [x - 96 * s, y - 24 * s], [x - 96 * s, y - 120 * s], [x - 50 * s, y - 126 * s], [x, y - 106 * s]], 2), hand(S, [[x, y - 10 * s], [x + 50 * s, y - 30 * s], [x + 96 * s, y - 24 * s], [x + 96 * s, y - 120 * s], [x + 50 * s, y - 126 * s], [x, y - 106 * s]], 2), "M" + f1(x) + " " + f1(y - 106 * s) + "V" + f1(y - 10 * s)], fills: [] }; },
    cup: function (S, x, y, s) { return { strokes: [hand(S, [[x - 44 * s, y - 90 * s], [x - 36 * s, y - 10 * s], [x + 36 * s, y - 10 * s], [x + 44 * s, y - 90 * s]], 2), hand(S, [[x + 42 * s, y - 70 * s], [x + 70 * s, y - 64 * s], [x + 66 * s, y - 36 * s], [x + 38 * s, y - 34 * s]], 2), hand(S, [[x - 70 * s, y], [x + 70 * s, y]], 2), hand(S, [[x - 8 * s, y - 110 * s], [x + 2 * s, y - 130 * s], [x - 6 * s, y - 150 * s]], 2)], fills: [] }; },
    key: function (S, x, y, s) { return { strokes: [hand(S, circlePts(x - 70 * s, y - 40 * s, 26 * s, 26 * s, 10), 2, false), hand(S, [[x - 44 * s, y - 40 * s], [x + 80 * s, y - 40 * s]], 2), "M" + f1(x + 50 * s) + " " + f1(y - 40 * s) + "v18M" + f1(x + 72 * s) + " " + f1(y - 40 * s) + "v24"], fills: [] }; },
    door: function (S, x, y, s) { return { strokes: [K.archPath(x, y, 110 * s, 220 * s, true), "M" + f1(x) + " " + f1(y - 170 * s) + "V" + f1(y), K.ellipse(x + 16 * s, y - 100 * s, 5 * s, 5 * s, 0)], fills: [{ d: K.archPath(x, y, 110 * s, 220 * s, true), kind: "hatch" }] }; },
    mountain: function (S, x, y, s) { return { strokes: [hand(S, [[x - 200 * s, y], [x - 60 * s, y - 180 * s], [x, y - 120 * s], [x + 70 * s, y - 230 * s], [x + 220 * s, y]], 3), hand(S, [[x + 70 * s, y - 230 * s], [x + 40 * s, y - 170 * s], [x + 76 * s, y - 150 * s], [x + 60 * s, y - 120 * s]], 2)], fills: [{ d: K.poly([[x + 70 * s, y - 230 * s], [x + 220 * s, y], [x + 60 * s, y], [x + 40 * s, y - 170 * s]], true), kind: "hatch" }] }; },
    cloud: function (S, x, y, s) { var c = y - 60 * s; return { strokes: [hand(S, [[x - 110 * s, c + 30 * s], [x - 112 * s, c - 6 * s], [x - 70 * s, c - 24 * s], [x - 40 * s, c - 60 * s], [x + 10 * s, c - 64 * s], [x + 50 * s, c - 34 * s], [x + 100 * s, c - 20 * s], [x + 112 * s, c + 20 * s], [x - 110 * s, c + 30 * s]], 3)], fills: [] }; },
    star: function (S, x, y, s) { var c = y - 50 * s, p = []; for (var i = 0; i <= 10; i++) { var a = -PI / 2 + i * PI / 5, r = (i % 2 ? 20 : 48) * s; p.push([x + Math.cos(a) * r, c + Math.sin(a) * r]); } return { strokes: [K.poly(p, false)], fills: [{ d: K.poly(p, true), kind: "wash", color: "accent" }] }; },
    drop: function (S, x, y, s) { return { strokes: [hand(S, [[x, y - 120 * s], [x - 38 * s, y - 50 * s], [x - 30 * s, y - 14 * s], [x, y], [x + 30 * s, y - 14 * s], [x + 38 * s, y - 50 * s], [x, y - 120 * s]], 2)], fills: [{ d: "M" + f1(x) + " " + f1(y - 120 * s) + "Q" + f1(x - 50 * s) + " " + f1(y - 40 * s) + " " + f1(x) + " " + f1(y) + "Q" + f1(x + 50 * s) + " " + f1(y - 40 * s) + " " + f1(x) + " " + f1(y - 120 * s) + "Z", kind: "wash", color: "wash2" }] }; },
    scale: function (S, x, y, s) { return { strokes: ["M" + f1(x) + " " + f1(y) + "V" + f1(y - 200 * s), hand(S, [[x - 120 * s, y - 180 * s], [x + 120 * s, y - 190 * s]], 2), "M" + f1(x - 120 * s) + " " + f1(y - 180 * s) + "l-30 70h60zM" + f1(x + 120 * s) + " " + f1(y - 190 * s) + "l-30 70h60z", hand(S, [[x - 50 * s, y], [x + 50 * s, y]], 2)], fills: [] }; },
    candle: function (S, x, y, s) { return { strokes: [hand(S, [[x - 22 * s, y], [x - 22 * s, y - 110 * s], [x + 22 * s, y - 110 * s], [x + 22 * s, y]], 2), hand(S, [[x, y - 112 * s], [x - 12 * s, y - 140 * s], [x, y - 168 * s], [x + 12 * s, y - 140 * s], [x, y - 112 * s]], 1.5)], fills: [{ d: "M" + f1(x) + " " + f1(y - 168 * s) + "Q" + f1(x - 16 * s) + " " + f1(y - 136 * s) + " " + f1(x) + " " + f1(y - 112 * s) + "Q" + f1(x + 16 * s) + " " + f1(y - 136 * s) + " " + f1(x) + " " + f1(y - 168 * s) + "Z", kind: "wash", color: "accent" }] }; },
    path: function (S, x, y, s) { return { strokes: [hand(S, [[x - 160 * s, y], [x - 60 * s, y - 60 * s], [x - 110 * s, y - 130 * s], [x - 20 * s, y - 200 * s]], 4), hand(S, [[x + 40 * s, y], [x + 10 * s, y - 60 * s], [x - 50 * s, y - 130 * s], [x, y - 200 * s]], 4)], fills: [] }; },
    bird: function (S, x, y, s) { return { strokes: [hand(S, [[x - 30 * s, y - 10 * s], [x - 14 * s, y - 22 * s], [x, y - 6 * s], [x + 14 * s, y - 22 * s], [x + 30 * s, y - 10 * s]], 1.5)], fills: [] }; },

    // ---- a study room (1.7.0 of 11-12). Straight hand lines for furniture; (x, y) = the base centre; o = the sketch's options ----
    /** a desk: a thick top, a drawer under one end, two legs, a bar between them (≈ 340 × 150 at size 1) */
    desk: function (S, x, y, s) {
      var w = 170 * s, t = y - 150 * s;
      return { strokes: [hp(S, [[x - w, t], [x + w, t]], 2), hp(S, [[x - w + 4 * s, t + 12 * s], [x + w - 4 * s, t + 12 * s]], 2),
        hp(S, [[x - w + 18 * s, t + 12 * s], [x - w + 20 * s, y]], 2), hp(S, [[x + w - 18 * s, t + 12 * s], [x + w - 20 * s, y]], 2),
        hp(S, [[x - w + 20 * s, y - 40 * s], [x + w - 20 * s, y - 40 * s]], 2),
        hp(S, [[x + 30 * s, t + 12 * s], [x + 30 * s, t + 62 * s], [x + w - 18 * s, t + 62 * s]], 2), hp(S, [[x + 82 * s, t + 34 * s], [x + 112 * s, t + 34 * s]], 1)],
        fills: [{ d: K.poly([[x - w, t], [x + w, t], [x + w - 4 * s, t + 12 * s], [x - w + 4 * s, t + 12 * s]], true), kind: "wash" }] };
    },
    /** a chair, side view; o.facing: "left" (default: the sitter looks left, the back is on the right) | "right" */
    chair: function (S, x, y, s, o) {
      var f = o && o.facing === "right" ? -1 : 1, seat = y - 92 * s;
      return { strokes: [hp(S, [[x - 52 * s * f, seat], [x + 52 * s * f, seat]], 2), hp(S, [[x + 50 * s * f, seat], [x + 56 * s * f, seat - 128 * s]], 2),
        hp(S, [[x - 46 * s * f, seat], [x - 48 * s * f, y]], 2), hp(S, [[x + 48 * s * f, seat], [x + 50 * s * f, y]], 2),
        hp(S, [[x - 46 * s * f, y - 34 * s], [x + 48 * s * f, y - 34 * s]], 1.5)],
        fills: [{ d: K.poly([[x + 50 * s * f, seat], [x + 56 * s * f, seat - 128 * s], [x + 44 * s * f, seat - 128 * s], [x + 40 * s * f, seat]], true), kind: "hatch" }] };
    },
    /** a stool: a round seat seen a little from above, three legs, a ring */
    stool: function (S, x, y, s) {
      var t = y - 120 * s;
      return { strokes: [hand(S, circlePts(x, t, 58 * s, 14 * s, 14, PI, 1.02), 1.5, false), hp(S, [[x - 50 * s, t + 8 * s], [x - 62 * s, y]], 2),
        hp(S, [[x, t + 14 * s], [x + 2 * s, y - 6 * s]], 2), hp(S, [[x + 50 * s, t + 8 * s], [x + 62 * s, y]], 2), hp(S, [[x - 56 * s, y - 48 * s], [x + 56 * s, y - 48 * s]], 1.5)],
        fills: [{ d: K.ellipse(x, t, 58 * s, 14 * s, 0), kind: "wash" }] };
    },
    /** a wall calendar: two rings, a coloured band, a grid of days (≈ 124 × 140) */
    calendar: function (S, x, y, s) {
      var w = 62 * s, h = 140 * s, t = y - h, strokes = [hp(S, [[x - w, t], [x + w, t], [x + w, y], [x - w, y]], 2, true), hp(S, [[x - w, t + 32 * s], [x + w, t + 32 * s]], 1.5),
        K.ellipse(x - 30 * s, t - 6 * s, 7 * s, 7 * s, 0), K.ellipse(x + 30 * s, t - 6 * s, 7 * s, 7 * s, 0)];
      for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) { var bx = x - 42 * s + c * 32 * s, by = t + 46 * s + r * 30 * s; strokes.push(hp(S, [[bx, by], [bx + 20 * s, by], [bx + 20 * s, by + 18 * s], [bx, by + 18 * s]], 1, true)); }
      return { strokes: strokes, fills: [{ d: K.poly([[x - w, t], [x + w, t], [x + w, t + 32 * s], [x - w, t + 32 * s]], true), kind: "wash", color: "accent" }] };
    },
    /** a sheet of paper, a little turned, a folded corner (≈ 350 × 440); fill it with S.writing() */
    sheet: function (S, x, y, s) {
      var w = 175 * s, h = 440 * s, t = y - h, k = 0.035;
      function q(px, py) { return [x + (px - x) - (py - (y - h / 2)) * k, py + (px - x) * k]; }
      var a = q(x - w, t + 40 * s), b = q(x - w + 40 * s, t), c = q(x + w, t), d = q(x + w, y), e = q(x - w, y);
      return { strokes: [hp(S, [b, c, d, e, a, b], 2), hp(S, [a, q(x - w + 40 * s, t + 40 * s), b], 1.5)], fills: [{ d: K.poly([a, q(x - w + 40 * s, t + 40 * s), b], true), kind: "hatch" }] };
    },
    /** a closed notebook: a cover, the spine on the right (it opens the Arabic way), stitches, a label */
    notebook: function (S, x, y, s) {
      var w = 130 * s, h = 340 * s, t = y - h, strokes = [hp(S, [[x - w, t], [x + w, t], [x + w, y], [x - w, y]], 2, true), hp(S, [[x + w - 34 * s, t], [x + w - 34 * s, y]], 1.5),
        hp(S, [[x - 70 * s, t + 80 * s], [x + 50 * s, t + 80 * s], [x + 50 * s, t + 140 * s], [x - 70 * s, t + 140 * s]], 1.5, true)];
      for (var i = 0; i < 6; i++) { var sy = t + 34 * s + i * 54 * s; strokes.push(hp(S, [[x + w - 26 * s, sy], [x + w - 8 * s, sy]], 1)); }
      return { strokes: strokes, fills: [{ d: K.poly([[x - w, t], [x + w - 34 * s, t], [x + w - 34 * s, y], [x - w, y]], true), kind: "wash", color: "wash2" }] };
    },
    /** a speech bubble with a tail; o.dotted: true = a thought bubble drawn in dots, with two small circles; o.tail:
        "left" (default) | "right". Its middle is about 150 × size above (x, y). */
    bubble: function (S, x, y, s, o) {
      o = o || {};
      var cx = x, cy = y - 150 * s, rx = 190 * s, ry = 110 * s, f = o.tail === "right" ? 1 : -1, pts = [];
      for (var i = 0; i <= 14; i++) { var a = -PI / 2 + i / 14 * PI * 2, bump = o.dotted ? 1 + 0.07 * Math.sin(i * 3.1) : 1; pts.push([cx + Math.cos(a) * rx * bump, cy + Math.sin(a) * ry * bump]); }
      var body = K.smooth(pts, false, 0.5);
      if (o.dotted) {
        var gap = o.gap || 16 * Math.max(0.6, s);
        return { strokes: [{ d: body, dotted: gap }, { d: K.ellipse(cx + f * rx * 0.62, cy + ry + 34 * s, 16 * s, 16 * s, 0), dotted: gap * 0.8 },
          { d: K.ellipse(cx + f * rx * 0.86, cy + ry + 74 * s, 9 * s, 9 * s, 0), dotted: gap * 0.7 }], fills: [] };
      }
      var tail = hand(S, [[cx + f * rx * 0.3, cy + ry * 0.92], [cx + f * rx * 0.62, cy + ry + 60 * s], [cx + f * rx * 0.62, cy + ry * 0.7]], 1.5);
      return { strokes: [hand(S, pts, 3, false), tail], fills: [{ d: K.ellipse(cx, cy, rx, ry, 0), kind: "wash", color: "wash2" }] };
    },
    /** «again»: a round arrow that comes back to its start (re-reading, a habit, a loop) */
    again: function (S, x, y, s) {
      var cx = x, cy = y - 110 * s, r = 96 * s, p = [];
      for (var k = 0; k <= 18; k++) { var a = -2.2 + k / 18 * 5.0; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
      var a2 = 2.8, ex = cx + Math.cos(a2) * r, ey = cy + Math.sin(a2) * r;
      return { strokes: [hand(S, p, 2, false), hp(S, [[ex - 26 * s, ey - 22 * s], [ex, ey], [ex + 30 * s, ey - 16 * s]], 1.5)], fills: [] };
    }
  };

  /** a drawing from Khaam.drawings, stroke by stroke. {name, x, y, size, at, dur, color, width, pencil, fill: true|false,
      fillAt, fillColor, layer, parent, still: true (drawn finished on frame 0)} + the drawing's own options (bubble: dotted,
      tail; chair: facing). A stroke can be {d, dotted: gap} (drawn dot by dot). */
  K.piece("sketch", function (S, o) {
    var fn = typeof o.name === "function" ? o.name : K.drawings[o.name];
    if (!fn) throw new Error("Khaam paper: no drawing named " + o.name);
    var g = el("g", null, o.parent || S.L(o.layer || "near")), D = fn(S, o.x === undefined ? 540 : o.x, o.y === undefined ? 1400 : o.y, o.size || 1, o);
    var at = o.at || 0, dur = o.dur === undefined ? 1.2 : o.dur, n = D.strokes.length, each = dur / n, out = { g: g, strokes: [], fills: [] };
    var fillG = el("g", null, g), lineG = el("g", null, g);
    if (o.fill !== false) D.fills.forEach(function (F) { out.fills.push(S.fill({ parent: fillG, d: F.d, kind: F.kind, color: o.fillColor || F.color, at: o.fillAt === undefined ? at + dur * 0.85 : o.fillAt, dur: 0.6, still: o.still })); });
    D.strokes.forEach(function (d, i) {
      var sd = typeof d === "string" ? { d: d } : d;
      out.strokes.push(S.ink({ parent: lineG, d: sd.d, dotted: sd.dotted, at: at + i * each, dur: each * 1.1, color: o.color, width: sd.width || o.width, pencil: o.pencil, still: o.still }));
    });
    return out;
  });

  /**
   * A big open book, front view, with lines of text on both pages (≈ 2w × h). Its pages can turn (re-reading) and it can
   * shut: the right half swings over the spine and shows the cover. {x (the spine), y (the pages' bottom), w: 200 (one
   * page), h: 270, cover: "ink" (role), lines: true, turn: [t…], shut: {at, dur: 0.26}, at (it appears; leave it out
   * to have it from frame 0), layer, parent} → {g, left, right, cover}
   */
  K.piece("book", function (S, o) {
    var BX = o.x === undefined ? 420 : o.x, BY = o.y === undefined ? 1196 : o.y, BW = o.w || 200, BH = o.h || 270, cov = o.cover || "ink";
    var g = el("g", null, o.parent || S.L(o.layer || "near")), page = { role: "paper", mix: "#ffffff", k: 0.6 };
    function solid(d, fill, parent, w) { var p = el("path", { d: d, "stroke-width": w || 4, "stroke-linejoin": "round" }, parent); S.paint(p, "fill", fill); S.paint(p, "stroke", "ink"); return p; }
    function pageL(side) { return K.poly([[BX, BY], [BX + side * BW, BY - 8], [BX + side * BW, BY - BH], [BX, BY - BH + 10]], true); }
    function coverP(side) { return K.poly([[BX, BY + 12], [BX + side * (BW + 10), BY + 12], [BX + side * (BW + 10), BY - BH - 8], [BX, BY - BH - 8]], true); }
    function text(side, parent) {
      if (o.lines === false) return;
      var widths = [150, 130, 160, 120, 150, 100];
      for (var k = 0; k < 6; k++) S.writing(side > 0 ? BX + BW - 22 : BX - 22, BY - BH + 44 + k * 36, [widths[(k + (side > 0 ? 2 : 0)) % 6] * BW / 200], { still: true, color: "ink", width: 3, parent: parent });
    }
    solid(coverP(-1), cov, g, 3); solid(pageL(-1), page, g); text(-1, g);
    var halfR = el("g", null, g), front = el("g", null, halfR), back = el("g", null, halfR);
    solid(coverP(1), cov, front, 3); solid(pageL(1), page, front); text(1, front);
    solid(coverP(1), cov, back, 3);
    var lab = solid(K.poly([[BX + BW * 0.25, BY - BH * 0.63], [BX + BW * 0.75, BY - BH * 0.63], [BX + BW * 0.75, BY - BH * 0.44], [BX + BW * 0.25, BY - BH * 0.44]], true), "wash", back, 3);
    back.style.opacity = 0;
    var flipW = el("g", null, g), flip = el("g", null, flipW); solid(pageL(1), page, flip); flipW.style.opacity = 0;
    (o.turn || []).forEach(function (t0) {   // a page turns over the spine (it is hidden again once it lies on the left)
      S.tl.set(flipW, { opacity: 1 }, t0);
      S.svgMove(flip, t0, 0.42, { sx: 1, sy: 1 }, { sx: -1, sy: 1 }, "power2.inOut", [BX, BY - BH / 2]);
      S.tl.set(flipW, { opacity: 0 }, t0 + 0.43);
    });
    if (o.shut) {
      var ts = o.shut.at || 0, sd = o.shut.dur || 0.26;
      S.svgMove(halfR, ts, sd, { sx: 1, sy: 1 }, { sx: -1, sy: 1 }, o.shut.ease || "power3.in", [BX, BY]);
      S.tl.set(front, { opacity: 0 }, ts + sd / 2); S.tl.set(back, { opacity: 1 }, ts + sd / 2);
    }
    if (o.at !== undefined) { g.style.opacity = 0; S.tl.fromTo(g, { opacity: 0 }, { opacity: 1, duration: o.dur || 0.3, ease: "power1.out", immediateRender: false }, o.at); }
    return { g: g, right: halfR, cover: back, label: lab };
  });

  /**
   * Lines of handwriting, right to left (Arabic), drawn one after another or already written.
   * S.writing(x1, y0, lines, {gap: 38, at, each: 0.12, still, pencil, color, width: 3.2, parent, layer})
   * x1 = where each line starts (its right end); lines = a count or a list of widths in px. → the paths
   */
  K.Stage.prototype.writing = function (x1, y0, lines, o) {
    if (typeof x1 === "object") { o = x1; x1 = o.x1; y0 = o.y0; lines = o.lines; }
    o = o || {};
    var S = this, list = typeof lines === "number" ? [] : lines.slice(), out = [], gap = o.gap || 38, each = o.each || 0.12;
    if (typeof lines === "number") for (var i = 0; i < lines; i++) list.push([260, 220, 280, 200, 250, 230, 270, 160][i % 8]);
    list.forEach(function (w, k) {
      var y = y0 + k * gap, pts = [];
      for (var x = x1; x >= x1 - w; x -= 14) pts.push([x, y + ((Math.round(x / 14) + k) % 2 ? -4 : 4)]);
      if (pts.length < 2) pts.push([x1 - w, y]);
      out.push(S.ink({ d: K.smooth(pts, false, 0.5), at: (o.at || 0) + k * each, dur: each * 1.1, width: o.width || 3.2, pencil: o.pencil, color: o.color,
                       still: o.still, parent: o.parent, layer: o.layer }));
    });
    return out;
  };

  /** a hand mark around or under something. kind: circle | underline | check | cross | arrow. {x, y, w, h, at, dur, color} */
  K.piece("mark", function (S, o) {
    var x = o.x || 540, y = o.y || 900, w = o.w || 300, h = o.h || 200, d;
    if (o.kind === "underline") d = hand(S, [[x - w / 2, y], [x - w / 6, y + 4], [x + w / 6, y - 2], [x + w / 2, y + 3]], 3);
    else if (o.kind === "check") d = hand(S, [[x - w / 2, y - h * 0.1], [x - w / 6, y + h / 2], [x + w / 2, y - h / 2]], 3);
    else if (o.kind === "cross") d = "M" + f1(x - w / 2) + " " + f1(y - h / 2) + "L" + f1(x + w / 2) + " " + f1(y + h / 2) + "M" + f1(x + w / 2) + " " + f1(y - h / 2) + "L" + f1(x - w / 2) + " " + f1(y + h / 2);
    else if (o.kind === "arrow") d = hand(S, [[x - w / 2, y + h / 2], [x - w / 6, y - h / 6], [x + w / 2, y - h / 2]], 3) + "M" + f1(x + w / 2 - 34) + " " + f1(y - h / 2 - 4) + "L" + f1(x + w / 2) + " " + f1(y - h / 2) + "L" + f1(x + w / 2 - 12) + " " + f1(y - h / 2 + 30);
    else d = hand(S, circlePts(x, y, w / 2, h / 2, 16, -PI * 0.6, 1.08), 6, false);
    return S.ink({ d: d, at: o.at, dur: o.dur || 0.6, color: o.color || "accent", width: o.width || 5, layer: o.layer });
  });
})(window.Khaam);
