# PupPad — Architecture

**Status:** ratified · 2026-08-31 · Scotty + Claude (chat architect)
**Gate:** Scotty ratifies rulings. Invariants are not defined here — see
`docs/northstar.md` §4 and cite by number.
**Supersedes:** nothing — first architecture for a repo that shipped without one.
**Governing standard:** none. ClearSeal governs MCP servers; PupPad exposes no MCP
surface, so it does not apply. See §9.
**Read first:** `docs/northstar.md`. This document constrains work orders; the
roadmap tracks sequence, this tracks shape.

---

## 1. How to use this document

This is the source of truth for what is being built and why each choice was made.
Implementation detail belongs in work orders; this constrains them.

**The divergence rule.** Any deviation from this document is recorded here as a
dated amendment with its rationale. Undocumented drift is a defect, not a shortcut.
A change to an *invariant* is not an amendment here — it goes to the northstar and
is re-ratified; this document records the consequence.

**Never reuse a section number.** Assume every number is cited from somewhere you
cannot see.

## 2. What PupPad is, today

A single-page progressive web app. One HTML file carries all markup, styles, and
behaviour; a service worker caches it for offline use; a manifest makes it
installable. No build step, no package manager, no framework, no dependencies.

Eight buttons flank a radar canvas — four per rail. **Three of the eight open a
panel** — Map (`openTreasureMap`), Draw (`openCanvas`), Camera (`openCamera`) — each
a full-screen overlay built by an `openX()` that appends a div, paired with a
`closeX()` that removes it. The other five (Comms, Alert, Tools, Weather, Power)
play a sound and show a toast; no panel exists.

`attachEvents()` is **not** a router. `data-id` looks up the button record, but the
behaviour branch at `index.html:1680-1699` is a hardcoded `if (btn.id === 1/2/3/6)`
chain. **Adding a ninth id means editing that chain** — which is precisely what
northstar invariant 6 forbids, and therefore the central problem `PUP-WO-0200` must
solve: dispatch has to become registry-driven, not an id comparison. *(Both
corrections found by CC-A against the code, 2026-08-31; the previous text overclaimed
on both counts.)*

## 3. Ground truth — measured 2026-08-31

Measured against the live repository, the running Precision host, and the GitHub
Pages API. Commands cited.

| What | Measured |
|---|---|
| Repo contents | 5 files: `index.html` (1,942 lines), `sw.js` (43), `manifest.json`, two icons. No `.github/`, no tests, no docs. |
| Cache identity | `sw.js:1` — `var CACHE_NAME = 'pup-pad-v16'`. A hardcoded constant. |
| Cached assets | `sw.js:2-8` — `urlsToCache` lists five entries. **It is the cold-install set, not the cache's contents.** `sw.js:31-43` is network-first with *unconditional* runtime caching and no status filter, so every response `fetch` resolves is cached — **including 404s**, which then serve offline as plausible hits. A mistyped `games/<id>.js` therefore fails silently rather than loudly. *(Corrected 2026-09-01 from `PUP-WO-0000` §6.2; the original row's "anything not listed is not cached" was false and is what made the §6 reap look survivable.)* |
| Pages configuration | `gh api repos/ikthys777/PupPad/pages` → `build_type: legacy`, `source: {branch: main, path: /}`, `https_enforced: true`. |
| Precision `gh` | Read-only for repositories by deliberate configuration. |
| ntfy | Self-hosted, `http://127.0.0.1:8090`. `cortex-operator.service` subscribes by SSE. No ACL; topics are protected only by being unguessable. |
| Claude Code on box | 2.1.251 — above the 2.1.224 floor for cross-session messaging. |

### 3.1 Corrections — where measurement contradicted belief

The wrong belief is more instructive than the right fact; both are recorded.

| Assumed | Measured |
|---|---|
| PupPad deploys through CI, so merge and deploy are separable steps. | No CI exists. Pages serves `main:/` directly, so **a merge to `main` is a deploy to Buddy's tablet within a minute.** Load-bearing: `dual-cc-session-design-v2.md` §6 rests entirely on merge≠deploy, and without this correction delegated merge would have been enabled against a firebreak that does not exist. |
| The lock button gates access to panels, so a game could rely on it to keep settings out of reach. | `index.html:1730` — the lock toggles fullscreen and holds a PIN in `state.storedPin`, which is **in-memory only and lost on reload**. It gates no content whatsoever. Any containment a game needs must be built, not inherited. |
| Serving a second copy at another path is free. | Both paths share an origin and `CACHE_NAME` is a constant, so two deploys would compete for one cache. The symptom is the promoted copy silently serving test assets — precisely the failure the split exists to prevent (northstar invariant 7). |
| ntfy needs to be stood up for this project. | Already running self-hosted and in ecosystem use. Only topics were needed. |
| The Precision can merge its own pull requests. | It cannot, by design. Merge authority requires a separately minted, narrowly scoped credential. |

**Not measured.** Cold-start time on Buddy's actual tablet, and the device model
itself. No performance budget in §6 rests on a number from that device; the budget
is stated as a gate to be measured during P2, not as a fact.

## 4. Shape and seams

```
index.html ──┬── console shell   (rails, radar, router, state, sound, PIN)
             ├── panels          (comms, map, draw, alert, tools, weather, camera)
             └── games host      [NEW] ── registry ── picker overlay
                                              │
games/<id>.js  [NEW] ─────────────────────────┘  one module per game
sw.js          asset manifest + cache identity
```

**Seams, and which are boundaries:**

- **Console shell ↔ game module** — *a contract, not a security boundary.* **Now
  concrete, and specified in `docs/findings/PUP-WO-0000.md` §8, which this section
  defers to rather than restating.** The shape: `export default function mount(host,
  api)` returning a `teardown` closure. `teardown` is *returned from* `mount` rather
  than exported separately, so it shares scope with the setup that acquired the
  handles — that is what makes northstar invariant 6 and §7 seam 1 structural rather
  than reviewed. Closing is `api.close()`, which delegates to the shell's single
  `endGameSession()`; it is not a second close path. *(Amended 2026-09-01 — the
  earlier "a container element and a `close()` callback" predated the contract and
  is superseded by it.)*
- **Registry ↔ picker** — *a contract, not a boundary.* The picker renders whatever
  the registry lists and knows nothing about any specific game.
