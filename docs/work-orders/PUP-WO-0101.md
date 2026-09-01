# PUP-WO-0101 — Two-path publication and prefix-bounded cache reaping

**Repo:** ikthys777/PupPad · **Base:** `main` (currently `b29774a`; **verify live HEAD**).
**Branch:** `build/wo-0101`.
**Author:** CC-A (architect) · **Builder:** CC-EM (pup-b) with subagents.
**Phase:** P1 · **Phase exit gate:** see `docs/roadmap.md` → P1. This work order
closes gate items **3 and 4**, and P1 with them.
**Grounds:** `docs/northstar.md` invariants 3, 4, 7 · `docs/architecture.md` §3,
§3.1, §5, §6, §8 · `docs/roadmap.md` P1 · `docs/findings/PUP-WO-0000.md` §6 ·
`docs/feedback/PUP-WO-0100.md` F16 · `sw.js`, `.github/workflows/ci.yml`,
`.github/ci/`.

> **What this is:** the firebreak itself. It splits publication into two paths —
> `main` at the site root, `stable` at `/stable/` — and fixes the cache identity so
> the two cannot destroy each other. It is **NOT** a games change, not a panel fix,
> and not the CDN or overlay work (`PUP-WO-0600`). Why now: `PUP-WO-0100` built
> checks that can go red; this builds the thing they guard. When this merges and
> Pages is flipped, a merge to `main` stops reaching Buddy — which is the entire
> point of P1 and the precondition for every phase after it.

**Cadence:** build. One PR, left unmerged for review.

**First act, before anything else:**
```
git fetch origin && git checkout -B build/wo-0101 origin/main
```
Live `main` is `b29774a`. Your local `main` is not fast-forwarded by anything —
`origin/main` is the only ref that means what you want. You sync your own tree.

---

## 0. Read this first: this is the highest-risk merge in the project

Every work order so far has been safe to merge because its diff avoided the paths
GitHub Pages serves — `docs/` for `PUP-WO-0000`, plus `.github/` for
`PUP-WO-0100` (architecture §6, bootstrap exception). **This one cannot have that
property. Changing `sw.js` is the work.**

`sw.js` is served from `main:/`. Pages is still `build_type: legacy`, and `/stable/`
does not exist yet, so **Buddy's tablet is on the root copy today.** The service
worker is the mechanism northstar invariant 3 depends on. A broken `sw.js` merged
to `main` does not degrade the app — it can leave a device unable to load it at all.

**So this is the last merge that reaches Buddy without a firebreak, and it is the
one that builds the firebreak.** Two consequences for how you work:

1. **`PUP-WO-0100`'s four checks are the only thing standing under this merge.**
   That is why they were built first and why they had to be demonstrated red. Do
   not weaken, skip, or special-case any of them to make this land.
2. **Sequencing is human-track and is not yours to perform.** The required order is
   recorded in §6 for CC-A and Scotty. Do not flip Pages, do not push `stable`, do
   not touch repository settings. Note in particular that flipping Pages to Actions
   *before* this merges would leave the site with no publishing workflow at all.

## 1. Scope

### 1.1 Cache identity — prefix-bounded reaping

Architecture §6 is explicit and its reasoning is measured, not hypothetical:
**namespacing `CACHE_NAME` is insufficient, and on its own it makes things worse.**
`caches.keys()` is **origin-scoped**, not scope-scoped. Both copies live on
`ikthys777.github.io`. Today `sw.js:19-29` reaps every cache whose name is not its
own, so two differently-named copies would delete each other on every activation —
namespacing alone converts a collision into mutual deletion.

Required:

- Each deploy path carries a **`CACHE_PREFIX`**; `CACHE_NAME` begins with it.
- The activate handler reaps **only** `name.startsWith(CACHE_PREFIX) && name !==
  CACHE_NAME`. It must never enumerate and delete outside its own prefix.
- **How the prefix is derived is your call**, but state the reasoning. Deriving it
  from `self.registration.scope` at runtime keeps the two published `sw.js` files
  byte-identical and introduces no build step into a repository whose defining
  property is not having one (architecture §5) — that is the recommendation, not a
  mandate. Build-time injection is acceptable if you argue it better.
- **If the prefix is derived at runtime, the CI assertion cannot be a file diff.**
  It must evaluate the derived value for each published path and assert those
  differ. An assertion that compares two identical files and passes proves nothing.

**The legacy cache, and the one exception.** The existing cache is `pup-pad-v16`
(`sw.js:1`), which matches no new prefix — so under a correctly prefix-bounded reap
it is never cleaned and leaks on every existing device, Buddy's included. Delete it
once, and delete it **by exact literal string**, never by pattern, wildcard, or
prefix match. A pattern here is how the origin-wide reap comes back, and it would
come back looking like cleanup. Name the exception in a comment with the condition
for its removal.

### 1.2 The root worker must not serve `/stable/`

The root worker's scope covers `/stable/` (architecture §6). Before the stable
worker registers, the root worker can serve and — because `sw.js:31-43` caches
every response unconditionally — **cache `/stable/` assets under the root prefix.**
That is northstar invariant 7 failing directly, on the test device, with disjoint
cache names and a green gate.

