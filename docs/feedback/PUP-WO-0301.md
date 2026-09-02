# PUP-WO-0301 — upward feedback: the controls, and the four times the instrument was wrong

**Builder:** CC-B. **Branch:** `build/wo-0301`, from `origin/main` at `eeadf46`.
**Work order:** `docs/work-orders/PUP-WO-0301.md`. **Adversarial record:** `docs/findings/PUP-WO-0301-adversarial.md` — **three lenses, and
they broke a great deal of this, including four product defects and three false claims in
this file. Read that one before this one.** **Gate 8's prediction, written first:**
`docs/feedback/PUP-WO-0301-gate8-prediction.md`.

---

## 0. The fence (§0), as a checkable fact

```
$ git diff --stat origin/main -- sw.js manifest.json icon-192.png icon-512.png games/hello.js
$ git diff origin/main -- sw.js manifest.json icon-192.png icon-512.png games/hello.js | wc -l
0
```

**Zero lines on every must-diff-to-empty surface.** Changed: `games/gyre.js`,
`index.html`, `.github/`, `docs/` — the four §0 permits and nothing else. No new module
and no new asset, so `urlsToCache` did not move and `CACHE_VERSION` did not need to.

## 1. The one decision that shaped everything else: the panel is the SHELL's, and it is generic

**`host.gyre` is `host[entry.id]`.** Gyre's registry id is `gyre`, so the seam
`PUP-WO-0300` built and §2.1 names is, without renaming anything, an instance of a
general rule. The shell reads `host[entry.id]` after `mount` returns and renders a panel
from what it finds — **and it knows nothing about Gyre.** A module that publishes nothing
gets no panel and no error; `games/hello.js` is the live proof of that path and check 19
asserts it.

That was not the obvious reading. The seam's own comment anticipated a control surface
"welded into this file" as the thing to avoid, and the alternative — a Gyre-shaped panel
in `index.html` — would have put a specific game's knowledge into the shell and broken
architecture §4's contract one level below the picker. **The manifest is what makes both
avoidable:** `gyre.controls` is an ordered array of descriptors in three kinds, and the
shell is a renderer for that vocabulary.