- **`main` ↔ the promoted copy** — **a blast-radius boundary, and the important
  one.** It is the only thing standing between an autonomous merge and a
  three-year-old's tablet. See §6.
- **PupPad ↔ device** — **a security boundary**, enforced by the browser and by
  invariant 2, not by application code. Note §3.1: the lock button is *not* part of
  this boundary despite appearances.

## 5. Ratified rulings

| Question | Ruling | Reason |
|---|---|---|
| Port the games to vanilla, or bundle their React runtime? | **Port to vanilla.** | PupPad's defining property is one uncompiled file cached whole, working offline with no toolchain. A bundler trades that away for games whose auth, database, and SSR scaffolding must be stripped regardless. The engine half ports 1:1; only rendering is real work. |
| One file, or separate game modules? | **Separate `games/<id>.js`, loaded on demand.** | `index.html` is already 1,942 lines. Games would push it past a size where a single agent edits it safely, and per-game files make invariant 6 mechanical rather than aspirational. Cost is one entry in `urlsToCache`, asserted by CI. |
| How does a game get discovered by the picker? | **A registry array in the shell; the picker renders it.** | Invariant 6. Adding a game must not require editing the picker. |
| What replaces the Power button? | **Games replaces it entirely.** Its `powerUp` sound is reassigned to games-open. | Scotty's ruling, 2026-08-31. Power was a sound and a toast with no panel; the rails hold eight and eight is right for the layout. The sound is the best in the bank and outlives the button. |
| Does the games surface require Supabase? | **No. Games are strictly offline.** | Every existing panel gates on `isSupabaseConfigured()`; games must not, because invariant 3 makes offline capability non-optional and a game is the surface most likely to be used in a car. |
| Block Pop board sizes | **Both `easy` (6×6) and `classic` (8×8) ship.** | Already a `Mode` in the source with sizes mapped, so keeping it costs nothing. `easy` is Buddy's default; `classic` is bigger and is what makes two-player-on-one-tablet legible later. |
| Block Pop's game-over screen | **Softened to a single "play again" affordance.** | Invariant 5. A three-year-old does not need a fail state. |
| Gyre's control surface | **Ported as-is, plus attract/repel, plus randomize.** | Scotty's observation that Buddy's actual engagement is the sliders. Attract/repel is the largest visible change per control; randomize is the highest joy-per-tap control available to a non-reader, since it needs no understanding of any individual slider. |
| Deploy topology | **Two paths, one site: root = newest, `/stable/` = promoted.** | Satisfies rapid on-device iteration and a protected baseline simultaneously, which one branch cannot. See §6. |
| Cache identity under two paths | **`CACHE_NAME` is namespaced per deploy path; CI asserts they differ.** | §3.1 — measured collision, not hypothetical. Invariant 7. |
| Adversarial pass ownership | **CC-B runs it itself, as a black-box task in its own dynamic workflow** — fresh context, sees only the artifact, no knowledge of the builder's reasoning. `FEEDBACK.md` records the exchange **verbatim**: the exact prompt given and the unedited output, never a summary. | *Amended 2026-08-31 — reverses the original ruling; see §11.* Independence is a property of **context isolation**, not of who issues the call. A fresh-context subagent that sees only the artifact is more independent than one CC-A dispatches and then hands a summary. CC-A's own independence is already structural: it is a separate session with separate context. The verbatim requirement is what makes CC-B's dispatch auditable — CC-A reviews whether the pass *was any good*, not merely what it concluded, and a summary written by the party being audited is where a weak pass hides. |
| Where does the adversarial record live? | **Two artifacts.** `docs/feedback/<WO-id>.md` carries the **summary** — findings, dispositions, what was disputed and why. The **verbatim** exchange — exact prompt, unedited output — goes to `docs/findings/<WO-id>-adversarial.md`, committed. Neither summarises the other's job. **And the artifact is frozen before the pass is dispatched.** | *Amended 2026-09-01 — refines, does not reverse, the verbatim ruling above.* In `PUP-WO-0000` the transcript was 341 of `FEEDBACK.md`'s 582 lines and buried the upward findings under the evidence for them; the reviewer is not served by a summary and the architect is not served by a wall of transcript, and one file cannot be both. The freeze rule is separate and was paid for: that pass reviewed a ~1,150-line document that was 1,437 lines when recorded. CC-B declared the drift, which is why it cost nothing — but a reviewer whose subject moved cannot answer "did it see the whole artifact," which is the question the record exists to settle. |
| Is `FEEDBACK.md` one rolling file? | **No — `docs/feedback/<WO-id>.md`, one per work order.** | *Amended 2026-09-01. Completes the two-artifact ruling above, which was incomplete as issued.* That ruling made the *transcript* durable and per-WO but left feedback itself a single rolling file, so `PUP-WO-0100` — following it exactly as written — replaced `PUP-WO-0000`'s 582-line record at the tip on its first application. Nothing was lost only because CC-A had already extracted that record's decision items into §10; an architect who skips that pass loses unruled `decision-needed` items silently, which is the worst shape of loss because nothing announces it. **CC-A's defect, not the builder's.** `PUP-WO-0000`'s transcript is recovered to `docs/findings/PUP-WO-0000-adversarial.md`. |
| What exactly does the freeze cover? | **Every file the work order names as a deliverable — not only code.** | *Amended 2026-09-01.* `PUP-WO-0100` froze `.github/` and then rewrote its feedback file while the pass ran, so §3.3's red demonstrations and §3.4's determinism justification were not in the frozen artifact and went unreviewed — **the two things that work order most wanted scrutinised were the two the reviewer could not see.** Raised by CC-B against a rule CC-B had itself asked for, and led with rather than footnoted. CC-A closed that specific gap by reproducing the demonstrations independently; the rule closes it for everyone else. |
| `FEEDBACK.md` at the repo root or under `docs/`? | **Under `docs/`.** *(Path superseded by the row above — now `docs/feedback/<WO-id>.md`. The ruling is kept because its reasoning, not its filename, is what governs.)* | Ratified at `PUP-WO-0000` review. A root file fails the `docs/`-only gate, and §6's bootstrap exception makes that gate *the property that makes a P0/P1 merge safe* — so the placement is a safety question, not hygiene. Found by `PUP-WO-0000`'s adversarial pass (F24). |
| Can a game make a sound the bank does not have? | **Yes — `api.tone(hz, ms, wave)` joins the module contract.** The twelve-cue bank stays for console cues; `api.tone` is the primitive. | Found by `PUP-WO-0000`'s adversarial pass and escalated rather than self-granted, correctly. `api.sound` offers twelve fixed cues with no pitch and no duration, so a xylophone, a lullaby or an aquarium — plausibly the next toy after a drawing pad — is **inexpressible**, and the only escape was editing a switch table ~1,500 lines from the registry, which is structurally the defect §2 condemns in `attachEvents` and makes invariant 6's "nothing else" false. **Corrected cost:** the findings estimate this at one shell function over existing helpers; `mk()` and `sw()` are declared *inside* `doSound`'s try block (`index.html:62-68`, `:69-75`), not at module scope, so the real cost is lifting both out and adding one function. Still cheap; not one line. *(Cost corrected by CC-A, 2026-09-01.)* |
| How is deploy ordering enforced? | **By the workflow, never by prose.** Publication refuses any copy whose worker reaps or reads outside its own prefix, and **every copy a run publishes is checked in that same run.** | *Ruled 2026-09-01.* `PUP-WO-0101` §6 recorded the required order — merge, fast-forward `stable`, then flip Pages — in a paragraph, and a paragraph is not a mechanism. `refs/heads/stable` still carries the origin-wide reaper, so flipping Pages between the merge and the fast-forward publishes a worker that deletes the root cache on every activation. Restating it as a *property* rather than a *sequence* is what makes it survive: properties hold, sequences get performed wrong once, at 2am. The second clause comes from the same finding — the checks job saw only the triggering ref while publication carried both, so a push to `main` published `stable` unchecked, and "a red check means nothing publishes" was false in both directions. |
| After fixing a defect, what else must be asked? | **What legitimate behaviour does this fix now refuse?** | *Ruled 2026-09-01, as standing discipline.* Three times this project has been bitten by verifying a fix against the failure that was imagined and stopping there: `PUP-WO-0000`'s contract passed a two-game demonstration while holding two defects invisible from those games; `PUP-WO-0101`'s invariant-4 step gained a third assertion while both tautologies it was meant to remove still shipped; and an encoding fix closed an attack by refusing anything non-canonical, which also refused `/my%20photo.png` — working online, silently absent offline, invariant 3. **A fix that introduces a violation while closing one is the normal outcome of testing only the attack you thought of.** The question above is cheap and catches all three. |
| Before dispatching a work order, what must be checked? | **Map it against the real artifacts and ask whether its instructions are SATISFIABLE.** | *Ruled 2026-09-01.* Distinct from the after-fixing question above, and it fires earlier: that one asks what a fix now refuses, this one asks whether the work order can be obeyed at all. `PUP-WO-0102` §2 forbade touching `.github/` while §3.3 and §3.7 required a committed harness that has nowhere else to live — the builder would have correctly flag-and-stopped on day one, on the document rather than on its reading of it. Found by mapping the work order against the builder's actual parked tree before dispatch. Cheap there; a wasted cycle anywhere later. |
| When correcting a belief that appears in several places, what do you search for? | **The belief, not its wording.** | *Ruled 2026-09-01, after the same wrong belief survived two corrections.* `PUP-WO-0102`'s fence was fixed in §2 and §7 by searching for the string `.github/`. §3.1 stated the same fence **positively** — an allowlist of `sw.js` + `docs/` — so it contained no such string and the search could not see it. **Searching for the token finds the copies that name the thing; only searching for the belief finds the rest.** A constraint written as an allowlist and the same constraint written as a denylist share no vocabulary. |
| A discipline keeps having to be remembered. Then what? | **Find the mutation that makes CI remember it instead.** Any rule whose violation has a concrete shape can be moved out of memory and into a check that goes red. | *Ruled 2026-09-01; the builder's, and it generalises past the case that produced it.* `PUP-WO-0102` turned the after-fixing question — *what legitimate behaviour does this fix now refuse?* — into mutation A6, a regression test. The discipline stopped depending on a builder recalling it under time pressure and started depending on CI. This is the same reasoning as §5's "add a check that can go red instead of a third reviewer", applied to **process rules rather than to code**: a rule that must be remembered is a rule that will eventually not be. |
| A check went red. Is that the demonstration? | **No. Red is not a demonstration — assert the COMMIT that ran and the NAME of the step that failed, never the conclusion alone.** | *Ruled 2026-09-01, after this happened **four times in one work order**.* Each time a red run was read as proof a refusal worked, and each time it was red for the wrong reason: an input validator rejected the very runs it existed to let through; a root-copy demonstration was masked by a different check failing first; three demo pull requests built `main`'s clean tree because the publish job checked out `refs/heads/main` unconditionally, so the defect in the PR head was never present; and a wait-loop filter that matched nothing exited immediately and returned a **stale run for an older commit**. Four occurrences, one missing habit. **Every one was caught by asking *which step* failed or *what commit ran* — never by looking harder at the conclusion.** It is mechanisable, and being mechanisable is why it is a ruling rather than advice: a demonstration asserts `head_sha` against the commit under test and the failing step's name against the refusal it claims to prove. Note the shape it shares with §6.1: a green run that certifies nothing and a red run that proves nothing are the same defect, because **in both the verdict was read instead of what produced it.** |
| A third review layer? | **No — add a check that can go red instead.** | Two judgment-based reviewers already share a context and a disposition; a third correlates with them, inflating findings-count while lowering real detection. CI cannot be persuaded. |
| Realtime co-op | **Do not build. Wire the seams, spike it later.** | See §7. |

