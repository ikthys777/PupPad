# PUP-WO-0404 — Surface the score twice, and make the perfect clear the win

**Repo:** ikthys777/PupPad · **Base:** `main` (currently `0ad2564`; **verify live HEAD**).
**Branch:** `build/wo-0404`. **Author:** CC-A · **Builder:** `builder-61`.
**Phase:** P4 · **Subject SHA:** citations resolved at **`0ad2564`**, paired with symbols.

**Grounds:** **northstar invariant 1** and **§5's non-goal on scores** · architecture §3
(the fleet), §5 · `PUP-WO-0000.md` §8.3 · roadmap P4 gate 2 · Scotty, on the device.

> **What this is:** Block Pop already keeps score and already keeps a combo, and **shows
> neither**. This surfaces both — **twice, in two channels, for two different people** —
> and adds the one thing the game is missing: **a win.**

**Cadence:** build. One PR, left unmerged.

---

## 0. WHAT ALREADY EXISTS — verified at source, so this is not a scoring build

| | |
|---|---|
| `scorePlacement` | `games/blockpop.js:243` — `10 × lines × max(1, combo)` |
| `score` / `combo` | `:324-325` |
| combo advance / reset | `:956` — `combo = lines > 0 ? combo + 1 : 0` |
| persistence | `:412-413`, restored at `:1315` |
| **rendered anywhere** | **NO.** Zero `textContent`/`innerHTML`/render sites for it. |

**AND THE PERSISTENCE BUG IS FIXED, NOT MERELY DESCRIBED.** I checked, because a
described bug and a fixed one read the same in a comment. `validCount` (`:357`, bounded
`0..1e9`) is a **separate predicate** from `validCell` (`:348`, bounded `0..COLOR_COUNT`),
and `:412-413` use it. The comment at `:352` keeps the history: reusing the colour-id
predicate for a counter zeroed every resumed score above 7, and one line clear scores 11.

**So the work is SURFACING, not computing.**

## 1. THE RULING THAT MATTERS MORE THAN THE FEATURE — BUILD IT TWICE

**Buddy is three and cannot read numbers.** A readout of `240` is invisible to him and is
**decoration for the adult**. Northstar invariant 1: *every control is operable by a
non-reader; text may never be the only way to know what something does.* And northstar §5
makes scores a **non-goal** because they import a fail state.

**RULED: the score is surfaced in two channels, and the child's is the PRIMARY one.**

**FOR THE CHILD — the combo drives the BOARD, not a label.** The multiplier is expressed
as *how much better the world reacts*: more particles, a brighter flash, a higher pitch,
a longer cheer. **He learns that two lines at once feels better than one without ever
seeing a digit.** This is the same shape as Gyre's sliders — *the thing he responds to is
what changed on screen, not the number that caused it.*

**FOR SCOTTY — the numeric score, small, out of the way, and out of the child's path.**
It must not occupy a touch target, must not sit in the exit's column, and **must not be
the only expression of anything.**

**This is how the non-goal is honoured rather than argued with.** §5 forbids scores
because they import a fail state — a number a child reads and feels behind. **A number he
cannot read imports nothing**, and the channel he *can* read carries only "that was
good", never "that was bad". **There is no losing feedback in the child's channel. A
placement that clears nothing is silent, not negative.**

**Acceptance — and the first is the one that proves the ruling:**
1. **With every painted word covered, a clearing placement is still distinguishable from
   a non-clearing one, and a 2× combo from a 1×.** That is invariant 1's own falsification
   test applied to this feature.
2. The child-channel intensity is a **monotonic** function of the combo — assert it at
   three combo values, measuring **particles drawn / peak brightness / pitch**, not a
   variable.
3. The numeric readout intersects **no** interactive rect and **not** the exit's column
   (derived from the exit, never a literal — architecture §5).
4. `api.prefersReducedMotion` is honoured in the child channel **without removing the
   distinction** — if motion is reduced, the difference must survive in another dimension.

## 2. THE PERFECT CLEAR — and it is the ONLY win this game has

