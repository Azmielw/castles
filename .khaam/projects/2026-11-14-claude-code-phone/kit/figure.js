/*
  «موشن خام» figure kit (figure.js). Needs kit.js first.
  Faceless figures, side view, drawn from joint angles: a pose is a set of angles, so any pose morphs into any other.
  THE RULE (also in kit/README.md): never a feature on a face. No prophet and no companion is ever drawn,
  not as a figure, a shape, a silhouette, a shadow or a light standing in for one. Claude refuses if asked.

  S.figure({who, outfit, head, igal, skin, x, y, h, facing, pose, layer, colors, rim, outline, prop, glow, style, light})
    rim:    {width, strength} or false. Default: a band past the outline on the side of the light. light: {x, y} = this figure's own light.
    who:    man | woman | boy | girl
    outfit: thobe | thobe_grey | thobe_brown | thobe_navy | bisht | modern | shirt | abaya | dress
    head:   kufi | ghutra | shemagh | hair | hijab | hair_long | none   (ghutra and shemagh are plain; igal: true draws the igal, only on request)
    skin:   light | wheat | olive | tan | brown | deep   (or any #hex)
    prop:   box | book | lantern | phone (drawn with the pose) · jug | hoe | box_held (held things: see f.hold)
    pose:   stand | look_up | raise_hands | point | carry | carry_low | carry_lamp | sit | sit_ground | sit_rest | sit_cross | sit_wall | grieve
            day: lie | sit_bed | to_light | type1 | type2 | drive | phone1 | phone2 | slump | hands | reach
            work: stoop_pour | pour | half_kneel | dig_up | dig_down | lean_hoe | hand_trunk
            study: sit_read | sit_flip | sit_lost | read | read2 | hold_book | shut | write | explain | explain2 | think | climb
            prayer scene only: pray_stand | bow | kneel | sit_heels | tend | sujood
  f.pose(name, {at, dur, ease})   f.alternate(a, b, {at, dur, every})   f.walk({at, dur, cycle, arms})   f.run({at, dur, cycle})
  f.move({x, at, dur})   f.face(dir, at)   f.at(pose, {at})   f.handAt(pose, "near"|"far", {at, tip})   f.reach({x, y, at, dur})
  f.hold(draw | "jug" | "hoe" | "box_held", {hand, grip, rot, aim, along, at, take, poses}) → h   h.set({...}, {at, dur})   f.release({at})
  S.crowd({...})  many figures by repetition, seeded.
  Khaam.figureJoints(who, pose, h)  the joints of a pose without a stage (px for a figure of height h, feet at 0, facing right).
*/
(function (K) {
  "use strict";
  var el = K.el, f1 = K.f1, D = Math.PI / 180;
  function dir(a) { return [Math.sin(a * D), Math.cos(a * D)]; }    // angle from straight down; +90 = forward
  function add(p, v, k) { return [p[0] + v[0] * k, p[1] + v[1] * k]; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  // body proportions, in units of the figure's height
  var BODY = {
    man: { ankle: 0.045, shin: 0.222, thigh: 0.235, spine: 0.29, neck: 0.05, hrx: 0.064, hry: 0.077, upper: 0.163, fore: 0.142, hand: 0.05, foot: 0.098,
      wThigh: 0.084, wShin: 0.062, wUpper: 0.054, wFore: 0.045, wHand: 0.034, wFoot: 0.034, wNeck: 0.046, wRobe: 0.11, chest: 0.07, back: 0.058, belly: 0.06, butt: 0.064 },
    woman: { ankle: 0.045, shin: 0.222, thigh: 0.235, spine: 0.285, neck: 0.05, hrx: 0.061, hry: 0.074, upper: 0.158, fore: 0.138, hand: 0.046, foot: 0.09,
      wThigh: 0.08, wShin: 0.058, wUpper: 0.048, wFore: 0.04, wHand: 0.03, wFoot: 0.03, wNeck: 0.04, wRobe: 0.115, chest: 0.064, back: 0.054, belly: 0.058, butt: 0.068 },
    child: { ankle: 0.05, shin: 0.2, thigh: 0.205, spine: 0.27, neck: 0.04, hrx: 0.088, hry: 0.1, upper: 0.15, fore: 0.13, hand: 0.055, foot: 0.11,
      wThigh: 0.1, wShin: 0.08, wUpper: 0.07, wFore: 0.06, wHand: 0.048, wFoot: 0.045, wNeck: 0.06, wRobe: 0.13, chest: 0.085, back: 0.075, belly: 0.082, butt: 0.075 }
  };
  var SKIN = { light: "#e9c6a4", wheat: "#d7a882", olive: "#c29068", tan: "#a8764f", brown: "#86593c", deep: "#5e3d29" };
  var OUTFIT = {
    thobe: { kind: "robe", robe: "#eceae3", shoes: "#c8b18e" },
    thobe_grey: { kind: "robe", robe: "#a8a49b", shoes: "#3a3432" },
    thobe_brown: { kind: "robe", robe: "#8a7560", shoes: "#3a3230" },
    thobe_navy: { kind: "robe", robe: "#3a4560", shoes: "#2c2a2a" },
    bisht: { kind: "robe", robe: "#eceae3", shoes: "#c8b18e", cloak: "#3a2e29", trim: "#c9a24c" },
    modern: { kind: "pants", top: "#3e6d69", bottom: "#2b3245", shoes: "#e8e5de", hood: true },
    shirt: { kind: "pants", top: "#d6cfc0", bottom: "#4a4f5c", shoes: "#3a3230" },
    abaya: { kind: "robe", robe: "#1f1f26", shoes: "#2a2a30" },
    dress: { kind: "robe", robe: "#6c5878", shoes: "#3a3034" }
  };
  var HEADC = { kufi: "#f4f2ec", ghutra: "#f2f1ec", shemagh: "#b5383c", hair: "#231a16", hair_long: "#2a1d17", hijab: "#2a2a33", igal: "#141418" };

  // ---------- poses (degrees). legs: t = thigh from straight down (+ forward), k = knee bend, af = ankle (+ toes up)
  // arms (relative to the torso): a = upper arm from down (+ forward), e = elbow bend (+ forward), w = wrist
  // pray_stand, bow, kneel, sit_heels, tend and sujood are for a prayer scene only: anywhere else they read as bowing or prostrating.
  var POSES = {
    stand: { lean: 0, head: 3, legN: { t: 3, k: 4, af: 1 }, legF: { t: -3, k: 4, af: 1 }, armN: { a: 6, e: 12, w: 4 }, armF: { a: -3, e: 14, w: 4 } },
    look_up: { lean: -3, head: -30, legN: { t: 3, k: 3, af: 1 }, legF: { t: -3, k: 3, af: 1 }, armN: { a: 4, e: 10, w: 4 }, armF: { a: -2, e: 12, w: 4 } },
    raise_hands: { lean: 2, head: 8, legN: { t: 3, k: 4, af: 1 }, legF: { t: -3, k: 4, af: 1 }, armN: { a: 18, e: 118, w: -62 }, armF: { a: 6, e: 128, w: -62 } },
    pray_stand: { lean: 0, head: 14, legN: { t: 2, k: 2, af: 0 }, legF: { t: -2, k: 2, af: 0 }, armN: { a: 12, e: 120, w: 10 }, armF: { a: 8, e: 124, w: 10 } },
    bow: { lean: 86, head: 4, legN: { t: 3, k: 2, af: 0 }, legF: { t: -3, k: 2, af: 0 }, armN: { a: -132, e: 6, w: 0 }, armF: { a: -138, e: 6, w: 0 } },
    kneel: { lean: 2, head: 6, legN: { t: 2, k: 92, af: -88 }, legF: { t: -2, k: 88, af: -88 }, armN: { a: 4, e: 12, w: 4 }, armF: { a: -2, e: 14, w: 4 } },
    sit_heels: { lean: 5, head: 8, legN: { t: 84, k: 172, af: -80 }, legF: { t: 80, k: 168, af: -80 }, armN: { a: 26, e: 44, w: 6 }, armF: { a: 22, e: 46, w: 6 } },
    tend: { lean: 30, head: 26, legN: { t: 84, k: 172, af: -80 }, legF: { t: 80, k: 168, af: -80 }, armN: { a: 18, e: 24, w: 10 }, armF: { a: 8, e: 30, w: 10 } },
    sujood: { lean: 118, head: 14, legN: { t: 18, k: 108, af: 0 }, legF: { t: 14, k: 104, af: 0 }, armN: { a: -90, e: 56, w: 8 }, armF: { a: -94, e: 58, w: 8 } },
    sit: { lean: -4, head: 4, legN: { t: 88, k: 92, af: 2 }, legF: { t: 82, k: 84, af: 2 }, armN: { a: 30, e: 50, w: 6 }, armF: { a: 26, e: 52, w: 6 }, seat: true },
    sit_ground: { ground: true, lean: 12, head: 8, legN: { t: 128, k: 152, af: 10 }, legF: { t: 120, k: 146, af: 10 }, armN: { a: 30, e: 52, w: 10 }, armF: { a: 26, e: 56, w: 10 } },
    grieve: { ground: true, lean: 28, head: 36, legN: { t: 124, k: 148, af: 10 }, legF: { t: 118, k: 142, af: 10 }, armN: { a: -8, e: 142, w: 10 }, armF: { a: -12, e: 146, w: 10 } },
    carry: { lean: -3, head: 2, legN: { t: 4, k: 4, af: 1 }, legF: { t: -4, k: 4, af: 1 }, armN: { a: 20, e: 80, w: 0 }, armF: { a: 16, e: 84, w: 0 } },
    carry_lamp: { lean: 0, head: 6, legN: { t: 3, k: 4, af: 1 }, legF: { t: -3, k: 4, af: 1 }, armN: { a: 40, e: 16, w: 0 }, armF: { a: -3, e: 14, w: 4 } },
    point: { lean: 0, head: -4, legN: { t: 3, k: 4, af: 1 }, legF: { t: -3, k: 4, af: 1 }, armN: { a: 96, e: 4, w: 0 }, armF: { a: -3, e: 14, w: 4 } },
    // 1.7: a box or a stack carried with the hands at the waist, held forward, so a tall load never covers the head
    carry_low: { lean: -3, head: 4, legN: { t: 4, k: 4, af: 1 }, legF: { t: -4, k: 4, af: 1 }, armN: { a: 8, e: 70, w: 0 }, armF: { a: 4, e: 74, w: 0 } },
    // 1.7 seated, the back upright (a figure that carries the story sits upright: see figure-kit.md, the posture rule)
    sit_rest: { ground: true, lean: -4, head: 10, legN: { t: 126, k: 150, af: 10 }, legF: { t: 116, k: 140, af: 10 }, armN: { a: 34, e: 40, w: 10 }, armF: { a: -34, e: 8, w: 20 } },
    sit_cross: { ground: true, lean: 2, head: 8, legN: { t: 86, k: 158, af: 72 }, legF: { t: 80, k: 150, af: 70 }, armN: { a: 22, e: 24, w: 6 }, armF: { a: 18, e: 28, w: 6 } },
    sit_wall: { lean: -2, head: 4, legN: { t: 88, k: 92, af: 2 }, legF: { t: 82, k: 84, af: 2 }, armN: { a: 30, e: 50, w: 6 }, armF: { a: 26, e: 52, w: 6 }, seat: true },
    // 1.7 an ordinary day (alternate type1/type2 every 0.15 s to type, phone1/phone2 every 0.42 s to scroll)
    lie: { lean: -86, head: -4, legN: { t: 90, k: 2, af: 0 }, legF: { t: 88, k: 4, af: 0 }, armN: { a: 150, e: 26, w: 0 }, armF: { a: 156, e: 22, w: 0 } },
    sit_bed: { ground: true, lean: 4, head: 8, legN: { t: 90, k: 4, af: 0 }, legF: { t: 87, k: 8, af: 0 }, armN: { a: 26, e: 36, w: 4 }, armF: { a: 18, e: 40, w: 4 } },
    to_light: { ground: true, lean: -3, head: -18, legN: { t: 90, k: 4, af: 0 }, legF: { t: 87, k: 8, af: 0 }, armN: { a: -24, e: 20, w: 6 }, armF: { a: 22, e: 40, w: 4 } },
    type1: { lean: 6, head: 14, legN: { t: 88, k: 92, af: 2 }, legF: { t: 82, k: 86, af: 2 }, armN: { a: 66, e: 34, w: -10 }, armF: { a: 58, e: 40, w: -10 }, seat: true },
    type2: { lean: 6, head: 10, legN: { t: 88, k: 92, af: 2 }, legF: { t: 82, k: 86, af: 2 }, armN: { a: 62, e: 42, w: -22 }, armF: { a: 60, e: 36, w: -4 }, seat: true },
    drive: { lean: -8, head: 0, legN: { t: 78, k: 70, af: 4 }, legF: { t: 74, k: 66, af: 4 }, armN: { a: 70, e: 34, w: -8 }, armF: { a: 62, e: 40, w: -8 }, seat: true },
    phone1: { lean: 8, head: 30, legN: { t: 88, k: 92, af: 2 }, legF: { t: 82, k: 86, af: 2 }, armN: { a: 34, e: 92, w: -12 }, armF: { a: 28, e: 96, w: -12 }, seat: true },
    phone2: { lean: 8, head: 32, legN: { t: 88, k: 92, af: 2 }, legF: { t: 82, k: 86, af: 2 }, armN: { a: 34, e: 92, w: -26 }, armF: { a: 28, e: 96, w: -12 }, seat: true },
    slump: { lean: 16, head: 42, legN: { t: 88, k: 92, af: 2 }, legF: { t: 82, k: 86, af: 2 }, armN: { a: 26, e: 84, w: -14 }, armF: { a: 20, e: 88, w: -14 }, seat: true },
    hands: { lean: 4, head: 36, legN: { t: 3, k: 4, af: 1 }, legF: { t: -3, k: 4, af: 1 }, armN: { a: 30, e: 76, w: -26 }, armF: { a: 24, e: 80, w: -26 } },
    reach: { lean: 8, head: 2, legN: { t: 16, k: 10, af: 1 }, legF: { t: -10, k: 6, af: 2 }, armN: { a: 84, e: 6, w: -34 }, armF: { a: 8, e: 18, w: 4 } },
    // 1.7 work that never reads as worship: standing, 30° or less at the waist, head up; one knee down with the back straight
    stoop_pour: { lean: 24, head: -8, legN: { t: 14, k: 22, af: 4 }, legF: { t: -8, k: 16, af: 2 }, armN: { a: 52, e: 30, w: 0 }, armF: { a: 44, e: 36, w: 0 } },
    pour: { lean: 24, head: -6, legN: { t: 14, k: 22, af: 4 }, legF: { t: -8, k: 16, af: 2 }, armN: { a: 2, e: 46, w: 0 }, armF: { a: -6, e: 52, w: 0 } },
    half_kneel: { lean: 6, head: 10, legN: { t: 88, k: 96, af: 4 }, legF: { t: -6, k: 96, af: -80 }, armN: { a: 30, e: 50, w: 6 }, armF: { a: 24, e: 54, w: 6 } },
    dig_up: { lean: 6, head: -4, legN: { t: 20, k: 22, af: 4 }, legF: { t: -14, k: 12, af: 2 }, armN: { a: 158, e: 22, w: 0 }, armF: { a: 146, e: 34, w: 0 } },
    dig_down: { lean: 26, head: -16, legN: { t: 24, k: 32, af: 4 }, legF: { t: -12, k: 18, af: 2 }, armN: { a: 18, e: 0, w: 0 }, armF: { a: 10, e: 6, w: 0 } },
    lean_hoe: { lean: 4, head: 8, legN: { t: 6, k: 6, af: 1 }, legF: { t: -6, k: 6, af: 1 }, armN: { a: 36, e: 58, w: 0 }, armF: { a: 30, e: 64, w: 0 } },
    hand_trunk: { lean: 2, head: 4, legN: { t: 8, k: 8, af: 2 }, legF: { t: -6, k: 6, af: 1 }, armN: { a: 70, e: 14, w: -6 }, armF: { a: -3, e: 14, w: 4 } },
    // 1.7 study (sit_* need a desk or a seat; alternate read/read2 or explain/explain2 every ~0.6 s while he reads or talks)
    sit_read: { lean: 14, head: 26, legN: { t: 88, k: 92, af: 2 }, legF: { t: 82, k: 84, af: 2 }, armN: { a: 58, e: 44, w: 0 }, armF: { a: 50, e: 52, w: 0 }, seat: true },
    sit_flip: { lean: 16, head: 22, legN: { t: 88, k: 92, af: 2 }, legF: { t: 82, k: 84, af: 2 }, armN: { a: 78, e: 14, w: 0 }, armF: { a: 50, e: 52, w: 0 }, seat: true },
    sit_lost: { lean: 2, head: -8, legN: { t: 88, k: 92, af: 2 }, legF: { t: 82, k: 84, af: 2 }, armN: { a: 30, e: 128, w: 0 }, armF: { a: 40, e: 60, w: 0 }, seat: true },
    read: { lean: 2, head: 24, legN: { t: 3, k: 4, af: 1 }, legF: { t: -3, k: 4, af: 1 }, armN: { a: 46, e: 92, w: 0 }, armF: { a: 40, e: 98, w: 0 } },
    read2: { lean: 4, head: 30, legN: { t: 3, k: 4, af: 1 }, legF: { t: -3, k: 4, af: 1 }, armN: { a: 58, e: 76, w: 0 }, armF: { a: 36, e: 104, w: 0 } },
    hold_book: { lean: 2, head: 16, legN: { t: 3, k: 4, af: 1 }, legF: { t: -3, k: 4, af: 1 }, armN: { a: 66, e: 52, w: 0 }, armF: { a: 60, e: 58, w: 0 } },
    shut: { lean: 6, head: 18, legN: { t: 3, k: 4, af: 1 }, legF: { t: -3, k: 4, af: 1 }, armN: { a: 60, e: 30, w: 0 }, armF: { a: 54, e: 36, w: 0 } },
    write: { lean: 8, head: 14, legN: { t: 6, k: 6, af: 1 }, legF: { t: -4, k: 4, af: 1 }, armN: { a: 84, e: 22, w: 0 }, armF: { a: 18, e: 40, w: 4 } },
    explain: { lean: 4, head: 12, legN: { t: 3, k: 4, af: 1 }, legF: { t: -3, k: 4, af: 1 }, armN: { a: 70, e: 20, w: 0 }, armF: { a: 20, e: 60, w: 0 } },
    explain2: { lean: 2, head: 4, legN: { t: 3, k: 4, af: 1 }, legF: { t: -3, k: 4, af: 1 }, armN: { a: 112, e: 34, w: 0 }, armF: { a: 30, e: 70, w: 0 } },
    think: { lean: 0, head: -8, legN: { t: 3, k: 4, af: 1 }, legF: { t: -3, k: 4, af: 1 }, armN: { a: 30, e: 130, w: 0 }, armF: { a: 10, e: 30, w: 4 } },
    climb: { lean: 6, head: -14, legN: { t: 62, k: 84, af: 0 }, legF: { t: -4, k: 8, af: 1 }, armN: { a: 152, e: 22, w: 0 }, armF: { a: 128, e: 34, w: 0 } }
  };
  K.poses = POSES;

  /** walk cycle pose at phase p (0..1) */
  function walkPose(p, o) {
    o = o || {};
    var amp = o.stride || 22;
    function leg(q) {
      q = ((q % 1) + 1) % 1;
      var t = amp * Math.sin(2 * Math.PI * q) + 2;
      var x = ((q - 0.95 + 1.5) % 1) - 0.5, bump = Math.abs(x) < 0.25 ? Math.cos(2 * Math.PI * x) : 0;
      var k = 5 + 52 * bump, s = t - k;
      var w = q > 0.3 && q < 0.68 ? 1 : (q > 0.25 && q <= 0.3 ? (q - 0.25) / 0.05 : (q >= 0.68 && q < 0.74 ? (0.74 - q) / 0.06 : 0));
      return { t: t, k: k, af: w * (-s) + (1 - w) * 5 };
    }
    function arm(q) { var sn = Math.sin(2 * Math.PI * q); return { a: -18 * sn + 2, e: 14 + 16 * Math.max(0, -sn), w: 4 }; }
    return { lean: 4, head: 3, legN: leg(p), legF: leg(p + 0.5), armN: arm(p), armF: arm(p + 0.5) };
  }
  function runPose(p) {
    function leg(q) {
      q = ((q % 1) + 1) % 1;
      var t = 36 * Math.sin(2 * Math.PI * q) + 14;
      var x = ((q - 0.92 + 1.5) % 1) - 0.5, bump = Math.abs(x) < 0.32 ? Math.cos(Math.PI * x / 0.64) : 0;
      var k = 12 + 98 * bump, s = t - k;
      var w = q > 0.32 && q < 0.6 ? 1 : 0;
      return { t: t, k: k, af: w * (-s) + (1 - w) * -8 };
    }
    function arm(q) { var sn = Math.sin(2 * Math.PI * q); return { a: -34 * sn + 12, e: 88, w: 0 }; }
    return { lean: 14, head: -2, legN: leg(p), legF: leg(p + 0.5), armN: arm(p), armF: arm(p + 0.5) };
  }
  K.walkPose = walkPose; K.runPose = runPose;

  // ---------- geometry: angles → joints (H = 1, hip at origin, y down) ----------
  function joints(B, P) {
    var L = P.lean || 0, u = [Math.sin(L * D), -Math.cos(L * D)], f = [Math.cos(L * D), Math.sin(L * D)];
    var hip = [0, 0], J = { u: u, f: f, lean: L };
    J.hip = hip;
    function sp(s, off) { return [hip[0] + u[0] * B.spine * s + f[0] * off, hip[1] + u[1] * B.spine * s + f[1] * off]; }
    J.torso = [sp(-0.14, -B.butt), sp(0.02, B.belly * 0.92), sp(0.42, B.belly), sp(0.8, B.chest), sp(1.02, B.wNeck * 0.75),
      sp(1.02, -B.wNeck * 0.75), sp(0.8, -B.back), sp(0.38, -B.back * 0.8)];
    J.buttock = sp(-0.1, -B.butt * 0.55);
    J.shoulder = sp(0.95, -0.006);
    J.neckBase = sp(0.98, 0);
    var HA = L + (P.head || 0), uh = [Math.sin(HA * D), -Math.cos(HA * D)], fh = [Math.cos(HA * D), Math.sin(HA * D)];
    J.neckTop = add(J.neckBase, uh, B.neck);
    J.headC = add(add(J.neckTop, uh, B.hry * 0.82), fh, B.hrx * 0.18);
    J.headRot = HA; J.uh = uh; J.fh = fh;
    function leg(g) {
      var t = g.t, s = g.t - g.k, knee = add(hip, dir(t), B.thigh), ankle = add(knee, dir(s), B.shin);
      var fa = s + 90 + (g.af || 0), fd = dir(fa);
      return { knee: knee, ankle: ankle, heel: add(ankle, fd, -0.018), toe: add(ankle, fd, B.foot), hem: add(ankle, dir(s), -0.03), s: s };
    }
    J.legN = leg(P.legN); J.legF = leg(P.legF);
    function arm(g, back) {
      var sh = add(J.shoulder, f, back ? -0.008 : 0.004), aw = (g.a || 0) + L, el2 = add(sh, dir(aw), B.upper), fw = aw + (g.e || 0);
      var wr = add(el2, dir(fw), B.fore), tip = add(wr, dir(fw + (g.w || 0)), B.hand);
      return { sh: sh, elbow: el2, wrist: wr, tip: tip, fa: fw };
    }
    J.armN = arm(P.armN, false); J.armF = arm(P.armF, true);
    // ground: the lowest touching point sits on y = 0
    var pts = [[J.legN.heel, B.wFoot / 2], [J.legN.toe, B.wFoot / 2], [J.legF.heel, B.wFoot / 2], [J.legF.toe, B.wFoot / 2],
      [J.legN.knee, B.wThigh * 0.45], [J.legF.knee, B.wThigh * 0.45], [J.legN.ankle, B.wShin / 2], [J.legF.ankle, B.wShin / 2],
      [J.buttock, B.butt * (P.ground ? 1.05 : 0.5)], [J.armN.tip, B.wHand / 2], [J.armF.tip, B.wHand / 2],
      [add(J.headC, fh, B.hrx * 0.55), B.hry * 0.75]];
    var low = -1e9, xs = [];
    pts.forEach(function (p) { var y = p[0][1] + p[1]; if (y > low) low = y; });
    pts.forEach(function (p) { if (p[0][1] + p[1] > low - 0.012) xs.push(p[0][0]); });
    J.dy = -low;
    J.groundX = [Math.min.apply(null, xs), Math.max.apply(null, xs)];
    J.seatH = P.seat ? -(J.buttock[1] + B.butt * 0.5 + J.dy) : 0;
    return J;
  }

  // ---------- the parts, as path strings with a fixed structure per part ----------
  function T(J, H, p) { return [p[0] * H, (p[1] + J.dy) * H]; }
  function line(J, H, pts) { return K.poly(pts.map(function (p) { return T(J, H, p); }), false); }
  function local(J, x, y, B) {   // head-local (in head radii) → body units
    var c = Math.cos(J.headRot * D), s = Math.sin(J.headRot * D), lx = x * B.hrx, ly = y * B.hry;
    return [J.headC[0] + lx * c - ly * s, J.headC[1] + lx * s + ly * c];
  }
  var HEADWEAR = {
    kufi: function (J, B) { return { kind: "smooth", pts: [[0.86, -0.38], [0.8, -0.68], [0.5, -0.94], [0, -1.08], [-0.52, -0.97], [-0.88, -0.68], [-1.05, -0.3], [-0.4, -0.36], [0.3, -0.4]].map(function (p) { return local(J, p[0], p[1], B); }) }; },
    hair: function (J, B) { return { kind: "smooth", pts: [[0.62, -0.72], [0.32, -1.02], [-0.22, -1.05], [-0.78, -0.84], [-1.04, -0.38], [-0.98, 0.18], [-0.72, 0.42], [-0.56, 0.08], [-0.34, -0.34], [0.22, -0.6]].map(function (p) { return local(J, p[0], p[1], B); }) }; },
    hair_long: function (J, B) {
      var a = [[0.62, -0.72], [0.32, -1.04], [-0.22, -1.08], [-0.82, -0.86], [-1.1, -0.36]].map(function (p) { return local(J, p[0], p[1], B); });
      var b = [add(J.neckBase, J.f, -0.07), add(add(J.shoulder, J.u, -0.08), J.f, -0.06), add(J.neckBase, J.f, -0.02)];
      var c = [[-0.5, 0.2], [-0.3, -0.36], [0.24, -0.62]].map(function (p) { return local(J, p[0], p[1], B); });
      return { kind: "smooth", pts: a.concat(b, c) };
    },
    ghutra: function (J, B) {
      var a = [[0.7, -0.62], [0.46, -1.08], [-0.2, -1.16], [-1.1, -0.6], [-1.22, 0.24]].map(function (p) { return local(J, p[0], p[1], B); });
      var b = [add(J.neckBase, J.f, -0.085), add(add(J.shoulder, J.u, -0.13), J.f, -0.09), add(add(J.shoulder, J.u, -0.1), J.f, -0.02), add(add(J.shoulder, J.u, -0.05), J.f, 0.045)];
      var c = [[0.18, 0.96], [0.36, 0.3], [0.52, -0.28]].map(function (p) { return local(J, p[0], p[1], B); });
      return { kind: "smooth", pts: a.concat(b, c) };
    },
    hijab: function (J, B) {
      var a = [[0.66, -0.78], [0.2, -1.14], [-0.5, -1.1], [-1.14, -0.46], [-1.16, 0.36]].map(function (p) { return local(J, p[0], p[1], B); });
      var b = [add(J.neckBase, J.f, -0.07), add(add(J.shoulder, J.u, -0.06), J.f, -0.075), add(add(J.shoulder, J.u, -0.08), J.f, 0.06), add(add(J.neckBase, J.u, -0.03), J.f, 0.065)];
      var c = [[0.52, 0.98], [0.84, 0.32], [0.84, -0.36]].map(function (p) { return local(J, p[0], p[1], B); });
      return { kind: "smooth", pts: a.concat(b, c) };
    }
  };
  HEADWEAR.shemagh = HEADWEAR.ghutra;

  function parts(B, J, H, F) {
    var o = {}, N = J.legN, Fl = J.legF, AN = J.armN, AF = J.armF;
    var gx = J.groundX, cx = (gx[0] + gx[1]) / 2, rx = (gx[1] - gx[0]) / 2 + 0.07;
    o.shadow = K.ellipse(cx * H, 0, rx * H, 0.016 * H, 0);
    o.armF_up = line(J, H, [AF.sh, AF.elbow]); o.armF_fore = line(J, H, [AF.elbow, AF.wrist]); o.handF = line(J, H, [AF.wrist, AF.tip]);
    o.armN_up = line(J, H, [AN.sh, AN.elbow]); o.armN_fore = line(J, H, [AN.elbow, AN.wrist]); o.handN = line(J, H, [AN.wrist, AN.tip]);
    o.footF = line(J, H, [Fl.heel, Fl.toe]); o.footN = line(J, H, [N.heel, N.toe]);
    o.thighF = line(J, H, [J.hip, Fl.knee]); o.shinF = line(J, H, [Fl.knee, Fl.ankle]);
    o.thighN = line(J, H, [J.hip, N.knee]); o.shinN = line(J, H, [N.knee, N.ankle]);
    var robeTop = add(J.hip, J.u, 0.05);
    o.robeF = line(J, H, [robeTop, Fl.knee, Fl.hem]); o.robeN = line(J, H, [robeTop, N.knee, N.hem]);
    o.skirt = K.poly([add(J.hip, J.f, B.belly * 0.85), N.knee, N.hem, Fl.hem, Fl.knee, add(J.hip, J.f, -B.butt * 0.9)].map(function (p) { return T(J, H, p); }), true);
    o.torso = K.smooth(J.torso.map(function (p) { return T(J, H, p); }), true, 0.55);
    o.neck = line(J, H, [J.neckBase, J.neckTop]);
    o.head = K.ellipse(T(J, H, J.headC)[0], T(J, H, J.headC)[1], B.hrx * H, B.hry * H, J.headRot);
    if (F.head && HEADWEAR[F.head]) { var hw = HEADWEAR[F.head](J, B); o.headwear = K.smooth(hw.pts.map(function (p) { return T(J, H, p); }), true, 0.5); }
    if ((F.head === "ghutra" || F.head === "shemagh") && F.igal) o.igal = line(J, H, [local(J, 0.7, -0.6, B), local(J, 0.05, -0.98, B), local(J, -0.98, -0.62, B)]) + line(J, H, [local(J, 0.74, -0.46, B), local(J, 0.06, -0.84, B), local(J, -1.0, -0.48, B)]);
    if (F.head === "hijab") { var fc = T(J, H, local(J, 0.46, 0.06, B)); o.face = K.ellipse(fc[0], fc[1], B.hrx * 0.56 * H, B.hry * 0.74 * H, J.headRot); }
    if (F.hood) o.hood = K.ellipse(T(J, H, add(add(J.neckBase, J.f, -0.035), J.u, -0.005))[0], T(J, H, add(add(J.neckBase, J.f, -0.035), J.u, -0.005))[1], 0.05 * H, 0.032 * H, J.lean + 15);
    if (F.cloak) {   // the bisht: an open cloak from the shoulders to below the knee, a gold edge down the front
      var sp = B.spine, low = Math.max(N.knee[1], Fl.knee[1], J.hip[1] + 0.2) + 0.05;
      var backX = add(J.hip, J.f, -B.butt * 1.25), frontX = add(J.hip, J.f, B.belly * 0.35);
      var c0 = add(J.neckBase, J.f, -0.035), c1 = add(add(J.shoulder, J.f, -B.back * 1.3), J.u, -0.02), c2 = add(add(J.hip, J.u, 0.4 * sp), J.f, -B.back * 1.25);
      var c3 = [backX[0] - 0.02, Math.max(low, backX[1] + 0.06)], c4 = [frontX[0] + 0.01, Math.max(low, frontX[1] + 0.06)];
      var c5 = add(add(J.hip, J.u, 0.45 * sp), J.f, B.belly * 0.62), c6 = add(add(J.shoulder, J.f, B.chest * 0.55), J.u, 0.02);
      o.cloak = K.smooth([c0, c1, c2, c3, c4, c5, c6].map(function (p) { return T(J, H, p); }), true, 0.3);
      o.trim = line(J, H, [add(c6, J.f, 0.004), add(c5, J.f, 0.004), c4]);
    }
    // fold lines and the thobe's placket
    o.foldN = line(J, H, [add(J.hip, J.f, B.belly * 0.4), N.knee, N.hem]);
    o.placket = line(J, H, [add(add(J.neckBase, J.f, B.wNeck * 0.6), J.u, -0.005), add(add(J.shoulder, J.u, -0.1), J.f, B.chest * 0.98)]);
    // props
    var hc = [(AN.wrist[0] + AN.tip[0]) / 2, (AN.wrist[1] + AN.tip[1]) / 2], hf = [(AF.wrist[0] + AF.tip[0]) / 2, (AF.wrist[1] + AF.tip[1]) / 2];
    if (F.prop === "box") {
      var bc = [(hc[0] + hf[0]) / 2 + 0.035, (hc[1] + hf[1]) / 2 - 0.035], bs = 0.065;
      o.prop = K.poly([[bc[0] - bs, bc[1] - bs * 1.1], [bc[0] + bs, bc[1] - bs * 1.1], [bc[0] + bs, bc[1] + bs * 0.9], [bc[0] - bs, bc[1] + bs * 0.9]].map(function (p) { return T(J, H, p); }), true);
      o.prop2 = line(J, H, [[bc[0] - bs, bc[1] - bs * 0.2], [bc[0] + bs, bc[1] - bs * 0.2]]);
    }
    if (F.prop === "lantern") {
      var top = AN.tip, lc = [top[0], top[1] + 0.07];
      o.prop = K.poly([[lc[0] - 0.026, lc[1] - 0.04], [lc[0] + 0.026, lc[1] - 0.04], [lc[0] + 0.021, lc[1] + 0.035], [lc[0] - 0.021, lc[1] + 0.035]].map(function (p) { return T(J, H, p); }), true);
      o.prop2 = line(J, H, [top, [lc[0], lc[1] - 0.04]]);
      o.propGlow = K.ellipse(T(J, H, lc)[0], T(J, H, lc)[1], 0.16 * H, 0.16 * H, 0);
    }
    if (F.prop === "phone") {   // 1.7: a phone held in both hands, its screen lit; the cool glow is drawn at the hands (fig.glow)
      var pc = [(hc[0] + hf[0]) / 2 + 0.012, (hc[1] + hf[1]) / 2 - 0.022], pw = 0.02, ph = 0.036, bz = 0.0045;
      o.prop = K.poly([[pc[0] - pw, pc[1] - ph], [pc[0] + pw, pc[1] - ph], [pc[0] + pw, pc[1] + ph], [pc[0] - pw, pc[1] + ph]].map(function (p) { return T(J, H, p); }), true);
      o.propScreen = K.poly([[pc[0] - pw + bz, pc[1] - ph + bz], [pc[0] + pw - bz, pc[1] - ph + bz], [pc[0] + pw - bz, pc[1] + ph - bz * 2.2], [pc[0] - pw + bz, pc[1] + ph - bz * 2.2]].map(function (p) { return T(J, H, p); }), true);
      o.prop2 = line(J, H, [[pc[0] - pw * 0.4, pc[1] + ph - bz * 1.1], [pc[0] + pw * 0.4, pc[1] + ph - bz * 1.1]]);
      o.propGlow = K.ellipse(T(J, H, pc)[0], T(J, H, pc)[1], 0.15 * H, 0.15 * H, 0);
    }
    if (F.prop === "book") {
      var c2 = [(hc[0] + hf[0]) / 2 + 0.02, (hc[1] + hf[1]) / 2 - 0.02];
      o.prop = K.poly([[c2[0] - 0.05, c2[1] - 0.012], [c2[0], c2[1] + 0.012], [c2[0] + 0.05, c2[1] - 0.012], [c2[0] + 0.048, c2[1] + 0.02], [c2[0], c2[1] + 0.04], [c2[0] - 0.048, c2[1] + 0.02]].map(function (p) { return T(J, H, p); }), true);
      o.prop2 = line(J, H, [c2, [c2[0], c2[1] + 0.04]]);
    }
    if (F.seat) {
      var sh2 = J.seatH, bx = J.buttock[0];
      o.seat = K.smooth([[bx - 0.12, 0], [bx - 0.12, -sh2 * 0.85], [bx - 0.06, -sh2], [bx + 0.09, -sh2], [bx + 0.14, -sh2 * 0.8], [bx + 0.15, 0]].map(function (p) { return [p[0] * H, p[1] * H]; }), true, 0.3);
    }
    return o;
  }

  // ---------- joints you can read (1.7): where the hands, the head and the seat of a pose are ----------
  function bodyOf(who) { return BODY[who === "boy" || who === "girl" ? "child" : who] || BODY.man; }
  function poseOf(pose) {
    var P = typeof pose === "object" ? pose : POSES[pose || "stand"];
    if (!P) throw new Error("Khaam figure: no pose named " + pose);
    return P;
  }
  function mid2(a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; }
  /** every joint of a pose in px, for a figure of height H with its feet at y = 0 and facing right (+x = forward, y down) */
  function readPose(B, P, H) {
    var J = joints(B, P), AN = J.armN, AF = J.armF, pts = {
      handN: mid2(AN.wrist, AN.tip), handF: mid2(AF.wrist, AF.tip), tipN: AN.tip, tipF: AF.tip, wristN: AN.wrist, wristF: AF.wrist,
      elbowN: AN.elbow, elbowF: AF.elbow, shoulder: J.shoulder, hip: J.hip, buttock: J.buttock, headC: J.headC, neckBase: J.neckBase, neckTop: J.neckTop,
      kneeN: J.legN.knee, kneeF: J.legF.knee, ankleN: J.legN.ankle, ankleF: J.legF.ankle, toeN: J.legN.toe, toeF: J.legF.toe, heelN: J.legN.heel, heelF: J.legF.heel
    }, local = {};
    for (var k in pts) local[k] = T(J, H, pts[k]);
    return { local: local, foreN: AN.fa, foreF: AF.fa, seatH: J.seatH * H, buttockR: B.butt * H, headR: [B.hrx * H, B.hry * H], H: H, J: J };
  }
  /** Khaam.figureJoints("man", "carry_low", 430).local.handN → [x, y] px from the feet (y < 0 is above the ground) */
  K.figureJoints = function (who, pose, h) { return readPose(bodyOf(who || "man"), poseOf(pose), h || 1); };
  function easeFn(name) {
    if (typeof name === "function") return name;
    try { if (typeof gsap !== "undefined" && gsap.parseEase) { var f = gsap.parseEase(name || "none"); if (f) return f; } } catch (e) { /* linear below */ }
    return function (p) { return p; };
  }
  function n2(v) { return (Math.round(v * 100) / 100).toFixed(2); }

  // ---------- things a figure can hold (1.7): drawn in px around their grip point; draw(parent, fig) ----------
  // Each is painted with fig.tint so relight re-tints it; on paper (style "ink") it is a line drawing.
  function propPaint(fig, e, c, kind) {
    var S = fig.stage;
    if (fig.ink) {
      S.paint(e, "stroke", "ink");
      if (kind === "fill") { e.setAttribute("stroke-width", f1(Math.max(1.6, fig.H / 200))); S.paint(e, "fill", function (pal) { return pal.paper || "#fff"; }); }
      return;
    }
    if (kind === "fill") {
      S.paint(e, "fill", fig.tint(c));
      S.paint(e, "stroke", function (pal) { return K.shade(fig.tint(c)(pal), -0.5); });
      e.setAttribute("stroke-width", f1(Math.max(1.2, fig.H / 190)));
      e.setAttribute("stroke-opacity", "0.75");
    } else S.paint(e, "stroke", fig.tint(c, kind));
  }
  var HELD = {
    /** a clay jug, its body centre at (0, 0): by its neck in the near hand, in both hands for carry, carry_low, pour (tilted 100) and stoop_pour (70).
        Add your own thing the same way: Khaam.held.name = {opt: function (fig) {return {hand, grip, rot, poses}}, draw: function (g, fig) {…}} */
    jug: {
      opt: function (fig) {
        var H = fig.H;
        return { hand: "near", grip: [0, -0.068 * H], rot: 0, poses: {
          pour: { hand: "both", grip: [0, -0.012 * H], rot: 100 }, stoop_pour: { hand: "both", grip: [0, 0], rot: 70 },
          carry: { hand: "both", grip: [0, 0.03 * H] }, carry_low: { hand: "both", grip: [0, 0.03 * H] } } };
      },
      draw: function (g, fig) {
        var u = fig.H, P = function (pts, closed) { return K.smooth(pts.map(function (p) { return [p[0] * u, p[1] * u]; }), closed, 0.5); };
        var body = el("path", { d: P([[0.026, -0.046], [0.05, -0.012], [0.046, 0.034], [0.018, 0.056], [-0.018, 0.056], [-0.046, 0.034], [-0.05, -0.012], [-0.026, -0.046]], true), "stroke-linejoin": "round" }, g);
        propPaint(fig, body, "#a8683f", "fill");
        var neck = el("path", { d: K.poly([[-0.016, -0.046], [-0.014, -0.066], [-0.021, -0.074], [0.021, -0.074], [0.014, -0.066], [0.016, -0.046]].map(function (p) { return [p[0] * u, p[1] * u]; }), true), "stroke-linejoin": "round" }, g);
        propPaint(fig, neck, "#94593a", "fill");
        if (!fig.ink) { var band = el("path", { d: P([[-0.044, -0.004], [0, 0.004], [0.044, -0.004]], false), fill: "none", "stroke-width": f1(Math.max(1, u / 260)) }, g); propPaint(fig, band, "#a8683f", "dark"); band.style.opacity = 0.6; }
        return g;
      }
    },
    /** a hoe: the grip at (0, 0), the handle along +x to the blade at its end (the blade bends back toward +y) */
    hoe: {
      opt: function (fig) {
        var H = fig.H;
        return { hand: "near", grip: [0, 0], rot: 64, poses: {
          dig_up: { rot: -120 }, dig_down: { aim: [0.5, 0] }, lean_hoe: { hand: "both", rot: 90, grip: [-0.12 * H, 0] },
          stand: { rot: 90, grip: [0.1 * H, 0] } } };
      },
      draw: function (g, fig) {
        var u = fig.H, a = -0.12 * u, b = 0.52 * u, sw = Math.max(2.4, u / 72);
        if (!fig.ink) {
          var edge = el("path", { d: "M" + f1(a) + " 0L" + f1(b) + " 0", fill: "none", "stroke-width": f1(sw + 2 * Math.max(1.2, u / 190)), "stroke-linecap": "round" }, g);
          fig.stage.paint(edge, "stroke", function (pal) { return K.shade(fig.tint("#8a6240")(pal), -0.5); }); edge.style.opacity = 0.75;
        }
        var shaft = el("path", { d: "M" + f1(a) + " 0L" + f1(b) + " 0", fill: "none", "stroke-width": f1(sw), "stroke-linecap": "round" }, g);
        propPaint(fig, shaft, "#8a6240", "stroke");
        var blade = el("path", { d: K.poly([[b - 0.006 * u, -0.012 * u], [b + 0.018 * u, -0.012 * u], [b + 0.004 * u, 0.09 * u], [b - 0.05 * u, 0.078 * u]], true), "stroke-linejoin": "round" }, g);
        propPaint(fig, blade, "#7d7a76", "fill");
        return g;
      }
    },
    /** a box held at its bottom-back corner region, so it sits on the hands and rises in front of the chest */
    box_held: {
      opt: function (fig) { return { hand: "both", grip: [-0.02 * fig.H, 0.05 * fig.H], rot: 0 }; },
      draw: function (g, fig) {
        var u = fig.H, w = 0.15 * u, h = 0.11 * u;
        var bx = el("path", { d: K.poly([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]], true), "stroke-linejoin": "round" }, g);
        propPaint(fig, bx, "#b08a5c", "fill");
        var tape = el("path", { d: "M" + f1(-w / 2) + " " + f1(-h * 0.1) + "H" + f1(w / 2), fill: "none", "stroke-width": f1(Math.max(1, u / 220)) }, g);
        propPaint(fig, tape, "#b08a5c", "dark");
        return g;
      }
    }
  };
  K.held = HELD;

  // ---------- building a figure ----------
  K.piece("figure", function (S, o) {
    var who = o.who || "man", B = BODY[who === "boy" || who === "girl" ? "child" : who] || BODY.man;
    var H = o.h || (who === "boy" || who === "girl" ? 220 : who === "woman" ? 318 : 334);
    var defOutfit = who === "woman" ? "abaya" : who === "girl" ? "dress" : "thobe";
    var outfitName = o.outfit || defOutfit, OF = OUTFIT[outfitName] || OUTFIT.thobe, cols = o.colors || {};
    var headName = o.head === undefined ? (who === "woman" || who === "girl" ? "hijab" : outfitName === "modern" || outfitName === "shirt" ? "hair" : "kufi") : o.head;
    var skin = SKIN[o.skin] || o.skin || SKIN.tan, ink = o.style === "ink";
    // 1.7: the igal only when asked (igal: true); a plain ghutra or shemagh by default (at video size the strokes read as a black triangle)
    var F = { head: headName === "none" ? null : headName, hood: OF.hood && !(headName === "hijab"), cloak: !!OF.cloak, prop: o.prop, seat: o.seat, igal: o.igal === true };
    var mat = {
      skin: cols.skin || skin, robe: cols.robe || OF.robe || OF.top, top: cols.top || OF.top || OF.robe, bottom: cols.bottom || OF.bottom || OF.robe,
      shoes: cols.shoes || OF.shoes, head: cols.head || HEADC[headName] || "#222", igal: HEADC.igal, cloak: cols.cloak || OF.cloak, trim: cols.trim || OF.trim,
      prop: cols.prop || (o.prop === "lantern" ? "#7a5a3a" : o.prop === "book" ? "#ece4d2" : o.prop === "phone" ? "#23262e" : "#b08a5c"), seat: cols.seat || "#5a4a44"
    };
    var robeKind = OF.kind === "robe";
    var facing = o.facing === "left" ? -1 : 1, x = o.x === undefined ? 540 : o.x, y = o.y === undefined ? S.horizon + 260 : o.y;
    var wrapG = el("g", { "data-figure": who }, S.L(o.layer || "actors"));
    var inner = el("g", { transform: "translate(" + f1(x) + " " + f1(y) + ") scale(" + facing + " 1)" }, wrapG);

    // colour: the base colour seen in this scene's light (re-tinted by relight)
    var paper = S.pal.paper;
    function tint(c, k) {
      return function (pal) {
        if (ink) return k === "far" ? (pal.paperEdge || "#ddd") : (pal.paper || "#fff");
        var t = K.mix(c, pal.ambient || "#888", pal.ambientK || 0);
        return k === "far" ? K.shade(t, -0.2) : k === "lit" ? K.mix(t, pal.light || "#fff", 0.16) : k === "dark" ? K.shade(t, -0.3) : t;
      };
    }
    // light side in the figure's own coordinates (o.light: this figure's own light, e.g. the candle beside it; default the stage's)
    var LS = o.light || S.light;
    var lx = (LS.x - x) * facing, ly = LS.y - (y - H * 0.6), ll = Math.max(1, Math.sqrt(lx * lx + ly * ly));
    var litFront = lx > 0, grads = [];
    function shadeGrad(c) {
      var id = S.id("fg"), g = el("linearGradient", { id: id, gradientUnits: "userSpaceOnUse", x1: f1(-0.14 * H), y1: 0, x2: f1(0.14 * H), y2: 0 }, S.defs);
      grads.push(g);
      var a = el("stop", { offset: 0 }, g), b = el("stop", { offset: 0.55 }, g), d = el("stop", { offset: 1 }, g);
      S.paint(a, "stop", tint(c, litFront ? "dark" : "lit")); S.paint(b, "stop", tint(c)); S.paint(d, "stop", tint(c, litFront ? "lit" : "dark"));
      return "url(#" + id + ")";
    }
    var G = { robe: shadeGrad(mat.robe), top: shadeGrad(mat.top), cloak: mat.cloak ? shadeGrad(mat.cloak) : null };
    function shemaghPattern() {   // the red-and-white check of a shemagh, small and quiet
      var id = S.id("sh"), k = Math.max(5, H / 52), p = el("pattern", { id: id, width: f1(k), height: f1(k), patternUnits: "userSpaceOnUse", patternTransform: "rotate(" + (30 * facing) + ")" }, S.defs);
      var bgr = el("rect", { width: f1(k), height: f1(k) }, p); S.paint(bgr, "fill", tint(mat.head));
      var ln = el("path", { d: "M0 " + f1(k / 2) + "H" + f1(k) + "M" + f1(k / 2) + " 0V" + f1(k), "stroke-width": f1(k * 0.16) }, p); S.paint(ln, "stroke", tint("#f1ece4")); ln.style.opacity = 0.75;
      return "url(#" + id + ")";
    }

    var P0 = typeof o.pose === "object" ? o.pose : (POSES[o.pose || "stand"] || POSES.stand);
    var J0 = joints(B, P0), D0 = parts(B, J0, H, F);
    var ow = o.outline === undefined ? (ink ? 2.6 : Math.max(1.2, H / 190)) : o.outline, inkC = ink ? (S.pal.ink || "#222") : null;

    // part list: name, kind (stroke width in body units | "fill"), material, group, shade variant
    var sleeve = robeKind ? "robe" : "top";
    var list = [
      ["armF_up", B.wUpper * (robeKind ? 1.12 : 1), sleeve, "far", "far"], ["armF_fore", B.wFore * (robeKind ? 1.15 : 1), sleeve, "far", "far"], ["handF", B.wHand, "skin", "far", "far"],
      ["footF", B.wFoot, "shoes", "far", "far"]
    ];
    if (!robeKind) list.push(["thighF", B.wThigh, "bottom", "far", "far"], ["shinF", B.wShin, "bottom", "far", "far"]);
    list.push(["footN", B.wFoot, "shoes", "body"]);
    if (F.seat) list.unshift(["seat", "fill", "seat", "far"]);
    if (robeKind) list.push(["robeF", B.wRobe, "robe", "body", "grad"], ["skirt", "fill", "robe", "body", "grad"], ["robeN", B.wRobe, "robe", "body", "grad"]);
    list.push(["torso", "fill", robeKind ? "robe" : "top", "body", "grad"]);
    if (!robeKind) list.push(["thighN", B.wThigh, "bottom", "nearleg"], ["shinN", B.wShin, "bottom", "nearleg"]);
    if (F.hood) list.push(["hood", "fill", "top", "body", "far"]);
    if (F.cloak) list.push(["cloak", "fill", "cloak", "body", "gradc"]);
    list.push(["neck", B.wNeck, "skin", "head"], ["head", "fill", "skin", "head"]);
    if (F.head) list.push(["headwear", "fill", "head", "head"]);
    if (F.head === "hijab") list.push(["face", "fill", "skin", "head"]);
    list.push(["armN_up", B.wUpper * (robeKind ? 1.12 : 1), F.cloak ? "cloak" : sleeve, "near"], ["armN_fore", B.wFore * (robeKind ? 1.15 : 1), sleeve, "near"], ["handN", B.wHand, "skin", "near"]);
    if (o.prop) list.push(["prop", "fill", "prop", "near"], ["prop2", 0.008, "prop", "near", "dark"]);

    var defsG = el("g", null, S.defs), paths = {}, ids = {};
    function mkPath(name) { var id = S.id("fp"); ids[name] = id; paths[name] = el("path", { id: id, d: D0[name] }, defsG); }
    Object.keys(D0).forEach(mkPath);

    var shadow = el("use", { href: "#" + ids.shadow }, inner); S.paint(shadow, "fill", "ink"); shadow.style.opacity = o.shadow === undefined ? (ink ? 0.12 : 0.32) : o.shadow;
    // the rim: a copy of the body pushed toward the light, under the outline. Only what passes the outline shows,
    // so the default push is the outline's width plus a clear band (rim.width, when given, is the whole push).
    var rimG = null, rk = 0;
    function rimShift(side) { return "translate(" + f1((LS.x - x) * side / ll * rk) + " " + f1(ly / ll * rk) + ")"; }
    if (!ink && o.rim !== false) {
      rk = (o.rim && o.rim.width) || ow + Math.max(2, H / 120);
      rimG = el("g", { transform: rimShift(facing) }, inner);
    }
    var groups = {}; ["far", "body", "nearleg", "head", "near"].forEach(function (n) { groups[n] = { ol: el("g", null, inner), fi: null }; groups[n].fi = el("g", null, inner); });
    var detail = el("g", null, inner);

    list.forEach(function (p) {
      var name = p[0], kind = p[1], m = p[2], grp = groups[p[3]], variant = p[4], c = mat[m];
      if (!paths[name]) return;
      var href = "#" + ids[name], isFill = kind === "fill", w = isFill ? 0 : kind * H;
      var ol = el("use", { href: href, "stroke-linecap": isFill ? null : (name.indexOf("robe") === 0 ? "butt" : "round"), "stroke-linejoin": "round" }, ink ? grp.fi : grp.ol);   // ink: line by line, so inner lines show
      ol.setAttribute("fill", isFill || name.indexOf("robe") === 0 ? "currentColor" : "none");
      ol.setAttribute("stroke-width", f1(w + ow * 2));
      var olSpec = function (pal) { return ink ? pal.ink : K.shade(tint(c)(pal), -0.5); };
      S.paint(ol, "stroke", olSpec);
      S.paint(ol, "color", olSpec);
      ol.style.opacity = ink ? 1 : 0.75;
      var fi = el("use", { href: href, "stroke-linecap": isFill ? null : (name.indexOf("robe") === 0 ? "butt" : "round"), "stroke-linejoin": "round" }, grp.fi);
      var spec = variant === "far" ? tint(c, "far") : variant === "dark" ? tint(c, "dark") : tint(c);
      var gradUrl = variant === "grad" ? (m === "robe" ? G.robe : G.top) : variant === "gradc" ? G.cloak : null;
      if (name === "headwear" && F.head === "shemagh" && !ink) gradUrl = shemaghPattern();
      if (isFill) { if (gradUrl && !ink) fi.setAttribute("fill", gradUrl); else S.paint(fi, "fill", spec); }
      else {
        fi.setAttribute("stroke-width", f1(w));
        if (gradUrl && !ink) { fi.setAttribute("stroke", gradUrl); fi.setAttribute("fill", name.indexOf("robe") === 0 ? gradUrl : "none"); }
        else { S.paint(fi, "stroke", spec); fi.setAttribute("fill", "none"); }
      }
      if (rimG && ["torso", "robeF", "robeN", "head", "headwear", "thighN", "shinN", "thighF", "shinF", "armN_up", "armN_fore", "cloak", "hood"].indexOf(name) >= 0) {
        // round joins (1.7): a miter on a sharply bent robe stroke (a folded knee) threw a long spike of rim toward the light
        var rm = el("use", { href: href, "stroke-linecap": isFill ? null : (name.indexOf("robe") === 0 ? "butt" : "round"), "stroke-linejoin": "round" }, rimG);
        if (isFill || name.indexOf("robe") === 0) S.paint(rm, "fill", "rim"); else rm.setAttribute("fill", "none");
        if (!isFill) { rm.setAttribute("stroke-width", f1(w)); S.paint(rm, "stroke", "rim"); }
      }
    });
    if (rimG) S.level(rimG, "rimLevel", o.rim && o.rim.strength !== undefined ? o.rim.strength : 0.9);
    // details: folds, placket, trims, igal
    function det(name, width, spec, op) {
      if (!paths[name]) return null;
      var d = el("use", { href: "#" + ids[name], fill: "none", "stroke-width": f1(width), "stroke-linecap": "round", "stroke-linejoin": "round" }, name === "igal" ? groups.head.fi : detail);
      S.paint(d, "stroke", spec); d.style.opacity = op; return d;
    }
    if (robeKind && !ink) { det("foldN", Math.max(1, H / 260), tint(mat.robe, "dark"), 0.45); if (who === "man" || who === "boy") det("placket", Math.max(1, H / 280), tint(mat.robe, "dark"), 0.5); }
    if (F.cloak) det("trim", Math.max(2, H / 120), tint(mat.trim), 1);
    if ((F.head === "ghutra" || F.head === "shemagh") && F.igal) det("igal", Math.max(2.2, H / 105), ink ? inkC : tint(mat.igal), 1);
    var glowEl = null;
    if (o.prop === "lantern" && paths.propGlow) {
      glowEl = el("use", { href: "#" + ids.propGlow }, inner); glowEl.setAttribute("fill", S.rgrad([[0, "warmGlow", 0.55], [1, "warmGlow", 0]]));
      glowEl.style.mixBlendMode = "screen"; S.level(glowEl, "lamp", o.glow === undefined ? 1 : o.glow);
      var gl2 = el("use", { href: "#" + ids.prop }, inner); S.paint(gl2, "fill", "warm"); gl2.style.opacity = 0.85;
    }
    if (o.prop === "phone" && paths.propGlow) {   // 1.7: the screen's soft cool light at the hands; raise fig.glow's opacity as the room darkens
      glowEl = el("use", { href: "#" + ids.propGlow }, inner); glowEl.setAttribute("fill", S.rgrad([[0, "#d6e6ff", 0.5], [0.4, "#bcd4ff", 0.16], [1, "#bcd4ff", 0]]));
      glowEl.style.mixBlendMode = "screen"; glowEl.style.opacity = o.glow === undefined ? 1 : o.glow;
      var scr = el("use", { href: "#" + ids.propScreen }, inner); scr.style.fill = ink ? (S.pal.paper || "#fff") : "#e2ecff"; scr.style.opacity = 0.95;
    }

    var fig = { el: wrapG, inner: inner, H: H, x: x, y: y, facing: facing, B: B, F: F, paths: paths, pose0: P0, stage: S, current: P0, t: 0,
      glow: glowEl, ink: ink, tint: tint, holds: [] };
    S.figures.push(fig);

    // 1.7: what the figure does over time is logged, so held things follow every pose and at()/reach() know where he is
    var poseLog = [], moveLog = [], faceLog = [];
    function byAt(a, b) { return a.at - b.at; }
    function nameOf(P) { for (var k in POSES) if (POSES[k] === P) return k; return null; }
    /** the pose change in effect at time t (the last one that starts at or before t; the first pose before any) */
    function poseAt(t) {
      var best = null;
      for (var i = 0; i < poseLog.length; i++) if (poseLog[i].at <= t + 1e-6 && (!best || poseLog[i].at >= best.at)) best = poseLog[i];
      return best || { at: -1, dur: 0, ease: "none", P: P0, name: typeof o.pose === "string" ? o.pose : nameOf(P0) };
    }
    /** where the figure stands at time t: its move() offset and its facing (moves made with fig.move only) */
    function stateAt(t) {
      var dx = 0, dy = 0, fc = facing;
      moveLog.slice().sort(byAt).forEach(function (m) {
        if (m.at > t + 1e-6) return;
        var e = easeFn(m.ease)(m.dur > 0 ? Math.min(1, (t - m.at) / m.dur) : 1);
        if (m.x !== undefined) dx += (m.x - dx) * e;
        if (m.y !== undefined) dy += (m.y - dy) * e;
      });
      faceLog.slice().sort(byAt).forEach(function (f) { if (f.at <= t + 1e-6) fc = f.s; });
      return { dx: dx, dy: dy, facing: fc };
    }
    var minor = 0;   // walk, run and alternate keys are "minor": they do not end an h.set()
    function logPose(k) { if (minor) k.minor = true; poseLog.push(k); fig.holds.forEach(function (h) { follow(h, k); }); }
    function majorAt(t) {
      var best = null;
      for (var i = 0; i < poseLog.length; i++) if (!poseLog[i].minor && poseLog[i].at <= t + 1e-6 && (!best || poseLog[i].at >= best.at)) best = poseLog[i];
      return best ? best.at : -1;
    }

    /** morph to a pose (by name or angles) */
    fig.pose = function (pose, opt) {
      opt = opt || {};
      var P = typeof pose === "object" ? pose : POSES[pose];
      if (!P) throw new Error("Khaam figure: no pose named " + pose);
      var Dn = parts(B, joints(B, P), H, F), at = opt.at || 0, dur = opt.dur === undefined ? 0.8 : opt.dur, ease = opt.ease || "power2.inOut";
      for (var n in Dn) if (paths[n]) S.tl.to(paths[n], { attr: { d: Dn[n] }, duration: dur, ease: ease }, at);
      logPose({ at: at, dur: dur, ease: ease, P: P, name: typeof pose === "string" ? pose : nameOf(P) });
      fig.current = P; return fig;
    };
    /** a small repeated action: a, b, a, b … every `every` s (typing 0.15, scrolling 0.42, talking 0.62). {at, dur, every, morph, ease, then} */
    fig.alternate = function (a, b, opt) {
      opt = opt || {};
      var at = opt.at || 0, dur = opt.dur === undefined ? S.duration - at : opt.dur, every = opt.every || 0.5;
      var morph = opt.morph === undefined ? Math.min(every * 0.7, 0.45) : opt.morph, ease = opt.ease || "sine.inOut";
      minor++;
      for (var i = 0, t = at; t < at + dur - 1e-3; i++, t = at + i * every) fig.pose(i % 2 ? b : a, { at: t, dur: Math.min(morph, at + dur - t), ease: ease });
      minor--;
      if (opt.then) fig.pose(opt.then, { at: at + dur, dur: opt.thenDur || 0.4 });
      return fig;
    };
    /** arms for a walk: a pose name (its arms), "keep" (the arms of the pose in effect), or {armN, armF} (either may be left out) */
    function armsFor(spec, at) {
      if (!spec) return null;
      if (spec === "keep") { var Q = poseAt(at).P; return { armN: Q.armN, armF: Q.armF }; }
      if (typeof spec === "string") { var R = POSES[spec]; if (!R) throw new Error("Khaam figure: no pose named " + spec); return { armN: R.armN, armF: R.armF }; }
      return spec;
    }
    function cycle(fn, opt) {
      opt = opt || {};
      var at = opt.at || 0, dur = opt.dur === undefined ? S.duration - at : opt.dur, cyc = opt.cycle || (fn === runPose ? 0.62 : 1.05), keys = opt.keys || 10;
      var step = cyc / keys, t = at, i = opt.phase ? Math.round(opt.phase * keys) : 0, first = true, arms = armsFor(opt.arms, at);
      while (t < at + dur - 1e-3) {
        var d = Math.min(step, at + dur - t), P = fn(((i + 1) % keys) / keys, opt), dd = first && opt.blend ? opt.blend : d;
        if (arms) { if (arms.armN) P.armN = arms.armN; if (arms.armF) P.armF = arms.armF; }   // 1.7: the legs walk, the arms keep holding
        if (opt.lean !== undefined) P.lean = opt.lean;
        if (opt.head !== undefined) P.head = opt.head;
        var Dn = parts(B, joints(B, P), H, F);
        for (var n in Dn) if (paths[n]) S.tl.to(paths[n], { attr: { d: Dn[n] }, duration: dd, ease: "none" }, t);
        minor++; logPose({ at: t, dur: dd, ease: "none", P: P, name: null }); minor--;
        t += dd; i++; first = false;
      }
      if (opt.then) fig.pose(opt.then, { at: at + dur, dur: opt.thenDur || 0.45 });
      fig.speed = speedOf(fn, cyc, opt);
      return fig;
    }
    // ground speed: how fast the planted foot slides back (the world must slide at this speed so feet don't skate)
    function speedOf(fn, cyc, opt) {
      var Ja = joints(B, fn(0.32, opt)), Jb = joints(B, fn(0.66, opt));
      return Math.abs(Ja.legN.ankle[0] - Jb.legN.ankle[0]) * H / (0.34 * cyc);
    }
    fig.walk = function (opt) { return cycle(walkPose, opt); };
    fig.run = function (opt) { return cycle(runPose, opt); };
    /** the ground speed (px/s) a walk or run of this figure needs, before you call walk(): for stage.track({speed}) */
    fig.speedFor = function (kind, opt) { opt = opt || {}; return kind === "run" ? speedOf(runPose, opt.cycle || 0.62, opt) : speedOf(walkPose, opt.cycle || 1.05, opt); };
    /** slide the whole figure: {x: new x, y, at, dur, ease} */
    fig.move = function (opt) {
      var v = { duration: opt.dur === undefined ? 1 : opt.dur, ease: opt.ease || "none" };
      if (opt.x !== undefined) v.x = opt.x - x;
      if (opt.y !== undefined) v.y = opt.y - y;
      S.tl.to(wrapG, v, opt.at || 0);
      moveLog.push({ at: opt.at || 0, dur: v.duration, ease: v.ease, x: v.x, y: v.y });
      fig.holds.forEach(function (h) { if (h.to !== Infinity) rebuild(h); });   // a thing let go lands where he stands
      return fig;
    };
    /** turn around at a time (the rim and the lit side stay on the light's side) */
    fig.face = function (side, at) {
      var s = side === "left" ? -1 : 1, m = s * facing;
      S.tl.set(inner, { attr: { transform: "translate(" + f1(x) + " " + f1(y) + ") scale(" + s + " 1)" } }, at || 0);
      if (rimG) S.tl.set(rimG, { attr: { transform: rimShift(s) } }, at || 0);
      grads.forEach(function (g) { S.tl.set(g, { attr: { x1: f1(-0.14 * H * m), x2: f1(0.14 * H * m) } }, at || 0); });
      faceLog.push({ at: at || 0, s: s });
      fig.holds.forEach(function (h) { if (h.to !== Infinity) rebuild(h); });
      return fig;
    };
    fig.appear = function (opt) { opt = opt || {}; S.tl.fromTo(wrapG, { opacity: 0 }, { opacity: 1, duration: opt.dur || 0.6, ease: "power1.out" }, opt.at || 0); return fig; };

    // ---------- 1.7: joints, hands and things held ----------
    /** every joint of a pose: .local (px, his own space: +x = the way he faces, feet at 0) and .stage (px on the stage, at his start
        place and facing, or where fig.move/fig.face have put him by opt.at). Also foreN/foreF (forearm angles), seatH, buttockR, headR.
        names: handN handF (palm centres) tipN tipF wristN wristF elbowN elbowF shoulder hip buttock headC neckBase neckTop kneeN kneeF ankleN ankleF toeN toeF heelN heelF */
    fig.at = function (pose, opt) {
      opt = opt || {};
      var P = pose === undefined || pose === null ? poseAt(opt.at || 0).P : poseOf(pose);
      var R = readPose(B, P, H), st = opt.at === undefined ? { dx: 0, dy: 0, facing: facing } : stateAt(opt.at);
      var out = { local: R.local, stage: {}, foreN: R.foreN, foreF: R.foreF, seatH: R.seatH, buttockR: R.buttockR, headR: R.headR };
      for (var k in R.local) out.stage[k] = [x + st.dx + st.facing * R.local[k][0], y + st.dy + R.local[k][1]];
      return out;
    };
    /** the stage point of a hand in a pose: the palm centre (where a held thing sits), or the fingertips with {tip: true}. which: near | far */
    fig.handAt = function (pose, which, opt) {
      opt = opt || {};
      var A = fig.at(pose, opt), far = which === "far" || which === "F";
      return A.stage[opt.tip ? (far ? "tipF" : "tipN") : (far ? "handF" : "handN")];
    };
    /** put a hand on a stage point: the two arm angles are solved (the elbow bends forward), the rest of the pose stays.
        {x, y, at, dur, ease, hand: near|far, tip, from: a pose to start from}. fig.reached.err = how far off it lands (px; > 0 when out of reach). */
    fig.reach = function (opt) {
      opt = opt || {};
      var at = opt.at || 0, side = opt.hand === "far" || opt.hand === "F" ? "armF" : "armN", P = {}, k;
      var base = opt.from ? poseOf(opt.from) : poseAt(at).P;
      for (k in base) P[k] = base[k];
      var st = stateAt(at), L1 = B.upper, L2 = B.fore + (opt.tip ? B.hand : B.hand / 2);
      function cl(v) { return Math.max(-1, Math.min(1, v)); }
      for (var it = 0; it < 4; it++) {   // the ground offset depends on the arm, so solve a few times
        var J = joints(B, P), sh = J[side].sh;
        var vx = (opt.x - x - st.dx) * st.facing / H - sh[0], vy = (opt.y - y - st.dy) / H - J.dy - sh[1];
        var dd = Math.max(Math.abs(L1 - L2) + 1e-4, Math.min(L1 + L2 - 1e-4, Math.sqrt(vx * vx + vy * vy)));
        var th = Math.atan2(vx, vy) / D, al = Math.acos(cl((L1 * L1 + dd * dd - L2 * L2) / (2 * L1 * dd))) / D;
        var be = Math.acos(cl((L1 * L1 + L2 * L2 - dd * dd) / (2 * L1 * L2))) / D;
        P[side] = { a: th - al - (P.lean || 0), e: 180 - be, w: 0 };
      }
      var R = readPose(B, P, H), hp = R.local[(opt.tip ? "tip" : "hand") + (side === "armN" ? "N" : "F")];
      var ex = x + st.dx + st.facing * hp[0] - opt.x, ey = y + st.dy + hp[1] - opt.y;
      fig.pose(P, { at: at, dur: opt.dur === undefined ? 0.6 : opt.dur, ease: opt.ease });
      fig.reached = { pose: P, err: Math.sqrt(ex * ex + ey * ey) };
      return fig;
    };

    // a held thing: a group inside him (so it turns and moves with him), its transform tweened with every pose change
    function gripOf(g) { return !g ? [0, 0] : g.length !== undefined ? [g[0] || 0, g[1] || 0] : [g.x || 0, g.y || 0]; }
    function cleanOpt(src) { var out = {}; for (var k in src) if (k !== "at" && k !== "take" && k !== "over" && k !== "poses") out[k] = k === "grip" ? gripOf(src[k]) : src[k]; return out; }
    /** how it is held at time t in a pose: the defaults (and h.set(…, {keep: true}) made before this pose), then the pose's own
        entry, then any h.set made since this pose began (a plain set lasts until the next pose change) */
    function optsFor(h, name, t) {
      var p = {}, k, i, ks = majorAt(t), s;
      for (k in h.base) p[k] = h.base[k];
      for (i = 0; i < h.sets.length; i++) { s = h.sets[i]; if (s.keep && s.at < ks - 1e-6) for (k in s.opt) p[k] = s.opt[k]; }
      if (name && h.poses[name]) for (k in h.poses[name]) p[k] = h.poses[name][k];
      for (i = 0; i < h.sets.length; i++) { s = h.sets[i]; if (s.at <= t + 1e-6 && s.at >= ks - 1e-6) for (k in s.opt) p[k] = s.opt[k]; }
      return p;
    }
    function placeOf(h, P, name, t) {
      var p = optsFor(h, name, t), R = readPose(B, P, H), L = R.local;
      var G = p.hand === "far" ? L.handF : p.hand === "both" ? mid2(L.handN, L.handF) : L.handN, rot = p.rot || 0;
      if (p.aim) rot = Math.atan2(p.aim[1] * H - G[1], p.aim[0] * H - G[0]) / D;
      else if (p.along === "hands") {
        var vx = L.handN[0] - L.handF[0], vy = L.handN[1] - L.handF[1];
        if (Math.sqrt(vx * vx + vy * vy) > 0.04 * H) rot = Math.atan2(vy, vx) / D + (p.rot || 0);
      }
      var g = p.grip || [0, 0];
      return [G[0], G[1], rot, -g[0], -g[1]];
    }
    // the angle turns the way the numbers go (the hoe from 90 to -120 swings forward and up over him, never back through his legs)
    function tr(v) { return "translate(" + n2(v[0]) + " " + n2(v[1]) + ") rotate(" + n2(v[2]) + ") translate(" + n2(v[3]) + " " + n2(v[4]) + ")"; }
    function holdAt(h, t) {   // its place at time t, part way through a pose change if one is running
      var k = poseAt(t), v1 = placeOf(h, k.P, k.name, t);
      if (k.at >= 0 && k.dur > 0 && t < k.at + k.dur - 1e-6) {
        var k0 = poseAt(k.at - 1e-4), v0 = placeOf(h, k0.P, k0.name, k.at - 1e-4), s = easeFn(k.ease)((t - k.at) / k.dur);
        return v0.map(function (a, i) { return a + (v1[i] - a) * s; });
      }
      return v1;
    }
    function step(h, at, dur, ease, k) {
      var kk = k || poseAt(at), v = placeOf(h, kk.P, kk.name, at + 1e-6);
      h.tweens.push(S.tl.fromTo(h.inner, { attr: { transform: tr(h.last) } }, { attr: { transform: tr(v) }, duration: dur, ease: ease, immediateRender: false }, at));
      h.last = v; h.lastAt = at;
    }
    function rebuild(h) {
      h.tweens.forEach(function (tw) { S.tl.remove(tw); }); h.tweens = [];
      var v = holdAt(h, h.from);
      h.tweens.push(S.tl.set(h.inner, { attr: { transform: tr(v) } }, h.from));
      if (h.from <= 0) h.inner.setAttribute("transform", tr(v));
      h.last = v; h.lastAt = h.from;
      var k0 = poseAt(h.from);   // a pose change still running when it comes into the hand finishes with it
      if (k0.at >= 0 && h.from > k0.at + 1e-6 && h.from < k0.at + k0.dur - 1e-6) step(h, h.from, k0.at + k0.dur - h.from, "none", k0);
      var evs = [];
      poseLog.forEach(function (k) { if (k.at > h.from + 1e-6 && k.at < h.to - 1e-6) evs.push({ at: k.at, dur: k.dur, ease: k.ease, k: k }); });
      h.sets.forEach(function (s) {
        if (s.at <= h.from + 1e-6 || s.at >= h.to - 1e-6) return;
        for (var i = 0; i < evs.length; i++) if (evs[i].k && Math.abs(evs[i].at - s.at) < 1e-3) return;   // rides on the pose change
        evs.push({ at: s.at, dur: s.dur, ease: s.ease, k: null });
      });
      evs.sort(byAt).forEach(function (e) { step(h, e.at, e.dur, e.ease, e.k); });
      if (h.world) {   // let go: the copy in the world sits where the held one was at that moment
        var w = holdAt(h, h.to), st = stateAt(h.to);
        h.worldInner.setAttribute("transform", "translate(" + n2(x + st.dx) + " " + n2(y + st.dy) + ") scale(" + st.facing + " 1) " + tr(w));
      }
    }
    function follow(h, k) {   // a new pose change: add one tween when it comes in time order, else build the whole track again
      if (k.at < h.from - 1e-6 || k.at <= h.lastAt + 1e-6 || h.to !== Infinity || h.sets.some(function (s) { return s.at > k.at - 1e-3; })) { rebuild(h); return; }
      step(h, k.at, k.dur, k.ease, k);
    }
    /** hold a thing: draw(parent, fig) draws it around its grip point (it is called again for the copy left in the world), or a kit
        thing: "jug" | "hoe" | "box_held". opt: hand (near | far | both), grip [x, y] (the drawing's point that sits in the hand, px),
        rot (deg, + = its top tips forward), aim [x, y] (point its +x axis at a spot in his own space, in heights: [0.5, 0] = the ground
        half a height ahead), along: "hands" (its +x axis from the far hand through the near hand), at (when it comes into the hand),
        take (an element hidden at that moment: the same thing lying in the world), over (draw it over the near arm), poses ({name: opt}). */
    fig.hold = function (what, opt) {
      opt = opt || {};
      var pre = typeof what === "string" ? HELD[what] : null;
      if (typeof what === "string" && !pre) throw new Error("Khaam figure: nothing to hold named " + what);
      var preOpt = pre ? pre.opt(fig) : {}, k, poses = {};
      [preOpt.poses || {}, opt.poses || {}].forEach(function (m) { for (var n in m) { poses[n] = poses[n] || {}; var c = cleanOpt(m[n]); for (var q in c) poses[n][q] = c[q]; } });
      var base = cleanOpt(preOpt), more = cleanOpt(opt);
      for (k in more) base[k] = more[k];
      var hg = el("g", { "data-held": typeof what === "string" ? what : "thing" }), pg = el("g", null, hg);
      if (opt.over) inner.appendChild(hg); else inner.insertBefore(hg, groups.near.ol);   // under the near arm: his near hand closes over it
      var draw = pre ? pre.draw : what;
      draw(pg, fig);
      var h = { g: hg, inner: pg, fig: fig, draw: draw, from: opt.at || 0, to: Infinity, base: base, poses: poses, sets: [], tweens: [], world: null, last: null, lastAt: 0 };
      if (h.from > 0) { hg.style.opacity = 0; S.tl.set(hg, { opacity: 1 }, h.from); }
      if (opt.take) { if (h.from <= 0) opt.take.style.opacity = 0; S.tl.set(opt.take, { opacity: 0 }, h.from); }
      /** change how it is held: h.set({rot: 110}, {at, dur, ease}) lasts until his next pose change; {keep: true} makes it the new
          default for every later pose without its own entry. A set at the same moment as a pose change rides on it. */
      h.set = function (o2, t2) {
        t2 = t2 || {};
        h.sets.push({ at: t2.at || 0, dur: t2.dur === undefined ? 0.4 : t2.dur, ease: t2.ease || "power2.inOut", keep: !!t2.keep, opt: cleanOpt(o2 || {}) });
        h.sets.sort(byAt); rebuild(h); return h;
      };
      h.release = function (o3) { var r = {}, q; for (q in o3 || {}) r[q] = o3[q]; r.hold = h; fig.release(r); return h; };
      fig.holds.push(h);
      rebuild(h);
      return h;
    };
    /** let go at a time: the held copy hides and a copy drawn in the world (h.world, a group you may tween) shows on the same frame,
        where he held it. {at, hold: one handle (default: everything he holds), layer (default his own), behind: true (under him)} */
    fig.release = function (opt) {
      opt = opt || {};
      var at = opt.at || 0, list = opt.hold ? [opt.hold] : fig.holds.filter(function (h) { return h.to === Infinity; });
      list.forEach(function (h) {
        if (h.to !== Infinity) return;
        var layer = S.L(opt.layer || o.layer || "actors"), wg = el("g", { "data-released": "1" }), wp = el("g", null, wg);
        if (opt.behind && wrapG.parentNode === layer) layer.insertBefore(wg, wrapG); else layer.appendChild(wg);
        h.draw(wp, fig);
        h.to = at; h.world = wg; h.worldInner = wp;
        if (at <= 0) { h.g.style.opacity = 0; wg.style.opacity = 1; }
        else { wg.style.opacity = 0; S.tl.set(h.g, { opacity: 0 }, at); S.tl.set(wg, { opacity: 1 }, at); }
        rebuild(h);
      });
      return fig;
    };
    if (HELD[o.prop]) fig.held = fig.hold(o.prop, { at: 0 });   // prop: "jug" | "hoe" | "box_held" = held from the start
    return fig;
  });

  /** a crowd made by repetition: rows of figures with seeded variety. {x0, x1, y, rows, count, h, poses, outfits, heads, skins, facing, layer, tone, gap, igal} */
  K.piece("crowd", function (S, o) {
    var r = S.rng(o.seed || 201), rows = o.rows || 2, out = [];
    var outfits = o.outfits || ["thobe", "thobe", "thobe_grey", "modern", "thobe_brown", "shirt"];
    var heads = o.heads || ["kufi", "ghutra", "kufi", "hair", "shemagh"];
    var skins = o.skins || ["light", "wheat", "olive", "tan", "brown", "deep"];
    for (var row = rows - 1; row >= 0; row--) {
      var n = o.count || 7, y = (o.y || S.horizon + 300) - row * (o.rowGap || 34), h = (o.h || 300) * (1 - row * 0.09);
      for (var i = 0; i < n; i++) {
        var x = lerp(o.x0 === undefined ? 120 : o.x0, o.x1 === undefined ? 960 : o.x1, n === 1 ? 0.5 : (i + (row % 2 ? 0.5 : 0)) / (n - 1 + (row % 2 ? 1 : 0)));
        x += (r() - 0.5) * (o.jitter === undefined ? 24 : o.jitter);
        var outfit = outfits[Math.floor(r() * outfits.length)];
        var head = outfit === "modern" || outfit === "shirt" ? (r() < 0.5 ? "hair" : "kufi") : heads[Math.floor(r() * heads.length)];
        if (head === "hair" && (outfit !== "modern" && outfit !== "shirt")) head = "kufi";
        var facing = o.facing === "mixed" ? (r() < 0.5 ? "left" : "right") : (o.facing || "right");
        var pose = (o.poses || ["stand"])[Math.floor(r() * (o.poses || ["stand"]).length)];
        var f = S.figure({ who: "man", outfit: outfit, head: head, skin: skins[Math.floor(r() * skins.length)], x: x, y: y + (r() - 0.5) * 6, h: h * (0.95 + r() * 0.1),
          facing: facing, pose: pose, layer: o.layer || "actors", rim: o.rim, shadow: 0.25, igal: o.igal === true });
        if (row > 0 || o.tone) f.el.style.opacity = 1;
        if (row > 0) { var veil = 0.18 * row + (o.tone || 0); f.inner.style.filter = "saturate(" + (1 - veil) + ") brightness(" + (1 - veil * 0.6) + ")"; }
        out.push(f);
      }
    }
    return { list: out, pose: function (p, opt) { out.forEach(function (f, i) { f.pose(p, { at: (opt.at || 0) + (opt.stagger || 0) * i, dur: opt.dur, ease: opt.ease }); }); } };
  });
})(window.Khaam);
