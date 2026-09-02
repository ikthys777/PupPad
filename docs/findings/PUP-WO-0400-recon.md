# PUP-WO-0400 — Block Pop port reconnaissance

**Produced 2026-09-02 by CC-A** via a 13-agent workflow: six independent subsystem
reads, each adversarially challenged by a second agent sent back to the source to
**refute** it, then synthesized. 0 agents failed. Full per-agent record:
`journal.jsonl` under this session's workflow transcript directory.

> **This file exists because the estimate is the finding.** It is reconnaissance for
> a work order that has not been written. Nothing here is ratified; §4 lists what CC-A
> must rule on before `PUP-WO-0400` can be dispatched.

## 1. The number, and it is the reason the pass was run

| | lines |
|---|---|
| Naive estimate, six readers | **3,485** |
| After adversarial challenge | **4,855** |
| Estimates judged **too low** | **6 of 6** |

**Every single reader underestimated, by ~40% in aggregate.** That is the pattern the
challenge stage existed to find: a reader sees the happy path and not the wiring.
**Do not scope `PUP-WO-0400` off a skim.**

For comparison, Gyre moved ~900 relevant lines out of 3,880 and took one work order
plus a controls work order. Block Pop is 6,420 lines total.

## 2. Blocking obstacles

### 2.1 PupPad IS LANDSCAPE-LOCKED AND BLOCK POP'S PLAY SCREEN IS A PORTRAIT COLUMN

**The most important finding, and eleven of twelve agents missed it.** One found it —
and *the reader who cited `#portraitBlock` drew the opposite conclusion from the same
evidence.*

Verified in the target: `manifest.json` carries `"orientation": "landscape"`,
`index.html` calls `screen.orientation.lock('landscape')`, and `#portraitBlock` covers
the viewport at `z-index: 9999` in portrait.

Block Pop's root is a `min-h-dvh flex-col` stack — header, stat row, board capped at
`max-w-[min(100%,72dvh)]`, a 112–128px tray, then a 56px four-tool grid. **On a
landscape tablet the board alone eats 72dvh and the tray and tool row fall off the
bottom — and `host` carries `overflow:hidden`, so they are SILENTLY CLIPPED rather
than scrolled.**

**This is a layout redesign — board beside tray and tools, not above them — not a
breakpoint collapse.** It is the single largest unpriced item in the port.

### 2.2 The zustand singleton, confirmed, and worse than the architecture recorded

`store.ts` is a `create()` evaluated **at module scope**, and **ES module instances are
cached per URL** — so a second `mount()` of `games/blockpop.js` in the same document
gets the **same store**. Two live instances would share one board, one 20-entry
history and one save key; `hydrate` returns early on `get().hydrated`, so the second
instance never even reads storage.

Nothing calls destroy/setState/subscribe on it — **zustand 5.0.15 has no `destroy()`
at all** — so an unmount leaves `screen:"over"`, the history array and the save blob
alive for the life of the page.

**This is the exact case `PUP-WO-0000` §8.1's returned-closure teardown exists to make
unwriteable, and the architecture already cites this file by name.**

### 2.3 The stylesheet has no home and no precedent

`src/styles.css` is 256 lines imported by exactly one file — `__root.tsx` — **which the
port deletes.** ~195 of those lines *are* the game: the `.candy` gradient and its
`::after` gloss, seven `[data-color]` palette triples, `.well`, `.board-frame`,
`.ghost-valid`/`.ghost-invalid`, `.hint-pulse`, `.candy-pop`, `.candy-clear`,
`.cheer`, five `@keyframes`, and the reduced-motion block.

**Neither `games/gyre.js` nor `games/hello.js` injects a stylesheet or uses
`innerHTML` at all — verified zero.** So this is an unprecedented pattern decision
that must be settled *before a line is written*:

- a `<style>` inside `host` is removed with `host`, **but its rules and its
  `@keyframes` NAMES are document-global regardless of where the sheet sits**;
- a shadow root scopes them but **breaks `hit()`'s `document.elementFromPoint`** unless
  rewritten onto `elementsFromPoint` + `composedPath`;
