# PUP-WO-0402 — the drag that lies, the sounds, and the flair — builder feedback

**Subject:** `build/wo-0402`, merged with live `main`.
**Built:** `games/blockpop.js` · `.github/ci/demo-blockpop.mjs` (sections **11, 12, 13, 14**
new; sections **1, 2, 8** corrected) · `.github/ci/demo-blockpop-controls.mjs` (**28** new
red proofs, 52 total).
**Fence:** `sw.js`, `manifest.json`, both icons, `games/gyre.js`, `games/hello.js` and
`index.html` all diff to empty against `origin/main`. No new asset file, no `urlsToCache`
change, no edit to `pawSVG`.

**Order:** build §1 alone → §2, §3 → freeze at `bc5bc55` → three-lens adversarial pass →
disposition → this document → PR. **The draft frozen with the build had four false claims
and the pass falsified all four**; they are corrected here and noted in §5.

---

## 1. §1 — the drag, and the part of it I got wrong

### 1.1 THE PIECE WAS NEVER VISIBLE AT ALL

Scotty's words were *"the piece should be visible under your finger when you drag so it's
visually coherent."* **That is two requirements and I read it as one.** I fixed coherence.
**The dragged piece was drawing nothing.**

`.bp-drag` had no `display:grid`. `fillPieceBox` sets `grid-template-columns/rows` on
whatever box it is handed, and the tray's `.bp-piece` carries `display:grid`; the drag
proxy did not. So the template was inert, the piece cell had no intrinsic size, and it laid
out at **0×0 inside a correctly-positioned, correctly-sized 64×64 box.** Measured on the
frozen build:

```
.bp-drag box 64x64 · children 1 · class "bp-piececell" · child rect 0x0
```

**Nothing saw it**, including the section written that day to measure the drag, because
every assertion read `.bp-drag`'s **bounding rect** — and a rect comes from style, not from
ink. The blindness lens planted "the proxy draws nothing" as a hypothetical defect and
found it already shipped.

§11 now requires the proxy to contain drawn `.bp-piececell` children, requires their
smallest to be at least half the board cell, and requires their union to be the box it
measures.

### 1.2 The coherence defect

`moveDragEl` lifted the picture by `cellPx * 0.9`; `hitCell` resolved at the raw finger.
Fixed as ruled: `DRAG_LIFT_CELLS` has **one** consumer, `dragLiftPx()`, which has two —
`moveDragEl` and `hitCell` — so neither can drift without changing the derivation both
read. The off-grid `pad` is measured against the lifted point.

### 1.3 A lift silently costs REACH — and the residual is under the project's own floor

To put the picture on the **bottom** row the finger must go a lift *below* it, and the
finger cannot leave the glass. The lift is now capped by geometry so no row is ever
unreachable on any device. **Measured with a finger, walking the glass in 2px steps and
reading the row the ghost previews:**

| | row 0–4 band | row 5 band |
|---|---|---|
| uncapped `0.9` | 64px | **15px** |
| capped (shipped, applied lift 46px) | 62–64px | **32px** |

**32px is below the 44px minimum touch target that check 21 §1 itself enforces on board
cells**, and the last 3px of that band is the physical screen edge. Every row is reachable
and every band was confirmed by real drops at three points each.

**This was put to Scotty rather than settled here**, because it is a question about his
child's hand. With a *constant* lift the trade is exact — `band = 78 − lift` — so clearing
a fingertip (~58px) leaves 20px while the 44px floor needs ≤34px, and **both cannot hold.**
He was asked, and answered. **He was then asked again, by the other session, and answered
differently — see §1.4a, which is the more useful finding.**

### 1.4 §1b — the taper, and a sign error in the ruling that the assertion settled

The constant is a full `0.9` — full clearance where he plays, easing to nothing over the
last 2.6 cells of glass. Measured:

