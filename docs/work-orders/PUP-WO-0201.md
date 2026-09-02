# PUP-WO-0201 — The picker: the registry becomes something a child can see

**Repo:** ikthys777/PupPad · **Base:** `main` (**verify live HEAD**).
**Branch:** `build/wo-0201`.
**Author:** CC-A · **Builder:** to be assigned.
**Phase:** P2 · **Phase exit gate:** `docs/roadmap.md` P2, items 1–5. **This work
order is what makes gates 2, 3 and 4 answerable at all.**
**Depends on:** `PUP-WO-0200` merged.
**Grounds:** `docs/northstar.md` invariants 1, 3, 5, 6 · `docs/architecture.md` §4,
§5, §6.1 · `docs/roadmap.md` P2 · `docs/findings/PUP-WO-0000.md` §1.6, §9.

> **What this is:** a full-screen overlay of large tiles, one per registry entry,
> rendered from `GAMES` with **no knowledge of any specific game**. It is **NOT** a
> game (`PUP-WO-0300`), not the registry or the contract (`PUP-WO-0200`, done), and
> not `sw.js`.

**Cadence:** build. One PR **opened at park**, left unmerged for review.

**First act:** `git fetch origin && git checkout -B build/wo-0201 origin/main`.

---

## 0. THE FENCE — stated ONCE, here, referenced everywhere, restated nowhere

*Second work order built this way. See `PUP-WO-0300` §0 for why: four work orders
contradicted themselves because a fence was written twice and one copy drifted.*

**MAY change:** `index.html`, `.github/`, `docs/`.
**MUST diff to empty:** `sw.js`, `manifest.json`, both icons, `games/`.
*(No new asset and no new game — so unlike `PUP-WO-0300`, `sw.js` does not move here
at all. If you believe it must, that is a flag-and-stop.)*

**The gate CC-A runs at merge is exactly this block**, pasted into the merge commit.

## 1. What exists, so you do not rebuild it

`PUP-WO-0200` built the host and it is good. Read `openGames()` in `index.html`
before designing anything:

- **`openGames(entry)` already takes an entry** and defaults to `GAMES[0]`. Today,
  tapping Games launches the only game directly. **Your job is to insert the picker
  between the button and that call** — not to rewrite the host.
- **The back affordance is already wired before `mount()`**, outside `host`, above it,
  and the comment above it is honest about what that does and does not buy. Do not
  add a second close path; `api.close()` delegates to `endGameSession()`.
- **`registryEntryIsValid()` exists** and enforces `PUP-WO-0000` §9.1. **The picker
  must not render an entry that fails it** — an invalid entry is not a tile.
- **`GAMES_Z` is 500/501.** The picker needs its own band and must sit *below* the
  game host, not above it.

## 2. Scope

### 2.1 The picker

A full-screen overlay following the shell's existing `openX()`/`closeX()` pattern.
**Renders from `GAMES` and knows nothing about any specific game** — architecture §4
calls this a contract, and the test is that adding an entry changes the picker with
no picker edit.

**Each tile carries an icon AND its word** (roadmap P2). The word is for the adult
and for the child who will one day read it; **the icon is what has to work today**,
because gate 3 covers all text and asks a stranger to name the tile.

**Tiles are large.** A three-year-old's aim is not an adult's. Prefer fewer, bigger
tiles over a grid that fits more.

### 2.2 It always opens, even with one game

**With a single registry entry the picker still opens.** Do not special-case
straight-through to the only game.

*The reasoning, because the shortcut is tempting and it is wrong:* **a non-reader
learns the app by consistency of gesture.** If Games sometimes shows a chooser and
sometimes launches a thing, the button means two different things and invariant 1's
"operable by a non-reader" stops holding — not because the control is unlabelled but
because it is *unpredictable*. Same taps, same result, every time.

### 2.3 The picker is itself a full-screen surface, so §1.6 applies to IT

`PUP-WO-0000` §1.6: all three existing openers append a full-bleed overlay early and
wire CLOSE last — Draw 152 lines, Camera 287, Map 189 — and Map is a confirmed live
trap needing an app restart.

**The picker must not join that list.** Its way back to the console is wired
**before** the tiles are rendered, never after. **Demonstrate it by making tile
rendering throw on purpose** and showing the way back still works — the same test
`PUP-WO-0200` §3.4 used, applied to the surface you are adding.

### 2.4 Gate 2 becomes a CI mutation, not a memory

*Ruled 2026-09-02.* Roadmap P2 gate 2 — *adding a game touches exactly three things*
— was demonstrated in `PUP-WO-0200` with a throwaway module that **did not ship**.
That was the right call (a second dead tile is a control that lies), but it leaves
**gate 2's evidence living only in a commit message, which is architecture §6.1
member 5: a demonstration about a tree that no longer exists.**

