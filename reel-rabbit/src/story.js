// story.js — «اختار أرنبك»: القصة كاملة. render(t) يرسم أي لحظة من زمنها.
// التوقيت كله من timing.json (جمل التعليق)، والمواضع تُحسب من مدد المشاهد في plan().

const CAPS = {
  L1: 'عارف ليه بتتعب كل يوم | *ومبتوصلش لحاجة؟',
  L2: 'ده *كريم | وكريم نفسه يمسك @Aأرنب',
  L3: 'شاف @Aأرنب | وجري وراه',
  L4: 'وقبل ما يمسكه *بلحظة... | شاف أرنب تاني @Bأسمن!',
  L5: 'ساب @Aالأول | وجري ورا @Bالتاني',
  L6: 'وبعدين @Cتالت... | @Dورابع... @Eوخامس',
  L7: 'آخر النهار؟ | هدّه التعب | *وإيده *فاضية',
  L8: 'تاني يوم | كريم غيّر حاجة *واحدة بس',
  L9: 'اختار أرنب @Aواحد | *ومبصّش لغيره',
  L10: 'الأرنب @Aلف @Aونط @Aواستخبى | وكريم *وراه',
  L11: '@Aومسكه!',
  L12: 'المشكلة عمرها ما كانت | إنك *مبتجريش || المشكلة إنك بتجري | *ورا *كل *حاجة',
  L13: 'اختار @Aأرنبك',
};
const GOALS = { B: 'كورس', C: 'جيم', A: 'مشروع', D: 'قناة', E: 'لغة' };

let TM = {}, SC = [], DUR = 48, TAIL = 0, P = {}, D = {};
function setTiming(lines, audioDur) {
  TM = {}; lines.forEach(l => TM[l.id] = l);
  SC = lines.map((l, i) => ({ id: l.id, a: i === 0 ? 0 : l.start - 0.12, b: i < lines.length - 1 ? lines[i + 1].start - 0.12 : l.end + 0.45 }));
  TAIL = SC[SC.length - 1].b; DUR = Math.max(TAIL + 3.6, (audioDur || 0) + 0.3);
  SC.forEach(s => D[s.id] = s.b - s.a);
  lines.forEach(l => {
    const pages = parseCap(CAPS[l.id]), words = pages.flat(2);
    let wt;
    if (l.words && l.words.length === words.length) wt = l.words.map(w => w.start);
    else { const ws = words.map(o => o.w.length + 2), tot = ws.reduce((a, b) => a + b, 0); let acc = 0; wt = words.map((o, k) => { const v = l.start + (l.end - l.start - 0.3) * acc / tot; acc += ws[k]; return v; }); }
    l._pages = pages; l._wt = wt;
  });
  plan();
  return DUR;
}
function plan() {
  P.K3 = 300 + 200 * Math.pow(0.58 * D.L3, 2);
  P.A3 = 820 + 380 * (0.55 * D.L3);
  P.K4a = P.K3 + 640 * (0.42 * D.L4); P.A4a = P.K4a + 172;
  P.K4b = P.K4a + 30; P.A4b = P.A4a + 24;
  P.K4 = P.K4b + 60;
  P.K5 = P.K4 - 420 * (0.82 * D.L5);
  const d6 = D.L6;
  P.K6_1 = P.K5 - 420 * 0.08 * d6; P.K6a = P.K6_1 - 24;
  P.K6b = P.K6a + 380 * 0.22 * d6; P.K6c = P.K6b + 26;
  P.K6d = P.K6c - 330 * 0.28 * d6; P.K6e = P.K6d - 22;
  P.K6 = P.K6e + 250 * 0.24 * d6;
  P.C6 = P.K5 + 30;                 // مركز كاميرا مشهد التشتت
  P.EB = P.K6d + 300;               // جحر الأرنب الخامس
  P.K7 = P.K6 + 110;
  P.R = { A: P.K7 + 600, B: P.K7 + 400, C: P.K7 + 750, D: P.K7 + 830, E: P.K7 + 250 };
  P.T = P.K7 + 1100; P.LG = P.K7 + 1650; P.BU = P.K7 + 2200; P.GB = P.BU + 290;
}
function sceneAt(t) {
  for (const s of SC) if (t >= s.a && t < s.b) return { ...s, u: (t - s.a) / (s.b - s.a), lt: t - s.a, d: s.b - s.a };
  return { id: 'TAIL', a: TAIL, b: DUR, u: clamp((t - TAIL) / (DUR - TAIL)), lt: t - TAIL, d: DUR - TAIL };
}

// ---------- وضعيات كريم ----------
function KP(x, face = 1) { const p = basePose(x, GY, face); p.scale = S; p.y = GY - 140 * S; return p; }
function kIdle(p, t, amt = 1) { p.y += Math.sin(t * 2.2) * 2.5 * amt; const bt = t % 3.7; if (bt < 0.12) p.blink = Math.sin(bt / 0.12 * Math.PI); return p; }
function kRun(p, x0, dist, dir, o = {}) {
  const tired = o.tired || 0;
  gait(p, Math.max(0, dist) / S, GY, { stride: o.stride || lerp(130, 96, tired), run: o.walk ? 0 : 1, lift: lerp(o.walk ? 26 : 40, 14, tired) });
  const bob = p.y - (GY - 140); p.y = GY - 140 * S + bob * S; p.x = x0 + dir * dist; p.face = dir;
  if (tired) { p.lean += 0.24 * tired; p.hL = lp(p.hL, { x: 2, y: 116 }, tired * 0.85); p.hR = lp(p.hR, { x: 12, y: 116 }, tired * 0.85); p.headTilt = 0.32 * tired; p.mouth = 'o'; p.brow = tired; }
  if (o.reach) { p.hR = lp(p.hR, { x: 106, y: -6 }, o.reach); p.hL = lp(p.hL, { x: 94, y: 12 }, o.reach); p.lean += 0.12 * o.reach; }
  p.scarfWind = o.walk ? 0.2 : 1 - tired * 0.6;
  return p;
}
function kSkid(p, k) { p.lean = -0.34 * Math.sin(Math.min(1, k * 1.3) * Math.PI * 0.75 + 0.3); p.fL = { x: 52, y: 137 }; p.fR = { x: 14, y: 140 }; p.hL = { x: -54, y: 26 }; p.hR = { x: 62, y: 4 }; p.mouth = 'o'; p.y += 4 * S; p.scarfWind = -0.6; }
function kKneel(p, k) { const h = lerp(140, 46, k); p.y = GY - h * S; p.fL = lp({ x: -14, y: 140 }, { x: -22, y: 46 }, k); p.fR = lp({ x: 16, y: 140 }, { x: -4, y: 46 }, k); }
function kSad(p, t, hands, drop) {
  p.lean = 0.3 + Math.sin(t * 4.6) * 0.04; p.y += Math.sin(t * 4.6) * 3;
  p.hL = lp({ x: 20, y: 92 }, { x: 66, y: 50 }, hands); p.hR = lp({ x: 36, y: 90 }, { x: 86, y: 38 }, hands);
  p.headTilt = 0.22 + 0.2 * hands + 0.14 * drop; p.look = { x: 2, y: 7 }; p.mouth = -0.8; p.brow = 1;
}
function aim(K, tx, ty, len = 116) { const a = Math.atan2(ty - (K.y - 112 * S), (tx - K.x) * K.face); return { x: Math.cos(a) * len, y: Math.sin(a) * len }; }
const hopD = (dist, len, h) => hopAt(dist / len, 1, h);

