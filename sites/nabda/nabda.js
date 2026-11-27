/* نبضة · من نواة — الكود الأساسي المشترك لكل المواقع */
/* النصوص: CONFIG.gender = 'm' لو الهدية لشاب، CONFIG.kind = 'love' | 'family' | 'sorry' | 'friend'،
   وأي نص بينغيّر من CONFIG.text = { heroTitle: '...', ... } */
const NB_M = CONFIG.gender === 'm';
const NB_V = (f, m) => NB_M ? m : f;
const NB_KIND = {
  love: {},
  family: {
    hint: 'تلميح: يوم بيعنيلنا إحنا الاثنين',
    final: NB_V('لو خيّروني بين كل الدنيا…<br>كنت رح أختارك إنتِ، بكل مرة.', 'لو خيّروني بين كل الدنيا…<br>كنت رح أختارك إنتَ، بكل مرة.')
  },
  friend: {
    hint: 'تلميح: يوم بيعنيلنا إحنا الاثنين',
    heroTitle: NB_V('إنتِ غالية', 'إنتَ غالي'),
    reasonsTitle: NB_V('ليش إنتِ غالية عليّ؟', 'ليش إنتَ غالي عليّ؟'),
    final: NB_V('لو رجع فيني الزمن ألف مرة…<br>كنت رح أختارك إنتِ صاحبتي، بكل مرة.', 'لو رجع فيني الزمن ألف مرة…<br>كنت رح أختارك إنتَ صاحبي، بكل مرة.'),
    footer: 'بكل المحبة'
  },
  sorry: {
    heroTag: 'يومنا',
    heroTitle: NB_V('سامحيني', 'سامحني'),
    reasonsKicker: 'وما بقدر أخسرك',
    reasonsTitle: NB_V('ليش إنتِ أغلى من زعلي؟', 'ليش إنتَ أغلى من زعلي؟'),
    letterKicker: 'كلام من القلب',
    promTitle: 'ووعد مني إلك',
    promSub: 'وهالمرة رح أوفي بكل وعد',
    final: 'يمكن غلطت…<br>بس عمري ما بطّلت أحبك.'
  }
};
const T = Object.assign({
  ytHint: NB_V('اضغطي عالفيديو لتسمعي أغنيتنا ♪', 'اضغط عالفيديو لتسمع أغنيتنا ♪'),
  gateTitle: 'هاد المكان إلك بس',
  gateSub: NB_V('اكتبي التاريخ اللي بيعنيلنا كثير', 'اكتب التاريخ اللي بيعنيلنا كثير'),
  unlock: NB_V('افتحي', 'افتح'),
  hint: 'تلميح: يومنا إحنا الاثنين',
  heroTag: 'يومنا',
  heroTitle: 'بحبك',
  scroll: NB_V('انزلي لتحت ↓', 'انزل لتحت ↓'),
  reasonsKicker: 'مش سبب واحد',
  reasonsTitle: 'ليش بحبك؟',
  reasonsSub: NB_V('اضغطي على كل كرت', 'اضغط على كل كرت'),
  letterKicker: 'من قلبي لإلك',
  letterTitle: 'في رسالة إلك',
  letterSub: NB_V('اقريها على مهل…', 'اقراها على مهل…'),
  envAria: NB_V('افتحي الرسالة', 'افتح الرسالة'),
  envHint: NB_V('اضغطي عالختم لتفتحي الرسالة', 'اضغط عالختم لتفتح الرسالة'),
  promKicker: 'وعد',
  promTitle: 'وعد مني إلك',
  promSub: 'ومش رح أخلف ولا وعد فيهم',
  final: NB_V('لو رجع فيني الزمن ألف مرة…<br>كنت رح أختارك إنتِ، بكل مرة.', 'لو رجع فيني الزمن ألف مرة…<br>كنت رح أختارك إنتَ، بكل مرة.'),
  heartSub: NB_V('اضغطي عالقلب', 'اضغط عالقلب'),
  footer: 'بكل الحب',
  photosKicker: 'ذكرياتنا',
  photosTitle: 'صورنا',
  photosSub: NB_V('اضغطي على أي صورة', 'اضغط على أي صورة'),
  voiceTitle: 'رسالة بصوتي',
  voiceSub: NB_V('حطي سماعات… واسمعيها', 'حط سماعات… واسمعها'),
  waitTitle: 'لسا شوي…',
  waitSub: 'هالمكان بينفتح',
  waitUnits: ['يوم', 'ساعة', 'دقيقة', 'ثانية'],
  wrong: NB_V(['لا لا… فكري منيح','معقول نسيتي؟','قريبة… جربي كمان مرة'], ['لا لا… فكر منيح','معقول نسيت؟','قريب… جرب كمان مرة'])
}, NB_KIND[CONFIG.kind] || {}, CONFIG.text || {});
const PHOTOS = (CONFIG.photos || []).map(p => typeof p === 'string' ? {src: p} : p);
document.body.insertAdjacentHTML('afterbegin', `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
  <radialGradient id="gRed" cx="32%" cy="28%" r="85%"><stop offset="0" stop-color="#ff9ab8"/><stop offset=".45" stop-color="#e3336a"/><stop offset="1" stop-color="#9c0f3f"/></radialGradient>
  <radialGradient id="gPink" cx="32%" cy="28%" r="85%"><stop offset="0" stop-color="#ffdbe6"/><stop offset=".5" stop-color="#f390ae"/><stop offset="1" stop-color="#d4466f"/></radialGradient>
  <radialGradient id="gBlush" cx="32%" cy="28%" r="85%"><stop offset="0" stop-color="#fff"/><stop offset=".5" stop-color="#ffcfdc"/><stop offset="1" stop-color="#f29ab5"/></radialGradient>
  <radialGradient id="gSeal" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="#e45a83"/><stop offset=".6" stop-color="#b82654"/><stop offset="1" stop-color="#7a1234"/></radialGradient>
</defs></svg>

<div id="ytWrap"><div id="yt"></div></div>
<div id="ytHint">${T.ytHint}</div>
<div id="hearts"></div>
<div id="intro"><div id="introLine"></div><button id="skip">تخطّي ←</button></div>
<canvas id="confetti"></canvas>

<!-- القفل -->
<div id="gate">
  <div class="lock-wrap"><span class="ic lock" id="lock"></span></div>
  <h1>${T.gateTitle}<br>يا <span data-t="nick"></span></h1>
  <p>${T.gateSub}</p>
  <div class="date" id="dateBox">
    <div class="f"><label>اليوم</label><input id="dd" inputmode="numeric" placeholder="--" autocomplete="off" aria-label="اليوم"></div>
    <div class="slash">/</div>
    <div class="f"><label>الشهر</label><input id="mm" inputmode="numeric" maxlength="2" placeholder="--" autocomplete="off" aria-label="الشهر"></div>
  </div>
  <div id="err"></div>
  <button class="btn" id="unlock">${T.unlock} <span class="ic" data-ic="key"></span></button>
  <div class="hint">${T.hint}</div>
  <div id="waitBox" hidden>
    <p class="wait-sub">${T.waitSub} <b id="waitWhen"></b></p>
    <div class="count" id="count"></div>
  </div>
</div>

<section id="hero">
  <div class="hero-date"><span data-t="date"></span> · ${T.heroTag}</div>
  <h1 class="hero-title">${T.heroTitle}<br>يا <span data-t="nick"></span></h1>
  <div class="hero-line"><span class="ic" data-ic="sparkle"></span></div>
  <div id="typed"></div>
  <div class="scroll-hint">${T.scroll}</div>
</section>

<section>
  <div class="kicker reveal">${T.reasonsKicker}</div>
  <h2 class="h2 reveal">${T.reasonsTitle}</h2>
  <p class="sub reveal">${T.reasonsSub}</p>
  <div class="cards reveal" id="cards"></div>
</section>
${PHOTOS.length ? `
<section>
  <div class="kicker reveal">${T.photosKicker}</div>
  <h2 class="h2 reveal">${T.photosTitle}</h2>
  <p class="sub reveal">${T.photosSub}</p>
  <div class="gallery" id="gallery"></div>
</section>` : ''}

<section>
  <div class="kicker reveal">${T.letterKicker}</div>
  <h2 class="h2 reveal">${T.letterTitle}</h2>
  <p class="sub reveal">${T.letterSub}</p>
  <div class="env-wrap reveal">
    <div class="envelope" id="envelope" role="button" aria-label="${T.envAria}">
      <div class="env-body"></div>
      <div class="env-flap"></div>
      <span class="seal ic" id="seal"></span>
    </div>
    <div class="env-hint" id="envHint">${T.envHint}</div>
    <article class="letter" id="letter">
      <div class="greet" id="greet"></div>
      <div id="letterBody"></div>
      <div class="sign" id="sign"></div>
    </article>
  </div>
  ${CONFIG.voice ? `
  <div class="voice" id="voice" hidden>
    <button class="voice-btn" id="voiceBtn" aria-label="${T.voiceTitle}"><span class="ic" id="voiceIc"></span></button>
    <div class="voice-meta">
      <b>${T.voiceTitle}</b>
      <span>${T.voiceSub}</span>
      <div class="voice-bar" id="voiceBar"><i></i></div>
    </div>
    <span class="voice-time" id="voiceTime" dir="ltr">0:00</span>
  </div>` : ''}
</section>

<section>
  <div class="kicker reveal">${T.promKicker}</div>
  <h2 class="h2 reveal">${T.promTitle}</h2>
  <p class="sub reveal">${T.promSub}</p>
  <div class="promises" id="promises"></div>
</section>

<section>
  <button class="big-heart ic reveal" id="bigHeart" aria-label="قلب"></button>
  <div class="final-line reveal">${T.final}</div>
  <div class="sub reveal" style="margin-top:12px">${T.heartSub}</div>
  <div id="forever"></div>
</section>

${PHOTOS.length ? `<div id="lightbox" hidden role="dialog" aria-modal="true"><button class="lb-x" id="lbX" aria-label="إغلاق">✕</button><button class="lb-nav lb-prev" id="lbPrev" aria-label="السابقة">›</button><figure><img id="lbImg" alt=""><figcaption id="lbCap"></figcaption></figure><button class="lb-nav lb-next" id="lbNext" aria-label="التالية">‹</button></div>` : ''}
<footer>إلك يا <span data-t="name"></span>، ${T.footer}<small style="display:block;margin-top:8px;font-size:11px;opacity:.6">© نَبضة · من نَواة · جميع الحقوق محفوظة</small></footer>
<button class="fab" id="musicBtn" aria-label="الموسيقى"><span class="ic" id="musicIc"></span></button>

`);

