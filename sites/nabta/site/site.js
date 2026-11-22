/* صفحة بيع اللعبة — من نَواة */
'use strict';

// ===== الإعدادات: غيّرها من هنا فقط =====
const GAME_NAME = 'نَبتة';   // اسم اللعبة (يظهر في كل الصفحة وفي العنوان)
const PRICE = '10$';
const WHATSAPP = '201037374409'; // واتساب نَواة (بدون + ولا مسافات) — طلبات الشراء بتوصل هون
const SHEET_URL = 'https://script.google.com/macros/s/AKfycbwOyKnTPJMd0ECiKYE3ExKpVX_GZtlnETqXJh7yiX8QHprh7qIBzk72aumT-ZenQMbc/exec';            // رابط Google Sheet (Apps Script /exec) — نفس اللي بـ play/js/config.js
const APK_URL = '';          // رابط تحميل تطبيق أندرويد. إذا كان فارغاً تظهر رسالة «متاح قريباً»

(function () {
  // ---------- الاسم ----------
  document.querySelectorAll('[data-name]').forEach(el => { el.textContent = GAME_NAME; });
  document.title = GAME_NAME + ' — كلّ حرف بذرة | من نَواة';

  // ---------- التنبيه ----------
  const toastEl = document.getElementById('toast');
  let toastTimer = 0;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2800);
  }

  // ---------- أزرار الشراء والتحميل ----------
  // نافذة «طلب شراء»: الاسم + الإيميل + الدولة + الواتساب ← بينحفظ بالشيت وبينفتح واتساب نَواة
  const modal = document.createElement('div');
  modal.className = 'buy-modal';
  modal.hidden = true;
  modal.innerHTML = `
    <div class="buy-card" role="dialog" aria-modal="true" aria-labelledby="buy-title">
      <button class="buy-x" type="button" aria-label="إغلاق">×</button>
      <h3 id="buy-title">طلب شراء <span data-name>${GAME_NAME}</span> — <span dir="ltr">${PRICE}</span></h3>
      <form class="buy-form" novalidate>
        <label>اسم ولي الأمر<input name="name" type="text" autocomplete="name" required></label>
        <label>الإيميل اللي رح نفعّل عليه اللعبة<input name="email" type="email" inputmode="email" autocomplete="email" dir="ltr" required></label>
        <label>الدولة<input name="country" type="text" autocomplete="country-name"></label>
        <label>رقم الواتساب (اختياري)<input name="phone" type="tel" autocomplete="tel" dir="ltr"></label>
        <input name="website" type="text" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
        <p class="buy-err" hidden></p>
        <button class="btn btn-lg btn-yellow btn-block" type="submit">أرسل الطلب عالواتساب 💬</button>
        <p class="buy-note">نوفّر لك طريقة دفع تناسب بلدك. بعد الدفع نفعّل إيميلك ونرسل لك رمز الدخول على الواتساب.</p>
      </form>
      <div class="buy-done" hidden>
        <p class="ok">✅ وصل طلبك!</p>
        <p>رقم الطلب: <b dir="ltr" class="ref"></b></p>
        <p>أكمل معنا على الواتساب لترتيب الدفع.</p>
        <a class="btn btn-lg btn-mint btn-block wa" target="_blank" rel="noopener">افتح الواتساب 💬</a>
        <a class="btn btn-md btn-white btn-block" href="play/">جرّب اللعبة الآن</a>
      </div>
    </div>`;
  document.body.appendChild(modal);
  const form = modal.querySelector('form'), err = modal.querySelector('.buy-err'), done = modal.querySelector('.buy-done');
  const closeBuy = () => { modal.hidden = true; document.body.classList.remove('no-scroll'); };
  modal.querySelector('.buy-x').addEventListener('click', closeBuy);
  modal.addEventListener('click', e => { if (e.target === modal) closeBuy(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) closeBuy(); });
  document.querySelectorAll('[data-buy]').forEach(b => b.addEventListener('click', () => {
    form.hidden = false; done.hidden = true; err.hidden = true;
    modal.hidden = false; document.body.classList.add('no-scroll');
    setTimeout(() => form.elements.name.focus(), 50);
  }));
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const f = form.elements;
    const d = { name: f.name.value.trim(), email: f.email.value.trim().toLowerCase(), country: f.country.value.trim(), phone: f.phone.value.trim() };
    const fail = m => { err.textContent = m; err.hidden = false; };
    if (!d.name) return fail('اكتب اسمك من فضلك.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) return fail('الإيميل غير صحيح.');
    if (f.website.value) return;
    const btn = form.querySelector('button[type=submit]'); btn.disabled = true;
    let ref = 'HR-' + Date.now().toString(36).toUpperCase().slice(-6);
    if (SHEET_URL) {
      try {
        const fd = new FormData();
        Object.entries(Object.assign({ source: 'site' }, d)).forEach(([k, v]) => fd.append(k, v));
        const j = await (await fetch(SHEET_URL, { method: 'POST', body: fd })).json();
        if (j.ok && j.ref) ref = j.ref;
      } catch (x) { /* نكمل على الواتساب */ }
    }
    const msg = `مرحبا نَواة 👋\nبدي أشتري لعبة ${GAME_NAME} (${PRICE}).\n\nرقم الطلب: ${ref}\nالاسم: ${d.name}\nالإيميل: ${d.email}` +
      (d.country ? `\nالدولة: ${d.country}` : '') + (d.phone ? `\nواتساب: ${d.phone}` : '') + '\n\nشو طرق الدفع المتاحة عندي؟';
    const wa = 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(msg);
    done.querySelector('.ref').textContent = ref;
    done.querySelector('.wa').href = wa;
    form.hidden = true; done.hidden = false; btn.disabled = false;
    // نسخة من كل طلب لإيميل نواة (FormSubmit)؛ ما بتوقف الطلب إذا فشلت
    fetch('https://formsubmit.co/ajax/nawahcore1@gmail.com', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({
      _subject: 'طلب شراء ' + GAME_NAME + ': ' + ref, _template: 'table', _captcha: 'false', _replyto: d.email,
      'رقم الطلب': ref, 'الاسم': d.name, 'الإيميل': d.email, 'الدولة': d.country, 'واتساب': d.phone, 'السعر': PRICE
    }) }).catch(() => {});
    // الجوال بيمنع window.open بعد await، فبنفتح الواتساب بنفس الصفحة
    location.href = wa;
  });
  document.querySelectorAll('[data-apk]').forEach(b => b.addEventListener('click', () => {
    if (APK_URL) window.location.href = APK_URL;
    else toast('تطبيق أندرويد متاح قريباً');
  }));

  // ---------- الرسم ----------
  const COL = { sky: '#7FD3FF', mint: '#4FD1A5', mintD: '#2BA982', yellow: '#FFD23F', pink: '#FF5CAA', purple: '#8E5CF6', ink: '#2A2340' };
  const FONT = "'Baloo Bhaijaan 2', 'Segoe UI', Tahoma, sans-serif";
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasChar = () => typeof drawHarrouf === 'function';

  function harrouf(ctx, x, y, o) {
    if (hasChar()) {
      try { drawHarrouf(ctx, x, y, o); return; } catch (e) { /* الملف قيد التعديل: نرسم بديلاً بسيطاً */ }
    }
    // بديل بسيط إذا لم يتوفّر ملف الرسم
    const s = o.s || 1, t = o.t || 0;
    const bob = o.run ? -Math.abs(Math.sin(t * 13)) * 5 * s : Math.sin(t * 2.2) * 1.5 * s;
    ctx.save();
    ctx.translate(x, y + bob - (o.hop || 0) * s);
    ctx.fillStyle = 'rgba(0,0,0,.15)';
    ctx.beginPath(); ctx.ellipse(0, 2 * s, 30 * s, 6 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = COL.mint;
    ctx.beginPath(); ctx.arc(0, -50 * s, 44 * s, 0, 7); ctx.fill();
    ctx.strokeStyle = COL.mintD; ctx.lineWidth = 4 * s;
    ctx.beginPath(); ctx.moveTo(0, -94 * s); ctx.lineTo(0, -110 * s); ctx.stroke();
    ctx.fillStyle = COL.yellow;
    ctx.beginPath(); ctx.arc(0, -112 * s, 7 * s, 0, 7); ctx.fill();
    ctx.fillStyle = COL.ink;
    ctx.beginPath(); ctx.arc(-14 * s, -58 * s, 5 * s, 0, 7); ctx.arc(14 * s, -58 * s, 5 * s, 0, 7); ctx.fill();
    ctx.restore();
  }

  function star(ctx, x, y, R, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? R * 0.48 : R;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fillStyle = '#FFD84A'; ctx.fill();
    ctx.lineWidth = Math.max(1, R * 0.18); ctx.strokeStyle = '#F2A818'; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.beginPath(); ctx.arc(-R * 0.22, -R * 0.25, R * 0.16, 0, 7);
    ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fill();
    ctx.restore();
  }

  function rrect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function mic(ctx, x, y, s, col) {
    ctx.save();
    ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    rrect(ctx, -4, -11, 8, 13, 4); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -3, 7, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(0, 9); ctx.moveTo(-4, 9); ctx.lineTo(4, 9); ctx.stroke();
    ctx.restore();
  }

  // فقاعة كلام فيها ميكروفون وكلمة
  function bubble(ctx, cx, by, word, k, fs) {
    if (k <= 0) return;
    ctx.save();
    ctx.font = `800 ${fs}px ${FONT}`;
    ctx.direction = 'rtl';
    const tw = ctx.measureText(word).width;
    const w = tw + fs * 2.4, h = fs * 1.7;
    ctx.translate(cx, by);
    ctx.scale(k, k);
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(42,35,64,.18)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
    rrect(ctx, -w / 2, -h, w, h, h / 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-8, -1); ctx.lineTo(0, 12); ctx.lineTo(8, -1); ctx.fill();
    ctx.shadowColor = 'transparent';
    // دائرة الميكروفون
    const mx = w / 2 - h / 2;
    ctx.fillStyle = COL.pink;
    ctx.beginPath(); ctx.arc(mx, -h / 2, h * 0.36, 0, 7); ctx.fill();
    mic(ctx, mx, -h / 2 + 1, h / 34, '#fff');
    ctx.fillStyle = COL.ink;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(word, -h * 0.35, -h / 2 + fs * 0.08);
    ctx.restore();
  }

  // بلوك الحرف العملاق
  function letterBlock(ctx, x, footY, w, h, ch, col, t, squash) {
    ctx.save();
    ctx.translate(x, footY);
    const sq = squash || 0;
    ctx.scale(1 + sq * 0.12, 1 - sq * 0.1);
    ctx.fillStyle = 'rgba(0,0,0,.14)';
    ctx.beginPath(); ctx.ellipse(0, 0, w * 0.55, w * 0.1, 0, 0, 7); ctx.fill();
    const wob = Math.sin(t * 3) * 0.03;
    ctx.rotate(wob);
    ctx.fillStyle = shade(col, -0.22);
    rrect(ctx, -w / 2, -h, w, h, w * 0.2); ctx.fill();
    ctx.fillStyle = col;
    rrect(ctx, -w / 2, -h, w, h - w * 0.1, w * 0.2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.25)';
    rrect(ctx, -w / 2 + w * 0.1, -h + w * 0.08, w * 0.3, w * 0.12, w * 0.06); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `800 ${Math.round(h * 0.62)}px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = h * 0.05; ctx.strokeStyle = 'rgba(42,35,64,.35)'; ctx.lineJoin = 'round';
    ctx.strokeText(ch, 0, -h * 0.5);
    ctx.fillText(ch, 0, -h * 0.5);
    ctx.restore();
  }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const f = amt < 0 ? 0 : 255, p = Math.abs(amt);
    r = Math.round((f - r) * p + r); g = Math.round((f - g) * p + g); b = Math.round((f - b) * p + b);
    return `rgb(${r},${g},${b})`;
  }

  function burstStars(n, x, y, spd) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
      const v = spd * (0.6 + Math.random() * 0.6);
      out.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - spd * 0.5, r: 0, vr: (Math.random() - 0.5) * 8, life: 1, size: 0.7 + Math.random() * 0.6 });
    }
    return out;
  }
  function stepParts(parts, dt, g) {
    for (const p of parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += g * dt; p.r += p.vr * dt; p.life -= dt * 0.8; }
    return parts.filter(p => p.life > 0);
  }

  // ---------- خلفية العالم ----------
  function world(ctx, w, h, off, roadTop) {
    const sky = ctx.createLinearGradient(0, 0, 0, roadTop);
    sky.addColorStop(0, '#8FD8FF'); sky.addColorStop(1, '#E3F6FF');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    // شمس
    ctx.fillStyle = '#FFE680';
    ctx.beginPath(); ctx.arc(w * 0.86, h * 0.16, h * 0.075, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,230,128,.35)';
    ctx.beginPath(); ctx.arc(w * 0.86, h * 0.16, h * 0.12, 0, 7); ctx.fill();
    // غيوم
    ctx.fillStyle = 'rgba(255,255,255,.95)';
    for (let i = 0; i < 3; i++) {
      const span = w + 160;
      const cx = ((i * 0.37 * span - off * 0.08) % span + span) % span - 80;
      const cy = h * (0.1 + i * 0.09);
      const k = h / 300;
      ctx.beginPath();
      ctx.arc(cx, cy, 16 * k, 0, 7); ctx.arc(cx + 18 * k, cy - 8 * k, 20 * k, 0, 7); ctx.arc(cx + 38 * k, cy, 15 * k, 0, 7);
      ctx.fill();
    }
    // تلال
    hills(ctx, w, roadTop, off * 0.25, h * 0.16, '#B7EBA6', 0.011 * (300 / h));
    hills(ctx, w, roadTop, off * 0.5, h * 0.09, '#8EDB7E', 0.017 * (300 / h));
    // عشب وطريق
    ctx.fillStyle = '#6CCB5F'; ctx.fillRect(0, roadTop - 4, w, h);
    const lh = (h - roadTop) / 3.15;
    ctx.fillStyle = '#FFE7A3';
    rrect(ctx, -20, roadTop + lh * 0.08, w + 40, lh * 3, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = Math.max(2, h * 0.009); ctx.setLineDash([h * 0.06, h * 0.05]);
    ctx.lineDashOffset = off;
    for (let i = 1; i < 3; i++) {
      const y = roadTop + lh * 0.08 + lh * i;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    ctx.setLineDash([]);
    return lh;
  }
  function hills(ctx, w, base, off, amp, col, freq) {
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(0, base);
    for (let x = 0; x <= w + 10; x += 10) {
      const y = base - amp * (0.6 + 0.4 * Math.sin((x + off) * freq) + 0.2 * Math.sin((x + off) * freq * 2.3));
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, base); ctx.closePath(); ctx.fill();
  }

  const WORDS = [
    { ch: 'أ', word: 'أَرْنَب', col: COL.purple },
    { ch: 'ب', word: 'بَطَّة', col: COL.pink },
    { ch: 'ت', word: 'تُفّاحَة', col: '#3FAEF0' },
    { ch: 'B', word: 'Ball', col: COL.mint },
  ];

  // ---------- مشهد الجري (للبطل ولخطوة 1) ----------
  function makeRunner(opts) {
    const st = { off: 0, speed: 1, stars: [], parts: [], count: 0, lane: 1, laneF: 1, phase: 'run', ph: 0, letter: null, wi: 0, bubbleK: 0, nextStar: 0, spawnLetterIn: opts.letters ? 1.6 : Infinity };
    return function (ctx, w, h, t, dt) {
      const roadTop = h * (opts.letters ? 0.5 : 0.42);
      const base = Math.min(w * 0.75, h);
      const v = base * 0.9; // سرعة العالم
      st.off += v * st.speed * dt;
      const lh = world(ctx, w, h, st.off, roadTop);
      const laneY = i => roadTop + lh * 0.08 + lh * (i + 0.72);
      const charX = w * 0.2;
      const s = (h * (opts.letters ? 0.27 : 0.34)) / 115;

      // النجوم
      st.nextStar -= dt * st.speed;
      if (st.nextStar <= 0 && st.phase === 'run' && !(st.letter)) {
        const lane = Math.floor(Math.random() * 3);
        for (let k = 0; k < 3; k++) st.stars.push({ x: w + 30 + k * base * 0.16, lane, bob: Math.random() * 6 });
        st.nextStar = 1.25;
      }
      for (const sObj of st.stars) sObj.x -= v * st.speed * dt;
      // يتّجه حرّوف إلى مسار أقرب نجمة
      const ahead = st.stars.filter(a => a.x > charX - 5).sort((a, b) => a.x - b.x)[0];
      if (st.letter) st.lane = 1; else if (ahead && ahead.x < charX + w * 0.45) st.lane = ahead.lane;
      st.laneF += (st.lane - st.laneF) * Math.min(1, dt * 7);
      const cy = roadTop + lh * 0.08 + lh * (st.laneF + 0.72);
      // جمع النجوم
      st.stars = st.stars.filter(a => {
        if (a.x < charX + 12 && a.x > charX - 30 && Math.abs(a.lane - st.laneF) < 0.5) {
          st.count++;
          st.parts.push(...burstStars(3, a.x, laneY(a.lane) - s * 50, base * 0.25).map(p => (p.size *= 0.4, p)));
          return false;
        }
        return a.x > -40;
      });

      // الحرف
      if (opts.letters) {
        st.spawnLetterIn -= dt;
        if (!st.letter && st.spawnLetterIn <= 0 && st.phase === 'run') {
          st.letter = { x: w + w * 0.2, ...WORDS[st.wi % WORDS.length] };
          st.wi++;
        }
        const stopX = charX + w * 0.4;
        if (st.letter && st.phase === 'run') {
          st.letter.x -= v * st.speed * dt;
          if (st.letter.x <= stopX) { st.letter.x = stopX; st.phase = 'talk'; st.ph = 0; }
        }
        if (st.phase === 'talk') {
          st.speed = Math.max(0, st.speed - dt * 5);
          st.ph += dt;
          st.bubbleK = Math.min(1, st.bubbleK + dt * 5);
          if (st.ph > 1.7) {
            st.phase = 'run'; st.ph = 0;
            const bh = h * 0.44;
            st.parts.push(...burstStars(18, st.letter.x, laneY(2) - bh * 0.5, base * 0.9));
            st.letter = null; st.spawnLetterIn = 3.2; st.count += 5;
          }
        } else {
          st.speed = Math.min(1, st.speed + dt * 2);
          st.bubbleK = Math.max(0, st.bubbleK - dt * 6);
        }
      }

      // رسم النجوم
      for (const a of st.stars) star(ctx, a.x, laneY(a.lane) - s * 52 + Math.sin(t * 4 + a.bob) * 3, s * 15, Math.sin(t * 3 + a.x * 0.02) * 0.2);

      // حرّوف
      harrouf(ctx, charX, cy, { s, t, run: st.speed > 0.2, mood: st.phase === 'talk' ? 'happy' : 'idle', facing: 1 });

      // الحرف أمامه
      if (st.letter) {
        const bw = w * 0.22, bh = h * 0.44;
        letterBlock(ctx, st.letter.x, laneY(2) + lh * 0.12, bw, bh, st.letter.ch, st.letter.col, t, 0);
      }
      // فقاعة الكلمة
      if (opts.letters) {
        const wd = st.letter ? st.letter.word : WORDS[(st.wi - 1 + WORDS.length) % WORDS.length].word;
        const k = st.bubbleK < 1 ? easeBack(st.bubbleK) : 1;
        bubble(ctx, charX + w * 0.1, cy - s * 140, wd, k, Math.max(14, h * 0.065));
      }

      // جزيئات
      st.parts = stepParts(st.parts, dt, base * 1.4);
      for (const p of st.parts) { ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.4)); star(ctx, p.x, p.y, s * 16 * p.size, p.r); }
      ctx.globalAlpha = 1;

      // عدّاد النجوم
      if (opts.counter) counter(ctx, w, h, st.count);
    };
  }

  function counter(ctx, w, h, n) {
    const fs = Math.max(14, h * 0.06);
    ctx.save();
    ctx.font = `800 ${fs}px ${FONT}`;
    const txt = String(n);
    const tw = ctx.measureText(txt).width;
    const pw = tw + fs * 2.4, ph = fs * 1.6, x = 12, y = 12;
    ctx.fillStyle = 'rgba(255,255,255,.92)';
    rrect(ctx, x, y, pw, ph, ph / 2); ctx.fill();
    star(ctx, x + ph * 0.55, y + ph / 2, fs * 0.55, 0);
    ctx.fillStyle = COL.ink; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillText(txt, x + ph * 1.05, y + ph / 2 + fs * 0.06);
    ctx.restore();
  }

  function easeBack(k) { const c = 1.7; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); }

  // ---------- خطوة 2: الحرف يسدّ الطريق ----------
  function sceneBlock(ctx, w, h, t) {
    const roadTop = h * 0.5;
    const lh = world(ctx, w, h, 0, roadTop);
    const footY = roadTop + lh * 0.08 + lh * 2.72;
    const s = (h * 0.34) / 115;
    const bw = w * 0.24, bh = h * 0.5;
    letterBlock(ctx, w * 0.66, footY + lh * 0.12, bw, bh, 'أ', COL.purple, t, 0);
    harrouf(ctx, w * 0.24, footY, { s, t, run: false, mood: 'idle', facing: 1 });
    // بطاقة الكلمة مع أرنب صغير
    const cw = w * 0.36, ch = h * 0.2, cx = w * 0.66 - cw / 2, cyy = h * 0.06 + Math.sin(t * 2) * 3;
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(42,35,64,.15)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
    rrect(ctx, cx, cyy, cw, ch, ch * 0.3); ctx.fill();
    ctx.restore();
    bunny(ctx, cx + cw - ch * 0.55, cyy + ch * 0.62, ch * 0.012 * 2.2);
    ctx.save();
    ctx.fillStyle = COL.ink; ctx.direction = 'rtl';
    ctx.font = `800 ${Math.round(ch * 0.5)}px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('أَرْنَب', cx + (cw - ch * 1.0) / 2, cyy + ch * 0.55);
    ctx.restore();
  }

  function bunny(ctx, x, y, k) {
    ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#D8D0E8'; ctx.lineWidth = 2;
    for (const sx of [-1, 1]) {
      ctx.save(); ctx.rotate(sx * 0.18);
      ctx.beginPath(); ctx.ellipse(sx * 7, -26, 6, 16, 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#FFB3D1'; ctx.beginPath(); ctx.ellipse(sx * 7, -26, 3, 11, 0, 0, 7); ctx.fill();
      ctx.restore(); ctx.fillStyle = '#fff';
    }
    ctx.beginPath(); ctx.arc(0, 0, 15, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = COL.ink;
    ctx.beginPath(); ctx.arc(-5, -2, 2.2, 0, 7); ctx.arc(5, -2, 2.2, 0, 7); ctx.fill();
    ctx.fillStyle = COL.pink; ctx.beginPath(); ctx.arc(0, 4, 2.4, 0, 7); ctx.fill();
    ctx.restore();
  }

  // ---------- خطوة 3: الانفجار ----------
  function makeBurst() {
    const st = { parts: [], cyc: 0.9 };
    return function (ctx, w, h, t, dt) {
      const roadTop = h * 0.5;
      const lh = world(ctx, w, h, t * 30, roadTop);
      const footY = roadTop + lh * 0.08 + lh * 2.72;
      const s = (h * 0.34) / 115;
      const base = Math.min(w * 0.75, h);
      st.cyc += dt;
      if (st.cyc > 1.8) { st.cyc = 0; st.parts.push(...burstStars(16, w * 0.66, h * 0.55, base * 1.0)); }
      // ومضة
      if (st.cyc < 0.35) {
        const k = st.cyc / 0.35;
        ctx.fillStyle = `rgba(255,236,140,${0.7 * (1 - k)})`;
        ctx.beginPath(); ctx.arc(w * 0.66, h * 0.55, base * (0.08 + k * 0.4), 0, 7); ctx.fill();
      } else if (st.cyc > 1.2) {
        // الحرف يتجمّع من جديد
        const k = Math.min(1, (st.cyc - 1.2) / 0.5);
        ctx.globalAlpha = k;
        letterBlock(ctx, w * 0.66, footY + lh * 0.12, w * 0.26 * k, h * 0.6 * k, 'أ', COL.purple, t, 0);
        ctx.globalAlpha = 1;
      }
      const happy = st.cyc < 1.2;
      harrouf(ctx, w * 0.24, footY, { s, t, run: false, mood: happy ? 'happy' : 'idle', hop: happy ? Math.max(0, Math.sin(Math.min(1, st.cyc / 0.5) * Math.PI)) * 22 : 0, facing: 1 });
      bubble(ctx, w * 0.3, footY - s * 136, 'أَرْنَب!', 1, Math.max(13, h * 0.075));
      st.parts = stepParts(st.parts, dt, base * 1.3);
      for (const p of st.parts) { ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.5)); star(ctx, p.x, p.y, base * 0.045 * p.size, p.r); }
      ctx.globalAlpha = 1;
    };
  }

  // ---------- متجر الملابس ----------
  const OUTFITS = [
    { hat: 'crown', shirt: 'startee' },
    { hat: 'wizard', glasses: 'round' },
    { full: 'bee' },
    { hat: 'party', shirt: 'stripes', shoes: 'rainbow' },
    { full: 'astro' },
    { hat: 'straw', glasses: 'sun', shirt: 'tee' },
    { full: 'dino' },
    { hat: 'cap', shirt: 'hoodie', shoes: 'sneakers' },
    { full: 'hero' },
    { glasses: 'hearts', shirt: 'startee', shoes: 'gold' },
  ];
  function makeCloset() {
    const st = { i: 0, tt: 0, parts: [] };
    return function (ctx, w, h, t, dt) {
      ctx.clearRect(0, 0, w, h);
      st.tt += dt;
      if (st.tt > 1.6) { st.tt = 0; st.i++; st.parts.push(...burstStars(8, w / 2, h * 0.45, h * 0.9).map(p => (p.size *= 0.5, p))); }
      const n = OUTFITS.length;
      const floor = h * 0.9;
      const sBig = (h * 0.62) / 165, sSm = sBig * 0.72;
      // منصّة
      ctx.fillStyle = 'rgba(224,168,0,.18)';
      ctx.beginPath(); ctx.ellipse(w / 2, floor, h * 0.36, h * 0.06, 0, 0, 7); ctx.fill();
      harrouf(ctx, w * 0.2, floor - h * 0.02, { s: sSm, t: t + 1, run: false, mood: 'idle', outfit: OUTFITS[(st.i + n - 1) % n], facing: 1 });
      harrouf(ctx, w * 0.8, floor - h * 0.02, { s: sSm, t: t + 2, run: false, mood: 'idle', outfit: OUTFITS[(st.i + 1) % n], facing: -1 });
      const pop = st.tt < 0.3 ? 0.6 + 0.4 * easeBack(st.tt / 0.3) : 1;
      harrouf(ctx, w / 2, floor, { s: sBig * pop, t, run: false, mood: st.tt < 0.6 ? 'happy' : 'idle', outfit: OUTFITS[st.i % n], facing: 1 });
      st.parts = stepParts(st.parts, dt, h * 1.2);
      for (const p of st.parts) { ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.5)); star(ctx, p.x, p.y, h * 0.035 * p.size + 3, p.r); }
      ctx.globalAlpha = 1;
    };
  }

  // ---------- الدعوة الأخيرة ----------
  function sceneWave(ctx, w, h, t) {
    ctx.clearRect(0, 0, w, h);
    const s = (h * 0.6) / 165;
    const hop = Math.max(0, Math.sin(t * 3.2)) * 26;
    for (let i = 0; i < 5; i++) {
      const a = t * 1.2 + (i / 5) * Math.PI * 2;
      star(ctx, w / 2 + Math.cos(a) * w * 0.4, h * 0.5 + Math.sin(a) * h * 0.2, h * 0.05, a);
    }
    harrouf(ctx, w / 2, h * 0.92, { s, t, run: false, mood: 'happy', hop, outfit: { hat: 'crown' }, facing: 1 });
  }

  // ---------- محرّك المشاهد ----------
  const factories = {
    hero: () => makeRunner({ letters: true, counter: true }),
    run: () => makeRunner({ letters: false, counter: true }),
    block: () => sceneBlock,
    burst: () => makeBurst(),
    closet: () => makeCloset(),
    wave: () => sceneWave,
  };

  const scenes = [];
  document.querySelectorAll('canvas[data-scene]').forEach(cv => {
    const f = factories[cv.dataset.scene];
    if (!f) return;
    scenes.push({ cv, ctx: cv.getContext('2d'), draw: f(), visible: false, w: 0, h: 0 });
  });

  function fit(sc) {
    const r = sc.cv.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    if (w !== sc.w || h !== sc.h || sc.cv.width !== Math.round(w * dpr)) {
      sc.w = w; sc.h = h;
      sc.cv.width = Math.round(w * dpr); sc.cv.height = Math.round(h * dpr);
      sc.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }
  function render(sc, t, dt) {
    fit(sc);
    sc.ctx.save();
    try { sc.draw(sc.ctx, sc.w, sc.h, t, dt); } catch (e) { /* نتجاهل خطأ رسم مؤقت */ }
    sc.ctx.restore();
  }

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      for (const en of entries) {
        const sc = scenes.find(s => s.cv === en.target);
        if (sc) sc.visible = en.isIntersecting;
      }
    }, { rootMargin: '80px' });
    scenes.forEach(sc => io.observe(sc.cv));
  } else {
    scenes.forEach(sc => { sc.visible = true; });
  }

  if (reduce) {
    // بدون حركة: نرسم لقطة ثابتة لكل مشهد، ونعيد الرسم عند تغيّر الحجم أو تحميل الخط
    const still = () => scenes.forEach(sc => {
      for (let i = 0; i < 40; i++) render(sc, 1 + i / 20, 1 / 20);
    });
    still();
    window.addEventListener('resize', still);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(still);
  } else {
    let last = performance.now();
    const t0 = last;
    const loop = now => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = (now - t0) / 1000;
      for (const sc of scenes) if (sc.visible) render(sc, t, dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
})();
