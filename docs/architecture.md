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

**THE FLEET, ANSWERED BY SCOTTY 2026-09-02 — AND THERE IS NO TABLET.**

| Device | Whose | Landscape CSS viewport |
|---|---|---|
| **Galaxy S10+** | **Buddy's — this is "the PupPad"** | ~869 x 412 |
| Galaxy S20 Ultra | grampa's | ~915 x 412 |
| Galaxy S25 Ultra | Scotty's | ~883 x 412 |

*Widths are the standard CSS viewports for these models and should be confirmed on
the device; **the height is the number that matters and it is ~412 on all three**.
Every conclusion below holds anywhere in 360-412, so resolving the exact value does
not change any of them.*

**EVERY VIEWPORT THIS PROJECT HAS EVER TESTED AGAINST IS THE WRONG SHAPE, WITH ONE
EXCEPTION.** `1024x640`, `1024x600`, `800x480`, `640x480`, `1920x500`, `880x600` are
all tablet- or desktop-shaped. **`915x412` occurs exactly once in the entire repo**
(`index.html:2247`, inside an adversarial-pass note) and it is the only phone-shaped
size anywhere. The fleet is three phones in landscape: **a wide, very short strip**,
not a tablet.

**WHAT THAT DOES TO `PUP-WO-0400`, COMPUTED RATHER THAN ESTIMATED.** Block Pop's play
column is four stacked bands — header 61.6, stats 52.5, board, tray+tools 220.8. The
board is `min(560px wrapper - 24, 72dvh)`:

| | 72dvh | wrapper | board | **column** | **vs 412** |
|---|---|---|---|---|---|
| all three phones | **296.6** | 536.0 | **296.6** | **631.5** | **153% over** |

**Two inversions of what the reconnaissance concluded, both caused by measuring
against assumed tablet sizes.** (1) `PUP-WO-0400-recon` §2.1 ruled the 72dvh cap "a
no-op on every target viewport" because `max-w-[560px]` binds first — **true at 768-820
tall, false here**: at 412 the cap is 296.6 and it binds decisively. (2) The overflow
is not a 60px tail that a re-layout trims. **The column is more than half again the
whole screen even after the cap binds**, and the board alone at its *uncapped* 536px
would be 130% of the viewport height.

**AND THE PANEL DRAWER TAKES 78% OF WHAT IS LEFT.** `max-height:78vh` is 321px of 412,
so a game whose controls are painted in that band has **91px of height** outside it.
Add `#gameBack`'s fixed y 62-126 and the usable strip is smaller still. **This is what
decides §8.8's assists question and it is not close**: Block Pop's four assists go
through the panel seam, or Block Pop has no room to put them.

**One more phone-versus-tablet difference to carry into any layout:
`env(safe-area-inset-*)` is very likely NON-ZERO here** — punch-hole cameras and curved
edges become *side* insets in landscape — where on a tablet it is usually 0. The panel
already spends `max(84px, calc(env(safe-area-inset-left) + 74px))` and degrades
correctly; **a layout that hard-codes 84 does not.**

**Still not measured.** Cold-start time on the S10+. No performance budget in §6 rests
on a number from that device; the budget is stated as a gate to be measured during P2,
not as a fact. **The S10+ is also the oldest and slowest of the three, so it is the
one the budget must be measured on** — not Scotty's S25 Ultra, which is the device
most likely to be at hand.

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
| What watches for work PARKED AND UNCLAIMED? | **Nothing did, and that is a hole the builder-stall watchdog cannot see.** A liveness monitor scoped to an ACTOR cannot detect work stranded BETWEEN actors. | *Ruled 2026-09-02, after `PUP-WO-0201` sat green and unmerged for hours.* The watchdog watches **the builder** for a stall; `SendMessage` is the handoff and the Stop-hook heartbeat notifies the operator. **But if the final `SendMessage` does not land, or the architect's turn has already ended, the PR sits and the architect never learns** — CC-A had not declined to merge, it had nothing to merge and nothing woke it. **This is "silence means stopped" one level up:** every existing instrument asks *is this actor alive?*, and none asks *is this work claimed?* **The mechanism:** the watchdog already runs every five minutes and can equally ask for an open PR whose head is pushed, whose checks are green, whose base is `main`, and which has sat past a threshold. **Three design constraints, each from a real case:** the `base == main` filter is required or the three deliberately-parked `demo/pr-refuse-*` PRs fire forever; ~20–30 minutes is the threshold, because CI alone takes ~4; and **it must wake the party who can ACT** — notifying only the operator converts an automation gap into a human polling loop, which is the thing being removed. |
| A gate that cannot see its subject? | **Is not a gate.** Before trusting a check's verdict, verify it was pointed at the thing under test. | *Ruled 2026-09-02, on three occurrences in twelve hours.* `check-cache-name` resolves its diff base from the PR event and falls back to `HEAD~1`; run in a bare clone it compared a commit to its own predecessor and **passed on a defect CI caught immediately** — the builder's "did not reproduce" was that. A park pushed with **no PR** produced **zero CI runs**, and a local suite was reported as the gate. And CC-A's own fence check **passed vacuously against a ref that did not exist**, because the push had failed on an expired token. The check was not wrong in any of the three; **it was not asked the question.** |
| A derived count in a name, title, or comment? | **No — unless something recomputes it.** | *Ruled 2026-09-02; the builder's, and it is better than the instruction it answered.* `ci.yml`'s job read **"Ten checks" while running fourteen** — a wrong number in the highest-traffic string in the file. CC-A authorised "rename it to what it runs"; the builder named it **`Checks`** and asked to be overruled if a count was meant. It was not: **"Fifteen checks" is the same defect with a fresher number and a shorter fuse.** A countless name is permanently accurate. Same family as the freeze manifest's self-referential SHA. |
| A measurement whose subject includes itself? | **Cannot be stated as a constant.** State the property, and let any count name its own subject. | *Ruled 2026-09-02.* A gate row read "9 files" — true one commit earlier and **12 at the SHA that shipped it**, because the count excluded the feedback file making the claim. Third of its shape after the manifest SHA and the job name: **an identifier or a tally that describes a thing from inside it.** |
| Where does a work order state its fence? | **ONCE. Every other section references it and none restates it.** | *Ruled 2026-09-02 after four self-contradicting work orders, three of them CC-A's:* `PUP-WO-0102` §2/§3.1, `PUP-WO-0105` §0a.4/§3.1, `PUP-WO-0200` §2/§3.1, and roadmap P2 gate 1. Every one was the same mechanism — a constraint written in a fence **and restated** in an acceptance criterion, drifting the moment either changed — and an allowlist and a denylist of one constraint **share no vocabulary**, so a search for the token never finds the other copy. Not a discipline problem; a shape problem. `PUP-WO-0300` §0 is the first built this way. |
| How is a frozen tree isolated from its pass? | **`git archive` for a read-only pass; `git clone` when it must run git-dependent checks. NEVER `cp -r` of a worktree.** | *Ruled 2026-09-02, on the builder's diagnosis.* The old protocol said "copy it and treat it as read-only" — but **in a worktree `.git` is a POINTER FILE**, so `cp -r` copies the pointer and the copy writes to **the real repository**. A lens committed on top of a frozen HEAD and reset it. The instruction was **a convention with nothing enforcing it**, which is the defect class the pass was auditing for. `git archive` yields a tree with **no `.git` at all**, making a commit *inexpressible* rather than forbidden. **`git worktree add --detach` was considered and rejected: a worktree shares the object store**, so a commit still writes real objects; detaching only stops a branch ref moving. Remove the capability, do not constrain it. |
| A third review layer? | **No — add a check that can go red instead.** | Two judgment-based reviewers already share a context and a disposition; a third correlates with them, inflating findings-count while lowering real detection. CI cannot be persuaded. |
| Realtime co-op | **Do not build. Wire the seams, spike it later.** | See §7. |

