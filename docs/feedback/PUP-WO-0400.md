# PUP-WO-0400 — Block Pop, playable: easy 6×6 — builder feedback

**Subject:** branch `build/wo-0400`, merged with live `main` at `843becc`.
**Built:** `games/blockpop.js` (new) · one `GAMES` entry (`index.html:235-236`) · one
`urlsToCache` line (`sw.js:324`) · `.github/ci/demo-blockpop.mjs` (check 21, new) ·
`.github/ci/demo-blockpop-controls.mjs` (check 21's red proofs, new) · two steps in
`.github/workflows/ci.yml`.

**Order:** build → freeze at `6032b0e` → four-lens adversarial pass → disposition → this
document → PR. This file was **drafted before the pass and rewritten after it**, because
the pass read the draft as a deliverable (architecture §6.1 member 5) and **falsified six
of its factual claims.** §3 records them; they are the reason the order matters.

---

## 1. Findings raised to CC-A, both ruled

### 1.1 The scope fence forbade the file holding the line the invariant required — **RULED, amended**

§2 invariant 6 required "one `urlsToCache` line"; §4 ordered `sw.js` to "diff to empty";
§7 located the line in "`index.html`'s registry + `urlsToCache` line". **`urlsToCache` is
`sw.js:317`.** It appears in `index.html` exactly once — at `index.html:214`, inside a
prose comment about adding a game — and there is no `urlsToCache` *list* there at all.
So the fence forbade the only file the required edit could be made in.

I built through it rather than stopping, because three things agreed on intent and only
§7's *location* was wrong: invariant 6 demands the line, `check-gate2.mjs:212` carries the
literal string `'the urlsToCache line (sw.js) was not added'`, and
`check-cache-name-controls.mjs:154` names a scenario "a NEW GAME: module + registry entry
+ one urlsToCache line". *(Both are inside those checks' own scenario simulators — they
describe what the instrument asserts about a staged repo, not a verdict either renders
against this commit. The inference about intent is sound; "fails with" would overstate
it.)* CC-A amended §4 and §7. **`sw.js` gets exactly one added line and nothing else.**

CC-A recorded it as **the fourth self-contradicting work order**, and as the fourth *after*
the ruling that a fence is stated once specifically to prevent this.

### 1.2 §3 check 7 contradicted §1.3 — **RULED, and it surfaced an unwritten ruling of Scotty's**

§1.3 mandated saving through `api.save`/`api.load`. §3 item 7 required a **fresh** board on
remount. With persistence working correctly the second mount *resumes*, so item 7 as
worded failed a correct implementation. Its stated rationale was about **module-scope**
state, which is a different thing from **saved** state.

CC-A ruled the resume in and replaced item 7 with my two-part version. The part neither of
us could have got from the document: **Scotty had asked for the durable board hours before
dispatch** — the current board should survive an app close "in a way that everything else
doesn't", so it can be picked up and put back down — **and that ruling reached a chat
message and never reached the work order.** It does not cross `PUP-WO-0701` §1.0a, whose
reasoning is that a media purge *fails open and leaves a child's photos on disk*; a board
is ~64 integers under a kilobyte carrying nothing sensitive, and that reasoning does not
reach this data class.

The replacement is discriminating where the original was not:
- **7a** — play, leave, **clear storage**, remount → must be empty. Anything surviving an
  empty store came back through the module, which is the hazard §0.4 names.
- **7b** — two entry ids against one module URL, asserted to hold independent boards.
  6×6/36 cells and 8×8/64 cells, neither overriding the other.

*(A correction to my own draft: §0.4 describes the **sequential** remount and explicitly
rejects the simultaneous framing as something §8.2 obligation 6 forbids the shell from
producing. 7b is therefore an **addition** to §0.4's case, not a restatement of it. My
draft said the opposite.)*

### 1.3 The dispatch message's subject SHA — benign, verified not assumed

The message said the header names `88a0f27`; it names `317d792`. `88a0f27` is the commit
that *adds* the work order, `git log 317d792..88a0f27` is that one commit, and
`git diff 317d792 88a0f27 -- index.html` is empty — so every citation resolved at `317d792`
holds unchanged. CC-A: "the document is authoritative; my message was loose."

### 1.4 Files touched outside §7's list, stated rather than left to be found

§7 bullet 3 permits `games/blockpop.js`, the registry + `urlsToCache` line, and
`.github/ci/demo-blockpop.mjs`. This branch also adds
**`.github/ci/demo-blockpop-controls.mjs`** and edits **`.github/workflows/ci.yml`**. Both
are §3 item 9's own machinery — a check nobody has seen go red is not a check, and an
unregistered check does not run — but neither is in the list. **My draft was pedantic
about `sw.js` and silent about these two**, which the pass flagged as an incomplete
flag-and-stop. Raising them here rather than having them found at review.

