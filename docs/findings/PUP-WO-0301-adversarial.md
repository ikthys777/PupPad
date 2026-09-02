# PUP-WO-0301 — the adversarial pass, and its disposition

**Subject frozen at `e121cb09d020eda4c24a1631743600ec058114b3`**, exported with
`git archive` — no `.git`, so committing was inexpressible from inside the pass. SHA-256
of every deliverable recorded at freeze:

```
868bec16dc7e76d8ad050352494692e437f42252daf3c8fb5040ae22b7e9a518  games/gyre.js
1a9c26a7376e5bb92b931368e9c6ffad3e36dd38c93bca58e7e4503603a15466  index.html
aeeb96db105bd4345a2d805f99138ed2dc6268f8c9c227f7664f2b48b7eb5325  .github/ci/demo-controls.mjs
1fe2afd0505879f319e8fba1553463046d34da8b1106416d1520c4297e1faf28  .github/ci/lib/subject.mjs
62ed70706cf39bd2703747ec19b5efd91741d567e0eff4f592193719a23fbee0  docs/feedback/PUP-WO-0301.md
bc1458a1581c889c87ab00b1b1d745f2691ae7477a9a5f11b2d2298130918cc3  docs/feedback/PUP-WO-0301-gate8-prediction.md
```

**Three lenses, run black-box and in parallel**, each told to break the work and to report
only what it could demonstrate. **The feedback file was handed over as a deliverable under
review**, per §6.1 member 5 — and that lens produced the findings I would least have found
myself.

| lens | what it was pointed at |
|---|---|
| **A — the hand** | every control, pressed with a real finger, two fingers, and a tap that slides, at six viewport sizes |
| **B — lifetime and state** | the seam after teardown, leaks across sessions, corrupted storage, randomize, a hostile manifest |
| **C — the document is a deliverable** | every numeric claim re-derived, every cross-reference resolved, defects planted to see whether the checks go red |

**They disagreed about one thing and the disagreement was the finding.** Lens A measured
that no control could pan the drawer and called it reachability-by-discovery; Lens C
measured that check 19's pan assertion had never once executed. Both were describing the
same defect from opposite ends — a control surface that could not be reached, and a check
that could not see it. Neither alone would have moved me to change the layout.

---

## The four product defects, all fixed

### 1. `#gameBack` swallowed the dice — a tap on randomize CLOSED THE TOY (severe)

**Lens A.** On every viewport between roughly 393px and 621px tall — which is
800×480, 640×480, 1024×600 and 915×412, three of the four shapes this actually runs on —
the centre of the always-visible randomize button lay **inside `#gameBack`'s 64×64 hit
box**. Measured: at 800×480 and 640×480 only **26.5%** of the dice was reachable at all,
an L-shaped sliver along its top and right edges. A plain tap, a sliding tap and a
two-finger tap all did the same thing: no `randomize()` call, `#gameHost` gone, child on
the console.

**Why every check passed.** `#gameBack` is fixed at `top: safe + 52px`, 64px square, so it
owns x 10–74 and y 62–126 forever. The dice sits in a bar above a height-capped drawer, so
its centre tracks the viewport height. The panel's own comments reason carefully about the
panel never covering the exit — and it never did. **Nothing asked the converse.** The
z-order discipline was correct and one-directional.

