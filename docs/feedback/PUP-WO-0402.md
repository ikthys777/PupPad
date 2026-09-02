# PUP-WO-0402 — the drag that lies, the sounds, and the flair — builder feedback

**DRAFT, frozen for the adversarial pass** (§6 order: build → freeze → pass → disposition
→ feedback → PR; architecture §6.1 member 5 requires the pass to read this as a
deliverable and measure its claims). Nothing below is final.

**Subject:** `build/wo-0402`, based on live `main` at `3efbb5d`.
**Built:** `games/blockpop.js`, `.github/ci/demo-blockpop.mjs` (sections 11, 12, 13 new;
sections 2 and 8 corrected), `.github/ci/demo-blockpop-controls.mjs` (14 new red proofs).
**Fence:** `sw.js`, `manifest.json`, both icons, `games/gyre.js`, `games/hello.js` and
`index.html` all diff to empty. No new asset file. No `urlsToCache` change.

---

## 1. §1 — the drag

Committed alone as `6ab612a`, ahead of everything else, per §8.

**The mechanism, confirmed:** `moveDragEl` lifted the picture by `cellPx * 0.9`;
`hitCell` resolved the drop at the raw finger. The piece was painted ~58px above the hole
it fell into — nearly a whole 64px cell, in the one interaction the game is made of.

**Why no check saw it.** Every drag assertion dispatched a touch at `(x, y)` and then
asserted the cell at `(x, y)` filled. **Both halves read the same number**, so the picture
could have been painted anywhere on the screen and they would still have agreed. §6.1
member 7. **Section 2 was one of those assertions and it is corrected here**: it now reads
the ghost immediately before the drop and asserts the cells that fill are the cells that
were previewed.

**Built as ruled:** one constant, `DRAG_LIFT_CELLS`, consumed by exactly two expressions —
`moveDragEl` and `hitCell` — and the off-grid `pad` tolerance is measured against the
lifted point too.

### 1.1 A lift silently costs REACH, and that was not in the ruling

To put the picture on the **bottom** row the finger must go a lift *below* it, and the
finger cannot leave the glass. Measured at 412px of height with a 64px cell:

| | bottom row touch band | other rows |
|---|---|---|
| uncapped 0.9-cell lift | **15px** | 62px |
| capped (shipped) | **27px** | 62px |

So the lift is now **capped by geometry** — the distance from the last row's centre to the
bottom of the screen — which makes it impossible for any row to be unreachable on any
device whatever the constant is set to. **The residual trade is real and is not ours:**
every pixel of lift is a pixel off the bottom row's band. `0.9` was chosen with no hand on
the glass; it is one constant, so "still under my palm" and "can't reach the bottom row"
are both one-line answers. **Scotty's, on the device.**

### 1.2 The acceptance measures in a third frame

Section 11 reads the **painted rect of `.bp-drag` while the finger is still down**, then
drops, then reads the rect of the cell that actually filled, and asserts the painted piece
sits **inside** the cell it fills. Neither side is a coordinate the check chose.

**The lift is derived from the picture, never written down in the test** —
`lift = fingerY − paintedCentreY`. Writing `cellPx * 0.9` there would have recreated the
exact defect being fixed, one copy of it inside the test.

*(Containment, not centre-to-centre: the picture floats continuously with the finger while
a cell is discrete, so their centres differ by the finger's sub-cell offset — up to half a
cell on a **correct** build. My first version asserted centre distance and failed a correct
build at 23.6px.)*

## 2. §2 — the voice

Every cue is one of `doSound`'s twelve banks, and **the check records the name asked for**
rather than the sound heard, because an unknown name is a silent no-op that nothing
reports — which is how `api.sound('pop')` shipped for one commit in `PUP-WO-0400`.

| event | cue | why |
|---|---|---|
| a piece leaves the tray | `keyTap` | 1800Hz for 30ms — barely there |
| it lands | `tap` | |
| it cannot go there | `lock` | **two soft descending sines** |
| a line goes | `twinkle` + `api.vibrate(18)` | the reward, and the only buzz |
| the tray refills | `blip` | |

**The refusal is deliberately the quietest thing in the game.** `error` and `alert` are
square waves; a buzz for "I changed my mind" teaches a three-year-old that the controls
bite. The check asserts the refusal is never one of those **and** that it is not silent.

No `AudioContext` is constructed by the module — asserted by attributing every
construction to its stack, so the shell's one does not mask the module's.

## 3. §3 — the flair, and it is the console's own geometry

| | what it is | cost |
|---|---|---|
| **radar ground** | `repeating-radial-gradient` rings + a crosshair on `.bp-root`, behind the board | no elements, painted once |
| **the paw stamp** | `pawSVG(100, colour)` as a `data:` URI on a cleared cell as it vanishes, in the candy's own colour | one span per well, only ever over a cell on its way out |
| **the sweep** | one arm, **one turn, 620ms, on a line clear only** | one element, only on the reward |

`pawSVG` is **called, never edited** (§7), and reached as a `data:` URI so there is no
`innerHTML`, no image file, no `urlsToCache` line — **invariant 3 untouched**, confirmed
by check 11.

**The console's own sweep is `5s linear infinite`** and an infinite rotation under a drag
is exactly what stutters an S10+. This is one turn on the reward, and under
`prefersReducedMotion` **it is never created at all** — asserted in a real reduced-motion
browser context, with the assertion refusing to pass if the context did not take.

**Contrast is asserted after, not before:** the ground sits *behind* the wells, which stay
fully opaque; the check fails if an empty cell's alpha drops below 1, and a planted
translucent well goes red.

## 4. What did not work

- **A race in the harness that reports on races.** The red proofs run in lanes, and each
  scenario found its own record by reading `results.length` — a shared counter two lanes
  can read the same value of. One scenario's row appeared **five times** and four others
  vanished. Scenarios now return their record instead of indexing a shared array.
- **A vacuous pass I shipped for one run.** §12's refusal test tapped an empty cell just
  after a clear, so the piece **placed** — and the recording came back `["keyTap","tap"]`,
  `tap` being the *drop* cue. It asserted "no harsh cue" against a move that succeeded. It
  now occupies the cell first and requires a refusal cue to have fired at all. **Third time
  this file has needed a liveness precondition added to an assertion about absence.**
- **Section 11's first version failed a correct build** by comparing centres (see §1.2),
  and its lift probe **placed a piece on the cell the next phase aimed at**.

## 5. Gates

| P4 exit gate | state |
|---|---|
| 1 — both sizes playable | **unchanged.** Easy only; classic is 0401's. |
| 2 — no-moves state, one control | **unchanged.** Still unreachable in easy by design. |
| 3 — `players: 2` | not attempted; out of scope. |
| **4 — with all text covered, board and tray operable** | **premise still asserted** (§1: no painted word inside `host`), and the flair adds none. |
| 5 — airplane mode, cold start | not proven here; no network construct (check 11). |
| §5 — every new check red with a real defect | **met: 39 of 39**, and no plant changes whether the file parses. |

## 6. Not built

- The score's presentation — still Scotty's.
- The 8×8 entry and the four assists — `PUP-WO-0401`, blocked on `0111`.
- Any change to `pawSVG` or the radar markup.
- Haptics beyond the single clear buzz.
