# PUP-WO-0400 — Block Pop, playable: easy 6×6 end to end

**Repo:** ikthys777/PupPad · **Base:** `main` (currently `317d792`; **verify live HEAD**).
**Branch:** `build/wo-0400`.
**Author:** CC-A · **Builder:** `builder-61`.
**Phase:** P4 · **Phase exit gate:** roadmap §P4, items 1 (for one size), 2, 4, 5.
**Subject SHA:** every `index.html:NNNN` in this document was resolved at **`317d792`**
and is paired with the symbol it sits in. `index.html` moved ~290 lines during the last
three work orders; **the symbol is the anchor, the number is a hint.**

**Grounds:** northstar invariants 1, 3, 5, 6 · `docs/findings/PUP-WO-0000.md` §8.1, §8.2,
§8.3, §8.5, **§8.8** · `docs/architecture.md` §3 (the fleet), §6.1 members 6 and 7, §7
seams 1–3 · `docs/roadmap.md` §P4 · `docs/findings/PUP-WO-0400-recon.md` **as corrected
by §0 below** · source at `/home/ikthys777/PupPad-sources/blockpop`.

> **What this is:** the first of three work orders that port Block Pop. It delivers **one
> playable game** — easy 6×6, drag and tap, line clear, score, and a terminal state a
> child can leave in one tap — laid out for a **phone in landscape**. It is **NOT** the
> 8×8 entry, **NOT** the four assists, and **NOT** the particles, audio or cheer. It ends
> with a tile a three-year-old can press and a game he can play, or it has not landed.

**Cadence:** build. One PR, left unmerged for review.

---

## 0. READ THIS FIRST — the reconnaissance is wrong in four places

`docs/findings/PUP-WO-0400-recon.md` was produced against **assumed tablet viewports**.
Architecture §3 now records the fleet: **three phones, no tablet, ~412px of height.**

1. **§2.1's "the 72dvh cap never binds, tuning it is a no-op" is FALSE on the fleet.**
   At 412 the cap is 296.6px and `max-w-[560px]`'s 536px loses to it. Right mechanism,
   wrong winner.
2. **"The tray and tools fall off the bottom" understates it.** Header 61.6 + stats 52.5
   + board 296.6 + tray/tools 220.8 = **631.5px against 412 — 153% over, after the cap
   binds.** This is not a tail to trim. The stacked column cannot exist here.
3. **§2.3 over-prices the stylesheet.** `@keyframes` total **55 lines, not ~105**. A
   shadow root would cost **one** `document.elementFromPoint` rewrite
   (`BlockPopGame.tsx:570`), and `composedPath` is **not needed** — the drag reads
   `clientX/clientY` off window listeners and never inspects `event.target`. **The real
   uncounted cost is 132 distinct Tailwind utility tokens with no definition in PupPad.**
4. **§2.2 frames the store hazard as two simultaneous instances**, which §8.2 obligation
   6 forbids the shell from ever producing. **The reachable failure is SEQUENTIAL
   REMOUNT**, and it is worse: `blocks` and `blocks-big` are two registry entries against
   **one module URL**, so retained state from the first survives into the second and
   silently overrides its `params`.

**Two source defects the recon found that you are inheriting and must not reproduce:**

- **`clearing` is not bounded at 280ms.** `BlockPopGame.tsx:135`'s cleanup cancels the
  timeout and the `cells.length === 0` branch never nulls the state, so a placement or
  undo inside the window **strands it indefinitely** — and `.candy-clear` is `forwards`
  to `opacity:0`, so those cells render **permanently invisible over a board that still
  holds candies.** A state the toy can enter and cannot leave.
- **`popping={!!color && !dying}` is permanently true for every filled cell.** It only
  looks right because React's keyed reconciler preserves the node. **Rebuild the grid per
  update and all 36 candies re-pop at pointer rate; patch a persistent node's background
  and the pop disappears entirely.** Both naive answers ship a visible defect, and
  **neither is visible to any CI check that does not measure animation start times.**

---

## 1. Scope

### 1.1 The layout — landscape phone, three columns, height-driven

**The rule, and it is stated as a rule rather than a number because
`PUP-WO-0111` is what happens when a layout is a number that happened to fit:**

> **The board's side is the available HEIGHT. The tray takes the width that is left.
> The left 84px is the exit's column and nothing of the game's goes in it.**

That holds at every landscape phone size without a breakpoint, because height is the
binding constraint on all three devices and will be on any phone.

