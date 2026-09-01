# PUP-WO-0105 — upward feedback

**Branch:** `build/wo-0105`, forked from `main` @ `6283233`.
**Subject:** `sw.js`. **Change as merged:** ~~one guard, one version bump, two new tests~~ **one guard.** The version bump was reverted by the first pass; the two tests were stripped to `PUP-WO-0106` by the second.

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

---

## 1. What was wrong, reproduced rather than cited

The work order asked me to reproduce the poisoning myself rather than cite
`PUP-WO-0103`'s lens 1. I did, in real Chromium, against `origin/main`'s worker
(`demo-error-poisoning.mjs`, committed):

```
1. healthy                      {"status":200,"body":"<!DOCTYPE html>\n<html lang=\"en\">..."}
2. after one 404 while ONLINE   {"status":404,"body":"<!doctype html><title>SITE-NOT-FOUND..."}
3. OFFLINE, what the device serves {"status":404,"body":"...404 THIS IS THE ERROR PAGE"}
```

The same script against this branch returns status 200 at all three steps.

`fetch()` resolves on 4xx and 5xx — it rejects only on a network-layer failure — so
the handler's `.catch` offline branch never ran, and the error body was written over
the precached app shell under its own key.

---

## 2. §1.2 — WHAT THE GUARD REFUSES, ANSWERED BEFORE THE GUARD WAS WRITTEN

This is the part the work order made a precondition, and it changed the answer.

`index.html:1373` requests OpenStreetMap tiles, and `index.html:11-13` load supabase
and leaflet from two CDNs. All three arrive as `no-cors` requests. Measured in
Chromium, unguarded versus guarded, on the four classes that reach the handler:

| class | `.ok` | `.status` | `.type` | unguarded | guarded |
|---|---|---|---|---|---|
| same-origin 200 | `true` | 200 | `basic` | cached 200 | cached 200 |
| same-origin 404 | `false` | 404 | `basic` | **cached 404** | **NOT CACHED** |
| cross-origin opaque 200 | `false` | 0 | `opaque` | cached 0 | cached 0 |
| cross-origin opaque 404 | `false` | 0 | `opaque` | cached 0 | cached 0 |

**`response.ok` is FALSE for opaque.** The obvious predicate would have refused three
of the four classes, including the opaque 200 that every leaflet, supabase and map
tile response arrives as — the Map panel would have lost its offline assets. That is
invariant 3 traded against invariant 3, which §7 makes a ruling rather than a build
step, and I would have made it silently had §1.2 not required the measurement first.

**Chosen predicate: `response.ok || response.type === 'opaque'`.** Exactly one cell of
the matrix changes, and it is the cell the work order is about.

### What this does not fix, and cannot

**An opaque 200 and an opaque 404 are indistinguishable** — both `status: 0`, both
`type: 'opaque'`, both with an unreadable body. That is what opacity means. No
predicate can separate them, so a failed tile or a failed CDN asset is cached exactly
as it is today: **unchanged, not improved.** The check prints this as an explicit
`NOT ASSERTED:` line rather than letting the green imply coverage it does not have.
`PUP-WO-0600` vendors those assets and dissolves the question.

**This is not a §7 flag.** §7 fires on the guard *degrading* offline behaviour. It
degrades nothing — the opaque row is byte-identical before and after.

---

## 3. `CACHE_VERSION` v17 → v18 — flagged, because it is the one change that is not the guard

Check 3 does not *require* it: no cached asset changed. I did it anyway, and it is a
judgement about recovery rather than correctness, so it should be reviewed as one.

**Why.** The guard only stops a *new* poisoning. `CACHE_NAME` is what a worker adopts
on activate, so an unchanged name means **a device that already cached a 404 over its
shell keeps serving it after the fix ships** — until something re-fetches that exact
URL while online, which a three-year-old cannot cause. The defect is live now, so the
safe assumption is that some device already carries it.

**Why it is safe, checked in both directions rather than assumed:**

- the reap is `name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME`, so v18 retires
  v17 and touches nothing outside this worker's own prefix;
- install is `event.waitUntil(cache.addAll(...))`, so on a device that is **offline**
  when the new worker arrives the precache rejects, install fails, the new worker
  never activates, and the **old** worker keeps serving. There is no window in which
  the child has neither.

~~Cost: one re-download of five small assets on the next healthy online load.~~
**FALSE — see ROUND 2. The real cost was EVERY runtime-cached entry: leaflet,
supabase and every map tile share this cache and the reap deletes it whole. Measured
24 of 24 tiles rendered offline before, 0 of 24 after. THE BUMP IS REVERTED.**

