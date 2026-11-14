---
name: motion-fable
description: برومبت «موشن فايبل 5.2» من إعداد عبدالله الفارس — يبني فيديو موشن جرافيك احترافي عرضي 1920×1080 على صوت المستخدم، كله بالكود (Canvas/WebGL/three.js)، بحركة كاميرا واحدة متصلة بلا قطع، ويصدّره MP4. استخدمها عند طلب showreel أو فيديو موشن على تعليق صوتي، أو «موشن فايبل». Motion-graphics showreel cut to a voiceover, one continuous camera shot.
---

# موشن فايبل 5.2

برومبت أصلي من إعداد **عبدالله الفارس** (IG @i_abdullah_11 · TikTok @i_abodx1). النسخة الأصلية PDF في `reference/`. احتفظ بسطر النسب كما طلب المؤلف.

## قبل البدء (من ملاحظات المؤلف)
- الرندر ثقيل: يستهلك وقتًا طويلًا وجزءًا كبيرًا من الاستخدام. **جرّبه أولًا على صوت قصير (نحو 10 ثوانٍ)**، وتأكد أن كل شيء يعمل، ثم شغّل المقطع الكامل. النتيجة تحتاج غالبًا جولة أو جولتين تعديل.
- اطلب من المستخدم المدخلات الناقصة قبل التنفيذ (voice.wav و voice.srt و photo.jpg على الأقل)، واعمل بالمتاح وتخطَّ الاختياري.
- ملاحظات تشغيل (ليست جزءًا من البرومبت): في بيئة سحابية بلا GPU حقيقي يعمل Chromium برسم برمجي، فالرندر أبطأ؛ صرّح بذلك. لا تنزّل حزمًا أو أصولًا خارجية (الخطوط، حزمة المؤثرات) قبل التحقق من مصدرها وترخيصها وإبلاغ المستخدم.

## البرومبت (كما هو)

```
# Original prompt by Abdullah Alfaris (@i_abdullah_11) — please keep this credit line.

You are a world-class motion designer. Build a 16:9 (1920×1080, 30fps) motion-graphics
showreel cut to MY VOICE, made entirely from code, as ONE continuous camera shot — no
hard cuts.

INPUTS (in this folder)
- voice.wav — my voiceover (the master clock)
- voice.srt — my script with exact timings (do not re-transcribe)
- photo.jpg — my portrait (end card)
- clips/ — slow-motion clips (jump, dancer, water splash)
- images/ — 2–3 photos
- logos/ — PNG logos of any brands I mention (optional)
- fonts/ — Thmanyah Serif Display (Arabic), JetBrains Mono (labels)

REQUIREMENTS
- Node.js and FFmpeg installed (check first; if missing, tell me how to install them
  and stop).
- Install with npm: playwright (Chromium), three. Fonts if missing: Thmanyah from
  github.com/engdawood/thmanyah-font-web, JetBrains Mono from @fontsource/jetbrains-mono.
- SFX: free CC0 pack github.com/wyzowl/sfx-kit (use its sync points).

LOOK
- Dark base #11121F. Accents: #42426F, #6D5BA6, #A99BD6, coral #F08A8A, peach #FFD6C9.
- Photos and footage keep their REAL colours (no grading).
- Arabic RTL, key words only (no full captions). Never split Arabic letters.
- Small mono "pro tool" labels: 01/02/03 indexes, "CAM 01 · focal 1880 · tilt 58°",
  frame counter, REC dot.
- Subtle film grain and vignette.

SCENES (pin each to its SRT line)
Use this scene order as the template. If a scene does not match my script (no version
number, no date, no brands), keep its technique and adapt its content to my own words.
Skip optional inputs I did not provide.
1. HOOK — halftone macro eye made of dots opens on the first word; REC brackets lock on
   the iris; a key word appears and gets struck through.
2. Whip-zoom into the pupil → a prompt card types a command, cursor clicks "Generate",
   the panel reveals a generative liquid texture; a key word slams in with motion blur.
3. Push into that texture → dot-matrix counter scrambles and locks on the version
   number with the voice; the product name builds in 4 stages: dots → 3D extrude →
   outline rings → clean.
4. Pull back: that frame becomes a card in a tilted 3D grid (frames from this reel +
   clips playing inside). Glide over the floor, fly between floating cards with depth of
   field, cards snap into a neat grid, dive into the next card.
5. Three giant words (image / video / audio) filled with real media: a photo, a slow-
   motion jump, a slow-motion dancer; voice-reactive waveform under the last.
6. BRANDS — extruded 3D logos (three.js, glossy, rim light): the first spins in, a
   cursor grabs it and drags it off with a wobble; the second pops in, the camera flies
   through it until its colour fills the frame, a key word slams on top.
7. DATE — cinematic 3D desk calendar (three.js, spotlight, soft shadows, depth of
   field): pages flip, the last one in slow motion from a low angle, revealing the date on
   the exact word; a circle is drawn on it; a metal lock drops in slow motion with dust
   and camera shake.
8. CTA — headline, a comment field types the keyword and sends, a DM notification
   arrives with my photo; the camera flies into my photo, which shrinks into the end-card
   mark above my name and handles.

TRANSITIONS
Every scene change is a camera move: zoom into a point, push through, whip-pan with
motion blur, or a card that becomes the next frame. Never a cut or crossfade.

BUILD
- Serve the folder with a local HTTP server (ES modules), render on the real GPU.
- One HTML page; every frame computed from time inside seek(t) (no timers, no CSS
  transitions). Canvas 2D + WebGL shaders + three.js for 3D + CSS 3D for the card grid.
- Render frame by frame with Playwright → FFmpeg H.264 MP4.
- Audio: voice at -14 LUFS + free CC0 SFX synced to the cues (whooshes on moves, hits
  on slams, clicks, typing, lock thud).

START
Read voice.srt, show me the scene-timing table, then stills at key moments before the
final render.
```

© 2026 · الحقوق محفوظة لـ عبدالله الفارس · اذكر المصدر
