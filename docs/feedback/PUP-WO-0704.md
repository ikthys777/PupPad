# PUP-WO-0704 — upward feedback

**Branch `build/wo-0704-celebration`, based on `main` at `dd6b3a6` (verified live).**

---

# §0 — THE MEASUREMENT, BEFORE ANY NEW EFFECT

**Reported before building on it, as the work order requires. Every number below is
measured on the shipping module at `dd6b3a6`, not reasoned from the source.**

Scotty, from the device: *"no colour, no flash, no fireworks, nothing explosive or
popping."*

**All four are true, and there are three separate causes, not one.**

## 1. Reduced motion removes every particle — measured, 48 versus 0

A perfect clear driven by a finger, same seed, same placement, two worlds:

| world | sparks at t+500ms |
|---|---|
| `prefers-reduced-motion: no-preference` | **48** |
| `prefers-reduced-motion: reduce` | **0** |

`burstAt` returns `0` before building anything when `reduced` is set, so this is by
construction rather than by accident. **If Buddy's S10+ reports `reduce` — and Samsung's
power saving is one of several things that set it — he has never seen a single firework.**

## 2. The flash is present in both worlds and INVISIBLE in both

This is the one the work order flagged as *"worth understanding rather than assuming"*, and
it does not behave the way the code reads.

`celebrate()` does build its flash: an element with `--bp-peak: 0.44` and a 600 ms fade,
confirmed at construction time by a MutationObserver rather than by polling. **It simply
does not reach the screen.**

Measured in the reduced world, where nothing else on the board moves, by photographing the
same panel at t+320 ms (flash at opacity 0.23) and t+700 ms (flash gone) — the cheer
bubble is on its opacity plateau in both frames, so **the difference is the flash and
nothing else**:

> **Maximum summed-RGB delta: 13 out of 765. Not one pixel changed by more than 16.
> 0.00% of the picture above the threshold at which a difference is visible at all.**

Three reasons, all geometric:

- the flash lives in `.bp-fx` at **z-index 4**, and the celebration's own overlay is
  **z-index 12 with a 30% navy scrim** painted over it;
- the gradient's bright centre — the only place it reaches 0.44 — is **behind the opaque
  "Good Job!" lozenge**, confirmed by `elementFromPoint`;
- the gradient falls to zero at 72% of the radius, so what is left is a faint annulus.

**In the unreduced world this is invisible for a different reason: 48 sparks are flying
over it.** The flash has never been carrying anything, in either world, and nothing
measured that.

## 3. What the celebration actually is, with every word covered

Decomposed by hiding one layer at a time and re-photographing the same moment, reduced
world:

| layer | share of the board it changes |
|---|---|
| the dark scrim (`rgb(15 29 58 / .30)`) | **54.0%** |
| the "Good Job!" lozenge | **5.0%** |
| everything else the celebration paints | **6.3%** — and that is the board having gone empty, not an effect |

**So on Buddy's device a perfect clear is: the screen goes dark, and an orange lozenge with
writing on it appears.** No colour, no flash, no fireworks, nothing explosive or popping —
his four words, in order, and each of them is a measurement.

---

# §0 — WHICH WORLD THE HARNESS RUNS IN, AND A LARGER FINDING

**Measured, not assumed:** Playwright's default context reports
`matchMedia('(prefers-reduced-motion: reduce)').matches === false` and
`no-preference === true`.

**So every section of check 21 runs in the unreduced world except two**, which build their
own contexts with `reducedMotion: 'reduce'` explicitly. The words-covered instrument is not
one of them.

## But the check the work order asks me to re-examine does not exist

`games/blockpop.js` says this, verbatim, above `endCelebration`:

> *"THE WORDS ARE NOT THE MESSAGE. `Good Job!` is text and Buddy cannot read it, so by
> invariant 1 it may not be the only expression: with it covered, the win is still a
> screenful of fireworks, a rising powerUp under a chime, and a board that just went empty.
> **Acceptance §1 measures that with every painted word masked.**"*