const $ = s => document.querySelector(s);
const arabicNum = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
const DATE = arabicNum(CONFIG.day) + '/' + arabicNum(CONFIG.month);
const fill = s => s.replace(/\{name\}/g, CONFIG.name).replace(/\{nick\}/g, CONFIG.nick).replace(/\{date\}/g, DATE);
document.title = 'إلك يا ' + CONFIG.nick;
document.querySelectorAll('[data-t]').forEach(el => el.textContent = ({name: CONFIG.name, nick: CONFIG.nick, date: DATE})[el.dataset.t]);

/* جهاز ضعيف؟ */
const LITE = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 3 || matchMedia('(max-width:420px) and (max-resolution:1.5dppx)').matches;
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (LITE) document.documentElement.classList.add('lite');

/* أيقونات */
const L = 'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"';
const HP = 'M12 21s-7.6-4.6-10-9.4C.4 8.3 2.3 4.6 5.9 4.3c2.3-.2 4.1 1 6.1 3.3 2-2.3 3.8-3.5 6.1-3.3 3.6.3 5.5 4 3.9 7.3C19.6 16.4 12 21 12 21z';
const heartSVG = g => `<svg viewBox="0 0 24 24"><path fill="url(#${g})" d="${HP}"/><ellipse cx="7.3" cy="7.6" rx="1.3" ry=".8" fill="#fff" opacity=".55" transform="rotate(-30 7.3 7.6)"/></svg>`;
const SVG = {
  lock: `<svg viewBox="0 0 24 24" ${L}><rect x="5" y="10.5" width="14" height="10" rx="2.6"/><path d="M8.2 10.5V7.6a3.8 3.8 0 0 1 7.6 0v2.9"/><path d="M12 14.6v2.2"/></svg>`,
  unlock: `<svg viewBox="0 0 24 24" ${L}><rect x="5" y="10.5" width="14" height="10" rx="2.6"/><path d="M8.2 10.5V7.6a3.8 3.8 0 0 1 7.3-1.5"/><path d="M12 14.6v2.2"/></svg>`,
  key: `<svg viewBox="0 0 24 24" ${L}><circle cx="8" cy="15.5" r="3.8"/><path d="M10.8 12.8 19 4.6M15.8 7.8l2.2 2.2M13.6 10l1.8 1.8"/></svg>`,
  heartLine: `<svg viewBox="0 0 24 24" ${L}><path d="${HP}"/></svg>`,
  music: `<svg viewBox="0 0 24 24" ${L}><path d="M9 17.5V6.2l10-2.2v11.3"/><circle cx="6.6" cy="17.5" r="2.4"/><circle cx="16.6" cy="15.3" r="2.4"/></svg>`,
  play: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>`,
  pause: `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="5" width="4" height="14" rx="1.2"/><rect x="13.5" y="5" width="4" height="14" rx="1.2"/></svg>`,
  muted: `<svg viewBox="0 0 24 24" ${L}><path d="M4 9.5h3.4L12 6v12l-4.6-3.5H4z"/><path d="m16 9.8 4.4 4.4M20.4 9.8 16 14.2"/></svg>`,
  seal: `<svg viewBox="0 0 64 64"><path fill="url(#gSeal)" d="M32 3c4 0 5 3 8.5 4.2S48 6 50.5 9s1 6.5 3.2 9.5 6.3 3.5 7 7.5-2.6 5.6-2.6 9.5 3 6.2 1.6 9.8-5.5 3.3-7.8 6.3-1.6 6.7-5 8.6-6.3-.6-10.2.2S32 64 28 63.3s-4.4-3.9-8-5.3-7.2.3-9.7-2.7.1-6.5-1.8-9.9S1.6 41.6 1.2 37.6 4.5 32 4.6 28 1.4 21.7 3.3 18.2 9.1 15.6 11.6 12.6 13.4 6 17 4.4 22 5.6 26 4.2 28 3 32 3z"/><circle cx="32" cy="33" r="18" fill="none" stroke="#ffc2d3" stroke-opacity=".5" stroke-width="1.2"/><path transform="translate(20 21)" fill="#ffd9e4" fill-opacity=".92" d="${HP}"/></svg>`
};
/* أيقونات Phosphor Icons (MIT) */
const PH = {
  lock: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M208,88H48a8,8,0,0,0-8,8V208a8,8,0,0,0,8,8H208a8,8,0,0,0,8-8V96A8,8,0,0,0,208,88Zm-80,72a20,20,0,1,1,20-20A20,20,0,0,1,128,160Z" opacity="0.2"/><path d="M208,80H176V56a48,48,0,0,0-96,0V80H48A16,16,0,0,0,32,96V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80ZM96,56a32,32,0,0,1,64,0V80H96ZM208,208H48V96H208V208Zm-80-96a28,28,0,0,0-8,54.83V184a8,8,0,0,0,16,0V166.83A28,28,0,0,0,128,112Zm0,40a12,12,0,1,1,12-12A12,12,0,0,1,128,152Z"/></svg>`,
  unlock: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M208,88H48a8,8,0,0,0-8,8V208a8,8,0,0,0,8,8H208a8,8,0,0,0,8-8V96A8,8,0,0,0,208,88Zm-80,72a20,20,0,1,1,20-20A20,20,0,0,1,128,160Z" opacity="0.2"/><path d="M208,80H96V56a32,32,0,0,1,32-32c15.37,0,29.2,11,32.16,25.59a8,8,0,0,0,15.68-3.18C171.32,24.15,151.2,8,128,8A48.05,48.05,0,0,0,80,56V80H48A16,16,0,0,0,32,96V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80Zm0,128H48V96H208V208Zm-80-96a28,28,0,0,0-8,54.83V184a8,8,0,0,0,16,0V166.83A28,28,0,0,0,128,112Zm0,40a12,12,0,1,1,12-12A12,12,0,0,1,128,152Z"/></svg>`,
  key: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M232,98.36C230.73,136.92,198.67,168,160.09,168a71.68,71.68,0,0,1-26.92-5.17h0L120,176H96v24H72v24H40a8,8,0,0,1-8-8V187.31a8,8,0,0,1,2.34-5.65l58.83-58.83h0A71.68,71.68,0,0,1,88,95.91c0-38.58,31.08-70.64,69.64-71.87A72,72,0,0,1,232,98.36Z" opacity="0.2"/><path d="M216.57,39.43A80,80,0,0,0,83.91,120.78L28.69,176A15.86,15.86,0,0,0,24,187.31V216a16,16,0,0,0,16,16H72a8,8,0,0,0,8-8V208H96a8,8,0,0,0,8-8V184h16a8,8,0,0,0,5.66-2.34l9.56-9.57A79.73,79.73,0,0,0,160,176h.1A80,80,0,0,0,216.57,39.43ZM224,98.1c-1.09,34.09-29.75,61.86-63.89,61.9H160a63.7,63.7,0,0,1-23.65-4.51,8,8,0,0,0-8.84,1.68L116.69,168H96a8,8,0,0,0-8,8v16H72a8,8,0,0,0-8,8v16H40V187.31l58.83-58.82a8,8,0,0,0,1.68-8.84A63.72,63.72,0,0,1,96,95.92c0-34.14,27.81-62.8,61.9-63.89A64,64,0,0,1,224,98.1ZM192,76a12,12,0,1,1-12-12A12,12,0,0,1,192,76Z"/></svg>`,
  music: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M208,164a28,28,0,1,1-28-28A28,28,0,0,1,208,164ZM52,168a28,28,0,1,0,28,28A28,28,0,0,0,52,168Z" opacity="0.2"/><path d="M212.92,17.69a8,8,0,0,0-6.86-1.45l-128,32A8,8,0,0,0,72,56V166.08A36,36,0,1,0,88,196V110.25l112-28v51.83A36,36,0,1,0,216,164V24A8,8,0,0,0,212.92,17.69ZM52,216a20,20,0,1,1,20-20A20,20,0,0,1,52,216ZM88,93.75V62.25l112-28v31.5ZM180,184a20,20,0,1,1,20-20A20,20,0,0,1,180,184Z"/></svg>`,
  muted: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M80,88v80H32a8,8,0,0,1-8-8V96a8,8,0,0,1,8-8Z" opacity="0.2"/><path d="M53.92,34.62A8,8,0,1,0,42.08,45.38L73.55,80H32A16,16,0,0,0,16,96v64a16,16,0,0,0,16,16H77.25l69.84,54.31A8,8,0,0,0,160,224V175.09l42.08,46.29a8,8,0,1,0,11.84-10.76ZM32,96H72v64H32ZM144,207.64,88,164.09V95.89l56,61.6Zm42-63.77a24,24,0,0,0,0-31.72,8,8,0,1,1,12-10.57,40,40,0,0,1,0,52.88,8,8,0,0,1-12-10.59Zm-80.16-76a8,8,0,0,1,1.4-11.23l39.85-31A8,8,0,0,1,160,32v74.83a8,8,0,0,1-16,0V48.36l-26.94,21A8,8,0,0,1,105.84,67.91ZM248,128a79.9,79.9,0,0,1-20.37,53.34,8,8,0,0,1-11.92-10.67,64,64,0,0,0,0-85.33,8,8,0,1,1,11.92-10.67A79.83,79.83,0,0,1,248,128Z"/></svg>`,
  sparkle: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M194.82,151.43l-55.09,20.3-20.3,55.09a7.92,7.92,0,0,1-14.86,0l-20.3-55.09-55.09-20.3a7.92,7.92,0,0,1,0-14.86l55.09-20.3,20.3-55.09a7.92,7.92,0,0,1,14.86,0l20.3,55.09,55.09,20.3A7.92,7.92,0,0,1,194.82,151.43Z" opacity="0.2"/><path d="M197.58,129.06,146,110l-19-51.62a15.92,15.92,0,0,0-29.88,0L78,110l-51.62,19a15.92,15.92,0,0,0,0,29.88L78,178l19,51.62a15.92,15.92,0,0,0,29.88,0L146,178l51.62-19a15.92,15.92,0,0,0,0-29.88ZM137,164.22a8,8,0,0,0-4.74,4.74L112,223.85,91.78,169A8,8,0,0,0,87,164.22L32.15,144,87,123.78A8,8,0,0,0,91.78,119L112,64.15,132.22,119a8,8,0,0,0,4.74,4.74L191.85,144ZM144,40a8,8,0,0,1,8-8h16V16a8,8,0,0,1,16,0V32h16a8,8,0,0,1,0,16H184V64a8,8,0,0,1-16,0V48H152A8,8,0,0,1,144,40ZM248,88a8,8,0,0,1-8,8h-8v8a8,8,0,0,1-16,0V96h-8a8,8,0,0,1,0-16h8V72a8,8,0,0,1,16,0v8h8A8,8,0,0,1,248,88Z"/></svg>`,
  infinity: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M225.94,161.94a48,48,0,0,1-67.88,0L128,128l30.06-33.94a48,48,0,0,1,67.88,67.88ZM30.06,94.06a48,48,0,0,0,67.88,67.88L128,128,97.94,94.06A48,48,0,0,0,30.06,94.06Z" opacity="0.2"/><path d="M248,128a56,56,0,0,1-95.6,39.6l-.33-.35L92.12,99.55a40,40,0,1,0,0,56.9l8.52-9.62a8,8,0,1,1,12,10.61l-8.69,9.81-.33.35a56,56,0,1,1,0-79.2l.33.35,59.95,67.7a40,40,0,1,0,0-56.9l-8.52,9.62a8,8,0,1,1-12-10.61l8.69-9.81.33-.35A56,56,0,0,1,248,128Z"/></svg>`,
  handHeart: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M16,152H48v56H16a8,8,0,0,1-8-8V160A8,8,0,0,1,16,152ZM192.54,40A39.12,39.12,0,0,0,156,64a39.12,39.12,0,0,0-36.54-24C97.67,40,80,58.31,80,80c0,14.56,7,27.71,16.73,40H140a20,20,0,0,1,0,40h4l37.78-8.68C203.82,135.07,232,109.23,232,80,232,58.31,214.33,40,192.54,40Z" opacity="0.2"/><path d="M230.33,141.06a24.34,24.34,0,0,0-18.61-4.77C230.5,117.33,240,98.48,240,80c0-26.47-21.29-48-47.46-48A47.58,47.58,0,0,0,156,48.75,47.58,47.58,0,0,0,119.46,32C93.29,32,72,53.53,72,80c0,11,3.24,21.69,10.06,33a31.87,31.87,0,0,0-14.75,8.4L44.69,144H16A16,16,0,0,0,0,160v40a16,16,0,0,0,16,16H120a7.93,7.93,0,0,0,1.94-.24l64-16a6.94,6.94,0,0,0,1.19-.4L226,182.82l.44-.2a24.6,24.6,0,0,0,3.93-41.56ZM119.46,48A31.15,31.15,0,0,1,148.6,67a8,8,0,0,0,14.8,0,31.15,31.15,0,0,1,29.14-19C209.59,48,224,62.65,224,80c0,19.51-15.79,41.58-45.66,63.9l-11.09,2.55A28,28,0,0,0,140,112H100.68C92.05,100.36,88,90.12,88,80,88,62.65,102.41,48,119.46,48ZM16,160H40v40H16Zm203.43,8.21-38,16.18L119,200H56V155.31l22.63-22.62A15.86,15.86,0,0,1,89.94,128H140a12,12,0,0,1,0,24H112a8,8,0,0,0,0,16h32a8.32,8.32,0,0,0,1.79-.2l67-15.41.31-.08a8.6,8.6,0,0,1,6.3,15.9Z"/></svg>`,
  envelope: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M224,96l-78.55,56h-34.9L32,96l96-64Z" opacity="0.2"/><path d="M228.44,89.34l-96-64a8,8,0,0,0-8.88,0l-96,64A8,8,0,0,0,24,96V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V96A8,8,0,0,0,228.44,89.34ZM128,41.61l81.91,54.61-67,47.78H113.11l-67-47.78ZM40,200V111.53l65.9,47a8,8,0,0,0,4.65,1.49h34.9a8,8,0,0,0,4.65-1.49l65.9-47V200Z"/></svg>`,
  heartLine: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M178,44c-21.44,0-39.92,10.19-50,27.07C117.92,54.19,99.44,44,78,44a58.07,58.07,0,0,0-58,58c0,28.59,18,58.47,53.4,88.79a333.81,333.81,0,0,0,52.7,36.73,4,4,0,0,0,3.8,0,333.81,333.81,0,0,0,52.7-36.73C218,160.47,236,130.59,236,102A58.07,58.07,0,0,0,178,44ZM128,219.42c-14-8-100-59.35-100-117.42A50.06,50.06,0,0,1,78,52c21.11,0,38.85,11.31,46.3,29.51a4,4,0,0,0,7.4,0C139.15,63.31,156.89,52,178,52a50.06,50.06,0,0,1,50,50C228,160,142,211.46,128,219.42Z"/></svg>`,
  heartDuo: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M232,102c0,66-104,122-104,122S24,168,24,102A54,54,0,0,1,78,48c22.59,0,41.94,12.31,50,32,8.06-19.69,27.41-32,50-32A54,54,0,0,1,232,102Z" opacity="0.2"/><path d="M178,40c-20.65,0-38.73,8.88-50,23.89C116.73,48.88,98.65,40,78,40a62.07,62.07,0,0,0-62,62c0,70,103.79,126.66,108.21,129a8,8,0,0,0,7.58,0C136.21,228.66,240,172,240,102A62.07,62.07,0,0,0,178,40ZM128,214.8C109.74,204.16,32,155.69,32,102A46.06,46.06,0,0,1,78,56c19.45,0,35.78,10.36,42.6,27a8,8,0,0,0,14.8,0c6.82-16.67,23.15-27,42.6-27a46.06,46.06,0,0,1,46,46C224,155.61,146.24,204.15,128,214.8Z"/></svg>`,
};
Object.assign(SVG,{lock:PH.lock,unlock:PH.unlock,key:PH.key,music:PH.music,muted:PH.muted,heartLine:PH.heartLine,sparkle:PH.sparkle,infinity:PH.infinity,handHeart:PH.handHeart,envelope:PH.envelope});
const svg = k => SVG[k];
document.querySelectorAll('[data-ic]').forEach(el => el.innerHTML = svg(el.dataset.ic));
$('#lock').innerHTML = svg('lock'); $('#musicIc').innerHTML = svg('muted');
$('#seal').innerHTML = svg('seal'); $('#bigHeart').innerHTML = heartSVG('gRed');

