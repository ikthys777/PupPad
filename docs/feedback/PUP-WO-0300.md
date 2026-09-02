# PUP-WO-0300 — builder feedback

**Branch:** `build/wo-0300` · **Base:** `main` at `b7bb602` · **Cadence:** build, parked
with a PR open. Written by CC-B (builder-2f).

---

## 1. §0 — the fence, run rather than restated

```
MUST diff to empty: manifest.json, icon-192.png, icon-512.png
  git diff --stat b7bb602 HEAD -- manifest.json icon-192.png icon-512.png
  (no output)

CACHE_VERSION
  b7bb602:sw.js   var CACHE_VERSION = 'v17';
  HEAD    sw.js   var CACHE_VERSION = 'v17';

sw.js changed ONLY inside urlsToCache
  -  './games/hello.js'
  +  './games/hello.js',
  +  './games/gyre.js'

files touched
  games/gyre.js  index.html  sw.js
  .github/ci/demo-gyre.mjs  .github/ci/demo-games-back.mjs
  .github/ci/demo-games-offline.mjs  .github/workflows/ci.yml
```

**No flag-and-stop was triggered.** No bump was needed, nothing outside the MAY list
moved, and Gyre ships **no asset file** — it is a canvas, so the `check-assets`
blindness §7 warns about is not reached. That warning still stands for the next game;
it is not closed, it is simply not touched.

**§0 works and I want to say so specifically**, because it was a structural fix for a
recurring defect. Every section pointed at it and none restated it, so there was
nothing to contradict. That is four work orders' worth of self-contradiction closed by
deleting the duplicates rather than by writing them more carefully.

## 2. Gate 2 — counted, in isolation, and it is THREE

Roadmap P2 gate 2 says adding a game touches exactly three things. Measured by applying
**only** the Gyre addition to a clean clone of `b7bb602` — no `api.tone`, no CI work, so
the number is the game's cost and not this work order's:

```
 games/gyre.js | 789 +++++++++++++++++++++++++++++++++++++++++++++
 index.html    |   2 +      <- one registry entry
 sw.js         |   3 +-     <- one urlsToCache line
 3 files changed, 793 insertions(+), 1 deletion(-)
```

**Northstar invariant 6 survives its first real game.** The module is one file
deliberately: §9.1 constrains `module` to a flat `games/<name>.js`, so splitting
palettes out would have added a second module **and** a second `urlsToCache` line —
five things instead of three, for nothing a child can see.

**One honest asterisk.** Two CI checks had to change, and neither is a cost of adding a
game — they had encoded *which* game was first. Details in §7.

## 3. §2.1 — `api.tone`, built

`grep -c tone index.html` returned 0. It now returns a primitive.

`mk()` and `sw()` are lifted out of `doSound`'s try block to module scope with their
bodies unchanged; they take the context from `getAudioCtx()` instead of closing over
`doSound`'s local, which is the same object and the same `currentTime` read the cues
always made per call. `playTone` clamps everything: 40–4000 Hz, 20–3000 ms, and an
unknown wave becomes `sine` rather than throwing.

**The clamps are not tidiness.** A game module runs in this realm and hands these
values straight to a live `AudioContext`. `0` Hz throws. A negative duration schedules
a stop before its start. 40 kHz for 30 seconds is a sound a three-year-old is wearing
headphones for. Check 16 asserts each of those is clamped rather than passed through,
**and** that the twelve-cue bank still schedules 392/523/659/784 Hz for `chime` — the
bank is what the lift must not break.

**Gyre uses it, and this is the addition I would defend hardest.** A tap's HEIGHT is
its pitch: high on the screen is a high note, low is a low note, quantised to a
pentatonic scale. No reading, no aiming, and **no sequence of taps can sound wrong** —
a chromatic mapping would let a child produce a semitone clash by accident and learn
that the toy sometimes sounds bad. Measured: a tap at 12% screen height gives 1760 Hz,
one at 88% gives 277 Hz.

## 4. §3 — what was added, and what each one refuses

| addition | why a three-year-old cares | what it costs |
|---|---|---|
| **attract / repel** | the field runs from his finger instead of to it | see §5 — it needed more than a sign |
| **randomize everything** | a whole new world for one press, no reading, no aiming | a bounded generator, not a uniform one — §6 |
| **11 palettes, 10 backgrounds** | colour is the one dimension he reads immediately | two backgrounds are light and take the `multiply` draw path; a wrong pairing would be a white rectangle, so the palette darkens itself on light grounds |
| **cycling hues** (`rainbow`, `lagoon`) | the toy is visibly alive with nobody touching it | one modulo per frame; the whole implementation is `hueBaseNow()` |
| **a ring under every tap** | *causation.* A tap moves a few hundred particles a few pixels — a consequence he can miss. A ring is unmissable and starts under the finger | at most 8 alive, one arc each; it also had to be excluded from the burst measurement, which is how I noticed it dominates a quarter-second of the screen |
| **a tone per tap** | §3 above | — |

