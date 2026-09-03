# PUP-WO-0404 — surface the score twice, and make the perfect clear the win — builder feedback

**Subject:** `build/wo-0404`, branched from live `main` at `6c5fe9a` (the WO cites
`0ad2564`; **`games/blockpop.js` and `.github/ci/demo-blockpop.mjs` are byte-identical
between the two**, verified with `git diff --stat 0ad2564 HEAD --`, so every line citation
in the work order resolves unchanged at my base).
**Built:** `games/blockpop.js`, `.github/ci/demo-blockpop.mjs` (§16–19, new),
`.github/ci/demo-blockpop-controls.mjs` (16 new red proofs, 70 total).
**Fence:** `index.html`, `sw.js`, `manifest.json`, the icons, `games/gyre.js` and
`games/hello.js` **diff to empty**. Confirmed by `git diff --stat origin/main --` against
each, not by intention.

---

## 0. The work order's premises, checked at source before building

All six citations resolve: `scorePlacement` at `:243`, `score`/`combo` at `:324-325`,
the combo advance at `:956`, persistence at `:412-413`, the restore at `:1315`. The three
**absence** claims — no render site, no board-empty detection, no particle code — are the
ones the build depends on, and all three hold (the only `particle|burst` matches are
prose). `validCount` at `:357` is a genuinely separate predicate from `validCell`; CC-A
read the executable line rather than the comment and was right to.

**One correction to the WO's table, immaterial to the build:** it gives `scorePlacement`
as `10 × lines × max(1, combo)`. The function also adds `placedCells` and two bonuses
(`+8×lines` at 2 lines, `+20` at 4). The WO's own worked example downstream — "one line
clear scores 11" — uses the full formula, so the table is the loose statement, not the
reasoning.

---

## 1. §1 — the ruling, and the one shell fact that shaped it

The child's channel moves **four** dimensions with the combo: sparks per cleared cell,
the peak brightness of a flash, the pitch of a tone, and the length of the buzz.

**`api.tone(hz, ms, wave)` already existed** (`index.html:2960`, PUP-WO-0300 §2.1), so
"higher pitch per multiplier" is expressible directly rather than by picking louder sound
banks. `doSound(type)` takes **only a bank name** — there is no pitch parameter — so
without `api.tone` the pitch dimension would have had to be faked by climbing the twelve
banks, and that would have coupled the combo ladder to a table the shell owns.

**And the shell puts a hard ceiling on that dimension.** `playTone` clamps `hz` into
`[40, 3000]` (`index.html:139-140`). A ladder that walked past 3000 would return **the
same note for two different combos** — the multiplier silently collapsing at exactly the
point a child is most likely to reach it — while every line of the module still read as
though the two differed. So the ladder saturates at `COMBO_TOP`, and its top rung is
**1720 Hz, with 1280 Hz of headroom**.

**Check 21 §16 does not re-derive that arithmetic.** It observes the pitches actually
asked for at the shell's own entry point and asserts they are *distinct and rising* and
clear of the clamp. A check that recomputes the formula agrees with a wrong formula.

**The buzz moved into `comboReact` rather than staying beside the clear cue.** Its length
and the spark count are two expressions of one fact — "how good was that" — and two call
sites is precisely how this project's recurring defect family begins. One function owns
the child's channel; every dimension leaves from there.

**There is no else-branch.** A placement that clears nothing keeps the plain `drop` tick
it has always had and gains *nothing* from this channel. That is what makes the channel
structurally incapable of saying "that was bad", and §16 asserts it — **against a
precondition that the piece really landed**, because a silence measured after a placement
that never happened is the vacuous pass this file has already shipped once.

**Acceptance §4 (reduced motion) is honoured by ordering, not by a branch.** The pitch and
the buzz are played *before* any reduced-motion return, so the dimension that carries the
distinction is the one that does not move. §19 measures a live tone with
`reducedMotion: 'reduce'` set.

---

## 2. §1 — the adult's readout

