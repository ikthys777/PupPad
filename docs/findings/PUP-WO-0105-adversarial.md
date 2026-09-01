# PUP-WO-0105 — adversarial pass, subject `ba45d30`

> **NOTE, ADDED AT MERGE.** This branch ships **`sw.js` alone**. The two test files it
> describes — `.github/ci/check-error-caching.mjs` and `.github/ci/demo-error-poisoning.mjs`
> — were **stripped and moved to `PUP-WO-0106`** by the architect's ruling after the
> second pass, because the demonstration printed `DEMO GREEN` over a poisoned shell and
> the check passed when the error response never existed. They are unwired today, but
> `PUP-WO-0107` owns them now (renumbered by the architect; the trap took 0106), and
> shipping a check that will later be wired while it
> prints green over the exact defect it names is the "looks like coverage" failure with
> a delayed fuse. **Ship what is verified: the guard is, the evidence is not.**
> References to those two paths below are therefore historical — they describe what was
> reviewed, not what merges.

**Four independent reviewers**, dispatched simultaneously, each reading its instructions
from `docs/findings/PUP-WO-0105-pass-prompt.md` in the frozen tree rather than from the
dispatcher, each verifying `HEAD` and a clean tree before starting.

    lens 1   probes 1 + 2 — poison the cache another way; attack the opaque claim
    lens 2   probes 3 + 4 — attack the fixture; attack the version bump
    lens 3   probes 5 + 6 — find an unexecuted branch; verify the builder's claims
    lens 4   UNASSIGNED — sent at the seams the partition does not cover

**Verdict: the guard is correct and no lens could break it.** Every serious finding is
in what shipped *beside* the guard, or in the evidence offered for it.

---

## THE HEADLINE — the `v17 → v18` bump was an invariant-3 regression, and it was mine

Three lenses converged. The builder reproduced both halves before accepting them, and
the architect verified them independently before reversing his own ruling.

### It deleted the Map panel's offline assets

Everything cross-origin is runtime-cached into the **same versioned cache** as the five
precache entries — leaflet, supabase, and every OpenStreetMap tile. Verified directly:

    puppad|%2FPupPad%2F|v18: { /PupPad/index.html:200, manifest:200, icon-192:200,
                               icon-512:200, /PupPad/:200,
                               leaflet.min.css:0, leaflet.min.js:0, supabase.min.js:0 }

The activate reap is `name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME`, so v18
deletes v17 whole and `addAll` restores five entries. Everything else is gone.

**Lens 4 ran the falsification test northstar invariant 3 actually specifies** — *"cold
start from the home screen in airplane mode; find any surface that fails to open or
renders unusable"* — A/B, persistent profile across a browser restart, network
blackholed at the browser and sanity-probed each run:

    CONTROL   (v17): caches 32 entries, osmTiles 24 -> map render: 24 of 24 tiles
    TREATMENT (v18): caches  8 entries, osmTiles  0 -> map render:  0 of 24 tiles

A treasure map with no map. Nobody had run that test. Lens 2 and lens 3 reproduced the
same loss independently, lens 3 with a runtime same-origin asset as well.

**So the commit traded invariant 3 against invariant 3** — precisely the trade §1.2 of
the work order exists to prevent, and which the guard itself had been carefully written
to avoid. The builder refused `response.ok` because it would cost the Map panel its
offline assets, then added a bump that cost the Map panel its offline assets.

### And it was never necessary

The justification was that a poisoned device *"keeps serving it until something
re-fetches that exact URL while online, and a three-year-old cannot cause that."*

**The new worker's own install is that re-fetch.** `install` is
`caches.open(CACHE_NAME).then(c => c.addAll(urlsToCache))`; with `CACHE_NAME` unchanged
that opens the **existing** cache and puts fresh copies over all five precached URLs,
including the poisoned ones. Shipping a byte-different `sw.js` is the trigger. The
builder built a guarded-but-unbumped worker and ran it:

    1. POISONED (unguarded):  /PupPad/index.html: 404   leaflet:0 css:0 supabase:0
    2. AFTER THE FIX SHIPS:   /PupPad/index.html: 200   leaflet:0 css:0 supabase:0

