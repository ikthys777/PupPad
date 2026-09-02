# PUP-WO-0300 — builder feedback

**Branch:** `build/wo-0300` · **Base:** `main` at `6eb40de` (merged in) · **Cadence:**
build, parked with a PR open. Written by CC-B (builder-2f).

**Read `docs/findings/PUP-WO-0300-adversarial.md` first if you only read one.** The
adversarial pass found **three DISQUALIFYING defects**, one of them live on the tablet
today, and this document is the corrected account. Every number below was recomputed at
the commit it describes — an earlier version of this file measured against the parent
commit and pasted forward, which is the defect it cites in §4.

---

## 1. §0 — the fence, run at HEAD

```
MUST diff to empty: manifest.json, icon-192.png, icon-512.png
  git diff --stat 6eb40de HEAD -- manifest.json icon-192.png icon-512.png
  (no output)

CACHE_VERSION       6eb40de:sw.js  v17        HEAD sw.js  v17

sw.js changed ONLY inside urlsToCache
  -  './games/hello.js'
  +  './games/hello.js',
  +  './games/gyre.js'

files touched
  games/gyre.js  index.html  sw.js
  .github/ci/demo-gyre.mjs  .github/ci/demo-games-back.mjs
  .github/ci/demo-games-offline.mjs  .github/ci/check-games-offline.mjs
  .github/ci/check-games-offline-controls.mjs  .github/workflows/ci.yml
  docs/feedback/PUP-WO-0300.md  docs/findings/PUP-WO-0300-adversarial.md
```

**No flag-and-stop was triggered.** No bump was needed, nothing outside the MAY list
moved, and Gyre ships **no asset file** — it is a canvas — so §7's `check-assets` blindness
is not reached. That warning stands for the next game; it is not closed, it is not touched.

**One correction to my own praise of §0.** I wrote that "every section pointed at it and
none restated it". §7 restates two of the three clauses in flag-and-stop form. They agree
with §0, so the mechanism did its job — but the whole value of §0 rests on "none restated
it" being literally true, and it is not.

## 2. Gate 2 — three, recomputed at HEAD

Measured by applying **only** the Gyre addition to a clean clone of `6eb40de` — no
`api.tone`, no CI work — so the number is the game's cost and not this work order's:

```
 games/gyre.js | 1040 ++++++++++++++++++++++++++++++++++++++++++++++++++
 index.html    |    2 +      <- one registry entry
 sw.js         |    3 +-     <- one urlsToCache line
```

**Northstar invariant 6 survives its first real game.** One file deliberately: §9.1
constrains `module` to a flat `games/<name>.js`, so splitting palettes out would have added
a second module **and** a second `urlsToCache` line — five things for nothing a child sees.

**Two CI checks also changed, and neither is a cost of adding a game.** They had encoded
*which* game was first. See §7.

## 3. §2.1 — `api.tone`, built, then corrected twice by the pass

`grep -c tone index.html` returned 0. `mk()` and `sw()` are lifted out of `doSound`'s try
block with their bodies otherwise unchanged — **each gained one line**, `var c =
getAudioCtx();`, which the first draft of this file called "unchanged". The substantive
claim holds and is verified: `c` was already read once per `doSound` call and
`c.currentTime` once per helper call, so the twelve cues are unaffected, and check 16
asserts `chime` still schedules 392/523/659/784 Hz.

**A note on the work order's own citation.** §2.1 cites `index.html:62-68` and `:69-75` for
`mk()` and `sw()`. Those were correct when CC-A wrote them and are **stale now — because of
this work order**, which moved both. They are at `:66` and `:75` today and will move again.
Cite the symbols.

**Two findings against what I built, both fixed:**

- **`findings §8.6` rules that a cue stops "in under a second — so nothing can outlive
  `teardown`".** `api.tone` raised that to three seconds, and `endGameSession` touched no
  audio at all. §8.1 lists "media resource" among what teardown must release. There is now
  a registry of tones started through `api.tone`, stopped at teardown.
- **One call was clamped; the sum was not.** Gain is fixed at 0.12, so ~8.3 simultaneous
  notes reach full scale and **ten peak at 1.16 and hard clip** — which is ten fingers
  landing together, i.e. a child drumming. Capped at six voices. The ceiling dropped from
  4000 Hz to 3000: 4000 sat at the peak of the ear's sensitivity, making it the
  loudest-*perceived* note the primitive could make, the opposite of what a bound described
  as "a child's ears" is for. Gyre's top note is 2217 Hz, so nothing shipped changed.

**Two attempts at the voice registry made the toy permanently silent** before the third
worked. `onended` never fires on a suspended `AudioContext`, and neither does its clock
advance — so both an event-based and an audio-clock-based expiry left the registry full.
It prunes on the wall clock, and **check 16 asserts exactly six, not at most six**, because
a number *under* the cap is the silent failure.

