<!-- Khaam Motion · reference file, loaded on demand from SKILL.md. Read it for any narrated story, reflection or "told" video. -->
# Ways of telling (طرق السرد)

A way of telling is **how the story moves**, not how it looks: it works with the user's own style or any example in `styles/`. These formats come from studying narrated short videos that hold attention for 30–100 s (Khaam's 2026-11-11 studies). Only the idea and the structure were taken; every script here is in our own words.

All of them are **narration first**: the voice is recorded or generated before anything moves, and every text state and picture event is placed on a spoken word (`scripts/cues.py`). Read `reference/voiceover.md` §10.0 for the voice.

**Every told video moves through places** (P9): a new place or a new framing every sentence or two, a visible camera move in each, and the change carried by a cut, a whip or a fade. Build them with `Khaam.places(tl, host)` (`reference/scene-kit.md` § The camera: `place`, `show`, `cut`, `whip`, `fade`); the pace numbers are in `reference/pace.md`.

## 0. Choose one
| Way of telling | Use it when | Length | Main devices |
|---|---|---|---|
| **الحكاية القصيرة** (the short story) | a reflection or a short lesson that turns a state into relief: worry → hope, mess → order | 25–40 s | word-lit block, one light event per sentence, end card |
| **ورقة وفكرة** (one idea on paper) | one idea explained phrase by phrase, each phrase a small drawing; works with no voice too | 20–40 s | paper world, word-lit block with one key word, line drawings, faceless ink figures |
| **السلّم** (the ladder) | 3–5 steps that each go one step further, and the top step is the surprise | 30–90 s | ladder with «؟», comparison cards, cold open with a rewind |
| **السلسلة** (the chain) | a story where each fix opens the next problem, and the end is the lesson or the offer | 30–60 s | one set that grows, first person or a narrator, comparison cards for before/after |

Ask one line when it is not obvious: «تبيها حكاية قصيرة، ولا سلّم بخطوات، ولا قصة تتسلسل؟». Record the choice in `TASTE.md` and `PROGRESS.md`.

## 1. The short story (الحكاية القصيرة) — the base template
Six beats. Times are for a 30 s video; stretch or shrink them together.

| From | Beat | What the words do | What the picture does |
|---|---|---|---|
| 0 s | **الحال** (the state) | one line about the viewer's state, not a fact («إذا…»، «اللي تخافه…») | a tight place, night or rain: the state drawn |
| 3–5 s | **الوعد** (the promise) | the second half of the line turns the state | one light event on the key word (it opens, it lights) |
| 6–15 s | **السند** (the support) | an example, an experience, a picture from life, or a quoted text the user verified | a new scene per sentence; the weather grows on the word of difficulty |
| 15–22 s | **المنعطف** (the turn) | the question or the one word everything turns on | the darkest picture (a dive, night, rain); the light grows with the sentence |
| 22–27 s | **الفرج** (the relief) | one short line that closes the promise | dawn, sun or something growing; the figure lifts its head; this line alone on screen |
| last 2–3 s | **الختام** (the close) | the page's line (follow / send it to someone) | the end card (`end-card.html`) |

**Pace (measured on the references):** 1.9–2.2 words a second; one pause longer than 0.6 s, just before the relief; a new scene every 5–6 s (a new framing in between); almost no hard cuts (dips to black, crossfades, whips or a camera move that carries the meaning); one word alone on screen once, at the relief. The full standard: `reference/pace.md`.

**Worked example — a reflection (our words):**
«المطر اللي تخافه… هو اللي يسقي أرضك. البذرة ما تطلع في يوم صاحي… تطلع بعد ليلة مطر. نخاف لأننا نشوف الغيم… وما نشوف اللي تحت التراب. اصبر على مطرك.»
Lightning on «تخافه», clouds part on «يسقي», the camera dives under the soil on «البذرة», roots spread on «التراب», dawn on «اصبر».

**Worked example — a small shop (our words):**
«أول شهر… ما باع المحل إلا عشرين كوب. كل يوم كنت أقول: يمكن الفكرة غلط. بس اللي اشترى… رجع. وجاب معه واحد. الشهر الثالث، الطابور وصل الباب. الزبون الأول ما كان رقم… كان بداية.»
Night street on the first line, a lit window grows brighter on «رجع», a second figure joins on «وجاب معه», the queue fills the frame on «الطابور», the end card says the shop's name.