/* قلوب نازلة: عدد أقل وبدون فلاتر عالأجهزة الضعيفة */
const MAX = REDUCED ? 0 : LITE ? 12 : 24, EVERY = LITE ? 1100 : 650;
const grads = ['gRed','gPink','gBlush','gPink'];
let live = 0, heartTimer;
function spawnHeart(force){
  if (!MAX || (live >= MAX && !force) || document.hidden) return;
  const d = Math.random(), size = d < .5 ? 12 + d*20 : 26 + d*26;
  const f = document.createElement('span'); f.className = 'fall';
  f.style.cssText = `left:${Math.random()*96}vw;width:${size}px;height:${size}px;opacity:${d < .5 ? .5 : .95};animation-duration:${(d < .5 ? 15 : 9) + Math.random()*4}s`;
  f.innerHTML = heartSVG(grads[Math.random()*grads.length|0]);
  f.firstChild.style.animationDuration = (2.4 + Math.random()*2) + 's';
  $('#hearts').appendChild(f); live++;
  f.addEventListener('animationend', e => { if (e.target === f) { f.remove(); live--; } });
}

/* كونفيتي */
const cv = $('#confetti'), cx = cv.getContext('2d'); let parts = [], running = false;
function resize(){ cv.width = innerWidth; cv.height = innerHeight; } resize(); addEventListener('resize', resize);
const colors = ['#e3336a','#f390ae','#ffcfdc','#b98e4a','#fff'];
function confetti(n = 140){
  if (REDUCED) return; n = LITE ? n * .4 | 0 : n;
  for (let i = 0; i < n; i++) parts.push({x: innerWidth/2 + (Math.random()-.5)*160, y: innerHeight/3, vx: (Math.random()-.5)*14, vy: -Math.random()*14 - 4, s: Math.random()*6 + 4, c: colors[Math.random()*colors.length|0], r: Math.random()*6, vr: (Math.random()-.5)*.3});
  if (!running) loop();
}
function loop(){
  running = true; cx.clearRect(0, 0, cv.width, cv.height);
  for (const p of parts) { p.vy += .32; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr; cx.save(); cx.translate(p.x, p.y); cx.rotate(p.r); cx.fillStyle = p.c; cx.fillRect(-p.s/2, -p.s/4, p.s, p.s/2); cx.restore(); }
  parts = parts.filter(p => p.y < innerHeight + 40);
  if (parts.length) requestAnimationFrame(loop); else { running = false; cx.clearRect(0, 0, cv.width, cv.height); }
}
function burst(n = 10){ confetti(100); for (let i = 0; i < n; i++) setTimeout(() => spawnHeart(true), i*110); }

