# PupPad — Roadmap

**Status:** ratified · 2026-08-31 · Scotty + Claude (chat architect)
**Gate:** Scotty ratifies phases and exit gates. CC-A selects work orders from this
document and nowhere else.
**Supersedes:** nothing — first roadmap.
**Read first:** `docs/northstar.md` (invariants, cited by number below), then
`docs/architecture.md` (shape and rulings).

---

## 1. How this document works

Phases are **dependency-ordered, not calendar-ordered**. No dates are assigned,
because a build done in whatever hours are available should be measured by gate
completion, not by a schedule that will be wrong.

Every phase carries a goal, its dependencies, its work orders, and an **exit gate**
that someone who was not in the room could run and get an unambiguous yes or no.
Every phase ends at a working, more-capable system.

**"What do I build next" is answered from here**: the first work order in the
earliest phase whose dependencies are green and whose gate has not passed. Never
from a parallel task list, tracker, or state file.

## 2. Work-order numbering

**PREFIX: `PUP`.** Scheme is defined in the `repo-genesis` skill §6 and is not
restated here: `PUP-WO-PSNN[a]` — phase, subsection, order, optional refinement
suffix.

**No legacy ids exist.** This repository had no work orders before 2026-08-31, so
the scheme applies from `PUP-WO-0000` with nothing to reconcile. Ids are never
renumbered once issued.

## 3. Critical path

```
P0 investigate ──▶ P1 firebreak+CI ──┬──▶ P6 shipped-app remediation   [run first]
                                     │
                                     └──▶ P2 games shell ──┬──▶ P3 Gyre
                                                           └──▶ P4 Block Pop
                                                                     │
                                                            P5 co-op (deferred)
```

**P6 is numbered last and runs early.** Phases are dependency-ordered (§1) and ids
are never renumbered (§2), so a phase discovered after P5 was named appends as P6
even though it runs before P2. The diagram is the authority on order; the number is
only a label. **P6 is prioritised ahead of P2**: it fixes defects on the tablet
Buddy uses today, and P2 adds a feature.

**Where risk concentrates: P1.** Not because it is hard, but because everything
after it merges against a firebreak P1 builds. Until P1's gate passes, a merge to
`main` reaches Buddy's tablet (architecture §3.1). P1 is the phase to over-review.

**P3 and P4 run in parallel** once P2's registry contract is fixed. They share no
code by design — that is what invariant 6 buys.

**Human-track work, which is the most likely thing to block delivery while everyone
stares at code:**

- **Scotty flips Pages from `legacy` to GitHub Actions build type**, and later
  points Pages at the workflow. The Precision's `gh` is read-only and cannot
  (architecture §3). **P1 cannot complete without this.**
- **Scotty creates the `stable` branch** and performs every promotion to it.
- **Scotty subscribes both ntfy topics** and confirms the decision tier is audibly
  distinct from the info tier.
- **Scotty installs the `/stable/` copy** on Buddy's tablet as the home-screen icon
  and the root copy on the test device.
- **Scotty rules on the open questions** in architecture §10.

## 4. Phase map

| Phase | Goal | Ends at |
|---|---|---|
| **P0** | Understand the ground before changing it | A findings document, no behaviour change |
| **P1** | Rebuild the firebreak and add a check that can go red | Merges no longer reach Buddy |
| **P2** | The games surface exists and is extensible | Games button opens a picker with one placeholder |
| **P3** | Gyre is playable from the pad | Buddy can open and drive the particle field |
| **P4** | Block Pop is playable from the pad | Buddy can play both board sizes |
| **P5** | Co-op — deferred, not scoped | — |
| **P6** | Fix what P0 found in the shipped app | Buddy's console works offline and contains its own adult surfaces |

---

## P0 — Investigation and seam assessment

**Goal.** Establish what is actually in the three codebases and where the seams
fall, before any of it is changed.

**Depends on:** nothing.

**Work orders:**

- **`PUP-WO-0000` — Initial state and seam investigation.** An *investigative*
  work order: no feature code. Read `index.html` end to end and report the panel
  lifecycle contract, the click router, the state shape, the sound bank, and the
  PIN/lock behaviour. Read both Grok workspaces and report which files are pure
  logic (portable as-is), which are React rendering (must be rewritten), and which
  are scaffolding (discarded). Propose the concrete registry entry shape and the
  game-module contract that architecture §4 describes in the abstract. Record
  anything that contradicts `docs/architecture.md` §3 — **that contradiction is the
  most valuable output of this phase**, and it goes to the architecture as an
  amendment, not into a build.

