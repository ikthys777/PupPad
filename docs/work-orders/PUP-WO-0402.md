# PUP-WO-0402 — Block Pop: the drag that lies, the sounds, and the flair

**Repo:** ikthys777/PupPad · **Base:** `main` (currently `0c13030`; **verify live HEAD**).
**Branch:** `build/wo-0402`.
**Author:** CC-A · **Builder:** `builder-61`.
**Phase:** P4 · **Phase exit gate:** roadmap §P4 items 1 and 4.
**Subject SHA:** every `index.html:NNNN` and `games/blockpop.js:NNNN` below was resolved
at **`0c13030`** and is paired with the symbol it sits in. **The symbol is the anchor.**

**Grounds:** northstar invariants 1, 3, 5 · `PUP-WO-0000.md` §8.3 (`api.sound`,
`api.vibrate`, `api.prefersReducedMotion`, **and the AudioContext it withholds**), §8.6 ·
architecture §3 (the fleet) · **Scotty's device feedback, 2026-09-02, playing the root
build on the fleet.**

> **What this is:** the first work order in this project written from a **human playing
> the thing on the real device.** It fixes a live defect no check caught, gives the game
> its voice, and gives it a look that belongs to PupPad rather than to Grok. It is
> **NOT** the 8×8 entry and **NOT** the four assists — those are `PUP-WO-0401`.

**Cadence:** build. One PR, left unmerged for review.

---

## 1. THE DRAG LIES ABOUT WHERE THE PIECE WILL LAND — fix this first

**Scotty:** *"the piece should be visible under your finger when you drag so it's
visually coherent."*

**This is a real defect and I have confirmed the mechanism at source.** The two halves of
the drag disagree:

| | expression | result |
|---|---|---|
| what he **sees** | `moveDragEl` — `oy = … − cellPx * 0.9` (`games/blockpop.js:876`) | ghost drawn **~58px ABOVE the finger** |
| where it **lands** | `hitCell(ev.clientX, ev.clientY, drag)` (`:934`) — **raw `clientY`** | cell resolved **AT the finger** |

**So the piece is painted 58px above where it will drop.** A child aims the picture at
the hole, and the block goes into the hole below it. **Every check passed** because a
check knows the coordinate it dispatched and never asks whether the pixels agree with it
— **§6.1 member 7, in the interaction the whole game is made of.**

**THE RULE, AND IT WAS WRITTEN DOWN BEFORE THE BUILD:** the reconnaissance said *"lift
the ghost **and** lift the hit point by the same amount — lifting only the ghost desyncs
what he sees from where it lands, which is a worse bug than the one being fixed. **Both,
or neither.**"* The build took one half.

**RULED: LIFT BOTH.** `hitCell` receives the same lifted `y` the ghost is drawn at, from
**one named constant used by both call sites** — never two expressions that must agree.

- **Not "neither".** Removing the lift puts the piece under a three-year-old's palm,
  which is the problem the lift was added for. **Visible AND coherent is the requirement;
  only "lift both" satisfies both halves.**
- **The `pad = 10` off-grid tolerance (`:864`) must be measured against the lifted point
  too**, or the tolerance drifts by the lift.
- **Then confirm the amount on the device.** `cellPx * 0.9` was chosen without a hand on
  the glass. Whether ~58px clears Buddy's palm is his to answer, not ours — **build it as
  one constant so the answer is a one-line change.**

**Acceptance:** at all three fleet viewports, for a drag ending at an arbitrary point,
**the cell the ghost visually covers is the cell that fills.** Assert the ghost's painted
rect against the filled cell's rect — **not the dispatched coordinate against itself**,
which is the shape that missed this.

---

## 1a. THE TRAY PIECE IS SMALLER THAN THE CELL IT AIMS AT

**Scotty, with a screenshot:** *"the tray size for pieces needs a little adjustment."*
**Measured off that screenshot** (S25 Ultra, 2340x1080 physical, DPR 2.625, so an
**891 x 411 CSS** viewport):

| | measured |
|---|---|
| tray slot | **357 x 123 CSS px** |
| piece cell drawn inside it | **~36 CSS px** |
| board cell it will land on | **64 CSS px** |

**THE THING HE GRABS IS SMALLER THAN THE THING HE AIMS AT**, inside a slot with room for
three times the drawing. The biggest, emptiest panel on the screen holds the smallest
graphic.

**This was predicted and it did not reach the work order.** The layout pass flagged it
verbatim: *"`PieceTray.tsx:53-54` is `Math.floor(88 / span)` — a hardcoded 88px that
assumes the source's 128px slot. In a wider slot the piece paints at a fraction of it and
the biggest target in the app looks empty. It must become a function of the measured
slot, read from a `ResizeObserver`, never per-render."* **It went into the reconnaissance
and never into `PUP-WO-0400`** — the same failure as the retention ruling: a finding that
reached a document and not the directive.

**RULED: the tray cell is derived from the MEASURED SLOT, never from a constant.**
`cell = floor(min((slotW - 2*inset) / piece.w, (slotH - 2*inset) / piece.h))`, measured
by the same `ResizeObserver` the board already uses, **capped so a 1x1 does not become
absurd** — and **never smaller than the board cell**, because a target you drag *from*
must not be smaller than the target you drag *to*.

**Acceptance:** at all three fleet viewports, for every shape in the pool, the drawn
piece's bounding box occupies **at least half** the slot's shorter axis, and **no piece
cell is smaller than the board cell.**

---

## 2. SOUND — the first thing a human noticed was its absence

**Scotty:** *"there is no pop or animation sounds when the line fill and 'pop'."*

