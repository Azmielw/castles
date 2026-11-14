// world.js — عالم الريل: الخلفية، الأرانب، الأغراض، الواجهة (HUD)، النصوص، الجزيئات
// كل الدوال ترسم من مدخلاتها فقط (لا حالة مخفية) حتى يكون render(t) قابلًا للإعادة.

const W = 1080, H = 1920, GY = 1400, HORIZ = 1130, S = 1.25;
const INK = '#1F1E24', CREAM = '#FFF8EA', ACC = '#E8553D', OKG = '#2FA862';
const RC = { A: '#F28C28', B: '#3E8EDE', C: '#9B5DE5', D: '#F06BA8', E: '#F2C230', G: '#FFD447' };
const RORDER = ['B', 'C', 'A', 'D', 'E'];
CH.karim = { headR: 36, torso: 118, upperArm: 62, foreArm: 58, thigh: 74, shin: 72, line: 13, ink: INK, scarf: ACC };

let g, CAM = { x: 540, y: 960, z: 1 };
const rgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mixA = (A, B, u) => A.map((v, i) => Math.round(lerp(v, B[i], clamp(u))));
const css = (A, a = 1) => `rgba(${A[0]},${A[1]},${A[2]},${a})`;
const mixH = (a, b, u) => css(mixA(rgb(a), rgb(b), u));
const camY = (z, feet = 1400) => GY - (feet - 960) / z;
const toScreen = (x, y) => ({ x: (x - CAM.x) * CAM.z + W / 2, y: (y - CAM.y) * CAM.z + H / 2 });
function screen() { g.setTransform(1, 0, 0, 1, 0, 0); }
function worldT(t) {
  const c = CAM; let sx = 0, sy = 0;
  if (c.shake) { const r = rng(Math.floor(t * 30) + 3); sx = (r() - .5) * c.shake; sy = (r() - .5) * c.shake; }
  g.setTransform(1, 0, 0, 1, 0, 0); g.translate(W / 2 + sx, H / 2 + sy); g.scale(c.z, c.z); g.translate(-c.x, -c.y);
}
function rr(x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

// ---------- السماء والخلفية (tod: 0 صباح، 1 ظهر، 2 غروب، 3 ليل، 4 صباح) ----------
const SKYS = [['#BDE4F4', '#FFF3DC'], ['#8FD0F2', '#E4F5FC'], ['#F6A870', '#FFE4B5'], ['#151A3D', '#3B3566'], ['#BDE4F4', '#FFF3DC']].map(p => p.map(rgb));
const TINTS = ['#FFFFFF', '#FFFFFF', '#FFE0C8', '#6F78C4', '#FFFFFF'].map(rgb);
const pick = (arr, tod) => { const i = Math.min(3, Math.floor(tod)), u = tod - i; return [i, u]; };
function drawBackground(tod, t, sil) {
  screen();
  const [i, u] = pick(SKYS, tod);
  const top = mixA(SKYS[i][0], SKYS[i + 1][0], u), bot = mixA(SKYS[i][1], SKYS[i + 1][1], u);
  const hy = toScreen(0, HORIZ).y;
  const gr = g.createLinearGradient(0, 0, 0, Math.max(200, hy));
  gr.addColorStop(0, css(top)); gr.addColorStop(1, css(bot));
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  const night = clamp(1 - Math.abs(tod - 3) / 0.8);
  if (night > 0) { // نجوم
    const r = rng(77); g.fillStyle = `rgba(255,255,255,${night * 0.9})`;
    for (let k = 0; k < 60; k++) { const x = r() * W, y = r() * hy * 0.9, s = 1.5 + r() * 2.5; const tw = 0.6 + 0.4 * Math.sin(t * 3 + k); g.globalAlpha = tw; g.beginPath(); g.arc(x, y, s, 0, 7); g.fill(); }
    g.globalAlpha = 1;
  }
  // الشمس
  const st = tod > 3 ? tod - 4 : tod, a = Math.PI * (1 - st / 2);
  const sx = 540 + Math.cos(a) * 430, sy = hy - 30 - Math.sin(a) * 600;
  if (sy < hy + 120) {
    const warm = clamp(Math.abs(st - 1));
    const col = mixA(rgb('#FFE680'), rgb('#FF8A4A'), warm);
    const glow = g.createRadialGradient(sx, sy, 20, sx, sy, 260);
    glow.addColorStop(0, css(col, 0.55)); glow.addColorStop(1, css(col, 0));
    g.fillStyle = glow; g.beginPath(); g.arc(sx, sy, 260, 0, 7); g.fill();
    g.fillStyle = css(col); g.beginPath(); g.arc(sx, sy, 78, 0, 7); g.fill();
  }
  // القمر
  if (tod > 2.1 && tod < 3.9) {
    const ma = Math.PI * (1 - (tod - 2) / 2), mx = 540 + Math.cos(ma) * 430, my = hy - 30 - Math.sin(ma) * 600;
    g.fillStyle = '#F4F1DE'; g.beginPath(); g.arc(mx, my, 56, 0, 7); g.fill();
    g.fillStyle = css(mixA(SKYS[3][0], SKYS[3][1], 0.3)); g.beginPath(); g.arc(mx + 22, my - 12, 48, 0, 7); g.fill();
  }
  // سحب
  const r = rng(11); g.fillStyle = `rgba(255,255,255,${0.8 - night * 0.6})`;
  for (let k = 0; k < 6; k++) {
    const bx = ((k * 420 + r() * 200 - CAM.x * 0.06 + t * (5 + r() * 5)) % 1800 + 1800) % 1800 - 300, by = 360 + r() * 420, s = 0.7 + r() * 0.6;
    g.beginPath(); g.ellipse(bx, by, 90 * s, 32 * s, 0, 0, 7); g.ellipse(bx + 52 * s, by - 20 * s, 56 * s, 34 * s, 0, 0, 7); g.ellipse(bx - 48 * s, by - 10 * s, 46 * s, 26 * s, 0, 0, 7); g.fill();
  }
  // تلال
  const hill = (par, amp, col, seed) => {
    g.fillStyle = col; g.beginPath(); g.moveTo(-10, H);
    for (let x = -10; x <= W + 10; x += 15) g.lineTo(x, hillY(x, par, amp, seed, hy));
    g.lineTo(W + 10, H); g.closePath(); g.fill();
  };
  hill(0.12, 150, '#B7DDB0', 1.3);
  hill(0.3, 95, '#93CC8A', 4.1);
  // أرانب متفرجة على التل (صور ظلية)
  if (sil > 0) {
    [230, 380, 540, 700, 850].forEach((x, k) => {
      const up = clamp(sil * 5 - k * 0.8); if (up <= 0) return;
      const y = hillY(x, 0.3, 95, 4.1, hy) + 6 + (1 - ease.out(up)) * 70;
      g.save(); g.beginPath(); g.rect(x - 60, y - 200, 120, 200 - 6 + (ease.out(up)) * 0); g.clip();
      g.fillStyle = '#3F6B4A';
      const tw = Math.sin(t * 5 + k * 2) * 0.12;
      g.beginPath(); g.ellipse(x, y - 22, 20, 24, 0, 0, 7); g.fill();
      g.beginPath(); g.ellipse(x - 9, y - 62, 6, 24, -0.15 + tw, 0, 7); g.ellipse(x + 9, y - 62, 6, 24, 0.15 - tw, 0, 7); g.fill();
      g.restore();
    });
    hill(0.3, 89, '#93CC8A', 4.1);
  }
}
function hillY(x, par, amp, seed, hy) {
  const wx = x + CAM.x * par;
  return hy + 20 - amp * (0.5 + 0.5 * Math.sin(wx * 0.0042 + seed)) - amp * 0.28 * Math.sin(wx * 0.0113 + seed * 2);
}
function drawGround(t) {
  const x0 = CAM.x - 800 / CAM.z, x1 = CAM.x + 800 / CAM.z;
  const gr = g.createLinearGradient(0, HORIZ, 0, GY + 500);
  gr.addColorStop(0, '#A9DA8C'); gr.addColorStop(1, '#79BD66');
  g.fillStyle = gr; g.fillRect(x0, HORIZ, x1 - x0, 1600);
  // ممر ترابي
  g.fillStyle = '#E3D2A8'; g.fillRect(x0, GY - 34, x1 - x0, 96);
  g.fillStyle = '#D5C294'; g.fillRect(x0, GY + 50, x1 - x0, 12);
  g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x0, GY - 34, x1 - x0, 8);
  // تفاصيل ببذرة ثابتة
  const cell = 90, i0 = Math.floor(x0 / cell) - 1, i1 = Math.ceil(x1 / cell) + 1;
  for (let i = i0; i <= i1; i++) {
    const r = rng(i * 7919 + 13);
    const x = i * cell + r() * cell, yb = HORIZ + 40 + r() * 190, yf = GY + 90 + r() * 380;
    g.strokeStyle = '#6FAE5C'; g.lineWidth = 4; g.lineCap = 'round';
    [yb, yf].forEach((y, k) => {
      const s = k ? 1.4 : 0.8;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x - 7 * s, y - 18 * s); g.moveTo(x, y); g.lineTo(x + 2 * s, y - 22 * s); g.moveTo(x, y); g.lineTo(x + 9 * s, y - 16 * s); g.stroke();
    });
    if (r() > 0.55) { g.fillStyle = r() > .5 ? '#FFFFFF' : '#FFE27A'; g.beginPath(); g.arc(x + 30, yf - 30, 8, 0, 7); g.fill(); g.fillStyle = '#F2A33A'; g.beginPath(); g.arc(x + 30, yf - 30, 3, 0, 7); g.fill(); }
    if (r() > 0.7) { g.fillStyle = '#C9B88C'; g.beginPath(); g.ellipse(x + 10, GY + 20 + r() * 20, 9, 4, 0, 0, 7); g.fill(); }
  }
}
function tintOverlay(tod) {
  const [i, u] = pick(TINTS, tod); const c = mixA(TINTS[i], TINTS[i + 1], u);
  if (c[0] > 250 && c[1] > 250 && c[2] > 250) return;
  screen(); g.save(); g.globalCompositeOperation = 'multiply'; g.fillStyle = css(c); g.fillRect(0, 0, W, H); g.restore();
}