**It does not.** `coverWords` is called in exactly one place in the whole check —
section 17 — which photographs `.bp-grid` to compare a clearing placement against a
non-clearing one and a 2× combo against a 1×. **It never runs during a celebration, and no
check anywhere photographs the celebration with words masked.**

So the honest statement is not *"that check has been passing in a world the child does not
live in."* It is worse and simpler:

> **The check was never written, and a comment claiming it exists has been standing in for
> it.** And the sentence that comment makes — *"with it covered, the win is still a
> screenful of fireworks"* — **is false on Buddy's device by construction**, because
> `burstAt` returns 0 there.

This is the same defect family the voice panel was just cleared of twice over: *a described
guarantee reads exactly like a kept one*, and *never let a comment claim uncovered
coverage*. It is worth saying plainly that I found it by resolving the citation rather than
by trusting it — which is the only reason it was found at all.

---

# §0's ANSWER, IN ONE PARAGRAPH

**The celebration was fine on a desktop and invisible on the device, and the two halves of
that have different causes.** Reduced motion deletes all 48 particles by construction; the
flash was never visible to anyone, in any world, because it is painted under the
celebration's own scrim with its centre behind the lozenge. What survives on the device is
a dark overlay and a word — which is the opposite of a celebration for a child who cannot
read the word. **Adding more fireworks to the unreduced path would have shipped another
round of "still nothing".**

**The work is therefore what §1's fourth bullet says it is: make the reduced path carry a
real celebration — and, separately, make the flash actually reach the screen in both.**

---

# §1 — WHAT WAS BUILT, AND WHY IT IS TWO THINGS AND NOT ONE

**§0's answer changed the shape of the job, and the work order's own fourth bullet is
what it changed it into:** *make the reduced path carry a real celebration — and,
separately, make the flash actually reach the screen in both.* Those are two repairs with
two different causes, and doing only the first would have shipped a celebration that is
still invisible to half of what a win paints.

## 1. The light moved layers. It did not get brighter.

**The tempting fix was a bigger `--bp-peak`, and it would have changed nothing.** §0
measured a peak of 0.44 arriving at the glass as a maximum summed-RGB delta of 13 out of
765, and the cause is geometric, not photometric: `.bp-flash` paints into `.bp-fx` at
z-index 4 inside `boardWrap`, and `.bp-celeb` is z-index 12 over the whole root **with a
30% navy scrim on top of it**. Doubling the peak doubles a number underneath a dimmer.

So the celebration now paints its own light **inside its own overlay**, as `.bp-wash`, a
child of `.bp-celeb`. Two consequences worth stating:

- **The gradient is inverted from `.bp-flash`'s** — transparent at the centre, full from
  46% out to the corners. §0 found the old one put its only full-strength stop exactly
  where the lozenge stands (`elementFromPoint` at the peak returned `bp-cheer`). The
  light is now put where nothing is in front of it.
- **The peak is the same expression it always was** — `FLASH_PEAK_BASE + FLASH_PEAK_STEP
  * (COMBO_TOP - 1)`, the top of the combo ladder. Nothing was retuned to make a picture
  brighter. What changed is where it hangs and what shape it is.

`flash()` itself is untouched and `comboReact` still calls it. A line clear has no
overlay above it, so **that** flash does reach the glass, and §16 measures its peak in
pixels across three combos. The deleted call's absence is asserted rather than assumed:
§20 fails if a `.bp-flash` reappears inside `.bp-celeb`.

## 2. Reduced motion gets the bloom — Gyre's ruling, not a new one

**The work order pointed at `games/gyre.js` as a reference to read, and the thing worth
taking from it is not a particle routine. It is a policy.** Gyre's reduced-motion path
scales: `wander` 10 → 4, `tailScale` 1 → 0.45, the fade capped higher. **Every parameter
still moves. Nothing returns zero.** Block Pop's `burstAt` returns `0`.

