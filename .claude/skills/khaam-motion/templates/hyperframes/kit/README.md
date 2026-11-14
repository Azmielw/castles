# The scene and figure kit (`templates/hyperframes/kit/`)

Code-drawn worlds and faceless people for told videos, in flat layered vector with depth. Everything here is our own drawing, made in code; nothing is traced or copied from anyone's video. Full guides: `reference/scene-kit.md` (worlds, light, weather, camera, paper) and `reference/figure-kit.md` (people).

## The rule (read this before drawing any person)
- **No face, ever.** A figure's face is a plain skin-coloured oval: no eyes, nose, mouth, eyebrows, beard or any mark on it. Do not add one, even if asked.
- **No speck, dust or glint may cross a faceless head:** a dot over the face reads as an eye. Draw dust, sparks, embers and glints behind the people.
- **No prophet and no companion is ever drawn.** Not as a figure, not as a shape, a silhouette, a shadow, a glow standing where a person would be, a hand, a back view, or a crowd member "meant to be" him. Not for any prophet (peace be upon them) and not for any companion (may Allah be pleased with them). When the story is about one of them, the picture shows the place, the weather, the light, the sea, an object, or ordinary people of today, and the words carry the story.
- **If asked to draw one, Claude refuses**, says why in one plain line, and offers the picture that tells the same moment without a person (in Gulf Arabic, for example: «ما نرسم الأنبياء ولا الصحابة ولا حتى بظل؛ نخلي المشهد يحكي: البحر والليل والضوء»).
- The figures are for ordinary people: the viewer, a father, a child, a worker, a traveller, a crowd at prayer.

## Files
| File | What | Load order |
|---|---|---|
| `kit.js` | palettes by role, the stage of depth layers, relight (night → dawn), timelapse (a day in under a second), the camera (push, pan, track, dive, rise, drop, dip, shake, cross-fade, `cameraReport`, `toScreen`), `svgMove`, a plate under text, `Khaam.places` (place, show, cut, whip, fade) | 1 |
| `scene.js` | skies, stars (that go out one by one), moon, sun, clouds, hills, dunes, ground, haze, rocks, sea, pool, underwater, houses and a town (windows that wake), a minaret, a mosque, a room (a sun that crosses its window), a bed, a desk, a chair, a sofa, a side table, a car, a door that opens, palms, trees, grass, glow, rays, spotlight, fire, lantern, smoke, rain, lightning, wind, birds, film grain and vignette | 2 |
| `figure.js` | the faceless figure (man, woman, boy, girl), 49 poses (prayer poses only in a prayer scene), walk and run cycles (also while carrying), clothing (a plain ghutra; the igal only when asked), skin tones, props and held things (jug, hoe, box, phone), hands (`handAt`, `reach`), a crowd | 3 |
| `paper.js` | the paper world: ruled or blank page, ink and pencil lines that draw themselves (or are already there: `still`), dotted lines, hatching, washes, 28 object drawings (with a desk, chair, stool, calendar, sheet, notebook, bubble, «again» arrow), a big book that turns and shuts, handwriting lines, hand marks, wipe-in reveals | 4 |

In `index.html`, after GSAP:
```html
<script src="kit/kit.js"></script>
<script src="kit/scene.js"></script>
<script src="kit/figure.js"></script>
<script src="kit/paper.js"></script>   <!-- only for the paper world -->
```

## A scene in twelve lines
```js
var tl = gsap.timeline({ paused: true });
var S = Khaam.stage("#world", { palette: "night", duration: 6, tl: tl, horizon: 1350, light: { x: 720, y: 1290 } });
S.sky(); S.stars(); S.moon({ x: 800, y: 470 });
S.dunes({ layer: "far", y: 1350, tone: 0.55 });
S.ground({ y: 1430 });
S.palm({ layer: "near", x: 905, y: 1500, h: 560 });
var man = S.figure({ outfit: "thobe", head: "ghutra", skin: "tan", x: 370, y: 1700, h: 350 });
S.rain({ stop: { at: 2.6 } }); S.lightning({ at: [1.1] });
S.relight("dawn", { at: 2.6, dur: 2.6 });
man.pose("raise_hands", { at: 3.4 });
S.push({ to: 1.08 }); S.film();
window.__timelines["scene"] = tl;
```
The svg in the composition is just `<svg id="world" xmlns="http://www.w3.org/2000/svg"></svg>`.

## Keep it moving (1.7.0 of 11-12)
- A visible camera move in every scene, on 30–45% of the running time; a push that should read as motion runs 2.5–4%/s; at least one move carries the meaning on a word. Numbers and the check: `reference/pace.md`; the camera's own timeline: `S.cameraReport().text`.
- A video told in places: `var P = Khaam.places(tl, document.getElementById("host"), {duration: D})`, then `P.place("room", {palette: "dawn"})` (a stage), `P.show`, `P.cut`, `P.whip`, `P.fade`.
- A verified card (`compositions/verified-card.html`) tells the kit its span (`Khaam.card`): a place change that would run into the card is moved off it (ended as the card comes in, or held until it has left) and stars near its box go out while it is up; the console says each move (2026-11-13, the wisdom rerun).
- Never `svgOrigin` with a `scale` in a fromTo's start values: use `S.svgMove(g, at, dur, from, to, ease, origin)`. To recolour a painted element, paint it again (`S.paint`).

## Three working examples (`kit/examples/`)
Each is a whole scene composition, 6 s at 1080×1920, that passed `hyperframes check` and was rendered and looked at on 2026-11-11 (Windows):
- `oasis-dawn.html`: an oasis from night to dawn, rain, lightning, wind, a man who raises his hands, a push-in.
- `lane-dusk.html`: a Najdi lane at dusk, a father and son walking, the camera tracking with depth, lanterns lighting.
- `paper-seed.html`: a ruled page where a seed becomes a tree, a man drawn in ink, a sun, a hand underline (needs `paper.js`).
To use one, copy it to the video's `compositions/scene.html`, register it in `index.html` as a track (`data-start="0"` and the video's full length when it uses `cue()`), and change what the story needs; in a narrated video replace its seconds with `cue("<spoken word>")` (`reference/scene-kit.md` § Timing from the narration).

## Licence
Our own code and drawings, shipped under the gift's licence (`LICENSE.md`). No image, font or sound file is in this folder.
