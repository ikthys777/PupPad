# PUP-WO-0105 — The service worker caches error responses

**Repo:** ikthys777/PupPad · **Base:** `main` (**verify live HEAD**).
**Branch:** `build/wo-0105`.
**Author:** CC-A · **Builder:** to be assigned.
**Phase:** P1.
**Priority:** ahead of `PUP-WO-0104` and `PUP-WO-0600`. See §0.
**Grounds:** `docs/northstar.md` invariants 3, 5 · `docs/architecture.md` §5, §6.1 ·
`docs/feedback/PUP-WO-0103.md` · `sw.js`.

> **What this is:** one guard, in the one file that is already on the child's tablet.
> `sw.js`'s fetch handler writes **every resolved response** into the cache with no
> status check, so an HTTP error received *while online* overwrites the good copy. It
> is **NOT** the cache gate (`PUP-WO-0104`), not publication (`PUP-WO-0103`), and not
> `index.html`.

**Cadence:** build. One PR, left unmerged for review.

**First act:** `git fetch origin && git checkout -B build/wo-0105 origin/main`.

> **STATUS ON `main`, 2026-09-01 — THE DEFECT IS STILL LIVE AND NOTHING HAS SHIPPED.**
> Verified rather than inferred: `sw.js` on `main` is **361 lines with no status
> guard** — the only status token in the file is the `504` offline synth at `:357`.
> **PR #25 is open and unmerged.**
>
> Two merge commits carry this work order's *number* and neither carries its *fix*:
> `805ae54` (§0a) and `78ac016` (**"the quota path splits to `PUP-WO-0108`"**) each
> merged **one file — this one**. That second title is the hazard: it reads like a
> change that landed. **It did not.** Only the work order moved.
> *(Flagged by the co-architect, who grepped `main` rather than trusting the title —
> which is architecture §5's rule about a diagnosis being a claim, applied to a
> commit subject.)*

---

## 0. This is live, and it is on the tablet now

Not a latent defect. `sw.js` on `main` is what Buddy's device is running.

**The mechanism.** `fetch()` **resolves** on 4xx and 5xx — it rejects only on network
failure. The handler does `fetch(...).then(response => cache.put(request, clone))`
with **no status or type guard anywhere in the file** (verified: zero occurrences of
`.ok`, `status ===`, `status >=`, `response.status`, `.type ===`). So a 404 or 503
received **while online** is stored under its own key, overwriting the good copy —
and the offline `.catch` branch never runs, because nothing rejected.

**`'./'` is in `urlsToCache`. That is the app shell.** Reproduced in real Chromium:
one reload against a 404ing origin poisoned `/PupPad/`, and offline the device then
served a 404 error page. **Buddy taps his icon and gets an error page he cannot tap
out of.** Northstar invariants 3 and 5.

**Severity, stated honestly:** it heals **per URL** on the next healthy *online*
fetch of that URL — so it is not permanent. But the window is "until an adult opens
it online against a healthy origin," and **a three-year-old cannot produce that
condition.** `/PupPad/` healed when navigated; `/PupPad/index.html` stayed poisoned
because nothing re-fetched it.

**Why it outranks `PUP-WO-0104`:** 0104 makes the *gate* able to see this class. This
makes the *worker* stop doing it. No CI check can stop a production 404 from
poisoning a live device, and 0104 explicitly forbids touching `sw.js`, so 0104
**cannot** fix it.

**Triggers are not limited to a deploy.** A Pages incident, a 503, a 429, or a
no-deployment gap all produce a non-200 while the device is online.

## 0a. Round 3 — the quota path, SPLIT OUT to `PUP-WO-0108`

