<!-- Khaam Motion · reference file, loaded on demand from SKILL.md -->
# The scene kit: code-drawn worlds for told videos

Read this when a video tells a story or a reflection over pictures (a narrated scene, a night that turns to dawn, a street, a room, a sea, a page that draws itself). The kit lives in `templates/hyperframes/kit/` and is copied with the HyperFrames starter into every video folder. People are in `figure-kit.md`; read its rule before drawing anyone.

## What it is
- **Flat layered vector with depth.** Each world is 4–7 layers (sky, far, mid, near, ground, actors, front); far layers are hazier and move less, so a slow camera move reads as depth.
- **Drawn in code, ours.** Every piece is a function that draws SVG. No image, font or sound file ships with it. Do not paste anyone's artwork into a scene; build the place from pieces.
- **Coloured by role, not by hex.** Pieces paint with roles (`sky0`, `far`, `ground`, `warm`, `rim` …). A palette maps roles to colours, so a style recolours the whole world at once, and `relight()` turns night into dawn by moving every role to the next palette.
- **Deterministic.** Everything that moves is a tween on the scene's paused GSAP timeline; random is seeded. The same frame renders the same way every time.

## Start a scene
1. `index.html` loads, after GSAP: `kit/kit.js`, `kit/scene.js`, `kit/figure.js` (and `kit/paper.js` for the paper world).
2. The composition holds one empty svg: `<svg id="world" xmlns="http://www.w3.org/2000/svg"></svg>`.
3. In its script:
```js
var tl = gsap.timeline({ paused: true });
var S = Khaam.stage("#world", { palette: "night", duration: 6, tl: tl, seed: 3,
                                horizon: 1350, light: { x: 720, y: 1290 }, wind: 0.5 });
// …pieces by name, back to front…
window.__timelines["scene"] = tl;
```
Stage options: `palette` (name or object), `colors` (role overrides), `duration`, `tl`, `seed`, `horizon` (y where land meets sky), `light` (the one light source: figures and rocks shade toward it), `wind` (0 calm … 1 strong: palms, trees and grass sway by it), `span` (how wide pieces are drawn: widen it for pans and tracks, e.g. `[-1700, 1300]`).

4. Ready scenes to copy and change: `kit/examples/oasis-dawn.html`, `lane-dusk.html`, `paper-seed.html`.

