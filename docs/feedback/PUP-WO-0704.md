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
§20 fails if a SECOND `.bp-flash` appears on the glass — the winning line clear leaves
exactly one.

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
| what the win ADDS to its own scrim, every word covered **and the lozenge removed from the frame** | **96.40%** | **96.51%** |
| the light alone, against the same frame with the scrim still up | 96.03% | 95.69% |
| the sixteen blooms alone, same baseline | 10.96% | **19.79%** |
| what it is still adding at 90% of the way through the win | 82.62% | 82.62% |
| the scrim on its own — the celebration §0 measured, for contrast | 53.95% | 53.95% |
| the whole celebration against no celebration at all | 99.66% | 99.66% |
| two captures of one unchanged frozen state (the null control) | 0.00% | 0.00% |

*Every figure above is measured after the adversarial pass. Four of them moved during it,
and the disposition at the end of this document says why.*

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
| **S** | the same, with everything the celebration paints hidden — its scrim, and nothing else |
| **B** | the same, with the whole celebration hidden |

Nothing is restarted between them, so **B and S still contain every spark the line clear
threw, at the same phase**. The measured contamination is nil: the scrim's own share comes
out at 53.95% with 38 sparks in frame and 53.95% with none.

**`C vs S` is the headline** — the celebration's own NEW paint, with its only word
removed, against the dimming that was already there. **Not `C vs B`**, which was the first
version and which counted the scrim toward the win. §0 named that scrim as the problem;
measured, it repaints 53.95% on its own, so the old 30% floor was cleared 1.8× by the very
state the clause exists to reject. The adversarial pass computed it.

- **`A vs C` is the positive control, not the subject.** The lozenge is a large opaque
  element that indisputably paints; if hiding it changes nothing, the camera returns a
  constant or `visibility` did nothing, and every verdict is void.
- **The null control comes first** — two captures of one unchanged frozen state.
- **It compares a thresholded fraction of visibly changed pixels, not bytes.** Byte
  identity of a screenshot is a property of the renderer; PR #67 was made to learn that
  in CI rather than here.

**Each carrier is also measured alone, and that clause is not decoration.** The light
clears the headline floor on its own, so a change that silently
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

**It runs in both motion worlds, and reads back which one the MODULE saw** — from
`.bp-celeb-calm`, which is the module's own expression of the snapshot it took at mount —
before trusting the context option it asked for.

**And it samples twice, not once.** Every bloom is finished by 1240ms and the lozenge by
1500ms against a 3400ms unreduced window, so a section that only photographs 700ms grades
the first third and calls it the win.

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
reduced celebration removes itself after 1600ms. §20 takes nine full-viewport screenshots
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

**Ten planted defects in `.github/ci/demo-blockpop-controls.mjs`** — seven before the
adversarial pass, three added by it. They do not cover every clause: §20 has fifteen guards
and §21 has eight, and the unplanted ones are instrument preconditions plus the documented
subsumed headline.

| § | planted defect | the clause it can only be caught by |
|---|---|---|
| 20 | the light layer is hung on `boardWrap`, under the celebration's own scrim | the light is not inside the celebration |
| 20 | **the light is painted with `flash()` again — §0's defect restored exactly** | **a second `.bp-flash` is on the glass** |
| 20 | the whole light layer is built and never attached | no light layer at all — **and the line clear's own sparks are still in frame** |
| 20 | **the module never believes it is in the reduced-motion world** | **the MODULE thinks it is in the unreduced world** |
| 21 | the same, aimed at §21 | not wearing `.bp-celeb-calm` |
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
clause has no coverage at all. A pre-flight now applies every mutation and hashes it
in under a second, with `--dry` to stop there. **80 plants, every one applying to a
distinct file.** `--only=N` was also added, which the check file has always had and this
one did not — proving one new plant used to cost a full run of every other.

---

# §5 — THE ADVERSARIAL PASS, AND ITS DISPOSITION

Fresh subagent, `git archive` freeze of `67e31ea`, every correction held until it returned.
It ran all six probes the work order names and found **five confirmed defects — three of
them inside the instrument I had just written to prove the other two.** Every finding below
was re-verified at source before being acted on.

## The one that matters most: I wrote a described guarantee into the fix for a described guarantee

