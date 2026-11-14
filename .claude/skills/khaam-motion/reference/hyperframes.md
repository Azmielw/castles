<!-- Khaam Motion · reference file, loaded on demand from SKILL.md -->
# HyperFrames: the default motion engine for new videos (since 1.6)

[HyperFrames](https://github.com/heygen-com/hyperframes) by HeyGen (Apache-2.0, no per-render fees or commercial limits):
- Scenes are HTML, CSS and GSAP that Claude writes.
- Its CLI renders them to MP4 in a headless Chrome, frame by frame, the same way every time.
- Chrome shapes Arabic correctly once the rules below are followed.

## When to use which engine
| Job | Engine |
|---|---|
| Kinetic type, captions, explainers, lists, title cards, overlays on a clip, most new videos | **HyperFrames** (this guide) |
| A project made before 1.6, the explainer kit in `templates/render/lib/kit.js`, or a machine where Node 22+ or HyperFrames won't run | the canvas renderer (`templates/render/`, `planning-and-tracking.md`) |
| Real 3D (Three.js), a data-driven or templated series, many variants in one batch | Remotion, only when the job needs it (`reference/remotion.md`) |
| Cutting, joining, mixing, loudness, encoding | FFmpeg (all engines) |

## Setup
- **Needs Node 22 or newer.** Preflight reports it under `hyperframes.node_ok`. When it's false, offer to update Node, or use the canvas renderer.
- **Nothing is installed ahead of time.** Every command runs through `npx --yes hyperframes@0.8.225 …`:
  - **Pinned version:** that is the version we tested with Arabic. Don't float to `latest`, because the framework changes often before 1.0.
  - **First use:** the first render downloads the CLI and its own Chrome (about 150 MB, once).
  - **Telemetry:** 0.8.225 never asks. On its first command it prints once that it collects anonymous usage data (no file paths or video content) and goes on collecting. Tell the user once, in one line, before the first video: as one line of the Gate A plan, off by default («أداة الرسم ترسل بيانات استخدام مجهولة، بدون ملفاتك: بوقفها لك إلا إذا تبيها»), so it never adds a question to a flow that limits them (a course card asks three at most). Unless they keep it, run `npx --yes hyperframes@0.8.225 telemetry disable` (setting `HYPERFRAMES_NO_TELEMETRY=1` also works). Record the answer in `onboarding.json` as `hyperframes_telemetry` (on|off) and never ask again.
  - **Never `publish`:** it uploads to HeyGen's hosting, so it needs the user's explicit OK.

## Start a video
1. Make the video folder with `workspace.py --new-video "<العنوان>" --slug <words>`, then copy `<skill>/templates/hyperframes/` into it with Python (`shutil.copytree(src, dst, dirs_exist_ok=True)`), not PowerShell's `Copy-Item -Recurse …\*`, which can flatten every file into one folder.
2. **Fonts:**
   - Run `python "<skill>/scripts/get_fonts.py" "Kufam"` (or the style's font).
   - Copy the file to `assets/fonts/display.ttf` with Python's `shutil.copy`. Never use PowerShell wildcards: names like `Kufam[wght].ttf` break them.
   - The compositions use two family names: `Display` (`display.ttf`) and `Second` (`text.ttf`, for a second-language line and the handle). **Always make both files.** With Arabic alone, copy the same Arabic font to `text.ttf` too, so no block asks for a missing file (`check` fails with «404 loading assets/fonts/text.ttf»); when a second language is used, put its font there instead.
3. **Look:** set `--bg`, `--ink` and `--accent` in `index.html` from TASTE.md. Write the hook line in `compositions/title.html` (`LINE`).
4. **Timing (narration first):** turn the narration's `.words.json` (from `gen_tts_elevenlabs.py` or, for the user's own recording, `align_voice.py`) into `timing.js` in the video folder:
   ```
   python "<skill>/scripts/cues.py" build --words "assets/vo/<take>.words.json" --offset <seconds where the take starts> --cues plan/cues.json --out timing.js
   ```
   - Several takes: repeat `--words … --offset …` in order.
   - `plan/cues.json` names picture events by their spoken word: `{"lightning": "تخافه", "dawn": "يسقي+0.1", "roots": "التراب:end"}`. A word that is not in the narration stops the build with the closest words it heard.
   - `index.html` loads `timing.js` after GSAP; every composition can then call `cue("<word>")` or `cue("<name>")` instead of typing seconds, and read `KHAAM_WORDS`. `cues.py words` lists every word with its time.
   - The starter's `timing.js` holds sample words so the starter renders as it is; replace it on every video.
   - A name takes endings like a word: `cue("dawn:end")`, `cue("box+0.2")`.
   - A word said twice: `cue("<word>")` is always its first time, with no warning; the second is `cue("<word>#2")` (`cues.py words` lists every time each word is said).
   - No voice: `python "<skill>/scripts/cues.py" build --beats plan/beats.json --out timing.js`, with `plan/beats.json` like `{"duration": 16.8, "cues": {"box": 0.9, "lid": "box+0.2", "bow": {"at": 8.6, "end": 9.4}}}`; set the root's `data-duration` to that duration. For a word-lit line with no voice, `cues.py read --script <text> --out assets/vo/reading.words.json` times the words at the reading pace first.
5. **Captions:**
   - `compositions/captions.html` takes its words from `timing.js` (`KHAAM_WORDS`); with no `timing.js` it falls back to the `WORDS` written in it.
   - Groups break at pauses of 150 ms or more, with at most 4 words.
   - Captions show no harakat that were added for the voice, and no trailing «، .».
6. **Text and story blocks** (in `compositions/`, each one registered as a track in `index.html` when the video uses it; every one is edited only in its marked block at the top of its script):
   | Block | What it is | Rules |
   |---|---|---|
   | `word-lit.html` | the whole sentence dim, each word lights as it is spoken, 1–3 key words in the accent colour | Arabic alone by default, a second language optional; no harakat on screen (`harakat: "none"`, the default since 1.7.0 of 11-12) and the script's «، . : ؛ !» never reach it (`punctuation: "drop"`; «…» and «؟» stay); `plate: 0.5` over a moving or bright scene; the sentences are matched to the spoken words in order; never for an ayah or a hadith |
   | `verified-card.html` | a quoted text and its reference line, whole and still | the text and the reference come from the user, never from memory; never animated word by word; its span goes into `"scripture"` in `plan/sound.json`; a translation needs its credit; for a fully vowelled text set `CARD_FONT` to `assets/fonts/card.ttf` (Scheherazade New or Noto Naskh Arabic, never Amiri or Amiri Quran: they set the harakat off their letters here), else it uses the display font; a hadith's reference on two lines with `\n` (the collection and number, then the grade); `LOOK = "sky"` drops the box for a soft shade over a drawn scene. **The card is still; the world behind it is not:** keep the camera and the scene moving under a soft plate (`S.plate`, P12) |
   | `ladder.html` | the steps of a «السلّم» video, bottom to top, «؟» on the top step until its answer is said | each step's `at` is a spoken word; for drawn scenes and dark grounds |
   | `ladder-paper.html` | «السلّم» on paper: the ladder small in the margin as the progress, one big section per step that slides in from the left as the last slides out to the right, a push in every section, then the whole ladder named | needs `kit/kit.js` and `kit/paper.js`; each step's `at` is a spoken word; each section is drawn in its `draw(S, at, end, mid)` |
   | `compare.html` | two cards, one idea against the next, with an optional meter | the card being talked about is bright |
   | `rewind.html` | the rewind after a cold open | the open itself is the last picture and line, 1.5–2.5 s |
   | `end-card.html` | the calm last screen: mark or logo, name, follow or share line, optional keyword | 2–3.5 s; optional (a question over the last picture also closes a told video) |
   Ways of telling that use them: `reference/story-formats.md`.
   - **When `word-lit.html` carries the spoken words, remove the starter's `captions` and `title` tracks** from `index.html` (otherwise the same words show twice).
   - **`word-lit` options** (all optional; a config without them works as before):
     - **A number the voice says in words** (the voice text writes it as words, `voiceover.md`): write `١٤٤٠{ألف_وأربعمية_وأربعين}` in `text`. The screen shows «١٤٤٠» and it lights on those spoken words (`_` joins them); `keys: ["١٤٤٠"]` turns it gold.
     - **Per sentence:** `size: 110` (the hook, a one-word answer); `lit: true` (the words start lit, key words still turn gold when spoken): **use it on the sentence that is on screen at frame 0**, the thumbnail; `label: true` (`LABEL` shows only on the sentences that say so; with none, on every sentence as before).
     - **A small line:** a line that starts with `~` is set at `smallSize` (50 px), e.g. «~اكتب جوابك في التعليقات» under the question. Its words are spoken and matched like the rest.
     - **One label for the whole video:** `LABEL = { ar: "خاطرة", keep: true }` stays from the first sentence to the last, at y 266 (`top`; never under 262, or the profile grid's crop cuts it).
     - **The last sentence** (`hold`): `"auto"` (the default) stays to the video's end, unless `index.html` has the end card: then it leaves 0.5 s after its last word and the card closes. `"end"` or a number of seconds sets it yourself.
     - **Over a moving or bright scene** (P12): `plate: 0.5` puts a soft dark ground under the words, from the first sentence to the last (`plateColor` to change it; 0 on paper).
     - **On light paper with dark ink:** `shadow: "none"` and `keyGlow: "none"`: the default dark shadow under each word leaves a halo on a pale page (since 1.7.0 of 11-12; before, only a CSS override in `index.html` removed it).
     - **Harakat and punctuation:** write the sentences as spoken, with the voice's harakat and punctuation; the screen shows none of the harakat (`harakat: "light"` brings back shadda and tanween) and drops «، . : ؛ !» at a word's edges (`punctuation: "keep-bang"` keeps «!», `"keep"` keeps all); inside a word («١٢:٣٠»، «٢.٥») they stay.
   - Timed values in every block (`SHOW`, `HIDE`, `AT`, a step's `at`) take seconds or a spoken word / cue name; `word-lit` matches its sentences to the spoken words in order, and a sentence after words it does not show (a text read on the still card) takes `from: "<its first spoken word>"`.
7. **Audio:** mix first (`reference/film-sound.md`), save the mix as `assets/mix.wav`, then uncomment the `<audio>` element in `index.html` with the real duration.
8. **More scenes:** more `compositions/*.html`, each registered as a track in `index.html` (`data-composition-src`, `data-start`, `data-duration`, `data-track-index`), and each registering its GSAP timeline in `window.__timelines["<id>"]`.
9. **Drawn worlds and people:** in `index.html`, after GSAP, load `kit/kit.js`, `kit/scene.js`, `kit/figure.js` (and `kit/paper.js` for the paper world). Build each scene from named pieces (`scene-kit.md`); people only by `figure-kit.md`. Ready scenes to start from: `kit/examples/`. A video told in places (a new place every sentence or two) builds them all in one composition with `Khaam.places` and joins them with cuts, whips and fades (`scene-kit.md` § The camera); its pace numbers are in `reference/pace.md`.

## Arabic rules (check them every time: HyperFrames' own `check` does not catch Arabic errors)
1. **Put `dir="rtl"` on every container that holds separate words** (a span per word, a flex row, a caption group). Without it the words come out in reverse order.
2. **Never put `dir="rtl"` on `<html>`.** It flips the whole layout. Put it on the container.
3. **Whole words only.** Never split Arabic into letters (`split("")`, SplitText chars): the letters detach. If letters truly must move, use GSAP's `splitArabicText()` helper, which keeps the joins, and test it first.
4. **Arabic fonts:** none ship with HyperFrames. Declare each with `@font-face` from `assets/fonts/`.
5. **IBM Plex Sans Arabic draws «تى» like «ق»** («حتى» → «حق»). Avoid it for headlines, or put a tatweel in the word («حتـى»). Read every «تى» at full size.
6. **Catalog blocks** (`npx --yes hyperframes@0.8.225 catalog --json`, then `add <name>`) are built left to right. Each one needs:
   - `dir="rtl"`;
   - motion from the right (`transform-origin: 100% 50%`);
   - our Arabic font instead of theirs;
   - no `uppercase`;
   - vertical sizes.
7. **Frame 0 is the thumbnail on social players:** keep the title readable at 0 s (a word-lit sentence on screen at 0 s takes `lit: true`).
8. **Safe area at 1080×1920:** keep text between y≈250 and y≈1540. The bottom ≈380 px sits under the app's buttons. The cover's hook text sits below y≈300: the profile grid shows only the middle 3:4 (y 240–1680).

## Check, look, render
Run everything from the video folder. A full render goes through the user's normal flow (no lock needed on a personal machine).
```
npx --yes hyperframes@0.8.225 check                                    # layout, motion, contrast, craft, audio
npx --yes hyperframes@0.8.225 snapshot --at 0,1.5,3                    # stills + contact sheet: LOOK at the Arabic
npx --yes hyperframes@0.8.225 render --output "renders/previews/<name> - Preview v1.mp4"
npx --yes hyperframes@0.8.225 render --output "renders/final/<name> v1.mp4"
```
- **Read the `runtime` section of `check`'s report first** (the console and the report JSON): a composition script that throws (a missing kit file, a wrong selector) shows only there, and the craft warning `check` prints at the end («dead_stretch») is its echo.
- Read every warning `check` prints. Four that are known:
  - `gsap_timeline_set_initial_hide`: a start state hidden with `tl.set(el, {opacity: 0}, 0)` inside the timeline may not apply on frame 0, so the cover frame can show a card or a pen stroke that should not be there yet. Set hidden start states with `gsap.set(el, {…})` outside the timeline, before it is built (the timeline then only animates them in), and look at a snapshot at 0;
  - it wants the video to close on 2–2.5 s that keep breathing (light, sway, a slow push), not a freeze: give the last line or the end card 2 s or more (word-lit's last sentence stays to the end when there is no end card) and keep something moving under it;
  - `gsap_css_transform_conflict`: a CSS `transform` on an element whose same property a GSAP tween animates; move the static transform to a wrapper, or set it with `gsap.set`;
  - contrast errors on layers hidden at that moment by `clip-path` or `autoAlpha: 0` are false: confirm with a snapshot at that time.
- Scene-kit layers are wider than the frame so the camera can move; since 1.7.0 of 11-12 the stage marks them `data-layout-allow-overflow`, so "container_overflow" no longer shows for them (a project with an older kit may still list it: not a fault).
- HyperFrames moves a composition root's `id` to `data-hf-authored-id`: only the composition's own script finds it by id. Hand the element to a helper (`document.getElementById("…")`) rather than a selector; the kit's own `"#id"` lookups fall back to the attribute.
- The review preview renders fast with `render --quality draft` (full size; 0.8.225 has no reduced-size option). The final uses the default quality.
- Open the snapshot contact sheet and read every Arabic line at full size: the word order, the joins, the dots, nothing clipped.
- After the user approves, deliver with `workspace.py --deliver`, then make the cover with `scripts/cover.py` on the delivered file in «جاهز» (the hook frame and a profile-grid tile land beside it): `python "<skill>/scripts/cover.py" "<the delivered .mp4>" --words "assets/vo/<take>.words.json" --offset <same as the build> --cue "<the hook's last word>"` (the frame 0.3 s after that word starts, while the line is lit).

## Known limits
- **A user folder with Arabic letters** (an Arabic Windows user name): HyperFrames and FFmpeg may print Fontconfig errors with «????» in a path. They are harmless when the fonts load from the project (`assets/fonts/`): judge by the snapshot, not by the warning.
- **The built-in `tts` and `transcribe` are English-only by default.** Kokoro has no Arabic, and `transcribe` defaults to `small.en`. Use the user's own recording or ElevenLabs (`voiceover.md`) for voice. For Arabic word timings, use the ElevenLabs helper's alignment or `scripts/align_voice.py` (the user's recording + its script), never a `.en` model.
- **Paths past 260 characters fail on Windows** (`ENOENT … mkdtemp`). The workspace lives near the top of the user's folders for that reason.
- **Fresh GSAP:** compositions load GSAP from jsDelivr. A render needs the internet the first time; the browser caches it after that.