Shell repaired, runtime cache intact. Lens 2 checked the third state: if the origin is
still erroring when the fix ships, `addAll` rejects, v18 never activates, the poison
stands, and a stray empty v18 cache is left behind.

**Across all three device states — online healthy, offline, online-still-erroring — the
bump delivers the recovery it was justified by in none of them.** And there is no
residual case: `index.html` has no relative `./` subresources, so `addAll` covers every
same-origin asset that can be poisoned.

**Disposition: REVERTED to v17.** The reasoning is kept as a comment at the constant so
the next person does not re-derive it. **The activate-time `addAll` both lenses proposed
was NOT added** — it is a mechanism for a problem now proved not to exist, and adding
one after proving it unnecessary is a failure mode this project has paid for before.

### The methodological finding, which outlives the defect

The builder's acceptance-3 argument was: *"the guard moves exactly one cell of the
matrix, so no panel can lose an asset it previously had — which is a stronger argument
than driving the UI would be, and it is measured rather than reasoned."*

**True of the guard. False of the commit.** The measurement covered the guard; it was
extended to the whole artifact by reasoning. And driving the UI is exactly what catches
it — lens 4 called `openTreasureMap()` and saw a blank grey rectangle.

**The argument offered for not running the UI test is what concealed the defect the UI
test finds.**

> **A PER-CHANGE SAFETY ARGUMENT DOES NOT COMPOSE ACROSS CHANGES IN ONE COMMIT.**
> Two individually-safe changes in one commit are not a safe commit, and the per-change
> analysis is what makes that invisible.

The architect recorded his own half: he accepted *"measured, not reasoned"* and extended
it to the commit without checking what the measurement covered — the same composition
error, made by the reviewer whose job is to catch it — and waived the UI test on that
argument.

### And the prompt was built so the probe could only agree

Lens 4's sharpest observation. Five of six probes aim at the three changed guard lines.
Probe 4 is the only one aimed at the bump, and its four questions — mid-flight,
`/stable/`, offline-for-a-week, *"is there any state with neither worker"* — are **all
about FAILURE to update**, so all four could only answer *safe*. None asked what a
**successful** update costs, which is the only state in which the bump does anything.

A probe written about one's own decision that could only return good news. That is the
prompt as artifact, and it is the second consecutive work order in which the unassigned
lens found what the partition could not.

---

## THE EVIDENCE WAS WEAKER THAN THE FIX

### `demo-error-poisoning.mjs` passed a worker that cached nothing at all
**Lens 3. Reproduced by the builder. Disqualifying as evidence — this file is
acceptance 2's vehicle.**

    const poisoned = (after.status && after.status !== 200) ||
                     (served.body || '').includes('THIS IS THE ERROR PAGE');

A cache **miss** has no `.status`; a 504 has an **empty body**. Against a mutant that
precached nothing and cached nothing:

    1. healthy    {"missing":true}
    2. after one 404 while ONLINE  {"missing":true}
    3. OFFLINE, what the device serves  {"status":504,"body":""}
    DEMO GREEN — the 404 was refused; the shell survived...

The evidence of total failure printed two lines above a verdict contradicting it — §6.1's
family, in the file written to demonstrate §6.1's family, in a work order whose own §6.5
is about false greens. **The builder's third false-green of the day.**

To the artifact's credit, lens 3 noted the *sandbox* check catches the same mutant: it
has the positive controls the browser demo lacked.

**Disposition: FIXED.** Every step must now prove it did its job before the verdict is
allowed to mean anything — the shell must have been cached healthy first, must still be
200 after the error, and what the device serves offline must be the real app rather than
merely not-an-error. Verified three ways: GREEN on the guard, RED on `origin/main` for
the poisoning, RED on the null worker for *"step 1 never cached a healthy shell, so
nothing below tested anything."*

### Acceptance 6 was marked met by a mechanism that did not exist
**Lens 3. Reproduced by the builder.**

The feedback file claimed *"met — subject blob `72f1699…` recorded in each run."*

    $ grep -niE "rev-parse|git |blob|sha|hash|72f1699" <both new files>
      (two prose hits on the word "blob"; NO blob is recorded)

Neither file recorded any commit, blob or SHA. The value was computed by hand at a
shell. `docs/architecture.md:135` is explicit — *"a demonstration asserts `head_sha`
against the commit under test and the failing step's name"* — and that ruling exists
because the same thing happened four times in `PUP-WO-0103`.