**§20's `flashInsideCeleb` clause could not fire for any build that could ever exist.** It
read `celebEl.querySelectorAll('.bp-flash')`, and `flash()` appends into `.bp-fx` inside
`boardWrap` — which is a **sibling** of `.bp-celeb`, never a descendant. The count was
structurally zero.

The pass planted the removed `flash()` call back into `celebrate()` — **§0's defect,
restored exactly** — and §20 printed 99.65% and passed.

Three separate comments claimed that clause was standing guard: one in `games/blockpop.js`,
one in the check, and one in this document. **This work order exists because a comment
claimed a check that was never written. I reproduced that defect inside the repair for
it.** The clause now counts `.bp-flash` where they actually live and fails on a second
one, and the restored call is a plant.

## The reduced-motion half of §20 was grading the unreduced build

`sawReduce` called `matchMedia`. **Its own comment said why that was not enough** — *"a
context option is a request to the browser, and `reduced` is a snapshot the module took at
mount"* — and then it asked the browser. With `var reduced = false` planted, both worlds
printed byte-identical unreduced numbers, **38 travelling sparks in the run labelled
"reduce"**, and §20 declared itself green *"in the reduced-motion world as well as the
other one."* It now reads `.bp-celeb-calm`, which is the module's own expression of that
snapshot. Two plants added.

## The headline floor was below the thing it exists to reject

`WIN_FLOOR` was 0.30 measured against a frame with **no celebration in it**, so the
celebration's own navy scrim counted toward it. **The scrim alone repaints 53.95%** —
1.8× the floor. A build with no light and no blooms, which is precisely what §0 measured on
the device, would have passed. The headline is now measured against the celebration **with
its scrim already up**, so the scrim is in both frames and contributes nothing, and the
floor is 0.60 against a measured 96.40%.

## The sixteen blooms were eight overlapping pairs, and a comment said they were not

