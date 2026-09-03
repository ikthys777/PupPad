# PUP-WO-0403 — The dropped piece stays on screen, and `PUP-WO-0402` caused it

**Repo:** ikthys777/PupPad · **Base:** `main` (currently `c9fd392`; **verify live HEAD**).
**Branch:** `build/wo-0403`. **Author:** CC-A · **Builder:** `builder-61`.
**Phase:** P4 · **Subject SHA:** citations resolved at **`c9fd392`**, paired with symbols.

**Grounds:** northstar invariant 1 · architecture §6.1 · `docs/feedback/PUP-WO-0402.md` ·
**Scotty, on the S10+, with three screenshots.**

> **What this is:** a live child-facing regression, small and urgent. **It is a
> REGRESSION FROM A FIX** — `PUP-WO-0402` made the invisible dragged piece visible, and
> the same declaration that did so made it **permanently** visible. Nothing else.

**Cadence:** build. One PR, left unmerged. **Scotty is testing on the device and can
verify the fix the way he found the defect.**

---

## 1. THE MECHANISM — CONFIRMED AT SOURCE, NOT DIAGNOSED FROM THE SYMPTOM

The co-architect's reading of the *logic* is correct and I confirmed it: `onUp` sets
`dragEl.hidden = true` early (`games/blockpop.js:1238`), an invalid drop falls through to
the refuse cue, and `renderGhost()` / `renderTray(false)` restore state. **There is no
state bug in that path.** The piece stays on screen because **it is not being hidden.**

**`hidden` is a UA-stylesheet rule — `[hidden] { display: none }` — and ANY author
`display` declaration beats it.**

| | |
|---|---|
| `games/blockpop.js:557` | `.bp-drag{position:absolute;left:0;top:0;` **`display:grid;`** `pointer-events:none;z-index:5;…}` |
| `games/blockpop.js:1238` | `dragEl.hidden = true;` |

**`display:grid` defeats `hidden`. The element never disappears.**

**`PUP-WO-0402` INTRODUCED IT.** `git log -S 'display:grid;pointer-events:none;z-index:5'`
returns exactly one commit: **`e4af937`**. Before it, `.bp-drag` carried no `display`, so
`hidden` worked. **The fix for "the dragged piece has been invisible since Block Pop
shipped" is what made it stay visible** — the same property, the opposite failure, one
work order apart.

**AND THIS FILE ALREADY CONTAINS THE REMEDY. TWICE.**

```
:487   '.bp-candy[hidden]{display:none}',
:501   '.bp-stamp[hidden]{display:none}',
```

Both exist because those elements carry an author `display` too. **There is no
`.bp-drag[hidden]` rule — zero matches.** *The author knew the pattern, applied it to two
elements, and then gave a `display` to a third without going back for it.* **The
transferable rule: when you give an element a `display`, check whether the file already
compensates for that property elsewhere — because if it does, you have just created the
case it compensates for.**

**The second symptom is almost certainly the same defect and must be verified, not
assumed.** Scotty saw the tray showing a four-cell L in one slot while the slot below
showed a domino. **A stuck `position:absolute` ghost released over the tray overlaps a
slot** — so the "tray render disagrees with the piece geometry" reading is what an
overlapping orphan looks like. **Confirm that before treating it as a second bug.** If a
tray render defect survives the §2 fix, it is separate and gets flagged, not folded.

## 2. Scope

1. **Add `.bp-drag[hidden]{display:none}`** to the module's stylesheet, beside the two
   that are already there. **Do not remove `display:grid`** — it is what makes the piece
   visible, which is the whole of `PUP-WO-0402` §1.
2. **`onUp`'s pointer-id guard returns with no cleanup** (`:1235`):
   `if (drag.pointerId !== undefined && ev.pointerId !== undefined && ev.pointerId !== drag.pointerId) return;`
   **A `pointerup` from a second finger returns before `dragEl.hidden`, before
   `releaseCaptures`, and before `drag` is cleared** — leaving a live drag with a
   painted ghost. **A three-year-old plays with both hands**, which is how `#gameBack`
   died. **This is a real second path to the same symptom: fix it, and prove it
   separately from §2.1.** It is not the cause of what Scotty saw — §2.1 is — but it
   reaches the same state.

## 3. Acceptance — and the reason 50 red proofs missed this

**Nothing asserts the drag element is GONE AFTER RELEASE.** §11 measures the ghost
*during* the drag — it was written to prove the piece is visible and it does that
faithfully. **The opposite property was never stated.** A check that proves a thing
appears is not a check that it disappears, and this defect lived in the gap between them.

**Assert, at all three fleet viewports, that after release the drag element is not
rendered — for EVERY release kind:**

1. a **valid** drop on a legal cell,
2. an **invalid** drop on an occupied or illegal cell,
3. a release **off the board entirely** *(Scotty's screenshot shows the piece overlapping
   the top-left corner of the playfield, outside it)*,
4. a release **over the tray**,
5. a **tap** that never moved,
6. a release from **a second finger's `pointerup`** (§2.2).

**Measure it the way `PUP-WO-0402` learned to:** a rect comes from style, not from ink.
**Assert the element is not painted** — zero-area, `display:none`, or absent — **not that
an attribute was set.** `dragEl.hidden === true` is the assertion that would have passed
throughout this defect.

**Every one shown RED with a plant that is a real defect and parses.** The plant for §2.1
is trivial and exact: **delete the new rule.**

## 4. Fence · 5. Pass · 6. Feedback

**Only `games/blockpop.js` and `.github/ci/demo-blockpop*.mjs`.** `sw.js`, `index.html`,
`manifest.json`, the icons, `games/gyre.js` and `games/hello.js` **diff to empty** — and
`index.html` especially, because `PUP-WO-0111` is in flight on it.

**No security lens** — this touches no byte the device did not create (architecture §5).
Right-sized pass. Probe: two fingers; a release exactly on the board edge; a release
during the clear window; teardown mid-drag with a ghost painted.

`FEEDBACK.md` parked with the work. Order: build → freeze → pass → disposition →
feedback → PR. **Flag-and-stop:** any change to `index.html`; removing `display:grid`;
a check you cannot show going red.

**Record it as what it is: a regression introduced by `PUP-WO-0402`**, in
`docs/feedback/PUP-WO-0402.md` as well as this work order's own. **A fix that trades one
failure for its mirror is worth more in the record than a bug that was always there.**