A flex **sibling** of the three tray slots, not an overlay on them. "Does not intersect an
interactive rect" is then a property of the layout rather than a promise about coordinates
that would have to hold at three viewports forever. It costs each slot ~9px of height
(127 → 118 on the S10+); §14 still passes with room.

§18 derives the exit's column **from `#gameBack`'s rect at runtime**. Headless Chromium
reports a zero safe-area inset, so the exit measures x 10–74 there and x 30–94 on the
fleet — a literal would have been right on this machine and wrong on all three phones.

---

## 3. §2 — the win, and the defect the new check found on its first run

**The celebration was being destroyed by the gesture that earned it.**

It opens synchronously inside the `touchend` that placed the last piece, so it is
inserted **under a finger that is still on the glass** — and the browser then synthesises
a `click` from that same tap, which lands on an element that did not exist when the
gesture began. Recorded in the harness:

```
pointerdown 910   touchend 936   click ON-CELEB 936
```

Every sample from 10ms onward found an empty board. What would have shipped is a win that
flickers and vanishes — and it would have looked, on the device, like the fireworks
"not working" rather than like a dismissal.

**This is architecture §6.1 member 6 from the other side.** The project's four earlier
instances were all *"the click never comes"* — a second finger on the glass, a tap that
slides. This is *"the click comes and it is not the child's"*. Same underlying fact — **a
synthesised click is not a finger** — and the corollary is new: **a control that appears
mid-gesture must ignore the tail of the gesture that created it.**

The fix is a 350ms settle window on **input only**; the self-return is exempt, so the two
ways out are independent rather than one being the other's fallback.

**Invariant 5 is honoured twice, not once.** One tap out, *and* it ends by itself. Either
alone is a defensible reading; both is the only reading that survives both a child who has
put the phone down and a child who has not learned the fireworks are tappable.

**No shared particle code.** The emitter is built inside `mount`'s closure and released by
`teardown`, per §3 of the work order. Nothing is imported; §8.1's one-file-per-game holds.

---

## 4. Two instrument defects found in the checks themselves

**4.1 — `check-games-offline.mjs` (check 11) fails on English prose. Not mine to fix; it
should be fixed.**

Check 11 is a fail-closed gate on northstar invariant 3. Its specifier scanner allows an
unbounded lazy gap between the keyword and the specifier — deliberately, so
`import{x}from'…'` split across lines is still caught — but it runs on the **raw** text,
not the stripped text **its own comment at `:230` says it uses**. So it paired the word
"imports" in a comment at `games/blockpop.js:12` with a backticked token **792 lines
later** and reported:

```
games/blockpop.js:12 — import '#gameBack'
```

A forbidden bare specifier, in a file with no imports at all, naming a line of English.
Reproduced exactly:

```
match starts line 12 ends line 804 specifier: "#gameBack"
```

I reworded my own comments, because check 11 is outside this work order's fence, and left
a note at the foot of `games/blockpop.js` so the next person does not spend the hour. **The
narrow fix is to scan the stripped source the file already computes.** Until then, any game
module whose comments happen to contain the keyword before a later quoted token cannot be
committed, and the error points at a line containing nothing of the kind.

**4.2 — the controls harness under-reported its own size, and had been doing so before
this work order.**

`demo-blockpop-controls.mjs` printed `QUEUE.length` from a line **part way down the list of
`plan()` calls**, so it announced the defects declared *above* that line rather than the
number about to run — **52 of 70** here. A count taken before the thing it counts is
finished is the same defect as a count typed by hand: authoritative-looking, and it rots
without anyone touching it. Moved below the last `plan()`. (`results.length` in the final
verdict was always correct.)

---

## 5. Four fixtures that were always perfect clears

Sections 4, 6, 12 and 13 each fill a whole line on an **otherwise empty** 6×6 board. That
was always a board-clearing move; nothing existed to notice it. Now it is the win, the
celebration covers the board, and it correctly refuses play until it is left — so their
**later** placements landed on the overlay and did nothing.

That is not merely cosmetic. **§4's column-clear plant went GREEN**: "column 0 did not
clear" is trivially true of a column that was never built. One of the 54 existing red
proofs had stopped proving anything, and the controls harness is what said so.