**Claiming a mechanism that does not exist, in a work order about fixtures that cannot
carry the property under test.**

**Disposition: FIXED.** Both files now compute and print the subject blob. The
`origin/main` run prints `72f1699197d9b94726cd52334464b45b8d1c89d3` — the value
previously asserted by hand is now produced by the run.

### The "hermetic" claim was false
**Lens 3. Reproduced.** `ctx.route()` aborts the **page's** requests; once the worker
controls the page, its own `fetch()` bypasses the route and reaches the public internet.
With the route in place the worker still cached three real CDN responses; only blocking
at the resolver isolated it. The comment claimed the opposite. **Disposition: comment
CORRECTED.** Note this affects `check-load.mjs` and `demo-two-path-caches.mjs` too —
recorded, not changed, as those are not this work order's.

---

## THE NEXT `PUP-WO-0105` LIVES AT `sw.js`'s CROSS-ORIGIN BRANCH
**Lens 3, probe 5's answer. Reproduced by the builder.**

`if (u.origin !== self.location.origin) return true;` — V8 coverage count **0** across
every check that loads the worker. The only origin literals in `.github/ci` are
`ikthys777.github.io` and `127.0.0.1`, and **no check ever mixes them**; all three
Chromium scripts abort cross-origin at the Playwright route.

Mutating it to `return false` — the worker caches no cross-origin asset, so leaflet,
supabase and every tile are absent offline — left **every check green**, with
`check-mutations` byte-identical to the unmutated run. The builder reproduced this:

    check-syntax GREEN · check-assets GREEN · check-cache-isolation GREEN
    check-mutations GREEN · check-load GREEN · demo-two-path-caches GREEN

**And the new check was green too**, which is the sharp part: its opaque assertion
dispatches a *same-origin* URL with `type: 'opaque'` forced on by `defineProperty`. It
tested the guard's **predicate** and never the **path** — this work order's own defect,
one level over, in the file written to fix it.

**Disposition: FIXED.** `check-error-caching.mjs` now dispatches a genuinely foreign
origin. Against the mutant it is the **only** check in the tree that goes red:

    FAIL  the worker DECLINED a cross-origin request outright — the Map panel gets nothing

The forced-opaque assertion still prints `ok` on that mutant, which is the demonstration
that predicate and path are two different things.

---

## CARRIED FORWARD, NOT FIXED HERE

### Opaque cache entries cost ~8 MB of quota EACH
**Lens 1. Measured independently by the builder.**

    20 OPAQUE     1KB entries -> usage delta 161,760,429  => per entry 8,088,021
    20 SAME-ORIGIN 1KB entries -> usage delta      26,480  => per entry     1,324
    padding factor: 6,109x

Chrome pads opaque responses for quota accounting. Leaflet's tiles are all opaque, so
**panning the map is a quota-exhaustion path**: a few minutes at ~25 tiles a screen can
fill a low-end tablet's origin quota. Then `cache.put` rejects with QuotaExceededError —
swallowed silently by the `.catch` — and, worse, `install`'s `addAll` fails, so **the
device can never receive this fix or any future one.** The safety property "a failed
install leaves the old worker serving" is also a permanent lockout property.

**Pre-existing, identical on `main`, not a regression from this guard** — but the
builder's §2 reasoning ("the opaque row is byte-identical before and after, therefore
harmless") is exactly what would have kept it invisible. Caching opaque *failures* is
not free; it is ~8 MB each. **Needs an architect's ruling on whether tiles are cached at
all.** `PUP-WO-0600` dissolves the CDN assets but **not** the tiles.

### The opaque claim is true; the conclusion drawn from it was wider than the evidence
**Lens 1, and it is the answer to the priority probe.**

Attacked across twelve observables — status, statusText, ok, type, url, redirected,
body null, bodyUsed, header count, headers, arrayBuffer bytes, blob size — live and
after a `cache.put`/`cache.match` round trip: **zero differences.** `response.body` is
`null`, not merely unreadable. **The `NOT ASSERTED:` line is a genuine platform limit,
not an excuse.**

