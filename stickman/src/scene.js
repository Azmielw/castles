// scene.js — «الجدار الذي لم يكن جدارًا»
// render(t) يرسم الإطار عند الزمن t (ثوانٍ) من التوقيت المقاس في timing.json فقط.

const W = 1080, H = 1920;
const COL = {
  sky: '#F4EEE3', skyTop: '#EADFCB', ink: '#1F1E24', accent: '#E8553D',
  wall: '#C3BAAC', wallLine: '#AFA596', wallTop: '#9E9486', seam: '#A69C8D',
  floor: '#E5DBC8', floorLine: '#CFC3AD',
  gSky: '#FFF3D6', grass: '#9BCB7E', grassDark: '#78AE5E', flower: '#F6C744',
  cream: '#FFF8EA',
};
const WALL_TOP = 600, WALL_BOT = 1440, FEET = 1590;
const DOOR1 = { x0: 330, x1: 790, top: 690 };            // مفصّل يسار، يُدفع للداخل
const DOOR2 = { x0: 1460, x1: 1920, top: 690 };          // مفصّل يمين، يُسحب للخارج
const SIGN1 = { u: 0.9, y: 1262, txt: 'ادفع' };
const SIGN2 = { u: 0.9, y: 1262, txt: 'اسحب' };

let TM = {}, SC = [], DUR = 44, TAIL = 0;
function setTiming(lines, audioDur) {
  TM = {}; lines.forEach(l => TM[l.id] = l);
  const ids = lines.map(l => l.id);
  SC = ids.map((id, i) => ({ id, a: i === 0 ? 0 : TM[id].start - 0.12, b: i < ids.length - 1 ? TM[ids[i + 1]].start - 0.12 : TM[id].end + 0.35 }));
  TAIL = SC[SC.length - 1].b;
  DUR = Math.max(TAIL + 5.2, (audioDur || 0) + 0.3);
  return DUR;
}
// تقدم المشهد u ∈ [0,1] + الزمن المحلي
function sceneAt(t) {
  for (const s of SC) if (t >= s.a && t < s.b) return { ...s, u: (t - s.a) / (s.b - s.a), lt: t - s.a, d: s.b - s.a };
  return { id: 'TAIL', a: TAIL, b: DUR, u: (t - TAIL) / (DUR - TAIL), lt: t - TAIL, d: DUR - TAIL };
}
// زمن كلمة داخل سطر (من المحاذاة إن وجدت) كنسبة من المشهد
function wordU(id, idx, fallbackU) {
  const l = TM[id], s = SC.find(x => x.id === id);
  if (l && l.words && l.words[idx] && s) return clamp((l.words[idx].start - s.a) / (s.b - s.a));
  return fallbackU;
}

// ---------- أدوات رسم ----------
let g, camState = { x: 540, y: 960, z: 1, shake: 0, rot: 0 };
function applyCam(c, t) {
  const r = rng(Math.floor(t * 30) + 7);
  const sx = c.shake ? (r() - .5) * c.shake : 0, sy = c.shake ? (r() - .5) * c.shake : 0;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.translate(W / 2 + sx, H / 2 + sy);
  g.rotate(c.rot || 0);
  g.scale(c.z, c.z);
  g.translate(-c.x, -c.y);
}
function screen() { g.setTransform(1, 0, 0, 1, 0, 0); }

function drawSky(t, warm = true) {
  const gr = g.createLinearGradient(0, -400, 0, WALL_BOT);
  gr.addColorStop(0, warm ? COL.skyTop : '#F9E2B0'); gr.addColorStop(1, warm ? COL.sky : COL.gSky);
  g.fillStyle = gr; g.fillRect(-3000, -2000, 9000, 3600);
  // شمس ناعمة
  g.fillStyle = warm ? 'rgba(232,85,61,0.10)' : 'rgba(246,199,68,0.35)';
  g.beginPath(); g.arc(860, 260, 120, 0, Math.PI * 2); g.fill();
  // سحب ثابتة البذرة
  const r = rng(warm ? 11 : 23);
  g.fillStyle = 'rgba(255,255,255,0.75)';
  for (let i = 0; i < 7; i++) {
    const bx = -600 + i * 520 + r() * 200 + (t * (6 + r() * 6)) % 400, by = 120 + r() * 380, s = 0.7 + r() * 0.7;
    cloud(bx, by, s);
  }
}
function cloud(x, y, s) {
  g.beginPath();
  g.ellipse(x, y, 90 * s, 34 * s, 0, 0, Math.PI * 2);
  g.ellipse(x + 50 * s, y - 20 * s, 56 * s, 36 * s, 0, 0, Math.PI * 2);
  g.ellipse(x - 46 * s, y - 10 * s, 46 * s, 28 * s, 0, 0, Math.PI * 2);
  g.fill();
}
function drawWall(x0, x1, opts = {}) {
  g.fillStyle = COL.wall; g.fillRect(x0, WALL_TOP, x1 - x0, WALL_BOT - WALL_TOP);
  // طوب
  g.strokeStyle = COL.wallLine; g.lineWidth = 3;
  const rh = 48, bw = 116;
  for (let y = WALL_TOP + 40, row = 0; y < WALL_BOT; y += rh, row++) {
    g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke();
    const off = row % 2 ? bw / 2 : 0;
    for (let x = Math.floor((x0 - off) / bw) * bw + off; x < x1; x += bw) {
      if (x <= x0) continue;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x, Math.min(y + rh, WALL_BOT)); g.stroke();
    }
  }
  // تاج الجدار
  g.fillStyle = COL.wallTop; g.fillRect(x0, WALL_TOP - 6, x1 - x0, 46);
  // ظل القاعدة
  g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(x0, WALL_BOT - 14, x1 - x0, 14);
}
function drawFloor(grass = false) {
  g.fillStyle = grass ? COL.grass : COL.floor; g.fillRect(-3000, WALL_BOT, 9000, 1400);
  g.strokeStyle = grass ? COL.grassDark : COL.floorLine; g.lineWidth = 4;
  const r = rng(grass ? 5 : 3);
  for (let i = 0; i < 60; i++) {
    const x = -1200 + r() * 4200, y = WALL_BOT + 40 + r() * 420;
    g.beginPath();
    if (grass) { g.moveTo(x, y); g.lineTo(x - 6, y - 16); g.moveTo(x, y); g.lineTo(x + 7, y - 14); }
    else { g.moveTo(x, y); g.lineTo(x + 26 + r() * 30, y); }
    g.stroke();
  }
  if (grass) {
    for (let i = 0; i < 26; i++) {
      const x = -1200 + r() * 4200, y = WALL_BOT + 30 + r() * 420;
      g.fillStyle = r() > .5 ? COL.flower : '#FFFFFF';
      g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fill();
    }
  }
}
function shadow(x, y, w, a = 0.13) {
  g.fillStyle = `rgba(0,0,0,${a})`;
  g.beginPath(); g.ellipse(x, y + 4, w, w * 0.18, 0, 0, Math.PI * 2); g.fill();
}

