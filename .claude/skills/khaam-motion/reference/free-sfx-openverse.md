<!-- Khaam Motion · reference file, loaded on demand from SKILL.md. Free real recordings. -->
# Free sound effects: Openverse

**The free route for real recordings** (coins, paper, doors, water, crowds) and anything the Khaam sound library lacks. For interface and motion sounds, the library comes first (`reference/sound-library.md`). Openverse (run by WordPress) indexes millions of openly licensed sounds, many from Freesound. No account or key is needed for normal use.

## Commands (run from the project folder)
```
python "<skill>/scripts/openverse_sfx.py" search "whoosh" --n 8 --max-seconds 3
python "<skill>/scripts/openverse_sfx.py" get <id> --name whoosh-soft-01
```
`get` saves into `assets/sfx/`: the audio, `<name>.source.json` (full provenance), a credit line in `assets/sfx/ATTRIBUTION.md` when the licence is CC BY, and a `manifest.json` entry.

## A real recording as the bed (new in 1.7)
Since sound v2 (2026-11-12) every sound of a thing on screen is a real recording: first the skill's own `sounds/library/` (CC0), then Openverse for what it lacks (a keyboard, waves on a shore, a crowd, a particular room); CC0 for a final video. For a bed (a real recording of the place with sparse events, never a steady hiss), search long recordings only:
```
python "<skill>/scripts/openverse_sfx.py" search "dawn chorus birds" --min-seconds 20 --max-seconds 600 --cc0-only
python "<skill>/scripts/openverse_sfx.py" get <id> --name bed-dawn --dest assets/sfx
```
Then name it in `plan/sound.json` as a file bed (`{"kind": "dawn", "file": "assets/sfx/bed-dawn.mp3", "from": 0, "to": 11}`); `sound_mix.py` loops a short recording with crossfades and sets its level. Listen for voices, traffic or music inside a field recording before using it: a title is not proof.

## Licence rules (enforced by the script)
| Licence | Allowed | What you must do |
|---|---|---|
| CC0, Public Domain Mark | ✅ | Nothing. Keep the source file for the record |
| CC BY | ✅ | **Credit the creator** in the post caption or end credits. The text is in `ATTRIBUTION.md`; at delivery Claude copies it beside the video in «جاهز» as «<العنوان> حقوق.txt», ready to paste |
| CC BY-NC (non-commercial) | ❌ excluded | Not allowed in monetised/brand content |
| CC BY-ND (no derivatives) | ❌ excluded | Trimming or processing would break it |
| CC BY-SA (share-alike) | ❌ excluded | Syncing it to video can force the video's licence |

Use `--cc0-only` when the user wants zero credits. Tell the user plainly when a chosen sound needs a credit.

## How to search well
- English keywords work best: `whoosh`, `swoosh`, `click`, `ui click`, `pop`, `impact`, `thud`, `ding`, `riser`, `glitch`, `typing`, `paper`, `water drop`, `cassette`, `tv switch on`, `8-bit`, `marimba`.
- Each preset in `styles/` lists its own query hints.
- Search once per sound role, pick 2–3 candidates, download, and **audition** them (waveform/peak check with FFmpeg, then the mixed preview). A title is not proof of how it sounds.
- Many Freesound files arrive as high-quality MP3 previews. Fine for social video; label them honestly and don't call them lossless.
- Anonymous use is rate limited, and a search can take 40–50 s or fail once. Search sparingly, run a few searches together, and reuse sounds across scenes.
- Long recordings need trimming to the one useful moment.

## Where it fits
1. The user's own licensed library (`assets/sfx`, catalog) → 2. the skill's own real recordings (`sounds/library/`) → 3. **Openverse (free)** for real things the library lacks → 4. the Khaam sound library for designed moves and interfaces (`reference/sound-library.md`) → 5. ElevenLabs generation if the user has a key and approves the cost (`reference/elevenlabs-sfx.md`) → 6. procedural sounds (`scripts/procedural_sfx.py`): sketches and abstract interface moments only (`SKILL.md` §4 source order).
Placement, layering and mixing rules: `reference/sound-library.md` and `reference/local-sound-workflow.md`.

## Earshot (part of the sound library)
**Earshot** (MIT, CPU-only, https://github.com/Leonxlnx/earshot) designs sounds in code. `scripts/install_sounds.py` installs only its sound bank (version 0.4.0, from the official GitHub release, hash-checked) and renders it into the library. Its AI "ears" (describe, rank, critique) need torch and about 1.1 GB of models and are not installed; add them only if the user asks. Never run `earshot llm`: it uploads audio to an outside AI service. The PyPI package named `earshot` is an unrelated project.

Source checks: Openverse API queried 2026-10-26 (`/v1/audio/?q=whoosh&license=cc0,by&length=short` returned CC0 Freesound results with ready attribution text). Earshot's repository and licence checked 2026-11-04.