---

## 2. Defects in the build, found by the adversarial pass

All five were in code that passed check 21 at the freeze.

| # | defect | where | why it mattered |
|---|---|---|---|
| **D1** | **`grabCell` divided the SLOT, not the piece** — every 3-wide piece returned `grabC 1` whatever the child aimed at, so it jumped a full cell on pickup and landed a column off. | `games/blockpop.js` `onSlotDown` | The arithmetic was transcribed correctly from `BlockPopGame.tsx:540-560`; **the geometry around it changed.** The source's slot is a near-square 112px cell of a 3-column grid, so the piece nearly fills it. This port's slot is a wide landscape panel (~417 × 127) and a 3-wide piece box is ~114px of it, sitting entirely inside column 1. **A correct transcription into a different rectangle.** ~12.5% of easy deals by weight (tri-h 6 + quad-h 2 of 64). Fixed by measuring `.bp-piece`. |
| **D2** | **Any resumed score above 7 was silently zeroed.** | `loadSaved` | `validCell` is a **board-cell colour** predicate bounded by `COLOR_COUNT = 7`, reused to validate `score` and `combo`. The cliff is exactly 8. One line clear scores 11, so effectively **every real session lost its score on resume** — and the board and tray restored correctly, so it read as a working save. Fixed with `validCount`. |
| **D3** | **Pointer captures accumulated** — one orphaned per two-finger gesture. | `onSlotDown` / `onUp` | A second finger on another slot replaced `drag`, leaving the first drag's capture with no owner to release it. Released only at teardown. Fixed with `releaseCaptures`. |
| **D4** | **`release()`'s `persist()` was dead code, behind a guard the same function had just set.** | teardown | `dead = true` four lines above; `persist()` opens `if (dead) return;`. Harmless in effect — every mutation already persists at its call site — but **the teardown comment listed "then the save" as a step that ran.** A comment asserting coverage that did not exist. Fixed with an explicit `force`. |
| **D5** | **A stale ghost stayed painted** when a second finger took over the drag. | `onSlotDown` | Cleared only on the next `onUp`. Fixed by repainting on takeover. |

**A sixth, corrected in two places:** the module's own comment claimed
`cellPx = rect.width / N`. The board frame carries 6px of padding a side, so it is
`(side − 12) / N` = **64.0px**, not the 396/6 = 66.0 the work order's table quotes. The
false formula was **pasted in both the code comment and the feedback draft** — the
`grep the claim, not the file` lesson, arriving again.

---

## 3. What did not work: my own instruments, twice over

### 3.1 The red proofs caught two defects in the check, before the pass ran

- **A planted defect that was a syntax error.** Rewriting the middle arm of an
  `if / else if / else` chain orphaned the trailing `else`; the module never parsed, the
  game never mounted, and "red" established nothing. **Exit code alone scores that a
  pass.** Requiring the check to fail with its own stated *text* is what separated them.
  CC-A: architecture §6.1 member 3 (red for the wrong reason) hiding inside member 1's
  remedy.
- **Section 6 went GREEN against the source's stranded-`clearing` bug replanted verbatim.**
  It asserted "placed inside the 280ms clear window" while its two `fingerTap` calls wait
  40ms + 120ms each — over 320ms, past the timer, **outside the window it named.** It was
  testing nothing. CC-A: **the check believed a claim about its own timing it had never
  measured** — member 6, in the file written to hold that line.

### 3.2 Then the pass planted 17 more defects and check 21 went green on every one

This is the finding of the work order. At the freeze, check 21 passed against builds in
which:

- the board was **39 × 39** — section 1 measured the rectangle, called it on-screen, and
  sections 2–4 passed too, because the check aimed at the exact geometric centre of a 2px
  cell and **no finger can do that**;
- the tray rendered **1px pieces** — three empty boxes; section 1 measured the *container*
  and never looked inside it;
- **nothing animated at all**; section 5 counts pop animations during a drag and reports
  0, which is exactly what an inert game reports. A one-sided counter with no liveness
  precondition. `place()` returning `false` unconditionally also passed;
- the ghost painted **green over illegal drops**, and a build with no ghost at all;
- the **combo never advanced**, the **line bonus was deleted**, and **columns never
  cleared** — one clearing placement at combo 1 cannot distinguish a multiplier of 1 from
  a multiplier that is stuck;
- the **`removeEventListener` loop was deleted** — section 8's baseline was taken *after*
  the game mounted, so it already contained the module's listeners and the comparison
  could never fire. **Structurally unfalsifiable**;
- a **`setInterval` leaked** past teardown while section 8 printed "0 armed timers" — the
  wrapper covered `setTimeout` only;
- the **stylesheet moved to `document.head`** and was never removed — the exact hazard the
  module's own comment describes as one "no check would see", and it was right.