// ---------- الإطار ----------
function render(t) {
  const sc = sceneAt(t), u = sc.u, lt = sc.lt, d = sc.d, id = sc.id;
  const L = [], add = (z, fn) => L.push({ z, fn }), R = [], ov = [];
  let cam = { x: 540, y: camY(1), z: 1, shake: 0 }, tod = 0, sil = 0, strk = 0, feet = 1400;
  let K = KP(300), kz = 30, kHide = false, bushShake = 0;
  const hud = { a: 1, energy: 100, caught: 0, icons: {}, pulse: 0, shake: 0 };
  const X = (st, k = 1) => ({ st, k });
  const wu = i => clamp((TM[id]._wt[i] - sc.a) / d);
  const rab = o => { R.push(o); return o; };
  const idleR = (rid, i, extra = {}) => { const h = hopAt(t * 0.9 + i * 0.37, 1, 1); const bounce = ((t * 0.9 + i * 0.37) % 3) < 1 ? h : { air: 0, st: 0, tilt: 0 }; return rab({ id: rid, x: P.R[rid], y: GY + [0, 70, -34, 12, -40][i], s: [1, 1.2, 0.85, 0.95, 0.9][i], fat: rid === 'B', longEar: rid === 'E', dir: -1, air: bounce.air * 16, st: bounce.st * 0.5, z: [38, 42, 10, 39, 9][i], ...extra }); };
  const RI = { A: 0, B: 1, C: 2, D: 3, E: 4 };
  const heldA = (o = {}) => (gg, hf, hb) => { const m = { x: (hf.x + hb.x) / 2, y: (hf.y + hb.y) / 2 }; drawRabbit({ id: 'A', x: m.x + (o.dx || 0), y: m.y + (o.dy || 26), s: 0.84, dir: 1, noShadow: true, blink: o.blink, happy: true, wide: o.wide, ear: o.ear || 0, rot: o.rot || 0 }, t); };

  if (id === 'L1') {                       // الخطاف: نهاية يوم متعب
    const wo = seg(lt, d - 0.26, d);
    tod = lerp(2, 1.2, wo); sil = 1; strk = wo;
    K = KP(P.K7); kKneel(K, 1); kSad(K, t, 1, 0.5 + 0.5 * Math.sin(t * 1.4)); K.mouth = 'o';
    hud.energy = 0; hud.pulse = 1; RORDER.forEach(r => hud.icons[r] = X('x'));
    const z = lerp(1.28, 1.42, ease.out(u)); feet = 1470;
    cam = { x: lerp(P.K7 + 20, P.K7 - 420, ease.in(wo)), z };
    add(60, () => sweat(K.x + 46, K.y - 150 * S, t));
    add(0.6, () => trail(P.K7));
    add(61, () => ghostRabbit(K.x + 160, K.y - 66, 0.6 + 0.3 * Math.sin(t * 3)));
  }

  if (id === 'L2') {                       // ده كريم
    const wi = seg(lt, 0, 0.3);
    tod = lerp(1.2, 0, ease.out(wi)); strk = 1 - wi;
    K = kIdle(KP(300), t);
    const wave = seg(u, 0.06, 0.2) * (1 - seg(u, wu(2) - 0.04, wu(2) + 0.06));
    K.turn = ease.io(seg(u, 0, 0.1)) * (1 - ease.io(seg(u, wu(2), wu(2) + 0.1)));
    if (wave > 0) { K.hR = lp(K.hR, { x: 76 + Math.sin(t * 11) * 20, y: -86 }, ease.out(wave)); }
    K.mouth = 1;
    const dream = ease.back(seg(u, wu(3), wu(3) + 0.1));
    if (dream > 0) { K.look = { x: 5, y: -7 }; K.headTilt = -0.14 * clamp(dream); }
    hud.energy = 100 * ease.out(seg(u, 0.06, 0.36));
    cam = { x: lerp(-120, 420, ease.out(wi)), z: 1.15 };
    const tag = ease.back(seg(u, wu(1) - 0.02, wu(1) + 0.08)) * (1 - seg(u, wu(2), wu(2) + 0.06));
    add(70, () => { if (tag > 0) nameTag(K.x, K.y - 200 * S, tag); });
    add(70, () => { if (dream > 0) thought(K.x + 330, GY - 450, dream, t); });
  }

  if (id === 'L3') {                       // شاف أرنب وجري وراه
    tod = lerp(0, 0.1, u);
    const pop = ease.back(seg(u, 0.04, 0.16)), run0 = 0.45, tau = Math.max(0, lt - run0 * d);
    const ax = 820 + 380 * tau, hp = tau > 0 ? hopD(ax - 820, 124, 74) : { air: 0, st: 0, tilt: 0 };
    rab({ id: 'A', x: ax, dir: u > 0.36 ? 1 : -1, air: tau > 0 ? hp.air : lerp(-120, 0, pop), st: hp.st, tilt: hp.tilt, clip: u < 0.3, wide: u > 0.2 && u < 0.45, ear: u < 0.3 ? Math.sin(t * 14) * 0.12 : 0, z: 40 });
    add(41, () => { if (u < 0.3) burrowFront(820); });
    K = KP(300);
    const sur = seg(u, 0.18, 0.3), ant = seg(u, 0.3, 0.42), kt = Math.max(0, lt - 0.42 * d);
    if (u < 0.18) { kIdle(K, t); K.look = { x: 5, y: -7 * (1 - seg(u, 0.1, 0.18)) }; K.mouth = 1; }
    else if (u < 0.3) { K.y -= Math.sin(sur * Math.PI) * 30 * S; K.mouth = 'o'; K.look = { x: 8, y: 0 }; K.hL = { x: -40, y: 40 }; K.hR = { x: 50, y: 30 }; }
    else if (u < 0.42) { const a = Math.sin(ant * Math.PI / 2); K.lean = -0.24 * a; K.y += 16 * S * a; K.fL = { x: -30, y: 140 - 16 * a }; K.fR = { x: 22, y: 140 - 16 * a }; K.hL = { x: -50, y: 70 }; K.hR = { x: -30, y: 84 }; K.look = { x: 8, y: 0 }; K.brow = -0.8; K.mouth = 1; }
    else { kRun(K, 300, 200 * kt * kt, 1); K.brow = -0.6; K.mouth = 1; K.look = { x: 6, y: 0 }; }
    hud.energy = lerp(100, 92, seg(u, 0.42, 1)); if (u > 0.3) hud.icons.A = X('target');
    const ck = ease.io(seg(u, 0.1, 0.62));
    cam = { x: lerp(420, (K.x + ax) / 2 + 60, ck), z: lerp(1.15, 0.95, ck) };
    add(70, () => exclaim(K.x + 20, K.y - 250 * S, seg(u, 0.17, 0.4)));
    add(60, () => dust(300, GY, lt - 0.43 * d, 1));
  }

  if (id === 'L4') {                       // قبل ما يمسكه بلحظة... شاف أرنب تاني
    tod = lerp(0.1, 0.3, u);
    const ua = seg(u, 0, 0.42), ub = seg(u, 0.42, 0.56), uc = seg(u, 0.56, 1);
    let kx, ax;
    if (u < 0.42) { kx = lerp(P.K3, P.K4a, ua); ax = lerp(P.A3, P.A4a, ua); }
    else if (u < 0.56) { kx = lerp(P.K4a, P.K4b, ub); ax = lerp(P.A4a, P.A4b, ub); }
    else { kx = P.K4b; ax = P.A4b + 560 * uc * 0.44 * d; }
    const hp = hopD(ax - P.A3, 124, 74);
    rab({ id: 'A', x: ax, dir: 1, air: hp.air, st: hp.st, tilt: hp.tilt, wide: u > 0.3 && u < 0.6, z: 40 });
    K = KP(0);
    if (u < 0.56) { kRun(K, P.K3, kx - P.K3, 1, { reach: ease.io(seg(u, 0.18, 0.42)) }); K.look = { x: 6, y: 2 }; K.brow = -0.7; K.mouth = u > 0.36 ? 1 : 0; }
    else {
      const sk = seg(u, 0.56, 0.7);
      K.x = lerp(P.K4b, P.K4, ease.out(sk));
      if (sk < 1) kSkid(K, sk); else kIdle(K, t);
      const tn = ease.io(seg(u, 0.6, 0.72)); K.turn = tn; K.look = { x: 0, y: 5 * tn }; K.mouth = u > 0.8 ? 1 : 'o'; K.brow = 0;
      if (sk >= 1) { K.hL = { x: -30, y: 50 }; K.hR = { x: 30, y: 50 }; }
    }
    const bx = P.K4 - 160 + 430 * d * (1 - u), hb = hopD(bx, 150, 60);
    rab({ id: 'B', x: bx, y: GY + 76, dir: -1, fat: true, s: 1.22, air: hb.air, st: hb.st, tilt: hb.tilt, z: 44 });
    hud.energy = lerp(92, 85, ua); hud.icons.A = X('target');
    const z = u < 0.56 ? lerp(0.95, 1.5, ease.io(seg(u, 0.12, 0.44))) : lerp(1.5, 1.0, ease.io(seg(u, 0.56, 0.72)));
    const cx = u < 0.56 ? (kx + ax) / 2 + 30 : lerp((P.K4b + P.A4b) / 2 + 30, P.K4 + 60, ease.io(seg(u, 0.56, 0.74)));
    cam = { x: cx, z };
    strk = 0.5 * Math.sin(ub * Math.PI);
    add(60, () => dust(P.K4b + 40, GY, lt - 0.57 * d, -1, 7));
    add(70, () => exclaim(K.x + 10, K.y - 250 * S, seg(u, 0.62, 0.86), '!', RC.B));
    add(70, () => { if (ub > 0 && ub < 1) almost(K.x + 122 * S, ax - 62, K.y - 100 * S, ub, t); });
  }

  if (id === 'L5') {                       // ساب الأول وجري ورا التاني
    tod = lerp(0.3, 0.5, u);
    const tn = seg(u, 0, 0.18);
    K = KP(P.K4, -1);
    if (tn < 1) { K.turn = 1 - ease.io(tn); const a = Math.sin(tn * Math.PI); K.lean = -0.2 * a; K.y += 10 * S * a; K.fL.y -= 10 * a; K.fR.y -= 10 * a; K.mouth = 1; K.hL = { x: -30, y: 50 }; K.hR = { x: 30, y: 50 }; }
    else { kRun(K, P.K4, 420 * (u - 0.18) * d, -1, { reach: 0.45 }); K.mouth = 1; K.brow = -0.5; }
    const bx = P.K4 - 160 - 470 * lt, hb = hopD(bx, 150, 60);
    rab({ id: 'B', x: bx, y: GY + 76, dir: -1, fat: true, s: 1.22, air: hb.air, st: hb.st, tilt: hb.tilt, z: 44 });
    const ax = P.A4b + 560 * 0.44 * D.L4 + 560 * lt, ha = hopD(ax, 124, 74);
    rab({ id: 'A', x: ax, dir: 1, air: ha.air, st: ha.st, tilt: ha.tilt, z: 40 });
    hud.energy = lerp(85, 70, ease.out(seg(u, 0.06, 0.3))); hud.shake = Math.sin(seg(u, 0.06, 0.22) * Math.PI);
    hud.icons.A = X('x', seg(u, 0.05, 0.16)); hud.icons.B = X('target');
    cam = { x: lerp(P.K4 + 60, K.x - 90, ease.io(seg(u, 0, 0.45))), z: 1.0 };
    add(60, () => dust(P.K4, GY, lt - 0.19 * d, -1));
  }

  if (id === 'L6') {                       // تالت ورابع وخامس
    tod = lerp(0.5, 1.95, u);
    const sg = [
      { a: 0, b: 0.08, x0: P.K5, x1: P.K6_1, dir: -1, tired: 0.2 },
      { a: 0.08, b: 0.14, x0: P.K6_1, x1: P.K6a, dir: -1, skid: 1 },
      { a: 0.14, b: 0.36, x0: P.K6a, x1: P.K6b, dir: 1, tired: 0.35 },
      { a: 0.36, b: 0.42, x0: P.K6b, x1: P.K6c, dir: 1, skid: 1 },
      { a: 0.42, b: 0.70, x0: P.K6c, x1: P.K6d, dir: -1, tired: 0.6 },
      { a: 0.70, b: 0.76, x0: P.K6d, x1: P.K6e, dir: -1, skid: 1 },
      { a: 0.76, b: 1.01, x0: P.K6e, x1: P.K6, dir: 1, tired: 0.92 },
    ];
    const s = sg.find(q => u >= q.a && u < q.b) || sg[sg.length - 1], k = seg(u, s.a, s.b);
    K = KP(s.x0, s.dir);
    if (s.skid) { K.x = lerp(s.x0, s.x1, ease.out(k)); kSkid(K, k); K.brow = 1; }
    else kRun(K, s.x0, Math.abs(s.x1 - s.x0) * k, s.dir, { tired: s.tired });
    sg.filter(q => q.skid).forEach(q => add(60, () => dust(q.x1 + q.dir * 40, GY, lt - q.a * d, -q.dir, 7)));
    const cxr = P.C6;
    const cT = lt - 0.02 * d; if (cT > 0) { const x = cxr - 760 + 900 * cT, h = hopD(x, 110, 46); rab({ id: 'C', x, y: GY + 64, dir: 1, s: 0.82, air: h.air, st: h.st, tilt: h.tilt, z: 44 }); }
    const dT = lt - 0.33 * d; if (dT > 0) { const x = cxr + 780 - 650 * dT, h = hopD(x, 120, 60); rab({ id: 'D', x, y: GY - 30, dir: -1, s: 0.92, air: h.air, st: h.st, tilt: h.tilt, z: 10 }); }
    if (u > 0.64) { const pop = ease.back(seg(u, 0.64, 0.71)), eT = Math.max(0, lt - 0.75 * d), x = P.EB + 420 * eT, h = eT > 0 ? hopD(x - P.EB, 124, 78) : { air: 0, st: 0, tilt: 0 }; rab({ id: 'E', x, dir: u > 0.73 ? 1 : -1, longEar: true, s: 0.95, air: eT > 0 ? h.air : lerp(-120, 0, pop), st: h.st, tilt: h.tilt, clip: u < 0.75, z: 40 }); add(41, () => { if (u < 0.75) burrowFront(P.EB); }); }
    const st = (a0, v0, v1) => lerp(v0, v1, ease.out(seg(u, a0, a0 + 0.07)));
    hud.energy = u < 0.36 ? st(0.09, 70, 50) : u < 0.7 ? st(0.37, 50, 30) : st(0.71, 30, 10);
    hud.shake = Math.max(...[0.09, 0.37, 0.71].map(a0 => Math.sin(seg(u, a0, a0 + 0.1) * Math.PI)));
    hud.icons.A = X('x'); hud.icons.B = X('x', seg(u, 0.08, 0.14));
    if (u >= 0.08) hud.icons.C = u < 0.36 ? X('target') : X('x', seg(u, 0.36, 0.42));
    if (u >= 0.36) hud.icons.D = u < 0.7 ? X('target') : X('x', seg(u, 0.7, 0.76));
    if (u >= 0.7) hud.icons.E = X('target'); if (u < 0.08) hud.icons.B = X('target');
    const ck = ease.io(seg(u, 0, 0.16));
    cam = { x: lerp(P.K5 - 90, cxr, ck), z: lerp(1.0, 0.8, ck) };
    [['٣', 'C', 0.03, -330], ['٤', 'D', 0.34, 330], ['٥', 'E', 0.66, 0]].forEach(([n, rid, a0, dx]) => { const kk = seg(u, a0, a0 + 0.26); ov.push(() => { if (kk > 0 && kk < 1) { screen(); exclaim(540 + dx * 0.8, 900, kk, n, RC[rid], 190); } }); });
  }

  if (id === 'L7') {                       // آخر النهار... وإيده فاضية
    tod = lerp(1.95, 2, u); sil = seg(u, 0.28, 0.7);
    const wk = seg(u, 0, 0.22), kn = ease.io(seg(u, 0.22, 0.4)), hands = ease.io(seg(u, wu(4) - 0.06, wu(4) + 0.08)), drop = ease.io(seg(u, 0.8, 1));
    K = KP(P.K6);
    if (wk < 1) kRun(K, P.K6, 110 * wk, 1, { tired: 1, walk: 1 });
    else { K.x = P.K7; kKneel(K, kn); kSad(K, t, hands, drop); if (kn < 1) { K.hL = { x: 2, y: 116 }; K.hR = { x: 12, y: 116 }; } }
    hud.energy = lerp(10, 0, seg(u, 0, 0.3)); RORDER.forEach(r => hud.icons[r] = X('x')); hud.icons.E = u < 0.2 ? X('target') : X('x', seg(u, 0.2, 0.27));
    hud.pulse = seg(u, wu(4), wu(4) + 0.05);
    const z1 = ease.io(seg(u, 0, 0.3)), z2 = ease.io(seg(u, 0.46, 0.72));
    const z = lerp(lerp(0.8, 1.12, z1), 1.3, z2); feet = lerp(1400, 1470, z2);
    cam = { x: lerp(P.C6, P.K7 + 20, z1), z, shake: (u > 0.4 && u < 0.44) ? 12 : 0 };
    add(60, () => dust(P.K7 + 20, GY, lt - 0.4 * d, 0, 7));
    add(60, () => { if (kn >= 1) sweat(K.x + 46, K.y - 150 * S, t, 2); });
    add(61, () => { if (hands > 0) ghostRabbit(K.x + 160, K.y - 66, hands * (0.6 + 0.3 * Math.sin(t * 3))); });
  }

  if (id === 'L8') {                       // تاني يوم
    const ng = ease.io(seg(u, 0, 0.3)), dn = ease.io(seg(u, 0.3, 0.62));
    tod = u < 0.3 ? lerp(2, 3, ng) : u < 0.62 ? lerp(3, 4, dn) : 0;
    sil = 1 - seg(u, 0.04, 0.2);
    const up = ease.io(seg(u, 0.56, 0.74)), strc = Math.sin(seg(u, 0.7, 0.86) * Math.PI), one = ease.back(seg(u, wu(5) - 0.02, wu(5) + 0.07));
    K = KP(P.K7); kKneel(K, 1 - up);
    if (up < 0.05) { kSad(K, t * 0.45, 0, 1); K.blink = 1; K.mouth = 0; K.brow = 0; }
    else { kIdle(K, t); K.turn = ease.io(seg(u, 0.66, 0.78)); K.mouth = 1; K.hL = lp(K.hL, { x: -70, y: -100 }, strc); K.hR = lp(K.hR, { x: 70, y: -100 }, strc); K.y -= 8 * strc; }
    if (one > 0) { K.hR = lp(K.hR, { x: 46, y: -112 }, clamp(one)); K.brow = -0.7; }
    hud.energy = 100 * ease.out(seg(u, 0.6, 0.84)); if (u < 0.6) RORDER.forEach(r => hud.icons[r] = X('x', 1 - seg(u, 0.52, 0.6)));
    const zk = ease.io(seg(u, 0.1, 0.62)); feet = lerp(1470, 1400, zk);
    cam = { x: P.K7 + 20, z: lerp(1.3, 1.15, zk) };
    add(70, () => { const a = clamp(1 - Math.abs(tod - 3) / 0.7) * (1 - up); if (a > 0) zzz(K.x + 70, K.y - 190 * S, t, a); });
    add(70, () => { if (one > 0) label('١', K.x + 200, K.y - 150 * S, 190, { color: ACC, scale: one }); });
  }

  if (id === 'L9') {                       // اختار أرنب واحد
    tod = 0.05;
    K = kIdle(KP(P.K7), t);
    const lock = wu(2), t0 = wu(0), step = (lock - t0) / 3, order = ['E', 'B', 'D', 'A'];
    const grey = ease.io(seg(u, wu(3), wu(3) + 0.08));
    ['A', 'B', 'C', 'D', 'E'].forEach((rid, i) => {
      const k = seg(u, i * 0.03, 0.26 + i * 0.03), off = 900 * (1 - ease.out(k)), h = k < 1 ? hopD(off, 120, 56) : null;
      const o = idleR(rid, i, k < 1 ? { air: h.air, st: h.st, tilt: h.tilt } : {});
      o.x += off; if (rid !== 'A' && grey > 0.5) o.grey = true;
      if (rid === 'A' && u > 0.9) { o.dir = 1; o.wide = true; o.ear = -0.2; }
    });
    let ri = -1; for (let i = 0; i < 4; i++) if (u >= t0 + i * step - 0.001) ri = i;
    if (ri >= 0) {
      const cur = order[ri], prev = order[Math.max(0, ri - 1)], kk = ease.io(seg(u, t0 + ri * step, t0 + ri * step + 0.05));
      const rx = lerp(P.R[prev], P.R[cur], kk), locked = u >= lock, lk = seg(u, lock, lock + 0.08);
      K.hR = aim(K, rx, GY - 60); K.look = { x: 6, y: 0 };
      add(70, () => reticle(rx, GY - 52 + [0, 70, -34, 12, -40][RI[cur]] * kk, locked ? lerp(110, 78, ease.back(lk)) : 96, t, locked));
      if (locked) { K.brow = -1; K.mouth = 0; hud.icons.A = X('target'); add(29, () => sight(K, P.R.A - 30, GY - 70, clamp(lk * 2), t)); }
    }
    if (u > 0.86) { const a = seg(u, 0.86, 1); K.lean = 0.14 * a; K.y += 10 * S * a; K.fL.y -= 10 * a; K.fR.y -= 10 * a; K.hL = { x: -40, y: 70 }; }
    const ck = ease.io(seg(u, 0, 0.3));
    cam = { x: lerp(P.K7 + 20, P.K7 + 420, ck), z: lerp(1.15, 0.88, ck) };
  }

  if (id === 'L10') {                      // لف ونط واستخبى... وكريم وراه
    tod = 0.1 + 0.3 * u;
    const T = P.T, LG = P.LG, BU = P.BU, A0 = P.R.A;
    let ar = { id: 'A', dir: 1, z: 40 };
    if (u < 0.12) { const x = lerp(A0, T - 120, seg(u, 0, 0.12)), h = hopD(x - A0, 118, 66); Object.assign(ar, { x, air: h.air, st: h.st, tilt: h.tilt }); }
    else if (u < 0.34) { const th = Math.PI + 3 * Math.PI * seg(u, 0.12, 0.34), sn = Math.sin(th), h = hopAt(t, 5, 24); Object.assign(ar, { x: T + 120 * Math.cos(th), y: GY + sn * 18, dir: sn < 0 ? 1 : -1, z: sn < 0 ? 1.5 : 40, air: h.air, st: h.st, tilt: h.tilt }); }
    else if (u < 0.44) { const x = lerp(T + 120, LG - 120, seg(u, 0.34, 0.44)), h = hopD(x - T, 118, 62); Object.assign(ar, { x, air: h.air, st: h.st, tilt: h.tilt }); }
    else if (u < 0.52) { const k = seg(u, 0.44, 0.52); Object.assign(ar, { x: lerp(LG - 120, LG + 130, k), air: 4 * 170 * k * (1 - k), st: 0.6, tilt: 1 - 2 * k, z: 46 }); }
    else if (u < 0.72) { const x = lerp(LG + 130, BU - 110, seg(u, 0.52, 0.72)), h = hopD(x - LG, 118, 62); Object.assign(ar, { x, air: h.air, st: h.st, tilt: h.tilt }); }
    else if (u < 0.78) { const k = seg(u, 0.72, 0.78); Object.assign(ar, { x: lerp(BU - 110, BU + 10, k), air: 4 * 90 * k * (1 - k) + 30 * k, st: 0.5, tilt: 1 - 2 * k, z: 3.5 }); }
    else { const pk = ease.back(seg(u, 0.84, 0.9)); Object.assign(ar, { x: BU + 10, air: lerp(-70, 44, pk), z: 3.5, ear: Math.sin(t * 16) * 0.14, noShadow: true, wide: true, dir: -1 }); }
    rab(ar);
    bushShake = Math.sin(seg(u, 0.74, 0.86) * Math.PI) + (u > 0.86 ? 0.12 : 0);
    add(60, () => leaves(BU, GY - 120, lt - 0.76 * d, 8));
    ['B', 'C', 'D', 'E'].forEach(rid => { const o = idleR(rid, RI[rid], { grey: true }); const near = clamp(1 - Math.abs(K.x - o.x) / 260); o._q = near; });
    K = KP(P.K7);
    if (u < 0.26) kRun(K, P.K7, (T - 170 - P.K7) * seg(u, 0, 0.26), 1);
    else if (u < 0.30) { K.x = lerp(T - 170, T - 140, ease.out(seg(u, 0.26, 0.30))); kSkid(K, seg(u, 0.26, 0.30)); }
    else if (u < 0.34) { K.x = T - 140; kIdle(K, t); K.look = { x: ar.x > K.x ? 7 : -7, y: 0 }; K.hL = { x: -30, y: 60 }; K.hR = { x: 34, y: 56 }; }
    else if (u < 0.56) kRun(K, T - 140, (LG - 160 - (T - 140)) * seg(u, 0.34, 0.56), 1);
    else if (u < 0.66) { const k = seg(u, 0.56, 0.66); K.x = lerp(LG - 160, LG + 150, k); K.y -= 4 * 120 * k * (1 - k) * S; K.fL = { x: -84, y: 76 }; K.fR = { x: 96, y: 82 }; K.hL = { x: 70, y: -40 }; K.hR = { x: -50, y: -30 }; K.lean = 0.2; K.scarfWind = 1; }
    else if (u < 0.88) { const k = seg(u, 0.66, 0.88), ek = 1 - Math.pow(1 - k, 2); kRun(K, LG + 150, (BU - 270 - (LG + 150)) * ek, 1, { walk: k > 0.7 ? 1 : 0 }); if (k > 0.7) { K.lean = 0.2; K.hL = { x: 40, y: 50 }; K.hR = { x: 60, y: 36 }; } }
    else { K.x = BU - 270; K.lean = 0.24; K.y += 18 * S; K.fL = { x: -34, y: 122 }; K.fR = { x: 30, y: 122 }; K.hL = { x: 44, y: 40 }; K.hR = { x: 66, y: 24 }; K.y += Math.sin(t * 3) * 2; }
    K.brow = -0.9; if (K.mouth !== 'o') K.mouth = 0; if (u < 0.3 || u >= 0.34) K.look = { x: 7, y: 0 };
    R.forEach(o => { if (o.grey) add(70, () => { const near = clamp(1 - Math.abs(K.x - o.x) / 240); if (near > 0) label('؟', o.x, (o.y ?? GY) - 190 * (o.s || 1), 90, { color: '#8A8A8A', alpha: near, scale: 0.7 + 0.3 * near }); }); });
    hud.energy = lerp(100, 62, u); hud.icons.A = X('target');
    add(60, () => dust(T - 150, GY, lt - 0.27 * d, 1, 7)); add(60, () => dust(LG + 150, GY, lt - 0.66 * d, 1));
    add(29, () => { if (u < 0.74) sight(K, ar.x - 20, (ar.y ?? GY) - ar.air - 70, 0.8, t); });
    add(70, () => { if (u < 0.74) marker(ar.x, (ar.y ?? GY) - ar.air - 190, t); });
    const c0 = ease.io(seg(u, 0, 0.16)), c1 = ease.io(seg(u, 0.8, 1));
    cam = { x: lerp(lerp(P.K7 + 420, K.x + 190, c0), BU - 100, c1), z: lerp(lerp(0.88, 0.95, c0), 1.12, c1) };
  }

  if (id === 'L11') {                      // ومسكه!
    tod = 0.4; const BU = P.BU;
    const cr = seg(u, 0, 0.22), dv = seg(u, 0.22, 0.42), popk = seg(u, 0.6, 0.8);
    K = KP(BU - 270);
    if (u < 0.22) { const a = ease.io(cr); K.lean = 0.24 + 0.1 * a; K.y += (18 + 14 * a) * S; K.fL = { x: -34, y: 122 - 14 * a }; K.fR = { x: 30, y: 122 - 14 * a }; K.hL = { x: lerp(44, -50, a), y: lerp(40, 70, a) }; K.hR = { x: lerp(66, -30, a), y: lerp(24, 80, a) }; K.brow = -1; }
    else if (u < 0.42) { K.x = lerp(BU - 270, BU - 10, dv); K.y -= (4 * 120 * dv * (1 - dv) + 20 * dv) * S; K.rot = lerp(0.2, 1.3, ease.out(dv)); K.hL = { x: 0, y: -116 }; K.hR = { x: 22, y: -118 }; K.brow = -1; K.mouth = 'o'; K.scarfWind = 1; if (dv > 0.55) kz = 3.6; }
    else if (u < 0.6) { kHide = true; }
    else { K = KP(BU); kz = 3.6; K.turn = 1; K.y += (1 - ease.back(popk)) * 230; K.hL = { x: -36, y: -126 }; K.hR = { x: 36, y: -126 }; K.mouth = 1; K.blink = u > 0.9 ? 1 : 0; K.prop = heldA({ wide: u < 0.75, dy: -30 }); }
    if (u < 0.42) rab({ id: 'A', x: BU + 10, air: 44 + (u > 0.22 ? 20 : 0), z: 3.5, ear: Math.sin(t * 16) * 0.14 - (u > 0.22 ? 0.3 : 0), noShadow: true, wide: true, dir: -1 });
    bushShake = u < 0.22 ? 0.12 : (u < 0.42 ? 0.2 : (u < 0.6 ? 1 : (1 - popk) * 0.8));
    add(60, () => leaves(BU, GY - 110, lt - 0.42 * d, 16)); add(60, () => leaves(BU + 20, GY - 150, lt - 0.6 * d, 12));
    add(2.5, () => rays(BU, GY - 330, ease.out(popk), t));
    add(72, () => confetti(BU, GY - 420, lt - 0.62 * d));
    hud.energy = 60; hud.caught = u >= 0.62 ? 1 : 0; hud.pulse = seg(u, 0.62, 0.66); hud.icons.A = u >= 0.62 ? X('ok', seg(u, 0.62, 0.72)) : X('target');
    const pz = ease.back(seg(u, 0.6, 0.74)); feet = lerp(1400, 1450, clamp(pz));
    cam = { x: lerp(BU - 100, BU, ease.io(seg(u, 0.2, 0.5))), z: lerp(1.12, 1.3, pz), shake: (u > 0.42 && u < 0.5) ? 16 : (u > 0.6 && u < 0.66) ? 12 : 0 };
  }

  if (id === 'L12' || id === 'L13' || id === 'TAIL') {   // الرسالة + الخاتمة
    tod = 0.5; const BU = P.BU;
    K = kIdle(KP(BU), t); kz = 3.6; K.turn = 1; K.mouth = 1;
    const low = id === 'L12' ? ease.io(seg(u, 0, 0.12)) : 1;
    K.hL = lp({ x: -36, y: -126 }, { x: -20, y: 46 }, low); K.hR = lp({ x: 36, y: -126 }, { x: 24, y: 42 }, low);
    let hold = { dy: lerp(-30, 18, low), blink: (t % 2.6) < 0.2 };
    hud.a = id === 'L12' ? 1 - seg(u, 0, 0.1) : 0; hud.caught = 1; hud.energy = 60; hud.icons.A = X('ok');
    let card = 1, z = 0.9; feet = 1585; let cx = BU;
    if (id === 'L12') { card = ease.back(seg(u, 0.1, 0.2)); z = lerp(1.3, 0.9, ease.io(seg(u, 0, 0.16))); feet = lerp(1450, 1585, ease.io(seg(u, 0, 0.16))); }
    if (id === 'L13') { hold.dy = 18 - 16 * Math.sin(seg(u, 0.3, 0.8) * Math.PI); hold.blink = u > 0.4; }
    if (id === 'TAIL') {
      card = 1 - ease.io(seg(u, 0, 0.1));
      const zk = ease.io(seg(u, 0.05, 0.3)); z = lerp(0.9, 1.08, zk); cx = lerp(BU, BU + 120, zk); feet = lerp(1585, 1440, zk);
      const pop = ease.back(seg(u, 0.1, 0.22)), sink = ease.in(seg(u, 0.84, 1));
      rab({ id: 'G', col: RC.G, x: P.GB, dir: -1, air: lerp(-130, 0, pop) - 140 * sink, clip: true, sparkle: sink < 0.3, ear: 0.7 * seg(u, 0.72, 0.84), wide: u < 0.7, z: 40 });
      add(41, () => burrowFront(P.GB));
      const lk = ease.io(seg(u, 0.24, 0.34)) * (1 - ease.io(seg(u, 0.46, 0.54)));
      K.turn = 1 - 0.75 * lk; K.look = { x: 9 * lk, y: 0 }; if (lk > 0.5) { K.mouth = 'o'; }
      const sh = seg(u, 0.56, 0.82); if (sh > 0 && sh < 1) { K.look = { x: Math.sin(sh * Math.PI * 5) * 8, y: 0 }; K.headTilt = Math.sin(sh * Math.PI * 5) * 0.1; K.brow = -0.4; }
      if (u > 0.8) { hold.blink = true; hold.dy = 10; K.blink = u > 0.86 ? 1 : 0; }
      ov.push(() => { screen(); label('أرنبك إيه؟', 540, 520, 150, { scale: ease.back(seg(u, 0.3, 0.42)), alpha: seg(u, 0.3, 0.34), color: RC.A }); label('اكتبه في التعليقات', 540, 690, 62, { alpha: seg(u, 0.44, 0.52), box: CREAM }); });
    }
    K.prop = heldA(hold);
    cam = { x: cx, z };
    ov.push(() => focusCard(id, u, card, t, wu));
  }

  // ---------- التركيب ----------
  cam.y = camY(cam.z, feet); CAM = cam;
  drawBackground(tod, t, sil);
  worldT(t); drawGround(t);
  [820, P.EB, P.GB].forEach(x => add(1, () => burrow(x)));
  add(2, () => treeBack(P.T)); add(45, () => logProp(P.LG));
  add(3, () => bush(P.BU, bushShake, false, t)); add(50, () => bush(P.BU, bushShake, true, t));
  R.forEach(r => add(r.z ?? 40, () => drawRabbit(r, t)));
  if (!kHide) add(kz, () => { if (kz === 30) { g.fillStyle = `rgba(0,0,0,${0.13 * clamp(1 - (GY - 140 * S - K.y) / 300)})`; g.beginPath(); g.ellipse(K.x, GY + 5, 70, 13, 0, 0, 7); g.fill(); } drawChar(g, K, CH.karim, t); });
  L.map((o, i) => ({ ...o, i })).sort((a, b) => a.z - b.z || a.i - b.i).forEach(o => { worldT(t); g.save(); o.fn(); g.restore(); });
  tintOverlay(tod);
  if (strk > 0) streaks(strk, t, 1);
  vignette();
  drawHUD(hud, t);
  ov.forEach(f => f());
  if (TM[id]) drawCaption(TM[id]._pages, TM[id]._wt, t, sc.b, { size: id === 'L11' || id === 'L13' ? 150 : (id === 'L12' ? 88 : 96), y: id === 'L11' ? 560 : id === 'L13' ? 500 : (id === 'L12' ? 440 : 560) });
}

