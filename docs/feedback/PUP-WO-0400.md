# PUP-WO-0400 — Block Pop, playable: easy 6×6 — builder feedback

**DRAFT, frozen for the adversarial pass.** Per PUP-WO-0400 §5 the order is
build → freeze → pass → disposition → feedback → PR, and architecture §6.1 member 5
requires the pass to read this file as a deliverable and measure its claims. Nothing
below is final until the pass returns and §7 records its dispositions.

**Subject:** branch `build/wo-0400`, based on live `main` at `88a0f27`.
**Built:** `games/blockpop.js` (new), one `GAMES` entry in `index.html`, one
`urlsToCache` line in `sw.js`, `.github/ci/demo-blockpop.mjs` (check 21, new),
`.github/ci/demo-blockpop-controls.mjs` (check 21's red proofs, new), two steps in
`.github/workflows/ci.yml`.

---

## 1. Findings

### 1.1 The scope fence forbids the file that holds the line the invariant requires

| | |
|---|---|
| **finding** | §2 invariant 6 requires "one `urlsToCache` line". §4 orders `sw.js` to "diff to empty". §7 locates the line in "`index.html`'s registry + `urlsToCache` line". **`urlsToCache` is `sw.js:317`, and occurs zero times in `index.html`.** The fence therefore forbids the only file in which the required edit can be made. |
| **where** | `docs/work-orders/PUP-WO-0400.md` §2 invariant 6, §4 bullet 4, §7 bullet 3 · `sw.js:317` |
| **type** | work-order internal contradiction (blocking as written) |
| **recommendation** | Amend §4 to except the one `urlsToCache` line, and correct §7 to say `sw.js`'s. I built it with the line in `sw.js:319` rather than stopping, because three independent things agree on the intent and only the fence's *location* is wrong: invariant 6 demands the line, `check-gate2.mjs:212` fails with `'the urlsToCache line (sw.js) was not added'`, and `check-cache-name-controls.mjs:154` carries a scenario named "a NEW GAME: module + registry entry + one urlsToCache line". |
| **decision-needed** | **no** — flagged, not asked. Ratify or reverse at review. |

### 1.2 §3 check 7 asks for a fresh board; §1.3 mandates a save that makes it not fresh

| | |
|---|---|
| **finding** | §1.3 requires saving through `api.save`/`api.load` namespaced by `api.entry.id`. §3 check 7 requires that mounting `blocks`, playing, leaving and mounting `blocks` again yields "a fresh board, not a retained one". With persistence working correctly the second mount **resumes**, so the check as literally worded fails a correct implementation. The check's stated *rationale* is about module-scope state, which is a different thing from saved state. |
| **where** | `docs/work-orders/PUP-WO-0400.md` §1.3 bullet 4, §3 item 7 |
| **type** | ambiguity — two mandates, one observable, they disagree |
| **recommendation** | I implemented persistence (§1.3 is explicit) and made check 7 test the *discriminating* version: play, leave, **clear storage**, remount → must be empty. Anything that comes back with storage empty came back through the module, which is the hazard §0.4 actually names. I then added the test §0.4 describes directly — two entry ids against one module URL, mounted simultaneously, asserted to hold independent boards of independent sizes. Both pass. Suggest §3 item 7 be reworded to the storage-cleared form. |
| **decision-needed** | **yes** — if resuming a board is wrong for Buddy, say so and I will drop the save; the WO cannot have both as written. |

### 1.3 The subject-SHA line in the dispatch message does not match the document

| | |
|---|---|
| **finding** | The dispatch message states the WO header "names 88a0f27 as its subject SHA". The header names **`317d792`**. |
| **where** | dispatch message · `docs/work-orders/PUP-WO-0400.md` header |
| **type** | citation drift, benign |
| **recommendation** | None needed, and I verified rather than assumed: `88a0f27` is the commit that *adds* the work order, `git log 317d792..88a0f27` is that one commit, and `git diff 317d792 88a0f27 -- index.html` is empty. Every `index.html:NNNN` resolved at `317d792` therefore holds unchanged at live `main`. Recorded because the same class of drift is what §1.2's parenthetical is about. |
| **decision-needed** | **no** |

---

## 2. What did not work, and why

### 2.1 Two of my own checks were wrong, and only the red proofs found them

Both failures were in the **instrument**, and both would have shipped as green.

- **§5's planted defect was a syntax error, not a defect.** Rewriting the middle arm of
  an `if / else if / else` chain orphaned the trailing `else`; the module failed to
  parse, the game never mounted, and the check "went red" for a reason that establishes
  nothing. The control harness refused to score it because it matches on the *text* of
  the failure, not merely on a non-zero exit.
- **§6 asserted "placed inside the 280ms clear window" while placing outside it.** Its
  two `fingerTap` calls wait 40ms + 120ms each — over 320ms before the second placement
  lands, past the timer it was probing. The section went **GREEN against the source's
  stranded-`clearing` bug replanted verbatim.** It now pre-measures the rects and fires
  raw touches with 10ms waits, landing in roughly 40ms.

This is the same shape as check 19 reporting `spin` inert while never touching it, and
check 20 dividing two different rectangles by their own widths so a 214px error
cancelled. **The check believed a claim about its own timing that it never measured.**
§3 item 9 is the only reason either was caught, and it earned its cost on first use.

### 2.2 A dead call I wrote and removed

I first wrote `api.sound('pop')` on a successful placement. `pop` is not one of
`doSound`'s twelve bank names (`index.html:174-186`), so it was a silent no-op that
reads like a feature — and audio is fenced to `PUP-WO-0402` anyway. Removed, with the
reason stated at the call site rather than deleted silently.

### 2.3 The check harness reported the game broken three times before it was right

`placeAt` first tapped slot 0 unconditionally. The tray only refills when **all three**
slots are empty, so two placements in three landed on nothing and section 4 reported
"the row did not clear" — a defect in the check presented as a defect in the game.
Section 8 likewise reused touch id 1 for the exit while id 1 was still down from the
drag, an invalid touch sequence, and reported 76 leaked nodes when the exit had simply
never been pressed. Both are recorded because in each case **my first instinct was to
go looking in the module.**

---

## 3. What was deliberately not built

- **The 8×8 `blocks-big` entry and the four assists** — `PUP-WO-0401`. One registry
  entry ships. The module *does* read `api.entry.params.mode`, and check 21 §7 proves a
  second entry would get a correct 8×8 board, so 0401's entry is a data change.
- **Particles, audio, cheer, shake, haptics** — `PUP-WO-0402`. The module constructs no
  `AudioContext` and makes no `api.sound`/`api.vibrate` call at all.
- **The score's presentation.** The engine accrues it and the seam exposes it; nothing
  paints it.
- **`players` / the `{playerId, action}` reducer.** `players: 1` on the entry. Seam 1
  (no module state) is delivered by construction — see §4.
- **`helperClear`, `findHint`, `undo`, `shuffle`.** Ported no further than the engine
  needs; they are the assists' machinery and belong with the assists.
- **`Piece.id`.** Its only reader was a React key (`PieceTray.tsx:22`); it is neither
  stable nor unique (its mint counter resets on module load) and carrying it into the
  save blob would have imported a bug.
- **`styles.css:29-60` (`@layer base`).** Its selectors are `html`, `body`, `h1`, `h2`,
  `h3`, `button`, `[role="button"]` and **`#app`** — and PupPad has a live `#app`.

---

## 4. How the two inherited source defects were answered

- **`popping={!!color && !dying}` (`Board.tsx:68`) is permanently true for every filled
  cell.** It only looks right because React's keyed reconciler preserves the node.
  Answered with a transition classifier: the painted state is retained per cell, each
  update classifies against it, and a cell whose state did not change **is not touched at
  all**. Animations restart in one batch — every `classList.remove`, then a single
  `void grid.offsetWidth`, then every `classList.add` — so it is one reflow per update,
  not one per cell. The drag path never calls `render()`.
- **`clearing` is not bounded (`BlockPopGame.tsx:118-135`).** The cleanup cancels the
  timeout and the `cells.length === 0` branch never nulls the state. Answered by giving
  the dying set exactly one writer: `beginClear` cancels **before** it decides, so an
  empty burst clears the state instead of leaving the previous one armed and orphaned.
  The fix is not a longer timeout.

## 5. Layout

The rule, not a number: **the board's side is the available height, the tray takes the
width that is left, and the left 84px is the exit's column.** Measured identically on
all three fleet devices — board **396 × 396 at x = 84**, 39 game-owned controls on
screen, none intersecting `#gameBack`'s x 10–74. `cellPx` is `rect.width / N` = **66.0**,
derived from a `ResizeObserver` on `host` and from no viewport unit anywhere.

## 6. Gates

| gate | state |
|---|---|
| P4 item 1 (one size playable) | **met for easy 6×6** — check 21 §2, §3, §4 |
| P4 item 2 (fits the fleet) | **met** — check 21 §1 at 869/915/883 × 412 |
| P4 item 4 (terminal state has a one-tap way back) | **built, not gate-proven** — see §7 |
| P4 item 5 (teardown) | **met** — check 21 §8, from mid-drag with a pointer captured |
| §3 item 9 (every check seen red) | **met** — 8 of 8, each for its own stated reason |

## 7. Open, and not simulated

**The terminal state is built and is not covered by check 21.** Running out of room
raises a single glyph button inside `host` that resumes play; it calls no `api.close()`.
Reaching it with a finger requires filling a 6×6 board until no tray piece fits, which
the deterministic all-dot deal makes *unreachable* — a dot fits wherever a single cell
is free, so the board must be entirely full, and `rescueUnplaceable` keeps handing out
dots. **I did not fake it by calling the seam.** It needs either a seeded deal that
produces genuinely unplaceable pieces or a human. Recording it as open rather than
claiming a gate I did not clear.