**Departure from house default:** ClearForge projects normally deploy through CI to
a controlled target. PupPad publishes to GitHub Pages from a branch. §6 records how
the firebreak is reconstructed rather than assumed.

**A MISSING CHECK AND A PASSING ONE ARE THE SAME COLOUR.** *(Ruled 2026-09-03. **CC-B's
finding, and CC-A merged every instance of it.**)*

**Four checks sat on `main` registered nowhere** — `demo-radar.mjs`,
`demo-radar-controls.mjs`, `demo-zoom.mjs`, `demo-zoom-controls.mjs`. **15 check files,
11 registered.** The radar fix and the zoom hardening shipped **with no CI protection at
all**, each written with its controls, each shown red against a planted defect, and **none
of them able to catch a regression in anyone's build but the author's.**

**THIS IS PASSES-BY-NOT-RUNNING IN THE REGISTRATION RATHER THAN THE ASSERTION, and every
instinct built for the second one is blind to the first.** The check runs locally, goes
red on the plant, does its whole job in front of you — **and the step that makes it exist
for everyone else leaves no trace when it is skipped. Nothing fails. CI stays green.**

**CC-A'S REVIEW HAS THE SAME HOLE AND IT IS WHY THIS REACHED `main` THREE TIMES.** The
merge discipline verifies **the fence** — what was touched — **CI green**, and **the fix
at source.** *It never asked whether an added check RUNS.* **Scope answers what changed;
it does not answer what became active.**

> **ADDED TO EVERY MERGE, ALONGSIDE THE FENCE CHECK: every `demo-*.mjs` added by the PR
> must appear in `ci.yml`, and the count of check files must equal the count
> registered.** One command, and it is now the only thing standing between a written
> check and an ornamental one.

**A SECTION MUST CARRY ITS OWN WITNESSES, BECAUSE THE ISOLATION MODE THAT PROVES IT CAN
SEE IS THE MODE IN WHICH IT CANNOT.** *(Ruled 2026-09-04, from `PUP-WO-0702`'s second
round.)*

`PUP-WO-0702`'s headline section asserted that the map reaches no network. It had **no
WebSocket hook of its own** — the previous section installed one and restored it in its own
last line — and **it never set `supabaseUrl`**, so `supabaseFetch` resolved against an empty
base, went same-origin, and was discarded by the outbound filter. In a full run it caught a
re-added coordinate POST **only because the earlier section leaked a global it had forgotten
to restore.**

**And `--only=N` is exactly how the controls harness runs a section.** So the mode used to
demonstrate that the section can go red is the mode in which its borrowed witnesses do not
exist. Three separate re-additions of a child's coordinates — a raw socket, a REST POST, and
a channel — passed green under it.

> **Every section installs and restores the witnesses it asserts on. A witness inherited
> from a neighbour is not a witness; it is an ordering assumption that the isolated run
> silently removes.**

*Its companion, from the same round: **a failed ARRANGE must be a reportable condition.** A
plant that made the setup throw produced a stack trace where a `FAIL` line belonged — the
third time that file had learned it.*

**A STUB IS LEGITIMATE FOR BEHAVIOUR AND ILLEGITIMATE FOR EGRESS.** *(Ruled 2026-09-04.
**The builder's, and it invalidated the defence their own check had written for itself.**)*

`PUP-WO-0702`'s headline check asserted that the treasure map reaches no network. It
stubbed Leaflet — defending the choice in its own comment as *"Leaflet is the DEPENDENCY,
not the subject; nothing below asserts anything about Leaflet."* **That was wrong on its
own terms: the outbound witness measured nothing but Leaflet.** `L.tileLayer` is the only
thing in that panel that makes a request, so stubbing it removed the entire subject of the
measurement and left a green run certifying silence it had arranged.

> **Egress is a property of the REAL dependency, not of the code that calls it. A check
> that asserts what does or does not leave the device may not stub the thing that does the
> leaving.** Stub freely to make behaviour reachable; never to make the network quiet.

*Its sibling: the same check's socket witness used `page.on('websocket')`, which fires only
on a CONNECTED socket — and CI's connections fail before the handshake. It recorded zero
while a constructor hook caught three attempts. **Zero was a silence, not an absence**, and
that is the same error one layer down.*

**AND A SUITE CAN STOP EXERCISING A TRANSPORT WITHOUT EVER FORBIDDING ONE.** The same
section's outbound filter discarded same-origin requests while `supabaseFetch` resolves
against an empty base — so a REST-shaped re-add was invisible — and its channel stub had an
empty `send()`, so a broadcast piggybacking on the camera's already-open channel would ask
for zero new channels and pass. **"No transport was used" and "no transport is possible"
are different claims, and only the second is what a deletion buys.**

**A REPAIR INHERITS THE DEFECT'S SHAPE. PLANT THE FIX.** *(Ruled 2026-09-04, after it
happened THREE TIMES IN ONE WORK ORDER.)*

`PUP-WO-0703` produced five high findings and **three of them were created by the repair
for an earlier one:**

- **The fix for "delete does not stop the microphone"** added a guard that makes the decode
  callback return early — **and that callback held the only later `voiceSetStage`**, so
  deleting the slot being recorded over now leaves every preset, both sliders and the play
  button permanently dead. *A guard that suppresses a continuation also suppresses
  everything that continuation was responsible for.*
