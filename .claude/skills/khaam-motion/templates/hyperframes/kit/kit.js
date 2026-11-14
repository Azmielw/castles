/*
  «موشن خام» scene kit, core (kit.js). Load order in index.html: kit.js, scene.js, figure.js, paper.js.
  Code-drawn, flat layered vector, ours. Nothing here is copied from anyone's video.

  What lives here:
    Khaam.palettes / Khaam.palette(name, overrides)  the colours, by role (sky0, far, ground, warm …)
    Khaam.stage(svg, opts)                            a world made of depth layers, recoloured by role
    stage.<piece>(opts)                               every piece in scene.js / figure.js / paper.js
    stage.relight(palette, {at, dur})                 night → dawn: every role tweens to the new palette
    stage.timelapse({at, dur, stay, …})               a day in under a second (two relights, sun, stars, moon, shadows)
    camera: stage.push / pan / track / dive / rise / drop / dip / shake, Khaam.crossfade(tl, a, b, at, dur)
            stage.cameraReport() (the camera timeline, for the pace check), stage.toScreen(layer, x, y, t)
    stage.plate({cx, cy, rx, ry, alpha, show, hide})  a soft plate under text that sits over motion
    stage.svgMove(g, at, dur, from, to, ease, origin) / Khaam.svgMove(…)   move, scale, turn, fade a group, safely
    Khaam.places(tl, host, defaults)                  a video told in places: place, show, cut, whip, fade
    Khaam.card({show, hide, box})                      a verified card on screen: no place change or star under it

  Rules the kit keeps (so a buyer's Claude can trust it):
    - Everything that moves is a tween on the stage timeline (paused GSAP). No requestAnimationFrame, no Date,
      no Math.random: every scene renders the same frame at the same time, every time (seeded random only).
    - GSAP moves only wrapper groups that have NO transform attribute. Positions live on an inner group.
      (A GSAP svgOrigin on a group that already has a translate sends it flying.)
    - Never put svgOrigin together with a scale in a fromTo's start values (GSAP shifts the group sideways for the
      rest of the video); use Khaam.svgMove / stage.svgMove, which writes the whole transform itself every frame.
    - To recolour a painted element, paint it again (stage.paint) or relight: an attribute set later loses to the
      painted style.
    - Moves are absolute (fromTo with known values), never "+=": a relative tween reads its start on its first
      render, and render workers that start mid-video can read a different start. The camera keeps its offsets in JS.
    - Repeats are finite (computed from the stage duration), never repeat: -1.
*/
(function (root) {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  var K = root.Khaam = root.Khaam || {};
  K.version = "1.7.0";

  // ---------- small helpers ----------
  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  K.el = el;
  K.NS = NS;
  /** find an element by selector. HyperFrames moves a composition root's id to data-hf-authored-id (only the
      composition's own script sees it under its id), so "#id" falls back to that attribute. Passing the element works too. */
  K.$ = function (sel) {
    if (typeof sel !== "string") return sel;
    var e = document.querySelector(sel), m = /^#([\w-]+)$/.exec(sel);
    if (!e && m) e = document.querySelector('[data-hf-authored-id="' + m[1] + '"]');
    if (!e) throw new Error("Khaam: nothing matches " + sel + " (pass the element itself: document.getElementById(…) in the composition's script)");
    return e;
  };

  function hex2rgb(h) {
    h = String(h).replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgb2hex(r, g, b) {
    function c(v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? "0" : "") + v.toString(16); }
    return "#" + c(r) + c(g) + c(b);
  }
  /** mix colour a toward b by t (0..1) */
  K.mix = function (a, b, t) {
    var A = hex2rgb(a), B = hex2rgb(b);
    return rgb2hex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
  };
  /** k < 0 darker (toward black), k > 0 lighter (toward white) */
  K.shade = function (c, k) { return k < 0 ? K.mix(c, "#000000", -k) : K.mix(c, "#ffffff", k); };
  /** multiply two colours (light falling on a surface) */
  K.multiply = function (a, b) {
    var A = hex2rgb(a), B = hex2rgb(b);
    return rgb2hex(A[0] * B[0] / 255, A[1] * B[1] / 255, A[2] * B[2] / 255);
  };

  /** seeded random: same seed, same scene, every render */
  K.rng = function (seed) {
    var s = (Math.abs(Math.floor(seed || 1)) % 4294967295) || 1;
    return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  };

  function f1(v) { return (Math.round(v * 10) / 10).toString(); }
  K.f1 = f1;

  /** Catmull-Rom → cubic Bézier. Same number of points in, same path structure out (so GSAP can morph it). */
  K.smooth = function (pts, closed, tension) {
    var t = tension === undefined ? 0.5 : tension, n = pts.length, d, i;
    function P(i) { return closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]; }
    d = "M" + f1(pts[0][0]) + " " + f1(pts[0][1]);
    var segs = closed ? n : n - 1;
    for (i = 0; i < segs; i++) {
      var p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      var c1x = p1[0] + (p2[0] - p0[0]) * t / 3, c1y = p1[1] + (p2[1] - p0[1]) * t / 3;
      var c2x = p2[0] - (p3[0] - p1[0]) * t / 3, c2y = p2[1] - (p3[1] - p1[1]) * t / 3;
      d += "C" + f1(c1x) + " " + f1(c1y) + " " + f1(c2x) + " " + f1(c2y) + " " + f1(p2[0]) + " " + f1(p2[1]);
    }
    return closed ? d + "Z" : d;
  };
  /** straight polyline, fixed structure */
  K.poly = function (pts, closed) {
    var d = "";
    for (var i = 0; i < pts.length; i++) d += (i ? "L" : "M") + f1(pts[i][0]) + " " + f1(pts[i][1]);
    return closed ? d + "Z" : d;
  };
  /** an ellipse as four cubic segments (fixed structure), rotated by rot degrees */
  K.ellipse = function (cx, cy, rx, ry, rot) {
    var k = 0.5523, a = (rot || 0) * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
    function p(x, y) { return f1(cx + x * ca - y * sa) + " " + f1(cy + x * sa + y * ca); }
    return "M" + p(rx, 0) +
      "C" + p(rx, ry * k) + " " + p(rx * k, ry) + " " + p(0, ry) +
      "C" + p(-rx * k, ry) + " " + p(-rx, ry * k) + " " + p(-rx, 0) +
      "C" + p(-rx, -ry * k) + " " + p(-rx * k, -ry) + " " + p(0, -ry) +
      "C" + p(rx * k, -ry) + " " + p(rx, -ry * k) + " " + p(rx, 0) + "Z";
  };

  // ---------- palettes (colour by role) ----------
  // Every piece paints by role. A style recolours the whole world by overriding roles: Khaam.palette("night", {warm: "#ffd08a"}).
  // Levels (0..1) say how much of a light is on: stars, moon, sun, glow, windows, lamp, rim, path.
  K.palettes = {
    night: {
      sky0: "#050915", sky1: "#0a1330", sky2: "#17224a", sky3: "#28325c", glow: "#3a4677",
      star: "#f3f0ff", moon: "#f1e8cf", moonGlow: "#93a6dc", sun: "#fff1cf", sunGlow: "#ffc77d",
      cloud: "#151d39", cloudShade: "#0d1329", cloudLit: "#34406e",
      haze: "#2a3561", far: "#1d2648", mid: "#141c38", near: "#0e152b", ground: "#0d1325", groundTop: "#1c2444",
      duneLit: "#2a3156", duneShade: "#141a35", rim: "#8e9fd8",
      water: "#121c3a", waterDeep: "#060b1c", ripple: "#33427a", path: "#efe6c8",
      foliage: "#0b1426", foliageLit: "#1a2643", trunk: "#121a2e",
      wall: "#232c4c", wallShade: "#181f3a", wallLit: "#2e3860", roof: "#1b2240", window: "#0f1530", windowLit: "#ffc976",
      floor: "#1a1d33", floorShade: "#10131f", rug: "#5a2e3a", rug2: "#b98a4e", fabric: "#3b3f63", wood: "#3a2c2a",
      warm: "#ffb35a", warmGlow: "#ff8f3a", rain: "#a8b8e2", ink: "#04060d",
      ambient: "#28325e", ambientK: 0.42, light: "#c9d4ff",
      stars: 1, moonLevel: 1, sunLevel: 0, glowLevel: 0.35, windows: 1, lamp: 1, rimLevel: 0.35, pathLevel: 0.85
    },
    dusk: {
      sky0: "#16173a", sky1: "#3d2f63", sky2: "#a0567a", sky3: "#ec9a6c", glow: "#ffbf80",
      star: "#fbf2ff", moon: "#f6e9d4", moonGlow: "#e9b3b8", sun: "#ffe0b0", sunGlow: "#ff9a5c",
      cloud: "#5c3d63", cloudShade: "#3d2a4c", cloudLit: "#ff9f7c",
      haze: "#b4687c", far: "#7d4a6c", mid: "#55375a", near: "#3a2846", ground: "#2c2036", groundTop: "#5a3a52",
      duneLit: "#c27a6c", duneShade: "#4e3150", rim: "#ffb27c",
      water: "#4a3560", waterDeep: "#221a38", ripple: "#a7637e", path: "#ffd3a0",
      foliage: "#26182e", foliageLit: "#46304a", trunk: "#2c1e30",
      wall: "#8a5a68", wallShade: "#5b3c52", wallLit: "#c98a7c", roof: "#4c3048", window: "#3b2640", windowLit: "#ffcf86",
      floor: "#4a3034", floorShade: "#2c1d24", rug: "#7a2f3a", rug2: "#d8a25a", fabric: "#6a4a62", wood: "#5a3a30",
      warm: "#ffbd68", warmGlow: "#ff8c48", rain: "#d9b8d2", ink: "#1a0f1e",
      ambient: "#9a5a72", ambientK: 0.3, light: "#ffc79a",
      stars: 0.35, moonLevel: 0.6, sunLevel: 0.8, glowLevel: 0.8, windows: 0.75, lamp: 1, rimLevel: 0.75, pathLevel: 0.75
    },
    dawn: {
      sky0: "#1c2a50", sky1: "#4d4a7c", sky2: "#c48576", sky3: "#f7c78c", glow: "#ffe0a6",
      star: "#ffffff", moon: "#f7efe0", moonGlow: "#d9c6d6", sun: "#fff3d4", sunGlow: "#ffc982",
      cloud: "#6c5878", cloudShade: "#4a3d5e", cloudLit: "#ffc192",
      haze: "#d6a08e", far: "#8f7894", mid: "#5f4f72", near: "#3e3554", ground: "#30293f", groundTop: "#6a5262",
      duneLit: "#e2a882", duneShade: "#6a5274", rim: "#ffd7a0",
      water: "#4e4f7c", waterDeep: "#262a4e", ripple: "#a993ac", path: "#ffe6b8",
      foliage: "#2a2338", foliageLit: "#5a4656", trunk: "#30263a",
      wall: "#a07a80", wallShade: "#6a5068", wallLit: "#e6b496", roof: "#5e4a62", window: "#4a3a52", windowLit: "#ffd896",
      floor: "#5e4a4c", floorShade: "#3a2c34", rug: "#8a3a40", rug2: "#e0b06a", fabric: "#7a6078", wood: "#6a4a3a",
      warm: "#ffc878", warmGlow: "#ffa255", rain: "#e6d2dc", ink: "#1c1424",
      ambient: "#e3a58a", ambientK: 0.2, light: "#ffd9a8",
      stars: 0, moonLevel: 0.25, sunLevel: 1, glowLevel: 1, windows: 0.25, lamp: 0.6, rimLevel: 1, pathLevel: 1
    },
    day: {
      sky0: "#4f86c2", sky1: "#79a9d6", sky2: "#a9cbe4", sky3: "#e3ecdf", glow: "#fffbe6",
      star: "#ffffff", moon: "#ffffff", moonGlow: "#ffffff", sun: "#fffdf2", sunGlow: "#fff2c2",
      cloud: "#fbfcfd", cloudShade: "#d6e2ee", cloudLit: "#ffffff",
      haze: "#d9e6ea", far: "#a5bccb", mid: "#c9b58d", near: "#d6b47a", ground: "#d8b67f", groundTop: "#e6cfa0",
      duneLit: "#ecc98c", duneShade: "#c2955f", rim: "#fff6dc",
      water: "#5f97c4", waterDeep: "#2f6496", ripple: "#a9cde6", path: "#ffffff",
      foliage: "#5a8a4a", foliageLit: "#86b064", trunk: "#7a5a3c",
      wall: "#e8d6b4", wallShade: "#c8ae86", wallLit: "#f5e8cc", roof: "#b88a5a", window: "#5a4636", windowLit: "#ffe2a0",
      floor: "#c9a77c", floorShade: "#a6845c", rug: "#a8423f", rug2: "#e8c070", fabric: "#8a6a4e", wood: "#8a5a3a",
      warm: "#ffd27a", warmGlow: "#ffb04a", rain: "#cfdbe8", ink: "#2a2420",
      ambient: "#ffffff", ambientK: 0.0, light: "#fffaf0",
      stars: 0, moonLevel: 0, sunLevel: 1, glowLevel: 0.6, windows: 0, lamp: 0.35, rimLevel: 0.4, pathLevel: 0.8
    },
    storm: {
      sky0: "#07090f", sky1: "#0f1424", sky2: "#1c2236", sky3: "#2a3046", glow: "#3a4258",
      star: "#e8eaf6", moon: "#dcdcd4", moonGlow: "#7c88a8", sun: "#e8e6dc", sunGlow: "#a8b0c8",
      cloud: "#1a1f30", cloudShade: "#10131f", cloudLit: "#3a4462",
      haze: "#2a3044", far: "#1e2336", mid: "#161a2a", near: "#10131f", ground: "#0e111b", groundTop: "#1e2232",
      duneLit: "#2a2f44", duneShade: "#15182a", rim: "#8c96b8",
      water: "#141a2c", waterDeep: "#080b14", ripple: "#343e5a", path: "#c8cce0",
      foliage: "#0c111c", foliageLit: "#1a2232", trunk: "#121624",
      wall: "#22283a", wallShade: "#171b2a", wallLit: "#2c3348", roof: "#1a1e2e", window: "#0e111c", windowLit: "#ffc070",
      floor: "#1a1c28", floorShade: "#0f1018", rug: "#4a2a32", rug2: "#9a7a4a", fabric: "#34384e", wood: "#33282a",
      warm: "#ffaa50", warmGlow: "#ff8a30", rain: "#9eabca", ink: "#03040a",
      ambient: "#262c44", ambientK: 0.48, light: "#c4ccec",
      stars: 0.1, moonLevel: 0.3, sunLevel: 0, glowLevel: 0.2, windows: 1, lamp: 1, rimLevel: 0.25, pathLevel: 0.4
    },
    paper: {
      paper: "#efe7d4", paperEdge: "#ded2b6", fibre: "#c9b994", rule: "#9db2c6", margin: "#c97b72",
      ink: "#2a2a35", pencil: "#7a7680", accent: "#c4862e", wash: "#d9c49c", wash2: "#b9c6c2", hatch: "#2a2a35",
      sky0: "#efe7d4", sky1: "#efe7d4", sky2: "#efe7d4", sky3: "#efe7d4", glow: "#f6e6b8",
      ambient: "#efe7d4", ambientK: 0, light: "#ffffff", warm: "#e8a94a", warmGlow: "#f3c26a",
      stars: 0, moonLevel: 0, sunLevel: 0, glowLevel: 0, windows: 0, lamp: 0.6, rimLevel: 0, pathLevel: 0
    }
  };
  /** a copy of a palette with some roles replaced (a style's recolour) */
  K.palette = function (name, overrides) {
    var base = typeof name === "string" ? K.palettes[name] : name, out = {}, k;
    if (!base) throw new Error("Khaam: no palette named " + name);
    for (k in base) out[k] = base[k];
    if (overrides) for (k in overrides) out[k] = overrides[k];
    return out;
  };

  /** a palette part of the way from a to b (t = 0..1): "dusk going to night" without going all the way */
  K.between = function (a, b, t) {
    var A = K.palette(a), B = K.palette(b), out = {}, k;
    for (k in A) {
      if (typeof A[k] === "number" && typeof B[k] === "number") out[k] = A[k] + (B[k] - A[k]) * t;
      else if (typeof A[k] === "string" && A[k].charAt(0) === "#" && typeof B[k] === "string") out[k] = K.mix(A[k], B[k], t);
      else out[k] = A[k];
    }
    return out;
  };

  // ---------- the stage ----------
  // Default depth layers, back to front. depth: 0 = at infinity (sky), 1 = at the lens. "fixed" layers ignore the camera.
  var LAYERS = [
    ["sky", 0], ["far", 0.1], ["mid", 0.28], ["near", 0.5], ["ground", 0.78], ["actors", 0.78], ["front", 1],
    ["under", 0.78], ["light", "fixed"], ["weather", "fixed"], ["film", "fixed"]
  ];

  function Stage(svg, o) {
    if (typeof svg === "string") svg = K.$(svg);
    this.svg = svg;
    this.W = o.width || 1080; this.H = o.height || 1920;
    svg.setAttribute("viewBox", "0 0 " + this.W + " " + this.H);
    this.tl = o.tl;
    this.duration = o.duration || 6;
    this.seed = o.seed || 1;
    this.pal = typeof o.palette === "object" ? K.palette(o.palette) : K.palette(o.palette || "night", o.colors);
    this.horizon = o.horizon || 1240;               // where the land meets the sky
    this.span = o.span || [-180, this.W + 180];      // how wide pieces are drawn (wider for pans and tracks)
    this.light = o.light || { x: this.W * 0.5, y: this.horizon - 80 };  // the one light source (figures use it)
    this.windStrength = o.wind === undefined ? 0.4 : o.wind; // 0 calm … 1 strong (palms, grass, dust)
    this.paints = [];   // colour by role, re-tinted by relight()
    this.levels = [];   // opacity by level, re-set by relight()
    this.hooks = [];    // pieces that react to relight (fire glow, rims…)
    this.figures = [];
    this._uid = 0;
    this._cam = [];     // the camera timeline: every push, pan, track, dive, rise and drop (cameraReport())
    this._pushS = 1;    // where the last push left the camera (scale) and its origin
    this._pushO = null;
    this.defs = el("defs", null, svg);
    // layers are drawn wider than the frame on purpose (the camera moves): tell HyperFrames' layout check so
    this.world = el("g", { "data-kit": "world", "data-layout-allow-overflow": "" }, svg);
    this.layers = {};
    for (var i = 0; i < LAYERS.length; i++) this.layer(LAYERS[i][0], LAYERS[i][1]);
    this.prefix = "k" + (K._stages = (K._stages || 0) + 1) + "-";
    K._lastStage = this;
  }
  K.Stage = Stage;
  K.stage = function (svg, opts) { return new Stage(svg, opts || {}); };

  Stage.prototype.id = function (p) { return this.prefix + (p || "n") + (++this._uid); };
  Stage.prototype.rng = function (salt) { return K.rng(this.seed * 7919 + (salt || 0) * 104729 + this._uid); };

  /**
   * A depth layer: two nested wrapper groups with no transform attribute, then the drawings.
   *   g (outer)  ← push (a scale around a fixed point)
   *   m (inner)  ← pan, track, dive, rise (absolute x/y; the offsets are kept in JS, never "+=")
   * Keeping the two moves apart, and every move absolute, makes each frame the same whatever frame a render
   * worker starts on. (A relative tween reads its start at its first render; with the scale on the same group the
   * value it reads can differ between workers by a fraction of a pixel.)
   */
  Stage.prototype.layer = function (name, depth) {
    if (this.layers[name]) return this.layers[name].m;
    var fixed = depth === "fixed";
    var parent = fixed ? this.svg : this.world;
    var g = el("g", { "data-layer": name, "data-layout-allow-overflow": "" }, parent), m = el("g", null, g);
    this.layers[name] = { name: name, g: g, m: m, depth: fixed ? 0 : depth, fixed: fixed, x: 0, y: 0, moves: [], pushes: [] };
    // fixed layers sit above the world, in creation order
    return m;
  };
  Stage.prototype.L = function (name) { return this.layer(name || "near", 0.5); };
  Stage.prototype.depthOf = function (name) { var l = this.layers[name]; return l ? l.depth : 0.5; };

  // ---------- colour by role ----------
  // spec: "role" | {role, mix: "otherRole" | "#hex", k} | function(pal) → colour
  Stage.prototype.color = function (spec, pal) {
    pal = pal || this.pal;
    if (typeof spec === "function") return spec(pal);
    if (typeof spec === "string") return spec.charAt(0) === "#" ? spec : pal[spec];
    var c = this.color(spec.role, pal);
    if (spec.mix !== undefined) c = K.mix(c, this.color(spec.mix, pal), spec.k === undefined ? 0.5 : spec.k);
    if (spec.shade) c = K.shade(c, spec.shade);
    return c;
  };
  /** paint an element by role. prop: fill | stroke | stop. Relight re-tints it. */
  Stage.prototype.paint = function (e, prop, spec) {
    var c = this.color(spec);
    if (prop === "stop") e.style.stopColor = c; else e.style[prop] = c;
    this.paints.push({ el: e, prop: prop, spec: spec });
    return e;
  };
  /** opacity tied to a palette level (stars, moonLevel, sunLevel, glowLevel, windows, lamp, rimLevel, pathLevel) */
  Stage.prototype.level = function (e, level, base) {
    base = base === undefined ? 1 : base;
    var v = this.pal[level]; if (v === undefined) v = 1;
    e.style.opacity = base * v;
    this.levels.push({ el: e, level: level, base: base });
    return e;
  };
  /** a vertical gradient by roles, stops = [[offset, spec, opacity?], …] → "url(#id)" */
  Stage.prototype.vgrad = function (stops, x1, y1, x2, y2, units) {
    var id = this.id("g");
    var g = el("linearGradient", { id: id, x1: x1 === undefined ? 0 : x1, y1: y1 === undefined ? 0 : y1,
      x2: x2 === undefined ? 0 : x2, y2: y2 === undefined ? 1 : y2, gradientUnits: units }, this.defs);
    for (var i = 0; i < stops.length; i++) {
      var s = el("stop", { offset: stops[i][0] }, g);
      this.paint(s, "stop", stops[i][1]);
      if (stops[i][2] !== undefined) s.style.stopOpacity = stops[i][2];
    }
    return "url(#" + id + ")";
  };
  Stage.prototype.rgrad = function (stops, cx, cy, r, units, fx, fy) {
    var id = this.id("r");
    var g = el("radialGradient", { id: id, cx: cx === undefined ? 0.5 : cx, cy: cy === undefined ? 0.5 : cy,
      r: r === undefined ? 0.5 : r, fx: fx, fy: fy, gradientUnits: units }, this.defs);
    for (var i = 0; i < stops.length; i++) {
      var s = el("stop", { offset: stops[i][0] }, g);
      this.paint(s, "stop", stops[i][1]);
      s.style.stopOpacity = stops[i][2] === undefined ? 1 : stops[i][2];
    }
    return "url(#" + id + ")";
  };
  /** a soft blur filter, reused by size */
  Stage.prototype.blur = function (sd) {
    this._blurs = this._blurs || {};
    if (this._blurs[sd]) return this._blurs[sd];
    var id = this.id("b");
    var f = el("filter", { id: id, x: "-50%", y: "-50%", width: "200%", height: "200%" }, this.defs);
    el("feGaussianBlur", { stdDeviation: sd }, f);
    return (this._blurs[sd] = "url(#" + id + ")");
  };

  /**
   * Relight: tween every painted role and every level to another palette.
   * stage.relight("dawn", {at: 3.2, dur: 2.4}). Pieces with hooks (fire, rims, figures) follow.
   */
  Stage.prototype.relight = function (to, o) {
    o = o || {};
    var tl = this.tl, at = o.at || 0, dur = o.dur === undefined ? 2 : o.dur, ease = o.ease || "power1.inOut";
    var from = this.pal, next = typeof to === "string" ? K.palette(to, o.colors) : to, i;
    var byColor = {};
    for (i = 0; i < this.paints.length; i++) {
      var p = this.paints[i], c = this.color(p.spec, next), key = p.prop + c;
      (byColor[key] = byColor[key] || { prop: p.prop, c: c, els: [] }).els.push(p.el);
    }
    for (var k in byColor) {
      var b = byColor[k], vars = { duration: dur, ease: ease };
      vars[b.prop === "stop" ? "stopColor" : b.prop] = b.c;
      tl.to(b.els, vars, at);
    }
    for (i = 0; i < this.levels.length; i++) {
      var L = this.levels[i], v = next[L.level]; if (v === undefined) v = 1;
      tl.to(L.el, { opacity: L.base * v, duration: dur, ease: ease }, at);
    }
    for (i = 0; i < this.hooks.length; i++) this.hooks[i](from, next, at, dur, ease);
    this.pal = next;   // pieces added after this call are drawn in the new palette
    return this;
  };
  Stage.prototype.onRelight = function (fn) { this.hooks.push(fn); };

  /**
   * A sine wave on one numeric property, as a chain of finite tweens over [t0, t1] (default: the whole stage).
   * value(t) = mid + amp · sin(2π((t − t0)/period + phase)). Phase lets many items move out of step.
   * Use it for sway, flicker, bob, shimmer. opts: {svgOrigin, transformOrigin} pass through.
   */
  Stage.prototype.wave = function (target, prop, mid, amp, period, phase, t0, t1, extra) {
    var tl = this.tl; t0 = t0 || 0; t1 = t1 === undefined ? this.duration : t1;
    phase = (((phase || 0) % 1) + 1) % 1;
    function val(t) { return mid + amp * Math.sin(2 * Math.PI * ((t - t0) / period + phase)); }
    function vars(v, d, e) {
      var o = { duration: d, ease: e }; o[prop] = v;
      if (extra) for (var k in extra) o[k] = extra[k];
      return o;
    }
    var s = vars(val(t0), 0, "none"); delete s.duration; delete s.ease;
    if (t0 === 0) gsap.set(target, s);
    tl.set(target, s, t0);
    var x = (((0.25 - phase) % 0.5) + 0.5) % 0.5, t = t0 + x * period;
    if (t - t0 > 0.004) tl.to(target, vars(val(t), t - t0, "sine.out"), t0);
    while (t < t1 - 0.004) {
      var tn = t + period / 2;
      if (tn > t1) { tl.to(target, vars(val(t1), t1 - t, "sine.in"), t); break; }
      tl.to(target, vars(val(tn), period / 2, "sine.inOut"), t);
      t = tn;
    }
  };

  // ---------- pieces registry ----------
  K.pieces = K.pieces || {};
  /** register a piece: Khaam.piece("name", function (stage, opts) {...}) → stage.name(opts) */
  K.piece = function (name, fn) {
    K.pieces[name] = fn;
    Stage.prototype[name] = function (opts) { return fn(this, opts || {}); };
  };
  Stage.prototype.add = function (name, opts) {
    if (!K.pieces[name]) throw new Error("Khaam: no piece named " + name);
    return K.pieces[name](this, opts || {});
  };
  /** build a scene from a list: stage.build([["sky"], ["stars", {count: 80}], …]) */
  Stage.prototype.build = function (list) {
    var out = [];
    for (var i = 0; i < list.length; i++) out.push(this.add(list[i][0], list[i][1]));
    return out;
  };
  /** an inner positioned group inside a layer (GSAP never moves this one) */
  Stage.prototype.group = function (layer, x, y, s, parent) {
    var wrap = el("g", null, parent || this.L(layer));
    var inner = el("g", { transform: "translate(" + f1(x || 0) + " " + f1(y || 0) + ")" + (s && s !== 1 ? " scale(" + s + ")" : "") }, wrap);
    return { wrap: wrap, g: inner };
  };

  // ---------- camera ----------
  // Every world layer moves by its depth: far layers move less, near layers more. That is the depth between layers.
  Stage.prototype._worldLayers = function (skip) {
    var out = [];
    for (var n in this.layers) {
      var L = this.layers[n];
      if (L.fixed || (skip && skip.indexOf(n) >= 0)) continue;
      out.push(L);
    }
    return out;
  };
  /**
   * push in (or out, to < 1): {to: 1.08, from: 1, at, dur, ease, origin: [x, y], skip}
   * The scale is written as scale + x/y about a fixed svg origin (0 0), so pushes chain without a jump: when a push
   * starts at the scale the last one ended on (from = the last to) and names another origin, the camera glides to the
   * new origin instead of jumping (GSAP's own svgOrigin jumped by (scale − 1) × the origin change). origin defaults to
   * the last push's origin. Readable push: 2.5–4 %/s (1 %/s is the least that shows).
   */
  Stage.prototype.push = function (o) {
    o = o || {};
    var from = o.from === undefined ? 1 : o.from, to = o.to === undefined ? 1.08 : o.to;
    var org = o.origin || this._pushO || [this.W / 2, this.horizon + 120];
    var Ls = this._worldLayers(o.skip), at = o.at || 0, dur = o.dur === undefined ? this.duration : o.dur, ease = o.ease || "sine.inOut";
    var cont = Math.abs(from - this._pushS) < 1e-6;   // it starts where the camera is: keep the current framing
    for (var i = 0; i < Ls.length; i++) {
      var L = Ls[i], d = 0.15 + 0.85 * L.depth;   // even the sky moves a hair
      var s0 = 1 + (from - 1) * d, s1 = 1 + (to - 1) * d, first = !L.pushes.length;
      if (first) gsap.set(L.g, { svgOrigin: "0 0" });   // once, on an untransformed group: no origin shift
      var start = cont && !first ? { scale: L.pushes[L.pushes.length - 1].s1, x: L.pushes[L.pushes.length - 1].x1, y: L.pushes[L.pushes.length - 1].y1 }
                                 : { scale: s0, x: (1 - s0) * org[0], y: (1 - s0) * org[1] };
      var end = { scale: s1, x: (1 - s1) * org[0], y: (1 - s1) * org[1] };
      this.tl.fromTo(L.g, { scale: start.scale, x: start.x, y: start.y },
        { scale: end.scale, x: end.x, y: end.y, duration: dur, ease: ease, immediateRender: first }, at);
      L.pushes.push({ at: at, dur: dur, ease: ease, s0: start.scale, x0: start.x, y0: start.y, s1: end.scale, x1: end.x, y1: end.y });
    }
    this._pushS = to; this._pushO = org;
    this._cam.push({ kind: "push", at: at, dur: dur, rate: dur > 0 ? Math.abs(to - from) / dur * 100 : 0, unit: "%/s", note: f1(from * 100) + "→" + f1(to * 100) + "%" });
    return this;
  };
  /** move one layer's inner group by (dx, dy) from where earlier moves left it, with absolute values. x and y are
      separate tweens, so a move along x (a track) and one along y (a rise) can overlap in time. Moves on the same axis:
      call them in time order (each starts where the last one ended). */
  Stage.prototype._move = function (L, dx, dy, at, dur, ease) {
    var tl = this.tl;
    function axis(p, d) {
      if (!d) return;
      var a = {}, b = { duration: dur, ease: ease, immediateRender: false };
      a[p] = L[p]; b[p] = L[p] + d;
      tl.fromTo(L.m, a, b, at);
      L.moves.push({ p: p, from: L[p], to: L[p] + d, at: at, dur: dur, ease: ease });
      L[p] += d;
    }
    axis("x", dx); axis("y", dy);
  };
  /** log one camera move (the fastest layer's speed) for cameraReport() */
  Stage.prototype._logMove = function (kind, Ls, amount, at, dur) {
    var top = 0;
    for (var i = 0; i < Ls.length; i++) top = Math.max(top, Math.abs(amount(Ls[i])));
    this._cam.push({ kind: kind, at: at, dur: dur, rate: dur > 0 ? top / dur : 0, unit: "px/s", note: Math.round(top) + " px (nearest layer)" });
  };
  /** pan: {dx: -160, dy: 0, at, dur, ease}; near layers travel the full dx */
  Stage.prototype.pan = function (o) {
    o = o || {};
    var Ls = this._worldLayers(o.skip), at = o.at || 0, dur = o.dur === undefined ? this.duration : o.dur;
    for (var i = 0; i < Ls.length; i++) this._move(Ls[i], (o.dx || 0) * Ls[i].depth, (o.dy || 0) * Ls[i].depth, at, dur, o.ease || "sine.inOut");
    this._logMove("pan", Ls, function (L) { return Math.max(Math.abs((o.dx || 0) * L.depth), Math.abs((o.dy || 0) * L.depth)); }, at, dur);
    return this;
  };
  /** track a walker: the world slides past at `speed` px/s (ground speed), figures in `hold` layers stay put */
  Stage.prototype.track = function (o) {
    o = o || {};
    var hold = o.hold || ["actors"], ground = this.depthOf(o.ground || "ground");
    var Ls = this._worldLayers(hold), at = o.at || 0, dur = o.dur === undefined ? this.duration - at : o.dur;
    var dist = (o.speed || 120) * dur * (o.dir === "right" ? 1 : -1);
    for (var i = 0; i < Ls.length; i++) this._move(Ls[i], dist * Ls[i].depth / (ground || 1), 0, at, dur, o.ease || "none");
    this._logMove("track", Ls, function (L) { return dist * L.depth / (ground || 1); }, at, dur);
    return this;
  };
  /** dive under the sea: the waterline rises out of the top and the depths (stage.underwater(), drawn one screen
      below the frame) come up to fill it. {at, dur, ease, dy} */
  Stage.prototype.dive = function (o) {
    o = o || {};
    var dy = o.dy || ((this._underTop || this.H) + 60), Ls = this._worldLayers(), at = o.at || 0, dur = o.dur === undefined ? 1.6 : o.dur;
    // the sky lags a little; everything else rises out of frame together
    for (var i = 0; i < Ls.length; i++) this._move(Ls[i], 0, -dy * (Ls[i].depth === 0 ? 0.85 : 1), at, dur, o.ease || "power2.inOut");
    this._logMove("dive", Ls, function () { return dy; }, at, dur);
    return this;
  };
  /** how much of a vertical camera move one layer takes: factors: {sky, far, mid, near, ground, actors, front} (a share
      of dy each), or keepHorizon: true (each layer by its depth: the sky stays, the horizon barely moves, near layers
      travel), or the classic lift (0.35 + 0.65 × depth: the sky and the horizon travel a third of the way) */
  Stage.prototype._vshare = function (L, o) {
    if (o.factors && o.factors[L.name] !== undefined) return o.factors[L.name];
    return o.keepHorizon ? L.depth : 0.35 + 0.65 * L.depth;
  };
  /** rise: the camera lifts (to the sky, or back up to the surface after a dive, or a crane over near things):
      {dy, at, dur, ease, keepHorizon, factors, skip} */
  Stage.prototype.rise = function (o) {
    o = o || {};
    var self = this, dy = o.dy || 600, Ls = this._worldLayers(o.skip), at = o.at || 0, dur = o.dur === undefined ? 2 : o.dur;
    for (var i = 0; i < Ls.length; i++) this._move(Ls[i], 0, dy * this._vshare(Ls[i], o), at, dur, o.ease || "power2.inOut");
    this._logMove("rise", Ls, function (L) { return dy * self._vshare(L, o); }, at, dur);
    return this;
  };
  /**
   * drop: the camera starts high (dy above, among the stars) and comes down to rest: {from: dy, at, dur, ease,
   * keepHorizon, factors, skip}. Call it before any other vertical move on the stage: then the high framing is the
   * first frame and holds until `at`. Called after one, it is a cut up to the high framing at `at`, then the drop.
   */
  Stage.prototype.drop = function (o) {
    o = o || {};
    var self = this, dy = o.from === undefined ? 900 : o.from, Ls = this._worldLayers(o.skip), at = o.at || 0;
    var dur = o.dur === undefined ? 1.2 : o.dur, ease = o.ease || "power2.out";
    for (var i = 0; i < Ls.length; i++) {
      var L = Ls[i], a = dy * this._vshare(L, o), base = L.y;
      var firstY = !L.moves.some(function (m) { return m.p === "y"; });
      L.y = base + a;
      if (firstY) { gsap.set(L.m, { y: L.y }); this.tl.set(L.m, { y: L.y }, 0); }
      else this.tl.set(L.m, { y: L.y }, at);
      L.moves.push({ p: "y", from: L.y, to: L.y, at: firstY ? 0 : at, dur: 0, ease: "none" });
      this._move(L, 0, -a, at, dur, ease);
    }
    this._logMove("drop", Ls, function (L) { return dy * self._vshare(L, o); }, at, dur);
    return this;
  };

  // ---------- where things are on screen, and the camera timeline ----------
  function eased(name) { return typeof name === "function" ? name : (gsap.parseEase(name || "none") || function (p) { return p; }); }
  function along(list, t, pick) {   // the value a list of absolute moves gives at time t (moves in time order)
    var v = null;
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      if (v === null) v = pick(m, 0);
      if (t < m.at) break;
      v = pick(m, m.dur > 0 ? eased(m.ease)(Math.min(1, (t - m.at) / m.dur)) : 1);
    }
    return v;
  }
  /** a layer's camera offset at time t (track, pan, rise, drop, dive): {x, y} */
  Stage.prototype.offsetAt = function (layer, t) {
    var L = this.layers[layer || "near"], out = { x: 0, y: 0 };
    if (!L) return out;
    ["x", "y"].forEach(function (p) {
      var list = L.moves.filter(function (m) { return m.p === p; });
      if (list.length) out[p] = along(list, t, function (m, k) { return m.from + (m.to - m.from) * k; });
    });
    return out;
  };
  /** where a point drawn in a layer shows on screen at time t (the camera's moves and pushes, not shake):
      S.toScreen("mid", 1450, 1300, cue("وتصحى")) → {x, y}. Call the camera moves first to use it while building. */
  Stage.prototype.toScreen = function (layer, x, y, t) {
    var L = this.layers[layer || "near"], off = this.offsetAt(layer, t), s = 1, tx = 0, ty = 0;
    if (L && L.pushes.length) {
      s = along(L.pushes, t, function (m, k) { return m.s0 + (m.s1 - m.s0) * k; });
      tx = along(L.pushes, t, function (m, k) { return m.x0 + (m.x1 - m.x0) * k; });
      ty = along(L.pushes, t, function (m, k) { return m.y0 + (m.y1 - m.y0) * k; });
    }
    return { x: s * (x + off.x) + tx, y: s * (y + off.y) + ty };
  };
  /**
   * The composition's own camera timeline, to report next to the pace probe's numbers (P8): every move with its
   * time and speed, and the share of the running time with a visible move (a push of 1 %/s or more, or a pan, track,
   * rise or drop of 30 px/s or more on the nearest layer). Aim for 30–45 %. {from, to}: the stretch to measure (a place
   * that is on screen from 4 s to 7 s: {from: 4, to: 7}); default the whole stage. → {moves, visibleShare, text}
   */
  Stage.prototype.cameraReport = function (o) {
    o = o || {};
    var t0 = o.from || 0, t1 = o.to === undefined ? (o.duration || this.duration) : o.to, D = t1 - t0;
    var minPush = o.minPush || 1, minPx = o.minPx || 30, spans = [], lines = [];
    this._cam.slice().sort(function (a, b) { return a.at - b.at; }).forEach(function (m) {
      var vis = m.unit === "%/s" ? m.rate >= minPush : m.rate >= minPx;
      if (vis && m.dur > 0 && m.at < t1 && m.at + m.dur > t0) spans.push([Math.max(t0, m.at), Math.min(t1, m.at + m.dur)]);
      lines.push(m.kind + " " + m.at.toFixed(2) + "–" + (m.at + m.dur).toFixed(2) + " s  " + m.rate.toFixed(m.unit === "%/s" ? 2 : 0) + " " + m.unit +
                 "  (" + m.note + ")" + (vis ? (m.unit === "%/s" && m.rate < 2.5 ? "  visible, but under 2.5 %/s it may not read as motion" : "") : "  under the visible minimum"));
    });
    spans.sort(function (a, b) { return a[0] - b[0]; });
    var covered = 0, cur = null;
    spans.forEach(function (sp) {
      if (!cur || sp[0] > cur[1]) { if (cur) covered += cur[1] - cur[0]; cur = sp.slice(); }
      else cur[1] = Math.max(cur[1], sp[1]);
    });
    if (cur) covered += cur[1] - cur[0];
    var share = D > 0 ? covered / D : 0;
    lines.push("visible camera move on " + (share * 100).toFixed(0) + "% of " + t0.toFixed(2) + "–" + t1.toFixed(2) + " s (aim 30–45%)");
    return { moves: this._cam.slice(), visibleShare: share, text: lines.join("\n") };
  };
  /** small shake (thunder): {at, dur, amp} */
  Stage.prototype.shake = function (o) {
    o = o || {};
    var w = this.world, at = o.at || 0, amp = o.amp || 6, n = Math.round((o.dur || 0.4) / 0.05), r = this.rng(31);
    for (var i = 0; i < n; i++) {
      var k = 1 - i / n;
      this.tl.to(w, { x: (r() - 0.5) * 2 * amp * k, y: (r() - 0.5) * 2 * amp * k, duration: 0.05, ease: "none" }, at + i * 0.05);
    }
    this.tl.to(w, { x: 0, y: 0, duration: 0.05 }, at + n * 0.05);
    return this;
  };
  /** dip to a colour and back: {at (middle), dur (each way), hold, color} */
  Stage.prototype.dip = function (o) {
    o = o || {};
    var r = el("rect", { x: 0, y: 0, width: this.W, height: this.H, fill: o.color || "#000" }, this.L("film"));
    r.style.opacity = 0;
    var dur = o.dur === undefined ? 0.4 : o.dur, hold = o.hold || 0.1, mid = o.at || 0;
    this.tl.to(r, { opacity: 1, duration: dur, ease: "power1.in" }, mid - dur - hold / 2);
    if (!o.stay) this.tl.to(r, { opacity: 0, duration: dur, ease: "power1.out" }, mid + hold / 2);
    return r;
  };
  /** fade the whole stage in from a colour at the start, or out at the end */
  Stage.prototype.fadeIn = function (o) {
    o = o || {};
    var r = el("rect", { x: 0, y: 0, width: this.W, height: this.H, fill: o.color || "#000" }, this.L("film"));
    this.tl.fromTo(r, { opacity: 1 }, { opacity: 0, duration: o.dur || 0.8, ease: "power1.out" }, o.at || 0);
    return r;
  };
  Stage.prototype.fadeOut = function (o) {
    o = o || {};
    var r = el("rect", { x: 0, y: 0, width: this.W, height: this.H, fill: o.color || "#000" }, this.L("film"));
    r.style.opacity = 0;
    var dur = o.dur || 0.8;
    this.tl.to(r, { opacity: 1, duration: dur, ease: "power1.in" }, o.at === undefined ? this.duration - dur : o.at);
    return r;
  };
  /** cross-fade between two stages' svg elements (or any two elements) */
  K.crossfade = function (tl, a, b, at, dur) {
    a = a.svg || a; b = b.svg || b;
    tl.set(b, { opacity: 0 }, 0);
    var made = [];
    tl.to(b, { opacity: 1, duration: dur || 0.8, ease: "power1.inOut" }, at); made.push(tl.recent());
    tl.to(a, { opacity: 0, duration: dur || 0.8, ease: "power1.inOut" }, at); made.push(tl.recent());
    K.placeChange("cross-fade", at, dur || 0.8, made);
  };

  // ---------- a verified card on screen: nothing changes or glints under it (2026-11-13) ----------
  /*
    The wisdom rerun (2026-11-12): the next room, with a man in it, showed through a hadith card while the card faded
    out, and a twinkling star beside «النَّبِيُّ» could be read as a mark. So compositions/verified-card.html calls
    Khaam.card({show, hide, box}) with its own span (SHOW to HIDE, its fades included) and box, and the kit keeps the
    card's span clear, whichever of the two compositions is built first:
      - a place change (Khaam.places show/cut/fade/whip, Khaam.crossfade) that would still be running when the card
        starts to come in, or asked for in the card's first half, is moved earlier, to end as the card comes in;
      - one asked for in the card's second half waits until the card has left (HIDE);
      - a star (scene.js "stars") whose place on screen (toScreen: the camera's moves and pushes) comes within 40 px
        of the card's box while the card is up fades out just before it comes in and back after it has left.
    Each move is said once in the console. Khaam.cards lists the cards; a scene built by hand reads it the same way.
  */
  K.cards = K.cards || [];
  K.__changes = K.__changes || [];
  K.__starSets = K.__starSets || [];
  var CARD_MARGIN = 40, STAR_FADE = 0.3;
  function heldAt(at, dur) {   // where a place change asked for at `at`, lasting `dur`, may run (unmoved: `at` itself)
    if (!(at > 0)) return at;
    var asked = at, any = false;
    for (var pass = 0; pass < 6; pass++) {
      var moved = false;
      for (var i = 0; i < K.cards.length; i++) {
        var c = K.cards[i];
        var mid = (c.show + c.hide) / 2;   // a change asked for inside the card goes to the nearer edge
        if (at > 0 && at < mid && at + dur > c.show + 1e-6) { at = Math.max(0, c.show - dur); moved = true; }
        else if (at >= mid && at < c.hide - 1e-6) { at = c.hide; moved = true; }
      }
      if (!moved) break;
      any = true;
    }
    return any ? at : asked;
  }
  function holdChange(ch) {
    var at = heldAt(ch.asked, ch.dur), d = at - ch.at;
    if (Math.abs(d) < 1e-6) return;
    ch.tweens.forEach(function (tw) { if (tw) tw.startTime(tw.startTime() + d); });
    (ch.marks || []).forEach(function (m) { m.w[m.i] = Math.max(0, m.w[m.i] + d); });
    ch.at = at;
    if (root.console) console.warn("Khaam: the " + ch.what + " asked for " + ch.asked.toFixed(2) + " s runs at " +
      at.toFixed(2) + " s, so nothing changes under the verified card (" + K.cards.map(function (c) {
        return c.show.toFixed(2) + "–" + c.hide.toFixed(2) + " s"; }).join(", ") + ").");
  }
  /** a place change, for the card rule: what (a few words), asked time, duration, its tweens, its on-screen marks */
  K.placeChange = function (what, at, dur, tweens, marks) {
    var ch = { what: what, asked: at, at: at, dur: dur || 0, tweens: tweens || [], marks: marks || [] };
    K.__changes.push(ch);
    holdChange(ch);
    return ch;
  };
  function starsOff() {   // every star set against every card, once each
    K.__starSets.forEach(function (set) {
      K.cards.forEach(function (c) {
        if (set.done.indexOf(c) >= 0) return;
        set.done.push(c);
        var S = set.S, b = c.box, m = CARD_MARGIN, n = Math.max(2, Math.ceil((c.hide - c.show) / 0.1));
        set.stars.forEach(function (st) {
          var near = false;
          for (var k = 0; k <= n && !near; k++) {
            var p = S.toScreen(set.layer, st.x, st.y, c.show + (c.hide - c.show) * k / n);
            near = p.x > b.x0 - m && p.x < b.x1 + m && p.y > b.y0 - m && p.y < b.y1 + m;
          }
          if (!near) return;
          if (!st.hold) {   // its own wrapper: the twinkle and the going-out keep their own tweens
            var first = st.els[0];
            st.hold = el("g", null);
            first.parentNode.insertBefore(st.hold, first);
            st.els.forEach(function (e) { st.hold.appendChild(e); });
          }
          var a = Math.max(0, c.show - STAR_FADE);
          S.tl.fromTo(st.hold, { opacity: 1 }, { opacity: 0, duration: c.show - a || 0.01, ease: "power1.inOut", immediateRender: false }, a);
          S.tl.fromTo(st.hold, { opacity: 0 }, { opacity: 1, duration: STAR_FADE, ease: "power1.inOut", immediateRender: false }, c.hide);
          set.off = (set.off || 0) + 1;
        });
      });
    });
  }
  function soon(fn) { if (typeof Promise !== "undefined") Promise.resolve().then(fn); else fn(); }
  /** stars drawn by scene.js: [{x, y, els: [the star, its halo]}] in a layer of a stage (for the card rule) */
  K.noteStars = function (S, layer, stars) {
    K.__starSets.push({ S: S, layer: layer, stars: stars, done: [] });
    soon(starsOff);   // after the scene's own script: its camera moves are known by then
  };
  /** a verified card: {show, hide, box: {x0, y0, x1, y1}} in seconds and screen pixels (verified-card.html calls it) */
  K.card = function (o) {
    var c = { show: +o.show, hide: +o.hide, box: o.box, name: o.name || "verified-card" };
    if (!(c.hide > c.show)) throw new Error("Khaam.card: hide must come after show.");
    K.cards.push(c);
    K.__changes.forEach(holdChange);
    starsOff();
    soon(starsOff);
    return c;
  };

  // ---------- svgMove: move, scale, turn and fade a group without GSAP's origin state ----------
  /**
   * Khaam.svgMove(tl, g, at, dur, from, to, ease, origin) or stage.svgMove(g, at, dur, from, to, ease, origin).
   * from / to: {x, y, s (or sx, sy), r (degrees), op}; origin: [x, y] in stage coordinates (scale and turn about it).
   * A plain object is tweened and the group's whole transform attribute is written on every update, so no origin is
   * ever remembered by GSAP: safe for a first-time scale, the same frame whichever frame a render worker starts on.
   * The group's own transform attribute is replaced: give it no position of its own (wrap it). Several moves on one
   * group: call them in time order; the first one's `from` is the frame-0 state. (The tl can be left out: then the
   * last stage's timeline is used.)
   */
  K.svgMove = function (tl, g, at, dur, from, to, ease, origin) {
    if (!tl || typeof tl.to !== "function") {   // svgMove(g, at, …): the timeline was left out
      if (tl && tl.tl && typeof tl.tl.to === "function") tl = tl.tl;
      else { origin = ease; ease = to; to = from; from = dur; dur = at; at = g; g = tl; tl = K._lastStage && K._lastStage.tl; }
    }
    if (!tl) throw new Error("Khaam.svgMove: no timeline (pass it first, or make a stage before)");
    var o = origin || [0, 0];
    function full(v) {
      var s = v.s === undefined ? 1 : v.s;
      return { x: v.x || 0, y: v.y || 0, sx: v.sx === undefined ? s : v.sx, sy: v.sy === undefined ? s : v.sy, r: v.r || 0, op: v.op };
    }
    var a = full(from || {}), b = full(to || {}), p = {}, k;
    for (k in a) if (a[k] !== undefined) p[k] = a[k];
    var keepOp = a.op !== undefined || b.op !== undefined;
    if (keepOp) { if (a.op === undefined) p.op = 1; if (b.op === undefined) b.op = p.op; }
    function put() {
      g.setAttribute("transform", "translate(" + f1(o[0] + p.x) + " " + f1(o[1] + p.y) + ")" + (p.r ? " rotate(" + (Math.round(p.r * 100) / 100) + ")" : "") +
        " scale(" + p.sx.toFixed(4) + " " + p.sy.toFixed(4) + ") translate(" + f1(-o[0]) + " " + f1(-o[1]) + ")");
      if (keepOp) g.style.opacity = p.op;
    }
    if (!g.__khaamMoved) { put(); g.__khaamMoved = true; }   // the first move's start is the frame-0 state
    var start = {}, end = { duration: dur, ease: ease || "power2.inOut", onUpdate: put, immediateRender: false };
    for (k in p) { start[k] = p[k]; end[k] = b[k] === undefined ? p[k] : b[k]; }
    tl.fromTo(p, start, end, at);
    return g;
  };
  Stage.prototype.svgMove = function (g, at, dur, from, to, ease, origin) { return K.svgMove(this.tl, g, at, dur, from, to, ease, origin); };

  // ---------- a soft plate under text over a moving scene (P12) ----------
  /** {cx, cy, rx, ry, alpha: 0.42, color: "ink", show, hide, fade: 0.6, layer: "weather"} → the ellipse.
      Without show it is there from frame 0; without hide it stays. Painted by role, so relight retints it. */
  Stage.prototype.plate = function (o) {
    o = o || {};
    var a = o.alpha === undefined ? 0.42 : o.alpha, c = o.color || "ink", fade = o.fade === undefined ? 0.6 : o.fade;
    var e = el("ellipse", { cx: o.cx === undefined ? this.W / 2 : o.cx, cy: o.cy === undefined ? 760 : o.cy, rx: o.rx || 640, ry: o.ry || 420,
      fill: this.rgrad([[0, c, a], [0.55, c, a * 0.6], [1, c, 0]]) }, this.L(o.layer || "weather"));
    if (o.show !== undefined && o.show !== null && o.show > 0) {
      e.style.opacity = 0;
      this.tl.fromTo(e, { opacity: 0 }, { opacity: 1, duration: fade, ease: "power1.inOut", immediateRender: false }, o.show);
    }
    if (o.hide !== undefined && o.hide !== null)
      this.tl.fromTo(e, { opacity: 1 }, { opacity: 0, duration: fade, ease: "power1.inOut", immediateRender: false }, o.hide);
    return e;
  };

  // ---------- time-lapse: a day (or a year) in under a second ----------
  /**
   * stage.timelapse({at, dur: 0.8, stay: false, night: "night", day, sun, sunDrop: 250, stars, starTurn: 9,
   *                  pole: [540, 2400], moon, moonTravel: [420, -80], shadows: [el | {el, x, y}], swing: 70,
   *                  hide: [els], show: [els]})
   * The light goes down (a relight to `night`), the sun sinks, the stars wheel round a far pole, the moon crosses,
   * shadows swing round their foot, then the light comes back to `day` (default: the palette the stage has when this
   * is called). stay: true ends on the night. sun, stars, moon: what those pieces returned (or a group). hide: things
   * that fade out as the light goes (people leave); show: things that fade in as it comes back. Call it after the
   * world is built and in time order with the other relights. Several in a row = the years pass.
   */
  Stage.prototype.timelapse = function (o) {
    o = o || {};
    var tl = this.tl, at = o.at || 0, dur = o.dur === undefined ? 0.8 : o.dur, stay = !!o.stay;
    var day = o.day || this.pal, night = o.night || "night", dn = stay ? dur * 0.56 : dur * 0.375, back = at + dur * 0.5;
    function grp(x) { return x && (x.g || x.el || x); }
    this.relight(night, { at: at, dur: dn, ease: "power1.in" });
    var sun = grp(o.sun), drop = o.sunDrop === undefined ? 250 : o.sunDrop;
    if (sun) {
      tl.fromTo(sun, { y: 0 }, { y: drop, duration: dn, ease: "sine.in", immediateRender: false }, at - 0.05);
      if (!stay) tl.fromTo(sun, { y: drop }, { y: 0, duration: dur * 0.5, ease: "sine.out", immediateRender: false }, back);
    }
    var stars = grp(o.stars);
    if (stars) {
      var pole = o.pole || [this.W / 2, this.H + 480], turn = stars.__khaamTurn || 0, step = o.starTurn === undefined ? 9 : o.starTurn;
      if (stay) step *= 0.55;
      tl.fromTo(stars, { rotation: turn, svgOrigin: f1(pole[0]) + " " + f1(pole[1]) },
        { rotation: turn + step, svgOrigin: f1(pole[0]) + " " + f1(pole[1]), duration: stay ? dur * 2 : dur, ease: "sine.inOut", immediateRender: false }, at);
      stars.__khaamTurn = turn + step;
    }
    var moon = grp(o.moon), mt = o.moonTravel || [420, -80];
    if (moon) {
      var k = stay ? 0.3 : 1;
      tl.fromTo(moon, { x: 0, y: 0 }, { x: mt[0] * k, y: mt[1] * k, duration: stay ? dur * 2.5 : dur, ease: "sine.inOut", immediateRender: false }, at);
      if (!stay) tl.set(moon, { x: 0, y: 0 }, at + dur + 0.02);
    }
    var sw = o.swing === undefined ? 70 : o.swing;
    (o.shadows || []).forEach(function (s) {
      var e = s.el || s, px = s.x, py = s.y;
      if (px === undefined) { try { var bb = e.getBBox(); px = bb.x + bb.width / 2; py = bb.y + bb.height; } catch (err) { px = 540; py = 1500; } }
      var so = f1(px) + " " + f1(py);
      tl.fromTo(e, { rotation: 0, svgOrigin: so }, { rotation: -sw, svgOrigin: so, duration: dn, ease: "power1.in", immediateRender: false }, at);
      if (!stay) tl.fromTo(e, { rotation: sw * 0.85, svgOrigin: so }, { rotation: 0, svgOrigin: so, duration: dur * 0.5, ease: "power1.out", immediateRender: false }, back);
    });
    if (o.hide && o.hide.length) tl.to(o.hide, { opacity: 0, duration: Math.min(0.3, dn), ease: "power1.in" }, at);
    if (!stay) {
      this.relight(day, { at: back, dur: dur * 0.5, ease: "power1.out" });
      if (o.show && o.show.length) tl.fromTo(o.show, { opacity: 0 }, { opacity: 1, duration: dur * 0.5, ease: "power1.out", immediateRender: false }, back);
    }
    return { at: at, end: stay ? at + dn : at + dur };
  };

  // ---------- a video told in places (P9: a new place every sentence or two) ----------
  /**
   * var P = Khaam.places(tl, "#places", {duration: D, horizon: 1400, wind: 0.2});   // host: a div in the composition
   * var A = P.place("room", {palette: "dawn", light: {…}});   → a stage of its own, in its own div and svg
   * P.show("room", 0, null);                       // in at 0 (on frame 0, no fade), never out
   * P.show("lane", 3.2, 6.0, {fade: 0.3});         // fade in / out (fadeIn, fadeOut for each side; 0 = a cut)
   * P.cut("room", "lane", 3.2);                    // a hard cut
   * P.whip("lane", "roof", 6.0, {dir: "left", dur: 0.32, blur: 10});   // both slide as one strip, blurred mid-way
   * P.fade("roof", "town", 9.1, 0.4);              // a cross-fade
   * Every place shares the one timeline; give each its own camera move (P8) and let the cut or whip carry the change.
   */
  K.places = function (tl, host, defaults) {
    host = K.$(host);
    var all = {}, W = (defaults && defaults.width) || 1080, H = (defaults && defaults.height) || 1920;
    function get(n) { var p = all[n]; if (!p) throw new Error("Khaam.places: no place named " + n); return p; }
    function place(name, opts) {
      var d = document.createElement("div");
      d.className = "khaam-place"; d.setAttribute("data-place", name);
      d.setAttribute("data-layout-allow-overflow", ""); d.setAttribute("data-layout-allow-overlap", "");
      d.style.cssText = "position:absolute;left:0;top:0;width:" + W + "px;height:" + H + "px;overflow:hidden;visibility:hidden;opacity:0";
      var s = document.createElementNS(NS, "svg");
      s.setAttribute("width", W); s.setAttribute("height", H);
      s.style.cssText = "position:absolute;left:0;top:0;width:" + W + "px;height:" + H + "px;display:block;overflow:visible";
      d.appendChild(s); host.appendChild(d);
      var o = { tl: tl }, k;
      for (k in defaults || {}) o[k] = defaults[k];
      for (k in opts || {}) o[k] = opts[k];
      var S = K.stage(s, o);
      S.place = name;
      all[name] = { name: name, div: d, svg: s, S: S };
      return S;
    }
    function mark(n, at, isOn) {   // when each place is on screen, for cameraReport(); → {w, i} for the card rule
      var w = get(n).shown = get(n).shown || [];
      if (isOn) { w.push([Math.max(0, at), null]); return { w: w[w.length - 1], i: 0 }; }
      if (w.length && w[w.length - 1][1] === null) { w[w.length - 1][1] = at; return { w: w[w.length - 1], i: 1 }; }
      return null;
    }
    function on(n, at, dur) {
      var mk = mark(n, at, true);
      var d = get(n).div;
      if (at <= 0) { gsap.set(d, { visibility: "visible", opacity: 1 }); tl.set(d, { visibility: "visible", opacity: 1 }, 0); }
      else if (!dur) { tl.set(d, { visibility: "visible", opacity: 1 }, at); K.placeChange("place «" + n + "» coming in", at, 0, [tl.recent()], [mk]); }
      else {
        tl.fromTo(d, { autoAlpha: 0 }, { autoAlpha: 1, duration: dur, ease: "power1.inOut", immediateRender: false }, at);
        K.placeChange("place «" + n + "» coming in", at, dur, [tl.recent()], [mk]);
      }
    }
    function off(n, at, dur) {
      var mk = mark(n, at + (dur || 0), false);
      var d = get(n).div;
      if (!dur) tl.set(d, { autoAlpha: 0 }, at);
      else tl.to(d, { autoAlpha: 0, duration: dur, ease: "power1.inOut" }, at);
      K.placeChange("place «" + n + "» going out", at, dur || 0, [tl.recent()], mk ? [mk] : []);
    }
    return {
      place: place, places: all, get: function (n) { return get(n).S; },
      /** show(name, in, out, {fade, fadeIn, fadeOut}) (or the old show(name, in, out, fadeIn, fadeOut)) */
      show: function (n, tIn, tOut, a, b) {
        var fi = 0.3, fo = 0.3;
        if (typeof a === "number") { fi = a; fo = b === undefined ? a : b; }
        else if (a) { if (a.fade !== undefined) fi = fo = a.fade; if (a.fadeIn !== undefined) fi = a.fadeIn; if (a.fadeOut !== undefined) fo = a.fadeOut; }
        on(n, tIn, tIn <= 0 ? 0 : fi);
        if (tOut !== null && tOut !== undefined) off(n, tOut, fo);
        return this;
      },
      cut: function (a, b, at) { off(a, at, 0); on(b, at, 0); return this; },
      fade: function (a, b, at, dur) { dur = dur === undefined ? 0.4 : dur; on(b, at, dur); off(a, at, dur); return this; },
      /** whip(a, b, at, {dir: "left"|"right"|"up"|"down", dur: 0.32, blur: 10}): a leaves, b arrives, as one strip */
      whip: function (a, b, at, o) {
        o = o || {};
        var A = get(a).div, B = get(b).div, dur = o.dur || 0.32, bl = o.blur === undefined ? 10 : o.blur, dir = o.dir || "left";
        var p = dir === "up" || dir === "down" ? "y" : "x", far = (p === "x" ? W : H) * (dir === "left" || dir === "up" ? -1 : 1);
        var aFrom = {}, aTo = { duration: dur, ease: o.ease || "power2.inOut", immediateRender: false }, bFrom = {}, bTo = { duration: dur, ease: o.ease || "power2.inOut", immediateRender: false };
        aFrom[p] = 0; aTo[p] = far; bFrom[p] = -far; bTo[p] = 0;
        var made = [];
        tl.fromTo(A, aFrom, aTo, at); made.push(tl.recent());
        tl.set(B, { visibility: "visible", opacity: 1 }, at); made.push(tl.recent());
        tl.fromTo(B, bFrom, bTo, at); made.push(tl.recent());
        if (bl > 0) {
          tl.fromTo(A, { filter: "blur(0px)" }, { filter: "blur(" + bl + "px)", duration: dur / 2, ease: "power1.in", immediateRender: false }, at); made.push(tl.recent());
          tl.fromTo(B, { filter: "blur(" + bl + "px)" }, { filter: "blur(0px)", duration: dur / 2, ease: "power1.out", immediateRender: false }, at + dur / 2); made.push(tl.recent());
          tl.set(B, { filter: "none" }, at + dur + 0.01); made.push(tl.recent());
        }
        tl.set(A, { autoAlpha: 0 }, at + dur); made.push(tl.recent());
        var m1 = mark(a, at + dur, false), m2 = mark(b, at, true);
        K.placeChange("whip «" + a + "» → «" + b + "»", at, dur, made, [m1, m2].filter(Boolean));
        return this;
      },
      /** every place's camera over the time it is on screen, and the whole video's share with a visible move */
      cameraReport: function (o) {
        o = o || {};
        var lines = [], covered = 0, total = 0;
        for (var n in all) (all[n].shown || []).forEach(function (w) {
          var end = w[1] === null ? (o.duration || all[n].S.duration) : w[1], r = all[n].S.cameraReport({ from: w[0], to: end });
          lines.push("[" + n + " " + w[0].toFixed(2) + "–" + end.toFixed(2) + " s]\n" + r.text);
          covered += r.visibleShare * (end - w[0]); total += end - w[0];
        });
        var share = total ? covered / total : 0;
        lines.push("all places: a visible camera move on " + (share * 100).toFixed(0) + "% of the time (aim 30–45%)");
        return { visibleShare: share, text: lines.join("\n") };
      }
    };
  };
})(window);