**Gyre uses it, and this is the addition I would defend hardest.** A tap's HEIGHT is its
pitch, quantised to a pentatonic scale so no sequence of taps can sound wrong. Measured:
12% screen height → 1760 Hz, 88% → 277 Hz.

## 4. §3 — what was added, what each refuses

| addition | why a three-year-old cares | what it refuses |
|---|---|---|
| **attract / repel** | the field runs from his finger instead of to it | repel is no longer the same quantity as attract — ×2.4 radial, ×0.4 swirl — so above force 0.77 repel exceeds anything attract reaches at maximum, and the source's *gentle* outward drift is unreachable at every slider position |
| **randomize everything** | a whole new world for one press | the extremes of five sliders: the sparse field, the hard flicker, the 5000-particle blizzard are outside the surprise. For a non-reader whose only zero-effort control is the dice, that is a real part of the toy he reaches only by dragging |
| **11 palettes, 10 backgrounds** | colour is the dimension he reads immediately | the two light grounds cost **roughly half the contrast**, on 20% of presses — every one of the 22 light pairs sits in the bottom 22 of 110, worst `lemon/fog` at CR 2.26 against `lemon/plum` at 5.86, with chroma roughly halved. Nothing is invisible; `lemon` on `fog` reads as flies rather than as lemon |
| **cycling hues** | the toy is visibly alive untouched | two of eleven palettes cannot be *held* at a colour, so "I want the green one" is unavailable for those two |
| **a ring under every tap** | **causation** — it answers "did I do that?" unmissably, under the finger, in 550 ms | 550 ms of every future burst measurement. Decoration that must be excluded from a measurement will mislead the next person measuring — it already misled mine |
| **a tone per tap** | §3 above | see §3's cap |

**The work order says "six palettes and six backgrounds today". The source has five of
each** — `PALETTE_IDS` and `BACKGROUND_IDS`, counted. Same shape as the CI job named `Ten
checks` while running fourteen.

## 5. Where the work order's prediction did not hold — attract/repel

**§3 says the flip "is a sign on the force term" and calls it the largest visible change
available. The first half is exactly right. The second did not follow.** With only the sign
flipped, measured in a browser at the source's own numbers: **3% apart after 1.5 s, 14%
after eight seconds.** The swirl term does not flip, the damping has a quarter-second time
constant, and the field wraps, so a repelled particle returns on the far side. Both
polarities are a swirling soup.

So repel is **shaped**, not merely signed. Held, it takes the disc under the finger from
**37% inked to 0.0%** — a knot becomes a hole.

**And shaping it exposed something worse, which is finding D3.** See §6.

## 6. The three DISQUALIFYING findings

Full detail in `docs/findings/PUP-WO-0300-adversarial.md`. In brief, because a merge
decision should not require the other file:

1. **The way back was dead with a second finger on the glass**, and dead for any tap that
   slid more than ~15 px. Wired on `click`, which a browser does not synthesise in either
   case. **`elementFromPoint` returned `#gameBack`, 64×64, throughout** — the project's
   reachability test is the right question at the wrong layer, and across both games checks
   **the button had never once been pressed with a finger.** Fixed on pointer events.
   **It was live on the ROOT build only, not on the tablet** — `refs/heads/stable` has zero
   occurrences of `gameBack`, zero of the registry and no `games/` directory, so the games
   host does not exist on the promoted copy. I claimed otherwise without checking; the
   firebreak contained the first child-trapping defect since the split existed, on its
   first real test. See the findings document.
2. **The exit sat on top of the Settings button**, so a double-tap opened the adult
   Supabase panel — two text inputs and two word-labelled exits a non-reader cannot leave.
   Moved 52 px clear.
3. **Randomize produced an all-black screen on half of all presses**, in 30 seconds,
   unrecoverable by touch. **Not dimness — the whole field migrated into the twenty-pixel
   margin outside the canvas** that the wrap needs to hide its seam. Particle 0 at exactly
   (920, 660) on a 900×640 canvas, 1200 strokes a frame all drawn off-screen. My first fix
   was aimed at stroke length and did nothing; instrumenting the module found the real
   mechanism. Repel now has walls; attract keeps the torus, unchanged.

**And check 16 could not see any of them.** It measured one of the five resource words its
`ok` line claimed, keyed listeners on `fn.name` while discarding the capture flag, ran one
open/close cycle, and sampled randomize 700 ms after a reseed — the field at its most
spread, which is structurally unable to observe a steady state. All four are fixed and each
fix was verified **red** against the code it now catches.

## 7. Two CI checks had encoded WHICH game was first

**Gyre is `GAMES[0]`.** The picker is 0201's, so `openGames()` mounts the first entry and
the position *is* what the Games button opens; acceptance 8 requires *console → games →
Gyre → play → back* cold and offline. Reordering data is not building a chooser. *(Noted:
0201 now rules that the picker opens even with one game. That does not change this — until
it ships, position is the only selector there is.)*