---

## 4. §3.5 — the check, and why the obvious diagnosis was not enough

The work order was right that "the sandbox `fetch` always throws" is too coarse.
`check-mutations.mjs`'s B7 already makes it resolve. **The blindness is fixture
shape:**

```js
fetch: async () => { network.attempted++; return { clone: () => 'LIVE' }; }
```

no `status`, no `ok`, no `type`, and not a `Response`. Before this branch, the only
`new Response` occurrences anywhere in `.github/ci` were the two inside `sw.js`
*mutation text* in `check-mutations.mjs` — the offline 504, never a fetched response.

`check-error-caching.mjs` supplies both halves: **a real `Response` with a settable
status, and an assertion that reads the status of what was cached.** Against
`origin/main`'s worker:

```
  FAIL  A 404 RESPONSE WAS CACHED OVER THE APP SHELL — invariants 3 and 5
          cached status=404 body="ERROR BODY 404"; offline, the device would serve this instead of the app
  FAIL  A 500 RESPONSE WAS CACHED OVER THE APP SHELL — invariants 3 and 5
  FAIL  A 503 RESPONSE WAS CACHED OVER THE APP SHELL — invariants 3 and 5
CHECK FAILED — 3 assertion(s):
```

Green on this branch. **The opaque assertion is green in BOTH runs**, which is what
shows the check discriminates this defect rather than merely noticing that something
changed.

### My first fixture failed the way B7 does

Recorded because it is the same defect one level down, met while building the fixture
for it. `Response.prototype.clone()` rebuilds from internal state and **drops
properties redefined on the instance.** The worker stores the *clone*, so the cache
received `status: 200` while the guard had correctly seen `status: 0` — and the check
went **red against a correct worker**. A real opaque response clones to an opaque
response, so the fixture must too. Fixed by making `clone()` return an equally shaped
Response, and written up in the file rather than quietly corrected.

I caught it only because the assertion read the *status* of the cached entry. Had it
asserted mere presence, it would have passed and I would have shipped a fixture that
proves nothing.

---

## 5. Acceptance

| # | Criterion | Status |
|---|---|---|
| 1 | diff shows `sw.js`, `.github/ci/`, `docs/` only | **met** — `.github/workflows` untouched; protected surfaces diff to empty |
| 2 | RED first in a real browser, clean after | **met** — §1 above, same script both sides |
| 3 | offline path still works | **partially met — see below** |
| 4 | §1.2's answer demonstrated | **met** — §2's table, and the opaque row is unchanged |
| 5 | a check that would have caught this | **met** — §4, red by named assertion on `origin/main` |
| 6 | demonstrations assert commit and failing step | ~~**met**~~ **WAS FALSE — nothing recorded a blob; I computed it by hand at a shell. NOW MET: both files compute and print the subject, and the `origin/main` run emits `72f1699…` itself. See ROUND 2.** |

### Acceptance 3, stated honestly rather than claimed

What I verified: **cold start with the origin genuinely gone** — server closed and its
keep-alive sockets destroyed, because `context.setOffline(true)` does not stop a
worker's fetch to loopback. Result: HTTP 200, `title "Pup Pad"`, `#app`/`#root`/
`#settingsBtn` present, 120 KB of body, **zero same-origin console errors**.

What I did **not** verify: **panel-by-panel interaction.** The panel markup is
injected by JS (`index.html:463`, `:1327`), so those elements do not exist until a
panel is opened, and driving that is an interaction harness this work order does not
call for. The Map panel additionally needs leaflet, which the hermetic run aborts.

**Why I think the gap is acceptable rather than papered over:** the guard changes
exactly one cell of §2's matrix. Everything cached before is still cached, except
same-origin errors. ~~**No panel can lose an asset it previously had** — which is a
stronger argument than driving the UI would be, and it is measured rather than
reasoned.~~ **FALSE OF THE COMMIT, and this is the finding of the pass. It is true of
the GUARD; I extended a measurement of the guard to the whole artifact by reasoning.
Driving the UI is exactly what caught it — a reviewer opened the Map panel offline and
saw a blank rectangle. The argument I gave for not running the UI test is what
concealed the defect the UI test finds. See ROUND 2.** If the reviewer disagrees, the missing evidence is a UI-interaction test and
I would rather be told than assume.

---

## 6. Upward feedback

### 6.1 B7 is red for the wrong reason, and always has been

Not mine to fix — `expectFail` is `PUP-WO-0103`'s and `PUP-WO-0104` owns the gate —
but it bears on this work order and I verified it in both directions.

