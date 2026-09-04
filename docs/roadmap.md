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
- **Scotty creates the `stable` branch** and performs every promotion to it —
  **verified possible**, not assumed: `Protect-stable` bypasses repository admin at
  `bypass_mode: always` while refusing installation tokens (`GH013`, `stable`
  unmoved). Rollback is the same authority in reverse, which is why
  `PUP-WO-0103`'s workflow lever was removed rather than hardened. See
  `docs/architecture.md` §6.2.

  **THE PROMOTION PROCEDURE HAS TWO STEPS, AND THE SECOND IS REQUIRED.**

  1. Push `refs/heads/stable` to the commit being promoted.
  2. **Verify it landed:**
     ```sh
     curl -s https://ikthys777.github.io/PupPad/stable/build-stamp.json
     ```
     and confirm `.sha` is the commit you just pushed. *(`curl -s`, not `-sI`:
     `-I` is `--head` and returns no body.)*

  **STEP 2 DOES NOT WORK UNTIL THE PAGES FLIP IS DONE, AND THAT IS THE POINT AT WHICH
  IT STARTS MATTERING.** Measured 2026-09-01: this repository's Pages source is still
  `build_type: legacy`, publishing `main:/` by branch, so there is no `publish` job in
  the live workflow and `/PupPad/stable/build-stamp.json` returns **404** — which reads
  exactly like *"my promotion did not land."* Until the flip, a 404 there means the
  two-copy pipeline is not deployed yet; it is not evidence about any promotion. After
  the flip it is the mechanism below. Note also `cache-control: max-age=600` on that
  origin: within ten minutes of a promotion the stamp can still be the previous one, so
  re-fetch rather than concluding the promotion failed.

  **Step 2 is not a formality and a green run is not a substitute for it.**
  `pages-publish` and `pages-deploy` are each a single concurrency group, and GitHub
  keeps only ONE PENDING RUN per group — a newly queued run evicts an already-pending
  one regardless of `cancel-in-progress`. A promotion's publish or deploy job evicted
  **while pending** never gets a runner, so it emits no annotation, no failure, and no
  log line anywhere: the promotion silently does not land, and the push that caused it
  shows no error. The stamp reports the sha actually **served**, so it catches that
  whatever ate it — including eviction paths nobody has enumerated. Serialise-and-
  never-drop is not obtainable from `concurrency:` at all (`ci.yml`, both blocks);
  redesigning the publication model is a work order behind P2. **Until then this curl
  is the mechanism, not a suggestion — absence of an error is not evidence that a
  promotion landed.**
- **Every human-track item above is an instruction, and gets the same
  satisfiability test a work order gets** before it is relied on (architecture §5).
  Test it with an instrument that could return the *other* answer: a dry run and a
  response missing a field can each only confirm what you already believed.
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
`git fetch origin && git diff origin/main --stat` for this work order shows changes
under `docs/` only. *(Form corrected 2026-09-01 per §5 — a local `main` ref is not
fast-forwarded and this gate would have measured against a stale base. The gate's
substance is unchanged and its PASS below stands: it was verified against
`origin/main` at review time.)*

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
- **`PUP-WO-0101` — Two-path publication.** ~~Extend the workflow to publish `main`
  to the site root and `stable` to `/stable/`. Namespace `CACHE_NAME` per deploy
  path and assert in CI that the two differ.~~ **SUPERSEDED 2026-09-01 by
  `PUP-WO-0102` + `PUP-WO-0103`** after two adversarial passes each found serious
  defects. Not renumbered; the document stands on `main` as written. See §6.
- **`PUP-WO-0102` — Cache correctness in `sw.js`.** A worker touches only what it
  owns: prefix-bounded reap, the offline read scoped to its own cache
  (architecture §6.1), the legacy cache removed by exact literal string, and
  `/stable/` requests declined. **The only half that reaches Buddy's tablet.**