But the worker *chooses* the opacity by passing `event.request` straight through, and
all three third parties serve `access-control-allow-origin: *`, so a `cors`-mode request
was available that would have made the status readable. Lens 1 then argued against its
own finding: a naive always-cors **regresses** any host that omits ACAO on a 200, so a
real fix needs try-cors-then-fall-back, and `PUP-WO-0600` removes the CDN loads anyway.
**Disposition: deferred, and the comment should say the deferral is a choice rather than
a law of physics.**

### The guard merges with no regression protection
**Lens 2 and lens 3.** `ci.yml` runs seven checks and neither new file is among them.
**The unguarded worker — the live defect — passes all seven.** Deleting the guard
reproduces the defect under a fully green gate. Additionally `check-mutations` has no
anchor on the guard, so even once wired, nothing verifies the new check can fail.
Fenced out of this work order by acceptance 1; the architect has assigned the wiring to
`PUP-WO-0104`, which must open `ci.yml` anyway.

### Smaller, recorded
- **A 200 whose body is an error page, an empty 200, and a wrong-Content-Type 200 all
  pass the guard** (lens 1). Identical on `main`; no status predicate can catch them.
  The captive-portal case cannot occur here — PupPad is HTTPS, so a portal cannot MITM
  and the fetch rejects at the network layer. Residual: a bad deploy publishing a
  broken-but-200 shell. The `NOT ASSERTED:` block names only the opaque hole and a
  reader would take away that it is the only gap.
- **A cached `redirected: true` response makes an offline navigation fail with
  `net::ERR_FAILED`** — blank and silent (lens 1). Currently unreachable: navigations
  carry `redirect: 'manual'` and yield `opaqueredirect`, which the guard now refuses. A
  trap for whoever adds a sixth precache URL.
- **The 404/500/503 loop is a code list, not a predicate** (lens 2). Two mutant guards
  that enumerate codes survive it; the work order names **429** as a trigger and it is
  untested. Harmless against `.ok`, a gap on the next edit.
- **A failed install leaks an empty cache under the new name** (lens 2). Harmless; the
  still-active old worker reaps it.
- **The orphan assertion tests half its label** (lens 3): `orphanStore` is empty, so the
  filter never runs and only `unregister()` is asserted. The orphaned cache — the point
  of the branch — is untested.
- **`sw.js`'s two dot-segment cases are dead code** (lens 3): the WHATWG URL parser
  normalises `.`, `..` and their percent-encoded forms before `canonicalPath` sees them,
  so two labelled test cases pass for a reason other than the one they name.
- **`setOffline(true)` does not isolate a worker even from the real internet** (lens 4):
  with it set, the origin dead and the HTTP cache cleared, the worker still fetched 24
  live OSM tiles. Only a browser-level blackhole works; `--host-resolver-rules` did not.
  Any future offline check built on `setOffline` reports a green the network provided.

---

## WHAT THE PASS COULD NOT BREAK

- **The guard.** No lens got a same-origin HTTP error past it. 404, 401, 429, 500, 304
  and a followed `302→404` are all refused under the guard and all cached under `main`.
- **The guard drops nothing legitimate.** Across 20 response shapes, not one *usable*
  response went from cached to not-cached. Every removed cell was an error status, a
  0-byte 304, or an opaqueredirect that would have broken navigation.
- **It fixes more than was claimed.** The builder wrote "exactly one cell changes" —
  true of his four-row matrix; across 20 shapes **eight** cells changed, all
  improvements. Under-claiming.
- **The fixture survived attack.** Lens 2 broke `clone()` two new ways, made
  `FakeCacheStorage.put` a no-op, made `match` return `undefined` and an ordinary
  healthy 200, and shortened and removed the flush loop entirely. All went loud and all
  still caught the unguarded worker. **One correction to the file's own account:** the
  flush loop is *not* what prevents a false green — assertions 1, 2 and 4 are load-bearing
  positive controls that fail on the same timing failure. The protection is real but the
  credit was misassigned.
- **Every claim in §1, §2, §4, §6.1 and §6.2 reproduced exactly**, including the
  four-class table against a genuine second origin, the byte-identical B7 failure set,
  and zero `expectFail` on `main`.
- **No defect was found in `sw.js` outside the guarded lines** beyond the coverage gaps
  above. `canonicalPath`, `servesRequest`, `install`, `activate` and the 504 miss path
  behave as their comments say.
