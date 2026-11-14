# The sound library: real recordings, CC0 (new in 1.7.0, 2026-11-12)

Every file here is a **real recording**, licensed **CC0 1.0** (public domain dedication: no credit needed, commercial use allowed), found through Openverse (Freesound), the same route as `scripts/openverse_sfx.py`. Each was trimmed to its event and levelled: effects to −24 LUFS in their loudest 400 ms, beds to the lower of −34 LUFS loudest and a −56 LUFS static floor. Stored as FLAC (lossless; the gift reads it through FFmpeg). The source of every file is linked below; the CC0 deed: https://creativecommons.org/publicdomain/zero/1.0/

Use in a plan: `{"t": 6.75, "lib": "match-strike-and-light", "why": "the first candle is lit"}` (effects) or `{"lib": "amb-night-crickets", "from": 0, "to": 9}` (a bed). `sound_mix.py` finds them here; `sound_mix.py --library` lists them. Nothing here is code-made: the rule is that every sound a viewer can tie to something on screen is the real sound of that thing (`reference/film-sound.md`, rule 1). For a thing this library lacks, use the Openverse route (`scripts/openverse_sfx.py`, CC0 only) and add the file with its source to your project; never a code-made imitation.

“Loudest” is the loudest 400 ms in LUFS. “Buzz” is the narrowest 60–300 Hz peak in the sound's envelope, in dB (a fly or a hum reads 15 and up; every file here is 3–13.4). Nobody has listened to these files in the gift: every number is a measurement.

## Effects