> **AMENDED 2026-09-01, after round 3. §0a.1–§0a.3 are NO LONGER THIS WORK ORDER'S
> and are `PUP-WO-0108`'s opening scope. §0a.4 stands and is MET. §0a.5 stands.**
> They are left in place rather than deleted because the reasoning is what 0108
> inherits, and because the error in fusing them is the reusable part.
>
> **CC-A's scoping error, stated plainly.** §0a argued F1 blocks the merge because §0
> claims tablet reach and P1's gate items 3 and 4 are live verifications. That
> argument is sound about **the quota defect** and unsound about **the guard**: a
> correct guard is not made dishonest by a second, independent defect in a different
> lifecycle event. What fused them is that F1 arrived as a critique *of the guard's
> reach* — but reach is a property of the **install** path, a different mechanism.
> **And §0a missed the answer to its own objection:** gate items 3 and 4 are specified
> as live verifications **on the tablet**, run by a person. They cannot pass on an
> adult's browser while the child's device stays poisoned.
>
> **The evidence that decided it is the builder's.** Two rounds on the install path
> produced **two live-severity regressions**, both self-reported against the builder's
> own interest. That is not builder error — it is the signature of a scope that does
> not fit the work order it is in, which is precisely what §7 predicted and what
> §0a.5 half-accepted and then continued past anyway.
>
> **Round 3's own measurements settle the risk of reverting:**
>
> | worker | states | app shell |
> |---|---|---|
> | round-3 install fix | `activated` | **NULL — no app at all** |
> | round-2 guard alone | `redundant` | **200, is the app** |
> | today's live worker | — | **200, is the app** |
>
> The round-2 guard is **non-harmful** on a squeezed device — a *reach* limitation,
> not a harm. The round-3 fix is the only one of the three that can leave a child with
> nothing, because the swallow lets `activate` run and `activate` deletes
> `pup-pad-v16`, which held the last good shell.
>
> **The durable finding, carried to `PUP-WO-0108` and to architecture §6.1:**
> `activate`'s legacy deletion has an **unstated precondition — that `install`
> succeeded.** `event.waitUntil` rejecting is what enforced it, implicitly, by
> preventing activation; the swallow removed the enforcement without replacing it.
> The deletion carries twenty lines documenting its **cross-copy** precondition and
> never states its **within-copy** one. **Never delete a cache that is serving until
> its replacement is provisioned** — which covers the version-bump reap too, and
> nobody has looked at that.

*Added by CC-A 2026-09-01, after the round-2 pass. The guard in §1 is built and
verified twice in a real browser, and is not reopened.*

**The finding, and it is disqualifying for §0's own claim.** `install` is
`caches.open(CACHE_NAME).then(c => c.addAll(urlsToCache))`. On a device with no quota
headroom **`addAll` rejects with `QuotaExceededError`, the install fails, the new
worker goes `redundant`, and the OLD UNGUARDED WORKER STAYS ACTIVATED.** Measured
A/B varying only remaining quota: with headroom, `statechange → installed` and the
poisoned shell returns to 200; squeezed, `statechange → redundant` and it stays 404.
Recorded at `sw.js`'s `CACHE_VERSION` comment on `build/wo-0105`, and in
`docs/architecture.md` §6.5.

**And the devices most likely to be squeezed are the most-used** — a poisoned device
is one that has been *used*, and use is what accumulates opaque entries at ~7 MB
each. So **the fix cannot reach the devices that most need it**, which is Buddy's.

**Why this blocks the merge rather than being a limitation to note.** Merging the
guard is not a regression — a squeezed device is left exactly as it is today. But
§0 of this work order says *"this is live, and it is on the tablet now"*, and P1's
exit gate items 3 and 4 are **live verifications on that tablet**. A fix that cannot
install on a squeezed device does not satisfy its own §0, and would let P1 close on a
gate that passes on an adult's browser while the child's tablet stays poisoned. That
is this project's own recurring failure — **the verdict read instead of what produced
it** — arriving at the phase gate.

### 0a.1 The required property, stated once

**Install must not be able to fail because of quota.** However it is achieved, a
device that cannot precache must still end the update with **the guarded worker
activated**.

### 0a.2 The sharp edge — what this fix must NOT refuse

A bare `.catch(function(){})` on the install promise satisfies 0a.1 and is **wrong**,
and this is the standing question answered before the code rather than after it.

**Install failing loudly is a safety property this project already relies on.**
`sw.js`'s own cross-origin comment argues for vendoring leaflet *because* install
would then "fail loudly instead of half-provisioning the device." A blanket catch
destroys that: a genuinely bad deploy — a 404 on a `urlsToCache` entry, a network
drop mid-install — would then activate a worker over a cache it never provisioned,
and the device is half-provisioned **silently**. That is invariant 3 traded for
invariant 3 again, the exact trade §1.2 exists to prevent.