// إسقاط لوحة باب مع منظور (θ>0 داخلًا بعيدًا عنا، θ<0 خارجًا نحونا)
function doorProj(D, hingeLeft, th, u, y) {
  const wd = D.x1 - D.x0, F = 1500, vx = 540 + (hingeLeft ? 0 : 1080), vy = 1250;
  const xh = hingeLeft ? D.x0 : D.x1, dir = hingeLeft ? 1 : -1;
  const z = u * wd * Math.sin(th);
  const p = F / (F + z);
  const xr = xh + dir * u * wd * Math.cos(th);
  return { x: vx + (xr - vx) * p, y: vy + (y - vy) * p, p };
}
function drawDoorPanel(D, hingeLeft, th, sign, signGlow = 0, seamA = 0.55) {
  const P = (u, y) => doorProj(D, hingeLeft, th, u, y);
  const a = P(0, D.top), b = P(1, D.top), c = P(1, WALL_BOT), d = P(0, WALL_BOT);
  if (Math.abs(th) > 0.001) {
    g.fillStyle = th > 0 ? '#B2A898' : '#CFC6B8';
    g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(c.x, c.y); g.lineTo(d.x, d.y); g.closePath(); g.fill();
    // خطوط الطوب على اللوحة (نفس التمويه)
    g.save(); g.clip();
    g.strokeStyle = COL.wallLine; g.lineWidth = 3;
    for (let y = WALL_TOP + 40; y < WALL_BOT; y += 48) {
      if (y < D.top) continue;
      const l = P(0, y), r = P(1, y); g.beginPath(); g.moveTo(l.x, l.y); g.lineTo(r.x, r.y); g.stroke();
    }
    g.restore();
    g.strokeStyle = 'rgba(31,30,36,0.35)'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(c.x, c.y); g.lineTo(d.x, d.y); g.closePath(); g.stroke();
  }
  // الفواصل الخفية (التمهيد)
  g.strokeStyle = `rgba(140,130,118,${seamA})`; g.lineWidth = 3;
  if (Math.abs(th) < 0.001) {
    g.beginPath(); g.moveTo(D.x0, WALL_BOT); g.lineTo(D.x0, D.top); g.lineTo(D.x1, D.top); g.lineTo(D.x1, WALL_BOT); g.stroke();
  }
  // اللافتة والمقبض
  const sp = P(sign.u, sign.y), hp = P(sign.u + 0.02, sign.y + 48);
  const sx = Math.cos(th) * sp.p, sy = sp.p;
  g.save();
  g.translate(sp.x, sp.y); g.scale(Math.max(0.15, sx), sy);
  if (signGlow > 0) {
    g.strokeStyle = COL.accent; g.lineWidth = 3;
    g.globalAlpha = signGlow;
    g.beginPath(); g.ellipse(0, 10, 34 + 4 * Math.sin(signGlow * 6), 30, 0, 0, Math.PI * 2); g.stroke();
    g.globalAlpha = 1;
  }
  g.fillStyle = COL.cream; g.strokeStyle = '#7E7466'; g.lineWidth = 1.5;
  roundRect(-17, -9, 34, 18, 3); g.fill(); g.stroke();
  g.fillStyle = COL.ink; g.font = '13px Cairo'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
  g.fillText(sign.txt, 0, 0.5);
  g.restore();
  g.fillStyle = '#5B5348';
  g.beginPath(); g.arc(hp.x, hp.y, 6 * sp.p, 0, Math.PI * 2); g.fill();
  return { a, b, c, d, sign: sp, handle: hp };
}
function roundRect(x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function drawGardenView(D, t) {
  // ما وراء الباب: حديقة مضيئة
  g.save();
  g.beginPath(); g.rect(D.x0, D.top, D.x1 - D.x0, WALL_BOT - D.top); g.clip();
  const gr = g.createLinearGradient(0, D.top, 0, WALL_BOT);
  gr.addColorStop(0, '#FFE9B8'); gr.addColorStop(1, '#FFF6DE');
  g.fillStyle = gr; g.fillRect(D.x0, D.top, D.x1 - D.x0, WALL_BOT - D.top);
  g.fillStyle = 'rgba(246,199,68,0.5)'; g.beginPath(); g.arc(D.x0 + 330, D.top + 170, 70, 0, Math.PI * 2); g.fill();
  g.fillStyle = COL.grass; g.fillRect(D.x0, 1180, D.x1 - D.x0, 300);
  g.fillStyle = COL.grassDark;
  g.beginPath(); g.ellipse(D.x0 + 120, 1185, 220, 40, 0, Math.PI, 0); g.fill();
  g.restore();
}
function ladder(x, baseY, topY, tilt = 0, alpha = 1) {
  g.save(); g.globalAlpha = alpha;
  g.strokeStyle = '#8A5A3C'; g.lineWidth = 11; g.lineCap = 'round';
  const wB = 52, wT = 44;
  g.beginPath(); g.moveTo(x - wB, baseY); g.lineTo(x - wT + tilt, topY); g.moveTo(x + wB, baseY); g.lineTo(x + wT + tilt, topY); g.stroke();
  g.lineWidth = 8;
  for (let i = 1; i < 9; i++) {
    const u = i / 9, y = lerp(baseY, topY, u), w = lerp(wB, wT, u), o = tilt * u;
    g.beginPath(); g.moveTo(x - w + o, y); g.lineTo(x + w + o, y); g.stroke();
  }
  g.restore();
}
function kite(x, y, rot = 0, s = 1, t = 0) {
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
  // ذيل
  g.strokeStyle = COL.ink; g.lineWidth = 4;
  g.beginPath(); g.moveTo(0, 70);
  for (let i = 1; i <= 6; i++) g.lineTo(Math.sin(t * 6 + i) * 14, 70 + i * 26);
  g.stroke();
  for (let i = 2; i <= 6; i += 2) {
    const bx = Math.sin(t * 6 + i) * 14, by = 70 + i * 26;
    g.fillStyle = COL.accent; g.beginPath(); g.moveTo(bx - 10, by - 8); g.lineTo(bx + 10, by + 8); g.lineTo(bx + 10, by - 8); g.lineTo(bx - 10, by + 8); g.closePath(); g.fill();
  }
  g.fillStyle = COL.accent; g.strokeStyle = COL.ink; g.lineWidth = 5; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(0, -70); g.lineTo(48, -6); g.lineTo(0, 70); g.lineTo(-48, -6); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.moveTo(0, -70); g.lineTo(48, -6); g.lineTo(0, -6); g.closePath(); g.fill();
  g.lineWidth = 3; g.beginPath(); g.moveTo(0, -70); g.lineTo(0, 70); g.moveTo(-48, -6); g.lineTo(48, -6); g.stroke();
  g.restore();
}
function windLines(t, x, y, a = 1, len = 260) {
  g.save(); g.strokeStyle = `rgba(31,30,36,${0.35 * a})`; g.lineWidth = 5; g.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const ph = (t * 2.2 + i * 0.33) % 1, xx = x - 200 + ph * 500, yy = y + i * 60;
    g.beginPath(); g.moveTo(xx, yy); g.bezierCurveTo(xx + len * .3, yy - 20, xx + len * .6, yy + 20, xx + len, yy - 10);
    g.stroke();
  }
  g.restore();
}
function hammer(gg, hand, ang, len, broken = false) {
  gg.save(); gg.translate(hand.x, hand.y); gg.rotate(ang);
  gg.strokeStyle = '#8A5A3C'; gg.lineWidth = 10; gg.lineCap = 'round';
  gg.beginPath(); gg.moveTo(0, 10); gg.lineTo(0, broken ? -len * 0.45 : -len); gg.stroke();
  if (broken) { // طرف مكسور مسنن
    gg.strokeStyle = '#6E452D'; gg.lineWidth = 4;
    gg.beginPath(); gg.moveTo(-5, -len * 0.45); gg.lineTo(0, -len * 0.45 - 10); gg.lineTo(5, -len * 0.45 - 2); gg.stroke();
  } else {
    gg.fillStyle = '#5E6168'; gg.strokeStyle = COL.ink; gg.lineWidth = 4;
    const hs = Math.max(0.35, len / 150);
    roundRectG(gg, -34 * hs, -len - 18 * hs, 68 * hs, 34 * hs, 6); gg.fill(); gg.stroke();
  }
  gg.restore();
}
function roundRectG(gg, x, y, w, h, r) {
  gg.beginPath(); gg.moveTo(x + r, y); gg.arcTo(x + w, y, x + w, y + h, r); gg.arcTo(x + w, y + h, x, y + h, r);
  gg.arcTo(x, y + h, x, y, r); gg.arcTo(x, y, x + w, y, r); gg.closePath();
}

