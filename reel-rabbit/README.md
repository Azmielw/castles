# اختار أرنبك — ريل ستيك مان (نصيحة التركيز على هدف واحد)

الفكرة مبنية على المثل الشائع «اللي يجري ورا أرنبين ميمسكش ولا واحد»، والقصة والرسوم والحركة والموسيقى أصلية.

## التشغيل (مجرب هنا: Node 22 + Playwright/Chromium، FFmpeg 6، Python 3 + numpy)
```bash
./build.sh v3                              # بدون تعليق صوتي
./build.sh v3 assets/audio/narration.mp3   # مع التعليق بعد تحديث timing.json بأزمنة الصوت
./sheet.sh name 8x3 0.5,3,10               # ورقة لقطات للمراجعة
```
الناتج: `exports/reel_<version>.mp4` (1080×1920، 30fps، H.264 + AAC 48kHz).

## الملفات
- `script-ar.txt` النص (مصري) · `timing.json` أزمنة الجمل (تقديرية حتى يُسجَّل الصوت)
- `src/rig.js` هيكل الشخصية · `src/world.js` الخلفية والأرانب والواجهة والنصوص · `src/story.js` المشاهد
- `src/render.js` إخراج الإطارات · `src/audio.py` الموسيقى والمؤثرات والمكساج