**§3 said "say why", and the ring is the one I want on the record.** Everything else on
that list changes what the field *looks* like. The ring changes what the child *learns*:
it answers "did I do that?" with an unambiguous yes, in the first 550 ms, at the exact
place his finger was.

**Two things the palettes discrepancy is worth flagging.** §3 says "six palettes and six
backgrounds today". **The source has five of each** — `PALETTE_IDS` and `BACKGROUND_IDS`
in `palettes.ts` and `backgrounds.ts`, counted rather than recalled. Not important in
itself; recorded because it is the same shape as the CI job named `Ten checks` while
running fourteen. A count in prose that nothing recomputes goes stale and a reader
trusts it anyway.

## 5. WHERE THE WORK ORDER'S PREDICTION DID NOT HOLD — attract/repel

**§3 says the flip "is a sign on the force term" and calls it the largest visible change
available from a single control. The first half is exactly right. The second did not
follow, and I could not have found that by reading.**

With only the sign flipped, measured in a browser at the source's own numbers:

```
mean ink distance from the finger, held, force 1.85, linger 0, 900 particles
   after 1.5 s     attract 0.1252    repel 0.1296     <- 3% apart
   after 4 s       attract 0.1195    repel 0.1302
   after 8 s       attract 0.1119    repel 0.1281     <- 14% apart, after EIGHT SECONDS
```

Three things conspire. **The swirl term does not flip**, so the tangential motion that
dominates the look is identical either way. **The damping is heavy** — velocity decays
with a quarter-second time constant — so the radial term only ever buys a slow drift.
And **the field wraps at every edge**, so a particle pushed away returns on the far side
and the distribution re-symmetrises. Both polarities are a swirling soup.

**So repel is SHAPED, not merely signed:** the radial push is multiplied by 2.4 and the
swirl is cut to 0.4, which turns "drifts outward while orbiting" into "runs away".
Attract is untouched and is still the original's number. Measured after:

```
ink in the disc under a held finger, force 1.85, count 2400, linger 30, after 2 s
   attract   37.3% of the disc inked
   repel      0.0%                    <- a knot becomes a hole
```

**This is the latitude of §3 being used for the reason it was granted.** The alternative
was shipping a control that satisfies its description and fails roadmap P3 gate 3, which
asks for a *visible* inversion. **Flagged rather than absorbed** because it changes a
number CC-A wrote, and because "the sign is the mechanism" is the sort of claim that
reads as obviously true and is not.

**One consequence for 0301 to know:** measured at 900 ms the flip makes the disc under
the finger *brighter*, not darker — the knot attract gathered is thrown outward and
every one of those particles draws a long fast stroke straight through it. The hole
arrives at about two seconds. Both are true, they point opposite ways, and check 16
asserts the magnitude at 900 ms and the direction once settled rather than pretending
one of them is the whole story.

## 6. Performance — the number, and what I traded

**Unthrottled, this runner sits at the vsync cap for every setting up to 5000 particles.
That number says the runner is fast, not that the field is cheap, and a regression could
hide entirely underneath it.** So the useful measurement is throttled: a 6× CPU throttle,
which is crude, arbitrary and **repeatable**. It is not the tablet and nothing here
claims it is.

```
6x throttled, size 40 / tail 32 / linger 60
   count  800   59.8 fps        count 1600   37.5 fps
   count 1000   55.1            count 2000   29.9
   count 1200   49.7            count 2200   27.7
   count 1400   42.1            count 2600   25.0
```

**What I traded: the default count is 1200, not the source's 1800.** 1800 is a richer
field and it is 30 fps on the proxy. 1200 is 50. A three-year-old cannot diagnose a
stutter, he can only lose interest, and **the slider goes to 5000 for anyone who wants
more** — the default is where he starts, not where he is kept. If the tablet measures
comfortably above this, raise it; that is one constant.

**And the measurement found a real defect in my own randomizer.** Cost is dominated by
`count`, `size` and `tail` *together* — every particle is a stroke, `size` is its width
and `tail` its length — so the load tracks `count × (1 + size/100 + tail/100)`:

```
6x throttled
   count 1200  size 86  tail 88   ->  37.8 fps     product 3288
   count 1600  size 60  tail 55   ->  33.7         product 3440
   count 1800  size 50  tail 40   ->  31.5         product 3420
   count 2600  size 86  tail 88   ->  17.9         product 7124   <- randomize could draw this
```