So the win now paints **sixteen blooms** — a spark with the travel taken out. Colour,
size and light are kept in both worlds; only the translation is given up, which is the
one thing `prefers-reduced-motion` is actually about. Unreduced they pop and swell; calm
they appear at full size (×1.35, since what a disc loses in travel it can take back in
area), brighten, hold and go, **with no transform at all**.

`.bp-spark` still returns 0 under `reduced`, and check 21 §19.7 still asserts that. That
assertion was the one codifying "nothing", and it is now correct rather than merely
passing: a travelling particle is the thing the preference forbids, and a bloom is not
one. Positions, sizes, colours and delays are **index arithmetic** (37, 61, 23, 8 — each
coprime with its modulus), so the field is as varied under check 21's pinned
`Math.random` as it is on the device.

## 3. What it measures now

| | no-preference | reduce |
|---|---|---|
| the win with every word covered **and the lozenge removed from the frame** | **99.65%** | **99.64%** |
| the light alone, against the same frame with the scrim still up | 95.70% | 95.21% |
| the sixteen blooms alone, same baseline | 9.97% | **18.50%** |
| two captures of one unchanged frozen state (the null control) | 0.00% | 0.00% |

**Before this branch the reduced world's answer to the first row was the scrim and a word.**

---

# §1 — THE CHECK THAT DID NOT EXIST, AND HOW IT IS BUILT

Acceptance §3 asks for *"the existing check, re-run"*. **There was no existing check.**
§0 established that `coverWords` was called in exactly one place in check 21 — §17, which
compares a clearing placement against a non-clearing one on the board — and that no check
anywhere photographed a celebration with words masked. So §3 could not be satisfied by
re-running anything; it had to be written.

**Two new sections, `.github/ci/demo-blockpop.mjs` §20 and §21.**

## §20 — and the obvious way to write it is the wrong way

The naive form — *photograph the win with the words covered, check it differs from the
idle board* — **passes on the line clear's own sparks**. The placement that wins is also
a clear, `celebrate()` deliberately adopts that burst and keeps it flying, and `SPARK_MS`
is 620ms. The work order names this trap in §5, and §0 measured 48 such sparks in frame.

So the comparison **holds the board fixed and moves only the celebration**. Three
photographs of one frozen instant, taken by toggling `visibility` — which hides paint
without removing a box and, unlike `display:none`, does not cancel and restart the CSS
animations the section has just paused:

| | |
|---|---|
| **A** | everything visible, every word transparent |
| **C** | the same, with the "Good Job!" lozenge itself hidden |
| **B** | the same, with the whole celebration hidden |

Nothing is restarted between them, so **B still contains every spark the line clear
threw, at the same phase**. `C vs B` is therefore the celebration's own paint with its
only word removed, and not one changed pixel in it can have come from the burst that
triggered the win.

- **`A vs B` is the positive control, not the subject.** The lozenge is a large opaque
  element that indisputably paints; if that comparison comes out empty, the camera
  returns a constant or `visibility` did nothing, and every verdict is void.
- **The null control comes first** — two captures of one unchanged frozen state.
- **It compares a thresholded fraction of visibly changed pixels, not bytes.** Byte
  identity of a screenshot is a property of the renderer; PR #67 was made to learn that
  in CI rather than here.

**Each carrier is also measured alone, and that clause is not decoration.** The light
clears the headline floor by a factor of three on its own, so a change that silently
killed every bloom would leave the headline at 99% and the section green — redundant
signals make a one-at-a-time plant pass. Each carrier is compared against a frame
identical except for it (the celebration up, its scrim showing, everything else hidden),
and the three clauses are asked **carriers first, headline last**, so a defect in either
carrier does not arrive wearing the headline's message.