**Departure from house default:** ClearForge projects normally deploy through CI to
a controlled target. PupPad publishes to GitHub Pages from a branch. §6 records how
the firebreak is reconstructed rather than assumed.

## 6. Runtime and deployment

**Runtime.** Static assets over HTTPS. No server, no backend for games. Supabase is
used by existing panels only and is absent from the games path by ruling (§5).

**Deploy topology, as it will be:**

```
CC-A merges ──▶ main ──▶ [CI green] ──▶ published at  /PupPad/         (newest — test device)
                                                            │
Scotty fast-forwards ──▶ stable ──────▶ published at  /PupPad/stable/  (promoted — Buddy's icon)
```

Both are installable PWAs on the same origin. Buddy's home-screen icon points at
`/stable/`. The test device points at root.

**Why this shape.** GitHub Pages serves paths, not only branches, so one site can
carry two builds. This satisfies both stated goals — newest-on-device for
iteration, protected baseline for Buddy — which a single publishing branch cannot.
It also reconstructs the firebreak that §3.1 showed does not currently exist: an
autonomous merge reaches the repository and the test device, never the child.

**Required change:** Pages moves from `legacy` build type to a GitHub Actions
workflow. Scotty performs this in repository settings — the Precision's `gh` cannot
(§3). The same workflow runs CI, so publication is gated on green by construction
rather than by convention.

