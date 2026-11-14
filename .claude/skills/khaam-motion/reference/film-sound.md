<!-- Khaam Motion · reference file, loaded on demand from SKILL.md. The default sound of every video: real sounds of what is shown, few, low; a real bed of the place or none; the check. -->
# Film sound: real sounds, few and low (new in 1.7; sound v2 since 2026-11-12)

A video should sound like a film, not like a phone being tapped. Measured on Khaam's own first samples: 39–63% of each video was digital silence, about twelve interface chimes played in eleven seconds, one sat 5 dB under the feed. The religious and reflective videos that do well today sound the other way: a narrator at −14 LUFS with everything else well under the voice, a few sounds of the things on screen, no music.

**Corrected 2026-11-12, after the first listen.** The first version of this file said "everything at −14 LUFS", and the mixer pushed videos with no voice up to −14. In the references −14 is the narrator's level, not the effects': with nobody speaking, only the effects can carry −14, so each one played as loud as speech or louder. The owner heard all three such samples as far too loud. A video with no voice has no loudness target since then.

**Corrected again the same day (sound v2), after the second listen.** He heard «تشويش» under all three re-mixes, a written «؟» that sounded «زي صوت الذبانة» (he asked for chalk), and a candle that sounded like a crack. Measured: the «تشويش» was the code-made bed (`sound_beds.py`), a noise floor that held within 0.2–0.4 dB in every 5 s window; the fly was the code-made `ink.stroke`, a noise under a 70–140 Hz wobble, which is a wing beat; the crack was the code-made `fire.wick`. So: **every sound a viewer can tie to something on screen is a real recording of that thing**, the bed is a real recording of the place with sparse events kept very low, or there is no bed, and everything sits lower than before. The six «مسار خام» samples were rebuilt this way and he judged them excellent; this file is that sound, made the default.