// ---------- عناصر خاصة بالقصة ----------
function trail(x) {
  const pts = [[-560, 120], [300, 170], [-420, 240], [380, 300], [-260, 380], [120, 440], [0, 70]];
  g.strokeStyle = 'rgba(70,100,60,0.5)'; g.lineWidth = 9; g.setLineDash([22, 20]); g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); pts.forEach(([dx, dy], i) => i ? g.lineTo(x + dx, GY + dy) : g.moveTo(x + dx, GY + dy)); g.stroke(); g.setLineDash([]);
}
function ghostRabbit(x, y, a) {
  g.save(); g.globalAlpha = clamp(a); g.translate(x, y - 64); g.strokeStyle = INK; g.lineWidth = 5; g.setLineDash([10, 9]);
  g.beginPath(); g.arc(0, 0, 26, 0, 7); g.stroke();
  g.beginPath(); g.ellipse(-10, -40, 8, 20, -0.2, 0, 7); g.stroke(); g.beginPath(); g.ellipse(10, -40, 8, 20, 0.2, 0, 7); g.stroke();
  g.setLineDash([]); g.restore();
  label('؟', x, y - 62, 44, { alpha: clamp(a), stroke: 0 });
}
function nameTag(x, y, k) {
  g.save(); g.globalAlpha = clamp(k); g.strokeStyle = INK; g.lineWidth = 6; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x + 150, y - 60); g.quadraticCurveTo(x + 110, y - 10, x + 62, y - 6); g.stroke();
  g.beginPath(); g.moveTo(x + 84, y - 26); g.lineTo(x + 62, y - 6); g.lineTo(x + 90, y + 6); g.stroke(); g.restore();
  label('كريم', x + 200, y - 100, 84, { scale: clamp(k, 0, 1.2), box: CREAM, color: ACC });
}
function thought(x, y, k, t) {
  g.save(); g.fillStyle = '#FFFFFF'; g.strokeStyle = INK; g.lineWidth = 6;
  [[-150, 150, 14], [-112, 112, 22]].forEach(([dx, dy, r]) => { g.beginPath(); g.arc(x + dx, y + dy, r * clamp(k), 0, 7); g.fill(); g.stroke(); });
  g.translate(x, y); g.scale(clamp(k, 0, 1.15), clamp(k, 0, 1.15));
  g.beginPath(); g.ellipse(0, 0, 150, 108, 0, 0, 7); g.fill(); g.stroke();
  g.restore();
  g.save(); g.translate(x, y); g.scale(clamp(k, 0, 1.15), clamp(k, 0, 1.15)); drawRabbit({ id: 'A', x: -10, y: 56 + Math.sin(t * 4) * 4, s: 1.05, noShadow: true, dir: 1 }, t);
  g.fillStyle = ACC; heart(96, -40, 20 + 3 * Math.sin(t * 6)); g.restore();
}
function heart(x, y, s) { g.beginPath(); g.moveTo(x, y + s * 0.7); g.bezierCurveTo(x - s * 1.4, y - s * 0.3, x - s * 0.6, y - s * 1.2, x, y - s * 0.4); g.bezierCurveTo(x + s * 0.6, y - s * 1.2, x + s * 1.4, y - s * 0.3, x, y + s * 0.7); g.fill(); }
function almost(x1, x2, y, k, t) {
  if (x2 <= x1) return; g.save(); g.strokeStyle = ACC; g.lineWidth = 6; g.setLineDash([8, 8]); g.globalAlpha = Math.sin(k * Math.PI);
  g.beginPath(); g.moveTo(x1, y - 46); g.lineTo(x1, y - 70); g.lineTo(x2, y - 70); g.lineTo(x2, y - 46); g.stroke(); g.restore();
}
function zzz(x, y, t, a) { for (let i = 0; i < 3; i++) { const k = (t * 0.5 + i / 3) % 1; label('Z', x + 40 * k + i * 12, y - 130 * k, 44 + 30 * k, { alpha: a * (1 - k), color: '#FFFFFF', strokeCol: '#3B3566', font: 'Cairo' }); } }
function reticle(x, y, r, t, locked) {
  g.save(); g.translate(x, y); g.strokeStyle = ACC; g.lineWidth = 9; g.lineCap = 'round';
  if (!locked) g.rotate(t * 2);
  g.beginPath(); g.arc(0, 0, r, 0, 7); g.stroke();
  for (let i = 0; i < 4; i++) { g.rotate(Math.PI / 2); g.beginPath(); g.moveTo(r - 20, 0); g.lineTo(r + 24, 0); g.stroke(); }
  g.restore();
}
function sight(K, tx, ty, a, t) {
  const ex = K.x + K.face * 20 * S, ey = K.y - 160 * S;
  g.save(); g.globalAlpha = 0.75 * a; g.strokeStyle = ACC; g.lineWidth = 6; g.setLineDash([16, 14]); g.lineDashOffset = -t * 90; g.lineCap = 'round';
  g.beginPath(); g.moveTo(ex, ey); g.lineTo(tx, ty); g.stroke(); g.restore();
}
function marker(x, y, t) { const b = Math.sin(t * 7) * 8; g.fillStyle = ACC; g.strokeStyle = CREAM; g.lineWidth = 6; g.lineJoin = 'round'; g.beginPath(); g.moveTo(x - 24, y - 30 + b); g.lineTo(x + 24, y - 30 + b); g.lineTo(x, y + 8 + b); g.closePath(); g.stroke(); g.fill(); }