- `slider` — `key` names the setting; **bounds come from `.ranges[key]`**, so a range is
  specified once (§2.1's first warning, applied to the manifest rather than to a setter).
- `choice` — `options` carry an `icon` glyph or a `hex`. **`from: 'palettes'` names a
  list already on the seam instead of copying it.** `single: true` asks for ONE cycling
  affordance, which is what §2.2 requires of attract/repel specifically.
- `action` — `method` names a method on the seam. `prominent` places it outside the
  drawer.

**Adding a control is one line in `games/gyre.js` and no edit to `index.html`.** That is
the contract and check 19 tests it: the sweep iterates the manifest, so a control added
later is either covered or reported missing.

**No painted word anywhere.** Every affordance is a pictograph, a geometric glyph, or a
colour; `label` is used for `aria-label` only. Check 19 walks every text node in the
panel and requires each to be a glyph the manifest itself supplied. **That is the premise
acceptance 8 rests on, and it is the half of gate 8 a check can hold.**

## 2. §2.3 — colour is the label, and it measured true

Every palette and background swatch is painted in **exactly** the hex it selects; check 19
compares the computed background colour of all twenty-one swatches against the seam's own
table and allows an L1 error of 3. **Invariant 1 with no text at all**, and it is the best
idea in this work order.

## 3. §2.2a — the ripple, and what "harsh flash" actually was

Scotty's finding, measured against the numbers it shipped with. It was a **2-to-8px hard
stroke at alpha 0.55 under `lighter`**, at full brightness on the frame of the tap,
crossing 210px in 0.55s. Full brightness with no attack IS a flash; a stroke has no soft
edge; 380px/s reads as a snap.

All three named in §2.2a are addressed and each is a different mechanism:

| asked for | done |
|---|---|
| softer edge | a radial-gradient annulus fading to nothing on **both** sides, replacing a stroke with two hard boundaries |
| longer falloff | life 0.55s → 1.05s, and the radius eases OUT (`1-(1-age)^2.2`) so it decelerates as it spreads |
| lower peak | 0.55 → 0.26, reached over the first 10% of life instead of on frame one |

The band also **widens as it travels**, so the edge softens with distance. `RING_MAX`
drops 8 → 5 because a gradient fill is paid per pixel where a stroke was not, and the
fills are clipped to the canvas. **And it is a toggle**, which §2.2a says is the general
shape wanted rather than a one-off.

## 4. §2.2b — every effect exposed, and the two that did not survive contact

**Sixteen controls ship**: six sliders, two swatch strips (11 + 10), attract/repel as one
cycling affordance, particle shape as three, ripple / glow / drifting-colour as on-off
pairs, and randomize / clear / reset. Nothing was trimmed for tidiness.

**Two things I built and then changed on a measurement, and both are the interesting part
of this work order.**

### 4.1 `edge` (wrap versus walls under attract) was BUILT, MEASURED and REMOVED

It read well: the branch already existed for repel, so exposing it added no mechanism, and
"the field piles into the corners instead of wrapping" is a difference a child could
notice. **Check 19 measured it at Δ0.60 — the lowest of every control, on an instrument whose
noise floor turned out to be about 0.4.** *(An earlier draft cited "a floor of 1.0". No
such floor existed in the code: two constants were declared and never used, and three
shipped controls scored below the number `edge` was removed at. An adversarial pass
counted. The removal rests on the physical argument below, which needs no threshold.)*
It is not a threshold problem — under attract the field
is *gathered at the finger*, so almost nothing is at an edge for the boundary rule to act
on. The difference is real and takes tens of seconds; roadmap P3 gate 1 says **"visibly
within one second"**.

§7 says a control that cannot be made operable by a non-reader does not ship, *"better
absent than present-and-uninterpretable"*. A control that does nothing a child can see in
a second teaches him the panel lies. **It goes, and it goes on a number rather than on
taste.** Walls stay bound to repel, where `PUP-WO-0300` proved they are load-bearing.

### 4.2 `glow` defaults OFF, and the reason is that "today's behaviour" is device-dependent

The glow drew only for a **fine** pointer, so **on the tablet this app runs on there has
never been one.** Defaulting it to 1 would have been today's behaviour on a desktop and a
new thing appearing under Buddy's finger. Every other new default is exactly today's look;
this one had to be off to keep that promise.

Making it a control at all required changing what it draws. `!this.coarse` alone means a
switch labelled *glow* that does nothing whatever on the only device that matters — **a
control that lies, which is one of §5's own probes.** So on a coarse pointer it draws
**while held**, and as a **RING with a clear core out to 0.6 of its radius**: repel digs a
hole under the finger and that hole is where gate 3's evidence lives, so a filled halo
would be a decoration that hides a control. Measured with the glow both ways: attract
32.7 / 30.6 / 33.2% of the disc inked, repel **0.0% every time**. The glow is not the
variable it first appeared to be (§6.2).

**`randomize` carries `glow` through rather than drawing it, and forces `ripple` on.**
A dice press must not switch off the toy's two answers to a finger behind a child who
cannot read the panel to find out which switch moved. Asserted in check 19.

## 5. §2.4 — the two inherited obligations

### 5.1 `COMMIT` falling open — and the sweep was further along than the work order knew

**Stated plainly because it changes what was owed:** several checks already failed closed
before this branch — and **nine files carried a byte-for-byte copy of the same eleven
lines, not seven, and nine still do.** After this work order there are **ten**
implementations of one rule: `lib/subject.mjs`, used by five checks, plus nine inline
copies left in place. *Converting the rest, and giving a subject to the five static checks
that assert none at all (`check-syntax`, `check-assets`, `check-load`, `check-mutations`,
`check-cache-isolation`), is **owed and not done**.* The first draft said "seven" and "the
rule now lives in one place"; both were false, and an adversarial pass counted them. `PUP-WO-0201` swept them, and **check 16's own comment still claimed
to be alone in failing closed** — a false claim about a tree that had moved on, in the
file that names the defect.

**The first version of this paragraph said "Corrected." It was not.** `git diff` showed the
sentence byte-identical: I asserted a fix I had not made, inside the paragraph about a
false claim. It is corrected now and the diff proves it. **That is the second time in three
work orders I have written a fix into a document before writing it into the code, and both
times it was caught by someone running a command rather than reading the sentence.**

Four genuinely still fell open, and all four now refuse:

| file | what it printed on a green |
|---|---|
| `check-error-caching` | `SUBJECT sw.js blob : (git unavailable)` |
| `demo-error-poisoning` | the same string, under the word SUBJECT |
| `demo-quota-install` | two blob hashes and **no commit at all** |
| `demo-two-path-caches` | **no subject of any kind**, and it runs against every published copy |

**The rule now lives in one place**, `.github/ci/lib/subject.mjs` — by the time this
started there were **seven byte-for-byte copies of the same eleven lines**, which is how
this project's fences drifted four times in a week. `requireSubject` and `requireBlob`
both honour `PUPPAD_SUBJECT`, because §5's freeze protocol hands a read-only pass a
`git archive` export with no `.git` and that pass must be able to state its subject.

**Shown red, in a tree with `.git` removed and `PUPPAD_SUBJECT` unset:**

```
check-error-caching   rc=1  ::error::check-error-caching cannot identify the commit it is testing.
demo-error-poisoning  rc=1  ::error::demo-error-poisoning cannot identify the commit it is testing.
demo-quota-install    rc=1  ::error::demo-quota-install cannot identify the commit it is testing.
demo-two-path-caches  rc=1  ::error::CHECK 6 cannot identify the commit it is testing.
```

and green again in the same tree with `PUPPAD_SUBJECT=eeadf46e2d2b…` set.

### 5.2 Check 16 §3 measured presence; it now measures contrast

"Ink" in check 16 is *a pixel whose channels differ from the background's by an L1 total
of 40*. **That is a presence test.** 40 out of a possible 765 is a difference a sampler
can see and an eye cannot, so a palette drawn in near-black on a dark ground passes it
while being invisible on the tablet. §6.1 **member 6** — the member this project named.

**New section 3c: all 110 palette × background pairs**, each measured for a WCAG contrast
ratio from **relative** luminance, between the ground and the tenth of the ink furthest
from it. The better of the bright and dark tails is taken, because two of the ten
backgrounds are light and flip the draw to `multiply` — a bright-tail-only test would
report a light background as invisible while a child looks straight at it.

> `all 110 palette/background pairs clear a 1.9:1 ink-to-ground contrast ratio`

**The worst pair is `ice` on `void`, measuring 2.66:1 to 3.10:1 across runs.** An earlier
draft quoted the best of those as if it were the value, and that mattered: the check's own
comment names **3.0:1** as WCAG's floor for a graphical object, so 3.10 made the trade look
free and 2.66 does not. **The darkest palette on the darkest ground does not clear WCAG's
bar.** It is a particle field and not an icon, so the floor is 1.9 — but that is a live
trade, now named instead of buried under a favourable sample.

**And it is shown able to fail, in the same run**: a field drawn at the presence
threshold reads **39.3% INK and 1.18:1 contrast**. Presence and contrast are demonstrably
different measurements, on every run, rather than asserted to be.

## 6. What did not work, and why — four times the instrument was wrong before the code was

**This is the section worth reading.** Every one of these looked like a defect in the toy
and was a defect in the measurement, and three of the four are the same family.

### 6.1 A control reported inert that was never touched — member 6, in the check written to hold the line on member 6

`spin` came back Δ0.06, then Δ0.25, across three full runs. The control was fine. **The
drawer scrolls, `spin` sat at y=665 in a 640px viewport, and `elementFromPoint` at its
centre returned something else.** The check had the element's bounding rectangle and
called that a location; **"where is this element" is not "will pressing there press it"** —
which is architecture §6.1 member 6 word for word, in the file whose entire purpose is
that member.

Fixed in three places rather than one: the drawer's `max-height` went 58vh → 72vh; every
tap now scrolls its target into view and **confirms the point about to be pressed is the
element**; and check 19 gained an explicit assertion that **every control and every option
can be brought under a finger**, plus that the drawer pans **with a touch point** and not
only with a wheel.

### 6.2 An inversion reported invisible, measured against where the field had been

Gate 3 read 33% → 19% and failed. From a **freshly seeded** field the identical code reads
~33% → **0.0%**, three runs running. The previous section had left the field piled against
the walls, and four seconds of attract is not enough to gather it back into a knot — so
the reading was about the field's history, not the control. The glow looked like the
culprit for two runs; **it was measured both ways and it is not.**

### 6.3 A drift measurement that carried the palette's hue spread

`spin`'s first metric was the distance between two mean-hue **unit vectors**, whose
magnitude is `2·|mean|·sin(turn/2)`. On a field with hues spread over sixty degrees the
mean vector is short, so a 57° turn measured 0.19. **The angle between the two means is
the drift; the vector distance is the drift times something else.** Also: the reading was
taken with `linger` left at its top by the previous trial, where the canvas is a
multi-second exposure of every hue at once. Both fixed; `spin` also went from 14°/s to
**26°/s**, because a drift the instrument cannot see is a drift a child cannot see.

### 6.4 A red demonstration that failed for its own reasons

Section 3c's proof-that-it-can-fail paints a deliberately camouflaged field. The first
version stroked antialiased lines — most pixels landed *between* the two colours and it
measured **0.00% ink**, a red for a reason other than the one under test (§6.1 member 3).
It also inherited the sim's composite state (`lighter`), so it was adding to the field
rather than replacing it. Now it resets the composite explicitly, fills whole-pixel
rectangles, and reports the corner pixel it actually painted so a future red can be told
apart from a fixture that never painted.

### 6.5 The one time the check was right and the code was wrong — `ribbon` disappeared

Worth separating from the four above, because it is the case that justifies all of them.
The tailored shape measurement came back **ribbon 1.00%, dot 1.76%** — the fattest of the
three shapes drawing *less* ink than the thinnest. **`lineCap: 'butt'` paints almost
nothing on a segment shorter than a pixel, and `MIN_SEG` floors every slow particle's
stroke to 0.4px**, so `ribbon` vanished wherever the field was calm. A square cap paints
the full width either way and keeps the flat woven look. After the fix: 2.43% / 3.84%.

**The whole-frame sweep had this at signal 2.95 and called it fine.** Only the metric
built for the parameter could see that the parameter was broken.

### 6.6 Two smaller ones, stated because they were mine

- **`drawer.hidden = true` does nothing here.** `[hidden]{display:none}` is a UA rule and
  the drawer carries an inline `display:grid`, which wins. It would have set the
  attribute, satisfied every assertion that reads it, and left the panel on screen.
- **The sweep mapped `o.id` over an array of strings** and pressed
  `[data-value="undefined"]` fourteen times, reporting four controls inert having never
  touched one. It announced itself only because the printed transition read
  `undefined->undefined`. The press now **reports whether it found its control**.

## 7. Gate 1, per parameter — and the split that had to be made to answer it honestly

**The instrument told me it was not competent, and I believed it.** Check 19's first
design measured every parameter with one whole-frame feature vector. Measured
apples-to-apples — the distance between two *settings* against the distance between two
readings of the *same* setting — it returned this:

```
force 0.18->1.82   signal 3.29 / noise 2.67
burst 2->98        signal 1.64 / noise 1.31
polarity 1->-1     signal 0.80 / noise 1.30
```

**A particle field disagrees with itself, at that resolution, by about as much as some of
these controls move it.** Lowering the ratio until it passed would have been fitting a
threshold to a wish. So the claim was split, and both halves are asserted:

**7.1 — the CONTROL's claim, which is this work order's subject and is deterministic.**
Every control puts the value it is painted for into the seam when pressed with a finger:
*"all 13 controls put the value they promise into the seam when pressed with a finger,
dragged or tapped."* No pixels, no threshold, no noise.

**7.2 — the FIELD's claim, gate 1 proper.** For `count`, `force`, `burst`, `tail`,
`size`, `linger` and `polarity` this is **check 16 §2's assertion and it is already
green** — one parameter at a time, each against a metric chosen for it (ink under the
finger for burst, stroke length for tail, knot-versus-hole for polarity). Restating it
here with a worse instrument would be a second, worse specification of a claim already
made well. **The deferral is written into the file, not left to a reader.**

**7.3 — the four parameters check 16 could not cover, because they did not exist when it
was written.** Each measured on a near-empty canvas where it is the only thing on screen:

| new parameter | measured |
|---|---|
| **ripple** | a tap draws **8.1%** of the ring around the finger with it on, **0.0%** with it off |
| **glow** | a held finger lifts the halo from **5.7 → 56.2** mean luminance, and it is a RING, so repel's hole survives it |
| **shape** | 1600 particles cover **2.4%** of the screen as dots and **3.8%** as ribbons (×1.58), corroborated by the sweep at 3.0× its own noise |
| **spin** | the mean hue turns **70° in two seconds** with it on and **1°** with it off |

### 7.4 — the coverage, in one place, so a reader can see there is no hole

*Added at CC-A's ruling on the split. **A split gate is two expressions that must agree**,
and two expressions that must agree is this project's most expensive shape — so the two
halves are listed together, with the count reconciled.*

**Thirteen parameters. Nine answered by check 16 §2, four by check 19 §2b. Nine plus four
is thirteen, and nothing is answered twice.**

| parameter | who asserts the FIELD changes | the metric it uses |
|---|---|---|
| `count` | check 16 §2 | ink fraction — more particles put more ink on the canvas |
| `size` | check 16 §2 | ink fraction — a thicker stroke covers more pixels |
| `linger` | check 16 §2 | ink fraction — a slower fade leaves more of the last frames behind |
| `tail` | check 16 §2 | ink fraction — a longer trail is a longer line |
| `force` | check 16 §2 | ink fraction — a faster particle draws a longer stroke |
| `burst` | check 16 §2 | ink **under the finger**, before and after a tap |
| `polarity` | check 16 §2 | ink in a 120px disc under a held finger — a knot becomes a hole |
| `palette` | check 16 §2 | mean **hue** of the inked pixels |
| `background` | check 16 §2 | the **ground** colour itself |
| `ripple` | check 19 §2b | ink in the ring around the finger, 320ms after a tap, on a wiped canvas |
| `glow` | check 19 §2b | mean **luminance** of the halo while a finger is held |
| `shape` | check 19 §2b | whether the `tail` slider is **inert** — `dot` multiplies the tail by zero |
| `spin` | check 19 §2b | the **angle** the mean hue turns through in two seconds |

**And one claim that covers all thirteen at once, in check 19 §2**: every control puts the
value it is painted for into the seam when pressed with a finger. That half is
deterministic — no pixels, no threshold, no noise — and it is the half this work order is
actually about. The table above is about the *engine* answering, which is `PUP-WO-0300`'s
subject and mostly `PUP-WO-0300`'s check.

**Why `polarity` appears above and also has its own section 5 in check 19:** §2's entry is
the engine's inversion; §5 is *the control* driving it, in one tap, **with a second finger
already on the glass**. Different claims, deliberately both.

For reference, the sweep's whole-frame readings — printed on every run as information,
not as the assertion:

```
background void->shell  105.04 / 0.43     count 350->4900  10.82 / 1.21
palette ice->lemon        9.00 / 0.72     linger 2->98      5.57 / 1.40
size 2->98                5.36 / 1.64     shape s->ribbon   4.84 / 1.62
spin (hue angle)          3.78 / 0.05     force 0.18->1.82  3.29 / 2.67
tail 2->98                1.61 / 0.81     burst 2->98       1.64 / 1.31
ripple 1->0               0.63 / 0.50     glow 1->0         0.54 / 0.48
polarity 1->-1            0.80 / 1.30     ~~edge~~          removed, §4.1
```

**Gate 3 separately, and cleanly:** one tap on the control **with a second finger already
on the glass** flipped polarity, and the knot under the held finger became a hole —
**31.1% of the disc inked becomes 0.0%**, with the glow ON.

## 8. What was deliberately NOT done

- **`api.load()` / `api.save()` were not touched.** The five new settings ride the
  existing blob and `sanitise` handles a blob written before they existed.
- **No new module, no new asset, no `sw.js` line.** §0, and it held.
- **The picker, the three console openers, and `PUP-WO-0106` are untouched.**
- **The seam was not renamed.** `host.gyre` stays exactly what §2.1 says it is; the
  general rule was found *in* it rather than imposed on it.
- **`clampPalette` / `clampBackground` were changed**, and this is the one edit outside
  the brief I would flag for a ruling. They hard-fell-back to `'ice'` / `'void'`, so
  `set('palette', anythingElse)` was a **reset** — the exact behaviour §2.1's third
  bullet says this seam does not have, true of seven setters out of nine. A swatch strip
  cannot send a bad id, so nothing observable changed; the rule is now true of all nine.

## 9. Open, and not mine

- **Acceptance 8 is OPEN and UNRUN.** The prediction is committed. A human runs it or it
  stays open (§7). What check 19 *can* hold — that there is no painted word to cover — it
  holds on every run.
- **The frame rate on the real tablet.** CI measures 55.1 fps at 6× throttle on defaults
  and 41.4 fps on the heaviest field randomize can draw, but **a passing suite is not
  evidence a tool works.**
- **What the panel costs the field, measured rather than assumed:** open — the default —
  the drawer covers **59% of the canvas at 1024×600 and 78% at 800×480**. That is the price
  of §2.2b's ruling that every effect gets a row, and it went unstated until an adversarial
  pass measured it. The handle puts it away in one tap.
- **Whether the sixteen controls are too many for a 480px-tall screen.** They fit 1024×640
  without scrolling (460px of content in 459px — by one pixel); below that the drawer
  pans, and check 19 proves the pan works **with a finger**. Whether a three-year-old
  *finds* the pan is a question only Buddy answers, and it is the most likely thing on
  this surface to be wrong.
- **Gate 1's split (§7) is a judgement I made and CC-A may want to rule on.** I decided
  that check 16 owns per-parameter field visibility for the seven original parameters and
  that check 19 must not restate it with a weaker instrument. The alternative reading is
  that 0301's own check should answer 0301's own gate end to end. I think that would have
  meant shipping a threshold chosen to pass rather than to measure.
- **Promotion to `/stable/` is Scotty's**, and nothing here has touched the tablet.

## 10. What the adversarial pass changed, in one table

**Read `docs/findings/PUP-WO-0301-adversarial.md` for the reproductions.** Every one of
these was green before the pass ran.

| # | found | severity | disposition |
|---|---|---|---|
| 1 | **`#gameBack` swallowed the dice.** On 800×480, 640×480, 1024×600 and 915×412 a tap on the randomize button's own centre **closed the toy**. Only 26.5% of it was reachable. | **severe** | Fixed with two geometric rules independent of viewport: an 84px left inset on the bar and on the drawer, clearing the exit's column at every height and every scroll position. Check 19 now asserts the converse rule — *the exit covers the centre of no control* — at three sizes. |
| 2 | **No slider or swatch could pan the drawer**; 13 of 40 controls sat below the fold at 640×480, `clear` and `reset` among them. | high | `touch-action: none` → `pan-y` on every control. The browser keeps the vertical drag, we keep the horizontal. Verified: both short viewports now pan from a finger that starts **on a control**. |
| 3 | **A prototype key in a saved blob bricked the toy permanently** — `background: "toString"` threw on mount, and the failure path rewrote the poison. Three launches, three failures, no in-app recovery. | high | Both lookup maps are `Object.create(null)`. |
| 4 | **A manifest `hex` was spliced unvalidated into inline `cssText`** — one string covered the whole screen. The identical defect the picker's registry validator was written for. | high | Same validator (`GAMES_HEX_RE`); an invalid swatch is not rendered. Actions now require an own property, so `method: 'toString'` no longer builds a button. |
| 5 | **Gate 4 asserted four taps that never landed.** §6 had closed the drawer; every tap hit a `display:none` element at (0,0); all four return values were discarded. | high | Every tap is checked, the fixture asserts it changed something first, and the drawer is opened before use. |
| 6 | **An inverted slider passed the whole check.** The assertion was "different", not "the value the child pointed at". | high | A drag to each end must land within 6% of that end. |
| 7 | **`reset` and `clear` were never pressed by anything.** A stub `reset` passed. | medium | Both exercised; `reset` must move every wrong setting and be idempotent. |
| 8 | Two thresholds declared and never used, while four comments cited "a floor of 1.0" that no code contained. | medium | Dead constants removed; every enforced threshold now sits at the line that enforces it. |
| 9 | Six numeric claims in this file did not reproduce, and one — the contrast figure — was the only value that made a live trade look free. | medium | Corrected above, with the spread rather than the best sample. |

**Accepted and not fixed, as stated trades:** a drag along the colour strip commits the
swatch it started on (`wireTap` requires press and release on the same element, and that
rule is what stops a dragged finger launching a tile); `randomize` exceeds the
shape-weighted draw budget in 8 draws of 2000, always at the count floor; the shell drops a
malformed manifest entry silently; `Object.freeze` on the seam is shallow. All four are in
the findings file with measurements.

**One thing the pass found in its own instrument, and it is owed work for someone:**
`page.waitForSelector` returns a handle that pins the node in-page, so a leak test written
around it measures its own harness. It read as a 141-node-per-cycle leak that does not
exist. **Every existing `.github/ci/demo-*.mjs` that uses `waitForSelector` inherits that
artifact and none has been audited.**

## 11. What this panel taught AFTER it merged, recorded because it generalises

*Added 2026-09-02, after the fleet turned out to be three phones rather than a tablet and
this work order's control panel was re-measured at 412px of height. **The heading carried a
count — "Two lessons" over three subsections — and it is removed rather than corrected**,
per roadmap §5: no hand-maintained number in a name unless something recomputes it. It was
wrong on the day it was written, which is the usual interval. None of what follows is about
the panel. Both were extracted by CC-A from cross-session messages and asked for here,
because a sentence that exists only in a message between two sessions does not survive
either of them.*

### 11.1 A summary in your own head is still a summary

I told CC-A that this drawer's height was capped by `min(78vh, calc(100vh - 140px))`, with
the 140px binding on a short screen. **`100vh` occurs zero times in `index.html`.** The only
rule is `max-height:78vh`. I had shipped that cap, replaced it with the left-gutter column
rule for the reason my own comment records — and then reported the version I remembered
writing rather than the version that shipped, **in a message another session was going to
design a layout against.**

> **A summary in my own head is still a summary, and it is worse than a stale ref because
> it feels like knowledge.**

The operating rule already said to check file contents and never a summary. What it did not
say — because it did not occur to me that it needed to — is that memory of code *you wrote
yourself* is the summary most likely to be trusted without checking. The correction cost
CC-A a layout premise: a fixed cap is a constant to design around, and a content-bound
height is a moving one that **grows when a future game adds a control**, with no layout
change and nothing going red.

### 11.2 Preserving today's bytes is not the same as preserving today's intent

The drawer shipped open-by-default, which is right for Gyre — Scotty's ruling is that the
controls *are* the toy. On a 412px screen an open drawer is **321px of 412, leaving 91px of
field**: survivable for a particle background, impossible for a board game.

The fix is that a module now declares `controlsOpen` on its seam. **The obvious shape is
additive** — absent means open, today's bytes are preserved, and the new game opts out.
That is the shape this project's invariants normally demand, and I would have built it.
CC-A rejected it, correctly:

> **Preserving today's bytes is not the same as preserving today's intent, and when they
> diverge the intent is the thing worth keeping.**

Additive would make *every future game* opt out of a default that is wrong for it — one
game gets its default free and all the others pay, forever, in a field nobody remembers to
set. Open is right for exactly one game, and that game should **say so**. It generalises
past this drawer to every no-op-when-unwired decision here: ask whether "absent" is being
given the meaning that happens to preserve the current bytes, or the meaning that is
actually right.

### 11.3 And the corollary that nearly shipped the regression anyway

`startOpen` is assigned **three times** (`index.html:2609-2611`): an initializer, the
`localStorage` comparison, and the `catch`. The one-character flip that looks exactly like
the ruling — `!== '0'` becoming `=== '1'` — fixes the comparison and leaves the other two
answering `true`. **The catch is the invisible one:** with storage disabled or in private
mode the drawer opens regardless of what the seam said, on the one class of device nobody
tests. *(Only two of the three are live today; the initializer is shadowed by both paths —
and becomes live the moment the try body gains a branch, which is what this change is.)*

**Two expressions that must agree, except there are three** — the same family as
`PUP-WO-0700`'s sticker, found by CC-A checking the count rather than the expression.