/* ============ الموسيقى (يوتيوب + احتياط) ============ */
let actx, musicOn = false, musicTimer;
const chords = [[262,330,392,523],[220,262,330,440],[175,220,262,349],[196,247,294,392]];
function playLoop(){
  if (!musicOn) return;
  let t = actx.currentTime + .1;
  chords.forEach(ch => { for (let r = 0; r < 2; r++) [0,1,2,3,2,1].forEach(k => {
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = 'sine'; o.frequency.value = ch[k] * 2;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.07, t + .02); g.gain.exponentialRampToValueAtTime(.001, t + 1.4);
    o.connect(g).connect(actx.destination); o.start(t); o.stop(t + 1.5); t += .32;
  }); });
  musicTimer = setTimeout(playLoop, (t - actx.currentTime) * 1000);
}
let yt, ytReady = false, ytFailed = false, wantPlay = false, synthOn = false, ytStarted = false, asking = false;
/* أغنية من ملف: تدريج حقيقي على كل الأجهزة (الموبايل ما بيسمح يتحكم بصوت يوتيوب) */
const FILE = CONFIG.songFile || '';
let au2, gain2;
function fileVolume(v, secs){ if (!gain2) return; const t = actx.currentTime; gain2.gain.cancelScheduledValues(t); gain2.gain.setValueAtTime(gain2.gain.value, t); gain2.gain.linearRampToValueAtTime(v, t + (secs || .4)); }
function filePlay(){
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)(); actx.resume();
    if (!au2) {
      au2 = new Audio(); au2.src = FILE; au2.loop = true; au2.preload = 'auto'; au2.playsInline = true;
      const src = actx.createMediaElementSource(au2); gain2 = actx.createGain(); gain2.gain.value = 0;
      src.connect(gain2).connect(actx.destination);
      if (CONFIG.songStart) au2.currentTime = CONFIG.songStart;
    }
    const t = actx.currentTime; gain2.gain.cancelScheduledValues(t); gain2.gain.setValueAtTime(0, t);
    // أول ٣ ثواني بيطلع لـ١٥٪، بيضل خفيف لحد الثانية ١٥، وبعدين بيعلى لـ١٠٠٪ خلال ١٠ ثواني
    gain2.gain.linearRampToValueAtTime(.15, t + 3); gain2.gain.setValueAtTime(.15, t + 15); gain2.gain.linearRampToValueAtTime(1, t + 25);
    au2.play().catch(() => { ytFailed = true; startSynth(); });
  } catch (e) { startSynth(); }
}
if (!FILE) { const ytTag = document.createElement('script'); ytTag.src = 'https://www.youtube.com/iframe_api'; ytTag.onerror = () => { ytFailed = true; }; document.head.appendChild(ytTag); }
window.onYouTubeIframeAPIReady = () => {
  yt = new YT.Player('yt', {
    videoId: CONFIG.song, width: '100%', height: '100%',
    playerVars: {start: CONFIG.songStart, controls: 1, rel: 0, playsinline: 1, loop: 1, playlist: CONFIG.song, modestbranding: 1},
    events: {
      onReady: () => { ytReady = true; if (wantPlay) ytPlay(); },
      onStateChange: e => { if (e.data === 1) { ytStarted = true; $('#ytWrap').classList.add('on'); if (asking) { endAsk(); if (yt.isMuted()) yt.unMute(); startFade(); } } },
      onError: () => { ytFailed = true; endAsk(); if (musicOn) startSynth(); }
    }
  });
};
function askTap(){ if (ytFailed || !yt) return; asking = true; $('#ytWrap').classList.add('on', 'ask'); $('#ytHint').classList.add('on'); }
function endAsk(){ asking = false; $('#ytWrap').classList.remove('ask'); $('#ytHint').classList.remove('on'); }
function checkPlaying(){ if (musicOn && !ytFailed && !(ytReady && yt.getPlayerState() === 1 && !yt.isMuted())) askTap(); }
function ytPlay(){ yt.unMute(); yt.setVolume(0); yt.playVideo(); startFade(); }
function startFade(){
  // أول 15 ثانية خفيف (١٥٪)، بعدها بيعلى لـ١٠٠٪ خلال ١٠ ثواني
  const SOFT = 15, SOFT_SECS = 15, RISE_SECS = 10, t0 = performance.now();
  clearInterval(window._fade);
  window._fade = setInterval(() => {
    const s = (performance.now() - t0) / 1000;
    const v = s < 3 ? SOFT * s / 3 : s < SOFT_SECS ? SOFT : SOFT + (100 - SOFT) * Math.min(1, (s - SOFT_SECS) / RISE_SECS);
    if (yt && yt.setVolume) yt.setVolume(Math.round(v));
    if (v >= 100) clearInterval(window._fade);
  }, 250);
}
function startSynth(){ if (synthOn) return; try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); actx.resume(); } catch(e) { return; } synthOn = true; playLoop(); }
function startMusic(){
  if (musicOn) return; musicOn = true; $('#musicIc').innerHTML = svg('music');
  if (FILE) return filePlay();
  if (ytFailed) return startSynth();
  if (ytReady) ytPlay(); else wantPlay = true;
  setTimeout(checkPlaying, 2500);
  setTimeout(() => { if (musicOn && !yt) { ytFailed = true; startSynth(); } }, 7000);
}
function stopMusic(){ musicOn = false; wantPlay = false; synthOn = false; clearTimeout(musicTimer); if (au2) au2.pause(); if (ytReady) yt.pauseVideo(); endAsk(); $('#musicIc').innerHTML = svg('muted'); }
$('#musicBtn').onclick = () => musicOn ? stopMusic() : startMusic();