**Bootstrap exception.** Until `PUP-WO-0100`/`0101` merge, no firebreak exists — a
merge to `main` publishes live. P0 and P1 must nonetheless merge to `main`, because
they are what *builds* the firebreak. What makes those merges safe is narrower than
the rule they appear to break: their diffs are constrained to `docs/`, and Pages
serves nothing under `docs/`. A P0/P1 work order's docs-only scope fence is
therefore not merely scope hygiene — **it is the property that makes merging it
safe**, and must be verified as such before merge, not assumed.

**The cache hazard — and why namespacing alone is not the fix.** `sw.js:19-27`'s
activate handler calls `caches.keys()` and deletes every cache whose name is not its
own. **`caches.keys()` is origin-scoped, not service-worker-scope-scoped**, so each
deploy path sees the other's caches and reaps them. Namespacing `CACHE_NAME` does not
merely fail to help — it guarantees mutual deletion on every activation, and the
symptom is Buddy's tablet losing offline capability whenever the dev build activates
(northstar invariants 3 and 7, both).

**Required fix, owned by `PUP-WO-0102`:** each deploy carries a `CACHE_PREFIX`, and
the activate handler reaps only caches matching **its own prefix** —
`name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME`. CI asserts both that the two
prefixes differ and that the reap is prefix-bounded. *(Found by CC-A, 2026-08-31,
before `PUP-WO-0101` was authored. The earlier ruling — "namespace `CACHE_NAME`" —
was insufficient and is superseded.)*

### 6.1 The read is origin-wide too, and that is the harder half

*Added 2026-09-01, from `PUP-WO-0101`'s second adversarial pass. **This section
previously documented only the reap, and was incomplete in a way that read as
complete** — the more dangerous kind of gap, because it invited the conclusion that
prefix-bounding the reap closed the hazard.*

`sw.js:40` — the offline path — is `caches.match(event.request)`. That is
**`CacheStorage.match`, which searches every cache on the origin.** The write beside
it at `sw.js:35` is correctly scoped to `CACHE_NAME`. The worker is asymmetric: it
writes only what it owns and reads anything on the origin.

**Consequence:** the promoted copy, offline, serves the test build's bytes. That is
**northstar invariant 7 falsified by the invariant's own stated falsification
test** — *"load the promoted copy after the test copy has been cached; find any
asset served from the other build"* — and it does so with every check green. It is
this project's sharpest demonstration that a passing suite is not evidence.

**Required fix, owned by `PUP-WO-0102`:** the read is scoped to the worker's own
cache. The rule, stated once so both halves inherit it: **a worker touches only what
it owns — on read and on write, not only on reap.**

**Three things worth keeping, because the finding generalises past this bug:**

1. **The line is unchanged since `2952aa1`. It is not a regression.** What turns it
   into a violation is a *work order* putting two caches on one origin. **A change
   can break an invariant without touching the code that breaks it** — so "what did
   this diff touch" is the wrong question to ask of an invariant, and the northstar's
   falsification column is the right one. Run the falsification test, not the diff.
2. **No check could see it, structurally.** The harness's `match()` returned
   `undefined` unconditionally, so the check reporting on cache isolation was blind
   by construction. **A stub that cannot fail is not a test.** Any check standing in
   for a browser API must be able to produce the failure it exists to detect, and
   that capability is itself a thing to verify.
3. It sat three lines below two hundred lines of prose arguing that no worker may
   touch what it does not own. Proximity to a correct principle is not compliance
   with it.

**Three refinements to point 2, all earned by `PUP-WO-0102` and all the builder's.**
Point 2 said a stub that cannot fail is not a test. Each of these is a way that is
true while looking nothing like a degenerate stub:

- **A stub that cannot POSE the question is not a test either**, and it is harder to
  catch because nothing about it looks broken. A fake request that is `{ url }` and
  nothing else cannot express a navigation, so a worker exempting top-level
  navigations from a decline is *structurally invisible* to it. Same defect in
  another costume: a check that runs the **mirror** of an invariant's stated test —
  seeding stable and reading from root — never exercises the promoted copy's own
  read, which is the thing the invariant is about.
- **The dangerous stub value is not always the degenerate one; it can be ordinary
  success.** The rule "a stub fails silently exactly when its neutered return value
  is also a legitimate one" is right about a class — it found two real instances —
  and incomplete at the boundary. A *resolving* `fetch` is not degenerate at all; it
  is what an online browser hands the worker on every request. Neuter it and the
  worker never reaches its offline branch, so **the assertion passes by not
  running.** That phrase is the general hazard: an assertion that is never evaluated
  is indistinguishable, in a green run, from one that passed.
- **Proving a detector is load-bearing requires removing a SOLE detector, not one of
  two.** An attempt to show one assertion mattered came back green because a second
  assertion caught the same defect from the other direction. Two true things at
  once — redundancy working, and a badly designed meta-test. *(Recorded because the
  failed first attempt is what makes the second worth anything.)*

**The family, stated once, because it now has four members and one shape.** Each is
a run whose exit code is indistinguishable from a sound one:

1. **An assertion that passes by not running** — neuter a stub with an *ordinary
   success* value and the code never reaches the branch the assertion guards.
2. **An assertion that passes and certifies the forbidden state** — the check ran,
   compared what it was told to compare, and the thing it compared was the thing the
   invariant forbids. `PUP-WO-0103`'s own headline evidence read *"root
   tree=b00e76ad published=b00e76ad / promoted tree=b00e76ad published=b00e76ad"* —
   two identical hashes, written down as proof the check works.