```
 x=0    84                                 480                        869
  +------+-----------------------------------+--------------------------+
  | EXIT |                                   |    ┌──────────────┐      |
  | RAIL |          BOARD 396 × 396          |    │  tray slot 1 │      |
  |      |          (= viewport height       |    ├──────────────┤      |
  | (the |           minus 2×8 padding)      |    │  tray slot 2 │      |
  | shell|                                   |    ├──────────────┤      |
  | owns |                                   |    │  tray slot 3 │      |
  | this)|                                   |    └──────────────┘      |
  +------+-----------------------------------+--------------------------+
                                                   369px wide, 124 tall
```

| | S10+ 869×412 | S20U 915×412 | S25U 883×412 |
|---|---|---|---|
| board | **396 × 396** | 396 × 396 | 396 × 396 |
| tray column | 369px | 415px | 383px |
| slot | 369 × 124 | 415 × 124 | 383 × 124 |
| **easy 6×6 cell** | **64.0px** | 64.0px | 64.0px |
| classic 8×8 cell *(0401)* | 48.0px | 48.0px | 48.0px |

*(**Corrected 2026-09-02 from 66.0 / 49.5.** I divided the board's outer side by N.
The frame carries **6px of padding a side**, so it is `(side − 12) / N` — 384/6 and
384/8. Found by CC-B's pass, which also found the wrong pair pasted into both the
feedback doc and a module comment. **Both still clear the 44px minimum**, and classic's
margin is now 4px rather than 5.5.)*

**Read the cell sizes as an argument for easy being Buddy's entry.** The source ships
82.7px (easy) and 60.9px (classic); this ships **64.0** and **48.0**. Easy is
comfortable. **Classic at 49.5 clears the 44px minimum touch target and not by much**,
which is a fact for `PUP-WO-0401` to design against, not to discover.

**Mandatory:**
- **The board is driven off a measured rect, never off a viewport unit.** One
  `ResizeObserver` on `host`, one place that computes the side, and `cellPx` derived from
  it — the source's `boardCellSize` (`BlockPopGame.tsx:591`) is `rect.width / n` and stays
  the single source of truth for the drag ghost's size and grab offset.
- **The left inset is `max(84px, calc(env(safe-area-inset-left) + 74px))`**, copied from
  the panel's own gutter, **not the bare 84**. Landscape phones put punch-holes and curved
  edges into the *side* insets; a tablet does not, and this is the difference.
- **Delete the header and the stat row.** Gate 4 covers all text; a 61.6px header and a
  52.5px stat row of numbers a non-reader cannot read are 114px of a 412px screen. The
  score lives in `0402` if it lives anywhere — see §4.

### 1.2 The stylesheet — a `<style>` inside `host`, and say why it is safe

**A `<style>` element created in `mount` and appended inside `host`.** It dies with
`host`, which is the lifetime property §8.1 requires.

**State the safety argument correctly, because the obvious phrasing is wrong.** A
connected `<style>` applies to the **whole document** wherever it sits — putting it in
`host` scopes its **lifetime**, not its **selectors**. It is safe because **every rule is
class-scoped and none of the names collide with PupPad's own**, verified across
`styles.css:62-256`. **Never write "safe because it is inside `host`"** or the next game
puts a `button {}` rule in there.

- **`document.head` is off the table.** `endGameSession`'s leak sweep walks only
  `document.body.children` — **`endGameSession` at `index.html:2700`, its sweep at
  `:2743-2744`, and its baseline snapshot at `:2842`, all resolved at `317d792`** — so a
  head `<style>` **survives teardown unreported**, a silent §8.1 violation.

  *(The first draft of this line cited `:2449`, inherited from a verification pass run
  against `eaa08db`. It now lands on a comment about polarity. **Caught by auditing this
  document's own citations before committing it, which is the only reason the header's
  subject-SHA claim is true rather than decorative** — and it is architecture §6.1 member
  4 arriving inside the work order written to cite by symbol.)*
- **Do not port `styles.css:29-60`** (`@layer base`). Those are the sheet's only
  global-element selectors and they target `html`, `body` and **`#app`** — and PupPad has
  a live `#app`.
- **The 132 Tailwind tokens are hand-written CSS.** Budget them; they are the largest
  uncounted item in the port.
- **Shadow DOM is NOT chosen**, but record why: it would cost one `elementFromPoint`
  rewrite and no `composedPath`. It is cheaper than the recon said and it is still not
  worth a second mechanism for a name-collision problem that does not exist.

### 1.3 The module — no module scope, and the remount is the proof