**So the fix must discriminate: a quota failure is survivable; a fetch or HTTP
failure is not.** `addAll` rejects with a `QuotaExceededError` `DOMException` for the
first and a `TypeError` for the second — **verify that in Chromium against this
worker rather than taking it from this sentence**, and if the two are not reliably
separable through `addAll`, say so and use a path that can separate them (per-URL
`fetch` + `put` gives you both the URL and the reason). Mechanism is yours; the
discrimination is not optional.

### 0a.3 A steer, not a spec — reclaim before giving up

Swallowing the quota error leaves the guard installed and the shell repaired only
opportunistically, on the next healthy *online* fetch of each poisoned URL — and §0
already records that **a three-year-old cannot produce that condition**. Better, if
it holds: **on `QuotaExceededError`, delete this worker's own runtime entries and
retry the precache.**

Bounds, because an unbounded reclaim is how the origin-wide reap returns wearing
cleanup's clothes (§6 of the architecture, and `PUP-WO-0102` §1.3):

- Only entries in **`CACHE_NAME`**, never `caches.keys()`, never another prefix.
- **Never a `urlsToCache` entry.** Those are the thing being provisioned.
- The retry is **bounded** — it must not loop.

**Answer the standing question for this too, and answer it in the feedback:** what
does reclaiming refuse? It refuses the Map panel its offline tiles. **Rank it and say
so.** CC-A's ranking, for you to falsify rather than assume: an app shell that will
not load beats a map that works offline, because invariant 5 has no tap out of a
shell that fails and invariant 3 for the shell is the precondition for every other
surface. **If your measurements contradict that ranking, that is a flag-and-stop.**

### 0a.4 The check comes back — §3.5 is unmet, and §6.4 rests on it

> **MET at round 3, and this section stays LIVE.** `check-error-caching.mjs`,
> `demo-error-poisoning.mjs` and `demo-quota-install.mjs` are recovered, wired into
> `ci.yml`, and green. Round 3 also fixed an **eighth false green** inside them: the
> fixture's `cache.keys()` returned bare strings where the real API returns `Request`
> objects, so a keep-list matched nothing and **a mutant deleting the whole keep-list
> passed the entire suite**. Repaired by asserting *the act of deletion* rather than
> the residue `addAll` erases. `demo-quota-install.mjs` is retained **re-labelled as
> the characterisation of an open defect** — 0108 inherits a working reproduction
> instead of rebuilding one. **Architecture §6.4's ordering premise is now true rather
> than assumed.**

`check-error-caching.mjs` and `demo-error-poisoning.mjs` were built and then
**stripped** at `d53dfbc` ("sw.js ships alone"). That was right for that commit's
purpose and is **not right for the merge**: acceptance criterion §3.5 — *the one that
matters most* — is currently unmet, and `.github/ci/` carries no check for this class.

**This is not a tidy-up and it is not new scope.** Architecture **§6.4** is the ruling
that lets `PUP-WO-0105` go *before* the `PUP-WO-0104` cache gate, and its entire
reason is that **a worker change must be gated by a check for the class it changes**,
which 0105 was to satisfy by bringing its own. Merge without it and the ordering
ruling is falsified and the flip proceeds on a premise that is not true.

Required:

- **Recover both files from `d53dfbc^`** rather than rewriting them. You already did
  this work; do not do it twice.
- **Wire them into `ci.yml`'s `checks` job.** Feedback §6.3 records that neither was
  wired. An unregistered check is a file, not a gate.
- **Extend the check to 0a.1's class**: a squeezed-quota install must be *asserted*,
  not measured and printed. You already produced the A/B by hand, so the mechanism
  exists; if quota cannot be constrained inside the CI harness, **that is a
  flag-and-stop and a ruling, not a limit to declare.**
- **Both red first**, against the unguarded worker and against the un-reclaiming
  install respectively, each with the commit and the failing step name
  (architecture §5).

### 0a.5 §7's third-round condition fired, and this is the ruling on it