**17.9 fps is a stutter nobody chose, produced by the one control a child presses
precisely because he is not choosing.** §3 lists performance among the things the
latitude does not relax, so `randomize` now draws `count` **last**, against a budget of
3400: a fat, long-tailed field gets fewer particles to draw it with. The heaviest field
it can now produce measures **35.9 fps** throttled. The sliders are not bounded by the
budget — a child dragging count to 5000 chose it and can drag it back.

Check 16 enforces both throttled floors, so this trade is a property and not a paragraph.

## 7. Two CI checks had encoded WHICH game was first

**Gyre is `GAMES[0]`.** The picker is 0201's and is not built here, so `openGames()`
mounts the first entry and **the position in that array is what the Games button opens**.
Acceptance 8 requires *console → games → Gyre → play → back* on a cold offline device,
and a Gyre sitting second would ship cached and invisible to the child it was built for.
Reordering data is not building a chooser. **If CC-A reads that differently, it is one
line to swap back — but then acceptance 8 cannot be met until 0201.**

That ordering broke two checks, and **both were already wrong in a way the placeholder
had been hiding**:

- **Check 13** hard-coded `/games/hello.js` in nine places. Every corruption case would
  have gone on overriding a module the shell no longer loads — so the shell would have
  loaded the *real* game, succeeded, and the cases that must end with the surface torn
  down would have failed for a reason unrelated to what they test. It now reads the
  first registry entry's `module` out of `index.html` and **fails closed** if it cannot.
- **Check 14** asserted "the host has text in it" as its definition of *mounted*. That
  was never the property, it was the placeholder's habit. **Gyre draws a canvas and no
  words at all, by design** — invariant 1 is that a non-reader can operate every
  surface, so a mountedness test that requires WORDS fails hardest on exactly the games
  this project is trying to build. It now asserts the module put *something* in the host.

Both are architecture §6.1 member 4 — a pointer that resolved in the author's head and
not in the tree. **Neither is a cost of adding a game**, which is why gate 2's count in
§2 is three and not five.

## 8. Check 16 — and it disagreed with me twice

`.github/ci/demo-gyre.mjs` is PUP-WO-0300 §4 as a check: it reads pixels off the canvas
— how much ink, how much of it under the finger, its mean hue, the colour of the ground
— because those are the terms the acceptance list is written in and the terms a
three-year-old sees.

**It ran red on its first pass and was right both times.** It said attract and repel did
not invert; §5 is that finding. It said `burst` changed nothing; the tap RING was
dominating the disc it measured, so it was reading my own decoration — the sample now
waits for the ring to die at 550 ms, and the difference is `-16.4%` of the ink under the
finger against `-0.9%`.

It runs in a **touch context** on purpose. The sim draws a cursor glow and a dot only
for fine pointers; the tablet never sees either, and with a mouse context that glow
saturated the very disc the check measures — attract and repel came back identical while
looking, to the eye, quite different.

**What it does not establish, stated because a green here is not the whole answer:**
that the toy is fun, and that it holds frame rate on the tablet. The first is Scotty's
and no check can take it. The second needs the device.

## 9. What PUP-WO-0301 needs exposed — §5's question, answered

The seam is **`host.gyre`**, frozen, created at the end of `mount()` and deleted in
teardown. It is a property on the node the shell hands this module and takes back; it
reaches nothing outside the module's own subtree, and it is the same object check 16
drives, so it cannot rot into a fiction.

| control | what it drives | shape it needs |
|---|---|---|
| `count` `force` `burst` `tail` `size` `linger` | `set(key, value)` | a slider each; min/max/step are on `.ranges` |
| `palette` | `set('palette', id)` | a swatch strip; `.palettes` carries `hex` per entry, **so a tile can be the colour it selects — invariant 1 with no label** |
| `background` | `set('background', id)` | the same, `.backgrounds`, which also carries `light` |
| **attract/repel** | `toggle()`, returns the new value | **ONE two-state affordance, not a slider.** It needs an icon that reads as in-vs-out to someone who cannot read |
| **randomize** | `randomize()`, returns the settings it chose | one big button. The return value lets every slider re-render from one call |
| following changes | `subscribe(fn)`, returns its own unsubscribe | so the sliders track `randomize()` without polling |

**One thing 0301 must not do:** re-clamp. Every setter clamps on the way in, from both
directions — a control and a stored blob — and a second set of bounds in the control
surface is two specifications of one range, which drift.

## 10. Open, and not mine

- **The device numbers.** Cold start (P2 gate 5) and Gyre's frame rate. Scotty's.
- **Is the toy fun.** Scotty's, and no check substitutes for it.
- **`check-assets` blind to module-referenced assets.** Not reached here — Gyre ships no
  asset file — and still open for the next game that does.
- **The CSP/iframe question.** Untouched. Check 11's own verdict still says it is not a
  sandbox, and Gyre is now a module with a real reason to be trusted rather than a
  placeholder, which raises the stakes without changing the answer.