**There is NO board-empty detection anywhere in `games/blockpop.js`** — zero matches for
`perfect`, `allClear`, `boardEmpty`, `isEmpty`. **Clearing the whole board currently
passes unnoticed.**

**AND THE SCOPE FOLLOWS FROM SOMETHING ALREADY RULED: easy mode cannot be lost.**
Confirmed at source in `PUP-WO-0402`'s pass — `engine.ts:155` falls back to `DOT` when
nothing fits, `rescueUnplaceable` swaps any unplaceable piece, and a 1×1 fits wherever a
single cell is free, so the board must be entirely full — and the placement that fills a
row's last cell clears it. **108 finger placements never reached game over.** Roadmap P4
gate 2 carries the correction, and Scotty has confirmed unlosable is **intentional and
right** for a three-year-old.

**Therefore: the perfect clear is not a flourish. It is the entire emotional payoff of
Block Pop in the mode Buddy plays.** Scope it as the win condition it is — **fireworks, a
bubbly "Good Job!" that pops up, grows fast, and bursts** — and give it the budget that
implies.

*(One consequence to state rather than discover: **a perfect clear is reachable and a
loss is not**, so this is the only terminal-feeling event easy mode has. It must **return
to play in one tap or return by itself** — invariant 5 applies to a celebration exactly
as it applies to a game over. A three-year-old must not be stuck admiring fireworks.)*

## 3. THE FIREWORKS DO NOT SHARE GYRE'S CODE — and the defect class does not apply

The question was raised because *"two expressions that must agree"* is what this project
keeps paying for. **It does not apply here, and the distinction is worth stating.**

**Sharing is not possible and should not be made possible:**
- **There is no shared path.** Zero imports between game modules — `§8.1` is *one file per
  game, one default export*, and `check-games-offline.mjs` fails the build on `import(`.
  **Creating a shared runtime is an amendment to the module contract, not a feature.**
- **Invariant 6** — a new game touches its own module, one registry entry, the manifest.
  A shared effects library makes every game's change a change to every other game.
- **And it is the wrong code anyway.** Gyre's machinery is a **continuous pointer-driven
  field simulation** over `Float32Array(COUNT_MAX)` (`games/gyre.js:478`). A perfect-clear
  firework is a **one-shot emitter**. Same word, different mechanism.

**THE DISTINCTION, because it is the generalisable half: duplication of a TECHNIQUE is
not duplication of a FACT.** The defect class is two places holding the same **value** or
asserting the same **claim** — a constant written twice, a comment stating a number the
code contradicts, a check and a doc disagreeing. **Two modules independently drawing
particles share no fact, so nothing can drift out of agreement.** What IS shared is the
**contract** — `api.sound`, `api.vibrate`, `api.prefersReducedMotion` — and it already is.

**Block Pop has no particle code today** — three matches for `particle|burst|spawnP` and
**all three are comments**, including `:18`'s *"Deliberately NOT ported (`PUP-WO-0400`
§4): … particles"*. So this builds its own emitter inside `mount`'s closure, released by
`teardown` like every other handle.

## 4. Fence · 5. Pass · 6. Feedback

**Only `games/blockpop.js` and `.github/ci/demo-blockpop*.mjs`.** `index.html`, `sw.js`,
`manifest.json`, the icons, `games/gyre.js`, `games/hello.js` **diff to empty** —
`index.html` especially, because **`PUP-WO-0111` is parked in flight on it**.

**No security lens** — no byte here comes from off-device (architecture §5). Right-sized
pass. **Every new check red with a plant that is a real defect and parses.** Probe: a
perfect clear during the 280ms clear window; reduced motion; teardown mid-celebration
with an emitter running; a resumed save whose board is already empty; **and the S10+
budget, because the celebration is the heaviest thing this game draws.**

`FEEDBACK.md` parked with the work. Order: build → freeze → pass → disposition → feedback
→ PR. **Flag-and-stop:** any change to `index.html`; any import between game modules; a
celebration a child cannot leave in one tap; a child-channel signal that is negative.