| | rows 0–5 touch bands | lift |
|---|---|---|
| 0.9, no taper | 62/62/62/62/62/**32** | 46px (capped) |
| 0.53, no taper | 64/64/64/64/52/46 | 34px |
| **0.9 + 2.6-cell taper (shipped)** | **64/64/60/48/48/46** | **57.6px** |

#### 1.4a THE OPERATOR WAS ASKED THE SAME QUESTION TWICE, BY TWO SESSIONS, AND GAVE TWO DIFFERENT ANSWERS

A process defect in the dual-session arrangement, and it nearly shipped a contradiction.

- **I asked first**, with three options — keep the 46px lift, drop to 34px, or decide it on
  the glass. **The taper was not among them because the idea did not exist yet.** He chose
  **34px**: the even board, accepting a hand over the piece.
- **CC-A asked minutes later**, with four options including **"taper it near the bottom"**.
  He chose **the taper**, refusing both horns of the trade.

**Both records are accurate and neither is the whole thing.** My first draft of this section
said he "accepted a hand over the piece" — true of the question I put, misleading as a
standing account, because by then he had been offered something better and taken it. CC-A
read that as having his choice backwards. **The right correction is not to swap one partial
account for the other: it is that he answered two different questions.**

**What made it dangerous:** I had already built to `0.53` and was verifying it when CC-A's
ruling arrived. Had the messages crossed the other way, this branch would have shipped the
answer to the superseded question while the work order recorded the other — **with both of
us correctly quoting him.**

**How to avoid it:** an operator question is a shared resource. Whichever session asks
should say so to the other *before* the answer is acted on, and a ruling that changes the
options on a question already asked must say which asking it supersedes. Neither of us did
either. The cost here was one wasted build; the mirror case is a directive and a build that
disagree while both cite the operator.

**Two things had to be undone to make the taper load-bearing.** The reach cap and the
floor cap were both derived for a *constant* lift; left in place they clamped the base to
34px, so the taper did no work — **and its own red proof passed against a build with no
taper at all.** They now guard only the degenerate case where the taper is switched off.

**The work order's inversion analysis has its sign the wrong way round, and the assertion
it asked for is what settled it.** A taper that *sheds* lift as the finger descends gives
the mapping slope `1 + base/span`, which **cannot invert however steep it is**. The mapping
only runs backwards when the lift *grows* toward the bottom faster than the finger travels
— `1 − base/span`, negative once `span < base`. The 1.5-cell floor was therefore
unnecessary; **2.6 cells is set by a different constraint entirely** — inside the taper the
mapping compresses by that same slope, so the bottom row's band is `cell/slope`, and
holding it over 44px needs `span ≥ base/(cell/44 − 1)` ≈ 2 cells. At 2.25 it measured
*exactly* 44, so 2.6.

The planted inversion is built with the sign that actually inverts, and it exposed a second
gap: **row granularity is too coarse.** An inversion confined inside one row shows no row
change at all and was green. The walk now also records **the picture's own y**, which is
continuous.

**That gap was found by the assertion itself** — the plant refused to go red, and the reason
was the assertion's own resolution rather than the build. It is the first time an instrument
in this project has caught its own blindness rather than having it demonstrated by a plant,
and it is worth more than the 204 samples it now takes.

### 1.5 The acceptance measures in a third frame

§11 reads the **painted rect of `.bp-drag` while the finger is down**, then the rect of the
cell that filled, and asserts the picture sits inside it. **The lift is derived from the
picture** (`fingerY − paintedCentreY`), never written into the test — writing `cellPx * 0.9`
there would have put a copy of the defect inside the check.

Containment alone tolerates half a cell in each axis *on a correct build*, because the
picture floats and a cell is discrete — a 20px horizontal desync and a 12px lift error both
survived it. So §11 also aims at an exact cell centre, **where the expected offset is zero**,
and both plants now go red.

**§11 also asserts what nothing asserted before: where the GHOST is painted.** §2 reads the
ghost's DOM *parent*, never its geometry, so a ghost given `transform:translateY(-72%)` —
drawn a cell away from the well it marks — was green everywhere, and §2's comment claiming
§11 covered it was false. Corrected in both places.

## 2. §1a — the thing he grabs was half the thing he aims at

The source divides **both** axes by `max(w, h, 3)` against a hardcoded `88` that assumed
its own 128px slot. In this port's 357×123 landscape slot a 1×1 dot drew at **35px beside a
64px board cell** — the biggest, emptiest panel on screen holding the smallest graphic.

Per-axis against the measured slot, with a shared cap at 1.35× the board cell: **the
smallest tray piece cell is now 86px, up from 36px.**

**CC-A's clause "no piece cell under the board cell" was struck, and I raised it before
building rather than discovering it after.** A 4-long piece at a 64px cell needs 256px on
its long axis; a slot holding both a 4-wide and a 4-tall piece is square at 256px; three of
those is 768px against a 357×396 tray column. CC-A verified the arrangement space
independently. What holds instead, and is asserted in §14 across six shapes seeded through
the real `api.load` path: **every shape fills at least half the slot's shorter axis**
(worst 68%). The residual — a `quad-v` at 27px — is **reported, not asserted**, and is safe
only because **the ghost resizes to the board cell on pickup**, which §11 asserts.

## 3. §2 — the voice

| event | cue |
|---|---|
| a piece leaves the tray | `keyTap` |
| it lands | `tap` |
| it cannot go there | `lock` — two soft descending sines |
| a line goes | `twinkle` + `api.vibrate(18)`, the only buzz |
| the tray refills | `blip` |

`error` and `alert` are square waves and the refusal must never be one: a buzz for "I
changed my mind" teaches a three-year-old that the controls bite.

**§12 reads the bank list out of the shipped `doSound`, not from a copy in the check.**
With a pasted list, deleting `lock` from the shell's own table left the refusal **silent**
while the check still called the name valid — two expressions that must agree, one of them
in the test. Demonstrated green before the fix.

**The post-teardown window went 700ms → 3s.** A cue scheduled 2.5s out survived both this
clause *and* section 8's timer clause.

No `AudioContext` is constructed by the module, attributed by construction stack.

## 4. §3 — the flair, the console's own geometry

- **Radar ground** — `repeating-radial-gradient` rings plus a horizontal scan line on
  `.bp-root`, behind the board. No elements, painted once.
- **The paw** — `pawSVG(100, colour)` as a `data:` URI on a cleared cell in the candy's own
  colour. Called, never edited. No `innerHTML`, no image file, no `urlsToCache` line;
  invariant 3 confirmed by check 11.
- **The sweep** — one turn, 620ms, on a line clear only, built from **two** elements (the
  rotating container and its arm). The console's own sweep is `5s linear infinite`, and an
  infinite rotation under a drag is what stutters an S10+.

**Measured on the budget rather than assumed.** At 4× and 6× CPU throttle the sweep costs
≤0.5ms on the `pointermove` p95 and the dropped-frame count is **identical with and without
it** (0→0 at 4×, 1→1 at 6×), against a positive control arm — 40ms injected per move — that
drops 11/25 and 12/22 frames and raises 4 long tasks.

**A defect found here and fixed:** a paw was left stranded over a cell that came back to
life. There are two ways out of the dying state — the cell empties, or a piece lands on it
*inside* the clear window — and only the first released the stamp. It was invisible only
because the keyframe ends at `opacity:0` with `forwards`, and it made the code comment
claiming *"it cannot mask a filled cell"* false as written. **§13 already had the assertion
that catches it and simply never sampled at that moment**; it does now.

## 5. What did not work

- **Four false claims in the frozen draft**, all corrected: `api.sound('pop')` never
  shipped (removed before the commit); section **8** was not corrected in this WO;
  the sweep is **two** elements, not one; and there is **no crosshair** — one horizontal
  scan line. A fifth was pedantically false and sat in the **code comment as well** — the
  lift is one *name* with one derivation and two consumers, not "one constant consumed by
  two expressions".
- **A race in the harness that reports on races.** The red proofs run in lanes and each
  scenario located its record by reading `results.length` — a shared counter two lanes read
  the same value of. One row appeared **five times** and four vanished. Scenarios now return
  their record.
- **A vacuous pass.** §12's refusal tapped an empty cell just after a clear, so the piece
  **placed**, and it asserted "no harsh cue" against a move that succeeded. **Third time
  this file has needed a liveness precondition added to an assertion about absence.**
- **Three plants that proved nothing.** One was a syntax error; one guarded only the first
  of two statements; one — `grabCell` dividing the slot — **no longer manifests**, because
  §1a's larger tray piece incidentally cured it. That last is a result, and it is recorded
  rather than deleted.
- **AIM BY OBSERVATION, NOT BY PREDICTION.** §11 predicted the finger position from one
  measured lift — `finger = target + LIFT` — which is **a model of the old mechanism living
  inside the test.** Under §1b's taper it aimed at the wrong place, **failed a correct build
  by 11px, and reported reachable cells as unreachable.** It now carries no model of the
  lift at all: it drags, reads where the picture actually is, corrects by the residual, and
  repeats. **This and "a rect comes from style, not from ink" are the same lesson at two
  ranges** — do not let a test hold a belief about the thing it is measuring.
- **A guard carries its assumptions invisibly.** Both lift caps were derived for a constant
  lift; kept across a mechanism change they clamped the base and **silently disabled the
  new mechanism**, and the taper's own red proof passed against a build with no taper.
  "Keep the existing guard" is an instruction that needs the question *derived under what?*
- **`elementFromPoint` cannot see a decorative overlay**, because `pointer-events:none`
  removes it from hit testing. A green haze laid over the board as a `::after` was green.
  §13 now asks for pseudo-layers by name as well.

## 6. Gates

| P4 exit gate | state |
|---|---|
| 1 — both sizes playable | unchanged; easy only, classic is 0401's |
| 2 — no-moves state, one control | unchanged; still unreachable in easy by design |
| 3 — `players: 2` | not attempted, out of scope |
| **4 — with all text covered, board and tray operable** | premise asserted (no painted word inside `host`); the flair adds none. **Gate is human.** |
| 5 — airplane mode, cold start | not proven here; no network construct |
| §5 — every new check red **with a real defect** | **met: 52 of 52**, and every mutant parses |

## 7. Not built

The score — **ruled closed**: nothing renders it, which is northstar §5's non-goal
honoured, and making it visible is a change to a non-goal that goes to the northstar first.
The 8×8 entry and the four assists (`0401`, blocked on `0111`). Any change to `pawSVG` or
the radar markup. Haptics beyond the single clear buzz. **The paw stamp is not suppressed
under reduced motion** — it is shortened to 40ms and never reaches a visible frame; if the
intent was "no transform animation at all", that is the one that was missed.
