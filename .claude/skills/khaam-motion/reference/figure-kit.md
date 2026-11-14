<!-- Khaam Motion · reference file, loaded on demand from SKILL.md. MANDATORY before any person appears in a scene. -->
# The figure kit: faceless people for told videos

The figures live in `templates/hyperframes/kit/figure.js` and stand in a scene-kit stage (`scene-kit.md`). One body, drawn from joint angles, so every pose is a set of angles and any pose morphs smoothly into any other.

## The rule (before anything else)
1. **No face.** The face is a plain skin-coloured oval. Never eyes, a nose, a mouth, brows, a beard or any mark on it, even if the user asks for "a little expression". Feeling is shown by the pose: the head down, hands raised, a figure kneeling, someone looking up.
   - **No speck, dust or glint may cross a faceless head.** A dot over the face reads as an eye. Draw dust, sparks, embers, stars and glints behind the people (a layer or group under the figures), or keep them clear of every head for the whole video; check the snapshots for it.
2. **No prophet and no companion, ever, in any form.** Not as a figure, a shape, a silhouette, a shadow, a light or glow standing where a person would be, a hand, a back view, a crowd member meant to be him, or a "symbolic" outline. This holds for every prophet (peace be upon them) and every companion (may Allah be pleased with them).
3. **When the story is about one of them,** the picture shows the setting and the meaning instead: the sea and the dark, a road, a mountain, the weather turning, a lamp, an open book, ordinary people of today living the lesson. The words carry the story.
   - **No figure on screen while the narration speaks of a prophet or a companion or quotes him;** show the place and the light, and bring people in on lines about the viewer. (An ordinary man shown while the voice says «كان إذا قام من نومه» is read as him.)
4. **If the user asks for one, refuse,** in one plain line, and offer the picture that tells the moment without him. For example: «ما نرسم الأنبياء ولا الصحابة، ولا حتى كظل. نخلي المشهد يحكيها: الليل والبحر والضوء.»
5. Figures are ordinary people: the viewer, a father and son, a mother, a worker, a traveller, a crowd at prayer.

## Make a figure
```js
var man = S.figure({ who: "man", outfit: "thobe", head: "ghutra", skin: "tan",
                     x: 370, y: 1700, h: 430, facing: "right", pose: "stand" });
```
`x, y` is the point on the ground under the figure; `h` its height in pixels. The figure that carries the story is about 430 in a 1080×1920 frame; other adults read well at 300–360, a child at 200–230.

| Option | Choices |
|---|---|
| `who` | `man`, `woman`, `boy`, `girl` (children have a bigger head and shorter limbs) |
| `outfit` | `thobe` (white), `thobe_grey`, `thobe_brown`, `thobe_navy`, `bisht` (a dark cloak with a gold edge over the thobe), `modern` (hoodie and jeans), `shirt` (shirt and trousers), `abaya`, `dress` (a long modest dress) |
| `head` | `kufi`, `ghutra` (white, plain), `shemagh` (red check, plain); `igal: true` draws the igal, only when the user asks; `hair`, `hair_long`, `hijab`, `none` |
| `skin` | `light`, `wheat`, `olive`, `tan`, `brown`, `deep`, or any hex |
| `colors` | override any material: `{robe, top, bottom, shoes, head, skin, cloak, trim, prop}` |
| `prop` | drawn with the pose: `box`, `book`, `lantern` (with its own glow), `phone` (lit screen, a cool glow at the hands); held from the start (see § Hands and held things): `jug`, `hoe`, `box_held` |
| `glow` | the starting opacity of the lantern's or the phone's glow (default 1); the glow element is `fig.glow` |
| `seat` | `true` draws a seat under a sitting figure (the poses marked "seat" below) |
| `style` | `"ink"` draws the figure as a line drawing for the paper world |
| `rim`, `outline`, `shadow` | the lit edge toward the light (default on; `rim: {width, strength}` or `false`), the line width, the ground shadow |
| `light` | `{x, y}`: this figure's own light (default: the stage's `light`), see § Light on figures |
| `layer` | default `actors` |

Defaults: a man wears a white thobe and a kufi; a woman an abaya and hijab; a girl a dress and hijab; `modern` and `shirt` come with hair. Women and girls are drawn in modest dress only.