Each of those fixtures now parks one cell at 5,5. **I want to be explicit that this is not
a test bent to fit new code** — it is a fixture whose true description only became
available once the game could tell a line clear from a board clear.

The `api.vibrate(18)` plant's anchor moved with the buzz into `comboReact` and was
repointed. It reported `HARNESS-BROKE`, not green, which is the only reason it was found.

---

## 6. The adversarial pass, and three plants that were wrong before the checks were

Sixteen new plants, one per new assertion. **Three of my own plants failed first, and each
failure was mine rather than the check's:**

- **A no-op plant reported GREEN, correctly.** `if (0) endCelebration();` inserted next to
  a real `endCelebration()` that still ran — the module was unchanged, so §19 rightly
  passed. A plant must remove the behaviour, not add a statement near it.
- **An ambiguous anchor planted nothing.** `if (dead || celebEl) return;` is also
  `armFxSweep`'s guard; `sub()` refused rather than picking one, and reported
  `HARNESS-BROKE`.
- **A plant went red for the wrong reason.** Deleting the settle window outright destroys
  the celebration before §19's *first* assertion samples it, so the check failed saying
  "clearing the whole board passed unnoticed" and never reached the line the plant
  targeted. Replaced with the half-fix someone would actually write — *guard the
  synthesised click only* — which leaves a real finger dismissing instantly and is
  invisible to any check that only watches clicks.

**And one check was fragile in the direction that fails a correct build.** §19's guard
probe originally tapped after ~200ms of assertions and several CDP round trips — racing
the module's own 350ms window. On a loaded 2-core runner the "early" tap lands late, the
celebration goes away exactly as designed, and the build is reported broken. The probe now
taps immediately, which puts it unambiguously inside any plausible window **without this
file naming the module's constant**.

§16, §17 and §19 join §6 and §13 in `TIMED` — they measure wall clock, screenshot bytes
and a 3.4s self-return, and CI's runners are 2-core.

---

## 7. What §16 and §17 measure, and what they refuse to measure

- **Particles:** counted as elements, then required to be *sized* and *inside the board* —
  a rect comes from style, not from ink, so a count alone would pass a burst of 0×0 spans.
- **Brightness:** **real pixels.** The clip is screenshotted, handed back to the page,
  decoded through an `<img>` onto a canvas, and averaged. Reading `--bp-peak` back, or even
  the resolved `background-image`, grades the feature against its own source.
- **Pitch:** observed at the shell's entry point, asserted rising and clear of the clamp.
- **§17 proves its own null result first.** Two captures of the same frozen state must be
  **byte-identical** before any "these differ" is trusted. Its strongest assertion compares
  a 2× and a 1× combo on boards that are *identical afterwards*, with every painted word
  covered — so the only thing that can differ is how hard the world reacted.

---

## 8. One consequence worth ruling on, and it is not mine

**A perfect clear blocks play for up to 3.4 seconds** (one tap, or the self-return). That
is what a celebration is, and invariant 5 is satisfied twice over. But it is a new
*modal* state in a toy that otherwise has only one, and the 3.4s figure is my choice, not
the work order's. If Scotty wants it shorter on the device, it is one constant
(`CELEB_MS`).

**Flagged, not folded:** nothing in this work order touched the mandatory pan, `index.html`,
or Gyre.

---

## 9. The CI failure — diagnosed by experiment, and it is none of the three

PR #61 came back red in CI on **one** assertion, in a section I did not write:

```
FAIL  a cleared line stamped no paw          (§13)
```

CC-A named three suspects and asked which, stated, rather than a green re-run. **It is
none of them, and the defect predates this work order.** The experiment that settles it:

| module | check | 1× | 6× CPU throttle |
|---|---|---|---|
| `main` @ `6c5fe9a` | `main` @ `6c5fe9a` | ok | **FAIL — "a cleared line stamped no paw"** |
| this branch (pre-fix) | this branch (pre-fix) | ok | **FAIL — same message** |
| this branch (fixed) | this branch (fixed) | ok | ok — and still ok at **8×** |