- **The entire state machine is `let`/`const` inside `mount`.** `store.ts:156`'s
  module-scope `create()` does not come across, and neither does
  `exposeDebug`'s `window.__blockPop` (`store.ts:424`), which leaks the whole store as a
  live global.
- **Port `engine.ts`, `pieces.ts`, `types.ts` into that closure.** Include
  `rescueUnplaceable` (`engine.ts:174`) — the recon omitted it — and note the deal is a
  **hard filter**, not a bias: shapes that fit nowhere are removed from the pool and the
  mode weights renormalised over the survivors.
- **`Piece.id` does not come across.** *(Ruled.)* Its one reader is a React key
  (`PieceTray.tsx:22`) and there is no reconciler here. It **does** land in the source's
  save blob and is neither stable nor unique — the mint counter resets to 1 on module
  load — so carrying it would import a bug, not a feature. Slot identity is the array
  index, as it already is everywhere in the source.
- **Save through `api.save`/`api.load`, namespaced by `api.entry.id`.** Abandon
  `save.ts`'s `'block-pop-v1'` key. `api.load()` may return `null` and **the game must
  run correctly when it does.**

### 1.4 The renderer — a transition classifier, not a rebuild

Retain a painted-state array. On each update classify every cell against it — `0→n` pop,
`n→dying` clear, `dying→0` plain, unchanged, and refill — and restart animations
explicitly: batched `classList.remove` → a single `void grid.offsetWidth` → `classList.add`.
**One reflow per update, not one per cell.**

**And fix `clearing`'s unbounded window rather than porting it:** the dying set must have
exactly one owner and one cancellation path, and a placement inside the window must not
strand it. §3's checks 5 and 6 are the two that catch this and they are the reason this
section exists.

### 1.5 The assists go in the drawer, and this WO builds none of them

**§8.8 ruling, settled by arithmetic:** with the panel open the drawer is **321px of 412,
leaving 91px of field.** Block Pop's four assists are `action` descriptors on the seam.
**This work order publishes the seam with `controlsOpen: false` and NO controls** — the
assists arrive in `PUP-WO-0401`. Publishing `controlsOpen: false` now is what gives the
board its full 412.

**`PUP-WO-0111` owns the shell change that makes `controlsOpen` mean anything.** Until it
lands, the drawer still defaults open. **That is a dependency, not a blocker:** with no
controls published, `mountControlPanel` returns `null` at its own guard and no panel
mounts at all. Verify that rather than assuming it.

---

## 2. Invariants — restated by number, the slice this WO touches

- **1 — every control operable by a non-reader.** The board, the tray and the play-again
  affordance carry **no text**. Gate 4 is "cover all text and operate it".
- **3 — works with no network.** `games/*.js` is grepped for `fetch`, `XMLHttpRequest`,
  `import(`, `EventSource`, `WebSocket` and `sendBeacon`, and the build goes red. **The
  module makes no network call of any kind.**
- **5 — no state that ends play without a one-tap way back.** Running out of room is
  Block Pop's only terminal state. **§8.5: a single affordance INSIDE `host` that resumes
  play.** `GameOver.tsx`'s three buttons do not come across, and the module **must not**
  call `api.close()` there.
- **6 — adding a game is a data change.** This WO touches `games/blockpop.js`, **one**
  registry entry, and **one** `urlsToCache` line. Nothing else.

---

## 3. Tests / acceptance — `demo-blockpop.mjs`, proven not asserted

**At the fleet viewports — 869×412, 915×412, 883×412 — and nowhere else.** Do not copy a
viewport list from check 19 or check 20; both are wrong and `PUP-WO-0111` is why.

Drive real touch via CDP `Input.dispatchTouchEvent` with `hasTouch:true`, as
`demo-controls.mjs:58-63` already does. **A synthetic click is not a finger.**

1. **GEOMETRY, and it can be written before a line of game logic.** Every game-owned
   interactive element's bounding rect lies **inside the viewport** at all three sizes,
   and none intersects `#gameBack`'s x 10–74.
2. A touch-drag from a tray slot to a legal cell fills it; an illegal drop does not.
3. Tap-select then tap-cell places. **Note the source gates this on `dist < 14`
   (`BlockPopGame.tsx:142`, `:153`) and a longer slide falls through to `playInvalid()`
   plus a shake. A three-year-old's tap slides further than 14px routinely** — the shell's
   own `wireTap` applies no distance gate for exactly this reason. Widen it and assert the
   widened value.