/* كتابة تدريجية */
function typeText(el, text, speed){ el.textContent = ''; let i = 0; const t = setInterval(() => { el.textContent = text.slice(0, ++i); if (i >= text.length) clearInterval(t); }, speed); }

/* الأسباب */
CONFIG.reasons.forEach((r, i) => {
  const c = document.createElement('div'); c.className = 'card';
  c.innerHTML = `<div class="card-in"><div class="face front"><span class="ic">${heartSVG(['gRed','gPink','gBlush'][i%3])}</span><span>السبب ${arabicNum(i + 1)}</span></div><div class="face back"></div></div>`;
  c.querySelector('.back').textContent = fill(r);
  c.onclick = () => { c.classList.toggle('flip'); if (c.classList.contains('flip')) spawnHeart(true); };
  $('#cards').appendChild(c);
});

/* الرسالة */
$('#greet').textContent = CONFIG.nick + '…';
CONFIG.letter.forEach(line => {
  const p = document.createElement('p');
  if (line.startsWith('*')) { p.className = 'big'; line = line.slice(1); }
  p.textContent = fill(line); $('#letterBody').appendChild(p);
});
$('#sign').innerHTML = `— <span></span> <span class="ic">${svg('heartLine')}</span>`;
$('#sign span').textContent = CONFIG.from;
let opened = false;
function openLetter(){
  if (opened) return; opened = true;
  $('#envelope').classList.add('opened'); $('#envHint').style.display = 'none';
  setTimeout(() => {
    $('#envelope').style.display = 'none';
    const L = $('#letter'); L.style.display = 'block'; requestAnimationFrame(() => L.classList.add('show'));
    burst(8);
    const ps = [...document.querySelectorAll('#letterBody p')];
    ps.forEach((p, i) => setTimeout(() => p.classList.add('on'), 700 + i * 1500));
    setTimeout(() => { $('#sign').classList.add('on'); const v = $('#voice'); if (v) { v.hidden = false; requestAnimationFrame(() => v.classList.add('on')); } }, 700 + ps.length * 1500);
  }, 600);
}
$('#envelope').onclick = openLetter;

