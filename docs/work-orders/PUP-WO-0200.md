# PUP-WO-0200 — The button swap, the registry, and the contract that makes a game data

**Repo:** ikthys777/PupPad · **Base:** `main` (**verify live HEAD**).
**Branch:** `build/wo-0200`.
**Author:** CC-A · **Builder:** to be assigned.
**Phase:** P2 · **Phase exit gate:** `docs/roadmap.md` P2, items 1–5.
**Depends on:** **P1 closed** — `PUP-WO-0103` merged, `stable` fast-forwarded, Pages
flipped, roadmap gates 3 and 4 run. See §0.
**Grounds:** `docs/northstar.md` invariants 1, 3, 5, 6 · `docs/architecture.md` §4,
§5, §6 · `docs/roadmap.md` P2 · `docs/findings/PUP-WO-0000.md` §1.6, §8, §9.

> **What this is:** the games surface becomes reachable, and adding a game becomes a
> data change. Three things: the Power button becomes Games, the registry exists, and
> the module contract is implemented as the shell's half. It is **NOT** the picker
> overlay (`PUP-WO-0201`), not a game, and not `sw.js`.

**Cadence:** build. One PR, left unmerged for review.

**First act:** `git fetch origin && git checkout -B build/wo-0200 origin/main`.

---

## 0. This is the first work order that edits `index.html`, and the rules changed

Every P1 work order **protected** `index.html`. This one **is** `index.html`. Read
that sentence twice before starting.

**The firebreak now exists and this is the first work that relies on it.** Roadmap P2
states the rule without the bootstrap exception that let P0 and P1 merge: *"nothing
merges into a live path before the firebreak holds."* From here the promoted copy is
what Buddy loads, and `main` is a test path. **If P1's gate has not closed, this work
order does not start** — not because the code would be wrong, but because the property
that makes an `index.html` change safe to merge would not exist yet.

**Do not begin until CC-A confirms P1 closed.** That confirmation is a fact about
`stable` and the Pages build type, not a feeling about readiness.

## 1. Scope

**Four things, and the first one is not in the roadmap.**

### 1.1 FIRST: the check that `PUP-WO-0000` §8.3 says invariant 3 rests on does not exist

*Found by CC-A 2026-09-01 while authoring this work order, by asking whether a
recommendation had become a commit — architecture §6.1.*

`docs/findings/PUP-WO-0000.md` §8.3 states, as a correction its own adversarial pass
forced (finding F8), that omitting `fetch` from the `api` object is **a convention and
not enforcement**, and that what enforces it is **a CI check that can go red**:

> *"`PUP-WO-0100` greps `games/*.js` for `fetch(`, `XMLHttpRequest`, `import(`,
> `EventSource` and `new WebSocket` and fails the build. **Invariant 3 and
> architecture §5's 'strictly offline' rest on that check**, not on the shape of this
> object."*

**It was never built.** Verified: no check under `.github/ci/` greps `games/` for any
of those tokens; the only matches on `main` are comments and one unrelated
`new WebSocket` inside the CDP harness.

**Nobody noticed because `games/` does not exist**, so the check would have scanned
nothing and its absence is invisible — **exactly the shape of a false green, arriving
before there is anything to be green about.** It becomes load-bearing **the moment
this work order creates that directory**, which is why it is item 1 and not a
footnote.

**Build the check first, and demonstrate it red** against a throwaway `games/` module
containing each forbidden token, before any real module exists. A check written after
the code it guards is a check shaped by the code it guards.

