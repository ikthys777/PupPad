# PUP-WO-0403 — the dropped piece stays on screen — builder feedback

**Subject:** `build/wo-0403`, based on live `main` at `0dd599a`.
**Built:** `games/blockpop.js` (two lines of behaviour), `.github/ci/demo-blockpop.mjs`
(§15, new), `.github/ci/demo-blockpop-controls.mjs` (two red proofs, 54 total).
**Fence:** `index.html` diffs to empty — `PUP-WO-0111` is in flight on it.

---

## 1. The defect, and it is mine

`hidden` is a **UA-stylesheet** rule — `[hidden]{display:none}` — and **any author
`display` declaration beats it.** `PUP-WO-0402` gave `.bp-drag` a `display:grid`, so
`dragEl.hidden = true` stopped hiding anything and **the piece stayed painted on the board
after the child let go.** Scotty found it on the device.

**The `display:grid` was the fix for the exact opposite defect one work order earlier** —
the dragged piece rendering at 0×0 because its grid template was inert. Same property,
mirrored failure, one WO apart. `git log -S` returns exactly one commit for it: `e4af937`.

**And this file already carried the remedy, twice:**

```
:487   '.bp-candy[hidden]{display:none}',
:501   '.bp-stamp[hidden]{display:none}',
```

Both exist because those elements also carry an author `display`. **I applied the pattern
to two elements and did not go back for the third when I gave a `display` to it.**

> **When you give an element a `display`, check whether the file already compensates for
> that property elsewhere — because if it does, you have just created the case it
> compensates for.**

The fix is the third rule beside the other two, not the removal of `display:grid` — which
would restore the invisible piece.

## 2. Why fifty-two red proofs missed it

**Nothing asserted the drag element is GONE after release.** §11 measures the piece
*during* the drag and proves it is visible; it was written for that and does it faithfully.
**The opposite property was never stated**, and the defect lived in the gap between them.
**A check that proves a thing appears is not a check that it disappears.**

§15 states it, across all six ways of letting go: a legal drop, a drop onto an occupied
cell, released off the board entirely (Scotty's screenshot), released over the tray, a tap
that never moved, and a second finger's release while the first still drags.

**AND IT MEASURES PAINT, NOT THE ATTRIBUTE.** `dragEl.hidden === true` is *precisely* the
assertion that would have passed throughout this defect: the attribute was set and the
element rendered anyway. §15 reads computed `display`, `visibility`, `opacity`, the rect,
and the count of drawn piece cells. **A rect comes from style, not from ink — and so does
an attribute.** The second red proof plants `[hidden]{display:grid}` to prove the assertion
cannot be satisfied by setting the attribute alone.

## 3. The second path to the same state

`onUp`'s pointer-id guard returned with **no cleanup at all** — before the hide, before
`releaseCaptures`, before `drag` was cleared. A three-year-old plays with both hands, which
is how `#gameBack` died. The drag itself must survive a stray finger's `pointerup` (the
owning finger is still down, so ending it would be the bug), but the **departing** pointer's
capture was held until teardown. It is now released and nothing else is touched.

## 4. The second symptom, verified rather than assumed

Scotty also saw a tray slot showing a four-cell L while the slot below showed a domino.
**A stuck `position:absolute` ghost released over the tray overlaps a slot**, which is what
an orphan looks like. §15 asserts directly that no tray slot has any part of the drag proxy
over it, so the two symptoms are one defect. **No separate tray-render bug survives the
fix**; had one, it would have been flagged rather than folded.

## 5. Gates

| | |
|---|---|
| the piece is gone after every release kind | **met** — §15, six kinds, measured as paint |
| no tray slot overlapped by the proxy | **met** — §15 |
| every new check red with a real defect that parses | **met — 54 of 54** |
| `index.html` untouched | **met** — diffs to empty |
