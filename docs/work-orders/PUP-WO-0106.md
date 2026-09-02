# PUP-WO-0106 — The un-closable overlay: three openers, one shape, one confirmed trap

**Repo:** ikthys777/PupPad · **Base:** `main` (**verify live HEAD**).
**Branch:** `build/wo-0106`.
**Author:** CC-A · **Builder:** to be assigned.
**Phase:** P1 work carried past the gate. **Parked behind P2** — see `docs/roadmap.md`
§4a. **This work order is written, not dispatched.**
**Grounds:** `docs/northstar.md` invariants 3, 5 · `docs/architecture.md` §5, §6.1 ·
`docs/findings/PUP-WO-0000.md` §1.2, §1.6 · `docs/roadmap.md` §4a and P6 ·
`index.html`.

> **What this is:** a guard so a missing Leaflet cannot strand a child behind a dead
> full-screen overlay. It is **NOT** the games host (`PUP-WO-0200`, done), not the
> picker (`PUP-WO-0201`), not the CDN removal (`PUP-WO-0600`), and not `sw.js`.

**Cadence:** build. One PR **opened at park**, left unmerged for review.

---

## 0. THE FENCE — stated ONCE, referenced everywhere, restated nowhere

**MAY change:** `index.html`, `.github/`, `docs/`.
**MUST diff to empty:** `sw.js`, `manifest.json`, both icons, `games/`.

**The gate CC-A runs at merge is exactly this block**, pasted into the merge commit.

## 1. Cite by SYMBOL, not by line — and here is why, measured

**Every absolute line number in every existing document about `index.html` is
suspect.** `PUP-WO-0200` added **296 lines**, and the file is now **2,237** lines.

`PUP-WO-0000` §1.6 — the finding this work order exists to fix — cites the overlay at
`:1361`, the throw at `:1368`, and the CLOSE wiring at `:1550`. **Checked on `main`
2026-09-02: `:1361` is a colour-button loop, `:1368` is blank, `:1550` is
`doSound('keyTap')`. All three now point at unrelated code.** That is architecture
§6.1 **member 4** — a pointer that resolved in the author's head and not in the
reader's tree — in the very document a reader would open first.

**Scale, stated honestly rather than implied:** `docs/` contains **108 distinct
`index.html:NNNN` citations**. Seven land on blank lines; none is past end of file;
**101 land on a line with content, which is not the same as pointing at the right
thing, and CC-A has NOT audited all 108 semantically.** Three are confirmed wrong.

**So: this work order cites symbols.** `openTreasureMap`, `L.map(`, `state.pop`. A
symbol is stable across insertions and greppable by the next reader; a line number is
a **derived position**, and the standing rule (architecture §5) is that a derived
value does not go in a citation unless something recomputes it. **Do not add new
absolute line numbers, and where you must quote one, quote the symbol beside it.**

## 2. The defect, re-verified at symbol on `main`

`openTreasureMap` builds a full-bleed overlay containing `<div id="mapContainer">`,
then calls `L.map('mapContainer', …)`. **Leaflet comes from a CDN.** If `L` is
undefined — CDN blocked, offline before Leaflet was ever cached, ad-blocker,
**or the cache evicted under quota pressure** (architecture §6.5) — the call throws
**after the overlay is in the DOM and before its CLOSE button is wired.**

**And nothing else can dismiss it: `window.addEventListener` and
`document.addEventListener` occurrences in `index.html` = 0.** Re-verified
2026-09-02. No `keydown`, no `popstate`, no `visibilitychange`. **Recovery requires
killing and relaunching the app** — northstar invariant 5, word for word: a state
that ends play with no one-tap way back.

**All three openers have the shape** (`PUP-WO-0000` §1.6): `openCanvas`, `openCamera`
and `openTreasureMap` each append a full-bleed overlay early and wire CLOSE last.
**Only Map has a confirmed reachable trigger.** For the other two, §1.6 is explicit
that *enumerating an opener's known failure modes is not the same as proving no path
exists* — so treat all three as carrying the hazard and say what you proved.

## 3. Scope

### 3.1 The guard, and it is the pattern already in the function

**`openTreasureMap` already has a toast-and-return guard** — it sets `state.pop` for
the no-geolocation case within a couple of lines of its own opening. **It simply never
guards a missing Leaflet.** Add that check *before the overlay is appended*, take the
existing toast path, and return.

**A child with a working console and no map is invariant 5 restored. A child behind a
dead full-screen overlay is not.** That is the whole trade and it is not close.

### 3.2 What this fix now REFUSES — answer it, because it is not nothing

*Architecture §5's standing question, and here it has a known answer already recorded
in the source document.*

`PUP-WO-0000` §1.2: **`state.pop` set on a panel-gate failure is STICKY.** The
clearing timer is armed only on the *non-panel* branch, so the toast persists until
another button is pressed — the same shape at the camera and map gates. **So routing
the Leaflet failure to the toast inherits a message that does not clear itself.**