Row 1 is the one that matters: **no parked cell, no celebration, no `comboReact`** — the
tree CI has been passing for days — and it reproduces CI's exact message under throttling.

- **Not the fixture change (suspect 2).** Ruled out by row 1: the failure occurs with the
  fixture as it was.
- **Not the celebration (suspect 3).** No celebration runs in this scenario at all — with
  the cell parked it is a line clear, and `main` has no celebration code in any case.
- **Not a defect in the paw path (suspect 1).** The instrumented trace shows the path
  behaving exactly as designed: `beginClear` at t, stamps painted at t+10ms, released by
  the `CLEAR_MS` timer at **t+281ms**.

**THE CAUSE: THE CLEAR WINDOW OPENS ON `pointerdown`, AND THE CHECK BUDGETED AS THOUGH IT
OPENED LATER.** `onCellDown` calls `place()` directly (`games/blockpop.js`), so the 280ms
timer is armed **while the finger is still down**. §13 then spent `fingerTap`'s own 40ms +
120ms, plus its own `wait(90)` — **250 of the 280ms gone before the first byte of the
query**, leaving about **30ms** for every CDP round trip in between. That passes on a
16-core desktop and fails on a 2-core runner. It was measuring the machine.

My change is not innocent of the *timing*, but it is not the cause either: `comboReact`
costs **~3ms of that ~30ms** (199ms → 202ms to the same sample point, measured both ways,
twice each). Enough to tip a run that was already on the line; not enough to be called the
reason. **I want that stated precisely rather than either claimed or hidden.**

### The fix: stop sampling a transient, start listening for it

The paw is transient **by design**, so there is no steady state to wait for and no sleep
that fixes it — a longer one misses it, a shorter one races the animation's first frame.
§13 now installs an `animationstart` recorder **before** the placement and asserts on what
it captured. The record does not care when it is read.

**It is also strictly stronger than the poll was.** A poll can only ever count paws that
*survived until the query*, so a build that stamped six and released five early was
indistinguishable from one that stamped one. And `stampOverFilled` was near-vacuous when
sampled late — no paws left means no paws over live cells; asked at stamp time it is a
real assertion, that a paw lands on a **dying** cell.

Verified green at **4×, 6× and 8×** throttling, where the previous version failed at 6×.

### `PUPPAD_THROTTLE`

The lever that made this diagnosable is kept: `PUPPAD_THROTTLE=<n>` applies
`Emulation.setCPUThrottlingRate` locally. Unset in CI and in every normal run, so it
changes nothing that ships — it exists so a wall-clock assertion can be **shown surviving
the conditions that broke it**, instead of being re-run until it passes.

**The general lesson, and it is the one worth keeping:** *"it went green locally" is not
evidence about CI, and neither is "it went green in CI twice".* The way to settle a
timing failure is to **reproduce it deterministically** — a throttle rate is a knob; a
re-run is a coin.

---

## 10. Verdict

| | |
|---|---|
| check 1 (syntax) | **PASS** — `games/blockpop.js` parses as a module |
| check 11 (games offline) | **PASS** — 3 modules scanned, no imports (see §4.1) |
| check 12 (offline controls) | **PASS** — 48 controls |
| check 21 | **PASS** — 19 sections, and green at 4×/6×/8× CPU throttling |
| check 21 controls | **PASS** — **70 of 70 planted defects red, every one for its own stated reason** |
| gate 2, assets, mutations, cache-name, load, error-caching, cache-isolation | **PASS** |

`check-two-trees` needs a built `dist/` from an earlier CI step and cannot run standalone;
it is unrelated to this change.

**Fence:** `git diff --stat origin/main --` against `index.html`, `sw.js`, `manifest.json`,
`games/gyre.js`, `games/hello.js` and `icons/` returns **empty**.

**One behaviour for Scotty to feel on the device rather than read here:** the perfect clear
now stops play for up to 3.4 seconds. It is one tap to leave, and it leaves by itself, but
it is a modal moment in a toy that had one. `CELEB_MS` is the constant if it wants to be
shorter.