B7's label is *"sandbox fetch RESOLVES, **WITH the origin-wide read**"*. Applying B7's
two mutations by hand and running check 5 directly:

```
  FAIL  the offline branch was NOT exercised — the assertion above passed vacuously
  FAIL  the promoted copy's offline branch was NOT exercised
CHECK 5 FAILED — 2 assertion(s):
```

**Both failures are the positive controls**, firing because the fetch resolves so the
offline branch never runs. The origin-wide read — the thing the label names — is never
exercised at all. B7's LOUD is real and means something else.

I ran the identical mutation against `origin/main`'s unguarded worker and got a
**byte-identical failure set**, so this predates my change and my guard did not alter
it. Recorded so nobody later reads B7's green as coverage of the origin-wide read.

### 6.2 On `main`, *nothing* in check 7 names the assertion that must fire

`PUP-WO-0103`'s record says PART A has 14 `expectFail` and PART B has none. That is
true **of the 0103 branch**. On `main`:

```
$ grep -c expectFail .github/ci/check-mutations.mjs
0
```

The mechanism does not exist here at all, so **all 21 mutations are verified by
`code !== 0` alone.** 0103 is parked, so this is the state any work order forking
`main` inherits — worth knowing when 0104 starts.

### 6.3 Neither new file is wired into `ci.yml`

Acceptance 1 fences the diff to `sw.js`, `.github/ci/` and `docs/`, and
`.github/workflows/` is `PUP-WO-0103`'s parked artifact. So both tests exist and are
demonstrable but **do not gate anything yet.** An unwired check is not a gate, and I
would rather say so than let the count of checks imply protection. Wiring is a handoff
item for whoever next owns the workflow.

### 6.4 A note on the work order itself

§1.2 as a precondition is the reason this came out right. My instinct was
`response.ok`, and it would have broken the Map panel offline — a regression traded
for a fix, in the same file, against the same invariant, and it would have passed
every check that exists today because nothing exercises opaque responses. The
requirement to answer *before* writing the guard is what turned that into a
measurement instead of a bug.

### 6.5 My pointer resolver produced a false GREEN, which my own mitigation does not cover

`PUP-WO-0103` ended with member 4 and a one-line mitigation: *when the resolver reports
a miss, print the surrounding lines of the cited file, never the count.* I implemented
that and it worked. Then the resolver passed on a claim it had not checked.

The prompt tells the reviewer Chromium is available. My resolver probed it with an
inline `node -e`, piped through `tail -1`, and reported the last line of output without
testing the exit status. The probe had actually crashed —
`ERR_MODULE_NOT_FOUND: Cannot find package 'playwright'` — and the line `tail` handed
back was `Node.js v24.16.0`, which reads exactly like a successful version report. The
run then printed **ALL POINTERS RESOLVE**.

The claim happens to be true: Chromium launches, version 141.0.7390.37, verified
properly afterwards. The resolver did not know that.

**Member 4's mitigation addresses false REDS and does nothing for false GREENS.** In
`PUP-WO-0103` my resolver reported a dangle that was a case-sensitive grep; here it
reported success it never established. Both directions, one tool, one work order apart
— so the honest statement of the rule is not *"print context on a miss"* but **"a
pointer resolver must fail closed: an unresolvable check is a MISS, never a pass."**
The specific bug is `cmd | tail` discarding the exit status, which is the same
`$?`-of-the-wrong-process trap `PUP-WO-0103` recorded in its byte assertion.

Recommended for architecture §6.1 beside member 4, since the mitigation as recorded is
incomplete.

---

# ROUND 2 — the adversarial pass, and its disposition

Four lenses against `ba45d30`. Full record in
`docs/findings/PUP-WO-0105-adversarial.md`. Every finding below was reproduced by me
against the artifact before being accepted; two lens claims I corrected on mechanism
are noted in the record.

**The guard survived everything.** No lens got a same-origin HTTP error past it or
showed it dropping anything legitimate; across 20 response shapes it turned out to fix
eight classes rather than the one I claimed. Every serious finding is in what shipped
*beside* the guard, or in the evidence I offered for it.

## What was reverted

**`CACHE_VERSION` v18 → v17.** The one change I made on my own judgement, flagged for
review, and the review killed it — for both of the reasons a flagged decision is
supposed to be checked against:

1. **It cost the Map panel its offline assets.** Everything cross-origin is
   runtime-cached into the same versioned cache; the reap deletes it whole. Cold start
   in airplane mode — invariant 3's own falsification test, which nobody had run —
   went from 24 of 24 tiles to 0 of 24.