- **The fix for an assertion that could not fail** replaced it with `idleRaf`, sampled on a
  freshly opened panel where the handle is zero **in every possible build.**
- **The fix for "this compares a value to itself"** replaced the value with the literal `0`
  — **and `0` is what the defect also produces**, being at once the first slot, the played
  slot and the initial target.

**This is structural, not carelessness.** Repairing an unfalsifiable assertion means
asserting something *nearby*, and nearby is exactly where the same degeneracy lives: the
same scenario, the same arrange step, the same handful of values the state can hold.

> **A repair is a NEW assertion and inherits none of the old one's credibility. Plant it
> before believing it.** The question is never "is this better than what was there" — it is
> **"what edit makes this new line red, and does that edit reproduce the defect it names?"**

*The same holds for a code fix: after adding a guard, ask what the guarded path was
carrying besides the thing you were stopping.*

**PLANT THE CLAIM, NOT ITS CONSEQUENCES — AND FOR A REDUNDANTLY-CARRIED STATE THAT MEANS
THE STATE VARIABLE.** *(Ruled 2026-09-04. **The builder's, and it is the missing half of
the plant rule above.**)*

`PUP-WO-0703`'s central acceptance is that a child can tell three slot states apart with
every word covered. Its plants removed **one painted difference at a time** — amplitude,
then border width, then colour — **and each correctly reported GREEN**, because the row
carries four signals *by design* so that no single one is load-bearing on a dim screen.
Chasing them individually was not a weak plant; it was **the wrong SHAPE of plant.**

> **Name the claim in one sentence, then find the smallest edit that makes THAT SENTENCE
> false.** For a state deliberately carried by several redundant signals, degrading one
> signal is a change the design absorbs on purpose. **Collapse the state itself.**

*The corollary is a comfort, not a warning: a plant that stays green after removing one of
several redundant signals is **evidence the redundancy is real**. Read it as a measurement
of the design, then go and write the plant that actually contradicts the claim.*