3. **A failure whose cause is not the one under test** — red, and red for the wrong
   reason. Four occurrences in one work order (§5's *red is not a demonstration*).
4. **A pointer that resolves in the author's head and not in the reviewer's tree.**
   **Every path a review prompt cites is an assertion that the file exists in the
   tree the reviewer is given**, and nothing in a freeze checklist resolves one:
   head, tree, protected-surface diffs and green checks are four checks, none of
   which opens a path the prompt names. *(`PUP-WO-0103`'s frozen prompt cited
   `PUP-WO-0104.md` and `§6.2`; both existed on `main` and neither existed on the
   branch, so its M9/M7 fence was inert and the authority that removed the rollback
   lever was unreadable — leaving a reviewer to read a removed surface as an
   unexplained deviation from a work order that still demanded it.)*

**In all four the verdict was read instead of what produced it.** Members 1–2 are
green, 3 is red, 4 never runs at all — which is why "look harder at the result" has
never been the fix for any of them.

**Member 4 is one line, and being mechanisable makes it a rule rather than advice**
(§5): before dispatching a pass, resolve every path and every section the prompt
cites **against the frozen tree, not against `main`** — and **when the resolver
reports a miss, print the surrounding lines of the cited file, never the count.**

That second clause is not decoration. **Member 4's enforcement is itself subject to
member 3, and not incidentally: a pointer resolver's entire job is to turn absence
into red, so every bug in it presents as a dangle.** It is the one check on this list
whose false positives are indistinguishable from its true positives without opening
the file. *(Demonstrated within a minute of member 4 being ratified: a case-sensitive
grep for a quoted invariant reported zero matches, and the invariant was present and
materially identical at `docs/northstar.md:62` — the prompt embeds the quote
mid-sentence with a lowercase article. A dangling pointer was nearly reported that
had never dangled.)* Printing the lines rather than the count is what makes the
tool built to enforce *read what produced the verdict* obey it. *Not assigned to a work order
here — it belongs wherever CI is next opened, and this project has learned what
happens when scope is added to a work order already in flight.*

**A freeze verifies that the artifact stopped moving. It does not verify that the
artifact was correct when it stopped**, and a stale baseline passes every freeze
check there is.

**And the standing consequence:** a check that verifies the checks — restoring each
defect and requiring red, then neutering each stub and requiring the blindness to be
contradicted — is worth its cost here, because §6.1 exists precisely because a defect
shipped under a fully green gate. Such a check **will** go red when a legitimate edit
breaks a mutation's anchor. **That is not flakiness and must not be treated as it:**
flaky means red for reasons *unrelated* to the change; an anchor break means red
*precisely because of* the change, and updating the mutation is the correct response.
Deleting it is how the gate goes quiet again.

*(Found by `PUP-WO-0101`'s adversarial pass; confirmed at source by CC-A. All three
points are the builder's, ratified here substantially as written.)*

### 6.2 The `stable` ruleset — verified in both directions

*Added 2026-09-01. Read from the ruleset API and re-proven with a real push; an
earlier draft of this section asserted the opposite and was wrong, see below.*

`Protect-stable` on `refs/heads/stable` carries **deletion**, **non_fast_forward**
and **update**, and its `bypass_actors` carries **`RepositoryRole` id 5 —
repository admin — at `bypass_mode: always`**, plus an `Integration` bypass that is
**not** the App that mints this project's tokens.

Both directions are established, which is the part that matters:

- **It permits the human.** Repository admin bypasses `update` and
  `non_fast_forward`, so Scotty can fast-forward-promote *and* force-push `stable`
  backward. This was true from the day the ruleset was created.
- **It refuses the token.** A minted installation token pushing to
  `refs/heads/stable` returns `GH013 Cannot update this protected ref`, and `stable`
  did not move — `2952aa1` before and after. **An installation token is not a
  repository admin**, and that asymmetry is the firebreak.

**Consequence for `PUP-WO-0103` §1.7: the rollback lever is removed, not hardened.**
The human's promotion and rollback authority already exists structurally, verified in
both directions. A workflow lever is a second and weaker mechanism for an authority
already correctly implemented — and the pass showed it never moves the ref, so the
next push to `main` silently republishes the tip. The **entire `workflow_dispatch`
input surface** goes with it — but **only because the publish job gains a
`pull_request` path first**, and that ordering is load-bearing.

A bespoke verification mode that exists only to test is itself a second path to
publication, needs its own gate, and that is exactly where `PUP-WO-0103`'s F2 lived.
But the publish job's gate was `(push && (main || stable)) || workflow_dispatch`,
with **no `pull_request` at all** — so the `demo/refuse-*` branches could not
demonstrate anything through a PR, and all three archive refusals had in fact been
exercised by dispatch. **Deleting the surface without adding the PR path would have
made the archive refusals undemonstrable** — shipping the three steps between a
poisoned tree and the child's tablet untested, permanently, which is the very
failure a check-that-can-go-red exists to prevent.

So the publish job runs on `pull_request` **without** the upload and deploy steps.
It already needs nothing beyond `contents: read`; `pages: write` and `id-token:
write` live on the `deploy` job alone, which stays gated to a push. The refusals are
then demonstrated on **the path that actually publishes** — better evidence than a
path built for demonstrating — and the dispatch surface is genuinely unnecessary
rather than merely unwanted. *(CC-A's original ruling asserted the PR path already
existed; the builder read the trigger and showed it did not, then proposed this.)*

**The finding worth more than the fix: an instrument that cannot return a negative
is not a test.** Two readings produced the wrong answer here, both incapable of the
answer that would have corrected them:

1. The read-only `gh` shim returned a ruleset response **with no `bypass_actors`
   field at all**. A `KeyError` was read as *the list is empty* — **absence of the
   field reported as absence of a value.** A response that omits a field cannot
   distinguish "none" from "not shown."
2. `git push --dry-run` printed `2952aa1..c0f3693 stable -> stable`, taken as proof
   the token could reach `stable`. **`--dry-run` never sends the update, so the
   server never evaluates the ruleset.** That line is git's *local prediction of what
   it would attempt*, not a verdict. A dry run cannot fail the way a real push fails.

This sharpens §8's rule rather than repeating it. It is not enough to ask the
question — **the instrument must be capable of returning the answer you would need to
hear.** Both of these could only ever produce the answer they produced. The
correction came from a real push and a field-presence check, both of which could have
come back the other way.

**And P1 was never blocked by this.** An earlier draft of this section claimed
`stable` was frozen against its owner and that P1 could not complete. That was
false. P1 gate 3 is unsatisfiable today only because `PUP-WO-0103` has not merged and
Pages has not been flipped — expected sequencing, not a defect.

### 6.3 There is no `github-pages` branch, and there must not be one

*Ruled 2026-09-01. Verified first: `git ls-remote --heads` shows no such ref.*

Under the Actions build type Pages publishes by **artifact upload**, not by pushing a
branch, so no `github-pages` ref is created and none is needed. Writing protection
policy for it would protect nothing.

**The policy is the inverse of the obvious one: the appearance of a `github-pages`
branch is an alarm, not a thing to protect.** Its existence would mean someone
introduced a branch-push deploy path — **a second route to publication that bypasses
every gate `PUP-WO-0103` builds**, including the invariant-4 byte check and the
prefix-bounded worker refusal. The question would be who created it and what
publishes from it, not what ruleset to apply.

## 7. Deferred with intent — realtime co-op

Not in scope, and deliberately not left to be bolted on. Phase 1 shapes itself so
phase 2 is "move existing state across a channel" rather than "invent multiplayer".

Four seams, all cheap now and expensive later:

1. **The engine stays pure and player-agnostic** — no module-level singleton state.
2. **Trays are an array keyed by player, not a single tray.**
3. **All board mutations flow through one reducer taking `{playerId, action}`**, so
   a network layer replays actions rather than syncing state.

   **Cost correction, 2026-09-01 — seams 2 and 3 are net-new construction, not
   preserved structure.** The ruling stands; the estimate under it did not. Block
   Pop's source contains **zero** occurrences of `player`, `players` or `playerId`,
   and mutates the board from **five** separate actions, only one of which is
   reducer-shaped. "The cheapest seam to install" and "`classic` needs this
   regardless" both described a refactor the source had already half-done. It has
   not. This changes **P4's shape, not merely its estimate** — `PUP-WO-0400` is
   building these seams, not preserving them, and must be scoped and reviewed as
   such. *(Found by `PUP-WO-0000`; the original claim was made from a chat-session
   reading of the source.)*
4. **Registry entries declare `players`**, so the picker can show a two-player
   badge without knowing how it works — **and the module can read it.** `players`
   reaches the game through `api.entry` (`docs/findings/PUP-WO-0000.md` §8.3), so
   this is a seam into the game rather than a label on a tile. *(Amended 2026-09-01:
   as originally specified there was no channel from a registry entry into a module
   at all, so this seam terminated at the picker. Found by `PUP-WO-0000`'s
   adversarial pass — the single defect most likely to have produced built-wrong
   work in P4.)*

**Local co-op on one tablet is the first proof** — two trays, one board, no network
at all. If that does not feel good, the networked version will not either.

## 8. Security posture

- **Invariant 2 is enforced by the browser and by having no navigation out**, not
  by the lock button. §3.1 is explicit that the lock gates nothing; no work order
  may treat it as containment.
- **No third-party network calls from any games surface.** Northstar §5.
- **No data about Buddy is collected, stored, or transmitted.** Northstar §5.
- **A boundary heartbeat cannot distinguish stopped-because-done from
  stopped-mid-work**, and that ambiguity has cost real hours. *(Found 2026-09-01: a
  builder stalled mid-work, its last heartbeat had correctly reported a work-order
  boundary, and from outside the stall was indistinguishable from a park.)*
  `dual-cc-session-design-v2.md` §5's rule — silence must mean stopped — is
  satisfied and insufficient: **silence is no longer the failure mode; an
  indistinguishable signal is.** Standing requirement: a session that stops
  mid-work says so explicitly and names its next step. The one stall that was cheap
  to recover was cheap *only* because the builder's final line named where it had
  stopped, which let it be resumed at that point instead of re-deriving it.
- **Ending a turn is not stalling, and no artifact can tell them apart.** A session
  that finishes a turn with a status report and no abandoned action is idle *by
  design*. A stalled one looks identical from outside — and so does one mid-subagent.
  Three states, one appearance. *(Found 2026-09-01 across a false alarm and the
  wrong correction to it.)*
- **A liveness signal sampled only at turn boundaries cannot see work that happens
  between them.** A watchdog reading a state file that advances only when a turn ends
  reports a session running a long subagent as indistinguishable from a dead one. A
  liveness check must take the newest of several independent clocks, at least one of
  which advances *while* work happens, and require agreement before declaring a stall.
- **Busy-versus-idle cannot answer "was this already underway?" — only a start time
  can.** The distinguishing signal is *when the work began*, measured against *when it
  was asked for*. This is the sharp one, because it is where the same defect recurred
  **inside its own correction**: a watchdog false-positive was diagnosed as a stall on
  evidence that could not separate stalled from working; the retraction then asserted
  the session *"had been running the whole time"* on evidence that could not separate
  *already running* from *started because it was told to*. Both were wrong the same
  way. **In both cases a signal that could have settled it was available and unused.**
  The instrument was not missing — **it was not asked the question.** Generalise from
  that rather than from "the watchdog was wrong."
- **Retract the false claim, not everything attached to it.** The same message that
  wrongly asserted a stall also carried a correct finding — that the frozen artifact
  omitted the builder's feedback file, putting the build-phase evidence outside what
  the reviewer would see, which is the `PUP-WO-0101` failure the broadened freeze rule
  exists to prevent. Acting on it produced a 203-line feedback file committed *as* the
  freeze, so the pass read a complete artifact. A blanket "disregard my last message"
  would have thrown that away. **And one data point survives the retraction:** the
  `PUP-WO-0102` stall at the freeze-then-dispatch boundary was real. One instance is
  not a pattern and does not justify a process change — but it is not zero, and it
  stays on the record as an open one-off rather than being retracted alongside the
  false one.
- **Commit each coherent unit as it is completed — not before you stop.** *(Ruled
  2026-09-01 after a builder stalled mid-fix on 172 uncommitted lines that were the
  only copy.)* The obvious form of this rule is "commit before you stop", and **it
  cannot be obeyed at the moment it matters**: a stall is precisely *not* choosing to
  stop, so a rule that fires when you know you are finishing protects only the cases
  that were already safe. The checkpoint has to be driven by **the work reaching a
  coherent state**, because no session knows which turn is its last. A wip commit is
  recoverable from the reflog; an unstaged change is one bad command from gone.
  Detection already exists — the watchdog classifies *working-with-uncommitted*
  correctly — but detection is after the fact, and nothing yet acts on it before.
- **The build loop's notification channel is notify-only** while the ntfy server has
  no ACL (§3). Topics are unguessable rather than authenticated, which is adequate
  for alerts and inadequate for anything that acts. The standing rule holds: an
  alert summons a human to decide, and never carries the decision. Adding an action
  button that causes work to proceed converts an unauthenticated channel into a
  command path into a session that runs commands — that is gated on ACL.
- **Merge credentials** are minted narrowly and scoped to this repository alone. The
  Precision's read-only `gh` is not widened (§3).

## 9. Traceability

**No governing standard applies to PupPad.** ClearSeal governs MCP servers and
PupPad exposes no MCP surface. Recorded so the question is visibly asked rather
than silently skipped.

The *build process* is governed by `dual-cc-session-design-v2.md` (2026-08-29):

| Control | Clause satisfied |
|---|---|
| Merge reaches repo and test path only; promotion is human | §6 — "merge is not deploy", the structural basis for delegated merge |
| Adversarial pass by a fresh, context-isolated subagent, recorded verbatim | §7 clause 2, load-bearing once CC-A merges |
| CI as a check that can go red | §7 clause 3 — "prove the rejection, not the issuance" |
| Two worktrees, one writer per tree | §2 |
| Info and decision tiers on separate ntfy topics | §8 |
| Unconditional heartbeat at every WO boundary | §5 — silence must mean stopped |

## 10. Open questions

| Question | Decider | What it blocks |
|---|---|---|
| Does CC-A mint per-merge inside an approval window, or park at merge for the pilot? Current scope: **park at merge**, so the loop is tested without delegating merge — one new variable at a time. | Scotty | Whether P1's gate includes an autonomous merge |
| ntfy ACL — Scotty reports it is imminent for another build. | Scotty | Any inbound action button; §8 |
| Cold-start budget on Buddy's actual tablet: what number counts as too slow? | Scotty, from measurement | P2's exit gate has a measured threshold or a subjective one |
| Whether `classic` appears in Buddy's picker or only under an adult affordance. | Scotty | P4 scope |
| **Northstar §5 forbids third-party network calls as a category, and `index.html:11-13` make three of them unconditionally** (Supabase via jsdelivr, Leaflet CSS and JS via cdnjs), plus OSM tiles at `index.html:1373`. Either the non-goal is narrowed to exclude the pre-existing console, or the loads are vendored. **This is a northstar re-ratification, not an architecture amendment** (§1), and CC-A has deliberately not written it. | **Scotty — re-ratify** | `PUP-WO-0600`'s scope, and how much of P6 exists |
| The Supabase **anon key** renders into a cleartext input at `index.html:1818`, persisted at `:173`, and Settings is reachable while the console is "locked" (`:1736-1737`, unconditional). What is the intended containment, given §3.1 says the lock contains nothing? | Scotty | `PUP-WO-0601` |
| The service worker is **network-first** (`sw.js:31-43`), so an online cold start waits on the network before rendering. Does that survive P2's cold-start gate, or does the worker become cache-first for the install set? | Scotty, from measurement | P2 gate item 5; `PUP-WO-0600` |

## 11. Amendments

| Date | Change | Reason |
|---|---|---|
| 2026-08-31 | Document created. | First architecture; repo shipped without one. |
| 2026-08-31 | §5 adversarial-pass ownership reversed: CC-B runs it as a black-box task; `FEEDBACK.md` records the exchange verbatim. §9 traceability updated to match. | The original ruling located independence in *who dispatches*. It is actually a property of *context isolation*, which a black-box subagent achieves directly and more cheaply. The verbatim requirement closes the gap the original ruling was reaching for — it makes the quality of the builder's own adversarial pass reviewable rather than taken on trust. Raised by Scotty; the superseded ruling was Claude's. |
| 2026-08-31 | §6 cache-hazard fix corrected: namespacing `CACHE_NAME` is insufficient because `caches.keys()` is origin-scoped; the activate reap must be prefix-bounded. §2 corrected — only three of eight buttons open panels, and `attachEvents()` is an id `if`-chain, not a router. | All three found by CC-A reading the code against the documents, before dispatch. The cache error would have shipped a `/stable/` split that silently destroyed Buddy's offline cache — the exact failure the split exists to prevent. The §2 errors were mine, from a chat-session reading. |
| 2026-08-31 | §6 gains the bootstrap exception: P0 and P1 merges reach the live path by necessity, and are safe on the narrower `docs/`-only property rather than on the firebreak. | Found by CC-A on its first read. Recorded so it does not later read as a violated rule. |
| 2026-09-01 | §6's bootstrap exception extends from `docs/` to `.github/`. | `PUP-WO-0100` must add a workflow before the firebreak it builds exists. Pages under `build_type: legacy` serves `main:/` as static files and does not serve `.github/`, so the same narrow property holds. Stated because the exception is what makes the merge safe, and an unstated extension of a safety property is indistinguishable from a violation of it. |
| 2026-09-01 | §4's console↔module seam replaced with the concrete contract; §5 gains `api.tone`; §7 seam 4 becomes a real channel and seams 2–3 are re-costed as net-new construction; §3's cached-assets row corrected. | All from `PUP-WO-0000` and the seven load-bearing defects its adversarial pass found. The two that mattered most were **invisible from the two games the contract was demonstrated against** — configuration and sound — which is the finding of that work order above either specification it produced. §3's row was wrong in a way that made the §6 reap look survivable. |
| 2026-09-01 | §5 gains the two-artifact adversarial record and the freeze-before-dispatch rule; `docs/FEEDBACK.md` placement ratified. | A 341-line transcript inside a 582-line `FEEDBACK.md` buries the findings it evidences. The freeze rule closes the one question `PUP-WO-0000`'s record could not answer about itself. Placement was found by that pass's own reviewer (F24) and matters because §6's exception rests on the `docs/`-only property. |
| 2026-09-01 | §5: feedback becomes per-work-order (`docs/feedback/<WO-id>.md`) and the freeze covers every file a work order names as a deliverable, not only code. `docs/FEEDBACK.md` migrated to `docs/feedback/PUP-WO-0100.md`; `PUP-WO-0000`'s transcript recovered to `docs/findings/PUP-WO-0000-adversarial.md`. | Two defects from `PUP-WO-0100`, one on each side. **The naming defect was CC-A's:** the two-artifact ruling made transcripts durable but left feedback a single rolling file, so the builder — following it exactly — destroyed the previous work order's record at the tip on the rule's first application. **The freeze defect was CC-B's**, self-reported and led with: it froze the code and rewrote its feedback mid-pass, so the red demonstrations and the determinism justification went unreviewed. Both are cases of a rule being right in intent and underspecified in scope. |
| 2026-09-01 | **§6.1 added — the offline read is origin-wide too.** §5 gains two rulings: deploy ordering enforced by the workflow rather than by prose (with every published copy checked in the run that publishes it), and the standing question *"what legitimate behaviour does this fix now refuse?"* | `PUP-WO-0101`'s second adversarial pass. §6 documented only the *reap* and was incomplete in a way that **read as complete**, which is the more dangerous kind: it invited the conclusion that prefix-bounding the reap closed the hazard. The read makes the promoted copy serve the test build's bytes offline — invariant 7 falsified by the invariant's own stated test, with every check green. The ordering ruling comes from the same pass: `refs/heads/stable` still carries the origin-wide reaper, so a paragraph was the only thing standing between a flip and a deleted cache. All three points in §6.1 are the builder's, ratified substantially as written. |
| 2026-09-01 | §6.1 point 2 gains three refinements (a stub that cannot *pose* the question; the dangerous value can be ordinary success, so the assertion passes by not running; proving a detector is load-bearing needs a *sole* detector removed) plus the anchor-break-is-not-flakiness rule. §5 gains map-before-dispatch and search-for-the-belief. §8 gains the heartbeat ambiguity. | All from `PUP-WO-0102`, and all but one are the builder's, including a correction to a rule the builder itself wrote and CC-A had ratified. The two §5 entries are CC-A's own defects: a work order whose §2 forbade what its §3 required, and one wrong belief surviving two corrections because the search matched its wording rather than its meaning. |
| 2026-09-01 | §8 gains four entries on liveness: ending a turn is not stalling; turn-boundary sampling cannot see between turns; busy/idle cannot answer *was this already underway* — only a start time can; and retract the false claim rather than everything attached to it. **No cadence change was made**; §5's pass-dispatch step stands as ratified. | A watchdog false positive was reported as a second stall, CC-A drafted a process redesign on it before confirming the session had stopped, and then **the correction repeated the error one level up** — asserting the builder had been running all along, on a signal that could not distinguish that from *started because it was told to*. The builder produced the timings that settled it. Recorded because the recurrence inside the correction is the reusable part, not the original alarm. |
| 2026-09-01 | §8 gains the checkpoint-commit rule, in the form that survives an unexpected stop. | A builder stalled mid-fix holding 172 uncommitted lines that existed nowhere else. The instinct — *commit before you stop* — is right and unenforceable, because the stop was not chosen; stated as *commit each coherent unit as it is completed*, it fires during the work rather than at an end nobody can predict. Recorded with the asymmetry that prompted it: the architect's own tree happened to be clean, which was luck rather than discipline, and is the argument for the rule rather than against needing one. |
| 2026-09-01 | §6.2 records the `stable` ruleset verified in **both** directions and removes `PUP-WO-0103`'s rollback lever and its whole dispatch surface; §6.3 rules that no `github-pages` branch exists or should, and that its appearance is an alarm. | The ruleset permits repository admin and refuses installation tokens, both now proven — the second by a real push returning `GH013` with `stable` unmoved. The authority the lever was built to provide already existed structurally, so the lever is removed rather than hardened, taking F1 and F2 with it. **Ordering matters: the dispatch surface could only be removed once the publish job gained a `pull_request` path, or the archive refusals would have become undemonstrable.** **The reusable finding is an instrument that cannot return a negative:** a shim response omitting `bypass_actors` was read as an empty list, and a `--dry-run` push was read as a verdict though it never reaches the server. Both could only produce the answer they produced. |
| 2026-09-01 | §5 gains: red is not a demonstration — assert the commit that ran and the failing step's name, never the conclusion alone. | Four times in `PUP-WO-0103` a red run was read as a successful refusal demonstration, each red for the wrong reason, the last of them a stale run for a superseded commit. The builder named it as one missing habit rather than four mistakes and observed it was mechanisable, which is what makes it a ruling. It completes a pair with §6.1: a green run certifying nothing and a red run proving nothing are the same defect — the verdict read instead of what produced it. |
| 2026-09-01 | §6.1 gains the family stated as one shape, with a fourth member: a pointer that resolves in the author's head and not in the reviewer's tree. Plus: a freeze verifies stillness, not correctness. | The builder's, and its form is better than CC-A's: *every path a review prompt cites is an assertion that the file exists in the tree the reviewer is given*, and a freeze checklist resolves none of them. Found when a frozen pass prompt cited two files that existed on `main` and not on the branch, making its own out-of-scope fence inert. Members 1–2 are green, 3 is red, 4 never runs — the reason "look harder at the result" has never fixed any of them. |
| 2026-09-01 | §6.1: member 4's rule gains its second clause — print the cited file's surrounding lines on a miss, never the count — because **member 4's enforcement is itself subject to member 3**. | The builder's, found while running member 4's first real enforcement, about a minute after it was ratified: a case-sensitive grep reported a quoted invariant as missing when it was present and materially identical. A pointer resolver exists to turn absence into red, so every bug in it presents as a dangle — making it the one check whose false positives are indistinguishable from its true positives without opening the file. The tool built to enforce *read what produced the verdict* did not obey it. |
| 2026-09-01 | §10 gains three open questions: the northstar §5 CDN contradiction, the cleartext anon key reachable while locked, and network-first versus the cold-start budget. | All three are defects in **PupPad as it stands today**, not in the games work, surfaced by P0. The first is explicitly *not* amended here — a change to a northstar non-goal is re-ratified there (§1), and CC-A does not hold that authority. Roadmap P6 is where they get built once ruled. |

## 12. Provenance

Written by Claude (chat architect) with Scotty, 2026-08-31. Ground truth in §3
measured the same day against the live repo, the Precision host, and the GitHub
Pages API; commands are cited inline. Game sources are two Grok-generated
workspaces provided as uploads and read directly. Build process rests on
`dual-cc-session-design-v2.md` (2026-08-29), an input document, left where it is.