## Timing from the narration
In a narrated video, place every event with `cue("<spoken word>")` from `timing.js` (`hyperframes.md` step 4), never with typed seconds: `S.lightning({at: [cue("وتخطئ")]})`, `S.relight("dawn", {at: cue("الرابعة"), dur: 2.6})`, `boy.appear({at: cue("غيرك") - 0.1})`. `cue()` returns seconds of the whole video, so give the scene's track `data-start="0"` and the video's full length in `index.html` (or subtract the track's `data-start` from every cue). The examples use seconds because they have no narration.

## Layout for 9:16
Keep the top third quiet (the words go at y≈250–560): sky, a moon, a few stars. Put the picture's weight in the lower two thirds; the horizon around y 1250–1400. The bottom ≈380 px sits under the app's buttons: ground and grass are fine there, the figure's feet should be above y≈1760.

## The pieces
Every piece is called as `S.<name>({...})`; every option has a default. `layer` picks the depth layer.

**Sky**
| Piece | What | Main options |
|---|---|---|
| `sky` | the gradient and the glow on the horizon | `glowX`, `glowW`, `glowH` |
| `stars` | seeded stars, a few twinkle; they can go out one by one before dawn | `count`, `top`, `bottom`, `twinkle`, `out: {from, to, share}` |
| `moon` | crescent, half or full, with a glow | `x`, `y`, `r`, `phase`, `tilt` |
| `sun` | disc and two glows; can rise | `x`, `y`, `r`, `rise: {from, at, dur}` |
| `clouds` | flat clouds, lit rim, shaded base; drift; part | `y`, `count`, `spread`, `minW`, `maxW`, `alpha`, `drift` (**pixels over the whole stage duration**, not px/s: −2300 over 19.5 s ≈ 118 px/s) or `driftSpeed` (px/s), `part: {at, dur, dx}` |
| `birds` | birds crossing, wings flapping | `count`, `x`, `y`, `dx`, `dy`, `at`, `dur`, `size` |

**Land and water**
| Piece | What | Main options |
|---|---|---|
| `hills` | rolling hills or mountains, haze at the base, a lit ridge | `y`, `height`, `role`, `freq`, `haze`, `rim` |
| `dunes` | dunes with sharp crests, a lit face and a shadow face | `y`, `height`, `count`, `tone` (0 near … 0.6 far), `light: "left"|"right"` |
| `ground` | the ground plane with a texture | `y`, `texture: sand|stone|grass|soil|none`, `marks`, `top`, `role` |
| `haze` | a band of haze between layers | `y`, `h`, `alpha` |
| `rocks` | flat rocks with a lit facet | `at: [x…]` or `count`, `y`, `size` |
| `sea` | water to the horizon, ripples in perspective, a light path that shimmers | `y`, `lightX`, `rows`, `pathWidth`, `shimmer`, `path` |
| `pool` | an oasis spring: the sea in an ellipse, with a bank | `x`, `y`, `rx`, `ry` |
| `underwater` | the depths one screen below the frame, for `dive()` | `y`, `lightX`, `motes` |

**Built**
| Piece | What | Main options |
|---|---|---|
| `house` | one building, Najdi (saw-tooth parapet, beams, triangle vents) or plain; lit windows; a door (no window is drawn where the door stands) | `x`, `y`, `w`, `h`, `style`, `lit`, `door`, `tone`, `wake: [t…]` or `{at: [t…], order, inView, level}` → `{g, windows}` |
| `town` | a lane or a skyline of houses; `detail: "silhouette"` for far layers (its tiny windows follow `lit` too) | `y`, `from`, `to`, `hmin`, `hmax`, `wmin`, `wmax`, `gap`, `lit`, `doors`, `minarets: [x…]`, `tone`, `wake: {from, to, every, inView, order}` → `{g, list, windows}` |
| `minaret` | a tapered Najdi minaret | `x`, `y`, `h`, `w` |
| `mosque` | a low Najdi hall with arches and a minaret, arches lit at night | `x`, `y`, `w`, `h`, `side`, `lit`, `tone` |
| `room` | an inside: back wall, a carved band, an arched window with a lattice and the sky in it, a niche, floor, rug, low cushions; a sun that crosses the window while its light sweeps the floor | `floorY`, `window: {x, y, w, h, sun: {from: [x, y], to: [x, y], at, dur, sweep}}`, `niche`, `rug: {x, w}`, `cushions` |

**Windows that wake.** `house({…, wake: [t…]})` and `town({…, wake: {from, to, every}})` light dark windows one by one, each with a small catch as the lamp takes; they are out of relight's hands until a relight that starts after they woke. `inView: true` picks windows the camera shows at that moment and 2 s later (call the camera moves first: they only need the stage's layers). Both return their windows (`{x, y, el, lit, glow}`) for your own wakes: `Khaam.wakeWindows(S, list, [t…], {order, inView})`. To have every window dark at first, give `lit: 0`.

**Things** (side or front views at the floor line `y`, by role so relight works)
| Piece | What | Main options |
|---|---|---|
| `bed` | a low bed: frame, mattress, pillow, a quilt that folds back | `x` (left end), `y`, `w`, `head: "left"/"right"`, `fold: {at, dur, to}` → `{top}` (lie a figure at `top`) |
| `desk` | a desk with a screen turned to the sitter, its glow, papers, a cup | `x`, `y`, `w`, `h`, `sitter: "left"/"right"`, `screen`, `papers`, `flicker` |
| `chair` | a chair, side view, the back behind the sitter | `x` (seat middle), `y`, `facing`, `size` → `{seat}` |
| `sofa` | a sofa, side view: back, seat, arm, cushion, a soft shadow | `x`, `y`, `w`, `facing`; returns `seat`, the cushion top, 148 px over the floor at any `w` (it does not scale with a figure: before seating someone, compare `seat` with the figure's own seat height from `fig.at(pose)`, and when they differ draw the seat at the figure's height) |
| `sideTable` | a small table (a lamp on it: `S.lamp({y: top − 46, size: 0.75})`) | `x`, `y`, `w`, `h` → `{top}` |
| `car` | a car, side view: wheels that turn, a headlight and its beam; drives across or stays while the world tracks past | `x`, `y`, `facing`, `size`, `color`, `drive: {at, dur, spin}`, `move: {to, at, dur}`, `backLayer`/`frontLayer` (a driver between them) |
| `door` | a Najdi (or plain) door whose leaf swings on its hinge, warm light spilling out on the ground | `x`, `y`, `w`, `h`, `style`, `hinge`, `open: {at, dur, to}`, `light`, `wall: true` (a wall around it) |