| name | what it is, what it is for | s | loudest | buzz dB | source (CC0) |
|---|---|---|---|---|---|
| `book-close` | a book closed | 0.78 | -25.5 | 9.6 | [Book Close](https://freesound.org/people/xavierrrangel/sounds/617410) by xavierrrangel |
| `button-click` | an interface button click (only on an interface: a pressed button, an end card's button) | 0.16 | -24.0 | 4.9 | [SFX UI Button Click](https://freesound.org/people/suntemple/sounds/253168) by suntemple |
| `car-pass-by` | a car passing in a street | 5.06 | -24.0 | 10.3 | [Car passing by.wav](https://freesound.org/people/hinzebeat/sounds/171447) by hinzebeat |
| `card-deal` | a card dealt onto a table | 0.73 | -24.0 | 6.4 | [Playing Card Deal Variation 3](https://freesound.org/people/el_boss/sounds/571575) by el_boss |
| `card-flip` | a card flipped and landing: a tag, a price card, a gift card | 0.79 | -24.0 | 7.2 | [flipCard.wav](https://freesound.org/people/Splashdust/sounds/84322) by Splashdust |
| `cardboard-lid` | a cardboard box closed | 0.45 | -24.0 | 9.3 | [Cardboard box (open close)](https://freesound.org/people/FirediesProductions/sounds/235807) by FirediesProductions |
| `cardboard-tap-1` | one tap on a cardboard box: an item dropping into a box | 0.24 | -24.0 | 7.4 | [hit-tap-strike-cardboard-box-13-times.wav](https://freesound.org/people/newagesoup/sounds/364932) by newagesoup |
| `cardboard-tap-2` | another tap on a cardboard box | 0.26 | -24.0 | 8.1 | [hit-tap-strike-cardboard-box-13-times.wav](https://freesound.org/people/newagesoup/sounds/364932) by newagesoup |
| `chalk-short` | one short stroke on a board: a «؟», a tick, a mark (use it for writing on screen: a written «؟» is chalk, never a code-made scratch) | 0.48 | -24.0 | 10.2 | [Write/Draw with chalk on board](https://freesound.org/people/Breviceps/sounds/447925) by Breviceps |
| `chalk-stroke` | a stroke with its drag: a circle, a line, a «؟» drawn | 0.85 | -24.0 | 8.8 | [Chalk writing on board.mp3](https://freesound.org/people/mrrap4food/sounds/619018) by mrrap4food |
| `chalk-writing` | two quick strokes: writing on a board or a slate | 0.9 | -24.0 | 3.0 | [Chalk writing on board.mp3](https://freesound.org/people/mrrap4food/sounds/619018) by mrrap4food |
| `cloth-rustle` | a heavy cloth rustle: bedding, a ribbon wrapped, clothes | 1.67 | -24.0 | 9.1 | [heavy cloth rustle.wav](https://freesound.org/people/jacobzeier/sounds/163164) by jacobzeier |
| `cord-pull` | a cord or a ribbon pulled tight | 0.35 | -24.0 | 5.9 | [Cord String Pull 1.wav](https://freesound.org/people/killianm97/sounds/554234) by killianm97 |
| `cup-on-table` | a lighter cup placed on a table | 0.28 | -24.0 | 7.4 | [cup on table.wav](https://freesound.org/people/atlaslives/sounds/96185) by atlaslives |
| `cup-set-down` | a cup set down on a table | 0.33 | -24.0 | 4.9 | [Cup set Down](https://freesound.org/people/aldenroth2/sounds/272022) by aldenroth2 |
| `door-creak` | a wooden door creaking open | 1.4 | -24.0 | 13.4 | [Door - Creak 02.wav](https://freesound.org/people/JarredGibb/sounds/219492) by JarredGibb |
| `footsteps-sand` | three steps on sand or dust (never copy one step at a fixed interval: it buzzes) | 3.6 | -24.0 | 9.9 | [Sandy Footsteps (foley)](https://freesound.org/people/FableVision_Studios/sounds/182869) by FableVision_Studios |
| `match-ignite-flare` | a flame catching with no strike: a candle lit from another flame | 0.85 | -24.0 | 9.2 | [Match Ignite (No Strike)](https://freesound.org/people/brachern/sounds/398448) by brachern |
| `match-strike-and-light` | a match struck, its flare and the small flame: a candle or a lamp lit with a match | 1.45 | -24.0 | 8.0 | [Match - Strike and Light 02.wav](https://freesound.org/people/JarredGibb/sounds/248236) by JarredGibb |
| `page-flip` | a page turned | 0.56 | -24.0 | 8.6 | [Page Flip](https://freesound.org/people/qubodup/sounds/454707) by qubodup |
| `pen-signature` | a pen writing a name or a signature | 2.54 | -24.0 | 8.4 | [PEN SIGNATURE SIGNING 2.wav](https://freesound.org/people/ListenTonyBoy/sounds/326961) by ListenTonyBoy |
| `pen-underline` | a pen underlining on paper | 1.79 | -24.0 | 8.3 | [Underlining Stroke on Paper](https://freesound.org/people/zembacraftworks/sounds/428338) by zembacraftworks |
| `pencil-strokes` | pencil writing on paper (7 short strokes) | 0.84 | -24.0 | 7.5 | [Pencil writing on paper (7 strokes)](https://freesound.org/people/ani_music/sounds/632476) by ani_music |
| `rooster-crow` | a rooster crowing: dawn in a village (place it far and low) | 1.95 | -24.0 | 10.4 | [Rooster crow](https://freesound.org/people/jsbarrett/sounds/200339) by jsbarrett |
| `shovel-sand` | a shovel or a hoe into sand and gravel | 0.65 | -24.0 | 7.0 | [Shovel - Sand/Gravel/Snow](https://freesound.org/people/Bricklover/sounds/560957) by Bricklover |
| `sit-on-bed` | someone sitting up on a bed, bedding moving | 3.3 | -24.0 | 8.3 | [Sitting on bed_softer.wav](https://freesound.org/people/tlcolbe/sounds/406714) by tlcolbe |
| `water-pour` | water poured into a glass or a jar | 2.02 | -24.0 | 10.9 | [Water pouring into glass.aif](https://freesound.org/people/carroll27/sounds/151895) by carroll27 |
| `water-spill` | water spilled or poured onto ground | 2.53 | -24.0 | 7.8 | [Water_Spill.wav](https://freesound.org/people/Galbenshire/sounds/464577) by Galbenshire |
| `wings-fly-away` | pigeons taking off: birds crossing the sky | 3.78 | -29.2 | 9.6 | [pigeons_fly away_ wing flaps_CsG](https://freesound.org/people/csaszi/sounds/528250) by csaszi |
| `wrapping-paper` | wrapping paper handled | 1.91 | -24.0 | 10.5 | [R04-33-Wrapping Paper.wav](https://freesound.org/people/craigsmith/sounds/481820) by craigsmith |

## Beds (a real recording of the place, with sparse events; or no bed)

| name | what it is, what it is for | s | loudest | source (CC0) |
|---|---|---|---|---|
| `amb-dawn-birds` | a dawn chorus (a dense bed: the mixer sets it by its floor) | 30.0 | -36.9 | [Dawn Chorus Birdsong](https://freesound.org/people/squashy555/sounds/573080) by squashy555, 30-60 s |
| `amb-night-crickets` | a rural night: crickets only, no static (a sparse bed) | 30.0 | -34.0 | [Atmosphere with crickets and dogs at night (rural land)](https://freesound.org/people/jmbphilmes/sounds/242546) by jmbphilmes, 0-30 s |
| `amb-night-far-dog` | a rural night: crickets and far dogs barking (a sparse bed) | 30.0 | -34.0 | [Atmosphere with crickets and dogs at night (rural land)](https://freesound.org/people/jmbphilmes/sounds/242546) by jmbphilmes, 40-70 s |

## Not in the library yet (no clean CC0 recording found on 2026-11-12)

- a small kraft tag on a string landing on a box lid (stand-in: `card-flip`)
- a satin ribbon pulled into a bow (stand-in: `cloth-rustle` with `cord-pull`)
- a glass candle jar set into a cardboard insert
- water poured from a clay jar onto dry soil (stand-ins: `water-pour`, `water-spill`)
- a hand hoe in dry soil (stand-in: `shovel-sand`)
- typing on a keyboard; a far town at dusk with people
- a quiet shop interior with no hiss (use no bed: the effects' own tails are the floor)

Light makes no sound: a lamp lighting, a glow, a sunrise get none (dawn gets its birds). A camera move gets none.

*English footer: the gift's CC0 library of real recordings with each file's source, length, level and use.*