/* الصور */
if (PHOTOS.length) {
  const g = $('#gallery');
  PHOTOS.forEach((ph, i) => {
    const b = document.createElement('button');
    b.className = 'polaroid reveal'; b.style.setProperty('--r', ([-3, 2, -1.5, 3, -2, 1.5][i % 6]) + 'deg');
    b.setAttribute('aria-label', ph.cap || ('صورة ' + arabicNum(i + 1)));
    b.innerHTML = '<img loading="lazy" decoding="async" alt=""><span></span>';
    b.querySelector('img').src = ph.src; b.querySelector('span').textContent = ph.cap ? fill(ph.cap) : '';
    b.onclick = () => openLb(i);
    g.appendChild(b);
  });
  let cur = 0, sx = 0;
  const lb = $('#lightbox');
  function showLb(i){ cur = (i + PHOTOS.length) % PHOTOS.length; $('#lbImg').src = PHOTOS[cur].src; $('#lbCap').textContent = PHOTOS[cur].cap ? fill(PHOTOS[cur].cap) : ''; }
  function openLb(i){ showLb(i); lb.hidden = false; requestAnimationFrame(() => lb.classList.add('on')); $('#lbX').focus(); }
  function closeLb(){ lb.classList.remove('on'); setTimeout(() => lb.hidden = true, 250); }
  $('#lbX').onclick = closeLb;
  $('#lbNext').onclick = () => showLb(cur + 1);
  $('#lbPrev').onclick = () => showLb(cur - 1);
  lb.addEventListener('click', e => { if (e.target === lb) closeLb(); });
  lb.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, {passive: true});
  lb.addEventListener('touchend', e => { const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 50) showLb(cur + (dx > 0 ? 1 : -1)); });
  addEventListener('keydown', e => { if (lb.hidden) return; if (e.key === 'Escape') closeLb(); if (e.key === 'ArrowLeft') showLb(cur + 1); if (e.key === 'ArrowRight') showLb(cur - 1); });
}