**Fixed** with two geometric rules that do not depend on either element's vertical
position: the bar is inset 84px from the left, clearing the exit's column at every height;
and the drawer's cap became `min(78vh, 100vh - 140px)`, so its top can never rise into the
exit's band. Check 19 now asserts the converse rule by name, at three viewport sizes, as a
**hit test** (`elementFromPoint` at each control's own centre) rather than as geometry —
and at rest *and* with the drawer scrolled to its end, because scrolling is what slides the
top rows up.

### 2. No slider or swatch could pan the drawer, and 13 of 40 controls were below the fold

**Lens A and Lens C, from opposite ends.** `touch-action: none` on every control told the
browser that no gesture starting on it may scroll an ancestor. The controls *are* most of
the drawer's surface; the gaps between them were 8px. At 640×480, **13 of 40 controls sat
entirely off-screen**, including `clear` and `reset`, and a drag starting on the `count`
slider or any colour swatch moved `scrollTop` by **0**. Only the bare background panned.

**Fixed**: `touch-action: pan-y` on the buttons and on the slider tracks — which is exactly
right for a horizontal control inside a vertical scroller, since the browser keeps the
vertical drag and hands us everything horizontal. `wireTap` disarms on the `pointercancel`
the browser sends when it claims a gesture, so a pan never fires a control and a tap still
does. The layout was also densified (56px rows → 50, 52px buttons → 46) and the cap raised.
Measured after: 800×480 and 640×480 both pan with **a finger that starts ON a control**.

### 3. A prototype key in a saved blob bricked the toy permanently

**Lens B.** `PALETTE_MAP` and `BACKGROUND_MAP` were plain `{}`, so `MAP['toString']` is
truthy and `clampBackground('toString')` returned `'toString'`. `paintBackground` then
threw, mount failed, and the child was bounced to the console — **and the failure path runs
`release() → flushSave()`, which rewrote the poison in canonical form.** Three launches out
of three failed identically. There is no in-app way to clear `pupgame:gyre`: the toy would
have been dead until an adult cleared storage. The `palette` half was milder — a bare
background with no swatch selected, escapable by luck.

**Fixed**: both maps are `Object.create(null)`. A prototype-less map has no inherited names
to collide with, which repairs the lookup and the clamp in one line and cannot be forgotten
at a future call site.

*Not reachable by touch* — the swatches come from `seam.palettes`. Reachable by a corrupted
or hand-edited blob, and by any future control surface carrying such an id.

### 4. A manifest `hex` was spliced unvalidated into inline `cssText`

**Lens B.** `hex: 'red;position:fixed;inset:0;z-index:2147483647'` built a button covering
the whole screen: every control and the toy itself dead. **`#gameBack` survived it** — the
`insertBefore` ordering held and the child was not stranded — but this is the identical
defect the picker learned on the registry's `color`, fixed there by `GAMES_HEX_RE`, and
documented at length four hundred lines above the panel that reintroduced it on a new
surface. **Fixed**: the same validator, and a swatch whose hex fails it is not rendered.

Also fixed alongside: `buildAction` accepted inherited `Object.prototype` methods, so
`method: 'toString'` built a real pressable button — with `prominent: true`, in the dice's
place — that did nothing. Now an own-property check.

---

## The four defects in my own checks and documents

**Every one of these is an assertion that passed while the thing it names was false.**

### 5. `§7`'s persistence gate asserted four taps that never landed

**Lens C**, by instrumenting the taps rather than trusting them. The drawer's open state
persists in `localStorage`, and §6's *"drawer shut"* case had closed it. Every tap in §7
then went to a `display:none` element with a 0×0 rectangle at the origin; **all four
returned `false` and all four return values were discarded**; and the section asserted that
four settings nobody had changed came back unchanged. The green line read `ripple=1` — the
fixture had asked for `ripple=0`.

Worse, §6's own *"mid-drag, with a finger still down on a slider"* case dispatched its
`touchStart` at (0,0). **The clause about a second finger mid-drag was asserted by a fixture
holding nothing.**

**Fixed**: §7 opens the drawer first, every tap's return value is now checked, and the
fixture asserts it actually changed something before asserting it survived. Also
`tapTarget`'s `onScreen` returned **true** for a 0×0 rect at the origin — the same class it
was written to fix, surviving inside the fix.

### 6. An inverted slider passed check 19 entirely

**Lens C**, by planting the defect. One expression in the projection — dragging right sets
the **minimum** — and check 19 passed with zero failures, printing `count 4900->350` in its
own diagnostics without noticing. The assertion was `loV !== hiV`: **difference, not the
value the child pointed at.** §5's probe asks for exactly this ("a slider whose visible
position does not match the value") and this was the version the check could not see.

**Fixed**: a drag to 2% must land within 6% of the bottom of the range and a drag to 98%
within 6% of the top — a claim an inversion cannot satisfy. *(The first version of that fix
was itself broken: `lo`/`hi` in that scope are the two field readings, not the range
bounds, so `hi - lo` was `NaN` and it reported all six sliders as broken while printing
`350->4900` beside the complaint.)*

### 7. `reset` and `clear` were never pressed by any check

**Lens C**, planted: `reset` replaced with a stub that returns the settings and changes
nothing. **Check 19 passed.** `reset` is the button the acceptance-8 prediction hangs on —
prediction #8 is that a stranger answers *"put it back the way it was"* with ↺ in one tap.
**Coverage that stopped at the controls with sliders on them was coverage shaped by what
was easy to measure.** Both are now exercised: `clear` must wipe the ink and the field must
draw itself back; `reset` must move every deliberately-wrong setting and a second press
must change nothing.

### 8. Two floors that were declared and never used, cited four times in prose

**Lens C.** `CHANGE_FLOOR` and `SNR_FLOOR` were left behind when §2's assertion changed —
referenced by nothing — while **four comments in the same commit cited "a floor of 1.0"
that no code contained**, twice with different numbers for the same claim. And the claim was
false: `glow` (0.54), `ripple` (0.63) and `polarity` (0.80) all shipped **below** the 0.60
at which `edge` was removed.

**Fixed**: the dead constants are gone, every enforced threshold is written at the line
that enforces it, and **§4.1's justification for removing `edge` is restated without a
number that does not exist** — see the feedback file, which now rests it on the physical
argument rather than a phantom floor.

---

## False claims in my own feedback, corrected

**Lens C read the feedback file as an artifact and measured it. It should have.**

| claim | reality |
|---|---|
| *"check 16's stale comment … **Corrected**."* | `git diff eeadf46 e121cb0 -- demo-gyre.mjs` shows the sentence **byte-identical**. I asserted a fix I had not made — in a paragraph about a false claim. Now actually corrected and verifiable by the same diff. |
| *"seven byte-for-byte copies"* / *"the rule lives here, once"* | Counted: **nine**, and **nine remain**. After this work order there are **ten** implementations. The header now says so and names the nine, plus five static checks that assert no subject at all, as owed. |
| *"worst is ice on void at **3.10:1**"* | Re-measured: **2.66 and 2.88** across two runs. The stale number is the only value that clears the 3.0:1 the check's own comment names as WCAG's floor — so the quoted figure made a live trade look free. |
| *"**55.1** fps at 6× throttle"* | Re-measured on the lens's runner: **46.8 / 48.9**. A CI frame rate is a property of the runner, not of the tree, and it was quoted as if it were the latter. |
| *"spin turns **70°** in 2s"* | 63–73° across runs. Quoted to a precision the measurement does not support — as is most of the sweep table. |
| *"sliders … **the width of half the screen**"* | **27.6%** of 1024px. |
| *"460px of content in 459px"*, offered as evidence it **fits** | That is overflow by one pixel. The check's own `+2` slop then printed *"every control fits with no scrolling at all"* — and that one pixel is precisely why the pan assertion never ran. |
| *"a glyph the manifest itself supplied"* | Two glyphs (`▾`, `🎛️`) are added to the allowlist by hand. |
| *"architecture §6.1 member 6 **word for word**"* | Materially the same, textually not — and the claim was about text. |
| *"§2.1's **third** bullet"* | It is the **second**. |
| `docs/findings/PUP-WO-0301-adversarial.md` cited as *"Adversarial record"* | Did not exist when cited. **This file.** A forward reference written as a present fact — §6.1 member 4. |

**Also corrected in `games/gyre.js`**: a comment justifying `fadeTrails` partly on the
grounds that *"PUP-WO-0301's swatch strip will fire `set` on every pointermove of a drag"*.
Lens A measured the shipped panel: a drag across five swatches fires **one** `set`, at
lift, for the swatch the press started on. The prediction about a surface that had not been
built did not survive the surface being built.

---

## Probed, nothing found — and these are results

**Lens B, each demonstrated rather than reasoned:**

- **The dead seam holds.** All nine members driven after teardown: `set` returns `false`,
  `randomize`/`reset`/`toggle`/`clear` are no-ops, `subscribe` returns a no-op unsub whose
  callback never fires. **localStorage byte-identical**, zero new timers or rAF callbacks,
  `frames()` frozen, the detached canvas not reseeded.
- **No leak across sessions.** Twelve open/close cycles with forced GC: **334 DOM nodes and
  50 listeners at baseline, 334 and 50 after twelve** — zero growth. Zero detached nodes in
  a heap snapshot. WeakRefs to the first cycle's chrome, host, canvas, seam, panel root and
  a slider track are **all cleared**, against controls proving the instrument discriminates.
- **The panel's unsubscribe survives a module teardown that throws.** Planted: watchers
  1 → 0, chrome removed, console reachable, body clean.
- **17 of 20 corrupted storage blobs are clean** — including a pre-0301 blob (sanitises to
  today's behaviour) and one carrying the removed `edge` key. The three failures are
  defect 3.
- **Randomize, 2000 draws**: zero out of bounds, zero consecutive colour repeats, `ripple`
  never off, `glow` never moved from what the child set.
- **Five real dice presses sampled at +21s**: no all-black, no empty, no off-canvas — and
  the control run shows the defaults thin *harder* than any randomized field, so the
  late-sample thinning is the field's steady state, not the dice.
- **27 hostile manifests** — a 3000-control manifest, a 200,000-character icon,
  `<img onerror>` as an icon, `javascript:` in a hex, throwing getters — the game stayed
  mounted, the exit stayed hittable and the child could leave, **27 out of 27**.

**Lens A:** 126 of 126 control × gesture combinations responded at 1024×768, each verified
by a recorded seam call. **`#gameBack` ended the session in one tap in all forty
strand-the-child scenarios** (ten states × four viewports). Every slider's painted fill
matches its seam value to within 4px — the track's own border — in all five states
including after a restart. All 21 swatches paint exactly the hex they select. Controls
clipped out of the drawer receive nothing. **The panel never covers the exit**, at six
viewport sizes, open and shut.

**Lens C:** the §0 fence is exact. Check 19's swatch, dice, two-finger-polarity, dead-seam
and no-manifest assertions all reproduce, and the swatch one is demonstrably load-bearing
(a planted wrong colour goes red). No citation by `index.html` line number appears in
either document — the known staleness trap was avoided.

---

## Accepted, not fixed, and stated as trades

- **Dragging along the colour strip commits the swatch you started on**, not the one under
  your finger, because `wireTap` requires press and release on the same element — which is
  the rule that stops a finger dragged across the screen from launching a tile. Changing it
  here would fork a shared touch primitive for one surface. **A child who drags along the
  colours gets one colour change rather than a sweep.** Worth watching in gate 8.
- **`randomize` exceeds the shape-weighted draw budget in 8 of 2000 draws** (max 3481.6,
  +2.4%), always `ribbon` at the count floor of 800, because the floor wins over the
  ceiling. The floor exists so a budget cannot starve the field to nothing. Stated rather
  than silently traded.
- **The drawer covers 59–78% of the field when open**, and open is the default. That cost
  was never stated before this pass and is stated now: the controls *are* what Buddy
  engages with, and the handle puts them away in one tap.
- **The shell drops a malformed manifest entry silently** — no node, no console message.
  For a declarative contract whose test is *"adding a control here puts it on screen"*, the
  failure of that is invisible to the module author. Owed.
- **`Object.freeze` on the seam is shallow**: `controls[0]`, `ranges.count`, `palettes` and
  `backgrounds` are not frozen, and `host.gyre` is replaceable. Lens B could not make it
  consequential and marked it **UNVERIFIED as exploitable**; it is a mismatch with the
  file's "frozen seam" language and is recorded as such.

## One correction the pass made to itself

Lens B's first two leak measurements were **wrong, and the instrument was the leak**:
`page.waitForSelector` returns an ElementHandle that pins the node in-page, so waiting on
`#gameControls` each cycle retained the whole game chrome and read as a 141-node-per-cycle
leak, corroborated by a WeakRef test that also read as a leak. Replacing every
`waitForSelector` with `waitForFunction` took the growth to exactly zero. **Anything
measured through `waitForSelector` in the existing `.github/ci/demo-*.mjs` files inherits
the same artifact and has not been audited.** That is owed work and it is not mine to
declare closed.