4. A completed row clears and the score rises by `engine.ts:131-139`'s formula.
5. **THE INVISIBLE ONE.** Hold a filled board and drag across it — **zero candies re-pop.**
   Measurable via `getAnimations()` start times. This is the defect neither naive port
   survives and no green suite sees.
6. **THE OTHER INVISIBLE ONE.** Clear a line, place another piece **inside 280ms**, and
   the new candies are **visible**. The source strands `clearing` forever here.
7. **REMOUNT.** ~~Mount `blocks`, play, back, mount `blocks` again — **a fresh board, not
   a retained one.**~~

   > **STRUCK AND REPLACED 2026-09-02. As worded this failed a CORRECT implementation.**
   > §1.3 mandates save/load through `api.save`, so a second mount **resumes** — that is
   > the feature, not the defect. The item's rationale was about **module-scope** state,
   > which is a different thing from **saved** state, and conflating them made the check
   > assert the opposite of the ruling. **CC-B found it and built the discriminating
   > version, which is the right one:**
   >
   > **7a.** Play, leave, **CLEAR STORAGE**, remount → **the board is empty.** Anything
   > that survives an empty store came back *through the module*, which is the hazard
   > §0.4 actually names.
   > **7b.** §0.4's own case directly: **two entry ids against one module URL, mounted
   > simultaneously**, asserted to hold independent boards — 6×6/36 cells and 8×8/64
   > cells, neither overriding the other.
   >
   > **AND THE RESUME IS RULED IN, because Scotty asked for it and I failed to write it
   > down.** His scope: *"we could allow the current board to be durable between app
   > closes in a way that everything else doesn't — so it can be picked up and put back
   > down."* It does not cross `PUP-WO-0701` §1.0a, which ruled media in-memory because a
   > purge **fails open and leaves a child's photos on disk**: a board is ~64 integers and
   > three shapes, under a kilobyte, carrying nothing sensitive, so that reasoning does
   > not reach this data class. **I ruled this hours before dispatching and it never
   > entered the work order** — §1.3 implements it by accident and §3 item 7 contradicted
   > it. Ratified-and-unwritten, in the document written to stop that.
8. **TEARDOWN.** No live rAF, timer, observer, listener or **pointer capture** — the source
   takes one on every tray grab (`BlockPopGame.tsx:249`) and `games/gyre.js:1319-1333`'s
   `release()` is the precedent to copy, in its stated order.
9. **THE TERMINAL STATE — reachable by PLAY, never by calling the seam.** *(Ruled
   2026-09-02 after CC-B recorded it OPEN rather than faking it, which was the right
   call.)* The deterministic all-dot deal makes game-over **unreachable by
   construction**: a 1×1 fits wherever any cell is free, and `pickFittingPiece` hard-
   filters to shapes that fit, so it can never deal an unfittable piece. **The terminal
   state is exactly the state where that filter returns EMPTY.**

   ~~**So drive the filter, do not bypass it: exclude the 1×1 from the test pool.**~~

   > **THAT RULING WAS WRONG AND CC-B REFUTED IT AT SOURCE.** `engine.ts:155` is
   > `fitting.length > 0 ? pickWeighted(fitting, mode, rng) : DOT` — **the fallback IS
   > the dot**, so removing it from the pool removes nothing. Worse, it establishes
   > something the roadmap does not know: **easy mode cannot reach game over at all.**
   > `rescueUnplaceable` swaps any unplaceable piece for one that fits, a dot fits
   > wherever a single cell is free, so the board must be entirely full — **and the
   > placement that fills a row's last cell clears that row.** CC-B drove 108 finger
   > placements and `over` never went true. **Little Hands is unlosable, and that is
   > almost certainly right for Buddy.**
   >
   > **The built answer is better than my ruling: hand `api.load()` a FULL BOARD.**
   > Everything downstream is then real — `dealTray` runs the real filter, it returns
   > empty, the fallback is a dot, `anyTrayFits` says no. **Nothing calls the seam.** **Assert: one affordance inside `host`, no text on it,
   one tap resumes play, and `api.close()` is never called.** *(Northstar invariant 5,
   §8.5.)* **A terminal state reached by calling the seam proves the affordance renders
   and proves nothing about whether the game can arrive there.**

10. **A PLANTED DEFECT PER NEW CHECK.** Each of 1–8 must be shown going **red** against a
   deliberately broken build. A check never seen red is not a check.

---

## 4. Scope fence — NOT in this work order