// ---------- الأغراض ----------
function burrow(x) {
  g.fillStyle = '#B9A677'; g.beginPath(); g.ellipse(x, GY + 4, 66, 20, 0, 0, 7); g.fill();
  g.fillStyle = '#3A2E22'; g.beginPath(); g.ellipse(x, GY + 2, 48, 13, 0, 0, 7); g.fill();
}
function burrowFront(x) { // حافة أمامية تخفي ما تحت الأرض
  g.fillStyle = '#B9A677'; g.beginPath(); g.ellipse(x, GY + 13, 66, 12, 0, 0, Math.PI); g.fill();
  g.fillStyle = '#E3D2A8'; g.fillRect(x - 70, GY + 14, 140, 40);
}
function bush(x, shake, front, t) {
  const sh = Math.sin(t * 42) * 9 * shake, r = rng(Math.round(x) + (front ? 5 : 9));
  const cols = front ? ['#3F9B57', '#4FB368', '#63C57A'] : ['#2F7F47', '#3A8E52'];
  const n = front ? 7 : 6;
  for (let k = 0; k < n; k++) {
    const u = k / (n - 1), bx = x - 130 + u * 260 + sh * (k % 2 ? 1 : -1), by = GY - (front ? 46 : 95) - Math.sin(u * Math.PI) * (front ? 52 : 70) + r() * 14;
    g.fillStyle = cols[k % cols.length]; g.beginPath(); g.arc(bx, by, (front ? 62 : 68) + r() * 12, 0, 7); g.fill();
  }
  if (front) {
    g.fillStyle = '#4FB368'; g.fillRect(x - 150, GY - 44, 300, 54);
    g.fillStyle = '#F06BA8'; [[-70, -80], [40, -104], [96, -60]].forEach(([dx, dy]) => { g.beginPath(); g.arc(x + dx + sh, GY + dy, 9, 0, 7); g.fill(); });
  }
}
function treeBack(x) {
  g.fillStyle = '#8A5A3C'; g.fillRect(x - 26, GY - 330, 52, 336);
  g.fillStyle = '#7A4D31'; g.fillRect(x + 8, GY - 330, 18, 336);
  [['#3A8E52', -90, -400, 120], ['#3F9B57', 80, -420, 130], ['#4FB368', -10, -500, 140], ['#63C57A', -40, -430, 80]].forEach(([c, dx, dy, r]) => { g.fillStyle = c; g.beginPath(); g.arc(x + dx, GY + dy, r, 0, 7); g.fill(); });
}
function logProp(x) {
  g.fillStyle = '#8A5A3C'; rr(x - 86, GY - 62, 172, 66, 30); g.fill();
  g.strokeStyle = INK; g.lineWidth = 5; g.stroke();
  g.fillStyle = '#D9B68A'; g.beginPath(); g.ellipse(x - 62, GY - 29, 22, 30, 0, 0, 7); g.fill(); g.stroke();
  g.lineWidth = 3; g.beginPath(); g.ellipse(x - 62, GY - 29, 10, 15, 0, 0, 7); g.stroke();
}