The root worker must decline requests under `/stable/`. Prefix-bounded naming does
not fix this; it is a separate mechanism and needs a separate fix.

### 1.3 Two-path publication

Extend `.github/workflows/ci.yml`, or add a publish workflow beside it, so one
Pages deployment carries both copies: `main` at the site root, `stable` at
`/stable/`.

**Publication is gated on CI green, by construction rather than by convention**
(architecture §6). A red check must mean nothing publishes.

**Emit a build stamp at each path** — a small JSON file carrying at least the ref
name and the commit SHA the copy was built from. This is not decoration: it makes
gate item 3 checkable with two `curl`s instead of an inspection, and it makes
invariant 4 continuously auditable afterwards rather than only at the gate.

### 1.4 CI assertions

- The two published copies' cache prefixes **differ** (§1.1).
- The reap is **prefix-bounded** — a reap that enumerates all caches and deletes by
  inequality must fail the check. This is the assertion that would have caught the
  original defect, so it is the one that matters most.

### 1.5 `sw.js` runtime coverage — closing F16

`docs/feedback/PUP-WO-0100.md` F16: check 4 cannot see inside the service worker,
and `PUP-WO-0100` demonstrated that a **throwing `fetch` handler stays green**
because the browser falls back to the network. `sw.js` is one of two code files in
this repository and the mechanism invariant 3 rests on, and nothing watches its
runtime.

Ruled into this work order because it opens `sw.js` anyway — the driver change is
cheap here and expensive standalone. `PUP-WO-0100` documented three dead ends
against Playwright 1.56.1's wrapper (`worker.on('console')` is not an API;
`context.on('console'|'weberror')` delivers page output only; `CDPSession.send`
takes no `sessionId`, so browser-level auto-attach cannot be routed). **Read that
record before starting** — it is a map of where not to spend the afternoon. A raw
CDP WebSocket is the suggested route; if it also fails, that is a finding and a
flag-and-stop, not a thing to quietly declare a limit.

**Acceptance for this item is specific:** the throwing `fetch` handler that stayed
green under `PUP-WO-0100` must now go **red**.

## 2. Invariants — restated by number

From `docs/northstar.md`, which is authoritative.

- **3** — every core surface works with no network. `sw.js` *is* this invariant's
  mechanism. §0 is why that sentence is heavier here than in any prior WO.
- **4** — **the copy Buddy uses advances only when a human promotes it.** The
  publication path must make it structurally impossible for `main`'s content to
  reach `/stable/`. See §7 — this is the flag-and-stop, not a check.
- **7** — a device serves exactly one build's assets, never a mixture. §1.1 and
  §1.2 are the two independent mechanisms by which this fails.

**Protected surfaces — must diff to empty:** `index.html`, `manifest.json`,
`icon-192.png`, `icon-512.png`. **`sw.js` is NOT protected in this work order** —
it is the subject. That is a deliberate, one-work-order exception and does not
carry forward.

## 3. Acceptance — what must be proven, not asserted

1. **`git fetch origin && git diff origin/main --stat`** shows changes under
   `.github/`, `docs/`, and `sw.js` only. Fetched, and against `origin/main` — not
   a local `main`, which nothing fast-forwards (roadmap §5).
2. All `PUP-WO-0100` checks stay green, unmodified and un-special-cased. If one had
   to change to accommodate this work, say which and why — that is a finding.
3. **The two new CI assertions (§1.4) are each demonstrated RED**, by their own
   deliberate break, each reverted, each with captured output and the failing step
   name. Same standard as `PUP-WO-0100` §3.3, for the same reason.
4. **§1.5's throwing `fetch` handler goes red.** Captured output.
5. **Prefix-bounded reaping demonstrated, not argued.** In a real browser against
   both paths: populate both caches, force-activate the root worker, and show the
   `/stable/` cache still present afterwards. *(This is roadmap P1 gate item 4, and
   the gate is written this way because the naive form — "`caches.keys()` shows
   disjoint names" — passes at the instant of measurement precisely when one has
   just been deleted.)*
6. **The legacy cache is removed once and only by literal name** (§1.1),
   demonstrated on a device state that starts with `pup-pad-v16` present.
7. **§1.2 demonstrated:** with the root worker controlling, a request under
   `/stable/` is not served or cached by it.

**Gate items 3 and 4 of roadmap P1 require a live site and are CC-A's and Scotty's
to run after merge and after the Pages flip.** Do not claim them. Build the stamp
(§1.3) that makes item 3 a two-`curl` check and say so in your feedback.

## 4. Scope fence — NOT in this work order

- **Anything in `index.html`.** Including the CDN loads and the un-closable overlay
  — both real, both `PUP-WO-0600`, and the CDN half is blocked on a northstar
  re-ratification only Scotty can make.
- **Flipping the Pages build type, pushing `stable`, or any repository setting.**
  Human-track (§6, architecture §3).
- **Games, the registry, the picker, `CACHE_PREFIX` values chosen to suit a future
  games path.** Two paths today; do not generalise to N.