§7 says a second pass finding serious defects means *"the problem is not the guard."*
**It fired, and the reading is accepted rather than waived: the problem is not the
guard.** The guard is six executable lines and both passes confirmed it correct. What
went wrong is upstream of it — **P1 was scoped as *rebuild the firebreak* and became
an open-ended `sw.js` investigation in which each pass spawns another `sw.js` work
order.** Seven work orders exist and zero games.

So the response is **not another round of widening.** F1 is admitted because it
defeats §0's own claim on the one device that matters, and because its fix lives in
the same file, in the same update path, and is bounded by §0a.2. **Nothing else is
admitted.** See §4's standing instruction.

## 1. Scope

**Two changes, plus the tests that prove them. Items 1 and 2 are BUILT and verified —
they are recorded here as the standing scope, not as work.** Item 3 is what is open.

1. **Guard the cache write on response status.** Store only what should be stored.
   `response.ok` is the obvious predicate; **justify whatever you choose in the
   feedback file**, including what it does to opaque responses.

2. **Rule on opaque cross-origin responses, which `sw.js:225` already raises.** A
   `no-cors` response has `type: 'opaque'`, `status: 0`, and zero readable bytes.
   `response.ok` is `false` for opaque, so a naive guard **stops caching the CDN
   assets the Map panel needs offline** — and that is invariant 3, which is exactly
   the failure this project has ruled on three times: *what legitimate behaviour does
   this fix now refuse?* **Answer it before writing the guard, not after.**
   Note `PUP-WO-0600` may vendor those assets and dissolve the question; do not
   depend on that.

3. ~~**Make the fix able to arrive** — the install path, §0a.~~ **WITHDRAWN
   2026-09-01 and moved to `PUP-WO-0108`.** Round 3 built it and it regressed the
   device class it was written for: the quota swallow lets `activate` run, and
   `activate` deletes `pup-pad-v16`, which held the last good shell. See §0a's
   amendment banner. **`install` reverts to `caches.open(CACHE_NAME).then(c =>
   c.addAll(urlsToCache))`.** Everything under `.github/ci/` from round 3 **stays.**

4. **Do not change anything else in `sw.js`.** Not the reap, not the prefix
   derivation, not the `/stable/` decline, not the legacy exception. They are correct
   and reviewed. **`CACHE_VERSION` stays `v17`** — the v18 bump was flagged, measured
   and reversed (0 of 24 tiles offline), and its reasoning is preserved in the file.
   Do not reintroduce it, and do not add an activate-time `addAll`.

## 2. Invariants — restated by number

- **3** — every core surface works with no network. This defect makes the app shell
  itself fail offline, which is the strongest form of that failure.
- **5** — no state ends play without a one-tap way back. A poisoned shell has no tap
  out of it at all.

**Protected surfaces — must diff to empty:** `index.html`, `manifest.json`, both
icons. **`sw.js` is the subject.** `.github/ci/` **and
`.github/workflows/ci.yml`'s `checks` job** may be touched **only** for the tests
in §3 — registering a check is part of building it, since an unregistered check is a
file and not a gate — the cache gate's shape is `PUP-WO-0104`'s and must not be pre-empted.

## 3. Acceptance — proven, not asserted

1. `git fetch origin && git diff origin/main --stat` shows `sw.js`, `.github/ci/`,
   `.github/workflows/ci.yml` and `docs/` only. Changes to `ci.yml` must be confined
   to the `checks` job — no trigger, permission, environment or other job may move.
   *(Corrected 2026-09-01. This line previously omitted `ci.yml` while §0a.4 and §3.8
   both **required** wiring the checks into it — **the work order forbade what it
   demanded**, which is CC-A's own map-before-dispatch ruling failing on CC-A's own
   authoring, and the third appearance of this shape after `PUP-WO-0102` §2/§3.1.
   The builder **declared it before the gate ran** rather than crossing it silently
   or arguing it, which is the behaviour the contradiction rule exists to produce.)*
2. **Demonstrated RED first, in a real browser:** against an origin returning 404,
   show the app shell poisoned *before* the fix and clean *after*. `PUP-WO-0103`'s
   lens 1 reproduced the poisoning; reproduce it yourself rather than citing it.
