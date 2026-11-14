# الجدار الذي لم يكن جدارًا — فيديو ستيك مان

## التشغيل (مجرب في هذه البيئة)
المتطلبات: Node 22 + Playwright/Chromium، FFmpeg 6، Python 3 + numpy.

```bash
./build.sh v3                              # بدون تعليق صوتي
./build.sh v3 assets/audio/narration.mp3   # مع التعليق (بعد تحديث timing.json)
```
الناتج في `exports/stickman_<version>.mp4` (H.264 + AAC 48kHz، 1080×1920، 30fps).

## الملفات
- `brief.md`, `story-lock.md`, `script-ar.txt`, `storyboard.md`, `character-bible.md`
- `timing.json`: أزمنة الجمل (المرجع الوحيد لتوقيت المشاهد)
- `src/rig.js`: هيكل الشخصية وIK والمشي
- `src/scene.js`: القصة كاملة؛ `render(t)` يرسم أي لحظة من زمنها
- `src/render.js`: إخراج الإطارات عبر Chromium (يستأنف إن توقف)
- `src/audio.py`: موسيقى ومؤثرات أصلية + المكساج
- `assets.csv`: سجل الأصول والتراخيص

## تعديل سريع
- لتغيير ألوان أو أطوال الشخصية: `CH.nader` في `src/rig.js`.
- لمعاينة لقطات ثابتة: `node src/render.js previews/stills 30 --stills 0,5,10`
