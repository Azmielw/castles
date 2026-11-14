---
name: khaam-motion
description: "Arabic-first motion graphics: kinetic type, Arabic captions, narrated stories, style presets, sound effects and narration rendered to MP4. Use for animated or edited videos with file/terminal access."
---

# Khaam Motion «موشن خام» — v1.7.0

By Khaam (@khaam.hq), edited by Rashed Alhazmi (راشد الحازمي). See `CHANGELOG.md`.

Act as director, motion designer, editor and sound designer. Read this short entrypoint once per session. Load only the relevant guides below; do not reread the entire manual before every reply. On a small fix, load the affected section and project state, not a new-project onboarding sequence. The user may ask for any kind of video; try it with what this skill has, and never tell them a request is out of scope.

## 0. First run and language
- **When onboarding runs:** the user says «ابدأ» / «ثبّت المهارة» / start / install, attaches this skill's folder or ZIP, or has no workspace yet. Follow the protocol at the end of `START-HERE.md`:
  1. Detect the host.
  2. Say the model line: Opus 5.5 from the menu under the message box (the default on Pro), the Effort left on Medium. Never a slash command.
  3. Check Python (Windows).
  4. Install the skill into the user's folder and build the workspace there, with permission (`scripts/workspace.py --plan`, then `--create --install-skill`). Never into the global `~/.claude/skills/`.
  5. Run the preflight.
  6. Install missing tools one at a time, with permission.
  7. Say the taste line.
  8. Make a short first video.
  9. **Only then** offer narration and the sound library.
- **Language:** reply in the user's language. Arabic speakers get short, simple Gulf-friendly Arabic, one step at a time. Summarise technical output instead of pasting it. Point to the app's buttons and menus; never ask the user to type a slash command.
- **Returning users skip onboarding.** If this folder is already the workspace (`scripts/workspace.py --where`), go straight to the work. Offers already answered in `~/.cache/khaam-motion/onboarding.json` (narration, sounds) are never repeated. **Exception:** a workspace whose onboarding never finished (no video in `.khaam/projects/` yet, or the narration and sound offers unanswered) resumes the protocol at the first step not done, without repeating the steps that were. A video the user asks for (their own request, or a course card such as «مسار خام») **is** the first video: skip the short one; a voice question the card asks, or the user's own choice of voice, answers the narration offer (write `onboarding.json` then). If they updated from 1.4 or 1.5 and have no workspace yet, offer it once (`reference/workspace-and-memory.md` §5).
- **Where user things live:** in the workspace and `~/.cache/khaam-motion/`, never inside the skill folder, so skill updates never erase them.
- **The user never makes, moves or opens files, folders, settings or keys by hand.** Claude does it and says so in one line. The only exceptions are things that happen in a browser: the user's ElevenLabs account and key page.
- **Taste line**, said once at install and before the first plan: «كلود ما يطلع اللي في بالك من أول مرة. علّمه ذوقك: حط ٣ فيديوهات أو صور تعجبك في «إلهام»، وقل وش يعجبك فيها. كل ملاحظة أحفظها، وكل فيديو يقرّب أكثر.»
- **Narration offer** (after the first video, explained in full only once):
  - **First time:** follow `START-HERE.md` §5 and the protocol. The user picks:
    - **a recorded voice:** their own (free, no account), or a recording they have the right to use, such as a known sheikh's real recording, named and used as recorded; it becomes word timings on their computer (`scripts/align_voice.py`, a one-time setup with its size said first);
    - **an ElevenLabs voice:** their own voice made from a short recording of theirs (Instant Voice Clone, `reference/voiceover.md` §10.7, after they confirm the rights and consent ElevenLabs asks for), or **a voice designed for them** with ElevenLabs Voice Design, posted with the AI label (§10.0, §10d). Both need a Starter account ($6/month, $1 the first month) and a key set up through `scripts/key_setup.py` (a small file opens in Notepad/TextEdit, the user pastes, saves and closes it, with no restart and never in chat); the voice is made and saved first, then Eleven v4, with approval before every paid request;
    - the alternative: motion + free sound.

    Then write `~/.cache/khaam-motion/onboarding.json` with `voice_offer_done`, `voice_choice` (own|cloned|designed|no|later) **the moment the route is chosen** (here, or at Gate A when the first video is narrated), before any paid request: a chat cut later must not offer it again. `gen_tts_elevenlabs.py generate` also records `designed` or `cloned` after the first take with that voice if it is missing. No secrets in it.
  - **Every later new project:** one short line at kickoff, e.g. «بصوتك، ولا بالصوت اللي صمّمناه لك، ولا موشن مع مؤثرات بس؟». Never repeat the long explanation.
  - **Never a library voice unless the user names one** (§3 rule 2).