3. **The offline path still works** — cold start, airplane mode, every panel.
4. **§1.2's answer demonstrated:** whatever you decide about opaque responses, show
   the Map panel's offline behaviour under it. If it degrades, that is a finding and
   a flag-and-stop, not a trade to make quietly.
5. **A check that would have caught this.** *This is the acceptance criterion that
   matters most, and the requirement is narrower than it first looks.*

   The obvious diagnosis — *the sandbox `fetch` always throws, so the `.then` branch
   never runs* — is true of the default stub and **too coarse**. One mutation, `B7`,
   already makes the fetch resolve. **The real blindness is the shape of what it
   resolves to:** a bare object `{ clone: () => 'LIVE' }`, with no `status`, no `ok`,
   and not a `Response`. Across the whole CI tree the only `new Response` occurrences
   are inside `sw.js` *mutation text* — the offline 504, never a fetched response.

   So **no check in this artifact can express "the worker cached an error
   response,"** and it is not because a branch is unreachable. **It is because the
   one fixture that reaches it cannot carry the property under test.** The fixture
   was built to prove the stub *fired*, never to carry a status.

   Required: a fixture that is a real `Response` with a settable status, **and an
   assertion that reads the status of what was cached.** A stub that cannot fail is
   not a test; a stub that can only fail is not one either; and **a stub that can
   neither carry nor be asked about the property under test is not one at all.**
   Demonstrate the check red against the unguarded worker.
   *(Corrected mid-authoring from `PUP-WO-0103`'s pass: CC-B overrode its own agent's
   "cannot express this at all" as too strong and supplied the sharper mechanism.)*
6. **Every demonstration asserts the commit and the failing step name**
   (architecture §5).

7. ~~The guard arrives on a squeezed device.~~ **WITHDRAWN to `PUP-WO-0108`** with
   §1.3. **Replaced by:** the revert restores round 2's `install` exactly, and no
   check is left asserting behaviour the revert removed. An assertion pointing at
   code that is gone is family member 1 — it passes by not running.
8. **§3.5's check exists, is registered in `ci.yml`, and covers both classes**
   (§0a.4), each shown red first.

## 4. Scope fence — NOT in this work order

- **The cache gate's shape** — the origin-mapped browser, content assertions across
  `urlsToCache`, M9/M7. All `PUP-WO-0104`'s. You may fix the stub in §3.5 because
  this defect is invisible without it; do not build 0104's gate.
- **`index.html`**, including the CDN loads — `PUP-WO-0600`.
- **Publication and the deploy path** — `PUP-WO-0103`.
- **The reap, the prefix derivation, the `/stable/` decline, the legacy exception.**
- **Whether the worker should cache cross-origin tiles at all.** Real, unratified,
  and **it has no home** — architecture §6.5 records that `PUP-WO-0600` cannot
  receive it, because OSM tiles are per-coordinate map data and unvendorable. It gets
  its own numbered work order **after P2**. Do not answer it here.
- **The un-closable Map overlay** — `PUP-WO-0106`, CC-A's to author.
- **The quota path — `PUP-WO-0108`, CC-A's to author, and it is where §0a.1–§0a.3
  went.** Its opening scope is round 3's four findings, which specify it better than
  a fresh draft could: `activate`'s unstated precondition, a **proportional** reclaim
  (a lens built one — it repairs the shell *and* keeps the map, so the trade this
  work order called forced **is not forced**), the keep-list resolving against
  `registration.scope` while `addAll` resolves against the script URL, and the
  harness's HTTP-versus-quota ordering model, which is backwards and which `sw.js`
  *reasons from* to conclude a fallback "is not needed."
  **Parked STRICTLY BEHIND P2, in sequence: `PUP-WO-0104`, `0106`, `0108`, tiles.**
  *(CC-A first ranked 0108 ahead of 0104 on live severity. **That argument rested on a
  child using the app, and Scotty removed exactly that premise** when he dropped the
  merge gate: Buddy is not using PupPad until we say so, so **nothing is live-severity
  while nobody is holding the tablet.** The same reasoning that widened the merge
  authority demotes 0108 — ruled 2026-09-01 by the co-architect, and the symmetry is
  the reason it is right rather than merely decided.)* *(`PUP-WO-0107` was dissolved into §0a.4 and its number is not
  reused.)*