**Exit gate.** `docs/findings/PUP-WO-0000.md` exists on `main` and answers, in
terms a work order can cite: (a) the exact function signature a game module must
export; (b) the exact registry entry fields; (c) a file-by-file disposition of both
Grok workspaces marked port / rewrite / discard; (d) a list of contradictions found
against architecture §3, which may be empty but must be explicitly stated as empty.
`git diff main --stat` for this work order shows changes under `docs/` only.

**Gate status: PASSED**, 2026-09-01, merged at `1690617`. All four answered — (a)
findings §8.1, (b) §9.1, (c) §7 with 487 files reconciled against an independent
`find`, (d) §10 with three contradictions, not empty. Diff was `docs/` only and the
protected surfaces diffed to empty. Reviewed by CC-A against `PUP-WO-0000` §3;
citations spot-checked at source rather than accepted.

---

## P1 — Firebreak and CI

**Goal.** Make merge stop meaning deploy, and add one check that can fail without
being persuaded.

**Depends on:** P0.

**Work orders:**

- **`PUP-WO-0100` — CI workflow.** A GitHub Actions workflow that, on every push
  and pull request: parses every `.js` and the inline script of `index.html` for
  syntax validity; asserts every local asset referenced by `index.html` appears in
  `sw.js`'s `urlsToCache`; asserts `CACHE_NAME` changed when any cached asset
  changed; and runs a headless load that opens the console and fails on any console
  error.
- **`PUP-WO-0101` — Two-path publication.** Extend the workflow to publish `main`
  to the site root and `stable` to `/stable/`. Namespace `CACHE_NAME` per deploy
  path and assert in CI that the two differ.

**Exit gate.** All four must hold:
1. A pull request with a deliberate syntax error in `index.html` shows CI **red**.
2. A pull request adding an asset without adding it to `urlsToCache` shows CI
   **red**. *(Both prove the rejection, not the issuance — a check nobody has
   watched go red is indistinguishable from one that cannot.)*
3. `curl -sI https://ikthys777.github.io/PupPad/stable/` returns 200, and the
   commit it serves differs from the one at the site root after a merge to `main`
   with no promotion. *(Falsifies northstar invariant 4.)*
4. With both paths loaded and cached, `caches.keys()` in each shows disjoint names,
   **and — the part that actually matters — after force-activating the root service
   worker, the `/stable/` cache still exists.** `caches.keys()` is origin-scoped, so
   the reap must be prefix-bounded or the two paths delete each other (architecture
   §6). *(Falsifies northstar invariants 3 and 7.)*

---

## P2 — Games shell

**Goal.** The games surface exists, is reachable, and accepts new games as data.

**Depends on:** P1. **Nothing merges into a live path before the firebreak holds** —
with the bootstrap exception in `docs/architecture.md` §6, which is what permits P0
and P1 themselves to merge. From P2 onward the rule applies without exception.

**Work orders:**

- **`PUP-WO-0200` — Button swap and registry.** Replace `id:7` Power with Games in
  `BTNS_RIGHT`; reassign the `powerUp` sound to games-open. Add the registry array
  and the game-module contract from `PUP-WO-0000`'s findings.
- **`PUP-WO-0201` — Picker overlay.** A full-screen overlay following the existing
  `openX()`/`closeX()` panel pattern. Large tiles, one per registry entry, each
  carrying an icon **and** its word. Renders from the registry with no knowledge of
  any specific game. Ships with one trivial placeholder game proving the contract.

**Exit gate.**
1. No reference to a Power button remains: `grep -ri power index.html` returns only
   the sound-bank definition.
2. Adding a second placeholder game to the picker requires changes to exactly three
   things — its own module, one registry entry, one `urlsToCache` line — verified by
   `git diff --stat`. *(Falsifies northstar invariant 6.)*
3. With all text covered in a screenshot of the picker, a person who has not seen
   the app can state what each tile does. *(Falsifies northstar invariant 1.)*
4. Airplane mode, cold start, open picker, open placeholder game, return to console
   — all succeed. *(Falsifies northstar invariant 3.)*
5. Cold-start time to interactive console is recorded on the test device as a
   baseline number. **Threshold is architecture §10's open question**; this gate
   requires the measurement, not a verdict.

---

## P3 — Gyre

**Goal.** Buddy can open the particle field and drive it.

**Depends on:** P2.

**Work orders:**

- **`PUP-WO-0300` — Simulation port.** Port `sim.ts`, `palettes.ts`, and
  `backgrounds.ts` to vanilla. Replace the Zustand store with a plain state object.
  Keep `localStorage` persistence.
- **`PUP-WO-0301` — Controls and additions.** Port the slider surface to PupPad's
  theme. Add attract/repel and randomize (architecture §5). Sliders must be
  operable by a non-reader.

**Exit gate.**
1. Every slider in the source's control set is present and changes the field
   visibly within one second of being dragged.