// ---------- الأرنب ----------
function hopAt(time, f, h) {
  const ph = ((time * f) % 1 + 1) % 1, air = 4 * h * ph * (1 - ph), vy = 1 - 2 * ph;
  const st = ph < 0.12 ? -(1 - ph / 0.12) * 0.7 : ph > 0.88 ? -((ph - 0.88) / 0.12) * 0.7 : Math.abs(vy) * 0.55;
  return { air, st, tilt: vy, ph };
}
function drawRabbit(r, t) {
  const s = (r.s || 1), dir = r.dir || 1, col = r.grey ? '#B8B8B8' : (r.col || RC[r.id]);
  const st = r.st || 0, air = r.air || 0, fat = r.fat ? 1.28 : 1;
  g.save();
  g.globalAlpha = (r.alpha ?? 1) * (r.grey ? 0.55 : 1);
  if (r.clip) { g.beginPath(); g.rect(r.x - 300, -6000, 600, 6000 + GY + 3); g.clip(); }
  if (!r.noShadow && !r.clip) { g.fillStyle = `rgba(0,0,0,${0.14 * clamp(1 - air / 220)})`; g.beginPath(); g.ellipse(r.x, (r.y ?? GY) + 4, 50 * s * fat * clamp(1 - air / 400, .4, 1), 10 * s, 0, 0, 7); g.fill(); }
  g.translate(r.x, (r.y ?? GY) - air); g.scale(dir * s, s);
  g.rotate(-(r.tilt || 0) * 0.28 + (r.rot || 0));
  g.scale(1 + 0.2 * st, 1 - 0.16 * st);
  g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = INK; g.lineWidth = 5;
  const light = mixH(col, '#FFFFFF', 0.6);
  // الذيل
  g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(-46 * fat, -40, 14, 0, 7); g.fill(); g.stroke();
  // الرجل الخلفية
  const leg = (r.tilt || 0) * 0.5;
  g.fillStyle = col; g.save(); g.translate(-18 * fat, -14); g.rotate(-leg * (air > 4 ? 1 : 0) - 0.1); g.beginPath(); g.ellipse(-4, 4, 26, 13, 0, 0, 7); g.fill(); g.stroke(); g.restore();
  // الجسم
  g.fillStyle = col; g.beginPath(); g.ellipse(0, -36, 46 * fat, 34 * fat, 0, 0, 7); g.fill(); g.stroke();
  g.fillStyle = light; g.beginPath(); g.ellipse(6, -26, 26 * fat, 18 * fat, 0, 0, 7); g.fill();
  // اليد الأمامية
  g.fillStyle = col; g.beginPath(); g.ellipse(30 * fat, -8 - (air > 4 ? 6 : 0), 12, 8, 0.3, 0, 7); g.fill(); g.stroke();
  // الأذنان
  const hx = 36 * fat + 2, hy = -70 * (r.fat ? 1.06 : 1);
  const earL = r.longEar ? 70 : 52, ea = (r.ear || 0) + (air > 4 ? 0.5 * (r.tilt || 0) : 0) + Math.sin(t * 4 + (r.x || 0) * 0.01) * 0.04;
  [[-6, -0.5], [8, -0.18]].forEach(([dx, base], k) => {
    g.save(); g.translate(hx + dx - 4, hy - 20); g.rotate(base - ea * (k ? 0.8 : 1));
    g.fillStyle = col; g.beginPath(); g.ellipse(0, -earL / 2, 11, earL / 2 + 4, 0, 0, 7); g.fill(); g.stroke();
    g.fillStyle = light; g.beginPath(); g.ellipse(0, -earL / 2, 5, earL / 2 - 8, 0, 0, 7); g.fill();
    g.restore();
  });
  // الرأس
  g.fillStyle = col; g.beginPath(); g.arc(hx, hy, 28, 0, 7); g.fill(); g.stroke();
  g.fillStyle = light; g.beginPath(); g.ellipse(hx + 14, hy + 9, 12, 9, 0, 0, 7); g.fill();
  // العين
  g.fillStyle = INK;
  if (r.blink) { g.lineWidth = 4; g.beginPath(); g.moveTo(hx + 4, hy - 5); g.quadraticCurveTo(hx + 11, hy + (r.happy ? -11 : 0), hx + 18, hy - 5); g.stroke(); }
  else { g.beginPath(); g.ellipse(hx + 11, hy - 6, 5.5, r.wide ? 8 : 6.5, 0, 0, 7); g.fill(); g.fillStyle = '#FFF'; g.beginPath(); g.arc(hx + 13, hy - 8, 2, 0, 7); g.fill(); }
  g.fillStyle = '#E86A7A'; g.beginPath(); g.arc(hx + 26, hy + 3, 3.5, 0, 7); g.fill();
  if (r.sparkle) { g.fillStyle = '#FFF7B8'; for (let k = 0; k < 5; k++) { const a = t * 3 + k * 1.3, rr_ = 70 + 16 * Math.sin(t * 5 + k); star(Math.cos(a) * rr_, -44 + Math.sin(a) * rr_ * 0.7, 9 + 4 * Math.sin(t * 7 + k)); } }
  g.restore();
}
function star(x, y, s) { g.beginPath(); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, rad = k % 2 ? s * 0.38 : s; g.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); } g.closePath(); g.fill(); }
function rabbitIcon(x, y, s, col, alpha = 1) {
  g.save(); g.globalAlpha *= alpha; g.translate(x, y); g.scale(s, s);
  g.fillStyle = col; g.strokeStyle = INK; g.lineWidth = 4; g.lineJoin = 'round';
  [[-9, -0.2], [9, 0.2]].forEach(([dx, a]) => { g.save(); g.translate(dx, -18); g.rotate(a); g.beginPath(); g.ellipse(0, -16, 7, 18, 0, 0, 7); g.fill(); g.stroke(); g.restore(); });
  g.beginPath(); g.arc(0, 0, 22, 0, 7); g.fill(); g.stroke();
  g.fillStyle = INK; g.beginPath(); g.arc(-8, -3, 3.2, 0, 7); g.arc(8, -3, 3.2, 0, 7); g.fill();
  g.restore();
}
function cross(x, y, s, a = 1, col = '#E0352B') { g.save(); g.globalAlpha *= a; g.strokeStyle = '#FFF'; g.lineCap = 'round'; g.lineWidth = s * 0.5; const d = s * 0.7; const p = () => { g.beginPath(); g.moveTo(x - d, y - d); g.lineTo(x + d, y + d); g.moveTo(x + d, y - d); g.lineTo(x - d, y + d); g.stroke(); }; p(); g.strokeStyle = col; g.lineWidth = s * 0.3; p(); g.restore(); }
function check(x, y, s, a = 1) { g.save(); g.globalAlpha *= a; g.fillStyle = OKG; g.beginPath(); g.arc(x, y, s, 0, 7); g.fill(); g.strokeStyle = '#FFF'; g.lineWidth = s * 0.26; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(x - s * 0.45, y + s * 0.02); g.lineTo(x - s * 0.1, y + s * 0.38); g.lineTo(x + s * 0.48, y - s * 0.32); g.stroke(); g.restore(); }