**A PROBE THAT SELECTS ITS SUBJECT BY A VALUE FILTER CANNOT SEE THE VALUE IT IS HUNTING.**
*(Ruled 2026-09-04. The builder's.)*

A clamp probe found the node it wanted by filtering for a gain `> 0 && < 0.5`. **An
unclamped `99` fell outside the filter, was never read, and the probe reported clean** —
the check searched for its subject using the very property whose violation it existed to
detect. Read by **position**, or by identity, never by the value under test.

> **Same family as *check the effect, never the installation*: both are a check agreeing
> with itself. A filter written from the expected value is a rediscovery of the
> expectation.**

*And its process sibling, from the same round: **a watcher that matches only the success
marker is silent through a crash**, and silence is indistinguishable from still-running.
Wait on completion — success OR failure — never on success alone.*

**A PLANT THAT APPLIES IS NOT A PLANT THAT REPRODUCES.** *(Ruled 2026-09-03. **The
builder's, from `PUP-WO-0701` round 3, and it cost two false controls in one file.**)*

The standing rule was that every plant must be a real defect that parses and goes red for
its own stated reason. **That is necessary and it is not sufficient — it grades the patch,
not the demonstration.** Two plants in check 26 applied byte-for-byte, changed real
behaviour, and stayed **green**:

- **§15's** restored the orphaned-microphone defect exactly, but the scenario used one
  shared `getUserMedia` delay, so the second grant always settled first and the third tap
  became a STOP. **The defect was present and the gesture could not reach it.**
- **§9's** homoglyph pair was **assumed rather than measured**: Latin `A` against Greek
  Alpha renders *differently* in this font stack, so the plant was not a homoglyph at all.
  Latin against Cyrillic `A` is identical here; against `B` is the null control. **A branch
  would have been certified on a pair that does not exercise it.**

> **A control must show the check going red BECAUSE the planted defect was reached. When it
> stays green, the first suspect is the scenario, not the plant.**

**AND THE ARRANGE STEP IS PART OF WHAT MUST BE ATTACKED.** §16 opened with
`closeVoice(); openVoice();` — and `closeVoice` is exactly what zeroes the decode counter,
so its flood always ran from a freshly zeroed one. **Its pass line was true only of a state
its own setup manufactured**, and never of the state the app is in after a child has used
it. Run the identical flood without the leading teardown and the peak doubles.

**A GUARD ON A CALLBACK WITH TWO EFFECTS MUST BE SHOWN TO COVER EACH ONE.** *(Ruled
2026-09-03. **The builder's own defect, introduced by the fix for the previous one.**)*

The inbound decode callback both **sounds** a clip and **decrements** the in-flight counter.
The generation check covered sounding and not decrementing, so a decode still in flight at
teardown decremented a counter `closeVoice` had already zeroed: **one ordinary gesture — a
clip arrives, the child taps back while it is decoding — left the counter negative for the
life of the page**, and the cap whose whole purpose is to bound the allocation became
arbitrarily permissive. Measured 4 concurrent decodes against a cap of 3 after one cycle,
24 after seven.

**The comment asserted the opposite** — *"their callbacks check gen and will not sound, so
the counter is simply reset with them."* True of one effect, written as though it covered
both.

> **Enumerate a guarded callback's side effects and check the guard against each. "The
> callback is guarded" is not a property a callback has.**

**A WORK ORDER'S METHOD MUST NOT DEFEAT THE REASON IT GIVES FOR ITSELF.** *(Ruled
2026-09-03. **CC-A's defect, refused by the builder with the work order's own argument.**)*

`PUP-WO-0701` §S2.2 ordered three inline copies of `closeCamera`'s channel-release shape
into `closeCanvas`, `closeTreasureMap` and the new voice panel. **The justification
written one paragraph above it was that a rule expressed in many places rots** — the
"which code is older than the rule?" finding, which was the entire reason the fix was
worth folding in. The instruction manufactured four copies of the rule whose duplication
it was written to end. The builder refused it, hoisted `releaseChannel()`, and kept the
nulling at the call site because a callee cannot clear its caller's variable.

**This is the fifth self-contradicting work order in this project and it is a NEW SHAPE.**
The previous four contradicted their own **fence** — forbidding a file the body required.
This one contradicted its own **rationale**, which is harder to see: a fence conflict is
two rules in one document, and this is one rule and its own stated purpose, agreeing in
topic and disagreeing in direction.

> **Before dispatch, read each instruction against the reason given for it in the same
> section. If the method would produce the thing the reason objects to, the method is
> wrong — the reason is why the work order exists.**

*The catch is the builder's and cost one round trip; unrefused, it would have shipped four
copies of a rule under a paragraph explaining why four copies is the defect.*

**A HUMAN DECISION COSTS ONE THREAD, NOT THE LOOP.** *(Ruled 2026-09-03. **CC-A's
defect, found by the co-architect when Scotty asked why the cycle kept stopping.**)*

**Stopping for a human answer is correct. Stopping EVERYTHING is the defect.** When
`PUP-WO-0603` reached a question only the device could settle, the whole loop idled —
while **three work orders sat authored and unbuilt and blocked on nobody**: `PUP-WO-0104`,
`PUP-WO-0602`, `PUP-WO-0701`.

> **WHEN BLOCKED ON A HUMAN ANSWER: ASK THE QUESTION, THEN DISPATCH THE NEXT UNBLOCKED
> WORK ORDER. Do not idle waiting.** The answer arrives asynchronously and merges into
> whichever thread it belongs to.

**The failure is structural, not attention.** A blocking question *feels* like a stop
because the thread it blocks is the one in hand — and the queue is in a document nobody
re-reads while waiting. **Before idling, open the roadmap and name the next unblocked
item out loud.**

**A REQUIREMENT AND ITS BACKSTOP MUST NOT BE THE SAME NUMBER.** *(Ruled 2026-09-03.
**CC-B's, and it REFINES §6.1's two-expressions family rather than contradicting it.**
They refused half a CC-A ruling and measured before deciding.)*

CC-A ruled the picker's tile floor from an unmeasured `150` to a stated `96`, and then
added: *"reconcile the CSS `min-width` to the same source — one number, one place."*
**That instruction would have made the check unfalsifiable.** Demonstrated, not argued:

| CSS `min-width` | tile calc | renders | check `w >= 96` |
|---|---|---|---|
| 96 | `min(38vh,42vw,132px)` | 132 | green |
| **96** | **broken to `20px`** | **96** | **GREEN — cannot fail** |
| 64 | broken to `20px` | 64 | **RED** |

**`min-width` floors the COMPUTED size, so setting it equal to the assertion's threshold
guarantees the assertion passes** — architecture §6.1 member 1, arriving through a
*correction* to an invented number, with a better number.

**So they are deliberately different and do different jobs: `96` is THE REQUIREMENT and
lives in the check; `64` is THE RUNTIME BACKSTOP and lives in the CSS, at the board cell
Buddy demonstrably plays.** A broken calc then lands *under* the requirement and goes
red, while never handing a child a target smaller than one he already hits.

**THE REFINEMENT, and it is the durable half: the defect is two places holding the same
number FOR THE SAME REASON.** Two places holding **different** numbers for **different**
reasons, where one is asserted to lie below the other, is **a constraint** — and it is
**the only arrangement in which the check can watch the implementation fail.** *Same
shape as the fireworks ruling: duplication of a technique is not duplication of a fact.*

**AN OPERATOR QUESTION IS A SHARED RESOURCE, AND TWO SESSIONS ASKED THE SAME ONE
MINUTES APART.** *(Ruled 2026-09-02. **CC-B's, and it is the first defect in this project
that belongs to the PAIR rather than to either session.**)*

**What happened.** CC-B put the drag-lift trade to Scotty with **three** options — keep
the lift, drop to 34px, decide on the glass. **The taper did not exist yet.** He chose
34px, the even board, explicitly accepting a hand over the piece. **Minutes later CC-A
put the same trade to him with four options including the taper**, without knowing it had
been asked. He chose the taper. **Two different questions, two different answers, both
correctly quoted.**

**CC-B had already built `0.53` and was verifying it when CC-A's ruling arrived.** Had
the messages crossed the other way, or had CC-A's not arrived, **the branch would have
shipped the answer to the superseded question while the work order recorded the other —
with both sessions correctly citing the operator, and no way to tell which was current.**

**And then CC-A corrected CC-B's record using only CC-A's own half**, which would have
left the file saying he was offered the taper as one of four when he was first offered
three that did not contain it. **A true account of one asking is a false account of the
sequence.** The fix is neither account: **both askings and both answers.**

**THE PROTOCOL, and neither session followed any of it:**

1. **Whichever session asks the operator says so to the other, before the answer is
   acted on.** The question is the shared resource, not the answer.
2. **A ruling that adds an option to a question already asked must name which asking it
   supersedes** — otherwise two live answers exist and both are quotable.
3. **A request to "put it in front of him" must say WHO IS CARRYING IT.** That sentence
   is what caused this: CC-B wrote *"I want it in front of him rather than in a doc"*,
   CC-A read it as *you ask him*, CC-B meant *I am asking him*. **Hand-off or
   escalation — the words look identical and the consequence is a duplicate question to
   a human who then answers both.**

**The cost this time was one wasted build.** The mirror case is a directive and a build
that disagree while both cite the operator — which is unresolvable from the artifacts,
because the artifacts are both honest.

**THE SECURITY LENS FOLLOWS THE TRUST BOUNDARY, NOT THE IMPORTANCE OF THE FEATURE.**
*(Ruled 2026-09-02 by CC-A, delegated by Scotty — "you decide and we will run with it."
It sits under his calibration, which stands: this is a toy, per-work-order passes are
right-sized, and one deep pass runs at the end.)*

**The trigger is mechanical, so it is not re-argued per work order:**

> **A work order gets a security-shaped lens if and only if it reads, stores, renders or
> forwards a byte the device did not create.** Everything else gets the right-sized pass
> and nothing more.

**Under that rule, most of this project never gets one, and that is the point.** The
games are the clearest case: `check-games-offline.mjs` fails the build on `fetch`,
`XMLHttpRequest`, `EventSource`, `WebSocket` or `sendBeacon` anywhere in `games/*.js`, so
a game module **cannot** take untrusted input — the boundary is enforced by CI, not by
review. `PUP-WO-0400`, `0401` and `0402` correctly got no security lens and lost nothing.

**And the rule is not conservatism, it is where the findings actually came from.** Both
real vulnerabilities this project has had were on the boundary and were found by exactly
this lens: the **broadcast payload that executed script** (`showRemotePhoto` built
`'<img src="' + dataUrl + '"'` into `innerHTML` from a channel message, and
`PUP-WO-0700` extended one sink to three) and the **prototype-key brick**. Neither was
reachable from a game; both were reachable from a message.

**So the boundary work — camera, voice, and the co-op that adds a second device — gets
the lens AT the boundary rather than at the end.** The reason is timing, not severity: a
sink found at the end is found after the shape around it is built, and the XSS was fixed
in one line only because it was found while that code was still being written.

**What the lens actually asks**, so it is a pass and not a mood: *what does this accept;
what does it do with those bytes **before** validating them; and every place they end up
— rendered, stored, forwarded, concatenated into markup or a style.* The `dataUrl`
finding was three sinks from one payload, and only the third had been thought about.

**This does not replace the end-of-project sweep.** It is additive, and it is
deliberately narrow: **one lens, on the work orders that touch the boundary, and none
anywhere else.**

**A NUMBER IS ONLY EVER CORRECT AT THE VIEWPORT IT WAS MEASURED AT.** *(Ruled
2026-09-02. **CC-B's, and they stated the uncomfortable half themselves:** the drawer
cap they shipped and replaced was this defect, and *"the reason the column rule survived
is not that I was careful, it is that a column rule has no height term to get wrong."*)*

**Every height-derived constant in this project was measured on a device that is not in
the fleet.** Three landed in one day, all correct at 768-820 and all wrong at 411:

| the number | what it was for | at 411 |
|---|---|---|
| the drawer's old `max-height` cap | keep the drawer below the exit's band | replaced by the **column** rule, which held |
| the picker's `padding:140px` top | clear `#gameBack`'s 64px hit box | **140 + 240 + 24 = 404 of 411** — one row clips, two are impossible |
| `pickerTile`'s `min(42vw,240px)` | size a square tile | **no `vh` term at all** — sized off the plentiful axis, never the binding one |

**The rule is not "prefer constraints" as taste.** A constraint expressed as a *relation*
— stay right of the exit's column, take the available height — carries no viewport in it
and cannot be invalidated by one. A constraint expressed as a *number* is a measurement,
and a measurement is only true where it was taken. **When a layout value must be a
number, say which viewport it was measured at, at the line, so the next reader can tell
whether it still holds.**

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

**The family, stated once, because it keeps gaining members and they all have one
shape.** *(The count used to be written here. It was wrong within a day of each
addition — §5's own "no derived count unless something recomputes it", broken in the
paragraph that introduces the rule's own subject. The members are numbered below;
count them there.)* Each is
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

5. **A RECORD THAT STAYS TRUSTED BECAUSE IT STAYED UNCHANGED.** *(Added 2026-09-02.)*
   The freeze protocol hashes every deliverable so nobody can alter one unnoticed —
   and **hashes verify that the BYTES did not change, never that the CLAIMS are still
   true.** So the same mechanism that makes a file tamper-evident makes it *easier to
   leave wrong*: a verified hash reads as a verified document. `PUP-WO-0105`'s round-3
   pass read the feedback file **as a deliverable** and measured its statements
   against the tree — nobody had been doing that — and found two that a revert had
   made false while all 27 hashes verified.
   **The rule:** read the feedback and findings files as deliverables and measure
   their claims, not only their hashes. **Where a statement has become false, leave it
   standing with the measurement beside it** rather than editing it away — the
   correction is the record. *(The builder's finding, and the disposition is its own.)*
   **Its two corollaries, both earned the same week:** a demonstration written only
   into a commit message or a feedback file is **evidence about a tree that no longer
   exists** — put it in CI where it can be re-run; and **a field that can never be
   correct is worse than no field**, because a reader trusts it (the freeze manifest
   recorded its own commit SHA, written before that commit existed, so it named the
   previous one every time — deleted rather than worked around).

6. **A CHECK THAT MEASURES A PROXY THE PROPERTY DOES NOT FOLLOW FROM.** *(Added
   2026-09-02.)* The assertion ran, compared exactly what it was told to, and **what
   it was told to compare was not the property.** Distinct from member 2: that one
   certifies the forbidden state; this one certifies a **true** fact that the
   dangerous state also satisfies.
   **The case that named it:** `#gameBack` — the one way out of a game — was wired on
   `click` **alone**, and a browser synthesises no click while a second finger is on
   the glass, nor for a tap that slides past ~15px. **A three-year-old plays with both
   hands and his tap is a smudge.** Every check passed: `elementFromPoint` returned
   `#gameBack` at 64×64 in every failing case, and all thirty of `PUP-WO-0200`'s
   probes pressed it with `page.click` — **a synthetic mouse click, subject to neither
   rule.** *Across all of it the button had never once been pressed with a finger.*
   **`elementFromPoint` asks "is it under the finger", not "does pressing it do
   anything."**
   **Two earlier instances, recognised only in hindsight:** `check-two-trees`'s
   distinctness test `new Set(names).size === names.length`, **which cannot be false**
   (`PUP-WO-0103` G6); and `PUP-WO-0104` §2.4 — asserting a cache **name exists**
   cannot distinguish *survived* from *deleted and recreated by the next step*.

7. **A VERIFICATION THAT RESOLVES THE REFERENCE AND STOPS ONE LAYER SHORT OF THE
   FRAME IT IS EXPRESSED IN.** *(Added 2026-09-02.)* The reader opened the file, found
   the symbol, read the expression, and confirmed it — and never asked **what the
   expression is measured against.** Distinct from member 4: there the pointer does not
   resolve at all; here it resolves, to the right line, and the line's *coordinate
   system* is the unexamined part.
   **The case that named it, and it is CC-A's:** `PUP-WO-0700` §1 ruled *"Position is
   proportional in both paths and is CORRECT. Nothing is wrong with the placement."*
   Both paths do use a percentage — that much was confirmed at source, by symbol rather
   than line number, which is this document's own preferred form. But `#camReviewCanvas`
   is `object-fit:contain` while `#camStickerLayer` is `inset:0` over the same box, so
   one percentage is **of the element box** and the other is **of the letterboxed
   photograph**. They agree only at exactly 50%, or when the photo fills the box —
   **false on 7 of the 9 viewports measured**, by up to **214px**.
   **And the check written for the fix was blind by construction**, which is the half
   worth keeping: it divided the preview by the layer width and the burn by the canvas
   width — **the two denominators that make the mismatch cancel exactly** — and printed
   `worst disagreement 0.0104 points` while the defect was present in two of its own
   three viewports. That is member 6 *inside* member 7: agreement measured in the one
   coordinate system where disagreement cannot appear.
   **The rule:** when two expressions are asserted to agree, name the rectangle,
   the origin and the units each is measured in, and **assert in a third frame that
   belongs to neither** — CC-B's fix measures both in screen pixels and deliberately
   letterboxes the fixture so the bar is 1188px wide.
   **Presence is the recurring proxy.** Existence, geometry and naming are all cheap
   to measure and none of them is behaviour.
   **The rule:** name the property in the assertion's own words, then ask what else
   would satisfy the thing you are about to measure. If the answer is "the broken
   case too", you have a proxy. *(The builder's, from `PUP-WO-0300`'s pass.)*

**In all six the verdict was read instead of what produced it.** Members 1–2 are
green, 3 is red, 4 never runs at all, 5 is not a run, and 6 runs correctly on the
wrong question — which is why "look harder at the result" has never been the fix for
any of them.

**Member 4 is one line, and being mechanisable makes it a rule rather than advice**
(§5): before dispatching a pass, resolve every path and every section the prompt
cites **against the frozen tree, not against `main`** — and **when the resolver
reports a miss, print the surrounding lines of the cited file, never the count.**

**Two more clauses, both earned on the rule's next two uses:**

- **The resolver must FAIL CLOSED — an unresolvable check is a MISS, never a PASS.**
  *(`PUP-WO-0105`'s builder, on its own resolver.)* It printed `ALL POINTERS RESOLVE`
  while one of its probes had **crashed**: the probe was `node -e ... | tail -1`,
  which **discards exit status**, and the line handed back was `Node.js v24.16.0` —
  which reads exactly like a version report. The claim happened to be true; the
  resolver had not established it. **The print-the-lines clause addresses false
  REDS; this addresses false GREENS**, and the same tool produced one of each a
  single work order apart. The mechanism is the wrong-process `$?` trap this project
  has now recorded three times.
- **Not every path-shaped string in a prompt is a pointer.** *(CC-A, resolving
  `PUP-WO-0105`'s prompt.)* A resolver flagged `.github/ci/node_modules` as missing;
  it is **gitignored and cited as environment advice about where to place a script**,
  not as a file to read. Distinguish a citation-to-read from an environment
  reference, or the resolver produces false reds on deliberately-absent paths and
  gets muted — which is the failure the rule exists to prevent.

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

**A PER-CHANGE SAFETY ARGUMENT DOES NOT COMPOSE ACROSS CHANGES IN ONE COMMIT.**
*(`PUP-WO-0105`'s builder, against its own accepted decision.)* Two individually-safe
changes in one commit are not a safe commit, **and the per-change analysis is what
makes that invisible.**

Concretely: a four-class response matrix measured a cache-write guard and showed
exactly one cell moving — sound, and the basis on which a UI test was waived. The
same commit also bumped `CACHE_VERSION`. The matrix **varied the response and
nothing else**, so it could not see that the bump discarded every runtime-cached
asset; invariant 3's own falsification test then rendered **0 of 24 map tiles**
against 24 of 24. **The argument offered for not running the UI test is what
concealed the defect the UI test finds.**

Two rules follow, and the second is the cheaper one:

- **Ask of every claim what was actually VARIED to produce it.** A measurement's
  scope is a property of the fixture, not of the confidence in the sentence.
- **The author of a claim can check its scope by opening the file; a reviewer can
  only infer it.** Those are different duties and the record should say so rather
  than split fault evenly — but the reviewer's share is real whenever a waiver was
  granted on the claim's strength.
**A SCHEDULING DECISION IS ONLY AS GOOD AS THE TRIGGER LIST IT WAS MADE AGAINST,
AND A NEW TRIGGER FOR A KNOWN DEFECT IS A NEW DECISION, NOT A DUPLICATE FINDING.**
*(`PUP-WO-0105`'s builder.)* The un-closable Map overlay was found in `PUP-WO-0000`
§1.6 and scheduled into `PUP-WO-0600` at phase P6 — defensible, because the only
known trigger was a blocked CDN: rare, external, self-healing. Then quota eviction
was measured (~25 MB on a plain load, ~8 MB per opaque entry, no `storage.persist`),
which turns that rare external trigger into **an ordinary internal one**, and the
next offline cold start becomes the trap. **Nothing in either record joined them.**
What nearly buried it is that it *looked like a re-find of something already
scheduled* — and a re-find is exactly what gets closed as "known."

**Both of this project's near-misses are failures of DISPOSITION, not of
discovery.** Here, and the round-1 recommendation ("give the fake cache a `puts`
counter and assert zero write attempts") that was written into the findings file
under *Recommendation* and never applied, whose exact predicted vacuity round 2 then
found. **The pass worked, the record worked, and the loop did not close** — because
every control this project has built checks whether a finding was *written down*,
and none checks whether it was *acted on*. Two instances is a pattern and it wants a
control; **none is proposed here**, deliberately, by both parties who have each
shipped a mechanism today for a problem that turned out not to exist.
**Nothing ever asks whether a recommendation became a commit.** *(`PUP-WO-0105`'s
builder, correcting CC-A's account of the same gap.)* Two accepted dispositions were
recorded and not applied — the `puts` counter, and "say the opacity deferral is a
choice rather than a law of physics" — and the next pass found both again. **The
rows were accurate: both said *Recommendation* and neither claimed to be done.** So
the missing control is not better recording. It is that no step in this process ever
reads a recommendation and asks whether it turned into a diff. Named; still not
designed.

### 6.5 The quota path, and why the tiles question has no home yet

*Measured 2026-09-01 across three passes.*

An **opaque** cache entry costs **~7 MB regardless of body size** — a failed 200-byte
tile costs the same as a real one. The padding is **randomised per entry** (~6.3–8.5
MB observed, ~4,250× a same-origin entry), so **it must not be quoted as a
constant**; the load-bearing fact is its **independence from body size**. Three
opaque tiles exhausted a 40 MB budget, after which 57 of 60 subsequent puts failed
silently. There is no `storage.persist()` anywhere, so the origin is evictable.

**This chains into two live failures.** Eviction removes leaflet, and the next
offline cold start hits the un-closable Map overlay (§6.1's trigger-list entry;
`PUP-WO-0106`). And a device already at quota **cannot install a worker at all**:
`addAll` rejects with `QuotaExceededError`, install fails, the new worker is
discarded, **the old one stays activated**, and any poison it holds is permanent.
**The devices most likely to be poisoned are the most-used, and use is what
accumulates opaque entries** — so the fix cannot reach the devices that most need it.

**`PUP-WO-0600` does not dissolve this.** Its scope is `index.html:11-13`, the two
CDN `<script>`/`<link>` tags. **The OpenStreetMap tiles at `index.html:1373` are map
data fetched per coordinate and cannot be vendored at all** — and tiles are the bulk
of the opaque entries and the whole of the quota path. **The tiles question needs its
own work order and does not have one.**

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

### 6.4 The order: `PUP-WO-0105`, then the flip, then `PUP-WO-0104`

*Ruled 2026-09-01, and it corrects a constraint CC-A wrote that cut both ways.*

The earlier form was *"`PUP-WO-0104` must land before any future `sw.js` change reaches
publication."* Applied literally it **gates `PUP-WO-0105`'s own fix** — the one-line
guard for a defect that is live on the child's tablet — behind the gate that exists
to catch bad worker changes. That is a rule protecting against unnoticed harm,
delaying the most-scrutinised change in the project.

**The constraint restated, which resolves it without weakening it: a worker change
must be gated by a check for the class it changes.** `PUP-WO-0105` §3.5 *requires*
building the fixture and assertion that catch its own defect class. So it does not
bypass the gate — **it brings the gate for what it touches.** The classes it does not
touch (M9, M7, G4) are unchanged by it, so the gate's weakness there is no worse
after 0105 than before.

**The order, and the reason for each step:**

1. **`PUP-WO-0105`.** The live worker poisons its own app shell on any non-200
   received while online. Everything else waits on this.
2. **Fast-forward `stable`, add `stable` to the `github-pages` environment policy,
   tablet offline across the window, then flip.** Flipping before 0105 adds a second
   path caching from the same origin and **doubles the exposure of an active
   defect**. After 0105 both copies carry a reviewed, known-good worker, so the cache
   gate has nothing to catch at flip time — its weakness is not what the flip rests on.
3. **`PUP-WO-0104`.** From the flip until 0104 merges, **`sw.js` does not change.**
   That is the residual constraint, and it is now a short, bounded freeze rather than
   an open-ended one.

**P1 closes on its own gate, not on 0104.** Gate items 1 and 2 are met. Items 3 and 4
are **live verifications a human runs** against the published site — 0104 automates
that class of check in CI but is not what makes items 3 and 4 answerable. So
`PUP-WO-0103` merged, plus the flip, plus items 3 and 4, closes P1 — with **0104
recorded as P1 work carried past the phase gate**, not as a gate item quietly waived.

### 6.6 Ratified and never built — the tally, because it has four instances

*Added 2026-09-02. **Nothing in this project ever asked whether a recommendation
became a commit** (§6.1), and by the time that was written it had already happened
four times. Listed together because the pattern is invisible one instance at a time.*

| Ratified | Where | Found missing | By what |
|---|---|---|---|
| The cache gate for the class `sw.js` changes | §6.4's ordering premise | `PUP-WO-0105` | CC-A, asking whether its own ruling had landed |
| `check-error-caching.mjs` + `demo-error-poisoning.mjs` | `PUP-WO-0105` §3.5 | same work order, after `d53dfbc` stripped them | CC-A, at merge |
| The `games/*.js` network grep | `PUP-WO-0000` §8.3 — *"invariant 3 and 'strictly offline' rest on that check"* | `PUP-WO-0200` §1.1 | CC-A, **before** the artifact shipped |
| `api.tone(hz, ms, wave)` | §5, ratified 2026-09-01 | `PUP-WO-0300` §2.1 — `grep -c tone index.html` = **0** | the builder |

**What makes this class invisible:** each was ratified in a document, cited
afterwards *as though it existed*, and its absence could only be seen by someone
running the grep. Three of the four were load-bearing for an invariant. **The `games/`
one is the instructive case** — it was specified to enforce invariant 3, was never
built, and **its absence could not be detected at all**, because `games/` did not
exist so the check would have scanned nothing and passed. **A false green arriving
before there was anything to be green about.**

**The rule, and it is cheap:** when a work order cites a ratified mechanism as
existing, **resolve it the way §6.1 member 4 resolves a path** — run the grep, before
dispatch. Every entry above was found by one command.

**AND THE SECTION IS BROADER THAN ITS TITLE.** *(The builder's extension, 2026-09-02,
and it is a better statement of this section than the one it replaces.)* The pattern
is not only **ratified-but-unbuilt** — it is also **ASSERTED-BUT-UNVERIFIED**, and the
resolving command is the same one. `check-games-offline`'s own header promised that a
non-literal `.src` "becomes a NOTE, visible to a reviewer"; it did not, because the
regex required an identifier after the `=`, so `i.src = 'https:' + '//evil/x.png'`
matched **neither the literal pattern nor the note** — total silence, demonstrated
fetching off-origin. `PUP-WO-0300` §3 asserted the same check reds on a remote font;
**it did not, by either form.** A file that describes its own behaviour is making a
claim, and **a claim in a comment is verified the same way a path is: by running it.**

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
| **~~Northstar §5 forbids third-party network calls as a category~~ — RULED AND AMENDED 2026-09-04.** Scotty chose to **keep the OSM basemap as is**, knowingly, against three costed alternatives (no basemap; bundle ~218 tiles to z16 for ~5.5 MB; lower `maxZoom`). **`docs/northstar.md` invariant 3 AND the third-party non-goal now each carry ONE NAMED EXCEPTION with the date, the reason and the cost** — because a knowingly-violated invariant is worse than a weaker one honestly stated: a faithful check would red on approved behaviour, and a future builder would read the invariant, see the map contradicting it, and **fix the map**. **STILL OPEN, and deliberately NOT closed by this ruling: the Leaflet and supabase-js CDN loads.** The exception is one origin, not a category. **The mechanism half is owed — `PUP-WO-0705`.** | **CLOSED for tiles; OPEN for the CDN loads — Scotty** | `PUP-WO-0705` carries the check |
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
| 2026-09-01 | §6.4 added: the order is `PUP-WO-0105` → flip → `PUP-WO-0104`, and the "0104 before any `sw.js` change" constraint is restated as **a worker change must be gated by a check for the class it changes**. P1 closes on its own gate, with 0104 carried past it. | The constraint as written cut both ways — the co-architect spotted that it would gate 0105's own one-line fix for a defect live on the tablet. Restating it by *class* rather than by *file* resolves that without weakening it: 0105's acceptance requires building the check for its own defect class, so it brings the gate rather than bypassing it. |
| 2026-09-01 | §6.1 member 4 gains two more clauses: the resolver must **fail closed**, and **not every path-shaped string is a pointer**. | Both from the rule's next two uses. The builder's resolver printed `ALL POINTERS RESOLVE` while a probe had crashed — `\| tail` discarded the exit status and returned a line that read like a version report; the claim was true and unestablished. CC-A's resolver then flagged a gitignored path cited as environment advice. **One false green and one false red from the same rule, one work order apart** — the print-the-lines clause covers only the red half. |
| 2026-09-01 | §6.1 gains: **a per-change safety argument does not compose across changes in one commit**, with the varied-what rule and the author/reviewer scope asymmetry. | `PUP-WO-0105`'s builder, against a decision CC-A had already accepted. A response matrix measured the guard, CC-A extended it to the whole commit, and a `CACHE_VERSION` bump in the same commit discarded every runtime-cached asset — 0 of 24 map tiles under invariant 3's own falsification test. The waiver of the UI test rested on the argument that concealed what the UI test finds. |
| 2026-09-01 | §6.1 gains the trigger-list rule and the disposition gap: a new trigger for a known defect is a new decision, and this project's near-misses are failures of disposition rather than discovery. | The builder's, stating properly why CC-A's P6 scheduling of the Map trap was defensible when made and wrong once quota eviction was measured. Paired with the round-1 `puts`-counter recommendation that was recorded and not applied — every control here checks that a finding was written down, none checks that it was acted on. Named as wanting a control; none proposed, by two parties who each shipped an unnecessary mechanism today. |
| 2026-09-01 | §6.1: *nothing ever asks whether a recommendation became a commit*. §6.5 added: the quota path, and that `PUP-WO-0600` cannot receive the tiles question. | Both the builder's. The disposition rows were accurate — they said *Recommendation* — so the gap is not recording but that nothing reads one and asks whether it became a diff. And the tiles are map data fetched per coordinate: unvendorable, the bulk of the opaque entries, and the whole of the quota path, pointed by a deferral at a work order that provably cannot receive it. |
| 2026-09-01 | §10 gains three open questions: the northstar §5 CDN contradiction, the cleartext anon key reachable while locked, and network-first versus the cold-start budget. | All three are defects in **PupPad as it stands today**, not in the games work, surfaced by P0. The first is explicitly *not* amended here — a change to a northstar non-goal is re-ratified there (§1), and CC-A does not hold that authority. Roadmap P6 is where they get built once ruled. |
| 2026-09-02 | **§6.1 gains member 5 — a record that stays trusted because it stayed unchanged.** §5 gains five rulings: a gate that cannot see its subject is not a gate; no derived count in a name unless something recomputes it; a measurement whose subject includes itself cannot be a constant; a work order states its fence ONCE; and the freeze protocol becomes `git archive` / `git clone`, never `cp -r` of a worktree. **§6.6 added — the ratified-but-unbuilt tally.** | P1 closing and P2 opening, across `PUP-WO-0103`, `0105`, `0200` and `0300`. **Member 5 is the builder's**, found by reading a feedback file as a deliverable — which nobody had been doing — and it names the cost of the freeze protocol this project adopted the same week: hashes prove the bytes did not move and say nothing about whether the claims survived. The §5 rulings are four builder findings and one of CC-A's; the fence ruling is the structural fix for four self-contradicting work orders, **three of them CC-A's**, and `PUP-WO-0300` §0 is the first written that way. |
| 2026-09-04 | **The northstar gains its first exception, and this document records the consequence rather than the decision.** Invariant 3 and the third-party non-goal each name the OSM basemap, dated and costed. §10's third-party row is closed for tiles and left open for the CDN loads. | **Scotty's, ratified in the northstar where a change to something that must stay true belongs — CC-A does not hold that authority and did not take it.** The amendment was the non-optional half of the ruling: *keeping* the basemap was cheap, and leaving the document contradicting it was the expensive part. **Both expressions were amended, not just the one named**, because the invariant and the non-goal are two statements of one rule and amending one would have reproduced the decay the amendment exists to stop. **The exception lives in prose until `PUP-WO-0705` puts it in a check as an allowlist of exactly one origin** — recorded here as owed, per §6.6, rather than assumed done. |
| 2026-09-04 | **§6.1 member 7 records its SECOND OCCURRENCE, and it is CC-A's again.** §5 gains: a work order's method must not defeat its own stated reason · a plant that applies is not a plant that reproduces · the arrange step is part of what must be attacked · a guard on a callback with two effects must cover each one · **a stub is legitimate for behaviour and illegitimate for egress.** §10's third-party-network row is re-framed as a **location** question and its rotted line citations moved to symbols. | **The member-7 instance is the sharpest yet because it was committed to a work order and dispatched.** Scoping `PUP-WO-0702`, CC-A traced `navigator.geolocation` to its consumers — `setView` and `mapLocationMarker` — and concluded *"the map still knows where it is and stops telling anyone."* **The reference resolved and the frame did not:** `setView` causes `L.tileLayer` to fetch `/{z}/{x}/{y}.png`, and a tile path IS a coordinate — ~500 m at the opening zoom, ~60 m at `maxZoom: 19`. The sentence shipped in the work order, in the dispatch, and into `index.html` as a comment. **Caught by the builder's adversarial pass, which then found that the check certifying the claim had stubbed the only thing in the panel that makes a request.** Two layers of the same defect, one on top of the other. |
| 2026-09-02 | **§6.1 gains member 7 — a verification that resolves the reference and stops one layer short of the frame it is expressed in.** §6.1's preamble also loses its hand-maintained member count. | **CC-A's, and it is a correction to CC-A's own ruling.** `PUP-WO-0700` §1 stated the sticker's *position* was correct in both paths and only its *size* was wrong. Both paths do use a percentage — confirmed at source, by symbol rather than line number, which is this document's preferred form — but one is a percentage **of the element box** and the other **of the letterboxed photograph**, so they agree only at 50% or when the photo fills the box: false on **7 of 9 viewports**, by up to **214px**. Found by the builder's adversarial pass, which also caught that the check written for the fix divided the two paths by the two denominators that make the mismatch cancel — printing `0.0104 points` of disagreement while the defect was live in two of its own three viewports. **Member 6 nested inside member 7.** The count came out for the ordinary reason: it said six while a seventh was being added. |
| 2026-09-02 | §5 gains the parked-and-unclaimed ruling. | `PUP-WO-0201` parked green and nothing woke the architect. Recorded because **the gap is in the shape of the monitoring, not in anyone's attention**: an actor-scoped liveness check is structurally unable to see work that is finished, correct, and waiting. Raised by the co-architect, who also supplied the mechanism. |

## 12. Provenance

Written by Claude (chat architect) with Scotty, 2026-08-31. Ground truth in §3
measured the same day against the live repo, the Precision host, and the GitHub
Pages API; commands are cited inline. Game sources are two Grok-generated
workspaces provided as uploads and read directly. Build process rests on
`dual-cc-session-design-v2.md` (2026-08-29), an input document, left where it is.