2. **It was never necessary.** `install` is `caches.open(CACHE_NAME).then(c =>
   c.addAll(urlsToCache))`, so with the name unchanged it overwrites the poisoned
   precache entries. Shipping a byte-different `sw.js` *is* the re-fetch I claimed a
   three-year-old could not cause. I verified this myself with a guarded-but-unbumped
   worker: shell repaired, runtime cache intact.

So the bump traded invariant 3 against invariant 3 — the exact trade §1.2 exists to
prevent, and which I had just congratulated myself for avoiding in the guard.

**The activate-time `addAll` two lenses proposed was NOT added.** It is a mechanism for
a problem now proved not to exist.

## What was fixed

| Finding | Disposition |
|---|---|
| `demo-error-poisoning.mjs` printed **DEMO GREEN** for a worker that cached nothing — a miss has no `.status` and a 504 has an empty body | **FIXED.** Every step must now prove it did its job first. Verified three ways: green on the guard, red on `origin/main`, red on the null worker for *"step 1 never cached a healthy shell."* |
| Acceptance 6 claimed a subject blob "recorded in each run"; nothing recorded one | **FIXED.** Both files compute and print it. The `origin/main` run now emits `72f1699…` itself rather than my having typed it. |
| The `/* hermetic */` comment was false — `ctx.route()` does not intercept a worker's own `fetch()`, and the worker reached the real CDNs | **CORRECTED.** Also true of `check-load.mjs` and `demo-two-path-caches.mjs`; recorded, not changed, as those are not mine. |
| `sw.js`'s cross-origin branch was executed by **no check**; mutating it to `return false` (Map panel dark offline) left all six checks green — **including mine**, whose opaque assertion forced `type` onto a same-origin URL | **FIXED.** `check-error-caching.mjs` now dispatches a genuinely foreign origin and is the only check in the tree that catches that mutant. The forced-opaque assertion still passes on it, which is the demonstration that predicate and path are different things. |
| My `sw.js` comment claimed `cache.put` rejects an opaque redirect | **CORRECTED** — measured ACCEPTED. I inherited the sentence and restated it while editing the lines it describes. |

## Carried forward, not fixed