- **Check 13** hard-coded `/games/hello.js` in nine places, so every corruption case would
  have overridden a module the shell no longer loads. Now reads the registry, fails closed.
- **Check 14** used *"the host has text in it"* as its definition of mounted — never the
  property, just the placeholder's habit. **Gyre draws a canvas and no words at all**, by
  design, so that test failed hardest on exactly the games this project is trying to build.

Both are architecture §6.1 **member 3** — a failure whose cause is not the one under test.
*(I labelled them member 4 first. Member 4 is a dangling pointer; `hello.js` resolved, it
was simply no longer the file under test.)*

## 8. Performance — the number, and the trade

Unthrottled this runner sits at the vsync cap for every setting up to 5000 particles, which
says the runner is fast, not that the field is cheap. **6× CPU throttle**, crude, arbitrary,
repeatable *on one machine* — a reviewer measured the same throttled default at 39.9 fps on
his box against 49.7 on mine, and identical settings varying **27% run to run**. So check 16
takes the **median of three**, prints the spread, and sets its floors for a runner slower
than either of ours. **The number to watch is the one printed, not the pass.**

**What I traded: the default count is 1200.** The source ships 1800; my own first commit on
this branch shipped **1600**, and the throttled measurement lowered it again — the trade
against the source is the flattering framing, and both numbers belong here.

**The same measurement found a defect in my own randomizer.** Cost tracks
`count × (1 + size/100 + tail/100)`; randomize could draw `count 2600, size 86, tail 88` at
**17.9 fps** — a stutter nobody chose, from the one control a child presses *because* he is
not choosing. `count` is now drawn last against a budget of 3400, **floored to the step**
(rounding to the nearest 50 previously let the drawn value exceed the budget it was
described as respecting).

**One honest caveat on that model:** a reviewer showed it mis-weights its dominant term —
`1500/70/70` (product 3600) runs *faster* than `1800/50/40` (product 3420) in both his
measurements and my own table. Count dominates more than the formula says. It is
conservative here by luck rather than by design, and it is a heuristic bound, not a law.

## 9. What PUP-WO-0301 needs exposed

The seam is **`host.gyre`**, frozen, created at the end of `mount()` and **dead** after
teardown — not merely deleted. A captured reference used to mutate settings, create an
unowned timer, refill the watcher array and **overwrite the child's saved settings after he
had left**; every method now refuses.

| control | what it drives | shape it needs |
|---|---|---|
| `count` `force` `burst` `tail` `size` `linger` | `set(key, value)` | a slider each; min/max/step on `.ranges` |
| `palette` / `background` | `set(…)` | swatch strips; `.palettes` and `.backgrounds` carry `hex`, **so a tile can be the colour it selects — invariant 1 with no label** |
| **attract/repel** | `toggle()` | **ONE two-state affordance**, not a slider; an icon that reads as in-vs-out to a non-reader |
| **randomize** | `randomize()` | one big button; it returns the settings it chose |
| **clear trails** / **reset** | `clear()` / `reset()` | the two the source shipped and the seam was missing |
| following changes | `subscribe(fn)` | returns its own unsubscribe |

**Three things 0301 must know:**
- **Do not re-clamp.** Every setter clamps from both directions; a second set of bounds is
  two specifications of one range.
- **A bad value is a no-op, not a reset.** `set('count', someInput.value)` on a
  non-numeric string used to snap to the factory default while `set('tail', …)` held its
  ground. Both now hold.
- **Nothing that can throw may sit between the first listener and the returned closure.**
  The shell assigns `gameSession.teardown` only after `mount` RETURNS, so a throw in that
  window leaves it reporting a clean recovery over a running sim. The window is now closed
  by a `try` that releases and rethrows — keep new code inside it.

## 10. Open, and not mine

- **The device numbers**, and **whether the toy is fun.** Scotty's, and no check takes them.
- **Check 16 §3 still measures ink presence, not ink-versus-ground contrast** — a palette
  rendering near-black on a dark ground would pass. Named rather than half-built.
- **A tier-1 token hidden from check 11's stripper is a note on the passing path.**
  Promoting it to red reverses a design decision check 12's PART D pins. **CC-A's ruling.**
- **`supabaseFetch` is a global, pre-authenticated network client in every module's scope.**
  Not new and not Gyre's, but the strongest single argument for the CSP/iframe question,
  and written down nowhere until now.
- **The sibling checks all fall open on an unresolvable commit** (`COMMIT = 'unknown'`,
  exit 0). Only check 16 was made to fail closed; changing the others is not this WO's.
- **`check-assets` blind to module-referenced assets** — not reached here, still P3-blocking.