## 2. «ورقة وفكرة» — one idea on paper
| From | Beat | Words | Picture |
|---|---|---|---|
| 0 s | **السؤال** | a riddle or a question in one line («وش الشي اللي يزيد كل ما أعطيته؟») | an empty page, one line starts drawing itself |
| 3 s | **الفكرة** | the answer in a few words | the key word drawn as an object |
| 6–25 s | **ثلاث جمل** | three short phrases that explain it, one picture each | each phrase draws one object or a faceless ink figure **big** (a third of the frame or more) while the camera pushes in on it or moves to it; every phrase or two a big change: a page turn, a new sheet or a tinted section, a pull-back to the whole page (`pace.md` P4–P5: small drawings filling one still page are no picture change) |
| 25–30 s | **الخلاصة** | the idea again, now obvious | the whole page seen at once, one accent colour on the key drawing |
| last 2 s | **الختام** | save / send it | end card on paper |

- **Text:** the word-lit block (`word-lit.html`): the current phrase dark, the rest faded, one key word in the accent colour. Readable with the sound off.
- **Voice:** a designed voice, the user's own voice, or no voice when the words carry everything. With no voice, `python "<skill>/scripts/cues.py" read --script <text> --out assets/vo/reading.words.json` times the words at the reading pace (a line starting `@6.75` starts there), and word-lit and `cues.py build` use it as they would a voice.
- **The picture:** the paper world of the scene kit (`reference/scene-kit.md` § The paper world): `S.paper({kind: "ruled"})` on the `paper` palette, a drawing that builds with `S.sketch(...)`, people as line drawings with `S.figure({style: "ink"})`, one accent colour, most of the page empty around the drawing being made. Example: `kit/examples/paper-seed.html`.
- **Text over the page:** the word-lit block keeps its own band at the top; the drawings live under it and never rest half under it (`explainer-reel-system.md` §2, the hero zone). On light paper set word-lit's `shadow: "none"` and `keyGlow: "none"`.
- **Sound:** no bed (a page has no sound of its own: `"bed": []`) and 3–5 real paper or pen recordings from `sounds/library/` in the pauses (`reference/film-sound.md`); no music. (Before 1.7.0 of 11-12 this line asked for a code-made `paper` bed: sound v2 forbids it.)

**Worked example — learning (our words):**
«وش الشي اللي يزيد كل ما عطيته؟ المعلومة. تشرحها لغيرك… تنتبه للي ما فهمته. يسألك سؤال… تدوّر جوابه. تعيدها بكلامك… تثبت عندك. اللي يعلّم، يتعلّم مرتين.»
Drawings: a question mark → a small lamp → two figures facing → a question bubble → a page with a tick → two lamps.

**For reflection content:** the same shape fits a short reminder in the user's words, labelled «خاطرة» so no one mistakes it for a quoted text (word-lit's `LABEL`: `label: true` on the sentences that need it, or `keep: true` for one label through the whole video).

## 3. «السلّم» — the ladder
A ladder of 3–5 steps is shown from the start, with «؟» on the top step. Each step lights when the narration reaches it; the viewer always knows where they are and that a reveal is coming.

| From (60 s version) | Beat | Words | Picture and devices |
|---|---|---|---|
| 0–2.5 s | **cold open** (optional) | the last line of the video, first | the last picture, then the rewind (`rewind.html`) and the story starts |
| 2.5–5 s | **the promise** | «فيه خمس درجات… وآخرها ما يتوقعها أحد» | the ladder slides in (`ladder.html`), «؟» on top |
| 5–35 s | **the steps** | one step per sentence or two, each a little stronger | each step: a new scene + its step lights; a comparison card (`compare.html`) between it and the step before |
| ≈ 60% | **the rehook** | «طيب، وش الفرق بين … و…؟» | the two cards again |
| ≈ 70% | **the turn** | the hidden step is named | «؟» gives way to the word (one soft whoosh, the only one) |
| 70–90% | **two examples** | one that does not bring it out, one that does | two short scenes |
| last 10% | **resolution + close** | one line, then the page's line | back to the first picture; end card |

- **On paper, one big section per step; the ladder stays small in the margin as the progress.** Each section is a big drawing (~700 px) that slides in from the left as the one before slides out to the right, with a slow push of its own; at the end the margin ladder can grow into the whole ladder, every step named: `compositions/ladder-paper.html` (the frosted `ladder.html` is for drawn scenes and dark grounds).
- **Short version (30–40 s):** 3 steps + «؟», no cold open, one comparison card.
- **Variant «الإسقاط» (elimination):** show the whole set as objects (doors, lamps, pillars); remove one per beat with its reason until one is left: that one is the message. Same ladder panel, steps dim out instead of lighting.
- **Needs:** the steps must be a real pattern the viewer can predict, and the top step must surprise. Each step that quotes a source shows it (a verified card, or a source line).

**Worked example — a skill (our words), the ladder's default in `ladder.html`:**
«أي مهارة تمر بأربع درجات. تحاول… وتطيح. تتعلّم… وتفهم ليش طحت. تتقن… وتسويها بدون تفكير. والدرجة الرابعة؟ أغلب الناس يوقفون قبلها. تعلّم غيرك. لأنك وقتها تكتشف وش اللي ما كنت تعرفه.»
Steps: «يحاول» → «يتعلّم» → «يتقن» → «؟» = «يعلّم». Cards: «يعرف / يطبّق» on the third step.