## The rule (every video, unless the user asks otherwise)
1. **Real sounds only.** Every effect is a real recording of the thing shown (`sounds/library/`, 30 effects and 3 beds, CC0, listed in its `MANIFEST.md`; or a CC0 recording found through Openverse, below), placed on the frame where it happens. Nothing code-made for a thing on screen: a written «؟» is chalk (`chalk-short`), a candle lit with a match is a match (`match-strike-and-light`), a candle lit from another flame is a flame catching (`match-ignite-flare`). **Light makes no sound:** a window lighting, a glow, a sunrise get none (dawn gets its birds). A camera move gets none. The code-made sounds (`material_sfx.py`, `sound_beds.py`) are sketches: the mixer takes them only in a plan marked `"sketch": true`, and the check then fails it as not final.
2. **Three to five effects that belong to the picture**, on the moments that matter: the hook landing, the turn, the payoff, the call to action. No more than five in any ten seconds. Not one sound per visual event. More motion never means more sounds. Never repeat one recording at an exact interval (three copies of one footstep buzz like a fly: use a recording of several steps).
3. **The bed: a real recording of the place, or nothing.** A place with a sound of its own gets a recording of it with **sparse, recognisable events** (crickets that pause, a far dog, one bird at a time, a rooster): `amb-night-crickets`, `amb-night-far-dog`, `amb-dawn-birds`. Two beds may crossfade when the place or the time changes (night → dawn). A place with no sound of its own (a page, a studio shot of a product, a dark room, a shop with no clean recording) gets **no bed**: the effects' own tails are the floor, and under a narrator nothing is fine. Dense ambiences (rain, wind, sea, a full chorus) only when the picture shows them, marked `"shown": "rain"` in the plan. Never a room tone, never a code-made bed.
4. **Interface sounds only on an interface** (a phone screen, an app, a button being pressed): `button-click`, or the `ui.*` sounds on a picture marked `interface`. Never «success / receive / notification» on a reflective video.
5. **No music unless the user asks** for it. Never music under quoted scripture.
6. **Quoted scripture is kept clear:** no effect from 0.5 s before a quoted ayah, hadith or dua until 0.5 s after it; a bed may run under it, nothing else. (The verified-text card's own rules still apply: the text whole and still, its source under it.)
7. **A voice is always on top:** the voice at −14 LUFS; effects 12 dB under it, ducked 6 dB more under every spoken word; a bed's loudest 400 ms 20 dB under it. The mixer prepares the take first: a 70 Hz high-pass, its loudest syllables levelled 4:1 (at most 10 dB), then its own peak limiter. **With a voice, put each effect in a pause or on the held beat:** under continuous speech an effect is either not heard or in the way. A pause shorter than 0.8 s does not clear an effect (every 400 ms there still holds a word): lower it 3–5 dB instead. **The held beat (0.5–0.8 s) is such a pause:** `check_mix.py` hears the last word's tail in it as speech, so start the effect at least 0.05 s after that word ends, cut it to the beat (`"cut"`), and set it about −6 dB from the start (a blind test of 11-12 placed a pen ring there as told: it failed «voice on top» at 2.8 dB and passed at 8.9 dB only at −6.5 dB). The duck also takes most of a 0.25–0.32 s breath, so an effect set in a breath may need +3 to +6 dB of `gain_db` to sit 12 dB under the voice there.
8. **Levels (khaam_sound.FILM_SOUND).** With a voice: −14 LUFS integrated, the rest as in rule 7, bed and effects together at most −28 LUFS in 2–6 kHz. With no voice: the strongest effect's loudest 400 ms at **−24 LUFS**, the others under it by their `gain_db`, each one's top at least −34 (heard on a phone), **the loudest moment at most −22**, the 2–6 kHz band at most −28 (the mixer turns any effect whose band passes −29 down to it), through a phone speaker at most −22, a sound held near its top for more than 1.2 s topping out at −27, and **no integrated target** (it comes out around −34 to −28; over −24 fails). A bed: its loudest 400 ms at −34 (with a voice, 20 dB under it), and any static floor in it at −56; the mixer sets both. True peak under −1 dBTP either way.
9. **The check passes before the user hears the video** (`scripts/check_mix.py`, and `scripts/check_pace.py` for the picture and the narration's pace, `reference/pace.md`). It is Claude's internal QA, never a review round.
10. **No rising whine, no buzz, no static.** A sound whose pitch climbs while it swells into 2.5 kHz and above reads as an insect flying at the ear; a sound modulated at 60–300 Hz reads as a fly; a floor that holds still between the sounds reads as «تشويش». The check measures all three. Real recordings of the thing shown pass them by nature: every file in the library measures 3–13.4 dB of buzz (a fly is 15 and up).

Tell the user in one line what the sound is, e.g. «الصوت: أصوات حقيقية بس: طباشير على «؟»، وعود ثقاب للشمعة، وليل فيه صراصير بعيدة تحت أول لقطتين، بدون موسيقى، والصوت المعلّق على −14. فحصته بالأرقام، والحكم الأخير لأذنك.» With no voice: «…وكل مؤثر أهدى من صوت الكلام بـ١٠ ديسيبل أو أكثر…».

## Choose the bed
| The place | Bed (`"lib"`) | Notes |
|---|---|---|
| a night outside, a village, a roof | `amb-night-crickets` | crickets only, sparse; set by its loudest 400 ms |
| a rural night with life in it | `amb-night-far-dog` | crickets and far dogs |
| dawn, first light, a morning outside | `amb-dawn-birds` | a dense chorus: the mixer sets it by its floor (−56), so it sits very low |
| a page, a desk, a product on a plain ground, a dark room, a shop | none: `"bed": []` | the effects' own tails are the floor |
| rain, wind, the sea, a crowd, a street | a CC0 recording found through Openverse (below), only when the picture shows it, `"shown"` in the plan | at least 20 dB under the voice |
One bed, or two crossfading when the picture changes place or time (overlap their spans by 1–2 s; `"offset"` starts a recording later in the file). A recording shorter than its span is looped with 1 s crossfades. `sound_mix.py --library` lists what ships with the skill.

## Choose the effects (`sounds/library/MANIFEST.md`)
| On screen | `"lib"` |
|---|---|
| writing: a «؟», a circle, a line on paper or a board | `chalk-short`, `chalk-stroke`, `chalk-writing` (he asked for chalk); `pencil-strokes` (its first half only, `"cut": [0, 0.5]`: its last loud stroke climbs and `check_mix.py` fails it as a whine), `pen-underline`, `pen-signature` |
| a candle lit with a match | `match-strike-and-light` (the strike, the flare, the small flame) |
| a candle or a lamp lit from another flame | `match-ignite-flare` (the flare, no strike) |
| a door, steps outside, someone sitting up on a bed | `door-creak`, `footsteps-sand`, `sit-on-bed` |
| dawn in a village, birds crossing | `rooster-crow` (far), `wings-fly-away`; birds in the bed |
| cups, a box, a lid, things set down | `cup-set-down`, `cup-on-table`, `cardboard-tap-1`, `cardboard-tap-2`, `cardboard-lid` |
| a card, a tag, a page, a book | `card-flip`, `card-deal`, `page-flip`, `book-close`, `wrapping-paper` |
| a ribbon or a cord pulled, cloth, bedding | `cord-pull`, `cloth-rustle` |
| water, soil, a shovel or a hoe | `water-pour`, `water-spill`, `shovel-sand` |
| a car in a street | `car-pass-by` |
| a button on an interface or an end card | `button-click` |
| light, a glow, a sunrise, a camera move, a whip | nothing |
`"align"` puts the sound on its frame: `attack` (the default: the first moment within 6 dB of its peak on `t`; hits, steps, a flare), `peak` (the loudest point on `t`), `start` (the beginning on `t`; a stroke that follows a drawn line). `"cut": [from, to]` trims a recording to the shot (seconds in the file). A thing the library lacks: find it (below), never imitate it in code.

## The plan: `plan/sound.json`, then one command
```json
{
 "duration": 17.14,
 "voice": {"file": "assets/vo/vo.wav", "at": 0.0},
 "scripture": [{"from": 6.80, "to": 12.86, "what": "the verified card while the dua is read"}],
 "pictures": [{"from": 0, "to": 17.14, "material": "earth"}],
 "bed": [{"lib": "amb-night-crickets", "from": 0, "to": 8.6},
         {"lib": "amb-dawn-birds", "from": 6.6, "to": 17.14, "offset": 2.0}],
 "effects": [
  {"t": 13.41, "lib": "door-creak", "align": "attack", "gain_db": 0, "why": "the door opens"},
  {"t": 14.91, "lib": "wings-fly-away", "align": "attack", "gain_db": -2, "pan": 0.3, "why": "the birds cross"},
  {"t": 15.71, "lib": "rooster-crow", "align": "attack", "gain_db": -4, "why": "a far rooster after the last word"}
 ]
}
```
- Times come from the project's one timing source, never typed by ear. In a narrated video: `python "<skill>/scripts/cues.py" check --words "assets/vo/<take>.words.json" --offset <same as the build> "<word>" "<word>:end" …` prints each spoken word's time in seconds of the whole video; write those numbers into `t` and into the `scripture` spans, and run it again after any retime (the picture moves with `timing.js` by itself, the sound plan does not). A video with no voice: name its moments in `plan/beats.json` and build `timing.js` with `python "<skill>/scripts/cues.py" build --beats plan/beats.json --out timing.js`; `plan/sound.json` uses the same names. Its `t` stays a number: `python "<skill>/scripts/cues.py" check --beats plan/beats.json` prints each name's second and end; write those into `t` (and the name in `why`).
- `"lib"` names a recording in `sounds/library/`; `"file"` is a CC0 recording in the project (`assets/sfx/…`, relative to the project folder). Every bed and effect takes either.
- `pictures` says what is on screen, as spans with a `material` (`interface` for a phone screen, an app or a button). The mixer refuses an interface sound outside an `interface` span.
- `scripture` holds the span of every quoted text on the still card (`verified-card.html`, from the frame it shows to the frame it hides): an ayah, a hadith, a dua, and also a quoted law, study or saying with a name on it. Effects are kept 0.5 s clear around it. `check_pace.py` reads the same spans and does not count the held card against the picture-change numbers.
- `gain_db` shapes the effects against each other (0 = the strongest); `pan` follows the picture (−1 left … 1 right).
- **One moment in parts:** `"layers"` builds one moment from several recordings, each with its `lib` or `file`, `at` (seconds from the effect's `t`; negative = before it), `align` (default `attack`), `gain_db`, `pan`, `cut`. It counts as one effect and gets one level:
```json
{"t": 0.90, "gain_db": 0, "pan": 0.25, "why": "the dates box drops into its place",
 "layers": [{"lib": "cardboard-tap-2", "at": 0},
            {"lib": "wrapping-paper", "at": 0.03, "cut": [0.2, 0.6], "gain_db": -8}]}
```
- No voice: leave the levels to the mixer. Only if the ear asks: `"effects_top": -23` … `-26`. With a voice: `"effects_db"` (default −12). A bed: `"bed_top"` (default −34) and its own `"gain_db"`. `master.lufs`, `bed_under_db` and `bed_lufs` belong to 1.7.0's code-made sound and are not used with real sounds (the mixer says so).
- Several takes (one per scene or paragraph): the mixer reads one voice file, so join them first at the same offsets you gave `cues.py build`, e.g. two takes at 0 and 6.2 s: `ffmpeg -i "assets/vo/take1.wav" -i "assets/vo/take2.wav" -filter_complex "[1]adelay=delays=6200:all=1[b];[0][b]amix=inputs=2:normalize=0:duration=longest" "assets/vo/vo.wav"`, then `"voice": {"file": "assets/vo/vo.wav", "at": 0.0}`.
- Music only when the user asked: `"music": {"file": "assets/music/<name>.mp3", "gain_db": -20}` with `"user_asked": ["music"]`; it is cleared under every `scripture` span.
- `"user_asked": ["music"]` or `["dense"]` records that the user asked against the default; without it the mixer refuses music and more than five effects in ten seconds.
- A quick draft with code-made sounds (to hear timing before the recordings are chosen): `"sketch": true`, with the 1.7.0 fields (`"kind"` beds, `"sound"` effects from `material_sfx.py --list`). Never show a sketch as the video.
```
python "<skill>/scripts/sound_mix.py" plan/sound.json          # writes assets/mix.wav + stems, then runs the check
python "<skill>/scripts/check_mix.py" "renders/final/<name> v1.mp4" --plan plan/sound.json   # the finished video, after the render
python "<skill>/scripts/sound_mix.py" --library                 # the recordings that ship with the skill
```
The mixer refuses a plan that breaks the rule and says what to change: a code-made sound or bed without `"sketch": true`, a file it cannot find, an effect inside the scripture zone, an interface sound on a non-interface picture, music nobody asked for, more than five effects in ten seconds, a sound that is not a number (NaN).

## Levels when there is no voice
The viewer's volume is set by the video before this one in the feed, nearly always a voice at −14 LUFS. So a video with no voice keeps every sound well under where a voice would sit: **the strongest effect's loudest 400 ms at −24 LUFS** (10 dB under speech), the others under it by their `gain_db`, and nothing over −22. 1.7.0's first fix put them at −20 with the loudest moment up to −18; the owner still heard that as "a bit loud, the effects too strong", so v2 holds them at least 3.5 dB lower.

**There is no integrated target here, on purpose.** Integrated loudness (BS.1770) gates out blocks more than 10 LU under the program, so with no voice the number counts only how many effects there are and how long they ring. Aiming it at −14 forced each effect over the loudness of speech. It comes out around −34 to −28; over −24 fails; under −36 warns.

**Build short moments in parts.** A single short recording can sound thin; a real moment often has the approach, the contact and the settle. Build it as `layers` from recordings (a tap and a rustle of paper), never by adding a code-made whoosh.

**The end, and the gaps.** Stretches where nothing sounds are fine with real sounds: the end card's tail, a pause between two moments, a long quoted card. The check reports digital silence, near-silence and how much of the video has a floor as information only.

**A phone speaker and low volume.** A phone plays the mono sum from about 400 Hz up and plays bright effects in full. The check measures the mix through that path (mono, 400 Hz–8 kHz): the loudest moment at most −22 LUFS with no voice; with a voice, the voice at least 8 dB over bed and effects there (a warning). A short, low-heavy hit (a cardboard tap alone) can fall to about −42 LUFS on a phone: layer a short higher contact (a paper slide, a cloth touch) so it is heard.

## The check (`check_mix.py`)
| Measures | Passes when |
|---|---|
| integrated loudness (FFmpeg ebur128) | with a voice −14 ±1 LUFS; with no voice at most −24 (no target; under −36 warns) |
| no voice: the loudest 400 ms | at most −22 LUFS |
| the 2–6 kHz band: of the mix with no voice; of the bed and effects stems with a voice | loudest 400 ms at most −28 LUFS |
| no voice: a phone speaker (mono, 400 Hz–8 kHz) | loudest at most −22 LUFS |
| no voice, with the plan: a stretch held within 6 dB of its top over 1.2 s | its top at most −27 LUFS |
| **static floor** (every 5 s window: the quietest 30% of its 100 ms frames; static when they spread under 3 dB with a noise-like spectrum) | none over −50 LUFS (−55 to −50 warns; a picture that shows rain or sea, `"shown"`, warns only) |
| **buzz**, with the plan: every effect's envelope between 60 and 300 Hz | no effect over −34 LUFS with a narrow peak of 15 dB or more |
| **real sounds only**, with the plan | no code-made bed or effect (`ui.*` on an interface excepted), no `"sketch"` |
| with the plan: a rising whine (climbing 0.75+ octave and 12+ dB into 2.5 kHz+) | none over −30 LUFS (quieter: a warning) |
| true peak | under −1 dBTP |
| effects (exact from the plan, a moment in `layers` counting once; estimated from the sound without one) | at most 5 in any 10 s |
| quoted scripture, music, interface sounds, the voice on top, the stems the mixer recorded (with the plan) | as in the rule |
Information only (a bed is optional): digital silence, near-silence, how much of the video has a floor, the floor's level. Warnings (not failures): loudness range over 6 LU (with a voice), the voice less than 8 dB over the bed and effects through a phone speaker, more than 25% of the energy under 100 Hz, fewer than three effects in a voiceless video, an effect whose top is under −34 LUFS (no voice) or less than 4 dB over the bed (with a voice), a quiet rising whine, the mono sum more than 3 dB down. Without `--plan` the check cannot know there is a voice: add `--voice`. A pass means the numbers hold, not that it sounds good: say so.

## Beyond the library
For a thing the library lacks (a particular door, coins, an instrument, a crowd, waves, rain), fetch a real recording through Openverse (`reference/free-sfx-openverse.md`), CC0 only for a final video:
```
python "<skill>/scripts/openverse_sfx.py" search "typing on a keyboard" --max-seconds 20 --cc0-only
python "<skill>/scripts/openverse_sfx.py" get <id> --name typing --dest assets/sfx
```
Use it in the plan as `"file": "assets/sfx/typing.mp3"` (trim it with `"cut"`). Listen for its own noise first: a recording whose floor is a steady hiss (traffic, a breeze, a recorder's hiss) fails the static-floor line as a bed; as an effect it only matters while it sounds. The code-made sounds stay in the skill for sketches and for abstract interface moments; they are never the sound of a thing on screen.

## Record it
Write the video's sound in `TASTE.md` §5: the bed (which recording, or none and why), the effects and why, music yes or no, and the check's numbers (loudness, loudest, 2–6 kHz, phone, static floor, the voice on top). The next video in the same style starts from it.
