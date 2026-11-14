// rig.js — هيكل الشخصية (عظام بأطوال ثابتة + IK) وأدوات الحركة
// كل شيء يُحسب من الزمن فقط، لا عشوائية بدون بذرة.

const CH = {
  // character-bible: نادر
  nader: {
    headR: 36, torso: 118, upperArm: 62, foreArm: 58, thigh: 74, shin: 72,
    line: 13, ink: '#1F1E24', scarf: '#E8553D',
  },
};

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, u) => a + (b - a) * u;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const ease = {
  io: u => u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2,
  out: u => 1 - Math.pow(1 - u, 3),
  in: u => u * u * u,
  back: u => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); },
  elastic: u => u === 0 || u === 1 ? u : Math.pow(2, -10 * u) * Math.sin((u * 10 - .75) * (2 * Math.PI) / 3) + 1,
};
const lp = (a, b, u) => ({ x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u) });

// بذرة ثابتة
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// IK بعظمتين: من A إلى الهدف T بطولين ثابتين، bend = +1/-1
function ik(A, T, l1, l2, bend) {
  let dx = T.x - A.x, dy = T.y - A.y;
  let d = Math.hypot(dx, dy);
  const max = l1 + l2 - 0.5, min = Math.abs(l1 - l2) + 0.5;
  const dc = clamp(d, min, max);
  const a = Math.atan2(dy, dx);
  const c = clamp((l1 * l1 + dc * dc - l2 * l2) / (2 * l1 * dc), -1, 1);
  const b = Math.acos(c) * bend;
  const J = { x: A.x + Math.cos(a + b) * l1, y: A.y + Math.sin(a + b) * l1 };
  const E = { x: A.x + Math.cos(a) * dc, y: A.y + Math.sin(a) * dc };
  return { J, E };
}

// حالة افتراضية للوقوف
function basePose(x, feetY, face = 1) {
  return {
    x, y: feetY - 140, face, turn: 0, lean: 0, headTilt: 0, scale: 1, rot: 0,
    hL: { x: -8, y: 112 }, hR: { x: 10, y: 112 },          // نسبة للكتف (محلية: x للأمام)
    fL: { x: -14, y: 140 }, fR: { x: 16, y: 140 },          // نسبة للورك
    look: { x: 0, y: 0 }, blink: 0, mouth: 0, brow: 0, alpha: 1,
    scarfWind: 0,
  };
}

// تنفس ورمش هادئ
function idle(p, t, amt = 1) {
  p.y += Math.sin(t * 2.2) * 2.2 * amt;
  const bt = (t % 3.7);
  if (bt < 0.12) p.blink = Math.max(p.blink, Math.sin(bt / 0.12 * Math.PI));
  return p;
}

// دورة مشي/جري بقدم ثابتة على الأرض: s = المسافة المقطوعة
function gait(p, s, feetY, opts = {}) {
  const L = opts.stride || 110, h = opts.lift || 34, run = opts.run || 0;
  const res = {};
  [['fL', 0], ['fR', 0.5]].forEach(([k, off]) => {
    const u = s / L + off, n = Math.floor(u), f = u - n;
    const Fn = (n - off) * L + L / 4;             // موضع القدم المزروعة (بالنسبة لبداية المشي)
    let fx, fy = 0;
    if (f < 0.5) { fx = Fn; }
    else {
      const w = (f - 0.5) / 0.5, e = ease.io(w);
      fx = lerp(Fn, Fn + L, e);
      fy = -Math.sin(w * Math.PI) * h;
    }
    res[k] = { x: fx - s, y: 140 + fy - (run ? 10 : 0) };
  });
  p.fL = res.fL; p.fR = res.fR;
  const ph = s / L * Math.PI * 2;
  p.y = feetY - 140 + (run ? 14 : 4) - Math.abs(Math.cos(ph)) * (run ? 14 : 7);
  // ذراعان متعاكسان
  const sw = run ? 42 : 26;
  p.hL = { x: Math.sin(ph) * sw * (run ? 1 : 1), y: run ? 80 : 108 };
  p.hR = { x: -Math.sin(ph) * sw, y: run ? 80 : 108 };
  if (run) { p.hL.x += 14; p.hR.x += 14; }
  p.lean = run ? 0.22 : 0.05;
  return p;
}