**And a standing instruction on this work order specifically, from Scotty:
`PUP-WO-0105` does not grow again.** Seven work orders exist and zero games. P1 was
scoped as *rebuild the firebreak* and has become an open-ended `sw.js` investigation
where each pass spawns another `sw.js` work order. Architecture §6.4 is explicit that
**P1 closes on its own gate, not on `PUP-WO-0104`**: items 1 and 2 are met, items 3
and 4 are live verifications Scotty runs. So the path is short — this work order
merges, Scotty flips, gates 3 and 4 run, **P1 is done**.

**A new `sw.js` finding does not reopen P1 unless it is live-on-the-tablet severity,
which is the bar `PUP-WO-0105` itself cleared.** Anything else: record it in the
feedback file with its severity, **park it as its own numbered work order after P2,
and do not build it here.** P2 is the priority the moment the flip is done.

## 5. Adversarial pass

Black-box, fresh subagent, artifact and ground truth only. **Freeze every named
deliverable including the feedback file, then resolve every pointer the prompt cites
against the frozen tree** — and on a miss, print the surrounding lines of the cited
file, never the count (architecture §6.1, member 4).

Probes:

- **Poison the cache some other way.** A redirect, a 206, an opaque response, a
  response with the wrong `Content-Type`, a 200 whose body is an error page.
- **What does the guard now refuse?** The standing question, and here it has a known
  candidate: the offline CDN assets.
- **Attack the stub.** Can it resolve? With a non-OK status? An opaque response? If
  any of those is unreachable, the check is blind in that direction.
- **Find another branch of `sw.js` that no check executes.**

## 6. Upward feedback

`docs/feedback/PUP-WO-0105.md`; verbatim exchange in
`docs/findings/PUP-WO-0105-adversarial.md`.

## 7. Flag-and-stop

- **The guard degrading any panel's offline behaviour** — including the Map panel
  via opaque responses. A trade between invariant 3 in one place and invariant 3 in
  another is a ruling, not a build step.
- Any need to touch `index.html`, `manifest.json`, or an icon.
- Any need to build `PUP-WO-0104`'s gate to prove this.
- **Quota not constrainable inside the CI harness** (§0a.4). A ruling, not a limit
  to declare.
- **A measurement contradicting §0a.3's ranking** — shell over map. That is an
  invariant-against-invariant trade and it is CC-A's call, not a build step.
- **`QuotaExceededError` proving inseparable from a fetch failure** by any path
  (§0a.2). Do not ship a blanket catch and describe it as a fix.
- A second adversarial pass finding serious defects — this work order is one guard,
  and if it takes three rounds the problem is not the guard.

## 8. Provenance

**§0a added 2026-09-01 after the round-2 pass.** F1 is the builder's finding and it
falsified a claim CC-A had already accepted and repeated upward — *"shipping a
byte-different `sw.js` IS the re-fetch"* — which is true only with quota headroom.
The two facts that compose into it were **both already in `sw.js`'s own comments and
had never been put together**, which is this work order's own finding recurring inside
the file that records it. §0a.4 is CC-A's: the ordering ruling in architecture §6.4
was written on the premise that 0105 brings its own gate, and stripping the check at
`d53dfbc` quietly falsified it. Nothing ever asked whether that recommendation became
a commit.

Written by CC-A 2026-09-01, mid-`PUP-WO-0103` adversarial pass, on a defect found by
two independent lenses from opposite ends: one reproduced the poisoned shell in
Chromium, the other found the harness reason CI cannot see it. Neither read the
other. The defect predates `PUP-WO-0102` — the pre-0102 worker carries the identical
unguarded `put` — so 0102 rewrote this handler extensively and carried it through.

**The comment directly above the bug is the record of how it survived:** it
enumerates every way `cache.put` can *reject* — non-GET, 206, opaque redirect — and
handles each. The case never considered is the one where `cache.put` **succeeds and
stores the wrong thing.** The author verified against the failure he imagined.
