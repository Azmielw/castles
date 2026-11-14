# «موشن خام» — Khaam Motion v1.7

مهارة لـ Claude تخليه **مخرج موشن جرافيك** كامل: يكتب الفكرة، ويصمم، ويحرّك، ويضيف الصوت، ويطلّع لك فيديو MP4 جاهز. **عربي أولاً.** مصممة لـ Claude في تطبيق الكمبيوتر (قسم Code)، وما تشتغل في ChatGPT ولا Codex.

من «خام» (@khaam.hq)، إعداد **راشد الحازمي**.

## أول مرة؟
اسحب ملف المهارة لمحادثة Claude في قسم Code، واكتب **«ثبّت المهارة»**. هو يسوي كل شي بنفسه خطوة بخطوة. وتلقى الخطوات مكتوبة في **`START-HERE.md`**، ومصوّرة في «دليل موشن خام.pdf».

## وش تقدر تسوي فيها
- **مجلدك يتجهّز لك:** المهارة تنثبّت داخل المجلد اللي تفتح عليه المحادثة بس، مو على كل الجهاز. وإذا ما اخترت مجلد، يسوي لك «مونتاجي» في سطح المكتب. وفيه «خام» لمقاطعك، و«إلهام» للي يعجبك، و«جاهز» لفيديوهاتك النهائية. ما تسوي أي ملف بيدك.
- **يتذكر كل دردشة:** افتح نفس المجلد وقل «كمّل»، ويكمّل من حيث وقفتوا.
- **يتعلم ذوقك:** من الفيديوهات والصور والروابط اللي تعطيه، ومن كل ملاحظة تقولها. أول فيديو نقطة بداية، واللي بعده يقرّب أكثر.
- **مرة وحدة وكاملة:** توافق على الخطة، وأول فيديو يوصلك فيه الحركة والمؤثرات والصوت مع بعض.
- **الهوك أولاً:** أول ٣ ثواني تنبني على هوك مدروس (يقترح ٣)، والحركة تخدمه.
- **محرك HyperFrames** للحركة والكابشن، وRemotion وقت الـ3D، وكل أداة لشغلتها.
- **نصوص عربية صح:** الحروف ما تتكسر، والاتجاه من اليمين، وخطوط عربية مجربة مع فهرس ورخص (`reference/arabic-typography.md`، `reference/arabic-fonts.md`).
- **ستايلك أنت:** يبني لك ستايل من مراجعك ويحفظه. وفيه 9 أمثلة للإلهام (`styles/`).
- **نظام فيديوهات الشرح:** هيكل السكربت، والكابشن، والانتقالات، وخاتمة «علّق الكلمة» أو «الرابط في البايو» (`reference/explainer-reel-system.md`).
- **حكايات بصوت (جديد في 1.7):** أربع طرق سرد جاهزة: الحكاية القصيرة، و«ورقة وفكرة»، و«السلّم»، و«السلسلة»، بأمثلة من مجالات مختلفة (`reference/story-formats.md`)، وستايل «حكاية بالضوء».
- **الصوت أول:** صوتك أنت (تسجّل، وClaude يطلّع وقت كل كلمة على جهازك، مجانًا)، أو صوت يتصمّم لك في ElevenLabs ويصير لك وحدك. وكل حدث في الفيديو ينربط بكلمة من الكلام: البرق على «تخاف»، والفجر على «الفرج».
- **قطع نص وقصة جاهزة:** جملة تضوي كلمة كلمة وكلماتها المهمة بالذهبي، وبطاقة ثابتة للنص المنقول ومرجعه، وسلّم بـ«؟» فوق، وبطاقتين للمقارنة، وبداية بآخر لقطة ثم رجوع، وخاتمة هادية.
- **مشاهد مرسومة بالكود وشخصيات بلا وجوه:** ليل يصير فجر، مطر وبرق، حارة نجدية، غرفة، بحر، وورقة ترسم نفسها.
- **صوت حقيقي مثل الأفلام:** ٣–٥ تسجيلات حقيقية للأشياء اللي تنشاف (٣٣ تسجيل مجاني CC0 يجون مع المهارة)، وخلفية حقيقية للمكان أو بدون خلفية، وبدون موسيقى إلا إذا طلبت، وفحص للمكس قبل ما تسمعه.
- **مكتبة أصوات مجانية:** 1,409 مؤثر صوتي تنبني على جهازك، وتسجيلات حقيقية من Openverse. الصوت كامل من أول فيديو بدونها، والمكتبة إضافة.
- **صوت معلّق بالذكاء الاصطناعي** من ElevenLabs (تصميم الصوت ثم Eleven v4)، متزامن مع الحركة والكابشن. اختياري، ويكلف ٦$ بالشهر في Starter (أول شهر ١$)، والمفتاح يدخل بملف صغير، ما يمر بالمحادثة أبدًا.
- **النشر:** الغلاف من إطار الهوك مع فحص بحجم شبكة البروفايل، وكابشن جاهز فيه سطر المصادر لما يكون في الفيديو نص منقول.
- **«بلّغ عن مشكلة»:** تقرير قصير ترسله لنا، عشان نحسّن النسخة الجاية.