`PUP-WO-0400` §4 fenced audio out deliberately, and the fence was correct for that work
order. **It is the first thing a human said about the result, which is worth recording:
the juice is not decoration to the player, it is the feedback that tells him what he
did.**

- **`api.sound(name)` ONLY.** §8.3: the shell holds exactly one `AudioContext`, lazily
  created and never closed, and **does not hand it out**. `audio.ts` builds its own and
  never calls `close()` — **it does not come across.** The module constructs no
  `AudioContext`; assert that by instrumenting the constructor.
- **Twelve bank names exist.** Unknown names are a silent no-op and nothing throws.
  Choose from the bank; **do not invent a name and assume it lands.**
- **Cues:** the piece leaving the tray, a legal drop, an illegal drop (**quiet — §6's
  note that a buzz for "I changed my mind" teaches a child the controls bite**), the line
  clear, and the tray refill.
- **A cue must not outlive the game.** §8.6 rules a cue stops in under a second, and
  §8.1 lists media among what `teardown` releases. **Assert it after teardown.**
- **`api.vibrate` on the clear**, and nothing else. It is the one event worth a buzz.

---

## 3. FLAIR — and it is PupPad's own vocabulary, not new art

**Scotty:** *"borrow the paw symbol we use and already designed for the main face of
PupPad… add some textures or use the radar effect we designed in some kind of creative
way."*

**Both already exist as GEOMETRY, which is why this costs nothing.** No image file, no
`urlsToCache` line, no `check-assets` exposure, and **invariant 3 is untouched** — the
game stays as it is today, with every visual synthesized.

| asset | where | what it is |
|---|---|---|
| **the paw** | `pawSVG(size, color)`, `index.html:41` | five ellipses, `viewBox 0 0 100 100`, **takes its size and colour as arguments** — so it scales to a cell and takes the piece's palette |
| **the radar** | `index.html:3120-3132` | four concentric rings at `rgba(0,255,136,0.12)`, crosshair lines, and a sweep arm with `box-shadow` glow over blurred trailing lines |
| **the sweep** | `@keyframes sweep`, `index.html:18` | `rotate(0deg) → rotate(360deg)`, driven at `5s linear infinite` |

**Suggestions, not instructions — the builder's judgment is wanted here.** A paw stamped
into a cleared cell as it vanishes; the radar's rings under the board as a ground texture
rather than a foreground effect; the sweep arm crossing the board once on a line clear.
**What matters is that it reads as PupPad and that a non-reader can still tell a filled
cell from an empty one.**

**Three hard limits:**
1. **Invariant 1 is not decoration's to spend.** If flair reduces the contrast between
   filled and empty, or between a legal and illegal ghost, **it is wrong.** Assert
   contrast after, not before.
2. **`api.prefersReducedMotion` is sampled at mount and must be honoured** — the sweep,
   the stamp and any looping animation are off when it is set.
3. **The S10+ is the slowest device and the one that matters.** A sweep that stutters the
   drag is worse than no sweep. **Measure on the budget, do not assume.**

---

## 4. Scope fence — NOT in this work order

- **The 8×8 `blocks-big` entry and the four assists** — `PUP-WO-0401`, and that WO is
  **blocked on `PUP-WO-0111`** because a panel that mounts before the `controlsOpen` flip
  covers 321px of a 412px screen.
- **The score.** **RULED 2026-09-02: NO SCORE IS SHOWN ANYWHERE.** *(Scotty, asked
  directly: "no, there is no score shown at all. anywhere.")* The engine accrues one and
  nothing renders it — which is what the build already does, so this ruling **closes an
  open question rather than changing code.** It is also the northstar §5 non-goal
  honoured rather than argued with: *"Scores, leaderboards, streaks, or progression.
  Every one of them imports a fail state."* **Adding a visible score later is a change to
  a non-goal and goes to the northstar first, never into a feature work order.**
- **`sw.js`, `manifest.json`, the icons, `games/gyre.js`, `games/hello.js`,
  `index.html`'s registry** — diff to empty. **No new asset file of any kind:** if flair
  needs an image, that is a flag-and-stop, not a quiet `urlsToCache` line.
- **Changes to `pawSVG` itself.** Call it; do not edit it. It is the console's.

## 5. Adversarial pass

Right-sized: verify it works and the code is right. **Every new check shown going red
against a deliberately broken build — and the plant must be a DEFECT, not a syntax
error**, which is how a plant scored green in `PUP-WO-0400`.

Probe: teardown mid-drag with a cue playing; reduced-motion set; the sweep running while
a drag is in flight on the S10+ budget; a clear whose sound fires as the panel is torn
down; and **the drag lift at the extremes of the board — top row and bottom row**, where
a lifted hit point can leave the grid.

## 6. Upward feedback

`FEEDBACK.md`, parked with the work. Include **what did not work and why**, a gates line,
and **what was deliberately not built.** Order: build → freeze → pass → disposition →
feedback → PR.

## 7. Flag-and-stop

- Any `AudioContext` constructed in the module.
- Any new asset file, or any `urlsToCache` change.
- Any edit to `pawSVG` or to the radar markup in `index.html`.
- Flair that reduces filled-vs-empty or legal-vs-illegal contrast.
- **A check you cannot show going red with a real defect.**

## 8. Kickoff

Fetch, branch from live `main`, read this file and `PUP-WO-0000.md` §8.3 and §8.6.
**§1 first and alone — it is a live defect in the interaction the game is made of, and it
should be a small early commit rather than the tail of a big one.** Then §2, then §3.
Build → freeze → pass → disposition → `FEEDBACK.md` → one PR, left unmerged, notify CC-A.