**The honest consequence of that ordering is stated in the section rather than left for a
reader to find: the headline clause is now largely subsumed**, no plant in the control
file lands on it, and it is kept because it is the only clause stated in the acceptance
criterion's own terms and the only one that still says something if the per-carrier
decomposition is ever refactored away.

**It runs in both motion worlds, and reads back which one the page actually reports**
before trusting the context option it asked for.

## §21 — stillness, with its own positive control

Acceptance §4 has to cut both ways at once. *"Reduced motion still gets a celebration"*
is satisfied by an effect that travels, which is the thing the preference forbids;
*"reduced motion is still"* is satisfied by painting nothing, which is what shipped. So
§21 measures both from the same feature: the blooms exist and are sized, **and** every
one occupies the same rect at two different points in its own timeline.

**"Nothing moved" is also what a broken probe reports** — a selector that matched
nothing, a freeze that silently failed, a rect read twice from one paused frame. So the
identical measurement runs unreduced, where the blooms do travel, and must come back
saying they moved. **A stillness check that cannot see motion has not seen stillness.**
It reports 16 of 16 travelling there and 0 of 16 travelling in the calm world.

## One hazard found while building the instrument, not after

`freezeAnimations` pauses the compositor; **it does not pause `setTimeout`**, and the
reduced celebration removes itself after 1600ms. §20 takes six full-viewport screenshots
per world and decodes them in-page — comfortably inside that here, and **not comfortably
inside it on a loaded two-core runner**. The failure would not have been a red check: the
later frames would simply have been photographs of a game with no celebration in them,
and "the celebration changes 99% of the screen" would have been measuring its own
disappearance.

Both sections now drop the game's pending timers once the frames are frozen (attributed
by arming stack, so the shell's are untouched), and §20 re-asserts the celebration was
still on the glass after the last capture. What that removes — the self-return and any
unfired volley — is §19.3's subject and is asserted there. **CI's CPU is a knob, and a
gate that is red at random is one people learn to ignore.**

---

# §1 — RED-PROOF

**Seven planted defects in `.github/ci/demo-blockpop-controls.mjs`, one per clause.**

| § | planted defect | the clause it can only be caught by |
|---|---|---|
| 20 | the win's light is painted under the celebration's own scrim again (§0's defect, restored) | the light is not inside the celebration |
| 20 | the whole light layer is built and never attached | no light layer at all — **and the 48 line-clear sparks are still in frame** |
| 20 | the light is built at zero brightness | the light **on its own** repaints too little |
| 20 | the blooms are built, sized, inside the celebration, and paint nothing | the blooms **on their own** put no ink on the glass |
| 20 | every bloom is built at zero size | in the DOM with no size |
| 21 | the reduced-motion win builds no blooms — `burstAt`'s decision, one function along | the calm world paints no blooms at all |
| 21 | the calm rule is deleted, so the still world is handed the travelling animation | rects changed between the two freeze points |

**One of them first reported RED-WRONG-REASON and the fix was to move the finding, not
the plant.** The never-attached layer arrived at an instrument precondition — *"there is
no `.bp-wash` to hide"* — several clauses earlier than the semantic one. Those are the
same fact, so the precondition now carries the finding. *A precondition that is also a
finding should say the finding.*

**And the plant list is now validated before it is run.** `sub()` already threw on a
stale or double-matching anchor and the runner already caught a no-op mutation — but both
only when that scenario's lane reached them, which for a `TIMED` section is after
everything else has finished. **Neither catches the third failure: two plants that
produce a byte-identical file.** That pair runs, both go red, and the report claims two
independent defects were demonstrated when one was demonstrated twice and some other
clause has no coverage at all. A pre-flight now applies all 77 mutations and hashes them
in under a second, with `--dry` to stop there. **77 plants, every one applying to a
distinct file.** `--only=N` was also added, which the check file has always had and this
one did not — proving one new plant used to cost a full run of every other.