- **`PUP-WO-0103` — Two-path publication.** `main` at the root, `stable` at
  `/stable/`, from one deployment. Invariant 4 verified against the published
  **bytes**; every copy checked in the run that publishes it; publication refuses a
  copy whose worker is not prefix-bounded. **Touches `.github/` only, so it cannot
  reach Buddy** — which is what makes it safe to iterate against real CI runs.

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
1. **[`PUP-WO-0200` — MET]** No reference to a Power **button** remains: no button label, icon, handler or
   registry entry names Power. The only surviving matches for `grep -ri power
   index.html` are **the sound-bank definition and the deliberate `sound:'powerUp'`
   reassignment** named in `PUP-WO-0200` directly above.
   *(Reworded 2026-09-02. The gate previously required that grep to return **only**
   the sound-bank line — **which cannot be satisfied while obeying the instruction
   directly above it**, since reassigning the `powerUp` sound to games-open
   necessarily puts a second `power` match on the button. The **property** always
   held; the **literal test** could not, so a builder following the roadmap would
   have had to contort the code to make a grep return one line — a test that has
   stopped measuring the property and started measuring itself. Found by CC-B while
   building `PUP-WO-0200`, which refused to contort it and flagged instead. Same
   shape as `PUP-WO-0105` §3.1 and `PUP-WO-0200` §2: **a document forbidding what it
   demands** — fourth instance in two days, and the third of them CC-A's.)*
2. **[`PUP-WO-0201`]** Adding a game requires changes to exactly three things — its
   own module, one registry entry, one `urlsToCache` line — verified by
   `git diff --stat`. *(Falsifies northstar invariant 6.)*
   *(Amended 2026-09-02: **this becomes a CI mutation** rather than a hand-run count —
   `PUP-WO-0201` §2.4. `PUP-WO-0200` demonstrated it with a throwaway module and
   correctly did **not** ship it, which left the evidence living only in a commit
   message — architecture §6.1 **member 5**. The wording also dropped "second
   placeholder", which was never the point: the count is what falsifies invariant 6,
   and `PUP-WO-0300`'s Gyre is the first entry whose cost is real.)*
3. **[`PUP-WO-0201`]** With all text covered in a screenshot of the picker, **a real
   person who has not seen the app** states what each tile does. *(Falsifies northstar
   invariant 1.)*
   *(Amended 2026-09-02: **this gate may not be simulated.** A model predicting what a
   stranger would say is not evidence about a stranger, and invariant 1 is the one the
   northstar calls "the project." No human available means the gate stays **open and
   unrun** — `PUP-WO-0201` §7. The builder's prediction is recorded **before** the
   test, which is what makes the test capable of surprising anyone.)*
4. **[`PUP-WO-0201`]** Airplane mode, cold start, open picker, open a game, return to
   console — all succeed. *(Falsifies northstar invariant 3.)*
   *(Amended 2026-09-02: worded against a picker that did not exist when `PUP-WO-0200`
   ran, so 0200 could not satisfy it and correctly did not claim to. **These are PHASE
   gates spanning both work orders**, not per-work-order acceptance — which is why each
   now names the one that answers it. Flagged by CC-B, which had silently recast this
   gate's sibling and reported doing so; **a gate you cannot satisfy is a flag, never
   an edit.**)*
5. **[`PUP-WO-0200` — instrument committed, device reading outstanding]** Cold-start
   time to interactive console is recorded on the test device as a baseline number.
   `.github/ci/measure-coldstart.mjs` exists and reports a median; **the number this
   gate wants is from the real device and is the operator's to take.** **Threshold is architecture §10's open question**; this gate
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

> ### THE SEAM WAS RE-CUT ON 2026-09-02 — **RATIFIED BY SCOTTY THE SAME DAY**
>
> *("pr recut is fine. no issue.")* **The re-cut stood unratified for three merges
> while CC-A asserted it had been recorded, and it had not — it was in the work order's
> own text and in three commit messages, never in this document.** Left written up
> rather than tidied away, because the failure is the interesting part: the roadmap and
> the work orders described **different things under the same three numbers**, and what
> exposed it was Scotty asking "what do you mean by P4 re-cut"
> exposed, three merges after I claimed it was recorded.
>
> **What changed:** the count is still three; **the seam moved to the playable
> minimum.** The original first work order — a bare engine port — is **unreachable**
> (§8.1 allows one default export and `openGames` is the only mount path, so an engine
> alone cannot be exercised) and **unprovable** (`.github/ci/package.json` carries
> playwright only; there is no unit runner). Two independent analyses rejected it for
> that reason, neither having read this document.
>
> **What makes the split safe** is mechanical: **the registry entry goes last**
> (`check-gate2.mjs:112`), the picker loops `GAMES` only, and check 2 requires a
> `urlsToCache` line only for paths referenced from `index.html`. **A module can land,
> be scanned by CI, and be invisible to the child** — which matters because a merge is
> a deploy.

- **`PUP-WO-0400` — Playable, easy 6×6, end to end.** ✅ **MERGED `e1509f4`.** The
  engine, board, tray, drag and tap, line clear, and a terminal state that resumes in
  one tap. *(`{playerId, action}` and per-player trays are architecture §7 seams 2–3,
  and §7's own cost correction says they are **net new construction, not preservation**
  — deferred to P5, where they are actually needed. Seam 1, no module state, is
  delivered here and is the one that was free. Entries carry `players: 1`.)*
- **`PUP-WO-0401` — Classic 8×8 and the four assists.** The second registry entry, and
  Undo / Hint / Help / Mix as `action` descriptors on the §8.8 panel seam. **Blocked on
  `PUP-WO-0111`**: a panel that mounts before the `controlsOpen` flip covers 321px of a
  412px screen. **This is also where losing becomes reachable** — see gate 2's
  correction below.
- **`PUP-WO-0402` — The look and the voice.** *(Dispatched.)* The drag-ghost desync,
  the tray piece sizing, **`api.sound` in place of the source's own audio**, and the
  console's own vocabulary: **the paw, the radar rings and sweep, the button-glow
  palette.**

  > **THOSE LAST FOUR WERE ALREADY IN THIS DOCUMENT, RATIFIED, AND I RE-CUT THE PHASE
  > WITHOUT CARRYING THEM.** The original `PUP-WO-0401` read *"dark radar field,
  > paw-and-label header matching the existing panels, pieces recoloured to the
  > console's button glow palette, `doSound()` in place of the source's own audio."*
  > **All four.** `PUP-WO-0400` shipped without them because my re-cut work order did
  > not ask for them, and I then wrote them into `PUP-WO-0402` as **fresh scope from
  > Scotty's device feedback** — when he was asking for something this roadmap had
  > already promised him. **A re-cut inherits the old cut's content or it silently drops
  > it**, and nothing in the process reads the phase it is re-cutting.

**Exit gate.**
1. Both board sizes playable start to finish.
2. Reaching a no-moves state presents exactly one control, and tapping it starts a
   new game. *(Falsifies northstar invariant 5.)*

   > **CORRECTION 2026-09-02: EASY MODE CANNOT REACH A NO-MOVES STATE AT ALL, so this
   > gate as written is unmeetable through play in the mode Buddy uses.** `engine.ts:155`
   > falls back to `DOT` when nothing fits, `rescueUnplaceable` swaps any unplaceable
   > piece for one that does, and a 1×1 fits wherever a single cell is free — **so the
   > board must be entirely full, and the placement that fills a row's last cell clears
   > that row.** CC-B drove **108 finger placements** and `over` never went true.
   > **Little Hands is unlosable, and that is almost certainly right for a
   > three-year-old** — invariant 5 exists to stop play ending, and a mode that cannot
   > end play satisfies its *purpose* while failing its *test*.
   > **`PUP-WO-0400` proves the terminal state by handing `api.load()` a full board**,
   > which exercises the real filter and the real fallback and calls no seam.
   > **Making it reachable through play is `PUP-WO-0401`'s**, in classic, where
   > `rescueUnplaceable` returns the tray untouched. **This gate reads as though every
   > mode reaches a no-moves state; it must name which mode.**
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

## 4·RESUME — the position, as of the commit that carries this section

*Written for a context-less reader picking this up cold. **This section is the queue.**
If it disagrees with anything remembered, this wins.*

**`/stable/` is `80bc634` and has not moved. Nothing built since P1 has reached Buddy.
Promotion is Scotty's alone.**

### THE QUEUE, in order, with what each is blocked on

| # | work | state | blocked on |
|---|---|---|---|
| 1 | **`PUP-WO-0703` — voice slots + the sine-wave feedback** | **DISPATCHED 2026-09-04.** Three slots, more sliders, and **an invariant-1 fix**: nothing tells a non-reader that recording is happening | in flight |
| 2 | **`PUP-WO-0704` — Block Pop's celebration** | authored. **§0 is a measurement first**: the flash and spark volleys already exist in `celebrate()`, so find what suppresses them before adding | nobody |
| 3 | **`PUP-WO-0705` — the tile exception in the mechanism** | authored. An allowlist of exactly ONE third-party origin, so a SECOND goes red. **Owed half of Scotty's tile ruling** | nobody |
| 4 | `PUP-WO-0104` — the cache gate at the right shape | authored, unbuilt | nobody |
| 3 | `PUP-WO-0110` — check 14's flake: **instrumentation, NOT a fix** | scoped in §4a, no file | nobody |
| 4 | `PUP-WO-0112` — the CI job split | scoped, no file | nobody |
| 5 | `PUP-WO-0113` — check 11 fires on English prose | scoped in §4a, no file | nobody |
| 6 | *(unnumbered)* the camera panel's bare `click` controls | ruled to its own number, not issued | nobody |
| 7 | *(unnumbered)* the mandatory drawer pan | §4a, **CC-A's to rule** — needs a Gyre manifest decision | CC-A |

### WHAT NEEDS A HUMAN, and cannot be simulated

- **`PUP-WO-0603` §4 is UNVERIFIED.** Scotty confirmed it is **page zoom** (only the app
  magnifies), so the recovery **can** fire — but **nobody has watched it fire**, and the
  harness cannot zoom `index.html`. *Relevant and effective are different claims.*
  **Needs the S10+.**
- **`PUP-WO-0602` acceptance item 1** — that an Android long press no longer opens the
  context menu. The suppression is fully verified; **the trigger is not, because Chromium
  cannot raise one.** **Needs the S10+.**
- **~~THE VOICE AUDIENCE~~ — RULED BY SCOTTY 2026-09-04: VOICE IS LOCAL ONLY.** No channel,
  no send, nothing crosses. Location is local-function only too. **`PUP-WO-0702` carries
  both.** *Tracing the location half found what the question had not: `broadcastMapStamp`
  sends real `{lat,lng}` with a stable device id, on a map centred on the child's GPS at
  zoom 16 — live since the Map panel shipped.*
- **~~THE CAMERA~~ — RULED BY SCOTTY 2026-09-04: PHOTOS STAY ON THE WIRE, UNCHANGED.**
  **The reasoning, not just the verdict, because the verdict alone would look inconsistent
  with the voice ruling:** image sharing is ephemeral, and **the audience is not "anyone
  with the URL" in practice — the URL and the anon key are HOUSEHOLD CREDENTIALS.** A
  second household running PupPad would stand up its own backend and its own key, so it
  would not be on this channel at all. *That is a different fact from the one that decided
  voice.* **Voice went local for a reason that still stands and is not reopened:** a voice
  is identifying in a way a photograph the parents took is not, **and local-only cost Buddy
  nothing, because the joy is the playback.** **`PUP-WO-0702` does NOT extend to the
  camera.**

- **~~THE MAP TILES~~ — RULED BY SCOTTY 2026-09-04: LEAVE IT AS IS.** Keep the live
  basemap, keep `maxZoom`, do not bundle, do not remove. **He chose against three costed
  options rather than by default** — no basemap (free, loses only the streets); bundle
  ~218 tiles to z16 (~5.5 MB, same-origin, would also have removed the opaque-quota
  problem, **but a public repo would publish the neighbourhood**); or lower `maxZoom`
  (coarsens the egress without removing it). His words: *it does not hurt anything to keep
  it and continue — it may technically violate an invariant but he can make that call.*
  **THE AMENDMENT WAS THE NON-OPTIONAL HALF AND IS DONE:** `docs/northstar.md` invariant 3
  and the third-party non-goal each carry the exception, dated, with what it costs. **The
  mechanism half is `PUP-WO-0705` and is NOT done** — until it merges the exception lives
  only in prose.
- **Roadmap gate 3 and gate 8** remain open and are not simulable.
- **A play session with Buddy.** The drag now shows him the piece, the picker fits, tiles
  are the size Scotty asked for, and there is a perfect-clear celebration to win.
  **`CELEB_MS` is one constant if 3.4s is too long.**

### THE STANDING RULES A RESUMING SESSION MUST NOT REDISCOVER

**`docs/work-orders/TEMPLATE.md` is the authority — copy it, do not reproduce it from
memory.** The two that cost the most this cycle:

- **A human decision costs ONE THREAD, not the loop.** Ask, then **dispatch the next
  unblocked work order.** Three sat idle while one question waited. *Before idling, open
  this section and name the next item out loud.*
- **A missing check and a passing one are the same colour.** Four checks sat on `main`
  registered nowhere. **Every merge now verifies that added `demo-*.mjs` files appear in
  `ci.yml`** — check 25 enforces it, and the count must equal the registration count.

## 4a. Parked work — carried past a phase gate, and where each one goes

*Added 2026-09-02. **Every item below has been living in chat messages and nowhere
else**, which is exactly the shape architecture §6.6 names: a thing everyone believes
is recorded, that no document actually holds. Written down so the next context-less
reader inherits the queue instead of rediscovering it.*

| # | What | Why it is parked, not dropped | Ranked |
|---|---|---|---|
| `PUP-WO-0104` | The cache gate at the right shape — a real browser at the production origin, content assertions across `urlsToCache`, M9/M7/G1–G8 | Blocks **the next `sw.js` change**, not any merge that has happened. P1 closed without it, **recorded rather than waived** (architecture §6.4). | Behind P2 |
| `PUP-WO-0106` | The un-closable Map overlay — guard `openTreasureMap` on `typeof L !== 'undefined'` and take the existing toast path | A **confirmed live trap** needing an app restart, but on a copy nobody is using. `PUP-WO-0200` §3.4 stopped the games host from *reproducing* the shape; this repairs the three existing openers. **CC-A's to author.** **Note: `PUP-WO-0600` also claims this defect** — two documents that do not know about each other; the overlap resolves when 0106 is written. | Behind P2 |
| `PUP-WO-0108` | The quota path — `activate`'s unstated precondition, proportional reclaim, the keep-list scope/script-URL bug, the harness's HTTP-versus-quota ordering model | Split out of `PUP-WO-0105` after **two rounds produced two live-severity regressions** on the install path. Demoted from "ahead of 0104" to strictly behind P2 on 2026-09-01: **nothing is live-severity while nobody is holding the tablet**, and that is the same premise that widened CC-A's merge authority. | Behind P2 |
| *(tiles)* | Whether the worker should cache cross-origin OSM tiles at all | Real, unratified, and **it has no home**: architecture §6.5 records that `PUP-WO-0600` cannot receive it, because tiles are per-coordinate map data and unvendorable. Tiles are the bulk of the opaque entries and the whole of the quota path. **Needs a number.** | Behind P2 |
| *(CSP / iframe)* | Structural enforcement of invariant 3 for game modules. **`supabaseFetch` is a global, pre-authenticated network client in every game module's scope** — not new, not any game's, and written down nowhere until `PUP-WO-0300`'s pass found it. **That changes this item's character from hardening to exposure:** a token scanner missing a call is a wall with a gap; an authenticated client in scope is a door with the key left in it. **And the trigger will not be a hostile game — it will be an HONEST one, written by a future session that reaches for a convenient global because it is there.** *(The builder's, and it reframes the item: everything this project has caught — the false greens, the stale pointers, the proxy assertions — was honest work. `supabaseFetch` is convenient, in scope, and undocumented, which is precisely the recipe for good-faith use.)* | `PUP-WO-0200`'s check 11 **raises the cost and is not a sandbox, by its own verdict text.** The structural answers are a CSP — `default-src 'self'` **would break the Map panel**, which loads Leaflet and Supabase from CDNs — or running modules in an iframe/worker. Architecture, not something to smuggle into a build. **Needs a number.** | Behind P2 |
| *(publication concurrency)* | Serialised publication that cannot silently drop a promotion | `pages-publish` and `pages-deploy` are global groups and GitHub's pending queue has **depth 1**, so a pending promotion can be evicted with **no log line**. Not fixable by renaming a group. Mitigated today by the **post-condition**: promote, then verify `/stable/build-stamp.json` reports your sha — **re-fetch rather than concluding failure**, `cache-control: max-age=600`. **Needs a number.** | Behind P2 |
| *(module-referenced assets)* | `check-assets` cannot see an asset referenced only from a game module | `img.src = './assets/ball.png'` absent from `urlsToCache` gives **CHECK 2 PASSED and a broken image on a cold offline device**. No game ships an asset yet. **Becomes load-bearing the moment one does** — `PUP-WO-0300` §7 flags it. | **P3, blocking** |

| *(citation rot)* | `docs/` holds **108 distinct `index.html:NNNN` citations** and `index.html` is a mutable file. `PUP-WO-0200` added 296 lines and **`PUP-WO-0000` §1.6's three citations for the overlay trap all went stale** — `:1361` is now a colour-button loop, `:1368` is blank, `:1550` is `doSound('keyTap')`. Measured 2026-09-02: 7 citations land on blank lines, none past EOF, 101 on a line with content — **which is not the same as pointing at the right thing, and the 108 have NOT been audited semantically.** | Architecture §6.1 **member 4** at scale, on the project's own founding findings file. **The fix is not renumbering** — it is to stop citing derived positions: `PUP-WO-0106` cites symbols instead, and a check that refuses **new** `index.html:NNNN` citations in changed docs would stop the debt growing. **Enforcement is a rule change for everyone who writes docs and is deliberately NOT being imposed while the operator sleeps.** | **Needs a number** |

| `PUP-WO-0110` | **Check 14 is FLAKY, and the work order is INSTRUMENTATION, NOT A FIX.** It went red on `PUP-WO-0700`'s PR — *"/games/gyre.js is NOT in any cache after install"* — and **passed on re-run with no code change**, while `main` was green throughout. | **A gate that fails nondeterministically passes nondeterministically, and check 14 is what invariant 3's offline guarantee rests on.** Three mechanisms proposed, **all three unproven and two positively refuted**: CC-A offered (a) `skipWaiting()` racing `install`'s `waitUntil` — refuted, `waitUntil` is called synchronously so `installing→installed` still waits, and `addAll` is atomic so a race would give a *partial* cache, which it forbids; and (b) `sw.js:328`'s `CACHE_PREFIX === null` early return — matches the symptom exactly but is **unreachable here**, since `SCOPE_URL` is `registration.scope` or an absolute `location.href`, and `new URL()` cannot throw on either. **CC-B's dichotomy — *addAll rejected → timeout* XOR *install succeeded caching nothing* — is incomplete: a third branch fits.** `sw.js:369`'s activate handler, on a non-canonical scope, **deletes every cache matching `CACHE_PREFIX` and then calls `self.registration.unregister()`** — which yields active + empty + no timeout **and independently explains the step-3 `ERR_CONNECTION_REFUSED` that both analyses discarded as a mere consequence.** Also unproven. **SECOND OCCURRENCE, 2026-09-02, AND IT IS THE STRONGEST EVIDENCE THERE IS: run
`33672402636` on `main` at `e8e078a` — A COMMIT THAT TOUCHED TWO `.md` FILES AND
NOTHING ELSE.** A documentation diff cannot reach `sw.js`, `install`, `activate` or the
harness, so **every code-related explanation is eliminated by the diff itself**, and so
is "the change made addAll slower". **It also blocked publication** — `Publish both
copies` reports `skipped` because `publish: needs: checks` — so a flaky check 14 is not
only a false signal, it is an **availability property of the deploy path**. *Two
occurrences in one day, both on green code. The instrumentation is no longer a nice
diagnostic; it is the only thing that will turn the third occurrence into an answer.*

**(c) is since CONFIRMED AT SOURCE by CC-B**, who also named why the enumeration failed and the naming is better than the finding: *"I wrote 'an empty cache has exactly two stories' and then enumerated two INSTALL-TIME outcomes. The cache is not only written at install; it is also DELETED at activate. I enumerated the outcomes of one event and presented it as the outcomes of the system."* **That is §6.1 member 7 committed while refuting an instance of member 7** — a frame chosen in which the third branch is not expressible, then trusted because it was exhaustive *within* the frame. The companion rule, also CC-B's: **an observation you have explained away is evidence held in reserve against your own hypothesis.** Both of us had written off the step-3 `ERR_CONNECTION_REFUSED` as downstream, and it is the symptom that discriminates. **The ruling is CC-B's and it is right: make it diagnosable before making it go away.** Wait for a *settled* registration (`active && !installing && !waiting`), and on failure **dump rather than conclude** — `active.scriptURL`, every cache name and count, `registration.scope`, the worker's own `caches.keys()` over `postMessage`, and the `installing→statechange` terminal state, so *install failed* and *install succeeded and cached nothing* are distinguishable from the artifact alone. **Two additions that make the set discriminate all three candidates rather than two:** after the failure, **re-read `navigator.serviceWorker.getRegistration()` and log whether it still exists** — (c) is the only candidate that *erases* the registration, since install-time failures leave it present with a redundant or null active worker (CC-A's); and **log `SCOPE_PATH` and `canonicalPath(SCOPE_PATH)` side by side**, not the scope string alone, because (c)'s trigger is the *inequality* of those two and printing only the scope leaves a reader re-deriving a segment-wise decoder in their head (CC-B's). **No product code changes.** Shipping a guessed fix to `sw.js`'s install path — the one thing invariant 3 rests on — against a mechanism nobody has observed is the trade this project refuses everywhere else. **The next occurrence is the only evidence there will ever be, and today it would be spent on a re-run.** | Behind P2 |

| *(0111 §2)* | **THE PICKER DOES NOT FIT ON THE FLEET, AND ITS TILE IS SIZED OFF THE WRONG AXIS.** Scotty, with screenshots: *"the game picker icons need to be smaller… twice as big as they need to be. you have to scroll down just to get to 'bricks'… cut them in half… centre them into a grid that fits on the one screen until/unless we fill up more than one grid can hold."* | **Measured at source and against the screenshots.** `pickerTile` is `width:min(42vw,240px);height:min(42vw,240px)` — **there is no `vh` term at all**, so a SQUARE tile is sized entirely off the axis that is plentiful (891px) and never off the one that binds (411px). The grid adds `padding:140px` of top clearance for `#gameBack`'s hit box. **140 + 240 + 24 = 404 of 411: one row barely fits and clips, and a second is impossible.** *(That 140px is the same defect as the drawer's old `max-height` cap — a fix expressed as a NUMBER that was right at 768 and wrong at 411, while the panel's COLUMN rule at x ≥ 84 held at every height. **The height rule failed and the column rule survived, in the same file, on the same day.**)* **Scope: halve the tile, drive it off the binding axis rather than off width, keep `align-content:safe` and the exit-clearance property, and scroll only when the count genuinely exceeds one screen.** Verified from the same screenshots: **`env(safe-area-inset-left)` is ~30 CSS px and NON-ZERO** on this fleet, exactly as architecture §3 predicted — a layout that hard-codes its gutter is wrong here. **The dark pill in the screenshots is CLOSED and is NOT A DEFECT — it is Scotty's own dev tool.** It is `~/ccbar.py`, his minimised Termux:GUI natural-language input bar, which exists to bypass the autocorrect lockout in the terminal and **floats above the foreground app whichever app that is**. Nothing to fix, nothing to investigate, and **it will never appear on Buddy's device.** *(Recorded because two sessions spent effort on it: CC-B proposed the punch-hole cutout, CC-A proposed Chrome's fullscreen affordance, and **both reasoned from the artifact when the answer was already written down** — the bar is documented in CC-A's own standing operating instructions, including that it is a singleton overlay. "No surface owns it" was the literal answer and neither of us read it that way. **A screenshot is a picture of a DEVICE, not of an application**, and everything on it is in evidence — including things that belong to neither.)* | Behind P2 |

| `PUP-WO-0111` | **Every CI viewport list is the wrong shape, and correcting it turns a shipped control-panel defect red.** Check 19 runs 800x480 / 1024x600 / 640x480; check 20 runs 1024x640 / 780x560 / 1920x500. **The shortest thing either has ever seen is 480 and the fleet is 412** — and 412 is exactly where `max-height:78vh` starts binding, so every panel measurement this project has reported was taken in the regime where the cap does **not** bind. | **This is a correction to two merged work orders, not part of the port**, which is why it is not folded into `PUP-WO-0400`. CC-B measured the shipped panel at all three fleet viewports: drawer **321px**, covering **78%** of the field, top at y=91; content **406px in a 319px client, so panning is MANDATORY**; **eight controls with a rect outside the viewport at rest**; and **`randomize` at y=-7, 88px tall — the dice is clipped by the top of the screen.** CC-A corroborated the dice independently from geometry: the dock is bottom-anchored with auto height, so overflow leaves the **top**, and 412 − 321 − 10 − 88 = **−7 exactly**. Two instruments, neither tuned to produce it. **What survived is the rule that was made height-independent** — the left-gutter column (x ≥ 84, clearing `#gameBack`'s fixed x 10–74) holds at *any* height, while the max-height cap first shipped for that same defect would have failed here. **CC-B's generalisation, and it belongs in every layout this project writes: prefer a constraint no viewport can invalidate over a number that happens to fit.** The scope is: correct both viewport lists to the fleet, then fix what goes red. | Behind P2 |

| *(the mandatory pan)* | **The control drawer still requires a PAN to reach every control on the fleet** — 356–406px of content in a 312px client. `PUP-WO-0111` closed everything else and flagged this rather than folding it, correctly. | **A pan that WORKS is proven; a pan that is MANDATORY is a different claim, and a non-reader does not discover a vertical drag on a panel he has never seen scroll.** That is invariant 1, and it is the same class as gate 8 — **not simulable, it needs a human watching Buddy try.** Closing it means changing how **Gyre's two full-width swatch rows** render (ten options each, `gridColumn: 1/-1`), which is **`PUP-WO-0301`'s surface and a design decision about Gyre's manifest**, not a tweak inside a picker work order. **CC-A's to rule.** *(Check 19 now fails if the drawer covers more than 80% of the field; it is at 76%. That bounds the growth but does not close the pan.)* | **Needs a number** |

| `PUP-WO-0113` | **CHECK 11 — THE FAIL-CLOSED GATE INVARIANT 3 RESTS ON — FIRES ON ENGLISH PROSE.** It reported `games/blockpop.js:12 — import '#gameBack'`, *"not a relative path"*, **in a file containing zero imports**, from a regex match spanning **791 lines of comment text**. | **REPRODUCED INDEPENDENTLY BY CC-A**, not taken from the report: the shipped pattern needs `import` … `\bfrom\s*` immediately followed by a quote character, and ordinary prose supplies all three across hundreds of lines. **The cause is a comment that describes a behaviour its function cannot have.** `check-games-offline.mjs:230-231` says *"Runs on the STRIPPED source for position fidelity but reads the specifier from the raw text"* — and `:237`/`:239` execute against **`raw`**, which is the function's **only parameter**. There is no stripped source inside `imports()` to run on. **TWO TRAPS FOR WHOEVER FIXES IT.** (1) **Do not bound the `[\s\S]*?` gap.** It is unbounded deliberately, so `import{x}` and a specifier on the next line are both seen — *"both evaded the previous line-based detector."* Bounding it reintroduces the evasion it exists to close. **The defect is the SOURCE it scans, not the gap.** (2) **Position fidelity is why it reads raw**, so scanning stripped must preserve the reported line or the diagnostic degrades. **AND THE COST IS NOT THE FALSE RED.** A fail-closed gate that fires on prose teaches the next builder to work around it, and the obvious workaround is loosening the pattern — **which is how a real evasion gets in through the door built to stop one.** CC-B reworded their own comments to get a commit through, which is that pressure already operating. | Behind P2 |

**FIVE ITEMS ABOVE STILL NEED NUMBERS** — tiles, CSP/iframe, publication concurrency,
citation rot, and the mandatory pan. **`PUP-WO-0110`, `0111`, `0112` and `0113` are
issued.** **`PUP-WO-0110` and `PUP-WO-0111` are issued above** and was the next free P1 number,
which took finding.

**TWO P1 NUMBERS ARE BURNED AND NEITHER IS REUSED.** `PUP-WO-0107` was **dissolved into
`PUP-WO-0105` §0a.4**, which says so at that section and says the number is not reused.
`PUP-WO-0109` is worse: `docs/feedback/PUP-WO-0103.md` records it as one of three
**invented citations** that occurred exactly once, in the sentence that invented them,
and were struck and left unnumbered precisely because *a number reads as a reference* —
assigning it now would make that record ambiguous. **So the free P1 sequence is
0100–0106 used, 0107 burned, 0108 claimed above, 0109 burned, 0110 issued.** Written out
because two of the five gaps are traps and neither is visible from `ls docs/work-orders/`.

**The rule that put this table here:** architecture §6.6 — *when a work order cites a
ratified mechanism as existing, resolve it before dispatch.* A parked item recorded
only in a message is the same defect one level up: **everyone believes it is queued
and nothing holds the queue.**

## P7 — Camera and comms

**Goal.** The camera and comms surfaces gain the things Buddy actually reaches for,
and the one shipped defect in them is fixed.

**Depends on:** P2. **Not P6** — these are new capability on a surface no phase owns,
plus one live defect. *(New scope from Scotty 2026-09-02.)*

**Why a new phase rather than P2's band.** P2's exit gate is about the games shell,
and none of this affects it. **Folding these into P2 would mean P2 cannot close until
they are done, which is wrong for the same reason architecture §6.4 gave when P1
closed on its own gate rather than on `PUP-WO-0104`.** A phase closes on the gate it
was scoped against.

**Work orders:**

- **`PUP-WO-0700` — The sticker anchor, and two share buttons.** Three small things in
  one file. **(a)** Sticker placement is proportional and sticker SIZE is not:
  `index.html`'s preview writes `font-size:36px` while the burn computes
  `Math.round(w * 0.06)`. They agree only near `w ≈ 600` and diverge everywhere else.
  **The fix is one expression, not two that must agree** — a single scale constant
  applied to whichever width is in play. **(b)** A **CAPTURE** button so a device
  receiving a shared image can pull it into its own gallery. **(c)** A **RESHARE**
  button on an expanded cached image. Both one-tap and non-reader operable.
- **`PUP-WO-0701` — Voice messages with voice changing.** Record a short clip, apply a
  filter, hear it back, send it to connected devices. **Composition, not new
  infrastructure:** `getUserMedia` is already live at the camera, `AudioContext` is
  already live for the sound bank, Supabase is already wired. Filters are pure Web
  Audio and need no library — `playbackRate`, `detune`/ring-mod, `BiquadFilter`,
  a short delay, a `WaveShaper`. **Presets with big icons AND sliders under them**,
  because the adjusting is the play.

**Exit gate.**
1. **[`PUP-WO-0700`]** A sticker placed in preview lands in the same place, **at the
   same proportion of the image**, in the burned result — verified at **three
   different rendered widths**, not one. *(One expression, so the test is that the
   two paths cannot disagree.)*
2. **[`PUP-WO-0700`]** A shared image can be captured to the receiving device's
   gallery, and an expanded cached image can be reshared — both in one tap.
3. **[`PUP-WO-0701`]** A clip records, at least four filters are audibly distinct on
   playback, and a sent clip arrives on a second device.
4. **[`PUP-WO-0701`]** Every preset and every slider is operable with all text
   covered. *(Falsifies northstar invariant 1.)*
5. **All three surfaces:** one tap back from every state, including mid-record and
   mid-playback. *(Falsifies northstar invariant 5.)*
6. **With Supabase unconfigured, every one of these degrades exactly as the existing
   panels do** — `isSupabaseConfigured()` gates them, the console stays usable, and
   nothing traps. *(Falsifies northstar invariant 3's boundary: comms may use the
   network; the console may not depend on it.)*

---

## 5. Standing cadence

- **Every phase boundary: audit the numbering and the documents.** Has anything
  been dropped? Has any ratified change reached the code but not these documents?
  This is cheap here and expensive at launch — it is the failure mode that most
  reliably goes unnoticed, because nothing announces it.
- **CLOSING A BUILD IS FOUR NUMBERED STEPS, AND THE FOURTH IS THE ONE THAT DECAYS.**
  *(Added 2026-09-03. **`SendMessage` appears ONCE in all of `docs/` — a line in
  `architecture.md`, not a step anywhere — so the park-then-notify handoff is a
  CONVENTION, and this project's whole history is conventions decaying.**)*
  **1.** push · **2.** open the PR · **3.** **VERIFY THE NUMBER RESOLVES** — a PR that
  did not open is indistinguishable from one nobody read · **4.** **`SendMessage` citing
  that number, as the LAST ACTION OF THE TURN.** *A parked PR that does not wake the
  reviewer is work that is finished and invisible, which is the same cost as work not
  done.*
- **Every work order: the builder's `docs/feedback/<WO-id>.md` is read for findings that belong
  upward** — a superseded ruling becomes an architecture amendment, a changed
  constraint goes to the northstar and is re-ratified, an uncheckable gate is fixed
  here by amendment.
- **Every work order, builder's first act:** `git fetch origin && git checkout -B
  <wo-branch> origin/main`. The builder syncs its own tree — nobody reaches into it,
  because one writer per tree is what keeps a running session's working state sound.
- **Every work order boundary, architect:** pull the fresh HEAD of `main` before
  reviewing or authoring. Reviewing against a stale tree is how a merged change gets
  reviewed twice, or missed once.
- **Every scope-fence and protected-surface check, both sessions: fetch, then
  measure against `origin/main`.** Never against a local `main` branch ref — nothing
  fast-forwards it, and in this repo's worktrees it has run four commits stale.
  **A work order must write the check as `git fetch origin && git diff origin/main
  --stat`, never `git diff main --stat`.** The two questions take two refs: *what
  this PR contains* is measured against `origin/main`; *what the builder actually
  touched* against `git merge-base origin/main HEAD`. This is not bookkeeping — the
  scope fence is what makes a pre-firebreak merge safe (architecture §6), so a fence
  checked against the wrong ref is a safety check measuring the wrong thing. And
  when the live base has moved, another session's merged commits appear in the
  diff: they are never to be reverted to make the fence clean.
  *(Added 2026-09-01 — `PUP-WO-0000` §3.1 and `PUP-WO-0100`'s first draft both
  carried the wrong form; CC-B happened to use the right one anyway, which is
  exactly why the rule belongs here rather than in one work order's memory.)*
- **Every coherent unit of work: commit it.** Not at the end, and not "before you
  stop" — a stall is not a chosen stop, so that rule never fires when it is needed.
  A wip commit is recoverable; a dirty tree is not. *(Architecture §8, 2026-09-01.)*
- **Every prove-it-red demonstration: assert the commit and the step, not the
  conclusion.** A red run is not evidence until you know it ran on the commit under
  test and failed at the step whose refusal is being claimed. *(Architecture §5,
  2026-09-01, after four false demonstrations in one work order.)*
- **Every work order boundary: an unconditional heartbeat** on the info topic,
  whether or not anything needs attention. Silence must mean stopped, never still
  going.

## 6. Reconciliation

Nothing built yet. This table opens at the first divergence between what was
planned and what was built; history is left as written and never renumbered.

| Number as built | What it actually was | What this roadmap planned |
|---|---|---|
| `PUP-WO-0000` | As planned. Produced both specifications, plus three contradictions against architecture §3 and seven load-bearing defects from its own adversarial pass. | As planned. |
| `PUP-WO-0101` → `PUP-WO-0102` + `PUP-WO-0103` | One work order carrying both the `sw.js` cache fix and the publication workflow. Split after its **second** adversarial pass; the first found 18 defects (5 disqualifying), the second confirmed 11 fixed and found 13 more (4 serious). | One work order. The roadmap's P1 line bundled them because both were "the firebreak". They are one dependency and two concerns, and the seam is sharp: `sw.js` reaches Buddy's tablet, `.github/` cannot. |
| `PUP-WO-0104`, `PUP-WO-0105` | Two P1 work orders that did not exist when P1 was scoped, both from `PUP-WO-0103`'s adversarial passes. 0105 fixes a live defect in the shipped worker; 0104 rebuilds the cache gate. **P1's exit gate closes without 0104**, which is therefore P1 work carried past the phase gate — recorded rather than waived. See `docs/architecture.md` §6.4. | P1 was scoped as two work orders, 0100 and 0101. It became five. |
| **P6 (new)** | A phase that did not exist when this roadmap was written. | Nothing. P0 was scoped to *find* contradictions against architecture §3; it also found defects in the shipped app that belong to no planned phase. The roadmap had no home for "fix what the investigation found," which is a gap in the roadmap rather than in the investigation. |

## 7. Amendments

| Date | Change | Reason |
|---|---|---|
| 2026-08-31 | Document created. | First roadmap; also the first dual-CC pilot, so CC-A needs a sequencing authority that is not a conversation. |
| 2026-08-31 | P2's live-path rule gains an explicit bootstrap exception; standing cadence gains the per-work-order sync rules for both sessions. | The rule as written was violated by P0 and P1 by necessity — found by CC-A on its first read, before any dispatch. The sync rules close a gap where no party owned keeping the builder's tree current. |
| 2026-09-01 | **P6 added** — shipped-app remediation, depending on P1, running parallel to P2–P4 and prioritised ahead of P2. §3's critical path and §4's phase map updated; reconciliation opened. | `PUP-WO-0000` found two defects in the app as it stands — three unconditional third-party CDN loads, and an un-closable full-screen overlay reachable offline — that belong to no planned phase. They cannot go in P1 (their diffs touch a served path, and P1 is the phase with no firebreak) and must not go in P2 (a games phase whose gate would then mean two things). Recorded as a phase rather than folded, so the decision is visible and reviewable. |
| 2026-09-01 | `PUP-WO-0101` superseded by `PUP-WO-0102` + `PUP-WO-0103`; P1's work-order list and §6 updated. | Two adversarial passes each found serious defects and the second found one — an origin-wide offline **read** — that no check could see, because the work order was broad enough that its own harness stub went blind. The deciding evidence was not the count but the shape: its fixes had begun producing new defects (an encoding fix closed an attack and opened an invariant 3 violation). When fixes generate defects the change is too large to hold at once, which is a scope problem and the architect's to fix. The split also isolates every tablet-reaching byte of P1 into one small file. |
| 2026-09-01 | P1 gate item 3's prove-it-red requirement is extended by `PUP-WO-0100` §3.3 from two checks to all four. | `PUP-WO-0000`'s lesson, generalised: its module contract passed a demonstration against both games in hand while still holding two defects, because neither game exercised them. A check demonstrated red on the two cases its gate names is the same shape of insufficient proof. |
| 2026-09-02 | P2's exit gate items each name **which work order satisfies them**; gate 2 becomes a CI mutation and gate 3 may not be simulated. **§4a added — the parked-work table.** | The gates were phase gates read as per-work-order acceptance, so `PUP-WO-0200` could not satisfy three of them and correctly did not claim to — flagged by CC-B, which had silently recast one and reported doing so. **§4a exists because every parked item was living in chat messages and nowhere else**, which is architecture §6.6's defect one level up: everyone believes the queue is recorded and nothing holds it. |
| 2026-09-02 | §4a's CSP/iframe row records `supabaseFetch`, and check 3's COMMIT-provenance gap is required of the next work order touching `.github/ci/`. | Both from `PUP-WO-0300`'s pass. Every sibling check initialises `COMMIT` to `'unknown'` and passes — **a green with no identifiable subject is §6.1 member 1 wearing a provenance line**, and it falsifies §5's own rule that a demonstration asserts its commit. The builder made its own check fail closed and correctly did **not** touch the others: a cross-cutting edit to checks it had no other reason to open, on a work order about a game port, is scope creep. |
| 2026-09-02 | **P7 added — camera and comms**, with `PUP-WO-0700` and `PUP-WO-0701`. | New scope from Scotty. Given a **new phase rather than P2's band** because P2's exit gate is about the games shell and none of this affects it — folding them in would prevent P2 closing on its own gate, which is the mistake architecture §6.4 named when P1 closed without `PUP-WO-0104`. |

## 8. Provenance

Written by Claude (chat architect) with Scotty, 2026-08-31, from the same planning
session as the northstar and architecture. P0 is staged as an investigative work
order at Scotty's direction, so CC-A opens the loop with an assessment rather than
a build. Exit gates for P1 and P2 are drawn from the falsification column of
`docs/northstar.md` §4.