// بطاقة الشرح: تجري ورا كل حاجة ← ولا حاجة / هدف واحد ← توصل
function focusCard(id, u, k, t, wu) {
  if (k <= 0) return; screen(); g.save();
  g.translate(540, 868); g.scale(clamp(k, 0, 1.06), clamp(k, 0, 1.06)); g.globalAlpha = clamp(k); g.translate(-540, -868);
  g.fillStyle = 'rgba(255,248,234,0.96)'; rr(86, 624, 908, 490, 44); g.fill(); g.strokeStyle = INK; g.lineWidth = 6; g.stroke();
  const ox = 890, oy = 868, ys = [696, 782, 868, 954, 1040], tx = 500;
  const L12 = id === 'L12', L13 = id === 'L13', done = id === 'TAIL';
  const order = [0, 4, 1, 3, 2];
  RORDER.forEach((rid, i) => {
    const j = order.indexOf(i);
    let grow = 1, pop = 1, xk = 1, dimm = 1, full = 0;
    if (L12) {
      const a0 = wu(0) + j * (wu(5) - wu(0)) / 5; grow = ease.out(seg(u, a0, a0 + 0.07));
      const p0 = wu(6) + i * (wu(11) - wu(6)) / 5; pop = ease.back(seg(u, p0, p0 + 0.05));
      xk = ease.back(seg(u, wu(9) + i * 0.012, wu(9) + 0.05 + i * 0.012));
    }
    if (L13 || done) { full = done ? 1 : ease.io(seg(u, wu(0), wu(1) + 0.12)); if (rid !== 'A') dimm = lerp(1, 0.22, full); }
    const isA = rid === 'A', reach = isA ? lerp(0.6, 1, full) : 0.6;
    const ex = lerp(ox - 66, tx, reach * grow), ey = lerp(oy, ys[i], reach * grow);
    g.save(); g.globalAlpha *= dimm;
    g.strokeStyle = isA && full > 0 ? RC.A : '#8C8474'; g.lineWidth = isA && full > 0 ? 12 : 7; g.lineCap = 'round'; g.setLineDash(isA && full > 0 ? [] : [14, 12]);
    if (grow > 0) { g.beginPath(); g.moveTo(ox - 66, oy); g.lineTo(ex, ey); g.stroke(); g.setLineDash([]); const a = Math.atan2(ey - oy, ex - (ox - 66)); g.beginPath(); g.moveTo(ex - Math.cos(a - 0.5) * 22, ey - Math.sin(a - 0.5) * 22); g.lineTo(ex, ey); g.lineTo(ex - Math.cos(a + 0.5) * 22, ey - Math.sin(a + 0.5) * 22); g.stroke(); }
    if (xk > 0 && !(isA && full > 0.2)) cross(ex - 30, ey, 24, clamp(xk) * (isA ? 1 - full * 5 : 1));
    if (pop > 0) {
      const sc = clamp(pop, 0, 1.15) * (isA ? 1 + 0.18 * full : 1);
      rabbitIcon(176, ys[i] + 10, 1.12 * sc, RC[rid]);
      g.font = `${Math.round(60 * (isA ? 1 + 0.15 * full : 1))}px Lalezar`; g.textAlign = 'left'; g.textBaseline = 'middle'; g.direction = 'rtl'; g.fillStyle = isA && full > 0.5 ? RC.A : INK; g.globalAlpha *= clamp(pop);
      g.fillText(GOALS[rid], 232, ys[i] + 6);
    }
    g.restore();
    if (isA && full >= 0.95) check(tx - 40, ys[i] - 34, 30);
  });
  // أيقونة كريم تجري في مكانها
  g.translate(ox, oy); g.scale(1.35, 1.35); g.translate(-ox, -oy);
  g.strokeStyle = INK; g.lineWidth = 9; g.lineCap = 'round';
  const ph = t * (L12 ? 14 : 4), sw = Math.sin(ph) * (L12 ? 16 : 5);
  g.fillStyle = '#FFFDF8'; g.beginPath(); g.arc(ox, oy - 62, 20, 0, 7); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(ox, oy - 42); g.lineTo(ox, oy + 6); g.moveTo(ox, oy + 6); g.lineTo(ox - sw, oy + 50); g.moveTo(ox, oy + 6); g.lineTo(ox + sw, oy + 50); g.moveTo(ox, oy - 26); g.lineTo(ox + sw * 1.1, oy - 2); g.moveTo(ox, oy - 26); g.lineTo(ox - sw * 1.1, oy - 2); g.stroke();
  g.strokeStyle = ACC; g.lineWidth = 9; g.beginPath(); g.moveTo(ox - 12, oy - 38); g.lineTo(ox + 12, oy - 38); g.stroke();
  g.restore();
}