- **The 8×8 `blocks-big` entry, and the four assists** — `PUP-WO-0401`. Ship **one**
  registry entry.
- **Particles, audio, cheer, shake, haptics** — `PUP-WO-0402`. **The module constructs no
  `AudioContext`**; the shell has exactly one and does not hand it out (§8.3).
- **The score's presentation.** The engine accrues it; whether it is *shown* is `0402`'s,
  and northstar §5's non-goal on scores is why.
- **`players` / the `{playerId, action}` reducer.** Roadmap §P4 puts architecture §7 seams
  1–3 in this WO; **§7's own cost correction says seams 2 and 3 are net new construction,
  not preservation.** Seam 1 (no module state) is delivered here by §1.3 and is the one
  that is free. **Set `players: 1` on the entry** — `PUP-WO-0000.md`'s sample sets
  `players: 2` on `blocks-big` and copying it badges a single-player game as two-player.
- **`manifest.json`, the icons, `games/gyre.js`, `games/hello.js`** — diff to empty.
  **`PUP-WO-0111`'s shell change is not yours either.**
- **`sw.js` — EXACTLY ONE ADDED LINE, the `urlsToCache` entry for `games/blockpop.js`,
  and nothing else.** *(AMENDED 2026-09-02, and the amendment is a correction to this
  work order rather than a concession. **The first draft ordered `sw.js` to diff to empty
  while §2 invariant 6 required "one `urlsToCache` line" — and `urlsToCache` is
  `sw.js:317`, occurring nowhere in `index.html`. The fence forbade the only file the
  required edit can be made in.** Three things agree on the intent and only the location
  was wrong: invariant 6 demands the line, `check-gate2.mjs:212` fails with the literal
  string `'the urlsToCache line (sw.js) was not added'`, and
  `check-cache-name-controls.mjs:154` names the scenario "a NEW GAME: module + registry
  entry + one `urlsToCache` line". **Found by CC-B, who crossed it and reported rather
  than stalling — which is the correct handling of a work order that contradicts itself,
  and this is the fourth of mine to do it.*)*

---

## 5. Adversarial pass

**Right-sized per Scotty's ruling: verify the port works and the code is right.** The
security-shaped lenses move to the end-of-project sweep — this module touches no network
and no untrusted input. **Order: build → freeze → pass → disposition → feedback → PR.**

Probe: interrupt between the clear and the refill; drag off-board and back; two fingers;
a tap that slides 20px; `api.load()` returning `null`, `{}`, and a board of the wrong
size; teardown mid-drag with a pointer captured; remount twice without reload; and **the
smallest viewport with the safe-area insets forced non-zero.**

## 6. Upward feedback

`FEEDBACK.md`, parked with the work. Schema per entry: `finding · where (file:line) ·
type · recommendation · decision-needed (yes/no)`. Include **what did not work and why**,
a gates line, and **what was deliberately not built**.

## 7. Flag-and-stop

- Any design that needs a change to §8.1/§8.2/§8.3/§8.8 — back to CC-A, then to the
  findings document. Never quietly here.
- Any network call, any `AudioContext`, any `document.head` append, any module-scope state.
- Any touched file outside `games/blockpop.js`, **`index.html`'s registry entry**,
  **`sw.js`'s single `urlsToCache` line**, and `.github/ci/demo-blockpop.mjs`.
  *(Corrected: the first draft located `urlsToCache` in `index.html`. It is `sw.js:317`.)*
- **AND `.github/ci/demo-blockpop-controls.mjs` AND `.github/workflows/ci.yml`, which
  this list should always have named.** *(Amended 2026-09-02, flagged by CC-B rather
  than left to be found.)* **§3 item 10 requires every new check to be shown going red,
  and item 9 requires it to run at all — so the red-proof harness and the CI
  registration are machinery my own acceptance list demands, forbidden by my own fence.
  That is the THIRD self-contradiction in this one work order**, after the `urlsToCache`
  location and check 7. The fence was pedantic about `sw.js` and silent about the two
  files that make its own §3 executable.
- **A check you cannot show going red.**
- Anything that makes the terminal state reachable without a one-tap way back.

## 8. Kickoff

Fetch, branch from live `main`, read this file, `PUP-WO-0000.md` §8.1/§8.2/§8.3/§8.5/§8.8,
architecture §3 and §6.1, and §0 above. **Scotty is invoking ultracode; orchestrate the
build and spend the budget on the adversarial half.** Build → freeze → pass → disposition
→ `FEEDBACK.md` → one PR, left unmerged, then notify CC-A.