## Poses
| Kind | Poses |
|---|---|
| Standing | `stand`, `look_up`, `raise_hands` (du'a), `point`, `carry` (a box at the chest), `carry_low` (hands at the waist, the load held forward: a tall stack never covers the head), `carry_lamp` (a lantern held out), `reach` (an arm out: a door, a shelf) |
| Seated, back upright | `sit` (on a seat or rock), `sit_wall` (on a low wall: its top at `fig.at("sit_wall").seatH`), `sit_ground` (knees up), `sit_rest` (knees up, leaning back on one hand), `sit_cross` (legs folded on the ground), `grieve` (sitting, head in the hands) |
| A day | `lie` (on the back), `sit_bed` (sitting up, legs out), `to_light` (leaning back on one hand, looking up to a window), `type1`/`type2` (seat, at a desk), `drive` (seat), `phone1`/`phone2` (seat, looking at a phone), `slump` (seat, head low), `hands` (standing, looking at the hands or a phone) |
| Work | `stoop_pour` (bent 24°, the jug held out), `pour` (bent 24°, the jug tilted from the waist), `half_kneel` (one knee down, the back straight), `dig_up`/`dig_down` (a hoe raised, then striking), `lean_hoe` (both hands on the hoe's top), `hand_trunk` (a hand on a trunk or a wall) |
| Study | `sit_read`, `sit_flip` (turning a page), `sit_lost` (sits back, a hand to the head) — all three on a seat; `read`/`read2` (a book held up), `hold_book` (a big book held in front), `shut` (closing it), `write`, `explain`/`explain2` (hands moving while he talks), `think`, `climb` (a rung, a step) |
| **Prayer scene only** | `pray_stand`, `bow`, `kneel`, `sit_heels`, `tend`, `sujood`. Anywhere else they read as bowing or prostrating: the owner on a man watering a palm in `tend`, «كأنه يركع… ما حد يسقي… ما يسجد زي كذا». |

```js
man.pose("look_up", { at: 1.25, dur: 0.6 });       // morph to a pose at a time
man.pose("raise_hands", { at: 3.4, dur: 1.1 });
man.pose({ lean: 10, head: 20, legN: {t: 3, k: 4, af: 1}, legF: {t: -3, k: 4, af: 1},
           armN: {a: 30, e: 60, w: 0}, armF: {a: 20, e: 60, w: 0} }, { at: 4 });   // your own angles
man.alternate("type1", "type2", { at: 2, dur: 3, every: 0.15 });   // a small repeated action
```
Angles in degrees: `lean` the torso (+ forward), `head` (+ down), legs `t` thigh from straight down (+ forward), `k` knee bend, `af` ankle (+ toes up); arms (relative to the torso) `a` upper arm (+ forward), `e` elbow bend, `w` wrist. The figure always stands on the ground: the lowest point of the body is put on `y`.

`fig.alternate(a, b, {at, dur, every, morph, ease, then})` swings between two poses for a small repeated action, so a figure never stands frozen: typing `type1`/`type2` every 0.15 s, scrolling `phone1`/`phone2` every 0.42 s, talking `explain`/`explain2` or reading `read`/`read2` every 0.6 s, digging `dig_up`/`dig_down` (`every` ≈ 0.6, `morph` 0.25).

**The posture rule (the figure carries the story):** the figure is about 430 px of 1920 and acts in every scene (walks, reaches, works, sits down, turns), never only bobbing.
- **Seated = upright:** cross-legged on the ground, on a stone, a wall or a chair, or on the heels with the back within 20° of vertical.
- **Bending = standing,** 30° or less at the waist, head up (`stoop_pour`, `pour`, `dig_down`).
- **Both knees down with the torso forward of the hips only in a prayer scene.** One knee down with the back straight (`half_kneel`) is fine.
- **Head:** a plain ghutra or a kufi. Faceless.
- **A seated stretch with both arms raised reads as hands raised in du'a:** lean back on one hand and look up instead (`to_light`).
- **Picking something up from the ground is not shown with a crouch** (at video size, with the thobe over the legs, a crouch reads as kneeling forward): cut, or put the thing at hand height (a ledge, a rock, a table) and take it from there.

## Walking and running in place
The figure walks or runs on the spot and the world slides past with `S.track()` at the figure's own ground speed, so the feet do not skate:
```js
var speed = father.speedFor("walk", { cycle: 1.25 });
father.walk({ at: 0, dur: 6, cycle: 1.25 });
son.walk({ at: 0, dur: 6, cycle: son.speedFor("walk", { cycle: 1 }) / speed, phase: 0.3 });   // a child steps faster to keep up
S.track({ speed: speed, dir: "right" });        // walkers facing left → the world moves right
```
`run({at, dur, cycle})` works the same way (cycle ≈ 0.6 s). `then: "stand"` ends a walk in a pose. Widen the stage's `span` so the street does not run out (speed × duration).

**Walking while carrying:** `arms` keeps the arms while the legs walk: a pose name (`arms: "carry_low"` takes that pose's arms, `"carry"` the chest carry), `"keep"` (the arms he has when the walk starts), or `{armN, armF}` (leave one out and that arm swings). `lean: -1` sits a load better than the walk's forward lean.
```js
man.walk({ at: 2, dur: 3, cycle: 0.8, stride: 16, arms: "carry_low", lean: -1 });
```

Other moves: `fig.move({x, y, at, dur})` slides the whole figure; `fig.face("left", at)` turns it; `fig.appear({at, dur})` fades it in.

## Hands and held things
**Where a hand is.** Never guess arm angles by snapshot:
- `fig.at(pose, {at})`: every joint of a pose. `.local` is in his own space (px, +x = the way he faces, feet at y = 0, up is negative); `.stage` is on the stage, at his start place and facing, or where `fig.move`/`fig.face` have put him by `at`. Names: `handN handF` (palm centres) `tipN tipF wristN wristF elbowN elbowF shoulder hip buttock headC neckBase neckTop kneeN kneeF ankleN ankleF toeN toeF heelN heelF`; also `foreN`/`foreF` (forearm angles, 0 = down, 90 = forward), `seatH`, `buttockR`, `headR`.
- `fig.handAt(pose, "near"|"far", {at, tip})`: the stage point of a palm (or the fingertips with `tip: true`). Things that sit in a hand go there.
- `fig.reach({x, y, at, dur, hand, tip})`: puts the near (or far) hand on a stage point by solving the two arm angles; the rest of the pose stays. `fig.reached.err` says how far off it landed (more than 0 when the point is out of reach). A teacher's hand on a boy's hand at a slate, a hand on a door: reach it, don't guess it.
- Without a stage: `Khaam.figureJoints("man", "carry_low", 430).local.handN`.

**Holding a thing.** `fig.hold(what, opt)` puts a drawing in his hand; it moves and turns with him and follows every pose, walk and `alternate` key on its own:
```js
var jug = man.hold("jug", { at: 0 });           // by the neck; in both hands, tilted, when he pours
man.pose("pour", { at: 1, dur: 0.8 });
jug.set({ rot: 115 }, { at: 2, dur: 0.6 });     // tip it a little more (until his next pose)
man.pose("carry_low", { at: 3, dur: 0.5 });
man.release({ at: 3.6 });                       // set down: it stays where his hands were
var hoe = man.hold("hoe", { at: 5, take: hoeOnTheWall });   // picked up: the one drawn in the world hides
```
- `what`: a kit thing (`"jug"`, `"hoe"`, `"box_held"`) or your own `function (g, fig) { … }` that draws it into `g` around its grip point, in px (use `fig.H` for sizes and `fig.tint("#hex")` for colours that relight). It is called twice: once in the hand, once for the copy left in the world.
- `opt`: `hand` (`near` | `far` | `both`, the middle of both palms), `grip` (`[x, y]`: the point of the drawing that sits in the hand), `rot` (degrees in his space, + tips its top forward), `aim` (`[x, y]` in heights in his own space: its +x axis points there; `[0.5, 0]` = the ground half a height ahead), `along: "hands"` (its +x axis runs from the far hand through the near hand, for a tool held in both hands with the hands apart), `at` (when it comes into the hand), `take` (an element hidden at that moment), `over` (drawn over the near arm; by default it sits under it, so his near hand closes over it), `poses` (`{pose_name: {hand, grip, rot, aim}}`: how it sits in a named pose).
- The kit things know the kit's poses: the **jug** hangs from the near hand by its neck, sits in both hands in `carry`/`carry_low`, tilts 100° in `pour` and 70° in `stoop_pour`; the **hoe** is planted with both hands on its top in `lean_hoe`, raised behind him in `dig_up`, aimed at the ground ahead in `dig_down`, planted at his side in `stand`; **box_held** sits on both palms, forward of the chest. Add your own as `Khaam.held.name = {opt: function (fig) {…}, draw: function (g, fig) {…}}`.
- `h.set({…}, {at, dur, ease})` changes how it is held until his next pose change (a set at the same moment as a pose change rides on it); `{keep: true}` makes it the default from then on. The angle turns the way the numbers go: 90 → −120 swings the hoe forward and up, never back through his legs.
- `fig.release({at, hold, layer, behind})` (or `h.release({at})`): on that frame the held copy hides and a copy drawn in the world shows at the same spot (`h.world`, a group you may tween: a hoe falling about its blade). Without `hold` it lets go of everything he holds. His place comes from `fig.move`/`fig.face`; if you moved `fig.el` yourself, the copy will not know.
- Put things down at hand height (see the posture rule), and a tall load in `carry_low` with its grip at its bottom-back so it rises in front of the chest, never over the head.

## A phone
`prop: "phone"` draws a small phone between the hands with its screen lit and a soft cool glow at the hands (`phone1`/`phone2` seated, `hands` standing). The glow is `fig.glow`: raise its opacity as the room darkens (`tl.to(fig.glow, {opacity: 1, duration: 2}, 4)`; `glow: 0.4` to start low). The glow stays soft and sits at the hands: no glint, sparkle or bright reflection crosses the face.

## A crowd
```js
var c = S.crowd({ x0: 110, x1: 980, y: 1780, rows: 2, count: 6, h: 260, facing: "right", poses: ["pray_stand"] });
c.pose("bow", { at: 0.6, dur: 0.6 });
c.pose("sujood", { at: 1.6, dur: 0.8, stagger: 0.02 });
```
Repetition with seeded variety (outfit, head, skin, height); back rows are smaller and quieter. Options: `outfits`, `heads`, `skins`, `poses`, `facing: "mixed"`, `rowGap`, `jitter`, `seed`, `igal: true` (only when the user asks). The same rule holds inside a crowd: no member stands for a prophet or companion.

## Light on figures
Colours are tinted by the scene's palette (`ambient`), the side away from the stage's `light` is darker, and a rim lights the edge toward it, so a figure belongs to its night, dusk or dawn. `relight()` re-tints figures with the world.
- **The rim** is a copy of the body in the palette's `rim` colour, pushed toward the light under the outline. By default it shows as a thin band past the outline (about 3 px on a 340 px figure). `rim: {width: 4.5}` sets the whole push in pixels (the band you see is about `width − outline`); `rim: {strength: 1}` its opacity (× the palette's `rimLevel`); `rim: false` none.
- **One light per stage:** every figure's rim and lit side face the stage's `light: {x, y}`, not the nearest lamp or candle. A figure lit by something else (a candle beside it) takes its own: `S.figure({ …, light: { x: 830, y: 1400 } })`.
- The rim and the lit side are set from where the figure stands when it is made; `face()` keeps them on the light's side when it turns, but `move()` does not re-aim them, so give a figure that crosses the light a `light` of its own or `rim: false`.
- **On paper the rim is off:** the `paper` palette has `rimLevel: 0` and no `rim` colour, so figures on paper get no rim. For a lit paper world set both: `Khaam.palette("paper", { rim: "#f3c26a", rimLevel: 0.8 })`. (`style: "ink"` figures never take a rim.)

## Add a pose, an outfit or a headwear
- A pose is an entry in `Khaam.poses` (the angle object above): `Khaam.poses.wave = {…}`. Check where its hands land with `fig.at()` before you look at it.
- An outfit is an entry in `OUTFIT` in `figure.js` (`kind: "robe"` or `"pants"` and its colours); headwear is a function of the head's own coordinates in `HEADWEAR`. Keep every path with a fixed number of points so poses can morph.
- A thing to hold is an entry in `Khaam.held` (see § Hands and held things).
- Test a new pose with `snapshot` and look at it at full size before using it.

## Never
- A face, in any style.
- A prophet or a companion, in any form (see the rule), and no figure on screen while the narration speaks of one or quotes him.
- The igal by default (it reads as a black triangle at video size).
- A prayer pose (`pray_stand`, `bow`, `kneel`, `sit_heels`, `tend`, `sujood`) outside a prayer scene, or a crouch to pick something up.
- A real person's likeness (a known scholar, a public figure): a figure is anyone, never someone.
- Women drawn without modest dress.
- Figures copied from someone else's video or rig. Build from the kit.

Tested on Windows 11 with HyperFrames 0.8.225, 2026-11-11; the 1.7 poses, held things, reach and phone on 2026-11-12.
