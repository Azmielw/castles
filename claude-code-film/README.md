# Claude Code Film — فيديو موشن جرافيك سينمائي

فيديو تعليمي إعلاني مدته **75 ثانية** (1920×1080 — 30fps — 16:9) يشرح إزاي تصنع فيديوهات أنيميشن وموشن جرافيك باستخدام **Claude Code** و **Remotion**. كل الحركة مكتوبة بالكود (React + TypeScript) ومحسوبة بالفريمات — مفيش ولا صورة ثابتة.

## الملفات النهائية (`out/`)

| الملف | الوصف |
| --- | --- |
| `out/claude-code-film.mp4` | الفيديو النهائي (H.264 + AAC) بالتعليق والموسيقى والمؤثرات والكابشن |
| `out/voiceover.mp3` | التعليق الصوتي منفصل (بدون موسيقى أو مؤثرات) |
| `out/captions.srt` | ملف الكابشن العربي، متزامن مع التعليق |

## التشغيل

```bash
npm install
npm run dev          # Remotion Studio — معاينة تفاعلية على http://localhost:3000
npm run render       # تصدير MP4 بجودة 1080p إلى out/claude-code-film.mp4
npm run render:4k    # تصدير 4K (3840×2160) — نفس المشروع بمقياس ×2
npm run render:clean # نسخة بدون كابشن محروق (استخدم معها ملف الـ SRT)
```

> المشاهد الثلاثية الأبعاد (Three.js) بتترندر بـ WebGL برمجي (`swangle`) عشان تشتغل على أي جهاز حتى من غير كارت شاشة. لو عندك GPU امسح سطر `setChromiumOpenGlRenderer` من `remotion.config.ts` والرندر هيبقى أسرع.
>
> لو الجهاز مش مسموح له ينزّل Chrome Headless Shell، حدّد متصفح موجود: `REMOTION_BROWSER=/path/to/chrome-headless-shell npm run render`.

## هيكل المشروع

```
src/
  Root.tsx                 تسجيل الـ Compositions (Main و MainClean)
  Main.tsx                 ترتيب المشاهد + الانتقالات + الصوت + الكابشن
  config/
    theme.ts               🎨 الألوان والخطوط
    timeline.ts            ⏱️ بداية ونهاية كل مشهد بالثواني
    copy.ts                ✍️ كل النصوص الظاهرة على الشاشة
    script.json            🎙️ نص التعليق + توقيت كل مقطع + الكلمات الملوّنة في الكابشن
    sfx.ts                 🔊 جدول المؤثرات الصوتية (الثانية، الملف، المستوى)
  scenes/
    Scene01Hook.tsx        نقطة الضوء ← شبكة 3D ← الشاشة ← العنوان
    Scene02Claude.tsx      اسم CLAUDE CODE ثلاثي الأبعاد، الكلمات ← كود ← أشكال
    Scene03Workflow.tsx    المراحل السبعة في فضاء 3D بكاميرا متحركة
    Scene04Magic.tsx       7 لقطات موشن (المحتوى في scenes/magic/)
    Scene05Technology.tsx  Remotion: كود ← تايم لاين ← معاينة ← MP4
    Scene06Montage.tsx     مونتاج سريع على إيقاع الموسيقى + العبارة الختامية
    Scene07Outro.tsx       الخاتمة
  components/              الكابشن، الجزيئات، الانتقالات، التايبوجرافي
  audio/AudioTracks.tsx    مكس الصوت (التعليق / الموسيقى / المؤثرات) + الـ ducking
  data/                    توقيت الكلمات (ناتج عن التسجيل) والكابشن المولّد
scripts/
  build-captions.mjs       يبني الكابشن + ملف SRT من توقيت الكلمات
  generate-audio.mjs       يولّد الموسيقى والمؤثرات برمجيًا (بدون أي ملفات خارجية)
public/
  audio/voiceover.mp3      التعليق الصوتي
  audio/music.mp3          الموسيقى التصويرية (120 BPM)
  audio/sfx/*.wav          المؤثرات: whoosh, click, impact, riser, shimmer…
  fonts/                   الخطوط (Alexandria, IBM Plex Sans Arabic, Space Grotesk, JetBrains Mono)
```

## التعديل

| عايز تغيّر | عدّل |
| --- | --- |
| الألوان / الخطوط | `src/config/theme.ts` |
| نص على الشاشة | `src/config/copy.ts` |
| طول أو ترتيب مشهد | `src/config/timeline.ts` (والانتقالات في `PLAN` داخل `src/Main.tsx`) |
| توقيت دخول مقطع صوتي | `placeAt` في `src/config/script.json` ثم `npm run captions` |
| الكلمات الملوّنة في الكابشن | `highlight` في `src/config/script.json` ثم `npm run captions` |
| مستوى الموسيقى تحت الصوت | `MIX` في `src/audio/AudioTracks.tsx` |
| مؤثر صوتي | `src/config/sfx.ts` |
| الموسيقى نفسها | `scripts/generate-audio.mjs` ثم `npm run audio` |

كل الحركات مبنية على `useCurrentFrame()` و `interpolate()` — مفيش CSS animations — فالرندر مطابق للمعاينة فريم بفريم.

### تغيير التعليق الصوتي

1. حط التسجيل الجديد في `public/audio/voiceover.mp3`.
2. حط توقيت الكلمات في `src/data/voiceover-words.raw.json` بالشكل `{"words":[{"text":"…","type":"word","start":0.0,"end":0.4}, …]}` (أي أداة تفريغ صوتي بتطلع word timestamps تنفع).
3. عدّل النص في `src/config/script.json` لو اتغيّر (عدد الكلمات لازم يطابق التسجيل)، وبعدين `npm run captions`.

## الصوت — مصادره بصراحة

- **التعليق الصوتي:** مولّد بـ ElevenLabs (موديل `eleven_v4`، صوت مصري اسمه «Tamer»). توقيت كل كلمة مأخوذ من تفريغ نفس التسجيل، وده اللي بيحرّك الكابشن.
- **الموسيقى والمؤثرات:** مش تسجيلات ولا ملفات جاهزة — متولّدة برمجيًا (synthesis) بالسكربت `scripts/generate-audio.mjs`، وبالتالي مفيش أي حقوق لطرف تالت. لو عايز موسيقى من مكتبة مرخّصة، بدّل `public/audio/music.mp3` (المونتاج في المشهد السادس مقطّع على 120 BPM).

## ملاحظات

- Remotion مجاني للأفراد والفرق الصغيرة، والشركات الأكبر محتاجة رخصة: https://www.remotion.dev/docs/license
- الفيديو مستقل وغير رسمي؛ الشعار المستخدم شكل تجريدي وليس شعار Anthropic الرسمي.
