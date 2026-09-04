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
