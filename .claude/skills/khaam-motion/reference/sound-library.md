<!-- Khaam Motion · reference file, loaded on demand from SKILL.md. The free Khaam sound library: install, choose, place, mix. -->
# The Khaam sound library (new in 1.5)

A free library of **1,409 sound effects** that the skill builds on the user's own computer, plus the mix rules Khaam uses in its own videos. It is the first place to look for motion and interface sounds, after the user's own sounds.

**Since 1.7 the default sound of every video is the film sound in `reference/film-sound.md`:** since sound v2 (2026-11-12) three to five real recordings of the things shown (`sounds/library/`, CC0, shipped with the skill) and a real bed of the place or none, mixed and checked by `scripts/sound_mix.py` and `scripts/check_mix.py`; the code-made beds and effects are sketches only. This library adds designed moves (whooshes, risers) and the sounds of **pictures of interfaces**; its interface packs are never the sound of a reflective, religious or story video.

**Not installed yet? Nothing waits for it.** The real recordings in `sounds/library/` ship with the skill, so the first video already has its whole sound with no download and no licence (the mixer and the check need only NumPy and SciPy in the Python that runs them: preflight's `packages_in_current_python`). Offer the library after the first video, as before. A style that names a uisfx pack uses the shipped `button-click` on its interface moments until the library is in. (Until sound v2, beds and material effects were made by code here; they are sketches now.)

## What it holds
| Folder | Source | Licence | What it is |
|---|---|---|---|
| `earshot/<role>/` | Earshot 0.4.0 sound bank (https://github.com/Leonxlnx/earshot), **rendered on this computer** | the user's own renders (Earshot's code is MIT) | 473 designed motion sounds, two takes each (`01`, `02`), in folders named by role: `pop`, `click`, `click tap`, `whoosh fast`, `whoosh big`, `impact`, `impact cut hit`, `riser`, `sub drop`, `chime notification`, `camera shutter`, `typing key`… |
| `uisfx/sounds/<pack>/<cue>.mp3` | uisfx 0.4.0 (https://github.com/romainsimon/uisfx) | CC0 | 936 interface sounds: 12 packs (`minimal`, `soft`, `glass`, `studio`, `organic`, `mechanical`, `dreamy`, `scifi`, `rubber`, `arcade`, `cinematic`, `zen`) × 78 cues (`success`, `error`, `notification`, `toggle`, `send`, `add-to-cart`, `unlock`…). `uisfx/manifest.json` describes each pack (`description`, `bestFor`) and each cue |
| `catalog.json` | written by the installer | | every file with its source, licence and SHA-256, in the skill's own catalog format (`reference/sfx-catalog-format.md`) |

Both are fine in personal, business and client videos, with no credit needed. This library is not in the skill's ZIP (only the 33 CC0 recordings of `sounds/library/` are): the installer builds it from the official sources, and every download must match a fixed hash.

## Install (ask once; never without a yes)
- Where: `~/.cache/khaam-motion/sfx/` (the library) and `~/.cache/khaam-motion/earshot-venv/` (a small Python environment with numpy, scipy, soundfile, numba and Earshot; no torch, no AI models). Never inside the skill folder.
- Cost: about 530 MB on disk and 5–10 minutes (most of it is downloading the Python packages). No account, no key, nothing paid, and no audio leaves the computer.
- Command (Python 3.10+; use `python3` or `py -3.11` if `python` is older):
  ```
  python -I "<skill>/scripts/install_sounds.py" all
  ```
  It prints its progress. If it stops with "does not match its published hash", tell the user and stop: never work around a hash check. On any other failure, fix the cause and rerun only that step (`setup`, `earshot`, `uisfx` or `catalog`).
- Check: `python "<skill>/scripts/preflight.py"` shows `"khaam_sound_library": {"installed": true, "sounds": 1409}`, and from then on `sfx_library` points to the library by default (a project's `.khaam/config.json` or `KHAAM_SFX_LIBRARY` can still point elsewhere). `python "<skill>/scripts/verify_sfx.py"` re-checks every file's hash.
- A user who installed the 1.4 sound add-on from Khaam's site already has this exact library (same script, same paths): nothing to redo.
- The two halves install apart. If the Earshot step cannot run on this computer (a security tool may block freshly downloaded code: then stop, don't work around it), install the interface half alone: `install_sounds.py uisfx`, then `install_sounds.py catalog` (936 CC0 sounds, about a minute). Tell the user the designed-move half is missing; the material palette covers most of it.
- Record the answer in `~/.cache/khaam-motion/onboarding.json` as `"sounds_choice": "yes|no|later"` so it is offered only once.

## Choose: sources for each moment, in this order
0. **Real recordings of the things shown, and a real bed of the place or none** (`sounds/library/`, `reference/film-sound.md`).
1. The user's own licensed sounds (project `assets/sfx`, or their catalog).
2. **Sketches only since sound v2, never in a delivered video:** the picture's material, made by code (`scripts/material_sfx.py`): paper and ink, cloth, wood and cardboard, water, light, stone and ceramic, earth and plants, weather.
3. This library:
   - **Designed moves** (whoosh, swipe, riser, impact) and, **on pictures of interfaces only**, pop, click, tap, chime, camera shutter, typing: `earshot/<role>/`. Designed sounds whose hit lands exactly on the frame. Alternate takes `01` and `02` so repeats don't sound copied.
   - **App events, on pictures of interfaces only** (success, error, notification, toggle, send, add-to-cart, unlock…): `uisfx`. Use **one pack per video**, so the video has one sound personality.
4. **Real objects and recorded beds** (coins, a door, a crowd, birds that matter, waves): real recordings through `scripts/openverse_sfx.py` (`reference/free-sfx-openverse.md`), CC0 first. Designed sounds win for interface motion; recordings win for real things.
5. ElevenLabs sound effects (`reference/elevenlabs-sfx.md`) only after the user approves the cost.
6. Procedural layers (`scripts/procedural_sfx.py`) for simple ticks or when nothing else fits (an abstract interface moment; never the sound of a thing on screen).

## Place
- Sound the moments that matter (three to five per video, never more than five in ten seconds), each on its exact frame, taken from the project's own timing data (the narration's cues from `scripts/cues.py`, or `plan/beats.json` in a canvas project), not placed by ear. Everything else rides on the bed. Formula and anchors: `reference/local-sound-workflow.md`.
- Place a fast hit by its attack (the moment it first comes within 6 dB of its peak); place a whoosh or a riser so its peak lands on the cut or the arrival.
- Fit a sound to its moment by rendering it again: `<venv python> -m earshot sfx render <id> -o out.wav --dur <seconds> --apex <seconds to the peak> --pitch <note>`, where `<venv python>` is `~/.cache/khaam-motion/earshot-venv/Scripts/python.exe` on Windows or `…/bin/python` elsewhere. The ids come from `-m earshot sfx list`.
- Not a sound on every frame: heavy hits on at most a third of the cuts, and never 5 identical sounds in a row.
- In a short pause between two words, put a short hit in the middle of the pause. A hit longer than its pause runs into the next word: shorten it or move it.

## Mix (since 1.7: the film mix in `reference/film-sound.md`, built by `scripts/sound_mix.py`)
- Between words, the effects are clear and up front; while a word is spoken, duck them so the voice stays on top. The film mix sets this by itself (`reference/film-sound.md`): effects about 12 dB under the voice, ducked 6 dB more under every spoken word.
- No hit in the first 50 ms of a word. Check speech in 200 ms windows where the voice speaks at least half the time, plus 50 ms windows at word onsets; whole-mix loudness doesn't show masking.
- Keep effects off a number or a key phrase the viewer must catch: put one hit in the pause before it, nothing under it.
- A silent opening (before any voice) needs louder effects: about 6 dB under the narration's level.
- Since sound v2 a bed is a real recording of the place, its loudest moment 20 dB under the voice, or there is no bed (`reference/film-sound.md` rule 3); under a narrator no bed is fine. (Retired: 1.7.0's "a code-made bed runs under everything", heard as «تشويش».) Keep the voice take itself clean: a compressor's make-up gain lifts the take's own noise floor in the pauses; the bed is the floor.
- Phone speakers lose the lows: a sound with almost no energy above 300 Hz (a boom, a sub drop) gets a higher layer on top (a click or a tick). Measure it before relying on a low sound.
- With a voice, master to −14 LUFS integrated, true peak under −1 dBTP. With no voice there is no integrated target: the strongest effect at −24 LUFS in its loudest 400 ms, nothing over −22, a bed at −34 loudest with any static floor at −56 (`reference/film-sound.md` rule 8; sound v2, 2026-11-12). `scripts/sound_mix.py` does both: with a voice, one gain and true-peak limiting on the effects only (at −2 dBTP, so the AAC encode stays under −1), so the bed and the voice never pump; with no voice, each effect set by its own loudness and never limited. Two-pass `loudnorm` can silently fall back to dynamic mode and lift the noise in the pauses; if you use it, read `normalization_type` in its second-pass output and reject `dynamic`.
- Run `scripts/check_mix.py` on the mix and again on the rendered video before the user hears it. It fails loudly and says what to change.
- Effects files you write yourself: 16-bit or 24-bit PCM WAV, never float, unless your mixer reads float.
- Prove clarity, don't assume it: when Whisper is available, transcribe the voice alone and the final mix and compare each word's confidence.

## Limits
- This light install renders sounds only. Earshot's AI "ears" (describe, rank, critique) need torch and about 1.1 GB of models: install them only if the user asks. Never run `earshot llm`: it sends audio to an outside AI service.
- Tools measure; they don't hear. Say what was measured and what was listened to.
- Record each video's sound recipe in its `TASTE.md` §5: the bed(s) and seeds, the effects and their material, the key, the uisfx pack if an interface was shown, music yes or no, the check's numbers.
