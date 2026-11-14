# Narration scripting, generation and timing

**Narration first:** a told video starts from its voice, and its picture is timed from that voice's words. The user chooses the voice (§10.0): a recorded voice (his own, or a recording he has the right to use, named), his own voice made in ElevenLabs from his recording, or a voice designed for him; a shared library voice only when the user names one. When ElevenLabs is the provider, this guide is the rule set: **Eleven v4 only** (§10.1). Final timing always comes from the delivered audio, never from word-count estimates: `.words.json` from the generator or from `scripts/align_voice.py`, then `scripts/voice_edit.py tighten` (the pace: cut silence, never stretch), then `scripts/cues.py`. The whole flow, step by step, with the pace standard of `reference/pace.md` (P1–P3): §10e.

> Detailed production guidance: load only for the current task. The SKILL.md entrypoint and current user/project instructions take precedence. Section numbers below refer to this production manual; use the entrypoint guide table to locate a different topic. Do not assume any installed tool, private library, universal approval or specific narration provider.

> Narration guide: written for Eleven v4 from ElevenLabs' documentation and launch material plus reported user experience (Sources at the end). ElevenLabs states that model behaviour can change after release, so re-check the docs when results drift.

## 10. ElevenLabs voiceover (Eleven v4)

### 10.0 Which voice: the user chooses
The user has the right and the first say: he picks the route (the owner's words, 2026-11-12). The routes:
1. **A recorded voice.**
   - **His own voice.** Free, his, and it carries his personality. He records on the phone or the computer, Claude puts the file in `assets/vo/` and writes the script he read (exactly what was said) in `plan/vo/`. Then `scripts/align_voice.py` turns the recording into `.words.json` on his computer (no account, no upload; a one-time download of about 580 MB, asked first: §10c).
   - **A recording he has the right to use**, such as a known sheikh's real recording that he brings from outside. It is used **as recorded**: cut and tightened (§10e), never re-voiced, never re-generated. It is **named**: the speaker's name is in the video or its caption. The user answers for the right to use it: ask once where it comes from and write the source in the project's LOG. Then `align_voice.py` as for his own voice, with the exact words said.
   - **Recitation of the Quran is never under music or effects:** put its span in `scripture` in `plan/sound.json` (no effect from 0.5 s before it to 0.5 s after, music cut there: `reference/film-sound.md`). A sheikh's recording carries his name.
2. **His own voice, made in ElevenLabs** (voice creation from his recording: an Instant Voice Clone, then Eleven v4), when he wants his voice without recording every script: 1–2 minutes of him speaking, checked on his computer, then the voice is created in his account (one voice slot) and every narration uses it. `gen_tts_elevenlabs.py clone`, then `generate`: §10.7.
3. **A voice designed for him** (ElevenLabs Voice Design, then Eleven v4): a written description of who the voice is → three previews → the user picks one by ear → it is saved to his account (one voice slot) → every narration uses it. It belongs to him; nobody else's video sounds the same. §10d. It is an AI voice: the post carries the platform's AI label and the caption says so («الصوت بالذكاء الاصطناعي»).

**A library voice only when the user names one** («أبي صوت فلان من المكتبة»), and never in Khaam's own videos. Library voices are shared by thousands of accounts and sound like narrators. Never pick one for the user, not even "for now". `gen_tts_elevenlabs.py generate` refuses a voice the account does not own unless it gets `--library-voice-named-by-user`.

Ask in one line at kickoff: «تبي صوت مسجّل (صوتك، أو تسجيل عندك حق تستخدمه مثل تسجيل شيخ معروف)، ولا صوتك أنت نسويه في ElevenLabs من تسجيل قصير، ولا نصمّم لك صوت خاص فيك؟». A voice already chosen for this user (TASTE.md §6) is reused without asking again.

### 10.1 Model policy (hard rule)
| Use | `model_id` | When |
|---|---|---|
| Every delivered narration, dialogue or approved take | `eleven_v4` | Default. Up to 10,000 characters per request, 90+ languages including Arabic, audio tags, IPA, request stitching, Text to Dialogue. |
| Quick preview only | `eleven_v4_turbo` | A very short sample, a voice audition or "show me how this line would sound". Never the delivered take. About half of v4's list price per character ($0.04 against $0.08 per 1,000 characters on elevenlabs.io/pricing/api, 2026-11-11). |

- Never use `eleven_v3` (previous generation), Multilingual v2, Flash or Turbo v2/v2.5 for narration, not even as a fallback. If v4 is unavailable or failing, stop and report; never switch model or provider silently.
- Always send `model_id` explicitly: Text to Dialogue falls back to `eleven_v3` when it is omitted.
- If `eleven_v4_turbo` is not offered for HTTP text-to-speech on the account (`can_do_text_to_speech` in `GET /v1/models`), preview with `eleven_v4` on a short excerpt instead.

### 10.2 Settings that exist on v4 (and ones that don't)
- v4 has only **Stability** and **Similarity**. **Style and Speed are not available, and SSML (including `<break>`) is not supported.** Pacing is written into the text (§10.4), not set with a slider.
- **Stability** (API default 0.5): lower = wider emotional range and more take-to-take variation; higher = steadier, can become monotonous. Start at 0.5. Energetic sales/UGC read: try 0.4–0.5 and go lower only if the read stays flat (one guide reports random variation below ~0.4). Calm, trust-first read (health, finance, B2B): 0.55–0.7.
- **Similarity** (API default 0.75): higher = closer to the source voice, but can reduce naturalness and copies its flaws. Lower it slightly if the voice sounds harsh or noisy.
- **Seed** (0–4294967295) gives best-effort repeatability. Record seed and settings for every approved take so one line can be regenerated in the same performance.
- **Output:** `mp3_44100_128` by default, because it works on every plan; Free and Starter answer `mp3_44100_192` with HTTP 403 (no credits charged), so use 192 only on Creator tier and above. WAV/PCM output needs a higher tier (44.1 kHz requires Pro); prefer `wav_48000` when the account allows it, because the video ships AAC 48 kHz.

### 10.3 Audio tags: direct the performance
Tags are square-bracket cues inside the text; the same syntax works on v4 and v4 Turbo. They are followed more reliably than on earlier models, but ElevenLabs still calls them "not yet perfect", so audition every tagged line.
- **Placement:** put the tag immediately before the words it changes. The delivery carries forward, so add a new tag only where the delivery changes, at most one per clause. Contrasting tags on the same words blur the performance.
- **Combine** inside one bracket with commas: `[whispering, playful]`, `[nervous, trying to sound confident]`.
- **Free-form direction works:** `[like a sports commentator, speeding up]`, `[tired, trying to sound cheerful]`.
- **Palette** (from ElevenLabs' v4 tag list):
  - Emotion: `[excited]` `[playful]` `[amazed]` `[proud]` `[curious]` `[thoughtful]` `[trusting]` `[peaceful]` `[confused]` `[anxious]` `[tired]`
  - Delivery and volume (raise or lower the voice): `[whispers]` `[softly]` `[quietly]` `[hushed]` `[barely audible]` `[low]` `[booming]` `[shouts]` `[disbelief]`
  - Pacing: `[slowly]` `[drawn out]` `[rushed]` `[snappy]` `[pause]` `[long pause]`
  - Reactions: `[laughs]` `[sighs]` `[gasps]` `[clears throat]` `[gulp]`
  - Accents: `[British accent]` etc. are inconsistent across voices; test before relying on them.
- **Describe the voice, not a noise.** v4 can also generate sound effects, so a vague one-word tag may come out as a sound. Write `[low, gravelly voice]`, not `[gravelly]`. Keep SFX tags (`[applause]`, `[door creaking]`) out of narration; SFX are produced and mixed separately (`reference/elevenlabs-sfx.md`).
- **Stay inside the voice's range.** A calm narrator will not shout convincingly and a whispery voice will not boom. If a tag does nothing, change the voice or the tag; do not stack more tags.
- **Audit reused scripts:** tags that older models ignored can now fire. Search for stray brackets before generating.
- Example: `[warmly] Most teams lose hours every week… [curious] but what if that just — stopped? [excited] Meet Flow.`

### 10.4 Pacing, pauses and emphasis (no speed slider)
- Line breaks and short sentences = breaths. `…` = hesitation or short beat, `—` = quick beat, `[pause]` / `[long pause]` = a real gap (test with the chosen voice). Empty line = section break.
- **In a new script, «…» at most once per 15 s** (Eleven v4 stops 0.6–0.8 s on each one, measured 11-12) and **«،» for a breath.** The on-screen line may keep its «…».
- **The pace standard** (`reference/pace.md` P1–P3): the first word by 0.1 s; 1.9–2.4 words a second over the spoken span (the owner liked 2.35 and 2.38); true silence inside the speech at most 10%, one held beat of 0.5–0.8 s per 30 s, every other gap 0.35 s or less, and about 0.15 s of true silence kept at a sentence end (0.25 s at a paragraph turn) so the last consonant stays clear. v4 takes come out at 1.7–1.8 words a second and 28–35% silence: the pace is reached **after** the take by cutting silence (`voice_edit.py tighten`, §10e), **never by time-stretch**.
- CAPS on one word = emphasis (at most one per section). Exclamation marks lift energy without a tag.
- **Too fast** (users report v4 can read fast): shorter sentences, more commas or `…`, `[slowly]` before the line, or split a long sentence. Never speed or slow the narration in post (no `atempo`): it smears the voice. Regenerate the phrase instead.
- **Too theatrical** for a restrained read: raise Stability, remove emotion tags, write plainer sentences, or choose a calmer voice (some voices cannot be made monotone).

### 10.5 Pronunciation, numbers and Arabic
- **IPA:** v4 reads IPA wrapped in forward slashes inside the text: `Niamh /niːv/`. Include stress marks (ˈ ˌ), use it only on words that need it, and test with 2–3 takes. SSML phoneme tags do not apply to v4. Alias respelling ("NOH-shun") remains a fallback.
- **Write as spoken:** numbers, prices, dates, times, units, symbols, short forms like "Dr." and URLs ("forty-two dollars and fifty cents", "one hundred percent", "Doctor", "dot com"). Acronyms read letter by letter (SEO, GPT) are not spelled out: keep them in English capitals (see Arabic below). Text normalization is on by default but is the usual source of misreads.
- **Arabic:** write the script in Arabic, in the dialect you want spoken (the model takes the language from the text). Use a voice whose native accent is that dialect, such as a voice designed as a Saudi speaker for Saudi delivery: v4 keeps the source accent in the same language but switches to a native accent in other languages. Unvowelled Arabic is ambiguous for TTS, so when a word is misread, add tashkeel to that word only and regenerate. Write numbers as Arabic words. `language_code: "ar"` can enforce the language and its normalization.
  - **English acronyms and words inside an Arabic script** (the text sent to ElevenLabs only, not the on-screen captions): (1) acronyms read letter by letter (SEO, CEO, CES, GPT…) are always written in English capitals, never in Arabic letters («سيو» was read as "Co" instead of SEO). When an acronym is joined to a word, write the whole name in English with a space: `Chat GPT`. (2) English words and names read as ordinary words are written in Arabic letters as they are pronounced, because they sound better that way: «قوقل»، «كلود كود». (3) AI works either way: «إيه آي» or `AI`. Examples: «صاروا يسألون Chat GPT وقوقل إيه آي.» «عشان كذا جمعت لك دليل AI SEO.» «تحطّه في كلود كود.» «أو اكتب كلمة SEO، وأرسله لك على طول.»
  - **Words v4 reads by guess (verified fixes).** Unvowelled homographs can come out with the other meaning: «قطة» as a cat when the script meant an app called «قَطَة», «الربع» as "a quarter" instead of "the gang" («الرَبع»). Put the harakat on that word only. If the words around it still pull the wrong meaning, regenerate that phrase without `previous_text`/`next_text`.
  - **Never write «ريل» in a script: say «فيديو» or «فيديوهاتنا».** «ريل» comes out like «ريال» or "real", and no spelling fixed it reliably by ear («الريِل» and «الرِيل» both failed). A spelling the user gives is generated as written, and the user's ear beats any measurement. Harakat added for the voice never reach the screen.
  - **A keyword the viewer must type** goes in quotes: `علّق "قَطَة"`. The quotes add a short pause and lift the word, so it is heard as a word to type. End the sentence on the keyword when you can.
  - **Dialect spelling pulls a dialect read**, and Fusha spelling pulls Fusha: for Gulf delivery write «وإنت»، «شو»، «مب بس», not «وأنت»، «تسأل».
  - **Pauses you didn't plan:** an opening number word («ثنتين…») can leave a 0.3–0.4 s gap after it on some voices, and «…» adds 0.5–0.8 s (0.6–0.8 s on v4 in the 11-12 takes). Use them only where you want the pause.
  - **Timing estimate:** Gulf narration on v4 runs about 2.4 words a second, plus about 0.2 s per comma, 0.35 s per full stop or question mark and 0.5 s per «…». Budget the video's length on it, then measure the real take. The helper's `plan` uses it for Arabic text (`estimated_seconds`, with the count behind it in `estimate_basis`). Checked on sample scripts (2026-11-11): 30.2 s for a 52-word script whose takes ran 28–29 s, and 33.9 s for its 59-word version whose chosen take ran 32.9 s (the English rate had said 21.2 and 24.1 s). After `voice_edit.py tighten` a v4 take usually runs about 15% shorter (11-12: 32.8 → 27.8 s, 41.4 → 34.6 s, 39.1 → 33.4 s; a designed voice that paused little, 21.8 → 20.8 s). A designed voice can run 10–15% longer than the estimate and tighten less (the stores dry run of 11-12: 20.2 s estimated, 23.1 s delivered): tell the user the length as a range at Gate A, and set it from the first take.
  - **Fix with a new whole take, never a patch** (since 1.7; the owner's ear, 11-10, and the 11-12 dua): write the fix into the script (harakat on that word, a plainer word) and generate the whole narration again with the same voice and settings, 2–3 seeds; never splice a regenerated phrase into a take. A short chunk loses the context v4 reads by (alone, six words of a dua with full harakat came out «أحيانًا» for «أَحْيَانَا»; inside the whole narration all five takes read it right), and a spliced line sits at its own level («الفيلة» came out too quiet to hear).
  - **Check a fix by ear or by forced choice, not by transcript:** Whisper writes both readings of a homograph the same way. Listen, or score the two spellings against the take with Whisper in forced-choice mode (`scripts/check_quote.py --pair RIGHT/WRONG` does it on any take and text); for a single vowel, measure the formants.
  - **A quoted ayah, hadith or dua** is pasted from its source page, never typed from memory, and **generated inside the whole narration**: never as its own short chunk, never patched. **Every take is checked word by word** with `python -X utf8 "<skill>/scripts/check_quote.py" "<take>" --text <source.txt> --pair "<right>/<wrong>" [--auto-pairs] [--control <wrong.mp3>]`: the take's words against the source mark by mark, a Whisper read, and a forced choice on each word whose vowel changes its meaning, read against a **negative control** generated on purpose with the wrong vowel (a few credits, asked first; the script prints the exact words to generate). Measured 11-12: the chosen take +2.43 / +1.31 against the control's −4.35 / −3.71. **A control counts only when it reads wrong itself** (its own margin under 0): with a famous text v4 often says the known form whatever is written (the wisdom dry run of 11-12: controls at +9.3 and +6.8), and then the check says the control came out right and the word goes to the user's ear; never pay for a new take or the same control again for it. A control is the quote up to one word after the tested word, with the wrong vowel in it (the script prints the exact words; 25–45 credits each on 11-12): make it right after the first take's check, before any second take, and price every control in the plan at once. Then **only the user's ear clears it**: play the quoted lines and ask him to listen word by word before anything is posted. Recitation of the Quran is never under music or effects (§10.0).
  - **Whether to buy a second take of a quoted text** (since 2026-11-13; the wisdom rerun of 11-12 bought the plan's second take, 101 credits, after both controls came out right): when the first take's check passes (exit 0), clean or with words left to the ear because their controls came out right, the first take is the narration: buy no other, and price a second take in the plan only as «if the first has a fault». Buy one more whole take only for a fault: the check fails the take (a word differs from the source, or reads wrong against a control that read wrong), the user hears a word wrong, or the take cannot meet P1–P3 after `voice_edit.py tighten` (`--before` and `--keep` tried first). **A word left to the ear:** play its line, name the word and its right reading, and ask. Heard right: cleared, written in `LOG.md`. Heard wrong: the fix in the script (harakat on that word), one new whole take, checked again, no new control for that word. Not sure, or not now: an owed line; the video may be delivered, and nothing is posted before he has heard it right.

### 10.6 Length, chunking and continuity
- v4 accepts up to 10,000 characters per request. **Generate the whole narration in one request when it fits** (under ~800–900 characters, where ElevenLabs' troubleshooting guide says accent and quality are most consistent: a 30–60 s video); a longer one per paragraph. Never tiny fragments: v4 performs better with context, and a quoted text is never its own chunk (§10.5).
- Keep voice, model, Stability, Similarity and seed identical for every chunk of one video.
- **Continuity:** pass the previous chunk's `request-id` (response header) as `previous_request_ids` (max 3, no older than two hours; ElevenLabs says stitching is significantly more reliable on v4), or pass `previous_text` / `next_text`. Still listen across every seam.
- Splice only on a pause, trim leading and trailing silence, match the integrated loudness of all chunks before the mix, and use a short crossfade at the cut.

### 10.7 Voice from an attached recording
When the user attaches a voice recording:
1. **Ask once which case it is.** (a) **The narration itself**: his own recording, or one he has the right to use (a known sheikh's real recording, a speaker who agreed). Route 1 of §10.0: used as recorded and named; `align_voice.py` for the word times, `voice_edit.py tighten` for the pace (§10e); never re-voiced. (b) **A voice to make from it**: his own voice, or a voice he owns or has the speaker's permission to clone: Instant Voice Clone (IVC), route 2 of §10.0. Never clone without the user explicitly confirming the right and the speaker's consent (ElevenLabs requires this confirmation). If they cannot confirm, offer their own recording or a designed voice described from what they like in the sample (§10d), or getting permission. (c) **A voice he likes, as a model**: design a voice described from what he likes in it (§10d: dialect, age, pitch, pace, warmth) and let him pick by ear. (d) **An ElevenLabs library voice he names**: find it with the helper's `voices --search "<name>"` and use its `voice_id` with `--library-voice-named-by-user` (if a Voice Library voice does not appear in the results, the user adds it to My Voices in the ElevenLabs app first); never in Khaam's own videos.
2. **Check a recording locally** with ffprobe/ffmpeg or the helper's `clone` pre-check (nothing is uploaded). The narration itself: one speaker, no music under it (a recitation is never under music), no clipping; a noisy or echoing recording is recorded again rather than cleaned hard; the source and the speaker's name go in the project's LOG. A sample for a clone: 1–2 minutes of one speaker, no music, reverb or background noise, consistent tone and an energy that matches the target read (a flat sample gives a flat clone). Avoid more than ~3 minutes. MP3 at 128 kbps or higher (192 preferred; WAV does not improve clones). About −23 to −18 dB RMS with true peak ≤ −3 dB. v4 reproduces recording flaws (clipping, plosives, uneven EQ, volume jumps), so fix or replace a bad sample rather than blaming the model. ElevenLabs says a v4 IVC can work from ~10 s, but 1–2 minutes remains its recommendation.
3. Use `remove_background_noise` only when the sample really contains noise; on clean audio it can make the clone worse.
4. **Create the clone once** (helper `clone`, explicit approval; like `save`, it stops when the account has no free voice slot), then store `voice_id`, sample file name and SHA-256 in TASTE.md §6 and reuse it. Each clone made from the same audio sounds slightly different; keep the original samples. Accent and tone cannot be changed after creation, only by changing the samples. A voice cloned with an earlier version is used the same way (`generate` takes it as the user's own voice).
5. Professional Voice Clones must be retrained for v4 in the ElevenLabs app (My Voices → "+" next to Eleven v4). IVCs need no extra training step. ElevenLabs notes that designed voices can be less performative on v4 than on older models: direct them with plain-word tags and the pace written into the text (§10.3–10.4), and pick the preview whose natural read already fits.
6. **Approve the voice on a short preview** (Turbo, or a short v4 excerpt) before generating the whole script.

### 10.8 Interviews and multi-speaker dialogue
- Use Text to Dialogue with `model_id: eleven_v4` (set it explicitly). Up to 10 distinct voices per request; keep the total text at or under 2,000 characters per request (split longer interviews into exchanges and join them on pauses); give speakers clearly different voices.
- Tag each turn separately. End a cut-off line with a hyphen (`Is this seat-`) and start the interruption with `[jumping in]`; use `...` for a trailing or hesitant line.
- The with-timestamps response includes `voice_segments` (who speaks when); use them for cuts, split-screen switches and lower thirds.

### 10.9 Known problems and verified fixes
| Problem | Fix |
|---|---|
| Tag read aloud or turned into a sound | Describe the voice in plain words (`[low, gravelly voice]`); put the tag directly before its words; keep SFX tags out of VO. |
| Tag has no effect | The voice cannot perform it: choose a voice whose range includes it; try slightly lower Stability. |
| Inconsistent takes | Generate 2–3 takes per scene and pick the best; give more context; fix the seed. |
| Reads too fast | §10.4. Never speed up or slow down the take in post: regenerate with the pace written into the text. |
| Reads too slow, too many pauses (v4 takes: 1.7–1.8 words/s, 28–35% silence; P2–P3 not met) | Cut silence, never stretch: `python -X utf8 "<skill>/scripts/voice_edit.py" tighten --audio <take> --words <take>.words.json --hold "<word after the held beat>=0.6" --out-audio assets/vo/vo.wav` (§10e). Only true silence goes; each pause keeps its length by the script's punctuation; it prints P1–P3 after the cut. |
| `mp3_44100_192` returns HTTP 403 | The plan is Free or Starter: use `mp3_44100_128` (the helper's default since 1.5). Nothing was charged. |
| Word timestamps land late after a pause | ElevenLabs word starts after a pause can be 0.1–0.2 s late, and a word's end can swallow the pause: snap each word edge to the waveform's silence before timing captions and cues: `python "<skill>/scripts/voice_edit.py" snap --audio <take> --words <take>.words.json --out <take>.snapped.words.json` (in a 33 s take it moved 25 of 118 edges, by up to 0.49 s). Since 1.7 it also pulls in an end that swallowed a pause when breath or room tone hid it (a stretch quiet in the speech band and the full band, never a sibilant: 11-12, «الشموع» 16.80 → 16.55 s), and quiet is measured from the take itself; `tighten` snaps the same way. |
| `pause` says "There is no pause before …" on a take whose pause you can hear | Some designed voices keep their pauses only ~33 dB under the speech. Since 1.7 quiet is measured from the take (`--floor take`, the default) and the error says how deep the take's pauses are; `--floor <dB>` sets it by hand. |
| A pause is too short for the beat (one longer than 0.6 s before the relief) | `python "<skill>/scripts/voice_edit.py" pause --audio <take> --words <take>.words.json --before "<word>=0.5" --snap --out-audio … --out-words …`: silence inserted inside the existing pause, the speech untouched, every later word shifted by exactly that time. Never time-stretch. In a take you are tightening, the one held beat is set with `tighten --hold "<word>=0.6"` instead: lengthened with that gap's own silence, never digital zero. |
| A final consonant sounds clipped, or Whisper hears it wrong, after the cut («عذق» heard «عذك», 11-12) | The sentence-end floor did not hold there (a stop's closure counts as pause in P3, not as silence): `tighten --keep "<next word>=0.25"` leaves 0.25 s of true silence before that word. |
| A phrase sounds quieter than the rest | `python -X utf8 "<skill>/scripts/voice_edit.py" levels --audio assets/vo/vo.wav --words assets/vo/vo.words.json`: every sentence against the median (no phrase more than 3 dB under, the owner's ear, 11-10) and the `--gain "FIRST..LAST=DB"` for `tighten` that fixes it, ramped inside the pauses. A word too quiet to hear means a new whole take, not a gain. |
| A word is misread (wrong meaning) | §10.5: harakat on that word, and generate the whole narration again (2–3 seeds); never a spliced phrase. Check the new take by forced choice (`check_quote.py --pair RIGHT/WRONG`) and by ear. |
| A quoted ayah, hadith or dua misread («أَحْيَانَا» as «أحيانًا», 11-12) | Never patch it and never generate it alone: a new whole narration, checked word by word with `check_quote.py` against a negative control (§10.5); only the user's ear clears it. |
| Over-acting | Raise Stability, use fewer tags, choose a calmer voice. |
| Accent drift or wrong accent | Script in the target language; a voice designed (or recorded) in that dialect; ≤ ~900 characters per generation; accent tags only after testing. |
| Glitch, muffled patch or sharp breath between paragraphs | Regenerate that chunk; if it sits at a paragraph boundary, regenerate the paragraph before it. |
| Volume or mood jump at a seam | Request stitching with identical settings and seed; loudness-match chunks; splice on a pause. |
| A recorded voice noisy, echoing or uneven | Record again in a quiet room, the phone 20–30 cm from the mouth (§10c); match the loudness of the takes before the mix. |
| Clone noisy, harsh or unlike the speaker | Clean, consistent 1–2 minute sample; noise removal only for noisy audio; slightly lower Similarity; re-clone from better audio. |
| Name or brand mispronounced | IPA in slashes on that word, or an alias respelling; test 2–3 takes. |
| Numbers or dates misread | Write them as words. |
| Approved voice sounds different weeks later | Models are updated: keep the approved take, settings and seed, and re-audition before a new batch. |

### 10a. Writing the script (deliverable before any build)

**Length → word budget** (estimate for English; natural VO ≈ 2.3–2.6 words/s; leave ≈ 1.5 s at the end for logo/CTA hold; Arabic runs slower, so time an Arabic script with §10.5's estimate, as the helper's `plan` does). Rates vary by voice and language and v4 can read faster, so measure the first approved take and recalibrate:
| Video | Words (VO) | Lines |
|---|---|---|
| 15 s | 30–38 | 4–6 |
| 30 s | 65–75 | 8–12 |
| 45 s | 100–110 | 12–16 |
| 60 s | 135–150 | 16–22 |
| 90 s | 200–220 | 24–32 |
Count the words in the paste block (tags excluded) and state the estimate: `≈ 142 words ≈ 58 s at 2.45 w/s`.

**Writing rules**
- One idea per line; short sentences (≤ 14 words). Line breaks = natural breath pauses; `…` = hesitation; `—` = short beat. Empty line = longer pause between sections.
- Hook in the first line (≤ 3 s, ≤ 8 words). CTA = last line, word-for-word what appears on screen.
- Write numbers, units, symbols and URLs **as spoken**: "twenty-four seven", "three x faster", "dot com". No emojis, hashtags, markdown, bullets or stage directions in the paste block, and no SSML.
- Tags: only where the delivery changes, at most one per clause, matched to the voice's character (§10.3). CAPS on one word per section at most.
- Brand names and odd words: follow the acronym rule in §10.5 first (letter-by-letter acronyms in English capitals, names read as ordinary words in Arabic letters as spoken). If a word is still mispronounced after that, fall back to v4 IPA `/ˈnoʊʃən/` or an alias respelling ("Notion" → "NOH-shun"); list them under pronunciation notes.
- Keep on-screen keywords (for kinetic type) in a separate list, not in the paste block.
- Keep the script whole when it fits one request (§10.6; split a long one per paragraph) and save its exact text as UTF-8 in `plan/vo/vo.txt` (`plan/vo/<scene>.txt` per paragraph). «…» at most once per 15 s, «،» for a breath (§10.4).

**Deliver exactly this format:**
````
## VO script – <project> (v1)
Target: 60 s · ≈ 142 words ≈ 58 s (estimate; final timing comes from the audio)
Model: Eleven v4 (eleven_v4) · previews only: Eleven v4 Turbo (eleven_v4_turbo)
Voice: <the user's recording> | <a recording the user has the right to use: the speaker's name, where it comes from> | <the user's own voice made from his recording: IVC name + voice_id, assets/vo/voices/<name>.voice.json> | <designed voice name + voice_id, assets/vo/voices/<name>.voice.json (AI label on the post)> | <library voice the user named + voice_id>
Settings: Stability 0.5 · Similarity 0.75 · Seed <n> (Style and Speed do not exist on v4)
Language: <en | ar, dialect …> · Output: mp3_44100_128 (192 kbps and WAV need a higher plan than Starter)
Chunks: the whole narration ≈ 420 chars in one request (a long one: per paragraph) · takes: 2–3

--- PASTE INTO ELEVENLABS (copy everything between the lines) ---
[thoughtful] Nobody drew this.
Not one line… not one frame.

[curious] So where did it come from?
…
[warmly] Start yours today — link below.
--- END ---

On-screen keywords: NOBODY · DREW · THIS · …
Pronunciation notes: <word → /IPA/ or respelling>
Alt hook (variant B): …
````
Also give a **variant B** of the hook (and CTA if useful) so the user can A/B pick.

### 10b. Producing the narration
The script and the voice must be approved first. Approval for narration does not authorize voice cloning, SFX, music or other paid calls; each needs its own approval.

**Route A: API helper (default when a key is set up: `key_setup.py --check` says present).** Run from the project folder with the selected Python:
1. Offline check, no network: `python "<skill>/scripts/gen_tts_elevenlabs.py" plan --text-file plan/vo/scene01.txt` (characters, words, tags, estimate (the Gulf rate of §10.5 for Arabic text, the English rate otherwise), SSML/digit/bracket warnings, key configured yes/no).
2. Free checks when needed: `... account` (plan, credits left, reset date, voice slots used and free), `... models` (v4 availability, limits, Arabic) and `... voices --search "<name>"`.
3. **No voice yet for this user:** design one (§10d) or make his own from his recording (§10.7) first, then come back here.
4. Ask the user to approve: model, voice, characters per chunk and in total, takes per chunk, and the credit budget. Use Turbo only for a short preview.
4. One paid request per invocation, no automatic retries, never overwrites:
   `python "<skill>/scripts/gen_tts_elevenlabs.py" generate --allow-paid-request --voice-id <id> --text-file plan/vo/scene01.txt --output "assets/vo/scene01 take1.mp3" [--seed 1234] [--stability 0.45] [--previous-request-id <id>] [--language-code ar]`
   Interviews: `... dialogue --allow-paid-request --inputs-file plan/vo/interview01.json --output "assets/vo/interview01 take1.mp3"` with `[{"voice_id": "...", "text": "..."}, ...]`.
   **Never pay twice for the same narration (since 1.7.0 of 11-12):** `generate` looks in the take's `vo` folder for sidecars of the same text and voice. With one there, it refuses and names them (they were paid for, and after a cut chat they are the narration the user approved). A second approved take of the same text, or one more the user asked for after hearing them, takes `--another-take` and a new `--seed`; the same seed is always refused.
   Clone from a sample (after the confirmations in §10.7): `... clone --allow-voice-clone --confirm-rights-and-consent --name "<voice name>" --sample "assets/vo/voices/<sample>.mp3"`; without the flags it only runs the local sample check.
5. Each take writes the audio, a `.json` provenance sidecar (model, voice, settings, seed, request-id, reported character cost, SHA-256, exact text) and `.words.json` word timings from ElevenLabs' alignment with tags removed. Then the pace (`voice_edit.py tighten`, which reads the sidecar's text for the punctuation) and the picture from the words (`cues.py beats`, or `cues.py build` with `plan/cues.json`): §10e. Still transcribe and diff when the read deviates, or when IPA or numbers are involved; a quoted text is checked with `check_quote.py` (§10.5).
6. Listen to every take in full (no spoken tags, pronunciation, seams, no clipping) before calling it approved.

**Route B: manual, in the ElevenLabs app.** The user opens elevenlabs.io → Text to Speech → model **Eleven v4** → the approved voice → Stability/Similarity as in the script header → pastes the block → generates 2–3 takes → downloads the best as MP3 (or WAV) → drags it into the chat; Claude saves it as `assets/vo/vo_v1.mp3` and times it with `align_voice.py` (§10c), because a file from the app has no word timings. If one line sounds wrong, the user writes the fix into the script and generates the whole narration again with the same settings, then drags in the new take: never a spliced line (§10.5).

Don't edit the text after approval without telling the user (timing and captions come from it).

### 10c. The user's own recording → word timings (`scripts/align_voice.py`)
1. **The recording:** a quiet room, the phone 20–30 cm from the mouth, one take per paragraph is fine. The user drags the files into the chat; Claude saves them in `assets/vo/` (any of wav, mp3, m4a, ogg). The script file holds **exactly what was said**: if they changed a word while reading, change it in the file (ask them, or listen to the transcript the tool prints).
2. **Once per computer:** `python "<skill>/scripts/align_voice.py" plan` (offline) says whether the tool is ready and what a setup would download. Ask with its `ask_user` line, then `setup --yes`: a private environment in `~/.cache/khaam-motion/align-env` with faster-whisper 1.2.1 (MIT) and PyAV 17.1.0 (89 MB from PyPI, about 290 MB on disk), and the "small" Whisper model (MIT, 486 MB, pinned and SHA-256 checked). About 3 minutes on a fast connection. The user's own Python is not changed. Nothing is uploaded, ever.
3. **Each take:** `python "<skill>/scripts/align_voice.py" align --audio "assets/vo/take1.m4a" --script plan/vo/scene01.txt` writes `assets/vo/take1.words.json`, the same format the ElevenLabs helper writes. On the CPU it takes about a third to a half of the recording's length on a fast desktop, and up to about 1.5× on a slower laptop (estimate). Since 1.7 it uses an NVIDIA GPU first when its CUDA libraries are there (16.5 s of narration in 14.5 s with the model load, 11-12), and falls back to the CPU by itself; `plan` says which, and `setup --yes --gpu` adds the CUDA libraries (about 1.25 GB, optional, asked first). When the CPU runs out of memory (it did on a busy PC on 11-12), close heavy apps and run it once more with `--threads 2`; do not loop.
4. **Read its summary:** `words_estimated` lists words it could not hear clearly (their times are shared out between neighbours). Under 85% heard means the script and the recording differ: fix the script, not the timings.
5. **Accuracy measured (2026-11-11):** on recordings with exactly known word times, 93–100% of word starts within 0.1 s (median 9–21 ms), including a copy with room echo, noise and phone compression; on natural Gulf narration against ElevenLabs' own timings, 61–77% within 0.1 s (median 60–80 ms). Harakat in the script make no difference. Good enough for captions, the word-lit block and cues; a cue that must hit a consonant exactly can take `+0.05`.
6. Then `scripts/cues.py` as for any narration.

### 10d. Voice Design: a voice made for this user
ElevenLabs calls it **Voice Design** (checked on its docs 2026-11-11): a description in, three previews out, and the one the user picks is saved to their account. It is included on every plan, Free too; saving a voice takes one **voice slot** (Free 3, Starter 10, Creator 30, Pro 160 on its pricing page, 2026-11-11).

**What it costs.** ElevenLabs publishes no credits-per-character rate for Voice Design or for Eleven v4, so budget on these and read the real cost after each call:
- **Design:** billed by the characters of the preview text, once for the three previews (ElevenLabs help center, 2026-11-11). *Measured* 2026-11-11 on a Creator plan (`ttv-v2`): three previews of a 175-character text cost **175 credits**, one a character. That design response carried no `character-cost` or `request-id` header (its API reference lists none), so `design.json` then records `estimated_character_cost` (the preview's characters, marked as an estimate); the account showed the charge only a few minutes later (`account`).
- **Save:** free. *Measured* the same day: voice slots 7 → 8, 0 credits; the saved `voice_id` is the chosen preview's `generated_voice_id`.
- **Narration on Eleven v4 (`generate`):** *measured* 2026-11-11 on a Creator plan: 23 credits for 52 characters, 133 for 302, 149 for 339, **about 0.44 credits a character**; each take's `.json` holds the cost ElevenLabs reported (`reported_character_cost`), and it matched the account's change every time. *Published* (pricing pages, 2026-11-11): Starter 30k credits a month and 75,000 Eleven v4 characters included, Creator 121k credits and 275,000 v4 characters; the ratio of the two is about 0.4 a character on Starter and 0.44 on Creator, the figure we measured.
1. **Write the description** in English or Arabic, 20–1000 characters, in this order (ElevenLabs' own guidance): `Native Arabic, <dialect: Saudi Najdi / Hijazi / Emirati / Kuwaiti …>. <Male/Female>, <age range>. <quality: studio-clear>.` then a persona and two sentences on timbre, pace and delivery. Be exact about the accent ("thick", not "strong"); never write "foreign"; no sound words (reverb, echo, phone, tape). What worked for Gulf male voices in our tests: "mid-low pitch, slightly husky, relaxed, long connected phrases"; "excited / fast-talking" raised the pitch instead of the pace.
2. **Write the preview text** in the dialect the voice will speak, 150–300 characters (100 minimum, 1000 maximum; longer previews give steadier voices), ideally a line from the real script.
3. **Plan it offline:** `python "<skill>/scripts/gen_tts_elevenlabs.py" plan --description-file plan/vo/voice.txt --text-file plan/vo/preview.txt` (characters, estimated credits, description warnings). Show the user the description, the preview text and the credits, and ask.
4. **On a yes:** `... design --allow-paid-request --description-file plan/vo/voice.txt --text-file plan/vo/preview.txt --output-dir "assets/vo/voices/design 1"` → `preview 1.mp3`, `preview 2.mp3`, `preview 3.mp3` and `design.json` (the cost ElevenLabs reported, or, when it sends none, `estimated_character_cost` with a note; `account` a few minutes later shows the real charge). Designer model `ttv-v2` (`eleven_multilingual_ttv_v2`, the default: it kept the script's words and a natural pitch in our Arabic tests) or `--designer ttv-v3` (`eleven_ttv_v3`: cleaner, more dialect of its own, voices ran higher).
5. **The user listens** to the three (open the folder for them) and picks one, or asks for another round with a changed description (each round is a new paid call; ask again).
6. **Save it:** `... save --allow-voice-slot --generated-voice-id <from design.json> --name "<name>" --design-record "assets/vo/voices/design 1/design.json"`. It checks for a free slot first (free GET) and stops if the account is full: the user frees one in the ElevenLabs app (My Voices). The record `assets/vo/voices/<name>.voice.json` holds the `voice_id`; write it in TASTE.md §6 and `~/.cache/khaam-motion/user-taste.md` so every later video reuses it.
7. **Approve it on a short v4 line** (a few credits), then narrate with `generate --voice-id <id>` (§10b). Keep a recording of the approved preview with the record: ElevenLabs updates models, and a voice can drift.

### 10e. Narration first, step by step (the pace standard)
This is how the narrated samples of 2026-11-12 were made, the ones the owner called excellent for «سرعة الكلام» and «التوجيه المباشر». The numbers are `reference/pace.md` P1–P3.
1. **The script** (§10a). One idea a line, short sentences. **«…» at most once per 15 s** (v4 stops 0.6–0.8 s on each), **«،» for a breath**, «.» to end a thought, an empty line at a turn. Decide the **one held beat** (0.5–0.8 s per 30 s): usually the pause before the line that turns the story. A quoted ayah, hadith or dua is pasted from its source page into the script, never typed from memory, with the lines around it.
2. **The voice** (§10.0): the user's choice: a recorded voice, his own voice made from his recording, or a voice designed for him.
3. **Whole takes, never patches.** Generate the whole narration in one request (§10.6), 2–3 seeds with the same settings, and keep the best whole take. A fault is fixed in the script and by a new whole take, never by splicing a phrase (§10.5). With a quoted text, one take first: check it (step 4), and buy another only for a fault (§10.5, «Whether to buy a second take of a quoted text»).
4. **A quoted text: check every take** with `check_quote.py` (§10.5): the text against the source, a Whisper read, a forced choice on each word whose vowel changes its meaning against a negative control. **Only the user's ear clears it.**
5. **Tighten: cut silence, never stretch.**
   `python -X utf8 "<skill>/scripts/voice_edit.py" tighten --audio "assets/vo/<take>.mp3" --words "assets/vo/<take>.words.json" --hold "<word after the held beat>=0.6" --out-audio assets/vo/vo.wav`
   It writes `vo.wav`, `vo.words.json` (the word times rebuilt) and `vo.tighten.json` (every cut against the word boundaries). It removes only true silence (the speech band and the full band 30 dB under the voice, in runs of 0.12 s or more, 20 ms from where the silence ends, one 10 ms crossfade per cut) and keeps each pause by the script's punctuation (read from `--script`, or from the take's own `.json`): «…» 0.55 s when it is the held beat, else as a stop; «.» «؟» 0.24 s; «،» «:» or a line end 0.16 s; no mark 0.12 s; and at least 0.15 s of true silence at a sentence end, 0.25 s at a paragraph turn. It also trims the silence before the first word to 0.05 s (P1). Then it prints P1–P3 after the cut; a MISS says what to change (`--hold`, `--before "<word>=0.3"`, `--keep "<word>=0.25"`, `--stop 0.3`). Measured on three 11-12 takes: 32.8 → 27.8 s (2.14 words/s), 41.4 → 34.6 s (2.25), 21.8 → 20.8 s (2.31); every word sample for sample the same as in the take. A recorded voice goes through the same step.
6. **Levels.** `python -X utf8 "<skill>/scripts/voice_edit.py" levels --audio assets/vo/vo.wav --words assets/vo/vo.words.json`: no sentence more than 3 dB under the median. It prints the `--gain "FIRST..LAST=DB"` to add to step 5 (run `tighten` again from the take, with it). A word too quiet to hear means a new whole take.
7. **The picture from the words.** Every beat is a rule over the take's words in `plan/beats.txt`, e.g.
   ```
   card     = start(<first word of the quote>) - 0.3 .. end(<its last word>) + 0.7
   close    = start(<first word of the closing line>)
   door     = max(close - 0.05, end(card) + 0.55)
   duration = voice_end + 2.2
   ```
   then `python "<skill>/scripts/cues.py" beats --words assets/vo/vo.words.json --rules plan/beats.txt --out timing.js` (a canvas project: `--out plan/beats.json`). In the scenes, `cue("card")` and `cue("card:end")`. When the take changes, run it again: every scene moves with the voice. (On 11-12 it gave the same beats as sample 1's own hand-written build script, to the millisecond.)
   **Nothing changes under the card** (2026-11-13): `card` to `card:end` is its whole span, its 0.6 s fade in and fade out inside it. The place under it is in before `card` (its cross-fade over by then), and the next place starts at `card:end` or later, as `door` above. The scene kit keeps this for you (`verified-card.html` tells it the card's span: a place change that would run into the card is moved off it, and stars near the card's box go out while it is up; the console says each move), but time the beats right anyway: in the wisdom rerun of 11-12 a room 0.3 s after the quote showed its man through the fading card, and the lane's man showed through it coming in.
8. **Listen to the whole file** (the numbers stand in for nothing the ear hears), then the sound (`reference/film-sound.md`) with `assets/vo/vo.wav` as the voice, and the quoted text's span in `scripture`.

### Sources checked (2026-11-11, voice design and plans)
- ElevenLabs docs: Voices overview · Voice Design product guide (description format, preview text, three previews, saving takes a slot) · API reference: Design a voice (`POST /v1/text-to-voice/design`, models `eleven_multilingual_ttv_v2` default and `eleven_ttv_v3`, preview text 100–1000 characters) · Create a voice (`POST /v1/text-to-voice`) · Get user subscription (`voice_slots_used`, `voice_limit`, `character_count`, `character_limit`) · Models overview · Help center: How much does Voice Design cost? (billed by preview characters).
- elevenlabs.io/pricing (plans, credits, custom voice slots 3 / 10 / 30 / 160 / 660 / 2,200; Voice Design listed on Free) · elevenlabs.io/pricing/api (Eleven v4 characters per plan).
- Re-checked 2026-11-11 for the costs in §10d: elevenlabs.io/pricing (Starter $6 a month, 30k credits; Creator $22, 121k credits; no per-model credit rate for v4) · elevenlabs.io/pricing/api (Eleven v4 $0.08 and v4 Turbo $0.04 per 1,000 characters; Creator "275k characters of TTS (v4) included", Starter 75,000) · docs: API reference Introduction (the `character-cost`, `request-id` and `x-trace-id` response headers, shown on text to speech) · Design a voice (`POST /v1/text-to-voice/design`: no response headers listed) · Help center: How much does Voice Design cost? (billed by the preview text's characters; no rate given).
- Measured 2026-11-11 (a Creator plan, the account read before and after each paid step): design, save and v4 narration as in §10d.

### Sources checked (2026-10-18)
- ElevenLabs docs: Models · Eleven v4 overview · Text to Speech best practices · Troubleshooting · Instant Voice Cloning · Request stitching · Text to Dialogue · API reference (create speech with timestamps, create dialogue with timestamps, create IVC voice, list models, list voices) · Help center: audio tags with v3 and v4.
- ElevenLabs blog: Eleven v4 launch post · Audio tags list for Eleven v4.
- Reported experience (secondary): eesel.ai "Eleven v4 explained" (user reports of fast reads, theatrical delivery, accent bleed) · raxxo.shop (tags that now fire, seams) · morphic.com v4 prompt guide (Turbo drafts, multiple takes) · layer3labs.io (stability range).
- Arabic diacritics and TTS ambiguity: Communications of the ACM, "Unlocking the Potential of Arabic Voice Generation Technologies".