- inline-only forces ~105 lines of keyframes into WAAPI calls.

**And a `<style>` appended to `document.head` would survive teardown UNREPORTED** —
`endGameSession`'s leak sweep only walks `document.body.children`. That is a silent
§8.1 violation, so the sheet must go inside `host`.

### 2.4 The board diff does not exist, because React was doing it — and BOTH naive answers ship a visible defect

`Board.tsx` re-emits all n² cells on every render (and `setDrag()` fires on every
`pointermove`, so that is **pointer-rate**), while `popping={!!color && !dying}` is
**permanently true for every filled cell** — it only looks right because React's keyed
reconciler preserves the node, so the 320ms `candyPop` runs once at creation.

- **Rebuild the grid per update** → all 36–64 candies re-pop 60 times a second.
- **Patch a persistent node's background instead** → the pop disappears entirely.

Correct behaviour needs a previous-board snapshot, per-cell transition classification
(`0→n` = pop, `n→dying` = clear, `dying→0` = plain) and an **explicit animation
restart**. **The failure is purely visual, so no CI check and no green suite will catch
it** — architecture §6.1 member 6's territory.

Compounding it: `clearing` is shadow state that **outranks** `board` — for 280ms after
a clear the store's board is already `0` at those cells while `Board.tsx` still paints
them.

## 3. What the game actually is

A Block-Blast-style polyomino placement puzzle. An n×n grid of empty wells above a
tray of three shapes (41 entries in `pieces.ts` SHAPES, seven palette colours). The
child places a shape by **drag** (floating ghost follows the finger; cells glow green
if legal, red if not) **or tap-to-select then tap a cell**. A legal drop fills cells,
then every completely-filled row and column vanishes at once, a canvas particle burst
fires, a cheer word and a pitched arpeggio play, and the device buzzes. Score accrues
with a combo multiplier. When all three slots are consumed a new tray is dealt, biased
toward shapes that currently fit. Four assists: **Undo** (20-deep), **Hint**,
**Help** (vaporises cells), **Mix** (rerolls the tray). The run ends when no piece
fits anywhere.

**No timer, no enemy, no failure other than running out of room** — which is a good
fit for a three-year-old. **Two board sizes: easy 6×6 ("Little Hands") and classic
8×8**, which is the `api.entry.params` case `PUP-WO-0000` §8.3 was designed around:
two registry entries, one module.

**Every visual is synthesized — CSS gradients, box-shadows and canvas arcs.**

*Stated precisely, because the synthesis said "not one image or sound file in the whole
game" and CC-A's check found ten files. The claim's SUBSTANCE holds and its WORDING did
not:* the repo contains **10 image files — `favicon.svg`, `og.jpg`, `x-banner.jpg`, and
seven under `public/__grok/` (Grok's PWA install-flow chrome)** — and **zero are
referenced by any file under `src/components/game/` or `src/lib/game/`.** Checked
per-file, not inferred. **No sound files at all.**

**So `check-assets`' blindness to module-referenced assets (roadmap §4a, marked
P3-blocking) does not bite here** — but it is a property of *this* game, not a
property the port may assume, and none of those ten come across.

## 4. Decisions CC-A must rule on before dispatch

1. **The landscape redesign (§2.1)** — board beside tray and tools. This is a design
   decision about how the game looks, not an implementation choice, and it is the
   largest single item.
2. **How the stylesheet is created, scoped and removed (§2.3)** — an unprecedented
   pattern that every future game will copy.
3. **One work order or two.** Gyre split engine-then-controls. Block Pop's equivalent
   seam is less obvious because the board *is* the interface.
4. **Whether `Piece.id` survives** — its only reader is React's reconciler key.

## 5. Provenance and the method's own result

Six readers were each challenged by an agent told to **refute**, sent back to the
source, and instructed to default to suspecting the estimate was too low. **All six
estimates were judged too low.** The single most valuable finding — the landscape
lock — came from **one agent out of twelve**, and another agent cited the same
evidence (`#portraitBlock`) to reach the opposite conclusion. **That disagreement was
surfaced rather than averaged**, which is why it survived to this file.
