# PUP-WO-0300 — Gyre's engine, ported to vanilla and given room to grow

**Repo:** ikthys777/PupPad · **Base:** `main` (**verify live HEAD**).
**Branch:** `build/wo-0300`.
**Author:** CC-A · **Builder:** to be assigned.
**Phase:** P3 · **Phase exit gate:** `docs/roadmap.md` P3, items 1–5.
**Depends on:** `PUP-WO-0200` merged (the registry and the module contract exist).
**Grounds:** `docs/northstar.md` invariants 1, 3, 5, 6 · `docs/architecture.md` §4, §5 ·
`docs/roadmap.md` P3 · `docs/findings/PUP-WO-0000.md` §8, §9 ·
`~/PupPad-sources/gyre/src/components/field/`.

> **What this is:** the particle engine becomes a PupPad game module — `sim.ts`,
> `palettes.ts`, `backgrounds.ts` and the Zustand store ported to vanilla, plus
> `api.tone`, plus **deliberate additions**. It is **NOT** the control surface
> (`PUP-WO-0301`), not the picker (`PUP-WO-0201`), and not multiplayer.

**Cadence:** build. One PR **opened at park**, left unmerged for review.

**First act:** `git fetch origin && git checkout -B build/wo-0300 origin/main`.

---

## 0. THE FENCE — stated ONCE, here, and pointed at from everywhere else

*Every other section refers to this block by name and **must not restate it**. Four
work orders in a row contradicted themselves because a fence was written in §2 and
restated in an acceptance criterion, and the two drifted the moment either changed —
`PUP-WO-0102` §2/§3.1, `PUP-WO-0105` §0a.4/§3.1, `PUP-WO-0200` §2/§3.1, and roadmap P2
gate 1. Three of the four were CC-A's. **One canonical statement, referenced.**

**MAY change:** `games/`, `index.html`, `sw.js` (**`urlsToCache` entries only**),
`.github/`, `docs/`.
**MUST diff to empty:** `manifest.json`, both icons.
**`CACHE_VERSION` stays `v17`** unless check 3's refined rule requires otherwise —
and if it does, that is a **flag-and-stop**, not a bump (see §7).

**The gate CC-A runs at merge is exactly this block**, pasted into the merge commit.

## 1. This is the first REAL game, and that makes two things true at once