**Plants**: `palm` (a date palm: curved trunk with its pattern, fronds that sway, dates; `x, y, h, lean, fronds, tone, dates`), `tree` (`kind: "round" | "acacia"`, `size`), `grass` (tufts that sway; `y, x0, x1, count, h`).

**Light**
| Piece | What | Main options |
|---|---|---|
| `glow` | a soft round light | `x`, `y`, `r`, `color`, `alpha`, `flicker` |
| `rays` | light shafts from a point (sun behind cloud, a window, the surface from below) | `x`, `y`, `angle` (90 = down, −90 = up), `spread`, `count`, `length`, `width`, `alpha`, `on: {at, dur}` |
| `spotlight` | a cone from above, a pool on the floor, the rest dimmed | `x`, `y`, `w`, `dim`, `on: {at, dur}` |
| `fire` | a campfire: stones, logs, three flickering flames, embers, a glow, light on the ground | `x`, `y`, `size` |
| `lamp` | a lantern (our design), lit or lighting up, hanging or standing; `on` and a relight no longer fight (the fade is on a wrapper) | `x`, `y`, `size`, `hang`, `reach`, `on: {at, dur}` |
| `smoke` | soft puffs rising from a roof, a fire or a cup, one every `every` s | `x`, `y`, `at`, `until`, `every`, `life`, `rise`, `drift`, `size`, `layer` |

**Weather**: `rain` (two depths; `density, angle, speed, start: {at, dur}, stop: {at, dur}`), `lightning` (a branched bolt, a full-frame flash, the clouds lit from inside; `at: [t…], x, top, bottom, flash`), `wind` (drifting dust and streaks; `dust, streaks, dir`).

**Film**: `film` (a vignette and a still grain; `grain` 0.06–0.12, `vignette` 0.2–0.55). Always last. `fadeIn`, `fadeOut` and `dip` live with the camera.

**A plate under text over motion (P12)**: `S.plate({cx, cy, rx, ry, alpha: 0.42, color: "ink", show, hide, fade})`, a soft dark ellipse in the fixed `weather` layer, under a line that sits over a moving or brightening scene (the card is still; the world behind it keeps moving). Without `show` it is there from frame 0. word-lit has its own (`CONFIG.plate`).

## Light and time of day
- **Palettes:** `night`, `dusk`, `dawn`, `day`, `storm`, `paper`. Each sets colours by role and levels (how much of the stars, moon, sun, glow, windows, lamps, rims and light path are on).
- **Relight:** `S.relight("dawn", {at: 2.6, dur: 2.6})` tweens every role and level to the new palette: the sky warms, stars fade, the sun and rays come up, rims light, windows dim. Part of the way: `S.relight(Khaam.between("dusk", "night", 0.55), {at, dur})`.
- **One light source per scene.** Set `light` to where the sun, moon, fire or lamp is; figures, rocks, houses and palms shade and rim toward it. Gold or warm colour goes on the light, not on everything.
- **Time runs fast** (a night that turns to morning behind a still card): three relights in a row (night → blue hour `Khaam.between("night", "dawn", 0.3)` → first light `between(…, 0.62)` → morning), clouds with `driftSpeed` of 100–200 px/s, `stars({out: {from, to}})`, windows that wake (`wake`), `smoke` from two roofs, birds late. The world changes every second or so while the camera tracks.
- **A day (or a year) in under a second:** `S.timelapse({at, dur: 0.8, sun, stars, moon, shadows: [{el, x, y}], hide: [people]})` takes the light down and back (`stay: true` ends on the night): the sun sinks, the stars wheel round a far pole, the moon crosses, shadows swing round their foot. Pass what `sun()`, `stars()` and `moon()` returned. Several in a row = the years pass.
- **To recolour a painted element, paint it again** (`S.paint(el, "fill", "ink")`) or relight: the painted colour is a style, so an attribute set later (`setAttribute("fill", …)`) loses to it.