## وش تحتاج
| الشي | ضروري؟ | ملاحظة |
|---|---|---|
| كمبيوتر أو لابتوب (ويندوز أو ماك) | ✅ | الجوال والمتصفح ما يكفون |
| تطبيق Claude للكمبيوتر + اشتراك Pro أو أعلى | ✅ | Pro بـ٢٠$ بالشهر. المجاني ما فيه قسم Code |
| Python (مع NumPy وSciPy) وNode 22+ وFFmpeg | ✅ | Claude يتأكد منها ويثبّت الناقص بعد ما تأذن له |
| حساب ElevenLabs | اختياري | لتصميم صوت لك والصوت المعلّق والمؤثرات المولّدة. صوتك المسجّل ما يحتاجه |

## الملفات
| الملف | وش فيه |
|---|---|
| `START-HERE.md` | ابدأ هنا: التثبيت والتشغيل الأول |
| `SKILL.md` | تعليمات Claude الرئيسية |
| `reference/` | الأدلة: المجلد والذاكرة، وHyperFrames، والعربي، والخطوط، والتصميم، والصوت، والتسليم |
| `styles/` | بناء ستايلك، وأمثلة للإلهام |
| `scripts/` | أدوات: الفحص، والتثبيت في مجلدك، والمفتاح، والبلاغ، والخطوط، والأصوات، والمعاينة |
| `templates/` | قالب HyperFrames العربي وقطع النص والقصة وطقم المشاهد، وقالب الرندر، وملفات الذاكرة، وملف الذوق، وخطة الحكاية، وقالب الكابشن |
| `CHANGELOG.md` | الإصدارات |
| `LICENSE.md` | الرخصة: مجانية للاستعمال، وممنوع إعادة النشر |

---
## English
**Khaam Motion v1.7** by Khaam (@khaam.hq), edited by Rashed Alhazmi. A Claude skill for the Claude desktop app's Code tab that directs, designs, animates and sound-designs Arabic-first motion graphics and narrated stories, and renders MP4 locally.

What's in it:
- **Workspace.** Claude installs the skill into the user's own folder, never globally (a «مونتاجي» folder on the Desktop when the chat has no folder of its own), and builds خام / إلهام / جاهز there, so the user never makes or moves files by hand.
- **Memory.** A session handoff the workspace loads in every chat lets work pick up across chats («كمّل»).
- **Taste.** It is learned from references, with an honest first-time line.
- **Engines by job.** HyperFrames is the default engine (a pinned Arabic starter); Remotion is used on demand for 3D. FFmpeg, yt-dlp for references, and ElevenLabs complete the toolset.
- **Narration first (1.7).** The user's own recording is turned into word timings on their computer, or a voice is designed for them with ElevenLabs Voice Design; library voices only when the user names one. Scene events are placed by naming the spoken word.
- **Stories (1.7).** Four ways of telling, a word-lit text block, a still card for verified quoted text, a ladder with «؟», comparison cards, a rewind cold open, an end card, the «حكاية بالضوء» style, and a code-drawn scene and faceless figure kit.
- **Sound.** A film-style mix by default (since 1.7.0's sound v2: real recordings of what is shown, 3–5 of them, a real bed of the place or none, no music unless asked, a mix check that also fails static and buzz); 33 CC0 recordings ship in `sounds/library/`, and a free 1,409-sound library is built locally.
- **Pace.** The pace and motion standard P1–P13 (`reference/pace.md`) for planning every video, and `scripts/check_pace.py`, which measures the draft against it.
- **Publishing (1.7).** The cover from the hook frame, a caption template with a sources block.
- **Keys.** The ElevenLabs key is set up through a file opened in Notepad/TextEdit, never through the chat.
- **Reports.** A «report a problem» command.

Requires a paid Claude plan (Pro or higher). Start with `START-HERE.md`.