I wrote *"37, 61, 23 and 8 are coprime with their moduli, so sixteen discs walk the whole
range … **without two of them landing on each other**."* The pass computed them. `bi →
(bi·a) mod 100` is **linear**, so discs `bi` and `bi+8` sit at a *constant* offset — 54px —
and because `BLOOM_N` was exactly twice `BLOOM_SPREAD`, each pair also shared an identical
delay. **Measured worst overlap −43.9px with motion reduced.** Sixteen blooms were eight
two-lobed blobs arriving in eight steps.

Recomputed rather than re-argued: **29, 53 and a spread of 7** clear by **+10.0px** on the
worst fleet viewport in the calm world and +35.3px unreduced, with no disc reaching the
layer's edge in either world at any of the three phones. `BLOOM_N` is no longer a multiple
of `BLOOM_SPREAD`. The blooms' own measured share rose from 9.96% to 10.96% unreduced and
18.50% to 19.79% calm — the overlap had been costing ink.

## And the new late sample immediately found something in the product

The pass noted that **nothing sampled past 700ms**, of a 3400ms window in which the blooms
end at 1240ms and the lozenge at 1500ms. I added a second sample at 90% of the celebration's
own length — read from the light's `--bp-fade` rather than pasted, since `CELEB_MS` is not
mine — and it came back **0.00%**.

The cause was mine and not a tuning matter: **a CSS timing function applies to every
keyframe interval, not to the animation as a whole**, so `ease-out` front-loaded the decay
inside the wash's final segment. The authored 0.205 was painting about 0.04. **Over a third
of the unreduced celebration was a dark screen with a word already gone from it.** An
opacity envelope should mean what its percentages say; the easing belongs on things that
move. Linear now, with the hold running to 78%. The late sample reads **82.62%**.

## Corrections without a defect

- **`A vs B` was named as "the lozenge control" and hid the whole celebration** — different
  subjects by a factor of six. The control is `A vs C` now, which hides the lozenge.
- **`hidBloom !== built.blooms` could not fire** — both sides were the same live query
  against a frozen DOM. Removed.
- **§21's three calm clauses were ordered symptom-first.** `moved` dominated the two below
  it, so a module that never believes it is in the reduced world arrived as *"the calm
  keyframes must set no transform"* — a true measurement with a false diagnosis. Cause
  first now: did the module think it was calm, did it still throw travelling particles, and
  only then, given both, did its still discs hold their rects.
- **`celebrate()`'s volley comment was wrong by half** and this branch had re-typed it
  without checking: *"three volleys of eight, so at most ~16 sparks overlap"* — `per` is 10,
  and with `SPARK_MS` at 620 against a 260ms stagger all three volleys overlap between 520
  and 620ms. **Thirty, not sixteen.** It is a budget claim about a real phone.
- **"nothing this file paints can get in front of it"** is contradicted fifty lines later by
  the lozenge's `z-index:1`, which is deliberate. Reworded.
- **"Inset from the rim so a disc is never half-clipped"** was a percentage inset promising
  something about a pixel radius. It is true of these strides at these sizes on all three
  412px-tall fleet viewports — measured, 1.8px of clearance at the tightest — and the
  comment now says that rather than claiming a mechanism it does not have.
- **A hardcoded `8` and `70` in the bloom budget arithmetic**, a **"48 sparks" printed in a
  world that has none**, **"six frames" when there are nine**, a **"factor of three" and a
  "factor of nearly five" for one measured quantity in one file**, and a **9.97% that was
  9.96%.** All were mine, all are gone. *No derived counts in prose.*

## Weaknesses recorded and NOT fixed, so a reviewer can weigh them

- **The per-carrier floors detect deletion, not degradation.** `BLOOM_FLOOR` is 0.015
  against a measured 10.96%; killing half the blooms still passes. `WASH_FLOOR` is 0.20
  against 96.03%. Raising them toward the measured values would be tuning to pass and would
  buy flakiness; they are honest as "this carrier is really putting ink on the glass."
- **§20 and §21 run at `FLEET[0]` only.** All three fleet phones are 412px tall and
  869/883/915 wide, and the bloom geometry was recomputed at all three — but the pixel
  fractions are measured at one.
- **Whether sixteen blooms and a gold wash read as "explosive or popping" to a
  three-year-old across the room is not a thing any of this measures.** That is Scotty's,
  on the S10+, and it is the only judgement here that matters.

## Probes that were run and did not break it

Exit mid-celebration (every new node is a descendant of `celebEl`; `celebrate()` arms no
new timers; §19.6's leak sweep names the new classes anyway) · a perfect clear immediately
after another · reduced motion · a perfect clear that is also terminal (`place()`'s
ordering is untouched) · **every one of the original seven plants genuinely removes the
behaviour its clause asserts, with no plant pre-empted by an earlier clause** · and **the
§5 trap itself**: the words-covered assertion cannot pass on the winning clear's leftover
sparks, confirmed structurally and measured at 53.95% with 38 sparks in frame and 53.95%
with none.

---

# WHY THIS BRANCH TOUCHES THE VOICE CHECK

**`.github/ci/demo-voice.mjs` and `.github/ci/demo-voice-controls.mjs` belong to
`PUP-WO-0703`, not to this work order.** One commit on this branch changes them —
`check 26 §27 raced a callback it started itself` — and this section exists so the next
reader does not have to wonder why the celebration touched the voice panel's check.
*(Kept here rather than split out by CC-A's ruling; 0704's fence permits `.github/`, and
the alternative was leaving the branch red with the cause known and unfixed.)*

**It is not a celebration change and it is not a voice-panel change. It is a defect in a
CHECK, and both halves of it are mine.**

Check 26 §27 plays slot 0, re-arms the live marker by hand, and probes 150 ms later. The
module change `PUP-WO-0703` shipped — a finished playback's `onended` releasing its graph
and clearing the live marker — fires at about 400 ms, and the probe window opened at
roughly 250 ms and closed at 400 ms. **Whether the callback landed inside the window was
decided by how fast the machine was.** CI is slower than this one, so it went red on a PR
that touches neither the voice panel nor that check.

**The section's own comment names the hazard and then walks into it:** *"a 0.7s clip at the
default preset's 1.70x is over in about 0.4s — the positive control would then be sampling
a playback that had already finished."* It says that, and leaves the playback running.
**Same family as everything else in this work order: a comment describing a property its
code does not have. I wrote the comment and the `onended` one work order apart.**

**Reproduced rather than re-run.** Three local runs green; green under full CPU saturation;
then the probe window widened to 700 ms so the callback was *certain* to land inside it —
**red 3 for 3, with CI's exact message.** The fix stops the playback before re-arming, so a
pending `onended` is inert on a token mismatch. **It is green at 700 ms now — the window
that failed 3/3 — which is the test that separates closing a race from hiding it behind a
shorter wait.** All three §27 plants remain red for their own stated reasons.