**For reflection content:** steps can be stages of a habit in the user's own words; a step that quotes an ayah or a hadith shows it on the still card (§6), never inside the ladder.

## 4. «السلسلة» — the chain
| From (45 s) | Beat | Words | Picture |
|---|---|---|---|
| 0 s | **the problem** | first person or a narrator, mid-action | the set, small and empty |
| 4 s | **fix 1** | «فسويت…» | the set gains one thing |
| 8 s | **new problem** | «بس…» | the new thing causes the next problem (shown, not told) |
| 12–35 s | **fix → problem**, 2–3 more links | each link 5–8 s, each one a small cliffhanger | the same set keeps growing |
| 35–42 s | **the end of the chain** | the lesson or the offer | the full set, lit |
| last 2–3 s | **close** | keyword or follow line | end card (`KEYWORD` when there is an offer) |

- **One set that grows** beats many cuts: the viewer watches one place change.
- **Before/after:** a comparison card at the end can show the first and last state.
- **For religion:** only a true, sourced story; a story about the unseen or a named person needs a source like a hadith does.

**Worked example — a store (our words):**
«فتحت عربة قهوة في الحارة… وما أحد وقف. حطيت لوحة كبيرة… وقفوا، بس ما اشتروا. نزّلت السعر… اشتروا مرة، وما رجعوا. سألت واحد منهم ليش. قال: القهوة طيبة، بس الانتظار طويل. جهّزت الأكواب قبل الزحمة… وصار الطابور يمشي. اللي ينقصك أحيانًا مو المنتج… هو الدقيقة اللي ينتظرها الزبون.»
The cart alone → a sign → people stop → a price tag → a clock over a queue → cups lined up → a moving queue.

## 5. Building any of them in the gift
1. **Voice first** (`reference/voiceover.md` §10.0): the user's recording → `scripts/align_voice.py`; or his own voice made from his recording → `gen_tts_elevenlabs.py clone` → `generate`; or a designed voice → `gen_tts_elevenlabs.py design` → `save` → `generate`. Each gives `.words.json`.
2. **Cues:** `python "<skill>/scripts/cues.py" build --words "assets/vo/<take>.words.json" --offset <where the take starts> --cues plan/cues.json --out timing.js`. Name picture events by their words in `plan/cues.json` (`{"lightning": "تخافه", "dawn": "يسقي+0.1"}`); `cues.py check` stops on a word that is not in the narration.
3. **Blocks** (`templates/hyperframes/compositions/`): `word-lit.html` for spoken lines, `verified-card.html` for any quoted text, `ladder.html` (or `ladder-paper.html` on paper), `compare.html`, `rewind.html`, `end-card.html`. Scenes and people from the kit (`reference/scene-kit.md`, `reference/figure-kit.md`), told in places (`Khaam.places`), the camera moving in every one.
   - **The end card is optional:** a question over the last picture also closes a told video (word-lit's last sentence then stays to the end, with a small `~` line for the call to action), when that picture is the point.
4. **Sound:** `reference/film-sound.md` (a bed first, 3–5 effects of the picture's material, no music by default).
5. **Plan sheet:** fill `templates/story-plan.md` in the Gate A message.
6. **Publish:** the cover is the hook frame (`scripts/cover.py`); the caption from `templates/caption.md`, with its sources block when the video quotes anything.

## 6. Care (every way of telling, and always for religious content)
- **Quoted text** (an ayah, a hadith, a saying with a name on it, a law, a study) comes from the user, copied from a source they checked, with its reference. Claude never writes it from memory. It sits on the still card, whole, never word by word, never highlighted, with no music and no effect around it.
- **Our own words are labelled as ours** («خاطرة»، «تأمّل لا تفسير») when they sit next to religious meaning.
- **No face** on any figure. **No prophet and no companion is ever drawn**, not even as a shape, a shadow or a light standing in for one; tell that part with the place and the light.
- **A borrowed voice** (a sheikh's talk, a reciter, any speaker) is used only as a real recording the user has the right to use: as recorded, named in the video or its caption, the source written in the project's LOG; the user answers for the right (`reference/voiceover.md` §10.0). Otherwise: the user's own voice (recorded, or made from his recording), or a designed voice.
- **No music** under religious content; a real bed of the place with sparse events (night crickets, dawn birds), or no bed (sound v2: `reference/film-sound.md` rule 3; a code-made air, rain, paper or room bed was heard as «تشويش»).
- **Claims must be true:** a number, a date or a "study says" in the script is checked on a real source before the voice is made.