**Gate 2 gets its real test here.** Roadmap P2 gate 2 says adding a game touches
**exactly three things — its own module, one registry entry, one `urlsToCache` line.**
`PUP-WO-0200` demonstrated that with a throwaway and **the throwaway did not ship**
(ruled 2026-09-02: one placeholder is what the contract needs; a second dead tile is a
control that lies, which is invariant 1's problem). So the registry has **one** entry
today and Gyre is the **second** — and it is the first entry whose cost is real.

**If Gyre needs a fourth thing, invariant 6 is falsified by the first real game.**
That is a finding and a flag-and-stop (§7), not something to absorb. **Count it and
report the count** whether it is three or not.

**And the engine is where the latitude lives.** See §3.

## 2. Scope

### 2.1 FIRST: `api.tone` — ratified 2026-09-01, never built

*Same shape as `PUP-WO-0200` §1.1, and the fourth instance of it: a ruling this
project made and never turned into a commit.*

`docs/architecture.md` §5 ratifies **`api.tone(hz, ms, wave)`** as part of the module
contract, with the reasoning that the twelve-cue bank offers no pitch and no duration,
so a xylophone or a lullaby is **inexpressible**. **Verified 2026-09-02: `grep -c tone
index.html` returns 0.** It does not exist.

**Cost, already measured and corrected by CC-A:** `mk()` and `sw()` are declared
*inside* `doSound`'s try block (`index.html:62-68`, `:69-75`), not at module scope, so
the real cost is **lifting both out and adding one function** — not one line, and not
a rewrite either.

Build it, add it to the `api` object the shell hands a module, and **make Gyre use
it** — a particle toy where a tap makes a pitch is delight per tap for a child who
cannot read, which is the whole point of §3.

### 2.2 The engine port

From `~/PupPad-sources/gyre/src/components/field/`:

- **`sim.ts` (322 lines)** — the substance. Near 1:1; it is already framework-free
  apart from its typing.
- **`palettes.ts`**, **`backgrounds.ts`** — six entries each today. See §3.
- **`store.ts` (169 lines)** — **replace Zustand with a plain state object.** Keep
  `localStorage` persistence, but through **`api.save`/`api.load`**, which are
  namespaced by `api.entry.id` and never throw (`PUP-WO-0000` §8.3). **`api.load()`
  may return `null` and the game must run correctly when it does.**
- **Parameters, from `store.ts`:** `count` (250–5000), `force` (0.15–1.85), `burst`,
  `tail`, `size`, `linger`, plus `palette` and `background`.

**`particle-canvas.tsx` and `field-app.tsx` are React rendering** — their *structure*
ports, their *framework* does not. Build DOM directly or with HTML-string builders in
the shell's existing style. **`controls.tsx` (359 lines) is `PUP-WO-0301`'s** — but
see §3, because what the controls will *expose* is decided here.

### 2.3 The contract

`mount(host, api)` returning `teardown`, per `PUP-WO-0000` §8.1, **deferred to and not
restated**. The two that will bite a canvas game:

- **`teardown` must cancel the `requestAnimationFrame` loop.** After it returns the
  module holds no live rAF, listener, timer or observer. A particle sim that keeps
  animating after teardown is the leak the returned-closure design exists to prevent.
- **The back affordance is wired BEFORE `mount()` is called** — `PUP-WO-0200` §3.4,
  already built in the shell. **Do not add a second close path.** `api.close()`
  delegates to the shell's single `endGameSession()`.

## 3. THE LATITUDE — additions are WANTED, NOT TOLERATED

**This section is a direction from Scotty and it inverts the usual instruction.**

**Buddy's actual engagement with Gyre is the sliders — he likes seeing what each one
changes.** So this is not a fidelity exercise. **Where you would normally trim scope
for tidiness, do not.** Improve on the foundation rather than reproducing it. A
three-year-old's toy is judged on delight, and delight is the requirement.

**The two highest-value additions, both named by Scotty, and both ENGINE-side:**

1. **Attract/repel flip.** *The largest visible change available from a single
   control.* In `sim.ts` this is a sign on the force term. Build the mechanism here;
   `PUP-WO-0301` puts a control on it.
2. **Randomize everything.** *The highest joy-per-tap control available to a
   non-reader* — no reading, no aiming, and a completely different world every press.
   Build the state operation here; 0301 puts the button on it. **It must randomise
   across the whole parameter set including palette and background**, and every
   result must be a *usable* field — no all-black, no zero particles.

**More colour, everywhere.** Six palettes and six backgrounds today. **Add more, and
add colour anywhere that can reasonably take it** — particle colour, trails,
background gradients. Colour is the one dimension a non-reader reads immediately, so
it carries invariant 1 better than any label could.

**Anything else you think a three-year-old would delight in, build it and say why.**
Latitude granted explicitly so you do not have to ask.

**What the latitude does NOT relax** — these are the non-negotiables and they are
*why* the latitude is safe to grant:

- **Invariant 1** — every control operable by a non-reader. An addition that needs
  reading is not an addition.
- **Invariant 3** — strictly offline. **No `fetch`, no CDN, no remote font, no
  network of any kind.** `check-games-offline` will red on it, and that check exists
  precisely because §8.3's `api` shape is a convention and only CI is enforcement.
- **Invariant 5** — always one tap back, from every state including mid-animation.
- **The contract** (§2.3), including the `api.entry.params` channel.
- **Performance.** More particles and more colour cost frames. `PUP-WO-0200` committed
  `measure-coldstart.mjs`; **record a frame-rate number for your defaults on a real
  device budget and say what you traded.** A field that stutters is not delightful.

## 4. Acceptance — proven, not asserted

1. **The fence in §0 holds.** Run it and paste the output; do not restate it.
2. **Gate 2 counted.** `git diff --stat` for the Gyre addition alone, with the number
   of things touched stated. Three is the expectation; anything else is §7.
3. **`api.tone` demonstrated** — a tone at two different pitches and two durations,
   and the twelve-cue bank still working unchanged.
4. **Every parameter changes the field visibly within one second** (roadmap P3 gate 1),
   demonstrated per parameter, not as a class.
5. **Randomize: five consecutive taps, five visibly different fields, all usable**
   (roadmap P3 gate 2). **Attract/repel visibly inverts** (gate 3).
6. **Settings survive a full app restart** (gate 4) — and **survive `api.load()`
   returning `null`**, which is the case that actually breaks first.
7. **`teardown` leaves nothing running.** Mount, run, tear down, and show the rAF
   loop stopped and no listener left — measured, not asserted.
8. **Offline cold start**: airplane mode, console → games → Gyre → play → back.
9. **A frame-rate number** for the shipped defaults, with the trade stated (§3).
10. **Every demonstration asserts the commit and the failing step name**
    (architecture §5).

## 5. Scope fence — NOT in this work order

- **The control surface** — `controls.tsx`, sliders, the randomize *button*, the
  attract/repel *control*. `PUP-WO-0301`. **You build the mechanisms; it builds the
  controls.** Say in your feedback what each mechanism needs exposed.
- **The picker overlay** — `PUP-WO-0201`.
- **Multiplayer / `p2p.ts`** — architecture §7, deferred with intent.
- **Auth, server, db, preview-host-bridge** — none of it comes across. Gyre's repo
  carries 3,880 lines and **this work order touches roughly 900 of them.**
- **Parked behind P2/P3:** `PUP-WO-0104`, `0106`, `0108`, the tiles question, the
  CSP/iframe question, and `check-assets` being blind to module-referenced assets —
  **which becomes load-bearing here if Gyre ships any asset file** (§7).

## 6. Adversarial pass

Black-box, fresh subagent, artifact and ground truth only.

**FREEZE PROTOCOL — CHANGED 2026-09-02, and the change is the point.** The previous
protocol said "copy the tree with `cp -r` and treat it as read-only." **In a worktree
`.git` is a POINTER FILE**, so `cp -r` copies the pointer and the copy writes to the
**real repository** — which is exactly what happened on `PUP-WO-0200`, where a lens
committed on top of the frozen HEAD and reset it. The instruction was a **convention
with nothing enforcing it**.

- **A read-only pass gets a `git archive` export** — a tree with **no `.git` at all**,
  so committing is *inexpressible* rather than merely forbidden.
- **A pass that must run git-dependent checks gets a `git clone`.** Not a worktree: a
  worktree **shares the object store**.
- **Never `cp -r` of a worktree.**

Record the SHA-256 of every deliverable at freeze, re-verify and paste at disposition,
**and read the feedback file itself as a deliverable**, measuring its claims against
the tree.

Probes:

- **Reach the network from the module.** The standing one, and `check-games-offline`
  is a cost-raiser and not a sandbox by its own verdict.
- **Leave something running after `teardown`.** rAF, listener, timer, observer.
- **Make randomize produce an unusable field.** All-black, zero particles, a force
  that flings everything off-canvas in one frame.
- **Trap the child.** Any state where back takes more than one tap, mid-animation
  included.
- **Ask of every addition: what does it now refuse?** More particles cost frames;
  more colour costs contrast. Name the trade.

## 7. Flag-and-stop

- **Gate 2 needing a fourth thing.** Invariant 6 falsified by the first real game is
  an architecture decision, not a build step.
- **Any need to bump `CACHE_VERSION`** (§0). Check 3's refined rule should not require
  it for an added entry; if it does, the rule or the change is wrong.
- **Any need to touch `manifest.json` or an icon.**
- **Gyre shipping an asset file** — `check-assets` cannot see an asset referenced only
  from a game module, so a cold offline device would show a broken image with CI
  green. Vendor it into `urlsToCache` **and say so loudly**, or do without.
- **An addition that cannot be made operable by a non-reader.** Better none than one
  that needs reading.
- **A second adversarial pass finding serious defects.**

## 8. Provenance

Written by CC-A 2026-09-02, immediately after `PUP-WO-0200` merged at `2379320` and
the two-path publication was observed holding on a real change — root at `2379320`
with the Games button, `/stable/` still at `80bc634` with none.

**§3's latitude is Scotty's direction, stated in his terms and not softened.** Eleven
work orders produced a firebreak, a publication path and a button; this is the first
one whose output a child is meant to *enjoy*. **§2.1 is the fourth instance of a
ratified ruling that never became a commit** — after `PUP-WO-0200` §1.1's `games/`
grep check, architecture §6.4's cache gate, and `PUP-WO-0105`'s stripped test
artifacts. **§0 is the structural fix for the four self-contradicting fences**, three
of which were CC-A's: one canonical statement, referenced and never restated.