/* الرسالة الصوتية */
if (CONFIG.voice) {
  const au = new Audio(); au.preload = 'none'; au.src = CONFIG.voice;
  const ic = $('#voiceIc'), bar = $('#voiceBar i'), tm = $('#voiceTime');
  ic.innerHTML = svg('play');
  const fmt = t => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
  const duck = on => { if (gain2) return fileVolume(on ? .08 : 1, .6); if (yt && yt.setVolume && ytStarted) { clearInterval(window._fade); yt.setVolume(on ? 8 : 100); } };
  $('#voiceBtn').onclick = () => { if (au.paused) { au.play().catch(() => {}); } else au.pause(); };
  au.addEventListener('play', () => { ic.innerHTML = svg('pause'); duck(true); $('#voice').classList.add('playing'); });
  au.addEventListener('pause', () => { ic.innerHTML = svg('play'); duck(false); $('#voice').classList.remove('playing'); });
  au.addEventListener('ended', () => { bar.style.width = '0'; tm.textContent = fmt(au.duration || 0); });
  au.addEventListener('timeupdate', () => { if (au.duration) bar.style.width = (au.currentTime / au.duration * 100) + '%'; tm.textContent = fmt(au.currentTime); });
  au.addEventListener('loadedmetadata', () => { tm.textContent = fmt(au.duration); });
  $('#voiceBar').onclick = e => { if (!au.duration) return; const r = e.currentTarget.getBoundingClientRect(); au.currentTime = (r.right - e.clientX) / r.width * au.duration; };
}