function drawChar(g, p, def = CH.nader, t = 0) {
  const d = def, f = p.face, tr = p.turn;
  g.save();
  g.globalAlpha = p.alpha;
  g.translate(p.x, p.y);
  g.rotate(p.rot || 0);
  g.scale(p.scale, p.scale);
  // كل الحساب محلي حول الورك (0,0)
  const hip = { x: 0, y: 0 };
  const sinL = Math.sin(p.lean) * f, cosL = Math.cos(p.lean);
  const neck = { x: sinL * d.torso, y: -cosL * d.torso };
  const ang = p.lean * f + p.headTilt * f;
  const head = { x: neck.x + Math.sin(ang) * (d.headR + 4), y: neck.y - Math.cos(ang) * (d.headR + 4) };
  const sh = { x: neck.x * 0.92, y: neck.y * 0.92 + 4 };
  const shOff = 22 * tr, hipOff = 14 * tr;
  const toW = (base, rel) => ({ x: base.x + rel.x * f, y: base.y + rel.y });
  const shL = { x: sh.x - shOff, y: sh.y }, shR = { x: sh.x + shOff, y: sh.y };
  const hpL = { x: hip.x - hipOff, y: 0 }, hpR = { x: hip.x + hipOff, y: 0 };
  const armBend = tr > 0.5 ? null : 1 * f; // المرفق للخلف في الجانبي
  const legBend = tr > 0.5 ? null : -1 * f;  // الركبة للأمام
  const limbs = [];
  const handL = toW(sh, p.hL), handR = toW(sh, p.hR);
  const footL = toW(hip, p.fL), footR = toW(hip, p.fR);
  limbs.push({ a: hpL, t: footL, l1: d.thigh, l2: d.shin, bend: legBend ?? 1, back: true });
  limbs.push({ a: shL, t: handL, l1: d.upperArm, l2: d.foreArm, bend: armBend ?? 1, back: true });
  const front = [
    { a: hpR, t: footR, l1: d.thigh, l2: d.shin, bend: legBend ?? -1 },
    { a: shR, t: handR, l1: d.upperArm, l2: d.foreArm, bend: armBend ?? -1 },
  ];
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.strokeStyle = d.ink; g.lineWidth = d.line;
  [...limbs, ...front].forEach(L => { L.r = ik(L.a, L.t, L.l1, L.l2, L.bend); L.end = L.r.E; });
  const drawLimb = (L) => {
    const r = L.r;
    g.beginPath(); g.moveTo(L.a.x, L.a.y); g.lineTo(r.J.x, r.J.y); g.lineTo(r.E.x, r.E.y); g.stroke();
  };
  // الوشاح خلف الجسم
  const wv = Math.sin(t * 7) * 0.5 + Math.sin(t * 11.3) * 0.3;
  g.save();
  g.strokeStyle = d.scarf; g.lineWidth = 11;
  const sx = neck.x, sy = neck.y + 6;
  const tail = -f * (1 - tr);
  g.beginPath(); g.moveTo(sx, sy);
  g.quadraticCurveTo(sx + tail * (30 + p.scarfWind * 20), sy + 8 + wv * 6 - p.scarfWind * 10,
    sx + tail * (52 + p.scarfWind * 34) + tr * 10, sy + 26 + wv * 10 - p.scarfWind * 18 + tr * 34);
  g.stroke();
  g.restore();
  limbs.forEach(drawLimb);
  // الجذع
  g.beginPath(); g.moveTo(hip.x, hip.y); g.lineTo(neck.x, neck.y); g.stroke();
  if (p.prop) { g.save(); p.prop(g, front[1].end, limbs[1].end); g.restore(); g.strokeStyle = d.ink; g.lineWidth = d.line; }
  front.forEach(drawLimb);
  // طوق الوشاح
  g.save(); g.strokeStyle = d.scarf; g.lineWidth = 12;
  g.beginPath(); g.moveTo(neck.x - 14, neck.y + 4); g.lineTo(neck.x + 14, neck.y + 4); g.stroke(); g.restore();
  // الرأس
  g.fillStyle = '#FFFDF8';
  g.beginPath(); g.arc(head.x, head.y, d.headR, 0, Math.PI * 2); g.fill(); g.stroke();
  if (p.back) { g.restore(); return { hand: front[1].end, handBack: limbs[1].end, head }; }
  // العينان
  g.fillStyle = d.ink;
  const eyeOpen = 1 - clamp(p.blink);
  const ex = head.x + (f * 12) * (1 - tr) + p.look.x, ey = head.y - 4 + p.look.y;
  const eyes = tr > 0.3 ? [ex - 13 * tr, ex + 13 * tr] : [ex + f * 4];
  eyes.forEach(x => {
    g.beginPath(); g.ellipse(x, ey, 5.5, Math.max(0.8, 7 * eyeOpen), 0, 0, Math.PI * 2); g.fill();
  });
  // الحاجب
  if (p.brow) {
    g.lineWidth = 5;
    eyes.forEach((x, i) => {
      const s = eyes.length > 1 ? (i ? 1 : -1) : f;
      g.beginPath(); g.moveTo(x - 8, ey - 14 - p.brow * 4 * s); g.lineTo(x + 8, ey - 14 + p.brow * 4 * s); g.stroke();
    });
  }
  // الفم
  g.lineWidth = 5;
  const mx = head.x + (f * 10) * (1 - tr) + p.look.x * 0.6, my = head.y + 14;
  g.beginPath();
  if (p.mouth === 'o') { g.ellipse(mx, my + 2, 6, 8, 0, 0, Math.PI * 2); g.stroke(); }
  else {
    const m = p.mouth || 0;
    g.moveTo(mx - 10, my); g.quadraticCurveTo(mx, my + m * 10, mx + 10, my); g.stroke();
  }
  g.restore();
  return { hand: front[1].end, handBack: limbs[1].end, head, neck, toWorld: (q) => ({ x: p.x + q.x * p.scale, y: p.y + q.y * p.scale }) };
}

if (typeof module !== 'undefined') module.exports = { ik, gait, basePose };