// ---------- جزيئات ----------
function dust(x, y, age, dir = 0, n = 5) {
  if (age < 0 || age > 0.6) return; const k = age / 0.6, r = rng(Math.round(x * 3 + y));
  for (let i = 0; i < n; i++) { const a = Math.PI + (r() - .5) * 2.4, sp = 40 + r() * 90; g.fillStyle = `rgba(205,188,150,${0.75 * (1 - k)})`; g.beginPath(); g.arc(x + Math.cos(a) * sp * k - dir * 60 * k, y + Math.sin(a) * sp * k * 0.5 - 30 * k, 10 + 22 * k * r(), 0, 7); g.fill(); }
}
function leaves(x, y, age, n = 14) {
  if (age < 0 || age > 1.1) return; const r = rng(Math.round(x + y) + 31);
  for (let i = 0; i < n; i++) { const a = -Math.PI * r(), sp = 150 + r() * 330, px = x + Math.cos(a) * sp * age, py = y + Math.sin(a) * sp * age + 520 * age * age; g.save(); g.translate(px, py); g.rotate(age * 9 * (r() - .5) + i); g.fillStyle = i % 3 ? '#4FB368' : '#3A8E52'; g.globalAlpha = clamp(1.6 - age * 1.5); g.beginPath(); g.ellipse(0, 0, 15, 7, 0, 0, 7); g.fill(); g.restore(); }
}
function confetti(x, y, age, n = 46) {
  if (age < 0 || age > 2.2) return; const r = rng(4242); const cols = [RC.A, RC.B, RC.C, RC.D, RC.E, '#FFFFFF'];
  for (let i = 0; i < n; i++) { const a = -Math.PI * (0.12 + 0.76 * r()), sp = 380 + r() * 620, px = x + Math.cos(a) * sp * age * (1 - 0.18 * age), py = y + Math.sin(a) * sp * age + 560 * age * age; g.save(); g.translate(px, py); g.rotate(age * 12 * (r() - .5) + i); g.fillStyle = cols[i % 6]; g.globalAlpha = clamp(2.2 - age * 1.1); g.fillRect(-11, -6, 22, 12); g.restore(); }
}
function rays(x, y, k, t, col = '#FFE680') {
  if (k <= 0) return; g.save(); g.translate(x, y); g.rotate(t * 0.5); g.fillStyle = col; g.globalAlpha = 0.55 * k;
  for (let i = 0; i < 12; i++) { g.rotate(Math.PI / 6); g.beginPath(); g.moveTo(0, 0); g.lineTo(-34, -520 * k); g.lineTo(34, -520 * k); g.closePath(); g.fill(); }
  g.restore();
}
function exclaim(x, y, k, txt = '!', col = ACC, size = 120) {
  if (k <= 0) return; g.save(); g.translate(x, y); const s = ease.back(clamp(k * 3)) * (1 - clamp((k - 0.8) / 0.2)); g.scale(s, s);
  g.font = `${size}px Lalezar`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.strokeStyle = CREAM; g.lineWidth = 18; g.strokeText(txt, 0, 0); g.fillStyle = col; g.fillText(txt, 0, 0); g.restore();
}
function sweat(x, y, t, n = 3) { for (let i = 0; i < n; i++) { const k = ((t * 1.3 + i / n) % 1), a = -0.6 - i * 0.9; const px = x + Math.cos(a) * (50 + 70 * k), py = y + Math.sin(a) * (40 + 30 * k) + 90 * k * k; g.fillStyle = `rgba(120,190,240,${1 - k})`; g.beginPath(); g.moveTo(px, py - 14); g.quadraticCurveTo(px + 9, py + 2, px, py + 8); g.quadraticCurveTo(px - 9, py + 2, px, py - 14); g.fill(); } }