**Build it as a check.** Synthesise a game — module, registry entry, `urlsToCache`
line — count the diff, assert **exactly three**, revert. Then invariant 6 is enforced
by CI on every future game instead of being re-proved by hand and forgotten.

**It must be able to fail:** demonstrate it red against a synthetic game that touches
a fourth thing. *(Architecture §6.1: a stub that cannot fail is not a test.)*

## 3. Acceptance — proven, not asserted

1. **The fence in §0 holds.** Run it, paste it, do not restate it.
2. **Roadmap P2 gate 3 RUN, not simulated** — a screenshot of the picker with **all
   text covered**, shown to **a person who has not seen the app**, who states what
   each tile does. **Record the prediction before the test** (`PUP-WO-0200` §1.2's
   discipline). *The tester is a human and may be the operator; if you cannot get
   one, that is a flag-and-stop and the gate stays open — do not simulate it.*
3. **Roadmap P2 gate 4 RUN**: airplane mode, cold start, console → picker → game →
   back to console.
4. **§2.3 demonstrated** — tile rendering throws, the way back still works.
5. **§2.4's check demonstrated RED** against a four-thing game, then green.
6. **The picker renders a new entry with no picker edit** — add one to `GAMES`, see a
   tile, revert. That is §2.1's contract, tested.
7. **An invalid registry entry produces no tile** and does not break the picker.
8. **Every demonstration asserts the commit and the failing step name**
   (architecture §5).

## 4. Scope fence — NOT in this work order

- **Any game** — `PUP-WO-0300`/`0301`.
- **`sw.js`** — see §0. Nothing here is cached that was not cached before.
- **The three existing openers' overlay trap** — `PUP-WO-0106`, CC-A's. §2.3 requires
  the picker not to *reproduce* it; repairing Draw, Camera and Map is separate.
- **Parked:** `PUP-WO-0104`, `0106`, `0108`, the tiles question, the CSP/iframe
  question, `check-assets` blindness to module-referenced assets.

## 5. Adversarial pass

Black-box, fresh subagent, artifact and ground truth only.

**Freeze protocol, current form (architecture §5):** a read-only pass gets a
**`git archive` export** — no `.git`, so committing is inexpressible; a pass needing
git-dependent checks gets a **`git clone`**; **never `cp -r` of a worktree.** Record
SHA-256 of every deliverable at freeze, re-verify at disposition, **and read the
feedback file as a deliverable, measuring its claims** (§6.1 member 5).

Probes:

- **Strand the child in the picker.** Any state where back takes more than one tap.
- **Make the picker render something it should not** — an invalid entry, an entry
  whose fields lie, an entry added at runtime.
- **Make a tile unreachable** — off-screen, under something, too small for a
  three-year-old's aim.
- **Defeat §2.4's counter** — add a game that touches a fourth thing the count
  cannot see. *(`PUP-WO-0200` found exactly this: an A14 anchor pinned the last
  `urlsToCache` entry, so adding a game required editing a file `git diff --stat`
  already counted, and the gate's own instrument could not see the gate failing.)*
- **Ask what each fix now refuses.**

## 6. Upward feedback

`docs/feedback/PUP-WO-0201.md`; verbatim exchange in
`docs/findings/PUP-WO-0201-adversarial.md`. Required: gate 3's prediction and what
the tester actually said; the red demonstrations with commit and failing step name;
what did not work and why; what was deliberately not done; and the §0 fence status as
a checkable fact.

## 7. Flag-and-stop

- **Any need to touch `sw.js`**, `manifest.json`, an icon, or `games/` (§0).
- **No human available for gate 3.** The gate stays open and unrun. **Do not
  simulate a naive viewer** — a model predicting what a stranger would say is not
  evidence about a stranger, and this is invariant 1, which the northstar calls *"the
  project."*
- **The picker unable to render from the registry alone** — that falsifies
  architecture §4's contract and is a design decision.
- **§2.4's counter proving unbuildable or unable to fail.**
- A second adversarial pass finding serious defects.

## 8. Provenance

Written by CC-A 2026-09-02, while `PUP-WO-0300` was being built, from roadmap P2's
own specification. **§2.2 and §2.4 are rulings rather than restatements:** the picker
opens even for one game because a non-reader learns by consistency of gesture, and
gate 2 becomes a CI mutation because `PUP-WO-0200`'s correct decision not to ship its
throwaway left the gate's evidence in a commit message — **§6.1 member 5, applied to
a gate the same week the member was written.**