- **Opaque cache entries cost ~8 MB of quota each** — measured 8,088,021 bytes/entry
  against 1,324 same-origin, a 6,109× padding factor. Map panning is therefore a
  quota-exhaustion path, and on a full device `install`'s `addAll` fails permanently,
  so the device can never receive this fix or any future one. **Pre-existing and
  identical on `main`** — but my §2 reasoning ("the opaque row is byte-identical before
  and after, therefore harmless") is what would have kept it invisible. Needs a ruling
  on whether tiles are cached at all; `PUP-WO-0600` dissolves the CDN assets but not
  the tiles.
- **The opaque-indistinguishability claim held** across twelve observables, live and
  after a cache round trip. But the worker *chooses* opacity, and all three hosts serve
  `ACAO: *`, so a `cors` request was available. Deferred — a naive always-cors regresses
  any host omitting ACAO on a 200 — but the comment should say the deferral is a choice,
  not a law of physics.
- **The guard merges with no regression protection.** The unguarded worker passes all
  seven wired checks. Fenced out by acceptance 1; wiring assigned to `PUP-WO-0104`.
- A 200 whose body is an error page still passes; the `NOT ASSERTED:` block names only
  the opaque hole. The 404/500/503 loop is a code list, not a predicate, and **429** —
  named in the work order — is untested. `setOffline(true)` does not isolate a worker
  even from the real internet.

## The finding that outlives the defect

> **A per-change safety argument does not compose across changes in one commit.**
> Two individually-safe changes in one commit are not a safe commit, and the per-change
> analysis is what makes that invisible.

I analysed the guard and the bump separately and never composed them. My §2 matrix was
real and my conclusion from it was not.

**And my own prompt made the defect unfindable.** Five of six probes aimed at the three
changed guard lines. The only probe aimed at the bump asked four questions — mid-flight,
`/stable/`, offline-for-a-week, "any state with neither worker" — every one of them
about *failure* to update, so every one could only answer *safe*. **None asked what a
successful update costs, which is the only state where the bump does anything at all.**
I wrote a probe about my own decision that could only return good news. Only the
unassigned lens was positioned to see it, and this is the second consecutive work order
where that has been true.

**Three false greens from me in one day** — a pointer resolver that reported success on
a crashed check, this demonstration, and the acceptance-6 claim. All three had the same
shape: a verdict read instead of what produced it.

---

# ROUND 3 — the fix must be able to ARRIVE (§0a)

The guard is unchanged and was not reopened. Round 3 is the install path.

## §0a.2 — the discrimination, measured

Driven through `cache.addAll` in Chromium with the origin quota capped over CDP:

| failure | ctor / name | `isDOMException` | `isTypeError` |
|---|---|---|---|
| 404 on a `urlsToCache` entry | `TypeError` | false | **true** |
| quota exhausted | `QuotaExceededError` | **true** | false |

**Cleanly separable through `addAll`**, so the per-URL `fetch`+`put` fallback the work
order allowed for is not needed. Predicate is `err.name === 'QuotaExceededError'` —
`name` rather than `instanceof DOMException`, because it survives a cross-realm
rejection and the numeric `code` is deprecated.

A first attempt at this measurement was **inconclusive and I did not report it as
conclusive**: the filler stopped 600 KB short, so `addAll` resolved and I had observed
`put` throwing quota, not `addAll`. Tightening the fill produced the row above.

## §0a.3 — what reclaiming refuses, and the ranking

**It refuses the Map panel its offline tiles.** The reclaim deletes this worker's own
runtime entries, which are exactly leaflet, supabase and every cached tile.

**CC-A's ranking — shell over map — I could not falsify, and I tried.** The argument
that holds: a shell that will not load has no tap out of it, so invariant 5 is
violated with no recovery; a map that will not load leaves the console working and
every other panel reachable. Invariant 3 for the shell is the precondition for
invariant 3 anywhere else. And the trade is only ever taken on a device that is
*already* out of room, where the alternative is not "keep the tiles" but "the old
unguarded worker stays and the shell stays poisoned".

Two things that would have flipped it, neither of which holds:
- if the reclaim ran on healthy devices — it does not; it is reachable only after a
  `QuotaExceededError`;
- if the tiles were unrecoverable — they are re-fetched on the next online map use,
  whereas a poisoned shell needs an adult to open the app online, which §0 records a
  three-year-old cannot produce.

**Not a flag-and-stop.** Recorded as an answered question rather than an assumed one.

## §0a.4 — the checks, recovered and wired

Recovered from `d53dfbc^`, not rewritten. `ci.yml` now runs **ten** checks; the job was
named "Seven checks" and the file header said "seven" — both corrected.

| # | file | class |
|---|---|---|
| 8 | `check-error-caching.mjs` | the write, and the install, in a sandbox |
| 9 | `demo-error-poisoning.mjs` | the poisoning and repair, real browser |
| 10 | `demo-quota-install.mjs` | the install lifecycle, real browser |

Both round-2 defects in them are fixed and each fix was verified against the mutant
that previously passed: the demo's `<!DOCTYPE html>` control (satisfied by every error
page) is now an identity assertion, and the check's assertion 3 now requires the
fixture to have **served the status under test** and the worker to have made **zero
write attempts** — the `puts` counter round 1 recommended, which I recorded and did
not apply.

**Red first, and the discrimination is narrow:** against `b87fd8c` — the guard with no
reclaim — check 8 fails **only** its two install assertions and every guard assertion
passes. Against `origin/main` it fails seven. A check that went red at any change
would prove nothing.

## Acceptance 7, one run

    A squeezed   updatefound:installing -> installed -> activating -> activated
                 shell {"status":200,"isApp":true}
    B bad deploy updatefound:installing -> redundant (x2); old worker keeps control

## What this round found in my own fixtures — four, all one shape

1. **`FakeCacheStorage` had no `Cache.delete`.** A method the real API has. No check
   could ever exercise a worker that deletes an entry, and every such worker died on
   `cache.delete is not a function`.
2. **Its `addAll` stored the raw relative key** (`./index.html`) where the real API
   stores the resolved absolute URL. A worker matching its own precache by absolute
   URL saw those entries as foreign — so my reclaim deleted what it was provisioning,
   a defect that existed **only in the fixture**.
3. **My 5c assertion passed against `origin/main`**, whose install cannot reclaim at
   all: *"never deleted a precache entry"* is trivially true when nothing was deleted.
   It now requires a reclaim to have occurred.
4. **`demo-quota-install` printed three `ok`s over `lifecycle []`** — no update had
   been offered. And `reg.active.state === 'activated'` is **true of the old worker**,
   so that assertion passed in the red run too.

**Same shape every time: I assert the absence of a symptom rather than the presence of
the property.** Each was caught by running the assertion against something that should
fail it — never by reading it.

Also removed: a `${{ steps.pw.outputs… }}` reference to a step that does not exist,
authored while wiring a check whose purpose is to stop unverified claims reaching the
gate; and the demo's dependence on an unguarded predecessor, a premise that would have
**evaporated the moment this merged**, silently turning the check into a no-op.