## The camera
Every world layer moves by its depth; that is what makes it feel deep.
| Call | What |
|---|---|
| `S.push({from: 1, to: 1.08, at, dur, origin: [x, y]})` | a push in (or out with `to < 1`). Pushes chain: give the next one `from` = the last `to`; a new `origin` while pushed in glides there instead of jumping (left out, `origin` is the last push's) |
| `S.pan({dx, dy, at, dur})` | a pan; near layers travel the full distance |
| `S.track({speed, dir: "right"|"left", at, dur})` | the world slides past a walker who walks in place; use the figure's own speed: `man.speedFor("walk", {cycle})` |
| `S.dive({at, dur})` | under the sea: the waterline rises out of the top and `S.underwater()` comes up |
| `S.rise({dy, at, dur, keepHorizon, factors})` | the camera lifts (toward the sky, a crane over near palms, or back up after a dive). Default: the sky and the horizon travel a third of `dy`; `keepHorizon: true` moves each layer by its depth (the sky stays, the horizon barely moves, near things travel); `factors: {sky: 0, far: 0.07, mid: 0.33, near: 0.74, ground: 0.92, front: 1}` = your own share of `dy` per layer |
| `S.drop({from: dy, at, dur, keepHorizon, factors})` | the camera starts `dy` higher (among the stars) and comes down to rest; call it before any other vertical move, then the high framing is frame 0 and holds until `at` |
| `S.dip({at, dur, hold})` | a dip to black and back (`stay: true` to end on black) |
| `S.shake({at, dur, amp})` | a small shake for thunder, nothing else |
| `S.fadeIn({dur})`, `S.fadeOut({dur})` | from or to black |
| `Khaam.crossfade(tl, stageA, stageB, at, dur)` | two stages (two svgs) in one composition |
| `Khaam.places(tl, host, defaults)` | a video told in places, each its own stage in its own div: `P.place(name, opts)` → a stage; `P.show(name, in, out, {fade})`; `P.cut(a, b, at)`; `P.whip(a, b, at, {dir, dur: 0.32, blur: 10})` (both slide as one strip, blurred mid-way); `P.fade(a, b, at, dur)`; `P.cameraReport()` |
| `S.svgMove(g, at, dur, from, to, ease, origin)` | move, scale, turn and fade any group (`{x, y, s or sx/sy, r, op}`) about an origin, safely (see below) |
| `S.toScreen(layer, x, y, t)` | where a point drawn in a layer shows on screen at time t (camera moves and pushes): place things where the camera will be looking |

Moves add up: call `pan`, `track`, `dive`, `rise` and `drop` in time order (each one starts where the last ended on its axis). x and y are separate, so a track and a rise can overlap (a crane that starts while the track eases out). `push` scales the layer around its origin, so a track under a push travels a few percent further by the end; widen `span` a little more than speed × duration. Use one origin per push chain unless you want the glide.

**How much the camera moves** (the numbers and the check are in `reference/pace.md`):
- **A visible move in every scene**, on 30–45% of the running time. A still picture with a still card over it reads as a frozen video.
- **A travel shot moves its background layers 40–250 px/s, in parallax** (far slow, near fast: `track` and `pan` do it by depth).
- **At least one move per video carries the meaning on a word**: a dive on the darkest line, a rise or a crane on the relief, a push into the one thing that matters, walls parting on «أوسع».
- **A push that should read as motion runs 2.5–4%/s** (1%/s is the least that shows at all; at 0.5–1.5%/s a twilight frame reads as dead). A slow drift under a long hold can be gentler.
- **Effects-only videos** (no narration): at most 10% dead seconds, and no still run over 2 s.
- A cut, a whip, a dip or a cross-fade between places; a new place or framing every sentence or two (P9). No shake except thunder.
- **Report the camera with the pace check:** `S.cameraReport().text` (or `P.cameraReport().text` for places) lists every move with its time and speed and the share of the time with a visible move; write it in the video's README next to the probe's numbers (the probe sees slow pushes and parallax as dead time).

**Move a group safely.** Never put `svgOrigin` together with a `scale` in a `fromTo`'s start values: GSAP shifts the group sideways for the rest of the video (seen 400 px). Use `S.svgMove(g, at, dur, {s: 0.36, x: 230, op: 0}, {s: 1, x: 0, op: 1}, "power3.out", [725, 1155])`: it writes the whole transform itself every frame, the same whichever frame a render worker starts on. Several moves on one group: in time order; the first one's start is frame 0. It replaces the group's own transform, so wrap a group that has a position.

## The paper world (`paper.js`)
For the cream-paper kind of telling (a page, a line drawing that builds, one accent colour).
- `S.paper({kind: "ruled" | "blank" | "grid" | "dotted", margin, fibre})` on a stage with `palette: "paper"`.
- `S.sketch({name, x, y, size, at, dur, fillAt, pencil, still})` builds a drawing stroke by stroke, then its hatching or wash; `still: true` = already drawn on frame 0 (the cover). Drawings (`Khaam.drawings`): `ground, seed, sprout, tree, sun, moon, house, lamp, book, cup, key, door, mountain, cloud, star, drop, scale, candle, path, bird`, and for a study video `desk, chair` (side view, `facing`), `stool, calendar, sheet, notebook, bubble` (`dotted: true` = a thought bubble in dots; `tail: "left"|"right"`), `again` (a round arrow: re-reading, a habit). `lamp` is a lantern with a flame and rays since 1.7.0 of 11-12 (the 1.7 one read as a bottle).
- `S.ink({d, at, dur, color, width, pencil, still, dotted})` draws any path (`dotted: true` or a gap in px = dot by dot); `S.inkLine({points})` draws a shaky hand line through points; `Khaam.handPoly(S, points)` is a hand line that keeps its corners (boxes, legs, bars).
- `S.book({x, y, w, h, turn: [t…], shut: {at}})` a big open book with lines of text whose pages turn and that shuts on its cover; `S.writing(x1, y0, lines, {gap, at, each, still, pencil})` lines of handwriting, right to left, one after another.
- `S.fill({d, kind: "hatch" | "wash", at, still})`, `S.mark({kind: "circle" | "underline" | "check" | "cross" | "arrow", x, y, w, h, at})`, `S.reveal({el, at, dur, dir})` (wipe anything in, as if drawn).
- **Your own dash reveals:** a stroke revealed by dash offset shows its round cap as a dot at length 0; keep it hidden by opacity (or a butt cap) until it starts. `ink()` does this already.
- People on paper: `S.figure({…, style: "ink"})` draws the same faceless figure as a line drawing.
- **A ladder on paper** (one big section per step, the ladder small in the margin): `compositions/ladder-paper.html` (`story-formats.md` §3).
- Restraint: ink, one accent colour (`accent`), one wash; leave most of the page empty. But draw the drawing that carries the meaning big (a third of the frame or more) and bring the camera to it: small drawings on a still pale page are no picture change, to the eye or to `check_pace.py` (`pace.md` P4–P5). A lesson that stays on one page changes by a tinted section sliding in, a big drawing arriving, a push-in on the number, or a cut to a fresh line.

## Recolour for a style
A style (or the user's taste) gives colours by role: `Khaam.stage(svg, {palette: "night", colors: {warm: "#ffd08a", far: "#22305a"}})`, or a whole new palette object built with `Khaam.palette("dawn", {...})`. Put the style's roles in its `styles/<name>.md` under «الألوان» so every scene of that style looks like one film.

## Add a piece
```js
Khaam.piece("well", function (S, o) {
  var g = Khaam.el("g", null, S.L(o.layer || "ground"));          // draw in stage coordinates
  var stone = Khaam.el("path", { d: "…" }, g); S.paint(stone, "fill", "wall");   // colour by role
  S.wave(g, "rotation", 0, 1, 3, 0, 0, undefined, { svgOrigin: "540 1500" });     // motion: finite tweens only
  return { g: g };
});
```
Rules for a new piece: paint by role (so relight and styles work), take options with defaults, use `S.rng()` for any randomness, move only wrapper groups that have no `transform` attribute, put motion on `S.tl` (never `repeat: -1`, never requestAnimationFrame), and keep it ours (drawn from shapes, not traced from someone's frame).

## Check, look, render
Same as `hyperframes.md`: `check` (read its `runtime` section first: a scene that throws while building shows up there, and the craft warnings after it are its echo), then `snapshot` at the key moments and look at every frame beside the reference the user gave, then render. Since 1.7.0 of 11-12 the stage marks its layers `data-layout-allow-overflow` (they are drawn wider than the frame on purpose), so `check` no longer reports them as "container_overflow".
- HyperFrames moves a composition root's `id` to `data-hf-authored-id`; only the composition's own script still finds it by id. The kit's `"#id"` lookups fall back to that attribute, but passing the element (`document.getElementById("…")` in your script) is the sure way.

## What the kit must never be used for
- **Drawing a prophet or a companion** in any form (figure, shape, silhouette, shadow, light standing in for a person). See `figure-kit.md`; Claude refuses.
- **Drawing a face.** Figures stay faceless.
- **Copying someone's scene.** A user's reference teaches the treatment (palette, layering, pace); the sets, figures and compositions are built new from the kit.
- **Pretending.** No fake place presented as a real photo, no drawn "evidence", no scene that puts words in a real scholar's mouth.
- **Quoted scripture as decoration.** The kit draws worlds; verified texts belong on the still text card, never animated by the scenery.

Tested on Windows 11 with HyperFrames 0.8.225 (headless Chrome), 2026-11-11; the 1.7.0 of 11-12 additions (camera, places, windows, things, timelapse, paper drawings, ladder-paper) on 2026-11-12.