// ---------- الواجهة العلوية (HUD) ----------
function drawHUD(h, t) {
  if (!h || h.a <= 0) return; screen(); g.save(); g.globalAlpha = h.a;
  const shk = h.shake ? Math.sin(t * 70) * 7 * h.shake : 0;
  g.translate(shk, 0);
  // شريط الطاقة
  g.fillStyle = 'rgba(255,248,234,0.94)'; rr(96, 206, 888, 84, 42); g.fill();
  g.strokeStyle = INK; g.lineWidth = 5; g.stroke();
  g.font = '44px Lalezar'; g.textAlign = 'right'; g.textBaseline = 'middle'; g.direction = 'rtl'; g.fillStyle = INK;
  g.fillText('الطاقة', 956, 250);
  const bx = 128, bw = 680, e = clamp(h.energy / 100);
  g.fillStyle = '#E4DBC8'; rr(bx, 231, bw, 36, 18); g.fill();
  const col = e > 0.5 ? mixH('#F2C230', '#3DBB6B', (e - 0.5) * 2) : mixH('#E0352B', '#F2C230', e * 2);
  if (e > 0.01) { g.fillStyle = col; rr(bx + bw * (1 - e), 231, Math.max(36, bw * e), 36, 18); g.fill(); }
  g.strokeStyle = INK; g.lineWidth = 4; rr(bx, 231, bw, 36, 18); g.stroke();
  if (e <= 0.01) { const b = 0.5 + 0.5 * Math.sin(t * 9); g.strokeStyle = `rgba(224,53,43,${b})`; g.lineWidth = 7; rr(bx, 231, bw, 36, 18); g.stroke(); }
  // صف الأرانب + العداد
  g.fillStyle = 'rgba(255,248,234,0.94)'; rr(96, 302, 888, 92, 46); g.fill(); g.strokeStyle = INK; g.lineWidth = 5; g.stroke();
  const zero = h.caught === 0, pul = 1 + 0.16 * (h.pulse || 0) * Math.abs(Math.sin(t * 7));
  g.save(); g.translate(852, 349); g.scale(pul, pul);
  g.font = '48px Lalezar'; g.textAlign = 'center'; g.fillStyle = h.pulse ? (zero ? '#E0352B' : OKG) : INK;
  g.fillText('اتمسك: ' + (h.caught ? '١' : '٠'), 0, 2); g.restore();
  RORDER.forEach((id, k) => {
    const x = 180 + k * 108, y = 356, stt = (h.icons || {})[id] || {};
    const dim = stt.st === 'x' ? 0.45 : 1;
    if (stt.st === 'target') { g.strokeStyle = ACC; g.lineWidth = 6; g.beginPath(); g.arc(x, y - 6, 40 + 3 * Math.sin(t * 8), 0, 7); g.stroke(); }
    rabbitIcon(x, y, 1.0, stt.st === 'x' ? '#C9C9C9' : RC[id], dim);
    if (stt.st === 'x') cross(x, y - 4, 26, ease.back(clamp(stt.k ?? 1)));
    if (stt.st === 'ok') check(x + 22, y + 14, 20 * ease.back(clamp(stt.k ?? 1)));
  });
  g.restore();
}