/* الوعود */
CONFIG.promises.forEach((p, i) => {
  const d = document.createElement('div'); d.className = 'promise';
  d.innerHTML = `<span class="ic">${svg('handHeart')}</span><span></span>`; d.lastChild.textContent = fill(p);
  $('#promises').appendChild(d);
});

/* ظهور عند النزول */
const io = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  e.target.classList.add('in'); io.unobserve(e.target);
  if (e.target.id === 'promises') document.querySelectorAll('.promise').forEach((p, i) => setTimeout(() => p.classList.add('in'), i * 450));
}), {threshold: .2});
document.querySelectorAll('.reveal, #promises').forEach(el => io.observe(el));

/* القلب الأخير */
let beats = 0;
$('#bigHeart').onclick = () => { $('#forever').textContent = fill(CONFIG.forever[Math.min(beats++, CONFIG.forever.length - 1)]); burst(); };

/* كلمة السر */
const dd = $('#dd'), mm = $('#mm');
dd.addEventListener('input', () => {
  const v = dd.value.replace(/\D/g, ''); dd.value = v.slice(0, 2); $('#err').textContent = '';
  if (v.length > 2) mm.value = (v.slice(2) + mm.value).slice(0, 2);
  if (v.length >= 2) mm.focus();
});
mm.addEventListener('input', () => { mm.value = mm.value.replace(/\D/g, '').slice(0, 2); $('#err').textContent = ''; });
mm.addEventListener('keydown', e => { if (e.key === 'Backspace' && !mm.value) dd.focus(); });
[dd, mm].forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') tryUnlock(); }));
const wrong = T.wrong;
let tries = 0;
function tryUnlock(){
  if (+dd.value === CONFIG.day && +mm.value === CONFIG.month) {
    $('#lock').innerHTML = svg('unlock'); $('#lock').classList.add('open');
    try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); actx.resume(); } catch(e) {}
    startMusic();
    setTimeout(() => { $('#intro').classList.add('on'); $('#gate').classList.add('hide'); setTimeout(() => playIntro(0), 1300); }, 800);
  } else {
    const b = $('#dateBox'); b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake');
    $('#err').textContent = wrong[tries++ % wrong.length];
  }
}
$('#unlock').onclick = tryUnlock;

/* المقدمة */
let introDone = false, introT;
function playIntro(i){
  if (introDone) return;
  if (i >= CONFIG.intro.length) return endIntro();
  const el = $('#introLine'); el.textContent = fill(CONFIG.intro[i]); el.classList.add('show');
  introT = setTimeout(() => { el.classList.remove('show'); introT = setTimeout(() => playIntro(i + 1), 1300); }, 2600);
}
function endIntro(){
  if (introDone) return; introDone = true; clearTimeout(introT);
  $('#intro').classList.remove('on'); confetti(150);
  for (let i = 0; i < (LITE ? 5 : 10); i++) setTimeout(() => spawnHeart(true), i * 150);
  heartTimer = setInterval(spawnHeart, EVERY);
  setTimeout(() => typeText($('#typed'), fill(CONFIG.typed), 55), 1100);
}
$('#skip').onclick = endIntro;

/* الفتح بموعد محدد */
const OPEN_AT = CONFIG.openAt ? new Date(CONFIG.openAt) : null;
function lockUntilOpen(){
  if (!OPEN_AT || isNaN(OPEN_AT) || Date.now() >= OPEN_AT) return false;
  const hideEls = ['#dateBox', '#err', '#unlock', '.hint'].map(q => $('#gate ' + q));
  hideEls.forEach(el => el && (el.hidden = true));
  $('#gate > p').textContent = T.waitTitle;
  $('#waitBox').hidden = false;
  try { $('#waitWhen').textContent = OPEN_AT.toLocaleString('ar-EG', {weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit'}); } catch (e) {}
  const box = $('#count');
  box.innerHTML = T.waitUnits.map(u => `<div><b>٠</b><span>${u}</span></div>`).join('');
  const cells = [...box.querySelectorAll('b')];
  const tick = () => {
    const s = Math.max(0, Math.floor((OPEN_AT - Date.now()) / 1000));
    if (!s) { clearInterval(timer); hideEls.forEach(el => el && (el.hidden = false)); $('#waitBox').hidden = true; $('#gate > p').textContent = T.gateSub; confetti(120); dd.focus(); return; }
    [Math.floor(s / 86400), Math.floor(s % 86400 / 3600), Math.floor(s % 3600 / 60), s % 60].forEach((v, i) => cells[i].textContent = arabicNum(String(v).padStart(2, '0')));
  };
  const timer = setInterval(tick, 1000); tick();
  return true;
}
if (!lockUntilOpen()) dd.focus();