**Every one of those is now a control.** The red proofs went from 8 to **25**, and all
25 are red for their own stated reason. Sections 1–8 were hardened and **two new sections
added**: §9 the resume (until it existed, every section opened with `clearStorage: true`,
so the path Scotty asked for **was never run with a non-empty save at all**), and §10 the
terminal state.

### 3.3 A harness cost that was mine, and is fixed

The red proofs each boot their own Chromium and I wrote them to run one after another:
**~10 minutes of wall clock to prove 24 one-line defects.** They are fully independent —
private temp directory, own browser, no shared state — so they now run in lanes bounded by
core count. **21 seconds.** It was the single largest avoidable cost in this work order and
it would have been paid on every CI run.

### 3.4 The local suite was not the gate, and CI proved it

Both new checks passed locally and **CI failed anyway.** The `checks` job carries
`timeout-minutes: 10`, the pre-existing checks already consume ~9 minutes of it, and the
red proofs needed several more — so the job was **cancelled mid-step at 10m17s**. It
reported as a step failure with no failing assertion, which is the least useful shape a
red run can take: nothing was wrong with either check.

Two causes, both mine. The timeout is now 20 minutes, matching the sibling job. And the
lane count was `cores - 2`, which on GitHub's **2-core** runner is the floor of 2 — I had
sized a **browser-bound** workload by CPU count, on the assumption of a 16-core machine
that is only true of my own. These scenarios spend their lives waiting on Chromium, so the
floor is now 4 regardless of cores (~1.2GB against the runner's 7GB).

**I would not have found this by looking.** The step that failed was not either of mine —
the log's `FAIL` lines all belong to check 7's own red proofs, which are supposed to be
there. Recorded because `local-suite-is-not-the-gate` is a lesson this project has already
written down once, and it still cost a red run.

### 3.5 Three times I read a defect in the check as a defect in the game

`placeAt` first tapped slot 0 unconditionally; the tray refills only when **all three**
slots are empty, so two placements in three landed on nothing and section 4 reported "the
row did not clear". Section 8 reused touch id 1 for the exit while id 1 was still down —
an invalid sequence — and reported 76 leaked nodes when the exit had never been pressed.
The unbounded-slop control dragged from a slot the previous placement had emptied, so no
drag started and it passed whatever the slop was. **In each case my first instinct was to
go looking in the module.**

---

## 4. How the two inherited source defects were answered

- **`popping={!!color && !dying}` (`Board.tsx:68`) is permanently true for every filled
  cell**, and only looks right because React's keyed reconciler preserves the node.
  Answered with a transition classifier: painted state retained per cell, each update
  classified against it, and **a cell whose state did not change is not touched at all.**
  Animations restart in one batch — every `classList.remove`, a single
  `void grid.offsetWidth`, then every `classList.add` — one reflow per update, not one per
  cell. The pointer-move path never calls `render()` (a successful *drop* does, via
  `place()`, which is correct).
- **`clearing` is unbounded (`BlockPopGame.tsx:118-135`)**: the cleanup cancels the
  timeout and the `cells.length === 0` branch never nulls the state, so a placement inside
  the window strands it and `.candy-clear` is `forwards` to opacity 0 — cells permanently
  invisible over a board that still holds candies. Answered by giving the dying set
  **exactly one writer**: `beginClear` cancels *before* it decides, so an empty burst
  clears the state instead of leaving the previous one armed. **The fix is not a longer
  timeout.**

---

## 5. Layout

The rule, not a number: **the board's side is the available height, the tray takes the
width that is left, the left 84px is the exit's column.** Measured identically on all
three fleet phones — board **396 × 396, square, at x = 84**, 39 game-owned controls on
screen, none intersecting `#gameBack`, well 61.5px (over the 44px minimum), smallest tray
piece cell 36px, and no painted word anywhere inside `host`. Driven off a `ResizeObserver`
on `host`; **no viewport unit appears in the module.** With safe-area insets forced to
40 / 88 / 130px the gutter tracked `max(84px, env(left) + 74px)` exactly — 114 / 162 / 204
— and `#gameBack` **moves with the inset**, so the clearance must be measured against its
rect rather than a hardcoded x 10–74.

`cellPx` = `(side − 12) / N` = **64.0px**, not the work order's 396/6 = 66.0; the 12px is
the board frame's padding. Classic's cell would be 48.0, not 49.5 — still over 44, and a
fact for `PUP-WO-0401` rather than something for it to discover.

---

## 6. Gates — against `docs/roadmap.md`'s actual P4 exit gate

*(My draft's table invented its own numbering, marked "met" against an item whose real
content is the one thing that was unproven, and dropped gate 4 entirely. The pass caught
it; it was the most consequential document defect, because the gates row is what a
reviewer reads to decide whether the phase moved.)*

| P4 exit gate | state |
|---|---|
| **1** — both board sizes playable start to finish | **partial.** Easy 6×6 end to end (§2, §3, §4). Classic 8×8 is `PUP-WO-0401`'s; §7b proves a second entry gets a correct 8×8 board. |
| **2** — a no-moves state presents exactly one control, tapping it starts a new game | **met for the affordance** (§10, driving the real filter), **but see §7 — the state is unreachable through play in easy mode.** |
| **3** — `players: 2` accepted without engine changes | **not attempted.** §4 fences it; `players: 1` on the entry. |
| **4** — with all text covered, the board and tray are operable | **premise asserted, gate open.** No painted word anywhere inside `host` (§1). The gate itself needs a human; simulating it is a flag-and-stop. |
| **5** — airplane mode, cold start, play, return | **not proven here.** Check 2 has the module in the precache and check 11 finds no network construct; the gate is a human one. |
| WO §3 item 9 — every check seen red | **met, 25 of 25**, each for its own stated reason. |

---

## 7. Open, and not simulated: easy mode cannot reach the terminal state

**This is a property of the design, not a gap in the check.** `over` is
`!anyTrayFits(clearedBoard, tray)`. In easy mode `rescueUnplaceable` swaps any unplaceable
tray piece for one that fits, `pickFittingPiece` falls back to a dot, and **a dot fits
wherever a single cell is free** — so the board must be *entirely* full. But the placement
that fills the last cell of a row completes that row, and it clears. The document lens
drove **108 finger placements** and `over` stayed false throughout.

CC-A's ruling — drive the filter, do not bypass it — is right and I have followed it, but
excluding the 1×1 from the pool does not open the path, because `pickFittingPiece`'s
fallback *is* `DOT`. §10 therefore hands `api.load()` a **full board** and everything
downstream is the real code path: `dealTray` runs the real filter, the filter returns
empty, the fallback is a dot, and `anyTrayFits` says no. Nothing calls the seam to force a
state. It asserts exactly one control inside `host`, no letters, one tap resumes to a
fresh board, and **`api.close()` is not called** — the way out of the *state* is not the
way out of the game.

**Little Hands is unlosable on purpose, and that is almost certainly right for Buddy.**
It is recorded here because roadmap gate 2 reads as though every mode reaches a no-moves
state, and in easy none does. `PUP-WO-0401`'s classic mode is where it becomes reachable
through play: there `rescueUnplaceable` returns the tray untouched.

---

## 8. What was deliberately not built

- **The 8×8 `blocks-big` entry and the four assists** — `PUP-WO-0401`. One registry entry
  ships. The module reads `api.entry.params.mode`, and §7b proves a second entry gets a
  correct 8×8 board, so 0401's entry is a data change.
- **Particles, audio, cheer, shake, haptics** — `PUP-WO-0402`. No `AudioContext`, and no
  `api.sound`/`api.vibrate` call at all. *(A draft version called `api.sound('pop')`;
  `pop` is not one of `doSound`'s twelve bank names, so it was a silent no-op that read
  like a feature. Removed, with the reason at the call site.)*
- **The score's presentation.** The engine accrues it, the seam exposes it, nothing paints
  it. **D2 is why that matters:** the seam has been publishing a score that resets on
  every resume, and `PUP-WO-0402` is what would have made it visible.
- **`helperClear`, `findHint`, `undo`, `shuffle`** — the assists' machinery, and they
  belong with the assists.
- **`Piece.id`** — its only reader was a React key (`PieceTray.tsx:22`); neither stable nor
  unique (its mint counter resets on module load), and carrying it into the save blob
  would have imported a bug.
- **`styles.css:29-60` (`@layer base`)** — its selectors are `html`, `body`, `h1`, `h2`,
  `h3`, `button`, `[role="button"]` and **`#app`**, and PupPad has a live `#app`.

## 9. Notes for `PUP-WO-0401` and `0402`

1. **Classic's cell is 48.0px**, not 49.5 — over the 44px minimum, but by 4px.
2. **Classic can genuinely reach game over**, easy cannot. §10's fixture is a boot-path
   state; 0401 should reach it through play.
3. **The determinism pin hides things.** Check 21 pins `Math.random` to deal one shape;
   `0` deals a dot, and a dot is the one piece whose grab offset cannot be wrong — D1 was
   invisible to it by construction. §2 now pins to `tri-h` for the ghost tests. Any new
   section should ask what its pin conceals.
4. **`onUp` toggles the selection where the source sets it** (`select(d.index)`). A second
   tap on an armed piece disarms it, which seems right for a child who changes his mind;
   flagged as a deliberate divergence rather than left to be found.
5. **The drag proxy is lifted ~0.9 of a cell above the finger** so the piece is not under
   the hand. The **ghost is authoritative** and is drawn at the true landing cells; the
   proxy is not. If 0401 changes one, change both.