// ---------- إشارات الصوت ----------
function sfxCues() {
  const at = (id, u) => { const s = SC.find(x => x.id === id); return s.a + u * (s.b - s.a); };
  const wt = (id, i) => TM[id]._wt[i];
  const c = [], add = (t, type, extra = {}) => c.push({ t: Math.max(0, t), type, ...extra });
  const steps = (id, u0, u1, hz, gain = 1) => { const a = at(id, u0), b = at(id, u1); for (let x = a; x < b; x += 1 / hz) add(x, 'step', { gain }); };
  add(0.05, 'drain'); add(at('L1', 1) - 0.26, 'whoosh');
  add(at('L2', 0.06), 'charge'); add(wt('L2', 1), 'pop'); add(wt('L2', 3), 'pop2');
  add(at('L3', 0.05), 'pop'); add(at('L3', 0.18), 'ding'); add(at('L3', 0.42), 'whoosh'); steps('L3', 0.46, 1, 5);
  steps('L4', 0, 0.42, 5.5); add(at('L4', 0.42), 'slow'); add(at('L4', 0.57), 'skid'); add(at('L4', 0.62), 'ding'); add(at('L4', 0.6), 'boing');
  add(at('L5', 0.06), 'drain'); add(at('L5', 0.18), 'whoosh'); steps('L5', 0.2, 1, 5);
  [[0.03, 0.08, 0.09], [0.34, 0.36, 0.37], [0.66, 0.70, 0.71]].forEach(([p, s, dr]) => { add(at('L6', p), 'pop'); add(at('L6', s), 'skid'); add(at('L6', dr), 'drain'); });
  steps('L6', 0.14, 0.36, 4.6); steps('L6', 0.42, 0.7, 4); steps('L6', 0.76, 1, 3.2);
  add(at('L7', 0.05), 'drain'); add(at('L7', 0.4), 'thud'); add(wt('L7', 4), 'sad');
  add(at('L8', 0.05), 'night'); add(at('L8', 0.56), 'rise'); add(at('L8', 0.62), 'charge'); add(wt('L8', 5), 'ding');
  { const t0 = wt('L9', 0), lk = wt('L9', 2), st = (lk - t0) / 3; for (let i = 0; i < 3; i++) add(t0 + i * st, 'tick'); add(lk, 'lock'); add(wt('L9', 3), 'whoosh'); }
  steps('L10', 0, 0.26, 5.5); add(at('L10', 0.27), 'skid'); steps('L10', 0.34, 0.56, 5.5); add(at('L10', 0.44), 'boing'); add(at('L10', 0.56), 'jump'); add(at('L10', 0.66), 'thud'); steps('L10', 0.68, 0.8, 4.5); add(at('L10', 0.76), 'rustle'); steps('L10', 0.8, 0.88, 3, 0.5);
  add(at('L11', 0.22), 'jump'); add(at('L11', 0.42), 'rustle'); add(at('L11', 0.5), 'rustle'); add(at('L11', 0.6), 'fanfare');
  add(at('L12', 0.04), 'pop'); for (let j = 0; j < 5; j++) add(wt('L12', 0) + j * (wt('L12', 5) - wt('L12', 0)) / 5, 'tick'); for (let i = 0; i < 5; i++) add(wt('L12', 6) + i * (wt('L12', 11) - wt('L12', 6)) / 5, 'pop2'); add(wt('L12', 9), 'buzz');
  add(wt('L13', 0), 'whoosh'); add(wt('L13', 1) + 0.12 * D.L13, 'lock');
  add(TAIL + 0.1 * (DUR - TAIL), 'sparkle'); add(TAIL + 0.3 * (DUR - TAIL), 'pop'); add(TAIL + 0.56 * (DUR - TAIL), 'tick'); add(TAIL + 0.66 * (DUR - TAIL), 'tick'); add(TAIL + 0.84 * (DUR - TAIL), 'drain');
  return c;
}
function musicEnv() { const s = id => SC.find(x => x.id === id); return [[0, 0.5], [s('L2').a, 0.5], [s('L2').a + 0.3, 1], [s('L6').b - 0.5, 1], [s('L7').a + 0.6, 0.35], [s('L8').a + 0.55 * D.L8, 0.35], [s('L8').a + 0.7 * D.L8, 1], [DUR - 0.9, 1], [DUR, 0]]; }

if (typeof window !== 'undefined') Object.assign(window, { render, setTiming, sfxCues, musicEnv, getDur: () => DUR, initCanvas: cv => { g = cv.getContext('2d'); } });