// ---------- النصوص المتحركة ----------
// صيغة: "كلمة كلمة | *مهمة @Bملونة || صفحة ثانية"
function parseCap(str) {
  let idx = 0;
  return str.split('||').map(pg => pg.split('|').map(row => row.trim().split(/\s+/).map(w => {
    let col = null;
    if (w[0] === '*') { col = ACC; w = w.slice(1); } else if (w[0] === '@') { col = RC[w[1]]; w = w.slice(2); }
    return { w, col, i: idx++ };
  })));
}
function drawCaption(pages, wt, t, tEnd, opts = {}) {
  // wt: أزمنة ظهور الكلمات بالثواني
  screen();
  const size = opts.size || 96, pitch = size * 1.24, y0 = opts.y || 560;
  let pi = 0; for (let k = 0; k < pages.length; k++) if (t >= wt[pages[k][0][0].i] - 0.05) pi = k;
  const page = pages[pi];
  const fade = clamp((tEnd - t) / 0.16);
  g.save(); g.direction = 'rtl'; g.textBaseline = 'middle'; g.textAlign = 'right'; g.lineJoin = 'round';
  page.forEach((row, ri) => {
    g.font = `${size}px Lalezar`;
    const sp = size * 0.26; const ws = row.map(o => g.measureText(o.w).width);
    let total = ws.reduce((a, b) => a + b, 0) + sp * (row.length - 1);
    const sc = Math.min(1, 880 / total); total *= sc;
    let xr = W / 2 + total / 2; const y = y0 + ri * pitch;
    row.forEach((o, k) => {
      const ww = ws[k] * sc, age = t - wt[o.i];
      if (age >= 0) {
        const p = ease.back(clamp(age / 0.16));
        g.save(); g.translate(xr - ww / 2, y); g.scale(sc * (0.6 + 0.4 * p), sc * (0.6 + 0.4 * p));
        g.globalAlpha = fade * clamp(age / 0.07); g.textAlign = 'center';
        g.strokeStyle = CREAM; g.lineWidth = size * 0.2; g.strokeText(o.w, 0, 0);
        g.fillStyle = o.col || INK; g.fillText(o.w, 0, 0); g.restore();
      }
      xr -= ww + sp * sc;
    });
  });
  g.restore();
}
function label(s, x, y, size, o = {}) {
  const a = o.alpha ?? 1; if (a <= 0) return; g.save(); g.globalAlpha *= a; g.translate(x, y); const sc = o.scale ?? 1; g.scale(sc, sc); g.rotate(o.rot || 0);
  g.font = `${size}px ${o.font || 'Lalezar'}`; g.textAlign = o.align || 'center'; g.textBaseline = 'middle'; g.direction = 'rtl'; g.lineJoin = 'round';
  if (o.box) { const m = g.measureText(s).width + size * 0.9, hh = size * 1.4; g.fillStyle = o.box; rr(-m / 2, -hh / 2, m, hh, hh / 2); g.fill(); g.strokeStyle = INK; g.lineWidth = 5; g.stroke(); }
  else if (o.stroke !== 0) { g.strokeStyle = o.strokeCol || CREAM; g.lineWidth = o.stroke ?? size * 0.2; g.strokeText(s, 0, 0); }
  g.fillStyle = o.color || INK; g.fillText(s, 0, 0); g.restore();
}
function vignette() {
  screen(); const vg = g.createRadialGradient(W / 2, H / 2, H * 0.36, W / 2, H / 2, H * 0.78);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(40,30,20,0.2)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
}
function streaks(a, t, dir = 1) {
  if (a <= 0) return; screen(); const r = rng(909); g.lineCap = 'round';
  for (let i = 0; i < 46; i++) { const y = r() * H, len = 300 + r() * 700, x = ((r() * 2400 + t * 5200 * dir) % 2400 + 2400) % 2400 - 700; g.strokeStyle = `rgba(255,255,255,${a * (0.35 + r() * 0.5)})`; g.lineWidth = 4 + r() * 14; g.beginPath(); g.moveTo(x, y); g.lineTo(x + len, y); g.stroke(); }
}