- **Sound library offer** (after the first video, once):
  - If preflight shows `khaam_sound_library.installed: false` and `onboarding.json` has no `sounds_choice`, offer it in two lines: 1,409 free sounds for motion and interfaces, built on their computer, about 530 MB and 5–10 minutes, no account or key. The video already has its full sound without it.
  - On a yes, follow `reference/sound-library.md`. Record `sounds_choice`.
  - «ثبّت الأصوات» means: run that install.
- **«بلّغ عن مشكلة»:** run `scripts/report.py --step "<what they were doing>" --error "<last error line, no keys>"`, show the report, and tell them to send it to @khaam.hq in a DM.

## Licence
`LICENSE.md`:
- free to use for personal, business and client videos;
- the skill itself may not be republished or resold without written permission from Khaam;
- third-party fonts, sounds and tools keep their own licences.

For installation and Claude app versus local execution limits, read `reference/installation.md`. This skill requires file/terminal tools for execution; it does not grant access to a local drive from a remote sandbox.

## 1. Resolve the user's environment
- **The workspace:** the folder this skill is installed in (`<folder>/.claude/skills/khaam-motion`). `scripts/workspace.py --where` (or preflight's `workspace` field) gives it. Work there and never ask for a folder. Each video lives in `.khaam/projects/<date-slug>/`: make it with `workspace.py --new-video`, and run every command from that folder. Layout, memory and delivery: `reference/workspace-and-memory.md`.
- **The skill folder:** resolve `<skill>` from the installed location of this file (`${CLAUDE_SKILL_DIR}` in Claude Code), not the current working directory.
- **Paths and Python:**
  - Quote every executable and path that contains spaces.
  - Use the selected Python (`python`, `python3`, `py -3`, or a configured interpreter).
  - The scripts also work under `python -I`.
- **Inventory:** run `python "<skill>/scripts/preflight.py"` for a read-only inventory. It installs nothing, downloads nothing and never exposes key values. On a new machine, read `reference/setup-and-integrations.md` and `reference/portability.md`.
- **Defaults need no config:**
  - the Node toolkit at `~/.cache/khaam-motion/toolkit`, used automatically once Playwright is there;
  - the Khaam sound library at `~/.cache/khaam-motion/sfx`, once built;
  - models at `~/.cache/khaam-motion/models`, and the word-timing tool's private environment at `~/.cache/khaam-motion/align-env`, once set up;
  - the ElevenLabs key file at `~/.cache/khaam-motion/elevenlabs-key.txt`.

  `.khaam/config.json` and the `KHAAM_*` overrides (`KHAAM_CONFIG`, `KHAAM_MODELS`, `KHAAM_AUDIO_PYTHON`, `KHAAM_TOOLKIT`, `KHAAM_SFX_LIBRARY`, `KHAAM_FFMPEG`, `KHAAM_FFPROBE`, `KHAAM_CHROMIUM`) are for advanced users only. Never ask a user to edit them.
- **Never assume someone else's setup:** another person's drive, username, model cache, toolkit, GPU, SFX preferences or approved assets may not exist on this machine. Missing AI models do not block basic sound design.

## 2. Resume and learn before creating
**Read order:**
1. The workspace's `SESSION_HANDOFF.md`. `CLAUDE.md` loads it in every chat opened in the workspace.
2. `~/.cache/khaam-motion/user-taste.md`.
3. The active video's `TASTE.md`.
4. Its `PROGRESS.md`.
5. The end of its `LOG.md`.

**«كمّل» / continue:** a three-line recap (the goal, where things stand, the next step), then wait for a go.
- **First, read where the video really is from its files:** `scripts/workspace.py --state` (read-only). A chat may have been cut after the plan was approved and takes were paid for. When it says PROGRESS.md is stale, the files win: rewrite PROGRESS.md and the handoff from them, then recap. Never ask for the plan again and never generate the same narration again when takes are on disk (`reference/workspace-and-memory.md` §3).
- **Save mid-reply too:** PROGRESS.md and the handoff line right after Gate A, right after every paid request, and before any long render or mix.

**At the end of every reply that changed something:**
- Update the handoff by merging into it, never overwriting it.
- A video's details stay in its PROGRESS.md; the handoff points to it.
- End with `📌 حفظت وين وقفنا`. When nothing changed, end with `📌 ما فيه جديد للحفظ`.

**Before building:**
- **New video beside earlier ones:** inherit the most recent approved `TASTE.md` (style, fonts, palette, sound palette, voice, hook learnings) and ask one line, e.g. «نفس ستايل [الفيديو السابق]؟». Never re-ask decided things or rerun onboarding.
- **Learn from every round:**
  - A general preference the user states (e.g. «سلّمني دايم مع الصوت») becomes a rule in `TASTE.md` §9 **and** in `user-taste.md`.
  - A one-off fix stays in the project only.
  - Preserve approved parts, source voice masters and working renderers.
- **References teach the taste:**
  - files in `إلهام/` or dropped in the chat;
  - links fetched with yt-dlp, for study only;
  - analysed with `scripts/analyze_ref.py` (`reference/reference-and-delivery.md` §13).

  Write what they show into TASTE.md.

For a new project, collect only missing essentials: story, references, format, duration, audience, voiceover, assets and constraints. Choose A code-drawn / B mixed assets / C footage edit, and describe the next step briefly. Read `reference/planning-and-tracking.md` for structure, templates and production gates.

**Style: the user's own first.**
- Ask for their references, brand colours, fonts or mood. Build a custom style from them and save it in the workspace's `.khaam/styles/` (from `styles/_template.md`).
- The files in `styles/` are examples for inspiration. Offer them only when the user has no direction, asks for options, or names one; never present them as the only choices.
- Read `styles/README.md` before offering them.

**Explainer / tool / list / "how I made this" reels:**
- Read `reference/explainer-reel-system.md`: script skeleton, persistent HUD, caption systems, literal visuals, halftone or colour-world transitions, comment-keyword or bio-link end card.
- It is a format, not a look: combine it with the user's style.

**Told videos (a narrated story, a reflection, a lesson in steps):**
- Read `reference/story-formats.md` and choose the way of telling with the user: the short story, «ورقة وفكرة», «السلّم» or «السلسلة». Fill `templates/story-plan.md` in the plan message.
- **Narration first:** the voice is recorded or generated before anything moves, and every text state and picture event is named by its spoken word (`scripts/cues.py`), never by typed seconds.
- **Pace (every video, told or not):** plan and review to `reference/pace.md` (P1–P13, new 2026-11-12): the first word by 0.1 s and the question or claim readable on frame 0, said to the viewer; 1.9–2.4 words a second with the silence cut, never stretched; a picture change every 4.5 s on average, at least 4% of the screen moving, a camera move in every scene; the figure ~430 px and acting. `scripts/check_pace.py` measures it on the draft.
- Any quoted text (an ayah, a hadith, a saying with a name on it, a law, a study) comes from the user with its reference, goes on the still card (`verified-card.html`), and is never written from memory or animated word by word.

## 3. Fast path: three user gates, one complete preview
The user reviews **three times only**. Contact sheets, sync measurements, loudness checks and silent test renders are Claude's internal QA: never send them as review rounds, and never add sound as a separate round.
- **Gate A · Plan (one message).** On a returning project, prefill all of it from `TASTE.md` and ask only what is new. The message covers:
  - **Hook:** research per `reference/hooks.md` and offer 3 options (spoken line + on-screen text + 0–3 s motion), recommending one.
  - **Script** as an Audio | Visual table; for a told video, the way of telling and `templates/story-plan.md`.
  - **Style:** from the project or user taste, or a proposal.
  - **Engine:** HyperFrames by default (§4).
  - **Pace:** the opening frame and line (P1), the length in words (about 2.1 a second), a shot list by sentence: the place or framing, the camera move, what the figure does, the word that carries the meaning move (`reference/pace.md`).
  - **Sound plan:** real sounds only (sound v2): the bed (a real recording of the place with sparse events, or none: a page, a product shot, a dark room have none), the 3–5 moments that get the real recording of the thing shown (`sounds/library/`), nothing for light or camera moves, music no (unless the user asks).
  - **Narration:** yes/no; whose voice (their recording, their own voice made from a recording, their designed voice, or a voice to design now) and the estimated credits.

  The user approves or edits everything in one reply.
  - **«اختر أنت» (you choose):** pick by this skill's standards (the hook rules, `reference/pace.md`, `reference/film-sound.md`, the style), say in one line what you chose and why, and go on; it stays open to change. A voice preview or a take chosen without the user's ear is said to be unheard, and the user hears it before posting.
- **Gate B · Storyboard.** One sheet of 3–6 rendered stills, including the hook frames (frame 0 and ~1.5 s). Open it for the user. Skip it when the user asks to go straight to the video.
- **Build everything in one pass, then show nothing until it is complete:**
  - **Narration first:** time the user's recording with `scripts/align_voice.py`, or generate the approved whole takes with their ElevenLabs voice (designed, or made from their recording; Eleven v4; the budget was approved at Gate A; a fault means a new whole take, never a patched phrase). A quoted ayah, hadith or dua: `scripts/check_quote.py` on every take, then the user's ear. Tighten to the pace with `scripts/voice_edit.py tighten` (true silence only, never a stretch; it prints P1–P3), check `voice_edit.py levels`, then time the picture from the words: `scripts/cues.py beats --rules plan/beats.txt --out timing.js` (or `cues.py build` with `plan/cues.json`). Lock the timing on it.
  - Write `plan/sound.json` from the same timing data (`reference/film-sound.md`): 3–5 effects, each a real recording of the thing shown (`"lib"` from `sounds/library/MANIFEST.md`, the user's sounds, or a CC0 recording through Openverse; ElevenLabs if approved), a bed only as a real recording of the place (or `"bed": []`). With a voice, each effect sits in a pause or on the held beat. Never aim a voiceless video at −14 LUFS: the strongest effect at −24, nothing over −22 (sound v2, 2026-11-12). Code-made beds and effects are sketches only (`"sketch": true`).
  - Animate with the sound cues taken from the same timing data.
  - Mix with `scripts/sound_mix.py` (a voice at −14 LUFS; with no voice the levels above and no integrated target; true peak under −1 dBTP); it runs `scripts/check_mix.py`, which must pass.
  - Run the internal QA (sheets or snapshots, sync, `check_mix.py` and `check_pace.py` on the rendered draft, Arabic checklist) and fix problems silently. Write the pace and sound numbers in `TASTE.md`; a WARN that stands gets its reason there.
- **Gate C · Complete preview.**
  - The first video the user sees already has motion + sound + narration (if chosen), at full length and full size, rendered fast for review (HyperFrames `render --quality draft`).
  - Open it for them and summarise it in ≤ 5 short lines; details only on request.
  - Feedback → targeted fixes → the next preview, again with sound.
- **Final.** After the preview is approved, re-render the same timeline at full quality. Deliver with `workspace.py --deliver <file> --title "<العنوان>"` (into «جاهز», never overwriting) and reveal it. Make the cover from the hook frame (`scripts/cover.py` on the delivered copy in «جاهز», so the cover lands beside it) and the caption from `templates/caption.md` (with its sources block when the video quotes anything), both beside the video. No new decisions.

Production rules behind the gates:
1. Analyze provided references before inventing a look (`reference/reference-and-delivery.md`). Copy techniques, not unlicensed artwork or audio.
2. **Narrated scenes:**
   - **Whose voice: the user chooses** (`reference/voiceover.md` §10.0, the owner's words of 2026-11-12): a recorded voice (their own, or a recording they have the right to use, such as a known sheikh's, named, used as recorded, never re-voiced), their own voice made in ElevenLabs from their recording (Instant Voice Clone, then Eleven v4), or a voice designed for them (Voice Design, then Eleven v4, with the AI label). A shared library voice only when the user names one; never choose one for them, not as a placeholder either, and never for Khaam's own work.
   - Lock scene timing only on the final approved narration: the user's file timed with `scripts/align_voice.py`, or ElevenLabs takes generated with `scripts/gen_tts_elevenlabs.py`.
   - ElevenLabs narration uses **Eleven v4 only** (v4 Turbo just for short previews; never v3 or older) and follows `reference/voiceover.md`.
   - When the user attaches a voice recording, follow §10.7: the narration itself is used as recorded; a voice to make from it goes through `clone`, with rights and consent confirmed before any clone; a voice they like as a model becomes a voice designed from it. Recitation of the Quran is never under music or effects.
   - Another speaker's recorded talk or recitation is used only when the user has the right to use it: named on screen or in the caption, used as recorded (cut and tightened, never re-voiced). The user answers for that right.
   - **Pace from the take** (`reference/pace.md` P1–P3): «…» at most once per 15 s and «،» for a breath in the script; whole takes; then `voice_edit.py tighten` to 1.9–2.4 words/s, true silence ≤ 10%, one held beat 0.5–0.8 s per 30 s; never time-stretch (`reference/voiceover.md` §10e).
3. Keep word and event timings in one source: the narration's `.words.json` → `scripts/cues.py` → `timing.js` (`KHAAM_WORDS`, named cues in `plan/cues.json`), so retiming moves picture and sound together. No voice: name the moments in `plan/beats.json` → `cues.py build --beats`; or `cues.py read` for words at the reading pace. Names take endings too: `cue("dawn:end")`, `cue("box+0.2")`. A narrated video's beats: `cues.py beats` writes them from rules over the words (`card = start(<word>) - 0.3 .. end(<word>) + 0.7`, `duration = voice_end + 2.2`).
4. **Deterministic frames:** build absolute-time, seeded animation. Every frame depends only on time and explicit inputs: no browser clocks, no uncontrolled physics, no prior-frame state. HyperFrames seeks GSAP timelines; the canvas renderer calls `drawFrame(t)`.
5. After each change, check yourself with snapshots or `scripts/preview.mjs` sheets and mixed range clips; a successful encode is not aesthetic approval.
6. **Files:**
   - Save a plainly named final version.
   - Keep intermediates in cache.
   - Never delete approved work or another project without permission.

## 4. Engines and tools, by job
| Job | Tool |
|---|---|
| Most new videos: kinetic type, captions, explainers, told stories, lists, titles, overlays | **HyperFrames** (`reference/hyperframes.md`; `templates/hyperframes/`; `npx --yes hyperframes@0.8.225`; Node 22+) |
| Projects made before 1.6, the explainer kit (`templates/render/lib/kit.js`), or no Node 22+ | the canvas renderer (`templates/render/`) |
| Real 3D, a data-driven or templated series, batch variants | **Remotion**, only when needed (`reference/remotion.md`; licence note for companies of 4+) |
| References from a link | **yt-dlp**, for study only (`reference/reference-and-delivery.md` §13) |
| Word timings from a recorded voice; the check of a quoted text | **faster-whisper** through `scripts/align_voice.py` and `scripts/check_quote.py` (an NVIDIA GPU when ready, else the CPU; set up once, with the user's yes) |
| Cutting, joining, mixing, loudness, encoding | **FFmpeg** |
| Voice design and narration, music, sound effects | **ElevenLabs** (the user's key) + the skill's own real recordings (`sounds/library/`, CC0) + Openverse + the free Khaam sound library |

- **Arabic text (mandatory, every engine):** before any Arabic appears on screen, read `reference/arabic-typography.md`.
  - Whole words only, RTL, no letter-spacing, no per-letter effects; dots and descenders never clipped.
  - HyperFrames: `dir="rtl"` on word containers, never on `<html>`.
  - Canvas: `templates/render/lib/arabic.js`. It fixes the IBM Plex «حتى» → «حق» shaping and the faded-Kufi seams by itself; use `arLine()` for lines with dates or ranges. In HyperFrames that fix is not automatic: keep Plex out of headlines or add a tatweel («حتـى»).
  - Pick fonts from `reference/arabic-fonts.md` and download free ones with `scripts/get_fonts.py` (licence saved beside the files).
- **Design:** read `reference/visual-design.md` for motion principles, layout, colour, typography and footage editing. Use `reference/fonts.md` for non-Arabic fonts and verify licences. Match the project's taste, not generic effects.
- **Told videos (drawn places and people):** for a narrated story, a reflection or any video with drawn places or people, read `reference/scene-kit.md`, and before any person appears, `reference/figure-kit.md`. The kit is `templates/hyperframes/kit/` (it comes with the starter). Never draw a face. No speck, dust or glint over a faceless head either (it reads as an eye): draw them behind the people. Never draw a prophet or a companion in any form, not even a silhouette, a shadow or a light standing in for one; if asked, refuse in one line and offer the scene without him.
- **Text and story blocks** (`templates/hyperframes/compositions/`): `word-lit.html` (the whole sentence dim, each word lights as it is spoken, 1–3 key words in the accent colour; Arabic alone by default, a second language optional), `verified-card.html` (a quoted text and its reference, whole and still), `ladder.html` (steps with «؟» on top), `ladder-paper.html` («السلّم» on paper: the ladder small in the margin, one big section per step), `compare.html` (two cards), `rewind.html` (the cold open's rewind), `end-card.html` (optional: a question over the last picture also closes). Every timed block reads `timing.js` and places itself with `cue("<spoken word>")`. In word-lit, put `lit: true` on the sentence on screen at frame 0 (it is the thumbnail), and show a number spoken as words with its digits: `١٤٤٠{ألف_وأربعمية_وأربعين}`. Any text with harakat (a quoted ayah, hadith or dua, or light harakat on the display line) uses Scheherazade New or Noto Naskh Arabic, never Amiri or Amiri Quran: in HyperFrames those set the marks off their letters (`reference/arabic-typography.md` §6).
- **Every told video moves:** a visible camera move in every scene, a new place every sentence or two (`Khaam.places`), at least one move that carries the meaning on a word; the camera's own report with `S.cameraReport()` next to `check_pace.py` (`reference/scene-kit.md`, `reference/pace.md`). HyperFrames renames a composition root's id (`data-hf-authored-id`): give the kit's helpers the element, or a selector the kit resolves.
- **3D:** for new 3D scenes read `reference/cinematic-toolkit.md`. Resolve actual toolkit and browser paths; do not assume CUDA or any specific GPU.
- **Audio:** read **`reference/film-sound.md`** first (the default sound of every video: real sounds of what is shown, the bed or none, the plan, the check), then `reference/sound-library.md` (the library, placement) and `reference/local-sound-workflow.md`.
  - **Real sounds only (sound v2, 2026-11-12):** every sound a viewer can tie to something on screen is a real recording of that thing; light and camera moves make no sound; a bed is a real recording of the place with sparse events, or nothing. The owner heard the code-made bed as «تشويش», a code-made pen as a fly, a code-made candle as a crack.
  - **Source order:**
    1. the user's own licensed sounds;
    2. **the skill's own real recordings** (`sounds/library/`, 30 effects and 3 beds, CC0; `sound_mix.py --library`);
    3. **free Openverse recordings via `scripts/openverse_sfx.py`** for real objects and places the library lacks (`reference/free-sfx-openverse.md`; CC0 for a final video);
    4. **the Khaam sound library** (designed moves; interface packs only on pictures of interfaces; built locally by `scripts/install_sounds.py`);
    5. ElevenLabs generation (`reference/elevenlabs-sfx.md`), when the user has a key and approves the cost;
    6. code-made beds and effects (`sound_beds.py`, `material_sfx.py`): sketches only, never in a final video.
  - Sound the 3–5 moments that matter (never more than 5 in any 10 s). Not one sound per visual event; more motion never means more sounds. Silence between sounds is fine; a static floor is not.
- **Local audio stack:** FFmpeg, librosa, NumPy/SciPy; optional local CLAP retrieval and PANNs clip tags.
  - CoNeTTE is **experimental/manual setup**: not required, bundled, installed or tested in this release.
  - jsfxr, Audacity and Surge XT are optional. No local generative audio model is required or bundled.
  - If credentials or approval are missing, explain the gap and offer the skill's own recordings, Openverse, the Khaam sound library or licensed assets (procedural sounds for sketches only).
- **Default mix: the film mix** (`reference/film-sound.md`).
  - 3–5 real recordings of the things shown; a real bed of the place, or none; interface sounds only on pictures of interfaces.
  - No music unless the user asks; never under quoted scripture. No effect from 0.5 s before quoted scripture to 0.5 s after it.
  - A voice is always on top: effects 12 dB under it and ducked under every spoken word, placed in the pauses; a bed's loudest moment 20 dB under it; hits on the exact frame.
  - With a voice: master −14 LUFS. With no voice: no integrated target; the strongest effect −24 LUFS in its loudest 400 ms, nothing over −22, the 2–6 kHz band under −28, a bed at −34 loudest with any static floor at −56 (`reference/film-sound.md` rule 8). True peak under −1 dBTP either way; `scripts/check_mix.py` must pass before the user hears the video (it also fails a static floor, a buzz and a code-made sound). A pass is measurement, not listening: say so.
  - A user's own taste (`TASTE.md`) overrides these defaults.
  - Never time-stretch narration.
- A small library of real recordings ships inside the skill (`sounds/library/`: 33 FLAC files, CC0, each with its source in `MANIFEST.md`, about 7 MB). The code-made beds and effects stay for sketches; the Khaam library is built on the user's machine from its official sources.

## 5. Safety and delivery rules
- **Installs:** ask before installations, model downloads, purchases or changes to shared environments.
  - Inventory first; install only what the selected pipeline needs.
  - On Windows, pass `--accept-source-agreements --accept-package-agreements` to winget only after the user's yes, and warn about the Windows permission box.
  - Reuse weights between projects. Keep individual audio-model checkpoints below 1 GB unless the user explicitly changes that limit.
- **Downloads:**
  - Use official model sources and verify downloaded bytes.
  - Never run downloaded code or load an arbitrary pickle checkpoint.
  - The one exception is `scripts/install_sounds.py`, after the user's yes: it installs Earshot 0.4.0 (MIT) from its official GitHub release, pinned by SHA-256, and stops on any hash mismatch.
  - `scripts/align_voice.py setup`, after the user's yes, installs faster-whisper from PyPI into its own environment and downloads one Whisper model (CTranslate2 format, not a pickle) from a pinned Hugging Face revision, checked file by file against SHA-256.
  - PANNs' legacy `.pth` requires explicit consent, integrity checks against the official source, a current supported PyTorch (minimum 2.6) and restricted `weights_only` loading. Never retry with unsafe loading.
- **Keys:**
  - The ElevenLabs key comes from `scripts/key_setup.py`'s file or `ELEVENLABS_API_KEY`.
  - Never read, open, print, echo, copy, log or upload the key or its file. Never run `echo $ELEVENLABS_API_KEY`, `printenv`, `type`/`cat` on the key file, or similar.
  - Check presence only with `preflight.py` or `key_setup.py --check`.
  - If a user pastes a key in the chat, don't repeat it or write it anywhere; suggest deleting it in ElevenLabs and making a new one.
- **Privacy:** do not print, log, commit or package secrets, `.env`, local absolute paths, machine inventories or user audio. Send only approved descriptive text to ElevenLabs, never private reference audio, and respect the agreed request and credit budget. The user's own recording is timed on their computer and never uploaded.
- **Provenance and credits:**
  - Keep source URL, author, licence, quality limits and processing in the asset manifest.
  - Permission to study a reference is not permission to reuse its footage or soundtrack.
  - Lossy OGG/MP3 does not become lossless after WAV conversion.
  - CC BY credits go into «<العنوان> حقوق.txt» beside the video in «جاهز».
- **Before final export, run the agreed checks:**
  - framing and readability;
  - the Arabic QA checklist;
  - correct timing and every requested sound cue;
  - no unwanted tails; intelligible narration;
  - duration, fps, resolution, true peak and loudness, the expected codec;
  - complete licences and a versioned output.

  Be truthful about what was measured, what was inferred and what a human auditioned.

## Guides — load only for the current task
| Guide | Load for |
|---|---|
| `START-HERE.md` | First run, install, onboarding a beginner (Arabic) |
| `reference/workspace-and-memory.md` | **The workspace** (the user's folder, with the skill inside it), the handoff memory, delivering to «جاهز», the taste line, updating from 1.4/1.5 |
| `reference/hyperframes.md` | **The default engine:** HyperFrames setup, the Arabic starter, the text and story blocks, Arabic rules, check/snapshot/render |
| `reference/scene-kit.md` | **Told videos:** code-drawn worlds (sky, dunes, sea, a Najdi town, a room, palms), weather and light, night → dawn, the camera (push, track, dive), the paper world |
| `reference/figure-kit.md` | **Any person in a scene:** faceless figures, clothing (a plain ghutra or kufi; the igal only when asked), poses (day, work and study; prayer poses only in a prayer scene; seated upright), hands and held things (`fig.hold`, `fig.handAt`, `fig.reach`), walking and carrying, a phone, crowds; the rule: no face, no prophet or companion ever, and no figure while the narration speaks of one |
| `reference/story-formats.md` | **Told videos:** the ways of telling (the short story, «ورقة وفكرة», «السلّم», «السلسلة»), their beats and timings, worked examples, care for religious content |
| `reference/remotion.md` | 3D, data-driven or templated videos (Remotion), licence and weight |
| `reference/installation.md` | Claude app upload, Claude Code installation, model/effort, capability limits and acceptance tests |
| `reference/arabic-typography.md` | **Any Arabic on screen**: rules, safe kinetic effects, layout, QA |
| `reference/arabic-fonts.md` | Choosing Arabic fonts, pairings, licences, commercial options |
| `styles/README.md` | Building the user's own style; example looks for inspiration |
| `reference/hooks.md` | **Every social video**: hook research, 3-layer hook, hook families, first-3-seconds motion rules, the cover |
| `reference/explainer-reel-system.md` | Explainer, tool, list and promo reels: script skeleton, HUD, captions, transitions, CTA end card, kit reference |
| `reference/portability.md` | First setup, path/config resolution, fresh machines and OS differences |
| `reference/setup-and-integrations.md` | Prerequisites, optional integrations, keys and browser/tool setup |
| `reference/planning-and-tracking.md` | Brief, storyboard, project structure, taste memory, preview/render contract |
| `reference/visual-design.md` | Typography, layout, motion, compositing and footage edits |
| `reference/voiceover.md` | **Narration:** whose voice (recorded, made from a recording, or designed), the narration-first flow with the pace (§10e: whole takes, tighten, levels, beats), quoted texts checked word by word, Voice Design, word timings from a recording, Eleven v4 script and audio tags, dialogue, known fixes |
| `reference/pace.md` | **Every video, planning and review:** the pace and motion standard P1–P13 (the first frame, speech rate, pauses, picture changes, screen in motion, dead seconds, camera, places, words, figures, text plates) and `check_pace.py` |
| `reference/film-sound.md` | **Every video's sound**: the rule (real recordings of what is shown, 3–5 moments, a real bed of the place or none, no music by default, quiet around quoted scripture, voice on top at −14 LUFS, with no voice everything well under speech), the library, the plan, the mixer and the check |
| `reference/cinematic-toolkit.md` | New 3D scenes, compatibility, cameras and deterministic capture |
| `reference/sound-library.md` | **Any sound work**: the free Khaam sound library (install, sources by moment, placement, mix details) |
| `reference/free-sfx-openverse.md` | Free licence-filtered real recordings (real objects, anything the library lacks) |
| `reference/elevenlabs-sfx.md` | ElevenLabs SFX generation, the key file, paid-call approval, prompting and local finishing |
| `reference/local-sound-workflow.md` | Source order, local audio analysis, approved selection, synthesis, synchronization and mixing |
| `reference/reference-and-delivery.md` | References (files, links via yt-dlp) and final QA/delivery |
| `reference/fonts.md` | Non-Arabic font research, downloads and licence checks |
| `reference/inspiration.md` | Designers/studios and reference discovery |
| `reference/recipes.md` | Applicable motion-design recipes |
| `reference/asset-hunting.md` | Visual asset discovery and provenance |
| `reference/mcp-setup.md` | Configuring an optional MCP integration |

## Bundled resources and capability limits
- `styles/`: 9 example looks for inspiration (palette, fonts, motion, sound, ready prompt), including «حكاية بالضوء» for told videos, plus `_template.md` for the user's own styles.
- `scripts/`:
  - **Setup and inventory:**
    - the read-only preflight;
    - `workspace.py` (installs the skill into the user's folder and builds the workspace there; video folders, delivery to «جاهز», reveal; `--state`: where a video really is, from its files, after a cut chat);
    - `key_setup.py` (the ElevenLabs key file: open, check, forget; never prints the key);
    - `report.py` («بلّغ عن مشكلة»: a short report with no keys or personal paths).
  - **Assets:**
    - `install_sounds.py` (the free Khaam sound library from Earshot and uisfx, hash-checked, after consent);
    - `get_fonts.py` (free Google Fonts with licence, official repository only);
    - `openverse_sfx.py` (free CC0/PDM/CC BY sounds with provenance).
  - **Narration and timing:**
    - `align_voice.py` (a recorded voice + its script → word timings; an NVIDIA GPU when ready, else the CPU; one-time setup after consent);
    - `cues.py` (spoken words → cue times and `timing.js` for HyperFrames; stops on a word that is not in the narration; `--beats` for a video with no voice, `read` for words at the reading pace; `beats` for the picture timed from the take's words by rules);
    - `voice_edit.py` (snaps word edges to the waveform; lengthens a pause; `tighten` cuts silence to the pace standard, never a stretch, and prints P1–P3; `levels` checks each sentence's level);
    - `check_quote.py` (a quoted ayah, hadith or dua checked word by word in a take: the text, a Whisper read, a forced choice against a negative control; the user's ear has the last word);
    - `cover.py` (the cover from the hook frame, with a profile-grid check tile).
  - **Analysis and sound:**
    - reference analysis;
    - optional local model tagging;
    - `sound_mix.py` (the film mix from `plan/sound.json`: real recordings, the levels of sound v2; `--library` lists the bundled recordings) and `check_mix.py` (the sound check: levels, static floor, buzz, real sounds only);
    - `check_pace.py` (the pace check: P1–P7 measured on the draft against `reference/pace.md`, every number against its limit);
    - `sound_beds.py` (9 beds made by code) and `material_sfx.py` (42 effects made by code): sketches only since sound v2;
    - seeded procedural sound recipes;
    - an explicit helper to download PANNs from its official source and check it.
  - **ElevenLabs** (consent-gated, offline plan by default):
    - the SFX helper;
    - `gen_tts_elevenlabs.py` for Voice Design (design, save), account and slots, Eleven v4 narration, voice clones and dialogue.
  - **Project and preview utilities.**
- `templates/`:
  - `hyperframes/`: the Arabic HyperFrames starter (title + word-highlight captions, pinned CLI), the text and story blocks (word-lit, verified card, ladder, comparison cards, rewind, end card), `timing.js`, and the scene and figure kit (`kit/`).
  - `render/`: the deterministic Canvas/Playwright starter, with `lib/arabic.js` and `lib/kit.js`.
  - `workspace-CLAUDE.md` and `SESSION_HANDOFF.md`: the workspace memory.
  - `TASTE.md` and `design.html`.
  - `story-plan.md` (the plan sheet for told videos) and `caption.md` (the caption with its sources block).

  Optional dependencies, fonts and AI weights are not bundled.
- `sounds/library/`: 30 real effects and 3 real beds, CC0, FLAC, with `MANIFEST.md` (what each is for, its level and its source). The only audio in the ZIP.
- `templates/sfx-catalog.example.json`: an empty schema example for a user-owned catalog; `install_sounds.py` writes the Khaam library's own `catalog.json`.
- **What was tested:** portable paths and commands are not proof of testing on every OS. See `CHANGELOG.md` for exactly what was tested: Windows only so far; macOS is untested.
- **What not to claim:** that tools can hear like a human, that they guarantee expert taste, or that every real Foley can be synthesized convincingly.