2. Randomize produces a visibly different field on each of five consecutive taps.
3. Attract/repel visibly inverts particle behaviour.
4. Settings survive a full app restart.
5. There is no reachable state from which returning to the console takes more than
   one tap. *(Falsifies northstar invariant 5.)*
6. Airplane mode, cold start, play, return — succeeds.

---

## P4 — Block Pop

**Goal.** Buddy can play both board sizes, with no fail state that ends play.

**Depends on:** P2. Runs in parallel with P3.

**Work orders:**

- **`PUP-WO-0400` — Engine port.** Port `engine.ts`, `pieces.ts`, `types.ts` to
  vanilla. **All board mutation flows through one reducer taking
  `{playerId, action}`; trays are an array keyed by player** — architecture §7
  seams 1–3, installed now because retrofitting them later is expensive.
- **`PUP-WO-0401` — Board and tray UI.** Render in PupPad's theme: dark radar
  field, paw-and-label header matching the existing panels, pieces recoloured to
  the console's button glow palette, `doSound()` in place of the source's own audio.
- **`PUP-WO-0402` — Modes and end state.** Both `easy` 6×6 and `classic` 8×8.
  Soften game-over to a single play-again affordance.

**Exit gate.**
1. Both board sizes playable start to finish.
2. Reaching a no-moves state presents exactly one control, and tapping it starts a
   new game. *(Falsifies northstar invariant 5.)*
3. `players: 2` can be set on a tray array in a scratch branch and the engine
   accepts a second player's action without engine changes. *(Proves architecture
   §7 seams, without building co-op.)*
4. With all text covered, the board and tray are operable. *(Northstar invariant 1.)*
5. Airplane mode, cold start, play, return — succeeds.

---

## P5 — Realtime co-op

**Deferred, and deliberately not scoped to work-order level.** Pre-writing distant
phases in work-order detail is the most common way a roadmap goes stale on the day
it is written.

**Intent** is recorded in architecture §7, including the four seams P4 installs.

**The spike that will shape it:** local two-player on one tablet, built first, on
`classic`. If the shared-board experience does not work with two people at one
screen and zero network, the networked version will not work either — and the spike
costs a fraction of what the network layer does.

**Not started until P3 and P4 gates pass.**

---

## P6 — Shipped-app remediation

**Goal.** Fix the defects `PUP-WO-0000` found in PupPad as it stands today. None of
these are games work; all of them reach the tablet Buddy already uses.

**Depends on:** P1, and hard. **These fixes touch `index.html`, which Pages serves
from `main:/`.** Architecture §6's bootstrap exception covers `docs/` and
`.github/` — paths Pages does not serve — and covers nothing else. Merging a P6
work order before P1's gate passes publishes it straight to Buddy's tablet with no
firebreak, which is the exact failure P1 exists to build against.

**Runs parallel to:** P2–P4, and **ahead of P2 in priority.**

### Why this is a phase and not extra work orders inside P1 or P2

Stated because folding it into either was the obvious move and both are wrong.

- **Not P1.** P1's merges are safe *only* on the narrow property that their diffs
  avoid the served paths. A P6 diff cannot have that property — changing
  `index.html` is the point. Putting these in P1 would mean merging live app
  changes during the one phase where no firebreak exists.
- **Not P2.** P2 is the games shell. A phase whose exit gate mixes "the picker
  renders from the registry" with "the map no longer traps a child" is a gate that
  no longer means one thing.
- **Not renumbered in.** §2 and `repo-genesis` forbid renumbering issued ids, so
  this appends as P6 and the critical path in §3 carries the real order.

**Work orders:**

- **`PUP-WO-0600` — Offline integrity and the un-closable overlay.** Two defects
  with one root. (a) `index.html:11-13` load Supabase and Leaflet from two
  third-party CDNs and are absent from `urlsToCache`, so they exist offline only as
  runtime cache — which `sw.js:19-29` reaps on every `CACHE_NAME` change. (b) When
  `L` is undefined, `openTreasureMap()` appends its full-bleed overlay at
  `index.html:1361`, throws at `:1368`, and never reaches the CLOSE listener at
  `:1550`. There are **zero** `window` or `document` event listeners in the file, so
  nothing can dismiss it: **recovery requires killing the app.** So a version bump,
  then an offline tap on Map, traps a three-year-old — northstar invariants 3 and 5,
  on his own tablet. Vendor the third-party assets into `urlsToCache`, and wire
  every panel's back affordance **before** the work that can throw.
  **Blocked on** architecture §10's northstar §5 ruling for the vendoring half; the
  overlay half is not blocked and may ship first.
