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

Eight buttons flank a radar canvas — four per rail. Each opens a full-screen
overlay panel built by an `openX()` function that appends a div, paired with a
`closeX()` that removes it. A click router in `attachEvents()` dispatches on
`data-id` against two button arrays.

## 3. Ground truth — measured 2026-08-31

Measured against the live repository, the running Precision host, and the GitHub
Pages API. Commands cited.

| What | Measured |
|---|---|
| Repo contents | 5 files: `index.html` (1,942 lines), `sw.js` (43), `manifest.json`, two icons. No `.github/`, no tests, no docs. |
| Cache identity | `sw.js:1` — `var CACHE_NAME = 'pup-pad-v16'`. A hardcoded constant. |
| Cached assets | `sw.js:2-8` — `urlsToCache` lists five entries; anything not listed is not cached and will not work offline. |
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

- **Console shell ↔ game module** — *a contract, not a security boundary.* A game
  receives a container element and a `close()` callback and owns nothing outside
  it. It is what makes northstar invariant 6 hold.
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
| Adversarial pass ownership | **CC-A dispatches the adversarial subagent, not CC-EM.** | With CC-A holding merge authority, the adversarial pass is the only independent check between builder and `main`. Dispatched by CC-EM it inherits the builder's framing and is not independent. Costs nothing to move. |
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

**The cache hazard.** The root service worker's scope covers `/stable/`. Two builds
sharing `CACHE_NAME` will fight, and the symptom is Buddy's tablet silently serving
the dev build. Cache names are namespaced per path; CI asserts it (§3.1,
invariant 7).

## 7. Deferred with intent — realtime co-op

Not in scope, and deliberately not left to be bolted on. Phase 1 shapes itself so
phase 2 is "move existing state across a channel" rather than "invent multiplayer".

Four seams, all cheap now and expensive later:

1. **The engine stays pure and player-agnostic** — no module-level singleton state.
2. **Trays are an array keyed by player, not a single tray.** `classic` needs this
   regardless, which is why it is the cheapest seam to install.
3. **All board mutations flow through one reducer taking `{playerId, action}`**, so
   a network layer replays actions rather than syncing state.
4. **Registry entries declare `players`**, so the picker can show a two-player
   badge without knowing how it works.

**Local co-op on one tablet is the first proof** — two trays, one board, no network
at all. If that does not feel good, the networked version will not either.

## 8. Security posture

- **Invariant 2 is enforced by the browser and by having no navigation out**, not
  by the lock button. §3.1 is explicit that the lock gates nothing; no work order
  may treat it as containment.
- **No third-party network calls from any games surface.** Northstar §5.
- **No data about Buddy is collected, stored, or transmitted.** Northstar §5.
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
| CC-A dispatches the adversarial pass | §7 clause 2, load-bearing once CC-A merges |
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

## 11. Amendments

| Date | Change | Reason |
|---|---|---|
| 2026-08-31 | Document created. | First architecture; repo shipped without one. |

## 12. Provenance

Written by Claude (chat architect) with Scotty, 2026-08-31. Ground truth in §3
measured the same day against the live repo, the Precision host, and the GitHub
Pages API; commands are cited inline. Game sources are two Grok-generated
workspaces provided as uploads and read directly. Build process rests on
`dual-cc-session-design-v2.md` (2026-08-29), an input document, left where it is.