- **Rewriting `sw.js`'s fetch strategy.** It is network-first and that is
  architecture §10's open question, not yours. Change cache *identity* and the
  `/stable/` exclusion; leave the strategy alone.
- **"Small obvious fixes"** to anything outside `sw.js`. Log them.

## 5. Adversarial pass — three rules now, all earned here

Black-box task, fresh subagent, artifact and ground truth only, none of your
reasoning. Independence is context isolation.

**(a) Freeze every file the work order names as a deliverable, not only the code.**
*Amended in architecture §5 from your own `PUP-WO-0100` report.* You froze
`.github/` and rewrote the feedback file mid-pass, so §3.3's demonstrations and
§3.4's determinism justification were outside the frozen artifact — the two things
that work order most wanted scrutinised were the two the reviewer could not see.
Here that means `sw.js`, the workflow, the CI scripts **and** the feedback file.

**(b) Two artifacts.** Summary in `docs/feedback/PUP-WO-0101.md`; verbatim prompt
and unedited output in `docs/findings/PUP-WO-0101-adversarial.md`. Neither
summarises the other's job.

**(c) Feedback is now per-work-order: `docs/feedback/PUP-WO-0101.md`.** *Amended in
architecture §5 — CC-A's defect, not yours.* The single rolling `docs/FEEDBACK.md`
meant your `PUP-WO-0100` commit replaced `PUP-WO-0000`'s record at the tip while
following the ruling exactly as written. **The migration is already done** — CC-A moved
`docs/FEEDBACK.md` to `docs/feedback/PUP-WO-0100.md` when it made the ruling, so the
rename does not add diff noise to a merge that §0 wants minimal. Nothing for you to
move; just write yours at the new path.

Probe, for this work order specifically:

- **Try to get `main`'s content onto `/stable/`.** The highest-value attack here by
  a wide margin. Race the two workflows, push both refs together, make the `stable`
  checkout fail, make it resolve to a detached or stale ref, and see whether any
  path publishes the wrong content to the promoted copy. Anything found here
  outranks everything else in the pass.
- **Attack the reap.** Construct cache names that are adjacent but not owned —
  `puppad-root-` versus `puppad-rootx-`, a prefix that is a prefix of the other
  prefix, an empty prefix, a prefix derived from an unexpected scope. Does any
  worker delete a cache it does not own?
- **Attack the legacy exception.** Can it be made to match anything but the literal
  string?
- **Attack the prefix derivation.** What is the scope on a `file://` load, an
  unexpected mount path, a trailing-slash difference?
- **Check the new CI assertions can actually go red**, and find a defect of the
  class they claim to catch that they miss.

## 6. Sequencing — recorded for CC-A and Scotty, not for the builder

Stated here because getting it wrong takes the site down, and because §0 tells the
builder not to perform any of it.

1. **This work order merges first, while Pages is still `legacy`.** Legacy keeps
   serving `main:/`, so the new `sw.js` goes live at root and the prefixed cache
   replaces `pup-pad-v16` on existing devices. `/stable/` does not exist yet, so
   §1.2's exclusion is inert and harmless.
2. **Then Scotty fast-forwards `stable`** (currently `2952aa1`, behind `main`) so
   the promoted copy has real content to serve.
3. **Then Scotty flips Pages to the Actions build type.** Flipping before step 1
   would leave the site with no publishing workflow at all.
4. **Then P1 gate items 3 and 4 are run against the live site**, and P1 closes.
5. **Then Scotty re-points Buddy's tablet at `/stable/`** and the test device at
   root.

## 7. Flag-and-stop

Park the branch and surface to CC-A rather than working around:

- **Any path by which `main`'s content could reach `/stable/`** — found, suspected,
  or merely not ruled out. This is northstar invariant 4, it is the reason this
  phase exists, and it is not a check to be tuned. Stop and say so.
- **Any need to modify `index.html`, `manifest.json`, or an icon.**
- **Any need to weaken, skip, or special-case a `PUP-WO-0100` check** to make this
  land. Per §0 those four checks are the only thing standing under this merge.
- **CDP also failing to observe the worker** (§1.5). A second dead end is a finding
  and a ruling, not a limit to declare on your own authority.
- Any need for a credential, a repository setting, or a push to `stable`.
- The workflow requiring `permissions:` beyond what publication strictly needs —
  and note that publication needs more than `contents: read`, so state exactly what
  you added and why.

## 8. Kickoff prompt

Sent separately, thin, pointing at this file. **Do not dispatch without Scotty's
word.**

## 9. Provenance

Written by CC-A 2026-09-01. Scope is roadmap P1's `PUP-WO-0101` line plus
architecture §6's corrected cache-hazard fix, which superseded the roadmap's
original "namespace `CACHE_NAME`" wording before this work order existed. Three
items are carried in from `PUP-WO-0100`'s review rather than inherited from the
roadmap: §5(a) the freeze scope, §5(c) per-work-order feedback naming, and §1.5's
F16 closure. §0 and §6 exist because this is the first work order whose diff
reaches a served path, and the first whose sequencing can take the site down.