That is **still** better than the trap, and it is a real cost rather than none.
**Rule on it explicitly in your feedback:** either fix the sticky toast for this path,
or state that you did not and why. **Do not fix all three gates' stickiness silently
— that is a different defect and it is not fenced in here.**

### 3.3 The other two openers

Guard them **if and only if** you can name a reachable trigger. **If you cannot,
say so and leave them** — a guard against a path nobody can reach is code that will
never be exercised, and this project has a name for assertions that never run.
**Do not "harden" all three on symmetry.**

## 4. Acceptance — proven, not asserted

1. **The fence in §0 holds.** Run it, paste it, do not restate it.
2. **The trap reproduced BEFORE the fix**, in a real browser, with `L` undefined —
   overlay present, CLOSE inert, console unreachable.
3. **The same case after the fix**: toast shown, no overlay, **every console button
   still responds** — hit-tested with `elementFromPoint`, not measured. *(`PUP-WO-0200`
   found that asserting "the overlay is gone" misses a body-level node left behind;
   assert the child can REACH THE CONSOLE.)*
4. **The Map still works when Leaflet IS present.** The guard must not refuse the
   normal case — demonstrate the panel opening and closing normally.
5. **§3.2 answered**: the sticky toast either fixed for this path or explicitly not,
   with the reason.
6. **§3.3 answered**: for each of `openCanvas` and `openCamera`, a named reachable
   trigger or an explicit statement that none was found and the opener is untouched.
7. **A check that would have caught this.** The trap is invisible to CI today because
   `check-load` blocks the CDNs, so **every CI run loads with `L` undefined and passes
   green without ever clicking a panel.** A check that opens the panel with `L`
   undefined and asserts the console is still reachable — demonstrated **red** against
   the unguarded `index.html`.
8. **Every demonstration asserts the commit and the failing step name.**

## 5. Scope fence — NOT in this work order

- **Removing the CDN loads** — `PUP-WO-0600`, which is **defined in `docs/roadmap.md`
  P6 and has no work-order file of its own** (checked, rather than assumed — this
  section would otherwise be member 4 inside the work order about member 4).
  **THE OVERLAP IS RESOLVED HERE:** P6's text claims *"Offline integrity and the
  un-closable overlay… two defects with one root"* and prescribes both the vendoring
  **and** wiring the CLOSE listener — so it claims this defect too, and its own
  citations (`:1361`, `:1368`, `:1550`) are the stale ones §1 measures.
  **0106 guards the symptom; 0600 removes the cause.**
  Both are wanted — vendoring Leaflet makes `L` reliably defined, and a guard is still
  correct for the evicted-under-quota case, which vendoring does not eliminate.
- **The sticky toast on the other two gates** (§3.2).
- **The games host and picker** — `PUP-WO-0200` (done) and `0201`. Their back
  affordance is already wired before `mount()`; this is the *pre-existing* openers.
- **`sw.js`, quota, tiles** — `PUP-WO-0108` and the parked tiles question.

## 6. Adversarial pass

Black-box, fresh subagent. **Freeze protocol, current form (architecture §5):**
`git archive` for a read-only pass — no `.git`, so committing is inexpressible;
`git clone` when git-dependent checks must run; **never `cp -r` of a worktree.**
Record SHA-256 at freeze, re-verify at disposition, **and read the feedback file as a
deliverable, measuring its claims** (§6.1 member 5).

Probes:

- **Strand the child anyway.** Another path into a full-bleed node with no exit.
- **Make the guard refuse a working Map** — a partially-loaded Leaflet where `L` is
  defined but `L.map` is not, a Leaflet that throws *after* `L.map` succeeds.
- **Defeat §4.7's check** — make it pass with the trap present.
- **Ask what the fix refuses** (§3.2), and check the answer against the tree.

## 7. Flag-and-stop

- **Any need to touch `sw.js`**, `manifest.json`, an icon, or `games/` (§0).
- **The guard unable to distinguish "Leaflet missing" from "Leaflet broken"** — say
  so; a guard that half-fires is worse than one that states its limit.
- **§4.7's check proving unbuildable** — a ruling, not a limit to declare.
- A second adversarial pass finding serious defects.

## 8. Provenance

Written by CC-A 2026-09-02 while `PUP-WO-0300` was being built, from a defect
`PUP-WO-0000` §1.6 found on day one and scheduled to P6. **What moved it forward was
CC-B's quota connection** — eviction makes `L` undefined on a device that had it
yesterday, so the trigger is ordinary rather than exotic — and *a new trigger for a
known defect is a new decision, not a duplicate finding* (architecture §6.1).

**§1 is the reason this work order took the shape it did.** Writing it required
opening `PUP-WO-0000` §1.6, whose three line citations had all gone stale under
`PUP-WO-0200`'s +296 lines. **The document that records the trap could no longer point
at it.** That is member 4 landing on the project's own founding findings file, and it
is why every reference here is a symbol.