- **`PUP-WO-0601` — Adult surfaces.** Settings is bound unconditionally
  (`index.html:1736-1737`) and renders the Supabase anon key into a cleartext input
  (`:1818`), persisted at `:173`. Architecture §3.1 is explicit that the lock
  contains nothing, so "locked" is not containment and must not be presented as it.
  **Blocked on** architecture §10's ruling on intended containment.

**Exit gate.**
1. Airplane mode, cold start on a device whose cache has been cleared, then open
   every panel including Map. All open and all close. *(Northstar invariants 3, 5.)*
2. Bump `CACHE_NAME`, reload online once, go offline, tap Map. It opens, or it
   declines to open — it does not appear and refuse to close. *(Invariant 5.)*
3. `grep -n "https://" index.html` returns no `<script>` or `<link>` fetching
   executable code or stylesheets from a third-party origin. *(Northstar §5, once
   ruled.)*
4. Every panel's CLOSE affordance is wired before any call that can throw, verified
   by reading the three openers. *(Structural, per `PUP-WO-0000` §1.6 — the trap is
   not Leaflet-specific and all three openers have its shape.)*
5. No credential renders into the DOM in a state reachable without an adult action
   whose containment is specified.

## 5. Standing cadence

- **Every phase boundary: audit the numbering and the documents.** Has anything
  been dropped? Has any ratified change reached the code but not these documents?
  This is cheap here and expensive at launch — it is the failure mode that most
  reliably goes unnoticed, because nothing announces it.
- **Every work order: the builder's `FEEDBACK.md` is read for findings that belong
  upward** — a superseded ruling becomes an architecture amendment, a changed
  constraint goes to the northstar and is re-ratified, an uncheckable gate is fixed
  here by amendment.
- **Every work order, builder's first act:** `git fetch origin && git checkout -B
  <wo-branch> origin/main`. The builder syncs its own tree — nobody reaches into it,
  because one writer per tree is what keeps a running session's working state sound.
- **Every work order boundary, architect:** pull the fresh HEAD of `main` before
  reviewing or authoring. Reviewing against a stale tree is how a merged change gets
  reviewed twice, or missed once.
- **Every work order boundary: an unconditional heartbeat** on the info topic,
  whether or not anything needs attention. Silence must mean stopped, never still
  going.

## 6. Reconciliation

Nothing built yet. This table opens at the first divergence between what was
planned and what was built; history is left as written and never renumbered.

| Number as built | What it actually was | What this roadmap planned |
|---|---|---|
| `PUP-WO-0000` | As planned. Produced both specifications, plus three contradictions against architecture §3 and seven load-bearing defects from its own adversarial pass. | As planned. |
| **P6 (new)** | A phase that did not exist when this roadmap was written. | Nothing. P0 was scoped to *find* contradictions against architecture §3; it also found defects in the shipped app that belong to no planned phase. The roadmap had no home for "fix what the investigation found," which is a gap in the roadmap rather than in the investigation. |

## 7. Amendments

| Date | Change | Reason |
|---|---|---|
| 2026-08-31 | Document created. | First roadmap; also the first dual-CC pilot, so CC-A needs a sequencing authority that is not a conversation. |
| 2026-08-31 | P2's live-path rule gains an explicit bootstrap exception; standing cadence gains the per-work-order sync rules for both sessions. | The rule as written was violated by P0 and P1 by necessity — found by CC-A on its first read, before any dispatch. The sync rules close a gap where no party owned keeping the builder's tree current. |
| 2026-09-01 | **P6 added** — shipped-app remediation, depending on P1, running parallel to P2–P4 and prioritised ahead of P2. §3's critical path and §4's phase map updated; reconciliation opened. | `PUP-WO-0000` found two defects in the app as it stands — three unconditional third-party CDN loads, and an un-closable full-screen overlay reachable offline — that belong to no planned phase. They cannot go in P1 (their diffs touch a served path, and P1 is the phase with no firebreak) and must not go in P2 (a games phase whose gate would then mean two things). Recorded as a phase rather than folded, so the decision is visible and reviewable. |
| 2026-09-01 | P1 gate item 3's prove-it-red requirement is extended by `PUP-WO-0100` §3.3 from two checks to all four. | `PUP-WO-0000`'s lesson, generalised: its module contract passed a demonstration against both games in hand while still holding two defects, because neither game exercised them. A check demonstrated red on the two cases its gate names is the same shape of insufficient proof. |

## 8. Provenance

Written by Claude (chat architect) with Scotty, 2026-08-31, from the same planning
session as the northstar and architecture. P0 is staged as an investigative work
order at Scotty's direction, so CC-A opens the loop with an assessment rather than
a build. Exit gates for P1 and P2 are drawn from the falsification column of
`docs/northstar.md` §4.