**Fail closed** (architecture §6.1, member 4's rule): a `games/` directory that cannot
be read, or a module that cannot be parsed, is a **failure**, never a pass.

### 1.2 The button swap

Replace `id:7` Power with Games in `BTNS_RIGHT`; reassign the `powerUp` sound to
games-open. Roadmap P2 exit gate 1 is the test: `grep -ri power index.html` returns
**only** the sound-bank definition.

**Invariant 1 governs the icon.** A non-reader must be able to tell what the button
does from the icon alone — gate 3 is a person who has not seen the app naming it from
a screenshot with all text covered. **That is a design decision with a falsification
test, so propose the icon and say what you expect a naive viewer to call it.** If you
cannot state that prediction, the icon is not ready.

### 1.3 The registry

The array, per `docs/findings/PUP-WO-0000.md` **§9**, which this work order **defers
to rather than restates** — the same discipline architecture §4 uses for the contract.
Two copies of a specification drift; one of them is then wrong and both look
authoritative.

### 1.4 The shell's half of the module contract

`docs/findings/PUP-WO-0000.md` **§8.2's six obligations** and **§8.3's `api`
surface**, implemented. Again: defer, do not restate.

**Ships with one trivial placeholder game** proving the contract — roadmap P2's own
wording. It is a contract demonstration, not a game; it exists so gate 2 can be run.

## 2. Invariants — restated by number

- **1** — every control operable by a non-reader. The new button is a control a
  three-year-old must recognise. §1.2.
- **3** — every core surface works with no network. The games surface must open cold
  in airplane mode, and §1.1 is what keeps a future module from quietly breaking this.
- **5** — no state ends play without a one-tap way back. **See §3.4; this is the one
  most likely to be got wrong here.**
- **6** — adding a game is a data change. Gate 2 is its falsification and it is
  measured with `git diff --stat`, not asserted.

**Protected surfaces — must diff to empty:** `sw.js`. *(One `urlsToCache` line per
game is expected later, per gate 2 — but this work order adds no real game, so the
worker does not change. If you believe it must, that is a flag-and-stop.)*
`manifest.json` and both icons are also protected.

## 3. Acceptance — proven, not asserted

1. `git fetch origin && git diff origin/main --stat` shows `index.html`, `games/`,
   `.github/` and `docs/` only. **`sw.js`, `manifest.json` and both icons diff to
   empty.**
2. **§1.1's check demonstrated RED first**, against a module carrying each forbidden
   token, each removed one at a time so the check is shown to detect **each** rather
   than **any**. *(Architecture §6.1: a detector proven by removing a sole detector.)*
3. **Roadmap P2 gate 2 run as written**: add a second placeholder, count with
   `git diff --stat`, show exactly three things changed. **A count is the evidence;
   a description of the count is not.**
4. **The back affordance is wired BEFORE `mount()` is called — never after.**
   *`PUP-WO-0000` §1.6: all three existing openers append a full-bleed overlay early
   and wire CLOSE last (Draw 152 lines, Camera 287, Map 189), and Map's is a confirmed
   live trap requiring an app restart.* **Demonstrate it: make `mount()` throw on
   purpose and show the way back still works.** A games host that reproduces §1.6's
   shape fails this work order regardless of everything else — it would take the one
   defect the shell already has and give it to every future game.
5. **Cold start, airplane mode**: console → games → placeholder → back to console.
6. **Gate 5's baseline measured and recorded** — the number, not a verdict. The
   threshold is architecture §10's open question and stays open.
7. **Every demonstration asserts the commit and the failing step name**
   (architecture §5).

## 4. Scope fence — NOT in this work order

- **The picker overlay** — `PUP-WO-0201`. This work order makes the button and the
  registry exist; rendering tiles from it is the next one.
- **Any real game** — P3 (Gyre), P4 (Block Pop).
- **`sw.js`** — including the eventual per-game `urlsToCache` line.
- **The three existing openers' un-closable-overlay trap** — `PUP-WO-0106`, CC-A's.
  §3.4 requires the games host not to *reproduce* it; repairing Draw, Camera and Map
  is separate work. **Do not fix them here, and do not copy their shape.**
- **Parked behind this phase:** `PUP-WO-0104`, `0106`, `0108` (the quota path), the
  cross-origin tiles question, and the publication-concurrency redesign.

## 5. Adversarial pass

Black-box, fresh subagent, artifact and ground truth only. **Freeze every named
deliverable including the feedback file, record the SHA-256 of each at freeze, and
re-verify and paste the comparison at disposition** — and read the feedback file
itself as a deliverable, measuring its **claims** against the tree. *(Both rules are
`PUP-WO-0105`'s and `0103`'s, ratified: hashes make a file tamper-evident and
simultaneously make it easier to leave WRONG.)*

Probes:

- **Get out of the games surface without a way back.** The headline, and §1.6 is the
  proof this shape is reachable in this codebase rather than hypothetical.
- **Make `teardown` drift from `mount`.** The returned-closure design exists to make
  that unwriteable; try to write it anyway.
- **Reach the network from a module** in a way §1.1's check does not see.
- **Break gate 2's count** — find a change that adds a game and touches a fourth
  thing.
- **Ask of every fix: what legitimate behaviour does this now refuse?**

## 6. Upward feedback

`docs/feedback/PUP-WO-0200.md`; verbatim exchange in
`docs/findings/PUP-WO-0200-adversarial.md`. Required: the red demonstrations with
commit and failing step name; the icon prediction from §1.2 and what the naive viewer
actually said; gate 2's `git diff --stat` output; gate 5's number; what did not work
and why; what was deliberately not done; and a gates line stating protected-surface
diff status as a checkable fact.

## 7. Flag-and-stop

- **P1's gate not closed** when you start. §0.
- **Any need to change `sw.js`**, `manifest.json` or an icon.
- **§1.1's check proving unbuildable or unable to fail** — a ruling, not a limit to
  declare.
- **Gate 2 needing a fourth thing changed.** That falsifies invariant 6 and is an
  architecture question, not a build step.
- **The back affordance not wirable before `mount()`.** That is §3.4 and it is the
  point of the work order.
- A second adversarial pass finding serious defects.

## 8. Provenance

Written by CC-A 2026-09-01, immediately after `PUP-WO-0103` was parked for merge and
while P1's remaining two steps sat with the operator. **§1.1 is not in the roadmap and
is the reason this work order was worth writing before it could be dispatched:**
`PUP-WO-0000` §8.3 rests invariant 3 on a CI check that `PUP-WO-0100` was to build and
did not, and the gap is invisible until `games/` exists — which is this work order.
It is the third time in one day that *nothing asked whether a recommendation became a
commit*, and the first time the question was asked **before** the artifact shipped
rather than after.