// نص عربي ظاهر (مساحة الشاشة)
function caption(s, x, y, size, opts = {}) {
  const a = opts.alpha ?? 1; if (a <= 0) return;
  screen();
  g.save(); g.globalAlpha = a;
  g.translate(x, y); const sc = opts.scale ?? 1; g.scale(sc, sc); g.rotate(opts.rot || 0);
  g.font = `${size}px ${opts.font || 'Lalezar'}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
  g.lineJoin = 'round';
  if (opts.box) {
    const m = g.measureText(s), w = m.width + size * 0.9, h = size * 1.35;
    g.fillStyle = opts.box; roundRect(-w / 2, -h / 2, w, h, size * 0.3); g.fill();
  }
  g.strokeStyle = opts.stroke || COL.cream; g.lineWidth = opts.strokeW ?? size * 0.16;
  if (opts.strokeW !== 0) g.strokeText(s, 0, 0);
  g.fillStyle = opts.color || COL.ink; g.fillText(s, 0, 0);
  g.restore();
}
function popIn(u) { return u <= 0 ? 0 : ease.back(clamp(u)); }

// ---------- القصة ----------
function render(t) {
  const S = sceneAt(t), u = S.u, lt = S.lt;
  let cam = { x: 540, y: 960, z: 1, shake: 0, rot: 0 };
  let world = 'A', th1 = 0, th2 = 0, seamA = 0.5, glow1 = 0, glow2 = 0;
  let P = basePose(230, FEET, 1);
  let kiteS = null, ladderS = null, hammerS = null, headPiece = null, stick = null, overlays = [], impact = null, wind = null;
  let charBehind = false, gardenKite = null, door2Show = false, doorOutline = 0;

  if (S.id === 'L1') {
    // افتتاح: الخيط ينقطع فورًا، ثم كشف الجدار العملاق
    const snap = 0.07;
    P = idle(basePose(230, FEET, 1), t);
    const hold = u < snap;
    P.hR = { x: 40, y: -60 }; P.hL = { x: 20, y: -20 };
    P.look = { x: 4, y: -6 };
    if (!hold) {
      const k = seg(u, snap, snap + .08);
      P.hR = lp({ x: 40, y: -60 }, { x: 54, y: -90 }, ease.out(k));
      P.mouth = 'o'; P.brow = 1;
      P.y -= Math.sin(k * Math.PI) * 18;
    }
    if (u > 0.45) { // يركض نحو الجدار
      const k = seg(u, 0.5, 1);
      const s = ease.io(k) * 210;
      gait(P, s, FEET, { stride: 120, run: 1 });
      P.x = 230 + s; P.mouth = 'o'; P.hR = { x: 50, y: -40 };
    }
    // الطائرة
    const k1 = seg(u, snap, 0.42), k2 = seg(u, 0.42, 0.78);
    let kx = 520 + Math.sin(t * 2.1) * 14, ky = 470 + Math.sin(t * 3.1) * 10, kr = Math.sin(t * 2.5) * 0.12;
    if (!hold) {
      kx = lerp(kx, 900, ease.out(k1)); ky = lerp(ky, 230, ease.out(k1)); kr += k1 * 0.7;
      if (k2 > 0) { kx = lerp(900, 1010, k2); ky = lerp(230, 980, ease.in(k2)); kr += k2 * 2.4; }
    }
    kiteS = { x: kx, y: ky, r: kr, s: 1, behind: !hold, string: hold ? 'hand' : (u < snap + .2 ? 'loose' : null), su: seg(u, snap, snap + .2) };
    wind = { a: 1 - seg(u, 0.15, 0.3), x: 180, y: 300 };
    const zk = ease.io(seg(u, 0.38, 0.85));
    cam = { x: lerp(390, 540, zk), y: lerp(1010, 960, zk), z: lerp(1.38, 1.0, zk) };
  }

  if (S.id === 'L2') {
    // قفز... لم يصل
    P = basePose(440, FEET, 1);
    const k = seg(u, 0, .22);
    if (k < 1) { gait(P, ease.out(k) * 140, FEET, { stride: 120, run: 1 }); P.x = 440 + ease.out(k) * 140; }
    else P.x = 580;
    const cr = seg(u, .22, .34), up = seg(u, .34, .55), dn = seg(u, .62, .8);
    P.turn = ease.io(seg(u, .18, .3)); P.back = P.turn > .5;
    if (cr > 0) {
      const squat = Math.sin(clamp(cr) * Math.PI / 2) * (1 - up);
      const h = up < 1 ? ease.out(up) * 300 : 300 * (1 - ease.in(dn));
      P.y = FEET - 140 + squat * 44 - h;
      P.fL = { x: -34, y: 140 - squat * 44 + (h > 0 ? -20 : 0) }; P.fR = { x: 34, y: 140 - squat * 44 + (h > 0 ? -20 : 0) };
      P.hL = { x: -40, y: lerp(60, -150, ease.out(up)) * (1 - dn) + dn * 60 };
      P.hR = { x: 40, y: lerp(60, -150, ease.out(up)) * (1 - dn) + dn * 60 };
      if (u > .8) { const l = seg(u, .8, .9); P.y += Math.sin(l * Math.PI) * 26; } // ارتطام وهبوط
    }
    if (u > .85) { P.turn = 1; P.back = false; P.mouth = -0.9; P.brow = 1; P.look = { x: 0, y: -8 }; P.headTilt = 0; }
    cam = { x: 560, y: lerp(960, 900, Math.sin(seg(u, .3, .85) * Math.PI)), z: 1.05 };
    overlays.push(() => {
      // مؤشر المسافة إلى القمة عند الذروة
      const a = seg(u, .45, .52) * (1 - seg(u, .7, .78));
      if (a > 0) dashed(580, FEET - 440 - 150, 580, WALL_TOP + 50, a);
    });
  }

  if (S.id === 'L3') {
    // سُلّم... قصير
    P = basePose(580, FEET, -1);
    const out = seg(u, 0, .2), back = seg(u, .24, .46), raise = seg(u, .46, .56), climb = seg(u, .58, .86);
    if (out < 1) { const s = ease.in(out) * 760; gait(P, s, FEET, { stride: 130, run: 1 }); P.x = 580 - s; }
    else if (back < 1) {
      P.face = 1; const s = ease.out(back) * 380; gait(P, s, FEET, { stride: 120, run: 1 }); P.x = -180 + s;
      P.hL = { x: 30, y: 70 }; P.hR = { x: 50, y: 74 };
      ladderS = { carry: true }; P._carry = true;
    } else {
      P.x = 190; P.face = 1;
      if (raise < 1) {
        P.hL = { x: 36, y: lerp(70, -40, raise) }; P.hR = { x: 52, y: lerp(74, -60, raise) };
        ladderS = { stand: true, a: ease.out(raise) };
      } else {
        ladderS = { stand: true, a: 1 };
        // تسلق (من الخلف)
        P.turn = 1; P.back = true;
        const steps = 4, cs = climb * steps, st = Math.floor(Math.min(cs, steps - 0.001)), f = cs - st;
        const rung = 58;
        const base = FEET - 140 - (st + ease.io(f)) * rung;
        P.y = climb > 0 ? base : FEET - 140; P.x = 200;
        const alt = st % 2 ? 1 : -1;
        P.fL = { x: -34, y: 140 - (alt > 0 ? (1 - ease.io(f)) * rung : 0) };
        P.fR = { x: 34, y: 140 - (alt < 0 ? (1 - ease.io(f)) * rung : 0) };
        P.hL = { x: -40, y: -70 - (alt < 0 ? ease.io(f) * 40 : 40) };
        P.hR = { x: 40, y: -70 - (alt > 0 ? ease.io(f) * 40 : 40) };
        if (climb >= 1) { P.hL = { x: -40, y: -110 }; P.hR = { x: 40, y: -110 }; }
      }
    }
    cam = { x: 520, y: lerp(960, 820, ease.io(seg(u, .6, .95))), z: lerp(1.0, 0.92, ease.io(seg(u, .6, .95))) };
    overlays.push(() => {
      const a = seg(u, .86, .92);
      if (a > 0) {
        dashed(200, FEET - 140 - 4 * 58 - 260, 200, WALL_TOP + 50, a);
        caption('؟', ws(330, 760).x, ws(330, 760).y, 120, { alpha: a, scale: popIn(seg(u, .86, .95)), color: COL.accent });
      }
    });
  }

  if (S.id === 'L4') {
    // مطرقة... فانكسرت
    ladderS = { stand: true, a: 1 };
    const hop = seg(u, 0, .14), pull = seg(u, .16, .26), wind_ = seg(u, .28, .44), strike = seg(u, .44, .5), aft = seg(u, .5, 1);
    P = basePose(620, FEET, 1);
    if (hop < 1) {
      P.turn = 1 - hop; P.back = hop < .5;
      P.x = lerp(200, 640, hop); P.y = lerp(FEET - 140 - 232, FEET - 140, ease.in(hop)) - Math.sin(hop * Math.PI) * 60;
      P.hL = { x: -30, y: -40 }; P.hR = { x: 30, y: -40 };
    } else {
      P.x = 640; idle(P, t, .6);
      P.turn = 1; P.back = true;
      if (pull > 0) {
        // رفع ثم ضرب (من الخلف نحو الجدار)
        const wu = ease.out(wind_), su = ease.in(strike);
        const handY = lerp(lerp(70, -150, wu), -10, su);
        P.hL = { x: -8, y: handY }; P.hR = { x: 8, y: handY };
        P.y += -wu * 10 + su * 20;
        P.lean = 0;
        const len = lerp(lerp(120, 150, wu), 60, su);
        const broken = aft > 0;
        hammerS = { ang: lerp(lerp(0.4, 0, wu), 0, su), len, broken, scale: popIn(pull) };
        if (aft > 0) {
          // التفات للأمام ونظرة ذهول للمقبض المكسور
          const tu = seg(u, .62, .74);
          P.back = tu < .5; P.turn = 1;
          if (tu > 0) {
            P.hR = { x: 30, y: lerp(-10, 20, tu) }; P.hL = { x: -10, y: 108 };
            hammerS.ang = lerp(0, -0.5, tu); hammerS.len = lerp(60, 150, tu);
          }
          if (tu >= .5) { P.mouth = -0.4; P.look = { x: 8, y: 2 }; P.brow = 0.7; if ((t * 10) % 13 < 1) P.blink = 1; }
          const hk = seg(u, .5, .66);
          headPiece = { x: 640 + hk * 70, y: lerp(1200, FEET - 20, ease.in(hk)) - Math.sin(hk * Math.PI) * 60, r: hk * 4.2, bounce: seg(u, .66, .74) };
        }
      }
    }
    if (strike >= 1) impact = { x: 640, y: 1200, k: seg(u, .5, .62) };
    cam = { x: 600, y: 1080, z: 1.12, shake: (u > .5 && u < .56) ? 26 : 0 };
    overlays.push(() => {
      const k = seg(u, .5, .58), a = 1 - seg(u, .7, .8);
      if (k > 0) caption('طَراخ!', 760, 760, 130, { scale: popIn(k), rot: -0.12, alpha: a, color: COL.accent });
    });
  }

  if (S.id === 'L5') {
    // جلس متعبًا واستند
    ladderS = { stand: true, a: 1 };
    stick = { x: lerp(690, 720, seg(u, 0, .15)), y: lerp(1500, FEET - 6, ease.in(seg(u, 0, .15))), r: lerp(-0.4, 1.4, seg(u, 0, .15)) };
    headPiece = { x: 710, y: FEET - 20, r: 4.2, bounce: 1 };
    const sit = ease.io(seg(u, .1, .45)), lean = ease.io(seg(u, .55, .95));
    P = basePose(640, FEET, 1);
    P.turn = 1; P.back = false; idle(P, t, .5);
    P.y = lerp(FEET - 140, FEET - 40, sit) - lean * 6;
    P.fL = lp({ x: -24, y: 140 }, { x: -86, y: 40 }, sit); P.fR = lp({ x: 24, y: 140 }, { x: 86, y: 40 }, sit);
    P.hL = lp({ x: -14, y: 108 }, { x: -70, y: 76 }, sit); P.hR = lp({ x: 14, y: 108 }, { x: 70, y: 76 }, sit);
    P.mouth = -0.7; P.brow = 0.8; P.look = { x: 0, y: lerp(0, 6, sit) - lean * 10 };
    P.headTilt = lerp(0, 0.18, sit) - lean * 0.28;
    P.blink = Math.max(P.blink, lean * 0.7);
    cam = { x: 600, y: lerp(1120, 1200, sit), z: lerp(1.12, 1.3, ease.io(u)) };
  }

  if (S.id === 'L6') {
    // فانفتح!
    ladderS = { stand: true, a: 1 };
    stick = { x: 720, y: FEET - 6, r: 1.4 }; headPiece = { x: 710, y: FEET - 20, r: 4.2, bounce: 1 };
    const op = ease.io(seg(u, 0, .22)), fall = seg(u, .06, .45);
    th1 = lerp(0, 1.25, op) + Math.sin(seg(u, .22, .7) * Math.PI * 2) * 0.06 * (1 - seg(u, .22, .7));
    P = basePose(640, FEET, 1); P.turn = 1;
    const f = ease.out(fall);
    P.y = lerp(FEET - 46, FEET - 150, f); P.scale = lerp(1, 0.84, f);
    P.fL = lp({ x: -86, y: 40 }, { x: -60, y: -110 }, f); P.fR = lp({ x: 86, y: 40 }, { x: 60, y: -120 }, f);
    P.hL = lp({ x: -70, y: 76 }, { x: -110, y: -60 }, f); P.hR = lp({ x: 70, y: 76 }, { x: 110, y: -70 }, f);
    P.mouth = 'o'; P.brow = 1; P.look = { x: 0, y: -4 };
    if (u > .6) { const b = seg(u, .6, .75); P.y += Math.sin(b * Math.PI) * -12; const w = Math.sin(t * 18) * 14 * (1 - seg(u, .75, 1)); P.fL.x += w; P.fR.x -= w; }
    charBehind = true;
    cam = { x: 580, y: lerp(1200, 1080, ease.out(seg(u, 0, .5))), z: lerp(1.3, 1.0, ease.out(seg(u, 0, .5))), shake: u > .3 && u < .42 ? 14 : 0 };
    overlays.push(() => { const k = seg(u, .12, .3); if (k > 0) caption('!', 860, 560, 260, { scale: popIn(k), color: COL.accent, alpha: 1 - seg(u, .85, 1) }); });
  }

  if (S.id === 'L7') {
    // لم يكن جدارًا... كان بابًا... ادفع
    ladderS = { stand: true, a: 1 };
    stick = { x: 720, y: FEET - 6, r: 1.4 }; headPiece = { x: 710, y: FEET - 20, r: 4.2, bounce: 1 };
    th1 = lerp(1.25, 0.95, ease.io(seg(u, .35, .5)));
    charBehind = true;
    const up = ease.io(seg(u, 0, .2));
    P = basePose(640, FEET - 110, 1); P.scale = 0.84; P.turn = 1;
    P.y = lerp(FEET - 150, FEET - 110 - 140 * 0.84, up);
    P.fL = lp({ x: -60, y: -110 }, { x: -22, y: 140 }, up); P.fR = lp({ x: 60, y: -120 }, { x: 22, y: 140 }, up);
    P.hL = lp({ x: -110, y: -60 }, { x: -12, y: 108 }, up); P.hR = lp({ x: 110, y: -70 }, { x: 12, y: 108 }, up);
    if (up >= 1) {
      idle(P, t, .6);
      // ينظر إلى اللوحة
      const lk = ease.io(seg(u, .2, .32));
      P.turn = 1 - lk * 0.85; P.face = -1; P.look = { x: -6 * lk, y: 0 }; P.mouth = 0;
    }
    doorOutline = seg(u, .25, .35) * (1 - seg(u, .5, .6));
    const zIn = ease.io(seg(u, .45, .6)), zOut = ease.io(seg(u, .86, .97));
    // موضع اللافتة على اللوحة المفتوحة
    const sp = doorProj(DOOR1, true, th1, SIGN1.u, SIGN1.y);
    glow1 = seg(u, wordU('L7', 7, .6), wordU('L7', 7, .6) + .06);
    const z = lerp(1.0, 2.2, zIn) * (1 - zOut) + zOut * 1.15;
    cam = { x: lerp(560, sp.x, zIn) * (1 - zOut) + zOut * 600, y: lerp(1100, sp.y + 4, zIn) * (1 - zOut) + zOut * 1200, z };
    if (zOut > 0) { // كف على الجبين
      P.turn = 1; P.face = 1; P.hR = lp(P.hR, { x: 10, y: -40 }, zOut); P.mouth = -0.5; P.brow = 1; P.blink = zOut > .5 ? 1 : 0;
    }
    overlays.push(() => {
      const k = seg(u, .3, .38);
      if (k > 0 && zIn < 0.3) caption('كان بابًا!', 540, 470, 120, { scale: popIn(k), alpha: 1 - seg(u, .44, .5) });
      const mk = seg(u, wordU('L7', 7, .6), wordU('L7', 7, .6) + .07) * (1 - seg(u, .86, .92));
      if (mk > 0) magnifier(sp, SIGN1.txt, mk, seg(u, wordU('L7', 11, .74), wordU('L7', 11, .74) + .05), true);
    });
  }

  if (S.id === 'L8') {
    // الرسالة: في الحديقة
    world = 'B';
    const walk = seg(u, 0, .28), pick = seg(u, .3, .42);
    P = basePose(300, FEET, 1);
    if (walk < 1) { const s = ease.io(walk) * 300; gait(P, s, FEET); P.x = 300 + s; }
    else {
      P.x = 600; idle(P, t, .8);
      const bend = Math.sin(pick * Math.PI);
      P.lean = bend * 0.6; P.y += bend * 36;
      P.hR = { x: lerp(10, 70, bend), y: lerp(108, 150, bend) };
      if (pick >= .5) {
        P.hR = { x: 44, y: 40 }; P.hL = { x: 12, y: 30 };
        P.turn = ease.io(seg(u, .42, .52)); P.mouth = 1; P.look = { x: 0, y: 0 };
      }
    }
    if (pick < .5) gardenKite = { x: 700, y: FEET - 10, r: 1.35 };
    else kiteS = { held: true, r: -0.25 };
    cam = { x: 560, y: 1150, z: 1.0 };
    overlays.push(() => {
      const a1 = seg(u, .08, .16), a2 = seg(u, wordU('L8', 5, .5), wordU('L8', 5, .5) + .08);
      caption('لا نحتاج قوةً أكبر', 540, 430, 104, { alpha: a1, scale: lerp(.85, 1, ease.out(a1)) });
      if (a2 > 0) {
        caption('بل نظرةً', 640, 600, 120, { alpha: a2, scale: popIn(a2) });
        caption('أقرب', 330, 600, 150, { alpha: a2, scale: popIn(seg(u, wordU('L8', 7, .66), wordU('L8', 7, .66) + .1)), color: COL.accent });
      }
    });
  }

  if (S.id === 'L9') {
    // عاد بطائرته... جدار آخر
    world = 'B'; door2Show = true;
    const walk = seg(u, 0, .62);
    P = basePose(600, FEET, 1);
    const s = ease.io(walk) * 780; gait(P, s, FEET); P.x = 600 + s;
    kiteS = { held: true, r: -0.25 };
    P.hR = { x: 44, y: 40 }; P.mouth = 1;
    if (walk >= 1) {
      idle(P, t, .8); P.hR = { x: 44, y: 40 };
      const lu = seg(u, .62, .8);
      P.look = { x: 0, y: -10 * lu }; P.headTilt = -0.25 * lu; P.mouth = lerp(1, -0.3, lu); P.brow = lu * 0.8;
    }
    cam = { x: lerp(600, 1460, ease.io(seg(u, .05, .7))), y: lerp(1150, 1000, ease.io(seg(u, .5, .9))), z: lerp(1.0, 0.95, seg(u, .5, .9)) };
  }

  if (S.id === 'L10') {
    // هذه المرة... قرأ أولًا
    world = 'B'; door2Show = true;
    P = basePose(1380, FEET, 1); idle(P, t, .7);
    kiteS = { held: true, r: -0.25 };
    P.hR = { x: -10, y: 120 };
    const close = ease.io(seg(u, 0, .25)), read = seg(u, .25, .6), pull = ease.io(seg(u, .62, .82)), go = seg(u, .84, 1);
    // يقترب من الجدار (يصغر قليلًا ويرتفع)
    P.x = lerp(1380, 1400, close); P.y -= close * 40; P.scale = lerp(1, 0.94, close);
    P.lean = close * 0.25 * (1 - pull); P.look = { x: 6 * close, y: 2 }; P.brow = -0.5 * close;
    if (read > 0) { P.mouth = 'o'; }
    if (read >= 1) { P.mouth = 1; P.brow = 0; }
    const sp = doorProj(DOOR2, false, 0, SIGN2.u, SIGN2.y);
    glow2 = seg(u, .3, .4);
    if (pull > 0) {
      P.hL = { x: 104, y: 70 }; P.x = lerp(P.x, 1395, pull) - pull * 40;
      th2 = -lerp(0, 1.15, pull);
    }
    if (go > 0) {
      const s = ease.io(go) * 300; P.x = 1340 + s; P.scale = lerp(0.94, 0.86, go); P.y = lerp(FEET - 140 - 40, FEET - 140 - 110, go);
      gait(P, s, FEET - 110 * go); P.y -= 40 * (1 - go); P.hR = { x: 44, y: 40 }; P.mouth = 1;
      charBehind = true;
    }
    const zr = ease.io(seg(u, .2, .32)) * (1 - ease.io(seg(u, .56, .66)));
    cam = { x: lerp(1460, sp.x - 60, zr), y: lerp(1000, sp.y - 20, zr), z: lerp(0.95, 2.0, zr) };
    overlays.push(() => {
      const k = seg(u, .66, .74);
      if (k > 0) caption('قرأ أولًا', 540, 470, 120, { scale: popIn(k), alpha: 1 - seg(u, .9, 1) });
      const mk = seg(u, .24, .32) * (1 - seg(u, .58, .64));
      if (mk > 0) magnifier(sp, SIGN2.txt, mk, seg(u, wordU('L10', 3, .36), wordU('L10', 3, .36) + .05), false);
    });
  }

  if (S.id === 'TAIL') {
    // ما بعد الباب الثاني: جدار جديد... وطائرة في الريح (حلقة تعود للبداية)
    const fin = seg(lt, S.d - 1.4, S.d - 0.9); // انتقال إلى إطار البداية
    const run = seg(u, 0, .45);
    P = basePose(-40, FEET, 1);
    const s = ease.out(run) * 270; gait(P, s, FEET, { stride: 120, run: run < 1 ? 1 : 0 }); P.x = -40 + s;
    if (run >= 1) { P = idle(basePose(230, FEET, 1), t); P.hR = { x: 40, y: -60 }; P.hL = { x: 20, y: -20 }; P.mouth = 1; P.look = { x: 4, y: -6 }; }
    const rise = ease.out(seg(u, .15, .6));
    kiteS = { x: lerp(250, 520, rise) + Math.sin(t * 2.1) * 14, y: lerp(1300, 470, rise) + Math.sin(t * 3.1) * 10, r: Math.sin(t * 2.5) * 0.12, s: 1, string: 'hand' };
    wind = { a: seg(u, .1, .3) * (1 - seg(u, .5, .7)), x: 180, y: 300 };
    const zk = ease.io(seg(u, 0.5, 0.8));
    cam = { x: lerp(540, 390, zk), y: lerp(960, 1010, zk), z: lerp(1.0, 1.38, zk) };
    overlays.push(() => {
      const a = seg(lt, 0.6, 1.0) * (1 - seg(lt, S.d - 1.6, S.d - 1.2));
      caption('ما الجدار الذي', 540, 1020, 96, { alpha: a, box: 'rgba(255,248,234,0.92)', strokeW: 0 });
      caption('لم تقرأه بعد؟', 540, 1150, 110, { alpha: a, color: COL.accent, box: 'rgba(255,248,234,0.92)', strokeW: 0 });
    });
    if (fin > 0) cam = { ...cam }; // الإطار الأخير مطابق للبداية عبر نفس التركيب
  }

  // ---------- الرسم ----------
  camState = cam;
  screen(); g.fillStyle = COL.sky; g.fillRect(0, 0, W, H);
  applyCam(cam, t);
  if (world === 'A' || S.id === 'TAIL') {
    drawSky(t, true);
    if (kiteS && kiteS.behind) kite(kiteS.x, kiteS.y, kiteS.r, kiteS.s, t);
    drawWall(-1400, 2600);
    drawFloor(S.id === 'TAIL');
    if (S.id !== 'TAIL') {
      if (th1 > 0) {
        // فتحة الباب: الحديقة خلفه
        g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(DOOR1.x0, DOOR1.top, DOOR1.x1 - DOOR1.x0, WALL_BOT - DOOR1.top);
        drawGardenView(DOOR1, t);
        // الطائرة على عشب الحديقة
        if (S.id === 'L6' || S.id === 'L7') { g.save(); g.beginPath(); g.rect(DOOR1.x0, DOOR1.top, DOOR1.x1 - DOOR1.x0, WALL_BOT - DOOR1.top); g.clip(); kite(700, 1330, 1.3, 0.6, t); g.restore(); }
      }
      const dp = drawDoorPanel(DOOR1, true, th1, SIGN1, glow1, th1 > 0 ? 0 : 0.5);
      if (th1 > 0 && charBehind) { drawCharWithProps(P, t, kiteS, hammerS); }
      if (doorOutline > 0) {
        g.save(); g.strokeStyle = COL.accent; g.globalAlpha = doorOutline; g.lineWidth = 10; g.setLineDash([26, 18]); g.lineDashOffset = -t * 80;
        g.beginPath(); g.moveTo(dp.a.x, dp.a.y); g.lineTo(dp.b.x, dp.b.y); g.lineTo(dp.c.x, dp.c.y); g.lineTo(dp.d.x, dp.d.y); g.closePath(); g.stroke();
        g.restore();
      }
    } else {
      // الجدار الجديد في الحلقة (نفس تركيب البداية)
      drawDoorPanel(DOOR1, true, 0, SIGN1, 0, 0.5);
    }
  } else {
    // عالم الحديقة
    drawSky(t, false);
    if (door2Show) { drawWall(1300, 4200); }
    drawFloor(true);
    // طيور بسيطة
    g.strokeStyle = COL.ink; g.lineWidth = 4;
    for (let i = 0; i < 3; i++) { const bx = 200 + i * 90 + (t * 40) % 1200, by = 380 + i * 30 + Math.sin(t * 3 + i) * 8; g.beginPath(); g.moveTo(bx - 14, by); g.quadraticCurveTo(bx - 7, by - 10, bx, by); g.quadraticCurveTo(bx + 7, by - 10, bx + 14, by); g.stroke(); }
    if (door2Show) {
      if (th2 < 0) { g.fillStyle = '#2A2A30'; g.fillRect(DOOR2.x0, DOOR2.top, DOOR2.x1 - DOOR2.x0, WALL_BOT - DOOR2.top); drawGardenView(DOOR2, t); }
      if (charBehind) drawCharWithProps(P, t, kiteS, hammerS);
      if (th2 === 0) drawDoorPanel(DOOR2, false, 0, SIGN2, glow2, 0.5);
    }
    if (gardenKite) kite(gardenKite.x, gardenKite.y, gardenKite.r, 0.8, t);
  }
  // الأغراض الأمامية
  if (ladderS && ladderS.stand) {
    const a = ladderS.a; ladder(200, FEET + 4, lerp(FEET - 60, FEET - 520, a), 0, 1);
  }
  if (headPiece) {
    g.save(); const by = headPiece.bounce > 0 && headPiece.bounce < 1 ? -Math.sin(headPiece.bounce * Math.PI) * 24 : 0;
    g.translate(headPiece.x, headPiece.y + by); g.rotate(headPiece.r);
    g.fillStyle = '#5E6168'; g.strokeStyle = COL.ink; g.lineWidth = 4; roundRect(-34, -17, 68, 34, 6); g.fill(); g.stroke(); g.restore();
    shadow(headPiece.x, FEET - 2, 30, 0.1);
  }
  if (stick) { g.save(); g.translate(stick.x, stick.y); g.rotate(stick.r); g.strokeStyle = '#8A5A3C'; g.lineWidth = 10; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, -34); g.lineTo(0, 34); g.stroke(); g.restore(); }
  if (impact) impactBurst(impact.x, impact.y, impact.k);
  if (!charBehind) {
    shadow(P.x, FEET, 60 * P.scale, 0.12 * clamp(1 - (FEET - 140 - P.y) / 500));
    drawCharWithProps(P, t, kiteS, hammerS);
  }
  if (world === 'B' && door2Show && th2 !== 0) {
    const dp = drawDoorPanel(DOOR2, false, th2, SIGN2, glow2, 0.5);
    if (th2 < 0 && !charBehind) { /* اللوحة أمامه */ }
  }
  if (kiteS && !kiteS.behind && !kiteS.held && kiteS.x !== undefined) {
    kite(kiteS.x, kiteS.y, kiteS.r, kiteS.s, t);
  }
  // خيط الطائرة
  if (kiteS && kiteS.string) drawString(P, kiteS, t);
  if (wind && wind.a > 0) windLines(t, wind.x, wind.y, wind.a);
  // نصوص الشاشة
  overlays.forEach(f => f());
  // تغميق الأطراف (vignette) خفيف
  screen();
  const vg = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(60,40,20,0.16)');
  g.fillStyle = vg; g.fillRect(0, 0, W, H);
  // انتقال الحلقة في النهاية: مسح بخطوط ريح
  if (S.id === 'TAIL') {
    const k = seg(lt, S.d - 1.3, S.d - 0.7);
    // لا شيء: الإطار الأخير مصمم ليطابق الأول تكوينًا
  }
}

let lastHand = null;
function drawCharWithProps(P, t, kiteS, hammerS) {
  if (kiteS && kiteS.held) {
    P.prop = (gg, hand) => { kiteHeld(gg, hand, kiteS.r, t); };
  } else if (hammerS) {
    P.prop = (gg, hand, handB) => {
      const m = { x: (hand.x + handB.x) / 2, y: (hand.y + handB.y) / 2 };
      gg.save(); gg.translate(m.x, m.y); gg.scale(hammerS.scale, hammerS.scale); gg.translate(-m.x, -m.y);
      hammer(gg, m, hammerS.ang, hammerS.len, hammerS.broken); gg.restore();
    };
  } else if (P._carry) {
    P.prop = (gg, hand, handB) => {
      const m = { x: (hand.x + handB.x) / 2, y: (hand.y + handB.y) / 2 };
      gg.strokeStyle = '#8A5A3C'; gg.lineWidth = 10; gg.lineCap = 'round';
      gg.beginPath(); gg.moveTo(m.x - 200, m.y - 18); gg.lineTo(m.x + 200, m.y - 18); gg.moveTo(m.x - 200, m.y + 18); gg.lineTo(m.x + 200, m.y + 18); gg.stroke();
      gg.lineWidth = 7; for (let i = -4; i <= 4; i++) { gg.beginPath(); gg.moveTo(m.x + i * 46, m.y - 18); gg.lineTo(m.x + i * 46, m.y + 18); gg.stroke(); }
    };
  }
  const r = drawChar(g, P, CH.nader, t);
  lastHand = r ? { x: P.x + r.hand.x * P.scale, y: P.y + r.hand.y * P.scale } : null;
  P.prop = null;
}
function kiteHeld(gg, hand, r, t) {
  gg.save(); gg.translate(hand.x + 24, hand.y - 62); gg.rotate(r); gg.scale(0.62, 0.62);
  gg.fillStyle = COL.accent; gg.strokeStyle = COL.ink; gg.lineWidth = 7; gg.lineJoin = 'round';
  gg.beginPath(); gg.moveTo(0, -70); gg.lineTo(48, -6); gg.lineTo(0, 70); gg.lineTo(-48, -6); gg.closePath(); gg.fill(); gg.stroke();
  gg.lineWidth = 4; gg.beginPath(); gg.moveTo(0, -70); gg.lineTo(0, 70); gg.moveTo(-48, -6); gg.lineTo(48, -6); gg.stroke();
  gg.beginPath(); gg.moveTo(0, 70); for (let i = 1; i <= 4; i++) gg.lineTo(Math.sin(t * 5 + i) * 10, 70 + i * 22); gg.stroke();
  gg.restore();
}
function drawString(P, k, t) {
  if (!lastHand) return;
  const h = lastHand;
  g.save(); g.strokeStyle = COL.ink; g.lineWidth = 3;
  if (k.string === 'hand') {
    g.beginPath(); g.moveTo(h.x, h.y);
    g.quadraticCurveTo((h.x + k.x) / 2 + 40, (h.y + k.y) / 2 + 60, k.x, k.y + 40); g.stroke();
  } else if (k.string === 'loose') {
    // الخيط المقطوع يرتخي ويسقط
    const su = k.su;
    g.globalAlpha = 1 - su;
    g.beginPath(); g.moveTo(h.x, h.y);
    g.quadraticCurveTo(h.x + 60, h.y - 200 + su * 260, h.x + 30 + su * 40, h.y - 420 + su * 400); g.stroke();
  }
  g.restore();
}
function impactBurst(x, y, k) {
  if (k <= 0 || k >= 1) return;
  g.save(); g.strokeStyle = COL.accent; g.lineWidth = 10 * (1 - k); g.lineCap = 'round';
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2 + 0.3, r1 = 30 + k * 60, r2 = 60 + k * 150;
    g.beginPath(); g.moveTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); g.lineTo(x + Math.cos(a) * r2, y + Math.sin(a) * r2); g.stroke();
  }
  g.fillStyle = `rgba(255,248,234,${1 - k})`; g.beginPath(); g.arc(x, y, 40 + k * 30, 0, Math.PI * 2); g.fill();
  g.restore();
}
// عدسة مكبرة تُظهر كلمة اللافتة بوضوح («نظرة أقرب»)
function magnifier(spWorld, txt, k, hit, left = false) {
  const p = ws(spWorld.x, spWorld.y);
  const sc = popIn(k);
  const cx = clamp(p.x + (left ? -230 : 230), 260, 820), cy = clamp(p.y - 300, 330, 1400);
  screen();
  g.save(); g.globalAlpha = clamp(k * 3);
  g.strokeStyle = COL.ink; g.lineWidth = 5; g.setLineDash([12, 10]);
  g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(cx, cy); g.stroke(); g.setLineDash([]);
  g.translate(cx, cy); g.scale(sc, sc);
  // المقبض
  g.strokeStyle = COL.ink; g.lineWidth = 26; g.lineCap = 'round';
  g.beginPath(); g.moveTo(130, 130); g.lineTo(210, 210); g.stroke();
  g.fillStyle = 'rgba(255,253,246,0.97)'; g.beginPath(); g.arc(0, 0, 175, 0, Math.PI * 2); g.fill();
  g.lineWidth = 18; g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 10; g.beginPath(); g.arc(0, 0, 145, -2.6, -1.9); g.stroke();
  // اللافتة مكبرة
  g.fillStyle = COL.cream; g.strokeStyle = '#7E7466'; g.lineWidth = 6;
  roundRect(-130, -70, 260, 140, 18); g.fill(); g.stroke();
  const pulse = hit > 0 && hit < 1 ? 1 + Math.sin(hit * Math.PI) * 0.18 : 1;
  g.scale(pulse, pulse);
  g.fillStyle = hit > 0 ? COL.accent : COL.ink; g.font = '110px Lalezar'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
  g.fillText(txt, 0, 6);
  g.restore();
}
// تحويل إحداثيات العالم إلى الشاشة
function ws(x, y) {
  const c = camState;
  return { x: (x - c.x) * c.z + W / 2, y: (y - c.y) * c.z + H / 2 };
}
function dashed(x1, y1, x2, y2, a) {
  g.save(); g.globalAlpha = a; g.strokeStyle = COL.accent; g.lineWidth = 6; g.setLineDash([18, 14]);
  g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
  g.setLineDash([]); g.lineWidth = 6;
  g.beginPath(); g.moveTo(x2 - 18, y2 + 22); g.lineTo(x2, y2); g.lineTo(x2 + 18, y2 + 22); g.stroke();
  g.restore();
}

// إشارات المؤثرات الصوتية من نفس التوقيت
function sfxCues() {
  const at = (id, u) => { const s = SC.find(x => x.id === id); return s.a + u * (s.b - s.a); };
  const c = [];
  c.push({ t: 0.0, type: 'wind', dur: 1.6 });
  c.push({ t: at('L1', 0.07), type: 'snap' });
  c.push({ t: at('L1', 0.08), type: 'whoosh' });
  c.push({ t: at('L2', 0.34), type: 'jump' });
  c.push({ t: at('L2', 0.8), type: 'land' });
  c.push({ t: at('L3', 0.5), type: 'wood' });
  c.push({ t: at('L3', 0.6), type: 'step' }); c.push({ t: at('L3', 0.67), type: 'step' }); c.push({ t: at('L3', 0.74), type: 'step' }); c.push({ t: at('L3', 0.81), type: 'step' });
  c.push({ t: at('L4', 0.14), type: 'land' });
  c.push({ t: at('L4', 0.3), type: 'whoosh' });
  c.push({ t: at('L4', 0.5), type: 'clang' });
  c.push({ t: at('L4', 0.66), type: 'clunk' });
  c.push({ t: at('L5', 0.15), type: 'wood' });
  c.push({ t: at('L5', 0.45), type: 'thud' });
  c.push({ t: at('L6', 0.0), type: 'creak' });
  c.push({ t: at('L6', 0.45), type: 'thud' });
  c.push({ t: at('L7', wordU('L7', 11, .74)), type: 'ding' });
  c.push({ t: at('L8', wordU('L8', 7, .66)), type: 'ding2' });
  c.push({ t: at('L10', 0.3), type: 'ding' });
  c.push({ t: at('L10', 0.62), type: 'creak2' });
  c.push({ t: TAIL + 0.5, type: 'wind', dur: 2.5 });
  return c;
}

if (typeof window !== 'undefined') Object.assign(window, { render, setTiming, sfxCues, getDur: () => DUR, initCanvas: (cv) => { g = cv.getContext('2d'); } });
